#!/usr/bin/env node
// 11-12 「보이는 글자 = 고칠 칸」 잠그기 — 410틀 × 소품 단계(전 · 후 1 · 후 2 …)마다
//   ① 미리보기 DOM 칸 수(edit-blocks.js markSlots) = 글 HTML 칸 수(tune.js editables) — 번호가 어긋나면 고친 글이 엉뚱한 자리로 가요
//   ② 화면에 보이는 글자(문자 · 숫자) 노드가 모두 칸(data-bl-ed) 안
//   ③ ::before · ::after 의 content 에 글자 없음(CSS 로 그린 글자는 못 고쳐요)
//   ④ 진짜 글자를 투명하게 지운 사진을 남겨요 → tools/site-rig/ocr.ps1 로 읽어 글자가 남으면 그림(svg · data URI)으로 그린 글자 후보
//   node tools/site-rig/prop-text-check.mjs <결과 폴더> [--only simple-k1180,…] [--no-shot] [--ocr]
//   헤드리스 하나 · 리그 차례표로 돌려요: node ../automation/rig-queue.mjs run --label prop-text -- node tools/site-rig/prop-text-check.mjs <폴더> --ocr
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '../..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) || path.join(HERE, 'out', 'prop-text'));
const ONLY = opt('--only', '').split(',').filter(Boolean), SHOT = !argv.includes('--no-shot'), OCR = argv.includes('--ocr'), NOHIDE = argv.includes('--nohide');   // --nohide: 글자를 안 지운 대조 사진(OCR 이 작은 글자를 읽는지 확인)
const SHOTS = path.join(OUT, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
globalThis.localStorage = { getItem: () => null, setItem() {} }; globalThis.document = { dispatchEvent() {} }; globalThis.CustomEvent = class {};
const tailOf = (file, dep) => (fs.readFileSync(path.join(ROOT, 'mart', file), 'utf8').match(new RegExp(`\\./${dep.replace('.', '\\.')}(\\?v=[0-9a-z]+)`)) || [])[1] || '';
const tn = await import(pathToFileURL(path.join(ROOT, 'mart/tune.js')).href + tailOf('edit-blocks.js', 'tune.js'));
const cu = await import(pathToFileURL(path.join(ROOT, 'mart/custom.js')).href + tailOf('tune-ui.js', 'custom.js'));
// 예외(까닭 필수): { "<틀 id>": "까닭" } — 그림에 박힌 글자를 「이 틀 값」 등 다른 길로 바꾸는 틀만
const EXC = (() => { try { const o = JSON.parse(fs.readFileSync(path.join(HERE, 'prop-text-exceptions.json'), 'utf8')); delete o._; return o; } catch { return {}; } })();
const D = path.join(ROOT, 'mart/data/geulkku'), idx = JSON.parse(fs.readFileSync(path.join(D, 'index.json'), 'utf8'));
const chunks = {}; for (const [k, c] of Object.entries(idx.chunks)) chunks[k] = JSON.parse(fs.readFileSync(path.join(D, c.file), 'utf8')).items;
const list = idx.items.filter(x => !ONLY.length || ONLY.includes(x.id));
const page = path.join(HERE, 'out', 'prop-text.html'); fs.mkdirSync(path.dirname(page), { recursive: true });
fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#fff;width:672px}</style><body><div id="host"></div><script type="module">import * as eb from '../../../mart/edit-blocks.js${tailOf('tune-ui.js', 'edit-blocks.js')}'; window.eb = eb; window.ready = true;</script></body>`);
const srv = await serve(ROOT, Number(opt('--port', 18990)));
const b = await launch(path.join(HERE, 'out', '_prop-prof'), Number(opt('--cdp', 19466)));
const rows = [];
try {
    await b.size(720, 1400, false, 2);   // 배율 2 — 10px 남짓한 소품 글자도 OCR 이 읽게
    await b.goto(srv.url + 'tools/site-rig/out/prop-text.html'); await b.until('window.ready', 15000);
    for (const it of list) {
        const html = chunks[it.c][it.id].preview, want = tn.editables(html).length;
        await b.eval(`(()=>{document.getElementById('host').innerHTML=${JSON.stringify(html)};document.getElementById('bl-hide')?.remove();return true})()`);
        const n = await b.eval(`window.eb.propDetails(document.querySelector('#host .gk')).length`);
        for (let k = 0; k <= n; k++) {
            const r = await b.eval(`(async()=>{
              const g = document.querySelector('#host .gk'); document.getElementById('bl-hide')?.remove();
              window.eb.setStep(g, ${k}); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); window.eb.setStep(g, ${k});
              const slots = window.eb.markSlots(g);
              const L = /[\\p{L}\\p{N}]/u, bad = [], pseudo = [];
              const tw = document.createTreeWalker(g, NodeFilter.SHOW_TEXT);
              for (let t = tw.nextNode(); t; t = tw.nextNode()) {
                const p = t.parentElement; if (!L.test(t.data) || !p || p.closest('style,script,audio,title')) continue;
                if (!p.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
                const rg = document.createRange(); rg.selectNodeContents(t); const rc = rg.getBoundingClientRect(); if (rc.width < 1 || rc.height < 1) continue;
                if (!p.closest('[data-bl-ed]')) bad.push(t.data.trim().slice(0, 24));
              }
              for (const el of g.querySelectorAll('*')) for (const ps of ['::before', '::after']) { const c = getComputedStyle(el, ps).content; if (c && c !== 'none' && c !== 'normal' && L.test(c.replace(/counter\\([^)]*\\)|attr\\([^)]*\\)|url\\([^)]*\\)/g, '')) && el.checkVisibility({ opacityProperty: true })) pseudo.push(c.slice(0, 24)); }
              return { dom: slots.length, bad: [...new Set(bad)], pseudo: [...new Set(pseudo)] };
            })()`);
            const row = { id: it.id, name: it.name, step: k, steps: n + 1, want, ...r };
            if (SHOT) {
                if (!NOHIDE) await b.eval(`(()=>{const s=document.createElement('style');s.id='bl-hide';s.textContent='#host *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important;text-decoration-color:transparent!important;outline:0!important}#host [data-bl-ed],#host [data-bl-ed] *{visibility:hidden!important;transition:none!important;animation:none!important}';document.head.append(s);return true})()`);
                await b.sleep(30);
                const rc = await b.eval(`(()=>{const r=document.querySelector('#host .gk').getBoundingClientRect();return {x:Math.max(0,r.left),y:Math.max(0,r.top),width:Math.ceil(r.width),height:Math.ceil(Math.min(r.height,1380))}})()`);
                await b.shot(path.join(SHOTS, `${it.id}~${k}.png`), { clip: rc });
                // 소품 자리만 따로 크게(작은 소품 글자 · 낮은 대비 — 통째 사진에선 OCR 이 놓쳐요)
                const props = await b.eval(`[...document.querySelectorAll('#host .gk summary, #host .gk figure.gk-kx')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>8&&r.height>8).map(r=>({x:Math.max(0,r.left-4),y:Math.max(0,r.top-4),width:Math.ceil(r.width+8),height:Math.ceil(Math.min(r.height+8,900))}))`);
                for (const [j, c] of props.entries()) for (const z of [2, 3]) { await b.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1400, deviceScaleFactor: z, mobile: false }); await b.shot(path.join(SHOTS, `${it.id}~${k}~p${j}x${z}.png`), { clip: c }); }   // 윈도 OCR 은 배율에 민감해요 — 2배 · 3배 둘 다
                await b.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1400, deviceScaleFactor: 2, mobile: false });
            }
            rows.push(row);
        }
    }
} finally { await b.close(); await srv.close(); }
let ocr = {};
if (OCR && SHOT) {
    const out = path.join(OUT, 'ocr.json');
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, 'ocr.ps1'), SHOTS, out], { stdio: 'inherit' });
    ocr = JSON.parse(fs.readFileSync(out, 'utf8').replace(/^﻿/, ''));
}
// OCR 은 무늬를 글자로 잘못 읽기도 해요 — 글자 둘 이상이 이어진 줄만 후보로
for (const r of rows) { const lines = Object.entries(ocr).filter(([k]) => k === `${r.id}~${r.step}` || k.startsWith(`${r.id}~${r.step}~`)).flatMap(([, v]) => [v].flat()).filter(Boolean); r.drawn = lines.filter(l => /[\p{L}\p{N}]{2,}/u.test(l)); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const per = {};
for (const r of rows) { const p = per[r.id] ??= { id: r.id, name: r.name, steps: r.steps, want: r.want, dom: new Set(), bad: new Set(), pseudo: new Set(), drawn: new Set(), vals: new Set(cu.fieldsOf(chunks[idx.items.find(x => x.id === r.id).c][r.id].preview).filter(f => f.kind === 'text').map(f => String(f.def))) }; p.dom.add(r.dom); r.bad.forEach(x => p.bad.add(x)); r.pseudo.forEach(x => p.pseudo.add(x)); r.drawn.forEach(x => p.drawn.add(x)); }
const md = ['| 틀 | 이름 | 단계 | 칸(글 · 화면) | 칸 밖 글자 | CSS 글자 | 그림 글자 후보(OCR) | 결과 |', '|---|---|---|---|---|---|---|---|'];
let fail = 0;
for (const p of Object.values(per)) {
    for (const x of [...p.pseudo]) if (p.vals.has(x.replace(/^"|"$/g, ''))) p.pseudo.delete(x);
    for (const x of [...p.drawn]) if ([...p.vals].some(v => v && x.replace(/\s+/g, '').includes(v.replace(/\s+/g, '')))) p.drawn.delete(x);   // 같은 글자를 OCR 이 읽은 것   // 「이 틀 값」 칸으로 바꾸는 CSS 글자(익명 게시판)
    const exc = EXC[p.id], domOk = p.dom.size === 1 && p.dom.has(p.want), ok = domOk && !p.bad.size && !p.pseudo.size && (!p.drawn.size || !!exc);
    if (exc && p.drawn.size) p.drawn = new Set([...p.drawn, `(예외: ${exc})`]);
    if (!ok) fail++;
    md.push(`| ${p.id} | ${p.name} | ${p.steps} | ${p.want} · ${[...p.dom].join('/')} | ${[...p.bad].join(' / ').replace(/\|/g, '/')} | ${[...p.pseudo].join(' / ').replace(/\|/g, '/')} | ${[...p.drawn].join(' / ').replace(/\|/g, '/')} | ${ok ? '통과' : '**실패**'} |`);
}
fs.writeFileSync(path.join(OUT, '결과.md'), md.join('\n'));
console.log(`틀 ${Object.keys(per).length} · 단계 사진 ${rows.length} · 실패 ${fail}`);
for (const l of md.slice(2).filter(l => l.includes('**실패**')).slice(0, 60)) console.log(l);
process.exit(fail ? 1 : 0);
