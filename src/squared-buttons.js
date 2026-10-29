// Theme look: text buttons that SillyTavern or other extensions draw as thick pills or circles become
// slim rounded rectangles. Only a marker attribute is added; removing it restores the original shape.
// Switches, dots, badges, progress bars, avatars and icon-only round buttons keep their shape.
import { booting, afterBoot } from './boot-gate.js';

const ATTR = 'data-bl-squared';
const CANDIDATES = 'button,a,summary,label,[role="button"],[role="tab"],[tabindex],.menu_button,.qr--button,[class*="btn"],[class*="chip"],[class*="tab"],[class*="pill"]';
const SKIP_CLASS = /(switch|toggle|knob|dot|badge|spinner|progress|slider|avatar|thumb|count|indicator|scroll)/i;
const SKIP_AREA = '#send_form,.mes_buttons,.swipe_left,.swipe_right,[data-bl-native-ext-colors]';
// 7.5.4 상태를 나타내는 클래스는 생김새 열쇠에서 뺀다 (.on · .active · is-* 가 바뀌어도 같은 단추)
const STATE_CLASS = /^(?:on|off|active|inactive|selected|current|open|closed|hidden|disabled|focus(?:ed)?|hover|pressed|checked|is-|has-|bl-)/;
const SEEN_MAX = 400;
/** 7.5.4 표시한 단추의 생김새 열쇠: 태그 + 상태 아닌 클래스(정렬). 같은 생김새의 새 요소는 재지 않고 바로 표시한다 */
export function shapeKey(el) {
    const cls = typeof el.className === 'string' ? el.className : '';
    const tokens = cls.split(/\s+/).filter(t => t && !STATE_CLASS.test(t)).sort();
    return `${el.tagName}|${tokens.join(' ')}`;
}
let stop = null;

/** Keep connected roots whose ancestors are not already in this batch.
 * Walking ancestors avoids comparing every pair of sibling additions. */
export function compactRoots(nodes) {
    const roots = new Set([...nodes].filter(node => node?.isConnected));
    return [...roots].filter(node => {
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            if (roots.has(parent)) return false;
        }
        return true;
    });
}

export function syncSquaredButtons(on) {
    if (!on) { stop?.(); stop = null; return; }
    if (!stop) stop = watchSquaredButtons(document, window);
}

const alpha = color => {
    if (!color || color === 'transparent') return 0;
    const m = /rgba?\(([^)]+)\)/.exec(color); if (!m) return 1;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length > 3 ? parseFloat(parts[3]) : 1;
};

/** 7.2.8 Checks that need no layout (same answers as the first lines of isRoundTextButton): run before offsetParent so
 *  marked, skipped and excluded elements never ask for layout. */
// 8.0.8: 뿌리 하나를 훑을 때는 건너뛸 구역(SKIP_AREA)을 뿌리 아래에서 한 번만 모아(`areas`) 후보마다 조상을 다시 오르지 않는다 —
//   메시지 300개의 .mes_button(실리태번이 tabindex 를 달아 후보가 됨) 수천 개가 저마다 closest(SKIP_AREA) 로 조상을 오르던 것.
//   판정은 같다: 뿌리 자신 · 뿌리의 조상이 구역이면 scan 이 뿌리째 건너뛰고, 뿌리 아래 구역은 areas 가 품는지로 본다.
//   (contains 가 없는 가짜 문서(시험)에서는 예전처럼 closest 로)
// 10-28: 구역은 Set 으로 들고, 후보에서 조상으로 오르며 구역인지 본다 — 예전에는 후보마다 구역 전부(메시지 300개면 .mes_buttons 300여 개)에
//   contains 를 물어 body 를 훑을 때 후보 수천 × 구역 수백 번이었다(긴 채팅 · 폰 4배에서 설정 슬라이더 한 걸음마다 약 0.7초). 판정은 같다(구역 자신 · 그 안 = 참).
export const inArea = (el, areas) => {
    if (!areas || typeof el.contains !== 'function') return !!el.closest(SKIP_AREA);
    if (!areas.size) return false;
    for (let p = el; p; p = p.parentElement) if (areas.has(p)) return true;
    return false;
};
function cheapSkip(el, view, areas = null) {
    if (!(el instanceof view.HTMLElement) || el.hasAttribute(ATTR)) return true;
    if (el.matches('input,select,textarea,img,svg') || inArea(el, areas)) return true;
    const cls = typeof el.className === 'string' ? el.className : '';
    return SKIP_CLASS.test(cls) || SKIP_CLASS.test(el.id);
}

