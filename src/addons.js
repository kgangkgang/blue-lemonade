import { toolSection } from './addon-layout.js';
// Optional integrations share standalone settings, but only one owner runs per page.
import { getSettings, saveSettings } from './settings.js';
import { restorePendingAddons, saveAddonsNow } from './addon-save.js';
const running=new Set(),failed=new Map(),loading=new Set();
let started=false,saving=0,saveError='';
const folders={order:'panel-order',perf:'perf-assist',words:'word-replace',models:'model-register',modelorder:'model-order'};
const names={order:'확장 순서',perf:'성능 보조',words:'단어 치환',capture:'채팅 캡처',models:'모델 등록',modelorder:'모델 순서'};
const icons={words:'fa-arrow-right-arrow-left',capture:'fa-camera',order:'fa-arrow-down-short-wide',perf:'fa-gauge-high',models:'fa-circle-plus',modelorder:'fa-arrow-down-wide-short'};
const tabs=[['watchdog','끊김 감시','heart-pulse'],['timer','로딩 시간','stopwatch'],['perf','성능 보조','gauge-high'],['log','요청 로그','receipt'],['dedupe','저장 정리','floppy-disk']];
const changed=()=>window.dispatchEvent(new Event('bl:addons-state'));
export async function conflict(id){
    const {extensionNames,extension_settings}=await import('../../../../extensions.js');
    const key=`third-party/${folders[id]}`;
    return extensionNames.includes(key)&&!extension_settings.disabledExtensions?.includes(key);
}
async function stylesheet(id){
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(`./addons/${id}/style.css`,import.meta.url).href;
    await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{link.remove();reject(Error('스타일 로딩 시간 초과'));},15000);
        link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);link.remove();reject(Error('스타일을 읽지 못했어요.'));};document.head.append(link);
    });
}
async function persist(){saving++;saveError='';changed();try{await saveAddonsNow();}catch(error){saveError=error.message;throw error;}finally{saving--;changed();}}
export async function startAddons(){
    if(started)return;started=true;
    const restored=await restorePendingAddons();
    if(restored)persist().catch(()=>{});
    const s=getSettings();if(!s.enabled)return;
    for(const id of ['perf','order','models','modelorder','words']){
        if(!s.addons[id])continue;
        if(await conflict(id)){
            failed.set(id,'기존 단독 확장이 켜져 있어 테마 쪽은 대기 중이에요. 둘 중 하나를 끄고 새로고침해 주세요.');
            if(id==='words'){s.addons.words=false;saveSettings();}
            globalThis.toastr?.warning(`${names[id]}: ${failed.get(id)}`,'Blue Lemonade');continue;
        }
        if(id==='words')continue;
        loading.add(id);changed();
        try{
            await stylesheet(id);
            if(id==='perf'){
                const suite=await import('./addons/perf/start.js');
                if(suite.failures.length)failed.set(id,'일부 도구를 시작하지 못했어요. 세부 설정에서 확인해 주세요.');
            }else if(id==='modelorder'){
                await import('./addons/modelorder/index.js');
            }else if(id==='models'){
                await import('./addons/models/index.js');
            }else{
                (await import('./addons/order/state.js')).initSettings();
                (await import('./addons/order/order.js')).startEngine();
            }
            running.add(id);await syncAddonIcons();
        }catch(error){failed.set(id,'시작하지 못했어요. 새로고침 후 다시 확인해 주세요.');console.error('[Blue Lemonade]',error);}
        finally{loading.delete(id);changed();}
    }
}
export function addonMarkup(s,id){
    const on=!!s.addons[id],needsReload=['order','perf','models','modelorder'].includes(id)&&on!==running.has(id);
    const status=saving?'설정 저장 확인 중…':saveError||(loading.has(id)?'기능을 불러오는 중…':failed.get(id))||(needsReload?'새로고침 대기':on?'사용 중':'꺼짐');
    const header=`<header class="bl-addon-header"><div><h3><i class="fa-solid ${icons[id]}" aria-hidden="true"></i> ${names[id]}</h3><p role="status" class="bl-addon-status ${on?'is-on':''}">${status}</p></div><label class="bl-addon-power"><span>기능 켜기</span><input type="checkbox" data-addon-toggle="${id}" ${on?'checked':''} ${saving?'disabled':''}></label></header>`;
    if(['words','capture'].includes(id))return header+(on?'':`<div class="bl-capture-empty"><b>${names[id]}을 켜서 시작하세요</b><p>필요할 때만 사용하고, 설정은 그대로 보관해요.</p></div>`);
    const instructions={order:'확장 설정 패널의 순서를 정리해요.',perf:'응답·로딩·저장 상태를 살피는 다섯 도구예요.',models:'공급자 목록에 없는 모델 이름을 직접 등록해요.',modelorder:'직접 등록한 모델을 손잡이와 화살표로 정렬해요.'};
    const actions=`<p class="salty-note">${instructions[id]} 기존 단독 확장과는 둘 중 하나만 켜 주세요.</p><div class="bl-addon-actions"><button type="button" class="salty-btn bl-tool-primary bl-addon-mobile-open" data-addon-open="${id}" ${running.has(id)?'':'disabled'}>세부 설정</button><button type="button" class="salty-btn ${needsReload||saveError?'bl-apply-pending':''}" data-addon-reload ${saving||loading.has(id)?'disabled':''}>새로고침해서 적용</button></div>`;
    const position=['order','perf'].includes(id)?`<div class="bl-tool-grid"><label class="bl-addon-toggle"><input type="checkbox" data-addon-icon="${id}" ${s.addonUI[id+'Icon']?'checked':''}><span>확장 관리 아이콘</span></label></div><p class="salty-note">숨겨도 이 화면의 세부 설정으로 열 수 있어요.</p>`:'';
    const perf=id==='perf'?`<div class="bl-tool-label"><b>별 두 개 메뉴</b><button type="button" class="bl-word-help" data-perf-help aria-label="성능 보조 도움말">?</button></div><div class="bl-tool-grid">${tabs.map(([key,title])=>`<label class="bl-addon-toggle"><input type="checkbox" data-perf-menu="${key}" ${s.addonUI.perfMenu[key]?'checked':''}><span>${title}</span></label>`).join('')}</div><p class="salty-note">메뉴만 숨겨도 기능은 계속 동작해요. 끊김 감시는 스트리밍 응답에만 적용돼요.</p>`:'';
    const where=['order','perf'].includes(id)?`<div class="bl-addon-position-preview" aria-label="아이콘 위치 미리보기"><small>확장 관리 탭 상단</small><div><span>확장 프로그램 설치</span>${s.addonUI[id+'Icon']?`<span class="bl-preview-location"><i class="fa-solid ${id==='order'?'fa-arrow-down-short-wide':'fa-gear'}"></i> ${names[id]}</span>`:'<span>아이콘 숨김</span>'}</div></div>`:`<div class="bl-addon-position-preview"><small>사용 흐름</small><div class="bl-model-flow"><span>공급자 선택</span><span>${id==='models'?'모델 이름 입력':'등록한 모델 정렬'}</span><span>저장</span></div></div>`;
    const wand=id==='perf'?`<div class="bl-wand-preview" aria-label="요술봉 메뉴 미리보기"><small>입력창 왼쪽 별 두 개 메뉴</small><div class="bl-wand-preview-input"><strong>✦₊</strong><span>메시지를 입력하세요</span></div><div class="bl-wand-preview-menu">${tabs.filter(([key])=>s.addonUI.perfMenu[key]).map(([,title,icon])=>`<p><i class="fa-solid fa-${icon}"></i> ${title}</p>`).join('')||'<p>표시 항목 없음</p>'}</div></div>`:'';
    return `<div class="bl-addon-layout bl-addon-embedded-layout"><div class="bl-addon-main">${header}${toolSection('activation','실행·설정',actions,true)}${toolSection('position','미리보기',where+wand,true)}${position||perf?toolSection('menus','표시할 위치',position+perf,true):''}${id==='modelorder'?'<p class="salty-note">공급자의 기본 모델 목록은 바꾸지 않아요. 직접 등록한 목록에 적용해요.</p>':''}</div><div class="bl-addon-config bl-addon-inline" data-addon-inline="${id}"><h3 class="bl-inline-title">세부 설정</h3><div class="bl-addon-inline-content" role="region" aria-label="${names[id]} 세부 설정"><p class="salty-note">${running.has(id)?'설정을 불러오는 중…':'기능을 켜고 새로고침하면 여기에서 설정할 수 있어요.'}</p></div></div></div>`;
}

