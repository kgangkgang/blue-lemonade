// 터치 끌기의 뜻 가르기 (8.2.3): 손가락이 처음 threshold(8px)만큼 움직인 방향으로 「세로 = 화면 스크롤(브라우저에 맡김)」 · 「가로 = 미리보기 이동」을 정해요.
// 왜: 설정 창 미리보기 상자(.bl-view-port)가 touch-action:none 으로 손가락을 다 잡아 폰에서 그 위에서는 화면이 안 올라갔어요(제보 10-29 「본문·대사 창 스크롤 안 됨」).
//   사용자 결정: 세로로 끌면 화면 스크롤, 가로 끌기만 미리보기 이동. 마우스는 그대로(PC 는 휠로 스크롤하니 세로 드래그 이동 유지).
// 순수 함수라 시험(tools/tests/preview-view-touch.mjs)에서 바로 써요. preview-view.js 가 터치 한 손가락에만 부르고, 두 손가락(확대)은 묻지 않아요.
/** @returns {'vertical'|'horizontal'|null} null = 아직 threshold 안 — 결정 보류 */
export function dragIntent(dx, dy, threshold = 8) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < threshold && ay < threshold) return null;
    return ay >= ax ? 'vertical' : 'horizontal';
}
