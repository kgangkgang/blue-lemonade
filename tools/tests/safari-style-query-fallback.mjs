// 1.4.x 사파리(iOS 16 · 17 · 18) 호환 지킴:
//   ① @container style(--사용자 속성) 규칙(강제 색 밖)마다 같은 선언의 대체 규칙(html.bl-no-sq …)이 브라우저 호환 시트에 있어요 —
//      사파리 · iOS 18 앞과 파이어폭스는 style() 를 몰라 체크박스 · 몇 곳의 모양이 통째로 빠졌어요(실리태번 기본 체크박스).
//   ② 대체 규칙은 크로미움이 받는 시트(style.css · 둘째 장 · 뗀 시트)에는 없어요(restyle3 비용이 다시 생기지 않게).
//   ③ src/compat-css.js 가 style() 를 모르는 엔진에서만 html 에 bl-no-sq 를 달아요(못 재는 가짜 문서는 달지 않아요).
//   ④ 내보내는 시트의 user-select · backdrop-filter 는 같은 규칙 칸에 -webkit- 짝이 있어요(사파리 18 앞은 backdrop-filter 를, 사파리는 18 까지 user-select 를 접두로만 읽어요).
//   node tools/tests/safari-style-query-fallback.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const L = require(path.join(root, 'tools/css-lib.cjs'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('ok', name); };

const rulesOf = css => {
    const out = [];
    const walk = nodes => { for (const n of nodes) { if (n.type === 'rule') out.push(n); else if (n.children) walk(n.children); } };
    const tree = L.parse(css);
    walk(tree.children);
    return out.map(n => ({ selector: n.selector, ctx: n.ctx || [], body: css.slice(n.bodyStart, n.bodyEnd) }));
};
const declsOf = body => body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\{/, '').split(';').map(s => s.replace(/\s+/g, '').trim()).filter(Boolean).sort().join(';');

const FULL = 'src/style-lazy.gen.css';   // 원래 모듈 차례 전체(첫 장 · 뗀 시트로 나뉘기 전)
const COMPAT = 'src/compat-browser.gen.css';
const CHROMIUM_SHEETS = ['style.css', 'src/style-lazy.gen.css', 'src/lazy-panel.gen.css', 'src/markdown.gen.css', 'src/gate-outline.gen.css', 'src/gate-type.gen.css', 'src/panel.gen.css', 'src/preview.gen.css', 'style-ext.css'].filter(f => fs.existsSync(path.join(root, f)));

// 대체 규칙을 안 둔 style() — 옛 꼴로 옮기면 주어 아닌 :has 가 늘어(tools/tests/has-guard.mjs 기준 93 · has-invalidation-scope) 넣지 않았어요.
// 둘 다 꾸밈(굵기 · 흐리게)이라 style() 를 모르는 엔진에서는 그것만 빠져요(허브 지시-1114/사파리-호환/보고.md)
const NO_FALLBACK = ['--bl-pm-group-name', '--bl-cc-null-dim'];

