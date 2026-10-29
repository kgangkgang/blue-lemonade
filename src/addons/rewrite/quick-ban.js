// 1.9.0 — 채팅에서 낱말을 고르면(길게 눌러 선택 · 드래그) 그 옆에 작은 금지 칩이 뜬다. 누르면 그 말이 규칙이 된다.
// 설정 창을 열지 않고도 "이 말 그만"을 그 자리에서 — 규칙 이름 · 낱말은 고른 글 그대로, 설명은 core 가 프롬프트에 쓸 한 줄.
// 선택은 브라우저에 맡긴다(폰은 길게 누르면 낱말이 골라진다): 우리는 selectionchange 만 듣고, 칩은 선택 아래에 둔다(안드로이드 선택 메뉴는 위에 뜬다).
const MAX = 40;
let chip = null, timer = 0, current = '', onAdd = null, enabled = true, bound = false, canSelect = () => true;

// 8.2.5 입력칸(textarea · input · contenteditable)에 글자를 칠 때마다 selectionchange 가 오는데, 그때 Selection 을 읽으면(isCollapsed ·
// toString · getClientRects) 문서 전체 스타일 · 배치를 강제로 계산한다 — 페르소나 설명 50자에 2~3초(PC). 입력칸 안의 선택은 채팅 글이
// 아니라 칩이 뜰 일이 없으니 activeElement 만 보고 바로 돌아간다. (bookmarks/selection-chip.js · translator/selection 과 같은 규칙)
const TEXT_INPUT = /^(text|search|url|tel|email|password|number)$/;
export function typingInField(element = document.activeElement) {
    if (!element) return false;
    if (element.isContentEditable) return true;
    return element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && TEXT_INPUT.test(element.type));
}

function selectedText() {
    if (document.body.classList.contains('cg-previewing')) return null;
    if (typingInField()) return null;
    const selection = document.getSelection();
    // isCollapsed 대신 범위 하나의 collapsed — 배치 계산을 강제하지 않고 같은 답(6.4.5 번역 애드온과 같은 길)
    if (!selection || selection.rangeCount !== 1 || selection.getRangeAt(0).collapsed) return null;
    const range = selection.getRangeAt(0);
    const inside = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat .mes_text');
    const container = inside(range.startContainer);
    if (!container || container !== inside(range.endContainer)) return null;
    const translated = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('.translated_text');
    if (translated(range.startContainer) || translated(range.endContainer)) return null;
    // 앞뒤 따옴표 · 괄호 · 문장부호는 낱말이 아니다 (폰이 길게 눌러 고른 낱말에는 따옴표가 딸려 온다)
    const EDGE = /^[\s"'“”‘’「」『』()\[\]{}<>,.!?…:;~*_-]+|[\s"'“”‘’「」『』()\[\]{}<>,.!?…:;~*_-]+$/g;
    const text = selection.toString().replace(/\s+/g, ' ').trim().replace(EDGE, '');
    if (!text || text.length > MAX || /\n/.test(selection.toString().trim())) return null;
    if (!canSelect(container, text)) return null;
    const lines = [...range.getClientRects()].filter(r => r.width || r.height);
    return { text, rect: range.getBoundingClientRect(), lines };
}

/**
 * 7.0.2 폰의 선택 손잡이(물방울)는 고른 글의 끝 글자(한 줄이면 시작 글자도) 아래에 x±18 × 줄 아래 ~30px 로 매달린다.
 * 칩이 그 자리와 겹치면 손잡이에 가려 칩 대신 손잡이가 잡혔다 → 겹치면 손잡이 아래로 (북마크 칩 · 고른 글 지우기 칩과 같은 규칙). 순수
 */
export function chipGap({ coarse = false, lines = [], left = 0, width = 0 } = {}) {
    if (!coarse || !lines.length) return 8;
    const last = lines[lines.length - 1], first = lines[0];
    const handles = [last.right];
    if (Math.abs(first.top - last.top) <= 2) handles.push(Math.min(...lines.map(r => r.left)));
    return handles.some(x => left < x + 18 && left + width > x - 18) ? 30 : 8;
}
const coarse = () => !!globalThis.matchMedia?.('(pointer: coarse)')?.matches;

function hide() {
    if (chip) chip.hidden = true;
    current = '';
}

function show({ text, rect, lines = [] }) {
    if (!chip) {
        chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bwr_quickban';
        chip.innerHTML = '<i class="fa-solid fa-ban" aria-hidden="true"></i><span></span>';
        // pointerdown 에서 막아야 선택이 풀리기 전에 글을 잡는다 (click 은 선택이 이미 사라진 뒤 올 수 있다)
        chip.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
        chip.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation();
            if (!enabled || !current) return;
            const word = current;
            hide();
            document.getSelection()?.removeAllRanges();
            onAdd?.(word);
        });
        document.body.append(chip);
    }
    current = text;
    chip.querySelector('span').textContent = text.length > 18 ? text.slice(0, 17) + '…' : text;
    chip.hidden = false;
    // 선택 바로 아래, 화면 안에 — 폭은 그린 뒤에 재야 한다. 7.0.2 폰은 선택 손잡이 자리를 피한다 (chipGap)
    chip.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 48)}px`;
    chip.style.left = '0px';
    const width = chip.offsetWidth;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
    const bottom = lines.length ? lines[lines.length - 1].bottom : rect.bottom;
    const gap = chipGap({ coarse: coarse(), lines, left, width });
    chip.style.top = `${Math.min(bottom + gap, window.innerHeight - Math.max(48, chip.offsetHeight + 8))}px`;
    chip.style.left = `${left}px`;
}

function check() {
    if (!enabled) { hide(); return; }
    const found = selectedText();
    if (!found) { hide(); return; }
    // 편집 중인 글이나 입력칸 안의 선택은 아니다 (편집 칸은 .mes_text 가 아니라 textarea 라 위 검사에서 이미 빠진다)
    show(found);
}

/** 켠다. add(text) 는 규칙을 만들고 참/거짓(이미 있음)을 돌려준다. */
export function startQuickBan(add, allowSelection = () => true) {
    onAdd = add;
    canSelect = allowSelection;
    if (bound) return;
    bound = true;
    document.addEventListener('selectionchange', () => {
        clearTimeout(timer);
        if (!enabled) return;
        // 8.2.5 입력칸에 글을 치는 중 — 칩이 떠 있지 않으면 Selection 을 읽지 않고 끝 (떠 있으면 숨기기만)
        if (typingInField()) { if (current) hide(); return; }
        timer = setTimeout(check, 250);
    });
    // 스크롤하면 위치가 어긋나므로 숨긴다 (다시 고르면 다시 뜬다)
    document.getElementById('chat')?.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide);
}

export function setQuickBanEnabled(value) {
    enabled = value !== false;
    clearTimeout(timer);
    if (!enabled) hide();
}