export function bindAddons(root,refresh){
    bindInlineAddon(root);

    root.querySelectorAll('[data-addon-toggle]').forEach(input=>input.addEventListener('change',async()=>{
        const id=input.dataset.addonToggle,on=input.checked;
        if(on&&folders[id]&&await conflict(id)){input.checked=false;globalThis.toastr?.warning(`${names[id]} 단독 확장이 켜져 있어요. 확장 관리에서 둘 중 하나를 꺼 주세요.`,'Blue Lemonade');return;}
        getSettings().addons[id]=on;
        try{await persist();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');}await syncAddonIcons();refresh();
    }));
    root.querySelectorAll('[data-addon-open]').forEach(button=>button.addEventListener('click',async()=>{
        if(button.dataset.addonOpen==='modelorder'){(await import('./addons/modelorder/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='models'){(await import('./addons/models/panel.js')).openPanel();return;}
        if(button.dataset.addonOpen==='order')(await import('./addons/order/panel.js')).openDialog();else(await import('./addons/perf/hub.js')).openHub();
    }));
    root.querySelectorAll('[data-addon-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonMenu+'Menu']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-addon-icon]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonIcon+'Icon']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-perf-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI.perfMenu[input.dataset.perfMenu]=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-addon-reload]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await persist();location.reload();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');refresh();}}));
    root.querySelector('[data-perf-help]')?.addEventListener('click',async()=>{(await import('./addons/perf/help.js')).showPerfHelp();});
}
export async function syncAddonIcons(){
    const s=getSettings();
    const menu=document.getElementById('extensionsMenu');
    if(menu)for(const id of ['words','capture']){
        const key=`bl-tool-menu-${id}`,old=document.getElementById(key);
        if(!s.addons[id]||!s.addonUI[id+'Menu']){old?.remove();continue;}
        if(old)continue;
        const button=document.createElement('div');button.id=key;button.className='list-group-item flex-container flexGap5 interactable';button.tabIndex=0;button.setAttribute('role','button');
        button.innerHTML=`<div class="fa-fw fa-solid ${id==='words'?'fa-arrow-right-arrow-left':'fa-camera'} extensionsMenuExtensionButton"></div><span>${names[id]}</span>`;
        const open=()=>window.Salty?.openPopup(false,id);button.onclick=open;button.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};menu.append(button);
    }
    for(const id of ['order','perf']){
        const buttonId=id==='order'?'po-open':'pa-hub-open';
        if(!running.has(id)||!s.addonUI[id+'Icon']){const old=document.getElementById(buttonId);if(old?.dataset.blAddon)old.remove();continue;}
        const existed=document.getElementById(buttonId),api=await import(id==='order'?'./addons/order/panel.js':'./addons/perf/hub.js');
        if(id==='order')api.mountButton();else api.mountGear();
        if(!existed){const button=document.getElementById(buttonId);if(button)button.dataset.blAddon=id;}
    }
    if(running.has('perf'))(await import('./addons/perf/menu.js')).syncPerfMenu();
}

