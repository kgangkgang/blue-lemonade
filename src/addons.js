import { addonsEnabled } from './usage-mode.js';
import { toolSection } from './addon-layout.js';
// Optional integrations share standalone settings, but only one owner runs per page.
import { getSettings, saveSettings } from './settings.js';
import { restorePendingAddons, saveAddonsNow } from './addon-save.js';
import { IDS as ASSIST_IDS, LABELS as ASSIST_LABELS } from './assist/core.js';
const running=new Set(),failed=new Map(),loading=new Set();
let started=false,saving=0,saveError='';
const folders={direction:'story-direction',assets:'char-assets',prompt:'prompt-panel',customstyle:'SillyTavern-CustomThemeStyleInputs',translator:'llm-translator-custom',order:'panel-order',perf:'perf-assist',words:'word-replace',models:'model-register',rewrite:'ban-word-rewrite',bookmarks:'chat-bookmarks'};
const names={direction:'전개 지시',assets:'캐릭터 에셋',prompt:'한글화 패널',customstyle:'커스텀 CSS 조절',translator:'LLM 번역',order:'확장 순서',perf:'성능 보조',words:'단어 치환',capture:'채팅 캡처',models:'모델 등록',modelswitch:'모델 전환',regexlink:'프롬프트 연동 정규식',rewrite:'다시 쓰기',bookmarks:'북마크'};
const icons={direction:'fa-feather-pointed',assets:'fa-images',prompt:'fa-table-list',customstyle:'fa-sliders',translator:'fa-language',words:'fa-arrow-right-arrow-left',capture:'fa-camera',order:'fa-arrow-down-short-wide',perf:'fa-gauge-high',models:'fa-circle-plus',modelswitch:'fa-shuffle',regexlink:'fa-link',bookmarks:'fa-bookmark',rewrite:'fa-glasses'};
const tabs=[['watchdog','끊김 감시','heart-pulse'],['timer','로딩 시간','stopwatch'],['perf','성능 보조','gauge-high'],['log','요청 로그','receipt'],['dedupe','저장 정리','floppy-disk']];
const changed=()=>window.dispatchEvent(new Event('bl:addons-state'));
export async function conflict(id){
    const {extensionNames,extension_settings}=await import('../../../../extensions.js');
    const candidates=id==='direction'?['story-direction','Direction-Manager','Direction-Manager-Lite','jeongaejisi']:id==='assets'?['char-assets','character-assets','esetham']:[folders[id]];
    return candidates.some(folder=>{const key=`third-party/${folder}`;return extensionNames.includes(key)&&!extension_settings.disabledExtensions?.includes(key);});
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
    const s=getSettings();if(!addonsEnabled(s))return;
    for(const id of ['perf','order','models','modelswitch','regexlink','rewrite','direction','bookmarks','assets','translator','prompt','customstyle','words']){
        if(!s.addons[id])continue;
        if(await conflict(id)){
            failed.set(id,'기존 단독 확장이 켜져 있어 테마 쪽은 대기 중이에요. 둘 중 하나를 끄고 새로고침해 주세요.');
            if(id==='words'){s.addons.words=false;saveSettings();}
            globalThis.toastr?.warning(`${names[id]}: ${failed.get(id)}`,'Blue Lemonade');continue;
        }
        if(id==='words')continue;
        loading.add(id);changed();
        try{
            if(id!=='translator')await stylesheet(id);
            if(id==='direction'){
                await (await import('./addons/direction/index.js')).ready;
            }else if(id==='assets'){
                await (await import('./addons/assets/index.js')).ready;
            }else if(id==='prompt'){
                await (await import('./addons/prompt/index.js')).ready;
            }else if(id==='customstyle'){
                await import('./addons/customstyle/index.js');
            }else if(id==='translator'){
                const translator=await import('./addons/translator/bridge.js');await translator.ready;translator.syncVisibility();
            }else if(id==='perf'){
                const suite=await import('./addons/perf/start.js');
                if(suite.failures.length)failed.set(id,'일부 도구를 시작하지 못했어요. 세부 설정에서 확인해 주세요.');
            }else if(id==='modelswitch'){
                await import('./addons/modelswitch/index.js');
            }else if(id==='regexlink'){
                await import('./addons/regexlink/index.js');
            }else if(id==='rewrite'){
                await import('./addons/rewrite/index.js');
            }else if(id==='bookmarks'){
                await import('./addons/bookmarks/index.js');
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
export function addonMarkup(s,id,nested=false){
    if(!nested && id==='models') return `<div class="bl-addon-group"><h3>모델 관리</h3>${addonMarkup(s,'models',true)}${addonMarkup(s,'modelswitch',true)}</div>`;
    if(!nested && id==='perf') return `<div class="bl-addon-group">${addonMarkup(s,'perf',true)}${addonMarkup(s,'regexlink',true)}<section class="bl-addon-group-tool">${addonMarkup(s,'conflicts',true)}</section></div>`;
    if(ASSIST_IDS.includes(id)) {
        const notes={conflicts:'중복 실행·설치 버전·화면 간섭과 관측된 오류를 확인해요.'};
        return `<div class="bl-addon-header"><h3><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> ${ASSIST_LABELS[id]}</h3><label class="bl-addon-power"><span>기능 켜기</span><input type="checkbox" data-assist-toggle="${id}" ${s.addons[id]?'checked':''}></label></div><p class="salty-note">${notes[id]}</p><button type="button" class="salty-btn bl-tool-primary" data-assist-open="${id}" ${s.addons[id]?'':'disabled'}>열기</button>`;
    }
    const on=!!s.addons[id],needsReload=['order','perf','models','modelswitch','regexlink','rewrite','direction','bookmarks','assets','translator','prompt','customstyle'].includes(id)&&on!==running.has(id);
    const status=!addonsEnabled(s)?'사용 모드에서 확장 기능이 꺼져 있어요':saving?'설정 저장 확인 중…':saveError||(loading.has(id)?'기능을 불러오는 중…':failed.get(id))||(needsReload?'새로고침 대기':on?'사용 중':'꺼짐');
    const header=`<header class="bl-addon-header"><div><h3><i class="fa-solid ${icons[id]}" aria-hidden="true"></i> ${names[id]}</h3><p role="status" class="bl-addon-status ${on?'is-on':''}">${status}</p></div><label class="bl-addon-power"><span>기능 켜기</span><input type="checkbox" data-addon-toggle="${id}" ${on?'checked':''} ${saving?'disabled':''}></label></header>`;
    if(['words','capture'].includes(id))return header+(on?'':`<div class="bl-capture-empty"><b>${names[id]}을 켜서 시작하세요</b><p>필요할 때만 사용하고, 설정은 그대로 보관해요.</p></div>`);
    const instructions={direction:'입력창의 깃털 버튼에서 다음 전개를 적고 켜면 대화 요청에 지시가 들어가요. 기존 전개 지시 개조본의 설정과 내용을 이어 써요.',assets:'캐릭터별 그림을 관리하고 AI 답변에 표시해요. 기존 그림 폴더와 개조본 설정을 이어 써요. 단독 캐릭터 에셋은 끈 뒤 새로고침해 주세요.',prompt:'프리셋·월드인포·봇카드를 읽고 번역해요. 기존 단독 Prompt Panel은 끈 뒤 사용하세요. 버전 버튼에서 사용방법을 볼 수 있어요.',customstyle:'커스텀 CSS의 변수 정의를 슬라이더·색상·입력칸으로 조절해요. IceFog72의 MIT 확장을 통합했어요.',translator:'기존 LLM 번역의 설정·용어집·번역 기록을 그대로 이어 써요. 기능을 켜려면 기존 단독 LLM 번역을 끈 뒤 새로고침해 주세요.',bookmarks:'메시지에 북마크를 남기고, 모아 보고, 메모하고, 그 자리로 돌아가요. ✦ 메뉴의 북마크로도 열려요. 단독 북마크 확장과 설정 · 자료를 그대로 이어 써요.',order:'확장 설정 패널의 순서를 정리해요.',perf:'응답·로딩·저장을 살피고, 아래에서 정규식 연동과 충돌 진단도 관리해요.',models:'공급자 목록에 없는 모델 이름을 직접 등록해요.',modelswitch:'번역 · 장기 기억 · 다시 쓰기처럼 모델을 따로 고르는 확장들을 한 번에 바꿔요.',regexlink:'프롬프트 관리자에서 끈 모듈(모멘텀 엔진 · 상태창 · 선택지 …)의 정규식을 자동으로 끄고, 켜면 돌려놓아요. 꺼진 정규식은 답이 오는 동안 돌지 않아 스트리밍이 가벼워져요.',rewrite:'AI 답변에서 보기 싫은 묘사가 나온 문장만 골라 다시 쓰게 해요. 쓰는 법은 세부 설정의 버전 표시를 눌러 보세요.'};
    // 5.1.2 원작자 있는 내장 확장은 세부 설정 화면 맨 아래에 엔딩 크레딧처럼 회색 출처 (ⓒ 창과 같은 링크)
    const credits={direction:['temporary0723 · Direction-Manager','https://github.com/temporary0723/Direction-Manager','수정·업로드 허락 게시글','https://kkangtong.xyz/posts/104303'],assets:['tincansimagine · character-assets','https://github.com/tincansimagine/character-assets','공유 허락 댓글','https://kkangtong.xyz/posts/122931#comment-7bd0d60e-f2f9-4c2c-9f42-4f395873fa17'],translator:['1234anon · llm-translator','https://github.com/1234anon/llm-translator','수정판 NamelessKkang','https://github.com/NamelessKkang/llm-translator-custom'],prompt:['anon4961 · prompt-panel','https://github.com/anon4961/prompt-panel','개인개조+++ 게시글 · 「깡」','https://kkangtong.xyz/posts/138394'],customstyle:['IceFog72 · CustomThemeStyleInputs (MIT)','https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs']};
    const link=(text,url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    const credit=credits[id]?`<footer class="bl-addon-credit"><span>원작 ${link(credits[id][0],credits[id][1])}</span>${credits[id][2]?`<span>${link(credits[id][2],credits[id][3])}</span>`:''}<button type="button" class="bl-addon-credit-all" data-bl-credits>ⓒ 전체 출처·라이선스</button></footer>`:'';
    const actions=`<p class="salty-note">${instructions[id]}${folders[id]?' 기존 단독 확장과는 둘 중 하나만 켜 주세요.':''}</p><div class="bl-addon-actions"><button type="button" class="salty-btn bl-tool-primary bl-addon-mobile-open" data-addon-open="${id}" ${running.has(id)?'':'disabled'}>세부 설정</button><button type="button" class="salty-btn ${needsReload||saveError?'bl-apply-pending':''}" data-addon-reload ${saving||loading.has(id)?'disabled':''}>새로고침해서 적용</button></div>`;
    const position=id==='translator'?`<label class="bl-addon-toggle"><input type="checkbox" data-translator-drawer ${s.addonUI.translatorDrawer!==false?'checked':''}><span>실리태번 확장 탭에 번역 설정 표시</span></label><p class="salty-note">숨겨도 번역은 계속 동작해요. 블루레몬에이드 → 확장 → LLM 번역에서 설정할 수 있어요.</p>`:['order','perf'].includes(id)?`<div class="bl-tool-grid"><label class="bl-addon-toggle"><input type="checkbox" data-addon-icon="${id}" ${s.addonUI[id+'Icon']?'checked':''}><span>확장 관리 아이콘</span></label></div><p class="salty-note">숨겨도 이 화면의 세부 설정으로 열 수 있어요.</p>`:'';
    const perf=id==='perf'?`<div class="bl-tool-label"><b>별 두 개 메뉴</b><button type="button" class="bl-word-help" data-perf-help aria-label="성능 보조 도움말">?</button></div><div class="bl-tool-grid">${tabs.map(([key,title])=>`<label class="bl-addon-toggle"><input type="checkbox" data-perf-menu="${key}" ${s.addonUI.perfMenu[key]?'checked':''}><span>${title}</span></label>`).join('')}</div><p class="salty-note">메뉴만 숨겨도 기능은 계속 동작해요. 끊김 감시는 스트리밍 응답에만 적용돼요.</p>`:'';
    const where=['order','perf'].includes(id)?`<div class="bl-addon-position-preview" aria-label="아이콘 위치 미리보기"><small>확장 관리 탭 상단</small><div><span>확장 프로그램 설치</span>${s.addonUI[id+'Icon']?`<span class="bl-preview-location"><i class="fa-solid ${id==='order'?'fa-arrow-down-short-wide':'fa-gear'}"></i> ${names[id]}</span>`:'<span>아이콘 숨김</span>'}</div></div>`:'';  // 4.7.3: 아이콘 위치가 있는 애드온만 미리보기 — '사용 흐름' 칸은 모델 등록 흐름이 다른 애드온에도 붙어 뺐다
    const modelMenu=id==='modelswitch'?`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="modelswitch" ${s.addonUI.modelswitchMenu!==false?'checked':''}><span>요술봉에 모델 전환 표시</span></label><div class="bl-wand-preview" aria-label="모델 전환 메뉴 미리보기"><small>요술봉 메뉴</small><div class="bl-wand-preview-menu">${s.addonUI.modelswitchMenu!==false?'<p><i class="fa-solid fa-shuffle"></i> 모델 전환</p>':'<p>모델 전환 숨김</p>'}</div></div>`:'';
    const wand=id==='perf'?`<div class="bl-wand-preview" aria-label="요술봉 메뉴 미리보기"><small>입력창 왼쪽 별 두 개 메뉴</small><div class="bl-wand-preview-input"><strong>✦₊</strong><span>메시지를 입력하세요</span></div><div class="bl-wand-preview-menu">${tabs.filter(([key])=>s.addonUI.perfMenu[key]).map(([,title,icon])=>`<p><i class="fa-solid fa-${icon}"></i> ${title}</p>`).join('')||'<p>표시 항목 없음</p>'}</div></div>`:'';
    return `<div class="bl-addon-layout bl-addon-embedded-layout"><div class="bl-addon-main">${header}${toolSection(id+'-activation','실행·설정',actions,true)}${where||wand||modelMenu?toolSection(id+'-position','미리보기',where+wand+modelMenu,true):''}${position||perf?toolSection(id+'-menus','표시할 위치',position+perf,true):''}</div><div class="bl-addon-config bl-addon-inline" data-addon-inline="${id}"><h3 class="bl-inline-title">세부 설정</h3><div class="bl-addon-inline-content" role="region" aria-label="${names[id]} 세부 설정"><p class="salty-note">${running.has(id)?'설정을 불러오는 중…':'기능을 켜고 새로고침하면 여기에서 설정할 수 있어요.'}</p></div></div>${credit}</div>`;
}

// 정규식 연동은 끄는 순간 원래 켜짐 상태로 되돌린다 (새로고침 뒤에 안 실려도 꺼 둔 정규식이 남지 않게)
// 멈춘 뒤엔 돌지 않는 것으로 친다: 세부 설정 · 옆 칸이 다시 붙어 정규식을 또 끄지 않게 (다시 켜면 새로고침)
async function stopRegexlink(){
    try{await (await import('./addons/regexlink/index.js')).stop();}catch(error){console.warn('[Blue Lemonade]',error);}
    running.delete('regexlink');
}
// 설정 초기화 · 가져오기 뒤: 돌고 있는 정규식 연동을 새 켜짐 값에 맞춘다 (안 돌던 것은 불러오지 않는다)
export async function syncRegexlinkFlag(){
    if(!running.has('regexlink'))return;
    try{
        if(getSettings().addons?.regexlink)(await import('./addons/regexlink/index.js')).sync();
        else{await stopRegexlink();changed();}
    }catch(error){console.warn('[Blue Lemonade]',error);}
}

export function bindAddons(root,refresh){
    root.querySelectorAll('[data-assist-toggle]').forEach(input=>input.onchange=async()=>{
        getSettings().addons[input.dataset.assistToggle]=input.checked;
        try{await persist();(await import('./assist/index.js')).syncAssist();refresh();}catch(error){globalThis.toastr?.warning(error.message);}
    });
    root.querySelectorAll('[data-assist-open]').forEach(button=>button.onclick=async()=>{const m=await import('./assist/index.js');m.syncAssist();m.openTool(button.dataset.assistOpen);});
    const cleanups=[];
    for(const slot of root.querySelectorAll('[data-addon-inline]')) cleanups.push(bindInlineAddon(root,slot));
    root._addonCleanup=()=>cleanups.forEach(cleanup=>cleanup?.());

    root.querySelectorAll('[data-addon-toggle]').forEach(input=>input.addEventListener('change',async()=>{
        const id=input.dataset.addonToggle,on=input.checked;
        if(on&&folders[id]&&await conflict(id)){input.checked=false;globalThis.toastr?.warning(`${names[id]} 단독 확장이 켜져 있어요. 확장 관리에서 둘 중 하나를 꺼 주세요.`,'Blue Lemonade');return;}
        getSettings().addons[id]=on;
        if(id==='regexlink'&&!on&&running.has(id))await stopRegexlink();
        try{await persist();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');}await syncAddonIcons();refresh();
    }));
    root.querySelectorAll('[data-addon-open]').forEach(button=>button.addEventListener('click',async()=>{
        if(button.dataset.addonOpen==='direction'){(await import('./addons/direction/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='assets'){(await import('./addons/assets/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='prompt'){(await import('./addons/prompt/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='customstyle'){(await import('./addons/customstyle/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='translator'){(await import('./addons/translator/bridge.js')).openPanel();return;}
        if(button.dataset.addonOpen==='modelswitch'){(await import('./addons/modelswitch/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='regexlink'){(await import('./addons/regexlink/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='rewrite'){(await import('./addons/rewrite/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='bookmarks'){(await import('./addons/bookmarks/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='models'){(await import('./addons/models/panel.js')).openPanel();return;}
        if(button.dataset.addonOpen==='order')(await import('./addons/order/panel.js')).openDialog();else(await import('./addons/perf/hub.js')).openHub();
    }));
    root.querySelector('[data-translator-drawer]')?.addEventListener('change',async(event)=>{getSettings().addonUI.translatorDrawer=event.target.checked;try{await persist();}catch(error){globalThis.toastr?.warning(error.message);}await syncAddonIcons();});
    root.querySelectorAll('[data-addon-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonMenu+'Menu']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-addon-icon]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonIcon+'Icon']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-perf-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI.perfMenu[input.dataset.perfMenu]=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-addon-reload]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await persist();location.reload();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');refresh();}}));
    root.querySelector('[data-perf-help]')?.addEventListener('click',async()=>{(await import('./addons/perf/help.js')).showPerfHelp();});
}
export async function syncAddonIcons(){
    const s=getSettings();
    if(running.has('translator'))(await import('./addons/translator/bridge.js')).syncVisibility();
    const menu=document.getElementById('extensionsMenu');
    if(menu)for(const id of ['words','capture']){
        const key=`bl-tool-menu-${id}`,old=document.getElementById(key);
        if(!addonsEnabled(s)||!s.addons[id]||!s.addonUI[id+'Menu']){old?.remove();continue;}
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
    if(running.has('modelswitch'))(await import('./addons/modelswitch/index.js')).syncMenu();
    if(running.has('perf'))(await import('./addons/perf/menu.js')).syncPerfMenu();
}

// Only the visible editor owns an embedded settings view. Resize and route changes
// return persistent controls to their holders; no duplicate listeners or panels.
function bindInlineAddon(editor,slot) {
    if(!slot)return;
    const id=slot.dataset.addonInline,host=slot.querySelector('.bl-addon-inline-content');
    let disposed=false,epoch=0,cleanup=null,mounting=false;
    const update=async()=>{
        const wide=getComputedStyle(slot).display!=='none';
        if(!wide){epoch++;mounting=false;cleanup?.();cleanup=null;return;}
        if(disposed||cleanup||mounting||!running.has(id))return;
        mounting=true;const token=++epoch;
        try{
            const api=await (id==='direction'?import('./addons/direction/index.js'):id==='assets'?import('./addons/assets/index.js'):id==='prompt'?import('./addons/prompt/index.js'):id==='customstyle'?import('./addons/customstyle/index.js'):id==='translator'?import('./addons/translator/bridge.js'):id==='order'?import('./addons/order/panel.js'):id==='perf'?import('./addons/perf/hub.js'):id==='models'?import('./addons/models/panel.js'):id==='modelswitch'?import('./addons/modelswitch/index.js'):id==='regexlink'?import('./addons/regexlink/index.js'):id==='rewrite'?import('./addons/rewrite/index.js'):import('./addons/bookmarks/index.js'));
            if(disposed||token!==epoch||!slot.isConnected)return;
            host.replaceChildren();cleanup=api.mountInline(host);
        }catch(error){if(!disposed&&token===epoch){host.textContent='설정을 불러오지 못했어요. 화면을 다시 열어 주세요.';console.error('[Blue Lemonade]',error);}}
        finally{if(token===epoch)mounting=false;}
    };
    // 칸을 숨기는 CSS 가 늦게 붙는 느린 기기: 크기가 안 변해 ResizeObserver 가 안 울릴 수 있어 몇 번 더 확인한다
    const observer=new ResizeObserver(update);observer.observe(editor);
    for(const delay of [400,1500,4000])setTimeout(()=>{if(!disposed)update();},delay);
    update();
    return ()=>{disposed=true;epoch++;observer.disconnect();cleanup?.();};
}
