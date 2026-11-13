// 로그 복사 「전환 넣기」 — 진짜 브라우저(헤드리스 하나)에서: 깡통 붙임 흉내(shadow root · details 직속 내용을 class 없는 div 로 감쌈 · 빈 줄 끼움) 안에서
//   전환 달린 복사 글의 낮 → 밤 → 낮이 그 글꾸의 낮 판 · 밤 판 단독 복사 글과 계산된 색 · 크기 · 자리까지 같은지 봐요.
//   대상: 블루레몬 추천 32판(낮 시작 · 밤 시작) · 마트에서 받은 심플 글꾸 표본 9틀 · 기본 글꾸 새 틀 18(정보 칸 끔 · 탭) · 조합(숨긴 글 · 갤러리 틀의 그림 · 여러 메시지 · 캐릭터 색 · 스타일 · 움직임 · 레몬)
//   같이 보는 것: 알약 하나 · 켜진 칸이 판과 맞음 · 자리(틀 위 오른쪽 끝 8px / 탭 띠 안) · 깡통 빈 줄이 안 보임 · 가로 넘침 0 · 눌러 연 소품이 전환 뒤에도 그대로
//   미리보기 길(src/log-copy-flip.js flipArm · flipPress · flipStrip): 알약을 얹고 눌러 본 모습이 반대 판 단독과 같고, 걷어 낸 사본이 얹기 전 글과 글자까지 같은지
//   CI 에는 안 넣어요(브라우저 필요). 실행: FLIP_BROWSER_DRIVER=<playwright-core 폴더> CHROME_PATH=<크롬 계열 실행 파일> node tools/tests/log-copy-flip-browser.mjs . [--shots <폴더>] [--only k2,card]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : ''; };
assert.ok(process.env.FLIP_BROWSER_DRIVER && process.env.CHROME_PATH, '브라우저 경로를 지정해 주세요: FLIP_BROWSER_DRIVER(playwright-core 폴더) · CHROME_PATH(실행 파일)');
const { chromium } = createRequire(import.meta.url)(path.resolve(process.env.FLIP_BROWSER_DRIVER));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const flip = await load('src/log-copy-flip.js');
const { renderLog } = await load('src/log-copy-presets.js');
const { BASIC_IDS } = await load('src/log-copy-basic.js');
const { loadPicks, pickEntry } = await load('src/log-copy-picks.js');
const { readMart, addMartItems } = await load('src/mart-import.js');
const setMod = await load('src/log-copy-simple-set.js');
const caps = await load('src/geulkku-mart/caps-table.js');
const { liftForCopy } = await load('src/log-copy-lift.js');
const { stripRowMarks } = await load('src/log-copy-spoiler.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const picks = await loadPicks();
const more = JSON.parse(read('tools/tests/fixtures/mart-more-sample.json'));
const only = arg('only') ? arg('only').split(',') : null, shots = arg('shots') ? path.resolve(arg('shots')) : '';
if (shots) fs.mkdirSync(shots, { recursive: true });

// ── 글 만들기(시트가 그리는 길 그대로 · 글자 단계) ─────────────
const text = s => ({ t: 'text', text: s });
const band = s => ({ t: 'el', block: false, style: { 'background-image': 'linear-gradient(#ffd, #ffd)' }, children: [text(s)] });
// 채팅의 그림은 갤러리 틀의 사진 칸으로 들어가요(시트의 images — 주소 · 설명) · 1×1 PNG 셋
const PICS = ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='].map((b, i) => ({ src: `data:image/png;base64,${b}`, alt: `사진 ${i + 1}` }));
const MODEL = { base: { color: '#dddddd', bg: '#111111' }, chatTitle: '비 그친 뒤', messages: [
    { name: '깡통', time: 1, nodes: [text('창밖을 보았다.'), { t: 'br' }, band('「비가 그쳤네.」')] },
    { name: '깡캐', time: 2, nodes: [band('「응, 나가 볼까?」'), { t: 'hr' }, text('그리고 지문.')] },
] };
const sp = { line: 'rgba(20, 20, 24, 0.1)', raised: '#f5f5f6', muted: '#5f6168', family: 'sans-serif', tracking: '0' };
const COMBO = { ...MODEL, messages: [
    { name: '깡통', time: 1, nodes: [text('문을 열었다. '), { t: 'el', block: false, tag: 'span', kind: 'spoiler', sp, style: {}, children: [text('숨긴 글이에요')] }, { t: 'br' }, band('「다녀왔어.」'), { t: 'el', block: false, tag: 'strong', kind: 'strong', style: {}, children: [text(' 굵은 말')] }] },
    { name: '깡캐', time: 2, nodes: [band('「이것 봐.」')] },
    ...Array.from({ length: 6 }, (_, i) => ({ name: ['셋째', '깡통', '깡캐'][i % 3], time: 3 + i, nodes: [text(`${i + 3}번째 지문이에요.`), { t: 'hr' }, band(`「${i + 3}번째 대사.」`)] })),
] };
const lookup = name => ({ 깡통: '#e05a5a', 깡캐: '#3c9b5f', 셋째: '#8a63d2' })[name] ?? null;
const FIELDS = { title: '비 그친 뒤', mark: 'LOG', model: '모델', prompt: '프롬프트', char: '깡통' };
const simpleDraw = (mine, o = {}) => mode => renderLog(o.model ?? MODEL, { simple: mine, setMod, caps: caps.capsRow(mine.frame.key), mode, lookup: o.lookup === false ? () => null : lookup, fields: { title: FIELDS.title }, names: true, lemonLink: !!o.lemon, rows: true });
const basicDraw = (shape, o = {}) => mode => renderLog(o.model ?? MODEL, { shape, fields: FIELDS, images: o.images ?? [], names: true, lemonLink: !!o.lemon, mode, lookup, info: o.info ?? 'off', height: o.height ?? '', marks: false });
const full = (html, simple) => { const shown = simple ? stripRowMarks(html) : html; return liftForCopy(shown, motionStyleFor(shown)).full; };
// 견줄 단독 판에는 공용 함수가 같이 고치는 「깡통 빈 줄 막기」 규칙만 같은 꼴로 맞춰요 — 틀이 든 옛 규칙(details>summary~:not([class]))은 깡통이 details 안 내용을 감싼 class 없는 칸까지 숨겨요
//   (추천 택배 상자 · 즉석 카메라처럼 그 규칙이 든 틀에 숨긴 글을 넣은 글 — 전환을 단 글은 고쳐진 채로 나가요)
const GUARD = 'details>summary~:not([class]){display:none}';
const fixGuard = h => h.split(GUARD).join('details>summary~:not([class]):not(:has([class])){display:none}');
const received = (key, set = { blGeulkku: 2 }) => {
    const raw = more.items[key], s = { logCopy: { custom: [] } };
    addMartItems(s, readMart(JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: raw.name, html: raw.html, set }] })).items);
    return JSON.parse(JSON.stringify(s.logCopy.custom[0]));
};
const pickOf = (id, set) => pickEntry(picks, [], id, () => ({ custom: [], pickSet: set ? { [id]: set } : {} }));
const looks = setMod.LOOKS.map(x => x.id);
const tuned = () => setMod.withSize(setMod.withMotion(setMod.withStyle({ blGeulkku: 2 }, looks[1]), 'l'), 2);

