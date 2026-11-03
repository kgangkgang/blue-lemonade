#!/usr/bin/env node
// 애드온 CSS 한 장 전후 비교 (9.0.9) — tools/css-cascade-diff.mjs
//
// 「전」 = addons.js 가 예전처럼 애드온마다 <link> 를 붙였을 때 브라우저가 읽는 규칙들(시작 순서 · 시트 앞머리 @import 는 제자리에 먼저),
// 「후」 = src/addons/style-addons.css 한 장. 둘을 같은 방식으로 읽어(주석 · 공백 정리, 상대 url() 은 저장소 경로로 풀어) 두 가지를 봐요.
//   1) 선택자별 최종 선언: (감싼 @media · @supports · @container 줄, 선택자, 속성) 마다 폭포에서 이기는 값(!important 먼저, 같으면 나중 것)이
//      전후 같은가 — 애드온별(그 규칙이 처음 나온 시트의 애드온)로 세어 보여요
//   2) 규칙 순서: 「후」의 규칙 줄이 「전」에서 뒤에 똑같은 규칙이 또 있는 앞 규칙만 뺀 줄과 하나하나 같은가 — 순서가 바뀌면 다른 선택자끼리의 승부가 달라질 수 있어서
//      (@font-face · @keyframes · @property 같은 통째 규칙도 이 줄에 같이 들어가요)
// build-addon-css.mjs 의 펼치기를 쓰지 않고 따로 읽어요(같은 실수를 같이 하지 않게). 차이가 하나라도 있으면 종료 코드 1.
//   node tools/css-cascade-diff.mjs [저장소] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || '.');
const lib = require(path.join(root, 'tools/css-lib.cjs'));
const { ADDON_STYLE_IDS, ADDON_STYLE_BUNDLE } = await import(pathToFileURL(path.join(root, 'src/addon-style-bundle.js')).href);
const { PRIVATE_ADDONS } = await import(pathToFileURL(path.join(root, 'src/private-addons.js')).href);

