// 성능 보조 · 저장 공간 창 · 점검 도구 (src/addons/perf/storage/) — 순수 부분 · 시작 모듈 · 경로
//   node tools/tests/perf-storage.mjs <테마 루트>
//   2026-10-31 따로 깔던 런처 확장에 있던 저장 공간 창을 성능 보조 안으로 옮겼어요. 다리(st.storage-report.v1) · 주인 판별(owner · ownerLabel · claims) 계약은 그대로예요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || '.');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('ok', name); };
const S = await import(url('src/addons/perf/storage/core.js'));
const B = await import(url('src/addons/perf/storage/boot.js'));

await test('formatBytes · parseSize: 단위 · 천 단위 쉼표 · 빈 값', () => {
    assert.equal(S.formatBytes(null), '—');
    assert.equal(S.formatBytes(0), '0 B');
    assert.equal(S.formatBytes(1024), '1 KB');
    assert.equal(S.formatBytes(1024 ** 2 - 1), '1,024 KB');
    assert.equal(S.formatBytes(1024 ** 2), '1.0 MB');
    assert.equal(S.formatBytes(1024 ** 3), '1.00 GB');
    assert.equal(S.parseSize('980 KB'), 980 * 1024);
    assert.equal(S.parseSize('1,024 bytes'), 1024);
    assert.equal(S.parseSize('abc'), 0);
});

await test('주인: 고정 주인은 블루 레몬에이드 · 실리태번 둘, 다리에 올린 확장은 자기 묶음 · claims 로 자기 열쇠', () => {
    assert.deepEqual(S.OWNERS.map(o => o.id), ['blue-lemonade', 'sillytavern']);
    assert.equal(S.keyOwner('bl-theme'), 'blue-lemonade');
    assert.equal(S.keyOwner('sample-ext.spot'), 'sillytavern', '올리기 전에는 모르는 열쇠');
    const p = S.normalizeProvider({ id: 'sample', owner: 'sample-ext', ownerLabel: '보기 확장', claims: { keys: /^sample-ext/i, db: /^sample-db$/ }, measure: () => ({ items: [] }) });
    assert.equal(p.owner, 'sample-ext');
    assert.equal(S.ownerLabel('sample-ext'), '보기 확장');
    assert.equal(S.keyOwner('sample-ext.spot'), 'sample-ext');
    assert.equal(S.dbInfo('sample-db').owner, 'sample-ext');
    assert.deepEqual(S.allOwners().map(o => o.id), ['blue-lemonade', 'sample-ext', 'sillytavern'], '실리태번 · 기타는 늘 끝');
    assert.deepEqual(S.dbInfo('LLMtranslatorDB'), { owner: 'blue-lemonade', label: '번역 저장(캐시)' });
    // 11-14 감사: 실리태번 localforage 넷이 한 이름(「실리태번 설정 사본」)으로 겹치지 않게
    const st = ['SillyTavern_Thumbnails', 'SillyTavern_Prompts', 'SillyTavern_ChatCompletions', 'SillyTavern_TextCompletions'].map(n => S.dbInfo(n));
    assert.ok(st.every(d => d.owner === 'sillytavern'));
    assert.equal(new Set(st.map(d => d.label)).size, 4, '실리태번 저장소 넷은 이름이 서로 달라요');
});

await test('저장 공간 다리: 먼저 쌓인 provider 를 거두고, 뒤에 push 한 것도 바로 등록 · 두 번 세워도 한 벌', () => {
    const g = {}; const m = () => ({ items: [] });
    g[S.STORAGE_PENDING] = [{ id: 'early', measure: m }, { id: '' }];
    const b = S.installStorageBridge(g, { warn: () => {} });
    assert.equal(g[S.STORAGE_BRIDGE], b);
    assert.deepEqual(b.list().map(p => p.id), ['early']);
    assert.equal(g[S.STORAGE_PENDING].push({ id: 'late', measure: m }), 1);
    assert.deepEqual(b.list().map(p => p.id).sort(), ['early', 'late']);
    assert.equal(S.installStorageBridge(g), b);
});

await test('점검 도구 순수 부분: 가리기 · 오류 출처 · 켜진 기능 · 진단 머리', () => {
    assert.equal(S.scrub('key ' + ['sk', 'abcdefghijklmnop0'].join('-')), 'key <가림>');   // 키 모양 글자는 이어 붙여 만들어요(정적 검사)
    assert.equal(S.scrub('mail rex@example.test now'), 'mail <메일> now');
    assert.equal(S.errorSource('at http://h/scripts/extensions/third-party/blue-lemonade/src/addons/tts/x.js:1'), 'tts');
    assert.equal(S.errorSource('/extensions/third-party/abc/x.js'), 'abc');
    const f = S.featureList({});
    assert.ok(f.every(r => r.owner === 'blue-lemonade'), '테마 기능만');
    assert.match(S.buildDiagReport({ when: 0 }), /^\[블루 레몬에이드 진단\]/);
});

