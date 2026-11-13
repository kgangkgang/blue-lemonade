// 1.1.6 CSS 줄이기 첫 걸음 — 뗀 규칙 시트(켜짐 · 설정 창)를 붙이고 받는 몸통. src/lite.js syncGateCss · panelCssReady 가 처음 쓸 때만 받아요.
//
// 무엇: 첫 장(style.css) · 전체 장(src/style-lazy.gen.css)에서 뗀 규칙(tools/css-gates.cjs · 기준 tools/css-gates.json)
//   · 켜짐 시트(src/markdown.gen.css · src/gate-*.gen.css): 그 설정의 클래스가 body 에 붙어야만 맞는 규칙 — 기본값에서는 하나도 안 맞아요.
//   · 설정 창 시트(src/panel.gen.css): 테마 설정 창(.salty-panel) 안에서만 맞는 규칙.
// 차례(깜빡임 없게): 시트를 먼저 붙이고 다 받은 뒤에 클래스를 달아요. apply.js 는 syncGateCss 가 돌려준 클래스(held)를 빼고 달고, 그 클래스는 여기서 load 때 달아요.
//   못 받으면(error) 시트를 떼고 미룬 클래스를 그대로 달아요(기능 상태는 맞게 · 다음 applyAll 에서 다시 받아요).
//   미룬 클래스를 달 때도 apply.js 처럼 긴 채팅을 먼저 식혀요(coolAhead — applyAll 밖에서 다는 것이라 식히지 않으면 미리 그려 둔 화면 밖 메시지까지 다시 계산해요).
// 자리: 테마 시트 뒤 줄(첫 장 → 가벼운 사본 · 전체 장 → 미리보기(-1) → 켜짐 시트들(표 차례 0..) → 설정 창 시트(99)) 안. 서랍 전용 칸 · 호환 시트는 그 줄 뒤예요(lite.js themeRunEnd).
//   원래 뒤에 있던 규칙과 덮어쓰기를 겨루는 규칙은 빌드가 떼지 않아서, 이 자리로 와도 화면이 같아요(tools/tests/css-gates-order.mjs).
import { GATE_SHEETS, PANEL_SHEET } from './css-gates.gen.js';

const OWN_SHEET = new URL('../style.css', import.meta.url).href;
const PANEL_ORDER = 99;
const links = new Map();   // 시트 id → <link>
let want = new Set(), held = new Set(), panelPromise = null, cool = null;

const inRun = n => n && (n.id === 'salty-lazy-css' || n.id === 'salty-ext-css' || n.dataset?.blGate != null);
function themeNode() {
    for (const sheet of document.styleSheets) if (sheet.href === OWN_SHEET && sheet.ownerNode?.isConnected) return sheet.ownerNode;
    return [...document.querySelectorAll('link[rel~="stylesheet"]')].find(l => l.href === OWN_SHEET || /\/blue-lemonade[^/]*\/style\.css(\?|$)/.test(l.href) && l.id !== 'salty-ext-css') || null;
}
const ready = link => !!link?.isConnected && link.dataset.blGateReady === '1';
const needs = (sheet, name) => sheet.classes.includes(name) || sheet.prefixes.some(p => name.startsWith(p));
/** 이 클래스를 달기 전에 받아야 할 시트가 아직 안 왔나 */
const blocked = name => GATE_SHEETS.some(s => needs(s, name) && !ready(links.get(s.id)));

/** 미룬 클래스를 body 에 달아요 — 달기 직전에 긴 채팅을 식혀요(apply.js restyleAhead 와 같은 일: 문서 전체 다시 계산이 화면 밖 메시지 안쪽을 건너뛰게) */
function addClasses(list) {
    const missing = list.filter(c => !document.body.classList.contains(c));
    if (!missing.length) return;
    try { cool?.(); } catch { /* 식히기는 덤이에요 — 못 해도 클래스는 달아요 */ }
    document.body.classList.add(...missing);
}
/** 받기가 끝나면(실패 포함) 미뤄 둔 클래스 가운데 아직 원하는 것을 body 에 달아요 */
function settle(failed = false) {
    const add = [...held].filter(c => want.has(c) && (failed || !blocked(c)));
    if (!add.length) return;
    add.forEach(c => held.delete(c));
    addClasses(add);
}

/** 시트 하나를 테마 시트 뒤 줄 안 order 자리에 붙여요(이미 있으면 그대로) */
function attach(id, file, order) {
    let link = links.get(id);
    if (link?.isConnected) return link;
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = `salty-gate-${id}`;
    link.href = new URL(file, import.meta.url).href;
    link.dataset.blGate = String(order);
    const own = link;
    own.addEventListener('load', () => { own.dataset.blGateReady = '1'; settle(); }, { once: true });
    own.addEventListener('error', () => {
        console.info(`[Blue Lemonade] ${file} 를 못 받았어요 — 다음에 바꿀 때 다시 받아요`);
        own.remove();
        if (links.get(id) === own) links.delete(id);
        settle(true);
    }, { once: true });
    const main = themeNode();
    if (main?.isConnected) {
        let at = main;
        for (let n = main.nextElementSibling; inRun(n); n = n.nextElementSibling) {
            if (n.dataset?.blGate != null && Number(n.dataset.blGate) > order) break;
            at = n;
        }
        at.after(own);
    } else document.head.append(own);
    links.set(id, own);
    return own;
}

/**
 * want = applyAll 이 달 클래스 전부. 필요한 켜짐 시트는 붙여 켜고 필요 없는 것은 꺼요(media). 아직 못 받은 시트가 필요한 클래스 모음을 돌려줘요.
 * late = lite.js 가 이 모듈을 받는 사이 이미 미뤄 둔 적이 있어요 — 시트가 이미 와 있으면 그 클래스를 지금 달아요.
 * coolAhead = 미룬 클래스를 달기 직전에 부를 「긴 채팅 식히기」(apply.js 가 넘겨요 · features.js coolChatForRestyle).
 */
export function syncGateCss(list, late = false, coolAhead = null) {
    want = new Set(list);
    if (coolAhead) cool = coolAhead;
    for (const [i, s] of GATE_SHEETS.entries()) {
        const on = [...want].some(c => needs(s, c));
        const link = on ? attach(s.id, s.file, i) : links.get(s.id);
        if (link && link.media !== (on ? 'all' : 'not all')) link.media = on ? 'all' : 'not all';
    }
    held = new Set([...want].filter(c => !document.body.classList.contains(c) && GATE_SHEETS.some(s => needs(s, c)) && blocked(c)));
    if (late) addClasses([...want].filter(c => GATE_SHEETS.some(s => needs(s, c)) && !blocked(c)));
    return held;
}

/** 테마 설정 창 규칙 시트 — 다 받으면(못 받아도) 풀려요 */
export function panelCssReady() {
    if (!PANEL_SHEET) return Promise.resolve(true);
    if (panelPromise && links.get('panel')?.isConnected) return panelPromise;
    const link = attach('panel', PANEL_SHEET, PANEL_ORDER);
    panelPromise = ready(link) ? Promise.resolve(true) : new Promise(resolve => {
        link.addEventListener('load', () => resolve(true), { once: true });
        link.addEventListener('error', () => { panelPromise = null; resolve(false); }, { once: true });
    });
    return panelPromise;
}

/** 진단용: 붙은 시트와 미룬 클래스 */
export function gateState() {
    return { sheets: [...links].map(([id, l]) => ({ id, ready: ready(l), on: l.media !== 'not all' })), held: [...held] };
}
