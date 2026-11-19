// 1.6.0 미트볼 글의 「->」 를 화살표 그림으로 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문 · 설정 칸이 있을 때).
//   감시자를 새로 걸지 않아요: 채팅 밖은 공용 감시 허브(src/dom-watch.js)의 body 구독 하나(채팅 제외), 메시지 아래 칩은 메시지 꾸미기(src/message-decor.js · 공용 #chat 구독)에 얹어요. 타이머 없음.
//   그 확장의 파일 · 자료 · 속성 · 입력칸은 안 건드려요. 그림은 맞춤 시트(src/ext-status.css)가 그려요. 시험: tools/tests/mb-arrow.mjs
import { watchDom } from './dom-watch.js';
import { addMessageDecorator } from './message-decor.js';
import { mbOff, onMbOff } from './mb-switch-core.js';   // 1.7.3 미트볼 맞춤 스위치 「「->」 를 화살표 그림으로」

/** 1.6.0 사용자 「저녁 -> 밤 이 꺽쇠 … 귀여운 화살표로」: 그 확장의 값(때 · 장소)에는 AI 가 적은 「->」 가 그대로 와요(「저녁 -> 밤」 · 「집 -> 편의점」).
 *  양옆에 공백을 낀 「->」 · 「-->」 · 「=>」 를 테마의 선 화살표 그림(「이어 쓰기」 단추의 기본 그림 — 단추 아이콘을 바꿔도 이 그림 고정)으로 「보이게만」 해요.
 *  글은 한 글자도 안 바꿔요: 그 글자 노드를 테마 요소 둘(<bl-arwt> 글 한 덩이 · <bl-arw> 화살표 자리)로 감쌀 뿐이라 textContent · 복사한 글 · 화면 낭독은 원문 「->」 그대로이고,
 *  그 확장의 자료 · 속성(title) · 입력칸(편집 원문)은 안 건드려요. 그림은 시트(src/ext-status.css)가 <bl-arw> 에 그려요 — 「원작 그대로 보기」 · 테마 꺼짐이면 규칙이 안 걸려 「->」 글자 그대로.
 *  감싸개를 하나 더 두는 까닭: 칩은 가로 놓기(flex)라 글 사이에 요소가 끼면 글이 세 칸으로 갈려 공백이 사라져요 — 한 덩이로 감싸면 원래의 「글 한 칸」 그대로예요.
 *  다시 그림: 채팅 밖(띠 · 옆 창 · 뜬 창 · 자세히 창)은 공용 감시 허브의 body 구독 하나(채팅 제외 · 그 확장 화면에 새로 붙은 것만) → 같은 작업 안(그리기 전)에 감싸요(한 화면도 「->」 가 안 비쳐요 — 1.5.5 「지글지글」).
 *  메시지 아래 칩은 메시지 꾸미기(공용 #chat 구독)에 얹어 다음 프레임 · 그리기 전에(답이 오는 동안에도) — 칩 번역(차례 90) 뒤에 감싸요. */
