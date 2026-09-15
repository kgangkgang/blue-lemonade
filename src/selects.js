// 고르기 목록 팝업 (2.5.0) — 실리태번의 <select> 를 누르면 OS 가 띄우는 회색 목록 대신
// 테마가 그린 목록 팝업(설정창 소분류 팝업과 같은 모양)이 뜬다. 사용자: "팝업 형식으로 된 거 다 저렇게".
//
// 방식: 문서에 갈고리를 걸어 select 가 열리기 전에 막고(pointerdown · touchend · click · keydown),
// 그 자리 밑(또는 위)에 목록을 그린다. 고르면 select 의 값을 바꾸고 input · change 를 쏘아
// 실리태번의 jQuery 핸들러가 그대로 돈다. select 자체는 손대지 않는다 (다른 확장 · 실리태번이 늘 다시 그림).
//
// 빼는 것: multiple · size>1(목록형) · select2 가 대신 그리는 것(.select2-hidden-accessible) · 테마 설정창 안(직접 그린 세그먼트뿐)
// · 비활성 · 항목 0개. 실리태번 팝업(dialog) 안의 select 는 목록을 그 dialog 안에 꽂는다 — 최상위 층(top layer)
// 밖의 요소는 inert 라 body 에 두면 눌리지 않는다.
import { getSettings } from './settings.js';

const SEARCH_FROM = 12; // 항목이 이보다 많으면 찾기칸
let layer = null;       // 열린 팝업 (한 번에 하나)
let owner = null;       // 팝업을 연 select
let touchStart = null;  // 손가락 시작점 — 밀기(스크롤)와 톡을 가름
let openedAt = 0;       // 연 시각 (연 직후의 scroll · resize 로 닫히지 않게)

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function eligible(el) {
    if (!(el instanceof HTMLSelectElement)) return false;
    if (!document.body.classList.contains('salty')) return false;
    if (getSettings().chat?.selectPop === false) return false;
    if (el.multiple || el.size > 1 || el.disabled) return false;
    if (el.classList.contains('select2-hidden-accessible')) return false;
    if (el.closest('.salty-panel, .salty-pick-layer')) return false;
    return el.options.length > 0;
}

function rowsHtml(sel, query = '') {
    const q = query.trim().toLowerCase();
    const out = [];
    const push = (opt) => {
        if (opt.hidden) return;
        const label = opt.label || opt.text || opt.value;
        if (q && !label.toLowerCase().includes(q)) return;
        out.push(`<button type="button" role="option" data-i="${opt.index}" aria-selected="${opt.selected}" class="${opt.selected ? 'on' : ''}"${opt.disabled ? ' disabled' : ''}><span>${esc(label)}</span><i aria-hidden="true"></i></button>`);
    };
    for (const child of sel.children) {
        if (child.tagName === 'OPTGROUP') {
            const at = out.length;
            for (const opt of child.children) push(opt);
            if (out.length > at) out.splice(at, 0, `<div class="salty-pick-group">${esc(child.label)}</div>`);
        } else if (child.tagName === 'OPTION') {
            push(child);
        }
    }
    return out.length ? out.join('') : '<div class="salty-pick-empty">없음</div>';
}

// 목록 자리: select 바로 밑, 아래가 모자라고 위가 더 넓으면 위로. 좌우는 화면 안에 맞춤
function place(box, sel) {
    const r = sel.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, gap = 6, edge = 8;
    const width = Math.min(Math.max(r.width, 220), vw - edge * 2);
    const left = Math.min(Math.max(r.left, edge), vw - width - edge);
    const below = vh - r.bottom - gap - edge;
    const above = r.top - gap - edge;
    const up = below < 220 && above > below;
    const room = Math.max(120, up ? above : below);
    box.style.width = `${width}px`;
    box.style.left = `${left}px`;
    box.style.maxHeight = `${Math.min(room, vh * 0.6)}px`;
    if (up) { box.style.bottom = `${vh - r.top + gap}px`; box.style.top = 'auto'; box.classList.add('up'); }
    else { box.style.top = `${r.bottom + gap}px`; box.style.bottom = 'auto'; box.classList.remove('up'); }
}

let closedAt = 0;       // 닫은 시각 — 바깥을 눌러 닫은 직후의 click 을 삼킴

function close() {
    if (!layer) return;
    layer.remove();
    layer = null;
    owner = null;
    closedAt = Date.now();
}

function pick(index) {
    const sel = owner;
    close();
    if (!sel || sel.selectedIndex === index) return;
    sel.selectedIndex = index;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
}

