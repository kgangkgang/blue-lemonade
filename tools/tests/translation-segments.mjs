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
// 2026-10-06 줄을 넘는 강조: 같은 문단 안 짝만 줄마다 닫고 다시 연다 (함께 보기에서 기울임이 사라지던 것)
{
const {splitCrossLineEmphasis:em}=await import(new URL('src/addons/translator/translation-segments.js',root));
assert.equal(em('*a\nb*'),'*a*\n*b*');
assert.equal(em('*가\n나\n다*'),'*가*\n*나*\n*다*');
assert.equal(em('"Hi," *she says,\nwaving.* "Bye."'),'"Hi," *she says,*\n*waving.* "Bye."');
assert.equal(em('**굵게 시작  \n굵게 끝**'),'**굵게 시작**  \n**굵게 끝**');
assert.equal(em('**bold *it\nstill* bold**'),'**bold *it***\n***still* bold**');
assert.equal(em('> *a\n> b*'),'> *a*\n> *b*');
for(const same of ['5 * 3 = 15\nnext line*','* item\n* item2','*a\n\nb*','```\n*a\nb*\n```','*a <span>x</span>\nb*','`*a` b\nc*','\\*a\nb*','*one* two\nthree','plain\ntext'])assert.equal(em(same),same,same);
console.log('PASS cross-line emphasis is closed and reopened per line inside one paragraph only');
}
{
const {dropStrayWords}=await import(new URL('src/addons/translator/translation-segments.js',root));
// 6.2.4 사용자 10-13 실제 사례: 영어 원문에는 없고 한국어 번역에만 「Valladolid」 한 줄
const src='The right shoe still clings to her other foot, glossy and guilty.\n\nThe floor indicator glows 7, then 6, then 5.';
assert.equal(dropStrayWords('오른쪽 구두만 다른 쪽 발에 매달려 있었다.\n\nValladolid\n층수 표시등에 7, 6, 그리고 5가 차례로 켜졌다.',src),'오른쪽 구두만 다른 쪽 발에 매달려 있었다.\n\n층수 표시등에 7, 6, 그리고 5가 차례로 켜졌다.');
assert.equal(dropStrayWords('가나다.\n\nValladolid\n\n라마바.','A.\n\nB.'),'가나다.\n\n라마바.','빈 줄 사이에 혼자 있으면 빈 줄 하나도 같이 — 문단 수 그대로');
assert.equal(dropStrayWords('가나다.\nValladolid','A.'),'가나다.');
for(const [t,s] of [['가나다.\n\nEXIT\n\n라마바.','A sign: exit.'],['가나다.\n\nEXIT\n\n라마바.','看板「ＥＸＩＴ」'],['가나다.\n\nLionel\n\n라마바.','ライオネル (Lionel)']])assert.equal(dropStrayWords(t,s),t,'원문에 있는 낱말은 그대로');
assert.equal(dropStrayWords('He waits.\n\nSilence\n\nThen 그.','彼は待つ。'),'He waits.\n\nSilence\n\nThen 그.','영어로 옮긴 글은 손대지 않는다');
for(const t of ['가나다.\n\nHello.\n라마바','가나다.\n\nNew York\n라마바','가나다\n「Valladolid」\n라마바','가나다\n**Valladolid**\n라마바','가나다\nA\n라마바','가나다\n[[__VAR_0__]]\n라마바'])assert.equal(dropStrayWords(t,'x'),t,t);
assert.equal(dropStrayWords('Valladolid','x'),'Valladolid');assert.equal(dropStrayWords('',''),'');assert.equal(dropStrayWords(null,null),'');
// 맨 앞 · 맨 끝 줄이면 남는 빈 줄도 (접어 보기에서 문단 사이 틈이 하나 더 생기지 않게)
assert.equal(dropStrayWords('Valladolid\n\n가나다 라마바 사아자.','A.'),'가나다 라마바 사아자.');
assert.equal(dropStrayWords('가나다 라마바 사아자.\n\nValladolid','A.'),'가나다 라마바 사아자.');
assert.equal(dropStrayWords('Valladolid\n가나다 라마바.','A.'),'가나다 라마바.');
// CRLF · NBSP 로 둘러싸인 줄도
assert.equal(dropStrayWords('가나다 라마바.\r\nValladolid\r\n사아자 차카타.','A.'),'가나다 라마바.\r\n사아자 차카타.');
assert.equal(dropStrayWords('가나다 라마바.\n\u00a0Valladolid\u00a0\n사아자 차카타.','A.'),'가나다 라마바.\n사아자 차카타.');
// ’ · 늘인 감탄사 · 소프트 하이픈 · 전각은 같은 낱말로 본다
for(const [t,s] of [['가나다 라마바.\nDon’t\n사아자.',"She said don't."],['가나다 라마바.\nHmmm\n사아자.','Hmm.'],['가나다 라마바.\nHmm\n사아자.','Hmmmmm...'],['가나다 라마바.\nValladolid\n사아자.','Valla\u00addolid'],['가나다 라마바.\nEXIT\n사아자.','ＥＸＩＴ']])assert.equal(dropStrayWords(t,s),t,t);
// 코드 울타리 안은 보지 않는다
for(const t of ['가나다 라마바 사아자.\n```\nreturn\n```\n차카타.','가나다 라마바 사아자.\n~~~\nexport\n~~~'])assert.equal(dropStrayWords(t,'x'),t,t);
// 꾸밈 태그는 언어 판정에 세지 않는다
assert.equal(dropStrayWords('<font color="#aabbcc">가나다 라마바</font>\nValladolid\n<span style="color:#123456">사아자</span>','A.'),'<font color="#aabbcc">가나다 라마바</font>\n<span style="color:#123456">사아자</span>');
const idx=(await import('node:fs')).readFileSync(new URL('src/addons/translator/index.js',root),'utf8');
assert.ok(/translation = await translate\(originalText,[^\n]*\n[^\n]*\} finally \{\n[^\n]*badge\.remove\(\);\n[^\n]*\}\n[\t ]*translation = dropStrayWords\(translation, originalText\);/.test(idx),'새 번역은 캐시에 넣기 전에 걷는다');
assert.ok(/retranslation = dropStrayWords\(retranslation, originalText\);[^\n]*\n[\s\S]{0,600}storeTranslationQuietly\(originalText, retranslation\)/.test(idx),'다시 번역도 캐시에 넣기 전에');
assert.ok(/if \(cachedTranslation && !editedByHand\) translation = tidyGlossaryOutput\(originalText, dropStrayWords\(translation, originalText\)\);/.test(idx),'캐시에서 온 옛 번역도 (손으로 고친 것 빼고) · 6.4.0 용어집 이름까지');
assert.ok(/extra\.translation_edited === extra\.original_text_hash \? shown : tidyGlossaryOutput\(original, dropStrayWords\(shown, original\)\)/.test(idx),'보여 줄 때 고치기 — 손으로 고친 번역은 그대로 · 6.4.0 용어집 이름까지');
assert.ok(/addTranslationToDB\(originalTextForDbKey, newText\);\n[\t ]*message\.extra\.translation_edited = originalHashOf\(originalTextForDbKey\);/.test(idx),'손으로 고치면 표시');
assert.ok(/translation_edited === originalHashOf\(originalText\) \? cached : tidyGlossaryOutput\(originalText, dropStrayWords\(cached, originalText\)\)/.test(idx),'교정 · 수정 창에 들어가는 캐시 번역도 · 6.4.0 용어집 이름까지');
assert.ok(/return dropStrayWords\(translatedText, textToTranslate\);/.test(idx),'/llmTranslate (북마크 번역)');
assert.ok(/processTranslationText\(originalTextForDbKey, newText\)/.test(idx),'손으로 고친 글은 그대로 보인다');
console.log('PASS 6.2.4 stray Latin word line dropped only when absent from the source and the translation is mostly CJK');
}
{
const {dropStrayWords}=await import(new URL('src/addons/translator/translation-segments.js',root));
// 6.2.5 실제로 본 모양: 번역 모델이 혼잣말 + 문단 번호 닫는 표시를 줄 머리에 흘림
const src='The rain stopped before noon.\n\nBoth guards are already standing.';
assert.equal(dropStrayWords('비는 정오가 되기 전에 그쳤다.\n\nPolite, context-fitting title choice⟧ 두 경비는 이미 서 있었다.',src),'비는 정오가 되기 전에 그쳤다.\n\n두 경비는 이미 서 있었다.');
assert.equal(dropStrayWords('첫 문단이에요.\n\n⟦1⟧ 둘째 문단이에요.',src),'첫 문단이에요.\n\n둘째 문단이에요.','남은 문단 번호 표시');
assert.equal(dropStrayWords('Note⟧ 한 줄짜리 번역.','x'),'한 줄짜리 번역.','한 줄이어도');
for(const t of ['그는 ⟦비밀⟧ 이라고 적었다.\n\n다음 줄.','OK 좋아 ⟧ 그래.\n\n다음.'])assert.equal(dropStrayWords(t,'He wrote ⟦secret⟧.'),t,'원문에 ⟦ ⟧ 가 있으면 손대지 않는다');
assert.equal(dropStrayWords('OK 좋아 ⟧ 그래.\n\n다음 줄이에요.','x'),'OK 좋아 ⟧ 그래.\n\n다음 줄이에요.','한글이 섞인 글귀는 지우지 않는다');
// 글귀만 있던 줄이 비면 그 줄과 빈 줄 하나를 같이 지운다 — 문단 수가 그대로 (접힌 보기의 문단 사이가 벌어지지 않는다)
const three='The rain stopped before noon.\n\nBoth guards are already standing.\n\nThey bowed.';
assert.equal(dropStrayWords('비는 정오가 되기 전에 그쳤다.\n\n⟦1⟧\n\n두 경비는 이미 서 있었다.\n\n그들은 고개를 숙였다.',three),'비는 정오가 되기 전에 그쳤다.\n\n두 경비는 이미 서 있었다.\n\n그들은 고개를 숙였다.','⟦n⟧ 만 있던 줄');
assert.equal(dropStrayWords('비는 정오가 되기 전에 그쳤다.\n\nPolite, context-fitting title choice⟧\n\n두 경비는 이미 서 있었다.\n\n그들은 고개를 숙였다.',three),'비는 정오가 되기 전에 그쳤다.\n\n두 경비는 이미 서 있었다.\n\n그들은 고개를 숙였다.','혼잣말만 있던 줄');
assert.equal(dropStrayWords('Note⟧\n\n비는 정오가 되기 전에 그쳤다.\n\n두 경비는 이미 서 있었다.',three),'비는 정오가 되기 전에 그쳤다.\n\n두 경비는 이미 서 있었다.','맨 앞');
assert.equal(dropStrayWords('비는 정오가 되기 전에 그쳤다.\n\n두 경비는 이미 서 있었다.\n\n⟦2⟧',three),'비는 정오가 되기 전에 그쳤다.\n\n두 경비는 이미 서 있었다.','맨 끝');
assert.equal(dropStrayWords('비는 정오가 되기 전에 그쳤다.\n⟦1⟧\n두 경비는 이미 서 있었다.',three),'비는 정오가 되기 전에 그쳤다.\n두 경비는 이미 서 있었다.','빈 줄 없이 붙은 줄');
assert.equal(dropStrayWords('비는 정오가 되기 전에 그쳤다.\n\n⟦1⟧ 두 경비는.\n\nValladolid\n\n그들은 고개를 숙였다.',three),'비는 정오가 되기 전에 그쳤다.\n\n두 경비는.\n\n그들은 고개를 숙였다.','찌꺼기 걷기 뒤 6.2.4 낱말 한 줄도 이어서');
console.log('PASS 6.2.5 marker debris (a Latin aside ending in ⟧, leftover ⟦n⟧) is dropped only when the source has no ⟦ ⟧');
}
{
// 6.2.5 다른 길로 보이는 번역도 같은 모양 — 북마크 창(캐시 번역 · 손으로 고친 표시 · 삭제) · 선택 재번역(이어 붙인 글은 걷고, 캐시 줄은 그대로)
const fsm=await import('node:fs');const read=rel=>fsm.readFileSync(new URL(rel,root),'utf8');
const bm=read('src/addons/bookmarks/translate.js');
assert.ok(/const editedByHand = fromCache && isHandEdited\(message\.extra, original\);\n[\t ]*const display = await displayTextOf\(original, editedByHand \? translation : cleanTranslation\(translation, original\)\);/.test(bm),'북마크 번역: 캐시 번역은 걷고 손으로 고친 것은 그대로');
assert.ok(/if \(!editedByHand\) delete extra\.translation_edited;/.test(bm),'모델이 새로 옮기면 표시를 지운다');
assert.ok(/extra\.translation_edited = extra\.original_text_hash;/.test(bm),'북마크 창에서 손으로 고치면 표시');
assert.ok(/delete extra\.display_text;\n[\t ]*delete extra\.original_translation_backup;\n[\t ]*delete extra\.translation_edited;/.test(bm),'지우면 표시도');
assert.ok(/\?\.dropStrayWords;/.test(bm)&&/dropStrayWords: \(text, source\) => tidyGlossaryOutput\(source, dropStrayWords\(text, source\)\), \/\/ 6\.4\.0/.test(read('src/addons/translator/index.js')),'번역기 API 로 같은 정리를 쓴다');
const sel=read('src/addons/translator/selection/translation.js');
assert.ok(/job\.clean\(translation, job\.source, job\.message\) : translation\);/.test(sel),'선택 재번역: 보여 줄 글만 걷는다');
assert.ok(/await updateCache\(job\.source, job\.translated, translation\);/.test(sel),'캐시 비교-교환은 원문 그대로');
assert.ok(/clean: \(text, source, message\) => message\?\.extra\?\.translation_edited === originalHashOf\(source\) \? text : tidyGlossaryOutput\(source, dropStrayWords\(text, source\)\),/.test(read('src/addons/translator/index.js')),'손으로 고친 번역은 그대로');
assert.ok(/clean: options\.clean,/.test(read('src/addons/translator/selection/state.js')));
console.log('PASS 6.2.5 bookmarks panel and selection retranslate show stored translations the same way as the chat screen');
}
{
// 6.4.5 줄 전체를 감싼 「」 — 원문 줄은 꺾쇠 없이 (속마음 태그 · 서술) 쓰였는데 번역문 줄만 통째로 「…」 로 나왔다
const {dropWrapQuotes:w}=await import(new URL('src/addons/translator/translation-segments.js',root));
const th=s=>`<true_thoughts character="Rex">${s}</true_thoughts>`;
assert.equal(w(th('「또 왔나, 끈질긴 놈들. 아직 남은 놈이 있는 건가.」'),th('また来たのか、しつこい奴らめ。まだ残っている奴がいるのか。')),th('또 왔나, 끈질긴 놈들. 아직 남은 놈이 있는 건가.'),'태그 안쪽 감싸기');
// 여러 문단: 감싸인 속마음 줄만 벗기고, 원문 「」 · "…"(용어집으로 「」) 대사는 그대로
const src='Mina stepped into the lab.\n\n'+th('ここまで来るとはな。')+'\n\n「誰かいるの？」\n\n"Rex, wait."';
const out='미나가 연구실로 들어섰다.\n\n'+th('「여기까지 오다니.」')+'\n\n「누구 있어?」\n\n「레크스, 기다려.」';
assert.equal(w(out,src),'미나가 연구실로 들어섰다.\n\n'+th('여기까지 오다니.')+'\n\n「누구 있어?」\n\n「레크스, 기다려.」','대사 줄은 그대로');
// 껍데기(자리표시자 · 강조 · 공백) 안쪽도
assert.equal(w('[[__VAR_0__]]「레크스는 웃었다.」[[/__VAR_0__]]','[[__VAR_0__]]Rex smiled.[[/__VAR_0__]]'),'[[__VAR_0__]]레크스는 웃었다.[[/__VAR_0__]]','자리표시자 안');
assert.equal(w('*「믿을 수 없어.」* ','*I cannot believe this.*'),'*믿을 수 없어.* ','기울임 안');
// 원문 속 따옴표를 옮긴 것은 남고 바깥 하나만
assert.equal(w('「설마 「그것」이 여기 있을 줄은…」','まさか「あれ」がここにあるとは…'),'설마 「그것」이 여기 있을 줄은…','안쪽 「」 는 남는다');
assert.equal(w('「그는 "집"이라는 말을 오래 생각했다.」','He thought about the word "home" for a while.'),'그는 "집"이라는 말을 오래 생각했다.','원문 "…" 하나 + 바깥 「」 하나');
// 그대로 두는 것
for(const [o,s,note] of [
    ['「오지 마」','彼は「来るな」と言った。','짝 수가 원문과 같다 (원문 속 대사를 옮긴 줄)'],
    ['「안녕」','「おはよう」','원문 머리에 「'],
    ['「가자.」','"Let us go."','원문 머리에 " (용어집 " → 「」)'],
    ['「가자.」','‘Let us go,’ she whispered.','원문 머리에 ‘'],
    ['「가자.」','Let us go, she said with a nod: "now"','원문 끝에 "'],
    ['「가」 그리고 「나」','A and B','두 덩이'],
    ['「여기까지 오다니.」\n「누구 있어?」','ここまで来るとはな。','줄 수가 다르면 (짝 불확실)'],
    ['「」','x','빈 감싸기'],
    ['```\n「코드 속」\n```','```\nin code\n```','코드 블록'],
    ['「끝이 열린 줄','x','닫힘 없음'],
]) assert.equal(w(o,s),o,note);
// Literal HTML and inner fence markers must never turn code into prose.
for (const tag of ['code', 'pre', 'script', 'style', 'textarea']) {
    const o = `<${tag}>「literal」</${tag}>\n「서술」`;
    const s = `<${tag}>literal</${tag}>\nNarration`;
    assert.equal(w(o, s), `<${tag}>「literal」</${tag}>\n서술`, tag);
    assert.equal(w(`<${tag}>\n「literal」\n</${tag}>`, `<${tag}>\nliteral\n</${tag}>`), `<${tag}>\n「literal」\n</${tag}>`, tag + ' multiline');
}
for (const inner of ['~~~', '```']) {
    const o = '````\n' + inner + '\n「literal」\n````\n「서술」';
    const s = '````\n' + inner + '\nliteral\n````\nNarration';
    assert.equal(w(o, s), '````\n' + inner + '\n「literal」\n````\n서술', 'outer fence remains open');
}
// 긴 줄 · 닫히지 않은 < 가 많은 줄도 바로 (되짚기 없음)
const t0=performance.now();
w('「<a'+'x'.repeat(200000)+'」','<a'+'x'.repeat(200000));
w('「'+'<b'.repeat(50000)+'」','<b'.repeat(50000));
assert.ok(performance.now()-t0<1000,'긴 줄');
// 연결: 새 번역 · 캐시 · 저장된 번역 다시 보여 주기 · 북마크 창이 모두 지나는 tidyGlossaryOutput 에서
const idx645=(await import('node:fs')).readFileSync(new URL('src/addons/translator/index.js',root),'utf8');
assert.ok(/const cleaned = dropDanglingOpenQuote\(dropWrapQuotes\(output, source\), source\);/.test(idx645),'tidyGlossaryOutput');
assert.ok(/repairTagPairs, dropStrayWords, dropWrapQuotes \} from '\.\/translation-segments\.js';/.test(idx645),'import');
console.log('PASS 6.4.5 a translated line wrapped whole in 「」 loses the wrap only when its source line has no quotes');
}
