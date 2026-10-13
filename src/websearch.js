// 6.2.6 웹 검색을 쓴 답 표시 + 낱말 꾹 눌러 출처 찾기 — 화면 · 이벤트 연결 (순수 함수는 websearch-core.js).
// 채팅 › 화면 「웹 검색 · 출처 표시」(chat.webSearchMarks, 기본 켬). 테마가 꺼져 있으면(usage-mode) 아무것도 하지 않는다.
//
// 지구 표시: 성능 보조 요청 로그(src/addons/perf/capture.js)가 응답에서 웹 검색 흔적을 보면 noteWebSearchEvidence() 로 알린다 →
//   그 생성의 답(MESSAGE_RECEIVED 로 받은 메시지)의 mes.extra.bl_websearch = true (스와이프 정보의 extra 에도) → 이름 옆 지구 아이콘 하나.
//   흔적이 메시지보다 늦게 와도(비스트리밍은 복사본 읽기가 한 박자 늦을 수 있다) 이번 생성에서 방금 받은 메시지(10초 안)에 붙이고 저장한다.
//   플래그는 채팅 파일에 남으니(작다) 불러온 채팅도 지구가 보인다. 요청 로그가 꺼져 있으면(성능 보조 › 요청 로그 끔) 흔적이 안 온다.
// 출처: CHAT_COMPLETION_PROMPT_READY 의 보낸 메시지와 그때의 후보(카드 · 활성 로어북 · 확장 주입 · 지시 · 페르소나 · 프리셋)를
//   답 메시지 번호에 붙여 둔다(기억에만 — 채팅 파일에는 안 쓴다, 크다; 채팅을 바꾸거나 다시 불러오거나 메시지를 지우면 모두 버린다).
//   블록 나누기(buildOrigin)는 처음 꾹 누를 때 한다(보내는 길을 늦추지 않게).
// 꾹 누르기: 답 글(.mes_text)의 낱말을 0.5초 누르면(폰은 길게 누르기 신호 contextmenu 가 먼저 오면 그것으로) 한 줄 칩. 누르기 · 움직이기 · contextmenu 에 preventDefault 없음
//   (6.1.9 교훈: touchend 를 막으면 폰의 톡이 죽는다 · 길게 누르기 메뉴를 막으면 폰의 낱말 고르기가 죽어 글 고르기로 도는 기능들이 멈춘다) —
//   칩을 띄운 누르기의 끝에 오는 click 하나만 먹는다(캐릭터 에셋 hold.js 와 같은 규칙). 폰에선 브라우저의 낱말 선택과 칩이 같이 뜨고(칩은 손가락 아래), 다시 누르면(어디든 pointerdown) 닫힌다.
//   토스트 없음. 내 메시지 · 스트리밍 중인 답 · 누르기 전부터 글을 고르던 중에는 뜨지 않는다.
import { WEBSEARCH_KEY, marksEnabled, buildOrigin, makeChatIndex, wordAt, findOrigins, chipText, labelExtensionPrompt, enabledPromptIds, textOf, originSize, trimOrigins, searchKeys, normalizeText } from './websearch-core.js';
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';

const HOLD_MS = 500;            // 캐릭터 에셋 · 실리태번 기본 길게 누르기와 같은 길이
const SLOP = 8;                 // 이만큼(px) 움직이면 스크롤 · 글 고르기로 본다
const CLICK_AFTER_UP = 400;     // 손을 뗀 뒤 이 안에 오는 click 은 꾹 누르기의 끝이다
const PENDING_MS = 10 * 60 * 1000;   // 프롬프트 → 답 사이 최대 (긴 생성)
const LATE_MS = 10000;          // 흔적이 답보다 늦게 올 때 붙여 주는 창 (방금 받은 답은 생성이 시작될 때마다 지우므로 이번 생성의 답뿐이다)
const GLOBE_CLASS = 'bl-websearch';
const CHIP_CLASS = 'bl-origin-chip';
const CARD_FIELDS = [['description', '설명'], ['personality', '성격'], ['scenario', '시나리오'], ['mes_example', '예시 대화']];

