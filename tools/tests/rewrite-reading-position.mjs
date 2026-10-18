import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { watchRewriteReadingPosition: watch } = await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/addons/rewrite/reading-position.js')));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture() {
    const handlers = [];
    const source = { async emit(type, id) { if (type === 'received') for (const fn of handlers) await fn(id); } };
    const chat = { scrollTop: 500 };
    const ctx = { eventSource: source, eventTypes: { MESSAGE_RECEIVED: 'received' }, chatId: 'a', chat: [{ mes: 'before', swipe_id: 0 }] };
    const captures = [], order = [];
    const options = { getContext: () => ctx, document: { getElementById: () => chat }, keep: (element, draw) => { captures.push(element.scrollTop); order.push('keep'); return draw(); } };
    return { handlers, source, chat, ctx, captures, order, options };
}
let count = 0;
async function check(name, fn) { const f = fixture(); const stop = watch(f.options); try { await fn(f, stop); count++; console.log('PASS ' + name); } finally { stop(); } }
await check('waits for all late listeners, capturing the position immediately before host insertion', async f => {
    let release;
    f.handlers.push(() => { f.ctx.chat[0].mes = 'after'; });
    f.handlers.push(() => new Promise(resolve => release = resolve));
    const result = f.source.emit('received', 0);
    await wait(1300); // longer than the render settling window
    assert.deepEqual(f.captures, []);
    f.chat.scrollTop = 250; release(); await result;
    f.order.push('host insert');
    assert.deepEqual(f.captures, [250]); assert.deepEqual(f.order, ['keep', 'host insert']);
});
await check('unchanged text and unrelated events do not install scroll guards', async f => {
    await f.source.emit('received', 0); await f.source.emit('edited', 0); assert.deepEqual(f.captures, []);
});
await check('chat change, replaced message and changed swipe invalidate completion', async f => {
    for (const change of [() => f.ctx.chatId = 'b', () => f.ctx.chat[0] = { mes: 'replacement', swipe_id: 0 }, () => f.ctx.chat[0].swipe_id++]) {
        f.handlers.length = 0; f.handlers.push(() => { f.ctx.chat[0].mes += '!'; change(); });
        await f.source.emit('received', 0);
    }
    assert.deepEqual(f.captures, []);
});
await check('reinstalling and disposing cannot leave duplicate observers', async (f, stop) => {
    f.handlers.push(() => f.ctx.chat[0].mes += '!');
    const stop2 = watch(f.options); stop(); await f.source.emit('received', 0); assert.equal(f.captures.length, 1);
    stop2(); stop2(); await f.source.emit('received', 0); assert.equal(f.captures.length, 1);
});
await check('failed dispatch leaves the host rejection unchanged and does not protect', async f => {
    const error = Error('listener failed');
    f.handlers.push(() => { f.ctx.chat[0].mes = 'after'; throw error; });
    await assert.rejects(f.source.emit('received', 0), value => value === error); assert.deepEqual(f.captures, []);
});
await check('disposing while a listener waits prevents its later callback', async (f, stop) => {
    let finish;
    f.handlers.push(() => { f.ctx.chat[0].mes = 'after'; return new Promise(resolve => finish = resolve); });
    const result = f.source.emit('received', 0); stop(); finish(); await result; assert.deepEqual(f.captures, []);
});
console.log(`rewrite-reading-position: ${count} passed`);
