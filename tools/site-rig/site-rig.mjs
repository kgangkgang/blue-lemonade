// 사이트 디자인 리그(블루레몬에이드 홈페이지 마트) — 로컬 정적 서버로 사이트를 띄워 헤드리스 Chrome(CDP)으로 폰 390 · PC 1440 화면을 차례로 열고 규칙을 재요.
//   node tools/site-rig/site-rig.mjs [--w 390|1440|all] [--only 글꾸,액자,…] [--no-pixel] [--port 8771] [--cdp 9351] [--out <폴더>] [--site <폴더>] [--prof <크롬 사용자 폴더>]
//   ① 화면 목록(SCREENS)을 열어 collect.js 로 부품 모양 서명을 모아요(굴려 가며) ② measure.js 로 넘침 · 누름 상자 · 간격 · 대비를 재요 ③ center 규칙은 사진 세 장으로 잉크 가운데를 재요
//   ④ 규칙(rules/*.mjs — 테마 census 규칙 사본 + 사이트 전용)을 돌려 위반을 모으고, 기준선(baseline.json 의 known)과 견줘 새 것만 실패로 세요
//   ⑤ 결과: tools/site-rig/out/<시각>/SITE-RIG.md + site-rig.json(+ shots/). 종료 코드 1 = 새 위반 · 못 연 화면 · 콘솔 오류가 있어요.
//   규칙 계약(테마 ui-census 와 같아요): export id · title · perScreen({ ev, shot, dpr, screen, rootSel, cond, out }) → [{ key, msg }] · afterAll({ variants, screens, colorBad, cond }) → [{ key, msg }]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const SITE = path.resolve(arg('--site', path.resolve(HERE, '../..')));   // --site <폴더>: 다른 판(예: 적용 전 git archive)을 같은 규칙으로 재요
const WANT_W = String(arg('--w', 'all'));
const ONLY = arg('--only', '') ? String(arg('--only')).split(',').map(s => s.trim()).filter(Boolean) : null;
const PIXEL = !argv.includes('--no-pixel');
const PORT = Number(arg('--port', 8771)), CDP = Number(arg('--cdp', 9351));
const stamp = new Date(); const pad2 = n => String(n).padStart(2, '0');
const OUT = path.resolve(arg('--out', path.join(HERE, 'out', `${stamp.getFullYear()}${pad2(stamp.getMonth() + 1)}${pad2(stamp.getDate())}-${pad2(stamp.getHours())}${pad2(stamp.getMinutes())}${pad2(stamp.getSeconds())}`)));
fs.mkdirSync(OUT, { recursive: true });
const COLLECT = fs.readFileSync(path.join(HERE, 'collect.js'), 'utf8');
const MEASURE = fs.readFileSync(path.join(HERE, 'measure.js'), 'utf8');
const log = s => console.log(`[site-rig] ${s}`);
const t0 = Date.now();

// ---------------------------------------------------------------- 규칙 모듈
const rules = [], ruleErrors = [];
for (const f of fs.readdirSync(path.join(HERE, 'rules')).filter(f => /\.mjs$/.test(f) && f !== 'ui-parts-lib.mjs').sort()) {
    try { const m = await import(pathToFileURL(path.join(HERE, 'rules', f)).href); if (m.id && (m.perScreen || m.afterAll)) rules.push({ file: f, ...m }); else ruleErrors.push(`${f}: id 와 perScreen · afterAll 중 하나가 필요해요`); }
    catch (e) { ruleErrors.push(`${f}: 불러오기 실패 ${String(e.message || e).slice(0, 120)}`); }
}
if (!PIXEL) { const i = rules.findIndex(r => r.id === 'center'); if (i >= 0) rules.splice(i, 1); }
const findings = [];
const addFindings = (rule, list, cond) => { for (const x of list || []) if (x?.key) findings.push({ rule: rule.id, cond, key: `${rule.id}|${cond}|${x.key}`, msg: `${rule.title || rule.id}: ${x.msg || x.key}` }); };

