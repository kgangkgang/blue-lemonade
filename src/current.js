// 캐릭터 목록: 지금 채팅 중인 캐릭터 · 그룹 줄에 .salty-current (실리태번은 목록에 표시를 안 해 CSS 만으로는 못 찾음)
const CLASS = 'salty-current';

function currentSelector() {
    const ctx = SillyTavern.getContext();
    if (ctx.groupId) return `.group_select[data-grid="${CSS.escape(String(ctx.groupId))}"]`;
    const id = ctx.characterId;
    if (id === undefined || id === null || id === '') return null;
    return `.character_select[data-chid="${CSS.escape(String(id))}"]`;
}

function mark() {
    const block = document.getElementById('rm_print_characters_block');
    if (!block) return;
    const sel = currentSelector();
    const want = sel ? block.querySelector(sel) : null;
    for (const el of block.querySelectorAll(`.${CLASS}`)) {
        if (el !== want) el.classList.remove(CLASS);
    }
    want?.classList.add(CLASS);
}

let queued = false;
function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
        queued = false;
        mark();
    });
}

export function startCurrentMark() {
    const { eventSource, event_types } = SillyTavern.getContext();
    eventSource.on(event_types.CHAT_CHANGED, schedule);
    if (event_types.GROUP_UPDATED) eventSource.on(event_types.GROUP_UPDATED, schedule);
    // 목록은 거르기 · 쪽 넘김 · 편집 때마다 새로 그려짐 → 줄이 바뀌면 다시 붙임
    const block = document.getElementById('rm_print_characters_block');
    if (block) new MutationObserver(schedule).observe(block, { childList: true });
    schedule();
}
