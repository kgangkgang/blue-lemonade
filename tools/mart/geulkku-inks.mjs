// 1.0.1 글꾸 마트 — 꾸밈 색 벌리기(11-04 사용자 「글자 꾸미기 효과가 다 보여야 함」)
//   틀 색 묶음의 대사 · 속마음 · 강조 · 형광펜(+ 대사 배경 띠) 색이 본문색 · 바탕 · 서로와 뚜렷이 다르게 맞춰요.
//   tools/mart/convert-sian.mjs(시안 틀 「⑥ 색 묶음」) · tools/mart-build.mjs(할로윈 31 팔레트)가 같이 써요 — 테마(src/)는 이 파일을 몰라요.
//
// 종류마다 다른 규칙(시안이 그 종류 색을 정했으면 그 색에서 시작 — 기준을 넘으면 그대로)
//   · 대사 dialogue   = 강조색(시안 이름색 · 없거나 본문과 같으면 틀의 다른 주제 색)
//   · 소제목          = 대사색 굵게(표본 tools/mart/sample.mjs heading 이 대사 화면 색을 써요 — 역할 칸은 대사와 같아요)
//   · 강조 emphasis    = 진한 강조색 굵게(밝은 칸은 더 짙고 진하게 · 어두운 칸은 더 밝고 진하게)
//   · 속마음 thought   = 보조색 기울임(틀의 두 번째 주제 색 · 없으면 강조색에서 색상환 40° 옆)
//   · 형광펜 mark      = 연한 강조 바탕(칸 바탕에 강조색을 조금 섞음 · 대사 배경 띠도 이 색)
//   · 작은 글 muted    = 그대로(본문보다 옅은 색 · 4.5)
// 기준(상수): 글자색은 칸 바탕(panel · panel2) 대비 INK_CONTRAST 이상 · 본문색과 ΔE2000 DE_BODY 이상 · 대사 · 속마음 · 강조끼리 DE_PAIR 이상
//             형광펜은 칸 바탕과 ΔE2000 MARK_DE 이상 · 형광펜 위 본문 · 대사 INK_CONTRAST 이상
export const INK_CONTRAST = 4.5;
export const DE_BODY = 26;    // 사진으로 맞춘 「뚜렷함」 25(점검 기준) + 반올림 여유
export const DE_PAIR = 12;    // 대사 · 속마음 · 강조끼리
export const MARK_DE = 9;     // 형광펜 바탕 vs 칸 바탕(점검 기준 「옅음」 7 + 여유)

// ── 색 계산 ──
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const rgbHex = c => '#' + c.slice(0, 3).map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const contrastRgb = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const WX = 0.95047, WZ = 1.08883;
export function lab(c) {
    const [R, G, B] = c.slice(0, 3).map(lin);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / WX, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / WZ;
    const t = v => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
/** Lab → sRGB(0~255) · 색 범위 밖이면 null */
function rgbOfLab([L, a, b]) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const inv = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    const X = inv(fx) * WX, Y = inv(fy), Z = inv(fz) * WZ;
    const r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, bl = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    if ([r, g, bl].some(v => v < -0.0005 || v > 1.0005)) return null;
    return [r, g, bl].map(v => unlin(clamp(v, 0, 1)));
}
const lch = c => { const [L, a, b] = lab(c); const h = (Math.atan2(b, a) * 180) / Math.PI; return [L, Math.hypot(a, b), h < 0 ? h + 360 : h]; };
const fromLch = (L, C, h) => rgbOfLab([L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]);
/** CIEDE2000 */
export function de00(c1, c2) {
    const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
    const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G), Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
    const hp = (x, y) => { if (!x && !y) return 0; const h = Math.atan2(y, x) / rad; return h < 0 ? h + 360 : h; };
    const hp1 = hp(ap1, b1), hp2 = hp(ap2, b2);
    const dL = L2 - L1, dC = Cp2 - Cp1;
    let dh = 0; if (Cp1 * Cp2) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
    const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2);
    const Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
    let hb = hp1 + hp2; if (Cp1 * Cp2) { if (Math.abs(hp1 - hp2) > 180) hb += hb < 360 ? 360 : -360; hb /= 2; }
    const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
    const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
    const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
    return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const mixRgb = (a, b, t) => [0, 1, 2].map(i => a[i] * (1 - t) + b[i] * t);