// ---------------------------------------------------------------- 화면 목록
//   open(b) 는 화면을 열고 true 또는 까닭 문자열을 돌려줘요. 대화 창 · 서랍 · 메뉴 · 접기는 사이트 단추를 진짜로 눌러 열어요(b.tap — CDP 마우스 · 가려져 있으면 못 엶).
//   root 는 재는 뿌리(없으면 body). widths 가 있으면 그 폭에서만. 각 화면을 열기 전에 접힘 기억 · 장바구니 · 내 로그 켬을 비워요(앞 화면 영향 없이).
const READY_GRID = `document.querySelector('.mart-grid[aria-busy="false"] .mart-card')`;
const READY_PREVIEWS = n => `document.querySelectorAll('.mart-card .mart-preview:not(.is-wait) .mart-preview-in > :not(.mart-ph)').length >= ${n}`;
const PICKABLE = '.mart-card:not([hidden]):has(.mart-pick) .mart-preview';
const tapAll = async (b, list) => { for (const [sel, o, wait] of list) { const r = await b.tap(sel, o || {}); if (r !== true) return r; if (wait) await b.until(wait, 15000); else await b.sleep(300); } return true; };
const openSheetBy = async b => { await b.until(READY_GRID, 20000); await b.until(READY_PREVIEWS(1), 25000).catch(() => { }); return tapAll(b, [[PICKABLE, null, `document.querySelector('.mart-sheet[open]')`]]); };
/** 지니: 마트 머리줄 🧞 를 눌러 들어가 질문 단추(첫째)를 결과 카드가 나올 때까지 눌러요 */
const genieRun = async (b, toResult) => {
    await b.until(READY_GRID, 20000);
    const r = await b.tap('.mart-genie'); if (r !== true) return r;
    await b.until(`location.pathname.includes('/genie/') && document.querySelector('#gn-choices button')`, 20000);
    if (!toResult) { await b.sleep(500); return true; }
    const done = `!!document.querySelector('#gn-result:not([hidden]) .mart-card')`;
    for (let k = 0; k < 16; k++) {
        if (await b.eval(done)) break;
        await b.until(`document.querySelector('#gn-choices:not([hidden]) button') || ${done}`, 8000);
        if (await b.eval(done)) break;
        const t = await b.tap('#gn-choices button'); if (t !== true) return t;
        await b.sleep(1000);
    }
    await b.until(done, 15000);
    await b.sleep(900); return true;
};
/** 폰 거르기 띠 접힘: 화면을 조금씩 내려 띠가 저절로 한 줄(찾기 + 필터 요약 ⌄)로 접히는지 보고, 직접 접은 상태로 재요 */
const barFold = async b => { for (let k = 0; k < 14; k++) { await b.eval('window.scrollBy(0, 120)'); await b.sleep(60); } await b.until(`document.querySelector('.mart-tools.is-collapsed')`, 5000);
    // 재는 동안 리그가 굴려도(위로 굴리면 저절로 펼쳐져요) 접힌 채 재게: 「필터」로 펼쳤다가 ⌄ 로 직접 접어 둬요(직접 고른 것은 스크롤로 안 뒤집혀요)
    for (const want of [false, true]) { const t = await b.tap('.mart-bar-fold'); if (t !== true) return t; await b.until(`!!document.querySelector('.mart-tools.is-collapsed') === ${want}`, 5000); await b.sleep(300); }
    return true; };
