// 7.0.3 메시지 머리 토큰 두 숫자 — 실리태번 숫자(만든 양) 옆 「· 보냄 N t」(src/sent-tokens.js · css/05-chat.css).
//   깊이 · 숨김 · 프롬프트용 정규식 · 매크로 · 캐시(다시 안 셈) · 보이는 메시지만 · 설정 chat.sentTokens(기본 켬). 지어낸 글만.
//   node tools/tests/sent-tokens.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const mod = await import(pathToFileURL(path.join(root, 'src/sent-tokens.js')).href);
const { promptDepths, cacheKey, sentText, sentLabel, visibleMessages, textHash } = mod;
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

await t('깊이 = 숨기지 않은 메시지 중 뒤에서 센 자리 (숨긴 메시지는 깊이 없음)', () => {
    const chat = [{ mes: 'a' }, { mes: 'b', is_system: true }, { mes: 'c' }, { mes: 'd', is_system: true }, { mes: 'e' }];
    assert.deepEqual([...promptDepths(chat)], [[4, 0], [2, 1], [0, 2]]);
});

await t('프롬프트용 정규식(사용자/답 · isPrompt · 깊이) 뒤 매크로 — 생각은 안 들어감', () => {
    const seen = [];
    const regex = { regex_placement: { USER_INPUT: 1, AI_OUTPUT: 2 }, getRegexedString: (text, place, opt) => { seen.push([place, opt]); return opt.depth > 5 ? 'summary only' : text.replace(/<prologue>[\s\S]*?<\/prologue>\s*/, ''); } };
    const m = { is_user: false, mes: '<prologue>long setup</prologue>\nHello {{user}}', extra: { reasoning: 'lots of thinking' } };
    assert.equal(sentText(m, 2, { regex, substitute: s => s.replace('{{user}}', 'Mina') }), 'Hello Mina');
    assert.equal(sentText(m, 9, { regex }), 'summary only', '깊이 5 밖은 요약만 보내는 규칙');
    assert.equal(sentText({ is_user: true, mes: 'hi' }, 0, { regex }), 'hi');
    assert.deepEqual(seen.map(([p, o]) => [p, o.isPrompt, o.depth]), [[2, true, 2], [2, true, 9], [1, true, 0]]);
    assert.equal(sentText(m, 0), m.mes, '정규식 엔진이 없으면 원문');
});

await t('표시 글 · 열쇠(사용자 · 깊이 · 글 · 정규식 표가 바뀌면 다름)', () => {
    assert.equal(sentLabel(3994), '3,994t'); assert.equal(sentLabel(12.4), '12t'); assert.equal(sentLabel(0, true), '0t · 숨김');
    const m = { is_user: false, mes: 'same text' };
    const k = cacheKey(m, 3, 's1');
    assert.equal(cacheKey({ ...m }, 3, 's1'), k);
    for (const other of [cacheKey(m, 4, 's1'), cacheKey({ ...m, mes: 'same text!' }, 3, 's1'), cacheKey(m, 3, 's2'), cacheKey({ ...m, is_user: true }, 3, 's1')]) assert.notEqual(other, k);
    assert.notEqual(textHash('ab'), textHash('ba'));
});

await t('보이는 메시지만: 첫 칸을 반으로 나눠 찾아 위치 읽기가 적다 (1,000개 중)', () => {
    let reads = 0;
    const list = Array.from({ length: 1000 }, (_, i) => ({ i, getBoundingClientRect() { reads++; return { top: i * 100 - 50000, bottom: i * 100 - 50000 + 100 }; } }));
    const chatEl = { querySelectorAll: () => list, getBoundingClientRect: () => ({ top: 0, bottom: 800 }) };
    const got = visibleMessages(chatEl, 0).map(x => x.i);
    assert.deepEqual(got, [500, 501, 502, 503, 504, 505, 506, 507]);
    assert.ok(reads < 40, `위치 읽기 ${reads}`);
    assert.deepEqual(visibleMessages(chatEl, 200).map(x => x.i), [498, 499, ...got, 508, 509]);
    assert.deepEqual(visibleMessages({ querySelectorAll: () => [] }), []);
});