// ── 값 정리: 주석 빼기(토큰 사이면 공백 하나) · 문자열 밖 공백 한 칸 · 상대 url() → 저장소 경로 ──
function tidy(s) {
    let out = '';
    let i = 0;
    let space = false;
    const put = (t) => { if (space && out && !/[\s(,]$/.test(out)) out += ' '; space = false; out += t; };
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') { const e = lib.endComment(s, i); const prev = out[out.length - 1]; const next = s[e]; if (prev && next && /[\w-]/.test(prev) && /[\w-]/.test(next)) put('/**/'); i = e; continue; }
        if (c === '"' || c === "'") { const e = lib.endString(s, i); put(s.slice(i, e)); i = e; continue; }
        if (/\s/.test(c)) { space = true; i++; continue; }
        if (c === '\\') { put(s.slice(i, i + 2)); i += 2; continue; }
        if (c === ')' || c === ',') space = false;
        put(c);
        i++;
    }
    return out.trim();
}
const urls = (value, file) => value.replace(/url\(\s*(['"]?)([^'")]*?)\1\s*\)/g, (all, q, u) => (/^(data:|https?:|\/|#|var\()/i.test(u) || !u ? all : `url("${path.posix.normalize(path.posix.join(path.posix.dirname(file), u))}")`));

// ── 한 시트 읽기 → 규칙 줄 [{ key, kind, ctx, sel, decls, id, file }] ──
function readSheet(file, id, out, stack = []) {
    if (stack.includes(file)) throw new Error(`@import 고리 ${file}`);
    const css = fs.readFileSync(path.join(root, file), 'utf8');
    const problems = [];
    const tree = lib.parse(css, problems);
    if (problems.length) throw new Error(`${file}: ${problems[0]}`);
    let head = true;
    const walk = (nodes, ctx) => {
        for (const n of nodes) {
            if (n.type === 'comment') continue;
            if (n.type === 'at' && n.name === 'charset' && !ctx.length) continue;
            if (n.type === 'at' && n.name === 'import' && !ctx.length) {
                if (!head) continue;   // 브라우저가 버리는 줄
                const m = /^@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*;?\s*$/s.exec(n.prelude);
                if (!m) throw new Error(`${file}: 읽지 못한 @import ${n.prelude}`);
                readSheet(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[2] ?? m[4])), id, out, [...stack, file]);
                continue;
            }
            if (!ctx.length) head = false;
            if (n.type === 'rule') {
                const sel = tidy(lib.cleanSel(n.selector));
                const decls = n.decls.map((d) => {
                    if (d.nested) throw new Error(`${file}: 중첩 규칙은 비교하지 못해요`);
                    return { prop: d.lname, value: urls(tidy(d.value), file), imp: d.important };
                });
                out.push({ kind: 'rule', ctx, sel, decls, id, file, key: `${ctx.join(' » ')} ¦ ${sel} ¦ ${decls.map(d => `${d.prop}:${d.value}${d.imp ? '!' : ''}`).join(';')}` });
            } else if (n.type === 'at' && n.children) {
                walk(n.children, [...ctx, tidy(n.prelude)]);
            } else {
                const body = urls(tidy(css.slice(n.start, n.end)), file);
                out.push({ kind: 'at', ctx, name: n.name, id, file, key: `${ctx.join(' » ')} ¦ ${body}` });
            }
        }
    };
    walk(tree.children, []);
}

const sheetOf = id => `src/addons/${id}/${PRIVATE_ADDONS[id]?.css || 'style.css'}`;
const before = [];
for (const id of ADDON_STYLE_IDS) readSheet(sheetOf(id), id, before);
const after = [];
const bundleFile = `src/addons/${ADDON_STYLE_BUNDLE}`;
if (!fs.existsSync(path.join(root, bundleFile))) { console.error(`[없음] ${bundleFile} — node tools/build-addon-css.mjs`); process.exit(1); }
readSheet(bundleFile, '(한 장)', after);

// 1) 선택자별 최종 선언
function finals(rows) {
    const map = new Map();
    for (const r of rows) {
        if (r.kind !== 'rule') continue;
        for (const d of r.decls) {
            const k = `${r.ctx.join(' » ')} ¦ ${r.sel} ¦ ${d.prop}`;
            const cur = map.get(k);
            if (!cur || d.imp || !cur.imp) map.set(k, { value: d.value, imp: d.imp, id: r.id });
        }
    }
    return map;
}
const fb = finals(before);
const fa = finals(after);
const perAddon = new Map(ADDON_STYLE_IDS.map(id => [id, { selectors: new Set(), finals: 0, diff: 0 }]));
const diffs = [];
for (const [k, v] of fb) {
    const a = fa.get(k);
    const row = perAddon.get(v.id);
    row.finals++;
    row.selectors.add(k.slice(0, k.lastIndexOf(' ¦ ')));
    if (!a || a.value !== v.value || a.imp !== v.imp) { row.diff++; diffs.push({ key: k, before: v, after: a || null }); }
}
for (const k of fa.keys()) if (!fb.has(k)) diffs.push({ key: k, before: null, after: fa.get(k) });

// 2) 규칙 순서 — 「전」에서 뒤에 같은 규칙이 또 있는 앞 규칙을 뺀 줄 = 「후」
const lastAt = new Map(before.map((r, i) => [r.key, i]));
const expected = before.filter((r, i) => lastAt.get(r.key) === i);
let orderDiff = null;
for (let i = 0; i < Math.max(expected.length, after.length); i++) {
    if (expected[i]?.key !== after[i]?.key) { orderDiff = { index: i, expected: expected[i]?.key?.slice(0, 200) ?? null, actual: after[i]?.key?.slice(0, 200) ?? null }; break; }
}

const report = {
    sheets: { before: new Set(before.map(r => r.file)).size, after: 1 },
    rules: { before: before.length, removedEarlierDuplicates: before.length - expected.length, after: after.length },
    finals: { before: fb.size, after: fa.size, diff: diffs.length },
    order: orderDiff ? 'diff' : 'same',
    perAddon: Object.fromEntries([...perAddon].map(([id, r]) => [id, { selectors: r.selectors.size, finals: r.finals, diff: r.diff }])),
};
if (process.argv.includes('--json')) console.log(JSON.stringify({ ...report, diffs: diffs.slice(0, 50), orderDiff }, null, 2));
else {
    console.log(`[애드온 CSS 전후] 시트 ${report.sheets.before}장 → 1장 · 규칙 ${report.rules.before} → ${report.rules.after} (뒤에 같은 규칙이 있는 앞 규칙 ${report.rules.removedEarlierDuplicates} 뺌)`);
    console.log(`  선택자별 최종 선언 ${report.finals.before} · ${report.finals.after} — 다른 것 ${report.finals.diff}`);
    console.log(`  규칙 순서 ${orderDiff ? `다름 (#${orderDiff.index})\n    전: ${orderDiff.expected}\n    후: ${orderDiff.actual}` : '같음'}`);
    for (const [id, r] of Object.entries(report.perAddon)) console.log(`  ${id.padEnd(12)} 선택자 ${String(r.selectors).padStart(5)} · 최종 선언 ${String(r.finals).padStart(6)} · 차이 ${r.diff}`);
    for (const d of diffs.slice(0, 10)) console.log(`  ✗ ${d.key.slice(0, 200)}\n     전 ${JSON.stringify(d.before)}\n     후 ${JSON.stringify(d.after)}`);
}
process.exit(diffs.length || orderDiff ? 1 : 0);
