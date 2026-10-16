// TTS 1.9.7 화자 색 이름 바꾸기 — src/addons/tts/src/speakers.js setColor: 다른 사람 이름으로 바꾸거나 이름을 지우면 전 이름의 다른 표기(aliases — 팔레트의 「미나/Mina」)를
//   함께 떼어 낸다(전엔 남아서 옛 별명이 새 이름의 표기로 잡혔다). 같은 사람의 다른 표기(aliases 안의 이름)로 바꾸는 건 그대로.
//   실리태번 모듈은 data: 스텁(tts-paint.mjs 와 같은 방식). 지어낸 인물 · 색만 쓴다. 네트워크 없음.
//   node tools/tests/tts-color-rename.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsColorRenameTest = { ext: {}, ctx: null };
const G = 'const T = globalThis.__ttsColorRenameTest;\n';
const ST = {
    'script.js': js(G + `export const chat = []; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? ''); export function getRequestHeaders() { return {}; } export function saveSettingsDebounced() {} export async function saveSettings() {}
export const main_api = 'openai'; export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + 'export const extension_settings = T.ext; export const extensionNames = []; export function getContext() { return T.ctx; } export function saveMetadataDebounced() {}'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }; export async function callGenericPopup() { return null; }'),
    'utils.js': js('export function getStringHash(s) { let h = 0; for (const c of String(s ?? "")) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export function splitRecursive(t) { return [String(t ?? "")]; }'),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').includes('/addons/tts/')) { const base = spec.split('/').pop(); if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true }; }
    return next(spec, ctx);
}`), { data: { st: ST } });
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const SP = await import(pathToFileURL(path.join(root, 'speakers.js')).href);
const { settings } = await import(pathToFileURL(path.join(root, 'settings.js')).href);
settings();
T.ctx = { chat: [], chatMetadata: {}, name1: '하람', name2: '미나', characterId: 0, groupId: null, groups: [], chatCompletionSettings: {},
    characters: [{ avatar: 'mina.png', name: '미나', description: '팔레트\n- 미나/Mina: #ff0000\n- 렉스: #0000ff' }] };
let saves = 0;
SP._setContextForTest(() => T.ctx, () => { saves++; });
const row = color => SP.colorTable().find(r => r.color === color);

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('팔레트에서 불러오면 「미나/Mina」 가 이름 미나 + 다른 표기 둘', () => {
    SP.importPalette({ deferSave: true });
    const r = row('#ff0000');
    assert.equal(r.name, '미나'); assert.deepEqual(r.aliases, ['미나', 'Mina']); assert.equal(r.locked, true);
    assert.ok(SP.namesOf('미나').some(x => /mina/i.test(x)), '다른 표기가 같은 사람으로 잡힌다');
});

t('같은 사람의 다른 표기(Mina)로 바꾸면 표기는 그대로', () => {
    assert.equal(SP.setColor('#ff0000', 'Mina'), true);
    const r = row('#ff0000');
    assert.equal(r.name, 'Mina'); assert.deepEqual(r.aliases, ['미나', 'Mina']);
});

t('다른 사람(렉스)으로 바꾸면 전 이름의 표기를 떼어 낸다 — 옛 별명이 새 이름으로 잡히지 않음 · 색은 렉스', () => {
    assert.equal(SP.setColor('#ff0000', '렉스'), true);
    const r = row('#ff0000');
    assert.equal(r.name, '렉스'); assert.deepEqual(r.aliases, []);
    assert.ok(!SP.namesOf('렉스').some(x => /mina|미나/i.test(x)), '미나 · Mina 는 더는 렉스의 표기가 아니다');
    assert.equal(SP.resolveSpeaker({ color: '#ff0000' }, { userName: '하람', charName: '미나' }).name, '렉스');
});

t('이름을 지우면 이름 · 잠금 · 표기가 비고(표에서 빠짐) 그 색은 보낸 쪽으로', () => {
    SP.setColor('#0000ff', '렉스');
    assert.equal(row('#0000ff').name, '렉스');
    assert.equal(SP.setColor('#0000ff', ''), true);
    const r = row('#0000ff');
    assert.ok(!r || (r.name === null && r.aliases.length === 0 && r.locked === false), JSON.stringify(r));
    assert.equal(SP.resolveSpeaker({ color: '#0000ff' }, { userName: '하람', charName: '미나' }).source, 'sender');
    assert.ok(saves >= 1, '저장한다');
});

console.log(`tts-color-rename: ${n} passed, 0 failed`);
