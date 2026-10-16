// TTS 1.9.7 — ① 잠금화면 · 알림 미디어 카드(src/addons/tts/src/media-card.js + player.js setSession): 말하는 사람 얼굴(artwork) · 읽는 대사(title) · 화자(artist) ·
//   채팅(album). 목소리 id · 엔진 이름은 카드에 넣지 않는다. 내 줄은 페르소나 썸네일, 이름이 맞는 캐릭터가 없는 엑스트라 · 효과음 줄은 그림 없음.
// ② /sys 해설 메시지(extra.type narrator): 보낸 쪽 이름(System)의 줄은 캐릭터가 아니라 내레이터 목소리 (색 · 이름표가 화자를 준 줄은 그대로).
//   player.js 는 tts-preview-source.mjs 와 같은 data: 스텁 위에서 띄운다. 인물 · 문장은 지어낸 것, 네트워크 없음.
//   node tools/tests/tts-media-card.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const read = rel => fs.readFileSync(path.join(theme, rel), 'utf8');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsMediaCardTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '미나', characters: [{ name: '미나', avatar: 'mina.png' }], characterId: 0, groupId: null, groups: [] } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = { toastr: { info() {}, warning() {}, success() {}, error() {} } };
const G = 'const T = globalThis.__ttsMediaCardTest;\n';
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

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── ① 카드 값 (순수 함수) ──
const MC = await import(pathToFileURL(path.join(root, 'media-card.js')).href);
const thumbnail = (type, file) => `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`;
const env = { appTitle: 'TTS', userName: '하람', characters: [{ name: '미나', avatar: 'mina.png' }, { name: '렉스', avatar: 'rex.png' }], personaAvatar: 'haram.png', chatName: '미나', thumbnail, sameName: (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase() };
const voice = { uid: 'minimax:v_mina', name: '미나 목소리', voiceId: 'v_mina', provider: 'minimax' };

await test('① 캐릭터 줄: 얼굴 = 카드 썸네일 · 제목 = 대사 한 줄 · 화자 · 채팅 이름 — 목소리 id · 엔진 이름은 어디에도 없음', () => {
    const card = MC.mediaCard({ speaker: '미나', voice, text: '「어서 와.\n오늘은 늦었네」' }, env);
    assert.deepEqual(card, { title: '어서 와. 오늘은 늦었네', artist: '미나', album: '미나', artwork: [{ src: thumbnail('avatar', 'mina.png') }] });
    assert.doesNotMatch(JSON.stringify(card), /minimax|v_mina|목소리/);
});

await test('① 내 줄: 페르소나 썸네일 · 페르소나 그림이 없으면 그림 없음', () => {
    assert.deepEqual(MC.mediaCard({ speaker: '하람', voice, text: '"응, 왔어"' }, env).artwork, [{ src: thumbnail('persona', 'haram.png') }]);
    assert.deepEqual(MC.mediaCard({ speaker: ' 하람 ', voice, text: 'x' }, { ...env, personaAvatar: '' }).artwork, []);
});

await test('① 엑스트라(이름이 맞는 캐릭터 없음) · 효과음 줄 · 화자 없는 줄: 그림 없음, 이름 · 제목은 채운다', () => {
    const extra = MC.mediaCard({ speaker: '카페 사장', voice, text: '주문하시겠어요?' }, env);
    assert.deepEqual(extra, { title: '주문하시겠어요?', artist: '카페 사장', album: '미나', artwork: [] });
    const sfx = MC.mediaCard({ voice: { name: '효과음' }, text: '문 닫히는 소리', key: 'scene:1' }, env);
    assert.deepEqual(sfx, { title: '문 닫히는 소리', artist: '효과음', album: '미나', artwork: [] });
    assert.deepEqual(MC.mediaCard({ voice: { name: '' }, text: '' }, { appTitle: 'TTS' }), { title: 'TTS', artist: 'TTS', album: 'TTS', artwork: [] });
    assert.deepEqual(MC.mediaCard(null, env), { title: 'TTS', artist: 'TTS', album: '미나', artwork: [] });
});

await test('① 제목 한 줄: 따옴표 · 별표 · 밑줄을 걷고 60자에서 … · 그룹 채팅은 그룹 이름 · 아바타 none 은 그림 없음', () => {
    const long = '가'.repeat(70);
    const line = MC.cardLine(`*${long}*`);
    assert.equal(Array.from(line).length, 60);
    assert.ok(line.endsWith('…'));
    assert.equal(MC.cardLine('  「짧은  줄」  '), '짧은 줄');
    assert.equal(MC.cardLine(''), '');
    const group = MC.mediaCard({ speaker: '렉스', voice, text: '「늦었네」' }, { ...env, chatName: '세 사람' });
    assert.equal(group.album, '세 사람');
    assert.deepEqual(group.artwork, [{ src: thumbnail('avatar', 'rex.png') }]);
    assert.equal(MC.artworkFor('렉스', { ...env, characters: [{ name: '렉스', avatar: 'none' }] }), '');
    assert.equal(MC.artworkFor('렉스', { ...env, thumbnail: null }), '', '썸네일 길이 없으면 그림 없음');
});

// ── ② 재생기 ──
const mod = (name) => import(pathToFileURL(path.join(root, name)).href);
const S = await mod('settings.js');
const P = await mod('player.js');
const C = await mod('clickplay.js');
const gv = (voiceId, name) => ({ uid: `minimax:${voiceId}`, provider: 'minimax', voiceId, name, lang: '', group: 'g', aliases: [], params: {}, mix: [] });
function reset(extra = {}) {
    const s = S.settings();
    s.enabled = true;
    s.voices = [gv('v_mina', '미나 목소리'), gv('v_haram', '하람 목소리'), gv('v_narr', '내레이터 목소리')];
    s.char_map = { 미나: 'minimax:v_mina' };
    s.default_voice = 'minimax:v_mina'; s.user_voice = 'minimax:v_haram'; s.narrator_voice = 'minimax:v_narr'; s.prefer_provider = '';
    s.routes = { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'skip', user_dialogue: 'user' };
    s.read_preset = 'dialogue'; s.no_dialogue_fallback = 'narration'; s.join_paragraph = true; s.pregen = 'off';
    s.text_source = 'original'; s.listen_lang = 'auto'; s.pron_dict = ''; s.mute_words = ''; s.max_chars = 3000; s.wait_translation = 'off'; s.extras = 'off';
    s.analysis = { ...s.analysis, enabled: false };
    s.providers = { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' } };
    Object.assign(s, extra);
    T.ctx.chatMetadata = {};
}
const hit = (text) => ({ kind: 'dialogue', text, raw: text, quoted: `「${text}」`, color: null, speakerHint: null, line: 0 });
function message(fields) {
    const mes = { name: '미나', is_user: false, mes: '「어서 와. 오늘은 늦었네」 미나가 말했다.', extra: {}, swipe_id: 0, ...fields };
    T.ctx.chat.length = 0; T.ctx.chat.push(mes);
    return mes;
}
const jobsOf = (mes, seg) => P._forTest.tapJobs(0, mes, [seg], {}).lines.flat();

await test('② /sys 해설(extra.type narrator): 보낸 쪽(System) 줄은 내레이터 목소리 · 보통 답장은 전처럼 캐릭터 목소리', () => {
    reset();
    const plain = message({});
    const seg = C.segmentForHit(plain, hit('어서 와. 오늘은 늦었네'));
    assert.equal(jobsOf(plain, seg)[0].voice.uid, 'minimax:v_mina', '보통 답장은 그 캐릭터');
    // 서술에 아는 이름이 있으면(「미나가 말했다」) 그 사람 목소리로 가는 1.9.1 규칙은 그대로라, 해설 예문은 이름 없는 서술로
    const sys = message({ name: 'System', extra: { type: 'narrator' }, mes: '「어서 와. 오늘은 늦었네」 누군가 말했다.' });
    const jobs = jobsOf(sys, C.segmentForHit(sys, hit('어서 와. 오늘은 늦었네')));
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].voice.uid, 'minimax:v_narr', '해설 메시지의 보낸 쪽 줄은 내레이터');
    assert.equal(fetches, 0);
});

