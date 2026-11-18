// 버그 사냥 2(1.7.8 거리) — 깡통 골드 잠금 꼴(<span class="gold-lock-draft" data-gold-lock-id="…" data-gold-price="…">안 글</span>)이
//   로그 복사(붙여 넣은 내 글꾸)를 거쳐도 깨지지 않고 잠긴 글이 밖으로 새지 않는지(jsdom).
//   ① 소독은 꼴을 그대로 둬요 ② 「HTML 복사」 코드의 꾸밈 글 주석에 잠긴 글 · 숨긴 글이 안 들어가요
//   ③ 「자동으로」 로그 자리가 잠금(이나 잠금을 품은 칸)이 아니에요 ④ 「숨기기」 는 잠금에 걸친 글을 거절해요(같은 id 잠금이 둘 · 셋으로 늘던 것)
//   node tools/tests/log-copy-gold-lock.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { sanitizeHtml, guessSlot } = await load('src/log-copy-sanitize.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');
const { wrapSpoiler } = await load('src/log-copy-spoiler.js');

const LOCK = '<span class="gold-lock-draft" data-gold-lock-id="g1" data-gold-price="30">결말은 비밀이었다</span>';
const domOf = body => new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`).window.document;
const C = { line: '#ccc', raised: '#eee', muted: '#666' }, UI = { family: 'serif', tracking: '0' };

await test('소독: 잠금 span 의 class · data-gold-* · 안 글이 그대로예요', () => {
    const doc = domOf('');
    const out = sanitizeHtml(`<div><p>앞 ${LOCK} 뒤</p></div>`, { doc });
    assert.ok(out.includes(LOCK), out);
});

await test('HTML 복사 코드: 꾸밈 글 주석에 잠긴 글이 안 들어가요(잠금 밖 꾸밈 글 주석은 그대로)', () => {
    const html = `<div><div data-bl-slot=""><div data-bl-msg=""><div data-bl-body="">본문</div></div></div><p>뒷이야기: ${LOCK}</p><p>표지판 글</p></div>`;
    const out = prettyLogHtml(html, { label: '시험' });
    const comments = [...out.matchAll(/<!--([\s\S]*?)-->/g)].map(m => m[1]);
    assert.ok(!comments.some(c => c.includes('비밀')), comments.join('\n'));
    assert.ok(comments.some(c => c.includes('표지판 글')), '잠금 밖 꾸밈 글 주석은 남아요');
    assert.ok(out.includes('data-gold-lock-id="g1"') && out.includes('결말은 비밀이었다'), '잠금 자체는 그대로');
});

await test('HTML 복사 코드: 숨긴 글(details[data-bl-spoiler]) 안 글도 주석에 안 새요', () => {
    const html = '<div><div data-bl-msg=""><div data-bl-body="">본문</div></div><p>소품 <details data-bl-spoiler=""><summary><span>눌러서 보기</span></summary><span class="blsp-c">비밀 결말</span></details></p></div>';
    const out = prettyLogHtml(html, { label: '시험' });
    const comments = [...out.matchAll(/<!--([\s\S]*?)-->/g)].map(m => m[1]);
    assert.ok(!comments.some(c => c.includes('비밀 결말')), comments.join('\n'));
});

await test('자동 로그 자리: 잠금이나 잠금을 품은 칸은 고르지 않아요', () => {
    const doc = domOf(`<div class="card"><div class="t">제목</div><p>유료 공개분 — 여기서부터 본문 내용이 아주 길게 이어져요 ${LOCK}</p><div class="slot">로그</div></div>`);
    const slot = guessSlot(doc.body);
    assert.ok(slot, '자리를 골라요');
    assert.ok(!slot.matches('[data-gold-lock-id]') && !slot.querySelector('[data-gold-lock-id]') && !slot.closest('[data-gold-lock-id]'), slot.outerHTML);
    assert.equal(slot.className, 'slot');
});

await test('자동 로그 자리: 잠금 말고 칸이 없으면 잠금은 건드리지 않고 다른 칸(또는 없음)', () => {
    const doc = domOf(`<div class="wrap"><p>로그 ${LOCK}</p></div>`);
    const slot = guessSlot(doc.body);
    assert.ok(!slot || (!slot.querySelector('[data-gold-lock-id]') && !slot.closest('[data-gold-lock-id]')), slot?.outerHTML);
});

await test('숨기기: 잠금 경계를 가로지른 고르기는 거절 — 같은 id 잠금이 하나 그대로', () => {
    const doc = domOf(`<div data-bl-msg=""><div>앞 글 ${LOCK} 뒤 글</div></div>`);
    const span = doc.querySelector('.gold-lock-draft');
    const r = doc.createRange(); r.setStart(span.previousSibling, 2); r.setEnd(span.firstChild, 3);
    assert.equal(wrapSpoiler(doc, r, C, UI), null);
    assert.equal(doc.querySelectorAll('[data-gold-lock-id="g1"]').length, 1);
    assert.equal(doc.querySelector('[data-gold-lock-id="g1"]').textContent, '결말은 비밀이었다');
});

await test('숨기기: 잠금을 통째로 품은 고르기도 거절(가린 사본 · 내용 칸 두 벌이 되던 것)', () => {
    const doc = domOf(`<div data-bl-msg=""><div>앞 글 ${LOCK} 뒤 글</div></div>`);
    const span = doc.querySelector('.gold-lock-draft');
    const r = doc.createRange(); r.setStart(span.previousSibling, 0); r.setEnd(span.nextSibling, 2);
    assert.equal(wrapSpoiler(doc, r, C, UI), null);
    assert.equal(doc.querySelectorAll('[data-gold-lock-id="g1"]').length, 1);
});

await test('숨기기: 잠금 안 글만 고른 것도 거절 · 잠금 밖 글은 그대로 숨겨요', () => {
    const doc = domOf(`<div data-bl-msg=""><div>앞 글 ${LOCK} 뒤 글</div></div>`);
    const span = doc.querySelector('.gold-lock-draft');
    const r = doc.createRange(); r.setStart(span.firstChild, 0); r.setEnd(span.firstChild, 3);
    assert.equal(wrapSpoiler(doc, r, C, UI), null);
    const r2 = doc.createRange(); const tail = span.nextSibling; r2.setStart(tail, 1); r2.setEnd(tail, 3);
    assert.ok(wrapSpoiler(doc, r2, C, UI), '잠금 밖은 숨겨요');
    assert.equal(doc.querySelectorAll('[data-gold-lock-id="g1"]').length, 1);
});

console.log(`log-copy-gold-lock: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
