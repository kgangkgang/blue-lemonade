#!/usr/bin/env node
// 테마가 받는 글꾸 마트 틀 — 고정 자료 tools/theme-takeable.json 을 테마의 받기 검사(src/mart-import.js checkItem)로 다시 떠요.
//   node tools/theme-takeable-pull.mjs <테마 저장소 폴더> [--check] [--out <파일>]
//   마트의 지금 조각(mart/data/geulkku — 꾸러미에 싣는 preview 그대로)을 틀마다 checkItem 에 넣어 받음 · 못 받음(까닭 글)을 적어요.
//   생성기(tools/geulkku-simple.mjs)는 이 자료로 목록의 nt(「테마 아직 못 받음」 꼬리표 · 「테마용 복사」 막힘)를 써요 — 테마 판이 받는 틀을 늘리면 이 도구만 다시 돌리고 자료를 다시 만들어요.
//   --check: 쓰지 않고 지금 자료와 같은지만(다르면 1). 테마 저장소는 읽기만 해요.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { execFileSync } from 'node:child_process';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'mart/data/geulkku');
const argv = process.argv.slice(2), THEME = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out');
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : path.join(ROOT, 'tools/theme-takeable.json');
if (!THEME || !fs.existsSync(path.join(THEME, 'src/mart-import.js'))) { console.error('테마 저장소 폴더(src/mart-import.js 가 든 곳)를 줘요'); process.exit(2); }
const sf = await import(pathToFileURL(path.join(ROOT, 'mart/simple-frames.js')).href);
const { checkItem } = await import(pathToFileURL(path.join(THEME, 'src/mart-import.js')).href);
const git = (...a) => execFileSync('git', ['-C', THEME, ...a], { encoding: 'utf8' }).trim();
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8')), previews = {};
for (const c of Object.values(index.chunks)) Object.assign(previews, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
const ok = [], no = {};
for (const it of index.items) {
    const html = previews[it.id].preview, key = sf.simpleFrameInfo(html)?.key || '';
    const r = checkItem({ kind: 'geulkku-simple', v: 1, id: it.id, key, name: it.name, emoji: it.emoji, html, set: { blGeulkku: 2 } });
    if (r.item) ok.push(it.id); else no[it.id] = r.reason;
}
let tag = ''; try { tag = git('describe', '--tags', '--abbrev=0'); } catch { /* 태그 없음 */ }
const doc = { _: '테마가 받는 글꾸 마트 틀 — tools/theme-takeable-pull.mjs 가 테마 받기 검사(src/mart-import.js checkItem)를 마트의 지금 조각에 돌려 뜬 것. 고치지 말고 다시 떠요(테마 판이 받는 틀을 늘리면)', theme: `${git('rev-parse', '--short=9', 'HEAD')}${tag ? ` · ${tag} 뒤` : ''}`, total: index.items.length, ok, no };
const text = `${JSON.stringify(doc, null, 1)}\n`;
if (argv.includes('--check')) { const same = fs.existsSync(OUT) && JSON.stringify({ ...JSON.parse(fs.readFileSync(OUT, 'utf8')), theme: 0, _: 0 }) === JSON.stringify({ ...doc, theme: 0, _: 0 }); console.log(same ? `확인: 테마 받기 판정 ${index.items.length}틀 그대로예요(받음 ${ok.length})` : '테마 받기 판정이 달라요 — 다시 떠요'); process.exit(same ? 0 : 1); }
fs.writeFileSync(OUT, text);
const why = {}; for (const r of Object.values(no)) { const w = (r.match(/— (.*)\(마트/) || [, r])[1]; why[w] = (why[w] || 0) + 1; }
console.log(`테마 ${doc.theme}: ${index.items.length}틀 중 받음 ${ok.length} · 못 받음 ${Object.keys(no).length}`, why);
