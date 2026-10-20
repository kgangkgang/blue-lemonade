// 6.1.6 투명 그림(캐릭터 컷) 외곽선 · 그림자 — 배경이 투명한 캐릭터 에셋 · 생성 그림이 채팅 위에 둥 떠 보이지 않게.
// 사용자 요청: 「글자처럼 조절 가능하게 파라미터」, 「딱 저 외곽선 따라서 캐릭터 외곽선」, 「그림자나 외곽선이 그림 칸 밖에 나가면 표시할지 잘린 채로 둘지」,
//             「외곽선 블러 기능이랑 외곽선 색깔을 캐릭터 그림 가장 바깥 테두리 색이랑 맞출지도 고를 수 있게」.
// 7.3.0 「지금 기능은 묘하게아쉽더라」 · 「좀 프리셋이 여러개있으면좋겠음 지금은 그림자나 외곽선 둘 다 밝을때쓰라고있는거같아서」 (사용자 10-20):
//   · 프리셋: 자동(채팅 바탕 밝기로 어두운 화면용 · 밝은 화면용을 고름) · 밝은 테두리 · 은은한 빛 · 네온 테두리 · 깔끔한 테두리 · 종이 그림자 ·
//     스티커 · 그림자만 · 끄기, 「자세히」 슬라이더를 만지면 「직접」. 어두운 화면에서 검은 옷이 바탕에 묻히지 않게 하는 것이 먼저.
//   · 외곽선 = 둥글게 넓힌 알파(흐림 → 문턱, 가장자리 1px 경사) — 예전 feMorphology(네모 넓히기)는 비스듬한 곳이 계단 · 모서리가 각졌다.
//     띠는 실루엣 바깥만(알파 out) — 반투명한 헤일로 · 유리 안쪽이 하얗게 차지 않는다.
//   · 빛 · 그림자도 같은 SVG 필터 하나에 — 칸 밖으로 그릴 때 그림 칸 가장자리에 닿은 몸(잘린 면)에는 필터 영역을 넓히지 않아,
//     잘린 몸 아래 · 옆에 띠 · 빛이 생기지 않는다(그림마다 닿은 면 표시, assets.js 격자로 셈).
//   · 두께 · 흐림은 CSS px — 채팅에서 작게 보이든 크게 보기에서 크게 보이든 같은 굵기.
// 어느 그림에 거나: assets.js 가 가장자리 격자로 투명하다고 본 그림(.salty-alpha · 크게 보기 · 모아 보기는 .salty-alpha-view).
// 위 절반(순수 함수)은 node 로 시험한다 (tools/tests/cutout-edge.mjs). 아래 절반만 문서를 만진다.

/** 7.3.0 프리셋 — 차례는 설정 창 카드 차례. tone: 어울리는 화면 ('dark' · 'light' · '' = 공통) */
export const CUT_EDGE_PRESETS = Object.freeze([
    Object.freeze({ id: 'auto', label: '자동', tone: '', note: '채팅 바탕이 어두우면 밝은 테두리, 밝으면 깔끔한 테두리' }),
    Object.freeze({ id: 'rim-light', label: '밝은 테두리', tone: 'dark', note: '어두운 화면 · 가는 밝은 테두리' }),
    Object.freeze({ id: 'glow', label: '은은한 빛', tone: 'dark', note: '어두운 화면 · 검은 옷이 바탕에서 떠 보이게' }),
    Object.freeze({ id: 'neon', label: '네온 테두리', tone: 'dark', note: '어두운 화면 · 테마 포인트 색 테두리' }),
    Object.freeze({ id: 'rim-dark', label: '깔끔한 테두리', tone: 'light', note: '밝은 화면 · 옅은 어두운 테두리' }),
    Object.freeze({ id: 'paper', label: '종이 그림자', tone: 'light', note: '밝은 화면 · 부드러운 아래 그림자' }),
    Object.freeze({ id: 'sticker', label: '스티커', tone: '', note: '두꺼운 흰 테두리 + 작은 그림자' }),
    Object.freeze({ id: 'shadow', label: '그림자만', tone: '', note: '테두리 없이 그림자' }),
    Object.freeze({ id: 'off', label: '끄기', tone: '', note: '외곽선 · 그림자 없음' }),
]);
export const CUT_EDGE_PRESET_IDS = Object.freeze([...CUT_EDGE_PRESETS.map(p => p.id), 'custom']);
/** 「자동」이 고르는 것 */
export const AUTO_PRESET = Object.freeze({ dark: 'rim-light', light: 'rim-dark' });