const SCREENS = [
    { group: '홈', where: '홈 · 머리줄', url: '', root: '.top-inner', open: async b => { await b.until(`document.querySelector('.top-inner')`); return true; } },
    { group: '홈', where: '홈 · 마트 절', url: '', root: '#mart', open: async b => { await b.until(`document.querySelector('#mart')`); await b.eval(`document.querySelector('#mart').scrollIntoView({block:'start'});window.scrollBy(0,-80);true`); await b.sleep(400); return true; } },
    { group: '홈', where: '홈 · 마트 메뉴', url: '', root: '.mart-menu', open: async b => { await b.until(`document.querySelector('.top-mart')`); return tapAll(b, [['.top-mart', null, `document.querySelector('.mart-menu:not([hidden])')`]]); } },
    { group: '글꾸', where: '글꾸 · 목록', url: 'mart/geulkku/', root: null, open: async b => { await b.until(READY_GRID, 20000); await b.until(READY_PREVIEWS(3), 25000).catch(() => { }); await b.sleep(600); return true; } },
    { group: '글꾸', where: '글꾸 · 자세히 펼침', url: 'mart/geulkku/', root: '.mart-head', open: async b => { await b.until(READY_GRID, 20000); return tapAll(b, [['.mart-head-more', null, `document.querySelector('.mart-head.is-open')`]]); } },
    { group: '글꾸', where: '글꾸 · 칩 접힘', url: 'mart/geulkku/', root: '.mart-tools', widths: [1440], open: async b => { await b.until(READY_GRID, 20000); return tapAll(b, [['.mart-chips-fold', null, `document.querySelector('.mart-tools.is-folded')`]]); } },
    { group: '글꾸', where: '글꾸 · 띠 접힘(고름 요약)', url: 'mart/geulkku/', root: '.mart-tools', widths: [390], open: async b => { await b.until(READY_GRID, 20000); const t = await tapAll(b, [['.mart-chips button', { nth: 1 }]]); if (t !== true) return t; return barFold(b); } },
    { group: '글꾸', where: '글꾸 · 디자인 · 분류 고름', url: 'mart/geulkku/', root: '.mart-tools', open: async b => { await b.until(READY_GRID, 20000); return tapAll(b, [['.mart-groups button', { nth: 1 }], ['.mart-chips button', { nth: 1 }]]); } },
    // 11-10 목록 위 한 줄(캐릭터 ▾ · 혼합 · 바탕 ▾ · 밤/낮) — 펼친 모습 · 혼합 켬 · 바탕(종이 색 · 질감) 고름
    { group: '글꾸', where: '글꾸 · 캐릭터 펼침', url: 'mart/geulkku/', root: '.mart-cast', open: async b => { await b.until(READY_GRID, 20000); return tapAll(b, [['.mart-cast [data-toggle]', null, `document.querySelector('#mart-cast-panel:not([hidden]) .mart-cast-g')`], ['.mart-cast [data-group="halo"]', null, `document.querySelector('#mart-cast-halo input')`], ['#mart-cast-halo .mart-cast-r', null, `document.querySelector('#mart-cast-halo input:checked')`]]); } },
    // (혼합은 11-10 밤 꺼 두었어요 — MIX_ENABLED 를 켜면 이 화면도 되살려요) // { group: '글꾸', where: '글꾸 · 혼합 켬', url: 'mart/geulkku/', root: '.mart-cast', open: async b => { await b.until(READY_GRID, 20000); return tapAll(b, [['.mart-cast [data-mix]', null, `document.querySelector('.mart-cast [data-mix][aria-pressed="true"]')`], ['.mart-cast [data-group="halo"]', null, `document.querySelector('#mart-cast-halo input[type=checkbox]')`], ['#mart-cast-halo .mart-cast-r', { nth: 0 }], ['#mart-cast-halo .mart-cast-r', { nth: 1 }]]); } },
    { group: '글꾸', where: '글꾸 · 바탕 펼침', url: 'mart/geulkku/', root: '.mart-cast', open: async b => { await b.until(READY_GRID, 20000); return tapAll(b, [['.mart-cast [data-paper]', null, `document.querySelector('#mart-paper-panel input[name=bl-texture]')`], ['#mart-paper-panel input[name=bl-paper][value=sky]', null, `document.querySelector('#mart-paper-panel input[name=bl-paper][value=sky]:checked')`], ['#mart-paper-panel input[name=bl-texture][value=lined]', null, `document.querySelector('#mart-paper-panel input[name=bl-texture][value=lined]:checked')`]]); } },
    { group: '글꾸', where: '글꾸 · 상세', url: 'mart/geulkku/', root: '.mart-sheet', open: async b => { const r = await openSheetBy(b); if (r !== true) return r; await b.until(`document.querySelector('.mart-sheet[open] .mart-sheet-preview > :not(.mart-sheet-wait)')`, 15000).catch(() => { }); await b.sleep(500); return true; } },
    { group: '글꾸', where: '글꾸 · 시식', url: 'mart/geulkku/', root: '.mart-taste', open: async b => { const r = await openSheetBy(b); if (r !== true) return r; const t = await tapAll(b, [['.mart-sheet[open] [data-act="taste"]', null, `document.querySelector('.mart-taste[open]')`], ['.mart-taste[open] [data-taste="sample"]']]); if (t !== true) return t; await b.until(`document.querySelector('.mart-taste[open] .mart-taste-preview > :not(.mart-sheet-wait)')`, 15000).catch(() => { }); await b.sleep(500); return true; } },
    { group: '글꾸', where: '글꾸 · 내 로그 설정', url: 'mart/geulkku/', root: '.mart-taste', open: async b => { await b.until(READY_GRID, 20000); const t = await tapAll(b, [['.mart-mylog', null, `document.querySelector('.mart-taste.is-setup[open]')`]]); if (t !== true) return t; await b.sleep(400); return true; } },
    { group: '글꾸', where: '글꾸 · 내 로그 켬', url: 'mart/geulkku/', root: '.mart-head', open: async b => { await b.until(READY_GRID, 20000); const t = await tapAll(b, [['.mart-mylog', null, `document.querySelector('.mart-taste.is-setup[open]')`], ['.mart-taste[open] [data-taste="sample"]'], ['.mart-taste[open] [data-taste="apply"]', null, `document.querySelector('.mart-mylog[aria-pressed="true"]')`]]); if (t !== true) return t; await b.eval(`document.querySelector('.mart-taste[open]')?.close();true`); await b.sleep(400); return true; } },
    { group: '글꾸', where: '글꾸 · 담김 카드', url: 'mart/geulkku/', root: '.mart-card.is-picked', open: async b => { await b.until(READY_GRID, 20000); const t = await tapAll(b, [['.mart-card:not([hidden]) .mart-pick', null, `document.querySelector('.mart-card.is-picked')`]]); if (t !== true) return t; await b.sleep(900); await b.eval(`document.querySelector('.mart-card.is-picked').scrollIntoView({block:'center'});true`); await b.sleep(300); return true; } },
    { group: '글꾸', where: '노래방 · 만들기', url: 'mart/kara/', root: null, open: async b => { await b.until(`document.querySelector('.kb-song select')`, 15000); await b.sleep(400); return true; } },
    { group: '글꾸', where: '노래방 · 만든 글', url: 'mart/kara/', root: null, open: async b => { await b.until(`document.querySelector('.kb-song select')`, 15000); const t = await tapAll(b, [['[data-act="add"]'], ['[data-act="make"]', null, `document.querySelector('.kb-out:not([hidden]) .kb-frame')`]]); if (t !== true) return t; await b.sleep(600); return true; } },
    { group: '장바구니', where: '장바구니 · 담김', url: 'mart/geulkku/', root: '.mart-cart', open: async b => { await b.until(READY_GRID, 20000); const t = await tapAll(b, [['.mart-card:not([hidden]) .mart-pick', null, `document.querySelector('.mart-card.is-picked')`]]); if (t !== true) return t; await b.sleep(900); const r = await tapAll(b, [['.mart-cart-btn', null, `document.querySelector('.mart-cart.open')`]]); if (r !== true) return r; await b.sleep(500); return (await b.eval(`!document.querySelector('.mart-cart').classList.contains('is-empty')`)) || '바구니가 비어 있어요'; } },
    { group: '장바구니', where: '장바구니 · 빔', url: 'mart/geulkku/', root: '.mart-cart', open: async b => { await b.until(READY_GRID, 20000); const r = await tapAll(b, [['.mart-cart-btn', null, `document.querySelector('.mart-cart.open')`]]); if (r !== true) return r; await b.sleep(500); return true; } },
    { group: '액자', where: '액자 · 목록', url: 'mart/frames/', root: null, open: async b => { await b.until(READY_GRID, 20000); await b.sleep(1200); return true; } },
    { group: '액자', where: '액자 · 방향 · 디자인 고름', url: 'mart/frames/', root: '.mart-tools', open: async b => { await b.until(READY_GRID, 20000); return tapAll(b, [['[data-filter="orient"] button', { nth: 1 }], ['[data-filter="style"] button', { nth: 1 }]]); } },
    { group: '액자', where: '액자 · 띠 접힘(고름 요약)', url: 'mart/frames/', root: '.mart-tools', widths: [390], open: async b => { await b.until(READY_GRID, 20000); const t = await tapAll(b, [['[data-filter="orient"] button', { nth: 1 }], ['.mart-chips button', { nth: 3 }]]); if (t !== true) return t; return barFold(b); } },
    { group: '액자', where: '액자 · 방', url: 'mart/frames/', root: '.mart-room', open: async b => { await b.until(READY_GRID, 20000); await b.sleep(600); const r = await tapAll(b, [['.mart-card .mart-preview.frame', null, `document.querySelector('.mart-room[open]')`]]); if (r !== true) return r; await b.sleep(900); return true; } },
    { group: '액자', where: '액자 · 담김 카드', url: 'mart/frames/', root: '.mart-card.is-picked', open: async b => { await b.until(READY_GRID, 20000); await b.sleep(600); const t = await tapAll(b, [['.mart-card .mart-pick', null, `document.querySelector('.mart-card.is-picked')`]]); if (t !== true) return t; await b.sleep(900); await b.eval(`document.querySelector('.mart-card.is-picked').scrollIntoView({block:'center'});true`); await b.sleep(300); return true; } },
    { group: '지니', where: '지니 · 처음', url: 'mart/geulkku/', root: 'main.gn', open: b => genieRun(b, false) },
    { group: '지니', where: '지니 · 글꾸 결과', url: 'mart/geulkku/', root: 'main.gn', open: b => genieRun(b, true) },
    { group: '지니', where: '지니 · 액자 결과', url: 'mart/frames/', root: 'main.gn', open: b => genieRun(b, true) },
];
// 화면 목록 누락 0(사이트 전용 규칙): 이 화면들은 두 폭 모두에서 열려야 해요
const REQUIRED = ['홈 · 머리줄', '홈 · 마트 메뉴', '글꾸 · 목록', '글꾸 · 상세', '글꾸 · 시식', '액자 · 목록', '액자 · 방', '장바구니 · 담김', '지니 · 글꾸 결과', '지니 · 액자 결과'];
const RESET = `(()=>{try{localStorage.removeItem('bl-mart-chips-folded');localStorage.removeItem('bl-mart-cart-v1');localStorage.removeItem('bl-mart-tone-v1');sessionStorage.clear()}catch{}return true})()`;

