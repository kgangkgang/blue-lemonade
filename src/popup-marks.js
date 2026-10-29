// P5: 열린 창의 종류를 기존 관찰자에서 한 번씩 표시해요.
// focus · checked 같은 브라우저 상태는 CSS에 남기고, 자식 구조·클래스만 옮겨요.
export const POPUP_MARK = 'data-bl-popup';
export const POPUP_SIGNALS = [
    ['qr', '#qr--modalEditor'],
    ['qr-idle', '#qr--modalEditor:not(.qr--isExecuting)'],
    ['settings', '.salty-panel.in-popup'],
    ['notice', '.salty-notice'],
    ['notice-screen', '.salty-notice,.bl-screen-modes'],
    ['delete-character', '#del_char_checkbox'],
    ['regex', '.regex_editor'],
    ['loader', '#loader.splash-screen'],
];

export function markPopup(popup) {
    const tokens = popup.matches('.popup')
        ? POPUP_SIGNALS.filter(([, selector]) => popup.querySelector(selector)).map(([name]) => name).join(' ')
        : '';
    if (tokens) {
        if (popup.getAttribute(POPUP_MARK) !== tokens) popup.setAttribute(POPUP_MARK, tokens);
    } else if (popup.hasAttribute(POPUP_MARK) && ownMark(popup.getAttribute(POPUP_MARK))) popup.removeAttribute(POPUP_MARK);
}

// 8.2.7: 이 표식은 다른 모듈도 써요(고르기 목록 층 'pick' · TTS 막대 'bar' — 다른 확장의 「창 밖 누르면 닫기」가 보는 공용 표시).
// 그런 층이 body 에 붙으면 관찰자가 여기로 넘겨 표식을 지웠고, 전개 지시 창에서 select 목록 항목을 누르는 순간 창이 닫혔어요.
// 그래서 지우는 건 우리가 단 창 종류 이름뿐인 표식만이에요.
const SIGNAL_NAMES = new Set(POPUP_SIGNALS.map(([name]) => name));
const ownMark = value => String(value).split(/\s+/).filter(Boolean).every(name => SIGNAL_NAMES.has(name));

export function refreshPopupMarks(records, root) {
    const pending = new Set();
    const ancestors = node => {
        for (let el = node; el?.nodeType === 1; el = el.parentElement) {
            if (el.matches('.popup') || el.hasAttribute(POPUP_MARK)) pending.add(el);
        }
    };
    const added = node => {
        if (node?.nodeType !== 1) return;
        ancestors(node);
        for (const popup of node.querySelectorAll('.popup')) pending.add(popup);
    };
    if (root) added(root);
    for (const record of records || []) {
        if (record.type === 'characterData') continue;
        ancestors(record.target);
        if (record.type === 'childList') for (const node of record.addedNodes) added(node);
    }
    for (const popup of pending) markPopup(popup);
    return pending.size;
}
