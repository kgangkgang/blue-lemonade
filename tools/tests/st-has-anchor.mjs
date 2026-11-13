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
const { rebaseSelector, rebaseSelectorList, rebaseSheet, rebaseBodyHasRules, syncRaises, RAISES } = mod;

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
        assert.equal(parts[k], `#top-settings-holder:where(.bl-center-drawer)${B.slice('#top-settings-holder'.length)}:is(:has(${arg}), :has(~ ${arg}), :has(~ * ${arg})):is(body *)`);
        assert.equal(compounds(parts[k]).length, 1, '복합 선택자 하나(주체)여야 해요');
    }
});
await test('우선순위가 원래와 같아요(1,6,1)', () => {
    const before = splitTop(ST_RULE, ',').map(s => specificity(s.trim()));
    const after = splitTop(rebaseSelectorList(ST_RULE), ',').map(s => specificity(s.trim()));
    assert.deepEqual(after, before);
    assert.deepEqual(before[0], [1, 6, 1]);
    const raised = splitTop(rebaseSelectorList(ST_RULE, 'bl-st-raise-9'), ',').map(s => specificity(s.trim()));
    assert.deepEqual(raised, before, 'class 꼴도 :is 의 가장 큰 인자로 같아요');
});
await test('1.0.0 퇴행 고침: class 꼴은 :has() 가 없고 holder 하나가 주체 · 뒤 인자는 holder 에 맞을 수 없는 서랍 칸 선택자', () => {
    const next = rebaseSelectorList(ST_RULE, 'bl-st-raise-9');
    assert.ok(next); assert.doesNotMatch(next, /:has\(/, ':has 없음'); assert.doesNotMatch(next, /bl-center-drawer/, '가운데 서랍 표식 없음');
    const parts = splitTop(next, ',').map(x => x.trim());
    for (const [k, arg] of ['.drawer-content.maximized', '.drawer-content.open', '#character_popup.open'].entries()) {
        assert.equal(parts[k], `#top-settings-holder:is(.bl-st-raise-9, :is(${arg}):is(.drawer-content.openDrawer:not(.fillLeft):not(.fillRight))):is(body *)`);
        assert.equal(compounds(parts[k]).length, 1);
    }
    // 지켜볼 수 없는 A(서랍 칸 · 인물 창이 아님)나 B 가 :has(복합 하나)가 아니면 예전 표식 꼴
    assert.match(rebaseSelector(`body:has(.x-open) ${B}`, 'c'), /:where\(\.bl-center-drawer\)/);
    assert.match(rebaseSelector('body:has(.drawer-content.open) #top-settings-holder:hover', 'c'), /:where\(\.bl-center-drawer\)/);
});
await test('syncRaises: A 가 문서에 있고 holder 가 B 에 맞을 때만 class — 바뀔 때만 붙이고 떼요 · A 가 없으면 B 는 견주지 않아요', () => {
    const cls = new Set(); let toggles = 0, matched = 0; let haveA = false, centerOpen = true;
    const holder = { classList: { contains: c => cls.has(c), toggle: (c, on) => { toggles++; on ? cls.add(c) : cls.delete(c); } }, matches: b => { matched++; assert.equal(b, B); return centerOpen; } };
    const doc = { querySelector: a => (a === '.drawer-content.maximized' && haveA) ? {} : null };
    const raises = [{ cls: 'bl-st-raise-0', conds: [{ a: '.drawer-content.maximized', b: B }, { a: '#character_popup.open', b: B }] }];
    assert.deepEqual(syncRaises(doc, holder, raises), []); assert.equal(matched, 0, 'A 가 없으면 holder.matches(:has) 를 부르지 않아요'); assert.equal(toggles, 0);
    haveA = true; assert.deepEqual(syncRaises(doc, holder, raises), ['bl-st-raise-0']); assert.equal(toggles, 1);
    syncRaises(doc, holder, raises); assert.equal(toggles, 1, '같은 상태는 다시 안 써요');
    centerOpen = false; assert.deepEqual(syncRaises(doc, holder, raises), []); assert.equal(toggles, 2); assert.equal(cls.size, 0);
    assert.deepEqual(syncRaises(doc, null, raises), [], 'holder 가 없으면 아무것도 안 해요');
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
    const n0 = RAISES.length;
    assert.equal(rebaseSheet(s), 2);
    const raised = k => rebaseSelectorList(ST_RULE, `bl-st-raise-${k}`);
    assert.deepEqual(s.cssRules.slice(0, 3).map(r => r.selectorText), ['.first', raised(n0 + 1), '.last'], '규칙마다 class 하나(뒤에서부터 옮겨 @media 안이 먼저 번호를 받아요)');
    assert.match(s.cssRules[1].cssText, /\{ z-index: 4005; \}$/);
    assert.equal(inner.cssRules[1].selectorText, raised(n0));
    assert.equal(RAISES.length, n0 + 2); assert.deepEqual(RAISES[n0].conds.map(c => c.a), ['.drawer-content.maximized', '.drawer-content.open', '#character_popup.open']);
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
    assert.match(st.cssRules[0].selectorText, /^#top-settings-holder:is\(\.bl-st-raise-\d+, /);
    assert.equal(theme.cssRules[0].selectorText, ST_RULE); assert.equal(other.cssRules[0].selectorText, ST_RULE);
});
await test('index.js 가 시작할 때(테마 켜짐과 따로) 불러요', () => {
    const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    // 9.0.2 부팅 2층 표(BOOT_FRAME — 테마 켜짐과 따로 · 첫 프레임 뒤)에서 동적 import 로 불러요
    // 1.2.2 시작 덮개 동안이면 걷힐 때(afterBoot) — 걷힐 때 꺼 둔 시트 켜기와 같은 계산에 묶여요(boot-gate.js · tools/tests/boot-sheet-hold.mjs)
    assert.match(index, /\['rebaseBodyHasRules', \(\) => import\('\.\/src\/st-has-anchor\.js'\), m => \{ afterBoot\(\(\) => m\.rebaseBodyHasRules\(\)\); \}\]/);
    const table = index.indexOf('const BOOT_FRAME'), call = index.indexOf('m.rebaseBodyHasRules()'), next = index.indexOf('const BOOT_IDLE');
    assert.ok(table > 0 && call > table && call < next, 'BOOT_FRAME 표 안에 있어야 해요');
    const ready = index.indexOf('jQuery(() => {'), start = index.indexOf("afterFirstFrame(() => withReplay('2층', () => startLayer(2, BOOT_FRAME)))"), theme = index.indexOf('const startThemeRuntime');
    assert.ok(ready > 0 && start > ready && start < theme, 'jQuery 준비 블록 안 · 테마 실행부 앞에서 시작해요');
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
