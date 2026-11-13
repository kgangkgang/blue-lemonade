// 1.0.0 극한 최적화: 브라우저가 받는 JS 묶음(dist/)이 src 와 맞고, 묶음 밖으로 원본을 다시 받는 길이 없는지 봐요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { bundleFresh } = await import(pathToFileURL(path.join(ROOT, 'tools/build-bundle.mjs')));
const test = (name, fn) => { fn(); console.log(`ok - ${name}`); };
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const chunks = walk(path.join(ROOT, 'dist')).filter(f => f.endsWith('.js'));
const all = chunks.map(f => [path.relative(ROOT, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8')]);

test('manifest 는 dist/index.js 를 싣고 dist 가 src 와 맞아요', () => {
    assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).js, 'dist/index.js');
    const fresh = bundleFresh(ROOT);
    assert.ok(fresh.ok, fresh.why);
});
test('묶음은 원본 src 모듈을 받지 않아요(워커 · 무결성 표 · vendor 만)', () => {
    const allowed = /^\.\.\/src\/(build-info\.js|vendor\/|addons\/mermaid\/vendor\/)/;
    const bad = [];
    for (const [file, text] of all) for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.\.\/src\/[^"']+\.js)["']/g)) if (!allowed.test(m[1])) bad.push(`${file}: ${m[1]}`);
    assert.deepEqual(bad, []);
});
test('주소로 받는 모듈 · 워커 · 내장 스크립트가 묶음 조각을 가리켜요', () => {
    const text = all.map(([, t]) => t).join('\n');
    assert.ok(!/new globalThis\.URL\("\.\.\/src\/weather\.js",import\.meta\.url\)\.href\)\s*,\s*\[/.test(text));
    assert.ok(!text.includes('import.meta.ROLLUP'));
    for (const name of fs.readdirSync(path.join(ROOT, 'src/scripts/plain'))) if (name.endsWith('.js')) assert.ok(fs.existsSync(path.join(ROOT, 'dist/plain', name)), name);
    for (const name of fs.readdirSync(path.join(ROOT, 'src/scripts/titles'))) if (name.endsWith('.js')) assert.ok(fs.existsSync(path.join(ROOT, 'dist/titles', name)), name);
});
test('import.meta.url 은 원래 모듈 자리 주소로 바뀌어 CSS · 그림 · 소리 주소가 그대로예요', () => {
    const entry = fs.readFileSync(path.join(ROOT, 'dist/index.js'), 'utf8');
    assert.ok(/"\.\.\/src\/[\w/-]+\.js",import\.meta\.url/.test(all.map(([, t]) => t).join('\n')));
    // 1.1.5 시작 묶음 다이어트: 시작 그래프 전체가 dist/index.js 한 조각이에요(전에는 입구 + 정적 조각 12개 · 합계 306KB → 지금 한 조각 약 255KB).
    //   입구 크기가 곧 시작 묶음 크기라, 바이트 상한은 아래 시험과 perf-budget-static.mjs(307,200B)가 지켜요. 여기서는 글자 수가 그 상한을 넘지 않는지만 봐요
    assert.ok(entry.length < 300 * 1024, `dist/index.js ${entry.length}`);
});
test('시작 때 바로 받는 정적 묶음(dist/index.js 와 그 정적 import)이 상한 안이에요', () => {
    const seen = new Set(); let bytes = 0;
    const walkImports = file => {
        if (seen.has(file)) return; seen.add(file);
        const text = fs.readFileSync(path.join(ROOT, 'dist', file), 'utf8'); bytes += Buffer.byteLength(text);
        for (const m of text.matchAll(/(?:^|;|\})\s*import(?:[^"'()]*?from\s*)?["'](\.\/[^"']+)["']/g)) walkImports(m[1].slice(2));
    };
    walkImports('index.js');
    assert.ok(bytes < 330 * 1024, `정적 묶음 ${seen.size}조각 ${Math.round(bytes / 1024)}KB`);
    console.log(`  정적 묶음 ${seen.size}조각 · ${Math.round(bytes / 1024)}KB`);
});
test('글자로 이어 받는 실리태번 모듈 주소가 dist 깊이예요(src/addons 깊이가 남지 않아요)', () => {
    for (const [file, text] of all) assert.ok(!/["'`]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/(?:\.\.\/)?["'`]/.test(text), `${file}: 깊은 상대 주소가 남았어요`);
});
