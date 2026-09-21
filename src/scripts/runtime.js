import {SCRIPT_CATALOG,loadBundledScript} from './catalog.js';
import {scriptSettings,legacyConflicts} from './store.js';
import {createPromptEngine} from './prompt-engine.js';
const running=new Map(), states=new Map(), listeners=new Set();
const translations=createPromptEngine();
let revision=0;
export const scriptStatus=id=>states.get(id)||'꺼짐';
export function subscribeScripts(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function status(id,text){states.set(id,text);for(const fn of listeners)fn();}
function stop(id){const item=running.get(id);if(!item)return;running.delete(id);try{item.frame.contentWindow.dispatchEvent(new Event('pagehide'));}catch{/* detached */}for(const fn of item.cleanups)try{fn();}catch(error){console.warn('[Blue Lemonade] Script cleanup',error);}item.frame.remove();}
export function validateScript(code){if(typeof code!=='string'||code.length>1000000)throw Error('코드는 1MB 이내로 입력해 주세요.');new Function('BlueLemonade',code);}
export async function syncScripts(on){
    const current=++revision,state=scriptSettings();
    for(const item of SCRIPT_CATALOG) if(!on||!state.enabled[item.id]){stop(item.id);status(item.id,'꺼짐');}
    if(!on)return;
    for(const item of SCRIPT_CATALOG){
        if(current!==revision)return;
        const id=item.id;if(!state.enabled[id])continue;
        try{
            // 충돌 검사도 이 안에서: 여기서 던지면 예전에는 다섯 개가 전부 '꺼짐'인 채 아무것도 안 돌았다.
            if(legacyConflicts(id).length){stop(id);status(id,'기존 헬퍼 스크립트가 켜져 있어요');continue;}
            const code=state.overrides[id]?.code??await loadBundledScript(id);
            if(current!==revision)return;
            if(running.get(id)?.code===code)continue;
            validateScript(code);stop(id);
            const frame=document.createElement('iframe');frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.dataset.blScript=id;document.body.append(frame);
            const cleanups=[];running.set(id,{frame,code,cleanups});
            const api=Object.freeze({onCleanup(fn){if(typeof fn==='function')cleanups.push(fn);},translate(data){cleanups.push(translations.register(id,data));}});
            // Each script owns its window/timers. Built-ins remove parent-document changes on pagehide.
            frame.contentWindow.addEventListener('error',()=>{stop(id);status(id,'실행 오류 · 코드를 확인해 주세요');});
            frame.contentWindow.Function('BlueLemonade',code)(api);
            if(running.has(id))status(id,'사용 중');
        }catch(error){stop(id);status(id,`실행 오류: ${error.message}`);}
    }
}