const origins = new Map();      // `${chatId}\u0000${mesId}` → { sent, sources, size, blocks }
let pendingOrigin = null;       // { sent, sources, at } — 프롬프트는 보냈고 답은 아직
let pendingEvidence = null;     // { kind, at } — 흔적은 봤고 답 메시지는 아직
let lastReceived = null;        // { id, at } — 방금 받은 답 (흔적이 늦게 올 때)
let generationType = null;
let lastWorldInfo = [];
let started = false;

const ctx = () => globalThis.SillyTavern?.getContext?.();
const enabled = () => { const s = getSettings(); return themeEnabled(s) && marksEnabled(s); };
const chatKey = (c, id) => `${c?.getCurrentChatId?.() ?? ''}\u0000${id}`;
const isObj = v => !!v && typeof v === 'object';

// ── 후보 모으기 (프롬프트를 보낼 때) ──────────────────────────────

function currentCharacters(c) {
    const chars = Array.isArray(c.characters) ? c.characters : [];
    if (c.groupId) {
        const group = (Array.isArray(c.groups) ? c.groups : []).find(g => String(g?.id) === String(c.groupId));
        const members = Array.isArray(group?.members) ? group.members : [];
        return members.map(avatar => chars.find(ch => ch?.avatar === avatar)).filter(Boolean);
    }
    const one = chars[Number(c.characterId)];
    return one ? [one] : [];
}

function worldInfoName(entry) {
    return String(entry?.comment || (Array.isArray(entry?.key) ? entry.key[0] : '') || (entry?.uid != null ? `#${entry.uid}` : '') || '').trim();
}

function collectSources(c) {
    const out = [];
    const push = (kind, name, text) => { if (typeof text === 'string' && text.trim()) out.push({ kind, name, text }); };
    const sub = text => { const raw = String(text ?? ''); try { return c.substituteParams?.(raw) ?? raw; } catch { return raw; } };
    const chars = currentCharacters(c);
    for (const ch of chars) {
        const who = chars.length > 1 && ch.name ? `${ch.name} ` : '';
        for (const [field, label] of CARD_FIELDS) push('카드', who + label, sub(ch?.[field]));
    }
    push('페르소나', '', sub(c.powerUserSettings?.persona_description));
    for (const entry of lastWorldInfo) push('로어북', worldInfoName(entry), sub(entry?.content));
    for (const [key, prompt] of Object.entries(isObj(c.extensionPrompts) ? c.extensionPrompts : {})) {
        const label = labelExtensionPrompt(key);
        if (label) push(label.kind, label.name, sub(prompt?.value));
    }
    const direction = c.extensionSettings?.jeongaejisi;   // 테마 애드온 전개 지시 (설정 키는 바꾸지 않는다)
    if (isObj(direction)) {
        if (direction.always?.enabled) push('지시', '항상', sub(direction.always.content));
        if (direction.direction?.enabled && typeof direction.direction.content === 'string') {
            // 실제로 넣는 글은 틀({{direction}} 자리)에 채운 것 — 그 전체가 블록이 되게. 틀에 자리가 없으면 적은 글만
            const template = typeof direction.directionPrompt === 'string' ? direction.directionPrompt : '';
            const filled = /\{\{direction\}\}/i.test(template) ? template.replace(/\{\{direction\}\}/gi, () => direction.direction.content) : direction.direction.content;
            push('지시', '전개', sub(filled));
        }
    }
    const oai = c.chatCompletionSettings;
    const ids = enabledPromptIds(oai?.prompt_order, c.characterId);
    for (const p of Array.isArray(oai?.prompts) ? oai.prompts : []) {
        if (!isObj(p) || p.marker || (ids && !ids.has(String(p.identifier)))) continue;
        push('프리셋', String(p.name || p.identifier || ''), sub(p.content));
    }
    return out;
}

// ── 생성 흐름 ────────────────────────────────────────────────

