#!/usr/bin/env node
// 1.0.3 확장 충돌 검사 — 블루레몬에이드 자신의 신호표(src/extcheck/self.gen.js)를 만들어요.
//   검사 창은 다른 확장은 서버에서 파일을 읽어 보지만, 테마 자신은 묶음(dist/) 8MB 를 다 받지 않게 원본(src/)에서 미리 뽑아 둔 이 표를 써요.
//   같은 판정 함수(src/extcheck/core.js scanJs · scanHtml)를 쓰고, src/addons/<id>/ 안 신호에는 그 애드온 id 를 붙여 켠 기능 몫만 맞대요.
//   빼는 것: 검사기 자신 · vendor(남의 묶음) · *.gen.js(사전 · 표) · 시험 파일.
//   node tools/build-extcheck-self.mjs [뿌리]          다시 씀
//   node tools/build-extcheck-self.mjs [뿌리] --check  원본과 맞는지만 (CI)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const check = args.includes('--check');
const root = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const { scanJs, scanHtml } = await import(pathToFileURL(path.join(root, 'src/extcheck/core.js')).href);
const OUT = path.join(root, 'src/extcheck/self.gen.js');
const KINDS = new Set(['command', 'macro', 'tool', 'global', 'settingsKey', 'id', 'patch', 'hotkey', 'edge', 'event', 'prompt']);

const posix = p => p.split(path.sep).join('/');
function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = path.join(dir, e.name), rel = posix(path.relative(root, p));
        if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'node_modules' && rel !== 'src/extcheck') walk(p, out); continue; }
        if (/\.gen\.js$|\.test\.m?js$/.test(e.name)) continue;
        if (/\.(?:m?js|html)$/.test(e.name)) out.push(p);
    }
    return out;
}
export function build() {
    const rows = [];
    for (const file of [path.join(root, 'index.js'), ...walk(path.join(root, 'src'))]) {
        const rel = posix(path.relative(root, file)), text = fs.readFileSync(file, 'utf8');
        const addon = /^src\/addons\/([^/]+)\//.exec(rel)?.[1] || '';
        const found = rel.endsWith('.html') ? scanHtml(text) : scanJs(text);
        for (const s of found) if (KINDS.has(s.k)) rows.push([s.k, s.key, rel, s.line, addon, s.how || '', s.chained ? 1 : 0]);
    }
    rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]) || a[3] - b[3]);
    const body = rows.map(r => JSON.stringify(r)).join(',\n');
    return `// 만든 파일 — 고치지 마요. node tools/build-extcheck-self.mjs (원본: src/ · 판정: src/extcheck/core.js)\n`
        + `// [종류, 이름, 파일, 줄, 애드온 id, 쓰기 꼴, 이어 부르는 감싸기]\n`
        + `export const SELF_ROWS = [\n${body}\n];\n`;
}
const text = build();
if (check) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.error('src/extcheck/self.gen.js 가 원본과 달라요 — node tools/build-extcheck-self.mjs 로 다시 만들어요'); process.exit(1); }
    console.log('src/extcheck/self.gen.js 맞아요');
} else {
    fs.writeFileSync(OUT, text);
    console.log(`src/extcheck/self.gen.js ${(text.length / 1024).toFixed(1)}KB`);
}
