// 1.6.0 미트볼 얼굴(색만 · 이름 첫 글자)을 다시 그린 그 작업 안에 칠해요 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   사용자 「뭔 버튼 누를 때마다 지지직거리면서 동물 이모지 보여」: 얼굴 표식(src/ext-compat.js paintFaces)은 맞춤 시트의 0.001초 애니메이션 신호로 달아서,
//   그 확장이 목록을 다시 그리면 원작 얼굴 그림이 먼저 한 화면 그려진 뒤(신호는 다음 화면에 와요) 색 동그라미로 바뀌었어요.
//   → ① 시트(src/ext-status.css)가 얼굴 표시를 켠 동안 얼굴 그림 글자를 처음부터 숨기고 ② 이 모듈이 공용 감시 허브(src/dom-watch.js)의 body 구독 하나(채팅 제외)로
//     얼굴이 새로 붙은 것을 같은 작업 안(그리기 전)에 알아 표식을 달아요. 감시자 · 타이머를 새로 만들지 않아요. 예전 신호(애니메이션 시작)는 채팅 안 얼굴 · 안전망으로 그대로 남아요.
//   설정이 「아이콘」 이거나 「원작 그대로 보기」 면 아무것도 안 해요. 시험: tools/tests/mb-face-now.mjs
// 1.6.2 같은 까닭의 셋을 같은 구독에서(리그 폰 384 · 그리기 직전마다 「보이는데 표식이 없는」 요소 수 — 지시-1117/버그-사냥-3):
//   · 띠 종 숫자 배지(markBadge · data-bl-n): 띠는 칩을 누를 때마다 통째로 다시 그려져요 → 누를 때마다 1 ~ 2 화면 원작 숫자(다른 글꼴 · 10 이상이면 「12」 처럼 넓은 배지)가 비쳤어요.
//   · 꾸미기 창 「블루레몬 꾸미기」 묶음(decoTheme): 그 확장이 창 안을 통째로 다시 그려요 → 고르기를 누를 때마다 2 화면 묶음이 빠져 아래 묶음이 위로 튀었다 내려왔어요.
//   · 이름표 → 값 목록 두 열 격자(markLong · data-bl-grid): 표식 전 한 화면은 원작 배치(폰은 한 열)예요.
//   예전 신호(ss-pulse)는 안전망으로 그대로예요 — 같은 표식을 같은 값으로 다시 쓰는 것뿐이라 두 번 와도 화면이 안 바뀌어요.
import { watchDom } from './dom-watch.js';
import { paintFaces, FACES, markBadge, decoTheme, markLong } from './ext-compat.js';
import { mbOff } from './mb-switch.js';   // 1.7.3 미트볼 맞춤 스위치

/** 이 기록에 얼굴 요소가 새로 붙었나(얼굴 자신이거나 얼굴을 품은 가지) */
export function faceRecord(record) {
    for (const n of record?.addedNodes || []) if (n.nodeType === 1 && (n.matches?.(FACES) || (n.firstElementChild && n.querySelector?.(FACES)))) return true;
    return false;
}
export const BAND = '#ss-hud .ss-tb';            // 띠(배지가 든 단추 줄은 띠 안에 · 띠째 다시 그려져요)
export const LIST = '.ss-scope .ss-dl';          // 이름표 → 값 목록
export const HEAD = '.ss-scope.ss-tw > .ss-wz-head';   // 꾸미기 · 프롬프트 창 머리(창 안이 통째로 다시 그려질 때 새로 붙어요)
/** 새로 붙은 가지에서 표식을 달 띠 · 목록 · 창 머리를 모아요 */
export function markTargets(records, out = { bands: new Set(), lists: new Set(), tws: new Set() }) {
    for (const r of records || []) for (const n of r?.addedNodes || []) {
        if (n.nodeType !== 1) continue;
        const tb = n.closest?.(BAND) || null;       // 띠 자신 · 띠 안 일부(배지 · 단추 줄)만 다시 그린 때
        if (tb) out.bands.add(tb); else if (n.firstElementChild) for (const x of n.querySelectorAll?.(BAND) || []) out.bands.add(x);
        if (n.matches?.(LIST)) out.lists.add(n); else if (n.firstElementChild) for (const x of n.querySelectorAll?.(LIST) || []) out.lists.add(x);
        if (n.matches?.(HEAD)) out.tws.add(n.parentElement);
    }
    return out;
}
const wants = doc => !!doc?.body?.hasAttribute?.('data-bl-mb-face') && !doc.body.hasAttribute('data-bl-ext-raw');
const fitted = doc => !!doc?.body?.classList?.contains?.('salty') && !doc.body.hasAttribute?.('data-bl-ext-raw');   // 맞춤 시트가 걸리는 때(시트 규칙과 같은 문)
let on = false;
export function startFaceNow(doc = globalThis.document, { watch = watchDom, soon = fn => queueMicrotask(fn), paint = paintFaces, marks = { badge: markBadge, deco: decoTheme, long: markLong } } = {}) {
    if (on || !doc?.body) return false;
    on = true;
    let queued = false;
    // 표식은 속성만 바꿔서(자식 목록 기록이 안 생겨요) 제 변화로 다시 돌지 않아요 · 얼굴 여럿이 한꺼번에 그려져도 한 번만 훑어요
    //   꾸미기 묶음은 자식을 끼우지만 끼운 것은 창 머리가 아니라 다시 돌지 않아요
    try {
        watch(doc.body, { childList: true, subtree: true, exclude: '#chat', name: '미트볼 얼굴' }, records => {
            if (fitted(doc)) {
                const t = markTargets(records);
                // 1.7.3 미트볼 맞춤 스위치: 끈 묶음은 표식을 안 달아요(종 배지 · 이름표 두 열 · 꾸미기 묶음)
                if (!mbOff('badge', doc)) for (const tb of t.bands) try { marks.badge(tb); } catch { /* 예전 신호 때 */ }
                if (!mbOff('grid', doc)) for (const dl of t.lists) try { marks.long(dl); } catch { /* 예전 신호 때 */ }
                if (!mbOff('deco', doc)) for (const tw of t.tws) try { if (tw) marks.deco(tw); } catch { /* 예전 신호 때 */ }
            }
            if (queued || !wants(doc) || !records.some(faceRecord)) return;
            queued = true; soon(() => { queued = false; try { if (wants(doc)) paint(doc); } catch { /* 다음 신호 때 */ } });
        });
    } catch { /* 예전 신호로만 */ }
    return true;
}
