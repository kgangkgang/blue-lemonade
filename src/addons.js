import { addonsEnabled, switchNeedsReload } from './usage-mode.js';
import { toolSection } from './addon-layout.js';
import { leaveSettingsDialog } from './settings-dialog.js';
// Optional integrations share standalone settings, but only one owner runs per page.
import { getSettings, saveSettings } from './settings.js';
import { TTS_VERSION } from './addons/tts/version.js';
import { restorePendingAddons, saveAddonsNow } from './addon-save.js';
import { DUPLICATES } from './extension-folder.js';
// 8.3.0 단독 확장을 테마 안으로 들인 틀: 표는 private-addons.js(1.0.0 은 빈 표 — 실린 것 없음), 옛 단독 폴더 찾기는 extension-folder.js (둘 다 순수 · 시험 tools/tests/private-addons.mjs)
import { PRIVATE_ADDONS, EMBEDDED_PRIVATE, ADDON_CARRY } from './private-addons.js';
import { legacyFolders } from './extension-folder.js';
import { perfErrorText } from './addons/perf/start-error.js';
import { ADDON_STYLE_BUNDLE, ADDON_BOOT_BUNDLE, ADDON_BOOT_CSS, ADDON_CSS_SENTINEL, LATE_STYLE_IDS, bootSheetOf, bundleFits } from './addon-style-bundle.js';
import { onGate } from './boot-layers.js';
import { afterBoot } from './boot-gate.js';
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
let started=false,saving=0,saveError='',regexlinkStopped=false;
// 단독 확장 폴더 후보는 extension-folder.js 의 DUPLICATES 한 표만 쓴다 (첫 이름은 안내 문구용)
const folders=Object.fromEntries(Object.entries(DUPLICATES).map(([id,list])=>[id,list[0]]));
const names={mermaid:'Mermaid 도표',zipinstall:'ZIP 설치',tts:'TTS',direction:'전개 지시',assets:'캐릭터 에셋',prompt:'한글화 패널',customstyle:'커스텀 CSS 조절',translator:'LLM 번역',order:'확장 순서',perf:'성능 보조',words:'단어 치환',capture:'채팅 캡처',models:'모델 등록',modelswitch:'모델 전환',regexlink:'프롬프트 연동 정규식',rewrite:'다시 쓰기',bookmarks:'북마크',notes:'메모','prompt-template':'프롬프트 템플릿',...Object.fromEntries(EMBEDDED_PRIVATE.map(id=>[id,PRIVATE_ADDONS[id].label]))};
const icons={mermaid:'fa-diagram-project',zipinstall:'fa-file-zipper',tts:'fa-volume-high',direction:'fa-feather-pointed',assets:'fa-images',prompt:'fa-table-list',customstyle:'fa-sliders',translator:'fa-language',words:'fa-arrow-right-arrow-left',capture:'fa-camera',order:'fa-arrow-down-short-wide',perf:'fa-gauge-high',models:'fa-circle-plus',modelswitch:'fa-shuffle',regexlink:'fa-link',bookmarks:'fa-bookmark',notes:'fa-note-sticky','prompt-template':'fa-code',rewrite:'fa-glasses',...Object.fromEntries(EMBEDDED_PRIVATE.map(id=>[id,PRIVATE_ADDONS[id].icon]))};
const tabs=[['watchdog','끊김 감시','heart-pulse'],['timer','로딩 시간','stopwatch'],['perf','성능 보조','gauge-high'],['log','요청 로그','receipt'],['dedupe','저장 정리','floppy-disk'],['storage','저장 공간','hard-drive']];
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
function attachStyle(link){
    return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{link.remove();reject(Error('스타일 로딩 시간 초과'));},15000);
        link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);link.remove();reject(Error('스타일을 읽지 못했어요.'));};document.head.append(link);
    });
}
const addonUrl=rel=>new URL(`./addons/${rel}`,import.meta.url).href;
const fullSheet=id=>addonUrl(`${id}/${PRIVATE_ADDONS[id]?.css||'style.css'}`);
// 1.0.0 극한 최적화: 첫 장 → 전체 시트. pendingSheets = 아직 전체로 안 바꾼 <link> → 전체 주소. 같은 자리에 붙여 규칙 순서가 그대로예요
const pendingSheets=new Map();
let upgrading=Promise.resolve();
function swapSheet(link,href){
    return new Promise(resolve=>{
        const full=document.createElement('link');full.rel='stylesheet';if(link.dataset.blAddonsAll)full.dataset.blAddons=link.dataset.blAddonsAll;
        const finish=ok=>{clearTimeout(timer);if(ok)link.remove();else{full.remove();pendingSheets.set(link,href);}resolve(ok);};   // 못 받으면 첫 장 그대로 · 다음에 다시
        const timer=setTimeout(()=>finish(false),15000);
        full.onload=()=>finish(true);full.onerror=()=>finish(false);full.href=href;
        if(link.isConnected)link.after(full);else document.head.append(full);
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
// 9.0.9 애드온 CSS 한 장: 켜진 애드온이 src/addon-style-bundle.js 목록과 꼭 같으면(순서까지) style-addons.css 한 장만 — 시트 19장 + @import 조각 42장 요청이 1개로.
//   한 장은 각 시트를 읽는 순서대로 이은 것이라 규칙 순서 · 특이도가 같아요(tools/css-cascade-diff.mjs). data-bl-addons 에 든 애드온 id 로 「이 애드온 CSS 가 이미 붙었나」를 알아봐요
//   (한글화 패널 · 파일 어긋남 다시 받기). 못 받으면 예전처럼 한 장씩 · 1.0.0: 첫 장을 먼저 붙이고 전체 한 장으로 바꿔요
function stylesheetBundle(ids){
    const link=document.createElement('link');link.rel='stylesheet';link.dataset.blAddons=ids.filter(id=>!LATE_STYLE_IDS.includes(id)).join(' ');link.href=addonUrl(ADDON_BOOT_BUNDLE);
    pendingSheets.set(link,addonUrl(ADDON_STYLE_BUNDLE));
    return attachStyle(link).catch(error=>{pendingSheets.delete(link);throw error;}).then(()=>{link.dataset.blAddonsAll=ids.join(' ');});
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
    // 스타일은 한꺼번에 먼저 (느린 하나가 나머지를 줄 세우지 않게). 못 읽어도 JS 는 올린다 — 파일 어긋남은 verifyAddonCss 가 따로 알린다
    //   9.0.2 첫 프레임 뒤(2층)에 붙여요 — 시작 덮개 아래라 모양이 바뀌는 게 보이지 않고, 실리태번 시작 단계는 기다리지 않아요
    const styled=ids.filter(id=>id!=='translator');
    const styleEach=()=>Promise.allSettled(styled.map(stylesheet)).then(results=>results.forEach((outcome,i)=>{if(outcome.status==='rejected')console.warn('[Blue Lemonade]',names[styled[i]],'스타일:',outcome.reason?.message||outcome.reason);}));
    const styleAll=()=>bundleFits(styled)?stylesheetBundle(styled).catch(error=>{console.warn('[Blue Lemonade] 애드온 스타일 한 장:',error?.message||error,'— 한 장씩 다시 받아요');return styleEach();}):styleEach();
    // 1.0.0: 애드온 CSS(403KB · 규칙 3,372 — 전부 애드온이 만드는 요소만)는 애드온 본체 바로 앞(3층)에 붙여요.
    //   첫 화면 · 덮개 동안 그 시트를 파싱 · 견주지 않게. 2층에서는 fetch 로 미리 받아만 둬요(파싱 없음) — 3층에서 붙일 때 캐시에서 바로
    const styleUrls=()=>bundleFits(styled)?[new URL(`./addons/${ADDON_STYLE_BUNDLE}`,import.meta.url).href]:styled.map(id=>new URL(`./addons/${id}/${PRIVATE_ADDONS[id]?.css||'style.css'}`,import.meta.url).href);
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
// 1.0.0 바탕: 애드온 카드 꼬리 출처 줄(전개 지시 · 캐릭터 에셋의 「출처 명시」 조건). 표와 TTS 출처 요약은 설정 창(panel.js)이 받는 src/addon-credits.js 에 있어요.
let creditOf = () => '';
// 1.0.0 되살림: 메모 카드 머리 판 알약(누르면 사용방법)의 판 글자 — 시작 그래프에 모듈을 늘리지 않게 설정 창(panel.js)이 notes/version.js 를 받아 넘겨요
let NOTES_VERSION = '';
export function setNotesVersion(v) { NOTES_VERSION = String(v || ''); }
export function setAddonCredits(fn) { creditOf = typeof fn === 'function' ? fn : () => ''; }
const RELOAD_ADDONS=['order','perf','models','modelswitch','regexlink','rewrite','direction','bookmarks','notes','zipinstall','assets','translator','prompt','prompt-template','customstyle','mermaid','tts',...EMBEDDED_PRIVATE];
// 처음 쓸 때 시작하는 애드온(LATE_ADDONS)은 아직 안 돌아도 켜진 애드온이에요 — 첫 사용 전에 「새로고침 필요」로 세지 않아요
export const addonsNeedReload = s => switchNeedsReload(s, new Set([...running, ...(lateStarted ? [] : lateIds)]), RELOAD_ADDONS);
let perfTail='';   // 1.0.3 성능 보조 맨 아래 칸 — 설정 창(panel.js)이 넘겨요
export function setPerfTail(html){perfTail=String(html||'');}
export function addonMarkup(s,id,nested=false){
    if(!nested && id==='models') return `<div class="bl-addon-group"><h3>모델 관리</h3>${addonMarkup(s,'models',true)}${addonMarkup(s,'modelswitch',true)}</div>`;
    if(!nested && id==='perf') return `<div class="bl-addon-group">${addonMarkup(s,'perf',true)}${addonMarkup(s,'regexlink',true)}${perfTail}</div>`;
    const on=!!s.addons[id],needsReload=RELOAD_ADDONS.includes(id)&&on!==(running.has(id)||!lateStarted&&lateIds.includes(id));
    // 7.0.5 프롬프트 템플릿: 켜 두기만 하고 확장을 설치하지 않았으면 「사용 중」 대신 설치 상태 · 한 줄 안내 · 「설치」 — 머리 바로 뒤 칸을 그 애드온이 채운다(mountCard)
    const ptCard=id==='prompt-template'&&on&&running.has(id)&&!needsReload&&addonsEnabled(s)?'<div class="blpt-card" data-pt-card></div>':'';
    const status=!addonsEnabled(s)?(s.enabled===false?'「블루레몬에이드 사용」이 꺼져 있어요':s.usageMode==='zero'?'제로 모드에서 꺼짐':'사용 모드에서 확장 기능이 꺼져 있어요'):saving?'설정 저장 확인 중…':saveError||(loading.has(id)?'기능을 불러오는 중…':failed.get(id))||(needsReload?'새로고침 대기':on?'사용 중':'꺼짐');
    const guideBadge=id==='notes'?`<button type="button" class="bl-addon-ver" data-notes-guide title="메모 사용방법" aria-label="메모 사용방법">${NOTES_VERSION?'v'+NOTES_VERSION:'?'}</button>`:id==='tts'?`<button type="button" class="bl-addon-ver" data-tts-guide title="TTS 사용방법" aria-label="TTS 사용방법">v${TTS_VERSION}</button>`:'';   // 1.0.0 후보: 8.2.5 처럼 판 알약(누르면 사용방법)
    const header=`<header class="bl-addon-header"><div><h3><i class="fa-solid ${icons[id]}" aria-hidden="true"></i> ${names[id]}${guideBadge}</h3><p role="status" class="bl-addon-status ${on?'is-on':''}">${status}</p></div><label class="bl-addon-power"><span>기능 켜기</span><input type="checkbox" data-addon-toggle="${id}" ${on?'checked':''} ${saving?'disabled':''}></label></header>${ptCard}`;
    if(['words','capture'].includes(id))return header+(on?'':`<div class="bl-capture-empty"><b>${names[id]}을 켜서 시작하세요</b><p>필요할 때만 사용하고, 설정은 그대로 보관해요.</p></div>`);
    const instructions={notes:'입력창 위 메모 줄의 ☰ 로 열어 쓰는 쪽지예요. 채팅 안에서 만든 메모는 그 채팅에만 보여요. #태그 · [[메모 연결]] · 폴더도 돼요. 자세한 쓰는 법은 제목 옆 버전 버튼을 눌러 보세요.',zipinstall:'ZIP 파일로 확장을 설치하고 업데이트해요. 처음 한 번 서버 도우미를 준비하면 PC·모바일에서 사용할 수 있어요. 요술봉 메뉴의 ZIP 설치로도 열려요.',tts:'채팅 대사를 캐릭터별 목소리로 읽어요. 음성 제공자를 연결하고 음성을 등록한 뒤 캐릭터에 지정하세요. 클라우드 음성 합성과 감정 분석은 연결한 서비스의 요금이 적용될 수 있어요.',direction:'입력창의 깃털 버튼에서 다음 전개를 적고 켜면 대화 요청에 지시가 들어가요. 기존 전개 지시 개조본의 설정과 내용을 이어 써요.',assets:'캐릭터별 그림을 관리하고 AI 답변에 표시해요. 기존 그림 폴더와 개조본 설정을 이어 써요. 단독 캐릭터 에셋은 끈 뒤 새로고침해 주세요.',customstyle:'커스텀 CSS의 변수 정의를 슬라이더·색상·입력칸으로 조절해요. IceFog72의 MIT 확장을 통합했어요.',prompt:'프리셋·월드인포·봇카드를 읽고 번역해요. 기존 단독 Prompt Panel은 끈 뒤 사용하세요. 버전 버튼에서 사용방법을 볼 수 있어요.',translator:'기존 LLM 번역의 설정·용어집·번역 기록을 그대로 이어 써요. 기능을 켜려면 기존 단독 LLM 번역을 끈 뒤 새로고침해 주세요.',bookmarks:'메시지에 북마크를 남기고, 모아 보고, 메모하고, 그 자리로 돌아가요. ✦ 메뉴의 북마크로도 열려요.',order:'확장 설정 패널의 순서를 정리해요.',perf:'응답·로딩·저장을 살피고, 아래에서 정규식 연동도 관리해요.',models:'공급자 목록에 없는 모델 이름을 직접 등록해요.',modelswitch:'번역 · 다시 쓰기처럼 모델을 따로 고르는 확장들을 한 번에 바꿔요.',regexlink:'프롬프트 관리자에서 끈 모듈(모멘텀 엔진 · 상태창 · 선택지 …)의 정규식을 자동으로 끄고, 켜면 돌려놓아요. 꺼진 정규식은 답이 오는 동안 돌지 않아 스트리밍이 가벼워져요.',rewrite:'AI 답변에서 보기 싫은 묘사가 나온 문장만 골라 다시 쓰게 해요. 쓰는 법은 세부 설정의 버전 표시를 눌러 보세요.'};
    // 8.3.0 단독 확장을 테마 안으로 들인 것(private-addons.js)은 그 확장이 그리던 서랍 카드 · 요술봉 · 독 항목은 그대로, 이 카드는 켜고 끄기 · 세부 설정 · 옛 단독 폴더 끄기만
    // 6.9.9 프롬프트 템플릿: 원본(zonde306 · AGPL-3.0)을 수정 없이 ZIP 으로 담아 실리태번 확장 폴더에 설치하는 도구 — 테마 안에서 실행하지 않는다 (addons/prompt-template/NOTICE.md)
    instructions['prompt-template']='프롬프트 · 카드 · 월드 인포 안에 &lt;% %&gt; 템플릿(EJS)을 쓰는 확장 ST-Prompt-Template 을 담긴 원본 그대로 실리태번에 설치 · 업데이트 · 삭제해요. 설치에는 ZIP 설치의 서버 도우미가 필요하고, 설치 뒤 새로고침하면 실리태번 확장으로 켜져요.';
    instructions.mermaid='채팅에 도표가 있을 때만 그림 도구를 불러와요. AI 답변의 mermaid 코드 블록을 그림으로 표시하며, 실패하면 원문과 다시 그리기 버튼을 남겨요. 단독 Mermaid 확장이 켜져 있으면 내장 기능은 대기해요.';
    // 8.3.0 개인 확장: 옛 단독 폴더가 켜져 있으면 「옛 단독 확장 끄기」(내장된 개인 확장 전부의 옛 폴더를 한 번에 끈다 · 새로고침은 따로)
    const legacyNote=PRIVATE_ADDONS[id]?' 옛 단독 폴더가 켜져 있으면 테마 쪽은 대기해요 — 「옛 단독 확장 끄기」를 누르고 새로고침하면 설정 · 자료 그대로 이어져요.':folders[id]&&!['assets','prompt','translator'].includes(id)?' 기존 단독 확장과는 둘 중 하나만 켜 주세요.':'';
    const legacyOff=waiting.has(id)?`<button type="button" class="salty-btn bl-apply-pending" data-legacy-off="${id}" ${saving?'disabled':''}>옛 단독 확장 끄기</button>`:'';
    const credit=creditOf(id);   // 5.1.2 원작자 있는 내장 확장의 세부 설정 맨 아래 출처 줄 — 표는 src/addon-credits.js(설정 창이 받아 넘겨요, 시작 그래프 밖)
    const actions=`<p class="salty-note">${instructions[id]}${legacyNote}</p><div class="bl-addon-actions"><button type="button" class="salty-btn bl-tool-primary bl-addon-mobile-open" data-addon-open="${id}" ${running.has(id)?'':'disabled'}>세부 설정</button>${legacyOff}<button type="button" class="salty-btn ${needsReload||saveError?'bl-apply-pending':''}" data-addon-reload ${saving||loading.has(id)?'disabled':''}>새로고침해서 적용</button></div>`;
    const position=id==='translator'?`<label class="bl-addon-toggle"><input type="checkbox" data-translator-drawer ${s.addonUI.translatorDrawer!==false?'checked':''}><span>실리태번 확장 탭에 번역 설정 표시</span></label><p class="salty-note">숨겨도 번역은 계속 동작해요. 블루레몬에이드 → 확장 → LLM 번역에서 설정할 수 있어요.</p>`:id==='tts'?`<label class="bl-addon-toggle"><input type="checkbox" data-tts-drawer ${s.addonUI.ttsDrawer!==false?'checked':''}><span>확장 탭에 TTS 설정 표시</span></label><p class="salty-note">실리태번 확장 탭에서 바로 설정해요. 숨겨도 이 화면과 켜 둔 요술봉 메뉴에서 열 수 있어요.</p>`:['order','perf'].includes(id)?`<div class="bl-tool-grid"><label class="bl-addon-toggle"><input type="checkbox" data-addon-icon="${id}" ${s.addonUI[id+'Icon']?'checked':''}><span>확장 관리 아이콘</span></label></div><p class="salty-note">숨겨도 이 화면의 세부 설정으로 열 수 있어요.</p>`:'';
    const perf=id==='perf'?`<div class="bl-tool-label"><b>별 두 개 메뉴<button type="button" class="bl-word-help bl-help-btn" data-perf-help aria-label="성능 보조 도움말"><i class="fa-solid fa-question" aria-hidden="true"></i></button></b></div><div class="bl-tool-grid">${tabs.map(([key,title])=>`<label class="bl-addon-toggle"><input type="checkbox" data-perf-menu="${key}" ${s.addonUI.perfMenu[key]?'checked':''}><span>${title}</span></label>`).join('')}</div><p class="salty-note">메뉴만 숨겨도 기능은 계속 동작해요. 끊김 감시는 스트리밍 응답에만 적용돼요.</p>`:'';
    const where=['order','perf'].includes(id)?`<div class="bl-addon-position-preview" aria-label="아이콘 위치 미리보기"><small>확장 관리 탭 상단</small><div><span>확장 프로그램 설치</span>${s.addonUI[id+'Icon']?`<span class="bl-preview-location"><i class="fa-solid ${id==='order'?'fa-arrow-down-short-wide':'fa-gear'}"></i> ${names[id]}</span>`:'<span>아이콘 숨김</span>'}</div></div>`:'';  // 4.7.3: 아이콘 위치가 있는 애드온만 미리보기 — '사용 흐름' 칸은 모델 등록 흐름이 다른 애드온에도 붙어 뺐다
    const notesMenu=id==='notes'?`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="notes" ${s.addonUI.notesMenu!==false?'checked':''}><span>요술봉에 메모 표시</span></label><label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="notesBar" ${s.addonUI.notesBarMenu!==false?'checked':''}><span>입력창 위에 메모 줄 표시 (빠른 답장처럼 · 제목을 누르면 내용)</span></label>`:'';
    const modelMenu=id==='modelswitch'?`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="modelswitch" ${s.addonUI.modelswitchMenu!==false?'checked':''}><span>요술봉에 모델 전환 표시</span></label><div class="bl-wand-preview" aria-label="모델 전환 메뉴 미리보기"><div class="bl-wand-preview-menu">${s.addonUI.modelswitchMenu!==false?'<p><i class="fa-solid fa-shuffle"></i> 모델 전환</p>':'<p>모델 전환 숨김</p>'}</div></div>`:'';
    const wand=id==='perf'?`<div class="bl-wand-preview" aria-label="요술봉 메뉴 미리보기"><small>입력창 왼쪽 ✦ 메뉴</small><div class="bl-wand-preview-menu">${tabs.filter(([key])=>s.addonUI.perfMenu[key]).map(([,title,icon])=>`<p><i class="fa-solid fa-${icon}"></i> ${title}</p>`).join('')||'<p>표시 항목 없음</p>'}</div></div>`:'';
    const zipMenu=id==='zipinstall'?`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="zipinstall" ${s.addonUI.zipinstallMenu!==false?'checked':''}><span>요술봉에 ZIP 설치 표시</span></label><div class="bl-wand-preview" aria-label="ZIP 설치 메뉴 미리보기"><div class="bl-wand-preview-menu">${s.addonUI.zipinstallMenu!==false?'<p><i class="fa-solid fa-file-zipper"></i> ZIP 설치</p>':'<p>ZIP 설치 숨김</p>'}</div></div><p class="salty-note">숨겨도 이 화면의 세부 설정에서 열 수 있어요.</p>`:'';
    const location=position+where+perf+wand+modelMenu+notesMenu+zipMenu;   // 1.0.0 간단화: 「표시할 위치」는 거의 안 바꾸는 것이라 처음엔 접어 둬요(누르면 펼침)
    return `<div class="bl-addon-layout bl-addon-embedded-layout"><div class="bl-addon-main">${header}${toolSection(id+'-activation','실행·설정',actions,true)}${location?toolSection(id+'-menus','표시할 위치',location,false):''}</div><div class="bl-addon-config bl-addon-inline" data-addon-inline="${id}"><h3 class="bl-inline-title">세부 설정</h3><div class="bl-addon-inline-content" role="region" aria-label="${names[id]} 세부 설정"><p class="salty-note">${running.has(id)?'설정을 불러오는 중…':'기능을 켜고 새로고침하면 여기에서 설정할 수 있어요.'}</p></div></div>${credit}</div>`;
}

// 정규식 연동은 끄는 순간 원래 켜짐 상태로 되돌린다 (새로고침 뒤에 안 실려도 꺼 둔 정규식이 남지 않게)
// 멈춘 뒤엔 돌지 않는 것으로 친다: 세부 설정 · 옆 칸이 다시 붙어 정규식을 또 끄지 않게 (다시 켜면 새로고침)
async function stopRegexlink(){
    try{await (await import('./addons/regexlink/index.js')).stop();}catch(error){console.warn('[Blue Lemonade]',error);}
    running.delete('regexlink');
    regexlinkStopped=true;
}
// 설정 초기화 · 가져오기 뒤: 돌고 있는 정규식 연동을 새 켜짐 값에 맞춘다 (안 돌던 것은 불러오지 않는다)
export async function syncRegexlinkFlag({resume=false}={}){
    if(!running.has('regexlink')&&!(resume&&regexlinkStopped))return;
    try{
        const s=getSettings();
        if(addonsEnabled(s)&&s.addons?.regexlink){
            const module=await import('./addons/regexlink/index.js');
            if(resume&&regexlinkStopped){await module.resume();running.add('regexlink');regexlinkStopped=false;changed();}
            else module.sync();
        }
        else{await stopRegexlink();changed();}
    }catch(error){console.warn('[Blue Lemonade]',error);}
}

export function bindAddons(root,refresh){
    const cleanups=[];
    for(const slot of root.querySelectorAll('[data-addon-inline]')) cleanups.push(bindInlineAddon(root,slot));
    root._addonCleanup=()=>cleanups.forEach(cleanup=>cleanup?.());
    root.querySelectorAll('[data-pt-card]').forEach(async host=>{try{(await import('./addons/prompt-template/index.js')).mountCard(host);}catch(error){console.warn('[Blue Lemonade] 프롬프트 템플릿',error);}});

    root.querySelectorAll('[data-addon-toggle]').forEach(input=>input.addEventListener('change',async()=>{
        const id=input.dataset.addonToggle,on=input.checked;
        if(on&&folders[id]&&await conflict(id)){
            // 8.3.0 개인 확장은 켜 두고 「대기」로 — 카드에 「옛 단독 확장 끄기」가 뜬다 (옛 폴더를 끄고 새로고침하면 이어서 돈다)
            if(PRIVATE_ADDONS[id]){waiting.add(id);failed.set(id,'기존 단독 확장이 켜져 있어 테마 쪽은 대기 중이에요. 「옛 단독 확장 끄기」를 누르고 새로고침해 주세요.');}
            else{input.checked=false;globalThis.toastr?.warning(`${names[id]} 단독 확장이 켜져 있어요. 확장 관리에서 둘 중 하나를 꺼 주세요.`,'Blue Lemonade');return;}
        }
        getSettings().addons[id]=on;
        if(!on)failed.delete(id);
        if(id==='regexlink'&&!on&&running.has(id))await stopRegexlink();
        if(id==='tts'&&running.has(id))(await import('./addons/tts/shell.js')).syncEnabled();
        try{await persist();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');}await syncAddonIcons();refresh();
    }));
    root.querySelectorAll('[data-addon-open]').forEach(button=>button.addEventListener('click',async()=>{
        if(['bookmarks','prompt'].includes(button.dataset.addonOpen))leaveSettingsDialog(button); // 5.3.7 body 창은 dialog 아래에 깔린다 — 나머지는 dialog · 팝업이라 위에 뜬다
        if(button.dataset.addonOpen==='tts'){(await import('./addons/tts/shell.js')).openPanel();return;}
        if(button.dataset.addonOpen==='direction'){(await import('./addons/direction/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='assets'){(await import('./addons/assets/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='prompt'){(await import('./addons/prompt/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='mermaid'){(await import('./addons/mermaid/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='prompt-template'){(await import('./addons/prompt-template/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='customstyle'){(await import('./addons/customstyle/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='translator'){(await import('./addons/translator/bridge.js')).openPanel();return;}
        if(button.dataset.addonOpen==='modelswitch'){(await import('./addons/modelswitch/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='regexlink'){(await import('./addons/regexlink/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='rewrite'){(await import('./addons/rewrite/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='bookmarks'){(await import('./addons/bookmarks/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='zipinstall'){(await import('./addons/zipinstall/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='notes'){(await import('./addons/notes/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='models'){(await import('./addons/models/panel.js')).openPanel();return;}
        if(button.dataset.addonOpen==='order')(await import('./addons/order/panel.js')).openDialog();else(await import('./addons/perf/hub.js')).openHub();
    }));
    root.querySelector('[data-translator-drawer]')?.addEventListener('change',async(event)=>{getSettings().addonUI.translatorDrawer=event.target.checked;try{await persist();}catch(error){globalThis.toastr?.warning(error.message);}await syncAddonIcons();});
    root.querySelector('[data-tts-drawer]')?.addEventListener('change',async(event)=>{getSettings().addonUI.ttsDrawer=event.target.checked;if(running.has('tts'))(await import('./addons/tts/index.js')).syncVisibility();try{await persist();}catch(error){globalThis.toastr?.warning(error.message);}await syncAddonIcons();});
    root.querySelectorAll('[data-addon-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonMenu+'Menu']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-addon-icon]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonIcon+'Icon']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-perf-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI.perfMenu[input.dataset.perfMenu]=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    // 8.3.0 「옛 단독 확장 끄기」 — 내장된 개인 확장 전부의 켜진 옛 폴더를 끄고 저장 (새로고침은 옆 단추로)
    root.querySelectorAll('[data-legacy-off]').forEach(button=>button.addEventListener('click',async()=>{
        button.disabled=true;
        try{const off=await disableLegacy(EMBEDDED_PRIVATE);globalThis.toastr?.success(off.length?`옛 단독 확장 ${off.length}개를 꺼 두었어요. 새로고침하면 테마 쪽이 이어서 돌아요.`:'켜져 있는 옛 단독 확장이 없어요.','Blue Lemonade');}
        catch(error){globalThis.toastr?.warning(error?.message||String(error),'Blue Lemonade');}
        refresh();
    }));
    root.querySelectorAll('[data-addon-reload]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await persist();location.reload();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');refresh();}}));
    root.querySelector('[data-perf-help]')?.addEventListener('click',async()=>{(await import('./addons/perf/help.js')).showPerfHelp();});
    root.querySelectorAll('[data-notes-guide]').forEach(button=>button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();const open=running.has('notes')?async()=>(await import('./addons/notes/index.js')).openPanel():null;(await import('./addons/notes/guide.js')).showNotesGuide({onOpen:open});}));
    root.querySelectorAll('[data-tts-guide]').forEach(button=>button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();(await import('./addons/tts/guide.js')).showTtsGuide();}));
}
export async function syncAddonIcons(){
    const s=getSettings();
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
            const api=await (id==='zipinstall'?import('./addons/zipinstall/index.js'):id==='tts'?import('./addons/tts/shell.js'):id==='notes'?import('./addons/notes/index.js'):id==='direction'?import('./addons/direction/index.js'):id==='assets'?import('./addons/assets/index.js'):id==='prompt'?import('./addons/prompt/index.js'):id==='mermaid'?import('./addons/mermaid/index.js'):id==='prompt-template'?import('./addons/prompt-template/index.js'):id==='customstyle'?import('./addons/customstyle/index.js'):id==='translator'?import('./addons/translator/bridge.js'):id==='order'?import('./addons/order/panel.js'):id==='perf'?import('./addons/perf/hub.js'):id==='models'?import('./addons/models/panel.js'):id==='modelswitch'?import('./addons/modelswitch/index.js'):id==='regexlink'?import('./addons/regexlink/index.js'):id==='rewrite'?import('./addons/rewrite/index.js'):import('./addons/bookmarks/index.js'));
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
