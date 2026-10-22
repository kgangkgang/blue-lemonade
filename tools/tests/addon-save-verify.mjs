// 7.7.2 애드온 켜고 끄기 저장 (addon-save.js) — 다시 불러오기 전에 서버에 실제로 저장됐는지 확인하고, 못 했으면 이 탭 세션에 남겨 다음 시작에 되살린다.
//   실리태번 script.js · user.js 와 fetch · sessionStorage 는 이 시험 안의 흉내 (네트워크 없음).   node tools/tests/addon-save-verify.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__addonSaveTest = { saves: 0, saveHook: null, handle: 'mina' };
const G = 'const T = globalThis.__addonSaveTest;\n';
const ST = {
    'user.js': js(G + 'export const getCurrentUserHandle = () => T.handle;'),
    'script.js': js(G + 'export async function saveSettings() { T.saves++; await T.saveHook?.(); } export function getRequestHeaders() { return { "X-T": "1" }; }'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || ''), base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(path.join(root, 'src')).href } });

const ext = {};
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext }) };
const ss = new Map(); let ssFail = false;
globalThis.sessionStorage = { getItem: k => (ss.has(k) ? ss.get(k) : null), setItem: (k, v) => { if (ssFail) throw new Error('quota'); ss.set(k, String(v)); }, removeItem: k => ss.delete(k) };
let serverCopy = null, serverStatus = 200, lastInit = null;
globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/settings/get');
    lastInit = init;
    return { ok: serverStatus === 200, status: serverStatus, json: async () => ({ settings: typeof serverCopy === 'function' ? serverCopy() : serverCopy }) };
};
const { getSettings } = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const A = await import(pathToFileURL(path.join(root, 'src/addon-save.js')).href);
const KEY = 'blue-lemonade:addons-pending:mina';
const mirror = () => ({ extension_settings: { salty: structuredClone(getSettings()) } });   // 서버가 받은 그대로
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ids = Object.keys(getSettings().addons);
const [a, b] = ids;

await test('restorePendingAddons: 없음 · 한 시간 지난 것 · 깨진 것은 false, 아는 애드온의 참거짓만 되살린다', async () => {
    assert.ok(ids.length >= 2);
    assert.equal(await A.restorePendingAddons(), false);
    ss.set(KEY, JSON.stringify({ at: Date.now() - 3600001, flags: { [a]: !getSettings().addons[a] } }));
    assert.equal(await A.restorePendingAddons(), false);
    assert.equal(ss.has(KEY), false, '오래된 것은 지운다');
    ss.set(KEY, '{broken');
    assert.equal(await A.restorePendingAddons(), false);
    const before = { ...getSettings().addons };
    ss.set(KEY, JSON.stringify({ at: Date.now() - 3599000, flags: { [a]: !before[a], [b]: 'yes', unknownAddon: true } }));
    assert.equal(await A.restorePendingAddons(), true);
    assert.equal(getSettings().addons[a], !before[a]);
    assert.equal(getSettings().addons[b], before[b], '참거짓이 아니면 그대로');
    assert.equal('unknownAddon' in getSettings().addons, false, '모르는 애드온은 만들지 않는다');
    assert.equal(ss.has(KEY), true, '되살린 기록은 저장이 확인될 때까지 남는다');
    getSettings().addons[a] = before[a];
    ss.set(KEY, JSON.stringify({ at: Date.now(), flags: null }));
    assert.equal(await A.restorePendingAddons(), true);
    T.handle = 'rex'; ss.clear();
    ss.set('blue-lemonade:addons-pending:rex', JSON.stringify({ at: Date.now(), flags: { [a]: !before[a] } }));
    assert.equal(await A.restorePendingAddons(), true, '열쇠는 사용자마다');
    assert.equal(getSettings().addons[a], !before[a]);
    getSettings().addons[a] = before[a]; T.handle = 'mina'; ss.clear();
    assert.equal(await A.restorePendingAddons(), false);
});

