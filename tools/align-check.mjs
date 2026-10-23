// align-check.mjs — 단추 · 배지 · 칩 · 탭 · 알약 라벨 · 스위치 라벨 · 아이콘 단추의 「보이는 글자」 정렬 · 크기 · 누르는 칸 · 빈 칸 · 가독성 검사
//
// 왜: 상자(line box)만 재면 가운데여도, 글꼴의 위아래 여백(ascent/descent) · 뒤 공백 · &nbsp; · 빈 아이콘 칸 · 자간 때문에
//     「보이는 글자(잉크)」는 한쪽으로 치우칠 수 있다. 그래서 요소의 실제 글꼴 · 크기 · 굵기 · 자간으로 캔버스에 글자를 그려
//     잉크 경계를 구하고(measureText 의 actualBoundingBox + 4배 크기로 그린 픽셀 확인), 요소 상자 안의 위/아래 · 왼/오른 여백 차이를 잰다.
//
// 사용법 (CDP 로 열린 페이지 — 리그의 page.eval(식) 이 Runtime.evaluate(awaitPromise, returnByValue) 이면 그대로):
//     import { alignCheck, summarize, zoomCrops, contactSheet } from <이 파일>;
//     const r = await page.eval(alignCheck('.my-root'));                      // 결과 JSON (아래 「결과」)
//     const r = await page.eval(alignCheck(['.a', '.b'], { touch: true }));    // 뿌리 여러 개 · 선택 사항
//     await refineWithPixels(page, r);                                         // (권장) 칠한 요소의 잉크 가운데를 실제 화면 사진(4배)으로 다시 판정
//     console.log(summarize(r));                                               // 한 줄 요약 + 종류별 수
//     await zoomCrops(page, r, 'shots/zoom', { screen: 'home' });              // 요소별 3배 잘라내기 → shots/zoom/home-<번호>-<종류>-<글자>.png (기본: 위반 있는 것, which:'all' 이면 전부)
//     await contactSheet('shots/zoom', 'home', 'shots/zoom/home-sheet.png');    // 잘라낸 것을 한 장에 (python + PIL) — Read 로 직접 열어 눈으로 본다(숫자가 못 잡는 치우침 · 흐림 · 크기 들쭉날쭉)
//     const r = await page.eval(alignCheck('.my-root', { colors: true }));      // 색 감시: 계산된 색이 palette.css 의 --lp-* 값 · 투명도 변형 · 두 색 섞음인지 (color-off)
//     const p = await paletteSwitchTest(page, { probes: [{ sel: '.my-primary', prop: 'background-color', token: 'accent', frame: '#my-iframe' }] });
//                                                                              // 테마 팔레트를 night → melon-night → grapefruit-night → salt 로 새로고침 없이 바꿔 파랑 자리 = --salty-accent 인지
//   정확도: 글자 기준선은 Range 위 + 캔버스 fontBoundingBoxAscent(리그에서 0 크기 inline-block 과 144가지 글꼴 · 크기 · 줄 높이 모두 일치),
//     그리는 기준선은 CSS px 정수로 반올림(Chromium, 사진으로 확인). 공백이 든 글자는 화면이 계산보다 0.4–0.6px 어긋날 수 있어 0.5px 판정은 refineWithPixels 가 기준.
//     pixelTruth(page, r) 는 같은 비교를 표로 돌려줌(검사기 자체 확인용).
//   page 는 { eval(expr) → 값, send(method, params) → CDP 결과 } 만 있으면 된다(리그의 CDP 도우미가 돌려주는 꼴).
//   puppeteer 면 { eval: e => page.evaluate(e), send: (m, p) => cdp.send(m, p) }.
//   eval 시간 제한은 넉넉히(요소 수백 개면 수 초, 큰 화면 20–60초): b.eval(식, { timeout: 90000 }).
//
// 선택 사항 opts (모두 생략 가능):
//     touch        누르는 칸 44px 검사를 할지 (기본: matchMedia('(pointer: coarse)'))
//     tapMin       44              inkTol 0.5 (px)          sizeTol 2 (px)          switchTol 1 (px)
//     refs         { ctl, icon, lg } 보이는 단추 높이 기준(px). 기본은 같은 페이지에서 잰 값:
//                  ctl = 뿌리 안에 잠깐 넣은 <div class="menu_button">확인</div> 의 실제 높이(블루레몬에이드 테마가 켜져 있으면 테마 단추 높이),
//                  icon = CSS 변수 --bl-h-icon(없으면 ctl), lg = --bl-h-lg(팝업 · dialog 안 단추만, 없으면 ctl)
//     scroll       true  누르는 칸 격자 검사 전에 요소를 화면 가운데로 스크롤(끝나면 모든 스크롤 위치를 되돌림)
//     grid         7     누르는 칸 격자 샘플 수(한 변)
//     textScan     true  뿌리 안 모든 글자 노드의 크기 · 굵기 · 대비 · 흐림 검사(가독성)
//     bodyMin 15 · labelMin 13 · weightMin 400 · aa 4.5 · aaLarge 3 · bodyTarget 7
//     exclude      더 뺄 선택자(문자열)   include  더 넣을 선택자(문자열, 종류는 button 으로)
//     maxItems     600   items 에 담을 요소 수 상한(위반은 모두 담음)
//     colors       false | true | { root: '.lp-root', vars: [...], allow: ['#hex', …], ignore: '선택자', tol: 0.02(oklab 거리), frames: true(같은 출처 iframe 안까지) }
//     snap         true  그리는 기준선을 CSS px 정수로 반올림(Chromium 동작)   offscreen false  잉크 캔버스로 OffscreenCanvas 사용
//
// 결과: { root, at, viewport:{w,h,dpr}, touch, refs, counts:{ targets, measured, textChecked, unknownBg },
//         items:[{ i, sel, kind, text, box:[x,y,w,h], painted, ink:{ top,bottom,left,right, dv, dh, hChecked, method }, h, ref, tap:{w,h,anchor,steal,covered}, font:{size,weight}, v:[위반 종류] }],
//         violations:[{ i, sel, kind, text, type, value, need, detail }], notes:[…같은 꼴, 위반은 아니지만 볼 것], summary:{ violations, byType, byKind } }
//   위반 종류(type):
//     ink-v       글자 잉크의 위 여백 − 아래 여백(px, 음수 = 위로 치우침) |값| > 0.5
//     ink-unresolved 계산과 화면이 4px 초과로 달라 판정 미확정(원계산 위반도 보존, 표적 재측정 필요)
//     ink-h       왼 여백 − 오른 여백(px, 음수 = 왼쪽으로 치우침) |값| > 0.5 — 가운데 맞춤이거나 상자가 내용에 꼭 맞는 요소만
//     icon-text   아이콘 잉크 가운데와 글자 잉크 가운데의 세로 차이 |값| > 1
//     switch-v    스위치 · 체크칸 가운데와 라벨 첫 줄 잉크 가운데 차이 |값| > switchTol
//     size-big / size-small  보이는 높이(배경 · 테두리가 있는 상자)가 기준 ±2px 밖
//     tap-small   (touch) 실제 누르는 칸(상자 + 투명 ::before/::after) < 44px
//     tap-anchor  투명 확장 영역의 기준(containing block)이 요소 자신이 아님 — 상자가 조상 크기로 번질 수 있음
//     tap-steal   이 요소의 투명 영역이 이웃 누를 것의 보이는 상자 위를 덮어 누름을 빼앗음(elementFromPoint 격자)
//     tap-covered 이 요소의 보이는 상자 위를 이웃의 누를 영역이 덮음
//     blank-space 글자 앞뒤 공백 · &nbsp; 가 보이는 자리를 차지함(값 = 빈 폭 px)
//     blank-el    잉크 없는 빈 요소(빈 아이콘 칸 등)가 자리를 차지함
//     pad-asym    좌우 padding 이 다르고(> 0.5) 글자도 가로로 치우침
//     font-small  글자 크기 < 13(라벨 · 보조) · < 15(본문)
//     font-thin   굵기 < 400
//     contrast    실제 배경 합성 뒤 대비 < 4.5 (큰 글자 3)
//     opacity     opacity 로 흐린 글자(비활성 제외)
//     subpixel    테두리 두께가 장치 픽셀 격자에 안 맞음(흐린 1px 선)
//     color-off   (colors) 계산된 color · background · border · outline · box-shadow · text-shadow · fill · stroke · ::before/::after 색이 팔레트 밖 (detail.prop · nearest · dist)
//   notes: contrast-target(본문 < 7) · text-shadow · transform-scale · ink-unpainted(배경 없는 요소의 치우침) · pad-asym(글자는 가운데) · opacity-disabled · contrast-disabled · subpixel-pos(테두리 상자 가장자리가 소수 장치 px)
//
// node 에서 순수 계산만: import { alignMath } … const M = alignMath(); M.ratio(…), M.inkBoxFromAlpha(…), M.judgeInk(…) — tools/tests 의 자체 시험이 쓴다.

/** 순수 계산(브라우저 · node 공통). 페이지 함수에는 문자열로 끼워 넣으므로 바깥 변수를 쓰지 않는다. */
export function alignMath() {
    const clamp01 = v => Math.min(1, Math.max(0, v));
    const srgbFromLinear = v => { v = clamp01(v); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
    const oklabToRgb = (L, a, b) => {
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
        const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
        return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(v => srgbFromLinear(v) * 255);
    };
    const num = (s, pct = 1) => { s = String(s).trim(); if (s === 'none') return 0; return s.endsWith('%') ? parseFloat(s) / 100 * pct : parseFloat(s); };
    /** CSS 색 문자열 → {r,g,b,a} (0–255, a 0–1). rgb() · rgba() · #hex · color(srgb …) · oklab() · oklch() · transparent. 모르면 null */
    function parseColor(str) {
        if (str == null) return null; const s = String(str).trim().toLowerCase();
        if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
        let m = s.match(/^#([0-9a-f]{3,8})$/);
        if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map(c => c + c).join(''); const v = i => parseInt(h.slice(i, i + 2), 16); return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) / 255 : 1 }; }
        m = s.match(/^(rgba?|color|oklab|oklch)\((.*)\)$/); if (!m) return null;
        const [body, alphaPart] = m[2].split('/'); let parts = body.split(/[\s,]+/).filter(Boolean);
        let a = alphaPart != null ? num(alphaPart, 1) : (m[1] === 'rgba' || (m[1] === 'rgb' && parts.length === 4) ? num(parts[3], 1) : 1);
        if (m[1] === 'rgb' || m[1] === 'rgba') { const c = parts.slice(0, 3).map(p => num(p, 255)); return { r: c[0], g: c[1], b: c[2], a }; }
        if (m[1] === 'color') { const space = parts.shift(); const c = parts.slice(0, 3).map(p => num(p, 1)); if (space === 'srgb') return { r: c[0] * 255, g: c[1] * 255, b: c[2] * 255, a }; if (space === 'srgb-linear') return { r: srgbFromLinear(c[0]) * 255, g: srgbFromLinear(c[1]) * 255, b: srgbFromLinear(c[2]) * 255, a }; return null; }
        if (m[1] === 'oklab') { const [r, g, b] = oklabToRgb(num(parts[0], 1), num(parts[1], 0.4), num(parts[2], 0.4)); return { r, g, b, a }; }
        if (m[1] === 'oklch') { const L = num(parts[0], 1), C = num(parts[1], 0.4), H = parseFloat(parts[2]) * Math.PI / 180 || 0; const [r, g, b] = oklabToRgb(L, C * Math.cos(H), C * Math.sin(H)); return { r, g, b, a }; }
        return null;
    }
    const lum = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    /** 알파 배열(w×h, 0–255)에서 threshold 이상인 픽셀의 경계 상자 — 없으면 null. {x0,y0,x1,y1} (x1 · y1 은 끝 다음 칸) */
    function inkBoxFromAlpha(alpha, w, h, threshold = 96) {
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] >= threshold) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
    }
    /** 상자 {left,top,right,bottom} 안 잉크 {left,top,right,bottom} 의 네 여백과 차이. dv = 위 − 아래(음수 = 위로), dh = 왼 − 오른(음수 = 왼쪽으로) */
    function gaps(box, ink) {
        const top = ink.top - box.top, bottom = box.bottom - ink.bottom, left = ink.left - box.left, right = box.right - ink.right;
        const r = v => Math.round(v * 100) / 100;
        return { top: r(top), bottom: r(bottom), left: r(left), right: r(right), dv: r(top - bottom), dh: r(left - right) };
    }
    /** 판정은 「여백 차이」 그 자체(> tol). 잉크 가운데의 어긋남은 그 절반 */
    const judgeInk = (g, tol = 0.5, hChecked = true) => ({ v: Math.abs(g.dv) > tol, h: hChecked && Math.abs(g.dh) > tol });
    /** 보이는 높이 h 를 기준 ref 와 견줌 → 'size-big' | 'size-small' | null */
    const judgeSize = (h, ref, tol = 2) => (ref == null || !(ref > 0)) ? null : h > ref + tol ? 'size-big' : h < ref - tol ? 'size-small' : null;
    /** 글자 앞뒤의 보이는 빈 칸: white-space 가 공백을 접는지(collapse)에 따라 &nbsp;(U+00A0) · 공백 · 전각 공백 · 탭을 센다 */
    function edgeBlanks(text, collapse = true) {
        const vis = collapse ? /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/ : /[\s\u00A0\u3000]/;
        let lead = 0, trail = 0; const s = String(text);
        for (let i = 0; i < s.length; i++) { const ch = s[i]; if (vis.test(ch)) lead++; else if (collapse && /\s/.test(ch)) continue; else break; }
        for (let i = s.length - 1; i >= 0; i--) { const ch = s[i]; if (vis.test(ch)) trail++; else if (collapse && /\s/.test(ch)) continue; else break; }
        return { lead, trail };
    }
    /** 장치 픽셀 격자에 맞는지: v(css px) × dpr 가 정수에서 eps 안 */
    const onGrid = (v, dpr = 1, eps = 0.02) => { const d = v * dpr; return Math.abs(d - Math.round(d)) <= eps; };
    const isLarge = (size, weight) => size >= 24 || (size >= 18.66 && weight >= 700);
    /** sRGB(0–255) → oklab [L, a, b] */
    const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    function oklab(c) {
        const r = toLin(c.r), g = toLin(c.g), b = toLin(c.b);
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
    }
    const dist3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const segDist = (p, a, b) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; if (!L2) return dist3(p, a); let t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2; t = Math.max(0, Math.min(1, t)); return dist3(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]); };
    /**
     * 색 c 가 팔레트 pal([{ name, c }]) 의 값 · 그 투명도 변형(color-mix(…, transparent)) · 두 팔레트 색의 섞음(color-mix(A N%, B)) 중 하나인지.
     * 반환 { ok, how: 'transparent'|'same'|'mix', name, dist } — dist 는 oklab 거리(가장 가까운 것). tol 기본 0.02
     */
    function paletteMatch(c, pal, tol = 0.02) {
        if (!c) return { ok: true, how: 'unknown' };
        if (c.a < 0.01) return { ok: true, how: 'transparent' };
        const p = oklab(c); let best = { ok: false, dist: Infinity, name: null };
        const P = pal.filter(x => x.c && x.c.a > 0.01).map(x => ({ name: x.name, o: oklab(x.c) }));
        for (const x of P) { const d = dist3(p, x.o); if (d < best.dist) best = { ok: d <= tol, how: 'same', name: x.name, dist: d }; }
        if (best.ok) return best;
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const d = segDist(p, P[i].o, P[j].o); if (d <= tol && d < (best.mixDist ?? Infinity)) return { ok: true, how: 'mix', name: P[i].name + '+' + P[j].name, dist: d }; }
        return best;
    }
    return { parseColor, lum, blend, ratio, inkBoxFromAlpha, gaps, judgeInk, judgeSize, edgeBlanks, onGrid, isLarge, oklab, paletteMatch };
}

