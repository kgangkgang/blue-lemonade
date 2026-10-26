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
    } else if (popup.hasAttribute(POPUP_MARK)) popup.removeAttribute(POPUP_MARK);
}

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
