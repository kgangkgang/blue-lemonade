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
    const cr = await b.eval(`(()=>{const c=document.querySelector('.mart-credits'),g=document.querySelector('.mart-grid'),h=document.querySelector('.mart-howto');return {after:!!(g.compareDocumentPosition(c)&4),before:!h||!!(c.compareDocumentPosition(h)&4),open:c.checkVisibility()&&c.querySelectorAll('a.mart-source').length&&[...c.querySelectorAll('a.mart-source')].every(a=>a.checkVisibility()),links:[...c.querySelectorAll('a.mart-source')].map(a=>a.href),text:c.querySelector('p')?.textContent||''}})()`);
    row(vp, '「원작」 칸: 목록 아래 · 펼친 채 · 열 글 · 설명에 세계관 틀', cr.after && cr.before && cr.open && TEN.every(n => cr.links.some(u => u.endsWith('/posts/' + n))) && /세계관/.test(cr.text), `아래 ${cr.after} · 위 ${cr.before} · 펼침 ${!!cr.open} · ${new Set(cr.links).size}곳`);
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

const idx = async () => b.eval(`fetch(${J(srv.url + 'mart/data/geulkku/index.json')},{cache:'no-store'}).then(r=>r.json()).then(d=>d.items.map(x=>({id:x.id,topic:x.topic,world:x.world||'',who:x.who||'',cat:x.category,audio:!!x.audio})))`);
const texts = sel => b.eval(`[...document.querySelectorAll(${J(sel)})].filter(e=>e.checkVisibility()).map(e=>e.textContent.replace(/\\s+/g,' ').trim())`);
const countNow = () => b.eval(`parseInt(document.querySelector('.mart-count')?.textContent)||0`);
const pressed = sel => b.eval(`[...document.querySelectorAll(${J(sel)})].filter(e=>e.getAttribute('aria-pressed')==='true').map(e=>e.textContent.replace(/\\s+/g,' ').trim())`);
const VIS = `e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'`;
const tapText = async (vp, sel, text) => {
    const n = await b.eval(`[...document.querySelectorAll(${J(sel)})].filter(${VIS}).findIndex(e=>e.textContent.replace(/\\s+/g,' ').trim().startsWith(${J(text)}))`);
    if (n < 0) { row(vp, `누르기: ${text}`, false, '없음'); return false; }
    await b.eval(`[...document.querySelectorAll(${J(sel)})].filter(${VIS})[${n}].scrollIntoView({block:'center',inline:'center'}); true`);
    return tapOk(vp, text, sel, { nth: n });
};

