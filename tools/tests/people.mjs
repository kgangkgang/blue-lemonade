// 6.9.5 인물표 — src/people.js (이름 다리의 people 칸) · 번역 애드온 다리와 같이 · TTS 공급자(대사 색 · 연결된 목소리 · 별명표 표기)
//   node tools/tests/people.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const url = rel => pathToFileURL(path.join(themeRoot, rel)).href;
const KEY = Symbol.for('blue-lemonade.names');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const doc = new EventTarget();
globalThis.document = doc;
const P = await import(url('src/people.js'));
const B = await import(url('src/addons/translator/names-bridge.js'));
const A = await import(url('src/name-aliases.js'));
const E = (src, dst, scope = 'x.png') => ({ id: src, scope, src, dst });

await test('모양: version 1 · get · list · onChange, 얼린 객체 · 번역 애드온 다리에 같은 객체로 붙는다 (다리는 그대로 version 1)', () => {
    assert.equal(P.people.version, 1);
    assert.ok(Object.isFrozen(P.people));
    const api = B.buildNames(B.namePairs([E('Corvin, コルヴィン', '코르빈')]));
    assert.equal(api.version, 1);
    assert.equal(api.people, P.people);
    assert.deepEqual(api.aliasesOf('Corvin'), ['코르빈', 'コルヴィン']);
});

await test('get: 다리의 다른 표기만 아는 이름 · 모르는 이름은 null · 빈 이름은 null', () => {
    globalThis[KEY] = B.buildNames(B.namePairs([E('Corvin, コルヴィン', '코르빈')]));
    const p = P.people.get(' 코르빈 ');
    assert.deepEqual({ ...p, names: [...p.names] }, { name: '코르빈', names: ['코르빈', 'Corvin', 'コルヴィン'], color: null, voice: null });
    assert.ok(Object.isFrozen(p) && Object.isFrozen(p.names));
    assert.equal(P.people.get('Nobody'), null);
    assert.equal(P.people.get('  '), null);
    delete globalThis[KEY];
});

await test('공급자: 색(소문자 #rrggbb 만) · 목소리(uid 있는 것만, 필요한 칸만) · 표기를 합친다 · 먼저 등록한 공급자가 먼저 · 던지면 건너뛴다', () => {
    const seen = [];
    const off1 = P.registerPeopleSource('one', { person(names) { seen.push(names); return names.includes('Mina') ? { names: ['미나'], color: '#AABBCC', voice: { uid: 'minimax:v1', name: 'Mina voice', provider: 'minimax', secret: 'x' } } : null; }, names: () => ['Mina'] });
    const off2 = P.registerPeopleSource('two', { person: () => ({ color: '#112233', voice: { uid: 'other' }, names: ['ミナ'] }) });
    const off3 = P.registerPeopleSource('bad', { person() { throw new Error('boom'); } });
    const p = P.people.get('Mina');
    assert.deepEqual([...p.names], ['Mina', '미나', 'ミナ']);
    assert.equal(p.color, '#aabbcc');
    assert.deepEqual({ ...p.voice }, { uid: 'minimax:v1', name: 'Mina voice', provider: 'minimax', lang: '' });
    assert.deepEqual(seen[0], ['Mina'], '공급자는 다리 표기까지 받는다');
    off2(); off3();
    const q = P.registerPeopleSource('badcolor', { person: () => ({ color: 'red; x', voice: { name: 'no uid' } }) });
    assert.equal(P.people.get('Rex'), null, '쓸 수 없는 색 · uid 없는 목소리 · 표기 하나뿐 → null');
    q(); off1();
    assert.equal(P.people.get('Mina'), null, '공급자를 빼면 모르는 이름');
});

await test('list: 색이나 목소리를 아는 사람만 · 같은 사람(다른 표기)은 한 번 · 공급자 차례', () => {
    globalThis[KEY] = B.buildNames(B.namePairs([E('Rowan', '로완'), E('Guild', '길드')]));
    const off = P.registerPeopleSource('tts-like', {
        person: names => names.some(n => ['Rowan', '로완'].includes(n)) ? { color: '#30a0a0' } : names.includes('Hero') ? { voice: { uid: 'u1', name: 'Hero', provider: 'p' } } : null,
        names: () => ['로완', 'Rowan', 'Hero', 'Ghost', '길드'],
    });
    assert.deepEqual(P.people.list().map(p => [p.name, [...p.names], p.color, p.voice?.uid ?? null]), [['로완', ['로완', 'Rowan'], '#30a0a0', null], ['Hero', ['Hero'], null, 'u1']]);
    off(); delete globalThis[KEY];
});

await test('번역 애드온이 꺼져 있어도: 공급자가 등록되면 짝 없는 다리를 세워 people 를 단다 — 짝이 오면 번역 애드온 다리로, 같은 people', () => {
    delete globalThis[KEY];
    const off = P.registerPeopleSource('x', { person: () => null });
    const stub = globalThis[KEY];
    assert.equal(stub.version, 1); assert.equal(stub.people, P.people); assert.deepEqual(stub.pairs, []); assert.deepEqual(stub.groups(), []);
    assert.deepEqual(A.nameAliases('Rowan'), [], '이름 다리를 쓰던 쪽(다른 표기)은 예전처럼 빈 목록');
    assert.equal(B.publishNames([], { host: globalThis, doc: () => doc }), stub, '짝이 없으면 그대로');
    const real = B.publishNames([E('Rowan', '로완')], { host: globalThis, doc: () => doc });
    assert.notEqual(real, stub); assert.equal(globalThis[KEY].people, P.people);
    off(); delete globalThis[KEY];
});

