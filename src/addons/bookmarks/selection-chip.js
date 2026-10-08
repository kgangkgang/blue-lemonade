// 북마크 — 채팅에서 글을 고르면 그 아래에 뜨는 「북마크」 단추
// 안드로이드는 고른 글 위에 제 메뉴(복사 · 소리 내어 읽기)를 띄우므로 단추는 아래에 둔다. 위로 올리는 것은 아래에 자리가 없을 때만.
// 폰에서 단추를 누르면 그 순간 선택이 풀릴 수 있다 → 고를 때(selectionchange) 범위를 잡아 두고, 누르는 순간(pointerdown) 그 범위로 모양까지 떠 둔다.
// 다시 쓰기의 빠른 금지 칩(250ms) · LLM 번역의 고른 글 도구와 같이 뜰 수 있어 겹치면 옆으로 비킨다.
import { captureExcerpt } from './excerpt-capture.js';

const DELAY = 300;
const CHIP_ID = 'cg-select-chip';
const OBSTACLES = '.bwr_quickban:not([hidden]), #llmt-selection-selection';
const TEXT_INPUT = /^(text|search|url|tel|email|password|number)$/;

let chip = null;
let options = null;
let timer = 0;
let frame = 0;
let held = null;      // { range, root, index } — 지금 고른 글
let pending = null;   // 누르는 순간 떠 둔 모양 { target, excerpt }
let pressing = false;
let pressTimer = 0;
let busy = false;

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const textRoot = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat .mes_text') ?? null;

/** 초점이 채팅 밖의 글 입력칸이면 선택은 그 칸 안이다 — Selection 을 읽지 않는다 (글자 칠 때마다 스타일 계산을 하지 않게) */
function typingInField() {
    const element = document.activeElement;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && TEXT_INPUT.test(element.type));
}

/** 한 메시지의 화면 글(.mes_text) 안에서 고른 글이면 { range, root, index } */
function currentSelection() {
    if (typingInField()) return null;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const root = textRoot(range.startContainer);
    if (!root || root !== textRoot(range.endContainer)) return null;
    const mes = root.closest('.mes');
    if (!mes || mes.parentElement?.id !== 'chat') return null;
    // 고치는 중인 메시지는 화면 글이 아니라 편집 칸이다
    if (mes.querySelector('.edit_textarea')) return null;
    const index = Number.parseInt(mes.getAttribute('mesid') ?? '', 10);
    if (!Number.isInteger(index) || index < 0) return null;
    if (!selection.toString().trim()) return null;
    return { range: range.cloneRange(), root, index };
}

function ensureChip() {
    if (chip?.isConnected) return chip;
    chip = document.getElementById(CHIP_ID) ?? document.createElement('button');
    chip.id = CHIP_ID;
    chip.type = 'button';
    chip.className = 'cg-select-chip';
    chip.hidden = true;
    chip.setAttribute('aria-label', '고른 글 북마크');
    chip.innerHTML = '<i class="fa-solid fa-star" aria-hidden="true"></i><span>북마크</span>';
    // 누르는 순간 선택이 풀리기 전에(초점 이동 · 안드로이드 탭) 모양을 떠 둔다
    chip.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button > 0) return;
        pressing = true;
        clearTimeout(pressTimer);
        pending = held ? { target: held, excerpt: safeCapture(held) } : null;
    });
    for (const type of ['pointerup', 'pointercancel']) {
        chip.addEventListener(type, () => {
            clearTimeout(pressTimer);
            // click 이 뒤따라온다 — 그때까지 선택 확인이 단추를 숨기지 않게 조금 더 쥐고 있는다
            pressTimer = setTimeout(() => { pressing = false; pending = null; schedule(); }, 600);
        });
    }
    chip.addEventListener('contextmenu', event => event.preventDefault());
    chip.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        commit();
    });
    document.body.append(chip);
    return chip;
}

function safeCapture(target) {
    try {
        if (!target?.root?.isConnected || !target.range.startContainer.isConnected || !target.range.endContainer.isConnected) return null;
        return captureExcerpt(target.range, target.root);
    } catch (error) {
        console.warn('[북마크] 고른 글을 읽지 못했습니다:', error);
        return null;
    }
}