/** @type {{ id: string, draw: (mode: string) => string, simple: boolean, start: string, where?: string, preview?: boolean }[]} */
const cases = [];
for (const p of picks) for (const start of ['light', 'dark']) cases.push({ id: `${p.id.replace('simple-', '')} ${start === 'light' ? '낮' : '밤'}시작`, draw: simpleDraw(pickOf(p.id), { lemon: true }), simple: true, start, preview: start === 'light' });
for (const key of Object.keys(more.items)) cases.push({ id: `받은 ${key}`, draw: simpleDraw(received(key)), simple: true, start: 'light', preview: true });
for (const id of BASIC_IDS) for (const info of ['off', 'tab']) for (const start of info === 'tab' ? ['light', 'dark'] : ['light']) {
    cases.push({ id: `기본 ${id} ${info === 'tab' ? '탭' : '끔'} ${start === 'light' ? '낮' : '밤'}시작`, draw: basicDraw(id, { info, lemon: true }), simple: false, start, where: info === 'tab' && id !== 'window' ? 'band' : 'above', preview: start === 'light' });
}
for (const id of ['simple-k2', 'simple-k8', 'simple-k1014', 'simple-k1222']) {
    cases.push({ id: `조합 ${id.replace('simple-', '')} 숨긴글·여덟메시지`, draw: simpleDraw(pickOf(id), { model: COMBO, lemon: true }), simple: true, start: 'light', preview: true });
    cases.push({ id: `조합 ${id.replace('simple-', '')} 스타일·움직임강·글크게`, draw: simpleDraw(pickOf(id, tuned()), { model: COMBO }), simple: true, start: 'dark' });
    cases.push({ id: `조합 ${id.replace('simple-', '')} 캐릭터색모름`, draw: simpleDraw(pickOf(id), { lookup: false }), simple: true, start: 'light' });
    cases.push({ id: `조합 ${id.replace('simple-', '')} 소품캐릭터색`, draw: simpleDraw(pickOf(id, { blGeulkku: 2, themeCast: { main: '#2266cc', other: 'orig' } }), { model: COMBO }), simple: true, start: 'light' });
}
for (const id of ['card', 'messenger', 'diary']) {
    cases.push({ id: `조합 기본 ${id} 탭·숨긴글·높이중간`, draw: basicDraw(id, { info: 'tab', height: 'm', model: COMBO, lemon: true }), simple: false, start: 'light', where: 'band', preview: true });
    cases.push({ id: `조합 기본 ${id} 칩·여덟메시지`, draw: basicDraw(id, { info: 'chip', model: COMBO }), simple: false, start: 'dark', where: 'above' });
}
for (const id of ['gallery-strip', 'gallery-strip-polaroid', 'gallery-grid', 'gallery-grid-polaroid']) {
    cases.push({ id: `조합 기본 ${id} 그림셋·탭`, draw: basicDraw(id, { info: 'tab', images: PICS, model: COMBO }), simple: false, start: 'light', where: 'band', preview: true, pics: 3 });
    cases.push({ id: `조합 기본 ${id} 그림셋`, draw: basicDraw(id, { images: PICS }), simple: false, start: 'dark', where: 'above', pics: 3 });
}

