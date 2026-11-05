// 1.0.1 자동화 입구(src/live-entry.js · window.Salty.module) 지킴 — 묶음 판(dist/)에서 검사 도구가 src/ 를 직접 import 하면 두 번째 인스턴스라,
//   여는 함수(export function open…)가 있는 모듈은 전부 입구 표에 있어야 하고, 표의 파일은 전부 있어야 해요(묶음 도구가 못 묶으면 판 전체가 멈춰요).
//   node tools/tests/live-entry.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const entry = read('src/live-entry.js');
const names = [...entry.matchAll(/^\s*'([\w./-]+)':\s*\(\)\s*=>\s*(?:addonRunning\('[\w-]+'\)\s*\?\s*)?import\('\.\/([\w./-]+\.js)'\)/gm)].map(m => ({ name: m[1], file: m[2] }));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const OPEN_RE = /export\s+(?:async\s+)?(?:function\s+|const\s+)(open[A-Z]\w*)\b/g;
const SKIP_DIRS = /^(vendor|scripts|scene-music|preview-art)\//;

test('입구 표가 비어 있지 않고 이름 = 파일 경로(.js 없이)예요', () => {
    assert.ok(names.length >= 40, `표 ${names.length}줄`);
    for (const { name, file } of names) assert.equal(name + '.js', file, `${name} ↔ ${file}`);
    assert.equal(new Set(names.map(n => n.name)).size, names.length, '같은 이름 둘');
});
test('표의 파일이 전부 있어요(없으면 묶음이 멈춰요)', () => {
    const missing = names.filter(n => !fs.existsSync(path.join(root, 'src', n.file)));
    assert.deepEqual(missing.map(n => n.file), []);
});
test('여는 함수(open…)가 있는 src 모듈은 전부 표에 있어요', () => {
    const have = new Set(names.map(n => n.name));
    const missing = [];
    for (const f of walk(path.join(root, 'src'))) {
        if (!f.endsWith('.js')) continue;
        const rel = path.relative(path.join(root, 'src'), f).split(path.sep).join('/');
        if (SKIP_DIRS.test(rel) || rel === 'live-entry.js') continue;
        const s = fs.readFileSync(f, 'utf8');
        if (!OPEN_RE.test(s)) { OPEN_RE.lastIndex = 0; continue; }
        OPEN_RE.lastIndex = 0;
        if (!have.has(rel.replace(/\.js$/, ''))) missing.push(rel);
    }
    assert.deepEqual(missing, [], '표에 더해 주세요(src/live-entry.js)');
});
test('index.js 가 window.Salty 에 module · modules 를 올려요', () => {
    const idx = read('index.js');
    assert.match(idx, /const liveEntry = \(\) => import\('\.\/src\/live-entry\.js'\);/, '표는 처음 물을 때 받아요(시작 그래프 밖 — boot-graph.mjs)');
    assert.doesNotMatch(idx, /^import [^;]*live-entry/m, '정적 import 는 시작 그래프에 들어가요');
    assert.match(idx, /window\.Salty = \{[^\n]*\bmodule: liveModule\b[^\n]*\bmodules: liveModuleNames\b/);
});
test('입구 함수는 src/ · .js 를 벗겨 받고, 없는 이름은 거절해요', () => {
    assert.match(entry, /replace\(\/\^src\\\/\/, ''\)\.replace\(\/\\\.js\$\/, ''\)/);
    assert.match(entry, /살아 있는 입구에 없는 모듈/);
});
test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/live-entry\.mjs \./));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
