// 1.7.9 미트볼 맞춤 스위치 — 시작 묶음 몫(열쇠 · 갈래 · 이미 있던 설정 자리 · 켜고 끄기 셈 · html 표식)만 여기 둬요.
//   이름 · 설명 · 찾기 낱말 · 설정 창 묶음(한글 약 13KB)은 src/mb-switch.js 에 있어요 — 설정 창 · 레몬 탭 · 설정 찾기 · 미트볼 모듈이 받아요.
//   apply.js 는 시작할 때 끈 열쇠 표식(data-bl-mb-off)만 적으면 돼서 이 파일만 받아요(1.7.7 까지는 표 전체가 시작 묶음에 들었어요).
//   새 스위치는 이 표(MB_CORE)에 열쇠를 더하고 src/mb-switch.js 의 TEXT 에 같은 열쇠로 이름 · 설명을 더해요 — 시험 tools/tests/boot-graph.mjs 가 두 표의 열쇠 · 차례를 맞춰 봐요.
//   설명은 src/mb-switch.js 머리 그대로: 기본값은 전부 켬 · 끈 열쇠만 chat.mbOff · 이미 있던 스위치는 그 키(setting) · invert = 그 키가 참이면 끈 것 · choice = 고르기 설정({ off: 원작 값 })
export const MB_OFF_ATTR = 'data-bl-mb-off';
export const MB_OFF_EVENT = 'bl-mb-off';

/** 스위치 표(차례 = 설정 창 차례). key = 끄는 열쇠 · kind = screen(화면만) | data(데이터를 고침) */
export const MB_CORE = [
    // ── 화면만: 모양 ──
    { key: 'icons', kind: 'screen' },
    { key: 'font', kind: 'screen' },
    { key: 'palette', kind: 'screen' },
    { key: 'controls', kind: 'screen' },
    { key: 'dialog', kind: 'screen' },
    { key: 'layout', kind: 'screen' },
    { key: 'spacing', kind: 'screen' },
    { key: 'touch', kind: 'screen' },
    { key: 'blur', kind: 'screen' },
    { key: 'next', kind: 'screen' },
    { key: 'blank', kind: 'screen' },
    // ── 화면만: 자리별 ──
    { key: 'band', kind: 'screen' },
    { key: 'bandrow', kind: 'screen' },
    { key: 'locgo', kind: 'screen' },
    { key: 'weekday', kind: 'screen' },
    { key: 'badge', kind: 'screen' },
    { key: 'dot', kind: 'screen' },
    { key: 'mindpop', kind: 'screen' },
    { key: 'grid', kind: 'screen' },
    { key: 'chips', kind: 'screen' },
    { key: 'drawer', kind: 'screen' },
    { key: 'tabs', kind: 'screen' },
    { key: 'helpers', kind: 'screen', setting: 'chat.mbHelpers' },
    // ── 화면만: 더한 것 · 동작 ──
    { key: 'face', kind: 'screen', setting: 'chat.mbFace', choice: { off: 'icon' } },
    { key: 'avapick', kind: 'screen' },
    { key: 'deco', kind: 'screen' },
    { key: 'arrow', kind: 'screen' },
    { key: 'floors', kind: 'screen', setting: 'chat.mbMapFloors' },
    { key: 'annex', kind: 'screen' },
    { key: 'unvisited', kind: 'screen' },
    { key: 'trend', kind: 'screen' },
    { key: 'tcolor', kind: 'screen' },
    { key: 'addon', kind: 'screen' },
    { key: 'album', kind: 'screen', setting: 'chat.mbAlbumBtn', invert: true },
    { key: 'ask', kind: 'screen' },
    { key: 'back', kind: 'screen', setting: 'chat.mbBack' },
    { key: 'note', kind: 'screen' },
    // ── 화면만: 화면만 번역 빈틈 ──
    { key: 'trchip', kind: 'screen' },
    { key: 'trtoast', kind: 'screen' },
    // ── 데이터를 고치는 것 ──
    { key: 'hidden', kind: 'data', setting: 'chat.mbHiddenSync' },
    { key: 'autosub', kind: 'data' },
    { key: 'editsync', kind: 'data' },
    { key: 'namekey', kind: 'data' },
    { key: 'autoen', kind: 'data', setting: 'chat.mbAutoEn' },
    { key: 'prompt', kind: 'data', setting: 'chat.mbPrompt', choice: { off: 'off' } },
    { key: 'rules', kind: 'data' },
    { key: 'read', kind: 'data' },
    { key: 'ledger', kind: 'data' },
    { key: 'relfix', kind: 'data' },
    { key: 'fill', kind: 'data' },
    { key: 'rename', kind: 'data' },
    { key: 'merge', kind: 'data' },
    { key: 'dedupe', kind: 'data' },
    { key: 'trtidy', kind: 'data' },
    { key: 'trfill', kind: 'data' },
    { key: 'mindtr', kind: 'data' },
    { key: 'glossary', kind: 'data' },
    { key: 'model', kind: 'data' },
];
export const MB_KEYS = MB_CORE.map(sw => sw.key);
const BY_KEY = new Map(MB_CORE.map(sw => [sw.key, sw]));

