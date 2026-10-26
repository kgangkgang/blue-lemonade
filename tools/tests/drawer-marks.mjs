// 7.9.9 속도 P3(일부): src/icon-text.js 가 서랍 줄에 다는 표식이 옛 :has() 조건과 같은지 (가짜 DOM, 브라우저 없음)
//   node tools/tests/drawer-marks.mjs <테마 루트>
//   data-bl-row 토큰: neo(.flex-container 의 요소 자식이 small(첫째)+.neo-range-slider+.neo-range-input 순) · range(.range-block 의 .range-block-title 바로 다음이 .range-block-range-and-counter)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
class El {
    constructor(tag, cls = '', children = []) { this.localName = tag; const list = cls.split(/\s+/).filter(Boolean); this.classList = { contains: c => list.includes(c) }; this.children = children; }
}
const el = (tag, cls, ...children) => new El(tag, cls, children);
const { rowTokens } = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);

await test('neo-range 줄 — small 첫째 + 슬라이더 + 입력 순서만', () => {
    assert.equal(rowTokens(el('div', 'flex-container', el('small', ''), el('input', 'neo-range-slider'), el('input', 'neo-range-input'))), 'neo');
    assert.equal(rowTokens(el('div', 'flex-container', el('small', ''), el('input', 'neo-range-slider'), el('input', 'neo-range-input'), el('small', ''))), 'neo');   // 뒤에 더 있어도 됨
    assert.equal(rowTokens(el('div', 'flex-container', el('label', ''), el('input', 'neo-range-slider'), el('input', 'neo-range-input'))), '');             // label 로 시작하면 다른 신호
    assert.equal(rowTokens(el('div', 'flex-container', el('div', ''), el('small', ''), el('input', 'neo-range-slider'), el('input', 'neo-range-input'))), '');  // small 이 첫째가 아님
    assert.equal(rowTokens(el('div', 'range-block', el('small', ''), el('input', 'neo-range-slider'), el('input', 'neo-range-input'))), '');                // .flex-container 가 아님
});
await test('range-block 제목 + 카운터 줄', () => {
    assert.equal(rowTokens(el('div', 'range-block', el('div', 'range-block-title'), el('div', 'range-block-range-and-counter'))), 'range');
    assert.equal(rowTokens(el('div', 'range-block', el('div', 'range-block-title'), el('div', 'toggle-description'), el('div', 'range-block-range-and-counter'))), '');   // 바로 다음이어야 함
    assert.equal(rowTokens(el('div', 'range-block', el('div', 'range-block-title'), el('div', 'wide100p', el('input', '')))), '');
});
await test('CSS 에 옛 두 신호가 남아 있지 않고 특이도 보정이 붙어 있음', () => {
    let neo = 0, range = 0; const left = [];
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css'))) {
        const t = fs.readFileSync(path.join(root, 'css', f), 'utf8');
        if (t.includes(':has(> small:first-child + .neo-range-slider + .neo-range-input)') || t.includes(':has(> .range-block-title + .range-block-range-and-counter)')) left.push(f);
        for (const m of t.matchAll(/\[data-bl-row~="neo"\]((?::is\([.]?bl-s, \*\))*)/g)) { neo++; assert.equal(m[1], ':is(.bl-s, *):is(.bl-s, *):is(bl-s, *)', `${f}: ${m[0]}`); }
        for (const m of t.matchAll(/\[data-bl-row~="range"\]((?::is\([.]?bl-s, \*\))*)/g)) { range++; assert.equal(m[1], ':is(.bl-s, *)', `${f}: ${m[0]}`); }
    }
    assert.deepEqual(left, []);
    assert.ok(neo >= 40 && range >= 20, `neo ${neo} · range ${range}`);
});
console.log(`\n${passed} passed`);
