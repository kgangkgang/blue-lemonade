// 1.6.0 미트볼 얼굴(색만 · 이름 첫 글자)을 다시 그린 그 작업 안에 칠해요 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   사용자 「뭔 버튼 누를 때마다 지지직거리면서 동물 이모지 보여」: 얼굴 표식(src/ext-compat.js paintFaces)은 맞춤 시트의 0.001초 애니메이션 신호로 달아서,
//   그 확장이 목록을 다시 그리면 원작 얼굴 그림이 먼저 한 화면 그려진 뒤(신호는 다음 화면에 와요) 색 동그라미로 바뀌었어요.
//   → ① 시트(src/ext-status.css)가 얼굴 표시를 켠 동안 얼굴 그림 글자를 처음부터 숨기고 ② 이 모듈이 공용 감시 허브(src/dom-watch.js)의 body 구독 하나(채팅 제외)로
//     얼굴이 새로 붙은 것을 같은 작업 안(그리기 전)에 알아 표식을 달아요. 감시자 · 타이머를 새로 만들지 않아요. 예전 신호(애니메이션 시작)는 채팅 안 얼굴 · 안전망으로 그대로 남아요.
//   설정이 「아이콘」 이거나 「원작 그대로 보기」 면 아무것도 안 해요. 시험: tools/tests/mb-face-now.mjs
import { watchDom } from './dom-watch.js';
import { paintFaces, FACES } from './ext-compat.js';

/** 이 기록에 얼굴 요소가 새로 붙었나(얼굴 자신이거나 얼굴을 품은 가지) */
export function faceRecord(record) {
    for (const n of record?.addedNodes || []) if (n.nodeType === 1 && (n.matches?.(FACES) || (n.firstElementChild && n.querySelector?.(FACES)))) return true;
    return false;
}
const wants = doc => !!doc?.body?.hasAttribute?.('data-bl-mb-face') && !doc.body.hasAttribute('data-bl-ext-raw');
let on = false;
export function startFaceNow(doc = globalThis.document, { watch = watchDom, soon = fn => queueMicrotask(fn), paint = paintFaces } = {}) {
    if (on || !doc?.body) return false;
    on = true;
    let queued = false;
    // 표식은 속성만 바꿔서(자식 목록 기록이 안 생겨요) 제 변화로 다시 돌지 않아요 · 얼굴 여럿이 한꺼번에 그려져도 한 번만 훑어요
    try { watch(doc.body, { childList: true, subtree: true, exclude: '#chat', name: '미트볼 얼굴' }, records => { if (queued || !wants(doc) || !records.some(faceRecord)) return; queued = true; soon(() => { queued = false; try { if (wants(doc)) paint(doc); } catch { /* 다음 신호 때 */ } }); }); } catch { /* 예전 신호로만 */ }
    return true;
}
