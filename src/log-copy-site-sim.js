// 1.1.3 로그 복사 — 붙일 곳(커뮤니티 글) 흉내와 복사 직전 점검. 「깡통 로그」 틀 묶음에서만 써요(log-copy-sheet.js).
//   ① 미리보기 흉내: 붙일 곳의 밤 · 낮 바탕과 본문 글자색 · 틀 위아래 코멘트 자리(640 열 · 왼쪽 맞춤 · 틀과 16px).
//      미리보기 문서 머리의 <style> 로만 넣어요(body 안에 요소를 더하지 않아요 — 복사는 body 안을 그대로 가져가요).
//      코멘트 자리 글은 가상 요소라 복사 글에 들어가지 않아요. 실제 글에서는 비어 있는 코멘트 줄이 숨겨져요.
//   ② 복사 직전 점검(siteCheck): 붙인 뒤 사이트가 손대는 세 가지를 세고, 덮일 글자색은 그 자리에서 고친 판을 돌려줘요.
//      · 인라인 style 의 그림 주소(url() — 지워져요 · 원래 길 log-copy-lift.js 가 <style> 로 옮겨요)
//      · overflow:hidden(무시돼요 · 원래 길 log-copy-polish.js 가 clip 으로 바꿔요)
//      · 바탕 대비가 낮은 글자색(사이트가 color 를 덮어써요 — 실측 문턱 약 4.5 · 여유를 둬 4.6): 같은 색상 · 채도에서 명도만 옮겨요(shared/char-tone.js fitInk)
//        바탕은 인라인 background-color(반투명은 섞어서) · 대사 띠(linear-gradient 의 첫 색을 섞어서)를 따라가고, 아무것도 안 칠한 곳은 붙일 곳 바탕이에요.
//        글이 직접 든 요소만 봐요. 그림 바탕 위 글자 · 이름 가림 칸(글자 = 바탕) · 투명하게 칠한 글씨는 건너뛰어요.
// DOM 없는 순수 모듈(시험 tools/tests/log-copy-connect-113.mjs).
import { parseColor, compose, contrast } from './shared/ink-paint.js';
import { fitInk, INK_TARGET } from './shared/char-tone.js';
import { splitDeclarations } from './log-copy-lift.js';

/** 붙일 곳의 바탕 · 본문 글자색(밤 · 낮) — 본문 글자색은 사이트가 덮어쓸 때 쓰는 색과 같아요 */
export const SITE = Object.freeze({
    dark: Object.freeze({ bg: '#171717', text: '#f5f5f5' }),
    light: Object.freeze({ bg: '#ffffff', text: '#1f2937' }),
});
export const SITE_WIDTH = 640, SITE_GAP = 16;
const siteOf = mode => (mode === 'light' ? SITE.light : SITE.dark);

/** 미리보기 문서 머리에 넣을 규칙(태그 없이 규칙만) */
export function sitePreviewCss(mode = 'dark') {
    const page = siteOf(mode);
    const slot = `display:block;box-sizing:border-box;max-width:${SITE_WIDTH}px;padding:0 ${SITE_GAP}px;text-align:left;text-indent:0;color:${page.text};opacity:.45;font-size:15px;line-height:1.6;pointer-events:none;-webkit-user-select:none;user-select:none`;
    return `body{background-color:${page.bg};color:${page.text};font-family:system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif}`
        + `body::before{content:"위 코멘트 자리";margin:0 auto ${SITE_GAP}px;${slot}}`
        + `body::after{content:"아래 코멘트 자리";margin:${SITE_GAP}px auto 0;${slot}}`;
}

