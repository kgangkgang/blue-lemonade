// 1.6.1 뒤로 가기로 미트볼 창 닫기 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문) · 설정 「뒤로 가기로 미트볼 창 닫기」(기본 켬).
//   그 확장의 창(상태창 · 프로필 · 프롬프트 · 토큰 · 알림함 · 2.8.0 전체화면 미니홈피 …)은 전부 실리태번 팝업인데 뒤로 가기 처리가 없어요 →
//   폰에서 뒤로 가기를 누르면 창은 그대로이고 앱 밖으로 나가요. 창이 뜨면 공용 「창 겹 쌓기」(src/layer-back.js)에 한 겹을 올리고, 뒤로 가기면 그 창의 닫기를 대신 눌러요.
//   · 닫기 = 사람이 닫을 때와 같은 단추: 「취소」 가 보이는 창(적용/취소)은 「취소」, 아니면 그 확장이 닫을 때 쓰는 확인 단추(「닫기」). 그 확장의 자료 · 함수는 안 건드려요.
//   · 그 창 위에 다른 창(그 확장이 띄운 물음 · 테마 확인 창)이 떠 있으면 맨 위 창부터 닫고 미트볼 창은 남겨요(한 번에 한 겹).
//   · 창이 ✕ · 단추로 닫혀 문서에서 빠지면 겹을 내려요(기록 한 칸도 같이 물려요).
//   · 감시는 공용 감시 허브(src/dom-watch.js)의 body 직속 구독 하나 — 실리태번 팝업은 body 바로 아래에 붙었다 떼져요. 타이머 없음.
//   · 「원작 그대로 보기」 · 테마 꺼짐 · 설정 끔(data-bl-mb-back="off")이면 새 겹을 올리지 않아요(이미 올린 겹은 창이 닫힐 때 내려요).
//   시험: tools/tests/mb-back.mjs
import { watchDom } from './dom-watch.js';
import { layers } from './layer-back.js';

export const MB_DIALOG = 'dialog.ss-dlg';
export const ATTR = 'data-bl-mb-back';
const wants = doc => !!doc?.body?.classList?.contains?.('salty') && !doc.body.hasAttribute?.('data-bl-ext-raw') && doc.body.getAttribute?.(ATTR) !== 'off';
const shown = el => !!el && (typeof el.getClientRects !== 'function' || el.getClientRects().length > 0);
/** 그 창을 사람이 닫을 때처럼 닫아요 → 누른 단추(없으면 null) */
export function closeDialog(dlg, isShown = shown) {
    const cancel = dlg?.querySelector?.('.popup-button-cancel');
    const btn = (cancel && isShown(cancel) ? cancel : null) || dlg?.querySelector?.('.popup-button-ok') || dlg?.querySelector?.('.popup-button-close');
    if (!btn) return null;
    try { btn.click(); } catch { return null; }
    return btn;
}
/** 뒤로 가기 한 번: 문서의 맨 위 열린 창이 이 창이 아니면 그것부터 닫고 false(이 창은 남아요) · 이 창이면 닫고 true */
export function backOnce(doc, dlg, isShown = shown) {
    const open = [...(doc?.querySelectorAll?.('dialog[open]') || [])];
    const top = open[open.length - 1];
    if (top && top !== dlg) { closeDialog(top, isShown); return false; }
    if (dlg?.isConnected === false) return true;      // 이미 닫힌 창
    closeDialog(dlg, isShown);
    return true;                                      // 단추를 못 찾아도 겹은 내려요(기록이 창 없이 남지 않게)
}
let on = false;
export function startMbBack(doc = globalThis.document, { watch = watchDom, stack = layers(), isShown = shown } = {}) {
    if (on || !doc?.body) return false;
    on = true;
    const open = new Map();                           // 창 → 겹 내리기
    const add = dlg => { if (open.has(dlg) || !wants(doc)) return; open.set(dlg, stack.open(() => backOnce(doc, dlg, isShown))); };
    const drop = dlg => { const done = open.get(dlg); if (!done) return; open.delete(dlg); try { done(); } catch { /* 다음 맞추기에 */ } };
    try { stack.start?.(); } catch { /* 겹이 생길 때 */ }
    try { for (const dlg of doc.querySelectorAll?.(`${MB_DIALOG}[open]`) || []) add(dlg); } catch { /* 다음에 뜨는 창부터 */ }
    try {
        watch(doc.body, { childList: true, name: '미트볼 창 뒤로 가기' }, records => {
            for (const r of records) {
                for (const n of r.removedNodes || []) if (open.has(n)) drop(n);
                for (const n of r.addedNodes || []) if (n.nodeType === 1 && n.matches?.(MB_DIALOG)) add(n);
            }
            for (const dlg of [...open.keys()]) if (dlg.isConnected === false) drop(dlg);   // 기록이 묶여 와 뗀 것을 놓쳤을 때
        });
    } catch { /* 감시를 못 걸면 아무것도 안 해요 */ }
    return true;
}
