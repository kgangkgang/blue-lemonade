// 1.1.6 CSS 줄이기 첫 걸음 — 뗀 규칙(tools/css-gates.cjs · 기준 tools/css-gates.json)이 덮어쓰기 차례를 바꾸지 않는지 규칙마다 다시 세어요.
//   ① 기준: gates 의 클래스는 기본값에서 꺼진 설정이고 그 설정일 때만 붙어요(원본 글로 증명) · 뗀 규칙은 모든 갈래가 그 클래스를 요구해요 · 설정 창 규칙은 .salty-panel 안에서만 맞아요
//   ② 생성물: 디스크의 시트 · 표가 지금 빌드와 같고, 첫 장 · 전체 장에는 뗀 규칙이 하나도 없어요(남은 규칙은 원래 차례 그대로)
//   ③ 차례(가장 중요): 원래 차례(미리보기 · 호환을 떼기 전 펼친 글)에서 두 규칙이 「같은 요소에 맞을 수 있고 · 같은 속성 묶음 · 같은 !important · 같은 특이도 · 선언 글이 다름」이면
//      브라우저가 보는 마지막 차례(남은 규칙 → 미리보기 시트 → 켜짐 시트들 → 설정 창 시트)에서도 앞뒤가 같아야 해요. 뗀 규칙이 낀 짝은 전부 세요.
//      (계산은 이 시험 안에서 따로 해요 — 도구의 판정을 그대로 믿지 않게. 화면 뿌리 구분(채팅 ↔ 설정 창 · 미리보기)만 기준 파일의 것을 써요)
//   ④ 붙이는 코드: 클래스보다 시트가 먼저 · 설정 창은 시트를 받은 뒤 · 자리는 테마 시트 뒤 줄 안
//   node tools/tests/css-gates-order.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(path.join(root, 'tools/'));
const B = require(path.join(root, 'tools/build-css.cjs'));
const G = require(path.join(root, 'tools/css-gates.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
const P = require(path.join(root, 'tools/css-park.cjs'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const readOr = rel => (fs.existsSync(path.join(root, rel)) ? read(rel) : null);
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 10).join('\n       ')); } };

const cfg = G.loadConfig(path.join(root, 'tools/css-gates.json'));
G.setRoots(cfg);
const out = B.build(B.CSS_DIR);
const SENT = '#salty-lazy-panel-start {}';
const headOf = text => { const at = text.lastIndexOf(SENT); return at >= 0 ? text.slice(0, at) : text; };
const rulesOf = text => L.flatRules(L.parse(text));
const kb = n => `${(n / 1024).toFixed(1)}KB`;

test('① 기준 파일: gates 마다 기본값 꺼짐 · 그 설정일 때만 붙음이 원본 글에 있어요', () => {
    assert.ok(cfg.gates.length >= 5);
    for (const g of cfg.gates) {
        assert.ok(g.class || g.prefix, '클래스나 접두사');
        assert.ok(g.proof?.length >= 2, `${g.class || g.prefix}: 증명 둘(기본값 · 붙는 자리)`);
        for (const [file, re] of g.proof) assert.match(read(file), new RegExp(re), `${g.class || g.prefix}: ${file} 에 /${re}/`);
    }
    // 이름을 다 적은 클래스는 apply.js 말고는 달지 않아요(글자로 쓰는 곳이 없어요)
    const files = fs.readdirSync(path.join(root, 'src'), { recursive: true }).map(String).filter(f => f.endsWith('.js') && !f.endsWith('.gen.js') && path.basename(f) !== 'apply.js');
    for (const g of cfg.gates.filter(x => x.class)) {
        const lit = new RegExp(`['"\`]${g.class}['"\`]|classList\\.(?:add|toggle)\\([^)]*${g.class}`);
        const hits = files.filter(f => lit.test(read('src/' + f.split(path.sep).join('/'))));
        assert.deepEqual(hits, [], `${g.class} 를 다는 다른 파일`);
    }
});

test('② 생성물: 시트 · 표가 지금 빌드와 같아요', () => {
    for (const [file, want] of Object.entries(out.gateFiles)) assert.equal(readOr(file), want, `${file} — node tools/build-css.cjs 로 다시 만들 것`);
    assert.equal(read('style.css'), out.text);
    assert.equal(read('src/style-lazy.gen.css'), out.lazyText);
});

