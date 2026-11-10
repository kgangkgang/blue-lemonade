import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(process.argv[2]||'.');
const {createSolaSkinController}=await import(pathToFileURL(path.join(root,'src/sola-skin.js')));
const {zeroSkips}=await import(pathToFileURL(path.join(root,'src/usage-mode.js')));
const {FRUIT_TYPES,tidyFruitType,fruitTypeCss}=await import(pathToFileURL(path.join(root,'src/fruit-type-schema.js')));
const {sampleInputs,sampleOutput,pickSampleChain}=await import(pathToFileURL(path.join(root,'src/fruit-type-sample.js')));
let passed=0;
async function test(name,fn){await fn();passed++;console.log('통과: '+name);}
function env(){
 const links=[],timers=new Map(),events=[],messages=[];let seq=0;
 const doc={createElement(){const link={dataset:{},isConnected:false,remove(){this.isConnected=false}};links.push(link);return link;},head:{append(link){link.isConnected=true}},dispatchEvent(event){events.push(event.type)}};
 const host={Event:class{constructor(type){this.type=type}},setTimeout(fn){timers.set(++seq,fn);return seq},clearTimeout(id){timers.delete(id)}};
 return{links,timers,events,messages,control:createSolaSkinController(doc,host,'https://example.invalid/sola-skin.css',text=>messages.push(text))};
}
await test('원작 상태에서는 스타일 노드를 만들지 않아요',async()=>{
 const e=env();assert.equal(await e.control.sync(false),false);assert.equal(e.links.length,0);assert.equal(e.timers.size,0);
});
await test('동시에 켜도 한 번만 읽고, 끄면 자신의 시트만 없애요',async()=>{
 const e=env(),a=e.control.sync(true),b=e.control.sync(true);assert.equal(a,b);assert.equal(e.links.length,1);
 e.links[0].onload();assert.equal(await a,true);assert.equal(e.timers.size,0);assert.deepEqual(e.events,['bl:sola-skin']);
 assert.equal(await e.control.sync(false),false);assert.equal(e.links[0].isConnected,false);assert.deepEqual(e.control.state(),{wanted:false,attached:false});
});
await test('읽는 중에 끄거나 다시 켜도 이전 응답이 스타일을 되살리지 않아요',async()=>{
 const e=env(),a=e.control.sync(true),late=e.links[0].onload;
 await e.control.sync(false);assert.equal(await a,false);
 const b=e.control.sync(true);late();assert.equal(e.links[0].isConnected,false);assert.equal(e.events.length,1);
 e.links[1].onload();assert.equal(await b,true);assert.equal(e.links[1].isConnected,true);
});
await test('실패한 시트를 남기지 않고 다음 선택에서 다시 읽어요',async()=>{
 const e=env(),a=e.control.sync(true);e.links[0].onerror();assert.equal(await a,false);assert.equal(e.messages.length,1);assert.equal(e.links[0].isConnected,false);
 const b=e.control.sync(true);assert.equal(e.links.length,2);e.links[1].onload();assert.equal(await b,true);
});
await test('응답 제한 시간과 외부에서 떼어진 시트도 복구해요',async()=>{
 const e=env(),a=e.control.sync(true);[...e.timers.values()][0]();assert.equal(await a,false);assert.equal(e.timers.size,0);
 const b=e.control.sync(true);e.links[1].onload();await b;e.links[1].remove();const c=e.control.sync(true);e.links[2].onload();assert.equal(await c,true);
});
await test('시트는 채팅·미리보기의 알려진 솔라 구조만 꾸미고 새 감시자는 만들지 않아요',()=>{
 const css=fs.readFileSync(path.join(root,'src/sola-skin.css'),'utf8'),js=fs.readFileSync(path.join(root,'src/sola-skin.js'),'utf8');
 assert.ok(css.includes('body.salty :is(#chat,.cg-root,.salty-preview) .mes_text'));
 assert.ok(css.includes('.sola-drawer,.custom-sola-drawer'));
 assert.ok(css.includes('.sola-tc,.custom-sola-tc'));
 assert.doesNotMatch(css,/\[class\s*\*=/);assert.doesNotMatch(js,/MutationObserver|setInterval|querySelectorAll/);
 assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b/i,'새 고정색 대신 팔레트 토큰을 써요');
 assert.equal(zeroSkips({enabled:true,usageMode:'zero'},'solaskin'),false);
});
await test('솔라 진행 속도와 본문 쪽지는 실제 태그 형식의 합성 표본을 써요',()=>{
 const tempo=FRUIT_TYPES.find(t=>t.id==='sola-tempo'),micro=FRUIT_TYPES.find(t=>t.id==='sola-micro');
 const rule={findRegex:'/<tempo>(STEADY|DRIVE|NEUTRAL)<\\/tempo>/g',replaceString:'<details class="sola-card-tempo"><summary>$1</summary></details>',placement:[2],disabled:false};
 assert.ok(sampleOutput(tempo,[{where:'합성 검사',list:[rule]}])?.document.includes('sola-card-tempo'));
 const input=sampleInputs(micro)[0];assert.match(input,/<tell note="[^"]+">/);assert.match(input,/<lore entry="[^"]+">/);assert.match(input,/<translate meaning="[^"]+">/);
});
await test('내 OOC 미리보기만 사용자 입력 위치를 읽고 일반 솔라 카드는 답변 위치를 읽어요',()=>{
 const type=FRUIT_TYPES.find(t=>t.id==='sola-user-ooc');
 const make=placement=>({findRegex:'/OOC/g',replaceString:'<details class="sola-card-user-ooc"></details>',placement:[placement],disabled:false});
 const user=make(1),ai=make(2);assert.deepEqual(pickSampleChain(type,[{where:'합성 검사',list:[user,ai]}]).chain,[user]);
 const ordinary=FRUIT_TYPES.find(t=>t.id==='sola-ooc');
 const rows=[user,ai].map(r=>({...r,replaceString:'<details class="sola-card-ooc"></details>'}));
 assert.deepEqual(pickSampleChain(ordinary,[{where:'합성 검사',list:rows}]).chain,[rows[1]]);
});
await test('편집기에서 처음 켜도 외부 설정 복원과 테마 끄기가 같은 적재 기록을 정리해요',async()=>{
 const source=fs.readFileSync(path.join(root,'src/features.js'),'utf8'),fn=source.match(/export function syncSolaStyle\(s\) \{[\s\S]*?\n\}/)?.[0];assert.ok(fn);
 const calls=[],modules={},load=(key)=>modules[key]??=(Promise.resolve({syncSolaSkin:async on=>{calls.push(on);return on;}}));
 const sync=new Function('load','modules',fn.replace('export ','')+';return syncSolaStyle;')(load,modules);
 await sync({enabled:true,chat:{solaStyle:'original'}});assert.deepEqual(calls,[]);assert.deepEqual(Object.keys(modules),[]);
 await sync({enabled:true,chat:{solaStyle:'lemon'}});await sync({enabled:true,chat:{solaStyle:'original'}});
 await sync({enabled:true,chat:{solaStyle:'lemon'}});await sync({enabled:false,chat:{solaStyle:'lemon'}});
 await sync({enabled:true,usageMode:'extensions',chat:{solaStyle:'lemon'}});assert.deepEqual(calls,[true,false,true,false,false]);
 const ui=fs.readFileSync(path.join(root,'src/fruit-type-ui.js'),'utf8');assert.ok(ui.includes("import {syncSolaStyle} from './features.js'"));assert.ok(!ui.includes("import('./sola-skin.js')"));
});
await test('새 면의 팔레트 잉크가 이전 대비 보정보다 우선하고 글자 설정은 스킨보다 우선해요',()=>{
 const lib=createRequire(import.meta.url)(path.join(root,'tools/css-lib.cjs'));
 const css=fs.readFileSync(path.join(root,'src/sola-skin.css'),'utf8'),problems=[];
 const rules=lib.flatRules(lib.parse(css,problems));assert.deepEqual(problems,[]);
 const ink=lib.spec('body.salty .bl-ink-1:not(#bl-ink-a):not(#bl-ink-b)');
 const badge=rules.find(r=>r.selector.includes('bl-sola-color')&&r.selector.includes('.sola-drawer-badge'));
 assert.ok(badge&&lib.cmpSpec(lib.spec(badge.selector),ink)>0,'옛 잉크 보정 때문에 제목 꼬리표가 다른 색으로 남지 않아요');
 const fontProps=/^(?:font(?:-|$)|line-height|letter-spacing|white-space|word-break|overflow-wrap|text-align)/;
 for(const rule of rules)if(rule.decls.some(d=>fontProps.test(d.lname)))assert.ok(lib.spec(rule.selector)[0]<2,'글자 편집기의 아이디 두 개보다 낮게 두어요');
 const config=tidyFruitType({on:true,ownerOn:{sola:true,deus:false,fruit:false}});
 config.types['sola-feeling'].regions.info.on=true;config.types['sola-feeling'].regions.info.size=22;
 // 1.1.1 restyle2: 안쪽 태그 :is(div,span,…) 는 태그마다 한 갈래로 적혀요(크롬 규칙 바구니) — 열 태그가 모두 주어로 있어야 해요
 {const css=fruitTypeCss(config);for(const tag of ['div','span','p','b','i','em','strong','li','dt','dd'])assert.ok(new RegExp(` ${tag}[,{]`).test(css), '솔라의 표 값과 단계 목록도 고른 본문 글자를 따라요: '+tag);}
});
console.log(`솔라 스타일 ${passed}개 검사를 마쳤어요.`);
