// 1.0.0 극한 최적화 — 한글화 글자 사전 조각: 스크립트는 색인(열쇠 지문 → 조각)만 먼저 받고, 화면에 「아직 안 받은 조각에 있는 글」이 보일 때 그 조각만 받아
//   미뤄 둔 글을 다시 번역해요. 색인에 없는 영어는 아무것도 받지 않고, 처음 누를 때 boot · drawers · templates 조각을 미리 받아요. 글은 모두 지어낸 것.
//   node tools/tests/korean-dict-parts.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installBrowser, documentLite, clock, errors } from './leak-dom.mjs';

const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const pack = list => { let last = 0; return list.sort((a, b) => a - b).map(h => { const d = (h - last).toString(36); last = h; return d; }).join(','); };

installBrowser();
const { fnv: buildFnv, splitDictionary } = await import(pathToFileURL(path.join(root, 'tools/build-korean-dict.mjs')).href);
const script = (await import(pathToFileURL(path.join(root, 'src/scripts/plain/korean.js')).href)).default;

await test('지문: 빌드(build-korean-dict.mjs fnv)와 스크립트가 같은 지문 · 차이 36진수 묶음을 되돌리면 같은 목록', () => {
    for (const key of ['Hello there', 'Character "x" not found', '한글 섞인 Key']) assert.equal(buildFnv(key), fnv(key));
    const { index } = splitDictionary({ exact: [['Hello there', 'a'], ['Open menu', 'b']], htmlExact: [['<b>x</b> y', 'c']], PATTERNS: [{ re: '^Character (.+?) not found$', head: 'character', ko: '캐릭터 $1 없음' }, { re: '^(.+?) is loading$', ko: '$1 받는 중' }] }, {});
    assert.equal(index.keys.rest, pack([fnv('Hello there'), fnv('Open menu')]));
    assert.equal(index.html.html, pack([fnv('<b>x</b> y')]));
    assert.deepEqual(index.heads.js, [], '패턴은 전부 색인에(머리 낱말로 조각을 헛되이 받지 않게)');
    assert.equal(index.headless.length, 2);
});

function page() {
    documentLite.body.replaceChildren();
    documentLite.body.innerHTML = '<div id="panel"><span id="t1">Hello there</span><button id="b1" title="Open menu">Go</button><span id="t2">Totally unknown words</span></div>';
    return documentLite.getElementById('panel');
}
function startScript(api) {
    const win = { parent: globalThis, addEventListener() {}, removeEventListener() {} };
    script({ koreanDictionary: api }, win);
    return () => globalThis.__sillyTavernKoreanUI_v1?.cleanup?.();
}
const PARTS = {
    boot: { exact: [['Hello there', '안녕하세요']], htmlExact: [], PATTERNS: [] },
    js: { exact: [['Open menu', '메뉴 열기']], htmlExact: [], PATTERNS: [{ re: '^Character (.+?) not found$', head: 'character', ko: '캐릭터 $1 없음' }] },
    drawers: { exact: [['Drawer only', '서랍만']], htmlExact: [], PATTERNS: [] },
    templates: { exact: [], htmlExact: [], PATTERNS: [] },
    html: { exact: [], htmlExact: [['<code>Bold</code> text', '<code>굵은</code> 글']], PATTERNS: [] },
    rest: { exact: [['Rest only', '나머지만']], htmlExact: [], PATTERNS: [] },
};
const INDEX = {
    keys: { boot: pack([fnv('Hello there')]), js: pack([fnv('Open menu')]), drawers: pack([fnv('Drawer only')]), rest: pack([fnv('Rest only')]) },
    html: { html: pack([fnv('<code>Bold</code> text')]) }, heads: { js: ['character'] }, headless: [{ re: '^(.+?) is loading$', ko: '$1 받는 중' }],
};