async function topicPart(vp) {
    await fresh(); const all = await idx();
    const tabs = await texts('.mart-groups button');
    row(vp, '분류 묶음 탭: 전체 · 일상 · 이벤트 · 화면 · 장르 · 세계관 · 인물 · 기본 · 심플(수 그대로)', J(tabs) === J(['전체417', '일상122', '이벤트68', '화면 · 장르87', '세계관 · 인물104', '기본 · 심플36']), tabs.join(' / '));
    const aux = await texts('.mart-chips button');
    row(vp, '보조 거르기 줄: 예전 칩 그대로(★ 즐겨찾기 · 최근 · 내 글꾸 · 눌러서 열어요 · 누르면 바뀌어요 · 가만히 보기) · 「소리 카드」는 0개', ['★ 즐겨찾기', '최근', '내 글꾸', '눌러서 열어요', '누르면 바뀌어요', '가만히 보기'].every(t => aux.some(a => a.startsWith(t))) && !aux.some(a => /소리 카드/.test(a)) && !(await b.eval(`document.body.innerText.includes('소리 카드')`)), aux.join(' / '));
    row(vp, '「전체」에서는 하위 칩 줄이 숨어요', (await texts('.mart-topics button')).length === 0, '');
    await b.shot(path.join(OUT, `${vp}-10-분류-전체.png`));
    if (!(await tapText(vp, '.mart-groups button', '이벤트'))) return;
    const sub = await texts('.mart-topics button');
    row(vp, '「이벤트」 하위 칩: 모두 68 · 기념일 13 · 할로윈 32 · 크리스마스 · 연말 23', J(sub) === J(['모두68', '기념일13', '할로윈32', '크리스마스 · 연말23']) && (await countNow()) === 68, `${sub.join(' / ')} · 목록 ${await countNow()}개`);
    await tapText(vp, '.mart-topics button', '할로윈');
    const ids = await cardsNow(), want = all.filter(x => x.topic === '할로윈');
    row(vp, '「할로윈」 → 32틀 · 보이는 카드가 모두 할로윈 틀', (await countNow()) === 32 && ids.length && ids.every(id => want.some(x => x.id === id)), `목록 ${await countNow()}개 · 카드 ${ids.length}`);
    await tapText(vp, '.mart-chips button', '눌러서 열어요');
    const both = want.filter(x => x.cat === 'simple-open').length;
    row(vp, '분류 × 누름 방식을 같이: 할로윈 + 눌러서 열어요', (await countNow()) === both && both > 0 && both < 32 && (await pressed('.mart-topics button, .mart-chips button')).length === 2, `목록 ${await countNow()}개(자료 ${both}) · 고른 칩 ${(await pressed('.mart-topics button, .mart-chips button')).join(' + ')}`);
    await b.eval('scrollTo(0,0)'); await b.sleep(300); await b.shot(path.join(OUT, `${vp}-11-분류-할로윈-열어요.png`));
    await tapText(vp, '.mart-chips button', '눌러서 열어요');
    row(vp, '고른 누름 방식 칩을 다시 누르면 풀려요', (await countNow()) === 32 && (await pressed('.mart-chips button')).length === 0, `목록 ${await countNow()}개`);
    await tapText(vp, '.mart-chips button', '소리 · 음악');
    row(vp, '「소리 · 음악」: 소리 줄이 남은 틀만(할로윈 안)', (await countNow()) === want.filter(x => x.audio).length, `목록 ${await countNow()}개(자료 ${want.filter(x => x.audio).length})`);
    await tapText(vp, '.mart-chips button', '소리 · 음악');
    for (const [g, n] of [['일상', 122], ['화면 · 장르', 87], ['기본 · 심플', 36], ['전체', 417]]) {
        await tapText(vp, '.mart-groups button', g);
        row(vp, `묶음 「${g}」 → ${n}틀`, (await countNow()) === n, `목록 ${await countNow()}개 · 하위 칩 ${(await texts('.mart-topics button')).length}`);
        if (g === '일상') { await b.eval('scrollTo(0,0)'); await b.sleep(250); await b.shot(path.join(OUT, `${vp}-12-분류-일상.png`)); row(vp, '「일상」 가로 넘침 0', (await over()) <= 0, `넘침 ${await over()}`); }
    }
    await tapText(vp, '.mart-chips button', '소리 · 음악');
    row(vp, '전체 × 「소리 · 음악」 = 소리 줄이 남은 틀 수', (await countNow()) === all.filter(x => x.audio).length, `목록 ${await countNow()}개(자료 ${all.filter(x => x.audio).length})`);
}

async function worldPart(vp) {
    await fresh(); const all = await idx();
    await tapText(vp, '.mart-groups button', '세계관 · 인물');
    const sub = await texts('.mart-topics button');
    row(vp, '「세계관 · 인물」 하위 칩: 모두 104 · 천지합동청 30 · D&H 17 · 아드리안 12 · 무협시뮬 13 · 센티넬버스 32', J(sub) === J(['모두104', '천지합동청30', 'D&H17', '아드리안12', '무협시뮬13', '센티넬버스32']), sub.join(' / '));
    row(vp, '세계관을 고르기 전에는 머리 띠가 없어요', !(await b.eval(`document.querySelector('.mart-band').checkVisibility()`)), '');
    const urls = new Set();
    for (const [label, id, n] of [['천지합동청', 'halo', 30], ['D&H', 'hunter', 17], ['아드리안', 'adrian', 12], ['무협시뮬', 'gangho', 13], ['센티넬버스', 'sentinel', 32]]) {
        await tapText(vp, '.mart-topics button', label);
        const band = await b.eval(`(()=>{const e=document.querySelector('.mart-band');return {on:e.checkVisibility(),h:e.querySelector('h2')?.textContent,n:e.querySelector('.mart-band-n')?.textContent,links:[...e.querySelectorAll('a.mart-source')].map(a=>a.href),chips:[...e.querySelectorAll('.mart-band-people button')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()),dots:e.querySelectorAll('.mart-band-people .mart-cast-dot').length}})()`);
        const list = all.filter(x => x.world === id), people = [...new Set(list.filter(x => x.who).map(x => x.who))];
        for (const u of band.links) urls.add(u);
        row(vp, `「${label}」 머리 띠: 이름 · 틀 ${n} · 인물 ${people.length} · 원작 링크 · 인물 칩(색 점 · 틀 수) · 그 틀만`, band.on && band.h === label && band.n === `틀 ${n} · 인물 ${people.length}` && band.links.length >= 1 && band.dots === people.length && band.chips.length === people.length + (list.some(x => !x.who) ? 1 : 0) && (await countNow()) === n, `${band.n} · 원작 ${band.links.map(u => u.split('/').pop()).join(' · ')} · 칩 ${band.chips.length} · 목록 ${await countNow()}개`);
    }
    row(vp, '다섯 세계관 머리 띠에 원작 글 열 개가 모두', TEN.every(n => [...urls].some(u => u.endsWith('/posts/' + n))), `${urls.size}곳`);
    await b.eval(`document.querySelector('.mart-band').scrollIntoView({block:'center'}); true`); await b.sleep(300);
    row(vp, '센티넬버스 머리 띠 가로 넘침 0 · 링크가 띠 밖으로 안 나가요', (await over()) <= 0 && (await b.eval(`(()=>{const e=document.querySelector('.mart-band'),r=e.getBoundingClientRect();return [...e.querySelectorAll('a.mart-source')].filter(a=>a.getBoundingClientRect().right>r.right+1).length})()`)) === 0, `넘침 ${await over()}`);
    await tapText(vp, '.mart-band-people button', '은설');
    const ids = await cardsNow();
    row(vp, '인물 칩 「은설」 → 은설 틀 둘만', J([...ids].sort()) === J(['simple-k1049', 'simple-k1320']) && (await pressed('.mart-band-people button')).length === 1, `${ids.join(' · ')} · 목록 ${await countNow()}개`);
    await b.eval(`scrollTo(0, Math.max(0, document.querySelector('.mart-tools').getBoundingClientRect().top + scrollY - 70)); true`); await b.sleep(900); await b.shot(path.join(OUT, `${vp}-20-세계관-센티넬버스-은설.png`));
    await tapText(vp, '.mart-band-people button', '은설');
    row(vp, '인물 칩을 다시 누르면 그 세계관 전부로', (await countNow()) === 32, `목록 ${await countNow()}개`);
    await tapText(vp, '.mart-band-people button', '세계관');
    row(vp, '「세계관」 칩 → 인물 없는 세계관 틀만', (await countNow()) === all.filter(x => x.world === 'sentinel' && !x.who).length, `목록 ${await countNow()}개`);
    await tapText(vp, '.mart-topics button', '모두');
    row(vp, '「모두」 → 104틀 · 머리 띠는 접혀요', (await countNow()) === 104 && !(await b.eval(`document.querySelector('.mart-band').checkVisibility()`)), `목록 ${await countNow()}개`);
}

