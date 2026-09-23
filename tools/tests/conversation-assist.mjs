import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const core=await import(pathToFileURL(path.join(root,'src/assist/core.js')));
const tests=[];
async function test(name,fn){try{await fn();tests.push({name,pass:true});}catch(e){tests.push({name,pass:false,error:e.message});}}
await test('unique offsets preserve whitespace and Unicode',()=>{const s='앞\n\n😀 한글\t문장\n\n뒤';const p=core.uniqueSpan(s,'😀 한글 문장');assert.equal(s.slice(p.start,p.end),'😀 한글\t문장');assert.equal(core.replaceSpan(s,p,'새 문장'),'앞\n\n새 문장\n\n뒤');});
await test('repeated or absent selection fails closed',()=>{assert.equal(core.uniqueSpan('같음 / 같음','같음'),null);assert.equal(core.uniqueSpan('본문','없음'),null);});
await test('partial selection expands only to enclosing paragraphs',()=>{const s='첫 문단\n\n두 번째 문단.\n\n세 번째.';const span=core.paragraphSpan(s,'번째 문단');assert.equal(s.slice(span.start,span.end),'두 번째 문단.');assert.equal(core.replaceSpan(s,span,'새 문단'),'첫 문단\n\n새 문단\n\n세 번째.');});
await test('multi paragraph boundaries and start/end',()=>{const s='a\n\nb\n\nc';assert.deepEqual(core.paragraphSpan(s,'a'),{start:0,end:1});assert.deepEqual(core.paragraphSpan(s,'b\n\nc'),{start:3,end:7});});
await test('alignment indices reject ambiguity, gaps and hallucination',()=>{const b=['甲','乙','丙'];assert.equal(core.alignedParagraphs({ids:[0,1],uncertain:false},b),'甲\n\n乙');for(const ids of [[],[-1],[3],[0,2],[1,1],['0']])assert.throws(()=>core.alignedParagraphs({ids,uncertain:false},b));assert.throws(()=>core.alignedParagraphs({ids:[0],uncertain:true},b));});
await test('taste does not activate proposals or another chat rules',()=>{const rules=[{text:'accepted',accepted:true,scope:'chat',chatKey:'a'},{text:'proposal',accepted:false,scope:'all'},{text:'other',accepted:true,scope:'chat',chatKey:'b'}];assert.match(core.tastePrompt(rules,'a'),/accepted/);assert.doesNotMatch(core.tastePrompt(rules,'a'),/proposal|other/);assert.equal(core.tastePrompt(rules,'c'),'');});
await test('AI evidence is restricted to submitted examples',()=>{const [r]=core.cleanRules({rules:[{text:'test',evidence:['real','invented']}]},['real']);assert.deepEqual(r.evidence,['real']);assert.equal(r.accepted,false);assert.equal(r.scope,'chat');});
await test('diagnosis respects disabled standalone extension',()=>{assert.equal(core.knownConflicts(['third-party/chat-bookmarks'],[],{bookmarks:true}).length,1);assert.equal(core.knownConflicts(['third-party/chat-bookmarks'],['third-party/chat-bookmarks'],{bookmarks:true}).length,0);});
await test('prompt matching does not invent exclusions',()=>{assert.equal(core.matchInPrompt('abc','other'),false);assert.equal(core.matchInPrompt('a\n b','a b'),true);assert.equal(core.matchInPrompt('','anything'),false);assert.equal(core.promptText([{content:[{type:'text',text:'safe'},{type:'image_url',image_url:{url:'SECRET'}}]}]),'safe');});
await test('HTML and malformed JSON remain data',()=>{assert.equal(core.esc('<script>"&'), '&lt;script&gt;&quot;&amp;');assert.throws(()=>core.jsonAnswer('not JSON'));assert.deepEqual(core.jsonAnswer('```json\n{"ids":[0]}\n```'),{ids:[0]});});
console.log(JSON.stringify({total:tests.length,passed:tests.filter(t=>t.pass).length,tests},null,2));
if(tests.some(t=>!t.pass))process.exitCode=1;