/** 브라우저 안에서 도는 본체. alignCheck() 가 문자열로 만들어 넘긴다(바깥 변수 쓰지 않음). */
export async function pageAlignCheck(rootSel, opts, M) {
    const O = Object.assign({ tapMin: 44, inkTol: 0.5, sizeTol: 2, switchTol: 1, scroll: true, grid: 7, textScan: true, bodyMin: 15, labelMin: 13, weightMin: 400, aa: 4.5, aaLarge: 3, bodyTarget: 7, exclude: '', include: '', maxItems: 600 }, opts || {});
    const sels = Array.isArray(rootSel) ? rootSel : [rootSel || 'body'];
    const roots = sels.flatMap(s => [...document.querySelectorAll(s)]).filter((r, i, a) => a.indexOf(r) === i && !a.some(o => o !== r && o.contains(r)));
    const dpr = window.devicePixelRatio || 1;
    const touch = O.touch != null ? !!O.touch : matchMedia('(pointer: coarse)').matches;
    const out = { root: sels, at: new Date().toISOString(), viewport: { w: innerWidth, h: innerHeight, dpr }, touch, refs: {}, counts: { targets: 0, measured: 0, textChecked: 0, unknownBg: 0 }, items: [], violations: [], notes: [], summary: {} };
    if (!roots.length) { out.error = 'root not found'; return out; }
    const R2 = v => Math.round(v * 100) / 100;
    const csOf = (e, p) => getComputedStyle(e, p || null);

    // ---------- 색: 수식으로 못 읽는 색(lab() 등)은 1×1 캔버스에 칠해 읽는다 ----------
    const colorCanvas = (() => { try { const c = new OffscreenCanvas(1, 1); return c.getContext('2d', { willReadFrequently: true }); } catch { const c = document.createElement('canvas'); c.width = c.height = 1; return c.getContext('2d', { willReadFrequently: true }); } })();
    const colorCache = new Map();
    const toRGBA = s => {
        if (colorCache.has(s)) return colorCache.get(s);
        let c = M.parseColor(s);
        if (!c) { try { colorCanvas.clearRect(0, 0, 1, 1); colorCanvas.fillStyle = '#000'; colorCanvas.fillStyle = s; colorCanvas.fillRect(0, 0, 1, 1); const d = colorCanvas.getImageData(0, 0, 1, 1).data; c = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } catch { c = null; } }
        colorCache.set(s, c); return c;
    };
    const colorsIn = s => { const outc = []; const re = /(rgba?|color|oklab|oklch|lab|lch|hsla?)\([^()]*(\([^()]*\)[^()]*)*\)|#[0-9a-f]{3,8}\b/gi; let m; while ((m = re.exec(String(s)))) { const c = toRGBA(m[0]); if (c) outc.push(c); } return outc; };

    // ---------- 보이는지 · 칠해졌는지 ----------
    const opacityChain = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(csOf(e).opacity); return o; };
    const visible = el => {
        if (!el.isConnected || el.closest('[hidden], template, script, style, noscript')) return false;
        const cs = csOf(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
        const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
        if (opacityChain(el) < 0.05) return false;
        for (let p = el.parentElement; p; p = p.parentElement) { const pc = csOf(p); if (pc.display === 'contents') continue; if (/(hidden|clip|auto|scroll)/.test(pc.overflowX + pc.overflowY)) { const pr = p.getBoundingClientRect(); if (pr.width < 1 || pr.height < 1) return false; if (r.right <= pr.left || r.left >= pr.right || r.bottom <= pr.top || r.top >= pr.bottom) { if (!/(auto|scroll)/.test(pc.overflowX + pc.overflowY)) return false; } } }
        return true;
    };
    const paintedOf = (cs) => {
        const bg = toRGBA(cs.backgroundColor); const bgi = cs.backgroundImage && cs.backgroundImage !== 'none';
        const bw = ['Top', 'Right', 'Bottom', 'Left'].map(s => (cs['border' + s + 'Style'] !== 'none' && cs['border' + s + 'Style'] !== 'hidden') ? parseFloat(cs['border' + s + 'Width']) || 0 : 0);
        const bc = ['Top', 'Right', 'Bottom', 'Left'].map(s => toRGBA(cs['border' + s + 'Color']));
        const border = bw.some((w, i) => w >= 0.5 && bc[i] && bc[i].a > 0.05);
        const full = border && bw.every((w, i) => w >= 0.5 && bc[i] && bc[i].a > 0.05);
        const inset = /inset/.test(cs.boxShadow || '') && !/^none$/.test(cs.boxShadow);
        return { any: (bg && bg.a > 0.05) || bgi || full || inset, bg: (bg && bg.a > 0.05) || bgi, border, full, bw };
    };

    // ---------- 요소 고르기 ----------
    const INTERACTIVE = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], a[href], input[type="button"], input[type="submit"], input[type="reset"], summary, .menu_button, .interactable, [onclick], [data-act]';
    const FIELD = 'input:not([type="hidden"]), select, textarea, [contenteditable="true"], [contenteditable=""]';
    const SKIP = '.mes_text, #chat .mes_text *, svg *, canvas, video, iframe, option, optgroup, datalist' + (O.exclude ? ', ' + O.exclude + ', :is(' + O.exclude + ') *' : '');
    const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    const hasIconSelf = el => { const b = csOf(el, '::before'), a = csOf(el, '::after'); return [b, a].some(p => glyphOf(p) && p.position !== 'absolute'); };
    const iconChildren = el => [...el.querySelectorAll('i, svg, img, [class*="fa-"], [class*="icon"]')].filter(x => x !== el);
    function glyphOf(pcs) {
        const c = pcs.content; if (!c || c === 'none' || c === 'normal') return '';
        const m = c.match(/^"((?:[^"\\]|\\.)*)"$/); if (!m) return '';
        return m[1].replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1');
    }
    const textOf = el => (el.innerText || el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
    // cursor 는 물려받으므로 「pointer 가 시작되는 요소」만 누를 것으로 본다
    const isInteractive = el => el.matches(INTERACTIVE) || (O.include && el.matches(O.include)) || (csOf(el).cursor === 'pointer' && !el.matches(FIELD) && !(el.parentElement && csOf(el.parentElement).cursor === 'pointer'));
    function kindOf(el) {
        if (el.matches(SKIP)) return null;
        if (el.matches('input[type="checkbox"], input[type="radio"], input[type="range"], input[type="color"], input[type="file"], ' + 'input:not([type]), input[type="text"], input[type="number"], input[type="search"], input[type="password"], input[type="email"], input[type="url"], select, textarea')) return null;
        const cs = csOf(el); const r = el.getBoundingClientRect(); const txt = textOf(el);
        if (el.matches('label') && el.querySelector(':scope > input[type="checkbox"], :scope > input[type="radio"], :scope > * > input[type="checkbox"]') && txt) return 'switch';
        const inter = isInteractive(el);
        const p = paintedOf(cs);
        const cls = (typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')).toLowerCase();
        if (inter) {
            if (r.height > 140) return null;   // 카드 · 큰 칸
            if (r.height > 56 && [...el.children].filter(c => /^(block|flex|grid|list-item)$/.test(csOf(c).display) && c.textContent.trim()).length >= 2) return null;   // 알림 카드(토스트) · 글 묶음
            if (el.querySelector(INTERACTIVE + ', ' + FIELD)) { if (r.height > 64 || !p.any) return null; }   // 누를 것을 품은 묶음(줄 · 카드)
            if (el.matches('[role="tab"]') || el.closest('[role="tablist"]') === el.parentElement || /(^|[\s_-])tabs?($|[\s_-])/.test(cls)) return 'tab';
            if (/(^|[\s_-])(chip|tag|filter-chip)s?($|[\s_-])/.test(cls) && r.height <= 40) return 'chip';
            const wide = r.width >= Math.min(innerWidth, (el.parentElement?.getBoundingClientRect().width || innerWidth)) * 0.92 && !/center/.test(cs.textAlign) && !/center/.test(cs.justifyContent);
            if (wide && r.width > 160) return 'row';   // 전폭 목록 행 — 세로 가운데 · 아이콘-글자 줄 맞춤만
            const list = el.closest('[role="menu"], [role="listbox"], .list-group, ul, ol, #extensionsMenu, .options-content');
            if (list && list !== el && r.width >= list.getBoundingClientRect().width * 0.85 && !/center/.test(cs.justifyContent)) return 'row';   // 메뉴 · 목록 항목
            if (!txt && (iconChildren(el).length || hasIconSelf(el))) return 'icon-button';
            if (el.matches('a[href]') && !p.any) return txt ? null : 'icon-button';   // 글 속 링크
            if (el.matches('a[href]')) return 'link-button';
            if (!txt) return null;
            if (p.any && txt.length <= 10 && r.height <= 26 && parseFloat(cs.fontSize) <= 13) return 'badge-button';   // 판 알약 · 작은 숫자 배지 단추(누름은 재고 크기는 안 견줌)
            if (r.height > 50 && el.querySelector('img, svg, canvas, [class*="preview"], [class*="sample"], [class*="swatch"]')) return 'tile';   // 미리보기 · 견본이 든 고르기 칸(크기는 안 견줌)
            return 'button';
        }
        if (!p.any || !txt || txt.length > 24 || r.height > 34 || r.width > 260 || el.children.length > 4) return null;
        if (cs.display === 'inline') return null;   // 글 속 꾸밈(strong · code · mark · del …)은 배지가 아님
        if (/^(block|flex|grid|list-item|table|table-row)$/.test(cs.display) && r.width > (el.parentElement?.getBoundingClientRect().width || innerWidth) * 0.6) return null;   // 목록 줄 · 칸
        if (el.closest(INTERACTIVE) && el.closest(INTERACTIVE) !== el && !/(badge|count|num|ver|pill|tag|chip|new)/.test(cls)) return null;
        if (el.querySelector('div, p, ul, table')) return null;
        const rad = parseFloat(cs.borderTopLeftRadius) || 0;
        if (/(^|[\s_-])(chip|tag)s?($|[\s_-])/.test(cls)) return 'chip';
        if (rad >= r.height / 2 - 1 && r.height <= 30) return 'pill';
        return 'badge';
    }

    // ---------- 글자 잉크: 캔버스 ----------
    const SCALE = 4;
    // 잉크 캔버스: O.offscreen 이면 OffscreenCanvas, 기본은 문서에 붙이지 않은 <canvas>(문서의 웹 글꼴 · 아이콘 글꼴을 확실히 같이 씀)
    const inkCanvas = (() => { if (O.offscreen) { try { const c = new OffscreenCanvas(64, 64); return { c, x: c.getContext('2d', { willReadFrequently: true }) }; } catch { } } const c = document.createElement('canvas'); c.width = c.height = 64; return { c, x: c.getContext('2d', { willReadFrequently: true }) }; })();
    const fontKey = cs => `${cs.fontStyle} ${cs.fontWeight} {SIZE}px ${cs.fontFamily}`;
    const inkCache = new Map();
    /** 글자 s 를 cs 의 글꼴로 그려 원점(왼쪽 · 기준선) 기준 잉크 {l,r,t,b}(px, t 는 기준선 위 = 음수) + 글꼴 ascent/descent. 공백뿐이면 ink=null */
    function textInk(s, cs) {
        const size = parseFloat(cs.fontSize); const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
        const tt = cs.textTransform; if (tt === 'uppercase') s = s.toUpperCase(); else if (tt === 'lowercase') s = s.toLowerCase();
        const key = fontKey(cs) + '|' + size + '|' + ls + '|' + s;
        if (inkCache.has(key)) return inkCache.get(key);
        const x = inkCanvas.x;
        x.font = fontKey(cs).replace('{SIZE}', String(size)); try { x.letterSpacing = ls + 'px'; } catch { }
        x.fontKerning = cs.fontKerning === 'none' ? 'none' : 'normal';
        const m1 = x.measureText(s);
        const asc = m1.fontBoundingBoxAscent, desc = m1.fontBoundingBoxDescent, adv = m1.width;
        let res = { asc, desc, adv, ink: null, metric: null, method: 'canvas' };
        if (s.trim() && (m1.actualBoundingBoxRight + m1.actualBoundingBoxLeft) > 0) {
            res.metric = { l: -m1.actualBoundingBoxLeft, r: m1.actualBoundingBoxRight, t: -m1.actualBoundingBoxAscent, b: m1.actualBoundingBoxDescent };
            // 픽셀 확인: 4배로 그려 알파가 남는 칸
            x.font = fontKey(cs).replace('{SIZE}', String(size * SCALE)); try { x.letterSpacing = (ls * SCALE) + 'px'; } catch { }
            const m4 = x.measureText(s);
            const pad = 8 * SCALE, L = Math.ceil(m4.actualBoundingBoxLeft), Rr = Math.ceil(m4.actualBoundingBoxRight), A = Math.ceil(m4.actualBoundingBoxAscent), D = Math.ceil(m4.actualBoundingBoxDescent);
            const W = Math.min(8192, L + Rr + pad * 2), H = Math.min(2048, A + D + pad * 2);
            if (inkCanvas.c.width < W) inkCanvas.c.width = W; if (inkCanvas.c.height < H) inkCanvas.c.height = H;
            x.font = fontKey(cs).replace('{SIZE}', String(size * SCALE)); try { x.letterSpacing = (ls * SCALE) + 'px'; } catch { }
            x.fontKerning = cs.fontKerning === 'none' ? 'none' : 'normal';
            x.clearRect(0, 0, W, H); x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
            const ox = pad + L, oy = pad + A; x.fillText(s, ox, oy);
            const d = x.getImageData(0, 0, W, H).data; const alpha = new Uint8ClampedArray(W * H); for (let i = 0; i < W * H; i++) alpha[i] = d[i * 4 + 3];
            const bb = M.inkBoxFromAlpha(alpha, W, H, 96);
            if (bb) { res.ink = { l: (bb.x0 - ox) / SCALE, r: (bb.x1 - ox) / SCALE, t: (bb.y0 - oy) / SCALE, b: (bb.y1 - oy) / SCALE }; res.method = 'pixel'; }
            else res.ink = res.metric;
        }
        inkCache.set(key, res); return res;
    }
    /** 글자 노드 하나의 잉크 상자들(줄마다) — 페이지 좌표 */
    function textNodeInks(node) {
        const parent = node.parentElement; const cs = csOf(parent);
        const raw = node.textContent; if (!raw) return [];
        const range = document.createRange(); range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        if (!rects.length) return [];
        // 접히는 공백: 줄 앞뒤에서 접혀 사라진 공백은 rect 에 없다 → 글자마다 실제로 그려진 칸만 모아 줄을 만든다
        const rendered = i => { range.setStart(node, i); range.setEnd(node, i + 1); const rr = [...range.getClientRects()].find(x => x.height > 0); return rr && (rr.width > 0.01 || !/\s/.test(raw[i])) ? rr : null; };
        const lines = [];
        const n = Math.min(raw.length, 400);
        if (rects.length === 1 && n === raw.length) {
            let a = 0, b = n - 1; while (a < n && /\s/.test(raw[a]) && !rendered(a)) a++; while (b > a && /\s/.test(raw[b]) && !rendered(b)) b--;
            if (a <= b) lines.push({ rect: rects[0], text: raw.slice(a, b + 1), start: a });
        } else {   // 여러 줄: 글자마다 줄을 나눈다
            let cur = null;
            for (let i = 0; i < n; i++) {
                const rr = rendered(i); if (!rr) continue;
                if (!cur || Math.abs(rr.top - cur.top) > 1) { cur = { top: rr.top, left: rr.left, right: rr.right, bottom: rr.bottom, text: raw[i], start: i }; lines.push(cur); }
                else { cur.text += raw[i]; cur.right = Math.max(cur.right, rr.right); cur.left = Math.min(cur.left, rr.left); cur.bottom = Math.max(cur.bottom, rr.bottom); }
            }
            for (const l of lines) { l.text = l.text.replace(/\s+$/, sp => sp); l.rect = { left: l.left, top: l.top, right: l.right, bottom: l.bottom, width: l.right - l.left, height: l.bottom - l.top }; }
        }
        const res = [];
        const collapse = !/^(pre|pre-wrap|break-spaces)$/.test(cs.whiteSpace);
        for (const ln of lines) {
            const drawn = collapse ? ln.text.replace(/[ \t\n\r\f]+/g, ' ') : ln.text;
            const m = textInk(drawn, cs);
            // Chromium 은 글자 줄의 기준선을 CSS px 정수로 반올림해 그린다(리그 사진으로 확인: 기준선 소수 .5 면 0.5px 아래). 가로는 소수 자리 그대로.
            const base = snap(ln.rect.top + m.asc), ox = ln.rect.left;
            if (!m.ink) { res.push({ empty: true, rect: ln.rect, cs, text: drawn }); continue; }
            // 가로 끝: 줄 전체를 캔버스로 그리면 공백 폭 · 글자 사이 위치가 화면과 조금 달라(0.5–1px) 첫 글자 · 끝 글자를 그 글자의 실제 Range 자리에서 잰다
            let L = ox + m.ink.l, Rt = ox + m.ink.r;
            const vis = []; for (let i = ln.start; i < Math.min(raw.length, ln.start + 400); i++) { if (!/\s/.test(raw[i])) vis.push(i); if (vis.length && i > ln.start && lines.length > 1 && raw[i] === undefined) break; }
            const inLine = vis.filter(i => { const rr = rendered(i); return rr && Math.abs(rr.top - ln.rect.top) <= 1.5; });
            if (inLine.length) {
                const chAt = i => { const c = raw.codePointAt(i); return String.fromCodePoint(c); };
                const f = inLine[0], l = inLine[inLine.length - 1];
                const rf = rendered(f), rl = rendered(l);
                const kf = textInk(chAt(f), cs), kl = textInk(chAt(l), cs);
                if (rf && kf.ink) L = rf.left + kf.ink.l;
                if (rl && kl.ink) Rt = rl.left + kl.ink.r;
            }
            res.push({ left: L, right: Rt, top: base + m.ink.t, bottom: base + m.ink.b, rect: ln.rect, cs, text: drawn, method: m.method, metric: m.metric ? { left: ox + m.metric.l, right: ox + m.metric.r, top: base + m.metric.t, bottom: base + m.metric.b } : null, adv: m.adv });
        }
        return res;
    }
    const snap = v => O.snap === false ? v : Math.floor(v + 0.5);
    const firstTextIn = el => { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return n; return null; };
    /** ::before/::after 의 글리프(아이콘 글꼴 등) 잉크 — 위치는 CSS 배치 규칙으로 계산(근삿값, method 'pseudo') */
    function pseudoInk(el, which) {
        const p = csOf(el, which); const g = glyphOf(p); if (!g || !g.trim()) return null;
        if (p.display === 'none' || p.visibility === 'hidden' || parseFloat(p.opacity) < 0.05) return null;
        const m = textInk(g, p); if (!m.ink) return null;
        const cs = csOf(el); const r = el.getBoundingClientRect();
        if (p.position === 'absolute' || p.position === 'fixed') {
            const box = pseudoBox(el, which); if (!box) return null;
            const L = parseFloat(p.lineHeight) || (m.asc + m.desc);
            const base = snap(box.top + parseFloat(p.paddingTop || 0) + (L - (m.asc + m.desc)) / 2 + m.asc);
            const ox = /center/.test(p.textAlign) ? box.left + (box.width - m.adv) / 2 : box.left + parseFloat(p.paddingLeft || 0);
            return { left: ox + m.ink.l, right: ox + m.ink.r, top: base + m.ink.t, bottom: base + m.ink.b, method: 'pseudo-abs', icon: true };
        }
        const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
        const cl = r.left + bl + parseFloat(cs.paddingLeft), ct = r.top + bt + parseFloat(cs.paddingTop);
        const cw = r.width - bl - (parseFloat(cs.borderRightWidth) || 0) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const ch = r.height - bt - (parseFloat(cs.borderBottomWidth) || 0) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const lhRaw = p.lineHeight; const L = lhRaw === 'normal' ? (m.asc + m.desc) : parseFloat(lhRaw);
        const hasText = !!el.textContent.trim() || [...el.children].some(c => visible(c));
        let lineTop = ct, ox = cl;
        const flex = /flex/.test(cs.display), grid = /grid/.test(cs.display);
        const pw = parseFloat(p.width) || m.adv;   // 칸 너비(고정 너비 아이콘이면 그 값)
        const pAlign = /center/.test(p.textAlign) ? (pw - m.adv) / 2 : 0;
        if ((flex || grid) && !hasText) {
            const ai = (flex ? cs.alignItems : (cs.alignItems === 'normal' ? cs.alignContent : cs.alignItems)) + ' ' + cs.placeItems;
            if (/center/.test(ai)) lineTop = ct + (ch - L) / 2; else if (/end/.test(ai)) lineTop = ct + ch - L;
            const jc = cs.justifyContent + ' ' + cs.justifyItems + ' ' + cs.placeContent;
            if (/center/.test(jc)) ox = cl + (cw - pw) / 2 + pAlign; else if (/(end|right)/.test(jc)) ox = cl + cw - pw + pAlign; else ox = cl + pAlign;
        } else if (!hasText) {
            if (/center/.test(cs.textAlign)) ox = cl + (cw - m.adv) / 2; else if (/(right|end)/.test(cs.textAlign)) ox = cl + cw - m.adv;
            if (cs.display === 'inline') { const asc0 = textInk('x', cs).asc; const b0 = snap(r.top + asc0), x0 = r.left; return { left: x0 + m.ink.l, right: x0 + m.ink.r, top: b0 + m.ink.t, bottom: b0 + m.ink.b, method: 'pseudo-inline', icon: true }; }
        } else {
            // 글자와 같이 있는 아이콘: 첫 글자 노드의 기준선을 같이 쓴다(같은 줄)
            const tn = firstTextIn(el); if (tn) { const ti = textNodeInks(tn)[0]; if (ti && ti.rect) { const tcs = csOf(el); const asc0 = textInk('x', tcs).asc; const base = snap(ti.rect.top + asc0); const x0 = which === '::before' ? ti.rect.left - m.adv - (parseFloat(p.marginRight) || 0) : ti.rect.right + (parseFloat(p.marginLeft) || 0); return { left: x0 + m.ink.l, right: x0 + m.ink.r, top: base + m.ink.t, bottom: base + m.ink.b, method: 'pseudo-text', icon: true }; } }
            return null;
        }
        const base = snap(lineTop + (L - (m.asc + m.desc)) / 2 + m.asc);
        return { left: ox + m.ink.l, right: ox + m.ink.r, top: base + m.ink.t, bottom: base + m.ink.b, method: 'pseudo', icon: true, approx: lhRaw === 'normal' };
    }
    /** absolute ::before/::after 의 화면 상자(기준 요소 + inset + translate) */
    function containingBlockOf(el, pos) {
        if (pos === 'fixed') return null;
        for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
            const c = csOf(e);
            if (e === el) { if (c.position !== 'static' || c.transform !== 'none' || c.filter !== 'none' || /(layout|paint|strict|content)/.test(c.contain) || c.willChange.includes('transform')) return e; continue; }
            if (c.position !== 'static' || c.transform !== 'none' || c.filter !== 'none' || c.perspective !== 'none' || /(layout|paint|strict|content)/.test(c.contain) || (c.containerType && c.containerType !== 'normal' && false) || c.willChange.includes('transform') || (c.backdropFilter && c.backdropFilter !== 'none')) return e;
        }
        return document.documentElement;
    }
    function pseudoBox(el, which) {
        const p = csOf(el, which); if (p.position !== 'absolute' && p.position !== 'fixed') return null;
        const w = parseFloat(p.width), h = parseFloat(p.height); if (!(w > 0 && h > 0)) return null;
        const cb = containingBlockOf(el, p.position);
        let ox, oy;
        if (!cb) { ox = 0; oy = 0; } else { const cr = cb.getBoundingClientRect(); const cc = csOf(cb); ox = cr.left + (parseFloat(cc.borderLeftWidth) || 0); oy = cr.top + (parseFloat(cc.borderTopWidth) || 0); }
        let L = parseFloat(p.left), T = parseFloat(p.top);
        if (cb && (isNaN(L) || isNaN(T))) {   // right · bottom 으로만 놓인 상자
            const cr = cb.getBoundingClientRect(); const cc = csOf(cb);
            const cw = cr.width - (parseFloat(cc.borderLeftWidth) || 0) - (parseFloat(cc.borderRightWidth) || 0), ch = cr.height - (parseFloat(cc.borderTopWidth) || 0) - (parseFloat(cc.borderBottomWidth) || 0);
            if (isNaN(L) && !isNaN(parseFloat(p.right))) L = cw - parseFloat(p.right) - w;
            if (isNaN(T) && !isNaN(parseFloat(p.bottom))) T = ch - parseFloat(p.bottom) - h;
        }
        if (isNaN(L) || isNaN(T)) return null;
        let x = ox + L + (parseFloat(p.marginLeft) || 0), y = oy + T + (parseFloat(p.marginTop) || 0);
        const tm = p.transform; if (tm && tm !== 'none') { const mm = tm.match(/matrix\(([^)]+)\)/); if (mm) { const v = mm[1].split(',').map(parseFloat); x += v[4]; y += v[5]; const sx = Math.hypot(v[0], v[1]), sy = Math.hypot(v[2], v[3]); if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) { const cx = x + w / 2, cy = y + h / 2; return { left: cx - w * sx / 2, top: cy - h * sy / 2, width: w * sx, height: h * sy, right: cx + w * sx / 2, bottom: cy + h * sy / 2, cb }; } } }
        return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, cb };
    }

    // ---------- 기준 높이 ----------
    const rootStyle = csOf(document.documentElement);
    const varPx = name => { const v = rootStyle.getPropertyValue(name).trim(); return v && /px$/.test(v) ? parseFloat(v) : null; };
    const refs = Object.assign({}, O.refs || {});
    if (refs.ctl == null) {
        const host = (O.refHost && document.querySelector(O.refHost)) || document.body;   // 기준 단추는 테마의 일반 자리(body)에서 — 토스트 · 메뉴 안 규칙에 끌리지 않게
        const probe = document.createElement('div'); probe.className = 'menu_button'; probe.textContent = '확인'; probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute !important; left:-9999px !important; top:0 !important; visibility:hidden !important;';
        host.appendChild(probe); refs.ctl = R2(probe.getBoundingClientRect().height); refs.ctlFrom = 'probe .menu_button'; probe.remove();
        if (!(refs.ctl > 10)) { refs.ctl = varPx('--bl-h-ctl'); refs.ctlFrom = '--bl-h-ctl'; }
    }
    if (refs.icon == null) { const v = (() => { const e = roots[0]; const s = csOf(e).getPropertyValue('--bl-h-icon').trim(); return /px$/.test(s) ? parseFloat(s) : null; })(); refs.icon = v ?? refs.ctl; refs.iconFrom = v != null ? '--bl-h-icon' : 'ctl'; }
    if (refs.lg == null) { const s = csOf(roots[0]).getPropertyValue('--bl-h-lg').trim(); refs.lg = /px$/.test(s) ? parseFloat(s) : refs.ctl; }
    out.refs = refs;

    // ---------- 이름 ----------
    const short = e => { let s = e.tagName.toLowerCase(); if (e.id) return s + '#' + e.id; const c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(x => x && !/^(fa-solid|fa-regular|fa-fw|interactable)$/.test(x)).slice(0, 3); if (c.length) s += '.' + c.join('.'); for (const a of ['data-act', 'data-tab', 'data-sub', 'data-i18n', 'title', 'aria-label', 'name']) { const v = e.getAttribute(a); if (v && v.length < 32) { s += `[${a}="${v.replace(/"/g, '')}"]`; break; } } return s; };
    const selOf = e => { const parts = []; for (let x = e, i = 0; x && x.nodeType === 1 && i < 4; x = x.parentElement, i++) { parts.unshift(short(x)); if (x.id) break; } return parts.join(' > '); };

    // ---------- 고르기 ----------
    const targets = [];
    const seen = new Set();
    for (const root of roots) for (const el of [root, ...root.querySelectorAll('*')]) {
        if (seen.has(el)) continue; seen.add(el);
        if (!(el instanceof HTMLElement)) continue;
        let kind; try { kind = kindOf(el); } catch { kind = null; }
        if (!kind) continue;
        if (!visible(el)) continue;
        // 이미 고른 누를 것 안의 누를 것(단추 속 span[role=button] 등)은 빼되, 배지 · 알약은 따로 잰다
        const anc = targets.find(t => t.el.contains(el) && t.el !== el && /button|tab|chip|row|link/.test(t.kind));   // badge-button 도 누를 것
        if (anc && !/badge|pill|chip/.test(kind)) continue;
        targets.push({ el, kind });
    }
    out.counts.targets = targets.length;
    const interactives = [];
    for (const root of roots) for (const el of root.querySelectorAll(INTERACTIVE + ', ' + FIELD + ', label')) if (visible(el)) interactives.push(el);
    const ownerOf = (hit, el) => { if (!hit) return null; if (hit === el || el.contains(hit)) return el; let best = null; for (const x of interactives) if (x === hit || x.contains(hit)) { if (!best || best.contains(x)) best = x; } return best; };

    // ---------- 요소마다 ----------
    const viol = (t, type, value, need, detail) => { const v = { i: t.i, sel: t.sel, kind: t.kind, text: t.text, type, value: typeof value === 'number' ? R2(value) : value, need, ...(detail ? { detail } : {}) }; out.violations.push(v); t.v.push(type); };
    const note = (t, type, value, detail) => { out.notes.push({ i: t.i, sel: t.sel, kind: t.kind, text: t.text, type, value: typeof value === 'number' ? R2(value) : value, ...(detail ? { detail } : {}) }); };
    const scrolled = new Map();
    const remember = el => { for (let p = el.parentElement; p; p = p.parentElement) if ((p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth) && !scrolled.has(p)) scrolled.set(p, [p.scrollLeft, p.scrollTop]); if (!scrolled.has(window)) scrolled.set(window, [scrollX, scrollY]); };

    let idx = 0;
    for (const T of targets) {
        const el = T.el; const cs = csOf(el); const r = el.getBoundingClientRect();
        const t = { i: idx++, sel: selOf(el), kind: T.kind, text: textOf(el).slice(0, 40) || (el.getAttribute('aria-label') || el.getAttribute('title') || '').slice(0, 40), box: [R2(r.left), R2(r.top), R2(r.width), R2(r.height)], v: [] };
        T.t = t;
        const p = paintedOf(cs); t.painted = !!p.any;
        const bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
        const pbox = { left: r.left + bl, right: r.right - br, top: r.top + bt, bottom: r.bottom - bb };
        // --- 잉크 모으기 ---
        const inks = []; const empties = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => { if (n.nodeType === 1) { const c = csOf(n); if (c.display === 'none' || c.visibility === 'hidden' || n.matches('script, style, template, [hidden]')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } return n.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; } });
        const elems = [el];
        const floatOf = n => { for (let e = n.nodeType === 1 ? n : n.parentElement; e && e !== el; e = e.parentElement) if (/absolute|fixed/.test(csOf(e).position)) return e; return null; };
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.nodeType === 3) { if (T.kind === 'switch' && n.parentElement.closest('input')) continue; const fl = floatOf(n); for (const k of textNodeInks(n)) (k.empty ? empties : inks).push(Object.assign(k, { node: n }, fl ? { float: fl } : {})); }
            else elems.push(n);
        }
        for (const e of elems) {
            if (e.matches('input[type="checkbox"], input[type="radio"]')) continue;
            for (const which of ['::before', '::after']) { const k = pseudoInk(e, which); if (k) inks.push(Object.assign(k, { owner: e, which })); }
            if (e !== el && e.matches('svg, img, canvas, picture, video')) { const rr = e.getBoundingClientRect(); if (rr.width > 0 && rr.height > 0) inks.push({ left: rr.left, right: rr.right, top: rr.top, bottom: rr.bottom, method: 'box', icon: true, owner: e }); }
            // 글자 없는 칠한 꾸밈(테두리로 그린 꺾쇠 · 점 · 견본)은 그 상자를 잉크로(회전이면 바깥 상자 — 사진 판정이 기준)
            else if (e !== el && !e.textContent.trim() && !e.querySelector('*') && !/absolute|fixed/.test(csOf(e).position)) { const pe = paintedOf(csOf(e)); if (pe.any || pe.border) { const rr = e.getBoundingClientRect(); if (rr.width > 0 && rr.height > 0) inks.push({ left: rr.left, right: rr.right, top: rr.top, bottom: rr.bottom, method: 'deco', icon: true, owner: e }); } }
            // 잉크 없는 빈 요소(빈 아이콘 칸 · 빈 span)가 자리를 차지하는지
            if (e !== el && !e.matches('svg *, img, svg, canvas, input, br, wbr')) {
                const er = e.getBoundingClientRect(); const ec = csOf(e);
                const pseudoPaint = ['::before', '::after'].some(w => { const pc = csOf(e, w); return pc.content !== 'none' && pc.content !== 'normal' && (glyphOf(pc).trim() || (paintedOf(pc).any && pc.position !== 'absolute')); });
                const empty = !e.textContent.trim() && !e.querySelector('svg, img, canvas, input, video') && !pseudoPaint && !paintedOf(ec).any && !paintedOf(ec).border && !/^url/.test(ec.maskImage || ec.webkitMaskImage || '');
                const ml = parseFloat(ec.marginLeft) || 0, mr = parseFloat(ec.marginRight) || 0;
                if (empty && (er.width + Math.max(0, ml) + Math.max(0, mr) > 0.5) && ec.position !== 'absolute' && ec.position !== 'fixed') empties.push({ elEmpty: e, w: er.width + Math.max(0, ml) + Math.max(0, mr) });
            }
        }
        // 투명 확장 상자(스스로는 잉크 아님)는 위에서 glyph 없음으로 빠짐
        if (inks.some(k => k.float) && inks.some(k => !k.float && !(k.owner && floatOf(k.owner)))) { const drop = inks.filter(k => k.float || (k.owner && floatOf(k.owner))); for (const k of drop) inks.splice(inks.indexOf(k), 1); note(t, 'float-excluded', drop.length, { el: short(drop[0].float || floatOf(drop[0].owner)) }); }
        if (inks.length) {
            const U = inks.reduce((a, k) => ({ left: Math.min(a.left, k.left), right: Math.max(a.right, k.right), top: Math.min(a.top, k.top), bottom: Math.max(a.bottom, k.bottom) }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
            const box = p.any ? pbox : { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            const g = M.gaps(box, U);
            // 가로 검사 대상: 가운데 맞춤 · 내용에 꼭 맞는 상자 · 아이콘 단추 · 배지 · 알약 · 칩 · 탭
            const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
            const content = { left: pbox.left + pl, right: pbox.right - pr };
            // 내용 흐름 상자: 글자 조각(Range) + 줄 안 요소(inline-*) · 아이콘 — 블록 자식(가로로 꽉 참)은 빼고
            const inlineKids = [...el.querySelectorAll('*')].filter(c => visible(c) && !/absolute|fixed/.test(csOf(c).position) && /^inline|^contents$/.test(csOf(c).display) && !c.querySelector('*') || (c.matches('svg, img, i') && visible(c)));
            const flowRects = [...inks.filter(k => k.rect).map(k => k.rect), ...inlineKids.map(c => c.getBoundingClientRect()), ...inks.filter(k => k.icon).map(k => ({ left: k.left, right: k.right, top: k.top, bottom: k.bottom }))];
            const flowL = flowRects.length ? Math.min(...flowRects.map(x => x.left)) : U.left, flowR = flowRects.length ? Math.max(...flowRects.map(x => x.right)) : U.right;
            const hugs = (flowR - flowL) >= (content.right - content.left) - 1.5;
            const centred = /center/.test(cs.textAlign) || /center/.test(cs.justifyContent) || /center/.test(cs.placeContent) || /center/.test(cs.justifyItems);
            const spread = /space-(between|around|evenly)/.test(cs.justifyContent);
            // 가운데 맞춤 상자 안에서도 글자가 왼쪽 맞춤 블록 자식(꽉 찬 줄)에 들어 있으면 가운데 맞춤이 아님(알림 · 안내 글)
            const leftBlock = inks.some(k => { const pe = k.node && k.node.parentElement; if (!pe || pe === el) return false; for (let e = pe; e && e !== el; e = e.parentElement) { const c = csOf(e); if (/^(block|list-item|flow-root)$/.test(c.display)) return /^(left|start|-webkit-left|justify)$/.test(c.textAlign) && e.getBoundingClientRect().width >= (content.right - content.left) - 2; } return false; });
            const lines = new Set(inks.filter(k => k.rect).map(k => Math.round(k.rect.top))).size;
            const hChecked = T.kind !== 'row' && T.kind !== 'switch' && T.kind !== 'tile' && !spread && ((centred && !leftBlock) || (hugs && lines <= 1 && !leftBlock) || /badge|pill|icon-button|chip/.test(T.kind));   // badge-button 포함
            // 구조 차이: 글자 「진행 상자」(조각 · 아이콘 상자)의 여백 차이 — 이것이 가운데인데 잉크만 다르면 글자 모양(옆 여백 · 위아래 여백) 탓
            const adv = flowRects.length ? { left: Math.min(...flowRects.map(x => x.left)), right: Math.max(...flowRects.map(x => x.right)), top: Math.min(...flowRects.map(x => x.top)), bottom: Math.max(...flowRects.map(x => x.bottom)) } : U;
            const sg = M.gaps(box, adv);
            t.ink = { ...g, hChecked, structH: sg.dh, structV: sg.dv, method: [...new Set(inks.map(k => k.method))].join('+'), n: inks.length };
            const j = M.judgeInk(g, O.inkTol, hChecked);
            const vv = (T.kind === 'switch' || T.kind === 'tile') ? false : j.v;
            if (p.any || T.kind === 'icon-button' && false) {
                if (vv) viol(t, 'ink-v', g.dv, `|≤${O.inkTol}|`, { top: g.top, bottom: g.bottom, structV: sg.dv, cause: Math.abs(sg.dv) <= O.inkTol ? 'glyph' : 'box', method: t.ink.method });
                if (j.h) { const cause = []; if (Math.abs(sg.dh) <= O.inkTol) cause.push('glyph'); if (Math.abs(pl - pr) > 0.5) cause.push(`padding ${R2(pl)}/${R2(pr)}`); if (empties.length) cause.push('빈 칸'); const ls = parseFloat(cs.letterSpacing) || 0; if (ls) cause.push(`자간 ${ls}`); viol(t, 'ink-h', g.dh, `|≤${O.inkTol}|`, { left: g.left, right: g.right, structH: sg.dh, cause: cause.join(', ') || 'box', method: t.ink.method }); if (Math.abs(pl - pr) > 0.5) viol(t, 'pad-asym', R2(pl - pr), '0', { left: pl, right: pr }); }
                else if (hChecked && Math.abs(pl - pr) > 0.5) note(t, 'pad-asym', R2(pl - pr), { left: pl, right: pr, inkOk: true });
            } else if (vv || j.h) note(t, 'ink-unpainted', vv ? g.dv : g.dh, { dv: g.dv, dh: g.dh });
            // 아이콘과 글자 세로 가운데
            const icons = inks.filter(k => k.icon), texts = inks.filter(k => !k.icon && k.rect);
            if (icons.length && texts.length) {
                const tU = texts.reduce((a, k) => ({ top: Math.min(a.top, k.top), bottom: Math.max(a.bottom, k.bottom) }), { top: Infinity, bottom: -Infinity });
                // 같은 줄의 아이콘만(첫 줄)
                const firstTop = Math.min(...texts.map(k => k.rect.top)); const line = texts.filter(k => Math.abs(k.rect.top - firstTop) < 2); const lU = line.reduce((a, k) => ({ top: Math.min(a.top, k.top), bottom: Math.max(a.bottom, k.bottom) }), { top: Infinity, bottom: -Infinity });
                for (const ic of icons) {
                    if (ic.bottom < tU.top - 4 || ic.top > tU.bottom + 4) continue;   // 위아래로 쌓인 아이콘은 줄 맞춤 아님
                    const d = (ic.top + ic.bottom) / 2 - (lU.top + lU.bottom) / 2;
                    const dBlock = (ic.top + ic.bottom) / 2 - (tU.top + tU.bottom) / 2;   // 여러 줄 글과 묶음 가운데로 맞춘 아이콘도 맞음
                    const off = Math.abs(d) <= Math.abs(dBlock) ? d : dBlock;
                    if (Math.abs(off) > 1) { const det = { icon: ic.method, owner: ic.owner ? short(ic.owner) : undefined, firstLine: R2(d), block: R2(dBlock) }; if (/^pseudo/.test(ic.method) && ic.method !== 'pseudo') note(t, 'icon-text-approx', off, det); else viol(t, 'icon-text', off, '|≤1|', det); }
                }
            }
        } else if (T.kind !== 'switch') t.ink = null;
        out.counts.measured += t.ink ? 1 : 0;
        // --- 빈 칸 ---
        const collapse = !/^(pre|pre-wrap|break-spaces)$/.test(cs.whiteSpace);
        const tn = [...el.querySelectorAll('*'), el].flatMap(e => [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.length));
        if (tn.length && T.kind !== 'row') {
            const first = tn.find(n => n.textContent.replace(/[ \t\n\r]/g, '').length) || null; const last = [...tn].reverse().find(n => n.textContent.replace(/[ \t\n\r]/g, '').length) || null;
            const fb = first ? M.edgeBlanks(first.textContent, !/^(pre|pre-wrap|break-spaces)$/.test(csOf(first.parentElement).whiteSpace)) : { lead: 0 };
            const lb = last ? M.edgeBlanks(last.textContent, !/^(pre|pre-wrap|break-spaces)$/.test(csOf(last.parentElement).whiteSpace)) : { trail: 0 };
            const fIn = first ? inks.filter(k => k.node === first) : [], lIn = last ? inks.filter(k => k.node === last) : [];
            const beforeInk = fIn.length && inks.some(k => k.node !== first && (k.left + k.right) / 2 < Math.min(...fIn.map(x => x.left)) && k.bottom > fIn[0].top && k.top < fIn[0].bottom);
            const afterInk = lIn.length && inks.some(k => k.node !== last && (k.left + k.right) / 2 > Math.max(...lIn.map(x => x.right)) && k.bottom > lIn[0].top && k.top < lIn[0].bottom);
            if (fb.lead && !beforeInk) viol(t, 'blank-space', fb.lead, 0, { where: '앞', chars: JSON.stringify(first.textContent.slice(0, 6)), px: fIn.length && fIn[0].rect ? R2(fIn[0].left - fIn[0].rect.left) : undefined });
            if (lb.trail && !afterInk) viol(t, 'blank-space', lb.trail, 0, { where: '뒤', chars: JSON.stringify(last.textContent.slice(-6)), px: lIn.length && lIn[0].rect ? R2(lIn[lIn.length - 1].rect.right - lIn[lIn.length - 1].right) : undefined });
            // 공백 · nbsp 만 있는 글자 노드가 다른 요소 사이에서 자리를 차지(아이콘 없는 단추의 「 지우기」)
            for (const k of empties.filter(k => k.empty && k.rect && k.rect.width > 0.5)) { if (/\u00A0|\u3000/.test(k.node.textContent) || !collapse) viol(t, 'blank-space', k.rect.width, 0, { where: '사이', chars: JSON.stringify(k.node.textContent.slice(0, 6)) }); }
        }
        // 빈 요소: 가운데 맞춤 · 내용에 꼭 맞는 요소에서만(양 끝 맞춤 줄의 빈 칸 · 늘어나는 칸은 배치용이라 빼고)
        for (const k of empties.filter(k => k.elEmpty)) { const g = parseFloat(csOf(k.elEmpty).flexGrow) || 0; if (t.ink && t.ink.hChecked && !g) viol(t, 'blank-el', k.w, 0, { el: short(k.elEmpty) }); else note(t, 'blank-el', k.w, { el: short(k.elEmpty), layout: true }); }
        // --- 보이는 크기 ---
        t.h = R2(r.height);
        if (p.any && /^(button|link-button|icon-button|tab)$/.test(T.kind) && (T.kind !== 'tab' || p.bg)) {
            const inDialog = !!el.closest('dialog, .popup, [role="dialog"], .swal2-popup');
            const ref = T.kind === 'icon-button' ? refs.icon : (inDialog ? refs.lg : refs.ctl);
            const alt = T.kind === 'icon-button' ? refs.ctl : (inDialog ? refs.ctl : null);
            t.ref = ref;
            let s = M.judgeSize(r.height, ref, O.sizeTol);
            if (s && alt != null && !M.judgeSize(r.height, alt, O.sizeTol)) s = null;   // 다른 공식 크기와 같으면 통과
            if (s) viol(t, s, r.height, `${ref}±${O.sizeTol}`, { refName: T.kind === 'icon-button' ? 'icon' : inDialog ? 'lg' : 'ctl' });
        }
        // --- 누르는 칸 ---
        if (/^(button|link-button|icon-button|badge-button|tile|tab|chip|switch|row)$/.test(T.kind)) {
            let tap = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            const ext = [];
            for (const which of ['::before', '::after']) {
                const pc = csOf(el, which); if (pc.content === 'none' || pc.content === 'normal' || pc.pointerEvents === 'none') continue;
                const pb = pseudoBox(el, which); if (!pb) continue;
                const big = pb.width > r.width + 1 || pb.height > r.height + 1;
                if (!big) continue;
                ext.push({ which, pb });
                if (pb.cb !== el) viol(t, 'tap-anchor', short(pb.cb || document.documentElement), 'self', { which, box: [R2(pb.width), R2(pb.height)], own: [R2(r.width), R2(r.height)] });
                tap = { left: Math.min(tap.left, pb.left), top: Math.min(tap.top, pb.top), right: Math.max(tap.right, pb.right), bottom: Math.max(tap.bottom, pb.bottom) };
            }
            // 손자 요소가 넓히는 경우(label 안 체크칸 등)는 border box 로 충분
            const tw = tap.right - tap.left, th = tap.bottom - tap.top;
            t.tap = { w: R2(tw), h: R2(th), ext: ext.length };
            if (touch && T.kind !== 'row' && (tw < O.tapMin - 0.5 || th < O.tapMin - 0.5)) viol(t, 'tap-small', R2(Math.min(tw, th)), `≥${O.tapMin}`, { w: R2(tw), h: R2(th) });
            T.tapRect = tap;
        }
        // --- 스위치 라벨 ---
        if (T.kind === 'switch') {
            const inp = el.querySelector('input[type="checkbox"], input[type="radio"]');
            let ctl = null;
            if (inp && visible(inp)) { const ir = inp.getBoundingClientRect(); if (ir.width >= 8 && ir.height >= 8) ctl = ir; }
            if (!ctl) { const sib = [...el.querySelectorAll('span, i, div')].find(x => !x.textContent.trim() && visible(x) && paintedOf(csOf(x)).any); if (sib) ctl = sib.getBoundingClientRect(); }
            const txt = inks.filter(k => !k.icon && k.rect);
            if (ctl && txt.length) {
                const firstTop = Math.min(...txt.map(k => k.rect.top)); const line = txt.filter(k => Math.abs(k.rect.top - firstTop) < 2);
                const lU = line.reduce((a, k) => ({ top: Math.min(a.top, k.top), bottom: Math.max(a.bottom, k.bottom) }), { top: Infinity, bottom: -Infinity });
                const d = (lU.top + lU.bottom) / 2 - (ctl.top + ctl.bottom) / 2;
                t.switch = { d: R2(d), ctl: [R2(ctl.width), R2(ctl.height)] };
                // 여러 줄 라벨에서 체크칸이 가운데(묶음 가운데)로 간 경우는 첫 줄 기준이 맞다
                if (Math.abs(d) > O.switchTol) viol(t, 'switch-v', d, `|≤${O.switchTol}|`, { ctl: [R2(ctl.width), R2(ctl.height)] });
            }
        }
        // --- 글자 가독성(요소 글자) ---
        const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
        t.font = { size: R2(fs), weight: fw };
        // --- 샤프 ---
        // 흐린 선 · 흐린 글자: Chromium 은 테두리 두께 · 상자 가장자리를 장치 픽셀에 맞춰 그리지만(계산값이 이미 정수 장치 px),
        // transform 의 소수 이동 · 확대는 그 맞춤을 깨 1px 선과 글자가 흐려진다 → 자신 · 조상의 transform 을 본다
        if (p.any) {
            let tx = 0, ty = 0, on = null, scaled = false;
            for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const tm = csOf(e).transform; if (!tm || tm === 'none') continue; const mm = tm.match(/matrix\(([^)]+)\)/); if (!mm) { scaled = true; on = on || e; continue; } const v = mm[1].split(',').map(parseFloat); tx += v[4]; ty += v[5]; if (Math.abs(Math.hypot(v[0], v[1]) - 1) > 0.001 || Math.abs(Math.hypot(v[2], v[3]) - 1) > 0.001) scaled = true; on = on || e; }
            if (on && (scaled || !M.onGrid(tx, dpr, 0.05) || !M.onGrid(ty, dpr, 0.05))) viol(t, 'subpixel', scaled ? 'scale' : `${R2(tx)},${R2(ty)}`, '정수 장치 px', { what: scaled ? 'transform 확대 · 축소' : 'transform 소수 이동', on: short(on), dpr });
        }
        if (cs.textShadow && cs.textShadow !== 'none') note(t, 'text-shadow', cs.textShadow.slice(0, 60));
        for (let e = el; e && e !== document.body; e = e.parentElement) { const tm = csOf(e).transform; if (tm && tm !== 'none') { const mm = tm.match(/matrix\(([^)]+)\)/); if (mm) { const v = mm[1].split(',').map(parseFloat); const sx = Math.hypot(v[0], v[1]); if (Math.abs(sx - 1) > 0.01) { note(t, 'transform-scale', R2(sx), { on: short(e) }); break; } } } }
    }

    // ---------- 누르는 칸 격자(elementFromPoint) ----------
    const tapTargets = targets.filter(T => T.tapRect);
    const ownBoxes = interactives.map(e => ({ e, r: e.getBoundingClientRect() }));
    for (const T of tapTargets) {
        const el = T.el; const t = T.t;
        if (O.scroll) { remember(el); const r0 = el.getBoundingClientRect(); if (r0.top < 0 || r0.bottom > innerHeight || r0.left < 0 || r0.right > innerWidth) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); }
        const r = el.getBoundingClientRect();
        // tapRect 는 처음 위치 기준 → 지금 위치로 옮김
        const dx = r.left - t.box[0], dy = r.top - t.box[1];
        const tap = { left: T.tapRect.left + dx, top: T.tapRect.top + dy, right: T.tapRect.right + dx, bottom: T.tapRect.bottom + dy };
        const near = []; for (const { e } of ownBoxes) { if (e === el || e.contains(el) || el.contains(e)) continue; const nr = e.getBoundingClientRect(); if (nr.right >= tap.left && nr.left <= tap.right && nr.bottom >= tap.top && nr.top <= tap.bottom) near.push({ e, nr }); }
        const N = O.grid; let steal = null, covered = null, samples = 0;
        for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
            const x = tap.left + (ix + 0.5) * (tap.right - tap.left) / N, y = tap.top + (iy + 0.5) * (tap.bottom - tap.top) / N;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
            const hit = document.elementFromPoint(x, y); if (!hit) continue; samples++;
            const inOwn = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
            const owner = ownerOf(hit, el);
            if (inOwn && owner && owner !== el && !owner.contains(el) && !el.contains(owner)) { covered = covered || { by: short(owner), at: [R2(x), R2(y)] }; }
            if (!inOwn && owner === el) {
                // 내 투명 영역이 이웃의 보이는 상자 위인가
                for (const { e, nr } of near) { if (x >= nr.left && x <= nr.right && y >= nr.top && y <= nr.bottom) { steal = steal || { from: short(e), at: [R2(x), R2(y)] }; break; } }
            }
        }
        t.tap = Object.assign(t.tap || {}, { samples, ...(steal ? { steal: steal.from } : {}), ...(covered ? { covered: covered.by } : {}) });
        if (steal) viol(t, 'tap-steal', steal.from, '0', steal);
        if (covered) viol(t, 'tap-covered', covered.by, '0', covered);
    }
    for (const [p, [x, y]] of scrolled) { if (p === window) window.scrollTo(x, y); else { p.scrollLeft = x; p.scrollTop = y; } }

    // ---------- 가독성: 뿌리 안 모든 글자 ----------
    if (O.textScan) {
        const pageBg = (() => { const c = toRGBA(csOf(document.body).backgroundColor); const h = toRGBA(csOf(document.documentElement).backgroundColor); const base = h && h.a > 0 ? M.blend(h, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 }; return c && c.a > 0 ? M.blend(c, base) : base; })();
        const bgsOf = el => {
            const layers = [];
            for (let e = el; e; e = e.parentElement) {
                const c = csOf(e); const bgc = toRGBA(c.backgroundColor); const bgi = c.backgroundImage;
                if (c.backdropFilter && c.backdropFilter !== 'none' && bgc && bgc.a < 0.999) { /* 흐림 유리: 아래 색 그대로 섞어 근사 */ }
                if (bgi && bgi !== 'none') { if (/url\(/.test(bgi)) return null; const stops = colorsIn(bgi); if (stops.length) { const under = bgc && bgc.a > 0 ? bgc : null; const bases = stops.map(s => s.a >= 0.999 ? s : M.blend(s, under && under.a >= 0.999 ? under : pageBg)); return bases.map(b => layers.reduceRight((acc, l) => M.blend(l, acc), b)); } }
                if (bgc && bgc.a > 0) { if (bgc.a >= 0.999) return [layers.reduceRight((acc, l) => M.blend(l, acc), bgc)]; layers.push(bgc); }
            }
            return [layers.reduceRight((acc, l) => M.blend(l, acc), pageBg)];
        };
        const targetOf = new Map(targets.map(T => [T.el, T]));
        const seenTxt = new Set();
        for (const root of roots) for (const el of [root, ...root.querySelectorAll('*')]) {
            if (!(el instanceof HTMLElement) || el.matches('script, style, noscript, template, option, svg *')) continue;
            if (O.exclude && el.closest(O.exclude)) continue;
            const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
            const isField = el.matches('input, textarea') && !/^(hidden|checkbox|radio|range|file|color)$/.test(el.type || '');
            const txt = own || (isField ? (el.value || '') : '');
            if (!txt) continue;
            if (!visible(el)) continue;
            const cs = csOf(el);
            if (parseFloat(cs.fontSize) < 4) continue;   // font-size 0 으로 숨긴 글자(아이콘 단추의 읽기용 이름)
            const op = opacityChain(el);
            out.counts.textChecked++;
            const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
            const tg = targetOf.get(el) || targets.find(T => T.el.contains(el));
            const body = !tg && (!!el.closest('.mes_text, article, .bl-faq-answer, [data-body-text]') || (el.matches('p, li, dd, blockquote') && txt.length >= 80));
            const min = body ? O.bodyMin : O.labelMin;
            const rec = tg ? tg.t : { i: -1, sel: selOf(el), kind: body ? 'text-body' : 'text', text: txt.slice(0, 40), v: [] };
            const key = rec.sel + '|' + txt.slice(0, 30);
            if (seenTxt.has(key)) continue; seenTxt.add(key);
            const disabled = !!el.closest(':disabled, [aria-disabled="true"], .disabled');
            if (size < min - 0.05) viol(rec, 'font-small', size, `≥${min}`, { body });
            if (weight < O.weightMin) viol(rec, 'font-thin', weight, `≥${O.weightMin}`);
            if (op < 0.999) { if (disabled) note(rec, 'opacity-disabled', op); else viol(rec, 'opacity', op, '1'); }
            const bgs = bgsOf(el); if (!bgs) { out.counts.unknownBg++; continue; }
            const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color && toRGBA(cs.webkitTextFillColor)?.a > 0 ? cs.webkitTextFillColor : cs.color;
            const fg0 = toRGBA(fill); if (!fg0 || fg0.a < 0.05) continue;   // 투명 글자(그림 · 가상 요소로 그리는 단추의 숨은 글자)는 안 보임
            const fgA = { ...fg0, a: fg0.a * op };
            let worst = Infinity, wb = null; for (const b of bgs) { const fg = fgA.a < 1 ? M.blend(fgA, b) : fgA; const rt = M.ratio(fg, b); if (rt < worst) { worst = rt; wb = b; } }
            const need = M.isLarge(size, weight) ? O.aaLarge : O.aa;
            if (worst + 0.005 < need) { if (disabled) note(rec, 'contrast-disabled', worst); else viol(rec, 'contrast', worst, `≥${need}`, { fg: fill, bg: `rgb(${Math.round(wb.r)} ${Math.round(wb.g)} ${Math.round(wb.b)})`, size }); }
            else if (body && worst + 0.005 < O.bodyTarget) note(rec, 'contrast-target', worst, { need: O.bodyTarget });
            if (tg) tg.t.contrast = R2(worst);
        }
    }

    // ---------- 색 감시: 계산된 색이 팔레트(--lp-*) 값 · 그 투명도 변형 · 두 색 섞음인지 ----------
    if (O.colors) {
        const C = typeof O.colors === 'object' ? O.colors : {};
        const proot = (C.root && document.querySelector(C.root)) || roots[0].closest('.lp-root') || roots[0].querySelector('.lp-root') || roots[0];
        // 팔레트 변수: 기본 목록 + 문서의 스타일시트에 선언된 --lp-* 전부(palette.css 에 새 변수가 생겨도 따라감, 예: --lp-lemon-ink)
        const names = C.vars || (() => {
            const set = new Set(['--lp-blue', '--lp-on-blue', '--lp-lemon', '--lp-lemon-ink', '--lp-on-lemon', '--lp-red', '--lp-on-red', '--lp-green', '--lp-on-green', '--lp-bg', '--lp-surface', '--lp-raised', '--lp-text', '--lp-muted', '--lp-line', '--lp-shadow', '--lp-icon']);
            const walk = rules => { for (const rule of rules || []) { try { if (rule.style) for (let i = 0; i < rule.style.length; i++) { const n = rule.style[i]; if (n.startsWith('--lp-')) set.add(n); } if (rule.cssRules) walk(rule.cssRules); } catch { } } };
            for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch { } }
            return [...set];
        })();
        // 변수 값을 실제 색으로: 뿌리 안에 잠깐 넣은 span 의 color 로 읽는다(var · color-mix 를 브라우저가 풀게)
        const probe = document.createElement('span'); probe.setAttribute('aria-hidden', 'true'); probe.style.cssText = 'position:absolute!important;visibility:hidden!important;pointer-events:none!important;';
        proot.appendChild(probe);
        const pal = [];
        for (const n of names) { probe.style.color = ''; probe.style.color = `var(${n})`; const raw = csOf(proot).getPropertyValue(n).trim(); if (!raw) continue; pal.push({ name: n, c: toRGBA(csOf(probe).color), raw }); }
        for (const extra of C.allow || []) { probe.style.color = ''; probe.style.color = extra; pal.push({ name: 'allow:' + extra, c: toRGBA(csOf(probe).color) }); }
        probe.remove();
        out.palette = pal.map(x => ({ name: x.name, rgba: x.c ? [Math.round(x.c.r), Math.round(x.c.g), Math.round(x.c.b), Math.round(x.c.a * 100) / 100] : null }));
        if (!pal.length) { out.colorError = 'palette variables not found (--lp-*) — palette.css 와 .lp-root 를 확인'; }
        else {
            const tol = C.tol ?? 0.02;
            const seenC = new Set(); let checkedC = 0;
            const docs = [{ doc: document, roots: C.root ? [proot] : roots }];
            if (C.frames !== false) for (const r0 of roots) for (const f of r0.querySelectorAll('iframe')) { try { const d = f.contentDocument; if (d && d.body) docs.push({ doc: d, roots: [d.body], frame: short(f) }); } catch { } }
            for (const D of docs) {
                const W = D.doc.defaultView || window; const gcs = (e, ps) => W.getComputedStyle(e, ps || null);
                for (const r0 of D.roots) for (const el of [r0, ...r0.querySelectorAll('*')]) {
                    if (el === probe || el.matches('script, style, noscript, template, head *') || (C.ignore && el.matches(C.ignore))) continue;
                    const cs = gcs(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                    const rr = el.getBoundingClientRect(); if (rr.width < 1 && rr.height < 1 && !el.matches('svg *')) continue;
                    const isSvg = el instanceof W.SVGElement;
                    const checks = [];
                    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
                    if (own || (el.matches('input, textarea, select') && !/^(hidden|checkbox|radio|range|color|file)$/.test(el.type || ''))) checks.push(['color', cs.color]);
                    checks.push(['background-color', cs.backgroundColor]);
                    if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/url\(/.test(cs.backgroundImage)) for (const m of cs.backgroundImage.match(/(rgba?|color|oklab|oklch|lab|lch|hsla?)\([^()]*(\([^()]*\)[^()]*)*\)/gi) || []) checks.push(['background-image', m]);
                    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + side + 'Width']) > 0 && !/none|hidden/.test(cs['border' + side + 'Style'])) checks.push(['border-' + side.toLowerCase() + '-color', cs['border' + side + 'Color']]);
                    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) checks.push(['outline-color', cs.outlineColor]);
                    if (cs.boxShadow && cs.boxShadow !== 'none') for (const m of cs.boxShadow.match(/(rgba?|color|oklab|oklch|lab|lch)\([^()]*\)/gi) || []) checks.push(['box-shadow', m]);
                    if (cs.textShadow && cs.textShadow !== 'none' && own) for (const m of cs.textShadow.match(/(rgba?|color|oklab|oklch|lab|lch)\([^()]*\)/gi) || []) checks.push(['text-shadow', m]);
                    if (isSvg && !el.matches('svg, g, defs, symbol, clipPath, mask')) { if (cs.fill && cs.fill !== 'none' && !/url\(/.test(cs.fill)) checks.push(['fill', cs.fill]); if (cs.stroke && cs.stroke !== 'none' && !/url\(/.test(cs.stroke)) checks.push(['stroke', cs.stroke]); }
                    for (const which of ['::before', '::after']) {
                        const pc = gcs(el, which); if (!pc.content || pc.content === 'none' || pc.content === 'normal' || pc.display === 'none') continue;
                        if (glyphOf(pc).trim()) checks.push([which + ' color', pc.color]);
                        checks.push([which + ' background-color', pc.backgroundColor]);
                        for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(pc['border' + side + 'Width']) > 0 && !/none|hidden/.test(pc['border' + side + 'Style'])) checks.push([which + ' border-color', pc['border' + side + 'Color']]);
                    }
                    for (const [prop, val] of checks) {
                        const c = toRGBA(val); if (!c || c.a < 0.01) continue;
                        checkedC++;
                        const m = M.paletteMatch(c, pal, tol);
                        if (m.ok) continue;
                        const sel = (D.frame ? D.frame + ' ⟶ ' : '') + selOf(el);
                        const key = sel + '|' + prop + '|' + val; if (seenC.has(key)) continue; seenC.add(key);
                        const tg = targets.find(T => T.el === el);
                        const rec = tg ? tg.t : { i: -1, sel, kind: 'color', text: (el.textContent || '').trim().slice(0, 30), v: [] };
                        viol(rec, 'color-off', val, 'palette', { prop, nearest: m.name, dist: Math.round(m.dist * 1000) / 1000, ...(D.frame ? { frame: D.frame } : {}) });
                    }
                }
            }
            out.counts.colorChecked = checkedC;
        }
    }

    // ---------- 정리 ----------
    const byType = {}, byKind = {};
    for (const v of out.violations) { byType[v.type] = (byType[v.type] || 0) + 1; byKind[v.kind] = (byKind[v.kind] || 0) + 1; }
    const notesBy = {}; for (const n of out.notes) notesBy[n.type] = (notesBy[n.type] || 0) + 1;
    out.summary = { targets: targets.length, violations: out.violations.length, byType, byKind, notes: notesBy };
    const withV = targets.filter(T => T.t.v.length).map(T => T.t), rest = targets.filter(T => !T.t.v.length).map(T => T.t);
    out.items = [...withV, ...rest.slice(0, Math.max(0, O.maxItems - withV.length))];
    window.__alignCheckEls = targets.map(T => T.el);   // zoomCrops 가 같은 요소를 다시 찾는다(DOM 은 바꾸지 않음)
    // A CSS family name alone does not prove that its downloadable face rendered.
    // Keep this with the native screenshot: fallback and loaded fonts are different runs.
    out.renderContext = {
        userAgent: navigator.userAgent,
        fontStatus: document.fonts?.status,
        fontFaces: document.fonts ? [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })) : [],
        visualScale: window.visualViewport?.scale || 1,
        inkDeltaMeaning: 'top gap minus bottom gap; center offset is half this value',
    };
    return out;
}

