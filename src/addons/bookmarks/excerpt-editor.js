// 북마크 — 발췌 고치기 (1.4.6). 담아 둔 모양(대사 색 · 형광펜 띠 · 기울기 · 굵기)을 그대로 보여 주는 편집 칸에서 글을 고친다.
// 저장할 때는 편집 칸을 글 조각으로 다시 읽어 고를 때와 같은 다듬기(excerpts.js packExcerpt)를 거친다 —
// 브라우저가 고치며 넣는 div · b · i · font 는 p · span style 로 바뀌고, 허용하지 않은 모양은 빠진다. 붙여 넣기는 글만.
// 색 글을 통째로 바꿔 치면 크롬이 <font color> 로 다시 감싸며 형광펜 띠(background-image)를 버린다 → 그 색의 처음 띠를 다시 입힌다.
import { openSheet } from './ui-kit.js';
import { escapeHtml, sanitizeExcerptHtml } from './render.js';
import { excerptList, packExcerpt, styleObject, isCssColor } from './excerpts.js';
import { bookmarkMessage, editExcerptIn, removeExcerptFrom } from './data.js';

const HINT = '색은 그대로 남아요. 비우고 저장하면 이 발췌를 지워요. Ctrl+Enter로 저장.';
const BLOCK = /^(P|DIV|LI|BLOCKQUOTE|H[1-6]|PRE|UL|OL|SECTION|ARTICLE)$/;
const ZWSP = /\u200b/g;
const TAG_STYLE = {
    B: { 'font-weight': '700' },
    STRONG: { 'font-weight': '700' },
    I: { 'font-style': 'italic' },
    EM: { 'font-style': 'italic' },
    U: { 'text-decoration-line': 'underline' },
    INS: { 'text-decoration-line': 'underline' },
    S: { 'text-decoration-line': 'line-through' },
    STRIKE: { 'text-decoration-line': 'line-through' },
    DEL: { 'text-decoration-line': 'line-through' },
};

/** 편집 칸 → 글 조각 [{ text, style } | { br } | { p }]. 모양은 글을 감싼 요소들의 인라인 style · 태그에서 (가까운 것이 이긴다) */
export function readEditedPieces(root) {
    const pieces = [];
    let lastBlock = null;
    const blockOf = (node) => {
        for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
            if (BLOCK.test(element.tagName)) return element;
        }
        return root;
    };
    const styleOf = (node) => {
        const style = {};
        for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
            const own = { ...(TAG_STYLE[element.tagName] ?? {}), ...styleObject(element.getAttribute('style')) };
            const fontColor = element.tagName === 'FONT' ? element.getAttribute('color') : null;
            if (fontColor && isCssColor(fontColor) && !own.color) own.color = fontColor.trim();
            for (const [name, value] of Object.entries(own)) if (!(name in style)) style[name] = value;
        }
        return style;
    };
    const view = root.ownerDocument.defaultView;
    const walker = root.ownerDocument.createTreeWalker(root, view.NodeFilter.SHOW_TEXT | view.NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === 1) {
            if (node.tagName === 'BR') pieces.push({ br: true });
            continue;
        }
        // 편집 칸은 겹친 빈칸 · 줄 끝 빈칸을 &nbsp; 로 넣는다 · 빈 글자(ZWSP)는 처음 자리 잡기용 (caretToEnd)
        const text = node.data.replace(ZWSP, '').replace(/\u00a0/g, ' ').replace(/[ \t\r\n\f]+/g, ' ');
        if (!text) continue;
        const block = blockOf(node);
        if (lastBlock && block !== lastBlock) pieces.push({ p: true });
        lastBlock = block;
        pieces.push({ text, style: styleOf(node) });
    }
    return pieces;
}

/** 색 값을 한 모양으로 (#f5f5f7 · rgb(245,245,247) → 'rgb(245, 245, 247)'). 모르는 값이면 '' */
function colorKey(value, doc) {
    const probe = doc.createElement('span');
    probe.style.color = String(value ?? '').trim();
    return probe.style.color;
}

const ownColor = element => element.style?.color || (element.tagName === 'FONT' ? colorKey(element.getAttribute('color'), element.ownerDocument) : '');

