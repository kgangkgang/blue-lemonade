#!/usr/bin/env node
// 11-13 「낮 · 밤 전환 넣기」 화면 확인 — 마트 복사 길로 만든 글을 깡통이 바꾸는 꼴(details 안을 class 없는 div 로 감싸고 빈 줄 끼움)로 그려 낮 → 밤 → 낮을 눌러 봐요.
//   ① 417틀 전부(마트 모듈 그대로: toneSimple → simpleReady → addToggle): 닫힘 = 낮 판 단독 · 열림 = 밤 판 단독 · 다시 닫힘 = 낮 판과 틀 안 모든 요소의 계산된 모습이 같은지 · 해 · 달 단추 하나 · 끼운 빈 줄 숨김 · 가로 넘침 0
//   ② 실제 화면 조합(크게 보기에서 「전환 넣기」를 켜고 「HTML 복사」를 눌러 나온 글): 기본 · 캐릭터 색 · 밤으로 시작 · 소품만 움직임 · 내 글 · 글 고치기 · 눌러야 보이게 — 같은 견줌 + 미리보기에서 해 · 달이 눌리는지 · 「테마용 복사」 값에는 전환 0
//   node tools/site-rig/toggle-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--only all,combo] [--vp pc,phone] [--port 18991 --cdp 19477]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const ONLY = opt('--only', '');
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18991)));
const b = await launch(path.join(HERE, 'out', '_toggle-prof'), Number(opt('--cdp', 19477)));
const rows = [], row = (vp, op, ok, actual) => rows.push({ vp, op, ok: !!ok, actual: String(actual).slice(0, 420) });
const J = JSON.stringify;
// 페이지 안에서 쓰는 도우미(깡통 흉내 · 계산된 모습 서명 · 견줌)
const HELPERS = `
window.__kk = (() => {
  const kk = (host) => { for (const d of host.querySelectorAll('details')) { const sum = d.querySelector(':scope > summary'); if (!sum) continue; const rest = [...d.childNodes].filter(n => n !== sum); if (rest.some(n => n.nodeType === 1)) { const box = document.createElement('div'); for (const n of rest) box.append(n); d.append(box); } const sp = document.createElement('div'); sp.innerHTML = '<br>'; sp.dataset.kkSpacer = '1'; sum.after(sp); } };
  // 깡통은 본문을 shadow root 안에 그려요 — 여기서도 틀마다 shadow root 에 넣어 마트 목록 카드의 규칙(.gk-tl p …)이 섞이지 않게 해요
  const mount = (html, w) => { const outer = document.createElement('div'); outer.className = 'tg-host'; outer.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;background:#fff'; document.body.append(outer); const sh = outer.attachShadow({ mode: 'open' }); const host = document.createElement('div'); host.style.cssText = 'width:100%;overflow:hidden'; host.innerHTML = '<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>' + html; sh.append(host); kk(host); host.remove = () => outer.remove(); host.outer = outer; return host; };
  const sig = (host) => { const root = host.querySelector('.gk'); if (!root) return null; const out = []; for (const e of [root, ...root.querySelectorAll('*')]) { if (e.tagName === 'STYLE' || e.dataset.kkSpacer || e.tagName === 'BR') continue; for (const pe of [null, '::before', '::after']) { const c = getComputedStyle(e, pe); if (pe && (c.content === 'none' || c.content === 'normal')) continue; const r = pe ? null : e.getBoundingClientRect(); out.push([c.color, c.backgroundColor, c.borderTopColor, c.borderTopWidth, c.opacity, c.display, c.filter, c.boxShadow, c.backgroundImage.length, c.maskImage?.length || 0, r ? Math.round(r.width) + 'x' + Math.round(r.height) : ''].join('|')); } } return out; };
  const diff = (a, b) => { if (!a || !b) return -1; if (a.length !== b.length) return 100000 + Math.abs(a.length - b.length); let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
  /** 전환 단 글 T · 낮 판 L · 밤 판 D 를 깡통 꼴로 그려 닫힘 = L · 열림 = D · 다시 닫힘 = L 인지 */
  const check = (T, L, D, w = 375) => {
    const ht = mount(T, w), hl = mount(L, w), hd = mount(D, w), out = {};
    try {
      const pill = ht.querySelectorAll('details.gkt-k'), sl = sig(hl), sd = sig(hd);
      out.pills = pill.length; out.roots = ht.querySelectorAll('.gkt').length; out.same = diff(sl, sd) === 0;
      out.shut = diff(sig(ht), sl);
      pill[0].open = true; out.open = diff(sig(ht), sd);
      pill[0].open = false; out.back = diff(sig(ht), sl);
      const pr = pill[0].querySelector('summary').getBoundingClientRect(); out.pillBox = Math.round(pr.width) + 'x' + Math.round(pr.height);
      out.spacer = [...ht.querySelectorAll('.gkt-k [data-kk-spacer], .gkt-k ~ [data-kk-spacer]')].filter(e => e.getClientRects().length).length + [...ht.querySelectorAll('details.gkt-k > :not(summary)')].filter(e => e.getClientRects().length).length;
      out.over = ht.scrollWidth - ht.clientWidth; out.text = /낮|밤/.test(ht.querySelector('.gkt-b')?.textContent || '');
      out.label = pill[0].querySelector('summary')?.getAttribute('aria-label') || pill[0].getAttribute('aria-label') || pill[0].querySelector('[title]')?.title || '';
    } catch (e) { out.err = String(e).slice(0, 120); }
    ht.remove(); hl.remove(); hd.remove(); return out;
  };
  /** 색만 본 서명(마트 화면 안 미리보기용 — 움직임이 도는 중이라 색 · 바탕 · 테 색만) */
  const colors = (el) => { const root = el.querySelector('.gk'); return [root, ...root.querySelectorAll('*')].filter(e => e.tagName !== 'STYLE').flatMap(e => [null, '::before', '::after'].map(pe => { const c = getComputedStyle(e, pe); return pe && (c.content === 'none' || c.content === 'normal') ? '' : [c.color, c.backgroundColor, c.borderTopColor].join('|'); })); };
  return { mount, check, colors, diff };
})(); true`;
const good = o => !o.err && o.pills === 1 && o.roots === 1 && !o.same && o.shut === 0 && o.open === 0 && o.back === 0 && o.spacer === 0 && o.over <= 0 && !o.text;

