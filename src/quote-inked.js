// 1.7.4 이미 글자색 · 강조가 입혀진 구간 안의 따옴표 대사 — 대사 형광펜을 또 칠하지 않아요 (q.bl-q-inked, css/06-chat-text.css).
// 「흠 이미 글자색 들어갔는데 또 형광펜이 들어가네」: 인물색 속마음(<span data-tt><em>…『데이터 내놔』…</em></span>) 안의 『』 만 실리태번이 <q> 로
// 감싸서 대사 띠가 따로 칠해졌어요. 구간 = 기울임 · 굵게 · 형광펜(mark) · 글자색(font[color] · style 의 color · 속마음 data-tt).
// 그 구간에 대사 말고 다른 글(글자 · 숫자)이 있을 때만 — *『…』* 처럼 대사만 감싼 기울임, 프리셋이 대사만 감싼 인물색 font 는 그대로 대사예요.
// 줄 · 블록 · 대사(q) 에서 멈춰요: 대사 안의 대사는 바깥 대사 규칙(q q)이 맡아요.
// 조판(typography.js writeRoot)이 q 마다 부르고, 요소에서는 nodeName · parentElement · getAttribute · hasAttribute · className · textContent 만 읽어요 (계산 스타일 없음).
export const INKED = 'bl-q-inked';
const PASS = /^(EM|I|STRONG|B|MARK|FONT|SPAN|U|S|DEL|STRIKE|SMALL|SUB|SUP|A|ABBR|CITE|DFN|INS|BDI|TIME|DATA)$/;
const EMPHASIS = /^(EM|I|STRONG|B|MARK)$/;
const COLOR = /(^|;)\s*color\s*:/i;
const THOUGHT = /(^|\s)(custom-)?tt(\s|$)/;
const WORD = /[\p{L}\p{N}]/u;
const LIMIT = 8;   // 이만큼 위 조상까지만 (꾸밈이 몇 겹이어도 이 안)

function inks(el) {
    if (EMPHASIS.test(el.nodeName)) return true;
    if (el.nodeName === 'FONT' && el.getAttribute('color')) return true;
    if (COLOR.test(el.getAttribute('style') || '')) return true;
    return el.hasAttribute('data-tt') || THOUGHT.test(el.className || '');
}

/** q 가 이미 색 · 강조가 입혀진 구간(그 구간에 대사 말고 다른 글이 있다) 안인가. texts = 조상 글 캐시(Map, 한 번의 조판 안에서 같은 조상을 여러 q 가 볼 때) */
export function inkedQuote(q, texts = null) {
    const own = q.textContent;
    let a = q.parentElement;
    for (let n = 0; a && n < LIMIT; n++, a = a.parentElement) {
        if (!PASS.test(a.nodeName)) return false;
        if (!inks(a)) continue;
        let text = texts?.get(a);
        if (text === undefined) { text = a.textContent; texts?.set(a, text); }
        if (text.length > own.length && WORD.test(text.replace(own, ''))) return true;
    }
    return false;
}
