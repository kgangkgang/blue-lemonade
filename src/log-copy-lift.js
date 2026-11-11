// 1.1.2 로그 복사 · 글꾸 「HTML 복사」 — 인라인 style 의 그림 주소(url(…))를 맨 앞 <style> 의 클래스 규칙으로 옮겨요.
//   까닭(11-10 실제 게시글): 커뮤니티 사이트가 인라인 style 의 `url(&quot;` 를 지워 `background: data:…&quot;) …` 만 남아 레몬 · 무늬 그림이 사라졌어요
//   (미리보기 · 복사는 DOM 으로 다시 쓰여 url('…') 이 url("…") 가 돼요). <style> 블록 안의 url('data:…') 은 살아남아요.
//   - 그림 주소가 든 선언과 같은 갈래(background · mask · border-image · list-style …)의 선언을 모두, 적힌 순서 그대로 !important 를 붙여 옮겨요
//     — 인라인 일반 선언보다 이기고, 같은 갈래끼리의 덮어쓰기 차례도 그대로예요. 그 밖의 선언은 인라인에 그대로 남아요.
//   - 클래스 이름은 옮긴 글의 해시(blq-…)라 같은 그림은 규칙 하나 · 한 글에 로그 두 개를 붙여도 이름이 부딪히지 않아요.
//   - <style> 이 지워지는 곳에서는 그림만 빠지고 나머지 모양 · 글은 그대로예요(인라인에 깨진 조각을 남기지 않아요).
//   - <style> · <script> · <textarea> 안 글과 주석은 건드리지 않아요. 순수 함수(DOM 없음) — 테마 로그 복사 창과 글꾸 마트가 같이 써요.
import { polishHtml, SCROLL_RULE } from './log-copy-polish.js';   // 정화기 맞춤(overflow:clip · block-size · 스크롤바 숨김)

export const LIFT_CLASS = 'blq-';

