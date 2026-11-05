#!/usr/bin/env node
// 글꾸 마트 자료(mart/data/geulkku/)에 글꾸마다 accent(강조색) · icon(아이콘)을 덧붙여 같은 자리에 다시 써요.
// - 실행: node tools/geulkku-accent.mjs   (node 24 · 외부 의존 없음)
// - 처음 한 번만 원본을 _before-accent/ 에 백업해요(이미 있으면 덮어쓰지 않아요).
// - 멱등이에요: 두 번 돌려도 결과가 같아요.
// - 조각 파일 이름의 8자 해시는 내용의 sha256 앞 8자예요. 내용이 바뀌면 새 해시 이름으로 바꾸고 index.json 의 chunks[c].file 도 같이 고쳐요
//   (조각은 브라우저 캐시를 그대로 쓰고 index.json 만 no-cache 로 받으니, 이름이 안 바뀌면 옛 조각이 남을 수 있어요).

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'mart', 'data', 'geulkku');
const BACKUP = join(DIR, '_before-accent');
const ICON_DIR = join(DIR, 'icon');
const INDEX = join(DIR, 'index.json');

const PAPER = '#fdfeff';          // 사이트 흰 면
const INK = '#1c293b';            // 사이트 잉크
const FALLBACK = '#2264a5';       // 사이트 --blue-strong
const MIN_CONTRAST = 4.5;         // 담기 단추 14px 글자 기준
const CANDIDATES = ['accent', 'name', 'chip', 'quoteBar', 'deco1', 'face'];
const NOTE = ' · tools/geulkku-accent.mjs 가 accent · icon 을 덧붙여요';

// ── 색 계산 ──────────────────────────────────────────────
function parseHex(v) {
    if (typeof v !== 'string') return null;
    const m = v.trim().toLowerCase().match(/^#([0-9a-f]{3,8})$/);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(x => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    if (h.length === 8) {   // 반투명은 흰 면 위에 얹은 색으로 봐요
        const a = parseInt(h.slice(6, 8), 16) / 255;
        const p = parseHex(PAPER);
        return rgb.map((c, i) => Math.round(c * a + p[i] * (1 - a)));
    }
    return rgb;
}
const toHex = rgb => '#' + rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
function luminance(rgb) {
    const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}
const PAPER_RGB = parseHex(PAPER);
const INK_RGB = parseHex(INK);

// 결과: { color, via } · via 는 후보 이름 또는 '어둡게' · '기본값'
function pickAccent(colors) {
    const present = [];
    for (const key of CANDIDATES) {
        const rgb = parseHex(colors?.[key]);
        if (!rgb) continue;
        present.push({ key, rgb });
        if (contrast(rgb, PAPER_RGB) >= MIN_CONTRAST) return { color: toHex(rgb), via: key };
    }
    if (!present.length) return { color: FALLBACK, via: '기본값' };
    const base = (present.find(p => p.key === 'accent') || present[0]).rgb;
    for (let step = 1; step <= 50; step++) {
        const t = step * 0.02;
        const mixed = base.map((c, i) => Math.round(c * (1 - t) + INK_RGB[i] * t));
        if (contrast(mixed, PAPER_RGB) >= MIN_CONTRAST) return { color: toHex(mixed), via: '어둡게' };
    }
    return { color: FALLBACK, via: '기본값' };   // 잉크 자체가 4.5 이상이라 여기는 오지 않아요
}

