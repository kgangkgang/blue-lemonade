// Showdown treats two sentence-ending elongations as a deletion pair.
// Repair only that punctuation pattern; keep ordinary deletion markup intact.
const repairs = new Map();
// 옆이 글 속 요소여도(다른 확장의 형광펜 <mark> · 실리태번 '스트리밍 페이드 인'의 낱말 칸 span · 강조) 그 글자로 본다
const INLINE = /^(MARK|SPAN|FONT|EM|STRONG|I|B|U)$/;
const textLike = node => node?.nodeType === 3 || (node?.nodeType === 1 && INLINE.test(node.nodeName));
export function restoreDialogueTildes(root) {
    for (const del of root.querySelectorAll('.mes_text del, .salty-sample del')) {
        if (del.attributes.length || del.closest('pre, code')) continue;
        const before = del.previousSibling;
        const after = del.nextSibling;
        if (!textLike(before) || !textLike(after)) continue;
        if (!/[\p{L}\p{N}]$/u.test(before.textContent) ||
            !/^[!！?？]/u.test(del.textContent) ||
            !/[\p{L}\p{N}]$/u.test(del.textContent) ||
            !/^[!！?？]/u.test(after.textContent)) continue;
        const span = document.createElement('span');
        span.className = 'bl-dialogue-tildes';
        span.append(document.createTextNode('~~'), ...del.childNodes, document.createTextNode('~~'));
        repairs.set(span, del);
        del.replaceWith(span);
    }
    for (const span of repairs.keys()) if (!span.isConnected) repairs.delete(span);
}
export function resetDialogueTildes() {
    for (const [span, del] of repairs) {
        if (!span.isConnected) continue;
        del.replaceChildren(...Array.from(span.childNodes).slice(1, -1));
        span.replaceWith(del);
    }
    repairs.clear();
}
