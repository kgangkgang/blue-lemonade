// 6.3.5 이름 다리 — src/addons/translator/names-bridge.js (순수) · TTS speakers.js 가 다리를 합쳐 쓰는지 (tts-paint.mjs 와 같은 스텁)
//   node tools/tests/names-bridge.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = (rel) => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const B = await import(pathToFileURL(path.join(themeRoot, 'src/addons/translator/names-bridge.js')).href);
const KEY = Symbol.for('blue-lemonade.names');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const E = (src, dst, scope = 'x.png') => ({ id: src, scope, src, dst });

await test('이름꼴: 12자 이하 · 글자와 사이 공백만 · 라틴은 첫 글자 대문자', () => {
    for (const ok of ['Corvin', 'Ann Marie', '코르빈', 'コルヴィン', 'Mc Gee', '하늘정원']) assert.equal(B.isNameLike(ok), true, ok);
    for (const no of ['corvin', 'office', 'Sky Tower And River-side Office', "O'Neil", 'Jean-Luc', 'Room 101', '…', '', '  ', 'A1', '코르빈 사무실 입구 안내문']) assert.equal(B.isNameLike(no), false, no);
    assert.deepEqual(B.nameForms(' Corvin, コルヴィン ,corvin,,'), ['Corvin', 'コルヴィン']);
});

await test('용어집 → 이름 짝: 양쪽 다 이름꼴인 표기끼리, 보통 말 · 긴 말은 빠짐, 같은 짝은 한 번', () => {
    const pairs = B.namePairs([
        E('Corvin, コルヴィン', '코르빈', 'global'), E('Cor, コル', '코르'), E('office', '사무실'), E('Guild', '길드, 조합'),
        E('Sky Tower And River-side Office', '하늘관리청'), E('Corvin', '코르빈'), { src: 'Mina', dst: '미나' }, null, { src: 5, dst: '다섯' },
    ]);
    assert.deepEqual(pairs, [
        { src: 'Corvin', dst: '코르빈', scope: 'global' }, { src: 'コルヴィン', dst: '코르빈', scope: 'global' },
        { src: 'Cor', dst: '코르', scope: 'x.png' }, { src: 'コル', dst: '코르', scope: 'x.png' },
        { src: 'Guild', dst: '길드', scope: 'x.png' }, { src: 'Guild', dst: '조합', scope: 'x.png' },
        { src: 'Mina', dst: '미나', scope: '' },
    ]);
});

await test('묶음 · aliasesOf: 같은 표기로 이어지면 한 인물, 대소문자 · 앞뒤 공백 무시, 자기 자신 제외, 모르면 []', () => {
    const api = B.buildNames(B.namePairs([E('Corvin, コルヴィン', '코르빈'), E('코르빈', 'コルビン'), E('Mina', '미나')]));
    assert.equal(api.version, 1);
    assert.deepEqual(api.aliasesOf('corvin'), ['코르빈', 'コルヴィン', 'コルビン']);
    assert.deepEqual(api.aliasesOf(' 코르빈 '), ['Corvin', 'コルヴィン', 'コルビン']);
    assert.deepEqual(api.aliasesOf('미나'), ['Mina']);
    assert.deepEqual(api.aliasesOf('Nobody'), []);
    assert.deepEqual(api.groups().map(g => g.length).sort(), [2, 4]);
    assert.ok(Object.isFrozen(api) && Object.isFrozen(api.pairs), 'frozen');
});

