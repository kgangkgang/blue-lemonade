#!/usr/bin/env node
// 11-12 밤 숨긴 글 앞 빈칸 0 — 문단 첫 줄 들여쓰기가 있는 틀(낫표 k1 · text-indent:1em)에서 「고른 글 숨기기」(글줄 안) · 「줄 숨기기」 둘 다, 닫힘 · 열림 둘 다
//   숨긴 글 칸(details) 안에서 알약 · 열린 글이 들여쓰기만큼 더 밀려 있지 않은지(칸 왼쪽 기준) 화면에서 재요(테마 f158b579c 와 같은 고침 · 사용자가 깡통에 붙인 글에서 짚음)
//   node tools/site-rig/spoiler-indent-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--port 18994 --cdp 19473]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18994)));
const b = await launch(path.join(HERE, 'out', '_indent-prof'), Number(opt('--cdp', 19473)));
const rows = [], row = (vp, op, ok, actual) => rows.push({ vp, op, ok: !!ok, actual: String(actual).slice(0, 300) });
try {
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2]]) {
        await b.size(w, h, mobile, dpr);
        await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000);
        const got = await b.eval(`(async()=>{
            const tune = await import(new URL('../tune.js', location.href).href + '?v=' + (document.querySelector('script[src*="mart.js"]').src.match(/[?&]v=(\w+)/)||[])[1]).catch(()=>import(new URL('../tune.js', location.href).href));
            const idx = await (await fetch('../data/geulkku/index.json')).json();
            const it = idx.items.find(x => x.id === 'simple-k1'), ch = await (await fetch('../data/geulkku/' + idx.chunks[it.c].file)).json();
            const html = ch.items[it.id].preview, eds = tune.editables(html), nr = eds.find(e => e.cls === 'gk-nr');
            const plain = new DOMParser().parseFromString(html, 'text/html').querySelector('p.gk-nr').textContent;
            const out = {};
            for (const [name, sp] of [['고른 글(글줄 안)', { i: nr.i, a: 0, b: 2, t: plain.slice(0, 2) }], ['줄 숨기기', { i: nr.i }]]) {
                const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:8px;top:8px;width:340px;background:#fff;z-index:99999'; host.innerHTML = tune.applySpoilers(html, [sp]); document.body.append(host);
                for (const d of host.querySelectorAll('details')) d.open = true;   // 틀이 닫힌 채 시작해도 글이 보이게
                const sd = host.querySelector('details[data-bl-spoiler]'), para = sd.closest('.blsp-p'), cs = getComputedStyle(para);
                const indent = parseFloat(cs.textIndent);
                sd.open = false; const vis = [...sd.querySelectorAll('summary *')].map(e => e.getClientRects()[0]).find(Boolean), shut = vis ? vis.left - sd.getBoundingClientRect().left : NaN;
                sd.open = true; const r = document.createRange(); const tn = document.createTreeWalker(sd.querySelector('.blsp-c'), NodeFilter.SHOW_TEXT).nextNode(); r.setStart(tn, 0); r.setEnd(tn, 1); const open = r.getBoundingClientRect().left - sd.getBoundingClientRect().left;
                out[name] = { indent, shut: Math.round(shut * 10) / 10, open: Math.round(open * 10) / 10, style: sd.getAttribute('style') };
                host.remove();
            }
            return out;
        })()`);
        for (const [name, v] of Object.entries(got)) {
            row(vp, `낫표(들여쓰기 ${v.indent}px) · ${name} · 닫힘: 알약 앞 빈칸 0`, v.indent > 4 && Math.abs(v.shut) < 1.5, `알약 왼쪽 ${v.shut}px`);
            row(vp, `낫표 · ${name} · 열림: ${name === '줄 숨기기' ? '첫 줄 들여쓰기는 문단 그대로(더 밀리지 않음)' : '글 앞 빈칸 0'}`, name === '줄 숨기기' ? Math.abs(v.open - v.indent) < 1.5 || Math.abs(v.open) < 1.5 : Math.abs(v.open) < 1.5, `글 왼쪽 ${v.open}px`);
        }
    }
} catch (e) { row('-', '대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
