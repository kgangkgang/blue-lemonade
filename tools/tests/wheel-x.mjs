// 8.2.3 가로로만 넘치는 칸은 Shift 없이 휠로 (src/wheel-x.js) — 작은 DOM 흉내: 후보 찾기 · 건너뛰기 · 델타 변환 · 끝에서 통과 · 문서에 리스너 하나
//   node tools/tests/wheel-x.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { findWheelStrip, wheelToX, wantsWheel, installWheelX, SKIP } = await import(pathToFileURL(path.join(root, 'src/wheel-x.js')));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

// ---- DOM 흉내: sels = 이 요소가 맞는 선택자 조각들, 나머지는 치수
const doc = { body: null };
function el(sels = [], box = {}) {
    const node = { nodeType: 1, sels, parentElement: null, ownerDocument: doc, scrollLeft: 0, clientWidth: 100, scrollWidth: 100, clientHeight: 40, scrollHeight: 40, overflowX: 'visible', ...box };
    node.matches = selector => selector.split(',').map(s => s.trim()).some(s => sels.includes(s));
    node.closest = selector => { for (let n = node; n; n = n.parentElement) if (n.matches(selector)) return n; return null; };
    return node;
}
const body = el(['body']); doc.body = body;
const style = n => ({ overflowX: n.overflowX });
const under = (parent, child) => { child.parentElement = parent; return child; };
const strip = (box) => el(['.hotswap'], { clientWidth: 300, scrollWidth: 900, clientHeight: 60, scrollHeight: 60, overflowX: 'auto', ...box });

test('즐겨찾기 줄 안의 아바타에서 올라가 가로로만 넘치는 줄을 찾아요', () => {
    const s = under(body, strip()); const avatar = under(s, el(['.avatar']));
    assert.equal(findWheelStrip(avatar, body, style), s);
    assert.equal(findWheelStrip(s, body, style), s, '줄 자체도');
});
test('글자 노드(nodeType 3)에서는 부모부터 봐요', () => {
    const s = under(body, strip()); const span = under(s, el(['span'])); const text = { nodeType: 3, parentElement: span };
    assert.equal(findWheelStrip(text, body, style), s);
});
test('안 넘치는 줄 · 보이지 않는 줄(clientWidth 0)은 지나쳐요', () => {
    for (const box of [{ scrollWidth: 300 }, { clientWidth: 0 }]) { const s = under(body, strip(box)); assert.equal(findWheelStrip(under(s, el()), body, style), null); }
});
test('세로로도 넘치는 칸(캐릭터 목록처럼 overflow auto 둘 다)은 세로가 우선 — 더 올라가지도 않아요', () => {
    const outer = under(body, strip());
    const list = under(outer, el(['#rm_print_characters_block'], { clientWidth: 300, scrollWidth: 400, clientHeight: 200, scrollHeight: 900, overflowX: 'auto' }));
    assert.equal(findWheelStrip(under(list, el()), body, style), null);
});
test('overflow 가 visible · hidden 인 넓은 자식은 지나치고 그 위의 auto 칸을 굴려요', () => {
    const s = under(body, strip());
    const wide = under(s, el(['.qr--buttons'], { clientWidth: 300, scrollWidth: 900, overflowX: 'visible' }));
    const hidden = under(wide, el([], { clientWidth: 300, scrollWidth: 900, overflowX: 'hidden' }));
    assert.equal(findWheelStrip(under(hidden, el()), body, style), s);
});
test('#chat · 메시지 본문 · textarea · pre · 편집 칸 · 퀵 리플라이 줄 · 끈 칸 안은 건너뛰어요', () => {
    for (const sel of ['#chat', '.mes_text', 'textarea', 'pre', '#qr--bar', '[contenteditable="true"]', '[data-bl-wheel-x="off"]']) {
        assert.ok(SKIP.includes(sel), sel);
        const s = under(body, strip()); const skip = under(s, el([sel], { clientWidth: 300, scrollWidth: 900, overflowX: 'auto' }));
        assert.equal(findWheelStrip(under(skip, el()), body, style), null, sel);
    }
});
test('body · root 에 닿으면 멈춰요', () => {
    body.scrollWidth = 9000; body.clientWidth = 300; body.overflowX = 'auto';
    assert.equal(findWheelStrip(under(body, el()), body, style), null);
    body.scrollWidth = 100; body.overflowX = 'visible';
});

