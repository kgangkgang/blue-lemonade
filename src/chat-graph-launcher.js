// Keep chat file management native; load the branch map only when requested.
let started = false;
export function startChatGraph() {
    if (started) return;
    const popup = document.getElementById('select_chat_popup');
    const shadow = document.getElementById('shadow_select_chat_popup');
    const list = document.getElementById('select_chat_div');
    if (!popup || !shadow || !list) return;
    started = true;
    const tabs = document.createElement('div');
    tabs.className = 'bl-chat-view-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '채팅 보기');
    tabs.innerHTML = '<button type="button" role="tab" aria-selected="true" data-view="list"><i class="fa-solid fa-list" aria-hidden="true"></i>목록</button><button type="button" role="tab" aria-selected="false" data-view="map"><i class="fa-solid fa-diagram-project" aria-hidden="true"></i>분기 지도</button>';
    list.before(tabs);
    let controller = null, loading = null, mode = 'list', generation = 0, refreshTimer;
    const enabled = () => document.body.classList.contains('salty');
    const visible = () => !!shadow.style.display && shadow.style.display !== 'none';
    function select(next) {
        mode = next;
        generation++;
        popup.classList.toggle('bl-chat-map-on', next === 'map');
        for (const tab of tabs.children) tab.setAttribute('aria-selected', String(tab.dataset.view === next));
        if (next === 'list') controller?.hide();
    }
    async function openMap() {
        if (!enabled() || !visible()) return;
        select('map');
        const token = generation;
        try {
            loading ||= import('./chat-graph.js').catch(error => { loading = null; throw error; });
            const module = await loading;
            if (token !== generation || mode !== 'map' || !enabled() || !visible()) return;
            controller ||= module.createChatGraph(popup, () => { select('list'); document.getElementById('select_chat_search')?.focus(); });
            controller.show();
        } catch (error) {
            if (token !== generation) return;
            select('list');
            console.warn('[블루 레몬에이드] 분기 지도를 열지 못했습니다', error);
            globalThis.toastr?.error('분기 지도를 열지 못했어요. 목록에서 채팅을 확인해 주세요.');
        }
    }
    tabs.addEventListener('click', event => {
        const tab = event.target.closest('button[data-view]');
        if (!tab) return;
        if (tab.dataset.view === 'map') openMap(); else select('list');
    });
    tabs.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = event.key === 'ArrowLeft' || event.key === 'Home' ? 0 : 1;
        tabs.children[index].focus(); tabs.children[index].click();
    });
    new MutationObserver(() => {
        if (!visible()) { clearTimeout(refreshTimer); select('list'); }
    }).observe(shadow, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(() => { if (!enabled()) select('list'); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(() => {
        if (mode !== 'map' || !visible()) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => { if (mode === 'map' && visible()) controller?.refresh(); }, 250);
    }).observe(list, { childList: true });
    const ctx = SillyTavern.getContext();
    ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => { clearTimeout(refreshTimer); select('list'); });
}
