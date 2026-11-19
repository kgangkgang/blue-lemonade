// 1.6.9 미트볼 「변화 그래프」 다듬기 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   그 확장(src/trend.js)은 선 색을 순서대로 도는 팔레트(8색)로 칠해서, 같은 사람이 애정 · 우정 그래프에서 다른 색이었어요
//   (사용자 11-17 「그래프 프로필 색깔도 그 지금 프로필 색깔 따라가게」 · 「그래프 너무 안 예쁜데 좀 더 괜찮게 디자인 좀 해 봐」).
//   → 그 확장이 그린 창(.ss-trend)이 붙는 그 작업 안(그리기 전)에 테마가 다시 그려요. 그 확장 파일 · 자료는 그대로예요.
//   ① 색: 선 · 범례 동그라미 = 그 사람의 프로필 얼굴 색(src/ext-compat.js faceColorOf — 관계 카드 동그라미와 같은 차례 · 같은 값).
//      정해 둔 색이 없는 사람은 그 확장 팔레트 가운데 이 창의 누구와도 안 비슷한 색. 한 창 안 같은 사람은 판이 달라도 같은 색.
//      선은 판 바탕과 3 : 1 이 안 되면 같은 색 계열에서 밝기만 밀어요(동그라미는 프로필 그대로). 색이 서로 너무 비슷하면 순위가 낮은 쪽을 점선으로.
//   ② 모양: 판은 테마 카드 · 모서리를 살짝 둥글린 선(값이 바뀐 답에서 꺾이는 뜻은 그대로) · 위 셋은 굵게 · 맨 위 한 사람 아래 옅은 채움 ·
//      끝점 점 · 끝 값(겹치지 않는 셋까지) · 옅은 눈금 · 0 기준선. 글자 크기는 화면 픽셀로(판 폭을 재서 다시 그려요 — 폰에서 눈금 글자가 5px 로 줄던 것).
//   ③ 범례: 알약 단추 — 누르면 그 사람만 진하게(나머지 흐리게) · 다시 누르면 전체. 값 순서(그 확장이 정한 차례) 그대로.
//   켜고 끄기: 맞춤 시트가 걸리는 때(body.salty · 「원작 그대로 보기」 아님)만. 시험: tools/tests/mb-trend.mjs
import { watchDom } from './dom-watch.js';
import { faceColorPicker, contrastOf } from './ext-compat.js';
import { mbOff } from './mb-switch-core.js';   // 1.7.3 미트볼 맞춤 스위치

export const TREND = '.ss-trend';
const SVG_NS = 'http://www.w3.org/2000/svg';
/** 그 확장 2.8.0 의 팔레트(src/trend.js COLORS) — 정해 둔 색이 없는 사람에게 남는 색을 고를 때 */
export const PALETTE = ['#e2557b', '#2f62e9', '#17855a', '#d98a1f', '#8a56d6', '#1aa3b8', '#b0553a', '#6b7280'];
export const NEAR = 0.09;        // 두 선 색이 이보다 가까우면(OKLab 거리) 구분이 안 돼요 → 아래 순위를 점선으로
export const LINE_MIN = 3;       // 선 대 판 바탕 명암비
const DASHES = ['', '6 4', '2 3', '9 3 2 3'];
const STRONG = 3;                // 굵게 그리는 위 사람 수
const LABELS = 3;                // 끝 값을 다는 사람 수(겹치면 건너뛰어요)

