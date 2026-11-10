// 1.0.x 상태창 글자: 프리셋 정규식이 그리는 꾸밈 블록 전부를 같은 설정 구조(종류 · 영역 · 글자 값)로 꾸며요
//   데우스 V3 — 장면 계획 · 선택지 · 관계 · 한편 · 숨은 진실 · 물밑 흐름 · 퇴고 메모 · 친구들 · OOC 쪽지 · 형식 확인 알림 · 모듈 묶음
//   원작 정규식 · HTML 은 시험에 넣지 않아요. 지어낸 규칙과 테마의 지어낸 표본만 써요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const load=file=>import(pathToFileURL(path.join(root,file)));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const schema=await load('src/fruit-type-schema.js');
const tidyMod=await load('src/fruit-type-tidy.js');
const sample=await load('src/fruit-type-sample.js');
const {fruitTypePreview}=await load('src/fruit-type-preview.js');
const {FRUIT_TYPES,tidyFruitType,fruitTypeCss,typeMatch,splitList,DEUS_WEIGHT}=schema;
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('ok',name);};
const NEW_DEUS=['deus-scene-plan','deus-cyoa','deus-relationships','deus-meanwhile','deus-truths','deus-undercurrents','deus-scratchpad','deus-companions','deus-phi-note','deus-notice','deus-modules','deus-thinking','deus-tail'];
const byId=id=>FRUIT_TYPES.find(t=>t.id===id);