await test('② /sys name=캐릭터 처럼 이름을 준 해설은 그 캐릭터 목소리 · 이 채팅의 내레이터 이름(chat_metadata.narrator_name)은 내레이터', () => {
    reset();
    const named = message({ name: '미나', extra: { type: 'narrator' }, mes: '「어서 와. 오늘은 늦었네」 누군가 말했다.' });
    assert.equal(jobsOf(named, C.segmentForHit(named, hit('어서 와. 오늘은 늦었네')))[0].voice.uid, 'minimax:v_mina', '/sys name=미나');
    T.ctx.chatMetadata = { narrator_name: '해설자' };
    const custom = message({ name: '해설자', extra: { type: 'narrator' }, mes: '「어서 와. 오늘은 늦었네」 누군가 말했다.' });
    assert.equal(jobsOf(custom, C.segmentForHit(custom, hit('어서 와. 오늘은 늦었네')))[0].voice.uid, 'minimax:v_narr', '이 채팅의 내레이터 이름');
    T.ctx.chatMetadata = {};
    const other = message({ name: '해설자', extra: { type: 'narrator' }, mes: '「어서 와. 오늘은 늦었네」 누군가 말했다.' });
    assert.equal(jobsOf(other, C.segmentForHit(other, hit('어서 와. 오늘은 늦었네')))[0].voice.uid, 'minimax:v_mina', '내레이터 이름이 아니면 캐릭터 길(기본 목소리)');
});

