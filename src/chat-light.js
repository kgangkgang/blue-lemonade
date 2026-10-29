// 긴 채팅 가볍게 (10-29 perf-typing · 성능 빈틈 전수조사 7절 「페르소나 설명 타이핑」 계기 추적)
//
// 왜: 실리태번 본체 CSS 가 body 를 :has() 주어로 쓴다(body:has(.drawer-content.open) …). 그래서 문서 어디서든 노드가 들어오거나 빠지면
//   (페르소나 설명 한 글자 → 실리태번이 목록의 .ch_description 글을 다시 씀 · 전개 지시 창의 상태 글 …) Blink 가 body 에서 :has 무효화 집합을
//   다시 적용하고, 그 집합에 div · p · i · small 같은 태그가 들어 있어 300메시지 채팅의 요소 1만 4천 개가 글자마다 다시 계산됐어요
//   (PC 글자당 재계산 117~166ms · 순정 40ms — 순정에도 같은 일이 있지만 테마의 규칙이 많아 요소마다 더 비쌌어요).
// 어떻게: 메시지가 THRESHOLD 개 이상 그려져 있으면 #chat 에 bl-chat-light 를 붙이고, CSS(css/05-chat.css)가 화면 밖 메시지에
//   content-visibility: auto 를 걸어 그 메시지 안의 스타일 · 배치 계산을 건너뛴다(브라우저가 화면 가까이 오면 다시 그린다 · 한 번 그린 크기는 auto 로 기억).
//   마지막 메시지(스트리밍 · 스와이프 줄) · 편집 중 · 메뉴 열린 · 고른 메시지는 CSS 가 뺀다. 리그 재현: 글자당 재계산 163 → 48ms · 입력 지연 240 → 83ms.
// 여기서는 #chat 에만 childList 감시자(subtree 없음)를 걸어 .mes 수를 센다. 설정: 채팅 › 화면 「긴 채팅의 화면 밖 메시지 가볍게」(chat.chatLight · 기본 켬).
export const THRESHOLD = 60;
export const CLASS = 'bl-chat-light';
let on = false, mo = null, chat = null;

/** 메시지 수를 세어 클래스를 맞춘다. 돌려주는 값: 가볍게 상태인지 */
export function measure(el = chat) {
    if (!el) return false;
    const light = on && el.querySelectorAll(':scope > .mes').length >= THRESHOLD;
    if (el.classList.contains(CLASS) !== light) el.classList.toggle(CLASS, light);   // 같으면 쓰지 않는다 (속성 변경 → 감시자 · 재계산)
    return light;
}

export function syncChatLight(enabled) {
    on = !!enabled;
    if (!on) { mo?.disconnect(); mo = null; if (chat) chat.classList.remove(CLASS); chat = null; return; }
    const el = document.getElementById('chat');
    if (!el) { mo?.disconnect(); mo = null; chat = null; return; }
    if (el !== chat) {
        mo?.disconnect();
        chat = el;
        mo = new MutationObserver(() => measure());
        mo.observe(el, { childList: true });
    }
    measure();
}

export const _test = { state: () => ({ on, watching: !!mo, chat }) };