const O = (on, colorMode, color, width, alpha, blur = 0) => Object.freeze({ on, colorMode, color, width, alpha, blur });
const S = (on, colorMode, color, alpha, angle, distance, blur) => Object.freeze({ on, colorMode, color, alpha, angle, distance, blur });
/** 프리셋 값 (outline · shadow). shadow.colorMode 'outline' = 외곽선과 같은 색 (네온 빛) */
export const PRESET_VALUES = Object.freeze({
    'rim-light': { outline: O(true, 'custom', '#f2f5fa', 1.5, 80), shadow: S(true, 'custom', '#ffffff', 22, 90, 0, 8) },
    glow: { outline: O(true, 'custom', '#ffffff', 0.5, 40), shadow: S(true, 'custom', '#e6edff', 62, 90, 0, 16) },
    neon: { outline: O(true, 'accent', '#7cc7ff', 1.5, 95), shadow: S(true, 'outline', '#7cc7ff', 70, 90, 0, 10) },
    'rim-dark': { outline: O(true, 'custom', '#1e2733', 1, 42), shadow: S(true, 'custom', '#0f172a', 16, 90, 2, 6) },
    paper: { outline: O(false, 'custom', '#ffffff', 1, 0), shadow: S(true, 'custom', '#0f172a', 32, 90, 6, 14) },
    sticker: { outline: O(true, 'custom', '#ffffff', 4, 100), shadow: S(true, 'custom', '#000000', 30, 90, 3, 6) },
    shadow: { outline: O(false, 'custom', '#ffffff', 1, 0), shadow: S(true, 'custom', '#000000', 45, 90, 6, 12) },
    off: { outline: O(false, 'custom', '#ffffff', 2, 90), shadow: S(false, 'custom', '#000000', 55, 90, 6, 12) },
});

export const CUT_EDGE_DEFAULTS = Object.freeze({
    preset: 'auto',
    overflow: false, // false = 그림 칸에 맞춰 자름
    // 「직접」의 값 (프리셋이 정해져 있으면 쓰지 않는다 — 처음 「직접」이 될 때 그때 프리셋 값을 옮겨 적는다)
    outline: Object.freeze({ on: true, colorMode: 'custom', color: '#ffffff', width: 2, alpha: 90, blur: 0 }),
    shadow: Object.freeze({ on: true, colorMode: 'custom', color: '#000000', alpha: 55, angle: 90, distance: 6, blur: 12 }),
});
// 7.2.9 까지의 처음 값 — 이 값 그대로인 설정(손대지 않은 사람)은 「자동」으로 옮긴다
const LEGACY_DEFAULTS = Object.freeze({
    outline: { on: true, colorMode: 'custom', color: '#ffffff', width: 2, alpha: 90, blur: 0 },
    shadow: { on: true, color: '#000000', alpha: 55, angle: 90, distance: 6, blur: 12 },
});
// [최소, 최대, 슬라이더 걸음] — 설정 창 슬라이더도 이 범위를 쓴다
export const CUT_EDGE_RANGES = Object.freeze({
    'outline.width': [0.5, 8, 0.5],
    'outline.alpha': [0, 100, 1],
    'outline.blur': [0, 10, 0.5],
    'shadow.alpha': [0, 100, 1],
    'shadow.angle': [0, 360, 1],
    'shadow.distance': [0, 24, 0.5],
    'shadow.blur': [0, 40, 0.5],
});
export const CUT_EDGE_COLOR_MODES = Object.freeze(['custom', 'picture', 'accent']); // 직접 | 그림 가장자리 색 | 테마 포인트 색
export const SHADOW_COLOR_MODES = Object.freeze(['custom', 'outline']); // 직접 | 외곽선과 같은 색
export const RING_ID = 'salty-cutedge-ring';
export const DEFS_ID = 'salty-cutedge-defs';

const HEX = /^#[0-9a-f]{6}$/i;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const flag = (v, fallback) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : fallback);
const clamp = (v, [min, max], fallback) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const MODES = { outline: CUT_EDGE_COLOR_MODES, shadow: SHADOW_COLOR_MODES };

