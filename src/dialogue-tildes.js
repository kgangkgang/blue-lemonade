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
    // 7.5.0 대사 안에서 글자 사이에 낀 ~~…~~ — 여는 쪽도 닫는 쪽도 양옆이 모두 글자 · 숫자(「아~~앗, 대・성・공~~이다!!」): 지우려고 쓴 글이 아니라 늘임표.
    //   띄어 쓰거나 따옴표 바로 뒤에서 여는 ~~지울 글~~ 은 그대로 취소선 (한 줄 안에서만)
    if (quoted && /^[\p{L}\p{N}]/u.test(content) && /[\p{L}\p{N}]$/u.test(content) && /^[\p{L}\p{N}]/u.test(after) && !/[\r\n]/.test(content)) return true;
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
// 버그 사냥 2: 대사 안인지를 <q> 조상으로만 보면, 실리태번이 q 로 안 감싸는 대사(줄을 넘는 대사 · 섞인 따옴표 — dialogue-span.js 가 나중에 감싸요)
//   안의 늘임표 「응~~~, 그래~~~!」 가 취소선으로 남았어요. 그 문단에서 del 앞까지 닫히지 않은 여는 따옴표가 있으면 대사 안으로 봐요.
const CLOSER = { '“': '”', '「': '」', '『': '』', '«': '»', '„': '“' };
import { foldBlank } from './blank-fold.js';   // 1.9.1 점자 빈칸 전수 2
const STRAIGHT = new Set(['"', '＂']);
const SCAN_MAX = 4000;   // 문단 앞쪽 이만큼까지만
export function quoteOpenedBefore(del) {
    const block = del.parentElement?.closest('p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6, .mes_text, .salty-sample');
    if (!block || !block.contains(del)) return false;
    // 통합 1.7.8: Range(createRange · setEndBefore) 없이 del 앞 글을 모아요 — 시험 · 가벼운 DOM(chat-switch-leak 의 가짜 문서)에는 Range 가 없어 설정 창 미리보기에서 멈췄어요
    let text = ''; let done = false;
    const walk = node => { for (const child of node.childNodes || []) { if (done) return; if (child === del) { done = true; return; } if (child.nodeType === 3) text += child.nodeValue || ''; else walk(child); } };
    walk(block); text = text.slice(-SCAN_MAX);
    const stack = [];
    for (const ch of text) {
        const top = stack.at(-1);
        // 버그 사냥 4: 모델이 「“…"」 · 「"…”」 처럼 굽은 따옴표와 곧은 따옴표를 섞어 닫으면 닫힘으로 못 봐 문단 끝까지 대사 안으로 봤어요(대사 밖 진짜 취소선이 물결로)
        if (stack.length && (ch === top || (top === '”' && STRAIGHT.has(ch)) || (STRAIGHT.has(top) && ch === '”'))) stack.pop();
        else if (CLOSER[ch]) stack.push(CLOSER[ch]);
        else if (STRAIGHT.has(ch)) stack.push(ch);
    }
    return stack.length > 0;
}
export const hasDialogueTildeSource =(raw, content) => typeof raw==='string' && !/<del\b/i.test(raw) && foldBlank(raw).includes(`~~${foldBlank(content)}~~`);   // 1.9.1 점자 빈칸 전수 2 — 원문 `⠀음` 과 화면 ` 음`
export function restoreDialogueTildes(root, { sourceText = displayedSource } = {}) {
    for (const del of root.querySelectorAll('.mes_text del, .salty-sample del')) {
        if (del.attributes.length || del.closest('pre, code')) continue;
        const before = del.previousSibling;
        const after = del.nextSibling;
        if (!textLike(before) || !textLike(after)) continue;
        if (!isDialogueElongation(before.textContent, del.textContent, after.textContent, !!del.closest('q') || quoteOpenedBefore(del))) continue;
        // HTML authored as <del> can produce the exact same DOM as Showdown's
        // whitespace bug. Only the displayed message source can disambiguate it.
        // 7.5.0 글자 사이에 낀 것(양옆이 글자)도 저장된 글에 ~~…~~ 가 있을 때만 (HTML <del> 로 적은 것과 구별)
        if (/^[\t \u3000]/u.test(del.textContent) || (/^[\p{L}\p{N}]/u.test(del.textContent) && /^[\p{L}\p{N}]/u.test(after.textContent))) {
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
