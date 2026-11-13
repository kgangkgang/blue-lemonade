// 결함 고침 — 「/regexperf off 이름」이 이름이 「들어 있는」 다른 스크립트를 끄던 것(공개판 감사)
//   같은 이름의 스크립트가 이미 꺼져 있거나 지금 채팅에 허용되지 않은 목록에 있으면, 켜진 목록에서 못 찾고 「포함」 갈래로 넘어가 다른 스크립트(「이름 (폰)」)를 껐어요.
//   이제 그럴 땐 아무것도 끄지 않고 알려요. 이름이 똑같은 스크립트가 어디에도 없을 때만 「포함」 갈래를 써요(원본의 뜻 그대로).
//   같이 잠그는 것(감사 「시험 공백」): 이름으로 끄면 그 스크립트 하나만(같은 식을 쓰는 다른 스크립트는 그대로) · 저장은 스크립트 객체를 제자리에서 고쳐요(사본으로 저장하면 서랍을 다시 누를 때 되돌아갔어요)
//   node tools/tests/regex-perf-off.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const ctx = { extensionSettings: { regex_perf_kit: { fastPath: false } }, eventSource: { on() {} }, event_types: {}, chat: [], characters: [], name1: '합성 사용자', name2: '합성 인물', substituteParams: s => s };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
const toasts = [];
globalThis.toastr = { info: m => toasts.push(['info', m]), warning: m => toasts.push(['warning', m]) };
// 실리태번 1.19.0 엔진 꼴: 종류별 목록 · allowedOnly 면 허용 안 된 캐릭터 정규식은 빈 목록 · 저장은 받은 배열 그대로
const script = (id, scriptName, extra = {}) => ({ id, scriptName, findRegex: '/status/g', replaceString: '상태', trimStrings: [], disabled: false, markdownOnly: false, promptOnly: false, substituteRegex: 0, placement: [2], ...extra });
globalThis.__lists = { 0: [], 1: [] };
globalThis.__scopedAllowed = false;
globalThis.__saved = [];
const parser = 'function parse(s){const k=s.lastIndexOf("/");try{return s[0]==="/"&&k>0?new RegExp(s.slice(1,k),s.slice(k+1)):new RegExp(s)}catch{return null}}';
register('data:text/javascript,' + encodeURIComponent(`
let engine,utils; export function initialize(data){({engine,utils}=data)}
const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
export async function resolve(spec,context,next){
 if(spec.endsWith('/regex/engine.js'))return stub(engine);
 if(spec.endsWith('/utils.js'))return stub(utils);
 if(spec==='./hub.js'&&context.parentURL.endsWith('/regexperf.js'))return stub('export const pane=()=>null;export function onFirstShow(){}');
 return next(spec,context);
}`), { data: {
    engine: parser + ';export class RegexProvider {static instance=new RegexProvider();get(s){return parse(s)}clear(){}};'
        + 'export const SCRIPT_TYPES={GLOBAL:0,SCOPED:1};'
        + 'export const getScriptsByType=(type,{allowedOnly=false}={})=>type===1&&allowedOnly&&!globalThis.__scopedAllowed?[]:globalThis.__lists[type];'
        + 'export const getRegexScripts=(o)=>[...getScriptsByType(0,o),...getScriptsByType(1,o)];'
        + 'export const saveScriptsByType=async(list,type)=>{globalThis.__saved.push([type,list]);};',
    utils: parser + ';export const regexFromString=parse;',
} });
const mod = await import(pathToFileURL(path.join(root, 'src/addons/regexlink/regexperf.js')));
assert.equal(mod.setRuntimeEnabled(true), true);
let passed = 0, failed = 0;
async function test(name, fn) { globalThis.__saved.length = 0; toasts.length = 0; globalThis.__scopedAllowed = false; try { await fn(); passed++; console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); } }
const lists = (global, scoped = []) => { globalThis.__lists[0] = global; globalThis.__lists[1] = scoped; mod.notifyScriptsChanged(); };

await test('같은 이름이 이미 꺼져 있으면: 이름이 들어 있는 다른 스크립트를 끄지 않고 알려요', async () => {
    const off = script('a', '생각 숨기기', { disabled: true }), phone = script('b', '생각 숨기기 (폰)');
    lists([off, phone]);
    const message = await mod.turnOffByName('생각 숨기기');
    assert.equal(phone.disabled, false, '「생각 숨기기 (폰)」은 켜진 그대로');
    assert.equal(globalThis.__saved.length, 0, '아무것도 저장하지 않아요');
    assert.equal(message, '"생각 숨기기" 스크립트는 이미 꺼져 있거나 지금 채팅에 허용되지 않았어요.');
    assert.deepEqual(toasts, []);
});

await test('같은 이름이 허용 안 된 캐릭터 정규식에 있어도 같아요', async () => {
    const scoped = script('c', '상태창 접기'), other = script('d', '상태창 접기 2');
    lists([other], [scoped]);
    const message = await mod.turnOffByName('상태창 접기');
    assert.equal(other.disabled, false);
    assert.equal(scoped.disabled, false, '허용 안 된 목록의 스크립트도 건드리지 않아요');
    assert.match(message, /이미 꺼져 있거나 지금 채팅에 허용되지 않았어요/);
    // 허용하면 그 스크립트를 꺼요
    globalThis.__scopedAllowed = true; mod.notifyScriptsChanged();
    assert.equal(await mod.turnOffByName('상태창 접기'), '껐어요: 상태창 접기');
    assert.equal(scoped.disabled, true); assert.equal(other.disabled, false);
});

await test('이름이 똑같은 스크립트가 어디에도 없으면 「포함」 갈래 그대로: 하나면 끄고, 여럿이면 묻고, 없으면 없다고 해요', async () => {
    const one = script('e', '지문 색 바꾸기'), two = script('f', '말풍선 A'), three = script('g', '말풍선 B');
    lists([one, two, three]);
    assert.equal(await mod.turnOffByName('지문 색'), '껐어요: 지문 색 바꾸기');
    assert.equal(one.disabled, true);
    assert.match(await mod.turnOffByName('말풍선'), /여러 개예요: 말풍선 A, 말풍선 B/);
    assert.equal(two.disabled || three.disabled, false);
    assert.match(await mod.turnOffByName('없는 이름'), /찾을 수 없어요/);
    assert.match(await mod.turnOffByName('  '), /사용법/);
});

await test('이름으로 끄면 그 스크립트 하나만 — 같은 식을 쓰는 다른 스크립트는 그대로 · 저장은 객체를 제자리에서 고쳐요', async () => {
    const first = script('h', '상태 가리기'), twin = script('i', '상태 가리기 예비');   // 같은 findRegex
    const list = [first, twin];
    lists(list);
    assert.equal(await mod.turnOffByName('상태 가리기'), '껐어요: 상태 가리기');
    assert.equal(first.disabled, true, '원래 객체가 그대로 고쳐져요(사본 아님)');
    assert.equal(twin.disabled, false, '같은 식의 다른 스크립트는 꺼지지 않아요');
    assert.equal(globalThis.__saved.length, 1);
    assert.equal(globalThis.__saved[0][1], list, '받은 배열을 그대로 저장해요');
    assert.equal(globalThis.__saved[0][1][0], first);
});

await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/regex-perf-off\.mjs \./);
});

console.log(`regex-perf-off: ${passed}개 통과 · ${failed}개 실패`);
if (failed) process.exitCode = 1;
