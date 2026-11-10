// 1.1.1 가볍게: 마크다운 모양 규칙 떼어 두기 (tools/build-css.cjs markdownSplit · src/lite.js syncMarkdownCss)
//   css/61-markdown.css 가운데 body.salty.salty-md-*(고른 마크다운 모양)가 있어야만 맞는 규칙은 첫 시트(style.css)에서 빼 src/markdown.gen.css 로 —
//   기본값(고른 모양 없음)이면 받지 않아요. 고르면 테마 시트 바로 뒤에 붙는데, 그러면 그 규칙이 첫 시트의 뒤 모듈(62 ~ 99)보다 뒤가 돼요.
//   그래도 화면이 같은 까닭을 여기서 매번 확인해요: 같은 요소 · 같은 속성 · 같은 !important · 같은 특이도로 겨루는 뒤 규칙이 없어요
//   (떼어 낸 규칙은 모두 마크다운 요소(h1 · hr · blockquote · table …)가 대상이고, 겨룰 수 있는 뒤 규칙은 단추 · 설정 칸처럼 클래스가 달린 다른 요소예요).
//   전체 시트(style-lazy.gen.css)에는 같은 규칙이 제자리에 그대로 있어요.
//   node tools/tests/markdown-css-split.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(path.join(root, 'tools/'));
const lib = require(path.join(root, 'tools/css-lib.cjs'));
const { markdownGated, markdownSplit } = require(path.join(root, 'tools/build-css.cjs'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 8).join('\n       ')); } };

const style = read('style.css'), md = read('src/markdown.gen.css'), full = read('src/style-lazy.gen.css');
const section = (text, name) => { const a = text.indexOf(`/* css/${name} */\n`); assert.ok(a >= 0, `${name} 칸`); const b = text.indexOf('\n/* css/', a + 10); return [a, b < 0 ? text.length : b]; };
const rulesOf = text => lib.flatRules(lib.parse(text));
const gatedRule = r => !r.ctx.length && lib.topSplit(r.selector).every(markdownGated);
const mdRules = rulesOf(md);

test('첫 시트에는 고른 마크다운 모양 규칙이 없고, 떼어 낸 시트가 전체 시트의 그 규칙과 글 · 차례까지 같아요', () => {
    const [a, b] = section(style, '61-markdown.css');
    const firstText = style.slice(a, b), first = rulesOf(firstText);
    assert.equal(first.filter(gatedRule).length, 0, '첫 시트 61 칸에 남은 고른 모양 규칙');
    assert.ok(mdRules.length >= 100, `떼어 낸 규칙 ${mdRules.length}개`);
    assert.ok(mdRules.every(gatedRule), '떼어 낸 규칙은 모두 body.salty.salty-md-* 를 요구해요');
    const [fa, fb] = section(full, '61-markdown.css');
    const fullText = full.slice(fa, fb), fullRules = rulesOf(fullText).filter(gatedRule);
    assert.deepEqual(mdRules.map(r => md.slice(r.start, r.end)), fullRules.map(r => fullText.slice(r.start, r.end)));
    // 남은 규칙(설정 창 표본 · 요소 클래스)은 전체 시트와 같은 차례로 첫 시트에 그대로
    const rest = rulesOf(fullText).filter(r => !gatedRule(r)).map(r => fullText.slice(r.start, r.end));
    assert.deepEqual(first.map(r => firstText.slice(r.start, r.end)), rest);
});

test('기본값(고른 모양 없음)에서는 떼어 낸 규칙이 하나도 맞지 않아요 — 기본값은 body 에 salty-md-* 를 달지 않아요', () => {
    assert.match(read('src/markdown.js'), /selected !== options\[0\]\[0\]/);
    for (const r of mdRules) for (const sel of lib.topSplit(r.selector)) assert.match(sel, /^body\.salty(?:[.:][\w-]+|\([^)]*\))*\.salty-md-[\w-]+/, sel.slice(0, 80));
});