/** 페이지에서 평가할 식(문자열). page.eval(alignCheck(sel, opts)) */
export function alignCheck(rootSelector = 'body', opts = {}) {
    return `(${pageAlignCheck.toString()})(${JSON.stringify(rootSelector)}, ${JSON.stringify(opts)}, (${alignMath.toString()})())`;
}

/** 사람이 읽는 한 줄 요약 */
export function summarize(r) {
    if (!r || r.error) return `align-check: ${r?.error || 'no result'}`;
    const s = r.summary; const bt = Object.entries(s.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
    return `align-check ${r.viewport.w}×${r.viewport.h}${r.touch ? ' touch' : ''}: 요소 ${s.targets} · 잉크 잰 것 ${r.counts.measured} · 글자 ${r.counts.textChecked} · 위반 ${s.violations}${bt ? ' (' + bt + ')' : ''} · 기준 단추 ${r.refs.ctl}px`;
}

/**
 * 요소별 확대 잘라내기(기본 3배) — shots/zoom/<screen>-<번호>-<종류>-<글자>.png. 반환: [{ file, i, kind, text, v }]
 * which: 'violations'(위반 있는 것, 기본) | 'all' | 함수(item → bool). limit 기본 80. pad 기본 6(css px).
 * 같은 페이지 상태에서 alignCheck 바로 뒤에 불러야 한다(window.__alignCheckEls 를 씀).
 */
export async function zoomCrops(page, r, outDir, { screen = 'screen', scale = 3, pad = 6, which = 'violations', limit = 80 } = {}) {
    const fs = await import('node:fs'); const path = await import('node:path');
    fs.mkdirSync(outDir, { recursive: true });
    const pick = typeof which === 'function' ? which : which === 'all' ? () => true : it => it.v && it.v.length;
    const items = (r.items || []).filter(pick).slice(0, limit);
    const done = [];
    const slug = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16) || 'x';
    for (const it of items) {
        const rect = await page.eval(`(async () => { const e = (window.__alignCheckEls || [])[${it.i}]; if (!e || !e.isConnected) return null; const r0 = e.getBoundingClientRect(); if (r0.top < 0 || r0.bottom > innerHeight || r0.left < 0 || r0.right > innerWidth) e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const r = e.getBoundingClientRect(); const vv = window.visualViewport; return [r.left, r.top, r.width, r.height, innerWidth, innerHeight, vv ? vv.pageLeft : scrollX, vv ? vv.pageTop : scrollY]; })()`);
        if (!rect) continue;
        const [x, y, w, h, vw, vh, sx, sy] = rect;   // 사진 clip 은 문서 좌표 — 창 좌표에 문서 스크롤을 더한다
        const x0 = Math.max(0, Math.floor(x - pad)), y0 = Math.max(0, Math.floor(y - pad));
        const x1 = Math.min(vw, Math.ceil(x + w + pad)), y1 = Math.min(vh, Math.ceil(y + h + pad));
        if (x1 - x0 < 2 || y1 - y0 < 2) continue;
        const res = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: { x: x0 + sx, y: y0 + sy, width: x1 - x0, height: y1 - y0, scale } });
        const file = path.join(outDir, `${screen}-${String(it.i).padStart(3, '0')}-${it.kind}-${slug(it.text)}.png`);
        fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
        done.push({ file, i: it.i, kind: it.kind, text: it.text, v: it.v });
    }
    fs.writeFileSync(path.join(outDir, `${screen}-zoom.json`), JSON.stringify(done, null, 1));
    return done;
}

