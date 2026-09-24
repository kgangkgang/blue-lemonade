// 블루 레몬에이드 CSS 도구 공용 (3.0.0)
//
// style.css · css/*.css 를 소스 위치를 잃지 않고 읽는다: 주석 · 문자열 · data URI 안의 ; ( ) { } 를 건너뛰고,
// 규칙마다 [시작, 끝] · 선택자 · 선언(이름 · 값 · !important · 자리)을 준다. 특이도 · 선택자 쪼개기도 여기.
// 쓰는 곳: tools/build-css.cjs · tools/check-order.cjs · tools/gen-preview-css.js(자기 파서 유지) · 정리 도구
'use strict';

// ───────── 글자 훑기 ─────────
function endComment(s, i) {
    const j = s.indexOf('*/', i + 2);
    return j < 0 ? s.length : j + 2;
}
function endString(s, i) {
    const q = s[i];
    let j = i + 1;
    while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === q) return j + 1;
        if (s[j] === '\n') return j;
        j++;
    }
    return s.length;
}
/** 여는 '(' 자리 → 짝 ')' 자리 */
function endParen(s, i) {
    let d = 0;
    let j = i;
    while (j < s.length) {
        const c = s[j];
        if (c === '/' && s[j + 1] === '*') { j = endComment(s, j); continue; }
        if (c === '"' || c === "'") { j = endString(s, j); continue; }
        if (c === '\\') { j += 2; continue; }
        if (c === '(') { d++; j++; continue; }
        if (c === ')') { d--; if (!d) return j; j++; continue; }
        j++;
    }
    return s.length;
}
function endBracket(s, i) {
    let j = i + 1;
    while (j < s.length) {
        const c = s[j];
        if (c === '"' || c === "'") { j = endString(s, j); continue; }
        if (c === '\\') { j += 2; continue; }
        if (c === ']') return j;
        j++;
    }
    return s.length;
}
/** '{' 다음 자리 → 짝 '}' 자리 (-1 = 짝 없음) */
function endBlock(s, i) {
    let d = 1;
    let j = i;
    while (j < s.length) {
        const c = s[j];
        if (c === '/' && s[j + 1] === '*') { j = endComment(s, j); continue; }
        if (c === '"' || c === "'") { j = endString(s, j); continue; }
        if (c === '\\') { j += 2; continue; }
        if (c === '(') { j = endParen(s, j) + 1; continue; }
        if (c === '{') { d++; j++; continue; }
        if (c === '}') { d--; if (!d) return j; j++; continue; }
        j++;
    }
    return -1;
}
const IDENT = /[A-Za-z0-9_-]/;
function skipIdent(s, i) {
    let j = i;
    while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (IDENT.test(s[j]) || s.charCodeAt(j) > 127) { j++; continue; }
        break;
    }
    return j;
}
function stripComments(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') { i = endComment(s, i); continue; }
        if (c === '"' || c === "'") { const e = endString(s, i); out += s.slice(i, e); i = e; continue; }
        out += c;
        i++;
    }
    return out;
}
/** 주석을 떼고 잇단 공백을 한 칸으로, 결합자 둘레 공백을 한 칸으로 (문자열 안은 그대로) */
function cleanSel(s) {
    let out = '';
    let i = 0;
    let space = false;
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') { i = endComment(s, i); space = true; continue; }
        if (c === '"' || c === "'") {
            const e = endString(s, i);
            if (space && out) out += ' ';
            space = false;
            out += s.slice(i, e);
            i = e;
            continue;
        }
        if (/\s/.test(c)) { space = true; i++; continue; }
        if (space && out) out += ' ';
        space = false;
        out += c;
        i++;
    }
    // 결합자 둘레: `a>b` · `a > b` 를 같게. 괄호 · 대괄호 · 문자열 안은 건드리지 않는다
    let res = '';
    let depth = 0;
    for (let k = 0; k < out.length; k++) {
        const c = out[k];
        if (c === '"' || c === "'") { const e = endString(out, k); res += out.slice(k, e); k = e - 1; continue; }
        if (c === '(' || c === '[') depth++;
        if (c === ')' || c === ']') depth--;
        if (depth === 0 && (c === '>' || c === '+' || c === '~')) {
            res = res.replace(/ $/, '');
            res += ` ${c} `;
            while (out[k + 1] === ' ') k++;
            continue;
        }
        if (c === ',' ) {
            res = res.replace(/ $/, '');
            res += ', ';
            while (out[k + 1] === ' ') k++;
            continue;
        }
        if (c === '(' ) { res += c; while (out[k + 1] === ' ') k++; continue; }
        if (c === ')') { res = res.replace(/ $/, ''); res += c; continue; }
        res += c;
    }
    return res.trim();
}
/** 깊이 0 의 쉼표로 자른다 */
function topSplit(s) {
    const parts = [];
    let start = 0;
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') { i = endComment(s, i); continue; }
        if (c === '"' || c === "'") { i = endString(s, i); continue; }
        if (c === '\\') { i += 2; continue; }
        if (c === '(') { i = endParen(s, i) + 1; continue; }
        if (c === '[') { i = endBracket(s, i) + 1; continue; }
        if (c === ',') { parts.push(s.slice(start, i)); start = i + 1; i++; continue; }
        i++;
    }
    parts.push(s.slice(start));
    return parts.map(p => p.trim()).filter(p => p);
}