await test('publishNames: 전역에 내놓고 바뀔 때만 알린다 (같으면 같은 객체 · 알림 없음) · onChange 구독 · 해제', () => {
    const host = {};
    const listeners = new Map(); let dispatched = [];
    const doc = { addEventListener: (n, f) => listeners.set(f, n), removeEventListener: (n, f) => listeners.delete(f), dispatchEvent(ev) { dispatched.push(ev.type); for (const [f, n] of listeners) if (n === ev.type) f(ev); return true; } };
    const entries = [E('Rowan', '로완')];
    const first = B.publishNames(entries, { host, doc: () => doc });
    assert.equal(host[KEY], first); assert.deepEqual(dispatched, ['bl:names-changed']);
    const got = [];
    const off = first.onChange(api => got.push(api.pairs.length));
    assert.equal(B.publishNames([...entries], { host, doc: () => doc }), first, 'same pairs → same object');
    assert.deepEqual(dispatched, ['bl:names-changed'], 'no second event');
    const second = B.publishNames([...entries, E('Mina', '미나')], { host, doc: () => doc });
    assert.notEqual(second, first); assert.equal(host[KEY], second); assert.deepEqual(got, [2]); assert.equal(dispatched.length, 2);
    off();
    B.publishNames([], { host, doc: () => doc });
    assert.deepEqual(got, [2], 'unsubscribed'); assert.equal(host[KEY].pairs.length, 0);
    const h2 = {}; let docCalls = 0; const before = dispatched.length;
    const lone = B.publishNames([E('Mina', '미나')], { host: h2, doc: () => { docCalls++; return null; } });
    assert.equal(h2[KEY], lone, 'no document → still publishes'); assert.equal(lone.pairs.length, 1); assert.equal(docCalls, 1); assert.equal(dispatched.length, before);
    // 범위만 다른 같은 짝(다른 캐릭터로 바꿈) · 대소문자만 고친 짝 → 새 객체와 알림
    const a = B.publishNames([E('Rowan', '로완', 'a.png')], { host, doc: () => doc });
    const b = B.publishNames([E('Rowan', '로완', 'b.png')], { host, doc: () => doc });
    assert.notEqual(b, a); assert.equal(host[KEY].pairs[0].scope, 'b.png', 'scope follows the open character');
    const c = B.publishNames([E('ROWAN', '로완', 'b.png')], { host, doc: () => doc });
    assert.notEqual(c, b); assert.equal(host[KEY].pairs[0].src, 'ROWAN', 'spelling follows the glossary');
    assert.equal(B.publishNames([E('ROWAN', '로완', 'b.png')], { host, doc: () => doc }), c, 'identical → same object');
});

