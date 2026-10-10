// TTS — 번역을 기다리기 (1.2.0 §12)
// 번역 확장이 답장을 자동 번역하면 화면엔 번역문(mes.extra.display_text)이 뜬다. 자동 읽기는 그 뒤에 시작해야
// 소리가 자막보다 앞서 가지 않는다. 이 모듈은 "번역이 올 것인가"와 "번역이 왔는가"만 판단한다.
//
// 번역 확장 감지 (설정 키는 실제 소스에서 확인한 것):
//   - LLM 번역기 (단독 llm-translator-2.1.6 · 블루 레몬에이드 내장 번역 애드온 — 둘 다 같은 키):
//       extension_settings['llm-translator-custom'].auto_mode ∈ 'none' | 'all' | 'ai' | 'user'
//       답장 번역 = 'all' | 'ai', 내 메시지 번역 = 'all' | 'user'
//       켜져 있음 = 블루 레몬에이드 내장: extension_settings.salty.addons.translator 가 켜짐 + 테마가 설치돼 있고 꺼져 있지 않음
//                   또는 단독 확장: extensionNames 에 third-party/llm-translator(-custom) 이 있고 disabledExtensions 에 없음
//       (설정 키만 남은 경우 — 테마를 지웠거나 단독 확장을 껐을 때 — 는 번역기로 치지 않는다: 매 답장이 90초씩 기다리지 않게)
//   - 실리태번 기본 번역 (모든 ST 에 있음):
//       extension_settings.translate.auto_mode ∈ 'none' | 'responses' | 'inputs' | 'both'
//       답장 번역 = 'responses' | 'both', 내 메시지 번역 = 'inputs' | 'both'
//
// 번역 끝 신호 (실리태번의 updateMessageBlock 은 이벤트를 내지 않는다 — 확인함):
//   - LLM 번역기: eventSource 'EXTENSION_LLM_TRANSLATE_DONE' { messageId }, 'EXTENSION_LLM_TRANSLATE_UI_UPDATED' { messageId: string }
//                document CustomEvent 'llm-translator:ready' { detail: { messageId } }
//   - 편집 저장: event_types.MESSAGE_UPDATED (id)
//   - 어느 쪽이든 마지막 판단은 displayReady(mes): display_text 가 비어 있지 않고, 번역기가 적어 둔 원문 해시
//     (extra.original_text_hash = getStringHash(substituteParams(mes.mes, name1, mes.name)))가 있으면 지금 글과 맞을 때만
//     — 이어쓰기 뒤엔 옛 번역문이 남아 있으니 그것을 "왔다"로 보지 않는다. 기다리는 동안 번역문이 새로 바뀌면 해시와 상관없이 'done'.
//   - DOM 변화 · 500 ms 폴링은 보조
//
// 밖으로:
//   translationExpected(mes, { ignoreSetting }) → boolean   이 메시지에 자동 번역이 올지 (설정 wait_translation 반영 —
//                                                  ignoreSetting 이면 'off' 여도 번역기 설정만 봄: 1.2.2 미리 만들기가 "번역문이 올 것인가"를 물을 때)
//   waitForTranslation(mesId, timeoutMs) → Promise<'done'|'timeout'|'none'>
//                                                  'none' = 기다릴 이유가 없음 (번역기 없음 · 글이 이미 한국어라 번역기가 건너뜀 · 글이 바뀜 · 취소)
//   displayReady(mes) → boolean                  지금 글의 번역문이 붙어 있나 (재생기도 같은 판단을 쓴다)
//   cancelWait(mesId | undefined)                기다림 취소 → 'none' 으로 끝남 (id 없으면 전부)
//   translatorInfo() → { name, key, incoming, outgoing, label }   설정 화면용
//   isWaiting(mesId) → boolean
//   watchDisplay(mesId, mes, { signal, timeoutMs }) → Promise<'done'|'none'|'timeout'>   (1.2.2 미리 만들기)
//                                                  waitForTranslation 과 같은 판단이지만 따로 산다: cancelWait(재생기의 stop) 로 끝나지 않고,
//                                                  signal · 글이 바뀜 · 다른 메시지 객체 · 채팅 바뀜에만 'none'
//
// 시간 초과 때의 한 번짜리 알림("번역을 기다리다 그냥 읽어요")은 재생기(player.js)가 'timeout' 을 받고 띄운다 — 여기선 기록만 남긴다.

