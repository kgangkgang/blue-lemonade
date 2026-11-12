#!/usr/bin/env node
// 11-12 글꾸 마트 조작 전수 — 크게 보기 · 목록의 단추를 하나씩 눌러 「눌림 → 미리보기(계산된 스타일) · 상태 · 복사 결과에 반영 → 다시 열었을 때 기억」을 재요.
//   복사 글만 보던 예전 대본은 미리보기가 안 바뀌어도 통과했어요 — 이 대본은 크게 보기 미리보기 DOM 의 getComputedStyle 을 재요.
//   node tools/site-rig/mart-controls.mjs <사이트 폴더 또는 공개 주소> <결과 폴더> [--tpl simple-k2,simple-k14] [--vp pc,phone] [--port 18997 --cdp 19463]
//   결과: <결과 폴더>/결과.json · 결과.md(표) · 사진 몇 장. 헤드리스 하나만 써요(포트 · 프로필은 이 대본 전용).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!SRC || !OUT) { console.log('쓰는 법: node mart-controls.mjs <사이트 폴더 | 공개 주소> <결과 폴더>'); process.exit(2); }
const TPLS = opt('--tpl', 'simple-k2,simple-k1,simple-k14,simple-k1079,simple-k1429').split(',');
const VPS = { pc: [1280, 900, false, 1], phone: [375, 812, true, 2] };
const VP = opt('--vp', 'pc,phone').split(',');
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC);
const srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18997)));
const b = await launch(path.join(HERE, 'out', '_controls-prof'), Number(opt('--cdp', 19463)));
const rows = [];
const row = (tpl, vp, op, expect, actual, ok, why = '') => { rows.push({ tpl, vp, op, expect, actual: String(actual).slice(0, 160), ok: !!ok, why }); };
const J = JSON.stringify;

// ── 화면 안 도구(한 번 심어요) ──
const PROBE = `(()=>{
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  window.__pv = () => {
    const pv = document.querySelector('.mart-sheet[open] .mart-sheet-preview'); const g = pv?.querySelector('.gk'); if (!g) return null;
    const cs = e => (e ? getComputedStyle(e) : null);
    const p = g.querySelector('.gk-lg p:not(.gk-nm):not(.gk-dl)') || g.querySelector('p:not(.gk-nm)'), d = g.querySelector('.gk-d'), n = g.querySelector('p.gk-nm');
    const P = cs(p), D = cs(d), G = cs(g), N = cs(n);
    const anim = [...g.querySelectorAll('*')].map(e => { const c = getComputedStyle(e); return c.animationName !== 'none' ? c.animationName + '/' + c.animationDuration : ''; }).filter(Boolean).join(',');
    return { h: hash(pv.innerHTML), cls: g.className, site: pv.querySelector('.mart-site')?.className || '',
      p: P ? [P.fontSize, P.lineHeight, P.fontFamily.split(',')[0], P.fontWeight, P.textAlign, P.textIndent, P.marginBottom, P.color].join('|') : '',
      d: D ? [D.fontSize, D.fontWeight, D.backgroundColor, D.color].join('|') : '',
      g: [G.borderRadius, G.backgroundColor, G.paddingTop, G.width].join('|'),
      n: N ? [N.fontWeight, N.backgroundColor, N.borderRadius, N.borderBottomWidth, N.fontSize].join('|') : '',
      anim: hash(anim) };
  };
  window.__vis = () => { const v = window.__pv(); if (!v) return null; const { h, ...rest } = v; return JSON.stringify(rest); };
  window.__copied = null;
  try { navigator.clipboard.write = async (items) => { const x = await items[0].getType('text/plain'); window.__copied = await x.text(); }; navigator.clipboard.writeText = async (t) => { window.__copied = t; }; } catch {}
  window.__toasts = [];
  const bub = document.querySelector('.mart-cart-bubble');
  if (bub && !bub.__watch) { bub.__watch = 1; new MutationObserver(() => { if (bub.classList.contains('show')) { const r = bub.getBoundingClientRect(), dlg = document.querySelector('.mart-sheet[open]'), d = dlg?.getBoundingClientRect(); window.__toasts.push({ text: bub.textContent, inSheet: !!dlg?.contains(bub), inside: !!d && r.top >= d.top - 1 && r.bottom <= d.bottom + 1 && r.left >= d.left - 1 && r.right <= d.right + 1, top: Math.round(r.top), right: Math.round(innerWidth - r.right) }); } }).observe(bub, { attributes: true, attributeFilter: ['class'] }); }
  return true; })()`;