// ---- 델타 변환
const ev = (over = {}) => { const e = { deltaX: 0, deltaY: 50, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, prevented: 0, preventDefault() { this.prevented++; }, ...over }; return e; };
test('픽셀 델타는 그대로, 줄 델타는 20px, 쪽 델타는 칸 너비만큼 — 움직였으면 preventDefault', () => {
    const s = strip(); const e = ev(); assert.equal(wheelToX(e, s), true); assert.equal(s.scrollLeft, 50); assert.equal(e.prevented, 1);
    const e1 = ev({ deltaY: 3, deltaMode: 1 }); wheelToX(e1, s); assert.equal(s.scrollLeft, 110);
    const e2 = ev({ deltaY: 1, deltaMode: 2 }); wheelToX(e2, s); assert.equal(s.scrollLeft, 410);
    const back = ev({ deltaY: -400 }); wheelToX(back, s); assert.equal(s.scrollLeft, 10);
});
test('끝에 닿아 못 움직이면 preventDefault 하지 않아요(바깥 세로 스크롤로 넘어가게) · 칸 없음 · 델타 0 도', () => {
    // 흉내: 실제 요소처럼 scrollLeft 를 최대값에서 자른다
    const s = strip(); Object.defineProperty(s, 'scrollLeft', { get() { return this._l || 0; }, set(v) { this._l = Math.max(0, Math.min(600, v)); } });
    s.scrollLeft = 600; const e = ev(); assert.equal(wheelToX(e, s), false); assert.equal(e.prevented, 0);
    assert.equal(wheelToX(ev(), null), false); assert.equal(wheelToX(ev({ deltaY: 0 }), strip()), false);
});
test('보조키 · 가로 우세 · 이미 처리된 이벤트(탭 줄 · 퀵 리플라이 줄) · 테마 꺼짐은 받지 않아요', () => {
    const salty = { classList: { contains: c => c === 'salty' } }, plain = { classList: { contains: () => false } };
    assert.equal(wantsWheel(ev(), salty), true);
    for (const over of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { deltaX: 50 }, { deltaX: 60, deltaY: 50 }, { defaultPrevented: true }, { deltaY: 0 }]) assert.equal(wantsWheel(ev(over), salty), false, JSON.stringify(over));
    assert.equal(wantsWheel(ev(), plain), false);
});

// ---- 설치: 문서에 리스너 하나(passive:false), 두 번 불러도 하나
test('installWheelX 는 문서에 wheel 리스너 하나만 달고 즐겨찾기 줄을 굴려요', () => {
    const listeners = [];
    const fakeDoc = { documentElement: {}, body: { nodeType: 1, matches: () => false, classList: { contains: c => c === 'salty' } }, addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }), defaultView: { getComputedStyle: n => ({ overflowX: n.overflowX }) } };
    installWheelX(fakeDoc); installWheelX(fakeDoc);
    assert.equal(listeners.length, 1); assert.equal(listeners[0].type, 'wheel'); assert.equal(listeners[0].opts.passive, false);
    const s = strip(); s.ownerDocument = fakeDoc; s.parentElement = fakeDoc.body; const inner = el(); inner.ownerDocument = fakeDoc; inner.parentElement = s;
    const e = ev({ target: inner }); listeners[0].fn(e); assert.equal(s.scrollLeft, 50); assert.equal(e.prevented, 1);
    const shift = ev({ target: inner, shiftKey: true }); listeners[0].fn(shift); assert.equal(s.scrollLeft, 50); assert.equal(shift.prevented, 0);
    installWheelX(null); installWheelX({});
});
test('index.js 가 테마 실행 때 installWheelX 를 부르고, 스크롤바 CSS 는 손대지 않았어요', () => {
    const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    assert.match(index, /installWheelX\(\)/);
    const smear = fs.readFileSync(path.join(root, 'css/01-smear-topbar-drawers.css'), 'utf8');
    assert.match(smear, /::-webkit-scrollbar/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/wheel-x.js'), 'utf8'), /scrollbar/);
});
console.log(`가로 휠: ${pass}개 통과했어요.`);
