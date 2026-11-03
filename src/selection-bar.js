// 고른 글 도구 줄 — 채팅에서 글을 고르면 그 아래에 뜨는 알약 한 줄 (북마크 · 로그 복사가 단추를 하나씩 올린다)
// 예전 북마크 단추(bookmarks/selection-chip.js)를 테마 쪽으로 옮겨 여러 도구가 같은 줄을 쓰게 했다 — 자리 · 모양 · 누름 처리는 그대로.
// 안드로이드는 고른 글 위에 제 메뉴(복사 · 소리 내어 읽기)를 띄우므로 줄은 아래에 둔다. 위로 올리는 것은 아래에 자리가 없을 때만.
// 폰에서 단추를 누르면 그 순간 선택이 풀릴 수 있다 → 고를 때(selectionchange) 범위를 잡아 두고, 누르는 순간(pointerdown) 도구가 모양까지 떠 둔다.
// 다시 쓰기의 빠른 금지 칩(250ms) · LLM 번역의 고른 글 도구와 같이 뜰 수 있어 겹치면 옆으로 비킨다.
// 한 메시지 안 선택은 { single: true, index }, 여러 메시지에 걸친 선택은 { single: false, roots } — 도구가 accepts 로 고른다 (북마크는 한 메시지만).
// 시작 그래프 밖: index.js 3층(유휴)과 북마크 애드온이 부른다.
import { booting } from './boot-gate.js';   // 7.7.4 시작 덮개 동안엔 고른 글이 있을 수 없다 — Selection 을 읽지 않는다
import { trimRange, trimToRoot } from './selection-range.js';   // 6.4.4 세 번 클릭이 늘린 끝을 겹친 글자 · 메시지 글 안으로 줄인다 (고른 글 지우기와 같은 도우미)

const DELAY = 300;
const BAR_ID = 'cg-select-chip';   // 번역기 「고른 글 지우기」가 이 id 로 자리를 비킨다 (translator/selection/delete.js)
const OBSTACLES = '.bwr_quickban:not([hidden]), #llmt-selection-selection';
const TEXT_INPUT = /^(text|search|url|tel|email|password|number)$/;
const MAX_MESSAGES = 400;   // 로그 복사가 한 번에 담는 메시지 수 상한 (긴 채팅 전체를 끌어 골라도 멈추지 않게)

const tools = new Map();   // id → { order, icon, label, aria, enabled, accepts, shown, capture, run }
let bar = null;
let timer = 0;
let frame = 0;
let held = null;      // 지금 고른 글 { range, root, roots, index, single }
let pending = null;   // 누르는 순간 떠 둔 모양 { id, target, captured }
let pressing = false;
let pressTimer = 0;
let busy = false;
let started = false;

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
export const textRoot = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat .mes_text') ?? null;

/** 초점이 채팅 밖의 글 입력칸이면 선택은 그 칸 안이다 — Selection 을 읽지 않는다 (글자 칠 때마다 스타일 계산을 하지 않게) */
export function typingInField() {
    const element = document.activeElement;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && TEXT_INPUT.test(element.type));
}

const liveMessage = mes => mes?.parentElement?.id === 'chat' && !mes.querySelector('.edit_textarea');

/** 범위가 지나는 메시지 글(.mes_text) — 시작 메시지부터 끝 메시지까지 형제를 따라간다 (긴 채팅 전체를 querySelectorAll 하지 않게) */
function messageRoots(range, chat) {
    const mesOf = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat > .mes') ?? null;
    let first = mesOf(range.startContainer);
    let last = mesOf(range.endContainer);
    if (!first) {
        const child = range.startContainer === chat ? chat.children[range.startOffset] : null;
        first = child?.classList?.contains('mes') ? child : [...chat.children].find(el => el.classList.contains('mes') && range.intersectsNode(el)) ?? null;
    }
    if (!last) last = [...chat.children].reverse().find(el => el.classList.contains('mes') && range.intersectsNode(el)) ?? null;
    if (!first || !last) return [];
    const roots = [];
    for (let mes = first; mes; mes = mes.nextElementSibling) {
        if (mes.classList.contains('mes') && liveMessage(mes)) {
            const root = mes.querySelector('.mes_text');
            if (root && range.intersectsNode(root)) roots.push(root);
            if (roots.length >= MAX_MESSAGES) break;
        }
        if (mes === last) break;
    }
    return roots;
}

