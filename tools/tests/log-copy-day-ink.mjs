// 로그 복사 「그대로」 틀 — 낮 · 밤을 바꿔도 채팅에 칠한 글자색이 남는지(11-14 사용자 「왜 라이트는 글자색 없고 나이트는 있냐」)
//   잠그는 것: ① 밤 화면 분홍 속마음 → 낮 팔레트(블루 레몬 등 전부)에서 본문색이 아니라 같은 색상의 진한 분홍 · 대비 4.6 이상
//   ② 낮 화면 진한 색 → 밤 팔레트에서 밝힌 같은 색 ③ 이미 읽히는 색 · 역할 색 바꾸기는 예전 그대로 ④ 못 맞추는 바탕이면 본문색
//   node tools/tests/log-copy-day-ink.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-day-ink');
const { renderLog } = await load('src/log-copy-presets.js');
const { recolorLog, fitInk } = await load('src/log-copy-words.js');
const { PALETTES, TOKEN_KEYS, PALETTE_MODES, paletteBase } = await load('src/palettes.js');
const { contrast, parseColor } = await load('src/shared/ink-paint.js');
await load('src/palette-data.js');

const tok = p => Object.fromEntries([...TOKEN_KEYS, 'pop'].filter(k => p[k]).map(k => [k, p[k]]));
const hue = (v) => { const { r, g, b } = parseColor(v); const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; if (!d) return null; const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const SCREEN = bodyInk => ({ color: bodyInk, 'font-family': 'serif', 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'line-height': '24px' });
const model = (bg, bodyInk, ink) => ({ base: { ...SCREEN(bodyInk), bg }, chatTitle: '', charName: '', messages: [{ index: 0, user: false, name: '가', nameStyle: { color: bodyInk }, time: null, font: SCREEN(bodyInk), bubble: null, nodes: [
    { t: 'el', block: true, tag: 'p', style: SCREEN(bodyInk), children: [{ t: 'text', text: '서술 문장.' }] },
    { t: 'el', block: true, tag: 'p', style: SCREEN(bodyInk), children: [{ t: 'el', block: false, tag: 'em', kind: 'em', style: { color: ink, 'font-style': 'italic' }, children: [{ t: 'text', text: '속마음 글' }] }] },
] }] });
const inkBefore = (html, word) => { const pre = html.slice(0, html.indexOf(word)); const all = [...pre.matchAll(/color:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi)]; return all.at(-1)?.[1]; };
const PINK = 'rgb(255, 105, 170)';
const nightModel = model('rgb(27, 28, 31)', 'rgb(225, 225, 229)', PINK);
const lights = Object.keys(PALETTE_MODES).filter(id => !id.startsWith('custom') && PALETTE_MODES[id] === 'light');
const darks = Object.keys(PALETTE_MODES).filter(id => !id.startsWith('custom') && PALETTE_MODES[id] === 'dark');

await test('밤 화면 분홍 속마음 → 낮 팔레트 전부: 본문색이 아니라 진한 분홍(색상 같음 · 대비 4.6 이상)', () => {
    assert.ok(lights.length >= 12, `낮 팔레트 ${lights.length}`);
    for (const id of lights) {
        const to = paletteBase(id), m = recolorLog(nightModel, tok(PALETTES.night), tok(to));
        const html = renderLog(m, { shape: 'plain', colors: null });
        const ink = inkBefore(html, '속마음 글');
        assert.ok(ink, `${id} 글자색`);
        assert.ok(contrast(ink, m.base.bg) >= 4.6, `${id} 대비 ${contrast(ink, m.base.bg).toFixed(2)} (${ink})`);
        assert.ok(contrast(ink, m.base.color) > 1.5, `${id} 본문색과 달라야 해요 ${ink} / ${m.base.color}`);
        assert.ok(Math.abs(hue(ink) - hue(PINK)) < 4, `${id} 같은 분홍 계열 ${ink}`);
    }
});

await test('밤 팔레트로 그대로면 원래 분홍 그대로(바이트까지 같은 색 글자)', () => {
    for (const id of darks) {
        const m = recolorLog(nightModel, tok(PALETTES.night), tok(paletteBase(id)));
        assert.equal(inkBefore(renderLog(m, { shape: 'plain', colors: null }), '속마음 글'), PINK, id);
    }
});

await test('낮 화면 진한 색 → 밤 팔레트: 같은 색을 밝혀 대비 4.6 이상', () => {
    const day = model('rgb(249, 252, 255)', 'rgb(34, 45, 58)', 'rgb(120, 20, 70)');
    for (const id of darks) {
        const m = recolorLog(day, tok(PALETTES.salt), tok(paletteBase(id)));
        const ink = inkBefore(renderLog(m, { shape: 'plain', colors: null }), '속마음 글');
        assert.ok(contrast(ink, m.base.bg) >= 4.6, `${id} ${ink}`);
        assert.ok(Math.abs(hue(ink) - hue('rgb(120, 20, 70)')) < 4, `${id} 같은 색상 ${ink}`);
    }
});

await test('fitInk: 읽히는 색은 그대로 · 반투명은 겹친 불투명 색 · 못 맞추면 본문색', () => {
    assert.equal(fitInk('rgb(200, 30, 120)', 'rgb(249, 252, 255)', 'X'), 'rgb(200, 30, 120)');
    const half = fitInk('rgba(255, 105, 170, 0.6)', 'rgb(249, 252, 255)', 'X');
    assert.match(half, /^rgb\(/); assert.ok(contrast(half, 'rgb(249, 252, 255)') >= 4.6, half);
    assert.equal(fitInk('rgb(255, 105, 170)', 'rgb(118, 118, 118)', 'X'), 'X', '중간 회색 바탕은 어느 쪽 끝도 4.6 이 안 돼요');
    assert.equal(fitInk('transparent', 'rgb(249, 252, 255)', 'X'), 'X');
});

done();
