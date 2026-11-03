// 9.0.4 감시 전수 세기(정적): 런타임 JS(index.js · src/**)의 MutationObserver · 공용 감시 허브 구독(watchDom) · 실리태번 이벤트 구독을 표로 세요.
//   node tools/audit/observers.mjs [저장소] [--md 표.md] [--json 결과.json] [--check] [--max-body N] [--max-new N] [--max-chat N]
//   --check: 내장 스크립트(src/scripts/** — iframe 갈래 몫) · 번들 vendor 를 뺀 테마 · 애드온에서
//            body · html 을 subtree 로 직접 보는 감시가 N(기본 0)개 넘거나, new MutationObserver 자리가 --max-new 를 넘으면 실패해요(tools/tests/observer-budget.mjs).
// 부담(정적 짐작): 「문서」 = body · html 을 subtree 로(문서 어디가 바뀌어도 기록) · 「채팅」 = #chat subtree(메시지 · 스트리밍마다) · 「요소」 = 그 밖(창 · 서랍 · 단추 하나).
//   실제 횟수 · 시간은 리그 성능 관문(perf-gate)이 재요 — 이 표는 「어디를 · 무엇을 보나」만이에요.
// 구문 분석기는 lib.mjs 의 acorn(실리태번 node_modules 또는 node --expose-internals).
import path from 'node:path';
import fs from 'node:fs';
import { trackedFiles, parseJs, read, walk, writeJson, argValue, ROOT } from './lib.mjs';

const RUNTIME = f => /\.(m?js)$/.test(f) && (f === 'index.js' || f.startsWith('src/')) && !/\/vendor\//.test(f) && !/\.min\.js$/.test(f);
export const groupOf = f => (f.startsWith('src/scripts/') ? 'scripts' : f.startsWith('src/addons/') ? 'addon' : 'theme');
const MO_KEYS = new Set(['childList', 'subtree', 'attributes', 'attributeFilter', 'characterData', 'attributeOldValue', 'characterDataOldValue']);

function literal(node) {
    if (!node) return undefined;
    if (node.type === 'Literal') return node.value;
    if (node.type === 'ArrayExpression') return node.elements.map(e => (e?.type === 'Literal' ? e.value : '?'));
    if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis.map(q => q.value.cooked).join('');
    return '?';
}
function objectOpts(obj, text) {
    if (!obj || obj.type !== 'ObjectExpression') return null;
    const out = {};
    for (const p of obj.properties) {
        if (p.type !== 'Property') { out['…'] = true; continue; }
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        out[key] = p.value.type === 'Literal' || p.value.type === 'ArrayExpression' || p.value.type === 'TemplateLiteral' ? literal(p.value) : p.shorthand ? key : text.slice(p.value.start, p.value.end);
    }
    return out;
}
export function classifyTarget(t) {
    const s = String(t || '');
    if (/documentElement|\bhtml(El)?\b/.test(s)) return 'html';
    // 맨 이름 body 는 다른 요소(확장 창 몸통 등)일 때가 많아 문서 body 로 치지 않아요
    if (/\b(document|doc|d|stDoc|ownerDocument)\.body\b/.test(s) && !/chat/i.test(s)) return 'body';
    if (/chat/i.test(s) && !/chatList|chat_list|chat-graph|chats/i.test(s)) return 'chat';
    if (/\bhead\b/.test(s)) return 'head';
    return 'element';
}
function weight(kind, target, opts) {
    const sub = !!opts?.subtree && opts.subtree !== false;
    if ((target === 'body' || target === 'html') && sub) return '문서';
    if (target === 'chat' && sub) return '채팅';
    return '요소';
}
const describe = o => {
    if (!o) return '';
    const bits = [];
    if (o.subtree) bits.push('subtree');
    if (o.childList) bits.push('childList');
    if (o.characterData) bits.push('characterData');
    const attrs = o.attributeFilter ?? (Array.isArray(o.attributes) ? o.attributes : o.attributes === true ? '전부' : null);
    if (attrs) bits.push('attr:' + (Array.isArray(attrs) ? attrs.join('/') : attrs));
    if (o.attributeOldValue) bits.push('oldValue');
    if (o.when && o.when !== 'now') bits.push('when:' + o.when);
    if (o.exclude) bits.push('exclude:' + (Array.isArray(o.exclude) ? o.exclude.join('/') : o.exclude));
    if (o.match) bits.push('match:' + o.match);
    return bits.join(' ');
};