export function hideSelectionChip({ forget = true } = {}) {
    clearTimeout(timer);
    timer = 0;
    if (chip) chip.hidden = true;
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
    if (!held || !chip) return;
    const rects = rectsOf(held.range);
    const chat = document.getElementById('chat')?.getBoundingClientRect();
    if (!rects.length || !held.root.isConnected) { hideSelectionChip(); return; }
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    const lastLine = rects.filter(rect => rect.bottom >= bottom - 2);
    const lastTop = Math.min(...lastLine.map(rect => rect.top));
    const line = { left: Math.min(...lastLine.map(rect => rect.left)), right: Math.max(...lastLine.map(rect => rect.right)), top: lastTop, bottom };
    const firstTop = Math.min(...rects.map(rect => rect.top));
    // 고른 글이 채팅 칸 밖으로 스크롤되면 숨긴다 (다시 들어오면 다시 보인다)
    if (chat && (line.bottom < chat.top + 4 || firstTop > chat.bottom - 4)) { chip.hidden = true; return; }

    const viewport = window.visualViewport;
    const viewTop = (viewport?.offsetTop ?? 0) + 8;
    const viewLeft = (viewport?.offsetLeft ?? 0) + 8;
    const viewBottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 8;
    const viewRight = (viewport ? viewport.offsetLeft + viewport.width : window.innerWidth) - 8;
    const form = document.getElementById('send_form')?.getBoundingClientRect();
    const floor = form && form.height > 0 && form.top > viewTop + 60 ? Math.min(viewBottom, form.top - 8) : viewBottom;
    const ceiling = Math.max(viewTop, chat ? chat.top + 4 : viewTop);

    const wasHidden = chip.hidden;
    chip.hidden = false;
    if (wasHidden) {
        const icon = options?.iconName?.() ?? 'fa-star';
        const i = chip.querySelector('i');
        if (i && !i.classList.contains(icon)) { i.classList.remove('fa-star', 'fa-bookmark'); i.classList.add(icon); }
    }
    const width = chip.offsetWidth;
    const height = chip.offsetHeight;
    let left = Math.min(Math.max((line.left + line.right) / 2 - width / 2, viewLeft), viewRight - width);
    // 폰의 선택 손잡이(물방울)는 시작 · 끝 글자 아래에 매달린다 — 단추가 그 자리와 겹치면 손잡이 아래로 내린다
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
    chip.style.left = `${Math.round(left)}px`;
    chip.style.top = `${Math.round(top)}px`;
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(check, DELAY);
}

function check() {
    timer = 0;
    if (pressing || busy) return;
    if (!options?.enabled?.()) { hideSelectionChip(); return; }
    const found = currentSelection();
    if (!found) { hideSelectionChip(); return; }
    held = found;
    ensureChip();
    place();
}

/** 스크롤 · 화면 크기 변화 때 자리만 다시 잡는다 (숨은 탭에서는 requestAnimationFrame 이 안 도니 타이머도 함께) */
function reposition() {
    if (!held || !chip || frame) return;
    frame = setTimeout(place, 16);
}

async function commit() {
    if (busy) return;
    const target = pending?.target ?? held;
    const excerpt = pending?.excerpt ?? safeCapture(target);
    pending = null;
    pressing = false;
    clearTimeout(pressTimer);
    hideSelectionChip();
    document.getSelection()?.removeAllRanges();
    if (!target || !excerpt) {
        toastr.warning('글을 다시 골라 주세요.', '', { timeOut: 1800 });
        return;
    }
    busy = true;
    try {
        await options?.onBookmark?.({ index: target.index, root: target.root, excerpt });
    } finally {
        busy = false;
    }
}

/**
 * @param {{ enabled: () => boolean, iconName: () => string, onBookmark: (info: { index: number, root: Element, excerpt: object }) => Promise<void> }} config
 */
export function startSelectionChip(config) {
    if (options) { options = config; return; }
    options = config;
    document.addEventListener('selectionchange', () => {
        // 보내기 칸에 글을 칠 때마다 오는 알림은 단추가 없으면 아무것도 하지 않는다
        if (!held && typingInField()) return;
        schedule();
    });
    document.getElementById('chat')?.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && chip && !chip.hidden) hideSelectionChip();
    });
}
