// 캐릭터 에셋 1.6.0 — 답장 뒤 다른 모델이 고르기 (실리태번 쪽).
// 답을 받는 순간(MESSAGE_RECEIVED — 다시 쓰기(makeFirst) 뒤 · 번역기 · TTS(CHARACTER_MESSAGE_RENDERED) 전) 대사 문단 앞에 빈 자리를
// await 없이 넣는다. 그 뒤로 글(mes)은 바뀌지 않는다 — 연결한 모델이 고른 이름은 extra.bl_asset_slots 에만 적는다.
// 사용자: 「캐릭터 에셋도 다른 모델이 하게끔 … 비싸서 이렇게라도 돈 아낄 수 있으면」.
import { eventSource, event_types, saveChatConditional, updateMessageBlock } from '../../../../../../../script.js';
import { getContext } from '../../../../../../extensions.js';
import { notifyRerender } from '../../rerender-notify.js';   // 6.5.2 다시 그린 뒤 실리태번 헬퍼에 알림 (코드 블록 → iframe)
import { TITLE, currentFolder, settings, messageFolder } from './state.js';
import { runtime, ensureLoaded, loadMember, memberEntry } from './store.js';
import { pickActive, pickSettings, generatePick } from './pick.js';
import { slotSpots, insertSlots, slotIds, markedReply, pickPrompt, parsePicks, rulesForPicker, hasAssetTag, skipReplyType, PROTECT_RE, RECORD_KEY, swipeOf, textOf, writeRecords, recordsFromPicks, stripSlotsForPrompt, dropUnknownSlots, retryTargets, manualRecord, freezeOthers, splitThinking } from './slots.js';
import { assetInfoFor, refreshSlots, slotRunning, slotHooks, shownSlotFiles } from './render.js';
import { messageWork } from '../../message-work.js';   // 6.5.3 메시지 작업 순서 — 자리 넣기 · 지우기를 적어 둔다 (다시 쓰기 · 번역기가 알아보게)
import { ownerSpellings } from './spellings.js';   // 6.3.x 그림 주인의 영 · 한 · 일 표기 줄 (이름 다리)

const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);

/** 1.6.9 이 답의 주인 폴더 — 1:1 은 지금 캐릭터, 그룹은 그 메시지를 쓴 멤버 (original_avatar) */
function ownerFolder(message, context = getContext()) {
    return context.groupId ? messageFolder(message, context) : currentFolder();
}

/** 고를 목록 { folder, keywords } — 1:1 은 runtime(ensureLoaded), 그룹은 그 멤버 목록(loadMember). 못 읽으면 null */
async function listFor(folder, group) {
    if (!folder) return null;
    if (group) { const entry = memberEntry(folder) ?? await loadMember(folder); return entry?.keywords ? entry : null; }
    const ready = await ensureLoaded();
    return ready && runtime.folder === folder && runtime.keywords ? runtime : null;
}

/** 번역기에 자리 모양을 「번역하지 않고 제자리에 한 번만」으로 등록 (6.1.8 번역기의 protect · 없으면 아무 일도 없음). 여러 번 불러도 된다 */
export function protectInTranslator() {
    try { globalThis[Symbol.for('blue-lemonade.translator')]?.protect?.('character-asset-slots', PROTECT_RE, { noFold: true }); } catch { /* 옛 번역기 */ }
    try { globalThis[Symbol.for('blue-lemonade.translator')]?.protect?.('character-asset-tags', /\{\{img::\s*[^{}]+?\s*\}\}/gi, { noFold: true }); } catch { /* 옛 번역기 */ }   // 7.2.4 본문 모델이 쓴 에셋 태그도 번역에 보내지 않는다 (token-audit)
}


