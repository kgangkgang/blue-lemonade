// 7.7.1 사용량 장부 · 요청 로그: 응답 usage 의 입력(또는 출력) 토큰이 null · 0 이면 그 칸만 글로 세고 estimated 로 표시한다
//   (예전: usage 가 오기만 하면 입력 0 을 실제 값으로 적음). 순수 함수 settleTokens + capture.js 가 그것을 쓰는지.
//   node tools/tests/usage-unknown-tokens.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { settleTokens, mergeTokenUsage } = await import(pathToFileURL(path.join(root, 'src/addons/perf/pricing.js')).href);
const count = async text => text.length;
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('  PASS  ' + name); };
await t('입력 토큰 null (OpenAI 꼴) → 입력만 세고 estimated, 출력은 응답 값', async () => {
    const usage = mergeTokenUsage(null, { prompt_tokens: null, completion_tokens: 12 });
    assert.deepEqual(await settleTokens({ usage, promptText: 'abcdefgh', replyText: 'xyz', count }), { prompt: 8, completion: 12, estimated: true });
});
await t('입력 0 · 출력 0 (빈 usage 칸) → 둘 다 센다', async () => {
    const usage = mergeTokenUsage(null, { prompt_tokens: 0, completion_tokens: 0 });
    assert.deepEqual(await settleTokens({ usage, promptText: 'abcd', replyText: 'xy', count }), { prompt: 4, completion: 2, estimated: true });
});
await t('Gemini usageMetadata 에 promptTokenCount 없음 → 입력만 센다', async () => {
    assert.deepEqual(await settleTokens({ usage: { prompt: 0, completion: 30 }, promptText: 'abcdef', replyText: 'r', count }), { prompt: 6, completion: 30, estimated: true });
});
await t('실제 값이 다 있으면 그대로, estimated 아님', async () => {
    const usage = mergeTokenUsage(null, { prompt_tokens: 120, completion_tokens: 40 });
    assert.deepEqual(await settleTokens({ usage, promptText: 'abc', replyText: 'x', count }), { prompt: 120, completion: 40, estimated: false });
});
await t('usage 없음 → 예전처럼 둘 다 센다', async () => {
    assert.deepEqual(await settleTokens({ usage: null, promptText: 'abc', replyText: 'xy', count }), { prompt: 3, completion: 2, estimated: true });
});
await t('셀 수 없는 요청(HTTP 오류 · 오류만 온 응답 · 글 아닌 요청)은 세지 않는다', async () => {
    assert.deepEqual(await settleTokens({ usage: null, promptText: 'abc', replyText: '', canPrompt: false, canCompletion: true, count }), { prompt: 0, completion: 0, estimated: false });
    assert.deepEqual(await settleTokens({ usage: null, promptText: 'abc', replyText: 'xy', canPrompt: true, canCompletion: false, count }), { prompt: 3, completion: 0, estimated: true });
});
await t('Anthropic 꼴: 캐시만 온 조각도 입력이 0 보다 크면 실제 값', async () => {
    const usage = mergeTokenUsage(null, { input_tokens: 0, cache_read_input_tokens: 500, output_tokens: 9 }, true);
    assert.deepEqual(await settleTokens({ usage, promptText: 'abc', replyText: 'x', count }), { prompt: 500, completion: 9, estimated: false });
});
await t('capture.js 가 settleTokens 로 토큰을 정한다 (예전 usageKnown 만 보던 길이 없다)', async () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/perf/capture.js'), 'utf8');
    assert.match(src, /await settleTokens\(\{ usage: acc\.usage, promptText, replyText: acc\.text \+ acc\.reasoning,/);
    assert.doesNotMatch(src, /if \(!usageKnown && promptText && httpOk/);
    assert.match(fs.readFileSync(path.join(root, 'src/addons/perf/hub.js'), 'utf8'), /SUITE_VERSION = '2\.3\.1'/);
});
console.log(`usage-unknown-tokens: ${n} passed`);
