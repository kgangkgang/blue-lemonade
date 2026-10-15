// 카드 고르기 창 (src/prompt-card-picker.js) — 6.7.5 여러 장 고르기(캐릭터 이름 연동 줄)와 예전 한 장 고르기를 작은 가짜 문서로 검사. 네트워크 · DOM 없음.
//   node tools/tests/prompt-card-picker.mjs [테마 루트]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const source=fs.readFileSync(path.join(root,'src/prompt-card-picker.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ');
// 창이 쓰는 만큼만: 만들기 · 붙이기 · 속성 · 듣기 · 클래스/속성/태그 선택자 하나
class El{
  constructor(doc,tag){Object.assign(this,{doc,tagName:tag.toUpperCase(),children:[],attrs:{},on:{},hidden:false,textContent:'',className:'',value:'',parent:null});}
  setAttribute(k,v){this.attrs[k]=String(v);} getAttribute(k){return this.attrs[k]??null;} hasAttribute(k){return k in this.attrs;}
  addEventListener(t,f,o){(this.on[t]??=[]).push({f,once:!!o?.once});}
  fire(t,extra={}){for(const l of [...(this.on[t]||[])]){if(l.once)this.on[t].splice(this.on[t].indexOf(l),1);l.f({target:this,preventDefault(){},...extra});}}
  click(){this.fire('click');}
  append(...kids){for(const k of kids){if(k.fragment){for(const c of k.children){c.parent=this;this.children.push(c);}}else{k.parent=this;this.children.push(k);}}}
  replaceChildren(...kids){this.children=[];this.append(...kids);}
  remove(){if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
  get isConnected(){let n=this;while(n.parent)n=n.parent;return n===this.doc.body;}
  focus(){this.doc.activeElement=this;}
  matches(sel){const m=/^\.([\w-]+)$/.exec(sel);if(m)return this.className.split(/\s+/).includes(m[1]);const a=/^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);if(a)return a[2]===undefined?this.hasAttribute(a[1]):this.getAttribute(a[1])===a[2];return this.tagName===sel.toUpperCase();}
  querySelectorAll(sel){const out=[];const walk=n=>{for(const c of n.children){if(c.matches(sel))out.push(c);walk(c);}};walk(this);return out;}
  querySelector(sel){return this.querySelectorAll(sel)[0]??null;}
  getBoundingClientRect(){return{left:0,right:100,top:0,bottom:100};}
  set innerHTML(html){   // 창 껍데기만 읽는다 — 머리 닫기 · 찾기 칸 · 목록 · 바닥(상태 · 선택 해제 · 완료)
    const make=(tag,attrs={},cls='')=>{const e=new El(this.doc,tag);Object.assign(e.attrs,attrs);e.className=cls;return e;};
    this.children=[];
    this.append(make('button',{'data-card-close':''}),make('input',{'data-card-search':''}),make('div',{},'bl-prompt-card-list'),make('small',{role:'status'}),make('button',{'data-card-clear':''}));
    if(html.includes('data-card-done'))this.append(make('button',{'data-card-done':''}));
  }
}
function setup(){
  const doc={activeElement:null,createElement:tag=>{const e=new El(doc,tag);if(tag==='dialog'){e.open=false;e.close=()=>{if(!e.open)return;e.open=false;e.fire('close');};}return e;},
    createDocumentFragment:()=>Object.assign(new El(doc,'#fragment'),{fragment:true}),querySelector:sel=>doc.body.querySelector(sel)};
  doc.body=new El(doc,'body');
  const context={document:doc,showThemeModal:d=>{d.open=true;}};
  vm.runInNewContext(source+'\nglobalThis.api={openPromptCardPicker,cardChoices,filterCards};',context);
  const characters=[{avatar:'b.png',name:'Bea'},{avatar:'a.png',name:'Ann'},{avatar:'c.png',name:'Cal'},{avatar:'x.png',name:' '}];
  return{doc,api:context.api,context:{characters}};
}
const choices=d=>d.querySelector('.bl-prompt-card-list').querySelectorAll('.bl-prompt-card-choice');
const names=d=>choices(d).map(row=>row.children[1].children[0].textContent);
const pressed=d=>choices(d).filter(row=>row.getAttribute('aria-pressed')==='true').map(row=>row.children[1].children[0].textContent);
let passed=0;
async function check(label,fn){await fn();console.log('ok',label);passed++}
await check('multi mode lists chosen cards first, toggles on click and reports the count',async()=>{
  const {doc,api,context}=setup();const got=[];
  const d=api.openPromptCardPicker({selected:['c.png'],context,onPick:list=>got.push([...list])});
  assert.equal(d.open,true);assert.deepEqual(names(d),['Cal','Ann','Bea'],'chosen first, then by name (blank names skipped)');assert.deepEqual(pressed(d),['Cal']);
  assert.equal(d.querySelector('[role="status"]').textContent,'3개 · 1장 골랐어요');assert.ok(d.querySelector('[data-card-done]'),'done button');
  choices(d)[1].focus();choices(d)[1].click();assert.deepEqual(pressed(d),['Cal','Ann']);assert.equal(d.open,true,'stays open');assert.equal(doc.activeElement,choices(d)[1],'focus stays on the same row');
  choices(d)[0].click();assert.deepEqual(pressed(d),['Ann']);assert.equal(d.querySelector('[role="status"]').textContent,'3개 · 1장 골랐어요');
  assert.deepEqual(got,[],'nothing is sent until the window closes');
  d.querySelector('[data-card-done]').click();assert.equal(d.open,false);assert.deepEqual(got,[['a.png']]);assert.equal(d.isConnected,false,'removed after closing');
});
await check('multi mode: clear empties the choice and closing by X still hands the list back',async()=>{
  const {api,context}=setup();const got=[];
  const d=api.openPromptCardPicker({selected:['a.png','gone.png'],context,onPick:list=>got.push([...list])});
  assert.equal(d.querySelector('[role="status"]').textContent,'3개 · 2장 골랐어요','cards no longer in the list are kept until cleared');
  d.querySelector('[data-card-clear]').click();assert.deepEqual(pressed(d),[]);assert.equal(d.open,true);
  d.querySelector('[data-card-close]').click();assert.deepEqual(got,[[]]);
});
await check('single mode keeps the old contract: one name, closes at once, no done button',async()=>{
  const {api,context}=setup();const got=[];
  const d=api.openPromptCardPicker({current:'Bea',context,onPick:name=>got.push(name)});
  assert.equal(d.querySelector('[data-card-done]'),null);assert.deepEqual(names(d),['Ann','Bea','Cal']);assert.deepEqual(pressed(d),['Bea']);assert.equal(d.querySelector('[role="status"]').textContent,'3개');
  choices(d)[2].click();assert.equal(d.open,false);assert.deepEqual(got,['Cal']);
});
await check('search filters by every word and a second open focuses the open window',async()=>{
  const {api,context}=setup();
  assert.deepEqual(api.filterCards(api.cardChoices(context),' a ').map(c=>c.name).sort(),['Ann','Bea','Cal']);assert.deepEqual(api.filterCards(api.cardChoices(context),'an').map(c=>c.name),['Ann']);
  const d=api.openPromptCardPicker({selected:[],context});const again=api.openPromptCardPicker({selected:[],context});assert.equal(again,d);
});
console.log(`prompt-card-picker: ${passed} passed`);
