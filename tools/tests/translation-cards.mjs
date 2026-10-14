// Synthetic display-card contracts. No preset bodies, renderer code or personal data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const moduleFile = path.join(root,'src/addons/translator/display-cards.js');
const {prepareDisplayCards,withDisplayCardsProtected,withoutDisplayCards,displayCardBlocks,matchesDisplayCardStructure} = await import(pathToFileURL(moduleFile));
const {segmentParagraphs,translateSegments,clearSegmentCache}=await import(pathToFileURL(path.join(root,'src/addons/translator/translation-segments.js')));
const cases = [];
function test(name,run) { run(); cases.push(name); }
function prepare(source,options={}) {
    const reserved = [];
    const result = prepareDisplayCards(source,{reserve:value=> {reserved.push(value);return `[[__VAR_${reserved.length+20}__]]`;},...options});
    return {...result,reserved};
}
const replace = (text,pairs) => Object.entries(pairs).reduce((s,[a,b])=>s.replaceAll(a,b),text);
function roundtrip(source,pairs,expected) {
    const p=prepare(source), answer=p.restore(replace(p.text,pairs));
    assert.equal(answer,expected);
    assert.equal(p.restore(p.text),source,'identity must preserve all original bytes');
    return p;
}
test('ordinary prose is untouched',()=>{
    const p=prepare('Simple prose <span>and text</span>.');assert.equal(p.count,0);assert.equal(p.text,p.restore(p.text));
});
test('unverified card grammars retain the existing translation path',()=>{
    const src='<momentum><summary>Momentum Engine</summary><details>Current scene: Data</details></momentum>';
    const p=prepare(src);assert.equal(p.count,0);assert.equal(p.text,src);
});
test('six status values, fixed keys and unknown hidden data',()=>{
    const src='<status_bar>\r\n日期： Monday\r\n时间： Afternoon 14:30\r\n天气： Cloudy 20℃\r\n地点： Green hall\r\n题记： The day begins\r\n之间： A folded map\r\ninternal_id: keep-private-42\r\n</status_bar>';
    const pairs={Monday:'월요일',Afternoon:'오후',Cloudy:'흐림','Green hall':'초록 홀','The day begins':'하루가 시작된다','A folded map':'접힌 지도'};
    const p=roundtrip(src,pairs,replace(src,pairs));
    for(const key of ['日期','时间','天气','地点','题记','之间','internal_id','keep-private-42','status_bar']) assert.ok(!p.text.includes(key));
});
test('legacy status keys and delimiters retain their exact spelling',()=>{
    const src='<status_bar>\n[Info | Monday | Afternoon | Cloudy | Hall]\nQuote｜A quiet day\nOutfit｜Blue coat｜Red scarf\n</status_bar>';
    const pairs={Monday:'월요일',Afternoon:'오후',Cloudy:'흐림',Hall:'홀','A quiet day':'조용한 날','Blue coat':'파란 외투','Red scarf':'빨간 목도리'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!/Info|Quote|Outfit/.test(p.text));
});
test('Deus tracker values translate without losing emoji separators or temperature',()=>{
    const src='<tracker> 🌅 Morning | April 2, Tuesday, 2030 | Town → Library → Atrium | ☀️ Clear, 19°C </tracker>';
    const pairs={Morning:'아침','April 2, Tuesday, 2030':'2030년 4월 2일 화요일',Town:'마을',Library:'도서관',Atrium:'중앙 홀',Clear:'맑음'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!/[🌅☀→]|19°C|tracker/u.test(p.text));
    assert.equal((p.restore(replace(p.text,pairs)).match(/\|/g)||[]).length,3);
});
test('tracker numeric times remain local but AM/PM is translatable',()=>{
    const src='<tracker> 🕑 02:40 PM | Friday | Room | 🌧 Rain, -2.5°F </tracker>';
    roundtrip(src,{PM:'오후',Friday:'금요일',Room:'방',Rain:'비'},'<tracker> 🕑 02:40 오후 | 금요일 | 방 | 🌧 비, -2.5°F </tracker>');
});
test('novel header parser markers remain local',()=>{
    const src='<novel_header>\n[CHAP] Chapter Four\n[TITLE] A New Door\n[CP] Alpha, Beta\n[LOC] North wing\n[TAGS] Hope / Mystery\n[PREFACE] A small beginning\n</novel_header>';
    const pairs={'Chapter Four':'제4장','A New Door':'새 문','Alpha, Beta':'알파, 베타','North wing':'북쪽 별관',Hope:'희망',Mystery:'미스터리','A small beginning':'작은 시작'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!/CHAP|TITLE|CP|LOC|TAGS|PREFACE/.test(p.text));
});
test('novel values cannot break renderer attribute quotes',()=>{
    const src='<novel_header>[CP] Old [LOC] Here [TAGS] Tag</novel_header>',p=prepare(src);
    const out=p.restore(p.text.replace('Old','A "new" pair').replace('Here',"Other's room"));
    assert.ok(out.includes('A &#34;new&#34; pair')); assert.ok(out.includes('Other&#39;s room'));
});
test('meow summary labels and serial are data, remaining values are display text',()=>{
    const src='<meow_FM>\nserial:🍎No.024\ntime:Monday☆14:00\nscene:A garden\nplot:A visitor arrived\necho:Hello again\nseeds:A sealed letter\n</meow_FM>';
    const pairs={Monday:'월요일','A garden':'정원','A visitor arrived':'방문객이 왔다','Hello again':'다시 안녕','A sealed letter':'봉인된 편지'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!/serial|No\.024|time:|scene:|plot:|echo:|seeds:/.test(p.text));
});
test('prologue mode is not translated and quote divider stays intact',()=>{
    const src='<prologue>\n模式：letter\nThe door is open\n<hr>\nWelcome home\n— A note\n</prologue>';
    const pairs={'The door is open':'문이 열려 있다','Welcome home':'집에 온 걸 환영해','A note':'쪽지'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!/模式|letter|<hr>/.test(p.text));
});
test('markdown profile columns and separator rows preserve layout',()=>{
    const src='<profile>\n| Category | Name | Role |\n| :--- | ---: | --- |\n| Visitor | Dana | Archivist |\n<!-- hidden relationship draft -->\n</profile>';
    const pairs={Category:'분류',Name:'이름',Role:'역할',Visitor:'방문객',Dana:'다나',Archivist:'기록관'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!p.text.includes('hidden relationship'));
});
test('branch action markers, native details and summary survive',()=>{
    const src='<branches><details><summary>Choose a path</summary>\nA. Open the gate\nB. Wait outside\n</details></branches>';
    const pairs={'Choose a path':'길 고르기','Open the gate':'문 열기','Wait outside':'밖에서 기다리기'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!/A\.|B\.|details|summary/.test(p.text));
});
test('CCD text theater keeps raw tags and code fences opaque',()=>{
    const src='<ccd>\n<start>\n# A little scene\nFirst line\n```js\nconst hiddenName = "Do not translate";\n```\nLast line\n</end>\n</ccd>';
    const pairs={'A little scene':'작은 장면','First line':'첫 줄','Last line':'마지막 줄'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.ok(!/hiddenName|Do not translate|const/.test(p.text));
});
test('snow HTML literal text only, no script CSS attributes or hidden nodes',()=>{
    const src='<snow>\n```html\n<div class="card" data-id="alpha"><style>.card{color:red}</style><h2 title="Tooltip">A note</h2><p>Hello <b>friend</b></p><span hidden>Secret one</span><i aria-hidden="true">Secret two</i><span style="display:none">Secret three</span><a href="https://example.invalid/private">Open</a><script>const label="Not visible yet";</script></div>\n```\n</snow>';
    const pairs={'A note':'쪽지',Hello:'안녕',friend:'친구',Open:'열기'};
    const p=roundtrip(src,pairs,replace(src,pairs));
    for(const absent of ['Tooltip','alpha','color:red','Secret','example.invalid','Not visible yet','script','style']) assert.ok(!p.text.includes(absent),absent);
});
test('snow plain punctuation is not needlessly converted to literal entities',()=>{
    const src='<snow><p>Hello</p></snow>',p=prepare(src);
    assert.equal(p.restore(p.text.replace('Hello',"그는 '안녕'이라고 말했다.")),"<snow><p>그는 '안녕'이라고 말했다.</p></snow>");
});
test('simple local CSS hidden selectors keep their data local',()=>{
    const src='<snow><style>.internal { display: none !important; } #private {visibility:hidden} .visible {color:red}</style><p class="internal">Hidden one</p><p id="private">Hidden two</p><p class="visible">Hello</p></snow>';
    const p=roundtrip(src,{Hello:'안녕'},src.replace('Hello','안녕'));assert.ok(!/Hidden|internal|private|color:red/.test(p.text));
});
test('broken sensitive HTML markup is preserved without exposing code',()=>{
    const src='<snow><p>Visible before</p><script broken\nconst hidden="local";\n</snow>',p=prepare(src);
    assert.ok(!p.text.includes('hidden')); assert.ok(!p.text.includes('Visible before')); assert.equal(p.restore(p.text),src);
});
test('single character card translates nested visible nodes and protects renderer strings',()=>{
    const src='<角色状态面板><日期>Monday</日期><位置描述>Quiet room</位置描述><心情符号>🙂</心情符号><心情名称>Calm</心情名称><搜索历史><搜索记录><内容>Where is it</内容><时间>14:32</时间></搜索记录></搜索历史><语录集><语录>Hello</语录></语录集><当前播放>Song</当前播放></角色状态面板>';
    const pairs={Monday:'월요일','Quiet room':'조용한 방',Calm:'차분함','Where is it':'어디 있지',Hello:'안녕',Song:'노래'};
    const p=roundtrip(src,pairs,replace(src,pairs)); assert.ok(!/角色|日期|位置|搜索|语录|当前|14:32/.test(p.text));
    const dangerous='` ${sideEffect()} </script> " \\';
    const out=p.restore(p.text.replace('Hello',dangerous));
    assert.ok(!out.includes(dangerous)); assert.ok(out.includes('\\u0060'));assert.ok(out.includes('\\u0024'));assert.ok(out.includes('\\u003c'));
    const quote=out.match(/<语录>(.*?)<\/语录>/s)[1];
    assert.equal(Function('return `'+quote+'`')(),dangerous,'renderer string evaluates to the intended visible text');
});
test('old compact top card preserves hidden presentation mode',()=>{
    const src='◸Monday｜North hall<present>Clear skies｜A fresh start◹';
    const pairs={Monday:'월요일','North hall':'북쪽 홀','Clear skies':'맑은 하늘','A fresh start':'새로운 시작'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.equal(p.count,1);assert.ok(!/present|[◸◹]/.test(p.text));
});
test('cards in comments scripts and code samples are not interpreted',()=>{
    const src='<!-- <status_bar>日期：Monday</status_bar> ◸Day<present>Sky｜Quote◹ -->\n```xml\n<tracker>sample</tracker>\n```\n<script>const s="<snow>sample</snow>";</script>';
    const p=prepare(src);assert.equal(p.count,0);assert.equal(p.text,src);
});
test('user-protected tokens nested in a display value stay local and are restored once',()=>{
    const src='<status_bar>\n题记：Hello [[__VAR_0__]] friend\n</status_bar>';
    const p=roundtrip(src,{Hello:'안녕',friend:'친구'},'<status_bar>\n题记：안녕 [[__VAR_0__]] 친구\n</status_bar>');
    assert.ok(!p.text.includes('[[__VAR_0__]]'));
});
test('URL entities and macro values are not sent',()=>{
    const src='<snow><p>Hello https://example.invalid/token?x=42 {{user}} &amp; world</p></snow>';
    const p=roundtrip(src,{Hello:'안녕',world:'세상'},'<snow><p>안녕 https://example.invalid/token?x=42 {{user}} &amp; 세상</p></snow>');
    assert.ok(!/example|\{\{user|&amp;/.test(p.text));
});
test('markdown link brackets and non-http destinations remain structural',()=>{
    const src='<profile>[Contact](mailto:team@example.invalid) or [Archive](ftp://example.invalid/data)</profile>';
    const p=roundtrip(src,{Contact:'연락',Archive:'보관함',or:'또는'},'<profile>[연락](mailto:team@example.invalid) 또는 [보관함](ftp://example.invalid/data)</profile>');
    assert.ok(!/mailto|example|ftp:/.test(p.text));
});
test('partial known cards preserve all incomplete data',()=>{
    const src='Prose\n<status_bar>\n日期：Monday\n<script>unfinished';
    const p=prepare(src);assert.equal(p.count,1);assert.ok(!p.text.includes('Monday'));assert.equal(p.restore(p.text),src);
});
test('missing duplicate reordered and empty card fields reject the entire result',()=>{
    const p=prepare('<status_bar>\n日期：Monday\n地点：Room\n</status_bar>');
    const t=[...p.text.matchAll(/\[\[__VAR_\d+__\]\]/g)].map(m=>m[0]);
    for(const bad of [p.text.replace(t[1],''),p.text+t[0],p.text.replace(t[1],'TEMP').replace(t[2],t[1]).replace('TEMP',t[2]),p.text.replace('Monday',''),p.text.replace(t[0],t[0]+'invented preface')]) {
        assert.throws(()=>p.restore(bad),e=>e.structuredCard===true);assert.equal(p.cacheable(p.text,bad),false);
    }
    assert.equal(p.cacheable(p.text,p.text.replace('Monday','월요일')),true);
});
test('no-field cards are also checked and preserved exactly',()=>{
    const src='<status_bar>\ninternal_id: Hidden\n</status_bar>',p=prepare(src);assert.equal(p.restore(p.text),src);assert.ok(!p.text.includes('Hidden'));
    assert.throws(()=>p.restore(p.text.replace(/\n/, '\nInvented')),e=>e.structuredCard);
});
test('multiple cards stay independent, prose remains free',()=>{
    const src='<status_bar>\n地点：Room\n</status_bar>\nA story.\n<tracker> 🌅 Dawn | Monday | Hall | ☀ Clear, 12°C </tracker>';
    const pairs={Room:'방','A story.':'이야기.',Dawn:'새벽',Monday:'월요일',Hall:'홀',Clear:'맑음'};
    const p=roundtrip(src,pairs,replace(src,pairs));assert.equal(p.count,2);
});
test('moving a whole card ahead of another card is rejected',()=>{
    const src='<status_bar>\n地点：Room\n</status_bar>\nPROSE_DIVIDER\n<tracker> 🌅 Dawn | Monday | Hall | ☀ Clear, 12°C </tracker>';
    const p=prepare(src),parts=p.text.split('\nPROSE_DIVIDER\n');
    assert.throws(()=>p.restore(parts[1]+'\nPROSE_DIVIDER\n'+parts[0]),e=>e.structuredCard);
});
test('retranslation keeps canonical source structure and checks source mapping',()=>{
    const original='<status_bar>\n地点：Room\n</status_bar>',old='<status_bar>\n地点：방\n</status_bar>';
    const p=prepare('[Original Text]:\n'+original+'\n\n[Translated Text]:\n'+old,{isRetranslation:true});
    const body=p.text.split('\n\n[Translated Text]:\n')[1];assert.equal(p.restore(body.replace('방','작은 방')),original.replace('Room','작은 방'));
    assert.equal(p.compare(original),p.text.split('\n\n[Translated Text]:\n')[0].replace('[Original Text]:\n',''));
    assert.throws(()=>p.compare('<tracker>other layout</tracker>'),e=>e.structuredCard);
});
test('correction reads escaped values from source slots and escapes exactly once',()=>{
    for(const source of ['<status_bar>\n题记：Hello friend\n</status_bar>','<novel_header>[TITLE]Hello friend</novel_header>','<角色状态面板><语录集><语录>Hello friend</语录></语录集></角色状态面板>']) {
        const first=prepare(source),translated=first.restore(first.text.replace('Hello friend',"안녕 & '친구' [대사] | ${빛} \\ 별"));
        const corrected=prepare('[Original Text]:\n'+source+'\n\n[Translated Text]:\n'+translated,{isRetranslation:true});
        const reply=corrected.text.split('\n\n[Translated Text]:\n')[1];
        assert.equal(corrected.restore(reply),translated);assert.ok(!corrected.restore(reply).includes('&amp;amp;'));
    }
});
test('display CRLF normalization does not reject reuse or rewrite restored source framing',()=>{
    const source='<status_bar>\r\n地点：Room\r\n</status_bar>',first=prepare(source),translated=first.restore(first.text.replace('Room','방'));
    assert.equal(translated,source.replace('Room','방'));assert.equal(matchesDisplayCardStructure(source,translated.replaceAll('\r\n','\n')),true);
    const corrected=prepare('[Original Text]:\n'+source+'\n\n[Translated Text]:\n'+translated.replaceAll('\r\n','\n'),{isRetranslation:true});
    assert.equal(corrected.restore(corrected.text.split('\n\n[Translated Text]:\n')[1]),translated,'source CRLF frame is retained');
});
test('correction aligns existing protection numbers without exposing their values',()=>{
    const source='<status_bar>\n题记：Hello [[__VAR_0__]] friend\n</status_bar>',translated='<status_bar>\n题记：안녕 [[__VAR_1__]] 친구\n</status_bar>';
    const joined='[Original Text]:\n'+source+'\n\n[Translated Text]:\n'+translated;
    const p=prepare(joined,{isRetranslation:true,protectionValue:()=>'<private>Same protected text</private>'});
    const reply=p.text.split('\n\n[Translated Text]:\n')[1];
    assert.ok(!p.text.includes('[[__VAR_0__]]'));assert.ok(!p.text.includes('[[__VAR_1__]]'));
    assert.equal(p.restore(reply),translated.replace('[[__VAR_1__]]','[[__VAR_0__]]'));
    assert.throws(()=>prepare(joined,{isRetranslation:true}),e=>e.structuredCard);
    assert.throws(()=>prepare(joined,{isRetranslation:true,protectionValue:token=>token.endsWith('0__]]')?'Value A':'Value B'}),e=>e.structuredCard);
    const nested={'[[__VAR_0__]]':'<private>[[__VAR_2__]]</private>','[[__VAR_1__]]':'<private>[[__VAR_3__]]</private>','[[__VAR_2__]]':'Same inner text','[[__VAR_3__]]':'Same inner text'};
    assert.doesNotThrow(()=>prepare(joined,{isRetranslation:true,protectionValue:token=>nested[token]}));
    nested['[[__VAR_3__]]']='Different inner text';
    assert.throws(()=>prepare(joined,{isRetranslation:true,protectionValue:token=>nested[token]}),e=>e.structuredCard);
});
test('nested cards count once and both values restore',()=>{
    const src='<snow><details><summary>A page</summary><snow><p>A line</p></snow></details></snow>';
    const p=roundtrip(src,{'A page':'한 페이지','A line':'한 줄'},'<snow><details><summary>한 페이지</summary><snow><p>한 줄</p></snow></details></snow>');assert.equal(p.count,1);
});
test('later prose transforms cannot edit cards and handle token collisions',()=>{
    const src='[[__VAR_0__]] [[__CARD_0__]] prose <status_bar>\n地点：Room\n</status_bar>';
    assert.equal(withDisplayCardsProtected(src,s=>s.replace('prose','번역').replace('Room','broken')),src.replace('prose','번역'));
    assert.throws(()=>withDisplayCardsProtected(src,()=>''),e=>e.structuredCard);
    assert.deepEqual(displayCardBlocks(src),['<status_bar>\n地点：Room\n</status_bar>']);
    assert.equal(withoutDisplayCards(src),'[[__VAR_0__]] [[__CARD_0__]] prose \n');
});
test('oversized cards remain opaque instead of partially succeeding',()=>{
    const src='<snow><p>'+('Long text. '.repeat(50000))+'</p></snow>',p=prepare(src);assert.ok(p.text.length<100);assert.equal(p.restore(p.text),src);
});
test('old cached translations must preserve keys tags code and hidden data',()=>{
    const src='<status_bar>\n日期：Monday\n地点：Room\n</status_bar>\nProse\n<snow><p data-id="fixed">Hello</p><script>let a=1;</script><i hidden>secret</i></snow>';
    const p=prepare(src),good=p.restore(replace(p.text,{Monday:'월요일',Room:'방',Hello:'안녕 & <친구>'}));
    assert.equal(matchesDisplayCardStructure(src,good),true,'newly escaped entities are valid field content');
    for(const bad of [good.replace('日期','날짜'),good.replace('status_bar','translated_status'),good.replace('data-id="fixed"','data-id="translated"'),good.replace('a=1','a=2'),good.replace('secret','비밀'),good.replace('월요일',''),good.replace('월요일','월요일\nextra'),good.replace('월요일','<script>bad()</script>')]) assert.equal(matchesDisplayCardStructure(src,bad),false);
    const scripted='<角色状态面板><语录集><语录>Hello</语录></语录集></角色状态面板>';
    assert.equal(matchesDisplayCardStructure(scripted,scripted.replace('Hello','${bad()}')),false);
    const protectedScript=prepare(scripted);assert.equal(matchesDisplayCardStructure(scripted,protectedScript.restore(protectedScript.text.replace('Hello','${shown}'))),true);
    assert.equal(matchesDisplayCardStructure('ordinary prose','보통 문장'),true);
});
{
    await clearSegmentCache();
    const src='Opening prose.\n\n<status_bar>\n日期：Monday\n地点：Green hall\n</status_bar>\n\nClosing prose.';
    const p=prepare(src),parts=segmentParagraphs(p.text),pairs={'Opening prose.':'여는 문장.',Monday:'월요일','Green hall':'초록 홀','Closing prose.':'맺는 문장.'};
    assert.ok(parts);let calls=0;
    const config={parts,signature:()=> 'display-card-segment-test',cacheable:p.cacheable,request:async bodies=>{calls++;return bodies.map(b=>replace(b,pairs));}};
    const first=await translateSegments(config);assert.equal(p.restore(first.text),replace(src,pairs));assert.equal(calls,1);
    const second=await translateSegments(config);assert.equal(p.restore(second.text),replace(src,pairs));assert.equal(calls,1);assert.equal(second.reused,3);
    await clearSegmentCache();let phase=0;
    const retry={...config,signature:()=> 'display-card-empty-field-test',request:async bodies=>{phase++;return bodies.map(b=>replace(b,pairs).replace('월요일',phase===1?'':'월요일'));}};
    const bad=await translateSegments(retry);assert.throws(()=>p.restore(bad.text),e=>e.structuredCard);
    const good=await translateSegments(retry);assert.equal(phase,2);assert.equal(p.restore(good.text),replace(src,pairs));assert.equal(good.reused,2);
    await clearSegmentCache();cases.push('real paragraph cache reuses complete cards and retries malformed fields');
}
console.log(JSON.stringify({passed:true,checks:cases.length,cases,moduleBytes:fs.statSync(moduleFile).size},null,2));
