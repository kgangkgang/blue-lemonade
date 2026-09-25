// 5.3.7 body 에 바로 붙는 창(북마크 모아 보기 · 한글화 패널)은 모달 설정 창(<dialog>, 맨 위 층) 아래에 깔려 보이지도 눌리지도 않았다.
// 설정 창 안의 단추로 열 때는 설정 창을 먼저 닫는다. 서랍 속 설정 창(팝업 아님)과 ✦ 메뉴에서 열 때는 그대로.
export function leaveSettingsDialog(el) {
    const panel = el?.closest?.('.salty-panel.in-popup');
    if (panel && typeof panel._onClose === 'function') panel._onClose();
}
