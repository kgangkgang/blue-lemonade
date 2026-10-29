// TTS 같은 색을 여러 인물이 쓸 때 — src/addons/tts/src/speakers.js resolveSpeaker: 대사에 아는 다른 인물의 이름표(「렉스: "…"」 · character="렉스")가
//   있으면 색 임자보다 이름표가 먼저예요 (전엔 「- 조연: #aaaaaa」 처럼 여럿이 같이 쓰는 색이면 이름표가 있어도 색 임자 목소리). 같은 사람의 다른 표기 · 모르는 이름표 ·
//   이름표 없는 대사는 전처럼 색이 정해요.
//   실리태번 모듈은 data: 스텁(tts-color-rename.mjs 와 같은 방식). 지어낸 인물 · 색만 쓴다. 네트워크 없음.
//   node tools/tests/tts-shared-color.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsSharedColorTest = { ext: {}, ctx: null };
const G = 'const T = globalThis.__ttsSharedColorTest;\n';
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
    characters: [{ avatar: 'mina.png', name: '미나', description: '팔레트\n- 미나/Mina: #ff0000\n- 렉스: #0000ff\n- 조연: #aaaaaa\n- {{user}}: #00ff00' }] };
SP._setContextForTest(() => T.ctx, () => {});
SP.importPalette({ deferSave: true });
const R = { userName: '하람', charName: '미나' };
const who = (seg) => SP.resolveSpeaker({ kind: 'dialogue', ...seg }, R);

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('여럿이 쓰는 색(조연)에 아는 다른 인물 이름표(렉스) → 렉스', () => {
    const p = who({ color: '#aaaaaa', speakerHint: '렉스' });
    assert.equal(p.name, '렉스'); assert.equal(p.source, 'hint'); assert.equal(p.isUser, false);
});
t('미나 색에 렉스 이름표 → 렉스 (이름표가 색보다 먼저)', () => {
    assert.equal(who({ color: '#ff0000', speakerHint: '렉스' }).name, '렉스');
});
t('같은 사람의 다른 표기(Mina) 이름표 → 색 그대로 (팔레트)', () => {
    const p = who({ color: '#ff0000', speakerHint: 'Mina' });
    assert.equal(p.name, '미나'); assert.equal(p.source, 'palette');
});
t('모르는 이름표는 색을 이기지 않는다', () => {
    const p = who({ color: '#ff0000', speakerHint: '지나가던사람' });
    assert.equal(p.name, '미나'); assert.equal(p.source, 'palette');
});
t('8.2.7 속마음 라벨로 배우기만 한 다른 표기(Mina · 박미나)는 색을 이기지 않는다 (색 기반 목소리 그대로)', () => {
    const st = T.ctx.chatMetadata.lemon_voice;
    const before = st.names;
    st.names = { ...(st.names || {}), Mina: 3, 박미나: 2 };
    try {
        for (const hint of ['Mina', '박미나']) {
            for (const kind of ['dialogue', 'thought']) {
                const p = SP.resolveSpeaker({ kind, color: '#ff0000', speakerHint: hint }, R);
                assert.equal(p.name, '미나', `${kind} ${hint}`); assert.equal(p.source, 'palette');
            }
        }
    } finally { st.names = before; }
});
t('8.2.7 인물 추가(연결표)로 정한 이름표는 색보다 먼저', () => {
    const s = settings();
    s.char_map['세라'] = 'v-sera';
    try { assert.equal(who({ color: '#ff0000', speakerHint: '세라' }).name, '세라'); }
    finally { delete s.char_map['세라']; }
});
t('이름표 없는 대사는 전처럼 색', () => {
    assert.equal(who({ color: '#aaaaaa' }).name, '조연');
    assert.equal(who({ color: '#0000ff' }).name, '렉스');
});
t('조연 색에 내 이름표(하람) → 나', () => {
    const p = who({ color: '#aaaaaa', speakerHint: '하람' });
    assert.equal(p.name, '하람'); assert.equal(p.isUser, true);
});
t('내 색({{user}})에 내 이름표 → 나 그대로, 렉스 이름표 → 렉스', () => {
    const me = who({ color: '#00ff00', speakerHint: '하람' });
    assert.equal(me.name, '하람'); assert.equal(me.isUser, true); assert.equal(me.source, 'palette');
    const rex = who({ color: '#00ff00', speakerHint: '렉스' });
    assert.equal(rex.name, '렉스'); assert.equal(rex.isUser, false);
});
t('그룹 멤버 이름(색 표에 없음)도 아는 이름', () => {
    T.ctx = { ...T.ctx, groupId: 'g1', groups: [{ id: 'g1', members: ['mina.png', 'yuna.png'] }],
        characters: [...T.ctx.characters, { avatar: 'yuna.png', name: '유나', description: '' }] };
    assert.equal(who({ color: '#aaaaaa', speakerHint: '유나' }).name, '유나');
});

console.log(`tts-shared-color: ${n} passed, 0 failed`);
