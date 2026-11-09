#!/usr/bin/env node
// 여러 틀을 한 장에 나란히(폭 390 칸) 찍는 모아 보기. 브라우저 하나 · 끝나면 그 PID 만 닫아요.
//   node tools/geulkku-polish/sheet.mjs --out <png> --ids a,b,c [--root <사이트>] [--cols 5] [--w 390] [--scale 0.6] [--dark] [--maxh 900]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from '../site-rig/serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--') ? true : process.argv[i + 1]); };
const ROOT = path.resolve(arg('root', path.join(HERE, '../..')));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')   // playwright-core 자리는 환경 변수 PLAYWRIGHT_CORE 로 알려 줘요;
const DIR = path.join(ROOT, 'mart/data/geulkku');
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const cache = {}; const chunkOf = c => cache[c] ??= JSON.parse(fs.readFileSync(path.join(DIR, index.chunks[c].file), 'utf8')).items;
const ids = String(arg('ids')).split(','); const cols = Number(arg('cols', 5)); const W = Number(arg('w', 390)); const dark = !!arg('dark'); const maxh = Number(arg('maxh', 900));
const cells = ids.map(id => { const it = index.items.find(i => i.id === id); if (!it) return `<div class="c"><p class="t">${id} 없음</p></div>`; const p = chunkOf(it.c)[id].preview; return `<div class="c"><p class="t">${it.name} · ${it.style} · ${id}</p><div class="p">${p}</div></div>`; }).join('');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="/mart/geulkku/"><style>html,body{margin:0}body{background:${dark ? '#1b1c20' : '#fff'};color:${dark ? '#e5e7eb' : '#1f2937'};font-family:Pretendard,'Malgun Gothic',sans-serif;font-size:16px;line-height:1.6}#g{display:flex;flex-wrap:wrap;gap:16px;padding:16px;width:${cols * (W + 16) + 16}px;box-sizing:border-box}.c{width:${W}px;flex:none}.t{margin:0 0 6px;font:700 13px/1.3 'Malgun Gothic',sans-serif;color:${dark ? '#9ca3af' : '#6b7280'}}.p{max-height:${maxh}px;overflow:hidden}</style></head><body><div id="g">${cells}</div></body></html>`;
const server = await serve(ROOT, Number(arg('port', 8792)));
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const pid = browser.process?.()?.pid;
try {
    const ctx = await browser.newContext({ viewport: { width: cols * (W + 16) + 16, height: 900 }, deviceScaleFactor: Number(arg('scale', 0.6)), reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
    const page = await ctx.newPage(); await page.route('**/*.mp3', r => r.abort()); await page.route(/youtube|jsdelivr|googleapis/, r => r.abort());
    await page.route('**/__sheet.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto(server.url + '__sheet.html', { waitUntil: 'load' }); await page.waitForTimeout(300);
    const out = path.resolve(arg('out')); fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
    console.log('모아 보기', ids.length, '→', out);
} finally { await browser.close().catch(() => {}); if (pid) { try { process.kill(pid, 0); process.kill(pid); } catch {} } await server.close(); }
