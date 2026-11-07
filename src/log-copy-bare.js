// 로그 복사 — 1.0.7 「보일 것」 빼기(사용자 「위 아래 글자들 … 부가적인 것들 빼는 것도 다 버튼 · 완전 심플한 게 좋을 때도 있음」).
// renderLog 결과(미리보기 표시 data-f · data-bl-msg 가 붙은 HTML)에서 걷어요. 메시지(data-bl-msg) 안은 손대지 않아요.
//   top · bottom: 첫 메시지 앞 · 마지막 메시지 뒤의 틀 글(머리 표 · 부제 · 능력치 칩 · 도장 · 꼬리말 · 서명 …) — 메시지 사이 글은 그대로
//   drop: 뺄 칸(title · date · mark · char · model · prompt · info) — 칸과 그 칸의 한 덩어리(알약 = 앞 낱말 + 값 · 제목 옆 「To.」)를 걷어요
//   남길 칸(제목 · 날짜 · 알약 · 추가 정보)은 위 · 아래 글을 빼도 남아요(제 버튼이 따로 있어요).
// 11-07 사용자 「제목 · 위 글 · 알약 다 빼면 가로 박스도 사라져야지」 · 「글 없어진 부분에 박스만 · 선만 있진 않은지 전수조사」:
//   ① 글이 있던 요소가 걷고 나서 글 · 그림 · 칸이 하나도 없으면 — 장식을 품었으면 상자 꾸밈(테두리 · 바탕 · 그림자)만 지워 장식은 제자리에, 아니면 통째로 걷어요
//   ② 첫 메시지 앞(마지막 메시지 뒤)에 남은 글이 하나도 없으면 그쪽 빈 상자 · 가는 선을 걷어요
//   장식(글이 한 번도 안 들었던 그림 · 이모지 · 테이프 · 움직임 · 누르면 반응 · <img>)은 남겨요(사용자 「단풍은 남아야지 · 박스만 사라지고」)
//   ③ 메시지를 품은 칸 바로 앞(뒤)의 글이 다 걷히면 그 칸의 구분선(border-top · 짝인 padding-top · margin-top / 아래쪽도)을 지워요
//   접힘 머리(summary)는 지우지 않아요(지우면 브라우저가 「자세히」를 그려요) — 펼쳐 둔 상자(open)의 빈 머리는 display:none 으로 숨겨요.
// 걷기 · 숨기기 · 구분선 지우기 말고는 받은 HTML 을 글자 하나 고치지 않아요. DOM 없는 순수 함수 — 테마 시트와 글꾸 마트 시식 창(사본)이 같이 써요.
export const KEEP_FIELDS = ['title', 'date', 'mark', 'char', 'model', 'prompt', 'info'];
/** 알약 앞 낱말(log-copy-presets.js HEAD_TAGS) */
export const KEEP_LABELS = ['깡통', '모델', '프롬프트'];
const VOID = new Set(['br', 'img', 'hr', 'wbr', 'col', 'area', 'source', 'input', 'meta', 'link']);
const LETTER = /[\p{L}\p{N}]/u;
const TOKEN = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+|</g;

/** 글자 참조를 푼 글(글자인지만 봐요) */
const plain = text => text.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16) || 32)).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d) || 32)).replace(/&[a-z]+;/gi, ' ');

function parse(html) {
    const root = { tag: '', open: '', close: '', kids: [] };
    const stack = [root];
    for (const m of html.matchAll(TOKEN)) {
        const [all, close, open, attrs = '', self] = m;
        const top = stack[stack.length - 1];
        if (close) {
            const name = close.toLowerCase();
            const at = stack.findLastIndex((node, i) => i > 0 && node.tag === name);
            if (at > 0) { stack[at].close = all; stack.length = at; } else top.kids.push({ text: all, raw: true });
        } else if (open) {
            const name = open.toLowerCase();
            const field = /\sdata-f="([a-z]+)"/.exec(attrs)?.[1] ?? '';
            const node = { tag: name, open: all, close: '', kids: [], msg: /\sdata-bl-msg(?:[\s=]|$)/.test(attrs), field };
            top.kids.push(node);
            if (!self && !VOID.has(name)) stack.push(node);
        } else top.kids.push({ text: all, raw: all.startsWith('<!--') });
    }
    return root;
}
const textOf = node => (node.tag === undefined ? (node.raw ? '' : plain(node.text)) : node.kids.map(textOf).join(''));
const html = node => node.tag === undefined ? node.text : node.open + node.kids.map(html).join('') + node.close;
const isEl = node => node.tag !== undefined && node.tag !== '';

