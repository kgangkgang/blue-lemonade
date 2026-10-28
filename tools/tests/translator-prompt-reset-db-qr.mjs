// 번역 3.1.6 — 프롬프트 편집 칸 「기본값으로」(prompt-reset.js) · 「입력창에 DB 관리 단추 두기」(db-tool-qr.js · index.js syncDbToolQr / prepareDbToolOnce).
//   가상 설정 · 가짜 Quick Reply API 로만 돌린다 (브라우저 · 실리태번 · 네트워크 없음).
//   node tools/tests/translator-prompt-reset-db-qr.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('src/addons/translator/index.js');
const html = read('src/addons/translator/index.html');
const R = await import(pathToFileURL(path.join(dir, 'prompt-reset.js')).href);
const Q = await import(pathToFileURL(path.join(dir, 'db-tool-qr.js')).href);

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}

// index.js 의 defaultSettings 에서 프롬프트 기본값을 그대로 읽는다 (시험이 기본 문장을 따로 들고 있지 않게)
function defaultsFromSource() {
    const start = source.indexOf('const defaultSettings = {');
    assert.ok(start >= 0, 'defaultSettings 를 못 찾음');
    let depth = 0, i = source.indexOf('{', start), end = -1, quote = null;
    for (; i < source.length; i++) {
        const c = source[i];
        if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '/' && source[i + 1] === '/') { i = source.indexOf('\n', i); continue; }
        if (c === '{') depth++;
        else if (c === '}' && --depth === 0) { end = i + 1; break; }
    }
    const body = source.slice(source.indexOf('{', start), end);
    const autoModeOptions = { NONE: 'none', ALL: 'all' };
    return new Function('autoModeOptions', `return (${body});`)(autoModeOptions);
}
const defaults = defaultsFromSource();

// ── 기본값으로 되돌리기 ──
await check('every non-custom option in the prompt picker can be reset, and each has a string default', () => {
    const options = [...html.matchAll(/<option value="(llm_[a-z_]+)">/g)].map(m => m[1]);
    assert.deepEqual(options, [...R.RESETTABLE_PROMPT_KEYS]);
    for (const key of R.RESETTABLE_PROMPT_KEYS) assert.equal(typeof defaults[key], 'string', key);
    assert.ok(R.canResetPrompt('llm_prompt_retranslate_paragraph', defaults));
    assert.ok(!R.canResetPrompt('1730000000000', defaults), 'a custom prompt id is not resettable');
    assert.ok(!R.canResetPrompt('llm_rule_prompt', defaults));
    assert.ok(!R.canResetPrompt('customPrompts', defaults));
});

await check('the button is hidden for custom prompts and disabled while the prompt already equals its default', () => {
    const key = 'llm_prompt_retranslate_paragraph';
    const same = { [key]: defaults[key] };
    assert.deepEqual(R.resetButtonState(key, { settings: same, defaults, editorText: defaults[key] }), { visible: true, enabled: false });
    assert.deepEqual(R.resetButtonState(key, { settings: same, defaults, editorText: `  ${defaults[key]}\n` }), { visible: true, enabled: false }, 'save trims, so whitespace alone is not a change');
    assert.deepEqual(R.resetButtonState(key, { settings: { [key]: 'Match the paragraph count.' }, defaults, editorText: 'Match the paragraph count.' }), { visible: true, enabled: true });
    assert.deepEqual(R.resetButtonState(key, { settings: same, defaults, editorText: 'typed but not saved yet' }), { visible: true, enabled: true }, 'unsaved edits also enable it');
    assert.deepEqual(R.resetButtonState('1730000000000', { settings: same, defaults, isCustom: true }), { visible: false, enabled: false });
});

await check('reset writes the default, keeps the previous saved text once, and undo restores it', () => {
    const key = 'llm_prompt_retranslate_paragraph';
    const settings = { [key]: 'Keep exactly as many paragraphs as the source.', llm_prompt_chat: 'Translate into Korean.' };
    const undo = R.resetPrompt(settings, key, defaults);
    assert.equal(settings[key], defaults[key]);
    assert.deepEqual(undo, { key, prev: 'Keep exactly as many paragraphs as the source.' });
    assert.equal(settings.llm_prompt_chat, 'Translate into Korean.', 'other prompts untouched');
    assert.equal(R.resetPrompt(settings, key, defaults), null, 'already default → nothing to do');
    assert.ok(R.undoPromptReset(settings, undo, defaults));
    assert.equal(settings[key], 'Keep exactly as many paragraphs as the source.');
});

