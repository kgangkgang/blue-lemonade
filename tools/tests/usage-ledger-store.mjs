// 7.7.2 사용량 장부 허브의 저장 쪽 (usage-ledger.js) — 이 기기 IndexedDB 에 쓰고 · 읽고 · 90일 지난 것 지우기, 설정 다듬기, 중계 장부 맞추기.
//   node 에는 IndexedDB 가 없어 이 시험 안의 작은 메모리 흉내(열기 · put · index getAll · 커서 delete)를 쓴다. 지어낸 확장 · 중계 · 모델만.
//   node tools/tests/usage-ledger-store.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 작은 IndexedDB 흉내 (이 모듈이 쓰는 만큼만) ──
const range = (lower, upper) => ({ lower, upper, includes: v => (lower === undefined || v >= lower) && (upper === undefined || v <= upper) });
globalThis.IDBKeyRange = { bound: (a, b) => range(a, b), upperBound: b => range(undefined, b) };
const stores = new Map();
let opens = 0;
globalThis.indexedDB = {
    open(name, version) {
        opens++;
        const req = { result: null };
        queueMicrotask(() => {
            const fresh = !stores.has(name);
            const db = {
                createObjectStore(store, { keyPath }) { const s = { keyPath, rows: new Map(), indexes: new Map() }; stores.set(name, s); return { createIndex: (i, key) => s.indexes.set(i, key) }; },
                transaction(_, mode) {
                    const s = stores.get(name), t = {};
                    const store = {
                        put(row) { assert.equal(mode, 'readwrite'); s.rows.set(row[s.keyPath], structuredClone(row)); },
                        index(i) {
                            const key = s.indexes.get(i), sorted = r => [...s.rows.values()].filter(x => r.includes(x[key])).sort((a, b) => a[key] - b[key]);
                            return {
                                getAll(r) { const q = {}; queueMicrotask(() => { q.result = structuredClone(sorted(r)); q.onsuccess?.(); }); return q; },
                                openCursor(r) {
                                    const q = {}, list = sorted(r); let at = 0;
                                    const step = () => { const row = list[at++]; q.result = row ? { value: row, delete: () => s.rows.delete(row[s.keyPath]), continue: () => queueMicrotask(step) } : null; q.onsuccess?.(); };
                                    queueMicrotask(step); return q;
                                },
                            };
                        },
                    };
                    setTimeout(() => t.oncomplete?.(), 0);
                    return { ...t, objectStore: () => store, set oncomplete(f) { t.oncomplete = f; }, set onerror(f) {}, set onabort(f) {} };
                },
            };
            req.result = db;
            if (fresh) req.onupgradeneeded?.();
            req.onsuccess?.();
        });
        return req;
    },
};
// prune 은 30초 뒤에 도는 타이머 — 그 콜백을 잡아 바로 부른다
const timers = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => { if (ms === 30000) { timers.push(fn); return { unref() {} }; } return realSetTimeout(fn, ms, ...a); };

let ext = {}, saves = 0, ccs = {};
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced: () => saves++, chatCompletionSettings: ccs }) };
const H = await import(pathToFileURL(path.join(root, 'src/usage-ledger.js')).href);
const C = await import(pathToFileURL(path.join(root, 'src/usage-ledger-core.js')).href);
const live = await import(pathToFileURL(path.join(root, 'src/addons/perf/pricing-live.js')).href);
const NOW = Date.now(), DAY = 86400000;
const RELAY = 'https://relay.example.test';

