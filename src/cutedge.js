// 6.1.6 투명 그림(캐릭터 컷) 외곽선 · 그림자 — 배경이 투명한 캐릭터 에셋 · 생성 그림이 채팅 위에 둥 떠 보이지 않게.
// 사용자 요청: 「글자처럼 조절 가능하게 파라미터」, 「딱 저 외곽선 따라서 캐릭터 외곽선」, 「그림자나 외곽선이 그림 칸 밖에 나가면 표시할지 잘린 채로 둘지」,
//             「외곽선 블러 기능이랑 외곽선 색깔을 캐릭터 그림 가장 바깥 테두리 색이랑 맞출지도 고를 수 있게」.
// 외곽선 = SVG 필터 (그림의 알파를 두께만큼 둥글게 넓혀 한 색으로 칠함 → 실루엣을 따라가고 진하기가 고르다. 퍼짐은 그 띠만 흐림).
//          drop-shadow 4방향을 겹치면 진하기 < 100 에서 겹친 곳이 진해져 얼룩지므로 쓰지 않는다.
// 그림자 = CSS drop-shadow (실루엣을 따라간다). 각도 · 거리는 글자 그림자와 같은 셈 (0 = 오른쪽, 90 = 아래).
// 어느 그림에 거나: assets.js 가 가장자리 격자로 투명하다고 본 그림(.salty-alpha). '투명 그림도 똑같이'와 상관없이 건다 —
//   그 스위치는 모양 · 흐림 · 테두리를 컷에도 똑같이 쓸지이고, 둥 떠 보이는 것은 두 경우 다 같다.
// 위 절반(순수 함수)은 node 로 시험한다 (tools/tests/cutout-edge.mjs). 아래 절반만 문서를 만진다.

