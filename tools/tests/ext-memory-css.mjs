// 1.2.x 기억 확장 둘의 맞춤(src/ext-elephant.css · src/ext-memoria.css · src/ext-compat.js) — 그 확장이 깔린 사람만 받고, 원작에만 좁게 걸리고, 테마 값만 쓰는지 지켜요.
//   ① 모든 갈래가 body.salty 아래이고 원작의 표식을 반드시 거쳐요 — 같은 .lm-* · #memoria_settings 이름을 쓰는 다른 확장에는 닿지 않아요
//   ② #chat 을 쓰지 않고, 주어 아닌 :has 가 없고, 바깥 자원을 부르지 않아요
//   ③ 색 글자를 박지 않아요 — 팔레트 · 부품 토큰만(예외: 손잡이 대체값 #fff · 본문색과 섞어 밝기만 맞추는 color-mix)
//   ④ 「색 두기」: 코끼리를 생각하지마의 색 변수 · 글꼴은 덮지 않고, 창 안에서만 테마 색 토큰을 그 확장의 색 변수로 · 설정 내용 칸에는 「원래 색 유지」 표식
//   ⑤ 그 확장이 없는 사람에게는 싣지 않아요 — 늘 붙는 시트에 그 확장의 이름이 없고, index.js 는 설정 칸이 있을 때만 모듈을 받아요
//   ⑥ 원작 표식이 든 설정 칸에만 시트 · 표식 · 안내 줄을 붙여요(이름만 같은 칸은 그대로) · 시트 id 가 확장마다 달라요 · 분류 탭은 만들지 않아요
//   ⑧ 낮밤 표식 다시 맞추기(테마가 켜져 있을 때만)
//   ⑦ 안내 한 줄: 확인한 판이면 「맞춰 뒀어요」, 다른 판이면 지금 판을 알려요 · 판 글자가 늦게 채워지면 다시 부를 때 맞춰요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '');
const unwrap = css => css.replace(/@media \(pointer: coarse\) \{([\s\S]*?\})\s*\}/g, '$1');
// 쉼표로 나누되 괄호 안(:is(…) · :not(…))의 쉼표는 그대로
const splitTop = text => { const out = []; let depth = 0, from = 0; for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (c === ',' && depth === 0) { out.push(text.slice(from, i)); from = i + 1; } } out.push(text.slice(from)); return out.map(s => s.trim()).filter(Boolean); };
const rulesOf = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selectors: splitTop(m[1]), body: m[2] }));
const SHEETS = {
    'src/ext-elephant.css': {
        // 원작만 붙이는 낮밤 표식 · 맞춤 모듈이 원작 설정 칸에 붙인 표식 · 원작의 메시지 단추
        own: /\.lm-root:is\(\[data-lm-mode\], \[data-bl-ext\]\)|\.lm-root(?:\.lm-manager)?\[data-lm-mode\]|\.lm-root\[data-bl-ext\]|\.mes_button(?::is\(\.lm-mes-pin, \.lm-mes-star\)|\.lm-mes-(?:pin|star))/,
        medias: 1, min: 15,
    },
    'src/ext-memoria.css': { own: /#memoria_settings\.memoria\[data-bl-ext\]|\.memoria-review/, medias: 1, min: 5 },
};
const sheets = Object.fromEntries(Object.entries(SHEETS).map(([file, spec]) => { const raw = strip(read(file)); return [file, { ...spec, raw, rules: rulesOf(unwrap(raw)) }]; }));

check('규칙이 있고 at-규칙은 손가락 화면 묶음뿐이에요', () => {
    for (const [file, s] of Object.entries(sheets)) {
        assert.ok(s.rules.length >= s.min, `${file} 규칙 ${s.rules.length}개`);
        assert.equal((s.raw.match(/@media/g) || []).length, s.medias, file);
        assert.ok(!/@(media|supports|layer|container|import|font-face)/.test(unwrap(s.raw)), `${file} — 허용한 묶음 밖의 at-규칙`);
    }
});
check('① 모든 갈래가 body.salty 아래이고 원작의 표식을 거쳐요', () => {
    for (const [file, s] of Object.entries(sheets)) for (const r of s.rules) for (const sel of r.selectors) {
        assert.ok(/^(html(?::root)?:not\(#bl-[\w-]+\) )?body\.salty[.:\s]/.test(sel), `${file} body.salty 로 시작하지 않음: ${sel}`);
        assert.ok(s.own.test(sel), `${file} 원작 표식이 없음: ${sel}`);
    }
    // 표식 없는 뿌리 이름만으로 짚는 갈래가 없어요(같은 이름을 쓰는 다른 확장)
    for (const r of sheets['src/ext-elephant.css'].rules) for (const sel of r.selectors) assert.ok(!/\.lm-root(?![:.\[\w-])|#lm_settings/.test(sel), sel);
    for (const r of sheets['src/ext-memoria.css'].rules) for (const sel of r.selectors) assert.ok(!/#memoria_settings(?!\.memoria\[data-bl-ext\])/.test(sel), sel);
});
check('② #chat · 주어 아닌 :has · 바깥 자원이 없어요', () => {
    for (const [file, s] of Object.entries(sheets)) {
        assert.ok(!/url\(/.test(s.raw), `${file} url()`);
        for (const r of s.rules) for (const sel of r.selectors) {
            assert.ok(!/#chat(?![\w-])/.test(sel), `${file} ${sel}`);
            // :has 는 맨 끝 덩이(주어)에만 — 뒤에 자손 · 자식 결합자가 오면 주어가 아니에요
            const at = sel.lastIndexOf(':has(');
            if (at >= 0) { let depth = 0, end = at + 4; for (; end < sel.length; end++) { if (sel[end] === '(') depth++; else if (sel[end] === ')' && --depth === 0) break; } assert.ok(!/[\s>+~]\S/.test(sel.slice(end + 1).replace(/\([^()]*\)/g, '')), `${file} 주어 아닌 :has — ${sel}`); }
        }
    }
});
check('③ 색 글자를 박지 않아요(팔레트 · 부품 토큰만)', () => {
    for (const [file, s] of Object.entries(sheets)) for (const r of s.rules) {
        const body = r.body.replace(/var\(--bl-knob-face, #fff\)/g, '').replace(/content:\s*(['"])[^'"]*\1/g, '')
            .replace(/color-mix\(in srgb, var\(--(?:salty|lm)-[\w-]+\) \d+%, (?:var\(--salty-text\)|transparent)\)/g, '');
        assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix\(/i.test(body), `${file} ${r.selectors[0]} → ${body.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|color-mix\([^;]*/i)?.[0]}`);
    }
});
check('④ 「색 두기」: 그 확장의 색 변수 · 글꼴은 덮지 않고, 창 안에서만 테마 색 토큰을 그 확장의 색 변수로 바꿔요', () => {
    const el = sheets['src/ext-elephant.css'];
    for (const r of el.rules) assert.ok(!/(^|[;\s{])--lm-[\w-]+\s*:/.test(r.body), `그 확장의 색 변수를 덮어요: ${r.selectors[0]}`);
    const swap = el.rules.find(r => r.selectors.includes('body.salty .lm-root[data-lm-mode]:not([data-bl-ext])'));
    assert.ok(swap, '창 안의 토큰 바꾸기 규칙이 없어요');
    assert.ok(swap.selectors.includes('body.salty .lm-root[data-bl-ext] .inline-drawer-content'), '설정 칸은 내용 칸에만(머리줄은 테마 꼴)');
    for (const k of ['salty-accent', 'salty-on-accent', 'salty-text', 'salty-muted', 'salty-line', 'salty-surface', 'salty-raised', 'salty-control', 'salty-danger', 'bl-control', 'bl-field-face', 'bl-ring']) assert.match(swap.body, new RegExp(`--${k}:\\s*var\\(--lm-`), `--${k}`);
    // 주요 · 지우기 · 조용한 단추를 그 확장의 색 변수로 되살려요
    for (const kind of ['primary', 'danger', 'quiet']) assert.ok(el.rules.some(r => r.selectors.some(s => s.endsWith(`.lm-btn-${kind}`)) && /var\(--lm-/.test(r.body)), kind);
    assert.ok(!/salty-(accent|danger|text)\)/.test(el.rules.filter(r => r.selectors.some(s => /\.lm-btn/.test(s))).map(r => r.body).join('')), '단추에 테마 색을 쓰지 않아요');
    const mm = sheets['src/ext-memoria.css'];
    assert.ok(mm.rules.some(r => /--SmartThemeBorderColor:\s*var\(--bl-ui-line, var\(--salty-line\)\)/.test(r.body)), '투명한 선 변수를 팔레트 선으로');
});
// ── 게시 뒤 화면 확인에서 나온 작은 고침
const ruleFor = (file, ending) => sheets[file].rules.filter(r => r.selectors.some(s => s.endsWith(ending)));
check('⑨ 코끼리 설정 서랍의 고르기 칸 · 숫자 칸에 안쪽 1px 고리가 보여요', () => {
    const FIELDS = ':is(.text_pole, select, textarea, input:is([type="text"], [type="number"], [type="search"])):not(.lm-setsearch input, .lm-quiet)';
    const [ring] = ruleFor('src/ext-elephant.css', FIELDS), [focus] = ruleFor('src/ext-elephant.css', `${FIELDS}:focus`);
    assert.ok(ring && focus, '고리 규칙 · 누름 규칙');
    for (const r of [ring, focus]) for (const sel of r.selectors) assert.ok(sel.startsWith('html:not(#bl-i2-off) body.salty .lm-root[data-bl-ext] .inline-drawer-content '), `설정 서랍 내용 칸에만(창 안은 테마 고리가 이미 그려요): ${sel}`);
    assert.match(ring.body, /box-shadow:\s*inset 0 0 0 1px var\(--lm-line-strong\) !important/, '그 확장의 선 색으로 1px');
    assert.match(focus.body, /box-shadow:\s*inset 0 0 0 1px var\(--lm-accent\) !important/, '누르면 그 확장의 강조색');
    for (const r of [ring, focus]) assert.ok(!/border|background|(^|[;\s])color/.test(r.body), '고리만 — 면 · 글자색 · 테두리 꼴은 건드리지 않아요');
    // 테마의 고리 규칙이 「원래 색 유지」 칸을 비켜 가는 것이 이 고침의 까닭이에요 — 그 규칙이 바뀌면 이 고침도 다시 봐요
    assert.ok(read('css/95-fields-i2.css').includes('[data-bl-native-ext-colors] *, .salty-switch input'), '테마 고리 규칙은 원래 색 유지 칸을 비켜 가요');
});
check('⑩ 코끼리 설정 서랍의 안내 글자는 그 확장의 흐린 글자색이에요(테마 파랑 아님)', () => {
    const [hint] = ruleFor('src/ext-elephant.css', '::placeholder');
    assert.ok(hint, '안내 글자 규칙');
    assert.deepEqual(hint.selectors, ['body.salty .lm-root[data-bl-ext] .inline-drawer-content :is(.text_pole, textarea)::placeholder'], '설정 서랍 내용 칸에만 · 찾기 칸(.text_pole)을 품어요');
    assert.match(hint.body, /^\s*color:\s*var\(--lm-muted\) !important;\s*$/, '실리태번의 안내 글자 규칙이 !important 라 같은 세기로 · 색만');
});
check('⑪ Memoria 머리줄 판 알약이 좁은 칸에서 칸 끝에 바로 잘리지 않아요', () => {
    const [head] = ruleFor('src/ext-memoria.css', '.inline-drawer-header > b');
    assert.ok(head, '머리줄 이름 칸 규칙');
    // 아랫줄로 떨어지지 않게 한 줄 · 줄어들 수 있게 — 그대로
    assert.match(head.body, /flex-wrap:\s*nowrap;/); assert.match(head.body, /min-width:\s*0;/); assert.match(head.body, /white-space:\s*nowrap;/);
    // 칸 끝이 아니라 8px 밖에서 잘라요 · 모르는 브라우저는 hidden(앞에 적힌 값)으로 남아요
    assert.match(head.body, /overflow:\s*hidden;\s*overflow:\s*clip;\s*overflow-clip-margin:\s*var\(--bl-s2, 8px\);/, 'hidden → clip → 여유 8px 차례');
    // 여유(8)는 머리줄 간격(12)보다 작아야 접는 화살표에 닿지 않아요
    const base = read('css/10-foundation.css');
    assert.match(base, /--bl-s2:\s*8px;/); assert.match(base, /--bl-s3:\s*12px;/);
    assert.match(read('css/01-smear-topbar-drawers.css'), /body\.salty \.inline-drawer-header:where\(:not\(\.salty-panel \*, \.world_entry \*\)\) \{\s*min-height: 40px;\s*gap: var\(--bl-s3\);/, '머리줄 간격은 12');
    // 알약은 줄어들지 않아요
    const [pill] = ruleFor('src/ext-memoria.css', '.inline-drawer-header .memoria__version');
    assert.match(pill.body, /flex:\s*none !important;/);
});
check('⑫ Memoria 「주입 미리보기」 글상자는 작은 글자 단계예요(테마 입력칸 본문 크기 아님)', () => {
    const [box] = ruleFor('src/ext-memoria.css', 'textarea.memoria__preview');
    assert.ok(box, '미리보기 글상자 규칙');
    assert.match(box.body, /^\s*font-size:\s*var\(--bl-ts-micro, 12px\);\s*$/, '글자 크기만 — 글꼴 · 줄 높이 · 면은 그대로');
    assert.match(read('css/10-foundation.css'), /--bl-fs-micro:\s*max\(12px, /, '가장 작은 단계는 12px 부터');
    // 테마 입력칸 규칙(본문 크기 · !important 아님)보다 무게가 커서 이겨요 — 그 규칙이 !important 로 바뀌면 이 고침도 다시 봐요
    const base = strip(read('css/02-controls.css'));
    const field = [...base.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(m => m[1].trim().startsWith('body.salty :is(.text_pole, select, textarea,') && /font-size:/.test(m[2]));
    assert.ok(field && /font-size:\s*var\(--bl-fs-body\);/.test(field[2]), '테마 입력칸 글자 크기 규칙');
});
check('⑬ (11-14) 그 글상자 높이는 글자를 줄이기 전(1.3.7) 그대로 — 본문 글자 12줄 · 줄 높이 1.55 · 위아래 여백 10', () => {
    const rules = ruleFor('src/ext-memoria.css', 'textarea.memoria__preview');
    assert.equal(rules.length, 2, '글자 규칙 하나 + 높이 규칙 하나');
    assert.match(rules[1].body, /^\s*height:\s*calc\(12 \* 1\.55 \* var\(--bl-fs-body, 15px\) \+ 20px\);\s*$/, '높이만 — 손으로 늘이기(resize)는 원작 그대로');
    // 셈의 근거: 테마 글상자 규칙의 줄 높이 · 위아래 여백과 원작 rows="12"
    const base = strip(read('css/02-controls.css'));
    assert.match(base, /body\.salty textarea:where\([^{]*\)\s*\{\s*padding:\s*10px var\(--bl-s3\) !important;\s*line-height:\s*1\.55 !important;/, '테마 글상자: 위아래 여백 10 · 줄 높이 1.55');
    assert.match(base, /border:\s*0 !important;/, '테마 입력칸은 테두리 0(높이에 안 더해져요)');
});
check('⑤ 그 확장이 없는 사람에게는 싣지 않아요', () => {
    for (const always of ['style.css', 'src/style-lazy.gen.css', 'style-ext.css']) {
        const text = read(always);
        assert.ok(!/\.lm-(root|manager|switch-track|setsearch|toolbtn|mes-pin)\b|data-lm-mode|#memoria_settings|\.memoria-review|\.memoria__/.test(text), `${always} 에 그 확장 맞춤 규칙이 실렸어요`);
    }
    assert.ok(!fs.readdirSync(path.join(root, 'css')).some(n => /elephant|memoria/.test(n)), 'css/ 모듈로 두면 늘 붙는 시트에 실려요');
    const index = read('index.js');
    const line = index.split('\n').find(l => l.includes("import('./src/ext-compat.js')")) || '';
    assert.ok(line.trim().startsWith("if (!ZERO) { const KEY = 'bl-ext-compat';"), '제로 모드에서는 받지 않아요');
    assert.ok(line.includes("const here = ['ss-settings', 'lm_settings', 'memoria_settings'].filter(id => document.getElementById(id)).join(' ');") && line.includes('if (here) go();'), '설정 칸이 있을 때만 모듈을 받아요(SETS 의 root 셋과 같은 id)');
    assert.equal((index.match(/import\('\.\/src\/ext-compat\.js'\)/g) || []).length, 1);
});

// ── 모듈: 가짜 DOM
class El {
    constructor(tag, cls = '', kids = [], id = '') { this.localName = tag; this.id = id; this.className = cls; this.dataset = {}; this.style = {}; this.children = []; this.parentElement = null; this.text = ''; for (const k of kids) this.append(k); }
    append(k) { if (typeof k === 'string') { this.text += k; return; } k.parentElement = this; this.children.push(k); }
    get ownerDocument() { return doc; }
    get textContent() { return this.text + this.children.map(k => k.textContent).join(''); }
    set textContent(v) { this.children = []; this.text = String(v); }
    is(part) { const m = part.match(/^([a-z]*)((?:[.#][\w-]+)*)$/i); if (!m) throw Error('시험 DOM 이 모르는 선택자: ' + part); if (m[1] && m[1] !== this.localName) return false; return (m[2].match(/[.#][\w-]+/g) || []).every(t => (t[0] === '#' ? this.id === t.slice(1) : this.className.split(/\s+/).includes(t.slice(1)))); }
    all(out = []) { for (const k of this.children) { out.push(k); k.all(out); } return out; }
    querySelectorAll(sel) { if (sel.startsWith(':scope > ')) return this.children.filter(k => k.is(sel.slice(9))); const parts = sel.split(/\s+/); return this.all().filter(e => e.is(parts.at(-1))); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
const el = (tag, cls, ...kids) => new El(tag, cls, kids);
let page, head;
const doc = { createElement: tag => new El(tag), querySelector: sel => (page.is(sel) ? page : page.querySelector(sel)), getElementById: id => head.children.find(k => k.id === id) || null, get head() { return head; }, addEventListener() {} };
const drawer = (id, cls, ...inside) => { const content = el('div', 'inline-drawer-content', ...inside); const box = new El('div', cls, [el('div', 'inline-drawer', el('div', 'inline-drawer-header', el('b', '', '이름')), content)], id); page = el('body', 'salty', box); head = el('head', ''); return { box, content }; };
const { SETS, buildAll, addNote, attachSheet, compatText, seenBefore, syncMode } = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href);
const ELEPHANT = SETS.find(s => s.root === '#lm_settings'), MEMORIA = SETS.find(s => s.root === '#memoria_settings');

check('⑥ 원작 표식이 든 설정 칸에만 시트 · 표식 · 안내 줄을 붙여요', () => {
    assert.ok(ELEPHANT?.mark && MEMORIA?.mark, '두 확장 모두 원작 표식(mark)으로 알아봐요');
    assert.ok(!ELEPHANT.head && !MEMORIA.head, '원작이 이미 탭으로 나눈 설정이라 분류 탭을 만들지 않아요');
    // 이름만 같은 다른 확장의 칸: 아무것도 안 붙여요
    let { box, content } = drawer('lm_settings', 'extension_settings lm-root', el('div', 'lm-head'));
    buildAll(doc);
    assert.equal(head.children.length, 0, '시트를 붙이지 않아요');
    assert.ok(!('blExt' in box.dataset) && content.children.length === 1, '표식 · 안내 줄을 붙이지 않아요');
    // 원작 칸
    ({ box, content } = drawer('lm_settings', 'extension_settings lm-root', el('div', 'lm-head', el('span', 'lm-switch-track'))));
    buildAll(doc); buildAll(doc);
    assert.deepEqual(head.children.map(k => k.href.split('/').pop()), ['ext-elephant.css'], '그 확장의 시트만 한 번');
    assert.ok('blExt' in box.dataset);
    assert.ok('blNativeExtColors' in content.dataset, '「색 두기」: 설정 내용 칸에 원래 색 유지 표식');
    assert.ok(!('blNativeExtColors' in box.dataset), '머리줄까지 덮는 바깥 칸에는 안 붙여요');
    assert.equal(content.children.filter(k => k.is('.bl-ext-compat')).length, 1, '안내 줄은 하나');
    assert.ok(!content.querySelector('.bl-ext-tabs'), '분류 탭은 만들지 않아요');
    assert.equal(content.children.at(-1).style.display, 'none', '테마가 꺼지면 안 보이게 제 스타일로 숨겨 둬요');
    // 시트 id 가 확장마다 달라요(같으면 둘째 확장의 시트가 안 붙어요)
    head = el('head', '');
    for (const set of SETS) assert.equal(attachSheet(doc, set, 'http://x/scripts/extensions/third-party/t/src/ext-compat.js'), true, set.name);
    assert.equal(new Set(head.children.map(k => k.id)).size, SETS.length);
    for (const set of SETS) assert.ok(fs.existsSync(path.join(root, 'src', set.css.replace('./', ''))), set.css);
    // 설정 칸이 그려지기 전에 붙이는 시트는 원작 표식을 안 보는 갈래(미트볼 상태창)이면서 지난번에 그 칸이 있었던 때만 — 코끼리 · Memoria 는 원작 표식을 찾은 뒤에만(같은 id 의 다른 확장에 안 붙게)
    const MEAT = SETS.find(s => s.root === '#ss-settings');
    assert.ok(seenBefore(MEAT, 'ss-settings lm_settings') && seenBefore(MEAT, '1') && !seenBefore(MEAT, 'lm_settings') && !seenBefore(MEAT, ''), '미트볼 상태창 칸이 있었던 때만(옛 표시 1 은 미트볼)');
    assert.ok(seenBefore(ELEPHANT, 'lm_settings') && !seenBefore(ELEPHANT, '1'));
    assert.ok(read('src/ext-compat.js').includes('if (!set.mark && seenBefore(set, mark)) attachSheet(doc, set);'), '원작 표식을 봐야 하는 갈래는 일찍 붙이지 않아요');
});
check('⑦ 안내 한 줄 — 확인한 판 · 다른 판 · 늦게 채워진 판', () => {
    assert.match(compatText(ELEPHANT, '1.9.60'), /코끼리를 생각하지마 1\.9\.60 화면에 맞춰 뒀어요/);
    assert.match(compatText(ELEPHANT, ''), /코끼리를 생각하지마 1\.9\.60 화면에 맞춘 모습이에요\(지금 판은 읽지 못했어요\)/, '판을 못 읽으면 맞는 판처럼 적지 않아요(1.2.3 독립 검토 고침과 같은 글)');
    const other = compatText(ELEPHANT, '1.9.72');
    assert.ok(other.includes('1.9.72') && other.includes('1.9.60') && /어긋나 보일 수 있어요/.test(other), other);
    // 원작이 판 글자를 늦게 채워요(틀에는 옛 번호) — 다시 부르면 글이 맞춰져요
    const ver = el('span', 'memoria__version', 'v2.0.0');
    const { box, content } = drawer('memoria_settings', 'memoria', el('div', 'memoria__body'));
    box.children[0].children[0].append(ver);
    buildAll(doc);
    assert.match(content.children.at(-1).textContent, /지금 판은 2\.0\.0/);
    ver.textContent = 'v2.0.4';
    addNote(box, MEMORIA);
    assert.match(content.children.at(-1).textContent, /Memoria 2\.0\.4 화면에 맞춰 뒀어요/);
    assert.equal(content.children.filter(k => k.is('.bl-ext-compat')).length, 1);
    for (const set of [ELEPHANT, MEMORIA]) for (const v of set.verified) assert.ok(!/(^|\.)\d{2,}\.\d+\.\d+$/.test(v) && !v.split('.').includes('10'), `판 번호 ${v}`);
});
check('⑧ 「색 두기」: 낮밤 표식을 테마 밝기에 다시 맞추고, 테마가 꺼져 있으면 손대지 않아요', () => {
    const box = { dataset: {} };
    const fake = (cls, color) => ({ body: { classList: { contains: c => cls.split(' ').includes(c) } }, defaultView: { getComputedStyle: () => ({ color }) } });
    assert.equal(syncMode(fake('salty salty-dark', 'rgb(236, 232, 225)'), box), 'night');
    assert.equal(box.dataset.lmMode, 'night');
    assert.equal(syncMode(fake('salty', 'rgb(31, 50, 71)'), box), 'day');
    assert.equal(box.dataset.lmMode, 'day');
    assert.equal(syncMode(fake('', 'rgb(236, 232, 225)'), box), '', '테마를 끄면 원작 값 그대로');
    assert.equal(box.dataset.lmMode, 'day');
    assert.equal(syncMode({}, box), '', '문서가 비어도 멈추지 않아요');
});
console.log(`ext-memory-css: ${passed}개 통과`);
