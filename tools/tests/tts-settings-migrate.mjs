// TTS 설정 옮기기 · 정리 (src/addons/tts/src/settings.js settings() · migrate V2~V8 · migrateVoicesV8) — 사용자 데이터를 버리지 않는지
//   node tools/tests/tts-settings-migrate.mjs <테마 루트>   (공개 저장소는 '.')
// 실리태번 모듈(script.js · extensions.js)은 data: 스텁, 나머지(known-voices · version · sfx-credits · block-fallback · people)는 진짜. 지어낸 설정만 쓴다.
// 확인하는 것:
//   1) 처음 설치: 자동 읽기 · 미리 만들기 · 대사 분석은 꺼진 채 기본값, version 8
//   2) 1.0.0 설정(버전 없음): 읽기 방식 → read_preset · routes, MiniMax 키 · 주소 · 모델 → providers.minimax, 목소리 · 연결표 · 기본 목소리 id → uid, 옛 키 삭제, 새 키는 기본값
//   3) 4 → 5 → 7: 대사 클릭을 끈 사람의 미리 만들기 '끔' 은 7 에서 '대사' 로 · cache_limit 300 → 1000 (다른 값은 그대로)
//   4) 8: MiniMax 목소리의 음량 보정 나누기 — 슬라이더 눈금이 아닌 gainDb 는 autoGainDb 로, 눈금 값은 그대로, 다른 엔진은 손대지 않음
//   5) 정리: 모르는 값은 기본으로(듣는 언어 · 효과음 넓이 · 음량 · 표시 모양 · 음소거 길이), 섞인 id 는 거르고, 합치지 않는 표(providers · char_map)는 그대로, 같은 객체를 계속 돌려준다
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsSettingsTest = { ext: {}, saves: 0 };
const G = 'const T = globalThis.__ttsSettingsTest;\n';
const ST = {
    'script.js': js(G + 'export function saveSettingsDebounced() { T.saves++; } export async function saveSettings() { T.saves++; }'),
    'extensions.js': js(G + 'export const extension_settings = T.ext;'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });
const M = await import(pathToFileURL(path.join(root, 'settings.js')).href);
const { settings, DEFAULTS, DEFAULT_SKIP_TAGS, migrateVoicesV8 } = M;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
function boot(stored) {
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    if (stored !== undefined) T.ext.lemon_voice = stored;
    T.saves = 0;
    return settings();
}

await test('처음 설치: 자동 읽기 · 미리 만들기 · 대사 분석은 꺼진 채 기본값 · version 8 · 저장 키는 lemon_voice', () => {
    const s = boot(undefined);
    assert.equal(T.ext.lemon_voice, s);
    assert.equal(s.version, 8); assert.equal(s.auto_play, false); assert.equal(s.pregen, 'off'); assert.equal(s.analysis.enabled, false);
    assert.equal(s.enabled, true); assert.deepEqual(s.routes, DEFAULTS.routes); assert.equal(s.read_preset, 'dialogue');
    assert.deepEqual(s.voices, []); assert.deepEqual(s.char_map, {});
    assert.equal(s.analysis.fallback.enabled, true, '검열되면 다른 모델로 — 기본 켬');
});

await test('1.0.0 설정(버전 없음): 읽기 방식 · MiniMax 키 · 목소리 · 연결표를 옮기고 옛 키는 지운다 · 빠진 새 키는 기본값', () => {
    const s = boot({ read_mode: 'all', read_translated: false, skip_tags: true, split_paragraphs: true, api_key: 'mm-key', base_url: 'https://api.minimax.io', model: 'speech-02-hd', speed: '1.2', emotion: 'happy',
        voices: [{ voiceId: 'v_mina', name: '미나 목소리' }, { uid: 'minimax:v_rex', voiceId: 'v_rex', name: '렉스 목소리' }, null, { name: 'id 없음' }],
        char_map: { 미나: 'v_mina', 렉스: 'minimax:v_rex', 없음: '' }, default_voice: 'v_mina', user_voice: '', auto_play: true });
    assert.equal(s.version, 8);
    assert.equal(s.read_preset, 'all'); assert.deepEqual(s.routes, { dialogue: 'character', narration: 'character', action: 'character', thought: 'skip', user_dialogue: 'user' });
    assert.equal(s.text_source, 'original'); assert.equal(s.skip_tags, DEFAULT_SKIP_TAGS);
    assert.deepEqual({ key: s.providers.minimax.key, host: s.providers.minimax.host, model: s.providers.minimax.model, speed: s.providers.minimax.speed, emotion: s.providers.minimax.emotion }, { key: 'mm-key', host: 'https://api.minimax.io', model: 'speech-02-hd', speed: 1.2, emotion: 'happy' });
    assert.deepEqual(s.voices.map(v => v.uid), ['minimax:v_mina', 'minimax:v_rex'], 'id 없는 것 · 빈 칸은 뺀다');
    assert.deepEqual(s.char_map, { 미나: 'minimax:v_mina', 렉스: 'minimax:v_rex' });
    assert.equal(s.default_voice, 'minimax:v_mina'); assert.equal(s.user_voice, '');
    for (const k of ['read_mode', 'read_translated', 'split_paragraphs', 'api_key', 'base_url', 'model', 'speed', 'emotion']) assert.equal(k in s, false, k + ' 는 지운다');
    assert.equal(s.auto_play, true, '사용자가 고른 값은 그대로');
    assert.equal(s.click_play, true); assert.equal(s.pregen, 'dialogue', '대사 클릭을 쓰면 미리 만들기는 대사');
    assert.equal(s.cache_limit, 1000); assert.equal(s.analysis.provider, 'openai'); assert.deepEqual(s.analysis.provider_models, {});
});