function normalizePart(part, given) {
    const base = CUT_EDGE_DEFAULTS[part];
    const src = isObj(given) ? given : {};
    const next = {};
    for (const key of Object.keys(base)) {
        if (key === 'on') next.on = flag(src.on, base.on);
        else if (key === 'color') next.color = HEX.test(String(src.color ?? '')) ? String(src.color).toLowerCase() : base.color;
        else if (key === 'colorMode') next.colorMode = MODES[part].includes(src.colorMode) ? src.colorMode : base.colorMode;
        else next[key] = clamp(src[key], CUT_EDGE_RANGES[`${part}.${key}`], base[key]);
    }
    return next;
}
/** 7.2.9 까지 저장된 값(프리셋 없음) → 고른 적 없는 처음 값이면 자동, 둘 다 껐으면 끄기, 그 밖엔 직접(그 값 그대로) */
function legacyPreset(outline, shadow) {
    if (!outline.on && !shadow.on) return 'off';
    const same = (a, b) => Object.keys(b).every(k => a[k] === b[k]);
    return same(outline, LEGACY_DEFAULTS.outline) && same(shadow, LEGACY_DEFAULTS.shadow) ? 'auto' : 'custom';
}

/** 저장된 값(없거나 일부만 · 가져온 파일의 문자열이어도) → 온전한 새 값 */
export function normalizeCutEdge(value) {
    const src = isObj(value) ? value : {};
    const outline = normalizePart('outline', src.outline), shadow = normalizePart('shadow', src.shadow);
    const preset = CUT_EDGE_PRESET_IDS.includes(src.preset) ? src.preset : (isObj(src.outline) || isObj(src.shadow) ? legacyPreset(outline, shadow) : CUT_EDGE_DEFAULTS.preset);
    return { preset, overflow: flag(src.overflow, CUT_EDGE_DEFAULTS.overflow), outline, shadow };
}

/** 설정 정리(settings.js): holder.cutEdge 를 그 자리에서 고친다 — 설정 창이 잡고 있는 객체를 바꾸지 않게 */
export function tidyCutEdge(holder) {
    if (!isObj(holder)) return;
    const clean = normalizeCutEdge(holder.cutEdge);
    if (!isObj(holder.cutEdge)) holder.cutEdge = {};
    const edge = holder.cutEdge;
    for (const key of Object.keys(edge)) if (!(key in clean)) delete edge[key];
    edge.preset = clean.preset;
    edge.overflow = clean.overflow;
    for (const part of ['outline', 'shadow']) {
        if (!isObj(edge[part])) edge[part] = {};
        for (const key of Object.keys(edge[part])) if (!(key in clean[part])) delete edge[part][key];
        Object.assign(edge[part], clean[part]);
    }
}

/** 처음 값 (되돌리기 단추) — 깊은 사본 */
export function cutEdgeDefaults() {
    return { preset: CUT_EDGE_DEFAULTS.preset, overflow: CUT_EDGE_DEFAULTS.overflow, outline: { ...CUT_EDGE_DEFAULTS.outline }, shadow: { ...CUT_EDGE_DEFAULTS.shadow } };
}

