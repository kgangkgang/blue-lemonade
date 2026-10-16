// 한글화 패널(prompt) 번역 캐시 파일 — src/addons/prompt/index.js 의 캐시 층(user/files 조각 파일 · 목록 파일)과 설정 옮기기(cfg)
//   node tools/tests/prompt-translation-cache.mjs <테마 루트>
// index.js 에서 캐시 층 · 언어 키 · cfg() 글을 잘라 vm 에서 돌리고, fetch 는 메모리 속 가짜 파일 서버(/user/files · /api/files/upload · delete)로 바꾼다.
// 합성 자료만 쓴다 (사용자 자료 · 개인 항목 이름 없음). 네트워크 · 실제 파일 쓰기 없음.
// 확인하는 것:
//   1) 저장: 번역 → 그 자료의 조각 파일 하나(제목 번역도 같은 조각) + 목록 파일 · 600ms 몰아 쓰기
//   2) 다른 탭이 그새 쓴(지운) 번역을 덮어쓰거나 되살리지 않는다 — 가장 새 조각 파일에 내 변경만 합친다
//   3) 비우기(clearNS): 지운 것만 빼고, 조각이 비면 파일을 지우고 목록에서도 뺀다 (다른 탭이 더한 목록 항목은 그대로)
//   4) 읽지 못한 조각 · 읽지 못한 목록 파일이면 그 세션에는 쓰지 않는다 (읽지 못한 남의 번역을 지우지 않게)
//   5) 올리기 실패 → 더러운 채로 10초 뒤 다시 · 알림은 한 번 · 올리는 동안 고친 번역도 잃지 않는다
//   6) 전부 지우기 → 모든 조각 파일 삭제 + 빈 목록 파일 (예전 IndexedDB 옮기기가 다시 돌지 않게)
//   7) 예전 IndexedDB 번역은 목록 파일이 없을 때 한 번만 옮기고, DB 는 지우지 않는다
//      — 옮겨 온 월드인포 번역을 다시 번역해도 새로고침 뒤 옛 번역이 이기면 안 된다 (지금 코드는 옛 번역이 이김: 보고한 버그)
//   8) 설정 옮기기: 옛 '__same__' 제목 · 주석 언어, 연결 방식, 숫자 범위 — 옛 제목 캐시 키가 그대로 맞는다
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('src/addons/prompt/index.js');
const conn = read('src/addons/prompt/connection.js');
const { forEachLimited } = await import(pathToFileURL(path.join(root, 'src/addons/prompt/cache-loading.js')).href);
const section = (text, start, end) => { const a = text.indexOf(start), b = text.indexOf(end, a + start.length); assert.ok(a >= 0 && b > a, `잘라낼 곳을 못 찾음: ${start}`); return text.slice(a, b); };
const CODE = [
    section(src, "const ST_PROFILE = '__st_profile__';", 'const PROVIDER_LIST'),
    section(src, 'const DEFAULT_PARAMS = {', 'const PARAM_LABELS'),
    // connection.js 의 공급자별 모델 기억 (cfg 가 부른다) — 그 파일의 상수와 함께 감싸서
    `const syncModelMemory = (() => {\n${section(conn, 'const cleanUrl=', 'export function customEndpoint')}\n${section(conn, 'export function syncModelMemory(c) {', '/** 공급자를 바꾼 뒤').replace('export function', 'function')}\nreturn syncModelMemory;\n})();`,
    section(src, 'function cfg() {', 'function getCurrentParams() {'),
    section(src, '// ── Translation Cache Layer', '// A hidden/closing tab'),
    section(src, '// Effective target language string.', '// Local heuristic only.'),
    `globalThis.__api = { cfg, effLang, ck, ckT, getCached, setCache, getCachedTitle, setCacheTitle, clearNS, cacheDelete, flushTranslationCache, clearTranslationCache, initTranslationCache, getCacheStats, shardFileForNS, CACHE_INDEX_FILE,
        state: () => JSON.stringify({ size: translationMap.size, dirty: [...dirtyShards], broken: [...brokenShards], writable: cacheWritable }) };`,
].join('\n');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

