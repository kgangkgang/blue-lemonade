// 6.9.8 뒷일 다리 (src/after-work.js) + 백그라운드 창이 그걸 보고 버티는 길 (src/background-window.js shouldClose)
// 꼬리표마다 세기 · 상한(5분) · 전역 창구 같은 모양이면 재사용 · 답 끝 90초 대신 뒷일 끝까지 · 끝나면 바로 · 번역 단추로만 켠 것은 뒷일 끝에 done
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
let n=0;const t=(name,fn)=>{fn();n++};

const {createAfterWork,installAfterWork,AFTER_WORK,MAX_MS}=await import(pathToFileURL(path.join(root,'src/after-work.js')));

t('begin/end count per tag, busy and tags follow, the returned function ends',()=>{
  let now=1000;const w=createAfterWork({now:()=>now});
  assert.equal(w.busy,false);
  const end=w.begin('translate');w.begin('translate');w.begin('image');
  assert.deepEqual(w.tags.sort(),['image','translate']);
  assert.equal(w.end('translate'),1);assert.equal(w.busy,true);
  end();assert.deepEqual(w.tags,['image']);
  assert.equal(w.end('image'),0);assert.equal(w.busy,false);
  assert.equal(w.end('nothing'),0,'end without begin never goes negative');
});
t('a tag left open is dropped after the cap (5 minutes) by busy and by sweep',()=>{
  let now=0;const w=createAfterWork({now:()=>now});
  w.begin('stuck');assert.equal(w.busy,true);
  now=MAX_MS;assert.equal(w.busy,true,'at the cap still busy');
  now=MAX_MS+1;assert.equal(w.busy,false);assert.equal(w.sweep(),false);
  w.begin('stuck');assert.equal(w.busy,true,'a new begin after the sweep starts over');
});
t('begin on a tag that silently passed the cap (no sweep in between) rewinds it to a fresh start',()=>{
  let now=0;const w=createAfterWork({now:()=>now});
  w.begin('t');now=MAX_MS+5;assert.equal(w.busy,false,'expired');
  const end=w.begin('t');assert.equal(w.busy,true,'counted as a new begin, not a second one on the dead tag');
  assert.deepEqual(w.tags,['t']);end();assert.equal(w.busy,false,'one end closes it (count was reset to 1)');
});
t('onChange fires only on busy ↔ idle edges, errors in a listener do not break others',()=>{
  const w=createAfterWork();const seen=[];
  w.onChange(()=>{throw new Error('boom')});const off=w.onChange(e=>seen.push(e.busy));
  w.begin('a');w.begin('b');w.end('a');w.end('b');w.begin('c');w.clear();
  assert.deepEqual(seen,[true,false,true,false]);
  off();w.begin('d');assert.deepEqual(seen,[true,false,true,false]);
});
t('installAfterWork keeps an existing bridge of the same shape, replaces junk',()=>{
  const g={};const w=installAfterWork(g);assert.equal(installAfterWork(g),w);assert.equal(g[AFTER_WORK],w);
  const other={begin(){},end(){}};const g2={[AFTER_WORK]:other};assert.equal(installAfterWork(g2),other);
  const g3={[AFTER_WORK]:{}};assert.notEqual(installAfterWork(g3),g3[AFTER_WORK]===undefined);assert.equal(typeof g3[AFTER_WORK].begin,'function');
});

