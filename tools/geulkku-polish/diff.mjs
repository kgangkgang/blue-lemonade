#!/usr/bin/env node
// 전/후 스크린샷(shots.mjs 의 jpg)을 브라우저 canvas 로 견줘요. 브라우저 하나 · 끝나면 그 PID 만 닫아요.
//   node tools/geulkku-polish/diff.mjs --dir <전 · 후 폴더가 든 곳> --out <json> [--modes phone,pc]
// 틀마다: 크기 차이(dw · dh) · 달라진 화소 비율(frac · 채널 차 32 넘는 화소) · 달라진 곳의 상자(box)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serve } from '../site-rig/serve.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const DIR = path.resolve(arg('dir')); const MODES = String(arg('modes', 'phone,pc')).split(',');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')   // playwright-core 자리는 환경 변수 PLAYWRIGHT_CORE 로 알려 줘요;
const ids = [...new Set(fs.readdirSync(path.join(DIR, '전')).filter(f => f.endsWith('.jpg')).map(f => f.replace(/\.(phone|pc)\.jpg$/, '')))];
const server = await serve(DIR, Number(arg('port', 8796)));
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true }); const pid = browser.process?.()?.pid;
const out = {};
try {
    const page = await (await browser.newContext({ viewport: { width: 400, height: 300 } })).newPage();
    await page.route('**/__d.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><body>' }));
    await page.goto(server.url + '__d.html');
    let n = 0;
    for (const id of ids) {
        out[id] = {};
        for (const mode of MODES) {
            const name = encodeURIComponent(`${id}.${mode}.jpg`);
            out[id][mode] = await page.evaluate(async ([a, b]) => {
                const load = u => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = u; });
                const [A, B] = await Promise.all([load(a), load(b)]); if (!A || !B) return { missing: true };
                const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
                const px = im => { const c = new OffscreenCanvas(w, h); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data; };
                const p = px(A), q = px(B); let diff = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (Math.abs(p[i] - q[i]) > 32 || Math.abs(p[i + 1] - q[i + 1]) > 32 || Math.abs(p[i + 2] - q[i + 2]) > 32) { diff++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
                return { dw: B.width - A.width, dh: B.height - A.height, frac: Math.round(diff / (w * h) * 1e5) / 1e5, box: diff ? [x0, y0, x1, y1] : null };
            }, [`/${encodeURIComponent('전')}/${name}`, `/${encodeURIComponent('후')}/${name}`]);
        }
        if (++n % 300 === 0) console.log(n, '/', ids.length);
    }
} finally { await browser.close().catch(() => {}); if (pid) { try { process.kill(pid, 0); process.kill(pid); } catch {} } await server.close(); }
fs.writeFileSync(path.resolve(arg('out')), JSON.stringify(out));
const rows = Object.entries(out); const big = rows.filter(([, r]) => MODES.some(m => r[m]?.frac > 0.02 || Math.abs(r[m]?.dh) > 2)); const some = rows.filter(([, r]) => MODES.some(m => r[m]?.frac > 0.0005 || r[m]?.dh));
console.log({ 틀: rows.length, 조금이라도달라짐: some.length, 크게달라짐: big.length });
