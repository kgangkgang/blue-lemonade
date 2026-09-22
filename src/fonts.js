// 글꼴 엔진.
//  - 목록: catalog.js (기본) + 내 글꼴(구글 이름 / CSS 링크 / 파일)
//  - 언어별 글꼴 합치기: 한국어·영어·일본어·중국어 글꼴을 unicode-range 로 잘라 하나의 가족('Salty Text' 등)으로 묶음.
//    글꼴 CSS(@font-face)를 직접 받아와 가족 이름과 unicode-range 만 바꿔 다시 씀.
//  - 고르기 목록 미리보기: 보이는 글자만 담은 작은 구글 폰트 파일(&text=)
import { getSettings, saveSettings, FONT_SLOTS } from './settings.js';
import { CATALOG } from './catalog.js';

export { CATALOG };
export const GROUPS = [['sans', '고딕'], ['serif', '명조'], ['display', '꾸밈 · 손글씨'], ['mono', '고정폭'], ['custom', '내 글꼴']];
export const LANGS = [['ko', '한국어'], ['en', '영어'], ['ja', '일본어'], ['zh', '중국어']];
export const SAMPLES = {
    ko: '바닷바람이 창을 두드렸다. 소금 한 꼬집이면 충분해.',
    en: 'The quick brown fox jumps over the lazy dog. 1234567890',
    ja: '月夜に海の塩がきらめいた。あいうえお カキクケコ',
    zh: '月光下的海盐闪闪发光。你好，世界',
};
export const SLOT_FAMILY = { text: "'Salty Text'", dialogue: "'Salty Dialogue'", ui: "'Salty UI'", em: "'Salty Em'", strong: "'Salty Strong'", code: "'Salty Code'" };
/** 칸·언어별 가족 이름: 'Salty Text' / 'Salty Text EN' … (언어마다 가족을 따로 둬야 굵기 descriptor 가 달라도 글자별로 넘어감) */
export const langFamily = (slot, lang) => lang === 'ko' ? SLOT_FAMILY[slot] : `'${SLOT_FAMILY[slot].slice(1, -1)} ${lang.toUpperCase()}'`;

const GOOGLE = 'https://fonts.googleapis.com/css2?';

// ───────── 목록 ─────────
export function allFonts() {
    return [...CATALOG, ...getSettings().customFonts];
}

export function findFont(id) {
    return allFonts().find(f => f.id === id) || null;
}

/** 어떤 언어 칸에 보여줄 글꼴들 (내 글꼴은 모든 언어에 보임) */
export function fontsFor(lang) {
    return allFonts().filter(f => f.group === 'custom' || f.lang === lang || (lang === 'en' && f.lang === 'ko' && f.latin));
}

export function fontStack(font, lang = 'ko') {
    const family = font ? font.family : 'system-ui';
    const tail = lang === 'ko'
        ? (font?.group === 'serif' ? ["'Noto Serif KR'", 'serif'] : ["'Pretendard Variable'", "'Apple SD Gothic Neo'", "'Noto Sans KR'", 'sans-serif'])
        : (font?.group === 'serif' ? ['serif'] : ['sans-serif']);
    return [family, ...tail.filter(t => t !== family)].join(', ');
}

// ───────── unicode-range 계산 ─────────
const FULL = [[0, 0x10FFFF]];
export const SCRIPT_RANGES = {
    // 영문·숫자·라틴 확장·위첨자·통화·글자꼴 기호·합자
    latin: [[0x0000, 0x024F], [0x1E00, 0x1EFF], [0x2070, 0x209F], [0x20A0, 0x20CF], [0x2100, 0x214F], [0xFB00, 0xFB4F]],
    // 가나 (히라가나·가타카나·확장·반각)
    kana: [[0x3040, 0x30FF], [0x31F0, 0x31FF], [0xFF65, 0xFF9F], [0x1B000, 0x1B16F]],
    // 한자 (부수·통합 한자·확장·호환)
    han: [[0x2E80, 0x2FDF], [0x3005, 0x3007], [0x3021, 0x3029], [0x3038, 0x303B], [0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF], [0x20000, 0x2FA1F]],
    // 주음부호 (대만)
    bopomofo: [[0x3100, 0x312F], [0x31A0, 0x31BF]],
};

