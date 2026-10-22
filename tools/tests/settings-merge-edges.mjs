// 7.7.2 다른 기기 설정 합치기의 경계 (settings-merge.js) — 지운 기록의 보관 기한 · 개수 · 늦은 쪽 고르기 · 끼워 넣을 자리 · 숨김 → 보임 한 번 읽기.
//   settings-merge.mjs 가 메모 · 용어집 흐름을 보고, 여기는 순수 합치기의 같은 시각 · 0 · 한도와 서버 읽기 실패 갈래를 본다. 네트워크 없음.
//   node tools/tests/settings-merge-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const M = await import(pathToFileURL(path.join(root, 'src/settings-merge.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const DAY = 86400000, NOW = 1_800_000_000_000;
const ids = list => list.map(x => x.id);

await test('상수', () => {
    assert.equal(M.MIN_HIDDEN_MS, 60000);
    assert.equal(M.GONE_KEEP_MS, 30 * DAY);
    assert.equal(M.GONE_CAP, 500);
});

await test('tidyGone: 숫자 시각만 · 30일 안(딱 30일 포함) · 새것부터 500개 · 새 객체', () => {
    const g = { a: NOW, b: NOW - 30 * DAY, c: NOW - 30 * DAY - 1, d: 0, e: -5, f: 'x', g: String(NOW - 1), '': NOW };
    assert.deepEqual(M.tidyGone(g, NOW), { a: NOW, g: NOW - 1, b: NOW - 30 * DAY });
    assert.deepEqual(Object.keys(M.tidyGone(g, NOW)), ['a', 'g', 'b'], '새것부터');
    assert.notEqual(M.tidyGone(g, NOW), g);
    for (const bad of [null, [], 'x', 5]) assert.deepEqual(M.tidyGone(bad, NOW), {});
    const many = Object.fromEntries(Array.from({ length: 510 }, (_, i) => ['k' + i, NOW - i]));
    const t = M.tidyGone(many, NOW);
    assert.equal(Object.keys(t).length, 500);
    assert.ok('k0' in t && 'k499' in t && !('k500' in t), '오래된 쪽을 버린다');
    assert.deepEqual(M.tidyGone({ a: NOW - 10 }, NOW, 5), {}, '보관 기한을 넘긴 것');
    assert.deepEqual(Object.keys(M.tidyGone({ a: NOW, b: NOW - 1 }, NOW, GONE(), 1)), ['a']);
    function GONE() { return M.GONE_KEEP_MS; }
    assert.deepEqual(M.tidyGone({ a: NOW + 5 }, NOW), { a: NOW + 5 }, '미래 시각도 받아 둔다');
});

await test('unionGone: 같은 id 는 늦은 시각, 양쪽을 정리', () => {
    assert.deepEqual(M.unionGone({ a: NOW - 5, b: NOW - 1 }, { a: NOW - 2, c: NOW - 3, old: NOW - 31 * DAY }, NOW), { b: NOW - 1, a: NOW - 2, c: NOW - 3 });
    assert.deepEqual(M.unionGone({ a: NOW - 1 }, { a: NOW - 1 }, NOW), { a: NOW - 1 });
    assert.deepEqual(M.unionGone({ a: NOW - 1 }, { a: NOW - 9 }, NOW), { a: NOW - 1 });
    assert.deepEqual(M.unionGone(null, undefined, NOW), {});
});

