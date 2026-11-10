#!/usr/bin/env node
// 글꾸 마트 자료(mart/data/geulkku/) 전부에 공통 다듬기(tools/geulkku-polish/polish.cjs)를 걸어 같은 자리에 다시 써요(11-10).
// - 실행: node tools/geulkku-polish.mjs [--check]   (node 24 · 외부 의존 없음 · 멱등)
//   --check: 쓰지 않고, 다듬을 것이 남았는지만 봐요(남았으면 1로 끝나요).
// - 고치는 것: 미리보기(preview)와 틈 템플릿(template)의 overflow:hidden → clip · height 옆 block-size · 스크롤바 숨김 한 줄. 모양은 그대로예요.
// - 틈 템플릿은 고친 뒤에도 테마 규칙(checkTemplate · 64KB)에 맞는지 다시 봐요. 어긋나면 그 틀은 그대로 두고 알려요.
// - 순서: 맨 마지막에 돌려요((테마) mart-build → split → accent → builtin → react · scene · hwabo · song · xmas · kara → 이것).
//   화보 · 노래 · 연말 · 노래방 도구는 스스로 같은 다듬기를 걸어요(그래서 그 도구들의 --check 와 어긋나지 않아요).
import { retired } from './geulkku-retired.mjs'; retired('geulkku-polish');   // 11-11 옛 글꾸를 마트에서 뺐어요 — 이 도구는 쉬어요(geulkku-retired.mjs)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const INDEX = path.join(DIR, 'index.json');
const CHECK = process.argv.includes('--check');
const { polishHtml } = createRequire(import.meta.url)('./geulkku-polish/polish.cjs');
const { checkTemplate } = await import('../mart/lib/log-copy/log-copy-template.js');
const NOTE = ' · tools/geulkku-polish.mjs 가 정화기 맞춤(overflow:clip · block-size · 스크롤바 숨김)을 걸어요';

const writeIndexText = ix => { const MARK = '__ITEMS_PLACEHOLDER__'; const text = JSON.stringify({ ...ix, items: MARK }, null, 1); const items = ix.items.length ? '[\n' + ix.items.map(it => '  ' + JSON.stringify(it)).join(',\n') + '\n ]' : '[]'; return text.replace(`"${MARK}"`, () => items) + '\n'; };
const indexRaw = fs.readFileSync(INDEX, 'utf8');
const ix = JSON.parse(indexRaw);
if (writeIndexText(ix) !== indexRaw) throw new Error('index.json 형식이 예상과 달라요 — 직렬화 규칙을 먼저 맞춰 주세요');
const byId = new Map(ix.items.map(it => [it.id, it]));
let changedItems = 0, changedChunks = 0, kept = 0; const refused = [];
for (const [c, ch] of Object.entries(ix.chunks)) {
    if (c === 'sg-kara') continue;   // 노래방 글꾸는 실제 글에서 확인한 자기 방식(overflow:hidden!important + overflow-x:clip + clip-path)을 그대로 써요
    const raw = fs.readFileSync(path.join(DIR, ch.file), 'utf8'); const j = JSON.parse(raw); const tail = raw.endsWith('\n') ? '\n' : '';
    let touched = false;
    for (const [id, it] of Object.entries(j.items)) {
        let hit = false;
        if (it.preview) { const p = polishHtml(it.preview, { preview: true }); if (p !== it.preview) { it.preview = p; hit = true; } }
        if (it.template) {
            const t = polishHtml(it.template, { preview: false });
            if (t !== it.template) {
                const was = checkTemplate(it.template), now = checkTemplate(t);
                if (was.ok !== false && now.ok === false) { refused.push(`${id}: ${now.reason || now.error || '규칙 어긋남'}`); }
                else { const row = byId.get(id); if (row && row.bytes === Buffer.byteLength(it.template)) row.bytes = Buffer.byteLength(t); it.template = t; hit = true; }
            }
        } else if (it.preview && hit) { const row = byId.get(id); if (row?.bytes) row.bytes = Buffer.byteLength(it.preview); }
        if (hit) { changedItems++; touched = true; } else kept++;
    }
    if (!touched) continue;
    changedChunks++;
    if (CHECK) continue;
    const text = JSON.stringify(j) + tail;
    const file = `${c}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;
    fs.writeFileSync(path.join(DIR, file), text);
    if (file !== ch.file && fs.existsSync(path.join(DIR, ch.file))) fs.rmSync(path.join(DIR, ch.file));
    ix.chunks[c] = { ...ch, file, bytes: Buffer.byteLength(text) };
}
if (refused.length) console.log(`틈 템플릿 규칙에 걸려 그대로 둔 틀 ${refused.length}개:\n  ${refused.slice(0, 20).join('\n  ')}`);
if (CHECK) { console.log(changedItems ? `다듬을 틀이 ${changedItems}개 남았어요 — node tools/geulkku-polish.mjs 로 걸어요` : `확인: 글꾸 ${kept}종 모두 다듬어져 있어요`); process.exit(changedItems ? 1 : 0); }
if (changedItems) { if (!String(ix._ || '').includes(NOTE)) ix._ = String(ix._ || '') + NOTE; fs.writeFileSync(INDEX, writeIndexText(ix)); }
console.log(`공통 다듬기: 고친 틀 ${changedItems} · 그대로 ${kept} · 다시 쓴 조각 ${changedChunks}`);
