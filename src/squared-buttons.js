// Theme look: text buttons that SillyTavern or other extensions draw as thick pills or circles become
// slim rounded rectangles. Only a marker attribute is added; removing it restores the original shape.
// Switches, dots, badges, progress bars, avatars and icon-only round buttons keep their shape.
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
function cheapSkip(el, view) {
    if (!(el instanceof view.HTMLElement) || el.hasAttribute(ATTR)) return true;
    if (el.matches('input,select,textarea,img,svg') || el.closest(SKIP_AREA)) return true;
    const cls = typeof el.className === 'string' ? el.className : '';
    return SKIP_CLASS.test(cls) || SKIP_CLASS.test(el.id);
}

/** True when the element is a painted, clickable text control whose corners make a pill or circle. */
export function isRoundTextButton(el, view = el.ownerDocument.defaultView) {
    if (cheapSkip(el, view)) return false;
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

export function watchSquaredButtons(doc, host) {
    const style = doc.createElement('style');
    style.dataset.blSquaredStyle = '';
    style.textContent = `[${ATTR}]{border-radius:var(--bl-r-btn,8px)!important}`;
    (doc.head || doc.documentElement).append(style);
    const roots = new Set(), waiting = new Set();
    // 7.5.4 한 번 표시한 생김새 — 목록을 innerHTML 로 다시 그리는 확장(탭 · 칩이 새 요소가 됨)에서 새 요소가 0.3초 동안 둥글게 보였다가 네모가 되던 것을 막는다
    const seen = new Map();
    const remember = el => { if (seen.size >= SEEN_MAX) seen.clear(); seen.set(shapeKey(el), true); };
    const restamp = el => {
        if (!seen.size) return;
        const list = el.matches?.(CANDIDATES) ? [el, ...el.querySelectorAll(CANDIDATES)] : el.querySelectorAll?.(CANDIDATES) || [];
        for (const c of list) if (seen.has(shapeKey(c)) && !cheapSkip(c, host)) c.setAttribute(ATTR, '');
    };
    let timer = 0, frame = 0, stopped = false;
    // Measure every candidate first, then mark: marking between reads re-dirtied style and forced one recalc per button.
    function scan(root, found) {
        if (!root?.isConnected) return;
        const list = root.matches?.(CANDIDATES) ? [root, ...root.querySelectorAll(CANDIDATES)] : root.querySelectorAll(CANDIDATES);
        for (const el of list) if (!cheapSkip(el, host) && el.offsetParent !== null && isRoundTextButton(el, host)) found.push(el);
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
        const list = roots.has(doc.body) ? [doc.body] : [...roots];
        roots.clear();
        const found = [];
        for (const root of list) scan(root, found);
        for (const el of found) { el.setAttribute(ATTR, ''); remember(el); }
    }
    const queue = node => {
        const el = node?.nodeType === 1 ? node : node?.parentElement;
        if (!el || !el.isConnected || el.closest?.('style,script')) return;
        // While a reply streams, the chat changes many times a second (text, reasoning header, timers, class toggles on every message):
        // check those messages once when generation ends.
        if (doc.body.dataset.generating && el.closest?.('#chat')) { waiting.add(el.closest('.mes') || el); return; }
        // A closed drawer shows nothing; opening it changes its class, which re-checks the whole drawer.
        if (el.closest?.('.drawer-content.closedDrawer')) return;
        restamp(el);   // 7.5.4 아는 생김새는 그리기 전에 바로 (잰 적 없는 것은 아래 타이머 → 프레임에서)
        roots.add(el);
        if (!timer && !frame) timer = host.setTimeout(measure, 300);
    };
    // Drawers and popups open by class/style changes, so attribute changes re-check that subtree.
    const observer = new host.MutationObserver(records => {
        for (const r of records) {
            if (r.attributeName === 'data-generating') { if (!doc.body.dataset.generating) { const held = [...waiting]; waiting.clear(); held.forEach(queue); } continue; }
            if (r.type === 'childList') r.addedNodes.forEach(queue); else queue(r.target);
        }
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'data-generating'] });
    const resize = () => queue(doc.body);
    host.addEventListener('resize', resize);
    queue(doc.body);
    return () => {
        stopped = true; observer.disconnect(); host.clearTimeout(timer); if (frame) host.cancelAnimationFrame?.(frame); host.removeEventListener('resize', resize);
        for (const el of doc.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR);
        style.remove();
    };
}
