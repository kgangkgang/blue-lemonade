// 6.4.4 성능 보조 「메시지 속 같은 style 은 하나만 쓰기」 — src/addons/perf/styledup.js (순수 판단 + 가짜 DOM 연결) · perfassist.js 연결 줄. 지어낸 글만.
//   node tools/tests/style-dedupe.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const S = await import(pathToFileURL(path.join(themeRoot, 'src/addons/perf/styledup.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
// 가짜 style 노드 · 칸
let seq = 0;
const box = name => ({ name, id: ++seq });
const style = (text, { media = '', title = null, parent = box('p'), holder = box('mes_text') } = {}) => ({
    id: ++seq, textContent: text, disabled: false, isConnected: true, parentNode: parent, holder,
    getAttribute: k => (k === 'media' ? media || null : k === 'title' ? title : null), hasAttribute: k => (k === 'title' ? title !== null : k === 'media' ? !!media : false),
});
// 가짜 MutationObserver: observe 한 칸이 바뀌었다고 알릴 수 있다
const observers = [];
class FakeMO { constructor(cb) { this.cb = cb; this.targets = []; this.opts = []; observers.push(this); } observe(t, o) { this.targets.push(t); this.opts.push(o); } disconnect() { this.targets = []; this.opts = []; } }
const touch = target => { for (const o of observers) if (o.targets.includes(target)) o.cb([]); };