// ── 색 계산 ─────────────────────────────────────────────
const hexRgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function rgbHex(css) {
    const s = String(css || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + [...s.slice(1)].map(ch => ch + ch).join('')).toLowerCase();
    const m = s.match(/rgba?\(([^)]+)\)/i); if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 4 && p[3] === 0) return null;
    return toHex(p.slice(0, 3));
}
/** sRGB → OKLab(거리 재기용) */
export function oklab(hex) {
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = hexRgb(hex).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export const colorGap = (a, b) => { const x = oklab(a), y = oklab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
/** OKLab → sRGB 16진(범위 밖은 자름) */
export function fromOklab([L, A, Bb]) {
    const l = (L + 0.3963377774 * A + 0.2158037573 * Bb) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * Bb) ** 3, s = (L - 0.0894841775 * A - 1.2914855480 * Bb) ** 3;
    const enc = v => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055); };
    return toHex([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(enc));
}
/** 선 색: 바탕과 LINE_MIN 이 될 때까지 밝기(OKLab L)만 바탕 반대쪽으로 0.02 씩 — 색상 · 채도는 그대로라 같은 색 계열(낮 바탕의 옅은 노랑 → 진한 금색 · 회갈색이 되지 않게) */
export function lineColor(color, bg, min = LINE_MIN) {
    const B = hexRgb(bg);
    if (contrastOf(hexRgb(color), B) >= min) return String(color).toLowerCase();
    const dir = contrastOf([255, 255, 255], B) >= contrastOf([0, 0, 0], B) ? 1 : -1;
    const lab = oklab(color); let out = String(color).toLowerCase();
    for (let i = 1; i <= 50; i++) { out = fromOklab([lab[0] + dir * 0.02 * i, lab[1], lab[2]]); if (contrastOf(hexRgb(out), B) >= min) break; }
    return out;
}

/** 이름들(창 안 등장 차례) → 사람마다 { dot(프로필 얼굴 색 · 없으면 남는 팔레트 색), own(프로필 색이 있나) }.
 *  pick(이름) = { bg, ink } | null (얼굴 색 고르개). 남는 색: 팔레트 차례로, 이미 쓰인 색과 NEAR 넘게 떨어진 것 → 없으면 가장 먼 것 */
export function assignColors(names, pick) {
    const out = new Map(), used = [];
    for (const n of names) { if (out.has(n)) continue; let fc = null; try { fc = n ? pick(n) : null; } catch { fc = null; } if (fc?.bg) { out.set(n, { dot: fc.bg, own: true }); used.push(fc.bg); } }
    for (const n of names) {
        if (out.has(n)) continue;
        const gap = c => (used.length ? Math.min(...used.map(u => colorGap(c, u))) : 1);
        const free = PALETTE.filter(c => !used.includes(c));
        const c = free.find(x => gap(x) >= NEAR * 1.6) || free.sort((a, b) => gap(b) - gap(a))[0] || PALETTE[used.length % PALETTE.length];
        out.set(n, { dot: c, own: false }); used.push(c);
    }
    return out;
}
/** 한 판의 선들(순위 차례 · 이미 바탕 대비를 맞춘 색) → 점선 무늬. 앞 순위와 NEAR 안이면 다음 무늬 */
export function dashFor(lines) {
    const out = [];
    lines.forEach((c, i) => {
        const taken = new Set();
        for (let j = 0; j < i; j++) if (colorGap(c, lines[j]) < NEAR) taken.add(out[j]);
        out.push(DASHES.find(d => !taken.has(d)) ?? DASHES[i % DASHES.length]);
    });
    return out;
}

