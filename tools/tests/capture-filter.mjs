// 채팅 캡처 필터 (5.5.3): 순수 함수만 — 프리셋 값 · 클램프 · 문자열 입력 · CSS filter 문자열 · 결정적 노이즈 타일 · 중립 판정
// node tools/tests/capture-filter.mjs [dev folder]   (기본: 저장소 루트)
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])+'/'):new URL('../../',import.meta.url);
const {FILTER_KEYS,FILTER_RANGES,FILTER_PRESETS,FILTER_PRESET_IDS,filterValue}=await import(new URL('src/capture-style.js',root));
const {filterSettings,filterCss,noiseTile,isNeutral,applyCaptureFilter}=await import(new URL('src/capture-filter.js',root));
const zero={grain:0,brightness:0,contrast:0,saturation:0,temperature:0,vignette:0};
const pick=f=>Object.fromEntries(FILTER_KEYS.map(k=>[k,f[k]]));
// 설계 §1 의 프리셋 값 — 공유 상수(capture-style.js)와 filterSettings 가 둘 다 이 값을 내야 한다
const design={
 none:zero,
 mono:{...zero,saturation:-100,contrast:10,grain:20},
 film:{...zero,grain:35,contrast:8,saturation:-15,temperature:8,vignette:25},
 vintage:{...zero,grain:25,brightness:5,contrast:-10,saturation:-35,temperature:20,vignette:35},
 cool:{...zero,temperature:-25,saturation:-10},
 warm:{...zero,temperature:25,brightness:3},
};
assert.deepEqual(FILTER_KEYS,Object.keys(zero));
assert.deepEqual(FILTER_RANGES,{grain:[0,100],brightness:[-50,50],contrast:[-50,50],saturation:[-100,100],temperature:[-50,50],vignette:[0,100]});
assert.deepEqual(FILTER_PRESET_IDS,['none','mono','film','vintage','cool','warm','custom']);
for(const [id,values] of Object.entries(design))assert.deepEqual(FILTER_PRESETS[id],values,`shared preset ${id}`);
assert.equal(filterValue({grain:'250'},'grain'),100);assert.equal(filterValue({brightness:-99},'brightness'),-50);assert.equal(filterValue({},'vignette'),0);assert.equal(filterValue({saturation:'-15'},'saturation'),-15);
// filterSettings: 프리셋 반영 · 문자열 입력 · 클램프 · 없는 키는 0
for(const [id,values] of Object.entries(design))assert.deepEqual(pick(filterSettings({filterPreset:id})),values,`filterSettings preset ${id}`);
assert.deepEqual(pick(filterSettings({filterPreset:'custom',grain:'35',brightness:'5',contrast:'-10',saturation:'-35',temperature:'20',vignette:'35'})),{grain:35,brightness:5,contrast:-10,saturation:-35,temperature:20,vignette:35});
assert.deepEqual(pick(filterSettings({filterPreset:'custom',grain:'250',brightness:-99,contrast:99,saturation:'-300',temperature:80,vignette:'abc'})),{grain:100,brightness:-50,contrast:50,saturation:-100,temperature:50,vignette:0});
assert.deepEqual(pick(filterSettings({filterPreset:'custom'})),zero);
assert.deepEqual(pick(filterSettings({})),zero);
assert.deepEqual(pick(filterSettings(undefined)),zero);
for(const f of [filterSettings({filterPreset:'film'}),filterSettings({filterPreset:'custom',grain:'7'})])for(const key of FILTER_KEYS)assert.equal(typeof f[key],'number',`${key} is a number`);
// filterCss: 밝기 · 대비 · 채도만 (그레인 · 색온도 · 비네트는 캔버스 합성) · 중립이면 'none'
const num=(css,name)=>{const m=css.match(new RegExp(name+'\\(([-\\d.]+)\\)'));assert.ok(m,`${name}() in "${css}"`);return Number(m[1]);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≈ ${b}`);
const css=filterCss({...zero,brightness:5,contrast:10,saturation:-15});
near(num(css,'brightness'),1.05);near(num(css,'contrast'),1.1);near(num(css,'saturate'),0.85);
near(num(filterCss({...zero,saturation:-100}),'saturate'),0);
near(num(filterCss({...zero,brightness:-50}),'brightness'),0.5);
assert.equal(filterCss(zero),'none');
assert.equal(filterCss({...zero,grain:40,temperature:25,vignette:30}),'none');
assert.equal(filterCss(filterSettings({filterPreset:'none'})),'none');
assert.ok(!/NaN|undefined/.test(filterCss(filterSettings({filterPreset:'vintage'}))));
// noiseTile: 결정적 · 다른 seed 는 다른 값 · 루미넌스(R=G=B, A=255) · 평균 ≈ 128 · 퍼짐이 있다
const tile=(size,seed,...rest)=>{const t=noiseTile(size,seed,...rest);assert.equal(t.width,size);assert.equal(t.height,size);assert.ok(t.data instanceof Uint8ClampedArray,'Uint8ClampedArray');assert.equal(t.data.length,size*size*4);return t;};
const a=tile(64,1),b=tile(64,1),c=tile(64,2);
assert.deepEqual(a.data,b.data,'same seed → same tile');
assert.notDeepEqual(a.data,c.data,'different seed → different tile');
const stats=t=>{let sum=0,sq=0;const n=t.width*t.height;for(let i=0;i<t.data.length;i+=4){const v=t.data[i];assert.equal(t.data[i+1],v);assert.equal(t.data[i+2],v);assert.equal(t.data[i+3],255);sum+=v;sq+=v*v;}const mean=sum/n;return {mean,variance:sq/n-mean*mean};};
const sa=stats(a);
assert.ok(Math.abs(sa.mean-128)<4,`mean ${sa.mean} ≈ 128`);
assert.ok(sa.variance>50,`variance ${sa.variance} > 50`);
assert.ok(Math.abs(stats(c).mean-128)<4);
// 세기 인자를 받는 구현이면 분산이 grain 에 비례해야 한다 (설계 §2: 분산 ∝ grain)
{const weak=stats(tile(64,1,25)),strong=stats(tile(64,1,100));assert.ok(strong.variance>weak.variance*1.5,`variance grows with grain (${weak.variance} → ${strong.variance})`);}
// isNeutral: 전부 0 이면(문자열 '0' 포함) 아무것도 하지 않는다
assert.equal(isNeutral(zero),true);
assert.equal(isNeutral(filterSettings({filterPreset:'none'})),true);
assert.equal(isNeutral(filterSettings({filterPreset:'custom',grain:'0',brightness:'0',contrast:'0',saturation:'0',temperature:'0',vignette:'0'})),true);
for(const key of FILTER_KEYS)assert.equal(isNeutral({...zero,[key]:key==='grain'||key==='vignette'?1:-1}),false,`${key} ≠ 0 → not neutral`);
assert.equal(isNeutral(filterSettings({filterPreset:'mono'})),false);
assert.equal(typeof applyCaptureFilter,'function');
// 저장값이 기준 (리뷰 5.5.3): 이름 있는 프리셋이어도 저장된 값을 쓴다 — 표는 값이 없을 때만
assert.equal(filterSettings({filterPreset:'film',...design.film,grain:0}).grain,0,'stored value wins over the preset table');
assert.deepEqual(pick(filterSettings({filterPreset:'film'})),design.film,'missing values fall back to the table');
assert.deepEqual(pick(filterSettings({filterPreset:'film',grain:10})),{...design.film,grain:10});
// 설정 정규화: 이름 있는 프리셋이면 여섯 값을 표에 맞춘다 · 직접(custom)은 그대로 · 되돌리기는 프리셋과 값을 한 묶음으로
{
    const {getSettings,DEFAULTS}=await import(new URL('src/settings.js',root));
    const {resetSetting,settingChanged}=await import(new URL('src/settings-differences.js',root));
    const ctx={extensionSettings:{},powerUserSettings:{},characters:[],characterId:undefined,saveSettingsDebounced(){}};
    globalThis.SillyTavern={getContext:()=>ctx};
    const load=capture=>{ctx.extensionSettings.salty={...structuredClone(DEFAULTS),captureTools:{...structuredClone(DEFAULTS.captureTools),...capture}};return getSettings();};
    let s=load({filterPreset:'film',grain:'3',brightness:40});
    assert.deepEqual(pick(s.captureTools),design.film,'named preset reconciled with the table on load');
    s=load({filterPreset:'custom',grain:'7',brightness:40});
    assert.equal(s.captureTools.grain,7);assert.equal(s.captureTools.brightness,40);
    s=load({filterPreset:'film'});
    assert.ok(resetSetting(s,'captureTools.grain'));
    assert.equal(s.captureTools.grain,0);assert.equal(s.captureTools.filterPreset,'custom','one value reset → custom');
    assert.equal(filterSettings(s.captureTools).grain,0,'output follows the screen');
    assert.equal(filterSettings(s.captureTools).vignette,design.film.vignette);
    s=load({filterPreset:'film'});
    assert.ok(resetSetting(s,'captureTools.filterPreset'));
    assert.deepEqual(pick(s.captureTools),zero,'preset reset clears the six values too');
    assert.equal(s.captureTools.filterPreset,'none');
    for(const key of FILTER_KEYS)assert.equal(settingChanged(s,`captureTools.${key}`),false,`${key} not left in the changed list`);
    s=load({filterPreset:'custom',...zero,grain:20});
    resetSetting(s,'captureTools.grain');
    assert.equal(s.captureTools.filterPreset,'none','last non-zero value reset → none');
}
console.log('capture filter: shared presets, stored values as source of truth, preset reconcile + reset pairing, clamping, string input, CSS filter string, deterministic noise tile (variance ∝ grain) and neutral detection: passed');
