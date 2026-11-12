#!/usr/bin/env node
// 11-12 밤 분류 · 세계관 · 카드 원작 화면 확인(실제 누르기 · PC 1280 · 폰 375 · 낮/밤 · 가로 넘침 0)
//   node tools/site-rig/topic-check.mjs <사이트 폴더 | 주소> <결과 폴더> [--port 18996 --cdp 19472] [--only card]
//   ① 카드 원작 줄 · 「HTML 복사로 써요」 0 · 「원작」 칸(목록 아래 · 펼친 채 · 열 글) ② 분류 탭 · 하위 칩 · 누름 방식 ③ 세계관 머리 띠 · 인물 칩 ④ 캐릭터 칸(한 번에 한 묶음)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [SRC, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const ONLY = opt('--only', '');
fs.mkdirSync(OUT, { recursive: true });
const live = /^https?:/.test(SRC), srv = live ? { url: SRC.replace(/\/?$/, '/'), close: async () => { } } : await serve(path.resolve(SRC), Number(opt('--port', 18996)));
const b = await launch(path.join(HERE, 'out', '_topic-prof'), Number(opt('--cdp', 19472)));
const rows = [], row = (vp, op, ok, actual) => rows.push({ vp, op, ok: !!ok, actual: String(actual).slice(0, 320) });
const TEN = [54677, 5150, 78795, 78569, 127563, 155899, 81234, 29037, 99019, 43794];
const over = () => b.eval(`document.documentElement.scrollWidth - innerWidth`);
const J = JSON.stringify;
const tapOk = async (vp, what, sel, o) => { const t = await b.tap(sel, o); if (t !== true) row(vp, `누르기: ${what}`, false, t); await b.sleep(450); return t === true; };
const cardsNow = () => b.eval(`[...document.querySelectorAll('.mart-grid .mart-card')].map(c=>c.dataset.id)`);
const fresh = async (hash = '') => { await b.goto('about:blank'); await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { }); await b.goto(srv.url + 'mart/geulkku/' + hash); await b.until(`document.querySelectorAll('.mart-card').length > 3 && document.querySelector('.mart-credits a.mart-source')`, 30000); await b.sleep(600); };
const find = async (q) => { await b.eval(`(()=>{const i=document.querySelector('.mart-tools input[type=search]');i.value=${J(q)};i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await b.sleep(500); };

async function cardPart(vp) {
    await fresh();
    // 「HTML 복사로 써요」 0개 · 단추는 그대로
    const word = await b.eval(`({old:[...document.querySelectorAll('.mart-card *')].filter(e=>!e.children.length&&e.textContent.trim()==='HTML 복사로 써요').length, btn:document.querySelectorAll('.mart-card [data-act="html"]').length, cards:document.querySelectorAll('.mart-card').length})`);
    row(vp, '카드 「HTML 복사로 써요」 0개 · 단추 「HTML 복사」는 카드마다', word.old === 0 && word.btn === word.cards && word.cards > 3, J(word));
    // 「원작」 칸: 목록 아래 · 펼친 채 · 열 글
    const cr = await b.eval(`(()=>{const c=document.querySelector('.mart-credits'),g=document.querySelector('.mart-grid'),h=document.querySelector('.mart-howto');return {after:!!(g.compareDocumentPosition(c)&4),before:!!(c.compareDocumentPosition(h)&4),open:c.checkVisibility()&&c.querySelectorAll('a.mart-source').length&&[...c.querySelectorAll('a.mart-source')].every(a=>a.checkVisibility()),links:[...c.querySelectorAll('a.mart-source')].map(a=>a.href),text:c.querySelector('p')?.textContent||''}})()`);
    row(vp, '「원작」 칸: 목록 아래 · 쓰는 법 위 · 펼친 채 · 열 글 · 설명에 세계관 틀', cr.after && cr.before && cr.open && TEN.every(n => cr.links.some(u => u.endsWith('/posts/' + n))) && /세계관/.test(cr.text), `아래 ${cr.after} · 위 ${cr.before} · 펼침 ${!!cr.open} · ${new Set(cr.links).size}곳`);
    await b.eval(`document.querySelector('.mart-credits').scrollIntoView({block:'center'}); true`); await b.sleep(300);
    row(vp, '「원작」 칸 가로 넘침 0', (await over()) <= 0, `넘침 ${await over()}`);
    await b.shot(path.join(OUT, `${vp}-1-원작-칸.png`));
    // 카드 원작 줄: 은설 둘 · 우지엘 · D&H 쪽 아드리안
    const want = { 'simple-k1049': [29037], 'simple-k1320': [99019], 'simple-k1240': [127563, 54677], 'simple-k1042': [5150, 81234, 43794], 'simple-k1017': [155899, 54677] };
    for (const [q, ids] of [['은설', ['simple-k1049', 'simple-k1320']], ['우지엘', ['simple-k1240']], ['아드리안', ['simple-k1042']], ['아스모데우스', ['simple-k1017']]]) {
        await find(q);
        for (const id of ids) {
            const got = await b.eval(`(()=>{const c=document.querySelector('.mart-card[data-id="${id}"]');if(!c)return null;c.scrollIntoView({block:'center'});const a=[...c.querySelectorAll('a.mart-source')];return {links:a.map(x=>x.getAttribute('href')),out:a.filter(x=>x.getBoundingClientRect().right>c.getBoundingClientRect().right+1).length,blank:a.every(x=>x.target==='_blank')}})()`);
            row(vp, `카드 원작 줄 · ${id}`, got && J(got.links.map(u => Number(u.split('/').pop()))) === J(want[id]) && !got.out && got.blank, got ? `${got.links.map(u => u.split('/').pop()).join(' · ')} · 카드 밖 ${got.out}` : '카드 없음');
        }
        if (q === '은설') { await b.eval(`document.querySelector('.mart-card[data-id="simple-k1049"]').scrollIntoView({block:'center'}); true`); await b.sleep(900); await b.shot(path.join(OUT, `${vp}-2-카드-은설.png`)); row(vp, '은설 카드 가로 넘침 0', (await over()) <= 0, `넘침 ${await over()}`); }
    }
    // 세계관으로 찾기(「센티넬버스」 · 원작 봇 이름)
    await find('센티넬버스'); const s1 = (await b.eval(`document.querySelector('.mart-count')?.textContent||''`));
    await find('센가시뮬'); const s2 = (await cardsNow()).length;
    row(vp, '찾기: 「센티넬버스」 32 · 「센가시뮬」로도 찾아져요', /^32개/.test(s1) && s2 > 0, `센티넬버스 ${s1} · 센가시뮬 카드 ${s2}`);
    // 세계관 아닌 틀에는 원작 줄 없음
    await find('낫표'); const none = await b.eval(`document.querySelector('.mart-card[data-id="simple-k1"]')?.querySelectorAll('a.mart-source').length`);
    row(vp, '세계관 아닌 틀(낫표)에는 원작 줄 없음', none === 0, `${none}`);
    // 크게 보기 머리: 캐릭터를 안 골라도 그 틀의 원작
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/?view=1#simple-k1049'); await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk')`, 30000); await b.sleep(700);
    const sh = await b.eval(`(()=>{const s=document.querySelector('.mart-sheet[open]'),m=s.querySelector('.mart-sheet-meta');const a=[...m.querySelectorAll(':scope > a.mart-source')];const r=s.getBoundingClientRect();return {links:a.map(x=>x.href),out:a.filter(x=>x.getBoundingClientRect().right>r.right+1).length}})()`);
    row(vp, '크게 보기 머리: 캐릭터를 안 골라도 그 틀의 원작(은설 · 29037)', sh.links.length === 1 && sh.links[0].endsWith('/posts/29037') && !sh.out, sh.links.join(' · ') || '줄 없음');
    await b.shot(path.join(OUT, `${vp}-3-크게-보기-은설.png`));
    // 지니 결과 카드에도 「HTML 복사로 써요」 없음(글자만)
    const genie = await b.eval(`fetch(${J(srv.url + 'mart/genie.js')}).then(r=>r.text()).then(t=>t.includes('>HTML 복사로 써요<'))`);
    row(vp, '지니 결과 카드에도 「HTML 복사로 써요」 없음', genie === false, String(genie));
}

try {
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2]]) {
        await b.size(w, h, mobile, dpr);
        if (!ONLY || ONLY === 'card') await cardPart(vp);
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
