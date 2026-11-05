// 화소 면 기준 측정 도우미 — automation checks/rig/census-rules/lib/pixel.mjs(11-03 재정비 F · 원본 bk-ink.mjs)에서 글자 가운데 · 아이콘 잉크 부분만 그대로 옮겼어요(원본은 손대지 않아요).
//   요소마다 사진 세 장: A 그대로 · B 잉크(글자 · 아이콘)만 숨김 · C 요소 통째 숨김 → 잉크 = |A−B| 의 반값 경계 상자 · 면 = |B−C| 의 반값 경계 상자. 문턱 0.5px(규칙 33 — 상자 대신 화소 면 기준).
export const TOL = 0.5;
export const r2 = v => Math.round(v * 100) / 100;
export function diff(P, Q) {
    const n = P.width * P.height, d = new Float32Array(n); let max = 0;
    for (let j = 0; j < n; j++) { const o = j * 4; const v = (Math.abs(P.data[o] - Q.data[o]) + Math.abs(P.data[o + 1] - Q.data[o + 1]) + Math.abs(P.data[o + 2] - Q.data[o + 2])) / 3; d[j] = v < 3 ? 0 : v; if (v > max) max = v; }
    return { d, max, w: P.width, h: P.height };
}
export function edges(P, t) {
    const n = P.length; let a = -1, b = -1;
    for (let i = 0; i < n; i++) if (P[i] >= t) { a = i; break; }
    for (let i = n - 1; i >= 0; i--) if (P[i] >= t) { b = i; break; }
    if (a < 0) return null;
    const pa = a > 0 ? P[a - 1] : 0, pb = b < n - 1 ? P[b + 1] : 0;
    return [(a - 0.5) + (t - pa) / Math.max(1e-6, P[a] - pa), (b + 0.5) + (P[b] - t) / Math.max(1e-6, P[b] - pb)];
}
export function box(D, frac = 0.5, roi = null) {
    if (!D || !D.max) return null; const { d, w, h } = D; const [x0, y0, x1, y1] = roi || [0, 0, w, h];
    let mx = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = d[y * w + x]; if (v > mx) mx = v; }
    if (!mx) return null;
    const px = new Float32Array(x1 - x0), py = new Float32Array(y1 - y0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = d[y * w + x] / mx; if (v > px[x - x0]) px[x - x0] = v; if (v > py[y - y0]) py[y - y0] = v; }
    const ex = edges(px, frac), ey = edges(py, frac); if (!ex || !ey) return null;
    return { l: ex[0] + x0, r: ex[1] + x0, t: ey[0] + y0, b: ey[1] + y0, max: mx };
}
export function band(D, frac = 0.25, roi = null) {
    if (!D || !D.max) return null; const { d, w, h } = D; const [x0, y0, x1, y1] = roi || [0, 0, w, h];
    const m = new Float32Array(y1 - y0); let mx = 0;
    for (let y = y0; y < y1; y++) { let s = 0; for (let x = x0; x < x1; x++) s += d[y * w + x]; m[y - y0] = s; if (s > mx) mx = s; }
    if (!mx) return null; const e = edges(Array.from(m, v => v / mx), frac); return e ? { t: e[0] + y0, b: e[1] + y0 } : null;
}
export const DESCENDER = /[gjpqy,;]/;
const lumi = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const contrast = (a, b) => { const A = lumi(a), B = lumi(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
export function inkColors(D, Pa, Pb, frac = 0.8) {
    let n = 0; const ia = [0, 0, 0], ib = [0, 0, 0];
    for (let j = 0; j < D.d.length; j++) if (D.d[j] >= D.max * frac) { const o = j * 4; for (let c = 0; c < 3; c++) { ia[c] += Pa.data[o + c]; ib[c] += Pb.data[o + c]; } n++; }
    if (!n) return null; const a = ia.map(v => v / n), b = ib.map(v => v / n); return { ink: a, face: b, cr: r2(contrast(a, b)) };
}
/** 아이콘 잉크(A 그대로 · D 아이콘만 숨김): 아이콘 상자는 있는데 잉크 없음(최대 차 < 12) · 아이콘 ↔ 면 대비 3:1 미만 */
export function judgeIcon(A, D, { minCr = 3, minInk = 12 } = {}) {
    const Di = diff(A, D); const out = { iconMax: r2(Di.max) };
    if (Di.max < minInk) { out.iconNoInk = true; out.bad = true; out.why = ['아이콘 상자는 있는데 잉크 화소가 없어요(면과 같은 색?)']; return out; }
    const cc = inkColors(Di, A, D); if (cc) out.iconCr = cc.cr;
    out.bad = !!(cc && cc.cr < minCr); out.why = out.bad ? [`아이콘 ↔ 면 대비 ${cc.cr}:1(기준 ${minCr}:1)`] : [];
    return out;
}
/** 글자(또는 덩어리) 잉크 ↔ 면 가운데 — 가로 · 세로 차(CSS px). text 를 주면 내림 글자 띠 규칙 */
export function judgeCenter(A, B, C, { k, pad, w, h, text = '', frac = 0.35, tol = TOL }) {
    const Dt = diff(A, B), Df = diff(B, C);
    const ink = box(Dt, frac); if (!ink) return { noInk: true };
    if (text && DESCENDER.test(text)) { const bd = band(Dt, 0.25); if (bd) { ink.t = bd.t; ink.b = bd.b; } }
    const facePx = Df.max >= 4 ? box(Df, 0.5) : null;
    const ref = facePx || { l: pad * k, r: (pad + w) * k, t: pad * k, b: (pad + h) * k };
    const dx = r2(((ink.l + ink.r) - (ref.l + ref.r)) / 2 / k), dy = r2(((ink.t + ink.b) - (ref.t + ref.b)) / 2 / k);
    return { dx, dy, face: facePx ? 'pixel' : 'layout', bad: Math.abs(dx) > tol || Math.abs(dy) > tol, ink: { w: r2((ink.r - ink.l) / k), h: r2((ink.b - ink.t) / k) } };
}
