// 전수조사(11-07 사용자 「글 없어진 부분에 박스만 있진 않은지 선만 있진 않은지」) — 테마 내장 틀 전부 + 홈피 글꾸 전부 × 빼기 조합 6가지
//   node tools/tests/log-copy-bare-audit.mjs [테마 루트] [홈피 루트(gh-pages 사본 — 있으면 글꾸 마트 전부도)] [보고서.json]
// 1.0.7 tools/tests 로 옮김 — 문제가 하나라도 있으면 실패해요
// 판단은 log-copy-bare.js 를 쓰지 않고 따로 짜요(같은 실수를 같이 하지 않게).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [themeArg, siteRoot, outFile] = process.argv.slice(2);
const themeRoot = path.resolve(themeArg || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..'));
const T = rel => import(pathToFileURL(path.join(themeRoot, rel)).href);
const S = rel => import(pathToFileURL(path.join(siteRoot, rel)).href);

// ── 따로 짠 나무 ──
const VOID = new Set(['br', 'img', 'hr', 'wbr', 'col', 'source', 'input']);
const LETTER = /[\p{L}\p{N}]/u;
const decode = t => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 32)).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d || 32)).replace(/&[a-z]+;/gi, ' ');
function tree(html) {
    const root = { tag: '#root', kids: [], open: '' };
    const st = [root];
    const re = /<!--[\s\S]*?-->|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>|[^<]+/gi;
    for (const m of html.matchAll(re)) {
        const top = st.at(-1);
        if (m[0].startsWith('<!--')) continue;
        if (m[1]) { const i = st.findLastIndex((n, k) => k && n.tag === m[1].toLowerCase()); if (i > 0) st.length = i; continue; }
        if (m[2]) { const n = { tag: m[2].toLowerCase(), open: m[0], attrs: m[3] || '', kids: [], parent: top }; top.kids.push(n); if (!VOID.has(n.tag) && !m[0].endsWith('/>')) st.push(n); continue; }
        top.kids.push({ text: m[0], parent: top });
    }
    return root;
}
const isMsg = n => n.tag && /\sdata-bl-msg(?:[\s=]|$)/.test(n.attrs);
const field = n => /\sdata-f="([a-z]+)"/.exec(n.attrs || '')?.[1];
const KEEP = new Set(['title', 'date', 'mark', 'char', 'model', 'prompt', 'info']);
const letters = n => (n.text !== undefined ? LETTER.test(decode(n.text)) : n.kids.some(letters));
const hasImg = n => n.tag === 'img' || (n.kids || []).some(hasImg);
const hasMsg = n => isMsg(n) || (n.kids || []).some(hasMsg);
const styleOf = n => (/\sstyle="([^"]*)"/.exec(n.attrs || '')?.[1] ?? '').replace(/&quot;/g, '"');
const hidden = n => /(^|;)\s*display\s*:\s*none/i.test(styleOf(n));
/** 메시지로 가는 길의 형제(위 · 아래) */
function sides(root, first) {
    const out = [], path = [];
    for (let node = root; node && !isMsg(node);) {
        const els = node.kids;
        const at = first ? els.findIndex(k => k.tag && hasMsg(k)) : els.findLastIndex(k => k.tag && hasMsg(k));
        if (at < 0) break;
        out.push(...(first ? els.slice(0, at) : els.slice(at + 1)));
        path.push(els[at]);
        node = els[at];
    }
    return { side: out, path };
}
const visible = n => {   // 보이는 상자 · 선이 될 수 있는 요소인가
    const s = styleOf(n);
    return n.tag === 'hr' || /border(?:-(?:top|bottom|left|right))?(?:-width)?\s*:\s*(?!none|0(?:px)?\s*(?:;|$))/i.test(s) || /background(?:-color|-image)?\s*:\s*(?!none|transparent)/i.test(s) || /box-shadow\s*:\s*(?!none)/i.test(s) || /outline\s*:\s*(?!none)/i.test(s);
};
const all = n => [n, ...(n.kids || []).flatMap(all)];
// 장식(11-07 사용자 「단풍은 남아야지 · 박스만 사라지고」): 글 없는 그림(url) · 그라데이션 조각 · 움직임 · 누르면 반응 · <img> · 이모지 · 기호 글 — 가는 선(4px 이하)은 장식이 아니에요
const SYM = /[\p{Extended_Pictographic}\p{So}]/u;
const thinLine = s => /(?:^|;)\s*(?:height|max-height|width|max-width)\s*:\s*(?:[0-4](?:\.\d+)?px|0)\s*(?:;|$)/i.test(s);
const cssv = (s, k) => new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([^;]*)`, 'i').exec(s)?.[1]?.trim() ?? null;
const pxv = v => (v && /^-?\d+(?:\.\d+)?px$/.test(v) ? parseFloat(v) : v === '0' ? 0 : null);
/** 선: 한쪽 4px 이하 + 다른 쪽이 길게(안 정함 · % · 40px 넘음 · 늘어남 · 양끝 붙음) */
const isLine = (s) => { const w = pxv(cssv(s, 'width')), h = pxv(cssv(s, 'height')); const long = (v, a, b) => v === null || v > 40 || (cssv(s, a) !== null && cssv(s, b) !== null); if (h !== null && h <= 4) return /(?:^|;)\s*flex(?:-grow)?\s*:\s*[1-9]/i.test(s) || long(w, 'left', 'right'); if (w !== null && w <= 4) return long(h, 'top', 'bottom'); return false; };
/** 장식 그 자체: <img> · 누르면 반응 · 선이 아닌 그림(url) · 그라데이션 · 움직임 · 보이는 작은 조각(80px 이하) · 꾸밈 표시 · 떠 있는 조각 */
const ownDeco = (n) => { if (!n.tag || n.tag === '#root' || letters(n)) return false; if (n.tag === 'img' || /\sdata-bl-egg="/.test(n.attrs)) return true; const s = styleOf(n); if (isLine(s)) return false; if (/url\(|gradient\(|(?:^|;)\s*animation\s*:/i.test(s)) return true; if (!visible(n)) return false; const w = pxv(cssv(s, 'width')), h = pxv(cssv(s, 'height')); if (w !== null && h !== null && w <= 6 && h <= 6 && !/\saria-hidden="true"/.test(n.attrs)) return false; /* 11-08 꼬리표 구멍 · 글머리 점은 장식이 아니에요 */ return (w !== null && h !== null && w <= 80 && h <= 80) || /\saria-hidden="true"/.test(n.attrs) || /(?:^|;)\s*position\s*:\s*absolute/i.test(s); };
const hasDeco = n => (n.text !== undefined ? SYM.test(decode(n.text)) : ownDeco(n) || n.kids.some(hasDeco));
/** 보이는 곳(숨긴 갈래 밖 · 메시지 밖)의 장식 수 — 여는 태그 · 기호 글별 */
const decoCount = (t) => { const c = new Map(); const walk = (n) => { if (n.tag && (hidden(n) || isMsg(n))) return; if (n.text !== undefined) { if (SYM.test(decode(n.text)) && !letters(n)) c.set('글:' + n.text.trim(), (c.get('글:' + n.text.trim()) || 0) + 1); return; } if (ownDeco(n)) c.set(n.open, (c.get(n.open) || 0) + 1); for (const k of n.kids) walk(k); }; walk(t); return c; };

/** 한 결과 검사 — 원래(빼기 전) HTML 과 견줘요 */
function audit(orig, out, mode) {
    const problems = [];
    const o = tree(orig), r = tree(out);
    // 원래에서 글이 들어 있던 요소의 여는 태그
    // 빈 보이는 상자 수(여는 태그별) — 빼기 전보다 늘었으면 글이 빠지고 남은 빈 박스(원래부터 빈 달력 칸 · 줄 칸은 그대로라 안 늘어요)
    const emptyBoxes = (t) => { const c = new Map(); for (const n of all(t)) { if (!n.tag || n.tag === '#root' || n.tag === 'img' || hidden(n) || hasMsg(n)) continue; if (letters(n) || hasImg(n) || hasDeco(n) || all(n).some(x => KEEP.has(field(x)))) continue; if (visible(n)) c.set(n.open, (c.get(n.open) || 0) + 1); } return c; };
    const before = emptyBoxes(o), after = emptyBoxes(r);
    for (const [open, n] of after) if (n > (before.get(open) || 0)) problems.push({ kind: '빈 박스', side: '-', tag: open.slice(0, 160), more: n - (before.get(open) || 0) });
    for (const first of [true, false]) {
        const want = first ? mode.top : mode.bottom;
        const { side, path } = sides(r, first);
        const els = side.filter(n => n.tag);
        const zoneText = side.some(n => letters(n) || hasImg(n) || (n.tag && all(n).some(x => KEEP.has(field(x)) && !mode.drop.includes(field(x)))));
        // B: 그쪽을 뺐고 남은 글이 없는데 장식 없는 박스 · 선 · 빈 칸이 남음(장식 · 그림 · 숨긴 머리 · 접힘 머리는 괜찮아요)
        //    장식 묶음(장식을 품은 덩어리 — 진행 막대 · 라디오 바늘 · 「──✦──」)은 덩어리째 장식이라 그 안의 선은 괜찮아요 · 홀로 남은 박스 · 선 · 빈 칸만
        if (want && !zoneText) for (const n of els) { if (n.tag === 'summary' || hidden(n) || hasImg(n) || hasDeco(n)) continue; problems.push({ kind: '남은 박스 · 선', side: first ? '위' : '아래', tag: n.open.slice(0, 160) }); }
        // (글이 빠져 껍데기만 남은 상자 · 선은 위 A 가 셉니다 — 빼기 전보다 빈 상자 · 선이 늘면 문제)
        // C: 그쪽 글이 다 빠졌는데 메시지 칸에 그쪽 구분선이 남음(바깥 틀 자체의 선은 빼고 — 앞 형제가 원래 있던 칸만)
        if (!zoneText) for (const n of path) {
            if (isMsg(n)) continue;
            const edge = first ? 'top' : 'bottom';
            const prev = (() => { const p = n.parent; const i = p.kids.indexOf(n); return first ? p.kids.slice(0, i) : p.kids.slice(i + 1); })();
            const origHad = (() => {   // 원래 나무에서 같은 칸의 앞(뒤) 형제에 글이 있었나
                const twin = all(o).find(x => x.open === n.open && hasMsg(x));
                if (!twin) return false;
                const p = twin.parent; const i = p.kids.indexOf(twin);
                return (first ? p.kids.slice(0, i) : p.kids.slice(i + 1)).some(x => letters(x) || (x.tag && all(x).some(y => KEEP.has(field(y)))));
            })();
            if (origHad && !prev.some(x => letters(x) || hasImg(x)) && new RegExp(`(^|;)\\s*border-${edge}(?:-width|-style|-color)?\\s*:\\s*(?!none|0)`, 'i').test(styleOf(n))) problems.push({ kind: '구분선', side: first ? '위' : '아래', tag: n.open.slice(0, 160) });
        }
    }
    // E: 장식이 사라짐(빼기 전보다 보이는 장식이 줄었어요) — 단풍 · 그림 · 테이프 · 이모지는 남아야 해요
    const db = decoCount(o), da = decoCount(r);
    for (const [k, n] of db) if ((da.get(k) || 0) < n) problems.push({ kind: '장식 사라짐', side: '-', tag: k.slice(0, 160), less: n - (da.get(k) || 0) });
    // D: 뺀 칸이 남음
    for (const key of mode.drop) if (out.includes(`data-f="${key}"`)) problems.push({ kind: '뺀 칸이 남음', key });
    return problems;
}

const MODES = [
    { name: '위 글', top: true, bottom: false, drop: [] },
    { name: '아래 글', top: false, bottom: true, drop: [] },
    { name: '위 · 아래 글', top: true, bottom: true, drop: [] },
    { name: '제목 · 알약', top: false, bottom: false, drop: ['title', 'mark', 'char', 'model', 'prompt'] },
    { name: '제목 · 위 글 · 알약', top: true, bottom: false, drop: ['title', 'mark', 'char', 'model', 'prompt'] },
    { name: '다 뺌', top: true, bottom: true, drop: ['title', 'date', 'mark', 'char', 'model', 'prompt'] },
];

const report = { theme: { cases: 0, problems: [] }, site: { cases: 0, problems: [] } };
// ── 테마 ──
{
    const { renderLog, PRESETS, dateLabel } = await T('src/log-copy-presets.js');
    const { bareLog } = await T('src/log-copy-bare.js');
    const { MART_HALLOWEEN_COLORS, MART_HALLOWEEN_SHAPES, MART_HALLOWEEN_FRAMES } = await T('tools/mart/geulkku-halloween.mjs');
    const { MART_CONCEPT_FRAMES, renderConcept } = await T('tools/mart/geulkku-concept30.mjs');
    const { TEMPLATE_ROLES } = await T('src/log-copy-template.js');
    const font = { color: 'rgb(219, 226, 235)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '27px' };
    const msg = i => ({ index: i, user: i % 2 === 1, name: i % 2 ? 'Lemon' : 'Seraphina', nameStyle: { color: 'rgb(147, 201, 255)' }, time: Date.UTC(2026, 10, 7, 7, i), font, bubble: null, nodes: [{ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text: `"어서 와요 ${i}." 창밖으로 바람이 불었다.` }] }] });
    const model = { chatName: 'Seraphina', userName: 'Lemon', base: { bg: 'rgb(20, 31, 46)', ...font }, images: [{ src: 'https://example.com/a.png', alt: '숲' }], messages: [0, 1, 2].map(msg) };
    const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
    const fields = { title: '숲의 기록', mark: 'LOG', char: 'Seraphina', model: 'claude-opus-5-5', prompt: '내 프리셋', date: dateLabel(Date.UTC(2026, 10, 7)), from: 'Lemon', tail: '#세라피나', info: '오두막', page: '3', subtitle: '부제' };
    const colors = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(120, 135, 155)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.5)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#10161e' };
    const SLOT = { head: '{{head}}', body: '{{body}}', info: '{{info}}', tail: '{{tail}}' };
    const cases = PRESETS.map(p => ({ id: p.id, html: renderLog(model, { shape: p.id, colors: p.id === 'plain' ? null : colors, ui, fields, size: 'm' }) }));
    for (const f of MART_CONCEPT_FRAMES) cases.push({ id: f.id, html: renderConcept(model, { id: f.id, ui, fields, size: 'm' }) });
    for (const frame of MART_HALLOWEEN_FRAMES) {
        const k = MART_HALLOWEEN_COLORS[frame.colors];
        const item = { template: MART_HALLOWEEN_SHAPES[frame.shape](k, SLOT, ui), colors: Object.fromEntries(TEMPLATE_ROLES.map(r => [r, k[r]])), messages: frame.messages || 'box', tail: frame.tail || '' };
        cases.push({ id: `halloween:${frame.label}`, html: renderLog(model, { template: item, ui, fields, size: 'm' }) });
    }
    for (const c of cases) for (const mode of MODES) {
        report.theme.cases++;
        const out = bareLog(c.html, mode);
        for (const p of audit(c.html, out, mode)) report.theme.problems.push({ id: c.id, mode: mode.name, ...p });
    }
}
// ── 홈피 글꾸 전부(시식 창과 같은 길: taste-render.js tasteHtml) — 홈피 사본을 줬을 때만 ──
if (siteRoot && fs.existsSync(path.join(siteRoot, 'mart/taste-render.js'))) {
    const { parseLog, buildModel } = await S('mart/taste-parse.js');
    const { tasteHtml } = await S('mart/taste-render.js');
    const { renderLog } = await S('mart/lib/log-copy/log-copy-presets.js');
    const model = buildModel(parseLog('세라피나: 창밖으로 숲 바람이 스며들었다. "깨어났네요."\n여행자: 여기가 어디예요?\n세라피나: 「엘도리아 숲 안쪽이에요.」'));
    const fields = { title: 'Title', date: '11월 7일', mark: 'LOG', char: '세라피나', model: 'Argon', prompt: '천사깡' };
    const dir = path.join(siteRoot, 'mart/data/geulkku');
    const items = [];
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const [id, v] of Object.entries(d.items || {})) items.push({ id, file: f, ...v });
    }
    // 시식 창이 그리는 원본(빼기 전 · 표시 걷기 전)이 필요해요 — tasteHtml 은 표시를 걷어서, 빼기 전 비교는 표시 없이(빼기 결과도 표시 없이) 해요
    report.site.items = items.length;
    let errors = 0;
    for (const item of items) {
        let base;
        try { base = tasteHtml(item, model, fields, {}); } catch { errors++; continue; }
        if (!base) continue;
        for (const mode of MODES) {
            report.site.cases++;
            let out;
            try { out = tasteHtml(item, model, fields, mode); } catch (e) { report.site.problems.push({ id: item.id, mode: mode.name, kind: '그리기 실패', tag: String(e.message) }); continue; }
            // tasteHtml 은 data-bl-msg 표시를 걷어요 → 같은 결과를 표시째 얻으려고 renderLog 로 한 번 더(메시지 자리 찾기용)
            const marks = renderLog(model, { template: item, ui: { family: 'x', tracking: '0' }, fields, size: 'm', names: true });
            const outMarked = (await T('src/log-copy-bare.js')).bareLog(marks, mode);
            for (const p of audit(marks, outMarked, mode)) report.site.problems.push({ id: item.id, file: item.file, mode: mode.name, ...p });
            if (mode.drop.length && mode.drop.some(k => out.includes(`data-f="${k}"`))) report.site.problems.push({ id: item.id, mode: mode.name, kind: '뺀 칸이 남음(결과)' });
        }
    }
    report.site.drawErrors = errors;
}
const sum = list => Object.entries(list.reduce((a, p) => { const k = `${p.kind}`; a[k] = (a[k] || 0) + 1; return a; }, {}));
console.log('테마', report.theme.cases, '가지 · 문제', report.theme.problems.length, JSON.stringify(sum(report.theme.problems)));
console.log('홈피 글꾸', report.site.items, '개 ·', report.site.cases, '가지 · 문제', report.site.problems.length, JSON.stringify(sum(report.site.problems)), '· 못 그림', report.site.drawErrors);
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 1));
const bad = report.theme.problems.length + report.site.problems.length + (report.site.drawErrors || 0);
console.log(`log-copy-bare-audit: ${bad ? 'FAIL' : 'PASS'} — 문제 ${bad}`);
process.exit(bad ? 1 : 0);