/** 처음 모양에서 색마다 형광펜 띠. 같은 색이 띠 있는 곳 · 없는 곳에 섞여 있으면 그 색은 건드리지 않는다 (null) */
function bandsByColor(root) {
    const bands = new Map();
    for (const element of root.querySelectorAll('*')) {
        const color = ownColor(element);
        if (!color) continue;
        const band = element.style.backgroundImage || '';
        if (!bands.has(color)) bands.set(color, band);
        else if (bands.get(color) !== band) bands.set(color, null);
    }
    return bands;
}

/** 띠가 빠진 색 글(크롬이 다시 감싼 <font color> · span)에 그 색의 처음 띠를 다시 입힌다. 글은 건드리지 않아 커서도 그대로 */
function restoreBands(root, bands) {
    for (const element of root.querySelectorAll('font[color], [style*="color"]')) {
        const band = bands.get(ownColor(element));
        if (!band || element.style.backgroundImage || element.style.backgroundColor) continue;
        let banded = false;
        for (let up = element.parentElement; up && up !== root; up = up.parentElement) {
            if (up.style?.backgroundImage) { banded = true; break; }
        }
        if (!banded) element.style.backgroundImage = band;
    }
}

/**
 * 처음 자리 = 글 끝. 끝이 색 글(대사)이면 이어 치는 지문이 그 색을 따라가지 않게 마지막 문단 끝에 빈 글자(ZWSP)를 두고 그 뒤에 선다.
 * (저장할 때 빈 글자는 빠진다) @returns {Text|null} 그 빈 글자 노드 (없으면 null)
 */
