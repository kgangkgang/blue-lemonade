// 글꾸 본문 줄바꿈 — 「글자 단위」(word-break:normal · 기본) / 「단어 단위」(word-break:keep-all) 를 골라요(11-13 사용자 「난 글자 단위가 좋아서」).
//   테마 src/log-copy-wrap.js 와 마트 mart/word-wrap.js 는 글자까지 같은 사본이에요(DOM 없는 순수 함수 · 한쪽을 고치면 다른 쪽도 — 두 시험이 sha256 으로 잠가요).
//   바꾸는 곳은 본문(지문 · 대사 · 말풍선)뿐 — 제목 · 이름표 · 날짜 · 소품 글자 · 단추 · 탭은 낱말 가운데서 끊기면 깨져 보여서 틀 그대로예요.
//   overflow-wrap:anywhere 는 두 값 모두 그대로(칸보다 긴 낱말은 어느 쪽이든 칸 안에서 꺾여요).
//   「단어 단위」는 틀 그대로(지금 틀은 본문이 모두 keep-all) — 「글자 단위」일 때만 틀 <style> 의 본문 규칙을 고쳐 써요.

export const WRAP_MODES = Object.freeze([['char', '글자 단위'], ['word', '단어 단위']]);
/** 저장 값 → 'char' | 'word'(모르는 값은 기본 「글자 단위」) */
export const wrapMode = value => (value === 'word' ? 'word' : 'char');

const ROWS = ['gk-nr', 'gk-dl', 'nr', 'dl'];   // 본문 줄 class — 지문(nr) · 대사(dl) · 심플 틀은 gk- 머리
const BODY = /^(?:gk-)?(?:nr|dl|bb|bb-o)$/;   // 이 class 를 단 칸의 규칙은 본문 규칙 — 지문 · 대사 줄 · 말풍선(bb · bb-o)
const KEEP = /(word-break\s*:\s*)keep-all/gi;

/** 선택자 하나의 끝 덩어리(.gk-k1 .gk-lg>p.gk-nr → p.gk-nr) */
const lastPart = sel => sel.trim().split(/\s*[\s>+~]\s*/).pop() || '';
/** 'body' = 본문 칸 규칙 · 'p' = 틀의 모든 문단 규칙(이름표 · 날짜 줄에도 걸려요) · '' = 그대로 둘 규칙(제목 · 이름표 · 소품 글자) */
function kindOf(sel) {
    const last = lastPart(sel);
    if (last === 'p') return 'p';
    if (last === 'p:not(.gk-nm)') return 'body';   // 마트 · 테마 look.js 의 본문 규칙(정렬 「양쪽」이 keep-all 을 같이 써요)
    const classes = last.replace(/:[\w-]+(?:\([^)]*\))?/g, '').match(/\.[\w-]+/g) || [];
    return classes.some(c => BODY.test(c.slice(1))) ? 'body' : '';
}
const hasClass = (html, name) => new RegExp(`\\sclass\\s*=\\s*["'](?:[^"']*\\s)?${name}(?=[\\s"'])`).test(html);

/**
 * 틀 CSS 한 덩이 — 「글자 단위」면 본문 규칙의 keep-all 을 normal 로. 틀의 모든 문단 규칙(.gk-k1 p)은 그대로 두고
 * 바로 뒤에 본문 줄만 normal 로 덮는 규칙을 붙여요(이름표 · 날짜처럼 같은 p 를 쓰는 짧은 줄은 낱말 단위 그대로).
 * @param {string} css @param {string} mode 'char' | 'word' @param {string[]} [rows] 이 글꾸에 있는 본문 줄 class(덮는 규칙에 쓸 것)
 */
export function wrapCss(css, mode, rows = ROWS) {
    const text = String(css ?? '');
    if (wrapMode(mode) !== 'char' || !/keep-all/i.test(text)) return text;
    return text.replace(/([^{}]+)\{([^{}]*)\}/g, (all, head, body) => {
        if (!/word-break\s*:\s*keep-all/i.test(body) || /^\s*@/.test(head)) return all;
        const sels = head.split(',').map(s => s.trim()).filter(Boolean), kinds = sels.map(kindOf);
        if (kinds.every(k => k === 'body')) return `${head}{${body.replace(KEEP, '$1normal')}}`;
        if (!rows.length || !kinds.every(k => k === 'p')) return all;
        const roots = [...new Set(sels.map(s => s.replace(/\s*\bp$/, '').trim()))];
        const imp = /word-break\s*:\s*keep-all\s*!important/i.test(body) ? '!important' : '';
        return `${all}${roots.flatMap(r => rows.map(c => `${r ? `${r} ` : ''}.${c}`)).join(',')}{word-break:normal${imp}}`;
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
 *   (글 조각(인라인)의 normal — 중국어 · 일본어 덩어리 — 은 그대로 · 문단 노드는 미리보기에서 고친 글을 거둔 모델에도 글자 모양이 붙어 와요)
 *   새 모델을 돌려줘요(받은 모델은 안 바꿔요 — 바뀐 것이 없는 노드는 그대로 같이 써요).
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
            const was = n.style?.['word-break'], own = want === 'normal' ? was === 'keep-all' : !!n.block && was === 'normal';
            if (!own && kids === n.children) return n;
            changed = true;
            return { ...n, ...(own ? { style: { ...n.style, 'word-break': want } } : {}), children: kids };
        });
        return changed ? out : list;
    };
    return { ...model, base: root(model.base), messages: model.messages.map(m => ({ ...m, font: root(m.font), nodes: Array.isArray(m.nodes) ? nodes(m.nodes) : m.nodes })) };
}