function normalize(list) {
    const sorted = list.filter(([a, b]) => b >= a).sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const [a, b] of sorted) {
        const last = out[out.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else out.push([a, b]);
    }
    return out;
}

export function union(...lists) {
    return normalize(lists.flat());
}

export function intersect(a, b) {
    const out = [];
    for (const [a0, a1] of normalize(a)) {
        for (const [b0, b1] of normalize(b)) {
            const lo = Math.max(a0, b0);
            const hi = Math.min(a1, b1);
            if (lo <= hi) out.push([lo, hi]);
        }
    }
    return normalize(out);
}

export function subtract(a, b) {
    let out = normalize(a);
    for (const [b0, b1] of normalize(b)) {
        const next = [];
        for (const [a0, a1] of out) {
            if (b1 < a0 || b0 > a1) { next.push([a0, a1]); continue; }
            if (a0 < b0) next.push([a0, b0 - 1]);
            if (b1 < a1) next.push([b1 + 1, a1]);
        }
        out = next;
    }
    return out;
}

/** 'U+AC00-D7A3, U+0-7F, U+30??' → [[a, b], ...] */
export function parseRange(text) {
    const out = [];
    for (const token of String(text).split(',')) {
        const t = token.trim().replace(/^u\+/i, '');
        if (!t) continue;
        if (t.includes('?')) {
            out.push([parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16)]);
        } else if (t.includes('-')) {
            const [a, b] = t.split('-');
            out.push([parseInt(a, 16), parseInt(b, 16)]);
        } else {
            const v = parseInt(t, 16);
            out.push([v, v]);
        }
    }
    return normalize(out.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)));
}

export function formatRange(list) {
    return normalize(list).map(([a, b]) => a === b ? `U+${a.toString(16).toUpperCase()}` : `U+${a.toString(16).toUpperCase()}-${b.toString(16).toUpperCase()}`).join(', ');
}

// ───────── 글꼴 CSS 가져와서 다시 쓰기 ─────────
const cssCache = new Map();

async function fetchCss(url) {
    if (cssCache.has(url)) return cssCache.get(url);
    const p = fetch(url, { mode: 'cors', credentials: 'omit' }).then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.text();
    });
    p.catch(() => cssCache.delete(url));
    cssCache.set(url, p);
    return p;
}

function absolute(u, base) {
    try { return new URL(u, base).href; } catch { return u; }
}

/** CSS 글 → [{ 'font-family', src, 'font-weight', 'font-style', 'unicode-range', ... }] (url 은 절대 주소로) */
export function parseFaces(cssText, baseUrl) {
    const faces = [];
    for (const m of cssText.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
        const body = m[1].replace(/url\(([^)]*)\)/g, (_, u) => `url(${u.replace(/;/g, '\u0001')})`);
        const d = {};
        for (const decl of body.split(';')) {
            const i = decl.indexOf(':');
            if (i < 0) continue;
            const k = decl.slice(0, i).trim().toLowerCase();
            const v = decl.slice(i + 1).trim().replace(/\u0001/g, ';');
            if (k && v) d[k] = v;
        }
        if (!d.src) continue;
        d.src = d.src.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_, q, u) => `url("${absolute(u, baseUrl)}")`);
        faces.push(d);
    }
    return faces;
}

