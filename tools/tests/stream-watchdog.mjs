// Synthetic byte streams and virtual time only: no network, provider calls or user data.
import assert from 'node:assert/strict';
import { watchResponse, watchRequest, isStreamRequest } from '../../src/addons/perf/watchdog.js';

const encode = text => new TextEncoder().encode(text);
const flush = () => new Promise(resolve => setImmediate(resolve));
const data = value => `data: ${JSON.stringify(value)}\n\n`;
const text = value => data({ choices: [{ delta: { content: value } }] });
const meta = 'event: message_start\ndata: {"type":"message_start","message":{"role":"assistant","content":[]}}\n\n';
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }

function clock() {
    let now = 0, next = 0;
    const timers = new Map(), stalls = [];
    const env = { now: () => now, setInterval: fn => { timers.set(++next, fn); return next; }, clearInterval: id => timers.delete(id), onStall: info => stalls.push(info) };
    return { env, timers, stalls, async advance(ms, step = 1000) {
        for (let left = ms; left > 0; left -= step) { now += Math.min(step, left); for (const fn of [...timers.values()]) fn(); await flush(); }
    } };
}
function rig(type, firstMs = 0) {
    const c = clock(), chunks = [], cuts = [], cancels = [];
    let source, ended = false, error;
    const original = new Response(new ReadableStream({ start(controller) { source = controller; }, cancel(reason) { cancels.push(reason); } }), { headers: type ? { 'Content-Type': type } : {} });
    const response = watchResponse(original, { idleMs: 20000, firstMs, env: c.env, abort: reason => cuts.push(reason) });
    const reader = response.body.getReader();
    const read = (async () => { try { for (;;) { const part = await reader.read(); if (part.done) break; chunks.push(part.value); } } catch (e) { error = e; } finally { ended = true; } })();
    return { ...c, response, cuts, cancels, get ended() { return ended; }, get error() { return error; },
        bytes: () => Buffer.concat(chunks.map(x => Buffer.from(x))),
        async emit(value) { source.enqueue(typeof value === 'string' ? encode(value) : value); await flush(); },
        async finish() { source.close(); await read; }, async cancel() { await reader.cancel(); await read; },
    };
}

