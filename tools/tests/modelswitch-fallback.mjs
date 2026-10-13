// 모델 전환 6.2.9 「검열되면 다른 모델로」 — 공용 규칙(fallback.js) · 모델 전환 대상 · 각 애드온 연결
// node tools/tests/modelswitch-fallback.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const F = await import(pathToFileURL(path.join(root, 'src/addons/modelswitch/fallback.js')).href);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('  ok  ', name); };
const blockError = (msg = 'request blocked by Gemini API: PROHIBITED_CONTENT', extra = {}) => Object.assign(new Error(msg), extra);
const T = { provider: 'vertexai', model: 'fallback-model' };

console.log('모델 전환 「검열되면 다른 모델로」');

await test('fallbackOf: 켜져 있고 공급자 · 모델을 골랐을 때만', () => {
    assert.equal(F.fallbackOf(null), null);
    assert.equal(F.fallbackOf({}), null);
    assert.equal(F.fallbackOf({ fallback: { provider: 'vertexai' } }), null, '모델 없음');
    assert.equal(F.fallbackOf({ fallback: { model: 'x' } }), null, '공급자 없음');
    assert.equal(F.fallbackOf({ fallback: { enabled: false, provider: 'vertexai', model: 'x' } }), null, '꺼짐');
    assert.deepEqual(F.fallbackOf({ fallback: { provider: ' vertexai ', model: ' x ' } }), { provider: 'vertexai', model: 'x' });
});

await test('withFallback: 성공이면 다른 모델로 안 보낸다', async () => {
    let sent = 0;
    assert.equal(await F.withFallback(async () => 'ok', { target: T, send: async () => { sent++; return 'fb'; } }), 'ok');
    assert.equal(sent, 0);
});

await test('withFallback: 내용 차단이면 고른 모델로 딱 한 번 · onUsed', async () => {
    const sent = [], used = [];
    const out = await F.withFallback(async () => { throw blockError(); }, { target: T, send: async t => { sent.push(t); return 'fb'; }, onUsed: t => used.push(t.model) });
    assert.equal(out, 'fb');
    assert.deepEqual(sent, [T]);
    assert.deepEqual(used, ['fallback-model']);
    for (const msg of ['Candidate text empty', 'Bad Request', 'HTTP 400', 'finish_reason: SAFETY', 'content_filter', 'The prompt contains sensitive words']) {
        let n = 0;
        await F.withFallback(async () => { throw blockError(msg); }, { target: T, send: async () => { n++; return 'fb'; } });
        assert.equal(n, 1, msg);
    }
});

await test('withFallback: 429 · 401 · 5xx · 네트워크 · 시간 초과 · 멈춤은 차단이 아니다 (원래 오류 그대로)', async () => {
    const cases = [blockError('PROHIBITED_CONTENT', { status: 429 }), blockError('nope', { status: 401 }), blockError('PROHIBITED_CONTENT', { status: 503 }),
        new TypeError('Failed to fetch'), blockError('time out', { retry: true }), Object.assign(new Error('aborted'), { name: 'AbortError' })];
    for (const error of cases) {
        let sent = 0;
        await assert.rejects(F.withFallback(async () => { throw error; }, { target: T, send: async () => { sent++; return 'fb'; } }), e => e === error);
        assert.equal(sent, 0, error.message);
    }
});

await test('withFallback: 고른 곳이 없거나 본 모델과 같으면 원래 오류 그대로', async () => {
    const error = blockError();
    await assert.rejects(F.withFallback(async () => { throw error; }, { target: null, send: async () => 'fb' }), e => e === error);
    await assert.rejects(F.withFallback(async () => { throw error; }, { target: T, failed: { provider: 'vertexai', model: 'fallback-model' }, send: async () => 'fb' }), e => e === error);
    assert.equal(await F.withFallback(async () => { throw error; }, { target: T, failed: { provider: 'vertexai', model: 'main-model' }, send: async () => 'fb' }), 'fb', '다른 모델이면 보냄');
    await assert.rejects(F.withFallback(async () => { throw error; }, { target: T }), e => e === error, 'send 없음');
});

