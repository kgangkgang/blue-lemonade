import {FRUIT_TYPES,tidyFruitType,fruitTypeCss} from './fruit-type-schema.js';
import {findFont,fontStack,loadFont} from './fonts.js';
let stop=null, latest={on:false};
function family(id){const f=id==='original'?null:findFont(id);if(!f||f.unusable)return '';loadFont(f);return fontStack(f);}
// 7.0.4 글꼴 설정을 안 켜도(anyTypeEnabled 아님) 테마가 켜져 있으면 감시한다 — 채팅 iframe 상태창의 한국어 낱말 꺾임 막기(wrapCss)는 늘 넣는다.
export function syncFruitTypography(value, enabled=true){
    latest=tidyFruitType(value);
    if(!enabled){stop?.();stop=null;return;}
    if(!stop)stop=watchFruitTypography(document,window,()=>latest,family);
    stop.refresh();
}
// 7.0.4 프리셋이 iframe 안에 그리는 과일 상태창은 제 CSS 에 word-break: break-all 을 둬(.fate-grid-value 등 class 하나 무게) 「행 / 정력」처럼
// 한국어 낱말 가운데서 꺾였다 — 채팅 본문 · 설정 미리보기(fruit-type-preview.js)와 같게 낱말 단위로 꺾고 긴 줄은 아무 데서나.
// 과일 루트가 있는 iframe 문서에만, 프리셋의 class · id 규칙을 덮을 만큼만 무겁게(id 하나 + :is 안 루트, !important 없음).
export const wrapCss=()=>{const roots=`:is(${FRUIT_TYPES.map(t=>t.root).join(',')}):not(#bl-fruit-wrap)`;return `${roots},${roots} *{word-break:keep-all;overflow-wrap:anywhere}`;};
/** Only owned style nodes and FontFace registrations are removed on OFF. */
export function watchFruitTypography(doc,host,getConfig,fontFamily=()=> ''){
    const scopes=new Map(),frames=new Map(),styles=new Map(),faces=new Map(),wraps=new Map(),WRAP=wrapCss();let stopped=false,frame=0,lastSig='';
    // 7.0.3 긴 채팅: 1.5초 타이머는 채팅 뿌리 · iframe 문서가 바뀌었을 때만 훑는다 (그 밖의 변화는 문서마다 건 감시자 · iframe load 가 알린다)
    const ids=new WeakMap();let nextId=1;const idOf=o=>{if(!o)return 0;let i=ids.get(o);if(!i)ids.set(o,i=nextId++);return i;};
    const frameSig=(withCounts=false)=>{const out=[];const walk=(scope,depth)=>{out.push(idOf(scope));if(!scope||depth>3)return;for(const f of scope.querySelectorAll('iframe')){let d=null;try{d=f.contentDocument;}catch{}out.push(idOf(d));if(withCounts)out.push(d?.querySelectorAll?.('*').length||0);if(d?.body)walk(d.body,depth+1);}};walk(doc.querySelector('#chat'),0);return out.join(',');};
    const schedule=()=>{if(!stopped&&!frame)frame=host.requestAnimationFrame(flush);};
    const rootSelector=FRUIT_TYPES.map(t=>t.root).join(',');
    function detach(d){styles.get(d)?.remove();styles.delete(d);for(const face of faces.get(d)||[])d.fonts?.delete(face);faces.delete(d);}
    function unwrap(d){wraps.get(d)?.remove();wraps.delete(d);}
    function flush(){
        frame=0;if(stopped)return;
        const config=tidyFruitType(getConfig()),css=fruitTypeCss(config,fontFamily),docs=new Set(),liveFrames=new Set();
        const fonts=new Set();for(const t of Object.values(config.types))for(const r of Object.values(t.regions))if(r.on&&r.font!=='original'){const f=findFont(r.font);if(f&&!f.unusable)fonts.add(String(f.family).replace(/^['"]|['"]$/g,''));}
        function visit(d,scope){
            if(!scope||docs.has(d))return;docs.add(d);
            const old=scopes.get(d);if(old?.root!==scope){old?.observer.disconnect();const observer=new host.MutationObserver(schedule);observer.observe(scope,{childList:true,subtree:true});scopes.set(d,{root:scope,observer});}
            const hasRoot=(css||d!==doc)&&!!scope.querySelector(rootSelector);
            if(d!==doc&&hasRoot){let wrap=wraps.get(d);if(!wrap?.isConnected){wrap=d.createElement('style');wrap.dataset.blFruitWrap='';wrap.textContent=WRAP;(d.head||d.documentElement).append(wrap);wraps.set(d,wrap);}}else unwrap(d);
            if(css&&hasRoot){
                let style=styles.get(d);if(!style){style=d.createElement('style');style.dataset.blFruitTypography='';(d.head||d.documentElement).append(style);styles.set(d,style);}if(style.textContent!==css)style.textContent=css;
                if(d!==doc&&d.fonts){const owned=faces.get(d)||new Set();faces.set(d,owned);for(const face of [...owned])if(!fonts.has(face.family.replace(/^['"]|['"]$/g,''))){d.fonts.delete(face);owned.delete(face);}doc.fonts?.forEach(face=>{if(fonts.has(face.family.replace(/^['"]|['"]$/g,''))&&!d.fonts.has(face)){d.fonts.add(face);owned.add(face);}});}
            }else detach(d);
            for(const f of scope.querySelectorAll('iframe')){liveFrames.add(f);if(!frames.has(f)){f.addEventListener('load',schedule);frames.set(f,schedule);}try{if(f.contentDocument?.body)visit(f.contentDocument,f.contentDocument.body);}catch{}}
        }
        visit(doc,doc.querySelector('#chat'));lastSig=frameSig();
        for(const [d,e]of scopes)if(!docs.has(d)){e.observer.disconnect();scopes.delete(d);detach(d);unwrap(d);}
        for(const [f,fn]of frames)if(!liveFrames.has(f)){f.removeEventListener('load',fn);frames.delete(f);}
    }
    const timer=host.setInterval(()=>{if(frameSig()!==lastSig)schedule();},1500);flush();
    const cleanup=()=>{if(stopped)return;stopped=true;host.clearInterval(timer);host.cancelAnimationFrame(frame);for(const e of scopes.values())e.observer.disconnect();for(const [f,fn]of frames)f.removeEventListener('load',fn);for(const d of styles.keys())detach(d);for(const d of [...wraps.keys()])unwrap(d);scopes.clear();frames.clear();};
    cleanup.refresh=schedule;return cleanup;
}
