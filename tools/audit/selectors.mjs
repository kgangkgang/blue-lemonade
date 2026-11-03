// 9.0.6 선택자 문법 감사: querySelector(All) · closest · matches · $('…') · .find('…') 에 넘기는 글자 선택자가 문법적으로 맞는지.
// 틀리면 브라우저가 SyntaxError 를 던져 그 경로가 통째로 멈춘다. 틀 문자열의 ${…} 는 a 로 바꿔 대강 본다(추정 표시).
// css-what(실리태번 node_modules, 읽기만)로 읽고, 거기서 못 읽는 최신 문법(:has · :is · :where · :not 목록 · 중첩 ::part 등)은 괄호 짝 · 빈 칸만 본다.
//   node tools/audit/selectors.mjs [저장소] [--json 결과.json]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { trackedFiles, parseJs, walk, read, writeJson, argValue } from './lib.mjs';

const ST = argValue('--st') || process.env.ST_ROOT || '';
let cssWhat = null;
try { cssWhat = createRequire(path.join(ST, 'node_modules/css-what/package.json'))(path.join(ST, 'node_modules/css-what')); } catch { /* 없으면 짝만 본다 */ }
const METHODS = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches', 'webkitMatchesSelector']);
const files = trackedFiles().filter(f => (f === 'index.js' || f.startsWith('src/')) && /\.m?js$/.test(f) && !/\.test\.m?js$|\/tests?\/|\/source\/|\/vendor\/|\.gen\.js$|^src\/scripts\/(bundled|plain)\//.test(f));

function balanced(s) {
    const stack = []; let q = '';
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") { q = c; continue; }
        if (c === '\\') { i++; continue; }
        if (c === '(' || c === '[') stack.push(c);
        else if (c === ')' || c === ']') { const o = stack.pop(); if ((c === ')' && o !== '(') || (c === ']' && o !== '[')) return false; }
    }
    return !q && !stack.length;
}
function check(sel) {
    const s = sel.trim();
    if (!s) return '빈 선택자';
    if (!balanced(s)) return '괄호 · 따옴표 짝이 안 맞음';
    if (/(^|,)\s*(,|$)/.test(s)) return '빈 목록 칸(,,)';
    if (/[>+~]\s*$/.test(s) || /^\s*[>+~]/.test(s) && !/^\s*[>+~]/.test('')) { if (/[>+~]\s*$/.test(s)) return '조합자로 끝남'; }
    // css-what 이 너그럽게 넘기는 것: 뒤 조합자 · '.' / '#' 뒤에 이름이 없음 (속성 [] · 따옴표 · 괄호 안 nth 식은 빼고 본다)
    const bare = s.replace(/\[[^\]]*\]/g, '[a]').replace(/"[^"]*"|'[^']*'/g, '""');
    if (/[>+~]\s*$/.test(bare) || /[>+~]\s*[,)]/.test(bare)) return '조합자로 끝남';
    if (/[.#](?![-_a-zA-Z\\u00A0-\uFFFF])/.test(bare)) return "'.' 이나 '#' 뒤에 이름이 없음";
    if (!cssWhat) return null;
    // css-what 이 모르는 함수형 의사 클래스 안은 비워서 본다(안쪽은 괄호 짝으로 이미 봄)
    const plain = s.replace(/:(has|is|where|not|nth-child|nth-last-child|nth-of-type|nth-last-of-type|host|host-context|state|dir|lang|part|slotted|global|cue|highlight|view-transition-[\w-]+)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, ':is(a)');
    try { cssWhat.parse(plain); return null; } catch (error) { return `읽기 실패: ${error.message}`; }
}

const rows = [];
let checked = 0;
for (const f of files) {
    let ast;
    try { ast = parseJs(read(f), f); } catch { continue; }
    walk(ast, n => {
        if (n.type !== 'CallExpression') return;
        const c = n.callee;
        let arg = null, how = '';
        if (c.type === 'MemberExpression' && !c.computed && METHODS.has(c.property.name)) { arg = n.arguments[0]; how = c.property.name; }
        else if (c.type === 'MemberExpression' && !c.computed && c.property.name === 'find' && n.arguments.length === 1 && (n.arguments[0].type === 'Literal' || n.arguments[0].type === 'TemplateLiteral') && /\$|jQuery|find|children/.test(read(f).slice(c.object.start, c.object.end))) { arg = n.arguments[0]; how = '$.find'; }
        else if (c.type === 'Identifier' && (c.name === '$' || c.name === 'jQuery')) { arg = n.arguments[0]; how = '$'; }
        if (!arg) return;
        let sel = null, guess = false;
        if (arg.type === 'Literal' && typeof arg.value === 'string') sel = arg.value;
        else if (arg.type === 'TemplateLiteral') { sel = arg.quasis.map(q => q.value.cooked ?? '').join('a'); guess = arg.expressions.length > 0; }
        if (sel == null) return;
        if (how === '$' && /^\s*</.test(sel)) return;   // HTML 조각
        if (how === '$.find' && /^[\w-]+$/.test(sel) === false && /[<>]\s*\w+[^>]*>/.test(sel)) return;
        checked++;
        const problem = check(sel);
        if (problem) rows.push({ file: f, line: n.loc.start.line, how, selector: sel.slice(0, 160), problem, guess });
    });
}
console.log(`[선택자 문법] 글자 선택자 ${checked}개 확인${cssWhat ? '' : ' (css-what 없음 — 괄호 짝만)'} · 문제 ${rows.length}`);
for (const r of rows) console.log(`  ${r.file}:${r.line} ${r.how}${r.guess ? ' (틀 문자열 추정)' : ''} — ${r.problem}\n      ${r.selector}`);
const out = argValue('--json');
if (out) writeJson(out, { checked, rows });