await check('undo does not overwrite a prompt the user edited again after the reset', () => {
    const key = 'llm_prompt_send';
    const settings = { [key]: 'Old send prompt.' };
    const undo = R.resetPrompt(settings, key, defaults);
    settings[key] = 'Newer send prompt.';
    assert.equal(R.undoPromptReset(settings, undo, defaults), false);
    assert.equal(settings[key], 'Newer send prompt.');
});

await check('an emptied prompt (the community case) can be reset too', () => {
    const settings = { llm_prompt_retranslate_paragraph: '' };
    const undo = R.resetPrompt(settings, 'llm_prompt_retranslate_paragraph', defaults);
    assert.equal(settings.llm_prompt_retranslate_paragraph, defaults.llm_prompt_retranslate_paragraph);
    assert.equal(undo.prev, '');
});

await check('markup: reset button sits in the prompt row, same classes as its neighbours, FA rotate-left icon, hidden by default', () => {
    const row = html.slice(html.indexOf('<div class="prompt-select-container">'), html.indexOf('</div>', html.indexOf('<div class="prompt-select-container">')));
    const buttons = [...row.matchAll(/<button id="([^"]+)" class="([^"]+)"[^>]*>/g)].map(m => [m[1], m[2], m[0]]);
    assert.deepEqual(buttons.map(b => b[0]), ['prompt_save_button', 'addPromptBtn', 'deletePromptBtn', 'llm_prompt_reset_button']);
    for (const [, cls] of buttons) assert.equal(cls, 'menu_button small-button');
    const reset = buttons.at(-1)[2];
    assert.match(reset, /\shidden>/);
    assert.match(reset, /aria-label="기본값으로 되돌리기"/);
    assert.match(row, /llm_prompt_reset_button[\s\S]*?<i class="fa-solid fa-rotate-left"><\/i>/);
});

await check('wiring: reset asks first (theme Popup), saves, offers undo, and the picker swaps reset ↔ delete', () => {
    const body = source.slice(source.indexOf('    async resetSelectedPrompt() {'), source.indexOf('    async showAddPromptDialog() {'));
    assert.ok(body.includes('await ask('), 'confirm through the in-page popup');
    assert.ok(body.indexOf('await ask(') < body.indexOf('resetPrompt(extensionSettings'), 'ask before writing');
    assert.ok(body.includes('saveSettingsDebounced()'));
    assert.ok(body.includes('attachUndo(toast'));
    const buttons = source.slice(source.indexOf('    updatePromptButtons() {'), source.indexOf('    async resetSelectedPrompt() {'));
    assert.ok(buttons.includes("show(resetBtn, state.visible)") && buttons.includes("show(deleteBtn, !state.visible)"));
    assert.ok(buttons.includes("setProperty('display', 'none', 'important')"), 'hiding must beat the row rule (display … !important)');
    assert.ok(/loadPromptToEditor\(\) \{[\s\S]*?this\.updatePromptButtons\(\);\n    \}/.test(source), 'state refresh on every editor load');
    assert.ok(source.includes("$(document).off('input', '#llm_prompt_editor').on('input', '#llm_prompt_editor'"));
});

// ── 입력창 DB 관리 단추 ──
function fakeApi({ sets = {}, hide = true, del = true, list = true } = {}) {
    const calls = [];
    const store = Object.fromEntries(Object.entries(sets).map(([name, qrs]) => [name, qrs.map(q => ({ ...q }))]));
    const api = {
        calls, store,
        settings: { config: { setList: Object.keys(store).slice(0, 1).map(name => ({ set: { name }, isVisible: true })) }, chatConfig: { setList: Object.keys(store).slice(1).map(name => ({ set: { name }, isVisible: true })) } },
        getQrByLabel: (set, label) => store[set]?.find(q => q.label == label),
        createQuickReply: (set, label, props) => { calls.push(['create', set, label]); (store[set] ||= []).push({ label, ...props }); },
    };
    if (list) api.listSets = () => Object.keys(store);
    if (hide) api.updateQuickReply = (set, label, props) => { calls.push(['update', set, label, props]); Object.assign(api.getQrByLabel(set, label), props); };
    if (del) api.deleteQuickReply = (set, label) => { calls.push(['delete', set, label]); store[set] = store[set].filter(q => q.label != label); };
    return api;
}
const LABEL = Q.DB_QR_LABEL;

