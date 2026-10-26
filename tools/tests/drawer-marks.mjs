// 7.9.9 속도 P3: src/icon-text.js 가 서랍 줄(div · form · label 그릇)에 다는 data-bl-row 표식이 옛 :has() 조건과 같은지 (가짜 DOM, 브라우저 없음)
//   node tools/tests/drawer-marks.mjs <테마 루트>
//   토큰 표는 src/icon-text.js 의 ROW_TOKENS. 여기서는 대표 조건과 경계(순서 · 첫째 · 바로 다음)를 확인하고,
//   CSS 에 옛 조각이 남아 있지 않은지 · 특이도 보정(:is(.bl-s, *) · :is(bl-s, *) · :is(#bl-s, *))이 조건별 특이도와 같은지 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
class El {
    constructor(tag, cls = '', children = [], attrs = {}) {
        this.localName = tag; const list = cls.split(/\s+/).filter(Boolean); this.classList = { contains: c => list.includes(c) }; this.children = children;
        this.attrs = attrs; this.id = attrs.id || ''; this.name = attrs.name || ''; this.type = attrs.type || '';
        for (const c of children) c.parentElement = this;
    }
    get firstElementChild() { return this.children[0] || null; }
    get childElementCount() { return this.children.length; }
    getAttribute(a) { return a in this.attrs ? this.attrs[a] : null; }
    hasAttribute(a) { return a in this.attrs; }
    matches(sel) { return sel.split(',').map(s => s.trim()).includes(this.localName); }
    querySelector(sel) { const want = sel.startsWith('#') ? e => e.id === sel.slice(1) : e => e.localName === sel; const walk = e => { for (const k of e.children) { if (want(k)) return k; const r = walk(k); if (r) return r; } return null; }; return walk(this); }
}
const el = (tag, cls, ...children) => new El(tag, cls, children);
const elA = (tag, cls, attrs, ...children) => new El(tag, cls, children, attrs);
const { rowTokens } = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);
const toks = e => rowTokens(e).split(' ').filter(Boolean).sort().join(' ');

