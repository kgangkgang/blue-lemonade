// 8.2.6 성능: src/icon-text.js 의 서랍 줄 표식이 「걸릴 자식이 없으면 35가지 검사를 건너뛰기」 뒤에도 옛 결과와 같은지,
//   글자 칸 변화 가운데 .menu_button 바로 아래 글자만 남기는지, 검사 호출 수가 줄었는지 (가짜 DOM, 브라우저 없음)
//   node tools/tests/icon-text-scope.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
let containsCalls = 0;
class El {
    constructor(tag, cls = '', children = [], attrs = {}) {
        this.localName = tag; const list = cls.split(/\s+/).filter(Boolean);
        // 클래스 검사 한 번 = contains 한 번 또는 되풀이로 꺼낸 클래스 하나
        this.classList = { contains: c => { containsCalls++; return list.includes(c); }, length: list.length, *[Symbol.iterator]() { for (const c of list) { containsCalls++; yield c; } } };
        this.children = children; this.attrs = attrs; this.id = attrs.id || ''; this.name = attrs.name || ''; this.type = attrs.type || '';
        for (const c of children) c.parentElement = this;
    }
    get firstElementChild() { return this.children[0] || null; }
    get childElementCount() { return this.children.length; }
    getAttribute(a) { return a in this.attrs ? this.attrs[a] : null; }
    hasAttribute(a) { return a in this.attrs; }
    querySelector(sel) { const want = sel.startsWith('#') ? e => e.id === sel.slice(1) : e => e.localName === sel; const walk = e => { for (const k of e.children) { if (want(k)) return k; const r = walk(k); if (r) return r; } return null; }; return walk(this); }
}
const { rowTokens, rowCandidate, relevantRecords } = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);

