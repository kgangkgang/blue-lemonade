import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../../src/addons/perf/capture.js', import.meta.url), 'utf8');
const prefix = source.slice(source.indexOf('let PR ='), source.indexOf('export const pricingReady'));
const watchSource = source.slice(source.indexOf('async function watch('), source.indexOf('\nfunction safeChatId('));

let tries = 0, fail = true;
const ensure = new Function('load', `${prefix.replaceAll('import(', 'load(')}; return ensurePricing;`)(async () => {
    tries++;
    if (fail) throw Error('모듈 응답 없음');
    return { loadPriceCache() {}, connectionFor() {}, priceSnapshot() {} };
});
const first = ensure();
assert.equal(ensure(), first, '동시에 부르면 같은 받기 작업을 기다려요');
await assert.rejects(first, /모듈 응답 없음/);
assert.equal(tries, 3);
fail = false;
const loaded = await ensure();
assert.equal(typeof loaded.connectionFor, 'function');
assert.equal(await ensure(), loaded);
assert.equal(tries, 6, '실패 뒤 다시 받고 성공한 모듈은 재사용해요');

const warnings = [];
const watch = new Function('PR', 'ensurePricing', 'console', `${watchSource}; return watch;`)(null,
    async () => { throw Error('모듈 응답 없음'); }, { warn: (...args) => warnings.push(args) });
const input = '/api/backends/chat-completions/generate';
const init = { method: 'POST', body: '{"messages":[]}', signal: new AbortController().signal };
const response = { ok: true, marker: Symbol('원래 응답') };
let sends = 0;
assert.equal(await watch(async (url, options) => {
    sends++; assert.equal(url, input); assert.equal(options, init); return response;
}, input, init, {}, '검사'), response);
assert.equal(sends, 1, '가격표 실패가 원래 요청을 막거나 중복 전송하지 않아요');
assert.equal(warnings.length, 1);

const failure = new Error('원래 요청 실패');
await assert.rejects(watch(async () => { sends++; throw failure; }, input, init, {}, '검사'), error => error === failure);
assert.equal(sends, 2, '원래 요청의 실패도 재전송 없이 그대로 돌려줘요');
console.log('가격 모듈 받기 공유·재시도·원래 요청 한 번 전송·원래 오류 보존을 확인했어요.');