/** 메모리 속 가짜 파일 서버 — 실리태번 user/files 와 같은 길 · 같은 상태 코드 */
function server(initial = {}) {
    const files = new Map(Object.entries(initial).map(([name, value]) => [name, JSON.stringify(value)]));
    const log = [], failing = new Map();
    let gate = null;
    const respond = (status, text = '') => ({ status, ok: status >= 200 && status < 300, json: async () => JSON.parse(text) });
    async function fetch(url, opts = {}) {
        if (url.startsWith('/user/files/')) {
            const name = url.slice('/user/files/'.length);
            log.push('GET ' + name);
            if (failing.has('GET ' + name)) return respond(failing.get('GET ' + name));
            return files.has(name) ? respond(200, files.get(name)) : respond(404);
        }
        const body = JSON.parse(opts.body);
        if (url === '/api/files/upload') {
            log.push('PUT ' + body.name);
            if (gate) await gate(body.name);
            if (failing.has('PUT ' + body.name)) return respond(failing.get('PUT ' + body.name));
            files.set(body.name, Buffer.from(body.data, 'base64').toString('utf8'));
            return respond(200);
        }
        if (url === '/api/files/delete') {
            const name = body.path.replace(/^user\/files\//, '');
            log.push('DEL ' + name);
            if (failing.has('DEL ' + name)) return respond(failing.get('DEL ' + name));
            if (!files.has(name)) return respond(404);
            files.delete(name);
            return respond(200);
        }
        throw new Error('예상 밖 요청 ' + url);
    }
    return { files, log, failing, fetch, json: name => (files.has(name) ? JSON.parse(files.get(name)) : null), put: (name, value) => files.set(name, JSON.stringify(value)), gate: fn => { gate = fn; } };
}

/** 새 모듈 상태 한 벌 (vm 컨텍스트) — 세션 하나 = 탭 하나 */
function boot({ srv = server(), settings = {}, indexedDB } = {}) {
    const timers = [], toasts = [], warns = [];
    const ctx = {
        console: { log() {}, warn: (...a) => warns.push(a.map(String).join(' ')), error() {} },
        fetch: srv.fetch, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }), btoa, TextEncoder, forEachLimited,
        setTimeout: (_fn, ms) => { timers.push(ms); return timers.length; }, clearTimeout() {},
        toastr: { warning: m => toasts.push(['warning', m]), error: m => toasts.push(['error', m]), success() {}, info() {} },
        EXT: 'prompt-panel', extension_settings: { 'prompt-panel': settings }, indexedDB,
    };
    vm.createContext(ctx);
    vm.runInContext(CODE, ctx);
    const api = { ...ctx.__api, state: () => JSON.parse(ctx.__api.state()) };   // vm 쪽 배열은 원형이 달라 JSON 으로 옮겨 견준다
    return { api, srv, timers, toasts, warns, settings };
}

const NS = 'pt-preset::Sample', WI = 'pt-wi::Atlas';
const shardOf = ns => boot().api.shardFileForNS(ns);
const A = shardOf(NS), B = shardOf(WI), C = shardOf('pt-char::extra.png');
const INDEX = 'prompt-panel-cache-index.json';

await test('저장: 번역 → 그 자료의 조각 파일 하나(제목 번역도 같은 조각) + 목록 파일, 600ms 뒤 몰아서', async () => {
    const t = boot();
    await t.api.initTranslationCache();
    assert.deepEqual(t.srv.json(INDEX), { version: 1, shards: [] }, '처음 세션은 빈 목록 파일을 만든다');
    t.api.setCache(NS, 'main', '### 메인\n\n생생하게 쓴다.');
    t.api.setCacheTitle(NS, 'tone', '어조');
    t.api.setCache(WI, 'Atlas::0', '조용한 항구.');
    assert.ok(!t.srv.log.some(l => l.startsWith('PUT prompt-panel-cache-') && l !== 'PUT ' + INDEX), '바로 올리지 않는다');
    assert.ok(t.timers.includes(600));
    await t.api.flushTranslationCache();
    assert.match(A, /^prompt-panel-cache-[0-9a-f]{8}\.json$/);
    assert.equal(t.api.shardFileForNS(NS + '@title'), A, '제목 전용 번역도 같은 조각');
    assert.deepEqual(t.srv.json(A), { entries: { 'pt-preset::Sample::main::Korean': '### 메인\n\n생생하게 쓴다.', 'pt-preset::Sample@title::tone::Korean': '어조' } });
    assert.deepEqual(t.srv.json(B), { entries: { 'pt-wi::Atlas::Atlas::0::Korean': '조용한 항구.' } });
    assert.deepEqual(t.srv.json(INDEX).shards.sort(), [A, B].sort());
    // 다음 세션(새로고침)이 같은 번역을 읽는다
    const next = boot({ srv: t.srv });
    await next.api.initTranslationCache();
    assert.equal(next.api.getCached(NS, 'main'), '### 메인\n\n생생하게 쓴다.');
    assert.equal(next.api.getCachedTitle(NS, 'tone'), '어조');
    assert.equal(next.api.getCacheStats().count, 3);
});

