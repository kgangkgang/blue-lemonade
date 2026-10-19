// 7.2.8 TTS 사용량(usage · analysis_usage)이 바뀌어도 설정 전체 저장 0번 — 숫자는 설정 객체에 남고, 이 기기 사본(localStorage, 계정별)으로 새로고침 뒤에도 맞다
//   node tools/tests/tts-usage-728.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__usageTest = { ext: {}, saves: { direct: 0, debounced: 0 }, handle: 'alice' };
const G = 'const T = globalThis.__usageTest;\n';
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const doc = new EventTarget(); doc.visibilityState = 'visible';
globalThis.document = doc; globalThis.window = new EventTarget();
const ST = {
    'script.js': js(G + `export function saveSettingsDebounced() { T.saves.debounced++; }
export async function saveSettings() { T.saves.direct++; }
export const event_types = {}; export const eventSource = { on() {}, emit() {} };`),
    'extensions.js': js(G + `export const extension_settings = T.ext; export function getContext() { return {}; } export function saveMetadataDebounced() {}`),
    'user.js': js(G + `export function getCurrentUserHandle() { return T.handle; }`),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) { const base = spec.split('/').pop(); if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true }; }
    return next(spec, ctx);
}`), { data: { st: ST } });
const S = await import(pathToFileURL(path.join(root, 'src/addons/tts/src/settings.js')).href);
const tick = () => new Promise(r => setTimeout(r, 30));
const month = new Date().toISOString().slice(0, 7);
const KEY = `${S.USAGE_STORE}:alice`;

await test('답 하나만큼(분석 1 · 읽기 3 · 미리 들음 1) 사용량이 늘고 10분 · 숨김 · 떠남이 지나도 설정 저장은 0번', async () => {
    S.settings(); await tick();   // 계정 열쇠를 알아 온다
    const before = { ...T.saves };
    S.addAnalysisUsage(1200, 300, 1);
    for (let i = 0; i < 3; i++) S.addUsage(40, { model: 'speech-02-turbo' });
    S.addPreUsed(40);
    const realSet = globalThis.setTimeout; let pendingTimers = 0;
    globalThis.setTimeout = (fn, ms, ...a) => { pendingTimers++; return realSet(fn, Math.min(ms, 5), ...a); };
    try { await new Promise(r => realSet(r, 60)); } finally { globalThis.setTimeout = realSet; }
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'));
    await tick();
    assert.deepEqual(T.saves, before, 'saveSettings · saveSettingsDebounced 둘 다 0번');
    assert.equal(pendingTimers, 0, '저장 타이머도 걸지 않는다');
    const s = S.settings();
    assert.equal(s.analysis_usage.calls, 1); assert.equal(s.analysis_usage.in_tokens, 1200); assert.equal(s.usage.chars, 120); assert.equal(s.usage.requests, 3); assert.equal(s.usage.pre_used_chars, 40);
    const copy = JSON.parse(store.get(KEY));
    assert.deepEqual(copy.analysis_usage, s.analysis_usage, '이 기기 사본은 지금 숫자');
    assert.deepEqual(copy.usage, s.usage);
});

await test('새로고침: 서버 설정이 옛 숫자(다른 저장 전에 닫힘)여도 사본과 합쳐 화면 숫자가 맞다 · 그 뒤로도 저장 0번', async () => {
    const before = { ...T.saves };
    // 서버에는 분석 0번 · 읽기 1번만 있던 설정 (늘어난 숫자는 저장되기 전에 탭이 닫힘)
    T.ext.lemon_voice = JSON.parse(JSON.stringify(T.ext.lemon_voice));
    Object.assign(T.ext.lemon_voice, { analysis_usage: { month, calls: 0, in_tokens: 0, out_tokens: 0 }, usage: { month, chars: 40, requests: 1, pre_chars: 0, pre_requests: 0, pre_used_chars: 0, models: { 'speech-02-turbo': 40 } } });
    const s = S.settings();
    assert.equal(s.analysis_usage.calls, 1); assert.equal(s.analysis_usage.in_tokens, 1200);
    assert.equal(s.usage.chars, 120); assert.equal(s.usage.requests, 3); assert.equal(s.usage.models['speech-02-turbo'], 120);
    assert.deepEqual(T.saves, before);
});

await test('합치기 규칙: 같은 달은 칸마다 큰 값(다른 기기가 더 많이 쓴 것도 그대로) · 사본이 옛 달이면 무시 · 새 달이면 사본 · 깨진 사본은 무시', () => {
    const K = ['calls', 'in_tokens', 'out_tokens'];
    assert.deepEqual(S.mergeMonthCounts({ month: '2026-10', calls: 5, in_tokens: 10, out_tokens: 0 }, { month: '2026-10', calls: 3, in_tokens: 20, out_tokens: 1 }, K), { month: '2026-10', calls: 5, in_tokens: 20, out_tokens: 1 });
    const cur = { month: '2026-10', calls: 5, in_tokens: 10, out_tokens: 0 };
    assert.equal(S.mergeMonthCounts(cur, { month: '2026-09', calls: 99 }, K), cur);
    assert.deepEqual(S.mergeMonthCounts({ month: '2026-09', calls: 7, in_tokens: 1, out_tokens: 1 }, { month: '2026-10', calls: 2, in_tokens: 3, out_tokens: 4 }, K), { month: '2026-10', calls: 2, in_tokens: 3, out_tokens: 4 });
    assert.equal(S.mergeMonthCounts(cur, null, K), cur); assert.equal(S.mergeMonthCounts(cur, { month: 'x' }, K), cur);
    const m = S.mergeMonthCounts({ month: '2026-10', chars: 1, models: { a: 5 } }, { month: '2026-10', chars: 2, models: { a: 1, b: 3, __proto__: 1 } }, ['chars'], 'models');
    assert.deepEqual({ ...m.models }, { a: 5, b: 3 });
});

await test('계정마다 따로: 다른 계정의 사본은 섞이지 않는다', async () => {
    store.set(`${S.USAGE_STORE}:bob`, JSON.stringify({ analysis_usage: { month, calls: 500, in_tokens: 0, out_tokens: 0 } }));
    T.ext.lemon_voice = JSON.parse(JSON.stringify(T.ext.lemon_voice));
    assert.equal(S.settings().analysis_usage.calls, 1);
});

await test('코드: 사용량 쪽에 설정 저장 · 타이머 · 숨김 저장이 없다', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/tts/src/settings.js'), 'utf8');
    const block = src.slice(src.indexOf('export const USAGE_STORE'), src.indexOf('/** 엔진 설정 (기본값을 채워서) */'));
    assert.ok(block.length > 500);
    assert.doesNotMatch(block, /saveSettings|setTimeout|addEventListener/);
    for (const fn of ['addUsage', 'addPreUsed', 'addAnalysisUsage']) {
        const body = src.slice(src.indexOf(`export function ${fn}`)); assert.match(body.slice(0, body.indexOf('\n}')), /noteUsage\(\);$/m, fn);
    }
});

delete globalThis.__usageTest;
console.log(`tts-usage-728: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
