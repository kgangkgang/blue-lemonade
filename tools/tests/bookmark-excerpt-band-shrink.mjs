// 버그 사냥 2차: 발췌 모양이 길이 상한(24,000자)을 넘을 때 「띠 · 기울기만 남기기」가 바탕색과 기울기만 남겨, 형광펜 띠(background-image)가 다 빠졌어요.
//   글자마다 색이 다른 효과 글에 형광펜이 든 긴 대목 — 지어낸 글만.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const ex = await import(pathToFileURL(path.join(root, 'src/addons/bookmarks/excerpts.js')).href);
const band = ex.bandImage('rgba(255, 220, 0, 0.5)', 55, 95);
assert.ok(ex.cleanStyle(`background-image:${band}`), '시험 띠 값이 허용 꼴이에요');
// 글자마다 색이 다르고(조각이 안 합쳐짐) 같은 띠가 깔린 긴 글
const pieces = [];
for (let i = 0; i < 700; i++) pieces.push({ text: '가', style: { color: `rgb(${i % 256}, ${(i * 7) % 256}, 40)`, 'background-image': band, 'font-style': 'italic' } });
const packed = ex.packExcerpt(pieces);
assert.ok(packed, '발췌가 만들어져요');
assert.ok(packed.html.length <= ex.EXCERPT_LIMITS.html, '길이 상한 안');
assert.doesNotMatch(packed.html, /color:rgb\(1, 7, 40\)/, '글자색은 줄였어요(상한을 넘는 글)');
assert.match(packed.html, /linear-gradient/, '줄여도 형광펜 띠는 남아요');
assert.match(packed.html, /font-style:italic/, '기울기도 남아요');
// 고를 때(excerpt-capture.js)도 같은 줄이기
const fs = await import('node:fs');
const capture = fs.readFileSync(path.join(root, 'src/addons/bookmarks/excerpt-capture.js'), 'utf8');
const lighter = /const lighter = runs\.map\(run => \(run\.text \? \{ text: run\.text, style: \{([^}]*)\} \} : run\)\);/.exec(capture);
assert.ok(lighter, 'excerpt-capture.js 의 줄이기 줄');
assert.match(lighter[1], /'background-image'/, '고를 때도 띠를 남겨요');
console.log('통과: 긴 발췌를 줄여도 형광펜 띠가 남아요');
