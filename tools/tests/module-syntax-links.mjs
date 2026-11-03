// 9.0.6 모든 런타임 JS 가 (1) 브라우저가 읽는 형태(ES 모듈, 아니면 일반 스크립트)로 문법이 맞고
// (2) 저장소 안 파일을 가리키는 정적 import { 이름 } · export { 이름 } from 이 실제로 있는 export 를 가리키는지 본다.
// 9.0.0 에서 src/panel.js 의 틀 문자열 닫는 줄이 함께 지워져 설정 창 모듈이 통째로 안 열렸는데 어떤 시험도 몰랐다(9.0.6 감사).
//   node tools/tests/module-syntax-links.mjs [저장소]
// 문법은 node 내장 vm.SourceTextModule 로 본다(설치할 것 없음) — 그래서 --experimental-vm-modules 를 켜고 자기 자신을 다시 띄운다.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
if (!process.execArgv.includes('--experimental-vm-modules')) {
    const r = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', self, ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
}
const vm = await import('node:vm');
const root = path.resolve(process.argv[2] || '.');
const files = [];
(function scan(dir) {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.isDirectory()) { if (!/^(node_modules|\.git|tests?|source)$/.test(e.name)) scan(rel); }
        else if (/\.m?js$/.test(e.name) && !/\.test\.m?js$/.test(e.name)) files.push(rel);
    }
})('src');
files.push('index.js');

const failures = [];
const strip = text => text.replace(/\/\*[^]*?\*\//g, ' ').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const exportsCache = new Map();
function exportNames(rel, seen = new Set()) {
    if (exportsCache.has(rel)) return exportsCache.get(rel);
    if (seen.has(rel)) return new Set();
    seen.add(rel);
    const names = new Set();
    let text;
    try { text = strip(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return null; }
    for (const m of text.matchAll(/(?:^|[\n;}])\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of text.matchAll(/(?:^|[\n;}])\s*export\s+(?:const|let|var)\s+\{([^}]*)\}/g)) for (const p of m[1].split(',')) { const n = p.split(':').pop().split('=')[0].trim(); if (n) names.add(n); }
    // export const A = …, B = …; — 깊이 0 의 쉼표 뒤 이름도
    for (const m of text.matchAll(/(?:^|[\n;}])\s*export\s+(?:const|let|var)\s+(?=[A-Za-z_$])/g)) {
        let depth = 0, quote = '', i = m.index + m[0].length, atName = true;
        for (; i < text.length; i++) {
            const c = text[i];
            if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
            if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
            if ('([{'.includes(c)) depth++;
            else if (')]}'.includes(c)) { if (--depth < 0) break; }
            else if (depth === 0 && (c === ';' || (c === '\n' && !/[=,(\[{+\-*/?:&|.]\s*$/.test(text.slice(Math.max(0, i - 40), i)) && !/^\s*[=,.?:&|+\-*/]/.test(text.slice(i + 1, i + 40))))) break;
            else if (depth === 0 && c === ',') { atName = true; continue; }
            if (atName && /[A-Za-z_$]/.test(c)) { const n = /^[A-Za-z_$][\w$]*/.exec(text.slice(i))[0]; names.add(n); i += n.length - 1; atName = false; }
            else if (!/\s/.test(c)) atName = false;
        }
    }
    for (const m of text.matchAll(/(?:^|[\n;}])\s*export\s*\{([^}]*)\}\s*(?:from\s*['"]([^'"]+)['"])?/g)) {
        for (const p of m[1].split(',')) { const parts = p.trim().split(/\s+as\s+/); const n = (parts[1] || parts[0]).trim(); if (n) names.add(n.replace(/^['"]|['"]$/g, '')); }
    }
    if (/(?:^|[\n;}])\s*export\s+default\b/.test(text)) names.add('default');
    for (const m of text.matchAll(/(?:^|[\n;}])\s*export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
        const target = resolve(rel, m[1]);
        const sub = target && exportNames(target, seen);
        if (sub) for (const n of sub) if (n !== 'default') names.add(n);
    }
    exportsCache.set(rel, names);
    return names;
}
function resolve(from, spec) {
    if (!spec.startsWith('.')) return null;
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    if (rel.startsWith('..')) return null;   // 실리태번 본체(../../../../script.js 등) — 저장소 밖
    return rel;
}

let modules = 0, scripts = 0, links = 0;
for (const rel of files) {
    const code = fs.readFileSync(path.join(root, rel), 'utf8');
    try { new vm.SourceTextModule(code, { identifier: rel }); modules++; }
    catch (moduleError) {
        // import/export 가 없는 일반 스크립트(작업자 · 옛 스크립트)는 스크립트 문법으로 한 번 더
        if (/(?:^|[\n;])\s*(?:import\s*[\w{*'"]|export\s)/.test(strip(code))) { failures.push(`${rel}: 모듈 문법 오류 — ${moduleError.message}`); continue; }
        try { new vm.Script(code, { filename: rel }); scripts++; }
        catch (scriptError) { failures.push(`${rel}: 문법 오류 — ${scriptError.message}`); continue; }
    }
    const text = strip(code);
    for (const m of text.matchAll(/(?:^|[\n;}])\s*(import|export)\s*(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+[\w$]+)?\s*from\s*['"]([^'"]+)['"]/g)) {
        const [, kind, def, list, spec] = m;
        const target = resolve(rel, spec);
        if (!target) continue;
        if (!fs.existsSync(path.join(root, target))) { failures.push(`${rel}: ${spec} 파일이 없어요`); continue; }
        if (!/\.m?js$/.test(target)) continue;
        const have = exportNames(target);
        const wanted = [];
        if (def && kind === 'import') wanted.push('default');
        for (const p of (list || '').split(',')) { const n = p.trim().split(/\s+as\s+/)[0].trim().replace(/^['"]|['"]$/g, ''); if (n && n !== 'type') wanted.push(n); }
        for (const n of wanted) { links++; if (!have.has(n)) failures.push(`${rel}: ${spec} 에 export ${n} 이 없어요`); }
    }
}
for (const f of failures) console.error('[실패] ' + f);
console.log(`[모듈 문법 · 연결] JS ${files.length}개 (모듈 ${modules} · 스크립트 ${scripts}) · 이름 연결 ${links}개 · 실패 ${failures.length}`);
process.exit(failures.length ? 1 : 0);