/** 채팅 화면 글 안에서 고른 글이면 { range, root, roots, index, single } */
export function currentSelection() {
    if (typingInField()) return null;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.getRangeAt(0).collapsed) return null;   // 6.4.5 isCollapsed 대신 (배치 계산 강제 없이 같은 답)
    const range = trimToRoot(selection.getRangeAt(0), textRoot) ?? selection.getRangeAt(0);   // 6.4.4 마지막 문단을 세 번 클릭해 끝이 다음 메시지 앞까지 가도 이 메시지 글 안으로
    const root = textRoot(range.startContainer);
    if (root && root === textRoot(range.endContainer)) {
        const mes = root.closest('.mes');
        if (!mes || !liveMessage(mes)) return null;   // 고치는 중인 메시지는 화면 글이 아니라 편집 칸이다
        const index = Number.parseInt(mes.getAttribute('mesid') ?? '', 10);
        if (!Number.isInteger(index) || index < 0) return null;
        if (!selection.toString().trim()) return null;
        return { range: range.cloneRange(), root, roots: [root], index, single: true };
    }
    // 여러 메시지에 걸친 선택 (이름 줄에서 시작한 끌기도) — 채팅 칸 안이어야 한다
    const chat = document.getElementById('chat');
    const wide = trimRange(selection.getRangeAt(0)) ?? selection.getRangeAt(0);
    if (!chat || !chat.contains(wide.commonAncestorContainer)) return null;
    const roots = messageRoots(wide, chat);
    if (!roots.length || !selection.toString().trim()) return null;
    return { range: wide.cloneRange(), root: roots[0], roots, index: null, single: false };
}

const visibleTools = target => [...tools.values()]
    .filter(tool => { try { return tool.enabled() && (!tool.accepts || tool.accepts(target)); } catch { return false; } })
    .sort((a, b) => a.order - b.order);

