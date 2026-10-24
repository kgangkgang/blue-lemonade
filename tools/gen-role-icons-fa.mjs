#!/usr/bin/env node
/* =========================================================
   단추 아이콘 고르기 창의 Font Awesome 목록 만들기 — tools/gen-role-icons-fa.mjs

   실리태번이 이미 싣는 Font Awesome Free(글꼴 · CSS)에서 아이콘 이름과 글자 번호만 뽑아 src/role-icons-fa.gen.js 로 쓴다.
   새 글꼴이나 바깥 아이콘 서버를 쓰지 않는다 — 고르기 창은 실리태번이 이미 불러 둔 글꼴로 그린다.
   「테마에서 쓰는」 묶음은 테마 src · css · index.js 에 적힌 fa-* 이름 가운데 목록에 있는 것.

     node tools/gen-role-icons-fa.mjs --css <실리태번 public/css 폴더>          다시 만들기
     node tools/gen-role-icons-fa.mjs --css <실리태번 public/css 폴더> --check  지금 파일과 같은지만 (다르면 종료 코드 1)

   실리태번이 Font Awesome 판을 올리면 tools/fa-free-6.5.2.txt 와 같이 다시 뽑는다.
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'role-icons-fa.gen.js');
const args = process.argv.slice(2);
const cssDir = args[args.indexOf('--css') + 1];
const check = args.includes('--check');
if (!args.includes('--css') || !cssDir) {
    console.error('쓰는 법: node tools/gen-role-icons-fa.mjs --css <실리태번 public/css 폴더> [--check]');
    process.exit(2);
}

/** .fa-a:before,.fa-b:before{content:"\f00d"} → Map(번호 → [이름…]) */
function table(file) {
    const text = fs.readFileSync(path.join(cssDir, file), 'utf8');
    const version = /Font Awesome Free ([\d.]+)/.exec(text)?.[1] || '';
    const map = new Map();
    for (const m of text.matchAll(/((?:\.fa-[a-z0-9-]+:before,?)+)\{content:"\\([0-9a-f]{2,5})"\}/g)) {
        const names = m[1].split(',').map(s => s.slice(4, -7)).filter(Boolean);
        const list = map.get(m[2]) || [];
        map.set(m[2], [...new Set([...list, ...names])]);
    }
    return { version, map };
}

const solid = table('fontawesome.min.css');
const brands = table('brands.min.css');
if (solid.map.size < 1000 || brands.map.size < 300) throw new Error(`목록이 너무 짧아요: 실선 ${solid.map.size} · 브랜드 ${brands.map.size}`);

// 테마에 적힌 fa-* 이름 (모양 · 크기 이름은 목록에 없으니 저절로 빠진다)
const SKIP = new Set(['vendor', 'node_modules', 'sfx', 'sfx-extra', 'scene-music']);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (SKIP.has(e.name) ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]);
const used = new Set();
for (const file of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'css')), path.join(ROOT, 'index.js')]) {
    if (!/\.(js|mjs|css)$/.test(file) || file === OUT || /\.gen\.(js|css)$/.test(file)) continue;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/(?<![\w-])fa-([a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])/g)) used.add(m[1]);
}

// 한 글자에 이름이 여럿(별칭)이면: 테마가 쓰는 이름 → 나머지는 CSS 순서(가나다). 찾기는 모든 이름으로 한다
const pack = map => [...map].sort((a, b) => parseInt(a[0], 16) - parseInt(b[0], 16)).map(([code, names]) => {
    const own = names.filter(n => used.has(n));
    return `${code}:${[...own, ...names.filter(n => !used.has(n))].join(',')}`;
}).join(';');
const usedCodes = map => [...map].filter(([, names]) => names.some(n => used.has(n))).map(([code]) => code);

const body = `// 만든 파일 — 손으로 고치지 말고 node tools/gen-role-icons-fa.mjs --css <실리태번 public/css> 로 다시 만든다.
// Font Awesome Free ${solid.version} (실리태번이 싣는 글꼴 · CSS) 의 아이콘 이름과 글자 번호. 아이콘: CC BY 4.0, 글꼴: SIL OFL 1.1 (THIRD-PARTY-NOTICES.md).
// 줄 모양: "글자번호:이름,별칭…;…" — 단추 아이콘 고르기 창(role-icons-ui.js)이 열릴 때만 불러온다.
export const FA_VERSION = ${JSON.stringify(solid.version)};
export const SOLID = ${JSON.stringify(pack(solid.map))};
export const BRANDS = ${JSON.stringify(pack(brands.map))};
export const USED = ${JSON.stringify([...usedCodes(solid.map).map(c => `s${c}`), ...usedCodes(brands.map).map(c => `b${c}`)].join(','))};
`;

if (check) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== body) { console.error('src/role-icons-fa.gen.js 가 실리태번 Font Awesome · 테마 이름과 달라요 — --check 없이 다시 만들어 주세요'); process.exit(1); }
    console.log(`같아요: 실선 ${solid.map.size} · 브랜드 ${brands.map.size}`);
} else {
    fs.writeFileSync(OUT, body);
    console.log(`썼어요: 실선 ${solid.map.size} · 브랜드 ${brands.map.size} · 테마에서 쓰는 ${usedCodes(solid.map).length + usedCodes(brands.map).length}`);
}