/** True when the element is a painted, clickable text control whose corners make a pill or circle. */
export function isRoundTextButton(el, view = el.ownerDocument.defaultView, areas = null) {
    if (cheapSkip(el, view, areas)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.height < 24 || rect.width < 24) return false;
    const text = (el.innerText || '').trim();
    // A single glyph in a circle is an icon (?, ✕, ⚙); two or more characters are a label.
    if ([...text].length < 2) return false;
    const s = view.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const raw = s.borderTopLeftRadius;
    const radius = raw.endsWith('%') ? parseFloat(raw) * Math.min(rect.width, rect.height) / 100 : parseFloat(raw);
    if (!(radius > 10 && radius >= rect.height / 2 - 2)) return false;
    const painted = alpha(s.backgroundColor) > 0.03 || parseFloat(s.borderTopWidth) > 0 || s.backgroundImage !== 'none' || s.boxShadow !== 'none';
    if (!painted) return false;
    const clickable = el.matches('button,a,summary,[role="button"],[role="tab"],.menu_button') || s.cursor === 'pointer';
    return clickable;
}

// 7.8.5: 인라인 style 에서 padding 위 · 아래만 바뀐 것(control-ink 의 글자 세로 맞춤)은 모양 · 보임이 안 바뀐다 — 다시 재지 않는다.
// 예전에는 그 쓰기마다 이 감시가 다시 재기를 걸어, 확장 서랍을 열 때 화면 전체 다시 계산이 10번 남짓 났다(리그 CPU 4배)
const PADDING_ONLY = /^padding-(top|bottom)$/;
function styleMap(text) {
    const map = new Map();
    for (const part of String(text || '').split(';')) { const i = part.indexOf(':'); if (i > 0) map.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim()); }
    return map;
}
export function paddingOnly(record) {
    if (record.type !== 'attributes' || record.attributeName !== 'style' || typeof record.target?.getAttribute !== 'function') return false;
    const before = styleMap(record.oldValue), after = styleMap(record.target.getAttribute('style'));
    let changed = false;
    for (const key of new Set([...before.keys(), ...after.keys()])) {
        if (before.get(key) === after.get(key)) continue;
        if (!PADDING_ONLY.test(key)) return false;
        changed = true;
    }
    return changed;
}

// (10-29 perf-persona) 테마 자신의 성능 표식(#chat 의 bl-chat-light · bl-chat-covered)만 바뀐 class 기록은 단추의 모양 · 보임을 바꾸지 않는다.
//   예전에는 그 기록도 #chat 을 뿌리로 넣어 메시지 300개의 후보(.mes_button 등 수천 개)를 offsetParent 로 다시 쟀다 — 서랍 덮개(chat-light.js)가
//   #chat 을 content-visibility:hidden 으로 둔 동안에는 그 읽기가 하나하나 건너뛴 내용을 그 자리에서 계산하게 해, 폰 리그에서 서랍 열기가 0.25 → 3.5초(재계산 284번)가 됐다.
// 8.2.7 폰: 몰입 읽기(reader.js)는 채팅을 내리고 올릴 때마다 body 에 bl-bars-hidden 을 붙였다 뗀다 — 위 바 · 입력판을 top · transform 으로 밀기만 해서
//   (css/29-reader-onehand.css) 단추 보임 · 크기 · 모서리는 같다. 예전에는 그때마다 body 를 뿌리로 문서 전체를 다시 쟀다(스크롤 중 0.3초대 끊김)
const PERF_MARKS = new Set(['bl-chat-light', 'bl-chat-covered', 'bl-bars-hidden']);
export function perfMarkOnly(record) {
    if (record.type !== 'attributes' || record.attributeName !== 'class' || typeof record.target?.getAttribute !== 'function') return false;
    const words = v => new Set(String(v || '').split(/\s+/).filter(Boolean));
    const before = words(record.oldValue), after = words(record.target.getAttribute('class'));
    let changed = false;
    for (const c of new Set([...before, ...after])) {
        if (before.has(c) === after.has(c)) continue;
        if (!PERF_MARKS.has(c)) return false;
        changed = true;
    }
    return changed;
}
const COVERED = '#chat.bl-chat-covered';

