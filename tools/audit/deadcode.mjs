// 9.0.6 죽은 최상위 선언 감사(acorn): 모듈 맨 위의 함수 · 부작용 없는 상수 가운데
//   (1) export 가 아니면서 파일 안 어디서도 이름을 안 읽는 것, (2) export 지만 저장소 어디서도(시험 · 도구 포함) 그 이름이 안 보이는 것을
//   지우면 또 죽는 것까지 연쇄로 찾는다. --apply 면 실제로 지운다(바로 위에 붙은 주석 줄까지, 줄바꿈 CRLF/LF 는 파일 그대로).
//   node tools/audit/deadcode.mjs [저장소] [--apply] [--json 결과.json] [--skip 정규식] [--files 정규식]
// 남기는 것: 시험 · 디버그 훅 이름(…ForTest · reset… · _… · …State · set…Source/Timeout), 부작용이 있을 수 있는 초기값(함수 호출 · new …),
//   다른 분기가 맡은 파일(--skip). 이름이 글자로 어디든 보이면(문자열 · 주석 포함) 쓰는 것으로 친다 — 보수적.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, trackedFiles, parseJs, walk, read, writeJson, argValue } from './lib.mjs';

const HOOK = /ForTest$|^reset[A-Z]|^_|State$|^set\w*(Source|Timeout)$/;
const skip = argValue('--skip') ? new RegExp(argValue('--skip')) : null;
const only = argValue('--files') ? new RegExp(argValue('--files')) : null;
const all = trackedFiles();
const files = all.filter(f => (f === 'index.js' || f.startsWith('src/')) && /\.m?js$/.test(f) && !/\.test\.m?js$|\/tests?\/|\/source\/|\/vendor\/|\.gen\.js$|^src\/scripts\/(bundled|plain)\//.test(f)
    && (!skip || !skip.test(f)) && (!only || only.test(f)));