await test('ledgerSettings: 빈 설정을 채우고, 틀린 결제 수단 · 환율 · 중계 환율은 버린다', () => {
    const saved = globalThis.SillyTavern; delete globalThis.SillyTavern;
    assert.deepEqual(H.ledgerSettings(), { enabled: true, krw: { ...C.DEFAULT_KRW }, payMethods: {} }, '실리태번이 없으면 기본값');
    globalThis.SillyTavern = saved;
    const s = H.ledgerSettings();
    assert.equal(ext.bl_usage_ledger, s);
    assert.deepEqual(s, { enabled: true, krw: { ...C.DEFAULT_KRW }, payMethods: {}, relayRates: {} });
    ext.bl_usage_ledger = { enabled: 'yes', krw: { rate: 0 }, payMethods: JSON.parse('{"openai":"크레딧","x":"공짜","__proto__":"중계","constructor":"중계"}'),
        relayRates: { [RELAY]: { rate: 1400 }, [RELAY + '/v1']: { rate: 1 }, 'not-url': { rate: 1 }, 'https://b.example.test': { rate: 0 }, 'https://c.example.test': { rate: 1e6 }, 'https://d.example.test': { rate: 999999 } } };
    const t = H.ledgerSettings();
    assert.equal(t.enabled, true, '참거짓이 아니면 켬');
    assert.deepEqual(t.krw, { ...C.DEFAULT_KRW });
    assert.deepEqual(Object.keys(t.payMethods), ['openai']);
    assert.deepEqual(Object.keys(t.relayRates).sort(), ['https://d.example.test', RELAY]);
    ext.bl_usage_ledger = { enabled: false, krw: { rate: '1300', date: 'd' }, payMethods: ['x'], relayRates: ['x'] };
    const u = H.ledgerSettings();
    assert.deepEqual([u.enabled, u.krw.rate, u.payMethods, u.relayRates], [false, '1300', {}, {}]);
    assert.equal(H.ledgerEnabled(), false);
    ext.bl_usage_ledger = 'broken';
    assert.equal(H.ledgerSettings().enabled, true);
    ext = {};
});

await test('record: 꺼짐 · 못 쓰는 기록은 null, 쓰면 「시각-임의」 id 를 곧바로 돌려준다', async () => {
    ext.bl_usage_ledger = { enabled: false };
    assert.equal(await H.record({ ext: 'a', feature: 'b' }), null);
    ext.bl_usage_ledger.enabled = true;
    assert.equal(await H.record({ ext: '', feature: 'b' }), null);
    assert.equal(await H.record(null), null);
    const id = await H.record({ ext: '확장', feature: '기능', model: 'm', input: 10, at: NOW - 1000 });
    assert.match(id, new RegExp(`^${NOW - 1000}-[a-z0-9]{1,8}$`));
    const realCtx = globalThis.SillyTavern;
    globalThis.SillyTavern = { getContext() { throw new Error('boom'); } };
    assert.match(await H.record({ ext: 'x', feature: 'y', at: NOW - 900 }), /^\d+-/, '문맥을 못 읽어도 기본 설정으로 적는다');
    globalThis.SillyTavern = realCtx;
});

await test('query: 큐에 쌓인 기록을 먼저 저장하고, 시각 범위(양 끝 포함) · 시각 차례로 값과 함께 돌려준다', async () => {
    let changes = 0; const off = H.on('change', () => changes++);
    const bad = H.on('change', () => { throw new Error('listener'); });
    const warn = console.warn; console.warn = () => {};
    await H.record({ ext: '확장', feature: '기능', model: 'm', input: 5, at: NOW - 3000 });
    await H.record({ ext: '확장', feature: '기능', model: 'm', input: 6, at: NOW - 2000 });
    const rows = await H.query({ from: NOW - 3000, to: NOW - 1000 });
    console.warn = warn;
    assert.deepEqual(rows.map(r => r.input), [5, 6, 10], '범위의 양 끝 포함 · 시각 차례');
    assert.ok(rows.every(r => r.cost && 'usd' in r.cost && r.id));
    await new Promise(r => realSetTimeout(r, 5));
    assert.ok(changes >= 1, '저장 뒤 알림');
    off(); bad();
    assert.deepEqual((await H.query({ from: NOW - 2999, to: NOW - 2001 })), []);
    assert.equal((await H.query()).length >= 4, true, '기본 범위 0 ~ 지금');
    assert.equal((await H.query({ from: 'x', to: 'y' })).length >= 4, true, '숫자가 아니면 기본 범위');
    assert.equal(typeof H.on('other', () => {}), 'function');
    assert.equal(typeof H.on('change', 'x'), 'function');
    assert.equal(opens, 1, '장부는 한 번만 연다');
});

