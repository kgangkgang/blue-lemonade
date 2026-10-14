// Synthetic asynchronous event/queue regression: no DOM, message persistence or model requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const { createGuards } = await import(pathToFileURL(path.join(dir, 'translation-guard.js')));
const cardFile = path.join(dir, 'display-cards.js');
const matchesDisplayCardStructure = fs.existsSync(cardFile) ? (await import(pathToFileURL(cardFile))).matchesDisplayCardStructure : () => true;
const completionFile = path.join(dir, 'render-completion.js');
const observeEventCompletion = fs.existsSync(completionFile)
    ? (await import(pathToFileURL(completionFile))).observeEventCompletion : null;
const queueCode = source.slice(source.indexOf('const SHARED_SAFETY ='), source.indexOf('// 자동 번역 함수들 (공식 스크립트 스타일)'));
function cut(name) {
    const start = source.indexOf(`\nfunction ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
// Host semantics relevant here: listeners run in order, each returned Promise is awaited.
class Emitter {
    listeners = new Map();
    on(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
    makeFirst(type, fn) { this.listeners.set(type, [fn, ...(this.listeners.get(type) || [])]); }
    async emit(type, ...args) {
        for (const fn of [...(this.listeners.get(type) || [])]) await fn.apply(this, args);
    }
}
function clock() {
    let now = 0, seq = 0; const tasks = new Map(), active = new Set(), errors = [];
    return {
        setTimeout(fn, ms) { const id = ++seq; tasks.set(id, { fn, at: now + ms }); return id; },
        clearTimeout(id) { tasks.delete(id); },
        async tick(ms) {
            const end = now + ms;
            while (true) {
                const due = [...tasks].sort((a, b) => a[1].at - b[1].at).find(([, t]) => t.at <= end);
                if (!due) break;
                const [id, t] = due; tasks.delete(id); now = t.at;
                const p = Promise.resolve().then(t.fn).catch(error => errors.push(error));
                active.add(p); p.finally(() => active.delete(p)); await flush();
            }
            now = end; await flush(); if (errors.length) throw errors.shift();
        },
        get pending() { return tasks.size; },
    };
}
function fixture(count = 1) {
    const messages = Array.from({ length: count }, (_, n) => ({ mes: `Synthetic answer ${n}`, swipe_id: 0, extra: {} }));
    const context = { chat: messages, chatId: 'chat-a', characterId: 1, groupId: null };
    const guards = createGuards(() => context), emitter = new Emitter(), time = clock(), calls = [];
    emitter.makeFirst('swipe', id => guards.messageChanged(id));
    const settings = { auto_mode: 'all', throttle_delay: 0 }, swipes = new WeakMap();
    let transport = async id => { calls.push({ id, message: context.chat[id], text: context.chat[id].mes }); };
    const env = {
        guards, getContext: () => context, eventSource: emitter,
        event_types: { CHARACTER_MESSAGE_RENDERED: 'incoming', USER_MESSAGE_RENDERED: 'outgoing', MESSAGE_SWIPED: 'swipe' },
        extensionSettings: settings, incomingTypes: ['all', 'ai'], outgoingTypes: ['all', 'user'],
        shouldTranslate: types => types.includes(settings.auto_mode), observeEventCompletion,
        setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
        callGenericPopup: async () => true, POPUP_TYPE: { CONFIRM: 1 },
        toastr: { info() {} }, console: { debug() {}, warn() {}, error() {} },
        autoRenderSwipes: swipes, stopAutoRenderCompletion: null,
        translateIncomingMessage: id => transport(id), translateOutgoingMessage: id => transport(id),
        substituteParams: text => text, originalHashOf: text => text, looksLikeRefusal: () => false, matchesDisplayCardStructure,
    };
    const installCode = source.includes('function installAutoRenderCompletion()') ? cut('installAutoRenderCompletion') : '';
    const api = new Function('env', `with(env) {
        ${queueCode}
        const handleIncomingMessage = createEventHandler(translateIncomingMessage, () => shouldTranslate(incomingTypes));
        const handleOutgoingMessage = createEventHandler(translateOutgoingMessage, () => shouldTranslate(outgoingTypes));
        ${source.includes('function hasCurrentSwipeTranslation(') ? cut('hasCurrentSwipeTranslation') : ''}
        ${installCode}
        ${installCode ? 'installAutoRenderCompletion();' : "eventSource.makeFirst('incoming', handleIncomingMessage); eventSource.makeFirst('outgoing', handleOutgoingMessage);"}
        return { incoming: handleIncomingMessage, outgoing: handleOutgoingMessage,
            install: ${installCode ? 'installAutoRenderCompletion' : '() => {}'}, stop: () => stopAutoRenderCompletion?.() };
    }`)(env);
    return { messages, context, guards, emitter, time, calls, settings, swipes, api,
        setTransport(fn) { transport = fn; },
        swipe(id) { const m = context.chat[id]; guards.messageChanged(id); swipes.set(m, (swipes.get(m) || 0) + 1); },
        changeChat() { guards.chatChanged(); context.chatId = 'chat-b'; context.chat = [{ mes: 'Another chat', swipe_id: 0, extra: {} }]; },
    };
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS ' + name); }

await test('auto translation waits beyond the old 300 ms timer for awaited postprocessing', async () => {
    const f = fixture(), late = deferred();
    f.emitter.on('incoming', async () => { await late.promise; f.messages[0].mes += ' completed'; f.guards.messageChanged(0); });
    const emitted = f.emitter.emit('incoming', 0);
    await flush(); await f.time.tick(450);
    assert.equal(f.calls.length, 0, 'must not buy translation of the unfinished text');
    late.resolve(); await emitted; await flush(); await f.time.tick(300);
    assert.deepEqual(f.calls.map(x => x.text), ['Synthetic answer 0 completed']);
});
await test('saved swipe selection waits for late postprocessing even without a rendered event', async () => {
    const f = fixture(), late = deferred();
    f.emitter.on('swipe', async () => { await late.promise; f.messages[0].mes = 'Completed saved swipe'; f.guards.messageChanged(0); });
    const emitted = f.emitter.emit('swipe', 0); await flush(); await f.time.tick(500);
    assert.equal(f.calls.length, 0); late.resolve(); await emitted; await flush(); await f.time.tick(300);
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].text, 'Completed saved swipe');
});
await test('a saved swipe with a current translation is not bought again', async () => {
    const f = fixture(); f.messages[0].extra = { display_text: 'Saved translation', original_text_hash: f.messages[0].mes };
    await f.emitter.emit('swipe', 0); await flush(); await f.time.tick(300); assert.equal(f.calls.length, 0);
});
await test('a saved translation of an older source cannot skip the updated swipe', async () => {
    const f = fixture(); f.messages[0].extra = { display_text: 'Old translation', original_text_hash: 'Other source' };
    await f.emitter.emit('swipe', 0); await flush(); await f.time.tick(300); assert.equal(f.calls.length, 1);
});
await test('render nested in a swipe waits for the rest of the swipe listeners', async () => {
    const f = fixture(), late = deferred();
    f.emitter.on('swipe', async () => { await f.emitter.emit('incoming', 0); await late.promise; });
    const emitted = f.emitter.emit('swipe', 0); await flush(); await f.time.tick(500);
    assert.equal(f.calls.length, 0); late.resolve(); await emitted; await flush(); await f.time.tick(300);
    assert.equal(f.calls.length, 1);
});
await test('a later swipe invalidates the pending old render even when swipe_id returns', async () => {
    const f = fixture(), late = deferred(); f.emitter.on('incoming', () => late.promise);
    const old = f.emitter.emit('incoming', 0); await flush();
    await f.emitter.emit('swipe', 0); await f.emitter.emit('swipe', 0); await flush(); await f.time.tick(300);
    const before = f.calls.length; late.resolve(); await old; await flush(); await f.time.tick(300);
    assert.equal(f.calls.length, before, 'old render must not enqueue after the new swipe');
});
await test('same-text and display postprocessing is captured after completion without dropping the job', async () => {
    const f = fixture();
    f.emitter.on('incoming', () => { f.guards.messageChanged(0); f.messages[0].extra.display_text = 'Postprocessed display'; });
    await f.emitter.emit('incoming', 0); await flush(); await f.time.tick(300);
    assert.equal(f.calls.length, 1);
});
await test('outgoing rendered events receive the same completion boundary', async () => {
    const f = fixture(), late = deferred();
    f.emitter.on('outgoing', async () => { await late.promise; f.messages[0].mes = 'Final outgoing'; });
    const emitted = f.emitter.emit('outgoing', 0); await flush(); await f.time.tick(500);
    assert.equal(f.calls.length, 0); late.resolve(); await emitted; await flush(); await f.time.tick(300);
    assert.equal(f.calls[0].text, 'Final outgoing');
});
await test('nested same-message renders finish once without waiting for translation', async () => {
    const f = fixture(), outer = deferred(); let nesting = false;
    f.emitter.on('incoming', async () => {
        if (nesting) return;
        nesting = true; await f.emitter.emit('incoming', 0); await outer.promise; f.messages[0].mes = 'Outer final';
    });
    const emitted = f.emitter.emit('incoming', 0); await flush(); await f.time.tick(900);
    assert.equal(f.calls.length, 0); outer.resolve(); await emitted; await flush(); await f.time.tick(300);
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].text, 'Outer final');
});
await test('overlapping same-message dispatches coalesce after both finish', async () => {
    const f = fixture(), a = deferred(), b = deferred(); let n = 0;
    f.emitter.on('incoming', () => ++n === 1 ? a.promise : b.promise);
    const pa = f.emitter.emit('incoming', 0), pb = f.emitter.emit('incoming', 0);
    b.resolve(); await pb; await flush(); await f.time.tick(500); assert.equal(f.calls.length, 0);
    a.resolve(); await pa; await flush(); await f.time.tick(300); assert.equal(f.calls.length, 1);
});
await test('other messages need not wait for an unrelated pending dispatch', async () => {
    const f = fixture(2), a = deferred();
    f.emitter.on('incoming', id => id === 0 ? a.promise : undefined);
    const pa = f.emitter.emit('incoming', 0); await f.emitter.emit('incoming', 1); await flush(); await f.time.tick(300);
    assert.deepEqual(f.calls.map(x => x.id), [1]); a.resolve(); await pa; await flush(); await f.time.tick(300);
    assert.deepEqual(f.calls.map(x => x.id), [1, 0]);
});
for (const kind of ['chat-away-back', 'swipe-away-back', 'deleted', 'replaced', 'disabled', 'stopped']) {
    await test(`pending render is discarded after ${kind}`, async () => {
        const f = fixture(), late = deferred(); f.emitter.on('incoming', () => late.promise);
        const emitted = f.emitter.emit('incoming', 0); await flush();
        if (kind === 'chat-away-back') { f.guards.chatChanged(); f.guards.chatChanged(); }
        if (kind === 'swipe-away-back') { f.swipe(0); f.swipe(0); }
        if (kind === 'deleted') f.context.chat = [];
        if (kind === 'replaced') f.context.chat = [{ ...f.messages[0] }];
        if (kind === 'disabled') f.settings.auto_mode = 'none';
        if (kind === 'stopped') f.api.stop();
        late.resolve(); await emitted; await flush(); await f.time.tick(300); assert.equal(f.calls.length, 0);
    });
}
await test('turning auto mode on during a render does not create a retroactive request', async () => {
    const f = fixture(), late = deferred(); f.settings.auto_mode = 'none'; f.emitter.on('incoming', () => late.promise);
    const emitted = f.emitter.emit('incoming', 0); f.settings.auto_mode = 'all'; late.resolve(); await emitted;
    await flush(); await f.time.tick(300); assert.equal(f.calls.length, 0);
});
for (const kind of ['edit', 'display', 'swipe', 'chat']) {
    await test(`strict queue guard still cancels a later ${kind} change`, async () => {
        const f = fixture(); await f.emitter.emit('incoming', 0); await flush();
        if (kind === 'edit') f.guards.messageChanged(0);
        if (kind === 'display') f.messages[0].extra.display_text = 'User edited display';
        if (kind === 'swipe') f.swipe(0);
        if (kind === 'chat') f.changeChat();
        await f.time.tick(300); assert.equal(f.calls.length, 0);
    });
}
await test('throttle wait rechecks chat before executing the next queued id', async () => {
    const f = fixture(2); f.settings.throttle_delay = 500;
    f.api.incoming(0); f.api.incoming(1); await f.time.tick(300); assert.equal(f.calls.length, 1);
    f.changeChat(); await f.time.tick(500); assert.equal(f.calls.length, 1);
});
await test('throttle wait resolves a moved target to its new index', async () => {
    const f = fixture(2); f.settings.throttle_delay = 500; const target = f.messages[1];
    f.api.incoming(0); f.api.incoming(1); await f.time.tick(300);
    f.context.chat.shift(); await f.time.tick(500);
    assert.equal(f.calls.length, 2); assert.equal(f.calls[1].id, 0); assert.equal(f.calls[1].message, target);
});
await test('reinstall stops the previous completion observer without duplicate work', async () => {
    const f = fixture(); f.api.install(); f.api.install();
    await f.emitter.emit('incoming', 0); await flush(); await f.time.tick(300); assert.equal(f.calls.length, 1);
});
await test('host return identity, receiver and arguments remain exact; unrelated events are untouched', async () => {
    const calls = [], done = deferred(), emitter = { emit(...args) { calls.push({ self: this, args }); return done.promise; } };
    const original = emitter.emit; let completed = 0;
    const stop = observeEventCompletion(emitter, type => type === 'render' ? () => completed++ : null);
    const value = emitter.emit('render', 4, 'swipe'); assert.equal(value, done.promise);
    assert.equal(calls[0].self, emitter); assert.deepEqual(calls[0].args, ['render', 4, 'swipe']);
    assert.equal(emitter.emit('other', 'data'), done.promise);
    const other = {}; assert.equal(emitter.emit.call(other, 'render', 5), done.promise); assert.equal(calls[2].self, other);
    done.resolve(7); assert.equal(await value, 7); await flush(); assert.equal(completed, 1);
    stop(); assert.equal(emitter.emit, original);
});
await test('host rejection and synchronous throw propagate unchanged and cannot start work', async () => {
    const error = Error('synthetic host error'), statuses = [], emitter = { emit() { return Promise.reject(error); } };
    const stop = observeEventCompletion(emitter, () => success => statuses.push(success));
    await assert.rejects(emitter.emit('render'), candidate => candidate === error); await flush();
    assert.deepEqual(statuses, [false]); stop();
    emitter.emit = () => { throw error; };
    const stopSync = observeEventCompletion(emitter, () => success => statuses.push(success));
    assert.throws(() => emitter.emit('render'), candidate => candidate === error);
    assert.deepEqual(statuses, [false, false]); stopSync();
});
await test('observer failure is isolated from host return values and rejection handling', async () => {
    const reports = [], emitter = { emit: () => 42 };
    let stop = observeEventCompletion(emitter, () => { throw Error('capture failed'); }, e => reports.push(e.message));
    assert.equal(emitter.emit('render'), 42); stop();
    stop = observeEventCompletion(emitter, () => () => { throw Error('completion failed'); }, e => reports.push(e.message));
    assert.equal(emitter.emit('render'), 42); await flush(); stop();
    assert.deepEqual(reports, ['capture failed', 'completion failed']);
});
await test('cleanup restores inherited emit; later wrappers are retained and pending completion is inert', async () => {
    const done = deferred(), prototype = { emit() { return done.promise; } }, emitter = Object.create(prototype);
    let completed = 0; const stop = observeEventCompletion(emitter, () => () => completed++);
    assert.equal(Object.hasOwn(emitter, 'emit'), true); stop(); assert.equal(Object.hasOwn(emitter, 'emit'), false);
    const stop2 = observeEventCompletion(emitter, () => () => completed++), wrapped = emitter.emit;
    const outer = function (...args) { return wrapped.apply(this, args); }; emitter.emit = outer;
    const emitted = emitter.emit('render'); stop2(); stop2(); assert.equal(emitter.emit, outer);
    done.resolve(); await emitted; await flush(); assert.equal(completed, 0);
});
await test('legacy strict active-translation guard still rejects edits even when text is unchanged', async () => {
    const f = fixture(), g = f.guards.capture(f.messages[0]); f.guards.messageChanged(0);
    assert.equal(g.valid(), false); assert.throws(() => g.assert(), error => error.cancelled === true);
});
console.log(`${passed} translator render-completion checks passed`);