/** 답을 받는 순간 — 여기까지는 동기. 고르기는 기다리지 않는다 (번역기 · TTS 를 붙잡지 않게) */
export function onMessageReceived(messageId, type) {
    try {
        if (skipReplyType(type) || !pickActive()) return;
        const context = getContext();
        const id = Number(messageId);
        const message = context.chat?.[id];
        if (!message || message.is_user || message.is_system || typeof message.mes !== 'string') return;
        const folder = ownerFolder(message, context);   // 1.6.9 그룹은 이 답을 쓴 멤버
        if (!folder) return;
        if (context.groupId) { const entry = memberEntry(folder); if (entry && !entry.keywords) return; }   // 그 멤버에 켜진 그림이 없다
        else if (runtime.folder === folder && !runtime.loading && !runtime.keywords) return;   // 이 캐릭터에 켜진 그림이 없다
        const copied = dropUnknownSlots(message.mes, isObj(message.extra) ? message.extra[RECORD_KEY] : null);   // 모델이 앞 답에서 따라 쓴 자리 (기록 없음)
        if (copied.unknown.length) { messageWork().noteWrite(message, { by: 'assets', before: message.mes, after: copied.text }); message.mes = copied.text; if (Array.isArray(message.swipes)) message.swipes[swipeOf(message)] = copied.text; }
        // 1.6.8 머리의 생각 블록(과일 ECoT — 이 다음 차례에 추론으로 옮겨진다)은 빼고 본문에서만 본다
        const { head, body } = splitThinking(message.mes);
        if (slotIds(message.mes).length || hasAssetTag(body)) return;   // 이미 자리나 태그가 있다
        const spots = slotSpots(body, pickSettings().count);
        if (!spots.length) return;
        const swipe = swipeOf(message);
        const inserted = insertSlots(body, spots), text = head + inserted.text, ids = inserted.ids;
        messageWork().noteWrite(message, { by: 'assets', before: message.mes, after: text });   // 6.5.3
        message.mes = text;
        if (Array.isArray(message.swipes)) message.swipes[swipe] = text;
        writeRecords(message, swipe, Object.fromEntries(ids.map(slot => [slot, { name: '', pending: true }])));
        for (const slot of ids) slotRunning.add(slot);
        void fill(id, message, ids, swipe);
    } catch (error) {
        console.warn(`[${TITLE}] 그림 자리 넣기 실패`, error);
    }
}

const stillHere = (messageId, message) => getContext().chat?.[messageId] === message;

/** 이 메시지 앞의 사용자 글 (맥락 — 짧게) */
function previousText(messageId) {
    const chat = getContext().chat ?? [];
    for (let i = messageId - 1; i >= Math.max(0, messageId - 4); i--) {
        if (chat[i] && !chat[i].is_system) return String(chat[i].mes ?? '');
    }
    return '';
}

let busy = 0;
async function fill(messageId, message, ids, swipe, avoid = []) {
    const controller = new AbortController();
    const pick = pickSettings();
    const timer = setTimeout(() => controller.abort(), pick.timeoutSec * 1000);
    busy++;
    let records;
    try {
        protectInTranslator();
        const group = !!getContext().groupId;
        const folder = ownerFolder(message);
        const list = await listFor(folder, group);   // 1.6.9 그룹은 그 답 주인의 목록
        if (!list) throw new Error('그림 목록을 읽지 못했어요');
        if (!stillHere(messageId, message)) return;
        const strip = globalThis[Symbol.for('blue-lemonade.translator')]?.stripForModel ?? null;   // 7.2.4 번역이 보내지 않는 것은 고르기에도 안 보낸다
        const reply = markedReply(splitThinking(textOf(message, swipe)).body, ids, strip);   // 1.6.8 생각 블록은 고르는 모델에게 보내지 않는다
        const context = getContext();
        const messages = pickPrompt({
            rules: rulesForPicker(settings().prompt, list.folder),
            list: list.keywords,
            reply,
            count: ids.length,
            previous: previousText(messageId),
            strip,
            character: message.name || context.name2 || '',
            names: ownerSpellings(list.keywords),
            persona: context.name1 || '',   // 6.4.1 내 캐릭터 — 그림이 없으면 듣는 사람 그림으로
            avoid,   // 6.5.3 ··· 메뉴 다시 고르기 — 지금 보이던 그림은 피하게
        });
        const raw = await generatePick(messages, controller.signal);
        records = recordsFromPicks(ids, parsePicks(raw, ids.length), name => assetInfoFor(group ? folder : '', name));
    } catch (error) {
        const reason = controller.signal.aborted ? '시간 안에 답이 없어요' : String(error?.message || error || '알 수 없는 오류').slice(0, 60);
        console.warn(`[${TITLE}] 그림 고르기 실패`, error);
        records = Object.fromEntries(ids.map(id => [id, { name: '', pending: false, error: reason }]));
    } finally {
        clearTimeout(timer);
        busy--;
        for (const id of ids) slotRunning.delete(id);
    }
    if (!records || !stillHere(messageId, message)) return;
    // 그 사이 이 스와이프의 글이 바뀌어 자리가 사라졌으면 그 자리는 적지 않는다 (writeRecords 가 지운다)
    writeRecords(message, swipe, records);
    try { await saveChatConditional(); } catch (error) { console.warn(`[${TITLE}] 저장 실패`, error); }
    redraw(messageId, message, swipe);
}