// 8.2.5 까지의 판정 그대로(모든 요소에 35가지 검사) — 기준
const has = (el, c) => el.classList.contains(c);
const tag = (el, t) => el.localName === t;
const numOnly = w => w.childElementCount === 1 && tag(w.firstElementChild, 'input') && w.firstElementChild.type === 'number';
const REF_TOKENS = [
    ['neo', k => k.length >= 3 && tag(k[0], 'small') && has(k[1], 'neo-range-slider') && has(k[2], 'neo-range-input')],
    ['sneo', k => k.length >= 3 && (tag(k[0], 'small') || tag(k[0], 'label')) && has(k[1], 'neo-range-slider') && has(k[2], 'neo-range-input')],
    ['lneo', k => k.some((c, i) => tag(c, 'label') && k[i + 1] && has(k[i + 1], 'neo-range-slider') && k[i + 2] && has(k[i + 2], 'neo-range-input'))],
    ['range', k => k.some((c, i) => has(c, 'range-block-title') && k[i + 1] && has(k[i + 1], 'range-block-range-and-counter'))],
    ['num', k => k.some((c, i) => has(c, 'range-block-title') && k[i + 1] && has(k[i + 1], 'wide100p') && numOnly(k[i + 1]))],
    ['numd', k => k.some((c, i) => has(c, 'range-block-title') && k[i + 1] && has(k[i + 1], 'toggle-description') && k[i + 2] && has(k[i + 2], 'wide100p') && numOnly(k[i + 2]))],
    ['chk', k => !!k[0] && tag(k[0], 'label') && has(k[0], 'checkbox_label')],
    ['title', k => k.some(c => has(c, 'range-block-title'))],
    ['slider', k => k.some(c => has(c, 'neo-range-slider'))],
    ['idr', k => k.some(c => has(c, 'inline-drawer'))],
    ['soh', k => k.some(c => has(c, 'standoutHeader'))],
    ['odd', k => k.some(c => has(c, 'oneline-dropdown'))],
    ['api', k => k.some(c => has(c, 'api_button'))],
    ['pmc', k => k.some(c => has(c, 'prompt_manager_prompt_controls'))],
    ['copy', k => k.some(c => has(c, 'bl-copyright'))],
    ['sl2', k => k.some((c, i) => has(c, 'salty-slider') && k[i + 1] && has(k[i + 1], 'salty-slider'))],
    ['fplus', k => k.some(c => has(c, 'menu_button_icon') && [...c.children].some(g => has(g, 'fa-folder-plus')))],
    ['sel', k => k.some(c => tag(c, 'select'))],
    ['logic', k => k.some(c => tag(c, 'select') && c.name === 'entryLogicType')],
    ['subsel', k => k.some(c => tag(c, 'select') && c.name === 'substitute_regex')],
    ['pm', k => k.some(c => tag(c, 'select') && c.hasAttribute('data-preset-manager-for'))],
    ['lsel', k => k.some((c, i) => (tag(c, 'span') || tag(c, 'label')) && k[i + 1] && tag(k[i + 1], 'select'))],
    ['lsel2', k => k.some((c, i) => tag(c, 'label') && k[i + 1] && tag(k[i + 1], 'select'))],
    ['sel2', k => k.some((c, i) => tag(c, 'label') && k[i + 1] && has(k[i + 1], 'flex-container') && [...k[i + 1].children].some(g => tag(g, 'select')))],
    ['f1sel', k => k.some(c => has(c, 'flex1') && !!c.querySelector('select'))],
    ['numin', k => k.some(c => tag(c, 'input') && c.type === 'number')],
    ['smax', k => k.some((c, i) => tag(c, 'small') && k[i + 1] && has(k[i + 1], 'editor_maximize'))],
    ['peer', k => k.some((c, i) => tag(c, 'input') && c.type === 'checkbox' && has(c, 'peer') && has(c, 'sr-only') && k[i + 1] && tag(k[i + 1], 'label'))],
    ['h4', k => k.some(c => tag(c, 'h4'))],
    ['h4dep', k => k.some(c => tag(c, 'h4') && [...c.children].some(g => g.getAttribute('data-i18n') === '(DEPRECATED)'))],
    ['instr', k => k.some(c => c.id === 'instruct_names_behavior')],
    ['resp', k => k.some(c => c.id === 'bl-response-range')],
    ['wics', k => k.some(c => c.id === 'world_info_character_strategy')],
    ['rxp', k => k.some(c => c.id === 'regex_presets')],
    ['mui', k => k.some(c => c.id === 'movingUIModeCheckBlock')],
];
const DEEP_IDS = [['oai-ctx-unl', 'oai_max_context_unlocked'], ['stream', 'stream_toggle'], ['oai-ctx', 'openai_max_context'], ['oai-tok', 'openai_max_tokens'], ['n-openai', 'n_openai'], ['seed', 'seed_openai']];
function refTokens(el) {
    const k = [...el.children]; const tokens = [];
    for (const [name, test] of REF_TOKENS) if (test(k, el)) tokens.push(name);
    if (tag(el, 'label') && el.querySelector('select')) tokens.push('dsel');
    if (has(el, 'range-block')) for (const [name, id] of DEEP_IDS) if (el.querySelector('#' + id)) tokens.push(name);
    return tokens.join(' ');
}

// 지어낸 무작위 나무 — 서랍 줄에 나오는 클래스 · 태그 · 아이디 · 속성을 섞어요(고정 씨앗이라 늘 같은 나무)
let seed = 20261029;
const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const TAGS = ['div', 'span', 'small', 'label', 'select', 'input', 'h4', 'form', 'li', 'i', 'b', 'a'];
const CLASSES = ['', '', '', 'flex-container', 'range-block', 'range-block-title', 'range-block-range-and-counter', 'neo-range-slider', 'neo-range-input', 'wide100p', 'toggle-description', 'checkbox_label', 'inline-drawer', 'standoutHeader', 'oneline-dropdown', 'api_button', 'prompt_manager_prompt_controls', 'bl-copyright', 'salty-slider', 'menu_button_icon', 'fa-folder-plus', 'flex1', 'editor_maximize', 'peer sr-only', 'menu_button', 'fa-solid fa-plus', 'completion_prompt_manager_prompt_name'];
const IDS = ['', '', '', '', '', '', 'instruct_names_behavior', 'bl-response-range', 'world_info_character_strategy', 'regex_presets', 'movingUIModeCheckBlock', 'oai_max_context_unlocked', 'stream_toggle', 'openai_max_context', 'n_openai', 'seed_openai', 'other_id'];
function randomEl(depth) {
    const t = TAGS[rnd(TAGS.length)];
    const attrs = {};
    const id = IDS[rnd(IDS.length)]; if (id) attrs.id = id;
    if (t === 'input') attrs.type = ['number', 'checkbox', 'text'][rnd(3)];
    if (t === 'select') { const n = ['', 'entryLogicType', 'substitute_regex'][rnd(3)]; if (n) attrs.name = n; if (rnd(4) === 0) attrs['data-preset-manager-for'] = 'x'; }
    if (rnd(12) === 0) attrs['data-i18n'] = '(DEPRECATED)';
    const kids = [];
    if (depth > 0) for (let i = rnd(5); i > 0; i--) kids.push(randomEl(depth - 1));
    return new El(t, CLASSES[rnd(CLASSES.length)], kids, attrs);
}
const all = [];
const collect = e => { all.push(e); e.children.forEach(collect); };
for (let i = 0; i < 400; i++) collect(randomEl(4));

