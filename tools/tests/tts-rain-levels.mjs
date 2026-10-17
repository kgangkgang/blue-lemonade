// TTS 1.9.8 비 세 단계 — 가볍게 내리는 비(daily_rain_light) · 비 내리는 소리(daily_rain) · 쏟아지는 비(daily_rain_heavy)
//   ① 파일 · 출처: 세 파일이 있고 SOURCES.json 의 바이트 · SHA-256 와 같다 · BigSoundBank CC0 · 지은이 · 원본 페이지 · 반복 겹치기 기록
//   ② 낱말 → 단계: 효과음 찾기(matchSfx) · 통화 효과(rainLevelOf) — 상대 표현(비가 거세 → 쏟아짐, 비가 잦아들 → 가볍게) 포함
//   ③ 크기: 크기 맞추기 낮춤(levelDb) 가볍게 < 보통 < 쏟아짐 ≤ 0 · 오래 이어지는 소리(SUSTAINED) · 통화 「비 오는 날」 세기 표 · 장면 소리 세기(날씨 양)
//   실리태번 모듈은 data: 스텁 (tts-paint.mjs 와 같은 방식). 지어낸 문장만. 네트워크 없음.
//   node tools/tests/tts-rain-levels.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const read = rel => fs.readFileSync(path.join(theme, rel), 'utf8');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsRainTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '미나' } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__ttsRainTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
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
const mod = name => import(pathToFileURL(path.join(root, name)).href);
const L = await mod('sfx-library.js'), A = await mod('analysis.js'), F = await mod('fx-call.js');
const R = await import(pathToFileURL(path.join(theme, 'src/scene-sound-rules.js')).href);
const SY = await import(pathToFileURL(path.join(theme, 'src/scene-sound-synth.js')).href);
const IDS = ['daily_rain_light', 'daily_rain', 'daily_rain_heavy'];

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

await t('① 세 파일 · 출처: SOURCES.json 바이트 · SHA-256 와 같다 · BigSoundBank CC0 · 원본 페이지 · 10초 반복 겹치기 · 96 kbps', () => {
    const source = JSON.parse(read('src/addons/tts/sfx-extra/SOURCES.json'));
    const want = { daily_rain_light: ['Joseph SARDIN', 's0820'], daily_rain: ['Pierre SIBANARCO', 's2679'], daily_rain_heavy: ['Joseph SARDIN', 's1294'] };
    for (const id of IDS) {
        const row = source.files.find(x => x.id === id);
        assert.ok(row, id);
        const raw = fs.readFileSync(path.join(theme, 'src/addons/tts/sfx-extra', id + '.mp3'));
        assert.equal(raw.length, row.bytes, id); assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), row.sha256, id);
        assert.ok(raw.length > 60000 && raw.length < 200000, '크기는 옛 빗소리(약 110 KB)와 비슷하게');
        assert.equal(row.author, want[id][0]); assert.ok(row.source.includes(want[id][1]), row.source);
        assert.equal(row.license, 'CC0-1.0'); assert.equal(row.licenseUrl, 'https://creativecommons.org/publicdomain/zero/1.0/');
        assert.equal(row.modifications.loopCrossfadeSeconds, 0.3); assert.equal(row.modifications.excerptSeconds, 10.3);
        const runtime = L.getSfx(id);
        assert.equal(runtime.category, '자연·날씨'); assert.equal(runtime.credit.author, row.author); assert.equal(runtime.credit.source, row.source);
        assert.ok(L.sfxAttribution([id]).includes(row.source));
    }
    assert.ok(!source.files.some(x => /rain-on-puddle/.test(x.source || '')), '옛 물웅덩이 빗소리는 내장 목록에서 빠짐');
    assert.equal(L.getSfx('daily_rain').name, '비 내리는 소리');
});

await t('② 효과음 찾기(matchSfx): 가랑비 · 비가 조금 · drizzle → 가볍게 / 비가 내린다 · rain → 보통 / 장대비 · 폭우 · 비가 쏟아 · 비가 거세 · heavy rain → 쏟아짐', () => {
    const cases = [
        ['가랑비가 내렸다.', 'daily_rain_light'], ['이슬비가 소리 없이 내렸다.', 'daily_rain_light'], ['비가 조금 내렸다.', 'daily_rain_light'], ['It started drizzling.', 'daily_rain_light'], ['light rain fell', 'daily_rain_light'],
        ['비가 내린다.', 'daily_rain'], ['빗소리가 들렸다.', 'daily_rain'], ['rain on the window', 'daily_rain'],
        ['장대비가 내렸다.', 'daily_rain_heavy'], ['폭우였다.', 'daily_rain_heavy'], ['비가 쏟아지기 시작했다.', 'daily_rain_heavy'], ['비가 거세게 몰아쳤다.', 'daily_rain_heavy'], ['heavy rain all night', 'daily_rain_heavy'], ['a sudden downpour', 'daily_rain_heavy'],
    ];
    for (const [text, id] of cases) assert.equal(L.matchSfx(text)?.id, id, text);
});

