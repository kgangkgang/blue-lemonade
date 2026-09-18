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
    let pending = 0;
    let active = false;
    let targets = new Set();
    // 폰은 스크롤바 자체를 숨기므로 재지 않는다 (재는 것마다 강제 레이아웃 — 답변이 자랄 때마다 돌던 것, 2.5.2)
    const phone = matchMedia('(max-width: 1000px)');
    function check() {
        pending = 0;
        if (!active) return;
        const next = new Set(document.querySelectorAll(SEL));
        if (next.size !== targets.size || [...next].some(el => !targets.has(el))) {
            sizes.disconnect(); content.disconnect();
            for (const el of next) {
                sizes.observe(el);
                content.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
            }
            targets = next;
        }
        const updates = [];
        for (const el of targets) {
            if (!el.getClientRects().length) continue;
            const cs = getComputedStyle(el);
            const scrolls = /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
            if (el.classList.contains(CLASS) !== scrolls) updates.push([el, scrolls]);
        }
        for (const [el, scrolls] of updates) el.classList.toggle(CLASS, scrolls);
    }
    // 숨은 탭은 관찰을 해제하고, 보이는 화면의 변경만 프레임당 한 번 묶는다.
    const schedule = () => { if (!pending && active) pending = requestAnimationFrame(check); };
    const sizes = new ResizeObserver(schedule);
    const content = new MutationObserver(schedule);
    // 채팅 본문 · 입력줄 안의 변화는 서랍 스크롤과 무관 — 답변이 한 글자씩 자라는 동안 재지 않는다
    const inChat = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat, #send_form, #form_sheld');
    const observer = new MutationObserver((list) => { if (!list.every(m => inChat(m.target))) schedule(); });
    // 2.9.4: 폰에서는 schedule 이 아무것도 안 하므로 감시 자체를 걸지 않는다 — 걸어 두면 답변이 자라는 동안 바뀌는 요소마다
    // 변화 기록이 만들어지고 콜백이 돌았다 (4배 느린 CPU 에서 12초에 8ms). 폭이 1000px 을 넘나들면 그때 걸거나 뗀다.
    const watch = () => {
        const next = document.body.classList.contains('salty') && !phone.matches && !document.hidden;
        if (next === active) return;
        active = next;
        if (active) {
            observer.observe(document.body, { childList: true, subtree: true });
            schedule();
        } else {
            cancelAnimationFrame(pending); pending = 0;
            observer.disconnect(); sizes.disconnect(); content.disconnect(); targets.clear();
        }
    };
    watch();
    window.addEventListener('resize', schedule);
    phone.addEventListener('change', () => { watch(); schedule(); });
    new MutationObserver(watch).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', watch);
    schedule();
}