/**
 * 화면 사진으로 맞춰 보기(검사기 자체 확인용): 칠한 요소의 안쪽 상자를 실제 화면에서 잘라 바탕색과 다른 픽셀의 경계를 구해
 * 「진짜」 잉크 여백 차이(dv · dh)를 낸다. 캔버스 계산값과 견줘 검사기가 맞는지 본다. 반환 [{ i, sel, dv, dh, calc:{dv,dh}, err:{v,h} }]
 * 같은 페이지 상태에서 alignCheck 바로 뒤에. which 기본: 잉크를 잰 칠한 요소 전부(limit 120).
 */
export async function pixelTruth(page, r, { which = null, limit = 120, scale = 4 } = {}) {
    const items = (r.items || []).filter(which || (it => it.painted && it.ink)).slice(0, limit);
    const res = [];
    for (const it of items) {
        const pb = await page.eval(`(async () => { const e = (window.__alignCheckEls || [])[${it.i}]; if (!e || !e.isConnected) return null; const r0 = e.getBoundingClientRect(); if (r0.top < 0 || r0.bottom > innerHeight || r0.left < 0 || r0.right > innerWidth) { e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); } await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const r1 = e.getBoundingClientRect(); await new Promise(r => requestAnimationFrame(r)); const r = e.getBoundingClientRect(), c = getComputedStyle(e); const L = r.left + parseFloat(c.borderLeftWidth), T = r.top + parseFloat(c.borderTopWidth), R = r.right - parseFloat(c.borderRightWidth), B = r.bottom - parseFloat(c.borderBottomWidth); const rad = Math.max(0, Math.min(parseFloat(c.borderTopLeftRadius) || 0, (r.height) / 2, (r.width) / 2) - parseFloat(c.borderTopWidth));
            const cv = document.createElement('canvas').getContext('2d'); const rgb = s => { cv.fillStyle = '#000'; cv.fillStyle = s; cv.clearRect(0, 0, 1, 1); cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
            const fg = new Set(); const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent.trim()) fg.add(getComputedStyle(n.parentElement).color);
            for (const x of [e, ...e.querySelectorAll('*')]) { for (const ps of ['::before', '::after']) { const pc = getComputedStyle(x, ps); if (pc.content && /^"[^"]+"$/.test(pc.content) && pc.position !== 'absolute') fg.add(pc.color); } if (x.matches('svg, svg *')) { const xc = getComputedStyle(x); if (xc.fill && xc.fill !== 'none' && !/url/.test(xc.fill)) fg.add(xc.fill); } }
            // 가려진 곳이 있으면(고정 막대 · 다른 창) 사진 값을 쓰지 않는다: 네 귀퉁이 안쪽 + 가운데
            const pts = [[L + 3, T + 3], [R - 3, T + 3], [L + 3, B - 3], [R - 3, B - 3], [(L + R) / 2, (T + B) / 2]];
            const occluded = Math.abs(r1.top - r.top) > 0.1 || Math.abs(r1.left - r.left) > 0.1 || pts.some(([px, py]) => { if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) return true; const h = document.elementFromPoint(px, py); return !h || !(h === e || e.contains(h) || h.contains(e)); });   // 아직 움직이는 중(스크롤 · 애니메이션) · 화면 밖 · 가려짐
            const vv = window.visualViewport; return [L, T, R - L, B - T, rad, [...fg].map(rgb), occluded, vv ? vv.pageLeft : scrollX, vv ? vv.pageTop : scrollY]; })()`);
        if (!pb || pb[2] < 4 || pb[3] < 4 || pb[6]) continue;
        const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: pb[0] + pb[7], y: pb[1] + pb[8], width: pb[2], height: pb[3], scale } });   // 문서 좌표
        const g = await page.eval(`(async () => {
            const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode();
            const W = img.naturalWidth, H = img.naturalHeight, k = W / ${pb[2]};
            const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
            const d = x.getImageData(0, 0, W, H).data;
            const fr = Math.ceil(k * 1.5);   // 가장자리 1.5px(테두리 번짐)는 빼고
            const rad = ${pb[4] || 0} * k, inset = k * 1.5;
            const inside = (xx, y) => { const cx = xx < rad ? rad : xx > W - rad ? W - rad : xx, cy = y < rad ? rad : y > H - rad ? H - rad : y; if (cx === xx || cy === y) return true; return Math.hypot(xx - cx, y - cy) <= rad - inset; };   // 둥근 모서리 바깥(테두리 곡선)은 잉크가 아님
            const count = new Map(); for (let y = fr; y < H - fr; y += 2) for (const xx of [fr, W - fr - 1]) { const i = (y * W + xx) * 4; const key = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; count.set(key, (count.get(key) || 0) + 1); }
            for (let xx = fr; xx < W - fr; xx += 2) for (const y of [fr, H - fr - 1]) { const i = (y * W + xx) * 4; const key = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; count.set(key, (count.get(key) || 0) + 1); }
            const bg = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
            const fgs = ${JSON.stringify(pb[5] || [])}.map(f => { const v = [f[0] - bg[0], f[1] - bg[1], f[2] - bg[2]]; const L2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]; return { v, L2 }; }).filter(f => f.L2 > 900);
            const isInk = (r, g, b) => { const p = [r - bg[0], g - bg[1], b - bg[2]]; for (const f of fgs) { const t = (p[0] * f.v[0] + p[1] * f.v[1] + p[2] * f.v[2]) / f.L2; if (t < 0.35 || t > 1.4) continue; const q = [p[0] - t * f.v[0], p[1] - t * f.v[1], p[2] - t * f.v[2]]; if (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] <= 0.16 * f.L2) return true; } return false; };
            let maxd = 0; for (let i = 0; i < d.length; i += 4) { const dd = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]); if (dd > maxd) maxd = dd; }
            const th = Math.max(24, maxd * 0.35);
            const hit = fgs.length ? (i => isInk(d[i], d[i + 1], d[i + 2])) : (i => Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) >= th);
            let x0 = W, y0 = H, x1 = -1, y1 = -1;
            // A selection outline can share the label color. Keep plain-label scans
            // near the calculated ink so that an inset outline is not counted as text.
            const roi = ${JSON.stringify(it.ink && !/tile|switch/.test(it.kind) ? { top: Math.max(0, it.ink.top - 3), bottom: Math.max(0, it.ink.bottom - 3), left: Math.max(0, it.ink.left - 3), right: Math.max(0, it.ink.right - 3) } : null)};
            for (let y = fr; y < H - fr; y++) for (let xx = fr; xx < W - fr; xx++) { if (roi && (y < roi.top * k || y >= H - roi.bottom * k || xx < roi.left * k || xx >= W - roi.right * k)) continue; const i = (y * W + xx) * 4; if (hit(i) && inside(xx, y)) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
            if (x1 < 0) return null;
            const top = y0 / k, bottom = (H - y1 - 1) / k, left = x0 / k, right = (W - x1 - 1) / k;
            return { dv: Math.round((top - bottom) * 100) / 100, dh: Math.round((left - right) * 100) / 100, top, bottom, left, right };
        })()`);
        if (!g) continue;
        res.push({ i: it.i, sel: it.sel, text: it.text, dv: g.dv, dh: g.dh, real: { top: +g.top.toFixed(2), bottom: +g.bottom.toFixed(2), left: +g.left.toFixed(2), right: +g.right.toFixed(2) }, calc: { dv: it.ink.dv, dh: it.ink.dh, top: it.ink.top, bottom: it.ink.bottom, left: it.ink.left, right: it.ink.right }, err: { v: Math.round((g.dv - it.ink.dv) * 100) / 100, h: Math.round((g.dh - it.ink.dh) * 100) / 100 } });
    }
    return res;
}

