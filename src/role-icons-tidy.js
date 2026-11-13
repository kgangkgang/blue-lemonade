// 1.1.5 시작 묶음 다이어트 — 단추 아이콘(role-icons-core.js)에서 「설정을 읽을 때마다 하는 정리」만 떼어 낸 가벼운 조각이에요.
//   settings.js 가 시작할 때 roleIcons · pickedIcons 를 정리하느라 역할 표(선택자) · CSS 만들기 · 그림 파일 받기까지 시작 묶음에 끌고 왔어요.
//   여기에는 저장값 검사 · 고른 단추 열쇠 · SVG 정리만 두고, 나머지(역할 표 · CSS · 그림 파일)는 role-icons-core.js 에 남아 쓸 때 받아요.
//   role-icons-core.js 가 여기 것을 그대로 다시 내보내니 다른 모듈은 예전 이름 그대로 써요. 시험: tools/tests/role-icons.mjs

export const ROLE_ICON_MAX_BYTES = 64 * 1024;      // 올리는 그림 파일 한도
export const ROLE_ICON_MAX_DATA = 90000;           // 저장 문자열 한도 (64KB 를 base64 로 바꾸면 약 87,400자)
export const ROLE_TEXT_MAX = 2;                    // 글자 · 이모지 몇 개까지 (글자 묶음 기준)
export const PICK_MAX = 40;                        // 화면에서 고른 단추 몇 개까지
export const PICK_LABEL_MAX = 40;                  // 고른 단추 이름 길이
// 역할 id — role-icons-core.js 의 ROLES 와 같은 순서 · 같은 id(시험이 둘을 맞춰 봐요). 역할을 더하면 두 곳 다
export const ROLE_IDS = ['close', 'back', 'prev', 'next', 'undo', 'redo', 'reset', 'search', 'fullscreen', 'fullscreen-exit', 'menu', 'more', 'plus', 'check',
    'api', 'preset', 'format', 'worldinfo', 'usersettings', 'background', 'extensions', 'persona', 'characters', 'options', 'wand', 'send', 'continue', 'impersonate', 'stop',
    'direction', 'translate-input'];
const ROLE_SET = new Set(ROLE_IDS);

// ───────── 화면에서 고른 단추(pickedIcons) ─────────
// 열쇠: '<어디>|<무엇으로>|<값>' — 어디 = 안정된 id 를 가진 가장 가까운 조상('#extensionsMenu' · '#chat' …, 없으면 ''),
//   무엇으로 = id(단추 자신의 id) · data(data-이름=값) · title(title 또는 aria-label) · cls(메시지 단추처럼 되풀이되는 것의 클래스) · text(단추 글자) · nth(어디 안 몇 번째 단추)
const PICK_BY = new Set(['id', 'data', 'title', 'cls', 'text', 'nth']);
const PICK_WHERE_RE = /^(#[A-Za-z_][\w-]*(\s+#[A-Za-z_][\w-]*)*)?$/;
const PICK_BAD = /[\p{Cc}\p{Cf}\u2028\u2029<>"'\\]/u;
export function parsePickKey(key) {
    if (typeof key !== 'string' || key.length > 240) return null;
    const i = key.indexOf('|'), j = i < 0 ? -1 : key.indexOf('|', i + 1);
    if (i < 0 || j < 0) return null;
    const where = key.slice(0, i), by = key.slice(i + 1, j), value = key.slice(j + 1);
    if (!PICK_BY.has(by) || !PICK_WHERE_RE.test(where) || !value || value.length > 160 || PICK_BAD.test(value)) return null;
    if ((by === 'id' || by === 'cls') && !/^[A-Za-z_][\w-]*$/.test(value)) return null;
    if (by === 'data' && !/^[a-z][a-z0-9-]*=[^\n]{1,120}$/.test(value)) return null;
    if (by === 'nth' && !/^\d{1,3}$/.test(value)) return null;
    return { where, by, value };
}
/** 열쇠 → 설정 칸 이름(짧은 해시, 경로에 쓸 수 있게 글자 · 숫자만). 같은 열쇠는 늘 같은 이름 */
export function pickSlug(key) {
    let h = 0x811c9dc5;
    for (const ch of key) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'p' + h.toString(36).padStart(7, '0');
}
const ICON_HINT_RE = /^(fa-[a-z0-9-]+)( fa-[a-z0-9-]+){0,3}$/;
/** 고른 단추 한 칸 정리 — 올바르면 { key, label, icon?, value? } 아니면 null */
export function tidyPick(slug, entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const key = entry.key;
    if (!parsePickKey(key) || pickSlug(key) !== slug) return null;
    const label = typeof entry.label === 'string' ? entry.label.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, PICK_LABEL_MAX) : '';
    const out = { key, label: label && !PICK_BAD.test(label) ? label : '단추' };
    if (typeof entry.icon === 'string' && ICON_HINT_RE.test(entry.icon)) out.icon = entry.icon;
    if (typeof entry.value === 'string' && entry.value && parseRoleIcon(entry.value)) out.value = entry.value;
    return out;
}
/** 설정 pickedIcons 정리 — 올바른 칸만, 40개까지. 그대로면 같은 객체 */
export function tidyPickedIcons(map) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
    const keys = Object.keys(map);
    const same = keys.length <= PICK_MAX && keys.every((k) => {
        const e = map[k], t = tidyPick(k, e);
        return t && e.key === t.key && e.label === t.label && e.icon === t.icon && e.value === t.value && Object.keys(e).every(f => ['key', 'label', 'icon', 'value'].includes(f));
    });
    if (same) return map;
    const out = {};
    for (const k of keys) { const t = tidyPick(k, map[k]); if (t) out[k] = t; if (Object.keys(out).length >= PICK_MAX) break; }
    return out;
}