await test('summary: 하루 · 한 달 · 기본(오늘) 범위와 설정 환율', async () => {
    ext.bl_usage_ledger.krw = { rate: 1000, date: '2026-10-01', source: 's' };
    const day = C.dayKey(NOW);
    const d = await H.summary({ day });
    assert.equal(d.from, C.dayStart(day));
    assert.equal(d.to, C.dayStart(day) + DAY - 1);
    assert.deepEqual(d.krw, { rate: 1000, date: '2026-10-01', source: 's' });
    assert.match(d.note, /실제 청구와 다를 수 있어요/);
    const [y, m] = day.split('-').map(Number);
    const mo = await H.summary({ month: `${y}-${String(m).padStart(2, '0')}` });
    assert.deepEqual([mo.from, mo.to], [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime() - 1]);
    const t = await H.summary();
    assert.equal(t.from, C.dayStart(C.dayKey(Date.now())));
    assert.ok(t.to >= NOW);
    const f = await H.summary({ from: NOW - 2000, to: NOW - 2000 });
    assert.equal(f.requests, 1);
});

await test('setPayMethod · payMethods: 지우기 · 위험한 열쇠 · 길이 · 저장과 알림', () => {
    const before = saves;
    assert.equal(H.setPayMethod('openai', '크레딧'), true);
    assert.equal(H.setPayMethod('k'.repeat(130), '중계'), true);
    assert.ok(ext.bl_usage_ledger.payMethods['k'.repeat(120)]);
    assert.equal(H.setPayMethod('openai', '외상'), false);
    assert.equal(H.setPayMethod('', '크레딧'), false);
    for (const k of ['__proto__', 'constructor', 'prototype']) assert.equal(H.setPayMethod(k, '크레딧'), false, k);
    assert.equal(saves, before + 2);
    const p = H.payMethods();
    assert.deepEqual(p.defaults, { vertex: '크레딧', anthropic: '크레딧', 'relay:*': '중계', '*': '실제 결제' });
    assert.equal(p.set.openai, '크레딧');
    assert.deepEqual(p.choices, ['크레딧', '실제 결제', '중계']);
    p.set.openai = 'x'; assert.equal(ext.bl_usage_ledger.payMethods.openai, '크레딧', '사본');
    assert.equal(H.setPayMethod('openai', null), true);
    assert.equal('openai' in ext.bl_usage_ledger.payMethods, false);
    H.setPayMethod('openai', '크레딧');
    assert.equal(H.setPayMethod('openai', ''), true);
    assert.equal('openai' in ext.bl_usage_ledger.payMethods, false);
});

await test('setKrwRate · setRelayRate: 범위 · 반올림 · 지우기, 중계 환율을 정한 origin 은 중계로 본다', () => {
    for (const bad of [0, -1, 100000, 'x', NaN]) assert.equal(H.setKrwRate(bad), false, String(bad));
    assert.equal(H.setKrwRate('99999.5', '2026-10-21T09:00', 'x'.repeat(100)), true);
    assert.deepEqual(ext.bl_usage_ledger.krw, { rate: 99999.5, date: '2026-10-21', source: 'x'.repeat(80) });
    assert.equal(H.setKrwRate(1300), true);
    assert.equal(ext.bl_usage_ledger.krw.date, C.dayKey(Date.now()));
    assert.equal(ext.bl_usage_ledger.krw.source, '사용자 입력');
    assert.equal(H.setRelayRate('nope', 1), false);
    for (const bad of [0, -1, 1e6, 'x']) assert.equal(H.setRelayRate(RELAY, bad), false, String(bad));
    const other = { origin: 'https://b.example.test', model: 'm', input: 1 };
    assert.equal(H.payKeyFor(other), 'other:b.example.test');
    assert.equal(H.setRelayRate('https://b.example.test/v1/x', 1400.456, 's'.repeat(90), '2026-10-22T00'), true);
    assert.deepEqual(ext.bl_usage_ledger.relayRates['https://b.example.test'], { rate: 1400.46, source: 's'.repeat(80), date: '2026-10-22' });
    assert.equal(H.payKeyFor(other), 'relay:b.example.test', '환율을 정한 중계는 그 뒤로 중계');
    assert.equal(H.payMethodFor(other), '중계');
    assert.equal(H.setRelayRate('https://b.example.test', null), true);
    assert.equal('https://b.example.test' in ext.bl_usage_ledger.relayRates, false);
    assert.equal(H.payMethodFor({ origin: 'https://api.anthropic.com' }), '크레딧');
});

