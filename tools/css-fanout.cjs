/* =========================================================
   조상 칸 :is 펼치기 (1.4.x 작업자 D · 요소당 무게) — tools/css-fanout.cjs · build-css.cjs 가 열쇠 달기(css-key) · :has 지킴 뒤에 부른다

   왜: 크롬(Blink)은 맨 오른쪽 칸이 맞는 요소마다 조상 칸을 「빠른 거절(블룸 필터)」로 먼저 걸러요. 블룸 필터는 조상 칸에 드러난
   아이디 · 클래스 · 태그 · 속성 이름만 보고, 여러 갈래 `:is(A, B)` · `:where(…)` 안의 이름은 못 봐요. 그래서
   `body.salty :is(.drawer-content, .popup) h4` 같은 규칙은 채팅의 h4 · 문단마다 조상을 끝까지 걸어 올라가 봐야 「안 맞음」을 알아요.
   리그 실험(11-14 · 300 메시지 채팅을 떼었다 붙여 한 번에 다시 계산 · PC): 테마 시트가 요소당 약 4.2µs 를 더하고(순정 2.6 → 6.8),
   채팅을 말하지 않는 규칙만 떼도 2.7µs 가 줄었어요 — 채팅 요소가 「채팅과 상관없는 규칙」의 조상 걷기에 시간을 써요.

   바꾸는 것: 맨 오른쪽이 아닌 칸이 통째로 `:is(a, b, …)`(2 ~ 6 갈래)이면 그 칸을 갈래마다 풀어 선택자 갈래를 나눠요.
     `머리 :is(a, b) 꼬리` → `머리 a 꼬리, 머리 b 꼬리` (머리가 없으면 갈래 안의 결합자도 그대로 펼쳐요).
     · 뜻: `:is(X Y) Z` 와 `X Y Z` 는 같은 요소를 골라요(조상 칸 자리의 :is 인자는 그 자리 요소에 견줘지고, 인자 안 결합자도 그 요소 위로만 가요).
       단 머리가 있을 때 인자 안에 body · html 이 드러나면(머리보다 위를 가리킬 수 있어) 펼치지 않아요.
     · 특이도: :is 는 인자 가운데 가장 큰 특이도를 써요 → 갈래마다 모자란 만큼 맨 오른쪽 칸에 0 무게 짝(`:is(#bl-s, *)` · `:is(.bl-s, *)` · `:is(bl-s, *)`)을 붙여 맞춰요.
       어느 자리든 원래보다 큰 갈래(예: `.bl-chat-like` 가 `#chat` 과 함께 있으면 클래스 자리가 더 큼)는 `:where(인자)` 로 감싸 0 으로 만든 뒤 맞춰요(그 갈래만 빠른 거절이 없어요).
     · :is 는 인자 하나가 틀려도 나머지를 쓰지만(관대한 읽기) 선택자 목록은 하나가 틀리면 규칙 전체를 버려요 — 그래서 인자에
       가상 요소 · & · :host · :has 안 :has · 브라우저 접두사가 있으면 그 칸은 안 펼쳐요.
     · 한 갈래에서 나오는 갈래는 8개까지(넘으면 그 칸은 안 펼쳐요). 규칙 수 · 차례 · 선언 · @묶음은 그대로예요.
   확인: 펼친 갈래마다 특이도가 원래 갈래와 같은지, 갈래를 되돌려 보면(펼친 인자 → :is 로 다시 묶기) 원래 글과 같은지, 규칙 수 · 선언이 같은지 보고 다르면 멈춰요.
   두 번 돌려도 같아요(펼친 뒤에는 조상 칸에 여러 갈래 :is 가 없어요). 시험: tools/tests/css-fanout.mjs
   ========================================================= */
'use strict';
const lib = require('./css-lib.cjs');
const key = require('./css-key.cjs');