await test('시작(boot.js): 오류 고리 · 다리 · 창구를 한 벌, 런처 다리가 없으면 pending 줄 · 있으면 바로 등록', () => {
    const g = { addEventListener() {}, console: { error() {} } };
    const api = B.installStorage(g);
    assert.equal(typeof api.open, 'function'); assert.equal(typeof api.status, 'function');
    assert.equal(g[B.STORAGE_VIEW], api);
    assert.ok(g[S.STORAGE_BRIDGE]?.register, '다리');
    assert.ok(g[S.ERRORS_KEY]?.list, '오류 고리');
    const pending = g[Symbol.for('blue-lemonade.dock.pending')];
    assert.equal(pending.length, 1); assert.equal(pending[0].id, B.DOCK_ENTRY_ID); assert.equal(pending[0].label, '저장 공간');
    assert.equal(B.installStorage(g), api, '두 번 불러도 같은 창구 · 항목도 한 번');
    assert.equal(pending.length, 1);
    const seen = []; const h = { addEventListener() {}, console: { error() {} }, [Symbol.for('blue-lemonade.dock')]: { register: e => seen.push(e.id) } };
    B.installStorage(h);
    assert.deepEqual(seen, [B.DOCK_ENTRY_ID]);
});

await test('배선: 성능 보조 시작 · 화면 줄 · 요술봉 · 설정 기본값 · 카드 메뉴 칸 · 실리태번 경로', async () => {
    assert.match(read('src/addons/perf/start.js'), /import\('\.\/storage\/boot\.js'\)\)\.installStorage\(\)/);
    assert.match(read('src/addons/perf/hub.js'), /data-pa-storage/);
    assert.match(read('src/addons/perf/menu.js'), /bl-perf-menu-storage/);
    const settings = await import(url('src/settings.js'));
    assert.equal(settings.DEFAULTS.addonUI.perfMenu.storage, true);
    assert.ok((read('src/addons.js') + read('src/addons-panel.js')).includes("['storage','저장 공간','hard-drive']"));
    for (const rel of ['view.js', 'status.js']) {
        const src = read(`src/addons/perf/storage/${rel}`);
        assert.ok(src.includes("from '../../../../../../../extensions.js'"), `${rel}: 일곱 단계 위 scripts/extensions.js`);
        assert.ok(!/look\.js|dock\.js|private-addons/.test(src), `${rel}: 옛 런처 모듈을 부르지 않아요`);
    }
    assert.match(read('src/addons/perf/storage/style.css'), /@import url\("\.\.\/\.\.\/\.\.\/shared\/palette\.css"\)/);
    assert.ok(!/(?<![\w-])ld-|--ld-|data-ld-/.test(read('src/addons/perf/storage/style.css')), '창 class 는 bls- 로');
});