await test('saveAddonsNow: 저장 → 서버 사본 확인 → 같으면 남긴 기록을 지운다 (문자열 · 객체 둘 다)', async () => {
    serverCopy = () => JSON.stringify(mirror());
    let seenPending = null;
    T.saveHook = () => { seenPending = ss.get(KEY); };
    const saves = T.saves;
    await A.saveAddonsNow();
    assert.equal(T.saves, saves + 1);
    assert.ok(seenPending, '서버에 저장하기 전에 세션에 먼저 남긴다');
    assert.deepEqual(JSON.parse(seenPending).flags, getSettings().addons);
    assert.equal(ss.has(KEY), false);
    assert.deepEqual(lastInit.headers, { 'X-T': '1' });
    assert.equal(lastInit.method, 'POST'); assert.equal(lastInit.body, '{}');
    assert.ok(lastInit.signal instanceof AbortSignal, '시간 제한');
    serverCopy = () => mirror();
    await A.saveAddonsNow();
    assert.equal(ss.has(KEY), false);
});

await test('saveAddonsNow: 서버 사본이 다르면(애드온 · 사용 방식) · 응답 실패면 오류, 남긴 기록은 그대로', async () => {
    T.saveHook = null;
    serverCopy = () => { const m = mirror(); m.extension_settings.salty.addons[a] = !getSettings().addons[a]; return m; };
    await assert.rejects(A.saveAddonsNow(), /아직 설정이 저장되지 않았어요/);
    assert.ok(ss.has(KEY));
    serverCopy = () => { const m = mirror(); m.extension_settings.salty.usageMode = getSettings().usageMode === 'chat' ? 'both' : 'chat'; return m; };
    await assert.rejects(A.saveAddonsNow(), /아직 설정이 저장되지 않았어요/);
    serverCopy = () => { const m = mirror(); delete m.extension_settings.salty.usageMode; return m; };
    getSettings().usageMode = 'both';
    await A.saveAddonsNow();
    assert.equal(ss.has(KEY), false, '사용 방식이 비면 both 로 본다');
    getSettings().usageMode = undefined;
    serverCopy = () => mirror();
    await A.saveAddonsNow();
    serverCopy = () => null;
    await assert.rejects(A.saveAddonsNow(), /아직 설정이 저장되지 않았어요/);
    serverCopy = () => ({});
    await assert.rejects(A.saveAddonsNow(), /아직 설정이 저장되지 않았어요/);
    serverStatus = 500; serverCopy = () => mirror();
    await assert.rejects(A.saveAddonsNow(), /설정 저장을 확인하지 못했어요/);
    serverStatus = 200;
    await A.saveAddonsNow();
    assert.equal(ss.has(KEY), false, '실패 뒤 다음 저장은 그대로 돈다');
});

await test('saveAddonsNow: 줄 세워 한 번에 하나, 값은 그 차례가 올 때 읽는다 (빠른 켬→끔)', async () => {
    serverCopy = () => mirror();
    let running = 0, max = 0;
    T.saveHook = async () => { running++; max = Math.max(max, running); await new Promise(r => setImmediate(r)); running--; };
    const before = getSettings().addons[a];
    getSettings().addons[a] = !before;
    const first = A.saveAddonsNow();
    getSettings().addons[a] = before;
    const second = A.saveAddonsNow();
    await first; await second;
    assert.equal(max, 1);
    assert.equal(ss.has(KEY), false);
    T.saveHook = null;
});

await test('세션 저장이 안 돼도 서버 저장 · 확인은 한다, 내 기록이 아니면 지우지 않는다', async () => {
    serverCopy = () => mirror();
    ssFail = true;
    await A.saveAddonsNow();
    ssFail = false;
    T.saveHook = () => { ss.set(KEY, 'someone else'); };
    await A.saveAddonsNow();
    assert.equal(ss.get(KEY), 'someone else', '그사이 바뀐 기록은 남긴다');
    T.saveHook = null; ss.clear();
});

console.log(`addon-save-verify: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