// ───────── 저장값 ─────────
const FA_RE = /^fa:([sb]):([a-z0-9]+(?:-[a-z0-9]+)*):([0-9a-f]{2,5})$/;
const IMG_RE = /^im:data:image\/(png|webp|svg\+xml);base64,([A-Za-z0-9+/]+={0,2})$/;
// 제어 문자 · 줄바꿈 · 양방향 제어 · 따옴표 · 역슬래시 · 꺾쇠는 글자로 받지 않는다 (CSS 에는 어차피 16진 이스케이프로 넣는다)
const BAD_TEXT = /[\p{Cc}\p{Cf}\u2028\u2029"'\\<>]/u;
const ZWJ_OK = /[\u200d\ufe0f\ufe0e\u20e3]/gu;     // 이모지 묶음에 쓰는 보이지 않는 글자는 허용

export function graphemes(text) {
    const Seg = globalThis.Intl?.Segmenter;
    if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(text)].map(s => s.segment);
    return Array.from(text);
}
/** 글자 · 이모지 칸: 앞뒤 공백을 걷고 1~2 묶음이면 그 글자, 아니면 '' */
export function cleanRoleText(raw) {
    const text = String(raw ?? '').normalize('NFC').trim();
    if (!text || text.length > 32) return '';
    if (BAD_TEXT.test(text.replace(ZWJ_OK, ''))) return '';
    const parts = graphemes(text);
    return parts.length >= 1 && parts.length <= ROLE_TEXT_MAX ? text : '';
}

// getSettings() 가 자주 불리므로(마이크로태스크마다) 같은 값 문자열은 한 번만 검사한다 — SVG 다시 정리가 가장 무겁다
const parsedCache = new Map();
/** 저장값 하나 → { kind, … } 또는 null (모르는 모양 · 너무 큼 · 위험한 SVG) */
export function parseRoleIcon(value) {
    if (typeof value !== 'string' || value.length > ROLE_ICON_MAX_DATA + 8) return null;
    if (parsedCache.has(value)) return parsedCache.get(value);
    const result = parseUncached(value);
    if (parsedCache.size >= 64) parsedCache.delete(parsedCache.keys().next().value);
    parsedCache.set(value, result);
    return result;
}
function parseUncached(value) {
    let m = FA_RE.exec(value);
    if (m) return { kind: 'fa', family: m[1] === 'b' ? 'brands' : 'solid', name: m[2], code: m[3] };
    if (value.startsWith('tx:')) { const text = cleanRoleText(value.slice(3)); return text && text === value.slice(3) ? { kind: 'text', text } : null; }
    m = IMG_RE.exec(value);
    if (m) {
        if (m[1] !== 'svg+xml') return { kind: 'image', mime: `image/${m[1]}`, url: value.slice(3) };
        // SVG 는 불러올 때마다 다시 정리해 본다 — 가져온 설정 파일(남이 만든 것일 수 있음)에 스크립트가 숨어 있으면 버린다
        const text = decodeBase64Text(m[2]);
        const clean = text == null ? null : sanitizeSvg(text);
        if (!clean || clean !== text) return null;
        return { kind: 'image', mime: 'image/svg+xml', url: value.slice(3) };
    }
    return null;
}
export const faValue = (family, name, code) => `fa:${family === 'brands' ? 'b' : 's'}:${name}:${code}`;
export const textValue = text => { const t = cleanRoleText(text); return t ? `tx:${t}` : ''; };