await test('알림: 여러 번 바뀌어도 한 번 (bl:people-changed, detail = people) · 이름 다리가 바뀌어도 · 끊기', async () => {
    let n = 0, detail = null;
    const off = P.people.onChange(d => { n++; detail = d; });
    await sleep(200); n = 0;
    P.peopleChanged(); P.peopleChanged(); P.peopleChanged();
    await sleep(200);
    assert.equal(n, 1); assert.equal(detail, P.people);
    const offSource = P.registerPeopleSource('y', { person: () => null });   // 이름 다리 알림을 듣기 시작
    await sleep(200); n = 0;
    doc.dispatchEvent(new CustomEvent('bl:names-changed', { detail: null }));
    await sleep(200);
    assert.equal(n, 1, 'names-changed → people-changed');
    off(); offSource(); await sleep(200); n = 0;
    P.peopleChanged(); await sleep(200);
    assert.equal(n, 0, '끊은 뒤에는 안 부른다');
    delete globalThis[KEY];
});

// ── TTS: 공급자가 쓰는 것 (names-bridge.mjs 와 같은 실리태번 스텁) ──
const ttsRoot = path.join(themeRoot, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__peopleTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'Hero', name2: 'Rowan', characters: [{ name: 'Rowan', avatar: 'rowan.png' }], characterId: 0 } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__peopleTest;\n';
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
const { settings, toVoice, USER_AUTO } = await import(pathToFileURL(path.join(ttsRoot, 'settings.js')).href);
const SP = await import(pathToFileURL(path.join(ttsRoot, 'speakers.js')).href);
const V = await import(pathToFileURL(path.join(ttsRoot, 'voices.js')).href);
const s = settings();
s.voices.push(toVoice({ voiceId: 'v_row', name: 'Rowan voice' }), toVoice({ voiceId: 'v_mina', name: 'Mina', aliases: ['미나'] }), toVoice({ voiceId: 'v_me', name: 'My voice' }), toVoice({ voiceId: 'v_def', name: 'Default voice' }));
const uid = id => s.voices.find(v => v.uid.endsWith(id)).uid;
s.char_map = { Rowan: uid('v_row') };
s.default_voice = uid('v_def');
T.ctx.chatMetadata.lemon_voice = { colors: { '#30a0a0': { name: 'Rowan', locked: true, count: 2, votes: {}, tvotes: {}, aliases: ['로완'] }, '#c06080': { name: 'Mina', locked: false, count: 5, votes: {}, tvotes: {} } }, names: {}, learned: {}, seeded: true };

await test('TTS 연결된 목소리: 연결표 · 목소리 이름 · 별명 · 별명표 대표 — 기본 · 엑스트라 목소리는 「연결」이 아니라 null · 나는 내 목소리 칸이 있을 때만', () => {
    assert.equal(V.linkedVoice('Rowan')?.uid, uid('v_row'));
    assert.equal(V.linkedVoice('로완')?.uid, uid('v_row'), '색 표 별명 → 대표 이름 → 연결표');
    assert.equal(V.linkedVoice('미나')?.uid, uid('v_mina'));
    assert.equal(V.linkedVoice('Stranger'), null);
    assert.equal(V.voiceFor('Stranger')?.uid, uid('v_def'), '읽을 때는 기본 목소리 (인물표와 다름)');
    s.user_voice = USER_AUTO; assert.equal(V.linkedVoice('Hero', { isUser: true }), null);
    s.user_voice = uid('v_me'); assert.equal(V.linkedVoice('Hero', { isUser: true })?.uid, uid('v_me'));
    s.user_voice = '';
});
await test('TTS 표기 · 목록 후보 · 나: 별명표의 같은 사람 표기 · 색 표 이름(정해 둔 것 먼저) · 카드 · 페르소나', () => {
    assert.deepEqual(SP.namesOf('로완'), ['Rowan', '로완']);
    assert.deepEqual(SP.namesOf('Nobody'), ['Nobody']);
    assert.deepEqual(SP.peopleNames(), ['Rowan', 'Mina', 'Rowan', 'Hero']);
    assert.equal(SP.isPersonaName('hero'), true); assert.equal(SP.isPersonaName('Rowan'), false);
    assert.equal(SP.colorOfName('로완'), '#30a0a0');
});

await test('TTS 연결 · 알림: 켜질 때 등록 · 채팅 · 켜고 끔 · 목소리 설정 · 색 표가 바뀌면 인물표 알림 · 꺼져 있으면 아무것도 안 줌', () => {
    const index = read('src/addons/tts/index.js');
    assert.match(index, /registerPeopleSource\('tts', peopleSource\);/);
    assert.match(index, /person\(names\) \{\s*if \(!runtimeEnabled\(\)\) return null;/);
    assert.match(index, /names\(\) \{ return runtimeEnabled\(\) \? speakers\.peopleNames\(\) : \[\]; \}/);
    assert.match(index, /voice: voice \? \{ uid: voice\.uid, name: voice\.name, provider: voice\.provider, lang: voice\.lang \|\| '' \} : null/);
    assert.equal((index.match(/peopleChanged\(\);/g) || []).length, 2);
    assert.match(read('src/addons/tts/src/settings.js'), /export const save = \(\) => \{ saveSettingsDebounced\(\); peopleChanged\(\); \};/);
    assert.match(read('src/addons/tts/src/speakers.js'), /catch \(e\) \{ console\.error\('\[TTS\] 채팅 메타 저장 실패', e\); \}\s*peopleChanged\(\);/);
    for (const rel of ['src/people.js', 'src/addons/translator/names-bridge.js']) assert.ok(!/\btitle=/.test(read(rel)));
});

delete globalThis.__peopleTest;
console.log(`people: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