// 저장소 전체 글(이름이 다른 파일에 보이는지) — 도구 · 시험 포함
const corpus = all.filter(f => /\.(m?js|cjs|html|py|yml|json)$/.test(f) && !/\/vendor\/|^src\/scripts\/(bundled|plain)\/|\.gen\.js$/.test(f)).map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
const seenElsewhere = (name, file) => { const re = new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}([^\\w$]|$)`); return corpus.some(([f, t]) => f !== file && re.test(t)); };

const PURE_INIT = new Set(['FunctionExpression', 'ArrowFunctionExpression', 'ClassExpression', 'Literal', 'TemplateLiteral', 'ObjectExpression', 'ArrayExpression', 'Identifier', 'MemberExpression']);
function pureInit(n) {
    if (!n) return true;
    if (PURE_INIT.has(n.type)) return n.type !== 'TemplateLiteral' || n.expressions.length === 0;
    // Object.freeze({…}) · Object.freeze([…])
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Object' && n.callee.property.name === 'freeze') return n.arguments.every(a => ['ObjectExpression', 'ArrayExpression'].includes(a.type));
    if (n.type === 'UnaryExpression' || n.type === 'BinaryExpression') return true;
    return false;
}

const report = [];
let totalBytes = 0;
for (const f of files) {
    let text = read(f);
    const removed = [];
    for (let round = 0; round < 20; round++) {
        let ast;
        try { ast = parseJs(text, f); } catch { break; }
        // 최상위 후보
        const cands = [];
        for (const stmt of ast.body) {
            const exported = stmt.type === 'ExportNamedDeclaration' && stmt.declaration;
            const d = exported ? stmt.declaration : stmt;
            if (d.type === 'FunctionDeclaration' && d.id) cands.push({ name: d.id.name, node: stmt, decl: d, exported: !!exported });
            else if (d.type === 'ClassDeclaration' && d.id) cands.push({ name: d.id.name, node: stmt, decl: d, exported: !!exported });
            else if (d.type === 'VariableDeclaration' && d.declarations.length === 1 && d.declarations[0].id.type === 'Identifier' && pureInit(d.declarations[0].init))
                cands.push({ name: d.declarations[0].id.name, node: stmt, decl: d, exported: !!exported });
        }
        // 이름별 참조 수(선언 자리 · 자기 몸 안은 뺌)
        const refs = new Map();
        walk(ast, (n, p, key) => {
            if (n.type !== 'Identifier') return;
            if (p && ((p.type === 'MemberExpression' && key === 'property' && !p.computed) || (p.type === 'Property' && key === 'key' && !p.computed && !p.shorthand) || ((p.type === 'MethodDefinition' || p.type === 'PropertyDefinition') && key === 'key' && !p.computed))) return;
            (refs.get(n.name) || refs.set(n.name, []).get(n.name)).push(n.start);
        });
        // 짧은 문자열 · 틀 문자열 안의 이름도 읽는 것으로 친다(보수적)
        const strings = [];
        walk(ast, n => { if (n.type === 'Literal' && typeof n.value === 'string') strings.push(n.value); if (n.type === 'TemplateElement') strings.push(n.value.cooked || ''); });
        const dead = cands.filter(c => {
            if (HOOK.test(c.name)) return false;
            const outside = (refs.get(c.name) || []).filter(pos => pos < c.node.start || pos >= c.node.end);
            if (outside.length) return false;
            if (strings.some(s => s.includes(c.name))) return false;
            if (c.exported && seenElsewhere(c.name, f)) return false;
            if (!c.exported && /\bexport\s*\{[^}]*\b/.test(text) && new RegExp(`export\\s*\\{[^}]*\\b${c.name}\\b`).test(text)) return false;
            return true;
        });
        if (!dead.length) break;
        // 뒤에서부터 지운다(앞 위치가 안 바뀌게)
        for (const c of dead.sort((a, b) => b.node.start - a.node.start)) {
            let start = c.node.start, end = c.node.end;
            // 줄 머리부터 · 바로 위에 붙은 주석 줄(빈 줄 없이)까지
            let lineStart = text.lastIndexOf('\n', start - 1) + 1;
            if (text.slice(lineStart, start).trim()) { removedNote(c, '같은 줄에 다른 글 — 건너뜀'); continue; }
            let after = end;
            while (after < text.length && (text[after] === ' ' || text[after] === '\t')) after++;
            if (text[after] === ';') after++;
            const tail = text.slice(after).match(/^[ \t]*(\/\/[^\r\n]*)?/)[0];
            if (tail.trim() && !tail.trim().startsWith('//')) { removedNote(c, '같은 줄 뒤에 다른 글 — 건너뜀'); continue; }
            after += tail.length;
            if (text.startsWith('\r\n', after)) after += 2; else if (text[after] === '\n') after += 1;
            let top = lineStart;
            for (;;) {
                const prevEnd = top - 1;
                if (prevEnd < 0) break;
                const prevStart = text.lastIndexOf('\n', prevEnd - 1) + 1;
                const line = text.slice(prevStart, prevEnd).replace(/\r$/, '');
                if (/^\s*(\/\/|\/\*\*?|\*)/.test(line) && !/^\s*\/\/\s*[─━=]{3}/.test(line)) top = prevStart; else break;
                if (/^\s*\/\*/.test(line)) break;
            }
            removed.push({ name: c.name, exported: c.exported, line: text.slice(0, start).split('\n').length, bytes: after - top, round });
            text = text.slice(0, top) + text.slice(after);
        }
        function removedNote(c, why) { removed.push({ name: c.name, exported: c.exported, skipped: why, bytes: 0, round }); }
        if (removed.every(r => r.skipped)) break;
    }
    const real = removed.filter(r => !r.skipped);
    if (!removed.length) continue;
    const bytes = real.reduce((n, r) => n + r.bytes, 0);
    totalBytes += bytes;
    report.push({ file: f, bytes, items: removed });
    if (process.argv.includes('--apply') && real.length) {
        try { parseJs(text, f); fs.writeFileSync(path.join(ROOT, f), text); }
        catch (error) { console.error(`[건너뜀] ${f}: 지운 뒤 구문 오류 — ${error.message}`); }
    }
}
console.log(`[죽은 최상위 선언] 파일 ${report.length}개 · 약 ${(totalBytes / 1024).toFixed(1)}KB${process.argv.includes('--apply') ? ' (지움)' : ''}`);
for (const r of report.sort((a, b) => b.bytes - a.bytes)) console.log(`  ${(r.bytes / 1024).toFixed(1).padStart(5)}KB ${r.file}: ${r.items.map(i => `${i.exported ? 'export ' : ''}${i.name}${i.round ? `(연쇄 ${i.round})` : ''}${i.skipped ? ` [${i.skipped}]` : ''}`).join(', ')}`);
const out = argValue('--json');
if (out) writeJson(out, report);
