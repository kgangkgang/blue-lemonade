// 지우기 확인 창 표시: 실리태번은 확인 창에 표시를 안 붙임 (모든 창의 data-i18n 이 'OK', 글자는 '네')
// → 로어북 지우기처럼 되돌릴 수 없는 창이 그냥 묻는 창과 CSS 로 구별이 안 됨.
//   방금 누른 것이 지우기 컨트롤이었으면 그때 뜬 확인 창에 .salty-danger-confirm 을 붙여 준다.
const MARK = 'salty-danger-confirm';
const OPEN_MS = 2500; // 누른 뒤 이 시간 안에 뜬 창만 (그 뒤에 뜬 창은 다른 일)

// 지우기 · 빼기 컨트롤 — style.css 의 surfaces:semantic 칸과 같은 목록
const DANGER_SEL = [
    '.fa-trash', '.fa-trash-can', '.fa-trash-alt', '.fa-skull',
    '.redWarningBG', '.red_button', '.danger',
    '.delete_entry_button', '.PastChat_cross', '.deleteChat', '.btn_delete',
    '.delete_regex', '.delete-asset-button', '.eh-btn--danger',
    '.mes_delete_translation', '.mes_edit_delete', '.mes_reasoning_delete',
    '.mes_media_delete', '.mes_file_delete', '.tag_remove',
    '[id*="delete" i]', '[class*="delete" i]',
    '[title*="delete" i]', '[title*="삭제"]', '[title*="지우"]',
].join(',');
// 우리 설정 창 · 입력판 · 알림은 뺌
const SKIP_SEL = '.salty-panel, #nonQRFormItems, #toast-container';

let armedAt = 0;

function arm(ev) {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const hit = target.closest(DANGER_SEL);
    if (!hit || hit.closest(SKIP_SEL)) return;
    armedAt = Date.now();
}

function markNew(dlg) {
    if (Date.now() - armedAt > OPEN_MS) return;
    // 묻는 창(취소 버튼이 있는 창)만 — 그냥 알려 주는 창은 빨갛게 하지 않음
    const cancel = dlg.querySelector('.popup-button-cancel');
    if (!cancel || cancel.style.display === 'none') return;
    for (const old of document.querySelectorAll(`dialog.${MARK}`)) old.classList.remove(MARK);
    dlg.classList.add(MARK);
    armedAt = 0; // 한 번 누름 = 한 창
}

export function startDangerMark() {
    document.addEventListener('pointerdown', arm, true);
    document.addEventListener('click', arm, true);
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') arm(ev);
    }, true);
    // 실리태번은 창을 열 때 dialog 를 body 에 새로 붙임
    new MutationObserver((muts) => {
        for (const mut of muts) {
            for (const node of mut.addedNodes) {
                if (node.nodeType === 1 && node.matches?.('dialog.popup')) markNew(node);
            }
        }
    }).observe(document.body, { childList: true });
}
