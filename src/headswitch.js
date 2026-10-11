// 확장 위 스위치 (6.0.4) — 확장 설정 창 안의 켜기·끄기 스위치를 창 제목 줄에도 보인다.
// 사용자: "모든 확장 … 기본은 다 안 보이게 … 안에서 설정하면 밖에 토글 보이게 … 기본값은 안에만 토글 있는 거".
// 기본은 전부 숨김. 켜기·끄기 스위치가 있는 창에는 안 맨 위에 「위에도 보이기」 줄이 생기고, 켜면 제목 줄에 스위치가 붙어 안의 것과 같이 움직인다.
// 안의 스위치 찾기: [data-bl-master] → id·name 에 enable/active/on/use 힌트 → 라벨 글에 사용/켜/enable 힌트 → 후보가 하나뿐이면 그것 (여럿인데 힌트가 없으면 안 건다).
// 설정: headSwitches { <창 열쇠>: true } — 열쇠는 창의 id, 없으면 class (확장 순서 애드온 keyOf 와 같은 규칙, data-po-key 가 있으면 그것).
import { getSettings, saveSettings } from './settings.js';

const COLUMNS = ['extensions_settings', 'extensions_settings2'];
const STRIP = '.ext-version, [class*="-version"], [class*="_version"], .inline-drawer-icon, i, svg, button, input, select, textarea';
const HINT_ID = /enable|enabled|activ|master|toggle|switch|(^|[_-])(on|use)([_-]|$)/i;
const HINT_TEXT = /enable|enabled|activ|사용|켜|활성|작동/i;
export const ROW = 'bl-hs-row', SWITCH = 'bl-hs-switch', HEAD = 'bl-hs-head';
let running = false, observer = null, timer = 0, ticker = 0;
const masters = new WeakMap();   // 창 → { el, label } (창이 다시 그려져 떨어지면 다시 찾는다)

/** 창의 열쇠: 확장 순서 애드온이 붙인 data-po-key → id → class → 태그 */
export function keyOf(el) {
    if (el.dataset?.poKey) return el.dataset.poKey;
    if (el.id) return `id:${el.id}`;
    const cls = [...(el.classList || [])].filter(Boolean).sort().join('.');
    return cls ? `cls:${cls}` : `tag:${String(el.tagName || '').toLowerCase()}`;
}

/** 후보 점수: data-bl-master 100 · id/name 힌트 3 · 라벨 힌트 2 · 그 밖 1 */
export function scoreOf({ master = false, id = '', name = '', text = '' } = {}) {
    if (master) return 100;
    if (HINT_ID.test(String(id)) || HINT_ID.test(String(name))) return 3;
    if (HINT_TEXT.test(String(text))) return 2;
    return 1;
}

function textOf(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll(STRIP).forEach(n => n.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
}
/** 스위치의 이름: aria-label · title → label[for] → 감싼 label → 부모 줄의 글 */
export function labelOf(control, scope) {
    const aria = (control.getAttribute('aria-label') || control.getAttribute('title') || '').trim();
    if (aria) return aria.slice(0, 40);
    const byFor = control.id && scope.querySelector ? scope.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null;
    const wrap = control.closest('label');
    let text = (byFor && textOf(byFor)) || (wrap && textOf(wrap)) || '';
    if (!text && control.parentElement) text = textOf(control.parentElement);
    return text.slice(0, 40);
}

const isOn = el => el.type === 'checkbox' ? !!el.checked : el.getAttribute('aria-checked') === 'true';
const contentOf = drawer => drawer.querySelector(':scope > .inline-drawer-content');
const headOf = drawer => drawer.querySelector(':scope > .inline-drawer-toggle, :scope > .inline-drawer-header');

/** 창 안의 켜기·끄기 스위치 (없으면 null) */
export function masterOf(drawer) {
    const content = contentOf(drawer) || drawer;
    const explicit = content.querySelector('[data-bl-master]');
    if (explicit) return explicit;
    const found = [...content.querySelectorAll('input[type="checkbox"], [role="switch"]')]
        .filter(el => !el.closest(`.${ROW}`) && !el.classList.contains(SWITCH));
    if (!found.length) return null;
    let best = null, bestScore = 0;
    for (const el of found) {
        const s = scoreOf({ id: el.id, name: el.getAttribute('name') || '', text: labelOf(el, content) });
        if (s > bestScore) { best = el; bestScore = s; }
    }
    return bestScore >= 2 || found.length === 1 ? best : null;
}
function masterFor(drawer) {
    const cached = masters.get(drawer);
    if (cached && cached.el.isConnected && drawer.contains(cached.el)) return cached;
    const el = masterOf(drawer);
    const next = el ? { el, label: labelOf(el, contentOf(drawer) || drawer) } : null;
    if (next) masters.set(drawer, next); else masters.delete(drawer);
    return next;
}

/** 확장 칸의 맨 바깥 창들 */
export function drawers() {
    const out = [];
    for (const id of COLUMNS) {
        const col = document.getElementById(id);
        if (!col) continue;
        for (const el of col.querySelectorAll('.inline-drawer')) {
            const outer = el.parentElement?.closest('.inline-drawer');
            if (outer && col.contains(outer)) continue;   // 창 안에 든 접이식은 창이 아니다
            if (contentOf(el) && headOf(el)) out.push(el);
        }
    }
    return out;
}

export function isShown(key) { return getSettings().headSwitches?.[key] === true; }
export function setShown(key, on) {
    const s = getSettings();
    if (!s.headSwitches || typeof s.headSwitches !== 'object') s.headSwitches = {};
    if (on) s.headSwitches[key] = true; else delete s.headSwitches[key];
    saveSettings();
}

const setAttr = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
function makeSwitch(cls) {
    const sw = document.createElement('button');
    sw.type = 'button'; sw.className = `${SWITCH} ${cls}`; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', 'false');
    sw.append(document.createElement('span'));
    return sw;
}
function makeRow(drawer) {
    const row = document.createElement('div'); row.className = ROW;
    const text = document.createElement('span'); text.className = 'bl-hs-text';
    const opt = makeSwitch('bl-hs-opt');
    opt.setAttribute('aria-label', '위에도 보이기');
    opt.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        setShown(drawer.dataset.blHsKey, opt.getAttribute('aria-checked') !== 'true');
        refresh();
    });
    row.append(text, opt);
    return row;
}
function makeHead(drawer) {
    const sw = makeSwitch(HEAD);
    sw.setAttribute('aria-label', '켜기 끄기');
    sw.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();   // 제목 줄(접기)로 올라가지 않게
        const m = masterFor(drawer);
        if (!m) return;
        m.el.click();
        setTimeout(sync, 50); setTimeout(sync, 400);
    });
    return sw;
}

