// 9.0.6 이름 연결 감사(acorn): 런타임 JS 의
//   · 정적 import { a } / export { a } from — 저장소 안이면 그 파일의 export, 저장소 밖(실리태번 본체)이면 ST public 의 export 와 맞춰 본다
//   · 동적 import: (await import('x')).a · const { a } = await import('x') · import('x').then(m => m.a) · import('x').then(({ a }) => …)
// 설치 자리는 public/scripts/extensions/third-party/<폴더>/ 로 가정한다. ST 는 읽기만 한다.
//   node tools/audit/links.mjs [저장소] [--st <SillyTavern 폴더>] [--json 결과.json]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, trackedFiles, parseJs, walk, writeJson, argValue } from './lib.mjs';

const ST = path.resolve(argValue('--st') || process.env.ST_ROOT || path.resolve(ROOT, '../SillyTavern'));
const PUBLIC = path.join(ST, 'public');
const HAVE_ST = fs.existsSync(path.join(PUBLIC, 'script.js'));
const INSTALL = 'scripts/extensions/third-party/blue-lemonade';
const files = trackedFiles().filter(f => (f === 'index.js' || f.startsWith('src/')) && /\.m?js$/.test(f) && !/\.test\.m?js$|\/tests?\/|\/source\//.test(f));

const exportCache = new Map();
function exportsOf(abs, seen = new Set()) {
    if (exportCache.has(abs)) return exportCache.get(abs);
    if (seen.has(abs) || !fs.existsSync(abs)) return null;
    seen.add(abs);
    let ast;
    try { ast = parseJs(fs.readFileSync(abs, 'utf8'), abs); } catch { exportCache.set(abs, null); return null; }
    const names = new Set();
    let star = false;
    for (const node of ast.body) {
        if (node.type === 'ExportNamedDeclaration') {
            const d = node.declaration;
            if (d?.id) names.add(d.id.name);
            if (d?.declarations) for (const v of d.declarations) collect(v.id, names);
            for (const s of node.specifiers || []) names.add(s.exported.name ?? s.exported.value);
        } else if (node.type === 'ExportDefaultDeclaration') names.add('default');
        else if (node.type === 'ExportAllDeclaration') {
            if (node.exported) names.add(node.exported.name ?? node.exported.value);
            else { const sub = exportsOf(path.resolve(path.dirname(abs), node.source.value), seen); if (sub) for (const n of sub) if (n !== 'default') names.add(n); else star = true; }
        }
    }
    if (star) names.add('*?');
    exportCache.set(abs, names);
    return names;
}
function collect(p, out) {
    if (!p) return;
    if (p.type === 'Identifier') out.add(p.name);
    else if (p.type === 'ObjectPattern') for (const q of p.properties) collect(q.value ?? q.argument, out);
    else if (p.type === 'ArrayPattern') for (const e of p.elements) collect(e, out);
    else if (p.type === 'AssignmentPattern') collect(p.left, out);
}
// 저장소 파일 f 의 지정자 → { abs, host, label }
function target(f, spec) {
    if (!spec.startsWith('.')) return null;
    const installed = path.posix.normalize(path.posix.join(INSTALL, path.posix.dirname(f), spec));
    if (installed.startsWith(INSTALL + '/')) return { abs: path.join(ROOT, installed.slice(INSTALL.length + 1)), host: false, label: installed.slice(INSTALL.length + 1) };
    return { abs: path.join(PUBLIC, installed), host: true, label: 'public/' + installed };
}

const problems = [];
let checked = 0, hostChecked = 0;
function want(f, line, spec, names, how) {
    const t = target(f, spec);
    if (!t || (t.host && !HAVE_ST)) return;   // 실리태번 폴더가 없으면 본체 쪽은 건너뛴다
    if (!fs.existsSync(t.abs)) { problems.push({ file: f, line, spec, name: '', host: t.host, how, issue: `파일 없음 (${t.label})` }); return; }
    if (!/\.m?js$/.test(t.abs)) return;
    const have = exportsOf(t.abs);
    if (!have) return;
    for (const n of names) {
        checked++; if (t.host) hostChecked++;
        if (!have.has(n) && !have.has('*?')) problems.push({ file: f, line, spec, name: n, host: t.host, how, issue: `export 없음 (${t.label})` });
    }
}
let parentOf = new Map();
function buildParents(ast) { const m = new Map(); walk(ast, (n, p) => { if (p) m.set(n, p); }); return m; }
for (const f of files) {
    let ast;
    try { ast = parseJs(fs.readFileSync(path.join(ROOT, f), 'utf8'), f); } catch (error) { problems.push({ file: f, line: 0, issue: '구문 오류 ' + error.message }); continue; }
    parentOf = buildParents(ast);
    walk(ast, (node, parent) => {
        if (node.type === 'ImportDeclaration') {
            const names = node.specifiers.filter(s => s.type !== 'ImportNamespaceSpecifier').map(s => s.type === 'ImportDefaultSpecifier' ? 'default' : (s.imported.name ?? s.imported.value));
            want(f, node.loc.start.line, node.source.value, names, 'import');
        } else if (node.type === 'ExportNamedDeclaration' && node.source) {
            want(f, node.loc.start.line, node.source.value, node.specifiers.map(s => s.local.name ?? s.local.value), 'export from');
        } else if (node.type === 'ExportAllDeclaration') {
            want(f, node.loc.start.line, node.source.value, [], 'export *');
        } else if (node.type === 'ImportExpression' && node.source.type === 'Literal') {
            const names = [];
            if (parent?.type === 'AwaitExpression') {
                const ctx = parentOf.get(parent);
                if (ctx?.type === 'MemberExpression' && ctx.object === parent && !ctx.computed) names.push(ctx.property.name);
                if (ctx?.type === 'VariableDeclarator' && ctx.id.type === 'ObjectPattern') for (const p of ctx.id.properties) if (p.key && !p.computed) names.push(p.key.name ?? p.key.value);
            }
            if (parent?.type === 'MemberExpression' && !parent.computed && parent.property.name === 'then') {
                const call = parentOf.get(parent);
                const fn = call?.arguments?.[0];
                if (fn && /Function/.test(fn.type) && fn.params[0]) {
                    const p0 = fn.params[0];
                    if (p0.type === 'ObjectPattern') { for (const p of p0.properties) if (p.key && !p.computed) names.push(p.key.name ?? p.key.value); }
                    else if (p0.type === 'Identifier') walk(fn.body, n => { if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === p0.name && !n.computed) names.push(n.property.name); });
                }
            }
            want(f, node.loc.start.line, node.source.value, [...new Set(names)], 'import()');
        }
    });
}
console.log(`[이름 연결] JS ${files.length}개 · 이름 ${checked}개(실리태번 본체 ${HAVE_ST ? hostChecked : '— ST_ROOT 없음, 건너뜀'}) 확인 · 문제 ${problems.length}`);
for (const p of problems) console.log(`  ${p.host ? '[본체] ' : ''}${p.file}:${p.line} ${p.how || ''} ${p.spec || ''} ${p.name || ''} — ${p.issue}`);
const out = argValue('--json');
if (out) writeJson(out, { checked, hostChecked, problems });
