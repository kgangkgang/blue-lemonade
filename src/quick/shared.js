// 1.0.3 편의 기능(src/quick/) 공용 — 모양 시트 한 장(quick.css, 켠 기능이 처음 쓸 때 한 번 받음) · 실리태번 길잡이 몇 개.
// 이 파일은 편의 기능 모듈만 불러요(시작 그래프 밖).
import { pickRect } from '../selects.js';
export const ctx = () => SillyTavern.getContext();
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** 답을 만드는 중인가 (실리태번이 body 에 다는 표시) */
export const generating = () => document.body?.dataset?.generating === 'true';
/** 연필로 고치는 중인 메시지 번호(없으면 -1) — 실리태번 deleteMessage 는 지운 번호가 편집 번호와 같을 때만 편집 번호를 비워요.
 *  그보다 앞을 지우면 편집 번호가 옛 번호로 남아 ✓ 를 누를 때 다른 메시지 글로 다시 그리고 그 번호로 사건을 내요(실리태번 자신의 지우기는 편집부터 닫아요) */
export function editingId() {
    const n = Number.parseInt(document.querySelector('#chat > .mes .edit_textarea')?.closest('.mes')?.getAttribute('mesid') ?? '', 10);
    return Number.isInteger(n) ? n : -1;
}

export function ensureQuickCss() {
    if (document.getElementById('bl-quick-style')) return;
    const link = document.createElement('link');
    link.id = 'bl-quick-style'; link.rel = 'stylesheet';
    link.href = new URL('./quick.css', import.meta.url).href;
    (document.head || document.documentElement).append(link);
}

// ── 떠 있는 작은 메뉴 — 공용 고르기 목록 팝업 모양(.salty-pick · css/72)을 그대로 써요. 한 번에 하나, 바깥 · Esc 로 닫혀요 ──
let menu = null;
export function closeMenu() {
    if (!menu) return;
    const { layer, off } = menu; menu = null; off();
    try { if (layer.matches(':popover-open')) layer.hidePopover(); } catch { /* popover 모름 */ }
    layer.remove();
}
/** items: [{ label, run, danger?, disabled?, check? }] — check 가 있으면 체크 표시 줄 */
export function openMenu(anchor, items) {
    closeMenu();
    const layer = document.createElement('div');
    layer.className = 'salty-pick-layer bl-quick-layer';
    layer.dataset.blPopup = 'pick';
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh;margin:0;padding:0;border:0;overflow:visible;max-width:none;max-height:none;background:transparent;color:inherit';
    layer.innerHTML = `<div class="salty-pick salty-pick-float bl-quick-menu" role="menu"><div class="salty-pick-rows">${items.map((item, i) => `<button type="button" role="menuitem" data-i="${i}" class="${item.danger ? 'bl-quick-danger' : ''}${item.check ? ' on' : ''}"${item.disabled ? ' disabled' : ''}><span>${esc(item.label)}</span>${item.check ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div></div>`;
    const box = layer.firstElementChild;
    layer.addEventListener('pointerdown', event => { if (event.target === layer) { event.preventDefault(); closeMenu(); } });
    // 실리태번은 서랍 밖 누름(touchstart · mousedown)으로 열린 서랍을 닫아요 — 메뉴 안 누름은 문서로 올려 보내지 않아요
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) layer.addEventListener(type, event => event.stopPropagation());
    layer.addEventListener('click', event => {
        event.stopPropagation();
        const button = event.target.closest?.('button[data-i]');
        if (!button || button.disabled) return;
        const item = items[Number(button.dataset.i)];
        closeMenu();
        Promise.resolve().then(() => item?.run?.()).catch(error => console.warn('[Blue Lemonade] 메뉴', error));
    });
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); } };
    const width = window.innerWidth;
    const resize = () => { if (window.innerWidth !== width || !anchor.isConnected) closeMenu(); else locate(); };
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', resize);
    menu = { layer, off: () => { document.removeEventListener('keydown', key, true); window.removeEventListener('resize', resize); } };
    (anchor.closest?.('dialog[open]') || document.body).append(layer);
    if (typeof layer.showPopover === 'function') { try { layer.setAttribute('popover', 'manual'); layer.showPopover(); } catch { layer.removeAttribute('popover'); } }
    function locate() {
        const vv = window.visualViewport;
        const v = vv && vv.height > 0 ? { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height } : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
        box.style.width = 'max-content';
        const r = pickRect(anchor.getBoundingClientRect(), v, { w: box.offsetWidth, h: box.scrollHeight });
        box.style.width = `${r.width}px`; box.style.left = `${r.left}px`; box.style.top = `${r.top}px`; box.style.maxHeight = `${r.maxHeight}px`;
        box.classList.toggle('up', r.up);
    }
    locate();
    return layer;
}

/** 실리태번 입력 창으로 짧은 이름 묻기 → 다듬은 글 또는 null(취소 · 빈 글) */
export async function askName(message, value = '', { max = 24, ok = '저장' } = {}) {
    const c = ctx();
    const answer = await c.callGenericPopup?.(message, c.POPUP_TYPE?.INPUT, value, { okButton: ok, cancelButton: '취소' });
    if (answer === null || answer === undefined || answer === false) return null;
    const name = String(answer).replace(/\s+/g, ' ').trim().slice(0, max);
    return name || null;
}
