// Observe only the generation flag; never scan the streaming message tree.
export function bindWeatherRest(layer, enabled, doc=document, ctx=globalThis.SillyTavern?.getContext()){
    let timer,focusTimer,typing=false,generating=false;
    const sync=()=>layer.rest(!!enabled()&&(generating||doc.body.dataset.generating==='true'||typing||!!doc.activeElement?.matches('.edit_textarea')));
    const focus=()=>{clearTimeout(focusTimer);focusTimer=setTimeout(sync,0);};
    const input=e=>{if(!e.target.matches('#send_textarea, .edit_textarea'))return;typing=true;clearTimeout(timer);sync();timer=setTimeout(()=>{typing=false;sync();},1200);};
    const observer=new MutationObserver(sync);observer.observe(doc.body,{attributes:true,attributeFilter:['data-generating']});
    const events=[];
    const on=(name,fn)=>{const key=ctx?.event_types?.[name];if(key){ctx.eventSource.on(key,fn);events.push([key,fn]);}};
    on('GENERATION_STARTED',(_type,_params,dryRun)=>{if(!dryRun){generating=true;sync();}});
    for(const name of ['GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED'])on(name,()=>{generating=false;typing=false;clearTimeout(timer);sync();});
    doc.addEventListener('focusin',focus);doc.addEventListener('focusout',focus);doc.addEventListener('input',input);sync();
    return {sync,dispose(){clearTimeout(timer);clearTimeout(focusTimer);observer.disconnect();doc.removeEventListener('focusin',focus);doc.removeEventListener('focusout',focus);doc.removeEventListener('input',input);for(const [key,fn] of events)(ctx.eventSource.removeListener||ctx.eventSource.off)?.call(ctx.eventSource,key,fn);}};
}