await test('style() 규칙마다 같은 선언의 bl-no-sq 대체 규칙이 브라우저 호환 시트에 있어요', () => {
    const queried = rulesOf(read(FULL)).filter(r => r.ctx.some(c => /^@container\b[^{]*\bstyle\(/i.test(c)) && !r.ctx.some(c => /forced-colors/i.test(c)))
        .filter(r => !NO_FALLBACK.some(name => r.ctx.some(c => c.includes(`style(${name}:`))));
    assert.equal(rulesOf(read(FULL)).filter(r => NO_FALLBACK.some(name => r.ctx.some(c => c.includes(`style(${name}:`)))).length, NO_FALLBACK.length, '예외 목록의 style() 규칙은 하나씩');
    assert.ok(queried.length >= 19,`style() 규칙 ${queried.length}개 — 너무 적어요(읽기 꼴이 바뀌었나요)`);
    const fallbacks = rulesOf(read(COMPAT)).filter(r => /\.bl-no-sq\b/.test(r.selector));
    const left = new Map();
    for (const r of fallbacks) { const k = declsOf(r.body); left.set(k, (left.get(k) || 0) + 1); }
    const missing = [];
    for (const r of queried) {
        const k = declsOf(r.body);
        if (left.get(k)) left.set(k, left.get(k) - 1); else missing.push(`${r.ctx.find(c => /style\(/.test(c))} ${r.selector.slice(0, 90)}`);
    }
    assert.deepEqual(missing, [], `대체 규칙이 없는 style() 규칙 — css/ 에 html.bl-no-sq 옛 꼴을 같이 적어요:\n${missing.join('\n')}`);
    assert.equal(fallbacks.length, queried.length, '대체 규칙 수 = style() 규칙 수');
});

await test('대체 규칙은 크로미움이 받는 시트에 없어요', () => {
    for (const f of CHROMIUM_SHEETS) assert.ok(!/\.bl-no-sq\b/.test(read(f)), `${f} 에 bl-no-sq 규칙이 남았어요`);
    assert.match(read('tools/css-compat.cjs'), /BROWSER_SEL = [^\n]*bl-no-sq/);
});

await test('compat-css.js: style() 를 모르는 엔진에서만 bl-no-sq', async () => {
    const { attachCompat, lacksStyleQueries } = await import(pathToFileURL(path.join(root, 'src/compat-css.js')).href);
    const make = (answer) => {
        const classes = new Set(), nodes = [];
        const el = (tag) => {
            const node = { tagName: tag, style: {}, children: [], isConnected: false, attrs: {},
                setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, append(...xs) { for (const x of xs) { this.children.push(x); x.parent = this; } },
                get firstChild() { return this.children[0] || null; },
                remove() { this.isConnected = false; const i = nodes.indexOf(this); if (i >= 0) nodes.splice(i, 1); },
                after(x) { nodes.splice(nodes.indexOf(node) + 1, 0, x); x.isConnected = true; }, before(x) { nodes.splice(nodes.indexOf(node), 0, x); x.isConnected = true; } };
            return node;
        };
        const theme = el('link'); theme.id = 'theme'; theme.isConnected = true; nodes.push(theme);
        const doc = {
            styleSheets: [{ href: new URL('../style.css', pathToFileURL(path.join(root, 'src/compat-css.js'))).href, ownerNode: theme }],
            getElementById: id => nodes.find(x => x.id === id) || null,
            createElement: el,
            head: el('head'), body: el('body'),
            documentElement: { classList: { add: c => classes.add(c) } },
        };
        const win = { document: doc, navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 },
            getComputedStyle: () => ({ getPropertyValue: name => (name === '--bl-sq-ok' ? answer : '') }) };
        return { win, classes };
    };
    const old = make('');            // 사파리 17 처럼 style() 를 모름
    assert.equal(lacksStyleQueries(old.win), true);
    attachCompat('browser', old.win);
    assert.ok(old.classes.has('bl-no-sq') && old.classes.has('bl-apple-webkit'));
    const fresh = make(' 1');        // 사파리 18 · 크로미움처럼 앎
    attachCompat('browser', fresh.win);
    assert.ok(!fresh.classes.has('bl-no-sq') && fresh.classes.has('bl-apple-webkit'));
    assert.equal(lacksStyleQueries({ document: {} }), false, '못 재는 문서는 달지 않아요');
    assert.equal(lacksStyleQueries(undefined), false);
});

await test('내보내는 시트의 user-select · backdrop-filter 는 같은 칸에 -webkit- 짝이 있어요', () => {
    const sheets = [...CHROMIUM_SHEETS, COMPAT, 'src/compat-width.gen.css', 'src/addons/style-addons.css', 'src/addons/style-addons.gated.gen.css', 'src/addons/style-addons.boot.gen.css', 'src/addons/style-addons.gated.boot.gen.css'].filter(f => fs.existsSync(path.join(root, f)));
    const bad = [];
    for (const f of sheets) for (const r of rulesOf(read(f))) {
        const body = r.body.replace(/\/\*[\s\S]*?\*\//g, '');
        for (const prop of ['user-select', 'backdrop-filter']) {
            if (new RegExp(`(^|[;{\\s])${prop}\\s*:`).test(body) && !new RegExp(`-webkit-${prop}\\s*:`).test(body)) bad.push(`${f}: ${prop} — ${r.selector.slice(0, 80)}`);
        }
    }
    assert.deepEqual(bad, [], `-webkit- 짝이 없는 규칙:\n${bad.join('\n')}`);
});

await test('CI 가 이 시험을 돌려요', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/safari-style-query-fallback\.mjs \./);
});

console.log(`PASS safari-style-query-fallback ${passed}`);
