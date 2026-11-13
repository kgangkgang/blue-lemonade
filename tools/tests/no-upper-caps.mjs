// 사용자 숫자 설정의 위쪽 상한 풀기(사용자 「이런 거에 상한 좀 걸지 마 · 알아서 하겠지」)
//   ① 입력 칸에 위쪽 max 가 없어요(슬라이더가 같이 있는 칸은 숫자 칸만 · 슬라이더는 끝에 붙어 있어요)
//   ② 예전 상한의 10배 값이 저장 정리 · 바꿀 때 처리를 그대로 지나 쓰여요
//   ③ 예전 범위 안에 저장된 옛 설정은 그대로 이어지고, 아래쪽 한계는 그대로예요
//   ④ 막지 않고 안내로 바꾼 칸은 넘으면 안내 한 줄이 나와요
// 여러 애드온은 실리태번 모듈을 불러서 노드에서 통째로 못 돌려요 — 그런 곳은 그 함수 · 줄만 떼어 돌려요(다른 시험과 같은 방식).
//   node tools/tests/no-upper-caps.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (error) { failed++; console.log(`  FAIL ${name}\n       ${String(error?.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}
/** 소스에서 `<input …>` 한 개를 찾아요(id · data 속성 등 글자로) */
const inputWith = (src, needle) => { const at = src.indexOf(needle); assert.ok(at >= 0, `칸을 못 찾았어요: ${needle}`); const s = src.lastIndexOf('<input', at), e = src.indexOf('>', at); return src.slice(s, e + 1); };
const noMax = (tag, why) => assert.doesNotMatch(tag, /\bmax="(?!Infinity")/, `${why}: 위쪽 max 가 없어요 — ${tag}`);

