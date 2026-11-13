// 7.3.0 폰 시작 가볍게 — 한글화(korean 1.4.8) · 과일의 마음 한글화(fruit-heart 1.0.7)
//   p1 사전을 빌드 때 정리(내장 모듈 · 사전 = 원본에서 만든 것, 원본 정리 결과와 같음 — 9.0.7 사전은 src/ko-ui-text.gen.js 로 떼어 처음 필요할 때 받아요) · p3 닫힌 서랍 미루기 + 열 때 밀린 번역 바로 · p5 과일의 마음 한 번에 고르기
//   node tools/tests/startup-730.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scriptCode } from './script-code.mjs';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const bundled = name => scriptCode(root, name.replace(/\.js$/, ''));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const source = read('tools/scripts-src/korean.js');
const korean = await bundled('korean.js');
const { buildKorean } = await import(pathToFileURL(path.join(root, 'tools/build-korean-dict.mjs')).href);

await test('p1: the module and its dictionary are exactly what the build makes from the source; the dictionary equals the source run at start minus the prune list', async () => {
    const { buildKorean, readPrune, dictionaryModules, readParts, splitDictionary, INDEX_FILE, PART_NAMES, partFile } = await import(pathToFileURL(path.join(root, 'tools/build-korean-dict.mjs')).href);
    const dropped = readPrune();
    const { code, dictionary, stats } = buildKorean(source, dropped);
    assert.equal(korean, code, 'node tools/build-korean-dict.mjs');
    assert.deepEqual(stats, { exact: 5327, htmlExact: 255, patterns: 287, dropped: 604 });   // 10-31: ko-kr.json · FIX 에만 기대던 i18n 열쇠 706개를 되돌림(브라우저 언어 ko 에서 영어로 남던 것)
    // 1.1.3 감사 G11: 실리태번 1.16 ~ 1.19 에 없는 옛 문구 12개를 원본에서 걷고 다듬기 목록을 다시 만듦 → 열쇠 5330 → 5327 · 지문 613 → 604 (사전이 작아진 것)
    // 1.0.0 극한 최적화: 한 장(ko-ui-text.gen.js) 대신 색인 + 조각 여섯 — 파일마다 빌드가 만든 것과 같고, 조각을 합치면 사전 전체
    assert.ok(!fs.existsSync(path.join(root, 'src/ko-ui-text.gen.js')), '옛 한 장짜리 사전은 없어요');
    const modules = dictionaryModules(dictionary, stats, readParts());
    for (const [rel, text] of Object.entries(modules)) assert.equal(read(rel), text, rel);
    assert.deepEqual(Object.keys(modules).sort(), [INDEX_FILE, ...PART_NAMES.map(partFile)].sort());
    assert.ok(!korean.includes('  const TRANSLATIONS = {') && !korean.includes('JSON.parse('), 'the module carries no dictionary');
    assert.ok(korean.includes('  let exact = new Map();') && korean.includes('  let htmlExact = new Map();') && korean.includes('  let PATTERNS = [];'), 'starts empty');
    assert.ok(korean.includes('function useDictionary(data) {') && korean.includes('startWhenNeeded(loadDictionary)'), 'loads on first need');
    // 원본의 사전 조각을 직접 돌려 견준다 (빌드 도구를 믿지 않고 한 번 더) — 다듬기 지문은 같은 규칙으로 따로 계산
    const hash = key => crypto.createHash('sha1').update(String(key).normalize('NFKC').replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const from = lines.findIndex(l => l.startsWith('  const TRANSLATIONS = {')), to = lines.findIndex(l => l.startsWith('  const HTML_INLINE = new Set('));
    const piece = lines.slice(from, to).map(l => l.startsWith('  const TRANSLATIONS = {') ? `  const TRANSLATIONS = Object.fromEntries(Object.entries(${l.slice(23, -1)}).filter(([k]) => !__drop.has(__hash(k))));`
        : l.startsWith('  let PATTERNS = [') ? `  let PATTERNS = ${l.slice(17, -1)}.filter(p => !__drop.has(__hash(p.re)));` : l).join('\n');
    const want = new Function('__drop', '__hash', piece + '\nreturn JSON.stringify({ exact: [...exact], htmlExact: [...htmlExact], PATTERNS });')(dropped, hash);
    const merged = { exact: [], htmlExact: [], PATTERNS: [] };
    const index = JSON.parse(read(INDEX_FILE));   // 1.3.x: 색인 · 조각은 JSON 파일
    for (const name of PART_NAMES) { const part = JSON.parse(read(partFile(name))); merged.exact.push(...part.exact); merged.htmlExact.push(...part.htmlExact); merged.PATTERNS.push(...part.PATTERNS); }
    merged.PATTERNS.push(...index.headless);
    const wantObj = JSON.parse(want);
    const sortPairs = list => [...list].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    assert.deepEqual(sortPairs(merged.exact), sortPairs(wantObj.exact), 'exact 합치면 같아요');
    assert.deepEqual(sortPairs(merged.htmlExact), sortPairs(wantObj.htmlExact), 'HTML 열쇠 합치면 같아요');
    const sortPat = list => [...list].sort((a, b) => (a.re < b.re ? -1 : a.re > b.re ? 1 : 0));
    assert.deepEqual(sortPat(merged.PATTERNS), sortPat(wantObj.PATTERNS), '패턴 합치면 같아요');
    assert.deepEqual(splitDictionary(dictionary, readParts()).index, index, '색인 = 빌드');
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
    assert.ok(source.includes('handleRecords(scopeWatch.takeRecords());'), 'records the scope observer has not delivered yet');
    assert.ok(source.includes("for (const drawer of root.querySelectorAll?.('.drawer-content') || []) openWatch.observe(drawer, DRAWER_WATCH);"));
    assert.ok(source.includes('    watchDrawers(element);'), 'every scope watches its drawers');
    assert.ok(source.includes('if (deferred.size) for (const node of record.removedNodes) if (node.nodeType === 1 && node.isConnected) processNode(node);'), 'content moved out of a deferred drawer');
    assert.ok(source.includes('// SillyTavern Korean UI (leftover English), v1.4.8') && source.includes("host[INSTANCE_KEY] = { version: '1.4.8', cleanup };"));
    assert.match(read('src/scripts/catalog.js'), /\{id:'korean',name:'실리태번 한글화',version:'1\.4\.8'/);
});

await test('p5: 과일 창은 한 번에 훑고 유휴 발견은 좁은 범위로 찾아요', async () => {
    const fh = await bundled('fruit-heart.js');
    assert.ok(fh.includes("const FLUSH_ALL = [rootsSelector, helperRootsSelector, POPUPS, TOASTS, watchSelector].join(',');"));
    assert.ok(fh.includes('function rootAppeared() {'));
    assert.ok(fh.includes('const found = [...doc.querySelectorAll(FLUSH_ALL)];'));
    assert.ok(fh.includes('if (rootAppeared()) return schedule();'));
    assert.ok(!fh.includes('doc.querySelectorAll(DISCOVER_ALL)'));
    assert.ok(!fh.includes('[...doc.querySelectorAll(rootsSelector)]') && !fh.includes("doc.querySelectorAll('#toast-container .toast-message')"), 'old per-selector walks are gone');
    new Function('BlueLemonade', 'window', fh);
    assert.match(read('src/scripts/catalog.js'), /\{id:'fruit-heart',family:'fruit-family',name:'과일의 마음 한글화',version:'1\.(?:0\.[89]|1\.[0-3])'/); // 1.0.8 에서 고친 뒤 사전만 바뀐 1.0.9(10-27 창 이름 한글 보강) · 긴 원문을 뺀 1.1.0 · 청과 2.1X 새 항목을 더한 1.1.1 · 긴 글 지문 사전을 더한 1.1.2 · 알림 · 확인 창 문구를 클릭 없이 바꾸는 1.1.3 도 돼요
});

await test('one copy: the old bundled copies are gone and every module takes (BlueLemonade, window)', async () => {
    assert.ok(!fs.existsSync(path.join(root, 'src/scripts/bundled')));
    for (const name of ['korean', 'fruit-heart']) assert.ok(read(`src/scripts/plain/${name}.js`).includes('export default function blueLemonadeScript(BlueLemonade, window) {'), name);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
