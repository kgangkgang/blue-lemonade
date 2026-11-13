#!/usr/bin/env node
// 11-12 밤 액자 마트 고침 확인(전수조사 고침 안 3 · 4 · 5) — 실제로 눌러요(PC 1280 · 폰 375)
//   이름 하나로(라파엘 · 무협시뮬 · D&H · 옛 이름으로도 찾아짐) · 개수 한 줄 · 심플에서 방향/디자인 숨김 · 표본 사진일 때 「기억」 숨김 · 담기 알림 · 빈 결과 「거르기 풀기」
//   · 장바구니: 계산한 뒤에도 그대로 + 「복사했어요 ✓」 · 비우기 → 「↶ 되살리기」
//   node tools/site-rig/frames-fix-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--port 18993 --cdp 19475]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18993)));
const b = await launch(path.join(HERE, 'out', '_framesfix-prof'), Number(opt('--cdp', 19475)));
const rows = [], row = (vp, op, ok, actual) => rows.push({ vp, op, ok: !!ok, actual: String(actual).slice(0, 320) });
const J = JSON.stringify, over = () => b.eval(`document.documentElement.scrollWidth - innerWidth`);
const count = () => b.eval(`parseInt(document.querySelector('.mart-count')?.textContent)||0`);
const find = async (q) => { await b.eval(`(()=>{const i=document.querySelector('.mart-tools input[type=search]');i.value=${J(q)};i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await b.sleep(700); };
const names = () => b.eval(`[...document.querySelectorAll('.mart-grid .mart-card .mart-title .t')].map(e=>e.textContent)`);
const tap = async (vp, what, sel, o) => { const t = await b.tap(sel, o); if (t !== true) row(vp, `누르기: ${what}`, false, t); await b.sleep(450); return t === true; };
try {
    await b.send('Browser.grantPermissions', { origin: new URL(srv.url).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => { });
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2]]) {
        await b.size(w, h, mobile, dpr);
        await b.goto('about:blank'); await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { });
        await b.goto(srv.url + 'mart/frames/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.sleep(600);
        // 개수 한 줄: 목록 바로 위 · 화면 안
        const c = await b.eval(`(()=>{const e=document.querySelector('.mart-count'),r=e.getBoundingClientRect(),g=document.querySelector('.mart-grid');return {text:e.textContent,in:r.left>=0&&r.right<=innerWidth+1&&r.width>0,above:e.nextElementSibling===g||!!(e.compareDocumentPosition(g)&4)}})()`);
        row(vp, '개수가 목록 바로 위 한 줄 · 화면 안(1854개)', c.text === '1854개' && c.in && c.above, J(c));
        // 표본 사진일 때 「이 기기에 기억」 숨김
        row(vp, '표본 사진일 때 「이 기기에 기억」은 안 보여요', !(await b.eval(`document.querySelector('.mart-tryon-keep').checkVisibility()`)), '');
        // 이름 하나로
        await find('라파엘'); const n1 = await count(), a1 = await names();
        await find('세라프'); const n2 = await count();
        row(vp, '「라파엘」 12장 · 옛 이름 「세라프」로도 12장 · 보이는 이름에 세라프 0', n1 === 12 && n2 === 12 && a1.length && a1.every(t => /라파엘/.test(t) && !/세라프/.test(t)), `라파엘 ${n1} · 세라프 ${n2} · ${a1[0]}`);
        await find('무협시뮬'); const n3 = await count(), a3 = await names(), tags3 = await b.eval(`[...new Set([...document.querySelectorAll('.mart-grid .mart-card .mart-tag')].map(e=>e.textContent.trim()))]`);
        await find('강호유람록'); const n4 = await count();
        row(vp, '「무협시뮬」 84장 · 옛 이름 「강호유람록」으로도 84장 · 카드 이름 · 꼬리표에 강호유람록 0', n3 === 84 && n4 === 84 && a3.every(t => !/강호유람록/.test(t)) && tags3.every(t => !/강호유람록/.test(t)), `무협시뮬 ${n3} · 강호유람록 ${n4} · ${a3[0]} · ${tags3.join('/')}`);
        await find('D&H'); const n5 = await count(), a5 = await names();
        await find('헌시뮬'); const n6 = await count();
        row(vp, '「D&H」 12장 · 옛 이름 「헌시뮬」로도 12장 · 원작 제목은 sources.js 그대로', n5 === 12 && n6 === 12 && a5.every(t => /^D&H/.test(t)) && (await b.eval(`[...document.querySelectorAll('.mart-grid .mart-card a.mart-source')].every(a=>/Dungeons & Hunters」/.test(a.textContent))`)), `D&H ${n5} · 헌시뮬 ${n6} · ${a5[0]}`);
        // 빈 결과 → 거르기 풀기
        await find('없는말zzz');
        const empty = await b.eval(`document.querySelector('.mart-empty')?.textContent.replace(/\\s+/g,' ').trim()`);
        await tap(vp, '거르기 풀기', '.mart-empty [data-act="clear-filters"]');
        row(vp, '빈 결과에 「거르기 풀기」 단추 → 전부(1854개)', /거르기 풀기/.test(empty || '') && (await count()) === 1854, `${empty} → ${await count()}개`);
        // 심플 묶음: 방향 · 디자인 숨김
        await b.eval(`scrollTo(0,0); document.querySelector('.mart-groups [data-group="simple"]').click(); true`); await b.sleep(500);
        const simple = await b.eval(`({n:parseInt(document.querySelector('.mart-count').textContent),segs:[...document.querySelectorAll('[data-filter="orient"], [data-filter="style"]')].filter(e=>e.checkVisibility()).length})`);
        await b.eval(`document.querySelector('.mart-groups [data-group="art"]').click(); true`); await b.sleep(500);
        const art = await b.eval(`[...document.querySelectorAll('[data-filter="orient"], [data-filter="style"]')].filter(e=>e.checkVisibility()).length`);
        row(vp, '「심플 · 내장」에서는 방향 · 디자인 칸이 숨어요(30개) · 그림 액자로 돌아오면 다시 보여요', simple.n === 30 && simple.segs === 0 && art === 2, `심플 ${simple.n}개 · 보이는 칸 ${simple.segs} → ${art}`);
        await b.eval(`document.querySelector('.mart-groups [data-group="all"]').click(); true`); await b.sleep(400);
        row(vp, '목록 가로 넘침 0', (await over()) <= 0, `넘침 ${await over()}`);
        await b.shot(path.join(OUT, `${vp}-1-목록.png`));
        // 담기 알림 · 장바구니
        await find('은설');
        await b.eval(`[...document.querySelectorAll('.mart-card .mart-pick')].slice(0,2).forEach(p=>p.click()); true`); await b.sleep(500);
        const said = await b.eval(`document.querySelector('.mart-cart-bubble')?.textContent`);
        row(vp, '담으면 알림 「담았어요 · 장바구니 N개」', /담았어요 · 장바구니 2개/.test(said || ''), said);
        await tap(vp, '장바구니', '.mart-cart-btn'); await b.sleep(600);
        await tap(vp, '계산하기', '.mart-cart-pay'); await b.sleep(2500);
        const paid = await b.eval(`({n:document.querySelectorAll('.mart-cart-list li').length,got:document.querySelector('[data-cart-got]')?.textContent,gotOn:document.querySelector('[data-cart-got]')?.checkVisibility(),open:document.querySelector('.mart-cart')?.classList.contains('open'),said:document.querySelector('.mart-cart-bubble')?.textContent})`);
        row(vp, '「계산하기」 뒤에도 담긴 것 그대로 + 「복사했어요 ✓」', paid.n === 2 && paid.gotOn && /복사했어요/.test(paid.got || ''), J(paid));
        await b.shot(path.join(OUT, `${vp}-2-계산한-뒤.png`));
        await tap(vp, '비우기', '.mart-cart-clear'); await b.sleep(500);
        const cleared = await b.eval(`({n:document.querySelectorAll('.mart-cart-list li').length,undo:document.querySelector('[data-cart="undo"]')?.checkVisibility(),said:document.querySelector('.mart-cart-bubble')?.textContent})`);
        await b.shot(path.join(OUT, `${vp}-3-비운-뒤.png`));
        await tap(vp, '되살리기', '.mart-cart [data-cart="undo"]'); await b.sleep(600);
        const back = await b.eval(`({n:document.querySelectorAll('.mart-cart-list li').length,undo:document.querySelector('[data-cart="undo"]')?.checkVisibility(),src:document.querySelectorAll('.mart-cart-list .mart-cart-src a').length})`);
        row(vp, '「비우기」 → 「↶ 되살리기」로 되돌려요(원작 줄도 그대로)', cleared.n === 0 && cleared.undo && back.n === 2 && !back.undo && back.src >= 2, `비운 뒤 ${J(cleared)} → ${J(back)}`);
        row(vp, '장바구니 가로 넘침 0', (await over()) <= 0, `넘침 ${await over()}`);
        await b.eval(`document.querySelector('.mart-cart-x')?.click(); true`);
    }
    const errs = b.errors.filter(e => !/favicon|mp3|ERR_ABORTED|net::/.test(e));
    row('-', '콘솔 오류 0', !errs.length, errs.slice(0, 3).join(' / ') || '0');
} catch (e) { row('-', '대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