/**
 * 테마 팔레트 바꾸기 시험(새로고침 없이): 블루레몬에이드 팔레트를 차례로 바꾸고, 확장 화면의 「파랑 자리」 등 probes 의 실제 계산 색이
 * 그 팔레트의 테마 변수(기본 --salty-accent)와 같은지 잰다. iframe 안까지(probe.frame = iframe 선택자).
 *   probes: [{ sel: '.my-primary', prop: 'background-color', token: 'accent', frame: '#my-iframe' }]  (token 은 --salty-<token>)
 *   반환 { rows:[{ palette, token, want, got, ok, sel, prop, frame }], ok: 모두 같음, restored: 처음 팔레트 }
 * 테마 모듈(src/settings.js getSettings · src/apply.js applyAll)을 import 해 바꾸고, 끝나면 처음 팔레트로 되돌린다. 저장(saveSettings)은 하지 않는다.
 */
export async function paletteSwitchTest(page, { probes = [], palettes = ['night', 'melon-night', 'grapefruit-night', 'salt'], themeBase = '/scripts/extensions/third-party/blue-lemonade', settle = 500, tol = 2 } = {}) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const first = await page.eval(`(async () => { const { getSettings } = await import(${JSON.stringify(themeBase + '/src/settings.js')}); return getSettings().palette; })()`);
    const rows = [];
    const read = `(probes) => { const rgba = s => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = s; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], Math.round(d[3] / 2.55) / 100]; };
        const root = getComputedStyle(document.documentElement);
        return probes.map(p => { let doc = document, win = window; if (p.frame) { const f = document.querySelector(p.frame); try { doc = f.contentDocument; win = f.contentWindow; } catch { doc = null; } }
            const e = doc && doc.querySelector(p.sel); const want = root.getPropertyValue('--salty-' + (p.token || 'accent')).trim();
            if (!e) return { ...p, want, missing: true };
            const got = win.getComputedStyle(e).getPropertyValue(p.prop || 'background-color');
            return { ...p, want, got, wantRGBA: rgba(want), gotRGBA: rgba(got) }; }); }`;
    try {
        for (const pal of palettes) {
            await page.eval(`(async () => { const { getSettings } = await import(${JSON.stringify(themeBase + '/src/settings.js')}); const { applyAll } = await import(${JSON.stringify(themeBase + '/src/apply.js')}); getSettings().palette = ${JSON.stringify(pal)}; applyAll(); })()`);
            await sleep(settle);
            const got = await page.eval(`(${read})(${JSON.stringify(probes)})`);
            for (const g of got) {
                const ok = !g.missing && g.wantRGBA && g.gotRGBA && g.wantRGBA.slice(0, 3).every((v, i) => Math.abs(v - g.gotRGBA[i]) <= tol);
                rows.push({ palette: pal, token: g.token || 'accent', sel: g.sel, prop: g.prop || 'background-color', frame: g.frame, want: g.want, got: g.got ?? null, ok: !!ok, ...(g.missing ? { missing: true } : {}) });
            }
        }
    } finally {
        await page.eval(`(async () => { const { getSettings } = await import(${JSON.stringify(themeBase + '/src/settings.js')}); const { applyAll } = await import(${JSON.stringify(themeBase + '/src/apply.js')}); getSettings().palette = ${JSON.stringify(first)}; applyAll(); })()`);
    }
    return { rows, ok: rows.length > 0 && rows.every(r => r.ok), restored: first };
}

