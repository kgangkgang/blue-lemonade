import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {segmentParagraphs,translateSegments,clearSegmentCache,batchPayload,parseBatchResult,batchGroups,restoreParagraphBreaks}=await import(new URL('src/addons/translator/translation-segments.js',root));
let calls=[],config='model-A';
const go=(text,extra={})=>translateSegments({parts:segmentParagraphs(text),signature:()=>config,request:async bodies=>{calls.push([...bodies]);return bodies.map(body=>'번역('+body+')');},...extra});
await clearSegmentCache();
assert.equal((await go('A\n\nB\n\nC')).translated,3);assert.deepEqual(calls,[['A','B','C']]);
calls=[];let edited=await go('A\n\nB edited\n\nC edited');assert.deepEqual(calls,[['B edited','C edited']]);assert.equal(edited.reused,1);assert.equal(edited.text,'번역(A)\n\n번역(B edited)\n\n번역(C edited)');
calls=[];await go('C\n\nA\n\nC');assert.equal(calls.length,0);
calls=[];await go('C\n\nNew\n\nA');assert.deepEqual(calls,[['New']]);
config='model-B';calls=[];await go('A\n\nC');assert.deepEqual(calls,[['A','C']]);
assert.equal(segmentParagraphs('<div>one\n\ntwo</div>'),null);assert.equal(segmentParagraphs('```a\n\nb```'),null);
assert.deepEqual(segmentParagraphs('a\r\n \r\nb'),['a','\r\n \r\n','b']);
calls=[];await go('[[__VAR_0__]]\n\nA');assert.deepEqual(calls,[]);
let blocked=await go('blocked',{request:async()=>{throw Object.assign(Error('blocked'),{refused:true});},blockedMarker:'BLOCKED'});assert.equal(blocked.blocked,1);calls=[];await go('blocked');assert.equal(calls.length,1);
await assert.rejects(go('failed',{request:async()=>{throw Error('network');}}));calls=[];await go('failed');assert.equal(calls.length,1);
await assert.rejects(go('cancelled',{check:()=>{throw Object.assign(Error('cancelled'),{cancelled:true});}}));
await assert.rejects(go('bad1\n\nbad2',{request:async()=>['only one']}));calls=[];await go('bad1\n\nbad2');assert.deepEqual(calls,[['bad1','bad2']]);
await clearSegmentCache();calls=[];await go('A\n\nA');assert.deepEqual(calls,[['A']]);
assert.equal(segmentParagraphs('<span>one\n\ntwo</span>'),null);assert(segmentParagraphs('<span>one</span>\n\n<span>two</span>'));
assert.deepEqual(parseBatchResult('⟦1⟧ second\n\n⟦0⟧ first',2),['first','second']);
for(const raw of ['no markers','','⟦0⟧ a\n⟦0⟧ b','⟦0⟧ a\n⟦3⟧ b','⟦0⟧ a\n⟦1⟧ ','⟦0⟧ a'])assert.throws(()=>parseBatchResult(raw,2));
assert.deepEqual(parseBatchResult('```\n⟦0⟧ ok\n```',1),['ok']);assert.deepEqual(parseBatchResult('Here it is:\n⟦0⟧: first line\nsecond line\n\n⟦1⟧ two',2),['first line\nsecond line','two']);assert.deepEqual(parseBatchResult('【0】 a\n【1】 b',2),['a','b']);assert.throws(()=>parseBatchResult('⟦0⟧ a\n【1】 b',2));assert.deepEqual(parseBatchResult('⟦1⟧ a\r\n⟦2⟧ b',2),['a','b']);assert.deepEqual(parseBatchResult('⟦0⟧\n    indented\n⟦1⟧ x',2),['    indented','x']);
assert.ok(batchPayload(['a\n"b"','c']).endsWith('⟦0⟧ a\n"b"\n\n⟦1⟧ c'));assert.ok(!batchPayload(['x']).includes('JSON'));
console.log('PASS first batch 1 request, multiple edits 1 request, reuse 0 requests; reorder/insert/delete/dedup; strict IDs and atomic validation; failures/cancel/clear');

