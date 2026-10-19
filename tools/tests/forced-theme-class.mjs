// 7.2.4 바깥 확장(quiet-notes 일코 모드 2.5.0)이 body.salty 를 붙였다 뗐다 해도 확장만 모드의 채팅 · 서랍 배경이 사라지지 않는지.
// - window.Salty.getSettings().enabled 는 테마가 화면에 켜져 있는지(사용 모드까지) — 확장만 모드면 false (usage-mode.js publicSettings)
// - 테마가 빠진 모드에서 바깥이 붙인 salty 는 뗀다, 뗀 것은 되돌리지 않는다, 끝없이 싸우지 않는다 (usage-mode.js forcedThemeGuard)
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {themeEnabled,publicSettings,forcedThemeGuard}=await import(new URL('src/usage-mode.js',root));
const {DEFAULTS}=await import(new URL('src/settings.js',root));

// quiet-notes 2.5.0 index.js syncBlue 와 같은 계산 — 테마가 돌려준 enabled 와 일코 상태로 body.salty 를 어디에 둘지
function quietNotesWants({blueEnabled,ilkoOn,bodyHasSalty,blueWasOn}){
    if(typeof blueEnabled==='boolean')blueWasOn=blueEnabled;
    else if(!ilkoOn&&bodyHasSalty)blueWasOn=true;
    return {showBlue:blueWasOn&&!ilkoOn,blueWasOn};
}

// 1. 공개 보기: 확장만 모드에서 enabled=false, 다른 칸은 원본과 같은 것, 고치면 원본에 적힘
for(const [mode,enabled,expected] of [['both',true,true],['theme',true,true],['extensions',true,false],['both',false,false],['extensions',false,false]]){
    const s=structuredClone(DEFAULTS);s.usageMode=mode;s.enabled=enabled;s.palette='night';
    const view=publicSettings(s);
    assert.equal(view.enabled,expected,`${mode} enabled=${enabled}`);
    assert.equal(view.enabled,themeEnabled(s),'공개 enabled = themeEnabled');
    assert.equal(view.usageMode,mode);assert.equal(view.palette,'night');assert.equal(view.addons,s.addons,'중첩 칸은 같은 객체');
    view.palette='white';assert.equal(s.palette,'white','고치면 원본에');
    assert.equal(JSON.stringify({...JSON.parse(JSON.stringify(view)),enabled:null}),JSON.stringify({...s,enabled:null}),'나머지는 그대로');
}
{   // 공개 보기로 enabled 를 끄면 원본이 꺼진다 (콘솔 · 시험용 경로)
    const s=structuredClone(DEFAULTS);s.usageMode='extensions';const view=publicSettings(s);
    view.enabled=false;assert.equal(s.enabled,false);assert.equal(publicSettings(s).enabled,false);
}

// 2. quiet-notes 가 공개 보기를 읽으면: 확장만 모드에선 일코를 꺼도 salty 를 붙이지 않고, 테마+확장에선 일코 ON 이 테마를 끄고 OFF 가 되돌린다
{
    const ext=structuredClone(DEFAULTS);ext.usageMode='extensions';
    const both=structuredClone(DEFAULTS);both.usageMode='both';
    let state={blueWasOn:false};
    for(const ilkoOn of [true,false,true,false]){state=quietNotesWants({blueEnabled:publicSettings(ext).enabled,ilkoOn,bodyHasSalty:false,blueWasOn:state.blueWasOn});assert.equal(state.showBlue,false,`확장만 · 일코 ${ilkoOn?'ON':'OFF'}: salty 를 붙이지 않는다`);}
    // 7.2.3 까지: enabled=true 를 보고 일코 OFF 에 salty 를 붙였다 (제보 재현)
    assert.equal(quietNotesWants({blueEnabled:ext.enabled,ilkoOn:false,bodyHasSalty:false,blueWasOn:false}).showBlue,true,'원본 enabled 를 읽으면 붙였다');
    state={blueWasOn:true};
    state=quietNotesWants({blueEnabled:publicSettings(both).enabled,ilkoOn:true,bodyHasSalty:true,blueWasOn:state.blueWasOn});assert.equal(state.showBlue,false,'테마+확장 · 일코 ON: 테마를 끈다');
    state=quietNotesWants({blueEnabled:publicSettings(both).enabled,ilkoOn:false,bodyHasSalty:false,blueWasOn:state.blueWasOn});assert.equal(state.showBlue,true,'테마+확장 · 일코 OFF: 되돌린다');
}

// 3. 지킴이: 테마가 빠진 모드에서만 salty 를 떼고, 테마가 켜져 있으면(일코가 뗀 상태 포함) 아무것도 안 하며, 싸움은 2초 6번에서 멈춘다
{
    const fakeList=(...classes)=>{const set=new Set(classes);return {contains:c=>set.has(c),remove:c=>set.delete(c),add:c=>set.add(c),has:c=>set.has(c)};};
    let themeOn=false,now=0;const warnings=[];
    const guard=forcedThemeGuard({themeOn:()=>themeOn,now:()=>now,warn:m=>warnings.push(m)});
    const body=fakeList('salty','no-blur');
    assert.equal(guard(body),true);assert.equal(body.has('salty'),false,'확장만: 붙인 salty 를 뗀다');assert.equal(body.has('no-blur'),true,'다른 클래스는 그대로');
    assert.equal(guard(body),false,'없으면 아무것도 안 한다');
    themeOn=true;body.add('salty');assert.equal(guard(body),false);assert.equal(body.has('salty'),true,'테마가 켜져 있으면 두고 본다');
    body.remove('salty');assert.equal(guard(body),false);assert.equal(body.has('salty'),false,'뗀 것은 되돌리지 않는다 (일코 ON)');
    themeOn=false;now+=3000; // 처음 뗀 것은 2초 창 밖으로
    for(let k=0;k<6;k++){now+=100;body.add('salty');assert.equal(guard(body),true,`${k+1}번째는 뗀다`);}
    now+=100;body.add('salty');assert.equal(guard(body),false,'2초 안 7번째: 멈춘다');assert.equal(body.has('salty'),true);assert.equal(warnings.length,1,'한 번 알린다');
    now+=5000;body.add('salty');assert.equal(guard(body),false,'멈춘 뒤에는 이번 세션 동안 두고 본다');assert.equal(warnings.length,1);
    const slow=forcedThemeGuard({themeOn:()=>false,now:()=>now,warn:m=>warnings.push(m)});
    for(let k=0;k<20;k++){now+=1000;body.add('salty');assert.equal(slow(body),true,'천천히 오는 것은 계속 뗀다');}
    assert.equal(warnings.length,1);
}
console.log('PASS public enabled follows usage mode, quiet-notes keeps its intent, forced body.salty is removed without fighting');