await check('off hides the DB QR in every set that has it and leaves other quick replies alone', () => {
    const api = fakeApi({ sets: { Main: [{ label: 'Hello' }, { label: LABEL, isHidden: false }], Chat: [{ label: LABEL, isHidden: false }], Empty: [{ label: 'Bye' }] } });
    const r = Q.applyDbQrVisibility(api, false);
    assert.deepEqual(r, { found: 2, hidden: 2, shown: 0, deleted: 0, failed: 0 });
    assert.equal(api.getQrByLabel('Main', LABEL).isHidden, true);
    assert.equal(api.getQrByLabel('Chat', LABEL).isHidden, true);
    assert.equal(api.getQrByLabel('Main', 'Hello').isHidden, undefined);
    assert.ok(!api.calls.some(c => c[0] === 'delete'), 'hide wins over delete when the API can hide');
    assert.deepEqual(Q.applyDbQrVisibility(api, false), { found: 2, hidden: 0, shown: 0, deleted: 0, failed: 0 }, 'idempotent');
});

await check('on shows hidden ones again; nothing found means the caller recreates it', () => {
    const api = fakeApi({ sets: { Main: [{ label: LABEL, isHidden: true }] } });
    assert.deepEqual(Q.applyDbQrVisibility(api, true), { found: 1, hidden: 0, shown: 1, deleted: 0, failed: 0 });
    assert.equal(api.getQrByLabel('Main', LABEL).isHidden, false);
    assert.equal(Q.applyDbQrVisibility(fakeApi({ sets: { Main: [] } }), true).found, 0);
});

await check('without isHidden support the QR is deleted instead; without listSets the global and chat set lists are searched', () => {
    const api = fakeApi({ sets: { Main: [{ label: LABEL }], Chat: [{ label: LABEL }] }, hide: false, list: false });
    assert.deepEqual(Q.dbQrSets(api), ['Main', 'Chat']);
    assert.deepEqual(Q.applyDbQrVisibility(api, false), { found: 2, hidden: 0, shown: 0, deleted: 2, failed: 0 });
    assert.equal(api.getQrByLabel('Main', LABEL), undefined);
    assert.deepEqual(Q.applyDbQrVisibility(null, false), { found: 0, hidden: 0, shown: 0, deleted: 0, failed: 0 });
});

