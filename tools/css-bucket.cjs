/* =========================================================
   규칙 묶음 펼치기 (3.6.0) — tools/css-bucket.cjs · build-css.cjs 가 style.css 를 쓰기 직전에 부른다

   왜: 크롬은 규칙을 맨 오른쪽 칸의 id · class · 태그로 묶어 두고, 요소마다 그 묶음만 견준다. 맨 오른쪽 칸이
   `:is(.a, .b)` 처럼 여러 갈래면 어느 묶음에도 못 넣어 "모든 요소와 견주는" 목록에 들어간다. 실험(엣지, 요소 4만 · 안 맞는 규칙 300개):
   규칙 없음 23ms · `:is(.a, .b)` 250ms · 펼친 `.a, .b` 23ms · 한 갈래 `:is(.a)` · `:where(.a)` 22ms · `.a:is(#x, *)` 23ms · `:where(.a):is(.x, *)` 22ms.
   테마의 그런 규칙이 3.0.2 449개 → 3.5.4 503개 (폰 리그에서 스트리밍 스타일 계산 +19%). 원문(css/)은 읽기 좋게 두고 빌드에서 펼친다.
   결과(3.6.0): 안 묶이는 선택자 498 → 92, 사용자 채팅(요소 967개) 전체 스타일 재계산 3.5.4 10.0ms · 3.0.2 9.9ms → 6.4ms (엣지, 세 번씩 중간값).
   남은 92개를 다 빼도 5.1ms — 여러 규칙에 0.3ms 안팎씩 흩어져 있어 뜻을 바꿀 위험을 안고 고칠 만하지 않다.

   바꾸는 것: 맨 오른쪽 칸이 `:is( … )` / `:where( … )` 로 시작하고 갈래가 둘 이상인 선택자
     앞 + :is(A, B)뒤   →   앞 + A + 보정 + 뒤,   앞 + B + 보정 + 뒤
     · 갈래 안에 결합자(공백 · > · + · ~)가 있으면 `X :is(.a .b)` 로 한 갈래씩 감싼다 — 그냥 `X .a .b` 로 풀면 .a 가 X 안에 있어야 해서 뜻이 달라진다
       (실험: 한 갈래 `:is(.q .a)` 23ms · 여러 갈래 `:is(.q .a, .b)` 250ms)
     · 특이도: :is 는 갈래 중 가장 큰 값. 작은 갈래에는 `:is(#bl-s, *)`(id 1) · `:is(.bl-s, *)`(class 1) · `:is(bl-s, *)`(태그 1)를
       모자란 만큼 붙인다 (그 자체는 무엇에나 맞고 특이도만 더함 — 묶음은 앞 갈래의 이름으로 정해짐).
       넘치는 자리가 있으면(예: #a 와 .b.c.d 의 .b.c.d) `:where(.b.c.d)` + 최대치 보정 — 한 갈래 :where 도 묶음에 들어간다
     · 벤더 가상 클래스(:-webkit- …) · :matches · 가상 요소 · 겹친 :has 가 든 갈래는 안 펼친다 — :is 는 무효 갈래만 버리지만
       보통 목록은 규칙째 버린다. 글로 다 못 거르니 node tools/check-bucket.cjs 가 엣지에서 펼치기 전 · 후 규칙이 모두 살아남는지 본다
     · :where 는 특이도 0 → `:where(A)`, `:where(B)` 로 (한 갈래 :where 는 묶음에 들어감)
   규칙 순서 · 선언은 그대로 (같은 규칙 안 선택자 목록만 길어짐). 결과를 다시 읽어 규칙 · 선언이 같은지, 선택자마다 펼친 갈래
   집합과 특이도가 원래와 같은지 확인하고 다르면 멈춘다.
   ========================================================= */
'use strict';
const lib = require('./css-lib.cjs');

const PAD = { id: ':is(#bl-s, *)', cls: ':is(.bl-s, *)', tag: ':is(bl-s, *)' };

