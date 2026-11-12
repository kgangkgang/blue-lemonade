// 제로(입력판 배치 없이 startFavoritesHeading 만 도는 길)에서도 QR 줄 위 손짓이 문서까지 안 올라가는지 (11-12 전체 점검 1부)
//   제로도 테마 CSS(css/21)가 QR 줄을 가로로 넘기는 줄로 만들어요. 예전엔 8.2.3 가드가 startCompactLayout 안에만 있어
//   제로 · 폰에서 줄을 옆으로 밀면 실리태번 손짓(document 의 swiped-left/right)이 다음 답 · 새 답 만들기로 읽었어요.
//   node tools/tests/qr-swipe-guard-zero.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const dom = await import(url('tools/tests/leak-dom.mjs'));
dom.installBrowser({});
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const form = document.getElementById('send_form');
const bar = document.createElement('div'); bar.setAttribute('id', 'qr--bar');
const button = document.createElement('div'); button.setAttribute('class', 'qr--button menu_button');
bar.append(button); form.prepend(bar);
const text = document.createElement('div'); text.setAttribute('class', 'mes_text');
document.body.append(text);
let seen = 0;
for (const type of ['touchstart', 'touchmove', 'touchend']) document.addEventListener(type, () => { seen++; }, { passive: true });
const swipe = target => { seen = 0; for (const type of ['touchstart', 'touchmove', 'touchend']) target.dispatchEvent(new Event(type, { bubbles: true })); return seen; };

const { startFavoritesHeading } = await import(url('src/layout.js'));
startFavoritesHeading();   // index.js 의 제로 길 — startCompactLayout 은 부르지 않아요

await test('제로: QR 줄 위 손짓(시작 · 끌기 · 뗌)은 문서(실리태번 손짓)까지 안 올라가요', () => { assert.equal(swipe(button), 0); });
await test('제로: 줄 밖(채팅 본문) 손짓은 그대로 올라가요', () => { assert.equal(swipe(text), 3); });
console.log(`qr-swipe-guard-zero: ${passed} 통과`);
