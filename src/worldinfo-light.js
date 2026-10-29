// 월드인포 큰 목록 경량화 (8.2.2 뒤 · 성능): 한 쪽에 항목이 많이(80개 이상) 보이면 화면 밖 접힌 항목의 그리기 · 재계산을 건너뛴다.
// 실리태번 1.19 의 목록: #world_popup_entries_list > .world_entry > form > .inline-drawer > (.inline-drawer-header + .inline-drawer-content). 접힘 = 내용이
//   display:none(기본), 펼침 = 인라인 style display:block (slideToggle · 유틸 toggleDrawer). 드래그는 jQuery UI sortable — 끌리는 항목 .ui-sortable-helper,
//   빈 자리 .ui-sortable-placeholder. 쪽 크기는 10~1000(기본 25)이라 80개 넘게 보이는 건 사용자가 쪽을 크게 잡았을 때다.
// 어떻게: 여기서는 목록 뿌리에만 childList 감시자(subtree 없음)를 걸어 .world_entry 수를 세고, 80개 이상이면 목록에 bl-wi-light 클래스를 붙인다.
//   실제 건너뛰기는 CSS(css/12-worldinfo.css): .bl-wi-light > .world_entry 중 펼친 항목(:has 머리 줄 토글 아이콘 .up — 실리태번이 내용 display 와 함께 바꾼다;
//   :has 안에 [style*=] 를 두면 문서 어디서든 style 이 바뀔 때마다 전체 스타일을 다시 계산하므로 쓰지 않는다) · 드래그 중 · 자리표시가 아닌 것에
//   content-visibility:auto 와 contain-intrinsic-size(접힌 머리 줄 높이 · 마지막으로 그린 크기 기억)를 건다. 화면 안 항목은 브라우저가 알아서 그린다.
//   Select2 지연 초기화는 실리태번 내부 구조 의존이 커서 하지 않는다.
// 바이바이가 켜져 있으면 쉰다(같은 요소에 content-visibility 를 건다 — features.js restingFor). 설정: 채팅 › 화면 › 가볍게 「월드인포 긴 목록 가볍게」 (chat.worldInfoLight, 기본 켬)
export const THRESHOLD = 80;
export const LIST_ID = 'world_popup_entries_list';
export const CLASS = 'bl-wi-light';
let on = false, mo = null, list = null;

/** 항목 수를 세어 클래스를 맞춘다. 돌려주는 값: 가볍게 상태인지 */
export function measure(el = list) {
    if (!el) return false;
    const light = on && el.querySelectorAll(':scope > .world_entry').length >= THRESHOLD;
    el.classList.toggle(CLASS, light);
    return light;
}

export function syncWorldInfoLight(enabled) {
    on = !!enabled;
    if (!on) { mo?.disconnect(); mo = null; if (list) list.classList.remove(CLASS); list = null; return; }
    const el = document.getElementById(LIST_ID);
    if (!el) { mo?.disconnect(); mo = null; list = null; return; }   // 아직 없으면 다음 설정 적용 때 (index.html 에 고정된 칸이라 보통 바로 있다)
    if (el !== list) {
        mo?.disconnect();
        list = el;
        mo = new MutationObserver(() => measure());
        mo.observe(el, { childList: true });
    }
    measure();
}

/** 시험용 */
export const _forTest = { state: () => ({ on, watching: !!mo, light: !!list?.classList.contains(CLASS) }) };
