// 11-12 움직임 세기가 마트 복사 글에서 실제로 달라 보이는지(깡통 118 뒤) — 헤드리스 하나 · 틀마다 끔 · 약 · 중 · 강 판을 그려 누름 칸을 연 뒤 3초 동안 0.05초마다
//   글 상자(지문 · 이름 · 대사 줄) · 소품 잎 요소 상자가 멎은 자리에서 가장 멀리 간 거리(px)를 재요(정본 표.md 의 「글 · 소품 이동」과 같은 뜻 · 폭 375 · 낮).
//   node tools/geulkku-level-check.mjs k1079 k1173 …   → 표 한 줄씩
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'mart/data/geulkku');
const V = '?v=20261112a', imp = f => import(pathToFileURL(path.join(ROOT, 'mart', f)).href + V);
const sf = await imp('simple-frames.js'), ms = await imp('motion-state.js');
const idx = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const all = {}; for (const c of Object.values(idx.chunks)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
const { launch } = await import(pathToFileURL(path.join(ROOT, 'tools/site-rig/cdp.mjs')).href);
const { serve } = await import(pathToFileURL(path.join(ROOT, 'tools/site-rig/serve.mjs')).href);
const keys = process.argv.slice(2);
const srv = await serve(ROOT, 18964), b = await launch(path.join(ROOT, 'tools/site-rig/out/_level-prof'), 19464);
const PROBE = `window.levelProbe=async(html)=>{const box=document.getElementById('box');box.style.width='375px';box.innerHTML=html;const r=box.querySelector(':scope>div.gk');const T=[...r.querySelectorAll('p.gk-nr,p.gk-nm,p.gk-dl,.gk-tt')],P=[...r.querySelectorAll('.gk-kx summary *, .gk-kx figcaption *')].filter(e=>!e.children.length);const pos=l=>l.map(e=>{const x=e.getBoundingClientRect();return [x.left,x.top,x.width,x.height]});await new Promise(q=>requestAnimationFrame(()=>requestAnimationFrame(q)));const d=r.querySelector('details.gk-kx');if(d)d.open=true;const sT=[],sP=[];const t0=performance.now();while(performance.now()-t0<3200){sT.push(pos(T));sP.push(pos(P));await new Promise(q=>setTimeout(q,50))}for(const a of document.getAnimations()){try{a.finish()}catch{a.cancel()}}const fT=pos(T),fP=pos(P);const far=(S,F)=>Math.max(0,...S.flatMap(s=>s.map((x,i)=>Math.max(Math.abs(x[0]-F[i][0]),Math.abs(x[1]-F[i][1]),Math.abs(x[2]-F[i][2])/2,Math.abs(x[3]-F[i][3])/2))));return {t:Math.round(far(sT,fT)*10)/10,p:Math.round(far(sP,fP)*10)/10}};true`;
try {
    await b.size(1000, 900, false, 1);
    await b.goto(`${srv.url}tools/geulkku-caps-page.html`); await b.until('window.capsReady === true', 20000); await b.eval(PROBE);
    for (const k of keys) {
        const p = all[`simple-${k}`]?.preview; if (!p) { console.log(k, '없음'); continue; }
        const row = {}, caps = ms.motionCaps(p);
        for (const [lv, name] of [['0', '끔'], ['s', '약'], ['m', '중'], ['l', '강']]) row[name] = await b.eval(`levelProbe(${JSON.stringify(sf.simpleReady(ms.applyMotion(sf.toneSimple(p, sf.ORIGINAL, { mode: 'light' }), { text: lv, prop: lv })))})`, 20000);
        console.log(`${k} 글 ${['끔', '약', '중', '강'].map(n => row[n].t).join(' / ')} · 소품 ${['끔', '약', '중', '강'].map(n => row[n].p).join(' / ')} · 칩 글 ${['0', 's', 'l'].filter(v => caps.text[v]).join('') || '-'} 소품 ${['0', 's', 'l'].filter(v => caps.prop[v]).join('') || '-'}`);
    }
} finally { await b.close(); await srv.close(); }
