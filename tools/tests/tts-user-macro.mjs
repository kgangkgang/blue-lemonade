// TTS 2.0.2 「{{user}}」 로 잠긴 색은 나 — src/addons/tts/src/speakers.js resolveSpeaker · resolveAll · colorTable · ownerOfColor.
//   카드 팔레트에 내 색이 「{{user}}: #색」 으로 적혀 있으면 색 표의 이름이 매크로 글자 그대로 잠긴다. 전엔 그 이름이 페르소나 이름과 달라
//   「{{user}}」 라는 모르는 캐릭터로 풀려(isUser false) 대사가 캐릭터 길로 가고 목소리가 없어 「목소리를 먼저 정해요」 가 떴다.
//   실리태번 모듈은 data: 스텁(tts-color-rename.mjs 와 같은 방식). 지어낸 인물 · 색만 쓴다. 네트워크 없음.
//   node tools/tests/tts-user-macro.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsUserMacroTest = { ext: {}, ctx: null };
const G = 'const T = globalThis.__ttsUserMacroTest;\n';
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
// 페르소나 이름(하람)은 팔레트 어디에도 안 나온다 — 내 색은 「{{user}}」 매크로로만 적혀 있다
T.ctx = { chat: [], chatMetadata: {}, name1: '하람', name2: '미나', characterId: 0, groupId: null, groups: [], chatCompletionSettings: {},
    characters: [{ avatar: 'mina.png', name: '미나', description: '팔레트\n- {{user}}: #424c59\n- 미나: #3ccfbf\n- 렉스: #0000ff' }] };
SP._setContextForTest(() => T.ctx, () => {});
const row = color => SP.colorTable().find(r => r.color === color);
const rctx = { userName: '하람', charName: '미나', mes: { name: '미나', is_user: false } };

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('팔레트의 「{{user}}」 줄은 그 글자대로 잠긴다 (예전 그대로)', () => {
    SP.importPalette({ deferSave: true });
    const r = row('#424c59');
    assert.equal(r.name, '{{user}}'); assert.equal(r.locked, true);
});

t('「{{user}}」 색의 대사는 나 — 이름은 페르소나 이름, isUser true (전엔 「{{user}}」 캐릭터 · isUser false)', () => {
    const r = SP.resolveSpeaker({ color: '#424C59' }, rctx);
    assert.equal(r.name, '하람'); assert.equal(r.isUser, true); assert.equal(r.source, 'palette');
});

t('다른 색은 그대로 캐릭터 (회귀 없음)', () => {
    const a = SP.resolveSpeaker({ color: '#3ccfbf' }, rctx);
    assert.equal(a.name, '미나'); assert.equal(a.isUser, false);
    const b = SP.resolveSpeaker({ color: '#0000ff' }, rctx);
    assert.equal(b.name, '렉스'); assert.equal(b.isUser, false);
    const c = SP.resolveSpeaker({ color: '#123456' }, rctx);
    assert.equal(c.source, 'sender'); assert.equal(c.name, '미나');
});

t('색 표 · 내 색 · 색 임자도 나로 본다', () => {
    assert.equal(row('#424c59').isUser, true, 'colorTable isUser');
    assert.equal(SP.userColor(), '#424c59', '잠긴 「{{user}}」 색이 내 색');
    assert.equal(SP.ownerOfColor('#424c59'), '하람', 'ownerOfColor 는 페르소나 이름');
    assert.equal(row('#3ccfbf').isUser, false);
});

t('페르소나 이름을 모를 때(빈 이름)도 isUser 는 true — 이름만 매크로 그대로', () => {
    const r = SP.resolveSpeaker({ color: '#424c59' }, { userName: '', charName: '미나', mes: { name: '미나', is_user: false } });
    assert.equal(r.isUser, true);
});

console.log(`tts-user-macro: ${n} passed, 0 failed`);