await test('② 해설 메시지라도 이름표(speakerHint)가 화자를 주면 그 캐릭터 · 내레이터 목소리가 없으면 기본 목소리', () => {
    reset();
    const sys = message({ name: 'System', extra: { type: 'narrator' }, mes: '미나: 「어서 와. 오늘은 늦었네」' });
    const named = { ...C.segmentForHit(sys, hit('어서 와. 오늘은 늦었네')), speakerHint: '미나' };
    assert.equal(jobsOf(sys, named)[0].voice.uid, 'minimax:v_mina');
    reset({ narrator_voice: '' });
    const bare = message({ name: 'System', extra: { type: 'narrator' }, mes: '「어서 와. 오늘은 늦었네」 누군가 말했다.' });
    assert.equal(jobsOf(bare, C.segmentForHit(bare, hit('어서 와. 오늘은 늦었네')))[0].voice.uid, 'minimax:v_mina', '내레이터 목소리가 없으면 기본');
});

await test('배선: setSession 은 mediaCard(job, cardEnv()) 로 · 목소리 이름을 제목에 넣던 줄 없음 · 썸네일은 namespace import(시험 스텁에도 안전) · 판 1.9.7 · CI', () => {
    const player = read('src/addons/tts/src/player.js');
    assert.match(player, /if \(job\) ms\.metadata = new MediaMetadata\(mediaCard\(job, cardEnv\(\)\)\);/);
    assert.doesNotMatch(player, /`\$\{job\.speaker\} · \$\{job\.voice\.name\}`/);
    assert.match(player, /import \* as stScript from '(?:\.\.\/)+script\.js';/);
    assert.match(player, /import\('(?:\.\.\/)+personas\.js'\)\.then\(m => \{ personas = m; \}\)\.catch\(/, '페르소나는 동적 import (없으면 null)');
    assert.match(player, /const narratorMes = !mes\.is_user && mes\.extra\?\.type === 'narrator' && isNarratorName\(mes\.name\);/);
    assert.match(player, /function isNarratorName\(name\) \{[\s\S]*?narrator_name[\s\S]*?\n\}/);
    assert.match(player, /if \(narratorMes && source === 'sender' && route === 'character'\) route = 'narrator';/);
    assert.match(read('src/addons/tts/manifest.json'), /"version": "1\.9\.7"/);
    assert.match(read('src/addons/tts/version.js'), /TTS_VERSION = '1\.9\.7'/);
    assert.match(read('src/addons/tts/style.css'), /--lv-css-version: "1\.9\.7"/);
    assert.match(read('src/addons/tts/README.md'), /^# TTS 1\.9\.7/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/tts-media-card\.mjs \./);
});

console.log(`tts-media-card: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