import { chat, eventSource, event_types, substituteParams } from '../../../../../../../../script.js';
import { extension_settings, extensionNames, getContext } from '../../../../../../../extensions.js';
import { getStringHash } from '../../../../../../../utils.js';
import { settings } from './settings.js';
import { detectLang } from './text.js';
import { log } from './log.js';

const LLM_KEY = 'llm-translator-custom';
const LLM_INCOMING = new Set(['all', 'ai']);
const LLM_OUTGOING = new Set(['all', 'user']);
const LLM_FOLDER = /llm-translator/i;             // 단독 확장 폴더 (llm-translator-custom · llm-translator)
const BL_FOLDER = /blue-?lemonade|salty/i;         // 블루 레몬에이드 테마 폴더
const ST_KEY = 'translate';
const ST_INCOMING = new Set(['responses', 'both']);
const ST_OUTGOING = new Set(['inputs', 'both']);
const LLM_DONE_EVENTS = ['EXTENSION_LLM_TRANSLATE_DONE', 'EXTENSION_LLM_TRANSLATE_UI_UPDATED'];
const DOM_EVENT = 'llm-translator:ready';
const POLL_MS = 500;
const DEFAULT_TIMEOUT_S = 90;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const disabledList = () => (Array.isArray(extension_settings.disabledExtensions) ? extension_settings.disabledExtensions.map(String) : []);
/** 설치된 확장 이름 목록 ('third-party/…'). 아직 모르면(아주 이른 시점) 빈 배열 */
function installedList() {
    try { return Array.isArray(extensionNames) ? extensionNames.map(String) : []; } catch { return []; }
}

// ---------- 감지

/** LLM 번역기 (블루 레몬에이드 내장 애드온 또는 단독 확장): { name, key, mode, incoming, outgoing, target } 또는 null (없거나 꺼짐) */
function llmTranslator() {
    const s = extension_settings[LLM_KEY];
    if (!isObj(s)) return null;
    const disabled = disabledList();
    const installed = installedList();
    const known = installed.length > 0;
    const builtin = !!extension_settings.salty?.addons?.translator
        && !disabled.some(n => BL_FOLDER.test(n))
        && (!known || installed.some(n => BL_FOLDER.test(n)));
    const standalone = known
        ? installed.some(n => LLM_FOLDER.test(n) && !disabled.includes(n))
        : !disabled.some(n => LLM_FOLDER.test(n));
    if (!builtin && !standalone) return null;
    const mode = String(s.auto_mode || 'none');
    // 둘 다 있으면 단독 확장이 돈다 (블루 레몬에이드 내장 애드온은 단독 확장이 켜져 있으면 비켜 감)
    const name = standalone ? 'LLM 번역기' : '내장 LLM 번역';
    return { name, key: LLM_KEY, mode, incoming: LLM_INCOMING.has(mode), outgoing: LLM_OUTGOING.has(mode), target: 'ko' };
}
function stTranslator() {
    const s = extension_settings[ST_KEY];
    if (!isObj(s)) return null;
    if (disabledList().includes(ST_KEY)) return null;
    const mode = String(s.auto_mode || 'none');
    return { name: '실리태번 번역', key: ST_KEY, mode, incoming: ST_INCOMING.has(mode), outgoing: ST_OUTGOING.has(mode), target: String(s.target_language || '').toLowerCase() };
}
/** 자동 번역이 켜진 번역기 목록 (답장 또는 내 메시지 중 하나라도) */
function activeTranslators() {
    return [llmTranslator(), stTranslator()].filter(t => t && (t.incoming || t.outgoing));
}
/** 이 메시지를 번역할 번역기들 (wait_translation 반영, ignoreSetting 이면 'auto' 처럼). 'on' 은 번역기가 있기만 하면 — 단, 모든 ST 에 들어 있는 기본 번역은 자동 번역이 켜져 있을 때만 */
function translatorsFor(mes, { ignoreSetting = false } = {}) {
    if (!mes || mes.is_system) return [];
    const mode = ignoreSetting ? 'auto' : (settings().wait_translation || 'auto');
    if (mode === 'off') return [];
    const list = [llmTranslator(), stTranslator()].filter(Boolean);
    if (mode === 'on') return list.filter(t => t.key !== ST_KEY || t.mode !== 'none');
    return list.filter(t => (mes.is_user ? t.outgoing : t.incoming));
}