check('시작용 모양 표(fruit-type-tidy.js)와 전체 목록이 같아요 — id · 주인 · 영역 키 · 배치',()=>{
    assert.deepEqual(tidyMod.TYPE_SHAPES.map(t=>[t.id,t.owner,Object.keys(t.regions).join(','),t.layout,t.decor]),
        FRUIT_TYPES.map(t=>[t.id,schema.typeOwner(t),Object.keys(t.regions).join(','),!!t.layout,!!t.decor]));
    assert.ok(read('src/settings.js').includes("import { tidyFruitType } from './fruit-type-tidy.js';"),'시작 그래프에는 고르기만');
    assert.ok(!/from '\.\/fruit-type-schema\.js'/.test(read('src/settings.js')));
});
check('데우스 꾸밈 블록 20종: 장면 계획 등 13종이 같은 꼴(이름 · 뿌리 · 영역 [이름, 선택자])로 더해졌어요',()=>{
    const deus=FRUIT_TYPES.filter(t=>t.owner==='deus');
    assert.equal(deus.length,20);
    for(const id of NEW_DEUS){const t=byId(id);assert.ok(t,id);assert.equal(t.layout,false,id);assert.ok(t.name&&t.prompt&&t.root,id);
        for(const [key,[label,sel]] of Object.entries(t.regions)){assert.ok(/^[a-z]+$/.test(key)&&label&&sel,`${id}.${key}`);assert.ok(splitList(sel).every(s=>s.trim()),`${id}.${key} 선택자`);}}
    assert.equal(byId('deus-thinking').root,'details[data-dem-thinking-fallback]','생각 계획: 태그 + 값 없는 속성(빠른 판정이 태그로 걸러요)');
    assert.deepEqual(byId('deus-tail').regions,{info:['별 글자','&']},'뿌리 자신은 &');
    assert.equal(byId('deus-scene-plan').name,'장면 계획');
    assert.deepEqual(Object.keys(byId('deus-scene-plan').regions),['names','phase','label','info'],'제목 · 단계 이름 · 항목 이름 · 항목 내용');
    assert.deepEqual(new Set(FRUIT_TYPES.map(t=>t.id)).size,FRUIT_TYPES.length,'id 겹침 없음');
    assert.deepEqual(new Set(FRUIT_TYPES.map(t=>t.prompt)).size,FRUIT_TYPES.length,'빠른 설정 연결 id 겹침 없음');
});
check('기존 종류에는 빠진 역할만 더하고 예전 키 · 저장 값은 그대로예요',()=>{
    assert.deepEqual(Object.keys(byId('deus-status').regions),['info','names','quote','label']);
    assert.deepEqual(Object.keys(byId('deus-threads').regions),['info','names','tag']);
    const old={on:true,kind:'deus-status',types:{'deus-status':{regions:{info:{on:true,size:20,weight:700}}}}};
    const s=tidyFruitType(old);
    assert.equal(s.types['deus-status'].regions.info.size,20);assert.equal(s.types['deus-status'].regions.info.weight,700);
    assert.equal(s.types['deus-status'].regions.label.on,false,'새 역할은 꺼진 채로');
    assert.equal(s.types['deus-scene-plan'].regions.label.on,false);
});
check('기본값은 지금 화면 그대로: 아무 영역도 켜지 않으면 규칙이 하나도 없어요(글자 설정을 켜도)',()=>{
    for(const ownerOn of [{deus:true},{deus:true,fruit:true}]){const s=tidyFruitType({on:true,ownerOn});assert.equal(fruitTypeCss(s),'',JSON.stringify(ownerOn));}
    const s=tidyFruitType({on:true,ownerOn:{deus:true}});for(const id of NEW_DEUS){const r=s.types[id];assert.ok(Object.values(r.regions).every(x=>!x.on&&x.size===16&&x.font==='original'),id);assert.equal(r.hideFooter,false,id);}
});
check('저장 → 불러오기: 고른 값이 그대로 돌아와요(JSON 왕복)',()=>{
    const s=tidyFruitType({on:true,ownerOn:{deus:true}});
    Object.assign(s.types['deus-scene-plan'].regions.label,{on:true,font:'nanum-gothic',size:18,weight:700,italic:true,spacing:-.5,line:1.4,align:'center',wrap:'word'});
    s.types['deus-undercurrents'].hideFooter=true;s.kind='deus-scene-plan';s.ownerKinds.deus='deus-scene-plan';
    const back=tidyFruitType(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(back.types['deus-scene-plan'],s.types['deus-scene-plan']);assert.equal(back.types['deus-undercurrents'].hideFooter,true);
    assert.equal(back.ownerKinds.deus,'deus-scene-plan');
    assert.equal(tidyFruitType({kind:'deus-없는-종류'}).kind,'status','모르는 종류는 기본으로');
});
check('켠 영역만 그 블록에 닿고, 데우스 규칙은 카드 스킨(id 하나 + class 넷)보다 무거워요',()=>{
    const s=tidyFruitType({on:true,ownerOn:{deus:true}});Object.assign(s.types['deus-scene-plan'].regions.label,{on:true,size:19});
    const css=fruitTypeCss(s);
    // 1.1.1 restyle2: 맨 오른쪽 class 는 .a · .custom-a 두 갈래(크롬 규칙 바구니), 조상 칸은 :is 그대로
    assert.ok(css.includes(':is(.dem-scene-plan,.custom-dem-scene-plan)')&&css.includes(' .dem-scene-plan__label')&&css.includes(' .custom-dem-scene-plan__label')&&css.includes('font-size:19px!important'));
    assert.ok(!css.includes('dem-scene-plan__value')&&!css.includes('dem-scene-plan__phase'),'켜지 않은 영역은 없음');
    assert.ok(css.startsWith(':is(:is(.mes_text,.custom-mes_text),#bl-ft-weight#bl-ft-weight)'),'무게');
    assert.equal(DEUS_WEIGHT,':is(.mes_text,#bl-ft-weight#bl-ft-weight)');
    // 무게 셈: :is 는 가장 무거운 항목 — id 둘. 스킨은 :is(#chat, …) 로 id 하나
    const weight=sel=>{let a=0,b=0,c=0;const walk=x=>{x=x.replace(/:is\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,(m,inner)=>{const best=splitList(inner).map(weight).sort((p,q)=>p[0]-q[0]||p[1]-q[1]||p[2]-q[2]).pop();a+=best[0];b+=best[1];c+=best[2];return ' ';});a+=(x.match(/#[\w-]+/g)||[]).length;b+=(x.match(/\.[\w-]+|:(?!is|where)[\w-]+/g)||[]).length;c+=(x.match(/(^|[\s>+~])[a-z]+/gi)||[]).length;};walk(sel);return [a,b,c];};
    const mine=weight(css.split('{')[0]),skin=weight('body.salty.salty-dem-skin :is(#chat, .cg-root, .salty-preview) .mes_text .custom-dem-scene-plan__label');
    assert.ok(mine[0]>skin[0]||(mine[0]===skin[0]&&mine[1]>skin[1]),`${mine} > ${skin}`);
    // 과일 계열(iframe 안)은 무게를 더하지 않아요
    const f=tidyFruitType({on:true});f.types.status.regions.quote.on=true;assert.ok(!fruitTypeCss(f).includes('bl-ft-weight'));
});
check(':is( , ) 안 쉼표는 나누지 않아요 — 한 영역 선택자가 통째로 한 갈래',()=>{
    assert.deepEqual(splitList('.a,.b'),['.a','.b']);assert.deepEqual(splitList(':is(.a,.b) .c,.d'),[':is(.a,.b) .c','.d']);
    const s=tidyFruitType({on:true,ownerOn:{deus:true}});s.types['deus-relationships'].regions.meter.on=true;
    // 1.1.1 restyle2: 맨 오른쪽 class 는 .a · .custom-a 두 갈래로 적혀 목록은 길어져도, 갈래마다 무게는 하나
    const rule=fruitTypeCss(s).split('\n')[0];for(const branch of splitList(rule.split('{')[0]))assert.equal((branch.match(/bl-ft-weight#bl-ft-weight/g)||[]).length,1,'갈래마다 무게 하나');
});
check('하단 문구 숨김(물밑 흐름의 다음 턴 안내)은 예전 hideFooter 그대로',()=>{
    const s=tidyFruitType({on:true,ownerOn:{deus:true}});s.types['deus-undercurrents'].hideFooter=true;
    assert.ok(fruitTypeCss(s).includes('.custom-dem-undercurrents__notice{display:none!important'));
});
check('표본: 대화에 없으면 지어낸 글로 — 종류마다 표본 글 · 기본 뼈대가 있고 그 블록 · 역할 class 가 나와요',()=>{
    for(const id of NEW_DEUS){const t=byId(id);assert.ok(sample.sampleInputs(t,'v3').length,id);
        for(const v of ['v3','2.5']){const html=sample.builtinSample(t,v).html;const mark=(t.root.match(/\.([\w-]+)/)||t.root.match(/\[([\w-]+)/))[1];assert.ok(html.includes(mark),`${id} ${v}`);}}
    const plan=fruitTypePreview('deus-scene-plan');
    for(const cls of ['dem-card__title','dem-scene-plan__phase','dem-scene-plan__label','dem-scene-plan__value'])assert.ok(plan.includes(cls),cls);
    const all=JSON.stringify([sample.DEUS_SCENE_PLAN,sample.DEUS_CYOA,sample.DEUS_COMPANIONS,sample.DEUS_OOC,sample.DEUS_NOTICES,fruitTypePreview('deus-cyoa'),fruitTypePreview('deus-companions')]);
    assert.ok(all.includes('세라피나'),'예시 인물은 세라피나');
    const extra=read('src/fruit-type-preview.js').split('const DEUS_EXTRA=')[1].split('\n')[0];
    assert.ok(!/<style|<svg|<script|<input|url\(|base64/i.test(extra),'원작 CSS · 그림 · 단추 없음');
    assert.ok(!/Swipe to retry|Choose one, combine|Your next turn decides/.test(extra+all),'원작 안내 문장을 옮기지 않아요');
});
check('표본 글을 지어낸 정규식으로 바꾸면 그 블록이 나와요(장면 계획 · 형식 알림 둘 다)',()=>{
    const script=(id,find,replace,extra={})=>({id,scriptName:id,findRegex:find,replaceString:replace,placement:[2],disabled:false,...extra});
    const list=[script('plan','/<scene_plan>[\\s\\S]*?<details>\\n?([\\s\\S]*?)<\\/details>\\n?<\\/scene_plan>/','<details class="dem-card dem-scene-plan"><summary><span class="dem-card__title">계획</span></summary><div class="dem-scene-plan__body">$1</div></details>'),
        script('row','/(?:^|(?<=>))(Context|Constraints|Narrative Style|Prose Plan): (.*)$/gm','<div class="dem-scene-plan__step"><span class="dem-scene-plan__label">$1</span><span class="dem-scene-plan__value">$2</span></div>'),
        script('miss','/^\\s*((?:<dem_missed>[^<]*<\\/dem_missed>\\s*)+)/','<div class="dem-format-note">$1</div>'),
        // V3 목록 표시(묶음 규칙) — 데우스는 고른 판(V3)의 목록만 봐요
        script('wrap','/^$/','<details class="dem-modules">',{disabled:true}),
        script('color','/^\\s*<dem_uncolored><\\/dem_uncolored>\\s*/','<div class="dem-dialogue-note">대사</div>')];
    const plan=sample.sampleOutput(byId('deus-scene-plan'),[{where:'t',list}],'v3');
    assert.ok(plan&&(plan.document.match(/dem-scene-plan__label/g)||[]).length===4,'단계 넷');
    const note=sample.sampleOutput(byId('deus-notice'),[{where:'t',list}],'v3');
    assert.ok(note&&note.document.includes('dem-format-note')&&note.document.includes('dem-dialogue-note'),'뿌리 class 가 여럿이어도 둘 다');
});
check('V3 묶음 표본에 한편 · 숨은 진실 · 물밑 흐름 · 퇴고 메모가 들어 있고, 규칙 없어 남은 태그는 빼요',()=>{
    for(const tag of ['<meanwhile>','<truths>','<undercurrents>','<scratchpad>'])assert.ok(sample.DEUS_V3_MODULES.includes(tag),tag);
    const text=read('src/fruit-type-sample.js');assert.ok(/LEFT_TAGS=\/<\(status\|relationships\|threads\|psych\|plotlines\|momentum\|conflict\|meanwhile\|truths\|undercurrents\|scratchpad\)>/.test(text));
});
const search=await load('src/settings-search.js');
check('설정 검색 낱말',()=>{for(const q of ['장면 계획','씬 플랜','scene plan','숨은 진실','물밑 흐름'])assert.ok(search.searchSettings(q).some(e=>e.title==='데우스 상태창 글자'&&e.anchor==='상태창 글자'),q);});
check('켜기만 해서는 모양이 바뀌지 않게: 손대지 않은 영역을 스위치로 켜면 미리보기의 지금 글자 값에서 시작해요',()=>{
    const ui=read('src/fruit-type-ui.js');
    assert.ok(ui.includes("if(key==='on'&&el.checked&&!regionChanged(r)){const shown=shownRegion(s.kind,el.dataset.region);"));
    assert.ok(/function shownRegion\(kind,key\)\{[\s\S]*?getComputedStyle\(el\)[\s\S]*?size:clamp\(size,8,64\)/.test(ui));
    assert.ok(ui.includes('commit(s);if(a.seeded)paint();'), '11-03: 값이 바뀌면 commit(끄는 동안은 미리보기 CSS 임시 · 숫자 칸은 즉시 · 슬라이더는 300ms 멈춤 뒤) · 슬라이더가 읽어 온 값(seeded)이면 다시 그림');
});
check('장식 색: 기본은 강조색(글자 설정을 켜지 않아도 · 카드 스킨일 때), 켜면 종류마다 고른 팔레트 색 · 원작 색은 손대지 않아요',()=>{
    assert.deepEqual(schema.DECOR_CHOICES.map(([k])=>k),['accent','text','muted','line','original']);
    const base=schema.fruitDecorCss({});
    assert.ok(base.includes('.custom-dem-tail{color:var(--salty-accent)!important'),'본문 끝 ✦ 는 인라인 갈색 대신 강조색');
    assert.ok(base.includes('body:is(.salty-dem-skin,.custom-salty-dem-skin)'),'카드 스킨일 때만(원작 그대로 모드는 손대지 않음)');
    assert.ok(/dem-card__icon,\.custom-dem-card__icon\) svg[^{]*\{filter:url\(#bl-decor-accent\)!important\}/.test(base),'카드 아이콘 그림은 팔레트 색 필터(명암은 불투명도로)');
    const f=schema.decorFilterMarkup();assert.ok(f.includes('id="bl-decor-accent"')&&f.includes('flood-color:var(--salty-accent)')&&!f.includes('bl-decor-original'),'필터는 팔레트 토큰마다 · 원작 색은 없음');
    assert.ok(base.includes(':is(.dem-charpage__head,.custom-dem-charpage__head) > summary::before')&&base.includes('.custom-dem-modules::after')&&base.includes('::after{filter:url(#bl-decor-accent)'),'가상 요소 배경 그림(인물 쪽 가면 · 인물 줄 아이콘)도');assert.ok(!/#[0-9a-f]{3,8}\b/i.test(f),'필터에 새 색 없음');
    assert.ok(base.includes('dem-tab__icon')&&base.includes('dem-modules__icon'),'묶음 · 탭 아이콘');
    assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(|color-mix/i.test(base),'새 색 · 혼색 없이 팔레트 토큰만');
    const off=tidyFruitType({on:true,ownerOn:{deus:false},types:{'deus-tail':{decor:'muted'}}});assert.ok(schema.fruitDecorCss(off).includes('.custom-dem-tail{color:var(--salty-accent)'),'글자 설정을 끄면 고른 값 대신 기본(강조색)');
    const on=tidyFruitType({ownerOn:{deus:true},types:{'deus-tail':{decor:'muted'},'deus-status':{decor:'original'}}});const css=schema.fruitDecorCss(on);
    assert.ok(css.includes('.custom-dem-tail{color:var(--salty-muted)'));assert.ok(!/dem-status,\.custom-dem-status\) \.(custom-)?dem-card__icon/.test(css),'원작 색은 규칙 없음');
    assert.equal(tidyFruitType({types:{'deus-tail':{decor:'#ff0000'}}}).types['deus-tail'].decor,'accent','팔레트 밖 값은 기본으로');
    assert.equal(tidyFruitType({}).types.status.decor,undefined,'장식 없는 종류는 값도 없어요');
    assert.equal(fruitTypeCss(tidyFruitType({on:true,ownerOn:{deus:true}})),'','장식 색은 글자 규칙(켠 영역)과 따로');
    const rt=read('src/fruit-type-runtime.js');assert.ok(rt.includes('paintDecor(config);')&&rt.includes("decor.dataset.blFruitDecor=''"),'채팅 문서에 한 벌');
    const ui=read('src/fruit-type-ui.js');assert.ok(ui.includes("${type.decor?choice('data-ft-decor','장식 색',DECOR_CHOICES,config.decor||'accent'):''}"),'정보 배치와 같은 고르기 칸');
});
check('생각 계획(대체용) 카드: 속성 뿌리도 원작 규칙을 골라 표본을 만들어요',()=>{
    const script=(id,find,replace)=>({id,scriptName:id,findRegex:find,replaceString:replace,placement:[2],disabled:false});
    const list=[script('wrap','/^/','<details class="dem-modules"></details>'),script('think','/^(Context:[\\s\\S]*?)(?=<prose>)/','<details open data-dem-thinking-fallback="1"><summary><span>계획</span></summary><div data-dem-thinking-fallback-body="1">$1</div></details>')];
    list[0].disabled=true;
    const out=sample.sampleOutput(byId('deus-thinking'),[{where:'t',list}],'v3');
    assert.ok(out&&out.document.includes('data-dem-thinking-fallback="1"'));
    assert.ok(fruitTypePreview('deus-thinking').length>0);
});
const NEW_FRUIT=['fruit-choices','fruit-theater','fruit-reverie','fruit-summary'];
check('과일 계열 꾸밈 블록 4종: 냥냥 선택기 · 글자만 극장 · 슈퍼 서문 · 요약(유령) — 과일 한글화 사전 이름 그대로, 같은 꼴',()=>{
    assert.equal(FRUIT_TYPES.filter(x=>schema.typeOwner(x)==='fruit').length,12);
    for(const id of NEW_FRUIT){const x=byId(id);assert.ok(x&&x.owner===undefined&&x.prompt&&x.root,id);assert.ok(sample.sampleInputs(x).length,id);assert.ok(sample.builtinSample(x).html.length>100,id);
        for(const [key,[label,sel]] of Object.entries(x.regions))assert.ok(label&&splitList(sel).every(s=>s.trim()),id+'.'+key);}
    assert.deepEqual(byId('fruit-choices').aliases,['1b49d2d0-f130-4a91-a48d-90155c63cc6d','858c394e-17ff-4937-b5de-2e06e4e4f729'],'냥냥 선택기 세 갈래 모두 바로가기');
    assert.ok(!schema.FRUIT_UNSUPPORTED.some(n=>n.includes('요약')),'요약(유령 모드)은 이제 지원');
    const all=JSON.stringify(NEW_FRUIT.map(id=>[sample.sampleInputs(byId(id)),sample.builtinSample(byId(id)).html]));
    assert.ok(all.includes('세라피나'));assert.ok(!/<script|<style|https?:/i.test(all),'표본 · 뼈대에 스크립트 · 바깥 주소 없음');
});
check('과일 장식 색: iframe 안은 지금 팔레트 값으로 풀어 넣고(변수 없음), 채팅 본문 요약은 테마 변수, 원작 색은 손대지 않아요',()=>{
    const css=schema.fruitDecorCss({},{owners:['fruit'],resolve:c=>({accent:'rgb(1, 2, 3)'})[c]||''});
    assert.ok(css.includes('{color:rgb(1, 2, 3)!important')&&!css.includes('var(--salty'),'iframe 용은 값');
    assert.ok(!css.includes('dem-'),'iframe 용에는 데우스 없음');
    assert.equal(schema.fruitDecorCss({},{owners:['fruit'],resolve:()=>'red;}x{'}),'','값 검사');
    assert.ok(schema.fruitDecorCss({}).includes(':is(.meow-fm-ghost,.custom-meow-fm-ghost) > div:last-child{color:var(--salty-accent)!important'),'채팅 본문 요약 꼬리 표정');
    const orig=tidyFruitType({ownerOn:{fruit:true},types:{'fruit-choices':{decor:'original'}}});assert.ok(!schema.fruitDecorCss(orig,{owners:['fruit'],resolve:()=>'#000'}).includes('cat-kaomoji'));
    const rt=read('src/fruit-type-runtime.js');assert.ok(rt.includes("fruitDecorCss(config,{owners:['fruit'],resolve:tokenValue})")&&rt.includes('readPalette()!==paletteSig'),'팔레트가 바뀌면 다시 풀어요');
});
const SOLA=FRUIT_TYPES.filter(x=>x.owner==='sola');
check('솔라 4: 서랍 카드 20종 + 생각 캡슐 · 본문 속 쪽지 — 같은 꼴(제목 · 꼬리표 · 본문 · 항목 이름 · 연출 메모), 설정 › 프롬프트 › 솔라',()=>{
    assert.equal(SOLA.length,22);assert.ok(SOLA.every(x=>schema.typeOwner(x)==='sola'));
    for(const x of SOLA){assert.ok(sample.sampleInputs(x).length,x.id);const b=sample.builtinSample(x);assert.ok(b.html.length>100&&b.fragment,x.id);}
    const s=tidyFruitType({ownerOn:{sola:true},ownerKinds:{sola:'sola-bond'}});assert.equal(s.ownerKinds.sola,'sola-bond');assert.equal(tidyFruitType({}).ownerKinds.sola,'sola-ooc');
    s.types['sola-bond'].regions.names.on=true;const css=fruitTypeCss(s);
    assert.ok(css.startsWith(':is(:is(.mes_text,.custom-mes_text),#bl-ft-weight#bl-ft-weight) :is(.sola-card-bond,.custom-sola-card-bond) > summary .sola-drawer-title'),'채팅 본문이라 무게, 묶음(HUD) 안 다른 카드 제목은 > summary 로 비켜요');
    assert.ok(!fruitTypeCss(tidyFruitType({on:false,ownerOn:{sola:false},types:{'sola-bond':{regions:{names:{on:true}}}}})),'솔라 글자 설정을 끄면 원작 그대로');
    const decor=schema.fruitDecorCss({});assert.ok(decor.includes(':is(.sola-card-bond,.custom-sola-card-bond) > summary .track-icon')&&decor.includes(':is(.sola-card-bond,.custom-sola-card-bond) > summary .custom-track-icon'),'솔라 서랍 아이콘 · 화살표 장식도 강조색');
    assert.ok(read('src/panel.js').includes("['sola', '솔라']")&&read('src/panel.js').includes("fruitTypographyGroup('sola')"));
    assert.ok(read('src/settings-screens.js').includes("'prompt/sola': 'fa-sun'"));
    assert.ok(search.searchSettings('솔라 상태창').some(e=>e.title==='솔라 상태창 글자'));
    const all=JSON.stringify(SOLA.map(x=>[sample.sampleInputs(x),sample.builtinSample(x).html]));assert.ok(all.includes('세라피나')&&!/<script|<style|https?:/i.test(all));
});
check('미리보기: 장식 색 필터를 미리보기 문서에도 지금 팔레트 값으로 넣고, 판(2.5 · V3) 비교는 2.5 에도 있는 종류만',()=>{
    const ui=read('src/fruit-type-ui.js');
    assert.ok(ui.includes('if(!copyFruitPreview(root,d))return;shareDecorFilters(d);')&&ui.includes("return;}shareDecorFilters(d);previewKind=s.kind"),'표본 · 실제 상태창 둘 다');
    assert.ok(ui.includes('function shareDecorFilters(d){')&&ui.includes('decorFilterMarkup(k=>st.getPropertyValue('),'지금 팔레트 값');
    assert.ok(ui.includes("VERSIONED.has(s.kind)&&sourceVersion(source)!==demVersion()"),'장면 계획 같은 묶음 밖 카드를 2.5 로 잘못 보지 않아요');
    assert.ok(schema.decorFilterMarkup(k=>k==='accent'?'rgb(9, 8, 7)':'red;x').includes('flood-color:rgb(9, 8, 7)')&&schema.decorFilterMarkup(()=>'red;x').includes('flood-color:var(--salty-text)'),'값 검사 · 못 쓰면 변수');
});
console.log(`status-type-blocks: ${passed} passed`);