function onGenerationStarted(type, _params, dryRun) {
    if (dryRun) return;
    generationType = typeof type === 'string' ? type : 'normal';
    pendingOrigin = null;
    pendingEvidence = null;
    lastReceived = null;   // 앞 생성의 답(새 채팅의 첫 인사 포함)에 이번 흔적이 붙지 않게
    lastWorldInfo = [];
}

function onGenerationDone() {
    generationType = null;
}

function onWorldInfo(entries) {
    lastWorldInfo = Array.isArray(entries) ? entries : [];
}

function onPromptReady(data) {
    if (!data || data.dryRun || !Array.isArray(data.chat) || !enabled()) return;
    if (generationType === 'quiet' || generationType === 'impersonate') return;   // 답 메시지가 생기지 않는다
    const c = ctx();
    if (!c) return;
    const sent = data.chat.map(m => ({ role: m?.role, name: m?.name, text: textOf(m?.content) })).filter(m => m.text);
    pendingOrigin = { sent, sources: collectSources(c), at: performance.now() };
}

function onMessageReceived(id, type) {
    if (type === 'first_message') return;   // 새 채팅의 첫 인사 — 생성이 아니다
    const c = ctx();
    const mes = c?.chat?.[id];
    if (!mes || mes.is_user) return;
    const now = performance.now();
    lastReceived = { id, at: now };
    if (pendingOrigin && now - pendingOrigin.at < PENDING_MS) {
        const record = { sent: pendingOrigin.sent, sources: pendingOrigin.sources, blocks: null, size: 0 };
        record.size = originSize(record);
        const key = chatKey(c, id);
        origins.delete(key);
        origins.set(key, record);
        trimOrigins(origins);
    }
    pendingOrigin = null;
    if (pendingEvidence && now - pendingEvidence.at < PENDING_MS) {
        pendingEvidence = null;
        flag(c, id, false);   // 실리태번이 이 이벤트 뒤에 채팅을 저장한다
    }
}

/** 성능 보조 요청 로그가 부른다 — 채팅 생성 응답(caller 'chat')에서 웹 검색 흔적을 봤을 때. info.type = normal · swipe · continue · regenerate … */
export function noteWebSearchEvidence(kind, info = {}) {
    if (!kind || !enabled()) return;
    if (info.type === 'quiet' || info.type === 'impersonate') return;
    const now = performance.now();
    if (lastReceived && now - lastReceived.at < LATE_MS) {
        const c = ctx();
        if (c?.chat?.[lastReceived.id] && !c.chat[lastReceived.id].is_user) { flag(c, lastReceived.id, true); return; }
    }
    pendingEvidence = { kind, at: now };
}

/** 답 메시지에 플래그 — 스와이프 정보의 extra 에도 (스트리밍은 MESSAGE_RECEIVED 전에 이미 복사돼 있다). save: 늦게 붙였으면 저장까지 */
function flag(c, id, save) {
    const mes = c.chat[id];
    if (!isObj(mes)) return;
    if (!isObj(mes.extra)) mes.extra = {};
    if (mes.extra[WEBSEARCH_KEY] !== true) {
        mes.extra[WEBSEARCH_KEY] = true;
        const swipe = Array.isArray(mes.swipe_info) ? mes.swipe_info[Number(mes.swipe_id) || 0] : null;
        if (isObj(swipe)) {
            if (!isObj(swipe.extra)) swipe.extra = {};
            if (swipe.extra !== mes.extra) swipe.extra[WEBSEARCH_KEY] = true;
        }
        if (save) Promise.resolve().then(() => c.saveChat?.()).catch(error => console.warn('[Blue Lemonade] 웹 검색 표시 저장', error));
    }
    decorate(id);
}

// ── 지구 표시 ────────────────────────────────────────────────

function mesElement(id) {
    return document.querySelector(`#chat .mes[mesid="${CSS.escape(String(id))}"]`);
}