async function allPart(vp, w) {
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.eval(HELPERS);
    const res = await b.eval(`(async()=>{
        const u = s => new URL('../' + s, location.href).href, martSrc = await (await fetch(u('mart.js'), { cache: 'no-store' })).text();
        const v = n => (martSrc.match(new RegExp(n.replace('.', '\\\\.') + '\\\\?v=(\\\\w+)')) || [])[1];
        const sf = await import(u('simple-frames.js') + '?v=' + v('simple-frames.js')), dn = await import(u('day-night.js') + '?v=' + v('day-night.js'));
        const idx = await (await fetch('../data/geulkku/index.json', { cache: 'no-store' })).json(), all = {};
        for (const c of Object.values(idx.chunks)) Object.assign(all, (await (await fetch('../data/geulkku/' + c.file)).json()).items);
        const shut = html => html.replace(/<details\\b[^>]*\\sdata-bl-peek=""[^>]*>/g, t => t.replace(/\\sopen(?:="[^"]*")?(?=[\\s>])/, '').replace(/\\sdata-bl-peek=""/, ''));
        const bad = [], adds = []; let n = 0;
        for (const it of idx.items) {
            const p = shut(all[it.id].preview), L = sf.simpleReady(sf.toneSimple(p, sf.ORIGINAL, { mode: 'light' })), D = sf.simpleReady(sf.toneSimple(p, sf.ORIGINAL, { mode: 'dark' }));
            let o; try { let T = dn.addToggle(L).html; if (${argv.includes('--strip')}) T = T.replace(/(<div class="gk )([^"]*)"/, (a, h, c) => h + c.split(' ').filter(x => !/^gk-(?:tl|td|tx|tn-d|tn-n)$/.test(x)).join(' ') + '"'); adds.push(new TextEncoder().encode(T).length - new TextEncoder().encode(L).length); o = window.__kk.check(T, L, D, ${w}); } catch (e) { o = { err: String(e).slice(0, 100) }; }
            n++; if (!(${good.toString()})(o)) bad.push(it.id + ' ' + JSON.stringify(o));
            if (n % 60 === 0) await new Promise(r => setTimeout(r, 0));
        }
        adds.sort((a, b) => a - b);
        return { n, bad, add: [adds[0], adds[adds.length >> 1], adds.at(-1)] };
    })()`, 900000);
    row(vp, `417틀 전부(폭 ${w}) — 깡통 꼴에서 닫힘 = 낮 판 · 열림 = 밤 판 · 다시 닫힘 = 낮 판(틀 안 모든 요소) · 해 · 달 단추 하나 · 빈 줄 숨김 · 넘침 0`, res.n === 417 && res.bad.length === 0, `틀 ${res.n} · 실패 ${res.bad.length} · 늘어난 바이트 ${res.add.join(' · ')}${res.bad.length ? ' · ' + res.bad.slice(0, 3).join(' / ') : ''}`);
    fs.writeFileSync(path.join(OUT, `${vp}-417-실패.json`), JSON.stringify(res.bad, null, 1));
}

