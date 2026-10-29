// 성능 보조 · 저장 정리 — SillyTavern.getContext 감싸기의 키 묶음 캐시 (src/addons/perf/savededupe.js installContextGuard, 8.2.5)
//   node tools/tests/perf-context-guard.mjs <테마 루트>
// getContext() 는 부를 때마다 새 객체를 만들고, 저장 정리는 그 안의 openCharacterChat · openGroupChat 을 「저장이 끝나길 기다리는」 감싸개로
// 바꿔 준다. 테마 · 애드온이 getContext() 를 자주 부르니(스크롤 · 스트리밍 · 토글), 같은 함수 묶음이면 지난번 감싸개를 그대로 꽂는지 본다.
// 실리태번 모듈(script.js · extensions.js · openai.js · group-chats.js)과 hub.js · addon-files-check.js 는 data: 스텁. script 스텁에 isGenerating ·
// streamingProcessor 를 두어 바꾸기 막기(switchGuard)가 켜지고, 그래야 codeGuard · getContext 감싸기가 설치된다.
// 확인하는 것:
//   1) getContext 가 saveDedupeGetContext 로 감싸이고, 바꾸기 함수는 감싸개로 바뀐다 · 다른 키는 그대로
//   2) 거듭 불러도 같은 묶음이면 감싸개 신원이 같고 새로 감싸지 않는다(wraps 1) · 함수가 바뀌면 그때만 새로 감싼다
//   3) 감싸개는 원래 함수를 그대로 부른다(this · 인자 · 반환) · 바쁘지 않으면 바로
//   4) 바꾸기 함수가 없는 ctx 는 키를 만들지 않는다
// 지어낸 캐릭터 이름만 쓴다.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const perfDir = path.join(root, 'src/addons/perf');
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
globalThis.__perfCtxTest = { ext: { save_dedupe: { enabled: true, recover: false, flushOnSwitch: false, guardGeneration: true } } };
const ST = {
    '../../addon-files-check.js': js('export function verifyAddonCss() {}'),
    './hub.js': js('export function pane() { return null; }'),
    '../../../../../../extensions.js': js('export const extension_settings = globalThis.__perfCtxTest.ext;\nexport function getContext() { return {}; }'),
    '../../../../../../../script.js': js("export const eventSource = { on() {} };\nexport const event_types = { APP_READY: 'app_ready' };\nexport function saveSettingsDebounced() {}\nexport function isGenerating() { return false; }\nexport let streamingProcessor = null;\nexport const chat = [];"),
    '../../../../../../openai.js': js('export const promptManager = null;'),
    '../../../../../../group-chats.js': js('export const selected_group = null;'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(R) && S[spec]) return { url: S[spec], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, dir: pathToFileURL(perfDir).href } });

// ── 가짜 실리태번: 모듈 함수(신원 고정)와 부를 때마다 새로 만드는 ctx
const calls = [];
function openCharacterChat(file) { calls.push(['character', this, file]); return 'opened:' + file; }
function openGroupChat(id) { calls.push(['group', this, id]); return 'group:' + id; }
let fns = { openCharacterChat, openGroupChat };
let made = 0;
const rawGetContext = () => { made++; return { characterId: 0, characters: [{ name: 'Mina', avatar: 'mina.png' }], chat: [], chatMetadata: {}, saveChat() {}, ...fns }; };
const warn = console.warn;
globalThis.window = { fetch: () => Promise.resolve(new Response('{}')), addEventListener() {}, removeEventListener() {}, SillyTavern: { getContext: rawGetContext }, jQuery: undefined };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, body: { dataset: {} } };
globalThis.location = { origin: 'http://st.test', href: 'http://st.test/' };
globalThis.jQuery = () => {};
globalThis.performance ??= { now: () => Date.now(), timeOrigin: 0 };

await import(pathToFileURL(path.join(perfDir, 'savededupe.js')).href);
console.warn = warn;
const D = window.SaveDedupe;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

