import { addonsEnabled } from './usage-mode.js';
// Optional integrations share standalone settings, but only one owner runs per page.
import { getSettings, saveSettings } from './settings.js';
import { restorePendingAddons, saveAddonsNow } from './addon-save.js';
import { DUPLICATES } from './extension-folder.js';
// 8.3.0 단독 확장을 테마 안으로 들인 틀: 표는 private-addons.js(1.0.0 은 빈 표 — 실린 것 없음), 옛 단독 폴더 찾기는 extension-folder.js (둘 다 순수 · 시험 tools/tests/private-addons.mjs)
import { PRIVATE_ADDONS, EMBEDDED_PRIVATE, ADDON_CARRY } from './private-addons.js';
import { legacyFolders } from './extension-folder.js';
import { perfErrorText } from './addons/perf/start-error.js';
import { ADDON_GATED_BUNDLE, ADDON_GATED_BOOT_BUNDLE, ADDON_BOOT_CSS, ADDON_CSS_SENTINEL, LATE_STYLE_IDS, bootSheetOf, gatedBundleFits, syncAddonStyleFlags } from './addon-style-bundle.js';
import { onGate } from './boot-layers.js';
import { afterBoot } from './boot-gate.js';
import { loadSheet } from './focus-copies.js';
const running=new Set(),failed=new Map(),loading=new Set(),waiting=new Set();
// 1.0.0: 실행 중인 애드온 모듈 표 — dist 묶음이라 src 를 따로 import 하면 두 번째 인스턴스가 돼요. 검사 도구는 window.Salty.addon(id) 로 받아요
const modules=new Map();
export function addonModule(id){return modules.get(id)||null;}
export async function waitAddonModule(id,ms=10000){
    if(modules.has(id))return modules.get(id);
    const s=getSettings();if(!addonsEnabled(s)||!s.addons?.[id]||failed.has(id))return null;
    startLateAddons('도구');const t0=Date.now();
    while(!modules.has(id)&&Date.now()-t0<ms){if(started&&lateFired&&!loading.has(id)&&!running.has(id))break;await new Promise(r=>setTimeout(r,50));}
    return modules.get(id)||null;
}
export const LATE_ADDONS=new Set(['rewrite','prompt','modelswitch']);
let lateIds=[],lateStarted=null,lateLayers=null,lateStyling=null;
/** 처음 쓸 때 시작하는 애드온(LATE_ADDONS)을 지금 시작해요 — 한 번만. 1층 애드온(3층 유휴) 시작이 끝난 뒤에 차례로 */
export let lateReason='';
let lateFired=false;const lateHooks=new Set();
/** 처음 쓸 때를 같이 듣는 껍데기 */
export function onLateAddons(fn){if(lateFired)fn(lateReason);else lateHooks.add(fn);}
export function startLateAddons(reason='?'){
    if(lateStarted)return lateStarted;
    lateReason=reason;
    if(!lateFired){lateFired=true;for(const fn of lateHooks){try{fn(reason);}catch(error){console.warn('[Blue Lemonade] 훅',error);}}lateHooks.clear();}
    if(!started||!lateIds.length)return Promise.resolve();
    lateStarted=(async()=>{try{if(lateStyling)await lateStyling();const run=async()=>{await Promise.allSettled(lateIds.map(startOne));await lateLayers?.lateSettled?.();};await(lateLayers?lateLayers.withReplay('늦은 애드온',run):run());try{await syncAddonIcons();}catch(error){console.warn('[Blue Lemonade]',error);}}finally{changed();}})();
    return lateStarted;
}   // waiting: 옛 단독 폴더가 켜져 있어 내장본이 대기 중인 개인 확장 (카드에 「옛 단독 확장 끄기」)
let started=false,saving=0,saveError='';
// 단독 확장 폴더 후보는 extension-folder.js 의 DUPLICATES 한 표만 쓴다 (첫 이름은 안내 문구용)
const folders=Object.fromEntries(Object.entries(DUPLICATES).map(([id,list])=>[id,list[0]]));
const names={mermaid:'Mermaid 도표',zipinstall:'ZIP 설치',tts:'TTS',direction:'전개 지시',assets:'캐릭터 에셋',prompt:'한글화 패널',customstyle:'커스텀 CSS 조절',translator:'LLM 번역',order:'확장 순서',perf:'성능 보조',words:'단어 치환',capture:'채팅 캡처',models:'모델 등록',modelswitch:'모델 전환',regexlink:'프롬프트 연동 정규식',rewrite:'다시 쓰기',bookmarks:'북마크',notes:'메모','prompt-template':'프롬프트 템플릿',...Object.fromEntries(EMBEDDED_PRIVATE.map(id=>[id,PRIVATE_ADDONS[id].label]))};
const changed=()=>window.dispatchEvent(new Event('bl:addons-state'));
// 1029 지금 이 페이지에서 실제로 도는지 — 설정 값(켜 둠)만 보면 단독 확장 대기 · 새로고침 전에도 바깥에서 애드온을 불러 시작시켰다
export const addonRunning=id=>running.has(id);
export async function conflict(id){
    const {extensionNames,extension_settings}=await import('../../../../extensions.js');
    // 8.3.0 판 번호가 붙은 폴더(xxx-1.4.1 · xxx-main)도 같은 확장으로 (extension-folder.js folderBase)
    return legacyFolders(DUPLICATES[id]??[],extensionNames,extension_settings.disabledExtensions).length>0;
}
// 8.3.0 「옛 단독 확장 끄기」: 내장된 개인 확장(ids)의 켜진 옛 단독 폴더를 실리태번 확장 관리와 같은 길(disableExtension · disabledExtensions)로 끄고 저장만 — 새로고침은 사용자가 (카드의 「새로고침해서 적용」)
//   폴더 · 설정 · 자료는 그대로라 되돌리려면 확장 관리에서 다시 켜면 된다. 돌려주는 값: 끈 확장 이름('third-party/<폴더>')들
export async function disableLegacy(ids=EMBEDDED_PRIVATE){
    const host=await import('../../../../extensions.js');
    const targets=[...new Set(ids.flatMap(id=>legacyFolders(DUPLICATES[id]??[],host.extensionNames,host.extension_settings.disabledExtensions)))];
    if(!targets.length)return [];
    for(const name of targets){
        if(typeof host.disableExtension==='function')await host.disableExtension(name,false);
        else{const list=host.extension_settings.disabledExtensions??=[];if(!list.includes(name))list.push(name);}
    }
    if(typeof host.disableExtension!=='function'){const {saveSettings:hostSave}=await import('../../../../../script.js');await hostSave();}
    for(const id of ids)if(waiting.has(id)){waiting.delete(id);failed.set(id,'옛 단독 확장을 꺼 두었어요. 새로고침하면 테마 쪽이 이어서 돌아요.');}
    changed();
    return targets;
}
// 1.4.1 애드온 시트는 loadSheet(focus-copies.js)로 붙여요 — 실리태번이 시트마다 :focus-visible 사본을 훑어 넣던 일을 테마가 같은 결과로 맡고(첫 장 · 전체 장 겹침 한 벌), 훑기는 쉴 때
function attachStyle(link){
    return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{link.remove();reject(Error('스타일 로딩 시간 초과'));},15000);
        loadSheet(link,el=>document.head.append(el)).then(()=>{clearTimeout(timer);resolve();},()=>{clearTimeout(timer);link.remove();reject(Error('스타일을 읽지 못했어요.'));});
    });
}
const addonUrl=rel=>new URL(`./addons/${rel}`,import.meta.url).href;
const fullSheet=id=>addonUrl(`${id}/${PRIVATE_ADDONS[id]?.css||'style.css'}`);
// 1.0.0 극한 최적화: 첫 장 → 전체 시트. pendingSheets = 아직 전체로 안 바꾼 <link> → 전체 주소. 같은 자리에 붙여 규칙 순서가 그대로예요
const pendingSheets=new Map();
let bundledStyleIds=[];
let upgrading=Promise.resolve();
function swapSheet(link,href){
    return new Promise(resolve=>{
        const full=document.createElement('link');if(link.dataset.blAddonsAll)full.dataset.blAddons=link.dataset.blAddonsAll;
        let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);if(ok)link.remove();else{full.remove();pendingSheets.set(link,href);}resolve(ok);};   // 못 받으면 첫 장 그대로 · 다음에 다시
        const timer=setTimeout(()=>finish(false),15000);
        full.href=href;
        loadSheet(full,()=>{if(link.isConnected)link.after(full);else document.head.append(full);}).then(()=>finish(true),()=>finish(false));
    });
}
/** 첫 장을 전체 시트로 — 처음 누를 때 · 서랍이나 창이 열릴 때 · 창 뿌리가 나타날 때(표지 규칙의 animationstart) */
export function upgradeAddonStyles(){
    if(pendingSheets.size){const jobs=[...pendingSheets].map(([link,href])=>{pendingSheets.delete(link);return swapSheet(link,href);});upgrading=Promise.allSettled([upgrading,...jobs]);}
    return upgrading;
}
function watchUpgrade(){
    onGate('press',upgradeAddonStyles,'addon-css');
    window.addEventListener('bl:full-css',upgradeAddonStyles);
    document.addEventListener('animationstart',event=>{if(event.animationName===ADDON_CSS_SENTINEL)upgradeAddonStyles();},true);
}
async function stylesheet(id){
    const link=document.createElement('link');link.rel='stylesheet';
    if(LATE_STYLE_IDS.includes(id)){document.head.append(link);pendingSheets.set(link,fullSheet(id));return;}   // 자리만 — 본체를 시작할 때 전체 시트(규칙 순서 그대로)
    if(!ADDON_BOOT_CSS[id]){link.href=fullSheet(id);await attachStyle(link);return;}
    pendingSheets.set(link,fullSheet(id));link.href=addonUrl(bootSheetOf(id,PRIVATE_ADDONS[id]?.css));
    try{await attachStyle(link);}catch(error){pendingSheets.delete(link);const whole=document.createElement('link');whole.rel='stylesheet';whole.href=fullSheet(id);await attachStyle(whole);}   // 첫 장을 못 받으면 예전처럼 전체
}
// 1.0.6 조건부 애드온 CSS: 켜진 목록이 지원하는 순서의 부분 집합이면 한 장을 쓰고, 뿌리 표식으로 끈 애드온의 규칙을 막아요.
//   data-bl-addons는 실제 켜진 항목만 적어 한글화 패널·파일 검사기가 CSS를 중복으로 붙이지 않게 해요.
//   못 받으면 개별 시트로 돌아가요. 첫 장→전체 장 교체는 같은 자리에서 하므로 규칙 순서가 유지돼요.
function stylesheetBundle(ids){
    bundledStyleIds=[...ids];syncAddonStyleFlags(document,ids);
    const link=document.createElement('link');link.rel='stylesheet';link.dataset.blAddons=ids.filter(id=>!LATE_STYLE_IDS.includes(id)).join(' ');link.href=addonUrl(ADDON_GATED_BOOT_BUNDLE);
    pendingSheets.set(link,addonUrl(ADDON_GATED_BUNDLE));
    return attachStyle(link).catch(error=>{pendingSheets.delete(link);bundledStyleIds=[];syncAddonStyleFlags(document,[]);throw error;}).then(()=>{link.dataset.blAddonsAll=ids.join(' ');});
}
async function persist(){saving++;saveError='';changed();try{await saveAddonsNow();saveError='';}catch(error){saveError=error.message;throw error;}finally{saving--;changed();}}
// 확장은 실리태번이 설정을 다 읽기 전에 시작한다 (settingsReady 전엔 saveSettings 가 미루기만 해서 저장 확인이 실패로 남았다) — 저장은 APP_READY 뒤에
async function whenAppReady(task){
    try{
        const host=await import('../../../../../script.js');
        if(!host.settingsReady&&document.getElementById('loader')){host.eventSource.once(host.event_types.APP_READY,task);return;}
    }catch(error){console.warn('[Blue Lemonade]',error);}
    setTimeout(task,0);
}
const DUPLICATE_RUNNING='같은 확장이 이미 켜져 있어요. 단독 확장을 끄고 새로고침해 주세요.';
// 모듈이 가져오려는 이름이 없을 때의 브라우저 오류(크롬 · 엣지 / 파이어폭스 / 사파리) → 그 이름
export function missingExportName(error){const m=error instanceof SyntaxError&&/export named:? '?([\w$]+)|import not found: ([\w$]+)|binding name '([\w$]+)' is not found/.exec(String(error.message||''));return m?(m[1]||m[2]||m[3]):null;}
async function startOne(id){
    try{
        let module=null;
        if(id==='zipinstall'){
            module=await import('./addons/zipinstall/index.js');
        }else if(id==='tts'){
            module=await import('./addons/tts/shell.js');await module.ready;   // 껍데기만 — 본체는 처음 쓸 때
        }else if(id==='direction'){
            module=await import('./addons/direction/index.js');await module.ready;
        }else if(id==='assets'){
            module=await import('./addons/assets/index.js');await module.ready;
        }else if(id==='prompt'){
            module=await import('./addons/prompt/index.js');await module.ready;
        }else if(id==='mermaid'){
            module=await import('./addons/mermaid/index.js');
        }else if(id==='prompt-template'){
            module=await import('./addons/prompt-template/index.js');
        }else if(id==='customstyle'){
            module=await import('./addons/customstyle/index.js');
        }else if(id==='translator'){
            module=await import('./addons/translator/bridge.js');await module.ready;
        }else if(id==='perf'){
            module=await import('./addons/perf/start.js');await module.ready;
            if(module.failures.length)failed.set(id,'일부 도구를 시작하지 못했어요. 세부 설정에서 확인해 주세요.');
        }else if(id==='modelswitch'){
            module=await import('./addons/modelswitch/index.js');
        }else if(id==='regexlink'){
            module=await import('./addons/regexlink/index.js');
        }else if(id==='rewrite'){
            module=await import('./addons/rewrite/index.js');
        }else if(id==='bookmarks'){
            module=await import('./addons/bookmarks/index.js');
        }else if(id==='notes'){
            module=await import('./addons/notes/index.js');
        }else if(id==='models'){
            module=await import('./addons/models/index.js');
        }else{
            (await import('./addons/order/state.js')).initSettings();
            (await import('./addons/order/order.js')).startEngine();
        }
        // 같은 확장이 화면에 이미 있으면(단독 확장이 먼저 올라옴) 모듈이 duplicate 를 알린다 — 돌리지 않고 대기
        if(module?.duplicate===true){failed.set(id,DUPLICATE_RUNNING);return;}
        if(module)modules.set(id,module);
        // 번역 설정 HTML 이 안 왔어도 번역 자체는 돈다 — 표시 맞추기 실패로 실패 처리하지 않는다
        if(id==='translator')try{module.syncVisibility();}catch(error){console.warn('[Blue Lemonade]',error);}
        running.add(id);
    }catch(error){
        // 실리태번 판 호환: 그 판에 없는 이름을 가져오다 실패했으면(ESM 연결 오류) 새로고침으로는 안 풀린다 — 이름과 함께 판 · 설치를 안내
        const missing=id==='perf'?null:missingExportName(error);
        const message=id==='perf'?`시작하지 못했어요. ${perfErrorText(error)}. 새로고침 후에도 같으면 이 오류 코드를 알려 주세요.`:missing?`이 실리태번 판과 맞지 않는 이름(${missing})이 있어 시작하지 못했어요. 실리태번을 최신 판으로 올리고, 그래도 같으면 테마를 다시 설치해 주세요.`:'시작하지 못했어요. 새로고침 후 다시 확인해 주세요.';
        failed.set(id,message);console.error('[Blue Lemonade]',id==='perf'?message:error);
    }
    finally{loading.delete(id);changed();}
}
// 8.2.6 성능 보조 시작 시도가 끝났다(켜져 있지 않거나 · 실패해도) — 빈 채팅 막기 독립 모듈(empty-guard-boot.js)이 저장 정리가 맡는지 본 뒤 설치한다
let settlePerf;export const perfStarted=new Promise(resolve=>{settlePerf=resolve;});
// 9.0.2 부팅 3층(boot-layers.js — layers 는 index.js 가 { afterFirstFrame, whenIdle, withReplay, lateSettled } 를 줘요): 성능 보조(fetch 감싸기 · 요청 로그 · 저장 정리 — 실리태번 요청보다 먼저)는 바로, 애드온 스타일은 첫 프레임 뒤(2층 · 덮개 아래),
//   나머지 애드온 본체는 유휴(3층 · 처음 쓸 때 kickIdle). layers 를 안 주면(시험 · 예전 호출) 예전처럼 한꺼번에
export async function startAddons(layers=null){
    if(started)return;started=true;
    try{await startAddonsOnce(layers);}finally{settlePerf();}
}
async function startAddonsOnce(layers){
    const restored=await restorePendingAddons();
    if(restored)whenAppReady(()=>persist().catch(()=>{}));
    const s=getSettings();if(!addonsEnabled(s))return;
    // 8.3.0 한 번(설계 §3.2): 옛 단독 폴더가 켜져 있던 개인 확장은 내장본 플래그도 켠다 → 「대기」로 시작하고, 옛 것을 끄고 새로고침하면 설정 · 자료 그대로 이어진다
    if((s.addonCarry|0)<ADDON_CARRY){
        try{for(const id of EMBEDDED_PRIVATE)if(!s.addons[id]&&await conflict(id))s.addons[id]=true;}catch(error){console.warn('[Blue Lemonade] 개인 확장 플래그 이어받기',error);}
        s.addonCarry=ADDON_CARRY;saveSettings();
    }
    const ids=[];
    for(const id of ['perf','order','models','modelswitch','regexlink','rewrite','direction','bookmarks','notes','zipinstall','assets','translator','prompt','prompt-template','customstyle','words','mermaid','tts',...EMBEDDED_PRIVATE]){
        if(!s.addons[id])continue;
        if(await conflict(id)){
            failed.set(id,'기존 단독 확장이 켜져 있어 테마 쪽은 대기 중이에요. 둘 중 하나를 끄고 새로고침해 주세요.');
            if(PRIVATE_ADDONS[id])waiting.add(id);   // 8.3.0 카드에 「옛 단독 확장 끄기」
            if(id==='words'){s.addons.words=false;saveSettings();}
            globalThis.toastr?.warning(`${names[id]}: ${failed.get(id)}`,'Blue Lemonade');continue;
        }
        if(id==='words')continue;
        loading.add(id);ids.push(id);
    }
    changed();
    // 같은 단계의 스타일은 함께 받아요. 못 받은 파일은 개별 읽기와 파일 검사기가 처리해요.
    const styled=ids.filter(id=>id!=='translator');
    const styleEach=()=>Promise.allSettled(styled.map(stylesheet)).then(results=>results.forEach((outcome,i)=>{if(outcome.status==='rejected')console.warn('[Blue Lemonade]',names[styled[i]],'스타일:',outcome.reason?.message||outcome.reason);}));
    const styleAll=()=>gatedBundleFits(styled)?stylesheetBundle(styled).catch(error=>{console.warn('[Blue Lemonade] 애드온 스타일 한 장:',error?.message||error,'— 한 장씩 다시 받아요');return styleEach();}):styleEach();
    // 애드온 CSS는 본체 시작 직전에 붙여요. 별도 미리 받기로 요청을 중복하지 않아요.
    watchUpgrade();
    let styling=null;const ensureStyling=()=>styling||=styleAll();lateStyling=()=>ensureStyling().then(upgradeAddonStyles);
    if(!layers)ensureStyling();   // 미리 받기(fetch) 없음 — 두 번 받혀 바이트만 늘어요. 3층에서 붙일 때 받아요
    // 성능 보조는 fetch 를 감싸고 로딩 시간을 재므로 스타일을 기다리지 않고 맨 먼저 시작한다 (5.2.3: 기다리면 그 사이 실린 확장을 못 잰다)
    if(ids.includes('perf')){await startOne('perf');try{await syncAddonIcons();}catch(error){console.warn('[Blue Lemonade]',error);}}
    settlePerf();
    // 1.0.0: 바로 보이지 않는 큰 애드온은 처음 쓸 때만
    const late=ids.filter(id=>LATE_ADDONS.has(id));
    const rest=ids.filter(id=>id!=='perf'&&!LATE_ADDONS.has(id));
    lateIds=late;
    const startRest=async()=>{
        await ensureStyling();
        // 늦게 붙은 애드온이 놓친 채팅 바뀜은 지금 채팅으로 한 번 (boot-layers.js withReplay — APP_READY 는 실리태번이 늦은 리스너에도 바로 불러 줘요)
        const run=async()=>{await Promise.allSettled(rest.map(startOne));await layers?.lateSettled?.();};   // 모듈이 jQuery 준비 · 다음 작업에 거는 리스너까지 덮어요
        await(layers?layers.withReplay('애드온',run):run());
        try{await syncAddonIcons();}catch(error){console.warn('[Blue Lemonade]',error);}
    };
    lateLayers=layers;
    if(!layers){await startRest();await startLateAddons();return;}
    if(!rest.length&&!late.length)return;
    await new Promise(resolve=>layers.whenIdle('애드온',()=>startRest().finally(resolve)));
}
// 1.1.5: 설정 창 › 확장 탭의 애드온 카드(addonMarkup · bindAddons · 세부 설정 칸 · 정규식 연동 맞추기)는 addons-panel.js — 설정 창을 열 때만 받아요.
//   그쪽이 같은 상태를 읽고 고치도록 내보내요(ES 모듈 내보내기는 살아 있는 이름이라 let 값도 늘 지금 값이에요)
export { running, failed, loading, waiting, folders, names, changed, persist, saving, saveError, lateStarted, lateIds };
export async function syncAddonIcons(){
    const s=getSettings();
    if(bundledStyleIds.length)syncAddonStyleFlags(document,bundledStyleIds.filter(id=>addonsEnabled(s)&&s.addons[id]));
    if(running.has('tts'))(await import('./addons/tts/shell.js')).syncEnabled();
    if(running.has('translator'))(await import('./addons/translator/bridge.js')).syncVisibility();
    const menu=document.getElementById('extensionsMenu');
    if(menu)for(const id of ['words','capture']){
        const key=`bl-tool-menu-${id}`,old=document.getElementById(key);
        if(!addonsEnabled(s)||!s.addons[id]||!s.addonUI[id+'Menu']){old?.remove();continue;}
        if(old)continue;
        const button=document.createElement('div');button.id=key;button.className='list-group-item flex-container flexGap5 interactable';button.tabIndex=0;button.setAttribute('role','button');
        button.innerHTML=`<div class="fa-fw fa-solid ${id==='words'?'fa-arrow-right-arrow-left':'fa-camera'} extensionsMenuExtensionButton"></div><span>${names[id]}</span>`;
        const open=()=>window.Salty?.openPopup(false,id);button.onclick=open;button.onkeydown=event=>{if(event.key===' '){event.preventDefault();open();}};menu.append(button);
    }
    for(const id of ['order','perf']){
        const buttonId=id==='order'?'po-open':'pa-hub-open';
        if(!running.has(id)||!s.addonUI[id+'Icon']){const old=document.getElementById(buttonId);if(old?.dataset.blAddon)old.remove();continue;}
        const existed=document.getElementById(buttonId),api=await import(id==='order'?'./addons/order/panel.js':'./addons/perf/hub.js');
        if(id==='order')api.mountButton();else api.mountGear();
        if(!existed){const button=document.getElementById(buttonId);if(button)button.dataset.blAddon=id;}
    }
    if(running.has('modelswitch'))(await import('./addons/modelswitch/index.js')).syncMenu();
    if(running.has('zipinstall'))(await import('./addons/zipinstall/index.js')).syncMenu();
    if(running.has('notes'))(await import('./addons/notes/index.js')).syncMenu();
    if(running.has('perf'))(await import('./addons/perf/menu.js')).syncPerfMenu();
}
