// 1.9.5 월드인포 쪽수 고르기(「25 / page」)가 영어로 남던 것 — 그 쪽수 줄 하나만 보는 감시자.
// 실리태번은 페르소나 · 그룹 목록의 쪽수 고르기를 utils.js renderPaginationDropdown(t`/ page`)으로 그려서 한국어 표가 들어오면 한국어로 나오는데,
// 월드인포 항목 목록(world-info.js displayWorldEntries)만 쪽수 모듈의 기본 글을 그대로 써요 → 표와 상관없이 늘 「N / page」.
// 월드를 고르거나 항목을 고치거나 쪽을 넘길 때마다 다시 그리니 한 번 고쳐서는 영어로 돌아와요.
// → 쪽수 줄(#world_info_pagination) 안만 봐요(단추 몇 개 · 고르개 하나 — 항목 본문 · 채팅은 안 봄). 고친 글은 다시 맞지 않아 되풀이하지 않아요.
export const BUILTIN_PAGE_SIZE_HOSTS = ['world_info_pagination'];

/** host 안의 쪽수 고르기를 지금 한 번 고치고, 다시 그려질 때마다 fix(host) 를 불러요. 돌려주는 함수로 떼요. host 가 없으면 null */
export function watchPageSize(host, fix, Observer = globalThis.MutationObserver) {
    if (!host || typeof fix !== 'function') return null;
    const run = () => { try { fix(host); } catch (error) { console.error('[Blue Lemonade] page-size-watch', error); } };
    run();
    if (typeof Observer !== 'function') return () => {};
    const observer = new Observer(run);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
}