function ensureBar() {
    if (bar?.isConnected) return bar;
    document.getElementById(BAR_ID)?.remove();   // 옛 북마크 단추(같은 id)
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.className = 'cg-select-chip';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', '고른 글 도구');
    bar.hidden = true;
    bar.addEventListener('contextmenu', event => event.preventDefault());
    // 누르는 순간 선택이 풀리기 전에(초점 이동 · 안드로이드 탭) 모양을 떠 둔다
    bar.addEventListener('pointerdown', (event) => {
        const button = event.target.closest?.('button[data-tool]');
        event.preventDefault();
        event.stopPropagation();
        if (!button || event.button > 0) return;
        pressing = true;
        clearTimeout(pressTimer);
        const tool = tools.get(button.dataset.tool);
        pending = held && tool ? { id: tool.id, target: held, captured: safeCapture(tool, held) } : null;
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
        bar.addEventListener(type, () => {
            clearTimeout(pressTimer);
            // click 이 뒤따라온다 — 그때까지 선택 확인이 줄을 숨기지 않게 조금 더 쥐고 있는다
            pressTimer = setTimeout(() => { pressing = false; pending = null; schedule(); }, 600);
        });
    }
    bar.addEventListener('click', (event) => {
        const button = event.target.closest?.('button[data-tool]');
        event.preventDefault();
        event.stopPropagation();
        if (!button) return;
        const tool = tools.get(button.dataset.tool);
        if (!tool) return;
        commit(tool);
    });
    document.body.append(bar);
    return bar;
}

function renderButtons(list) {
    const key = list.map(tool => `${tool.id}:${tool.icon?.() ?? ''}`).join('|');
    if (bar.dataset.tools === key) return;
    bar.dataset.tools = key;
    bar.replaceChildren();
    list.forEach((tool, n) => {
        if (n) bar.append(Object.assign(document.createElement('span'), { className: 'cg-select-sep', ariaHidden: 'true' }));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cg-select-act';
        button.dataset.tool = tool.id;
        button.setAttribute('aria-label', tool.aria ?? tool.label);
        button.innerHTML = `<i class="fa-solid ${tool.icon?.() ?? 'fa-star'}" aria-hidden="true"></i><span>${tool.label}</span>`;
        bar.append(button);
    });
}

function safeCapture(tool, target) {
    if (!tool.capture) return null;
    try {
        if (!target?.root?.isConnected || !target.range.startContainer.isConnected || !target.range.endContainer.isConnected) return null;
        return tool.capture(target);
    } catch (error) {
        console.warn(`[${tool.label}] 고른 글을 읽지 못했습니다:`, error);
        return null;
    }
}

export function hideSelectionBar({ forget = true } = {}) {
    clearTimeout(timer);
    timer = 0;
    if (bar) bar.hidden = true;
    if (forget) held = null;
}

function rectsOf(range) {
    try {
        return [...range.getClientRects()].filter(rect => rect.width > 0.5 && rect.height > 0.5);
    } catch {
        return [];
    }
}

const overlaps = (a, b, pad = 4) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

/** 고른 글의 마지막 줄 바로 아래 (화면 · 입력창 위 안으로). 아래에 자리가 없을 때만 위로 */
function place() {
    frame = 0;
    if (!held || !bar) return;
    const rects = rectsOf(held.range);
    const chat = document.getElementById('chat')?.getBoundingClientRect();
    if (!rects.length || !held.root.isConnected) { hideSelectionBar(); return; }
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    const lastLine = rects.filter(rect => rect.bottom >= bottom - 2);
    const lastTop = Math.min(...lastLine.map(rect => rect.top));
    const line = { left: Math.min(...lastLine.map(rect => rect.left)), right: Math.max(...lastLine.map(rect => rect.right)), top: lastTop, bottom };
    const firstTop = Math.min(...rects.map(rect => rect.top));
    // 고른 글이 채팅 칸 밖으로 스크롤되면 숨긴다 (다시 들어오면 다시 보인다)
    if (chat && (line.bottom < chat.top + 4 || firstTop > chat.bottom - 4)) { bar.hidden = true; return; }

    const viewport = window.visualViewport;
    const viewTop = (viewport?.offsetTop ?? 0) + 8;
    const viewLeft = (viewport?.offsetLeft ?? 0) + 8;
    const viewBottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 8;
    const viewRight = (viewport ? viewport.offsetLeft + viewport.width : window.innerWidth) - 8;
    const form = document.getElementById('send_form')?.getBoundingClientRect();
    const floor = form && form.height > 0 && form.top > viewTop + 60 ? Math.min(viewBottom, form.top - 8) : viewBottom;
    const ceiling = Math.max(viewTop, chat ? chat.top + 4 : viewTop);

    bar.hidden = false;
    const width = bar.offsetWidth;
    const height = bar.offsetHeight;
    let left = Math.min(Math.max((line.left + line.right) / 2 - width / 2, viewLeft), viewRight - width);
    // 폰의 선택 손잡이(물방울)는 시작 · 끝 글자 아래에 매달린다 — 줄이 그 자리와 겹치면 손잡이 아래로 내린다
    let gap = 8;
    if (coarse()) {
        const handles = [line.right];
        if (firstTop >= lastTop - 2) handles.push(Math.min(...rects.map(rect => rect.left)));
        if (handles.some(x => left < x + 18 && left + width > x - 18)) gap = 30;
    }
    let top = line.bottom + gap;
    // 입력창 위에 자리가 없으면: 폰은 입력창 위로 겹쳐서라도 아래에 둔다 — 위로 올리면 안드로이드가 고른 글 위에 띄우는
    // 제 메뉴(복사 · 소리 내어 읽기) 밑에 깔려 누를 수 없다. 화면 끝까지도 자리가 없을 때만 위로
    const room = [floor, ...(coarse() ? [viewBottom] : [])].some(limit => top + height <= limit);
    if (!room) {
        const above = firstTop - 8 - height;
        top = above >= ceiling ? above : Math.max(ceiling, Math.min(top, viewBottom - height));
    }
    let box = { left, top, right: left + width, bottom: top + height };
    for (const element of document.querySelectorAll(OBSTACLES)) {
        const other = element.getBoundingClientRect();
        if (!other.width || !other.height || !overlaps(box, other)) continue;
        if (other.right + 6 + width <= viewRight) left = other.right + 6;
        else if (other.left - 6 - width >= viewLeft) left = other.left - 6 - width;
        else top = Math.min(other.bottom + 6, viewBottom - height);
        box = { left, top, right: left + width, bottom: top + height };
    }
    bar.style.left = `${Math.round(left)}px`;
    bar.style.top = `${Math.round(top)}px`;
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(check, DELAY);
}

function check() {
    timer = 0;
    if (pressing || busy || booting()) return;
    if (![...tools.values()].some(tool => tool.enabled())) { hideSelectionBar(); return; }
    const found = currentSelection();
    if (!found) { hideSelectionBar(); return; }
    const list = visibleTools(found);
    if (!list.length) { hideSelectionBar(); return; }
    held = found;
    ensureBar();
    renderButtons(list);
    for (const tool of list) tool.shown?.(found);
    place();
}

/** 스크롤 · 화면 크기 변화 때 자리만 다시 잡는다 (숨은 탭에서는 requestAnimationFrame 이 안 도니 타이머도 함께) */
function reposition() {
    if (!held || !bar || frame) return;
    frame = setTimeout(place, 16);
}

function take(tool) {
    const target = pending?.id === tool.id ? pending.target : held;
    const captured = pending?.id === tool.id ? pending.captured ?? safeCapture(tool, target) : safeCapture(tool, target);
    pending = null;
    pressing = false;
    clearTimeout(pressTimer);
    return { target, captured };
}

async function commit(tool) {
    if (busy) return;
    const { target, captured } = take(tool);
    hideSelectionBar();
    document.getSelection()?.removeAllRanges();
    if (!target || (tool.capture && !captured)) {
        toastr.warning('글을 다시 골라 주세요.', '', { timeOut: 1800 });
        return;
    }
    busy = true;
    try {
        await tool.run({ target, captured });
    } catch (error) {
        console.error(`[${tool.label}]`, error);
        toastr.error(error?.message || '하지 못했어요', tool.label);
    } finally {
        busy = false;
    }
}

/**
 * @param {{ id: string, order?: number, label: string, aria?: string, icon?: () => string, enabled: () => boolean,
 *   accepts?: (target) => boolean, shown?: (target) => void, capture?: (target) => any, run: (info) => Promise<void>|void }} tool
 */
export function registerSelectionTool(tool) {
    tools.set(tool.id, { order: 10, ...tool });
    if (bar) delete bar.dataset.tools;
    start();
    schedule();
}

/** 도구 설정이 바뀌었을 때 (끔 · 아이콘) — 지금 고른 글로 다시 본다 */
export function refreshSelectionBar() {
    if (bar) delete bar.dataset.tools;
    schedule();
}

function start() {
    if (started) return;
    started = true;
    ensureStyle();
    document.addEventListener('selectionchange', () => {
        // 보내기 칸에 글을 칠 때마다 오는 알림은 줄이 없으면 아무것도 하지 않는다
        if (!held && typingInField()) return;
        schedule();
    });
    document.getElementById('chat')?.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && bar && !bar.hidden) hideSelectionBar();
    });
}

