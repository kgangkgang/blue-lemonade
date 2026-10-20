// Showdown treats two sentence-ending elongations as a deletion pair.
// Repair only that punctuation pattern; keep ordinary deletion markup intact.
const repairs = new Map();
// 옆이 글 속 요소여도(다른 확장의 형광펜 <mark> · 실리태번 '스트리밍 페이드 인'의 낱말 칸 span · 강조) 그 글자로 본다
const INLINE = /^(MARK|SPAN|FONT|EM|STRONG|I|B|U)$/;
const textLike = node => node?.nodeType === 3 || (node?.nodeType === 1 && INLINE.test(node.nodeName));
// A deletion opener cannot start with whitespace. Showdown nevertheless pairs
// the suffixes in speech such as "어~~ 음~~" and turns the second sound into del.
// Limit this repair to quoted dialogue; ordinary ~~deleted words~~ stays del.
export function isDialogueElongation(before, content, after, quoted = false) {
    if (!/[\p{L}\p{N}]$/u.test(before)) return false;
    // 7.4.7 GFM 규칙: 글자 바로 뒤의 ~~ 는 그 뒤가 문장 부호 · 기호(물결 셋 이상의 남은 ~ 포함)면 취소선을 열지 못한다 —
    //   「응~~~, 그래~~~!」 에서 Showdown 이 「~, 그래」 를 del 로 만들어 글자가 흐려지던 것 (대사 안에서만 · 한 줄 안)
    if (quoted && /^[\p{P}\p{S}]/u.test(content) && !/^[!！?？]/u.test(content) && !/[\r\n]/.test(content) && /\S$/u.test(content)) return true;
    if (!/[\p{L}\p{N}]$/u.test(content)) return false;
    if (/^[!！?？]/u.test(content) && /^[!！?？]/u.test(after)) return true;
    return quoted && /^[\t \u3000]+\p{L}/u.test(content) && !/[\r\n]/.test(content)
        && /^(?:[\t \u3000]|["'”’」』»＂!！?？.,。…]|$)/u.test(after);
}
function displayedSource(node) {
    const messageNode=node.closest('.mes[mesid]');
    if(!messageNode)return null;
    const message=globalThis.SillyTavern?.getContext?.()?.chat?.[Number(messageNode.getAttribute('mesid'))];
    if(!message)return null;
    return typeof message.extra?.display_text==='string' && message.extra.display_text.trim() ? message.extra.display_text : message.mes;
}
export const hasDialogueTildeSource = (raw, content) => typeof raw==='string' && !/<del\b/i.test(raw) && raw.includes(`~~${content}~~`);
export function restoreDialogueTildes(root, { sourceText = displayedSource } = {}) {
    for (const del of root.querySelectorAll('.mes_text del, .salty-sample del')) {
        if (del.attributes.length || del.closest('pre, code')) continue;
        const before = del.previousSibling;
        const after = del.nextSibling;
        if (!textLike(before) || !textLike(after)) continue;
        if (!isDialogueElongation(before.textContent, del.textContent, after.textContent, !!del.closest('q'))) continue;
        // HTML authored as <del> can produce the exact same DOM as Showdown's
        // whitespace bug. Only the displayed message source can disambiguate it.
        if (/^[\t \u3000]/u.test(del.textContent)) {
            const raw=typeof sourceText==='function'?sourceText(del):sourceText;
            if(!hasDialogueTildeSource(raw,del.textContent))continue;
        }
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
