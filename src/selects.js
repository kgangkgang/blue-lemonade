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
let openedWidth = 0;    // 연 순간의 창 너비 — 높이만 바뀌는 resize(자판 · 주소창)는 닫지 않고 자리만 다시 잡음
const GRACE = 700;      // 연 뒤 이만큼은 scroll · resize 를 봐줌 (폰의 주소창 · 자판 · 부드러운 스크롤이 300ms 를 넘김)

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

// 보이는 화면 (폰의 주소창 · 자판 · 확대를 뺀 실제 보이는 영역). visualViewport 가 없으면 창 크기
function viewport() {
    const vv = window.visualViewport;
    if (vv && vv.height > 0) return { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height };
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

// 목록 자리: select 바로 밑, 아래가 모자라고 위가 더 넓으면 위로. 좌우는 화면 안에 맞춤.
// 2.8.1: 위로 띄울 때도 bottom 이 아니라 top 으로 놓는다 — 폰에서 bottom 기준이 보이는 화면과 어긋나 목록이
// 화면 밖에 그려졌다 (사용자: "화면 절반은 내려야 나오는데"). 그려 본 뒤 높이를 재서 화면 안으로 밀어 넣는다.
function place(box, sel) {
    const r = sel.getBoundingClientRect();
    const v = viewport();
    const gap = 6, edge = 8;
    const width = Math.min(Math.max(r.width, 220), v.w - edge * 2);
    const left = Math.min(Math.max(r.left, v.x + edge), v.x + v.w - width - edge);
    const below = (v.y + v.h) - r.bottom - gap - edge;
    const above = r.top - v.y - gap - edge;
    const up = below < 220 && above > below;
    const room = Math.max(120, up ? above : below);
    box.style.width = `${width}px`;
    box.style.left = `${left}px`;
    box.style.bottom = 'auto';
    box.style.maxHeight = `${Math.min(room, v.h * 0.6)}px`;
    box.classList.toggle('up', up);
    // 먼저 아래 자리로 놓고 높이를 잰 다음, 위로 띄울 때는 그 높이만큼 올린다. 어느 쪽이든 보이는 화면 안으로 민다
    box.style.top = `${r.bottom + gap}px`;
    const h = box.offsetHeight || 120;
    let top = up ? r.top - gap - h : r.bottom + gap;
    top = Math.min(Math.max(top, v.y + edge), Math.max(v.y + edge, v.y + v.h - edge - h));
    box.style.top = `${top}px`;
    return { r, v, up, h, top, left, width };
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
    openedWidth = window.innerWidth;
    // 어디에 꽂나: 실리태번 팝업(dialog) 안이면 그 안(top layer 밖은 inert), 아니면 body.
    // 2.8.0: 전에는 열린 서랍 안에 꽂았는데(실리태번은 문서 click 이 .openDrawer 밖에 떨어지면 서랍을 닫음), 서랍은
    // 스크롤 상자라 폰에서 fixed 층이 서랍 좌표에 묶여 칸이 화면 끝에 걸치면 목록이 잘리거나 엉뚱한 곳에 그려졌다
    // (사용자: "칸이 다 보여야 열림"). 이제 body 에 두고, 층 안의 click 은 문서로 올려 보내지 않아 서랍이 닫히지 않는다.
    const host = sel.closest('dialog[open]') || document.body;
    layer = document.createElement('div');
    layer.className = 'salty-pick-layer';
    // 2.9.2: 실리태번은 html 에 transform(translateZ) 을 걸어 두어 fixed 요소의 기준이 화면이 아니라 높이 0 인 html 이 된다.
    // 그래서 CSS 의 inset: 0 만으로는 층 높이가 0 — 목록 밖을 눌러도 닫히지 않고 그 뒤의 단추(API '연결' 등)가 눌렸다.
    // 크기를 화면 단위로 직접 준다 (lvh 를 모르는 브라우저는 뒤 선언을 버리고 100vh)
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh';
    const search = sel.options.length > SEARCH_FROM;
    layer.innerHTML = `<div class="salty-pick salty-pick-float" role="listbox">
        ${search ? '<div class="salty-pick-search"><input type="search" placeholder="찾기" autocomplete="off" spellcheck="false"></div>' : ''}
        <div class="salty-pick-rows">${rowsHtml(sel)}</div>
    </div>`;
    const box = layer.firstElementChild;
    const rows = box.querySelector('.salty-pick-rows');
    // 바깥(반투명 층)을 누르면 닫힘 — 목록 안은 그대로
    layer.addEventListener('pointerdown', (e) => { if (e.target === layer) { e.preventDefault(); close(); } });
    // 2.8.3: 실리태번은 html 의 touchstart · mousedown 에서 ".openDrawer 밖"을 누르면 서랍을 닫는다 (script.js "autocloses
    // open drawers"). 층은 body 에 있으니 목록을 굴리려는 손가락만 닿아도 서랍이 닫혔다 (사용자: "목록에서 스크롤 한 번 하면
    // 바깥 화면으로 나가버림"). 층 안에서 난 누름은 문서로 올려 보내지 않는다 (기본 동작은 그대로 — 스크롤은 된다)
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) {
        layer.addEventListener(type, (e) => e.stopPropagation());
    }
    layer.addEventListener('click', (e) => {
        // 문서까지 올라가면 실리태번이 "서랍 밖 click" 으로 보고 열린 서랍을 닫는다 — 여기서 멈춤
        e.stopPropagation();
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
    // 고른 줄이 보이게 — 목록 칸만 굴린다. scrollIntoView 는 조상(서랍)까지 굴려서, 항목이 많은 목록(번역기 모델 칸)이
    // 폰에서 서랍을 튕기고 scroll 로 스스로 닫혔다 (2.7.10). 폰(손가락 · 자판)에서는 찾기칸에 초점을 주지 않음
    const on = rows.querySelector('button.on');
    if (on) rows.scrollTop = Math.max(0, on.offsetTop - rows.clientHeight / 2 + on.offsetHeight / 2);
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches && !(navigator.maxTouchPoints > 0);
    if (input && mouse) input.focus();
    else on?.focus({ preventScroll: true });
}

/** 열어 보고, 열렸으면 true. 안에서 무엇이 잘못돼도 OS 목록은 살려 둔다 (preventDefault 를 열린 뒤에만 부르도록). */
function tryOpen(sel) {
    try {
        open(sel);
    } catch (error) {
        console.warn('[블루 레몬에이드] 고르기 목록을 못 그림 — OS 목록으로', error);
        close();
        return false;
    }
    return layer !== null;
}

export function startSelectPop() {
    // 마우스: pointerdown 을 막으면 뒤따르는 mousedown(= 목록이 열리는 순간)도 막힌다. 손가락은 스크롤을 살리려 touchend 에서
    document.addEventListener('pointerdown', (e) => {
        if (!eligible(e.target)) return;
        if (e.pointerType === 'touch') { e.preventDefault(); return; } // 손가락은 touchend 에서 연다
        if (tryOpen(e.target)) e.preventDefault();
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
        // 열렸을 때만 뒤따르는 click(폰에서 OS 목록이 열리는 순간)을 막는다 — 못 열면 OS 목록이 대신 뜨게
        if (tryOpen(e.target)) e.preventDefault();
    }, { capture: true, passive: false });
    document.addEventListener('mousedown', (e) => { if (eligible(e.target)) e.preventDefault(); }, true);
    document.addEventListener('click', (e) => {
        if (eligible(e.target)) { e.preventDefault(); e.stopPropagation(); return; }
        // 연 직후(톡의 click 이 층에 떨어짐) · 바깥을 눌러 닫은 직후(그 click 이 뒤 화면에 떨어짐)의 click 은 삼킨다 —
        // 실리태번 문서 click 이 서랍을 닫거나 뒤 단추가 눌리지 않게. 목록 줄 자체는 통과
        const phantom = (layer && Date.now() - openedAt < GRACE && !e.target.closest('.salty-pick-rows button'))
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
    // 뒤가 굴러가면 자리가 틀어지니 닫음 — 연 직후 GRACE 는 봐줌. 창 크기는 너비가 바뀔 때만(회전) 닫고,
    // 높이만 바뀌면(폰 주소창 · 자판) 자리만 다시 잡는다 (2.7.10)
    window.addEventListener('resize', () => {
        if (!layer) return;
        if (window.innerWidth !== openedWidth) { if (Date.now() - openedAt > GRACE) close(); return; }
        if (owner) place(layer.firstElementChild, owner);
    });
    document.addEventListener('scroll', (e) => { if (layer && !layer.contains(e.target) && Date.now() - openedAt > GRACE) close(); }, true);
    // 연 select 가 문서에서 빠지면(실리태번이 다시 그림) 닫음
    new MutationObserver(() => { if (owner && !owner.isConnected) close(); }).observe(document.body, { childList: true, subtree: true });
}
