// 7.9.3 단추 아이콘 바꾸기 — 같은 역할 단추(닫기 · 되돌리기 · 찾기 …)의 아이콘을 역할마다 하나로 바꾼다.
//
// 이 파일은 화면(DOM) 없이 도는 부분만: 역할 목록 · 저장값 검사 · SVG 정리 · 그림 파일 확인 · CSS 만들기.
// 화면에 거는 일은 role-icons.js, 설정 창은 role-icons-ui.js. 시험: tools/tests/role-icons.mjs
//
// 저장: 설정 roleIcons = { <역할 id>: 값 문자열 } — 바꾼 역할만 담는다(비어 있으면 아무 CSS 도 안 만든다 = 화면 그대로).
//   'fa:s:<이름>:<글자번호>'   Font Awesome 실선(s) · 브랜드(b) — 실리태번이 싣는 글꼴 그대로, 글자 번호는 16진수만
//   'tx:<글자>'               이모지 · 글자 한두 개
//   'im:data:image/…;base64,…' 내 그림(PNG · WebP · 정리한 SVG), 파일 64KB 까지 — 원래 색 그대로
// 한 역할을 바꾸면 그 역할의 단추가 테마 곳곳(설정 창 머리 도구 줄 · 애드온 창 · 번역 창 …)에서 한꺼번에 바뀐다:
//   아래 ROLES 의 선택자가 「그 역할」 한 곳이다. 크기 · 누르는 칸 · 자리 · 이름(aria-label)은 단추 그대로 두고 그림만 바꾼다.

export const ROLE_ICON_MAX_BYTES = 64 * 1024;      // 올리는 그림 파일 한도
export const ROLE_ICON_MAX_DATA = 90000;           // 저장 문자열 한도 (64KB 를 base64 로 바꾸면 약 87,400자)
export const ROLE_TEXT_MAX = 2;                    // 글자 · 이모지 몇 개까지 (글자 묶음 기준)

// 테마가 그리는 창들 — 「이름표(aria-label)로 찾는」 단추는 이 안에서만 (다른 확장 · 실리태번 단추는 건드리지 않는다)
const ROOTS = ':is(.salty-panel, .bl-tool-dialog, .bl-assist, .bl-credits-dialog, .bl-notice-dialog, .bl-fruit-icon-picker, .bl-fruit-option-help, .bl-ft-dialog, .bl-notes-dialog, .bl-sticky, .bl-translator-dialog, .bl-assets-dialog, .bl-direction-dialog, .bl-mermaid-dialog, .bl-pbind-dialog, .bl-capture-dialog, .bl-ctsi-dialog, .bl-dialogue-tildes, .bl-chat-graph, .bl-first-run, .bl-embedded-settings, .blpt-dialog, .blzi-dialog, .llmt-check-board, .llmt-selection, .pt-help-dialog, #pt-panel, #cg-panel, .cg-root, .cg-viewer, .eh-root, .po-dialog, .rl-root, .pa-hub)';
const labels = (...names) => names.map(n => `[aria-label="${n}"]`).join(', ');
const inRoots = (...names) => `${ROOTS} :is(button, summary, [role="button"]):is(${labels(...names)})`;
// 애드온이 실리태번 팝업으로 뜰 때 머리의 × (css/85-addon-unify.css 와 같은 선택자)
const ST_POPUP_CLOSE = 'dialog.popup:has(> .popup-body > .popup-content > :is(#lv_settings, .bwr_settings, #model_register_settings, #model-switch-settings, .po-dialog, .pa-hub, .rl-root, #regex-link-settings)) > .popup-button-close';
const PREVIEW = id => `.bl-roleicon-preview[data-bl-role="${id}"]`;