/** 1.7.6 「그림 확장 그림을 에셋으로」가 새로 넣을 자리를 고를 수 있나 — 다른 모델이 고르기가 켜졌고 그 답 주인에 그림 폴더가 있다 */
export function pickReady(message, context = getContext()) {
    return !!(message && !message.is_user && typeof message.mes === 'string' && pickActive() && ownerFolder(message, context));
}
/**
 * 1.7.6 이미 넣어 둔 자리(기록 「고르는 중」)를 답장 뒤 고르기와 같은 길(fill)로 — 메시지마다 한 번, 앞에서부터 차례로 (한꺼번에 부르지 않는다).
 * jobs = [{ index, swipe, ids }]. 그 사이 글에서 사라진 자리 · 다른 채팅이면 건너뛴다. → 부른 수
 */
export async function pickSlots(jobs, { cancelled = () => false } = {}) {
    let calls = 0;
    const chat = getContext().chat;
    const list = Array.isArray(jobs) ? jobs : [];
    for (const { ids } of list) for (const id of ids) slotRunning.add(id);   // 차례를 기다리는 자리도 「고르는 중」 (끊긴 자리로 보이지 않게)
    for (const { index, swipe, ids } of list) {
        const message = chat?.[index];
        const alive = message && getContext().chat === chat && swipeOf(message) === swipe ? ids.filter(id => slotIds(message.mes).includes(id)) : [];
        if (cancelled() || !alive.length) { for (const id of ids) slotRunning.delete(id); continue; }
        for (const id of ids) if (!alive.includes(id)) slotRunning.delete(id);
        calls++;
        await fill(index, message, alive, swipe);
    }
    return calls;
}

/** 고른 뒤 다시 그리기 — 자리 요소가 화면에 있으면 그 메시지만, 없으면(스트리밍 뒤 · 번역문) 메시지를 다시 그린다 */
function redraw(messageId, message, swipe) {
    if (swipeOf(message) !== swipe) return;   // 다른 스와이프를 보고 있다 — 돌아오면 그때 그려진다
    if (refreshSlots(messageId)) return;
    const mes = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (!mes || mes.querySelector('#curEditTextarea')) return;   // 화면에 없거나 고치는 중 (편집 창을 지우지 않게)
    try { updateMessageBlock(messageId, message); } catch (error) { console.debug(`[${TITLE}] 다시 그리기 실패`, error); }
    refreshSlots(messageId);
    void notifyRerender(messageId);   // 6.5.2 다시 그린 뒤 실리태번 헬퍼에 알림 (코드 블록 → iframe)
}

