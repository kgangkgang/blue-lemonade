// 9.0.6 패턴 감사(acorn): 누수 · 중복 등록 · 오류 위험 · 무거운 패턴 후보를 파일:줄로 뽑는다. 판정은 사람이 한다(후보 목록).
//   node tools/audit/patterns.mjs [저장소] [--json 결과.json] [--only 종류,종류]
// 종류
//   listener-nested   다른 콜백 · 반복 경로 안에서 붙이는 addEventListener / eventSource.on (짝 remove · once · 가드 없음)
//   observer-leak     new MutationObserver/ResizeObserver/IntersectionObserver 가 있는데 파일에 disconnect 가 없음
//   interval-leak     setInterval 이 있는데 파일에 clearInterval 이 없음
//   json-unguarded    try 밖의 JSON.parse (인자가 JSON.stringify 결과면 뺌)
//   import-uncaught   import() 를 await · catch 없이 버림
//   async-floating    같은 파일의 async 함수를 await · catch · return 없이 부름 (문장 자리)
//   global-dup        window.* / globalThis.* 이름 · Symbol.for 이름을 두 파일 이상이 씀
//   qsa-in-loop       반복문 · forEach/map 콜백 안의 querySelectorAll
//   layout-thrash     한 반복 안에서 레이아웃 읽기(getBoundingClientRect · offset* · scroll* · client* · getComputedStyle)와 쓰기(style · classList)가 섞임
//   scroll-undebounced resize · scroll 처리기에 requestAnimationFrame · setTimeout · 디바운스가 없음
//   observer-heavy    MutationObserver 콜백 안의 document 전체 querySelectorAll
import path from 'node:path';
import { trackedFiles, parseJs, walk, read, writeJson, argValue } from './lib.mjs';