await test('getContext 가 감싸이고(saveDedupeGetContext) 바꾸기 함수만 감싸개로 바뀐다', () => {
    assert.ok(D.switchGuard, '바꾸기 막기가 켜져 있어야 codeGuard 가 선다');
    assert.ok(D.codeGuard);
    assert.equal(window.SillyTavern.getContext.name, 'saveDedupeGetContext');
    const ctx = window.SillyTavern.getContext();
    assert.equal(made, 1);
    assert.notEqual(ctx.openCharacterChat, openCharacterChat);
    assert.notEqual(ctx.openGroupChat, openGroupChat);
    assert.equal(ctx.openCharacterChat.name, 'saveDedupeGuardedSwitch');
    assert.equal(typeof ctx.saveChat, 'function');
    assert.equal(ctx.characters[0].name, 'Mina');
    assert.deepEqual(D.contextGuard, { calls: 1, wraps: 1 });
});

await test('거듭 불러도 같은 묶음이면 감싸개 신원이 같고 새로 감싸지 않는다 (100번 → wraps 1)', () => {
    const first = window.SillyTavern.getContext();
    for (let i = 0; i < 100; i++) {
        const ctx = window.SillyTavern.getContext();
        assert.equal(ctx.openCharacterChat, first.openCharacterChat);
        assert.equal(ctx.openGroupChat, first.openGroupChat);
    }
    assert.equal(made, 102);
    assert.deepEqual(D.contextGuard, { calls: 102, wraps: 1 });
});

await test('감싸개는 원래 함수를 this · 인자 그대로 부르고 결과를 돌려준다 (바쁘지 않으면 바로)', async () => {
    const ctx = window.SillyTavern.getContext();
    const r = await ctx.openCharacterChat('Mina - 2026-01-02');
    assert.equal(r, 'opened:Mina - 2026-01-02');
    assert.equal(calls.at(-1)[0], 'character'); assert.equal(calls.at(-1)[1], ctx); assert.equal(calls.at(-1)[2], 'Mina - 2026-01-02');
    assert.equal(await ctx.openGroupChat('tea-party'), 'group:tea-party');
    assert.equal(D.codeGuard.stats.held, 0, '바쁘지 않으면 기다리지 않는다');
});

await test('함수 신원이 바뀌면 그때만 새로 감싸고, 돌아오면 예전 감싸개를 다시 쓴다', () => {
    const before = window.SillyTavern.getContext().openCharacterChat;
    const other = function openCharacterChat2() { return 'other'; };
    fns = { openCharacterChat: other, openGroupChat };
    const a = window.SillyTavern.getContext();
    assert.notEqual(a.openCharacterChat, before);
    assert.equal(a.openGroupChat, window.SillyTavern.getContext().openGroupChat);
    assert.equal(D.contextGuard.wraps, 2);
    window.SillyTavern.getContext(); window.SillyTavern.getContext();
    assert.equal(D.contextGuard.wraps, 2);
    fns = { openCharacterChat, openGroupChat };
    assert.equal(window.SillyTavern.getContext().openCharacterChat, before, 'WeakMap 에 남은 예전 감싸개를 그대로');
    assert.equal(D.contextGuard.wraps, 3);
});

await test('바꾸기 함수가 없는 ctx 는 키를 만들지 않는다 · 묶음이 돌아오면 다시 예전 감싸개', () => {
    fns = {};
    const ctx = window.SillyTavern.getContext();
    assert.equal('openCharacterChat' in ctx, false);
    assert.equal('openGroupChat' in ctx, false);
    const wraps = D.contextGuard.wraps;
    fns = { openCharacterChat, openGroupChat };
    assert.equal(window.SillyTavern.getContext().openCharacterChat.name, 'saveDedupeGuardedSwitch');
    assert.equal(D.contextGuard.wraps, wraps + 1);
    assert.equal(D.contextGuard.calls, made, '감싸기는 부른 수만큼만(ctx 마다 한 번)');
});

console.log(`perf-context-guard: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