/** 다시 고르기 단추 — 그 메시지의 비었거나 실패한 자리 전부를 한 번에 */
function retry(messageId, slotId) {
    const message = getContext().chat?.[messageId];
    if (!message || !pickActive()) {
        globalThis.toastr?.info?.('「다른 모델이 고르기」가 꺼져 있거나 연결이 정해지지 않았어요.', TITLE);
        return;
    }
    const swipe = swipeOf(message);
    const map = isObj(message.extra?.[RECORD_KEY]) ? message.extra[RECORD_KEY] : {};
    const ids = retryTargets(slotIds(message.mes), map, slotRunning, slotId);   // 사용자가 정한 자리(꾹 눌러 바꾸기 · 빼기)는 다시 묻지 않는다
    if (!ids.length || ids.some(id => slotRunning.has(id))) return;
    writeRecords(message, swipe, Object.fromEntries(ids.map(id => [id, { name: '', pending: true }])));
    for (const id of ids) slotRunning.add(id);
    refreshSlots(messageId);
    void fill(messageId, message, ids, swipe);
}

// ── 6.5.3 메시지 ··· 메뉴 「캐릭터 에셋 다시 고르기」 (그림 확장의 그리기 단추처럼 — 사용자 10-15) ──

/** 번역문(display_text)도 글과 같은 자리로 — 자리 없이(또는 옛 번호로) 번역된 답은 새 자리가 번역 화면에 안 보이니까. 넣을 경계가 모자라면 앞 자리만 */
function addSlotsToTranslation(message, ids) {
    const shown = message.extra?.display_text;
    if (typeof shown !== 'string' || !shown) return false;
    const have = slotIds(shown);
    if (have.length && have.every(slot => ids.includes(slot))) return false;   // 이미 같은 자리
    const bare = stripSlotsForPrompt(shown);   // 지금 글에 없는 옛 자리는 뗀다
    const spots = slotSpots(bare, ids.length);
    const queue = ids.slice(0, spots.length);   // insertSlots 는 뒤 자리부터 번호를 받는다
    message.extra.display_text = spots.length ? insertSlots(bare, spots, () => queue.pop()).text : bare;
    return true;
}

/**
 * 이 답의 그림을 다시 고른다. 자리가 있으면 모두(꾹 눌러 정한 자리도) 새로 · 자리가 없으면(빠진 답 · 예전 답) 자리를 넣고 고른다.
 * 답 받을 때와 같은 고르기(fill)라 다른 모델 연결 · 시간 제한 · 실패 표시가 같다.
 */
export function rerollMessage(messageId) {
    const id = Number(messageId);
    const context = getContext();
    const message = context.chat?.[id];
    if (!message || message.is_user || message.is_system || typeof message.mes !== 'string') return false;
    const say = text => globalThis.toastr?.info?.(text, TITLE);
    if (!pickActive()) { say('「다른 모델이 고르기」가 꺼져 있거나 연결이 정해지지 않았어요.'); return false; }
    if (!ownerFolder(message, context)) { say('이 캐릭터에 켜진 그림 폴더가 없어요.'); return false; }
    const swipe = swipeOf(message);
    let ids = slotIds(message.mes);
    if (ids.some(slot => slotRunning.has(slot))) { say('지금 그림을 고르는 중이에요.'); return false; }
    const map = isObj(message.extra?.[RECORD_KEY]) ? message.extra[RECORD_KEY] : {};
    const avoid = ids.map(slot => map[slot]?.name).filter(Boolean);
    let textChanged = false;
    if (!ids.length) {
        const { head, body } = splitThinking(message.mes);   // 1.6.8 머리의 생각 블록은 빼고
        if (hasAssetTag(body)) { say('이 답은 본문 모델이 그림 태그를 직접 넣었어요.'); return false; }
        const spots = slotSpots(body, pickSettings().count);
        if (!spots.length) { say('그림을 넣을 문단 사이가 없어요.'); return false; }
        const inserted = insertSlots(body, spots), text = head + inserted.text;
        messageWork().noteWrite(message, { by: 'assets', before: message.mes, after: text });
        message.mes = text;
        if (Array.isArray(message.swipes)) message.swipes[swipe] = text;
        ids = inserted.ids;
        textChanged = true;
    }
    if (addSlotsToTranslation(message, ids)) textChanged = true;
    writeRecords(message, swipe, Object.fromEntries(ids.map(slot => [slot, { name: '', pending: true }])));
    for (const slot of ids) slotRunning.add(slot);
    // 고르는 중 표시 — 글 · 번역문에 자리를 새로 넣었으면 화면의 옛 자리(번호가 다름)를 버리고 메시지를 다시 그린다
    if (textChanged && !document.querySelector(`#chat .mes[mesid="${id}"] #curEditTextarea`)) {
        try { updateMessageBlock(id, message); } catch (error) { console.debug(`[${TITLE}] 다시 그리기 실패`, error); }
        refreshSlots(id);
        void notifyRerender(id);   // 6.5.2 다시 그린 뒤 실리태번 헬퍼에 알림 (코드 블록 → iframe)
    } else redraw(id, message, swipe);
    void fill(id, message, ids, swipe, avoid);
    return true;
}