function caretToEnd(element) {
    const doc = element.ownerDocument;
    const selection = doc.getSelection();
    if (!selection) return null;
    let gap = null;
    const range = doc.createRange();
    const last = element.lastElementChild;
    const block = last && BLOCK.test(last.tagName) ? last : element;
    const tail = block.lastChild;
    if (tail?.nodeType === 1 && tail.tagName !== 'BR') {
        gap = doc.createTextNode('\u200b');
        block.append(gap);
        range.setStart(gap, 1);
        range.collapse(true);
    } else {
        range.selectNodeContents(block);
        range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    return gap;
}

/** 커서가 처음 둔 빈 글자 바로 뒤에 그대로 있으면 그 빈 글자를 치우고 커서를 같은 자리(색 글 바로 뒤)에 둔다 */
function dropGap(gap, doc) {
    const selection = doc.getSelection();
    if (!gap?.isConnected || gap.data !== '\u200b' || !selection?.isCollapsed || selection.anchorNode !== gap) return false;
    const parent = gap.parentNode;
    const index = Array.prototype.indexOf.call(parent.childNodes, gap);
    gap.remove();
    const range = doc.createRange();
    range.setStart(parent, index);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

/** 붙여 넣은 글: 빈 줄은 문단, 한 줄 바꿈은 줄바꿈 (insertText 에 \n 을 그대로 주면 줄마다 문단이 된다) */
function insertPlainText(doc, text) {
    text.replace(/\r\n?/g, '\n').split(/\n{2,}/).forEach((block, i) => {
        if (i) doc.execCommand('insertParagraph');
        block.split('\n').forEach((line, j) => {
            if (j) doc.execCommand('insertLineBreak');
            if (line) doc.execCommand('insertText', false, line);
        });
    });
}

/**
 * 발췌 고치기 창. 비우고 저장하면 그 발췌를 지운다. 아무것도 안 고치고 저장하면 그대로 둔다.
 * @returns {Promise<boolean>} 카드를 다시 그려야 하면 true (바꿈 · 지움 · 그사이 바뀐 자료)
 */
export async function openExcerptEditor(record, fav, excerptId) {
    const item = excerptList(fav).find(entry => String(entry.id) === String(excerptId));
    if (!item) {
        toastr.error('발췌를 찾을 수 없습니다. 그사이 지워졌을 수 있어요.', '북마크');
        return true; // 카드가 옛 자료를 보이는 중 — 다시 그린다
    }
    const message = bookmarkMessage(record, fav);
    const tone = item.tone === 'dark' || item.tone === 'light' ? ` data-tone="${item.tone}"` : '';
    const ink = isCssColor(item.ink) ? ` style="--cg-ex-ink:${escapeHtml(item.ink.trim())}"` : '';
    const wrapper = document.createElement('div');
    wrapper.className = 'cg-editor';
    wrapper.innerHTML = `
        <div class="cg-excerpt cg-excerpt--edit"${tone}${ink}>
            <div class="cg-excerpt-text" contenteditable="true" role="textbox" aria-multiline="true" aria-label="발췌" spellcheck="false"></div>
        </div>
        <p class="cg-hint">${HINT}</p>`;
    const editor = wrapper.querySelector('[contenteditable]');
    editor.innerHTML = sanitizeExcerptHtml(item.html) || `<p>${escapeHtml(item.text).replace(/\n/g, '<br>')}</p>`;
    const bands = bandsByColor(editor);
    // 저장 모양이 고를 때와 조금 달라도(예전 자료 · 글만 있는 발췌) 손대지 않았으면 다시 쓰지 않는다
    const baseline = packExcerpt(readEditedPieces(editor));

    let result = null; // { text, html } · 'remove'
    const read = () => {
        restoreBands(editor, bands);
        const packed = packExcerpt(readEditedPieces(editor));
        if (!packed) result = 'remove';
        else result = baseline && packed.text === baseline.text && packed.html === baseline.html ? null : packed;
    };
    const sheet = openSheet({
        title: '발췌 고치기',
        subtitle: `${message?.name ?? fav.sender ?? ''} · #${fav.messageId}`,
        icon: 'fa-quote-left',
        body: wrapper,
        dismissOnBackdrop: false,
        actions: [
            { label: '취소', kind: 'ghost' },
            { label: '저장', kind: 'primary', icon: 'fa-check', onClick: read },
        ],
    });
    let closed = false;
    let gap = null; // caretToEnd 의 빈 글자 — 처음 한 번만 쓴다
    sheet.closed.then(() => { closed = true; });
    editor.addEventListener('keydown', (event) => {
        // ← 를 처음 누르면 빈 글자만 건너가 제자리처럼 보인다 → 빈 글자를 치우고 키는 그대로
        if (gap && event.key === 'ArrowLeft' && !event.isComposing && dropGap(gap, document)) gap = null;
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.stopPropagation(); // 실리태번의 Ctrl+Enter(마지막 답 다시 생성)까지 가지 않게
            read();
            sheet.close('saved');
        }
    });
    // 처음 지우기가 빈 글자만 지우면 아무 일 없는 것처럼 보인다 → 빈 글자를 치우고 그 앞 글자를 지운다.
    // (취소할 수 없는 지우기 — 일부 안드로이드 키보드 — 는 건드리지 않는다: 그때는 한 번 더 누르면 된다)
    editor.addEventListener('beforeinput', (event) => {
        if (!gap) return;
        // 치고 지운 뒤에도 빈 글자만 남으면 다시 같은 처지다 — 노드가 남아 있는 한 기억해 두고, 빈 글자만인지는 dropGap 이 본다
        if (!gap.isConnected) { gap = null; return; }
        if (event.inputType !== 'deleteContentBackward' || !event.cancelable || event.isComposing) return;
        if (!dropGap(gap, document)) return;
        gap = null;
        event.preventDefault();
        document.execCommand('delete');
    });
    // 띠가 빠지는 순간 바로 되살린다 (한글 조합 중에는 건드리지 않고 조합이 끝난 뒤에)
    editor.addEventListener('input', (event) => { if (!event.isComposing) restoreBands(editor, bands); });
    editor.addEventListener('compositionend', () => restoreBands(editor, bands));
    // 다른 곳의 모양(글꼴 · 크기 · 링크)이 따라 들어오지 않게 글만 붙인다
    editor.addEventListener('paste', (event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (text) insertPlainText(document, text);
    });
    editor.addEventListener('drop', event => event.preventDefault());
    // 모바일에서 키보드가 올라오며 창이 흔들리지 않도록 애니메이션 뒤에 초점을 준다 (메모 창과 같다)
    setTimeout(() => {
        if (closed || !editor.isConnected) return;
        editor.focus({ preventScroll: true });
        gap = caretToEnd(editor);
    }, 220);
    await sheet.closed;
    if (!result) return false;
    try {
        if (result === 'remove') {
            const removed = await removeExcerptFrom(record, fav.id, item.id);
            if (removed) toastr.success('발췌를 지웠어요.', '북마크', { timeOut: 1800 });
            return removed;
        }
        return await editExcerptIn(record, fav.id, item.id, result);
    } catch (error) {
        toastr.error(error.message, '북마크');
        return true; // 그사이 지워졌거나 바뀐 자료(다른 채팅은 최신본을 받아 옴)를 카드에 다시 그린다
    }
}
