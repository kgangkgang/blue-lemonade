import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const S=await import(pathToFileURL(path.join(root,'src/addons/translator/translation-segments.js')));
const C=await import(pathToFileURL(path.join(root,'src/addons/translator/translation-check.js')));
const source='She played the bass.';
const output='그녀는 베이스를 연주했다.[1]\n\n역주:\n[1] 여기서 bass는 악기를 뜻한다.';
test('linked numbered translator note survives trailing-note cleanup',()=>{assert.equal(S.stripTrailingNote(output,source),output);});
test('footnote number is not mistaken for the next numbered passage',()=>{
 const raw=`⟦0⟧ ${output}\n\n⟦1⟧ 그는 고개를 끄덕였다.`;
 assert.deepEqual(S.parseBatchResult(raw,2,{},[source,'He nodded.']),[output,'그는 고개를 끄덕였다.']);
 assert.deepEqual(S.streamedPassages(raw,2,[source,'He nodded.']),[output]);
});
test('legitimate note explanation survives planning/echo/stray-word cleanup',()=>{
 const note='그녀는 베이스를 연주했다.[1]\n\n역주:\n[1] bass → 베이스. The translation uses the musical meaning; the tone is informal.';
 for(const fn of [S.stripPlanningNotes,S.stripDraftLeaks,S.dropStrayWords])assert.equal(fn(note,source),note);
 assert.equal(S.removeSourceEcho(source,note),note);assert.equal(S.hasSourceEcho(source,note),false);
});
test('unrequested processing note and thinking blocks are still removed',()=>{
 assert.equal(S.stripTrailingNote('그녀는 연주했다.\n\nTranslator note: I kept the placeholders.',source),'그녀는 연주했다.');
 assert.equal(S.stripDraftLeaks('<think>I will translate this.</think>그녀는 연주했다.',source),'그녀는 연주했다.');
});
test('quality checker treats referenced note as part of its parent passage',()=>{
 const text=output+'\n\n그는 고개를 끄덕였다.';
 const paragraphs=C.paragraphSlices(text);assert.equal(paragraphs.length,2);assert.ok(paragraphs[0].body.includes('악기를 뜻한다.'));
});
test('markdown footnotes and multiple adjacent numbered notes keep their references',()=>{
 const markdown='첫 문장.[^term]\n\n[^term]: 단어의 뜻이다.\n\n다음 문장.';
 assert.equal(S.stripTrailingNote(markdown,'First.\n\nNext.'),markdown);assert.equal(C.paragraphSlices(markdown).length,2);
 const multi='본문.[1][2]\n\n**역주:**\n\n[1] 첫 설명.\n\n[2] 둘째 설명.';
 assert.equal(S.stripReplyWrapping(multi,'Text.'),multi);assert.equal(C.paragraphSlices(multi).length,1);
});
test('each passage can use local note number one without colliding with batch numbering',()=>{
 const second='그는 연주를 멈췄다.[1]\n\n역주:\n[1] 두 번째 문단의 별도 설명.';
 assert.deepEqual(S.parseBatchResult(`⟦0⟧ ${output}\n\n⟦1⟧ ${second}`,2,{},[source,'He stopped.']),[output,second]);
});
test('square legacy passage markers still work around referenced notes',()=>{
 assert.deepEqual(S.parseBatchResult(`[0] ${output}\n\n[1] 다음 문장.`,2,{},[source,'Next.']),[output,'다음 문장.']);
});
test('unlinked annotations, code examples and unrelated analysis do not gain protection',()=>{
 const unlinked='본문.\n\n역주:\n[7] 번역을 이렇게 처리했습니다.';assert.equal(S.stripTrailingNote(unlinked,'Text.'),'본문.');
 const code='```text\n본문.[1]\n역주:\n[1] 예시\n```';assert.equal(S.maskTranslatorNotes(code).changed,false);
 assert.equal(S.stripTrailingNote(output+'\n\nTranslator note: I used placeholders.',source),output);
});
test('segment cache round-trip keeps notes without a second model request',async()=>{
 await S.clearSegmentCache();let calls=0;
 const opts={parts:[source],signature:()=> 'footnote-test',request:async()=>{calls++;return[output]}};
 assert.equal((await S.translateSegments(opts)).text,output);assert.equal((await S.translateSegments(opts)).text,output);assert.equal(calls,1);
});
test('display failure falls back to the complete translation, never annotation placeholders',()=>{
 const sourceCode=fs.readFileSync(path.join(root,'src/addons/translator/index.js'),'utf8'),start=sourceCode.indexOf('export function processTranslationText('),end=sourceCode.indexOf('\n// ============================================================================',start);
 const fn=new Function('extensionSettings','maskTranslatorNotes','withDisplayCardsProtected','splitCrossLineEmphasis','correctBackticks','console','window',sourceCode.slice(start,end).replace('export ','')+';return processTranslationText;')({translation_display_mode:'folded'},S.maskTranslatorNotes,()=>{throw Error('render failure')},x=>x,x=>x,{error(){}},{});
 assert.equal(fn(source,output),output);
});

// 3.0.5: a [n]-labelled reply (no ⟦ or 【) keeps its passage labels even when a body cites [1]
test('square passage labels after a literal citation are passages, not footnote definitions',()=>{
 const raw='[0]: 첫 문단 참고 [1] 입니다.\n\n[1]: 둘째 문단이에요.\n\n[2]: 셋째 문단이에요.';
 assert.deepEqual(S.parseBatchResult(raw,3,{},['First [1].','Second.','Third.']),['첫 문단 참고 [1] 입니다.','둘째 문단이에요.','셋째 문단이에요.']);
 const headed='[0] '+output+'\n\n[1] 다음 문장.';
 assert.deepEqual(S.parseBatchResult(headed,2,{},[source,'Next.']),[output,'다음 문장.']);
 const markdown='[0]: 첫 문장.[^a]\n\n[^a]: 뜻풀이.\n\n[1]: 다음 문장.';
 assert.deepEqual(S.parseBatchResult(markdown,2,{},['First.','Next.']),['첫 문장.[^a]\n\n[^a]: 뜻풀이.','다음 문장.']);
});
test('a reference at the start of a paragraph counts as a reference',()=>{
 const text='[1] 문장 앞 참조\n\n[1]: 설명';
 assert.equal(S.stripTrailingNote(text,'Text.'),text);
 assert.equal(S.maskTranslatorNotes(text).changed,true);
});
test('many definitions with one stray label are scanned once',()=>{
 const refs=Array.from({length:6000},(_,i)=>`[${i+1}]`).join(' ');
 const defs=Array.from({length:6000},(_,i)=>`[${i+1}]: 설명 ${i+1}`).join('\n');
 const text=`본문 ${refs}\n\n역주:\n${defs}\n[9999]: 참조 없는 정의`;
 const started=performance.now();const ranges=S.maskTranslatorNotes(text);const elapsed=performance.now()-started;
 assert.equal(ranges.changed,false);assert.ok(elapsed<800,`took ${elapsed}ms`);
});