const unquote = s => String(s || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();

// 4.5.7: fa 는 fonts-archive 한 줄 CSS 의 이름만 적은 것 — 469개가 전부 같은 꼴이라 주소를 반복하지 않는다
const FONTS_ARCHIVE = name => `https://cdn.jsdelivr.net/gh/fonts-archive/${name}/${name}.css`;

function sourceUrls(font) {
    if (font.fa) return [FONTS_ARCHIVE(font.fa)];
    if (font.css) return [].concat(font.css);
    if (font.google) return [`${GOOGLE}family=${font.google}&display=swap`];
    return [];
}

function fileFaces(font, family, ranges) {
    const files = font.files || (font.file ? [{ url: font.file, weight: null }] : []);
    const range = ranges ? `unicode-range:${formatRange(ranges)};` : '';
    return files.map(f => `@font-face{font-family:${family};${f.weight ? `font-weight:${f.weight};` : ''}${f.style ? `font-style:${f.style};` : ''}font-display:swap;src:url("${f.url}");${range}}`);
}

/** 글꼴 하나를 family 이름으로, ranges 범위만 맡도록 @font-face 로 다시 씀 */
async function facesFor(font, ranges, family) {
    if (!ranges.length) return [];
    if (font.file || font.files) return fileFaces(font, family, ranges);
    const urls = sourceUrls(font);
    if (!urls.length) return []; // 기기 기본 글꼴 등: 합치지 않음 (가족 목록 뒤쪽에서 받음)
    let faces = [];
    for (const url of urls) faces.push(...parseFaces(await fetchCss(url), url));
    const mine = faces.filter(f => unquote(f['font-family']) === unquote(font.family));
    if (mine.length) faces = mine;
    const out = [];
    for (const f of faces) {
        const orig = f['unicode-range'] ? parseRange(f['unicode-range']) : FULL;
        const r = intersect(orig, ranges);
        if (!r.length) continue;
        const desc = ['font-style', 'font-weight', 'font-stretch'].filter(k => f[k]).map(k => `${k}:${f[k]};`).join('');
        out.push(`@font-face{font-family:${family};${desc}font-display:swap;src:${f.src};unicode-range:${formatRange(r)}}`);
    }
    return out;
}

/** 어떤 글꼴이 어느 글자를 맡는지: { ko: ranges, en: ranges, ja: ranges, zh: ranges } */
export function assignRanges(set, hanja = 'auto') {
    const has = l => l !== 'ko' && set[l] && set[l] !== 'auto';
    const owner = { en: has('en') ? 'en' : 'ko', ja: has('ja') ? 'ja' : 'ko', zh: has('zh') ? 'zh' : 'ko' };
    let han = 'ko';
    if (hanja === 'auto') han = has('zh') ? 'zh' : (has('ja') ? 'ja' : 'ko');
    else if (has(hanja)) han = hanja;
    const r = { ko: [], en: [], ja: [], zh: [] };
    r[owner.en].push(...SCRIPT_RANGES.latin);
    r[owner.ja].push(...SCRIPT_RANGES.kana);
    r[owner.zh].push(...SCRIPT_RANGES.bopomofo);
    r[han].push(...SCRIPT_RANGES.han);
    const others = union(r.en, r.ja, r.zh);
    r.ko = subtract(FULL, others);
    for (const k of ['en', 'ja', 'zh']) r[k] = normalize(r[k]);
    return r;
}

// ───────── 빈 글리프 검사 ─────────
// fonts-archive 의 woff2 가운데는 KS 한자 자리에 '빈' 글리프가 든 것이 있다 (예: 완주누리체 — 같은 글꼴의 TTF 에는 그 글자가 아예 없다).
// 글자가 없으면 브라우저가 다음 글꼴로 넘기지만, 빈 글리프는 '있는 글자'라 그대로 그려서 화면에서 사라진다
// (일본어 *속마음* 의 첫 한자가 없어져 보였음). 글꼴을 받아 표본 글자를 캔버스에 그려 보고, 아무것도 안 그려지는 문자가
// 있으면 그 문자 범위는 이 글꼴이 맡지 않게 한다 (→ 가족 목록 뒤의 기기 글꼴이 그림).
const PROBE_SAMPLES = { han: '愛早美', kana: 'あア', latin: 'Ag' };
const blankCache = new Map();

function inkOf(family, ch) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return -1;
    g.font = `48px ${family}`;
    g.fillText(ch, 6, 52);
    const data = g.getImageData(0, 0, 64, 64).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) n++;
    return n;
}

