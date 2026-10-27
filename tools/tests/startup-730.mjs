// 7.3.0 폰 시작 가볍게 — 한글화(korean 1.4.8) · 과일의 마음 한글화(fruit-heart 1.0.7)
//   p1 사전을 빌드 때 정리(내장본 = 원본에서 만든 것, 원본 정리 결과와 같음) · p3 닫힌 서랍 미루기 + 열 때 밀린 번역 바로 · p5 과일의 마음 한 번에 고르기
//   node tools/tests/startup-730.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const bundled = async name => String((await import(pathToFileURL(path.join(root, 'src/scripts/bundled', name)).href)).default);
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const source = read('tools/scripts-src/korean.js');
const korean = await bundled('korean.js');
const { buildKorean } = await import(pathToFileURL(path.join(root, 'tools/build-korean-dict.mjs')).href);

await test('p1: the bundled script is exactly what the build makes from the source, and its precomputed dictionary equals the source run at start', () => {
    const { code, stats } = buildKorean(source);
    assert.equal(korean, code, 'node tools/build-korean-dict.mjs');
    assert.deepEqual(stats, { exact: 5930, htmlExact: 255, patterns: 299 });
    assert.ok(!korean.includes('  const TRANSLATIONS = {'), 'no start-time dictionary build');
    assert.match(korean, /  const exact = new Map\(JSON\.parse\("/);
    assert.match(korean, /  const htmlExact = new Map\(JSON\.parse\("/);
    // 원본 · 내장본의 사전 조각을 직접 돌려 견준다 (빌드 도구를 믿지 않고 한 번 더)
    const piece = (text, a, b) => { const lines = text.replace(/\r\n/g, '\n').split('\n'); const from = lines.findIndex(l => a.test(l)); const to = lines.findIndex(l => b.test(l)); return lines.slice(from, to).join('\n'); };
    const ret = '\nreturn JSON.stringify({ exact: [...exact], htmlExact: [...htmlExact], PATTERNS });';
    const want = new Function(piece(source, /^  const TRANSLATIONS = \{/, /^  const HTML_INLINE = new Set\(/) + ret)();
    const got = new Function(piece(korean, /^  \/\/ 사전은 tools\/build-korean-dict\.mjs/, /^  const HTML_INLINE = new Set\(/) + ret)();
    assert.equal(got, want);
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/build-korean-dict.mjs --check'), 'CI checks it');
});

await test('p3: closed drawers are skipped at start and translated when they open (before paint) or at idle in ~10ms slices', () => {
    for (const text of [source, korean]) {
        assert.ok(text.includes("const DEFER = '.drawer-content:not(.openDrawer)';"));
        assert.ok(text.includes('if (deferOn && child.nodeType === 1 && child.matches(DEFER)) { addDeferred(child); return host.NodeFilter.FILTER_REJECT; }'));
        assert.ok(text.includes('deferOn = true;') && text.includes('if (deferred.size) idle(drainDeferred);'));
        assert.ok(/host\.performance\.now\(\) - started < 10\)/.test(text), '10ms slices');
        assert.ok(text.includes('openWatch.disconnect(); deferred.clear(); kids.clear();'), 'cleanup forgets deferred drawers');
    }
});

await test('open flush: any top drawer that opens flushes its pending translations at once (no first-frame English right after start)', () => {
    assert.ok(source.includes('if (deferred.delete(drawer)) { kids.delete(drawer); processNode(drawer); continue; }'));
    assert.ok(source.includes('for (const node of dirty) if (drawer.contains(node)) { dirty.delete(node); if (node.isConnected) processNode(node); }'));
    assert.ok(source.includes('for (const observer of scopes.values()) handleRecords(observer.takeRecords());'), 'records the scope observer has not delivered yet');
    assert.ok(source.includes("for (const drawer of root.querySelectorAll?.('.drawer-content') || []) openWatch.observe(drawer, DRAWER_WATCH);"));
    assert.ok(source.includes('    watchDrawers(element);'), 'every scope watches its drawers');
    assert.ok(source.includes('if (deferred.size) for (const node of record.removedNodes) if (node.nodeType === 1 && node.isConnected) processNode(node);'), 'content moved out of a deferred drawer');
    assert.ok(source.includes('// SillyTavern Korean UI (leftover English), v1.4.8') && source.includes("host[INSTANCE_KEY] = { version: '1.4.8', cleanup };"));
    assert.match(read('src/scripts/catalog.js'), /\{id:'korean',name:'실리태번 한글화',version:'1\.4\.8'/);
});

await test('p5: fruit-heart flush and discover pick everything with one querySelectorAll', async () => {
    const fh = await bundled('fruit-heart.js');
    assert.ok(fh.includes("const FLUSH_ALL = [rootsSelector, helperRootsSelector, POPUPS, TOASTS, watchSelector].join(',');"));
    assert.ok(fh.includes("const DISCOVER_ALL = [rootsSelector, helperRootsSelector, watchSelector, POPUPS].join(',');"));
    assert.ok(fh.includes('const found = [...doc.querySelectorAll(FLUSH_ALL)];'));
    assert.ok(fh.includes('for (const el of doc.querySelectorAll(DISCOVER_ALL)) if (el.matches(POPUPS) || !observed.has(el)) return schedule();'));
    assert.ok(!fh.includes('[...doc.querySelectorAll(rootsSelector)]') && !fh.includes("doc.querySelectorAll('#toast-container .toast-message')"), 'old per-selector walks are gone');
    new Function('BlueLemonade', fh);
    assert.match(read('src/scripts/catalog.js'), /\{id:'fruit-heart',family:'fruit-family',name:'과일의 마음 한글화',version:'1\.0\.[89]'/); // 1.0.8 에서 고친 뒤 사전만 바뀐 1.0.9(10-27 창 이름 한글 보강)도 돼요
});

await test('plain copies follow the bundled ones', async () => {
    for (const name of ['korean.js', 'fruit-heart.js']) {
        const plain = read(`src/scripts/plain/${name}`);
        const code = await bundled(name);
        assert.ok(plain.includes(code.replace(/\r\n/g, '\n')), name);
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
