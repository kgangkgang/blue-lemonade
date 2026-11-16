// 긴 채팅 가볍게 — 글을 고르는 순간 화면이 튀어 고른 글이 메시지 여러 개로 번지지 않게 (css/05-chat.css · 1.5.9 select-keep)
//   node tools/tests/chat-light-select-keep.mjs <테마 루트>
// 제보(11-16 폰 · 1.5.7): 채팅 글을 끌어 고르고 화면을 내리면 계속 전체 선택이 돼요.
// 왜: 1.4.8 이 고르는 동안 html[data-bl-chat-sel] 로 건너뛰기 규칙을 통째로 뺐는데, 그 규칙에는 content-visibility 말고도
//   contain-intrinsic-size · flex-shrink 가 같이 있었어요. 화면에 보이는 메시지도 그 규칙의 주어라 고르는 순간 보이는 메시지의 크기 속성이 바뀌고,
//   크롬은 그런 변화가 있으면 스크롤 고정(scroll anchoring)을 그 배치에서 쉬어요. 위쪽의 아직 못 그린 메시지(160px 자리표시)가 한꺼번에 제 높이가 되며
//   손가락 밑 글이 밀렸고(리그 폰 384 · 메시지 201개: 4,301px · 가만히 쥔 채 고른 글 3 → 3,960자), 크기 기억도 지워져 풀 때 · 다음 고르기에 또 튀었어요.
// 지키는 것: 고른 동안(표식 있음)과 아닌 동안(표식 없음) 메시지의 contain-intrinsic-size · flex-shrink 가 같고, 바뀌는 것은 content-visibility 하나뿐이에요.
//   두 규칙의 주어(메시지 선택자)는 같고 SKIP_SELECTOR 와 같아요. 리그 확인은 보고 `지시-1116/글-선택-전체선택/보고.md`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.message}`); } };

const css = fs.readFileSync(path.join(root, 'css/05-chat.css'), 'utf8');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
const HEAD = String.raw`body\.salty \[id="chat"\]:not\(#salty-none\) > (\.mes[^{]*?) \{([^}]*)\}`;
const off = bare.match(new RegExp(String.raw`^:where\(html\.bl-chat-light:not\(\[data-bl-chat-sel\]\)\) ` + HEAD, 'm'));   // 고르지 않는 동안
const sel = bare.match(new RegExp(String.raw`^:where\(html\.bl-chat-light\[data-bl-chat-sel\]\) ` + HEAD, 'm'));            // 고른 동안
const decls = body => Object.fromEntries(body.split(';').map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(':'); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }));

test('두 규칙이 있고 주어(메시지)가 같아요 — SKIP_SELECTOR 와도 같아요', () => {
    assert.ok(off, '고르지 않는 동안의 건너뛰기 규칙');
    assert.ok(sel, '고른 동안 크기를 지키는 규칙');
    assert.equal(sel[1], off[1], '같은 메시지에 걸려야 고르는 순간 크기 속성이 안 바뀌어요');
    const src = fs.readFileSync(path.join(root, 'src/chat-light.js'), 'utf8');
    const skip = src.match(/export const SKIP_SELECTOR = '([^']+)'/);
    assert.ok(skip, 'SKIP_SELECTOR');
    assert.equal(off[1], skip[1]);
});
test('고르는 순간 바뀌는 것은 content-visibility 하나뿐 — contain-intrinsic-size · flex-shrink 는 두 상태에서 같아요', () => {
    const a = decls(off[2]), b = decls(sel[2]);
    assert.equal(a['content-visibility'], 'auto');
    assert.ok(!('content-visibility' in b), '고른 동안은 건너뛰지 않아요(1.4.8 — 빈 화면)');
    const { 'content-visibility': _cv, ...rest } = a;
    assert.deepEqual(b, rest, '크기에 닿는 속성은 그대로 — 보이는 메시지의 크기 속성이 바뀌면 크롬이 스크롤 고정을 쉬어요');
    assert.match(b['contain-intrinsic-size'] || '', /^auto \d+px$/, '크기 기억(auto)이 이어져야 고르기를 풀 때 높이가 자리표시로 돌아가지 않아요');
    assert.equal(b['flex-shrink'], '0');
});
test('고른 동안의 규칙은 높이 · 여백 · 자리 같은 다른 배치 속성을 건드리지 않아요', () => {
    assert.deepEqual(Object.keys(decls(sel[2])).sort(), ['contain-intrinsic-size', 'flex-shrink']);
});
test('표식을 보는 규칙은 이 둘뿐이에요', () => {
    assert.ok(!/data-bl-chat-sel/.test(bare.replace(off[0], '').replace(sel[0], '')));
});
test('CI 에 등록돼 있어요', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/chat-light-select-keep\.mjs \./);
});
console.log(`chat-light-select-keep: ${n}/${n + failed} 통과`);
process.exit(failed ? 1 : 0);