// ---------------------------------------------------------------- 모으기
const variants = new Map(), colorBad = new Map(), fonts = {}, screens = [];
let recTotal = 0;
const scrollStep = (b, rootSel, first) => b.eval(`(()=>{const root=${rootSel ? `document.querySelector(${JSON.stringify(rootSel)})` : 'document.scrollingElement'};if(!root)return false;
 const sc=root===document.scrollingElement?root:[root,...root.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)&&e.getClientRects().length&&e.clientHeight>120).sort((a,b)=>b.clientHeight*b.clientWidth-a.clientHeight*a.clientWidth)[0];
 if(!sc)return false;if(${first}){sc.scrollTop=0;return true}const before=sc.scrollTop;sc.scrollTop+=Math.max(1,sc.clientHeight*.75);return sc.scrollTop>before+1})()`);
async function scan(b, cond, screen) {
    const rootSel = screen.root, where = screen.where;
    await b.eval(COLLECT); await b.eval(MEASURE);
    await b.eval(`(()=>{for(const e of document.querySelectorAll('[data-uic]'))delete e.dataset.uic;for(const e of document.querySelectorAll('[data-px]'))delete e.dataset.px;delete document.body.dataset.pxN;return true})()`);
    await scrollStep(b, rootSel, true); await b.sleep(150);
    let n = 0;
    const maxSteps = rootSel ? 12 : 6;   // 목록 화면은 같은 카드가 되풀이라 여섯 화면 높이까지만
    for (let k = 0; k < maxSteps; k++) {
        let r; try { r = JSON.parse(await b.eval(`JSON.stringify(window.__siteCollect(${JSON.stringify(rootSel)}, ${JSON.stringify(where)}))`, 60000)); } catch (e) { return { error: String(e.message || e).slice(0, 160) }; }
        if (r.error) return { error: r.error };
        for (const x of r.recs) {
            n++; const key = x.kind + '|' + x.sig; let v = variants.get(key);
            if (!v) { v = { kind: x.kind, sig: x.sig, count: 0, where: [], ours: true, examples: [] }; variants.set(key, v); }
            v.count++; if (v.where.length < 12 && !v.where.includes(`${cond.key} ${where}`)) v.where.push(`${cond.key} ${where}`);
            if (v.examples.length < 4) v.examples.push({ where, path: x.path, text: x.text, bad: x.bad, ours: true });
        }
        for (const c of r.colorBad) { const key = c.p + '|' + c.n + '|' + c.path; if (!colorBad.has(key)) colorBad.set(key, { ...c, where: `${cond.key} ${where}` }); }
        for (const [f, ps] of Object.entries(r.fontSeen)) { fonts[f] ||= { n: 0, where: [] }; fonts[f].n++; if (fonts[f].where.length < 5) fonts[f].where.push(where + ' · ' + ps[0]); }
        if (!(await scrollStep(b, rootSel, false))) break; await b.sleep(180);
    }
    await scrollStep(b, rootSel, true); await b.sleep(120);
    recTotal += n;
    for (const rule of rules) if (rule.perScreen) {
        try { addFindings(rule, await rule.perScreen({ ev: (e, ms) => b.eval(e, ms), shot: clip => b.shot(null, { clip }), dpr: b.dpr, screen: { group: screen.group, where }, cond: { W: cond.W, DPR: cond.DPR, key: cond.key }, rootSel, out: OUT }), cond.key); }
        catch (e) { ruleErrors.push(`${rule.id} · ${cond.key} · ${where}: ${String(e.message || e).slice(0, 120)}`); }
    }
    return { recs: n };
}

