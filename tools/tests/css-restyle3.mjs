// 1.1.1 restyle3: class 속성 선택자([class…] · :not([class]))가 조상 칸에 있고 주어가 맨 태그인 갈래 줄이기.
//   크로미움은 그런 규칙이 하나라도 있으면 어느 요소든 class 가 바뀔 때마다 그 아래를 훑어 주어 태그에 맞는 요소를 전부
//   다시 계산 대상으로 표시해요 — 접힌(content-visibility) 메시지 안까지. body class 하나에 div 수만 개가 표시돼
//   2,000개 바닥(110ms)의 대부분이 됐어요(주어가 class · id · 속성이면 훑기만 하고 표시는 몇 개라 ~5ms).
//   고친 꼴: 조상 칸의 표시를 물려주지 않는 사용자 속성(@property inherits:false)으로 달고 자식은 @container style() 로 물어요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const K = require(path.join(root, 'tools/css-key.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('ok', name); };

const CLASS_ATTR = /\[\s*class\s*([~|^$*]?=|\])/i;
// 주어 칸이 무효화 집합에 좁은 이름(id · class · 속성)을 주나 — 아니면 태그 이름(또는 '*')을 돌려줘요
function subjectTag(compound) {
    const ts = K.tokens(compound.split('::')[0]);
    if (ts.some(t => t.kind === 'id' || t.kind === 'class' || t.kind === 'attr')) return null;
    for (const t of ts) if (t.kind === 'pseudo' && /^(is|where)$/.test(t.name) && t.args != null) {
        const branches = L.topSplit(t.args);
        if (branches.every(b => { const cs = L.compounds(b.trim()); return cs.length && subjectTag(cs[cs.length - 1]) === null; })) return null;
    }
    const tag = ts.find(t => t.kind === 'tag');
    if (tag) return tag.text.toLowerCase();
    // :where(i) · :is(i, span) 처럼 괄호 안 태그만 있으면 그 태그(여럿이면 , 로)
    for (const t of ts) if (t.kind === 'pseudo' && t.args != null && (/^(is|where)$/.test(t.name) || (/^nth-(last-)?child$/.test(t.name) && / of /.test(t.args)))) {
        const tags = L.topSplit(/^nth/.test(t.name) ? t.args.slice(t.args.indexOf(' of ') + 4) : t.args).map(b => subjectTag(L.compounds(b.trim()).at(-1) || '*'));
        if (!tags.includes('*')) return [...new Set(tags.filter(Boolean))].join(',');
    }
    return '*';
}
// 갈래 하나에서 class 속성이 조상 칸(괄호 안 조상 칸 포함)에 있으면 주어 태그(좁으면 null)를, 없으면 undefined 를
function classAncestorSubject(sel, inNot = false) {
    const cs = L.compounds(sel.trim());
    if (!cs.length) return undefined;
    const last = cs[cs.length - 1];
    // 조상 칸의 :not( … [class*=…] … ) 는 주어가 좁아도 아래 전부를 다시 계산시켜요(측정: 체크박스 줄 규칙 하나 ~18ms).
    // 값 없는 :not([class])(markdown details)는 재 보니 몫이 없어 여기선 값 비교 꼴만 잡아요
    if (cs.slice(0, -1).some(c => K.tokens(c).some(t => t.kind === 'pseudo' && t.name === 'not' && t.args != null && /\[\s*class\s*[~|^$*]?=/i.test(t.args)))) return ':not';
    if (cs.slice(0, -1).some(c => CLASS_ATTR.test(c))) return inNot ? ':not' : subjectTag(last);
    for (const t of K.tokens(last.split('::')[0])) {
        if (t.kind !== 'pseudo' || !/^(is|where|not)$/.test(t.name) || t.args == null) continue;
        for (const b of L.topSplit(t.args)) {
            const own = classAncestorSubject(b, inNot || t.name === 'not');   // 괄호 안 갈래도 같은 판정(안쪽 괄호까지)
            if (own === undefined) continue;
            // :not( … 조상 칸 class 속성 … ) 은 바깥 주어가 좁아도 아래 전부를 다시 계산시켜요(측정: 체크박스 규칙 하나 ~19ms)
            if (t.name === 'not' || inNot || own === ':not') return ':not';
            const outer = subjectTag(last);
            return outer === null || own === null ? null : outer !== '*' ? outer : own;
        }
    }
    return undefined;
}
const SHEETS = ['style.css', 'src/style-lazy.gen.css', 'src/chat-appearance.gen.css', 'src/markdown.gen.css'].filter(f => fs.existsSync(path.join(root, f)));
const wide = () => {
    const out = [];
    for (const f of SHEETS) {
        const walk = ns => { for (const n of ns) { if (n.type === 'rule') { for (const p of L.topSplit(n.selector)) { const s = classAncestorSubject(p); if (s) out.push({ f, tag: s, sel: p.trim() }); } } else if (n.children) walk(n.children); } };
        walk(L.parse(fs.readFileSync(path.join(root, f), 'utf8')).children);
    }
    return out;
};

await check('판정: 조상 칸 class 속성 + 맨 태그 주어는 잡고, 좁은 주어 · 주어 칸 속성은 안 잡아요', () => {
    assert.equal(classAncestorSubject('#a .b > div[class*="x"] > div'), 'div');
    assert.equal(classAncestorSubject('.m details:not([class]) > summary:empty ~ p'), 'p');
    assert.equal(classAncestorSubject(':is(.x, [class*="-danger"]) > :is(.fa-trash, .fa-skull)'), null, 'class 주어는 훑기만');
    assert.equal(classAncestorSubject('#a .b > div[class*="x"]'), undefined, '주어 칸 자신의 속성은 자기만 다시 계산');
    assert.equal(classAncestorSubject('.m :is(.c, [class*="w"] img)'), 'img', '주어 칸 :is 안의 조상 칸');
    assert.equal(classAncestorSubject('input[type="checkbox"]:where(:not([class*="-switch"] > input))'), ':not', ':not 안 조상 칸은 바깥 주어가 좁아도 넓음');
    assert.equal(classAncestorSubject('input[type="checkbox"]:where(:not(.a > input, [class*="-switch"]))'), undefined, ':not 안이라도 주어 칸 속성은 괜찮음');
    assert.equal(classAncestorSubject('#a .b > div > div:is(.bl-s, *)'), undefined);
    assert.equal(classAncestorSubject('.p label[data-x]:not(.a, [class*="switch"]) > input[type="checkbox"]'), ':not', '조상 칸 :not 안 class 속성');
    assert.equal(classAncestorSubject('.p label[data-x]:not(.a, [class*="switch"])'), undefined, '주어 칸 :not 은 자기만');
});
await check('빌드된 시트: 조상 칸 class 속성 + 주어 div · span · :not 안 갈래 0 (ratchet: 맨 태그 주어 전체도 늘지 않아요)', () => {
    const list = wide();
    const divSpan = list.filter(x => x.tag === 'div' || x.tag === 'span' || x.tag === '*' || x.tag === ':not');
    assert.deepEqual(divSpan.map(x => `${x.f}: ${x.tag + ' ' + x.sel.slice(-200)}`), [], '주어가 div · span · * 이거나 :not 안 조상 칸인 갈래');
    // 2026-11-10 고친 뒤 65갈래(img 21 · p 11 · ul · ol 7 · summary 6 · a · button · select · textarea · input · i 2 — 메시지 안에 드물어 표시가 적어요). 줄면 숫자도 낮추세요
    const LIMIT = 65;
    assert.ok(list.length <= LIMIT, `맨 태그 주어 갈래 ${list.length}개(한도 ${LIMIT}) — 새 규칙이면 class · 속성 주어나 @container style() 표시로`);
});
await check('Tavern Helper 고른 탭 자식: 부모 표시(@property inherits:false) + @container style() — 고르는 요소 · 특이도 그대로', () => {
    const src = fs.readFileSync(path.join(root, 'css/15-drawers.css'), 'utf8');
    assert.ok(!/div\[class\*="bg-\[color-mix"\]\s*>\s*div/.test(src), '[class*=…] > div 꼴이 남아 있어요');
    assert.match(src, /@property --bl-q-th-tab \{ syntax: '<integer>'; inherits: false; initial-value: 0; \}/);
    assert.match(src, /> \.border-x-2 > div\[class\*="bg-\[color-mix"\] \{\s*--bl-q-th-tab: 1;\s*\}/);
    const old = 'body.salty #tavern_helper .inline-drawer-content > .flex-col > .border-x-2 > div[class*="bg-[color-mix"] > div';
    const now = 'body.salty #tavern_helper .inline-drawer-content > .flex-col > .border-x-2 > div > div:is(.bl-s, *)';
    assert.ok(src.includes(`@container style(--bl-q-th-tab: 1) {\n  ${now} {\n    color: inherit !important;`));
    assert.equal(L.spec(now).join('.'), L.spec(old).join('.'), '특이도');
    const lazy = fs.readFileSync(path.join(root, 'src/style-lazy.gen.css'), 'utf8');
    assert.ok(lazy.includes('@container style(--bl-q-th-tab: 1)') && lazy.includes('@property --bl-q-th-tab'), '빌드된 둘째 장에 실려요');
});
await check('체크박스: 스위치 빼기는 부모 표시 두 갈래(13 · 13) · 줄 체크 여백은 label 표시 — :not 안 [class*=…] > input 없음', () => {
    const src = fs.readFileSync(path.join(root, 'css/92-checkboxes.css'), 'utf8');
    assert.ok(!src.includes('[class*="-switch"] > input') && !src.includes('[class*="-toggle"] > input'), ':not 안 조상 칸 class 속성이 남았어요');
    for (const p of ['bl-q-sw', 'bl-q-tg', 'bl-q-rsw']) assert.match(src, new RegExp(`@property --${p} \\{ syntax: '<integer>'; inherits: false; initial-value: 0; \\}`));
    assert.ok(src.includes(':is([class*="-switch"]):not(input) { --bl-q-sw: 1; }') && src.includes(':is([class*="-toggle"]):not(input) { --bl-q-tg: 1; }'));
    assert.ok(src.includes('input[type="checkbox"] { --bl-q-sw: inherit; --bl-q-tg: inherit; }'), '::before · ::after 는 자기 자신을 물으니 체크박스가 부모 값을 받아야 해요');
    const a = src.split('@container (not style(--bl-q-sw: 1)) and (not style(--bl-q-tg: 1)) {').length - 1;
    const b = src.split('@container (not style(--bl-q-sw: 1)) and style(--bl-q-tg: 1) {').length - 1;
    assert.equal(a, 13); assert.equal(b, 13);
    // 둘째 갈래는 X(.lv-toggle · .bl-addon-toggle · .po-visible-toggle 안)를 :where 로(특이도 0) 더한 것
    const xs = src.match(/input\[type="checkbox"\]:where\(\.lv-toggle input,\.bl-addon-toggle input,\.po-visible-toggle input\):where\(:not\(/g) || [];
    assert.ok(xs.length >= 13, `X 갈래 ${xs.length}`);
    assert.match(src, /label\[class\*="switch"\] \{ --bl-q-rsw: 1; \}\n@container not style\(--bl-q-rsw: 1\) \{\n html:not\(#bl-checkrow-off\) body\.salty [^\n]*label\[data-bl-row-check\]:is\(bl-s, \*\):not\(\.salty-switch, \[role=switch\], \.menu_button, \.po-visible-toggle\) > input\[type="checkbox"\] \{ margin-inline: 0 !important; \}\n\}/);
    assert.equal(L.spec(':not(.salty-switch, [role=switch], .menu_button, .po-visible-toggle)').join('.'), L.spec(':not(.salty-switch, [class*="switch"], [role=switch], .menu_button, .po-visible-toggle)').join('.'), ':not 특이도');
});
await check('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/css-restyle3\.mjs \./);
});
console.log(`css-restyle3: ${passed} passed`);