// 실제 화면에서 복사: 저장 값을 깔고 크게 보기를 열어 「HTML 복사」(또는 「테마용 복사」)를 눌러 나온 글
async function copyOf(id, { tone = {}, motion = null, mine = null, tune = null, act = 'html' } = {}) {
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/kara/').catch(() => { }); await b.sleep(150);
    await b.eval(`(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('bl-mart-tone-v1',${J(J(tone))});${motion ? `localStorage.setItem('bl-mart-motion-v1',${J(J(motion))});` : ''}${mine ? `localStorage.setItem('bl-mart-mine-text-v1',${J(J(mine))});` : ''}${tune ? `sessionStorage.setItem('bl-mart-tune-v1',${J(J({ [id]: tune }))});` : ''}return true})()`);
    await b.goto(srv.url + 'mart/geulkku/?view=1#' + id); await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk') && document.querySelector('.mart-sheet[open] .mart-sheet-foot [data-act="html"]')`, 30000); await b.sleep(700);
    await b.eval(`(()=>{window.__copied=null;navigator.clipboard.write=async items=>{const bl=await items[0].getType('text/plain');window.__copied=await bl.text()};navigator.clipboard.writeText=async t=>{window.__copied=t};return true})()`);
    if (act === 'html') await b.eval(`document.querySelector('.mart-sheet[open] .mart-sheet-foot [data-act="html"]').click(); true`);
    else await b.eval(`(()=>{const x=document.querySelector('.mart-sheet[open] [data-act="${act}"]');if(x){x.click();return true}return false})()`);
    await b.until(`window.__copied !== null`, 15000).catch(() => { });
    return b.eval(`window.__copied`);
}
const COMBOS = [
    ['기본(원래 색 · 낮)', 'simple-k1', {}, {}],
    ['블라인드(details 안에 글)', 'simple-k8', {}, {}],
    ['소리 줄이 남은 틀', 'simple-k6', {}, {}],
    ['캐릭터 색(깡통 · 깡캐)', 'simple-k3', { on: true, k: '#8a5cf6', name: '보라', k2: '#22a06b', name2: '초록' }, {}],
    ['캐릭터 없음(무채)', 'simple-q06', { on: true, k: null, none: true }, {}],
    ['소품만 움직임', 'simple-k6', {}, { motion: { text: '0', prop: 'm' } }],
    ['내 글 넣은 판', 'simple-k1180', {}, { mine: { on: true, text: '나깡: 여기 있었네.\n벨포드: 찾았어?\n나깡: 응, 한참.\n\n둘은 한동안 말이 없었다.' } }],
    ['글 고치기(꾸민 낱말 + 빈칸)', 'simple-k1', {}, { tuneFn: 'text' }],
    ['눌러야 보이게(줄 숨김)', 'simple-k09', {}, { tuneFn: 'spoiler' }],
];
async function comboPart(vp, w) {
    for (const [name, id, tone, extra] of COMBOS) {
        let tune = null;
        if (extra.tuneFn) {
            await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000);
            tune = await b.eval(`(async()=>{const u=s=>new URL('../'+s,location.href).href,ms=await (await fetch(u('mart.js'),{cache:'no-store'})).text();const v=(ms.match(/tune\\.js\\?v=(\\w+)/)||[])[1];const tu=await import(u('tune.js')+'?v='+v);const idx=await (await fetch('../data/geulkku/index.json')).json();const it=idx.items.find(x=>x.id===${J(id)});const ch=(await (await fetch('../data/geulkku/'+idx.chunks[it.c].file)).json()).items;const e=tu.editables(ch[it.id].preview).find(x=>x.cls==='gk-nr');return ${extra.tuneFn === 'text' ? `{texts:{[e.i]:tu.cleanRich('<em>기울임</em>&nbsp;<strong>굵게</strong>&nbsp;<s>취소</s>')}}` : `{spoilers:[{i:e.i}]}`}})()`);
        }
        const o = { motion: extra.motion, mine: extra.mine, tune };
        const T = await copyOf(id, { ...o, tone: { ...tone, mode: 'light', flip: true } });
        const L = await copyOf(id, { ...o, tone: { ...tone, mode: 'light' } });
        const D = await copyOf(id, { ...o, tone: { ...tone, mode: 'dark' } });
        const N = await copyOf(id, { ...o, tone: { ...tone, mode: 'dark', flip: true } });   // 밤으로 시작한 판
        if (!T || !L || !D || !N) { row(vp, `조합 · ${name}`, false, `복사 글을 못 받았어요(${[T, L, D, N].map(x => (x ? x.length : 0)).join(' · ')})`); continue; }
        await b.eval(HELPERS);
        const r1 = await b.eval(`window.__kk.check(${J(T)}, ${J(L)}, ${J(D)}, ${w})`), r2 = await b.eval(`window.__kk.check(${J(N)}, ${J(D)}, ${J(L)}, ${w})`);
        const one = (T.match(/class="gkt gkt-/g) || []).length === 1 && !/class="gkt /.test(L) && (T.match(/<style\b/g) || []).length === 1;
        const marks = extra.tuneFn === 'text' ? T.includes('<em>기울임</em> <strong>굵게</strong> <s>취소</s>') : extra.tuneFn === 'spoiler' ? /data-bl-spoiler/.test(T) : extra.mine ? T.includes('여기 있었네.') : true;
        row(vp, `조합 · ${name}(${id}): 낮으로 시작 낮 → 밤 → 낮 · 밤으로 시작 밤 → 낮 → 밤 · 전환 뿌리 하나 · 넘침 0`, good(r1) && good(r2) && one && marks, `${J(r1)} / 밤 시작 ${J(r2)} · +${T.length - L.length}자`);
    }
    // 크게 보기: 켬끔 자리 · 미리보기의 해 · 달이 눌리는지 · 기억 · 테마용 복사 값에는 전환 0
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/kara/').catch(() => { }); await b.eval(`(()=>{localStorage.clear();sessionStorage.clear();return true})()`);
    await b.goto(srv.url + 'mart/geulkku/?view=1#simple-k3'); await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk') && document.querySelector('.mart-sheet[open] [data-tune-flip]')`, 30000); await b.sleep(700);
    const off = await b.eval(`(()=>{const c=document.querySelector('.mart-sheet[open] [data-tune-flip]'),row=c.closest('.mart-simple-seg, .mart-seg');const cs=[...row.children].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().top+e.getBoundingClientRect().height/2);const ys=new Set(cs.map(y=>Math.abs(y-cs[0])<3?0:Math.round(y)));return {pressed:c.getAttribute('aria-pressed'),label:c.getAttribute('aria-label'),text:c.textContent.trim(),pv:document.querySelectorAll('.mart-sheet[open] .mart-sheet-preview .gkt').length,oneLine:ys.size===1,saved:(JSON.parse(localStorage.getItem('bl-mart-tone-v1')||'{}')).flip===true}})()`);
    row(vp, '크게 보기 「밝기」 줄 옆 켬끔 「전환 넣기」: 기본 끔 · 한 줄 · 꺼져 있으면 미리보기에 해 · 달 없음', off.pressed === 'false' && off.label === '낮 · 밤 전환 넣기' && off.pv === 0 && off.oneLine && !off.saved, J(off));
    await b.shot(path.join(OUT, `${vp}-1-켬끔-끔.png`));
    await b.eval(`document.querySelector('.mart-sheet[open] [data-tune-flip]').click(); true`); await b.sleep(900);
    const on = await b.eval(`(()=>{const c=document.querySelector('.mart-sheet[open] [data-tune-flip]'),pv=document.querySelector('.mart-sheet[open] .mart-sheet-preview'),g=pv.querySelector('.gk'),note=c.closest('.mart-simple-row, .mart-tune-line')?.querySelector('.mart-flip-note');const bg0=getComputedStyle(g).backgroundColor;const bar=document.querySelector('.mart-sheet[open] .mart-sheet-pvbar'),pb=v=>bar.querySelector('[data-flip-pill="'+v+'"]'),inRow=pv.querySelector('.gkt-b');const shown=!bar.querySelector('[data-pv-pill]').hidden&&pb('light').getClientRects().length>0&&pb('light').getAttribute('aria-pressed')==='true'&&inRow.getClientRects().length===0;pb('dark').click();const bg1=getComputedStyle(g).backgroundColor,p1=pb('dark').getAttribute('aria-pressed');pb('light').click();const bg2=getComputedStyle(g).backgroundColor;return {pressed:c.getAttribute('aria-pressed'),shown,p1,pills:pv.querySelectorAll('details.gkt-k').length,bg0,bg1,bg2,note:note?.textContent||'',noteOn:!!note&&!note.hidden,saved:(JSON.parse(localStorage.getItem('bl-mart-tone-v1')||'{}')).flip===true,over:document.documentElement.scrollWidth-innerWidth}})()`);
    row(vp, '켜면: 미리보기 위 줄 오른쪽에 해 · 달이 보이고(틀 안 단추 줄은 숨김) 누르면 낮 → 밤 → 낮 · 「복사 글 +N KB」 한 줄 · 기억', on.pressed === 'true' && on.shown && on.p1 === 'true' && on.pills === 1 && on.bg0 !== on.bg1 && on.bg0 === on.bg2 && /^복사 글 \+\d+(\.\d)?KB\(모두 \d+(\.\d)?KB\)$/.test(on.note) && on.noteOn && on.saved && on.over <= 0, J(on));
    await b.eval(`document.querySelector('.mart-sheet[open] .mart-sheet-pvbar').scrollIntoView({block:'start'}); true`); await b.sleep(400);
    await b.shot(path.join(OUT, `${vp}-2-켠-미리보기-낮.png`));
    await b.eval(`document.querySelector('.mart-sheet[open] .mart-sheet-pvbar [data-flip-pill="dark"]').click(); true`); await b.sleep(500);
    await b.shot(path.join(OUT, `${vp}-3-켠-미리보기-밤.png`));
    // 마트 화면 안 미리보기(목록 카드의 규칙과 한 문서에 섞여 있어요): 해 · 달로 바꾼 밤 = 밝기 단추로 고른 밤과 색이 같은지 — 첫 심플 틀은 글자색 규칙이 틀 열쇠 없이 시작해요
    for (const id of ['simple-k1', 'simple-k2', 'simple-k4', 'simple-k8', 'simple-q06', 'simple-k1180']) {
        await b.goto('about:blank'); await b.goto(srv.url + 'mart/kara/').catch(() => { }); await b.eval(`(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('bl-mart-tone-v1',${J(J({ mode: 'light', flip: true }))});return true})()`);
        await b.goto(srv.url + 'mart/geulkku/?view=1#' + id); await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview details.gkt-k')`, 30000); await b.eval(HELPERS); await b.sleep(1800);
        const r = await b.eval(`(async()=>{const pv=()=>document.querySelector('.mart-sheet[open] .mart-sheet-preview');const day=window.__kk.colors(pv());pv().querySelector('details.gkt-k').open=true;await new Promise(r=>setTimeout(r,500));const night=window.__kk.colors(pv());
            document.querySelector('.mart-sheet[open] [data-tune-flip]').click();await new Promise(r=>setTimeout(r,500));const plainDay=window.__kk.colors(pv());
            document.querySelector('.mart-sheet[open] [data-tune-mode="dark"]').click();await new Promise(r=>setTimeout(r,2200));const plainNight=window.__kk.colors(pv());
            return {day:window.__kk.diff(day,plainDay),night:window.__kk.diff(night,plainNight),differs:window.__kk.diff(plainDay,plainNight)}})()`);
        row(vp, `마트 미리보기 · ${id}: 해 · 달로 바꾼 낮 · 밤의 색 = 밝기 단추로 고른 낮 · 밤`, r.day === 0 && r.night === 0 && r.differs > 0, J(r));
    }
    // 다시 열어도 켜져 있고 · 세밀 색 갈래에도 같은 켬끔 · 테마용 복사 값에는 전환 0
    const T = await copyOf('simple-k3', { tone: { mode: 'light', flip: true } });
    const again = await b.eval(`({pressed:document.querySelector('.mart-sheet[open] [data-tune-flip]')?.getAttribute('aria-pressed'),pv:document.querySelectorAll('.mart-sheet[open] .mart-sheet-preview details.gkt-k').length})`);
    const pack = await copyOf('simple-k3', { tone: { mode: 'light', flip: true }, act: 'theme-copy' });
    row(vp, '다시 열어도 켜진 채 · 복사 글에 전환 뿌리 하나 · 「테마용 복사」 값에는 전환 0', again.pressed === 'true' && again.pv === 1 && (T.match(/class="gkt gkt-/g) || []).length === 1 && !!pack && /"bl-mart":1/.test(pack) && !/gkt-/.test(pack), `복사 ${T.length}자 · 꾸러미 ${pack ? pack.length : 0}자 · gkt ${pack ? (pack.match(/gkt-/g) || []).length : '?'}`);
    // 깡통 흉내에서 전환 사진
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.eval(HELPERS);
    for (const [k, open] of [['낮', false], ['밤', true]]) {
        await b.eval(`(()=>{document.querySelector('.tg-shot')?.remove();const h=window.__kk.mount(${J(T)}, Math.min(innerWidth, 640));h.outer.classList.add('tg-shot');h.outer.style.cssText+=';position:fixed;z-index:2147483647;padding:16px;box-sizing:border-box;max-height:100vh;overflow:auto';for(const d of h.querySelectorAll('.gk details'))d.open=true;h.querySelector('details.gkt-k').open=${open};return true})()`); await b.sleep(500);
        await b.shot(path.join(OUT, `${vp}-4-깡통-흉내-${k}.png`));
    }
}

try {
    for (const [vp, w, h, mobile, dpr, hw] of [['pc', 1280, 900, false, 1, 640], ['phone', 375, 812, true, 2, 343]].filter(v => !opt('--vp') || opt('--vp').split(',').includes(v[0]))) {
        await b.size(w, h, mobile, dpr);
        if (!ONLY || ONLY.includes('all')) { await allPart(vp, hw); if (vp === 'phone') await allPart('phone320', 288); }
        if (!ONLY || ONLY.includes('combo')) await comboPart(vp, hw);
    }
    const errs = b.errors.filter(e => !/favicon|mp3|ERR_ABORTED|net::|kara/.test(e));
    row('-', '콘솔 오류 0', !errs.length, errs.slice(0, 3).join(' / ') || '0');
} catch (e) { row('-', '대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