/** 설정 roleIcons 정리 — 아는 역할 · 올바른 값만 남긴다. 그대로면 같은 객체 */
export function tidyRoleIcons(map) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
    const keys = Object.keys(map);
    if (keys.every(k => ROLE_SET.has(k) && parseRoleIcon(map[k]))) return map;
    const out = {};
    for (const k of keys) if (ROLE_SET.has(k) && parseRoleIcon(map[k])) out[k] = map[k];
    return out;
}


const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let out = '';
    for (let i = 0; i < b.length; i += 3) {
        const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
        out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
    }
    return out;
}
function base64ToBytes(text) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4) return null;
    const clean = text.replace(/=+$/, '');
    const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let bits = 0, acc = 0, j = 0;
    for (const ch of clean) { acc = (acc << 6) | B64.indexOf(ch); bits += 6; if (bits >= 8) { bits -= 8; out[j++] = (acc >> bits) & 255; } }
    return out;
}
function decodeBase64Text(text) {
    const bytes = base64ToBytes(text);
    if (!bytes) return null;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

// ───────── SVG 정리 ─────────
// 원문을 고쳐 쓰지 않고, 읽어 낸 요소 · 속성 가운데 허락한 것만으로 새 SVG 를 쓴다(그래서 빠뜨린 위험 모양이 그대로 새지 않는다).
// 빼는 것: script · style · foreignObject · image · a · text · use 의 바깥 참조 · on* 속성 · url(바깥) · javascript: · 엔티티 선언 · 처리 지시문
const SVG_ELEMENTS = new Map(['svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'symbol', 'use']
    .map(n => [n.toLowerCase(), n]));
const SVG_ATTRS = new Map(['id', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'd', 'points', 'pathLength',
    'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
    'opacity', 'transform', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'clip-path', 'clipPathUnits', 'mask', 'maskUnits', 'maskContentUnits',
    'preserveAspectRatio', 'display', 'visibility', 'color', 'href', 'xlink:href', 'style', 'vector-effect', 'shape-rendering', 'paint-order'].map(n => [n.toLowerCase(), n]));
const STYLE_PROPS = new Set(['fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-opacity', 'opacity', 'stop-color', 'stop-opacity', 'display', 'visibility', 'color', 'clip-path', 'mask', 'vector-effect', 'shape-rendering', 'paint-order', 'mix-blend-mode']);
const DROP_WITH_CONTENT = true; // 모르는 요소는 안쪽까지 통째로 버린다 (script 안 글자 · foreignObject 안 HTML)

const decodeEntities = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') { const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k];
});
const escAttr = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 값 하나가 안전한가 — 꺾쇠 · 제어 문자 · 스크립트 주소 · data: · 역슬래시 이스케이프 없음, url( ) 은 같은 문서 안 #id 만 (그라데이션 · 잘라 내기)
function okValue(v) {
    if (!v || v.length > 20000) return false;
    if (/[<>]|\p{Cc}/u.test(v.replace(/[\t\n\r]/g, ' '))) return false;
    if (/javascript:|vbscript:|data:|expression\s*\(|@import|\\/i.test(v)) return false;
    const urls = v.match(/url\s*\(/gi) || [];
    return !urls.length || urls.length === (v.match(/url\(\s*#[A-Za-z_][\w.-]*\s*\)/g) || []).length;
}
function safeValue(name, value) {
    const v = value.trim();
    if (name === 'style') {   // 선언마다 따로: 허락한 속성 · 안전한 값만 남긴다
        const decls = [];
        for (const part of v.split(';')) {
            const i = part.indexOf(':');
            if (i < 0) continue;
            const prop = part.slice(0, i).trim().toLowerCase(), val = part.slice(i + 1).trim();
            if (STYLE_PROPS.has(prop) && !/[{}]/.test(val) && okValue(val)) decls.push(`${prop}:${val}`);
        }
        return decls.length ? decls.join(';') : null;
    }
    if (!okValue(v)) return null;
    if (name === 'href' || name === 'xlink:href') return /^#[A-Za-z_][\w.-]*$/.test(v) ? v : null;
    return v;
}

/** SVG 글 → 정리한 SVG 글 (못 읽거나 그릴 모양이 없으면 null) */
export function sanitizeSvg(input) {
    if (typeof input !== 'string' || input.length > ROLE_ICON_MAX_BYTES * 2) return null;
    let s = input.replace(/^\ufeff/, '');
    if (/<!ENTITY|<!\[CDATA\[/i.test(s)) return null;               // 엔티티 · CDATA 는 받지 않는다 (부풀리기 · 숨기기)
    s = s.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
    if (/<\?|<!--|<!/.test(s)) return null;
    const out = [];
    const stack = [];        // { name, keep }
    let dropDepth = 0, sawRoot = false, shapes = 0, i = 0;
    const tagRe = /<\s*(\/)?\s*([A-Za-z][\w:.-]*)((?:\s+[A-Za-z_:][\w:.-]*\s*(?:=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/)?\s*>/y;
    while (i < s.length) {
        const lt = s.indexOf('<', i);
        if (lt < 0) { if (s.slice(i).trim() && !stack.length) return null; break; }
        // 요소 사이 글자(공백 아닌 것)는 버린다 — text 요소를 안 받으니 그릴 글자도 없다
        tagRe.lastIndex = lt;
        const m = tagRe.exec(s);
        if (!m) return null;
        i = tagRe.lastIndex;
        const [, closing, rawName, rawAttrs, selfClose] = m;
        const lower = rawName.toLowerCase().replace(/^svg:/, '');
        if (closing) {
            const top = stack.pop();
            if (!top || top.lower !== lower) return null;
            if (!top.keep) { if (dropDepth) dropDepth--; continue; }
            if (!dropDepth) out.push(`</${top.name}>`);
            continue;
        }
        if (!sawRoot) { if (lower !== 'svg') return null; sawRoot = true; }
        else if (!stack.length) return null;                        // 뿌리 밖 두 번째 요소
        const known = SVG_ELEMENTS.get(lower);
        const keep = !!known && !dropDepth;
        if (!keep) { if (!selfClose) { stack.push({ lower, name: rawName, keep: false }); if (DROP_WITH_CONTENT) dropDepth++; } continue; }
        const attrs = [];
        const seen = new Set();
        for (const a of rawAttrs.matchAll(/([A-Za-z_:][\w:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
            const key = a[1].toLowerCase();
            const name = SVG_ATTRS.get(key);
            if (!name || seen.has(name)) continue;                  // on* · 모르는 속성 · 겹친 속성은 버린다
            const value = safeValue(key, decodeEntities(a[2] ?? a[3] ?? a[4] ?? ''));
            if (value == null) continue;
            if (lower === 'use' && name !== 'href' && name !== 'xlink:href' && !['x', 'y', 'width', 'height', 'transform', 'fill', 'stroke', 'opacity', 'style'].includes(name)) continue;
            seen.add(name);
            attrs.push(` ${name === 'xlink:href' ? 'href' : name}="${escAttr(value)}"`);
        }
        if (lower === 'use' && !attrs.some(a => a.startsWith(' href='))) { if (!selfClose) { stack.push({ lower, name: known, keep: false }); dropDepth++; } continue; }
        if (lower === 'svg' && !stack.length) {
            const get = n => attrs.find(a => a.startsWith(` ${n}=`))?.match(/="([^"]*)"/)?.[1];
            if (!get('viewBox')) {
                const w = parseFloat(get('width')), h = parseFloat(get('height'));
                if (w > 0 && h > 0) attrs.push(` viewBox="0 0 ${w} ${h}"`);
            }
            attrs.unshift(' xmlns="http://www.w3.org/2000/svg"');
        }
        if (['path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'use'].includes(lower)) shapes++;
        out.push(`<${known}${attrs.join('')}${selfClose ? '/>' : '>'}`);
        if (!selfClose) stack.push({ lower, name: known, keep: true });
    }
    if (stack.length || !sawRoot || !shapes) return null;
    return out.join('');
}