await test('다른 탭이 그새 쓴 번역은 덮지 않고, 다른 탭이 지운 번역은 되살리지 않는다', async () => {
    const srv = server({ [INDEX]: { version: 1, shards: [A] }, [A]: { entries: { 'pt-preset::Sample::main::Korean': '옛 메인' } } });
    const t = boot({ srv });
    await t.api.initTranslationCache();
    assert.equal(t.api.getCached(NS, 'main'), '옛 메인');
    srv.put(A, { entries: { 'pt-preset::Sample::main::Korean': '옛 메인', 'pt-preset::Sample::tone::Korean': '다른 탭 번역' } });
    t.api.setCache(NS, 'extra', '내 번역');
    await t.api.flushTranslationCache();
    assert.deepEqual(srv.json(A).entries, { 'pt-preset::Sample::main::Korean': '옛 메인', 'pt-preset::Sample::tone::Korean': '다른 탭 번역', 'pt-preset::Sample::extra::Korean': '내 번역' });
    assert.equal(t.api.getCached(NS, 'tone'), '다른 탭 번역', '저장하며 다른 탭 번역을 메모리에도 받는다');
    srv.put(A, { entries: { 'pt-preset::Sample::tone::Korean': '다른 탭 번역', 'pt-preset::Sample::extra::Korean': '내 번역' } });   // 다른 탭이 main 을 지움
    t.api.setCache(NS, 'extra', '내 번역 2');
    await t.api.flushTranslationCache();
    assert.deepEqual(srv.json(A).entries, { 'pt-preset::Sample::tone::Korean': '다른 탭 번역', 'pt-preset::Sample::extra::Korean': '내 번역 2' });
    assert.equal(t.api.getCached(NS, 'main'), null, '지워진 번역은 메모리에서도 뺀다');
});

await test('비우기(clearNS): 지운 것만 빼고, 조각이 비면 파일을 지우고 목록에서 뺀다 (다른 탭이 더한 목록 항목은 그대로)', async () => {
    const srv = server({
        [INDEX]: { version: 1, shards: [A, B] },
        [A]: { entries: { 'pt-preset::Sample::main::Korean': '### 메인\n\n본문', 'pt-preset::Sample@title::main::Korean': '메인 제목' } },
        [B]: { entries: { 'pt-wi::Atlas::Atlas::0::Korean': '항구', 'pt-wi::Atlas::Atlas::1::Korean': '탑' } },
    });
    const t = boot({ srv });
    await t.api.initTranslationCache();
    srv.put(C, { entries: { 'pt-char::extra.png::description::Korean': '다른 탭' } });
    srv.put(INDEX, { version: 1, shards: [A, B, C] });   // 다른 탭이 새 조각을 목록에 더함
    t.api.clearNS(NS, ['main']);
    await t.api.flushTranslationCache();
    assert.ok(srv.log.includes('DEL ' + A));
    assert.equal(srv.json(A), null);
    assert.deepEqual(srv.json(INDEX).shards, [B, C]);
    t.api.clearNS(WI, ['Atlas::0']);
    await t.api.flushTranslationCache();
    assert.deepEqual(srv.json(B).entries, { 'pt-wi::Atlas::Atlas::1::Korean': '탑' });
    assert.deepEqual(srv.json(INDEX).shards, [B, C]);
    assert.equal(t.api.getCached(WI, 'Atlas::1'), '탑');
});

