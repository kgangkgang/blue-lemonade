// 8.2.7 폰 예측점검(hunt-mobile) · 가볍게: 같은 값인데도 hidden · disabled · 글을 다시 쓰는 곳 — 속성을 같은 값으로 써도 MutationObserver 기록이 생겨
// body 를 보는 감시자들(네모 단추 · 아이콘 글 · 창 표식 …)이 그때마다 돌아요. 스크롤 · 글자 칠 때마다 불리는 길이라 폰에서 아까운 일이에요.
//   · 다시 쓰기 금지 칩(src/addons/rewrite/quick-ban.js hide): 채팅 scroll 마다 chip.hidden = true (칩을 한 번 만든 뒤로는 늘)
//   · 당겨서 새로고침(src/pull-to-refresh.js reset): 채팅 scroll · 문서 input 마다 indicator.hidden = true (설치 모드)
//   · 자연어 명령 힌트(src/natural-slash.js show): 입력창에 글자를 칠 때마다 hint.textContent · hidden · disabled
// 고친 뒤: 값이 다를 때만 써요. 보이는 결과는 같아요.
//   node tools/tests/same-value-hidden.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fnSource = (rel, head) => { const src = read(rel); const at = src.indexOf(head); assert.ok(at >= 0, `${rel}: ${head}`); const indent = /^\s*/.exec(head)[0]; const end = src.indexOf(`\n${indent}}`, at); return src.slice(at, end + indent.length + 2); };
// 쓰기를 세는 요소: 같은 값이어도 setter 가 불리면 브라우저는 속성 기록을 만들어요
function counting(init = {}) {
    const el = { writes: 0, v: { hidden: true, disabled: false, textContent: '', ...init } };
    for (const key of ['hidden', 'disabled', 'textContent']) Object.defineProperty(el, key, { get() { return this.v[key]; }, set(value) { this.writes++; this.v[key] = key === 'textContent' ? String(value) : !!value; } });
    return el;
}
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
test('다시 쓰기 금지 칩: 이미 숨은 칩은 scroll 마다 다시 숨기지 않아요 (고치기 전: scroll 마다 씀)', () => {
    const chip = counting({ hidden: true });
    const hide = new Function('chip', `let current = 'x';\n${fnSource('src/addons/rewrite/quick-ban.js', 'function hide() {')}\nreturn hide;`)(chip);
    for (let i = 0; i < 30; i++) hide();
    assert.equal(chip.writes, 0);
    chip.v.hidden = false; hide(); assert.equal(chip.hidden, true); assert.equal(chip.writes, 1, '떠 있으면 숨겨요');
});
test('당겨서 새로고침: 표시가 이미 숨어 있으면 reset 이 다시 쓰지 않아요 (고치기 전: scroll · 입력마다 씀)', () => {
    const indicator = counting({ hidden: true });
    const make = new Function('indicator', `let gesture = null, state = null, identifier = null, startTarget = null, reloading = false;\n${fnSource('src/pull-to-refresh.js', '    function reset() {')}\nreturn { reset, set: v => { reloading = v; } };`);
    const api = make(indicator);
    for (let i = 0; i < 30; i++) api.reset();
    assert.equal(indicator.writes, 0);
    indicator.v.hidden = false; api.reset(); assert.equal(indicator.hidden, true);
    indicator.v.hidden = false; api.set(true); api.reset(); assert.equal(indicator.hidden, false, '새로고침 중에는 그대로 보여요');
});
test('자연어 명령 힌트: 글자마다 같은 빈 힌트를 다시 쓰지 않고, 바뀔 때만 써요 (고치기 전: 글자마다 3번)', () => {
    const hint = counting({ hidden: true, disabled: true, textContent: '' });
    const show = new Function('hint', `let busy = false;\n${fnSource('src/natural-slash.js', '    function show(message, actionable = false) {')}\nreturn show;`)(hint);
    for (let i = 0; i < 20; i++) show('', false);
    assert.equal(hint.writes, 0);
    show('/sys 로 보내요', true);
    assert.deepEqual([hint.textContent, hint.hidden, hint.disabled], ['/sys 로 보내요', false, false]);
    const after = hint.writes; show('/sys 로 보내요', true); assert.equal(hint.writes, after, '같은 힌트는 그대로');
    show('', false); assert.deepEqual([hint.textContent, hint.hidden, hint.disabled], ['', true, true]);
});
assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/same-value-hidden.mjs .'), 'release-check.yml 에 등록');
console.log(`같은 값 다시 쓰기 줄이기: ${pass}개 통과했어요.`);
