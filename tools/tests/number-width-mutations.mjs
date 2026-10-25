import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),observers=[],timers=new Map();let next=0,writes=0,scans=0;
class El{constructor(tag='div'){this.tag=tag;this.isConnected=true;this.children=[];}matches(s){return s==='dialog'?this.tag==='dialog':this.tag==='input';}querySelectorAll(){scans++;return this.children.filter(n=>n instanceof Input);} }
class Input extends El{constructor(value){super('input');this.type='number';this.value=value;this.placeholder='';const props=new Map();this.style={getPropertyValue:k=>props.get(k)||'',setProperty:(k,v)=>{writes++;props.set(k,v);}};}}
const dlg=new El('dialog'),body=new El('body'),old={};
const values={Element:El,HTMLInputElement:Input,MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(node){this.node=node;}disconnect(){this.node=null;}},document:{body,addEventListener(){},getElementById(){return null;},querySelectorAll(){return[dlg];}},setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
for(const key of Object.keys(values)){old[key]=globalThis[key];globalThis[key]=values[key];}
try{
    const {startNumberWidth,fitNumberInput}=await import(pathToFileURL(path.join(root,'src/num-width.js')));
    const input=new Input('1234');fitNumberInput(input);fitNumberInput(input);assert.equal(writes,1,'같은 폭을 다시 썼어요');
    startNumberWidth();const watch=observers.find(o=>o.node===dlg),before=scans;
    for(let i=0;i<100;i++)watch.fn([{addedNodes:[{nodeType:3,textContent:'가'}]}]);
    assert.equal(scans,before);assert.equal(timers.size,0,'일반 글자 갱신에 숫자칸 작업을 예약했어요');
    const row=new El();row.children=[input];watch.fn([{addedNodes:[row]}]);assert.equal(timers.size,1);
    for(const fn of timers.values())fn();timers.clear();assert.equal(writes,1);
    const fresh=new Input('123456');watch.fn([{addedNodes:[fresh]}]);for(const fn of timers.values())fn();timers.clear();assert.equal(writes,2);
    const pending=new Input('12345');watch.fn([{addedNodes:[pending]}]);dlg.isConnected=false;observers.find(o=>o!==watch&&o.node===body&&o!==observers[0]).fn();assert.equal(timers.size,0);
    console.log('숫자칸 새 요소 처리·같은 값 쓰기 방지·일반 타이핑 100회 무탐색·닫기 정리를 확인했어요.');
}finally{for(const key of Object.keys(values)){if(old[key]===undefined)delete globalThis[key];else globalThis[key]=old[key];}}
