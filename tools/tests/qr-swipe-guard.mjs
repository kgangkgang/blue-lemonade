// 6.9.8 퀵 리플라이 줄을 좌우로 밀 때 실리태번 손짓(스와이프 · 새 답)이 돌지 않게 — 줄 안 터치는 문서로 올리지 않는다
// 8.2.3 (제보 「QR 즐겨찾기 줄을 넘기다가 대사가 재생성됨 · 모바일」) 가드를 body 로 올리고 가로로 넘치는 줄 전부(캐릭터 즐겨찾기 · 탭 줄 · 글꼴 묶음 · QR 미리보기 · QR 팝아웃)로 넓힘
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/layout.js'), 'utf8');
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
// 순수 판정 함수만 떼어 낸다(layout.js 는 문서가 있어야 읽힘)
const SWIPE_STRIPS = src.match(/export const SWIPE_STRIPS = '([^']+)';/)[1];
const swipeStripOf = new Function('SWIPE_STRIPS', `return ${src.match(/export (function swipeStripOf\(target, selector = SWIPE_STRIPS\) \{[\s\S]*?\n\})/)[1]}`)(SWIPE_STRIPS);
const el = (sels, box = {}) => { const node = { sels, scrollWidth: 100, clientWidth: 100, id: '', ...box }; node.closest = sel => sel.split(',').map(s => s.trim()).some(s => sels.includes(s)) ? node : null; return node; };
test('줄 목록: QR 줄 · QR 팝아웃 · 캐릭터 즐겨찾기 줄 · 탭 줄 · 글꼴 묶음 · QR 미리보기', () => {
    for (const s of ['#qr--bar', '#qr--popout', '#HotSwapWrapper .hotswap', '[data-bl-fade]', '.salty-fonttags', '.bl-qr-sample']) assert.ok(SWIPE_STRIPS.includes(s), s);
});
test('QR 줄 · 팝아웃은 넘치지 않아도 늘 막고, 다른 줄은 실제로 가로로 넘칠 때만', () => {
    assert.ok(swipeStripOf(el(['#qr--bar'], { id: 'qr--bar' })));
    assert.ok(swipeStripOf(el(['#qr--popout'], { id: 'qr--popout' })));
    assert.equal(swipeStripOf(el(['#HotSwapWrapper .hotswap'])), null, '맞는 즐겨찾기 줄은 스와이프 그대로');
    assert.ok(swipeStripOf(el(['#HotSwapWrapper .hotswap'], { scrollWidth: 700, clientWidth: 300 })));
    assert.ok(swipeStripOf(el(['[data-bl-fade]'], { scrollWidth: 400, clientWidth: 300 })));
    assert.equal(swipeStripOf(el(['.mes_text'], { scrollWidth: 900, clientWidth: 300 })), null, '채팅 본문은 7.0.2 가드(chat) 몫');
    assert.equal(swipeStripOf(null), null); assert.equal(swipeStripOf({}), null);
});
test('body 에서 받는다: QR 줄은 touchstart 부터, 다른 줄은 touchmove · touchend · touchcancel 만 멈추고 touchstart 는 올린다', () => {
    assert.match(src, /document\.body\.addEventListener\('touchstart', event => \{ stripGesture = !!swipeStripOf\(event\.target\); if \(stripGesture && event\.target\.closest\?\.\('#qr--bar'\)\) event\.stopPropagation\(\); \}, \{ passive: true \}\);/);
    assert.match(src, /for \(const type of \['touchmove', 'touchend', 'touchcancel'\]\) document\.body\.addEventListener\(type, event => \{ if \(stripGesture\) event\.stopPropagation\(\); if \(type !== 'touchmove'\) stripGesture = false; \}, \{ passive: true \}\);/);
    assert.doesNotMatch(src, /sendForm\?\.addEventListener\(type, qrSwipeGuard/, '옛 #send_form 가드는 뗌(중복 방지)');
});
test('흉내: 줄 안에서 시작한 손짓의 touchmove 는 문서가 못 받고, 줄 밖은 받는다', () => {
    let stripGesture = false, docGot = 0;
    const start = event => { stripGesture = !!swipeStripOf(event.target); };
    const move = event => { if (stripGesture) event.stopPropagation(); else docGot++; };
    for (const target of [el(['#qr--bar'], { id: 'qr--bar' }), el(['.mes_text'])]) { start({ target }); move({ target, stopPropagation() {} }); }
    assert.equal(docGot, 1);
});
const ci = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
assert.ok(ci.includes('node tools/tests/qr-swipe-guard.mjs .'));
console.log(`QR 스와이프 가드: ${pass}개 통과했어요.`);
