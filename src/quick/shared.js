// 1.0.3 편의 기능(src/quick/) 공용 — 모양 시트 한 장(quick.css, 켠 기능이 처음 쓸 때 한 번 받음) · 실리태번 길잡이 몇 개.
// 이 파일은 편의 기능 모듈만 불러요(시작 그래프 밖).
import { pickRect } from '../selects.js';
import { backLayer } from '../back-close.js';   // 1.6.9 뒤로 가기 = 이 겹만 닫기
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
// 메뉴 바깥을 눌러 닫은 손가락을 뗄 때의 click 이 뒤 화면(목록 줄 · 단추)에 떨어지지 않게 한 번 삼켜요 — 폰은 층이 사라진 자리의 것을 눌러요(mes-fold.js · selects.js · chat-organizer.js 와 같은 지킴).
// 다음 누름 · 키가 시작되면 그 click 은 이미 왔거나 오지 않아요 — 그때 풀어요. 코드가 부른 click(.click())은 건드리지 않아요.
function swallowNextClick(ms = 700) {
    const eat = (event) => { if (!event.isTrusted) return; event.preventDefault(); event.stopPropagation(); done(); };
    const done = () => { clearTimeout(timer); for (const [type, fn] of [['click', eat], ['pointerdown', done], ['keydown', done]]) document.removeEventListener(type, fn, true); };
    const timer = setTimeout(done, ms);
    for (const [type, fn] of [['click', eat], ['pointerdown', done], ['keydown', done]]) document.addEventListener(type, fn, true);
}
export { swallowNextClick };   // 프리셋 폴더 목록(preset-folders.js)도 같은 지킴을 써요
/** 떠 있는 메뉴가 열려 있나 — 그 메뉴를 띄운 목록(프리셋 폴더)이 Esc 를 메뉴에 넘기려고 봐요(버그 사냥 7) */
export const menuOpen = () => !!menu;
export function closeMenu() {
    if (!menu) return;
    const { layer, off, back } = menu; menu = null; off();
    // 버그 사냥 7: 초점이 메뉴 안에 있었으면(키보드 · 항목 고르기) 메뉴를 연 단추로 돌려줘요 — 지우면 body 로 떨어졌어요
    const inside = layer.contains(document.activeElement);
    try { if (layer.matches(':popover-open')) layer.hidePopover(); } catch { /* popover 모름 */ }
    layer.remove();
    if (inside && back?.isConnected) back.focus?.({ preventScroll: true });
}
/** items: [{ label, run, danger?, disabled?, check? }] — check 가 있으면 체크 표시 줄 */
export function openMenu(anchor, items) {
    closeMenu();
    const back = document.activeElement;
    const layer = document.createElement('div');
    layer.className = 'salty-pick-layer bl-quick-layer';
    layer.dataset.blPopup = 'pick';
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh;margin:0;padding:0;border:0;overflow:visible;max-width:none;max-height:none;background:transparent;color:inherit';
    layer.innerHTML = `<div class="salty-pick salty-pick-float bl-quick-menu" role="menu"><div class="salty-pick-rows">${items.map((item, i) => `<button type="button" role="menuitem" data-i="${i}" class="${item.danger ? 'bl-quick-danger' : ''}${item.check ? ' on' : ''}"${item.disabled ? ' disabled' : ''}><span>${esc(item.label)}</span>${item.check ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div></div>`;
    const box = layer.firstElementChild;
    layer.addEventListener('pointerdown', event => { if (event.target === layer) { event.preventDefault(); closeMenu(); swallowNextClick(); } });
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
    const key = event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
        // 버그 사냥 7: 위 · 아래 화살표 · Home · End 로 항목 옮기기(초점이 메뉴 안일 때만)
        if (!/^(ArrowDown|ArrowUp|Home|End)$/.test(event.key) || !box.contains(document.activeElement)) return;
        const list = [...box.querySelectorAll('button[data-i]:not([disabled])')], at = list.indexOf(document.activeElement);
        if (!list.length) return;
        event.preventDefault();
        list[event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus({ preventScroll: true });
    };
    const width = window.innerWidth;
    const resize = () => { if (window.innerWidth !== width || !anchor.isConnected) closeMenu(); else locate(); };
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', resize);
    const backDone = backLayer(() => { if (menu?.layer === layer) closeMenu(); });
    menu = { layer, back, off: () => { backDone(); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', resize); } };
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
    // 버그 사냥 7: 마우스 · 키보드 기기는 열면 초점을 첫 항목으로(키보드로 연 메뉴를 바로 고를 수 있게 · 터치 기기는 그대로)
    let fine = false; try { fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !(navigator.maxTouchPoints > 0); } catch { /* 모름 */ }
    if (fine) box.querySelector('button[data-i]:not([disabled])')?.focus({ preventScroll: true });
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
