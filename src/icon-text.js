// 아이콘 단추 표식 — CSS :has() 대신 JS 가 .menu_button · 체크 줄 label 에 표식을 단다
// 1) data-bl-icon-text: css/02-controls.css 의 '아이콘만 있는 버튼' 규칙은 `> i` 하나뿐인 .menu_button 을 면 없는 아이콘으로 칠한다.
//    CSS 는 글자 노드를 못 봐서 `<i class="fa-…"></i> 독서 패널 열기` 같은 다른 확장의 글자 버튼도 거기 걸려
//    면 · 여백 없이 글자만 남았다. 아이콘 옆에 맨 글자가 바로 붙은 .menu_button 에만 data-bl-icon-text 를 달아
//    그 규칙에서 뺀다 — 그러면 다른 글자 버튼과 같은 떠 있는 칩. 아이콘만 있는 버튼은 표시가 붙지 않아 그대로다.
// 2) data-bl-icon-only (7.9.9, 속도 P2): 예전엔 CSS 가 `.menu_button:has(> i:only-child)` · `:has(> svg:only-child)` ·
//    `.menu_button_icon:has(> i):not(:has(> span, > b, > strong, > small))` 로 아이콘만 단추를 골랐다. 실리태번 공용 클래스에 걸린 :has 는
//    단추가 수백 개인 화면(빠른 답장 서랍)에서 가장 비싼 갈래라(perf/합본-792), 같은 조건을 여기서 재서 토큰으로 단다:
//      i   = 요소 자식이 <i> 하나뿐   svg = 요소 자식이 <svg> 하나뿐   mbi = .menu_button_icon 이고 바로 아래 <i> 가 있고 span · b · strong · small 이 없음
//    CSS 는 `[data-bl-icon-only~="i"]` 처럼 토큰으로 본다(:only-child 와 같이 글자 노드는 세지 않는다).
// 3) data-bl-row-check (7.9.9, 속도 P2): `label:has(> input[type="checkbox"])` 대신. 바로 아래에 체크박스 input 이 있는 label.
// 관찰자 콜백은 그리기 전에 돈다 — 새로 붙은 요소가 한 프레임도 다른 모양으로 보이지 않는다.
const MARK = 'data-bl-icon-text';
const ICON_ONLY = 'data-bl-icon-only';
const ROW_CHECK = 'data-bl-row-check';
const TEXTISH = new Set(['span', 'b', 'strong', 'small']);

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

// 아이콘만 단추 토큰 — CSS :has 조건과 하나씩 같다
export function iconOnlyTokens(el) {
    const tokens = [];
    const first = el.firstElementChild;
    if (first && el.childElementCount === 1) {
        if (first.localName === 'i') tokens.push('i');
        else if (first.localName === 'svg') tokens.push('svg');
    }
    if (el.classList.contains('menu_button_icon')) {
        let icon = false, textish = false;
        for (let child = first; child; child = child.nextElementSibling) {
            if (child.localName === 'i') icon = true;
            else if (TEXTISH.has(child.localName)) textish = true;
        }
        if (icon && !textish) tokens.push('mbi');
    }
    return tokens.join(' ');
}

function setAttr(el, name, value) {
    if (value === false || value === '') { if (el.hasAttribute(name)) el.removeAttribute(name); return; }
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function check(el) {
    const want = bareText(el) && hasIcon(el);
    if (want !== el.hasAttribute(MARK)) { if (want) el.setAttribute(MARK, ''); else el.removeAttribute(MARK); }
    setAttr(el, ICON_ONLY, iconOnlyTokens(el));
}

// label 바로 아래 체크박스 input 이 있나
export function hasCheckChild(label) {
    for (let child = label.firstElementChild; child; child = child.nextElementSibling) {
        if (child.localName === 'input' && child.type === 'checkbox') return true;
    }
    return false;
}
function checkLabel(label) {
    const want = hasCheckChild(label);
    if (want !== label.hasAttribute(ROW_CHECK)) { if (want) label.setAttribute(ROW_CHECK, ''); else label.removeAttribute(ROW_CHECK); }
}

function scan(node) {
    if (node.classList?.contains('menu_button')) check(node);
    else if (node.localName === 'label') checkLabel(node);
    if (!node.firstElementChild) return;
    for (const el of node.getElementsByClassName('menu_button')) check(el);
    for (const el of node.getElementsByTagName('label')) checkLabel(el);
}

// 바뀐 요소 하나 — .menu_button 이면 단추 표식, label 이면 체크 줄 표식, input 이 바뀌었으면 그 부모 label
function touched(el) {
    if (el.classList.contains('menu_button')) check(el);
    else if (el.localName === 'label') checkLabel(el);
    else if (el.localName === 'input' && el.parentElement?.localName === 'label') checkLabel(el.parentElement);
}

let started = false;
export function startIconTextMark() {
    if (started || !document.body) return;
    started = true;
    scan(document.body);
    // 붙은 요소 속 .menu_button · label 과, 자식(글자 · 아이콘)이 바뀐 요소, 클래스(menu_button_icon) · type 이 바뀐 요소만 본다.
    new MutationObserver((records) => {
        for (const record of records) {
            const target = record.target;
            if (target.nodeType === 1) touched(target);
            for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
        }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'type'] });
}
