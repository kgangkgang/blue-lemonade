// 8.2.7 처음 번역하던 중에 답을 고치면(편집 ✓ → MESSAGE_EDITED) 고친 글로 다시 번역한다 — 진짜 translateMessage 를 index.js 에서 잘라 가짜 환경에서 (요청 · DOM · 저장 0)
//   ① 자동 번역 중 편집 → 옛 번역은 멈추고, 고친 글로 한 번 번역해 붙인다 (예전엔 조용히 끝나 끝내 번역되지 않았다)
//   ② 자동 번역 모드가 꺼졌으면 다시 번역하지 않는다 · 스와이프로 멈춘 것은 전처럼 다시 걸지 않는다 (새 스와이프는 그려질 때 따로 번역)
//   node tools/tests/translator-edit-while-translating.mjs [테마 루트]
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
    const requests = [], toasts = [];
    let onRequest = null;
    const env = {
        getContext: () => context, guards, extensionSettings: settings, incomingTypes: ['all', 'ai'], outgoingTypes: ['all', 'user'],
        shouldTranslate: types => types.includes(settings.auto_mode),
        translationInProgress: {}, autoRetries: new WeakMap(), afterWorkEnds: new WeakMap(), shownTranslations: new WeakMap(),
        toastr: { info: (m, t) => toasts.push({ m, t }), warning() {}, error: (m) => toasts.push({ m, error: true }) },
        console: { warn() {}, error() {}, debug() {}, info() {}, log() {} },
        inProgressNotice: () => 'busy', picturesOnlyChanged: () => false, substituteParams: t => String(t ?? ''),
        hideStaleTranslation: async () => false, readCachedTranslation: async () => null, MARK_TAIL: '⁣', originalHashOf: t => 'h:' + t,
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
    return { context, guards, settings, requests, toasts, api, setRequest(fn) { onRequest = fn; } };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

await test('editing the answer during its first auto translation translates the edited text once', async () => {
    const f = fixture(), m = f.context.chat[0];
    let release;
    f.setRequest((text, options) => text.includes('one') ? new Promise((resolve, reject) => { release = () => { try { options.assertValid(); resolve('KO:' + text); } catch (e) { reject(e); } }; }) : 'KO:' + text);
    const run = f.api.translateMessage(0, false, 'auto');
    await until(() => release);
    m.mes = 'Synthetic answer two.'; f.guards.messageChanged(0, 'edited');   // 편집 ✓ (MESSAGE_EDITED makeFirst)
    release(); await run;
    await until(() => m.extra.display_text, 2000);
    assert.deepEqual(f.requests, ['Synthetic answer one.', 'Synthetic answer two.']);
    assert.equal(m.extra.display_text, 'KO:Synthetic answer two.');
    await sleep(60); assert.equal(f.requests.length, 2, 'no further requests');
});
await test('no retranslation when auto mode is off, and a swipe still does not re-run the old target', async () => {
    let f = fixture(), m = f.context.chat[0], release;
    f.setRequest((text, options) => new Promise((resolve, reject) => { release = () => { try { options.assertValid(); resolve('KO:' + text); } catch (e) { reject(e); } }; }));
    let run = f.api.translateMessage(0, false, 'auto'); await until(() => release);
    f.settings.auto_mode = 'none'; m.mes = 'Edited.'; f.guards.messageChanged(0, 'edited'); release(); await run; await sleep(60);
    assert.equal(f.requests.length, 1); assert.equal(m.extra.display_text, undefined);
    f = fixture(); m = f.context.chat[0]; release = null;
    f.setRequest((text, options) => new Promise((resolve, reject) => { release = () => { try { options.assertValid(); resolve('KO:' + text); } catch (e) { reject(e); } }; }));
    run = f.api.translateMessage(0, false, 'auto'); await until(() => release);
    m.swipe_id = 1; m.mes = 'Swiped.'; f.guards.messageChanged(0, 'swiped'); release(); await run; await sleep(60);
    assert.equal(f.requests.length, 1, 'swipe: the new swipe is translated by its own render');
});
console.log(`translator-edit-while-translating: ${passed} passed, 0 failed`);
