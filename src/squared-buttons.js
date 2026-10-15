// Theme look: text buttons that SillyTavern or other extensions draw as thick pills or circles become
// slim rounded rectangles. Only a marker attribute is added; removing it restores the original shape.
// Switches, dots, badges, progress bars, avatars and icon-only round buttons keep their shape.
const ATTR = 'data-bl-squared';
const CANDIDATES = 'button,a,summary,label,[role="button"],[role="tab"],[tabindex],.menu_button,.qr--button,[class*="btn"],[class*="chip"],[class*="tab"],[class*="pill"]';
const SKIP_CLASS = /(switch|toggle|knob|dot|badge|spinner|progress|slider|avatar|thumb|count|indicator|scroll)/i;
const SKIP_AREA = '#send_form,.mes_buttons,.swipe_left,.swipe_right,[data-bl-native-ext-colors]';
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

/** True when the element is a painted, clickable text control whose corners make a pill or circle. */
export function isRoundTextButton(el, view = el.ownerDocument.defaultView) {
    if (!(el instanceof view.HTMLElement) || el.hasAttribute(ATTR)) return false;
    if (el.matches('input,select,textarea,img,svg') || el.closest(SKIP_AREA)) return false;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (SKIP_CLASS.test(cls) || SKIP_CLASS.test(el.id)) return false;
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
    const roots = new Set();
    let timer = 0, stopped = false;
    function scan(root) {
        if (!root?.isConnected) return;
        const list = root.matches?.(CANDIDATES) ? [root, ...root.querySelectorAll(CANDIDATES)] : root.querySelectorAll(CANDIDATES);
        for (const el of list) if (el.offsetParent !== null && isRoundTextButton(el, host)) el.setAttribute(ATTR, '');
    }
    function flush() {
        timer = 0; if (stopped) return;
        const list = roots.has(doc.body) ? [doc.body] : [...roots];
        roots.clear();
        for (const root of list) scan(root);
    }
    const queue = node => {
        const el = node?.nodeType === 1 ? node : node?.parentElement;
        if (!el || el.closest?.('style,script')) return;
        roots.add(el);
        if (!timer) timer = host.setTimeout(flush, 300);
    };
    // Drawers and popups open by class/style changes, so attribute changes re-check that subtree.
    const observer = new host.MutationObserver(records => { for (const r of records) { if (r.type === 'childList') r.addedNodes.forEach(queue); else queue(r.target); } });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
    const resize = () => queue(doc.body);
    host.addEventListener('resize', resize);
    queue(doc.body);
    return () => {
        stopped = true; observer.disconnect(); host.clearTimeout(timer); host.removeEventListener('resize', resize);
        for (const el of doc.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR);
        style.remove();
    };
}
