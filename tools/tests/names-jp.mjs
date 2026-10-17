// 6.3.x 이름 영 · 한 · 일 — 이름 다리를 쓰는 자리들 (TTS 목소리 · 공용 도우미 · 잠시 가리기 · 에셋 · 웹 검색 · 다리 이름꼴) + 연결 코드
//   node tools/tests/names-jp.mjs <테마 루트>   (TTS 는 tts-paint.mjs · names-bridge.mjs 와 같은 스텁) — 이름은 모두 중립 이름
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = (rel) => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const imp = (rel) => import(pathToFileURL(path.join(themeRoot, rel)).href);
const KEY = Symbol.for('blue-lemonade.names');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const Bridge = await imp('src/addons/translator/names-bridge.js');
const bridgeOf = entries => Bridge.buildNames(Bridge.namePairs(entries.map(([src, dst]) => ({ src, dst, scope: 'global' }))));
const setBridge = entries => { globalThis[KEY] = bridgeOf(entries); };

// ── 공용 도우미 ──
const NA = await imp('src/name-aliases.js');
await test('도우미: 다리가 없으면 빈 목록 · 있으면 다른 표기 (적은 순서 먼저, 중복 없이)', () => {
    delete globalThis[KEY];
    assert.deepEqual(NA.nameAliases('Rowan'), []);
    assert.deepEqual(NA.withNameAliases(['Rowan', 'rowan', ' ']), ['Rowan', 'rowan'], 'typed list kept as typed (6.3.8)');
    setBridge([['Rowan, ローワン', '로완'], ['Mina', '미나']]);
    assert.deepEqual(NA.nameAliases('로완'), ['Rowan', 'ローワン']);
    assert.deepEqual(NA.withNameAliases(['로완', 'Nobody']), ['로완', 'Nobody', 'Rowan', 'ローワン']);
    globalThis[KEY] = { version: 2, aliasesOf: () => ['x'] };
    assert.deepEqual(NA.nameAliases('Rowan'), [], 'unknown bridge version ignored');
});