await test('색인만 먼저 → 보이는 글이 든 조각(boot · js)만 받고 그 글을 번역 · 색인에 없는 영어는 아무것도 받지 않아요', async () => {
    const panel = page(); const asked = [];
    const api = () => Promise.resolve({ index: INDEX, load: name => { asked.push(name); return Promise.resolve(PARTS[name]); } });
    const stop = startScript(api);
    await clock.advance(100);   // 쉬는 틈(가짜 requestIdleCallback 30ms) → 색인 → 첫 훑기
    assert.deepEqual([...new Set(asked)].sort(), ['boot', 'js'], `받은 조각 ${asked}`);
    await clock.advance(50);
    assert.equal(documentLite.getElementById('t1').textContent, '안녕하세요');
    assert.equal(documentLite.getElementById('b1').getAttribute('title'), '메뉴 열기');
    assert.equal(documentLite.getElementById('t2').textContent, 'Totally unknown words', '색인에 없는 글은 그대로');
    assert.ok(!asked.includes('rest') && !asked.includes('drawers'), '안 보이는 조각은 안 받아요');
    // 머리 없는 패턴은 색인에 실려 바로 · 머리 있는 패턴은 js 조각(이미 받음)
    const extra = documentLite.createElement('span'); extra.textContent = 'Model is loading'; panel.append(extra);
    const extra2 = documentLite.createElement('span'); extra2.textContent = 'Character "Bob" not found'; panel.append(extra2);
    await clock.advance(100);
    assert.equal(extra.textContent, 'Model 받는 중');
    assert.equal(extra2.textContent, '캐릭터 "Bob" 없음');
    // 나중에 나타난 rest 조각의 글 → 그때 받아 번역 · HTML 열쇠도
    const late = documentLite.createElement('span'); late.textContent = 'Rest only'; panel.append(late);
    const htmlEl = documentLite.createElement('span'); htmlEl.innerHTML = '<code>Bold</code> text'; panel.append(htmlEl);   // HTML 열쇠는 <code> 가 낀 문장만 봐요(v1.4.3)
    await clock.advance(100);
    assert.ok(asked.includes('rest') && asked.includes('html'), `rest · html 조각 ${asked}`);
    assert.equal(late.textContent, '나머지만');
    assert.equal(htmlEl.innerHTML, '<code>굵은</code> 글');
    assert.equal(asked.filter(n => n === 'rest').length, 1, '조각은 한 번만');
    stop();
    assert.equal(documentLite.getElementById('t1').textContent, 'Hello there', '끄면 원문으로');
    assert.equal(documentLite.getElementById('b1').getAttribute('title'), 'Open menu');
    assert.deepEqual(errors, []);
});

await test('처음 누를 때 boot · drawers · templates 조각을 미리 받아요(서랍을 여는 순간 영어가 비치지 않게) · 통째 사전(옛 꼴)도 그대로', async () => {
    page(); const asked = [];
    const api = () => Promise.resolve({ index: INDEX, load: name => { asked.push(name); return Promise.resolve(PARTS[name]); } });
    const stop = startScript(api);
    await clock.advance(100);
    const before = [...asked];
    const listeners = (documentLite._ls || []).filter(l => l.type === 'pointerdown' && l.capture);   // 누름은 document 잡기 단계 리스너
    assert.ok(listeners.length >= 1, '처음 누를 때 리스너');
    for (const { fn } of [...listeners]) fn.call(documentLite, { type: 'pointerdown', target: documentLite.body });
    await clock.advance(50);
    for (const name of ['boot', 'drawers', 'templates']) assert.ok(asked.includes(name), `${name} 미리`);
    assert.ok(!asked.includes('rest'), 'rest 는 미리 받지 않아요');
    assert.ok(asked.length >= before.length);
    stop();
    // 옛 꼴: 통째 사전
    page();
    const stop2 = startScript(() => Promise.resolve({ exact: [['Hello there', '안녕하세요']], htmlExact: [], PATTERNS: [] }));
    await clock.advance(100);
    assert.equal(documentLite.getElementById('t1').textContent, '안녕하세요');
    stop2();
    assert.deepEqual(errors, []);
});

await test('닫힌 서랍의 글은 쉴 때 조각을 받지 않고 적어만 두고, 서랍이 열리는 순간 받아 번역해요', async () => {
    documentLite.body.replaceChildren();
    documentLite.body.innerHTML = '<div id="top-settings-holder"><div id="d1" class="drawer-content"><span id="in">Drawer only</span><span id="r">Rest only</span></div></div><div id="panel"><span id="t1">Hello there</span></div>';
    const asked = [];
    const api = () => Promise.resolve({ index: INDEX, load: name => { asked.push(name); return Promise.resolve(PARTS[name]); } });
    const stop = startScript(api);
    await clock.advance(3000);   // 쉬는 틈 · 미룬 서랍 훑기까지
    assert.equal(documentLite.getElementById('t1').textContent, '안녕하세요');
    assert.ok(asked.includes('boot') && !asked.includes('drawers') && !asked.includes('rest'), `쉴 때 받은 조각 ${asked}`);
    assert.equal(documentLite.getElementById('in').textContent, 'Drawer only', '닫힌 서랍은 아직');
    const late = documentLite.createElement('span'); late.textContent = 'Rest only'; documentLite.getElementById('d1').append(late);   // 닫힌 서랍에 나중에 들어온 글(확장 설정 칸)
    await clock.advance(200);
    assert.ok(!asked.includes('rest'), `닫힌 서랍에 들어온 글도 조각을 받지 않아요 ${asked}`);
    documentLite.getElementById('d1').classList.add('openDrawer');   // 열림(class 바뀜 → 감시자)
    await clock.advance(200);
    assert.ok(asked.includes('drawers') && asked.includes('rest'), `열리면 받아요 ${asked}`);
    assert.equal(documentLite.getElementById('in').textContent, '서랍만');
    assert.equal(documentLite.getElementById('r').textContent, '나머지만');
    stop();
    assert.deepEqual(errors, []);
});

console.log(`korean-dict-parts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