/** '#rrggbb' → 0~1 밝기 (sRGB 상대 휘도) */
export function hexLuminance(hex) {
    if (!HEX.test(String(hex || ''))) return null;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** 채팅 바탕이 어두운가 — 바탕색 밝기 0.18 아래(대비 기준 중간쯤) */
export const darkBackground = bg => { const l = hexLuminance(bg); return l === null ? false : l < 0.18; };

/**
 * 프리셋 → 그릴 값. theme = { dark, accent } (apply.js 가 채팅 바탕 밝기 · 테마 포인트 색으로).
 * 「직접」이면 저장된 outline · shadow 그대로. 돌려주는 값의 preset 은 실제로 쓴 프리셋 (자동이면 고른 것)
 */
export function resolveCutEdge(edge, theme = {}) {
    const e = normalizeCutEdge(edge);
    const chosen = e.preset === 'auto' ? AUTO_PRESET[theme.dark ? 'dark' : 'light'] : e.preset;
    const values = chosen === 'custom' ? { outline: e.outline, shadow: e.shadow } : PRESET_VALUES[chosen];
    return { resolved: true, preset: chosen, overflow: e.overflow, outline: { ...values.outline }, shadow: { ...values.shadow } };
}

/** 「자세히」 슬라이더를 처음 만질 때: 지금 보이는 프리셋 값을 「직접」 값으로 옮겨 적는다 (그 위에 만진 값이 얹힌다) */
export function toCustom(holder, theme = {}) {
    if (!isObj(holder?.cutEdge)) return false;
    const edge = holder.cutEdge;
    if (edge.preset === 'custom') return false;
    const r = resolveCutEdge(edge, theme);
    edge.outline = { ...r.outline };
    edge.shadow = { ...r.shadow };
    edge.preset = 'custom';
    return true;
}

/** '#rrggbb' + 0~100 → rgba() */
export function rgba(hex, alphaPercent) {
    const h = HEX.test(String(hex || '')) ? hex.slice(1) : '000000';
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${Math.round(Math.min(100, Math.max(0, Number(alphaPercent) || 0))) / 100})`;
}

/** 그림자: 각도(0 = 오른쪽, 90 = 아래) · 거리 → [x, y] (글자 그림자와 같은 셈) */
export function shadowOffset(angle, distance) {
    const rad = (Number(angle) || 0) * Math.PI / 180;
    const d = Number(distance) || 0;
    const round = v => (Math.abs(v) < 0.005 ? 0 : Math.round(v * 100) / 100);
    return [round(Math.cos(rad) * d), round(Math.sin(rad) * d)];
}

export const outlineVisible = e => e.outline.on && e.outline.alpha > 0;
export const shadowVisible = e => e.shadow.on && e.shadow.alpha > 0;

/**
 * 화면에 넣을 CSS 변수 (apply.js 가 :root 에). 7.3.0 부터 외곽선 · 빛 · 그림자가 SVG 필터 하나 —
 * --salty-cutedge-ring = 그 필터 (아무것도 안 보이면 opacity(1)), --salty-cutedge-drop 은 늘 opacity(1) (옛 이름 — 다른 확장이 읽을 수 있어 남김).
 * 다 꺼지면 apply.js 가 body 의 salty-cutedge 클래스를 떼어 filter 자체를 안 건다 (레이어 비용 없음)
 */
export function cutEdgeVars(edge, theme = {}) {
    const e = resolveCutEdge(edge, theme);
    return {
        '--salty-cutedge-ring': outlineVisible(e) || shadowVisible(e) ? `url("#${RING_ID}")` : 'opacity(1)',
        '--salty-cutedge-drop': 'opacity(1)',
    };
}

/**
 * 이미지 › 테두리(선 · 안쪽 선 · 빛 · 이중선 · 테두리 그림자)가 그림 상자에 걸려 있는가 (css/07-images.css 의 테두리 규칙은 네모 모양에서만).
 * 걸려 있으면 투명 그림 외곽선 · 그림자는 쉰다 — 칸에 맞춰 자르기와 필터 영역이 상자 밖의 빛 · 이중선 · 그림자를 잘라 먹고,
 * 외곽선이 사각 테두리선까지 따라 그리기 때문 (6.1.5 에서 테두리를 쓰던 사람의 모습이 그대로 남게)
 */
export function imageFrameOn(image) {
    return !!image && image.shape === 'rect' && ((image.edge && image.edge !== 'none') || image.edgeShadow === true);
}

/** body 클래스: 켬 · 칸 밖 · 그림 가장자리 색. frame = 이미지 테두리가 걸려 있으면 아무것도 안 붙인다 */
export function cutEdgeClasses(edge, { frame = false, theme = {} } = {}) {
    if (frame) return [];
    const e = resolveCutEdge(edge, theme);
    const on = outlineVisible(e) || shadowVisible(e);
    if (!on) return [];
    const out = ['salty-cutedge'];
    if (e.overflow) out.push('salty-cutedge-out');
    if (outlineVisible(e) && e.outline.colorMode === 'picture') out.push('salty-cutedge-pick');
    return out;
}

const num = v => String(Number(Number(v).toFixed(3)));
// 표준 정규 누적분포 (오차 함수 근사, 최대 오차 1.5e-7)
function erf(x) {
    const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}
/**
 * 둥근 넓히기: 알파를 σ 로 흐린 뒤 문턱 t 에서 1px 경사로 다시 세운다. 곧은 가장자리에서 띠의 가운데가 width 만큼 밖에 온다
 * (σ = width / 1.5 → t = Φ(−1.5) ≈ 0.067, 그 자리의 기울기 φ(1.5)/σ 로 1px 경사). 모서리 · 비스듬한 곳은 둥글고 매끈하다
 */
export function roundGrow(width) {
    const w = Math.max(0.5, Number(width) || 0.5);
    const sigma = w / 1.5, z = 1.5;
    const t = 0.5 * (1 + erf(-z / Math.SQRT2));
    // 가는 띠(σ 가 작음)는 1px 경사가 문턱 아래까지 내려가 투명한 곳(α 0)이 칠해진다 → 경사를 그만큼 가파르게 (α 0 은 늘 0)
    const slope = Math.max(1 / (Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) / sigma), 0.5 / t);
    return { sigma, slope, intercept: 0.5 - slope * t };
}

/** 닿은 면 표시(0~15: 위 1 · 오른쪽 2 · 아래 4 · 왼쪽 8) → 필터 영역. 칸 밖으로 그릴 때 닿은 면은 넓히지 않는다 (잘린 몸에 띠가 안 생기게) */
export function filterRegion(mask, overflow) {
    if (!overflow) return 'x="0%" y="0%" width="100%" height="100%"';
    const m = Number(mask) || 0, pad = 20;
    const top = m & 1 ? 0 : pad, right = m & 2 ? 0 : pad, bottom = m & 4 ? 0 : pad, left = m & 8 ? 0 : pad;
    return `x="-${left}%" y="-${top}%" width="${100 + left + right}%" height="${100 + top + bottom}%"`;
}

/**
 * 필터 하나: [그림자 · 빛] → [외곽선 띠] → 원래 그림. 띠 · 빛은 실루엣 바깥만 (알파 out).
 * color = 외곽선 색 ('#rrggbb' — 그림 가장자리 색 · 테마 포인트 색은 부르는 쪽이 정함), r = resolveCutEdge 결과, mask = 닿은 면
 */
export function ringFilterMarkup(id, color, r, mask = 0) {
    const e = r?.resolved ? r : resolveCutEdge(r);
    const ink = HEX.test(color) ? color.toLowerCase() : '#ffffff';
    const parts = [], merge = [];
    if (shadowVisible(e)) {
        const sh = e.shadow;
        const [dx, dy] = shadowOffset(sh.angle, sh.distance);
        const shColor = sh.colorMode === 'outline' ? ink : sh.color;
        parts.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${num(sh.blur / 2)}" result="sb"/>`
            + (dx || dy ? `<feOffset in="sb" dx="${num(dx)}" dy="${num(dy)}" result="so"/>` : '')
            + `<feFlood flood-color="${shColor}" flood-opacity="${num(sh.alpha / 100)}"/>`
            + `<feComposite in2="${dx || dy ? 'so' : 'sb'}" operator="in" result="sc"/>`
            + `<feComposite in="sc" in2="SourceAlpha" operator="out" result="shade"/>`);
        merge.push('shade');
    }
    if (outlineVisible(e)) {
        const o = e.outline, g = roundGrow(o.width);
        parts.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${num(g.sigma)}" result="gb"/>`
            + `<feComponentTransfer in="gb" result="grown"><feFuncA type="linear" slope="${num(g.slope)}" intercept="${num(g.intercept)}"/></feComponentTransfer>`
            + `<feComposite in="grown" in2="SourceAlpha" operator="out" result="band"/>`
            + `<feFlood flood-color="${ink}" flood-opacity="${num(o.alpha / 100)}"/>`
            + `<feComposite in2="band" operator="in" result="ring"/>`
            + (o.blur > 0 ? `<feGaussianBlur in="ring" stdDeviation="${num(o.blur / 2)}" result="soft"/>` : ''));
        merge.push(o.blur > 0 ? 'soft' : 'ring');
    }
    merge.push('SourceGraphic');
    return `<filter id="${id}" ${filterRegion(mask, e.overflow)} color-interpolation-filters="sRGB">${parts.join('')}`
        + `<feMerge>${merge.map(m => `<feMergeNode in="${m}"/>`).join('')}</feMerge></filter>`;
}