// 줄 모양 — 북마크 애드온이 꺼져 있어도 같은 모양이어야 해서 이 모듈이 처음 쓸 때 넣는다 (시작 CSS 에 넣지 않는다)
// 알약 한 줄: 포인트 면 + 포인트 위 글자색. 단추 사이는 같은 글자색의 옅은 세로 선
const STYLE = `
.cg-select-chip { position: fixed; top: 0; left: 0; z-index: 4100; display: inline-flex; align-items: stretch; min-height: 36px; margin: 0; padding: 0; border: 0; border-radius: 999px; overflow: hidden;
  background: var(--salty-accent, var(--cg-accent, #a98bd9)); color: var(--salty-on-accent, var(--cg-accent-ink, #fff)); font-family: var(--salty-font-ui, inherit); font-size: 13px; font-weight: 600; line-height: 1;
  letter-spacing: 0; white-space: nowrap; box-shadow: 0 6px 18px rgba(0, 0, 0, .28); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; animation: cg-chip-in .16s ease-out; }
.cg-select-chip[hidden] { display: none; }
.cg-select-chip > .cg-select-act { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; margin: 0; padding: 0 14px 0 12px; border: 0; border-radius: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-shadow: none; box-shadow: none; cursor: pointer; }
.cg-select-chip > .cg-select-act:first-child { padding-left: 12px; }
.cg-select-chip > .cg-select-act > i { font-size: 12px; color: inherit; }
.cg-select-chip > .cg-select-sep { align-self: center; width: 1px; height: 16px; background: currentColor; opacity: .35; }
.cg-select-chip > .cg-select-act:focus-visible { outline: 2px solid currentColor; outline-offset: -4px; border-radius: 999px; }
@keyframes cg-chip-in { from { opacity: 0; transform: translateY(-4px) scale(.96); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .cg-select-chip { animation: none; } }
`;
function ensureStyle() {
    if (document.getElementById('cg-select-bar-style')) return;
    const style = document.createElement('style');
    style.id = 'cg-select-bar-style';
    style.textContent = STYLE;
    document.head.append(style);
}
