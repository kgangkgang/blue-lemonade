// 글꾸 본문 줄바꿈 — 「글자 단위」(word-break:normal · 기본) / 「단어 단위」(word-break:keep-all) 를 골라요(11-13 사용자 「난 글자 단위가 좋아서」).
//   테마 src/log-copy-wrap.js 와 마트 mart/word-wrap.js 는 글자까지 같은 사본이에요(DOM 없는 순수 함수 · 한쪽을 고치면 다른 쪽도 — 두 시험이 sha256 으로 잠가요).
//   바꾸는 곳은 본문(지문 · 대사 · 말풍선)뿐 — 제목 · 이름표 · 날짜 · To. · 정보 칩 줄 · 소품 글자 · 단추 · 탭은 낱말 가운데서 끊기면 깨져 보여서 틀 그대로예요.
//   overflow-wrap:anywhere 는 두 값 모두 그대로(칸보다 긴 낱말은 어느 쪽이든 칸 안에서 꺾여요).
//   「단어 단위」는 틀 <style> 그대로(지금 틀은 본문이 모두 keep-all) — 「글자 단위」일 때만 틀 <style> 의 본문 규칙을 고쳐 써요.
//   메시지 글(테마 로그 모델)은 고른 값으로 적어요 — 그래서 「단어 단위」는 채팅 화면이 keep-all 인 기본 화면에서만 줄바꿈 전(1.2.1)과 같아요.
//   화면이 일부러 normal 인 곳(마크다운 표 칸 · 정렬 「양쪽 · 글자 끊기」)은 「단어 단위」면 keep-all 로 바뀌어요(단어 단위 = 늘 낱말째).

export const WRAP_MODES = Object.freeze([['char', '글자 단위'], ['word', '단어 단위']]);
/** 저장 값 → 'char' | 'word'(모르는 값은 기본 「글자 단위」) */
export const wrapMode = value => (value === 'word' ? 'word' : 'char');

const ROWS = ['gk-nr', 'gk-dl', 'nr', 'dl'];   // 본문 줄 class — 지문(nr) · 대사(dl) · 심플 틀은 gk- 머리
const BODY = /^(?:gk-)?(?:nr|dl|bb|bb-o)$/;   // 이 class 를 단 칸의 규칙은 본문 규칙 — 지문 · 대사 줄 · 말풍선(bb · bb-o)
const KEEP = /(word-break\s*:\s*)keep-all/gi;
const LEAD_AT = /^\s*(?:@[^;{}]*;\s*)+/;   // 규칙 앞에 붙어 잡히는 @import · @charset · @layer x; 문장

/** 선택자 하나의 끝 덩어리(.gk-k1 .gk-lg>p.gk-nr → p.gk-nr) */
const lastPart = sel => sel.trim().split(/\s*[\s>+~]\s*/).pop() || '';
/** 'body' = 본문 칸 규칙 · 'p' = 틀의 모든 문단 규칙(이름표 · 날짜 줄에도 걸려요) · 'p:not' = 조절 「정렬 · 양쪽」의 이름표 뺀 모든 문단 규칙 · '' = 그대로 둘 규칙 */
function kindOf(sel) {
    const last = lastPart(sel);
    if (last === 'p') return 'p';
    if (/^p:not\([^)]*\)$/.test(last)) return 'p:not';   // 마트 · 테마 look.js — 날짜 · To. · 정보 칩 줄까지 걸려서 통째로 바꾸지 않고 본문 줄만 덮어요
    const classes = last.replace(/:[\w-]+(?:\([^)]*\))?/g, '').match(/\.[\w-]+/g) || [];
    return classes.some(c => BODY.test(c.slice(1))) ? 'body' : '';
}
const hasClass = (html, name) => new RegExp(`\\sclass\\s*=\\s*["'](?:[^"']*\\s)?${name}(?=[\\s"'])`).test(html);

/**
 * 틀 CSS 한 덩이 — 「글자 단위」면 본문 칸 규칙의 keep-all 을 normal 로. 틀의 모든 문단 규칙(.gk-k1 p · 정렬 「양쪽」 규칙)은 그대로 두고
 * 바로 뒤에 본문 줄만 normal 로 덮는 규칙을 붙여요(이름표 · 날짜처럼 같은 p 를 쓰는 짧은 줄은 낱말 단위 그대로). 두 번 걸어도 덮개는 하나예요.
 * @param {string} css @param {string} mode 'char' | 'word' @param {string[]} [rows] 이 글꾸에 있는 본문 줄 class(덮는 규칙에 쓸 것)
 */