await test('neo-range 줄 — small 첫째 + 슬라이더 + 입력 순서만(neo · sneo), label 이면 lneo · sneo', () => {
    const slider = () => el('input', 'neo-range-slider'), input = () => el('input', 'neo-range-input');
    assert.equal(toks(el('div', 'flex-container', el('small', ''), slider(), input())), 'neo slider sneo');
    assert.equal(toks(el('div', 'flex-container', el('small', ''), slider(), input(), el('small', ''))), 'neo slider sneo');
    assert.equal(toks(el('div', 'flex-container', el('label', ''), slider(), input())), 'lneo slider sneo');
    assert.equal(toks(el('div', 'flex-container', el('div', ''), el('small', ''), slider(), input())), 'slider');     // small 이 첫째가 아님
    assert.equal(toks(el('div', 'flex-container', el('div', ''), el('label', ''), slider(), input())), 'lneo slider'); // lneo 는 첫째가 아니어도 됨
});
await test('range-block 칸 — 제목+카운터(range) · 제목+숫자칸(num · numd) · 체크 줄(chk) · 제목(title)', () => {
    const title = () => el('div', 'range-block-title'), numIn = () => elA('input', '', { type: 'number' });
    assert.equal(toks(el('div', 'range-block', title(), el('div', 'range-block-range-and-counter'))), 'range title');
    assert.equal(toks(el('div', 'range-block', title(), el('div', 'toggle-description'), el('div', 'range-block-range-and-counter'))), 'title');   // 바로 다음이어야 range
    assert.equal(toks(el('div', 'range-block', title(), el('div', 'wide100p', numIn()))), 'num title');
    assert.equal(toks(el('div', 'range-block', title(), el('div', 'toggle-description'), el('div', 'wide100p', numIn()))), 'numd title');
    assert.equal(toks(el('div', 'range-block', title(), el('div', 'wide100p', numIn(), el('span', '')))), 'title');  // :only-child 아님
    assert.equal(toks(el('div', 'range-block', el('label', 'checkbox_label'), el('div', 'toggle-description'))), 'chk');
    assert.equal(toks(el('div', 'range-block', el('div', 'toggle-description'), el('label', 'checkbox_label'))), '');  // 첫째여야 chk
});
await test('select 줄 — sel · logic · pm · lsel · lsel2 · sel2 · f1sel · dsel(label 안 자손)', () => {
    assert.equal(toks(el('div', '', el('span', ''), el('select', ''))), 'lsel sel');
    assert.equal(toks(el('div', '', el('label', ''), el('select', ''))), 'lsel lsel2 sel');
    assert.equal(toks(el('div', '', el('label', ''), el('div', 'flex-container', el('select', '')))), 'sel2');
    assert.equal(toks(el('div', '', elA('select', '', { name: 'entryLogicType' }))), 'logic sel');
    assert.equal(toks(el('div', '', elA('select', '', { 'data-preset-manager-for': 'x' }))), 'pm sel');
    assert.equal(toks(el('div', 'flex-container', el('div', 'flex1', el('div', '', el('select', ''))))), 'f1sel');
    assert.equal(toks(el('label', '', el('span', '', el('select', '')))), 'dsel');
    assert.equal(toks(el('div', '', el('span', '', el('select', '')))), '');   // div 는 자손 select 를 보지 않음
});
await test('그 밖의 그릇 신호 — h4 · h4dep · soh · idr · odd · api · peer · smax · 아이디 칸', () => {
    assert.equal(toks(el('form', '', el('h4', ''))), 'h4');
    assert.equal(toks(el('div', 'flex-container', el('h4', '', elA('span', '', { 'data-i18n': '(DEPRECATED)' })))), 'h4 h4dep');
    assert.equal(toks(el('div', '', el('div', 'standoutHeader'))), 'soh');
    assert.equal(toks(el('div', 'range-block', el('div', 'inline-drawer'))), 'idr');
    assert.equal(toks(el('div', 'flex-container flexFlowColumn', el('div', 'oneline-dropdown'))), 'odd');
    assert.equal(toks(el('div', 'flex-container', el('div', 'api_button'))), 'api');
    assert.equal(toks(el('div', 'relative inline-block', elA('input', 'peer sr-only', { type: 'checkbox' }), el('label', ''))), 'peer');
    assert.equal(toks(el('div', '', el('small', ''), el('div', 'editor_maximize'))), 'smax');
    assert.equal(toks(el('div', '', elA('select', '', { id: 'instruct_names_behavior' }))), 'instr sel');
    assert.equal(toks(el('div', 'range-block', el('div', '', elA('input', '', { id: 'stream_toggle', type: 'checkbox' })))), 'stream');
    assert.equal(toks(el('div', 'flex flex-wrap', el('div', 'menu_button_icon', el('i', 'fa-folder-plus')))), 'fplus');
});
await test('CSS 에 옛 서랍 신호 :has 가 남아 있지 않음', () => {
    const OLD = [':has(> small:first-child + .neo-range-slider + .neo-range-input)', ':has(> .range-block-title + .range-block-range-and-counter)', ':has(> .range-block-title + .wide100p', ':has(> :is(small, label):first-child', ':has(> label + .neo-range-slider', ':has(> label.checkbox_label:first-child)', ':has(> label + .flex-container > select)', ':has(> :is(span, label) + select)', ':has(> label + select)', ':has(> select', ':has(select)', ':has(> input[type="number"])', ':has(> h4', ':has(> .range-block-title)', ':has(> .neo-range-slider)', ':has(> .inline-drawer)', ':has(> .standoutHeader)', ':has(> .oneline-dropdown)', ':has(> .api_button)', ':has(> .prompt_manager_prompt_controls)', ':has(> .bl-copyright)', ':has(> .salty-slider + .salty-slider)', ':has(> .menu_button_icon > .fa-folder-plus)', ':has(> small + .editor_maximize)', ':has(> input.peer.sr-only', ':has(> #instruct_names_behavior)', ':has(> #bl-response-range)', ':has(> #world_info_character_strategy)', ':has(> #regex_presets)', ':has(> #movingUIModeCheckBlock)', ':has(#oai_max_context_unlocked', ':has(#stream_toggle)', ':has(#openai_max_context)', ':has(#openai_max_tokens)', ':has(#n_openai)', ':has(#seed_openai)'];
    const left = [];
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css'))) {
        const t = fs.readFileSync(path.join(root, 'css', f), 'utf8');
        for (const o of OLD) if (t.includes(o)) left.push(`${f}: ${o}`);
    }
    assert.deepEqual(left, []);
});
await test('표식 선택자의 특이도 보정이 조건별 특이도와 같음', () => {
    // 토큰 → 보정 꼬리(옛 :has 안 조건의 특이도). where 로 감싼 것은 (0,0,n) · (1,0,0)
    const C = ':is(.bl-s, *)', T = ':is(bl-s, *)', I = ':is(#bl-s, *)';
    const want = { neo: C + C + T, sneo: C + C + T, lneo: C + T, range: C, num: C + C + C + T, chk: C + T, sel2: T + T, logic: T, subsel: T, pm: T, f1sel: T, numin: T, h4dep: T, title: '', slider: '', idr: '', soh: '', odd: '', api: '', pmc: '', copy: '', sl2: C, fplus: C, smax: T, peer: C + C + T + T };
    const wantWhere = { lsel: T + T, lsel2: T + T, sel: T, dsel: T, h4: T, instr: I, resp: I, wics: I, rxp: I, mui: I, 'oai-ctx-unl': I, stream: I, 'oai-ctx': I, 'oai-tok': I, 'n-openai': I, seed: I };
    let n = 0; const bad = [];
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css'))) {
        const t = fs.readFileSync(path.join(root, 'css', f), 'utf8');
        for (const m of t.matchAll(/(:where\()?(?::is\()?\[data-bl-row~="([\w-]+)"\]((?:, \[data-bl-row~="[\w-]+"\])*)\)?\)?((?::is\((?:\.|#)?bl-s, \*\))*)/g)) {
            n++; const tok = m[2]; const tail = m[4]; const where = !!m[1];
            if (tok === 'numd') continue;   // num 과 묶인 :is(...) 안
            const combined = !!m[3];                   // :is([num], [numd]) 묶음은 numd 의 (0,5,1)
            const w = where ? wantWhere[tok] : (tok === 'num' && combined ? C + C + C + C + T : want[tok]);
            if (w == null || tail !== w) bad.push(`${f}: ${m[0].slice(0, 90)} (바람 ${where ? 'where ' : ''}${w})`);
        }
    }
    assert.deepEqual(bad, []);
    assert.ok(n >= 150, `표식 쓰는 곳 ${n}`);
});
console.log(`\n${passed} passed`);