/** 검사용으로 받을 src 하나 (기본 굵기 우선). 구글 글꼴은 조각(unicode-range)으로 나뉘어 있고 이런 문제가 없어 검사하지 않음 */
async function probeSource(font) {
    if (font.google || font.cors === false) return null;
    if (font.file || font.files) {
        const files = font.files || [{ url: font.file, weight: null }];
        const pick = files.find(f => !f.weight || String(f.weight) === '400') || files[0];
        return pick ? `url("${pick.url}")` : null;
    }
    let faces = [];
    for (const url of sourceUrls(font)) faces.push(...parseFaces(await fetchCss(url), url));
    const mine = faces.filter(f => unquote(f['font-family']) === unquote(font.family));
    if (mine.length) faces = mine;
    const regular = faces.filter(f => !f['font-style'] || f['font-style'] === 'normal');
    const pick = regular.find(f => !f['font-weight'] || /^(400|normal)$/.test(f['font-weight'])) || regular[0] || faces[0];
    return pick?.src || null;
}

/** 이 글꼴이 빈 글리프로 그리는 문자 종류: ['han', 'kana', 'latin'] 가운데 해당하는 것 */
export async function blankScripts(font) {
    if (!font || typeof document === 'undefined' || typeof FontFace === 'undefined') return [];
    if (blankCache.has(font.id)) return blankCache.get(font.id);
    const p = (async () => {
        const src = await probeSource(font);
        if (!src) return [];
        const family = `salty-probe-${font.id}`;
        const face = new FontFace(family, src);
        document.fonts.add(face);
        try {
            await face.load();
            const out = [];
            for (const [script, sample] of Object.entries(PROBE_SAMPLES)) {
                // 기기 글꼴로는 그려지는데 이 글꼴을 앞에 두면 안 그려짐 = 빈 글리프 (글자가 없으면 기기 글꼴로 넘어가 똑같이 그려짐)
                if ([...sample].some(ch => inkOf('serif', ch) > 0 && inkOf(`'${family}', serif`, ch) === 0)) out.push(script);
            }
            if (out.length) console.warn(`[Salty] ${font.label || font.id}: 빈 글리프 (${out.join(', ')}) — 그 글자는 기기 글꼴로 그림`);
            return out;
        } catch {
            return [];
        } finally {
            document.fonts.delete(face);
        }
    })();
    p.catch(() => blankCache.delete(font.id));
    blankCache.set(font.id, p);
    return p;
}

/** 한 칸의 font-family 값: 언어별 가족(따로 고른 것만) → 한국어 가족 → 한국어 글꼴 원래 이름(합치기 실패·기기 글꼴·범위 밖 글자 대비) */
export function slotStack(slot, set) {
    const ko = findFont(set.ko) || CATALOG[0];
    const langs = ['en', 'ja', 'zh'].filter(l => set[l] && set[l] !== 'auto' && findFont(set[l]));
    return [...langs.map(l => langFamily(slot, l)), langFamily(slot, 'ko'), fontStack(ko)].join(', ');
}

/**
 * 한 슬롯(본문/대사/메뉴/속마음/강조)의 글꼴 묶음 → { css, stack, failed }
 *  css: 합친 @font-face 들, stack: font-family 값, failed: 못 받아온 글꼴 id
 *  영어·일본어·중국어 글꼴을 못 받아오면 그 언어 글자는 한국어 글꼴에 돌려주고 한 번 다시 만듦.
 */
