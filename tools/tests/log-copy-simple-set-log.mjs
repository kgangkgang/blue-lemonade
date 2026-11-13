// 결함 고침 — 받은 심플 글꾸에 담겨 온 마트 「견본 전용 값」이 실제 로그 칸에 걸리던 것(공개판 감사 · 1.1.4 부터)
//   마트에서 「대사 줄 수」를 바꾸거나 「글 고치기」 · 「줄 숨기기」를 한 틀을 「테마로 담기」로 받으면, 그 값(lines · texts · spoilers)은 마트 견본 글의 자리 번호로 적혀 있어요.
//   테마는 그 자리에 실제 로그를 그려요 → 그대로 걸면 메시지가 빠지거나(−1) 한 번 더 붙고(+1 · +2), 이름 · 대사가 마트에서 고친 견본 글로 바뀌고, 엉뚱한 메시지가 숨겨졌어요.
//   이제 실제 로그를 그리는 길(renderLog → applySet)은 그 셋을 걸지 않아요. 틀 전체에 거는 값(이름 숨김 · 색 · 글자 칸)은 그대로 걸려요.
//   node tools/tests/log-copy-simple-set-log.mjs [테마 루트]
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('log-copy-simple-set-log');

const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const { renderLog } = await load('src/log-copy-presets.js');
const { SIMPLE_FRAMES, drawSimple } = await load('src/log-copy-simple.js');
const setMod = await load('src/log-copy-simple-set.js');

// ── 화면에서 뜬 모델 꼴: 두 사람이 번갈아 대사 하나씩 넷 ──
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'line-height': '24px' };
const band = (rgb, text) => ({ t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, rgba(${rgb}, .35) 5%, rgba(${rgb}, .35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const WORDS = ['「첫째 대사」', '「둘째 대사」', '「셋째 대사」', '「넷째 대사」'];
const MODEL = {
    messages: WORDS.map((text, i) => ({ index: i, user: i % 2 === 1, name: i % 2 ? '도윤' : '하루', nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: null, nodes: [para(band(i % 2 ? '255, 95, 162' : '58, 167, 255', text))] })),
    base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '',
};
const frame = SIMPLE_FRAMES.find(f => f.key === 'k1');
const setOf = tune => ({ blGeulkku: 2, from: 'mart', frame: 'k1', frames: { k1: tune } });
const draw = (tune, o = {}) => renderLog(MODEL, { simple: { frame, set: setOf(tune) }, setMod, mode: 'dark', fields: { title: '시트 제목' }, names: true, lemonLink: true, ...o });
const order = html => WORDS.map(w => html.split(w).length - 1);
const body = html => html.slice(html.indexOf('</style>'));

await test('바탕: 받은 틀에 실제 로그 넷이 차례대로 한 번씩 · 이름 줄이 보여요', () => {
    assert.ok(frame, '내장 심플 틀 k1');
    const html = draw({});
    assert.deepEqual(order(html), [1, 1, 1, 1]);
    assert.ok(WORDS.every((w, i) => i === 0 || html.indexOf(WORDS[i - 1]) < html.indexOf(w)), '차례');
    assert.match(body(html), /<p class="gk-nm gk-n[A-Z]">하루<\/p>/);
});

for (const rows of [false, true]) {
    const base = draw({}, { rows });
    await test(`마트 견본 전용 값은 실제 로그에 걸지 않아요(${rows ? '시트 미리보기 길 rows' : '복사 길'}): 대사 줄 수 −1 · +1 · +2 · 고친 글 · 숨긴 줄`, () => {
        for (const lines of [-1, 1, 2]) assert.equal(draw({ lines }, { rows }), base, `lines ${lines}: 메시지가 빠지거나 한 번 더 붙어요`);
        assert.equal(draw({ texts: { 0: '마트 제목', 1: '마트에서 고친 지문', 2: '마트 이름', 3: '마트에서 고친 대사' } }, { rows }), base, '고친 견본 글이 실제 이름 · 대사를 덮어요');
        assert.equal(draw({ spoilers: [{ i: 1 }, { i: 3 }] }, { rows }), base, '엉뚱한 메시지가 숨겨져요');
        assert.equal(draw({ lines: 2, texts: { 3: '마트에서 고친 대사' }, spoilers: [{ i: 3 }] }, { rows }), base);
    });
}

await test('틀 전체에 거는 값은 그대로 걸려요: 이름 숨김 · 견본 전용 값과 같이 있어도', () => {
    const base = draw({}), hidden = draw({ show: { names: false }, lines: 1, texts: { 3: '마트에서 고친 대사' } });
    assert.notEqual(hidden, base);
    assert.match(hidden, /p\.gk-nm\{display:none\}/, '이름 숨김 규칙');
    assert.deepEqual(order(hidden), [1, 1, 1, 1], '로그는 그대로');
    assert.ok(!hidden.includes('마트에서 고친 대사'));
});

await test('고치기 전 꼴(견본 글에 거는 길 sample 을 실제 로그에 걸면): 넷째가 빠지고 · 셋째 넷째가 한 번 더 붙고 · 대사가 마트 글로 바뀌어요', () => {
    const drawn = drawSimple(frame, MODEL, { fields: { title: '시트 제목' }, names: true, mode: 'dark', marks: false, rows: false }).html;   // renderLog 가 applySet 에 넘기는 글 그대로
    const old = tune => setMod.applySet(drawn, setOf(tune), { mode: 'dark', key: 'k1', sample: true });
    assert.deepEqual(order(old({ lines: -1 })), [1, 1, 1, 0]);
    assert.deepEqual(order(old({ lines: 2 })), [1, 1, 2, 2]);
    assert.ok(old({ texts: { 1: '마트에서 고친 지문', 3: '마트에서 고친 대사' } }).includes('마트에서 고친'), '견본 자리 번호가 실제 줄을 가리켜요');
    assert.deepEqual(setMod.logTune({ vals: { t1: 'A' }, lines: 1, texts: { 0: 'x' }, spoilers: [{ i: 1 }], mineTexts: { 0: 'y' }, mineSpoilers: [{ i: 0 }], hideNames: true }), { vals: { t1: 'A' }, hideNames: true });
    assert.equal(setMod.logTune(null), null);
});

await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/log-copy-simple-set-log\.mjs \./);
});

done();