const groups = out.gates.groups;
const movedKeys = out.gates.moved;
test('② 뗀 규칙: 켜짐 시트는 모든 갈래가 gates 클래스를 요구 · 설정 창 시트는 .salty-panel 안에서만', () => {
    const md = groups.find(g => g.id === 'md'), outline = groups.find(g => g.id === 'outline'), panel = groups.find(g => g.kind === 'panel');
    assert.ok(md.rules.length >= 60, `마크다운 ${md.rules.length}`);
    assert.ok(outline.rules.length >= 2 && outline.rules.some(r => r.selector.length > 50000), '글자 외곽선의 긴 선택자 규칙');
    assert.ok(panel.rules.length >= 100, `설정 창 ${panel.rules.length}`);
    for (const g of groups) {
        const text = readOr(g.out);
        if (!g.rules.length) { assert.equal(text, null, `${g.out} 는 비어서 없어요`); continue; }
        const rules = rulesOf(text);
        assert.equal(rules.length, g.rules.length, g.out);
        for (const r of rules) {
            if (g.kind === 'panel') assert.ok(G.panelOnly(r.selector, cfg.panel.root), `설정 창 밖에서도 맞을 수 있어요: ${r.selector.slice(0, 100)}`);
            else {
                const t = G.ruleTriggers(r.selector, cfg.eligible);
                assert.ok(t, `gates 를 안 요구하는 갈래: ${r.selector.slice(0, 100)}`);
                const sheet = cfg.sheets.find(s => s.id === g.id);
                if (!sheet.prefixes.includes('*')) for (const c of t) assert.ok(sheet.classes.includes(c) || sheet.prefixes.some(p => c.startsWith(p)), `${g.id} 시트에 다른 켜는 클래스 ${c}`);
            }
        }
    }
    // 실행 중 표: 시트마다 켜는 클래스가 뗀 규칙의 것을 다 담아요
    const table = read(B.GATE_TABLE);
    for (const g of groups.filter(x => x.kind === 'gate' && x.rules.length)) {
        const row = JSON.parse(/export const GATE_SHEETS = (\[.*\]);/.exec(table)[1]).find(x => x.id === g.id);
        for (const c of g.trig) assert.ok(row.classes.includes(c) || row.prefixes.some(p => c.startsWith(p)), `표에 ${c}`);
        assert.equal(row.file, `./${path.basename(g.out)}`);
    }
});

test('② 첫 장 · 전체 장에는 뗀 규칙이 없고, 남은 규칙은 원래 차례 그대로예요', () => {
    for (const [name, text] of [['style.css', out.text], ['style-lazy.gen.css', out.lazyText]]) {
        const head = headOf(text);
        const left = rulesOf(head).filter(r => movedKeys.has(G.keyOf(head, r)));
        assert.deepEqual(left.map(r => r.selector.slice(0, 80)), [], `${name} 에 남은 뗀 규칙`);
    }
    // 전체 장(데우스 칸 나누기 전) = 원래 전체 장에서 뗀 규칙만 빠진 것
    const full = out.gateInput.full, fh = headOf(full);
    const stripped = rulesOf(headOf(G.strip(full, movedKeys).text)).map(r => r.selector);
    const expect = rulesOf(fh).filter(r => !movedKeys.has(G.keyOf(fh, r))).map(r => r.selector);
    assert.deepEqual(stripped, expect);
});