async function castPart(vp) {
    await fresh();
    // 밝기 단추: 해 먼저 · 달 다음 · 글자 없이 아이콘 · 처음 온 사람은 낮
    const dn = await b.eval(`(()=>{const g=document.querySelector('.mart-cast .mart-dn');const bs=[...g.querySelectorAll('button')];return {order:bs.map(x=>x.dataset.mode),labels:bs.map(x=>x.getAttribute('aria-label')),titles:bs.map(x=>x.title),text:g.textContent.trim(),pressed:bs.filter(x=>x.getAttribute('aria-pressed')==='true').map(x=>x.dataset.mode),sizes:bs.map(x=>{const r=x.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]}),touch:bs.map(x=>{const p=getComputedStyle(x,'::before');return p.content!=='none'?Math.round(parseFloat(p.height)):0}),saved:localStorage.getItem('bl-mart-tone-v1'),bg:bs.map(x=>getComputedStyle(x).backgroundColor)}})()`);
    row(vp, '밝기 단추: 해(낮) 먼저 · 달(밤) 다음 · 글자 없이 아이콘(aria-label 낮 · 밤) · 저장된 값이 없으면 낮', J(dn.order) === J(['light', 'dark']) && J(dn.labels) === J(['낮', '밤']) && J(dn.titles) === J(['낮', '밤']) && dn.text === '' && J(dn.pressed) === J(['light']) && !dn.saved && (vp !== 'phone' || dn.touch.every(t => t >= 44)), J(dn));
    await b.shot(path.join(OUT, `${vp}-33-밝기-단추.png`));
    const tone = () => b.eval(`JSON.parse(localStorage.getItem('bl-mart-tone-v1')||'{}')`);
    await tapOk(vp, '깡통 칸', '.mart-cast [data-toggle="main"]');
    const st = await b.eval(`(()=>{const p=document.querySelector('#mart-cast-panel');return {on:p.checkVisibility(),tabs:[...p.querySelectorAll('.mart-cast-tabs button')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()),panes:p.querySelectorAll('.mart-cast-pane').length,people:p.querySelectorAll('.mart-cast-pane [data-color]').length,radios:p.querySelectorAll('input[type=radio]').length,guide:p.querySelectorAll('.mart-cast-who').length}})()`);
    row(vp, '깡통 칸: 묶음 탭 한 줄(천지합동청 13 · D&H · 아드리안 8 · 무협시뮬 7 · 센티넬버스 11 · 직접) · 묶음 하나만 · 인물은 색 점 칩(라디오 0) · 안내 한 줄', st.on && J(st.tabs) === J(['천지합동청13', 'D&H · 아드리안8', '무협시뮬7', '센티넬버스11', '직접']) && st.panes === 1 && st.people === 13 && st.radios === 0 && st.guide === 1, J(st));
    await tapText(vp, '.mart-cast-tabs button', '센티넬버스');
    row(vp, '「센티넬버스」 탭 → 인물 칩 11 · 묶음은 여전히 하나', (await b.eval(`document.querySelectorAll('.mart-cast-pane').length===1 && document.querySelectorAll('.mart-cast-pane [data-color]').length`)) === 11, '');
    const h = await b.eval(`Math.min(...[...document.querySelectorAll('.mart-cast-pane [data-color], .mart-cast-foot [data-pick]')].map(e=>e.getBoundingClientRect().height))`);
    const pitch = await b.eval(`(()=>{const ys=[...new Set([...document.querySelectorAll('.mart-cast-pane [data-color]')].map(e=>Math.round(e.getBoundingClientRect().top)))].sort((a,b)=>a-b);return ys.length>1?ys[1]-ys[0]:99})()`);
    row(vp, vp === 'phone' ? '폰: 인물 칩 34 · 줄과 줄 사이 44 이상(손가락 자리)' : '인물 칩 높이 34', h >= 34 && (vp !== 'phone' || pitch >= 44), `${h}px · 줄 간격 ${pitch}px`);
    await tapText(vp, '.mart-cast-pane [data-color]', '은설');
    const picked = await b.eval(`({head:document.querySelector('.mart-cast [data-toggle="main"]').textContent.replace(/\\s+/g,' ').trim(),links:[...document.querySelectorAll('.mart-cast .mart-cast-credit a.mart-source')].map(a=>a.href),on:[...document.querySelectorAll('.mart-cast-pane [data-color][aria-pressed="true"]')].map(x=>x.dataset.name)})`);
    const t1 = await tone();
    row(vp, '은설을 고르면: 머리 줄 「깡통 은설」 · 원작 줄 전부(29037 · 99019) · 색이 입혀져요(#e8e4f2)', /깡통\s*은설/.test(picked.head) && [29037, 99019].every(n => picked.links.some(u => u.endsWith('/posts/' + n))) && J(picked.on) === J(['은설']) && String(t1.k).toLowerCase() === '#e8e4f2' && t1.on === true, `${picked.head} · ${picked.links.map(u => u.split('/').pop()).join(' · ')} · k ${t1.k}`);
    await tapOk(vp, '원작 2', '.mart-cast [data-src-toggle]');
    const src = await b.eval(`[...document.querySelectorAll('.mart-cast .mart-cast-src a.mart-source')].filter(a=>a.checkVisibility()).map(a=>a.href)`);
    row(vp, '묶음 머리 「원작 2 ⌄」을 누르면 그 묶음 원작 글 전부', src.length === 2 && [29037, 99019].every(n => src.some(u => u.endsWith('/posts/' + n))), src.map(u => u.split('/').pop()).join(' · '));
    await b.eval(`document.querySelector('.mart-cast').scrollIntoView({block:'start'}); scrollBy(0,-70); true`); await b.sleep(900);
    row(vp, '캐릭터 칸 가로 넘침 0', (await over()) <= 0, `넘침 ${await over()}`);
    await b.shot(path.join(OUT, `${vp}-30-캐릭터-칸-은설.png`));
    const all = new Set();
    for (const [tab, n] of [['천지합동청', 4], ['D&H', 3], ['무협시뮬', 1], ['센티넬버스', 2]]) {
        await tapText(vp, '.mart-cast-tabs button', tab);
        const more = await b.eval(`document.querySelector('.mart-cast [data-src-toggle]')?.textContent.trim()`);
        await tapOk(vp, `${tab} 원작`, '.mart-cast [data-src-toggle]');
        const got = await b.eval(`[...document.querySelectorAll('.mart-cast .mart-cast-src a.mart-source')].filter(a=>a.checkVisibility()).map(a=>a.href)`);
        for (const u of got) all.add(u);
        row(vp, `「${tab}」 묶음 머리: 「원작 ${n}」 → 링크 ${n}`, more === `원작 ${n}` && got.length === n, `${more} · ${got.map(u => u.split('/').pop()).join(' · ')}`);
    }
    row(vp, '캐릭터 칸 묶음 머리에 원작 글 열 개가 모두', TEN.every(n => [...all].some(u => u.endsWith('/posts/' + n))), `${all.size}곳`);
    const go = await b.eval(`document.querySelector('.mart-cast [data-world="sentinel"]')?.textContent.trim()`);
    await tapOk(vp, '이 세계관 틀 보기', '.mart-cast [data-world="sentinel"]'); await b.sleep(900);
    const band = await b.eval(`(()=>{const e=document.querySelector('.mart-band'),r=e.getBoundingClientRect();return {on:e.checkVisibility(),h:e.querySelector('h2')?.textContent,top:Math.round(r.top),inView:r.top>=0&&r.top<innerHeight}})()`);
    row(vp, '「이 세계관 틀 32 보기 →」 → 센티넬버스 머리 띠로 이어져요(화면 안 · 32틀)', go === '이 세계관 틀 32 보기 →' && band.on && band.h === '센티넬버스' && band.inView && (await countNow()) === 32, `${go} · 띠 위치 ${band.top}px · 목록 ${await countNow()}개`);
    await b.shot(path.join(OUT, `${vp}-31-세계관-틀-보기.png`));
    await b.eval('scrollTo(0,0)'); await b.sleep(300);
    await tapOk(vp, '깡캐 칸', '.mart-cast [data-toggle="other"]');
    await tapText(vp, '.mart-cast-tabs button', 'D&H');
    const gos = await texts('.mart-cast [data-world]');
    row(vp, '「D&H · 아드리안」 묶음: 세계관 둘로 가는 줄(D&H 틀 17 · 아드리안 틀 12)', J(gos) === J(['D&H 틀 17 보기 →', '아드리안 틀 12 보기 →']), gos.join(' / '));
    await tapText(vp, '.mart-cast-pane [data-color]', '아드리안');
    const adr = await b.eval(`[...document.querySelectorAll('.mart-cast .mart-cast-credit .mart-cast-credit-row')].filter(r=>/아드리안/.test(r.textContent)).flatMap(r=>[...r.querySelectorAll('a.mart-source')].map(a=>a.href))`);
    const t2 = await tone();
    row(vp, '깡캐에 아드리안: 원작 글 둘(81234 · 43794) · 깡통은 그대로 은설', adr.length === 2 && [81234, 43794].every(n => adr.some(u => u.endsWith('/posts/' + n))) && t2.name2 === '아드리안 폰 아이젠베르크' && t2.name === '은설', `${adr.map(u => u.split('/').pop()).join(' · ')} · 깡통 ${t2.name} · 깡캐 ${t2.name2}`);
    await b.eval(`document.querySelector('.mart-cast [data-swap]').scrollIntoView({block:'center'}); true`); await b.sleep(300); await tapOk(vp, '⇄', '.mart-cast [data-swap]');
    const t3 = await tone();
    row(vp, '⇄ 화자 바꾸기: 깡통 아드리안 · 깡캐 은설', t3.name === '아드리안 폰 아이젠베르크' && t3.name2 === '은설', `깡통 ${t3.name} · 깡캐 ${t3.name2}`);
    if (!(await b.eval(`document.querySelector('.mart-cast [data-toggle="main"]').getAttribute('aria-expanded')==='true'`))) await tapOk(vp, '깡통 칸', '.mart-cast [data-toggle="main"]');
    const foot = await texts('.mart-cast-foot > *');
    row(vp, '맨 아래 한 줄: 원래 색 · 캐릭터 없음 · 소품까지 캐릭터 색', J(foot) === J(['원래 색', '캐릭터 없음', '소품까지 캐릭터 색']), foot.join(' / '));
    await tapOk(vp, '소품까지 캐릭터 색', '.mart-cast-cover'); const c1 = (await tone()).cover;
    await tapOk(vp, '소품까지 캐릭터 색', '.mart-cast-cover'); const c2 = (await tone()).cover;
    row(vp, '「소품까지 캐릭터 색」 끄고 켜기', c1 === false && c2 !== false, `끔 ${c1} · 켬 ${c2 ?? '기본'}`);
    await tapText(vp, '.mart-cast-foot button', '캐릭터 없음'); const t4 = await tone();
    await tapText(vp, '.mart-cast-foot button', '원래 색'); const t5 = await tone();
    row(vp, '「캐릭터 없음」 → 무채 · 「원래 색」 → 틀 색 그대로', t4.on === true && !t4.k && t5.on === false, `없음 on ${t4.on} k ${t4.k} · 원래 색 on ${t5.on}`);
    await tapText(vp, '.mart-cast-tabs button', '직접');
    const dir = await b.eval(`(()=>{const p=document.querySelector('.mart-cast-direct');return p?{form:!!p.querySelector('.mart-cast-form input[name=name]'),color:!!p.querySelector('.mart-cast-color input[type=color]'),btn:p.querySelector('.mart-cast-form button')?.textContent,paste:!!p.querySelector('.mart-cast-paste textarea')}:null})()`);
    row(vp, '「직접」 탭: 이름 · 색 · 「기억하고 고르기」 · 채팅 붙여 넣기', dir && dir.form && dir.color && dir.btn === '기억하고 고르기' && dir.paste, J(dir));
    await b.eval(`(()=>{const f=document.querySelector('.mart-cast-form');f.name.value='시험이';f.requestSubmit();return true})()`); await b.sleep(500);
    const t6 = await tone(), mine = await texts('.mart-cast-direct .mart-cast-mine [data-color]');
    row(vp, '기억하고 고르기: 「직접」 탭 맨 위에 칩으로 · 깡통에 입혀져요', t6.name === '시험이' && mine.includes('시험이'), `깡통 ${t6.name} · 칩 ${mine.join(' / ')}`);
    await b.eval(`document.querySelector('.mart-cast').scrollIntoView({block:'start'}); scrollBy(0,-70); true`); await b.sleep(400);
    await b.shot(path.join(OUT, `${vp}-32-캐릭터-칸-직접.png`));
    row(vp, '「직접」 탭 가로 넘침 0', (await over()) <= 0, `넘침 ${await over()}`);
    await tapOk(vp, '잊기', '.mart-cast-direct [data-forget]');
    row(vp, '기억한 캐릭터 × 로 잊기', (await texts('.mart-cast-direct .mart-cast-mine [data-color]')).length === 0, '');
    await tapOk(vp, '낮', '.mart-cast [data-mode="light"]'); const m1 = (await tone()).mode; await tapOk(vp, '밤', '.mart-cast [data-mode="dark"]'); const m2 = (await tone()).mode;
    row(vp, '해 · 달 단추로 낮 · 밤 바꾸기', m1 === 'light' && m2 === 'dark', `${m1} → ${m2}`);
    await tapOk(vp, '내 글 칸', '.mart-cast [data-toggle="text"]');
    row(vp, '「내 글」 칸 그대로(붙여 넣는 칸 · 내 글로 보기)', await b.eval(`!!document.querySelector('.mart-mine-text')?.checkVisibility() && !!document.querySelector('[data-mine="apply"]')`), '');
    await tapOk(vp, '내 글 칸', '.mart-cast [data-toggle="text"]');
    row(vp, '칸을 다시 누르면 접혀요(머리 줄만)', !(await b.eval(`document.querySelector('#mart-cast-panel')?.checkVisibility()`)), '');
}