// Only the visible editor owns an embedded settings view. Resize and route changes
// return persistent controls to their holders; no duplicate listeners or panels.
function bindInlineAddon(editor) {
    const slot=editor.querySelector('[data-addon-inline]');
    if(!slot)return;
    const id=slot.dataset.addonInline,host=slot.querySelector('.bl-addon-inline-content');
    let disposed=false,epoch=0,cleanup=null,mounting=false;
    const update=async()=>{
        const wide=getComputedStyle(slot).display!=='none';
        if(!wide){epoch++;mounting=false;cleanup?.();cleanup=null;return;}
        if(disposed||cleanup||mounting||!running.has(id))return;
        mounting=true;const token=++epoch;
        try{
            const api=await (id==='order'?import('./addons/order/panel.js'):id==='perf'?import('./addons/perf/hub.js'):id==='models'?import('./addons/models/panel.js'):import('./addons/modelorder/index.js'));
            if(disposed||token!==epoch||!slot.isConnected)return;
            host.replaceChildren();cleanup=api.mountInline(host);
        }catch(error){if(!disposed&&token===epoch){host.textContent='설정을 불러오지 못했어요. 화면을 다시 열어 주세요.';console.error('[Blue Lemonade]',error);}}
        finally{if(token===epoch)mounting=false;}
    };
    const observer=new ResizeObserver(update);observer.observe(editor);
    editor._addonCleanup=()=>{disposed=true;epoch++;observer.disconnect();cleanup?.();};
    update();
}
