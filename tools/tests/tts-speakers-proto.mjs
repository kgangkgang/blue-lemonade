// 코드 감사 2차 V5: TTS 화자 색 표(src/addons/tts/src/speakers.js)가 받은 채팅 파일의 "__proto__" 열쇠로 Object.prototype 을 고치지 않아요.
// 고치기 전: 채팅 메타 lemon_voice.learned 의 표 기록을 되돌릴 때 색 열쇠를 검사하지 않아, syncChat(메시지 지운 뒤) 한 번에
//   Object.prototype 에 열거되는 votes · tvotes · aliases · count 가 붙었어요(새로고침 전까지 페이지 전체 · 다른 확장의 for…in 에 끼어요).
// 고친 뒤: __proto__ · constructor · prototype 열쇠는 표에 쓰지 않아요.
//   node tools/tests/tts-speakers-proto.mjs <테마 루트>   — 실리태번 모듈은 data: 스텁 · 네트워크 0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
globalThis.__ttsProto = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina' } };
const G = 'const T = globalThis.__ttsProto;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = t => String(t ?? ''); export function getRequestHeaders() { return {}; } export function saveSettingsDebounced() {} export async function saveSettings() {}
export const main_api = 'openai'; export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + 'export const extension_settings = T.ext; export const extensionNames = []; export function getContext() { return T.ctx; } export function saveMetadataDebounced() {}'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }; export async function callGenericPopup() { return null; }'),
    'utils.js': js('export function getStringHash(s) { let h = 0; for (const c of String(s ?? "")) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export function splitRecursive(t) { return [String(t ?? "")]; }'),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {}; export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) { const parent = String(ctx.parentURL || ''); if (parent.includes('/addons/tts/')) { const base = spec.split('/').pop(); if (spec.split('../').length - 1 >= 3 && S[base]) return { url: S[base], shortCircuit: true }; } return next(spec, ctx); }`), { data: { st: ST } });
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const SP = await import(pathToFileURL(path.join(root, 'speakers.js')).href);

const enumerable = () => { const keys = []; for (const k in {}) keys.push(k); return keys; };
const clean = () => { for (const k of enumerable()) delete Object.prototype[k]; };
let pass = 0;
const test = (name, fn) => { try { fn(); } finally { clean(); } pass++; console.log('PASS ' + name); };
const chatWith = learned => {
    // JSON 으로 읽은 채팅 파일처럼 (JSON.parse 는 "__proto__" 를 자기 열쇠로 둬요)
    const md = { lemon_voice: JSON.parse(`{"colors":{},"userColor":null,"palette_at":1,"names":{},"seeded":true,"learned":${learned}}`) };
    const ctx = { chat: [{ mes: '안녕', name: 'A' }], chatMetadata: md, name1: 'User', name2: 'Mina', characters: [] };
    SP._setContextForTest(() => ctx, () => {});
    return md.lemon_voice;
};

test('지운 메시지의 표 기록에 "__proto__" 색 열쇠: Object.prototype 이 그대로예요 (고치기 전: votes · tvotes · aliases · count 가 붙음)', () => {
    chatWith('{"7":{"h":"zz","v":[["__proto__","Mallory",1,0]],"k":["__proto__"],"n":[]}}');
    SP.syncChat();
    assert.deepEqual(enumerable(), []);
    assert.equal(({}).count, undefined);
});
test('"constructor" · "prototype" 색 열쇠와 "__proto__" 이름도 표에 쓰지 않아요', () => {
    const st = chatWith('{"7":{"h":"zz","v":[["constructor","Mallory",1,1],["prototype","Mallory",1,0],["#aabbcc","__proto__",1,0]],"k":["constructor"],"n":[["__proto__",1]]}}');
    SP.syncChat();
    assert.deepEqual(enumerable(), []);
    assert.equal(Object.hasOwn(st.colors, 'constructor'), false);
    assert.equal(Object.hasOwn(st.colors, 'prototype'), false);
    assert.equal(typeof Object.prototype.constructor, 'function', 'Object.prototype.constructor 그대로');
});
test('보통 색 기록은 예전처럼 되돌려요', () => {
    const st = chatWith('{"7":{"h":"zz","v":[["#aabbcc","Mina",2,0]],"k":["#aabbcc"],"n":[]}}');
    st.colors['#aabbcc'] = { name: null, locked: false, auto: false, votes: { Mina: 3 }, tvotes: {}, count: 2, aliases: [] };
    SP.syncChat();
    assert.equal(st.colors['#aabbcc']?.votes?.Mina ?? 0, 1);
    assert.deepEqual(enumerable(), []);
});
test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(theme, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/tts-speakers-proto.mjs .'));
});
console.log(`tts-speakers-proto: ${pass} passed`);
process.exit(0);