await test('중계 판정: 요청 로그의 자동 가격 출처 · 예산 주소(비면 사용자 지정 주소)', () => {
    assert.equal(H.payKeyFor({ origin: 'https://auto.example.test' }), 'other:auto.example.test');
    ext.request_log = { prices: { m: { auto: true, origin: 'https://auto.example.test/v1/models' }, n: { origin: 'https://manual.example.test' } } };
    assert.equal(H.payKeyFor({ origin: 'https://auto.example.test' }), 'relay:auto.example.test');
    assert.equal(H.payKeyFor({ origin: 'https://manual.example.test' }), 'other:manual.example.test', '자동이 아닌 가격 출처는 중계 목록에 안 든다');
    ext.request_log.budget = { enabled: true, baseUrl: 'https://budget.example.test/api' };
    assert.equal(H.payKeyFor({ origin: 'https://budget.example.test' }), 'relay:budget.example.test');
    ext.request_log.budget = { enabled: false, baseUrl: 'https://off.example.test' };
    assert.equal(H.payKeyFor({ origin: 'https://off.example.test' }), 'other:off.example.test');
    ext.request_log.budget = { enabled: true, baseUrl: '' };
    ccs.custom_url = 'https://custom.example.test/v1';
    assert.equal(H.payKeyFor({ origin: 'https://custom.example.test' }), 'relay:custom.example.test');
    delete ext.request_log; ccs = {};
});

await test('applyRelayLogs: 같은 중계 · 아직 안 맞춘 기록만 실제 과금으로, 값이 장부 과금으로 바뀐다', async () => {
    assert.equal(await H.applyRelayLogs('', [{}]), 0);
    assert.equal(await H.applyRelayLogs(RELAY, []), 0);
    assert.equal(await H.applyRelayLogs(RELAY, 'x'), 0);
    const at = NOW - 60000;
    await H.record({ ext: '확장', feature: '중계 기능', model: 'r1', origin: RELAY + '/v1/chat', input: 1000, output: 100, at });
    await H.record({ ext: '확장', feature: '중계 기능', model: 'r1', origin: 'https://b.example.test', input: 1000, output: 100, at });
    const log = { type: 2, model_name: 'r1', created_at: (at + 2000) / 1000, prompt_tokens: 1000, completion_tokens: 100, quota: 250000, id: 77 };
    assert.equal(await H.applyRelayLogs(RELAY, [{ ...log, model_name: 'zzz' }]), 0, '맞는 기록이 없으면 0');
    let changes = 0; const off = H.on('change', () => changes++);
    assert.equal(await H.applyRelayLogs(RELAY + '/api/log', [log]), 1);
    off();
    assert.equal(changes, 1);
    const rows = (await H.query({ from: at, to: at })).filter(r => r.feature === '중계 기능');
    const mine = rows.find(r => r.origin === RELAY), theirs = rows.find(r => r.origin !== RELAY);
    assert.deepEqual([mine.relayQuota, mine.relayLogId, mine.cost.usd, mine.cost.priceSource], [250000, '77', 0.5, '중계 장부 (실제 과금)']);
    assert.equal(theirs.relayQuota, undefined);
    assert.equal(await H.applyRelayLogs(RELAY, [log]), 0, '이미 맞춘 기록은 다시 안 맞춘다');
    const old = { ...log, created_at: (at + 4 * DAY) / 1000 };
    assert.equal(await H.applyRelayLogs('https://b.example.test', [old]), 0, '가장 새 중계 기록에서 3일 넘게 이른 기록은 찾지 않는다');
});