// ── 아이콘 찾기 ───────────────────────────────────────────
// <style> 과 주석을 걷어 낸 뒤 첫 data:image/svg+xml,… 를 찾아요(끝은 ' " ) 중 먼저 나오는 것).
// 11-05 사용자 「비는 왜 물방울 아이콘이 아니라 저거여?」 — 첫 그림이 처마 끝 물결 띠(가로로 긴 반복 무늬)였어요.
// 그래서 모든 SVG 후보 중 viewBox 가로세로 비가 정사각형에 가장 가까운 것을 골라요(띠 · 줄 무늬는 비가 1.6 넘어 뒤로 밀려요). 같으면 앞의 것.
function svgAspect(uri) {
    const svg = decodeSvg(uri) || '';
    const vb = svg.match(/viewBox\s*=\s*['"]\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    let w = vb ? +vb[1] : NaN, h = vb ? +vb[2] : NaN;
    if (!(w > 0 && h > 0)) { const W = svg.match(/\bwidth\s*=\s*['"]([\d.]+)/i), H = svg.match(/\bheight\s*=\s*['"]([\d.]+)/i); w = W ? +W[1] : NaN; h = H ? +H[1] : NaN; }
    return w > 0 && h > 0 ? Math.abs(Math.log(w / h)) : Math.log(1.6);   // 모르면 중간 점수
}
function findSvgUri(preview) {
    if (typeof preview !== 'string') return null;
    const body = preview.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const all = body.match(/data:image\/svg\+xml,[^'")]*/g);
    if (!all) return null;
    // 첫 그림을 그대로 쓰되(지금까지 고른 아이콘 유지), 첫 그림이 띠 무늬(가로세로 비 1.6 넘음)이거나
    // 흰 바탕에서 거의 안 보이는 옅은 그림(흰 선 · 반투명 흰색 · 빛 번지는 달 원판)일 때만 다음 후보로 넘어가요.
    // 넘어갈 때 동그라미 · 사각 하나짜리 배경(빛 번짐 · 원판)도 건너뛰어요.
    const STRIP = Math.log(1.6);
    // 원판 거르기: 동그라미 · 타원 · 네모 하나뿐인 그림, 또는 번지는 빛(radialGradient)에 도형 둘 이하 — 물방울처럼 경로 하나짜리 그림은 살려요(11-05 「비」)
    const blob = u => { const s = decodeSvg(u) || ''; const shapes = s.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b/gi) || []; return (shapes.length === 1 && !/^<(path|polygon|polyline)/i.test(shapes[0])) || /radialGradient/i.test(s) && shapes.length <= 2; };
    const good = u => svgAspect(u) <= STRIP && svgInk(u) >= INK_MIN;
    if (good(all[0])) return all[0];
    return all.slice(1).find(u => good(u) && !blob(u))
        || all.find(u => svgInk(u) >= INK_MIN)
        || null;   // 흰 바탕에서 보이는 그림이 하나도 없으면(흰 눈 결정 등) 아이콘 대신 이모지를 써요
}
// 흰 바탕에서 얼마나 진하게 보이는지(0~1). 칠한 도형마다 (1 − 밝기) × 투명도를 재서 가장 진한 값을 써요.
const INK_MIN = 0.2;
const NAMED = { white: '#ffffff', black: '#000000', red: '#ff0000', gold: '#ffd700', silver: '#c0c0c0', gray: '#808080', grey: '#808080', ivory: '#fffff0', snow: '#fffafa', whitesmoke: '#f5f5f5', beige: '#f5f5dc', pink: '#ffc0cb', yellow: '#ffff00' };
function paintInk(v, grads) {
    if (!v) return null;
    v = v.trim().toLowerCase();
    if (v === 'none' || v === 'transparent') return 0;
    const ref = v.match(/^url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/); if (ref) return grads[ref[1]] ?? 0.6;
    if (v === 'currentcolor') return 0.8;
    if (NAMED[v]) v = NAMED[v];
    let r, g, b, al = 1, m;
    if ((m = v.match(/^#([0-9a-f]{3,8})$/))) {
        let h = m[1]; if (h.length <= 4) h = [...h].map(c => c + c).join('');
        r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); if (h.length === 8) al = parseInt(h.slice(6, 8), 16) / 255;
    } else if ((m = v.match(/^rgba?\(([^)]*)\)/))) {
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(x => x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x));
        [r, g, b] = p; if (p.length > 3) al = m[1].trim().endsWith('%') ? p[3] / 255 : p[3];
    } else return 0.6;
    // 밝아도 색이 또렷하면(노랑 별 · 연두 공) 잘 보이니 채도도 같이 봐요.
    return Math.max(1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, (Math.max(r, g, b) - Math.min(r, g, b)) / 255) * al;
}
function svgAttr(t, n) {
    const re1 = new RegExp(String.raw`(?:^|\s)` + n + String.raw`\s*=\s*["']([^"']*)["']`, 'i');
    const re2 = new RegExp(String.raw`style\s*=\s*["'][^"']*(?:^|[\s;"'])` + n + String.raw`\s*:\s*([^;"']+)`, 'i');
    const m = t.match(re2) || t.match(re1);
    return m ? m[1] : null;
}
function svgInk(uri) {
    const svg = decodeSvg(uri) || '';
    const grads = {};
    for (const m of svg.matchAll(/<(linear|radial)Gradient\b([^>]*)>([\s\S]*?)<\/(?:linear|radial)Gradient>/gi)) {
        const id = svgAttr(m[2], 'id'); if (!id) continue;
        let best = 0;
        for (const st of m[3].matchAll(/<stop\b([^>]*)>/gi)) { const k = paintInk(svgAttr(st[1], 'stop-color') || '#000', {}) * +(svgAttr(st[1], 'stop-opacity') ?? 1); if (k > best) best = k; }
        grads[id] = best;
    }
    const body = svg.replace(/<defs\b[\s\S]*?<\/defs>/gi, '').replace(/<(?:linear|radial)Gradient\b[\s\S]*?<\/(?:linear|radial)Gradient>/gi, '').replace(/<(mask|clipPath|pattern|filter|symbol)\b[\s\S]*?<\/(?:mask|clipPath|pattern|filter|symbol)>/gi, '');
    const stack = [{ fill: '#000', stroke: 'none', op: 1, fo: 1, so: 1, fillSet: false }];
    let ink = 0;
    for (const m of body.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g)) {
        const [, close, tag, rest, self] = m; const T = tag.toLowerCase();
        if (close) { if (stack.length > 1 && (T === 'g' || T === 'svg' || T === 'a')) stack.pop(); continue; }
        const top = stack[stack.length - 1];
        const cur = { fillSet: top.fillSet || svgAttr(rest, 'fill') != null, fill: svgAttr(rest, 'fill') ?? top.fill, stroke: svgAttr(rest, 'stroke') ?? top.stroke, op: top.op * +(svgAttr(rest, 'opacity') ?? 1), fo: +(svgAttr(rest, 'fill-opacity') ?? top.fo), so: +(svgAttr(rest, 'stroke-opacity') ?? top.so) };
        if (/^(path|circle|ellipse|rect|polygon|polyline|line|text|tspan)$/.test(T)) {
            // 채우기를 안 정한 채 선만 그은 열린 경로(눈 결정 · 빛살)는 실제로 칠해지는 면이 거의 없어 채우기를 세지 않아요.
            const openLine = !cur.fillSet && /^(path|polyline)$/.test(T) && !/[zZ]/.test(svgAttr(rest, 'd') || '') && paintInk(cur.stroke, grads);
            const fi = T === 'line' || openLine ? 0 : (paintInk(cur.fill, grads) ?? 0) * cur.fo;
            const sw = +(svgAttr(rest, 'stroke-width') ?? 1);
            const sk = (paintInk(cur.stroke, grads) ?? 0) * cur.so * (sw >= 1.5 ? 1 : 0.6);
            ink = Math.max(ink, Math.max(fi, sk) * cur.op);
        }
        if (!self && (T === 'g' || T === 'svg' || T === 'a')) stack.push(cur);
    }
    return ink;
}
function decodeSvg(uri) {
    try { return decodeURIComponent(uri.slice(uri.indexOf(',') + 1)); } catch { return null; }
}

// ── 직렬화(원래 형식 그대로) ───────────────────────────────
// index.json: 들여쓰기 1칸 · items 배열의 각 항목은 한 줄
function writeIndexText(ix) {
    const MARK = '__ITEMS_PLACEHOLDER__';
    const text = JSON.stringify({ ...ix, items: MARK }, null, 1);
    const items = ix.items.length ? '[\n' + ix.items.map(it => '  ' + JSON.stringify(it)).join(',\n') + '\n ]' : '[]';
    return text.replace(`"${MARK}"`, () => items) + '\n';
}
// 조각: 한 줄 + 줄바꿈
const writeChunkText = j => JSON.stringify(j) + '\n';
const sha = (alg, s) => createHash(alg).update(s).digest('hex');

// ── 시작 ─────────────────────────────────────────────────
const indexRaw = readFileSync(INDEX, 'utf8');
const ix = JSON.parse(indexRaw);
if (writeIndexText(ix) !== indexRaw) throw new Error('index.json 형식이 예상과 달라요 — 직렬화 규칙을 먼저 맞춰 주세요');

// 1) 백업(첫 번만)
if (!existsSync(BACKUP)) {
    mkdirSync(BACKUP, { recursive: true });
    copyFileSync(INDEX, join(BACKUP, 'index.json'));
    for (const ch of Object.values(ix.chunks)) copyFileSync(join(DIR, ch.file), join(BACKUP, ch.file));
    console.log(`백업했어요: ${BACKUP} (${Object.keys(ix.chunks).length + 1}개 파일)`);
} else {
    console.log('백업 폴더가 이미 있어 그대로 둬요');
}

// 2) 조각 읽기 + 검증용 전 상태
const chunks = {};
const before = { n: 0, ids: new Set(), previewLen: 0 };
for (const [c, ch] of Object.entries(ix.chunks)) {
    const raw = readFileSync(join(DIR, ch.file), 'utf8');
    const j = JSON.parse(raw);
    if (writeChunkText(j) !== raw) throw new Error(`${ch.file} 형식이 예상(한 줄 + 줄바꿈)과 달라요`);
    chunks[c] = { raw, j };
    for (const [id, it] of Object.entries(j.items)) { before.n++; before.ids.add(id); before.previewLen += it.preview?.length || 0; }
}
const indexBefore = { n: ix.items.length, ids: new Set(ix.items.map(it => it.id)), bytes: Buffer.byteLength(indexRaw) };
const strip = it => { const { accent, icon, ...rest } = it; return JSON.stringify(rest); };
const indexOther = ix.items.map(strip);
const chunkOther = Object.fromEntries(Object.entries(chunks).map(([c, { j }]) =>
    [c, Object.fromEntries(Object.entries(j.items).map(([id, it]) => [id, strip(it)]))]));

// 3) accent · icon 계산
const viaCount = Object.fromEntries([...CANDIDATES, '어둡게', '기본값'].map(k => [k, 0]));
const designMissing = { sp: 0, il: 0, dk: 0, mt: 0 };
const errors = [];
const iconFiles = new Map();   // 해시 → svg 글
let iconYes = 0, iconNo = 0;
const byId = new Map(ix.items.map(it => [it.id, it]));

for (const [c, { j }] of Object.entries(chunks)) {
    const design = c.split('-')[0];
    for (const [id, it] of Object.entries(j.items)) {
        const { color, via } = pickAccent(it.colors);
        viaCount[via]++;
        if (via === '어둡게') errors.push([id, `후보 전부 4.5 미만이라 잉크 쪽으로 어둡게 → ${color}`]);
        if (via === '기본값') errors.push([id, 'colors 가 없어 기본값']);

        let uri = findSvgUri(it.preview);
        let iconPath = null;
        if (uri) {
            const svg = decodeSvg(uri);
            if (svg == null) { errors.push([id, 'SVG URL 디코드 실패']); uri = null; }
            else if (/<script/i.test(svg)) { errors.push([id, 'SVG 에 <script 가 있어 버림']); uri = null; }
            else {
                const h = sha('sha1', svg).slice(0, 10);
                iconFiles.set(h, svg);
                iconPath = `icon/${h}.svg`;
            }
        }
        if (uri) iconYes++; else { iconNo++; designMissing[design] = (designMissing[design] || 0) + 1; }

        it.accent = color;
        it.icon = uri;
        const row = byId.get(id);
        if (!row) { errors.push([id, '조각에는 있는데 index.json 목록에 없음']); continue; }
        row.accent = color;
        row.icon = iconPath;
    }
}
for (const row of ix.items) if (!(row.c in chunks) || !(row.id in chunks[row.c].j.items)) throw new Error(`목록의 ${row.id} 가 조각 ${row.c} 에 없어요`);

// 4) 검증 — 글꾸 수 · id · preview 길이 합 · 다른 칸이 그대로인지
const after = { n: 0, ids: new Set(), previewLen: 0 };
for (const { j } of Object.values(chunks)) for (const [id, it] of Object.entries(j.items)) { after.n++; after.ids.add(id); after.previewLen += it.preview?.length || 0; }
const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
if (after.n !== before.n || !sameSet(after.ids, before.ids) || after.previewLen !== before.previewLen) throw new Error('조각 검증 실패: 글꾸 수 · id · preview 길이 합 중 하나가 달라졌어요');
if (ix.items.length !== indexBefore.n || !sameSet(new Set(ix.items.map(it => it.id)), indexBefore.ids)) throw new Error('index.json 검증 실패: 항목 수나 id 가 달라졌어요');
if (ix.items.some((it, i) => strip(it) !== indexOther[i])) throw new Error('index.json 검증 실패: accent · icon 말고 다른 칸이 바뀌었어요');
for (const [c, { j }] of Object.entries(chunks)) for (const [id, it] of Object.entries(j.items)) if (strip(it) !== chunkOther[c][id]) throw new Error(`조각 검증 실패: ${id} 의 다른 칸이 바뀌었어요`);
if (ix.count !== after.n) console.warn(`주의: index.json count(${ix.count}) 와 실제 글꾸 수(${after.n}) 가 달라요(고치지 않았어요)`);

// 5) 아이콘 파일 — 옛 파일 지우고 새로 써요
mkdirSync(ICON_DIR, { recursive: true });
for (const f of readdirSync(ICON_DIR)) unlinkSync(join(ICON_DIR, f));
for (const [h, svg] of iconFiles) writeFileSync(join(ICON_DIR, `${h}.svg`), svg);

// 6) 조각 다시 쓰기 — 내용 해시가 바뀌면 이름도 바꿔요
let renamed = 0;
for (const [c, { raw, j }] of Object.entries(chunks)) {
    const text = writeChunkText(j);
    const ch = ix.chunks[c];
    const file = `${c}.${sha('sha256', text).slice(0, 8)}.json`;
    if (file !== ch.file) {
        writeFileSync(join(DIR, file), text);
        if (existsSync(join(DIR, ch.file))) unlinkSync(join(DIR, ch.file));
        ch.file = file;
        renamed++;
    } else if (text !== raw) {
        writeFileSync(join(DIR, file), text);
    }
    ch.n = Object.keys(j.items).length;
    ch.bytes = Buffer.byteLength(text);
}

// 7) index.json
if (typeof ix._ === 'string' && !ix._.endsWith(NOTE)) ix._ += NOTE;
const indexText = writeIndexText(ix);
if (indexText !== indexRaw) writeFileSync(INDEX, indexText);

// 8) 요약
console.log('\n── 글꾸 accent · icon 요약 ──');
console.log(`글꾸 수: ${after.n} (index.json 항목 ${ix.items.length})`);
console.log('accent 채택: ' + Object.entries(viaCount).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`icon 있음 ${iconYes} · 없음 ${iconNo}`);
console.log('디자인별 icon 없음: ' + Object.entries(designMissing).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`icon 파일 수: ${iconFiles.size}`);
console.log(`index.json 크기: ${indexBefore.bytes} → ${Buffer.byteLength(indexText)} 바이트`);
console.log(`조각 이름 바뀜(내용 해시): ${renamed} / ${Object.keys(chunks).length}`);
console.log(`예외 ${errors.length}개${errors.length ? ':' : ''}`);
for (const [id, why] of errors.slice(0, 20)) console.log(`  - ${id}: ${why}`);
if (errors.length > 20) console.log(`  … 그 밖 ${errors.length - 20}개`);
