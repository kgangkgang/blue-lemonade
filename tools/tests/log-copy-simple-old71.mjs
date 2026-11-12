// 1.1.3 「심플」 새 틀 등록 뒤에도 옛 틀 71종(옛 68 + 깡통 로그 셋) 출력이 바탕 분기와 한 글자도 같은지
//   PRESETS 전부 × (팔레트 있음 · 없음) = 142벌의 renderLog 출력 + 그 liftForCopy 복사 글 + 틀 목록 · 분류 · 분류별 틀 목록을 지문(sha256 16자리)으로 맞대요.
//   기대값: tools/tests/fixtures/log-copy-old71.json — 바탕 분기 사본에서 `node tools/tests/log-copy-simple-old71.mjs <바탕 사본> --write <이 저장소>` 로 떠요.
//   node tools/tests/log-copy-simple-old71.mjs .
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assert, load, root, suite } from './_t.mjs';

const WRITE = process.argv.indexOf('--write');
const sha = text => crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 16);
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const P = await load('src/log-copy-presets.js');
const { liftForCopy } = await load('src/log-copy-lift.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.3px', 'line-height': '24px', 'word-break': 'normal' };
const band = (r, g, b, text) => ({ t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, rgba(${r}, ${g}, ${b}, 0.35) 5%, rgba(${r}, ${g}, ${b}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN, 'text-indent': '15px' }, children });
const msg = (name, nodes, user = false) => ({ index: 0, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: { 'background-color': 'rgb(40, 40, 40)' }, nodes });
const model = { messages: [msg('이름', [para({ t: 'text', text: '문을 밀었다. ' }, band(59, 156, 240, '「여기 있었어?」'))]), msg('친구', [para(band(255, 95, 162, '「응.」'))], true)], base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '제목', charName: '' };
const palette = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(133, 150, 173)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.08)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#0B1216' };
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };

const now = { list: sha(JSON.stringify({ ids: P.PRESETS.map(p => p.id), categories: P.CATEGORIES, byCategory: Object.fromEntries(P.CATEGORIES.map(c => [c.id, P.presetsIn(c.id)])) })), count: P.PRESETS.length, outputs: {} };
for (const p of P.PRESETS) for (const [tag, colors] of [['pal', palette], ['none', null]]) {
    const html = P.renderLog(model, { shape: p.id, colors, ui, fields: { title: '제목' }, images: [{ src: 'https://example.com/a.png', alt: '' }] });
    now.outputs[`${p.id}/${tag}`] = `${sha(html)} ${sha(liftForCopy(html, motionStyleFor(html)).full)}`;
}

if (WRITE > 0) {
    const out = path.join(path.resolve(process.argv[WRITE + 1]), 'tools/tests/fixtures/log-copy-old71.json');
    fs.writeFileSync(out, `${JSON.stringify({ _: '옛 틀 출력 지문 — 바탕 분기 사본에서 node tools/tests/log-copy-simple-old71.mjs <바탕 사본> --write <저장소> 로 떠요', base: process.env.OLD71_BASE ?? '', ...now }, null, 1)}\n`);
    console.log(`틀 ${now.count} · 벌 ${Object.keys(now.outputs).length} → ${out}`);
} else {
    const { test, done } = suite('log-copy-simple-old71');
    const want = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/log-copy-old71.json'), 'utf8'));
    await test(`옛 틀 ${want.count}종 × 팔레트 있음 · 없음 = ${Object.keys(want.outputs).length}벌의 그린 글 · 복사 글 · 틀 목록 · 분류가 바탕 ${want.base} 과 한 글자도 같아요(심플 새 틀 깃발은 꺼져 있어요 · 1.1.7 뺀 내장 글꾸 48종은 빼고)`, async () => {
        // 1.1.7 옛 내장 글꾸 48종을 뺐어요(사용자 「내장 빼고 마트만」) — 남은 틀 23종은 바탕과 한 글자도 같고 · 빠진 것은 정확히 그 48종(이름표 log-copy-retired.js)
        const { retiredShape } = await load('src/log-copy-retired.js');
        const gone = Object.keys(want.outputs).filter(key => !(key in now.outputs));
        assert.deepEqual([...new Set(gone.map(key => key.split('/')[0]))].filter(id => !retiredShape(id)), [], '기본 틀은 하나도 안 빠져요');
        assert.equal(gone.length / 2, 48);
        assert.equal(now.count, want.count - 48);
        assert.deepEqual(Object.keys(now.outputs), Object.keys(want.outputs).filter(key => key in now.outputs));
        // 1.1.3 「기본 글꾸」 새 틀 18(src/log-copy-basic.js — 시안 생성기 그림)은 새 그림이라 바탕과 달라야 해요 · 그 시험은 log-copy-basic.mjs 가 해요
        const basic = new Set(P.PRESETS.filter(p => p.basic).map(p => p.id));
        assert.equal(basic.size, 18);
        for (const [key, value] of Object.entries(want.outputs)) {
            if (!(key in now.outputs)) continue;
            if (basic.has(key.split('/')[0])) assert.notEqual(now.outputs[key], value, `${key} 새 그림`);
            else assert.equal(now.outputs[key], value, key);
        }
    });
    done();
}
