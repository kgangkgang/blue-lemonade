// 원본 블루레몬에이드 1.1.2(codex/release-112)의 src/log-copy-polish.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」 · 「HTML 복사」가 테마 로그 복사와 같은 모양 · 같은 붙여 넣기 꼴로 내려고 써요)
// 1.1.2 로그 복사 「HTML 복사」 · 내려받기 — 커뮤니티 글 정화기 맞춤(글꾸 마트 tools/geulkku-polish/polish.cjs 와 같은 고침을 테마 쪽에서).
//   미리보기는 그대로 두고 복사 글에만 걸어요. 모양은 바꾸지 않아요(마트 자료가 11-10 부터 같은 고침으로 게시돼 있어요).
//   1) overflow:hidden → overflow:clip  (정화기가 hidden 을 무시해 꾸밈이 둥근 판 밖으로 나와요 · overflow-x/-y 는 그대로)
//      인라인 스타일에서는 hidden 이 같이 주던 것도 지켜요: display:flow-root(안쪽 여백이 안 새게) · min-width:0 · min-height:0(flex 칸이 줄어들게)
//   2) height:값 뒤에 같은 값의 block-size  (정화기가 height 의 % 를 auto 로 바꿔요 · 값이 이미 있으면 그대로)
//   2-1) <img style> 의 height · block-size 는 !important · 인라인 스크롤 상자에 scrollbar-width:none
//   3) 스크롤 상자(scrollbar-width:none)가 있으면 ::-webkit-scrollbar 숨김 규칙을 <style> 에 한 줄
//   4) 옛 「깡통 빈 줄 막기」 규칙 details>summary~:not([class]){display:none} → 끝에 :not(:has([class])) (아래 fixKkGuard)
// 두 번 돌려도 결과가 같아요(멱등). 순수 함수(DOM 없음).
// 테마 판: 붙인 곳이 style 을 다시 쓰면 「scrollbar-width: none」(사이 띄움)이 돼서 두 꼴 다
export const SCROLL_RULE = '[style*="scrollbar-width:none"]::-webkit-scrollbar,[style*="scrollbar-width: none"]::-webkit-scrollbar{display:none;width:0;height:0;block-size:0}';

// 깡통은 <details> 직속 내용에 class 가 없으면 그것을 class 없는 <div> 로 감싸요. 옛 빈 줄 막기 규칙이 그 칸(숨긴 글 · 글 줄)까지 숨겨
//   펼쳐도 글이 안 나왔어요(추천 · 받은 · 내 글꾸 · 마트에서 가져온 틀 — 틀 안에 옛 규칙이 들어 있어요) → 빈 줄(안에 class 든 것이 없는 칸)만 숨기게 고쳐요.
//   바꾸는 꼴은 좁게: 규칙 본문이 display:none 하나(!important · 끝 ; · 빈칸 허용)이고, 선택자 묶음의 한 항목이
//   「[앞 선택자 + 빈칸이나 결합자]details[[open]]>summary~[* · div]:not([class])」 로 끝날 때 그 항목 끝에만 붙여요(결합자 둘레 빈칸 허용).
//   그대로 두는 것: 이미 고친 꼴 · :has(>br:only-child) · :empty · details:not([open])(닫혔을 때만 숨김) · ~div · ~* · 다른 선언이 섞인 규칙 · :not([class]) 를 다른 자리에 쓴 규칙.
const KK_OLD = /^(?:[^,{}]*?[\s>+~])?details(?:\[open\])?\s*>\s*summary\s*~\s*(?:\*|div)?:not\(\s*\[\s*class\s*\]\s*\)$/i;
const KK_BODY = /^\s*display\s*:\s*none\s*(?:!\s*important\s*)?;?\s*$/i;
export const KK_FIX = ':not(:has([class]))';
/** <style> 안 글에서 옛 깡통 빈 줄 막기 규칙만 고친 꼴로 */
export function fixKkGuard(css) {
    const text = String(css ?? '');
    if (!/summary\s*~/i.test(text)) return text;
    return text.replace(/([^{}]*)\{([^{}]*)\}/g, (all, sel, body) => {
        if (!KK_BODY.test(body) || !/summary\s*~/i.test(sel)) return all;
        let hit = false;
        const next = sel.split(',').map((part) => {
            const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(part);
            if (!KK_OLD.test(m[2])) return part;
            hit = true;
            return m[1] + m[2] + KK_FIX + m[3];
        }).join(',');
        return hit ? `${next}{${body}}` : all;
    });
}
/** HTML 의 <style> 마다 fixKkGuard (마트 자료 생성기 · 붙여 넣을 꼴 다듬기가 같이 써요) */
export const fixKkGuardHtml = html => String(html ?? '').replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, css, z) => a + fixKkGuard(css) + z);

// 선언 묶음 하나(style 속성 값 또는 CSS 규칙 본문)를 고쳐요
export function polishDecls(text) {
    let out = text.replace(/(^|[;\s{"'])overflow\s*:\s*hidden(\s*!important)?/gi, (m, pre, imp = '') => `${pre}overflow:clip${imp}`);
    // height → block-size 병기(같은 묶음에 block-size 가 없을 때만)
    if (!/(^|[;\s{])block-size\s*:/i.test(out)) {
        out = out.replace(/(^|[;\s{])height\s*:\s*([^;{}!]+?)(\s*!important)?\s*(?=;|$)/gi, (m, pre, val, imp = '') => `${pre}height:${val.trim()}${imp};block-size:${val.trim()}${imp}`);
    }
    return out;
}
// <style> 안: 규칙 본문마다(@keyframes 안은 건드리지 않아요)
export function polishCss(css) {
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
export function polishHtml(html, { preview = true } = {}) {
    if (!html) return html;
    let out = String(html)
        .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, css, z) => a + polishCss(fixKkGuard(css)) + z)
        .replace(/<([a-zA-Z][\w-]*)\b((?:"[^"]*"|[^>"])*?\sstyle=")([^"]*)(")/g, (m, tag, a, st, z) => `<${tag}${a}${keepBfc(tag.toLowerCase(), scrollNone(polishDecls(st)))}${z}`)
        .replace(/<img\b[^>]*>/gi, imgImportant);
    if (preview && /scrollbar-width\s*:\s*none/i.test(out) && !/::-webkit-scrollbar/i.test(out)) {
        if (/<style\b[^>]*>/i.test(out)) out = out.replace(/<\/style>/i, () => SCROLL_RULE + '</style>');
        else out = out.replace(/^((?:\s*<!--[\s\S]*?-->\s*)*)/, (m, lead) => `${lead}<style>${SCROLL_RULE}</style>\n`);
    }
    return out;
}
