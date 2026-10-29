// 메시지 머리 토큰 수 누르면 내역 (7.0.3 「· 보냄 N」 → 7.0.4) — src/sent-tokens.js · css/05-chat.css.
//   머리엔 실리태번 숫자만(숨긴 메시지만 「· 숨김」), 누르면 「생각 A + 본문 B = 총 C t」 · 「다음 프롬에 들어가는 양 D t (프롬용 정규식이 본문에서 B−D t 뺌)」.
//   깊이 · 숨김 · 프롬프트용 정규식 · 매크로 · 캐시 · 설정 chat.sentTokens(열쇠 그대로, 기본 켬). 지어낸 글만.
//   node tools/tests/sent-tokens.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const mod = await import(pathToFileURL(path.join(root, 'src/sent-tokens.js')).href);
const { promptDepths, cacheKey, sentText, textHash, tokenLines, breakdown } = mod;
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

await t('깊이 = 숨기지 않은 메시지 중 뒤에서 센 자리 (숨긴 메시지는 깊이 없음)', () => {
    const chat = [{ mes: 'a' }, { mes: 'b', is_system: true }, { mes: 'c' }, { mes: 'd', is_system: true }, { mes: 'e' }];
    assert.deepEqual([...promptDepths(chat)], [[4, 0], [2, 1], [0, 2]]);
});

await t('다음 프롬 글 = 프롬프트용 정규식(사용자/답 · isPrompt · 깊이) 뒤 매크로 — 생각은 안 들어감', () => {
    const seen = [];
    const regex = { regex_placement: { USER_INPUT: 1, AI_OUTPUT: 2 }, getRegexedString: (text, place, opt) => { seen.push([place, opt]); return opt.depth > 5 ? 'summary only' : text.replace(/<prologue>[\s\S]*?<\/prologue>\s*/, ''); } };
    const m = { is_user: false, mes: '<prologue>long setup</prologue>\nHello {{user}}', extra: { reasoning: 'lots of thinking' } };
    assert.equal(sentText(m, 2, { regex, substitute: s => s.replace('{{user}}', 'Mina') }), 'Hello Mina');
    assert.equal(sentText(m, 9, { regex }), 'summary only', '깊이 5 밖은 요약만 보내는 규칙');
    assert.equal(sentText({ is_user: true, mes: 'hi' }, 0, { regex }), 'hi');
    assert.deepEqual(seen.map(([p, o]) => [p, o.isPrompt, o.depth]), [[2, true, 2], [2, true, 9], [1, true, 0]]);
    assert.equal(sentText(m, 0), m.mes, '정규식 엔진이 없으면 원문');
});

await t('열쇠(사용자 · 깊이 · 글 · 정규식 표가 바뀌면 다름)', () => {
    const m = { is_user: false, mes: 'same text' };
    const k = cacheKey(m, 3, 's1');
    assert.equal(cacheKey({ ...m }, 3, 's1'), k);
    for (const other of [cacheKey(m, 4, 's1'), cacheKey({ ...m, mes: 'same text!' }, 3, 's1'), cacheKey(m, 3, 's2'), cacheKey({ ...m, is_user: true }, 3, 's1')]) assert.notEqual(other, k);
    assert.notEqual(textHash('ab'), textHash('ba'));
});

await t('내역 줄: 생각이 있으면 덧셈 · 없으면 본문만 · 정규식이 뺀 양은 본문보다 적을 때만 · 숨김', () => {
    assert.deepEqual(tokenLines({ reasoning: 3000, body: 4000, total: 7000, sent: 2500 }), ['생각 3,000 + 본문 4,000 = 총 7,000t', '다음 프롬에 들어가는 양 2,500t (프롬용 정규식이 본문에서 1,500t 뺌)']);
    assert.deepEqual(tokenLines({ reasoning: 0, body: 420, total: 420, sent: 420 }), ['본문 420t', '다음 프롬에 들어가는 양 420t']);
    assert.deepEqual(tokenLines({ reasoning: 0, body: 400, total: 400, sent: 410 }), ['본문 400t', '다음 프롬에 들어가는 양 410t'], '매크로로 늘면 뺀 말 없음');
    assert.deepEqual(tokenLines({ reasoning: 12, body: 30, total: 42, hidden: true }), ['생각 12 + 본문 30 = 총 42t', '숨긴 메시지라 프롬에 0t']);
});

await t('누를 때 세기: 실리태번 숫자는 token_count · 같은 토크나이저 · 두 번째는 캐시 · 숨긴 메시지 · 없는 메시지', async () => {
    let calls = 0;
    const chat = [
        { is_user: true, mes: 'one two three' },
        { is_user: false, mes: 'four five six seven', extra: { reasoning: 'think think', token_count: 7 } },
        { is_user: false, mes: 'hidden reply here', is_system: true, extra: { token_count: 3 } },
    ];
    globalThis.SillyTavern = { getContext: () => ({ chat, substituteParams: s => s.replace('seven', ''), getTokenCountAsync: async text => { calls++; return text.split(' ').filter(Boolean).length; } }) };
    mod._forTest.cache.clear();
    assert.deepEqual(await breakdown(1), ['생각 2 + 본문 4 = 총 7t', '다음 프롬에 들어가는 양 3t (프롬용 정규식이 본문에서 1t 뺌)']);
    const first = calls;
    await breakdown(1);
    assert.equal(calls, first, '같은 글 · 깊이면 다시 안 셈');
    assert.deepEqual(await breakdown(2), ['본문 3t', '숨긴 메시지라 프롬에 0t']);
    assert.deepEqual(await breakdown(0, '3t'), ['본문 3t', '다음 프롬에 들어가는 양 3t']);
    assert.equal(await breakdown(9), null);
    delete globalThis.SillyTavern;
});

