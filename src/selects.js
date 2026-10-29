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
import { getSettings, readSettings } from './settings.js';

const SEARCH_FROM = 12; // 항목이 이보다 많으면 찾기칸
let layer = null;       // 열린 팝업 (한 번에 하나)
let owner = null;       // 팝업을 연 select
let anchorEl = null;    // 5.4.8: select 대신 자리를 잡을 칸 (숨긴 select 를 쓰는 한글화 패널의 이름 칸) — getBoundingClientRect 만 있으면 됨
let refocus = false;
let unwatchHost = null; // native 팝업이 DOM을 남기고 닫혀도 목록을 함께 회수
let touchStart = null;  // 손가락 시작점 — 밀기(스크롤)와 톡을 가름
let openedAt = 0;       // 연 시각 (연 직후의 scroll · resize 로 닫히지 않게)
let openedWidth = 0;    // 연 순간의 창 너비 — 높이만 바뀌는 resize(자판 · 주소창)는 닫지 않고 자리만 다시 잡음
const GRACE = 700;      // 연 뒤 이만큼은 scroll · resize 를 봐줌 (폰의 주소창 · 자판 · 부드러운 스크롤이 300ms 를 넘김)

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function eligible(el) {
    if (!(el instanceof HTMLSelectElement)) return false;
    if (!document.body.classList.contains('salty')) return false;
    if (readSettings().chat?.selectPop === false) return false;   // 8.2.6 키 · 누름마다 도는 읽기
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
        out.push(`<button type="button" role="option" data-i="${opt.index}" data-v="${esc(opt.value)}" aria-selected="${opt.selected}" class="${opt.selected ? 'on' : ''}"${opt.disabled ? ' disabled' : ''}><span>${esc(label)}</span><i aria-hidden="true"></i></button>`);
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

// 10-27 목록 모양 하나로(사용자 「라디오 목록 선택창 디자인이 다 달라요」). 모양은 css/72-pick.css.
// 10-28 사용자 정정 「내가 누른 칸 바로 밑에 뜨는 게 좋다」 — 폰도 PC 처럼 누른 칸 바로 밑(모자라면 위) 드롭다운이다.
// 폰 아래 시트(.sheet · css/72 의 시트 규칙)는 꺼 둔 경로로 남긴다: PHONE_SHEET 를 켜야만 ≤1000px 에서 시트가 된다
export const SHEET_MAX_WIDTH = 1000;
export const PHONE_SHEET = false;
export function pickMode(width = window.innerWidth) { return PHONE_SHEET && width <= SHEET_MAX_WIDTH ? 'sheet' : 'drop'; }
// 목록과 화면 끝 사이 — 기본 12px 안쪽(철칙 벽 여백 12). 칸이 그보다 화면 끝에 붙어 있으면 칸 선에 맞춘다(규칙 16 같은 선, 10-28 조정자)
export const PICK_EDGE = 12;
export const PICK_GAP = 6;
// 좌우 바깥 한계 = min(12, 칸의 화면 끝 거리) — 칸이 화면 안에 있으면 목록이 칸 선보다 바깥으로 나가지 않고, 칸 선과 어긋나지도 않는다
export function pickEdges(r, v) {
    return {
        l: Math.min(PICK_EDGE, Math.max(0, r.left - v.x)),
        r: Math.min(PICK_EDGE, Math.max(0, v.x + v.w - r.right)),
    };
}

// 보이는 화면 (폰의 주소창 · 자판 · 확대를 뺀 실제 보이는 영역). visualViewport 가 없으면 창 크기
function viewport() {
    const vv = window.visualViewport;
    if (vv && vv.height > 0) return { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height };
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

// 목록 자리(순수 계산 — 시험이 이 함수를 그대로 부른다). r = 누른 칸의 화면 자리, v = 보이는 화면, content = { w: 글에 필요한 폭, h: 다 펼친 높이 }
//  · 폭: 칸 폭에 맞춤(글이 더 길면 그만큼), 좌우 바깥 한계(pickEdges)를 넘지 않음. 왼쪽 끝은 칸 왼쪽, 넘치면 안으로 밈
//  · 위아래: 다 펼쳐서 칸 밑에 들어가면 밑, 안 들어가고 위가 더 넓으면 위(2.8.1 — 위로 띄울 때도 top 기준)
//  · 높이: 고른 쪽에 남은 공간까지, 넘치면 목록 안에서 굴림. 자판이 올라와도 v(보이는 화면) 기준이라 자판에 가리지 않음
export function pickRect(r, v, content) {
    const edge = PICK_EDGE, gap = PICK_GAP, side = pickEdges(r, v);
    const maxW = Math.max(0, v.w - side.l - side.r);
    const maxH = Math.max(0, v.h - edge * 2);
    const width = Math.min(Math.max(Math.ceil(content.w), Math.round(r.width)), maxW);
    const left = Math.min(Math.max(r.left, v.x + side.l), v.x + v.w - width - side.r);
    const below = (v.y + v.h) - r.bottom - gap - edge;
    const above = r.top - v.y - gap - edge;
    const up = content.h > below && above > below;
    const room = Math.min(maxH, Math.max(Math.min(120, maxH), up ? above : below));
    const h = Math.min(content.h, room);
    let top = up ? r.top - gap - h : r.bottom + gap;
    top = Math.min(Math.max(top, v.y + edge), Math.max(v.y + edge, v.y + v.h - edge - h));
    return { width, left, top, up, maxHeight: room, h };
}

function place(box, sel) {
    const r = sel.getBoundingClientRect();
    const v = viewport();
    const side = pickEdges(r, v);
    const maxW = Math.max(0, v.w - side.l - side.r);
    // 폭: 그려진 글 · 체크 자리 · 여백만큼(10-28: 적어도 누른 칸 폭). max-content 는 optgroup 제목 · 찾기 칸도 잰다
    box.style.minWidth = '0';
    box.style.maxWidth = `${maxW}px`;
    const labels = [...box.querySelectorAll('.salty-pick-rows > button > span')];
    for (const label of labels) label.style.whiteSpace = 'nowrap';
    box.style.width = 'max-content';
    // flex 고유 폭은 글이 줄어들 수 있으면 간격을 빼먹는다 — 실제 글자 크기로 글 폭을 재고 줄 여백 · 테두리를 더한다
    const px = value => parseFloat(value) || 0;
    const sides = el => {
        const s = getComputedStyle(el);
        return px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth);
    };
    let needed = box.offsetWidth;
    const rows = box.querySelector('.salty-pick-rows');
    for (const label of labels) {
        const row = label.parentElement, marker = row.querySelector('i');
        const range = document.createRange();
        range.selectNodeContents(label);
        const s = getComputedStyle(row);
        needed = Math.max(needed, range.getBoundingClientRect().width
            + (marker?.getBoundingClientRect().width || 0) + px(s.columnGap)
            + sides(row) + px(s.marginLeft) + px(s.marginRight) + sides(rows) + sides(box) + 2);
    }
    // 폭을 먼저 정한 뒤(줄바꿈이 높이를 바꿈) 다 펼친 높이를 잰다
    const width = Math.min(Math.max(Math.ceil(needed), Math.round(r.width)), maxW);
    box.style.width = `${width}px`;
    for (const label of labels) label.style.removeProperty('white-space');
    box.style.bottom = 'auto';
    box.style.maxHeight = `${Math.max(0, v.h - PICK_EDGE * 2)}px`;
    box.style.top = `${v.y + PICK_EDGE}px`;
    const at = pickRect(r, v, { w: needed, h: box.offsetHeight || 120 });
    box.style.width = `${at.width}px`;
    box.style.left = `${at.left}px`;
    box.style.maxHeight = `${at.maxHeight}px`;
    box.style.top = `${at.top}px`;
    box.classList.toggle('up', at.up);
    return { r, v, ...at };
}


let closedAt = 0;       // 닫은 시각 — 바깥을 눌러 닫은 직후의 click 을 삼킴

let closeWatch = null;  // 7.0.6 목록이 열린 동안의 CloseWatcher (뒤로 가기 = 목록만 닫기)

const ownerWatch = new MutationObserver(() => { if (owner && !owner.isConnected) close(); });

function close() {
    ownerWatch.disconnect();
    unwatchHost?.();
    unwatchHost = null;
    const watch = closeWatch; closeWatch = null; watch?.destroy();   // 7.0.6 목록이 닫히면 뒤로 가기는 다시 창 몫
    if (!layer) return;
    const back = refocus && owner?.isConnected && layer.contains(document.activeElement) ? owner : null;
    layer.remove();
    layer = null;
    owner = null;
    anchorEl = null;
    closedAt = Date.now();
    refocus = false;
    back?.focus({ preventScroll: true });
}

// 5.7.1: 목록이 열린 동안 확장이 select 의 option 을 새로 그리면(모델 목록이 막 도착함) 번호가 가리키는 칸이 달라진다 —
// 누른 줄의 값으로 고른다 (그 번호의 값이 같으면 그 칸, 아니면 같은 값의 칸, 그 값이 없어졌으면 아무것도 안 바꿈)
function pick(index, value) {
    const sel = owner;
    close();
    if (!sel) return;
    if (value !== undefined && sel.options[index]?.value !== value) {
        index = [...sel.options].findIndex(o => o.value === value);
        if (index < 0) return;
    }
    if (sel.selectedIndex === index) return;
    sel.selectedIndex = index;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
}

function open(sel, anchor = null) {
    if (owner === sel) { close(); return; }
    close();
    owner = sel;
    anchorEl = anchor;
    refocus = document.activeElement === sel;
    openedAt = Date.now();
    openedWidth = window.innerWidth;
    // 어디에 꽂나: 실리태번 팝업(dialog) 안이면 그 안(top layer 밖은 inert), 아니면 body.
    // 2.8.0: 전에는 열린 서랍 안에 꽂았는데(실리태번은 문서 click 이 .openDrawer 밖에 떨어지면 서랍을 닫음), 서랍은
    // 스크롤 상자라 폰에서 fixed 층이 서랍 좌표에 묶여 칸이 화면 끝에 걸치면 목록이 잘리거나 엉뚱한 곳에 그려졌다
    // (사용자: "칸이 다 보여야 열림"). 이제 body 에 두고, 층 안의 click 은 문서로 올려 보내지 않아 서랍이 닫히지 않는다.
    const hostSelector = window.CSS?.supports?.('selector(:popover-open)')
        ? 'dialog[open], [popover]:popover-open' : 'dialog[open]';
    const host = sel.closest(hostSelector) || document.body;
    layer = document.createElement('div');
    layer.className = 'salty-pick-layer';
    // 7.0.5: 다른 확장의 「창 밖 누르면 닫기」가 이 층(body 에 붙음)을 창 밖으로 보지 않게 하는 공용 표시 — 떠 있는 목록 · 팝업은 [data-bl-popup]
    layer.dataset.blPopup = 'pick';
    // 2.9.2: 실리태번은 html 에 transform(translateZ) 을 걸어 두어 fixed 요소의 기준이 화면이 아니라 높이 0 인 html 이 된다.
    // 그래서 CSS 의 inset: 0 만으로는 층 높이가 0 — 목록 밖을 눌러도 닫히지 않고 그 뒤의 단추(API '연결' 등)가 눌렸다.
    // 크기를 화면 단위로 직접 준다 (lvh 를 모르는 브라우저는 뒤 선언을 버리고 100vh)
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh';
    const search = sel.options.length > SEARCH_FROM;
    const sheet = pickMode() === 'sheet';
    if (sheet) layer.classList.add('sheet');
    layer.innerHTML = `<div class="salty-pick salty-pick-float${sheet ? ' sheet' : ''}" role="listbox">
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
        if (btn && !btn.disabled) pick(Number(btn.dataset.i), btn.dataset.v);
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
        } else if (e.key === 'Enter' && e.target === input && !e.isComposing) {   // 8.2.7 한글 조합 중 Enter 는 조합만 끝내요(두 번째 Enter 가 목록을 다시 열었어요)
            e.preventDefault();
            items[0]?.click();
        }
    });
    host.append(layer);
    // 외부 스크립트는 body에 아주 높은 z-index의 모달을 만들기도 한다. 수치 경쟁 대신
    // 수동 popover로 최상위 층에 올린다. dialog 안의 DOM 소속은 유지해 inert를 피하고,
    // manual은 기존 팝업을 자동으로 닫지 않는다. 구형 브라우저는 CSS 층으로 돌아간다.
    if (typeof layer.showPopover === 'function') {
        layer.setAttribute('popover', 'manual');
        try { layer.showPopover(); }
        catch { layer.removeAttribute('popover'); }
    }
    if (host !== document.body) {
        // 자동 popover의 안쪽에 두어 선택 클릭이 부모의 바깥 클릭으로 처리되지 않게 한다.
        // 부모가 DOM을 남긴 채 닫히는 경우도 MutationObserver만으로는 알 수 없다.
        const onClose = () => { if (!host.open) close(); };
        const onToggle = (e) => { if (e.target === host && e.newState === 'closed') close(); };
        host.addEventListener('close', onClose);
        host.addEventListener('toggle', onToggle);
        unwatchHost = () => { host.removeEventListener('close', onClose); host.removeEventListener('toggle', onToggle); };
    }
    // 7.0.6 폰 뒤로 가기(닫기 요청)는 목록만 닫는다 — 전엔 목록 아래 창(dialog)이 함께 닫혔다. 닫기 요청은 가장 나중에 만든
    //       CloseWatcher 가 먼저 받는다(목록은 누를 때 열리니 창과 다른 묶음). CloseWatcher 가 없거나 창이 먼저 받으면 창의 cancel 을 가로챈다
    if (typeof CloseWatcher === 'function') {
        try { closeWatch = new CloseWatcher(); closeWatch.onclose = () => { closeWatch = null; close(); }; } catch { closeWatch = null; }
    }
    if (host instanceof HTMLDialogElement) {
        // 문서 캡처라 창 자신의 cancel 처리기(실리태번 팝업 · 테마 창)보다 먼저 받는다 (cancel 은 거품이 없어도 캡처는 지난다)
        const onCancel = (e) => { if (!layer || e.target !== host) return; e.preventDefault(); e.stopImmediatePropagation(); close(); };
        document.addEventListener('cancel', onCancel, true);
        const prev = unwatchHost;
        unwatchHost = () => { prev?.(); document.removeEventListener('cancel', onCancel, true); };
    }
    ownerWatch.observe(document.body, { childList: true, subtree: true });
    if (!sheet) place(box, anchorEl || sel);   // 시트는 CSS 가 자리를 잡는다(아래 고정 · 가로 전체)
    // 고른 줄이 보이게 — 목록 칸만 굴린다. scrollIntoView 는 조상(서랍)까지 굴려서, 항목이 많은 목록(번역기 모델 칸)이
    // 폰에서 서랍을 튕기고 scroll 로 스스로 닫혔다 (2.7.10). 폰(손가락 · 자판)에서는 찾기칸에 초점을 주지 않음
    const on = rows.querySelector('button.on');
    if (on) rows.scrollTop = Math.max(0, on.offsetTop - rows.clientHeight / 2 + on.offsetHeight / 2);
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches && !(navigator.maxTouchPoints > 0);
    if (input && mouse) input.focus();
    else on?.focus({ preventScroll: true });
}

/** 열어 보고, 열렸으면 true. 안에서 무엇이 잘못돼도 OS 목록은 살려 둔다 (preventDefault 를 열린 뒤에만 부르도록). */
function tryOpen(sel, anchor = null) {
    try {
        open(sel, anchor);
    } catch (error) {
        console.warn('[블루 레몬에이드] 고르기 목록을 못 그림 — OS 목록으로', error);
        close();
        return false;
    }
    return layer !== null;
}

/** 5.4.8: 테마 목록 팝업을 쓸 수 있나 (테마 켜짐 + '고르기 목록 팝업' 켜짐) */
export function canPickFor() {
    return document.body.classList.contains('salty') && getSettings().chat?.selectPop !== false;
}
/** 5.4.8: 숨겨 둔 select 를 다른 칸(anchor) 밑에 테마 목록으로 연다 — 한글화 패널의 이름 칸이 설정창 · 모델 칸과 같은 목록을 쓰게.
 *  이미 열려 있으면 닫는다. 못 열면 false (부른 쪽이 원래 목록을 쓴다) */
export function openPickFor(sel, anchor) {
    if (!(sel instanceof HTMLSelectElement) || !canPickFor() || sel.disabled || !sel.options.length) return false;
    if (owner === sel) { close(); return true; }
    return tryOpen(sel, anchor);
}

// 8.2.7: 누르는 사이 select 밖의 모달 창이 떴으면(폰에서 select 를 길게 누르면 뜨는 단추 설명 창 · longpress-help.js) 손을 떼도 열지 않는다 —
// 열면 목록이 설명 창 뒤에 눌리지 않는 채로 떠 있다가, 설명 창을 닫으면 고르지도 않은 목록이 남았다
// 8.2.7 검토: 창 위에 창이 겹치면(설정 창 위에 연 액자 편집 창 등) 문서 순서로 첫 모달은 아래 깔린 창이라, 맨 위 창 안의 select 까지 열지 않았다 —
// 창은 열 때 body 끝에 붙으니 마지막 모달(맨 위 창)을 본다
function behindModal(el) {
    try { const modals = document.querySelectorAll('dialog:modal'), top = modals[modals.length - 1]; return !!top && !top.contains(el); } catch { return false; }
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
        if (moved || behindModal(e.target)) return;
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
        if (phantom && e.isTrusted) { e.preventDefault(); e.stopPropagation(); }   // 7.8.3: 코드가 부르는 click(.click())은 삼키지 않는다(부록 F)
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
        if (owner && !layer.classList.contains('sheet')) place(layer.firstElementChild, anchorEl || owner);
    });
    // 10-28 폰 드롭다운: 자판이 올라오거나(안드로이드 크롬은 창 크기는 그대로 두고 보이는 화면만 줄임) 확대 · 밀기로 보이는 화면이
    // 바뀌면 자리만 다시 잡는다 — 목록이 자판 밑에 깔리거나 화면 밖에 남지 않게. 한 프레임에 한 번만
    let vvQueued = false;
    const replace = () => {
        if (vvQueued) return;
        vvQueued = true;
        requestAnimationFrame(() => {
            vvQueued = false;
            if (layer && owner && !layer.classList.contains('sheet')) place(layer.firstElementChild, anchorEl || owner);
        });
    };
    window.visualViewport?.addEventListener('resize', replace);
    window.visualViewport?.addEventListener('scroll', replace);
    document.addEventListener('scroll', (e) => {
        if (layer && !layer.contains(e.target) && (e.target === document || (e.target instanceof Node && e.target.contains(owner))) && Date.now() - openedAt > GRACE) close();
    }, true);
    // 연 select 가 문서에서 빠지면(실리태번이 다시 그림) 닫음

}