await test('mergeById: 둘 다 있는 것 — 늦은 쪽(같으면 이 탭), 늦은 서버 값은 같은 객체에 덮고 없는 칸은 지운다', () => {
    const keep = { id: 1, t: 'local', updated: 5, only: 'x' };
    const local = [keep, { id: 2, t: 'mine', updated: 9 }, { id: 3, t: 'same', updated: 4 }];
    const r = M.mergeById({ local, remote: [{ id: 1, t: 'remote', updated: 6 }, { id: 2, t: 'old', updated: 8 }, { id: 3, t: 'theirs', updated: 4 }], now: NOW });
    assert.equal(local[0], keep, '화면이 잡은 객체 그대로');
    assert.deepEqual(keep, { id: 1, t: 'remote', updated: 6 });
    assert.equal(local[1].t, 'mine');
    assert.equal(local[2].t, 'same', '같은 시각이면 이 탭');
    assert.deepEqual([r.pulled, r.removed, r.needSave, r.changed], [1, 0, true, true], '이 탭이 늦은 항목이 있으면 저장');
    const eq = M.mergeById({ local: [{ id: 'a', updated: 3 }], remote: [{ id: 'a', updated: 3 }], now: NOW });
    assert.deepEqual([eq.pulled, eq.removed, eq.needSave, eq.changed], [0, 0, false, false]);
    const nostamp = M.mergeById({ local: [{ id: 'a', v: 1 }], remote: [{ id: 'a', v: 2, updated: 'x' }], now: NOW });
    assert.equal(nostamp.pulled, 0, '시각이 없으면(0) 같다고 본다');
    const custom = [{ id: 'a', v: 1, updated: 9, metaUpdated: 1 }];
    M.mergeById({ local: custom, remote: [{ id: 'a', v: 2, updated: 1, metaUpdated: 20 }], now: NOW, stamp: x => Math.max(x.updated || 0, x.metaUpdated || 0) });
    assert.equal(custom[0].v, 2, 'stamp 로 고른 시각');
    const cl = [{ id: 'a', updated: 1 }];
    M.mergeById({ local: cl, remote: [{ id: 'a', updated: 2, deep: { x: 1 } }], now: NOW, clone: x => ({ ...x, cloned: true }) });
    assert.equal(cl[0].cloned, true);
    assert.throws(() => M.mergeById({ local: 'x', remote: [] }), /local 은 배열/);
});

await test('mergeById: 서버에만 있는 것 — 지운 기록에 안 걸리면 서버 차례대로 끼워 넣는다', () => {
    const local = [{ id: 'a', updated: 1 }, { id: 'c', updated: 1 }];
    const r = M.mergeById({ local, remote: [{ id: 'x', updated: 1 }, { id: 'a', updated: 1 }, { id: 'b', updated: 1 }, { id: 'c', updated: 1 }, { id: 'd', updated: 1 }, { id: 'e', updated: 1 }], now: NOW });
    assert.deepEqual(ids(local), ['x', 'a', 'b', 'c', 'd', 'e'], '바로 앞 이웃 뒤, 앞 이웃이 없으면 맨 앞');
    assert.deepEqual([r.pulled, r.needSave], [4, false]);
    const two = [{ id: 'z', updated: 1 }];
    M.mergeById({ local: two, remote: [{ id: 'p', updated: 1 }, { id: 'q', updated: 1 }], now: NOW });
    assert.deepEqual(ids(two), ['p', 'q', 'z'], '더한 것끼리도 서버 차례');
    const g = [];
    M.mergeById({ local: g, remote: [{ id: 'gone', updated: 5 }, { id: 'back', updated: 7 }, { id: 'edge', updated: 6 }], remoteGone: { gone: NOW - 1, back: 6, edge: 6 }, now: NOW + 0 * DAY });
    assert.deepEqual(ids(g), ['back', 'edge'], '30일 지난 지운 기록(6)은 정리돼 막지 못하고, 살아 있는 기록(gone)만 막는다');
    const g2 = [];
    const T = NOW - DAY;
    M.mergeById({ local: g2, remote: [{ id: 'gone', updated: T - 1 }, { id: 'edge', updated: T }, { id: 'back', updated: T + 1 }], localGone: { gone: T, edge: T, back: T }, now: NOW });
    assert.deepEqual(ids(g2), ['back'], '지운 시각 ≥ updated 면 지운 것 (같아도), 지운 뒤 고친 것은 살린다');
    const bad = [];
    M.mergeById({ local: bad, remote: [null, 5, [], { name: 'no id' }, { id: 0, updated: 1 }], now: NOW });
    assert.deepEqual(ids(bad), [0], 'id 가 0 인 것은 받는다');
    const acc = [];
    M.mergeById({ local: acc, remote: [{ id: 'a', ok: false }, { id: 'b', ok: true }], now: NOW, accept: x => x.ok });
    assert.deepEqual(ids(acc), ['b']);
});

