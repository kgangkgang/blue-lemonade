// 6.4.5 고른 범위 다듬기 — 북마크 단추(bookmarks/selection-chip.js) · 고른 글 지우기(translator/selection/delete.js)가 함께 쓴다.
// 세 번 클릭(문단 고르기)은 브라우저가 끝을 다음 블록 앞(<p>@0 · 다음 접기 칸 summary@0 · 다음 메시지 이름)까지 늘린다.
// 범위를 실제로 한 글자 이상(공백 말고) 겹치는 텍스트 노드의 경계로 줄인다: 끝이 요소 경계 · 텍스트 노드 offset 0 이면 앞쪽 마지막 텍스트 노드 끝으로,
// 시작이 노드 끝이면 다음 텍스트 노드 처음으로. 앞에서 첫 겹친 글자, 뒤에서 마지막 겹친 글자만 찾는다 —
// 사이 노드는 보지 않는다 (긴 메시지 · 채팅 전체를 골라도 글자 노드마다 checkVisibility 를 부르지 않게).
// 화면에 그려지지 않는 글자(display:none · 닫힌 접기 칸 속 같은 것)는 고른 글이 아니다.
// trimToRoot: 메시지의 마지막 문단을 세 번 클릭하면 끝이 다음 메시지 앞까지 가며 그 메시지의 스와이프 숫자(1/1) 같은 글자를 지난다 →
// 세 번 클릭의 꼴(끝이 요소 경계 · 글자 노드 처음)일 때만 메시지 글 안으로 줄인다. 끌어서 다른 메시지 글까지 고르면 그대로 — 부르는 쪽이 거절한다.
// 끝이 요소 경계여도 다듬은 끝이 다른 메시지 글 안이면(다음 메시지 문단 끝 그림 오른쪽에서 놓은 끌기) 그 글이 실제로 골라진 것이다 — 줄이지 않는다.
// 세 번 클릭이 늘린 끝은 다음 메시지의 이름 · 스와이프 숫자 같은 메시지 글 밖에 놓인다.

/**
 * @param {Range} range
 * @param {{ skip?: (node: Text) => boolean }} [options] skip: 고른 글에서 뺄 노드 (예: 렌더되지 않는 칸)
 * @returns {Range|null} 겹치는 글이 없으면 null
 */
export function trimRange(range, { skip = null } = {}) {
    if (!range) return null;
    const doc = range.startContainer?.ownerDocument ?? globalThis.document;
    const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_TEXT);
    // 앞에서: 시작 경계 뒤 첫 겹친 글자 (끝 경계를 지나면 없음)
    let first = null;
    for (let node = firstFrom(walker, range); node; node = walker.nextNode()) {
        if (range.comparePoint(node, 0) > 0) break;            // 끝 경계를 지남
        const cut = overlap(range, node, skip);
        if (cut) { first = { node, s: cut[0] }; break; }
    }
    if (!first) return null;
    // 뒤에서: 끝 경계 앞 마지막 겹친 글자 (first 가 겹치므로 늦어도 거기서 멈춘다)
    let last = null;
    for (let node = lastFrom(walker, range); node; node = walker.previousNode()) {
        if (range.comparePoint(node, node.length) < 0) break;  // 시작 경계 앞
        const cut = overlap(range, node, skip);
        if (cut) { last = { node, e: cut[1] }; break; }
    }
    if (!last) return null;
    const out = doc.createRange();
    out.setStart(first.node, first.s);
    out.setEnd(last.node, last.e);
    return out;
}

/** 세 번 클릭(문단 고르기)이 놓는 끝의 꼴: 요소 경계이거나 글자 노드 처음 (끌어서 고르면 보통 글자 가운데) */
export const paragraphEnd = range => range.endContainer.nodeType !== 3 || range.endOffset === 0;

/**
 * trimRange + 세 번 클릭이 늘린 끝이 그 글(rootOf 가 돌려주는 요소 — 예: 메시지 글 .mes_text) 밖이면 그 글 끝까지로
 * @param {Range} picked 고른 범위 그대로
 * @param {(node: Node) => Element|null} rootOf
 * @param {{ skip?: (node: Text) => boolean }} [options]
 * @returns {Range|null}
 */
export function trimToRoot(picked, rootOf, options) {
    const range = trimRange(picked, options);
    if (!range) return null;
    const root = rootOf(range.startContainer), endRoot = rootOf(range.endContainer);
    if (!root || endRoot || !paragraphEnd(picked)) return range;   // 같은 글 안이거나, 끝이 다른 메시지 글 안 = 끌어서 고른 것
    const inner = range.cloneRange();
    inner.setEnd(root, root.childNodes.length);
    return trimRange(inner, options) ?? range;
}

/** node 가 range 와 공백 말고 한 글자 이상 겹치고, 빼지 않고, 그려지면 [s, e] (싼 검사부터) */
function overlap(range, node, skip) {
    if (!range.intersectsNode(node)) return null;
    const s = node === range.startContainer ? range.startOffset : 0;
    const e = node === range.endContainer ? range.endOffset : node.length;
    if (e <= s || !node.data.slice(s, e).trim() || skip?.(node) || !rendered(node)) return null;
    return [s, e];
}

/** 시작 경계 뒤 첫 텍스트 노드 (시작이 텍스트 노드면 그 노드) */
function firstFrom(walker, range) {
    const container = range.startContainer;
    if (container.nodeType === 3) { walker.currentNode = container; return container; }
    const child = container.childNodes[range.startOffset];
    if (child) { walker.currentNode = child; return child.nodeType === 3 ? child : walker.nextNode(); }
    walker.currentNode = container;
    return nextAfter(walker, container);
}

/** 끝 경계 앞 마지막 텍스트 노드 (끝이 텍스트 노드면 그 노드) */
function lastFrom(walker, range) {
    const container = range.endContainer;
    if (container.nodeType === 3) { walker.currentNode = container; return container; }
    let after = container.childNodes[range.endOffset] ?? null;   // 경계 바로 뒤 노드 — 그 앞이 경계 앞 글
    if (!after) { let node = container; while (node && !node.nextSibling) node = node.parentNode; after = node?.nextSibling ?? null; }
    if (after) { walker.currentNode = after; return walker.previousNode(); }
    let node = walker.root;                                       // 경계 뒤에 아무것도 없음 → 맨 끝 글부터
    while (node.lastChild) node = node.lastChild;
    walker.currentNode = node;
    return node.nodeType === 3 ? node : walker.previousNode();
}

/** 화면에 그려지는 글자인가 (checkVisibility 가 없는 곳은 그려진다고 본다).
 *  display:contents 요소는 상자가 없어 checkVisibility 가 늘 거짓이다 — 상자가 있는 가장 가까운 조상으로 본다 (그 안 글은 그려진다) */
function rendered(node) {
    let element = node.parentElement;
    while (element?.parentElement && globalThis.getComputedStyle?.(element)?.display === 'contents') element = element.parentElement;
    return !element?.checkVisibility || element.checkVisibility();
}

/** container 의 자식을 다 지난 다음 텍스트 노드 */
function nextAfter(walker, container) {
    let node = container;
    while (node && !node.nextSibling) node = node.parentNode;
    if (!node) return null;
    walker.currentNode = node.nextSibling;
    return node.nextSibling.nodeType === 3 ? node.nextSibling : walker.nextNode();
}