export async function buildComposite(slot, set, hanja, depth = 0) {
    set = { ...set };
    for (const l of ['en', 'ja', 'zh']) if (set[l] && set[l] !== 'auto' && !findFont(set[l])) set[l] = 'auto';
    const ranges = assignRanges(set, hanja);
    const ko = findFont(set.ko) || CATALOG[0];
    // 빈 글리프가 든 문자 범위는 그 글꼴에서 뺌 (검사가 먼저 받아 두므로 아래 @font-face 는 캐시에서 읽음)
    for (const lang of ['ko', 'en', 'ja', 'zh']) {
        const font = lang === 'ko' ? ko : (set[lang] && set[lang] !== 'auto' ? findFont(set[lang]) : null);
        if (!font || !ranges[lang].length) continue;
        // 2.9.2: 검사가 글꼴 CSS 를 못 받아오면(폰이 막 깨어나 인터넷이 늦게 붙음) 예외가 여기서 새어 나가 이 칸 전체가 빠지고,
        // failed 도 비어 다시 시도조차 안 했다 → 검사는 건너뛰고 아래 facesFor 가 실패를 failed 로 남기게 한다 (다음 적용 때 검사도 다시)
        const blank = await blankScripts(font).catch(() => []);
        if (blank.length) ranges[lang] = subtract(ranges[lang], union(...blank.map(script => SCRIPT_RANGES[script])));
    }
    const parts = [];
    const failed = [];
    const failedLangs = [];
    const jobs = [];
    for (const lang of ['ko', 'en', 'ja', 'zh']) {
        const id = lang === 'ko' ? ko.id : set[lang];
        if (!id || id === 'auto' || !ranges[lang].length) continue;
        const font = findFont(id);
        if (!font) continue;
        const fail = () => { failed.push(font.id); if (lang === 'ko') loadFont(font); else failedLangs.push(lang); };
        if (font.cors === false) { fail(); continue; } // CSS 를 직접 못 읽는 주소: 통째로만
        jobs.push(facesFor(font, ranges[lang], langFamily(slot, lang)).then(faces => parts.push(...faces), fail));
    }
    await Promise.all(jobs);
    if (failedLangs.length && depth === 0) {
        const again = await buildComposite(slot, { ...set, ...Object.fromEntries(failedLangs.map(l => [l, 'auto'])) }, hanja, 1);
        return { ...again, failed: [...new Set([...failed, ...again.failed])] };
    }
    return { css: parts.join('\n'), stack: slotStack(slot, set), failed };
}

