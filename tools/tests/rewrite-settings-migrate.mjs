// 다시 쓰기 (src/addons/rewrite) 저장된 설정 불러오기 · 옮기기 — index.js loadSettings · upgrades.js applyUpgrades · 내보낸 addQuickRule
//   node tools/tests/rewrite-settings-migrate.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 index.js 를 설정마다 새로 불러온다 (?case=N). 실리태번 모듈(script.js · extensions.js · popup.js …)은 data: 스텁,
// jQuery · document · toastr 는 부른 것만 적는 가짜. 네트워크 없음. 규칙 · 예외 이름은 지어낸 것 (기본값 id 는 defaults.js 에서 읽는다).
// 확인하는 것:
//   1) 처음 설치: 기본값은 메모리에만 (설정 저장을 부르지 않음) · 기본 규칙 그대로 · DEFAULT_SETTINGS 객체는 안 바뀜
//   2) v1.0 설정(profileId 만): 프로필 연결로 · 끈 스위치 · 내 규칙 그대로 · 지운 첫 기본 규칙은 다시 안 생김 · 새 기본 규칙만 한 번 (두 번 불러도 그대로)
//   3) offeredRules · offeredExceptions: 받은 적 있는 기본값을 지웠으면 지운 채 · 안 받은 것만 붙임 · 같은 id 는 두 번 안 붙임
//   4) 낱말이 바뀐 기본 규칙 올리기: 사용자가 지운 기본 낱말은 지운 채 · 더한 낱말은 남김 · 고친 이름은 그대로 · 손대지 않은 설명만 새것 · 한 번만
//   5) 빠진 칸만 채움: models · scenePlan · repeat 은 합치고 망가진 repeat 은 기본값 · 모르는 칸(customModelLists · fallback)은 그대로
//   6) addQuickRule: 고른 글로 규칙 하나 · 같은 낱말은 안 만듦 · 문장부호 낱말은 경계 있는 정규식 · 빈 글은 아무것도 안 함
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__rewriteMigrateTest = { ext: {}, saves: 0, toasts: [] };
const G = 'const T = globalThis.__rewriteMigrateTest;\n';
const ST = {
    'script.js': js(G + `export const event_types = { MESSAGE_RECEIVED: 'message_received', MESSAGE_UPDATED: 'message_updated', CHAT_CHANGED: 'chat_id_changed', SETTINGS_UPDATED: 'settings_updated' };
export const eventSource = { on() {}, makeFirst() {}, makeLast() {}, once() {}, removeListener() {}, async emit() {} };
export const main_api = 'openai';
export const isChatSaving = false;
export function generateRaw() { throw new Error('시험 중 모델 요청'); }
export function getRequestHeaders() { return {}; }
export async function saveChatConditional() { throw new Error('시험 중 채팅 저장'); }
export function saveSettingsDebounced() { T.saves++; }
export const substituteParams = (t) => String(t ?? '');
export function updateMessageBlock() {}
export function cleanUpMessage({ getMessage }) { return getMessage; }
export function extractMessageFromData() { return ''; }
export function hideSwipeButtons() {}
export function showSwipeButtons() {}
export function setSendButtonState() {}
export function syncMesToSwipe() {}`),
    'extensions.js': js(G + 'export const extension_settings = T.ext;\nexport function getContext() { return { chat: [], name1: "User", name2: "Char" }; }'),
    'custom-request.js': js('export const ChatCompletionService = { async processRequest() { throw new Error("시험 중 모델 요청"); } };'),
    'power-user.js': js('export const power_user = {};'),
    'tokenizers.js': js('export async function getTokenCountAsync(text) { return String(text).length; }'),
    'openai.js': js('export const oai_settings = {};'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2 }; export const POPUP_RESULT = {}; export async function callGenericPopup() { throw new Error("시험 중 팝업"); } export function fixToastrForDialogs() {}'),
    'secrets.js': js('export const SECRET_KEYS = {}; export const secret_state = {};'),
    'shared.js': js('export const ConnectionManagerRequestService = { async sendRequest() { throw new Error("시험 중 프로필 요청"); } };'),
    'engine.js': js('export const regex_placement = { REASONING: 6 }; export const getRegexedString = (t) => t;'),
    'reasoning.js': js('export function extractReasoningFromData() { return ""; } export function parseReasoningFromString() { return null; }'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(srcDir).href } });