function decorate(id, el = mesElement(id)) {
    if (!el) return;
    const on = ctx()?.chat?.[id]?.extra?.[WEBSEARCH_KEY] === true;
    const have = el.querySelector(`.ch_name .${GLOBE_CLASS}`);
    if (!on) { have?.remove(); return; }
    if (have) return;
    const name = el.querySelector('.ch_name .name_text');
    if (!name) return;
    const globe = document.createElement('span');
    globe.className = GLOBE_CLASS;
    globe.setAttribute('aria-label', '웹 검색 사용');
    globe.innerHTML = '<i class="fa-solid fa-globe" aria-hidden="true"></i>';
    name.after(globe);
}

function decorateAll() {
    const chat = ctx()?.chat;
    if (!Array.isArray(chat)) return;
    for (const el of document.querySelectorAll('#chat .mes[mesid]')) {
        const id = Number(el.getAttribute('mesid'));
        if (chat[id]?.extra?.[WEBSEARCH_KEY] === true) decorate(id, el);
        else el.querySelector(`.ch_name .${GLOBE_CLASS}`)?.remove();
    }
}

// ── 출처 칩 ──────────────────────────────────────────────────

let chip = null;

export function hideChip() {
    chip?.remove();
    chip = null;
}

function showChip(text, x, y, below = false) {
    hideChip();
    chip = document.createElement('div');
    chip.className = CHIP_CLASS;
    chip.setAttribute('role', 'status');
    chip.textContent = text;
    chip.style.left = '0px';
    chip.style.top = '0px';
    chip.style.visibility = 'hidden';
    document.body.append(chip);
    const w = chip.offsetWidth, h = chip.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const left = Math.round(Math.min(Math.max(8 + w / 2, x), Math.max(8 + w / 2, vw - 8 - w / 2)));
    // 마우스는 포인터 위, 터치는 손가락 아래 — 폰의 길게 누르기는 낱말도 고르고 그 위에 선택 막대를 띄우므로 겹치지 않게 (고정 위치는 top 기준 — 실리태번 html 의 translateZ 때문에 bottom 은 못 믿는다)
    let top = below ? Math.round(y + 28) : Math.round(y - h - 14);
    if (below && top + h > vh - 4) top = Math.round(y - h - 14);
    if (top < 4) top = Math.round(Math.min(y + 24, Math.max(4, vh - h - 4)));
    chip.style.left = `${left}px`;
    chip.style.top = `${top}px`;
    chip.style.visibility = '';
}

function originBlocks(c, id) {
    const record = origins.get(chatKey(c, id));
    if (!record) return null;
    record.blocks ??= buildOrigin(record.sent, record.sources, makeChatIndex(c.chat));
    return record.blocks;
}

// 누른 자리 → 글자 노드 + 자리 (TTS clickplay 와 같은 길)
function caretAt(x, y) {
    try {
        if (typeof document.caretPositionFromPoint === 'function') {
            const p = document.caretPositionFromPoint(x, y);
            if (p && p.offsetNode) return { node: p.offsetNode, offset: Number(p.offset) || 0 };
        }
        if (typeof document.caretRangeFromPoint === 'function') {
            const r = document.caretRangeFromPoint(x, y);
            if (r && r.startContainer) return { node: r.startContainer, offset: Number(r.startOffset) || 0 };
        }
    } catch { /* 지원하지 않는 환경 */ }
    return null;
}

function toTextNode(node, offset) {
    if (node.nodeType === 3) return { node, offset };
    const kids = node.childNodes || [];
    const after = kids[offset], before = kids[offset - 1];
    if (after && after.nodeType === 3) return { node: after, offset: 0 };
    if (before && before.nodeType === 3) return { node: before, offset: String(before.nodeValue || '').length };
    return null;
}

function wordAtPoint(x, y, within) {
    const caret = caretAt(x, y);
    if (!caret) return null;
    const pos = toTextNode(caret.node, caret.offset);
    if (!pos || !within.contains(pos.node)) return null;
    return wordAt(pos.node.nodeValue, pos.offset)?.word ?? null;
}

