// 11-10 글꾸 마트 「대사색 하나」 관문 — 로그 글꾸 전부를 대사색 여러 개 × 밤/낮으로 다시 칠해 헤드리스 Edge 하나에서 재요.
//   잼: ① 글자 대비 4.5 미만(깡통이 덮는 문턱 — <style> · 이모지만 든 글은 빼요) ② 붙일 꼴의 인라인 url( ③ fill 없는 글자색 ④ 폰 390 가로 넘침
//   PLAYWRIGHT_CORE=<playwright-core 자리> node tools/geulkku-tone-gate.mjs [--k #3aa7ff,#f0d878,...] [--out <폴더>]
//   종료 코드 1 = 실패가 하나라도 있어요. 브라우저는 하나만 띄우고 끝나면 그 PID 만 닫아요.
import { retired } from './geulkku-retired.mjs'; retired('geulkku-tone-gate');   // 11-11 옛 글꾸를 마트에서 뺐어요 — 이 도구는 쉬어요(geulkku-retired.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MART = path.resolve(HERE, '../mart');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(HERE, 'out', 'tone-gate')));
fs.mkdirSync(OUT, { recursive: true });
const Ks = arg('--k', '#3aa7ff,#f0d878,#7fe03c,#ff5fa2,#c9d1dc,#424c59,none').split(',');
// 11-10 종이 색 × 질감 × 혼합 조합: --combo 종이:질감[:혼합색+혼합색+…] 를 쉼표로(없으면 흰 종이 · 민무늬 · 단색)
const COMBOS = arg('--combo', 'white:plain').split(',').map(c => { const [paper, texture, mix] = c.split(':'); return { paper, texture, mix: mix ? mix.split('+') : null }; });
const SIMPLE_ONLY = argv.includes('--simple');   // 공개 목록에 보이는 심플(과 내장)만
const imp = f => import(pathToFileURL(path.join(MART, f)).href);
const tr = await imp('taste-render.js'), tp = await imp('taste-parse.js'), tg = await imp('tone-geulkku.js');
await tr.loadConcept();
const dir = path.join(MART, 'data/geulkku');
const ix = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const cache = new Map();
const chunk = c => { if (!cache.has(c)) cache.set(c, JSON.parse(fs.readFileSync(path.join(dir, ix.chunks[c].file), 'utf8')).items); return cache.get(c); };
const items = ix.items.filter(m => !m.photo && (!SIMPLE_ONLY || m.style === '심플' || m.builtin)).map(m => ({ ...m, ...chunk(m.c)[m.id], kind: 'geulkku', label: m.name }));
const model = tp.buildModel(tp.parseLog('가브리엘: 가브리엘이 안경을 밀어 올리며 휴게실 문턱에 멈춰 섰다. "실례하겠습니다. 잠깐 시간 괜찮으신가요?"\n\n나: 나는 컵을 내려놓았다. "어, 들어와. 커피 마실래?"'));
const raw = new Map(items.map(it => { try { return [it.id, tr.shutPeek(tr.tasteHtml(it, model, { title: '휴게실 앞 복도', date: '' }, { names: true }))]; } catch (e) { return [it.id, '']; } }));

