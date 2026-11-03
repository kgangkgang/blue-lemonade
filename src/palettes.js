// 팔레트. 화이트/나이트 바탕을 공유하고 형광펜과 포인트색으로 구분한다. 시작할 때는 블루 레몬에이드 밤 · 낮 두 벌만 — 나머지는 palette-data.js.
export const PALETTES = {
    salt: {
        label: '블루 레몬에이드 · 화이트', desc: '하늘빛 흰 종이 · 파란 형광펜', mode: 'light', bg: '#F9FCFF', surface: '#FDFEFF', raised: '#E5F1FF', text: '#222D3A', dialogue: '#141E2A', em: '#336FA6', strong: '#2264A5', muted: '#566B83', faint: '#62758B', danger: '#E23B2E', accent: '#2477D3', pop: '#398EE8', marker: 'rgba(62, 177, 255, 0.27)', gold: 'rgba(255, 226, 60, 0.62)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)',
    },
    night: {
        label: '블루 아워', desc: '푸른 밤 · 파란 형광펜 · 레몬 강조', mode: 'dark', bg: '#141F2E', surface: '#1C293B', raised: '#28384D', text: '#DBE2EB', dialogue: '#F3F7FC', em: '#A4C7ED', strong: '#FFE873', muted: '#ABBACE', faint: '#8596AD', danger: '#FF6F62', accent: '#93C9FF', pop: '#FFE873', marker: 'rgba(96, 169, 255, 0.35)', gold: 'rgba(255, 232, 115, 0)', line: 'rgba(184, 201, 224, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
};
const surfaceKeys = ['bg', 'surface', 'raised', 'line', 'shadow', 'text', 'dialogue', 'muted', 'faint'];
const neutralLight = {bg:'#F9FCFF', surface:'#FDFEFF', raised:'#E5F1FF'};
const neutralNight = {bg:'#1B1C1F', surface:'#242529', raised:'#303136', line:'rgba(224, 224, 228, 0.09)', shadow:'rgba(0, 0, 0, 0.6)', text:'#E1E1E5', dialogue:'#F5F5F7', muted:'#B8B8C0', faint:'#95959F'};
const markerNames = {salt:'파란',night:'파란'};
/** palette-data.js 가 같은 바탕으로 나머지 팔레트를 만들 때 써요 */
export const PALETTE_NEUTRALS = { light: neutralLight, night: neutralNight, surfaceKeys };
for (const [id, palette] of Object.entries(PALETTES)) {
    const base = palette.mode === 'dark' ? neutralNight : PALETTES.salt;
    for (const key of surfaceKeys) palette[key] = base[key];
    palette.desc = `${markerNames[id]} 형광펜`;
}
PALETTES.night.label = '블루 레몬에이드 · 나이트';
// Default surface tint: white 0.5%, charcoal 1%. The editor can increase each independently.
for (const palette of Object.values(PALETTES)) {
    const dark = palette.mode === 'dark', amount = dark ? .01 : .005;
    const tint = parseColor(palette.accent);
    for (const key of ['bg', 'surface', 'raised']) {
        const base = parseColor((dark ? neutralNight : neutralLight)[key]);
        palette[key] = '#' + base.slice(0,3).map((v,i) => Math.round(v * (1 - amount) + tint[i] * amount).toString(16).padStart(2,'0')).join('').toUpperCase();
    }
}

// 1.0.0 다른 에이드 11벌 · 커스텀: 색 정의는 palette-data.js(시작 그래프 밖, ensurePalettes 로 받아 아래 둘에 채움). 시작 때는 id 목록으로 저장값을 검사하고 기억해 둔 계산값으로 먼저 칠해요
export const PALETTE_FAMILIES = { blue: { label: '블루 레몬에이드', sample: '블루 레몬', light: 'salt', dark: 'night' } };
const FAMILY_IDS = ['lemon', 'black', 'melon', 'grapefruit', 'peach', 'lavender', 'strawberry', 'mint', 'orange', 'wood', 'watermelon', 'custom'];
const lightId = f => ({ black: 'black-light', custom: 'custom-light' })[f] || f, darkId = f => ({ black: 'black', custom: 'custom-night' })[f] || `${f}-night`;
export const PALETTE_MODES = Object.fromEntries([['salt', 'light'], ['night', 'dark'], ...FAMILY_IDS.flatMap(f => [[lightId(f), 'light'], [darkId(f), 'dark']])]);
export const isPaletteId = id => typeof id === 'string' && Object.hasOwn(PALETTE_MODES, id);
export const paletteMode = id => PALETTES[id]?.mode || PALETTE_MODES[id] || 'light';
export const palettesReady = () => Object.keys(PALETTE_FAMILIES).length > 1;
let loading = null;
export function ensurePalettes() {
    if (palettesReady()) return Promise.resolve(true);
    return loading ||= import('./palette-data.js').then(() => true, error => { loading = null; console.warn('[Blue Lemonade] 팔레트 데이터', error); return false; });
}
const CACHE = 'bl_palette_cache';   // 마지막으로 칠한 밤 · 낮 밖 팔레트 한 벌 (이 브라우저에만)
function cachedPalette(id) {
    try { const v = JSON.parse(localStorage.getItem(CACHE) || 'null'); return v?.id === id && v.palette && typeof v.palette === 'object' ? v.palette : null; } catch { return null; }
}
export function rememberPalette(id) {
    if (id === 'salt' || id === 'night' || !PALETTES[id]) return;
    try { const text = JSON.stringify({ id, palette: PALETTES[id] }); if (localStorage.getItem(CACHE) !== text) localStorage.setItem(CACHE, text); } catch { /* 막힌 저장소 */ }
}
/** 데이터가 아직이면 기억해 둔 계산값, 그것도 없으면 같은 밝기의 기본 팔레트 */
export const paletteBase = id => PALETTES[id] || cachedPalette(id) || (paletteMode(id) === 'dark' ? PALETTES.night : PALETTES.salt);
export function paletteFamily(id) {
    return Object.keys(PALETTE_FAMILIES).find(key => PALETTE_FAMILIES[key].light === id || PALETTE_FAMILIES[key].dark === id)
        || FAMILY_IDS.find(f => lightId(f) === id || darkId(f) === id) || 'blue';
}
export function paletteVariant(family, mode) {
    if (!PALETTE_FAMILIES[family] && FAMILY_IDS.includes(family)) return mode === 'dark' ? darkId(family) : lightId(family);
    return (PALETTE_FAMILIES[family] || PALETTE_FAMILIES.blue)[mode === 'dark' ? 'dark' : 'light'];
}
// 검색 「밝기」: 색 계열은 두고 밝기만
export const paletteBrightness = id => paletteMode(id) === 'dark' ? 'night' : 'salt';
export const withBrightness = (id, value) => paletteVariant(paletteFamily(id), value === 'night' ? 'dark' : 'light');
// 없어진 테마 → 남은 테마 (1.8.2~1.9.1 의 파스텔 스위치 id 도 원래 id 로)
export const PALETTE_ALIASES = { sea: 'salt', rock: 'salt', ink: 'night', ...Object.fromEntries(Object.keys(PALETTE_MODES).filter(id => !id.startsWith('custom-')).map(id => [id + '-pastel', id])) };

export const TOKEN_KEYS = ['bg', 'surface', 'raised', 'text', 'dialogue', 'em', 'strong', 'muted', 'faint', 'accent', 'marker', 'gold', 'line', 'shadow'];

// 색 직접 고치기 목록 (표시 순서, 묶음별)
export const TOKEN_GROUPS = [
    ['바탕', [['bg', '바탕'], ['surface', '메뉴·패널'], ['raised', '입력칸·말풍선']]],
    ['글자', [['text', '본문'], ['dialogue', '대사'], ['em', '속마음 *기울임*'], ['strong', '강조 **굵게**'], ['muted', '보조'], ['faint', '흐림']]],
    ['포인트', [['accent', '포인트'], ['marker', '대사 형광펜'], ['gold', '강조 형광펜 **굵게**'], ['shadow', '그림자']]],
];

export function paletteColors(settings) {
    const base = paletteBase(settings.palette);
    const colors = { ...base };
    if (!settings.palette?.startsWith('custom-')) {
        const dark = base.mode === 'dark', minimum = dark ? 1 : .5;
        const amount = Math.max(minimum, Math.min(20, Number(settings[dark ? 'nightTint' : 'lightTint']) || minimum)) / 100;
        const tint = parseColor(base.accent);
        for (const key of ['bg', 'surface', 'raised']) {
            const neutral = parseColor((dark ? neutralNight : neutralLight)[key]);
            colors[key] = '#' + neutral.slice(0, 3).map((v, i) => Math.round(v * (1 - amount) + tint[i] * amount).toString(16).padStart(2, '0')).join('').toUpperCase();
        }
    }
    return { ...colors, ...(settings.colorOverrides?.[settings.palette] || {}) };
}

/** '#rrggbb' | '#rgb' | 'rgb(a)(...)' → [r, g, b, a] */
export function parseColor(value) {
    const s = String(value ?? '').trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) {
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16)).concat(1);
    m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (m) {
        const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]));
        return [Number(m[1]), Number(m[2]), Number(m[3]), a];
    }
    m = s.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
    if (m) {
        const hex = m[1].length === 4 ? [...m[1]].map(c=>c+c).join('') : m[1];
        return [0,2,4,6].map((i,n)=>parseInt(hex.slice(i,i+2),16)/(n===3?255:1));
    }
    m = s.match(/^(rgba?|hsla?)\(([^()]+)\)$/i);
    if (m) {
        const parts = m[2].trim().split(/[\s,/]+/);
        const number = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?%?$/i;
        const clip = (n,max=1)=>Math.max(0,Math.min(max,n));
        const alpha = parts[3] === undefined ? 1 : number.test(parts[3]) ? clip(parseFloat(parts[3])/(parts[3].endsWith('%')?100:1)) : NaN;
        if (parts.length >= 3 && parts.length <= 4 && Number.isFinite(alpha)) {
            if (/^rgb/i.test(m[1]) && parts.slice(0,3).every(x=>number.test(x))) return [...parts.slice(0,3).map(x=>clip(parseFloat(x)*(x.endsWith('%')?2.55:1),255)),alpha];
            const hue = /^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(deg|grad|rad|turn)?$/i.exec(parts[0]);
            if (/^hsl/i.test(m[1]) && hue && parts.slice(1,3).every(x=>number.test(x)&&x.endsWith('%'))) {
                const degrees=Number(hue[1])*({deg:1,grad:.9,rad:180/Math.PI,turn:360}[hue[2]?.toLowerCase()]||1);
                const h=((degrees%360)+360)%360/60, sat=clip(parseFloat(parts[1])/100), l=clip(parseFloat(parts[2])/100);
                const c=(1-Math.abs(2*l-1))*sat,x=c*(1-Math.abs(h%2-1)),off=l-c/2;
                const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
                return [...rgb.map(v=>Math.round((v+off)*255)),alpha];
            }
        }
    }
    return [128, 128, 128, 1];
}

