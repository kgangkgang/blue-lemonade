#!/usr/bin/env node
// HTML 파일을 열어 선택자의 계산된 스타일 몇 개를 찍어 보는 작은 조사 도구. node probe.mjs <html> <선택자> <속성,속성> [--w 390]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
import { serve } from '../site-rig/serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')   // playwright-core 자리는 환경 변수 PLAYWRIGHT_CORE 로 알려 줘요;
const [file, sel, props] = process.argv.slice(2); const w = Number(process.argv[process.argv.indexOf('--w') + 1]) || 390;
const body = fs.readFileSync(path.resolve(file), 'utf8').replaceAll('https://kgangkgang.github.io/blue-lemonade/', '/');
const server = await serve(path.join(HERE, '../..'), 8795);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true }); const pid = browser.process?.()?.pid;
try {
    const page = await (await browser.newContext({ viewport: { width: w, height: 844 } })).newPage(); await page.route('**/*.mp3', r => r.abort());
    await page.route('**/__p.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="wrap" style="padding:16px 12px;max-width:860px;margin:0 auto">${body}</div>` }));
    await page.goto(server.url + '__p.html'); await page.waitForTimeout(300);
    console.log(JSON.stringify(await page.evaluate(([sel, props]) => [...document.querySelectorAll(sel)].slice(0, 3).map(el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { box: [r.x, r.y, r.width, r.height].map(Math.round), ...Object.fromEntries(props.split(',').map(p => [p, cs.getPropertyValue(p)])) }; }), [sel, props]), null, 1));
} finally { await browser.close().catch(() => {}); if (pid) { try { process.kill(pid, 0); process.kill(pid); } catch {} } await server.close(); }
