// 테마 6.2.3 (TTS) 색 없는 대사에 화자 색 — src/addons/tts/src/paint-core.js (짝 맞추기 · 칠할 줄) · speakers.colorOfName ·
//   player.dialogueSpeakers (재생기와 같은 화자 · 저장된 분석) · player.analyzeForPaint (조건 · 통신 없이) · 연결(index.js · ui.js · settings.js)
//   node tools/tests/tts-paint.mjs <테마 루트>
// 실리태번 모듈은 data: 스텁으로 (tts-extras.mjs 와 같은 방식). 네트워크 없음 — fetch 를 부르면 실패로 센다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const root = path.join(themeRoot, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsPaintTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'Hero', name2: 'Narrator' } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__ttsPaintTest;\n';
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

const core = await import(pathToFileURL(path.join(root, 'paint-core.js')).href);
const { settings } = await import(pathToFileURL(path.join(root, 'settings.js')).href);
const SP = await import(pathToFileURL(path.join(root, 'speakers.js')).href);
const A = await import(pathToFileURL(path.join(root, 'analysis.js')).href);
const P = await import(pathToFileURL(path.join(root, 'player.js')).href);
const read = (rel) => fs.readFileSync(path.join(themeRoot, rel), 'utf8');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const COLORS = { Mina: '#d03030', Jun: '#3060d0' };
const colorOf = (n) => COLORS[n] || null;

await test('칠할 줄: 색 없고 · 화자를 이름표(hint) · 분석(analysis)으로 안 줄만, 그 인물 색으로 — 보낸 쪽 이름(sender) · 모르는 색 · 색 있는 줄은 그대로', () => {
    const quotes = [
        { text: 'Hi there', colored: true },
        { text: 'Wait!', colored: false },
        { text: 'Who?', colored: false },
        { text: 'not a dialogue segment', colored: false },
        { text: 'Fine.', colored: false },
        { text: 'Odd one', colored: false },
    ];
    const speakers = [
        { text: 'Hi there', color: '#d03030', name: 'Mina', source: 'learned' },
        { text: 'Wait!', color: null, name: 'Jun', source: 'analysis' },
        { text: 'Who?', color: null, name: 'Narrator', source: 'sender' },
        { text: 'Fine.', color: null, name: 'Mina', source: 'hint' },
        { text: 'Odd one', color: null, name: 'Stranger', source: 'analysis' },
    ];
    assert.deepEqual(core.planPaint(quotes, speakers, colorOf), [
        { index: 1, color: '#3060d0', name: 'Jun' },
        { index: 4, color: '#d03030', name: 'Mina' },
    ]);
});

await test('같은 대사가 여럿이면 차례대로 짝 — 색 있는 화면 대사도 줄을 하나 써서 아래 줄이 위 사람 색을 받지 않는다', () => {
    const two = [{ text: 'Yes.', colored: false }, { text: 'Yes.', colored: false }];
    const sp = [{ text: 'Yes.', color: null, name: 'Mina', source: 'analysis' }, { text: 'Yes.', color: null, name: 'Jun', source: 'analysis' }];
    assert.deepEqual(core.planPaint(two, sp, colorOf).map(p => p.name), ['Mina', 'Jun']);
    const first = [{ text: 'Yes.', colored: true }, { text: 'Yes.', colored: false }];
    const sp2 = [{ text: 'Yes.', color: '#d03030', name: 'Mina', source: 'learned' }, { text: 'Yes.', color: null, name: 'Jun', source: 'analysis' }];
    assert.deepEqual(core.planPaint(first, sp2, colorOf), [{ index: 1, color: '#3060d0', name: 'Jun' }]);
});

await test('글 비교: 빈칸 · 꾸밈 글자(* _ ~) · 대소문자 · 보이지 않는 글자는 무시', () => {
    assert.equal(core.foldText('  *Wait*​  there! '), 'wait there!');
    const q = [{ text: 'WAIT   there!', colored: false }];
    const sp = [{ text: '*wait* there!', color: null, name: 'Jun', source: 'analysis' }];
    assert.deepEqual(core.matchQuotes(q, sp), [0]);
    assert.equal(core.planPaint(q, sp, colorOf).length, 1);
});

