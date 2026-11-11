// 11-12 「처음부터 열어 두기」 깡통 흉내 확인 — 깡통 정화기는 <details open> 의 open 속성을 지워요(118 실측).
//   틀마다 A = 누름 칸(details.gk-kx)에 open 을 준 원래 열린 모습 · B = 마트 「열어 두기」 꼴(div.gk-det)에서 open 속성을 모두 지운 글 을 헤드리스 하나로 그려,
//   움직임을 끝까지 돌린 뒤(getAnimations().finish) 카드 높이 · 글 상자 자리 · 지문 위 공백 · 글 칸 보임이 같은지 재요(폭 375 · 640 · 낮 · 밤).
//   node tools/geulkku-open-check.mjs   → 다른 틀 목록(없으면 0) · tools/site-rig/out/open-check.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'mart/data/geulkku');
const V = '?v=20261112a', imp = f => import(pathToFileURL(path.join(ROOT, 'mart', f)).href + V);
const sf = await imp('simple-frames.js'), ms = await imp('motion-state.js');
const idx = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const all = {}; for (const c of Object.values(idx.chunks)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
const { launch } = await import(pathToFileURL(path.join(ROOT, 'tools/site-rig/cdp.mjs')).href);
const { serve } = await import(pathToFileURL(path.join(ROOT, 'tools/site-rig/serve.mjs')).href);
const srv = await serve(ROOT, 18962), b = await launch(path.join(ROOT, 'tools/site-rig/out/_open-prof'), 19462);
const PROBE = `(()=>{const box=document.getElementById('box');window.openProbe=(html,W)=>{box.style.width=W+'px';box.innerHTML=html;const root=box.querySelector(':scope>div.gk');root.getBoundingClientRect();for(const a of document.getAnimations()){try{a.finish()}catch{a.cancel()}}const rr=root.getBoundingClientRect();const txt=[...root.querySelectorAll('.gk-tt, p.gk-nr, p.gk-nm, p.gk-dl')];const pos=txt.map(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);let o=1;for(let x=e;x&&x!==box;x=x.parentElement)o*=+getComputedStyle(x).opacity;return [Math.round(r.top-rr.top),Math.round(r.left-rr.left),Math.round(r.width),Math.round(r.height),cs.visibility==='hidden'?0:Math.round(o*10)/10]});return {h:Math.round(rr.height),pos}};return true})()`;
const bad = [], keys = Object.keys(all).filter(id => /<details class="gk-kx"/.test(all[id].preview));
try {
    await b.size(1000, 900, false, 1);
    await b.goto(`${srv.url}tools/geulkku-caps-page.html`); await b.until('window.capsReady === true', 20000); await b.eval(PROBE);
    for (const id of keys) for (const mode of ['light', 'dark']) {
        const p = sf.simpleReady(sf.toneSimple(all[id].preview, sf.ORIGINAL, { mode }));
        const A = p.replace(/<details class="gk-kx"(?![^>]*\sopen(?:=|\s|>))([^>]*)>/g, '<details class="gk-kx"$1 open="">');
        const B = (process.env.CONTROL ? p : sf.simpleReady(ms.applyOpen(sf.toneSimple(all[id].preview, sf.ORIGINAL, { mode })))).replace(/(<(?:details|div)\b[^>]*)\sopen(?:="[^"]*")?(?=[\s>])/g, '$1');   // 깡통 흉내 — open 속성을 다 지움
        for (const W of [375, 640]) {
            const a = await b.eval(`openProbe(${JSON.stringify(A)}, ${W})`), c = await b.eval(`openProbe(${JSON.stringify(B)}, ${W})`);
            const diff = Math.abs(a.h - c.h) > 1 || a.pos.length !== c.pos.length || a.pos.some((x, i) => x.some((v, j) => Math.abs(v - c.pos[i][j]) > (j === 4 ? 0.05 : 1)));
            if (diff) bad.push({ id, mode, W, a: { h: a.h, pos: a.pos.slice(0, 4) }, b: { h: c.h, pos: c.pos.slice(0, 4) } });
        }
    }
} finally { await b.close(); await srv.close(); }
fs.mkdirSync(path.join(ROOT, 'tools/site-rig/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/site-rig/out/open-check.json'), JSON.stringify({ frames: keys.length, bad }, null, 1));
console.log(`열어 두기 깡통 흉내: 틀 ${keys.length} × 낮밤 × 폭 둘 · 다른 판 ${bad.length}`, [...new Set(bad.map(x => x.id))].slice(0, 30).join(' '));
