// 태번 헬퍼 업데이트 창 번역 — 원문 대신 지문 표(원작 조건 정리 · 1.2.4 뒤)
//   node tools/tests/helper-notice-prints.mjs <테마 루트>
// 태번 헬퍼(JS-Slash-Runner)는 PolyForm Noncommercial 1.0.0 이라 그 변경 기록 원문을 AGPL 파일(korean.js)에 두지 않아요.
// 이 시험의 중국어 글은 시험용으로 지어낸 글이에요(원작 문구 아님).
//   ① korean.js(원본 · 내장본) 업데이트 창 칸에 한자 0 · 표 모양 · 아는 태번 헬퍼 판 4.10.0 ~ 4.12.1 · 원본과 내장본 표가 같음
//   ② 도구(tools/helper-notice-prints.mjs)가 korean.js 의 지문 함수를 그대로 써요 · 짝 → 표 → 글 → 다시 읽기가 같음 · 짝 오류를 잡음
//   ③ 지어낸 변경 기록 창: 머리 · 문단 · code 예시 · pre 주석/문자열이 번역되고, 한 글자 다른 문단 · sign 없는 칸 · 모르는 판은 그대로
//   ④ (있을 때만) BL_HELPER_NOTICE_PAIRS 에 원문 짝(저장소 밖)을 주면 korean.js 표가 그 짝에서 만든 것과 같은지
//   ⑤ 고지(THIRD-PARTY-NOTICES · 출처 창)가 「변경 기록은 원문 대신 지문 + 우리 번역」과 맞고, 배포 사본(dist/plain/korean.js)에도 한자 0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const tool = await import(pathToFileURL(path.join(root, 'tools/helper-notice-prints.mjs')).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('tools/scripts-src/korean.js'), bundled = read('src/scripts/plain/korean.js');
const HAN = /\p{Script=Han}/u, PRINT = /^[0-9a-z]{1,12}$/;
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const section = text => {
    const a = text.indexOf('// Helper release notes'), b = text.indexOf('// 헬퍼 창 감시도 하나');
    assert.ok(a > 0 && b > a, '업데이트 창 칸 표시(// Helper release notes … // 헬퍼 창 감시도 하나)');
    return text.slice(a, b);
};

test('① 업데이트 창 칸에 한자가 하나도 없어요(원본 · 내장본) · 내장본 전체에도 한자 0', () => {
    for (const [name, text] of [['원본', source], ['내장본', bundled]]) {
        const lines = section(text).split('\n').map((line, i) => [i, line]).filter(([, line]) => HAN.test(line));
        assert.deepEqual(lines, [], `${name} 업데이트 창 칸의 한자 줄`);
    }
    assert.ok(!HAN.test(bundled), '내장본 korean.js 에 한자(사전은 따로 · 업데이트 창은 지문)');
});

test('① 표 모양: 지문 열쇠 · 번역은 글 · pre 는 [길이, 지문, 번역] · 아는 태번 헬퍼 판 4.10.0 ~ 4.12.1 · 원본 = 내장본', () => {
    const tables = tool.readTables(source);
    assert.deepEqual(tool.readTables(bundled), tables, '원본과 내장본 표가 같아요');
    assert.ok(tables.headings.length >= 14, String(tables.headings.length));
    for (const [print, ko] of tables.headings) { assert.match(print, PRINT); assert.equal(typeof ko, 'string'); }
    for (const version of ['4.12.1', '4.12.0', '4.11.3', '4.11.2', '4.11.1', '4.11.0', '4.10.0']) assert.ok(tables.notices[version], version);
    for (const [version, n] of Object.entries(tables.notices)) {
        assert.match(version, /^\d+\.\d+\.\d+$/); assert.match(n.sign, PRINT, version);
        assert.ok(n.blocks.length >= 1, version);
        for (const [print, ko] of n.blocks) { assert.match(print, PRINT); assert.ok(Array.isArray(ko) && ko.every(t => typeof t === 'string' && !HAN.test(t)), version); }
        for (const [print, ko] of n.code || []) { assert.match(print, PRINT); assert.ok(typeof ko === 'string' && !HAN.test(ko)); }
        for (const [length, print, ko] of n.pre || []) { assert.ok(Number.isInteger(length) && length > 0); assert.match(print, PRINT); assert.ok(typeof ko === 'string' && !HAN.test(ko)); }
    }
});

