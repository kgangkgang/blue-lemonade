#!/usr/bin/env node
// CSS 크기 · 규칙 보고 (9.0.1 경량화) — tools/css-report.mjs
//   node tools/css-report.mjs [테마 루트] [--json <파일>] [--unused] [--dupes] [--addons] [--st <실리태번 public 폴더>]
//
// 무엇을 세나 (전부 글만 본다 — 브라우저 없음)
//   · style.css: KB · 스타일 규칙 수 · `:has(` · `:is(` · `!important` · @media 수와 종류 · @container · @supports
//   · css/ 모듈마다: 원본 KB · style.css 안에서 차지하는 KB(모듈 표시 주석 `/* css/이름 */` 사이) · 규칙 수 · :has 수 · @media 수
//   · 지연 시트: src/preview.gen.css(설정 창 미리보기) · src/lazy-panel.gen.css(서랍 전용) · src/style-lazy.gen.css(--split)
//   · --dupes: 같은 조건(@media …) · 같은 선택자 · 같은 선언이 두 번 넘게 나오는 규칙 — 앞의 것은 지워도 폭포가 안 바뀐다(뒤가 이긴다)
//   · --unused: 선택자의 클래스 · 아이디 이름 가운데 테마 JS · 실리태번 본체(public/) · 설치 확장 어디에도 글자로 안 나오는 것 —
//     「후보」다(JS 가 `salty-user-${…}` 처럼 이어 붙이는 이름은 접두로 찾아 「동적」으로 따로 적는다). 지우기 전에 사람이 본다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const root = path.resolve(argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--json' && argv[argv.indexOf(a) - 1] !== '--st') || '.');
const require = createRequire(import.meta.url);
const L = require(path.join(root, 'tools/css-lib.cjs'));
const KB = n => (n / 1024).toFixed(1);
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;

