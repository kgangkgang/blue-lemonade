// Observe only the generation flag; never scan the streaming message tree.
// 생성 중은 body[data-generating] 하나로 본다 — 실리태번이 정지 버튼을 띄울 때(deactivateSendButtons, 그룹 채팅 포함) 켜고 모든 종료 경로(activateSendButtons)에서 지운다.
// 예전에는 GENERATION_STARTED 로도 켰는데, /echo 같은 슬래시 명령 · 서버 ping 실패는 GENERATION_ENDED 없이 빠져 다음 답까지 날씨가 0.15로 멈춰 있었다
import { watchWith } from './dom-watch.js';
// 1.1.6 생성 표시 감시는 공용 감시 허브 구독이에요(시험이 넘긴 가짜 창이면 그 창의 감시자 — watchWith)
export function bindWeatherRest(layer, enabled, doc=document, ctx=globalThis.SillyTavern?.getContext()){
    let timer,focusTimer,typing=false;
    const sync=()=>layer.rest(!!enabled()&&(doc.body.dataset.generating==='true'||typing||!!doc.activeElement?.matches('.edit_textarea')));
    const focus=()=>{clearTimeout(focusTimer);focusTimer=setTimeout(sync,0);};
    const input=e=>{if(!e.target.matches('#send_textarea, .edit_textarea'))return;typing=true;clearTimeout(timer);sync();timer=setTimeout(()=>{typing=false;sync();},1200);};
    const unwatch=watchWith(doc.defaultView,[[doc.body,{attributes:['data-generating'],name:'날씨 쉬기 (생성 중)'}]],()=>sync());
    const events=[];
    const on=(name,fn)=>{const key=ctx?.event_types?.[name];if(key){ctx.eventSource.on(key,fn);events.push([key,fn]);}};
    for(const name of ['GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED'])on(name,()=>{typing=false;clearTimeout(timer);sync();});
    doc.addEventListener('focusin',focus);doc.addEventListener('focusout',focus);doc.addEventListener('input',input);sync();
    return {sync,dispose(){clearTimeout(timer);clearTimeout(focusTimer);unwatch();doc.removeEventListener('focusin',focus);doc.removeEventListener('focusout',focus);doc.removeEventListener('input',input);for(const [key,fn] of events)(ctx.eventSource.removeListener||ctx.eventSource.off)?.call(ctx.eventSource,key,fn);}};
}
