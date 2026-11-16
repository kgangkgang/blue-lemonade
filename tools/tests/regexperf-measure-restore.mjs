// 버그 사냥 2차: 「이 채팅으로 측정」 뒤 통계를 되돌릴 때, 측정 도중 처음 생긴 통계의 spikes(배열)가 0 이 되어
//   그 뒤 50ms 넘게 걸린 치환에서 stat.spikes.unshift 가 터졌어요(메시지 그리기까지 예외가 올라감). 외부 호출 없음.
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const handlers = {};
const ctx = { extensionSettings: { regex_perf_kit: { fastPath: false, autoMeasure: true } }, eventSource: { on(type, fn) { if (type) (handlers[type] ??= []).push(fn); } }, event_types: { CHAT_CHANGED: 'chat_changed' },
    chat: [], characters: [], name1: '합성 사용자', name2: '합성 인물', substituteParams: s => s };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.toastr = { info() {}, success() {}, warning() {}, error() {} };
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
// 통계가 아직 하나도 없는 채로(켠 직후) 채팅이 열리고 자동 측정이 돌아요
ctx.chat = [{ mes: 'status 하나', name: '합성 인물', is_user: false, is_system: false }];
ctx.messageFormatting = mes => String(mes).replace(globalThis.__regexProvider.get('/status/g'), () => '상태');
assert.ok(handlers.chat_changed?.length, '채팅 바꾸기 신호를 들어요');
for (const fn of handlers.chat_changed) fn();
await new Promise(resolve => setTimeout(resolve, 1200));
// 측정이 끝난 뒤 느린 치환(50ms 넘음)
const slow = () => { const until = Date.now() + 70; while (Date.now() < until) { /* 바쁜 대기 */ } return '상태'; };
let out = '';
assert.doesNotThrow(() => { out = 'status 느린 글'.replace(globalThis.__regexProvider.get('/status/g'), slow); }, '측정 뒤 느린 치환이 터지지 않아요');
assert.equal(out, '상태 느린 글');
mod.setRuntimeEnabled(false);
console.log('통과: 측정 뒤 통계 되돌리기가 spikes 배열을 지켜요');
process.exit(0);
