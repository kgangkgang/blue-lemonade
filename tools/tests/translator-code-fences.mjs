// 번역 3.1.7 — 코드 칸 울타리 줄(``` · ~~~ 과 언어 이름)은 번역 요청에 보내지 않고 제자리에 글자 그대로 (code-fences.js · index.js translate).
//   전(3.1.6)에는 울타리 줄이 본문과 같이 가서, 모델이 울타리를 빼거나 언어 이름(html)을 바꾸면 그대로 붙었다 —
//   헬퍼가 그리는 화면 카드(```html <!DOCTYPE html> …)가 날 글로 보였다. 가짜 모델 답으로 확인(유료 호출 없음): 제대로 된 답 ·
//   문단 머리 울타리 자리표 빠짐 · 문단 가운데 울타리 자리표 빠짐 · 답 전체를 ``` 로 감쌈 · 울타리 없는 글(요청 글자 그대로) · 입력 번역(예전처럼).
//   인물 · 문장은 지어낸 것이에요.
//   실행: node tools/tests/translator-code-fences.mjs <사본>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate } from './translator-preset-harness.mjs';
const root = path.resolve(process.argv[2] || '.');
const F = await import(pathToFileURL(path.join(root, 'src/addons/translator/code-fences.js')));
const t = await loadTranslator(root);
t.S.translation_display_mode = 'disabled';
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const prompts = [];
const original = t.env.callLLMAPI;
t.env.callLLMAPI = async (full, extra) => { prompts.push(String(full)); return original(full, extra); };
const run = async (text, reply, options = {}) => {
    await t.reset(); prompts.length = 0; t.setReply(reply);
    const report = {};
    const out = await t.translate(text, { report, ...options });
    return { out, report, sent: t.events.join('\n<<>>\n') };
};
const FENCE_CHARS = /`{3}|~{3}/;

// ── 줄 고르기 (code-fences.js) ──
await test('울타리 줄 고르기: 여는 줄 · 닫는 줄 · 닫히지 않은 칸 · 줄 안 백틱 · 다른 글자', () => {
    const lines = text => F.fenceLines(text).map(r => text.slice(r.start, r.end));
    assert.deepEqual(lines('a\n```html\n<p>x</p>\n```\nb'), ['```html', '```']);
    assert.deepEqual(lines('  ````text\n```\nstill code\n  ````\nafter'), ['  ````text', '  ````'], '여는 것보다 짧은 ``` 는 닫는 줄이 아니에요');
    assert.deepEqual(lines('~~~\n```\n~~~'), ['~~~', '~~~'], '물결 칸 안의 ``` 는 글이에요');
    assert.deepEqual(lines('Use ```a``` inline\nnext'), [], '이름에 백틱이 있는 줄은 울타리가 아니에요');
    assert.deepEqual(lines('Story.\n\n```html\n<div>open'), ['```html'], '흘려받는 중 닫히지 않은 칸은 여는 줄만');
    assert.deepEqual(lines('```js\nx\n``` trailing words\n```'), ['```js', '```'], '뒤에 글이 붙은 줄은 닫는 줄이 아니에요');
    const crlf = 'a\r\n```text\r\nb\r\n```\r\nc';
    assert.deepEqual(lines(crlf), ['```text', '```'], 'CRLF 의 \\r 은 줄 글에 넣지 않아요');
    const masked = F.maskFences(crlf, line => `<${line}>`);
    assert.equal(masked.text, 'a\r\n<```text>\r\nb\r\n<```>\r\nc');
});

await test('빠진 울타리 자리표 되돌리기: 같은 줄 자리 · 줄 수가 안 맞으면 손대지 않음', () => {
    const src = 'Lead line\n[[__VAR_0__]]\ncode words\n[[__VAR_1__]]\nTail line\n\nNext paragraph';
    const tokens = ['[[__VAR_0__]]', '[[__VAR_1__]]'];
    assert.deepEqual(F.restoreFenceLines(src, '앞 줄\n코드 낱말\n[[__VAR_1__]]\n끝 줄\n\n다음 문단', tokens),
        { text: '앞 줄\n[[__VAR_0__]]\n코드 낱말\n[[__VAR_1__]]\n끝 줄\n\n다음 문단', restored: 1 });
    assert.deepEqual(F.restoreFenceLines(src, '앞 줄\n코드 낱말\n끝 줄\n\n다음 문단', tokens),
        { text: '앞 줄\n[[__VAR_0__]]\n코드 낱말\n[[__VAR_1__]]\n끝 줄\n\n다음 문단', restored: 2 });
    const merged = '앞 줄 코드 낱말 끝 줄\n\n다음 문단';
    assert.deepEqual(F.restoreFenceLines(src, merged, tokens), { text: merged, restored: 0 }, '줄을 합친 답은 자리를 믿을 수 없어요');
    const fewer = '앞 줄\n코드 낱말\n끝 줄 다음 문단';
    assert.deepEqual(F.restoreFenceLines(src, fewer, tokens), { text: fewer, restored: 0 }, '문단 수가 다르면 아래 보호 블록 되돌리기가 맡아요');
    assert.deepEqual(F.restoreFenceLines(src, src, tokens), { text: src, restored: 0 });
});