export function watchSquaredButtons(doc, host) {
    const style = doc.createElement('style');
    style.dataset.blSquaredStyle = '';
    style.textContent = `[${ATTR}]{border-radius:var(--bl-r-btn,8px)!important}`;
    (doc.head || doc.documentElement).append(style);
    const roots = new Set(), waiting = new Set();
    // 7.5.4 한 번 표시한 생김새 — 목록을 innerHTML 로 다시 그리는 확장(탭 · 칩이 새 요소가 됨)에서 새 요소가 0.3초 동안 둥글게 보였다가 네모가 되던 것을 막는다
    const seen = new Map();
    const remember = el => { if (seen.size >= SEEN_MAX) seen.clear(); seen.set(shapeKey(el), true); };
    // 뿌리 아래 건너뛸 구역 — 뿌리 자신(또는 조상)이 구역이면 null(뿌리째 건너뜀)
    const areasOf = root => (root.closest?.(SKIP_AREA) ? null : new Set(root.querySelectorAll?.(SKIP_AREA) || []));
    const restamp = el => {
        if (!seen.size) return;
        const areas = areasOf(el); if (!areas) return;
        const list = el.matches?.(CANDIDATES) ? [el, ...el.querySelectorAll(CANDIDATES)] : el.querySelectorAll?.(CANDIDATES) || [];
        for (const c of list) if (seen.has(shapeKey(c)) && !cheapSkip(c, host, areas)) c.setAttribute(ATTR, '');
    };
    let timer = 0, frame = 0, stopped = false;
    // Measure every candidate first, then mark: marking between reads re-dirtied style and forced one recalc per button.
    function scan(root, found) {
        if (!root?.isConnected) return;
        const areas = areasOf(root); if (!areas) return;
        const list = root.matches?.(CANDIDATES) ? [root, ...root.querySelectorAll(CANDIDATES)] : root.querySelectorAll(CANDIDATES);
        for (const el of list) if (!cheapSkip(el, host, areas) && el.offsetParent !== null && isRoundTextButton(el, host, areas)) found.push(el);
    }
    // 7.2.8 Measure at the start of a frame: the layout read there is the one the frame needs anyway. Read from the 300 ms timer,
    // it forced an extra full layout whenever the page changed again before the next paint (startup, chat open: 4x CPU 250-450 ms).
    function measure() {
        timer = 0; if (stopped) return;
        if (typeof host.requestAnimationFrame !== 'function') { flush(); return; }
        if (!frame) frame = host.requestAnimationFrame(flush);
    }
    function flush() {
        frame = 0; timer = 0; if (stopped) return;
        if (booting(doc)) { afterBoot(measure); return; }   // 7.7.4 시작 덮개 동안은 재지 않는다 — 걷힐 때 모아 둔 자리를 한 번에 (boot-gate.js)
        const list = roots.has(doc.body) ? [doc.body] : compactRoots(roots);
        roots.clear();
        const found = [];
        for (const root of list) scan(root, found);
        for (const el of found) { el.setAttribute(ATTR, ''); remember(el); }
    }
    const queueMany = nodes => {
        const ready = new Set();
        for (const node of nodes) {
            const el = node?.nodeType === 1 ? node : node?.parentElement;
            if (!el || !el.isConnected || el.closest?.('style,script')) continue;
            // Streaming changes a message repeatedly; inspect it once generation ends.
            if (doc.body.dataset.generating && el.closest?.('#chat')) { waiting.add(el.closest('.mes') || el); continue; }
            // (perf-persona) 서랍이 덮어 건너뛰는 채팅 안은 보이지 않는다 — 덮개가 걷힌 뒤에 잰다(건너뛴 내용을 재면 그 자리에서 계산을 강제한다)
            if (el.closest?.(COVERED)) { waiting.add(el.closest('.mes') || el); continue; }
            // Opening a closed drawer re-checks that subtree.
            if (el.closest?.('.drawer-content.closedDrawer')) continue;
            ready.add(el);
        }
        for (const el of ready.has(doc.body) ? [doc.body] : compactRoots(ready)) {
            restamp(el);   // Known shapes still update in the observer callback, before paint.
            roots.add(el);
        }
        if (roots.size && !timer && !frame) timer = host.setTimeout(measure, 300);
    };
    const queue = node => queueMany([node]);
    // Drawers and popups open by class/style changes, so attribute changes re-check that subtree.
    const observer = new host.MutationObserver(records => {
        const pending = new Set();
        for (const r of records) {
            if (perfMarkOnly(r)) { if (!r.target.classList?.contains('bl-chat-covered') && !doc.body.dataset.generating) { for (const node of waiting) pending.add(node); waiting.clear(); } continue; }
            if (r.attributeName === 'data-generating') { if (!doc.body.dataset.generating) { for (const node of waiting) pending.add(node); waiting.clear(); } continue; }
            if (r.type === 'childList') r.addedNodes.forEach(node => pending.add(node)); else if (!paddingOnly(r)) pending.add(r.target);
        }
        queueMany(pending);
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'data-generating'] });
    const resize = () => queue(doc.body);
    host.addEventListener('resize', resize);
    queue(doc.body);
    return () => {
        stopped = true; observer.disconnect(); host.clearTimeout(timer); if (frame) host.cancelAnimationFrame?.(frame); host.removeEventListener('resize', resize);
        for (const el of doc.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR);
        style.remove();
    };
}