// index.js 의 두 함수를 잘라 가짜 환경에서 돌린다
function slice(name) {
    const start = source.indexOf(`async function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n}\n', start) + 2);
}
function harness({ on, api, charExists = true }) {
    const toasts = [], events = [];
    const env = {
        extensionSettings: { db_tool_qr: on },
        window: { quickReplyApi: api, toastr: true },
        toastr: new Proxy({}, { get: (_, kind) => text => { toasts.push([kind, text]); } }),
        doesCharacterExist: () => charExists,
        ensureCharacterExists: async () => { events.push('char'); return true; },
        ensureQuickReplyExists: async (set, label) => { events.push(['qr', set]); api.createQuickReply(set, label, {}); return true; },
        getFirstActiveGlobalQuickReplySetName: () => { events.push('set'); return 'Main'; },
        getQuickReplyApi: () => api,
        applyDbQrVisibility: Q.applyDbQrVisibility, dbQrSets: Q.dbQrSets, DB_QR_LABEL: LABEL,
        console: { error() { }, warn() { } },
    };
    const code = `let dbToolSetupJob = null;\n${slice('syncDbToolQr')}\n${slice('prepareQrAndCharacterForDbManagement')}\n${slice('prepareDbToolOnce')}\nreturn { syncDbToolQr, prepareQrAndCharacterForDbManagement };`;
    const fns = new Function(...Object.keys(env), code)(...Object.values(env));
    return { ...fns, toasts, events, env };
}

await check('setup with the switch off prepares only the character and creates no QR', async () => {
    const api = fakeApi({ sets: { Main: [] } });
    const h = harness({ on: false, api, charExists: false });
    await h.prepareQrAndCharacterForDbManagement();
    assert.deepEqual(h.events, ['char']);
    assert.ok(!api.calls.some(c => c[0] === 'create'));
    assert.ok(h.toasts.some(([kind, text]) => kind === 'info' && text.includes('만들지 않았어요')), JSON.stringify(h.toasts));
});

await check('setup with the switch on (default) still creates the QR in the first active global set', async () => {
    const api = fakeApi({ sets: { Main: [] } });
    const h = harness({ on: true, api });
    await h.prepareQrAndCharacterForDbManagement();
    assert.deepEqual(h.events, ['set', ['qr', 'Main'], 'char']);
});

await check('switching off hides; switching back on shows it again, or recreates it when it was gone', async () => {
    const api = fakeApi({ sets: { Main: [{ label: LABEL, isHidden: false }] } });
    const h = harness({ on: false, api });
    await h.syncDbToolQr({ notify: true });
    assert.equal(api.getQrByLabel('Main', LABEL).isHidden, true);
    assert.ok(h.toasts.some(([kind, text]) => kind === 'success' && text.includes('숨겼어요')));
    h.env.extensionSettings.db_tool_qr = true;
    await h.syncDbToolQr({ notify: true });
    assert.equal(api.getQrByLabel('Main', LABEL).isHidden, false);
    assert.ok(!api.calls.some(c => c[0] === 'create'));
    const gone = fakeApi({ sets: { Main: [] } });
    const h2 = harness({ on: true, api: gone });
    await h2.syncDbToolQr({ notify: true });
    assert.ok(gone.calls.some(c => c[0] === 'create'), 'recreated');
    const boot = harness({ on: true, api: fakeApi({ sets: { Main: [] } }) });
    await boot.syncDbToolQr({ notify: false, create: false });
    assert.deepEqual(boot.events, [], 'boot never creates');
});

await check('markup + defaults: the switch lives in the DB card, defaults on, and boot only touches it when off', () => {
    assert.equal(defaults.db_tool_qr, true);
    const card = html.slice(html.indexOf('<span>번역 DB</span>'), html.indexOf('<span>설정 백업</span>'));
    assert.match(card, /<label class="checkbox_label llmt-check" for="llm_db_tool_qr">\s*<input type="checkbox" id="llm_db_tool_qr"><span>입력창에 DB 관리 단추 두기<\/span>/);
    assert.ok(source.includes("$('#llm_db_tool_qr').prop('checked', extensionSettings.db_tool_qr !== false);"));
    assert.ok(/if \(extensionSettings\.db_tool_qr === false\) syncDbToolQr\(\{ notify: false, create: false \}\)/.test(source));
    assert.ok(!/deleteCharacter|\/api\/characters\/delete/.test(source.slice(source.indexOf('async function syncDbToolQr'), source.indexOf('async function prepareDbToolOnce'))), 'the backup character is never deleted');
});

// ── 설명 사전 · 설정 검색 ──
await check('long-press help and settings search know both features', async () => {
    const { HELP } = await import(pathToFileURL(path.join(root, 'src/longpress-help-data.js')).href);
    assert.ok(HELP.some(e => e.ids?.includes('llm_prompt_reset_button')));
    assert.ok(HELP.some(e => e.ids?.includes('llm_db_tool_qr')));
    const S = await import(pathToFileURL(path.join(root, 'src/settings-search.js')).href);
    const titles = q => S.searchSettings(q).map(e => e.title);
    assert.ok(titles('문단 수 맞추기').includes('번역 프롬프트 기본값으로 되돌리기'));
    assert.ok(titles('기본값으로').includes('번역 프롬프트 기본값으로 되돌리기'));
    assert.ok(titles('llm번역DB관리').includes('입력창에 DB 관리 단추 두기'));
    assert.ok(titles('DB 관리 단추').includes('입력창에 DB 관리 단추 두기'));
});

await check('translator version marks agree (manifest = header pill)', () => {
    const v = JSON.parse(read('src/addons/translator/manifest.json')).version;
    assert.ok(html.includes(`<span class="llmt-version ext-version">v${v}</span>`));
    assert.ok(!/\.10(\.|$)/.test(v));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