export function wrapCss(css, mode, rows = ROWS) {
    const text = String(css ?? '');
    if (wrapMode(mode) !== 'char' || !/keep-all/i.test(text)) return text;
    return text.replace(/([^{}]+)\{([^{}]*)\}/g, (all, head, body, at, whole) => {
        const sel = head.replace(LEAD_AT, '');
        if (!/word-break\s*:\s*keep-all/i.test(body) || /^\s*@/.test(sel)) return all;
        const sels = sel.split(',').map(s => s.trim()).filter(Boolean), kinds = sels.map(kindOf);
        if (kinds.every(k => k === 'body')) return `${head}{${body.replace(KEEP, '$1normal')}}`;
        if (!rows.length || !kinds.every(k => k === kinds[0] && (k === 'p' || k === 'p:not'))) return all;
        // 덮개의 세기: 「.gk-k1 p」(0,1,1) 뒤에는 「.gk-k1 .gk-nr」(0,2,0) · 「.gk-k1 p:not(.gk-nm)」(0,2,1) 뒤에는 같은 세기 「.gk-k1 p.gk-nr」 — 바로 뒤라 이겨요
        const tag = kinds[0] === 'p' ? '' : 'p';
        const roots = [...new Set(sels.map(s => s.replace(/\s*\bp(?::not\([^)]*\))?$/, '').trim()))];
        const imp = /word-break\s*:\s*keep-all\s*!important/i.test(body) ? '!important' : '';
        const cover = `${roots.flatMap(r => rows.map(c => `${r ? `${r} ` : ''}${tag}.${c}`)).join(',')}{word-break:normal${imp}}`;
        return whole.startsWith(cover, at + all.length) ? all : all + cover;
    });
}

/** 글꾸 HTML 의 <style> 마다 wrapCss — 인라인 style 은 안 건드려요(테마 메시지 글은 wrapModel 이 맡아요) */
export function wrapHtml(html, mode) {
    const text = String(html ?? '');
    if (wrapMode(mode) !== 'char' || !/keep-all/i.test(text) || !/<style/i.test(text)) return text;
    const rows = ROWS.filter(c => hasClass(text, c));
    return text.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (all, open, css, close) => open + wrapCss(css, 'char', rows) + close);
}

/**
 * 테마 로그 모델(log-copy-capture.js — 메시지마다 글자 모양 · 노드 나무)의 줄바꿈. 화면의 채팅 글은 keep-all 이라 그대로 뜨면 「단어 단위」예요.
 *   글자 단위: 바탕 · 메시지 글자 모양 · 노드의 keep-all 을 normal / 단어 단위: 바탕 · 메시지 글자 모양 · 문단(블록) 노드의 normal 을 keep-all
 *   문단(블록) 노드에 값이 없으면 고른 값을 적어요 — 미리보기에서 「글 고치기」 · 숨기기를 한 메시지는 거둔 노드(style {})로 바뀌어,
 *   틀이 메시지 칸에 값을 안 적는 깡통 로그 틀에서는 바깥 값을 물려받았어요. 화면에서 뜬 문단은 늘 값이 있어서 그대로예요.
 *   글 조각(인라인)의 normal — 중국어 · 일본어 덩어리 — 은 그대로. 새 모델을 돌려줘요(받은 모델은 안 바꿔요 — 바뀐 것이 없는 노드는 그대로 같이 써요).
 */
export function wrapModel(model, mode) {
    if (!model || !Array.isArray(model.messages)) return model;
    const want = wrapMode(mode) === 'word' ? 'keep-all' : 'normal';
    const root = font => (font && font['word-break'] !== want ? { ...font, 'word-break': want } : font);
    const nodes = (list) => {
        let changed = false;
        const out = list.map((n) => {
            if (!n || n.t !== 'el') return n;
            const kids = Array.isArray(n.children) ? nodes(n.children) : n.children;
            const was = n.style?.['word-break'], bare = !!n.block && was === undefined;
            const own = bare || (want === 'normal' ? was === 'keep-all' : !!n.block && was === 'normal');
            if (!own && kids === n.children) return n;
            changed = true;
            return { ...n, ...(own ? { style: { ...n.style, 'word-break': want } } : {}), children: kids };
        });
        return changed ? out : list;
    };
    return { ...model, base: root(model.base), messages: model.messages.map(m => ({ ...m, font: root(m.font), nodes: Array.isArray(m.nodes) ? nodes(m.nodes) : m.nodes })) };
}