/** 이 메시지에 자동 번역이 올지. wait_translation: 'off' → 안 기다림 · 'on' → 번역기가 있으면 기다림 · 'auto' → 자동 번역 설정을 봄 */
export function translationExpected(mes, opts = {}) {
    return translatorsFor(mes, opts).length > 0;
}

/** 글이 이미 번역기의 목표 언어(한국어)면 번역기가 건너뛰거나 같은 글을 줄 뿐 → 기다리지 않는다 */
function alreadyTarget(mes, list) {
    if (!list.length) return false;
    const text = String(mes?.mes ?? '').replace(/<[^<>]*>/g, ' ').replace(/```[\s\S]*?```/g, ' ');
    const lang = detectLang(text);
    if (!lang) return false;
    return list.every(t => t.target && t.target.slice(0, 2) === lang);
}

/** 설정 화면용 요약 */
export function translatorInfo() {
    const t = activeTranslators()[0] || null;
    if (!t) {
        const any = [llmTranslator(), stTranslator()].filter(Boolean)[0];
        return { name: any ? any.name : '', key: any ? any.key : '', incoming: false, outgoing: false, label: any ? `${any.name} · 자동 번역 꺼짐` : '번역기 없음' };
    }
    const what = t.incoming && t.outgoing ? '답장 · 내 메시지' : t.incoming ? '답장' : '내 메시지';
    return { name: t.name, key: t.key, incoming: t.incoming, outgoing: t.outgoing, label: `${t.name} · ${what} 자동 번역` };
}

// ---------- 번역문이 붙었나

/** 번역기가 해시를 적을 때와 같은 식: getStringHash(substituteParams(mes.mes, name1, mes.name)) */
function originalHash(mes) {
    let ctx = null;
    try { ctx = getContext(); } catch { ctx = null; }
    let t = String(mes?.mes ?? '');
    try { t = substituteParams(t, ctx?.name1, mes?.name); } catch { /* 매크로 치환 실패 → 날글 */ }
    try { return String(getStringHash(t)); } catch { return ''; }
}
/**
 * 지금 글의 번역문이 붙어 있나: display_text 가 비어 있지 않은 문자열이고 (원문과 같아도 됨 — 한국어 답장),
 * 번역기가 원문 해시를 남겼으면 그것이 지금 글과 맞을 때만 (이어쓰기 뒤 남은 옛 번역문은 아직 안 온 것)
 */
export function displayReady(mes) {
    const d = mes?.extra?.display_text;
    if (typeof d !== 'string' || !d.trim()) return false;
    const h = mes.extra.original_text_hash;
    if (h === undefined || h === null || h === '') return true;
    const now = originalHash(mes);
    return !now || String(h) === now;
}

// ---------- 기다리기

const pending = new Map();   // mesId → { resolve, promise, text, display, timer, poll, off: fn[] }
const watchers = new Set();  // 미리 만들기의 기다림 { id, mes, text, display, resolve, timer, poll, off, observer, signal, onAbort }
let wired = false;

const msgOf = (id) => (Number.isInteger(id) && id >= 0 ? chat[id] : undefined);
const displayOf = (mes) => (typeof mes?.extra?.display_text === 'string' ? mes.extra.display_text : '');

