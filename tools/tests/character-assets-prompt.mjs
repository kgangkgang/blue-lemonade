import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const folder = path.join(root, 'src/addons/assets');
let moduleId = 0;
const bindings = globalThis.__assetPromptTest = {};
async function load(name, imports = {}) {
    const id = ++moduleId;
    bindings[id] = imports;
    const source = (await fs.readFile(path.join(folder, name), 'utf8')).replace(/^import .*;\r?\n/gm, '');
    const prelude = `const {${Object.keys(imports).join(',')}} = globalThis.__assetPromptTest[${id}];\n`;
    return import('data:text/javascript;base64,' + Buffer.from(prelude + source).toString('base64'));
}
const presets = await import(pathToFileURL(path.join(folder, 'presets.js')));
const names = await import(pathToFileURL(path.join(folder, 'names.js')));
const { addonsEnabled } = await import(pathToFileURL(path.join(root, 'src/usage-mode.js')));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
let groups = 0;
function pass(label) { groups++; console.log(`PASS ${label}`); }

async function fixture(initial = {}) {
    const ext = { salty: { enabled: true, usageMode: 'both', addons: { assets: true } }, ...initial };
    const context = { characters: [{ avatar: 'A.png' }, { avatar: 'B.png' }], characterId: 0, groupId: null, chatId: 'a-chat', chat: [], extensionSettings: ext };
    let saves = 0, busy = false, stopped = 0;
    context.stopGeneration = () => { stopped++; void eventSource.emit('GENERATION_STOPPED'); };
    const state = await load('state.js', { extension_settings: ext, getContext: () => context, saveSettingsDebounced: () => saves++ });
    state.initSettings();
    const requests = [], responses = new Map([['A', ['smile.png', 'hidden.png']], ['B', ['moon.png']]]), queues = new Map();
    const fetch = async url => {
        const key = new URL(url, 'https://fixture.invalid').searchParams.get('name');
        requests.push(key);
        const queued = queues.get(key)?.shift();
        const files = queued ? await queued.promise : responses.get(key) ?? [];
        return { ok: true, json: async () => files.map(file => ({ path: `/characters/${key}/${file}` })) };
    };
    const assets = await load('assets.js', { fetch, getRequestHeaders: () => ({}), formatKeywordList: names.formatKeywordList });
    const store = await load('store.js', { ...state, ...assets, ...presets, setIndex: () => {}, clearIndex: () => {} });
    const listeners = new Map();
    const event_types = Object.fromEntries(['GENERATION_AFTER_COMMANDS', 'CHAT_CHANGED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'SETTINGS_UPDATED'].map(key => [key, key]));
    const eventSource = {
        on(event, fn) { const list = listeners.get(event) ?? []; list.push(fn); listeners.set(event, list); },
        async emit(event, ...args) { for (const fn of [...listeners.get(event) ?? []]) { try { await fn(...args); } catch {} } },
    };
    const slots = new Map(), history = [];
    const timers = new Map(); let timerId = 0;
    const prompt = await load('prompt.js', {
        ...state, ...store, addonsEnabled, getContext: () => context, eventSource, event_types,
        extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 },
        isGenerating: () => busy, setSendButtonState: value => { busy = value; },
        setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
        setExtensionPrompt(key, value, position, depth, scan, role) { const entry = { key, value, position, depth, scan, role }; slots.set(key, entry); history.push(entry); },
    });
    prompt.setupPrompt();
    const slot = () => slots.get('blue_lemonade_character_assets');
    const waitFor = key => { const item = deferred(); const queue = queues.get(key) ?? []; queue.push(item); queues.set(key, queue); return item; };
    return { ext, context, state, store, prompt, requests, responses, slots, history, slot, waitFor, eventSource, event_types, timers,
        get saves() { return saves; }, get stopped() { return stopped; }, get busy() { return busy; }, set busy(value) { busy = value; } };
}

{
    const f = await fixture({ 'character-assets': { imagePrompt: 'Custom {{img_keywords_grouped}}', renderer: { enabled: false, randomAsset: false }, characterAssets: { A: { disabledAssets: ['hidden.png'] } } } });
    const s = f.state.settings();
    assert.equal(s.promptEnabled, true); assert.equal(s.promptPlacement, 'auto');
    assert.equal(s.prompt, 'Custom {{img_keywords_grouped}}'); assert.equal(s.renderEnabled, false); assert.equal(s.randomGroups, false);
    assert.deepEqual(s.disabled.A, ['hidden.png']);
    s.promptEnabled = false; s.promptPlacement = 'manual'; f.state.initSettings();
    assert.equal(s.promptEnabled, false); assert.equal(s.promptPlacement, 'manual');
    pass('new prompt defaults preserve custom rules, legacy picture choices and explicit saved switches');
}
{
    const f = await fixture(); await f.store.reload();
    assert.equal(f.slot().position, 1); assert.equal(f.slot().depth, 1); assert.equal(f.slot().role, 0); assert.equal(f.slot().scan, false);
    assert.match(f.slot().value, /smile\.png/); assert.equal(f.prompt.manualPrompt(), '');
    for (const type of ['normal', 'swipe', 'regenerate', 'continue', undefined]) await f.prompt.preparePrompt(type, {}, false);
    assert.equal(f.requests.length, 1); assert.equal(f.slots.size, 1);
    assert.equal((f.slot().value.match(/### Image Tags/g) ?? []).length, 1);
    pass('automatic rules occupy one slot and repeated reply types reuse the prepared image list');
}
{
    const f = await fixture(); await f.store.reload(); const s = f.state.settings();
    s.promptPlacement = 'manual'; f.prompt.syncPrompt();
    assert.equal(f.slot().value, ''); assert.match(f.prompt.manualPrompt(), /smile\.png/); assert.equal(f.prompt.promptStatus().reason, 'manual');
    s.promptEnabled = false; f.prompt.syncPrompt();
    assert.equal(f.slot().value, ''); assert.equal(f.prompt.manualPrompt(), ''); assert.equal(f.prompt.promptStatus().reason, 'off');
    assert.match(f.store.runtime.keywords, /smile\.png/, 'manual keyword lists remain available for existing custom templates');
    s.promptPlacement = 'auto'; s.promptEnabled = true; s.renderEnabled = false; f.prompt.syncPrompt();
    assert.match(f.slot().value, /smile\.png/, 'rendering and sending rules are independent');
    pass('master OFF clears automatic and manual rules; placement is exclusive and rendering stays independent');
}
{
    const f = await fixture(); await f.store.reload();
    for (const type of ['quiet', 'impersonate']) {
        await f.eventSource.emit('GENERATION_AFTER_COMMANDS', type, {}, false);
        assert.equal(f.slot().value, '');
        f.state.settings().promptPlacement = 'manual'; f.prompt.syncPrompt(); assert.equal(f.prompt.manualPrompt(), '');
        await f.prompt.preparePrompt('normal', {}, true); assert.equal(f.prompt.manualPrompt(), '', 'dry preview cannot overwrite a real auxiliary generation');
        await f.eventSource.emit('GENERATION_ENDED'); assert.match(f.prompt.manualPrompt(), /smile\.png/);
        f.state.settings().promptPlacement = 'auto';
    }
    await f.prompt.preparePrompt('normal', {}, false); assert.match(f.slot().value, /smile\.png/);
    const before = f.history.length; await f.prompt.preparePrompt('quiet', {}, true);
    assert.equal(f.history.length, before); assert.equal(f.requests.length, 1);
    pass('quiet and impersonation omit both paths; dry runs neither fetch nor mutate the active generation');
}
{
    const f = await fixture(); const slow = f.waitFor('A');
    const boot = f.store.reload(); let completed = false;
    const generation = f.eventSource.emit('GENERATION_AFTER_COMMANDS', 'normal', {}, false).then(() => { completed = true; });
    await tick(); assert.equal(f.requests.length, 1); assert.equal(completed, false); assert.equal(f.slot().value, '');
    await f.prompt.preparePrompt('normal', {}, true); assert.equal(f.requests.length, 1);
    slow.resolve(['fresh.png']); await Promise.all([boot, generation]);
    assert.equal(completed, true); assert.match(f.slot().value, /fresh\.png/);
    pass('generation awaits the boot load without a duplicate request; dry-run preview starts no request');
}
{
    const f = await fixture(); const old = f.waitFor('A'), fresh = f.waitFor('A');
    const first = f.store.reload(); let ready = false;
    const generation = f.prompt.preparePrompt('normal', {}, false).then(() => { ready = true; });
    const second = f.store.reload(); old.resolve(['outdated.png']); await first; await tick();
    assert.equal(ready, false); assert.equal(f.slot().value, '');
    fresh.resolve(['latest.png']); await Promise.all([second, generation]);
    assert.match(f.slot().value, /latest\.png/); assert.doesNotMatch(f.slot().value, /outdated/); assert.equal(f.requests.length, 2);
    pass('a superseded same-folder load cannot finish generation before the latest refresh');
}
{
    const f = await fixture(); const slowA = f.waitFor('A');
    const loadA = f.store.reload(), generationA = f.prompt.preparePrompt('normal', {}, false);
    f.context.characterId = 1; f.context.chat = []; f.context.chatId = 'b-chat';
    await f.eventSource.emit('CHAT_CHANGED');
    assert.match(f.slot().value, /moon\.png/); assert.doesNotMatch(f.slot().value, /smile/);
    slowA.resolve(['wrong-card.png']); await Promise.all([loadA, generationA]);
    assert.equal(f.store.runtime.folder, 'B'); assert.match(f.slot().value, /moon\.png/); assert.doesNotMatch(f.slot().value, /wrong-card/);
    pass('a late previous-character result cannot leak image names into the next chat');
}
{
    const f = await fixture(); const first = f.waitFor('A'), second = f.waitFor('A');
    const load1 = f.store.reload(), gen1 = f.prompt.preparePrompt('normal', {}, false);
    f.context.chat = []; f.context.chatId = 'a-new-chat'; const switched = f.eventSource.emit('CHAT_CHANGED');
    first.resolve(['old-chat-list.png']); await load1; await tick(); assert.equal(f.slot().value, '');
    second.resolve(['new-chat-list.png']); await Promise.all([switched, gen1]);
    assert.match(f.slot().value, /new-chat-list/); assert.doesNotMatch(f.slot().value, /old-chat-list/);
    pass('same-character chat replacement supersedes the previous generation and pending refresh');
}
{
    const f = await fixture(); const slow = f.waitFor('A');
    const generation = f.prompt.preparePrompt('normal', {}, false); await tick();
    f.state.settings().promptEnabled = false; f.prompt.syncPrompt();
    slow.resolve(['arrives-after-off.png']); await generation; await f.store.ensureLoaded();
    assert.equal(f.slot().value, ''); assert.equal(f.prompt.manualPrompt(), '');
    f.state.settings().promptEnabled = true; f.prompt.syncPrompt(); assert.match(f.slot().value, /arrives-after-off/);
    assert.equal(f.requests.length, 1);
    pass('OFF during loading stays OFF when the response arrives; re-enabling reuses the prepared list');
}
{
    const f = await fixture(); await f.store.reload();
    f.context.groupId = 'synthetic-group'; await f.eventSource.emit('CHAT_CHANGED'); await f.prompt.preparePrompt('normal', {}, false);
    assert.equal(f.slot().value, ''); assert.equal(f.prompt.promptStatus().reason, 'group'); assert.equal(f.store.runtime.folder, '');
    f.context.groupId = null; f.context.characterId = undefined; await f.eventSource.emit('CHAT_CHANGED');
    assert.equal(f.prompt.promptStatus().reason, 'no-character'); assert.equal(f.slot().value, ''); assert.equal(f.requests.length, 1);
    pass('groups and absent characters clear the slot and never reuse the last solo character');
}
{
    const f = await fixture(); await f.store.reload();
    f.state.settings().disabled.A = ['smile.png', 'hidden.png']; f.store.recompute();
    assert.equal(f.slot().value, ''); assert.equal(f.prompt.promptStatus().reason, 'empty');
    f.state.settings().disabled.A = []; f.store.recompute(); assert.match(f.slot().value, /smile/);
    f.responses.set('A', []); await f.store.reload(); assert.equal(f.slot().value, '');
    f.state.settings().promptPlacement = 'manual'; assert.equal(f.prompt.manualPrompt(), '');
    pass('all images disabled and empty folders send no rules; changing picture switches updates immediately');
}
{
    const f = await fixture(); await f.store.reload();
    f.ext.salty.addons.assets = false; await f.eventSource.emit('SETTINGS_UPDATED'); assert.equal(f.slot().value, '');
    f.state.settings().promptPlacement = 'manual'; assert.equal(f.prompt.manualPrompt(), '');
    f.ext.salty.addons.assets = true; f.ext.salty.usageMode = 'theme'; f.prompt.syncPrompt(); assert.equal(f.prompt.manualPrompt(), '');
    f.ext.salty.usageMode = 'extensions'; f.ext.salty.enabled = false; f.prompt.syncPrompt(); assert.equal(f.prompt.manualPrompt(), '');
    f.ext.salty.enabled = true; f.prompt.syncPrompt(); assert.match(f.prompt.manualPrompt(), /smile/);
    pass('disabling the addon, the extension usage mode or the theme master prevents prompt delivery');
}
{
    const f = await fixture(); await f.store.reload();
    f.state.settings().prompt = 'Only {{img_keywords_autogen}} in {{charkey}}'; f.prompt.syncPrompt();
    assert.match(f.slot().value, /^Only .* in A$/); assert.doesNotMatch(f.slot().value, /img_keywords|charkey/);
    f.state.settings().prompt = '  '; f.prompt.syncPrompt(); assert.equal(f.slot().value, '');
    assert.equal(f.prompt.promptStatus().reason, 'empty-rules');
    pass('custom rules expand existing list/folder macros and an empty instruction sends nothing');
}
{
    const f = await fixture(); await f.store.reload();
    f.state.settings().disabled.A = ['hidden.png']; f.store.recompute();
    const failing = f.waitFor('A'), consoleError = console.error; console.error = () => {};
    try { const job = f.store.reload(); failing.reject(new Error('synthetic offline')); await job; }
    finally { console.error = consoleError; }
    assert.match(f.slot().value, /smile/); assert.doesNotMatch(f.slot().value, /hidden/); assert.deepEqual(f.state.settings().disabled.A, ['hidden.png']);
    await f.prompt.preparePrompt('normal', {}, false); assert.equal(f.requests.length, 2);
    pass('failed same-folder refresh preserves the last valid list and disabled images without repeated generation fetches');
}
{
    const f = await fixture(); const lateA = f.waitFor('A');
    const oldJob = f.store.reload(); f.context.characterId = 1; await f.store.reload();
    lateA.resolve(['old-leak.png']); await oldJob;
    f.context.characterId = 0; const failing = f.waitFor('A'), consoleError = console.error; console.error = () => {};
    try { const job = f.store.reload(); failing.reject(new Error('synthetic offline')); await job; }
    finally { console.error = consoleError; }
    assert.equal(f.store.runtime.keywords, ''); assert.equal(f.slot().value, '');
    pass('a discarded response cannot poison last-good fallback after changing characters');
}
{
    const f = await fixture(); const old = f.waitFor('A'), latest = f.waitFor('A');
    let finished = false;
    const generation = f.prompt.preparePrompt('normal', {}, false).then(() => { finished = true; });
    const refresh = f.store.reload(); latest.resolve(['newest-first.png']); await refresh; await tick();
    assert.equal(finished, true, 'generation switches its wait to the latest request even when the original fetch is unresolved');
    assert.match(f.slot().value, /newest-first/);
    old.resolve(['old-last.png']); await generation; await tick(); assert.doesNotMatch(f.slot().value, /old-last/);
    pass('latest refresh can unblock generation before an obsolete network request finishes');
}
{
    for (const action of ['stop', 'off', 'abort', 'chat']) {
        const f = await fixture(); const slow = f.waitFor('A'), controller = new AbortController(); let finished = false;
        const generation = f.prompt.preparePrompt('normal', { signal: controller.signal }, false).then(() => { finished = true; });
        await tick(); assert.equal(finished, false);
        if (action === 'stop') await f.eventSource.emit('GENERATION_STOPPED');
        if (action === 'off') { f.state.settings().promptEnabled = false; f.prompt.syncPrompt(); }
        if (action === 'abort') controller.abort();
        if (action === 'chat') { f.context.characterId = 1; f.context.chat = []; f.context.chatId = 'next'; await f.eventSource.emit('CHAT_CHANGED'); }
        await tick(); assert.equal(finished, true, `${action} releases generation without waiting for fetch`);
        if (action === 'abort' || action === 'chat') assert.equal(f.stopped, 1, `${action} aborts ST generation, not just the prompt wait`);
        if (action === 'off') assert.equal(f.stopped, 0, 'OFF intentionally continues without image rules');
        assert.equal(f.busy, false, 'the temporary send-state lock is released');
        slow.resolve(['slow.png']); await generation; await tick();
        if (action === 'off') assert.equal(f.slot().value, '');
        if (action === 'chat') { assert.match(f.slot().value, /moon/); assert.doesNotMatch(f.slot().value, /slow/); }
    }
    const f = await fixture(), controller = new AbortController(); controller.abort();
    await f.prompt.preparePrompt('normal', { signal: controller.signal }, false); assert.equal(f.requests.length, 0);
    pass('stop, OFF, abort and chat changes release generation preparation while the shared loader finishes separately');
}
{
    const f = await fixture();
    f.state.settings().presets.A = [{ id: 'base', name: '', enabled: true }, { id: 'season', name: 'Season', enabled: false }];
    f.state.settings().presets.B = [{ id: 'base', name: '', enabled: true }];
    f.state.settings().links.A = [{ owner: 'B', presetId: 'base', enabled: true }];
    f.responses.set('A/Season', ['snow.png']); await f.store.reload();
    assert.match(f.slot().value, /smile/); assert.match(f.slot().value, /moon/); assert.doesNotMatch(f.slot().value, /snow/);
    f.state.settings().presets.A[1].enabled = true; f.state.settings().links.A[0].enabled = false; f.store.recompute();
    assert.match(f.slot().value, /snow/); assert.doesNotMatch(f.slot().value, /moon/);
    await f.prompt.preparePrompt('normal', {}, false); assert.equal(f.requests.length, 3);
    pass('current enabled presets and linked folders update the automatic list without extra generation reads');
}
{
    const f = await fixture(), slow = f.waitFor('A');
    const generation = f.eventSource.emit('GENERATION_AFTER_COMMANDS', 'normal', {}, false);
    await tick(); assert.equal(f.busy, true);
    // ST selectCharacterById and the chat menu both refuse to switch while is_send_press is true.
    if (!f.busy) { f.context.characterId = 1; f.context.chat = []; f.context.chatId = 'b-chat'; }
    assert.equal(f.context.chatId, 'a-chat');
    assert.equal(f.timers.size, 1); const timer = [...f.timers.values()][0]; assert.equal(timer.delay, 8000);
    timer.fn(); await generation;
    assert.equal(f.busy, false); assert.equal(f.timers.size, 0); assert.equal(f.slot().value, ''); assert.equal(f.stopped, 0);
    slow.resolve(['after-timeout.png']); await f.store.ensureLoaded(); assert.match(f.slot().value, /after-timeout/);
    pass('normal UI chat switching is locked during preparation and a stalled list cannot hold the lock indefinitely');
}
{
    const f = await fixture(), slow = f.waitFor('A'); f.busy = true;
    const generation = f.prompt.preparePrompt('swipe', {}, false); slow.resolve(['ready.png']); await generation;
    assert.equal(f.busy, true, 'an existing ST send state belongs to ST and must be preserved');
    const g = await fixture(), later = g.waitFor('A');
    const first = g.prompt.preparePrompt('normal', {}, false), second = g.prompt.preparePrompt('normal', {}, false);
    await first; assert.equal(g.busy, true, 'the next preparation still owns the shared lock');
    later.resolve(['ready.png']); await second; assert.equal(g.busy, false); assert.equal(g.timers.size, 0);
    pass('pre-existing ST send state and overlapping preparation lock ownership are preserved');
}
delete globalThis.__assetPromptTest;
console.log(`PASS Character Assets prompt: ${groups} semantic groups`);