export const MB_ARROW = 'next';   // 화살표 그림 = src/icons.js 선 아이콘 이름(「이어 쓰기」 단추 기본 그림). 시트의 --bl-mb-arw 두 값이 같은 선 그림이에요(시험 tools/tests/mb-arrow.mjs 가 짝을 봐요)
export const ARROW_TAG = 'bl-arw', ARROW_WRAP = 'bl-arwt';
export const MB_SCOPE = '#ss-hud, #ss-side, #ss-float, .ss-msgcard, .ss-scope, .ss-root, .ss-panel, .ss-toasts';   // 그 확장이 그리는 화면(그 확장 화면 번역기의 범위와 같아요 · 설정 서랍 칸은 빼요)
const ARROW_SKIP = new Set(['TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'SCRIPT', 'STYLE', 'CODE', 'PRE', 'BL-ARW', 'BL-ARWT']);
const ARROW_OFF = 'textarea, select, script, style, code, pre, [contenteditable], bl-arw, bl-arwt';
const ARROW = /[\s\u2800](-{1,2}>|=>)(?=[\s\u2800])/g;   // 버그 사냥 7 점자 빈칸(`저녁⠀->⠀밤`)도 양옆 빈칸
/** 글을 [글, 화살표, 글, 화살표, …] 로 나눠요(홀수 칸이 화살표 원문) — 양옆 공백을 낀 것만 · 없으면 null. 이어 붙이면 원문과 같아요. */
export function arrowParts(text) {
    const s = String(text ?? ''); if (!s.includes('>')) return null;
    const out = []; let at = 0, m; ARROW.lastIndex = 0;
    while ((m = ARROW.exec(s))) { const from = m.index + 1; out.push(s.slice(at, from), m[1]); at = from + m[1].length; ARROW.lastIndex = at; }
    if (!out.length) return null;
    out.push(s.slice(at)); return out;
}
const rawView = doc => !!doc?.body?.hasAttribute?.('data-bl-ext-raw') || mbOff('arrow', doc);   // 1.7.3 스위치를 끈 때도 「원작 그대로 보기」 와 같아요
/** root(요소 · 글자 노드) 안의 화살표 글을 감싸요 → 감싼 글자 노드 수. 입력칸 · 고치는 칸 · 이미 감싼 것은 건너뛰어요. */
export function wrapArrows(root) {
    const doc = root?.ownerDocument; if (!doc?.createElement || rawView(doc)) return 0;
    const top = root.nodeType === 3 ? root.parentElement : root;
    if (!top || top.closest?.(ARROW_OFF)) return 0;
    const found = [];
    const visit = node => {
        if (node.nodeType === 3) { if (arrowParts(node.nodeValue)) found.push(node); return; }
        if (node.nodeType !== 1 || ARROW_SKIP.has(node.tagName) || node.hasAttribute?.('contenteditable')) return;
        for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
    };
    visit(root);
    for (const node of found) {
        const parts = arrowParts(node.nodeValue), wrap = doc.createElement(ARROW_WRAP);
        parts.forEach((part, i) => { if (!part) return; if (i % 2) { const arrow = doc.createElement(ARROW_TAG); arrow.textContent = part; wrap.appendChild(arrow); } else wrap.appendChild(doc.createTextNode(part)); });
        node.parentNode?.replaceChild?.(wrap, node);
    }
    return found.length;
}
/** 감싼 것을 글자 노드 하나로 되돌려요(「원작 그대로 보기」 를 켤 때) → 되돌린 수 */
export function unwrapArrows(doc) {
    let n = 0;
    for (const wrap of [...(doc?.querySelectorAll?.(ARROW_WRAP) || [])]) { wrap.parentNode?.replaceChild?.(doc.createTextNode(wrap.textContent || ''), wrap); n++; }
    return n;
}
/** 지금 화면의 그 확장 화면을 한 번 훑어요(시작 · 「원작 그대로 보기」 를 끈 때) */
export function sweepArrows(doc) {
    if (rawView(doc)) return 0;
    let n = 0; for (const el of doc?.querySelectorAll?.(MB_SCOPE) || []) n += wrapArrows(el);
    return n;
}
/** 채팅 밖 기록에서 그 확장 화면에 새로 붙은 것만 골라요(테마가 감싼 것 · 「>」 없는 글자 노드는 버려요) */
export function arrowTargets(records, into = new Set()) {
    for (const r of records) for (const n of r.addedNodes || []) {
        if (n.nodeType === 3) { if (n.nodeValue.includes('>') && n.parentElement?.closest?.(MB_SCOPE)) into.add(n); continue; }
        if (n.nodeType !== 1 || n.tagName === 'BL-ARWT' || n.tagName === 'BL-ARW') continue;
        if (n.closest?.(MB_SCOPE) || (n.firstElementChild && n.querySelector?.(MB_SCOPE))) into.add(n);
    }
    return into;
}
/** 메시지 꾸미기가 볼 기록: 칩 자리 · 칩 카드 안에 새로 그린 것(테마가 감싼 것은 빼요 — 본문 · 스트리밍 글은 안 봐요) */
export function arrowRecord(record) {
    const t = record?.target; if (!t?.classList || !record.addedNodes?.length) return false;
    if (![...record.addedNodes].some(n => n.nodeType === 3 || (n.nodeType === 1 && n.tagName !== 'BL-ARWT'))) return false;
    return t.classList.contains('custom-ss-slot') || t.classList.contains('ss-slot') || !!t.closest?.('.ss-msgcard');
}
/** 1.7.8 같은 두 구독을 같이 쓰는 이웃 모듈(src/mb-diary.js 칩 점검 창 · src/mb-leftover.js 「원작 그대로 보기」) — 감시 허브 구독 자리를 늘리지 않게 여기서 나눠 불러요 */
const addedFns = new Set(), rawFns = new Set();
export const onMbAdded = fn => { addedFns.add(fn); return () => addedFns.delete(fn); };
export const onMbRawChange = fn => { rawFns.add(fn); return () => rawFns.delete(fn); };
const tell = (fns, arg) => { for (const fn of fns) try { fn(arg); } catch { /* 그 모듈 일 · 화살표는 그대로 */ } };
let arrowsOn = false;
export function startArrows(doc = globalThis.document, { watch = watchDom, decorate = addMessageDecorator, soon = fn => queueMicrotask(fn) } = {}) {
    if (arrowsOn || !doc?.body) return false;
    arrowsOn = true;
    try { sweepArrows(doc); } catch { /* 글자 그대로 */ }
    let wait = null;
    const flush = () => { const list = wait; wait = null; if (!list || rawView(doc)) return; for (const n of list) try { if (n.isConnected !== false) wrapArrows(n); } catch { /* 글자 그대로 */ } };
    // 그 확장의 화면 번역(같은 작업의 감시 콜백)이 글을 옮긴 뒤에 감싸게 한 박자(마이크로태스크) 미뤄요 — 여전히 그리기 전이에요
    try { watch(doc.body, { childList: true, subtree: true, exclude: '#chat', name: '미트볼 화살표' }, records => { if (addedFns.size) tell(addedFns, records); if (rawView(doc)) return; const had = wait; wait = arrowTargets(records, wait || new Set()); if (!wait.size) wait = null; else if (!had) soon(flush); }); } catch { /* 시작할 때 훑은 것만 */ }
    try { watch(doc.body, { attributes: ['data-bl-ext-raw'], name: '미트볼 화살표 (원작 그대로 보기)' }, () => { tell(rawFns); try { if (rawView(doc)) unwrapArrows(doc); else sweepArrows(doc); } catch { /* 글자 그대로 */ } }); } catch { /* 다음에 그릴 때부터 */ }   // 「원작 그대로 보기」 를 켜면 되돌리고 끄면 다시 훑어요
    onMbOff(doc, ['arrow'], () => { try { if (rawView(doc)) unwrapArrows(doc); else sweepArrows(doc); } catch { /* 글자 그대로 */ } });   // 1.7.3 스위치를 끄면 되돌리고 켜면 다시 훑어요
    try { decorate('미트볼 화살표', list => { if (rawView(doc)) return; for (const mes of list) for (const card of mes?.querySelectorAll?.('.ss-msgcard') || []) wrapArrows(card); }, { settle: 0, live: true, order: 95, filter: arrowRecord }); } catch { /* 채팅 밖만 */ }
    return true;
}