await test('withFallback: 다른 모델도 실패하면 짧은 오류 (cause · fallback · blocked)', async () => {
    const again = blockError('PROHIBITED_CONTENT again');
    await assert.rejects(F.withFallback(async () => { throw blockError(); }, { target: T, send: async () => { throw again; } }), e =>
        /다른 모델\(fallback-model\)도 실패/.test(e.message) && e.cause === again && e.blocked === true && e.fallback.blocked === true && e.fallback.model === 'fallback-model');
    const net = new TypeError('Failed to fetch');
    await assert.rejects(F.withFallback(async () => { throw blockError(); }, { target: T, send: async () => { throw net; } }), e => e.cause === net && e.fallback.blocked === false);
    const abort = Object.assign(new Error('stop'), { name: 'AbortError' });
    await assert.rejects(F.withFallback(async () => { throw blockError(); }, { target: T, send: async () => { throw abort; } }), e => e === abort, '멈춤은 그대로');
});

await test('withFallback: isBlocked 를 바꿀 수 있다 (번역의 refused 표시처럼)', async () => {
    let sent = 0;
    await F.withFallback(async () => { throw Object.assign(new Error('거절'), { refused: true }); }, { target: T, isBlocked: e => e?.refused === true, send: async () => { sent++; return 'fb'; } });
    assert.equal(sent, 1);
});

await test('fallbackTarget: 처음엔 꺼 둠 · 「안 씀」 · 고르면 저장 · 본 모델과 같으면 안 바꿈 · Custom 주소', () => {
    const holder = { custom_url: 'http://relay.example/v1' };
    let saves = 0;
    const t = F.fallbackTarget({ id: 'demo-fallback', name: '데모', sources: ['custom', 'vertexai'], settingsKey: 'demo', holder: () => holder,
        main: () => ({ source: 'custom', model: 'main-model' }), customUrl: s => s.custom_url, save: () => saves++ });
    assert.equal(t.defaultOff, true);
    assert.equal(t.name, '데모 (검열되면)');
    assert.equal(t.path, 'fallback');
    assert.deepEqual(t.read(), { follow: '안 씀' });
    assert.equal(t.apply({ source: 'custom', model: 'main-model' }), false, '본 모델과 같음');
    assert.equal(holder.fallback, undefined);
    assert.equal(t.apply({ source: 'custom', model: ' other ' }), true);
    assert.deepEqual(holder.fallback, { enabled: true, provider: 'custom', model: 'other' });
    assert.deepEqual(t.read(), { source: 'custom', model: 'other', url: 'http://relay.example/v1' });
    holder.fallback.enabled = false;
    assert.equal(t.apply({ source: 'vertexai', model: 'v' }), true);
    assert.equal(holder.fallback.enabled, false, '켜짐 스위치는 그대로');
    assert.equal(saves, 2);
    assert.equal(F.fallbackTarget({ id: 'x', name: 'x', holder: () => null }).read(), null);
});

await test('전역 API: 사설 확장이 같은 규칙을 쓴다', () => {
    const api = globalThis[Symbol.for('blue-lemonade.model-switch-fallback')];
    assert.equal(api?.version, 1);
    for (const name of ['isBlock', 'withFallback', 'fallbackOf', 'fallbackTarget', 'sameTarget']) assert.equal(typeof api[name], 'function', name);
    assert.equal(api.isBlock(blockError()), true);
    assert.equal(api.isBlock(blockError('x', { status: 429 })), false);
});

await test('모델 전환: 본 대상 바로 아래 「(검열되면)」 넷 · 처음엔 꺼 둠', () => {
    const src = read('src/addons/modelswitch/targets.js');
    assert.match(src, /import \{ fallbackTarget \} from '\.\/fallback\.js';/);
    assert.match(src, /const KNOWN = \[translator, translatorFallback, prompt, promptFallback, memory, rewrite, rewriteFallback, assets, assetsFallback\];/);
    for (const [name, url] of [['translator', 'custom_url'], ['prompt', 'customUrl'], ['rewrite', 'customUrl'], ['assets', 'customUrl']])
        assert.match(src, new RegExp(`const ${name}Fallback = fallbackFor\\(${name}, s => s\\.${url}\\);`));
    assert.match(src, /holder: \(\) => base\.settings\(\), main: \(\) => base\.read\(\)/);
    const idx = read('src/addons/modelswitch/index.js');
    assert.match(idx, /const isOn = target => store\(\)\.targets\[target\.id\] \?\? !\(target\.auto \|\| target\.defaultOff\);/, 'defaultOff 는 켤 때까지 꺼짐');
    assert.match(idx, /const inState = target => !\(target\.auto \|\| target\.defaultOff\) \|\| store\(\)\.targets\[target\.id\] === true;/, '상태 칩에는 켰을 때만');
});

