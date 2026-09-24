import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {forEachLimited}=await import(new URL('src/addons/prompt/cache-loading.js',root));
let active=0,peak=0;const visits=[];
await forEachLimited(Array.from({length:57},(_,i)=>i),4,async(value,index)=>{
 active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));visits.push([value,index]);active--;
});
assert.equal(peak,4);assert.equal(active,0);assert.equal(new Set(visits.map(v=>v[0])).size,57);assert(visits.every(([value,index])=>value===index));
let called=false;await forEachLimited([],4,()=>{called=true;});assert.equal(called,false);
await assert.rejects(forEachLimited([1,2,3],2,async value=>{if(value===2)throw Error('unreadable cache');}),/unreadable cache/);
console.log('PASS 57 cache shards, at most 4 requests, exactly once, empty cache and failure propagation');
