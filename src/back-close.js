// 1.6.9 뒤로 가기로 테마 창 닫기 — 폰의 뒤로 가기(안드로이드 뒤로 단추 · 브라우저 뒤로)를 누르면 테마가 연 맨 위 창 하나만 닫아요. 설정 「뒤로 가기로 창 닫기」(기본 켬).
//   버그 사냥 8: 테마 창(설정 · 로그 복사 · 애드온 창 …)을 연 채 뒤로 가기를 누르면 창은 그대로이고 실리태번 페이지를 떠났어요(테마 창 · 실리태번 창 모두 기록을 안 쌓아요).
//   한 곳에서 다뤄요 — 창마다 손대지 않아요:
//     · 열린 모달 창(<dialog> showModal) 전부: 테마 창(src/modal.js showThemeModal · 직접 showModal) · 테마가 띄운 실리태번 팝업(callGenericPopup · Popup)이 같은 꼴이에요.
//       실리태번 팝업은 누가 띄웠는지 문서로 가를 수 없어 실리태번 · 다른 확장이 띄운 팝업도 같이 닫혀요(뒤로 가기 = Esc 와 같은 「취소」).
//       미트볼 창(dialog.ss-dlg)은 따로 설정이 있는 src/mb-back.js 몫이라 빼요.
//     · 대화상자가 아닌 테마 겹(목록 팝업 · 색 고르기 · 메뉴 …)은 그 모듈이 backLayer(닫기) 로 한 겹 올리고 닫힐 때 돌려받은 done() 을 불러요.
//   닫기 = Esc 와 같아요: 취소(cancel) 사건을 보내 막히지 않으면 close(). 실리태번 팝업은 취소 사건에서 스스로 닫혀요(닫히는 동안 [closing]).
//     막혀서 안 닫히면(저장 안 한 글을 묻는 창 · 막는 창) false — 겹 · 기록 한 칸이 그대로 남아요(src/layer-back.js).
//   창이 뜬 것을 아는 길 셋(어느 하나만 와도 돼요 · 같은 창은 한 번): ① 문서의 toggle 사건(dialog 가 열리고 닫힐 때 · 크롬 132+) ② body 직속 감시(공용 감시 허브 —
//     실리태번 팝업은 body 에 붙였다 떼요) ③ showThemeModal 이 바로 알려 줌(trackDialog — 다시 쓰는 창 · body 밖 창). 닫힘은 toggle closed · 문서에서 빠짐 · showThemeModal 의 close 처리.
//     창마다 리스너를 달지 않아요(창을 치운 뒤 리스너가 남지 않게).
//   기록 쌓기 · 새로 고침 뒤 남은 칸 치우기 · 여러 겹 차례는 공용 「창 겹 쌓기」(src/layer-back.js)가 해요(미트볼 창과 같은 쌓임 하나).
//   설정 끔(data-bl-back-close="off")이면 새 겹을 올리지 않아요(이미 올린 겹은 창이 닫힐 때 내려요). 타이머 없음.
//   시험: tools/tests/back-close.mjs
import { watchDom } from './dom-watch.js';
import { layers } from './layer-back.js';

export const ATTR = 'data-bl-back-close';
export const SKIP = 'dialog.ss-dlg';
const wants = doc => doc?.body?.getAttribute?.(ATTR) !== 'off';
const isDialog = el => el?.nodeType === 1 && String(el.tagName || '').toUpperCase() === 'DIALOG';
/** 열린 모달 창인가(:modal 을 모르는 옛 엔진은 열린 창이면) */
export function isModal(dlg) {
    if (!isDialog(dlg) || !dlg.open || dlg.isConnected === false) return false;
    try { return dlg.matches(':modal'); } catch { return true; }
}
const gone = dlg => !dlg.open || dlg.isConnected === false || !!dlg.hasAttribute?.('closing');
/** 뒤로 가기 한 번 = 그 창에 Esc: 취소 사건 → 막히지 않으면 close() · 닫혔거나 닫히는 중이면 true */
export function closeDialog(dlg) {
    if (gone(dlg)) return true;
    let go = true;
    try { go = dlg.dispatchEvent(new Event('cancel', { cancelable: true })); } catch { go = true; }
    if (go && !gone(dlg)) { try { dlg.close(); } catch { /* 아래에서 다시 봐요 */ } }
    return gone(dlg);
}