// ── 요청 로그 · 사용량 장부 · 끊김 감시 (perf) ──────────────────────
await test('끊김 감시: 기다릴 시간 · 첫 글자 대기는 위쪽 상한 없음(300초 · 1,800초의 10배도 그대로) · 아래쪽 · 0 = 끔 그대로', async () => {
    const W = await load('src/addons/perf/watchdog.js');
    assert.equal(W.clampIdle(3000), 3000); assert.equal(W.clampFirst(18000), 18000);
    assert.equal(W.clampIdle(20), 20, '옛 기본값'); assert.equal(W.clampIdle(300), 300, '옛 끝값'); assert.equal(W.clampFirst(1800), 1800);
    assert.equal(W.clampIdle(1), 3, '아래쪽 3초'); assert.equal(W.clampFirst(0), 0, '0 = 끔'); assert.equal(W.clampFirst(1), 3);
    assert.equal(W.clampIdle('x', 20), 20, '숫자가 아니면 전 값');
    const html = read('src/addons/perf/watchdog-main.js');
    noMax(inputWith(html, 'id="sw_idle"'), '기다릴 시간'); noMax(inputWith(html, 'id="sw_first"'), '첫 글자 대기');
    // 큰 값이어도 타이머 넘침이 없어요 — 간격은 1초 이하 틱(tickFor)이라 값이 setTimeout 에 바로 들어가지 않아요
    assert.match(read('src/addons/perf/watchdog.js'), /const tickFor = \(\.\.\.limits\) => Math\.max\(100, Math\.min\(1000,/);
});
await test('요청 로그: 본문 보관 · 기록 보관은 위쪽 상한 없음 — 바꿀 때 · 불러올 때 10배(5,000 · 50,000)도 그대로, 넘으면 안내 한 줄', () => {
    const src = read('src/addons/perf/panel.js');
    const keptNumber = new Function(`${/const keptNumber = [^\n]*\n/.exec(src)[0]};return keptNumber;`)();
    assert.equal(keptNumber('5000', 30, 0), 5000); assert.equal(keptNumber('50000', 500, 20), 50000);
    assert.equal(keptNumber('', 500, 20), 500, '빈 칸이면 전 값'); assert.equal(keptNumber('7', 500, 20), 20, '아래쪽 20 그대로');
    assert.match(src, /store\.keepBodies = keptNumber\(event\.target\.value, store\.keepBodies, 0\);/);
    assert.match(src, /store\.maxEntries = keptNumber\(event\.target\.value, store\.maxEntries, 20\);/);
    noMax(inputWith(src, 'rl-keep"'), '본문 보관'); noMax(inputWith(src, 'rl-max"'), '기록 보관');
    assert.match(src, /<small class="rl-hint rl-keep-warn" hidden><\/small>/, '안내 자리');
    assert.match(src, /const KEEP_WARN_AT = 500, MAX_WARN_AT = 5000;/);
    assert.match(src, /box\.hidden = !big\.length;/, '넘을 때만 보여요');
    const state = read('src/addons/perf/state.js');
    const clampInt = new Function(`${/function clampInt\([\s\S]*?\n}\n/.exec(state)[0]};return clampInt;`)();
    assert.match(state, /store\.maxEntries = clampInt\(store\.maxEntries, 20, Infinity, DEFAULTS\.maxEntries\);/);
    assert.match(state, /store\.keepBodies = clampInt\(store\.keepBodies, 0, Infinity, DEFAULTS\.keepBodies\);/);
    assert.equal(clampInt(50000, 20, Infinity, 500), 50000); assert.equal(clampInt(500, 20, Infinity, 500), 500, '옛 값 그대로'); assert.equal(clampInt('x', 0, Infinity, 30), 30);
});
await test('사용량 장부 환율 · 중계 비교(충전 · 환율 · 출력 비): 위쪽 상한 없음 — 10배 값이 저장 · 셈에 그대로', async () => {
    const ext = {};
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced() {} }) };
    const L = await load('src/usage-ledger-lite.js');
    assert.equal(L.setKrwRate(999990), true, '예전 끝(99,999)의 10배'); assert.equal(L.ledgerSettings().krw.rate, 999990);
    assert.equal(L.setKrwRate(1400), true); assert.equal(L.ledgerSettings().krw.rate, 1400, '보통 값');
    assert.equal(L.setKrwRate(0), false, '0 이하는 그대로 거절'); assert.equal(L.setKrwRate(Infinity), false, '무한은 거절');
    assert.equal(L.setRelayRate('https://relay.example', 5e6), true, '중계 환산도 위쪽 상한 없음'); assert.equal(L.ledgerSettings().relayRates['https://relay.example'].rate, 5e6);
    ext.bl_usage_ledger.relayRates['https://old.example'] = { rate: 1332.1, source: '', date: '2026-11-01' };
    assert.equal(L.ledgerSettings().relayRates['https://old.example'].rate, 1332.1, '옛 값은 그대로');
    delete globalThis.SillyTavern;
    const view = read('src/addons/perf/relay-compare-view.js');
    const open = new Function(`${/const open = [^\n]*\n/.exec(view)[0].replace(/\/\/.*$/m, '')};return open;`)();
    assert.equal(open(99990), true, '충전 10배'); assert.equal(open(9990), true, '환율 10배'); assert.equal(open(1000), true, '출력 비 10배');
    assert.equal(open(0), false); assert.equal(open(Infinity), false);
    assert.match(view, /numberField\('\.rl-cmp-cny', 'cnyPerUsd', 0\.1\); numberField\('\.rl-cmp-quota', 'quotaPrice', 0\.01\);/);
    assert.match(view, /numberField\('\.rl-cmp-out', 'outPerIn', 1\);/);
    assert.match(view, /numberField\('\.rl-cmp-cache', 'cacheShare', 0, 100\)/, '캐시(입력의 %)는 백분율이라 0~100 그대로');
    for (const k of ['rl-cmp-quota', 'rl-cmp-cny', 'rl-cmp-out']) noMax(inputWith(view, `${k}"`), k);
    assert.match(inputWith(view, 'rl-cmp-cache"'), /max="100"/, '백분율 칸은 그대로');
    noMax(inputWith(read('src/addons/perf/ledger-view.js'), 'rl-ledger-krw"'), '환율');
});

