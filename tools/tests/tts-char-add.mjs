// TTS 인물 추가 · 다른 이름 — 목소리 탭 › 캐릭터별 목소리 맨 아래 「인물 추가」(src/addons/tts/src/ui.js addCharacter · mapAddHtml),
//   설정 char_aliases(settings.js normCharAliases), 별명표(speakers.js) · 목소리 찾기(voices.js voiceFor).
//   대화 색 · 캐릭터 카드에 없는 인물도 이름과 목소리를 직접 정하고, 「미나, Mina, 미나쨩」처럼 쉼표로 적은 다른 이름도 같은 목소리로 읽어요.
//   예전 설정(char_aliases 없음)은 그대로 열리고 연결표 · 목소리는 바뀌지 않아요. 전엔 이름을 직접 넣는 칸이 없었어요(색 · 카드 · 분석에 나온 이름만).
//   실리태번 모듈은 data: 스텁, 가짜 DOM 은 아주 작게. 인물 · 목소리는 지어낸 것. 네트워크 없음.
//   node tools/tests/tts-char-add.mjs <테마 루트>
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const mod = (name) => pathToFileURL(path.join(root, name)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const OLD = {   // 예전 사용자 설정 (char_aliases 없음)
    version: 8,
    voices: [
        { uid: 'browser:v-a', provider: 'browser', voiceId: 'v-a', name: '맑은 목소리' },
        { uid: 'browser:v-b', provider: 'browser', voiceId: 'v-b', name: '낮은 목소리' },
        { uid: 'browser:v-c', provider: 'browser', voiceId: 'v-c', name: '렉스', aliases: ['Rex'] },
    ],
    char_map: { '미나': 'browser:v-a' },
    default_voice: 'browser:v-b',
};
const T = globalThis.__ttsCharAdd = {
    ext: { lemon_voice: JSON.parse(JSON.stringify(OLD)) },
    ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '미나', characters: [{ name: '미나', avatar: 'mina.png' }], characterId: 0, groupId: null, groups: [], chatCompletionSettings: {} },
    toasts: [],
};
const G = 'const T = globalThis.__ttsCharAdd;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? ''); export function getRequestHeaders() { return {}; } export function saveSettingsDebounced() {} export async function saveSettings() {}
export const main_api = 'openai'; export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + 'export const extension_settings = T.ext; export const extensionNames = []; export function getContext() { return T.ctx; } export function saveMetadataDebounced() {}'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }; export async function callGenericPopup() { return 1; }'),
    'utils.js': js('export function getStringHash(s) { let h = 0; for (const c of String(s ?? "")) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export function splitRecursive(t) { return [String(t ?? "")]; }'),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').includes('/addons/tts/')) { const base = spec.split('/').pop(); if (spec.split('../').length - 1 >= 3 && S[base]) return { url: S[base], shortCircuit: true }; }
    return next(spec, ctx);
}`), { data: { st: ST } });
const LS = new Map();
globalThis.localStorage = { getItem: (k) => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => LS.set(k, String(v)), removeItem: (k) => LS.delete(k), clear: () => LS.clear() };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const rec = (kind) => (msg) => T.toasts.push({ kind, msg: String(msg) });
globalThis.toastr = { success: rec('success'), warning: rec('warning'), error: rec('error'), info: rec('info') };
const nodeStub = () => ({ querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, addEventListener() {}, removeEventListener() {}, append() {}, appendChild() {}, style: { setProperty() {} }, dataset: {} });
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, createElement: () => nodeStub(), createTextNode: (t) => ({ textContent: String(t) }), body: nodeStub(), visibilityState: 'visible' };
globalThis.window = { toastr: globalThis.toastr, addEventListener() {}, removeEventListener() {}, innerHeight: 900, speechSynthesis: { getVoices: () => [], addEventListener() {}, removeEventListener() {}, speak() {}, cancel() {} } };
globalThis.CSS = { escape: (s) => String(s) };
globalThis.HTMLElement = class {};

const S = await import(mod('settings.js'));
const V = await import(mod('voices.js'));
const SP = await import(mod('speakers.js'));
const ui = await import(mod('ui.js'));
const F = ui._forTest || {};
SP._setContextForTest(() => T.ctx, () => {});

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const s = S.settings();
const voiceOf = (name) => V.voiceFor(name)?.uid || '';

t('예전 설정은 그대로 열려요: char_aliases 는 빈 표, 연결표 · 목소리 · 기본 목소리는 그대로', () => {
    assert.deepEqual(s.char_aliases, {});
    assert.deepEqual(s.char_map, OLD.char_map);
    assert.deepEqual(s.voices.map(v => v.uid), OLD.voices.map(v => v.uid));
    assert.equal(s.default_voice, OLD.default_voice);
    assert.equal(voiceOf('미나'), 'browser:v-a');
    assert.equal(voiceOf('Rex'), 'browser:v-c', '목소리의 다른 이름은 전처럼');
});
t('normCharAliases: 모르는 모양 · 빈 이름 · 겹침 · 열쇠 자신은 버리고 길이를 지켜요', () => {
    assert.deepEqual(S.normCharAliases(null), {});
    assert.deepEqual(S.normCharAliases({ a: 'x' }), {});
    assert.deepEqual(S.normCharAliases({ '미나': ['Mina', ' mina ', '', 3, '미나', '미나쨩'] }), { '미나': ['Mina', '미나쨩'] });
    const many = S.normCharAliases({ k: Array.from({ length: 30 }, (_, i) => `n${i}`) });
    assert.equal(many.k.length, S.ALIAS_LIMIT.per);
    assert.equal(S.normCharAliases({ k: ['x'.repeat(99)] }).k[0].length, S.ALIAS_LIMIT.chars);
});
t('인물 추가 칸이 캐릭터별 목소리 카드 맨 아래에 있어요 (이름 칸 · 목소리 고르기 · 추가 단추)', () => {
    const html = F.mapCardHtml();
    assert.match(html, /class="lv-row lv-map-add"/);
    assert.match(html, /data-lv-map-new[ >]/);
    assert.match(html, /data-lv-map-new-voice/);
    assert.match(html, /data-lv-act="map-add"/);
});
t('이름이 없거나 목소리를 안 고르면 추가하지 않아요', () => {
    assert.equal(F.addCharacter('', 'browser:v-b').ok, false);
    assert.equal(F.addCharacter(' , ', 'browser:v-b').ok, false);
    assert.equal(F.addCharacter('유나', '').ok, false);
    assert.equal(F.addCharacter('유나', 'browser:없음').ok, false);
    assert.equal(s.char_map['유나'], undefined);
});
t('「유나, Yuna, 유나쨩」 → 연결표 유나 + 다른 이름 둘, 다른 이름으로도 같은 목소리', () => {
    const r = F.addCharacter('유나, Yuna,  유나쨩 ', 'browser:v-b');
    assert.equal(r.ok, true); assert.equal(r.name, '유나');
    assert.equal(s.char_map['유나'], 'browser:v-b');
    assert.deepEqual(s.char_aliases['유나'], ['Yuna', '유나쨩']);
    assert.equal(SP.canon('Yuna'), '유나');
    assert.equal(voiceOf('yuna'), 'browser:v-b');
    assert.equal(voiceOf('유나쨩'), 'browser:v-b');
    assert.ok(SP.knownNames().includes('Yuna'), '이름표 · 화자 찾기가 아는 이름');
});
t('카드 인물(미나)에 다른 이름 붙이기: 적은 이름 가운데 아는 사람에 붙여요 · 다른 인물(렉스) 연결표 이름은 다른 이름으로 받지 않아요', () => {
    s.char_map['렉스'] = 'browser:v-c';
    const r = F.addCharacter('Mina, 미나, 렉스', 'browser:v-a', { cardNames: ['미나'] });
    assert.equal(r.ok, true); assert.equal(r.name, '미나');
    assert.deepEqual(r.skipped, ['렉스']);
    assert.deepEqual(s.char_aliases['미나'], ['Mina']);
    assert.equal(voiceOf('Mina'), 'browser:v-a');
    assert.equal(voiceOf('렉스'), 'browser:v-c', '렉스는 그대로 렉스 목소리');
});
t('같은 사람을 다시 추가하면 다른 이름을 합쳐요 (겹침 없음)', () => {
    F.addCharacter('유나, 유나쨩, 윤아', 'browser:v-b');
    assert.deepEqual(s.char_aliases['유나'], ['Yuna', '유나쨩', '윤아']);
});
t('알약에 다른 이름이 보이고, 카드 인물의 다른 이름은 따로 뺄 수 있어요', () => {
    const html = F.mapCardHtml();
    assert.match(html, /유나 \(Yuna, 유나쨩, 윤아\) →/);
    assert.match(html, /미나 = Mina/);
    assert.match(html, /data-lv-act="alias-remove" data-name="미나"/);
    F.ACTIONS()['alias-remove']({ dataset: { name: '미나' } });
    assert.equal(s.char_aliases['미나'], undefined);
    assert.equal(s.char_map['미나'], 'browser:v-a', '목소리 연결은 그대로');
});
t('알약 빼기는 연결과 다른 이름을 함께 지워요', () => {
    F.ACTIONS()['map-remove']({ dataset: { name: '유나' } });
    assert.equal(s.char_map['유나'], undefined);
    assert.equal(s.char_aliases['유나'], undefined);
    assert.notEqual(SP.canon('Yuna'), '유나');
});
t('추가 단추: 칸의 글 · 고른 목소리로 추가하고 알려 줘요', () => {
    const box = { querySelector: (q) => (q === '[data-lv-map-new]' ? { value: '세라, Sera' } : q === '[data-lv-map-new-voice]' ? { value: 'browser:v-a' } : null) };
    F.ACTIONS()['map-add']({ closest: () => box, dataset: {} });
    assert.equal(s.char_map['세라'], 'browser:v-a');
    assert.deepEqual(s.char_aliases['세라'], ['Sera']);
    assert.ok(T.toasts.some(x => x.kind === 'success' && x.msg.includes('세라')), JSON.stringify(T.toasts));
});
t('캐릭터 이름 바꾸기는 다른 이름도 새 이름으로 복사해요 (연결 수에는 안 셈)', () => {
    const o = { char_map: { '세라': 'browser:v-a' }, char_aliases: { '세라': ['Sera'] } };
    const r = SP.renameCharacterKeys(o, { oldName: '세라', newName: '세레나' });
    assert.equal(r.voices, 1);
    assert.deepEqual(o.char_aliases['세레나'], ['Sera']);
    assert.notEqual(o.char_aliases['세레나'], o.char_aliases['세라'], '배열은 복사');
});

console.log(`\ntts-char-add: ${n} passed, 0 failed`);