test('떼어 낸 규칙은 첫 시트의 뒤 규칙과 같은 요소를 같은 특이도로 겨루지 않아요', () => {
    const [, b] = section(style, '61-markdown.css');
    const later = rulesOf(style.slice(b));
    const named = compound => /[.#][\w-]/.test(compound);   // 클래스 · id 가 달린 칸(단추 · 설정 칸) — 마크다운이 그리는 맨 요소가 아니에요
    const contentTag = /^(h[1-6]|hr|blockquote|ul|ol|li|table|thead|tbody|tr|th|td|details|summary|a|mark|u|ins|strong|b|em|i|code|pre|p)$/;
    const bad = [];
    let checked = 0;
    for (const r of mdRules) {
        const rs = lib.topSplit(r.selector);
        for (const x of rs) assert.match(lib.subjectKeys(x).tag || '', contentTag, `대상이 마크다운 요소예요: ${x.slice(0, 80)}`);
        for (const L of later) for (const d of r.decls) for (const e of L.decls) {
            if (d.nested || e.nested || d.important !== e.important || !lib.overlaps(d.lname, e.lname)) continue;
            for (const x of rs) for (const y of lib.topSplit(L.selector)) {
                if (lib.cmpSpec(lib.spec(x), lib.spec(y)) !== 0 || lib.disjoint(x, y)) continue;
                checked++;
                const ky = lib.subjectKeys(y);
                if (ky.tag || !named(ky.compound)) bad.push(`${x.slice(0, 90)} [${d.lname}] ↔ ${y.slice(0, 120)} [${e.lname}]`);
            }
        }
    }
    console.log(`       (같은 특이도 · 같은 속성 짝 ${checked}개 — 모두 클래스 · id 가 달린 다른 요소)`);
    assert.deepEqual(bad, []);
});

test('한 장 빌드(--one)면 떼지 않아요 · 떼는 함수는 칸이 없으면 그대로', () => {
    assert.deepEqual(markdownSplit('a{}'), { text: 'a{}', md: '', rules: 0 });
    const sample = '/* css/60-x.css */\nb{c:d}\n/* css/61-markdown.css */\nbody.salty.salty-md-size-small h1 {e:f}\n.bl-markdown-stage x {g:h}\n/* css/62-y.css */\ni{j:k}\n';
    const out = markdownSplit(sample);
    assert.equal(out.rules, 1);
    assert.equal(out.md, 'body.salty.salty-md-size-small h1 {e:f}');
    assert.equal(out.text, '/* css/60-x.css */\nb{c:d}\n/* css/61-markdown.css */\n.bl-markdown-stage x {g:h}\n/* css/62-y.css */\ni{j:k}\n');
    assert.match(read('tools/build-css.cjs'), /const mdSplit = rest \? markdownSplit\(dem\.boot\)/);
});

test('붙이는 코드: 고른 모양이 있을 때만 · 테마 시트 바로 뒤 · 전체 시트가 켜지면 꺼요 · 뒤에 붙는 시트는 그 뒤로', () => {
    const lite = read('src/lite.js'), apply = read('src/apply.js'), sheet = read('src/theme-sheet.js'), compat = read('src/compat-css.js');
    assert.match(apply, /syncMarkdownCss\(\[\.\.\.want\]\.some\(c => c\.startsWith\('salty-md-'\)\)\);\n[^\n]*\n\s+const cls = document\.body\.classList;/, '클래스를 바꾸기 전에');
    assert.match(lite, /const want = !!on && !\(full\?\.isConnected && full\.dataset\.blFullTheme === 'ready'\);/);
    assert.match(lite, /if \(sheet\?\.ownerNode\?\.isConnected\) sheet\.ownerNode\.after\(link\);/);
    assert.match(lite, /const sheetTail = sheet => \{ const split = document\.getElementById\('salty-lazy-css'\); if \(split\?\.isConnected\) return split; const md = markdownAfter\(sheet\); if \(md\) return md;/);
    assert.match(lite, /: markdownAfter\(sheet\) \|\| sheet\.ownerNode\)\.after\(link\);/, '미리보기 시트도 그 뒤');
    assert.match(sheet, /const enableTheme = main => \{ main\.sheet\.disabled = fullReady\(\); setLazy\(false\); setMarkdown\(fullReady\(\)\); \};/);
    assert.match(compat, /md\?\.isConnected && md\.previousElementSibling === theme \? md : theme/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/markdown-css-split\.mjs \./);
});

console.log(`markdown-css-split: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
