import {FRUIT_TYPES,tidyFruitType,fruitTypeCss} from './fruit-type-schema.js';
import {findFont,fontStack,loadFont} from './fonts.js';
let stop=null, latest={on:false};
function family(id){const f=id==='original'?null:findFont(id);if(!f||f.unusable)return '';loadFont(f);return fontStack(f);}
export function syncFruitTypography(value, enabled=true){
    latest=tidyFruitType(value);latest.on &&= enabled;
    if(!latest.on){stop?.();stop=null;return;}
    if(!stop)stop=watchFruitTypography(document,window,()=>latest,family);
    stop.refresh();
}
/** Only owned style nodes and FontFace registrations are removed on OFF. */
export function watchFruitTypography(doc,host,getConfig,fontFamily=()=> ''){
    const scopes=new Map(),frames=new Map(),styles=new Map(),faces=new Map();let stopped=false,frame=0;
    const schedule=()=>{if(!stopped&&!frame)frame=host.requestAnimationFrame(flush);};
    const rootSelector=FRUIT_TYPES.map(t=>t.root).join(',');
    function detach(d){styles.get(d)?.remove();styles.delete(d);for(const face of faces.get(d)||[])d.fonts?.delete(face);faces.delete(d);}
    function flush(){
        frame=0;if(stopped)return;
        const config=tidyFruitType(getConfig()),css=fruitTypeCss(config,fontFamily),docs=new Set(),liveFrames=new Set();
        const fonts=new Set();for(const t of Object.values(config.types))for(const r of Object.values(t.regions))if(r.on&&r.font!=='original'){const f=findFont(r.font);if(f&&!f.unusable)fonts.add(String(f.family).replace(/^['"]|['"]$/g,''));}
        function visit(d,scope){
            if(!scope||docs.has(d))return;docs.add(d);
            const old=scopes.get(d);if(old?.root!==scope){old?.observer.disconnect();const observer=new host.MutationObserver(schedule);observer.observe(scope,{childList:true,subtree:true});scopes.set(d,{root:scope,observer});}
            if(css&&scope.querySelector(rootSelector)){
                let style=styles.get(d);if(!style){style=d.createElement('style');style.dataset.blFruitTypography='';(d.head||d.documentElement).append(style);styles.set(d,style);}if(style.textContent!==css)style.textContent=css;
                if(d!==doc&&d.fonts){const owned=faces.get(d)||new Set();faces.set(d,owned);for(const face of [...owned])if(!fonts.has(face.family.replace(/^['"]|['"]$/g,''))){d.fonts.delete(face);owned.delete(face);}doc.fonts?.forEach(face=>{if(fonts.has(face.family.replace(/^['"]|['"]$/g,''))&&!d.fonts.has(face)){d.fonts.add(face);owned.add(face);}});}
            }else detach(d);
            for(const f of scope.querySelectorAll('iframe')){liveFrames.add(f);if(!frames.has(f)){f.addEventListener('load',schedule);frames.set(f,schedule);}try{if(f.contentDocument?.body)visit(f.contentDocument,f.contentDocument.body);}catch{}}
        }
        visit(doc,doc.querySelector('#chat'));
        for(const [d,e]of scopes)if(!docs.has(d)){e.observer.disconnect();scopes.delete(d);detach(d);}
        for(const [f,fn]of frames)if(!liveFrames.has(f)){f.removeEventListener('load',fn);frames.delete(f);}
    }
    const timer=host.setInterval(schedule,1500);flush();
    const cleanup=()=>{if(stopped)return;stopped=true;host.clearInterval(timer);host.cancelAnimationFrame(frame);for(const e of scopes.values())e.observer.disconnect();for(const [f,fn]of frames)f.removeEventListener('load',fn);for(const d of styles.keys())detach(d);scopes.clear();frames.clear();};
    cleanup.refresh=schedule;return cleanup;
}
