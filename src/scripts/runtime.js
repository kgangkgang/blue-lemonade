import {SCRIPT_CATALOG,loadBundledScript} from './catalog.js';
import {scriptSettings,legacyConflicts} from './store.js';
import {createPromptEngine} from './prompt-engine.js';
const running=new Map(), states=new Map(), listeners=new Set();
const translations=createPromptEngine();
let revision=0;
// 돌던 스크립트가 밖에서 닫히는 일이 있다(틀이 다시 읽히거나 떼어짐 · 다른 곳에서 정리 함수를 부름). 내장 스크립트는 닫힐 때 번역을 원래 글로 되돌리므로
// 상태는 '사용 중'인데 메뉴는 중국어 · 영어로 남았다. 닫힌 것을 알아채 다시 시작하고, 진단에 보이게 적어 둔다.
const ALIVE_KEYS={korean:'__sillyTavernKoreanUI_v1',helper:'__tavernHelperKoreanUI_v1'}; // 내장 스크립트가 도는 동안 걸어 두는 표시
const deaths=[],restarts=new Map();let wanted=false;
export const scriptDeaths=()=>deaths.slice(-6);
function died(id,frame,why){
    const item=running.get(id);if(!item||item.frame!==frame)return; // stop() 이 닫은 것이거나 이미 새 틀로 바뀜
    deaths.push(`${id} ${why} ${new Date().toTimeString().slice(0,8)}`);if(deaths.length>20)deaths.shift();
    stop(id);
    const count=(restarts.get(id)||0)+1;restarts.set(id,count);
    if(!wanted||count>6){status(id,'멈췄어요. 새로고침해 주세요');return;}
    status(id,'다시 시작하는 중…');setTimeout(()=>{if(wanted&&!running.has(id))syncScripts(true).catch(()=>{});},400*count);
}
/** 결과로 확인: 돌고 있다는데 할 일이 안 돼 있으면(예: ✦ 메뉴에 한자가 남음) 그 스크립트를 새로 시작한다 */
export function reviveScript(id,why){const item=running.get(id);if(!item||item.custom)return false;died(id,item.frame,why);return true;}
function dead(id){
    const item=running.get(id);if(!item)return '';
    if(!item.frame.isConnected)return '틀이 떼어짐';
    if(item.frame.contentWindow!==item.win)return '틀이 다시 읽힘';
    const key=ALIVE_KEYS[id];if(key&&!item.custom&&!globalThis[key])return '표시가 사라짐';
    return '';
}
export const scriptStatus=id=>states.get(id)||'꺼짐';
export function subscribeScripts(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function status(id,text){states.set(id,text);for(const fn of listeners)fn();}
function stop(id){const item=running.get(id);if(!item)return;running.delete(id);try{item.frame.contentWindow.dispatchEvent(new Event('pagehide'));}catch{/* detached */}for(const fn of item.cleanups)try{fn();}catch(error){console.warn('[Blue Lemonade] Script cleanup',error);}item.frame.remove();}
export function validateScript(code){if(typeof code!=='string'||code.length>1000000)throw Error('코드는 1MB 이내로 입력해 주세요.');new Function('BlueLemonade',code);}
// 스크립트마다 따로 시작한다. 예전에는 목록 순서대로 하나씩 기다렸는데, 앞의 것(한글화 사전 440KB)을 폰이 늦게 받거나 못 받으면
// 뒤의 스크립트가 전부 '꺼짐'으로 남았다. 어디서 멈췄는지 보이게 단계도 상태에 적는다.
const timed=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('파일을 받지 못했어요 (시간 초과)')),ms);promise.then(resolve,reject).finally(()=>clearTimeout(timer));});
async function startOne(item,state,current){
    const id=item.id;
    try{
        // 충돌 검사도 이 안에서: 여기서 던지면 예전에는 다섯 개가 전부 '꺼짐'인 채 아무것도 안 돌았다.
        if(legacyConflicts(id).length){stop(id);status(id,'기존 헬퍼 스크립트가 켜져 있어요');return;}
        if(!running.has(id))status(id,'불러오는 중…');
        // 파일이 비었거나 덜 받아졌으면 주소를 바꿔 몇 번 다시 받는다 (2초 · 4초 · 6초 뒤)
        let code=state.overrides[id]?.code;
        for(let attempt=0;typeof code!=='string';attempt++){
            try{code=await timed(loadBundledScript(id,attempt>0),25000);}
            catch(error){if(attempt>=3)throw error;status(id,'파일을 다시 받는 중…');await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));}
            if(current!==revision)return;
        }
        if(current!==revision)return; // 더 새 요청이 이어서 처리한다
        if(typeof code!=='string'||!code)throw Error('스크립트 코드를 받지 못했어요');
        if(running.has(id)&&running.get(id).code===code){status(id,'사용 중');return;}
        validateScript(code);stop(id);
        const frame=document.createElement('iframe');frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.dataset.blScript=id;document.body.append(frame);
        const cleanups=[],win=frame.contentWindow;running.set(id,{frame,code,cleanups,win,custom:!!state.overrides[id]?.code});
        win.addEventListener('pagehide',()=>setTimeout(()=>died(id,frame,'틀이 닫힘'),0));
        const api=Object.freeze({onCleanup(fn){if(typeof fn==='function')cleanups.push(fn);},translate(data){cleanups.push(translations.register(id,data));}});
        // Each script owns its window/timers. Built-ins remove parent-document changes on pagehide.
        frame.contentWindow.addEventListener('error',(event)=>{stop(id);status(id,`실행 오류: ${event?.message||'코드를 확인해 주세요'}`);});
        frame.contentWindow.Function('BlueLemonade',code)(api);
        if(running.has(id))status(id,'사용 중');
    }catch(error){stop(id);status(id,`실행 오류: ${error.message}`);}
}
export async function syncScripts(on){
    const current=++revision,state=scriptSettings();wanted=!!on;
    for(const item of SCRIPT_CATALOG) if(!on||!state.enabled[item.id]){stop(item.id);status(item.id,'꺼짐');}
    if(!on)return;
    await Promise.all(SCRIPT_CATALOG.filter(item=>state.enabled[item.id]).map(item=>startOne(item,state,current)));
}
/** 켜 두었는데 돌고 있지 않은 스크립트가 있나 — 있으면 다시 시작한다 (화면을 열 때 · 시작 뒤 몇 번 확인) */
export function healScripts(on){
    if(!on)return false;
    const state=scriptSettings();
    let revived=false;for(const id of [...running.keys()]){const why=dead(id);if(why){died(id,running.get(id).frame,why);revived=true;}}
    if(revived)return true;
    if(!SCRIPT_CATALOG.some(item=>state.enabled[item.id]&&!running.has(item.id)&&!legacyConflicts(item.id).length))return false;
    syncScripts(true).catch(error=>console.error('[Blue Lemonade] 스크립트를 다시 시작하지 못했어요',error));
    return true;
}
