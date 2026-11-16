// 버그 사냥 2차: 스크립트 지문이 바꿀 글의 「길이」만 봐서, 같은 길이로 고치거나 trim 만 고치면(이벤트가 오기 전 다시 그릴 때) 옛 치환 결과가 캐시에서 나왔어요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const ctx = { extensionSettings: { regex_perf_kit: { fastPath: false } }, eventSource: { on() {} }, event_types: {}, chat: [], characters: [], name1: '합성 사용자', name2: '합성 인물', substituteParams: s => s };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.__regexScripts = [{ id: 'sample', scriptName: '합성 규칙', findRegex: '/status/g', replaceString: '상태', trimStrings: [], disabled: false, markdownOnly: false, promptOnly: false, substituteRegex: 0, placement: [2] }];
const parser = 'function parse(s){const k=s.lastIndexOf("/");try{return s[0]==="/"&&k>0?new RegExp(s.slice(1,k),s.slice(k+1)):new RegExp(s)}catch{return null}}';
register('data:text/javascript,' + encodeURIComponent(`
let engine,utils; export function initialize(data){({engine,utils}=data)}
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
export async function resolve(spec,context,next){
 if(spec.endsWith('/regex/engine.js'))return stub(engine);
 if(spec.endsWith('/utils.js'))return stub(utils);
 if(spec==='./hub.js'&&context.parentURL.endsWith('/regexperf.js'))return stub('export const pane=()=>null;export function onFirstShow(){}');
 return next(spec,context);
}`), { data: { engine: parser + ';export class RegexProvider {static instance=new RegexProvider();get(s){return parse(s)}clear(){}};globalThis.__regexProvider=RegexProvider.instance;export const getRegexScripts=()=>globalThis.__regexScripts;', utils: parser + ';export const regexFromString=parse;' } });
const mod = await import(pathToFileURL(path.join(root, 'src/addons/regexlink/regexperf.js')));
assert.equal(mod.setRuntimeEnabled(true), true);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// 실리태번처럼: 치환 함수는 그때의 스크립트 바꿀 글을 돌려줘요
const run = input => input.replace(globalThis.__regexProvider.get('/status/g'), () => globalThis.__regexScripts[0].trimStrings.reduce((out, trim) => out.split(trim).join(''), globalThis.__regexScripts[0].replaceString));
assert.equal(run('status 글'), '상태 글');
assert.equal(run('status 글'), '상태 글');
// ① 같은 길이로 바꿀 글을 고침(저장 신호는 아직 — 실리태번은 다시 그린 뒤에 신호를 내요)
globalThis.__regexScripts[0].replaceString = '상황';
await wait(60);
assert.equal(run('status 글'), '상황 글', '같은 길이로 고친 바꿀 글이 바로 반영돼요');
// ② trim 만 고침
globalThis.__regexScripts[0].trimStrings = ['황'];
await wait(60);
assert.equal(run('status 글'), '상 글', 'trim 만 고쳐도 옛 결과를 쓰지 않아요');
// ③ 안 고치면 캐시 그대로(지문이 같아요)
let calls = 0;
await wait(60);
'status 글'.replace(globalThis.__regexProvider.get('/status/g'), () => { calls++; return '상'; });
assert.equal(calls, 0, '안 고친 스크립트는 캐시를 그대로 써요');
mod.setRuntimeEnabled(false);
console.log('통과: 스크립트 지문이 바꿀 글 내용 · trim 을 봐요');
process.exit(0);