// ── 그 확장이 그린 판 읽기 ─────────────────────────────────
const num = v => Number.parseFloat(v);
/** .ss-trend-box 하나 → { title, svg: { vb, x0, x1, y0, y1, grid: [{ y, label }], zero, xl: [왼, 오른] }, series: [{ name, value, color, segs: [[x,y]…] }] } (그림이 없으면 svg null) */
export function readBox(box) {
    const head = box.querySelector(':scope > b');
    const svg = box.querySelector(':scope > svg');
    const legend = [...box.querySelectorAll(':scope > .ss-trend-legend > span')].map(s => ({
        name: [...s.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(),
        value: s.querySelector('small')?.textContent.trim() ?? '',
        color: rgbHex(s.querySelector('i')?.style?.background || s.querySelector('i')?.style?.backgroundColor || ''),
    }));
    if (!svg) return { head, svg: null, series: legend.map(l => ({ ...l, segs: [] })), legend };
    const vb = String(svg.getAttribute('viewBox') || '0 0 640 220').split(/\s+/).map(Number);
    const lines = [...svg.querySelectorAll(':scope > line')];
    const zeroEl = lines.find(l => l.hasAttribute('stroke-dasharray'));
    const gridEls = lines.filter(l => l !== zeroEl);
    const texts = [...svg.querySelectorAll(':scope > text')];
    const grid = gridEls.map(l => ({ y: num(l.getAttribute('y1')), label: '' }));
    // 눈금 글자는 선마다 바로 뒤에(그 확장 차례: line → text) — 끝 두 글자는 가로 끝(#처음 · #지금)
    gridEls.forEach((l, i) => { const t = l.nextElementSibling; if (t?.tagName?.toLowerCase() === 'text') grid[i].label = t.textContent; });
    const xl = texts.slice(-2).map(t => t.textContent);
    const x0 = gridEls.length ? num(gridEls[0].getAttribute('x1')) : 46, x1 = gridEls.length ? num(gridEls[0].getAttribute('x2')) : vb[2] - 12;
    const ys = grid.map(g => g.y); const y0 = ys.length ? Math.min(...ys) : 12, y1 = ys.length ? Math.max(...ys) : vb[3] - 24;
    const byColor = new Map();
    for (const el of svg.querySelectorAll(':scope > polyline, :scope > circle')) {
        const c = rgbHex(el.getAttribute(el.tagName.toLowerCase() === 'circle' ? 'fill' : 'stroke')); if (!c) continue;
        const pts = el.tagName.toLowerCase() === 'circle' ? [[num(el.getAttribute('cx')), num(el.getAttribute('cy'))]] : String(el.getAttribute('points') || '').trim().split(/\s+/).map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite));
        if (!pts.length) continue;
        (byColor.get(c) || byColor.set(c, []).get(c)).push(pts);
    }
    // 이름 없는 한 줄(돈 판)은 범례가 없어요 → 선 색 그대로 이름 없이
    const series = legend.length ? legend.map(l => ({ ...l, segs: byColor.get(l.color) || [] })) : [...byColor].map(([color, segs]) => ({ name: '', value: '', color, segs }));
    return { head, svg: { el: svg, vb, x0, x1, y0, y1, grid, zero: zeroEl ? num(zeroEl.getAttribute('y1')) : null, xl, label: svg.getAttribute('aria-label') || '' }, series, legend };
}

/** 점들 → 모서리만 살짝 둥근 경로(r 픽셀 · 짧은 마디에서는 그 절반까지). 같은 x 로 시작하는 맨 앞 세로 토막(처음 상태 → 첫 답)은 첫 답 값에서 시작 */
export function roundPath(pts, r = 7) {
    const p = [];
    for (const q of pts) { const last = p[p.length - 1]; if (last && Math.abs(last[0] - q[0]) < 0.01 && Math.abs(last[1] - q[1]) < 0.01) continue; p.push(q); }
    while (p.length > 1 && Math.abs(p[0][0] - p[1][0]) < 0.01) p.shift();
    // 곧은 줄 가운데 점 빼기(같은 기울기)
    const q = p.filter((pt, i) => { if (!i || i === p.length - 1) return true; const a = p[i - 1], b = p[i + 1]; return Math.abs((pt[0] - a[0]) * (b[1] - pt[1]) - (pt[1] - a[1]) * (b[0] - pt[0])) > 0.01; });
    const f = v => (Math.round(v * 10) / 10).toString();
    if (q.length === 1) return { d: '', pts: q };
    let d = `M${f(q[0][0])} ${f(q[0][1])}`;
    for (let i = 1; i < q.length - 1; i++) {
        const a = q[i - 1], b = q[i], c = q[i + 1];
        const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
        const rr = Math.min(r, l1 / 2, l2 / 2);
        const s = [b[0] - (b[0] - a[0]) / l1 * rr, b[1] - (b[1] - a[1]) / l1 * rr], e = [b[0] + (c[0] - b[0]) / l2 * rr, b[1] + (c[1] - b[1]) / l2 * rr];
        d += ` L${f(s[0])} ${f(s[1])} Q${f(b[0])} ${f(b[1])} ${f(e[0])} ${f(e[1])}`;
    }
    d += ` L${f(q[q.length - 1][0])} ${f(q[q.length - 1][1])}`;
    return { d, pts: q };
}

