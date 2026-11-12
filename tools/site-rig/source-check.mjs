#!/usr/bin/env node
// 11-12 밤 원작(출처) 화면 확인 — 글꾸 마트 캐릭터 칸 묶음 줄 · 고른 캐릭터 줄 · 크게 보기 머리 · 「원작」 칸 · 액자 마트 센티넬버스 봇 링크(PC 1280 · 폰 375 · 가로 넘침 0)
//   node tools/site-rig/source-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--port 18995 --cdp 19471]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18995)));
const b = await launch(path.join(HERE, 'out', '_source-prof'), Number(opt('--cdp', 19471)));
const rows = [], row = (vp, op, ok, actual) => rows.push({ vp, op, ok: !!ok, actual: String(actual).slice(0, 300) });
const NINE = [54677, 5150, 78795, 78569, 127563, 155899, 81234, 29037, 99019, 43794];   // 아홉 + 아드리안 둘째 글
const over = () => b.eval(`document.documentElement.scrollWidth - innerWidth`);
const hrefs = sel => b.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(a=>a.getAttribute('href')||('글:'+a.textContent))`);
const clipOut = sel => b.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.checkVisibility()&&(e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left<-1)).length`);
try {
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2]]) {
        await b.size(w, h, mobile, dpr);
        await b.goto('about:blank'); await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { });
        await b.goto(srv.url + 'mart/geulkku/'); await b.until(`document.querySelectorAll('.mart-card').length > 3 && document.querySelector('.mart-credits a.mart-source')`, 30000); await b.sleep(600);
        // 「원작」 칸: 캐릭터를 안 골라도 아홉 글
        const box = await hrefs('.mart-credits a.mart-source');
        row(vp, '「원작」 칸: 캐릭터를 안 골라도 아홉 글 링크', NINE.every(n => box.some(u => u.endsWith('/posts/' + n))), `${new Set(box).size}곳 · 줄 ${box.length}`);
        await b.eval(`document.querySelector('.mart-credits').scrollIntoView({block:'center'}); true`); await b.sleep(300);
        row(vp, '「원작」 칸 가로 넘침 0', (await over()) <= 0 && (await clipOut('.mart-credits a.mart-source')) === 0, `페이지 넘침 ${await over()} · 밖으로 나간 링크 ${await clipOut('.mart-credits a.mart-source')}`);
        await b.shot(path.join(OUT, `${vp}-1-원작-칸.png`));
        // 캐릭터 칸(11-12 밤 한 번에 한 묶음): 깡통 → 묶음 탭마다 「원작 N ⌄」을 펼치면 그 묶음 원작 글 전부
        await b.eval(`scrollTo(0,0); document.querySelector('.mart-cast [data-toggle="main"]').click(); true`); await b.sleep(400);
        const groups = await b.eval(`[...document.querySelectorAll('.mart-cast .mart-cast-tabs [data-tab]')].map(x=>x.dataset.tab).filter(g=>g!=='direct')`);
        const got = {};
        for (const g of groups) {
            await b.eval(`document.querySelector('.mart-cast [data-tab="${g}"]').click(); true`); await b.sleep(250);
            await b.eval(`document.querySelector('.mart-cast [data-src-toggle]')?.click(); true`); await b.sleep(250);
            got[g] = await b.eval(`[...document.querySelectorAll('.mart-cast .mart-cast-src[data-src-group="${g}"] a.mart-source')].filter(a=>a.checkVisibility()).map(a=>a.getAttribute('href'))`);
        }
        row(vp, '캐릭터 칸: 묶음마다 원작 링크(「원작 N」 펼침)', groups.length >= 4 && groups.every(g => got[g].length > 0) && NINE.every(n => Object.values(got).flat().some(u => u.endsWith('/posts/' + n))), groups.map(g => `${g} ${got[g].length}`).join(' · '));
        row(vp, '캐릭터 칸 가로 넘침 0', (await over()) <= 0 && (await clipOut('.mart-cast a.mart-source')) === 0, `페이지 넘침 ${await over()}`);
        await b.eval(`document.querySelector('.mart-cast').scrollIntoView({block:'start'}); true`); await b.sleep(250);
        await b.shot(path.join(OUT, `${vp}-2-캐릭터-칸-묶음.png`));
        // 은설을 고르면 목록 위 줄에 원작
        await b.eval(`(()=>{document.querySelector('.mart-cast [data-tab="sentinel"]').click();const r=[...document.querySelectorAll('.mart-cast .mart-cast-pane [data-color]')].find(i=>i.dataset.name==='은설');r.click();return true})()`); await b.sleep(700);
        const picked = await b.eval(`(()=>{const c=document.querySelector('.mart-cast .mart-cast-credit');return c?{text:c.textContent.replace(/\\s+/g,' ').trim(),links:[...c.querySelectorAll('a.mart-source')].map(a=>a.href)}:null})()`);
        row(vp, '은설을 고르면 목록 위에 원작 줄(센티넬버스 두 봇 링크)', picked && /은설/.test(picked.text) && [29037, 99019].every(n => picked.links.some(u => u.endsWith('/posts/' + n))), picked ? picked.text : '줄 없음');
        await b.eval(`document.querySelector('.mart-cast').scrollIntoView({block:'start'}); true`); await b.sleep(250);
        await b.shot(path.join(OUT, `${vp}-3-은설-고름.png`));
        row(vp, '고른 뒤 가로 넘침 0', (await over()) <= 0, `페이지 넘침 ${await over()}`);
        // 깡캐에 아드리안을 고르면 원작 글 둘이 나란히
        await b.eval(`document.querySelector('.mart-cast [data-toggle="other"]').click(); true`); await b.sleep(400);
        await b.eval(`(()=>{document.querySelector('.mart-cast [data-tab="dh"]').click();const r=[...document.querySelectorAll('.mart-cast .mart-cast-pane [data-color]')].find(i=>i.dataset.name==='아드리안 폰 아이젠베르크');r.click();return true})()`); await b.sleep(700);
        const adr = await b.eval(`[...document.querySelectorAll('.mart-cast .mart-cast-credit .mart-cast-credit-row')].filter(r=>/아드리안/.test(r.textContent)).flatMap(r=>[...r.querySelectorAll('a.mart-source')].map(a=>a.href))`);
        row(vp, '아드리안을 고르면 원작 글 둘(81234 · 43794)', [81234, 43794].every(n => adr.some(u => u.endsWith('/posts/' + n))) && adr.length === 2, adr.join(' · ') || '줄 없음');
        await b.eval(`document.querySelector('.mart-cast').scrollIntoView({block:'start'}); true`); await b.sleep(250);
        await b.shot(path.join(OUT, `${vp}-3b-아드리안-고름.png`));
        row(vp, '아드리안 고른 뒤 가로 넘침 0', (await over()) <= 0, `페이지 넘침 ${await over()}`);
        // 크게 보기 머리에도
        await b.goto(srv.url + 'mart/geulkku/?view=1#simple-k2'); await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk')`, 30000); await b.sleep(700);
        const sheet = await b.eval(`(()=>{const c=document.querySelector('.mart-sheet[open] .mart-sheet-credit');const s=document.querySelector('.mart-sheet[open]');return c?{text:c.textContent.replace(/\\s+/g,' ').trim(),links:[...c.querySelectorAll('a.mart-source')].map(a=>a.href),out:[...c.querySelectorAll('a')].filter(a=>a.getBoundingClientRect().right>s.getBoundingClientRect().right+1).length}:null})()`);
        row(vp, '크게 보기 머리에 고른 캐릭터 원작 줄', sheet && /은설/.test(sheet.text) && sheet.links.length >= 2 && !sheet.out, sheet ? `${sheet.text} · 창 밖 ${sheet.out}` : '줄 없음');
        await b.shot(path.join(OUT, `${vp}-4-크게-보기.png`));
        // 액자 마트: 센티넬버스 인물 액자 크게 보기 — 봇 이름이 링크
        await b.goto('about:blank'); await b.goto(srv.url + 'mart/frames/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.sleep(600);
        const fr = await b.eval(`(async()=>{const d=await (await fetch('../data/frames.json')).json();const it=d.items.find(x=>x.category==='sentinel-char');return it?it.id:null})()`);
        const ad = await b.eval(`(async()=>{const d=await (await fetch('../data/frames.json')).json();const it=d.items.find(x=>x.concept==='adrian');return it?it.id:null})()`);
        if (ad) {
            await b.goto('about:blank'); await b.goto(srv.url + 'mart/frames/#' + encodeURIComponent(ad)); await b.sleep(2500);
            const as = await b.eval(`[...document.querySelectorAll('dialog[open] a.mart-source, .room-source a.mart-source')].map(a=>a.getAttribute('href'))`);
            row(vp, '액자 마트 아드리안 액자: 원작 글 둘', [81234, 43794].every(n => as.some(u => u.endsWith('/posts/' + n))), as.join(' · ') || '창이 안 열림');
            await b.shot(path.join(OUT, `${vp}-6-액자-아드리안.png`));
        } else row(vp, '액자 마트 아드리안 액자', false, '자료에서 못 찾음');
        if (!fr) row(vp, '액자 마트 센티넬버스 액자', false, '자료에서 못 찾음');
        else {
            await b.goto('about:blank'); await b.goto(srv.url + 'mart/frames/#' + encodeURIComponent(fr)); await b.sleep(2500);
            const src = await b.eval(`[...document.querySelectorAll('dialog[open] .mart-source, .room-source .mart-source')].map(a=>a.tagName+':'+(a.getAttribute('href')||a.textContent))`);
            row(vp, '액자 마트 센티넬버스 액자: 원작 봇 둘이 링크', [29037, 99019].every(n => src.some(u => u.startsWith('A:') && u.endsWith('/posts/' + n))), src.join(' · ') || '창이 안 열림');
            await b.shot(path.join(OUT, `${vp}-5-액자-센티넬버스.png`));
        }
    }
    const errs = b.errors.filter(e => !/favicon|mp3|ERR_ABORTED|net::/.test(e));
    row('-', '콘솔 오류 0', !errs.length, errs.slice(0, 3).join(' / ') || '0');
} catch (e) { row('-', '대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(OUT, '결과.md'), ['| 화면 | 확인 | 실제 | 결과 |', '|---|---|---|---|', ...rows.map(r => `| ${r.vp} | ${r.op} | ${r.actual.replace(/\|/g, '/')} | ${r.ok ? '통과' : '**실패**'} |`)].join('\n'));
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