/** 깊이 0 에서 마지막 compound 가 시작하는 자리 */
function lastCompoundStart(sel) {
    let i = 0, start = 0;
    while (i < sel.length) {
        const c = sel[i];
        if (c === '"' || c === "'") { i = lib.endString(sel, i); continue; }
        if (c === '\\') { i += 2; continue; }
        if (c === '(') { i = lib.endParen(sel, i) + 1; continue; }
        if (c === '[') { i = lib.endBracket(sel, i) + 1; continue; }
        if (c === ' ' || c === '>' || c === '+' || c === '~' || c === '\n' || c === '\t') { start = i + 1; i++; continue; }
        i++;
    }
    return start;
}

const hasCombinator = arg => lib.compounds(arg.trim()).length > 1 || /^\s*[>+~]/.test(arg);
// :is() 는 잘못된 갈래를 조용히 버리지만 보통 선택자 목록은 하나만 잘못돼도 규칙 전체가 버려진다 → 브라우저마다 다를 수 있는 갈래는 안 펼침
const risky = arg => /:-(webkit|moz|ms)-|::|:(matches|any)\(/i.test(arg) || nestedHas(arg);
/** :has( … ) 안에 또 :has( 가 있으면 무효 (3.5.5 확장 서랍 가로줄 갈래가 그래서 조용히 버려지고 있었다) */
function nestedHas(sel) {
    const re = /:has\(/gi;
    let m;
    while ((m = re.exec(sel))) {
        const open = m.index + m[0].length - 1;
        if (/:has\(/i.test(sel.slice(open + 1, lib.endParen(sel, open)))) return true;
    }
    return false;
}

/** 선택자 하나 → 펼친 선택자 목록 (못 펼치면 [원래]) */
function expandOne(sel, stats, depth = 0) {
    const at = lastCompoundStart(sel);
    const head = sel.slice(0, at);
    const last = sel.slice(at);
    const m = /^:(is|where)\(/i.exec(last);
    if (!m) return [sel];
    const open = m[0].length - 1;
    const close = lib.endParen(last, open);
    const args = lib.topSplit(last.slice(open + 1, close));
    const tail = last.slice(close + 1);
    if (args.length < 2) return [sel];
    if (args.some(risky)) { stats.skipRisky++; return [sel]; }
    let out;
    if (m[1].toLowerCase() === 'where') {
        out = args.map(a => `${head}:where(${a})${tail}`);
        stats.wrapped += args.filter(hasCombinator).length;
    } else {
        const specs = args.map(a => lib.spec(a));
        const max = specs.reduce((best, x) => (lib.cmpSpec(x, best) > 0 ? x : best), [0, 0, 0]);
        const pad = d => `${PAD.id.repeat(d[0])}${PAD.cls.repeat(d[1])}${PAD.tag.repeat(d[2])}`;
        out = args.map((a, k) => {
            const d = [0, 1, 2].map(j => max[j] - specs[k][j]);
            // 모자람만 있으면 갈래 + 보정. 넘치는 자리가 있으면(#a 와 .b.c) 갈래를 :where 로 0 으로 만든 뒤 최대치만큼 보정
            // 갈래에 결합자가 있으면 한 갈래 :is( … ) 로 감싼다 (뜻 · 특이도 그대로, 크롬은 한 갈래 :is 를 안쪽 오른쪽 칸으로 묶음)
            if (hasCombinator(a)) stats.wrapped++;
            const branch = hasCombinator(a) ? `:is(${a})` : a;
            if (d.every(x => x >= 0)) return `${head}${branch}${pad(d)}${tail}`;
            stats.whereWrapped++;
            return `${head}:where(${a})${pad(max)}${tail}`;
        });
    }
    stats.expanded++;
    // 갈래가 또 여러 갈래 :is 로 시작하면 한 번 더
    return depth < 3 ? out.flatMap(x => expandOne(x, stats, depth + 1)) : out;
}

/** 선택자 목록 글 → 펼친 목록 글 (바뀐 게 없으면 null) */
function expandList(prelude, stats) {
    const parts = lib.topSplit(prelude);
    let changed = false;
    const out = [];
    for (const p of parts) {
        const e = expandOne(p, stats);
        if (e.length !== 1 || e[0] !== p) changed = true;
        out.push(...e);
    }
    return changed ? out.join(',\n') : null;
}

function allRules(nodes, out = []) {
    for (const n of nodes) {
        if (n.type === 'rule') out.push(n);
        else if (n.type === 'at' && n.children) allRules(n.children, out);
    }
    return out;
}

// 확인용: 보정을 떼고 :is/:where 를 끝까지 펼친 갈래 집합 + 특이도
const stripPads = s => s.split(PAD.id).join('').split(PAD.cls).join('').split(PAD.tag).join('');
function branches(selectorList) {
    const set = new Set();
    for (const p of lib.topSplit(selectorList)) for (const b of lib.expand(stripPads(p))) set.add(lib.cleanSel ? lib.cleanSel(b) : b.replace(/\s+/g, ' ').trim());
    return set;
}
function specOf(selectorList) {
    return lib.topSplit(selectorList).map(s => lib.spec(s).join('.'));
}

/**
 * @returns {{ text: string, stats: { rules: number, expanded: number, whereWrapped: number, wrapped: number, skipRisky: number, selectorsBefore: number, selectorsAfter: number } }}
 */
function bucketize(css) {
    const stats = { rules: 0, expanded: 0, whereWrapped: 0, wrapped: 0, skipRisky: 0, selectorsBefore: 0, selectorsAfter: 0 };
    const tree = lib.parse(css);
    if (tree.problems.length) throw new Error(`펼치기 전 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const rules = allRules(tree.children);
    const edits = [];
    for (const r of rules) {
        stats.rules++;
        const preludeEnd = r.bodyStart - 1; // '{' 자리
        const prelude = css.slice(r.start, preludeEnd);
        stats.selectorsBefore += lib.topSplit(prelude).length;
        const next = expandList(prelude.trim(), stats);
        if (next == null) { stats.selectorsAfter += lib.topSplit(prelude).length; continue; }
        stats.selectorsAfter += lib.topSplit(next).length;
        edits.push([r.start, preludeEnd, `${next} `]);
    }
    let text = css;
    for (let k = edits.length - 1; k >= 0; k--) {
        const [a, b, s] = edits[k];
        text = text.slice(0, a) + s + text.slice(b);
    }
    verify(css, text);
    return { text, stats };
}

function verify(before, after) {
    const A = lib.parse(before), B = lib.parse(after);
    if (B.problems.length) throw new Error(`펼친 뒤 읽기 문제: ${B.problems.slice(0, 3).join(' / ')}`);
    const ra = allRules(A.children), rb = allRules(B.children);
    if (ra.length !== rb.length) throw new Error(`펼친 뒤 규칙 수 ${ra.length} ≠ ${rb.length}`);
    for (let k = 0; k < ra.length; k++) {
        const x = ra[k], y = rb[k];
        const bodyX = before.slice(x.bodyStart, x.bodyEnd), bodyY = after.slice(y.bodyStart, y.bodyEnd);
        if (bodyX !== bodyY) throw new Error(`${k}번째 규칙 선언이 달라짐: ${x.selector.slice(0, 120)}`);
        if (JSON.stringify(x.ctx) !== JSON.stringify(y.ctx)) throw new Error(`${k}번째 규칙의 @묶음이 달라짐`);
        if (x.selector === y.selector) continue;
        const bx = branches(x.selector), by = branches(y.selector);
        if (bx.size !== by.size || [...bx].some(b => !by.has(b))) throw new Error(`${k}번째 규칙 갈래가 달라짐:\n  전 ${x.selector.slice(0, 160)}\n  후 ${y.selector.slice(0, 160)}`);
        // 특이도: 원래 선택자마다의 값 집합 = 펼친 선택자들의 값 집합 (펼친 것은 원래 하나에서 나와 모두 같은 값)
        const sx = new Set(specOf(x.selector)), sy = new Set(specOf(y.selector));
        if ([...sy].some(v => !sx.has(v))) throw new Error(`${k}번째 규칙 특이도가 달라짐: ${[...sx]} → ${[...sy]}\n  ${y.selector.slice(0, 160)}`);
    }
}

module.exports = { bucketize, expandOne, lastCompoundStart };

if (require.main === module) {
    const fs = require('fs');
    const file = process.argv[2];
    const { text, stats } = bucketize(fs.readFileSync(file, 'utf8'));
    console.log(JSON.stringify(stats));
    if (process.argv[3]) fs.writeFileSync(process.argv[3], text);
}
