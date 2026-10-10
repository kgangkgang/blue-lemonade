// Small deterministic regression contracts; real browser results are recorded separately.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = fs.readFileSync(path.resolve(process.argv[2] || '.', 'src/stream-follow.js'),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replace('export function startStreamFollow','function startStreamFollow');
const results=[];
// 5.8.4: async = 'frame' 이면 requestAnimationFrame · requestIdleCallback 을 큐로 준다 (stream-follow.js 의 nextFrame · whenIdle 이 미루는 길).
//        'timeout' 이면 requestIdleCallback 없이 setTimeout 큐만 (한가할 때 읽기의 대체 길). 없으면(기본) 예전처럼 바로 부르는 길.
//        start=false 면 처음의 GENERATION_STARTED · 첫 조각을 보내지 않는다 (계약마다 순서를 직접 짠다).
function fixture({async=null,start=true}={}) {
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
    const frames=[], idles=[], timeouts=[], idleOptions=[];
    const globals={document:{...target('document'),getElementById:()=>chat},window:target('window'),
        SillyTavern:{getContext:()=>context},getSettings:()=>settings,themeEnabled:s=>s.enabled!==false&&s.usageMode!=='extensions',performance:{now:()=>now}};
    if(async==='frame')Object.assign(globals,{requestAnimationFrame:fn=>frames.push(fn),requestIdleCallback:(fn,options)=>{idleOptions.push(options);return idles.push(fn);}});
    if(async==='timeout')Object.assign(globals,{requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>{idleOptions.push(ms);return timeouts.push(fn);}});
    vm.runInNewContext(source+'\nstartStreamFollow();',globals);
    const event=(type,...args)=>bus.get(type)?.(...args);
    const scroll=()=>{emit('document','scroll',{target:chat});nativeLock=Math.abs(chat.scrollHeight-chat.clientHeight-chat.scrollTop)>=5;};
    const drain=queue=>{for(const fn of queue.splice(0))fn();};
    if(start){event('GENERATION_STARTED','normal',{},false);event('STREAM_TOKEN_RECEIVED','first');}
    return {chat,power,settings,event,emit,scroll,grow(){chat.scrollHeight+=200;},setTop(v){top=v;},setChat(v){chatId=v;},time(v){now=v;},
        frame:()=>drain(frames),idle:()=>{drain(idles);drain(timeouts);},pending:()=>({frames:frames.length,idles:idles.length+timeouts.length}),idleOptions,
        state:()=>({top,gap:chat.scrollHeight-chat.clientHeight-top,writes,nativeLock})};
}
const verify=(name,s,expectRepair)=>{assert.equal(s.writes,expectRepair?1:0,name);if(expectRepair){assert.equal(s.gap,0,name);assert.equal(s.nativeLock,false,name);}};
// 기존 계약: 바로 부르는 길 그대로, 그리고 미루는 길(프레임 · 한가할 때 읽기를 그 자리에서 다 돌린 뒤)에서도 같은 답
function check(name,prepare,expectRepair=false){
    const f=fixture();prepare?.(f);f.grow();f.scroll();const s=f.state();
    verify(name,s,expectRepair);results.push({name,pass:true,...s});
    const d=fixture({async:'frame'});d.idle();d.frame();prepare?.(d);d.frame();d.grow();d.scroll();
    verify(name+' (deferred reads settled)',d.state(),expectRepair);results.push({name:name+' (deferred reads settled)',pass:true,...d.state()});
}
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

// 5.8.4 미루는 길만의 계약 (stream-follow.js: 보내기 직후 읽기는 다음 프레임, 처음 값은 한가할 때)
function deferred(name,run,expectRepair,mode='frame'){const f=fixture({async:mode,start:false});run(f);verify(name,f.state(),expectRepair);results.push({name,pass:true,...f.state()});}
const send=f=>{f.event('GENERATION_STARTED','normal',{},false);f.event('STREAM_TOKEN_RECEIVED','first');};
deferred('idle seed pins before the first frame after sending',f=>{
    assert.equal(f.pending().idles,1);f.idle();
    send(f);assert.equal(f.pending().frames,1,'GENERATION_STARTED reads in the next frame, not inline');
    f.grow();f.scroll();               // 프레임이 오기 전의 늦은 scroll
},true);
deferred('unseeded and no frame yet: no repair',f=>{send(f);f.grow();f.scroll();},false);
deferred('frame read after GENERATION_STARTED re-pins at the bottom',f=>{
    f.setTop(500);f.idle();            // 처음 값: 위를 읽는 중
    f.setTop(900);send(f);f.frame();   // 보낸 뒤 맨 아래로 (scroll 이벤트가 오기 전) → 프레임에서 다시 읽음
    f.grow();f.scroll();
},true);
deferred('late idle seed does not overwrite a newer scroll reading',f=>{
    f.setTop(500);f.scroll();          // scroll 이 먼저 읽음 (위를 읽는 중)
    f.setTop(900);f.idle();            // 한가할 때 읽기는 건너뛴다 — 다시 읽었다면 맨 아래로 고정됐을 것
    send(f);f.grow();f.scroll();
},false);
deferred('dry-run and quiet generations queue no frame read',f=>{
    f.idle();f.event('GENERATION_STARTED','normal',{},true);f.event('GENERATION_STARTED','quiet',{},false);f.event('GENERATION_STARTED','impersonate',{},false);
    assert.equal(f.pending().frames,0);
},false);
deferred('idle seed waits at most 3 s (requestIdleCallback timeout)',f=>{assert.deepEqual({...f.idleOptions[0]},{timeout:3000});f.idle();send(f);f.grow();f.scroll();},true);
deferred('without requestIdleCallback the seed falls back to a 1 s timer',f=>{assert.equal(f.idleOptions[0],1000);assert.equal(f.pending().idles,1);f.idle();send(f);f.grow();f.scroll();},true,'timeout');
console.log(`${results.length}/${results.length} contracts passed`);
