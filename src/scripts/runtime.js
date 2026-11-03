import {getSettings} from '../settings.js';
import {addonsEnabled} from '../usage-mode.js';
import {SCRIPT_CATALOG} from './catalog.js';
import {scriptSettings,legacyConflicts} from './store.js';
import {createPromptEngine} from './prompt-engine.js';
import {promptChoiceGroups} from '../prompt-choice-core.js';
import {installFruitStatusKorean} from './fruit-status.js';
import {installFruitOptionHelp} from './fruit-option-help.js';
import {installDeusOptionHelp} from './deus-option-help.js';
import {installFruitTypeShortcuts} from '../fruit-type-shortcuts.js';
import {installFruitEntry} from './fruit-entry.js';
import {allFonts,findFont,fontStack,loadFont} from '../fonts.js';
import {loadFullCatalog} from '../catalog.js';
import {createRealm} from './realm.js';
import {schedulerStats} from './scheduler.js';
import {onGate,gateFired} from '../boot-layers.js';
// 1.0.0 극한 최적화: 프롬프트 · 정규식 이름 번역(데우스 · 솔라 · 과일) · 과일 창 보조 · 과일 창 꾸미기는 서랍 · 창 안에서만 보여요 — 서랍 · ✦ 메뉴를 처음 쓸 때(문 drawer) 시작해요
const LATE_SCRIPTS=new Set(['deus','sola','fruit','qingguo','fruit-style']);const LATE_STATUS='처음 쓸 때 시작해요';
// 9.0.7 내장 스크립트 실행기 — iframe 없이 테마 창에서 보통 모듈로 돌려요.
//   예전에는 스크립트마다 숨은 iframe 을 만들어 그 창의 Function 으로 코드 글을 돌렸어요(공유용 「사용자 코드 격리」 · 문서 9개 · 감시 객체 92 · 되살리기 타이머).
//   이 줄기는 「내 것만」이라 격리가 필요 없어요: src/scripts/plain/<id>.js 를 import 해 기본 함수(BlueLemonade, window)를 부르고,
//   window 자리에 스크립트별 창 대리(realm.js — 타이머 · 감시 · 리스너 모음, setInterval 은 공용 스케줄러 하나)를 넘겨요.
//   끌 때는 스크립트 자기 정리(onCleanup · pagehide) → 대리가 남은 것을 정리. 사용자 수정 코드(overrides) 실행 · 둘째 사본 · 글로 직접 받기 우회는 걷었어요
//   (설정 값 blue_lemonade_scripts.overrides 는 지우지 않고 그대로 둬요).
const running=new Map(), states=new Map(), listeners=new Set();
const translations=createPromptEngine();
export const registerRegexNames=data=>translations.register('panel-regex',data);
// 7.0.4 프롬프트 관리자 목록에 보이는 번역 이름(켜진 번역 스크립트 사전) — 읽기만. 없으면 null
export const translatedPromptName=(id,name)=>translations.title('prompts',id,name);
let revision=0,wanted=false;
const failedAt=new Map(); // 켜다 실패한 때 — 1분 안에는 applyAll 마다 다시 켜 보지 않아요(슬라이더를 끄는 프레임마다 import · 설치를 되풀이하지 않게)
export const scriptStatus=id=>states.get(id)||'꺼짐';
export function subscribeScripts(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function status(id,text){states.set(id,text);for(const fn of listeners)fn();}
function stop(id){
    const item=running.get(id);if(!item)return;running.delete(id);
    for(const fn of [...item.realm.hides(),...item.cleanups])try{fn();}catch(error){console.warn('[Blue Lemonade] Script cleanup',error);}
    item.realm.dispose();
}
// 모듈 받기: 폰에서 테마를 다시 깐 직후 파일을 못 받는 일이 있어 주소를 바꿔 몇 번 다시 받아요(2초 · 4초 · 6초 뒤)
const timed=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('파일을 받지 못했어요 (시간 초과)')),ms);promise.then(resolve,reject).finally(()=>clearTimeout(timer));});
const moduleUrl=(item,bust)=>new URL(`./plain/${item.file}.js${bust?`?r=${Date.now().toString(36)}`:''}`,import.meta.url).href;
const titleDictionaries=new Set(['deus','fruit','sola']);
const startUrl=(item,bust)=>titleDictionaries.has(item.file)?new URL(`./titles/${item.file}.gen.js${bust?`?r=${Date.now().toString(36)}`:''}`,import.meta.url).href:moduleUrl(item,bust);
async function loadScript(item,current){
    for(let attempt=0;;attempt++){
        try{
            const module=await timed(import(startUrl(item,attempt>0)),25000);
            if(typeof module.default!=='function')throw Error('모듈에 내용이 없어요');
            return module.default;
        }catch(error){
            if(attempt>=3||current!==revision)throw error;
            status(item.id,`파일을 다시 받는 중… (${String(error?.message||error).slice(0,60)})`);
            await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));
        }
    }
}
// 글꼴 목록은 읽기 전용 사본; 글꼴 파일은 테마가 이미 쓰는 로더로 받는다.
const fonts=Object.freeze({
    ready:loadFullCatalog,
    list:()=>allFonts().map(({id,label,group,lang,unusable})=>({id,label,group,lang,unusable:!!unusable})),
    stack:id=>{const font=findFont(id);return font&&!font.unusable?fontStack(font,font.lang||'ko'):null;},
    load:id=>{const font=findFont(id);if(font&&!font.unusable)loadFont(font);},
});
// 한글화 글자 사전(옛 korean 내장 스크립트의 1MB 사전)은 ko-ui 쪽 표로 옮겼어요 — 스크립트가 처음 필요할 때(쉬는 틈 · 처음 누를 때) 받아요
const koreanDictionary=()=>import('../ko-ui.js').then(module=>module.loadTextDictionary());
// 1.0.x 솔라 빠른 설정(deus-qr)이 쓰는 이름 · 짧은 설명 — 번역 스크립트 모듈(plain/sola.js)의 사전을 읽기만 해요(그 스크립트를 켜지 않아도 돼요). 창을 열 때 처음 받아요.
const dictionaries=new Map();
function promptDictionary(file){
    if(!titleDictionaries.has(file))return Promise.resolve(null);
    if(!dictionaries.has(file))dictionaries.set(file,timed(import(moduleUrl({file},false)),25000).then(module=>{let data=null;module.default(Object.freeze({translate(value){data=value;},onCleanup(){}}),window);return data;}).catch(error=>{dictionaries.delete(file);throw error;}));
    return dictionaries.get(file);
}
function apiFor(id,cleanups){
    return Object.freeze({fonts,koreanDictionary,
        deusOptionHelp:(read,describe)=>{const help=installDeusOptionHelp(document,window,read,describe),links=installFruitTypeShortcuts(document,window);return()=>{help();links();};},
        fruitOptionHelp:()=>{const help=installFruitOptionHelp(document,window),links=installFruitTypeShortcuts(document,window),entry=installFruitEntry(document,window);return()=>{help();links();entry();};},
        localizeFruitStatus:()=>installFruitStatusKorean(document,window),
        promptTitle:(promptId,name)=>translations.titleExact('prompts',promptId??null,name),
        promptDictionary,
        choiceGroups:(prompts,order,metadata)=>{try{return promptChoiceGroups(prompts,order,metadata).map(group=>({id:group.id,ids:[...group.ids]}));}catch{return [];}},
        choicePeers:(prompts,order,metadata,promptId)=>{try{return [...new Set(promptChoiceGroups(prompts,order,metadata).filter(group=>group.ids.includes(promptId)).flatMap(group=>group.ids))].filter(peer=>peer!==promptId);}catch{return [];}},
        onCleanup(fn){if(typeof fn==='function')cleanups.push(fn);},
        translate(data){cleanups.push(translations.register(id,data,titleDictionaries.has(id)?()=>promptDictionary(id):null));},
    });
}
async function startOne(item,current){
    const id=item.id;
    try{
        // 충돌 검사도 이 안에서: 여기서 던지면 예전에는 전부 '꺼짐'인 채 아무것도 안 돌았다.
        if(legacyConflicts(id).length){stop(id);status(id,'기존 헬퍼 스크립트가 켜져 있어요');return;}
        if(running.has(id)){status(id,'사용 중');return;}
        status(id,'불러오는 중…');
        const install=await loadScript(item,current);
        if(current!==revision||running.has(id))return; // 더 새 요청이 이어서 처리한다
        const cleanups=[],realm=createRealm(id);
        running.set(id,{realm,cleanups,started:Date.now()});
        install(apiFor(id,cleanups),realm.window);
        if(running.has(id))status(id,'사용 중');
    }catch(error){stop(id);failedAt.set(id,Date.now());status(id,`실행 오류: ${error?.message||error}`);}
}
// 5.3.4: 켤 것 · 끌 것이 이미 그대로면 아무것도 안 한다 — applyAll 마다(슬라이더를 끄는 프레임마다) 불린다.
const settled=(state,on)=>SCRIPT_CATALOG.every(item=>{
    if(!(on&&state.enabled[item.id]))return !running.has(item.id)&&states.get(item.id)==='꺼짐';
    if(LATE_SCRIPTS.has(item.id)&&!gateFired('drawer')&&!running.has(item.id))return states.get(item.id)===LATE_STATUS;
    if(Date.now()-(failedAt.get(item.id)||0)<60000&&!running.has(item.id))return true;
    return running.has(item.id)&&states.get(item.id)==='사용 중';
});
export async function syncScripts(on){
    on=on && addonsEnabled(getSettings());
    if(!!on===wanted&&settled(scriptSettings(),!!on))return;
    const current=++revision,state=scriptSettings();wanted=!!on;
    for(const item of SCRIPT_CATALOG) if(!on||!state.enabled[item.id]){stop(item.id);failedAt.delete(item.id);status(item.id,'꺼짐');}
    if(!on)return;
    const now=[],late=[];
    for(const item of SCRIPT_CATALOG.filter(item=>state.enabled[item.id]))(LATE_SCRIPTS.has(item.id)&&!gateFired('drawer')?late:now).push(item);
    for(const item of late){status(item.id,LATE_STATUS);onGate('drawer',()=>{if(wanted&&scriptSettings().enabled[item.id]&&!running.has(item.id))startOne(item,revision);},item.id);}
    await Promise.all(now.map(item=>startOne(item,current)));
}
/** 켜 두었는데 돌고 있지 않은 스크립트가 있으면 시작한다 (features.js 가 화면을 열 때 · 시작 뒤 몇 번 부른다).
 *  iframe 이 없어져 「틀이 떼어짐 · 다시 읽힘」으로 죽는 일은 없어요 — 받기에 실패해 멈춘 것만 다시 시도해요 */
export function healScripts(on){
    if(!on)return false;
    const state=scriptSettings();
    if(!SCRIPT_CATALOG.some(item=>state.enabled[item.id]&&!running.has(item.id)&&!legacyConflicts(item.id).length))return false;
    syncScripts(true).catch(error=>console.error('[Blue Lemonade] 스크립트를 다시 시작하지 못했어요',error));
    return true;
}
/** 결과로 확인: 돌고 있다는데 할 일이 안 돼 있으면(예: ✦ 메뉴에 한자가 남음) 그 스크립트를 새로 시작한다 */
export function reviveScript(id){
    if(!running.has(id))return false;
    stop(id);status(id,'다시 시작하는 중…');
    const item=SCRIPT_CATALOG.find(entry=>entry.id===id);
    if(item&&wanted)startOne(item,revision);
    return true;
}
/** 진단 · 시험용: 스크립트별 감시 객체 · 타이머 · 리스너 수와 공용 스케줄러 상태 */
export function scriptStats(){
    const scripts={};for(const [id,item] of running)scripts[id]=item.realm.stats();
    return {iframes:document.querySelectorAll('iframe[data-bl-script]').length,scripts,scheduler:schedulerStats()};
}