await t('② 통화 효과 rainLevelOf: 같은 낱말 표 · 마지막에 나온 것 · 비 낱말이 없으면 빈칸', () => {
    const cases = [['가랑비가 내렸다', 'light'], ['비가 조금씩 잦아들었다', 'light'], ['비가 내린다', 'medium'], ['우산을 폈다', 'medium'], ['장대비가 쏟아졌다', 'heavy'], ['소나기가 지나갔다', 'heavy'],
        ['heavy rain', 'heavy'], ['가랑비가 오다가 비가 거세졌다', 'heavy'], ['지하철역에 내렸다', '']];
    for (const [text, level] of cases) assert.equal(F.rainLevelOf(text), level, text);
    assert.equal(F.suggestScene('장대비가 쏟아졌다'), 'rain', '배경 추천은 그대로 「비 오는 날」');
});

await t('③ 크기 맞추기 낮춤 levelDb: 가볍게 < 보통 < 쏟아짐 ≤ 0 · 목표에 더해짐 · 세 소리 모두 오래 이어지는 소리', () => {
    const lv = IDS.map(id => L.getSfx(id).levelDb);
    assert.deepEqual(lv, [-10, -6, -2]);
    assert.match(read('src/addons/tts/src/sfx-library.js'), /const target = Math\.max\(-40, sfxLevelTarget\(\) \+ \(Number\.isFinite\(lower\) \? Math\.max\(-24, Math\.min\(0, lower\)\) : 0\)\);/);
    for (const id of IDS) assert.equal(A.canSustainSfx(L.getSfx(id)), true, id);
});

await t('③ 통화 「비 오는 날」 세기 표: 가볍게는 작고 천둥 없음 · 쏟아짐은 크고 빗방울 많음 · 모르는 세기는 보통', () => {
    const { light, medium, heavy } = F.RAIN_BED;
    assert.ok(light.db < medium.db && medium.db < heavy.db);
    assert.ok(light.drops < medium.drops && medium.drops < heavy.drops);
    assert.equal(light.thunder, false); assert.equal(heavy.thunder, true);
    assert.deepEqual([...F.RAIN_LEVELS], ['light', 'medium', 'heavy']);
    const src = read('src/addons/tts/src/fx-call.js');
    assert.match(src, /const rainBed = scene === 'rain' \? RAIN_BED\[rain\] \|\| RAIN_BED\.medium : null;/);
    assert.match(src, /\(rainBed && !rainBed\.thunder\)\) return;/);
});

await t('③ 장면 소리: 날씨 양 → 세기(55 가볍게 · 100 보통 · 170 쏟아짐) · 합성 크기 · 내 파일 배율 · 세기가 바뀌면 다시 고른다', () => {
    assert.deepEqual([0, 55, 69, 70, 100, 135, 136, 170, 200, undefined].map(R.rainLevel), ['light', 'light', 'light', 'medium', 'medium', 'medium', 'heavy', 'heavy', 'heavy', 'medium']);
    const { light, medium, heavy } = SY.RAIN_SYNTH;
    assert.ok(light.trim < medium.trim && medium.trim < heavy.trim && light.patter < medium.patter && medium.patter < heavy.patter);
    assert.ok(R.RAIN_FILE_GAIN.light < 1 && R.RAIN_FILE_GAIN.heavy > 1);
    // 가짜 소리판으로 목소리를 만들어 크기(trim)가 세기를 따르는지
    const node = () => ({ connect: x => x, disconnect() {}, gain: { value: 0 }, frequency: { value: 0 }, Q: { value: 0 }, start() {}, stop() {}, buffer: null, loop: false, playbackRate: { value: 1 }, type: '' });
    const ctx = { currentTime: 0, sampleRate: 8000, createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }), createBufferSource: node, createBiquadFilter: node, createGain: node, createOscillator: node };
    const trims = ['light', 'medium', 'heavy'].map(level => SY.buildVoice(ctx, 'rain', { level }).trim);
    assert.ok(trims[0] < trims[1] && trims[1] < trims[2], trims.join(' '));
    assert.equal(SY.buildVoice(ctx, 'rain', { level: 'light' }).level, 'light');
    assert.equal(SY.buildVoice(ctx, 'wind').level, '');
    const scene = read('src/scene-sound.js');
    assert.match(scene, /active\.url === url && \(active\.level \|\| ''\) === level\)/);
    assert.match(scene, /return play\(kind, kind === 'rain' \? rainLevel\(now\?\.amount\) : ''\);/);
    assert.match(scene, /amount: weatherAmount\(weatherChat\.weatherAmount, weatherChat\.weatherLevel\)/);
});

await t('판 1.9.8 이상 · README 절 · CI 등록', () => {
    const v = (read('src/addons/tts/version.js').match(/TTS_VERSION = '(\d+)\.(\d+)\.(\d+)'/) || []).slice(1).map(Number);
    assert.ok(v.length === 3 && (v[0] * 1e6 + v[1] * 1e3 + v[2]) >= 1009008, 'TTS 판 ' + v.join('.'));
    assert.match(read('src/addons/tts/README.md'), /^## 1\.9\.8 비 세 단계/m);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/tts-rain-levels\.mjs \./);
});

delete globalThis.__ttsRainTest;
console.log(`tts-rain-levels: ${n} passed, 0 failed`);
