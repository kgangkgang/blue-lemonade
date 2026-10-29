// 8.2.4 실리태번 body:has(…) 서랍 규칙 옮겨 적기 (src/st-has-anchor.js) — 폰 프롬프트 토글 멈춤 2차
//   가운데 서랍을 한 번 열면 body 가 「:has() 주체가 아닌 기준」이 되어, 그 뒤 프롬프트 토글 · 채팅 변화마다 메시지 요소 1만 2천여 개를
//   다시 계산했다(폰 리그 CPU 4배 강제 스타일 계산 한 번 1.5초 · 성능 관문 토글 8.5~67초). 상한: 옮긴 뒤 body/html 을 비주체 :has() 기준으로
//   삼는 선택자 0개 · 테마 CSS 에도 0개 · 뜻(맞는 경우)은 그대로 · 우선순위 그대로 · 같은 시트 같은 자리.
//   node tools/tests/st-has-anchor.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}
const mod = await import(pathToFileURL(path.join(root, 'src/st-has-anchor.js')).href).catch(error => ({ loadError: error }));

// 실리태번 style.css(1.19 staging · release 같음) 원래 규칙
const B = '#top-settings-holder:has(.drawer-content.openDrawer:not(.fillLeft):not(.fillRight))';
const ST_RULE = `body:has(.drawer-content.maximized) ${B}, body:has(.drawer-content.open) ${B}, body:has(#character_popup.open) ${B}`;

// ── 선택자 도구: 괄호 밖 결합자로 복합 선택자 나누기 · 비주체 :has() 기준 찾기 ─────────
function splitTop(text, chars) {
    const out = []; let depth = 0, quote = null, cur = '';
    for (const ch of text) {
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--;
        if (!depth && chars.includes(ch)) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out;
}
const compounds = sel => splitTop(sel.trim(), ' >~+').map(s => s.trim()).filter(Boolean);
/** body · html · :root 이 :has() 를 달고 맨 오른쪽이 아닌 자리에 있는 선택자 (body 아래 모든 변화가 body 무효화가 된다) */
function bodyAnchors(selectorText) {
    return splitTop(selectorText, ',').map(s => s.trim()).filter(sel => {
        const list = compounds(sel);
        return list.slice(0, -1).some(c => /^(?:html|body|:root)(?![\w-])/.test(c) && c.includes(':has('));
    });
}
/** 우선순위(id, class, type) — 이 시험의 선택자 모양(:has · :is · :not 안은 가장 큰 인자)만 셈 */
function specificity(sel) {
    let a = 0, b = 0, c = 0, i = 0; const s = sel.trim();
    const max = inner => splitTop(inner, ',').map(specificity).reduce((m, x) => (x[0] - m[0] || x[1] - m[1] || x[2] - m[2]) > 0 ? x : m, [0, 0, 0]);
    while (i < s.length) {
        const ch = s[i];
        if (ch === '#') { a++; i++; while (i < s.length && /[\w-]/.test(s[i])) i++; }
        else if (ch === '.') { b++; i++; while (i < s.length && /[\w-]/.test(s[i])) i++; }
        else if (ch === ':') {
            const m = /^:(has|is|not|where)\(/.exec(s.slice(i));
            if (m) { let d = 0, j = i + m[0].length - 1; for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')' && --d === 0) break; } const inner = s.slice(i + m[0].length, j).replace(/^\s*[>~+]\s*/, ''); if (m[1] !== 'where') { const x = max(inner.split(',').map(p => p.trim().replace(/^[>~+]\s*/, '')).join(',')); a += x[0]; b += x[1]; c += x[2]; } i = j + 1; }
            else { b++; i++; while (i < s.length && /[\w-]/.test(s[i])) i++; }
        } else if (/[a-zA-Z]/.test(ch)) { c++; while (i < s.length && /[\w-]/.test(s[i])) i++; }
        else if (ch === '*') i++;
        else i++;
    }
    return [a, b, c];
}

// ── 가짜 CSSOM ───────────────────────────────────────────
function rule(selectorText, body = '{ z-index: 4005; }') { return { type: 1, selectorText, cssText: `${selectorText} ${body}` }; }
function sheet(rules, href = 'http://st.localhost/style.css') {
    const s = { href, cssRules: rules,
        insertRule(text, index) { const at = text.indexOf('{'); const r = rule(text.slice(0, at).trim(), text.slice(at)); this.cssRules.splice(index, 0, r); return index; },
        deleteRule(index) { this.cssRules.splice(index, 1); } };
    return s;
}

await test('모듈을 불러와요', () => { assert.ok(!mod.loadError, `src/st-has-anchor.js 를 못 불러옴: ${mod.loadError?.message}`); });
if (mod.loadError) { console.log(`\nst-has-anchor: ${pass} 통과 · ${fail} 실패`); process.exit(1); }
const { rebaseSelector, rebaseSelectorList, rebaseSheet, rebaseBodyHasRules } = mod;

