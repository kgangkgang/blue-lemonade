import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {copyFruitPreview,findFruitPreviewSource,safePreviewStyleValue,FRUIT_SNAPSHOT_DOCUMENT}=await import(pathToFileURL(path.join(root,'src/fruit-type-snapshot.js')));
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
assert.deepEqual(copied.childNodes.map(n=>n.tagName),['IMG','A','SPAN']);
assert.equal(copied.getAttribute('onclick'),undefined);assert.equal(copied.childNodes[1].getAttribute('href'),undefined);
assert.equal(copied.childNodes[2].getAttribute('data-private-url'),undefined);
assert(copied.style.cssText.includes('font-size:18px'));assert(!copied.style.cssText.includes('url('));assert(!copied.style.cssText.includes('!important'));
assert(FRUIT_SNAPSHOT_DOCUMENT.includes("default-src 'none'"));assert(!FRUIT_SNAPSHOT_DOCUMENT.includes('<script'));
const cross=element('iframe');Object.defineProperty(cross,'contentDocument',{get(){throw Error('다른 출처');}});
const scope={querySelectorAll:q=>q==='iframe'?[cross]:[source]};
assert.equal(findFruitPreviewSource({querySelector:()=>scope},'#statusBar'),source);
source.getClientRects=()=>[];assert.equal(findFruitPreviewSource({querySelector:()=>scope},'#statusBar'),null);
{
    let reads=0;
    const cards=Array.from({length:300},(_,id)=>({id,closest:()=>null,getClientRects:()=>{reads++;return[{}];},checkVisibility:()=>true}));
    const chat={querySelectorAll:q=>q==='iframe'?[]:cards};
    assert.equal(findFruitPreviewSource({querySelector:()=>chat},'.card'),cards.at(-1));
    assert.equal(reads,1,'마지막 카드가 보이면 앞선 299개 카드의 배치를 읽지 않아요');
    cards.at(-1).checkVisibility=()=>false;reads=0;
    assert.equal(findFruitPreviewSource({querySelector:()=>chat},'.card'),cards.at(-2));assert.equal(reads,2);
    cards.pop();assert.equal(findFruitPreviewSource({querySelector:()=>chat},'.card'),cards.at(-1),'삭제된 마지막 항목을 다시 쓰지 않아요');
    const next={id:'다음 채팅',closest:()=>null,getClientRects:()=>[{}],checkVisibility:()=>true};
    assert.equal(findFruitPreviewSource({querySelector:()=>({querySelectorAll:q=>q==='iframe'?[]:[next]})},'.card'),next,'채팅을 바꾸면 새 뿌리에서 찾아요');
    assert.equal(findFruitPreviewSource({querySelector:()=>null},'.card'),null,'채팅이 없어지면 이전 항목을 재사용하지 않아요');
}
console.log('상태창 복제의 실행·외부주소 차단, 설정 덮어쓰기, 종류·출처·표시 경계를 확인했어요.');

assert(safePreviewStyleValue('url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200%20L1%201%22%2F%3E%3C%2Fsvg%3E")'));
assert(!safePreviewStyleValue('url("data:image/svg+xml,%3Csvg%20onload%3D%22alert(1)%22%3E%3C%2Fsvg%3E")'));
assert(!safePreviewStyleValue('url("https://invalid.invalid/x")'));

assert(copied.childNodes[0].getAttribute('src').startsWith('data:image/svg+xml,'));
assert.equal(host.getAttribute('data-bl-preview-unavailable-images'),'1');

const input=element('input',{onchange:'danger()'});input.type='range';input.value='25';input.checked=false;own(input);source.childNodes.push(input);
const password=element('input');password.type='password';password.value='복제하지 않는 검사값';own(password);source.childNodes.push(password);
copyFruitPreview(source,target);const controls=host.childNodes[0].childNodes.filter(n=>n.tagName==='INPUT');
assert.equal(controls[0].value,'25');assert.equal(controls[0].disabled,false);assert.equal(controls[0].inert,true);assert.equal(controls[0].getAttribute('onchange'),undefined);assert.equal(controls[1].value,undefined);assert.equal(controls[1].getAttribute('type'),'password');

const beforeStyle=doc.defaultView.getComputedStyle;
doc.defaultView.getComputedStyle=(...args)=>{const original=beforeStyle(...args),next=[...original,'font-family'];next.content=original.content;next.getPropertyValue=k=>k==='font-family'?'가상글꼴':original.getPropertyValue(k);return next;};
doc.fonts.add({status:'loaded',family:'가상글꼴'});target.fonts.add=()=>{throw new DOMException('CSS로 연결된 글꼴 검사','InvalidModificationError');};
assert(copyFruitPreview(source,target));assert.equal(host.getAttribute('data-bl-preview-unavailable-fonts'),'1');
