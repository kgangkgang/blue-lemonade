// 8.2.7 새 답 자동 번역은 같은 원문의 메시지 번역 캐시(IndexedDB)를 한 번만 읽는다 — 진짜 translateMessage 를 index.js 에서 잘라 가짜 환경에서 (요청 · DOM · 저장 0)
//   예전엔 시작 알림을 고르려고 한 번, 번역하려고 또 한 번 열어 읽었다 (결과는 같음). 캐시에 있으면 요청 없이 그 번역을 그대로 붙인다
//   node tools/tests/translator-cache-read-once.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const { createGuards } = await import(pathToFileURL(path.join(dir, 'translation-guard.js')));
function cut(name, prefix = 'function') {
    const start = source.indexOf(`\n${prefix} ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 2000) { const at = Date.now(); while (!fn()) { if (Date.now() - at > ms) throw Error('timed out'); await sleep(5); } }

function fixture() {
    const context = { chat: [{ mes: 'Synthetic answer one.', name: 'Bot', is_user: false, swipe_id: 0, extra: {} }], chatId: 'chat-a', characterId: 1, groupId: null, name1: 'You',
        saveChat: async () => { context.saves++; }, saves: 0 };
    const guards = createGuards(() => context);
    const settings = { auto_mode: 'all' };
    const requests = [], toasts = [], reads = [], cacheRows = new Map();
    let onRequest = null;
    const env = {
        getContext: () => context, guards, extensionSettings: settings, incomingTypes: ['all', 'ai'], outgoingTypes: ['all', 'user'],
        shouldTranslate: types => types.includes(settings.auto_mode),
        translationInProgress: {}, autoRetries: new WeakMap(), afterWorkEnds: new WeakMap(), shownTranslations: new WeakMap(),
        toastr: { info: (m, t) => toasts.push({ m, t }), warning() {}, error: (m) => toasts.push({ m, error: true }) },
        console: { warn() {}, error() {}, debug() {}, info() {}, log() {} },
        inProgressNotice: () => 'busy', picturesOnlyChanged: () => false, substituteParams: t => String(t ?? ''),
        hideStaleTranslation: async () => false, readCachedTranslation: async (t) => { reads.push(t); return cacheRows.get(t) ?? null; }, MARK_TAIL: '⁣', originalHashOf: t => 'h:' + t,
        looksLikeRefusal: () => false, matchesDisplayCardStructure: () => true,
        progressBadge: () => ({ update() {}, remove() {} }), translationPreview: () => ({ show() {}, stop() {}, done() {}, revert() {} }), startNotice: () => '',
        translate: async (text, options) => { requests.push(text); return onRequest ? onRequest(text, options) : 'KO:' + text; },
        dropStrayWords: t => t, storeTranslationQuietly: async () => {}, tidyGlossaryOutput: (_s, t) => t, restoreDialogueBrackets: (_s, t) => t, swapPictures: t => t,
        processTranslationText: (_o, t) => t, markTranslatedOriginal: (m, o) => { m.extra.original_text_hash = 'h:' + o; }, rememberTranslation() {},
        refreshMessageBlock() {}, eventSource: { emit() {} }, emitTranslationUIUpdate() {}, $: () => ({ find: () => ({ data() {} }) }), syncMesToSwipe() {},
        publishArchiveReady() {}, afterGeneration: cb => setTimeout(cb, 10), skipCutAutoTranslate: () => false, checkView: { schedule() {} },
        isGeneratingSwipe: () => false, cutByWatchdog: () => false, autoSkipReason: () => null,
        Symbol, Object, Promise, Number, String, Date, JSON, Math, Error, setTimeout, clearTimeout, globalThis,
    };
    const code = [cut('settleGuard', 'async function'), cut('translateMessage', 'async function'),
        ...['beginTranslation', 'endTranslation', 'isTranslationInProgress', 'translateIncomingMessage', 'translateOutgoingMessage'].map(n => cut(n))].join('\n');
    const api = new Function('env', `with (env) { ${code}\n return { translateMessage }; }`)(env);
    return { context, guards, settings, requests, toasts, reads, cacheRows, api, setRequest(fn) { onRequest = fn; } };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

await test('a new answer: one cache read, then one request', async () => {
    const f = fixture(), m = f.context.chat[0];
    await f.api.translateMessage(0, false, 'auto');
    assert.deepEqual(f.reads, ['Synthetic answer one.'], 'read once');
    assert.equal(f.requests.length, 1); assert.equal(m.extra.display_text, 'KO:Synthetic answer one.');
});
await test('a cached answer: one read, no request, same translation attached', async () => {
    const f = fixture(), m = f.context.chat[0];
    f.cacheRows.set('Synthetic answer one.', 'CACHED');
    await f.api.translateMessage(0, false, 'auto');
    assert.equal(f.reads.length, 1); assert.equal(f.requests.length, 0); assert.equal(m.extra.display_text, 'CACHED');
});
await test('an old message without hash whose text has no cached translation: one read', async () => {
    const f = fixture(), m = f.context.chat[0];
    m.extra.display_text = 'OLD';
    await f.api.translateMessage(0, false, 'auto');
    assert.equal(f.reads.length, 1); assert.equal(f.requests.length, 1); assert.equal(m.extra.display_text, 'KO:Synthetic answer one.');
});
await test('manual translation still reads the cache (unchanged)', async () => {
    const f = fixture();
    await f.api.translateMessage(0, true, 'manual');
    assert.equal(f.reads.length, 1); assert.equal(f.requests.length, 1);
});
console.log(`translator-cache-read-once: ${passed} passed, 0 failed`);
