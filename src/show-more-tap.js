// 7.9.9 「이전 메시지 더 보기」를 손으로 눌렀을 때 불러온 메시지를 보여 준다 (항상 켬 · features.js).
// 실리태번 showMoreMessages() 는 단추가 창 안에 있으면 끼워 넣은 높이만큼 scrollTop 을 내려 「보던 첫 메시지」를 그 자리에 둔다(script.js) — 자동으로 미리 불러올 때는
//   맞지만, 단추를 직접 누른 사람 눈에는 단추와 새 메시지가 위로 사라지고 화면만 내려간 것으로 보인다. 사용자 설정이 「한 번에 1개」(chat_truncation 1) · 자동 더 보기
//   끔이면 누를 때마다 메시지 하나가 위로 숨고 단추를 다시 찾아 올려야 했다 (제보 10-24 「누르면 화면만 밑으로 내려가고 더보기가 안 돼」 — 리그 재현: 폭 320~1280 ·
//   1개씩 · 두 번째 누름부터 새 메시지가 보이는 픽셀 0 · scrollTop 만 한 메시지 높이씩 증가).
// 손으로 누른(isTrusted) 클릭만: 누르기 전 첫 메시지를 적어 두고, 실리태번이 끼워 넣고 보정한 뒤(같은 클릭 디스패치 안에서 동기로 끝난다 → 타이머 0) 새로 들어온
//   메시지들의 끝이 화면 아래에 오도록 올린다 — 보던 첫 메시지의 위쪽 OVERLAP px 만 남겨 이어 읽게. 위로만 움직이고, 들어온 것이 없으면 아무것도 안 한다.
// 자동 더 보기(show-more-auto.js)가 켜져 있으면 HOLD 동안 쉬게 한다 — 보여 준 자리를 바로 또 불러 가리지 않게 (쉰 뒤 단추가 아직 미리보기 영역이면 이어서 부른다).
// 실리태번 1.16(mouseup · touchend) · 1.19(click) 모두 손 탭 뒤에 click 이 오므로 같은 길로 잡힌다. 스크립트의 .click()(자동 더 보기)은 isTrusted 가 아니라 건너뛴다.
export const OVERLAP = 24, HOLD = 2000;
let installed = null;

/** 실리태번이 끼워 넣고 보정한 뒤의 목표 scrollTop — oldFirstTop: 누르기 전 첫 메시지의 지금 자리(내용 기준 px). 위로 가는 경우만, 아니면 null */
export function revealTarget({ oldFirstTop, clientHeight, scrollTop }) {
    if (![oldFirstTop, clientHeight, scrollTop].every(Number.isFinite)) return null;
    const wanted = Math.max(0, Math.round(oldFirstTop - clientHeight + OVERLAP));
    return wanted < scrollTop - 1 ? wanted : null;
}
/** 내용 기준 자리 (scrollTop 과 같은 축) */
const layoutTop = (chat, node) => chat.scrollTop + node.getBoundingClientRect().top - chat.getBoundingClientRect().top - (chat.clientTop || 0);

/** 누른 뒤 한 번: 들어온 것이 있으면 보여 준다 → 옮겼으면 true. 시험용으로 chat · 누르기 전 첫 메시지 · 수를 받는다 */
export function revealLoaded(chat, oldFirst, oldCount) {
    if (!chat || !oldFirst?.isConnected) return false;
    const count = chat.querySelectorAll('.mes').length;
    if (!(count > oldCount)) return false;   // 들어온 것이 없다 (다 불러왔거나 실패)
    const wanted = revealTarget({ oldFirstTop: layoutTop(chat, oldFirst), clientHeight: chat.clientHeight, scrollTop: chat.scrollTop });
    if (wanted === null) return false;
    chat.scrollTop = wanted;
    return true;
}
function onClick(event) {
    if (event.isTrusted === false) return;   // 자동 더 보기의 .click() — 그쪽은 보던 자리를 지킨다
    const button = event.target?.closest?.('#show_more_messages');
    if (!button) return;
    const doc = event.currentTarget;
    const chat = doc.getElementById?.('chat') ?? button.closest?.('#chat');
    if (!chat) return;
    const oldFirst = chat.querySelector('.mes'), oldCount = chat.querySelectorAll('.mes').length;
    // 자동 더 보기가 켜져 있으면 잠깐 쉬게 (이미 불러온 모듈만 — 안 불러왔으면 받지 않는다)
    try { import('./show-more-auto.js').then(m => m?.holdAuto?.(HOLD)).catch(() => {}); } catch { /* 없음 */ }
    setTimeout(() => { try { revealLoaded(chat, oldFirst, oldCount); } catch (error) { console.warn('[Blue Lemonade] show-more-tap', error); } }, 0);
}
export function installShowMoreTap(doc = globalThis.document) {
    if (!doc?.addEventListener || installed === doc) return uninstallShowMoreTap;
    installed = doc;
    doc.addEventListener('click', onClick, true);
    return uninstallShowMoreTap;
}
/** 뗀다 (테마 끔 · 시험 · 리그의 고치기 전 비교) */
export function uninstallShowMoreTap() {
    if (!installed) return false;
    installed.removeEventListener('click', onClick, true); installed = null;
    return true;
}
