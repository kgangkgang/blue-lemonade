// Small deterministic regression contracts; real browser results are recorded separately.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = fs.readFileSync(path.resolve(process.argv[2] || '.', 'src/stream-follow.js'),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replace('export function startStreamFollow','function startStreamFollow');
const results=[];
function fixture() {
    let now=0, writes=0, nativeLock=false, top=900, chatId='one';
    const listeners=new Map();
    const target=name=>({addEventListener(type,fn){ const k=name+':'+type; if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn); }});
    const emit=(name,type,event={})=>{for(const fn of listeners.get(name+':'+type)||[])fn(event);};
    const chat={...target('chat'),scrollHeight:1000,clientHeight:100,
        get scrollTop(){return top;},set scrollTop(value){writes++;top=Math.min(value,this.scrollHeight-this.clientHeight);}};
    const power={auto_scroll_chat_to_bottom:true,waifuMode:false},settings={enabled:true,usageMode:'both'};
    const bus=new Map();
    const context={characterId:1,groupId:null,getCurrentChatId:()=>chatId,powerUserSettings:power,
        eventTypes:Object.fromEntries(['GENERATION_STARTED','STREAM_TOKEN_RECEIVED','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED'].map(x=>[x,x])),
        eventSource:{on(n,fn){bus.set(n,fn);}}};
    vm.runInNewContext(source+'\nstartStreamFollow();',{document:{...target('document'),getElementById:()=>chat},window:target('window'),
        SillyTavern:{getContext:()=>context},getSettings:()=>settings,themeEnabled:s=>s.enabled!==false&&s.usageMode!=='extensions',performance:{now:()=>now}});
    const event=(type,...args)=>bus.get(type)?.(...args);
    const scroll=()=>{emit('document','scroll',{target:chat});nativeLock=Math.abs(chat.scrollHeight-chat.clientHeight-chat.scrollTop)>=5;};
    event('GENERATION_STARTED','normal',{},false);event('STREAM_TOKEN_RECEIVED','first');
    return {chat,power,settings,event,emit,scroll,grow(){chat.scrollHeight+=200;},setTop(v){top=v;},setChat(v){chatId=v;},time(v){now=v;},
        state:()=>({top,gap:chat.scrollHeight-chat.clientHeight-top,writes,nativeLock})};
}
function check(name,prepare,expectRepair=false){const f=fixture();prepare?.(f);f.grow();f.scroll();const s=f.state();
    assert.equal(s.writes,expectRepair?1:0,name);if(expectRepair){assert.equal(s.gap,0,name);assert.equal(s.nativeLock,false,name);}
    results.push({name,pass:true,...s});}
check('delayed content growth stays at bottom',null,true);
check('manual upward move',f=>f.setTop(500));
check('bookmark upward move',f=>f.setTop(100));
check('wheel gesture',f=>f.emit('chat','wheel'));
check('touch gesture',f=>f.emit('chat','touchstart'));
check('touch inertia',f=>{f.emit('chat','touchstart');f.emit('window','touchend');f.time(900);});
check('mouse scrollbar held',f=>{f.emit('chat','pointerdown');f.time(10000);});
check('keyboard reading',f=>f.emit('document','keydown',{key:'PageUp',target:{closest:()=>false}}));
check('automatic scrolling disabled',f=>f.power.auto_scroll_chat_to_bottom=false);
check('waifu mode',f=>f.power.waifuMode=true);
check('theme disabled',f=>f.settings.enabled=false);
check('extensions-only mode',f=>f.settings.usageMode='extensions');
check('viewport resize',f=>f.chat.clientHeight=200);
check('chat identity changed before event',f=>f.setChat('two'));
check('stale token after chat switch',f=>{f.event('CHAT_CHANGED');f.event('STREAM_TOKEN_RECEIVED','late');});
check('stale token after stop',f=>{f.event('GENERATION_STOPPED');f.event('STREAM_TOKEN_RECEIVED','late');});
check('stale token after end',f=>{f.event('GENERATION_ENDED');f.event('STREAM_TOKEN_RECEIVED','late');});
check('non-streaming generation',f=>f.event('GENERATION_STARTED','normal',{},false));
check('dry-run does not disrupt live stream',f=>f.event('GENERATION_STARTED','normal',{},true),true);
check('quiet generation does not disrupt live stream',f=>f.event('GENERATION_STARTED','quiet',{},false),true);
check('reading remains unpinned after gesture timeout',f=>{f.emit('chat','touchstart');f.setTop(500);f.scroll();f.emit('window','touchend');f.time(3000);});
check('following resumes after returning to bottom',f=>{f.setTop(500);f.scroll();f.setTop(900);f.scroll();},true);
console.log(`${results.length}/${results.length} contracts passed`);
