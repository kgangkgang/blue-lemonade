#!/usr/bin/env node
// 애드온 CSS 한 장 만들기 (9.0.9) — tools/build-addon-css.mjs
//
// src/addon-style-bundle.js 의 애드온 스타일(내장 애드온 style.css 와 그 @import 조각)을
// 브라우저가 읽는 순서 그대로 이어 src/addons/style-addons.css 한 장으로 써요. addons.js 는 켜진 애드온이 그 목록과 꼭 같을 때만 이 한 장을 붙여요.
//   - @import 는 시트 맨 앞(@charset 뒤)에 있는 것만 브라우저가 읽어요 → 그 자리에 대상 시트를 먼저 펼치고(깊이 우선), 조건 붙은 @import 는 멈춰요
//   - 뒤에 글자까지 똑같은 규칙(같은 @media 안 · 같은 선택자 · 같은 선언)이 또 있으면 앞의 것은 빼요 — 같은 특이도의 뒤 규칙이 늘 이기니
//     앞 규칙은 어떤 요소에서도 이기지 못해요(공용 조각 checks-common.css 5벌 · size.css 4벌 · num-comma.css 4벌 · palette.css 2벌)
//   - 주석은 빼요(토큰이 붙지 않게 필요한 곳엔 빈 주석 /**/). 상대 url() 은 한 장 자리(src/addons/) 기준으로 고쳐 써요
//   - 결과가 전과 같은 화면인지는 tools/css-cascade-diff.mjs 가 따로 확인해요(이 도구의 펼치기를 쓰지 않는 독립 구현)
//
//   node tools/build-addon-css.mjs            src/addons/style-addons.css 를 다시 써요 (node tools/build-css.cjs 도 불러요)
//   node tools/build-addon-css.mjs --check    다시 만든 것과 같은지만 봐요 (다르면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = require('./css-lib.cjs');
const BUNDLE_DIR = 'src/addons';

export async function tables(root = ROOT) {
    const bundle = await import(pathToFileURL(path.join(root, 'src/addon-style-bundle.js')).href);
    const { PRIVATE_ADDONS } = await import(pathToFileURL(path.join(root, 'src/private-addons.js')).href);
    return { ...bundle, sheetOf: id => `src/addons/${id}/${PRIVATE_ADDONS[id]?.css || 'style.css'}` };
}

/** addons.js 시작 순서(스타일을 따로 붙이는 translator 뺌) — 한 장 목록과 같아야 해요 */
export function startOrder(root = ROOT) {
    const src = fs.readFileSync(path.join(root, 'src/addons.js'), 'utf8');
    const m = /for\(const id of \[([^\]]+)\]\)\{\s*if\(!s\.addons\[id\]\)continue;/.exec(src);
    if (!m) throw new Error('src/addons.js 에서 애드온 시작 순서를 못 찾았어요');
    return [...m[1].matchAll(/'([\w-]+)'/g)].map(x => x[1]).filter(id => id !== 'translator' && id !== 'words');   // 1.0.0 되살림: 단어 치환(words)은 시작 목록에 있어도 모듈 · 시트가 없어요(addons.js 가 건너뜀)
}

const BREAK = /[\s{};:,()>+~]/;
/** 주석 빼기 — 문자열 안은 그대로, 빼서 두 토큰이 붙으면(a/**\/b) 빈 주석을 남겨요 */
export function dropComments(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') {
            const e = lib.endComment(s, i);
            const prev = out[out.length - 1];
            const next = s[e];
            if (!(prev === undefined || BREAK.test(prev) || next === undefined || BREAK.test(next))) out += '/**/';
            i = e;
            continue;
        }
        if (c === '"' || c === "'") { const e = lib.endString(s, i); out += s.slice(i, e); i = e; continue; }
        if (c === '\\') { out += s.slice(i, i + 2); i += 2; continue; }
        out += c;
        i++;
    }
    return out;
}

/** 문자열 밖의 잇단 공백을 한 칸으로 — 같은 규칙인지 견줄 열쇠 */
export function squash(s) {
    let out = '';
    let i = 0;
    let space = false;
    while (i < s.length) {
        const c = s[i];
        if (c === '"' || c === "'") { const e = lib.endString(s, i); if (space && out) out += ' '; space = false; out += s.slice(i, e); i = e; continue; }
        if (/\s/.test(c)) { space = true; i++; continue; }
        if (space && out) out += ' ';
        space = false;
        out += c;
        i++;
    }
    return out;
}

