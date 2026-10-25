import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {copyFruitPreview,findFruitPreviewSource,FRUIT_SNAPSHOT_DOCUMENT}=await import(pathToFileURL(path.join(root,'src/fruit-type-snapshot.js')));
function element(tag,attrs={},children=[]) {
    const values=new Map(Object.entries(attrs));
    const el={nodeType:1,tagName:tag.toUpperCase(),localName:tag,namespaceURI:'http://www.w3.org/1999/xhtml',childNodes:children,style:{},
        get attributes(){return [...values].map(([name,value])=>({name,value}));},setAttribute:(k,v)=>values.set(k,v),getAttribute:k=>values.get(k),
        append(c){this.childNodes.push(c);},replaceChildren(...c){this.childNodes=c;},closest:()=>null,getClientRects:()=>[{}],querySelectorAll:()=>[],classList:{contains:()=>false}};
    return el;
}
const host=element('div'),pseudo=element('style'),target={createElement:tag=>element(tag),createElementNS:(ns,tag)=>element(tag),createTextNode:text=>({nodeType:3,textContent:text}),querySelector:()=>host,getElementById:()=>pseudo,fonts:new Set()};
const source=element('section',{id:'statusBar',class:'dynamic-status-container',onclick:'danger()',style:'background:url(https://invalid.invalid/data)'},[
    element('script',{},[{nodeType:3,textContent:'danger()'}]),element('iframe',{src:'https://invalid.invalid'}),element('img',{src:'https://invalid.invalid'}),
    element('a',{href:'javascript:danger()',onclick:'danger()'},[{nodeType:3,textContent:'가상 기록'}]),element('span',{'data-private-url':'https://invalid.invalid'},[{nodeType:3,textContent:'도서관'}])]);
const css=Object.assign(['font-size','color','background-image','width'],{getPropertyValue:k=>({'font-size':'18px',color:'rgb(1, 2, 3)','background-image':'url(https://invalid.invalid/x)',width:'300px'})[k],content:'none'});
const doc={defaultView:{getComputedStyle:()=>css},fonts:new Set()};
const own=n=>{n.ownerDocument=doc;for(const c of n.childNodes||[])own(c);};own(source);
assert(copyFruitPreview(source,target));
const copied=host.childNodes[0];
assert.deepEqual(copied.childNodes.map(n=>n.tagName),['A','SPAN']);
assert.equal(copied.getAttribute('onclick'),undefined);assert.equal(copied.childNodes[0].getAttribute('href'),undefined);
assert.equal(copied.childNodes[1].getAttribute('data-private-url'),undefined);
assert(copied.style.cssText.includes('font-size:18px'));assert(!copied.style.cssText.includes('url('));assert(!copied.style.cssText.includes('!important'));
assert(FRUIT_SNAPSHOT_DOCUMENT.includes("default-src 'none'"));assert(!FRUIT_SNAPSHOT_DOCUMENT.includes('<script'));
const cross=element('iframe');Object.defineProperty(cross,'contentDocument',{get(){throw Error('다른 출처');}});
const scope={querySelectorAll:q=>q==='iframe'?[cross]:[source]};
assert.equal(findFruitPreviewSource({querySelector:()=>scope},'#statusBar'),source);
source.getClientRects=()=>[];assert.equal(findFruitPreviewSource({querySelector:()=>scope},'#statusBar'),null);
console.log('상태창 복제의 실행·외부주소 차단, 설정 덮어쓰기, 종류·출처·표시 경계를 확인했어요.');