const only = (argValue('--only') || '').split(',').filter(Boolean);
const on = kind => !only.length || only.includes(kind);
const files = trackedFiles().filter(f => (f === 'index.js' || f.startsWith('src/')) && /\.m?js$/.test(f) && !/\.test\.m?js$|\/tests?\/|\/source\/|\/vendor\/|\.gen\.js$|^src\/scripts\/(bundled|plain)\//.test(f));
const rows = [];
const add = (kind, file, node, note) => rows.push({ kind, file, line: node?.loc?.start.line ?? 0, note });
const globals = new Map();   // 이름 → Set(file)

const LOOP = new Set(['ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement']);
const ITER = new Set(['forEach', 'map', 'filter', 'some', 'every', 'flatMap', 'reduce', 'find']);
const LAYOUT_READ = new Set(['getBoundingClientRect', 'getClientRects', 'offsetHeight', 'offsetWidth', 'offsetTop', 'offsetLeft', 'scrollHeight', 'scrollWidth', 'clientHeight', 'clientWidth', 'scrollTop', 'getComputedStyle', 'innerText']);
const fnLike = n => n && /Function/.test(n.type);
const calleeName = c => c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : '';
const src = (text, n) => text.slice(n.start, n.end);

for (const f of files) {
    const text = read(f);
    let ast;
    try { ast = parseJs(text, f); } catch (error) { add('parse', f, null, error.message); continue; }
    const parent = new Map();
    walk(ast, (n, p) => { if (p) parent.set(n, p); });
    const ancestors = n => { const out = []; for (let p = parent.get(n); p; p = parent.get(p)) out.push(p); return out; };
    const hasDisconnect = /\.disconnect\(/.test(text);
    const hasClearInterval = /clearInterval\(/.test(text);
    const asyncFns = new Set();
    walk(ast, n => {
        if ((n.type === 'FunctionDeclaration') && n.async && n.id) asyncFns.add(n.id.name);
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && fnLike(n.init) && n.init.async) asyncFns.add(n.id.name);
    });

    walk(ast, n => {
        // 전역 이름
        if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' && ['window', 'globalThis', 'self'].includes(n.left.object.name)) {
            const name = n.left.computed ? (n.left.property.type === 'Literal' ? String(n.left.property.value) : null) : n.left.property.name;
            if (name && !['onerror', 'onunhandledrejection'].includes(name)) { if (!globals.has('window.' + name)) globals.set('window.' + name, new Map()); globals.get('window.' + name).set(f, n.loc.start.line); }
        }
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Symbol' && n.callee.property.name === 'for' && n.arguments[0]?.type === 'Literal') {
            const key = 'Symbol.for(' + n.arguments[0].value + ')';
            if (!globals.has(key)) globals.set(key, new Map());
            globals.get(key).set(f, n.loc.start.line);
        }
        if (n.type === 'NewExpression' && n.callee.type === 'Identifier' && /^(Mutation|Resize|Intersection)Observer$/.test(n.callee.name)) {
            if (on('observer-leak') && !hasDisconnect) add('observer-leak', f, n, `${n.callee.name} — 파일에 disconnect 없음`);
            if (on('observer-heavy') && n.callee.name === 'MutationObserver' && fnLike(n.arguments[0])) {
                walk(n.arguments[0].body, m => {
                    if (m.type === 'CallExpression' && m.callee.type === 'MemberExpression' && m.callee.property.name === 'querySelectorAll' && m.callee.object.type === 'Identifier' && m.callee.object.name === 'document')
                        add('observer-heavy', f, m, 'MutationObserver 콜백 안 document.querySelectorAll');
                });
            }
        }
        if (n.type !== 'CallExpression') return;
        const name = calleeName(n.callee);
        if (name === 'setInterval' && on('interval-leak') && !hasClearInterval) add('interval-leak', f, n, '파일에 clearInterval 없음');
        if (name === 'parse' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'JSON' && on('json-unguarded')) {
            const arg = n.arguments[0];
            const safe = arg && arg.type === 'CallExpression' && calleeName(arg.callee) === 'stringify';
            const guarded = ancestors(n).some((a, i, list) => a.type === 'TryStatement' && list[i - 1] === a.block)
                || ancestors(n).some(a => a.type === 'CallExpression' && a.callee.type === 'MemberExpression' && a.callee.property.name === 'catch');
            if (!safe && !guarded) add('json-unguarded', f, n, src(text, n).slice(0, 90));
        }
        if (n.type === 'CallExpression' && on('async-floating') && n.callee.type === 'Identifier' && asyncFns.has(n.callee.name) && parent.get(n)?.type === 'ExpressionStatement')
            add('async-floating', f, n, `${n.callee.name}() 결과를 버림`);
        if ((name === 'addEventListener' || (name === 'on' && /eventSource|event_source|eventBus/.test(src(text, n.callee.object || n.callee)))) && on('listener-nested')) {
            const opts = n.arguments[2];
            const once = opts && opts.type === 'ObjectExpression' && opts.properties.some(p => p.key?.name === 'once' || p.key?.name === 'signal');
            const fns = ancestors(n).filter(fnLike);
            // 함수 2단 이상 깊이(= 다른 콜백 안) + once/signal 없음 + 파일에 remove 짝 없음
            const handler = n.arguments[1];
            const handlerName = handler?.type === 'Identifier' ? handler.name : handler?.type === 'MemberExpression' ? src(text, handler) : '';
            const removed = handlerName && new RegExp(`(removeEventListener|removeListener|\\.off)\\([^)]*${handlerName.replace(/[.$]/g, '\\$&')}`).test(text);
            const evt = n.arguments[0]?.type === 'Literal' ? n.arguments[0].value : src(text, n.arguments[0] || n).slice(0, 40);
            // 오래 사는 대상(document · window · body · html · eventSource · $(document))에 붙일 때만 — 새로 그린 요소에 붙는 것은 요소와 함께 사라진다
            const targetText = n.callee.type === 'MemberExpression' ? src(text, n.callee.object) : '';
            const longLived = name === 'on' || /^(document|window|globalThis|self|document\.body|document\.documentElement|document\.head|\$\(document\)|\$\(window\)|\$\('body'\)|visualViewport|window\.visualViewport|matchMedia\(.*\))$/.test(targetText.replace(/\?$/, ''));
            // 감싸는 함수 어느 것이든 머리에 한 번만 가드(if (bound) return · ??= · WeakSet · dataset 표시)가 있으면 뺀다
            const GUARD = /\b(if\s*\(\s*!?[\w.$[\]'"]*(started|installed|bound|ready|done|wired|hooked|attached|listening|listen\w*|init\w*|setup|_bl\w*|once|on|mounted|watching|armed|running)\b[^)]*\)\s*(return|\{\s*return)|dataset\.\w+\s*(=|\))|\bonce\b|WeakSet|\.has\(|\?\?=|\|\|=)/i;
            const guard = fns.some(fn => GUARD.test(src(text, fn.body).slice(0, 700)));
            if (longLived && fns.length >= 2 && !once && !removed && !guard)
                add('listener-nested', f, n, `${targetText || name}.${name}('${evt}') — 콜백 깊이 ${fns.length}, once/짝 remove/가드 없음`);
        }
        if (name === 'querySelectorAll' && on('qsa-in-loop')) {
            const anc = ancestors(n);
            // 반복 머리(for … of 의 right · for 의 init)에서 한 번 부르는 것은 반복 안이 아니다
            const inHead = a => { const i = anc.indexOf(a); const child = i > 0 ? anc[i - 1] : n; return (a.type === 'ForOfStatement' || a.type === 'ForInStatement') ? child === a.right : a.type === 'ForStatement' ? child === a.init : false; };
            const inLoop = anc.find(a => LOOP.has(a.type) && !inHead(a)) || anc.find(a => a.type === 'CallExpression' && a.callee.type === 'MemberExpression' && ITER.has(a.callee.property.name) && a.arguments.some(fnLike) && anc.includes(a.arguments.find(fnLike)));
            const fnBoundary = anc.findIndex(fnLike);
            const loopIdx = inLoop ? anc.indexOf(inLoop) : -1;
            // 반복이 같은 함수 안(함수 경계보다 가까움)이거나 반복 콜백 자체
            if (inLoop && (fnBoundary === -1 || loopIdx < fnBoundary || (inLoop.type === 'CallExpression'))) add('qsa-in-loop', f, n, src(text, n).slice(0, 80));
        }
        if (['addEventListener'].includes(name) && on('scroll-undebounced')) {
            const evt = n.arguments[0]?.type === 'Literal' ? n.arguments[0].value : '';
            const handler = n.arguments[1];
            if ((evt === 'scroll' || evt === 'resize') && handler && fnLike(handler)) {
                const body = src(text, handler.body);
                if (!/requestAnimationFrame|setTimeout|debounce|throttle|schedule|queue|raf|idle/i.test(body) && body.length > 60) add('scroll-undebounced', f, n, `${evt} 처리기 ${body.length}자에 rAF/디바운스 없음`);
            }
        }
    });
    // 레이아웃 읽기 + 쓰기가 한 반복 안에
    if (on('layout-thrash')) walk(ast, n => {
        const isLoop = LOOP.has(n.type) || (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && ['forEach', 'map'].includes(n.callee.property.name) && fnLike(n.arguments[0]));
        if (!isLoop) return;
        const body = n.type === 'CallExpression' ? n.arguments[0].body : n.body;
        let read = null, write = null;
        walk(body, m => {
            if (fnLike(m) && m !== body) return false;
            if (m.type === 'MemberExpression' && !m.computed && LAYOUT_READ.has(m.property.name) && !(parent.get(m)?.type === 'AssignmentExpression' && parent.get(m).left === m)) read ||= m;
            if (m.type === 'CallExpression' && m.callee.type === 'Identifier' && m.callee.name === 'getComputedStyle') read ||= m;
            if (m.type === 'AssignmentExpression' && m.left.type === 'MemberExpression' && (/\.style\b/.test(src(text, m.left)) || ['scrollTop', 'className'].includes(m.left.property?.name))) write ||= m;
            if (m.type === 'CallExpression' && m.callee.type === 'MemberExpression' && ['add', 'remove', 'toggle', 'setProperty'].includes(m.callee.property.name) && /classList|style/.test(src(text, m.callee.object))) write ||= m;
        });
        if (read && write) add('layout-thrash', f, n, `읽기 ${src(text, read).slice(0, 40)} @${read.loc.start.line} · 쓰기 ${src(text, write).slice(0, 40)} @${write.loc.start.line}`);
    });
    // import() 를 버림
    if (on('import-uncaught')) walk(ast, n => {
        if (n.type !== 'ImportExpression') return;
        let top = n, p = parent.get(n);
        while (p && (p.type === 'MemberExpression' || (p.type === 'CallExpression' && p.callee === top))) { top = p; p = parent.get(p); }
        const chain = src(text, top);
        if (p?.type === 'ExpressionStatement' && !/\.catch\(|,\s*(\(?\w*\)?\s*=>|function)/.test(chain.slice(src(text, n).length))) {
            const inTry = ancestors(n).some((a, i, l) => a.type === 'TryStatement' && l[i - 1] === a.block);
            if (!inTry) add('import-uncaught', f, n, chain.slice(0, 90));
        }
    });
}
for (const [name, map] of globals) if (map.size > 1 && on('global-dup')) rows.push({ kind: 'global-dup', file: [...map].map(([f, l]) => `${f}:${l}`).join(' · '), line: 0, note: name });

const byKind = {};
for (const r of rows) (byKind[r.kind] ||= []).push(r);
for (const [kind, list] of Object.entries(byKind)) {
    console.log(`[${kind}] ${list.length}`);
    for (const r of list.slice(0, Number(argValue('--limit') || 400))) console.log(`  ${r.file}${r.line ? ':' + r.line : ''} ${r.note}`);
}
const out = argValue('--json');
if (out) writeJson(out, rows);
