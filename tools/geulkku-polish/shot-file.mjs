#!/usr/bin/env node
// HTML 파일 하나(게시글 글꾸)를 폰 390 · PC 1280 · 밝은/어두운 바탕으로 찍어요. 브라우저 하나 · 끝나면 그 PID 만 닫아요.
//   node tools/geulkku-polish/shot-file.mjs <html> --out <머리이름> [--modes phone,pc,phone-dark] [--check a-k,c-k] [--maxh 2400] [--root <사이트>]
//   --check: 그 class 의 체크박스를 전부 눌러 둔(펼친) 채로도 한 장 더 찍어요(<머리이름>.<모드>.open.png)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from '../site-rig/serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--') ? true : process.argv[i + 1]); };
const ROOT = path.resolve(arg('root', path.join(HERE, '../..')));
const file = path.resolve(process.argv[2]); const OUT = path.resolve(arg('out')); const MODES = String(arg('modes', 'phone,pc')).split(',');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')   // playwright-core 자리는 환경 변수 PLAYWRIGHT_CORE 로 알려 줘요;
const body = fs.readFileSync(file, 'utf8').replaceAll('https://kgangkgang.github.io/blue-lemonade/', '/');
const VIEW = { phone: [390, 844, false], pc: [1280, 900, false], 'phone-dark': [390, 844, true], 'pc-dark': [1280, 900, true] };
const pageHtml = dark => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}body{background:${dark ? '#1b1c20' : '#ffffff'};color:${dark ? '#e5e7eb' : '#1f2937'};font-family:Pretendard,'Malgun Gothic',sans-serif;font-size:16px;line-height:1.6}#wrap{padding:16px 12px;max-width:860px;margin:0 auto;box-sizing:border-box}</style></head><body><div id="wrap">${body}</div></body></html>`;
const server = await serve(ROOT, Number(arg('port', 8794)));
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const pid = browser.process?.()?.pid; fs.mkdirSync(path.dirname(OUT), { recursive: true });
try {
    for (const mode of MODES) {
        const [w, h, dark] = VIEW[mode];
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mode.startsWith('phone') ? 2 : 1, hasTouch: mode.startsWith('phone'), isMobile: mode.startsWith('phone'), colorScheme: dark ? 'dark' : 'light' });
        const page = await ctx.newPage(); await page.route('**/*.mp3', r => r.abort());
        await page.route('**/__file.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml(dark) }));
        await page.goto(server.url + '__file.html', { waitUntil: 'load' }); await page.waitForTimeout(500);
        const shoot = async tag => { const full = await page.evaluate(() => document.documentElement.scrollHeight); await page.screenshot({ path: `${OUT}.${mode}${tag}.png`, fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(full, Number(arg('maxh', 2400))) } }); };
        await shoot('');
        if (arg('check')) { const n = await page.evaluate(cls => { let k = 0; for (const c of cls.split(',')) for (const el of document.querySelectorAll('input.' + c)) { el.checked = true; k++; } return k; }, String(arg('check'))); if (n) { await page.waitForTimeout(500); await shoot('.open'); } }
        console.log(mode, await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, h: document.documentElement.scrollHeight, brokenImg: [...document.images].filter(i => i.complete && !i.naturalWidth).length })));
        await ctx.close();
    }
} finally { await browser.close().catch(() => {}); if (pid) { try { process.kill(pid, 0); process.kill(pid); } catch {} } await server.close(); }
