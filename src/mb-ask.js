// 1.6.1 미트볼 상태창의 「한 번 누르면 바로 지워지는」 단추에 테마 확인 창을 덧대요 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   그 확장의 큰 지우기(상태창 삭제 · 칸 전체 삭제 · 기록 전부 …)는 스스로 물어봐요. 여기 표의 단추는 묻지 않고 바로 지우고, 「마지막 편집 되돌리기」 로도 안 돌아와요
//   (알림함 · 이야기 장치의 비밀 · 기억 · 편지는 편집 기록을 거치지 않고 바로 지워져요 · 연락 「다시 받기」 는 뒤 말풍선을 지우고 AI 를 1회 불러요). 폰에서는 옆 단추와 붙어 있어 잘못 누르기 쉬워요.
//   하는 일: 문서의 누름(잡는 단계) 하나만 들어요 → 표의 단추면 그 누름을 멈추고 실리태번 확인 창을 띄운 뒤, 「지우기」 를 고르면 같은 단추를 한 번 다시 눌러 줘요.
//   그 확장의 파일 · 자료 · 함수는 안 건드려요(누름을 한 번 미룰 뿐). 감시자 · 타이머 없음. 확인 창을 못 띄우는 환경이면 아무것도 안 막아요(원래대로 바로 동작).
//   「원작 그대로 보기」(data-bl-ext-raw) · 테마 꺼짐(body.salty 없음)이면 아무것도 안 해요. 시험: tools/tests/mb-ask.mjs
import { mbOff } from './mb-switch.js';   // 1.7.3 미트볼 맞춤 스위치 「바로 지워지는 단추에 한 번 묻기」

/** 물어볼 단추 표: [선택자, 창 제목, 설명, 확인 단추 글(없으면 「지우기」)]. 그 확장이 스스로 묻는 단추 · 편집 기록으로 되돌릴 수 있는 한 줄 지우기는 넣지 않아요. */
export const ASK = [
    ['.ss-inbox [data-clear]', '알림함을 모두 비울까요?', '이 채팅의 알림이 전부 지워져요. 되돌릴 수 없어요.'],
    ['.ss-scope [data-act="cmsgre"]', '이 답장을 다시 받을까요?', '이 말풍선 뒤에 이어진 상대 말풍선이 지워지고 새 답을 받아요(AI 1회).', '다시 받기'],
    ['.ss-story [data-st="secdel"]', '이 사람의 비밀을 지울까요?', '이미 연 비밀도 같이 사라져요. 되돌릴 수 없어요.'],
    ['.ss-story [data-st="memdel"]', '이 사람의 기억을 지울까요?', '본편에서도 빠져요. 되돌릴 수 없어요.'],
    ['.ss-story [data-st="maildel"]', '이 편지를 지울까요?', '되돌릴 수 없어요.'],
];
const ALL = ASK.map(row => row[0]).join(', ');
const SCOPE = '.ss-scope, .ss-root, .ss-panel, dialog.ss-dlg';   // 그 확장이 그리는 화면 안의 단추만(같은 속성 이름을 쓰는 다른 확장은 안 건드려요)
const KEYS = ['data-act', 'data-st', 'data-arg', 'data-clear'];

const active = doc => !!doc?.body?.classList?.contains?.('salty') && !doc.body.hasAttribute?.('data-bl-ext-raw') && !mbOff('ask', doc);
/** 누른 자리에서 표의 단추를 찾아요 → { el, row } 또는 null */
export function askTarget(target, doc = target?.ownerDocument) {
    if (!active(doc)) return null;
    const el = target?.closest?.(ALL);
    if (!el || !el.closest?.(SCOPE)) return null;
    const row = ASK.find(r => el.matches?.(r[0]));
    return row ? { el, row } : null;
}
/** 확인 창 뒤에 그 확장이 화면을 다시 그렸으면 같은 단추(같은 속성 값)를 새 화면에서 찾아요 */
export function sameButton(doc, el) {
    if (el?.isConnected !== false) return el;
    const want = KEYS.map(k => [k, el.getAttribute?.(k)]).filter(([, v]) => v != null);
    for (const cand of doc?.querySelectorAll?.(ALL) || []) if (cand.closest?.(SCOPE) && want.every(([k, v]) => cand.getAttribute?.(k) === v)) return cand;
    return null;
}
async function stConfirm(title, text, doc, okButton = '지우기') {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.callGenericPopup || !ctx.POPUP_TYPE || !ctx.POPUP_RESULT) return null;   // 못 띄우면 null — 막지 않아요
    const box = doc.createElement('div');
    const b = doc.createElement('b'); b.textContent = title;
    const p = doc.createElement('p'); p.textContent = text;
    box.append(b, p);
    return await ctx.callGenericPopup(box, ctx.POPUP_TYPE.CONFIRM, '', { okButton, cancelButton: '취소' }) === ctx.POPUP_RESULT.AFFIRMATIVE;
}
let on = false;
export function startMbAsk(doc = globalThis.document, { ask = stConfirm, can = () => { const c = globalThis.SillyTavern?.getContext?.(); return !!(c?.callGenericPopup && c.POPUP_TYPE && c.POPUP_RESULT); } } = {}) {
    if (on || !doc?.addEventListener) return false;
    on = true;
    let pass = null, open = false;
    doc.addEventListener('click', event => {
        let hit = null;
        try { hit = askTarget(event.target, doc); } catch { hit = null; }
        if (!hit) return;
        if (pass && pass === hit.el) { pass = null; return; }   // 확인을 받은 누름 — 그대로 보내요
        let ready = false; try { ready = !!can(); } catch { ready = false; }
        if (!ready) return;                                     // 확인 창이 없는 환경 — 원래대로
        event.preventDefault(); event.stopImmediatePropagation();
        if (open) return;                                       // 창이 떠 있는 동안의 겹친 누름은 버려요
        open = true;
        Promise.resolve().then(() => ask(hit.row[1], hit.row[2], doc, hit.row[3] || '지우기')).then(ok => {
            open = false;
            if (ok !== true || !active(doc)) return;
            const el = sameButton(doc, hit.el); if (!el) return;
            pass = el;
            try { el.click(); } finally { pass = null; }
        }).catch(() => { open = false; });
    }, true);
    return true;
}
