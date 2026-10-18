// Only bounded hashes and geometry leave memory. No message text is persisted.
export function readingHash(value) {
    let a=2166136261,b=2246822519;
    for(const char of String(value)){const n=char.codePointAt(0);a=Math.imul(a^n,16777619);b=Math.imul(b^n,3266489917);}
    return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export function readingChatKey(ctx, account='') {
    const id=ctx?.getCurrentChatId?.()??ctx?.chatId;
    const owner=ctx?.groupId!=null&&ctx.groupId!==''?['group',String(ctx.groupId)]:['character',ctx?.characters?.[ctx.characterId]?.avatar];
    if(!id||!owner[1]||!account)return null;
    return readingHash(JSON.stringify([account,owner,id,ctx.chatMetadata?.integrity||'']));
}
export const readingMessageHash=message=>readingHash(JSON.stringify([message?.mes,message?.send_date,message?.name,message?.is_user]));
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const textHash=node=>readingHash(node.textContent.replace(/\s+/g,' ').trim());
function blocksOf(body){
    const candidates=[...(body?.querySelectorAll('p,li,blockquote,h1,h2,h3,h4,h5,h6,pre')||[])].filter(n=>!n.closest('.llmt-progress'));
    const known=new Set(candidates),parents=new Set();
    for(const node of candidates)for(let p=node.parentElement;p&&p!==body;p=p.parentElement)if(known.has(p))parents.add(p);
    return candidates.filter(node=>!parents.has(node));
}
export function captureReadingAnchor(chat,ctx) {
    if(!chat?.clientHeight||!ctx?.chat?.length)return null;
    if(chat.scrollHeight-chat.clientHeight-chat.scrollTop<5){
        // Chat switching can clear the old DOM before changing the host context.
        // An empty/partial render is not evidence that the reader chose bottom.
        if(!chat.querySelector(`.mes[mesid="${ctx.chat.length-1}"]`))return null;
        return {version:1,bottom:true,at:Date.now()};
    }
    const rect=chat.getBoundingClientRect(),top=Math.max(0,rect.top+chat.clientTop),doc=chat.ownerDocument;
    let hit,y;
    for(const inset of[8,32,72]){y=top+inset;if(y>=Math.min(rect.bottom,doc.defaultView.innerHeight))break;hit=(doc.elementsFromPoint?.(rect.left+chat.clientWidth/2,y)||[]).find(n=>n.closest?.('#chat')===chat&&n.closest('.mes'));if(hit)break;}
    const mes=hit?.closest('.mes'),id=Number(mes?.getAttribute('mesid')),message=ctx.chat[id];
    if(!mes||!Number.isSafeInteger(id)||!message)return null;
    const body=mes.querySelector('.mes_text'),blocks=blocksOf(body),block=blocks.find(n=>{const r=n.getBoundingClientRect();return r.top<=y&&r.bottom>y;});
    const mr=mes.getBoundingClientRect(),br=block?.getBoundingClientRect();
    return {version:1,bottom:false,at:Date.now(),id,source:readingMessageHash(message),swipe:message.swipe_id??null,
        block:block?blocks.indexOf(block):-1,count:blocks.length,hash:block?textHash(block):null,
        fraction:br?.height?clamp((y-br.top)/br.height):0,messageFraction:mr.height?clamp((y-mr.top)/mr.height):0,inset:y-top};
}
export function readingAnchorTarget(chat,ctx,entry) {
    if(entry?.bottom)return {top:Math.max(0,chat.scrollHeight-chat.clientHeight),bottom:true};
    const message=ctx?.chat?.[entry?.id];
    if(!message||readingMessageHash(message)!==entry.source||(message.swipe_id??null)!==entry.swipe)return {missing:'changed'};
    const mes=chat.querySelector(`.mes[mesid="${entry.id}"]`);
    if(!mes)return {missing:'unloaded'};
    const body=mes.querySelector('.mes_text'),blocks=blocksOf(body),matches=entry.hash?blocks.filter(n=>textHash(n)===entry.hash):[];
    const next=matches.length===1?matches[0]:blocks.length===entry.count&&entry.block>=0?blocks[entry.block]:null;
    const rect=(next||mes).getBoundingClientRect(),top=Math.max(0,chat.getBoundingClientRect().top+chat.clientTop);
    const wanted=chat.scrollTop+rect.top-top+(next?entry.fraction:entry.messageFraction)*rect.height-entry.inset;
    return {top:Math.max(0,Math.min(wanted,chat.scrollHeight-chat.clientHeight)),message:mes};
}
export function normalizeReadingEntries(raw) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
    const out={};
    for(const [key,r]of Object.entries(raw).filter(([key,r])=>/^[a-f\d]{16}$/.test(key)&&r?.version===1&&Number.isFinite(r.at)).sort((a,b)=>b[1].at-a[1].at).slice(0,30)){
        if(r.bottom===true){out[key]={version:1,bottom:true,at:r.at};continue;}
        if(!Number.isSafeInteger(r.id)||r.id<0||!/^[a-f\d]{16}$/.test(r.source)||!Number.isInteger(r.block)||!Number.isInteger(r.count)||r.count<0||r.count>10000||r.block< -1||r.block>=r.count||!(r.hash===null||/^[a-f\d]{16}$/.test(r.hash)))continue;
        out[key]={version:1,bottom:false,at:r.at,id:r.id,source:r.source,swipe:Number.isSafeInteger(r.swipe)?r.swipe:null,block:r.block,count:r.count,hash:r.hash,fraction:clamp(r.fraction),messageFraction:clamp(r.messageFraction),inset:Math.max(0,Math.min(100,Number(r.inset)||0))};
    }
    return out;
}
