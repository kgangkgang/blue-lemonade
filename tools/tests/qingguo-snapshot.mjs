import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {FRUIT_TYPES,typeOwner}=await import(pathToFileURL(path.join(root,'src/fruit-type-schema.js')));
const {findFruitPreviewSource,copyFruitPreview}=await import(pathToFileURL(path.join(root,'src/fruit-type-snapshot.js')));
const types=FRUIT_TYPES.filter(t=>t.owner==='qingguo');
assert.equal(types.length,3);
function element(tag,attrs={},children=[]){
 const values=new Map(Object.entries(attrs));
 return {nodeType:1,tagName:tag.toUpperCase(),localName:tag,namespaceURI:'http://www.w3.org/1999/xhtml',childNodes:children,style:{},get attributes(){return [...values].map(([name,value])=>({name,value}));},setAttribute:(k,v)=>values.set(k,String(v)),getAttribute:k=>values.get(k),append(n){this.childNodes.push(n);},replaceChildren(...nodes){this.childNodes=nodes;},closest:()=>null,getClientRects:()=>[{}],querySelectorAll:()=>[],classList:{contains:()=>false}};
}
for(const [index,type] of types.entries()){
 assert.equal(typeOwner(type),'fruit');
 const size=18+index,css=Object.assign(['font-size','font-family','width'],{getPropertyValue:k=>({'font-size':size+'px','font-family':'inherit',width:'300px'})[k],content:'none'});
 const source=element('section',{class:type.root.match(/^\.([\w-]+)/)[1]},[{nodeType:3,textContent:'실제 표시를 대신한 모의 상태창'}]);
 const inner={defaultView:{getComputedStyle:()=>css},fonts:new Set(),body:{querySelectorAll:selector=>selector===type.root?[source]:[]}};source.ownerDocument=inner;
 const frame=element('iframe');frame.contentDocument=inner;
 const doc={querySelector:selector=>selector==='#chat'?{querySelectorAll:q=>q==='iframe'?[frame]:[]}:null};
 assert.equal(findFruitPreviewSource(doc,type.root),source);
 const host=element('div'),pseudo=element('style'),target={createElement:tag=>element(tag),createElementNS:(ns,tag)=>element(tag),createTextNode:textContent=>({nodeType:3,textContent}),querySelector:()=>host,getElementById:()=>pseudo,fonts:new Set()};
 assert(copyFruitPreview(source,target));
 assert.equal(host.childNodes[0].getAttribute('class'),source.getAttribute('class'));
 assert(host.childNodes[0].style.cssText.includes('font-size:'+size+'px'));
 assert.equal(host.childNodes[0].childNodes[0].textContent,'실제 표시를 대신한 모의 상태창');
 source.getClientRects=()=>[];assert.equal(findFruitPreviewSource(doc,type.root),null);
}
const ui=fs.readFileSync(path.join(root,'src/fruit-type-ui.js'),'utf8');
assert(ui.includes('findFruitPreviewSource(document,typeMatch(type))'));
assert(ui.includes('copyFruitPreview(source,d)'));
assert(!ui.includes('fruitTypePreview('));
const oldPreview=fs.readFileSync(path.join(root,'src/fruit-type-preview.js'),'utf8');
assert(!oldPreview.includes("kind==='qingguo-"));
console.log('청과3종이 iframe의 표시 상태창과 계산 스타일을 읽는 경로를 모의 검사했어요(없을 때 표본은 fruit-type-sample 시험이 봐요).');
