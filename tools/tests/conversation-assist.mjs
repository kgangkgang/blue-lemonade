import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const core=await import(pathToFileURL(path.join(root,'src/assist/core.js')));
const tests=[];
async function test(name,fn){try{await fn();tests.push({name,pass:true});}catch(e){tests.push({name,pass:false,error:e.message});}}
await test('diagnosis respects disabled standalone extension',()=>{assert.equal(core.knownConflicts(['third-party/chat-bookmarks'],[],{bookmarks:true}).length,1);assert.equal(core.knownConflicts(['third-party/chat-bookmarks'],['third-party/chat-bookmarks'],{bookmarks:true}).length,0);});
console.log(JSON.stringify({total:tests.length,passed:tests.filter(t=>t.pass).length,tests},null,2));
if(tests.some(t=>!t.pass))process.exitCode=1;