const PROBE = `(() => {
  function rgb(s){var m=String(s).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;var q=m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);return [q[0],q[1],q[2],q[3]==null?1:q[3]];}
  function lin(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}function lum(c){return 0.2126*lin(c[0])+0.7152*lin(c[1])+0.0722*lin(c[2]);}function con(a,b){var x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
  const out = [];
  document.querySelectorAll('[data-g]').forEach(pg => {
    const page = pg.dataset.page === 'dark' ? [23,23,23] : [255,255,255];
    if (pg.scrollWidth > pg.clientWidth + 1) out.push({ id: pg.dataset.g, kind: 'overflow', w: pg.scrollWidth });
    pg.querySelectorAll('*').forEach(el => {
      if (el.closest('style,script,title')) return;
      if (![].some.call(el.childNodes, n => n.nodeType === 3 && /[가-힣A-Za-z0-9]/.test(n.textContent))) return;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
      if (el.getClientRects().length === 0) return;
      const c = rgb(cs.webkitTextFillColor || cs.color); if (!c) return;
      let bg = null, a = el, how = 'page';
      while (a && a !== pg) { const g = getComputedStyle(a), bc = rgb(g.backgroundColor); const gi = g.backgroundImage; if (gi && /gradient/.test(gi) && !/transparent|rgba\\([^)]*,\\s*0(\\.\\d+)?\\)/.test(gi)) { const cs2 = (gi.match(/rgba?\\([^)]*\\)/g) || []).map(rgb).filter(x => x && x[3] > 0.85); if (cs2.length) { bg = [0,1,2].map(i => cs2.reduce((s, x) => s + x[i], 0) / cs2.length); how = 'grad'; break; } } if (bc && bc[3] > 0.85) { bg = bc; how = 'solid'; break; } if (bc && bc[3] >= 0.3) { bg = [0,1,2].map(i => bc[i] * bc[3] + page[i] * (1 - bc[3])); how = 'solid'; break; } a = a.parentElement; }
      bg = bg || page;
      const k = con(c, bg);
      if (k < 4.5) out.push({ id: pg.dataset.g, kind: how === 'grad' ? 'contrast-grad' : 'contrast', text: el.textContent.trim().slice(0, 24), fill: c.slice(0,3).join(','), bg: bg.slice(0,3).map(Math.round).join(','), k: +k.toFixed(2) });
    });
  });
  return out;
})()`;

const server = await chromium.launchServer({ executablePath: EDGE, headless: true });
const pid = server.process().pid; console.log('edge pid', pid);
const report = { combos: [], fails: [] };
let staticFail = 0;
try {
  const b = await chromium.connect(server.wsEndpoint());
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  for (const combo of COMBOS) for (const K of Ks) for (const mode of ['dark', 'light']) {
    const parts = [];
    for (const it of items) {
      const h = raw.get(it.id); if (!h) continue;
      const opt = { mode, paper: combo.paper, texture: combo.texture };
      const out = tg.kkangtongReady(combo.mix ? tg.toneMixHtml(h, it.colors || it.palette || null, [K, ...combo.mix], opt) : tg.toneHtml(h, it.colors || it.palette || null, K === 'none' ? null : K, opt));
      const r = tg.readyReport(out);
      if (!r.ok) { staticFail++; report.fails.push({ id: it.id, K, mode, kind: 'ready', ...r }); }
      parts.push(`<div data-g="${it.id}" data-page="${mode}" style="background:${mode === 'dark' ? '#171717' : '#fff'};padding:8px 0;overflow:auto">${out}</div>`);
    }
    // 한 쪽에 다 넣으면 움직임 · 장식이 많아 안 열려요 — 120 개씩 · 움직임은 꺼요(색만 재요)
    let foundAll = 0;
    for (let s = 0; s < parts.length; s += 120) {
      const file = path.join(OUT, `gate-${combo.paper}-${combo.texture}-${K.replace('#', '')}-${mode}-${s}.html`);
      fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*,*::before,*::after{animation:none!important;transition:none!important}</style><body style="margin:0">${parts.slice(s, s + 120).join('')}</body>`);
      await p.goto(pathToFileURL(file).href, { timeout: 120000, waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(300);
      const found = await p.evaluate(PROBE);
      for (const f of found) report.fails.push({ ...f, K, mode, paper: combo.paper, texture: combo.texture, mix: !!combo.mix });
      foundAll += found.length;
      fs.rmSync(file);
    }
    report.combos.push({ paper: combo.paper, texture: combo.texture, mix: !!combo.mix, K, mode, n: parts.length, fails: foundAll });
    console.log(combo.paper, combo.texture, combo.mix ? '혼합' : '단색', K, mode, parts.length, '실패', foundAll);
  }
  await b.close();
} finally {
  await server.close();
  try { process.kill(pid, 0); console.log('아직 살아 있음', pid); } catch { console.log('닫힘', pid); }
}
fs.writeFileSync(path.join(OUT, 'tone-gate.json'), JSON.stringify(report, null, 1));
const total = report.fails.filter(f => f.kind !== 'contrast-grad').length;   // 그라데이션 위 글자는 바탕을 하나로 못 정해 따로 세요(fill 로 색은 지켜요)
console.log('그라데이션 위(따로)', report.fails.length - total);
console.log(JSON.stringify({ combos: report.combos.length, total, staticFail }));
for (const f of report.fails.filter(f => f.kind !== 'contrast-grad').slice(0, 40)) console.log(JSON.stringify(f));
process.exit(total ? 1 : 0);
