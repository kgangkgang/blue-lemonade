// Keep chat file management native; load the branch map only when requested.
let started = false;
let openLibraryAction=null;
/** Open the existing native chat manager before selecting its lazy library tab. */
export async function openChatLibrary(){
    startChatGraph();
    const owner=()=>{const c=SillyTavern.getContext();return JSON.stringify([c.groupId,c.characters?.[c.characterId]?.avatar,c.getCurrentChatId?.()??c.chatId]);};
    const key=owner();
    document.getElementById('option_select_chat')?.click();
    for(let i=0;i<50;i++){
        if(owner()!==key)return false;
        const shadow=document.getElementById('shadow_select_chat_popup');
        if(openLibraryAction&&shadow?.style.display&&shadow.style.display!=='none'){await openLibraryAction();return !!document.querySelector('.bl-chat-library:not([hidden])');}
        await new Promise(resolve=>setTimeout(resolve,100));
    }
    return false;
}
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
    tabs.innerHTML = '<button type="button" role="tab" aria-selected="true" data-view="list"><i class="fa-solid fa-list" aria-hidden="true"></i>목록</button><button type="button" role="tab" aria-selected="false" data-view="map"><i class="fa-solid fa-diagram-project" aria-hidden="true"></i>분기 지도</button><button type="button" role="tab" aria-selected="false" data-view="library">정리·비교</button>';
    list.before(tabs);
    let controller = null, loading = null, library=null, libraryLoading=null, mode = 'list', generation = 0, refreshTimer;
    const enabled = () => document.body.classList.contains('salty');
    const visible = () => !!shadow.style.display && shadow.style.display !== 'none';
    function select(next) {
        mode = next;
        generation++;
        popup.classList.toggle('bl-chat-map-on', next === 'map');
        popup.classList.toggle('bl-chat-library-on',next==='library');
        for (const tab of tabs.children) tab.setAttribute('aria-selected', String(tab.dataset.view === next));
        if (next !== 'map') controller?.hide();
        if (next !== 'library') library?.hide();
    }
    async function openLibrary(){
        if(!enabled()||!visible())return;select('library');const token=generation;
        try{libraryLoading||=import('./chat-library.js').catch(error=>{libraryLoading=null;throw error;});const module=await libraryLoading;if(token!==generation||mode!=='library'||!enabled()||!visible())return;library||=module.createChatLibrary(popup);await library.show();}
        catch(error){if(token!==generation)return;select('list');globalThis.toastr?.error('채팅 정리함을 열지 못했어요. 목록에서 다시 시도해 주세요.');console.warn('[Blue Lemonade] 채팅 정리함',error);}
    }
    openLibraryAction=openLibrary;
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
        if (tab.dataset.view === 'map') openMap(); else if(tab.dataset.view==='library')openLibrary();else select('list');
    });
    tabs.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current=[...tabs.children].indexOf(document.activeElement),index=event.key==='Home'?0:event.key==='End'?tabs.children.length-1:(current+(event.key==='ArrowLeft'?-1:1)+tabs.children.length)%tabs.children.length;
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
