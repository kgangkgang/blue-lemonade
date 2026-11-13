// 1.1.4 성능: src/tone.js 글자색 맞춤 — 16진 색(#rgb · #rgba · #rrggbb · #rrggbbaa)은 숨은 요소 · 계산 스타일 없이 바로 읽는지(계산 스타일 읽기는 밀린 스타일 계산을 그 자리에서 강제해요),
//   읽은 숫자가 브라우저 계산값(rgb(r, g, b))과 같은지, 그 밖의 표기(이름 색 · rgb() · var() · 깨진 값)는 예전처럼 브라우저에 맡기는지
//   node tools/tests/tone-hex.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

// 숨은 요소 · 계산 스타일을 세는 모형 문서(브라우저처럼 16진 · 이름 색 몇 개를 rgb() 로 돌려줘요)
const NAMED = { darkred: 'rgb(139, 0, 0)', gold: 'rgb(255, 215, 0)' };
const cssRgb = (value) => {
    const v = String(value).trim().toLowerCase();
    if (NAMED[v]) return NAMED[v];
    let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
    if (m) {
        const h = m[1].length <= 4 ? [...m[1]].map(c => c + c).join('') : m[1];
        const n = i => parseInt(h.slice(i, i + 2), 16);
        return h.length === 8 && n(6) !== 255 ? `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${+(n(6) / 255).toFixed(3)})` : `rgb(${n(0)}, ${n(2)}, ${n(4)})`;
    }
    m = /^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/.exec(v);
    return m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : '';
};
let probes = 0, computed = 0;
const probe = { style: { _c: '', cssText: '', get color() { return this._c; }, set color(v) { if (v === '') this._c = ''; else if (cssRgb(v)) this._c = v; } } };
const colored = [];   // 채팅 안 색 글자 모형
const el = (src, viaStyle = false) => {
    const node = { dataset: {}, added: [], hue: undefined,
        getAttribute: name => (name === 'color' ? (viaStyle ? null : src) : name === 'style' ? (viaStyle ? `font-weight:700; color: ${src}` : '') : null),
        // 브라우저처럼: add · remove 는 class 가 그대로여도 속성을 다시 써요(기록 하나) · toggle(c, 힘) 은 바뀔 때만 써요
        writes: 0,
        classList: { contains: c => node.added.includes(c), add: c => { node.writes++; if (!node.added.includes(c)) node.added.push(c); }, remove: c => { node.writes++; node.added = node.added.filter(x => x !== c); },
            toggle: (c, force) => { const has = node.added.includes(c), want = force ?? !has; if (want !== has) { node.writes++; node.added = want ? [...node.added, c] : node.added.filter(x => x !== c); } return want; } },
        style: { setProperty: (k, v) => { if (k === '--bl-hue') node.hue = v; }, removeProperty: () => { node.hue = undefined; } } };
    return node;
};
globalThis.matchMedia = () => ({ addEventListener() {}, matches: false });
globalThis.document = {
    body: { classList: { contains: () => true }, append() {}, dataset: {} },
    createElement: () => { probes++; return probe; },
    querySelectorAll: () => [{ querySelectorAll: () => colored }],
    getElementById: () => null, addEventListener() {},
};
globalThis.getComputedStyle = () => { computed++; return { color: cssRgb(probe.style.color) }; };
const ctx = { extensionSettings: {}, powerUserSettings: {}, eventSource: { on() {} }, event_types: {} };
globalThis.SillyTavern = { getContext: () => ctx };
const { DEFAULTS } = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
ctx.extensionSettings.salty = structuredClone(DEFAULTS);
Object.assign(ctx.extensionSettings.salty, { enabled: true });
ctx.extensionSettings.salty.chat.toneInline = true; ctx.extensionSettings.salty.chat.unifyInline = false;
const T = await import(pathToFileURL(path.join(root, 'src/tone.js')).href);

await test('hexRgb: 네 가지 16진 표기 · 대소문자 — 브라우저 계산값과 같은 숫자', () => {
    for (const src of ['#abc', '#ABC', '#abcd', '#a1b2c3', '#A1B2C3', '#a1b2c380', '#000', '#fff', '#FFFFFF', '#12345678', '#0f0f']) {
        const want = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(cssRgb(src)).slice(1, 4).map(Number);
        assert.deepEqual(T.hexRgb(src), want, src);
    }
});
await test('hexRgb: 16진이 아니면 null(브라우저에 맡겨요) — 이름 색 · rgb() · var() · 자릿수 틀림 · 앞뒤 공백 · !important', () => {
    for (const src of ['darkred', 'rgb(1, 2, 3)', 'var(--x)', '#12', '#12345', '#1234567', '#abcg', ' #abc', '#abc ', '#abc !important', 'abc', '']) assert.equal(T.hexRgb(src), null, JSON.stringify(src));
});
await test('색 글자 재기: 16진 색은 숨은 요소 · 계산 스타일 0번, 결과(--bl-hue · 회색 표식)는 브라우저가 읽은 것과 같아요', () => {
    const red = el('#ff0000'), grey = el('#808080', true), blue = el('#00f'), named = el('darkred');
    colored.push(red, grey, blue);
    T.retoneAll();
    assert.equal(probes, 0, '숨은 요소를 만들지 않아요'); assert.equal(computed, 0, '계산 스타일을 읽지 않아요');
    assert.equal(red.hue, '0'); assert.equal(blue.hue, '240'); assert.deepEqual(grey.added, ['bl-tone-grey']); assert.equal(grey.hue, undefined);
    assert.equal(red.dataset.blToned, '#ff0000');
    // 이름 색은 예전 길(브라우저) — 같은 색은 한 번만 물어요
    colored.push(named, el('darkred'));
    T.retoneAll();
    assert.equal(probes, 1); assert.equal(computed, 1);
    assert.equal(named.hue, '0');
});
await test('1.2.1 class 는 바뀔 때만 써요 — 색 글자(회색 아님)는 처음 잴 때 class 기록 0 · 회색은 1, 색이 바뀌어 다시 재도 그대로면 0', () => {
    colored.length = 0;
    const red = el('#ff0000'), grey = el('#808080');
    colored.push(red, grey);
    T.retoneAll();
    assert.equal(red.writes, 0, '없는 bl-tone-grey 를 지우느라 class 를 다시 쓰지 않아요');
    assert.equal(grey.writes, 1); assert.deepEqual(grey.added, ['bl-tone-grey']);
    // 색이 바뀐 것처럼(다른 확장이 다시 그림) 표식만 지우고 다시 재요 — class 가 같으면 다시 쓰지 않아요
    delete red.dataset.blToned; delete grey.dataset.blToned;
    T.retoneAll();
    assert.equal(red.writes, 0); assert.equal(grey.writes, 1); assert.deepEqual(grey.added, ['bl-tone-grey']);
    assert.equal(red.hue, '0'); assert.equal(grey.hue, undefined);
});
await test('소스: toRgb 는 16진 판정을 숨은 요소보다 먼저 · CI 등록', () => {
    const src = fs.readFileSync(path.join(root, 'src/tone.js'), 'utf8');
    assert.match(src, /const hex = hexRgb\(value\);\s*\n\s*if \(hex\) return hex;\s*\n\s*if \(!probe\)/);
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/tone-hex.mjs .'));
});
console.log(`tone-hex: ${passed} passed`);
