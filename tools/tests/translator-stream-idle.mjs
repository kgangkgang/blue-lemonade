// 번역기 2.9.3 흘려받기 시간 제한: 시작부터 세는 고정 90초가 글이 잘 흘러오는 긴 번역도 끊었다.
// 첫 글은 제한 시간까지 기다리고, 글이 오기 시작하면 조각마다 다시 세서 멈출 때만 끊는다. 진짜 streamedReply · requestCurrentConnection 에 가짜 SSE (시간은 줄여서).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const streamParts = await import(pathToFileURL(path.join(dir, 'translation-stream.js')));
const { requestCurrentConnection } = await import(pathToFileURL(path.join(dir, 'current-connection.js')));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function cut(name) {
    const start = source.search(new RegExp(`\\n(?:async )?function ${name}\\(`)); assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2);
}
// 가짜 SSE: every ms 마다 조각 하나, stallAfter 조각 뒤로는 멈춤(연결은 열린 채)
const sse = ({ pieces, every, stallAfter = Infinity }) => {
    const enc = new TextEncoder();
    return new ReadableStream({
        async start(ctrl) {
            for (let i = 0; i < pieces.length; i++) {
                if (i >= stallAfter) { await sleep(60000); return; }
                ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: pieces[i] } }] })}\n\n`));
                await sleep(every);
            }
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`));
            ctrl.close();
        },
    });
};
function makeEnv(stream) {
    const env = { streamParts, noStream: new Set(), getRequestHeaders: () => ({}), console: { warn() {} }, Request: function (url, init) { return new globalThis.Request(new URL(url, 'http://localhost/'), init); },
        fetch: async (req) => { const signal = req.signal; const body = stream();
            const reader = body.getReader();
            const guarded = new ReadableStream({ async pull(ctrl) { if (signal.aborted) { ctrl.error(signal.reason ?? Object.assign(Error('aborted'), { name: 'AbortError' })); return; }
                const abort = new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(Error('aborted'), { name: 'AbortError' })), { once: true }));
                try { const { done, value } = await Promise.race([reader.read(), abort]); if (done) ctrl.close(); else ctrl.enqueue(value); } catch (e) { ctrl.error(e); } } });
            return new Response(guarded, { status: 200 }); },
    };
    env.STREAM_IDLE_MS = 90000;
    env.streamedReply = new Function('env', `with(env){return (${cut('streamedReply')});}`)(env);
    return env;
}
const pieces = n => Array.from({ length: n }, (_, i) => `${i ? '\n\n' : ''}번역 ${i + 1}문단`);
const timedOut = (ms, idle) => Object.assign(Error(idle ? `${ms} idle` : `${ms} total`), { timeout: true, idle });

await test('직접 연결: 글이 계속 오면 제한 시간(300ms)의 다섯 배가 지나도 끊지 않는다 (조각마다 다시 셈)', async () => {
    const env = makeEnv(() => sse({ pieces: pieces(15), every: 100 }));
    const seen = [];
    const t0 = Date.now();
    const out = await env.streamedReply({ body: {}, source: 'custom', onText: text => seen.push(text), timeoutMs: 300, idleMs: 250, timedOut });
    const took = Date.now() - t0; assert.ok(took >= 1200, 'ran past the first-text limit: ' + took + ' ' + JSON.stringify(out).slice(0, 200));
    assert.match(out.data.choices[0].message.content, /번역 15문단/);
    assert.ok(seen.length >= 14);
});
await test('직접 연결: 글이 오다 멈추면 idle 시간 뒤에 「멈춤」으로 끊는다', async () => {
    const env = makeEnv(() => sse({ pieces: pieces(15), every: 50, stallAfter: 4 }));
    const t0 = Date.now();
    await assert.rejects(env.streamedReply({ body: {}, source: 'custom', onText: () => {}, timeoutMs: 5000, idleMs: 250, timedOut }), e => e.timeout && e.idle && /250 idle/.test(e.message));
    const took = Date.now() - t0;
    assert.ok(took >= 400 && took < 2000, 'cut about idleMs after the last piece: ' + took);
});
await test('직접 연결: 첫 글이 오기 전에는 제한 시간(timeoutMs)까지 기다리고 「답 없음」으로 끊는다', async () => {
    const env = makeEnv(() => sse({ pieces: pieces(3), every: 50, stallAfter: 0 }));
    await assert.rejects(env.streamedReply({ body: {}, source: 'custom', onText: () => {}, timeoutMs: 300, idleMs: 100, timedOut }), e => e.timeout && !e.idle && /300 total/.test(e.message));
});
await test('현재 연결: 흘려받는 동안 touch 로 다시 세서 제한 시간(200ms)보다 오래 와도 끊지 않는다 · touch 가 없으면 예전처럼 끊는다', async () => {
    const ctx = { mainApi: 'openai', chatCompletionSettings: {}, ChatCompletionService: { processRequest: async () => ({ choices: [{ message: { content: 'non-stream' } }] }) } };
    const base = { context: () => ctx, messages: [{ role: 'user', content: 'x' }], buildChat: async () => ({ messages: [], max_tokens: 100 }) };
    const ok = await requestCurrentConnection({ ...base, overrides: { timeoutMs: 200 }, stream: async (_c, _p, signal, touch) => {
        for (let i = 0; i < 12; i++) { if (signal.aborted) throw Error('aborted'); touch(); await sleep(60); }
        return { choices: [{ message: { content: 'streamed' } }] };
    } });
    assert.equal(ok.choices[0].message.content, 'streamed');
    await assert.rejects(requestCurrentConnection({ ...base, overrides: { timeoutMs: 200 }, stream: async (_c, _p, signal) => {
        await new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(Error('aborted'), { name: 'AbortError' })), { once: true }));
    } }), e => e.timeout && /초 안에 번역 답이 오지 않았어요/.test(e.message));
});
await test('배선: 제한 시간 = 90초 + 응답 토큰당 10ms, 10분까지 · 흘려받기 idle 90초 · 현재 연결 stream 에 touch', () => {
    assert.match(source, /const STREAM_IDLE_MS = 90000;/);
    assert.match(source, /Math\.min\(600000, 90000 \+ Math\.max\(0, replyTokens\) \* 10\)/);
    assert.match(source, /idleMs: STREAM_IDLE_MS, timedOut/);
    assert.match(source, /onText: text => \{ touch\?\.\(\); return overrides\.onStream\(text\); \}/);
    const cc = fs.readFileSync(path.join(dir, 'current-connection.js'), 'utf8');
    assert.match(cc, /const IDLE=90000;/);
    assert.match(cc, /Math\.min\(600000,90000\+Math\.max\(0,Number\(tokens\)\|\|0\)\*10\)/);
    assert.match(cc, /stream\(ctx,payload,controller\.signal,touch\)/);
    const limit = tokens => Math.min(600000, 90000 + tokens * 10);
    assert.equal(limit(1000), 100000); assert.equal(limit(24000), 330000); assert.equal(limit(100000), 600000);
});
console.log(`\ntranslator-stream-idle: ${passed} passed, 0 failed`);
