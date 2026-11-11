// 11-12 「모양 · 색 더하기」(설계 `지시-1111/글꾸-조절-설계/설계.md` 2-2 N5 · N8 · N12 ~ N18 · N23) — 모든 틀에 같이 걸리는 카드 모양 · 띠 진하기 · 이름표 · 소품 숨김.
//   + 틀마다 고른 낱낱 바탕 색(카드 바탕 · 깡통 띠 · 깡캐 띠 · 제목 밑줄 — tune.inks[밤낮] 의 새 역할 넷)도 여기서 규칙으로 내요.
//   거는 방법은 깡통에서 살아남은 꼴만: 틀 첫 <style> 끝에 덮는 규칙(틀 열쇠 세 겹 .gk-k1.gk-k1.gk-k1) — 뿌리 class · data-* · 인라인 style 없음.
//   값이 없으면 받은 그대로(한 글자도 안 바뀌어요). 다시 칠하기(toneSimple) 바로 뒤 · 글 모양(applyLook) 앞에 걸어요 —
//   그래야 글 모양의 형광펜 · 질감의 띠 받침이 바뀐 띠 색을 읽어요. DOM 없는 순수 모듈(node 시험 · 능력표 도구가 같이 써요).
export const SHAPE_KEY = 'bl-mart-shape-v1';
const HEX = /^#[0-9a-f]{6}$/i;

/** 칸 표 — group: 세밀 갈래(color · shape · prop) · cap: 능력표(caps.js)에서 그 틀이 받는지 보는 열쇠 */
export const SHAPE_FIELDS = Object.freeze([
    { group: 'color', path: 'bandAlpha', label: '띠 진하기', kind: 'range', min: 8, max: 40, step: 1, def: 18, unit: '%', cap: 'band' },
    { group: 'color', path: 'borderAlpha', label: '테두리', kind: 'range', min: 0, max: 30, step: 1, def: 10, unit: '%', cap: 'border' },
    { group: 'shape', path: 'radius', label: '모서리', kind: 'range', min: 0, max: 24, step: 1, def: 12, unit: 'px', cap: 'radius' },
    { group: 'shape', path: 'pad', label: '안쪽 여백', kind: 'range', min: 70, max: 130, step: 10, def: 100, unit: '%', cap: 'pad' },
    { group: 'shape', path: 'width', label: '폭', kind: 'pick', options: [[640, '640'], [560, '560'], [480, '480']], cap: 'width' },
    { group: 'shape', path: 'noBorder', label: '테두리 선', kind: 'pick', options: [[false, '켬'], [true, '끔']], cap: 'border' },
    { group: 'shape', path: 'nameTag', label: '이름표 모양', kind: 'pick', options: [['plain', '글자만'], ['pill', '알약'], ['line', '밑줄']], cap: 'nameTag' },
    { group: 'shape', path: 'nameAlign', label: '이름표 자리', kind: 'pick', options: [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], cap: 'nameTag' },
    { group: 'shape', path: 'hideUl', label: '제목 밑줄', kind: 'pick', options: [[false, '보임'], [true, '숨김']], cap: 'underline' },
    { group: 'prop', path: 'hideProp', label: '소품 보이기', kind: 'pick', options: [[false, '보임'], [true, '숨김']], cap: 'hideProp' },
].map(Object.freeze));
/** 틀마다 고르는 바탕 색(색 칩 줄 · 밤낮 따로 · tune.inks 에 같이 기억) */
export const PAINT_ROLES = Object.freeze([
    Object.freeze({ role: 'card', label: '카드 바탕', cap: 'bg' }),
    Object.freeze({ role: 'bandMain', label: '깡통 띠', cap: 'band' }),
    Object.freeze({ role: 'bandOther', label: '깡캐 띠', cap: 'band' }),
    Object.freeze({ role: 'underline', label: '제목 밑줄', cap: 'underline' }),
]);
/** 기본값(= 틀 그대로)인 값은 기억하지 않아요 */
const DEFAULT_OFF = { width: 640, noBorder: false, nameTag: 'plain', nameAlign: 'left', hideUl: false, hideProp: false };

