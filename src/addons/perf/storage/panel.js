// 성능 보조 · 저장 공간 창 · 점검 도구가 같이 쓰는 창 틀 (열 때만 불러온다). 모달 <dialog>: × · Esc · 바깥 누르기로 닫힘, data-bl-popup 으로 다른 팝업 등록부와 어울림.
import { armGuard } from '../../../cheap-guards.js';
//   색은 공용 팔레트(style.css · --lp-*)가 테마를 그대로 따르고(data-lp-mode="auto"), 낮 · 밤 표시(data-bls-tone)는 지금 글자 밝기로 골라요.
/** 글자색 밝기로 어두운/밝은 판 — 밝은 글자면 어두운 바탕(dark) */
export function toneFromColor(color) {
    const m = /rgba?\(([^)]+)\)/.exec(String(color || ''));
    if (!m) return 'dark';
    const [r, g, b] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) > 0.4 ? 'dark' : 'light';
}
/** 창 · 알림에 팔레트 표시 — 테마 색 그대로(auto), 낮 · 밤은 지금 글자 밝기 */
export function stamp(el) {
    if (!el) return el;
    let tone = 'dark';
    try { tone = toneFromColor(getComputedStyle(document.body).color); } catch { /* 그대로 */ }
    el.classList?.add?.('lp-root');
    el.setAttribute?.('data-lp-mode', 'auto');
    el.setAttribute?.('data-bls-tone', tone);
    armGuard('ext');   // 1.4.x 최적화 3차: 표식 전에 테마 시트의 지킴 갈래를 원래 꼴로(src/cheap-guards.js)
    el.setAttribute?.('data-bl-native-ext-colors', '');
    return el;
}
/** 창이 띄우는 알림 — 같은 표시를 입힌다 */
export function toast(kind, message, title) {
    try {
        const t = globalThis.toastr?.[kind]?.(message, title);
        const el = t?.[0] || (t instanceof Element ? t : null);
        if (el) { el.classList.add('bls-toast'); stamp(el); }
        return t;
    } catch { return null; }
}
// 창 CSS(style.css)는 처음 열 때 한 번 붙여요 — 시작할 때 받는 파일을 늘리지 않게
let styleReady = null;
export function ensureStyle() {
    styleReady ??= new Promise(resolve => {
        const href = new URL('./style.css', import.meta.url).href;
        if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href === href)) { resolve(); return; }
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.dataset.blStorage = '';
        const timer = setTimeout(resolve, 4000);
        link.onload = link.onerror = () => { clearTimeout(timer); resolve(); };
        document.head.append(link);
    });
    return styleReady;
}
const CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 창을 정수 px 자리에 — 가운데 놓기((화면 − 창) / 2)나 위 글 줄 높이(소수 px)로 단추 줄이 반 px 에 놓이면 단추 글자가 1px 어긋나 보인다(button-size 10-23).
 *  anchor 를 주면 그 줄(확인 창의 단추 줄)이 정수 자리에 오게 창 전체를 옮긴다. 내용이 바뀌어 크기가 달라질 때마다 다시 */
export function snapToPixel(d, anchor = null) {
    const snap = () => { d.style.translate = ''; const r = (anchor && d.querySelector(anchor) || d).getBoundingClientRect(); const x = Math.round(r.left) - r.left, y = Math.round(r.top) - r.top; if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01) d.style.translate = `${x}px ${y}px`; };
    snap();
    try { const ro = new ResizeObserver(snap); ro.observe(d); d.addEventListener('close', () => ro.disconnect(), { once: true }); } catch { /* 옛 브라우저 */ }
}

