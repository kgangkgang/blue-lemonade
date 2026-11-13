// 1.2.1 opt: src/icon-text.js 의 서랍 줄 자식 특징(rowFeatureBits)이 글자 묶음(Set) 대신 비트로 · 자식 클래스는 className 글자 한 번 + 정규식으로 바뀐 뒤에도
//   ① 특징 열쇠가 예전(classList 를 하나씩 꺼내 Set 에 담던 것)과 같은지 — 공백 다섯 가지 · 비슷한 이름(flex10 · inline-drawer-content) · NBSP · 중복 토큰
//   ② 줄 표식(rowTokens)이 className 길과 classList 길에서 같은지(무작위 나무 — classList 길은 icon-text-scope.mjs 가 옛 표와 견줘요)
//   ③ className 이 글자인 요소는 classList 를 꺼내지 않는지(바인딩 호출 수) · svg 처럼 글자가 아니면 예전처럼 classList 로 가는지
//   ④ 미세 벤치: 설정 서랍 꼴 줄 수천 개에서 예전 Set 판정 → 비트 판정 시간 · classList 꺼냄 수(가짜 DOM · 노드 — 브라우저 바인딩 비용은 못 재요)
//   node tools/tests/icon-text-row-bits.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const counts = { classList: 0, className: 0 };
const ASCII_WS = /[ \t\n\f\r]+/;
class El {
    // mode: 'str' = className 이 글자(HTML 요소) · 'svg' = className 이 글자가 아님(SVGAnimatedString 흉내) · 'none' = className 없음(옛 시험 흉내)
    constructor(tag, cls = '', children = [], attrs = {}, mode = 'str') {
        this.localName = tag; this.raw = cls; this.mode = mode; const list = cls.split(ASCII_WS).filter(Boolean);
        const self = this;
        this._list = { contains: c => list.includes(c), get length() { return list.length; }, *[Symbol.iterator]() { yield* list; } };
        this.children = children; this.attrs = attrs; this.id = attrs.id || ''; this.name = attrs.name || ''; this.type = attrs.type || '';
        for (const c of children) c.parentElement = this;
        void self;
    }
    get classList() { counts.classList++; return this._list; }
    get className() { counts.className++; return this.mode === 'str' ? this.raw : this.mode === 'svg' ? { baseVal: this.raw, animVal: this.raw } : undefined; }
    get firstElementChild() { return this.children[0] || null; }
    get childElementCount() { return this.children.length; }
    getAttribute(a) { return a in this.attrs ? this.attrs[a] : null; }
    hasAttribute(a) { return a in this.attrs; }
    querySelector(sel) { const want = sel.startsWith('#') ? e => e.id === sel.slice(1) : e => e.localName === sel; const walk = e => { for (const k of e.children) { if (want(k)) return k; const r = walk(k); if (r) return r; } return null; }; return walk(this); }
}
const mod = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);
const { rowTokens, rowFeatures, rowFeatureBits, rowCandidate } = mod;
assert.equal(typeof rowFeatureBits, 'function', 'rowFeatureBits 를 내보내요');

// 예전(1.1.9) rowFeatures 그대로 — 기준(classList 를 하나씩 꺼내 Set 에)
const CLASSES = new Set(['neo-range-slider', 'range-block-title', 'checkbox_label', 'inline-drawer', 'standoutHeader', 'oneline-dropdown', 'api_button', 'prompt_manager_prompt_controls', 'bl-copyright', 'salty-slider', 'menu_button_icon', 'flex-container', 'flex1', 'editor_maximize']);
const TAGS = new Set(['select', 'input', 'h4']);
const IDS = new Set(['instruct_names_behavior', 'bl-response-range', 'world_info_character_strategy', 'regex_presets', 'movingUIModeCheckBlock']);
function oldFeatures(el) {
    const found = new Set();
    for (const c of el.children) {
        if (TAGS.has(c.localName)) found.add(c.localName);
        if (c.id && IDS.has(c.id)) found.add('#' + c.id);
        const list = c.classList;
        if (!list || list.length === 0) continue;
        for (const name of list) if (CLASSES.has(name)) found.add('.' + name);
    }
    return found;
}
const sorted = s => [...s].sort().join(' ');

