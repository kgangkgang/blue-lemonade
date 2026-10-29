// 8.2.7 TTS 대사 색: 한 번 칠할 때(flush 한 조각) 메시지 요소를 한 번 모아 넘겨요 — 메시지마다 문서에서 #chat .mes[mesid="…"] 를 찾던 것 (perf-addons).
//   같은 번호가 둘이면 앞의 것(querySelector 와 같음), 표에 없으면 paintMessage 가 예전처럼 찾아요.
//   node tools/tests/tts-paint-boxes.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseHtml } from './leak-dom.mjs';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/tts/src/paint.js'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };
const flush = src.match(/function flush\(\) \{([\s\S]*?)\n\}/)?.[1] || '';

check('flush 는 메시지 요소 표를 한 번 만들어 paintMessage 에 넘겨요', () => {
    assert.match(flush, /const boxes = new Map\(\);/, '메시지 요소 표가 없어요(메시지마다 문서를 찾아요)');
    assert.match(flush, /document\.querySelectorAll\('#chat \.mes\[mesid\]'\)/);
    assert.match(flush, /paintMessage\(id, boxes\.get\(id\) \|\| null\)/);
    assert.match(src, /const box = el \|\| mesEl\(mesId\);/, '표에 없으면 예전처럼 찾아요');
});
check('표는 querySelector 와 같은 요소를 골라요(같은 번호면 앞의 것 · 번호 아닌 것은 뺌)', () => {
    const line = flush.match(/for \(const el of document\.querySelectorAll\('#chat \.mes\[mesid\]'\)\) \{([^\n]*)\}/);
    assert.ok(line, '표 만드는 줄');
    const mesIdOf = el => { const n = Number(el?.getAttribute?.('mesid')); return Number.isInteger(n) ? n : null; };
    const chat = parseHtml('<div id="chat"><div class="mes" mesid="1" data-k="a"></div><div class="mes" mesid="2"></div><div class="mes" mesid="1" data-k="b"></div><div class="mes" mesid="x"></div></div>')[0];
    const boxes = new Map();
    new Function('els', 'boxes', 'mesIdOf', `for (const el of els) {${line[1]}}`)(chat.querySelectorAll('.mes[mesid]'), boxes, mesIdOf);
    assert.deepEqual([...boxes.keys()], [1, 2]);
    assert.equal(boxes.get(1).getAttribute('data-k'), 'a');
});
console.log(`tts-paint-boxes: ${passed}개 통과`);
