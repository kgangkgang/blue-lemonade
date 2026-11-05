#!/usr/bin/env node
// 글꾸 부품 고르기 — 틀이 원래 그리던 부품(aria-hidden 조각) 가운데 「보이는 글자와 겹치는 것」을 브라우저로 재서 빼 둬요.
// 겹치는 부품에 움직임 · 누르면 반응을 달면 글자 위에서 흔들리거나 눌려서요(1.0.1 사용자 규칙 「글자 위 금지」).
//   node tools/mart/parts-plan.mjs [--chrome <chrome.exe>]   (로컬 도구 · 헤드리스 크롬 · CI 에서는 안 돌아요)
//   ① convert-sian.mjs --probe 로 세계관 · 인물 시안 템플릿에 부품 차례(data-bl-t)를 달고, 내장 컨셉은 globalThis.__blPartsProbe 로 같은 표시를 달아
//   ② 표본 글(tools/mart/sample.mjs)을 끼워 폭 360 · 560 에서 움직임을 멈춘 채 그리고, 부품 상자(사방 4px 여유)가 보이는 글자(스크롤로 잘린 글 빼고)와 겹치면 그 차례를 적어요
//   → tools/mart/parts-plan.json(시안 · convert-sian 이 읽어요) · src/log-copy-parts-plan.js(내장 컨셉 · log-copy-presets.js drawConcept 이 읽어요)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name, fallback = '') => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const CHROME = arg('--chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const load = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { renderLog } = await load('src/log-copy-presets.js');
const { MART_CONCEPT_FRAMES: CONCEPT_FRAMES, renderConcept } = await load('tools/mart/geulkku-concept30.mjs');   // 1.0.1(11-04) 컨셉 30 은 마트(일러스트)로
const { SAMPLE, SAMPLE_SCREEN, UI, FIELDS } = await load('tools/mart/sample.mjs');

// ① 부품 표시 템플릿
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-parts-'));
const probeFile = path.join(tmp, 'probe.json');
const conv = spawnSync(process.execPath, [path.join(ROOT, 'tools/mart/convert-sian.mjs'), '--probe', probeFile], { encoding: 'utf8' });
if (conv.status !== 0) throw new Error(`convert-sian --probe 실패: ${conv.stderr || conv.stdout}`);
const probes = JSON.parse(fs.readFileSync(probeFile, 'utf8'));
const pages = [];
for (const [id, item] of Object.entries(probes)) if (/^(world|char)-/.test(id)) pages.push([id, renderLog(SAMPLE, { template: item, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN })]);
globalThis.__blPartsProbe = true;
for (const f of CONCEPT_FRAMES) pages.push([f.id, renderConcept(SAMPLE, { id: f.id, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN })]);
globalThis.__blPartsProbe = false;

// ② 브라우저에서 재기
const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(tmp, 'profile')}`, '--window-size=600,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 80 && !ws; i++) { await sleep(250); try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const page = list.find(t => t.type === 'page'); if (page) ws = new WebSocket(page.webSocketDebuggerUrl); } catch {} }
if (!ws) throw new Error('크롬을 못 띄웠어요');
await new Promise(r => ws.addEventListener('open', r));
let seq = 0; const waits = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const id = ++seq; waits.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const PROBE = `(() => {
  const texts = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.data.trim() || n.parentElement.closest('[aria-hidden="true"]')) continue;
    const clip = []; for (let e = n.parentElement; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') clip.push(e.getBoundingClientRect()); }
    const r = document.createRange(); r.selectNodeContents(n);
    for (const t of r.getClientRects()) { let L = t.left, T = t.top, R = t.right, B = t.bottom; for (const c of clip) { L = Math.max(L, c.left); T = Math.max(T, c.top); R = Math.min(R, c.right); B = Math.min(B, c.bottom); } if (R - L > 1 && B - T > 1) texts.push([L, T, R, B]); }
  }
  const hit = [];
  for (const e of document.querySelectorAll('[data-bl-t]')) {
    const a = e.getBoundingClientRect(); if (!a.width && !a.height) continue;
    const box = [a.left - 4, a.top - 4, a.right + 4, a.bottom + 4];
    if (texts.some(([L, T, R, B]) => Math.min(box[2], R) - Math.max(box[0], L) > 1 && Math.min(box[3], B) - Math.max(box[1], T) > 1)) hit.push(Number(e.dataset.blT));
  }
  return hit;
})()`;
const exclude = {};
for (const width of [360, 560]) {
    await send('Emulation.setDeviceMetricsOverride', { width: width + 24, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
    for (const [id, html] of pages) {
        const file = path.join(tmp, `${id}.html`);
        fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{animation:none!important;transition:none!important}</style></head><body style="margin:0;padding:12px;background:#fff">${html}</body></html>`);
        await send('Page.navigate', { url: pathToFileURL(file).href }); await sleep(350);
        const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
        for (const n of r.result?.result?.value ?? []) (exclude[id] ??= new Set()).add(n);
    }
}
ws.close(); chrome.kill();
await sleep(800); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 크롬이 프로필을 아직 쥐고 있으면 임시 폴더는 남겨요 */ }
const plain = Object.fromEntries(Object.entries(exclude).map(([id, set]) => [id, [...set].sort((a, b) => a - b)]).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(ROOT, 'tools/mart/parts-plan.json'), JSON.stringify({ _: 'tools/mart/parts-plan.mjs 산출물 — 글자와 겹치는 부품 차례(움직임 · 반응을 안 달아요). 고치지 말고 도구로 다시 만들어요', exclude: Object.fromEntries(Object.entries(plain).filter(([id]) => /^(world|char)-/.test(id))) }, null, 1) + '\n');
const concept = Object.fromEntries(Object.entries(plain).filter(([id]) => id.startsWith('concept-')));
fs.writeFileSync(path.join(ROOT, 'src/log-copy-parts-plan.js'), `// 로그 복사 — 내장 컨셉 30 의 「글자와 겹치는 부품」 차례(tools/mart/parts-plan.mjs 산출물 · 고치지 말고 도구로 다시 만들어요).\n// 이 부품에는 움직임 · 누르면 반응을 안 달아요(log-copy-motion.js addMotion exclude). 시작 그래프 밖(시트를 열 때 받아요).\nexport const PARTS_EXCLUDE = ${JSON.stringify(concept)};\n`);
console.log(`겹치는 부품 — 시안 ${Object.keys(plain).filter(id => /^(world|char)-/.test(id)).length}틀 · 내장 ${Object.keys(concept).length}틀`);
for (const [id, list] of Object.entries(plain)) console.log(`  ${id}: ${list.join(', ')}`);