const RAW_TAGS = new Set(['style', 'script', 'textarea', 'title', 'xmp']);
const START = /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)(\s*\/?)>/y;
const ATTR = /(\s+)([^\s"'>/=]+)(?:(\s*=\s*)("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const URL_RE = /url\s*\(/i;
const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ' };
const decode = s => String(s).replace(/&(#\d+|#x[0-9a-f]+|quot|amp|lt|gt|apos|nbsp);/gi, (all, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') { const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10); return Number.isFinite(n) && n >= 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : all; }   // 1.1.2 감사 3차 R2: 범위 밖 숫자 참조는 그대로(RangeError 없이)
    return ENT[k] ?? all;
});
const encode = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** style 글을 선언으로 나눠요 (따옴표 · 괄호 안의 ; 는 나누지 않아요) */
export function splitDeclarations(text) {
    const out = [];
    let depth = 0, quote = '', start = 0;
    const s = String(text ?? '');
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (ch === ';' && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
    }
    out.push(s.slice(start));
    return out.map(d => d.trim()).filter(Boolean).map((d) => {
        const at = d.indexOf(':');
        const prop = at > 0 ? d.slice(0, at).trim() : '';
        return prop ? { prop: prop.startsWith('--') ? prop : prop.toLowerCase(), value: d.slice(at + 1).trim() } : null;
    }).filter(Boolean);
}

/** 선언 갈래: background-image → background · -webkit-mask-size → mask · border-image-source → border-image · list-style-image → list-style */
export function family(prop) {
    const p = String(prop).toLowerCase().replace(/^-(webkit|moz|ms|o)-/, '');
    if (p.startsWith('--')) return p;
    if (p.startsWith('border-image')) return 'border-image';
    if (p.startsWith('list-style')) return 'list-style';
    if (p.startsWith('mask-border')) return 'mask-border';
    return p.split('-')[0];
}

/** FNV-1a 32 → 36진 */
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
}

/** 옮길 주소 다듬기: data:image/svg+xml 안의 날 { } < > 는 퍼센트 인코딩(U12) · url("…") 은 url('…') 로(U13 — 사이트에서 살아남는 것으로 확인한 꼴) */
const tidyUrls = value => String(value).replace(/url\(\s*(["']?)([\s\S]*?)\1\s*\)/gi, (all, q, inner) => {
    let body = inner;
    if (/^data:image\/svg\+xml/i.test(body)) body = body.replace(/[{}<>]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    return body.includes("'") ? `url("${body}")` : `url('${body}')`;
});

/** 한 style 글 → { keep: 인라인에 남길 글, rule: 옮길 선언 글 } (옮길 것이 없으면 null)
 *  그림 주소가 든 선언과 같은 갈래는 차례 그대로 모두 규칙으로 옮기되(!important), 주소가 없는 선언(background-color · background-size …)은
 *  인라인에도 남겨요(U10) — <style> 이 지워지는 곳에서도 바탕색 · 크기는 그대로, <style> 이 살면 규칙이 이겨서 차례가 같아요. */
export function liftStyle(styleText) {
    if (!URL_RE.test(styleText)) return null;
    const list = splitDeclarations(styleText);
    const fams = new Set(list.filter(d => URL_RE.test(d.value)).map(d => family(d.prop)));
    if (!fams.size) return null;
    const moved = list.filter(d => fams.has(family(d.prop)));
    const rule = moved.map(d => { const v = URL_RE.test(d.value) ? tidyUrls(d.value) : d.value; return `${d.prop}:${/!\s*important\s*$/i.test(v) ? v : `${v}!important`}`; }).join(';');
    if (/<\/(style|script)/i.test(rule) || /[{}<]/.test(rule.replace(/'[^']*'|"[^"]*"/g, ''))) return null;   // <style> 블록을 깨뜨릴 수 있는 글은 옮기지 않아요
    const keep = list.filter(d => !URL_RE.test(d.value)).map(d => `${d.prop}: ${d.value}`).join('; ');
    return { keep, rule };
}

/**
 * @param {string} html 복사할 HTML
 * @returns {{ html: string, css: string }} css: <style> 안에 넣을 규칙(옮긴 것이 없으면 빈 글)
 */
export function liftInlineUrls(html) {
    const source = String(html ?? '');
    if (!URL_RE.test(source)) return { html: source, css: '' };
    const rules = new Map();
    const fix = (whole, name, attrs, end) => {
        if (!attrs || !/\sstyle\s*=/i.test(attrs)) return whole;
        let style = null, cls = null;
        attrs.replace(ATTR, (a, sp, key, eq, raw, dq, sq, bare) => {
            const k = key.toLowerCase();
            const v = dq ?? sq ?? bare ?? '';
            if (k === 'style' && style === null) style = decode(v);
            if (k === 'class' && cls === null) cls = decode(v);
            return a;
        });
        const lifted = style === null ? null : liftStyle(style);
        if (!lifted) return whole;
        const id = `${LIFT_CLASS}${hash(lifted.rule)}`;
        if (!rules.has(id)) rules.set(id, lifted.rule);
        let seenStyle = false, seenClass = false;
        let out = attrs.replace(ATTR, (a, sp, key) => {
            const k = key.toLowerCase();
            if (k === 'style' && !seenStyle) { seenStyle = true; return lifted.keep ? `${sp}style="${encode(lifted.keep)}"` : ''; }
            if (k === 'class' && !seenClass) { seenClass = true; return `${sp}class="${encode(`${cls} ${id}`.trim())}"`; }
            return a;
        });
        if (!seenClass) out += ` class="${id}"`;
        return `<${name}${out}${end}>`;
    };
    // 한 번 훑기: 주석 · 날 글 요소(<style> 등) 안은 그대로 · 여는 태그는 속성 값(따옴표 안 < > 포함)까지 통째로 읽어요
    let result = '', at = 0;
    const lower = source.toLowerCase();   // 1.1.2 감사 3차 R1: 날 글 요소마다 글 전체를 다시 소문자로 바꾸던 것(제곱으로 느려짐)을 한 번만
    while (at < source.length) {
        const lt = source.indexOf('<', at);
        if (lt < 0) { result += source.slice(at); break; }
        result += source.slice(at, lt);
        if (source.startsWith('<!--', lt)) { const e = source.indexOf('-->', lt + 4); const stop = e < 0 ? source.length : e + 3; result += source.slice(lt, stop); at = stop; continue; }
        START.lastIndex = lt;
        const m = START.exec(source);
        if (!m) { result += '<'; at = lt + 1; continue; }
        result += fix(m[0], m[1], m[2], m[3]);
        at = lt + m[0].length;
        const tagName = m[1].toLowerCase();
        if (RAW_TAGS.has(tagName)) { const close = lower.indexOf(`</${tagName}`, at); const stop = close < 0 ? source.length : close; result += source.slice(at, stop); at = stop; }
    }
    const css = [...rules].map(([id, rule]) => `.${id}.${id}.${id}{${rule}}`).join('');
    return { html: result, css };
}

/** 맨 앞 <style> 하나로 합치기: head(움직임 <style>…</style> 또는 빈 글) + 옮긴 규칙 */
export function joinHead(head, css) {
    const text = String(head ?? '');
    const one = text.match(/^\s*<style>((?:(?!<\/?style)[\s\S])*)<\/style>\s*$/i);   // 움직임 <style> 하나일 때만 합쳐요
    if (!one && text.trim()) return text + (css ? `<style>${css}</style>` : '');
    const all = (one ? one[1] : '') + (css || '');
    return all ? `<style>${all}</style>` : '';
}

/** 복사 글 본문: 정화기 맞춤 → 그림 주소 옮기기 (서식 · 코드 글 두 벌이 같은 클래스를 쓰게 같은 길로) */
export function copyBody(html) {
    return liftInlineUrls(polishHtml(String(html ?? ''), { preview: false }));
}

/** <style> 을 글 전체를 감싸는 첫 요소 안 첫 자식으로(U11 — 커뮤니티 글꾸 정본 「<style> 은 감싸는 div 안에 하나」) · 감싸는 요소가 없으면 맨 앞 */
export function insertHead(html, head) {
    const text = String(html ?? '');
    if (!head) return text;
    const m = text.match(/^((?:\s*<!--[\s\S]*?-->)*\s*<(?!style\b|script\b|br\b|img\b|hr\b|input\b)[a-zA-Z][\w-]*(?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*>)/);
    if (!m) return head + text;
    // 1.1.3 감사 S4: 코멘트 글줄 규칙이 든 head 면 감싸는 요소에 로그 틀 표시(blq-log)를 달아요 — 규칙이 그 틀이 든 본문에만 걸리게
    const open = head.includes(SCOPE) ? markOpenTag(m[1]) : m[1];
    const rest = text.slice(m[1].length);
    // 1.1.3 심플 새 틀: 틀이 감싸는 요소 첫 자식으로 자기 <style> 을 들고 와요 — head 를 그 <style> 앞쪽에 합쳐 <style> 이 하나로 남게(그 밖의 틀은 그대로)
    const own = frameRooted(m[1]) ? rest.match(/^(\s*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>/i) : null;
    const one = own ? head.match(/^\s*<style>((?:(?!<\/?style)[\s\S])*)<\/style>\s*$/i) : null;
    if (own && one) return `${open}${own[1]}<style>${one[1]}${own[2]}</style>${rest.slice(own[0].length)}`;
    return open + head + rest;
}
/** 1.1.3 심플 새 틀의 뿌리 표시: 감싸는 요소 class 에 gk-k<번호> · gk-q<번호> · 기본 글꾸 새 틀 kb<번호>(log-copy-simple.js 가 그리는 틀 · 글꾸 마트 새 틀 같은 꼴 — q 는 대표 10) */
export const FRAME_ROOT = /^(?:gk-[kq]\d+|kb\d{3})$/;   // 1.1.3 기본 글꾸 새 틀(kb429 …)도 같은 꼴(감싸는 div 첫 자식 <style> 하나)
function frameRooted(open) {
    const tagText = open.slice(open.lastIndexOf('<'));
    const cls = tagText.match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    return !!cls && String(cls[1] ?? cls[2] ?? cls[3] ?? '').split(/\s+/).some(name => FRAME_ROOT.test(name));
}
/** 1.1.3 감사 S4: 붙여 넣은 로그 틀 바깥 상자 표시 · 코멘트 규칙의 범위(이 틀이 든 .content 만 — 댓글 칸 같은 다른 .content 에는 안 번져요) */
export const LOG_MARK = 'blq-log';
const SCOPE = `.content:has(>.${LOG_MARK})`;
/** 여는 태그(앞 주석 포함 · 끝이 >)에 class 하나 더하기 — 이미 있으면 그대로 */
function markOpenTag(open) {
    const at = open.lastIndexOf('<'), tagText = open.slice(at);
    const cls = tagText.match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);   // 따옴표 셋 다(같은 속성이 둘이면 브라우저는 앞 것만 읽어요)
    let next;
    const have = cls ? (cls[1] ?? cls[2] ?? cls[3] ?? '') : '';
    if (cls) next = have.split(/\s+/).includes(LOG_MARK) ? tagText : tagText.replace(cls[0], ` class="${`${have} ${LOG_MARK}`.trim()}"`);
    else next = tagText.replace(/\s*(\/?)>$/, (_, slash) => ` class="${LOG_MARK}"${slash}>`);
    return open.slice(0, at) + next;
}

/** 1.1.2 틀 바깥 위아래의 사용자 코멘트(사이트 본문의 p · 스티커 줄 · 감싼 .blq-cm)를 틀과 같은 640 열에 왼쪽 맞춤으로 — 글꼴은 사이트 기본 그대로(꾸미지 않아요).
 *  간격은 위 · 아래 · 틀 사이 늘 16px: 편집기가 틀 옆에 붙이는 빈 문단 <p><br></p> 은 비어 있는 동안 숨겨요(사용자 「위랑 아래 중간 다 줄 간격 항상 똑같이」 · 실제 글 다섯 개와 같은 규칙) */
export function commentCss(width = 640) {
    const w = Number(width) > 0 ? Math.round(Number(width)) : 640;
    // 1.1.3 감사 S4: ① 범위를 로그 틀이 든 본문(SCOPE)으로 좁혀요(전엔 글 전체 · 글 밖 .content>p 에도 걸릴 수 있었어요)
    //   ② 사용자가 가운데 · 오른쪽 맞춤으로 쓴 문단(편집기가 style="text-align:…" · align 을 적어요)은 왼쪽으로 덮지 않아요. 640 열 · 16px · 빈칸 숨김은 그대로
    return (`.content>p,.blq-cm{box-sizing:border-box;max-width:${w}px;margin-left:auto!important;margin-right:auto!important;padding-left:16px!important;padding-right:16px!important;text-indent:0}`
        + '.content>p:not([style*="text-align"]):not([align]),.blq-cm{text-align:left!important}.blq-cm p{text-align:left!important}'
        + '.content>div+p,.content>div+.blq-cm{margin-top:16px!important}.content>p+div,.content>.blq-cm+div{margin-top:16px!important}'
        + '.content>div:not(.blq-cm)+p:has(>br:only-child),.content>p:has(>br:only-child):has(+div:not(.blq-cm)){display:none!important}.content>*+div:not(.blq-cm){margin-top:16px!important}.content>div:not(.blq-cm)+p:has(>br:only-child)+p,.content>div:not(.blq-cm)+p:has(>br:only-child)+.blq-cm{margin-top:16px!important}.blq-cm>p:first-child:has(>br:only-child),.blq-cm>p:last-child:has(>br:only-child){display:none!important}')
        .replaceAll('.content>', `${SCOPE}>`);
}
/** 틀 위 · 아래 코멘트 빈칸(사용자 「바로 밑에 걍 적으면 저런 식으로 들어가게 · 밑이나 위에나 둘 다」) — 꼭 p 로(감싸지 않은 맨 글자는 정렬 규칙을 못 받아요) */
export const COMMENT_SLOT = '<p><br></p>';
export const withCommentSlots = html => `${COMMENT_SLOT}${html}${COMMENT_SLOT}`;

/** HTML 복사용 한 번에: { head(<style> 하나 — 움직임 · 그림 규칙 · 스크롤바 숨김 · 코멘트 글줄), html(옮긴 본문), full(감싸는 요소 안에 head 를 넣고 위아래 코멘트 빈칸을 단 완성 글) } */
export function liftForCopy(html, motionHead = '', { comments = true, width = 640 } = {}) {
    const { html: out, css } = copyBody(html);
    const scroll = /scrollbar-width\s*:\s*none/i.test(out) ? SCROLL_RULE : '';
    const head = joinHead(motionHead, css + scroll + (comments ? commentCss(width) : ''));
    const full = insertHead(out, head);
    return { head, html: out, full: comments ? withCommentSlots(full) : full };
}

/** 이미 다 만든 글꾸 HTML(글꾸 마트 시식 · 카드 「HTML 복사」 — 안내 주석 · 움직임 <style> 이 맨 앞에 있을 수 있어요)을 붙여 넣을 꼴로:
 *  맨 앞 움직임 <style> 은 떼어 그림 규칙과 한 <style> 로 합치고 같은 길(liftForCopy)로 — 이미 다듬은 글이면 두 번 걸어도 같아요(코멘트 빈칸은 한 번만) */
export function pasteReady(html) {
    let text = String(html ?? '');
    if (!text.trim() || text.includes('.content>p,.blq-cm{') || text.includes(`${SCOPE}>p,.blq-cm{`)) return text;   // 이미 붙여 넣을 꼴(1.1.2 꼴 · 1.1.3 꼴)
    text = text.replace(/^\s*<p><br><\/p>/, '').replace(/<p><br><\/p>\s*$/, '');   // 1.1.2 감사 3차 S8: 앞뒤 공백이 있어도 코멘트 빈칸을 떼요
    const lead = text.match(/^(\s*(?:<!--[\s\S]*?-->\s*)*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>\s*/i);
    const motion = lead ? `<style>${lead[2]}</style>` : '';
    const rest = lead ? lead[1] + text.slice(lead[0].length) : text;
    return liftForCopy(rest, motion).full;
}
