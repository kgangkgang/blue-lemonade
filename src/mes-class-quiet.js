// 8.2.7 실리태번 refreshSwipeButtons 는 메시지 하나가 그려질 때마다 · 채팅을 열 때마다 넘길 수 없는 메시지 전부에 classList.remove('swipes_visible', 'last_swipe') 를 불러요.
//   없는 클래스를 빼도 브라우저는 class 를 같은 값으로 다시 써 변경 기록을 남기고, 실리태번 keyboard.js 감시는 기록마다 그 메시지 아래를
//   선택자 30여 개로 훑어요(메시지 하나 그릴 때 기록 300개 남짓 · 테마가 메시지마다 단추 · 꾸밈을 달아 훑을 양도 커요).
//   메시지(class 에 mes 가 있는 요소)의 classList 에서만, 바뀌는 것이 없는 add · remove(이미 있는 것 붙이기 · 없는 것 빼기, class 글자가 이미
//   정리된 꼴)는 브라우저까지 보내지 않아요 — class 값 · 화면 · 감시자가 받는 바뀐 기록은 같고, 같은 값 기록만 안 생겨요.
//   그 밖(메시지가 아님 · 토큰이 이상함 · 글자가 정리 안 됨 · 값이 바뀜)은 원래 함수 그대로예요.
//   (첫 판은 #chat 에 붙은 메시지마다 감쌌는데, 채팅을 열 때는 메시지를 붙인 바로 그 작업 안에서 빼기가 와 새 메시지를 놓쳤어요 → 공용 함수 자리에서 메시지인지 봐요)
const SPACE = /[\t\n\f\r ]/;
const UNTIDY = /^ | $| {2}|[\t\n\f\r]/;
let proto = null, nativeAdd = null, nativeRemove = null;
// 1.8.9 끌 때 다른 확장이 우리 위에 또 감싸 둔 상태면 우리 겹(quietAdd · quietRemove)이 그 사슬 안에 남아요. 그때 원래 함수 기억까지 비우면, 다시 켤 때
//   「남의 겹(안에 우리 겹)」을 원래 함수로 잡고 또 감싸 quietAdd → 남의 겹 → quietAdd … 로 스택이 넘칠 때까지 서로를 불러요(코드 색 끄기 8.2.4 · 미트볼 getContext 1.8.1 과 같은 꼴).
//   그래서 깨끗이 되돌린 자리만 비우고, 남은 겹은 쉬게(resting) 둔 채 다시 켤 때 그대로 써요.
let resting = false;

/** 바꿀 것이 없고, 원래 함수가 써도 지금과 같은 글자일 때만 참 */
export function nothingToWrite(list, tokens, present) {
    if (!tokens.length) return false;
    for (const token of tokens) if (typeof token !== 'string' || !token || SPACE.test(token) || list.contains(token) !== present) return false;
    const value = list.value;
    return value !== '' && !UNTIDY.test(value) && value.split(' ').length === list.length;
}
function quietAdd(...tokens) { if (!resting && this.contains('mes') && nothingToWrite(this, tokens, true)) return; return nativeAdd.apply(this, tokens); }
function quietRemove(...tokens) { if (!resting && this.contains('mes') && nothingToWrite(this, tokens, false)) return; return nativeRemove.apply(this, tokens); }

/** TokenList: 시험용 가짜(기본은 브라우저 DOMTokenList) */
export function startMesClassQuiet(TokenList = globalThis.DOMTokenList) {
    const p = TokenList?.prototype;
    if (proto && resting && p === proto) { resting = false; return true; }   // 남의 겹 아래에 남아 쉬던 우리 겹을 다시 깨워요(또 감싸지 않아요)
    if (proto || !p || typeof p.add !== 'function' || typeof p.remove !== 'function') return false;
    if (p.add === quietAdd || p.remove === quietRemove) return false;   // 이미 우리 겹이 걸린 자리는 원래 함수로 잡지 않아요
    proto = p; nativeAdd = p.add; nativeRemove = p.remove; resting = false;
    p.add = quietAdd; p.remove = quietRemove;
    return true;
}

export function stopMesClassQuiet() {
    if (!proto) return;
    // 둘 다 우리 겹이 맨 바깥일 때만 깨끗이 되돌려요. 하나라도 남이 그 위에 감쌌으면 둘 다 그대로 두고 통과만 시켜요(원래 함수 기억도 그대로)
    if (proto.add === quietAdd && proto.remove === quietRemove) { proto.add = nativeAdd; proto.remove = nativeRemove; proto = null; nativeAdd = nativeRemove = null; resting = false; return; }
    resting = true;
}
