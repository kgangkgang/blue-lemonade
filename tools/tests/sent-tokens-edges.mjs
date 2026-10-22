// 7.7.2 메시지 토큰 내역 (sent-tokens.js)의 경계 — 깊이(숨긴 메시지 건너뜀) · 열쇠 · 프롬프트용 정규식 · 줄 글 · 기억 한도 · 누르기.
//   실리태번 문맥 · 토크나이저 · 정규식 모듈은 이 시험 안의 흉내(글자 수로 셈). 지어낸 메시지만.   node tools/tests/sent-tokens-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const S = await import(pathToFileURL(path.join(root, 'src/sent-tokens.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

await test('textHash · cacheKey: 글 · 길이 · 사용자/답 · 깊이 · 정규식 표가 열쇠에 든다', () => {
    assert.match(S.textHash('abc'), /^[0-9a-z]+\.3$/);
    assert.equal(S.textHash('abc'), S.textHash('abc'));
    assert.notEqual(S.textHash('abc'), S.textHash('abd'));
    assert.notEqual(S.textHash('ab'), S.textHash('ba'));
    assert.equal(S.textHash(null), S.textHash(''));
    assert.equal(S.textHash(''), (0x811c9dc5 >>> 0).toString(36) + '.0', 'FNV-1a 시작값');
    assert.equal(S.textHash(0), S.textHash('0'), '0 은 글 0');
    assert.equal(S.cacheKey({ is_user: true, mes: 'x' }, 2, 'st'), `u|2|${S.textHash('x')}|st`);
    assert.equal(S.cacheKey({ mes: 'x' }, 0), `a|0|${S.textHash('x')}|`);
    assert.equal(S.cacheKey(null, 1), `a|1|${S.textHash('')}|`);
});

await test('promptDepths: 뒤에서 센 자리, 숨긴 · 빈 메시지는 건너뜀', () => {
    const d = S.promptDepths([{ mes: 'a' }, { mes: 'b', is_system: true }, null, { mes: 'c' }, { mes: 'd' }]);
    assert.deepEqual([...d.entries()], [[4, 0], [3, 1], [0, 2]]);
    assert.equal(S.promptDepths(null).size, 0);
    assert.equal(S.promptDepths([]).size, 0);
});

await test('sentText: 프롬프트용 정규식(사용자/답 자리 · 깊이) → 매크로, 없으면 원문', () => {
    const calls = [];
    const regex = { regex_placement: { USER_INPUT: 1, AI_OUTPUT: 2 }, getRegexedString: (t, place, opt) => { calls.push([place, opt]); return t.replace('비밀', ''); } };
    assert.equal(S.sentText({ mes: '비밀 말' }, 3, { regex, substitute: t => t + '!' }), ' 말!');
    assert.deepEqual(calls, [[2, { isPrompt: true, depth: 3 }]]);
    S.sentText({ mes: 'x', is_user: true }, 0, { regex });
    assert.equal(calls[1][0], 1);
    assert.equal(S.sentText({ mes: 'x' }, 0, { regex: { regex_placement: null, getRegexedString: () => 'no' } }), 'x', '자리 표가 없으면 정규식 안 씀');
    assert.equal(S.sentText({ mes: 'x' }, 0, { regex: { regex_placement: { AI_OUTPUT: 2 } } }), 'x');
    assert.equal(S.sentText({ mes: 'x' }, 0, { substitute: 'no' }), 'x');
    assert.equal(S.sentText({ mes: 'x' }, 0, { regex: { regex_placement: { AI_OUTPUT: 2 }, getRegexedString: () => undefined } }), '');
    assert.equal(S.sentText({ mes: 0 }, 0), '0');
    assert.equal(S.sentText(null, 0), '');
});

await test('tokenLines: 생각이 있으면 세 수, 숨김이면 프롬 0, 정규식이 뺀 만큼', () => {
    assert.deepEqual(S.tokenLines({ reasoning: 1200, body: 3400, total: 4600, sent: 3000 }), ['생각 1,200 + 본문 3,400 = 총 4,600t', '다음 프롬에 들어가는 양 3,000t (프롬용 정규식이 본문에서 400t 뺌)']);
    assert.deepEqual(S.tokenLines({ body: 5, sent: 5 }), ['본문 5t', '다음 프롬에 들어가는 양 5t']);
    assert.deepEqual(S.tokenLines({ body: 5, sent: 7 }), ['본문 5t', '다음 프롬에 들어가는 양 7t'], '늘어난 것은 뺌으로 적지 않는다');
    assert.deepEqual(S.tokenLines({ body: 5.4, sent: 4.6 }), ['본문 5t', '다음 프롬에 들어가는 양 5t'], '반올림해서 같으면 안 적는다');
    assert.deepEqual(S.tokenLines({ reasoning: 0, body: 9, hidden: true }), ['본문 9t', '숨긴 메시지라 프롬에 0t']);
    assert.deepEqual(S.tokenLines({ reasoning: -3, body: -2, sent: -1 }), ['본문 0t', '다음 프롬에 들어가는 양 0t']);
    assert.deepEqual(S.tokenLines(), ['본문 0t', '다음 프롬에 들어가는 양 0t']);
});