// ③ 차례 — 이 시험 안의 계산
test('③ 뗀 규칙이 낀 모든 겨루기 짝의 앞뒤가 원래와 같아요(규칙마다 원래 자리 순서 보존)', () => {
    const { order, full } = out.gateInput;
    const oHead = headOf(order.expanded), O = rulesOf(oHead);
    const fHead = headOf(full), F = rulesOf(fHead);
    // 호환 시트로 간 규칙(미리보기만 뗀 글 − 둘 다 뗀 글)
    const keysOf = text => { const h = headOf(text); return rulesOf(h).map(r => G.keyOf(h, r)); };
    const left = new Map(); for (const k of keysOf(order.compatText)) left.set(k, (left.get(k) || 0) + 1);
    const compat = new Map(); for (const k of keysOf(order.parkText)) { if (left.get(k)) left.set(k, left.get(k) - 1); else compat.set(k, (compat.get(k) || 0) + 1); }
    // 마지막 자리: [묶음, 묶음 안 차례]
    const nGate = cfg.sheets.length;
    const groupOfKey = new Map();
    groups.forEach((g, gi) => { const t = readOr(g.out) || ''; rulesOf(t).forEach((r, k) => groupOfKey.set(G.keyOf(t, r), [g.kind === 'panel' ? 2 + nGate : 2 + gi, k])); });
    const pos = new Array(O.length);
    let f = 0, previewSeen = 0, rest = 0;
    const kind = new Array(O.length);
    O.forEach((r, i) => {
        if (P.previewOnly(r.selector)) { pos[i] = [1, previewSeen++]; kind[i] = 'preview'; return; }
        const k = G.keyOf(oHead, r);
        if (compat.get(k)) { compat.set(k, compat.get(k) - 1); kind[i] = 'compat'; return; }
        const fin = F[f++];
        assert.equal(r.decls.map(d => d.lname).join(), fin.decls.map(d => d.lname).join(), `차례 글 ↔ 전체 장 ${f - 1}`);
        const fk = G.keyOf(fHead, fin);
        if (movedKeys.has(fk)) { pos[i] = groupOfKey.get(fk); kind[i] = 'moved'; assert.ok(pos[i], `뗀 규칙이 시트에 없어요: ${fin.selector.slice(0, 80)}`); }
        else { pos[i] = [0, rest++]; kind[i] = 'stay'; }
    });
    assert.equal(f, F.length);
    // 묶음 안 차례가 원래 차례와 같은가
    const byGroup = new Map();
    O.forEach((r, i) => { if (kind[i] === 'moved') { const g = pos[i][0]; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(pos[i][1]); } });
    for (const [g, list] of byGroup) assert.deepEqual(list, [...list].sort((a, b) => a - b), `시트 ${g} 안 차례`);
    // 겨루기: 속성 묶음 · !important · 특이도로 모으고, 같은 요소에 맞을 수 있는 짝만
    const decls = r => r.decls.filter(d => !d.nested);
    const famSig = (r, fam, imp) => decls(r).filter(d => L.family(d.lname) === fam && d.important === imp).map(d => `${d.lname}:${d.value.replace(/\s+/g, ' ')}`).join(';');
    const idx = new Map();
    const branchesOf = O.map(r => L.topSplit(r.selector).map(b => ({ b, s: L.spec(b).join() })));
    O.forEach((r, i) => {
        for (const d of decls(r)) for (const { b, s } of branchesOf[i]) {
            const key = `${L.family(d.lname)}|${d.important}|${s}`;
            if (!idx.has(key)) idx.set(key, []);
            idx.get(key).push([i, b]);
        }
    });
    const before = (a, b) => (pos[a][0] - pos[b][0]) || (pos[a][1] - pos[b][1]);
    let pairs = 0;
    const bad = [];
    O.forEach((r, m) => {
        if (kind[m] !== 'moved') return;
        const seen = new Set();
        for (const d of decls(r)) for (const { b, s } of branchesOf[m]) {
            const fam = L.family(d.lname);
            const keys = fam === '*' ? [...idx.keys()].filter(k => k.endsWith(`|${d.important}|${s}`) && !k.startsWith('--')) : [`${fam}|${d.important}|${s}`, ...(fam.startsWith('--') ? [] : [`*|${d.important}|${s}`])];
            for (const key of keys) for (const [x, bx] of idx.get(key) || []) {
                if (x === m || seen.has(x)) continue;   // 한 짝은 한 번만(갈래 하나라도 겨루면 짝)
                const xf = key.split('|')[0];
                if (fam !== '*' && xf !== '*' && famSig(r, fam, d.important) === famSig(O[x], fam, d.important)) continue;   // 글자까지 같은 선언은 누가 이겨도 같아요
                if (L.disjoint(b, bx) || G.apart(b, bx)) continue;
                seen.add(x); pairs++;
                if (kind[x] === 'compat') { bad.push(`호환 규칙과 겨룸: ${r.selector.slice(0, 90)} ↔ ${O[x].selector.slice(0, 90)}`); continue; }
                const was = m < x, now = before(m, x) < 0;
                if (was !== now) bad.push(`[${d.lname}] ${r.selector.slice(0, 100)}\n         ↔ ${O[x].selector.slice(0, 100)}`);
            }
        }
    });
    console.log(`       (뗀 규칙 ${kind.filter(k => k === 'moved').length}개가 낀 겨루기 짝 ${pairs}개 — 앞뒤가 모두 그대로)`);
    assert.deepEqual(bad.slice(0, 12), []);
});