await test('색 모양이 #rrggbb 가 아니거나 colorOf 가 던지면 칠하지 않음', () => {
    const q = [{ text: 'Wait!', colored: false }];
    const sp = [{ text: 'Wait!', color: null, name: 'Jun', source: 'analysis' }];
    assert.deepEqual(core.planPaint(q, sp, () => 'red'), []);
    assert.deepEqual(core.planPaint(q, sp, () => { throw new Error('x'); }), []);
    assert.deepEqual(core.planPaint(q, [{ ...sp[0], name: '  ' }], colorOf), []);
});

await test('분석이 필요한가: 화면에 색이 없고 화자를 못 정한(sender) 대사가 있을 때만', () => {
    const q = [{ text: 'Wait!', colored: false }, { text: 'Who?', colored: true }];
    assert.equal(core.needsSpeakers(q, [{ text: 'Wait!', color: null, name: 'N', source: 'sender' }, { text: 'Who?', color: null, name: 'N', source: 'sender' }]), true);
    assert.equal(core.needsSpeakers(q, [{ text: 'Wait!', color: null, name: 'Jun', source: 'analysis' }, { text: 'Who?', color: null, name: 'N', source: 'sender' }]), false, '색 있는 화면 대사는 묻지 않음');
    assert.equal(core.needsSpeakers([{ text: 'Wait!', colored: false }], [{ text: 'Wait!', color: '#d03030', name: 'Mina', source: 'learned' }]), false);
    assert.equal(core.needsSpeakers([], []), false);
});

await test('그 인물의 색: 이 채팅에서 가장 많이 본 색 · 같으면 잠긴(팔레트) 색 · 이름 대소문자 무시 · 나는 내 색 · 모르면 null', () => {
    T.ctx.chatMetadata.lemon_voice = {
        colors: {
            '#e04040': { name: 'Mina', count: 2, votes: {}, tvotes: {} },
            '#d03030': { name: 'Mina', count: 5, votes: {}, tvotes: {} },
            '#3060d0': { name: 'Jun', locked: true, count: 0, votes: {}, tvotes: {} },
            '#5070e0': { name: 'Jun', count: 0, votes: {}, tvotes: {} },
        },
        userColor: '#424c59',
    };
    assert.equal(SP.colorOfName('Mina'), '#d03030');
    assert.equal(SP.colorOfName(' mina '), '#d03030');
    assert.equal(SP.colorOfName('Jun'), '#3060d0', '횟수가 같으면 잠긴 팔레트 색');
    assert.equal(SP.colorOfName('Hero', { userName: 'Hero' }), '#424c59', '나는 내 색');
    assert.equal(SP.colorOfName('Hero'), '#424c59', '이름을 안 주면 페르소나 이름(name1)');
    assert.equal(SP.colorOfName('Nobody'), null);
    assert.equal(SP.colorOfName(''), null);
});

function message(analysis) {
    const mes = 'Mina: 「Fine.」\n\n<span style="color:#d03030">「Hi there」</span>\n\n「Wait!」\n\n「Who?」';
    const m = { name: 'Narrator', is_user: false, is_system: false, swipe_id: 0, mes, extra: {} };
    if (analysis) m.extra.lemon_voice = { analysis: { hash: A.hash(mes), langs: [], sfx: [], segs: analysis } };
    return m;
}

await test('재생기와 같은 화자: 이름표 → hint · 색 → learned · 분석의 화자 → analysis · 그 밖은 sender (저장된 분석만, 통신 없음)', () => {
    const s = settings();
    s.analysis.enabled = true; s.analysis.speaker = true;
    T.ctx.chat.length = 0;
    const emo = A.EMOTIONS[0];
    T.ctx.chat.push(message([{ i: 0, emotion: emo, speaker: 'Mina' }, { i: 1, emotion: emo, speaker: '?' }, { i: 2, emotion: emo, speaker: 'Jun' }, { i: 3, emotion: emo, speaker: '?' }]));
    const before = fetches;
    const list = P.dialogueSpeakers(0);
    assert.deepEqual(list.map(x => [x.text, x.source, x.name, x.color]), [
        ['Fine.', 'hint', 'Mina', null],
        ['Hi there', 'learned', 'Mina', '#d03030'],
        ['Wait!', 'analysis', 'Jun', null],
        ['Who?', 'sender', 'Narrator', null],
    ]);
    assert.equal(fetches, before, '통신 없음');
    // 분석이 없으면 이름표 · 색만
    T.ctx.chat.length = 0; T.ctx.chat.push(message(null));
    assert.deepEqual(P.dialogueSpeakers(0).map(x => x.source), ['hint', 'learned', 'sender', 'sender']);
    // 화자 찾기를 끄면 저장된 분석의 화자도 쓰지 않음
    T.ctx.chat.length = 0; T.ctx.chat.push(message([{ i: 0, emotion: emo, speaker: 'Mina' }, { i: 1, emotion: emo, speaker: '?' }, { i: 2, emotion: emo, speaker: 'Jun' }, { i: 3, emotion: emo, speaker: '?' }]));
    s.analysis.speaker = false;
    assert.equal(P.dialogueSpeakers(0)[2].source, 'sender');
    s.analysis.speaker = true;
    // 내 메시지 · 시스템 메시지는 없음
    T.ctx.chat.push({ name: 'Hero', is_user: true, is_system: false, swipe_id: 0, mes: '「Hello.」', extra: {} });
    assert.deepEqual(P.dialogueSpeakers(1), []);
});