/** 칩에 적을 한 줄 (낱말이 없으면 null) */
function lookup(id, x, y, text) {
    const c = ctx();
    const mes = c?.chat?.[id];
    if (!mes) return null;
    const word = wordAtPoint(x, y, text);
    if (!word || !searchKeys(word).length) return null;   // 1자 낱말 · 숫자 한 자리: 찾을 열쇠가 없다 → 칩 없음 (「지어냄」이라 하면 거짓)
    const blocks = originBlocks(c, id);
    const labels = blocks ? findOrigins(blocks, word) : [];
    // F3. 번역문(LLM 번역 display_text)이 보이는 답: 한국어 번역 낱말은 원문 프롬프트와 말이 달라 못 찾을 수 있다 → 「지어냄」 대신 「번역문 · 못 찾음」
    return chipText(labels, { searched: mes.extra?.[WEBSEARCH_KEY] === true, hasRecord: !!blocks, translated: showingTranslation(mes, text) });
}

/** .mes_text 가 번역문(extra.display_text)을 보여 주고 있나 — 앞 40자 서명으로 (번역 확장이 원문 보기로 바꿔 두면 원문) */
function showingTranslation(mes, text) {
    const shown = typeof mes?.extra?.display_text === 'string' ? mes.extra.display_text : '';
    if (!shown.trim()) return false;
    const sig = normalizeText(shown).slice(0, 40);
    return !!sig && normalizeText(text?.textContent).includes(sig);
}

// ── 꾹 누르기 ────────────────────────────────────────────────

let press = null;    // { id, x, y, mesId, text, top, timer }
let held = null;     // { id, up, menu } — 칩을 띄운 누르기 (끝에 오는 click · 메뉴를 한 번 먹는다)
let lastType = '';
let downId = null;

function textTarget(target) {
    if (!(target instanceof Element)) return null;
    if (target.closest('a, button, input, textarea, select, img, video, audio, canvas, svg, [contenteditable], .mes_buttons, .eh-root')) return null;
    const text = target.closest('.mes_text');
    if (!text) return null;
    const mes = text.closest('#chat .mes[mesid]');
    if (!mes || mes.getAttribute('is_user') === 'true') return null;
    return { text, mes, id: Number(mes.getAttribute('mesid')) };
}

function streaming(id) {
    const p = ctx()?.streamingProcessor;
    return !!p && !p.isFinished && !p.isStopped && String(p.messageId) === String(id);
}

function selecting() {
    const selection = window.getSelection?.();
    return !!selection && !selection.isCollapsed;
}

function vibrate() {
    if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12);
}

function onMove(event) {
    if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) cancel();
}

function onScroll() {
    if (!press) return;
    const rect = press.text.getBoundingClientRect();
    if (Math.abs(rect.top - press.top) > SLOP) cancel();
}

const WATCH = [['pointermove', onMove], ['scroll', onScroll]];

function cancel() {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
    for (const [type, handler] of WATCH) window.removeEventListener(type, handler, true);
    document.removeEventListener('visibilitychange', cancel);
}

function open(p) {
    if (p.hadSelection && selecting()) return;   // 누르기 전부터 고르던 글이 아직 있으면(선택을 다듬는 중) 칩 없음 — 길게 누르기가 방금 고른 낱말은 막지 않는다
    const label = lookup(p.mesId, p.x, p.y, p.text);
    if (!label) return;
    vibrate();
    showChip(label, p.x, p.y, p.touch);
}

function fire() {
    const p = press;
    cancel();
    if (!p) return;
    held = { id: p.id, up: 0 };
    open(p);
}

