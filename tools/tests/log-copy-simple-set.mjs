// 1.1.4 받은 심플 글꾸의 조절 값(blGeulkku 2) — 테마 applySet 이 글꾸 마트와 같은 결과를 내는지(마트 기대값 대조) · 기본 색(gk-own) 규칙 · 이 틀 값 열쇠
//   node tools/tests/log-copy-simple-set.mjs <테마 루트>
//   기대값: tools/tests/fixtures/geulkku-set-mart.json(마트 함수로 뜬 값 — tools/mart/geulkku-mart-copy.mjs --from <마트> --fixture) · 사본: src/geulkku-mart/(같은 도구 · --check 로 마트와 같은지)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { applySet, valsIn, prepareFrame, readFor, easyOf, withStyle, withMotion, withSize, LOOKS, EASY_MOTION, EASY_SIZE } = await load('src/log-copy-simple-set.js');
const { FIXTURE_SETS, FIXTURE_FRAMES } = await load('tools/mart/geulkku-mart-copy.mjs');
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

await test(`마트와 같은 결과: 틀 ${FIXTURE_FRAMES.length} × 낮밤 × 설정 ${FIXTURE_SETS.length}(모양 · 글 모양 · 움직임 · 질감 · 이 틀 값 · 다 건 것)`, () => {
    let n = 0;
    for (const [k, html] of Object.entries(fixture.inputs)) {
        const [id, mode] = k.split('|');
        for (const [name, set] of FIXTURE_SETS) { assert.equal(sha(applySet(html, set, { mode, key: id.replace(/^simple-/, '') })), fixture.expect[`${k}|${name}`], `${k}|${name}`); n++; }
    }
    assert.equal(n, Object.keys(fixture.expect).length);
});

await test('아무것도 안 고친 설정 · 못 읽는 설정이면 받은 글 그대로', () => {
    for (const html of Object.values(fixture.inputs)) {
        assert.equal(applySet(html, { blGeulkku: 2 }), html);
        assert.equal(applySet(html, { blGeulkku: 9 }), html);
        assert.equal(applySet(html, null), html);
    }
    assert.equal(applySet('', { blGeulkku: 2, style: { shape: { radius: 4 } } }), '');
});

await test('이 틀 값(frames[key])은 그 틀 열쇠일 때만 걸려요', () => {
    const set = { blGeulkku: 2, frame: 'k1079', frames: { k1079: { lines: 1 } } };
    assert.ok(readFor(set, 'k1079').tune); assert.equal(readFor(set, 'k1').tune, null);
});

await test('이 틀 값의 글자 칸: 그린 글에 없는 칸(로그 자리가 된 칸)은 빼고 넘겨요 — 없는 칸 하나 때문에 다른 칸 값까지 안 걸리지 않게', () => {
    const html = fixture.inputs['simple-q10|light'];   // 글자 칸 t1 ~ t11 이 있는 틀
    const tune = { vals: { t1: 'Lv.1', t97: '없는 칸', lines: 2 }, own: true };
    assert.deepEqual(valsIn(html, tune), { vals: { t1: 'Lv.1', lines: 2 }, own: true });   // 글자 칸이 아닌 값(lines)은 그대로
    const all = { vals: { t1: 'Lv.1', t11: 'MAX' } };
    assert.equal(valsIn(html, all), all);   // 다 있는 칸이면 받은 값 그대로(마트와 같은 결과)
    assert.equal(valsIn(html, null), null); assert.deepEqual(valsIn(html, { own: false }), { own: false });
    assert.deepEqual(valsIn(fixture.inputs['simple-k1|light'], { vals: { t3: '머리기사' } }), { vals: {} });   // 글자 칸이 하나도 없는 글
});

