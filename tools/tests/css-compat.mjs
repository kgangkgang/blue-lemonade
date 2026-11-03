// 1.0.0 크로미움 밖 브라우저 · 다른 화면 폭 규칙 — 되살린 규칙이 첫 시트(style.css) 밖 두 장에만 있고, 조건이 맞을 때만 붙는지
//   · 빌드(tools/css-compat.cjs): style.css 에는 크로미움 최신 · 폰 384 · PC 1280 에서 절대 안 맞는 규칙이 없고, 떼어 낸 두 장에는 그런 규칙만 있어요
//   · style.css 첫 :root 표식(--bl-compat-supports · --bl-compat-media)이 떼어 낸 규칙의 조건과 같아요
//   · src/lite.js loadCompatCss: 크롬(안드로이드 · PC, http 로 열어 userAgentData 가 없어도) · 폰 384 · PC 1280 이면 아무것도 안 받고,
//     파이어폭스 · 사파리 · iOS · 옛 엔진 · 강제 색 · 380/360 폭 · 1000 이하 + 마우스면 받아요(창 크기가 바뀌어 맞게 되면 그때)
//   · src/compat-css.js attachCompat: 테마 시트 바로 뒤에 <link> 하나씩(두 번 불러도 하나), 애플 웹킷이면 html 에 bl-apple-webkit
//   node tools/tests/css-compat.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const lib = require(path.join(root, 'tools/css-lib.cjs'));
const compat = require(path.join(root, 'tools/css-compat.cjs'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
const rules = css => { const out = []; const walk = ns => { for (const x of ns) { if (x.type === 'rule') out.push(x); else if (x.children) walk(x.children); } }; const t = lib.parse(css); assert.equal(t.problems.length, 0, t.problems[0]); walk(t.children); return out; };

const style = read('style.css'), browserCss = read('src/compat-browser.gen.css'), widthCss = read('src/compat-width.gen.css');
const PHONE = compat.PROFILES[0], PC = compat.PROFILES[1];

await test('미디어 판정: 폰 384 · PC 1280 기준(모르는 조건은 판정하지 않아요)', () => {
    assert.equal(compat.media('@media screen and (max-width: 380px)', PHONE), false);
    assert.equal(compat.media('@media (max-width:360px)', PC), false);
    assert.equal(compat.media('@media screen and (max-width: 1000px) and (hover: hover)', PHONE), false);
    assert.equal(compat.media('@media screen and (max-width: 1000px) and (hover: hover)', PC), false);
    assert.equal(compat.media('@media (max-width: 760px), (pointer: coarse)', PHONE), true);
    assert.equal(compat.media('@media (max-width: 760px), (pointer: coarse)', PC), false);
    assert.equal(compat.media('@media (max-width: 24em)', PHONE), true, '24em = 384px');
    assert.equal(compat.media('@media not all and (max-width: 1000px)', PC), true);
    assert.equal(compat.media('@media (max-height: 500px)', PHONE), null);
    assert.equal(compat.media('@media (prefers-reduced-motion: reduce)', PC), null);
});
await test('style.css 에는 크로미움 최신 · 폰 384 · PC 1280 에서 절대 안 맞는 규칙이 없어요(전부 떼어 냄)', () => {
    const left = rules(style).filter(r => compat.kindOf(r));
    assert.deepEqual(left.map(r => `${r.ctx.join(' / ')} ${r.selector}`.slice(0, 120)), []);
});
await test('브라우저 시트: 크로미움 밖 규칙만 · 되살린 갈래(@supports not · -moz- · 강제 색 · 애플 웹킷)가 다 있어요', () => {
    const list = rules(browserCss);
    assert.ok(list.length >= 20, `규칙 ${list.length}`);
    assert.ok(list.every(r => compat.browserOnly(r)), '크로미움에서 맞을 수 있는 규칙이 섞임');
    for (const want of ['@supports not', '-moz-range', 'forced-colors', 'bl-apple-webkit', 'subgrid']) assert.ok(browserCss.includes(want), want);
});
await test('폭 시트: 폰 384 · PC 1280 둘 다에서 거짓인 @media 규칙만 · 380 · 360 · 1000 이하 + 마우스가 있어요', () => {
    const list = rules(widthCss);
    assert.ok(list.length >= 5, `규칙 ${list.length}`);
    assert.ok(list.every(r => compat.widthOnly(r) && !compat.browserOnly(r)));
    for (const want of ['max-width: 380px', 'max-width:360px', '(hover: hover)']) assert.ok(widthCss.includes(want), want);
});
const first = rules(style)[0];
const mark = name => (first.decls.find(d => d.lname === name)?.value || '').trim().replace(/^"|"$/g, '').split('|').filter(Boolean);
await test('style.css 첫 :root 표식이 떼어 낸 규칙의 조건과 같아요', () => {
    assert.equal(first.selector, ':root');
    const sup = [...new Set(rules(browserCss).flatMap(r => r.ctx.filter(c => /^@supports\s+not\b/i.test(c)).map(c => c.replace(/^@supports\s+/i, '').replace(/\s+/g, ' ').trim())))];
    assert.deepEqual(mark('--bl-compat-supports').sort(), sup.sort());
    assert.ok(sup.length >= 5, '@supports not 조건이 다섯 이상(:has · subgrid · 컨테이너 · scrollbar-gutter · font-synthesis · mask-clip)');
    const med = [...new Set(rules(widthCss).map(r => r.ctx.filter(c => /^@media\b/i.test(c)).map(c => c.replace(/^@media\s*/i, '').replace(/\s+/g, ' ').trim()).join(' & ')))];
    assert.deepEqual(mark('--bl-compat-media').sort(), med.sort());
});
await test('기본 시트 크기: 표식 · 대체 선언만큼만(떼어 낸 시트는 첫 시트에 없음)', () => {
    assert.ok(!style.includes('-moz-range') && !style.includes('forced-colors') && !style.includes('bl-apple-webkit'));
    assert.ok(!/@supports not/.test(style.replace(/^:root\{[^}]*\}/m, '')));
});

// ── lite.js loadCompatCss: 글에서 함수를 꺼내 가짜 창으로 돌려요 ──
const liteSrc = read('src/lite.js');
const fnSrc = liteSrc.match(/export function loadCompatCss\(win = window\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(fnSrc, 'lite.js 에 loadCompatCss');
const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const UAS = {
    chrome: CHROME_UA,
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1',
};
function fakeWin({ ua = CHROME_UA, width = 384, pointer = 'coarse', hover = 'none', engine = 'chromium', forced = false }) {
    const listeners = [];
    const env = { width, pointer, hover, orientation: width > 800 ? 'landscape' : 'portrait' };
    const evalQ = q => (/forced-colors/.test(q) ? forced : compat.media(`@media ${q}`, env) === true);
    const win = {
        navigator: { userAgent: ua, platform: /Mac/.test(ua) ? 'MacIntel' : 'Linux', maxTouchPoints: pointer === 'coarse' ? 5 : 0 },
        CSS: { supports: c => engine === 'gecko' ? c === '-moz-appearance: none' : engine === 'old' ? /^not selector\(:has/.test(c) : false },
        matchMedia: q => ({ get matches() { return evalQ(q); }, addEventListener: (type, fn) => listeners.push({ q, fn }), removeEventListener() {} }),
    };
    return { win, listeners, env, resize(w, p = pointer, h = hover) { env.width = w; env.pointer = p; env.hover = h; for (const l of listeners) l.fn({ matches: evalQ(l.q) }); } };
}
function runLoader(fake) {
    const asked = [];
    const sheet = { cssRules: [{ selectorText: ':root', style: { getPropertyValue: name => first.decls.find(d => d.lname === name)?.value || '' } }] };
    const body = fnSrc.replace('export function loadCompatCss(win = window)', 'return function loadCompatCss(win)').replace("import('./compat-css.js')", 'Promise.resolve(__mod)');
    const fn = new Function('themeSheet', '__mod', body)(() => sheet, { attachCompat: what => { asked.push(what); } });
    const state = fn(fake.win);
    return { state, asked: () => [...new Set(asked)] };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const cases = [
    ['안드로이드 크롬 폰 384(http · userAgentData 없음)', { ua: UAS.chrome }, []],
    ['PC 엣지 1280 · 마우스', { ua: UAS.edge, width: 1280, pointer: 'fine', hover: 'hover' }, []],
    ['태블릿 768 크롬(중간 폭은 style.css 안 원래 중단점)', { ua: UAS.chrome, width: 768 }, []],
    ['파이어폭스 PC', { ua: UAS.firefox, width: 1280, pointer: 'fine', hover: 'hover', engine: 'gecko' }, ['browser']],
    ['사파리 맥', { ua: UAS.safari, width: 1280, pointer: 'fine', hover: 'hover' }, ['browser']],
    ['iOS 크롬(웹킷)', { ua: UAS.iosChrome, width: 390 }, ['browser']],
    ['옛 크로미움(:has 없음)', { ua: UAS.chrome, engine: 'old' }, ['browser']],
    ['크롬 + 강제 색', { ua: UAS.edge, width: 1280, pointer: 'fine', hover: 'hover', forced: true }, ['browser']],
    ['크롬 폰 360', { ua: UAS.chrome, width: 360 }, ['width']],
    ['PC 900 · 마우스', { ua: UAS.edge, width: 900, pointer: 'fine', hover: 'hover' }, ['width']],
    ['파이어폭스 폰 360', { ua: UAS.firefox, width: 360, engine: 'gecko' }, ['browser', 'width']],
];
for (const [name, opt, want] of cases) await test(`loadCompatCss — ${name}: ${want.length ? want.join(' · ') : '받지 않음'}`, async () => {
    const r = runLoader(fakeWin(opt));
    await settle();
    assert.deepEqual(r.asked().sort(), [...want].sort());
});
await test('loadCompatCss — PC 1280 에서 창을 900 으로 줄이면 그때 폭 시트 · 강제 색을 켜면 그때 브라우저 시트', async () => {
    const fake = fakeWin({ ua: UAS.edge, width: 1280, pointer: 'fine', hover: 'hover' });
    const r = runLoader(fake);
    await settle();
    assert.deepEqual(r.asked(), []);
    fake.resize(900);
    await settle();
    assert.deepEqual(r.asked(), ['width']);
    for (const l of fake.listeners.filter(l => /forced-colors/.test(l.q))) l.fn({ matches: true });
    await settle();
    assert.deepEqual(r.asked().sort(), ['browser', 'width']);
});
await test('loadCompatCss — 테마 시트를 아직 못 읽으면 null (index.js 가 조금 뒤 다시)', () => {
    const body = fnSrc.replace('export function loadCompatCss(win = window)', 'return function loadCompatCss(win)');
    assert.equal(new Function('themeSheet', body)(() => null)({}), null);
    assert.match(read('index.js'), /startSafe\('loadCompatCss', \(\) => \{ if \(!loadCompatCss\(\)\) setTimeout\(/);
});

// ── compat-css.js attachCompat ──
await test('attachCompat: 테마 시트 바로 뒤 · 브라우저 → 폭 차례 · 두 번 불러도 하나 · 애플 웹킷 표시', async () => {
    const { attachCompat, isAppleWebkit } = await import(pathToFileURL(path.join(root, 'src/compat-css.js')).href);
    const nodes = [];
    const node = (tag, attrs = {}) => {
        const el = { tagName: tag, ...attrs, isConnected: false, addEventListener() {}, remove() { const i = nodes.indexOf(el); if (i >= 0) nodes.splice(i, 1); el.isConnected = false; },
            after(x) { nodes.splice(nodes.indexOf(el) + 1, 0, x); x.isConnected = true; }, before(x) { nodes.splice(nodes.indexOf(el), 0, x); x.isConnected = true; } };
        return el;
    };
    const theme = node('link', { id: 'theme' }); nodes.push(theme); theme.isConnected = true;
    const other = node('style', { id: 'after' }); nodes.push(other); other.isConnected = true;
    const classes = new Set();
    const doc = {
        styleSheets: [{ href: new URL('../style.css', pathToFileURL(path.join(root, 'src/compat-css.js'))).href, ownerNode: theme }],
        getElementById: id => nodes.find(x => x.id === id) || null,
        createElement: tag => node(tag),
        documentElement: { classList: { add: c => classes.add(c) } },
    };
    const win = { document: doc, navigator: { userAgent: UAS.safari, platform: 'MacIntel', maxTouchPoints: 0 } };
    attachCompat('width', win);
    attachCompat('browser', win);
    attachCompat('browser', win);
    assert.deepEqual(nodes.map(x => x.id), ['theme', 'salty-compat-browser', 'salty-compat-width', 'after']);
    assert.match(nodes[1].href, /compat-browser\.gen\.css$/);
    assert.match(nodes[2].href, /compat-width\.gen\.css$/);
    assert.ok(classes.has('bl-apple-webkit'));
    assert.equal(isAppleWebkit({ userAgent: CHROME_UA }), false);
    assert.equal(isAppleWebkit({ userAgent: UAS.iosChrome }), true);
});
await test('CI 가 이 시험을 돌리고, 생성물 단계가 두 시트도 다시 만들어 견줘요', () => {
    const ci = read('.github/workflows/release-check.yml');
    assert.match(ci, /node tools\/tests\/css-compat\.mjs \./);
    assert.match(read('tools/build-css.cjs'), /compat-browser\.gen\.css[\s\S]*compat-width\.gen\.css/);
});
await test('전체 교체·늦은 폭 조건·브라우저 조건은 도착 순서와 관계없이 같은 순서예요', async () => {
    const { attachCompat } = await import(pathToFileURL(path.join(root, 'src/compat-css.js')).href);
    for (const order of [['full','width','browser'], ['browser','full','width'], ['width','full','browser'], ['browser','width','full']]) {
        const nodes = [];
        const node = id => {
            const el = { id, isConnected: false, addEventListener() {}, remove() { const i = nodes.indexOf(el); if(i >= 0) nodes.splice(i,1); el.isConnected=false; },
                after(x) { x.remove(); nodes.splice(nodes.indexOf(el)+1,0,x); x.isConnected=true; },
                before(x) { x.remove(); nodes.splice(nodes.indexOf(el),0,x); x.isConnected=true; } };
            return el;
        };
        const theme = node('theme'), other = node('after'); theme.isConnected=other.isConnected=true; nodes.push(theme,other);
        const doc = { styleSheets:[{href:new URL('../style.css',pathToFileURL(path.join(root,'src/compat-css.js'))).href,ownerNode:theme}],
            getElementById:id=>nodes.find(n=>n.id===id)||null,createElement:()=>node(''),documentElement:{classList:{add(){}}} };
        const win = { document:doc,navigator:{userAgent:UAS.safari,platform:'MacIntel',maxTouchPoints:0} };
        for(const step of order) {
            if(step==='full') theme.after(node('salty-lazy-css'));
            else attachCompat(step,win);
        }
        assert.deepEqual(nodes.map(n=>n.id),['theme','salty-lazy-css','salty-compat-browser','salty-compat-width','after'],order.join(' → '));
        // 전체 파일 받기가 실패해 임시 노드가 없어졌다가 재시도해도 호환 시트는 남고 순서가 같아요.
        doc.getElementById('salty-lazy-css').remove();
        assert.deepEqual(nodes.map(n=>n.id),['theme','salty-compat-browser','salty-compat-width','after']);
        theme.after(node('salty-lazy-css')); attachCompat('width',win); attachCompat('browser',win);
        assert.deepEqual(nodes.map(n=>n.id),['theme','salty-lazy-css','salty-compat-browser','salty-compat-width','after']);
    }
});
console.log(`css-compat: ${n} passed`);
