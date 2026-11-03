#!/usr/bin/env node
// 색 감시 (2026-10-22) — 개인 확장 코드에 palette.css 밖의 색 글자가 있는지 찾는다.
//   node palette-lint.mjs <확장 폴더> [--allow <허용 목록 json>] [--json <결과 파일>]
// 찾는 것: #rgb · #rrggbb · #rrggbbaa · rgb()/rgba() · hsl()/hsla() · oklch()/lab() 의 숫자 색 · CSS 색 이름(red · white …, transparent · currentColor · inherit 제외).
// 건너뜀: palette.css 자체, 주석 안(/* */ · //), 허용 목록(파일 경로 glob 또는 { file, line } — 원본 그대로 두는 파일 · iOS 시스템 색 · 앱 고유 색 · 사용자가 고른 캐릭터 색 같은 예외).
// 결과: 파일 · 줄 · 찾은 색 목록, 끝에 「위반 N」. 위반이 있으면 종료 코드 1.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const root = path.resolve(args[0] || '.');
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const allow = opt('--allow') ? JSON.parse(fs.readFileSync(opt('--allow'), 'utf8')) : { files: [], lines: [] };
const jsonOut = opt('--json');

const NAMES = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkturquoise darkviolet deeppink deepskyblue dimgray dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lawngreen lemonchiffon lightblue lightcoral lightcyan lightgray lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' ');
const COLOR_RE = new RegExp([
    '#[0-9a-fA-F]{8}\\b', '#[0-9a-fA-F]{6}\\b', '#[0-9a-fA-F]{3,4}\\b',
    '\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\\(\\s*[-\\d.]',
].join('|'), 'g');
// 색 이름은 CSS 값 자리에서만 (속성: 값 · 그라데이션 안) — JS 글자 안의 낱말(예: 'red' 상태 이름)을 잡지 않게 CSS 파일과 style 글자에서만
const NAME_RE = new RegExp(`(?<=[:,(\\s])(?:${NAMES.join('|')})(?=\\s*[;,)!}]|\\s*$)`, 'gi');

const globToRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
const allowFiles = (allow.files || []).map(globToRe);
const allowLine = new Set((allow.lines || []).filter(x => !x.text).map(x => `${x.file}:${x.line}`));
// 10-23 줄 번호는 위에 한 줄만 넣어도 밀린다 → text(그 줄에 든 글자)가 있으면 줄 번호 대신 글자로 찾는다
const allowText = (allow.lines || []).filter(x => x.text).map(x => ({ file: x.file, text: x.text }));

function stripComments(text, isCss) {
    // 줄 수를 지키며 주석을 공백으로
    let out = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    if (!isCss) out = out.replace(/(^|[^:\\'"`])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
    return out;
}

const results = [];
function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === '.git' || ent.name.startsWith('.')) continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) { walk(p); continue; }
        if (!/\.(css|js|mjs|html)$/i.test(ent.name) || /\.min\./.test(ent.name)) continue;
        const rel = path.relative(root, p).replace(/\\/g, '/');
        if (ent.name === 'palette.css' || allowFiles.some(r => r.test(rel))) continue;
        if (/(^|\/)(tests?|__tests__)\//.test(rel) || /\.test\.m?js$/.test(rel)) continue;
        const isCss = /\.css$/i.test(ent.name);
        const lines = stripComments(fs.readFileSync(p, 'utf8'), isCss).split('\n');
        lines.forEach((line, i) => {
            if (allowLine.has(`${rel}:${i + 1}`) || allowText.some(a => a.file === rel && line.includes(a.text))) return;
            const found = [...line.matchAll(COLOR_RE)].map(m => m[0]);
            if (isCss || /style|css|color|background|border|fill|stroke/i.test(line)) found.push(...[...line.matchAll(NAME_RE)].map(m => m[0]));
            if (found.length) results.push({ file: rel, line: i + 1, colors: [...new Set(found)], text: line.trim().slice(0, 160) });
        });
    }
}
walk(root);
for (const r of results) console.log(`${r.file}:${r.line}  ${r.colors.join(' ')}  | ${r.text}`);
console.log(`\n위반 ${results.length} (파일 ${new Set(results.map(r => r.file)).size}) — 기준: palette.css 의 --lp-* 만`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ root, count: results.length, results }, null, 1));
process.exit(results.length ? 1 : 0);
