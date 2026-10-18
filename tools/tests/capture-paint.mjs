// Capture traversal invariants; synthetic nodes, no user data or timers left alive.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const sourceFile=process.argv[2]||path.resolve('src/chat-capture.js');
const code=fs.readFileSync(sourceFile,'utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function captureMessages','async function captureMessages');
const node=(name,kids=[],tag='DIV',classes=[])=>{
    const el={name,tagName:tag,style:{},children:kids,parentNode:null,isConnected:true,classes,
        matches(selectors){return selectors.split(',').some(s=>s[0]==='.'?this.classes.includes(s.slice(1)):s.toUpperCase()===this.tagName);},
        closest(s){return s==='.mes_text'?this:null;},removeAttribute(){},getBoundingClientRect(){return {width:375};}};
    for(const child of kids)child.parentNode=el;
    return el;
};
const clone=el=>node(el.name,el.children.map(clone),el.tagName,el.classes);
const harness=()=>{
    let tick=0,onYield=()=>{},removed=0,appended=0;
    const timers=new Set(),painted=[];
    const resources={paint(s,c){painted.push([s.name,c.name]);return s.background||'none';},embed:async url=>'data:'+url,close(){}};
    const ctx=vm.createContext({DOMException,AbortController,URL,location:{href:'https://example.invalid/'},performance:{now:()=>tick+=10},
        setTimeout(fn,ms){const id={};timers.add(id);if(ms===0)queueMicrotask(()=>{timers.delete(id);onYield();fn();});return id;},clearTimeout:id=>timers.delete(id),
        document:{fonts:{ready:Promise.resolve()},documentElement:{},body:{append(){appended++;}},createElement:()=>({style:{},remove(){removed++;}}),createDocumentFragment:()=>({append(){}})},
        getComputedStyle:()=>({getPropertyValue:()=> '#fff'}),
    });
    vm.runInContext(code+'\n globalThis.capture={copyPaint,captureMessages};',ctx);
    return {ctx,resources,painted,timers,run:(s,c,signal,opts={},skip)=>ctx.capture.copyPaint(s,c,resources,signal,opts,skip),yield(fn){onYield=fn;},get removed(){return removed;},get appended(){return appended;}};
};
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
await test('source and clone keep the same depth-first pairs',async()=>{const h=harness(),s=node('root',[node('a',[node('a1')]),node('b')]);await h.run(s,clone(s),new AbortController().signal);assert.deepEqual(h.painted,[['root','root'],['a','a'],['a1','a1'],['b','b']]);});
await test('private controls and all descendants are skipped',async()=>{const h=harness(),s=node('root',[node('buttons',[node('secret')],'DIV',['mes_buttons']),node('text')]);await h.run(s,clone(s),new AbortController().signal);assert.deepEqual(h.painted.map(x=>x[0]),['root','text']);});
await test('hidden images, avatars, and names skip their children',async()=>{const h=harness(),s=node('root',[node('img',[node('imgchild')],'SVG'),node('avatar',[node('avatarChild')],'DIV',['avatar']),node('name',[],'DIV',['name_text']),node('text')]);await h.run(s,clone(s),new AbortController().signal,{showAssets:false,showAvatar:false,showName:false});assert.deepEqual(h.painted.map(x=>x[0]),['root','text']);});
await test('style-less metadata subtree is ignored',async()=>{const h=harness(),meta=node('meta',[node('inner')]),s=node('root',[meta,node('text')]);delete meta.style;await h.run(s,clone(s),new AbortController().signal);assert.deepEqual(h.painted.map(x=>x[0]),['root','text']);});
await test('cancel is observed after a time-slice yield',async()=>{const h=harness(),ctl=new AbortController(),s=node('root',[node('a'),node('b')]);h.yield(()=>ctl.abort());await assert.rejects(h.run(s,clone(s),ctl.signal),{name:'AbortError'});assert.equal(h.painted.length,1);assert.equal(h.timers.size,0);});
await test('inserting a live sibling cannot shift frozen clone pairs',async()=>{const h=harness(),s=node('root',[node('a'),node('b')]);let once=false;h.yield(()=>{if(!once){once=true;const added=node('new');added.parentNode=s;s.children.unshift(added);}});await h.run(s,clone(s),new AbortController().signal);assert.deepEqual(h.painted,[['root','root'],['a','a'],['b','b']]);});
await test('removing an unpainted live node rejects the export',async()=>{const h=harness(),s=node('root',[node('a')]);h.yield(()=>{s.children[0].parentNode=null;s.children[0].isConnected=false;});await assert.rejects(h.run(s,clone(s),new AbortController().signal),/메시지가 바뀌/);});
await test('multiple images start before either network result resolves',async()=>{const h=harness(),a=node('a',[],'IMG'),b=node('b',[],'IMG'),s=node('root',[a,b]);a.src='/a';b.src='/b';const started=[],releases=[];h.resources.embed=url=>{started.push(url);return new Promise(resolve=>releases.push(()=>resolve('data:'+url)));};const task=h.run(s,clone(s),new AbortController().signal);for(let i=0;i<20;i++)await Promise.resolve();assert.deepEqual(started,['/a','/b']);releases.forEach(fn=>fn());await task;});
await test('failed image leaves a placeholder while abort stays fatal',async()=>{const h=harness(),s=node('root',[node('a',[],'IMG')]),c=clone(s);s.children[0].src='/bad';h.resources.embed=async()=>{throw Error('unavailable');};let skips=0;await h.run(s,c,new AbortController().signal,{},()=>skips++);assert.equal(skips,1);assert.match(c.children[0].src,/^data:image\/gif/);h.resources.embed=async()=>{throw new DOMException('aborted','AbortError');};await assert.rejects(h.run(s,clone(s),new AbortController().signal),{name:'AbortError'});});
await test('capture cancellation removes the off-screen stage and all timers',async()=>{const h=harness(),s=node('root',[node('a')]),ctl=new AbortController();s.cloneNode=()=>clone(s);h.ctx.document.querySelector=()=>s;h.yield(()=>ctl.abort());await assert.rejects(h.ctx.capture.captureMessages([0],()=>{},{resources:h.resources},ctl.signal),{name:'AbortError'});assert.equal(h.appended,1);assert.equal(h.removed,1);assert.equal(h.timers.size,0);});
await test('native scheduler takes precedence and cancellation is observed after yielding',async()=>{
    for(const cancel of [false,true]){
        const h=harness(),ctl=new AbortController(),s=node('root',[node('a')]);let calls=0;
        h.ctx.scheduler={yield:async()=>{calls++;if(cancel)ctl.abort();}};
        h.ctx.MessageChannel=class {constructor(){assert.fail('scheduler should take precedence');}};
        const task=h.run(s,clone(s),ctl.signal);
        if(cancel)await assert.rejects(task,{name:'AbortError'});else await task;
        assert.equal(calls,1);assert.equal(h.painted.length,cancel?1:2);assert.equal(h.timers.size,0);
    }
});
await test('message-task fallback closes both ports on completion and cancellation',async()=>{
    for(const cancel of [false,true]){
        const h=harness(),ctl=new AbortController(),s=node('root',[node('a')]),closed=[],listeners=new Set();let sent=0;
        const add=ctl.signal.addEventListener.bind(ctl.signal),remove=ctl.signal.removeEventListener.bind(ctl.signal);
        ctl.signal.addEventListener=(type,fn,...rest)=>{if(type==='abort')listeners.add(fn);return add(type,fn,...rest);};
        ctl.signal.removeEventListener=(type,fn,...rest)=>{if(type==='abort')listeners.delete(fn);return remove(type,fn,...rest);};
        h.ctx.MessageChannel=class {constructor(){this.port1={onmessage:null,close(){closed.push(1);}};this.port2={close(){closed.push(2);},postMessage:()=>{sent++;queueMicrotask(()=>{if(cancel)ctl.abort();this.port1.onmessage?.();});}};}};
        const task=h.run(s,clone(s),ctl.signal);
        if(cancel)await assert.rejects(task,{name:'AbortError'});else await task;
        assert.equal(sent,1);assert.deepEqual(closed,[1,2]);assert.equal(h.painted.length,cancel?1:2);assert.equal(h.timers.size,0);assert.equal(listeners.size,0);
    }
});
await test('scheduler rejection releases the capture stage and timeout',async()=>{
    const h=harness(),s=node('root',[node('a')]);s.cloneNode=()=>clone(s);h.ctx.document.querySelector=()=>s;
    h.ctx.scheduler={yield:async()=>{throw Error('scheduler unavailable');}};
    await assert.rejects(h.ctx.capture.captureMessages([0],()=>{},{resources:h.resources}),/scheduler unavailable/);
    assert.equal(h.appended,1);assert.equal(h.removed,1);assert.equal(h.timers.size,0);
});
await test('message dispatch failure closes ports and detaches abort listener',async()=>{
    const h=harness(),ctl=new AbortController(),s=node('root',[node('a')]),closed=[];let messages;
    h.ctx.MessageChannel=class {constructor(){this.port1={onmessage:null,close(){closed.push(1);}};messages=this.port1;this.port2={close(){closed.push(2);},postMessage(){throw Error('dispatch unavailable');}};}};
    await assert.rejects(h.run(s,clone(s),ctl.signal),/dispatch unavailable/);ctl.abort();
    assert.deepEqual(closed,[1,2]);assert.equal(messages.onmessage,null);assert.equal(h.timers.size,0);
});
console.log(`${passed} checks passed`);