const round = c => hexRgb(rgbHex(c));   // #rrggbb 로 반올림한 뒤에 재요
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** 조건을 넘는 색을 찾아요 — 시작 색이 넘으면 그대로, 아니면 밝기 · 진하기 · 색상을 시작 색 가까이부터 넓혀 가며 */
function findInk(start, ok, { hue, chroma, light } = {}) {
    if (start && ok(round(start))) return round(start);
    const [L0, C00, h00] = start ? lch(start) : [50, 40, 250];
    const h0 = hue ?? h00, C0 = chroma ?? Math.max(C00, 0), Lw = light ?? L0;
    let best = null, bestCost = Infinity;
    const H = [0, 6, -6, 12, -12, 20, -20, 30, -30, 45, -45, 65, -65, 90, -90, 130, -130, 180];
    const Cs = [...new Set([C0, ...Array.from({ length: 19 }, (_, i) => 6 + i * 6)].map(c => Math.round(c)))];
    for (const dh of H) {
        if (Math.abs(dh) * 2 > bestCost) continue;
        for (const C of Cs) {
            for (let L = 4; L <= 97; L += 1.5) {
                const cost = Math.abs(L - Lw) + 0.4 * Math.abs(C - C0) + 2 * Math.abs(dh);   // 색상을 가장 아껴요(주제 색 계열 유지) — 다음 밝기 · 진하기
                if (cost >= bestCost) continue;
                const rgb = fromLch(L, C, (h0 + dh + 360) % 360);
                if (!rgb) continue;
                const c = round(rgb);
                if (ok(c)) { best = c; bestCost = cost; }
            }
        }
    }
    return best;
}

/**
 * 색 묶음 k(역할 → #rrggbb)의 꾸밈 색을 벌려요. given: 시안이 종류별로 정한 색(dialogue · thought · emphasis · mark) · seeds: 틀의 주제 색 후보(차례대로 · 이름색 먼저)
 * 돌려주는 것: 새 묶음(k 사본) — 대사 · 속마음 · 강조 · 형광펜만 바뀌어요(나머지 역할은 그대로)
 */