await test('기본 색 틀(gk-own): 이 틀 값 기본 색이면 그대로 · 캐릭터 색이면 뗌 · 안 정했으면 캐릭터 색을 알고 「소품도 캐릭터 색」일 때 뗌', () => {
    const frame = { key: 'k1', html: '<div class="gk gk-tl gk-k1 gk-cv-bl gk-own"><style>.gk-k1{}</style>{{로그}}</div>' };
    const off = f => !/\bgk-own\b/.test(f.html.split('>')[0]);
    assert.equal(off(prepareFrame(frame, { blGeulkku: 2 }, { castKnown: true })), true);
    assert.equal(off(prepareFrame(frame, { blGeulkku: 2 }, { castKnown: false })), false);
    assert.equal(off(prepareFrame(frame, { blGeulkku: 2, style: { cast: { cover: false } } }, { castKnown: true })), false);
    assert.equal(off(prepareFrame(frame, { blGeulkku: 2, frame: 'k1', frames: { k1: { prop: { tone: 'own' } } } }, { castKnown: true })), false);
    assert.equal(off(prepareFrame(frame, { blGeulkku: 2, frame: 'k1', frames: { k1: { prop: { tone: 'cast' } } } }, { castKnown: false })), true);
    assert.equal(prepareFrame(frame, { blGeulkku: 2 }, { castKnown: true }).html.split('>')[0], '<div class="gk gk-tl gk-k1 gk-cv-bl"');
    const mid = { key: 'k1', html: '<div class="gk gk-own gk-tl gk-k1"><style>.a{content:" "}</style></div>' };
    assert.equal(prepareFrame(mid, { blGeulkku: 2 }, { castKnown: true }).html, '<div class="gk gk-tl gk-k1"><style>.a{content:" "}</style></div>');
    const none = { key: 'k2', html: '<div class="gk gk-tl gk-k2"><style></style></div>' };
    assert.equal(prepareFrame(none, { blGeulkku: 2 }, { castKnown: true }), none);
});

