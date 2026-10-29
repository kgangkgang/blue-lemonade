// 8.2.7 폰 예측점검(hunt-mobile): 꺼내 둔 쪽지(메모 스티커, 폭 900px 이상 — 가로 1200×589 폰 · 태블릿)에 글을 치려고 누르면
// 안드로이드 자판이 화면 높이를 줄이고(interactive-widget=resizes-content) resize 가 와요. placeSticky 가 쪽지를 줄어든 화면 안으로 당기거나
// (y · 높이) 줄였는데, 그 뒤 쪽지 안을 누르기만 해도(pointerup) · 높이가 줄어든 ResizeObserver 0.4초 뒤에도 rememberSticky 가 그 당긴 자리 · 크기를
// 저장했어요 → 자판을 내려도 쪽지가 위로 올라간 채 · 작아진 채 남았어요.
// 고친 뒤: 화면 크기 때문에 placeSticky 가 당긴 자리 그대로면(사람이 옮기거나 키우지 않았으면) 저장하지 않고, 화면이 다시 커지면 원래 자리로 돌아가요.
//   node tools/tests/notes-sticky-keyboard.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/notes/index.js'), 'utf8');
const pick = name => { const m = src.match(new RegExp(String.raw`\nfunction ${name}\([^)]*\) \{[\s\S]*?\n\}`)); assert.ok(m, name); return m[0]; };
const view = { innerWidth: 1200, innerHeight: 589 };
const store = {}; let saves = 0;
const make = new Function('view', 'store', 'stickies', 'onSave', `
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const isWide = () => true;
    const stickyStore = () => store;
    const saveSettingsDebounced = onSave;
    with (view) { ${pick('placeSticky')}\n${pick('rememberSticky')}\n return { placeSticky, rememberSticky }; }`);
const stickies = new Map();
const { placeSticky, rememberSticky } = make(view, store, stickies, () => { saves++; });
// 쪽지 요소 흉내: 그린 자리(style) 그대로 잰다 — 사람이 옮기면 style 이 바뀌어요
const el = { isConnected: true, hidden: false, style: {}, getBoundingClientRect() { const s = this.style; return { left: parseFloat(s.left), top: parseFloat(s.top), width: parseFloat(s.width), height: s.height === '' ? 64 : parseFloat(s.height) }; } };
stickies.set('n1', el);
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

test('처음 꺼낸 쪽지는 자리를 적어요 (다음에 열 때 되살리기 목록)', () => {
    placeSticky(el, {}); rememberSticky('n1', el);
    assert.ok(store.n1, '저장됨');
});
test('가로 폰에서 아래쪽에 둔 쪽지 → 자판이 올라와 화면이 줄면 위로 당겨 보이지만, 그 자리는 저장하지 않아요 (고치기 전: 누르기만 해도 저장)', () => {
    store.n1 = { x: 900, y: 330, w: 260, h: 240 }; saves = 0;
    placeSticky(el, store.n1);
    assert.equal(el.style.top, '330px');
    view.innerHeight = 260;                       // 자판
    placeSticky(el, store.n1);                    // resize
    assert.equal(el.style.top, '20px', '줄어든 화면 안으로');
    assert.equal(el.style.height, '240px');
    rememberSticky('n1', el);                     // 쪽지 안을 눌러 글을 침(pointerup) · ResizeObserver
    assert.deepEqual(store.n1, { x: 900, y: 330, w: 260, h: 240 }, '원래 자리 그대로');
    assert.equal(saves, 0);
    view.innerHeight = 589;                       // 자판 내림
    placeSticky(el, store.n1);
    assert.equal(el.style.top, '330px', '원래 자리로 돌아와요');
});
test('자판이 올라온 동안 높이가 줄어든 쪽지도 크기를 저장하지 않아요', () => {
    store.n1 = { x: 900, y: 40, w: 260, h: 480 };
    view.innerHeight = 300; placeSticky(el, store.n1);
    assert.equal(el.style.height, '280px');
    rememberSticky('n1', el);
    assert.equal(store.n1.h, 480);
    view.innerHeight = 589; placeSticky(el, store.n1);
    assert.equal(el.style.height, '480px');
});
test('사람이 옮기거나 키운 것은 지금처럼 저장해요 (자판이 올라와 있어도)', () => {
    view.innerHeight = 300; placeSticky(el, store.n1);
    el.style.left = '500px'; el.style.top = '10px';   // 머리를 끌어 옮김(stickyMove → rememberSticky)
    rememberSticky('n1', el);
    assert.deepEqual(store.n1, { x: 500, y: 10, w: 260, h: 280 });
    el.style.width = '300px'; rememberSticky('n1', el);  // CSS resize 로 폭을 키움
    assert.equal(store.n1.w, 300);
    view.innerHeight = 589;
});
test('폴더 쪽지(높이는 줄 수만큼 · style.height 비움)도 화면 때문에 당긴 자리는 저장하지 않아요', () => {
    store['f:a'] = { x: 900, y: 500, w: 230, h: 64 }; stickies.set('f:a', el);
    view.innerHeight = 260; placeSticky(el, store['f:a']); el.style.height = '';
    rememberSticky('f:a', el);
    assert.equal(store['f:a'].y, 500);
    view.innerHeight = 589;
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/notes-sticky-keyboard.mjs .'), 'release-check.yml 에 등록');
console.log(`쪽지 자판 · 회전 자리 지키기: ${pass}개 통과했어요.`);
