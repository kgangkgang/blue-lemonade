import {getSettings,saveSettings} from '../settings.js';
import {entryDisplay,entryIcon,chooseFruitIcon} from './fruit-entry-icons.js';
export const entryMode=value=>['wand','qr','cat'].includes(value)?value:'wand';
const fruitButtonName=value=>String(value||'').replace(/\s+/g,'')==='🍎果实之心';
/** One display entry, while the original Helper configuration stays untouched. */
export function installFruitEntry(doc=document,host=window){
    let stopped=false,queued=0,proxy=null,chooser=null,chooserAnchor=null,picker=null;
    const style=doc.createElement('style');style.dataset.blFruitEntry='';
    style.textContent=`:root{--bl-fruit-entry-fallback-8882:#8882;--bl-fruit-entry-fallback-8883:#8883;--bl-fruit-entry-fallback-8884:#8884;--bl-fruit-entry-fallback-ddd:#ddd;}
body[data-bl-fruit-entry] #fruit-heart-v6-wand-entry,body[data-bl-fruit-entry] #fruit-heart-v6-dock,body[data-bl-fruit-entry] [data-fh-cat="1"]:not([data-bl-fruit-entry-proxy]),body[data-bl-fruit-entry] [data-bl-fruit-native-entry]:not([data-bl-fruit-entry-proxy]){display:none!important}
body[data-bl-fruit-entry] #fruit-heart-v6 [data-entry-toggle="bar"],body[data-bl-fruit-entry] #fruit-heart-v6 [data-entry-toggle="ball"]{pointer-events:none}
body[data-bl-fruit-entry] .fh-nsfw-lit::after{display:none!important;content:none!important}
[data-bl-fruit-entry-proxy]:not([data-bl-fruit-entry-proxy=wand]){font:inherit;color:var(--salty-text,var(--SmartThemeBodyColor,var(--bl-fruit-entry-fallback-ddd)));background:var(--bl-fill-control,var(--bl-fruit-entry-fallback-8882));border:1px solid var(--SmartThemeBorderColor,var(--bl-fruit-entry-fallback-8884));border-radius:8px;padding:6px 10px;min-height:36px;max-width:100%;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
[data-bl-fruit-entry-proxy=cat]{position:fixed;right:14px;bottom:auto;top:calc(100vh - 144px);top:calc(100dvh - 144px);z-index:10010;width:44px;height:44px;justify-content:center;border-radius:50%}
[data-bl-fruit-entry-proxy] [hidden],.bl-fruit-entry-choice [hidden]{display:none!important}
body[data-bl-fruit-entry] [data-bl-fruit-entry-proxy=qr][data-bl-fruit-entry-display=icon]{width:auto;min-width:0;height:auto;min-height:0;padding:5px 10px;justify-content:center}body[data-bl-fruit-entry] [data-bl-fruit-entry-proxy=qr][data-bl-fruit-entry-display=icon] i{font-size:15px;line-height:1}
body[data-bl-fruit-entry] #send_form :is(#qr--bar,#nonQRFormItems)>[data-bl-fruit-entry-proxy=qr][data-bl-fruit-entry-display=icon]{flex:0 0 auto;min-width:0;min-height:0;border-radius:8px;width:var(--bottomFormBlockSize,36px);height:var(--bottomFormBlockSize,36px);padding:0;border:0;background:transparent;box-shadow:none;color:var(--salty-muted,inherit)}body[data-bl-fruit-entry] #send_form :is(#qr--bar,#nonQRFormItems)>[data-bl-fruit-entry-proxy=qr][data-bl-fruit-entry-display=icon] i{font-size:calc(var(--bottomFormIconSize,24px)*.7)}
.bl-fruit-entry-choice{display:flex;flex-wrap:wrap;align-items:center;gap:0 16px;margin:0;padding:10px var(--bl-fh-pad,12px) 0}.bl-fruit-entry-choice>strong{flex-basis:100%;font:inherit;font-weight:600}.bl-fruit-entry-choice>label{display:flex;align-items:center;gap:6px;min-height:40px;cursor:pointer}.bl-fruit-entry-choice input{width:16px!important;height:16px!important;margin:0!important;min-height:0!important}
.bl-fruit-qr-display{flex:0 0 calc(100% + 2*var(--bl-fh-pad,12px));display:flex;flex-direction:column;min-width:0;margin:4px calc(-1*var(--bl-fh-pad,12px)) 0}.bl-fruit-qr-display>label,.bl-fruit-qr-display>div{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--bl-fh-row,44px);padding:6px var(--bl-fh-pad,12px);border-top:1px solid var(--line,var(--bl-fruit-entry-fallback-8883));cursor:default}.bl-fruit-qr-display>label>span,.bl-fruit-qr-display>div>span{min-width:0}
#fruit-heart-v6 .bl-fruit-qr-display select{flex:0 1 auto;width:auto!important;max-width:58%;margin:0!important}#fruit-heart-v6 .bl-fruit-qr-display button{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;min-height:var(--bl-fh-control,36px);padding:0 12px;border-radius:var(--r2,8px);background:var(--fill,var(--bl-fruit-entry-fallback-8882));color:inherit;font:inherit;cursor:pointer}#fruit-heart-v6 .bl-fruit-qr-display i.fa-solid{font-family:"Font Awesome 6 Free"!important;font-weight:900;font-size:1.05em;margin:0}
.bl-fruit-qr-display small{display:block;padding:0 var(--bl-fh-pad,12px) 10px;color:var(--ink2,inherit);font-size:.85em}`;
    doc.head.append(style);
    const hiddenRows=new Map(),hints=new Map(),nativeEntries=new Map();
    function collectEntries(){
        const found=new Set(doc.querySelectorAll('[data-fh-cat="1"],.fh-synthetic-entry'));
        for(const node of doc.querySelectorAll('.qr--button,#qr--bar button,#quickReplies button')){
            if(fruitButtonName(node.textContent)||fruitButtonName(node.title))found.add(node);
        }
        // Helper renders script buttons without ids. Its read-only model preserves
        // original names even when display translation or a custom label replaces them.
        try{
            const api=host.TavernHelper||host;
            const groups=api.getAllEnabledScriptButtons?.()||{};
            for(const [id,buttons]of Object.entries(groups)){
                if(!Array.isArray(buttons))continue;
                const container=doc.getElementById(`script_container_${id}`);
                const nodes=container?[...container.children].filter(node=>node.classList.contains('qr--button')):[];
                if(nodes.length!==buttons.length)continue;
                buttons.forEach((button,index)=>{if(fruitButtonName(button.button_name))found.add(nodes[index]);});
            }
        }catch{/* Helper may be between preset unload and reload. */}
        for(const [node,before]of nativeEntries)if(!found.has(node)||node.hasAttribute('data-bl-fruit-entry-proxy')){if(before===null)node.removeAttribute('data-bl-fruit-native-entry');else node.setAttribute('data-bl-fruit-native-entry',before);nativeEntries.delete(node);}
        for(const node of found)if(!node.hasAttribute('data-bl-fruit-entry-proxy')&&!nativeEntries.has(node)){nativeEntries.set(node,node.getAttribute('data-bl-fruit-native-entry'));node.setAttribute('data-bl-fruit-native-entry','');}
    }
    const schedule=()=>{if(!stopped&&!queued)queued=host.requestAnimationFrame(flush);};
    // 7.7.4 1.5초 안전망은 값싼 서명(요소 정체 · 자식 수 · 클래스 · 설정)이 바뀌었을 때만 전부 다시 본다 — 바뀐 게 없어도 매번 문서 전체를 두 번 훑고
    // QR 줄 계산 스타일을 읽었다 (폰 흉내 CPU 6배, 채팅 전환 10번에 1.3초). 서명이 못 보는 변화에 대비해 10번에 한 번은 그냥 다시 본다.
    // 과일 창(<html> 아래라 body 감시 밖)이 열려 있는 동안은 예전처럼 매번 — 창 안의 입구 고르기 · 줄 숨기기가 늦지 않게.
    const ids=new WeakMap();let nextId=1,ticks=0,lastSig='';const idOf=o=>{if(!o)return 0;let i=ids.get(o);if(!i)ids.set(o,i=nextId++);return i;};
    const signature=()=>{const el=id=>doc.getElementById(id),qr=el('qr--bar'),s=getSettings();return [...['fruit-heart-v6','fruit-heart-v6-wand-entry','fruit-heart-v6-dock','qr--bar','quickReplies','nonQRFormItems','extensionsMenu','send_form','loader'].map(id=>idOf(el(id))),qr?.childElementCount,qr?.className,qr?.getAttribute('style'),el('nonQRFormItems')?.childElementCount,el('extensionsMenu')?.childElementCount,doc.body.childElementCount,doc.body.className,doc.documentElement.className,idOf(proxy?.parentElement),idOf(proxy?.nextElementSibling),!!chooser?.isConnected,s.fruitEntryMode,s.fruitEntryDisplay,s.fruitEntryIcon,host.SillyTavern?.getContext?.()?.extensionSettings?.blue_lemonade_scripts?.names?.fruit,typeof host.__FRUIT_HEART_MAIN__?.open].join('|');};
    function open(){
        const api=host.__FRUIT_HEART_MAIN__;
        if(typeof api?.open==='function')api.open();else doc.getElementById('fruit-heart-v6-wand-entry')?.click();
    }
    function flush(){flushNow();if(!stopped)lastSig=signature();}
    function flushNow(){
        queued=0;if(stopped)return;
        const native=doc.getElementById('fruit-heart-v6-wand-entry'),panel=doc.getElementById('fruit-heart-v6');
        const available=!!native||!!panel||typeof host.__FRUIT_HEART_MAIN__?.open==='function';
        if(!available){proxy?.remove();proxy=null;doc.body.removeAttribute('data-bl-fruit-entry');return;}
        const mode=entryMode(getSettings().fruitEntryMode);if(doc.body.getAttribute('data-bl-fruit-entry')!==mode)doc.body.setAttribute('data-bl-fruit-entry',mode);
        collectEntries();
        if(!proxy||proxy.dataset.blFruitEntryProxy!==mode){proxy?.remove();proxy=doc.createElement(mode==='wand'?'div':'button');if(mode==='wand'){proxy.tabIndex=0;proxy.setAttribute('role','button');proxy.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();proxy.click();}});}else proxy.type='button';proxy.dataset.blFruitEntryProxy=mode;proxy.className=mode==='qr'?'qr--button interactable':mode==='wand'?'list-group-item flex-container flexGap5 interactable':'interactable';proxy.setAttribute('aria-label','과일의 마음 열기');proxy.title='과일의 마음 열기';proxy.innerHTML=mode==='cat'?'<i class="fa-solid fa-cat" aria-hidden="true"></i>':(mode==='wand'?'<div class="fa-solid fa-apple-whole extensionsMenuExtensionButton" aria-hidden="true"></div><span>과일의 마음</span>':'<i class="fa-solid fa-apple-whole" aria-hidden="true"></i><span>과일의 마음</span>');proxy.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();});}
        const savedName=host.SillyTavern?.getContext?.()?.extensionSettings?.blue_lemonade_scripts?.names?.fruit;const label=mode==='qr'&&typeof savedName==='string'&&savedName.trim()?Array.from(savedName.trim()).slice(0,40).join(''):'과일의 마음';const caption=proxy.querySelector('span');if(caption&&caption.textContent!==label)caption.textContent=label;
        const display=entryDisplay(getSettings().fruitEntryDisplay),icon=entryIcon(getSettings().fruitEntryIcon),glyph=proxy.querySelector('i,.extensionsMenuExtensionButton');
        if(proxy.dataset.blFruitEntryDisplay!==display)proxy.dataset.blFruitEntryDisplay=display;
        if(caption&&caption.hidden!==(mode==='qr'&&display==='icon'))caption.hidden=mode==='qr'&&display==='icon';
        if(glyph){if(glyph.hidden!==(mode==='qr'&&display==='text'))glyph.hidden=mode==='qr'&&display==='text';const classes=`fa-solid ${mode==='cat'?'fa-cat':mode==='qr'?icon:'fa-apple-whole extensionsMenuExtensionButton'}`;if(glyph.className!==classes)glyph.className=classes;}
        // Under the startup loader nothing is visible yet: skip the computed-style read (a full style recalc per flush while the page is built) and place it precisely on APP_READY.
        const qrBar=doc.getElementById('qr--bar');const target=mode==='wand'?doc.getElementById('extensionsMenu'):mode==='qr'?(qrBar&&(doc.getElementById('loader')||host.getComputedStyle(qrBar).display!=='none')?qrBar:(doc.getElementById('nonQRFormItems')||doc.getElementById('send_form'))):doc.body;
        // Icon-only sits beside the send-form icons, outside the QR bar's own padding and gap.
        if(target===qrBar&&display==='icon'&&qrBar.parentElement?.id==='nonQRFormItems'){if(proxy.nextElementSibling!==qrBar)qrBar.before(proxy);}
        else if(target&&proxy.parentElement!==target)target.append(proxy);
        const header=panel?.querySelector('[data-entry-toggle="bar"]')?.closest('.fh-card')?.querySelector('.fh-card-head p');
        if(header&&!hints.has(header)){hints.set(header,{original:header.textContent,shown:'요술봉·QR·고양이 중 하나만 선택해요. 다른 방법을 고르면 이전 입구는 숨겨져요.'});header.textContent=hints.get(header).shown;}
        const bar=panel?.querySelector('[data-entry-toggle="bar"]');const anchor=bar?.closest('.fh-toggle')||bar?.parentElement;
        if(anchor&&(!chooser?.isConnected||anchor!==chooserAnchor)){
            chooser?.remove();chooser=doc.createElement('div');chooser.className='bl-fruit-entry-choice';chooser.dataset.blFruitUserLabel='1';chooser.innerHTML='<strong>과일 패널 여는 방법 · 하나 선택</strong>'+[['wand','요술봉'],['qr','QR'],['cat','고양이']].map(([v,t])=>`<label><input type="radio" name="bl-fruit-entry-mode" value="${v}"><span>${t}</span></label>`).join('');
            const appearance=doc.createElement('div');appearance.className='bl-fruit-qr-display';appearance.innerHTML='<label><span>QR 버튼 표시</span><select data-fruit-entry-display><option value="icon">아이콘만</option><option value="text">글자만</option><option value="both">아이콘+글자</option></select></label><div><span>아이콘</span><button type="button" data-fruit-entry-icon aria-label="아이콘 바꾸기"><i aria-hidden="true"></i>바꾸기</button></div><small>저장한 이름은 글자 표시를 켜면 다시 보여요.</small>';chooser.append(appearance);
            chooser.addEventListener('change',e=>{e.stopPropagation();if(e.target.matches('input[type=radio]'))getSettings().fruitEntryMode=entryMode(e.target.value);else if(e.target.hasAttribute('data-fruit-entry-display'))getSettings().fruitEntryDisplay=entryDisplay(e.target.value);else return;saveSettings();flush();});
            chooser.addEventListener('click',async e=>{if(!e.target.closest('[data-fruit-entry-icon]')||picker)return;e.preventDefault();e.stopPropagation();picker=chooseFruitIcon(entryIcon(getSettings().fruitEntryIcon),{doc,host});const chosen=await picker.promise;picker=null;if(stopped||!chosen)return;getSettings().fruitEntryIcon=entryIcon(chosen);saveSettings();flush();});anchor.before(chooser);chooserAnchor=anchor;
        }
        for(const button of panel?.querySelectorAll('[data-entry-toggle="bar"],[data-entry-toggle="ball"]')||[]){const row=button.closest('.fh-toggle')||button.parentElement;if(row&&!hiddenRows.has(row)){hiddenRows.set(row,row.style.display);row.style.display='none';}}
        for(const el of panel?.querySelectorAll('[data-ball-size],[data-entry-toggle="jump"]')||[]){const row=el.closest('.fh-row,.fh-toggle');if(!row)continue;if(!hiddenRows.has(row))hiddenRows.set(row,row.style.display);const want=mode==='cat'?hiddenRows.get(row):'none';if(row.style.display!==want)row.style.display=want;} // 고양이 크기 · 꼬리와 발 층 이동은 고양이로 열 때만
        for(const input of chooser?.querySelectorAll('input')||[])input.checked=input.value===mode;
        const appearance=chooser?.querySelector('.bl-fruit-qr-display');if(appearance){if(appearance.hidden!==(mode!=='qr'))appearance.hidden=mode!=='qr';appearance.querySelector('select').value=display;const i=appearance.querySelector('i');if(i.className!==`fa-solid ${icon}`)i.className=`fa-solid ${icon}`;}
    }
    // Entries live in #send_form, the wand menu and body itself, never in the chat, a settings drawer or a <select>: skip message rendering,
    // streaming and drawer UI filling in after startup (each flush reads the QR bar's computed style). The 1.5 s timer stays as the safety net.
    // 7.7.4 입구가 생기거나 옮겨질 수 있는 곳(입력 줄 · 요술봉 메뉴 · 과일 창 · body 바로 아래)의 변화이거나, 넣고 뺀 요소가 입구 모양일 때만 —
    // 알림 · 팝업 · 배경처럼 상관없는 곳이 바뀔 때마다 다시 보던 것 (부팅 · 채팅 전환에 수십 번)
    const ENTRY='[data-fh-cat],.fh-synthetic-entry,[id^="fruit-heart-v6"],.qr--button,#qr--bar,#quickReplies,#extensionsMenu,#nonQRFormItems,#loader,[data-bl-fruit-entry-proxy]';
    const touches=list=>{for(const n of list)if(n.nodeType===1&&(n.matches(ENTRY)||n.querySelector(ENTRY)))return true;return false;};
    const observer=new host.MutationObserver(records=>{for(const r of records){const t=r.target.nodeType===1?r.target:r.target.parentElement;if(!t||t.closest?.('#chat,.drawer-content,select'))continue;if(t===doc.body||t.closest('#send_form,#extensionsMenu,#quickReplies,[id^="fruit-heart-v6"],[data-fh-cat]')||touches(r.addedNodes)||touches(r.removedNodes)){schedule();return;}}});observer.observe(doc.body,{childList:true,subtree:true});const timer=host.setInterval(()=>{if(++ticks%10===0||doc.getElementById('fruit-heart-v6')?.classList?.contains('open')||signature()!==lastSig)schedule();},1500);flush();
    if(doc.getElementById('loader'))try{const ctx=host.SillyTavern?.getContext?.();ctx?.eventSource?.once?.(ctx.event_types?.APP_READY,schedule);}catch{/* the 1.5 s timer corrects the place */}
    return()=>{if(stopped)return;stopped=true;picker?.close();observer.disconnect();host.clearInterval(timer);host.cancelAnimationFrame(queued);proxy?.remove();chooser?.remove();doc.body.removeAttribute('data-bl-fruit-entry');for(const [node,before]of nativeEntries){if(before===null)node.removeAttribute('data-bl-fruit-native-entry');else node.setAttribute('data-bl-fruit-native-entry',before);}nativeEntries.clear();for(const [row,before]of hiddenRows)if(row.style.display==='none')row.style.display=before;hiddenRows.clear();for(const [node,change]of hints)if(node.textContent===change.shown)node.textContent=change.original;hints.clear();style.remove();};
}
