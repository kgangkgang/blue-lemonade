#!/usr/bin/env node
// 11-12 밤 깡통에 붙였을 때 흉내 — 복사 글(simpleReady)을 깡통이 바꾸는 꼴로 고쳐 그려 봐요(사용자가 올린 글 163534 · 예시 글 161847 에서 본 것).
//   ① 깡통은 <details> 안 내용을 class 없는 <div> 로 감싸고 summary 뒤에 <div><br></div> 를 끼워요 → 블라인드(k8 — details 안에 글이 든 틀)를 눌러 열면 글이 보이고, 끼운 빈 줄은 숨어요
//   ② 본문이 명조 계열인 틀의 <strong> 은 고딕 700(가짜 굵게 0) · 고딕 본문 틀은 그대로 ③ 고친 글의 「꾸민 낱말 + 빈칸」에 &nbsp; 글자가 안 보여요
//   node tools/site-rig/kk-paste-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--port 18992 --cdp 19476]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18992)));
const b = await launch(path.join(HERE, 'out', '_kkpaste-prof'), Number(opt('--cdp', 19476)));
const rows = [], row = (vp, op, ok, actual) => rows.push({ vp, op, ok: !!ok, actual: String(actual).slice(0, 360) });
const J = JSON.stringify;
try {
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2]]) {
        await b.size(w, h, mobile, dpr);
        await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000);
        const got = await b.eval(`(async()=>{
            const tail = s => (document.querySelector('script[src*="mart.js"]').src, (new URL('../'+s, location.href)).href);
            const martSrc = await (await fetch(tail('mart.js'), { cache: 'no-store' })).text();
            const v = n => (martSrc.match(new RegExp(n.replace('.', '\\\\.') + '\\\\?v=(\\\\w+)')) || [])[1];
            const sf = await import(tail('simple-frames.js') + '?v=' + v('simple-frames.js'));
            const tune = await import(tail('tune.js') + '?v=' + v('tune.js'));
            const idx = await (await fetch('../data/geulkku/index.json', { cache: 'no-store' })).json();
            const shut = html => html.replace(/<details\\b[^>]*\\sdata-bl-peek=""[^>]*>/g, t => t.replace(/\\sopen(?:="[^"]*")?(?=[\\s>])/, '').replace(/\\sdata-bl-peek=""/, ''));
            const chunks = {}; const pv = async id => { const it = idx.items.find(x => x.id === id); chunks[it.c] ??= (await (await fetch('../data/geulkku/' + idx.chunks[it.c].file)).json()).items; return chunks[it.c][id].preview; };
            const out = {};
            for (const id of ['simple-k8', 'simple-k09', 'simple-k1', 'simple-k1180', 'simple-k1101']) {
                let html = await pv(id);
                if (id === 'simple-k1') { const e = tune.editables(html).find(x => x.cls === 'gk-nr'); html = tune.applyTune(html, { texts: { [e.i]: tune.cleanRich('<em>기울임</em>&nbsp;<strong>굵게</strong>&nbsp;<s>취소</s>') } }); }
                const ready = sf.simpleReady(shut(html));
                const host = document.createElement('div'); host.className = 'kk-host'; host.dataset.id = id; host.style.cssText = 'position:relative;width:' + Math.min(innerWidth - 24, 640) + 'px;margin:12px auto;background:#fff'; host.innerHTML = ready; document.body.append(host);
                // 깡통 흉내: details 안 내용을 class 없는 div 로 감싸고 summary 뒤에 빈 줄을 끼워요
                let wrapped = 0, spacers = 0;
                for (const d of host.querySelectorAll('details')) {
                    const sum = d.querySelector(':scope > summary'); if (!sum) continue;
                    const rest = [...d.childNodes].filter(n => n !== sum);
                    if (rest.some(n => n.nodeType === 1)) { const box = document.createElement('div'); for (const n of rest) box.append(n); d.append(box); wrapped++; }
                    const sp = document.createElement('div'); sp.className = ''; sp.removeAttribute('class'); sp.innerHTML = '<br>'; sp.dataset.kkSpacer = '1'; sum.after(sp); spacers++;
                }
                for (const d of host.querySelectorAll('details')) d.open = true;
                const lines = [...host.querySelectorAll('details p.gk-nr, details p.gk-dl, details p.gk-nm')];
                const shown = lines.filter(p => p.getClientRects().length && p.getBoundingClientRect().height > 2).length;
                const spShown = [...host.querySelectorAll('[data-kk-spacer]')].filter(e => e.getClientRects().length).length;
                const st = host.querySelector('p strong'), em = host.querySelector('p em');
                const pf = getComputedStyle(host.querySelector('p.gk-nr') || host.querySelector('p')).fontFamily;
                out[id] = { wrapped, spacers, inDetails: lines.length, shown, spShown, pFont: pf.slice(0, 28), strongFont: st ? getComputedStyle(st).fontFamily.slice(0, 12) : '', strongWeight: st ? getComputedStyle(st).fontWeight : '', text: (host.querySelector('p.gk-nr')?.innerHTML || '').slice(0, 90), nbsp: /&amp;nbsp;|&nbsp;/.test(host.innerHTML) || host.textContent.includes('&nbsp;') };
            }
            return out;
        })()`);
        const k8 = got['simple-k8'];
        row(vp, '블라인드(k8): 깡통이 내용을 class 없는 div 로 감싼 꼴에서 눌러 열면 글이 보여요 · 끼운 빈 줄은 숨어요', k8.wrapped >= 1 && k8.inDetails > 0 && k8.shown === k8.inDetails && k8.spShown === 0, J(k8));
        for (const id of ['simple-k09', 'simple-k1180']) { const g = got[id]; row(vp, `${id}: 끼운 빈 줄 숨김 그대로 · 감싼 내용은 보임`, g.spShown === 0 && g.shown === g.inDetails, J({ wrapped: g.wrapped, spacers: g.spacers, inDetails: g.inDetails, shown: g.shown, spShown: g.spShown })); }
        const k1 = got['simple-k1'];
        row(vp, '낫표(명조 본문): 굵게는 고딕 700 · 꾸민 낱말 사이는 보통 빈칸(&nbsp; 글자 0)', /^"?Pretendard/.test(k1.strongFont) && k1.strongWeight === '700' && !k1.nbsp && k1.text.includes('<em>기울임</em> <strong>굵게</strong> <s>취소</s>'), J({ font: k1.strongFont, weight: k1.strongWeight, nbsp: k1.nbsp, text: k1.text }));
        const q5 = got['simple-k1101'];
        row(vp, '디스코드(고딕 본문): 굵게 규칙을 더하지 않아요(본문 글꼴 그대로)', !/RIDIBatang/.test(q5.pFont) && (!q5.strongFont || q5.strongFont === q5.pFont.slice(0, 12)), J({ p: q5.pFont, strong: q5.strongFont }));
        // 사진: 그 틀만 화면 맨 위에 덮어 찍어요
        for (const [id, name] of [['simple-k1', '낫표-굵게-기울임'], ['simple-k8', '블라인드-펼침']]) {
            await b.eval(`(()=>{for(const h of document.querySelectorAll('.kk-host'))h.style.cssText+=';display:none';const h=document.querySelector('.kk-host[data-id="${id}"]');h.style.cssText='position:fixed;left:0;top:0;right:0;z-index:2147483647;display:block;max-height:100vh;overflow:auto;background:#fff;padding:12px';return true})()`); await b.sleep(500);
            await b.shot(path.join(OUT, `${vp}-${name}.png`));
        }
    }
} catch (e) { row('-', '대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
