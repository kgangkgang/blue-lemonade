#!/usr/bin/env node
// 11-12 글꾸 마트 「글 고치기」 편집 모드 확인 + 사진(PC 1280 · 폰 375)
//   크게 보기에서 글 고치기 켬 → 점선 블록 수 = 칸 수 · 소품 「전 · 후」 → 전에서 제목 · 후에서 소품 글자를 그 자리에서 고침(실제 마우스 · 자판)
//   → 미리보기 · HTML 복사 · 테마로 담기에 고친 글 · 복사 글에 테두리 흔적(data-bl-ed · contenteditable · bl-eb) 없음 · 칸 단위 되돌리기 · 다시하기 · 끄면 원래 동작 · 다시 열어도 남음
//   node tools/site-rig/edit-mode-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--tpl simple-k2,simple-k1180,…]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const TPLS = opt('--tpl', 'simple-k2,simple-k1180,simple-k1441,simple-k1103,simple-k1216').split(',');
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18991)));
const b = await launch(path.join(HERE, 'out', '_edit-prof'), Number(opt('--cdp', 19467)));
const J = JSON.stringify, rows = [];
const row = (tpl, vp, op, ok, actual) => rows.push({ tpl, vp, op, ok: !!ok, actual: String(actual).slice(0, 200) });
const HOOK = `window.__copied=null; try { navigator.clipboard.write = async (items) => { const x = await items[0].getType('text/plain'); window.__copied = await x.text(); }; navigator.clipboard.writeText = async (t) => { window.__copied = t; }; } catch {} true`;
const copy = async (act = 'html') => { await b.eval(HOOK); await b.eval(`document.querySelector('.mart-sheet[open] [data-act="${act}"]')?.click(); true`); await b.until('window.__copied', 15000).catch(() => { }); return b.eval('window.__copied'); };
const tapSel = async (sel) => { const r = await b.tap(sel); await b.sleep(350); return r; };
/** 단추: 실제 마우스로 누르고, 눌림(aria-pressed)이 안 바뀌면 화면에 가려 빗나간 것 — 요소를 직접 눌러요(폰은 붙박이 미리보기가 단추를 덮기도 해요) */
const press = async (sel) => { const before = await b.eval(`document.querySelector(${JSON.stringify(sel)})?.getAttribute('aria-pressed')`); await tapSel(sel); const after = await b.eval(`document.querySelector(${JSON.stringify(sel)})?.getAttribute('aria-pressed')`); if (before != null && before === after) { await b.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); true`); await b.sleep(350); return 'click'; } return 'tap'; };
/** 칸: 실제 마우스로 누르고, 초점이 안 왔으면 focus() */
const focusCell = async (sel) => { await tapSel(sel); const ok = await b.eval(`document.activeElement === document.querySelector(${JSON.stringify(sel)})`); if (!ok) await b.eval(`document.querySelector(${JSON.stringify(sel)})?.focus(); true`); return ok ? 'tap' : 'focus'; };
async function open(id) {
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/?view=1#' + id);   // 새로 읽기(다시 열었을 때 기억도 이 길로 재요)
    await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk') && document.querySelector('.mart-sheet[open] [data-tune-edit]')`, 30000); await b.sleep(600);
}
try {
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2]]) {
        await b.size(w, h, mobile, dpr);
        await b.goto('about:blank'); await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { });
        for (const id of TPLS) {
            await open(id);
            const base = await copy();
            await press('.mart-sheet [data-tune-edit]');
            const st = await b.eval(`(()=>{const pv=document.querySelector('.mart-sheet-preview');const cells=[...pv.querySelectorAll('.gk [data-bl-ed]')];return {on:pv.classList.contains('bl-eb-on'), cells:cells.length, ce:cells.filter(c=>c.isContentEditable).length, outline:cells.length?getComputedStyle(cells[0]).outlineStyle:'', steps:[...pv.querySelectorAll('[data-bl-step]')].map(x=>x.textContent)}})()`);
            row(id, vp, '글 고치기 켬: 점선 블록', st.on && st.cells > 0 && st.ce === st.cells && st.outline === 'dashed', `칸 ${st.cells} · 고칠 수 있음 ${st.ce} · 테두리 ${st.outline} · 단계 ${st.steps.join('/')}`);
            await b.shot(path.join(OUT, `${vp}-${id}-1-켬.png`));
            // 전: 첫 덧칸(소품 글자) 또는 제목을 고쳐요
            const stepN = st.steps.length;
            for (let k = 0; k < Math.max(1, stepN); k++) {
                if (stepN) await press(`.mart-sheet-preview [data-bl-step="${k}"]`);
                const pick = await b.eval(`(()=>{document.querySelectorAll('[data-pick]').forEach(e=>e.removeAttribute('data-pick'));const cells=[...document.querySelectorAll('.mart-sheet-preview .gk [data-bl-ed]')].filter(c=>c.checkVisibility({opacityProperty:true,visibilityProperty:true})&&c.getBoundingClientRect().width>2&&!c.textContent.includes('고침'));const prop=cells.filter(c=>!c.matches('.gk-nr,.gk-nm,.gk-d,.gk-sn,em,strong,s'));const c=prop[prop.length-1]||cells[0];if(!c)return null;c.setAttribute('data-pick','1');return {i:c.dataset.blEd, text:c.textContent.trim().slice(0,20)}})()`);
                if (!pick) { row(id, vp, `단계 ${k} 고칠 칸`, false, '보이는 칸 없음'); continue; }
                const how = await focusCell('.mart-sheet-preview [data-pick="1"]');
                await b.eval(`(()=>{const c=document.querySelector('.mart-sheet-preview [data-pick="1"]');const r=document.createRange();r.selectNodeContents(c);const s=getSelection();s.removeAllRanges();s.addRange(r);return true})()`);
                const word = `고침${vp}${k}`;
                await b.send('Input.insertText', { text: word }); await b.sleep(250);
                if (k === 0) await b.shot(path.join(OUT, `${vp}-${id}-2-고치는중.png`));
                await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await b.sleep(400);
                const after = await b.eval(`document.querySelector('.mart-sheet-preview [data-bl-ed="${pick.i}"]')?.textContent || ''`);
                row(id, vp, `단계 ${st.steps[k] || '-'} 칸 ${pick.i}(${pick.text}) 고치기`, after.includes(word), `${after} · ${how}`);
            }
            // 되돌리기 · 다시하기(칸 단위)
            const lastWord = `고침${vp}${Math.max(1, stepN) - 1}`;
            const histBtn = async h => { const hit = await b.eval(`(()=>{const e=document.querySelector('.mart-sheet [data-hist="${h}"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return t===e||e.contains(t)})()`); if (hit) await tapSel(`.mart-sheet [data-hist="${h}"]`); else { await b.eval(`document.querySelector('.mart-sheet [data-hist="${h}"]').click(); true`); await b.sleep(350); } };   // 폰은 붙박이 미리보기가 단추를 덮기도 해요
            await histBtn('undo');
            const undone = await b.eval(`document.querySelector('.mart-sheet-preview .gk')?.textContent.includes(${J(lastWord)})`);
            await histBtn('redo');
            const redone = await b.eval(`document.querySelector('.mart-sheet-preview .gk')?.textContent.includes(${J(lastWord)})`);
            row(id, vp, '칸 단위 되돌리기 · 다시하기', !undone && redone, `되돌린 뒤 ${undone ? '남음' : '빠짐'} · 다시한 뒤 ${redone ? '들어감' : '빠짐'}`);
            await b.shot(path.join(OUT, `${vp}-${id}-3-후.png`));
            // 끄기
            await press('.mart-sheet [data-tune-edit]');
            const off = await b.eval(`(()=>{const pv=document.querySelector('.mart-sheet-preview');return {on:pv.classList.contains('bl-eb-on'), ce:pv.querySelectorAll('[contenteditable]').length, bar:!!pv.querySelector('.bl-eb-steps'), frozen:!!pv.querySelector('.bl-eb-freeze')}})()`);
            row(id, vp, '끄면 원래대로', !off.on && !off.ce && !off.bar && !off.frozen, J(off));
            const c1 = await copy();
            const words = Array.from({ length: Math.max(1, stepN) }, (_, k) => `고침${vp}${k}`);
            row(id, vp, 'HTML 복사에 고친 글 · 흔적 없음', c1 && words.every(x => c1.includes(x)) && !/data-bl-ed|contenteditable|bl-eb-|data-pick/.test(c1) && c1 !== base, `${words.filter(x => c1?.includes(x)).length}/${words.length} 들어감 · 흔적 ${/data-bl-ed|contenteditable|bl-eb-|data-pick/.test(c1 || '') ? '있음' : '없음'}`);
            const tc = await copy('theme-copy');
            row(id, vp, '테마로 담기에 고친 글', tc == null || words.every(x => tc.includes(x)) || /BLG|blGeulkku/.test(tc), tc == null ? '단추 없음(테마 못 받는 틀)' : `${words.filter(x => tc.includes(x)).length}/${words.length}`);
            await open(id);
            const kept = await b.eval(`document.querySelector('.mart-sheet-preview .gk')?.innerHTML || ''`);
            row(id, vp, '다시 열어도 남음', words.every(x => kept.includes(x)), `${words.filter(x => kept.includes(x)).length}/${words.length}`);
        }
    }
    const errs = b.errors.filter(e => !/favicon|mp3|ERR_ABORTED|net::/.test(e));
    row('전체', '-', '콘솔 오류 0', !errs.length, errs.slice(0, 3).join(' / ') || '0');
} catch (e) { row('전체', '-', '대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); await srv.close(); }
fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(OUT, '결과.md'), ['| 틀 | 화면 | 조작 | 실제 | 결과 |', '|---|---|---|---|---|', ...rows.map(r => `| ${r.tpl} | ${r.vp} | ${r.op} | ${r.actual.replace(/\|/g, '/')} | ${r.ok ? '통과' : '**실패**'} |`)].join('\n'));
const bad = rows.filter(r => !r.ok);
console.log(`조작 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of bad) console.log(`실패  ${r.tpl} ${r.vp} ${r.op} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