test('④ 붙이는 코드: 클래스보다 시트가 먼저 · 설정 창은 시트를 받은 뒤 · 자리는 테마 시트 뒤 줄 안', () => {
    const apply = read('src/apply.js'), lite = read('src/lite.js'), gate = read('src/gate-css.js'), index = read('index.js'), sheet = read('src/theme-sheet.js'), compat = read('src/compat-css.js'), split = read('src/split-css.js'), first = read('src/first-run.js');
    assert.match(apply, /const held = syncGateCss\(want\);(?:\s*\/\/[^\n]*)*\s*const cls = document\.body\.classList;/, 'body 클래스를 바꾸기 전에 시트');
    assert.match(apply, /const missing = \[\.\.\.want\]\.filter\(c => !cls\.contains\(c\) && !held\.has\(c\)\);/, '못 받은 시트의 클래스는 미뤄요');
    assert.match(gate, /own\.addEventListener\('load', \(\) => \{ own\.dataset\.blGateReady = '1'; settle\(\); \}/, '받은 뒤에 미룬 클래스를 달아요');
    assert.match(gate, /if \(n\.dataset\?\.blGate != null && Number\(n\.dataset\.blGate\) > order\) break;/, '테마 시트 뒤 줄 안 차례 자리');
    assert.match(lite, /export function themeRunEnd\(node, order = Infinity\)/);
    assert.match(lite, /link\.dataset\.blGate = '-1';/, '미리보기는 테마 시트 뒤 줄 맨 앞 칸');
    assert.match(lite, /if \(sheet\?\.ownerNode\?\.isConnected\) themeRunEnd\(sheet\.ownerNode, -1\)\.after\(link\);/, '미리보기는 뗀 규칙 시트 앞');
    assert.match(lite, /sheetTail\(sheet\)\.after\(style\);/, '서랍 전용 칸(첫 장 꼬리)은 줄 끝 뒤');
    assert.match(lite, /const gateLoad = \(\) => import\('\.\/gate-css\.js'\)/, '몸통은 켤 때만 받아요(시작 묶음 밖)');
    assert.doesNotMatch(lite, /^import [^\n]*gate-css\.js/m);
    assert.match(index, /const loadPanel = \(\) => panelLoading \|\|= Promise\.all\(\[import\('\.\/src\/panel\.js'\), panelCssReady\(\)\]\)/, '설정 창은 시트를 받은 뒤에 만들어요');
    assert.match(first, /m\.panelCssReady\(\)/, '첫 실행 창도');
    assert.doesNotMatch(sheet, /salty-md-css/, '전체 장이 켜져도 마크다운 시트를 끄지 않아요(규칙이 전체 장에 없어요)');
    assert.match(compat, /n\.dataset\?\.blGate != null\); n = n\.nextElementSibling\) base = n;/, '호환 시트도 줄 끝 뒤');
    assert.match(split, /n\.dataset\?\.blGate != null\); n = n\.nextElementSibling\) end = n;\s+end\.after\(panel\);/, '서랍 전용 칸도 미리보기 · 뗀 규칙 시트 뒤');
});

// 크기 보고(실패하지 않아요)
{
    const size = t => Buffer.byteLength(t || '');
    console.log(`       첫 장 ${kb(size(out.text))} · 전체 장 ${kb(size(out.lazyText))} · ${groups.filter(g => g.rules.length).map(g => `${path.basename(g.out)} ${g.rules.length}개 ${kb(size(out.gateFiles[g.out]))}`).join(' · ')} · 차례 때문에 남긴 규칙 ${out.gates.kept.length}개(${kb(out.gates.kept.reduce((a, k) => a + k.bytes, 0))})`);
}
test('CI 에 이 시험', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/css-gates-order\.mjs \./));

console.log(`css-gates-order: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