await test('mergeById: 지운 기록 — 다른 기기가 지운 것은 빼고, 지운 뒤 고친 것은 기록을 걷는다, 서버 기록과 다르면 저장', () => {
    const T = NOW - DAY;
    const local = [{ id: 'a', updated: T - 5 }, { id: 'b', updated: T }, { id: 'c', updated: T + 5 }, { id: 'd', updated: T }];
    const remote = local.map(x => ({ ...x }));
    const r = M.mergeById({ local, remote, remoteGone: { a: T, b: T, c: T }, now: NOW });
    assert.deepEqual(ids(local), ['c', 'd']);
    assert.equal(r.removed, 2);
    assert.deepEqual(r.gone, { a: T, b: T }, 'c 의 기록은 걷었다');
    assert.equal(r.needSave, false, '걷은 기록(c)만 서버와 다르면 저장하지 않는다 — c 는 시각 규칙으로 어디서나 산다');
    assert.equal(r.changed, true);
    const same = M.mergeById({ local: [{ id: 'k', updated: 1 }], remote: [{ id: 'k', updated: 1 }], localGone: { z: T }, remoteGone: { z: T }, now: NOW });
    assert.equal(same.needSave, false, '같은 기록이면 저장 안 함');
    const mine = M.mergeById({ local: [{ id: 'k', updated: 1 }], remote: [{ id: 'k', updated: 1 }], localGone: { z: T }, now: NOW });
    assert.equal(mine.needSave, true, '이 탭에만 있는 기록은 서버로');
    const onlyLocal = M.mergeById({ local: [{ id: 'mine', updated: 1 }], remote: [], now: NOW });
    assert.deepEqual([onlyLocal.needSave, onlyLocal.changed], [true, false], '서버가 잃은 항목은 다음 저장이 되돌린다');
    assert.equal(M.mergeById({ local: [], remote: 'x', now: NOW }).pulled, 0);
});

await test('markGone · serverExtensionSettings', () => {
    const g = { old: NOW - 31 * DAY, keep: NOW - DAY };
    assert.equal(M.markGone(g, 7, NOW), g);
    assert.deepEqual(g, { keep: NOW - DAY, 7: NOW }, '같은 객체에 더하고 오래된 것은 뺀다');
    assert.equal(M.markGone(null, 'a', NOW), null);
    const h = {}; assert.equal(M.markGone(h, null, NOW), h); assert.deepEqual(h, {});
    assert.equal(M.markGone(h, undefined, NOW), h); assert.deepEqual(h, {});
    M.markGone(h, 0, NOW); assert.deepEqual(h, { 0: NOW }, 'id 0 도');
    assert.deepEqual(M.serverExtensionSettings({ settings: JSON.stringify({ extension_settings: { a: 1 } }) }), { a: 1 });
    assert.deepEqual(M.serverExtensionSettings({ settings: { extension_settings: { b: 2 } } }), { b: 2 });
    for (const bad of [null, {}, { settings: '{broken' }, { settings: '{"extension_settings":[]}' }, { settings: { extension_settings: 'x' } }]) assert.equal(M.serverExtensionSettings(bad), null);
});

await test('mergeFromServer: 한 번만 읽고 등록한 것마다 · 저장이 필요할 때만 저장 · 실패 갈래', async () => {
    const T = M._forTest; T.reset();
    let fetches = 0, saves = 0, body = { settings: { extension_settings: { x: 1 } } }, status = 200;
    T.setHost({ now: () => NOW, fetch: async (url, init) => { fetches++; assert.equal(url, '/api/settings/get'); assert.equal(init.method, 'POST'); assert.equal(init.cache, 'no-store'); return { ok: status === 200, status, json: async () => body }; }, headers: () => ({ 'X-T': '1' }) });
    assert.deepEqual(await M.mergeFromServer('first'), { reason: 'first', at: NOW, ok: false, consumers: {} }, '등록한 것이 없으면 읽지 않는다');
    assert.equal(fetches, 0);
    const seen = [];
    const offA = M.registerSettingsMerge('a', ext => { seen.push(['a', ext]); return { pulled: 1, needSave: false }; });
    M.registerSettingsMerge('b', () => { throw new Error('consumer'); });
    M.registerSettingsMerge('c', () => null);
    assert.equal(typeof M.registerSettingsMerge('bad', 'x'), 'function');
    assert.deepEqual(T.consumers(), ['a', 'b', 'c']);
    M.startSettingsMerge({ save: () => saves++ });
    const warn = console.warn; console.warn = () => {};
    const p1 = M.mergeFromServer('x'), p2 = M.mergeFromServer('y');
    assert.equal(p1, p2, '도는 중이면 같은 약속');
    const r = await p1;
    assert.equal(fetches, 1);
    assert.deepEqual([r.ok, r.saved, r.consumers.a, r.consumers.c], [true, false, { pulled: 1, needSave: false }, null]);
    assert.equal(r.consumers.b.error, 'consumer');
    assert.deepEqual(seen, [['a', { x: 1 }]]);
    assert.equal(saves, 0);
    M.registerSettingsMerge('c', () => ({ needSave: true }));
    const r2 = await M.mergeFromServer('z');
    assert.deepEqual([r2.saved, saves], [true, 1]);
    assert.equal(T.lastRun(), r2);
    status = 500;
    assert.equal((await M.mergeFromServer()).error, 'HTTP 500');
    status = 200; body = { settings: '{' };
    assert.equal((await M.mergeFromServer()).error, 'no extension_settings');
    T.setHost({ fetch: async () => { throw new Error('offline'); } });
    assert.equal((await M.mergeFromServer()).error, 'offline');
    T.setHost({ fetch: async () => null });
    assert.equal((await M.mergeFromServer()).error, 'HTTP undefined');
    T.setHost({ fetch: async () => ({ ok: true, json: async () => ({ settings: { extension_settings: {} } }) }) });
    M.startSettingsMerge({ save: () => { throw new Error('save'); } });
    const r3 = await M.mergeFromServer();
    assert.deepEqual([r3.ok, r3.saved], [true, true], '저장이 던져도 결과는 남긴다');
    console.warn = warn;
    offA(); offA();
    assert.deepEqual(T.consumers(), ['b', 'c']);
    const fnC = () => null; M.registerSettingsMerge('c', fnC);
    const stale = M.registerSettingsMerge('d', () => null); M.registerSettingsMerge('d', () => null); stale();
    assert.deepEqual(T.consumers(), ['b', 'c', 'd'], '바뀐 것을 옛 해제 함수가 지우지 않는다');
    T.reset();
});

