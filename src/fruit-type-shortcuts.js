import {fruitStructureChanged} from './fruit-type-mutations.js';
import {FRUIT_TYPES} from './fruit-type-schema.js';
import {optionFamily} from './scripts/fruit-option-help.js';
import {openFruitTypography} from './fruit-type-ui.js';
const leases=new WeakMap();
export function installFruitTypeShortcuts(doc=document,host=window){
    let lease=leases.get(doc);if(!lease){lease={count:0,stop:startShortcuts(doc,host)};leases.set(doc,lease);}lease.count++;let released=false;return()=>{if(released)return;released=true;if(--lease.count===0){lease.stop();leases.delete(doc);}};
}
function startShortcuts(doc,host){
    const buttons=new Map(),types=new Map(FRUIT_TYPES.map(t=>[t.prompt,t]));let stopped=false,frame=0,pickerGroup='',lastSig='';
    // 7.0.3 긴 채팅: 데우스 카드는 선택자 하나로 한 번만 훑고(종류마다 채팅 전체를 7번 훑었다), 1.5초 타이머는 과일 · 데우스 창이 열려 있거나
    // 채팅 뿌리 · iframe 문서(와 그 안 요소 수)가 바뀌었을 때만 훑는다 — iframe 안은 body 감시자가 못 보므로 요소 수까지 본다
    const DEUS=FRUIT_TYPES.filter(t=>t.owner==='deus'),DEUS_ROOT=DEUS.map(t=>t.root).join(',');
    const ids=new WeakMap();let nextId=1;const idOf=o=>{if(!o)return 0;let i=ids.get(o);if(!i)ids.set(o,i=nextId++);return i;};
    const frameSig=(withCounts=false)=>{const out=[];const walk=(scope,depth)=>{out.push(idOf(scope));if(!scope||depth>3)return;for(const f of scope.querySelectorAll('iframe')){let d=null;try{d=f.contentDocument;}catch{}out.push(idOf(d));if(withCounts)out.push(d?.querySelectorAll?.('*').length||0);if(d?.body)walk(d.body,depth+1);}};walk(doc.querySelector('#chat'),0);return out.join(',');};
    const schedule=()=>{if(!stopped&&!frame)frame=host.requestAnimationFrame(flush);};
    function flush(){
        frame=0;if(stopped)return;const live=new Set();
        for(const target of doc.querySelectorAll('#fruit-heart-v6 [data-chip],#fruit-heart-v6 input[data-prompt-id],#fruit-heart-v6 [data-pick-index]')){
            let id=target.dataset.chip||target.dataset.promptId;
            if(target.hasAttribute('data-pick-index')&&pickerGroup){
                try{const owner=typeof host.getPreset==='function'?host:host.TavernHelper,preset=owner?.getPreset?.('in_use'),prompts=preset?.prompts||[];const key=p=>String(p.id??p.identifier??'');const config=JSON.parse(prompts.find(p=>key(p)==='fruit-heart-control-config-v2')?.content||'{}');id=key(prompts.filter(p=>key(p)!=='fruit-heart-control-config-v2'&&optionFamily(p,config.controlGroups||{})===pickerGroup)[Number(target.dataset.pickIndex)-1]);}catch{}
            }
            const type=types.get(id);if(!type)continue;
            const anchor=target.closest('.fh-item')||target;if(!anchor.parentElement)continue;live.add(anchor);
            if(!buttons.has(anchor)){
                const button=doc.createElement('button');button.type='button';button.className='bl-ft-shortcut';button.textContent='블루레몬에이드';button.setAttribute('aria-label',`${type.name} 글자 설정`);
                button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();void openFruitTypography(type.id);});
                anchor.after(button);buttons.set(anchor,button);
            }
        }
        const attach=(anchor,type)=>{if(!anchor?.parentElement)return;live.add(anchor);let button=buttons.get(anchor);if(!button){button=anchor.ownerDocument.createElement('button');button.type='button';button.className='bl-ft-shortcut';button.textContent='블루레몬에이드';button.style.cssText='font:inherit;font-size:.8em;min-height:32px;padding:4px 10px;border:1px solid #8885;border-radius:8px;background:var(--bl-fill-control,#8882);color:inherit;max-width:100%;';button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();void openFruitTypography(button.dataset.blType);});anchor.after(button);buttons.set(anchor,button);}button.dataset.blType=type.id;button.setAttribute('aria-label',type.name+' 글자 설정');};
        for(const row of doc.querySelectorAll('#bl-deus-popover .dq-row,#bl-deus-popover .dq-toggle')){const key=row.querySelector('[data-dq-focus]')?.dataset.dqFocus,type=FRUIT_TYPES.find(t=>t.owner==='deus'&&t.prompt===key);if(type)attach(row,type);}
        const seen=new Set();const scan=(d,scope)=>{if(!scope||seen.has(d))return;seen.add(d);for(const card of scope.querySelectorAll(DEUS_ROOT)){let type=null;for(const t of DEUS)if(card.matches(t.root))type=t;if(type)attach(card,type);}for(const f of scope.querySelectorAll('iframe'))try{if(f.contentDocument?.body)scan(f.contentDocument,f.contentDocument.body);}catch{}};scan(doc,doc.querySelector('#chat'));lastSig=frameSig(true);
        for(const [target,button]of buttons)if(!live.has(target)||!target.isConnected){button.remove();buttons.delete(target);}
    }
    const click=e=>{const group=e.target.closest?.('#fruit-heart-v6 [data-pick-group]');if(group){pickerGroup=group.dataset.pickGroup;schedule();}else if(e.target.closest?.('#fruit-heart-v6 [data-pick-font],#fruit-heart-v6 [data-pick-model]'))pickerGroup='';};
    doc.addEventListener('click',click,true);
    // 7.7.4 과일 창 뿌리(#fruit-heart-v6)는 닫혀도 문서에 남고 열릴 때만 .open 이 붙는다 — 있기만 하면 1.5초마다 채팅 전체 · iframe 을 훑었다.
    //   데우스 빠른 설정 창(#bl-deus-popover)은 닫으면 빠지므로 그대로.
    // While a reply streams, skip its text changes and look once when generation ends (body[data-generating] is removed).
    // Settings drawers and <select> lists never hold these cards or rows.
    const observer=new host.MutationObserver(records=>{const streaming=!!doc.body.dataset.generating;for(const r of records){if(r.attributeName==='data-generating'){if(!streaming)schedule();continue;}if(r.target.closest?.('.drawer-content,select'))continue;if((!streaming||!r.target.closest?.('.mes_text'))&&fruitStructureChanged([r],DEUS_ROOT+',iframe,#chat,#fruit-heart-v6,#bl-deus-popover','#fruit-heart-v6,#bl-deus-popover')){schedule();return;}}});
    observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});observer.observe(doc.body,{attributes:true,attributeFilter:['data-generating']});const timer=host.setInterval(()=>{if(doc.querySelector('#fruit-heart-v6.open,#bl-deus-popover')||frameSig(true)!==lastSig)schedule();},1500);flush();
    return()=>{stopped=true;host.clearInterval(timer);doc.removeEventListener('click',click,true);observer.disconnect();host.cancelAnimationFrame(frame);for(const b of buttons.values())b.remove();buttons.clear();};
}
