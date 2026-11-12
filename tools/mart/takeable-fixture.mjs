// 글꾸 마트(gh-pages)의 심플 틀 가운데 테마 「마트에서 가져오기」가 실제로 받는 틀 목록을 떠요 — 테마 받기 검사(src/mart-import.js checkItem)를 그대로 돌려요.
//   쓰는 곳: tools/tests/log-copy-retired.mjs(뺀 옛 내장 글꾸가 안내하는 마트 새 판이 모두 받을 수 있는 틀인지)
//   node tools/mart/takeable-fixture.mjs [가지 · 기본 origin/gh-pages]   → tools/tests/fixtures/mart-takeable.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REF = process.argv[2] || 'origin/gh-pages';
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const show = file => JSON.parse(git('show', `${REF}:${file}`));
const { checkItem } = await import(pathToFileURL(path.join(ROOT, 'src/mart-import.js')).href);

const dir = 'mart/data/geulkku/';
const index = show(`${dir}index.json`);
const chunks = {};
for (const file of git('ls-tree', '--name-only', REF, dir).split('\n').filter(f => /\/sp-[^/]+\.json$/.test(f))) Object.assign(chunks, show(file).items);
const ok = [], no = {};
for (const it of index.items) {
    const key = (it.id.match(/((?:k|q)\d+)$/) || [])[1] || '';
    const r = checkItem({ kind: 'geulkku-simple', v: 1, id: it.id, key, name: it.name, emoji: it.emoji, html: chunks[it.id]?.preview || '', set: { blGeulkku: 2 } });
    if (r.item) ok.push(it.id); else no[it.id] = r.reason;
}
const commit = git('rev-parse', '--short=9', REF).trim();
const out = path.join(ROOT, 'tools/tests/fixtures/mart-takeable.json');
fs.writeFileSync(out, `${JSON.stringify({ _: '글꾸 마트 심플 틀 중 테마가 받는 틀 — node tools/mart/takeable-fixture.mjs 로 다시 떠요(고치지 말고)', site: commit, total: index.items.length, ok, no }, null, 1)}\n`);
console.log(`마트 ${commit}: ${index.items.length}틀 중 받는 틀 ${ok.length} · 못 받는 틀 ${Object.keys(no).length} → ${out}`);