await test(`무작위 요소 ${all.length}개에서 새 판정이 8.2.5 판정과 하나도 다르지 않음`, () => {
    let differ = 0, nonEmpty = 0;
    for (const e of all) { const a = rowTokens(e), b = refTokens(e); if (a !== b) differ++; if (b) nonEmpty++; }
    assert.equal(differ, 0);
    assert.ok(nonEmpty > 500, `표식이 붙는 요소도 충분히 섞여야 해요(${nonEmpty})`);
});
await test('걸릴 자식이 없으면 후보가 아니고, 표의 특징 하나만 있어도 후보', () => {
    assert.equal(rowCandidate(new El('li', '', [new El('span', 'completion_prompt_manager_prompt_name'), new El('i', 'fa-solid fa-plus')])), false);
    assert.equal(rowCandidate(new El('div', '', [new El('span', ''), new El('select', '')])), true);
    assert.equal(rowCandidate(new El('div', '', [new El('div', 'x flex1')])), true);
    assert.equal(rowCandidate(new El('div', '', [new El('div', '', [], { id: 'regex_presets' })])), true);
    // label 안 select(dsel) · .range-block 안 아이디는 후보와 상관없이 그대로 봐요
    assert.equal(rowTokens(new El('label', '', [new El('span', '', [new El('select', '')])])), 'dsel');
    assert.equal(rowTokens(new El('div', 'range-block', [new El('div', '', [new El('input', '', [], { id: 'stream_toggle', type: 'checkbox' })])])), 'stream');
});
await test('프롬프트 목록 꼴(줄 139개)에서 클래스 검사 호출이 8.2.5 의 1/3 아래', () => {
    const row = () => new El('li', 'completion_prompt_manager_prompt', [
        new El('span', 'drag-handle'), new El('span', 'completion_prompt_manager_prompt_name', [new El('a', 'prompt-manager-inspect-action')]),
        new El('span', '', [new El('span', 'prompt_manager_prompt_controls', [new El('span', 'fa-solid fa-pencil'), new El('span', 'fa-solid fa-toggle-on')])]),
        new El('span', 'prompt_manager_prompt_tokens'),
    ]);
    const list = new El('ul', '', Array.from({ length: 139 }, row));
    const nodes = []; const walk = e => { nodes.push(e); e.children.forEach(walk); }; walk(list);
    containsCalls = 0; const a = nodes.map(rowTokens); const mine = containsCalls;
    containsCalls = 0; const b = nodes.map(refTokens); const before = containsCalls;
    assert.deepEqual(a, b);
    console.log(`        클래스 검사 ${before} → ${mine}회 (요소 ${nodes.length}개)`);
    assert.ok(mine * 3 < before, `${mine} vs ${before}`);
});
await test('글자 칸 변화는 .menu_button 바로 아래 글자만 남기고 나머지 기록은 그대로', () => {
    const btn = new El('div', 'menu_button'), tok = new El('span', 'tokenCounterDisplay'), box = new El('div', 'flex-container');
    const text = parentElement => ({ nodeType: 3, parentElement });
    const r1 = { type: 'characterData', target: text(tok) }, r2 = { type: 'characterData', target: text(btn) }, r3 = { type: 'childList', target: box, addedNodes: [] }, r4 = { type: 'attributes', target: tok, attributeName: 'class' };
    assert.deepEqual(relevantRecords([r1, r2, r3, r4]), [r2, r3, r4]);
    assert.deepEqual(relevantRecords([r1, r1, r1]), []);
    const plain = [r3, r4]; assert.equal(relevantRecords(plain), plain, '버릴 것이 없으면 배열을 새로 만들지 않아요');
    assert.deepEqual(relevantRecords([{ type: 'characterData', target: { nodeType: 3, parentElement: null } }]), []);
});
console.log(`\n${passed} passed`);
