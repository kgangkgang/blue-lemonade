// 11-12 글꾸 틀 능력표(G4 · 설계 `지시-1111/글꾸-조절-설계/설계.md` 3절) — 「이 틀이 받을 수 있는 조절」을 기계로 재서 mart/data/geulkku/caps.json 으로.
//   정적: 틀 <style> · 뼈대에 그 규칙 · 자리가 있는지(shape.js shapeCaps · motion-state.js motionCaps · texture.js · simple-frames.js · custom.js).
//   화면: 헤드리스 Chrome 하나(포트 19461 · 이 도구 전용 프로필) — 틀 × 낮밤 × 폭 640 · 375 · 320 에 조절을 가장 큰 값 · 작은 값으로 걸어(tools/geulkku-caps-page.html)
//         카드가 폭을 안 넘고 · 틀 밖으로 나가는 글 상자 · 소품과 글 겹침이 안 늘고 · 지문 위 공백이 1px 안이면 받는 것으로 적어요. 여백 · 폭 · 제목 크기 · 이름표는 통과한 범위만.
//   캐시: tools/_caps-cache.json(틀 HTML 낮밤 · 재는 쪽 원본의 해시가 같으면 다시 안 재요 — 저장소에 안 올려요).
//   부르는 법: node tools/geulkku-caps.mjs [--static](화면 재기 없이 정적만 · 범위 칸은 캐시에 있는 것만) [--check](다시 만들어도 같은지 — 쓰지 않아요)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MART = path.join(ROOT, 'mart'), DIR = path.join(MART, 'data/geulkku');
const OUT = path.join(DIR, 'caps.json'), CACHE = path.join(ROOT, 'tools/_caps-cache.json');
const STATIC = process.argv.includes('--static'), CHECK = process.argv.includes('--check');
const V = 'v=20261112a', imp = f => import(`${pathToFileURL(path.join(MART, f)).href}?${V}`);
const sf = await imp('simple-frames.js'), sh = await imp('shape.js'), ms = await imp('motion-state.js'), tx = await imp('texture.js'), cu = await imp('custom.js');
const WIDTHS = [640, 375, 320];
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const PAGE_SRC = ['tools/geulkku-caps-page.html', 'mart/shape.js', 'mart/look.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const TOOL_V = sha(PAGE_SRC);

const idx = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const items = {}; for (const c of Object.values(idx.chunks)) Object.assign(items, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
const keys = Object.keys(items).map(id => [id, (id.match(/^simple-((?:k|q)\d+)$/) || [])[1]]).filter(([, k]) => k).sort((a, b) => a[1].localeCompare(b[1], 'en', { numeric: true }));

/** 정적 — 두 판 모두 받아야 받음 */
function staticOf(html) {
    const both = ['light', 'dark'].map(mode => sf.toneSimple(html, sf.ORIGINAL, { mode }));
    const c = both.map(h => sh.shapeCaps(h)), m = ms.motionCaps(html), all = k => c.every(x => !!x[k]);
    return {
        band: c.every(x => x.band === 'color') ? 'color' : c.some(x => x.band) ? 'image' : false,
        bg: all('bg'), border: all('border'), radius: all('radius'), underline: all('underline'), hideProp: all('hideProp'), names: all('nameTag'),
        motion: { text: m.text, prop: m.prop, speed: m.speed }, open: m.open,
        ownTone: sf.hasOwnTone(html), propTone: sf.hasPropTone(html), tex: both.every(h => !tx.texInfo(h).blocked), vals: cu.fieldsOf(html).length,
        maxWidth: sh.shapeInfo(both[0])?.maxWidth || null, padOk: c.every(x => x.pad),
    };
}
const cache = (() => { try { const v = JSON.parse(fs.readFileSync(CACHE, 'utf8')); return v.tool === TOOL_V ? v.frames : {}; } catch { return {}; } })();
const todo = keys.filter(([id, k]) => cache[k]?.h !== sha(items[id].preview));
console.log(`틀 ${keys.length} · 캐시 ${keys.length - todo.length} · 잴 것 ${STATIC ? 0 : todo.length}`);

if (!STATIC && todo.length) {
    const { launch } = await import(pathToFileURL(path.join(ROOT, 'tools/site-rig/cdp.mjs')).href);
    const { serve } = await import(pathToFileURL(path.join(ROOT, 'tools/site-rig/serve.mjs')).href);
    const srv = await serve(ROOT, 18961), prof = path.join(ROOT, 'tools/site-rig/out/_caps-prof');
    const b = await launch(prof, 19461);
    try {
        await b.size(1000, 900, false, 1); await b.calm(true);
        await b.goto(`${srv.url}tools/geulkku-caps-page.html`); await b.until('window.capsReady === true', 20000);
        let n = 0; const t0 = Date.now();
        for (const [id, k] of todo) {
            const html = items[id].preview, per = {};
            for (const mode of ['light', 'dark']) {
                const h = sf.toneSimple(html, sf.ORIGINAL, { mode });
                for (const W of WIDTHS) per[`${mode}-${W}`] = await b.eval(`capsMeasure(${JSON.stringify(h)}, ${W})`);
            }
            cache[k] = { h: sha(html), per };
            if (++n % 40 === 0) { console.log(`  ${n}/${todo.length} · ${Math.round((Date.now() - t0) / 1000)}초`); fs.writeFileSync(CACHE, JSON.stringify({ tool: TOOL_V, frames: cache })); }
        }
        if (b.errors.length) console.log('콘솔:', b.errors.slice(0, 5));
    } finally { await b.close(); await srv.close(); }
    fs.writeFileSync(CACHE, JSON.stringify({ tool: TOOL_V, frames: cache }));
}

/** 정적 + 화면 → 능력표 한 줄 */
function capsLine(id, k) {
    const s = staticOf(items[id].preview), per = Object.values(cache[k]?.per || {}).filter(Boolean), measured = per.length === WIDTHS.length * 2;
    const line = { band: s.band, bg: s.bg, border: s.border, radius: s.radius, underline: s.underline, hideProp: s.hideProp };
    if (measured) {
        if (s.band === 'color' && !per.every(p => p.band)) line.band = 'image';   // 규칙은 있어도 화면에서 띠 색이 안 바뀌는 틀(띠를 그림으로 그어요)
        const pads = per.map(p => p.pad); line.pad = s.padOk && pads.every(Boolean) ? [Math.max(...pads.map(p => p[0])), Math.min(...pads.map(p => p[1]))] : false;
        const w640 = per.filter(p => p.width).map(p => p.width); line.width = s.maxWidth ? [...[480, 560].filter(w => w < s.maxWidth && w640.every(l => l.includes(w))), Math.min(640, s.maxWidth)] : false;
        const titles = per.map(p => p.title); line.title = titles.every(Boolean) ? { max: Math.min(...titles) } : false;
        line.nameTag = s.names ? ['pill', 'line'].filter(t => per.every(p => p.nameTag.includes(t))) : false;
    } else { line.pad = s.padOk ? [70, 130] : false; line.width = s.maxWidth ? [480, 560].filter(w => w < s.maxWidth).concat(Math.min(640, s.maxWidth)) : false; line.title = { max: 28 }; line.nameTag = s.names ? ['pill', 'line'] : false; line.unmeasured = true; }
    return { ...line, motion: s.motion, open: s.open, ownTone: s.ownTone, propTone: s.propTone, tex: s.tex, vals: s.vals };
}
const frames = {}; for (const [id, k] of keys) frames[k] = capsLine(id, k);
const text = `${JSON.stringify({ _: '글꾸 틀 능력표 — tools/geulkku-caps.mjs 산출물(고치지 말고 다시 만들어요) · 설계 지시-1111/글꾸-조절-설계/설계.md 3절', v: 1, widths: WIDTHS, frames })}\n`;
if (CHECK) { const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''; console.log(old === text ? '같음' : '다름'); process.exit(old === text ? 0 : 1); }
fs.writeFileSync(OUT, text);
const cnt = f => Object.values(frames).filter(f).length;
console.log(`caps.json ${Math.round(text.length / 1024)}KB · 틀 ${keys.length} · 띠 색 ${cnt(x => x.band === 'color')} · 바탕 ${cnt(x => x.bg)} · 여백 ${cnt(x => x.pad)} (70~130 ${cnt(x => x.pad && x.pad[0] === 70 && x.pad[1] === 130)}) · 폭 480 ${cnt(x => x.width && x.width.includes(480))} · 제목 28 ${cnt(x => x.title?.max === 28)} · 알약 ${cnt(x => (x.nameTag || []).includes('pill'))} · 밑줄표 ${cnt(x => (x.nameTag || []).includes('line'))} · 소품 숨김 ${cnt(x => x.hideProp)} · 빠르기 ${cnt(x => x.motion.speed)} · 열어 두기 ${cnt(x => x.open)}`);
