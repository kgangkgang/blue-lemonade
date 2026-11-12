// 1.1.4 글꾸 마트 「테마로 담기」 받기 — 꾸러미 검사(꼴 · 크기 · 위험한 것) · 틀 원래 판 → 등록 값 · 내 글꾸에 넣기 · 그리기 (DOM 없는 부분)
//   node tools/tests/log-copy-simple-import.mjs <테마 루트>
//   꾸러미 견본은 마트가 낸 그대로(tools/tests/fixtures/geulkku-set-mart.json packs — tools/mart/geulkku-mart-copy.mjs --fixture).
//   창(mart-import-ui.js 의 소독기 같음 확인) · 시트 미리보기 · 복사는 브라우저가 필요해 출시 검사(리그)에서 봐요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { frameFromHtml, SAMPLE_TITLE } = await load('src/log-copy-simple-frame.js');
const { SIMPLE_FRAMES } = await load('src/log-copy-simple.gen.js');
const { checkFrame } = await load('src/log-copy-simple.js');
const { readMart, checkItem, findDupes, addMartItems, summary, CUSTOM_MAX, SIMPLE_HTML_MAX } = await load('src/mart-import.js');
const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const tool = await load('tools/mart/simple-frames.mjs');
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
const packOf = id => structuredClone(fixture.packs[id]);
const itemOf = id => packOf(id).items[0];

await test('등록 값 바꾸기: 내장 심플 28틀 원래 판 → 생성기(frameEntry)와 같은 등록 값', () => {
    for (const d of tool.DEFS) {
        const want = SIMPLE_FRAMES.find(x => x.id === d.id);
        const got = frameFromHtml(tool.rawFrame(d), { id: d.id, label: d.name, emoji: d.emoji });
        for (const k of ['key', 'main', 'second', 'sample', 'pages', 'hidden', 'html']) assert.deepEqual(got[k], want[k], `${d.frame} ${k}`);
        for (const k of ['rows', 'roots', 'paper']) assert.deepEqual(got[k], want[k], `${d.frame} ${k}`);
        assert.deepEqual(checkFrame(got), [], d.frame);
    }
});

await test('등록 값 바꾸기: 마트 견본 글(<em> · <strong> · <s> 든 지문 줄) · 미리보기 펼침(data-bl-peek) · 뿌리 gk-own 을 받아요', () => {
    const html = itemOf('simple-k1').html;
    assert.match(html, /data-bl-peek=""/); assert.match(html, /<p class="gk-nr"><em>/); assert.match(html, /\bgk-own\b/);
    const f = frameFromHtml(html, { id: 'simple-k1', label: '낫표' });
    assert.equal(f.key, 'k1'); assert.doesNotMatch(f.html, /data-bl-peek|<details[^>]*\sopen/);
    assert.equal(f.html.split('{{로그}}').length, 2); assert.ok(f.html.includes('{{제목}}')); assert.ok(!f.html.includes(SAMPLE_TITLE));
    assert.equal(f.rows.지문, '<p class="gk-nr">{{지문}}</p>');
    assert.match(f.html, /^<div class="gk [^"]*\bgk-own\b/);   // 기본 색 class 는 그릴 때 정해요(prepareFrame)
});

await test('등록 값 바꾸기: 로그 칸이 한 꼴로 안 늘어나는 틀은 까닭과 함께 던져요', () => {
    assert.throws(() => frameFromHtml(itemOf('simple-k1004').html, { id: 'simple-k1004' }), /줄마다 꾸밈이 다른 틀/);
    assert.throws(() => frameFromHtml('<div class="gk gk-tl gk-k9"><style>.gk-k9{}</style><p>x</p></div>', { id: 'x' }), /꼴이 아니에요|찾지 못했어요/);
    const noTitle = itemOf('simple-k1').html.replace(SAMPLE_TITLE, '다른 제목');
    assert.throws(() => frameFromHtml(noTitle, { id: 'simple-k1' }), /제목 자리/);
});

await test('꾸러미 읽기: 마트가 낸 꾸러미 → 심플 글꾸 항목(등록 값 + 조절 값) · 못 받는 틀은 건너뛴 것으로', () => {
    const mixed = { 'bl-mart': 1, items: [itemOf('simple-k1'), itemOf('simple-k1120'), itemOf('simple-k1004')] };
    const read1 = readMart(JSON.stringify(mixed));
    assert.equal(read1.error, '');
    assert.deepEqual(read1.items.map(x => x.id), ['simple-k1', 'simple-k1120']);
    assert.equal(read1.skipped.length, 1); assert.match(read1.skipped[0].reason, /아직 테마 로그 복사가 받지 못해요 — 줄마다 꾸밈이 다른 틀이에요/);
    const it = read1.items[1];
    assert.equal(it.kind, 'geulkku-simple'); assert.equal(it.name, '비급 두루마리'); assert.equal(it.frame.key, 'k1120');
    assert.equal(it.set.blGeulkku, 2); assert.equal(it.set.frame, 'k1120');
});