// ── 잠시 가리기 · 캡처 이름 숨기기 ──
await test('잠시 가리기: 다른 표기까지 넘기면 셋 다 가린다 · startMask 가 다리를 쓴다 · 캡처도', async () => {
    setBridge([['Rowan, ローワン', '로완']]);
    const W = await imp('src/wordmask.js');
    const plan = W.maskPlan('로완 met Rowan and ローワン.', NA.withNameAliases(['로완']));
    assert.equal(plan.filter(p => p.masked).length, 3);
    assert.match(read('src/wordmask.js'), /const next = withNameAliases\(parseMaskWords\(/);
    const cp = read('src/capture-privacy.js');
    assert.match(cp, /const names=options\.redact\?withNameAliases\(options\.names\|\|\[\]\):\[\];/);
    assert.equal((cp.match(/hidden\+=hideNames\(root,names\)/g) || []).length, 2, 'both passes use the expanded list');
});

// ── 캐릭터 에셋 ──
await test('에셋: 앞머리가 폴더에 없으면 다른 표기의 앞머리로 비슷한 그림 · 있으면 예전 그대로', async () => {
    const N = await imp('src/addons/assets/names.js');
    const asset = (file) => ({ file, base: file.replace(/\.[^.]+$/, ''), groupLabel: file.replace(/\.[^.]+$/, '') });
    const groups = new Map([['rowan_smirk', [asset('Rowan_smirk.webp')]], ['rowan_smile', [asset('Rowan_smile.webp')]], ['mina_smirk', [asset('Mina_smirk.webp')]]]);
    delete globalThis[KEY];
    assert.deepEqual(N.findSimilarList('ローワン_smirk', groups), [], 'no bridge → nothing (as before)');
    setBridge([['Rowan, ローワン', '로완']]);
    assert.equal(N.findSimilarList('ローワン_smirk', groups)[0]?.file, 'Rowan_smirk.webp');
    assert.equal(N.findSimilarList('로완_smirk', groups)[0]?.file, 'Rowan_smirk.webp');
    assert.equal(N.findSimilarList('Mina_smirk', groups)[0]?.file, 'Mina_smirk.webp', 'direct owner untouched');
});
await test('에셋 고르기: 주인 표기 줄 (다리가 아는 주인만) · 줄이 없으면 프롬프트가 예전과 같다', async () => {
    setBridge([['Rowan, ローワン', '로완']]);
    const SP = await imp('src/addons/assets/spellings.js');
    const S = await imp('src/addons/assets/slots.js');
    const list = '(one line per character)\n- Rowan: Rowan_smirk.webp, Rowan_smile.webp\n- Mina: Mina_smirk.webp, Mina_cry.png';
    assert.equal(SP.ownerSpellings(list), 'Rowan = 로완 = ローワン');
    const withNames = S.pickPrompt({ list, reply: 'x', names: SP.ownerSpellings(list) })[0].content;
    assert.match(withNames, /<name_spellings>\nRowan = 로완 = ローワン\n<\/name_spellings>/);
    assert.equal(S.pickPrompt({ list, reply: 'x', names: '' })[0].content, S.pickPrompt({ list, reply: 'x' })[0].content);
    assert.doesNotMatch(S.pickPrompt({ list, reply: 'x' })[0].content, /name_spellings/);
    assert.match(read('src/addons/assets/after-reply.js'), /names: ownerSpellings\((?:runtime|list)\.keywords\),/);
});

// ── 웹 검색 · 출처 ──
await test('웹 검색: 가타카나 덩이 · 경칭 · 조사를 뗀 말 · 다른 표기도 열쇠 — 예전 열쇠는 그대로 앞에', async () => {
    const C = await imp('src/websearch-core.js');
    setBridge([['Rowan, ローワン', '로완']]);
    assert.deepEqual(C.searchKeys('사과를').slice(0, 2), ['사과를', '사과']);
    const keys = C.searchKeys('ローワン様', { aliasesOf: NA.nameAliases });
    assert.equal(keys[0], 'ローワン様');
    for (const k of ['ローワン', 'rowan', '로완']) assert.ok(keys.includes(k), k);
    assert.ok(C.searchKeys('ローワンは静かに笑った').includes('ローワン'), 'kana run inside a sentence');
    const blocks = [{ kind: 'lorebook', name: 'Cast', text: 'Rowan is the archivist.' }];
    assert.deepEqual(C.findOrigins(blocks, 'ローワン様'), [], 'without aliases: not found (as before)');
    assert.equal(C.findOrigins(blocks, 'ローワン様', undefined, { aliasesOf: NA.nameAliases }).length, 1);
    assert.match(read('src/websearch.js'), /findOrigins\(blocks, word, undefined, \{ aliasesOf: nameAliases, at: hit\.at \}\)/);
});

// ── 다시 쓰기 예외 · 북마크 · 메모 (연결 코드) ──
await test('다시 쓰기 예외 · 북마크 · 메모: 다른 표기로도 찾는 코드', () => {
    const rw = read('src/addons/rewrite/index.js');
    assert.equal((rw.match(/const exceptions = activeExceptions\((recent|text)\);/g) || []).length, 2);
    assert.match(rw, /names: withNameAliases\(splitNames\(exception\.names\)\)\.join\(', '\)/);
    assert.match(rw, /return list\.filter\(\(_, at\) => hit\.has\(at\)\);/, 'returns the stored exceptions unchanged');
    const bp = read('src/addons/bookmarks/panel.js');
    assert.equal((bp.match(/nameAliases\(view\.query\)/g) || []).length, 3, 'filter · all messages · card highlight');
    assert.match(read('src/addons/notes/index.js'), /const qs = q \? \[q, \.\.\.nameAliases\(raw\)/);
});

// ── 이름 다리 이름꼴 ──
await test('다리: 가운뎃점 이름도 이름꼴 · 반각 가나는 전각과 같은 이름', () => {
    assert.equal(Bridge.isNameLike('ローワン・ベルク'), true);
    assert.equal(Bridge.isNameLike('ﾛｰﾜﾝ'), true);
    assert.equal(Bridge.nameFold('ﾛｰﾜﾝ'), Bridge.nameFold('ローワン'));
    const api = bridgeOf([['Rowan Berg', 'ローワン・ベルク']]);
    assert.deepEqual(api.aliasesOf('Rowan Berg'), ['ローワン・ベルク']);
    assert.deepEqual(bridgeOf([['Rowan, ローワン', '로완']]).aliasesOf('ﾛｰﾜﾝ'), ['Rowan', '로완']);
    // 검토 R1: 반각 · 전각으로 적힌 표기는 적힌 그대로 + 표준 표기 둘 다 (원문이 어느 폭이어도 찾게)
    const wide = bridgeOf([['ﾛｰﾜﾝ', '로완'], ['ＲＯＷＡＮ', '로완']]);
    assert.deepEqual(wide.aliasesOf('로완').sort(), ['ROWAN', 'ﾛｰﾜﾝ', 'ローワン', 'ＲＯＷＡＮ'].sort());
    assert.ok(wide.pairs.some(p => p.src === 'ﾛｰﾜﾝ') && wide.pairs.some(p => p.src === 'ローワン'));
    const plain = bridgeOf([['Rowan', 'ローワン'], ['Rowan', '로완']]);
    assert.equal(plain.pairs.length, 2);
});

// ── 검토 R2~R8 (지어낸 이름) ──
await test('검토: 한 가나를 두 사람이 나눠 쓰면 에셋 그림 · 고르기 줄은 모호 → 예전처럼', async () => {
    setBridge([['Rina', 'リナ'], ['Lina', 'リナ'], ['Rowan, ローワン', '로완']]);
    const N = await imp('src/addons/assets/names.js');
    const SP = await imp('src/addons/assets/spellings.js');
    const asset = (file) => ({ file, base: file.replace(/\.[^.]+$/, ''), groupLabel: file.replace(/\.[^.]+$/, '') });
    const groups = new Map([['rina_smile', [asset('Rina_smile.webp')]], ['lina_smile', [asset('Lina_smile.webp')]], ['rowan_smile', [asset('Rowan_smile.webp')]]]);
    assert.deepEqual(N.findSimilarList('リナ_smile', groups), [], 'two owners → nothing');
    assert.equal(N.findSimilarList('ローワン_smile', groups)[0]?.file, 'Rowan_smile.webp', 'one owner → found');
    const list = '(one line per character)\n- Rina: Rina_smile.webp, Rina_cry.webp\n- Lina: Lina_smile.webp, Lina_cry.webp\n- Rowan: Rowan_smile.webp, Rowan_cry.webp';
    assert.equal(SP.ownerSpellings(list), 'Rowan = 로완 = ローワン');
    setBridge([['Kent', 'ケント']]);
    assert.equal(SP.ownerSpellings('Rowan Kent_smile.png, Rowan Kent_cry.png'), '', 'no owner from a file name with a space');
});
await test('검토: 웹 검색 일본어 — 누른 가타카나 덩이만 · 늘임표만 X · 히라가나 낱말 끝 그대로 · 소문자 라틴은 다른 표기 X', async () => {
    const C = await imp('src/websearch-core.js');
    delete globalThis[KEY];
    const w = 'ドアを閉めてローワンは笑った';
    assert.ok(!C.searchKeys(w, { at: 13 }).includes('ドア') && !C.searchKeys(w, { at: 13 }).includes('ローワン'), 'pressed on 笑った');
    assert.ok(C.searchKeys(w, { at: 8 }).includes('ローワン') && !C.searchKeys(w, { at: 8 }).includes('ドア'), 'pressed on ローワン');
    assert.ok(!C.searchKeys('あーーっ').includes('ーー'));
    assert.deepEqual(C.searchKeys('かえで'), ['かえで']);
    assert.ok(C.searchKeys('ローワン様').includes('ローワン'));
    setBridge([['Ash', '애쉬']]);
    assert.ok(!C.searchKeys('ash', { aliasesOf: NA.nameAliases }).includes('애쉬'), 'lowercase word is not a name');
    assert.ok(C.searchKeys('Ash', { aliasesOf: NA.nameAliases }).includes('애쉬'));
});
await test('검토: 적은 목록은 적은 그대로 · 다리가 바뀌면 에셋 기억 · 잠시 가리기 새로 · 북마크는 다른 표기도 칠한다', () => {
    delete globalThis[KEY];
    assert.deepEqual(NA.withNameAliases(['Élise', 'élise']), ['Élise', 'élise']);
    assert.match(read('src/addons/assets/render.js'), /document\.addEventListener\('bl:names-changed', onNamesChanged\)/);
    assert.match(read('src/wordmask.js'), /d\?\.addEventListener\('bl:names-changed', on\)/);
    assert.match(read('src/wordmask.js'), /namesOff\?\.\(\); namesOff = null;/);
    assert.match(read('src/addons/bookmarks/panel.js'), /const qs = \[view\.query, \.\.\.nameAliases\(view\.query\)\];/);
});

// ── TTS 목소리 ──
const root = path.join(themeRoot, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__namesJpTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'Hero', name2: 'Narrator' } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__namesJpTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}
export const main_api = 'openai';
export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'popup.js': js(`export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup() { return null; }`),
    'utils.js': js(`export function getStringHash(s) { let h = 0; for (const c of String(s ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function splitRecursive(t) { return [String(t ?? '')]; }`),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });
const { settings, toVoice } = await import(pathToFileURL(path.join(root, 'settings.js')).href);
const V = await import(pathToFileURL(path.join(root, 'voices.js')).href);
const SPK = await import(pathToFileURL(path.join(root, 'speakers.js')).href);
const s = settings();
s.voices.push(toVoice({ voiceId: 'v_row', name: '로완' }), toVoice({ voiceId: 'v_mina', name: 'Mina', aliases: ['미나'] }), toVoice({ voiceId: 'v_def', name: 'Default' }));
s.char_map = { Rowan: 'minimax:v_row' };
s.default_voice = 'minimax:v_def';
const uid = n => V.voiceFor(n)?.uid || '';
const colours = { '#30a0a0': { name: 'Rowan', locked: true, count: 0, votes: {}, tvotes: {}, aliases: ['Rowan', '로완', 'ローワン'] } };

await test('TTS: 바로 찾는 이름은 예전 그대로 (연결표 열쇠 · 목소리 이름 · 목소리 별명)', () => {
    T.ctx.chatMetadata.lemon_voice = { colors: {}, names: {}, learned: {} };
    delete globalThis[KEY];
    assert.equal(uid('Rowan'), 'minimax:v_row');
    assert.equal(uid('로완'), 'minimax:v_row');
    assert.equal(uid('미나'), 'minimax:v_mina');
    assert.equal(V.hasOwnVoice('Rowan'), true);
});
await test('TTS: 색 표의 가나 별명 (ローワン) → 별명표로 연결표 Rowan 의 목소리 · 목소리 있는 화자', () => {
    T.ctx.chatMetadata.lemon_voice = { colors: JSON.parse(JSON.stringify(colours)), names: {}, learned: {} };
    assert.equal(SPK.canon('ローワン'), 'Rowan');
    assert.equal(uid('ローワン'), 'minimax:v_row');
    assert.equal(V.hasOwnVoice('ローワン'), true, 'not asked as an unvoiced speaker');
});
await test('TTS: 이름 다리의 짝 (Mina ↔ ミナ) → 목소리 별명의 대표 Mina · 다리 없으면 예전처럼 모름', () => {
    T.ctx.chatMetadata.lemon_voice = { colors: {}, names: {}, learned: {} };
    globalThis[KEY] = Object.freeze({ version: 1, pairs: Object.freeze([{ src: 'Mina', dst: 'ミナ', scope: 'global' }]) });
    assert.equal(uid('ミナ'), 'minimax:v_mina');
    assert.equal(V.hasOwnVoice('ミナ'), true);
    delete globalThis[KEY];
    assert.notEqual(uid('ミナ'), 'minimax:v_mina');
});
await test('TTS: 별명표도 모르는 이름은 예전 그대로 (기본 목소리 · 목소리 없는 화자)', () => {
    T.ctx.chatMetadata.lemon_voice = { colors: JSON.parse(JSON.stringify(colours)), names: {}, learned: {} };
    assert.equal(uid('Stranger'), 'minimax:v_def');
    assert.equal(V.hasOwnVoice('Stranger'), false);
});
await test('TTS 코드: 바로 찾기 다음 · 엑스트라 앞에서만 별명표 · CI 등록', () => {
    const vo = read('src/addons/tts/src/voices.js');
    assert.match(vo, /import \{ canon \} from '\.\/speakers\.js';/);
    assert.ok(vo.indexOf('const a = aliasOf(n);') < vo.indexOf('const x = extraFor(n);'), 'alias before extras');
    assert.ok(vo.indexOf('if (v) return preferVoice(v, key || n);') < vo.indexOf('const a = aliasOf(n);'), 'direct lookup first');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/names-jp\.mjs \./);
});

delete globalThis.__namesJpTest; delete globalThis[KEY];
console.log(`names-jp: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