function ensureWired() {
    if (wired) return;
    wired = true;
    try {
        if (event_types.CHAT_CHANGED) eventSource.on(event_types.CHAT_CHANGED, () => { cancelWait(); for (const w of [...watchers]) endWatch(w, 'none'); });
        if (event_types.MESSAGE_SWIPED) eventSource.on(event_types.MESSAGE_SWIPED, (id) => { cancelWait(Number(id)); for (const w of [...watchers]) if (w.id === Number(id)) checkWatch(w); });
        if (event_types.MESSAGE_DELETED) eventSource.on(event_types.MESSAGE_DELETED, () => {
            for (const [id, p] of pending) { const m = msgOf(id); if (!m || m.mes !== p.text) finish(id, 'none'); }
            for (const w of [...watchers]) checkWatch(w);
        });
    } catch { /* 이벤트가 없으면 호출자가 cancelWait 로 끊는다 */ }
}

function finish(id, result) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    clearInterval(p.poll);
    for (const off of p.off) { try { off(); } catch { /* 이미 떼어짐 */ } }
    if (p.observer) { try { p.observer.disconnect(); } catch { /* 없음 */ } }
    p.resolve(result);
}

/** 번역이 붙었는지 확인 → 붙었으면 'done', 글이 바뀌었으면 'none' */
function check(id) {
    const p = pending.get(id);
    if (!p) return;
    const mes = msgOf(id);
    if (!mes || mes.mes !== p.text) { finish(id, 'none'); return; }
    if (displayReady(mes)) { finish(id, 'done'); return; }
    // 해시 식이 번역기와 어긋나더라도(매크로 등) 기다리는 동안 번역문이 새로 붙었으면 온 것으로 본다
    const d = displayOf(mes);
    if (d.trim() && d !== p.display) finish(id, 'done');
}

const sameId = (a, b) => String(a) === String(b);

/** 이벤트 구독 (있을 때만) → 해제 함수 목록. fire = 확인할 때 부를 것 (기본: 재생기의 기다림 check) */
function subscribe(id, p, fire = () => check(id)) {
    const on = (name, fn) => {
        if (!name || !eventSource || typeof eventSource.on !== 'function') return;
        eventSource.on(name, fn);
        p.off.push(() => { if (typeof eventSource.removeListener === 'function') eventSource.removeListener(name, fn); });
    };
    const evId = (arg) => (isObj(arg) ? arg.messageId : arg);
    const onId = (arg) => { if (sameId(evId(arg), id)) fire(); };
    on(event_types.MESSAGE_UPDATED, onId);
    for (const name of LLM_DONE_EVENTS) on(name, onId);
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        const fn = (e) => { if (sameId(e?.detail?.messageId, id)) fire(); };
        document.addEventListener(DOM_EVENT, fn);
        p.off.push(() => document.removeEventListener(DOM_EVENT, fn));
        // 보조: 메시지 DOM 이 다시 그려지면 확인 (updateMessageBlock 은 이벤트가 없다)
        try {
            const el = typeof document.querySelector === 'function' ? document.querySelector(`#chat .mes[mesid="${id}"] .mes_text`) : null;
            if (el && typeof MutationObserver === 'function') {
                p.observer = new MutationObserver(() => fire());
                p.observer.observe(el, { childList: true, subtree: true, characterData: true });
            }
        } catch { /* DOM 없음 */ }
    }
}

/**
 * 메시지의 번역이 붙을 때까지 기다림.
 * 'done' = 지금 글의 번역문이 붙음 · 'none' = 기다릴 이유가 없음(번역기 없음 · 이미 한국어 · 글이 바뀜 · 취소) · 'timeout' = 시간 초과 (그냥 읽으면 된다)
 */
