// 7.2.8 인물표 · 별명표 기억 — src/people.js get() 기억 · TTS speakers.js aliasTable 기억이 바뀌는 길마다 바로 비워지는지
//   node tools/tests/people-cache-728.mjs <테마 루트>
// 방법: 기억을 켠 채 답을 데워 두고 → 한 가지를 바꾸고 → 기억을 켠 답과 끈 답(매번 새로 만든 답)이 같은지 본다.
//       바꾼 것이 정말 답을 바꿨는지도 같이 본다 (안 바뀌면 그 길을 시험한 것이 아니다).
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
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const doc = new EventTarget();
globalThis.document = doc;

// ── 실리태번 스텁 (people.mjs 와 같다) ──
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__peopleCacheTest = { ext: {}, ctx: null };
const freshCtx = () => ({ chat: [], chatMetadata: {}, name1: 'Hero', name2: 'Rowan', characters: [{ name: 'Rowan', avatar: 'rowan.png' }], characterId: 0, chatCompletionSettings: { prompts: [], prompt_order: [] } });
T.ctx = freshCtx();
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__peopleCacheTest;\n';
const ST = {
    'script.js': js(G + `export const chat = [];
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

const P = await import(url('src/people.js'));
const B = await import(url('src/addons/translator/names-bridge.js'));
const ttsSrc = rel => pathToFileURL(path.join(themeRoot, 'src/addons/tts/src', rel)).href;
const S = await import(ttsSrc('settings.js'));
const SP = await import(ttsSrc('speakers.js'));
const V = await import(ttsSrc('voices.js'));
const R = await import(ttsSrc('runtime.js'));

// 실제 공급자 코드: index.js 의 peopleSource 를 그대로 떼어 와 같은 모듈로 만든다 (index.js 는 실리태번 전체를 부르므로)
const index = read('src/addons/tts/index.js');
const srcText = /const peopleSource = (\{[\s\S]*?\n\});/.exec(index)?.[1];
assert.ok(srcText, 'index.js peopleSource');
let personCalls = 0;
const counted = { speakers: SP, voices: V, runtimeEnabled: () => R.runtimeEnabled() };
const peopleSource = new Function('speakers', 'voices', 'runtimeEnabled', `return ${srcText};`)(counted.speakers, counted.voices, counted.runtimeEnabled);
const realPerson = peopleSource.person;
peopleSource.person = function (names) { personCalls++; return realPerson.call(this, names); };

const s = S.settings();
s.voices.push(S.toVoice({ voiceId: 'v_row', name: 'Rowan voice' }), S.toVoice({ voiceId: 'v_mina', name: 'Mina', aliases: ['미나'] }), S.toVoice({ voiceId: 'v_me', name: 'My voice' }), S.toVoice({ voiceId: 'v_def', name: 'Default voice' }), S.toVoice({ voiceId: 'v_quill', name: 'Quill voice' }));
const uid = id => s.voices.find(v => v.uid.endsWith(id)).uid;
s.char_map = { Rowan: uid('v_row') };
s.default_voice = uid('v_def');
const baseColors = () => ({ colors: { '#30a0a0': { name: 'Rowan', locked: true, count: 2, votes: {}, tvotes: {}, aliases: ['로완'] }, '#c06080': { name: 'Mina', locked: false, count: 5, votes: {}, tvotes: {} } }, names: {}, learned: {}, seeded: true, palette_at: 1, userColor: null });
T.ctx.chatMetadata.lemon_voice = baseColors();
const off = P.registerPeopleSource('tts', peopleSource);
globalThis[KEY] = B.buildNames(B.namePairs([{ id: 'q', scope: 'x', src: 'Quill', dst: '퀼' }]));

const NAMES = ['Rowan', '로완', 'Mina', '미나', 'Hero', 'Quill', '퀼', 'Rex', '렉스', 'Nobody', 'Corvin'];
const plain = p => p && { name: p.name, names: [...p.names], color: p.color, voice: p.voice && { ...p.voice } };
const view = () => ({
    get: NAMES.map(n => plain(P.people.get(n))),
    list: P.people.list().map(plain),
    canon: NAMES.map(n => SP.canon(n)),
    namesOf: NAMES.map(n => SP.namesOf(n)),
    color: NAMES.map(n => SP.colorOfName(n)),
    persona: NAMES.map(n => SP.isPersonaName(n)),
    known: SP.knownNames(),
});
const uncached = () => { P._setPeopleMemoForTest(false); try { return view(); } finally { P._setPeopleMemoForTest(true); } };
/** 데우고 → 바꾸고 → 기억 답 = 새 답, 그리고 답이 바뀌었는지 */
async function path_(name, change, { changes = true } = {}) {
    await test(name, async () => {
        const before = view(); view();   // 두 번: 기억이 다 찼다
        await change();
        const cached = view(), fresh = uncached();
        assert.deepEqual(cached, fresh, '기억한 답이 새로 만든 답과 다르다 — 이 길에서 기억이 안 비워졌다');
        if (changes) assert.notDeepEqual(fresh, before, '바꾼 것이 답을 안 바꿨다 (시험이 이 길을 못 건드림)');
    });
}

await test('기억이 실제로 쓰인다: 같은 판이면 같은 객체 · 공급자는 이름마다 한 번만 · 답은 기억 없이 만든 것과 같다', () => {
    view();
    personCalls = 0;
    const a = P.people.get('Mina'), b = P.people.get(' Mina ');
    assert.equal(a, b);
    for (let i = 0; i < 50; i++) for (const n of NAMES) P.people.get(n);
    assert.equal(personCalls, 0, '데운 뒤에는 공급자를 다시 부르지 않는다');
    assert.deepEqual(view(), uncached());
    P.invalidatePeople(); personCalls = 0;
    P.people.get('Mina');
    assert.equal(personCalls, 1, '비운 뒤 처음 한 번은 다시 묻는다');
});

// ── 색 표(chatMetadata.lemon_voice)를 바꾸는 길 ──
await path_('색 표: setColor (이름 정하기)', () => { SP.setColor('#c06080', 'Quill'); });
await path_('색 표: setColor 지우기', () => { SP.setColor('#c06080', ''); });
await path_('색 표: 대사 배우기 learnFromMessage (곧 저장 — deferSave, 알림 없음)', () => {
    const mes = { mes: 'm1', name: 'Rowan', is_user: false };
    T.ctx.chat.push(mes);
    const segs = [];
    for (let k = 0; k < 4; k++) segs.push({ kind: 'thought', speakerHint: 'Corvin', color: '#a05050', line: k * 2 }, { kind: 'dialogue', color: '#a05050', text: 'hi', line: k * 2 + 1 });
    assert.equal(SP.learnFromMessage(mes, segs, { deferSave: true }), true);
});
await path_('색 표: 대사 배우기 learnFromMessage (따로 저장)', () => {
    const mes = { mes: 'm2', name: 'Rowan', is_user: false };
    T.ctx.chat.push(mes);
    const segs = [];
    for (let k = 0; k < 4; k++) segs.push({ kind: 'thought', speakerHint: 'Rex', color: '#5050a0', line: k * 2 }, { kind: 'dialogue', color: '#5050a0', text: 'yo', line: k * 2 + 1 });
    SP.learnFromMessage(mes, segs);
});
await path_('색 표: 수정된 메시지 다시 배우기 (예전 표 걷기)', () => {
    const mes = T.ctx.chat[1]; mes.mes = 'm2 edited';
    SP.learnFromMessage(mes, [{ kind: 'thought', speakerHint: 'Rex', color: '#5050a0', line: 0 }]);
});
await path_('색 표: 메시지 지운 뒤 syncChat', () => { T.ctx.chat.splice(0, 1); SP.syncChat(); });
await path_('색 표: 프롬프트 팔레트 불러오기 importPalette', () => {
    T.ctx.chatCompletionSettings.prompts = [{ identifier: 'p1', content: '- Corvin / 코르빈: #112233\n- Mina / 미나 / ミナ: #445566', enabled: true }];
    SP.importPalette();
});
await path_('색 표: 배운 것 지우기 resetLearning', () => { SP.resetLearning(true); });
await path_('색 표: 채팅 전체 다시 배우기 relearnChat', () => {
    SP.setColor('#778899', 'Rex');
    T.ctx.chatCompletionSettings.prompts = [];
    SP.relearnChat();
});
await path_('색 표: 다른 곳이 색 표 객체를 통째로 바꿈 (메타 객체 그대로)', () => { T.ctx.chatMetadata.lemon_voice = baseColors(); });
await path_('색 표: 이름표 · 색 칸 객체를 갈아 끼움', () => {
    const lv = T.ctx.chatMetadata.lemon_voice;
    lv.names = { '퀼': 3 };
    lv.colors = { ...lv.colors, '#abcdef': { name: '퀼', locked: true, count: 9, votes: {}, tvotes: {}, aliases: [] } };
});

// ── 채팅 · 페르소나 · 캐릭터 (알림 없이 바뀐다) ──
await path_('채팅 바뀜: 새 chatMetadata (TTS 의 CHAT_CHANGED 보다 다른 확장이 먼저 물어도)', () => {
    T.ctx = { ...T.ctx, chat: [], chatMetadata: { lemon_voice: { colors: { '#30a0a0': { name: 'Rowan', locked: true, count: 1, votes: {}, tvotes: {}, aliases: [] } }, names: {}, learned: {}, seeded: true, palette_at: 1, userColor: null } } };
});
await path_('채팅 바뀜: 색 표가 없는 새 채팅', () => { T.ctx = { ...T.ctx, chat: [], chatMetadata: {} }; });
await path_('페르소나 바뀜 (name1)', () => { T.ctx.chatMetadata.lemon_voice = baseColors(); T.ctx.name1 = 'Mina'; });
await path_('캐릭터 바뀜 (name2 · characterId)', () => { T.ctx.name2 = 'Quill'; T.ctx.characters = [{ name: 'Quill', avatar: 'q.png' }]; });

// ── TTS 설정 (목소리 · 연결표 · 나) ──
await path_('설정: 목소리 다른 이름 고치고 save()', () => { s.voices.find(v => v.name === 'Quill voice').aliases = ['Quill']; S.save(); });
await path_('설정: 연결표 고치고 save()', () => { s.char_map['렉스'] = uid('v_quill'); S.save(); });
await path_('설정: 연결표에 열쇠가 늘어남 (save 전, 같은 객체)', () => { s.char_map.Nobody = uid('v_def'); });
await path_('설정: 목소리 넣기 upsertVoices', () => { V.upsertVoices([{ voiceId: 'v_corvin', name: 'Corvin' }], 'minimax'); });
await path_('설정: 목소리 지우기 removeVoice', () => { V.removeVoice(uid('v_corvin'), { keep: false }); });
await path_('설정: 내 목소리 칸 + save()', () => { s.user_voice = uid('v_me'); S.save(); });
await path_('설정: 목소리 목록 배열을 갈아 끼움', () => { s.voices = s.voices.filter(v => !v.uid.endsWith('v_quill')); });
await path_('설정: 캐릭터 이름 바꾸기 renameCharacterKeys', () => { SP.renameCharacterKeys(s, { oldName: 'Rowan', newName: 'Rowena', taken: [] }); T.ctx.name2 = 'Rowena'; });
await path_('설정: 설정 객체를 통째로 바꿈 (가져오기 · 다른 기기 설정)', () => {
    const copy = JSON.parse(JSON.stringify(s)); copy.char_map = {}; T.ext.lemon_voice = copy;
});

// ── 이름 다리 · 공급자 · 켜고 끔 ──
await path_('이름 다리: 번역 애드온이 새 짝을 냄', () => { B.publishNames([{ id: 'm', scope: 'x', src: 'Mina', dst: '미나짱' }], { host: globalThis, doc: () => doc }); });
await path_('공급자: 하나 더 등록 · 빼기', () => {
    const extra = P.registerPeopleSource('extra', { person: n => (n.includes('Nobody') ? { color: '#010203' } : null), names: () => ['Nobody'], stamp: () => 1 });
    globalThis.__extraOff = extra;
});
await path_('공급자: 뺌', () => { globalThis.__extraOff(); });
await path_('공급자: stamp 가 없는 공급자가 있으면 기억하지 않고 늘 묻는다', () => {
    let tick = 0;
    globalThis.__noStamp = P.registerPeopleSource('nostamp', { person: n => (n.includes('Rex') ? { color: tick ? '#0a0b0c' : null } : null) });
    view(); tick = 1;   // 알림 없이 답이 바뀌는 공급자
});
await test('stamp 없는 공급자를 빼면 다시 기억한다', () => { globalThis.__noStamp(); view(); personCalls = 0; P.people.get('Mina'); assert.equal(personCalls, 0); });
await path_('TTS 꺼짐 (runtimeEnabled)', () => { R.setRuntimeEnabled(false); });
await path_('TTS 다시 켜짐', () => { R.setRuntimeEnabled(true); });
await path_('peopleChanged() 알림 · invalidatePeople() — 바로 비운다 (120ms 알림을 기다리지 않는다)', () => {
    T.ctx.chatMetadata.lemon_voice.colors['#c06080'].name = 'Quillon';   // 직접 고친 뒤 알리는 길
    P.peopleChanged();
});

await test('코드: 고치는 곳 · 알림 · 다른 기기 설정 합치기 · stamp', () => {
    const sp = read('src/addons/tts/src/speakers.js');
    assert.match(sp, /const bump = \(o, k, d\) => \{[^\n]*dirty\(\); \};/);
    assert.match(sp, /function resolveAll\(st\) \{\s*dirty\(\);/);
    assert.match(read('src/addons/tts/src/settings.js'), /export const save = \(\) => \{ saveSettingsDebounced\(\); peopleChanged\(\); \};/);
    assert.match(read('src/people.js'), /export function peopleChanged\(\) \{\s*invalidatePeople\(\);/);
    assert.match(index, /stamp: \(\) => \[runtimeEnabled\(\), \.\.\.speakers\.peopleInputs\(\)\]/);
    assert.match(index, /onChange: \(\) => \{ invalidatePeople\(\);/);
    // TTS 밖에서 색 표 · 목소리 · 연결표를 고치는 곳이 새로 생기면 이 시험에 길을 더해야 한다
    const outside = [];
    const walk = dir => { for (const e of fs.readdirSync(path.join(themeRoot, dir), { withFileTypes: true })) { const rel = dir + '/' + e.name; if (e.isDirectory()) { if (!/vendor|bundled|plain/.test(e.name)) walk(rel); } else if (/\.m?js$/.test(e.name) && !rel.startsWith('src/addons/tts/')) { const t = read(rel); if (/lemon_voice\s*(\.|\[)[^\n]*=[^=]|char_map\s*\[[^\]]*\]\s*=[^=]/.test(t)) outside.push(rel); } } };
    walk('src');
    assert.deepEqual(outside, []);
});

off();
delete globalThis[KEY];
delete globalThis.__peopleCacheTest;
console.log(`people-cache-728: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
