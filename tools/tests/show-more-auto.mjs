// 6.9.8 「이전 메시지 더 보기」 저절로 (src/show-more-auto.js) · 새 답 첫 줄로 ↑ (src/reply-top.js) · 캡처 공유 (src/capture-share.js)
// 작은 DOM 흉내: 단추가 다 보이면 한 번 누르고 쉬었다 다시 본다 · 끄면 관찰자를 뗀다 · ↑ 는 첫 줄이 지나갔고 바닥 근처였을 때만 · 공유는 터치 · 보안 · canShare 일 때만
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
let n=0;const t=(name,fn)=>{fn();n++};

// ---- DOM 흉내
const observers=[];
class FakeIO{constructor(cb,opts){this.cb=cb;this.opts=opts;this.targets=new Set();observers.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();this.dead=true;}fire(el,ratio){this.cb([{target:el,isIntersecting:ratio>0,intersectionRatio:ratio}]);}}
globalThis.IntersectionObserver=FakeIO;
globalThis.requestAnimationFrame=()=>0;  // 숨은 탭처럼 안 돈다 — 타이머가 대신
const els={};
globalThis.document=Object.assign(new EventTarget(),{getElementById:id=>els[id]||null,body:{append(){}},createElement(){const b={hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this['on'+k]=fn},remove(){this.removed=true},isConnected:true};return b;}});
const listeners={};
globalThis.SillyTavern={getContext:()=>({eventSource:{on:(name,fn)=>{(listeners[name]??=[]).push(fn)},removeListener:(name,fn)=>{listeners[name]=(listeners[name]||[]).filter(f=>f!==fn)}},event_types:{CHAT_CHANGED:'cc',MORE_MESSAGES_LOADED:'mm',GENERATION_STARTED:'gs',GENERATION_ENDED:'ge',MESSAGE_SWIPED:'sw',MESSAGE_DELETED:'md',MESSAGE_EDITED:'me',MESSAGE_UPDATED:'mu'}})};
const emit=(name,...args)=>{for(const fn of listeners[name]||[])fn(...args)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const sm=await import(pathToFileURL(path.join(root,'src/show-more-auto.js')));
let clicks=0;
const button=()=>({id:'show_more_messages',click(){clicks++;}});
els.chat={};
sm.syncShowMoreAuto(true);
await sleep(300);
t('with no button nothing is watched',()=>{assert.equal(sm._forTest.state().watched,null);});
els.show_more_messages=button();
emit('cc');await sleep(300);
t('the button appears on chat change → watched by one observer on #chat, 3 screens ahead (7.6.3: rootMargin 300% top, threshold 0)',()=>{
  const io=observers.at(-1);assert.equal(io.opts.threshold,0);assert.equal(io.opts.rootMargin,sm.ROOT_MARGIN);assert.equal(sm.ROOT_MARGIN,'300% 0px 0px 0px');assert.equal(io.opts.root,els.chat);assert.ok(io.targets.has(els.show_more_messages));
});
t('entering the prefetch zone → one click, then rest; a second report during the rest is ignored; a non-intersecting report never counts',()=>{
  const io=observers.at(-1);io.fire(els.show_more_messages,0.01);assert.equal(clicks,1);
  io.fire(els.show_more_messages,1);assert.equal(clicks,1,'resting');
  io.fire(els.show_more_messages,0);assert.equal(clicks,1,'not intersecting never counts');
});
await sleep(200);
t('after the rest the button is re-observed (initial report comes back) and may fire again',()=>{
  const io=observers.at(-1);assert.ok(io.targets.has(els.show_more_messages));io.fire(els.show_more_messages,1);assert.equal(clicks,2);
});
await sleep(200);
t('when the button is gone (all loaded) the watch is dropped',()=>{delete els.show_more_messages;emit('mm');});
await sleep(300);
t('… and nothing is observed',()=>{assert.equal(sm._forTest.state().watched,null);});
t('turning it off disconnects and unbinds',()=>{sm.syncShowMoreAuto(false);assert.ok(observers.at(-1).dead);assert.equal((listeners.cc||[]).length,0);});
// ---- 7.6.3 보던 자리 지키기 (loadKeepingPlace): 실리태번 showMoreMessages() 는 클릭 안에서 동기로 끼워 넣고, 단추가 창 안이면 scrollTop 을 들어온 높이로 놓는다
const fakeChat=(top,height,client=668)=>({scrollTop:top,scrollHeight:height,clientHeight:client});
t('button on screen (ST sets scrollTop = inserted height) → corrected to the original place + inserted',()=>{
  const c=fakeChat(40,10217);const b={click(){c.scrollHeight=15819;c.scrollTop=5602;}};
  assert.deepEqual(sm.loadKeepingPlace(b,c),{inserted:5602,fixed:true});assert.equal(c.scrollTop,5642);
});
t('button off screen and the browser anchored already (scrollTop moved by the inserted height) → untouched',()=>{
  const c=fakeChat(600,10217);const b={click(){c.scrollHeight=12170;c.scrollTop=2553;}};
  assert.deepEqual(sm.loadKeepingPlace(b,c),{inserted:1953,fixed:false});assert.equal(c.scrollTop,2553);
});
t('button just above the screen, nobody compensated (scrollTop unchanged) → moved by the inserted height',()=>{
  const c=fakeChat(60,10217);const b={click(){c.scrollHeight=12170;}};
  assert.deepEqual(sm.loadKeepingPlace(b,c),{inserted:1953,fixed:true});assert.equal(c.scrollTop,2013);
});
t('nothing inserted (no messages left) or no chat element → click only',()=>{
  const c=fakeChat(100,5000);const b={n:0,click(){this.n++;}};
  assert.deepEqual(sm.loadKeepingPlace(b,c),{inserted:0,fixed:false});assert.equal(c.scrollTop,100);
  assert.deepEqual(sm.loadKeepingPlace(b,null),{inserted:0,fixed:false});assert.equal(b.n,2);
});
t('the wanted place never exceeds the scroll range',()=>{
  const c=fakeChat(300,900,668);const b={click(){c.scrollHeight=1000;}};
  sm.loadKeepingPlace(b,c);assert.equal(c.scrollTop,332);
});

// ---- ↑ 새 답 첫 줄로
const rt=await import(pathToFileURL(path.join(root,'src/reply-top.js')));
const rect=(top,bottom)=>({top,bottom,height:bottom-top});
let chatTop=100,chatBottom=800,headTop=50,scrolled=null;
const head={getBoundingClientRect:()=>rect(headTop,headTop+24)};
const mes={isConnected:true,classList:{contains:()=>true},getAttribute:()=>'7',querySelector:sel=>sel==='.ch_name'?head:null,scrollIntoView(o){scrolled=o;}};
els.chat={scrollHeight:5000,scrollTop:4300,clientHeight:700,getBoundingClientRect:()=>rect(chatTop,chatBottom),querySelector:()=>mes,querySelectorAll:()=>[mes]};
els.sheld={append(b){this.btn=b;}};
rt.syncReplyTop(true);
t('answer ends with its first line above the chat top and the user near the bottom → button shows and watches the first line',()=>{
  emit('gs','normal',{},false);emit('ge');
});
await sleep(450);
t('… shown',()=>{assert.equal(rt._forTest.state().shown,true);assert.equal(els.sheld.btn.attrs['aria-label'],'새 답 첫 줄로');assert.ok(observers.at(-1).targets.has(head));});
t('click → scrolls the message into view at the start and hides',()=>{els.sheld.btn.onclick();assert.equal(scrolled.block,'start');assert.equal(rt._forTest.state().shown,false);});
t('first line visible at the end → nothing',()=>{headTop=120;emit('gs','normal',{},false);emit('ge');});
await sleep(450);
t('… not shown',()=>{assert.equal(rt._forTest.state().shown,false);});
t('reader was away from the bottom when the answer started → nothing even if the first line passed',()=>{headTop=50;els.chat.scrollTop=1000;emit('gs','normal',{},false);emit('ge');});
await sleep(450);
t('… not shown',()=>{assert.equal(rt._forTest.state().shown,false);els.chat.scrollTop=4300;});
t('translator rendered event for the last message behaves like the end signal; another id is ignored',()=>{
  emit('gs','normal',{},false);document.dispatchEvent(Object.assign(new Event('llm-translator:rendered'),{detail:{messageId:3}}));
});
await sleep(450);
t('… ignored id → not shown',()=>{assert.equal(rt._forTest.state().shown,false);document.dispatchEvent(Object.assign(new Event('llm-translator:rendered'),{detail:{messageId:7}}));});
await sleep(450);
t('… matching id → shown; the first line coming into view hides it; swipe/chat change hide too',()=>{
  assert.equal(rt._forTest.state().shown,true);observers.at(-1).fire(head,1);assert.equal(rt._forTest.state().shown,false);
  rt._forTest.setNear(true);rt._forTest.check();assert.equal(rt._forTest.state().shown,true);emit('sw');assert.equal(rt._forTest.state().shown,false);
  rt._forTest.check();emit('cc');assert.equal(rt._forTest.state().shown,false);
});
t('deleting · editing · updating a message hides the arrow; a click on a removed target scrolls nowhere',()=>{
  for(const ev of ['md','me','mu']){rt._forTest.setNear(true);rt._forTest.check();assert.equal(rt._forTest.state().shown,true);emit(ev);assert.equal(rt._forTest.state().shown,false,ev);}
  rt._forTest.check();scrolled=null;mes.isConnected=false;els.sheld.btn.onclick();assert.equal(scrolled,null,'no scroll to a detached message');assert.equal(rt._forTest.state().shown,false);
  assert.equal(rt._forTest.check(),false,'check on a detached last message hides');mes.isConnected=true;
});
t('off removes the button and listeners',()=>{rt.syncReplyTop(false);assert.ok(els.sheld.btn.removed);assert.equal((listeners.ge||[]).length,0);});

// ---- 캡처 공유
const cs=await import(pathToFileURL(path.join(root,'src/capture-share.js')));
const file={name:'a.png'};
t('share icon only on touch · secure · canShare(files) true',()=>{
  const ok={secure:true,touch:true,canShare:()=>true,share:async()=>{}};
  assert.equal(cs.canShareFile(file,ok),true);
  assert.equal(cs.canShareFile(file,{...ok,touch:false}),false,'PC: no');
  assert.equal(cs.canShareFile(file,{...ok,secure:false}),false,'http phone: no');
  assert.equal(cs.canShareFile(file,{...ok,canShare:()=>false}),false,'browser refuses this file: no');
  assert.equal(cs.canShareFile(file,{...ok,canShare:undefined}),false);
  assert.equal(cs.canShareFile(file,{...ok,canShare:()=>{throw new Error('x')}}),false,'a throwing canShare is just no');
  assert.equal(cs.canShareFile(null,ok),false);
});
t('shareOrSave: shared · cancelled (AbortError, no fallback) · refused → fallback save',async()=>{});
{
  const calls=[];const env=(fn)=>({share:fn});
  assert.equal(await cs.shareOrSave(file,{env:env(async()=>{calls.push('share')}),fallback:()=>calls.push('save')}),'shared');
  assert.equal(await cs.shareOrSave(file,{env:env(async()=>{throw Object.assign(new Error('x'),{name:'AbortError'})}),fallback:()=>calls.push('save')}),'cancelled');
  assert.equal(await cs.shareOrSave(file,{env:env(async()=>{throw new Error('NotAllowed')}),fallback:()=>calls.push('save')}),'saved');
  assert.deepEqual(calls,['share','save']);
  assert.equal(await cs.shareOrSave(null,{env:env(async()=>{})}),'none');
  n++;
}
t('fileOf wraps a blob as a File with the blob type',()=>{
  const f=cs.fileOf(new Blob(['x'],{type:'image/png'}),'blue-lemonade-chat.png');assert.equal(f.name,'blue-lemonade-chat.png');assert.equal(f.type,'image/png');assert.equal(cs.fileOf(null,'a'),null);
});

console.log(`PASS show-more-auto · reply-top · capture-share: ${n} checks`);
