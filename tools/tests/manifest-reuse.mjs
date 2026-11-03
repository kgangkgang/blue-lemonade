// 7.7.4 시작할 때 manifest 다시 받지 않기 — src/prompt-template-host.js
//   node tools/tests/manifest-reuse.mjs <테마 루트>
// 실리태번이 이미 읽어 둔 manifest(getContext().getExtensionManifest)에 판이 있으면 그 판을 쓰고 요청을 내지 않는다.
// getExtensionManifest 가 없거나(옛 실리태번) 판을 못 찾으면 예전처럼 manifest.json 을 받는다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let fresh = 0;
const mod = (p) => `${pathToFileURL(path.join(root, p)).href}?fresh=${++fresh}`;   // 모듈마다 새 상태 (한 번만 읽는 값 · started)

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const ctx = { extensionSettings: {}, saveSettingsDebounced() {}, powerUserSettings: {} };
globalThis.SillyTavern = { getContext: () => ctx };
const requests = [];
globalThis.fetch = async (u, init) => {
    requests.push([String(u), init?.cache]);
    return { ok: true, status: 200, json: async () => ({ version: '1.0.0-fetched' }) };
};

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (error) { fail++; console.log('FAIL ' + name); console.log(error); }
}

// prompt-template host: 가짜 문서 · 타이머 바로 실행
class El { constructor(attrs = {}, text = '') { this.attrs = attrs; this.textContent = text; this.kids = []; this.dataset = {}; this.head = null; }
    getAttribute(k) { return this.attrs[k] ?? null; } setAttribute(k, v) { this.attrs[k] = v; } querySelectorAll() { return this.kids; } querySelector() { return this.head; } }
async function startHost(hostCtx, fetcher) {
    const host = await import(mod('src/prompt-template-host.js'));
    const live = new El(); live.head = new El();
    const doc = { getElementById: id => id === host.PANEL ? live : null };
    const timers = [];
    const result = host.startPromptTemplateHost({ ctx: hostCtx, koUi: false, doc, fetcher, schedule: fn => timers.push(fn) });
    for (const fn of timers) fn();
    await new Promise(r => setTimeout(r, 20));
    return { result, live };
}

await test('프롬프트 템플릿 판: 실리태번이 읽어 둔 manifest 판이면 요청하지 않는다', async () => {
    const calls = [];
    const asked = [];
    const { result, live } = await startHost({ getExtensionManifest: name => { asked.push(name); return { version: '1.18.0' }; } }, async (...a) => { calls.push(a); throw new Error('부르면 안 됨'); });
    assert.equal(result.version, '1.18.0');
    assert.equal(live.head.dataset.blVersion, undefined, '8.2.5: 머리글에 판 알약을 달지 않는다');
    assert.deepEqual(calls, []);
    assert.deepEqual(asked, ['ST-Prompt-Template']);
});

await test('프롬프트 템플릿 판: 판이 없으면 예전처럼 manifest 를 받는다 (no-cache)', async () => {
    const calls = [];
    const { result } = await startHost({ getExtensionManifest: () => null }, async (u, init) => { calls.push([u, init?.cache]); return { ok: true, json: async () => ({ version: '1.17.9' }) }; });
    assert.equal(result.version, '1.17.9');
    assert.deepEqual(calls, [['/scripts/extensions/third-party/ST-Prompt-Template/manifest.json', 'no-cache']]);
});

console.log(`\nmanifest-reuse: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