export function spreadInks(k, { given = {}, seeds = [] } = {}) {
    const P = hexRgb(k.panel), P2 = hexRgb(k.panel2), T = hexRgb(k.text);
    const ink = c => contrastRgb(c, P) >= INK_CONTRAST + 0.02 && contrastRgb(c, P2) >= INK_CONTRAST + 0.02;
    const far = (c, list, d) => list.every(o => de00(c, o) >= d);
    const dark = lum(P) < 0.3;
    // 주제 색 후보: 진하기 15 이상 · 칸 바탕과 다른 것 — 강조색은 본문과 가장 먼저 벌어지는 후보
    const pool = [given.dialogue, k.name, ...seeds, k.accent, k.deco1, k.quoteBar].filter(Boolean).map(hexRgb).filter(Boolean)
        .filter(c => lch(c)[1] >= 15 && de00(c, P) >= 12);
    const accent = pool.find(c => de00(c, T) >= 15) ?? pool[0] ?? null;
    // 무채색 틀(흑백 TV · 영수증): 본문 색상 쪽(조금이라도 기울면) · 아니면 차분한 남색으로 진하기 40
    const [, tC, tH] = lch(T);
    const accentHue = accent ? lch(accent)[2] : tC >= 4 ? tH : 255, accentC = accent ? Math.max(lch(accent)[1], 30) : 40;
    // ① 대사 = 강조색(먼저 칸 바탕 위 기준만)
    const dStart = given.dialogue ? hexRgb(given.dialogue) : accent && de00(hexRgb(k.name), T) >= 15 ? hexRgb(k.name) : accent ?? hexRgb(k.name);
    const D0 = findInk(dStart, c => ink(c) && de00(c, T) >= DE_BODY, accent ? {} : { hue: accentHue, chroma: accentC });
    // ② 형광펜 = 연한 강조 바탕 — 칸 바탕과 MARK_DE 이상 · 그 위 본문 4.5(대사 배경 띠도 이 색 — 대사는 ③에서 이 위 4.5 로)
    const markOk = c => de00(c, P) >= MARK_DE && de00(c, P2) >= MARK_DE && contrastRgb(T, c) >= INK_CONTRAST + 0.02;   // 칸 · 말풍선(panel2) 어디에 깔려도
    const m0 = hexRgb(given.mark ?? k.mark);
    // 형광펜 후보: 시안 형광펜 → 칸 바탕 밝기의 강조색 물들임 → 칸 바탕과 강조색 사이(지금 섞임 정도부터 진한 쪽 · 다음 옅은 쪽) → 칸 바탕을 더 깊게(어두운 칸 — 밝은 대사가 4.5 를 못 넘을 때)
    const steps = Array.from({ length: 60 }, (_, i) => Math.round((0.02 + i * 0.01) * 100) / 100);
    const t0 = m0 ? clamp(de00(m0, P) / 60, 0.05, 0.5) : dark ? 0.28 : 0.16;
    const ts = [...steps.filter(t => t >= t0), ...steps.filter(t => t < t0).reverse()];
    const marks = function* () {
        if (m0) yield m0;
        // 연한 강조 바탕: 칸 바탕 밝기 그대로 강조색 색상으로 물들임(진하기를 조금씩) — 글자 대비를 가장 덜 깎아요 · 밝기는 조금씩만 옮겨요
        //   기준 밝기는 칸 · 말풍선 가운데 글자에서 먼 쪽(어두운 칸은 더 밝은 쪽) · 색상은 시안 형광펜 색상(정했으면) → 강조색 색상
        const Lp = dark ? Math.max(lch(P)[0], lch(P2)[0]) : Math.min(lch(P)[0], lch(P2)[0]);
        const hues = [...new Set([m0 && lch(m0)[1] >= 4 ? lch(m0)[2] : null, D0 ? lch(D0)[2] : accentHue].filter(x => x !== null).map(Math.round))];
        //   후보들은 지금 형광펜(없으면 칸 바탕에 강조색 조금)과 가까운 차례로
        const near = m0 ?? (D0 ? round(mixRgb(P, D0, t0)) : P), tints = [];
        for (const hue of hues) for (const dL of [0, 2, 4, 6, 8, 10, 13, 16]) for (let C = 4; C <= 50; C += 2) { const c = fromLch(clamp(dark ? Lp + dL : Lp - dL, 2, 99), C, hue); if (c) tints.push(round(c)); }
        yield* tints.map(c => [c, de00(c, near)]).sort((x, y) => x[1] - y[1]).map(([c]) => c);
        if (D0) for (const to of [D0, accent ?? D0]) for (const t of ts) yield round(mixRgb(P, to, t));
        for (const t of steps) yield round(mixRgb(P, dark ? [0, 0, 0] : [255, 255, 255], t));
    };
    // ③ 대사 — 칸 바탕 · 형광펜(대사 배경 띠) 위 4.5 · 본문과 DE_BODY(형광펜 후보마다 가까운 대사를 찾아 처음 맞는 짝)
    let D = null, M = null, tried = 0;
    if (D0) for (const m of marks()) {
        if (!markOk(m)) continue;
        if (++tried > 80) break;
        const d = findInk(D0, c => ink(c) && de00(c, T) >= DE_BODY && contrastRgb(c, m) >= INK_CONTRAST + 0.02);
        if (d) { D = d; M = m; break; }
    }
    if (!D) throw new Error(`꾸밈 색을 못 벌렸어요 — 대사 ${!!D0} · 형광펜 짝 ${tried}`);
    const [LD, CD, hD] = lch(D);
    // ④ 강조 = 진한 강조색 — 밝은 칸은 더 짙게 · 어두운 칸은 더 밝게, 둘 다 더 진하게
    const eWant = { hue: hD, chroma: CD + 12, light: dark ? LD + 8 : LD - 12 };
    const eStart = given.emphasis ? hexRgb(given.emphasis) : fromLch(clamp(eWant.light, 5, 95), eWant.chroma, hD) ?? D;
    const E = findInk(eStart, c => ink(c) && de00(c, T) >= DE_BODY && de00(c, D) >= DE_PAIR, given.emphasis ? {} : eWant);
    // ⑤ 속마음 = 보조색 — 강조색과 색상이 30° 넘게 다른 두 번째 주제 색 · 없으면 40° 옆(진하기 조금 낮게)
    const second = pool.find(c => hueGap(lch(c)[2], hD) >= 30);
    const tWant = second ? { hue: lch(second)[2], chroma: Math.max(lch(second)[1] * 0.85, 22), light: LD } : { hue: (hD + 40) % 360, chroma: Math.max(CD * 0.75, 22), light: LD };
    const tStart = given.thought ? hexRgb(given.thought) : fromLch(tWant.light, tWant.chroma, tWant.hue) ?? second ?? D;
    const Th = findInk(tStart, c => ink(c) && de00(c, T) >= DE_BODY && far(c, [D, E], DE_PAIR), given.thought ? {} : tWant);
    const out = { ...k };
    if (!E || !Th) throw new Error(`꾸밈 색을 못 벌렸어요 — 강조 ${!!E} · 속마음 ${!!Th}`);
    out.dialogue = rgbHex(D); out.emphasis = rgbHex(E); out.thought = rgbHex(Th); out.mark = rgbHex(M);
    return out;
}
/** 시안 틀 HTML 에서 주제 색 후보(많이 쓴 진한 색부터) */
export function seedColors(html, avoid = []) {
    const count = new Map();
    for (const m of String(html).matchAll(/#([0-9a-f]{6})\b/gi)) { const h = '#' + m[1].toLowerCase(); count.set(h, (count.get(h) ?? 0) + 1); }
    const bad = avoid.map(hexRgb).filter(Boolean);
    return [...count.entries()].filter(([h]) => { const c = hexRgb(h); return lch(c)[1] >= 20 && bad.every(b => de00(c, b) >= 8); })
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([h]) => h).slice(0, 6);
}
