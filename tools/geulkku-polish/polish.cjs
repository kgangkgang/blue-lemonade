// 글꾸 공통 다듬기(11-10) — 커뮤니티 글 정화기에서 깨지지 않게 모든 틀에 똑같이 거는 고침이에요. 모양은 바꾸지 않아요.
//   1) overflow:hidden → overflow:clip  (정화기가 hidden 을 무시해 꾸밈이 둥근 판 밖으로 나와요 · overflow-x/-y 는 그대로)
//      인라인 스타일에서는 hidden 이 같이 주던 것도 지켜요: display:flow-root(안쪽 여백이 안 새게) · min-width:0 · min-height:0(flex 칸이 줄어들게)
//   2) height:값 뒤에 같은 값의 block-size  (정화기가 height 의 % 를 auto 로 바꿔요 · 값이 이미 있으면 그대로)
//   2-1) <img style> 의 height · block-size 는 !important · 인라인 스크롤 상자에 scrollbar-width:none
//   3) 스크롤 상자(scrollbar-width:none)가 있으면 ::-webkit-scrollbar 숨김 규칙을 <style> 에 한 줄
// 두 번 돌려도 결과가 같아요(멱등). require('./polish.cjs').polishHtml(html, { preview })
const SCROLL_RULE = '[style*="scrollbar-width:none"]::-webkit-scrollbar{display:none;width:0;height:0;block-size:0}';

// 선언 묶음 하나(style 속성 값 또는 CSS 규칙 본문)를 고쳐요
function polishDecls(text) {
    let out = text.replace(/(^|[;\s{"'])overflow\s*:\s*hidden(\s*!important)?/gi, (m, pre, imp = '') => `${pre}overflow:clip${imp}`);
    // height → block-size 병기(같은 묶음에 block-size 가 없을 때만)
    if (!/(^|[;\s{])block-size\s*:/i.test(out)) {
        out = out.replace(/(^|[;\s{])height\s*:\s*([^;{}!]+?)(\s*!important)?\s*(?=;|$)/gi, (m, pre, val, imp = '') => `${pre}height:${val.trim()}${imp};block-size:${val.trim()}${imp}`);
    }
    return out;
}
// <style> 안: 규칙 본문마다(@keyframes 안은 건드리지 않아요)
function polishCss(css) {
    let out = '', i = 0, depth = 0, inKey = 0;
    while (i < css.length) {
        const open = css.indexOf('{', i), close = css.indexOf('}', i);
        if (open < 0 && close < 0) { out += css.slice(i); break; }
        if (open >= 0 && (close < 0 || open < close)) {
            const sel = css.slice(i, open); out += sel + '{'; depth++;
            if (/@keyframes/i.test(sel) && !inKey) inKey = depth;
            i = open + 1;
            // 잎 규칙이면 본문을 한 번에
            const nextOpen = css.indexOf('{', i), nextClose = css.indexOf('}', i);
            if (nextClose >= 0 && (nextOpen < 0 || nextClose < nextOpen)) {
                const body = css.slice(i, nextClose);
                out += (inKey || /^\s*@/.test(sel.trim()) && !/^@(media|supports|container|layer)/i.test(sel.trim())) ? body : polishDecls(body);
                i = nextClose;
            }
        } else { out += css.slice(i, close + 1); if (inKey === depth) inKey = 0; depth--; i = close + 1; }
    }
    return out;
}
// 인라인 스크롤 상자(overflow-x/-y/overflow:auto|scroll)에 scrollbar-width:none
const scrollNone = st0 => { const st = st0.replace(/scrollbar-width\s*:\s*thin/gi, 'scrollbar-width:none').replace(/;?\s*scrollbar-color\s*:[^;]*/gi, ''); return scrollNone0(st); };   // 얇은 스크롤바도 숨겨요(사용자 「스크롤바 안 예쁨」)
const scrollNone0 = st => (/(^|[;\s])overflow(-x|-y)?\s*:\s*(auto|scroll)/i.test(st) && !/scrollbar-width\s*:/i.test(st) ? st.replace(/;?\s*$/, ';scrollbar-width:none') : st);
// <img style> 의 height · block-size 는 둘 다 !important (사이트 규칙 .content img{height:auto!important} 를 이기려면)
const imgImportant = tag => tag.replace(/(\sstyle=")([^"]*)(")/i, (m, a, st, z) => a + st.replace(/(^|;)(\s*)(height|block-size)(\s*:\s*)(?!auto)([^;!]+?)\s*(?=;|$)/gi, '$1$2$3$4$5!important') + z);
// overflow:hidden 이 같이 주던 두 가지를 clip 에서도 지켜요(인라인 스타일만):
//   ① 안쪽 여백이 밖으로 새지 않게(새 서식 맥락) → display:flow-root  ② flex · grid 칸이 내용보다 줄어들 수 있게 → min-width:0 · min-height:0
//   (사이트가 hidden 을 무시하면 이 둘도 같이 사라져 봉투 덮개 · 도장이 밀려 내려와요 — 11-10 편지 봉투에서 확인)
const BLOCK_TAGS = new Set(['div', 'p', 'section', 'article', 'header', 'footer', 'blockquote', 'figure']);
function keepBfc(tag, st) {
    if (!/(^|[;\s])overflow\s*:\s*clip/i.test(st)) return st;
    let out = st; const has = p => new RegExp('(^|[;\\s])' + p + '\\s*:', 'i').test(out); const add = d => { out = out.replace(/;?\s*$/, ';' + d); };
    const disp = (out.match(/(?:^|[;\s])display\s*:\s*([a-z-]+)/i) || [])[1];
    if (!disp) { if (BLOCK_TAGS.has(tag) && !/(^|[;\s])position\s*:\s*absolute/i.test(out)) add('display:flow-root'); }
    else if (disp.toLowerCase() === 'block') out = out.replace(/((?:^|[;\s])display\s*:\s*)block/i, '$1flow-root');
    if (!has('min-width')) add('min-width:0');
    if (!has('min-height')) add('min-height:0');
    return out;
}
function polishHtml(html, { preview = true } = {}) {
    if (!html) return html;
    let out = String(html)
        .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, css, z) => a + polishCss(css) + z)
        .replace(/<([a-zA-Z][\w-]*)\b((?:"[^"]*"|[^>"])*?\sstyle=")([^"]*)(")/g, (m, tag, a, st, z) => `<${tag}${a}${keepBfc(tag.toLowerCase(), scrollNone(polishDecls(st)))}${z}`)
        .replace(/<img\b[^>]*>/gi, imgImportant);
    if (preview && /scrollbar-width\s*:\s*none/i.test(out) && !/::-webkit-scrollbar/i.test(out)) {
        if (/<style\b[^>]*>/i.test(out)) out = out.replace(/<\/style>/i, () => SCROLL_RULE + '</style>');
        else out = out.replace(/^((?:\s*<!--[\s\S]*?-->\s*)*)/, (m, lead) => `${lead}<style>${SCROLL_RULE}</style>\n`);
    }
    return out;
}
module.exports = { polishHtml, polishDecls, polishCss, SCROLL_RULE };
