/* =========================================================
   크로미움 밖 · 다른 화면 폭 규칙 떼어 두기 (1.0.0 공개판) — tools/css-compat.cjs · build-css.cjs 가 미리보기 떼어 두기(css-park) 다음에 부른다

   왜: 9.0.0 · 9.0.1 경량화는 내 기기(안드로이드 크롬 · PC 엣지/크롬, 폰 384 · PC 1280)에서 안 쓰는 규칙을 지웠다
   (eb94ccbb — @supports not · -moz- · 강제 색 · 애플 웹킷 분기, 3a88fb33 — 둘 다 거짓인 폭). 공개판은 다른 브라우저 · 다른 폭도 쓰니
   css/ 모듈에 그 규칙을 되살리되, 첫 시트(style.css)에는 싣지 않고 따로 받는 시트 둘로 뗀다(조건이 맞을 때만 src/lite.js loadCompatCss 가 붙임).
     · src/compat-browser.gen.css — 크로미움 최신에서는 절대 안 맞는 것: 겉 조건에 `@supports not …` · `@media (forced-colors …)` 가 있거나,
       선택자에 -moz- 이름 · .bl-apple-webkit(사파리 표시)이 든 규칙. 붙는 조건: 크로미움이 아님(userAgentData 없음) · 강제 색 켜짐 ·
       그 @supports not 조건 중 하나가 참(옛 크로미움).
     · src/compat-width.gen.css — 겉 @media 가 폰(384 · 손가락 · 마우스 없음 · 세로)과 PC(1280 · 마우스 · 가로) 둘 다에서 거짓인 규칙.
       붙는 조건: 그 미디어 조건(합친 목록)이 지금 맞을 때 — 창 크기가 바뀌어 맞게 되면 그때.
   판정을 못 하는 조건(높이 · 움직임 줄이기 · 색 모드 …)이 섞이면 떼지 않고 제자리에 둔다(보수적으로).
   떼어 낸 규칙은 테마 시트 뒤에 붙으니 원래 자리보다 늦게 온다 — 크로미움 · 폰 384 · PC 1280 에서는 어차피 안 맞아 결과가 같다.
   규칙 수 · 차례가 그대로인지 스스로 확인한다(css-park 와 같은 방식).
   ========================================================= */
'use strict';
const lib = require('./css-lib.cjs');

// 검사 기준 두 기기(규칙 24): 폰 384 · PC 1280. 높이는 판정하지 않는다
const PROFILES = [
    { width: 384, pointer: 'coarse', hover: 'none', orientation: 'portrait' },
    { width: 1280, pointer: 'fine', hover: 'hover', orientation: 'landscape' },
];
const EM = 16;

