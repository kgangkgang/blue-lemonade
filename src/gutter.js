// 스크롤바 자리 맞추기 (PC): 실리태번 서랍 · 목록 가운데 어떤 칸이 스크롤하는지는 실리태번 판과 내용 길이에 따라 다르다.
// 스크롤바가 실제로 생긴 칸에만 bl-scrolls 를 붙여 두면 style.css 가 그 칸에만 양쪽 스크롤바 홈을 잡는다
// (안 스크롤하는 칸에 홈을 미리 잡으면 좁은 화면에서 12px 을 그냥 버린다 — surfaces:gutter 주석 참고).
// 폰(≤1000px)에서는 스크롤바를 아예 숨기므로 이 클래스는 아무 규칙도 타지 않는다.
const SEL = [
    '#left-nav-panel', '#right-nav-panel', '#user-settings-block', '#PersonaManagement', '#rm_print_characters_block',
    '#WorldInfo', '#AdvancedFormatting', '#Backgrounds', '#floatingPrompt', '#rm_extensions_block', '#rm_api_block',
    '.scrollableInner', '.rm_tag_controls',
].join(', ');
const CLASS = 'bl-scrolls';

export function startGutterWatch() {
    let pending = false;
    // 폰은 스크롤바 자체를 숨기므로 재지 않는다 (재는 것마다 강제 레이아웃 — 답변이 자랄 때마다 돌던 것, 2.5.2)
    const phone = matchMedia('(max-width: 1000px)');
    function check() {
        pending = false;
        if (!document.body.classList.contains('salty') || phone.matches) return;
        for (const el of document.querySelectorAll(SEL)) {
            const cs = getComputedStyle(el);
            const scrolls = /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
            if (el.classList.contains(CLASS) !== scrolls) el.classList.toggle(CLASS, scrolls); // 바뀔 때만 (감시가 자기 변경에 다시 깨지 않게)
        }
    }
    // rAF 는 숨은 탭에서 안 돈다 → setTimeout 으로 한 틱 모아서
    const schedule = () => { if (!pending && !phone.matches) { pending = true; setTimeout(check, 0); } };
    // 채팅 본문 · 입력줄 안의 변화는 서랍 스크롤과 무관 — 답변이 한 글자씩 자라는 동안 재지 않는다
    const inChat = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat, #send_form, #form_sheld');
    new MutationObserver((list) => { if (!list.every(m => inChat(m.target))) schedule(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', schedule);
    phone.addEventListener('change', schedule);
    setInterval(schedule, 1000); // 서랍 안 내용이 자라는 경우(목록 채우기)도 놓치지 않게
    schedule();
}
