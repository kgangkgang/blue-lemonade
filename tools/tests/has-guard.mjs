// 7.9.4 :has() 지킴이 (글만 본다 — 브라우저 없음)
//   node tools/tests/has-guard.mjs <테마 루트>
// ① 문서 뿌리 고정점 금지: `html:has(…)` · `body:has(…)` · `:root:has(…)` 를 새로 쓰지 않는다. body 클래스 하나가 바뀔 때마다 문서 전체에서
//    :has 를 다시 따진다. 「테마가 켜져 있을 때만」은 `html > body.salty …`(뜻 · 특이도 같음)로 쓴다.
// ② 주어가 아닌 :has(:has 뒤에 다른 요소가 더 오는 선택자) 수는 기준보다 늘지 않는다 — 줄이는 방향만. 줄였으면 BASELINE 을 같이 낮춘다.
// 대상: style.css · css/*.css · src/**/*.css · 내장 스크립트가 넣는 CSS(src/scripts/plain/*.js 안의 긴 글자열)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASELINE = 243;   // 주어 아닌 :has 규칙 수(7.9.4 313 → B3 P2 311 → B4 P4 295 → B6 P3 일부 243)
const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const rel = f => path.relative(root, f).replace(/\\/g, '/');
// 검사할 CSS 글: style.css 는 css/ 의 합본이라 css/ 만 보고, 생성 사본(*.gen.css)은 원본과 겹치니 뺀다
const sources = [
    ...walk(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css')),
    ...walk(path.join(root, 'src')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css') && !/[\\/](vendor|node_modules)[\\/]/.test(f)),
].map(f => ({ file: rel(f), text: fs.readFileSync(f, 'utf8') }));
for (const f of walk(path.join(root, 'src/scripts/plain')).filter(f => f.endsWith('.js'))) {
    const t = fs.readFileSync(f, 'utf8'); let css = '';
    for (const m of t.matchAll(/"(?:[^"\\\n]|\\.){2000,}"/g)) { try { const s = JSON.parse(m[0]); if (s.includes('{') && s.includes(':has(')) css += s + '\n'; } catch { } }
    if (css) sources.push({ file: rel(f) + '(css)', text: css });
}
const split = (s, seps) => { const out = []; let d = 0, cur = '', q = null; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { cur += ch; if (ch === q) q = null; continue; } if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; } if (ch === '\\') { cur += ch + (s[i + 1] || ''); i++; continue; } if (ch === '(' || ch === '[') d++; if (ch === ')' || ch === ']') d--; if (d === 0 && seps.includes(ch)) { out.push(cur); cur = ''; continue; } cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
/** 규칙 머리(선택자) 목록 — @media 안까지, 주석 · 선언은 뺌 */
function selectors(text) {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, ''); const out = []; let buf = '', q = null;
    for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (q) { buf += ch; if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'") { q = ch; buf += ch; continue; }
        if (ch === '{') { const head = buf.trim(); buf = ''; if (!head.startsWith('@')) { out.push(head); let d = 1, j = i + 1; for (; j < css.length && d; j++) { if (css[j] === '{') d++; else if (css[j] === '}') d--; } i = j - 1; } continue; }
        if (ch === '}' || ch === ';') { buf = ''; continue; }
        buf += ch;
    }
    return out;
}
const rows = sources.flatMap(s => selectors(s.text).filter(h => h.includes(':has(')).map(h => ({ file: s.file, sel: h.replace(/\s+/g, ' ') })));
const nonSubject = sel => split(sel, [',']).some(part => { const toks = split(part, [' ', '>', '+', '~']); const hi = toks.findIndex(t => t.includes(':has(')); return hi >= 0 && hi < toks.length - 1; });

await test('① html · body · :root 를 :has 고정점으로 쓰지 않음', () => {
    const bad = rows.filter(r => /(^|[\s,>+~(])(html|body|:root)(\.[\w-]+|#[\w-]+|\[[^\]]*\])*:has\(/.test(r.sel)).map(r => `${r.file}: ${r.sel.slice(0, 140)}`);
    assert.deepEqual(bad, [], '문서 뿌리 :has — html > body.salty … 로 쓸 것');
});
await test(`② 주어 아닌 :has 규칙 수 ≤ ${BASELINE}`, () => {
    const n = rows.filter(r => nonSubject(r.sel)).length;
    assert.ok(n <= BASELINE, `주어 아닌 :has ${n}개 > 기준 ${BASELINE} — 같은 뜻의 좁은 선택자나 상태 클래스로 바꿔 주세요`);
    if (n < BASELINE) console.log(`       (지금 ${n}개 — 기준 ${BASELINE} 을 ${n} 으로 낮춰도 돼요)`);
});
await test('CI 에 이 시험이 들어 있음', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/has-guard\.mjs \./);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