// 창 동시성(따로 깔던 런처 확장 때의 회귀 시험을 옮김): 여러 번 눌러도 한 번 재고 · 단추 리스너는 하나 · 실패하면 다시 열 수 있어요
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { resolve, reject, promise }; };
function statusHarness() {
    const s = read('src/addons/perf/storage/status.js'), a = s.indexOf('export async function openStatus'), code = s.slice(a, s.indexOf('\nexport {', a)).replace('export ', '');
    const listeners = [], d = defer(); let reads = 0, copies = 0, renders = 0;
    const panel = { body: { querySelector: () => ({ textContent: '' }) }, dialog: { isConnected: true, addEventListener: (t, f) => listeners.push(f) } };
    const ctx = { openPanel: () => panel, ensureStyle: async () => {}, addonVersions: async () => [], render: () => { renders++; panel._report = () => 'diagnostic'; },
        usageToday: () => { reads++; return d.promise; }, requestCounts: async () => { reads++; return []; }, copyText: async () => { copies++; return true; }, ERRORS_KEY: Symbol('errors') };
    vm.runInNewContext(code + ';globalThis.run=openStatus', ctx);
    return { panel, run: ctx.run, d, listeners, get reads() { return reads; }, get copies() { return copies; }, get renders() { return renders; } };
}
function storageHarness() {
    const s = read('src/addons/perf/storage/view.js'), a = s.indexOf('let quickRefreshJob'), code = s.slice(a, s.indexOf('\nexport {', a)).replace('export async', 'async');
    const d = defer(); let scans = 0, measures = 0, holds = 0, renders = 0, panel;
    const make = () => ({ body: { innerHTML: '' }, dialog: { isConnected: true, handlers: [], querySelector: () => ({}), addEventListener(t, f) { this.handlers.push(f); } } });
    panel = make();
    const ctx = { state: {}, ensureStyle: async () => {}, quickScan: () => { scans++; return d.promise; }, measureProviders: async () => { measures++; return {}; }, render: () => renders++, openPanel: () => panel, holdToOpen: () => holds++ };
    vm.runInNewContext(code + ';globalThis.run=openStorage', ctx);
    return { run: ctx.run, d, get panel() { return panel; }, replace: () => { panel.dialog.isConnected = false; panel = make(); return panel; }, get scans() { return scans; }, get measures() { return measures; }, get holds() { return holds; }, get renders() { return renders; } };
}
await test('점검 도구: 겹쳐 열어도 한 번 읽고 복사 리스너는 하나 · 읽기 실패는 다음에 다시 · 떨어진 창에는 안 그려요', async () => {
    const h = statusHarness(), jobs = Array.from({ length: 10 }, () => h.run());
    await new Promise(r => setTimeout(r, 0));
    assert.equal(h.reads, 2);
    h.d.resolve({}); await Promise.all(jobs);
    for (const f of h.listeners) await f({ target: { closest: () => ({ dataset: { act: 'copy' } }) } });
    assert.equal(h.copies, 1); await h.run(); assert.equal(h.listeners.length, 1);
    const g = statusHarness(), job = g.run(); await new Promise(r => setTimeout(r, 0)); g.d.reject(Error('offline')); await assert.rejects(job); assert.equal(g.panel._blsStatusJob, null);
    const fresh = statusHarness(), p = fresh.run(); await new Promise(r => setTimeout(r, 0)); const n = fresh.renders; fresh.panel.dialog.isConnected = false; fresh.d.resolve({}); await p; assert.equal(fresh.renders, n);
});
await test('저장 공간 창: 겹쳐 열어도 한 번 재고 제목 · 누름 리스너는 하나 · 닫았다 연 창에만 그려요 · 실패하면 다시 잴 수 있어요', async () => {
    const h = storageHarness(), jobs = Array.from({ length: 8 }, () => h.run());
    await new Promise(r => setTimeout(r, 0));
    assert.equal(h.scans, 1); h.d.resolve({}); await Promise.all(jobs);
    assert.equal(h.measures, 1); assert.equal(h.holds, 1); assert.equal(h.panel.dialog.handlers.length, 1);
    const g = storageHarness(), a = g.run(); await new Promise(r => setTimeout(r, 0)); g.replace(); const b = g.run(); await new Promise(r => setTimeout(r, 0));
    assert.equal(g.scans, 1); g.d.resolve({}); await Promise.all([a, b]); assert.equal(g.renders, 1);
    const f = storageHarness(), c = f.run(); await new Promise(r => setTimeout(r, 0)); f.d.reject(Error('offline')); await assert.rejects(c); assert.equal(f.panel._blsStorageJob, null);
    await assert.rejects(f.run()); assert.equal(f.scans, 2); assert.equal(f.holds, 1);
});

await test('1.0.9 console.error 감싸기: 원래 함수로 이어 부름 · 남이 감싼 위에 사슬 · 같은 주인 표시면 다시 안 감쌈 · 기록이 실패해도 원래 함수는 불림', async () => {
    const { installErrorRing } = await import(url('src/addons/perf/storage/errors.js'));
    const WRAP = Symbol.for('blue-lemonade.console-error.wrap');
    const seen = [];
    const base = function (...a) { seen.push(['base', this?.tag, ...a]); };
    const other = function (...a) { seen.push(['other', ...a]); return base.apply(this, a); }; other[WRAP] = 'other-ext';
    const g = { console: { tag: 'c', error: other }, addEventListener() {} };
    const ring = installErrorRing(g);
    assert.notEqual(g.console.error, other); assert.equal(g.console.error[WRAP], 'blue-lemonade');
    g.console.error('하나', Error('둘'));
    assert.deepEqual(seen.map(x => x[0]), ['other', 'base']); assert.equal(seen[1][1], 'c', 'this 를 그대로 넘김');
    assert.equal(ring.list().length, 1); assert.match(ring.list()[0].text, /하나 Error: 둘/);
    // 같은 주인이 이미 감싼 console 이면(다른 전역에서 한 번 더) 다시 감싸지 않아요
    const mine = g.console.error, h = { console: { error: mine }, addEventListener() {} };
    installErrorRing(h); assert.equal(h.console.error, mine);
    // 기록할 값이 글로 안 풀려도 원래 함수는 불려요
    seen.length = 0;
    const bad = { get message() { throw Error('x'); } };
    g.console.error(bad); assert.equal(seen.at(-1)[0], 'base');
});

console.log(`perf storage: ${passed} passed`);
