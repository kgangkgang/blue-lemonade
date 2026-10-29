// 코드 하이라이트 끄기 (8.2.2 뒤 · 성능): 켜면 채팅 메시지의 코드블록 구문 강조(hljs)를 건너뛴다 — 코드블록이 많은 채팅에서 폰이 느릴 때.
// 실리태번 1.19 의 길: 메시지를 그린 뒤 addCopyToCodeBlocks(messageElement) 가 `pre code` 마다 hljs.highlightElement() 를 부르고 복사 단추를 붙인다.
//   그 호출은 innerHTML 을 넣은 바로 뒤 같은 동기 흐름이라 밖에서 그 사이에 끼어들 수 없다(nohighlight 클래스를 먼저 붙일 자리가 없다 — 변이 감시자는 뒤에 돈다).
//   hljs 의 before:highlightElement 플러그인도 건너뛰기를 못 한다(건너뛸지는 플러그인 전에 정해진다). 그래서 hljs 객체(lib.js 가 script.js 와 window.hljs 에
//   같은 객체를 준다)의 highlightElement 한 함수만 감싼다 — 빈 함수로 바꾸지 않고, 켜져 있고 메시지 본문(.mes_text · .mes_reasoning) 안의 코드일 때만
//   원래 함수를 부르지 않는다. 그 밖(다른 확장 · 팝업)은 그대로 원래 함수로. 끄면 감싼 함수를 원래대로 되돌린다(누가 그 뒤에 또 감쌌으면 두고 통과만 시킨다).
// 건너뛴 코드블록엔 bl-code-plain 클래스를 붙인다(표시용 — 코드 칸 색은 테마의 `.mes_text pre code` 규칙(css/06-chat-text.css)이 .hljs 없이도 입힌다). 이미 그려진 메시지는 다시 그릴 때부터.
// 칵테일이 켜져 있으면 쉰다(칵테일이 hljs 를 직접 바꾼다 — features.js restingFor). 설정: 채팅 › 화면 › 가볍게 「코드 색 입히기 끄기」 (chat.codePlain, 기본 끔)
export const SKIP_IN = '.mes_text, .mes_reasoning';
let on = false, original = null, hooked = null;   // hooked: 우리가 감싼 hljs 객체

function wrapper(el, ...rest) {
    if (on && el?.closest?.(SKIP_IN)) { el.classList?.add('bl-code-plain'); return undefined; }
    return original.call(this, el, ...rest);
}
function hljsObject() { const h = globalThis.hljs; return h && typeof h.highlightElement === 'function' ? h : null; }

export function syncCodePlain(enabled) {
    on = !!enabled;
    if (on) {
        if (hooked) return;
        const h = hljsObject(); if (!h) return;   // 아직 없으면 다음 설정 적용 때
        original = h.highlightElement; hooked = h;
        h.highlightElement = wrapper;
        return;
    }
    if (!hooked) return;
    // 깨끗이 되돌릴 수 있을 때만 — 누가 그 뒤에 또 감쌌으면 그 사슬에 우리 겹이 남으니 original · hooked 를 두고 통과만 시킨다 (on=false).
    // 8.2.4 검토: hooked 까지 비우면 다시 켤 때 남의 겹(안에 우리 겹)을 original 로 잡고 또 감싸 메시지 밖 코드에서 서로를 끝없이 불렀다 — 남은 겹을 그대로 다시 쓴다
    if (hooked.highlightElement === wrapper) { hooked.highlightElement = original; original = null; hooked = null; }
}

/** 시험용 */
export const _forTest = { state: () => ({ on, hooked: !!hooked }), wrapper };
