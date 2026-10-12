// 캐릭터 에셋 1.6.0 — 답장 뒤 다른 모델이 고르기 (실리태번 쪽).
// 답을 받는 순간(MESSAGE_RECEIVED — 다시 쓰기(makeFirst) 뒤 · 번역기 · TTS(CHARACTER_MESSAGE_RENDERED) 전) 대사 문단 앞에 빈 자리를
// await 없이 넣는다. 그 뒤로 글(mes)은 바뀌지 않는다 — 연결한 모델이 고른 이름은 extra.bl_asset_slots 에만 적는다.
// 사용자: 「캐릭터 에셋도 다른 모델이 하게끔 … 비싸서 이렇게라도 돈 아낄 수 있으면」.
import { eventSource, event_types, saveChatConditional, updateMessageBlock } from '../../../../../../../script.js';
import { getContext } from '../../../../../../extensions.js';
import { TITLE, currentFolder, settings } from './state.js';
import { runtime, ensureLoaded } from './store.js';
import { pickActive, pickSettings, generatePick } from './pick.js';
import { slotSpots, insertSlots, slotIds, markedReply, pickPrompt, parsePicks, rulesForPicker, hasAssetTag, skipReplyType, PROTECT_RE, RECORD_KEY, swipeOf, textOf, writeRecords, recordsFromPicks, stripSlotsForPrompt, dropUnknownSlots } from './slots.js';
import { assetInfo, refreshSlots, slotRunning, slotHooks } from './render.js';

const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);

/** 번역기에 자리 모양을 「번역하지 않고 제자리에 한 번만」으로 등록 (6.1.8 번역기의 protect · 없으면 아무 일도 없음). 여러 번 불러도 된다 */
export function protectInTranslator() {
    try { globalThis[Symbol.for('blue-lemonade.translator')]?.protect?.('character-asset-slots', PROTECT_RE, { noFold: true }); } catch { /* 옛 번역기 */ }
}


/** 답을 받는 순간 — 여기까지는 동기. 고르기는 기다리지 않는다 (번역기 · TTS 를 붙잡지 않게) */
export function onMessageReceived(messageId, type) {
    try {
        if (skipReplyType(type) || !pickActive()) return;
        const context = getContext();
        if (context.groupId) return;
        const folder = currentFolder();
        if (!folder) return;
        if (runtime.folder === folder && !runtime.loading && !runtime.keywords) return;   // 이 캐릭터에 켜진 그림이 없다
        const id = Number(messageId);
        const message = context.chat?.[id];
        if (!message || message.is_user || message.is_system || typeof message.mes !== 'string') return;
        const copied = dropUnknownSlots(message.mes, isObj(message.extra) ? message.extra[RECORD_KEY] : null);   // 모델이 앞 답에서 따라 쓴 자리 (기록 없음)
        if (copied.unknown.length) { message.mes = copied.text; if (Array.isArray(message.swipes)) message.swipes[swipeOf(message)] = copied.text; }
        if (slotIds(message.mes).length || hasAssetTag(message.mes)) return;   // 이미 자리나 태그가 있다
        const spots = slotSpots(message.mes, pickSettings().count);
        if (!spots.length) return;
        const swipe = swipeOf(message);
        const { text, ids } = insertSlots(message.mes, spots);
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
async function fill(messageId, message, ids, swipe) {
    const controller = new AbortController();
    const pick = pickSettings();
    const timer = setTimeout(() => controller.abort(), pick.timeoutSec * 1000);
    busy++;
    let records;
    try {
        protectInTranslator();
        const ready = await ensureLoaded();
        if (!ready || !runtime.keywords) throw new Error('그림 목록을 읽지 못했어요');
        if (!stillHere(messageId, message)) return;
        const reply = markedReply(textOf(message, swipe), ids);
        const context = getContext();
        const messages = pickPrompt({
            rules: rulesForPicker(settings().prompt, runtime.folder),
            list: runtime.keywords,
            reply,
            count: ids.length,
            previous: previousText(messageId),
            character: message.name || context.name2 || '',
        });
        const raw = await generatePick(messages, controller.signal);
        records = recordsFromPicks(ids, parsePicks(raw, ids.length), assetInfo);
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

/** 고른 뒤 다시 그리기 — 자리 요소가 화면에 있으면 그 메시지만, 없으면(스트리밍 뒤 · 번역문) 메시지를 다시 그린다 */
function redraw(messageId, message, swipe) {
    if (swipeOf(message) !== swipe) return;   // 다른 스와이프를 보고 있다 — 돌아오면 그때 그려진다
    if (refreshSlots(messageId)) return;
    const mes = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (!mes || mes.querySelector('#curEditTextarea')) return;   // 화면에 없거나 고치는 중 (편집 창을 지우지 않게)
    try { updateMessageBlock(messageId, message); } catch (error) { console.debug(`[${TITLE}] 다시 그리기 실패`, error); }
    refreshSlots(messageId);
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
    const ids = slotIds(message.mes).filter(id => id === slotId || (!map[id]?.name && (map[id]?.error || (map[id]?.pending && !slotRunning.has(id)))));
    if (!ids.length || ids.some(id => slotRunning.has(id))) return;
    writeRecords(message, swipe, Object.fromEntries(ids.map(id => [id, { name: '', pending: true }])));
    for (const id of ids) slotRunning.add(id);
    refreshSlots(messageId);
    void fill(messageId, message, ids, swipe);
}

export const pickBusy = () => busy > 0;

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
}
