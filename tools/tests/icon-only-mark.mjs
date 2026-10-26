// 7.9.9 속도 P2: src/icon-text.js 가 CSS :has() 대신 다는 표식이 조건과 하나씩 같은지 (가짜 DOM, 브라우저 없음)
//   node tools/tests/icon-only-mark.mjs <테마 루트>
//   data-bl-icon-only 토큰: i(요소 자식이 <i> 하나뿐) · svg(<svg> 하나뿐) · mbi(.menu_button_icon + 바로 아래 <i> + span/b/strong/small 없음)
//   data-bl-row-check: label 바로 아래 input[type=checkbox]
//   또 CSS 에 옛 :has 조건이 남아 있지 않고, 표식 선택자가 특이도 보정(:is(bl-s, *))과 함께 쓰였는지 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

class El {
    constructor(tag, cls = '', children = [], type = '') {
        this.localName = tag; this.classList = { contains: c => cls.split(/\s+/).includes(c) }; this.children = children; this.type = type;
        for (const c of children) c.parentElement = this;
    }
    get firstElementChild() { return this.children[0] || null; }
    get childElementCount() { return this.children.length; }
}
Object.defineProperty(El.prototype, 'nextElementSibling', { get() { const s = this.parentElement?.children || []; return s[s.indexOf(this) + 1] || null; } });

const mod = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);
const { iconOnlyTokens, hasCheckChild } = mod;
const i = () => new El('i', 'fa-solid fa-plus'), svg = () => new El('svg'), span = () => new El('span'), small = () => new El('small');

await test('아이콘만 단추 토큰 — :has 조건과 같음', () => {
    assert.equal(iconOnlyTokens(new El('div', 'menu_button', [i()])), 'i');
    assert.equal(iconOnlyTokens(new El('div', 'menu_button', [svg()])), 'svg');
    assert.equal(iconOnlyTokens(new El('div', 'menu_button', [i(), span()])), '');                       // 둘이면 only-child 아님
    assert.equal(iconOnlyTokens(new El('div', 'menu_button', [])), '');                                   // 글자만(글자 노드는 세지 않음 → 자식 0)
    assert.equal(iconOnlyTokens(new El('div', 'menu_button menu_button_icon', [i()])), 'i mbi');
    assert.equal(iconOnlyTokens(new El('div', 'menu_button menu_button_icon', [i(), small()])), '');       // small 이 있으면 mbi 아님
    assert.equal(iconOnlyTokens(new El('div', 'menu_button menu_button_icon', [i(), new El('b')])), '');
    assert.equal(iconOnlyTokens(new El('div', 'menu_button menu_button_icon', [i(), new El('div')])), 'mbi');  // div 는 글자 요소로 안 봄(:not(> span,> b,> strong,> small))
    assert.equal(iconOnlyTokens(new El('div', 'menu_button menu_button_icon', [span()])), '');
});
await test('체크 줄 label 표식', () => {
    assert.equal(hasCheckChild(new El('label', 'checkbox_label', [new El('input', '', [], 'checkbox'), span()])), true);
    assert.equal(hasCheckChild(new El('label', 'checkbox_label', [new El('input', '', [], 'radio')])), false);
    assert.equal(hasCheckChild(new El('label', '', [new El('span', '', [new El('input', '', [], 'checkbox')])])), false);   // 손자는 아님(> 만)
});
await test('CSS 에 옛 범용 :has 조건이 남아 있지 않음', () => {
    const files = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css'));
    const left = [];
    for (const f of files) {
        const t = fs.readFileSync(path.join(root, 'css', f), 'utf8');
        for (const re of [/\.menu_button[^{]*:has\(> i:only-child\)/, /\.menu_button[^{]*:has\(> svg:only-child\)/, /\.menu_button_icon:has\(> i\)/, /\blabel(\.checkbox_label)?:has\(> input\[type="?checkbox"?\]\)(?!:has)/]) {
            const m = re.exec(t); if (m && !/fruit-heart/.test(t.slice(Math.max(0, m.index - 400), m.index))) left.push(`${f}: ${m[0].slice(0, 80)}`);   // 과일의 마음(#fruit-heart-v6)은 body 밖(body ~ #fruit-heart-v6)이라 관찰자가 못 보니 :has 그대로
        }
    }
    assert.deepEqual(left, [], '아직 :has 로 고르는 곳이 있어요 — data-bl-icon-only · data-bl-row-check 로');
});
await test('표식 선택자는 특이도 보정과 함께 (mbi 는 (0,1,2) · 체크 줄은 (0,1,1))', () => {
    const files = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css'));
    let mbi = 0, row = 0;
    for (const f of files) {
        const t = fs.readFileSync(path.join(root, 'css', f), 'utf8');
        for (const m of t.matchAll(/\[data-bl-icon-only~="mbi"\]((?::is\(bl-s, \*\))*)/g)) { mbi++; assert.equal(m[1], ':is(bl-s, *):is(bl-s, *)', `${f}: ${m[0]}`); }
        for (const m of t.matchAll(/\[data-bl-row-check\]((?::is\(bl-s, \*\))*)/g)) { row++; assert.equal(m[1], ":is(bl-s, *)", `${f}: ${m[0]}`); }
    }
    assert.ok(mbi >= 14 && row >= 5, `표식 쓰는 곳 mbi ${mbi} · 체크 줄 ${row}`);
});
console.log(`\n${passed} passed`);
