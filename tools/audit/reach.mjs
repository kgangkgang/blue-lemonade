// 9.0.6 도달성 감사: manifest 진입점(index.js · style.css · generate_interceptor)과 css/ 빌드 입력에서 출발해
// 정적 import · export from · 동적 import(문자열 · 틀 문자열) · new URL · new Worker · fetch/<link>/src 같은 경로 문자열 · CSS url()/@import 를 따라가
// 닿지 않는 런타임 파일과 아무도 안 쓰는 export 를 찾는다. 주석 안 글은 길로 치지 않는다(AST 기준).
//   node tools/audit/reach.mjs [저장소] [--json 결과.json] [--exports]
// 판정은 보수적이다: 경로 문자열의 파일 이름이 어디서든 보이면(이름만 같아도) 닿은 것으로 친다 → 「닿지 않음」은 거의 확실히 안 쓰는 파일.
import path from 'node:path';
import { trackedFiles, parseJs, walk, isJs, read, size, kb, writeJson, argValue } from './lib.mjs';

const RUNTIME_EXT = /\.(m?js|cjs|css|html|json|webp|png|jpe?g|gif|svg|mp3|ogg|wav|woff2?|ttf|otf|txt|wasm)$/i;
const PATHY = /[A-Za-z0-9_-]\.(m?js|cjs|css|html|json|webp|png|jpe?g|gif|svg|mp3|ogg|wav|woff2?|ttf|otf|txt|wasm)(?:[?#].*)?$/i;
const all = trackedFiles();
const fileSet = new Set(all);
const byBase = new Map();
for (const f of all) { const b = path.posix.basename(f); if (!byBase.has(b)) byBase.set(b, []); byBase.get(b).push(f); }
export const isRuntime = f => (f === 'index.js' || f === 'style.css' || f === 'manifest.json' || f.startsWith('src/') || f.startsWith('css/') || f.startsWith('server-plugin/')) && RUNTIME_EXT.test(f);
const runtime = all.filter(isRuntime);

const manifest = JSON.parse(read('manifest.json'));
const entries = new Set([manifest.js, manifest.css, 'manifest.json'].filter(Boolean));
for (const f of all) if (/^css\/[^/]+\.css$/.test(f)) entries.add(f);          // build-css.cjs 입력 = style.css 원본
for (const f of all) if (/^server-plugin\/(setup\.mjs|[^/]+\/(index|archive|install)\.mjs)$/.test(f)) entries.add(f);

const edges = new Map();      // file → Set(target)
const why = new Map();        // target → 첫 이유
const strong = new Set();     // 이름만이 아닌 길로 닿은 파일
const broad = [];             // 너무 넓게 맞은 틀 문자열
const missing = [];           // 저장소 안을 가리키는데 그런 파일이 없는 경로
const parseErrors = [];
const words = new Map();      // file → Set(이름 · 속성 · 짧은 문자열) (export 감사용)
const exportsOf = new Map();  // file → [{name, line, local, kind}]

function addEdge(from, to, reason) {
    if (!to || to === from) return;
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from).add(to);
    if (!why.has(to)) why.set(to, `${from} (${reason})`);
    if (!/이름만/.test(reason)) strong.add(to);
}
function resolveRel(from, spec) {
    spec = spec.split(/[?#]/)[0];
    if (!spec) return null;
    if (spec.startsWith('./') || spec.startsWith('../')) return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    return null;
}
function addPathString(from, s, reason) {
    if (typeof s !== 'string' || s.length > 300 || !PATHY.test(s)) return;
    const clean = s.split(/[?#]/)[0];
    const rel = resolveRel(from, clean);
    if (rel && fileSet.has(rel)) return addEdge(from, rel, reason);
    if (!(byBase.get(path.posix.basename(clean)) || []).length && ((rel && !rel.startsWith('..')) || /third-party\//.test(clean))) missing.push({ from, path: s, reason });
    // 확장 뿌리 기준(/scripts/extensions/third-party/<폴더>/…) 또는 이름만 — 이름이 같은 파일 중 꼬리가 맞는 것 전부(보수적)
    const tail = clean.replace(/^.*?third-party\/[^/]+\//, '').replace(/^(\.\.?\/)+/, '').replace(/^\/+/, '');
    const base = path.posix.basename(clean);
    for (const f of byBase.get(base) || []) {
        const tailOk = tail.includes('/') && f.endsWith(tail);
        addEdge(from, f, reason + (tailOk ? '' : ' · 이름만'));
    }
}
function addTemplate(from, quasis, reason) {
    let parts = quasis.map(q => q.value.cooked ?? q.value.raw);
    // ?v=${…} · #… 같은 꼬리는 경로가 아니다
    const q = parts.findIndex(x => /[?#]/.test(x));
    if (q >= 0) parts = [...parts.slice(0, q), parts[q].split(/[?#]/)[0]];
    const shown = parts.join('${…}');
    if (!/\.(m?js|cjs|css|html|json|webp|png|svg|mp3|woff2?)/i.test(parts.join(''))) return;
    const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let prefix = '';
    const head = parts[0];
    if (head.startsWith('./') || head.startsWith('../')) {
        const cut = head.lastIndexOf('/');
        prefix = path.posix.normalize(path.posix.join(path.posix.dirname(from), head.slice(0, cut + 1))).replace(/\/+$/, '') + '/';
        parts[0] = head.slice(cut + 1);
    } else {
        parts[0] = head.replace(/^.*?third-party\/[^/]+\//, '').replace(/^\/+/, '');
    }
    const body = parts.map(esc).join('[^]*?');
    const re = new RegExp((prefix ? '^' + esc(prefix) : '(?:^|/)') + body + '$');
    const hits = all.filter(f => re.test(f) && isRuntime(f));
    if (!hits.length && ((prefix && !prefix.startsWith('..')) || /[\w-]+\.(m?js|css|html|json)$/.test(parts[parts.length - 1]))) missing.push({ from, path: shown, reason: reason + ' · 틀 문자열' });
    if (hits.length > 40) broad.push({ from, pattern: shown, hits: hits.length });
    for (const f of hits) addEdge(from, f, reason + ' · 틀 문자열');
}

function patternNames(p) {
    if (!p) return [];
    if (p.type === 'Identifier') return [p.name];
    if (p.type === 'ObjectPattern') return p.properties.flatMap(q => patternNames(q.value ?? q.argument));
    if (p.type === 'ArrayPattern') return p.elements.flatMap(patternNames);
    if (p.type === 'AssignmentPattern') return patternNames(p.left);
    if (p.type === 'RestElement') return patternNames(p.argument);
    return [];
}
function scanJs(f) {
    let ast;
    try { ast = parseJs(read(f), f); } catch (error) { parseErrors.push(error.message); scanText(f); return; }
    const w = new Set();
    const ex = [];
    walk(ast, node => {
        switch (node.type) {
            case 'ImportDeclaration': addPathString(f, node.source.value, 'import'); break;
            case 'ExportAllDeclaration':
                addPathString(f, node.source.value, 'export from');
                if (node.exported) ex.push({ name: node.exported.name ?? node.exported.value, line: node.loc.start.line, kind: 'reexport' });
                break;
            case 'ExportNamedDeclaration':
                if (node.source) addPathString(f, node.source.value, 'export from');
                if (node.declaration) {
                    const d = node.declaration;
                    if (d.id) ex.push({ name: d.id.name, line: node.loc.start.line, kind: d.type });
                    if (d.declarations) for (const v of d.declarations) for (const n of patternNames(v.id)) ex.push({ name: n, line: node.loc.start.line, kind: 'var' });
                }
                for (const s of node.specifiers || []) ex.push({ name: s.exported.name ?? s.exported.value, local: s.local?.name, line: node.loc.start.line, kind: node.source ? 'reexport' : 'specifier' });
                break;
            case 'ExportDefaultDeclaration': ex.push({ name: 'default', line: node.loc.start.line, kind: 'default' }); break;
            case 'ImportExpression':
                if (node.source.type === 'TemplateLiteral' && node.source.expressions.length) addTemplate(f, node.source.quasis, 'import()');
                break;
            case 'Literal': if (typeof node.value === 'string') { addPathString(f, node.value, '문자열'); if (node.value.length < 80) w.add(node.value); } break;
            case 'TemplateLiteral':
                if (node.expressions.length) addTemplate(f, node.quasis, '틀 문자열');
                else addPathString(f, node.quasis[0].value.cooked, '문자열');
                for (const q of node.quasis) for (const m of (q.value.cooked || '').matchAll(/[A-Za-z_$][\w$]*/g)) w.add(m[0]);
                break;
            case 'Identifier': w.add(node.name); break;
        }
    });
    words.set(f, w);
    if (ex.length) exportsOf.set(f, ex);
}
function scanText(f) {
    const text = read(f);
    const css = f.endsWith('.css');
    const body = css ? text.replace(/\/\*[^]*?\*\//g, '') : f.endsWith('.html') ? text.replace(/<!--[^]*?-->/g, '') : text;
    const re = css ? /(?:url\(\s*["']?|@import\s+["'])([^"')\s]+)/g : /["'`(=]\s*([^"'`()\s<>]+\.(?:m?js|css|html|json|webp|png|jpe?g|gif|svg|mp3|woff2?|ttf|otf|txt))(?=[?#"'`)\s])/gi;
    for (const m of body.matchAll(re)) addPathString(f, /^[./]/.test(m[1]) ? m[1] : './' + m[1], css ? 'css url' : 'html/json');
    if (!css) { const w = words.get(f) || new Set(); for (const m of body.matchAll(/[A-Za-z_$][\w$]*/g)) w.add(m[0]); words.set(f, w); }
}

const reached = new Set();
const queue = [...entries];
for (const e of entries) why.set(e, '진입점');
while (queue.length) {
    const f = queue.shift();
    if (reached.has(f) || !fileSet.has(f)) continue;
    reached.add(f);
    if (isJs(f)) scanJs(f); else if (/\.(css|html|json)$/.test(f)) scanText(f);
    for (const t of edges.get(f) || []) if (!reached.has(t)) queue.push(t);
}

// 닿지 않은 런타임 파일 — 시험 · 도구에서 이름이 보이면 따로 표시
const toolText = all.filter(f => f.startsWith('tools/') && !f.startsWith('tools/audit/') && /\.(m?js|cjs|py|html)$/.test(f)).map(f => [f, read(f)]);
const unreached = runtime.filter(f => !reached.has(f)).map(f => {
    const base = path.posix.basename(f);
    const users = toolText.filter(([, t]) => t.includes(base)).map(([n]) => n);
    return { file: f, bytes: size(f), testsOnly: users.length > 0, users: users.slice(0, 5) };
});

// export 감사: 다른 런타임 파일 어디에도 그 이름(식별자 · 속성 · 짧은 문자열)이 안 보이는 export
const exportRows = [];
if (process.argv.includes('--exports')) {
    const wordFiles = [...words.entries()];
    for (const [f, list] of exportsOf) {
        const ast = parseJs(read(f), f);
        const localCount = new Map();
        walk(ast, n => { if (n.type === 'Identifier') localCount.set(n.name, (localCount.get(n.name) || 0) + 1); });
        for (const e of list) {
            if (e.name === 'default' || e.kind === 'reexport') continue;
            if (wordFiles.some(([g, w]) => g !== f && w.has(e.name))) continue;
            const inTools = toolText.some(([, t]) => new RegExp(`\\b${e.name.replace(/\$/g, '\\$')}\\b`).test(t));
            const own = (localCount.get(e.local || e.name) || 0) - (e.kind === 'specifier' ? (e.local === e.name ? 2 : 1) : 1);
            exportRows.push({ file: f, line: e.line, name: e.name, usedInFile: own > 0, testsOnly: inTools });
        }
    }
}

const sum = rows => rows.reduce((n, r) => n + r.bytes, 0);
const dead = unreached.filter(r => !r.testsOnly), testOnly = unreached.filter(r => r.testsOnly);
console.log(`[도달성] 런타임 파일 ${runtime.length}개 중 닿음 ${runtime.filter(f => reached.has(f)).length} · 닿지 않음 ${unreached.length} (${kb(sum(unreached))}KB)`);
console.log(`  · 아무도 안 씀 ${dead.length}개 ${kb(sum(dead))}KB`);
for (const r of dead) console.log(`    ${r.file} ${kb(r.bytes)}KB`);
console.log(`  · 시험 · 도구만 씀 ${testOnly.length}개 ${kb(sum(testOnly))}KB`);
for (const r of testOnly) console.log(`    ${r.file} ${kb(r.bytes)}KB ← ${r.users.join(', ')}`);
if (broad.length) { console.log(`  · 넓게 맞은 틀 문자열 ${broad.length}개(사람이 볼 것)`); for (const b of broad) console.log(`    ${b.from}: ${b.pattern} → ${b.hits}개`); }
if (missing.length) { console.log(`  · 없는 파일을 가리키는 경로 ${missing.length}개(지운 파일을 아직 부름?)`); for (const m of missing) console.log(`    ${m.from}: ${m.path} (${m.reason})`); }
if (parseErrors.length) { console.log(`  · 구문 분석 실패 ${parseErrors.length}개(글자 검색으로 대신함)`); for (const e of parseErrors) console.log(`    ${e}`); }
if (exportRows.length) {
    const deadFns = exportRows.filter(r => !r.usedInFile);
    console.log(`[export] 다른 런타임 파일이 안 쓰는 export ${exportRows.length}개 — 파일 안에서도 안 씀 ${deadFns.length}개 (시험만 ${deadFns.filter(r => r.testsOnly).length})`);
    for (const r of deadFns) console.log(`    ${r.file}:${r.line} ${r.name}${r.testsOnly ? ' (시험이 씀)' : ''}`);
    if (process.argv.includes('--all-exports')) for (const r of exportRows.filter(x => x.usedInFile)) console.log(`    (파일 안에서만) ${r.file}:${r.line} ${r.name}${r.testsOnly ? ' (시험이 씀)' : ''}`);
}
if (process.argv.includes('--weak')) {
    // 이름만 같은 문자열로만 닿은 파일 — 진짜로 쓰이는지 사람이 볼 것
    const weak = [...reached].filter(f => isRuntime(f) && !entries.has(f) && !strong.has(f) && /\.(m?js|css|html|json)$/.test(f));
    console.log(`  · 이름만 같은 문자열로 닿은 파일 ${weak.length}개`);
    for (const f of weak) console.log(`    ${f} ← ${why.get(f)}`);
}
const whyArg = argValue('--why');
if (whyArg) console.log(`[왜 닿음] ${whyArg} ← ${why.get(whyArg) || '닿지 않음'}`);
const out = argValue('--json');
if (out) writeJson(out, { reached: reached.size, runtime: runtime.length, unreached, broad, missing, parseErrors, exports: exportRows });