await test('같은 글 · 같은 media 는 문서 순서상 마지막 한 벌만 켠다 — media 가 다르면 다른 style · title 이 있는 style 은 손대지 않는다', () => {
    const a1 = style('.a{color:red}'), b1 = style('.b{}'), a2 = style('.a{color:red}'), m = style('.a{color:red}', { media: '(max-width:520px)' }), t1 = style('.t{}', { title: 'alt' }), t2 = style('.t{}', { title: 'alt' }), a3 = style('.a{color:red}');
    const plan = S.planStyleDedupe([a1, b1, a2, m, t1, t2, a3]);
    assert.deepEqual(plan.disable.map(n => n.id), [a1.id, a2.id]);
    assert.deepEqual(plan.enable, []);
    assert.deepEqual(plan.keep.map(n => n.id).sort(), [a3.id, b1.id, m.id].sort());
});
await test('마지막 사본이 꺼져 있으면 켠다 · repairOnly(스트리밍 중)는 끄지 않고 켜기만', () => {
    const a1 = style('.a{}'), a2 = style('.a{}'); a2.disabled = true;
    assert.deepEqual(S.planStyleDedupe([a1, a2]).enable.map(n => n.id), [a2.id]);
    assert.deepEqual(S.planStyleDedupe([a1, a2]).disable.map(n => n.id), [a1.id]);
    const r = S.planStyleDedupe([a1, a2], { repairOnly: true });
    assert.deepEqual(r.enable.map(n => n.id), [a2.id]); assert.deepEqual(r.disable, []);
});
await test('연결: 끄고 · 켜 둔 한 벌의 칸이 바뀌면 그리기 전에 다음 마지막 사본을 켠다 · 스위치를 끄면 모두 되돌린다', () => {
    const doc = [style('.a{}'), style('.a{}'), style('.a{}')];
    const queue = fn => fn();   // 마이크로태스크 대신 바로
    let on = true;
    const d = S.createStyleDedupe({ query: () => doc.filter(n => n.isConnected), holdersOf: n => [n.parentNode, n.holder], enabled: () => on, MutationObserver: FakeMO, queue });
    d.run();
    assert.deepEqual(doc.map(n => n.disabled), [true, true, false]);
    // 마지막 사본이 든 메시지가 다시 그려져 그 사본이 빠짐 → 칸 감시가 알림 → 앞 사본 중 마지막이 켜짐
    doc[2].isConnected = false;
    touch(doc[2].holder);
    assert.deepEqual(doc.slice(0, 2).map(n => n.disabled), [true, false]);
    // 감시는 켜 둔 한 벌의 칸들만, 자식 목록만 (하위 전체 아님)
    const mo = observers.at(-1);
    assert.ok(mo.targets.includes(doc[1].holder) && mo.targets.includes(doc[1].parentNode));
    assert.ok(mo.opts.every(o => o.childList === true && !o.subtree));
    on = false; d.run();
    assert.deepEqual(doc.slice(0, 2).map(n => n.disabled), [false, false], 'release on switch off');
});
await test('다른 코드가 일부러 끈 style 은 다시 켜지 않는다 · 문서에서 빠진 것은 잊는다', () => {
    const other = style('.o{}'); other.disabled = true;
    const doc = [style('.a{}'), style('.a{}'), other];
    const d = S.createStyleDedupe({ query: () => doc.filter(n => n.isConnected), holdersOf: n => [n.holder], MutationObserver: FakeMO, queue: fn => fn() });
    d.run();
    assert.equal(other.disabled, true, 'not ours');
    doc[0].isConnected = false; d.run();
    assert.equal(d.stats.disabled, 0);
});
await test('스트리밍 중에는 새 사본을 끄지 않는다 (스타일 계산을 더 부르지 않게) — 끝나면 정리', () => {
    let streaming = true;
    const doc = [style('.a{}'), style('.a{}')];
    const d = S.createStyleDedupe({ query: () => doc, holdersOf: n => [n.holder], streaming: () => streaming, MutationObserver: FakeMO, queue: fn => fn() });
    d.run(); assert.deepEqual(doc.map(n => n.disabled), [false, false]);
    streaming = false; d.run(); assert.deepEqual(doc.map(n => n.disabled), [true, false]);
});
await test('v3 @layer 가 든 style 은 묶지 않는다 (레이어 순서는 첫 등장이 정함 — 앞 사본을 끄면 순서가 뒤집힌다) · 다른 style 은 그대로 묶음', () => {
    const la1 = style('@layer rvA{.rvt{color:rgb(200,0,0)}}'), lb = style('@layer rvB{.rvt{color:rgb(0,0,200)}}'), la2 = style('@layer rvA{.rvt{color:rgb(200,0,0)}}');
    const st = style('@layer base, theme;'), up = style('@LAYER  x{.q{}}'), a1 = style('.a{}'), a2 = style('.a{}');
    assert.equal(S.styleKey(la1), null); assert.equal(S.styleKey(st), null, '@layer 문(이름 순서만)도'); assert.equal(S.styleKey(up), null, '대소문자');
    assert.notEqual(S.styleKey(style('.layered{}')), null, '이름에 layer 가 든 선택자는 그대로 묶음');
    const plan = S.planStyleDedupe([la1, lb, a1, la2, st, a2, up]);
    assert.deepEqual(plan.disable.map(n => n.id), [a1.id], '@layer style 은 하나도 끄지 않음');
    const doc = [style('@layer x{.a{}}'), style('@layer x{.a{}}')];
    const d = S.createStyleDedupe({ query: () => doc, holdersOf: n => [n.holder], MutationObserver: FakeMO, queue: fn => fn() });
    d.run(); assert.deepEqual(doc.map(n => n.disabled), [false, false]); assert.equal(d.stats.disabled, 0);
});
await test('perfassist.js 연결: 기본 켬 · 서랍 한 줄 · 그리기 · 갱신 · 스와이프 · 편집 · 삭제 · 채팅 바뀜 · 더 보기 · 생성 끝 · #chat 은 자식 목록만 · CI 등록', () => {
    const js = read('src/addons/perf/perfassist.js');
    assert.match(js, /import \{ createStyleDedupe \} from '\.\/styledup\.js';/);
    assert.match(js, /const DEFAULTS = Object\.freeze\(\{[^}]*dedupeStyles: true[^}]*\}\);/);
    assert.match(js, /\['dedupeStyles', '메시지 속 같은 style 은 하나만 쓰기'\]/);
    assert.match(js, /\['dedupeStyles', installStyleDedupe\]/);
    for (const name of ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MORE_MESSAGES_LOADED']) assert.ok(js.includes(`'${name}'`), name);
    assert.match(js, /observe\(chat, \{ childList: true \}\)/);
    assert.ok(!/observe\(chat, \{[^}]*subtree/.test(js), 'no subtree observer on #chat');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/style-dedupe\.mjs \./);
});