await test('분석 부르기 조건: 꺼짐 · 수동 · 화자 찾기 끔이면 null · 저장된 분석이 있으면 그것 (어느 쪽도 통신 없음)', async () => {
    const s = settings();
    const emo = A.EMOTIONS[0];
    T.ctx.chat.length = 0;
    T.ctx.chat.push(message([{ i: 0, emotion: emo, speaker: 'Mina' }, { i: 1, emotion: emo, speaker: '?' }, { i: 2, emotion: emo, speaker: 'Jun' }, { i: 3, emotion: emo, speaker: '?' }]));
    const before = fetches;
    s.enabled = true; s.analysis.enabled = true; s.analysis.speaker = true; s.analysis.when = 'auto';
    const cached = await P.analyzeForPaint(0);
    assert.ok(cached && Array.isArray(cached.segs) && cached.segs[2].speaker === 'Jun', '저장된 분석');
    s.analysis.when = 'manual';
    assert.equal(await P.analyzeForPaint(0), null, '수동');
    s.analysis.when = 'auto'; s.analysis.speaker = false;
    assert.equal(await P.analyzeForPaint(0), null, '화자 찾기 끔');
    s.analysis.speaker = true; s.analysis.enabled = false;
    assert.equal(await P.analyzeForPaint(0), null, '분석 끔');
    s.analysis.enabled = true; s.enabled = false;
    assert.equal(await P.analyzeForPaint(0), null, 'TTS 사용 끔');
    s.enabled = true;
    assert.equal(fetches, before, '통신 없음');
});

await test('연결: 기본 켬 · 설정 줄(화자 찾기 아래, 툴팁 없음) · index.js 가 켜고 끄고 · 이벤트 · 화면에서만 (글 · 채팅을 바꾸지 않음)', () => {
    const ui = read('src/addons/tts/src/ui.js');
    const idx = read('src/addons/tts/index.js');
    const paint = read('src/addons/tts/src/paint.js');
    assert.equal(settings().speaker_paint, true);
    assert.match(read('src/addons/tts/src/settings.js'), /speaker_paint: true,/);
    assert.match(ui, /\{ key: 'analysis\.speaker'[^\n]*\n\s*\{ key: 'speaker_paint', label: '색 없는 대사에 화자 색', type: 'toggle', desc: paintNote \}/);
    assert.match(ui, /function paintNote\(s\)/);
    assert.match(ui, /path === 'speaker_paint'[^\n]*paint\.refresh\(\)/);
    for (const call of ['paint.init()', 'paint.destroy()', 'paint.onRendered(id, type)', 'paint.onChatChanged()', 'paint.onGenStarted()', 'paint.onGenEnded()']) assert.ok(idx.includes(call), call);
    assert.match(paint, new RegExp(`setAttribute\\(PAINT_ATTR, name\\)`));
    assert.doesNotMatch(paint, /setAttribute\('title'|\.title\s*=/, '툴팁 없음');
    assert.doesNotMatch(paint, /saveChat|saveMetadata|\.mes\s*=[^=]|display_text\s*=[^=]/, '원문 · 채팅 파일을 바꾸지 않음');
    assert.equal(core.PAINT_ATTR, 'data-lv-paint');
});

console.log(`\nTTS 색 없는 대사에 화자 색: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