export function census(root = ROOT) {
    const files = trackedFiles(root).filter(RUNTIME);
    const sites = [], events = new Map(), errors = [];
    for (const f of files) {
        let text, ast;
        try { text = fs.readFileSync(path.join(root, f), 'utf8'); if (!/MutationObserver|watchDom|eventSource|eventOn|tavern_events/.test(text)) continue; ast = parseJs(text, f); }
        catch (error) { errors.push(`${f}: ${error.message}`); continue; }
        // 옵션을 이름으로 넘긴 곳(const WATCH = {…}) — 같은 파일의 선언을 찾아요
        const consts = new Map();
        walk(ast, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init?.type === 'ObjectExpression') consts.set(n.id.name, n.init); });
        const src = n => text.slice(n.start, n.end).replace(/\s+/g, ' ');
        const line = n => n.loc.start.line;
        walk(ast, n => {
            if (n.type === 'NewExpression') {
                const c = n.callee;
                const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : '';
                if (name === 'MutationObserver') sites.push({ file: f, line: line(n), group: groupOf(f), kind: 'new' });
            }
            if (n.type !== 'CallExpression') return;
            const c = n.callee;
            if (c.type === 'MemberExpression' && !c.computed && c.property.name === 'observe' && n.arguments.length >= 2) {
                let optNode = n.arguments[1];
                if (optNode.type === 'Identifier' && consts.has(optNode.name)) optNode = consts.get(optNode.name);
                const opts = objectOpts(optNode, text);
                if (!opts || !Object.keys(opts).some(k => MO_KEYS.has(k))) return;
                const target = src(n.arguments[0]), where = classifyTarget(target);
                sites.push({ file: f, line: line(n), group: groupOf(f), kind: 'observe', target, where, opts, weight: weight('observe', where, opts) });
            }
            if (c.type === 'Identifier' && c.name === 'watchDom' && n.arguments.length >= 2) {
                const opts = objectOpts(n.arguments[1], text) || {};
                const target = src(n.arguments[0]), where = classifyTarget(target);
                sites.push({ file: f, line: line(n), group: groupOf(f), kind: 'hub', target, where, opts, weight: weight('hub', where, opts), name: typeof opts.name === 'string' ? opts.name : '' });
            }
            // eventSource.on(event_types.X, …) · eventSource.on(t.X, …) · eventOn(tavern_events.X, …)
            const isOn = (c.type === 'MemberExpression' && !c.computed && ['on', 'once', 'makeFirst', 'makeLast'].includes(c.property.name) && /eventSource|\bes\b|\bsource\b/.test(src(c.object)))
                || (c.type === 'Identifier' && ['eventOn', 'eventOnce', 'eventMakeFirst', 'eventMakeLast'].includes(c.name));
            if (isOn && n.arguments[0]) {
                const a = n.arguments[0];
                const ev = a.type === 'MemberExpression' && !a.computed && /^[A-Z_]+$/.test(a.property.name) ? a.property.name : a.type === 'Literal' ? String(a.value) : null;
                if (ev) { let e = events.get(ev); if (!e) events.set(ev, e = []); e.push(`${f}:${line(n)}`); }
            }
        });
    }
    return { files: files.length, sites, events, errors };
}

export function summarize(c, { includeScripts = true } = {}) {
    const keep = s => includeScripts || s.group !== 'scripts';
    const s = c.sites.filter(keep);
    const by = (k, v) => s.filter(x => x[k] === v);
    const observes = by('kind', 'observe');
    return {
        newSites: by('kind', 'new').length,
        observeSites: observes.length,
        hubSites: by('kind', 'hub').length,
        documentSubtree: observes.filter(x => x.weight === '문서'),
        chatSubtree: observes.filter(x => x.weight === '채팅'),
        hubDocument: by('kind', 'hub').filter(x => x.weight === '문서'),
        hubChat: by('kind', 'hub').filter(x => x.weight === '채팅'),
        byGroup: Object.fromEntries(['theme', 'addon', 'scripts'].map(g => [g, { new: s.filter(x => x.group === g && x.kind === 'new').length, observe: s.filter(x => x.group === g && x.kind === 'observe').length, hub: s.filter(x => x.group === g && x.kind === 'hub').length }])),
    };
}