const vis = () => b.eval('window.__vis()');
const pv = () => b.eval('window.__pv()');
const exists = sel => b.eval(`!!document.querySelector(${J(sel)})`);
const attr = (sel, a) => b.eval(`document.querySelector(${J(sel)})?.getAttribute(${J(a)}) ?? null`);
// 실제 마우스 누름(Input.dispatchMouseEvent) — JS click() 은 초점을 안 옮겨 「누른 단추에 초점이 남으면 눌림 표시가 그대로」 같은 결함을 못 잡아요
const click = async (sel, wait = 450) => {
    const ok = await b.eval(`(()=>{const e=document.querySelector(${J(sel)});if(!e)return false;if(e.disabled)return 'disabled';const r=e.getBoundingClientRect();return r.width&&r.height?true:'hidden'})()`);
    if (ok !== true) { if (ok === 'hidden') { await b.eval(`document.querySelector(${J(sel)}).click(); true`); await b.sleep(wait); return true; } return ok; }
    const t = await b.tap(sel); if (t !== true) { await b.eval(`document.querySelector(${J(sel)})?.click(); true`); }
    await b.sleep(wait); return true;
};
const setVal = async (sel, v, ev = 'change') => { const ok = await b.eval(`(()=>{const i=document.querySelector(${J(sel)});if(!i)return false;i.value=${J(String(v))};i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event(${J(ev)},{bubbles:true}));return true})()`); await b.sleep(500); return ok; };
const copy = async () => { await b.eval('window.__copied=null;true'); const ok = await click('.mart-sheet[open] .mart-sheet-foot [data-act="html"]', 100); if (ok !== true) return null; await b.until('window.__copied', 15000).catch(() => { }); return b.eval('window.__copied'); };
const toastsTake = () => b.eval('(()=>{const t=window.__toasts||[];window.__toasts=[];return t})()');
async function boot(clear) {
    await b.goto(srv.url + 'mart/geulkku/');
    if (clear) { await b.eval('localStorage.clear(); sessionStorage.clear(); true'); await b.goto(srv.url + 'mart/geulkku/'); }
    await b.until(`document.querySelector('.mart-grid[aria-busy="false"] .mart-card')`, 30000);
    await b.eval(PROBE);
}
async function openTpl(id) {
    await b.eval(`document.querySelector('.mart-sheet[open]')?.close(); true`); await b.sleep(200);
    await b.eval(`history.replaceState(null,'',location.pathname+'#'+${J(id)}); dispatchEvent(new HashChangeEvent('hashchange')); true`);
    if (!(await b.until(`document.querySelector('.mart-sheet[open]')`, 3000).catch(() => false))) { await b.goto(srv.url + 'mart/geulkku/#' + id); await b.eval(PROBE); }   // 해시 바뀜을 안 받는 옛 판(공개판)은 주소로 다시
    await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk') && document.querySelector('.mart-sheet[open] .mart-tune')`, 25000);
    await b.sleep(500); await b.eval(PROBE);
}
const simple = async () => { if ((await attr('.mart-sheet [data-view="simple"]', 'aria-pressed')) !== 'true') await click('.mart-sheet .mart-view [data-view="simple"]'); };

