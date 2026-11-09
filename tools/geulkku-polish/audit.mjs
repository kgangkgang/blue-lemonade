#!/usr/bin/env node
// 글자 대비 · 바탕 없는 글자 · 가로 넘침 · 작은 글자 검사(렌더). 브라우저 하나 · 끝나면 그 PID 만 닫아요.
//   node tools/geulkku-polish/audit.mjs --out <json> [--root <사이트>] [--ids a,b | --chunk x | --prefix sp | --all] [--field preview|template] [--fix]
// 커뮤니티 사이트는 게시된 글을 그릴 때 바탕 대비가 낮은 글자에 인라인 color !important 를 박아 색을 덮어써요(11-10 확인) — 그래서 색 글자는 자기 바탕 대비 4.5 이상이어야 해요.
// --fix: 대비 4.5 미만인 글자의 고칠 색(같은 색상에서 밝기만 옮겨 4.6 이상)을 같이 적어요. 적용은 contrast-fix.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from '../site-rig/serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--') ? true : process.argv[i + 1]); };
const ROOT = path.resolve(arg('root', path.join(HERE, '../..')));
const FIELD = arg('field', 'preview');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')   // playwright-core 자리는 환경 변수 PLAYWRIGHT_CORE 로 알려 줘요;
const DIR = path.join(ROOT, 'mart/data/geulkku');
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const cache = {}; const chunkOf = c => cache[c] ??= JSON.parse(fs.readFileSync(path.join(DIR, index.chunks[c].file), 'utf8')).items;
let items = index.items;
if (arg('ids')) { const w = new Set(String(arg('ids')).split(',')); items = items.filter(i => w.has(i.id)); }
else if (arg('chunk')) { const w = new Set(String(arg('chunk')).split(',')); items = items.filter(i => w.has(i.c)); }
else if (arg('prefix')) { const w = String(arg('prefix')).split(','); items = items.filter(i => w.some(p => i.c.startsWith(p))); }
else if (!arg('all')) { console.error('--ids · --chunk · --prefix · --all 중 하나를 줘요'); process.exit(2); }

const pageHtml = (body, dark) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="/mart/geulkku/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}body{background:${dark ? '#1b1c20' : '#ffffff'};color:${dark ? '#e5e7eb' : '#1f2937'};font-family:Pretendard,'Malgun Gothic',sans-serif;font-size:16px;line-height:1.6}#wrap{padding:16px 12px;max-width:860px;margin:0 auto;box-sizing:border-box}*,*::before,*::after{animation:none!important;transition:none!important}</style></head><body><div id="wrap">${body}</div></body></html>`;

