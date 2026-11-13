// 1.1.6 성능: src/cardink.js 카드 글자색 — 「더 보기」(MORE_MESSAGES_LOADED) 뒤에는 새로 위에 붙은 메시지 본문만 보고, 이미 본 아래 메시지는 다시 읽지 않는지.
//   채팅을 바꿀 때 · 테마를 다시 켤 때(전체) · 메시지 하나가 바뀔 때(그 메시지)는 예전처럼 이미 본 본문도 다시 봐요.
//   node tools/tests/card-ink-more.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 가짜 문서: #chat 아래 .mes_text 들. 본문마다 카드 후보를 찾은(querySelectorAll) 횟수를 세요 — 그 횟수가 「다시 읽은 본문 수」예요
const looked = new Map();
const texts = [];
const text = id => {
    const t = { id, nodeType: 1, matches: sel => sel === '.mes_text', closest: () => null, querySelector: () => null,
        querySelectorAll: sel => { if (sel !== '[class*="custom-"], [style*="background"]') throw new Error('뜻밖의 선택자 ' + sel); looked.set(id, (looked.get(id) || 0) + 1); return []; } };
    return t;
};
const chat = { id: 'chat', nodeType: 1, matches: () => false, querySelectorAll: sel => { assert.equal(sel, '.mes_text'); return texts; } };
globalThis.document = { documentElement: {}, body: { classList: { contains: c => c === 'salty' } }, getElementById: id => (id === 'chat' ? chat : null), addEventListener() {}, createElement: () => ({ getContext: () => null }) };
globalThis.getComputedStyle = () => ({ backgroundColor: 'rgba(0, 0, 0, 0)', color: 'rgb(0, 0, 0)' });
const { _cardInk } = await import(pathToFileURL(path.join(root, 'src/cardink.js')).href);
const run = async (...a) => { looked.clear(); _cardInk.schedule(...a); await sleep(5); return Object.fromEntries([...looked].sort((x, y) => x[0] - y[0])); };

for (let i = 50; i < 100; i++) texts.push(text(i));   // 채팅을 열면 아래 50개
await test('채팅 열기(전체): 그려진 본문 50개를 다 봐요', async () => {
    const got = await run(null);
    assert.equal(Object.keys(got).length, 50);
});
await test('더 보기: 위에 새로 붙은 본문 50개만 보고, 이미 본 아래 50개는 다시 읽지 않아요', async () => {
    for (let i = 49; i >= 0; i--) texts.unshift(text(i));   // 실리태번은 위에 붙여요
    const got = await run(null, true);
    assert.deepEqual(Object.keys(got).map(Number), Array.from({ length: 50 }, (_, i) => i));
    assert.ok(Object.values(got).every(n => n === 1));
});
await test('더 보기를 한 번 더 해도 새 것이 없으면 아무것도 다시 읽지 않아요', async () => {
    assert.deepEqual(await run(null, true), {});
});
await test('메시지 하나가 바뀌면(이벤트로 그 본문) 이미 본 본문이어도 다시 봐요', async () => {
    const got = await run(texts[70]);
    assert.deepEqual(got, { 70: 1 });
});
await test('같은 틈에 더 보기와 메시지 하나가 겹치면: 그 메시지는 다시 · 새 본문만 더해서 봐요(같은 본문을 두 번 읽지 않아요)', async () => {
    texts.unshift(text(-1));
    const got = await run(texts[30]);   // 하나
    assert.deepEqual(got, { 29: 1 });   // texts[30] 은 이제 29번 본문
    looked.clear(); _cardInk.schedule(texts[10]); _cardInk.schedule(null, true); await sleep(5);
    assert.deepEqual(Object.fromEntries(looked), { 9: 1, [-1]: 1 });
});
await test('채팅 전체(채팅 바꿈 · 테마 다시 켬)가 겹치면 더 보기여도 전부 다시 봐요(예전과 같아요)', async () => {
    looked.clear(); _cardInk.schedule(null, true); _cardInk.schedule(null); await sleep(5);
    assert.equal(looked.size, texts.length);
});
await test('소스: 더 보기 이벤트만 새 본문 길(schedule(null, true)) · 채팅 바꿈은 전체 · CI 등록', () => {
    const src = fs.readFileSync(path.join(root, 'src/cardink.js'), 'utf8');
    assert.match(src, /on\('MORE_MESSAGES_LOADED', \(\) => schedule\(null, true\)\);/);
    assert.match(src, /on\('CHAT_CHANGED', \(\) => schedule\(null\)\);/);
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/card-ink-more.mjs .'));
});
console.log(`card-ink-more: ${passed} passed`);
