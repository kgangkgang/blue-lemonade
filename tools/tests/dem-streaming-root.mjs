// 8.2.7 perf-fade: 데우스 하늘(src/dem-sky.js)의 「답장 받는 중」 표식은 body 가 아니라 html 에 달아요 —
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

test('답장 토큰이 오면 html 에 표식, 끝나면 뗌 — body class 는 건드리지 않아요', () => {
    for (let i = 0; i < 5; i++) events.token?.('글');
    assert.equal(html.classList.contains('salty-dem-streaming'), true);
    events.end?.();
    assert.equal(html.classList.contains('salty-dem-streaming'), false);
    assert.equal(html.classList.writes, 2, '토큰 다섯 개에도 붙이기 1 · 떼기 1');
    assert.equal(body.classList.writes, 0, 'body class 기록 0');
});
test('CSS 는 html 표식을 봐요(원본 · style.css · 미리보기 사본) — body 표식 규칙은 남지 않아요', () => {
    const src = read('css/30-dem-skin.css'), built = read('style.css');
    assert.equal((src.match(/html\.salty-dem-streaming body\.salty\.salty-dem-skin #chat \.mes\.last_mes/g) || []).length, 3);
    for (const text of [src, built, read('css/23-preview.gen.css')]) assert.doesNotMatch(text, /body\.salty\.salty-dem-skin\.salty-dem-streaming/);
    assert.ok(built.includes('html.salty-dem-streaming body.salty.salty-dem-skin :is(#chat,.bl-chat-like) .mes.last_mes'));
});
test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/dem-streaming-root\.mjs \./));
console.log(`\n${passed} passed`);
process.exit(0);