const svg = (sw, d) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='black' stroke-width='${sw}' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`;

/**
 * 역할 14개 (design-system components/icon-button.css 의 .ds-tool[data-role] 와 같은 id · 같은 기본 선 그림).
 *   swap  : 단추 자체를 칸으로 — 단추 안 글자 · 아이콘은 투명하게 두고(크기 그대로) 그 가운데에 새 그림
 *   inline: 글자와 같이 있는 단추(「설정 선택 ≡ 이름」) — 안의 선 그림 하나만 새 그림으로
 */
export const ROLES = [
    { id: 'close', label: '닫기', glyph: svg(1.8, 'M3 3l14 14M17 3 3 17'),
      swap: ['.salty-panel .bl-settings-close', '.salty-panel .bl-editor-directory-head > [data-act="editor-catalog-close"]', '.bl-credits-dialog > header > button', '.pt-help-dialog > header > button',
          `${ROOTS} :is(header, [class*="head"], [class*="top"]) :is(button, [role="button"]):is([aria-label="닫기"], [aria-label$=" 닫기"])`,
          '#pt-panel #pt-panel-close', '#cg-panel .cg-icon-btn[data-act="close"]', '.llmt-check-head > .llmt-check-x', ST_POPUP_CLOSE] },
    { id: 'back', label: '뒤로', glyph: svg(2, 'M12.5 5 7.5 10l5 5'), swap: [inRoots('뒤로'), '.rl-root .rl-back'] },
    { id: 'prev', label: '이전', glyph: svg(2, 'M12.5 5 7.5 10l5 5'), swap: [inRoots('이전', '이전 그림', '이전 표본')] },
    { id: 'next', label: '다음', glyph: svg(2, 'M7.5 5l5 5-5 5'), swap: [inRoots('다음', '다음 그림', '다음 표본')] },
    { id: 'undo', label: '되돌리기', glyph: svg(1.7, 'M8.4 5H10A6.2 6.2 0 1 1 5.62 6.82M10.9 2.5 8.4 5l2.5 2.5'), swap: ['.bl-editor .bl-editor-actions > [data-act="history-undo"]', inRoots('되돌리기')] },
    { id: 'redo', label: '다시 실행', glyph: svg(1.7, 'M11.6 5H10A6.2 6.2 0 1 0 14.38 6.82M9.1 2.5 11.6 5 9.1 7.5'), swap: ['.bl-editor .bl-editor-actions > [data-act="history-redo"]', inRoots('다시 실행')] },
    { id: 'reset', label: '처음 값', glyph: svg(1.7, 'M8.4 5H10A6.2 6.2 0 1 1 5.62 6.82M10.9 2.5 8.4 5l2.5 2.5'), swap: ['.bl-editor .bl-setting-reset', ':is(.salty-panel, .bl-ft-dialog) .bl-view-resize > button:not(.bl-view-toggle)', inRoots('기본값으로')] },
    { id: 'search', label: '찾기', glyph: svg(1.8, 'M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM13 13l4 4'), swap: ['.bl-editor .bl-editor-actions > [data-act="editor-search"]', inRoots('검색', '찾기', '메모에서 찾기')] },
    { id: 'fullscreen', label: '전체 화면', glyph: svg(1.8, 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4'), swap: ['.salty-panel .bl-settings-expand:not([aria-pressed="true"])'] },
    { id: 'fullscreen-exit', label: '작은 창', glyph: svg(1.8, 'M7 3v4H3M13 7V3h4M17 13h-4v4M3 13h4v4'), swap: ['.salty-panel .bl-settings-expand[aria-pressed="true"]'] },
    { id: 'menu', label: '목록', glyph: svg(1.8, 'M3 5h14M3 10h14M3 15h14'), swap: [inRoots('메모 목록', '채팅 목록')], inline: ['.bl-editor .bl-settings-toprow .bl-editor-choose'] },
    { id: 'more', label: '더 보기', glyph: svg(2.6, 'M4 10h.01M10 10h.01M16 10h.01'), swap: ['.salty-panel .salty-style-more', '#pt-panel .pt-more-actions > summary', 'body.salty #WorldInfo .bl-wi-actions > summary'] },
    { id: 'plus', label: '추가', glyph: svg(1.8, 'M10 3v14M3 10h14'), swap: [inRoots('새 메모', '용어집에 넣기')] },
    { id: 'check', label: '확인', glyph: svg(2, 'M3.5 10.5 8 15 16.5 5'), swap: [inRoots('넣기')] },
];
// 미리보기 칸(설정 창 목록 · 고르기 창 머리)도 같은 역할 — 역할 선택자에 끼워 두면 바꾼 그림이 저절로 보인다
for (const role of ROLES) role.swap.push(PREVIEW(role.id));
export const ROLE_IDS = ROLES.map(r => r.id);
const ROLE_SET = new Set(ROLE_IDS);
export const roleLabel = id => ROLES.find(r => r.id === id)?.label || id;

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

// ───────── 그림 파일 ─────────
/** 파일 앞 바이트로 종류 확인 (확장자 · 브라우저가 알려 준 종류는 믿지 않는다) */
export function sniffImage(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 1024)).replace(/^\ufeff/, '').trimStart();
    if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return 'image/svg+xml';
    return '';
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
const encodeText = text => bytesToBase64(new TextEncoder().encode(text));

/**
 * 올린 그림 파일(바이트) → 저장값 'im:…' 또는 오류 { error }.
 * PNG · WebP 는 그대로, SVG 는 sanitizeSvg 로 새로 쓴 것만 (스크립트 · 바깥 참조 · 글꼴 · 스타일 시트 없이).
 */
export function imageFileValue(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!b.length) return { error: '빈 파일이에요' };
    if (b.length > ROLE_ICON_MAX_BYTES) return { error: `그림은 ${ROLE_ICON_MAX_BYTES / 1024}KB 까지예요 (이 파일은 ${Math.ceil(b.length / 1024)}KB)` };
    const mime = sniffImage(b);
    if (!mime) return { error: 'PNG · SVG · WebP 그림만 넣을 수 있어요' };
    if (mime !== 'image/svg+xml') return { value: `im:data:${mime};base64,${bytesToBase64(b)}` };
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return { error: 'SVG 글자 모양(UTF-8)을 읽지 못했어요' }; }
    const clean = sanitizeSvg(text);
    if (!clean) return { error: '그릴 수 있는 모양이 없거나 읽을 수 없는 SVG 예요' };
    const value = `im:data:image/svg+xml;base64,${encodeText(clean)}`;
    return value.length > ROLE_ICON_MAX_DATA + 3 ? { error: '정리한 SVG 가 너무 커요' } : { value };
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

// ───────── CSS ─────────
const cssString = text => `"${[...text].map(ch => `\\${ch.codePointAt(0).toString(16)} `).join('').trimEnd()}"`;
// 철칙 §2 「같은 역할 단추는 같은 크기」: 잉크 ≈12.5 — 선 그림 상자 16 · Font Awesome 12.5. 그림 · 글자도 같은 잉크 크기로
export const ROLE_TOKENS = { '--bl-role-box': '16px', '--bl-role-fa': '12.5px', '--bl-role-img': '12.5px', '--bl-role-text': '13px' };

function glyphRules(icon) {
    if (icon.kind === 'fa') return `content:"\\${icon.code}"!important;background:none!important;font:${icon.family === 'brands' ? '400' : '900'} var(--bl-role-fa)/1 "${icon.family === 'brands' ? 'Font Awesome 6 Brands' : 'Font Awesome 6 Free'}"!important;`;
    if (icon.kind === 'text') return `content:${cssString(icon.text)}!important;background:none!important;font-style:normal!important;font-weight:400!important;font-size:var(--bl-role-text)!important;line-height:1!important;font-family:var(--salty-font-ui)!important;`;
    return `content:""!important;background:url("${icon.url}") center/contain no-repeat!important;width:var(--bl-role-img)!important;height:var(--bl-role-img)!important;`;
}
// 단추 가운데 칸: 원래 ::before 가 무엇을 그리던(선 그림 마스크 · × 글자 · 빈 칸) 모두 덮어쓰고 새 그림만
const BOX = 'display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:var(--bl-role-box)!important;height:var(--bl-role-box)!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;transform:none!important;opacity:1!important;visibility:visible!important;pointer-events:none!important;letter-spacing:0!important;text-indent:0!important;text-transform:none!important;white-space:nowrap!important;color:inherit!important;-webkit-text-fill-color:currentColor!important;-webkit-mask:none!important;mask:none!important;filter:none!important;';
const SWAP_PLACE = 'position:absolute!important;inset:0!important;margin:auto!important;';
const INLINE_PLACE = 'position:static!important;inset:auto!important;margin:0!important;flex:none!important;order:-1!important;';
// 선택자 앞 html:not(#bl-ri) — 맞는 요소는 그대로, 무게(특이도)만 아이디 하나만큼 올려 테마의 같은 자리 규칙보다 앞선다
const BOOST = 'html:not(#bl-ri)';

/** roleIcons → CSS 글. 바꾼 역할이 없으면 '' (그러면 <style> 도 만들지 않는다) */
export function buildRoleCss(map) {
    const rules = [];
    for (const role of ROLES) {
        const icon = parseRoleIcon(map?.[role.id]);
        if (!icon) continue;
        const swap = role.swap.join(', ');
        const glyph = glyphRules(icon);
        rules.push(`/* ${role.id} */`,
            `:where(${swap}){position:relative}`,
            `${BOOST} :is(${swap}){-webkit-text-fill-color:transparent!important;text-shadow:none!important}`,
            `${BOOST} :is(${swap})>*{visibility:hidden!important}`,
            `${BOOST} :is(${swap})::before{${SWAP_PLACE}${BOX}${glyph}}`);
        if (role.inline?.length) {
            const inline = role.inline.join(', ');
            rules.push(`${BOOST} :is(${inline})>svg{display:none!important}`,
                `${BOOST} :is(${inline})::before{${INLINE_PLACE}${BOX}${glyph}}`);
        }
    }
    if (!rules.length) return '';
    const tokens = Object.entries(ROLE_TOKENS).map(([k, v]) => `${k}:${v}`).join(';');
    return `/* Blue Lemonade 단추 아이콘 (설정 › 테마 › 단추 아이콘) */\n:root{${tokens}}\n${rules.join('\n')}\n`;
}
