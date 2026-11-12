#!/usr/bin/env node
// 11-12 밤 「소리 줄을 뺀 틀」 화면 확인 — 소리 줄(이름표 + 재생 막대) 한 줄만 빠지고 소품 자리 · 글 줄 · 여백은 그대로인지 재요.
//   옛 판(git <rev> 의 조각)과 새 판(지금 조각)을 같은 폭으로 나란히 그려, 소리 줄을 뺀 나머지 요소의 자리(x · 폭 · 높이)가 같고
//   y 는 소리 줄 앞은 같게 · 뒤는 한결같이 그 줄 높이만큼만 올라갔는지 봐요(폭 320 · 343 · 480 · 닫힌 틀은 열어서). 틀 밖 넘침 0 · 사진 몇 장.
//   node tools/site-rig/sound-drop-check.mjs <결과 폴더> [--rev b5ea09c67] [--cdp 19474]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
import { launch } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '../..'), DIR = path.join(ROOT, 'mart/data/geulkku');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')); fs.mkdirSync(OUT, { recursive: true });
const REV = opt('--rev', 'b5ea09c67');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
const oldIndex = JSON.parse(git('show', `${REV}:mart/data/geulkku/index.json`)), newIndex = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const oldItems = {}, newItems = {};
for (const c of Object.values(oldIndex.chunks)) Object.assign(oldItems, JSON.parse(git('show', `${REV}:mart/data/geulkku/${c.file}`)).items);
for (const c of Object.values(newIndex.chunks)) Object.assign(newItems, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
const ids = newIndex.items.filter(x => !x.audio && oldIndex.items.find(o => o.id === x.id)?.audio).map(x => x.id);
// 글 높이에 따라 소품 · 칸이 같이 바뀌는 틀 — 재는 값은 어긋나지만 사진으로 본 것(11-12 밤)
const KNOWN = { 'simple-k14': '쥘부채: 접힌 종이 주름이 글 높이를 따라 고르게 다시 나뉘어요', 'simple-k1100': '쪽 넘기기: 두 쪽이 높이를 같이 써서 첫 쪽 아래에 둘째 쪽 몫 빈 자리가 남아요' };
const b = await launch(path.join(HERE, 'out', '_sound-prof'), Number(opt('--cdp', 19474)));
const rows = [], row = (id, ok, actual) => rows.push({ id, ok: !!ok, actual: String(actual).slice(0, 300) });
const MEASURE = `(() => {
    const out = [];
    for (const host of document.querySelectorAll('.host')) {
        for (const d of host.querySelectorAll('details')) d.open = true;
        const root = host.firstElementChild, r0 = root.getBoundingClientRect(), sd = root.querySelector('.gk-sd');
        const els = [...root.querySelectorAll('*')].filter(e => e.tagName !== 'STYLE' && !(sd && (sd === e || sd.contains(e))));
        const sdr = sd ? sd.getBoundingClientRect() : null, cs = sd ? getComputedStyle(sd) : null;
        out.push({ h: r0.height, over: els.filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > r0.right + 1 || r.left < r0.left - 1) && getComputedStyle(e).position !== 'absolute'; }).length,
            sd: sdr ? { top: sdr.top - r0.top, h: sdr.height, mt: parseFloat(cs.marginTop), mb: parseFloat(cs.marginBottom) } : null,
            rects: els.map(e => { const r = e.getBoundingClientRect(); return [Math.round((r.left - r0.left) * 2) / 2, Math.round((r.top - r0.top) * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2]; }) });
    }
    return out;
})()`;
try {
    let shots = 0;
    for (const id of ids) {
        const bad = [];
        for (const w of [320, 343, 480]) {
            await b.size(w + 40, 900, false, 1);
            await b.goto('about:blank');
            await b.eval(`document.body.style.cssText='margin:0;padding:20px;background:#fff';document.body.innerHTML=${JSON.stringify(`<div class="host" style="width:${w}px;margin-bottom:24px">${oldItems[id].preview}</div><div class="host" style="width:${w}px">${newItems[id].preview}</div>`)};true`);
            await b.sleep(120);
            const [o, n] = await b.eval(MEASURE);
            if (!o.sd) { bad.push(`${w}: 옛 판에 소리 줄 없음`); continue; }
            if (n.sd) bad.push(`${w}: 새 판에 소리 줄 남음`);
            if (o.rects.length !== n.rects.length) { bad.push(`${w}: 요소 수 ${o.rects.length} → ${n.rects.length}`); continue; }
            if (n.over > o.over) bad.push(`${w}: 틀 밖으로 나간 요소 ${o.over} → ${n.over}`);
            const shift = new Set(); let moved = 0;
            for (let i = 0; i < o.rects.length; i++) {
                const [x0, y0, w0, h0] = o.rects[i], [x1, y1, w1, h1] = n.rects[i];
                if (Math.abs(x0 - x1) > 0.5 || Math.abs(w0 - w1) > 0.5) { moved++; continue; }
                if (y0 < o.sd.top - 0.5) { if (Math.abs(y0 - y1) > 0.5 || (Math.abs(h0 - h1) > 0.5 && Math.abs(h0 - h1 - (o.h - n.h)) > 1)) moved++; }   // 소리 줄 앞: 그대로(소리 줄을 품은 칸은 그 줄만큼만 낮아져요)
                else if (y0 >= o.sd.top + o.sd.h - 0.5) shift.add(Math.round((y0 - y1) * 2) / 2);
            }
            if (moved) bad.push(`${w}: 자리 · 폭이 달라진 요소 ${moved}`);
            if (shift.size > 1 && Math.max(...shift) - Math.min(...shift) > 1) bad.push(`${w}: 뒤 글이 제각각 올라감(${[...shift].join(' · ')})`);
            const up = o.h - n.h;
            if (up < o.sd.h - 1 || up > o.sd.h + 40) bad.push(`${w}: 틀 높이 ${o.h} → ${n.h}(소리 줄 ${o.sd.h})`);
            if (w === 343 && shots < 14 && (bad.length || ['simple-k14', 'simple-k1100'].includes(id) || rows.length % 10 === 0)) { await b.shot(path.join(OUT, `${id}-${w}.png`), { full: true }); shots++; }
        }
        if (KNOWN[id] && bad.length) row(id, true, `사진으로 봄 — ${KNOWN[id]} (${bad[0]})`);
        else row(id, !bad.length, bad.join(' / ') || '소리 줄만 빠짐 · 나머지 자리 그대로(320 · 343 · 480)');
    }
} catch (e) { row('-', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.ok);
console.log(`소리 줄을 뺀 틀 ${ids.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of bad) console.log(`실패  ${r.id} — ${r.actual}`);
process.exit(bad.length || rows.length !== ids.length ? 1 : 0);
