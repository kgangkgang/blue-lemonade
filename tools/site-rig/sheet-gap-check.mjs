#!/usr/bin/env node
// 11-13 크게 보기에서 「붙어 있는 칸」 사이 간격 재기 — 사용자 「붙일 곳 흉내랑 미리보기랑 너무 딱 붙지 않았니」.
//   글꾸 마트 크게 보기(전환 끔 · 켬 · 낮 · 밤) · 액자 마트 맞춰 보기에서 창 몸통의 칸들을 위에서 아래로 늘어놓고 이웃한 칸 사이 틈(px)을 재요.
//   판정(11-13 줄 올리기 뒤): 미리보기 바로 위에 한 줄(.mart-sheet-pvbar · 왼쪽 「붙일 곳 흉내」 칩 셋 · 오른쪽 해 · 달)이 있고 칩 셋이 한 줄 · 줄 높이가 전환 켬끔과 상관없이 34 · 칩 ↔ 미리보기 틈 8 · 미리보기 ↔ 아래 칸 틈 8 이상 · 미리보기 안에 해 · 달만 든 줄이 따로 없음 · 잘린 미리보기 아래 끝 흐림 · 가로 넘침 0. 보이는 미리보기 높이(pvH)도 적어요. 사진도 찍어요.
//   node tools/site-rig/sheet-gap-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--port 18989 --cdp 19479] [--loose]   (--loose: 판정 없이 값 · 사진만 — 고치기 전 판을 잴 때)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const LOOSE = argv.includes('--loose');
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18989)));
const b = await launch(path.join(HERE, 'out', '_gap-prof'), Number(opt('--cdp', 19479)));
const rows = [], row = (vp, op, ok, actual) => rows.push({ vp, op, ok: LOOSE ? true : !!ok, actual: String(actual).slice(0, 460) });
const J = JSON.stringify;
const MEASURE = `(()=>{
  const sheet = document.querySelector('.mart-sheet[open], dialog.mart-room[open]'); if (!sheet) return null;
  const body = sheet.querySelector('.mart-sheet-body') || (sheet.children.length === 1 ? sheet.firstElementChild : sheet.querySelector('.room-side')) || sheet;
  const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const name = e => (e.className && typeof e.className === 'string' ? e.className.split(' ').filter(c => /^(mart|room)-/.test(c))[0] : '') || e.tagName.toLowerCase();
  const parts = [...sheet.children].flatMap(e => (e === body ? [...body.children] : [e])).filter(vis).map(e => { const r = e.getBoundingClientRect(); return { n: name(e), top: Math.round(r.top * 2) / 2, bottom: Math.round(r.bottom * 2) / 2, left: r.left, right: r.right }; }).filter(p => p.bottom - p.top > 1).sort((a, c) => a.top - c.top);
  const sr = sheet.getBoundingClientRect(), col = parts.filter(p => p.left < sr.left + sr.width / 2);   // PC 두 칸 배치는 왼쪽 열만 세로로 견줘요
  const gaps = []; for (let i = 1; i < col.length; i++) gaps.push(col[i - 1].n + ' → ' + col[i].n + ' ' + (col[i].top - col[i - 1].bottom));
  const pv = sheet.querySelector('.mart-sheet-preview, .room-stage-wrap'), pr = pv?.getBoundingClientRect();
  const below = pv ? parts.filter(p => p.top >= pr.bottom - 1 && p.left < pr.right && p.right > pr.left).sort((a, c) => a.top - c.top)[0] : null;
  const more = pv ? pv.scrollHeight - pv.clientHeight - pv.scrollTop : 0;
  const fade = pv ? (() => { const a = getComputedStyle(pv, '::after'); return a.content !== 'none' && a.content !== 'normal' && a.position === 'sticky' ? Math.round(parseFloat(a.height)) : 0; })() : 0;
  const bar = sheet.querySelector('.mart-sheet-pvbar'), chips = bar ? [...bar.querySelectorAll('[data-site]')].map(e => e.getBoundingClientRect()) : [];
  const pill = bar?.querySelector('[data-pv-pill]'), pillOn = !!pill && !pill.hidden && pill.getClientRects().length > 0, br = bar?.getBoundingClientRect();
  const inner = pv?.querySelector('.gkt-b'), innerRow = !!inner && inner.getClientRects().length > 0 && !pv.classList.contains('is-site');
  const bcs = bar ? getComputedStyle(bar) : null, barInfo = bar ? { h: Math.round(br.height - parseFloat(bcs.paddingTop) - parseFloat(bcs.paddingBottom)), oneLine: chips.length === 3 && chips.every(c => Math.abs(c.top - chips[0].top) < 1), toPv: pr ? Math.round((pr.top + (parseFloat(getComputedStyle(pv).borderTopWidth) > 0 ? 0 : parseFloat(getComputedStyle(pv).paddingTop)) - (br.bottom - parseFloat(bcs.paddingBottom))) * 2) / 2 : null,   /* 줄의 속(36) 아래 끝 ↔ 미리보기 속 위 끝(테두리 있는 칸은 테두리) */ above: pr ? br.bottom <= pr.top + 1 : false, pill: pillOn, pillRight: pillOn ? Math.round(br.right - parseFloat(bcs.paddingRight) - pill.getBoundingClientRect().right) : null, barOver: bar.scrollWidth - bar.clientWidth, innerRow } : null;
  return { bar: barInfo, pvH: pv ? pv.clientHeight : 0, pvTop: pr ? Math.round(pr.top) : 0, gaps, pvGap: below ? below.top - pr.bottom : null, below: below?.n || '', more: Math.round(more), fade, over: document.documentElement.scrollWidth - innerWidth, sheetOver: sheet.scrollWidth - sheet.clientWidth };
})()`;
try {
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2], ['phone320', 320, 640, true, 2]]) {
        await b.size(w, h, mobile, dpr);
        for (const [name, tone] of [['전환-끔-낮', { mode: 'light' }], ['전환-켬-낮', { mode: 'light', flip: true }], ['전환-켬-밤', { mode: 'dark', flip: true }], ['전환-끔-밤', { mode: 'dark' }]]) {
            await b.goto('about:blank'); await b.goto(srv.url + 'mart/kara/').catch(() => { }); await b.eval(`(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('bl-mart-tone-v1',${J(J(tone))});return true})()`);
            await b.goto(srv.url + 'mart/geulkku/?view=1#simple-k3'); await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk')`, 30000); await b.sleep(900);
            const m = await b.eval(MEASURE);
            const k = m?.bar; row(vp, `글꾸 크게 보기 · ${name}: 미리보기 위 한 줄(칩 셋 한 줄 · 높이 34 · 칩 ↔ 미리보기 8 · 해 · 달은 전환 켰을 때만 오른쪽 끝 · 미리보기 안 따로 줄 0) · 미리보기 ↔ 아래 칸 8 이상 · 잘린 미리보기 흐림 · 넘침 0`, m && k && k.above && k.oneLine && k.h === 34 && k.toPv === 8 && k.pill === !!tone.flip && (!k.pill || Math.abs(k.pillRight) <= 1) && !k.innerRow && k.barOver <= 0 && (vp === 'pc' || m.below === 'mart-sheet-side' && m.pvGap === 12) && (m.more <= 2 || m.fade >= 12) && m.over <= 0, J(m));
            await b.shot(path.join(OUT, `${vp}-글꾸-${name}.png`));
        }
        // 세밀 보기
        await b.eval(`(()=>{const x=[...document.querySelectorAll('.mart-sheet[open] [data-view]')].find(e=>e.dataset.view==='detail');x?.click();return !!x})()`); await b.sleep(700);
        { const m = await b.eval(MEASURE), k = m?.bar; row(vp, '글꾸 크게 보기 · 세밀: 미리보기 위 한 줄 · 칩 ↔ 미리보기 8 · 미리보기 ↔ 아래 칸 8 이상 · 넘침 0', m && k && k.above && k.oneLine && k.toPv === 8 && m.over <= 0, J(m)); await b.shot(path.join(OUT, `${vp}-글꾸-세밀.png`)); }
        // 액자 마트 맞춰 보기
        await b.goto('about:blank'); await b.goto(srv.url + 'mart/frames/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.sleep(500);
        await b.eval(`document.querySelector('.mart-card [data-act="open"]')?.click(); true`); await b.sleep(1500);
        { const m = await b.eval(MEASURE); row(vp, '액자 맞춰 보기: 가로 넘침 0(칸 사이 틈은 값 · 사진으로)', !!m && m.over <= 0 && m.sheetOver <= 0, J(m)); await b.shot(path.join(OUT, `${vp}-액자-맞춰-보기.png`)); }
    }
} catch (e) { rows.push({ vp: '-', op: '대본 멈춤', ok: false, actual: e.stack?.split('\n').slice(0, 3).join(' / ') }); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