// ---------- 가짜 브라우저 (불러올 때 쓰는 것만)
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
globalThis.window = { addEventListener() {}, removeEventListener() {} };   // 불러올 때마다 듣기를 하나씩 단다 (여기서는 안 씀)
globalThis.document = Object.assign(new EventTarget(), {
    body: { dataset: {}, classList: { contains: () => false } },
    createElement: () => ({ hidden: false, style: {}, append() {}, replaceChildren() {} }),
    getElementById: () => null,
    querySelector: () => null,
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.toastr = Object.fromEntries(['info', 'success', 'warning', 'error'].map(kind => [kind, (text) => { T.toasts.push([kind, String(text)]); return {}; }]));
globalThis.toastr.clear = () => {};
const jq = () => { const o = { length: 0, on: () => o, append: () => o, css: () => o, text: () => o, find: () => o }; return o; };
globalThis.$ = globalThis.jQuery = (arg) => (typeof arg === 'function' ? undefined : jq(arg));   // 시작(start)은 부르지 않는다 — 불러오기만 본다

const C = await import(url('src/addons/rewrite/core.js'));
const { DEFAULT_SETTINGS } = await import(url('src/addons/rewrite/defaults.js'));
const { UPGRADES } = await import(url('src/addons/rewrite/upgrades.js'));
const INDEX = url('src/addons/rewrite/index.js');
const SOURCE = fs.readFileSync(path.join(srcDir, 'addons/rewrite/index.js'), 'utf8');
const idsOf = name => JSON.parse(SOURCE.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1].replace(/'/g, '"'));
const FIRST_RULE_IDS = idsOf('FIRST_RULE_IDS');            // v1.6.0 전에 나간 기본 규칙
const FIRST_EXCEPTION_IDS = idsOf('FIRST_EXCEPTION_IDS');  // v1.7.0 전에 나간 기본 예외
const DEFAULT_SNAPSHOT = structuredClone(DEFAULT_SETTINGS);
const ALL_UPGRADES = UPGRADES.map(u => u.id);
const defaultRule = id => structuredClone(DEFAULT_SETTINGS.rules.find(rule => rule.id === id));
const entryKey = entry => ('word' in entry ? `w:${entry.word.toLowerCase()}` : `r:${entry.regex}`);
const entrySet = words => new Set(C.parseEntries(words).map(entryKey));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 8).join('\n       ')}`); }
}

let loads = 0;
/** 저장된 설정(없으면 undefined)으로 index.js 를 새로 불러온다 → { mod, s: 불러온 뒤의 extension_settings.ban_word_rewrite } */
async function load(stored) {
    for (const key of Object.keys(T.ext)) delete T.ext[key];
    if (stored !== undefined) T.ext.ban_word_rewrite = stored;
    T.saves = 0;
    T.toasts.length = 0;
    const mod = await import(`${INDEX}?case=${++loads}`);
    return { mod, s: T.ext.ban_word_rewrite };
}
const OWN_RULE = () => ({ id: 'rule-own1', name: '내 규칙', enabled: true, words: 'velvet scarf', description: 'a velvet scarf', onlyFor: '', near: '' });
const OWN_EXCEPTION = () => ({ id: 'exception-own1', enabled: true, names: 'Tamsin, 탐신', allow: ['rule-own1'] });

await test('처음 설치: 기본값은 메모리에만 (설정 저장 안 부름) · 기본 규칙 · 예외 그대로 · DEFAULT_SETTINGS 는 안 바뀜', async () => {
    const { s } = await load(undefined);
    assert.ok(s && typeof s === 'object');
    assert.notEqual(s, DEFAULT_SETTINGS, '복사본');
    assert.equal(T.saves, 0, '불러오기만으로 settings.json 을 다시 쓰지 않는다');
    assert.deepEqual(s.rules, DEFAULT_SNAPSHOT.rules, '기본 규칙 낱말 그대로 (올리기 단계가 바꾸지 않음)');
    assert.deepEqual(s.exceptions, DEFAULT_SNAPSHOT.exceptions);
    assert.deepEqual(s.offeredRules, DEFAULT_SNAPSHOT.offeredRules);
    assert.equal(s.connection, 'current');
    for (const id of ALL_UPGRADES) assert.ok(s.appliedUpgrades.includes(id), `처음 설치는 모든 올리기를 한 셈: ${id}`);
    s.rules[0].name = '바꾼 이름'; s.models.openai = 'changed'; s.repeat.on = true; s.scenePlan.enabled = true; s.appliedUpgrades.push('x');
    assert.deepEqual(DEFAULT_SETTINGS, DEFAULT_SNAPSHOT, '사용자 설정을 고쳐도 기본값 객체는 그대로');
});

await test('v1.0 설정(profileId 만): 프로필 연결로 · 끈 스위치 · 내 규칙 그대로 · 지운 첫 기본 규칙은 다시 안 생김 · 새 기본 규칙만 한 번', async () => {
    const stored = { profileId: 'work-profile', enabled: false, rules: [OWN_RULE()], exceptions: [OWN_EXCEPTION()] };
    const { s } = await load(stored);
    assert.equal(s, stored, '저장된 객체를 그대로 고쳐 쓴다 (다른 객체로 바꾸지 않음)');
    assert.equal(s.connection, 'profile', 'v1.0 은 프로필을 고르면 그 프로필을 썼다');
    assert.equal(s.profileId, 'work-profile');
    assert.equal(s.enabled, false, '끈 스위치는 그대로');
    assert.deepEqual(s.rules[0], OWN_RULE(), '내 규칙은 맨 앞 그대로');
    const ids = s.rules.map(rule => rule.id);
    for (const id of FIRST_RULE_IDS) assert.ok(!ids.includes(id), `v1.6.0 전 기본 규칙은 받은 셈 — 없으면 지운 것: ${id}`);
    const fresh = DEFAULT_SETTINGS.rules.map(rule => rule.id).filter(id => !FIRST_RULE_IDS.includes(id));
    assert.deepEqual(ids.slice(1), fresh, '그 뒤에 나온 기본 규칙만 기본 차례대로 붙임');
    for (const rule of s.rules.slice(1)) {
        const def = defaultRule(rule.id);
        assert.deepEqual(entrySet(rule.words), entrySet(def.words), `붙인 기본 규칙은 올리기 단계 뒤에도 같은 낱말: ${rule.id}`);
        assert.equal(rule.name, def.name); assert.equal(rule.description, def.description);
    }
    assert.deepEqual(s.offeredRules, [...FIRST_RULE_IDS, ...fresh]);
    assert.deepEqual(s.exceptions[0], OWN_EXCEPTION(), '내 예외 그대로');
    const excIds = s.exceptions.map(exception => exception.id);
    for (const id of FIRST_EXCEPTION_IDS) assert.ok(!excIds.includes(id), `v1.7.0 전 기본 예외는 받은 셈: ${id}`);
    assert.deepEqual(excIds.slice(1), DEFAULT_SETTINGS.exceptions.map(exception => exception.id).filter(id => !FIRST_EXCEPTION_IDS.includes(id)));
    assert.deepEqual([...s.appliedUpgrades].sort(), [...ALL_UPGRADES].sort(), '올리기는 한 번씩 적힘');
    assert.equal(T.saves, 0);
    // 같은 설정을 다시 불러도 그대로 (두 번 붙이지 않음)
    const once = structuredClone(s);
    const again = await load(s);
    assert.deepEqual(again.s, once, '두 번째 불러오기는 아무것도 안 바꾼다');
    // profileId 가 비었으면 현재 연결 · 이미 고른 연결은 profileId 가 있어도 그대로
    assert.equal((await load({ profileId: '' })).s.connection, 'current');
    assert.equal((await load({ profileId: 'work-profile', connection: 'direct' })).s.connection, 'direct');
});

await test('offeredRules · offeredExceptions 가 있으면: 받은 적 있는 기본값을 지웠으면 지운 채 · 안 받은 것만 붙임 · 같은 id 는 두 번 안 붙임', async () => {
    const all = DEFAULT_SETTINGS.rules.map(rule => rule.id);
    const [deleted, missing, already] = [all[1], all.at(-1), all.at(-2)];
    const mine = { ...defaultRule(already), words: 'my own words', name: '내가 고친 이름' };
    const stored = {
        rules: [OWN_RULE(), mine],
        offeredRules: all.filter(id => id !== missing && id !== already),   // deleted 는 받았다가 지움 · missing · already 는 아직 안 받음
        exceptions: [],
        offeredExceptions: [...DEFAULT_SETTINGS.offeredExceptions],          // 기본 예외는 모두 받았다가 지움
        appliedUpgrades: [...ALL_UPGRADES],
    };
    const { s } = await load(stored);
    const ids = s.rules.map(rule => rule.id);
    assert.ok(!ids.includes(deleted), '받은 뒤 지운 기본 규칙은 다시 안 생김');
    assert.deepEqual(ids, ['rule-own1', already, missing], '안 받은 것만 끝에 · 이미 같은 id 가 있으면 안 붙임');
    assert.equal(s.rules[1].words, 'my own words', '같은 id 의 내 규칙은 덮어쓰지 않음');
    assert.equal(s.rules[1].name, '내가 고친 이름');
    assert.deepEqual(s.rules[2], defaultRule(missing));
    assert.ok(s.offeredRules.includes(missing) && s.offeredRules.includes(already));
    assert.deepEqual(s.exceptions, [], '받은 뒤 지운 기본 예외는 다시 안 생김');
    assert.equal(T.saves, 0);
});

await test('낱말이 바뀐 기본 규칙 올리기(upgrades.js): 지운 기본 낱말은 지운 채 · 더한 낱말은 남김 · 새 낱말 들어옴 · 고친 이름은 그대로 · 손대지 않은 설명만 새것 · 한 번만', async () => {
    const OLD_EARS = 'pointed ear, pointed ears, pointy ear, pointy ears, pointed elven ears, pointed elf ears, elven ears, elfin ears, elfish ears';   // 1.6 기본에서 'elf ears' 만 지움
    const OLD_NAILS_DESC = 'gray-colored fingernails, claws, or talons (dark gray, charcoal, gunmetal, or graphite nails or nail polish)';
    const ears = { id: 'ears', name: '뾰족귀', enabled: true, words: `${OLD_EARS}\nfae ears`, description: 'pointed or elf-like ears', onlyFor: '', near: '' };
    const nails = { id: 'gray_nails', name: '내 손톱 규칙', enabled: false, words: 'gray nails\nink-stained cuticles', description: OLD_NAILS_DESC, onlyFor: '', near: '' };
    const stored = {
        rules: [ears, nails, OWN_RULE()],
        offeredRules: DEFAULT_SETTINGS.rules.map(rule => rule.id),
        exceptions: [],
        offeredExceptions: [...DEFAULT_SETTINGS.offeredExceptions],
        // appliedUpgrades 없음 = 올리기 전 설치
    };
    const { s } = await load(stored);
    const E = s.rules.find(rule => rule.id === 'ears');
    const keys = entrySet(E.words);
    assert.ok(!keys.has('w:elf ears'), '사용자가 지운 기본 낱말은 새 기본값에 있어도 다시 안 넣음');
    assert.ok(keys.has('w:fae ears'), '사용자가 더한 낱말은 남김');
    assert.equal(C.parseEntries(E.words).at(-1).word, 'fae ears', '더한 낱말은 끝에');
    assert.ok(!keys.has('w:pointed elven ears'), '새 기본값이 이미 잡는 옛 기본 낱말은 뺌');
    for (const key of entrySet(defaultRule('ears').words)) if (key !== 'w:elf ears') assert.ok(keys.has(key), `새 기본 낱말: ${key}`);
    const N = s.rules.find(rule => rule.id === 'gray_nails');
    assert.equal(N.name, '내 손톱 규칙', '고친 이름은 그대로');
    assert.equal(N.description, defaultRule('gray_nails').description, '손대지 않은 옛 설명만 새 설명으로');
    assert.equal(N.enabled, false, '끈 규칙은 끈 채');
    assert.ok(entrySet(N.words).has('w:ink-stained cuticles'), '더한 낱말은 남김');
    assert.ok(C.findSpans('Her lacquered nails tapped the table.', [C.compileRule(N)]).length > 0, '1.9.9 칠한 손톱 줄이 들어옴');
    assert.deepEqual(s.rules.at(-1), OWN_RULE(), '내 규칙은 손대지 않음');
    for (const id of ALL_UPGRADES) assert.equal(s.appliedUpgrades.filter(x => x === id).length, 1, `한 번만 적힘: ${id}`);
    const once = structuredClone(s);
    assert.deepEqual((await load(s)).s, once, '다시 불러도 또 올리지 않음');
});

await test('빠진 칸만 채움: models · scenePlan · repeat 은 합침 · 망가진 repeat 은 기본값 · 모르는 칸은 그대로', async () => {
    const lists = { 'https://relay.test/v1': { models: ['m-1'], fetchedAt: '2026-01-01T00:00:00.000Z' } };
    const stored = {
        connection: 'direct', provider: 'openrouter', temperature: 0.4, maxAttempts: 2,
        models: { openrouter: 'vendor/picked-model' }, customModels: { custom: 'typed-model' },
        scenePlan: { enabled: true, startPattern: '<plan' }, repeat: { on: true, threshold: 75 },
        customModelLists: lists, fallback: { enabled: true, provider: 'deepseek', model: 'deepseek-flash' },
        rules: [OWN_RULE()], offeredRules: DEFAULT_SETTINGS.rules.map(rule => rule.id),
        exceptions: [], offeredExceptions: [...DEFAULT_SETTINGS.offeredExceptions], appliedUpgrades: [...ALL_UPGRADES],
    };
    const { s } = await load(stored);
    assert.equal(s.connection, 'direct'); assert.equal(s.provider, 'openrouter'); assert.equal(s.temperature, 0.4); assert.equal(s.maxAttempts, 2);
    assert.deepEqual(s.models, { ...DEFAULT_SETTINGS.models, openrouter: 'vendor/picked-model' }, '고른 모델은 그대로, 없는 공급자만 기본값');
    assert.deepEqual(s.customModels, { custom: 'typed-model' });
    assert.deepEqual(s.scenePlan, { ...DEFAULT_SETTINGS.scenePlan, enabled: true, startPattern: '<plan' });
    assert.deepEqual(s.repeat, { ...DEFAULT_SETTINGS.repeat, on: true, threshold: 75 });
    assert.deepEqual(s.customModelLists, lists, '2.0.1 까지 받은 목록 칸은 그대로 (읽기만)');
    assert.deepEqual(s.fallback, { enabled: true, provider: 'deepseek', model: 'deepseek-flash' }, '검열되면 다른 모델 칸 그대로');
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) if (!(key in stored)) assert.deepEqual(s[key], value, `빠진 칸은 기본값: ${key}`);
    assert.equal(T.saves, 0);
    for (const bad of ['bad', null, 7]) {
        const { s: t } = await load({ repeat: bad, rules: [], exceptions: [] });
        assert.deepEqual(t.repeat, DEFAULT_SETTINGS.repeat, `망가진 repeat(${JSON.stringify(bad)}) → 기본값`);
    }
});

await test('addQuickRule: 고른 글로 규칙 하나 · 같은 낱말(대소문자 · 공백 무시) · 다른 규칙에 이미 있는 낱말은 안 만듦 · 문장부호 낱말은 경계 있는 정규식 · 빈 글은 아무것도 안 함', async () => {
    const stored = { rules: [OWN_RULE()], offeredRules: DEFAULT_SETTINGS.rules.map(rule => rule.id), exceptions: [], offeredExceptions: [...DEFAULT_SETTINGS.offeredExceptions], appliedUpgrades: [...ALL_UPGRADES] };
    const { mod, s } = await load(stored);
    assert.equal(mod.addQuickRule('  copper   lantern '), true);
    const added = s.rules.at(-1);
    assert.equal(s.rules.length, 2);
    assert.deepEqual({ name: added.name, enabled: added.enabled, words: added.words, onlyFor: added.onlyFor, near: added.near }, { name: 'copper lantern', enabled: true, words: 'copper lantern', onlyFor: '', near: '' });
    assert.match(added.id, /^rule-/); assert.ok(added.description.includes('copper lantern'));
    assert.equal(T.saves, 1, '규칙을 만들면 한 번 저장');
    assert.equal(mod.addQuickRule('Copper Lantern'), false, '같은 낱말 (대소문자)');
    assert.equal(mod.addQuickRule('velvet scarf'), false, '다른 규칙에 이미 있는 낱말');
    assert.equal(s.rules.length, 2); assert.equal(T.saves, 1, '안 만들면 저장 안 함');
    assert.ok(T.toasts.some(([kind, text]) => kind === 'info' && text.includes('이미 있어요')));
    assert.equal(mod.addQuickRule('   '), false); assert.equal(mod.addQuickRule(''), false); assert.equal(mod.addQuickRule(null), false);
    assert.equal(mod.addQuickRule('half-moon spectacles'), true);
    const punct = s.rules.at(-1);
    assert.match(punct.words, /^\/.*\/$/, '문장부호가 있으면 정규식 한 줄');
    const set = [C.compileRule(punct)];
    assert.deepEqual(C.compileRule(punct).errors, []);
    assert.equal(C.findSpans('He wore half-moon spectacles today.', set).length, 1, '고른 글 그대로 잡음');
    assert.equal(C.findSpans('On behalf-moon spectacles nobody spoke.', set).length, 0, '낱말 가운데에서는 안 잡음');
    assert.equal(mod.addQuickRule('Half-Moon Spectacles'), false, '정규식 규칙도 같은 낱말이면 안 만듦');
    assert.equal(T.saves, 2);
});

console.log(`\nrewrite-settings-migrate: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
