import {fruitStructureChanged} from './fruit-type-mutations.js';
import {FRUIT_TYPES,tidyFruitType,fruitTypeCss,fruitDecorCss,decorFilterMarkup,typeMatch} from './fruit-type-schema.js';
import {findFont,fontStack,loadFont} from './fonts.js';
import {loadFullCatalog,catalogReady} from './catalog.js';   // 1.0.0 상태창 글자에 고른 글꼴 — 전체 목록(1,016개)은 시작 목록 밖 글꼴을 골랐을 때만 받아요(극한 최적화: 부팅 때 152KB 를 늘 받던 것)
import {watchWith} from './dom-watch.js';   // 9.0.4 공용 감시 허브(시험의 가짜 창은 그 창 감시자 하나)
import {framePoll} from './frame-poll.js';
import {holdSheet} from './boot-gate.js';   // 1.2.2 꾸미기 시트(83KB)가 덮개 동안 붙으면 꺼 둔 채로 — 걷힐 때 한 번에 켜요   // 1.1.4 1.5초 폴링 · 서명 계산을 과일 계열 세 모듈이 하나로
let stop=null, latest={on:false};
function family(id){const f=id==='original'?null:findFont(id);if(!f||f.unusable)return '';loadFont(f);return fontStack(f);}
// 7.0.4 글꼴 설정을 안 켜도(anyTypeEnabled 아님) 테마가 켜져 있으면 감시한다 — 채팅 iframe 상태창의 한국어 낱말 꺾임 막기(wrapCss)는 늘 넣는다.
let catalogWait=null;
/** 켜진 칸이 고른 글꼴이 지금 목록에 없으면(시작 목록 5개 밖) 전체 목록을 먼저 — 받은 뒤 같은 값으로 다시 와요(그동안은 아무것도 안 그려 중간 모양이 없어요) */
function needsFullCatalog(config){
    if(catalogReady())return false;
    for(const t of Object.values(config.types||{}))for(const r of Object.values(t.regions||{}))if(r.on&&r.font&&r.font!=='original'&&!findFont(r.font))return true;
    return false;
}
export function syncFruitTypography(value, enabled=true){
    latest=tidyFruitType(value);
    if(!enabled){stop?.();stop=null;catalogWait=null;return;}
    // 1.1.4 점검: 받기를 기다리는 동안 온 새 값이 이겨요(끝나면 옛 value 가 아니라 latest 로) · 못 받으면 되풀이하지 않고 목록 없이 시작해요
    //   (전엔 실패 → 다시 부름 → 또 받기를 끝없이 되풀이해 화면이 굳었어요. 없는 글꼴은 원래 글꼴로 남고, 설정 창을 열어 목록이 들어오면 다음 적용 때 칠해요)
    if(!stop&&needsFullCatalog(latest)){
        if(catalogWait)return;
        const mine=catalogWait=Promise.resolve(loadFullCatalog()).catch(()=>false).then(()=>{if(catalogWait!==mine)return;catalogWait=null;startFruitWatch();});
        return;
    }
    catalogWait=null;
    startFruitWatch();
}
function startFruitWatch(){
    if(!stop)stop=watchFruitTypography(document,window,()=>latest,family);
    stop.refresh();
}
// 7.0.4 프리셋이 iframe 안에 그리는 과일 상태창은 제 CSS 에 word-break: break-all 을 둬(.fate-grid-value 등 class 하나 무게) 「행 / 정력」처럼
// 한국어 낱말 가운데서 꺾였다 — 채팅 본문 · 설정 미리보기(fruit-type-preview.js)와 같게 낱말 단위로 꺾고 긴 줄은 아무 데서나.
// 과일 루트가 있는 iframe 문서에만, 프리셋의 class · id 규칙을 덮을 만큼만 무겁게(id 하나 + :is 안 루트, !important 없음).
export const wrapCss=()=>{const roots=`:is(${FRUIT_TYPES.map(typeMatch).join(',')}):not(#bl-fruit-wrap)`;return `${roots},${roots} *{word-break:keep-all;overflow-wrap:anywhere}`;};
/** Only owned style nodes and FontFace registrations are removed on OFF. */
export function watchFruitTypography(doc,host,getConfig,fontFamily=()=> ''){
    const scopes=new Map(),frames=new Map(),styles=new Map(),faces=new Map(),wraps=new Map(),WRAP=wrapCss();let stopped=false,frame=0,lastSig='';
    // 7.0.3 긴 채팅: 1.5초 타이머는 채팅 뿌리 · iframe 문서가 바뀌었을 때만 훑는다 (그 밖의 변화는 문서마다 건 감시자 · iframe load 가 알린다)
    // 1.1.4 그 타이머 · 서명 계산은 과일 계열 세 모듈이 하나를 같이 써요(src/frame-poll.js — 살아 있는 iframe 목록 · 가려진 동안 쉼)
    const poll=framePoll(doc,host),frameSig=poll.sig;
    const schedule=()=>{if(!stopped&&!frame)frame=host.requestAnimationFrame(flush);};
    const rootSelector=FRUIT_TYPES.map(typeMatch).join(',');let mainWatch=rootSelector+',iframe';
    // 8.2.7 채팅 문서에서 떨어진 노드는 그 자손을 다 훑지 않고 결과로 봐요 — 채팅을 바꾸면 메시지 수백 개(요소 2만여 개)가 한 번에 떨어져, 떨어진 것마다 뿌리 선택자로 훑던 값이 컸어요.
    //   떨어짐으로 flush 결과가 바뀌는 것은 둘뿐이에요: 글자 style 을 붙여 둔 채(뿌리가 있었음) 마지막 뿌리가 빠졌을 때 · 지켜보던 iframe 이 빠졌을 때. 붙은 노드는 예전처럼 봐요
    const removedMatters=()=>{for(const f of frames.keys())if(!f.isConnected)return true;return styles.has(doc)&&!scopes.get(doc)?.root?.querySelector(rootSelector);};
    const mainRecords=records=>{if(fruitStructureChanged(records,mainWatch,'',false)||(records.some(r=>r.removedNodes?.length)&&removedMatters()))schedule();};
    function detach(d){styles.get(d)?.remove();styles.delete(d);for(const face of faces.get(d)||[])d.fonts?.delete(face);faces.delete(d);}
    function unwrap(d){wraps.get(d)?.remove();wraps.delete(d);}
    // 1.0.x 장식 색(✦ · 카드 아이콘)은 규칙만 있고 뿌리를 찾지 않아요 — 채팅 문서 머리에 한 벌, 바뀔 때만 다시 써요
    let decor=null,paletteSig='';
    const frameDecors=new Map();
    // 과일 iframe 은 테마 변수가 없어 지금 팔레트 값을 읽어 넣어요(팔레트가 바뀌면 1.5초 타이머가 알아채요)
    const tokenValue=c=>{try{return getComputedStyle(doc.body||doc.documentElement).getPropertyValue(`--salty-${c}`).trim();}catch{return '';}};
    const readPalette=()=>['accent','text','muted','line'].map(tokenValue).join('|');
    function paintFrameDecor(d,text){let s=frameDecors.get(d);if(!text){s?.remove();frameDecors.delete(d);return;}if(!s?.isConnected){s=d.createElement('style');s.dataset.blFruitDecor='';(d.head||d.documentElement).append(s);frameDecors.set(d,s);}if(s.textContent!==text)s.textContent=text;}
    let filters=null;
    function paintDecor(config){const text=fruitDecorCss(config);if(!text){decor?.remove();decor=null;filters?.remove();filters=null;return;}if(!decor?.isConnected){decor=doc.createElement('style');decor.dataset.blFruitDecor='';(doc.head||doc.documentElement).append(decor);holdSheet(decor);}if(decor.textContent!==text)decor.textContent=text;
        // 그림 장식 필터(팔레트 색 · 밝기는 불투명도로) — body 끝에 숨은 svg 한 벌
        if(!filters?.isConnected&&doc.body){const box=doc.createElement('div');box.innerHTML=decorFilterMarkup();const el=box.firstElementChild;if(el){filters=el;doc.body.append(el);}}}
    function flush(){
        frame=0;if(stopped)return;
        const config=tidyFruitType(getConfig()),css=fruitTypeCss(config,fontFamily),docs=new Set(),liveFrames=new Set();
        // 8.2.6 글꼴 설정이 하나도 켜져 있지 않으면(css 없음) 채팅 문서 안의 상태창 뿌리는 아무것도 바꾸지 않아요(아래 hasRoot 가 늘 거짓) — 그때 채팅 감시는 iframe 이 붙고 빠질 때만 다시 봐요.
        //   메시지가 붙을 때마다 과일 · 데우스 뿌리 선택자 목록(수십 갈래)으로 그 메시지 아래를 훑던 것. iframe 문서 안은 감싸기(WRAP) 때문에 그대로 뿌리까지 봐요
        mainWatch=css?rootSelector+',iframe':'iframe';paintDecor(config);
        // 팔레트 읽기(body 계산 스타일 — 그 자리에서 문서 스타일 계산을 강제해요)는 과일 iframe 에 장식을 칠할 때만 · 한 번에 한 번이에요.
        //   예전엔 flush 마다 먼저 읽어서, 상태창 iframe 이 없는 채팅 · 시작 덮개 동안에도 문서 전체(폰 리그 추적: 요소 218)를 다시 계산했어요
        let frameDecor=null;const frameDecorText=()=>{if(frameDecor===null){paletteSig=readPalette();frameDecor=fruitDecorCss(config,{owners:['fruit'],resolve:tokenValue});}return frameDecor;};
        const fonts=new Set();for(const t of Object.values(config.types))for(const r of Object.values(t.regions))if(r.on&&r.font!=='original'){const f=findFont(r.font);if(f&&!f.unusable)fonts.add(String(f.family).replace(/^['"]|['"]$/g,''));}
        function visit(d,scope){
            if(!scope||docs.has(d))return;docs.add(d);
            const old=scopes.get(d);if(old?.root!==scope){old?.observer();const observer=watchWith(host,[[scope,{childList:true,subtree:true,name:'과일 글자 (상태창)'}]],d===doc?mainRecords:records=>{if(fruitStructureChanged(records,rootSelector+',iframe'))schedule();});scopes.set(d,{root:scope,observer});}
            const hasRoot=(css||d!==doc)&&!!scope.querySelector(rootSelector);
            if(d!==doc)paintFrameDecor(d,hasRoot?frameDecorText():'');
            if(d!==doc&&hasRoot){let wrap=wraps.get(d);if(!wrap?.isConnected){wrap=d.createElement('style');wrap.dataset.blFruitWrap='';wrap.textContent=WRAP;(d.head||d.documentElement).append(wrap);wraps.set(d,wrap);}}else unwrap(d);
            if(css&&hasRoot){
                let style=styles.get(d);if(!style){style=d.createElement('style');style.dataset.blFruitTypography='';(d.head||d.documentElement).append(style);styles.set(d,style);}if(style.textContent!==css)style.textContent=css;
                if(d!==doc&&d.fonts){const owned=faces.get(d)||new Set();faces.set(d,owned);for(const face of [...owned])if(!fonts.has(face.family.replace(/^['"]|['"]$/g,''))){d.fonts.delete(face);owned.delete(face);}doc.fonts?.forEach(face=>{if(fonts.has(face.family.replace(/^['"]|['"]$/g,''))&&!d.fonts.has(face)){d.fonts.add(face);owned.add(face);}});}
            }else detach(d);
            for(const f of scope.querySelectorAll('iframe')){liveFrames.add(f);if(!frames.has(f)){f.addEventListener('load',schedule);frames.set(f,schedule);}try{if(f.contentDocument?.body)visit(f.contentDocument,f.contentDocument.body);}catch{}}
        }
        visit(doc,doc.querySelector('#chat'));lastSig=frameSig();
        for(const [d,e]of scopes)if(!docs.has(d)){e.observer();scopes.delete(d);detach(d);unwrap(d);paintFrameDecor(d,'');}
        for(const [f,fn]of frames)if(!liveFrames.has(f)){f.removeEventListener('load',fn);frames.delete(f);}
    }
    const offPoll=poll.every(()=>{if(frameSig()!==lastSig||(frameDecors.size&&readPalette()!==paletteSig))schedule();});flush();
    const cleanup=()=>{if(stopped)return;stopped=true;offPoll();host.cancelAnimationFrame(frame);for(const e of scopes.values())e.observer();for(const [f,fn]of frames)f.removeEventListener('load',fn);for(const d of styles.keys())detach(d);for(const d of [...wraps.keys()])unwrap(d);decor?.remove();decor=null;filters?.remove();filters=null;for(const d of [...frameDecors.keys()])paintFrameDecor(d,'');scopes.clear();frames.clear();};
    cleanup.refresh=schedule;return cleanup;
}
