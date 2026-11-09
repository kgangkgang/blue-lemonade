#!/usr/bin/env node
// 글꾸 마트 틀을 폰 · PC 폭으로 찍어요(다듬기 전/후 비교용). 브라우저는 하나만 띄우고 끝나면 그 PID 만 닫아요.
//   node tools/geulkku-polish/shots.mjs --out <폴더> [--root <사이트 폴더>] [--ids a,b,c | --chunk sp-season | --all] [--modes phone,pc,phone-dark] [--fmt jpg|png] [--closed] [--measure]
// 모드: phone = 390 밝은 바탕 · pc = 1280 밝은 바탕 · phone-dark / pc-dark = 어두운 바탕(#1b1c20) + 기본 글자 밝게
// --measure: 틀마다 가로 넘침 · 작은 글자 · 대비 낮은 글자를 재서 <out>/measure.json 에 적어요.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from '../site-rig/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]); };
const ROOT = path.resolve(arg('root', path.join(HERE, '../..')));
const OUT = path.resolve(arg('out', path.join(HERE, '_shots')));
const MODES = String(arg('modes', 'phone,pc')).split(',');
const FMT = arg('fmt', 'jpg');
const PORT = Number(arg('port', 8791));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')   // playwright-core 자리는 환경 변수 PLAYWRIGHT_CORE 로 알려 줘요;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const DIR = path.join(ROOT, 'mart/data/geulkku');
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const chunkCache = {};
const chunkOf = c => chunkCache[c] ??= JSON.parse(fs.readFileSync(path.join(DIR, index.chunks[c].file), 'utf8')).items;
let items = index.items;
if (arg('ids')) { const want = new Set(String(arg('ids')).split(',')); items = items.filter(i => want.has(i.id)); }
else if (arg('chunk')) { const want = new Set(String(arg('chunk')).split(',')); items = items.filter(i => want.has(i.c)); }
else if (arg('prefix')) { const want = String(arg('prefix')).split(','); items = items.filter(i => want.some(p => i.c.startsWith(p))); }
else if (!arg('all')) { console.error('--ids · --chunk · --prefix · --all 중 하나를 줘요'); process.exit(2); }
const every = Number(arg('every', 1)); if (every > 1) items = items.filter((_, i) => i % every === 0);

const VIEW = { phone: { width: 390, height: 844, dark: false }, pc: { width: 1280, height: 900, dark: false }, 'phone-dark': { width: 390, height: 844, dark: true }, 'pc-dark': { width: 1280, height: 900, dark: true } };
const pageHtml = (body, dark) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="/mart/geulkku/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}body{background:${dark ? '#1b1c20' : '#ffffff'};color:${dark ? '#e5e7eb' : '#1f2937'};font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;line-height:1.6}#wrap{padding:16px ${'12px'};max-width:860px;margin:0 auto;box-sizing:border-box}</style></head><body><div id="wrap">${body}</div></body></html>`;

const MEASURE = () => {
    const wrap = document.getElementById('wrap'); const out = { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: 0, tiny: 0, lowContrast: 0, texts: 0, pills: 0, height: Math.round(wrap.getBoundingClientRect().height) };
    const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p[3] ?? 1 }; };
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c.rgb; } return null; };
    const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
        if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || el.closest('style,script,[aria-hidden="true"]')) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        out.texts++; const fs = parseFloat(cs.fontSize); if (fs < 11) out.small++; if (fs < 9.5) out.tiny++;
        const fg = parse(cs.color); const bg = bgOf(el); if (fg && bg) { const a = lum(fg.rgb), b = lum(bg); const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (cr < 3) out.lowContrast++; }
    }
    return out;
};

const server = await serve(ROOT, PORT);
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const pid = browser.process?.()?.pid;
fs.mkdirSync(OUT, { recursive: true });
const measure = {};
try {
    for (const mode of MODES) {
        const v = VIEW[mode]; if (!v) continue;
        const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: Number(arg('dsf', 1)), reducedMotion: 'reduce', colorScheme: v.dark ? 'dark' : 'light' });
        const page = await ctx.newPage();
        await page.route('**/*.mp3', r => r.abort()); await page.route(/youtube|jsdelivr|googleapis/, r => r.abort());
        let n = 0;
        for (const it of items) {
            const full = chunkOf(it.c)[it.id]; if (!full?.preview) { console.error('미리보기 없음', it.id); continue; }
            let html = full.preview; if (arg('closed')) html = html.replace(/(<details\b[^>]*?)\sopen(?=[\s=>/])(?:="")?/g, '$1');
            await page.route('**/__shot.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml(html, v.dark) }));
            await page.goto(server.url + '__shot.html', { waitUntil: 'load' }); await page.unroute('**/__shot.html');
            await page.waitForTimeout(60);
            if (arg('measure') && mode === MODES[0]) measure[it.id] = await page.evaluate(MEASURE);
            const el = await page.$('#wrap'); const box = await el.boundingBox(); const h = Math.min(Math.ceil(box.height), Number(arg('maxh', 1600)));
            await page.screenshot({ path: path.join(OUT, `${it.id}.${mode}.${FMT}`), type: FMT === 'png' ? 'png' : 'jpeg', ...(FMT === 'png' ? {} : { quality: Number(arg('q', 62)) }), clip: { x: Math.max(0, box.x), y: 0, width: Math.min(box.width, v.width), height: Math.max(40, h) }, fullPage: true });
            if (++n % 100 === 0) console.log(mode, n, '/', items.length);
        }
        await ctx.close();
    }
    if (arg('measure')) fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(measure));
} finally {
    await browser.close().catch(() => {});
    if (pid) { try { process.kill(pid, 0); process.kill(pid); } catch {} }
    await server.close();
}
console.log('찍음', items.length, '틀 ×', MODES.join(','), '→', OUT);