const REROLL_CLASS = 'bl-asset-reroll';
/** 캐릭터 답의 ··· 메뉴에 단추를 단다 (켜져 있지 않으면 뗀다) — 실리태번이 메시지를 새로 그릴 때마다 부른다 */
function syncRerollButtons() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    const context = getContext();
    const on = pickActive() && (!!context.groupId || !!currentFolder());
    const chat = context.chat ?? [];
    for (const mes of chatEl.querySelectorAll('.mes[mesid]')) {
        const message = chat[Number(mes.getAttribute('mesid'))];
        const has = mes.querySelector(`.${REROLL_CLASS}`);
        const want = on && message && !message.is_user && !message.is_system && (!context.groupId || !!ownerFolder(message, context));   // 1.6.9 그룹은 그 답 주인에 폴더가 있을 때
        if (!want) { has?.remove(); continue; }
        if (has) continue;
        const box = mes.querySelector('.extraMesButtons');
        if (!box) continue;
        const button = document.createElement('div');
        button.className = `mes_button ${REROLL_CLASS} fa-solid fa-images interactable`;
        button.tabIndex = 0;
        button.setAttribute('role', 'button');
        button.title = '캐릭터 에셋 다시 고르기';
        button.setAttribute('aria-label', '캐릭터 에셋 다시 고르기');
        box.append(button);
    }
}
function onRerollClick(event) {
    const button = event.target?.closest?.(`.${REROLL_CLASS}`);
    if (!button || (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    event.stopPropagation();
    const mes = button.closest('.mes[mesid]');
    if (mes) rerollMessage(Number(mes.getAttribute('mesid')));
}
let syncTimer = 0;
const scheduleSync = () => { clearTimeout(syncTimer); syncTimer = setTimeout(syncRerollButtons, 50); };

// ── 꾹 눌러 「이 자리만」 (hold.js · viewer.js) ──

/** 이 자리(slotId)가 든 메시지 번호 — 누른 때의 번호에 없으면(앞 메시지를 지움) 채팅에서 찾는다. 없으면 -1 */
function slotHome(messageId, slotId) {
    const chat = getContext().chat ?? [];
    const has = i => typeof chat[i]?.mes === 'string' && chat[i].mes.includes(slotId) && slotIds(chat[i].mes).includes(slotId);
    const at = Number(messageId);
    if (Number.isInteger(at) && has(at)) return at;
    for (let i = chat.length - 1; i >= 0; i--) if (has(i)) return i;
    return -1;
}

/** 지금 스와이프의 그 자리 기록 → { messageId, record } (없으면 null) */
export function slotRecord(messageId, slotId) {
    const id = slotHome(messageId, slotId);
    const record = id >= 0 ? getContext().chat[id].extra?.[RECORD_KEY]?.[slotId] : null;
    return isObj(record) ? { messageId: id, record } : null;
}

/**
 * 이 자리만 바꾸기: name = 파일 이름, '' = 빼기. 그 메시지 · 지금 스와이프의 그 자리 기록만 바꿔 저장하고 그 메시지만 다시 그린다.
 * 고르는 중인 자리 · 사라진 자리(스와이프 · 지움)는 false
 */
export async function setSlotPick(messageId, slotId, name) {
    const id = slotHome(messageId, slotId);
    const message = id >= 0 ? getContext().chat[id] : null;
    if (!message || slotRunning.has(slotId)) return false;
    const swipe = swipeOf(message);
    // 다른 자리는 지금 보이는 파일로 같이 고정한다 — 번호 묶음 고르기가 이 자리를 빼고 다시 섞여 다른 자리의 그림이 바뀌지 않게
    const map = isObj(message.extra?.[RECORD_KEY]) ? message.extra[RECORD_KEY] : {};
    writeRecords(message, swipe, { ...freezeOthers(map, shownSlotFiles(id), slotId), [slotId]: manualRecord(name) });
    redraw(id, message, swipe);
    try { await saveChatConditional(); } catch (error) { console.warn(`[${TITLE}] 저장 실패`, error); }
    return true;
}

/** 채팅 완성: 메시지마다 글(또는 글 조각)에서 자리를 뺀다 — 같은 배열을 고친다 */
export function stripChatPrompt(data) {
    try {
        for (const m of Array.isArray(data?.chat) ? data.chat : []) {
            if (typeof m?.content === 'string') m.content = stripSlotsForPrompt(m.content);
            else if (Array.isArray(m?.content)) for (const part of m.content) if (part && typeof part.text === 'string') part.text = stripSlotsForPrompt(part.text);
        }
    } catch (error) { console.warn(`[${TITLE}] 프롬프트에서 자리 빼기 실패`, error); }
}
/** 텍스트 완성 · generateRaw */
export function stripTextPrompt(data) {
    try { if (data && typeof data.prompt === 'string') data.prompt = stripSlotsForPrompt(data.prompt); }
    catch (error) { console.warn(`[${TITLE}] 프롬프트에서 자리 빼기 실패`, error); }
}

let started = false;
export function setupAfterReply() {
    if (started) return;
    started = true;
    slotHooks.retry = retry;
    // makeFirst 가 아닌 on: 다시 쓰기(makeFirst)가 글을 다 고친 뒤에 자리를 넣는다
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    // 지난 답의 빈 자리가 본문 모델에 가면 모델이 따라 쓴다 — 보내기 직전에 뺀다 (기능을 꺼도: 예전에 넣은 자리)
    if (event_types.CHAT_COMPLETION_PROMPT_READY) eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, stripChatPrompt);
    if (event_types.GENERATE_AFTER_COMBINE_PROMPTS) eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, stripTextPrompt);
    protectInTranslator();
    // 번역기 애드온이 이 애드온보다 늦게 켜질 수 있다 — 테마 애드온 상태가 바뀌면 다시 등록
    for (const name of ['bl:addons-state', 'bl:settings-replaced']) globalThis.window?.addEventListener(name, protectInTranslator);
    // 6.5.3 ··· 메뉴 다시 고르기 단추
    for (const type of ['CHARACTER_MESSAGE_RENDERED', 'CHAT_CHANGED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MORE_MESSAGES_LOADED', 'SETTINGS_UPDATED']) {
        if (event_types[type]) eventSource.on(event_types[type], scheduleSync);
    }
    for (const name of ['bl:addons-state', 'bl:settings-replaced']) globalThis.window?.addEventListener(name, scheduleSync);
    document.addEventListener('click', onRerollClick, true);
    document.addEventListener('keydown', onRerollClick, true);
    scheduleSync();
}