// ───────── 읽기 ─────────
/**
 * 시트를 나무로. 마디:
 *  { type:'comment', start, end }
 *  { type:'rule', start, end, prelude, selector, bodyStart, bodyEnd, decls:[…], ctx:[…] }
 *  { type:'at', name, start, end, prelude, block:bool, bodyStart, bodyEnd, children:[…] | null, ctx:[…] }
 * start = 앞의 공백을 뺀 첫 글자, end = 끝 '}' 또는 ';' 다음 자리. bodyStart = '{' 다음, bodyEnd = '}' 자리.
 * 조건부 묶음(@media · @supports · @container · @layer · @scope · @document)만 children 을 읽고, 나머지(@keyframes · @font-face …)는 통째로.
 */
const GROUP_AT = new Set(['media', 'supports', 'container', 'layer', 'scope', 'document', '-moz-document', 'starting-style']);
function parse(css, problems = []) {
    let i = 0;
    function list(end, ctx) {
        const nodes = [];
        let start = -1;
        while (i < end) {
            const c = css[i];
            if (c === '/' && css[i + 1] === '*') {
                const e = endComment(css, i);
                if (start < 0) nodes.push({ type: 'comment', start: i, end: e });
                i = e;
                continue;
            }
            if (start < 0) {
                if (/\s/.test(c)) { i++; continue; }
                if (c === '}') { problems.push(`짝 없는 } @${i}`); i++; continue; }
                start = i;
            }
            if (c === '"' || c === "'") { i = endString(css, i); continue; }
            if (c === '\\') { i += 2; continue; }
            if (c === '(') { i = endParen(css, i) + 1; continue; }
            if (c === '[' && css[start] !== '@') { i = endBracket(css, i) + 1; continue; }
            if (c === ';' && css[start] === '@') {
                const prelude = css.slice(start, i);
                const name = (/^@([\w-]+)/.exec(prelude) || [])[1] || '';
                nodes.push({ type: 'at', name: name.toLowerCase(), start, end: i + 1, prelude: cleanSel(prelude), block: false, ctx });
                i++; start = -1;
                continue;
            }
            if (c === '{') {
                const prelude = css.slice(start, i);
                const bodyStart = i + 1;
                const close = endBlock(css, bodyStart);
                if (close < 0) { problems.push(`짝 없는 { @${start}: ${prelude.slice(0, 60)}`); i = end; break; }
                if (css[start] === '@') {
                    const name = ((/^@([\w-]+)/.exec(prelude) || [])[1] || '').toLowerCase();
                    const node = { type: 'at', name, start, end: close + 1, prelude: cleanSel(stripComments(prelude)), block: true, bodyStart, bodyEnd: close, children: null, ctx };
                    if (GROUP_AT.has(name)) {
                        i = bodyStart;
                        node.children = list(close, [...ctx, node.prelude]);
                    }
                    nodes.push(node);
                } else {
                    const node = { type: 'rule', start, end: close + 1, prelude, selector: cleanSel(stripComments(prelude)), bodyStart, bodyEnd: close, ctx };
                    node.decls = declarations(css, bodyStart, close, problems);
                    nodes.push(node);
                }
                i = close + 1;
                start = -1;
                continue;
            }
            i++;
        }
        if (start >= 0 && css.slice(start, end).trim()) problems.push(`끝나지 않은 글 @${start}: ${css.slice(start, Math.min(end, start + 60))}`);
        return nodes;
    }
    const nodes = list(css.length, []);
    return { type: 'sheet', children: nodes, problems };
}