await test('읽지 못한 조각 파일은 그 세션에 쓰지 않는다 · 목록 파일을 못 읽으면 아무 파일도 쓰지 않는다', async () => {
    const srv = server({ [INDEX]: { version: 1, shards: [A] }, [A]: { entries: { 'pt-preset::Sample::main::Korean': '남의 번역' } } });
    srv.failing.set('GET ' + A, 500);
    const t = boot({ srv });
    await t.api.initTranslationCache();
    assert.deepEqual(t.api.state().broken, [A]);
    assert.ok(t.toasts.some(([type, m]) => type === 'warning' && m.includes('1개')));
    t.api.setCache(NS, 'tone', '새 번역');
    t.api.setCache(WI, 'Atlas::0', '항구');
    await t.api.flushTranslationCache();
    assert.ok(!srv.log.includes('PUT ' + A), '읽지 못한 조각은 덮어쓰지 않는다');
    assert.deepEqual(srv.json(A).entries, { 'pt-preset::Sample::main::Korean': '남의 번역' });
    assert.ok(srv.log.includes('PUT ' + B), '다른 조각은 저장');

    const bad = server({ [INDEX]: { version: 1, shards: [A] }, [A]: { entries: { 'pt-preset::Sample::main::Korean': '남의 번역' } } });
    bad.failing.set('GET ' + INDEX, 503);
    const u = boot({ srv: bad });
    await u.api.initTranslationCache();
    assert.equal(u.api.state().writable, false);
    assert.ok(u.toasts.some(([type]) => type === 'warning'));
    u.api.setCache(NS, 'tone', '새 번역');
    u.api.clearNS(NS, ['main']);
    await u.api.flushTranslationCache();
    assert.deepEqual(bad.log.filter(l => !l.startsWith('GET ')), [], '올리기 · 지우기 요청 0');
});

await test('올리기 실패: 더러운 채로 10초 뒤 다시 · 알림은 한 번 · 올리는 동안 고친 번역도 잃지 않는다', async () => {
    const t = boot();
    await t.api.initTranslationCache();
    t.api.setCache(NS, 'main', '첫 번역');
    t.srv.failing.set('PUT ' + A, 500);
    await t.api.flushTranslationCache();
    assert.deepEqual(t.api.state().dirty, [A]);
    assert.ok(t.timers.includes(10000));
    await t.api.flushTranslationCache();
    assert.equal(t.toasts.filter(([type]) => type === 'error').length, 1, '실패 알림은 한 번');
    t.srv.failing.delete('PUT ' + A);
    let edited = false;
    t.srv.gate(async name => { if (name === A && !edited) { edited = true; t.api.setCache(NS, 'main', '고친 번역'); } });
    await t.api.flushTranslationCache();
    assert.equal(t.srv.json(A).entries['pt-preset::Sample::main::Korean'], '첫 번역');
    assert.equal(t.api.getCached(NS, 'main'), '고친 번역', '올리는 동안 고친 것은 파일 값으로 덮지 않는다');
    assert.deepEqual(t.api.state().dirty, [A]);
    await t.api.flushTranslationCache();
    assert.equal(t.srv.json(A).entries['pt-preset::Sample::main::Korean'], '고친 번역');
    assert.deepEqual(t.srv.json(INDEX).shards, [A]);
});

await test('전부 지우기: 목록 · 메모리 · 다른 탭이 더한 조각 파일까지 지우고 빈 목록 파일을 남긴다', async () => {
    const srv = server({ [INDEX]: { version: 1, shards: [A] }, [A]: { entries: { 'pt-preset::Sample::main::Korean': '번역' } } });
    const t = boot({ srv });
    await t.api.initTranslationCache();
    srv.put(C, { entries: { 'pt-char::extra.png::description::Korean': '다른 탭' } });
    srv.put(INDEX, { version: 1, shards: [A, C] });
    t.api.setCache(WI, 'Atlas::0', '아직 안 올린 번역');
    await t.api.clearTranslationCache();
    assert.equal(srv.json(A), null); assert.equal(srv.json(C), null); assert.equal(srv.json(B), null);
    assert.deepEqual(srv.json(INDEX), { version: 1, shards: [] });
    assert.equal(t.api.getCacheStats().count, 0);
    await t.api.flushTranslationCache();
    assert.equal(srv.json(B), null, '지우기 전에 밀려 있던 저장이 되살아나지 않는다');
    let opened = 0;
    const next = boot({ srv, indexedDB: { databases: async () => [{ name: 'PTTranslationDB_PLUS' }], open() { opened++; throw new Error('열면 안 됨'); } } });
    await next.api.initTranslationCache();
    assert.equal(opened, 0, '빈 목록 파일이 있으면 예전 DB 를 다시 읽지 않는다');
});