function open(sel) {
    if (owner === sel) { close(); return; }
    close();
    owner = sel;
    openedAt = Date.now();
    // 어디에 꽂나: 실리태번 팝업(dialog) 안이면 그 안(top layer 밖은 inert), 열린 서랍 안이면 그 서랍 안 —
    // 실리태번은 문서 click 이 .openDrawer 밖에 떨어지면 서랍을 닫아 버린다 (script.js "autocloses open drawers").
    // 폰에서는 톡의 click 이 이 층에 떨어지므로 층이 서랍 안에 있어야 서랍이 안 닫힌다. 층은 fixed 라 서랍 안이라도 화면 기준
    const host = sel.closest('dialog[open], .openDrawer') || document.body;
    layer = document.createElement('div');
    layer.className = 'salty-pick-layer';
    const search = sel.options.length > SEARCH_FROM;
    layer.innerHTML = `<div class="salty-pick salty-pick-float" role="listbox">
        ${search ? '<div class="salty-pick-search"><input type="search" placeholder="찾기" autocomplete="off" spellcheck="false"></div>' : ''}
        <div class="salty-pick-rows">${rowsHtml(sel)}</div>
    </div>`;
    const box = layer.firstElementChild;
    const rows = box.querySelector('.salty-pick-rows');
    // 바깥(반투명 층)을 누르면 닫힘 — 목록 안은 그대로
    layer.addEventListener('pointerdown', (e) => { if (e.target === layer) { e.preventDefault(); close(); } });
    layer.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-i]');
        if (btn && !btn.disabled) pick(Number(btn.dataset.i));
    });
    const input = box.querySelector('input');
    input?.addEventListener('input', () => { rows.innerHTML = rowsHtml(sel, input.value); });
    box.addEventListener('keydown', (e) => {
        const items = [...rows.querySelectorAll('button[data-i]:not([disabled])')];
        const at = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
            items[next]?.focus();
        } else if (e.key === 'Enter' && e.target === input) {
            e.preventDefault();
            items[0]?.click();
        }
    });
    host.append(layer);
    place(box, sel);
    // 고른 줄이 보이게 · 폰(굵은 포인터)에서는 자판이 목록을 가리니 찾기칸에 초점을 주지 않음
    rows.querySelector('button.on')?.scrollIntoView({ block: 'center' });
    if (input && matchMedia('(pointer: fine)').matches) input.focus();
    else rows.querySelector('button.on')?.focus({ preventScroll: true });
}

export function startSelectPop() {
    // 마우스: pointerdown 을 막으면 뒤따르는 mousedown(= 목록이 열리는 순간)도 막힌다. 손가락은 스크롤을 살리려 touchend 에서
    document.addEventListener('pointerdown', (e) => {
        if (!eligible(e.target)) return;
        e.preventDefault();
        if (e.pointerType !== 'touch') open(e.target);
    }, true);
    document.addEventListener('touchstart', (e) => {
        if (!eligible(e.target)) return;
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY, el: e.target };
    }, { capture: true, passive: true });
    document.addEventListener('touchend', (e) => {
        if (!touchStart || !eligible(e.target) || e.target !== touchStart.el) { touchStart = null; return; }
        const t = e.changedTouches[0];
        const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > 10;
        touchStart = null;
        if (moved) return;
        e.preventDefault(); // 뒤따르는 click(폰에서 목록이 열리는 순간)을 막음
        open(e.target);
    }, { capture: true, passive: false });
    document.addEventListener('mousedown', (e) => { if (eligible(e.target)) e.preventDefault(); }, true);
    document.addEventListener('click', (e) => {
        if (eligible(e.target)) { e.preventDefault(); e.stopPropagation(); return; }
        // 연 직후(톡의 click 이 층에 떨어짐) · 바깥을 눌러 닫은 직후(그 click 이 뒤 화면에 떨어짐)의 click 은 삼킨다 —
        // 실리태번 문서 click 이 서랍을 닫거나 뒤 단추가 눌리지 않게. 목록 줄 자체는 통과
        const phantom = (layer && Date.now() - openedAt < 500 && !e.target.closest('.salty-pick-rows button'))
            || (!layer && Date.now() - closedAt < 400);
        if (phantom) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('keydown', (e) => {
        if (layer && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (!eligible(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) {
            e.preventDefault();
            open(e.target);
        }
    }, true);
    // 창 크기가 바뀌거나(자판) 뒤가 굴러가면 자리가 틀어지니 닫음 — 연 직후 0.3초는 봐줌 (scrollIntoView · 자판이 올라오며 나는 것)
    window.addEventListener('resize', () => { if (Date.now() - openedAt > 300) close(); });
    document.addEventListener('scroll', (e) => { if (layer && !layer.contains(e.target) && Date.now() - openedAt > 300) close(); }, true);
    // 연 select 가 문서에서 빠지면(실리태번이 다시 그림) 닫음
    new MutationObserver(() => { if (owner && !owner.isConnected) close(); }).observe(document.body, { childList: true, subtree: true });
}