await test('마트 사본: 생성물 머리 · 「?v=」 꼬리 없음 · 주석 없음(공개 저장소에 마트 작업 주석을 안 실어요)', () => {
    const dir = path.join(root, 'src', 'geulkku-mart');
    const files = fs.readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith('.js'));
    assert.ok(files.length >= 10);
    for (const f of files) {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const [head, ...rest] = text.split('\n');
        assert.match(head, /^\/\/ 생성물 — 글꾸 마트 mart\/\S+ 사본\(마트 [0-9a-f]{8} · 주석만 뺐어요\)/, f);
        assert.doesNotMatch(text, /from\s+['"][^'"]*\?v=/, f);
        assert.doesNotMatch(rest.join('\n'), /^\s*\/\/|\/\*(?!\s*[#@]__PURE__)/m, f);
        assert.doesNotMatch(text, /C:[\\/]|outputs\/|지시-1/, f);
    }
});

await test('간편: 추천 스타일 여섯(마트와 같은 값) · 입힌 스타일이 골라져 보임 · 화자 · 이 틀 값 · 레몬 빼기는 그대로', () => {
    assert.deepEqual(LOOKS.map(x => x.id), ['plain', 'clear', 'calm', 'big', 'book', 'light']);
    const base = { blGeulkku: 2, style: { cast: { main: { name: '깡통', color: '#3aa7ff' } }, look: { type: { sizeStep: -1 } }, show: { lemon: false } }, frame: 'k1', frames: { k1: { lines: 1 } } };
    for (const x of LOOKS) {
        const next = withStyle(base, x.id), e = easyOf(next);
        assert.equal(e.style, x.id, x.id);
        assert.equal(next.style.cast.main.color, '#3aa7ff'); assert.equal(next.frames.k1.lines, 1); assert.equal(next.style.show.lemon, false);
        assert.equal(e.size, x.id === 'big' ? 2 : -1, x.id);   // 글 크기는 「큼직하게」만 정해요
    }
    assert.equal(easyOf({ blGeulkku: 2 }).style, 'plain');
    assert.equal(easyOf({ blGeulkku: 2, style: { look: { type: { weight: 500 } } } }).style, null);   // 직접 조절
    assert.equal(withStyle(base, 'nope'), base);
});

await test('간편: 움직임(글 · 소품 같이 · 빠르기 그대로) · 따로면 표시 · 글 크기(고정 px 는 지움)', () => {
    const base = { blGeulkku: 2, style: { motion: { text: 's', prop: 'l', speed: 'l' }, look: { type: { size: 18 } } } };
    const e0 = easyOf(base); assert.equal(e0.motion, null); assert.deepEqual(e0.apart, { text: 's', prop: 'l' }); assert.equal(e0.fixed, 18);
    const m = withMotion(base, '0'); assert.deepEqual([easyOf(m).motion, m.style.motion.speed], ['0', 'l']);
    assert.equal(withMotion(base, 'x'), base);
    for (const [v] of EASY_MOTION) assert.equal(easyOf(withMotion(base, v)).motion, v);
    for (const [v] of EASY_SIZE) { const e = easyOf(withSize(base, v)); assert.deepEqual([e.size, e.fixed], [v, null]); }
    assert.equal(withSize(base, 5), base);
});

await test('간편: 바꾼 값이 그리기에 걸려요(마트 사본 applySet) · 「틀 그대로」 = 아무것도 안 고친 것과 같은 결과', () => {
    const [k, html] = Object.entries(fixture.inputs)[0];
    const [, mode] = k.split('|');
    const plain = applySet(html, { blGeulkku: 2 }, { mode });
    assert.equal(applySet(html, withStyle({ blGeulkku: 2, style: { look: { type: { weight: 500 } } } }, 'plain'), { mode }), plain);
    assert.notEqual(applySet(html, withStyle({ blGeulkku: 2 }, 'book'), { mode }), plain);
    assert.notEqual(applySet(html, withSize({ blGeulkku: 2 }, 2), { mode }), plain);
});

await test('마트 사본 줄이기(dist 예산): 틀별 값 표는 짧은 꼴로 싣고 같은 표로 되살려요 · 테마 원본과 같은 lib 은 다시 내보내요', async () => {
    const { packCust } = await load('tools/mart/geulkku-mart-copy.mjs');
    const table = { k1: { key: '01:m1', named: [{ name: '칸', label: '칸', kind: 'text', def: 'A', slot: 't2', max: 4 }], slots: [{ t: 't1', def: '제목', max: 8 }, { t: 't2', def: 'A', max: 4 }] }, q2: { key: '02:m2', named: [], slots: [] } };
    const code = `const CUST = ${JSON.stringify(table)};\nexport {\n  CUST\n};\n`;
    const packed = packCust(code);
    assert.notEqual(packed, code);
    const back = await import('data:text/javascript,' + encodeURIComponent(packed));
    assert.equal(JSON.stringify(back.CUST), JSON.stringify(table), '같은 차례 · 같은 값');
    const odd = `const CUST = ${JSON.stringify({ k1: { key: 'x', named: [], slots: [{ def: 'a', t: 't1', max: 1 }] } })};\nexport {\n  CUST\n};\n`;
    assert.equal(packCust(odd), odd, '꼴이 다르면 그대로');
    const { CUST } = await load('src/geulkku-mart/lib/cust/cust-table.js');
    assert.ok(Object.keys(CUST).length >= 90 && Object.values(CUST).every(v => Array.isArray(v.named) && v.slots.every(s => Object.keys(s).join() === 't,def,max')));
    for (const f of ['log-copy-spoiler.js', 'shared/char-tone.js', 'shared/ink-paint.js']) {
        const text = read(`src/geulkku-mart/lib/log-copy/${f}`);
        if (text.includes('export * from')) assert.match(text, new RegExp(`export \\* from "(?:\\.\\./)+${f.replace(/[./]/g, '\\$&')}";`), f);
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
