// 1.1.1 restyle2: 되돌린 상태 바닥(문서 전체 다시 계산)의 「모든 요소와 견주는」 규칙 줄이기 — 빌드(css-bucket 안쪽 펼치기 · css-key 주어 풀기 확장) ·
//   런타임 시트(fruit-type stCss 맨 오른쪽 class 나누기 · dem-glow class 목록). 모양은 같아야 해요(특이도 · 고르는 요소 집합 그대로).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const K = require(path.join(root, 'tools/css-key.cjs'));
const B = require(path.join(root, 'tools/css-bucket.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('ok', name); };
const spec = s => L.spec(s).join('.');
const lastCompound = sel => { const segs = K.segments(sel); return sel.slice(segs[segs.length - 1][0]); };

await check('css-key 주어 풀기: :is( … ) 뒤의 :where(지킴) 은 안쪽 마지막 칸에 그대로 붙여요', () => {
    const sel = 'body.salty :is(#loader.splash-screen *):where(:not([data-bl-native-ext-colors], [data-bl-native-ext-colors] *))';
    const u = K.unwrapSubject(sel);
    assert.equal(u.text, 'body.salty #loader.splash-screen *:where(:not([data-bl-native-ext-colors], [data-bl-native-ext-colors] *))');
    assert.equal(u.back, sel);
    assert.equal(spec(u.text), spec(sel));
    const pe = K.unwrapSubject('body.salty :is(#a .b):where(.g)::before');
    assert.equal(pe.text, 'body.salty #a .b:where(.g)::before');
});
await check('css-key 주어 풀기: 머리가 html 이고 안쪽 첫 칸이 body 태그면 풀어요(과일 하트 형제 규칙) — 아니면 그대로', () => {
    const sel = 'html:not(#bl-scrollbars-on) :is(body.salty ~ #fruit-heart-v6 *)::-webkit-scrollbar';
    const u = K.unwrapSubject(sel);
    assert.equal(u.text, 'html:not(#bl-scrollbars-on) body.salty ~ #fruit-heart-v6 *::-webkit-scrollbar');
    assert.equal(spec(u.text), spec(sel));
    assert.equal(K.unwrapSubject('html :is(.x *)'), null, 'html 머리에 body 아닌 첫 칸은 안 풀어요(html 자신이 .x 일 수 있음)');
    assert.equal(K.unwrapSubject('div :is(.x *)'), null, 'body · html 아닌 머리는 그대로');
    assert.equal(K.unwrapSubject('body.salty :is(body *)'), null, 'body 머리에 body 첫 칸은 그대로');
});
await check('css-bucket 안쪽 펼치기: `div:is(.a, .b)` 는 `div.a, div.b` 로 (특이도 · 갈래 집합 같음) · `:is(.bl-s, *)` 보정 · 가상 요소 뒤는 안 봄', () => {
    const st = { rules: 0, expanded: 0, inner: 0, whereWrapped: 0, wrapped: 0, skipRisky: 0 };
    const sel = 'html body.salty :is(#WorldInfo, #left-nav-panel) div:is(.fa-circle-question, .fa-question-circle):not(:is(a, button))';
    const out = B.expandOne(sel, st);
    assert.deepEqual(out, ['html body.salty :is(#WorldInfo, #left-nav-panel) div.fa-circle-question:not(:is(a, button))', 'html body.salty :is(#WorldInfo, #left-nav-panel) div.fa-question-circle:not(:is(a, button))']);
    for (const o of out) assert.equal(spec(o), spec(sel));
    assert.equal(st.inner, 1);
    assert.deepEqual(B.expandOne('body.salty .x:is(.bl-s, *)', st), ['body.salty .x:is(.bl-s, *)'], '특이도 보정(* 갈래)은 그대로');
    assert.deepEqual(B.expandOne('body.salty div:is(#x, .y)::before', st), ['body.salty div#x::before', 'body.salty div:where(.y):is(#bl-s, *)::before'], '특이도가 다른 갈래는 :where + 보정');
    assert.deepEqual(B.expandOne('div::before:is(.b, .c)', st), ['div::before:is(.b, .c)'], '가상 요소 뒤는 안 봄');
    assert.deepEqual(B.expandOne('div:is(.a .b, .c)', st), ['div:is(.a .b, .c)'], '결합자 든 갈래는 안 펼침');
    assert.deepEqual(B.expandOne('.p:where(.a, .b) > .q', st), ['.p:where(.a, .b) > .q'], '맨 오른쪽 칸이 아니면 그대로');
    // 이미 이름이 드러난 칸(class · 속성 · 드문 태그)은 늘리지 않아요 — 바구니가 같은데 갈래만 늘어요
    assert.deepEqual(B.expandOne('body.salty .menu_button:is(.redWarningBG, .red_button)', st), ['body.salty .menu_button:is(.redWarningBG, .red_button)'], 'class 뒤는 그대로');
    assert.deepEqual(B.expandOne('body i:is(.fa-chevron-down, .fa-chevron-up)', st), ['body i:is(.fa-chevron-down, .fa-chevron-up)'], 'div · span 아닌 태그는 그대로(태그 바구니로 충분)');
    assert.deepEqual(B.expandOne('body input:is([type="text"], [type="number"])', st), ['body input:is([type="text"], [type="number"])'], '이름 없는 갈래(속성만)는 그대로');
    assert.deepEqual(B.expandOne('body :not(.y):is(.a, .b)', st), ['body :not(.y).a', 'body :not(.y).b'], '태그 없는 칸도 펼침');
    // 맨 앞 태그 :is 뒤에 class :is 가 오면(도움말 ? 아이콘) 태그가 아니라 class 를 펼쳐요 — 4×4 가 아니라 4갈래
    assert.deepEqual(B.expandOne('body :is(i, span, div, small):is(.q, .w)', st), ['body :is(i, span, div, small).q', 'body :is(i, span, div, small).w']);
    assert.deepEqual(B.expandOne(':is(i, span).x', st), [':is(i, span).x'], '태그 :is 뒤에 이름이 있으면 태그로 안 펼침(이미 class 바구니)');
    assert.deepEqual(B.expandOne(':is(.a, .b).x', st), ['.a.x', '.b.x'], 'class 갈래는 예전처럼 펼침');
    assert.deepEqual(B.expandOne(':is(i, span) .x', st), [':is(i, span) .x'], '맨 오른쪽 칸이 아니면 손대지 않음');
});
await check('빌드된 시트: 도움말 ? 아이콘 규칙은 class 로 펼쳐져 있고, 스플래시 · 과일 하트 · 대화창 머리의 :is(결합자) 주어가 풀려 있어요', () => {
    const built = fs.readFileSync(path.join(root, 'style.css'), 'utf8') + fs.readFileSync(path.join(root, 'src/style-lazy.gen.css'), 'utf8');
    assert.ok(!/\bdiv:is\(\.fa-circle-question/.test(built), 'div:is(.fa-…) 가 남아 있어요');
    assert.ok(/:is\(i, span, div, small\)\.fa-circle-question:not\(/.test(built), '태그 :is 는 그대로 두고 class 만 펼쳐요(4갈래 · 16갈래 아님)');
    assert.ok(!built.includes(':is(#loader.splash-screen *)'), '스플래시 주어가 안 풀렸어요');
    assert.ok(!built.includes(':is(body.salty ~ #fruit-heart-v6 *)'), '과일 하트 형제 주어가 안 풀렸어요');
    assert.ok(!/:is\(:is\(dialog\.bl-translator-dialog/.test(built), '대화창 머리 주어가 안 풀렸어요');
    // 맨 오른쪽 칸이 div · span · 태그 없음 뒤 여러 갈래 class :is 인 갈래(안쪽 펼치기 대상)는 남아 있지 않아요 · :is(…):where(지킴) 주어도 없어요
    let inner = 0, guarded = 0;
    const tree = L.parse(built);
    const keyed = t => t.kind === 'pseudo' && /^(is|where)$/.test(t.name) && t.args != null && L.topSplit(t.args).length === 1 && /^[.#]/.test(t.args.trim()) && L.compounds(t.args.trim()).length === 1;   // css-key 열쇠 `:where(.k)` 는 이름
    const innerLeft = last => { const ts = K.tokens(last.split('::')[0]); if (ts.some(t => t.kind === 'id' || t.kind === 'class' || t.kind === 'attr' || keyed(t))) return false;
        const tags = ts.filter(t => t.kind === 'tag'); if (tags.length && !tags.some(t => /^(div|span)$/i.test(t.text))) return false;
        return ts.some(t => t.kind === 'pseudo' && /^(is|where)$/.test(t.name) && t.args != null && L.topSplit(t.args).length > 1 && L.topSplit(t.args).every(a => L.compounds(a.trim()).length === 1 && /^[.#]/.test(a.trim()) && !a.includes('*'))); };
    const walk = ns => { for (const n of ns) { if (n.type === 'rule') for (const p of L.topSplit(n.selector)) { const last = lastCompound(p); if (innerLeft(last)) inner++; if (/^:is\([^()]+\)(:where\()/.test(last)) guarded++; } else if (n.children) walk(n.children); } };
    walk(tree.children);
    assert.ok(inner <= 8, `div · span 뒤 여러 갈래 class :is 주어 ${inner}갈래(한도 8)`);
    assert.equal(guarded, 0, `:is(…):where(지킴) 꼴 주어 ${guarded}갈래`);
});
await check('fruit-type 시트: 맨 오른쪽 칸의 첫 class 는 .a · .custom-a 두 갈래로, 조상 칸은 :is 로 — 특이도 · 합집합 같음', async () => {
    const { stCss, stSelector, fruitTypeCss, fruitDecorCss, tidyFruitType, splitList } = await load('src/fruit-type-schema.js');
    assert.equal(stCss('.a .b{x:1}'), ':is(.a,.custom-a) .b,:is(.a,.custom-a) .custom-b{x:1}');
    assert.equal(stCss('.c{x:0.5}'), '.c,.custom-c{x:0.5}');
    assert.equal(stCss('.x:not(.y)::before{a:1}'), '.x:not(:is(.y,.custom-y))::before,.custom-x:not(:is(.y,.custom-y))::before{a:1}');
    assert.equal(stCss(':is(.p,.q) .r{a:1}'), ':is(:is(.p,.custom-p),:is(.q,.custom-q)) .r,:is(:is(.p,.custom-p),:is(.q,.custom-q)) .custom-r{a:1}');
    assert.equal(stCss('.h :is(.p,.q){a:1}'), ':is(.h,.custom-h) .p,:is(.h,.custom-h) .custom-p,:is(.h,.custom-h) .q,:is(.h,.custom-h) .custom-q{a:1}', '맨 오른쪽 칸이 :is(.a,.b) 면 갈래마다');
    assert.equal(stCss('.g .content *{t:inherit}'), ':is(.g,.custom-g) :is(.content,.custom-content) *{t:inherit}', '주어가 * 면 그대로');
    assert.equal(stCss('.custom-a .custom-b{x:1}'), '.custom-a .custom-b{x:1}');
    assert.equal(stSelector('.dem-track'), ':is(.dem-track,.custom-dem-track)', '요소 고르기용 stSelector 는 그대로');
    for (const [a, b] of [['.a .b', ':is(.a,.custom-a) .b'], ['.x:not(.y)::before', '.x:not(:is(.y,.custom-y))::before']]) assert.equal(spec(b), spec(stSelector(a)));
    // 실제 시트: 모든 종류를 켜고 만든 규칙의 갈래마다 맨 오른쪽 칸이 여러 갈래 :is 로 시작하지 않아요
    const s = tidyFruitType({ ownerOn: { deus: true, fruit: true, sola: true } });
    for (const t of Object.values(s.types)) for (const r of Object.values(t.regions)) r.on = true;
    const css = fruitTypeCss(s) + '\n' + fruitDecorCss(s);
    let branches = 0;
    for (const m of css.matchAll(/(^|[}\n])([^{}]+)\{/g)) for (const p of splitList(m[2])) {
        const last = lastCompound(p.trim()); branches++;
        // 갈래에 결합자가 든 :is(.a, .b > span) 만 남아요(머리를 갈래 안으로 넣으면 뜻이 달라질 수 있어 안 펼침 · 2갈래)
        const m2 = /^:is\(/.test(last) ? L.topSplit(last.slice(4, L.endParen(last, 3))) : null;
        if (m2 && m2.length > 1) assert.ok(m2.some(a => L.compounds(a.trim()).length > 1), `여러 갈래 :is 주어가 남았어요: ${p.trim().slice(0, 160)}`);
    }
    assert.ok(branches > 200, `갈래 ${branches}`);
});
await check('dem-glow 시트: :is(.a, .b, .c) 대신 class 갈래 셋', async () => {
    const { demGlowCss } = await load('src/dem-glow.js');
    assert.equal(demGlowCss('0.5'), '.custom-dem-modules, .custom-dem-track, .custom-dem-track-recovery { --bl-dem-glow: 0.5; }');
    assert.ok(!demGlowCss('0.5', '0.3').includes(':is(.custom'));
    assert.ok(demGlowCss('0.5', '0.3').includes(':is(.salty-panel, .bl-ft-sample-host) .custom-dem-track-recovery { --bl-dem-glow: 0.5; }'));
});
await check('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/css-restyle2\.mjs \./);
});
console.log(`css-restyle2: ${passed} passed`);
