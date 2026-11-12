#!/usr/bin/env node
// 11-12 밤 PC 가로 넘김 줄 — 실제 휠 입력(CDP mouseWheel · Shift 없음)으로 줄이 옆으로 넘어가는지 · 끝에서는 페이지(창)가 내려가는지 재요.
//   글꾸 마트 목록(분류 칩) · 크게 보기(스타일 카드 줄 · 그 밖의 .mart-hscroll) · 액자 마트 목록(묶음 · 칩 · 표본 사진 줄) · 홈(주제 탭) — 화면에 보이고 가로로 넘치는 줄 전부.
//   node tools/site-rig/hwheel-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--port 18993 --cdp 19469]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18993)));
const b = await launch(path.join(HERE, 'out', '_hwheel-prof'), Number(opt('--cdp', 19469)));
const rows = [], row = (page, op, ok, actual) => rows.push({ page, op, ok: !!ok, actual: String(actual).slice(0, 260) });
const wheel = async (x, y, dy) => { await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); await b.sleep(180); };
// 화면에 보이는 가로 넘침 줄을 찾아 번호표(data-hw)를 달아요 — 세로로도 넘치는 칸 · 딱 멈추는 넘김(scroll-snap) · 글꾸 틀 안은 빼요
const MARK = `(()=>{let n=0;const out=[];for(const el of document.querySelectorAll('body *')){const cs=getComputedStyle(el);if(!/auto|scroll/.test(cs.overflowX)||el.scrollWidth<=el.clientWidth+1)continue;const r=el.getBoundingClientRect();if(r.width<40||r.height<8||!el.checkVisibility())continue;const snap=cs.scrollSnapType!=='none',gk=!!el.closest('.gk'),yscroll=/auto|scroll/.test(cs.overflowY)&&el.scrollHeight>el.clientHeight+1;el.dataset.hw=String(n);out.push({n:n++,name:(el.className&&String(el.className).split(' ').slice(0,3).join('.'))||el.tagName,snap,gk,yscroll});}return out})()`;
const pageY = `(()=>{const d=document.querySelector('dialog[open] .mart-sheet-body');return Math.round((d?d.scrollTop:0)+scrollY)})()`;
async function sweep(page) {
    const list = await b.eval(MARK);
    row(page, '가로 넘침 줄 찾기(없으면 그 화면은 넘기는 줄이 없는 폭)', true, list.map(x => x.name + (x.snap ? '(딱 멈춤 — 뺌)' : x.gk ? '(틀 안 — 뺌)' : x.yscroll ? '(세로도 — 뺌)' : '')).join(' · ') || '없음');
    for (const it of list) {
        if (it.snap || it.gk || it.yscroll) continue;
        const sel = `[data-hw="${it.n}"]`;
        await b.eval(`document.querySelector('${sel}').scrollIntoView({block:'center'}); document.querySelector('${sel}').scrollLeft=0; true`); await b.sleep(250);
        const p = await b.eval(`(()=>{const e=document.querySelector('${sel}');const r=e.getBoundingClientRect();const x=Math.round(r.left+Math.min(r.width/2,200)),y=Math.round(r.top+r.height/2);const t=document.elementFromPoint(x,y);return {x,y,hit:!!t&&(t===e||e.contains(t)),max:e.scrollWidth-e.clientWidth}})()`);
        if (!p.hit) { row(page, `${it.name} 휠`, true, '다른 것에 가려 건너뜀(화면에 안 닿는 줄)'); continue; }
        const y0 = await b.eval(pageY);
        await wheel(p.x, p.y, 120);
        const a = await b.eval(`document.querySelector('${sel}').scrollLeft`), y1 = await b.eval(pageY);
        row(page, `${it.name}: 세로 휠 → 옆으로`, a > 0 && y1 === y0, `scrollLeft 0 → ${Math.round(a)}(넘침 ${p.max}) · 페이지 ${y0} → ${y1}`);
        // 끝까지 보낸 뒤 한 번 더 → 페이지(창)가 내려가요
        await b.eval(`(()=>{const e=document.querySelector('${sel}');e.scrollLeft=e.scrollWidth;return true})()`); await b.sleep(150);
        const p2 = await b.eval(`(()=>{const e=document.querySelector('${sel}');const r=e.getBoundingClientRect();return {x:Math.round(r.left+Math.min(r.width/2,200)),y:Math.round(r.top+r.height/2)}})()`);
        const room = await b.eval(`(()=>{const d=document.querySelector('dialog[open] .mart-sheet-body');return d?d.scrollHeight-d.clientHeight-d.scrollTop>4:document.documentElement.scrollHeight-innerHeight-scrollY>4})()`);
        const y2 = await b.eval(pageY); await wheel(p2.x, p2.y, 120); await b.sleep(250); const y3 = await b.eval(pageY);
        row(page, `${it.name}: 줄 끝에서는 페이지가 내려감`, !room || y3 > y2, room ? `페이지 ${y2} → ${y3}` : '아래로 더 내릴 곳 없음(건너뜀)');
        // 되감기(위로 휠) → 왼쪽으로
        await wheel(p2.x, p2.y, -120); await wheel(p2.x, p2.y, -120);
        const back = await b.eval(`document.querySelector('${sel}').scrollLeft`);
        row(page, `${it.name}: 위로 휠 → 왼쪽으로`, back < p.max, `scrollLeft ${p.max} → ${Math.round(back)}`);
    }
}
try {
    await b.size(1280, 900, false, 1);
    await b.goto(srv.url + 'mart/geulkku/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.sleep(800);
    await sweep('글꾸 마트 목록');
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/?view=1#simple-k2');
    await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk') && document.querySelector('.mart-sheet[open] [data-simple-style]')`, 30000); await b.sleep(800);
    await sweep('글꾸 크게 보기(간편)');
    await b.shot(path.join(OUT, 'pc-크게보기-휠.png'));
    await b.eval(`document.querySelector('.mart-sheet [data-view="detail"]')?.click(); true`); await b.sleep(700);
    await sweep('글꾸 크게 보기(세밀)');
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/frames/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.sleep(800);
    await sweep('액자 마트 목록');
    await b.goto('about:blank'); await b.goto(srv.url); await b.sleep(1500);
    await sweep('홈');
    // Shift+휠 · 가로 휠은 그대로(우리 처리가 끼어들지 않아요) — 글꾸 목록 칩 줄에서 한 번
    const errs = b.errors.filter(e => !/favicon|mp3|ERR_ABORTED|net::/.test(e));
    row('전체', '콘솔 오류 0', !errs.length, errs.slice(0, 3).join(' / ') || '0');
} catch (e) { row('전체', '대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(OUT, '결과.md'), ['| 화면 | 조작 | 실제 | 결과 |', '|---|---|---|---|', ...rows.map(r => `| ${r.page} | ${r.op} | ${r.actual.replace(/\|/g, '/')} | ${r.ok ? '통과' : '**실패**'} |`)].join('\n'));
const bad = rows.filter(r => !r.ok);
console.log(`조작 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of bad) console.log(`실패  ${r.page} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