try {
    for (const vp of VP) {
        const [w, h, mobile, dpr] = VPS[vp];
        await b.size(w, h, mobile, dpr);
        await boot(true);
        // ── 목록: 검색 · 분류 · 디자인 거르기 · 카드 누르기 ──
        {
            const n0 = await b.eval(`document.querySelectorAll('.mart-grid .mart-card').length`);
            await setVal('.mart-tools input[type=search]', '견출지', 'input'); await b.sleep(400);
            const n1 = await b.eval(`[...document.querySelectorAll('.mart-grid .mart-card')].filter(c=>!c.hidden&&c.offsetParent).length`);
            row('목록', vp, '검색 「견출지」', '카드가 줄어 견출지만', `${n0} → ${n1}`, n1 >= 1 && n1 < n0);
            await setVal('.mart-tools input[type=search]', '', 'input'); await b.sleep(400);
            const chips = await b.eval(`[...document.querySelectorAll('.mart-chips button, .mart-groups button')].map(x=>x.textContent.trim()).slice(0,40)`);
            let chipOk = 0, chipBad = [];
            for (let i = 0; i < Math.min(chips.length, 6); i++) {
                const before = await b.eval(`[...document.querySelectorAll('.mart-grid .mart-card')].filter(c=>c.offsetParent).map(c=>c.dataset.id).join()`);
                await b.eval(`[...document.querySelectorAll('.mart-chips button, .mart-groups button')][${i}]?.click(); true`); await b.sleep(400);
                const after = await b.eval(`[...document.querySelectorAll('.mart-grid .mart-card')].filter(c=>c.offsetParent).map(c=>c.dataset.id).join()`);
                const pressed = await b.eval(`[...document.querySelectorAll('.mart-chips button, .mart-groups button')][${i}]?.getAttribute('aria-pressed')`);
                if (before !== after || pressed === 'true') chipOk++; else chipBad.push(chips[i]);
            }
            row('목록', vp, `분류 칩 ${Math.min(chips.length, 6)}개`, '누르면 목록이 바뀌거나 눌림 표시', chipBad.length ? `안 바뀜: ${chipBad.join(', ')}` : `${chipOk} 반영`, !chipBad.length);
            await boot(false);
            const styleBtns = await b.eval(`document.querySelectorAll('[data-filter="style"] button').length`);
            if (styleBtns > 1) {
                const before = await b.eval(`[...document.querySelectorAll('.mart-grid .mart-card')].filter(c=>c.offsetParent).length`);
                await b.eval(`document.querySelectorAll('[data-filter="style"] button')[1].click(); true`); await b.sleep(400);
                const after = await b.eval(`[...document.querySelectorAll('.mart-grid .mart-card')].filter(c=>c.offsetParent).length`);
                row('목록', vp, '디자인 거르기', '목록 수가 바뀜', `${before} → ${after}`, before !== after);
            } else row('목록', vp, '디자인 거르기', '단추 있음', `단추 ${styleBtns}개(숨김일 수 있음)`, true, '거르기 줄이 hidden — 해당 없음');
            await boot(false);
            await b.eval(`document.querySelector('.mart-grid .mart-card .mart-preview')?.click(); true`);
            const opened = await b.until(`document.querySelector('.mart-sheet[open]')`, 10000).catch(() => false);
            row('목록', vp, '카드 누르기', '크게 보기 열림', opened ? '열림' : '안 열림', opened);
            await b.eval(`document.querySelector('.mart-sheet[open]')?.close(); true`);
        }
        for (const id of TPLS) {
            await boot(true); await openTpl(id);
            await simple();
            const base = await vis(), baseCopy = await copy();
            row(id, vp, '열기', '미리보기 · 조절 칸', base ? '보임' : '없음', !!base);
            // ── 붙일 곳 흉내 ──
            for (const m of ['pc', 'phone', 'mart']) {
                const r = await click(`.mart-sheet [data-site="${m}"]`);
                if (r === false) { row(id, vp, `붙일 곳 ${m}`, '단추', '없음', true, '이 틀엔 없음'); continue; }
                const v = await pv();
                const ok = m === 'mart' ? !v?.site : (v?.site || '').includes(`is-${m}`);
                row(id, vp, `붙일 곳 ${m}`, m === 'mart' ? '흉내 없음' : `.mart-site.is-${m}`, v?.site || '(마트)', ok && (await attr(`.mart-sheet [data-site="${m}"]`, 'aria-pressed')) === 'true');
            }
            // ── 스타일 카드 ──
            const cards = await b.eval(`[...document.querySelectorAll('.mart-sheet [data-simple-style]')].map(x=>x.dataset.simpleStyle)`);
            const thumbs = await b.eval(`[...document.querySelectorAll('.mart-sheet .mart-style-card .mart-style-pic')].map(i=>{const c=getComputedStyle(i);return (i.children.length>0||i.textContent.trim()||c.backgroundImage!=='none')?1:0}).reduce((a,x)=>a+x,0)`);
            row(id, vp, '스타일 그림', '카드마다 견본 그림', `${thumbs}/${cards.length} 그림 있음`, thumbs >= cards.length);
            const seen = {};
            for (const s of cards) {
                await toastsTake();
                await click(`.mart-sheet [data-simple-style="${s}"]`, 600);
                const v = await vis(), pressed = await attr(`.mart-sheet [data-simple-style="${s}"]`, 'aria-pressed');
                seen[s] = v;
                const changed = s === 'plain' ? v === base : v !== base;
                const t = await toastsTake();
                row(id, vp, `스타일 「${s}」`, s === 'plain' ? '처음 모습' : '미리보기 계산 스타일이 바뀜', `${changed ? '바뀜' : '그대로'} · 눌림 ${pressed}${t.length ? ` · 알림 「${t[0].text}」 창 안 ${t[0].inside}` : ''}`, changed && pressed === 'true' && t.every(x => x.inside));
            }
            const distinct = new Set(Object.values(seen)).size;
            row(id, vp, '스타일 여섯이 서로 다름', `${cards.length}가지 모습`, `${distinct}가지`, distinct === cards.length);
            // 복사 반영
            await click('.mart-sheet [data-simple-style="book"]', 600);
            const cBook = await copy();
            row(id, vp, '복사 글에 스타일', '「책처럼」 규칙이 복사 글에', cBook ? (cBook !== baseCopy ? '들어감' : '같음') : '복사 실패', cBook && cBook !== baseCopy && /text-indent:1em/.test(cBook));
            // 다시 열기 기억
            const vBook = await vis();
            await boot(false); await openTpl(id); await simple();
            const vBook2 = await vis(), keep = await attr('.mart-sheet [data-simple-style="book"]', 'aria-pressed');
            row(id, vp, '다시 열기 기억(스타일)', '「책처럼」 그대로', `눌림 ${keep} · 모습 ${vBook2 === vBook ? '같음' : '다름'}`, keep === 'true' && vBook2 === vBook);
            await click('.mart-sheet [data-simple-style="plain"]', 600);
            // ── 색 · 바꾸기 ──
            {
                const v0 = await vis();
                await setVal('.mart-sheet input[data-tune="k"]', '#e5484d');
                const v1 = await vis();
                row(id, vp, '색 깡통', '대사색이 바뀜', v1 !== v0 ? '바뀜' : '그대로', v1 !== v0);
                const r = await click('.mart-sheet [data-simple-swap]', 600);
                const v2 = await vis();
                row(id, vp, '색 ⇄ 바꾸기', '깡통 · 깡캐 색이 서로 바뀜', r === true ? (v2 !== v1 ? '바뀜' : '그대로') : `단추 ${r}`, r === true && v2 !== v1);
            }
            // ── 밤낮 ──
            for (const m of ['dark', 'light', 'auto']) {
                const r = await click(`.mart-sheet [data-tune-mode="${m}"]`, 500);
                const v = await pv(), pressed = await attr(`.mart-sheet [data-tune-mode="${m}"]`, 'aria-pressed');
                const ok = m === 'auto' ? pressed === 'true' : pressed === 'true' && v.cls.includes(m === 'dark' ? 'gk-td' : 'gk-tl');
                row(id, vp, `밤낮 ${m}`, m === 'auto' ? '자동 눌림' : (m === 'dark' ? '.gk-td' : '.gk-tl'), `${r === true ? '' : `단추 ${r} · `}눌림 ${pressed} · ${v?.cls.match(/gk-t[dl]/)?.[0]}`, r === true && ok);
            }
            await click('.mart-sheet [data-tune-mode="light"]');
            // ── 움직임 ──
            {
                const st = await b.eval(`[...document.querySelectorAll('.mart-sheet [data-simple-motion]')].map(x=>({v:x.dataset.simpleMotion,dis:x.disabled,on:x.getAttribute('aria-pressed')}))`);
                const bad = st.filter(x => x.dis && x.on === 'true');
                row(id, vp, '움직임 표시', '막힌 단추는 눌림이 아님', J(st.map(x => `${x.v}${x.dis ? '막힘' : ''}${x.on === 'true' ? '●' : ''}`)), !bad.length);
                for (const x of st) {
                    if (x.dis) continue;
                    const v0 = await vis(); await click(`.mart-sheet [data-simple-motion="${x.v}"]`, 500);
                    const v1 = await vis(), pressed = await attr(`.mart-sheet [data-simple-motion="${x.v}"]`, 'aria-pressed');
                    row(id, vp, `움직임 ${x.v}`, '눌림 + (중이 아니면) 움직임 바뀜', `눌림 ${pressed} · ${v1 !== v0 ? '바뀜' : '그대로'}`, pressed === 'true');
                }
                await click('.mart-sheet [data-simple-motion="m"]');
                // 잔잔하게(약)를 입힌 뒤 약이 없는 틀에서 단추 모양
                await click('.mart-sheet [data-simple-style="calm"]', 600);
                const st2 = await b.eval(`[...document.querySelectorAll('.mart-sheet [data-simple-motion]')].map(x=>({v:x.dataset.simpleMotion,dis:x.disabled,on:x.getAttribute('aria-pressed')}))`);
                const bad2 = st2.filter(x => x.dis && x.on === 'true');
                row(id, vp, '잔잔하게 뒤 움직임 표시', '막힌 단추가 눌림으로 안 보임', J(st2.map(x => `${x.v}${x.dis ? '막힘' : ''}${x.on === 'true' ? '●' : ''}`)), !bad2.length);
                await click('.mart-sheet [data-simple-style="plain"]', 600);
            }
            // ── 글 크기 ──
            for (const [v, l] of [['-1', '작게'], ['2', '크게'], ['0', '보통']]) {
                const v0 = await pv(); await click(`.mart-sheet [data-simple-size="${v}"]`, 500);
                const v1 = await pv(), pressed = await attr(`.mart-sheet [data-simple-size="${v}"]`, 'aria-pressed');
                row(id, vp, `글 크기 ${l}`, '본문 글자 크기가 바뀜', `눌림 ${pressed} · ${v0.p.split('|')[0]} → ${v1.p.split('|')[0]}`, pressed === 'true' && v1.p.split('|')[0] !== v0.p.split('|')[0]);
            }
            // ── 세밀(더 조절하기) ──
            {
                await click('.mart-sheet .mart-simple-more', 500);
                const det = await attr('.mart-sheet .mart-view [data-view="detail"]', 'aria-pressed');
                row(id, vp, '더 조절하기', '세밀로 바뀜', `세밀 ${det}`, det === 'true');
                await b.eval(`document.querySelectorAll('.mart-sheet .mart-group').forEach(d=>d.open=true); true`); await b.sleep(400);
                // 질감
                const tex = await b.eval(`[...document.querySelectorAll('.mart-sheet [data-tex]')].filter(x=>!x.disabled).map(x=>x.dataset.tex)`);
                if (tex.length > 1) {
                    const v0 = await vis(); await click(`.mart-sheet [data-tex="${tex[1]}"]`, 500); const v1 = await vis();
                    row(id, vp, `질감 ${tex[1]}`, '바탕이 바뀜', v1 !== v0 ? '바뀜' : '그대로', v1 !== v0);
                    await click('.mart-sheet [data-tex="none"]', 400);
                } else row(id, vp, '질감', '막힘 표시', `고를 수 있는 것 ${tex.length}`, true, '이 틀은 질감을 안 받아요');
                // 숫자 칸 · 슬라이더 — 보이는 것 전부(막힌 것 빼고)
                const nums = await b.eval(`[...document.querySelectorAll('.mart-sheet input[data-look-num], .mart-sheet input[data-shape-num]')].filter(i=>!i.disabled&&!i.closest('.is-dim')).map(i=>[i.dataset.lookNum?'look':'shape', i.dataset.lookNum||i.dataset.shapeNum, i.min, i.max, i.value])`);
                const numBad = [];
                for (const [kind, key, mn, mx, cur] of nums) {
                    const lo = Number(mn), hi = Number(mx); const pick = Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? (Number(cur) === hi ? lo : hi) : 30;
                    const v0 = await pv(); await setVal(`.mart-sheet input[data-${kind}-num="${key}"]`, pick); const v1 = await pv();
                    if (v0.h === v1.h) numBad.push(`${key}=${pick}`);
                    await setVal(`.mart-sheet input[data-${kind}-num="${key}"]`, '');
                }
                row(id, vp, `숫자 칸 ${nums.length}개`, '값을 넣으면 미리보기가 바뀜', numBad.length ? `안 바뀜: ${numBad.join(', ')}` : '모두 바뀜', !numBad.length);
                const ranges = await b.eval(`[...document.querySelectorAll('.mart-sheet input[type=range][data-look], .mart-sheet input[type=range][data-shape]')].filter(i=>!i.disabled&&!i.closest('.is-dim')).map(i=>[i.dataset.look?'look':'shape', i.dataset.look||i.dataset.shape, i.min, i.max])`);
                const rBad = [];
                for (const [kind, key, mn, mx] of ranges) {
                    const v0 = await pv(); await setVal(`.mart-sheet input[type=range][data-${kind}="${key}"]`, mx); const v1 = await pv();
                    if (v0.h === v1.h) { await setVal(`.mart-sheet input[type=range][data-${kind}="${key}"]`, mn); const v2 = await pv(); if (v0.h === v2.h) rBad.push(key); }
                }
                row(id, vp, `슬라이더 ${ranges.length}개`, '끌면 미리보기가 바뀜', rBad.length ? `안 바뀜: ${rBad.join(', ')}` : '모두 바뀜', !rBad.length);
                await b.eval(`document.querySelector('.mart-sheet [data-detail-reset]')?.click(); true`); await b.sleep(500);
                await simple();
            }
            // ── 글 고치기 · 되돌리기 · 다시하기 · 전부 처음으로 ──
            {
                await click('.mart-sheet [data-simple-size="2"]', 400);
                const vA = await pv(); await click('.mart-sheet [data-hist="undo"]', 500); const vB = await pv();
                row(id, vp, '되돌리기', '앞 모습으로', vA.h !== vB.h ? '돌아감' : '그대로', vA.h !== vB.h);
                await click('.mart-sheet [data-hist="redo"]', 500); const vC = await pv();
                row(id, vp, '다시하기', '다시 그 모습', vC.h === vA.h ? '돌아옴' : '다름', vC.h === vA.h);
                const r = await click('.mart-sheet [data-tune-edit]', 400);
                const ed = await b.eval(`(()=>{const e=document.querySelector('.mart-sheet-preview [data-bl-ed][contenteditable="true"], .mart-sheet-preview [contenteditable="true"]');if(!e)return null;e.focus();e.textContent='고친 글 시험';e.dispatchEvent(new InputEvent('input',{bubbles:true}));return true})()`);
                await b.sleep(700);
                await click('.mart-sheet [data-tune-edit]', 400);
                const cEd = await copy();
                row(id, vp, '글 고치기', '고친 글이 복사 글에', `${r === true ? '' : `단추 ${r} · `}${ed ? '칸 있음' : '칸 없음'} · ${cEd?.includes('고친 글 시험') ? '복사에 들어감' : '안 들어감'}`, r === true && ed && cEd?.includes('고친 글 시험'));
                await b.eval(`(()=>{const b=document.querySelector('.mart-sheet [data-tune-reset="all"]');if(b){b.hidden=false;b.click()}return true})()`); await b.sleep(500);
                await b.eval(`document.querySelector('.mart-sheet [data-detail-reset]')?.click(); true`); await b.sleep(400);
                // 전부 처음으로는 캐릭터 색 · 밤낮 · 고친 글을 남겨요(설계 4-6) — 글 모양(글자 크기 · 줄 간격 · 글꼴 · 굵기 · 이름표)만 처음과 견줘요
                const shapeOf = v => { const o = JSON.parse(v); return J({ p: o.p.split('|').slice(0, 7), n: o.n.split('|').slice(0, 1).concat(o.n.split('|').slice(2)), g: o.g }); };
                const vR = await vis();
                row(id, vp, '전부 처음으로', '글 모양이 처음과 같음(색 · 밤낮 · 고친 글은 남김)', shapeOf(vR) === shapeOf(base) ? '같음' : `다름 ${shapeOf(vR)} / ${shapeOf(base)}`, shapeOf(vR) === shapeOf(base));
            }
            // ── 즐겨찾기 · 다른 거 추천 · 테마로 담기 · 파일 받기 · 담기 ──
            {
                const f0 = await attr('.mart-sheet [data-act="fav"]', 'aria-pressed');
                const r = await click('.mart-sheet [data-act="fav"]', 400);
                const f1 = await attr('.mart-sheet [data-act="fav"]', 'aria-pressed');
                row(id, vp, '즐겨찾기 별', '눌림이 뒤집힘', `${r === true ? '' : `단추 ${r} · `}${f0} → ${f1}`, r === true && f0 !== f1);
                await boot(false); await openTpl(id);
                const f2 = await attr('.mart-sheet [data-act="fav"]', 'aria-pressed');
                row(id, vp, '즐겨찾기 기억', '다시 열어도 그대로', f2, f2 === f1);
                if (f2 === 'true') await click('.mart-sheet [data-act="fav"]', 300);
                await b.eval(PROBE);
                const t1 = await b.eval(`document.querySelector('.mart-sheet [data-act="theme-copy"], .mart-sheet [data-act="theme-file"]') ? [...document.querySelectorAll('.mart-sheet [data-act^="theme-"]')].map(x=>x.dataset.act+(x.disabled?':막힘':'')).join() : '없음'`);
                const nt = await b.eval(`!!document.querySelector('.mart-sheet [data-act^="theme-"][disabled]') || /못 받/.test(document.querySelector('.mart-sheet')?.textContent||'')`);
                if (/theme-copy(?!:)/.test(t1)) { await b.eval('window.__copied=null;true'); await click('.mart-sheet [data-act="theme-copy"]', 300); await b.until('window.__copied', 10000).catch(() => { }); const c = await b.eval('window.__copied'); row(id, vp, '테마로 담기(복사)', '설정 글이 복사됨', c ? `${c.length}자` : '안 됨', !!c); }
                else row(id, vp, '테마로 담기', '못 받는 틀이면 막힘 + 까닭', t1, nt || t1 === '없음');
                const dl = await b.eval(`(()=>{let got=null;const o=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){got=this.download||this.href;};window.__dl=()=>got;return true})()`);
                const rd = await click('.mart-sheet [data-act="download"]', 600);
                const dlName = await b.eval('window.__dl?.()');
                row(id, vp, '파일로 내려받기', '.html 파일', rd === false ? '단추 없음(세밀에 있어요)' : dlName || '안 됨', rd === false || !!dlName);
                const p0 = await attr('.mart-sheet .mart-sheet-foot [data-act="pick"]', 'aria-pressed');
                const rp = await click('.mart-sheet .mart-sheet-foot [data-act="pick"]', 500);
                const p1 = await attr('.mart-sheet .mart-sheet-foot [data-act="pick"]', 'aria-pressed');
                const badge = await b.eval(`document.querySelector('.mart-cart-badge')?.textContent||''`);
                row(id, vp, '담기(장바구니)', '담김 + 수 표시', rp === false ? '단추 없음' : `${p0} → ${p1} · 배지 ${badge}`, rp === false || (p0 !== p1));
                if (p1 === 'true') await click('.mart-sheet .mart-sheet-foot [data-act="pick"]', 300);
                const c0 = await copy();
                row(id, vp, 'HTML 복사', '글꾸 HTML 이 복사됨', c0 ? `${c0.length}자 · <style> ${(c0.match(/<style>/g) || []).length}` : '안 됨', !!c0 && (c0.match(/<style>/g) || []).length === 1);
                const before = await b.eval(`document.querySelector('#mart-sheet-title')?.textContent`);
                await click('.mart-sheet [data-act="random"]', 900);
                const after = await b.eval(`document.querySelector('#mart-sheet-title')?.textContent`);
                row(id, vp, '다른 거 추천', '다른 틀이 열림', `${before} → ${after}`, before !== after);
            }
            // ── 알림 위치 ──
            {
                await openTpl(id); await simple(); await toastsTake();
                await click('.mart-sheet [data-simple-swap]', 700);
                await click('.mart-sheet [data-act="fav"]', 700); await click('.mart-sheet [data-act="fav"]', 700);
                const t = await toastsTake();
                row(id, vp, '알림 말풍선 자리', '창이 열려 있으면 창 안', t.length ? t.map(x => `「${x.text}」 ${x.inside ? '창 안' : `창 밖(위 ${x.top} 오른쪽 ${x.right})`}`).join(' / ') : '알림 없음', t.every(x => x.inside));
            }
            await b.shot(path.join(OUT, `${vp}-${id}.png`));
        }
    }
    const errs = b.errors.filter(e => !/favicon|mp3|ERR_ABORTED|net::/.test(e));
    row('전체', VP.join(','), '콘솔 오류', '0', errs.length ? errs.slice(0, 3).join(' / ') : '0', !errs.length);
} catch (e) { row('전체', '-', '대본 멈춤', '끝까지', e.stack?.split('\n').slice(0, 3).join(' / ') || e.message, false); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const md = ['| 틀 | 화면 | 조작 | 기대 | 실제 | 결과 | 비고 |', '|---|---|---|---|---|---|---|', ...rows.map(r => `| ${r.tpl} | ${r.vp} | ${r.op} | ${r.expect} | ${r.actual.replace(/\|/g, '/')} | ${r.ok ? '통과' : '**실패**'} | ${r.why} |`)].join('\n');
fs.writeFileSync(path.join(OUT, '결과.md'), md);
const bad = rows.filter(r => !r.ok);
console.log(`조작 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of bad) console.log(`실패  ${r.tpl} ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
