// String.replace 의 바꿀 글에 사용자 글 · 받은 글을 그대로 넣으면 $& · $' · $` · $$ · $1 이 치환 표시로 풀려요.
//   (예: 이름이 「A$'」 인 목소리 → 뒤따르는 HTML 이 이름 자리에 통째로 끼어듦 · 번역 글 「$$5」 → 「$5」)
//   1.5.8 까지 그대로 넣던 자리들이 함수 꼴(() => 글)인지 실제 줄로 보고, 그 줄을 떼어 돌려 봐요.
//   node tools/tests/replace-dollar.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const lineOf = (rel, needle) => { const line = read(rel).split('\n').find(l => l.includes(needle)); assert.ok(line, `${rel}: 「${needle}」 줄을 찾아요`); return line; };
const TRICKY = "A$'B$&C$$D$`E$1F";

test('JS 규칙: 문자열 바꿀 글은 $ 를 풀고, 함수는 글자 그대로', () => {
    assert.notEqual('x[slot]y'.replace('[slot]', TRICKY), 'x' + TRICKY + 'y');
    assert.equal('x[slot]y'.replace('[slot]', () => TRICKY), 'x' + TRICKY + 'y');
});
test('TTS 엑스트라 목소리 이름 (tts/src/ui.js)', () => {
    const line = lineOf('src/addons/tts/src/ui.js', "const opts = voiceOptions('').replace(");
    const opts = new Function('voiceOptions', 'esc', 'auto', line.replace('const opts =', 'return'))(() => '<option value="">(없음)</option><option value="v1">V1</option>', s => s, TRICKY);
    assert.equal(opts, `<option value="" selected>${TRICKY}</option><option value="v1">V1</option>`);
});
test('한글화 글 바꾸기 (ko-ui.js)', () => {
    const line = lineOf('src/ko-ui.js', 'node.nodeValue = node.nodeValue.replace(text,');
    const node = { nodeValue: '  Price  ' };
    new Function('node', 'text', 'value', 'changed', line.trim())(node, 'Price', TRICKY, 0);
    assert.equal(node.nodeValue, `  ${TRICKY}  `);
});
test('캡처: 배경 그림 · 글꼴 주소 (chat-capture.js)', () => {
    const src = read('src/chat-capture.js');
    assert.ok(src.includes('output=output.replace(match.raw,()=>inlined)'));
    assert.ok(src.includes('css=rule.cssText.replace(rule.style.src,()=>`url("${embedded}")`)'));
    assert.ok(!/\.replace\(match\.raw,`/.test(src) && !/\.replace\(rule\.style\.src,`/.test(src), '문자열 꼴이 남아 있지 않아요');
});
test('커스텀 CSS 조절 값 저장 (customstyle/index.js)', () => {
    const line = lineOf('src/addons/customstyle/index.js', 'newContent = currentContent.replace(rootRegex,');
    const out = new Function('currentContent', 'rootRegex', 'generatedCSS', `let newContent; ${line.trim()}
return newContent;`)(':root { --a: 1; }', /:root\s*\{/, TRICKY);
    assert.ok(out.includes(`--custom-theme-style-inputs: ${TRICKY};`), out);
    assert.ok(out.endsWith(' --a: 1; }'));
});
console.log(`replace-dollar: ${passed} passed`);