// ───────── 링크·미리보기 ─────────
function addLink(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

/**
 * 글꼴을 원래 가족 이름 그대로 통째로 불러오기 (합치기 실패 시, 고르기 줄 표시용)
 * <style>·<link> 가 아니라 FontFace 로 등록: 글꼴을 고를 때마다 합친 글꼴 CSS 가 바뀌면 브라우저가 CSS 로 넣은 @font-face 를
 * 전부 새로 만들어서, 받아 둔 미리보기 글꼴도 다시 읽는 동안 대체 글꼴로 보임 (폰에서 큰 글꼴일수록 오래). FontFace 는 그대로 남음
 */
const loadedFonts = new Set();
export function loadFont(font) {
    if (!font || loadedFonts.has(font.id)) return;
    loadedFonts.add(font.id);
    if (font.file || font.files) {
        const files = font.files || [{ url: font.file, weight: null }];
        addFaces(files.map(f => ({ 'font-family': font.family, src: `url("${f.url}")`, 'font-weight': f.weight, 'font-style': f.style })));
        return;
    }
    sourceUrls(font).forEach((url, i) => {
        const link = () => addLink(`salty-font-${font.id}-${i}`, url);
        if (font.cors === false) return link(); // CSS 를 직접 못 읽는 주소: 링크로만
        fetchCss(url).then((css) => {
            const faces = parseFaces(css, url);
            if (faces.length) addFaces(faces);
            else link();
        }, link);
    });
}

// CSS 에서 읽은 @font-face 들 → FontFace (실제로 쓰일 때 받음)
function addFaces(faces) {
    for (const d of faces) {
        try {
            document.fonts.add(new FontFace(String(d['font-family']).trim().replace(/^['"]|['"]$/g, ''), d.src, {
                weight: String(d['font-weight'] || 'normal'),
                style: d['font-style'] || 'normal',
                stretch: d['font-stretch'] || 'normal',
                unicodeRange: d['unicode-range'] || 'U+0-10FFFF',
                display: 'swap',
            }));
        } catch {
            // 못 읽는 한 줄은 건너뜀
        }
    }
}

const previewed = new Set();
let previewQueue = [];
let previewTimer = null;

function uniqueChars(text) {
    return [...new Set([...text])].join('');
}

// 미리보기로 받을 굵기 하나: 기본(400)이 있으면 이름만, 없으면 브라우저가 400 자리에 쓰는 굵기 (400~500 → 400 아래 → 500 위)
// (여러 가족을 한 번에 달라고 할 때 400 이 없는 가족(예: Sunflower 300·500·700)은 구글이 말없이 빼서 대체 글꼴로 보였음)
function previewFamily(google) {
    const [name, axes = ''] = String(google).split(':');
    const [tags = '', values = ''] = axes.split('@');
    const keys = tags.split(',');
    const wi = keys.indexOf('wght');
    if (wi < 0 || !values) return name;
    const ii = keys.indexOf('ital');
    const weights = values.split(';').map(t => t.split(',')).filter(t => ii < 0 || t[ii] === '0').map(t => t[wi].split('..').map(Number));
    if (!weights.length || weights.some(([lo, hi = lo]) => lo <= 400 && 400 <= hi)) return name;
    const rank = w => (w > 400 && w <= 500 ? w : w < 400 ? 1000 - w : 2000 + w);
    const near = weights.map(([lo, hi = lo]) => Math.min(hi, Math.max(lo, 400))).sort((a, b) => rank(a) - rank(b))[0];
    return `${name}:wght@${near}`;
}

/**
 * 미리보기 조각 전용 가족 이름. 보이는 글자만 담은 조각(굵기 하나)을 글꼴의 진짜 이름으로 등록하면,
 * 합치기를 못 해 진짜 이름으로 넘어갈 때 그 굵기(보통 400)로 쓰는 글자가 온전한 가변 글꼴 대신 이 조각을 골라
 * 조각에 없는 글자는 전부 기기 글꼴로 보였음 (함렛: 본문 350 은 함렛, 대사 400 은 기기 명조)
 */
export const previewName = font => `Salty Preview ${String(font.id).replace(/[^\w-]/g, '_')}`;

/** 고르기 목록 줄의 font-family: 미리보기 조각 → 원래 글꼴 묶음 */
export function previewStack(font, lang = 'ko') {
    return font?.google ? `'${previewName(font)}', ${fontStack(font, lang)}` : fontStack(font, lang);
}

function flushPreviews() {
    previewTimer = null;
    const batch = previewQueue.filter(f => !previewed.has(f.id));
    previewQueue = [];
    if (!batch.length) return;
    batch.forEach(f => previewed.add(f.id));
    // 구글 폰트는 여러 가족을 한 번에, 보이는 글자만 → 미리보기 이름으로 바꿔 FontFace 로 (<link> 는 진짜 이름으로 등록돼서 안 씀)
    const google = batch.filter(f => f.google);
    for (let i = 0; i < google.length; i += 24) {
        const chunk = google.slice(i, i + 24);
        const text = uniqueChars(chunk.map(f => f.label + (f.native || '') + SAMPLES[f.lang || 'ko']).join(''));
        const families = chunk.map(f => `family=${previewFamily(f.google)}`).join('&');
        const url = `${GOOGLE}${families}&text=${encodeURIComponent(text)}&display=swap`;
        const byName = new Map(chunk.map(f => [unquote(f.family), f]));
        fetchCss(url).then((css) => {
            cssCache.delete(url); // 미리보기 주소는 한 번만 씀
            addFaces(parseFaces(css, url).flatMap((d) => {
                const f = byName.get(unquote(d['font-family']));
                return f ? [{ ...d, 'font-family': previewName(f) }] : [];
            }));
            chunk.forEach(f => settlePreview(f, previewName(f)));
        }, () => chunk.forEach(f => previewed.delete(f.id))); // 못 받으면 다음에 보일 때 다시
    }
    batch.filter(f => !f.google).forEach((f) => { loadFont(f); settlePreview(f, unquote(f.family)); });
}

// ───────── 미리보기 글꼴이 준비됐는지 (2.7.7) ─────────
// 폰에서 글꼴을 받는 몇 초 동안 목록의 표본 줄이 통째로 비어 보였다 (사용자: "기다리니까 나왔다").
// 그래서 표본 줄은 처음엔 기기 글꼴로 그리고(panel.js — data-font 에 진짜 묶음을 적어 둠), 여기서 파일을 다 받은 것을 확인한 뒤
// salty:font-ready 로 알려 그때 글꼴을 바꾼다. 받았는데도 표본 글자가 안 그려지면(기기 · 브라우저의 그리기 문제) salty:font-blank —
// 그 줄은 "이 기기에서 안 그려짐" 표시를 달고 기기 글꼴로 남는다
const PREVIEW_PROBE = { ko: '바람', ja: 'あア', zh: '愛早', en: 'Ag' };
const previewReady = new Set();
const previewBlank = new Set();
export const isPreviewReady = id => previewReady.has(id);
export const isPreviewBlank = id => previewBlank.has(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function settlePreview(font, family) {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    const sample = PREVIEW_PROBE[font.lang] || PREVIEW_PROBE.ko;
    let faces = [];
    try {
        // loadFont 는 CSS 를 받은 뒤에야 FontFace 를 등록한다 — 가족이 생길 때까지 잠깐 기다림 (최대 10초)
        for (let i = 0; i < 50 && ![...document.fonts].some(f => unquote(f.family) === family); i++) await sleep(200);
        faces = await document.fonts.load(`16px "${family}"`, sample);
    } catch { /* 못 받음 — 아래에서 준비된 것으로 치고 기기 글꼴 그대로 */ }
    const blank = faces.length > 0 && [...sample].some(ch => inkOf('serif', ch) > 0 && inkOf(`"${family}", serif`, ch) === 0);
    if (blank) {
        previewBlank.add(font.id);
        console.warn(`[Salty] ${font.label || font.id}: 표본 글자가 이 기기에서 안 그려짐 — 목록에 표시`);
        document.dispatchEvent(new CustomEvent('salty:font-blank', { detail: font.id }));
        return;
    }
    previewReady.add(font.id);
    document.dispatchEvent(new CustomEvent('salty:font-ready', { detail: font.id }));
}

/** 고르기 목록에 보이는 글꼴의 미리보기 파일 요청 (모아서 한 번에) */
export function queuePreview(font) {
    if (!font || previewed.has(font.id)) return;
    previewQueue.push(font);
    if (!previewTimer) previewTimer = setTimeout(flushPreviews, 120);
}

// ───────── 내 글꼴 추가 ─────────
function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(Date.now());
}

function upsert(font) {
    const settings = getSettings();
    settings.customFonts = settings.customFonts.filter(f => f.id !== font.id);
    settings.customFonts.push(font);
    saveSettings();
}

export async function addGoogleFont(name) {
    const family = String(name || '').trim().replace(/\s+/g, ' ').replace(/['"]/g, '');
    if (!family) throw new Error('글꼴 이름을 적어 주세요');
    const param = family.replace(/ /g, '+');
    const res = await fetch(`${GOOGLE}family=${param}&text=${encodeURIComponent('가A')}`);
    if (!res.ok) throw new Error(`구글 폰트에서 "${family}"를 못 찾았어요. 이름을 fonts.google.com 에 적힌 그대로 적어 주세요.`);
    // 가변 굵기면 전체 범위로
    let google = `${param}:wght@100..900`;
    const v = await fetch(`${GOOGLE}family=${google}&text=${encodeURIComponent('가A')}`);
    if (!v.ok) google = `${param}:wght@400;700`;
    const w = await fetch(`${GOOGLE}family=${google}&text=${encodeURIComponent('가A')}`);
    if (!w.ok) google = param;
    const font = { id: `g-${slug(family)}`, label: family, family: `'${family}'`, group: 'custom', google };
    upsert(font);
    return font;
}

export async function addCssFont(url, name) {
    const href = String(url || '').trim();
    const family = String(name || '').trim().replace(/['"]/g, '');
    if (!/^https:\/\//i.test(href)) throw new Error('https:// 로 시작하는 CSS 주소를 적어 주세요');
    if (!family) throw new Error('CSS 안의 font-family 이름을 적어 주세요');
    const font = { id: `c-${slug(family)}`, label: family, family: `'${family}'`, group: 'custom', css: href };
    let res;
    try {
        res = await fetch(href, { mode: 'cors' });
    } catch {
        // CORS 없는 서버: 링크로만 쓸 수 있음 (언어별 나누기 안 됨)
        res = await fetch(href, { mode: 'no-cors' }).catch(() => { throw new Error('CSS 주소에 연결하지 못했어요'); });
    }
    if (res.type === 'opaque') {
        font.cors = false;
    } else {
        if (!res.ok) throw new Error(`CSS를 불러오지 못했어요 (${res.status})`);
        const faces = parseFaces(await res.text(), href);
        const names = [...new Set(faces.map(x => unquote(x['font-family'])))];
        if (faces.length && !names.includes(family.toLowerCase())) throw new Error(`CSS 안에 "${family}" 글꼴이 없어요. 있는 이름: ${names.join(', ')}`);
    }
    upsert(font);
    return font;
}

function readBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/** 글꼴 파일을 실리태번 user/files 에 올리고 등록 (같은 서버면 다른 기기에서도 보임) */
export async function uploadFont(file) {
    const ext = file.name.match(/\.(woff2|woff|ttf|otf)$/i)?.[1]?.toLowerCase();
    if (!ext) throw new Error('woff2, woff, ttf, otf 파일만 올릴 수 있어요');
    if (file.size > 30 * 1024 * 1024) throw new Error('30MB보다 큰 글꼴은 못 올려요');
    const stamp = Date.now();
    const name = `salty-font-${stamp}.${ext}`;
    const ctx = SillyTavern.getContext();
    const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ name, data: await readBase64(file) }),
    });
    if (!res.ok) throw new Error(`올리기 실패: ${await res.text()}`);
    const { path } = await res.json();
    const font = {
        id: `f-${stamp}`,
        label: file.name.replace(/\.[^.]+$/, ''),
        family: `'Salty f${stamp}'`,
        group: 'custom',
        file: `/${String(path).replace(/^\/+/, '')}`,
    };
    upsert(font);
    return font;
}

export async function removeCustomFont(id) {
    const settings = getSettings();
    const font = settings.customFonts.find(f => f.id === id);
    settings.customFonts = settings.customFonts.filter(f => f.id !== id);
    for (const slot of FONT_SLOTS) {
        const set = settings.fonts[slot];
        if (!set || set === 'same') continue;
        for (const lang of ['ko', 'en', 'ja', 'zh']) {
            if (set[lang] === id) set[lang] = lang === 'ko' ? 'pretendard' : 'auto';
        }
    }
    saveSettings();
    if (font?.file) {
        try {
            await fetch('/api/files/delete', {
                method: 'POST',
                headers: SillyTavern.getContext().getRequestHeaders(),
                body: JSON.stringify({ path: font.file.replace(/^\/+/, '') }),
            });
        } catch {
            // 서버 파일은 남아도 문제 없음
        }
    }
}