// ── 내장본의 업데이트 창 코드(지문 함수 · 표 · 번역 함수)를 그대로 잘라 작은 가짜 DOM 위에서 돌려요
class Text { constructor(v) { this.nodeType = 3; this.nodeValue = v; this.parentElement = null; } get textContent() { return this.nodeValue; } }
class El {
    constructor(tag, kids = []) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; for (const k of kids) this.append(k); }
    append(k) { if (typeof k === 'string') k = new Text(k); k.parentElement = this; this.children.push(k); return k; }
    get textContent() { return this.children.map(c => c.textContent).join(''); }
    get nextElementSibling() { const s = this.parentElement?.children.filter(c => c.nodeType === 1) || []; return s[s.indexOf(this) + 1] || null; }
    matches(sel) { return sel.split(',').map(s => s.trim().toUpperCase()).includes(this.tagName); }
    closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches(sel)) return e; return null; }
    contains(n) { for (let e = n; e; e = e.parentElement) if (e === this) return true; return false; }
    *texts() { for (const c of this.children) { if (c.nodeType === 3) yield c; else yield* c.texts(); } }
    *els() { for (const c of this.children) if (c.nodeType === 1) { yield c; yield* c.els(); } }
    querySelectorAll(sel) { return [...this.els()].filter(e => e.matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
const doc = { createTreeWalker(rootEl) { const it = rootEl.texts(); return { currentNode: null, nextNode() { const n = it.next(); this.currentNode = n.done ? null : n.value; return !n.done; } }; } };
const host = { NodeFilter: { SHOW_TEXT: 4 } };
function runtime(text, tablesText = null) {
    const a = text.indexOf('  const helperObservers=new Map();'), b = text.indexOf('  // 헬퍼 창 감시도 하나');
    let body = text.slice(a, b);
    if (tablesText !== null) body = tool.writeTables(body, tablesText);
    const norm = text.match(/function normalize\(text\) \{[\s\S]*?\n {2}\}/)[0];
    // swapText 흉내: 번역 글 앞뒤에 원문의 앞뒤 공백을 다시 붙여요(korean.js swapText 와 같은 규칙)
    const swapText = (node, lookup) => { const before = node.nodeValue, t = lookup(before); if (t === null) return; const w = before.match(/^(\s*)[\s\S]*?(\s*)$/); node.nodeValue = w[1] + t + w[2]; };
    return new Function('swapText', 'doc', 'host', `${norm}\n${body}\nreturn { processHelperNotice, noticePrint };`)(swapText, doc, host);
}

test('② 도구의 지문 함수 · normalize 는 korean.js 의 것과 같은 값', () => {
    const fns = tool.readFunctions(source), live = runtime(bundled);
    for (const sample of ['', 'a', '试验用的句子', '  여러  칸   ', 'x'.repeat(300), '["新加了","试验"]']) assert.equal(fns.noticePrint(sample), live.noticePrint(sample), JSON.stringify(sample));
    assert.match(fns.noticePrint('试验'), PRINT);
    assert.equal(fns.normalize('  ａ　b\n c  '), 'a b c');
});

const pairs = {
    headings: [['🧪测验', '🧪 시험']],
    notices: {
        '9.8.7': {
            sign: 'fakeSignFn',
            blocks: [[['新加了', '这个用来试验的函数。'], ['새로', '시험용 함수를 더했어요.']], [['例子'], ['예']]],
            code: [['示例值: 1/2', '예시 값: 1/2']],
            pre: [['// 拿到试验数据', '// 시험 자료 가져오기'], ['试验', '시험']],
        },
    },
};
const fns = tool.readFunctions(source);
const synthetic = tool.noticeTables(pairs, fns);

test('② 짝 → 표 → 글 → 다시 읽기가 같아요 · 짝 오류(조각 수 · 번역 속 한자 · 한자 없는 pre)를 잡아요', () => {
    assert.deepEqual(synthetic.problems, []);
    const text = tool.renderTables(synthetic);
    assert.ok(!HAN.test(text), '만든 표 글에 한자');
    const wrapped = `x\n  ${tool.START}\n  ${tool.END}\ny`;
    assert.deepEqual(tool.readTables(tool.writeTables(wrapped, text)), { headings: synthetic.headings, notices: synthetic.notices });
    assert.equal(tool.writeTables(tool.writeTables(wrapped, text), text), tool.writeTables(wrapped, text), '두 번 써도 같아요');
    const bad = tool.noticeTables({ notices: { '1.2.3': { sign: 's', blocks: [[['甲', '乙'], ['하나']], [['丙'], ['丁']]], pre: [['abc', '가']] } } }, fns);
    assert.equal(bad.problems.length, 3, bad.problems.join(' / '));
});

const run = runtime(bundled, tool.renderTables(synthetic)).processHelperNotice;
const section1 = () => [
    new El('h2', ['9.8.7']),
    new El('h3', ['🧪测验']),
    new El('ul', [
        new El('li', ['新加了 ', new El('code', ['fakeSignFn']), ' 这个用来试验的函数。']),
        new El('li', ['例子 ', new El('code', ['示例值: 1/2'])]),
        new El('li', ['新加了 ', new El('code', ['fakeSignFn']), ' 这个用来试验的函数!']),
        new El('li', [new El('pre', [new El('code', [new El('span', ['// 拿到试验数据']), "\nconst x = get('", new El('span', ['试验']), "');\n// 试验 again 试验\n"])])]),
    ]),
];

test('③ 아는 판 · sign 있음: 머리 · 문단 · code 예시 · pre 가 번역되고 한 글자 다른 문단은 그대로', () => {
    const popup = new El('div', section1());
    run(popup);
    const [h2, h3, ul] = popup.children, [li1, li2, li3, li4] = ul.children;
    assert.equal(h2.textContent, '9.8.7');
    assert.equal(h3.textContent, '🧪 시험');
    assert.deepEqual(li1.children.map(c => c.textContent), ['새로 ', 'fakeSignFn', ' 시험용 함수를 더했어요.']);
    assert.deepEqual(li2.children.map(c => c.textContent), ['예 ', '예시 값: 1/2']);
    assert.equal(li3.textContent, '新加了 fakeSignFn 这个用来试验的函数!', '한 글자 다른 문단은 원문 그대로');
    assert.equal(li4.textContent, "// 시험 자료 가져오기\nconst x = get('시험');\n// 시험 again 시험\n", 'pre: 차례대로 · 여러 자리 · 다른 마디');
    const again = popup.textContent; run(popup); assert.equal(popup.textContent, again, '두 번 불러도 같아요');
});

test('③ sign 이 없는 칸 · 모르는 판은 그대로', () => {
    const noSign = new El('div', section1());
    noSign.querySelectorAll('code').forEach(code => { if (code.textContent === 'fakeSignFn') code.children[0].nodeValue = 'otherFn'; });
    const before = noSign.textContent; run(noSign); assert.equal(noSign.textContent, before, 'sign 없음');
    const unknown = new El('div', section1()); unknown.children[0].children[0].nodeValue = '9.8.6';
    const before2 = unknown.textContent; run(unknown); assert.equal(unknown.textContent, before2, '모르는 판');
});

test('③ 두 판이 한 창에 있으면 칸마다 따로(다음 판 제목에서 멈춰요)', () => {
    const popup = new El('div', [...section1(), new El('h2', ['9.8.6']), new El('h3', ['🧪测验']), new El('ul', [new El('li', ['新加了 ', new El('code', ['fakeSignFn']), ' 这个用来试验的函数。'])])]);
    run(popup);
    const tail = popup.children.slice(-2).map(e => e.textContent);
    assert.deepEqual(tail, ['🧪测验', '新加了 fakeSignFn 这个用来试验的函数。']);
    assert.equal(popup.children[1].textContent, '🧪 시험');
});

test('④ (있을 때만) 저장소 밖 원문 짝으로 만든 표 = korean.js 표', () => {
    const file = process.env.BL_HELPER_NOTICE_PAIRS;
    if (!file || !fs.existsSync(file)) { console.log('       건너뜀 — BL_HELPER_NOTICE_PAIRS 없음(원문 짝은 저장소 밖에만 있어요)'); return; }
    const real = tool.noticeTables(JSON.parse(fs.readFileSync(file, 'utf8')), fns);
    assert.deepEqual(real.problems, []);
    assert.deepEqual(tool.readTables(source), { headings: real.headings, notices: real.notices });
});

test('⑤ 고지가 지문 방식과 맞아요 · 배포 사본에도 원문 0', () => {
    const notices = read('THIRD-PARTY-NOTICES.md').split(/\r?\n/).find(line => line.includes('JS-Slash-Runner') && line.includes('PolyForm'));
    assert.ok(notices, 'THIRD-PARTY-NOTICES 의 태번 헬퍼 줄');
    assert.match(notices, /src\/scripts\/plain\/helper\.js/, '원작 문구가 든 사전 파일은 helper.js 하나');
    assert.match(notices, /4\.10\.0 ~ 4\.12\.1/, '변경 기록 판 범위');
    assert.match(notices, /원작 문구를 담지 않아요/);
    assert.match(notices, /src\/scripts\/plain\/korean\.js/);
    assert.match(notices, /지문/);
    const credits = read('src/credits.js');
    assert.match(credits, /변경 내역의 원작 문구는 담지 않습니다/, '출처 창');
    assert.match(credits, /원문 대신 지문/, '출처 창');
    assert.doesNotMatch(credits, /변경 내역 문구는 담지 않습니다/, '옛 출처 창 글(번역이 있는데 「안 담음」만 적던 것)');
    const distFile = path.join(root, 'dist/plain/korean.js');
    if (fs.existsSync(distFile)) assert.ok(!HAN.test(fs.readFileSync(distFile, 'utf8')), 'dist/plain/korean.js 에 한자');
});

console.log(`helper-notice-prints: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
