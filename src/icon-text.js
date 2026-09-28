// 아이콘 + 맨 글자 버튼 표시
// css/02-controls.css 의 '아이콘만 있는 버튼' 규칙은 `> i` 하나뿐인 .menu_button 을 면 없는 아이콘으로 칠한다.
// CSS 는 글자 노드를 못 봐서 `<i class="fa-…"></i> 독서 패널 열기` 같은 다른 확장의 글자 버튼도 거기 걸려
// 면 · 여백 없이 글자만 남았다. 아이콘 옆에 맨 글자가 바로 붙은 .menu_button 에만 data-bl-icon-text 를 달아
// 그 규칙에서 뺀다 — 그러면 다른 글자 버튼과 같은 떠 있는 칩. 아이콘만 있는 버튼은 표시가 붙지 않아 그대로다.
const MARK = 'data-bl-icon-text';

// 공백이 아닌 글자 노드가 바로 아래에 있나 (span 같은 요소 속 글자는 CSS 가 이미 가린다)
function bareText(el) {
    for (let node = el.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 3 && node.nodeValue.trim()) return true;
    }
    return false;
}

// <i> 아이콘 자식이 있나. 제 클래스가 fa-solid 인 버튼은 글자도 아이콘 글꼴로 그려지고
// 실리태번 빠른 답장의 '⁝' 처럼 그 글자가 곧 아이콘이라 보지 않는다.
function hasIcon(el) {
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
        if (child.localName === 'i') return true;
    }
    return false;
}

function check(el) {
    const want = bareText(el) && hasIcon(el);
    if (want === el.hasAttribute(MARK)) return;
    if (want) el.setAttribute(MARK, '');
    else el.removeAttribute(MARK);
}

function scan(node) {
    if (node.classList?.contains('menu_button')) check(node);
    if (node.firstElementChild) for (const el of node.getElementsByClassName('menu_button')) check(el);
}

let started = false;
export function startIconTextMark() {
    if (started || !document.body) return;
    started = true;
    scan(document.body);
    // 관찰자 콜백은 그리기 전에 돈다 — 새로 붙은 버튼이 한 프레임도 아이콘 버튼으로 보이지 않는다.
    // 붙은 요소 속 .menu_button 과, 자식(글자)이 바뀐 .menu_button 만 본다.
    new MutationObserver((records) => {
        for (const record of records) {
            const target = record.target;
            if (target.nodeType === 1 && target.classList.contains('menu_button')) check(target);
            for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
        }
    }).observe(document.body, { childList: true, subtree: true });
}