await test('prune: 30초 뒤 한 번 — 90일 지난 기록만 지운다', async () => {
    await H.record({ ext: '확장', feature: '오래됨', at: NOW - 91 * DAY });
    await H.record({ ext: '확장', feature: '89일', at: NOW - 89 * DAY });
    await H.query({ from: 0, to: 1 });
    assert.equal(timers.length, 1, '처음 저장할 때 한 번만 예약');
    await H.record({ ext: '확장', feature: '더', at: NOW - 92 * DAY });
    await H.query({ from: 0, to: 1 });
    assert.equal(timers.length, 1);
    await timers[0]();
    const left = (await H.query({ from: 0, to: Date.now() })).map(r => r.feature);
    assert.ok(left.includes('89일'));
    assert.ok(!left.includes('오래됨') && !left.includes('더'));
});

await test('price · officialPrice: 공식 연결만, 묶음 가격표의 단가 · 대소문자 하나뿐일 때만 맞춤', async () => {
    assert.equal(await H.price('anything', 'custom'), null);
    const snap = live.priceSnapshot('anthropic');
    const [name, row] = Object.entries(snap.models)[0];
    const p = await H.price(name, 'claude', 1);
    assert.deepEqual([p.inPerM, p.outPerM, p.cachedInPerM, p.currency, p.date], [row[0], row[1], row[2], 'USD', String(snap.checkedAt).slice(0, 10)]);
    assert.ok(p.source.startsWith('https://'));
    assert.equal(await H.price('no-such-model-x', 'claude'), null);
    assert.equal((await H.price(name + '-20261001', 'claude')).inPerM, row[0], '날짜 붙은 이름');
    const o = live.priceSnapshot('openai'); const [oname, orow] = Object.entries(o.models).find(([, r]) => r.standard);
    assert.equal((await H.price(oname, 'openai')).inPerM, orow.standard[0]);
    const g = live.priceSnapshot('gemini'); const [gname, grow] = Object.entries(g.models).find(([, r]) => !r.expires);
    assert.equal((await H.price(gname, 'makersuite', 1)).inPerM, grow.rates.input);
    const exp = Object.entries(g.models).find(([name, r]) => r.expires && !C.EFFECTIVE_PRICES.some(e => e.model === name));
    if (exp) assert.equal(await H.price(exp[0], 'makersuite', Date.parse(exp[1].expires) + 1), null, '끝난 할인 단가는 안 쓴다');
    assert.equal((await H.officialPrice('anthropic', 'models/' + name)).rates.input, row[0]);
    assert.equal((await H.officialPrice('anthropic', name.toUpperCase())).rates.input, row[0], '대소문자만 다른 이름이 하나면 그 이름');
    assert.equal(await H.officialPrice('anthropic', 'zz-none'), null);
    assert.equal(await H.officialPrice('', name), null);
});

await test('installUsageLedger: 같은 판 BL 허브는 그대로, 아니면 새로 (얼린 허브)', () => {
    delete globalThis[C.LEDGER_SYMBOL];
    const hub = H.installUsageLedger();
    assert.ok(Object.isFrozen(hub));
    assert.deepEqual(Object.keys(hub).sort(), ['__bl', 'on', 'payMethods', 'price', 'query', 'record', 'setKrwRate', 'setPayMethod', 'summary', 'version'].sort());
    assert.equal(H.installUsageLedger(), hub);
    const foreign = { version: 9, record() {} };
    Object.defineProperty(globalThis, C.LEDGER_SYMBOL, { value: foreign, configurable: true, writable: true });
    assert.notEqual(H.installUsageLedger(), foreign, 'BL 것이 아닌 허브는 바꾼다');
    Object.defineProperty(globalThis, C.LEDGER_SYMBOL, { value: { version: 0, __bl: true }, configurable: true, writable: true });
    assert.equal(H.installUsageLedger().version, 1, '옛 판 BL 허브도 바꾼다');
    const mine = { version: 1, __bl: true };
    Object.defineProperty(globalThis, C.LEDGER_SYMBOL, { value: mine, configurable: true, writable: true });
    assert.equal(H.installUsageLedger(), mine);
});

globalThis.setTimeout = realSetTimeout;
console.log(`usage-ledger-store: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