await t('돌리기: 보이는 칸에 data-bl-sent · 숨김은 0 · 두 번째는 캐시(다시 안 셈) · 글이 바뀌면 다시 셈', async () => {
    const counters = [0, 1, 2].map(() => ({ dataset: {} }));
    const mes = [0, 1, 2].map(i => ({ getAttribute: () => String(i), querySelector: () => counters[i], getBoundingClientRect: () => ({ top: i * 50, bottom: i * 50 + 50 }) }));
    const chatEl = { querySelectorAll: () => mes, getBoundingClientRect: () => ({ top: 0, bottom: 600 }), addEventListener() {}, removeEventListener() {} };
    const chat = [{ is_user: true, mes: 'one two three' }, { is_user: false, mes: 'hidden reply', is_system: true }, { is_user: false, mes: 'four five' }];
    let calls = 0;
    globalThis.document = { getElementById: id => id === 'chat' ? chatEl : null, querySelectorAll: () => [] };
    globalThis.SillyTavern = { getContext: () => ({ chat, substituteParams: s => s, getTokenCountAsync: async text => { calls++; return text.split(' ').length; } }) };
    mod._forTest.cache.clear();
    mod.syncSentTokens(true);   // 켜기 (이벤트는 못 걸어도 된다 — 시험엔 eventSource 가 없다)
    await mod._forTest.run();
    assert.deepEqual(counters.map(c => c.dataset.blSent), ['3t', '0t · 숨김', '2t']);
    assert.equal(calls, 2);
    await mod._forTest.run();
    assert.equal(calls, 2, '같은 글 · 깊이면 다시 안 셈');
    chat[2].mes = 'four five six seven';
    await mod._forTest.run();
    assert.equal(calls, 3); assert.equal(counters[2].dataset.blSent, '4t');
    mod.syncSentTokens(false);
    await mod._forTest.run();
    assert.equal(calls, 3, '끄면 안 셈');
    delete globalThis.document; delete globalThis.SillyTavern;
});

await t('배선: 설정(기본 켬 · 예전 설정도 켬 · 초기화 · 스타일에 안 담김) · 화면 줄 · 검색 · 불러오기 · CSS(style.css 포함) · CI', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /replyTop: false, sentTokens: true,/);
    assert.match(settings, /s\.chat\.sentTokens = flag\(s\.chat\.sentTokens, true\);/);
    assert.match(settings, /'replyTop', 'sentTokens', 'streamFade'/);
    assert.match(read('src/styles.js'), /'replyTop', 'sentTokens', 'streamFade'/);
    assert.match(read('src/panel.js'), /row\('메시지 토큰에 보낸 양도', toggle\('chat\.sentTokens', s\.chat\.sentTokens !== false\)/);
    assert.match(read('src/settings-labels.js'), /"chat\.sentTokens":"메시지 토큰에 보낸 양도"/);
    assert.match(read('src/settings-search.js'), /'chat\.sentTokens'\]/);
    assert.match(read('src/features.js'), /const sentTokens = on && s\.chat\?\.sentTokens !== false;\n\s+if \(sentTokens \|\| modules\.senttokens\) load\('senttokens', '\.\/sent-tokens\.js'\)\.then\(m => m\?\.syncSentTokens\(sentTokens\)\);/);
    // 빌드는 #chat 을 :is(#chat,.bl-chat-like) 로 바꿔 쓴다 — 큰 파일이라 실패해도 글 전체를 찍지 않게 test 로
    const rule = /body\.salty (?:#chat|:is\(#chat,\.bl-chat-like\)) \.mes \.tokenCounterDisplay\[data-bl-sent\]:not\(:empty\)::after \{\n\s+content: "\\00a0\\00a0·\\00a0\\00a0보냄\\00a0" attr\(data-bl-sent\);/;
    assert.ok(rule.test(read('css/05-chat.css')), 'css/05-chat.css 규칙'); assert.ok(rule.test(read('style.css')), 'style.css 에도 (build-css)');
    const src = read('src/sent-tokens.js');
    assert.match(src, /isPrompt: true, depth/);
    assert.match(src, /requestIdleCallback/);
    assert.ok(!/counter\.(?:textContent|innerText|innerHTML)\s*=|tokenCounterDisplay[^\n]*\)\.text\(/.test(src), '실리태번 숫자 글은 안 건드린다');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/sent-tokens\.mjs \./);
});

console.log(`sent-tokens: ${n} passed, 0 failed`);