/** 본문 [from, to) 의 선언들. 중첩 규칙({)이 있으면 problems 에 적고 그 조각은 nested 로 둔다 */
function declarations(css, from, to, problems = []) {
    const out = [];
    let i = from;
    let start = -1;
    const flush = (endAt, withSemi) => {
        if (start < 0) return;
        const raw = css.slice(start, endAt);
        const text = stripComments(raw);
        const colon = findTopColon(text);
        if (colon < 0) {
            if (text.trim()) problems.push(`선언이 아님 @${start}: ${text.trim().slice(0, 60)}`);
        } else {
            const name = text.slice(0, colon).trim();
            let value = text.slice(colon + 1).trim();
            let important = false;
            const m = /!\s*important\s*$/i.exec(value);
            if (m) { important = true; value = value.slice(0, m.index).trim(); }
            out.push({ name, lname: name.startsWith('--') ? name : name.toLowerCase(), value, important, start, end: withSemi ? endAt + 1 : endAt });
        }
        start = -1;
    };
    while (i < to) {
        const c = css[i];
        if (c === '/' && css[i + 1] === '*') {
            const e = endComment(css, i);
            i = e;
            continue;
        }
        if (start < 0) {
            if (/\s/.test(c) || c === ';') { i++; continue; }
            start = i;
        }
        if (c === '"' || c === "'") { i = endString(css, i); continue; }
        if (c === '\\') { i += 2; continue; }
        if (c === '(') { i = endParen(css, i) + 1; continue; }
        if (c === '[') { i = endBracket(css, i) + 1; continue; }
        if (c === '{') {
            const close = endBlock(css, i + 1);
            problems.push(`중첩 규칙 @${start}: ${css.slice(start, i).trim().slice(0, 60)}`);
            out.push({ nested: true, start, end: close + 1 });
            i = close + 1;
            start = -1;
            continue;
        }
        if (c === ';') { flush(i, true); i++; continue; }
        i++;
    }
    // 마지막 선언 뒤 ; 가 없을 때: 끝의 공백은 빼고
    if (start >= 0) {
        let e = to;
        while (e > start && /\s/.test(css[e - 1])) e--;
        flush(e, false);
    }
    return out;
}
function findTopColon(s) {
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '"' || c === "'") { i = endString(s, i); continue; }
        if (c === '(') { i = endParen(s, i) + 1; continue; }
        if (c === ':') return i;
        i++;
    }
    return -1;
}

/** 나무를 문서 순서대로 펴서 스타일 규칙만 (ctx = 감싼 at-규칙 머리 목록) */
function flatRules(tree) {
    const out = [];
    const walk = (nodes) => {
        for (const n of nodes) {
            if (n.type === 'rule') out.push(n);
            else if (n.type === 'at' && n.children) walk(n.children);
        }
    };
    walk(tree.children);
    return out;
}