const num = (v, f) => { const n = Number(v); if (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) return null; const c = Math.min(f.max, Math.max(f.min, n)); return Number((Math.round(c / f.step) * f.step).toFixed(4)); };
/** 받은 값을 다듬어요(모르는 칸 · 범위 밖은 버리거나 범위 안으로 · 기본값은 지워요) — 남는 게 없으면 null */
export function cleanShape(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const f of SHAPE_FIELDS) {
        const v = raw[f.path]; if (v == null) continue;
        if (f.kind === 'range') { const n = num(v, f); if (n != null) out[f.path] = n; }
        else { const hit = f.options.find(([id]) => id === v); if (hit && DEFAULT_OFF[f.path] !== hit[0]) out[f.path] = hit[0]; }
    }
    return Object.keys(out).length ? out : null;
}
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
let shape = (() => { try { return cleanShape(JSON.parse(store()?.getItem(SHAPE_KEY) || 'null')); } catch { return null; } })(), rev = 0;
export const shapeNow = () => (shape ? { ...shape } : null);
export const shapeRev = () => rev;
export const shapeValue = path => shape?.[path] ?? null;
/** 통째로 바꿔요(null = 전부 틀 그대로) — 기억하고 'bl-tone-change' 를 알려요 */
export function setShape(next) {
    shape = cleanShape(next); rev++;
    try { store()?.setItem(SHAPE_KEY, JSON.stringify(shape)); } catch { /* 이번 화면에서만 */ }
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { shape: true } })); } catch { /* 시험 */ }
    return shapeNow();
}
/** 한 칸만(null = 그 칸만 틀 그대로) */
export function setShapeValue(path, value) { const o = { ...(shape || {}) }; if (value == null) delete o[path]; else o[path] = value; return setShape(o); }