const MAX_OUT = 8;
const MAX_ARGS = 6;
const RISKY = /::|:(before|after|first-line|first-letter)\b|&|:host|::slotted|::part|:-(webkit|moz|ms)-|:(matches|any)\(|:has\(/i;   // 검토 D-5: :has 를 모르는 옛 브라우저에서 목록 전체가 버려지지 않게 :has 가 든 인자는 안 펼쳐요
const PAD = ['#bl-s', '.bl-s', 'bl-s'];

/** compound 가 통째로 `:is( … )` 하나이면 인자 목록, 아니면 null */
function wholeIs(compound) {
    const m = /^:is\(/i.exec(compound); if (!m) return null;
    const close = lib.endParen(compound, m[0].length - 1);
    if (close !== compound.length - 1) return null;
    return lib.topSplit(compound.slice(m[0].length, close));
}
/** 맨 오른쪽 칸 안에서 짝을 붙일 자리(가상 요소 앞) */
function padAt(last) { return key.unwrapSubject ? insertAt(last) : last.length; }
function insertAt(compound) {
    // css-key.insertAt 과 같은 뜻: 맨 뒤 가상 요소(::x, :before 등) 앞
    let i = 0, at = compound.length;
    while (i < compound.length) {
        const c = compound[i];
        if (c === '\\') { i += 2; continue; }
        if (c === '"' || c === "'") { i = lib.endString(compound, i); continue; }
        if (c === '[') { i = lib.endBracket(compound, i) + 1; continue; }
        if (c === '(') { i = lib.endParen(compound, i) + 1; continue; }
        if (c === ':' && (compound[i + 1] === ':' || /^:(before|after|first-line|first-letter)(?![\w-])/i.test(compound.slice(i)))) { at = i; break; }
        i++;
    }
    return at;
}
const sub = (a, b) => a.map((x, i) => x - b[i]);
const pads = d => PAD.map((p, i) => `:is(${p}, *)`.repeat(Math.max(0, d[i]))).join('');

/** 갈래 하나 → 펼친 갈래들(안 바꾸면 null) */
function fanOne(branch, stats) {
    let work = [branch.trim()];
    let touched = false;
    for (let round = 0; round < 4; round++) {
        let any = false; const next = [];
        for (const sel of work) {
            const out = fanStep(sel, stats);
            if (out) { any = true; next.push(...out); } else next.push(sel);
        }
        if (!any) break;
        if (next.length > MAX_OUT) { stats.tooMany++; break; }
        work = next; touched = true;
    }
    if (!touched) return null;
    const so = lib.spec(branch).join('.');
    for (const n of work) if (lib.spec(n).join('.') !== so) throw new Error(`[css-fanout] 특이도가 달라짐 ${so} → ${lib.spec(n).join('.')}:\n  전 ${branch.slice(0, 200)}\n  후 ${n.slice(0, 200)}`);
    return work;
}
/** 한 번: 왼쪽부터 처음 만나는 펼칠 조상 칸 하나를 펼쳐요 */
function fanStep(sel, stats) {
    if (/&|:host|::slotted|::part|:has\(/.test(sel)) return null;   // :has 가 든 갈래는 안 펼쳐요 — 첫 장 :has( 수 상한(perf-budget-static ①)을 늘리지 않게
    const segs = key.segments(sel);
    if (segs.length < 2) return null;
    // 다른 조상 칸에 이미 빠른 거절 이름(html · body · .salty 말고 드러난 #id · .class · 태그 · 속성)이 있으면 그 이름이 걸러 줘요 — 안 펼쳐요(글만 늘어요)
    const filtered = segs.slice(0, -1).some(([a, b]) => { const c = sel.slice(a, b); if (wholeIs(c)) return false; const bare = c.replace(/\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '').replace(/^(html|body)(?![\w-])/i, '').replace(/\.salty(?![\w-])/g, '').replace(/:[\w-]+/g, ''); return /[#.[]|^[a-z]/i.test(bare); });
    if (filtered) { stats.alreadyFiltered++; return null; }
    for (let k = 0; k < segs.length - 1; k++) {
        const [a, b] = segs[k];
        const args = wholeIs(sel.slice(a, b));
        if (!args || args.length < 2 || args.length > MAX_ARGS) continue;
        if (args.some(x => RISKY.test(x) || !x.trim())) { stats.risky++; continue; }
        const head = sel.slice(0, a);
        if (k > 0 && args.some(x => /(^|[\s>+~(,])(html|body)(?![\w-])/i.test(x))) { stats.rootArg++; continue; }
        // 검토 D-6: 머리가 있으면 결합자가 든 인자의 첫 칸이 머리 위에 있어도 맞던 뜻이 좁아져요 — 첫 칸이 아이디(문서에 하나 · body 안)일 때만 펼쳐요
        if (k > 0 && args.some(x => key.segments(x.trim()).length > 1 && !/^#[\w-]/.test(x.trim()))) { stats.headCombinator++; continue; }
        const tail = sel.slice(b);
        const S = lib.spec(sel);
        const out = [];
        for (const arg of args) {
            let x = arg.trim();
            let cand = `${head}${x}${tail}`;
            let d = sub(S, lib.spec(cand));
            if (d.some(v => v < 0)) { x = `:where(${x})`; cand = `${head}${x}${tail}`; d = sub(S, lib.spec(cand)); stats.wrapped++; }
            if (d.some(v => v < 0)) return null;
            const ls = lastStart(cand); const last = cand.slice(ls); const at = insertAt(last);
            cand = cand.slice(0, ls) + last.slice(0, at) + pads(d) + last.slice(at);
            out.push(cand);
        }
        stats.fanned++;
        return out;
    }
    return null;
}
function lastStart(sel) { const s = key.segments(sel); return s[s.length - 1][0]; }

function allRules(nodes, out = []) { for (const n of nodes) { if (n.type === 'rule') out.push(n); else if (n.type === 'at' && n.children) allRules(n.children, out); } return out; }

/** @returns {{ text: string, stats: object }} */
function fanout(css) {
    const stats = { headCombinator: 0, alreadyFiltered: 0, rules: 0, rulesChanged: 0, branchesIn: 0, branchesOut: 0, fanned: 0, wrapped: 0, risky: 0, rootArg: 0, tooMany: 0 };
    const tree = lib.parse(css);
    if (tree.problems.length) throw new Error(`[css-fanout] 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const edits = [];
    for (const r of allRules(tree.children)) {
        stats.rules++;
        const end = r.bodyStart - 1;
        const parts = lib.topSplit(css.slice(r.start, end));
        let any = false; const out = [];
        for (const p of parts) {
            stats.branchesIn++;
            const f = fanOne(p, stats);
            if (!f) { out.push(p); continue; }
            any = true; out.push(...f);
        }
        stats.branchesOut += out.length;
        if (!any) continue;
        stats.rulesChanged++;
        edits.push([r.start, end, `${out.join(',\n')} `]);
    }
    let text = css;
    for (let k = edits.length - 1; k >= 0; k--) { const [a, b, s] = edits[k]; text = text.slice(0, a) + s + text.slice(b); }
    verify(css, text);
    return { text, stats };
}
function verify(before, after) {
    const A = lib.parse(before), B = lib.parse(after);
    if (B.problems.length) throw new Error(`[css-fanout] 펼친 뒤 읽기 문제: ${B.problems.slice(0, 3).join(' / ')}`);
    const ra = allRules(A.children), rb = allRules(B.children);
    if (ra.length !== rb.length) throw new Error(`[css-fanout] 규칙 수 ${ra.length} ≠ ${rb.length}`);
    for (let k = 0; k < ra.length; k++) {
        if (before.slice(ra[k].bodyStart, ra[k].bodyEnd) !== after.slice(rb[k].bodyStart, rb[k].bodyEnd)) throw new Error(`[css-fanout] ${k}번째 규칙 선언이 달라짐`);
        if (JSON.stringify(ra[k].ctx) !== JSON.stringify(rb[k].ctx)) throw new Error(`[css-fanout] ${k}번째 규칙의 @묶음이 달라짐`);
    }
}

module.exports = { fanout, fanOne, fanStep, wholeIs, insertAt };

if (require.main === module) {
    const fs = require('fs');
    const r = fanout(fs.readFileSync(process.argv[2] || require('path').join(__dirname, '..', 'src/style-lazy.gen.css'), 'utf8'));
    console.log(JSON.stringify(r.stats));
}
