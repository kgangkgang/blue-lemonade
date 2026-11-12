// 1.1.3 감사 G11: 실리태번 1.16 · 1.18 · 1.19 어디에도 없는 옛 문구 12개는 ko-ui 고침 표(FIX)와 글자 사전 원본에서 걷어요.
//   「Verifies your API connection …」 은 1.16 · 1.18 화면에 있어서 남겨요. 글자 사전 생성물(src/ko-ui-text.*.gen.js)에도 남지 않아야 해요.
//   node tools/tests/audit113-ko-dead.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { FIX } = await import(pathToFileURL(path.join(root, 'src/ko-ui-data.js')).href);
const { readSource } = await import(pathToFileURL(path.join(root, 'tools/ko-dict-prune.mjs')).href);
const DEAD = [
    'Number of Beams',
    "Don't add character names.",
    'Wrap in Quotes',
    'Wrap entire user message in quotes before sending.',
    'Leave off if you use quotes manually for speech.',
    "Use the appropriate tokenizer for Jurassic models, which is more efficient than GPT's.",
    'Use Google Tokenizer',
    'Use the appropriate tokenizer for Google models via their API. Slower prompt processing, but offers much more accurate token counting.',
    'User first message',
    'Restore User first message',
    'For privacy reasons, your API key will be hidden after you reload the page.',
    'Default (completions compatible)',
];
const KEEP = 'Verifies your API connection by sending a short test message. This may incur usage charges.';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
test('FIX 에서 죽은 열쇠 12개를 걷고 1.16 · 1.18 에 있는 하나는 남겨요', () => {
    assert.deepEqual(DEAD.filter(k => Object.hasOwn(FIX, k)), []);
    assert.ok(Object.hasOwn(FIX, KEEP));
});
test('글자 사전 원본(tools/scripts-src/korean.js)에도 없어요', () => {
    const { translations } = readSource(fs.readFileSync(path.join(root, 'tools/scripts-src/korean.js'), 'utf8'));
    assert.deepEqual(DEAD.filter(k => Object.hasOwn(translations, k)), []);
});
test('글자 사전 생성물(src/ko-ui-text.*.gen.js)에도 없어요', () => {
    const left = [];
    for (const name of fs.readdirSync(path.join(root, 'src')).filter(n => /^ko-ui-text\..+\.gen\.js$/.test(n))) {
        const text = fs.readFileSync(path.join(root, 'src', name), 'utf8');
        for (const k of DEAD) if (text.includes(JSON.stringify(k))) left.push(`${name}: ${k}`);
    }
    assert.deepEqual(left, []);
});
console.log(`audit113-ko-dead: ${passed} passed`);