// ── 틀 읽기 ──
const ROOT = /^\s*<div\b[^>]*\sclass="(gk(?:\s[^"]*)?)"/;
const keyOf = html => (String(html ?? '').match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || '';
/** 첫 <style> 의 규칙들(@ 덩이 안은 빼요) — [[선택자, 몸]] */
function rulesOf(css) {
    const out = []; let depth = 0, at = 0, sel = '', skip = 0;
    for (let i = 0; i < css.length; i++) {
        const c = css[i];
        if (c === '{') { if (depth === 0) { sel = css.slice(at, i).trim(); skip = sel.startsWith('@') ? 1 : 0; at = i + 1; } depth++; }
        else if (c === '}') { depth--; if (depth === 0) { if (!skip) out.push([sel, css.slice(at, i)]); at = i + 1; } }
    }
    return out;
}
const declsOf = body => { const o = {}; for (const d of body.split(';')) { const i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim(); } return o; };
/** 틀을 읽어요 — 뿌리에 지금 걸리는 값(바탕 · 테두리 · 여백 · 모서리 · 폭) · 화자 띠 규칙 · 이름표 · 밑줄 · 소품 누름 칸 */
export function shapeInfo(html) {
    const text = String(html ?? ''), key = keyOf(text), m = text.match(ROOT);
    if (!key || !m) return null;
    const end = text.indexOf('</style>'); if (end < 0) return null;
    const css = text.slice(text.indexOf('<style>') + 7, end), cls = m[1].split(/\s+/), K = `.gk-${key}`;
    const rules = rulesOf(css), root = {};
    for (const [sel, body] of rules) {
        if (!sel.split(',').some((s) => { const t = s.trim(); if (!t.startsWith(K) || /[\s>~+:[]/.test(t)) return false; const q = t.slice(K.length).split('.').filter(Boolean); return q.every(c => cls.includes(c)) && /^(\.[\w-]+)*$/.test(t.slice(K.length)); })) continue;
        Object.assign(root, declsOf(body));
    }
    const bands = [];   // [qual(뿌리 뒤 꾸밈 class 들), 글자, r, g, b, a]
    for (const [sel, body] of rules) {
        const mm = sel.match(new RegExp(`^\\.gk-${key}((?:\\.[\\w-]+)*) \\.gk-d([A-Z])$`)); if (!mm) continue;
        const c = body.match(/^background-color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/); if (!c) continue;
        bands.push([mm[1], mm[2], +c[1], +c[2], +c[3], c[4] == null ? 1 : +c[4]]);
    }
    const imageBand = /\.gk-d[A-Z]?\{[^}]*background(?:-image)?:[^;}]*(?:url\(|gradient)/.test(css) || rules.some(([s, b]) => /\.gk-d[A-Z]?$/.test(s) && /mask|background-image|background:[^;]*(?:url|gradient)/.test(b));
    const body = text.slice(end);
    const pad = (root.padding || '').split(/\s+/).filter(Boolean);
    const padPx = pad.length && pad.length <= 4 && pad.every(v => /^\d+(?:\.\d+)?px$|^0$/.test(v)) ? pad.map(v => parseFloat(v) || 0) : null;
    const borderRgba = (root['border-color'] || root.border || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    const named = [...new Set([...body.matchAll(/<p class="gk-nm gk-n([A-Z])\b/g)].map(x => x[1]))];
    const speakers = named.length ? named : [...new Set([...body.matchAll(/class="gk-d gk-d([A-Z])\b/g)].map(x => x[1]))];   // 이름 줄이 없는 틀은 띠 차례로
    // 소품 누름 칸: details.gk-kx 안에 글 자리(제목 · 지문 · 대사 · 이름 · 글 칸)가 하나도 없어야 숨겨도 글이 남아요
    const kx = [...body.matchAll(/<details class="gk-kx"[^>]*>([\s\S]*?)<\/details>/g)];
    const propOnly = kx.length > 0 && kx.every(x => !/class="(?:[^"]*\s)?gk-(?:tt|nr|nm|d|dl|lg|sn|hl)(?:[\s"])/.test(x[1]) && !/<p\b/.test(x[1]));
    return {
        key, cls, root, bands, imageBand,
        bg: /^#|^rgb/.test(root['background-color'] || '') || /^#[0-9a-f]{3,8}$/i.test(root.background || ''),
        border: !!borderRgba, borderRgb: borderRgba ? [+borderRgba[1], +borderRgba[2], +borderRgba[3]] : null, borderA: borderRgba ? (borderRgba[4] == null ? 1 : +borderRgba[4]) : null,
        radius: /^\d/.test(root['border-radius'] || ''), padPx, maxWidth: parseFloat(root['max-width']) || null,
        underline: /class="gk-ul\b/.test(body), names: /<p class="gk-nm\b/.test(body), speakers, kx: kx.length, propOnly,
        inlineMotion: /style="[^"]*(?:animation|transition)/.test(body),
    };
}
/** 그 틀이 받는 칸(정적) — 능력표가 없는 틀(내 글꾸 · 새 틀)은 이것만으로 */
export function shapeCaps(html) {
    const i = shapeInfo(html);
    if (!i) return { band: false, bg: false, border: false, radius: false, pad: false, width: false, nameTag: false, underline: false, hideProp: false };
    return { band: i.bands.length ? 'color' : i.imageBand ? 'image' : false, bg: i.bg, border: i.border, radius: i.radius, pad: !!i.padPx, width: !!i.maxWidth && i.maxWidth > 480, nameTag: i.names, underline: i.underline, hideProp: i.propOnly };
}

const rgbOf = hex => [0, 2, 4].map(k => parseInt(hex.slice(1 + k, 3 + k), 16));
const a2 = v => Number(Math.max(0, Math.min(1, v)).toFixed(2));
/** 모양 · 바탕 색 → 덮는 규칙들 · paints: 지금 밤낮의 { card, bandMain, bandOther, underline } */
export function shapeRules(html, value = shape, paints = null, caps = null) {
    const s = cleanShape(value) || {}, P = {};
    for (const { role } of PAINT_ROLES) if (HEX.test(paints?.[role] || '')) P[role] = paints[role].toLowerCase();
    if (!Object.keys(s).length && !Object.keys(P).length) return [];
    const i = shapeInfo(html); if (!i) return [];
    const ok = k => !caps || caps[k] !== false;   // 능력표가 「안 받음」이라고 한 칸은 건너뛰어요(값은 남아요)
    const K = `.gk-${i.key}`.repeat(3), K2 = `.gk-${i.key}`.repeat(2), out = [];
    const main = i.speakers[0], other = i.speakers.find(x => x !== main);
    // 띠: 진하기 · 화자별 색 — 틀의 화자 띠 규칙마다 같은 꾸밈 class 로 한 번 더(뒤 · 한 겹 더 세게)
    if (i.bands.length && ok('band') && (s.bandAlpha != null || P.bandMain || P.bandOther)) {
        for (const [q, X, r, g, b, a] of i.bands) {
            const pick = X === main ? P.bandMain : X === other ? P.bandOther : null;
            if (s.bandAlpha == null && !pick) continue;
            const [R, G, B] = pick ? rgbOf(pick) : [r, g, b];
            out.push(`${K2}${q} .gk-d${X}{background-color:rgba(${R},${G},${B},${s.bandAlpha != null ? a2(s.bandAlpha / 100) : a2(a)})}`);
        }
    }
    const root = [];
    if (P.card && i.bg && ok('bg')) root.push(`background-color:${P.card}`);
    if (s.noBorder && i.border && ok('border')) root.push('border-color:transparent');
    else if (s.borderAlpha != null && i.border && ok('border')) root.push(`border-color:rgba(${i.borderRgb.join(',')},${a2(s.borderAlpha / 100)})`);
    if (s.radius != null && i.radius && ok('radius')) root.push(`border-radius:${s.radius}px`);
    if (s.pad != null && i.padPx && ok('pad')) root.push(`padding:${i.padPx.map(v => `${Math.round((v * s.pad) / 200) * 2}px`).join(' ')}`);
    if (s.width != null && i.maxWidth && s.width < i.maxWidth && ok('width')) root.push(`max-width:${s.width}px`);
    if (root.length) out.push(`${K}{${root.join(';')}}`);
    // 이름표: 모양(알약 · 밑줄) · 자리 — 이름 줄 문단(p.gk-nm)만
    if (i.names && ok('nameTag') && (s.nameTag || s.nameAlign)) {
        const tag = s.nameTag, al = s.nameAlign || 'left', nm = [];
        if (tag) nm.push('width:fit-content;max-width:100%;text-indent:0', tag === 'pill' ? 'padding:1px 8px;border-radius:999px' : 'padding:0 1px 1px;border-bottom:2px solid currentColor');
        if (s.nameAlign) nm.push(`text-align:${al}`);
        if (tag && al !== 'left') nm.push(al === 'center' ? 'margin-left:auto;margin-right:auto' : 'margin-left:auto;margin-right:0');
        out.push(`${K} p.gk-nm{${nm.join(';')}}`);
        if (tag === 'pill') {
            out.push(`${K} p.gk-nm{background-color:rgba(127,127,127,.14)}`);
            for (const [q, X, r, g, b] of i.bands) { const pick = X === main ? P.bandMain : X === other ? P.bandOther : null; const [R, G, B] = pick ? rgbOf(pick) : [r, g, b]; out.push(`${K2}${q} p.gk-nm.gk-n${X}{background-color:rgba(${R},${G},${B},.16)}`); }
        }
    }
    if (i.underline && ok('underline')) {
        if (s.hideUl) out.push(`${K} .gk-ul{visibility:hidden}`);
        else if (P.underline) out.push(`${K}.gk .gk-ul{background-color:${P.underline}}`);
    }
    if (s.hideProp && i.propOnly && ok('hideProp')) out.push(`${K} details.gk-kx,${K} details.gk-kx *{visibility:hidden!important;pointer-events:none}`);   // 자리는 그대로(글 배치 · 지문 위 공백이 안 바뀌어요) · 움직임이 visibility 를 바꿔도 숨김
    return out;
}
/** 다 칠한 틀 HTML 에 모양을 얹어요 — 값이 없으면 받은 그대로 */
export function applyShape(html, value = shape, paints = null, caps = null) {
    const text = String(html ?? ''), rules = shapeRules(text, value, paints, caps);
    if (!rules.length) return text;
    const at = text.indexOf('\n</style>');
    return at < 0 ? text : `${text.slice(0, at)}\n${rules.join('\n')}${text.slice(at)}`;
}