await test('꾸러미 검사: 꼴 · 크기 · 위험한 것 · 열쇠가 어긋나면 그 항목만 거절', () => {
    const base = itemOf('simple-k1');
    const bad = (patch, re) => { const r = checkItem({ ...base, ...patch }); assert.ok(r.reason, JSON.stringify(Object.keys(patch))); assert.match(r.reason, re); };
    bad({ id: 'Bad id!' }, /id/); bad({ id: 'a'.repeat(25) }, /id/);
    bad({ key: 'x1' }, /열쇠/); bad({ key: 'k2' }, /열쇠가 HTML 과 달라요/);
    bad({ v: 2 }, /새 꼴/);
    bad({ html: '' }, /없어요/); bad({ html: base.html + ' '.repeat(SIMPLE_HTML_MAX) }, /너무 커요/);
    bad({ html: base.html.replace('<style>', '<style>.x{}</style><style>') }, /꼴이 아니에요/);
    bad({ html: base.html.replace('</style>', '</style><script>alert(1)</script>') }, /요소/);
    bad({ html: base.html.replace('</style>', '</style><iframe src="x"></iframe>') }, /요소/);
    bad({ html: base.html.replace('<p class="gk-nr">', '<p class="gk-nr" onclick="x()">') }, /동작 속성/);
    bad({ html: base.html.replace('</style>', '.gk-k1{background:url(https://example.com/a.png)}</style>') }, /바깥 주소/);
    bad({ html: base.html.replace('</style>', '@import "x.css";</style>') }, /스타일 규칙/);
    bad({ html: base.html.replace('<a ', '<a href="javascript:x" ') }, /스크립트 주소/);
    // 소리 카드 줄(audio)은 받을 때 빼요 — 다른 자리 audio 는 등록 값 검사가 걸러요
    assert.ok(checkItem(itemOf('simple-k1120')).item);
});

await test('꾸러미 검사: 조절 값은 꼴 번호 2 · 16KB 까지만 — 아니면 틀만 받아요({ blGeulkku: 2 })', () => {
    const base = itemOf('simple-k1');
    assert.deepEqual(checkItem({ ...base, set: null }).item.set, { blGeulkku: 2 });
    assert.deepEqual(checkItem({ ...base, set: { blGeulkku: 1, style: {} } }).item.set, { blGeulkku: 2 });
    assert.deepEqual(checkItem({ ...base, set: { blGeulkku: 2, name: 'x'.repeat(20000) } }).item.set, { blGeulkku: 2 });
    const kept = checkItem(base).item.set; assert.equal(kept.style.look.type.lineHeight, 1.9);
    kept.style.look.type.lineHeight = 3; assert.equal(base.set.style.look.type.lineHeight, 1.9);   // 받은 값과 떨어진 사본
});

await test('내 글꾸에 넣기: { id, name, emoji, frame, set } · 같은 id 는 물어본 뒤 덮어쓰기 · 20개 상한 · 요약 「심플 글꾸 n개」', () => {
    const items = readMart(JSON.stringify(packOf('simple-k1120'))).items;
    const settings = { logCopy: { custom: [] } };
    const r1 = addMartItems(settings, items);
    assert.deepEqual(r1.simple, ['simple-k1120']); assert.deepEqual(r1.geulkku, ['simple-k1120']);
    const e = settings.logCopy.custom[0];
    assert.deepEqual(Object.keys(e).sort(), ['emoji', 'frame', 'html', 'id', 'name', 'set', 'slot']);
    assert.equal(e.html, ''); assert.equal(e.frame.key, 'k1120');
    assert.equal(summary(r1).head, '심플 글꾸 1개를 넣었어요');
    assert.deepEqual(findDupes(settings, items).map(x => x.id), ['simple-k1120']);
    const r2 = addMartItems(settings, items); assert.match(r2.skipped[0].reason, /이미 있어서/);
    const r3 = addMartItems(settings, items, { replace: new Set(['simple-k1120']) }); assert.deepEqual(r3.replaced, ['비급 두루마리']);
    const full = { logCopy: { custom: Array.from({ length: CUSTOM_MAX }, (_, i) => ({ id: `c${i}`, name: 'x', html: '<p>x</p>' })) } };
    assert.match(addMartItems(full, items).skipped[0].reason, /20개까지/);
    assert.match(addMartItems({ logCopy: { custom: [] } }, items, { taken: new Set(['simple-k1120']) }).skipped[0].reason, /기본 글꾸/);
});

