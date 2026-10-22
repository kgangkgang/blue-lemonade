// 7.7.4 다시 쓰기 API 실패 주입 — 같은 요청을 거듭 보내지 않는지 (src/addons/rewrite/core.js 는 순수 모듈, index.js 는 배선만 글로 확인)
//   ① 장면 계획 리롤: 키 · 권한 · 한도 · 잘못된 요청 · 안전 필터처럼 다시 보내도 같은 답인 오류는 첫 번에 멈춘다.
//      잦은 요청 · 붐빔은 기다렸다가, 시간 초과는 두 번 이어지면 멈춘다. 전엔 모든 오류가 곧장 시도 하나씩을 써 본채팅 요청 전체를 5번 보냈다
//   ② 금지 묘사 고쳐 쓰기: 고친 문장이 하나도 없는 답(빈 답 · 거절 · 잘린 답)이 두 번 이어지면 그만 보내고 까닭을 남긴다 (전엔 5번)
//   ③ 고칠 곳을 준비하다 오류가 나도 「지금 고치는 중」 잠금이 남지 않는다
//   node tools/tests/fault-rewrite.mjs [테마 루트]   — 네트워크 · 실리태번 없음
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/rewrite');
const core = await import(pathToFileURL(path.join(dir, 'core.js')).href);
const index = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }
const err = message => new Error(message);

await test('rerollErrorKind reads the kind out of the words SillyTavern leaves', () => {
    const cases = {
        permanent: ['Unauthorized', 'Forbidden', 'Bad Request', 'insufficient_quota', 'You exceeded your current quota', 'HTTP 401: invalid api key', 'API 응답 코드 403', 'model not found', 'context length exceeded', 'PROHIBITED_CONTENT'],
        busy: ['Too Many Requests', 'rate limit reached', 'RESOURCE_EXHAUSTED', 'Overloaded', 'mock 429'],
        transient: ['Internal Server Error', 'Bad Gateway', 'Service Unavailable', 'unknown', 'request to http://x failed, reason: socket hang up', 'Invalid response body while trying to fetch x: Premature close', "Unexpected token '<'", 'at position 429 of the stream'],
    };
    for (const [kind, list] of Object.entries(cases)) for (const m of list) assert.equal(core.rerollErrorKind(err(m)), kind, m);
    assert.equal(core.rerollErrorKind(Object.assign(err('x'), { name: 'AbortError' })), 'timeout');
});
await test('rerollUntil stops at the first error isFatal accepts and waits delayAfter between tries', async () => {
    let calls = 0; const waits = [];
    const r = await core.rerollUntil({ maxAttempts: 5, generate: async () => { calls++; throw err('Unauthorized'); }, accept: () => true,
        isFatal: e => core.rerollErrorKind(e) === 'permanent', delayAfter: () => 1500, sleep: async ms => { waits.push(ms); } });
    assert.equal(calls, 1, 'a wrong key is sent once');
    assert.equal(r.attempts, 1); assert.equal(r.error.message, 'Unauthorized');
    assert.deepEqual(waits, []);
    calls = 0;
    const busy = await core.rerollUntil({ maxAttempts: 3, generate: async () => { calls++; if (calls < 3) throw err('Too Many Requests'); return 'ok'; }, accept: x => x === 'ok',
        isFatal: () => false, delayAfter: e => core.rerollErrorKind(e) === 'busy' ? 10000 : 1500, sleep: async ms => { waits.push(ms); } });
    assert.equal(busy.result, 'ok'); assert.deepEqual(waits, [10000, 10000], 'rate limit waits before the next try');
    waits.length = 0; calls = 0;
    await core.rerollUntil({ maxAttempts: 2, generate: async () => { calls++; throw err('Bad Gateway'); }, accept: () => true, delayAfter: () => 1500, sleep: async ms => { waits.push(ms); } });
    assert.equal(calls, 2); assert.deepEqual(waits, [1500], 'no wait after the last try');
});
await test('isFatal is asked once per error (a counting rule like "second timeout" is not counted twice)', async () => {
    let asked = 0, calls = 0;
    await core.rerollUntil({ maxAttempts: 5, generate: async () => { calls++; throw Object.assign(new Error('x'), { name: 'AbortError' }); }, accept: () => true,
        isFatal: () => ++asked >= 2, delayAfter: () => 10, sleep: async () => {}, stopped: () => false });
    assert.equal(calls, 2, 'stops at the second timeout, not the first');
    assert.equal(asked, 2);
});
await test('scene plan wiring: permanent errors and a second timeout end the loop, busy waits, Stop cuts the wait', () => {
    const at = index.indexOf('const outcome = await rerollUntil({');
    assert.ok(at > 0);
    const call = index.slice(at, index.indexOf('});', at));
    assert.match(call, /isFatal: error => stopSignal\.aborted \|\| rerollErrorKind\(error\) === 'permanent' \|\| \(rerollErrorKind\(error\) === 'timeout' && \+\+timeouts >= 2\)/);
    assert.match(call, /delayAfter: error => rerollErrorKind\(error\) === 'busy' \? 10000 : 1500/);
    assert.match(call, /stopSignal\.addEventListener\('abort', done/);
    assert.match(call, /stopped: \(\) => stopSignal\.aborted/);
});
await test('rewriteText: two answers in a row without any <sN> stop the loop with a reason', async () => {
    const spans = [{ start: 0, end: 5, text: 'gold glasses', rules: [] }];
    const compiled = [];
    for (const raw of ['', "I'm sorry, but I can't help with that.", 'The answer was cut befo']) {
        let calls = 0;
        const r = await core.rewriteText({ text: 'gold glasses here', spans, exceptions: [], compiled, maxAttempts: 5, generate: async () => { calls++; return raw; } });
        assert.equal(calls, 2, 'two tries, not five: ' + JSON.stringify(raw));
        assert.equal(r.failed, 1);
        assert.ok(r.error && /빈 답|고친 문장이 없었/.test(r.error.message), 'reason kept: ' + r.error?.message);
    }
    let calls = 0;
    const ok = await core.rewriteText({ text: 'gold glasses here', spans, exceptions: [], compiled, maxAttempts: 3, generate: async () => { calls++; return calls === 1 ? '' : '<s1>black glasses</s1>'; } });
    assert.equal(calls, 2, 'one blank answer is retried once');
    assert.equal(ok.fixed, 1); assert.equal(ok.error, null);
});
await test('cleanMessage releases busy when preparing the spans throws', () => {
    const at = index.indexOf('async function cleanMessage(');
    const body = index.slice(at, index.indexOf('const clearProgress', at));
    assert.match(body, /const releaseOnThrow = fn => \{ try \{ return fn\(\); \} catch \(error\) \{ busy\.delete\(key\); throw error; \} \};/);
    assert.match(body, /releaseOnThrow\(\(\) => prepareSpans\(spans, exceptions\)\);/);
    assert.match(body, /releaseOnThrow\(\(\) => findRepeats\(/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