// ---------------------------------------------------------------- 돌리기
const CONDS = [{ W: 390, H: 844, DPR: 3, mobile: true, key: '390' }, { W: 1440, H: 900, DPR: 2, mobile: false, key: '1440' }].filter(c => WANT_W === 'all' || String(c.W) === WANT_W);
const srv = await serve(SITE, PORT);
log(`서버 ${srv.url} ← ${SITE}`);
const b = await launch(path.resolve(arg('--prof', path.join(HERE, '_prof'))), CDP);   // --prof <폴더>: 크롬 사용자 폴더(짧은 경로로)
b.url = srv.url;
await b.calm(true);
try {
    for (const cond of CONDS) {
        await b.size(cond.W, cond.H, cond.mobile, cond.DPR);
        for (const screen of SCREENS) {
            if (ONLY && !ONLY.some(o => screen.where.includes(o) || screen.group === o)) continue;
            if (screen.widths && !screen.widths.includes(cond.W)) { screens.push({ cond: cond.key, group: screen.group, where: screen.where, absent: true }); continue; }
            const errAt = b.errors.length;
            const row = { cond: cond.key, group: screen.group, where: screen.where, opened: false };
            try {
                if ((await b.eval(`location.origin`).catch(() => '')) !== srv.url.replace(/\/$/, '')) await b.goto(srv.url + 'lemon.svg');
                await b.eval(RESET).catch(() => { });
                await b.goto(`${srv.url}${screen.url}`);
                await b.until(`document.readyState==='complete'`, 15000).catch(() => { });
                const r = await screen.open(b);
                if (r !== true) { row.why = String(r); }
                else {
                    if (screen.root) { const ok = await b.eval(`!!document.querySelector(${JSON.stringify(screen.root)})?.getClientRects().length`); if (!ok) row.why = `${screen.root} 가 보이지 않아요`; }
                    if (!row.why) { const s = await scan(b, cond, screen); if (s.error) row.why = s.error; else { row.opened = true; row.recs = s.recs; } }
                }
            } catch (e) { row.why = String(e.message || e).slice(0, 160); }
            const errs = b.errors.slice(errAt).filter(e => !/jsdelivr|favicon/.test(e));
            row.console = errs;
            for (const e of errs) findings.push({ rule: 'console', cond: cond.key, key: `console|${cond.key}|${screen.where}|${e.slice(0, 60)}`, msg: `콘솔 오류: ${cond.key} · ${screen.where} · ${e}` });
            screens.push(row);
            log(`${cond.key} · ${screen.where} · ${row.opened ? `잼 ${row.recs}` : '못 엶 — ' + row.why}${errs.length ? ` · 콘솔 ${errs.length}` : ''}`);
        }
    }
} finally { await b.close(); await srv.close(); }

