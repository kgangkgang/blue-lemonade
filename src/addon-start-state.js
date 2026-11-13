// 1.4.x 통합(11-14 · 조정자 결정): 애드온을 한 박자씩 나눠 시작하는 동안(addons.js startEach)을 알려요.
//   headswitch.js 는 id 없는 창의 열쇠를 「처음 본 차례」 번호(cls:inline-drawer#n)로 매겨 사용자 설정(headSwitches)에 저장해 두는데,
//   나눠 시작하면 한글화 패널 · 캐릭터 에셋 같은 창이 첫 번호 매기기 뒤에 붙어 번호가 밀렸어요(꺼내 둔 스위치가 다른 확장 줄에 붙음).
//   그래서 나눠 시작이 다 끝날 때까지 머리 스위치는 새 번호를 매기지 않고 기다려요 — 번호 차례가 한 작업에서 다 시작하던 v1.4.4 와 같아요.
let pending = 0;
const waiters = new Set();
export const spreadPending = () => pending > 0;
export function spreadBegin() { pending++; }
export function spreadEnd() {
    if (pending > 0) pending--;
    if (pending) return;
    for (const fn of [...waiters]) { waiters.delete(fn); try { fn(); } catch (error) { console.warn('[Blue Lemonade] 애드온 시작 뒤', error); } }
}
/** 나눠 시작이 없으면 바로, 있으면 다 끝난 뒤 한 번(같은 함수는 한 번만 기다려요) */
export function whenSpreadSettled(fn) { if (!pending) fn(); else waiters.add(fn); }

// 1.4.x 통합(덧 3 · 조정자 결정 (라)): 늦은 애드온(처음 쓸 때 시작)까지 다 시작했는지 — 머리 스위치가 옛 차례 번호 열쇠를
//   창 이름 열쇠로 한 번 옮기는 때(모든 창이 붙은 뒤)를 알려고 써요. 늦은 애드온이 없거나 애드온을 안 쓰면 바로 「끝」이에요.
let lateDone = false;
const lateWaiters = new Set();
export const lateAddonsDone = () => lateDone;
export function markLateDone() {
    if (lateDone) return;
    lateDone = true;
    for (const fn of [...lateWaiters]) { lateWaiters.delete(fn); try { fn(); } catch (error) { console.warn('[Blue Lemonade] 늦은 애드온 뒤', error); } }
}
/** 늦은 애드온 시작이 끝났으면 바로, 아니면 끝난 뒤 한 번(같은 함수는 한 번만 기다려요) */
export function whenLateDone(fn) { if (lateDone) fn(); else lateWaiters.add(fn); }
