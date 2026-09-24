// Presentation-only fixes. Saved message text and translator source hashes are untouched.
import { normalizeTrackerSpacing } from './addons/bookmarks/tracker-spacing.js';
import { restoreDialogueTildes, resetDialogueTildes } from './dialogue-tildes.js';
let active=false, observer=null, timer=0;
const originals=new Map(), dirty=new Set();
export function typesetRoot(root) {
    if(!active||!root?.querySelectorAll)return;
    // The same Markdown separators appear in chat and bookmark renderings.
    // Reuse the targeted cleanup; preserve line breaks inside actual prose.
    normalizeTrackerSpacing(root);
    restoreDialogueTildes(root);
    for(const q of root.querySelectorAll('.mes_text q, .salty-sample q')) {
        if(q.closest('pre,code,details[class*="custom-dem-card"],.custom-dem-track'))continue;
        let previous=q.previousSibling;
        while(previous?.nodeType===3&&!previous.textContent.trim())previous=previous.previousSibling;
        q.classList.toggle('bl-line-dialogue',previous?.nodeName==='BR');
        const walker=document.createTreeWalker(q,NodeFilter.SHOW_TEXT);
        const first=walker.nextNode();if(!first)continue;
        if(first.parentElement?.closest('.bl-quote-lead'))continue;
        const text=first.textContent;
        const cleaned=text.replace(/^([「『“"])[ \t\u3000]+(?=\S)/u,'$1');
        // With justified, unspaced Korean, the browser may stretch the sole
        // break opportunity after a corner quote. Keep quote + first letter
        // together; removing whitespace cannot fix this (there may be none).
        if(/^[「『][\p{L}\p{N}]/u.test(cleaned)) {
            const prefix=[...cleaned].slice(0,2).join('');
            const lead=document.createElement('span');lead.className='bl-quote-lead';lead.textContent=prefix;
            const after=cleaned.slice(prefix.length);
            originals.set(first,{before:text,after,lead,prefix});
            first.textContent=after;first.before(lead);
        }else if(cleaned!==text) {originals.set(first,{before:text,after:cleaned});first.textContent=cleaned;}
    }
    for(const node of originals.keys())if(!node.isConnected)originals.delete(node);
}
export function syncTypography(on) {
    if(active===on)return;active=on;
    if(!on){
        observer?.disconnect();observer=null;clearTimeout(timer);dirty.clear();
        for(const [node,value] of originals){
            if(!node.isConnected)continue;
            if(node.textContent===value.after&&(!value.lead||value.lead.textContent===value.prefix)){
                value.lead?.remove();node.textContent=value.before;
            }else if(value.lead?.isConnected)value.lead.replaceWith(...value.lead.childNodes);
        }
        resetDialogueTildes();
        originals.clear();document.querySelectorAll('.bl-line-dialogue').forEach(node=>node.classList.remove('bl-line-dialogue'));return;
    }
    typesetRoot(document);
    const chat=document.getElementById('chat');if(!chat)return;
    // 4.7.8: 답이 오는 동안(body[data-generating]) 그 메시지는 걸음마다 다시 그려지므로 조판해 봐야 다음 걸음에 사라진다 —
    // 생성 중에는 표시줄 뒤 빈 줄만 정리하고, 나머지 조판은 답이 끝나면 한 번에 처리한다.
    const flush=()=>{timer=0;if(document.body.dataset.generating==='true'){for(const root of dirty)if(root?.isConnected){normalizeTrackerSpacing(root);restoreDialogueTildes(root);}timer=setTimeout(flush,400);return;}for(const root of dirty)if(root?.isConnected)typesetRoot(root);dirty.clear();};
    observer=new MutationObserver(records=>{
        for(const record of records){
            const element=record.target.nodeType===1?record.target:record.target.parentElement;
            const mes=element?.closest('.mes');if(mes)dirty.add(mes);
            for(const node of record.addedNodes)if(node.nodeType===1)dirty.add(node.parentElement||node);
        }
        clearTimeout(timer);timer=setTimeout(flush,120);
    });
    observer.observe(chat,{childList:true,subtree:true,characterData:true});
}
document.addEventListener('chat-bookmarks:render',event=>typesetRoot(event.detail?.root));