assert.deepEqual(batchGroups(['aa','bb','cc'],4),[['aa','bb'],['cc']]);
assert.deepEqual(batchGroups(['longer-than-limit','a'],2),[['longer-than-limit'],['a']]);

// 묶음 하나만 실패(null)하면 성공한 문단은 붙이고 캐시에 넣는다; null 자리만 차단 표시. 다시 번역하면 그 문단만 보낸다
await clearSegmentCache();calls=[];const mixed=await go('P\n\nQ',{request:async bodies=>['번역('+bodies[0]+')',null],blockedMarker:'BLOCKED'});
assert.equal(mixed.translated,1);assert.equal(mixed.blocked,1);assert.equal(mixed.text,'번역(P)\n\nBLOCKED\nQ');calls=[];await go('P\n\nQ');assert.deepEqual(calls,[['Q']]);
await assert.rejects(go('R\n\nS',{request:async()=>['ok',null]}));
// <think> 블록 · 앞뒤 설명문 · 숫자 문자열 id 도 읽는다 (개수 · 번호 검사는 그대로)
assert.deepEqual(parseBatchResult('<think>plan ⟦9⟧</think>Sure, here it is:\n⟦1⟧ b\n⟦0⟧ a',2),['a','b']);
assert.throws(()=>parseBatchResult('<think>x</think>⟦0⟧ a',2));
console.log('PASS partial batch failure keeps successful paragraphs; tolerant batch parsing');
// 5.2.4: 통짜 경로에서 빠진 문단 빈 줄 되살리기 — 문단 수 == 줄 수일 때만
assert.equal(restoreParagraphBreaks('깡통이 말했다.\n\n블루레몬에이드 최고.','A.\nB.'),'A.\n\nB.');
assert.equal(restoreParagraphBreaks('a\n\nb\n\nc','1\n2\n3'),'1\n\n2\n\n3');
assert.equal(restoreParagraphBreaks('a\n\nb','1\n\n2'),'1\n\n2');
assert.equal(restoreParagraphBreaks('a\nb','1\n2'),'1\n2');
assert.equal(restoreParagraphBreaks('a\n\nb','1\n2\n3'),'1\n2\n3');
assert.equal(restoreParagraphBreaks('a\n\nb','12'),'12');
console.log('PASS paragraph breaks restored only when paragraph and line counts match');
// 5.6.2: 원문 병기 보기(접기 · 원문 먼저 · 펼침)의 블록 마크다운 — 줄 머리 표시는 감싸개 밖으로, 구조 줄(가로줄 · 표 · 인용 속 빈 줄)은 감싸지 않는다
const {splitBlockPrefix,structureLines,paragraphBlocks,isHeadingUnderline,isBareQuote}=await import(new URL('src/addons/translator/translation-segments.js',root));
const pre=(line,options)=>{const r=splitBlockPrefix(line,options);return [r.prefix,r.body,r.list];};
assert.deepEqual(pre('# 제목'),['# ','제목',false]);assert.deepEqual(pre('### 상태'),['### ','상태',false]);assert.deepEqual(pre('#해시'),['#','해시',false]);
assert.deepEqual(pre('## 제목 ##'),['## ','제목',false]);assert.deepEqual(pre('# 가#나'),['# ','가#나',false]);
assert.deepEqual(pre('> 인용'),['> ','인용',false]);assert.deepEqual(pre('>> 겹 인용'),['>> ','겹 인용',false]);assert.equal(splitBlockPrefix('> 인용').quote,'> ');
assert.deepEqual(pre('> # 인용 속 제목'),['> # ','인용 속 제목',false]);assert.deepEqual(pre('>  # 두 칸 뒤'),['> ',' # 두 칸 뒤',false]);
assert.deepEqual(pre('- 항목'),['- ','항목',true]);assert.deepEqual(pre('+ 항목'),['+ ','항목',true]);assert.deepEqual(pre('* 항목'),['* ','항목',true]);
assert.deepEqual(pre('12. 단계'),['12. ','단계',true]);assert.deepEqual(pre('  - 안쪽 항목'),['  - ','안쪽 항목',true]);
assert.deepEqual(pre('> - 인용 속 항목'),['> - ','인용 속 항목',true]);assert.deepEqual(pre('> - 인용 속 항목',{list:false}),['> ','- 인용 속 항목',false]);
assert.deepEqual(pre('- 항목',{list:false}),['','- 항목',false]);
// 목록 표시 뒤의 # 는 제목이 아니다 (붙여 쓴 목록 항목 안에서는 마크다운이 제목으로 보지 않는다), 0열이 아닌 # 도 제목이 아니다
assert.deepEqual(pre('- ## 목록 속 제목'),['- ','## 목록 속 제목',true]);
// 열린 목록 안: 4칸 · 탭으로 들여쓴 표시도 하위 목록, 빈 줄 다음의 들여쓴 줄은 항목에 딸린 문단 (앞 공백이 prefix)
assert.deepEqual(pre('    - 하위',{open:true}),['    - ','하위',true]);assert.deepEqual(pre('\t1. 하위',{open:true}),['\t1. ','하위',true]);
assert.deepEqual(pre('  딸린 문단',{open:true,continued:true}),['  ','딸린 문단',false]);assert.equal(splitBlockPrefix('  딸린 문단',{open:true,continued:true}).indent,true);
assert.deepEqual(pre('  딸린 문단',{open:true}),['','  딸린 문단',false]);assert.deepEqual(pre('딸리지 않은 줄',{open:true,continued:true}),['','딸리지 않은 줄',false]);
for(const plain of ['*기울임* 글','**굵게** 글','-붙은 글','1) 괄호 번호','— 줄표 대사','    - 깊은 들여쓰기',' # 한 칸 뒤 제목 아님','   ## 세 칸 뒤','####### 일곱','#','# ','>','> ','- ','','보통 글 # 뒤쪽 표시','"대사"'])assert.deepEqual(pre(plain),['',plain,false],plain);
const marks=lines=>[...structureLines(lines)].sort((a,b)=>a-b);
assert.deepEqual(marks(['글','---','','***','| a | b |','|---|---|','| 1 | 2 |','','```','---','| x | y |','|--|--|','```','끝']),[1,3,4,5,6]);
assert.deepEqual(marks(['제목','=====','- - -','___','--','-- 글','== 글','* * 글']),[1,2,3,4]);
assert.deepEqual(marks(['| 머리만 | 있고 |','구분 줄 없음','','a | b','--|--','1 | 2','끝까지 표','','글']),[3,4,5,6]);
assert.deepEqual(marks(['| a | b |','|---|---|','```','code','```']),[0,1]);assert.deepEqual(marks([]),[]);
// 한 칸짜리 표, 표시만 있는 인용 줄
assert.deepEqual(marks(['| 상태창 |','|---|','| 내용 |','| 둘째 |','표 아님','','글']),[0,1,2,3]);assert.deepEqual(marks(['| 한 줄 |','글']),[]);
assert.deepEqual(marks(['> 첫 문단','>','> 둘째 문단','> ','>>']),[1,3,4]);
assert.ok(isHeadingUnderline('---')&&isHeadingUnderline('==  ')&&!isHeadingUnderline('- - -')&&!isHeadingUnderline('***'));assert.ok(isBareQuote('>')&&isBareQuote(' > ')&&!isBareQuote('> 글'));
assert.equal(paragraphBlocks('a\n\nb\nc\n \n\nd'),'<p>a</p><p>b<br>c</p><p>d</p>');
assert.equal(paragraphBlocks(''),'');assert.equal(paragraphBlocks('\n\n한 문단\n\n'),'<p>한 문단</p>');
console.log('PASS block markdown prefixes stay outside the fold wrappers; rules, tables and bare quote lines are left unwrapped; whole-message fold uses paragraphs');
