import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {createTranslationProgress}=await import(pathToFileURL(path.resolve(process.argv[2]||'.','src/addons/prompt/translation-progress.js')));
let passed=0;function test(name,f){f();passed++;console.log('ok',name)}
test('mixed outcomes count once, snapshots are independent and unfinished rows stop once',()=>{
 const rows=Array.from({length:100},(_,i)=>({id:String(i),name:'Row '+i})),seen=[];
 const p=createTranslationProgress({targets:rows,ns:'pt-wi::test',part:'본문',write:(text,value)=>seen.push(value)});
 const states=['success','cached','failed','skipped'];
 for(let i=0;i<80;i++){p.settle(rows[i],states[i%4],'reason '+i);p.settle(rows[i],'success');}
 const earlier=seen.at(-1);assert.equal(earlier.failed,20);assert.equal(earlier.cached,20);assert.equal(earlier.success,20);assert.equal(earlier.skipped,20);
 earlier.failed=999;earlier.failures[0].reason='changed';const end=p.finish();assert.equal(end.failed,20);assert.equal(end.stopped,20);assert.equal(end.failures[0].reason,'reason 2');
 p.settle(rows[99],'success');assert.deepEqual(p.finish(),end);assert.equal(seen[0].cached,0);assert.equal(seen[0].failures.length,0);
});
test('outcomes use row identity and failures retain settlement order and current labels',()=>{
 const a={id:'same',name:'A'},b={id:'same',name:'B'},samples=[];const p=createTranslationProgress({targets:[a,b],ns:'test',part:'본문',write:(_,s)=>samples.push(s)});
 p.settle(b,'failed','second');p.settle(a,'failed','first');const original=samples.at(-1);b.name='Renamed';const end=p.finish();assert.equal(end.failed,2);assert.deepEqual(end.failures.map(x=>x.name),['Renamed','A']);assert.deepEqual(original.failures.map(x=>x.name),['B','A']);
});
test('thousands of cache hits do not repeatedly enumerate completed outcomes',()=>{
 const Native=globalThis.Map;let visits=0;globalThis.Map=class extends Native{*[Symbol.iterator](){for(const entry of super[Symbol.iterator]()){visits++;yield entry}}};
 try{const rows=Array.from({length:5000},(_,i)=>({id:String(i),name:'Cached'}));let writes=0;const p=createTranslationProgress({targets:rows,ns:'pt-preset::test',part:'본문',write:()=>writes++});for(const row of rows)p.settle(row,'cached');const result=p.finish();assert.equal(result.cached,5000);assert.equal(writes,5002);assert.ok(visits<20000,`completed rows revisited ${visits} times`);}finally{globalThis.Map=Native}
});
test('parallel active work and stopping preserve finished counts',()=>{
 const rows=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],texts=[];let stop=false;const p=createTranslationProgress({targets:rows,ns:'pt-persona::test',part:'본문',write:t=>texts.push(t),isStopped:()=>stop});
 const a=p.start([rows[0]]),b=p.start([rows[1]]);p.settle(rows[0],'success');p.end(a);assert.ok(texts.at(-1).includes('B 번역 중'));stop=true;p.stopping();assert.ok(texts.at(-1).includes('중단 중'));p.end(b);const result=p.finish();assert.equal(result.success,1);assert.equal(result.stopped,2);assert.equal(result.failed,0);
});
console.log(`prompt progress counts: ${passed} passed`);