function stats(text) {
    const tree = L.parse(text);
    const rules = L.flatRules(tree);
    const out = { bytes: Buffer.byteLength(text), rules: rules.length, has: 0, is: 0, important: 0, media: 0, container: 0, supports: 0, mediaKinds: new Map(), problems: tree.problems.length };
    const walk = nodes => { for (const n of nodes) { if (n.type !== 'at') continue; if (n.name === 'media') { out.media++; const k = n.prelude.replace(/\s+/g, ' ').trim(); out.mediaKinds.set(k, (out.mediaKinds.get(k) || 0) + 1); } else if (n.name === 'container') out.container++; else if (n.name === 'supports') out.supports++; if (n.children) walk(n.children); } };
    walk(tree.children);
    for (const r of rules) {
        out.has += (r.selector.match(/:has\(/g) || []).length;
        out.is += (r.selector.match(/:is\(/g) || []).length;
        for (const d of r.decls) if (d.important) out.important++;
    }
    return { ...out, list: rules, tree };
}

// ───────── style.css 전체 ─────────
const styleText = read(path.join(root, 'style.css'));
if (!styleText) { console.error('style.css 가 없어요'); process.exit(1); }
const S = stats(styleText);
const report = { style: { kb: KB(S.bytes), rules: S.rules, has: S.has, is: S.is, important: S.important, media: S.media, mediaKinds: S.mediaKinds.size, container: S.container, supports: S.supports } };
console.log(`style.css ${KB(S.bytes)}KB · 규칙 ${S.rules} · :has ${S.has} · :is ${S.is} · !important ${S.important} · @media ${S.media}(${S.mediaKinds.size}종) · @container ${S.container} · @supports ${S.supports}`);

// 지연 시트
report.lazy = {};
for (const rel of ['src/preview.gen.css', 'src/lazy-panel.gen.css', 'src/style-lazy.gen.css']) {
    const t = read(path.join(root, rel));
    if (t == null) continue;
    const s = stats(t);
    report.lazy[rel] = { kb: KB(s.bytes), rules: s.rules, has: s.has, media: s.media };
    console.log(`  지연 ${rel} ${KB(s.bytes)}KB · 규칙 ${s.rules} · :has ${s.has} · @media ${s.media}`);
}

// ───────── 모듈별 ─────────
// style.css 는 모듈마다 `/* css/이름 */` 한 줄로 시작한다 (build-css.cjs) — 그 사이 글이 그 모듈의 몫
const marks = [...styleText.matchAll(/^\/\* css\/(\d\d-[a-z0-9.-]+\.css) \*\/$/gm)];
const share = new Map();
for (let i = 0; i < marks.length; i++) {
    const a = marks[i].index, b = i + 1 < marks.length ? marks[i + 1].index : styleText.length;
    share.set(marks[i][1], styleText.slice(a, b));
}
const cssDir = path.join(root, 'css');
const modules = fs.readdirSync(cssDir).filter(n => n.endsWith('.css')).sort();
report.modules = [];
console.log('\n모듈 | 원본KB | style.css 몫KB | 규칙 | :has | @media');
for (const name of modules) {
    const raw = read(path.join(cssDir, name));
    const built = share.get(name) || '';
    const s = stats(built || raw);
    report.modules.push({ name, rawKb: KB(Buffer.byteLength(raw)), builtKb: KB(Buffer.byteLength(built)), rules: s.rules, has: s.has, media: s.media });
    console.log(`${name} | ${KB(Buffer.byteLength(raw))} | ${KB(Buffer.byteLength(built))} | ${s.rules} | ${s.has} | ${s.media}`);
}

// @media 종류
console.log('\n@media 종류 (style.css)');
for (const [k, v] of [...S.mediaKinds].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
report.mediaKinds = Object.fromEntries(S.mediaKinds);

// ───────── 중복 규칙 ─────────
// 원본 css/ 모듈을 빌드 순서로 이어 읽는다(style.css 는 바구니 펼치기 · 열쇠로 선택자가 바뀌어 있어 원본 기준이 맞다)
const norm = s => s.replace(/\s+/g, ' ').trim();
const declKey = decls => decls.map(d => `${d.lname}:${norm(L.stripComments(d.value))}${d.important ? '!' : ''}`).join(';');
if (flag('--dupes')) {
    const seen = new Map();
    for (const name of modules) {
        const text = read(path.join(cssDir, name));
        const tree = L.parse(text);
        for (const r of L.flatRules(tree)) {
            const key = `${r.ctx.map(c => norm(c.prelude || c)).join(' / ')} || ${norm(L.cleanSel(r.selector))} { ${declKey(r.decls)} }`;
            if (!seen.has(key)) seen.set(key, []);
            seen.get(key).push(`${name}:${text.slice(0, r.start).split('\n').length}`);
        }
    }
    const dupes = [...seen].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
    report.dupes = dupes.map(([k, v]) => ({ rule: k.slice(0, 200), at: v }));
    console.log(`\n같은 규칙(조건 · 선택자 · 선언 전부 같음)이 두 번 넘게: ${dupes.length}묶음 · 지울 수 있는 앞쪽 사본 ${dupes.reduce((n, [, v]) => n + v.length - 1, 0)}개`);
    for (const [k, v] of dupes.slice(0, 40)) console.log(`  ${v.join(' · ')}\n     ${k.slice(0, 160)}`);
}

// ───────── 안 쓰는 선택자 후보 ─────────
if (flag('--unused')) {
    const walk = (dir, pick) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (/(^|[\\/])(node_modules|vendor|\.git)$/.test(e.name) ? [] : walk(path.join(dir, e.name), pick)) : (pick(e.name) ? [path.join(dir, e.name)] : [])) : [];
    const jsLike = n => /\.(m?js|cjs|html|json)$/.test(n) && !n.endsWith('.gen.css');
    let hay = '';
    for (const f of [path.join(root, 'index.js'), ...walk(path.join(root, 'src'), jsLike)]) hay += read(f) + '\n';
    const stDir = opt('--st', path.resolve(root, '../../..', 'public'));
    const stCandidates = [stDir, process.env.ST_PUBLIC].filter(d => d && fs.existsSync(path.join(d, 'index.html')));   // 다른 자리의 실리태번 public 은 --st 나 환경 변수 ST_PUBLIC 으로
    let stHay = '';
    if (stCandidates.length) {
        const d = stCandidates[0];
        for (const f of [path.join(d, 'index.html'), path.join(d, 'style.css'), ...walk(path.join(d, 'scripts'), n => /\.(js|html)$/.test(n)), ...walk(path.join(d, 'css'), n => n.endsWith('.css'))]) stHay += (read(f) || '') + '\n';
        // 설치 확장(테마 아닌 것)의 이름도 — 테마가 다른 확장 UI 를 다듬는 규칙이 있다
        const ext = path.join(d, '..', 'data', 'default-user', 'extensions');
        if (fs.existsSync(ext)) for (const sub of fs.readdirSync(ext)) if (sub !== 'blue-lemonade') for (const f of walk(path.join(ext, sub), n => /\.(js|html|css)$/.test(n))) stHay += (read(f) || '') + '\n';
        console.log(`\n실리태번 본체 글: ${d} (${KB(Buffer.byteLength(stHay))}KB)`);
    } else console.log('\n실리태번 본체(public/)를 못 찾아 테마 JS 만으로 봐요 — --st <폴더>');
    const tokens = new Map(); // 이름 → { rules, bytes, where:Set }
    for (const name of modules) {
        const text = read(path.join(cssDir, name));
        for (const r of L.flatRules(L.parse(text))) {
            const sel = L.stripNot(L.cleanSel(r.selector));
            const names = new Set();
            for (const m of sel.matchAll(/[.#]([A-Za-z_-][\w-]*)/g)) names.add(m[0]);
            for (const n of names) {
                if (!tokens.has(n)) tokens.set(n, { rules: 0, bytes: 0, where: new Set() });
                const t = tokens.get(n); t.rules++; t.bytes += r.end - r.start; t.where.add(name);
            }
        }
    }
    const inJs = n => { const bare = n.slice(1); return hay.includes(bare) || stHay.includes(bare); };
    const dynamic = n => { const bare = n.slice(1); for (let i = bare.lastIndexOf('-'); i > 0; i = bare.lastIndexOf('-', i - 1)) { const p = bare.slice(0, i + 1); if (hay.includes(`${p}\${`) || hay.includes(`${p}' +`) || hay.includes(`${p}'+`) || hay.includes(`${p}"+`) || hay.includes(`'${p}'`) || hay.includes(`"${p}"`)) return true; } return false; };
    const unused = [], dyn = [];
    for (const [n, t] of tokens) { if (inJs(n)) continue; (dynamic(n) ? dyn : unused).push({ name: n, ...t, where: [...t.where] }); }
    unused.sort((a, b) => b.bytes - a.bytes);
    report.unused = unused.map(u => ({ name: u.name, rules: u.rules, kb: KB(u.bytes), where: u.where }));
    report.dynamic = dyn.map(u => u.name);
    console.log(`\n안 쓰는 선택자 이름 후보 ${unused.length}개 (어느 글에도 없음) · 동적 이름 ${dyn.length}개(JS 가 이어 붙임 — 손으로 볼 것)`);
    for (const u of unused.slice(0, 80)) console.log(`  ${u.name.padEnd(40)} 규칙 ${String(u.rules).padStart(3)} · ${KB(u.bytes).padStart(6)}KB · ${u.where.slice(0, 4).join(' ')}${u.where.length > 4 ? ' …' : ''}`);
    if (dyn.length) console.log(`  동적: ${dyn.map(u => u.name).slice(0, 60).join(' ')}`);
}

// ───────── 애드온 CSS 공통 덩어리 ─────────
// 내장 애드온 CSS(src/addons/**.css)에서 조건 · 선언이 똑같은 규칙이 세 애드온 넘게 되풀이되는 것 — 한 장으로 합칠 후보(선택자는 애드온마다 다르다)
if (flag('--addons')) {
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'vendor' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.css') ? [path.join(d, e.name)] : []);
    const files = walk(path.join(root, 'src/addons'));
    const blocks = new Map();
    let rules = 0, bytes = 0;
    for (const f of files) {
        const text = read(f);
        bytes += Buffer.byteLength(text);
        for (const r of L.flatRules(L.parse(text))) {
            rules++;
            const k = `${r.ctx.join(' / ')} { ${declKey(r.decls)} }`;
            if (!blocks.has(k)) blocks.set(k, []);
            blocks.get(k).push({ addon: path.relative(path.join(root, 'src/addons'), f).split(path.sep)[0], size: r.end - r.start });
        }
    }
    const shared = [...blocks].filter(([, v]) => new Set(v.map(x => x.addon)).size > 2);
    const saving = shared.reduce((n, [, v]) => n + v.slice(1).reduce((s, x) => s + x.size, 0), 0);
    report.addons = { files: files.length, kb: KB(bytes), rules, sharedBlocks: shared.length, sharedKb: KB(saving) };
    console.log(`\n애드온 CSS ${files.length}장 · ${KB(bytes)}KB · 규칙 ${rules} · 세 애드온 넘게 같은 선언 묶음 ${shared.length}개(합치면 최대 ${KB(saving)}KB)`);
}

const out = opt('--json');
if (out) { fs.writeFileSync(out, JSON.stringify(report, null, 1), 'utf8'); console.log(`\n[씀] ${out}`); }