await test('breakdown: 같은 토크나이저로 생각 · 본문 · 보낼 글, 총은 실리태번 숫자 → 화면 숫자 → 합', async () => {
    let counted = 0;
    const chat = [{ mes: '안녕하세요', extra: { reasoning: '생각중', token_count: 99 } }, { mes: '숨김', is_system: true, extra: {} }, { mes: '마지막 답', extra: {} }];
    globalThis.SillyTavern = { getContext: () => ({ chat, getTokenCountAsync: async t => { counted++; return t.length; }, substituteParams: t => t.replace('답', '대답') }) };
    S._forTest.cache.clear();
    assert.deepEqual(await S.breakdown(0), ['생각 3 + 본문 5 = 총 99t', '다음 프롬에 들어가는 양 5t']);
    const before = counted;
    await S.breakdown(0);
    assert.equal(counted, before, '같은 글은 기억한 값');
    assert.deepEqual(await S.breakdown(2, '1,234'), ['본문 5t', '다음 프롬에 들어가는 양 6t'], '총은 화면 숫자(생각 없으면 첫 줄엔 안 보임), 보낼 글은 매크로 뒤');
    assert.deepEqual(await S.breakdown(1), ['본문 2t', '숨긴 메시지라 프롬에 0t']);
    chat[2].extra.reasoning = 'abc';
    assert.deepEqual((await S.breakdown(2))[0], '생각 3 + 본문 5 = 총 8t', '실리태번 숫자도 화면 숫자도 없으면 합');
    assert.equal(await S.breakdown(7), null);
    globalThis.SillyTavern = { getContext: () => ({ chat }) };
    assert.equal(await S.breakdown(0), null, '토크나이저가 없으면 못 셈');
    globalThis.SillyTavern = { getContext: () => ({ chat: [{ mes: '' }], getTokenCountAsync: async () => { throw new Error('should not count empty'); } }) };
    assert.deepEqual(await S.breakdown(0), ['본문 0t', '다음 프롬에 들어가는 양 0t'], '빈 글은 세지 않는다');
    globalThis.SillyTavern = { getContext: () => ({ chat: [{ mes: 'x' }], getTokenCountAsync: async () => 'NaN' }) };
    S._forTest.cache.clear();
    assert.deepEqual(await S.breakdown(0), ['본문 0t', '다음 프롬에 들어가는 양 0t']);
    delete globalThis.SillyTavern;
    assert.equal(await S.breakdown(0), null);
});

await test('기억 한도 600 — 넘으면 가장 오래된 것부터', async () => {
    S._forTest.cache.clear();
    const chat = Array.from({ length: 1 }, () => ({ mes: '' }));
    let n = 0;
    globalThis.SillyTavern = { getContext: () => ({ chat, getTokenCountAsync: async t => t.length }) };
    for (let i = 0; i < 605; i++) { chat[0] = { mes: 'm' + i }; await S.breakdown(0); n++; }
    assert.ok(S._forTest.cache.size <= 600, String(S._forTest.cache.size));
    assert.equal(S._forTest.cache.size, 600);
    assert.ok(!S._forTest.cache.has(`t|${S.textHash('m0')}`), '처음 것은 밀려났다');
    assert.ok(S._forTest.cache.has(`t|${S.textHash('m604')}`));
    delete globalThis.SillyTavern;
});

await test('누르기: 켜졌을 때 메시지 머리 숫자만, 줄은 이스케이프해 한 알림으로', async () => {
    const toasts = [];
    globalThis.toastr = { info: (html, title, opt) => toasts.push([html, title, opt]) };
    const chat = [{ mes: '<b>굵게</b>', extra: { token_count: 3 } }];
    globalThis.SillyTavern = { getContext: () => ({ chat, getTokenCountAsync: async t => t.length }) };
    const listeners = [];
    const chatEl = { addEventListener: (t, f) => listeners.push(f), removeEventListener: (t, f) => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); } };
    const classes = new Set();
    globalThis.document = { body: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } }, getElementById: id => (id === 'chat' ? chatEl : null) };
    const counter = (text, mesid = '0') => ({ textContent: text, closest: sel => (sel === '.mes' ? { getAttribute: () => mesid } : null) });
    const click = target => ({ target: { closest: sel => (sel === '#chat .mes .tokenCounterDisplay' ? target : null) } });
    await S._forTest.onClick(click(counter('3t')));
    assert.equal(toasts.length, 0, '꺼져 있으면 아무것도');
    S.syncSentTokens(true);
    assert.ok(classes.has('bl-sent-tokens'));
    assert.equal(listeners.length, 1);
    S.syncSentTokens(true);
    assert.equal(listeners.length, 1, '두 번 켜도 한 번만');
    await listeners[0](click(counter('3t')));
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0][1], '#0 토큰');
    assert.deepEqual(toasts[0][2], { escapeHtml: false, timeOut: 8000, preventDuplicates: true });
    assert.ok(!toasts[0][0].includes('<b>') && toasts[0][0].includes('<br>'));
    await listeners[0](click(counter('  ')));
    await listeners[0](click(counter('3t', 'x')));
    await listeners[0](click(null));
    await listeners[0](click(counter('3t', '9')));
    assert.equal(toasts.length, 1, '빈 숫자 · 번호 없음 · 다른 곳 · 없는 메시지');
    const warn = console.warn; let warned = 0; console.warn = () => warned++;
    globalThis.SillyTavern = { getContext: () => ({ chat, getTokenCountAsync: async () => { throw new Error('tok'); } }) };
    S._forTest.cache.clear();
    await listeners[0](click(counter('3t')));
    console.warn = warn;
    assert.equal(warned, 1); assert.equal(toasts.length, 1);
    S.syncSentTokens(false);
    assert.equal(listeners.length, 0);
    assert.ok(!classes.has('bl-sent-tokens'));
    delete globalThis.SillyTavern; delete globalThis.document; delete globalThis.toastr;
});

console.log(`sent-tokens-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
