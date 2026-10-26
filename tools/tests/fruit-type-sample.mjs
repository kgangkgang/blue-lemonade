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
    assert.equal(stCss('.a .b{line-height:1.6;font-family:"A.B"}\n.c{x:0.5}'),':is(.a,.custom-a) :is(.b,.custom-b){line-height:1.6;font-family:"A.B"}\n:is(.c,.custom-c){x:0.5}');
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
    assert(css.includes(':is(.dem-track__grid,.custom-dem-track__grid){grid-template-columns:minmax(0,1fr)!important'),'V3 세로 배치는 안쪽 격자를 한 줄씩');
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
check('15종 모두 표본 글 · 기본 표본이 있고, 기본 시간 표시는 V3 모양이에요',()=>{
    assert.equal(FRUIT_TYPES.length,15);
    for(const type of FRUIT_TYPES){
        assert(sample.SAMPLE_INPUTS[type.id]?.length,type.id);
        const b=sample.builtinSample(type);assert(b.html.length>100&&b.origin==='builtin',type.id);
        assert.equal(b.fragment,type.owner==='deus',type.id);
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
check('데우스 V3 트래커도 테마 카드 스킨(한 판 · 장면 빼기 · 폰 한 줄)을 받아요',()=>{
    const skin=read('css/30-dem-skin.css');
    for(const name of ['.custom-dem-track > .custom-dem-track__grid','.custom-dem-track__scene','.custom-dem-track > .custom-dem-track__rule','.custom-dem-track:not(.bl-dem-shown) > .custom-dem-track__grid'])assert(skin.includes(name),name);
    assert(skin.includes(':where(body.salty.salty-dem-skin :is(#chat, .cg-root, .salty-preview) .mes_text) .custom-dem-track__clock'),'시각 글자는 꾸미기가 이기게 무게를 낮춰요');
});
console.log(`fruit-type-sample: ${passed} passed`);
