// Synthetic DOM contracts: fixed UI labels only, iframe lifecycle and reversible changes.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const {installFruitStatusKorean} = await import(pathToFileURL(path.join(root,'src/scripts/fruit-status.js')));
class Element {
    constructor(doc, tag, attrs = {}, text = '') { this.ownerDocument=doc;this.tag=tag;this.nodeType=1;this.attrs={...attrs};this.children=[];this.listeners=new Map();if(text)this.appendText(text); }
    appendText(text) {const node={nodeType:3,nodeValue:text,parentElement:this};this.children.push(node);return node;}
    append(node){node.parentElement=this;this.children.push(node);return node;}
    get isConnected(){return this===this.ownerDocument.body || !!this.parentElement?.isConnected;}
    matches(selector){return selector.split(',').some(s=>s.startsWith('.')?s.slice(1).split('.').every(c=>(this.attrs.class||'').split(' ').includes(c)):s.startsWith('#')?this.attrs.id===s.slice(1):s.startsWith('[')?Object.hasOwn(this.attrs,s.slice(1,-1).split('=')[0]):this.tag===s);}
    closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null;}
    querySelectorAll(s){return this.children.filter(n=>n.nodeType===1).flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){this.listeners.set(k,fn);}removeEventListener(k,fn){if(this.listeners.get(k)===fn)this.listeners.delete(k);}
    get text(){return this.children.map(n=>n.nodeType===3?n.nodeValue:n.text).join('');}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
}
function documentFixture(){
    const doc={querySelector(s){return this.body.querySelector(s);},createTreeWalker(el){const nodes=[];function visit(n){for(const c of n.children)if(c.nodeType===3)nodes.push(c);else visit(c);}visit(el);let i=0;return{nextNode(){this.currentNode=nodes[i++];return !!this.currentNode;}};}};
    doc.body=new Element(doc,'body');return doc;
}
const doc=documentFixture(), chat=doc.body.append(new Element(doc,'div',{id:'chat'}));
const frames=new Map(), timers=new Map(), observers=[];let next=1;
const host={requestAnimationFrame(fn){const id=next++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setInterval(fn){const id=next++;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id),MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(node){this.node=node;}disconnect(){this.node=null;}}};
const settle=()=>{for(let i=0;frames.size&&i<8;i++){const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());}assert.equal(frames.size,0);};
const refresh=()=>{[...timers.values()].forEach(fn=>fn());settle();};
// 7.0.3: 바뀐 것은 감시자가 알린다(브라우저처럼) — 1.5초 타이머는 채팅 뿌리 · iframe 문서가 바뀐 때만 다시 훑는다
const mutate=()=>{for(const o of observers)if(o.node)o.fn([{addedNodes:[{nodeType:1}],removedNodes:[]}]);settle();};
const add=(parent,tag,attrs,text)=>parent.append(new Element(parent.ownerDocument,tag,attrs,text));
function card(parent){
    const wrapper=add(parent,'div',{class:'fate-status-wrapper'});
    const label=add(wrapper,'span',{class:'fate-grid-label'},'DATE');
    const value=add(wrapper,'span',{'data-f':'place'},'SCENE');
    const raw=add(wrapper,'div',{class:'fate-raw'},'日期：DATE');
    const footer=add(wrapper,'div',{class:'fate-bottom-en'},'My heart found you,before my mind understood.');
    const button=add(wrapper,'button',{class:'fate-theme-toggle',title:'切换夜间模式','aria-label':'切换夜间模式'});
    const quote=add(wrapper,'div',{class:'movie-line-content'}),deco=add(quote,'span',{class:'movie-deco-eng'},'ECHO');
    const chars=[...'沉默不语，时光流淌'].map(c=>add(quote,'span',{class:'char-wrap'},c));
    const code=add(wrapper,'code',{});const ignored=add(code,'span',{class:'fate-grid-label'},'TIME');
    return {wrapper,label,value,raw,footer,button,quote,deco,chars,ignored};
}
const outer=card(doc.body), direct=card(chat), iframe=add(chat,'iframe',{}), innerDoc=documentFixture();iframe.contentDocument=innerDoc;
const inner=card(innerDoc.body), foreign=add(chat,'iframe',{});Object.defineProperty(foreign,'contentDocument',{get(){throw Error('cross origin');}});
const novel=add(innerDoc.body,'div',{class:'novel-header-container'}), cp=add(novel,'span',{class:'novel-cp-row-label'},'CP'), at=add(novel,'span',{class:'novel-meta-label'},'AT');
const novelValue=add(novel,'span',{class:'novel-cp-name'},'CP');
const prologue=add(innerDoc.body,'div',{class:'vintage-prologue'}), proButton=add(prologue,'button',{class:'mom-theme-toggle','aria-label':'切换日夜'});
const choices=add(innerDoc.body,'div',{id:'meowFM-OptionCard'}), choice=add(choices,'div',{class:'corner-info corner-text'},'Choose · Sth.');
const choiceValue=add(choices,'div',{class:'option-text'},'Choose · Sth.');
const stop=installFruitStatusKorean(doc,host);
assert.equal(cp.text,'관계');assert.equal(at.text,'장소');assert.equal(novelValue.text,'CP');
assert.equal(choice.text,'선택하기');assert.equal(choiceValue.text,'Choose · Sth.');assert.equal(proButton.getAttribute('aria-label'),'밝은/어두운 모드 전환');
assert.equal(outer.label.text,'DATE');assert.equal(direct.label.text,'날짜');assert.equal(inner.label.text,'날짜');
for(const c of [direct,inner]){assert.equal(c.value.text,'SCENE');assert.equal(c.raw.text,'日期：DATE');assert.equal(c.ignored.text,'TIME');assert.equal(c.chars.map(x=>x.text).join(''),'말없이 시간이 흘러간다.');assert.equal(c.deco.text,'메아리');}
const savedNodes=direct.chars.map(x=>x.children[0]);
refresh();assert.deepEqual(direct.chars.map(x=>x.children[0]),savedNodes);
[...timers.values()].forEach(fn=>fn());assert.equal(frames.size,0,'idle timer tick must not rescan an unchanged chat');
inner.button.setAttribute('title','切换日间模式');inner.button.setAttribute('aria-label','切换日间模式');mutate();assert.equal(inner.button.getAttribute('title'),'밝은 모드로 전환');
direct.label.children[0].nodeValue='사용자 제목';direct.footer.children[0].nodeValue='사용자 문구';mutate();assert.equal(direct.label.text,'사용자 제목');
const newDoc=documentFixture(), replaced=card(newDoc.body);iframe.contentDocument=newDoc;iframe.listeners.get('load')();settle();assert.equal(replaced.label.text,'날짜');assert.equal(inner.label.text,'DATE');assert.equal(cp.text,'CP');assert.equal(choice.text,'Choose · Sth.');
const late=card(newDoc.body);mutate();assert.equal(late.label.text,'날짜');late.wrapper.remove();mutate();assert.equal(late.label.text,'DATE');
const reused=direct.label;reused.remove();doc.body.append(reused);mutate();assert.equal(reused.text,'사용자 제목');
stop();stop();assert.equal(timers.size,0);assert.equal(frames.size,0);assert(observers.every(o=>!o.node));assert.equal(iframe.listeners.size,0);assert.equal(foreign.listeners.size,0);
assert.equal(replaced.label.text,'DATE');assert.equal(direct.footer.text,'사용자 문구');assert.equal(direct.chars.map(x=>x.text).join(''),'沉默不语，时光流淌');
const stopAgain=installFruitStatusKorean(doc,host);assert.equal(replaced.label.text,'날짜');stopAgain();assert.equal(replaced.label.text,'DATE');
console.log('Fruit status: scope, same-origin frames, foreign-frame isolation, fixed labels, field preservation, split quote, dynamic hints, reload, removal, external edits, OFF and ON passed');
