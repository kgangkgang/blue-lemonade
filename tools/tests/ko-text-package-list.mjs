// 1.4.x 최적화 C(검토 C 1 · 2번): 한국어 글자 사전 JSON 일곱 장이 설치 ZIP 목록(tools/release_gate.py)과 무결성 표(tools/build-integrity.mjs)에
//   같은 목록으로 들어가는지 잠가요. 목록의 정본은 생성기(tools/build-korean-dict.mjs)의 INDEX_FILE · PART_NAMES · partFile 이에요.
//   node tools/tests/ko-text-package-list.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const dict = await import(pathToFileURL(path.join(root, 'tools/build-korean-dict.mjs')).href);
const want = [dict.INDEX_FILE, ...dict.PART_NAMES.map(dict.partFile)];

test('생성기 목록: 색인 + 조각 여섯 · 모두 src 바로 아래 .gen.json · 파일이 있어요', () => {
    assert.equal(want.length, 7);
    for (const rel of want) {
        assert.match(rel, /^src\/ko-ui-text\.[a-z]+\.gen\.json$/);
        assert.ok(fs.existsSync(path.join(root, rel)), rel);
    }
});
test('출시 관문의 KO_TEXT_PARTS 가 생성기와 같아요(ZIP 목록)', () => {
    const m = read('tools/release_gate.py').match(/^KO_TEXT_PARTS = \(([^)]*)\)/m);
    assert.ok(m, 'KO_TEXT_PARTS 줄');
    const parts = [...m[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]);
    assert.deepEqual(parts.map(p => `src/ko-ui-text.${p}.gen.json`), want);
    assert.match(read('tools/release_gate.py'), /names\.append\(rel\)/);
});
test('무결성 표는 생성기 목록을 그대로 써요', () => {
    const code = read('tools/build-integrity.mjs');
    assert.match(code, /tools\/build-korean-dict\.mjs/);
    assert.match(code, /\[koDict\.INDEX_FILE,\.\.\.koDict\.PART_NAMES\.map\(koDict\.partFile\)\]/);
    assert.match(code, /\.\.\.koTextFiles,/);
});
test('받는 코드(ko-ui.js)의 주소 꼴이 생성기 파일 이름과 맞아요', () => {
    assert.ok(read('src/ko-ui.js').includes('fetch(new URL(`./ko-ui-text.${name}.gen.json`, import.meta.url)'));
    for (const rel of want) assert.equal(rel, `src/ko-ui-text.${rel.split('.')[1]}.gen.json`);
});
console.log(`ko-text-package-list: ${passed} passed`);