// ---------------------------------------------------------------- 규칙(모은 뒤)
const V = [...variants.values()], C = [...colorBad.values()];
for (const rule of rules) if (rule.afterAll) { try { addFindings(rule, rule.afterAll({ variants: V, screens, colorBad: C, cond: { key: 'all' } }), 'all'); } catch (e) { ruleErrors.push(`${rule.id}: ${String(e.message || e).slice(0, 160)}`); } }
for (const cond of CONDS) for (const w of REQUIRED) if (!ONLY && !screens.some(s => s.cond === cond.key && s.where === w && s.opened)) findings.push({ rule: 'screens', cond: cond.key, key: `screens|${cond.key}|${w}`, msg: `화면 목록 누락 ${cond.key} · ${w}(두 폭 모두 열어야 해요)` });
for (const s of screens.filter(s => !s.absent && !s.opened)) findings.push({ rule: 'open', cond: s.cond, key: `open|${s.cond}|${s.where}`, msg: `못 연 화면 ${s.cond} · ${s.where} — ${s.why || '까닭 모름'}` });
for (const e of ruleErrors) findings.push({ rule: 'rule-error', cond: 'all', key: `rule-error|${e.split(':')[0]}`, msg: `규칙 모듈 오류 ${e}` });

// ---------------------------------------------------------------- 기준선 · 보고
let baseline = { known: {} };
try { baseline = JSON.parse(fs.readFileSync(path.join(HERE, 'baseline.json'), 'utf8')); } catch { }
const known = baseline.known || {};
const fresh = findings.filter(f => !(f.key in known));
const byRule = {}; for (const f of findings) (byRule[f.rule] ||= []).push(f);
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const counted = screens.filter(s => !s.absent), opened = counted.filter(s => s.opened);
let md = `# 사이트 디자인 리그 — ${OUT.split(/[\\/]/).at(-1)}\n\n`;
md += `- ${new Date().toISOString()} · ${Math.round((Date.now() - t0) / 1000)}초 · 폭 ${CONDS.map(c => `${c.W}(배율 ${c.DPR})`).join(' · ')} · 화소 측정 ${PIXEL ? '켬' : '끔'}\n`;
md += `- **연 화면 ${opened.length} / ${counted.length}**${counted.length - opened.length ? ` — 못 연 화면 ${counted.length - opened.length}개` : ' — 전부 열었어요'} · 이 폭에 없어 뺀 화면 ${screens.length - counted.length}\n`;
md += `- 부품 기록 ${recTotal} · 변형 ${V.length} · 팔레트 밖 색 ${C.length} · 글꼴 ${Object.keys(fonts).join(' · ') || '-'}\n`;
md += `- **위반 ${findings.length}건 · 새 ${fresh.length}건**(기준선 known ${Object.keys(known).length}개)\n- 규칙: ${rules.map(r => `${r.id}(${r.file})`).join(' · ')}${ruleErrors.length ? `\n- 규칙 오류: ${ruleErrors.join(' / ')}` : ''}\n`;
md += `\n## 규칙별 위반(알려진 것 = baseline.json 의 known)\n`;
const order = [...rules.map(r => r.id), 'console', 'open', 'screens', 'rule-error'];
for (const id of order) { const list = byRule[id] || []; const r = rules.find(x => x.id === id); md += `\n### ${r?.title || id} — ${list.length}건(새 ${list.filter(f => !(f.key in known)).length})\n\n`; for (const f of list.slice(0, 300)) md += `- ${f.key in known ? `알려짐(${esc(known[f.key])})` : '**새**'} · ${esc(f.msg)}\n`; if (list.length > 300) md += `- … 외 ${list.length - 300}건(site-rig.json)\n`; }
md += `\n## 화면 ${screens.length}\n\n| 폭 | 무리 | 화면 | 상태 | 기록 | 콘솔 |\n|---|---|---|---|---|---|\n`;
for (const s of screens) md += `| ${s.cond} | ${esc(s.group)} | ${esc(s.where)} | ${s.absent ? '이 폭에 없음' : s.opened ? '잼' : '못 엶'} | ${s.opened ? s.recs : esc(s.why || '')} | ${(s.console || []).length || ''} |\n`;
md += `\n## 변형 목록(종류 · 서명 · 수 · 어디)\n\n`;
for (const kind of [...new Set(V.map(v => v.kind))].sort()) { md += `\n**${kind}**\n`; for (const v of V.filter(v => v.kind === kind).sort((a, b) => b.count - a.count)) md += `- ${esc(v.sig)} ×${v.count} · ${esc(v.where.slice(0, 3).join(' / '))} · ${esc((v.examples[0]?.path || '').slice(-60))}\n`; }
fs.writeFileSync(path.join(OUT, 'SITE-RIG.md'), md);
let centerRecords = []; try { centerRecords = (await import('./rules/center.mjs')).records; } catch { }
fs.writeFileSync(path.join(OUT, 'site-rig.json'), JSON.stringify({ at: stamp.toISOString(), conds: CONDS, screens, variants: V, colorBad: C, fonts, findings, fresh: fresh.map(f => f.key), known: Object.keys(known).length, ruleErrors, center: centerRecords }, null, 1));
log(`끝 · 연 화면 ${opened.length}/${counted.length} · 위반 ${findings.length}(새 ${fresh.length}) · ${Math.round((Date.now() - t0) / 1000)}초 → ${path.join(OUT, 'SITE-RIG.md')}`);
process.exitCode = fresh.length ? 1 : 0;