// ── 다시 그리기 ─────────────────────────────────────────
const el = (doc, tag, attrs = {}, text = '') => { const e = tag.startsWith('svg:') ? doc.createElementNS(SVG_NS, tag.slice(4)) : doc.createElement(tag); for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) e.setAttribute(k, String(v)); if (text) e.textContent = text; return e; };
let uid = 0;
/** 판 그림을 폭 w(화면 픽셀)로 — model = readBox 결과 + 사람마다 line · dash · rank */
export function drawSvg(doc, model, w) {
    const S = model.svg, ser = model.series;
    w = Math.max(220, Math.round(w || 640));
    const h = Math.round(Math.max(150, Math.min(200, w * 0.5)));
    const labW = Math.max(16, ...S.grid.map(g => String(g.label).length * 6.2)) + 8;
    const endW = Math.max(18, ...ser.map(s => String(s.value).length * 6.6)) + 14;
    const L = Math.ceil(labW), R = Math.ceil(endW), T = 10, B = 22;
    const X = x => L + (x - S.x0) / ((S.x1 - S.x0) || 1) * (w - L - R);
    const Y = y => T + (y - S.y0) / ((S.y1 - S.y0) || 1) * (h - T - B);
    const svg = el(doc, 'svg:svg', { class: 'bl-tr-svg', viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img', 'aria-label': S.label || null, preserveAspectRatio: 'xMidYMid meet' });
    const defs = el(doc, 'svg:defs'); svg.append(defs);
    const g0 = el(doc, 'svg:g', { class: 'bl-tr-grid' });
    for (const g of S.grid) {
        const y = Y(g.y).toFixed(1);
        g0.append(el(doc, 'svg:line', { x1: L, x2: w - R, y1: y, y2: y }));
        g0.append(el(doc, 'svg:text', { x: L - 6, y: (Number(y) + 3.5).toFixed(1), 'text-anchor': 'end' }, g.label));
    }
    if (S.zero !== null) { const y = Y(S.zero).toFixed(1); g0.append(el(doc, 'svg:line', { class: 'bl-tr-zero', x1: L, x2: w - R, y1: y, y2: y })); }
    if (S.xl.length === 2) { g0.append(el(doc, 'svg:text', { class: 'bl-tr-x', x: L, y: h - 6 }, S.xl[0])); g0.append(el(doc, 'svg:text', { class: 'bl-tr-x', x: w - R, y: h - 6, 'text-anchor': 'end' }, S.xl[1])); }
    svg.append(g0);
    const focus = model.focus ?? -1;
    const fillOf = focus >= 0 ? focus : 0;
    const layers = [], ends = [];
    ser.forEach((s, i) => {
        const g = el(doc, 'svg:g', { class: `bl-tr-s${i < STRONG ? ' top' : ''}${focus >= 0 && focus !== i ? ' dim' : ''}${focus === i ? ' on' : ''}`, 'data-bl-k': i });
        g.style.setProperty('--c', s.line);
        let last = null;
        for (const seg of s.segs) {
            const { d, pts } = roundPath(seg.map(([x, y]) => [X(x), Y(y)]));
            if (!pts.length) continue;
            if (i === fillOf && d && pts.length > 1) {
                const id = `bl-tr-f${++uid}`;
                const lg = el(doc, 'svg:linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 });
                lg.append(el(doc, 'svg:stop', { offset: '0', 'stop-color': s.line, 'stop-opacity': '0.14' }), el(doc, 'svg:stop', { offset: '1', 'stop-color': s.line, 'stop-opacity': '0' }));
                defs.append(lg);
                const base = (h - B).toFixed(1);
                g.append(el(doc, 'svg:path', { class: 'bl-tr-fill', d: `${d} L${pts[pts.length - 1][0].toFixed(1)} ${base} L${pts[0][0].toFixed(1)} ${base} Z`, fill: `url(#${id})` }));
            }
            if (d) g.append(el(doc, 'svg:path', { class: 'bl-tr-line', d, stroke: s.line, 'stroke-dasharray': s.dash || null }));
            else g.append(el(doc, 'svg:circle', { class: 'bl-tr-pt', cx: pts[0][0].toFixed(1), cy: pts[0][1].toFixed(1), r: 2.6, fill: s.line }));
            last = pts[pts.length - 1];
        }
        if (last) { g.append(el(doc, 'svg:circle', { class: 'bl-tr-end', cx: last[0].toFixed(1), cy: last[1].toFixed(1), r: i < STRONG || focus === i ? 3.6 : 3, fill: s.line })); ends.push({ i, x: last[0], y: last[1], v: s.value }); }
        layers.push(g);
    });
    // 아래 순위부터 그려 위 순위가 위에 · 고른 사람은 맨 위
    for (const g of [...layers].reverse()) svg.append(g);
    if (focus >= 0 && layers[focus]) svg.append(layers[focus]);
    // 끝 값: 고른 사람(있으면) → 위 순위 차례로, 12px 안에 겹치면 건너뛰어요
    const order = focus >= 0 ? ends.filter(e => e.i === focus) : ends.filter(e => e.i < ser.length).slice(0, 8);
    const placed = [];
    for (const e of order) {
        if (placed.length >= (focus >= 0 ? 1 : LABELS) || !String(e.v)) continue;
        if (placed.some(p => Math.abs(p - e.y) < 12)) continue;
        placed.push(e.y);
        svg.append(el(doc, 'svg:text', { class: 'bl-tr-val', x: (e.x + 7).toFixed(1), y: (e.y + 3.5).toFixed(1) }, e.v));
    }
    return svg;
}

/** 범례 알약 줄 */
function drawLegend(doc, model) {
    const row = el(doc, 'div', { class: 'ss-trend-legend bl-tr-legend' });
    model.series.forEach((s, i) => {
        if (!s.name) return;
        const b = el(doc, 'button', { type: 'button', class: 'bl-tr-key', 'data-bl-k': i, 'aria-pressed': 'false', 'data-bl-line': s.line, 'data-bl-dash': s.dash || null, title: `${s.name}만 진하게 보기` });
        const dot = el(doc, 'i', { class: 'bl-tr-dot', 'aria-hidden': 'true' }); dot.style.setProperty('--c', s.dot); b.append(dot);
        if (s.dash) { const sv = el(doc, 'svg:svg', { class: 'bl-tr-dash', viewBox: '0 0 16 6', width: 16, height: 6, 'aria-hidden': 'true' }); sv.append(el(doc, 'svg:line', { x1: 1, x2: 15, y1: 3, y2: 3, stroke: s.line, 'stroke-dasharray': s.dash.split(' ').map(v => Math.max(1, Math.round(Number(v) * 0.6))).join(' ') })); b.append(sv); }
        b.append(el(doc, 'span', { class: 'bl-tr-name' }, s.name));   // 버그 사냥 10b: 이름은 칸에 감싸 아주 긴 이름도 알약 안에서 줄임표(전체 이름은 title)
        if (s.value) b.append(el(doc, 'small', {}, s.value));
        row.append(b);
    });
    return row;
}

const bgOf = (win, node) => { for (let e = node; e && e.nodeType === 1; e = e.parentElement) { let c = null; try { c = rgbHex(win.getComputedStyle(e).backgroundColor); } catch { c = null; } if (c) return c; } return '#ffffff'; };

// 버그 사냥 10b: 다시 그린 창마다 끊을 것(크기 감시자 · 밤낮 구독) — 창이 문서에서 떨어지면 sweepGone 이 끊어요
const live = new Set();
export function sweepGone() { for (const x of live) if (!x.root.isConnected) { live.delete(x); x.off(); } }

/** 창 하나(.ss-trend) 다시 그리기 — 한 번만. opts.pick = 얼굴 색 고르개(시험) · opts.width = 판 폭(시험) · opts.bg = 판 바탕(시험) · opts.watch = 밤낮 구독(시험) */
export function dressTrend(root, opts = {}) {
    if (!root || root.hasAttribute('data-bl-tr')) return false;
    const doc = root.ownerDocument, win = doc.defaultView;
    const boxes = [...root.querySelectorAll(':scope > .ss-trend-box')];
    if (!boxes.length) return false;
    root.setAttribute('data-bl-tr', '1');
    root.closest('dialog')?.classList.add('bl-mb-trend');
    const models = boxes.map(box => ({ box, ...readBox(box) }));
    const pick = opts.pick || faceColorPicker(doc);
    const colors = assignColors(models.flatMap(m => m.series.map(s => s.name).filter(Boolean)), pick);
    const stops = [];
    // 선 색 · 점선은 판 바탕에 맞춰요 — 버그 사냥 10b: 창이 열린 채 밤낮이 바뀌면(자동 밤낮 · 기기 다크 모드) 옛 바탕 대비로 남아서 바탕이 바뀔 때마다 다시 정해요
    const tint = m => {
        const bg = opts.bg || bgOf(win, m.box); if (bg === m.bg) return false;
        m.bg = bg;
        for (const s of m.series) s.line = lineColor(s.dot, bg);
        dashFor(m.series.map(s => s.line)).forEach((d, i) => { m.series[i].dash = d; });
        return true;
    };
    for (const m of models) {
        m.box.classList.add('bl-tr-box');
        m.head?.classList.add('bl-tr-head');
        for (const s of m.series) {
            const c = s.name ? colors.get(s.name) : null;
            s.dot = c ? c.dot : (s.color || PALETTE[3]); s.own = !!c?.own;
        }
        tint(m);
        m.focus = -1;
        if (m.svg) {
            const wrap = el(doc, 'div', { class: 'bl-tr-plot' });
            m.svg.el.replaceWith(wrap);
            const paint = w => { const svg = drawSvg(doc, m, w); wrap.replaceChildren(svg); m.w = w; };
            paint(opts.width || wrap.getBoundingClientRect?.().width || 640);
            m.redraw = () => paint(m.w);
            if (typeof win.ResizeObserver === 'function') { const ro = new win.ResizeObserver(es => { if (!wrap.isConnected) { sweepGone(); return; } const w = Math.round(es[0]?.contentRect?.width || 0); if (w > 0 && Math.abs(w - (m.w || 0)) >= 1) paint(w); }); ro.observe(wrap); stops.push(() => ro.disconnect()); }
        }
        const old = m.box.querySelector(':scope > .ss-trend-legend');
        // 버그 사냥 10: readBox 의 legend(범례 글 배열)를 그대로 두면 범례 없는 판(돈 · 기록 적음)에서 아래 addEventListener 가 예외 — 강조 · 나머지 판 연결이 다 멈췄어요
        m.legend = old ? drawLegend(doc, m) : null;
        if (old) old.replaceWith(m.legend);
    }
    // 한 사람 강조는 창 전체에서 이름으로(조정자 11-17): 애정 판에서 누르면 우정 판도 같은 사람을 강조 · 다시 누르면 둘 다 전체 · 그 사람이 없는 판은 전체 그대로
    let focusName = null;
    const apply = () => {
        for (const m of models) {
            const k = focusName === null ? -1 : m.series.findIndex(s => s.name === focusName);
            m.focus = k;
            for (const x of m.legend?.querySelectorAll('.bl-tr-key') || []) x.setAttribute('aria-pressed', String(Number(x.getAttribute('data-bl-k')) === k));
            if (k >= 0) m.box.setAttribute('data-bl-focus', String(k)); else m.box.removeAttribute('data-bl-focus');
            m.redraw?.();
        }
    };
    // 누르기는 판(box)에서 받아요 — 밤낮이 바뀌어 범례를 다시 그려도 그대로
    for (const m of models) if (m.legend) m.box.addEventListener('click', e => {
        const b = e.target?.closest?.('.bl-tr-key'); if (!b || !m.legend?.contains(b)) return;
        const name = m.series[Number(b.getAttribute('data-bl-k'))]?.name ?? null; if (!name) return;
        focusName = focusName === name ? null : name;
        apply();
    });
    try {
        stops.push((opts.watch || watchDom)(doc.body, { attributes: ['class'], name: '미트볼 그래프 (밤낮)' }, () => {
            if (!root.isConnected) { sweepGone(); return; }
            let changed = false;
            for (const m of models) if (tint(m)) { changed = true; if (m.legend) { const fresh = drawLegend(doc, m); m.legend.replaceWith(fresh); m.legend = fresh; } }
            if (changed) apply();
        }));
    } catch { /* 다시 열면 맞아요 */ }
    live.add({ root, off: () => { for (const f of stops) try { f?.(); } catch { /* 이미 끊김 */ } } });
    return true;
}

// ── 1.9.0 원작 그래프에 인물 색 입히기 ─────────────────────
//   미트볼 2.9.1 부터 그래프는 원작이 그려요(src/mb-upstream.js 의 trend — 위 「다시 그리기」는 쉬어요). 원작은 사람 색을 이름 글자로 정한 색상환 각도로 칠해서
//   테마가 아는 인물 색(대사 색 → TTS 카드 색 → 프리셋 색 · 관계 카드 얼굴과 같은 faceColorOf)과 달라요 — 사용자 11-19 「애들 프로필 색깔 따라가는 거 맞지?」
//   → 원작이 그린 꼴(선 · 눈금 · 범례 · 누르면 강조)은 그대로 두고 사람 판(애정 · 우정)의 색만 갈아입혀요. 원작 파일 · 자료는 안 건드려요.
//   · 인물 색이 있는 사람: 선 · 범례 점 = 그 색(판 바탕과 3 : 1 이 안 되면 같은 색 계열에서 밝기만 보정 — lineColor). 없는 사람: 원작 색 그대로.
//   · 점선: 색이 바뀌었으니 다시 가려요 — 앞 순위 실선과 색이 가까우면(NEAR) 점선. 둘 다 원작 색이면 원작 규칙(색상환 22도 안) 그대로.
//   · 이 창에 인물 색이 있는 사람이 하나도 없으면 아무것도 안 해요. 돈 · 수치 판(사람이 아님)은 안 건드려요.
//   켜고 끄기: 스위치 「변화 그래프 인물 색」(tcolor) · 끄면 다음에 여는 그래프부터 원작 색이에요. 시험: tools/tests/mb-trend-tint.mjs
const UP_DASH = '6 4';      // 원작 점선 무늬(그 확장이 polyline 에 적는 값)
const UP_HUE_NEAR = 22;     // 원작이 「가까운 색」으로 보는 색상환 각도 차
/** hsl(각도 채도% 밝기%) → { hex, hue } (원작 사람 색 꼴 · 아니면 null) */
export function hslHex(css) {
    const m = /hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(String(css || '')); if (!m) return null;
    const h = ((Number(m[1]) % 360) + 360) % 360, sat = Number(m[2]) / 100, l = Number(m[3]) / 100;
    const a = sat * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return { hex: toHex([f(0), f(8), f(4)]), hue: h };
}
const hueGap = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d); };
/** 한 판의 사람들(순위 차례 · { line, own, hue }) → 점선인가. 앞 순위 실선과 가까우면 점선 — 둘 다 원작 색이면 원작 규칙 그대로 */
export function tintDashes(series) {
    const out = [];
    series.forEach((s, i) => {
        out.push(series.slice(0, i).some((y, j) => !out[j] && (!s.own && !y.own && Number.isFinite(s.hue) && Number.isFinite(y.hue) ? hueGap(s.hue, y.hue) < UP_HUE_NEAR : colorGap(s.line, y.line) < NEAR)));
    });
    return out;
}
/** 원작이 그린 판 하나 읽기 — 사람 판(범례 점이 hsl 색)만. [{ name, key(범례 칸), dot(범례 점), g(선 묶음), css0(원작 색 글), c0(16진), hue }] */
export function readPeopleBox(box) {
    const out = [];
    const groups = [...box.querySelectorAll(':scope > svg g[data-k]')];
    for (const key of box.querySelectorAll(':scope > .ss-trend-legend > [data-k]')) {
        const dot = key.querySelector(':scope > i'); if (!dot) return [];
        const name = key.getAttribute('data-k');
        const g = groups.find(x => x.getAttribute('data-k') === name) || null;
        // 원작 색 글은 선(없으면 점)의 속성에서 — 범례 점의 인라인 색은 브라우저가 rgb 로 바꿔 돌려줘서 색상환 각도를 못 읽어요
        const mark = g?.querySelector('polyline, circle');
        const css0 = String(dot.getAttribute('data-bl-c0') || mark?.getAttribute(mark.tagName.toLowerCase() === 'circle' ? 'fill' : 'stroke') || '').trim();
        const c = hslHex(css0);
        if (!c) return [];   // hsl 색이 아니면 사람 판이 아니에요(수치 판은 팔레트 16진)
        out.push({ name, key, dot, g, css0, c0: c.hex, hue: c.hue });
    }
    return out;
}
/** 창 하나(.ss-trend · 원작 2.9.1 부터의 꼴)에 인물 색 입히기 — 한 번만. opts.pick · opts.bg · opts.watch 는 시험용 */
export function tintTrend(root, opts = {}) {
    if (!root || root.hasAttribute('data-bl-tr') || root.hasAttribute('data-bl-tc')) return false;
    const doc = root.ownerDocument, win = doc.defaultView;
    const models = [...root.querySelectorAll(':scope > .ss-trend-box')].map(box => ({ box, series: readPeopleBox(box), bg: null })).filter(m => m.series.length);
    if (!models.length) return false;
    const pick = opts.pick || faceColorPicker(doc);
    const own = new Map();
    for (const m of models) for (const s of m.series) { if (!own.has(s.name)) { let fc = null; try { fc = s.name ? pick(s.name) : null; } catch { fc = null; } own.set(s.name, fc?.bg || null); } s.own = own.get(s.name); }
    if (![...own.values()].some(Boolean)) return false;   // 인물 색을 아는 사람이 없어요 — 원작 그대로
    root.setAttribute('data-bl-tc', '1');
    const paint = m => {
        const bg = opts.bg || bgOf(win, m.box); if (bg === m.bg) return false;
        m.bg = bg;
        for (const s of m.series) s.line = s.own ? lineColor(s.own, bg) : s.c0;
        const dashes = tintDashes(m.series);
        m.series.forEach((s, i) => {
            const color = s.own ? s.line : s.css0;
            for (const el of s.g?.querySelectorAll('polyline, circle') || []) {
                if (el.tagName.toLowerCase() === 'circle') { el.setAttribute('fill', color); continue; }
                el.setAttribute('stroke', color);
                if (dashes[i]) el.setAttribute('stroke-dasharray', UP_DASH); else el.removeAttribute('stroke-dasharray');
            }
            if (!s.dot.hasAttribute('data-bl-c0')) s.dot.setAttribute('data-bl-c0', s.css0);
            if (s.own) s.dot.style.backgroundColor = color;
            s.dot.style.backgroundImage = 'none';   // 원작이 점선인 사람에게 붙인 줄무늬 그림은 걷고 점선 표식은 아래 속성으로(시트가 점선 고리로 그려요)
            if (dashes[i]) s.dot.setAttribute('data-bl-dash', ''); else s.dot.removeAttribute('data-bl-dash');
            if (s.own) s.key.setAttribute('data-bl-own', ''); else s.key.removeAttribute('data-bl-own');
        });
        return true;
    };
    for (const m of models) paint(m);
    // 창을 연 채 밤낮이 바뀌면 바탕 대비가 달라져요 — 다시 맞춰요(위 다시 그리기와 같은 구독 · 창이 떨어지면 sweepGone 이 끊어요)
    let stop = null;
    try { stop = (opts.watch || watchDom)(doc.body, { attributes: ['class'], name: '미트볼 그래프 인물 색 (밤낮)' }, () => { if (!root.isConnected) { sweepGone(); return; } for (const m of models) paint(m); }); } catch { stop = null; }
    live.add({ root, off: () => { try { stop?.(); } catch { /* 이미 끊김 */ } } });
    return true;
}
const tintable = doc => !!doc?.body?.classList?.contains?.('salty') && !doc.body.hasAttribute?.('data-bl-ext-raw') && mbOff('trend', doc) && !mbOff('tcolor', doc);   // 다시 그리기가 쉬는 때(원작에 맡김 · 끔)에만

const fitted = doc => !!doc?.body?.classList?.contains?.('salty') && !doc.body.hasAttribute?.('data-bl-ext-raw') && !mbOff('trend', doc);   // 1.7.3 스위치 「변화 그래프 다시 그리기」
/** 이 기록들에 새로 붙은 그래프 창 */
export function trendRoots(records) {
    const out = new Set();
    for (const r of records || []) for (const n of r?.addedNodes || []) {
        if (n.nodeType !== 1) continue;
        if (n.matches?.(TREND)) out.add(n); else if (n.firstElementChild) for (const x of n.querySelectorAll?.(TREND) || []) out.add(x);
    }
    return out;
}
let on = false;
export function startMbTrend(doc = globalThis.document, { watch = watchDom, pick = null } = {}) {
    if (on || !doc?.body) return false;
    on = true;
    try {
        watch(doc.body, { childList: true, subtree: true, exclude: '#chat', name: '미트볼 그래프' }, records => {
            if (live.size) sweepGone();   // 버그 사냥 10b: 닫힌 창의 감시자 · 구독 끊기
            if (fitted(doc)) { for (const r of trendRoots(records)) try { dressTrend(r); } catch (e) { console.warn('[Blue Lemonade] 미트볼 그래프', e); } return; }
            if (tintable(doc)) for (const r of trendRoots(records)) try { tintTrend(r, pick ? { pick } : {}); } catch (e) { console.warn('[Blue Lemonade] 미트볼 그래프 인물 색', e); }   // 1.9.0 원작 그래프에는 인물 색만
        });
    } catch { on = false; return false; }
    return true;
}