await test('번역 애드온이 내놓는 자리: 설정 읽을 때 · 용어집 다시 그릴 때 · 설정 저장마다 (서명 같으면 아무 일 없음) · 용어집 끄면 빈 다리 · CI 등록', () => {
    const js = read('src/addons/translator/index.js');
    assert.match(js, /import \{ publishNames \} from '\.\/names-bridge\.js';/);
    assert.equal((js.match(/publishGlossaryNames\(\);/g) || []).length, 4, 'loadSettings · CHAT_CHANGED (at once) · renderGlossary · SETTINGS_UPDATED');
    assert.match(js, /CHAT_CHANGED, function \(\) \{\s*publishGlossaryNames\(\);/, 'republished synchronously on chat change');
    assert.match(js, /function renderGlossary\(\) \{\s*publishGlossaryNames\(\);/);
    assert.match(js, /SETTINGS_UPDATED, function \(\) \{\s*publishGlossaryNames\(\);/);
    assert.match(js, /function publishGlossaryNames\(\) \{\s*publishNames\(extensionSettings\.glossary_enabled === false \? \[\] : activeGlossaryEntries\(\)\);\s*\}/, 'glossary off → empty bridge, else the translator scope');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/names-bridge\.mjs \./);
});

// ── TTS: 별명표가 다리를 합쳐 쓴다 ──
const root = path.join(themeRoot, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__namesBridgeTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'Hero', name2: 'Narrator' } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__namesBridgeTest;\n';
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
const SP = await import(pathToFileURL(path.join(root, 'speakers.js')).href);
const s = settings();
s.voices.push(toVoice({ voiceId: 'v_row', name: 'Rowan' }), toVoice({ voiceId: 'v_mina', name: 'Mina', aliases: ['미나'] }), toVoice({ voiceId: 'v_minerva', name: 'Minerva' }), toVoice({ voiceId: 'v_cor', name: 'Corvin' }));
s.char_map = { Rowan: 'minimax:v_row' };
T.ctx.chatMetadata.lemon_voice = { colors: { '#30a0a0': { name: 'Rowan', locked: true, count: 0, votes: {}, tvotes: {} } }, names: {}, learned: {} };
const bridge = pairs => { globalThis[KEY] = { version: 1, pairs }; };

await test('TTS: 다리가 없으면 예전 그대로 (한글 이름은 모르는 이름)', () => {
    delete globalThis[KEY];
    assert.equal(SP.canon('로완'), '로완');
    assert.equal(SP.colorOfName('로완'), null);
});

await test('TTS: 용어집 짝(Rowan ↔ 로완)으로 한글 이름이 인물 연결 열쇠의 별명이 된다 — 색도 그 사람 색', () => {
    bridge([{ src: 'Rowan', dst: '로완' }, { src: 'Nobody', dst: '아무개' }]);
    assert.equal(SP.canon('로완'), 'Rowan');
    assert.equal(SP.canon(' 로완 '), 'Rowan');
    assert.ok(SP.knownNames().includes('로완'), '서술에서도 찾는 이름');
    assert.equal(SP.colorOfName('로완'), '#30a0a0');
    assert.equal(SP.canon('아무개'), '아무개', '양쪽 다 모르는 짝은 그대로');
    assert.equal(SP.canon('Nobody'), 'Nobody');
});

await test('TTS: 사용자가 직접 넣은 별명이 먼저 — 다리가 다른 인물을 가리켜도 바꾸지 않는다', () => {
    bridge([{ src: 'Minerva', dst: '미나' }, { src: 'Mena', dst: '미나' }]);
    assert.equal(SP.canon('미나'), 'Mina', '목소리에 적은 별명 그대로');
    assert.equal(SP.canon('Mena'), 'Mina', '모르는 쪽은 아는 쪽(사용자 별명의 대표)으로');
    assert.equal(SP.canon('Minerva'), 'Minerva');
});

await test('TTS: 사슬 (Corvin ↔ 코르빈 ↔ コルヴィン) 은 두 번 돌아 잇는다 — 순서와 상관없이', () => {
    bridge([{ src: 'コルヴィン', dst: '코르빈' }, { src: 'Corvin', dst: '코르빈' }]);
    assert.equal(SP.canon('코르빈'), 'Corvin');
    assert.equal(SP.canon('コルヴィン'), 'Corvin');
});

await test('TTS: 다리 객체가 바뀌면 새 짝으로 (같은 객체는 접은 짝을 다시 씀)', () => {
    const one = Object.freeze({ version: 1, pairs: Object.freeze([{ src: 'Rowan', dst: '로완' }]) });
    globalThis[KEY] = one;
    assert.equal(SP.canon('로완'), 'Rowan');
    assert.equal(SP.canon('로완'), 'Rowan', 'same object again');
    globalThis[KEY] = Object.freeze({ version: 1, pairs: Object.freeze([]) });
    assert.equal(SP.canon('로완'), '로완', 'new empty bridge → the alias is gone');
    globalThis[KEY] = one;
    assert.equal(SP.canon('로완'), 'Rowan');
});

await test('TTS: 배운 속마음 라벨이 다리 별명을 가로채지 않는다 · 배운 이름끼리도 잇는다', () => {
    const lv = T.ctx.chatMetadata.lemon_voice;
    const saved = lv.names;
    try {
        bridge([{ src: 'Rowan', dst: 'ローワン' }, { src: 'Quill', dst: '퀼' }]);
        assert.equal(SP.canon('ローワン'), 'Rowan');
        lv.names = { ...(saved || {}), 'ローワン': 3, '퀼': 2 };   // 원문 속마음 라벨로 배운 이름 (대사 분석 · 이름표)
        assert.equal(SP.canon('ローワン'), 'Rowan', 'a learned label keeps the bridge alias');
        assert.equal(SP.canon('퀼'), '퀼', 'a learned name stays itself');
        assert.equal(SP.canon('Quill'), '퀼', 'the other spelling joins the learned name');
    } finally { lv.names = saved; delete globalThis[KEY]; }
});

await test('TTS: 두 인물이 나눠 쓰는 표기(Rina · Lina → リナ)는 누구에게도 안 붙는다 — 한 사람만 닿는 표기 · 직접 넣은 별명은 그대로 · 짝 순서와 상관없이', () => {
    const before = s.voices.length;
    s.voices.push(toVoice({ voiceId: 'v_rina', name: 'Rina' }), toVoice({ voiceId: 'v_lina', name: 'Lina', aliases: ['리나'] }));
    try {
        const pairs = [{ src: 'Rina', dst: 'リナ' }, { src: 'Lina', dst: 'リナ' }, { src: 'Rina', dst: '리나' }, { src: 'Rina', dst: 'リーナ' }, { src: 'リナ', dst: '리나쨩' }, { src: 'リーナ', dst: '리이나' }];
        for (const list of [pairs, pairs.slice().reverse()]) {
            bridge(list);
            assert.equal(SP.canon('リナ'), 'リナ', 'shared kana → nobody');
            assert.equal(SP.canon('리나쨩'), '리나쨩', 'chained only through the shared kana → nobody');
            assert.equal(SP.canon('リーナ'), 'Rina', 'one owner → that person');
            assert.equal(SP.canon('리이나'), 'Rina', 'chain through a one-owner spelling still joins');
            assert.equal(SP.canon('리나'), 'Lina', 'a typed voice alias wins over the bridge');
            assert.equal(SP.canon('Rina'), 'Rina');
        }
    } finally { s.voices.splice(before); delete globalThis[KEY]; }
});

await test('TTS: 한 사람이 대표 이름 둘(연결표의 두 열쇠 · 목소리 이름과 연결표 열쇠)로 알려져도 같은 목소리면 한글 표기는 그 목소리 — 서로 다른 목소리 · 없는 목소리는 그대로 모호 · 짝 순서와 상관없이', async () => {
    const V = await import(pathToFileURL(path.join(root, 'voices.js')).href);
    const before = s.voices.length, map0 = { ...s.char_map };
    s.voices.push(toVoice({ voiceId: 'v_one', name: 'One voice' }), toVoice({ voiceId: 'v_tove', name: 'Tove' }), toVoice({ voiceId: 'v_other', name: 'Other voice' }));
    const [one, tove, other] = s.voices.slice(before).map(v => v.uid);
    const pairs = [{ src: 'Rina', dst: '리나' }, { src: 'リナ', dst: '리나' }];
    try {
        s.char_map = { ...map0, Rina: one, 'リナ': one };   // 연결표의 두 열쇠가 같은 목소리
        for (const list of [pairs, pairs.slice().reverse()]) {
            bridge(list);
            assert.equal(V.voiceFor('리나')?.uid, one, 'same voice → that voice');
            assert.equal(V.hasOwnVoice('리나'), true);
            assert.equal(SP.canon('리나'), 'Rina', 'the name that comes first in the settings, whatever the pair order');
        }
        s.char_map = { ...map0, 'トーヴェ': tove };   // 목소리 이름과 연결표 열쇠가 같은 목소리
        for (const list of [[{ src: 'トーヴェ', dst: '토베' }, { src: 'Tove', dst: '토베' }], [{ src: 'Tove', dst: '토베' }, { src: 'トーヴェ', dst: '토베' }]]) {
            bridge(list);
            assert.equal(V.voiceFor('토베')?.uid, tove);
            assert.equal(SP.canon('토베'), 'トーヴェ', 'map keys come before voice names');
        }
        s.char_map = { ...map0, Rina: one, 'リナ': other };   // 서로 다른 목소리 → 그대로 모호
        for (const list of [pairs, pairs.slice().reverse()]) { bridge(list); assert.equal(SP.canon('리나'), '리나', 'two voices → nobody'); }
        s.char_map = { ...map0, Rina: 'minimax:gone', 'リナ': 'minimax:gone' };   // 없는 목소리 = 목소리 없는 서로 다른 이름 → 그대로 모호
        for (const list of [pairs, pairs.slice().reverse()]) { bridge(list); assert.equal(SP.canon('리나'), '리나', 'no voice → names stay apart'); }
    } finally { s.voices.splice(before); s.char_map = map0; delete globalThis[KEY]; }
});

await test('TTS: 깨진 다리(version 다름 · pairs 아님 · 빈 글)는 무시', () => {
    globalThis[KEY] = { version: 2, pairs: [{ src: 'Rowan', dst: '로완' }] };
    assert.equal(SP.canon('로완'), '로완');
    globalThis[KEY] = { version: 1, pairs: [{ src: '', dst: '로완' }, null, { src: 'Rowan' }] };
    assert.equal(SP.canon('로완'), '로완');
    delete globalThis[KEY];
});

await test('TTS 코드: 별명표(사용자 이름 뒤 · 배운 이름 앞 · 끝에서 한 번 더) · 팔레트 이름 고르기에도 다리', () => {
    const sp = read('src/addons/tts/src/speakers.js');
    assert.match(sp, /const bridge = \(\) => bridgeInto\(k => map\.has\(k\), k => map\.get\(k\), put\);\s*bridge\(\);\s*for \(const n of Object\.keys\(st\.names \|\| \{\}\)\) put\(n, n\);[^\n]*\n[^\n]*votes[^\n]*\n\s*bridge\(\);\s*return \{ pairs, map \};/, 'bridge before learned names, once more at the end');
    assert.match(sp, /bridgeInto\(k => known\.has\(k\), k => known\.get\(k\), \(n, c\) => \{ if \(!known\.has\(fold\(n\)\)\) known\.set\(fold\(n\), c\); \}\);/);
    assert.match(sp, /const bridgeFolded = new WeakMap\(\);/, 'pairs folded once per bridge object');
});

delete globalThis.__namesBridgeTest;
console.log(`names-bridge: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