await test('다시 쓰기: 본 요청을 감싸고 다른 모델은 직접 연결로 (리버스 프록시 없이)', () => {
    const src = read('src/addons/rewrite/index.js');
    assert.match(src, /import \{ fallbackOf, withFallback \} from '\.\.\/modelswitch\/fallback\.js';/);
    assert.match(src, /async function generateDirect\(messages, signal, via = null\) \{\n    const key = via \? providerKeyOf\(via\.provider\) : settings\.provider;/);
    assert.match(src, /if \(!via && settings\.useReverseProxy && settings\.reverseProxyUrl\)/);
    assert.match(src, /request = withFallback\(\(\) => main, \{ target: fallbackTo, failed: mainModel\(\), send: target => generateDirect\(messages, controller\.signal, target\) \}\);/);
    assert.match(src, /const fallbackTo = fallbackOf\(settings\);\n    if \(fallbackTo\) \{/, '고르지 않았으면 예전 그대로');
    assert.match(read('src/addons/rewrite/providers.js'), /export const providerKeyOf = source => Object\.keys\(PROVIDERS\)\.find\(key => PROVIDERS\[key\]\.source === source\)/);
});

await test('캐릭터 에셋: 고르기 요청을 감싼다 (프로필 · 직접 모두, 다른 모델은 직접)', () => {
    const src = read('src/addons/assets/pick.js');
    assert.match(src, /return withFallback\(\(\) => generatePickOnce\(messages, signal\), \{ target: fallbackOf\(pick\), failed: main, send: target => generatePickOnce\(messages, signal, target\) \}\);/);
    assert.match(src, /async function generatePickOnce\(messages, signal, via = null\) \{\n    const pick = pickSettings\(\);\n    if \(!via && pick\.connection === 'profile'\) \{/);
    assert.match(src, /applyModelRequestRules\(key, model, request\);/);
});

await test('한글화 패널: 재시도까지 끝난 뒤 한 번 · 멈춤이면 안 보냄', () => {
    const src = read('src/addons/prompt/index.js');
    assert.match(src, /return withFallback\(\(\) => runCompletionRetry\(messages, tweak\), \{ target: fallbackOf\(c\), failed: main,/);
    assert.match(src, /send: target => \{ if \(stopReq\) throw stopError\(\); return runCompletionOnce\(messages, tweak, target\); \}/);
    assert.match(src, /if \(!via && usingStProfile\(\)\) \{/);
    assert.match(src, /async function runCompletionRetry\(messages, tweak\) \{/);
});

await test('번역: 배치를 바꿔도 막힌 묶음만 · 다른 모델도 막히면 그 번역에서 다시는 안 보냄', () => {
    const src = read('src/addons/translator/index.js');
    assert.match(src, /import \{ fallbackOf, sameTarget \} from '\.\.\/modelswitch\/fallback\.js';/);
    assert.match(src, /const via = overrides\.via && overrides\.via\.provider && overrides\.via\.model \? overrides\.via : null;/);
    assert.match(src, /if \(!via && extensionSettings\.connection_mode !== 'direct'\) \{/);
    assert.match(src, /if \(!via && extensionSettings\.use_reverse_proxy\) \{/);
    assert.match(src, /let fallbackSpent = !fallbackTo \|\| sameTarget\(fallbackMain, fallbackTo\);/);
    assert.match(src, /if \(!error\?\.refused \|\| fallbackSpent\) throw error;/);
    assert.match(src, /try \{ out = await request\(prompt, \{ via: fallbackTo \}\); \}/);
    const wrap = src.slice(src.indexOf('const callWithLayouts = async (body, layouts) => {'), src.indexOf('let checkpointComplete = false;'));
    assert.equal((wrap.match(/fallbackSpent = true;/g) || []).length, 2, '실패 · 거절 둘 다 다시는 안 보냄');
    assert.match(wrap, /looksLikeInputBlock\(out\) \|\| looksLikeRefusal\(/, '다른 모델의 거절문도 번역으로 붙이지 않음');
    assert.match(src, /const request = async \(prompt, extra = \{\}\) => \{\n        watcher\.check\(\);\n        const result = await callLLMAPI\(prompt, \{ signal: watcher\.signal, \.\.\.extra \}\);/);
});

await test('CI 목록에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/modelswitch-fallback\.mjs \./);
});

console.log(`modelswitch-fallback: ${passed} passed, 0 failed`);