await test('설정 정리: 심플 글꾸 칸(frame · set · emoji)을 지키고 꼴이 깨진 것은 버려요(시작 때는 꼴 · 크기만)', () => {
    const src = read('src/settings.js');
    assert.match(src, /const simple = c => isObj\(c\.frame\) && typeof c\.frame\.html === 'string' && c\.frame\.html\.length <= 60000/);
    assert.match(src, /c\.frame !== undefined \? simple\(c\)/);
    assert.match(src, /\{ frame: c\.frame, set: isObj\(c\.set\) \? c\.set : \{ blGeulkku: 2 \}, emoji: str\(c\.emoji, 8\) \}/);
});

const model = { base: { color: '#dddddd', bg: '#111111' }, messages: [
    { name: '깡통', nodes: [{ t: 'text', text: '창밖을 보았다.' }, { t: 'br' }, { t: 'el', block: false, style: { 'background-image': 'linear-gradient(#ffd, #ffd)' }, children: [{ t: 'text', text: '「비가 그쳤네.」' }] }] },
    { name: '나', nodes: [{ t: 'text', text: '「응, 나가 볼까?」' }] },
] };

await test('그리기: 받은 심플 글꾸 = 내장 심플과 같은 drawSimple + 조절 값 · 모듈을 아직 못 받았으면 틀만', () => {
    const it = readMart(JSON.stringify(packOf('simple-k1120'))).items[0];
    const mine = { id: it.id, name: it.name, frame: it.frame, set: it.set };
    const bare = renderLog(model, { simple: mine, mode: 'dark', fields: { title: '제목' } });
    const tuned = renderLog(model, { simple: mine, setMod, mode: 'dark', fields: { title: '제목' }, lemonLink: true });
    assert.match(bare, /gk-k1120/); assert.match(bare, /창밖을 보았다/); assert.match(bare, /제목/);
    assert.notEqual(bare, tuned);
    assert.match(tuned, /line-height:\s*1\.9|1\.9/);   // 담아 온 줄 간격
    assert.match(tuned, /✎/);   // 고칠 자리 주석은 조절 값을 입힌 뒤에
    const plain = renderLog(model, { simple: { ...mine, set: { blGeulkku: 2 } }, setMod, mode: 'dark', fields: { title: '제목' }, lemonLink: true });
    assert.equal(plain, renderLog(model, { simple: { ...mine, set: { blGeulkku: 2 } }, mode: 'dark', fields: { title: '제목' } }));   // 아무것도 안 고친 설정 = 틀만 그린 것과 같아요
    const noLemon = renderLog(model, { simple: { ...mine, set: { blGeulkku: 2 } }, setMod, mode: 'dark', fields: { title: '제목' }, lemonLink: false });
    assert.match(plain, /class="gk-lm/); assert.doesNotMatch(noLemon, /class="gk-lm/);
    assert.match(noLemon, /^<div class="gk [^"]*"[^>]*><style>/); assert.match(noLemon, /창밖을 보았다/);   // 레몬을 뺀 글도 글자예요(마트 dropLemon 은 { html, rules } 를 돌려줘요 — 그대로 쓰면 「[object Object]」)
});

await test('시작 비용: 시트는 조절 모듈(마트 사본)을 받은 심플 글꾸를 그릴 때만 import() 로 받아요 · 시작 그래프에 없음', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /import\('\.\/log-copy-simple-set\.js'\)/);
    assert.doesNotMatch(sheet, /^import [^\n]*log-copy-simple-set/m);
    for (const f of ['src/log-copy-presets.js', 'src/mart-import.js', 'src/settings.js', 'index.js']) assert.doesNotMatch(read(f), /^\s*(?:import|export)\b[^;\n]*(?:geulkku-mart\/|log-copy-simple-set)/m, f);
});

await test('시트 간편 줄: 받은 심플 글꾸에서만 · 조절 모듈을 받은 뒤 · 누르면 그 글꾸의 set 을 바꿔 저장', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /data-lc-easy hidden><\/div>/);
    assert.match(sheet, /on = !!mine\?\.frame && !!setMod;/);
    assert.match(sheet, /setMod\.withStyle\(live\.set, value\) : kind === 'motion' \? setMod\.withMotion\(live\.set, value\) : setMod\.withSize\(live\.set, Number\(value\)\)/);
    assert.match(sheet, /if \(next !== live\.set\) \{ live\.set = next; saveSettings\(\); draw\(\); \}/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
