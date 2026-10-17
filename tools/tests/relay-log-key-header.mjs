// 요청 로그(성능 보조) 2.2.9: 중계 서버 최근 로그를 부를 때 API 키를 주소(?key=)에 붙이지 않고 Authorization 머리글로만 보낸다.
// 머리글을 못 읽는 옛 서버(400 · 401 · 403 · success:false)일 때만 한 번 ?key= 로 다시 묻고, 그 주소는 그 길을 기억한다.
// 연결 실패 · 시간 초과 · 429 · 5xx 에서는 ?key= 로 다시 묻지 않는다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || '.';
const source = readFileSync(join(root, 'src/addons/perf/budget.js'), 'utf8');
let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); } catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}
function cut(start, endMark = '\n}\n') {
    const i = source.indexOf(start); assert.ok(i >= 0, start);
    return source.slice(i, source.indexOf(endMark, i) + endMark.length);
}

const KEY = 'sk-test-relay-key-0000';
function harness(server) {
    const calls = [];
    let base = 'https://relay-a.example';
    const env = {
        RELAY_LOG_LIMIT: 1000,
        config: () => ({ key: KEY }),
        baseUrl: () => base,
        keyHeaders: () => ({ Authorization: `Bearer ${KEY}` }),
        relayGet: async (path, headers) => { calls.push({ base, path, headers }); return server(path, headers); },
    };
    const code = cut('const logKeyMode = new Map();', '\n}\n');
    const fn = new Function('env', `with (env) { ${code}; return fetchKeyLogs; }`)(env);
    return { calls, run: fn, setBase: b => { base = b; } };
}
const refuse = status => Object.assign(new Error(`HTTP ${status}`), { status });

await check('the source no longer builds ?key= except in the one legacy fallback', () => {
    const uses = source.match(/\?key=\$\{/g) || [];
    assert.equal(uses.length, 1, 'exactly one ?key= (legacy fallback)');
    assert.match(source, /fetchKeyLogs\(\),/);
    assert.doesNotMatch(source, /relayGet\(`\/api\/log\/token\?key=\$\{encodeURIComponent\(config\(\)\.key\)\}&p=1/);
    assert.match(source, /refusedBody: true/);
});

await check('a modern server: header only, key never in the URL', async () => {
    const h = harness(() => ({ success: true, data: [] }));
    await h.run(); await h.run();
    assert.equal(h.calls.length, 2);
    for (const c of h.calls) { assert.ok(!c.path.includes(KEY), c.path); assert.ok(!c.path.includes('key=')); assert.equal(c.headers.Authorization, `Bearer ${KEY}`); }
});

await check('an old server (401): one retry with ?key=, then remembered for that address only', async () => {
    const h = harness(path => { if (!path.includes('key=')) throw refuse(401); return { success: true, data: [] }; });
    await h.run();
    assert.deepEqual(h.calls.map(c => c.path.includes('key=')), [false, true]);
    await h.run();
    assert.deepEqual(h.calls.map(c => c.path.includes('key=')), [false, true, true], 'remembered: straight to the legacy path');
    h.setBase('https://relay-b.example');
    await h.run().catch(() => {});
    assert.equal(h.calls.at(-2).base, 'https://relay-b.example');
    assert.ok(!h.calls.at(-2).path.includes('key='), 'a new address starts with the header again');
});

await check('success:false body also counts as "old server"', async () => {
    const h = harness(path => { if (!path.includes('key=')) throw Object.assign(new Error('no key'), { refusedBody: true }); return { success: true, data: [] }; });
    await h.run();
    assert.deepEqual(h.calls.map(c => c.path.includes('key=')), [false, true]);
});

await check('network error, timeout, 429 and 5xx never retry with the key in the URL', async () => {
    for (const error of [new TypeError('Failed to fetch'), new Error('응답이 없어요 (15초)'), refuse(429), refuse(502)]) {
        const h = harness(() => { throw error; });
        await assert.rejects(h.run());
        assert.equal(h.calls.length, 1, String(error.message));
        assert.ok(!h.calls[0].path.includes('key='));
    }
});

await check('once the header worked on an address, a later 401 is not downgraded to ?key=', async () => {
    let n = 0;
    const h = harness(path => { n++; if (n === 1) return { success: true, data: [] }; throw refuse(401); });
    await h.run();
    await assert.rejects(h.run());
    assert.equal(h.calls.filter(c => c.path.includes('key=')).length, 0);
});

console.log(`relay-log-key-header: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
