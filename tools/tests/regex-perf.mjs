// MIT 원본의 정규식 사전 검사와 블루레몬 연결을 함께 확인해요. 외부 호출은 하지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { runCases, fuzz } from './fixtures/regexperf-needle.mjs';
const root=path.resolve(process.argv[2]||'.');
const mode=process.argv[3]||'normal';
const ctx={extensionSettings:{regex_perf_kit:{fastPath:false}},eventSource:{on(){}},event_types:{},
 chat:[],characters:[],name1:'합성 사용자',name2:'합성 인물',substituteParams:s=>s};
globalThis.SillyTavern={getContext:()=>ctx};
globalThis.__regexScripts=[{id:'sample',scriptName:'합성 규칙',findRegex:'/status/g',replaceString:'상태',trimStrings:[],disabled:false,markdownOnly:false,promptOnly:false,substituteRegex:0,placement:[2]}];
globalThis.__prewrap=mode==='other-wrapper';
const parser='function parse(s){const k=s.lastIndexOf("/");try{return s[0]==="/"&&k>0?new RegExp(s.slice(1,k),s.slice(k+1)):new RegExp(s)}catch{return null}}';
register('data:text/javascript,'+encodeURIComponent(`
let engine,utils; export function initialize(data){({engine,utils}=data)}
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
export async function resolve(spec,context,next){
 if(spec.endsWith('/regex/engine.js'))return stub(engine);
 if(spec.endsWith('/utils.js'))return stub(utils);
 if(spec==='./hub.js'&&context.parentURL.endsWith('/regexperf.js'))return stub('export const pane=()=>null;export function onFirstShow(){}');
 return next(spec,context);
}`),{data:{engine:parser+';export class RegexProvider {static instance=new RegexProvider();get(s){return parse(s)}clear(){}};if(globalThis.__prewrap)RegexProvider.instance.get=function(){return /status/g};globalThis.__regexProvider=RegexProvider.instance;export const getRegexScripts=()=>globalThis.__regexScripts;',utils:parser+';export const regexFromString=parse;'}});
const mod=await import(pathToFileURL(path.join(root,'src/addons/regexlink/regexperf.js')));
if(mode==='other-wrapper'){
 assert.equal(mod.setRuntimeEnabled(true),false);
 assert.equal(mod.regexPerfState().patched,false,'다른 엔진 패치에는 양보해요');
 assert.match(mod.regexPerfState().wrapperWarning,/다른 확장/);
 console.log('통과: 다른 정규식 엔진 패치를 덮지 않아요');
}else{
 const cases=runCases(mod.extractNeedle,mod.buildTemplate,mod.analyzeRedos);
 const diff=fuzz(mod.extractNeedle,{seed:110706,patterns:40000});
 assert.equal(diff.falseSkips?.length||0,0);
 assert.equal(mod.regexPerfState().patched,false,'읽기만 해서는 엔진을 바꾸지 않아요');
 const original=globalThis.__regexProvider.get;
 assert.equal(mod.setRuntimeEnabled(true),true);
 assert.equal(mod.regexPerfState().patched,true);
 const re=globalThis.__regexProvider.get('/status/g');
 let callbacks=0;
 const replacement=()=>{callbacks++;return '상태'};
 assert.equal('status status'.replace(re,replacement),'상태 상태');
 assert.equal('status status'.replace(re,replacement),'상태 상태');
 assert.equal(callbacks,2,'같은 입력의 두 번째 치환은 결과 캐시를 써요');
 assert.equal('일반 본문'.replace(re,()=>{throw Error('매치가 없는 입력에서 치환을 불렀어요')}),'일반 본문');
 assert.ok(mod.regexPerfState().report);
 // 원본 0.5.5 고침 일부(업스트림 1112): 생성자로 만든 사본 · 이름만 바꾼 스크립트
 const copy=new re.constructor(re.source,re.flags);
 assert.equal('status'.replace(copy,'사본'),'사본','감싼 식을 생성자로 복사해도 보통 정규식처럼 바꿔요');
 globalThis.__regexScripts[0].scriptName='바뀐 이름';
 mod.notifyScriptsChanged();
 globalThis.__regexProvider.get('/status/g');
 assert.ok(mod.regexPerfState().report.rows.some(r=>r.name==='바뀐 이름'),'이름만 바꿔도 표 · 보고에 새 이름이 보여요');
 globalThis.__regexScripts[0].scriptName='합성 규칙';
 mod.notifyScriptsChanged();
 const {t,translate}=await import(pathToFileURL(path.join(root,'src/addons/regexlink/regexperf-locale.js')));
 assert.equal(t`Since ${'오늘'}`,'오늘부터 측정');
 assert.equal(translate('Features'),'기능');
 mod.setRuntimeEnabled(false);
 assert.equal(globalThis.__regexProvider.get,original,'끄면 자신이 붙인 엔진 함수를 되돌려요');
 assert.equal('status'.replace(re,()=> '새 값'),'새 값','남아 있는 옛 정규식 객체도 캐시를 쓰지 않아요');
 assert.equal(mod.setRuntimeEnabled(true),true);
 assert.equal('status'.replace(re,()=> '옛 객체'),'옛 객체','다시 켜도 지난 실행 세대의 객체는 원래 치환을 써요');
 const ours=globalThis.__regexProvider.get,other=function(s){return ours.call(this,s)};
 globalThis.__regexProvider.get=other;
 assert.equal('status'.replace(globalThis.__regexProvider.get('/status/g'),()=> '다른 값'),'다른 값');
 assert.equal(mod.regexPerfStatus().enabled,false,'나중에 다른 엔진 패치가 붙으면 적용을 멈춰요');
 assert.equal(globalThis.__regexProvider.get,other,'뒤에 붙은 다른 함수는 덮지 않아요');
 assert.equal('status'.replace(globalThis.__regexProvider.get('/status/g'),()=> '다른 값'),'다른 값');
 const text=fs.readFileSync(path.join(root,'src/addons/regexlink/index.js'),'utf8');
 assert.match(text,/performanceOn !== 'boolean'\) s\.performanceOn = false/,'새 도구는 기본 미적재예요');
 console.log(`통과: 고정 사례 ${cases.checked}개, 차등 정규식 ${diff.valid}개, 실제 치환·중복 캐시·한국어·기본 미적재를 확인했어요`);
}
