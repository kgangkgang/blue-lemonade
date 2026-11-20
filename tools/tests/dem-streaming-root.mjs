// 8.2.7 perf-fade: 데우스 하늘(src/dem-sky.js)의 「답장 받는 중」 표식은 body 가 아니라 html 에 달았어요 —
//   1.9.1(확장켠-스트리밍): 보는 CSS 가 0개(1.0.0 부터)라 html 에도 안 달아요 — html class 한 번에 문서 전체 다시 계산(첫 토큰 · 끝)이었어요.
//   body class 를 바꾸면 기록마다 실리태번 keyboard.js 가 body 아래 전부를 선택자 31개로 다시 훑고, body 를 보는 테마 감시자도 다시 돌았어요(답장마다 두 번).
//   CSS(css/30-dem-skin.css · style.css · 미리보기 사본)도 html 표식을 봐요. 모양은 같아요.
//   node tools/tests/dem-streaming-root.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

const classes = () => { const set = new Set(); return { set, writes: 0, contains: c => set.has(c), toggle(c, f) { const want = f === undefined ? !set.has(c) : !!f; if (want !== set.has(c)) { this.writes++; if (want) set.add(c); else set.delete(c); } return want; }, add(c) { this.writes++; set.add(c); }, remove(c) { this.writes++; set.delete(c); } }; };
const html = { classList: classes() }, body = { classList: classes() };
const events = {};
globalThis.document = { documentElement: html, body, querySelectorAll: () => [], getElementById: () => null };
globalThis.SillyTavern = { getContext: () => ({ eventSource: { on: (n, f) => { events[n] = f; }, removeListener: n => { delete events[n]; } }, event_types: { CHAT_CHANGED: 'chat', CHARACTER_MESSAGE_RENDERED: 'char', STREAM_TOKEN_RECEIVED: 'token', GENERATION_ENDED: 'end', GENERATION_STOPPED: 'stop', MESSAGE_RECEIVED: 'recv' } }) };
globalThis.MutationObserver = class { observe() { } disconnect() { } takeRecords() { } };
const sky = await import(pathToFileURL(path.join(root, 'src/dem-sky.js')).href);
sky.syncDemSky(true);

test('답장 토큰이 오면 「받는 중」으로 보고 끝나면 풀어요 — html · body class 는 둘 다 건드리지 않아요(1.9.1)', () => {
    for (let i = 0; i < 5; i++) events.token?.('글');
    assert.equal(sky.demStreaming(), true);
    events.end?.();
    assert.equal(sky.demStreaming(), false);
    assert.equal(html.classList.writes, 0, 'html class 기록 0 — 보는 CSS 가 없는데 html class 를 바꾸면 문서 전체를 다시 계산해요');
    assert.equal(body.classList.writes, 0, 'body class 기록 0');
});
test('CSS 에 「답장 받는 중」 문서 표식 규칙이 없어요(원본 · style.css · 미리보기 사본) — 다시 생기면 이 시험과 dem-sky 를 같이 고쳐요', () => {
    const src = read('css/30-dem-skin.css'), built = read('style.css');
    // 1.0.0 시안 A: 답장 중에 쉬게 하던 비싼 층(빛무리 · 하늘 7층 · 묶음 띠)이 없어져 쉬게 하는 규칙도 0개 — 다시 생기면 html 표식으로만
    for (const text of [src, built, read('css/23-preview.gen.css')]) assert.doesNotMatch(text, /body\.salty\.salty-dem-skin\.salty-dem-streaming/);
    for (const text of [src, built, read('css/23-preview.gen.css')]) assert.doesNotMatch(text, /salty-dem-streaming/, '표식을 안 다니 규칙도 0개');
});
test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/dem-streaming-root\.mjs \./));
console.log(`\n${passed} passed`);
process.exit(0);
