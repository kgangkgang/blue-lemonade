// 6.9.2 중국어 · 일본어 덩어리 줄바꿈 (src/typography.js cjkPieces · css/06-chat-text.css) — 가상 문장.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
globalThis.document = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null };
const T = await import(pathToFileURL(path.join(root, 'src/typography.js')).href);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
check('long Chinese / Japanese runs become their own pieces; Korean and short Hanja stay', () => {
    const line = '「你今天怎么这么晚才回来呀我等你很久了」 (오늘 왜 이렇게 늦게 왔어, 한참 기다렸잖아)';
    const pieces = T.cjkPieces(line);
    assert.deepEqual(pieces.filter(p => p.cjk).map(p => p.text), ['你今天怎么这么晚才回来呀我等你很久了']);
    assert.equal(pieces.map(p => p.text).join(''), line, 'text unchanged');
    assert.deepEqual(T.cjkPieces('그는 室長님께 인사했다.'), [{ text: '그는 室長님께 인사했다.', cjk: false }], 'short Hanja in Korean');
    assert.deepEqual(T.cjkPieces('그냥 한국어 문장이다.'), [{ text: '그냥 한국어 문장이다.', cjk: false }]);
    const ja = T.cjkPieces('「ねえ、今日はどこへ行くの？一緒に行こうよ。」');
    assert.equal(ja.filter(p => p.cjk).length, 1);
    assert.equal(ja.map(p => p.text).join(''), '「ねえ、今日はどこへ行くの？一緒に行こうよ。」');
});
check('wiring: wrapped after the quote leads, unwrapped when typography turns off, CSS breaks inside only', () => {
    const src = fs.readFileSync(path.join(root, 'src/typography.js'), 'utf8');
    assert.match(src, /jobs\.forEach\(writeRoot\);\n    roots\.forEach\(wrapCjkRuns\);/);
    assert.match(src, /querySelectorAll\(`\.\$\{CJK_WRAP\}`\)\.forEach\(node=>node\.replaceWith\(\.\.\.node\.childNodes\)\)/);
    const css = fs.readFileSync(path.join(root, 'css/06-chat-text.css'), 'utf8');
    assert.match(css, /\.salty-sample\) \.bl-cjk \{\s*word-break: normal;/);
});
check('Korean RP words kept: 사칭 · 대체 인사말', () => {
    const data = fs.readFileSync(path.join(root, 'src/ko-ui-data.js'), 'utf8');
    assert.match(data, /"Impersonate": "사칭"/);
    assert.match(data, /"Alternate Greetings": "대체 인사말"/);
    assert.ok(!/대신 쓰기/.test(data.replace(/AI에게 내 메시지를 대신 쓰게/g, '')), 'no 대신 쓰기 left for impersonate');
});
console.log(`cjk-wrap: ${passed} passed, 0 failed`);