async function headPart(vp) {
    for (const [page, label, word] of [['geulkku', '쓰는 법', '내 글로 보기'], ['frames', '받는 법', '마트에서 가져오기']]) {
        await b.goto('about:blank'); await b.goto(srv.url + `mart/${page}/`); await b.until(`document.querySelectorAll('.mart-card').length > 3 && document.querySelector('.mart-head-more')`, 30000); await b.sleep(500);
        const shut = await b.eval(`(()=>{const h=document.querySelector('.mart-head'),h1e=h.querySelector('h1'),h1=h1e.getBoundingClientRect(),m=h.querySelector('.mart-head-more'),mr=m.getBoundingClientRect(),help=h.querySelector('.mart-head-help');return {btn:m.textContent.trim(),sameLine:Math.abs((mr.top+mr.bottom)/2-(h1.top+h1.bottom)/2)<8,helpShown:help.checkVisibility(),ps:[...h.querySelectorAll('p')].filter(p=>p.checkVisibility()).length,howto:document.querySelectorAll('.mart-howto').length,h1lines:Math.round(h1.height/parseFloat(getComputedStyle(h1e).lineHeight))}})()`);
        row(vp, `${page}: 접힌 머리말은 제목 + 「${label} ⌄」만(설명 0줄 · 제목 한 줄) · 맨 아래 「쓰는 법」 칸 없음`, shut.btn === label && shut.sameLine && !shut.helpShown && shut.ps === 0 && shut.howto === 0 && shut.h1lines === 1, J(shut));
        if (page === 'geulkku') await b.shot(path.join(OUT, `${vp}-40-머리말-접힘.png`));
        await tapOk(vp, label, '.mart-head-more');
        const open = await b.eval(`(()=>{const help=document.querySelector('.mart-head-help');return {shown:help.checkVisibility(),li:help.querySelectorAll('ol>li').length,has:help.textContent.includes(${J(word)}),clip:[...help.querySelectorAll('p,li')].filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1).length,exp:document.querySelector('.mart-head-more').getAttribute('aria-expanded')}})()`);
        row(vp, `${page}: 「${label}」를 누르면 설명 · 번호 줄이 말줄임 없이 펼쳐져요`, open.shown && open.li >= 4 && open.has && open.clip === 0 && open.exp === 'true' && (await over()) <= 0, `번호 줄 ${open.li} · 잘린 줄 ${open.clip} · 넘침 ${await over()}`);
        await b.shot(path.join(OUT, `${vp}-41-머리말-펼침-${page}.png`));
        await tapOk(vp, label, '.mart-head-more');
        row(vp, `${page}: 다시 누르면 접혀요`, !(await b.eval(`document.querySelector('.mart-head-help').checkVisibility()`)), '');
    }
}

