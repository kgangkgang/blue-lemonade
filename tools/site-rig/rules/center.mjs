// center(테마 center-marks · census-rules/lib/pixel.mjs 방식 · 11-03 재정비 F 규칙 33): 글자 · 아이콘 잉크 가운데 ↔ 자기 상자 면 가운데 ≤ 0.5px(화소 면 기준).
//   요소마다 사진 세 장(A 그대로 · B 잉크만 투명 · C 요소 통째 숨김) → pixel.judgeCenter. 세로는 늘 재고, 가로는 가운데 맞춤인 칸(단추 · 칩 · 탭 · 아이콘)만 재요.
//   같은 서명(태그 · 클래스 · 크기 · 글자/아이콘)은 화면마다 2개까지만 재요(BL_CENTER_PER_SIG). 실패한 것은 사진을 out/shots/ 에 남겨요.
import fs from 'node:fs';
import path from 'node:path';
import { judgeCenter, r2 } from '../pixel.mjs';
import * as png from '../png.mjs';
export const id = 'center';
export const title = '가운데 맞춤(잉크 ↔ 면 ≤ 0.5px)';
const PER_SIG = Number(process.env.BL_CENTER_PER_SIG || 2);
const STRONG = 'html:root:not(#px-a):not(#px-b):not(#px-c) ';
const setHide = (ev, css) => ev(`(()=>{let s=document.getElementById('px-hide');if(!s){s=document.createElement('style');s.id='px-hide';document.head.append(s)}s.textContent=${JSON.stringify(css)};return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))})()`);
const NOANIM = `(()=>{let s=document.getElementById('px-noanim');if(!s){s=document.createElement('style');s.id='px-noanim';s.textContent='*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}.mart-zoom-hint{opacity:0!important}';document.head.append(s)}try{document.activeElement?.blur?.()}catch{}return true})()`;
export const records = [];
export async function perScreen({ ev, shot, dpr, screen, rootSel, out: outDir }) {
    const out = [], seen = new Map();
    await ev(NOANIM);
    let items = []; try { items = JSON.parse(await ev(`JSON.stringify(window.__siteMeasure.centerList(${JSON.stringify(rootSel)}))`)); } catch (e) { return [{ key: `error|${screen.where}`, msg: `가운데 맞춤 열거 실패 · ${screen.where} · ${String(e.message || e).slice(0, 80)}` }]; }
    for (const it of items) {
        const c = seen.get(it.sig) || 0; if (c >= PER_SIG) continue; seen.set(it.sig, c + 1);
        try {
            const pad = 3;
            const loc = JSON.parse(await ev(`JSON.stringify(window.__siteMeasure.where(${it.bid}))`)); if (!loc || !loc.vis) continue;
            const clip = { x: Math.max(0, loc.x - pad), y: Math.max(0, loc.y - pad), width: loc.w + pad * 2, height: loc.h + pad * 2 };
            const T = `${STRONG}[data-px="${it.bid}"]`;
            // 잉크 = 글자(투명) + 아이콘(이모지 · svg · img · 마스크 가상 요소) · 체크 ㄴ자 가상 요소 — 배지는 잉크가 아니라 그대로 둬요
            const hideInk = `${T},${T} *{color:transparent!important;-webkit-text-fill-color:transparent!important}${T} :is(.em,svg,img,.mart-cart-icon,[aria-hidden="true"]:not(.mart-cart-badge)){opacity:0!important}${T}::before,${T}::after,${T} .em::before{opacity:0!important}`;
            const hideAll = `${T}{visibility:hidden!important}`;
            const solid = `${T} :is(.em,.mart-ico,.mart-cart-icon,img){filter:brightness(0)${it.dark ? ' invert(1)' : ''}!important}`;   // 이모지 · 그림 아이콘 = 검은 실루엣(잉크 전체가 문턱을 넘게)
            // 세 장 사이에 자리가 바뀌면(창이 커지며 가운데로 옮겨 가는 중 등) 다시 찍어요 — 세 번까지
            let A, B, C, moved = true;
            for (let t = 0; t < 3 && moved; t++) {
                await setHide(ev, solid); A = png.read(await shot(clip));
                await setHide(ev, hideInk); B = png.read(await shot(clip));
                await setHide(ev, hideAll); C = png.read(await shot(clip));
                await setHide(ev, '');
                const now = JSON.parse(await ev(`JSON.stringify((()=>{const e=document.querySelector('[data-px="${it.bid}"]');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})())`));
                moved = !now || Math.abs(now.x - loc.x) > 0.2 || Math.abs(now.y - loc.y) > 0.2 || Math.abs(now.w - loc.w) > 0.2 || Math.abs(now.h - loc.h) > 0.2;
                if (moved && now) { await new Promise(r => setTimeout(r, 400)); const again = JSON.parse(await ev(`JSON.stringify(window.__siteMeasure.where(${it.bid}))`)); if (!again || !again.vis) break; Object.assign(loc, again); clip.x = Math.max(0, loc.x - pad); clip.y = Math.max(0, loc.y - pad); clip.width = loc.w + pad * 2; clip.height = loc.h + pad * 2; }
            }
            if (moved) { out.push({ key: `unstable|${screen.where}|${it.sig}`, msg: `가운데 맞춤 측정 중 자리가 계속 바뀜 · ${screen.where} · ${it.path} 「${it.label}」` }); continue; }
            const k = A.width / clip.width;
            const j = judgeCenter(A, B, C, { k, pad: loc.x - pad < 0 ? loc.x : pad, w: loc.w, h: loc.h, text: it.hasText ? it.label : '' });
            const rec = { where: screen.where, sig: it.sig, path: it.path, label: it.label, w: r2(loc.w), h: r2(loc.h), dpr, ...j };
            records.push(rec);
            if (j.noInk) continue;   // 글자 없는 빈 칸(숨긴 배지만 있는 것) — 잴 것이 없어요
            // 가로: 상자 기준 후보(> 0.25 — 테마 center-marks ④)만 화소로 판정 · 세로: 늘 화소로 판정
            const badY = Math.abs(j.dy) > 0.5, badX = it.centered && Math.abs(it.boxDx || 0) > 0.25 && Math.abs(j.dx) > 0.5;
            rec.boxDx = it.boxDx;
            if (badY || badX) {
                if (outDir) { const f = path.join(outDir, 'shots', `center-${records.length}-${String(it.label || it.sig).replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 24)}.png`); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, await shot(clip)); rec.shot = f; }
                out.push({ key: `${screen.where}|${it.sig}|${badY ? 'dy' : ''}${badX ? 'dx' : ''}`, msg: `잉크 가운데 ${badY ? `세로 ${j.dy > 0 ? '처짐' : '뜸'} ${Math.abs(j.dy)}px` : ''}${badY && badX ? ' · ' : ''}${badX ? `가로 ${j.dx > 0 ? '오른쪽' : '왼쪽'} ${Math.abs(j.dx)}px` : ''}(기준 0.5 · ${j.face === 'pixel' ? '면 화소' : '상자'} 기준) · ${screen.where} · ${it.path} 「${it.label}」` });
            }
        } catch (e) { out.push({ key: `error|${screen.where}|${it.sig}`, msg: `가운데 맞춤 측정 오류 · ${screen.where} · ${it.path} · ${String(e.message || e).slice(0, 80)}` }); await setHide(ev, '').catch(() => { }); }
    }
    return out;
}
