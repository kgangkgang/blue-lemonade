// 조상 칸 :is 펼치기(tools/css-fanout.cjs) — 뜻 · 특이도 · 멱등 · 빌드 결과
//   node tools/tests/css-fanout.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(path.join(root, 'tools/'));
const F = require(path.join(root, 'tools/css-fanout.cjs'));
const K = require(path.join(root, 'tools/css-key.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 8).join('\n       ')); } };
const st = () => ({ alreadyFiltered: 0, risky: 0, rootArg: 0, wrapped: 0, fanned: 0, tooMany: 0 });
const spec = s => L.spec(s).join('.');

test('조상 칸 여러 갈래 :is 를 갈래마다 펼치고 특이도는 그대로', () => {
    const src = 'body.salty :is(.drawer-content, .popup, :where(#character_popup)) h4:not(.salty-panel *)';
    const out = F.fanOne(src, st());
    assert.deepEqual(out, ['body.salty .drawer-content h4:not(.salty-panel *)', 'body.salty .popup h4:not(.salty-panel *)', 'body.salty :where(#character_popup) h4:not(.salty-panel *):is(.bl-s, *)']);
    for (const o of out) assert.equal(spec(o), spec(src));
});
test('특이도가 큰 자리가 다른 갈래는 :where 로 감싸 맞춰요(가상 요소 앞에 짝)', () => {
    const src = 'body.salty :is(#user-settings-block, .popup) p::before';
    const out = F.fanOne(src, st());
    assert.deepEqual(out, ['body.salty #user-settings-block p::before', 'body.salty :where(.popup) p:is(#bl-s, *)::before']);
    for (const o of out) assert.equal(spec(o), spec(src));
});
test('채팅 별칭 :is(#chat, .bl-chat-like) 은 안 펼쳐요(별칭 짝 · 규칙 글 잠금 시험)', () => {
    assert.equal(F.fanOne('body.salty :is(#chat, .bl-chat-like) > .mes[data-bl-warm]', st()), null);
    assert.equal(F.fanOne('body.salty :is(#chat,.bl-chat-like) p::before', st()), null);
});
test('다른 조상 칸에 이미 이름이 드러나 있으면 안 펼쳐요', () => {
    assert.equal(F.fanOne('body.salty :is(#chat, .bl-chat-like) .mes .mes_text p', st()), null);
});
test('머리가 있을 때 인자에 body · html 이 있으면 · 가상 요소 · & 가 있으면 안 펼쳐요', () => {
    assert.equal(F.fanOne('html :is(body.a, .b) p', st()), null);
    assert.equal(F.fanOne('body.salty :is(.a::before, .b) p', st()), null);
    assert.equal(F.fanOne('body.salty :is(& .a, .b) p', st()), null);
});
test('머리가 없으면 인자 안의 결합자 · body 도 그대로 펼쳐요(뜻이 같아요)', () => {
    const src = ':is(body.salty .a .b, .salty-sample) p';
    const out = F.fanOne(src, st());
    assert.equal(out.length, 2);
    for (const o of out) assert.equal(spec(o), spec(src));
    assert.ok(out[0].startsWith('body.salty .a .b p'));
});
test('검토 D-5: 인자에 :has 가 있으면 안 펼쳐요(옛 브라우저에서 목록 전체가 버려지지 않게)', () => {
    assert.equal(F.fanOne('body.salty :is(#pt-panel #pt-panel-close, dialog.bl-notes-dialog .bl-note-btn:has(> i.fa-xmark)) > i', st()), null);
});
test('검토 D-6: 머리가 있으면 결합자가 든 인자는 첫 칸이 아이디일 때만 펼쳐요', () => {
    assert.equal(F.fanOne('body.salty :is(.bl-chat-like .autopic-media-owner, #chat .x) > i', st()), null);
    const out = F.fanOne('html body.salty :is(#lv_settings .lv-card-head, #bwr .bwr_card_title) > span', st());
    assert.equal(out?.length, 2);
});
test('맨 오른쪽 칸 · 칸 일부만 :is 인 곳은 그대로', () => {
    assert.equal(F.fanOne('body.salty .a :is(.b, .c)', st()), null);
    assert.equal(F.fanOne('body.salty div:is(.b, .c) p', st()), null);
});
for (const file of ['style.css', 'src/style-lazy.gen.css']) {
    // 1.4.x 최적화 3차: 빌드는 펼치기 · 열쇠 달기 뒤 맨 끝에 지킴 갈래를 가벼운 꼴로 적어요(tools/css-light-guards.cjs) — 그 앞 글(원래 꼴)로 견줘요
    const text = require(path.join(root, 'tools/css-light-guards.cjs')).full(fs.readFileSync(path.join(root, file), 'utf8'));
    test(`${file}: 이미 펼친 글 — 다시 돌려도(펼치기 → 열쇠 달기) 같아요`, () => {
        const again = K.keyize(F.fanout(text).text).text;
        assert.equal(again, text);
    });
}
test('빌드가 펼치기를 부르고(열쇠 다시 달기와 함께) 기본으로 켜져 있어요', () => {
    const b = fs.readFileSync(path.join(root, 'tools/build-css.cjs'), 'utf8');
    assert.match(b, /fan = key \}/);
    assert.match(b, /keyize\(require\('\.\/css-fanout\.cjs'\)\.fanout\(keyed\.text\)\.text\)/);
});
console.log(`css-fanout: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