/**
 * 화면 사진으로 최종 판정(권장): 칠한 요소마다 pixelTruth 로 실제 잉크 여백을 재서, ink-v · ink-h(· pad-asym) 위반을 사진 값으로 다시 매긴다.
 * 캔버스 계산은 공백이 든 글자에서 화면보다 0.4–0.6px 어긋날 수 있어(리그 확인: 공백 뒤 글자 위치) 0.5px 판정은 사진이 기준이다.
 * r 을 그 자리에서 고치고 돌려준다: 채택한 화면값을 it.ink 와 it.ink.screen 에 함께 기록하고 원계산은 it.ink.calc 에 보존한다.
 * counts.screenChecked 는 사진 채취 수, screenAccepted 는 채택 수, screenUnresolved 는 큰 불일치 수다.
 * 다른 요소에 가려진 요소(가운데 점이 그 요소가 아님)는 사진 값을 쓰지 않는다.
 */
export async function refineWithPixels(page, r, { limit = 400, scale = 4, inkTol = 0.5 } = {}) {
    const items = (r.items || []).filter(it => it.painted && it.ink && /pixel|pseudo|canvas/.test(it.ink.method) && it.kind !== 'tile');
    const covered = await page.eval(`(${JSON.stringify(items.map(it => it.i))}).filter(i => { const e = (window.__alignCheckEls || [])[i]; if (!e) return true; const b = e.getBoundingClientRect(); if (b.top < 0 || b.bottom > innerHeight) e.scrollIntoView({ block: 'center', behavior: 'instant' }); const q = e.getBoundingClientRect(); const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !(h && (h === e || e.contains(h) || h.contains(e))); })`);
    const skip = new Set(covered);
    const truth = await pixelTruth(page, r, { which: it => items.includes(it) && !skip.has(it.i), limit, scale });
    const byI = new Map(truth.map(t => [t.i, t]));
    const drop = new Set();
    for (const it of items) {
        const t = byI.get(it.i); if (!t) continue;
        // 큰 불일치는 어느 쪽이 맞는지 수치만으로 알 수 없다. 덜 치우친 값을 고르면 실패가 사라질 수 있다.
        // 원계산 위반과 사진을 보존하고 미확정으로 남겨 표적 재측정 전에는 통과로 세지 않는다.
        const mismatch = Math.max(Math.abs(t.dv - it.ink.dv), it.ink.hChecked ? Math.abs(t.dh - it.ink.dh) : 0);
        if (mismatch > 4) {
            it.ink.screenOff = { dv: t.dv, dh: t.dh, ...t.real };
            byI.delete(it.i);
            const unresolved = { i: it.i, sel: it.sel, kind: it.kind, text: it.text, type: 'ink-unresolved', value: Math.round(mismatch * 100) / 100,
                detail: { screen: { dv: t.dv, dh: t.dh }, calc: { dv: it.ink.dv, dh: it.ink.dh } } };
            r.violations.push(unresolved);
            it.v.push('ink-unresolved');
            (r.notes ||= []).push({ ...unresolved, type: 'screen-unreliable' });
            continue;
        }
        it.ink.calc = { dv: it.ink.dv, dh: it.ink.dh };
        it.ink.screen = { dv: t.dv, dh: t.dh, ...t.real };
        Object.assign(it.ink, it.ink.screen);
        it.ink.method += '+screen';
        drop.add(it.i);
        it.v = it.v.filter(x => x !== 'ink-v' && x !== 'ink-h' && x !== 'pad-asym');
    }
    const kept = r.violations.filter(v => !(drop.has(v.i) && (v.type === 'ink-v' || v.type === 'ink-h' || v.type === 'pad-asym')));
    const added = [];
    for (const it of items) {
        const t = byI.get(it.i); if (!t) continue;
        const old = r.violations.find(v => v.i === it.i && v.type === 'ink-h');
        if (it.kind !== 'switch' && it.kind !== 'tile' && Math.abs(t.dv) > inkTol) { added.push({ i: it.i, sel: it.sel, kind: it.kind, text: it.text, type: 'ink-v', value: t.dv, need: `|≤${inkTol}|`, detail: { top: t.real.top, bottom: t.real.bottom, calc: it.ink.calc.dv, structV: it.ink.structV, cause: Math.abs(it.ink.structV ?? 99) <= inkTol ? 'glyph' : 'box', method: 'screen' } }); it.v.push('ink-v'); }
        if (it.ink.hChecked && Math.abs(t.dh) > inkTol) { added.push({ i: it.i, sel: it.sel, kind: it.kind, text: it.text, type: 'ink-h', value: t.dh, need: `|≤${inkTol}|`, detail: { left: t.real.left, right: t.real.right, calc: it.ink.calc.dh, structH: it.ink.structH, cause: old?.detail?.cause || (Math.abs(it.ink.structH ?? 99) <= inkTol ? 'glyph' : 'box'), method: 'screen' } }); it.v.push('ink-h'); const pa = r.violations.find(v => v.i === it.i && v.type === 'pad-asym'); if (pa) { added.push(pa); it.v.push('pad-asym'); } }
    }
    r.violations = [...kept, ...added];
    const byType = {}, byKind = {}; for (const v of r.violations) { byType[v.type] = (byType[v.type] || 0) + 1; byKind[v.kind] = (byKind[v.kind] || 0) + 1; }
    r.summary = { ...r.summary, violations: r.violations.length, byType, byKind };
    r.counts.screenChecked = truth.length; r.counts.screenCovered = covered.length;
    r.counts.screenAccepted = byI.size; r.counts.screenUnresolved = truth.length - byI.size;
    const errs = truth.map(t => Math.max(Math.abs(t.err.v), Math.abs(t.err.h)));
    r.counts.calcVsScreenMax = errs.length ? Math.max(...errs) : 0;
    return r;
}