export const CUT_EDGE_DEFAULTS = Object.freeze({
    overflow: false, // false = 그림 칸에 맞춰 자름 (잘린 몸 아래에 줄이 생기지 않는다)
    outline: Object.freeze({ on: true, colorMode: 'custom', color: '#ffffff', width: 2, alpha: 90, blur: 0 }),
    shadow: Object.freeze({ on: true, color: '#000000', alpha: 55, angle: 90, distance: 6, blur: 12 }),
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
export const CUT_EDGE_COLOR_MODES = Object.freeze(['custom', 'picture']); // 직접 | 그림 가장자리 색
export const RING_ID = 'salty-cutedge-ring';
export const DEFS_ID = 'salty-cutedge-defs';

const HEX = /^#[0-9a-f]{6}$/i;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const flag = (v, fallback) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : fallback);
const clamp = (v, [min, max], fallback) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** 저장된 값(없거나 일부만 · 가져온 파일의 문자열이어도) → 온전한 새 값 */
export function normalizeCutEdge(value) {
    const src = isObj(value) ? value : {};
    const out = { overflow: flag(src.overflow, CUT_EDGE_DEFAULTS.overflow) };
    for (const part of ['outline', 'shadow']) {
        const base = CUT_EDGE_DEFAULTS[part];
        const given = isObj(src[part]) ? src[part] : {};
        const next = {};
        for (const key of Object.keys(base)) {
            if (key === 'on') next.on = flag(given.on, base.on);
            else if (key === 'color') next.color = HEX.test(String(given.color ?? '')) ? String(given.color).toLowerCase() : base.color;
            else if (key === 'colorMode') next.colorMode = CUT_EDGE_COLOR_MODES.includes(given.colorMode) ? given.colorMode : base.colorMode;
            else next[key] = clamp(given[key], CUT_EDGE_RANGES[`${part}.${key}`], base[key]);
        }
        out[part] = next;
    }
    return out;
}

/** 설정 정리(settings.js): holder.cutEdge 를 그 자리에서 고친다 — 설정 창이 잡고 있는 객체를 바꾸지 않게 */
export function tidyCutEdge(holder) {
    if (!isObj(holder)) return;
    const clean = normalizeCutEdge(holder.cutEdge);
    if (!isObj(holder.cutEdge)) holder.cutEdge = {};
    const edge = holder.cutEdge;
    for (const key of Object.keys(edge)) if (!(key in clean)) delete edge[key];
    edge.overflow = clean.overflow;
    for (const part of ['outline', 'shadow']) {
        if (!isObj(edge[part])) edge[part] = {};
        for (const key of Object.keys(edge[part])) if (!(key in clean[part])) delete edge[part][key];
        Object.assign(edge[part], clean[part]);
    }
}

/** 처음 값 (되돌리기 단추) — 깊은 사본 */
export function cutEdgeDefaults() {
    return { overflow: CUT_EDGE_DEFAULTS.overflow, outline: { ...CUT_EDGE_DEFAULTS.outline }, shadow: { ...CUT_EDGE_DEFAULTS.shadow } };
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

/** 그림자 부분 (CSS filter 함수 하나). 꺼져 있으면 '' */
export function dropShadow(edge) {
    const e = normalizeCutEdge(edge);
    if (!shadowVisible(e)) return '';
    const [x, y] = shadowOffset(e.shadow.angle, e.shadow.distance);
    return `drop-shadow(${x}px ${y}px ${e.shadow.blur}px ${rgba(e.shadow.color, e.shadow.alpha)})`;
}

/**
 * 화면에 넣을 CSS 변수 (apply.js 가 :root 에). 꺼진 부분은 아무 일도 안 하는 opacity(1) — 변수 둘을 늘 이어 쓸 수 있게.
 * 둘 다 꺼지면 apply.js 가 body 의 salty-cutedge 클래스를 떼어 filter 자체를 안 건다 (레이어 비용 없음)
 */
export function cutEdgeVars(edge) {
    const e = normalizeCutEdge(edge);
    return {
        '--salty-cutedge-ring': outlineVisible(e) ? `url("#${RING_ID}")` : 'opacity(1)',
        '--salty-cutedge-drop': dropShadow(e) || 'opacity(1)',
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
export function cutEdgeClasses(edge, { frame = false } = {}) {
    if (frame) return [];
    const e = normalizeCutEdge(edge);
    const on = outlineVisible(e) || shadowVisible(e);
    if (!on) return [];
    const out = ['salty-cutedge'];
    if (e.overflow) out.push('salty-cutedge-out');
    if (outlineVisible(e) && e.outline.colorMode === 'picture') out.push('salty-cutedge-pick');
    return out;
}

const num = v => String(Number(Number(v).toFixed(3)));

/**
 * 외곽선 SVG 필터 하나. 칸에 맞춰 자를 때는 필터 영역 = 그림 상자 그대로(밖으로 안 번짐),
 * 칸 밖으로 그릴 때는 사방 20% 를 더 잡는다 (두께 8 + 퍼짐 10 이 90px 그림까지 들어감 — 더 크게 잡으면 그만큼 픽셀을 더 칠한다)
 */
export function ringFilterMarkup(id, color, edge) {
    const e = normalizeCutEdge(edge);
    const region = e.overflow ? 'x="-20%" y="-20%" width="140%" height="140%"' : 'x="0%" y="0%" width="100%" height="100%"';
    const blur = e.outline.blur > 0 ? `<feGaussianBlur in="ring" stdDeviation="${num(e.outline.blur / 2)}" result="soft"/>` : '';
    return `<filter id="${id}" ${region} color-interpolation-filters="sRGB">`
        + `<feMorphology in="SourceAlpha" operator="dilate" radius="${num(e.outline.width)}" result="grown"/>`
        + `<feFlood flood-color="${HEX.test(color) ? color.toLowerCase() : '#ffffff'}" flood-opacity="${num(e.outline.alpha / 100)}" result="ink"/>`
        + `<feComposite in="ink" in2="grown" operator="in" result="ring"/>`
        + blur
        + `<feMerge><feMergeNode in="${blur ? 'soft' : 'ring'}"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

// ───────── 그림 가장자리 색 ─────────
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

/** 색을 채널마다 16단계로 줄인 '#rrggbb' — 필터를 색마다 하나씩 만들므로 거의 같은 색은 한 필터를 같이 쓴다 */
export function quantizeColor(color) {
    if (!color) return null;
    const q = v => Math.min(15, Math.max(0, Math.round((Number(v) || 0) / 17)));
    return `#${[color.r, color.g, color.b].map(v => q(v).toString(16).repeat(2)).join('')}`;
}

export const pickFilterId = hex => `${RING_ID}-${String(hex).replace('#', '').toLowerCase()}`;

// ───────── 아래는 브라우저에서만 ─────────
const PICK_VAR = '--salty-cutedge-pick';
const PICK_MAX = 64; // 색마다 필터 하나 — 채팅 한 화면에 그림이 이보다 많을 일은 드물다. 넘치면 지금 아무 그림도 안 쓰는 색부터 뺀다
const picks = new Map(); // '#rrggbb' → 마지막으로 쓴 차례 (LRU)
let current = normalizeCutEdge(null);
let signature = '';

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
    const e = current;
    const parts = [ringFilterMarkup(RING_ID, e.outline.color, e)];
    for (const hex of picks.keys()) parts.push(ringFilterMarkup(pickFilterId(hex), hex, e));
    defsRoot().innerHTML = `<defs>${parts.join('')}</defs>`;
}

/** 설정 → 필터 정의 (apply.js applyAll 이 부른다). 값이 그대로면 아무것도 안 만진다 */
export function syncCutEdge(edge, enabled = true) {
    current = normalizeCutEdge(edge);
    const on = enabled && (outlineVisible(current) || shadowVisible(current));
    const next = on ? JSON.stringify([current.overflow, current.outline]) : '';
    if (next === signature) return;
    signature = next;
    if (!on) { document.getElementById(DEFS_ID)?.remove(); return; }
    render();
}

function usedColors() {
    const used = new Set();
    for (const el of document.querySelectorAll(`[style*="${PICK_VAR}"]`)) {
        const m = /url\("?#salty-cutedge-ring-([0-9a-f]{6})"?\)/.exec(el.style.getPropertyValue(PICK_VAR));
        if (m) used.add(`#${m[1]}`);
    }
    return used;
}

function remember(hex) {
    const known = picks.has(hex);
    picks.delete(hex);
    picks.set(hex, true);
    if (known) return;
    if (picks.size > PICK_MAX) {
        const used = usedColors();
        for (const old of picks.keys()) {
            if (picks.size <= PICK_MAX) break;
            if (old !== hex && !used.has(old)) picks.delete(old);
        }
    }
    if (signature) render();
}

/**
 * 그림 하나 (assets.js classify 가 부른다): 투명 그림이면 가장자리 색을 뽑아 그 색 필터를 틀(host)의 변수로 건다.
 * 색을 못 뽑으면(다른 출처 그림 · 거의 빈 그림) 변수를 지워 직접 고른 색 필터로 그려진다.
 * 직접 색 모드여도 변수는 미리 걸어 둔다 — 모드를 바꾸는 순간 채팅을 다시 훑지 않아도 되게 (CSS 가 모드에 따라 고른다)
 */
export function paintCutEdge(host, rec) {
    if (!host?.style) return;
    if (!rec?.cutout) {
        if (host.style.getPropertyValue(PICK_VAR)) host.style.removeProperty(PICK_VAR);
        return;
    }
    if (rec.edgeHex === undefined) rec.edgeHex = quantizeColor(edgeColorFromGrid(rec.grid)) || null;
    if (!rec.edgeHex) {
        if (host.style.getPropertyValue(PICK_VAR)) host.style.removeProperty(PICK_VAR);
        return;
    }
    remember(rec.edgeHex);
    const want = `url("#${pickFilterId(rec.edgeHex)}")`;
    if (host.style.getPropertyValue(PICK_VAR) !== want) host.style.setProperty(PICK_VAR, want);
}
