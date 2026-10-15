import {getSettings,saveSettings} from '../settings.js';
export const entryMode=value=>['wand','qr','cat'].includes(value)?value:'wand';
const fruitButtonName=value=>String(value||'').replace(/\s+/g,'')==='🍎果实之心';
/** One display entry, while the original Helper configuration stays untouched. */
export function installFruitEntry(doc=document,host=window){
    let stopped=false,queued=0,proxy=null,chooser=null,chooserAnchor=null;
    const style=doc.createElement('style');style.dataset.blFruitEntry='';
    style.textContent=`body[data-bl-fruit-entry] #fruit-heart-v6-wand-entry,body[data-bl-fruit-entry] #fruit-heart-v6-dock,body[data-bl-fruit-entry] [data-fh-cat="1"]:not([data-bl-fruit-entry-proxy]),body[data-bl-fruit-entry] [data-bl-fruit-native-entry]:not([data-bl-fruit-entry-proxy]){display:none!important}
body[data-bl-fruit-entry] #fruit-heart-v6 [data-entry-toggle="bar"],body[data-bl-fruit-entry] #fruit-heart-v6 [data-entry-toggle="ball"]{pointer-events:none}
body[data-bl-fruit-entry] .fh-nsfw-lit::after{display:none!important;content:none!important}
[data-bl-fruit-entry-proxy]{font:inherit;color:var(--salty-text,var(--SmartThemeBodyColor,#ddd));background:var(--bl-fill-control,#8882);border:1px solid var(--SmartThemeBorderColor,#8884);border-radius:8px;padding:6px 10px;min-height:36px;max-width:100%;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
[data-bl-fruit-entry-proxy=cat]{position:fixed;right:14px;bottom:100px;z-index:10010;width:44px;height:44px;justify-content:center;border-radius:50%}
.bl-fruit-entry-choice{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0}.bl-fruit-entry-choice>strong{flex-basis:100%;font:inherit;font-weight:600}.bl-fruit-entry-choice label{display:flex;align-items:center;gap:5px;min-height:36px;cursor:pointer}.bl-fruit-entry-choice input{width:16px!important;height:16px!important;margin:0!important;min-height:0!important}`;
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
    function open(){
        const api=host.__FRUIT_HEART_MAIN__;
        if(typeof api?.open==='function')api.open();else doc.getElementById('fruit-heart-v6-wand-entry')?.click();
    }
    function flush(){
        queued=0;if(stopped)return;
        const native=doc.getElementById('fruit-heart-v6-wand-entry'),panel=doc.getElementById('fruit-heart-v6');
        const available=!!native||!!panel||typeof host.__FRUIT_HEART_MAIN__?.open==='function';
        if(!available){proxy?.remove();proxy=null;doc.body.removeAttribute('data-bl-fruit-entry');return;}
        const mode=entryMode(getSettings().fruitEntryMode);doc.body.setAttribute('data-bl-fruit-entry',mode);
        collectEntries();
        if(!proxy||proxy.dataset.blFruitEntryProxy!==mode){proxy?.remove();proxy=doc.createElement('button');proxy.type='button';proxy.dataset.blFruitEntryProxy=mode;proxy.className=mode==='qr'?'qr--button interactable':'interactable';proxy.setAttribute('aria-label','과일의 마음 열기');proxy.title='과일의 마음 열기';proxy.innerHTML=mode==='cat'?'<i class="fa-solid fa-cat" aria-hidden="true"></i>':'<i class="fa-solid fa-apple-whole" aria-hidden="true"></i><span>과일의 마음</span>';proxy.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();});}
        const savedName=host.SillyTavern?.getContext?.()?.extensionSettings?.blue_lemonade_scripts?.names?.fruit;const label=mode==='qr'&&typeof savedName==='string'&&savedName.trim()?Array.from(savedName.trim()).slice(0,40).join(''):'과일의 마음';const caption=proxy.querySelector('span');if(caption&&caption.textContent!==label)caption.textContent=label;
        const qrBar=doc.getElementById('qr--bar');const target=mode==='wand'?doc.getElementById('extensionsMenu'):mode==='qr'?(qrBar&&host.getComputedStyle(qrBar).display!=='none'?qrBar:(doc.getElementById('nonQRFormItems')||doc.getElementById('send_form'))):doc.body;
        if(target&&proxy.parentElement!==target)target.append(proxy);
        const header=panel?.querySelector('[data-entry-toggle="bar"]')?.closest('.fh-card')?.querySelector('.fh-card-head p');
        if(header&&!hints.has(header)){hints.set(header,{original:header.textContent,shown:'요술봉·QR·고양이 중 하나만 선택해요. 다른 방법을 고르면 이전 입구는 숨겨져요.'});header.textContent=hints.get(header).shown;}
        const bar=panel?.querySelector('[data-entry-toggle="bar"]');const anchor=bar?.closest('.fh-toggle')||bar?.parentElement;
        if(anchor&&(!chooser?.isConnected||anchor!==chooserAnchor)){
            chooser?.remove();chooser=doc.createElement('div');chooser.className='bl-fruit-entry-choice';chooser.dataset.blFruitUserLabel='1';chooser.innerHTML='<strong>과일 패널 여는 방법 · 하나 선택</strong>'+[['wand','요술봉'],['qr','QR'],['cat','고양이']].map(([v,t])=>`<label><input type="radio" name="bl-fruit-entry-mode" value="${v}"><span>${t}</span></label>`).join('');
            chooser.addEventListener('change',e=>{if(!e.target.matches('input[type=radio]'))return;e.stopPropagation();getSettings().fruitEntryMode=entryMode(e.target.value);saveSettings();flush();});anchor.before(chooser);chooserAnchor=anchor;
        }
        for(const button of panel?.querySelectorAll('[data-entry-toggle="bar"],[data-entry-toggle="ball"]')||[]){const row=button.closest('.fh-toggle')||button.parentElement;if(row&&!hiddenRows.has(row)){hiddenRows.set(row,row.style.display);row.style.display='none';}}
        for(const input of chooser?.querySelectorAll('input')||[])input.checked=input.value===mode;
    }
    const observer=new host.MutationObserver(schedule);observer.observe(doc.body,{childList:true,subtree:true});const timer=host.setInterval(schedule,1500);flush();
    return()=>{if(stopped)return;stopped=true;observer.disconnect();host.clearInterval(timer);host.cancelAnimationFrame(queued);proxy?.remove();chooser?.remove();doc.body.removeAttribute('data-bl-fruit-entry');for(const [node,before]of nativeEntries){if(before===null)node.removeAttribute('data-bl-fruit-native-entry');else node.setAttribute('data-bl-fruit-native-entry',before);}nativeEntries.clear();for(const [row,before]of hiddenRows)if(row.style.display==='none')row.style.display=before;hiddenRows.clear();for(const [node,change]of hints)if(node.textContent===change.shown)node.textContent=change.original;hints.clear();style.remove();};
}