// ── translate() 전체 (가짜 모델) ──
const CARD = 'Mina stepped inside.\n\n```html\n<!DOCTYPE html><html><body><div class="box"><p>The door is locked.</p></div></body></html>\n```\n\nRex sighed.';
const want = text => text.split('\n').map(line => (/^[ \t]*(`{3,}|~{3,})/.test(line) ? line : fakeTranslate(line))).join('\n');

await test('화면 카드 코드 칸: 울타리 줄 · 언어 이름은 보내지 않고 글자 그대로 돌아와요 · 안 글은 번역 · 안내 한 줄은 이 요청에만', async () => {
    const r = await run(CARD, fakeTranslate);
    assert.ok(!FENCE_CHARS.test(r.sent) && !/\bhtml\n/.test(r.sent), `울타리 줄을 보냈어요\n${r.sent}`);
    assert.ok(r.sent.includes('The door is locked.'), '칸 안 글은 예전처럼 보내요');
    assert.equal(r.out, want(CARD));
    assert.ok(prompts.some(p => p.includes(F.FENCE_NOTE)), '울타리 자리표가 든 요청에는 안내 한 줄');
    assert.ok(!r.report.restoredBlocks, '제대로 된 답은 되돌린 것 없음(캐시 가능)');
});

await test('모델이 문단 머리 · 끝 울타리 자리표를 빼먹어도 제자리에 · 그런 답은 캐시하지 않아요', async () => {
    const r = await run(CARD, body => fakeTranslate(body).replace(/^\[\[__VAR_\d+__\]\]\n/m, '').replace(/\n\[\[__VAR_\d+__\]\]$/m, ''));
    assert.equal(r.out, want(CARD));
    assert.ok(r.report.restoredBlocks >= 2, JSON.stringify(r.report));
});

const INLINE = 'She typed slowly:\n```text\nHello from the lighthouse.\n```\nThen she waited.\n\nNo answer came.';
await test('빈 줄 없는 문단 가운데 코드 칸 — 빠진 여는 울타리도 같은 줄 자리에 (전엔 문단 끝으로 갔을 꼴)', async () => {
    const r = await run(INLINE, body => fakeTranslate(body).replace(/\[\[__VAR_\d+__\]\]\n/, ''));
    assert.equal(r.out, want(INLINE));
    assert.equal(r.report.restoredBlocks, 1);
});

await test('모델이 답 전체를 ``` 로 감싸면 그 울타리는 걷고 원문 울타리만 남아요', async () => {
    const r = await run(INLINE, body => '```\n' + fakeTranslate(body) + '\n```');
    assert.equal(r.out, want(INLINE));
});

await test('물결 울타리 · 네 백틱 · 들여 쓴 울타리도 글자 그대로', async () => {
    const text = 'Opening line.\n\n~~~poem\nThe sea is quiet.\n~~~\n\n  ````md\nA small note.\n  ````\n\nClosing line.';
    const r = await run(text, fakeTranslate);
    assert.ok(!FENCE_CHARS.test(r.sent) && !r.sent.includes('poem'), r.sent);
    assert.equal(r.out, want(text));
});

await test('울타리 없는 글은 요청 글자 그대로 (안내 줄 없음)', async () => {
    const text = 'Rain fell on the roof.\n\n"Are you awake?" Rex asked.';
    const r = await run(text, fakeTranslate);
    assert.ok(!prompts.some(p => p.includes(F.FENCE_NOTE)));
    assert.equal(r.out, fakeTranslate(text));
});

await test('입력 번역은 예전처럼 울타리를 그대로 보내요', async () => {
    const text = '```text\n안녕\n```';
    const r = await run(text, body => body, { isInputTranslation: true, prompt: 'Translate the following text into English.' });
    assert.ok(r.sent.includes('```text'), r.sent);
});

console.log(`translator-code-fences: ${passed} passed`);