// ── 페이지 안 ──────────────────────────────────────────────────
function setup({ a, b, c, width }) {
    document.body.innerHTML = ''; window.__h = {};
    for (const [k, html] of [['a', a], ['b', b], ['c', c]]) {
        const host = document.createElement('div'); host.id = `h${k}`; host.style.cssText = `position:absolute;left:8px;top:8px;width:${width}px`;   // 셋을 같은 자리에 겹쳐요(글자 자리가 같게)
        const sh = host.attachShadow({ mode: 'open' });
        sh.innerHTML = `<style>.content{color:rgb(31,41,55);font-size:15px;line-height:1.6;word-break:break-word}.content details{margin:.25rem 0}:where(.content p){margin:0;line-height:1.6}</style><div class="content">${html}</div>`;
        document.body.append(host); window.__h[k] = sh;
        // 깡통이 details 에 하는 일: 안이 비었으면 빈 줄 <div><br></div> 를 끼우고 · 내용이 있으면 class 없는 <div> 로 한 번 감싸요
        for (const d of sh.querySelectorAll('details')) {
            const kids = [...d.childNodes].filter(n => !(n.nodeType === 1 && n.tagName === 'SUMMARY') && !(n.nodeType === 3 && !n.textContent.trim()));
            const w = document.createElement('div'); if (kids.length) w.append(...kids); else w.append(document.createElement('br')); d.append(w);
        }
        for (const el of sh.querySelectorAll('[id],[for],[name]')) { el.removeAttribute('id'); el.removeAttribute('for'); el.removeAttribute('name'); }
        for (const el of sh.querySelectorAll('script,link,input,button')) el.remove();
        // 숨긴 글 알약: 전환을 싣는 글은 시트가 무채로 바꿔 내요(flipStrip — 아래 미리보기 길에서 확인). 여기서는 세 판에 같은 꼴을 입혀 그 모습으로 견줘요
        for (const l of sh.querySelectorAll('.blsp-l')) Object.assign(l.style, { borderColor: '#8884', backgroundColor: 'transparent', color: 'inherit' });
    }
    const ya = window.__h.a.querySelector('.gk').getBoundingClientRect().top, yb = window.__h.b.querySelector('.gk').getBoundingClientRect().top;
    document.getElementById('ha').style.top = `${8 - (ya - yb)}px`;   // 전환 달린 판은 알약 줄만큼 틀이 아래 — 틀끼리 같은 자리에
}
async function settle() {
    const raf = () => new Promise(r => requestAnimationFrame(() => r()));
    for (let i = 0; i < 3; i++) {
        await raf();
        for (const sh of Object.values(window.__h)) for (const an of sh.querySelector('.content').getAnimations({ subtree: true })) {
            try { const t = an.effect && an.effect.getComputedTiming(); if (t && t.iterations === Infinity) { an.pause(); an.currentTime = 0; } else an.finish(); } catch { /* 끝난 움직임 */ }
        }
    }
    await raf();
}
function click({ host, sel }) { let n = 0; for (const e of window.__h[host].querySelectorAll(sel)) { e.click(); n++; } return n; }
function compare({ x, y }) {
    const P = ['color', 'webkitTextFillColor', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'borderTopWidth', 'borderLeftWidth', 'outlineColor', 'boxShadow', 'textShadow', 'opacity', 'filter', 'fill', 'stroke', 'display', 'visibility', 'transform', 'maskImage', 'webkitMaskImage', 'clipPath', 'colorScheme', 'webkitTextStrokeColor', 'textDecorationColor', 'mixBlendMode', 'fontSize', 'fontWeight'];
    const gx = window.__h[x].querySelector('.gk'), gy = window.__h[y].querySelector('.gk');
    if (!gx || !gy) return { n: -1, ex: ['틀이 없어요'] };
    const ex = [gx, ...gx.querySelectorAll('*')].filter(e => e.tagName !== 'STYLE'), ey = [gy, ...gy.querySelectorAll('*')].filter(e => e.tagName !== 'STYLE');
    if (ex.length !== ey.length) return { n: -1, ex: [`요소 수 ${ex.length} ≠ ${ey.length}`] };
    const rx = gx.getBoundingClientRect(), ry = gy.getBoundingClientRect(), out = []; let n = 0;
    const vis = e => (e.checkVisibility ? e.checkVisibility() : e.getClientRects().length > 0);
    for (let i = 0; i < ex.length; i++) {
        const shown = vis(ex[i]) || vis(ey[i]);
        for (const pe of [null, '::before', '::after']) {
            const a = getComputedStyle(ex[i], pe), b = getComputedStyle(ey[i], pe);
            if (pe && a.content === 'none' && b.content === 'none') continue;
            for (const p of (shown ? P : ['display'])) if (a[p] !== b[p]) { n++; if (out.length < 4) out.push(`${ex[i].className || ex[i].tagName}${pe || ''} ${p}: ${String(a[p]).slice(0, 50)} ≠ ${String(b[p]).slice(0, 50)}`); }
        }
        const ba = ex[i].getBoundingClientRect(), bb = ey[i].getBoundingClientRect();
        const d = Math.max(Math.abs((ba.left - rx.left) - (bb.left - ry.left)), Math.abs((ba.top - rx.top) - (bb.top - ry.top)), Math.abs(ba.width - bb.width), Math.abs(ba.height - bb.height));
        if (shown && d > 0.5 && (ba.width > 0 || bb.width > 0)) { n++; if (out.length < 4) out.push(`${ex[i].className || ex[i].tagName} 자리 · 크기 ${d.toFixed(1)}px`); }
    }
    return { n, ex: out };
}
function state() {
    const sh = window.__h.a, g = sh.querySelector('.gk'), t = sh.querySelector('.gkt-t'), k = sh.querySelector('details.gkt-k'), cs = e => getComputedStyle(e);
    const gb = g.getBoundingClientRect(), tb = t.getBoundingClientRect(), kb = k.getBoundingClientRect(), bandEl = g.querySelector('.gk-tq, .tq'), bb = bandEl ? bandEl.getBoundingClientRect() : null;
    const tabs = bandEl ? [...bandEl.children].map(e => e.getBoundingClientRect()).filter(r => r.width) : [];
    const content = sh.querySelector('.content');
    return {
        open: k.open, wraps: sh.querySelectorAll('.gkt').length, pills: sh.querySelectorAll('.gkt-t').length, words: t.textContent.trim(), label: t.getAttribute('aria-label'),
        sun: cs(sh.querySelector('.gkt-d')).backgroundColor, moon: cs(sh.querySelector('.gkt-n')).backgroundColor, sunInk: cs(sh.querySelector('.gkt-d .gkt-i')).backgroundColor, moonInk: cs(sh.querySelector('.gkt-n .gkt-i')).backgroundColor,
        props: [...g.querySelectorAll('details')].map(d => (d.open ? 1 : 0)).join(''),
        right: Math.round((gb.right - tb.right) * 10) / 10, gap: Math.round((gb.top - tb.bottom) * 10) / 10, pillH: Math.round(tb.height), pillW: Math.round(tb.width), boxH: Math.round(kb.height),
        inBand: bb ? tb.top >= bb.top - 0.5 && tb.bottom <= bb.bottom + 0.5 && tb.right <= bb.right + 0.5 : null,
        overTab: tabs.some(r => r.right > tb.left - 0.5 && r.left < tb.right + 0.5),
        overflow: content.scrollWidth - content.clientWidth,
        mark: [...content.children].filter(e => e.classList.contains('blq-log')).length,
    };
}
async function previewCheck({ now, other, plan, mod }) {
    const { flipArm, flipPress, flipStrip } = await import(mod);
    const frame = async (html) => { const f = document.createElement('iframe'); f.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:900px;border:0'; document.body.append(f); await new Promise((r) => { f.onload = r; f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:12px">${html}</body></html>`; }); return f; };
    const fa = await frame(now), fb = await frame(other), doc = fa.contentDocument;
    const P = ['color', 'webkitTextFillColor', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'boxShadow', 'opacity', 'filter', 'display', 'visibility', 'transform', 'fontSize', 'fontWeight'];
    const still = (d) => { for (const an of d.getAnimations()) { try { const t = an.effect && an.effect.getComputedTiming(); if (t && t.iterations === Infinity) { an.pause(); an.currentTime = 0; } else an.finish(); } catch { /* 끝난 움직임 */ } } };
    const same = () => {
        still(doc); still(fb.contentDocument);
        const gx = doc.body.querySelector(':scope > .gk'), gy = fb.contentDocument.body.querySelector(':scope > .gk');
        const ex = [gx, ...gx.querySelectorAll('*')].filter(e => e.tagName !== 'STYLE'), ey = [gy, ...gy.querySelectorAll('*')].filter(e => e.tagName !== 'STYLE');
        if (ex.length !== ey.length) return -1;
        let n = 0; for (let i = 0; i < ex.length; i++) { if (ex[i].classList.contains('blsp-l')) continue; /* 숨긴 글 알약 색은 일부러 무채로 바꿔요 */ const a = fa.contentWindow.getComputedStyle(ex[i]), b = fb.contentWindow.getComputedStyle(ey[i]); for (const p of P) if (a[p] !== b[p]) n++; }
        return n;
    };
    // 얹기 전 글(숨긴 글 알약 색만 무채로 맞춘 것 — flipStrip 이 알약 줄 없는 글에서 하는 일은 그것뿐이에요)
    const raw = doc.body.innerHTML, calm0 = doc.body.cloneNode(true); flipStrip(calm0, plan);
    const noInk = h => h.replace(/(<span class="blsp-l" style=")[^"]*"/g, '$1"');
    const before = calm0.innerHTML, root = doc.body.querySelector(':scope > .gk'), cls0 = root.className, labels = doc.querySelectorAll('.blsp-l').length;
    const bar = flipArm(doc, root, plan);
    const out = { onlyInk: noInk(before) === noInk(raw) && (before === raw) === !labels, calm: [...doc.querySelectorAll('.blsp-l')].every(l => l.style.color === 'inherit' && l.style.backgroundColor === 'transparent'), armed: !!bar && doc.querySelectorAll('[data-bl-dn]').length === 1 && bar.nextElementSibling === root, details: doc.querySelectorAll('[data-bl-dn] details, [data-bl-dn] summary').length, words: bar.textContent.trim(), editable: bar.getAttribute('contenteditable') };
    const pill = bar.querySelector('.gkt-t'), pr = pill.getBoundingClientRect(), rr = root.getBoundingClientRect();
    Object.assign(out, { pillW: Math.round(pr.width), pillH: Math.round(pr.height), right: Math.round((rr.right - pr.right) * 10) / 10, gap: Math.round((rr.top - pr.bottom) * 10) / 10 });
    out.modeOpen = flipPress(doc, root, plan); out.sameOther = same(); out.pressed = pill.getAttribute('aria-pressed');
    const strip = doc.body.cloneNode(true); flipStrip(strip, plan); out.stripOpen = strip.innerHTML === before;   // 반대 판을 보던 중에 복사해도 처음 판 · 알약 없음
    out.modeShut = flipPress(doc, root, plan); out.clsBack = root.className === cls0;
    const strip2 = doc.body.cloneNode(true); flipStrip(strip2, plan); out.stripShut = strip2.innerHTML === before;
    fa.remove(); fb.remove();
    return out;
}

// ── 돌리기 ─────────────────────────────────────────────────────
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:8px;background:#fff"></body></html>'); return; }
    const file = path.join(root, p);
    if (!p.startsWith('/src/') || !file.startsWith(path.join(root, 'src') + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }); res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const rows = []; let bad = 0;
try {
    for (const [label, width, viewport] of [['폰 375', 359, { width: 375, height: 900 }], ['PC 1280', 760, { width: 1280, height: 900 }]]) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 }), page = await ctx.newPage();
        await page.route('**/*', r => (/^(data|about):/.test(r.request().url()) || r.request().url().startsWith(base) ? r.continue() : r.abort()));   // 바깥으로 안 나가요
        await page.goto(`${base}/`);
        for (const c of cases) {
            if (only && !only.some(k => c.id.includes(k))) continue;
            if (label !== '폰 375' && !/^조합|탭|k1 |k2 |k8 |k1014/.test(c.id)) continue;   // PC 폭은 표본만(탭 띠 · 조합 · 몇 틀)
            const row = { 틀: c.id, 폭: label, 문제: [] };
            try {
                const light = c.draw('light'), dark = c.draw('dark'), now = c.start === 'light' ? light : dark, oth = c.start === 'light' ? dark : light;
                const L0 = full(light, c.simple), D0 = full(dark, c.simple), src = c.start === 'light' ? L0 : D0, L = fixGuard(L0), D = fixGuard(D0);
                if (L !== L0) row.빈줄규칙고침 = L0.split(GUARD).length - 1;
                const T = flip.flipCopy(src), plan = flip.flipPlan({ now, other: oth, mode: c.start, full: src });
                if (!T || !plan) { row.문제.push('전환이 안 달려요'); rows.push(row); bad++; continue; }
                if (c.pics && (T.match(/<img/g) || []).length < c.pics) row.문제.push(`그림 ${(T.match(/<img/g) || []).length}장(${c.pics}장이어야 해요)`);
                Object.assign(row, { 원래바이트: Buffer.byteLength(src), 늘어난바이트: plan.add, 열쇠: plan.key });
                const first = c.start === 'light' ? 'b' : 'c', second = first === 'b' ? 'c' : 'b';
                await page.evaluate(setup, { a: T, b: L, c: D, width }); await page.evaluate(settle);
                const cmp = async (name, y) => { const r = await page.evaluate(compare, { x: 'a', y }); row[name] = r.n; if (r.n) row.문제.push(`${name}: ${r.n}곳 — ${r.ex.join(' ¦ ')}`); };
                const toggle = async () => { await page.evaluate(click, { host: 'a', sel: '.gkt-t' }); await page.evaluate(settle); };
                const s0 = await page.evaluate(state);
                await cmp('닫힘·처음', first); await toggle(); const s1 = await page.evaluate(state); await cmp('닫힘·반대', second);
                if (shots && label === '폰 375' && /k2 낮|조합 기본 card 탭|조합 k1014 숨긴|gallery-grid-polaroid 그림셋·탭/.test(c.id)) { for (const [h, tag] of [['a', '전환-반대판'], [second, '단독-반대판']]) { await page.evaluate(k => { for (const x of ['a', 'b', 'c']) document.getElementById(`h${x}`).style.left = x === k ? '8px' : '-3000px'; }, h); await page.screenshot({ path: path.join(shots, `${c.id.replace(/[ ·]/g, '-')}-${tag}.png`), clip: { x: 0, y: 0, width: 375, height: 520 } }); } await page.evaluate(() => { for (const x of ['a', 'b', 'c']) document.getElementById(`h${x}`).style.left = '8px'; }); }
                await toggle(); const s2 = await page.evaluate(state); await cmp('닫힘·다시', first);
                if (shots && label === '폰 375' && /k2 낮|조합 기본 card 탭|조합 k1014 숨긴|gallery-grid-polaroid 그림셋·탭/.test(c.id)) { await page.evaluate(() => { for (const x of ['b', 'c']) document.getElementById(`h${x}`).style.left = '-3000px'; }); await page.screenshot({ path: path.join(shots, `${c.id.replace(/[ ·]/g, '-')}-전환-처음판.png`), clip: { x: 0, y: 0, width: 375, height: 520 } }); await page.evaluate(() => { for (const x of ['b', 'c']) document.getElementById(`h${x}`).style.left = '8px'; }); }
                for (const h of ['a', 'b', 'c']) await page.evaluate(click, { host: h, sel: '.gk summary' }); await page.evaluate(settle);
                const o0 = await page.evaluate(state);
                await cmp('열림·처음', first); await toggle(); const o1 = await page.evaluate(state); await cmp('열림·반대', second); await toggle(); const o2 = await page.evaluate(state); await cmp('열림·다시', first);
                // 11-13 해 · 달 둘 다 테마 파랑: 고른 쪽 = 옅은 파랑 칸(#D6E6F7) + 파랑 아이콘(#2264A5) · 안 고른 쪽 = 바탕 없음 + 회색 아이콘(#4F6279)
                const PICK = 'rgb(214, 230, 247)', INK = 'rgb(34, 100, 165)', GRAY = 'rgb(79, 98, 121)', OFF = 'rgba(0, 0, 0, 0)', dayFirst = c.start === 'light';
                const pill = (s, opened) => { const day = opened ? !dayFirst : dayFirst; return s.open === opened && s.sun === (day ? PICK : OFF) && s.moon === (day ? OFF : PICK) && s.sunInk === (day ? INK : GRAY) && s.moonInk === (day ? GRAY : INK); };
                if (!pill(s0, false) || !pill(s1, true) || !pill(s2, false) || !pill(o1, true) || !pill(o2, false)) row.문제.push('알약 켜진 칸이 판과 달라요');
                if (s0.wraps !== 1 || s0.pills !== 1) row.문제.push(`전환 ${s0.wraps}개 · 알약 ${s0.pills}개`);
                if (s0.words || s0.label !== '낮 · 밤 바꾸기') row.문제.push(`알약 글자 「${s0.words}」 · 이름 ${s0.label}`);
                if (s0.pillW !== 76 || s0.pillH !== 34) row.문제.push(`알약 크기 ${s0.pillW}×${s0.pillH}`);
                if (s0.boxH !== s0.pillH) row.문제.push(`전환 칸 높이 ${s0.boxH} ≠ 알약 ${s0.pillH}(깡통 빈 줄이 보여요)`);
                if (o1.props !== o0.props || o2.props !== o0.props || s1.props !== s0.props) row.문제.push(`전환하면 누른 소품 상태가 바뀌어요(${o0.props} → ${o1.props} → ${o2.props})`);
                const where = c.where ?? 'above'; row.자리 = where;
                if (where === 'above' && (Math.abs(s0.right) > 1 || Math.abs(s0.gap - 8) > 1)) row.문제.push(`알약 자리: 오른쪽 ${s0.right}px · 틀과 ${s0.gap}px(8px 여야 해요)`);
                if (where === 'band' && (!s0.inBand || s0.overTab)) row.문제.push(`탭 띠 자리: 띠 안 ${s0.inBand} · 탭과 겹침 ${s0.overTab} · 오른쪽 ${s0.right}px`);
                if (s0.overflow > 0 || o0.overflow > 0) row.문제.push(`가로 넘침 ${Math.max(s0.overflow, o0.overflow)}px`);
                if (s0.mark !== 1) row.문제.push(`.content 직속 blq-log ${s0.mark}개(코멘트 글줄 규칙이 안 걸려요)`);
                if (c.preview && label === '폰 375') {
                    const pv = await page.evaluate(previewCheck, { now, other: oth, plan, mod: `${base}/src/log-copy-flip.js` });
                    row.미리보기 = pv;
                    if (!pv.armed || pv.details || pv.words || pv.editable !== 'false') row.문제.push(`미리보기 알약 꼴: ${JSON.stringify(pv)}`);
                    if (!pv.onlyInk || !pv.calm) row.문제.push(`숨긴 글 알약 색 말고 다른 것이 바뀌었거나 무채로 안 바뀌었어요(${pv.onlyInk} · ${pv.calm})`);
                    if (pv.sameOther !== 0) row.문제.push(`미리보기에서 누른 모습이 반대 판 단독과 ${pv.sameOther}곳 달라요`);
                    if (pv.modeOpen === c.start || pv.modeShut !== c.start || pv.pressed !== 'true' || !pv.clsBack) row.문제.push(`미리보기 누름 상태: ${pv.modeOpen} → ${pv.modeShut} · class 되돌림 ${pv.clsBack}`);
                    if (!pv.stripOpen || !pv.stripShut) row.문제.push(`알약을 걷은 사본이 얹기 전 글과 달라요(누른 채 ${pv.stripOpen} · 닫은 채 ${pv.stripShut})`);
                    if (pv.pillW !== 76 || pv.pillH !== 34) row.문제.push(`미리보기 알약 크기 ${pv.pillW}×${pv.pillH}`);
                    if (where === 'above' && (Math.abs(pv.right) > 1 || Math.abs(pv.gap - 8) > 1)) row.문제.push(`미리보기 알약 자리: 오른쪽 ${pv.right}px · 틀과 ${pv.gap}px`);
                }
            } catch (error) { row.문제.push(`오류: ${error.message.split('\n')[0]}`); }
            if (row.문제.length) { bad++; console.error(`FAIL ${label} ${c.id}\n   ${row.문제.join('\n   ')}`); }
            rows.push(row);
        }
        await ctx.close();
    }
} finally { await browser.close(); server.close(); }
if (shots) fs.writeFileSync(path.join(shots, '결과.json'), JSON.stringify(rows, null, 1));
const adds = rows.map(r => r.늘어난바이트).filter(Number.isFinite).sort((a, b) => a - b);
console.log(`log-copy-flip-browser: ${rows.length - bad} 통과 · ${bad} 실패 (틀 × 폭 ${rows.length}칸 · 늘어난 바이트 ${adds[0]} ~ ${adds[adds.length - 1]} · 가운데 ${adds[adds.length >> 1]})`);
if (bad) process.exit(1);