/** 창마다: 안의 줄을 붙이고, 켜 둔 창은 제목 줄에 스위치를 붙인다 (여러 번 불러도 같다) */
export function refresh() {
    if (!running) return;
    const used = new Set();
    for (const drawer of drawers()) {
        let key = drawer.dataset.blHsKey;
        if (!key || used.has(key)) {
            const base = keyOf(drawer); key = base; let n = 1;
            while (used.has(key)) key = `${base}#${++n}`;
            drawer.dataset.blHsKey = key;
        }
        used.add(key);
        const content = contentOf(drawer), head = headOf(drawer);
        let row = content.querySelector(`:scope > .${ROW}`);
        let sw = head.querySelector(`:scope > .${HEAD}`);
        const m = masterFor(drawer);
        if (!m) { row?.remove(); sw?.remove(); continue; }
        const want = isShown(key);
        if (!row) { row = makeRow(drawer); content.prepend(row); }
        setText(row.firstElementChild, `「${m.label || '켜기'}」 위에도 보이기`);
        setAttr(row.lastElementChild, 'aria-checked', want ? 'true' : 'false');
        if (!want) { sw?.remove(); continue; }
        if (!sw) {
            sw = makeHead(drawer);
            const icon = head.querySelector(':scope > .inline-drawer-icon');
            if (icon) head.insertBefore(sw, icon); else head.append(sw);
        }
        setAttr(sw, 'aria-label', `${m.label || '켜기'} 켜기 끄기`);
        setAttr(sw, 'aria-checked', isOn(m.el) ? 'true' : 'false');
    }
}
/** 제목 줄 스위치를 안의 스위치 상태에 맞춘다 (가볍다 — 켜 둔 창만) */
export function sync() {
    if (!running) return;
    for (const sw of document.querySelectorAll(`.${HEAD}`)) {
        const drawer = sw.closest('.inline-drawer');
        const m = drawer && masterFor(drawer);
        if (!m) { sw.remove(); continue; }
        setAttr(sw, 'aria-checked', isOn(m.el) ? 'true' : 'false');
    }
}

const mine = node => node?.nodeType === 1 && (node.classList.contains(ROW) || node.classList.contains(SWITCH) || !!node.closest?.(`.${ROW}, .${SWITCH}`));
const ours = r => mine(r.target) || ((r.addedNodes.length + r.removedNodes.length) > 0 && [...r.addedNodes, ...r.removedNodes].every(mine));
function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 250); }
function onChange() { setTimeout(sync, 0); }
function start() {
    const block = document.getElementById('rm_extensions_block') || document.body;
    observer = new MutationObserver((records) => {
        if (records.every(ours)) return;
        if (records.some(r => r.type === 'attributes')) setTimeout(sync, 0);
        if (records.some(r => r.type === 'childList')) schedule();
    });
    observer.observe(block, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    block.addEventListener('change', onChange, true);
    block.addEventListener('click', onChange, true);
    // 체크박스를 코드로 바꾸면 알림이 없다 — 확장 칸이 보이는 동안 2초마다 맞춘다
    ticker = setInterval(() => { const b = document.getElementById('rm_extensions_block'); if (b && b.offsetParent !== null) sync(); }, 2000);
}
function stop() {
    observer?.disconnect(); observer = null;
    clearTimeout(timer); clearInterval(ticker); timer = 0; ticker = 0;
    const block = document.getElementById('rm_extensions_block') || document.body;
    block.removeEventListener('change', onChange, true);
    block.removeEventListener('click', onChange, true);
    document.querySelectorAll(`.${ROW}, .${HEAD}`).forEach(n => n.remove());
    running = false;
}

/** features.js 가 부른다: 테마가 켜져 있으면 시작, 꺼지면 붙인 것을 전부 뗀다 */
export function syncHeadSwitch(on) {
    if (on && !running) { running = true; start(); refresh(); }
    else if (!on && running) stop();
    else if (on) schedule();
}