const chatKey = sw => sw.setting?.split('.')[1];
/** 이 스위치가 켜져 있나(테마 설정 기준) */
export function switchOn(settings, key) {
    const sw = BY_KEY.get(key), chat = settings?.chat || {};
    if (!sw) return true;
    if (!sw.setting) return !(Array.isArray(chat.mbOff) && chat.mbOff.includes(key));
    const v = chat[chatKey(sw)];
    if (sw.choice) return v !== sw.choice.off && v !== undefined;
    if (sw.invert) return v !== true;
    return v !== false;
}
/** html 표식에 적을 끈 열쇠(띄어 적은 글 · 다 켜져 있으면 '') — 고르는 칸(얼굴 표시 · 미트볼 문구)은 제 표식 · 설정을 따로 써서 빼요 */
let handedKeys = () => [];
/** 미트볼 2.9.1 이 스스로 하게 된 시트 묶음을 알려 주는 함수를 받아요 — src/mb-upstream.js 가 받힐 때 한 번 넣어요(시작 그래프에 그 모듈을 끌어들이지 않게 이 표는 그 모듈을 부르지 않아요) */
export function setHanded(fn) { handedKeys = typeof fn === 'function' ? fn : () => []; }
export function offAttrValue(settings, handed = handedKeys) {
    const out = [];
    for (const sw of MB_CORE) if (!sw.choice && !switchOn(settings, sw.key)) out.push(sw.key);
    try { for (const key of handed()) if (!out.includes(key)) out.push(key); } catch { /* 그 확장 설정을 못 읽으면 테마 스위치만 */ }   // 미트볼 2.9.1 이 스스로 하게 된 묶음(src/mb-upstream.js UP 의 css)
    return out.join(' ');
}
/**
 * 한 스위치를 켜거나 꺼요(테마 설정 chat 을 그 자리에서 고쳐요). 고르는 칸은 끌 때 원작 값으로 두고 그때 값을 mbAllWas 에 적어 둬요 — 다시 켜면 그 값으로.
 */
export function setSwitch(chat, key, on) {
    const sw = BY_KEY.get(key); if (!sw || !chat) return false;
    if (sw.setting) {
        const k = chatKey(sw);
        if (sw.choice) {
            const was = chat.mbAllWas && typeof chat.mbAllWas === 'object' ? chat.mbAllWas : (chat.mbAllWas = {});
            if (!on) { if (chat[k] !== undefined && chat[k] !== sw.choice.off) was[k] = chat[k]; chat[k] = sw.choice.off; }
            else if (was[k] !== undefined) { chat[k] = was[k]; delete was[k]; }   // 적어 둔 값이 없으면 그대로 — 고르는 칸(얼굴 표시 · 토큰이 드는 미트볼 문구)은 「켜기」로 저절로 고르지 않아요
        } else chat[k] = sw.invert ? !on : !!on;
        return true;
    }
    const list = new Set(Array.isArray(chat.mbOff) ? chat.mbOff : []);
    if (on) list.delete(key); else list.add(key);
    chat.mbOff = [...list];
    return true;
}
/** 전부 · 화면만 · 데이터만 켜거나 꺼요. kind = all | screen | data · 미트볼 문구(토큰이 드는 고르기)는 「켜기」로 저절로 켜지 않아요(끄기 전 단계가 적혀 있으면 그것으로) */
export function setAll(chat, on, kind = 'all') {
    for (const sw of MB_CORE) if (kind === 'all' || sw.kind === kind) setSwitch(chat, sw.key, on);
    return chat;
}
/** 이 문서에서 그 스위치가 꺼져 있나(html 표식) — 문서를 모르면 켜진 것으로 */
export function mbOff(key, doc = globalThis.document) {
    let v = '';
    try { v = doc?.documentElement?.getAttribute?.(MB_OFF_ATTR) || ''; } catch { v = ''; }
    return !!v && ` ${v} `.includes(` ${key} `);
}
/** 맞춤 시트가 걸리는 때(테마 켬 · 원작 그대로 보기 아님)이면서 그 스위치가 켜져 있나 */
export function mbFit(key, doc = globalThis.document) {
    const body = doc?.body;
    return !!body?.classList?.contains?.('salty') && !body.hasAttribute?.('data-bl-ext-raw') && !mbOff(key, doc);
}
/** html 표식을 맞추고(바뀌었으면) 문서 사건을 한 번 내요 → 바뀌었나 */
export function syncOffAttr(value, doc = globalThis.document, before = () => {}) {
    const root = doc?.documentElement; if (!root) return false;
    const had = root.getAttribute(MB_OFF_ATTR) || '';
    if (had === value) return false;
    before();
    if (value) root.setAttribute(MB_OFF_ATTR, value); else root.removeAttribute(MB_OFF_ATTR);
    try { doc.dispatchEvent(new (doc.defaultView?.CustomEvent || globalThis.CustomEvent)(MB_OFF_EVENT, { detail: { off: value ? value.split(' ') : [], was: had ? had.split(' ') : [] } })); } catch { /* 사건 없이 — 모듈은 일할 때마다 표식을 봐요 */ }
    return true;
}
/** 문서 사건 받기(바뀐 열쇠마다 한 번) — fn(key, off) */
export function onMbOff(doc, keys, fn) {
    try {
        doc?.addEventListener?.(MB_OFF_EVENT, e => {
            const off = new Set(e?.detail?.off || []), was = new Set(e?.detail?.was || []);
            for (const k of keys) if (off.has(k) !== was.has(k)) { try { fn(k, off.has(k)); } catch { /* 다음 바뀜에 */ } }
        });
        return true;
    } catch { return false; }
}