/** 예전 IndexedDB(PTTranslationDB_PLUS) 가짜 — 요청 객체에 onsuccess 를 단 뒤 다음 틱에 결과를 준다 */
function legacyDB(records, idb = { closed: 0, deleted: 0 }) {
    const later = (req, set) => { Promise.resolve().then(() => { set(); req.onsuccess(); }); return req; };
    const db = { objectStoreNames: { contains: name => name === 'translations' }, close() { idb.closed++; },
        transaction: () => ({ objectStore: () => ({ getAll() { const req = {}; return later(req, () => { req.result = records; }); } }) }) };
    return { databases: async () => [{ name: 'PTTranslationDB_PLUS' }], deleteDatabase() { idb.deleted++; },
        open(name) { assert.equal(name, 'PTTranslationDB_PLUS'); const req = {}; return later(req, () => { req.result = db; }); } };
}

await test('예전 IndexedDB 번역: 목록 파일이 없을 때 한 번만 조각 파일로 옮기고, DB 는 지우지 않는다', async () => {
    const idb = { closed: 0, deleted: 0 };
    const t = boot({ indexedDB: legacyDB([
        { cacheKey: 'pt-preset::Old::main::Korean', translation: '옛 번역' },
        { cacheKey: 'pt-preset::Old@title::tone::Korean', translation: '옛 제목' },
        { cacheKey: 'pt-wi::Book::Book::3::Korean', translation: '옛 월드인포' },
        { cacheKey: 'pt-preset::Old::empty::Korean', translation: '' },
    ], idb) });
    await t.api.initTranslationCache();
    const old = t.api.shardFileForNS('pt-preset::Old');
    assert.deepEqual(t.srv.json(old).entries, { 'pt-preset::Old::main::Korean': '옛 번역', 'pt-preset::Old@title::tone::Korean': '옛 제목' }, '빈 번역은 옮기지 않는다');
    const listed = t.srv.json(INDEX).shards;
    assert.ok(listed.includes(old));
    for (const file of listed) assert.ok(t.srv.json(file), `목록의 조각 파일이 실제로 있다: ${file}`);
    assert.equal(idb.closed, 1); assert.equal(idb.deleted, 0);
    const next = boot({ srv: t.srv, indexedDB: { databases: async () => { throw new Error('다시 읽으면 안 됨'); } } });
    await next.api.initTranslationCache();
    assert.equal(next.api.getCached('pt-preset::Old', 'main'), '옛 번역');
    assert.equal(next.api.getCachedTitle('pt-preset::Old', 'tone'), '옛 제목');
    assert.equal(next.api.getCached('pt-wi::Book', 'Book::3'), '옛 월드인포', '옮긴 월드인포 번역도 다음 세션에 읽힌다');
    const none = boot({ indexedDB: { databases: async () => [], open() { throw new Error('없는 DB 를 만들면 안 됨'); } } });
    await none.api.initTranslationCache();
    assert.deepEqual(none.srv.json(INDEX), { version: 1, shards: [] });
});

await test('옮겨 온 월드인포 번역을 다시 번역하면 새로고침 뒤에도 새 번역이 남는다 (옛 조각의 번역이 이기지 않게)', async () => {
    // 월드인포 항목 id 는 「책::uid」 라 키에 '::' 가 하나 더 있다 — 옮기기는 이 키를 'pt-wi::Book::Book' 조각에, 새 저장은 'pt-wi::Book' 조각에 쓴다
    const first = boot({ indexedDB: legacyDB([{ cacheKey: 'pt-wi::Book::Book::3::Korean', translation: '옛 월드인포' }]) });
    await first.api.initTranslationCache();
    const second = boot({ srv: first.srv });
    await second.api.initTranslationCache();
    second.api.setCache('pt-wi::Book', 'Book::3', '새 월드인포');
    await second.api.flushTranslationCache();
    assert.equal(second.api.getCached('pt-wi::Book', 'Book::3'), '새 월드인포');
    const third = boot({ srv: first.srv });
    await third.api.initTranslationCache();
    assert.equal(third.api.getCached('pt-wi::Book', 'Book::3'), '새 월드인포', '새로고침 뒤 옛 번역으로 돌아가면 안 된다');
    const holders = third.srv.json(INDEX).shards.filter(file => Object.hasOwn(third.srv.json(file)?.entries || {}, 'pt-wi::Book::Book::3::Korean'));
    assert.equal(holders.length, 1, '같은 키가 두 조각 파일에 남지 않는다');
});