await test('4 → 5 → 7: 대사 클릭을 끈 사람의 미리 만들기 — 5 가 둔 「끔」 을 7 이 「대사」 로 · cache_limit 300 → 1000, 다른 값은 그대로', () => {
    const a = boot({ version: 4, click_play: false, cache_limit: 300, voices: [] });
    assert.equal(a.pregen, 'dialogue'); assert.equal(a.cache_limit, 1000); assert.equal(a.version, 8);
    const b = boot({ version: 4, click_play: true, cache_limit: 500, voices: [] });
    assert.equal(b.pregen, 'dialogue'); assert.equal(b.cache_limit, 500);
    const c = boot({ version: 7, click_play: true, pregen: 'off', voices: [] });
    assert.equal(c.pregen, 'off', '대사 클릭을 켠 채 고른 끔은 사용자의 선택');
});

await test('8: MiniMax 목소리의 음량 보정 — 눈금이 아닌 gainDb 는 autoGainDb 로 옮기고 슬라이더는 0, 눈금 값 · 다른 엔진 · 섞은 목소리는 그대로', () => {
    const list = [
        { uid: 'minimax:a', provider: 'minimax', voiceId: 'a', name: 'A', gainDb: 1.37 },
        { uid: 'minimax:b', provider: 'minimax', voiceId: 'b', name: 'B', gainDb: 1.5 },
        { uid: 'openai:c', provider: 'openai', voiceId: 'c', name: 'C', gainDb: 1.37 },
        { uid: 'minimax:d', provider: 'minimax', voiceId: 'd', name: 'D', gainDb: 1.37, mix: [{ uid: 'minimax:a' }] },
    ];
    const n = migrateVoicesV8(list);
    assert.equal(list[0].autoGainDb, 1.37); assert.equal(list[0].gainDb, 0);
    assert.equal(list[1].gainDb, 1.5); assert.equal(list[1].autoGainDb, undefined);
    assert.equal(list[2].gainDb, 1.37); assert.equal(list[2].autoGainDb, undefined);
    assert.equal(list[3].gainDb, 1.37); assert.equal(list[3].autoGainDb, undefined);
    assert.equal(n, 1);
    const s = boot({ version: 7, voices: [{ uid: 'minimax:a', provider: 'minimax', voiceId: 'a', name: 'A', gainDb: 1.37 }] });
    assert.equal(s.version, 8); assert.equal(s.voices[0].autoGainDb, 1.37);
    const again = boot({ version: 8, voices: [{ uid: 'minimax:a', provider: 'minimax', voiceId: 'a', name: 'A', gainDb: 1.37 }] });
    assert.ok(again.voices[0].autoGainDb == null, '8 이면 다시 옮기지 않는다 (toVoice 는 빈 값을 null 로)');
    assert.equal(again.voices[0].gainDb, 1.37);
});

await test('정리: 모르는 값은 기본으로 · 섞인 효과음 id 는 거른다 · 합치지 않는 표는 그대로 · 같은 객체를 계속 돌려준다', () => {
    const s = boot({ version: 8, listen_lang: 'xx', highlight_style: 'blink', emotion_strength: 'huge', thought_emotion: 'loud', extras: 'maybe', mute_mode: 'weird', mute_words: 'a'.repeat(2500),
        sfx: { enabled: 'yes', level: 'huge', volume: 5, mode: 'loop', disabled: ['ok-id', 'bad id!', 42, 'ok-id'], favorites: ['x:y'], custom: [{ id: 'c1', credit: { name: 'N'.repeat(500), source: 'ftp://nope' } }, 'junk'] },
        prefer_pending: 'elevenlabs', pregen_paid: 'yes', user_voice: 7, voices: [], providers: { minimax: { key: 'k' } }, char_map: { 미나: 'minimax:v' }, analysis: { fallback: { enabled: false, provider: 3 } } });
    assert.equal(s.listen_lang, 'auto'); assert.equal(s.highlight_style, 'both'); assert.equal(s.emotion_strength, 'normal'); assert.equal(s.thought_emotion, 'whisper'); assert.equal(s.extras, 'auto');
    assert.equal(s.mute_mode, 'audio'); assert.equal(s.mute_words.length, 2000);
    assert.equal(s.sfx.enabled, false, '켬은 true 만'); assert.equal(s.sfx.level, 'normal'); assert.equal(s.sfx.volume, 1); assert.equal(s.sfx.mode, 'overlay');
    assert.deepEqual(s.sfx.disabled, ['ok-id']); assert.deepEqual(s.sfx.favorites, ['x:y']);
    assert.equal(s.sfx.custom.length, 2, '효과음 줄은 버리지 않는다'); assert.equal(s.sfx.custom[0].credit.name.length, 160); assert.equal(s.sfx.custom[0].credit.source, undefined);
    assert.deepEqual(s.prefer_pending, ['elevenlabs']); assert.equal(s.pregen_paid, false); assert.equal(s.user_voice, '');
    assert.deepEqual(s.providers, { minimax: { key: 'k' } }, 'providers 는 기본값과 합치지 않는다'); assert.deepEqual(s.char_map, { 미나: 'minimax:v' });
    assert.deepEqual(s.analysis.fallback, { enabled: false, provider: '', model: '' });
    assert.equal(s.analysis.engine, 'compat', '빠진 분석 키는 기본값');
    assert.equal(settings(), s, '같은 객체'); assert.equal(T.ext.lemon_voice, s);
    s.listen_lang = 'ja';
    assert.equal(settings().listen_lang, 'ja', '두 번째 호출은 다시 정리하지 않는다');
});

delete globalThis.__ttsSettingsTest;
console.log(`tts-settings-migrate: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