export function waitForTranslation(mesId, timeoutMs) {
    const id = Number(mesId);
    const mes = msgOf(id);
    if (!mes) return Promise.resolve('none');
    if (displayReady(mes)) return Promise.resolve('done');
    const list = translatorsFor(mes);
    if (!list.length) return Promise.resolve('none');
    const text = String(mes.mes || '');
    if (!text.trim() || text === '...') return Promise.resolve('none');
    if (alreadyTarget(mes, list)) return Promise.resolve('none');
    const had = pending.get(id);
    if (had && had.text === text) return had.promise;
    if (had) finish(id, 'none');
    ensureWired();
    const ms = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : (Number(settings().translation_timeout) || DEFAULT_TIMEOUT_S) * 1000;
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    const p = { resolve, promise, text, display: displayOf(mes), timer: 0, poll: 0, off: [], observer: null };
    pending.set(id, p);
    subscribe(id, p);
    p.poll = setInterval(() => check(id), POLL_MS);
    p.timer = setTimeout(() => {
        if (!pending.has(id)) return;
        log('info', `번역 기다리기 시간 초과 #${id}`);
        finish(id, 'timeout');   // 알림은 재생기가 (한 번만)
    }, ms);
    return promise;
}

/** 기다림 취소 (id 없으면 전부) → 그 약속은 'none' 으로 끝난다 */
export function cancelWait(mesId) {
    if (mesId === undefined || mesId === null) { for (const id of [...pending.keys()]) finish(id, 'none'); return; }
    finish(Number(mesId), 'none');
}

/** 이 메시지의 번역을 기다리는 중인지 */
export function isWaiting(mesId) { return pending.has(Number(mesId)); }

// ---------- 미리 만들기의 기다림 (1.2.2) — 재생기의 기다림(pending)과 따로: cancelWait 가 끊지 않는다

function endWatch(w, result) {
    if (!watchers.has(w)) return;
    watchers.delete(w);
    clearTimeout(w.timer);
    clearInterval(w.poll);
    for (const off of w.off) { try { off(); } catch { /* 이미 떼어짐 */ } }
    if (w.observer) { try { w.observer.disconnect(); } catch { /* 없음 */ } }
    if (w.signal && w.onAbort) w.signal.removeEventListener('abort', w.onAbort);
    w.resolve(result);
}
function checkWatch(w) {
    const mes = msgOf(w.id);
    if (!mes || mes !== w.mes || mes.mes !== w.text) { endWatch(w, 'none'); return; }
    if (displayReady(mes)) { endWatch(w, 'done'); return; }
    const d = displayOf(mes);
    if (d.trim() && d !== w.display) endWatch(w, 'done');
}
/**
 * 번역문이 붙을 때까지 (미리 만들기용). 번역기가 없거나(wait_translation 설정과 상관없이) 이미 한국어면 'none',
 * 붙었으면 'done', timeoutMs 가 지나면 'timeout'. signal · 글이 바뀜 · 메시지 객체가 바뀜 · 채팅 바뀜 → 'none'
 */
export function watchDisplay(mesId, mes, { signal, timeoutMs } = {}) {
    const id = Number(mesId);
    if (!mes || msgOf(id) !== mes) return Promise.resolve('none');
    if (displayReady(mes)) return Promise.resolve('done');
    const list = translatorsFor(mes, { ignoreSetting: true });
    if (!list.length) return Promise.resolve('none');
    const text = String(mes.mes || '');
    if (!text.trim() || text === '...') return Promise.resolve('none');
    if (alreadyTarget(mes, list)) return Promise.resolve('none');
    if (signal?.aborted) return Promise.resolve('none');
    ensureWired();
    const ms = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : (Number(settings().translation_timeout) || DEFAULT_TIMEOUT_S) * 1000;
    return new Promise((resolve) => {
        const w = { id, mes, text, display: displayOf(mes), resolve, timer: 0, poll: 0, off: [], observer: null, signal: signal || null, onAbort: null };
        watchers.add(w);
        subscribe(id, w, () => checkWatch(w));
        w.poll = setInterval(() => checkWatch(w), POLL_MS);
        w.timer = setTimeout(() => endWatch(w, 'timeout'), ms);
        if (signal) { w.onAbort = () => endWatch(w, 'none'); signal.addEventListener('abort', w.onAbort, { once: true }); }
    });
}
