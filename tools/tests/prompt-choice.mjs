import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const { promptChoiceGroups, preparePromptChoice } = await import(pathToFileURL(path.join(root, 'src/prompt-choice-core.js')));
const { bindPromptChoices } = await import(pathToFileURL(path.join(root, 'src/prompt-choice.js')));
const prompts = [
    ['pace','🔻PICK: PACING🔻'], ['slow','「 Slow 」'], ['fast','「 Fast 」'],
    ['regular','| 일반 규칙 |'], ['tense','🔻택1: 시제🔻'], ['past','「 과거 」'], ['present','「 현재 」'],
    ['sep','구분선'], ['a','언어 가'], ['b','언어 나'], ['unused','미연결 항목'],
].map(([identifier,name]) => ({identifier,name,content:'원문을 보존해요'}));
const fresh = () => prompts.filter(p => p.identifier !== 'unused').map(p => ({identifier:p.identifier,enabled:['slow','past','regular','a'].includes(p.identifier)}));
const meta = { version:1, groups:[{id:'language',ids:['a','b','unused','b']}] };
let total=0;
const check = (name, run) => { run(); total++; console.log('통과: '+name); };
check('헤더 경계와 미연결 항목을 구분해요', () => assert.deepEqual(promptChoiceGroups(prompts,fresh(),meta).map(g=>g.ids),[['slow','fast'],['past','present'],['a','b']]));
check('같은 묶음의 이전 선택만 꺼요', () => {const o=fresh(); assert.deepEqual(preparePromptChoice(prompts,o,meta,'fast'),['slow']);assert.equal(o.find(e=>e.identifier==='past').enabled,true);assert.equal(o.find(e=>e.identifier==='regular').enabled,true);assert.equal(o.find(e=>e.identifier==='fast').enabled,false);});
check('선택을 끌 때 다른 항목을 바꾸지 않아요', () => {const o=fresh(), before=JSON.stringify(o);assert.deepEqual(preparePromptChoice(prompts,o,meta,'slow'),[]);assert.equal(JSON.stringify(o),before);});
check('명시 언어 묶음에도 같은 규칙을 적용해요', () => assert.deepEqual(preparePromptChoice(prompts,fresh(),meta,'b'),['a']));
check('일반 프롬프트와 없는 항목은 건드리지 않아요', () => {const o=fresh(),before=JSON.stringify(o);for(const id of ['regular','absent','unused'])assert.deepEqual(preparePromptChoice(prompts,o,meta,id),[]);assert.equal(JSON.stringify(o),before);});
check('버전을 모르는 메타데이터는 무시해요', () => assert.deepEqual(preparePromptChoice(prompts,fresh(),{...meta,version:99},'b'),[]));
check('프롬프트 원문은 그대로예요', () => {const before=JSON.stringify(prompts);preparePromptChoice(prompts,fresh(),meta,'fast');assert.equal(JSON.stringify(prompts),before);});
check('클릭은 호스트 토글과 한 번의 저장으로 끝나요', () => {
    const order=fresh(), counts={slow:99}, listeners=new Map();let saves=0;
    const doc={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(listeners.get(name),fn);listeners.delete(name);}};
    const manager={containerElement:{contains:()=>true},activeCharacter:{id:1},serviceSettings:{prompts,extensions:{blPromptChoices:meta}},getPromptOrderForCharacter:()=>order,getTokenHandler:()=>({getCounts:()=>counts})};
    const off=bindPromptChoices(doc,()=>manager);
    const toggle={closest:()=>({dataset:{pmIdentifier:'fast'}})};
    listeners.get('click')({target:{closest:()=>toggle}});
    order.find(e=>e.identifier==='fast').enabled=true;saves++;
    assert.equal(order.find(e=>e.identifier==='slow').enabled,false);assert.equal(counts.slow,null);assert.equal(saves,1);
    off();assert.equal(listeners.size,0);
});
check('다른 창의 같은 클래스는 무시해요', () => {
    let handler;const order=fresh(),before=JSON.stringify(order);
    const off=bindPromptChoices({addEventListener:(n,fn)=>handler=fn,removeEventListener:()=>{}},()=>({containerElement:{contains:()=>false}}));
    handler({target:{closest:()=>({})}});assert.equal(JSON.stringify(order),before);off();
});
console.log('택1 검사 '+total+'개를 통과했어요.');