/** 미디어 기능 하나 → true · false · null(모름) */
function feature(text, p) {
    const f = text.replace(/\s+/g, ' ').trim().toLowerCase();
    let m;
    if ((m = /^(min|max)-width ?: ?([\d.]+)(px|em|rem)$/.exec(f))) {
        const v = parseFloat(m[2]) * (m[3] === 'px' ? 1 : EM);
        return m[1] === 'max' ? p.width <= v : p.width >= v;
    }
    if ((m = /^width ?(<=|<|>=|>) ?([\d.]+)(px|em|rem)$/.exec(f))) {
        const v = parseFloat(m[2]) * (m[3] === 'px' ? 1 : EM);
        return { '<=': p.width <= v, '<': p.width < v, '>=': p.width >= v, '>': p.width > v }[m[1]];
    }
    if ((m = /^(any-)?pointer ?: ?(coarse|fine|none)$/.exec(f))) return p.pointer === m[2];
    if ((m = /^(any-)?hover ?: ?(hover|none)$/.exec(f))) return p.hover === m[2];
    if ((m = /^orientation ?: ?(portrait|landscape)$/.exec(f))) return p.orientation === m[1];
    if (/^forced-colors ?: ?active$/.test(f)) return false;
    return null;
}
/** 한 질의(쉼표 없는 것) → true · false · null */
function query(q, p) {
    let s = q.trim().toLowerCase(), negate = false;
    if (s.startsWith('not ')) { negate = true; s = s.slice(4).trim(); }
    else if (s.startsWith('only ')) s = s.slice(5).trim();
    const parts = [];
    let rest = s;
    const type = /^(all|screen|print)\b/.exec(rest);
    if (type) { parts.push(type[1] === 'print' ? false : true); rest = rest.slice(type[0].length).trim().replace(/^and\b/, '').trim(); }
    while (rest) {
        if (rest[0] !== '(') return null;
        let depth = 0, i = 0;
        for (; i < rest.length; i++) { if (rest[i] === '(') depth++; else if (rest[i] === ')' && --depth === 0) break; }
        const inner = rest.slice(1, i);
        if (/\b(and|or|not)\b|\(/.test(inner)) return null;   // 괄호 안 논리식은 판정하지 않는다
        parts.push(feature(inner, p));
        rest = rest.slice(i + 1).trim();
        if (rest.startsWith('and')) rest = rest.slice(3).trim();
        else if (rest) return null;
    }
    let value = true;
    for (const v of parts) { if (v === false) { value = false; break; } if (v === null) value = null; }
    if (value === null) return null;
    return negate ? !value : value;
}
/** '@media …' 머리 → true · false · null (쉼표 목록은 하나라도 참이면 참) */
function media(prelude, p) {
    const list = lib.topSplit(prelude.replace(/^@media\s*/i, ''));
    let any = false, unknown = false;
    for (const q of list) { const v = query(q, p); if (v === true) any = true; else if (v === null) unknown = true; }
    return any ? true : unknown ? null : false;
}
/** 규칙의 겉 조건(ctx) 전체가 그 기기에서 거짓인가 — @media 만 보고, 하나라도 거짓이면 거짓 */
function falseOn(ctx, p) { return ctx.some(c => /^@media\b/i.test(c) && media(c, p) === false); }

const BROWSER_SEL = /-moz-|\.bl-apple-webkit\b/;
function browserOnly(rule) {
    if (rule.ctx.some(c => /^@supports\s+not\b/i.test(c) || /^@media\b[^{]*forced-colors/i.test(c))) return true;
    return BROWSER_SEL.test(rule.selector);
}
function widthOnly(rule) { return rule.ctx.some(c => /^@media\b/i.test(c)) && PROFILES.every(p => falseOn(rule.ctx, p)); }
function kindOf(rule) { return browserOnly(rule) ? 'browser' : widthOnly(rule) ? 'width' : null; }

function allRules(nodes, out = []) {
    for (const n of nodes) {
        if (n.type === 'rule') out.push(n);
        else if (n.type === 'at' && n.children) allRules(n.children, out);
    }
    return out;
}
function spans(nodes, out) {
    let run = [], kind = null;
    const flush = () => { if (run.length) { out.push({ start: run[0].start, end: run[run.length - 1].end, count: run.length, ctx: run[0].ctx, kind }); run = []; kind = null; } };
    for (const n of nodes) {
        if (n.type === 'comment') continue;
        const k = n.type === 'rule' ? kindOf(n) : null;
        if (k && (!run.length || k === kind)) { run.push(n); kind = k; continue; }
        flush();
        if (k) { run.push(n); kind = k; continue; }
        if (n.type === 'at' && n.children) spans(n.children, out);
    }
    flush();
}
function dropEmptyGroups(css) {
    for (;;) {
        const tree = lib.parse(css);
        const empty = [];
        const visit = nodes => { for (const n of nodes) { if (n.type !== 'at' || !n.children) continue; if (!n.children.some(c => c.type !== 'comment')) empty.push(n); else visit(n.children); } };
        visit(tree.children);
        if (!empty.length) return css;
        empty.sort((a, b) => b.start - a.start);
        for (const n of empty) css = css.slice(0, n.start) + css.slice(n.end);
    }
}

/**
 * @param {string} css
 * @returns {{ text, browser, width, rules: {browser, width}, supports: string[], media: string[] }}
 *   supports = 떼어 낸 `@supports not X` 의 조건 글(`not X` 꼴, CSS.supports 로 그대로 견줌), media = 폭 시트 규칙마다의 @media 조건(겹친 머리는 ` & ` 로 이음, 같은 것은 한 번)
 */
function extract(css) {
    const tree = lib.parse(css);
    if (tree.problems.length) throw new Error(`[css-compat] 분리 전 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const before = allRules(tree.children);
    const found = [];
    spans(tree.children, found);
    const pieces = { browser: [], width: [] }, rules = { browser: 0, width: 0 };
    for (const s of found) {
        let block = css.slice(s.start, s.end);
        for (const outer of [...s.ctx].reverse()) block = `${outer} {\n${block}\n}`;
        pieces[s.kind].push(block);
        rules[s.kind] += s.count;
    }
    let text = css;
    for (const s of [...found].sort((a, b) => b.start - a.start)) text = text.slice(0, s.start) + text.slice(s.end);
    text = dropEmptyGroups(text).replace(/\n{3,}/g, '\n\n');
    const browser = pieces.browser.join('\n'), width = pieces.width.join('\n');
    const after = lib.parse(text), pb = lib.parse(browser), pw = lib.parse(width);
    for (const [name, t] of [['남은 시트', after], ['브라우저 시트', pb], ['폭 시트', pw]]) if (t.problems.length) throw new Error(`[css-compat] ${name} 읽기 문제: ${t.problems.slice(0, 3).join(' / ')}`);
    const stay = allRules(after.children), mb = allRules(pb.children), mw = allRules(pw.children);
    if (stay.length + mb.length + mw.length !== before.length) throw new Error(`[css-compat] 분리 뒤 규칙 수 ${stay.length} + ${mb.length} + ${mw.length} ≠ ${before.length}`);
    if (mb.length !== rules.browser || mw.length !== rules.width) throw new Error('[css-compat] 떼어 낸 규칙 수가 다름');
    // 차례 · 조건: 세 묶음 각각 원래 차례 그대로 (남은 것엔 뗄 규칙이 없어야 한다)
    const idx = { null: 0, browser: 0, width: 0 }, lists = { null: stay, browser: mb, width: mw };
    for (const r of before) {
        const k = String(kindOf(r)), got = lists[k][idx[k]++];
        if (!got || got.selector !== r.selector || got.ctx.join('/') !== r.ctx.join('/')) throw new Error(`[css-compat] ${k} 규칙 차례 · 조건이 다름: ${r.selector.slice(0, 60)}`);
    }
    const supports = [...new Set(mb.flatMap(r => r.ctx.filter(c => /^@supports\s+not\b/i.test(c)).map(c => c.replace(/^@supports\s+/i, '').replace(/\s+/g, ' ').trim())))];
    // 폭 규칙마다 겉 @media 를 모두 만족해야 맞는다 — 한 규칙의 조건 = 그 머리들의 「그리고」(겹친 @media 가 폰 · PC 를 하나씩 거르는 경우도 있어서)
    const mediaList = [...new Set(mw.map(r => r.ctx.filter(c => /^@media\b/i.test(c)).map(c => c.replace(/^@media\s*/i, '').replace(/\s+/g, ' ').trim()).join(' & ')))];
    return { text, browser, width, rules, supports, media: mediaList };
}

module.exports = { extract, media, query, kindOf, browserOnly, widthOnly, PROFILES };

if (require.main === module) {
    const fs = require('fs');
    const file = process.argv[2] || require('path').join(__dirname, '..', 'style.css');
    const r = extract(fs.readFileSync(file, 'utf8'));
    console.log(`브라우저 규칙 ${r.rules.browser}개 ${(Buffer.byteLength(r.browser) / 1024).toFixed(1)}KB · 폭 규칙 ${r.rules.width}개 ${(Buffer.byteLength(r.width) / 1024).toFixed(1)}KB`);
    console.log('@supports:', r.supports.join(' | '));
    console.log('@media:', r.media.join(' | '));
}