await test('실리태번 원래 규칙은 body 를 비주체 :has() 기준으로 삼아요(고치기 전 상태 확인)', () => {
    assert.equal(bodyAnchors(ST_RULE).length, 3);
});
await test('옮긴 규칙: body 기준 0개 · holder 가 주체 · 세 조건 모두 holder 안 · 뒤 형제 · 그 안', () => {
    const next = rebaseSelectorList(ST_RULE);
    assert.ok(next, '옮겨 적지 못함');
    assert.equal(bodyAnchors(next).length, 0, `body 기준이 남음: ${next}`);
    const parts = splitTop(next, ',').map(s => s.trim());
    assert.equal(parts.length, 3);
    for (const [k, arg] of ['.drawer-content.maximized', '.drawer-content.open', '#character_popup.open'].entries()) {
        assert.equal(parts[k], `${B}:is(:has(${arg}), :has(~ ${arg}), :has(~ * ${arg})):is(body *)`);
        assert.equal(compounds(parts[k]).length, 1, '복합 선택자 하나(주체)여야 해요');
    }
});
await test('우선순위가 원래와 같아요(1,6,1)', () => {
    const before = splitTop(ST_RULE, ',').map(s => specificity(s.trim()));
    const after = splitTop(rebaseSelectorList(ST_RULE), ',').map(s => specificity(s.trim()));
    assert.deepEqual(after, before);
    assert.deepEqual(before[0], [1, 6, 1]);
});
await test('모양이 다르면 손대지 않아요(null)', () => {
    for (const sel of ['body:has(.a .b) #top-settings-holder', 'body:has(.a > .b) #top-settings-holder', 'body:has(.a, .b) #top-settings-holder', 'body:has(.a):has(.b) #top-settings-holder',
        'body #top-settings-holder', 'body:has(.a) #top-settings-holder-x', 'body:has(.a) #top-settings-holder .c', 'html:has(.a) #top-settings-holder', '.x body:has(.a) #top-settings-holder']) {
        assert.equal(rebaseSelector(sel), null, sel);
    }
    assert.equal(rebaseSelectorList(`${splitTop(ST_RULE, ',')[0]}, body:has(.a .b) #top-settings-holder`), null, '목록 중 하나라도 안 맞으면 규칙째 그대로');
});
await test('시트: 같은 자리에 넣고 원래 것을 지워요 · 선언 그대로 · @media 안도 · 두 번 해도 그대로', () => {
    const inner = sheet([rule('.a'), rule(ST_RULE, '{ z-index: 4005; }'), rule('.b')]);
    const s = sheet([rule('.first'), rule(ST_RULE, '{ z-index: 4005; }'), rule('.last'), { type: 4, cssRules: inner.cssRules, insertRule: inner.insertRule, deleteRule: inner.deleteRule }]);
    assert.equal(rebaseSheet(s), 2);
    assert.deepEqual(s.cssRules.slice(0, 3).map(r => r.selectorText), ['.first', rebaseSelectorList(ST_RULE), '.last']);
    assert.match(s.cssRules[1].cssText, /\{ z-index: 4005; \}$/);
    assert.equal(inner.cssRules[1].selectorText, rebaseSelectorList(ST_RULE));
    assert.equal(rebaseSheet(s), 0, '이미 옮긴 규칙은 다시 안 건드려요');
});
await test('insertRule 이 실패하면(옛 브라우저) 원래 규칙을 그대로 둬요', () => {
    const s = sheet([rule(ST_RULE)]); s.insertRule = () => { throw new SyntaxError('지원 안 함'); };
    assert.equal(rebaseSheet(s), 0);
    assert.equal(s.cssRules.length, 1); assert.equal(s.cssRules[0].selectorText, ST_RULE);
});
await test('문서: 실리태번 style.css 만 바꿔요(테마 style.css · 다른 시트는 그대로)', () => {
    const st = sheet([rule(ST_RULE)]); const theme = sheet([rule(ST_RULE)], 'http://st.localhost/scripts/extensions/third-party/blue-lemonade/style.css'); const other = sheet([rule(ST_RULE)], 'http://st.localhost/css/mobile-styles.css');
    assert.equal(rebaseBodyHasRules({ styleSheets: [theme, other, st] }, 0), 1);
    assert.equal(st.cssRules[0].selectorText, rebaseSelectorList(ST_RULE));
    assert.equal(theme.cssRules[0].selectorText, ST_RULE); assert.equal(other.cssRules[0].selectorText, ST_RULE);
});
await test('index.js 가 시작할 때(테마 켜짐과 따로) 불러요', () => {
    const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    assert.match(index, /import \{ rebaseBodyHasRules \} from '\.\/src\/st-has-anchor\.js'/);
    const ready = index.indexOf('jQuery(() => {'); const call = index.indexOf('rebaseBodyHasRules();'); const theme = index.indexOf('const startThemeRuntime');
    assert.ok(ready > 0 && call > ready && call < theme, 'jQuery 준비 블록 안 · 테마 실행부 앞에서 불러야 해요');
});
await test('상한: 테마 CSS 에도 body · html 을 비주체 :has() 기준으로 삼는 선택자 0개', () => {
    const files = ['style.css', 'style-ext.css', 'src/lazy-panel.gen.css'].map(f => path.join(root, f)).filter(f => fs.existsSync(f));
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.css') ? [path.join(dir, e.name)] : []);
    for (const dir of ['css', 'src'].map(d => path.join(root, d))) if (fs.existsSync(dir)) files.push(...walk(dir));
    assert.ok(files.length > 5, 'CSS 파일을 못 찾음');
    const hits = [];
    for (const f of new Set(files)) {
        const text = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const re = /([^{};]+)\{/g; let m;
        while ((m = re.exec(text))) { const sel = m[1].trim(); if (sel.startsWith('@')) continue; for (const hit of bodyAnchors(sel)) hits.push(`${path.relative(root, f)} :: ${hit.slice(0, 160)}`); }
    }
    assert.deepEqual(hits, []);
});

console.log(`\nst-has-anchor: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