function onDown(event) {
    lastType = event.pointerType;
    if (event.isPrimary) downId = event.pointerId;
    if (held && (held.up || event.isPrimary)) held = null;
    if (chip) hideChip();   // 다시 누르면 닫힘
    if (press) { cancel(); return; }   // 둘째 손가락 — 확대나 두 손가락 스크롤
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!enabled()) return;
    const t = textTarget(event.target);
    if (!t || streaming(t.id)) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, mesId: t.id, text: t.text, top: t.text.getBoundingClientRect().top, touch: event.pointerType !== 'mouse', hadSelection: selecting(), timer: setTimeout(fire, HOLD_MS) };
    for (const [type, handler] of WATCH) window.addEventListener(type, handler, { capture: true, passive: true });
    document.addEventListener('visibilitychange', cancel);
}

function onUp(event) {
    if (event.pointerId === downId) downId = null;
    if (press && event.pointerId === press.id) cancel();
    if (held && !held.up && event.pointerId === held.id) held.up = Date.now();
}

function holding() {
    if (held?.up && Date.now() - held.up > CLICK_AFTER_UP) held = null;
    return !!held;
}

/** 칩을 띄운 누르기의 끝에 오는 click 하나 — 톡 읽기(TTS) · 다른 확장으로 새지 않게 */
function onClick(event) {
    if (!event.isTrusted || !holding()) return;
    held = null;
    event.preventDefault();
    event.stopImmediatePropagation();
}

/** 폰은 길게 누르면 낱말을 고르고 선택 막대를 띄우려고 contextmenu 를 보낸다 — 대개 0.5초 타이머보다 먼저. 그 신호로 바로 띄우되 **막지 않는다**:
 *  막으면(preventDefault) 브라우저의 낱말 고르기가 사라져 글 고르기로 도는 기능(다시 쓰기 단어 밴 · 북마크 글 고르기 · 번역 용어집)이 AI 답 안에서 죽는다.
 *  선택과 칩은 같이 뜬다(칩은 손가락 아래). PC 오른쪽 클릭은 브라우저 메뉴 그대로 */
function onContextMenu(event) {
    if (!press || (event.pointerType || lastType) === 'mouse') return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) { cancel(); return; }
    const p = press;
    cancel();
    held = { id: p.id, up: 0, menu: true };
    open(p);
}

function onDragStart() {
    if (press) cancel();
}

// ── 시작 ────────────────────────────────────────────────────

export function startWebSearchMarks() {
    if (started) return;
    started = true;
    const c = ctx();
    const es = c?.eventSource, et = c?.eventTypes ?? c?.event_types;
    if (es && et) {
        es.on(et.GENERATION_STARTED, onGenerationStarted);
        es.on(et.GENERATION_ENDED, onGenerationDone);
        es.on(et.GENERATION_STOPPED, onGenerationDone);
        if (et.WORLD_INFO_ACTIVATED) es.on(et.WORLD_INFO_ACTIVATED, onWorldInfo);
        if (et.CHAT_COMPLETION_PROMPT_READY) es.on(et.CHAT_COMPLETION_PROMPT_READY, onPromptReady);
        es.on(et.MESSAGE_RECEIVED, onMessageReceived);
        for (const name of ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED']) {
            if (et[name]) es.on(et[name], id => decorate(Number(id)));
        }
        // 채팅을 바꾸거나 다시 불러오면(같은 채팅도) 출처 기록을 모두 버린다 — 「불러온 채팅 = 기록 없음」. 메시지를 지우면 번호가 밀리니 그때도
        es.on(et.CHAT_CHANGED, () => { hideChip(); origins.clear(); decorateAll(); });
        if (et.MESSAGE_DELETED) es.on(et.MESSAGE_DELETED, () => { hideChip(); origins.clear(); });
        if (et.MORE_MESSAGES_LOADED) es.on(et.MORE_MESSAGES_LOADED, decorateAll);
    }
    const passive = { capture: true, passive: true };
    window.addEventListener('pointerdown', onDown, passive);
    window.addEventListener('pointerup', onUp, passive);
    window.addEventListener('pointercancel', onUp, passive);
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('resize', hideChip);
    document.getElementById('chat')?.addEventListener('scroll', hideChip, { passive: true });
    decorateAll();
}

/** 시험용 — 기억에 둔 출처 기록 수 */
export function originCount() {
    return origins.size;
}