// ---- 백그라운드 창: 작은 DOM · 실리태번 흉내
const listeners={};
globalThis.document=Object.assign(new EventTarget(),{hidden:true,body:{dataset:{},classList:{contains:()=>false}},querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},addEventListener(){},play:async()=>{},pause(){}}),pictureInPictureEnabled:false});
globalThis.window={};
globalThis.jQuery=()=>({val:()=>''});
globalThis.SillyTavern={getContext:()=>({eventSource:{on:(name,fn)=>{(listeners[name]??=[]).push(fn)}},event_types:{GENERATION_STARTED:'gs',STREAM_TOKEN_RECEIVED:'st',GENERATION_ENDED:'ge',GENERATION_STOPPED:'gx'},chat:[{mes:'답'}]})};
const emit=(name,...args)=>{for(const fn of listeners[name]||[])fn(...args)};
const bw=await import(pathToFileURL(path.join(root,'src/background-window.js')));
const {state,shouldClose,work,setLastSign,closeDelayAfterWork,onTap,translateTapAt}=bw._forTest;
assert.equal(work,globalThis[AFTER_WORK],'the window uses the global bridge');
const realNow=Date.now;let clock=1_000_000;Date.now=()=>clock;
try{
  bw.syncBackgroundWindow(true,'audio');
  t('answer done → holds 90 s then closes when nothing else runs',()=>{
    emit('gs','normal',{},false);assert.equal(state.phase,'working');
    emit('ge');assert.equal(state.phase,'done');
    clock+=89_000;assert.equal(shouldClose(),false);
    clock+=2_000;assert.equal(shouldClose(),true);
  });
  t('after-work keeps it alive past 90 s until end (then the grace timer closes), capped at 5 minutes',()=>{
    emit('gs','normal',{},false);emit('ge');
    const end=work.begin('translate');
    clock+=120_000;assert.equal(shouldClose(),false,'translation still running');
    end();
    assert.equal(work.busy,false);
    assert.equal(shouldClose(),true,'done + 90 s passed + no work → close');
    emit('gs','normal',{},false);emit('ge');work.begin('stuck');
    clock+=MAX_MS+1_000;assert.equal(shouldClose(),true,'a begin without end is dropped at the cap');
    work.clear();
  });
  t('working without generation: after-work counts as a sign of life, its end marks done',()=>{
    emit('gs','normal',{},false);emit('ge');work.clear();
    state.phase='working';setLastSign(clock);          // 번역 단추를 눌러 켠 것처럼
    const end=work.begin('translate');
    clock+=100_000;assert.equal(shouldClose(),false,'work.busy refreshes the sign');
    end();
    assert.equal(state.phase,'done','no generation running → the end of the work is the end');
    assert.equal(state.doneAt,clock);
    clock+=100_000;assert.equal(shouldClose(),true);
  });
  t('stale working with no work and no generation drops after 90 s',()=>{
    state.phase='working';setLastSign(clock);clock+=91_000;assert.equal(shouldClose(),true);assert.equal(state.phase,'idle');
  });
  t('a translate button tap alone does not arm (original↔translation toggle); begin within 5 s arms, later begin does not',()=>{
    state.phase='idle';work.clear();
    const btn={closest:sel=>/mes_llm_translate/.test(sel)?btn:null};
    onTap({target:btn});assert.equal(state.phase,'idle','no hum for a plain tap');assert.equal(translateTapAt(),clock);
    clock+=1_000;const end=work.begin('translate');assert.equal(state.phase,'working','translation really started → armed');end();
    assert.equal(state.phase,'done');work.clear();state.phase='idle';
    onTap({target:btn});clock+=6_000;const end2=work.begin('translate');assert.equal(state.phase,'idle','too late for the tap → stays off');end2();
    const send={closest:sel=>/#send_but/.test(sel)?send:null};onTap({target:send});assert.equal(state.phase,'working','other triggers still arm at once');
  });
  t('after work ends the close waits at least 20 s after done (TTS after translation), else 2.5 s',()=>{
    state.phase='done';state.doneAt=clock;assert.equal(closeDelayAfterWork(clock),20_000);
    assert.equal(closeDelayAfterWork(clock+10_000),10_000);assert.equal(closeDelayAfterWork(clock+60_000),2_500);
  });
}finally{Date.now=realNow;}

console.log(`PASS after-work: ${n} checks (tags · cap · rewind · edges · install · hold 90s · wait for work · cap · translate tap · 20s · stale)`);
