// 8.0.6 상태창 글자: 실리태번 custom- 접두어 · 데우스 V3 트래커 · 대화에 없을 때 표본 미리보기
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const load=file=>import(pathToFileURL(path.join(root,file)));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const schema=await load('src/fruit-type-schema.js');
const sample=await load('src/fruit-type-sample.js');
const {FRUIT_TYPES,stSelector,stCss,typeMatch,tidyFruitType,fruitTypeCss}=schema;
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('ok',name);};

check('class 하나하나를 원래 이름 · custom- 이름 둘 다로 받아요(id · 값은 그대로)',()=>{
    assert.equal(stSelector('.dem-track'),':is(.dem-track,.custom-dem-track)');
    assert.equal(stSelector('#statusBar.dynamic-status-container'),'#statusBar:is(.dynamic-status-container,.custom-dynamic-status-container)');
    assert.equal(stSelector('.custom-dem-track'),'.custom-dem-track');
    // 1.1.1 restyle2: 시트의 맨 오른쪽 칸 첫 class 는 두 갈래로 나눠 적어요(크롬 규칙 바구니 · tools/tests/css-restyle2.mjs)
    assert.equal(stCss('.a .b{line-height:1.6;font-family:"A.B"}\n.c{x:0.5}'),':is(.a,.custom-a) .b,:is(.a,.custom-a) .custom-b{line-height:1.6;font-family:"A.B"}\n.c,.custom-c{x:0.5}');
    for(const type of FRUIT_TYPES)assert.equal(typeMatch(type),stSelector(type.root));
});
check('데우스 꾸미기 CSS 가 채팅의 .custom-dem-* 에 닿아요(6.5.9 부터 안 닿던 것)',()=>{
    const s=tidyFruitType({ownerOn:{deus:true,fruit:false}});
    for(const id of ['deus-tracker','deus-status','deus-conflict'])s.types[id].regions.info.on=true;
    s.types['deus-tracker'].regions.info.size=22;
    const css=fruitTypeCss(s);
    assert(css.includes('.custom-dem-track__value')&&css.includes('.custom-dem-status-row__value'));
    assert(css.includes('font-size:22px!important'));
    assert(!/\{[^}]*:is\(/.test(css),'선택자 밖(값)은 바꾸지 않아요');
});
check('시간 표시는 옛 모양과 데우스 V3 모양을 둘 다 알아봐요',()=>{
    const tracker=FRUIT_TYPES.find(t=>t.id==='deus-tracker');
    for(const name of ['.dem-track','.dem-track-recovery','.dem-tracker'])assert(tracker.root.includes(name),name);
    const info=tracker.regions.info[1];
    for(const name of ['.dem-track__value','.dem-track-recovery__value','.dem-track__clock','.dem-track__date','.dem-track__place','.dem-track__sky','.dem-track__temp'])assert(info.includes(name),name);
    const s=tidyFruitType({ownerOn:{deus:true}});s.types['deus-tracker'].layout='vertical';
    const css=fruitTypeCss(s);
    assert(css.includes('.dem-track__grid,') && css.includes('.custom-dem-track__grid{grid-template-columns:minmax(0,1fr)!important'),'V3 세로 배치는 안쪽 격자를 한 줄씩');   // 1.1.1 restyle2: 맨 오른쪽 class 는 두 갈래
    assert(FRUIT_TYPES.find(t=>t.id==='deus-conflict').regions.info[1].includes('> :not(summary)'),'갈등 카드 본문(이름 없는 칸)');
});
check('날씨 효과가 V3 트래커(__sky · 복구판 __place--context)도 읽어요',()=>{
    const weather=read('src/weather.js');
    for(const name of ['.custom-dem-track__sky','.custom-dem-track__place--context','.custom-dem-track__item--weather .custom-dem-track__value','.custom-dem-track-recovery__value'])assert(weather.includes(name),name);
    assert(weather.includes("last.matches('.custom-dem-track__sky')"),'그림 글자와 날씨 글을 띄어 읽어요');
});
check('실리태번 정규식 치환과 같게 바꿔요({{match}} · $1 · $<이름> · 잘라 낼 글자 · 깃발)',()=>{
    const run=(find,replace,text,trim)=>sample.runSampleScript({findRegex:find,replaceString:replace,trimStrings:trim},text);
    assert.equal(run('/<t>(.*?)<\\/t>/g','[$1]','<t>a</t><t>b</t>'),'[a][b]');
    assert.equal(run('<t>(.*?)</t>','[$1]','<t>a</t><t>b</t>'),'[a]<t>b</t>','깃발 없는 글자는 한 번만');
    assert.equal(run('/<t>(?<v>.*?)<\\/t>/','{{match}}|$<v>','<t>a</t>'),'<t>a</t>|a');
    assert.equal(run('/<t>(.*?)<\\/t>/','$1|$2','<t>x*y</t>',['*']),'xy|');
    assert.equal(run('/(x)/','{{user}}·{{char}}','x'),'나·인물 A');
    assert.equal(run('/(/','z','x'),'x','깨진 찾기 식은 그대로');
});
const script=(id,find,replace,more={})=>({id,findRegex:find,replaceString:replace,placement:[2],...more});
check('그 종류의 원작 정규식이 든 목록 하나를 골라 관련 정규식만 순서대로 써요',()=>{
    const tracker=FRUIT_TYPES.find(t=>t.id==='deus-tracker'),status=FRUIT_TYPES.find(t=>t.id==='status');
    const lists=[
        {where:'other',list:[script('a','/x/','<div class="fate-status-wrapper">$0</div>',{disabled:true})]},
        {where:'deus',list:[
            script('t1','/<tracker>([^<]*)<\\/tracker>/','<div class="dem-track" data-t="$1"><div class="dem-track__grid"><span class="dem-track__clock">$1</span></div></div>'),
            script('p','/x/','<b class="dem-x">',{promptOnly:true}),
            script('o','/x/','<b class="dem-x">',{placement:[1]}),
            script('n','/y/','no class here'),
            script('s','/(?=<div class="dem-track")/','<style>.dem-track{color:red}</style>')]},
        {where:'fruit',list:[script('f','/<status_bar>([\\s\\S]*?)<\\/status_bar>/','```html\n<!doctype html><html><body><div class="fate-status-wrapper">$1</div><script>1</script></body></html>\n```')]}];
    const picked=sample.pickSampleChain(tracker,lists);
    assert.equal(picked.where,'deus');assert.deepEqual(picked.chain.map(s=>s.id),['t1','s'],'프롬프트 전용 · 다른 자리 · 관계없는 정규식은 빼요');
    const out=sample.sampleOutput(tracker,lists);
    assert(!out.fenced&&!out.scripted&&out.document.startsWith('<style>')&&out.document.includes('dem-track__clock'));
    assert.equal(sample.pickSampleChain(status,lists).where,'fruit','켜진 정규식이 든 목록을 먼저');
    const doc=sample.sampleOutput(status,lists);
    assert(doc.fenced&&doc.scripted&&doc.document.startsWith('<!doctype html>'),'TavernHelper 문서');
    const plain=sample.sampleOutput(status,[{where:'q',list:[script('q','/<status_bar>([\\s\\S]*?)<\\/status_bar>/','```\n<html><body><div class="fate-status-wrapper">$1</div></body></html>\n```')]}]);
    assert(plain.fenced&&!plain.scripted,'언어 표시 없는 코드블록도 문서');
    const fragment=sample.sampleOutput(status,[{where:'r',list:[script('r','/<status_bar>([\\s\\S]*?)<\\/status_bar>/','<div class="fate-status-wrapper">$1</div><script>alert(1)</script>')]}]);
    assert(!fragment.fenced&&!fragment.scripted,'본문 조각의 스크립트는 실리태번이 지우므로 실행하지 않아요');
    assert.equal(sample.sampleOutput(tracker,[]),null);
});
check('표본 문서는 바깥 주소를 막고 TavernHelper 와 같은 겉문서로 그려요',()=>{
    assert.equal(sample.cleanSampleCss('@import url("https://x/a.css");.a{background:url(https://x/b.png)}@font-face{font-family:Z;src:url(//x/z.woff)}.b{color:red}'),'.a{background:none}.b{color:red}');
    const staged=sample.stageDocument('<div>x</div><style>.b{min-height:100vh}.a{min-height:50vh}</style>','N','--a:1');
    assert(staged.includes("default-src 'none'")&&staged.includes("connect-src 'none'"),'네트워크 막음');
    assert(staged.indexOf('Content-Security-Policy')<staged.indexOf('<body>'));
    assert(staged.includes('box-sizing:border-box')&&staged.includes('overflow:hidden!important'),'TavernHelper 기본 규칙');
    assert(staged.includes('min-height:var(--TH-viewport-height)')&&staged.includes('calc(var(--TH-viewport-height) * 0.5)'));
    assert(staged.includes("Object.defineProperty(window,'localStorage'")&&staged.includes("Object.defineProperty(window,'parent'"),'저장소 · 부모 창은 가짜로');
    const shim=read('src/fruit-type-sample.js');
    assert(shim.includes("frame.setAttribute('sandbox','allow-scripts')")&&!/allow-same-origin['"]\)/.test(shim.slice(shim.indexOf('renderSampleStage'),shim.indexOf('sampleRegexLists'))),'다른 출처 격리 iframe');
});
check('54종 모두 표본 글 · 기본 표본이 있고, 기본 시간 표시는 V3 모양이에요',()=>{
    assert.equal(FRUIT_TYPES.length,54);
    for(const type of FRUIT_TYPES){
        assert(sample.SAMPLE_INPUTS[type.id]?.length,type.id);
        const b=sample.builtinSample(type);assert(b.html.length>100&&b.origin==='builtin',type.id);
        assert.equal(b.fragment,['deus','sola'].includes(type.owner),type.id);
    }
    assert(sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-tracker')).html.includes('dem-track__grid'));
    const text=read('src/fruit-type-sample.js');
    assert(!/getContext\(\)\.(chat|characters|name1|name2)|chat_metadata|fetch\(/.test(text),'대화 · 캐릭터 · 페르소나를 읽거나 밖으로 보내지 않아요');
});
check('표본은 작게 「표본이에요」로 구분하고, ↺ 는 이름 옆 · 바꾼 값이 있을 때만',()=>{
    const ui=read('src/fruit-type-ui.js');
    assert(ui.includes('data-ft-sample-badge hidden>표본이에요</span>'));
    assert(!ui.includes('>원복</button>'),'글자 「원복」 단추 대신 ↺');
    assert(ui.includes('class="bl-ft-reset"')&&ui.includes("${changed?'':' hidden'}"));
    assert(ui.includes('findFruitPreviewSource(document,typeMatch(type))'),'실제 상태창이 있으면 실제 것이 먼저');
    const css=read('css/79-fruit-type.css');
    assert(/\.bl-ft-reset\{[^}]*width:28px[^}]*border-radius:8px/.test(css)&&/\.bl-ft-reset\{width:32px/.test(css),'테마 ↺ 와 같은 크기(PC 28 · 폰 32)');
    assert(/\.bl-ft-reset\[hidden\]\{display:none!important\}/.test(css));
});
check('채팅 안 데우스 카드 아래에는 바로가기 단추를 새로 붙이지 않아요',()=>{
    const shortcuts=read('src/fruit-type-shortcuts.js');
    assert(shortcuts.includes("const DEUS=FRUIT_TYPES.filter(t=>t.owner==='qingguo')"));
});
check('데우스 2.5 · V3 스킨 = 같은 테마 카드(1.0.0 시안 A), V3 배치는 원작 그대로',()=>{
    const skin=read('css/30-dem-skin.css');
    const CARD=':where(:not(.custom-dem-modules *))',TRACK=':where(:not(:has(> .custom-dem-track__grid)))',ITEM=':where(:not(.custom-dem-track__grid *))';
    assert(skin.includes(`.mes_text details.custom-dem-card${CARD},`)&&skin.includes(`:is(.custom-dem-track, .custom-dem-track-recovery)${TRACK}`)&&skin.includes(ITEM),'2.5 규칙은 무게 0 의 덧붙임으로만 V3 를 빼요');
    const bare=skin.replace(/\/\*[\s\S]*?\*\//g,'');
    for(const rule of bare.split('}')){const head=rule.slice(0,rule.lastIndexOf('{'));if(!/custom-dem-/.test(head)||/8\.0\.6|\.custom-dem-modules|custom-dem-track > \.custom-dem-track__(?:grid|rule)|custom-dem-track:has|\.custom-dem-new-face /.test(rule))continue;   // 1.8.6 V4 새 얼굴 카드(.custom-dem-new-face)는 V4 에만 있는 class — V3 에 안 닿아요
        for(const sel of head.split(/,(?![^(]*\))/))if(/custom-dem-/.test(sel)&&!/:where\(:not\(/.test(sel))assert.fail('V3 에 닿을 수 있는 2.5 규칙: '+sel.trim().slice(-80));}
    const v3=skin.slice(skin.indexOf('/* ---------- 8.0.6 데우스 V3'),skin.indexOf('/* ---------- 폰 접기'));
    assert(v3.includes('.custom-dem-track > .custom-dem-track__grid .custom-dem-track__scene {')&&/custom-dem-track__scene::before \{[^}]*background: var\(--salty-accent\)/.test(v3),'해 궤도 · 해 점은 남겨요(시간 흐름)');
    assert(v3.includes('border-radius: var(--bl-r-md, 12px) !important')&&v3.includes('border: 1px solid var(--salty-line) !important')&&v3.includes('--dem-ink: var(--salty-text)')&&v3.includes('--dem-serif: var(--salty-font-ui'),'원작 색 변수 · 글꼴 자리를 테마 토큰으로 · 테마 카드 규격(면 · 1px 선 · 모서리 12)');
    assert(!/color-mix|box-shadow:\s*0 0|border:\s*2px/.test(v3),'빛무리 · 2px 테두리 · 이름 없는 혼색 없음');
    assert(!/--dem-serif[^;]*!important|font-family[^;]*!important/.test(v3.replace(/\/\*[\s\S]*?\*\//g,'')),'글꼴은 !important 없이 — 상태창 글자 설정이 이겨요');
    assert(!skin.includes('custom-dem-track:not(.bl-dem-shown) > .custom-dem-track__grid'),'V3 트래커는 폰에서도 원작 배치(한 줄 접기 없음)');
});
// 8.1.0 데우스 미리보기 판(2.5 · V3) — 지어낸 규칙만(원작 정규식은 시험에 넣지 않아요)
const v25=[
    script('t25','/<tracker>([^|<]*)\\|([^|<]*)\\|[^<]*<\\/tracker>/g','<div class="dem-track"><div class="dem-track__item dem-track__item--time"><span class="dem-track__value">$1</span></div><div class="dem-track__item"><span class="dem-track__value">$2</span></div></div>'),
    script('s25','/<status>([\\s\\S]*?)<\\/status>/','<details class="dem-card dem-status"><summary>Status</summary><div class="dem-status__body">$1</div></details>',{disabled:true}),
    script('r25','/- (인물 [AB])/g','<div class="dem-status-row"><strong class="dem-status-row__name">$1</strong></div>',{disabled:true}),
];
const v3=[
    script('t3','/<tracker>([^|<]*)\\|([^|<]*)\\|[^<]*<\\/tracker>/g','<div class="dem-track" data-t="$1"><div class="dem-track__grid"><div class="dem-track__date">$2</div></div></div>'),
    script('hide','/(?=<div class="dem-track")/','<style>.dem-track{background:none}</style>',{disabled:true,scriptName:'DEM - Hide @Tracker scene backdrop (enable for settings it cannot fit)'}),
    script('sky','/(?=<div class="dem-track")/','<style>.dem-track__grid{--sky:1}</style>'),
    script('wrap','/^/','<details class="dem-modules"><summary>Modules</summary>',{disabled:true,scriptName:'DEM - UI active modules'}),
    script('st3','/<status>([\\s\\S]*?)<\\/status>/','<details open class="dem-card dem-status"><div class="dem-status__body">$1</div></details>',{disabled:true}),
    script('row3','/- (인물 [AB])/g','<div class="dem-status-row"><strong class="dem-status-row__name">$1</strong></div>',{disabled:true}),
    script('fold','/x/','<div class="dem-x">',{disabled:true,scriptName:'DEM - UI active modules - Collapsed (Enable for collapsed)'}),
];
check('데우스는 고른 판의 정규식 목록만 보고, 판을 모양으로 알아봐요',()=>{
    assert.equal(sample.listVersion(v25),'2.5');assert.equal(sample.listVersion(v3),'v3');assert.equal(sample.listVersion([script('x','/a/','b')]),null);
    assert.equal(sample.tidyDemVersion('2.5'),'2.5');assert.equal(sample.tidyDemVersion('이상한 값'),'v3');assert.equal(sample.tidyDemVersion(undefined),'v3','기본은 V3');
    assert.equal(sample.tidyDemVersion('v4'),'v4');assert.deepEqual(sample.DEUS_VERSIONS.map(([v])=>v),['auto','v4','v3','2.5'],'11-19 기본 「지금 프리셋 따라」 + V4');
    assert.equal(sample.tidyDemChoice(undefined),'auto');assert.equal(sample.tidyDemChoice('v3'),'v3');assert.equal(sample.tidyDemChoice('이상한 값'),'auto');
    const tracker=FRUIT_TYPES.find(t=>t.id==='deus-tracker'),lists=[{where:'a',list:v25},{where:'b',list:v3}];
    assert.equal(sample.pickSampleChain(tracker,lists,'v3').where,'b');assert.equal(sample.pickSampleChain(tracker,lists,'2.5').where,'a');
    assert.equal(sample.pickSampleChain(tracker,[{where:'b',list:v3}],'2.5'),null,'2.5 를 골랐는데 V3 목록만 있으면 기본 표본으로');
    const fruit=FRUIT_TYPES.find(t=>t.id==='status');assert.ok(sample.pickSampleChain(fruit,[{where:'f',list:[script('f','/<status_bar>/','<div class="fate-status-wrapper">')]}],'2.5'),'과일 계열은 판과 상관없어요');
});
check('켜진 카드 규칙이 있으면 켜진 것만(꺼 둔 배경 숨기기는 안 씀), 카드 규칙이 다 꺼져 있으면 「(Enable for …)」 선택 규칙만 빼고 모두',()=>{
    const tracker=FRUIT_TYPES.find(t=>t.id==='deus-tracker'),status=FRUIT_TYPES.find(t=>t.id==='deus-status');
    assert.deepEqual(sample.pickSampleChain(tracker,[{where:'b',list:v3}],'v3').chain.map(s=>s.id),['t3','sky'],'켜진 트래커 규칙 · 하늘만, 꺼 둔 배경 숨기기는 빼요');
    assert.deepEqual(sample.pickSampleChain(status,[{where:'b',list:v3}],'v3').chain.map(s=>s.id),['t3','sky','wrap','st3','row3'],'꺼 둔 모듈은 모양을 보여 주려고 다 쓰되 선택 규칙은 빼요');
    const day=sample.sampleOutput(tracker,[{where:'b',list:v3}],'v3').document;
    assert.equal((day.match(/class="dem-track"/g)||[]).length,2,'낮 · 밤 트래커 둘 다');assert.ok(day.includes('data-t="🕒 3:20 PM "')&&day.includes('data-t="🌙 9:40 PM "'));
    assert.ok(!day.includes('background:none'),'꺼 둔 배경 숨기기 규칙이 해 · 달을 지우지 않아요');
    const st=sample.sampleOutput(status,[{where:'b',list:v3}],'v3').document;
    assert.ok(st.includes('dem-modules')&&st.includes('dem-status-row__name">인물 A')&&st.includes('dem-status-row__name">인물 B'),'V3 는 묶음째, 인물 줄까지');
    assert.ok(!/<(?:relationships|threads|psych|plotlines|momentum|conflict)>/.test(st),'규칙이 없어 그대로 남은 모듈 태그는 빼요');
    const s25=sample.sampleOutput(status,[{where:'a',list:v25}],'2.5').document;
    assert.ok(s25.includes('dem-status__body')&&!s25.includes('dem-modules'),'2.5 는 카드마다 따로');
});
check('표본 글은 꽉 차게: 낮 · 밤(보름) 트래커, 인물 2명 + 접힌 Off-scene 1명, 관계 · 떡밥 · 심리 · 줄거리 · 모멘텀 · 갈등 2~3개씩',()=>{
    assert.equal(sample.DEUS_TRACKERS.length,2);
    const [day,night]=sample.DEUS_TRACKERS;
    assert.ok(/3:20 PM \| 가상력 12년 5월 3일 목요일 \| [^→]+→[^→]+→[^|]+\| ☀️ 맑음, 22°C/.test(day),'시각 · 요일까지 날짜 · 장소 3단 · 날씨 + 기온');
    assert.ok(night.includes('9:40 PM')&&night.includes('5월 16일'),'밤 16일 = 보름달');
    const m=sample.DEUS_V3_MODULES;
    for(const word of ['Physical:','Clothes:','Mental:','Location:','Relationship:','Inventory:','(Off-scene)','<details>','Closeness:','Stage:','Unspoken:','Obstacle:','[Current]','[Unresolved]','[Possible]','[Seed]','<psych>','<plotlines>','Subplots:','<momentum>','<conflict>'])assert.ok(m.includes(word),word);
    assert.equal((m.match(/^- 인물 [AB]/gm)||[]).length>=5,true);
    const s25=sample.SAMPLE_INPUTS_25['deus-status'][0];for(const word of ['Physical:','Clothes:','Mental:','Location:','Relationship (mutual with 나):','Inventory:','(Off-scene)'])assert.ok(s25.includes(word),word);
    for(const id of ['deus-status','deus-threads','deus-psych','deus-plot','deus-momentum','deus-conflict'])assert.equal(sample.sampleInputs(FRUIT_TYPES.find(t=>t.id===id),'v3')[0],m,'V3 는 어느 종류든 묶음 전체');
    const all=JSON.stringify([sample.SAMPLE_INPUTS,sample.SAMPLE_INPUTS_25]);
    assert.ok(!/[A-Z][a-z]+ (?:said|is [A-Z])/.test(all.replace(/인물 [AB] is 나/g,'')),'지어낸 이름(나 · 인물 A · 인물 B)만');
});
const {DEUS_SAMPLES}=await load('src/deus-preview-samples.js');
check('내장 표본도 판마다 원작 구조 그대로(2.5 칸 · V3 격자 · 묶음), 원작 CSS · 그림은 없어요',()=>{
    const t25=sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-tracker'),'2.5').html,t3=sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-tracker'),'v3').html;
    assert.equal((t25.match(/dem-track__item--time/g)||[]).length,2,'2.5 트래커 낮 · 밤');assert.ok(!t25.includes('dem-track__grid'));
    assert.equal((t3.match(/class="dem-track__grid"/g)||[]).length,2,'V3 트래커 낮 · 밤');assert.ok(t3.includes('data-t="3:20 PM"')&&t3.includes('data-t="9:40 PM"'));
    const st25=sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-status'),'2.5').html;
    assert.equal((st25.match(/dem-status-row__name/g)||[]).length,3,'2.5 상태창: 요약 2명 + Off-scene 1명');assert.ok(st25.includes('dem-status__more'));
    const mods=sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-conflict'),'v3').html;
    for(const cls of ['dem-modules','dem-status','dem-relationships','dem-threads','dem-psychological-states','dem-plotlines','dem-momentum-engine','dem-conflict','dem-status__more'])assert.ok(mods.includes(cls),cls);
    const text=JSON.stringify(DEUS_SAMPLES);
    assert.ok(!/<style|<svg|<script|<input|url\(/i.test(text),'원작 CSS · 그림 · 단추는 넣지 않아요');
    assert.ok(!/\.10\b/.test(read('src/deus-preview-samples.js').split('\n')[0]));
    const css=sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-status'),'2.5').css;
    assert.ok(css.includes('.dem-status-row,.dem-psychological-state-row{display:grid'),'원작 CSS 가 없을 때의 최소 배치');
    const own=read('src/fruit-type-preview.js').split('export const DEUS_PREVIEW_CSS=')[1].split('`;')[0];
    assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(own),'최소 배치에는 새 색을 쓰지 않아요(기존 표본 회색 변수만)');
});
check('미리보기 판 고르기: 테마 고르기 부품 그대로, 설정 하나(chat.demPreviewPick · 기본 지금 프리셋 따라), 배지에 판 표시, 대화의 판이 다른 갈래면 고른 판 표본',()=>{
    const ui=read('src/fruit-type-ui.js'),settings=read('src/settings.js'),labels=read('src/settings-labels.js');
    assert.ok(ui.includes("${owner==='deus'?choice('data-ft-demver','미리보기 판',demChoices(),demChoice()):''}"),'데우스만, 상태창 종류와 같은 고르기');
    assert.ok(ui.includes("versionLabel(resolveDemVersion('auto'))")&&!ui.includes('(${versionLabel(demVersion())})'),'「지금 프리셋 따라」 괄호는 고른 판이 아니라 지금 프리셋의 판');
    assert.ok(ui.includes('const demVersion=()=>resolveDemVersion(demChoice());'),'auto 면 지금 프리셋의 판');
    assert.ok(ui.indexOf("choice('data-ft-demver'")<ui.indexOf('<div class="salty-prevbox'),'미리보기 위');
    assert.ok(ui.includes('settings.chat.demPreviewPick=tidyDemChoice(el.value);saveSettings()'));
    assert.ok(ui.includes('buildFruitSample(type,{width,vars,localize,version})'));
    assert.ok(ui.includes('badge.textContent=deus?`표본이에요 · ${versionLabel(version)}`'));
    assert.ok(ui.includes('seen=sourceVersion(source);if(!demSameFamily(seen,demVersion()))'),'대화의 상태창 판이 다른 갈래(2.5 ↔ V3 · V4)면 고른 판 표본');
    assert.ok(settings.includes("if (!['auto', 'v4', 'v3', '2.5'].includes(s.chat.demPreviewPick)) s.chat.demPreviewPick = s.chat.demPreviewVersion === '2.5' ? '2.5' : 'auto';"),'옛 2.5 만 옮기고 나머지는 지금 프리셋 따라');
    assert.ok(labels.includes('"chat.demPreviewPick":"데우스 미리보기 판"')&&labels.includes('"chat.demPreviewPick:v4":"V4"'));
});
// 11-19 V4 표본: 판 알아보기 · 「지금 프리셋 따라」 · 표본 글 · 내장 표본
const v4=[...v3,script('fate','/<fate odds="(\\d+)" roll="(\\d+)">[\\s\\S]*?<\\/fate>/','<div class="dem-fate">rolled $2 · need under $1</div>'),
    script('diary','/<diary>[\\s\\S]*?<\\/diary>/','<details class="dem-card dem-diaries"><div class="dem-diaries__body"></div></details>'),
    script('face','/<face>[\\s\\S]*?Seen as: ([^\\n]+)[\\s\\S]*?<\\/face>/','<details class="dem-card dem-new-face"><summary><span class="dem-card__title">$1</span></summary><div class="dem-new-face__body">\n\n```yaml\n$1\n```\n</div></details>')];
check('V4: 정규식 목록 · 지금 프리셋의 프롬프트 표지로 판을 알고, 「지금 프리셋 따라」 면 그 판 표본',()=>{
    assert.equal(sample.listVersion(v4),'v4');assert.equal(sample.listVersion(v3),'v3');
    const sign=id=>({identifier:id}),V4_IDS=['ecfff91e-43e0-4a5d-8cfe-4d15e56dd55d','de251b02-fb80-4a4a-b312-d83a349826aa'],V3_IDS=['cb1fa811-516f-4a61-aa93-092bb94d5ba3','279618e4-d961-489f-9d2b-56503e0d6067'];
    const ctx=prompts=>({chatCompletionSettings:{prompts}});
    assert.equal(sample.presetDemVersion([],ctx([...V3_IDS,...V4_IDS].map(sign))),'v4','V4 프롬프트 표지');
    assert.equal(sample.presetDemVersion([],ctx(V3_IDS.map(sign))),'v3','V3 프롬프트 표지');
    assert.equal(sample.presetDemVersion([{where:'preset',list:v4}],ctx([])),'v4','표지가 없으면 지금 프리셋 정규식 꼴');
    assert.equal(sample.presetDemVersion([{where:'preset',list:v25}],null),'2.5');
    assert.equal(sample.presetDemVersion([],null),'v3','아무것도 없으면 V3');
    assert.equal(sample.resolveDemVersion('auto',[],ctx([...V3_IDS,...V4_IDS].map(sign))),'v4');assert.equal(sample.resolveDemVersion('v3',[],ctx([...V3_IDS,...V4_IDS].map(sign))),'v3','직접 고르면 그 판');
    assert.ok(sample.demSameFamily('v3','v4')&&!sample.demSameFamily('2.5','v4'),'V4 는 V3 와 같은 갈래');
    const status=FRUIT_TYPES.find(t=>t.id==='deus-status'),tracker=FRUIT_TYPES.find(t=>t.id==='deus-tracker');
    assert.equal(sample.pickSampleChain(status,[{where:'b',list:v3}],'v4'),null,'V4 를 골랐는데 V3 목록만 있으면 기본 V4 표본으로');
    assert.equal(sample.pickSampleChain(status,[{where:'c',list:v4}],'v3').where,'c','V3 표본은 V4 정규식으로도');
    assert.equal(sample.pickSampleChain(status,[{where:'c',list:v4},{where:'b',list:v3}],'v3').where,'b','같은 판 목록이 먼저');
    const out=sample.sampleOutput(status,[{where:'c',list:v4}],'v4').document;
    for(const cls of ['dem-modules','dem-status','dem-fate','dem-diaries','dem-new-face'])assert.ok(out.includes(cls),cls);
    assert.ok(out.includes('<pre><code>정원의 사서</code></pre>')&&!out.includes('```'),'새 얼굴 카드의 코드 칸은 채팅처럼 <pre><code>');
    assert.ok(!/<(?:diary|face|extra)>/.test(out),'규칙이 없어 남은 V4 태그는 빼요');
    assert.deepEqual(sample.sampleInputs(tracker,'v4'),sample.sampleInputs(tracker,'v3'),'트래커는 V3 와 같은 글');
});
check('V4 표본 글 · 내장 표본: 주사위(봉인된 꼴) · 일기장(빈 일기 None) · 새 얼굴 주요 · 단역(비밀 표지 · Seen as) · V3 묶음 그대로 + 원작 CSS · 그림 없음',()=>{
    const m=sample.DEUS_V4_MODULES,f=sample.DEUS_V4_FATE;
    assert.ok(m.startsWith(sample.DEUS_V3_MODULES),'V3 묶음 글 그대로에 더해요');
    for(const word of ['<diary>','<summary>Diaries</summary>','- None','<face>','Name: 인물 C','Seen as: 정원의 사서','(secret)','<extra>인물 D',' · Seen as: 밀짚모자를 쓴 노인</extra>'])assert.ok(m.includes(word),word);
    assert.ok(/<fate odds="\d\d" roll="\d\d">\n<pass>[^<]+<\/pass>\n<fail>[^<]+<\/fail>\n<\/fate>\n<\/prose>$/.test(f),'봉인된 주사위는 본문 끝');
    assert.equal(sample.sampleInputs(FRUIT_TYPES.find(t=>t.id==='deus-status'),'v4')[0],`${f}\n\n${m}`,'묶음 종류는 주사위 본문 + V4 묶음');
    const built=sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-conflict'),'v4').html;
    for(const cls of ['class="dem-fate"','dem-modules','dem-status','dem-conflict','dem-diaries','dem-diary-keeper','dem-diary-none','dem-new-face"','dem-new-face--minor','dem-new-face__keep','<pre><code>'])assert.ok(built.includes(cls),cls);
    assert.ok(built.indexOf('dem-fate')<built.indexOf('dem-modules'),'주사위 막대가 묶음 앞');
    assert.ok(!/<style|<svg|<script|<input|<button|url\(|style="/i.test(JSON.stringify(DEUS_SAMPLES.v4)),'원작 CSS · 그림 · 단추 · 인라인 색은 넣지 않아요');
    assert.ok(!/copy this card|outgrows your context/i.test(JSON.stringify(DEUS_SAMPLES.v4)),'새 얼굴 카드의 긴 원작 안내 문장은 옮기지 않아요');
    assert.equal(sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-tracker'),'v4').html,sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-tracker'),'v3').html,'트래커는 V3 와 같아요');
    assert.equal(sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-cyoa'),'v4').html,sample.builtinSample(FRUIT_TYPES.find(t=>t.id==='deus-cyoa'),'v3').html,'묶음 밖 카드도 같아요');
    assert.ok(read('src/deus-preview-samples.js').split('\n').slice(0,8).join('\n').includes('2.5 · V3 · V4 프리셋의 표시 정규식'),'출처 머리말에 V4');
});
check('테두리 빛 · 카드 스킨 · 이모티콘 · 색 통일을 바꾸면 표본이 바로 바뀌어요(body class · 테마 변수 감시, 닫으면 뗌)',()=>{
    const ui=read('src/fruit-type-ui.js');
    assert.ok(ui.includes("onThemeLook(onLook,{watch:'body.class vars'")&&ui.includes("watchDom(document.body,{attributes:['data-bl-dem-fold']"),'body 클래스와 폰 접기 속성(9.0.4 테마 색 따라가기 한 구독 · 공용 감시 허브)');
    assert.ok(ui.includes("['salty-vars','salty-dem-vars']"),'테마 변수 style 과 테두리 빛 시트(--bl-dem-glow, src/dem-glow.js) 둘 다');
    assert.ok(ui.includes("getSettings().chat?.demGlow")&&!ui.includes("getPropertyValue('--bl-dem-glow')"),'테두리 빛은 설정값으로(계산 스타일을 읽지 않음)');
    assert.ok(ui.includes('for(const off of lookOffs)off();clearTimeout(lookTimer);'),'창을 닫으면 감시를 떼요');
    for(const cls of ['salty-dem-skin','salty-regex-noicons','salty-unify-regex']){const css=read('style.css')+read('src/preview.gen.css');   // 9.0.1 미리보기 전용 규칙은 src/preview.gen.css 로 떼어 둬요
        assert.ok(new RegExp(`body\\.salty\\.${cls}[^{]*\\.salty-preview`).test(css),`${cls} 규칙이 미리보기 자리(.salty-preview)에도 닿아요`);}
    const host=read('src/fruit-type-sample.js');assert.ok(host.includes("host.className='salty-preview bl-ft-sample-host'"));
});
console.log(`fruit-type-sample: ${passed} passed`);