const AUDIT = () => {
    const wrap = document.getElementById('wrap');
    const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p[3] ?? 1 }; };
    const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    // 바탕: 위로 올라가며 반투명 색을 겹쳐 불투명한 색을 만날 때까지. solid = 틀 안에서 불투명 바탕을 만났는가 · img = 도중에 그림 바탕(그라데이션 · url)이 있었는가
    const bgOf = el => { const layers = []; let solid = false, img = false, src = null; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== 'none' && e !== document.body) img = true; const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 0.98) { solid = e !== document.body; src = e; break; } } } let base = (layers.length && layers[layers.length - 1].a >= 0.98) ? layers.pop().rgb : [255, 255, 255]; for (let i = layers.length - 1; i >= 0; i--) { const L = layers[i]; base = base.map((v, k) => v * (1 - L.a) + L.rgb[k] * L.a); } return { rgb: base, solid, img, src, plain: layers.length === 0 }; };
    const fixFor = (fg, bg) => { const dark = lum(bg) < 0.4; for (let t = 0.04; t <= 1.0001; t += 0.04) { const c = fg.map(v => v + ((dark ? 255 : 0) - v) * t); if (cr(c, bg) >= 4.6) return hex(c); } return dark ? '#ffffff' : '#000000'; };
    const bgFixFor = (fg, bg) => { for (let t = 0.04; t <= 1.0001; t += 0.04) { const c = bg.map(v => v * (1 - t)); if (cr(fg, c) >= 4.6) return hex(c); } return '#000000'; };
    const all = [...wrap.querySelectorAll('*')]; const idx = new Map(all.map((e, i) => [e, i]));
    const out = { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, texts: 0, small: 0, low: [], nobg: 0 };
    const seen = new Set(); const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
        if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || seen.has(el) || el.closest('style,script,[aria-hidden="true"]')) continue; seen.add(el);
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        out.texts++; const fs = parseFloat(cs.fontSize); if (fs < 11) out.small++;
        const fill = parse(cs.webkitTextFillColor) || parse(cs.color); if (!fill || fill.a < 0.05) continue; const bg = bgOf(el); if (!bg.solid) out.nobg++;
        const fg = fill.a >= 0.98 ? fill.rgb : fill.rgb.map((v, k) => v * fill.a + bg.rgb[k] * (1 - fill.a));
        const ratio = cr(fg, bg.rgb);
        if (ratio < 4.5) out.low.push({ i: idx.get(el), tag: el.tagName.toLowerCase(), fg: hex(fg), bg: hex(bg.rgb), r: Math.round(ratio * 100) / 100, fs, t: n.nodeValue.trim().slice(0, 14), inl: /(^|;)\s*color\s*:/i.test(el.getAttribute('style') || ''), img: bg.img, solid: bg.solid, fix: fixFor(fill.rgb, bg.rgb), ...(lum(fg) > 0.8 && bg.solid && bg.plain && idx.has(bg.src) ? { bgi: idx.get(bg.src), bgtag: bg.src.tagName.toLowerCase(), bgfix: bgFixFor(fg, bg.rgb) } : {}) });
    }
    return out;
};

const server = await serve(ROOT, Number(arg('port', 8793)));
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const pid = browser.process?.()?.pid; const result = {};
try {
    for (const dark of [false, true]) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
        const page = await ctx.newPage(); await page.route('**/*.mp3', r => r.abort()); await page.route(/youtube|jsdelivr|googleapis/, r => r.abort());
        let n = 0;
        for (const it of items) {
            let html = chunkOf(it.c)[it.id]?.[FIELD]; if (!html) continue; if (FIELD === 'template') html = html.replace(/\{\{(head|body|info|tail)\}\}/g, '');
            await page.route('**/__audit.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml(html, dark) }));
            await page.goto(server.url + '__audit.html', { waitUntil: 'load' }); await page.unroute('**/__audit.html');
            (result[it.id] ??= {})[dark ? 'dark' : 'light'] = await page.evaluate(AUDIT);
            if (++n % 300 === 0) console.log(dark ? '어두운 바탕' : '밝은 바탕', n, '/', items.length);
        }
        await ctx.close();
    }
} finally { await browser.close().catch(() => {}); if (pid) { try { process.kill(pid, 0); process.kill(pid); } catch {} } await server.close(); }
const sum = { 틀: 0, 대비낮은틀: 0, 대비낮은글자: 0, 그림바탕위: 0, 바탕없는글자틀: 0, 가로넘침틀: 0, 작은글자틀: 0 };
for (const r of Object.values(result)) { sum.틀++; const low = [...(r.light?.low || []), ...(r.dark?.low || [])]; const plain = low.filter(x => !x.img); if (plain.length) sum.대비낮은틀++; sum.대비낮은글자 += (r.light?.low || []).filter(x => !x.img).length; sum.그림바탕위 += (r.light?.low || []).filter(x => x.img).length; if (r.light?.nobg || r.dark?.nobg) sum.바탕없는글자틀++; if (r.light?.overflowX > 0) sum.가로넘침틀++; if (r.light?.small) sum.작은글자틀++; }
console.log(sum);
if (arg('out')) { fs.mkdirSync(path.dirname(path.resolve(arg('out'))), { recursive: true }); fs.writeFileSync(path.resolve(arg('out')), JSON.stringify({ field: FIELD, sum, result })); }