// 1.9.2 화면 빚: 창 하나에 겹 하나는 문서 전체에서 하나예요 — 이 모듈이 두 번 읽혀도(src 와 dist) 같은 창을 두 겹으로 올리지 않게 문서 전역 열쇠에 둬요(src/layer-back.js 와 같은 까닭)
const G = (globalThis[Symbol.for('blue-lemonade.back-close')] ||= { state: null, started: false });
const ensure = (doc = globalThis.document, stack = layers()) => (G.state ||= { doc, stack, open: new Map() });
/** 창 하나에 겹 하나 → 그 겹 내리기(이미 올렸거나 안 올리면 null). 창에 리스너를 달지 않아요 — 닫힘은 toggle · 문서에서 빠짐 · showThemeModal 의 close 처리가 알려요 */
function add(dlg) {
    const s = G.state;
    if (!s || !isDialog(dlg) || s.open.has(dlg) || !wants(s.doc) || dlg.matches?.(SKIP) || !isModal(dlg)) return null;
    // 버그 사냥 9b: body 직속이 아닌 창이 닫히지 않고 떼어지면(바깥 상자째) toggle · body 감시 모두 몰라 겹이 남았어요 — 뒤로 가기 때 그 겹은 세지 않게(alive)
    s.open.set(dlg, s.stack.open(() => closeDialog(dlg), () => { const live = dlg.isConnected !== false; if (!live) s.open.delete(dlg); return live; }));
    return () => drop(dlg);
}
function drop(dlg) {
    const s = G.state; const done = s?.open.get(dlg);
    if (!done) return;
    s.open.delete(dlg);
    try { done(); } catch { /* 다음 맞추기에 */ }
}
/** showThemeModal 이 창을 띄운 뒤 바로 알려요 — 돌려받은 함수를 그 창의 close 처리에서 불러요(문서 감시 · 리스너를 새로 걸지 않아요) */
export function trackDialog(dlg) { ensure(); return add(dlg); }

/** 대화상자가 아닌 테마 겹: 열 때 부르고, 돌려받은 done() 을 닫힐 때(어느 길로든) 불러요. close(): 뒤로 가기로 그 겹 닫기 */
export function backLayer(close, doc = globalThis.document, stack = layers()) {
    if (typeof close !== 'function' || !wants(doc)) return () => {};   // 창 감시(startBackClose)는 따로 — 겹 쌓기만 써요
    return stack.open(() => { try { return close() !== false; } catch { return true; } });
}

export function startBackClose(doc = globalThis.document, { watch = watchDom, stack = layers() } = {}) {
    if (G.started || !doc?.body) return false;
    G.started = true;
    ensure(doc, stack);
    try { stack.start?.(); } catch { /* 겹이 생길 때 */ }
    try { for (const dlg of doc.querySelectorAll?.('dialog[open]') || []) add(dlg); } catch { /* 다음에 뜨는 창부터 */ }
    try {
        doc.addEventListener?.('toggle', event => {
            const dlg = event?.target;
            if (!isDialog(dlg)) return;
            if (event.newState === 'open') add(dlg); else if (event.newState === 'closed') drop(dlg);
        }, true);
    } catch { /* 감시로 */ }
    try {
        watch(doc.body, { childList: true, name: '뒤로 가기로 창 닫기' }, records => {
            const s = G.state;
            for (const r of records) {
                for (const n of r.removedNodes || []) if (s.open.has(n)) drop(n);
                for (const n of r.addedNodes || []) if (isDialog(n)) add(n);
            }
            for (const dlg of [...s.open.keys()]) if (dlg.isConnected === false || !dlg.open) drop(dlg);   // 기록이 묶여 와 뗀 것 · 소리 없이 닫힌 것
        });
    } catch { /* toggle · trackDialog 로 */ }
    return true;
}
/** 시험용: 모듈 상태 비우기 */
export function resetBackCloseForTest() { G.state = null; G.started = false; }
