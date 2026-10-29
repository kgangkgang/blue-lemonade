// 8.2.7 폰 예측점검(hunt-mobile): QR 찾기 팝업(src/qrfind.js)은 window resize 에만 자리를 다시 잡았어요. 아이폰 사파리(와 보이는 화면만 줄이는 웹뷰)는
// 자판이 올라와도 창 크기가 그대로이고 visualViewport 만 줄어요 → 찾기 칸을 눌러 자판이 뜨면 목록 아래쪽이 자판 밑에 깔렸어요.
// 고친 뒤: 고르기 목록 팝업(selects.js)처럼 visualViewport resize · scroll 에도 한 프레임에 한 번 다시 붙여요.
//   node tools/tests/qrfind-keyboard.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const on = target => { target.listeners = {}; target.addEventListener = (t, fn) => { (target.listeners[t] ||= []).push(fn); }; target.removeEventListener = (t, fn) => { target.listeners[t] = (target.listeners[t] || []).filter(f => f !== fn); }; target.fire = t => (target.listeners[t] || []).forEach(fn => fn({ type: t, target })); return target; };
const el = (props = {}) => on({ style: {}, classList: { toggle() {} }, children: [], append(...n) { this.children.push(...n); n.forEach(c => { c.parentElement = this; }); }, remove() {}, focus() {}, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ...props });
const frames = [];
const vv = on({ offsetLeft: 0, offsetTop: 0, width: 390, height: 800 });
const box = el();
Object.defineProperty(box, 'offsetHeight', { get() { return Math.min(300, parseFloat(box.style.maxHeight) || 300); } });
const input = el(), rows = el({ innerHTML: '' });
box.querySelector = sel => (sel === 'input' ? input : sel === '.salty-pick-rows' ? rows : null);
const body = el();
globalThis.window = on({ innerWidth: 390, innerHeight: 800, visualViewport: vv });
globalThis.document = on({ body, createElement: () => { const layer = el(); Object.defineProperty(layer, 'innerHTML', { set() { layer.firstElementChild = box; } }); return layer; }, querySelectorAll: () => [] });
globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
const { openQrFind } = await import(pathToFileURL(path.join(root, 'src/qrfind.js')));
// 입력판 바로 위의 돋보기(화면 아래쪽) — 목록은 그 위로 뜬다
const anchor = el({ isConnected: true, getBoundingClientRect: () => ({ left: 8, right: 44, top: 700, bottom: 736, width: 36, height: 36 }) });
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const bottomOf = () => parseFloat(box.style.top) + box.offsetHeight;
test('처음 열면 돋보기 위 보이는 화면 안에 붙어요', () => {
    openQrFind(anchor);
    assert.ok(bottomOf() <= 800 - 8, `${bottomOf()}`);
    assert.ok(parseFloat(box.style.top) >= 8);
});
test('아이폰 자판: 창 크기는 그대로 · 보이는 화면만 360px 로 줄면 목록을 보이는 화면 안으로 다시 붙여요 (고치기 전: 그대로 자판 밑)', () => {
    vv.height = 360;                               // window resize 는 오지 않아요
    vv.fire('resize');
    while (frames.length) frames.shift()();
    assert.ok(bottomOf() <= 360 - 8 + 0.5, `목록 아래 ${bottomOf()}px > 보이는 화면 352px`);
    assert.ok(parseFloat(box.style.maxHeight) <= 360 * 0.7 + 0.5);
});
test('자판을 내리면(보이는 화면이 커지면) 다시 돋보기 위로', () => {
    vv.height = 800; vv.fire('resize'); while (frames.length) frames.shift()();
    assert.equal(bottomOf(), 700 - 8);
});
test('사파리가 보이는 화면을 옮기면(offsetTop) 그 안으로 · 잇단 신호는 한 프레임에 한 번만', () => {
    vv.height = 360; vv.offsetTop = 300;
    vv.fire('scroll'); vv.fire('resize'); vv.fire('scroll');
    assert.equal(frames.length, 1);
    while (frames.length) frames.shift()();
    assert.ok(parseFloat(box.style.top) >= 300 + 8 && bottomOf() <= 300 + 360 - 8 + 0.5, `${box.style.top} ${bottomOf()}`);
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/qrfind-keyboard.mjs .'), 'release-check.yml 에 등록');
console.log(`QR 찾기 자판 자리: ${pass}개 통과했어요.`);
