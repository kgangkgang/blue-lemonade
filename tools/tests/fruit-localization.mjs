import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const codeOf=name=>JSON.parse(fs.readFileSync(path.join(root,`src/scripts/bundled/${name}.js`),'utf8').slice(15).trim().replace(/;$/,''));
let passed=0;function check(name,fn){fn();passed++;console.log('ok',name)}
class Element {
  constructor(tag='div',attrs={},text=''){this.nodeType=1;this.tagName=tag.toUpperCase();this.attrs=new Map(Object.entries(attrs));this.children=[];this.dataset={};this.value='';if(text)this.append({nodeType:3,nodeValue:text});}
  get id(){return this.getAttribute('id')||''}get className(){return this.getAttribute('class')||''}
  get isConnected(){return this.tagName==='HTML'||!!this.parentElement?.isConnected}
  getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null}setAttribute(k,v){this.attrs.set(k,String(v))}
  append(node){node.parentElement=this;Object.defineProperty(node,'isConnected',{configurable:true,get:()=>this.isConnected});this.children.push(node)}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null}
  matches(selector){return selector.split(',').some(part=>{
    part=part.trim();const ancestry=part.split(/\s+(?![^\[]*\])/);if(ancestry.length>1){const last=ancestry.pop();return this.matches(last)&&!!this.parentElement?.closest(ancestry.join(' '))}
    const no=part.match(/:not\((.*?)\)/);if(no){if(this.matches(no[1]))return false;part=part.replace(no[0],'')}
    for(const a of part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g))if(!this.attrs.has(a[1])||a[2]!==undefined&&this.getAttribute(a[1])!==a[2])return false;
    part=part.replace(/\[[^\]]*\]/g,'');const id=part.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;
    for(const c of part.matchAll(/\.([\w-]+)/g))if(!this.className.split(/\s+/).includes(c[1]))return false;
    const tag=part.match(/^[\w-]+/);return !tag||tag[0].toUpperCase()===this.tagName;
  })}
  closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null}
  querySelectorAll(s){const out=[];for(const c of this.children)if(c.nodeType===1){if(c.matches(s))out.push(c);out.push(...c.querySelectorAll(s))}return out}
  get text(){return this.children.filter(x=>x.nodeType===3).map(x=>x.nodeValue).join('')}
}
function environment(){
  const html=new Element('html'),head=new Element('head'),body=new Element('body');html.append(head);html.append(body);
  const listeners=new Map(),frames=new Map(),intervals=new Map(),observers=[],calls=[];let next=1;
  const doc={documentElement:html,head,body,activeElement:null,querySelectorAll:s=>html.querySelectorAll(s),getElementById:id=>html.querySelectorAll('#'+id)[0],createElement:tag=>new Element(tag),addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n)},createTreeWalker(root){const nodes=[];const walk=n=>{for(const c of n.children){if(c.nodeType===3)nodes.push(c);else walk(c)}};walk(root);let i=0;return{currentNode:null,nextNode(){this.currentNode=nodes[i++];return!!this.currentNode}}}};
  class Observer{constructor(fn){this.fn=fn;this.targets=[];observers.push(this)}observe(n,options){this.targets.push([n,options])}disconnect(){this.targets=[]}}
  const host={document:doc,MutationObserver:Observer,requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),setInterval:fn=>{const id=next++;intervals.set(id,fn);return id},clearInterval:id=>intervals.delete(id),confirm:message=>{calls.push(['confirm',message]);return false},prompt:(message,value)=>{calls.push(['prompt',message,value]);return '首页'}};host.parent=host;
  const cleanups=[];const run=()=>vm.runInNewContext(codeOf('fruit-heart'),{window:host,BlueLemonade:{onCleanup:f=>cleanups.push(f)},console},{timeout:2000});
  const settle=()=>{for(let i=0;frames.size&&i<10;i++){const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f())}assert.equal(frames.size,0)};
  return{html,head,body,doc,host,observers,calls,cleanups,intervals,listeners,run,settle,mutate(){observers.filter(o=>o.targets.length).forEach(o=>o.fn());settle()},click(target){listeners.get('click')?.({target});settle()}};
}
const add=(parent,tag,attrs,text)=>{const x=new Element(tag,attrs,text);parent.append(x);return x};
let dictionary;vm.runInNewContext(codeOf('fruit'),{BlueLemonade:{translate:data=>dictionary=data}},{timeout:1000});
check('display dictionary covers 314 distinct prompt titles and 21 regex titles',()=>{assert.equal(dictionary.prompts.length,314);assert.equal(dictionary.regex.length,21);for(const item of [...dictionary.prompts,...dictionary.regex]){assert.deepEqual(Object.keys(item).sort(),['name','title']);assert.ok(item.name&&item.title)}});
check('both plain copies execute the exact bundled code',()=>{for(const name of ['fruit','fruit-heart']){const s=fs.readFileSync(path.join(root,`src/scripts/plain/${name}.js`),'utf8');assert.equal(s.slice(s.indexOf('/*BL-SCRIPT-START*/')+19,s.lastIndexOf('/*BL-SCRIPT-END*/')).trim(),codeOf(name).trim())}});
const e=environment(),panel=add(e.html,'div',{id:'fruit-heart-v6',class:'open'}),home=add(panel,'button',{'data-nav':'overview'},'首页'),close=add(panel,'button',{title:'关闭'},'×');
const prompt=add(panel,'input',{placeholder:'搜索全部条目…'});prompt.value='首页';prompt.checked=true;
const area=add(panel,'textarea',{},'首页'),code=add(panel,'code',{},'{{输入}}'),chat=add(e.body,'div',{id:'chat'},'首页');
const profile=add(panel,'button',{'data-profile':'首页'},'首页'),word=add(panel,'button',{'data-nsfw-drop':'start:0',title:'点一下删掉「首页」'},'首页'),preview=add(panel,'pre',{class:'fh-exp-preview'},'首页');
const edit=add(panel,'div',{contenteditable:'true'},'首页'),svg=add(panel,'svg',{},'首页'),author=add(panel,'span',{},'@喵喵电波MoM');
const version=add(panel,'small',{},'脚本 v20261003.1 · 本地测试 · 果实 V6+');
const reasoning=add(e.body,'select',{id:'reasoning_select'}),option=add(reasoning,'option',{value:'果实之心'},'果实之心'),foreign=add(reasoning,'option',{value:'custom'},'首页');
const qr=add(panel,'button',{'data-qr':'synthetic','data-qr-label':'推进剧情'},'推进剧情');
e.run();
check('home text and close hint use their correct contexts',()=>{assert.equal(home.text,'홈');assert.equal(close.getAttribute('title'),'닫기')});
check('inputs keep original values and toggle state',()=>{assert.equal(prompt.value,'首页');assert.equal(prompt.checked,true);assert.equal(prompt.getAttribute('placeholder'),'전체 항목 검색…');assert.equal(area.text,'首页')});
check('chat, code, editable content, keywords, profiles and preview stay original',()=>{for(const node of [chat,profile,word,preview,edit,svg])assert.equal(node.text,'首页');assert.equal(code.text,'{{输入}}');assert.equal(author.text,'@喵喵电波MoM')});
check('a keyword tooltip keeps the actual stored keyword',()=>{assert.ok(word.getAttribute('title').includes('首页'));assert.ok(!word.getAttribute('title').includes('홈'))});
check('adjacent version captures preserve the version and translate the suffix',()=>{assert.ok(version.text.includes('20261003.1'));assert.ok(version.text.includes('로컬 테스트'));assert.ok(!version.text.includes('本地测试'))});
check('reasoning display changes only the owned option; its value stays original',()=>{assert.equal(option.text,'과일의 마음');assert.equal(option.getAttribute('value'),'果实之心');assert.equal(foreign.text,'首页')});
check('QR branch keys stay original while labels translate',()=>{assert.ok(!qr.text.includes('剧情'));assert.equal(qr.getAttribute('data-qr-label'),'推进剧情');assert.equal(qr.getAttribute('data-qr'),'synthetic')});
check('the observer never watches the chat or body subtree',()=>{for(const o of e.observers)for(const [n,opts] of o.targets){assert.notEqual(n,chat);if(n===e.body||n===e.html)assert.notEqual(opts.subtree,true)}});
const save=add(panel,'button',{},'保存');e.mutate();
check('newly rendered controls translate after mutation',()=>assert.equal(save.text,'저장'));
e.click(home);e.host.confirm('操作失败');e.host.prompt('方案名称','首页');e.host.confirm('删除方案「首页」？开关状态不变。');
check('native dialogs translate only known prompts and preserve names/defaults/return values',()=>{assert.equal(e.calls[0][1],'操作失败');assert.notEqual(e.calls[1][1],'方案名称');assert.equal(e.calls[1][2],'首页');assert.ok(e.calls[2][1].includes('首页'));assert.equal(e.host.prompt('方案名称','原始值'),'首页')});
home.children[0].nodeValue='사용자가 바꾼 표시';close.setAttribute('title','사용자가 바꾼 설명');
e.cleanups.at(-1)();
check('turning off restores only text and attributes still owned by the adapter',()=>{assert.equal(home.text,'사용자가 바꾼 표시');assert.equal(close.getAttribute('title'),'사용자가 바꾼 설명');assert.equal(save.text,'保存');assert.equal(option.text,'果实之心');assert.equal(prompt.getAttribute('placeholder'),'搜索全部条目…')});
check('cleanup removes timers, observers, styles and handlers',()=>{assert.equal(e.intervals.size,0);assert.equal(e.listeners.size,0);assert.ok(e.observers.every(x=>x.targets.length===0));assert.equal(e.head.children.length,0);assert.equal(e.host.__blueLemonadeFruitHeartKorean_v1,undefined)});
check('turning on twice replaces its own instance without duplicate work',()=>{e.run();e.run();assert.equal(e.intervals.size,1);assert.equal(e.head.children.length,1);e.cleanups.at(-1)();assert.equal(e.intervals.size,0)});
check('a later external wrapper stays installed and cannot revive a stopped translation',()=>{e.run();e.click(home);const previous=e.host.prompt;const external=(...args)=>previous(...args);e.host.prompt=external;e.cleanups.at(-1)();e.host.prompt('方案名称','首页');assert.equal(e.host.prompt,external);assert.equal(e.calls.at(-1)[1],'方案名称');assert.equal(e.calls.at(-1)[2],'首页')});
const unowned=environment(),otherSelect=add(unowned.body,'select',{id:'reasoning_select'}),otherOption=add(otherSelect,'option',{value:'果实之心'},'果实之心');unowned.run();
check('an unrelated reasoning menu remains unchanged without the owned panel',()=>assert.equal(otherOption.text,'果实之心'));unowned.cleanups.at(-1)();
console.log(`fruit-localization: ${passed} passed`);
