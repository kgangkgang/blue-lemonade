// 1.1.2 입력칸 높이 고정 · 자동 수정 밑줄 끄기 (설정 › 채팅 › 기타 「입력칸」 · 둘 다 기본 꺼짐) — 켤 때만 받는 모듈(features.js).
// 키보드 · 브라우저가 자동 수정한 낱말에 긋는 밑줄(아이폰의 파란 밑줄 등)이 잠깐 다른 줄에 보였다 돌아온다는 제보용이에요.
//   그 밑줄은 테마가 아니라 기기가 그려요. 입력칸이 한 줄 늘면 아래에 붙은 입력판이 위로 자라 앞 글이 화면에서 움직이는데,
//   그때 기기가 옛 자리에 그린 밑줄이 남는 것으로 보고 있어요(실제 기기로 확인하지는 못했어요).
//   hold      입력칸을 다섯 줄 높이로 두고 넘치면 안쪽 스크롤 — <style> 하나. 줄이 늘어도 앞 글이 움직이지 않아요.
//   noCorrect 입력칸에 autocorrect="off" · spellcheck="false" — 밑줄을 긋는 기능을 꺼요. 끄면 원래 값으로 되돌려요.
// 입력창에 리스너를 걸지 않고 입력값 · 커서를 건드리지 않아요(그래서 제로에서도 받아요). 꺼져 있으면 이 파일을 받지 않아요.
const STYLE_ID = 'bl-input-box';
// 다섯 줄(줄 높이 1.55 · 위아래 여백 4px — css/04-send-form.css 와 같은 값). 입력칸 숨기기(특이도 2,2,1)는 그대로 이겨요.
const HOLD_CSS = 'body.salty #send_textarea{field-sizing:fixed!important;height:calc(1.55em*5 + 8px)!important;overflow-y:auto!important}';
const ATTRS = [['autocorrect', 'off'], ['spellcheck', 'false']];

let kept = null;

function syncHold(on) {
    const style = document.getElementById(STYLE_ID);
    if (!on) { style?.remove(); return; }
    if (style) return;
    const el = document.createElement('style');
    el.id = STYLE_ID; el.textContent = HOLD_CSS;
    document.head.append(el);
}

function syncAttrs(on) {
    if (on) {
        const el = document.getElementById('send_textarea');
        if (kept || !el) return;
        kept = { el, was: ATTRS.map(([name]) => el.getAttribute(name)) };
        for (const [name, value] of ATTRS) el.setAttribute(name, value);
        return;
    }
    if (!kept) return;
    const { el, was } = kept; kept = null;
    ATTRS.forEach(([name, value], i) => {
        if (el.getAttribute(name) !== value) return;   // 그 사이 다른 곳에서 바꿨으면 그대로
        if (was[i] === null) el.removeAttribute(name); else el.setAttribute(name, was[i]);
    });
}

/** features.js 가 설정이 바뀔 때마다 부른다. box = settings.inputBox (테마를 끄면 빈 객체) */
export function syncInputBox(box) {
    syncHold(box?.hold === true);
    syncAttrs(box?.noCorrect === true);
}

/** 시험용 */
export const _forTest = { STYLE_ID, HOLD_CSS, ATTRS };