async function extraPart(vp) {
    // PC: 세로 휠로 새 가로 줄(하위 칩)을 옆으로 — 공용 처리(top-mart.js)에 걸려요
    if (vp === 'pc') {
        await fresh(); await tapText(vp, '.mart-groups button', '일상');
        const at = await b.eval(`(()=>{const e=document.querySelector('.mart-topics');e.scrollLeft=0;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,over:e.scrollWidth-e.clientWidth}})()`);
        await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x, y: at.y, deltaX: 0, deltaY: 240 }); await b.sleep(400);
        const moved = await b.eval(`[document.querySelector('.mart-topics').scrollLeft, scrollY]`);
        row(vp, '세로 휠 → 하위 칩 줄이 옆으로(페이지는 그대로)', at.over > 0 ? moved[0] > 0 && moved[1] === 0 : true, `넘치는 폭 ${at.over} · 줄 ${moved[0]} · 페이지 ${moved[1]}`);
    }
    // 320 폭 넘침 0(분류 줄 · 세계관 머리 띠 · 캐릭터 칸 펼침)
    if (vp === 'phone') {
        await b.size(320, 640, true, 2); await fresh();
        await tapText(vp, '.mart-groups button', '세계관 · 인물'); await tapText(vp, '.mart-topics button', '센티넬버스');
        const o1 = await over();
        await b.eval('scrollTo(0,0)'); await tapOk(vp, '깡통 칸', '.mart-cast [data-toggle="main"]'); await tapText(vp, '.mart-cast-tabs button', '천지합동청');
        const o2 = await over(), out = await b.eval(`[...document.querySelectorAll('.mart-cast *, .mart-band *, .mart-tools *')].filter(e=>e.checkVisibility()&&!e.closest('.mart-cast-tabs, .mart-groups, .mart-topics, .mart-chips, .mart-band-people, .mart-filters')&&e.getBoundingClientRect().right>innerWidth+1).length`);
        row(vp, '폭 320: 분류 · 머리 띠 · 캐릭터 칸 가로 넘침 0', o1 <= 0 && o2 <= 0 && out === 0, `넘침 ${o1} · ${o2} · 밖으로 나간 요소 ${out}`);
        await b.shot(path.join(OUT, `phone320-50-캐릭터-칸.png`));
        await b.size(375, 812, true, 2);
    }
    // 장바구니 줄의 원작(인물 액자를 담으면)
    await b.goto('about:blank'); await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { });
    await b.goto(srv.url + 'mart/frames/'); await b.until(`document.querySelectorAll('.mart-card').length > 3`, 30000); await b.sleep(500);
    await b.eval(`(()=>{const i=document.querySelector('.mart-tools input[type=search]');i.value='은설';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await b.sleep(900);
    if (await b.eval(`(()=>{const p=document.querySelector('.mart-card [data-act="pick"], .mart-card .mart-pick');if(!p)return false;p.click();return true})()`)) {
        await b.sleep(500); await tapOk(vp, '장바구니', '.mart-cart-btn'); await b.sleep(700);
        const cart = await b.eval(`[...document.querySelectorAll('.mart-cart-list .mart-cart-src a.mart-source')].filter(a=>a.checkVisibility()).map(a=>a.href)`);
        row(vp, '장바구니 줄: 은설 액자를 담으면 원작 줄(29037 · 99019)', [29037, 99019].every(n => cart.some(u => u.endsWith('/posts/' + n))) && (await over()) <= 0, cart.map(u => u.split('/').pop()).join(' · ') || '줄 없음');
        await b.shot(path.join(OUT, `${vp}-51-장바구니-원작.png`));
    }
    await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { });
}

async function motionPart(vp) {
    // 간편 「움직임」 줄의 「소품만」 — 글은 가만히 · 소품은 움직임(음성 메모: 늘 오르내리는 음파 막대 + 대사 줄 등장 움직임)
    await b.goto('about:blank'); await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { });
    await b.goto(srv.url + 'mart/geulkku/?view=1#simple-k6'); await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk') && document.querySelector('.mart-sheet[open] [data-simple-motion]')`, 30000); await b.sleep(800);
    const anim = () => b.eval(`(()=>{const g=document.querySelector('.mart-sheet[open] .mart-sheet-preview .gk');const on=e=>getComputedStyle(e).animationName!=='none';const all=[...g.querySelectorAll('*')];const text=all.filter(e=>e.matches('p, p *')&&on(e)).length,prop=all.filter(e=>!e.matches('p, p *, style')&&on(e)).length;return {text,prop}})()`);
    const mo = () => b.eval(`JSON.parse(localStorage.getItem('bl-mart-motion-v1')||'{}')`);
    const before = await anim();
    const chips = await b.eval(`[...document.querySelectorAll('.mart-sheet[open] [data-simple-motion]')].map(x=>x.textContent.trim())`);
    const row1 = await b.eval(`(()=>{const c=[...document.querySelectorAll('.mart-sheet[open] [data-simple-motion]')];const ys=new Set(c.map(x=>Math.round(x.getBoundingClientRect().top)));return ys.size})()`);
    row(vp, '간편 「움직임」 줄: 끔 · 약 · 중 · 강 · 소품만(한 줄)', J(chips) === J(['끔', '약', '중', '강', '소품만']) && row1 === 1, `${chips.join(' · ')} · 줄 ${row1}`);
    await b.eval(`document.querySelector('.mart-sheet[open] [data-simple-motion="prop"]').click(); true`); await b.sleep(900);   // 폰은 붙박이 미리보기가 칩 줄을 덮을 수 있어 그 단추의 click 을 바로
    const after = await anim(), m1 = await mo(), on = await b.eval(`document.querySelector('.mart-sheet[open] [data-simple-motion="prop"]')?.getAttribute('aria-pressed')`);
    row(vp, '「소품만」 → 미리보기에서 글은 안 움직이고 소품은 움직여요(글 움직임 끔 · 소품 움직임 그대로)', before.text > 0 && before.prop > 0 && after.text === 0 && after.prop > 0 && m1.text === '0' && (m1.prop ?? 'm') !== '0' && on === 'true', `전 글 ${before.text} · 소품 ${before.prop} → 후 글 ${after.text} · 소품 ${after.prop} · 값 ${J(m1)}`);
    await b.shot(path.join(OUT, `${vp}-60-소품만.png`));
    // 복사 글 · 테마로 담기 꾸러미에 그대로(세밀 「글 움직임 끔」과 같은 값)
    const set = await b.eval(`(async()=>{const m=await import(new URL('../motion-state.js', location.href).href+'?v=20261112a');return m.motionNow()})()`);
    row(vp, '세밀과 같은 값을 읽고 써요(글 0 · 소품 m)', set.text === '0' && set.prop !== '0', J(set));
    await b.eval(`document.querySelector('.mart-sheet[open] [data-simple-motion="m"]').click(); true`); await b.sleep(900);
    const back = await anim(), m2 = await mo();
    row(vp, '「중」을 누르면 글 · 소품 같이 틀 그대로로 돌아와요', back.text === before.text && (m2.text ?? 'm') === 'm' && (m2.prop ?? 'm') === 'm', `글 ${back.text} · 값 ${J(m2)}`);
    // 글 움직임을 끌 수 없는 틀(여름 바다)은 「소품만」이 흐려요 + 까닭
    await b.goto('about:blank'); await b.goto(srv.url + 'mart/geulkku/?view=1#simple-q01'); await b.until(`document.querySelector('.mart-sheet[open] [data-simple-motion="prop"]')`, 30000); await b.sleep(500);
    const off = await b.eval(`(()=>{const c=document.querySelector('.mart-sheet[open] [data-simple-motion="prop"]');return {disabled:c.disabled,title:c.title}})()`);
    row(vp, '글 움직임을 끌 수 없는 틀은 「소품만」이 흐리고 까닭이 있어요', off.disabled && /끌 수 없어요/.test(off.title), J(off));
    await b.send('Storage.clearDataForOrigin', { origin: new URL(srv.url).origin, storageTypes: 'local_storage,session_storage' }).catch(() => { });
}

try {
    for (const [vp, w, h, mobile, dpr] of [['pc', 1280, 900, false, 1], ['phone', 375, 812, true, 2]].filter(v => !opt('--vp') || opt('--vp').split(',').includes(v[0]))) {
        await b.size(w, h, mobile, dpr);
        if (!ONLY || ONLY.includes('card')) await cardPart(vp);
        if (!ONLY || ONLY.includes('topic')) await topicPart(vp);
        if (!ONLY || ONLY.includes('world')) await worldPart(vp);
        if (!ONLY || ONLY.includes('cast')) await castPart(vp);
        if (!ONLY || ONLY.includes('head')) await headPart(vp);
        if (!ONLY || ONLY.includes('extra')) await extraPart(vp);
        if (!ONLY || ONLY.includes('motion')) await motionPart(vp);
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