const RAW_TAGS = new Set(['style', 'script', 'textarea', 'title', 'xmp']);
const VOID_TAGS = new Set(['img', 'br', 'col', 'hr', 'input', 'meta', 'wbr', 'source', 'link', 'area', 'base', 'embed', 'param', 'track']);
const START = /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)(\s*\/?)>/y;
const END = /<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/y;
const STYLE_ATTR = /(\sstyle\s*=\s*)(?:"([^"]*)"|'([^']*)')/i;
const decode = s => String(s).replace(/&(quot|amp|lt|gt|apos|#39|#34);/gi, (all, e) => ({ quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", '#39': "'", '#34': '"' })[e.toLowerCase()]);
const GRADIENT = /^\s*linear-gradient\(/i;
const FIRST_COLOR = /(rgba?\([^)]*\)|#[0-9a-f]{3,8}\b)/i;
const hexOf = c => `#${[c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
const sameColor = (a, b) => !!a && !!b && a.r === b.r && a.g === b.g && a.b === b.b && Math.abs(a.a - b.a) < 0.01;

/** 인라인 style 글 → 이 요소의 바탕 계산에 쓰는 값 */
function readStyle(text) {
    const out = { color: null, fill: null, bgColor: null, band: null, art: false, url: /url\s*\(/i.test(text), hidden: false };
    for (const { prop, value } of splitDeclarations(text)) {
        const v = value.replace(/\s*!important\s*$/i, '').trim();
        if (prop === 'color') out.color = v;
        else if (prop === '-webkit-text-fill-color') out.fill = v;
        else if (prop === 'overflow' && /^hidden$/i.test(v)) out.hidden = true;
        else if (prop === 'background-color') out.bgColor = v;
        else if (prop === 'background-image' || prop === 'background') {
            if (/^(none|initial|unset|inherit|transparent)?$/i.test(v)) continue;
            if (prop === 'background' && parseColor(v)) { out.bgColor = v; continue; }
            if (GRADIENT.test(v) && !/url\s*\(/i.test(v) && !/gradient\([\s\S]*gradient\(/i.test(v)) { const m = v.match(FIRST_COLOR); if (m) { out.band = m[1]; continue; } }
            out.art = true;   // 그림 · 여러 겹 · 다른 그라데이션 — 바탕색을 알 수 없어요
        }
    }
    return out;
}

/**
 * 복사 직전 점검.
 * @param {string} html 복사할 HTML(글자색이 요소마다 인라인으로 적힌 것)
 * @param {{ mode?: 'light'|'dark', fix?: boolean, target?: number }} [options] mode: 붙일 곳 밝기 · fix: 덮일 글자색을 고친 판을 돌려줄지 · target: 대비 목표
 * @returns {{ html: string, urls: number, hidden: number, low: number }} urls 인라인 그림 주소가 든 요소 수 · hidden overflow:hidden 요소 수 · low 덮일 글자색 요소 수
 */
export function siteCheck(html, { mode = 'dark', fix = true, target = INK_TARGET } = {}) {
    const source = String(html ?? ''), lower = source.toLowerCase();
    const page = parseColor(siteOf(mode).bg);
    const parts = [];   // 글 조각(string) 또는 여는 태그({ text, el })
    const stack = [{ bg: page, known: true, text: false }];
    let at = 0, urls = 0, hidden = 0;
    const push = (text) => { if (text) { parts.push(text); if (/\S/.test(text)) stack[stack.length - 1].text = true; } };
    while (at < source.length) {
        const lt = source.indexOf('<', at);
        if (lt < 0) { push(source.slice(at)); break; }
        push(source.slice(at, lt));
        if (source.startsWith('<!--', lt)) { const e = source.indexOf('-->', lt + 4), stop = e < 0 ? source.length : e + 3; parts.push(source.slice(lt, stop)); at = stop; continue; }
        END.lastIndex = lt;
        const close = END.exec(source);
        if (close) { if (!VOID_TAGS.has(close[1].toLowerCase()) && stack.length > 1) stack.pop(); parts.push(close[0]); at = lt + close[0].length; continue; }
        START.lastIndex = lt;
        const m = START.exec(source);
        if (!m) { push('<'); at = lt + 1; continue; }
        at = lt + m[0].length;
        const name = m[1].toLowerCase();
        if (RAW_TAGS.has(name)) {   // 안쪽 글은 그대로(규칙 · 스크립트 글은 요소가 아니에요)
            const end = lower.indexOf(`</${name}`, at), stop = end < 0 ? source.length : end;
            parts.push(m[0] + source.slice(at, stop)); at = stop; stack.push({ bg: stack[stack.length - 1].bg, known: false, text: false });
            continue;
        }
        const parent = stack[stack.length - 1];
        const attr = m[2].match(STYLE_ATTR);
        const style = attr ? readStyle(decode(attr[2] ?? attr[3] ?? '')) : null;
        if (style?.url) urls++;
        if (style?.hidden) hidden++;
        let bg = parent.bg, known = parent.known;
        const own = style?.bgColor ? parseColor(style.bgColor) : null;
        if (own && own.a > 0.01) { known = own.a >= 0.999 || known; bg = own.a >= 0.999 ? own : compose(own, bg); }
        if (style?.art) known = false;
        const band = style?.band ? parseColor(style.band) : null;
        if (band && band.a > 0.01) bg = band.a >= 0.999 ? band : compose(band, bg);
        const el = { text: false, bg, known, style, attr, tag: m };
        parts.push({ el });
        if (!VOID_TAGS.has(name) && !m[3].includes('/')) stack.push(el);
    }
    let low = 0;
    const out = parts.map((part) => {
        if (typeof part === 'string') return part;
        const { el } = part, whole = el.tag[0], s = el.style;
        if (!s?.color || !el.text || !el.known) return whole;
        const ink = parseColor(s.color), fill = s.fill ? parseColor(s.fill) : null;
        if (!ink || ink.a < 0.05) return whole;                                   // 못 읽는 색 · 투명 글자
        if (s.fill && (!fill || fill.a < 0.05)) return whole;                     // 투명하게 칠한 글씨(그림 글씨)
        if (s.bgColor && sameColor(ink, parseColor(s.bgColor))) return whole;     // 이름 가림 칸(글자 = 바탕)
        if (contrast(ink, el.bg) >= target) return whole;
        low++;
        if (!fix) return whole;
        const next = fitInk(hexOf(ink), hexOf(el.bg), target);
        if (!next) return whole;
        const quote = el.attr[2] !== undefined ? '"' : "'";
        const raw = el.attr[2] ?? el.attr[3] ?? '';
        // 이 요소의 color 와, 같은 색으로 적힌 -webkit-text-fill-color 만 바꿔요(다른 선언 · 띄어쓰기는 그대로)
        const fixed = raw.replace(/(^|;)(\s*)(color|-webkit-text-fill-color)(\s*:\s*)([^;]*?)(\s*!important)?(\s*)(?=;|$)/gi, (all, pre, sp, prop, colon, value, imp = '', tail) => {
            const was = parseColor(decode(value).trim());
            return sameColor(was, ink) ? `${pre}${sp}${prop}${colon}${next}${imp}${tail}` : all;
        });
        return whole.replace(el.attr[0], () => `${el.attr[1]}${quote}${fixed}${quote}`);
    }).join('');
    return { html: fix ? out : source, urls, hidden, low };
}