await t('누르면 알림 한 번(줄마다 · 이스케이프 · 번호) · 끄면 안 뜸 · 켜면 html 표시', async () => {
    const shown = [];
    const body = { classList: { set: new Set(), toggle(c, v) { v ? this.set.add(c) : this.set.delete(c); } } };
    const chatEl = { listeners: new Set(), addEventListener(_, f) { this.listeners.add(f); }, removeEventListener(_, f) { this.listeners.delete(f); } };
    globalThis.document = { documentElement: body, getElementById: id => id === 'chat' ? chatEl : null };
    globalThis.toastr = { info: (html, title, opt) => shown.push({ html, title, opt }) };
    globalThis.SillyTavern = { getContext: () => ({ chat: [{ is_user: false, mes: 'a <b> c', extra: { token_count: 3 } }], getTokenCountAsync: async text => text.split(' ').length }) };
    const counter = { textContent: '3t', closest: sel => sel === '.mes' ? { getAttribute: () => '0' } : null };
    const event = { target: { closest: () => counter } };
    mod.syncSentTokens(true);
    assert.ok(body.classList.set.has('bl-sent-tokens')); assert.equal(chatEl.listeners.size, 1);
    await mod._forTest.onClick(event);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].title, '#0 토큰');
    assert.equal(shown[0].html, '본문 3t<br>다음 프롬에 들어가는 양 3t');
    assert.equal(shown[0].opt.escapeHtml, false);
    mod._forTest.cache.clear();
    globalThis.SillyTavern = { getContext: () => ({ chat: [{ is_user: false, mes: '<img src=x>', extra: { token_count: 1 } }], getTokenCountAsync: async () => 1 }) };
    await mod._forTest.onClick(event);
    assert.ok(!shown[1].html.includes('<img'), '글은 숫자뿐이지만 그래도 이스케이프');
    mod.syncSentTokens(false);
    assert.ok(!body.classList.set.has('bl-sent-tokens')); assert.equal(chatEl.listeners.size, 0);
    await mod._forTest.onClick(event);
    assert.equal(shown.length, 2, '끄면 안 뜸');
    delete globalThis.document; delete globalThis.toastr; delete globalThis.SillyTavern;
});

await t('배선: 열쇠 chat.sentTokens 그대로(기본 켬) · 이름 「토큰 수 누르면 내역」 · 불러오기 · CSS(머리엔 숫자만 · 손가락 · 밑줄 · 숨김) · 옛 「보냄」 없음 · CI', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /replyTop: false, sentTokens: true,/);
    assert.match(settings, /s\.chat\.sentTokens = flag\(s\.chat\.sentTokens, true\);/);
    assert.match(settings, /'replyTop', 'sentTokens', 'streamFade'/);
    assert.match(read('src/styles.js'), /'replyTop', 'sentTokens', 'streamFade'/);
    assert.match(read('src/panel.js'), /row\('토큰 수 누르면 내역', toggle\('chat\.sentTokens', s\.chat\.sentTokens !== false\)/);
    assert.match(read('src/settings-labels.js'), /"chat\.sentTokens":"토큰 수 누르면 내역"/);
    assert.match(read('src/settings-search.js'), /'토큰 수 누르면 내역'[^\n]*'chat\.sentTokens'\]/);
    assert.match(read('src/features.js'), /const sentTokens = on && s\.chat\?\.sentTokens !== false;\n\s+if \(sentTokens \|\| modules\.senttokens\) load\('senttokens', '\.\/sent-tokens\.js'\)\.then\(m => m\?\.syncSentTokens\(sentTokens\)\);/);
    const scope = '(?:#chat|:is\\(#chat,\\.bl-chat-like\\))';
    const rules = [
        new RegExp(`:where\\(html\\.bl-sent-tokens\\) body\\.salty\\.salty ${scope} \\.mes \\.tokenCounterDisplay:not\\(:empty\\) \\{\\n\\s+cursor: pointer;`),
        new RegExp(`@media \\(hover: hover\\) \\{\\n\\s+:where\\(html\\.bl-sent-tokens\\) body\\.salty\\.salty ${scope} \\.mes \\.tokenCounterDisplay:not\\(:empty\\):hover \\{\\n\\s+text-decoration: underline;`),
        new RegExp(`:where\\(html\\.bl-sent-tokens\\) body\\.salty\\.salty ${scope} \\.mes\\[is_system="true"\\] \\.tokenCounterDisplay:not\\(:empty\\)::after \\{\\n\\s+content: "\\\\00a0\\\\00a0·\\\\00a0\\\\00a0숨김";`),
    ];
    // 큰 파일이라 실패해도 글 전체를 찍지 않게 test 로
    for (const file of ['css/05-chat.css', 'style.css']) {
        const css = read(file);
        rules.forEach((re, i) => assert.ok(re.test(css), `${file} 규칙 ${i + 1}`));
        assert.ok(!css.includes('보냄') && !css.includes('data-bl-sent'), `${file} 에 7.0.3 「보냄」 이 남지 않음`);
    }
    const src = read('src/sent-tokens.js');
    assert.match(src, /isPrompt: true, depth/);
    assert.ok(!/counter\.(?:textContent|innerText|innerHTML)\s*=|dataset\.blSent/.test(src), '실리태번 숫자 글 · 머리는 안 건드린다');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/sent-tokens\.mjs \./);
});

console.log(`sent-tokens: ${n} passed, 0 failed`);