/** 아래까지 훑어 표시: msgs(메시지 수) · keep(남길 칸) · drop(뺄 칸) · letters(글자) · had(걷기 전에 글 · 칸이 있었나) · prevText · nextText(걷기 전 앞 · 뒤 형제에 글이 있었나) */
function measure(node, drop) {
    if (node.tag === undefined) { node.letters = !node.raw && LETTER.test(plain(node.text)); return node; }
    node.dropHere = !!node.field && drop.has(node.field);
    node.keepHere = KEEP_FIELDS.includes(node.field) && !node.dropHere;
    node.msgs = node.msg ? 1 : 0;
    node.keep = node.keepHere;
    node.drop = node.dropHere;
    node.letters = false;
    for (const kid of node.kids) {
        measure(kid, drop);
        if (kid.tag === undefined) { node.letters ||= kid.letters; continue; }
        if (!node.msg) node.msgs += kid.msgs;
        node.keep ||= kid.keep;
        node.drop ||= kid.drop;
        node.letters ||= kid.letters;
    }
    node.had = node.letters || node.keep || node.drop;
    node.unit = node.keepHere || (node.tag === 'details' && node.keep && !node.msgs);
    let seenText = false;
    for (const kid of node.kids) { kid.prevText = seenText; seenText ||= kid.tag === undefined ? kid.letters : kid.had; }
    seenText = false;
    for (const kid of [...node.kids].reverse()) { kid.nextText = seenText; seenText ||= kid.tag === undefined ? kid.letters : kid.had; }
    return node;
}
/** 지금 남은 것 중 보일 내용(글 · 메시지 · 남길 칸 · 그림)이 있나 */
const content = node => (node.tag === undefined ? !!node.letters : !!(node.msg || node.keepHere || node.tag === 'img' || node.kids.some(content)));
/** style 고치기 — 선언을 빼거나 더해요(따옴표 · 글자 참조는 그대로) */
function restyle(node, edit) {
    const m = /\sstyle="([^"]*)"/.exec(node.open);
    const decls = (m?.[1] ?? '').split(';').map(s => s.trim()).filter(Boolean);
    const next = edit(decls);
    if (next.length === decls.length && next.every((d, i) => d === decls[i])) return;   // 바뀐 게 없으면 글자 하나 안 건드려요
    const css = next.join(';');
    node.open = m ? node.open.replace(m[0], ` style="${css}"`) : node.open.replace(/^<([a-zA-Z][\w-]*)/, `<$1 style="${css}"`);
}
const prop = decl => decl.split(':')[0].trim().toLowerCase();
// 11-07 사용자 「단풍은 남아야지 · 박스만 사라지고」 — 장식(글이 한 번도 안 들었던 그림 · 이모지 · 테이프 · 움직임 · 누르면 반응)은 남기고 빈 박스 · 선만 걷어요
const SYMBOL = /[\p{Extended_Pictographic}\p{So}]/u;
const styleText = node => /\sstyle="([^"]*)"/.exec(node.open)?.[1] ?? '';
const cssValue = (css, key) => new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*([^;]*)`, 'i').exec(css)?.[1]?.trim() ?? null;
const px = value => (value && /^-?\d+(?:\.\d+)?px$/.test(value) ? Number.parseFloat(value) : value === '0' ? 0 : null);
/** 보이는 꾸밈(테두리 · 바탕 · 그림자 · 외곽선)이 있나 */
const painted = css => /(?:^|;)\s*(?:border(?:-(?:top|right|bottom|left))?(?:-width)?|background(?:-color|-image)?|box-shadow|outline)\s*:\s*(?!none|transparent|0(?:px)?\s*(?:;|$))/i.test(css);
/** 선 — 한쪽이 4px 이하(또는 높이 0 + 테두리)이고 다른 쪽은 길게(정하지 않음 · % · 40px 넘음 · 늘어남 · 위아래/양옆 붙음) */
function lineLike(css) {
    const w = px(cssValue(css, 'width')), h = px(cssValue(css, 'height'));
    const along = (size, a, b) => size === null || size > 40 || (cssValue(css, a) !== null && cssValue(css, b) !== null);
    const grows = /(?:^|;)\s*flex\s*:\s*[1-9]/i.test(css) || /(?:^|;)\s*flex-grow\s*:\s*[1-9]/i.test(css);
    if (h !== null && h <= 4) return grows || along(w, 'left', 'right');
    if (w !== null && w <= 4) return along(h, 'top', 'bottom');
    return false;
}
/** 그 요소 자체가 장식인가(글이 한 번도 안 들었던 것): <img> · 누르면 반응 · 그림(url) · 그라데이션 · 움직임 · 작은 그림 조각(가로 · 세로 80px 이하) ·
 *  꾸밈 표시(aria-hidden) · 떠 있는(absolute) 그림 조각 — 선은 장식이 아니에요(11-07 사용자 「단풍은 남아야지 · 박스만 사라지고」 · 「선만 있진 않은지」) */
function ownDecor(node) {
    if (!isEl(node) || node.had) return false;
    if (node.tag === 'img' || /\sdata-bl-egg="/.test(node.open)) return true;
    const css = styleText(node);
    if (lineLike(css)) return false;
    if (/url\(|gradient\(|(?:^|;)\s*animation\s*:/i.test(css)) return true;
    if (!painted(css)) return false;
    const w = px(cssValue(css, 'width')), h = px(cssValue(css, 'height'));
    if (w !== null && h !== null && w <= 6 && h <= 6 && !/\saria-hidden="true"/.test(node.open)) return false;   // 11-08 꼬리표 구멍 · 글머리 점 — 글이 빠진 꼬리표에 혼자 남으면 글 위에 뜬 점이 돼요(「1980 가을」 꼬리표) · 꾸밈 표시(aria-hidden)가 붙은 나사 · 별 점은 장식
    return (w !== null && h !== null && w <= 80 && h <= 80) || /\saria-hidden="true"/.test(node.open) || /(?:^|;)\s*position\s*:\s*absolute/i.test(css);
}
/** 장식을 품었나(이모지 · 기호 글 포함) */
const decor = node => (node.tag === undefined ? !node.raw && SYMBOL.test(plain(node.text)) : ownDecor(node) || node.kids.some(decor));
/** 상자 꾸밈(테두리 · 바탕 · 그림자 · 외곽선)만 지워요 — 자리(여백 · 높이 · 위치)는 그대로라 안의 장식이 제자리에 남아요 */
const BOX = /^(?:border(?!-radius)(?:-.+)?|background(?:-.+)?|box-shadow|outline(?:-.+)?)$/;
const unbox = node => restyle(node, decls => decls.filter(d => !BOX.test(prop(d))));
/** 빈 상자 안에서 장식 · 내용이 아닌 것(가는 선 · 빈 상자)을 걷어요 */
const keepDecorOnly = (node) => {
    node.kids = node.kids.filter(k => (k.tag === undefined ? k.raw || !k.letters : k.msg || content(k) || decor(k)));
};
// 11-07 사용자 「글꾸마트에서 복사해 오면 오른쪽 위 컴퓨터가 내려와 글을 덮어 · 이런 것들 없애줘」:
//   글이 빠져 높이를 잃은 상자에 떠 있는(absolute) 장식만 남으면, 장식이 그 자리에 그대로 떠서 아래 글을 덮어요 → 장식이 차지하던 높이만큼 상자 자리를 남겨요
const POSITION = css => cssValue(css, 'position')?.toLowerCase() ?? 'static';
const floating = node => isEl(node) && ['absolute', 'fixed'].includes(POSITION(styleText(node)));
/** 떠 있는 장식의 아래 끝(상자 위에서부터 px) — 높이를 모르면 null */
function reach(node) {
    const css = styleText(node);
    const h = px(cssValue(css, 'height'));
    if (h === null) return null;
    const top = px(cssValue(css, 'top')), bottom = px(cssValue(css, 'bottom'));
    return (top ?? bottom ?? 0) + h;
}
function hold(node) {
    const css = styleText(node);
    if (!['relative', 'sticky'].includes(POSITION(css)) || cssValue(css, 'height') !== null || cssValue(css, 'min-height') !== null) return;   // 자리를 차지하는 기준 상자만(떠 있는 상자는 자리가 없고 · static 이면 장식이 다른 상자에 붙어요) · 높이를 이미 정했으면 그대로
    const kids = node.kids.filter(k => isEl(k) || (k.tag === undefined && !k.raw && /\S/.test(k.text)));
    if (!kids.length || !kids.every(floating)) return;   // 자리를 차지하는 것이 남아 있으면 그대로
    const need = Math.max(0, ...kids.map(reach).filter(n => n !== null));
    if (need > 0) restyle(node, decls => [...decls, `min-height:${need}px`]);
}
/** 펼쳐 둔 상자의 빈 머리는 숨겨요(지우면 브라우저가 「자세히」를 그려요) · 닫힌 상자의 머리는 여는 손잡이라 그대로 */
function quietSummary(summary, parent) {
    if (parent?.tag === 'details' && /\sopen(?:="[^"]*")?(?=[\s>/])/.test(parent.open)) restyle(summary, decls => [...decls.filter(d => prop(d) !== 'display'), 'display:none']);
}

/**
 * @param {string} source renderLog 결과(표시 포함)
 * @param {{ top?: boolean, bottom?: boolean, drop?: string[] }} [cut]
 * @returns {string} 걷은 HTML(걷을 게 없거나 메시지 표시가 없으면 받은 그대로)
 */
export function bareLog(source, { top = false, bottom = false, drop = [] } = {}) {
    const text = String(source ?? '');
    const dropSet = new Set((drop || []).filter(key => KEEP_FIELDS.includes(key)));
    if (!top && !bottom && !dropSet.size) return text;
    const root = measure(parse(text), dropSet);
    const total = root.msgs;
    if (!total) return text;
    let seen = 0;
    const zone = () => (seen === 0 ? top : seen >= total ? bottom : false);
    // 1) 뺄 칸 · 위 · 아래 글 걷기
    const prune = (node) => {
        const pill = node.kids.some(kid => kid.keepHere);
        node.kids = node.kids.filter((kid) => {
            if (kid.tag === undefined) return !(kid.letters && zone());
            if (kid.msg) { seen += 1; return true; }
            if (kid.dropHere) return false;
            if (!kid.msgs && !kid.keep && kid.kids.some(k => k.dropHere)) {   // 뺄 칸의 한 덩어리(알약 앞 낱말 · 「To. 제목」) — 글만 걷고 장식은 남겨요(빈 상자는 아래 ①이 정리)
                kid.kids = kid.kids.filter(k => !(k.dropHere || (k.tag === undefined ? k.letters : k.letters && !decor(k))));
                return true;
            }
            if (kid.unit) { seen += kid.msgs; return true; }
            if (pill && KEEP_LABELS.includes(textOf(kid).trim())) return true;
            if (kid.msgs || kid.keep || kid.drop || kid.tag === 'summary') { prune(kid); return true; }
            if (!(kid.letters && zone())) return true;
            if (kid.kids.some(decor)) { prune(kid); return true; }   // 글과 장식이 같이 든 줄(꼬리말 + 누르면 반응 점) — 글만 걷고 장식은 남겨요(빈 상자는 아래 ①)
            return false;
        });
    };
    prune(root);
    // 2) ① 글이 있던 요소가 비면 — 장식을 품었으면 상자 꾸밈만 지우고(장식은 제자리) · 아니면 통째로
    const settle = (node) => {
        node.kids = node.kids.filter((kid) => {
            if (!isEl(kid) || kid.msg) return true;
            settle(kid);
            if (!kid.had || content(kid)) return true;
            if (kid.tag === 'summary') { if (kid.kids.some(decor)) { keepDecorOnly(kid); unbox(kid); hold(kid); } else quietSummary(kid, node); return true; }   // 장식 든 머리는 남겨요
            if (!kid.kids.some(decor)) return false;
            keepDecorOnly(kid);
            unbox(kid);
            hold(kid);
            return true;
        });
    };
    settle(root);
    // 3) ② 메시지 앞(뒤)에 남은 글이 없으면 그쪽 장식 · 박스 · 선 모두 — 메시지로 가는 길의 형제들
    const pathSides = (first) => {
        const sides = [];
        for (let node = root; node && !node.msg;) {
            const at = first ? node.kids.findIndex(k => isEl(k) && (k.msg || k.msgs)) : node.kids.findLastIndex(k => isEl(k) && (k.msg || k.msgs));
            if (at < 0) break;
            sides.push({ node, next: node.kids[at] });
            node = node.kids[at];
        }
        return sides;
    };
    const sideOf = ({ node, next }, first) => { const at = node.kids.indexOf(next); return first ? node.kids.slice(0, at) : node.kids.slice(at + 1); };
    for (const first of [true, false]) {
        if (first ? !top : !bottom) continue;
        const sides = pathSides(first);
        if (sides.some(s => sideOf(s, first).some(content))) continue;
        for (const s of sides) {
            const gone = new Set();
            for (const k of sideOf(s, first)) {
                if (k.tag === 'summary') continue;   // 접힘 머리는 ①에서 정리했어요(여는 손잡이 · 장식)
                if (k.tag === undefined) { if (!k.raw && !decor(k) && !/^\s*$/.test(k.text)) gone.add(k); continue; }
                if (decor(k)) { if (k.had) { keepDecorOnly(k); unbox(k); hold(k); } continue; }   // 장식(단풍 · 그림 · 테이프)은 남겨요
                gone.add(k);   // 빈 상자 · 가는 선 · 구분선
            }
            s.node.kids = s.node.kids.filter(k => !gone.has(k));
        }
    }
    // 4) ③ 메시지를 품은 칸 바로 앞(뒤) 글이 다 걷혔으면 그 칸의 구분선 · 짝 여백을 지워요
    for (const first of [true, false]) {
        const edge = first ? 'top' : 'bottom';
        const border = d => prop(d) === `border-${edge}` || prop(d).startsWith(`border-${edge}-`);
        for (const s of pathSides(first)) {
            if (s.next.msg || !(first ? s.next.prevText : s.next.nextText) || sideOf(s, first).some(content)) continue;
            restyle(s.next, (decls) => {
                const line = decls.some(border);
                return decls.filter(d => !(border(d) || prop(d) === `margin-${edge}` || (line && prop(d) === `padding-${edge}`)));
            });
        }
    }
    return html(root);
}
/**
 * 고른 요소 걷기 — log-copy-bare-fit.js 가 그려 보고 고른 「빼고 나서 글을 덮게 된 장식」
 * @param {string} source
 * @param {{ path: number[], tag: string }[]} picks path: 맨 위부터 요소만 센 자식 번호 · tag 가 안 맞으면 그 길은 건너뛰어요(브라우저가 다르게 읽은 HTML)
 * @returns {string} 걷은 HTML(걷을 게 없으면 받은 그대로)
 */
export function dropPaths(source, picks) {
    const text = String(source ?? '');
    if (!picks?.length) return text;
    const root = parse(text);
    const hits = [];
    for (const { path, tag } of picks) {
        let node = root, parent = null;
        for (const i of path) { parent = node; node = node.kids.filter(isEl)[i]; if (!node) break; }
        if (node && parent && node.tag === String(tag).toLowerCase() && !node.msg && !node.msgs) hits.push([parent, node]);
    }
    if (!hits.length) return text;
    for (const [parent, node] of hits) parent.kids = parent.kids.filter(k => k !== node);
    return html(root);
}
/** 읽고 다시 쓴 HTML(시험용 — 받은 것과 같아야 해요) */
export const bareRoundTrip = source => html(parse(String(source ?? '')));
