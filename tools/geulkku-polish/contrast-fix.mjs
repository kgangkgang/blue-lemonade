#!/usr/bin/env node
// audit.mjs --fix 결과를 읽어, 바탕 대비 4.5 미만인 글자의 인라인 색을 같은 색상의 더 진한(어두운 바탕이면 더 밝은) 색으로 바꿔요(11-10).
//   node tools/geulkku-polish/contrast-fix.mjs --preview <audit-preview.json> [--template <audit-template.json>] [--dry]
// - 테마 마트 빌드에서 온 틀(심플 · 일러스트 · 다꾸 · 무테)만 고쳐요. 사이트 생성 도구가 만드는 조각(연말 · 장면 · 반응 · 내장 · 화보 · 노래 · 노래방)은 그 도구 · 테마 원본에서 고쳐요.
// - 그림 바탕(그라데이션 · 무늬) 위 글자는 바탕색을 알 수 없어 건드리지 않아요(목록만).
// - 요소는 「문서 차례 번호 + 태그 이름」으로 찾아요. 태그가 안 맞으면 그 틀은 건너뛰고 알려요.
// - 미리보기에서 바꾼 색이 색 묶음(colors)의 글자 역할 값과 같으면 그 값도 같이 바꿔요(시식 · 테마로 그릴 때도 같은 색이 되게).
// - 조각 파일 이름 · index.json 은 geulkku-polish.mjs 와 같은 식으로 다시 써요.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku'); const INDEX = path.join(DIR, 'index.json');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--') ? true : process.argv[i + 1]); };
const DRY = !!arg('dry');
const OWN = { test: c => /^(sp|il|dk|mt)-/.test(c) && !['sp-xmas', 'sp-scene', 'sp-react'].includes(c) }; const SKIP_IDS = new Set();   // 생성 도구가 --check 로 지키는 조각(연말 · 장면 · 반응 · 내장 · 화보 · 노래 · 노래방)은 건드리지 않아요
const TEXT_ROLES = ['faceText', 'faceMuted', 'text', 'dialogue', 'thought', 'emphasis', 'name', 'muted', 'chipText', 'onAccent'];
const audits = {}; for (const f of ['preview', 'template']) if (arg(f)) audits[f] = JSON.parse(fs.readFileSync(arg(f), 'utf8')).result;
const writeIndexText = ix => { const MARK = '__ITEMS_PLACEHOLDER__'; const text = JSON.stringify({ ...ix, items: MARK }, null, 1); const items = '[\n' + ix.items.map(it => '  ' + JSON.stringify(it)).join(',\n') + '\n ]'; return text.replace(`"${MARK}"`, () => items) + '\n'; };
const ix = JSON.parse(fs.readFileSync(INDEX, 'utf8')); const byId = new Map(ix.items.map(it => [it.id, it]));