function markdown(c) {
    const all = summarize(c), lean = summarize(c, { includeScripts: false });
    const out = [];
    out.push('# 감시 전수표 (tools/audit/observers.mjs 로 만든 것 — 손으로 고치지 말고 다시 만들어요)', '');
    out.push(`런타임 JS ${c.files}개 · new MutationObserver 자리 ${all.newSites}(내장 스크립트 빼면 ${lean.newSites}) · 직접 observe ${all.observeSites}(${lean.observeSites}) · 허브 구독 ${all.hubSites}`, '');
    out.push(`body · html 을 subtree 로 직접 보는 감시: ${all.documentSubtree.length}(내장 스크립트 빼면 **${lean.documentSubtree.length}**) · #chat subtree 직접: ${all.chatSubtree.length}(${lean.chatSubtree.length}) · 허브의 문서 구독 ${all.hubDocument.length} · 채팅 구독 ${all.hubChat.length}`, '');
    out.push('| 갈래 | 줄 | 방식 | 대상 | 옵션 | 부담 |', '|---|---|---|---|---|---|');
    for (const s of c.sites.filter(x => x.kind !== 'new').sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
        out.push(`| ${s.group} | \`${s.file}:${s.line}\` | ${s.kind === 'hub' ? '허브' + (s.name ? ` 「${s.name}」` : '') : 'observe'} | \`${s.target.slice(0, 60).replace(/\|/g, '\\|')}\` | ${describe(s.opts).replace(/\|/g, '\\|')} | ${s.weight} |`);
    }
    out.push('', '## 실리태번 이벤트 구독 (이벤트마다 자리 수)', '', '| 이벤트 | 자리 |', '|---|---:|');
    for (const [ev, list] of [...c.events].sort((a, b) => b[1].length - a[1].length)) out.push(`| ${ev} | ${list.length} |`);
    return out.join('\n') + '\n';
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
    const c = census();
    const all = summarize(c), lean = summarize(c, { includeScripts: false });
    const md = argValue('--md'), json = argValue('--json');
    if (md) { fs.mkdirSync(path.dirname(path.resolve(md)), { recursive: true }); fs.writeFileSync(md, markdown(c)); }
    if (json) writeJson(json, { ...c, events: Object.fromEntries(c.events), summary: { all, lean } });
    console.log(`런타임 JS ${c.files}개 — new MutationObserver ${all.newSites}(내장 스크립트 빼면 ${lean.newSites}) · 직접 observe ${all.observeSites}(${lean.observeSites}) · 허브 구독 ${all.hubSites}`);
    console.log(`  갈래별 new/observe/허브: ${Object.entries(all.byGroup).map(([g, v]) => `${g} ${v.new}/${v.observe}/${v.hub}`).join(' · ')}`);
    console.log(`  body · html subtree 직접 감시 ${all.documentSubtree.length}(내장 스크립트 빼면 ${lean.documentSubtree.length}) · #chat subtree 직접 ${all.chatSubtree.length}(${lean.chatSubtree.length}) · 허브 문서 구독 ${all.hubDocument.length} · 허브 채팅 구독 ${all.hubChat.length}`);
    for (const s of all.documentSubtree) console.log(`    문서 ${s.group} ${s.file}:${s.line} ${s.target} {${describe(s.opts)}}`);
    console.log(`  실리태번 이벤트 ${c.events.size}종 · 구독 자리 ${[...c.events.values()].reduce((n, l) => n + l.length, 0)}`);
    for (const e of c.errors) console.log('  [읽기 실패] ' + e);
    if (process.argv.includes('--check')) {
        const maxBody = Number(argValue('--max-body') ?? 0), maxNew = Number(argValue('--max-new') ?? Infinity), maxChat = Number(argValue('--max-chat') ?? Infinity);
        const bad = [];
        if (lean.documentSubtree.length > maxBody) bad.push(`body · html subtree 직접 감시 ${lean.documentSubtree.length} > ${maxBody} — watchDom(document.body, { subtree: true, exclude: '#chat', … }) 구독으로 옮겨요`);
        if (lean.newSites > maxNew) bad.push(`new MutationObserver 자리 ${lean.newSites} > ${maxNew}`);
        if (lean.chatSubtree.length > maxChat) bad.push(`#chat subtree 직접 감시 ${lean.chatSubtree.length} > ${maxChat} — src/message-decor.js(decorateMessage) 나 watchDom(chat, …) 으로`);
        if (c.errors.length) bad.push(`읽기 실패 ${c.errors.length}`);
        if (bad.length) { for (const b of bad) console.error('[실패] ' + b); process.exit(1); }
        console.log('ok 감시 상한 안');
    }
}