await test('설정 옮기기: 옛 \'__same__\' 제목 언어는 그때의 본문 언어로 — 옛 제목 캐시가 그대로 맞고, 주석은 한국어로', async () => {
    const srv = server({ [INDEX]: { version: 1, shards: [A] }, [A]: { entries: { 'pt-preset::Sample@title::tone::Japanese': 'トーン', 'pt-preset::Sample::main::Japanese': '本文' } } });
    const settings = { targetLang: 'Japanese', titleLang: '__same__', noteLang: '__same__', provider: 'claude', titleBatchSize: 0, requestDelayMs: -5, concurrency: 3, maxRetries: -1, requestTimeoutMs: 1000, parameters: { claude: { temperature: 0.4, top_p: 1, top_k: 0 } } };
    const t = boot({ srv, settings });
    await t.api.initTranslationCache();
    assert.equal(t.api.getCachedTitle(NS, 'tone'), 'トーン');
    assert.equal(t.api.getCached(NS, 'main'), '本文');
    assert.equal(settings.titleLang, 'Japanese'); assert.equal(settings.noteLang, 'Korean'); assert.equal(t.api.effLang('note'), 'Korean');
    assert.equal(settings.connectionMode, 'direct', '공급자를 골라 둔 옛 설정은 직접 연결');
    assert.deepEqual([settings.titleBatchSize, settings.requestDelayMs, settings.concurrency, settings.maxRetries, settings.requestTimeoutMs], [15, 60, 3, 2, 120000], '범위 밖 값만 기본값으로');
    assert.equal(settings.parameters.claude.temperature, 0.4, '사용자가 고친 매개변수는 그대로');
    assert.equal(settings.parameters.openai.temperature, 1, '없던 공급자 매개변수는 채운다');
    settings.targetLang = 'Korean';   // 본문 언어를 바꾸면 다른 키 — 옛 번역은 지우지 않는다
    assert.equal(t.api.getCached(NS, 'main'), null);
    assert.equal(t.api.getCachedTitle(NS, 'tone'), 'トーン', '제목 언어는 따로');
    assert.equal(srv.json(A).entries['pt-preset::Sample::main::Japanese'], '本文');
});

await test('설정 옮기기: 연결 방식 · 직접 입력 언어 (\'__custom__\' 이 키에 들어가지 않는다)', () => {
    const cfgOf = settings => { const t = boot({ settings }); t.api.cfg(); return t; };
    assert.equal(cfgOf({ provider: '__st_profile__' }).settings.connectionMode, 'profile');
    const fresh = cfgOf({});
    assert.deepEqual([fresh.settings.connectionMode, fresh.settings.provider, fresh.settings.model, fresh.settings.targetLang], ['current', 'openai', 'gpt-4o-mini', 'Korean']);
    assert.equal(cfgOf({ connectionMode: 'current', provider: 'claude' }).settings.connectionMode, 'current', '이미 고른 연결 방식은 그대로');
    const custom = cfgOf({ targetLang: '__custom__', customLang: 'Esperanto' });
    assert.equal(custom.settings.titleLang, '__custom__'); assert.equal(custom.settings.titleCustomLang, 'Esperanto');
    assert.equal(custom.api.effLang('title'), 'Esperanto');
    assert.equal(custom.api.ck(NS, 'main'), 'pt-preset::Sample::main::Esperanto');
    const blank = cfgOf({ targetLang: '__custom__', customLang: '   ' });
    assert.equal(blank.api.ck(NS, 'main'), 'pt-preset::Sample::main::Korean');
    assert.equal(blank.api.ckT(NS, 'main'), 'pt-preset::Sample@title::main::Korean');
});

console.log(`prompt-translation-cache: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
