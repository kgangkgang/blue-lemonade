import { captureReadingAnchor, readingAnchorTarget, readingChatKey, normalizeReadingEntries } from './reading-resume-anchor.js';
const STORAGE_KEY='bl-reading-positions-v1';
let running=null;

/** Browser-local view state only: no chat/settings writes or model requests. */
export function installReadingResume({getContext,getAccount,isEnabled=()=>true,doc=document,win=window,storage=localStorage}) {
    const chat=doc.getElementById('chat'),ctx=getContext(),types=ctx?.eventTypes||ctx?.event_types;
    if(!chat||!types||!ctx.eventSource)return null;
    let entries={};try{entries=normalizeReadingEntries(JSON.parse(storage.getItem(STORAGE_KEY)||'{}'));}catch{/* unavailable browser storage */}
    let key=null,pending=null,captureTimer=null,staged=null,generating=false,userScroll=false,disposed=false,lastFirst=null;
    const subscriptions=[],notified=new Set();
    const currentKey=()=>readingChatKey(getContext(),getAccount());
    const busy=()=>generating||getContext()?.streamingProcessor?.isFinished===false;
    const save=(entry,savedKey=key)=>{if(!savedKey||!entry)return;try{entries={...entries,...normalizeReadingEntries(JSON.parse(storage.getItem(STORAGE_KEY)||'{}'))};}catch{/* unavailable storage */}if((entries[savedKey]?.at||0)<=entry.at)entries[savedKey]=entry;entries=normalizeReadingEntries(entries);try{storage.setItem(STORAGE_KEY,JSON.stringify(entries));}catch{/* storage full/blocked */}};
    function flush(){clearTimeout(captureTimer);captureTimer=null;if(staged){save(staged.entry,staged.key);staged=null;}}
    function stop(){if(!pending)return;clearTimeout(pending.timer);pending.observer?.disconnect();pending=null;}
    function remember(){flush();if(disposed||pending||!isEnabled()||busy()||currentKey()!==key||getContext().chat?.[0]!==lastFirst)return;save(captureReadingAnchor(chat,getContext()));}
    function scroll(){if(!userScroll||pending||busy()||!isEnabled()||currentKey()!==key||getContext().chat?.[0]!==lastFirst)return;const entry=captureReadingAnchor(chat,getContext());if(!entry)return;staged={key,entry};clearTimeout(captureTimer);captureTimer=setTimeout(flush,180);}
    function gesture(event){
        if(event.type==='keydown'&&(!/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(event.key)||event.target?.closest?.('input,textarea,select,[contenteditable]')))return;
        if(event.type==='pointermove'&&!event.buttons)return;
        if(!event.target?.closest?.('#chat')&&event.type!=='keydown')return;
        stop();userScroll=true;
    }
    function attempt(job){
        if(pending!==job)return;
        const now=getContext();
        // Some hosts announce a chat before attaching its initial message DOM.
        // Wait within the same bounded window; never fetch additional history.
        if(job.length===0&&now.chat.length){job.length=now.chat.length;lastFirst=now.chat[0];}
        if(!isEnabled()||currentKey()!==job.key||busy()||now.chat.length!==job.length||!chat.isConnected){stop();return;}
        if(!now.chat.length&&Date.now()<job.until){job.timer=setTimeout(()=>attempt(job),200);return;}
        const target=readingAnchorTarget(chat,now,job.entry);
        if(target.missing){
            if(target.missing==='unloaded'&&Date.now()<job.until){clearTimeout(job.timer);job.timer=setTimeout(()=>attempt(job),200);return;}
            // 7.2.1 복귀하지 못해도 알림은 띄우지 않는다 (사용자 요청) — 콘솔 기록만
            if(target.missing==='unloaded'&&!notified.has(job.key)){notified.add(job.key);console.debug('[Blue Lemonade] 읽던 메시지가 아직 불러와지지 않아 위치를 옮기지 않았어요.');}
            stop();return;
        }
        if(Math.abs(chat.scrollTop-target.top)>1)chat.scrollTop=target.top;
        if(target.message&&!job.observed){job.observed=true;job.observer?.observe(target.message);}
        clearTimeout(job.timer);
        if(Date.now()>=job.until){stop();return;}
        job.timer=setTimeout(()=>attempt(job),200);
    }
    function enter(){
        flush();stop();userScroll=false;key=currentKey();lastFirst=getContext().chat?.[0];
        try{entries=normalizeReadingEntries(JSON.parse(storage.getItem(STORAGE_KEY)||'{}'));}catch{/* keep in-memory state */}
        if(!key||!isEnabled()||busy())return;
        const entry=entries[key];
        // The host already follows the bottom. Never add a second auto-follow
        // mechanism, especially when the user's host setting disables it.
        if(!entry||entry.bottom)return;
        const job={key,entry,length:getContext().chat.length,until:Date.now()+2200,timer:null,observer:null,observed:false};pending=job;
        if(win.ResizeObserver)job.observer=new win.ResizeObserver(()=>{if(pending===job)attempt(job);});
        job.timer=setTimeout(()=>attempt(job),200);
    }
    const on=(name,fn)=>{if(types[name]){ctx.eventSource.on(types[name],fn);subscriptions.push([types[name],fn]);}};
    on('CHAT_CHANGED',()=>{if(currentKey()===key&&getContext().chat?.[0]===lastFirst&&(pending||userScroll))return;generating=false;enter();});
    on('GENERATION_STARTED',(type,options,dryRun)=>{if(dryRun||type==='quiet')return;remember();generating=true;stop();userScroll=false;});
    for(const name of ['GENERATION_ENDED','GENERATION_STOPPED'])on(name,()=>{generating=false;});
    for(const name of ['MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_SWIPED','MESSAGE_DELETED'])on(name,()=>{stop();userScroll=false;});
    const events=['wheel','touchstart','touchmove','pointerdown','pointermove','keydown'];
    for(const name of events)doc.addEventListener(name,gesture,{capture:true,passive:true});
    chat.addEventListener('scroll',scroll,{passive:true});
    const leave=()=>{if(userScroll)remember();};
    const visibility=()=>{if(doc.visibilityState==='hidden')leave();};
    win.addEventListener('pagehide',leave);doc.addEventListener('visibilitychange',visibility);
    enter();
    return {status:()=>({key,pending:!!pending,generating,entries:Object.keys(entries).length}),dispose(){disposed=true;stop();clearTimeout(captureTimer);for(const [name,fn]of subscriptions)ctx.eventSource.removeListener?.(name,fn);for(const name of events)doc.removeEventListener(name,gesture,true);chat.removeEventListener('scroll',scroll);win.removeEventListener('pagehide',leave);doc.removeEventListener('visibilitychange',visibility);}};
}

export async function startReadingResume({isEnabled=()=>true}={}) {
    if(running)return running;
    try{
        const {getCurrentUserHandle}=await import('../../../../user.js');
        if(typeof getCurrentUserHandle!=='function')return null;
        running=installReadingResume({getContext:()=>globalThis.SillyTavern.getContext(),getAccount:getCurrentUserHandle,isEnabled});
    }catch(error){console.warn('[Blue Lemonade] 읽던 위치 복귀를 시작하지 못했어요.',error);}
    return running;
}