// ───────── 그림 가장자리 색 · 닿은 면 ─────────
// assets.js 가 이미 뽑아 둔 48×48 RGBA 격자를 쓴다 (getImageData 를 다시 부르지 않음).
// 불투명한 칸(α ≥ 200) 중 위아래옆 이웃에 투명한 칸(α < 128)이 있는 칸 = 실루엣 바로 안쪽. 그 색을 알파 무게로 평균.
// 격자 바깥은 이웃으로 치지 않는다 — 그림 칸에 잘린 몸(아래 가장자리)은 실루엣이 아니다.
// 그런 칸이 너무 적으면(거의 빈 그림 · 잡티) null → 직접 고른 색으로 그린다.
export function edgeColorFromGrid(grid, size = 48, { minCells = 6 } = {}) {
    if (!grid || grid.length < size * size * 4) return null;
    const alphaAt = (x, y) => grid[(y * size + x) * 4 + 3];
    let r = 0, g = 0, b = 0, w = 0, cells = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const a = alphaAt(x, y);
            if (a < 200) continue;
            const edge = (x > 0 && alphaAt(x - 1, y) < 128) || (x < size - 1 && alphaAt(x + 1, y) < 128)
                || (y > 0 && alphaAt(x, y - 1) < 128) || (y < size - 1 && alphaAt(x, y + 1) < 128);
            if (!edge) continue;
            const i = (y * size + x) * 4;
            const k = a / 255;
            r += grid[i] * k; g += grid[i + 1] * k; b += grid[i + 2] * k; w += k; cells++;
        }
    }
    if (cells < minCells || !w) return null;
    return { r: Math.round(r / w), g: Math.round(g / w), b: Math.round(b / w), cells };
}