// 문서 차례대로 여는 태그 위치를 모아요(주석 · <style> 안은 건너뛰되 <style> 자신은 한 요소)
function openTags(html) {
    const out = []; const re = /<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>|<([a-zA-Z][\w-]*)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g; let m;
    while ((m = re.exec(html))) { if (m[0].startsWith('<!--')) continue; if (/^<style/i.test(m[0])) { out.push({ tag: 'style', at: m.index, end: m.index + m[0].indexOf('>') + 1 }); continue; } out.push({ tag: m[1].toLowerCase(), at: m.index, end: m.index + m[0].length }); }
    return out;
}
function recolor(open, color) {
    if (/\sstyle="/i.test(open)) {
        const had = /(\sstyle="(?:[^"]*;)?\s*)color\s*:[^;"]*/i.test(open);
        return had ? open.replace(/(\sstyle="(?:[^"]*?;)?\s*)color\s*:[^;"]*/i, `$1color:${color}`) : open.replace(/\sstyle="/i, ` style="color:${color};`);
    }
    return open.replace(/(\/?)>$/, ` style="color:${color}"$1>`);
}
let fixedItems = 0, fixedEls = 0, paletteHits = 0; const skipped = []; const onImage = {};
for (const [c, ch] of Object.entries(ix.chunks)) {
    if (!OWN.test(c)) continue;
    const raw = fs.readFileSync(path.join(DIR, ch.file), 'utf8'); const j = JSON.parse(raw); let touched = false;
    for (const [id, it] of Object.entries(j.items)) {
        if (SKIP_IDS.has(id)) continue; let hit = false; const map = new Map();
        for (const field of ['preview', 'template']) {
            const a = audits[field]?.[id]; if (!a || !it[field]) continue;
            const lows = new Map(); for (const mode of ['light', 'dark']) for (const x of a[mode]?.low || []) { if (x.img) { if (field === 'preview' && mode === 'light') onImage[id] = (onImage[id] || 0) + 1; continue; } if (!lows.has(x.i)) lows.set(x.i, x); }
            if (!lows.size) continue;
            const tags = openTags(it[field]); let ok = true; for (const x of lows.values()) if (tags[x.i]?.tag !== x.tag) { ok = false; break; }
            if (!ok) { skipped.push(`${id}(${field})`); continue; }
            let html = it[field]; const jobs = new Map();   // 요소 번호 → 고칠 것(글자색 또는 바탕색 — 흰 글자는 바탕을 진하게)
            for (const x of lows.values()) { if (x.bgfix && tags[x.bgi]?.tag === x.bgtag && /background(-color)?\s*:\s*#[0-9a-f]{3,8}/i.test(html.slice(tags[x.bgi].at, tags[x.bgi].end))) { const old = jobs.get(x.bgi); if (!old || old.bg === undefined || old.bg > x.bgfix) jobs.set(x.bgi, { ...(old || {}), bg: x.bgfix }); } else { jobs.set(x.i, { ...(jobs.get(x.i) || {}), fg: x.fix }); if (x.inl) map.set(x.fg.toLowerCase(), x.fix); } }
            for (const [i, job] of [...jobs].sort((p, q) => q[0] - p[0])) { const t = tags[i]; let open = html.slice(t.at, t.end); if (job.fg) open = recolor(open, job.fg); if (job.bg) open = open.replace(/(background(?:-color)?\s*:\s*)#[0-9a-f]{3,8}/i, '$1' + job.bg); html = html.slice(0, t.at) + open + html.slice(t.end); fixedEls++; }
            if (html !== it[field]) { if (field === 'template') { const row = byId.get(id); if (row && row.bytes === Buffer.byteLength(it.template)) row.bytes = Buffer.byteLength(html); } it[field] = html; hit = true; }
        }
        if (hit && it.colors) for (const role of TEXT_ROLES) { const v = String(it.colors[role] || '').toLowerCase(); if (map.has(v)) { it.colors[role] = map.get(v); paletteHits++; const row = byId.get(id); if (row && role === 'text' && row.ink && row.ink.toLowerCase() === v) row.ink = map.get(v); } }
        if (hit) { fixedItems++; touched = true; }
    }
    if (!touched || DRY) continue;
    const text = JSON.stringify(j) + (raw.endsWith('\n') ? '\n' : ''); const file = `${c}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;
    fs.writeFileSync(path.join(DIR, file), text); if (file !== ch.file) fs.rmSync(path.join(DIR, ch.file)); ix.chunks[c] = { ...ch, file, bytes: Buffer.byteLength(text) };
}
if (!DRY && fixedItems) fs.writeFileSync(INDEX, writeIndexText(ix));
console.log(`${DRY ? '(쓰지 않음) ' : ''}대비 고침: 틀 ${fixedItems} · 글자 요소 ${fixedEls} · 색 묶음 값 ${paletteHits} · 태그가 안 맞아 건너뜀 ${skipped.length}${skipped.length ? ' — ' + skipped.slice(0, 12).join(', ') : ''} · 그림 바탕 위라 그대로 둔 글자가 있는 틀 ${Object.keys(onImage).length}`);
