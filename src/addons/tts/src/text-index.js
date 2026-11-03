// 1.0.0 극한 최적화: 대사 클릭(clickplay.js)에서 떼어 낸 순수 글 도구 — 글자 노드 잇기(textIndex) · 대화문 짝 찾기(scanDialogue) · 데우스 맨 색 표기 ·
//   북마크 미리보기 판정(previewing). 화자 색(paint.js)이 부팅 때 재생기 · 분석 묶음 없이 쓰게. 동작은 clickplay.js 에 있던 그대로이고 clickplay.js 가 다시 내보내요
// 7.0.2 북마크 「채팅에서 미리보기」: 화면에는 다른 채팅이 그려져 있지만 chat[] 은 지금 채팅이라 mesid → chat[mesid] 가 엉뚱한 메시지 — 그동안은 손대지 않는다
export const previewing = () => !!globalThis.document?.body?.classList?.contains('cg-previewing');
// 대화문 여닫이 글자 (text.js 와 같은 짝 + „“). ASCII ' 는 안 씀
export const CLOSER = { '“': '”', '"': '"', '「': '」', '『': '』', '«': '»', '＂': '＂', '‘': '’', '„': '“' };
export const ONE_LINE = new Set(['"', '＂']); // 좌우 같은 모양 → 한 줄 안에서만 짝을 찾음
export const LETTER = /[\p{L}\p{N}]/u;
export const HEX_BEFORE = /(?:^|\s)#([0-9a-fA-F]{6})[ \t]*$/;                 // 데우스 맨 색 표기  #e63946 "…"
// 글자를 세지 않는 요소 (그 안의 글은 대화문 짝 찾기에 넣지 않음)
export const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'BUTTON', 'SELECT', 'INPUT', 'DETAILS', 'SVG']);
// 줄을 나누는 블록 요소 (앞에 문단 경계를 넣음)
export const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'TR', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'MAIN', 'FIGURE', 'FIGCAPTION']);
export const SHOW_ELEMENT_AND_TEXT = 0x1 | 0x4;   // NodeFilter.SHOW_ELEMENT | SHOW_TEXT
export const FILTER_ACCEPT = 1, FILTER_REJECT = 2;
export function isHidden(el) {
    if (el.hidden === true || el.style?.display === 'none') return true;
    if (typeof getComputedStyle === 'function') { try { return getComputedStyle(el).display === 'none'; } catch { /* 떨어진 요소 */ } }
    return false;
}
// ---------- 글자 노드 이어 붙이기 (문단 경계 '\n\n' · <br> '\n')
// computed=false (6.2.3 화자 색 · paint.js): 숨김은 hidden 속성 · 인라인 display:none 만 본다 — getComputedStyle 이 다시 그린 직후의 스타일 계산을 앞당기지 않게
export function textIndex(root, { computed = true } = {}) {
    const nodes = [];
    let flat = '';
    const hidden = computed ? isHidden : (el) => !!el.hidden || el.style?.display === 'none';
    const walker = document.createTreeWalker(root, SHOW_ELEMENT_AND_TEXT, (n) => (n.nodeType === 1 && (SKIP_TAGS.has(n.tagName) || hidden(n)) ? FILTER_REJECT : FILTER_ACCEPT));
    for (let n; (n = walker.nextNode());) {
        if (n.nodeType === 1) {
            if (n.tagName === 'BR') flat += '\n';
            else if (BLOCK_TAGS.has(n.tagName) && flat && !flat.endsWith('\n\n')) flat += flat.endsWith('\n') ? '\n' : '\n\n';
            continue;
        }
        if (n.nodeType !== 3) continue;
        nodes.push({ node: n, start: flat.length });
        flat += String(n.nodeValue || '');
    }
    return { nodes, flat };
}
// ---------- 대화문 짝 찾기 (text.js scanDialogue 와 같은 규칙, 다 온 글 기준)
export function paraEnd(s, from) {
    const re = /\n[ \t]*\n/g;
    re.lastIndex = from;
    const m = re.exec(s);
    return m ? m.index : -1;
}
export function findCloser(s, closer, from, to) {
    for (let k = s.indexOf(closer, from); k >= 0 && k < to; k = s.indexOf(closer, k + 1)) {
        if (closer === '’' && LETTER.test(s[k + 1] || '')) continue; // don’t 의 ’ 는 닫는 글자가 아님
        return k;
    }
    return -1;
}
export function scanDialogue(body) {
    const out = [], n = body.length;
    let i = 0;
    while (i < n) {
        const ch = body[i], closer = CLOSER[ch];
        if (!closer || (ch === '‘' && LETTER.test(body[i - 1] || ''))) { i++; continue; }
        const oneLine = ONE_LINE.has(ch);
        let bound = oneLine ? body.indexOf('\n', i) : paraEnd(body, i);
        if (bound < 0) bound = n;
        const j = findCloser(body, closer, i + 1, bound);
        if (j >= 0) { out.push({ start: i, end: j + 1, is: i + 1, ie: j, opener: ch }); i = j + 1; continue; }
        if (!/\S/.test(body.slice(bound))) { out.push({ start: i, end: n, is: i + 1, ie: n, opener: ch }); break; } // 글 끝에서 안 닫힘
        if (oneLine) { i++; continue; }
        out.push({ start: i, end: bound, is: i + 1, ie: bound, opener: ch }); // 여러 문단 대화의 첫 문단
        i = bound;
    }
    return out;
}
export function colorFromBareHex(flat, start) {
    const m = HEX_BEFORE.exec(flat.slice(Math.max(0, start - 12), start));
    return m ? `#${m[1].toLowerCase()}` : null;
}