/** 잘라낸 사진들을 한 장에(글자 이름표 포함) — python + PIL 필요. 실패하면 false. 눈으로 볼 때 Read 한 번에 여러 개를 보려고. */
export async function contactSheet(dir, screen, outFile, { cols = 4, maxW = 360 } = {}) {
    const { spawnSync } = await import('node:child_process'); const fs = await import('node:fs'); const path = await import('node:path');
    const idx = path.join(dir, `${screen}-zoom.json`); if (!fs.existsSync(idx)) return false;
    const py = `
import json,sys
from PIL import Image, ImageDraw, ImageFont
items=json.load(open(sys.argv[1],encoding='utf8')); out=sys.argv[2]; cols=int(sys.argv[3]); maxw=int(sys.argv[4])
ims=[]
for it in items:
    try: im=Image.open(it['file']).convert('RGB')
    except Exception: continue
    if im.width>maxw: im=im.resize((maxw,int(im.height*maxw/im.width)))
    ims.append((it,im))
if not ims: sys.exit(1)
try: font=ImageFont.truetype('malgun.ttf',14)
except Exception: font=ImageFont.load_default()
cw=maxw+12; rows=[ims[i:i+cols] for i in range(0,len(ims),cols)]
hs=[max(im.height for _,im in r)+26 for r in rows]
sheet=Image.new('RGB',(cw*cols,sum(hs)),(128,128,128)); d=ImageDraw.Draw(sheet); y=0
for r,h in zip(rows,hs):
    for c,(it,im) in enumerate(r):
        x=c*cw+6; d.text((x,y+4),(str(it['i'])+' '+it['kind']+' '+','.join(it.get('v') or [])+' '+(it.get('text') or ''))[:44],fill=(255,255,255),font=font); sheet.paste(im,(x,y+22))
    y+=h
sheet.save(out)
`;
    const r = spawnSync('python', ['-X', 'utf8', '-c', py, idx, outFile, String(cols), String(maxW)], { encoding: 'utf8' });
    return r.status === 0;
}