const RELATIVE = u => u && !/^(data:|https?:|\/|#|var\()/i.test(u);
function rebase(text, rel) {
    if (/image-set\(/i.test(text)) throw new Error(`${rel}: image-set() 안 주소는 아직 고쳐 쓰지 못해요`);
    return text.replace(/url\(\s*(['"]?)([^'")]*?)\1\s*\)/g, (all, q, u) => {
        if (!RELATIVE(u)) return all;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), u));
        return `url(${q}${path.posix.relative(BUNDLE_DIR, target)}${q})`;
    });
}

/** 한 시트 → 브라우저가 읽는 순서의 [{ file, nodes:[{ text, key }] }] (앞머리 @import 를 제자리에 먼저 펼침) */
export function expandSheet(root, rel, out = [], stack = []) {
    if (stack.includes(rel)) throw new Error(`@import 고리: ${[...stack, rel].join(' → ')}`);
    const css = fs.readFileSync(path.join(root, rel), 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const problems = [];
    const tree = lib.parse(css, problems);
    if (problems.length) throw new Error(`${rel}: CSS 를 읽다 멈췄어요 — ${problems[0]}`);
    let head = true;
    const nodes = [];
    for (const n of tree.children) {
        if (n.type === 'comment') continue;
        if (n.type === 'at' && n.name === 'charset') continue;
        if (n.type === 'at' && n.name === 'import') {
            if (!head) throw new Error(`${rel}: 규칙 뒤의 @import(브라우저가 버리는 줄) — 지우거나 맨 앞으로 옮겨요`);
            const m = /^@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*(.*)$/s.exec(n.prelude);
            if (!m || m[5].replace(/;$/, '').trim()) throw new Error(`${rel}: 조건 붙은 @import 는 펼치지 못해요 — ${n.prelude}`);
            expandSheet(root, path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[2] ?? m[4])), out, [...stack, rel]);
            continue;
        }
        head = false;
        const text = rebase(dropComments(css.slice(n.start, n.end)), rel).replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
        nodes.push({ text, key: squash(text) });
    }
    out.push({ file: rel, nodes });
    return out;
}

/** 애드온 첫 장들: [{ target, text }] — 시트마다 + 한 장 몫 하나. 창 안 규칙을 뺀 것 끝에 표지 규칙(창이 뜨면 animationstart 로 전체 시트를 부름) */
export async function bootSheets(root = ROOT, sheets = null) {
    const t = await tables(root);
    const { deferAddon } = require('./css-scope-defer.cjs');
    const filter = (id, text) => (t.ADDON_BOOT_CSS[id] ? deferAddon(text, t.ADDON_BOOT_CSS[id].panel, t.ADDON_BOOT_CSS[id].keep).text : text);
    const sentinel = ids => {
        const roots = [...new Set(ids.flatMap(id => t.ADDON_BOOT_CSS[id]?.roots || []))];
        return roots.length ? `@keyframes ${t.ADDON_CSS_SENTINEL}{from{--bl-addon-css:0}to{--bl-addon-css:1}}\n${roots.join(',')}{animation:${t.ADDON_CSS_SENTINEL} 1ms}\n` : '';
    };
    const out = [];
    for (const id of [...Object.keys(t.ADDON_BOOT_CSS)]) {
        const rel = id === 'translator' ? 'src/addons/translator/style.css' : t.sheetOf(id);
        const body = expandSheet(root, rel).flatMap(sheet => sheet.nodes.map(n => n.text)).join('\n');
        out.push({ target: path.join(root, BUNDLE_DIR, t.bootSheetOf(id)), text: `/* 생성 파일 — tools/build-addon-css.mjs (애드온 창 밖 규칙만 · 전체는 ${path.posix.basename(rel)}) */\n${filter(id, body).replace(/\n{2,}/g, '\n')}\n${sentinel([id])}` });
    }
    const parts = (sheets || []).filter(sheet => !t.LATE_STYLE_IDS.includes(sheet.id)).map(sheet => filter(sheet.id, sheet.nodes.filter(n => !n.drop).map(n => n.text).join('\n')));
    out.push({ target: path.join(root, BUNDLE_DIR, t.ADDON_BOOT_BUNDLE), text: `/* 생성 파일 — tools/build-addon-css.mjs (애드온 CSS 한 장의 첫 장 · 전체는 style-addons.css) */\n${parts.join('\n').replace(/\n{2,}/g, '\n')}\n${sentinel(t.ADDON_STYLE_IDS)}` });
    return out;
}