// 무작위 — 고정 씨앗
let seed = 12345;
const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const pick = list => list[rnd(list.length)];
const NAMES = [...CLASSES, 'flex10', 'inline-drawer-content', 'inline-drawer-toggle', 'xflex1', 'flex1x', 'range-block', 'range-block-range-and-counter', 'neo-range-input', 'wide100p', 'toggle-description', 'menu_button', 'fa-solid', 'fa-folder-plus', 'peer', 'sr-only', 'Flex1', 'standoutheader', 'salty-slider ', ' flex1', 'flex1\u000b'];
const WS = [' ', '  ', '\t', '\n', '\f', '\r', ' \t '];
const TAGS_ALL = ['div', 'span', 'label', 'small', 'select', 'input', 'h4', 'form', 'li', 'i', 'a'];
const IDS_ALL = ['', '', '', ...IDS, 'regex_presets2', 'bl-response'];
const classText = () => { const n = rnd(5); let s = rnd(4) === 0 ? pick(WS) : ''; for (let i = 0; i < n; i++) s += (i ? pick(WS) : '') + pick(NAMES); return s + (rnd(4) === 0 ? pick(WS) : ''); };
function tree(depth, mode) {
    const n = depth > 0 ? rnd(5) : 0, kids = [];
    for (let i = 0; i < n; i++) kids.push(tree(depth - 1, mode));
    const attrs = {}; const id = pick(IDS_ALL); if (id) attrs.id = id;
    const tag = pick(TAGS_ALL); if (tag === 'input') attrs.type = pick(['number', 'checkbox', 'text']);
    if (tag === 'select' && rnd(3) === 0) attrs.name = pick(['entryLogicType', 'substitute_regex']);
    return new El(tag, classText(), kids, attrs, typeof mode === 'function' ? mode() : mode);
}
// 같은 모양을 다른 className 흉내로 — 줄 표식은 같아야 해요
const recast = (el, mode) => new El(el.localName, el.raw, el.children.map(k => recast(k, mode)), el.attrs, mode);
const walk = (el, out = []) => { out.push(el); for (const k of el.children) walk(k, out); return out; };

await test('특징 열쇠가 예전 Set 판정과 같아요 — className 글자 길 · svg 길 · className 없는 길(무작위 나무 300개)', () => {
    let nodes = 0, nonEmpty = 0;
    for (let t = 0; t < 300; t++) {
        const base = tree(4, () => pick(['str', 'str', 'str', 'svg', 'none']));
        for (const el of walk(base)) {
            const want = oldFeatures(el), got = rowFeatures(el);
            assert.equal(sorted(got), sorted(want), `열쇠 다름: ${el.children.map(k => JSON.stringify(k.raw)).join(' | ')}`);
            assert.equal(rowCandidate(el), want.size > 0);
            assert.equal(rowFeatureBits(el) !== 0, want.size > 0);
            nodes++; if (want.size) nonEmpty++;
        }
    }
    console.log(`        요소 ${nodes}개 · 특징 있음 ${nonEmpty}개`);
    assert.ok(nonEmpty > 500);
});

await test('줄 표식(rowTokens)이 className 길과 classList 길에서 같아요(무작위 나무 300개)', () => {
    let nodes = 0, marked = 0;
    for (let t = 0; t < 300; t++) {
        const a = tree(4, 'str'), b = recast(a, 'none'), c = recast(a, 'svg');
        const xa = walk(a), xb = walk(b), xc = walk(c);
        for (let i = 0; i < xa.length; i++) {
            const ta = rowTokens(xa[i]);
            assert.equal(ta, rowTokens(xb[i])); assert.equal(ta, rowTokens(xc[i]));
            nodes++; if (ta) marked++;
        }
    }
    console.log(`        요소 ${nodes}개 · 표식 ${marked}개`);
    assert.ok(marked > 200);
});

await test('className 이 글자면 자식 classList 를 꺼내지 않아요 · 글자가 아니면 예전처럼 classList', () => {
    const row = mode => new El('div', '', [new El('small', 'a', [], {}, mode), new El('div', 'neo-range-slider x', [], {}, mode), new El('input', 'neo-range-input', [], { type: 'number' }, mode)]);
    counts.classList = 0; const s = rowFeatureBits(row('str')); assert.equal(counts.classList, 0, 'HTML 요소는 className 한 번');
    counts.classList = 0; const v = rowFeatureBits(row('svg')); assert.equal(counts.classList, 3, 'svg 흉내는 classList');
    assert.equal(s, v); assert.ok(s !== 0);
    assert.equal(sorted(rowFeatures(row('str'))), '.neo-range-slider input');
});

await test('미세 벤치 — 설정 서랍 꼴 줄 6,000개: 예전 Set 판정 → 비트 판정', () => {
    const rows = [];
    for (let i = 0; i < 6000; i++) rows.push(new El('div', 'flex-container', [
        new El('label', 'checkbox_label ' + (i % 7 ? 'flex1' : ''), [new El('input', '', [], { type: 'checkbox' })]),
        new El('small', 'notes-link fa-solid'), new El('span', 'range-block-counter wide100p'),
        new El('div', 'flex-container alignItemsCenter justifyCenter gap5px'), new El('i', 'fa-solid fa-circle-info opacity50p'),
    ]));
    const run = fn => { const t0 = process.hrtime.bigint(); let n = 0; for (let r = 0; r < 5; r++) for (const row of rows) n += fn(row) ? 1 : 0; return [Number(process.hrtime.bigint() - t0) / 1e6 / 5, n]; };
    run(oldFeatures); run(rowFeatureBits);   // 데우기
    counts.classList = 0; const [before, nb] = run(r => oldFeatures(r).size); const listBefore = counts.classList / 5;
    counts.classList = 0; const [after, na] = run(rowFeatureBits); const listAfter = counts.classList / 5;
    assert.equal(nb, na);
    console.log(`        한 바퀴 ${before.toFixed(2)} → ${after.toFixed(2)}ms · 자식 classList 꺼냄 ${listBefore} → ${listAfter}회 (줄 6,000개 · 자식 30,000개)`);
    assert.equal(listAfter, 0);
});

console.log(`icon-text-row-bits: ${passed} passed`);
