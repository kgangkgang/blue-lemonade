// 1.2.1 결함 고침 — 내장 심플 새 틀 28 의 굵게 낱말이 가짜 굵게로 뭉개지던 것(11-12 밤 사용자가 깡통에 올린 글 · 마트 고침 ce06d4f8b 와 같은 규칙)
//   본문 글꼴이 명조 계열(400 한 굵기)인 틀에만 「굵게 = 고딕 700」 한 줄을 기본 규칙 덩이 끝에 더해요(tools/mart/simple-frames.mjs rawFrame → boldFix).
//   본문이 고딕인 틀 · 이미 굵게 규칙이 있는 틀은 그대로예요. 그림 글 묶기(맨 위 표 U)는 그대로예요(log-copy-simple-pack 이 따로 봐요).
//   고정물: tools/tests/fixtures/fake-bold-1112.json(사용자 글에서 본 꼴 · 마트 규칙 글)
//   node tools/tests/log-copy-simple-bold.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const fx = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/fake-bold-1112.json'), 'utf8'));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const tool = await load('tools/mart/simple-frames.mjs');
const { SIMPLE_FRAMES, drawSimple } = await load('src/log-copy-simple.js');
const bodyFont = (html, key) => (html.match(new RegExp(`\\.gk-${key} p\\{[^}]*?font:([^;}]*)`)) || [])[1] || '';
const firstBlock = html => { const at = html.indexOf('<style>') + 7; return html.slice(at, html.indexOf('\n\n', at)); };

await test('규칙 글: 마트 BOLD_RULE 과 한 글자도 같아요', () => {
    assert.equal(tool.BOLD_RULE('k1'), fx.rule);
});

await test('등록 값 28틀: 명조 본문 틀마다 굵게 규칙이 한 번 · 기본 규칙 덩이 안 · 고딕 본문 틀은 0', () => {
    let serif = 0;
    assert.equal(SIMPLE_FRAMES.length, 28);
    for (const f of SIMPLE_FRAMES) {
        const n = f.html.split(tool.BOLD_RULE(f.key)).length - 1;
        if (/(?:^|,)\s*serif\s*$/.test(bodyFont(f.html, f.key))) { serif++; assert.equal(n, 1, `${f.key} 명조 본문인데 굵게 규칙이 ${n}개`); assert.ok(firstBlock(f.html).includes(tool.BOLD_RULE(f.key)), `${f.key} 기본 규칙 덩이 밖`); }
        else assert.equal(n, 0, `${f.key} 고딕 본문 틀에 굵게 규칙`);
    }
    assert.equal(serif, 28, '지금 내장 28틀은 모두 명조 본문이에요');
});

await test('명조 본문 틀만: 본문을 고딕으로 바꾼 판 · 이미 굵게 규칙이 있는 판에는 더하지 않아요', () => {
    const raw = tool.rawFrame(tool.DEFS.find(d => d.frame === 'k1'));
    const plain = raw.replace(`\n${fx.rule}`, '');
    assert.ok(raw.includes(fx.rule) && !plain.includes(fx.rule));
    assert.ok(plain.includes(fx.serifFont), '고정물의 명조 글꼴 글이 k1 본문과 달라요');
    assert.equal(tool.fakeBold(plain), true);
    assert.equal(tool.fakeBold(plain.replace(fx.serifFont, fx.sansFont)), false, '고딕 본문');
    assert.equal(tool.fakeBold(raw), false, '이미 굵게 규칙이 있음');
});

await test('사용자 글 꼴(지문 안 기울임 · 굵게 · 취소): 복사 글에 굵은 낱말과 고딕 700 규칙이 같이 실려요', () => {
    const f = SIMPLE_FRAMES.find(x => x.key === 'k1');
    const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '24px' };
    const kids = fx.line.map(n => (n.t === 'text' ? { t: 'text', text: n.text } : { t: 'el', block: false, style: n.style, children: [{ t: 'text', text: n.text }] }));
    const model = { messages: [{ index: 0, user: false, name: '이름', nameStyle: {}, time: null, font: { ...SCREEN }, bubble: null, nodes: [{ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children: kids }] }], base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' };
    for (const mode of ['light', 'dark']) {
        const { html } = drawSimple(f, model, { mode, fields: { title: '제목' } });
        assert.match(html, /<p class="gk-nr">[^]*?<(strong|b)>굵게<\/\1>/, `${mode}: 굵은 낱말`);
        assert.equal(html.split(fx.rule).length - 1, 1, `${mode}: 굵게 규칙`);
        assert.ok(html.indexOf(fx.rule) < html.indexOf('</style>'));
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