// ── 번역 · 리모컨 ───────────────────────────────────────────
await test('번역: 최대 응답 토큰(따라가기) · 참고할 최근 대화 개수는 위쪽 상한 없음 — 슬라이더는 끝에 붙어 있어요', () => {
    const html = read('src/addons/translator/index.html'), js = read('src/addons/translator/index.js');
    noMax(inputWith(html, 'id="llm_profile_max_tokens"'), '최대 응답 토큰');
    assert.match(js, /extensionSettings\.profile_max_tokens = Math\.max\(0, Math\.floor\(Number\(this\.value\) \|\| 0\)\);/);
    const handler = v => Math.max(0, Math.floor(Number(v) || 0));
    assert.equal(handler('1600000'), 1600000, '예전 끝(160000)의 10배');
    assert.match(inputWith(html, 'id="llm_context_message_count"'), /max="20"/, '슬라이더는 20 끝 그대로');
    assert.match(inputWith(html, 'id="llm_context_message_count_value"'), /max="Infinity"/, '숫자 칸은 위쪽 상한 없음');
    assert.match(js, /const value = Math\.max\(1, parseInt\(\$\(this\)\.val\(\)\) \|\| 5\);/);
    assert.doesNotMatch(js, /Math\.min\(20, Math\.max\(1, parseInt/);
});
await test('번역: Max Response Length 다섯 칸 — 숫자 칸은 max="Infinity"(브라우저는 무시 · 실리태번 손 입력 검사는 통과) · 저장 때 자르지 않음 · 넘으면 안내', () => {
    const html = read('src/addons/translator/index.html'), js = read('src/addons/translator/index.js');
    for (const p of ['openai', 'claude', 'cohere', 'google', 'vertexai']) {
        assert.match(inputWith(html, `id="max_length_${p}"`), /max="Infinity"/, `${p} 숫자 칸`);
        assert.match(inputWith(html, `id="max_length_${p}_slider"`), /max="160000"/, `${p} 슬라이더는 끝에 붙어 있어요`);
    }
    // 실리태번 본체(public/script.js)의 손 입력 검사: manualInput >= Number(min) && manualInput <= Number(max)
    const stCheck = (value, min, max) => Number(value) >= Number(min) && Number(value) <= Number(max);
    assert.equal(stCheck('1600000', '0', 'Infinity'), true, '10배 값도 「Invalid value」 경고 없이 지나가요');
    assert.equal(stCheck('1600000', '0', undefined), false, '(max 를 그냥 지우면 본체가 경고해요 — 그래서 Infinity)');
    // saveParameterValues 의 끝값 자르기: parseFloat('Infinity') 는 유한하지 않아 자르지 않아요
    const clip = (raw, minAttr, maxAttr) => { let value = parseFloat(raw); const lo = parseFloat(minAttr), hi = parseFloat(maxAttr); if (Number.isFinite(lo) && value < lo) value = lo; if (Number.isFinite(hi) && value > hi) value = hi; return value; };
    assert.equal(clip('1600000', '0', 'Infinity'), 1600000); assert.equal(clip('4000', '0', 'Infinity'), 4000, '옛 값 그대로'); assert.equal(clip('0', '1', 'Infinity'), 1, 'Claude 아래쪽 1 그대로');
    assert.equal(clip('3', '0', '2'), 2, 'Temperature 같은 정의 범위 칸은 그대로 잘라요');
    assert.match(js, /if \(Number\.isFinite\(hi\) && value > hi\) value = hi;/);
    assert.match(html, /<small id="llm_max_length_warn" class="llmt-desc" style="display:none">Max Response Length 가 160000 을 넘었어요\./);
    assert.match(js, /\$\('#llm_max_length_warn'\)\.toggle\(Number\(\$\(`#max_length_\$\{suffix\}`\)\.val\(\)\) > MAX_LENGTH_WARN_AT\);/);
    assert.match(js, /const MAX_LENGTH_WARN_AT = 160000;/);
    assert.match(inputWith(html, 'id="temperature_openai"'), /max="2"/, 'Temperature 는 그대로');
});

// ── 한글화 패널 · 다시 쓰기 ─────────────────────────────────────
await test('한글화 패널: 최대 응답 토큰 · 묶음 · 대기 · 재시도 · 제한 시간은 위쪽 상한 없음, 동시 요청은 8 을 넘으면 안내 · 타이머 값만 타이머 끝에서 멈춤', () => {
    const ui = read('src/addons/prompt/settings-ui.js'), js = read('src/addons/prompt/index.js'), con = read('src/addons/prompt/connection.js');
    const number = new Function('field', `${/ const number=[^\n]*\n/.exec(ui)[0].replace(/\/\/.*$/m, '')};return number;`)((id, label, input) => input);
    assert.equal(number('x', 'x', 5, 0, null), '<input id="x" type="number" min="0" value="5">', 'max 를 비우면 속성이 없어요');
    assert.equal(number('x', 'x', 5, 0, 9), '<input id="x" type="number" min="0" max="9" value="5">');
    for (const id of ['pt-active-max', 'pt-title-batch', 'pt-concurrency', 'pt-req-delay', 'pt-max-retries', 'pt-req-timeout']) assert.match(ui, new RegExp(`number\\('${id}',.{0,80}?,(?:0|1|5),null[,)]`), `${id}: max 없음`);
    assert.match(con, /cfg\(\)\.activeMaxTokens=Math\.max\(0,parseInt\(event\.target\.value,10\)\|\|0\);/);
    const getters = /const TIMER_MAX_MS[\s\S]*?const requestTimeoutMs= [^\n]*\n/.exec(js)[0];
    const make = cfgValue => new Function('cfg', `${getters};return { titleBatchSize: titleBatchSize(), requestDelayMs: requestDelayMs(), concurrency: concurrency(), maxRetries: maxRetries(), requestTimeoutMs: requestTimeoutMs() };`)(() => cfgValue);
    assert.deepEqual(make({ titleBatchSize: 500, requestDelayMs: 600000, concurrency: 80, maxRetries: 50, requestTimeoutMs: 6000000 }), { titleBatchSize: 500, requestDelayMs: 600000, concurrency: 80, maxRetries: 50, requestTimeoutMs: 6000000 }, '예전 상한의 10배가 그대로 쓰여요');
    assert.deepEqual(make({ titleBatchSize: 15, requestDelayMs: 60, concurrency: 1, maxRetries: 2, requestTimeoutMs: 120000 }), { titleBatchSize: 15, requestDelayMs: 60, concurrency: 1, maxRetries: 2, requestTimeoutMs: 120000 }, '옛 기본값 그대로');
    assert.equal(make({ requestTimeoutMs: 1e15 }).requestTimeoutMs, 2147483647, '타이머 끝(약 24.8일)을 넘기면 바로 터지니 거기서 멈춰요');
    assert.equal(make({ requestTimeoutMs: 1000 }).requestTimeoutMs, 5000, '아래쪽 5초 그대로');
    for (const cap of ['if (v > 50) v = 50;', 'if (v > 60000) v = 60000;', 'if (v > 8) v = 8;', 'if (v > 5) v = 5;', 'if (v > 600) v = 600;']) assert.ok(!js.includes(cap), `바꿀 때 자르기가 없어요: ${cap}`);
    assert.match(ui, /<p id="pt-concurrency-warn" class="pt-bl-help" style="\$\{c\.concurrency>8\?'':'display:none'\}">동시 요청이 8개를 넘었어요\./);
    assert.match(js, /\$\('#pt-concurrency-warn'\)\.toggle\(v > 8\);/);
});
await test('다시 쓰기: 제한 시간 · 시도 횟수 · 찾을 메시지 수 · 응답 토큰 · 겹침 비교 수 · 최소 글자 수는 위쪽 상한 없음 · 겹침 기준(%)은 그대로', () => {
    const js = read('src/addons/rewrite/index.js'), html = read('src/addons/rewrite/settings-html.js');
    for (const id of ['bwr_max_tokens', 'bwr_scene_attempts', 'bwr_scene_timeout', 'bwr_timeout', 'bwr_attempts', 'bwr_lookback', 'bwr_repeat_lookback', 'bwr_repeat_min']) noMax(inputWith(html.replace(/\\"/g, '"'), `id="${id}"`), id);
    assert.match(inputWith(html.replace(/\\"/g, '"'), 'id="bwr_repeat_threshold"'), /max="95"/, '백분율 칸은 그대로');
    for (const line of ["bindNumber('#bwr_scene_attempts', 'maxAttempts', 1);", "bindNumber('#bwr_scene_timeout', 'timeoutSec', 30);", "bindNumber('#bwr_timeout', 'timeoutSec', 10);", "bindNumber('#bwr_attempts', 'maxAttempts', 1);", "bindNumber('#bwr_lookback', 'lookback', 0);", "bindNumber('#bwr_max_tokens', 'maxTokens', 256);", "bindRepeatNumber('#bwr_repeat_lookback', 'lookback', 1);", "bindRepeatNumber('#bwr_repeat_threshold', 'threshold', 30, 95);", "bindRepeatNumber('#bwr_repeat_min', 'minLength', 6);"]) assert.ok(js.includes(line), line);
    const integerInput = new Function(`${/function integerInput\([\s\S]*?\n}\n/.exec(js)[0]};return integerInput;`)();
    const bind = (raw, min, max = Infinity, fallback = 120) => Math.min(max, Math.max(min, integerInput(raw, fallback)));
    assert.equal(bind('6000', 10), 6000, '제한 시간 600초의 10배'); assert.equal(bind('655360', 256), 655360, '응답 토큰 65536 의 10배'); assert.equal(bind('50', 1), 50, '시도 5 의 10배');
    assert.equal(bind('120', 10), 120, '옛 값 그대로'); assert.equal(bind('3', 10), 10, '아래쪽 그대로'); assert.equal(bind('99', 30, 95), 95, '백분율은 그대로');
    assert.match(js, /\}, Math\.min\(2147483647, settings\.timeoutSec \* 1000\)\);/, '타이머 끝에서만 멈춰요');
    assert.match(read('src/addons/rewrite/reroll.js'), /const timer = setTimeout\(abort, Math\.min\(2147483647, seconds \* 1000\)\);/);
});

// ── TTS ──────────────────────────────────────────────────
await test('TTS: 한 번에 최대 글자 · 효과음 지문 글자 · 번역 기다리는 초 · 캐시 개수 · MB 는 위쪽 상한 없음 · 소리 대본 쉼은 넘으면 안내', () => {
    const ui = read('src/addons/tts/src/ui.js'), settings = read('src/addons/tts/src/settings.js');
    for (const key of ['max_chars', 'sfx.scene_chars', 'translation_timeout', 'cache_limit', 'cache_mb']) {
        const line = new RegExp(`\\{ key: '${key.replace('.', '\\.')}',[^\\n]*`).exec(ui)[0];
        assert.doesNotMatch(line.split('default:')[0], /\bmax:/, `${key}: max 가 없어 coerce 도 안 잘라요`);
    }
    for (const key of ['playback_rate', 'master_volume', 'sfx.volume', 'target_lufs']) assert.match(new RegExp(`\\{ key: '${key.replace('.', '\\.')}',[^\\n]*`).exec(ui)[0], /\bmax:/, `${key}: 정의 범위는 그대로`);
    const block = /export const SCENE_CHARS = [^\n]*\nexport function sceneCharsOf\([\s\S]*?\n}\n/.exec(settings)[0].replace(/export /g, '');
    const sceneCharsOf = new Function(`${block};return sceneCharsOf;`)();
    assert.equal(sceneCharsOf(400000), 400000, '예전 끝(40,000)의 10배'); assert.equal(sceneCharsOf(4000), 4000, '옛 값'); assert.equal(sceneCharsOf(12), 1000, '아래쪽 1,000'); assert.equal(sceneCharsOf('x'), 4000);
    assert.match(read('src/addons/tts/src/player.js'), /const waitTimeoutMs = \(s\) => Math\.min\(2147483647, Math\.max\(1, Number\(s\.translation_timeout\) \|\| 90\) \* 1000\);/);
    assert.match(read('src/addons/tts/src/pregen.js'), /const waitMs = \(s\) => Math\.min\(2147483647, Math\.max\(1, Number\(s\.translation_timeout\) \|\| 90\) \* 1000\);/);
    const store = read('src/addons/tts/src/script-store.js');
    const number = new Function(`${/const number = \([\s\S]*?\n};\n/.exec(store)[0]};return number;`)();
    assert.equal(number(100000, 0, 0, Infinity), 100000, '쉼 10초의 10배');
    assert.match(store, /gapMs: Math\.round\(number\(r\.gapMs, r\.kind === 'pause' \? 500 : 0, 0, Infinity\)\),/);
    assert.match(read('src/addons/tts/src/script-editor.js'), /const gap = input\(row, 'gapMs', 'number', 0\);[^\n]*위쪽 제한은 없지만, 10초가 넘게 쉬면 소리 파일로 내려받을 때 그만큼 메모리를 더 써요\./);
});

// ── 북마크 · 전개 지시 · 정규식 · 에셋 ─────────────────────────────
await test('북마크: 한 페이지 개수 · 앞뒤 문맥 범위는 위쪽 상한 없음(단계 칸 data-max 없음 · ± 단추도)', () => {
    const view = read('src/addons/bookmarks/settings-view.js');
    const stepper = new Function(`${/function stepper\([\s\S]*?\n}\n/.exec(view)[0]};return stepper;`)();
    const tag = stepper('itemsPerPage', 1, null, 500);
    assert.doesNotMatch(tag, /data-max|max="/, '위쪽 상한 없음'); assert.match(tag, /data-min="1"/); assert.match(tag, /value="500"/);
    assert.match(stepper('x', 0, 9, 1), /data-max="9"[\s\S]*max="9"/, 'max 를 주면 예전처럼');
    assert.match(view, /const max = box\.dataset\.max === undefined \? Infinity : Number\(box\.dataset\.max\);/);
    assert.match(read('src/addons/bookmarks/viewers.js'), /const next = Math\.max\(0, settings\(\)\.contextRange \+ Number\(button\.dataset\.step\)\);/);
});
await test('전개 지시 깊이: 테마 상한(100)을 빼고 실리태번 본체 끝(MAX_INJECTION_DEPTH 10000)만', () => {
    const js = read('src/addons/direction/index.js');
    const clampDepth = new Function(`${/const ST_MAX_DEPTH = 10000;\nfunction clampDepth\([\s\S]*?\n}\n/.exec(js)[0]};return clampDepth;`)();
    assert.equal(clampDepth(1000), 1000, '예전 상한 100 의 10배'); assert.equal(clampDepth(4), 4, '옛 값'); assert.equal(clampDepth(20000), 10000, '본체 끝'); assert.equal(clampDepth(-1), 0);
    assert.match(js, /<input type="number" data-field="depth" min="0" max="10000"/);
});
await test('정규식: 최근 메시지 수 · 성능 보조 한도 열 칸은 위쪽 상한 없음(아래쪽만)', () => {
    const idx = read('src/addons/regexlink/index.js'), perf = read('src/addons/regexlink/regexperf.js');
    assert.match(idx, /s\.recent = Math\.max\(1, Math\.floor\(Number\(s\.recent\)\)\) \|\| 30\);|s\.recent = Math\.max\(1, Math\.floor\(Number\(s\.recent\)\) \|\| 30\);/);
    const recent = v => Math.max(1, Math.floor(Number(v)) || 30);
    assert.equal(recent(2000), 2000, '예전 상한 200 의 10배'); assert.equal(recent(30), 30); assert.equal(recent(0), 30, '0 · 빈 값은 기본 30'); assert.equal(recent(-5), 1);
    noMax(inputWith(idx, 'data-recent'), '최근 메시지 수');
    const LIMITS = new Function(`${/const LIMITS = [^\n]*\n/.exec(perf)[0]};return LIMITS;`)();
    assert.equal(Object.keys(LIMITS).length, 10);
    for (const [key, [min, max]] of Object.entries(LIMITS)) { assert.equal(max, Infinity, `${key}: 위쪽 상한 없음`); assert.ok(Number.isFinite(min), `${key}: 아래쪽은 그대로`); }
    assert.match(perf, /el\.min = String\(min\); if \(Number\.isFinite\(max\)\) el\.max = String\(max\);/);
    const change = (raw, [min, max], prev) => { const v = Number(raw); return raw.trim() !== '' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : prev; };
    assert.equal(change('1000', LIMITS.breakerCount, 3), 1000, '브레이커 횟수 100 의 10배'); assert.equal(change('40960', LIMITS.memoMaxMB, 64), 40960, '캐시 4096MB 의 10배');
});
await test('캐릭터 에셋: 한 답에 고를 그림 수는 위쪽 상한 없음(1장부터)', () => {
    const panel = read('src/addons/assets/panel.js'), state = read('src/addons/assets/state.js');
    noMax(inputWith(panel, 'data-pick-field="count"'), '고를 그림 수');
    assert.match(panel, /pick\.count = String\(value\)\.trim\(\) === '' \|\| !Number\.isFinite\(n\) \? 2 : Math\.max\(1, n\);/);
    assert.match(state, /pick\.count = pick\.count == null \|\| pick\.count === '' \|\| !Number\.isFinite\(n\) \? 2 : Math\.max\(1, n\); \}/);
});

// ── 채팅 캡처 · 글 도구 · 리모컨 ─────────────────────────────────
await test('채팅 캡처: 재생 시간 · 최대 용량 · 파일당 문단 수는 위쪽 상한 없음 — 저장 정리 · 그리기에도 10배 그대로', async () => {
    const opts = read('src/capture-options.js');
    for (const key of ['duration', 'maxMB', 'maxParagraphs']) noMax(inputWith(opts, `data-capture-option="${key}"`), key);
    assert.match(inputWith(opts, 'data-capture-option="backgroundTint"'), /max="100"/, '배경 테마색(%)은 그대로');
    assert.match(opts, /<small>3초부터 · 30초가 넘으면 파일이 커지고 만드는 데 오래 걸려요\(전체 200MB 를 넘으면 멈춰요\)<\/small>/, '재생 시간 안내 한 줄');
    const settings = read('src/settings.js');
    const tidy = new Function('s', `${/    s\.captureTools\.maxParagraphs=[^\n]*\n    s\.captureTools\.duration=[^\n]*\n/.exec(settings)[0]}${/    s\.captureTools\.maxMB=[^\n]*\n/.exec(settings)[0]};return s.captureTools;`);
    assert.deepEqual({ ...tidy({ captureTools: { maxParagraphs: 200, duration: 300, maxMB: 2000 } }) }, { maxParagraphs: 200, duration: 300, maxMB: 2000 }, '예전 상한(20 · 30 · 200)의 10배');
    assert.deepEqual({ ...tidy({ captureTools: { maxParagraphs: 4, duration: 6, maxMB: 8 } }) }, { maxParagraphs: 4, duration: 6, maxMB: 8 }, '옛 값 그대로');
    assert.deepEqual({ ...tidy({ captureTools: { maxParagraphs: 0, duration: 1, maxMB: -1 } }) }, { maxParagraphs: 4, duration: 3, maxMB: 0 }, '아래쪽 그대로');
    const { motionLayout } = await load('src/capture-motion-layout.js');
    assert.equal(motionLayout({ width: 1170, height: 450, scale: 3 }, { duration: 300 }).duration, 300, '그리기에도 300초 그대로');
    assert.match(read('src/capture-layout.js'), /count=Math\.max\(1,Math\.floor\(Number\(maxParagraphs\)\|\|4\)\);/);
    assert.match(read('src/capture-video.js'), /Math\.min\(2147483647,duration\+10000\)/);
    assert.match(read('src/capture-options.js'), /bytes>200\*1024\*1024/, '결과 전체 200MB 안전 한계(설정 아님)는 그대로');
});
await test('글 도구: 「이전 채팅 불러오기」 추가할 메시지 수는 위쪽 상한 없음', () => {
    const src = read('src/word-tools.js');
    noMax(inputWith(src, 'name="count"'), '추가할 메시지 수');
    assert.match(src, /if\(Number\.isInteger\(count\)&&count>=1\)dialog\.close\(\);\}/);
});
await test('번역 리모컨: 막대 끝(120px)은 그대로 · 숫자 칸과 저장값은 위쪽 상한 없음', async () => {
    const R = await load('src/addons/translator/remote.js');
    assert.equal(R.SIZE_MAX, 120, '막대 끝'); assert.equal(R.sanitizeLayout({ size: 1200 }).size, 1200); assert.equal(R.sanitizeLayout({ size: 44 }).size, 44);
});

console.log(`no-upper-caps: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
