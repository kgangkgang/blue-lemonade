// 정규식 화면에서 직접 바꾼 정규식 (1.0.1) — 사용자가 실리태번 「정규식」 창에서 켜고 끈(하나씩 · 일괄 · 정규식 프리셋 · 편집 창) 정규식 id 를 적어 두고,
// 테마의 자동 맞춤(프롬프트 귀속 · 캐릭터 이름 연동 promptbind.js · 프롬프트 연동 정규식 addons/regexlink)이 그 정규식을 다시 덮지 않게 한다.
// 11-03 제보: 정규식 창의 끄기 단추를 눌러도 다시 켜졌다 — 실리태번이 저장 뒤 채팅을 다시 그려(reloadCurrentChat → CHAT_CHANGED) 프롬프트 귀속의 맞추기가 0.2초 뒤 되돌렸다.
//   프롬프트 연동 정규식은 1.1.2 에서 제 몫(모듈 태그 정규식)을 고쳤지만, 귀속에 붙인 정규식 · 이름 연동의 말이 든 정규식은 promptbind.js 가 맡아 그대로 되돌렸다.
// 기록 자리는 프롬프트 연동 정규식과 같은 extension_settings.regex_link.manual (정규식 id → true · 실리태번 설정에 저장) — 한 정규식을 두 모듈이 다르게 보지 않게 한 곳에 둔다.
//   지우는 길: 프롬프트 연동 정규식 패널의 「자동으로」(모듈 정규식) · 캐릭터 이름 연동의 「자동으로」(말이 든 정규식) · 프롬프트 편집 창에서 정규식을 다시 붙이기(귀속 정규식).
// 누르기는 캡처 단계로 받아 실리태번이 값을 바꾸기 전에 적는다 — 귀속 맞추기(CHAT_CHANGED · 0.2초)보다 먼저여야 한다.
// 단추가 분명하지 않은 길(정규식 프리셋 고르기 · 편집 창 저장 · 슬래시 명령은 빼고)은 누른 순간의 사진과 잠시 뒤 값을 견줘 달라진 id 를 적는다.
const SCREEN = '#regex_container, .regex_settings';
const TOGGLE = '.regex-toggle-on, .regex-toggle-off, input.disable_regex';
const BULK = '#bulk_enable_regex, #bulk_disable_regex';
const EDITOR = '#regex_editor_template, .regex_editor';
const SETTLE_MS = [0, 60, 400, 1500];   // 실리태번이 값을 바꾸는 때: 줄 스위치 · 일괄은 바로, 정규식 프리셋은 목록마다 저장을 기다린 뒤, 편집 창은 창이 닫힌 뒤
const EVENTS = ['click', 'input', 'change'];

let watching = null;   // { doc, lists, timers: Set }

function ext() { try { return SillyTavern.getContext().extensionSettings; } catch { return null; } }
function save() { try { SillyTavern.getContext().saveSettingsDebounced?.(); } catch { /* 저장 없음 */ } }

/** 직접 바꾼 정규식 기록 { id: true } — 프롬프트 연동 정규식(regexlink store().manual)과 같은 객체 */
export function manualStore() {
    const es = ext();
    if (!es) return {};
    const s = es.regex_link ??= {};
    if (!s.manual || typeof s.manual !== 'object' || Array.isArray(s.manual)) s.manual = {};
    return s.manual;
}
export function isManual(id) { return !!id && manualStore()[id] === true; }
export function manualIds() { return Object.keys(manualStore()); }
/** 적는다 → 새로 적은 개수 */
export function markManual(ids) {
    const m = manualStore();
    let n = 0;
    for (const id of ids || []) if (id && typeof id === 'string' && m[id] !== true) { m[id] = true; n++; }
    if (n) save();
    return n;
}
/** 지운다(다시 자동) → 지운 개수 */
export function forgetManual(ids) {
    const m = manualStore();
    let n = 0;
    for (const id of ids || []) if (id && id in m) { delete m[id]; n++; }
    if (n) save();
    return n;
}

function snapshot(lists) {
    const before = new Map();
    try { for (const list of lists() || []) for (const s of list || []) if (s?.id) before.set(s.id, !!s.disabled); } catch { /* 목록 없음 */ }
    return before;
}
function changedSince(before, lists) {
    const out = [];
    try { for (const list of lists() || []) for (const s of list || []) if (s?.id && before.has(s.id) && before.get(s.id) !== !!s.disabled) out.push(s.id); } catch { /* 목록 없음 */ }
    return out;
}
/** 누른 뒤 잠시 뒤마다 사진과 견줘 달라진 것을 적는다 (테마가 먼저 되돌리기 전인 0 · 60ms 에도 본다) */
function settle(before) {
    const w = watching;
    if (!w) return;
    for (const ms of SETTLE_MS) {
        const t = setTimeout(() => { w.timers.delete(t); if (watching === w) markManual(changedSince(before, w.lists)); }, ms);
        w.timers.add(t);
    }
}

function onScreen(event) {
    const w = watching;
    const target = event?.target;
    if (!w || !target?.closest) return;
    const inScreen = target.closest(SCREEN);
    if (!inScreen) {
        // 편집 창(callGenericPopup)의 확인 단추 — 창 안에 「끄기」 칸이 있어 저장하면 목록의 항목이 새 객체로 바뀐다
        const popup = target.closest('dialog, .popup');
        if (!popup?.querySelector?.(EDITOR) || !target.closest('.popup-button-ok, .menu_button')) return;
        settle(snapshot(w.lists));
        return;
    }
    const before = snapshot(w.lists);
    if (event.type === 'click') {
        // 줄 스위치 · 일괄 켜기/끄기는 누른 정규식이 분명하다 — 값이 이미 같았어도(우리가 꺼 둔 것을 「끄기」) 사용자 뜻으로 적는다
        const toggle = target.closest(TOGGLE);
        if (toggle) { const id = toggle.closest('.regex-script-label')?.id; if (id) markManual([id]); settle(before); return; }
        if (target.closest(BULK)) {
            const ids = [];
            try { for (const row of inScreen.querySelectorAll?.('.regex-script-label') || []) if (row.id && row.querySelector?.('.regex_bulk_checkbox')?.checked) ids.push(row.id); } catch { /* 줄 없음 */ }
            markManual(ids);
        }
    }
    settle(before);
}

/** 정규식 화면 감시 시작 (한 번만). lists: 지금 쓰는 정규식 목록들을 돌려주는 함수 — 전역 · 이 캐릭터 · 프리셋 (promptbind.js 가 넘긴다) */
export function watchRegexScreen(doc, lists) {
    if (watching || !doc?.addEventListener || typeof lists !== 'function') return false;
    watching = { doc, lists, timers: new Set() };
    for (const type of EVENTS) doc.addEventListener(type, onScreen, true);
    return true;
}
export function unwatchRegexScreen() {
    const w = watching;
    if (!w) return;
    watching = null;
    for (const type of EVENTS) w.doc.removeEventListener?.(type, onScreen, true);
    for (const t of w.timers) clearTimeout(t);
    w.timers.clear();
}
/** 시험용 */
export const _forTest = { get watching() { return !!watching; }, SETTLE_MS };