/**
 * 7.3.0 그림 칸 가장자리에 닿은 몸(잘린 면): 한 면의 칸 가운데 불투명(α ≥ 200)한 칸이 하나라도 있으면(share 넘게) 그 면은 잘린 면 — 머리카락 한 가닥이라도 닿으면 그 면 밖으로는 안 그린다.
 * → 위 1 · 오른쪽 2 · 아래 4 · 왼쪽 8 의 합. 칸 밖으로 그릴 때 그 면에는 빛 · 띠 · 그림자를 내지 않는다
 */
export function touchedSides(grid, size = 48, { share = 0 } = {}) {
    if (!grid || grid.length < size * size * 4) return 0;
    const solid = (x, y) => grid[(y * size + x) * 4 + 3] >= 200;
    const count = fn => { let n = 0; for (let i = 0; i < size; i++) if (fn(i)) n++; return n / size; };
    let mask = 0;
    if (count(i => solid(i, 0)) > share) mask |= 1;
    if (count(i => solid(size - 1, i)) > share) mask |= 2;
    if (count(i => solid(i, size - 1)) > share) mask |= 4;
    if (count(i => solid(0, i)) > share) mask |= 8;
    return mask;
}

/** 색을 채널마다 16단계로 줄인 '#rrggbb' — 필터를 색마다 하나씩 만들므로 거의 같은 색은 한 필터를 같이 쓴다 */
export function quantizeColor(color) {
    if (!color) return null;
    const q = v => Math.min(15, Math.max(0, Math.round((Number(v) || 0) / 17)));
    return `#${[color.r, color.g, color.b].map(v => q(v).toString(16).repeat(2)).join('')}`;
}

/** 필터 이름: 그림 가장자리 색(없으면 기본 색) + 닿은 면 */
export const pickFilterId = (hex, mask = 0) => `${RING_ID}${hex ? '-' + String(hex).replace('#', '').toLowerCase() : ''}${mask ? '-m' + mask : ''}`;

// ───────── 아래는 브라우저에서만 ─────────
const PICK_VAR = '--salty-cutedge-pick'; // 그림 가장자리 색 + 닿은 면 필터 (색 고르기가 그림 가장자리 색일 때)
const OWN_VAR = '--salty-cutedge-own';   // 기본 색 + 닿은 면 필터 (닿은 면이 있을 때만)
const PICK_MAX = 64; // 필터 하나씩 — 채팅 한 화면에 그림이 이보다 많을 일은 드물다. 넘치면 지금 아무 그림도 안 쓰는 것부터 뺀다
const picks = new Map(); // '#rrggbb|mask' → true (LRU)
let current = resolveCutEdge(null);
let theme = { dark: false, accent: '#7cc7ff' };
let signature = '';