/** 창 하나 — 같은 id 가 열려 있으면 그것을 앞으로 */
export function openPanel({ id, title, subtitle = '', onClose = null }) {
    const found = document.getElementById(id);
    if (found?.open) { found.focus?.(); return found._blsPanel; }
    found?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = id; dialog.className = 'bls-panel'; dialog.setAttribute('data-bl-popup', ''); dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.innerHTML = `<header class="bls-panel-head"><div class="bls-panel-titles"><h2 id="${id}-title">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>`
        + `<button type="button" class="bls-icon" data-bls-close aria-label="${esc(title)} 닫기" title="닫기">${CLOSE_SVG}</button></header><div class="bls-panel-body"></div>`;
    stamp(dialog);
    document.body.append(dialog);
    const close = () => { try { dialog.close(); } catch { /* 이미 */ } };
    dialog.addEventListener('close', () => { try { onClose?.(); } catch (e) { console.warn('[Blue Lemonade] 저장 공간', e); } dialog.remove(); });
    // 바깥(어두운 곳) 누르기로 닫기 — 누르기 시작도 바깥이었을 때만. 길게 눌러 창을 연 손을 떼는 순간의 click 이 바깥에 떨어져 바로 닫히던 것(태블릿 폭) 방지
    const outside = e => { if (e.target !== dialog) return false; const r = dialog.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    let downOutside = false;
    dialog.addEventListener('pointerdown', e => { downOutside = outside(e); });
    dialog.addEventListener('click', e => {
        if (e.target.closest('[data-bls-close]')) { close(); return; }
        if (downOutside && outside(e)) close();
        downOutside = false;
    });
    try { dialog.showModal(); } catch { dialog.show(); }
    snapToPixel(dialog);
    const panel = { dialog, body: dialog.querySelector('.bls-panel-body'), close };
    dialog._blsPanel = panel;
    return panel;
}

/** el 을 ms 동안 누르고 있으면 fn() — 손을 떼거나 벗어나면 취소. 길게 누른 뒤의 click 은 swallowSelector 안에서 삼킨다(서랍 여닫기 등) */
export function holdToOpen(el, fn, { ms = 1000, swallowRoot = null, swallowSelector = '' } = {}) {
    if (!el) return;
    let timer = 0, fired = false;
    const stop = () => { if (timer) { clearTimeout(timer); timer = 0; } };
    el.addEventListener('pointerdown', e => { if (e.button !== 0) return; fired = false; stop(); timer = setTimeout(() => { timer = 0; fired = true; try { fn(); } catch (err) { console.warn('[Blue Lemonade] 저장 공간', err); } }, ms); });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, stop);
    el.addEventListener('contextmenu', e => e.preventDefault());
    (swallowRoot || el).addEventListener('click', e => { if (fired && (!swallowSelector || e.target.closest(swallowSelector))) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
}

/** 확인 창 — 무엇이 · 몇 개 · 몇 MB 가 없어지는지 보여 주고 「지우기」를 눌러야 true.
 *  단추 자리 · 낱말은 블루레몬에이드 테마 확인 창과 같게: [하는 일(왼쪽, 색) | 취소(오른쪽)] (button-size) */
export function confirmBox({ title, lines = [], ok = '지우기', cancel = '취소', danger = true }) {
    return new Promise(resolve => {
        const d = document.createElement('dialog');
        d.className = 'bls-panel bls-confirm'; d.setAttribute('data-bl-popup', ''); d.setAttribute('aria-label', title);
        d.innerHTML = `<div class="bls-panel-body"><h2>${esc(title)}</h2>${lines.map(l => `<p>${esc(l)}</p>`).join('')}`
            + `<div class="bls-row bls-end bls-actions"><button type="button" class="bls-btn ${danger ? 'bls-danger' : 'bls-primary'}" data-v="1">${esc(ok)}</button><button type="button" class="bls-btn" data-v="0">${esc(cancel)}</button></div></div>`;
        stamp(d);
        document.body.append(d);
        let answer = false;
        d.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { answer = b.dataset.v === '1'; d.close(); } });
        d.addEventListener('close', () => { d.remove(); resolve(answer); });
        try { d.showModal(); } catch { d.show(); }
        snapToPixel(d, '.bls-row.bls-end');
        d.querySelector('[data-v="0"]')?.focus();
    });
}