for (const type of [undefined, 'text/plain; charset=utf-8', 'text/event-stream', 'Text/Event-Stream']) {
    await test(`metadata then late answer survives (${type ?? 'headerless'})`, async () => {
        const r = rig(type);
        const prelude = meta + data({ type: 'content_block_start', content_block: { type: 'thinking', thinking: '', signature: '' } });
        await r.emit(prelude); await r.advance(31000);
        assert.equal(r.cuts.length, 0); assert.equal(r.ended, false);
        const answer = text('늦게 도착한 답변');
        await r.emit(answer); await r.advance(19000); assert.equal(r.cuts.length, 0);
        await r.advance(1000); assert.equal(r.cuts.length, 1); assert.equal(r.ended, true);
        assert.equal(r.error, undefined); assert.equal(r.response.streamWatchdog.stalled, true);
        assert.equal(r.cancels.length, 1); assert.equal(r.bytes().toString(), prelude + answer);
    });
}
await test('fragmented field, BOM, UTF-8 and CR-only lines preserve bytes', async () => {
    const r = rig();
    const prelude = '\uFEFFevent: ping\rdata: {"type":"ping"}\r\r';
    for (const byte of encode(prelude)) await r.emit(Uint8Array.of(byte));
    await r.advance(31000); assert.equal(r.cuts.length, 0);
    const answer = 'data: {"delta":{"text":"고양이 🐈"}}\r\r';
    for (const byte of encode(answer)) await r.emit(Uint8Array.of(byte));
    await r.advance(20000); assert.equal(r.cuts.length, 1);
    assert.deepEqual(r.bytes(), Buffer.from(prelude + answer));
});
for (const prefix of [': keepalive\n\n', 'id: 123\nretry: 1000\n\n', 'data: {"type":"ping"}\n\n', '\r\ndata: {"choices":[{"delta":{"role":"assistant","content":""}}]}\r\n\r\n']) {
    await test(`SSE prelude does not start idle (${prefix.slice(0, 15)})`, async () => {
        const r = rig(); await r.emit(prefix); await r.advance(31000); assert.equal(r.cuts.length, 0); await r.finish();
    });
}
await test('first deadline still counts across metadata and keepalives', async () => {
    const r = rig(undefined, 30000); await r.emit(meta);
    for (let i = 0; i < 3; i++) { await r.advance(9000); await r.emit(': ping\n\n'); }
    await r.advance(3000);
    assert.equal(r.cuts.length, 1); assert.equal(r.error?.name, 'StreamStalled'); assert.equal(r.response.streamWatchdog.first, true);
});
await test('nonempty reasoning retains existing idle semantics', async () => {
    const r = rig(); await r.emit(data({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'thinking' } }));
    await r.advance(20000); assert.equal(r.cuts.length, 1); assert.equal(r.error, undefined);
});
await test('keepalive after output resets existing idle timer', async () => {
    const r = rig(); await r.emit(text('hello')); await r.advance(19000); await r.emit(': ping\n\n'); await r.advance(19000);
    assert.equal(r.cuts.length, 0); await r.advance(1000); assert.equal(r.cuts.length, 1);
});
for (const raw of ['plain answer', 'data is an ordinary word', '고양이 🐈']) {
    await test(`raw text retains first-output idle (${raw})`, async () => {
        const r = rig('text/plain'); await r.emit(raw); await r.advance(20000); assert.equal(r.cuts.length, 1); assert.equal(r.bytes().toString(), raw);
    });
}
await test('bounded prefix never buffers an unlimited incomplete line', async () => {
    const r = rig(); await r.emit(':' + 'x'.repeat(65536)); await r.advance(20000); assert.equal(r.cuts.length, 1);
});
await test('incomplete SSE line waits without treating partial JSON as output', async () => {
    const r = rig(); await r.emit('da'); await r.advance(21000); await r.emit('ta: {"choices":[{"delta":'); await r.advance(21000);
    assert.equal(r.cuts.length, 0); await r.emit('{"content":"hello"}}]}\n\n'); await r.advance(20000); assert.equal(r.cuts.length, 1);
});
await test('declared JSON and unsuccessful responses remain untouched', async () => {
    for (const original of [new Response('{"text":"ok"}', { headers: { 'content-type': 'application/json' } }), new Response('error', { status: 500 })]) {
        const c = clock(); assert.equal(watchResponse(original, { idleMs: 20000, env: c.env, abort() {} }), original); assert.equal(c.timers.size, 0);
    }
});
await test('consumer cancel releases reader and timer', async () => {
    const r = rig(); await r.emit(meta); await r.cancel(); assert.equal(r.cancels.length, 1); assert.equal(r.timers.size, 0); assert.equal(r.cuts.length, 0);
});
await test('suspended-page gap is excluded as before', async () => {
    const r = rig(); await r.emit(text('hello')); await r.advance(60000, 60000); assert.equal(r.cuts.length, 0); await r.advance(20000); assert.equal(r.cuts.length, 1);
});
await test('request header wait retains configured first deadline', async () => {
    const c = clock(), cuts = []; const request = watchRequest(new Promise(() => {}), { idleMs: 20000, firstMs: 30000, env: c.env, abort: e => cuts.push(e) });
    const failure = request.catch(e => e); await c.advance(30000); assert.equal((await failure).name, 'StreamStalled'); assert.equal(cuts.length, 1); assert.equal(c.timers.size, 0);
});
await test('request selection remains unchanged', async () => {
    const path = '/api/backends/chat-completions/generate';
    assert.equal(isStreamRequest(path, { method: 'POST', body: '{"stream":true}' }, 'http://localhost'), true);
    assert.equal(isStreamRequest(path, { method: 'POST', body: '{"stream":false}' }, 'http://localhost'), false);
    assert.equal(isStreamRequest(new Request('http://localhost' + path), { method: 'POST', body: '{"stream":true}' }, 'http://localhost'), false);
});
console.log(`${passed} stream watchdog groups passed.`);