/** 외곽선의 기본 색: 직접 = 고른 색, 테마 포인트 색 = 지금 테마 포인트, 그림 가장자리 색 = 못 뽑은 그림에 쓰는 고른 색 */
export function baseInk(r, accent) {
    return r.outline.colorMode === 'accent' && HEX.test(String(accent || '')) ? accent.toLowerCase() : r.outline.color;
}

function defsRoot() {
    let svg = document.getElementById(DEFS_ID);
    if (svg) return svg;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = DEFS_ID;
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.append(svg);
    return svg;
}

function render() {
    const r = current, ink = baseInk(r, theme.accent);
    const parts = [ringFilterMarkup(RING_ID, ink, r, 0)];
    for (const key of picks.keys()) {
        const [hex, mask] = key.split('|');
        parts.push(ringFilterMarkup(pickFilterId(hex, Number(mask)), hex || ink, r, Number(mask)));
    }
    defsRoot().innerHTML = `<defs>${parts.join('')}</defs>`;
}

/** 설정 → 필터 정의 (apply.js applyAll 이 부른다). th = { dark, accent }. 값이 그대로면 아무것도 안 만진다 */
export function syncCutEdge(edge, enabled = true, th = theme) {
    theme = { dark: !!th?.dark, accent: HEX.test(String(th?.accent || '')) ? th.accent.toLowerCase() : theme.accent };
    current = resolveCutEdge(edge, theme);
    const on = enabled && (outlineVisible(current) || shadowVisible(current));
    const next = on ? JSON.stringify([current, theme.accent]) : '';
    if (next === signature) return;
    signature = next;
    if (!on) { document.getElementById(DEFS_ID)?.remove(); return; }
    render();
}

function usedKeys() {
    const used = new Set();
    for (const el of document.querySelectorAll(`[style*="${RING_ID}-"]`)) {
        for (const name of [PICK_VAR, OWN_VAR]) {
            const m = /url\("?#salty-cutedge-ring(?:-([0-9a-f]{6}))?(?:-m(\d+))?"?\)/.exec(el.style.getPropertyValue(name));
            if (m) used.add(`${m[1] ? '#' + m[1] : ''}|${m[2] || 0}`);
        }
    }
    return used;
}

function remember(key) {
    const known = picks.has(key);
    picks.delete(key);
    picks.set(key, true);
    if (known) return;
    if (picks.size > PICK_MAX) {
        const used = usedKeys();
        for (const old of picks.keys()) {
            if (picks.size <= PICK_MAX) break;
            if (old !== key && !used.has(old)) picks.delete(old);
        }
    }
    if (signature) render();
}

function setVar(host, name, value) {
    if (!value) { if (host.style.getPropertyValue(name)) host.style.removeProperty(name); return; }
    if (host.style.getPropertyValue(name) !== value) host.style.setProperty(name, value);
}

/**
 * 그림 하나 (assets.js 가 부른다): 투명 그림이면 가장자리 색 · 닿은 면을 뽑아 그 필터를 틀(host)의 변수로 건다.
 * 색을 못 뽑으면(다른 출처 그림 · 거의 빈 그림) 기본 색 필터로 그려진다.
 * 직접 색 모드여도 그림 가장자리 색 변수는 미리 걸어 둔다 — 모드를 바꾸는 순간 채팅을 다시 훑지 않아도 되게 (CSS 가 모드에 따라 고른다)
 */
export function paintCutEdge(host, rec) {
    if (!host?.style) return;
    if (!rec?.cutout) { setVar(host, PICK_VAR, ''); setVar(host, OWN_VAR, ''); return; }
    if (rec.edgeHex === undefined) rec.edgeHex = quantizeColor(edgeColorFromGrid(rec.grid)) || null;
    if (rec.sides === undefined) rec.sides = touchedSides(rec.grid);
    const mask = rec.sides || 0;
    if (mask) { remember(`|${mask}`); setVar(host, OWN_VAR, `url("#${pickFilterId('', mask)}")`); } else setVar(host, OWN_VAR, '');
    if (rec.edgeHex) { remember(`${rec.edgeHex}|${mask}`); setVar(host, PICK_VAR, `url("#${pickFilterId(rec.edgeHex, mask)}")`); } else setVar(host, PICK_VAR, '');
}