export async function build(root = ROOT) {
    const t = await tables(root);
    const order = startOrder(root);
    if (order.join() !== t.ADDON_STYLE_IDS.join()) throw new Error(`src/addon-style-bundle.js 목록이 addons.js 시작 순서와 달라요\n  목록: ${t.ADDON_STYLE_IDS.join(' ')}\n  시작: ${order.join(' ')}`);
    const sheets = [];
    for (const id of t.ADDON_STYLE_IDS) for (const sheet of expandSheet(root, t.sheetOf(id))) sheets.push({ id, ...sheet });
    // 뒤에 똑같은 규칙이 있는 앞 규칙 빼기 (뒤에서부터 보며 처음 본 열쇠만 남김)
    const seen = new Set();
    let dropped = 0;
    for (let s = sheets.length - 1; s >= 0; s--) {
        const nodes = sheets[s].nodes;
        for (let i = nodes.length - 1; i >= 0; i--) {
            if (seen.has(nodes[i].key)) { nodes[i].drop = true; dropped++; } else seen.add(nodes[i].key);
        }
    }
    const parts = [];
    for (const sheet of sheets) {
        const kept = sheet.nodes.filter(n => !n.drop);
        if (kept.length) parts.push(`/* ${sheet.file.slice(BUNDLE_DIR.length + 1)} */\n${kept.map(n => n.text).join('\n')}`);
    }
    const head = `@charset "UTF-8";\n/* Blue Lemonade 애드온 CSS 한 장 — tools/build-addon-css.mjs 가 src/addon-style-bundle.js 의 애드온 ${t.ADDON_STYLE_IDS.length}개 시트(@import 펼침 ${sheets.length}장)를 읽는 순서대로 이은 파일. 뒤에 똑같은 규칙이 있는 앞 규칙 ${dropped}개와 주석은 뺐어요. 여기서 고치지 말고 각 애드온 CSS 를 고친 뒤 node tools/build-addon-css.mjs (tools/css-cascade-diff.mjs 가 전후 같은지 확인) */\n`;
    return { text: head + parts.join('\n') + '\n', sheets: sheets.length, dropped, target: path.join(root, BUNDLE_DIR, t.ADDON_STYLE_BUNDLE), boots: await bootSheets(root, sheets) };
}

async function main(argv) {
    const check = argv.includes('--check');
    const r = await build(ROOT);
    const current = fs.existsSync(r.target) ? fs.readFileSync(r.target, 'utf8') : null;
    const kb = n => `${(Buffer.byteLength(n) / 1024).toFixed(1)}KB`;
    const staleBoots = r.boots.filter(b => (fs.existsSync(b.target) ? fs.readFileSync(b.target, 'utf8') : null) !== b.text);
    if (check) {
        if (staleBoots.length) { console.error(`[다름] 애드온 첫 장이 어긋났어요(${staleBoots.length}장) — node tools/build-addon-css.mjs 로 다시 만들어요`); return 1; }
        if (current === r.text) { console.log(`[같음] src/addons/style-addons.css = 시트 ${r.sheets}장 (${kb(r.text)})`); return 0; }
        console.error('[다름] src/addons/style-addons.css 가 애드온 CSS 와 어긋났어요 — node tools/build-addon-css.mjs 로 다시 만들어요');
        return 1;
    }
    for (const b of staleBoots) { fs.writeFileSync(b.target, b.text, 'utf8'); console.log(`[씀] ${path.relative(ROOT, b.target).split(path.sep).join('/')} (${kb(b.text)})`); }
    if (current === r.text) { console.log(`[그대로] src/addons/style-addons.css 가 이미 최신 (시트 ${r.sheets}장 · ${kb(r.text)})`); return 0; }
    fs.writeFileSync(r.target, r.text, 'utf8');
    console.log(`[씀] src/addons/style-addons.css ← 시트 ${r.sheets}장 · 뺀 앞 규칙 ${r.dropped}개 (${kb(r.text)})`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then(code => { process.exitCode = code; }, (error) => { console.error(`[오류] ${error.message}`); process.exitCode = 1; });
}
