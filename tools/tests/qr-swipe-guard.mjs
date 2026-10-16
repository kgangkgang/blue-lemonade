// 6.9.8 퀵 리플라이 줄을 좌우로 밀 때 실리태번 손짓(스와이프 · 새 답)이 돌지 않게 — 줄 안 터치는 문서로 올리지 않는다
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/layout.js'), 'utf8');
assert.match(src, /const qrSwipeGuard = event => \{ if \(event\.target\.closest\?\.\('#qr--bar'\)\) event\.stopPropagation\(\); \};/);
assert.match(src, /for \(const type of \['touchstart', 'touchmove', 'touchend'\]\) sendForm\?\.addEventListener\(type, qrSwipeGuard, \{ passive: true \}\);/);
// 흉내: 문서 손짓 처리기는 줄 안 터치를 못 받고, 줄 밖 터치는 받는다
let docGot = 0;
const make = inBar => { let stopped = false; return { target: { closest: sel => (sel === '#qr--bar' && inBar ? {} : null) }, stopPropagation() { stopped = true; }, get stopped() { return stopped; } }; };
const guard = new Function(`return ${src.match(/const qrSwipeGuard = (event => \{[^}]*\});/)[1]}`)();
for (const inBar of [true, false]) { const e = make(inBar); guard(e); if (!e.stopped) docGot++; }
assert.equal(docGot, 1);
const ci = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
assert.ok(ci.includes('node tools/tests/qr-swipe-guard.mjs .'));
console.log('PASS qr-swipe-guard: bar touches stay out of the document swipe gesture');
