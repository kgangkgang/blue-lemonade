import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseHtml } from './leak-dom.mjs';
const require = createRequire(import.meta.url), lib = require('../css-lib.cjs');
const root = path.resolve(process.argv[2] || '.');
const fixture = JSON.parse(fs.readFileSync(new URL('./dem-selector-classes.json', import.meta.url), 'utf8'));
const sources = ['08-regex-unify.css', '23-preview.gen.css', '28-late-fixes.css', '38-outline.css'].map(file => fs.readFileSync(path.join(root, 'css', file), 'utf8'));
let checked = 0;
for (const [old, classes] of Object.entries(fixture.replacements)) {
    const next = classes.length === 1 ? '.' + classes[0] : ':is(' + classes.map(c => '.' + c).join(',') + ')';
    assert.deepEqual(lib.spec(old), lib.spec(next));
    assert.ok(sources.some(text => text.includes(next)), `${old}의 새 규칙이 원본에 있어요`);
    for (const text of sources) assert.ok(!lib.stripComments(text).includes(old), `${old}를 다시 쓰지 않아요`);
    for (const name of [...fixture.classes, 'plain-message', 'custom-other-card']) {
        for (const list of [name, `extra ${name} active`]) {
            const [el] = parseHtml(`<span class="${list}"></span>`);
            assert.equal(el.matches(old), el.matches(next), `${old}: ${list}`); checked++;
        }
    }
}
console.log(`데우스 클래스 선택자 ${checked}개 조합의 결과와 특이도를 확인했어요.`);