export function mixColor(a, b, amount) {
    const x=parseColor(a),y=parseColor(b);
    return `rgb(${[0,1,2].map(i=>Math.round(x[i]*amount+y[i]*(1-amount))).join(', ')})`;
}

export function sameColor(a, b) {
    const x = parseColor(a);
    const y = parseColor(b);
    return x.every((v, i) => Math.abs(v - y[i]) <= (i === 3 ? 0.011 : 1));
}

export function toRgba([r, g, b, a]) {
    return a >= 1 ? `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;
}

/** 아무 문자열 → 안전한 CSS 색 문자열 (style 속성에 그대로 넣어도 됨) */
export function safeColor(value) {
    return toRgba(parseColor(value));
}

/** 포인트색 위에 놓일 글자색: 밝은 포인트면 어두운 글자
 *  문턱 0.22 = 흰 글자 3.9 : 1 · 어두운 글자 4.9 : 1 인 밝기. 예전 0.36 은 분홍 #E8559A 에도 흰 글자(3.4 : 1)를 올렸다.
 *  더 어두운 중간 밝기(파랑 · 주황)는 흰 글자 그대로 — APCA 로는 흰 쪽이 훨씬 잘 읽히고, 블루 레몬에이드 파란 버튼 모양도 지킴 */
export function onColor(value) {
    const [r, g, b] = parseColor(value);
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.22 ? '#0B1216' : '#FFFFFF';
}