await test('v4 등록형 · 범위형 · 알 수 없는 @규칙은 건드리지 않고 조건부 규칙과 keyframes 는 합친다', () => {
    for (const name of ['font-face', 'font-feature-values', 'font-palette-values', 'property', 'counter-style', 'scope', 'position-try', 'view-transition', 'future-rule']) {
        assert.equal(S.styleKey(style('@' + name + ' x{}')), null, name);
    }
    for (const name of ['media', 'supports', 'container', 'keyframes', '-webkit-keyframes']) {
        assert.notEqual(S.styleKey(style('@' + name + ' x{}')), null, name);
    }
    assert.equal(S.styleKey(style('@media all { @font-face{font-family:X} }')), null, '중첩 등록도 제외');
    assert.equal(S.styleKey(style('@l' + String.fromCharCode(92) + '61 yer x{}')), null, '이스케이프된 @규칙 제외');
});
await test('v4 외부에서 끈 마지막 중복은 활성 사본을 대신하지 않고 이전 활성 사본은 유지', () => {
    const doc = [style('.a{}'), style('.a{}')]; doc[1].disabled = true;
    const d = S.createStyleDedupe({ query: () => doc, holdersOf: n => [n.holder], MutationObserver: FakeMO, queue: fn => fn() });
    d.run(); assert.deepEqual(doc.map(n => n.disabled), [false, true]); assert.equal(d.stats.disabled, 0);
});
await test('v4 외부에서 keeper 를 껐을 때 우리가 끈 이전 사본만 복원', () => {
    const doc = [style('.a{}'), style('.a{}'), style('.a{}')];
    const d = S.createStyleDedupe({ query: () => doc, holdersOf: n => [n.holder], MutationObserver: FakeMO, queue: fn => fn() });
    d.run(); assert.deepEqual(doc.map(n => n.disabled), [true, true, false]);
    doc[2].disabled = true; d.run(); assert.deepEqual(doc.map(n => n.disabled), [true, false, true]);
    d.release(); assert.deepEqual(doc.map(n => n.disabled), [false, false, true]);
});
await test('v4 우리가 끈 사본이 등록형 CSS 또는 title 로 바뀌면 스트리밍 중에도 돌려줌', () => {
    const doc = [style('.a{}'), style('.a{}'), style('.a{}')];
    let streaming = false;
    const d = S.createStyleDedupe({ query: () => doc, holdersOf: n => [n.holder], streaming: () => streaming, MutationObserver: FakeMO, queue: fn => fn() });
    d.run(); assert.deepEqual(doc.map(n => n.disabled), [true, true, false]);
    doc[0].textContent = '@font-face{font-family:X;src:local(Arial)}';
    doc[1].hasAttribute = k => k === 'title';
    streaming = true; d.run(); assert.deepEqual(doc.map(n => n.disabled), [false, false, false]); assert.equal(d.stats.disabled, 0);
});
await test('v4 우리가 끈 사본이 메시지 밖으로 옮겨지면 복원하고 소유를 놓음', () => {
    const doc = [style('.a{}'), style('.a{}')];
    const d = S.createStyleDedupe({ query: () => doc, holdersOf: n => [n.holder], MutationObserver: FakeMO, queue: fn => fn() });
    d.run(); const moved = doc.shift(); assert.equal(moved.disabled, true);
    d.run(); assert.equal(moved.disabled, false); assert.equal(moved.isConnected, true); assert.equal(d.stats.disabled, 0);
});

console.log(`style-dedupe: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