// ───────── 선택자 ─────────
const MAX_FN = new Set(['is', 'not', 'has', 'matches', '-webkit-any', '-moz-any']);
const LEGACY_PE = new Set(['before', 'after', 'first-line', 'first-letter']);
function cmpSpec(x, y) {
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}
/** 특이도 [id, class, type] — :is · :not · :has = 인자 중 최대, :where = 0, nth-child(of S) = 1 + S */
function spec(sel) {
    let a = 0, b = 0, c = 0;
    let i = 0;
    while (i < sel.length) {
        const ch = sel[i];
        if (ch === '/' && sel[i + 1] === '*') { i = endComment(sel, i); continue; }
        if (ch === '"' || ch === "'") { i = endString(sel, i); continue; }
        if (ch === '#') { i = skipIdent(sel, i + 1); a++; continue; }
        if (ch === '.') { i = skipIdent(sel, i + 1); b++; continue; }
        if (ch === '[') { i = endBracket(sel, i) + 1; b++; continue; }
        if (ch === ':') {
            let j = i + 1;
            let isEl = false;
            if (sel[j] === ':') { j++; isEl = true; }
            const s0 = j;
            j = skipIdent(sel, j);
            const name = sel.slice(s0, j).toLowerCase();
            if (sel[j] === '(') {
                const close = endParen(sel, j);
                const args = sel.slice(j + 1, close);
                if (name === 'where') {
                    // 0
                } else if (MAX_FN.has(name)) {
                    let best = [0, 0, 0];
                    for (const p of topSplit(args)) { const t = spec(p); if (cmpSpec(t, best) > 0) best = t; }
                    a += best[0]; b += best[1]; c += best[2];
                } else if (name === 'nth-child' || name === 'nth-last-child') {
                    b++;
                    const of = /(^|\s)of\s([\s\S]+)$/i.exec(args);
                    if (of) {
                        let best = [0, 0, 0];
                        for (const p of topSplit(of[2])) { const t = spec(p); if (cmpSpec(t, best) > 0) best = t; }
                        a += best[0]; b += best[1]; c += best[2];
                    }
                } else if (isEl) {
                    c++; // ::part() · ::slotted() · ::highlight() …
                } else {
                    b++;
                }
                i = close + 1;
                continue;
            }
            if (isEl || LEGACY_PE.has(name)) c++;
            else b++;
            i = j;
            continue;
        }
        if (ch === '*') { i++; continue; }
        if (IDENT.test(ch) || ch === '\\' || sel.charCodeAt(i) > 127) { i = skipIdent(sel, i); c++; continue; }
        i++;
    }
    return [a, b, c];
}
/** 깊이 0 의 결합자로 자른 compound 목록 */
function compounds(sel) {
    const parts = [];
    let cur = '';
    let i = 0;
    while (i < sel.length) {
        const c = sel[i];
        if (c === '"' || c === "'") { const e = endString(sel, i); cur += sel.slice(i, e); i = e; continue; }
        if (c === '(') { const e = endParen(sel, i) + 1; cur += sel.slice(i, e); i = e; continue; }
        if (c === '[') { const e = endBracket(sel, i) + 1; cur += sel.slice(i, e); i = e; continue; }
        if (c === ' ' || c === '>' || c === '+' || c === '~') {
            if (cur.trim()) parts.push(cur.trim());
            cur = '';
            i++;
            continue;
        }
        cur += c;
        i++;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
}
/** :is( … ) · :where( … ) 를 갈래마다 펼친다 (조건만 보는 :not · :has 안은 그대로) */
function expand(selector) {
    const re = /:(?:is|where|matches)\(/gi;
    let m;
    while ((m = re.exec(selector))) {
        const open = m.index + m[0].length - 1;
        // :not( … ) · :has( … ) 안의 :is 는 펼치지 않는다
        if (insideFn(selector, m.index, ['not', 'has'])) continue;
        const close = endParen(selector, open);
        const head = selector.slice(0, m.index), tail = selector.slice(close + 1);
        return topSplit(selector.slice(open + 1, close)).flatMap(a => expand(head + a + tail));
    }
    return [selector];
}
function insideFn(sel, at, names) {
    const re = /:([\w-]+)\(/g;
    let m;
    while ((m = re.exec(sel)) && m.index < at) {
        const close = endParen(sel, m.index + m[0].length - 1);
        if (close > at && names.includes(m[1].toLowerCase())) return true;
    }
    return false;
}
/** :not( … ) 안을 비운 사본 (부정 안의 이름은 규칙이 어디서 먹는지와 상관없다) */
function stripNot(selector) {
    let out = '', i = 0;
    while (i < selector.length) {
        const at = selector.toLowerCase().indexOf(':not(', i);
        if (at < 0) { out += selector.slice(i); break; }
        out += selector.slice(i, at + 5);
        const close = endParen(selector, at + 4);
        out += ')';
        i = close + 1;
    }
    return out;
}
/** 오른쪽 끝 compound 에서 괄호 밖에 드러난 id · 태그 · 가상 요소 (서로 못 만나는 규칙 가르기용) */
function subjectKeys(sel) {
    const parts = compounds(sel);
    const last = parts[parts.length - 1] || '';
    const bare = last.replace(/\((?:[^()"']|"[^"]*"|'[^']*'|\((?:[^()]|\([^()]*\))*\))*\)/g, '()').replace(/\[[^\]]*\]/g, '[]');
    const ids = [...bare.matchAll(/#([\w-]+)/g)].map(x => x[1]);
    const tag = (/^([a-zA-Z][\w-]*)/.exec(bare) || [])[1]?.toLowerCase() || null;
    const pe = (/::?([\w-]+)(?:\(\))?\s*$/.exec(bare.replace(/:(?:hover|focus|active|focus-visible|focus-within|checked|disabled|enabled|first-child|last-child|only-child|empty|not|is|where|has|nth-child|nth-last-child|nth-of-type|first-of-type|last-of-type|only-of-type|root|visited|link|placeholder-shown|read-only|read-write|required|optional|invalid|valid|open|popover-open|modal|target|indeterminate|default|autofill|-webkit-autofill|defined|fullscreen|user-invalid|user-valid|any-link|in-range|out-of-range|lang|dir|state|host|horizontal|vertical|decrement|increment|start|end|double-button|single-button|no-button|corner-present|window-inactive)(?:\(\))?/gi, '')) || [])[1];
    const pseudoEl = pseudoElementOf(bare);
    return { ids, tag, pseudoEl, compound: last };
}
function pseudoElementOf(bare) {
    const m = /::([\w-]+)/.exec(bare);
    if (m) return m[1].toLowerCase();
    const legacy = /:(before|after|first-line|first-letter)(?![\w-])/i.exec(bare);
    return legacy ? legacy[1].toLowerCase() : null;
}
/** 두 가지가 한 요소(와 같은 가상 요소)에 동시에 맞을 수 없음이 글만으로 확실한가 */
function disjoint(x, y) {
    const a = subjectKeys(x), b = subjectKeys(y);
    if (a.pseudoEl !== b.pseudoEl) return true;
    if (a.ids.length && b.ids.length && !a.ids.some(id => b.ids.includes(id))) return true;
    if (a.tag && b.tag && a.tag !== b.tag) return true;
    // 둘 다 '부모 > 대상' 이고 부모 칸에 드러난 id 가 서로 다르면 같은 요소일 수 없다 (부모는 하나, id 도 하나)
    const pa = parentIds(x), pb = parentIds(y);
    if (pa && pb && pa.length && pb.length && !pa.some(id => pb.includes(id))) return true;
    return false;
}
/** 마지막 결합자가 '>' 일 때 부모 compound 의 괄호 밖 id 목록, 아니면 null */
function parentIds(sel) {
    let depth = 0, lastComb = null, lastAt = -1;
    for (let i = 0; i < sel.length; i++) {
        const c = sel[i];
        if (c === '"' || c === "'") { i = endString(sel, i) - 1; continue; }
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (depth === 0 && (c === '>' || c === '+' || c === '~' || c === ' ')) {
            // 공백은 '>' 둘레의 공백일 수 있다 — 바로 다음 결합자 글자가 있으면 그것을 쓴다
            if (c === ' ' && /^\s*[>+~]/.test(sel.slice(i))) continue;
            if (c === ' ' && lastAt === i - 1 && lastComb !== ' ') { lastAt = i; continue; }
            lastComb = c; lastAt = i;
        }
    }
    if (lastComb !== '>') return null;
    const parts = compounds(sel);
    if (parts.length < 2) return null;
    const parent = parts[parts.length - 2].replace(/\((?:[^()"']|"[^"]*"|'[^']*'|\((?:[^()]|\([^()]*\))*\))*\)/g, '()').replace(/\[[^\]]*\]/g, '[]');
    return [...parent.matchAll(/#([\w-]+)/g)].map(m => m[1]);
}

// ───────── 속성 ─────────
// 순서가 겨루는 묶음: 같은 묶음의 두 선언은 서로 덮을 수 있다고 본다 (줄임 · 접두사 · 논리 속성까지 넓게 — 보수적으로)
const FAMILY = [
    // 줄임 속성과 그 긴 속성 · 논리 속성 · 접두사 별칭을 한 묶음으로. 서로 순서가 결과를 바꿀 수 있는 것끼리만
    [/^scroll-margin/, () => 'scroll-margin'],
    [/^scroll-padding/, () => 'scroll-padding'],
    [/^margin/, () => 'margin'],
    [/^padding/, () => 'padding'],
    [/^(inset|top|right|bottom|left)$|^inset-(inline|block)/, () => 'inset'],
    [/^border(-(top|right|bottom|left|start|end|block|inline)(-(start|end))?)?-radius$|^border-(start|end)-(start|end)-radius$/, () => 'border-radius'],
    [/^border/, () => 'border'],
    [/^outline/, () => 'outline'],
    [/^background/, () => 'background'],
    [/^mask/, () => 'mask'],
    [/^(font|line-height$)/, () => 'font'],
    [/^text-decoration/, () => 'text-decoration'],
    [/^text-emphasis/, () => 'text-emphasis'],
    [/^(grid-)?(row-|column-)?gap$/, () => 'gap'],
    [/^grid-(area|row|column)/, () => 'grid-place'],
    [/^grid/, () => 'grid-template'],
    [/^flex-(flow|direction|wrap)$/, () => 'flex-flow'],
    [/^flex/, () => 'flex'],
    [/^(place|align|justify)-items$/, () => 'items'],
    [/^(place|align|justify)-content$/, () => 'content-align'],
    [/^(place|align|justify)-self$/, () => 'self'],
    [/^overflow-(wrap)$|^word-wrap$/, () => 'overflow-wrap'],
    [/^overflow/, () => 'overflow'],
    [/^(width|inline-size)$/, () => 'width'],
    [/^(height|block-size)$/, () => 'height'],
    [/^(min-width|min-inline-size)$/, () => 'min-width'],
    [/^(max-width|max-inline-size)$/, () => 'max-width'],
    [/^(min-height|min-block-size)$/, () => 'min-height'],
    [/^(max-height|max-block-size)$/, () => 'max-height'],
    [/^list-style/, () => 'list-style'],
    [/^transition/, () => 'transition'],
    [/^animation/, () => 'animation'],
    [/^column-rule/, () => 'column-rule'],
    [/^(columns|column-count|column-width)$/, () => 'columns'],
    [/^overscroll-behavior/, () => 'overscroll'],
    [/^(white-space|text-wrap)/, () => 'white-space'],
    [/^contain-intrinsic/, () => 'contain-intrinsic'],
    [/^container/, () => 'container'],
    [/^offset/, () => 'offset'],
    [/^(position-area|inset-area)$/, () => 'position-area'],
    [/^position-try/, () => 'position-try'],
    [/^text-align/, () => 'text-align'],
    [/^(line-clamp|box-orient)$/, m => m[1]],
    [/^(page-break|break)-(before|after|inside)$/, m => 'break-' + m[2]],
    [/^(font-synthesis|font-variant)/, () => 'font'],
];
function unprefix(name) {
    return name.replace(/^-(webkit|moz|ms|o)-/, '');
}
function family(name) {
    if (name.startsWith('--')) return name;
    const n = unprefix(name.toLowerCase());
    if (n === 'all') return '*';
    for (const [re, key] of FAMILY) { const m = re.exec(n); if (m) return 'f:' + key(m); }
    return n;
}
/** 두 속성이 겨룰 수 있는가 (보수적) */
function overlaps(p, q) {
    const a = family(p), b = family(q);
    if (a === '*' || b === '*') return !(p.startsWith('--') || q.startsWith('--')) || a === b;
    return a === b;
}

// 줄임 속성이 확실히 덮는 긴 속성 (죽은 선언 판정용 — 여기 없으면 덮는다고 보지 않는다)
const SIDES = ['top', 'right', 'bottom', 'left'];
const SHORTHAND = {
    margin: SIDES.map(s => `margin-${s}`),
    padding: SIDES.map(s => `padding-${s}`),
    inset: SIDES,
    'border-width': SIDES.map(s => `border-${s}-width`),
    'border-style': SIDES.map(s => `border-${s}-style`),
    'border-color': SIDES.map(s => `border-${s}-color`),
    'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
    ...Object.fromEntries(SIDES.map(s => [`border-${s}`, [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]])),
    border: [...SIDES.flatMap(s => [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]), 'border-width', 'border-style', 'border-color', ...SIDES.map(s => `border-${s}`)],
    outline: ['outline-width', 'outline-style', 'outline-color'],
    overflow: ['overflow-x', 'overflow-y'],
    gap: ['row-gap', 'column-gap'],
    flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
    'flex-flow': ['flex-direction', 'flex-wrap'],
    'grid-area': ['grid-row-start', 'grid-column-start', 'grid-row-end', 'grid-column-end', 'grid-row', 'grid-column'],
    'grid-row': ['grid-row-start', 'grid-row-end'],
    'grid-column': ['grid-column-start', 'grid-column-end'],
    'place-items': ['align-items', 'justify-items'],
    'place-self': ['align-self', 'justify-self'],
    'place-content': ['align-content', 'justify-content'],
    background: ['background-color', 'background-image', 'background-position', 'background-size', 'background-repeat', 'background-origin', 'background-clip', 'background-attachment', 'background-position-x', 'background-position-y'],
    transition: ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'transition-behavior'],
    'text-decoration': ['text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness'],
    'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
};
/** 선언 d(앞)의 속성을 선언 e(뒤)가 통째로 덮는가 */
function covers(later, earlier) {
    if (later === earlier) return true;
    if (later.startsWith('--') || earlier.startsWith('--')) return false;
    const list = SHORTHAND[later];
    if (!list) return false;
    if (list.includes(earlier)) return true;
    return list.some(l => SHORTHAND[l] && covers(l, earlier));
}
// 뒤 선언 값이 오래된 브라우저에서 읽히지 않아 앞 선언이 대신 살 수 있는 값 (그러면 앞 선언은 '예비값'이라 지우지 않는다)
const FRAGILE_VALUE = /\b(dvh|svh|lvh|dvw|svw|lvw|dvb|svb|lvb|dvi|svi|lvi|dvmin|dvmax|svmin|svmax|lvmin|lvmax|lh|rlh|cqw|cqh|cqi|cqb|cqmin|cqmax)\b|color-mix|oklch|oklab|\blch\(|\blab\(|light-dark|anchor|\bround\(|\bmod\(|\brem\(|calc-size|\battr\(|\bif\(|sibling-|progress\(|\bsubgrid\b|\bmasonry\b|stretch|fill-available|fit-content\(|\bcontents\b|\bclip\b|\bstart\b|\bend\b|\bbalance\b|\bpretty\b|\bstable\b|\bmin\(|\bmax\(|\bclamp\(|\benv\(|\bhwb\(|\bcolor\(|\bpaint\(|\bfrom\b|\blinear\((?!-)|image-set|cross-fade|\bnormal\b.*\bnormal\b|\bsafe\b|\bunsafe\b|\blast\b|\bfirst\b/;
function fragileValue(value) {
    if (/\bvar\(/.test(value)) return false; // var() 가 든 값은 읽을 때 언제나 받아들여진다 (계산 시점에 판정)
    return FRAGILE_VALUE.test(value);
}

module.exports = {
    endComment, endString, endParen, endBracket, endBlock, skipIdent, stripComments, cleanSel, topSplit,
    parse, declarations, flatRules,
    spec, cmpSpec, compounds, expand, stripNot, subjectKeys, disjoint,
    family, overlaps, covers, fragileValue, SHORTHAND,
};