await test('startSettingsMerge: 1분 넘게 숨었다가 보일 때만 · 뒤로 가기 캐시 · 한 번만 건다', async () => {
    const T = M._forTest; T.reset();
    let now = NOW, fetches = 0;
    const listeners = {};
    const doc = { hidden: false, addEventListener: (t, f) => { (listeners[t] ||= []).push(f); }, removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter(x => x !== f); } };
    const winListeners = {};
    const realAdd = globalThis.addEventListener, realRemove = globalThis.removeEventListener;
    globalThis.addEventListener = (t, f) => { (winListeners[t] ||= []).push(f); };
    globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] || []).filter(x => x !== f); };
    T.setHost({ doc: () => doc, now: () => now, fetch: async () => { fetches++; return { ok: true, json: async () => ({ settings: { extension_settings: {} } }) }; } });
    M.registerSettingsMerge('a', () => ({}));
    M.startSettingsMerge({});
    M.startSettingsMerge({});
    assert.equal(listeners.visibilitychange.length, 1, '한 번만');
    const flip = async (hidden, dt = 0) => { now += dt; doc.hidden = hidden; listeners.visibilitychange[0](); await new Promise(r => setImmediate(r)); };
    await flip(true); await flip(false, 59999);
    assert.equal(fetches, 0, '1분이 안 되면 안 읽는다');
    await flip(true); await flip(false, 60000);
    assert.equal(fetches, 1, '딱 1분이면 읽는다');
    await flip(false, 120000);
    assert.equal(fetches, 1, '숨은 적 없이 보임만 오면 안 읽는다');
    winListeners.pageshow[0]({ persisted: false }); await new Promise(r => setImmediate(r));
    assert.equal(fetches, 1);
    winListeners.pageshow[0]({ persisted: true }); await new Promise(r => setImmediate(r));
    assert.equal(fetches, 2, '뒤로 가기 캐시에서 돌아오면 읽는다');
    T.reset();
    assert.equal(listeners.visibilitychange.length, 0);
    assert.equal((winListeners.pageshow || []).length, 0);
    doc.hidden = true; now = NOW;
    M.registerSettingsMerge('a', () => ({}));
    M.startSettingsMerge({});
    now += 60000; doc.hidden = false; listeners.visibilitychange[0](); await new Promise(r => setImmediate(r));
    assert.equal(fetches, 3, '숨은 채로 시작한 탭도 시각을 잰다');
    T.reset();
    T.setHost({ doc: () => null });
    M.startSettingsMerge({}); T.setHost({ doc: () => doc });
    M.registerSettingsMerge('a', () => ({}));
    M.startSettingsMerge({});
    assert.equal(listeners.visibilitychange.length, 1, '문서가 없을 때는 걸지 않고, 다음에 건다');
    T.reset();
    globalThis.addEventListener = realAdd; globalThis.removeEventListener = realRemove;
});

console.log(`settings-merge-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
