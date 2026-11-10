// 11-10 글꾸 마트 「대사색 하나」 다시 칠하기 시험 · 미리보기 자료 만들기 (DOM 없음 · node)
//   node tools/geulkku-tone.mjs --check                 1497 로그 글꾸 × 대사색 3 × 낮/밤: 그리기 실패 0 · 붙일 꼴(인라인 url( 0 · fill 없는 글자색 0) · 한 틀 색 수
//   node tools/geulkku-tone.mjs --dump <json> [--ids a,b] [--k #3aa7ff,#ff5fa2] [--log <json>]   지금/새 HTML 을 json 으로(미리보기 · 렌더 검사용)
import { retired } from './geulkku-retired.mjs'; retired('geulkku-tone');   // 11-11 옛 글꾸를 마트에서 뺐어요 — 이 도구는 쉬어요(geulkku-retired.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MART = path.resolve(HERE, '../mart');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const imp = f => import(pathToFileURL(path.join(MART, f)).href);
const tr = await imp('taste-render.js');
const tp = await imp('taste-parse.js');
const tg = await imp('tone-geulkku.js');
const dir = path.join(MART, 'data/geulkku');
const ix = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const chunkCache = new Map();
const chunk = c => { if (!chunkCache.has(c)) chunkCache.set(c, JSON.parse(fs.readFileSync(path.join(dir, ix.chunks[c].file), 'utf8')).items); return chunkCache.get(c); };
const full = m => ({ ...m, ...chunk(m.c)[m.id], kind: 'geulkku', label: m.name });
let concept = null;
const draw = async (item, model) => {
    if (tr.isConcept(item) && !concept) { concept = await tr.loadConcept(); }
    return tr.shutPeek(tr.tasteHtml(item, model, { title: '휴게실 앞 복도', date: '' }, { names: true }));
};
const LOG = arg('--log') ? JSON.parse(fs.readFileSync(arg('--log'), 'utf8')) : {
    default: '가브리엘: 가브리엘이 안경을 밀어 올리며 휴게실 문턱에 멈춰 섰다. "실례하겠습니다. 잠깐 시간 괜찮으신가요?"\n\n나: 나는 컵을 내려놓았다. "어, 들어와. 커피 마실래?"',
};
const modelOf = text => tp.buildModel(tp.parseLog(text));
const colorsIn = html => new Set((html.match(/#[0-9a-f]{6}\b|rgba?\([^)]*\)/gi) || []).map(s => s.toLowerCase().replace(/\s/g, ''))).size;

if (argv.includes('--check')) {
    const Ks = (arg('--k', '#3aa7ff,#ff5fa2,#c9d1dc')).split(',');
    const items = ix.items.filter(m => !m.photo);
    let fail = 0, n = 0, maxColors = 0, sumColors = 0, before = 0;
    const model = modelOf(LOG.default);
    for (const m of items) {
        const item = full(m);
        const raw = await draw(item, model).catch(e => { console.log('그리기 실패(지금)', m.id, e.message); fail++; return ''; });
        if (!raw) continue;
        before += colorsIn(raw);
        for (const K of Ks) for (const mode of ['light', 'dark']) {
            n++;
            let out;
            try { out = tg.kkangtongReady(tg.toneHtml(raw, item.colors || item.palette || null, K, { mode })); }
            catch (e) { console.log('다시 칠하기 실패', m.id, K, mode, e.message); fail++; continue; }
            const r = tg.readyReport(out);
            if (!r.ok) { fail++; if (fail < 20) console.log('붙일 꼴 실패', m.id, K, mode, JSON.stringify(r)); }
            const body = out.replace(/<style>[\s\S]*?<\/style>/g, '');
            const c = colorsIn(body); maxColors = Math.max(maxColors, c); sumColors += c;
        }
    }
    console.log(JSON.stringify({ items: items.length, renders: n, fail, colorsAvgBefore: +(before / items.length).toFixed(1), colorsAvgAfter: +(sumColors / n).toFixed(1), colorsMaxAfter: maxColors }));
    process.exit(fail ? 1 : 0);
}

if (arg('--dump')) {
    const ids = arg('--ids') ? arg('--ids').split(',') : ix.items.filter(m => !m.photo).map(m => m.id);
    const Ks = (arg('--k', '#3aa7ff')).split(',');
    const modes = (arg('--modes', 'light,dark')).split(',');
    const now = !argv.includes('--no-now');
    const out = {};
    for (const [who, text] of Object.entries(LOG)) {
        const model = modelOf(text);
        for (const id of ids) {
            const m = ix.items.find(x => x.id === id); if (!m) continue;
            const item = full(m);
            const raw = await draw(item, model).catch(() => '');
            const row = out[id] ??= { name: m.name, style: m.style, category: m.category, c: m.c, now: {}, tone: {} };
            if (now) row.now[who] = tr.inkForKkangsa ? raw : raw;
            for (const K of Ks) for (const mode of modes) {
                const key = `${who}|${K}|${mode}`;
                row.tone[key] = raw ? tg.kkangtongReady(tg.toneHtml(raw, item.colors || item.palette || null, K === 'none' ? null : K, { mode })) : '';
            }
        }
    }
    fs.writeFileSync(arg('--dump'), JSON.stringify(out));
    console.log('dump', Object.keys(out).length);
}
