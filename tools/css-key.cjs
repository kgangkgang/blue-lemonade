/* =========================================================
   규칙 바구니 열쇠 달기 (8.0.8 가볍게) — tools/css-key.cjs · build-css.cjs 가 style.css 를 쓰기 직전(#chat 바꿔 쓰기 뒤)에 부른다

   왜: 크롬(Blink)은 규칙을 맨 오른쪽 칸의 아이디 · 클래스 · 속성 · 태그로 바구니에 나눠 두고, 요소마다 제 바구니만 견준다.
   맨 오른쪽 칸에 그런 이름이 드러나 있지 않으면(`:is(.a .b)` 한 갈래 결합자 · `:is(#chat,.bl-chat-like)` 여러 갈래 ·
   특이도 보정 `:is(#bl-s, *)` 만 있는 칸) 「모든 요소와 견주는」 바구니로 간다. 8.0.7 에는 그런 갈래가 680개 —
   채팅 300 을 연 문서 전체 다시 계산(사용자 설정, CPU 1배) 252ms 중 약 69ms 였다.
   css-bucket.cjs(3.6.0)는 맨 오른쪽 칸이 여러 갈래 :is 로 「시작」할 때만 펼치고, 그 뒤 #chat 바꿔 쓰기(aliasChat)가
   `#chat` 을 `:is(#chat,.bl-chat-like)` 로 바꿔 다시 전체 바구니로 보낸 갈래도 많았다.

   바꾸는 것: 그런 칸에, 그 칸에 맞는 요소라면 반드시 가진 이름 K 를 `:where(K)` 로 하나 붙인다.
     · `:where()` 는 특이도 0 이라 특이도 그대로 · K 는 칸이 이미 요구하는 이름이라 뜻 그대로 · 규칙 순서 · 선언 그대로.
     · 한 갈래 `:where(K)` 는 크롬이 K 의 바구니에 넣는다(리그 실험: 선택자별 시도 횟수 0회).
     · K 찾기: 칸 안 한 갈래 :is/:where 의 맨 오른쪽 칸에서(되풀이), 여러 갈래면 갈래마다 K 를 구해
       `칸:where(K1)`, `칸:where(K2)` … 로 선택자를 나눈다(합집합 = 원래 칸, 갈래마다 특이도 = 원래 칸). 6갈래 넘으면 안 나눈다.
     · `*` 가 든 갈래(특이도 보정 `:is(#bl-s, *)` 등) · :not · :has · 가상 요소 안에서는 K 를 찾지 않는다 — 그런 칸은 그대로 둔다.
   확인: 바꾼 갈래마다 붙인 `:where(K)` 를 떼면 원래 글과 똑같은지, 특이도가 같은지, 규칙 수 · 선언 · @묶음이 같은지 보고 다르면 멈춘다.
   두 번 돌려도 같다(열쇠가 붙은 칸은 이미 바구니에 들어가므로 다시 안 건드린다) — tools/tests/css-key.mjs.
   브라우저에서 뜻이 같은지(고른 요소 집합이 같은지)는 리그에서 따로 본다(W/work/theme-light/key-equiv.mjs).
   ========================================================= */
'use strict';
const lib = require('./css-lib.cjs');

const MAX_SPLIT = 6;
const LEGACY_PE = /^:(before|after|first-line|first-letter)$/i;

/** 깊이 0 에서 마지막 compound 가 시작하는 자리 (css-bucket.cjs 와 같음) */
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

/** compound 하나를 단순 선택자 조각으로: {kind, text, name?, args?, at} */
function tokens(compound) {
    const out = [];
    let i = 0;
    const ident = j => { while (j < compound.length && /[\w\- -￿\\]/.test(compound[j])) j += compound[j] === '\\' ? 2 : 1; return j; };
    while (i < compound.length) {
        const c = compound[i];
        const at = i;
        if (c === '#') { const j = ident(i + 1); out.push({ kind: 'id', text: compound.slice(i, j), at }); i = j; continue; }
        if (c === '.') { const j = ident(i + 1); out.push({ kind: 'class', text: compound.slice(i, j), at }); i = j; continue; }
        if (c === '[') { const j = lib.endBracket(compound, i) + 1; out.push({ kind: 'attr', text: compound.slice(i, j), at }); i = j; continue; }
        if (c === ':') {
            const pe = compound[i + 1] === ':';
            let j = ident(i + (pe ? 2 : 1));
            const name = compound.slice(i + (pe ? 2 : 1), j).toLowerCase();
            let args = null;
            if (compound[j] === '(') { const e = lib.endParen(compound, j); args = compound.slice(j + 1, e); j = e + 1; }
            const text = compound.slice(i, j);
            out.push({ kind: pe || LEGACY_PE.test(':' + name) && !args ? 'pseudo-element' : 'pseudo', name, args, text, at });
            i = j; continue;
        }
        if (c === '*') { const j = compound[i + 1] === '|' ? ident(i + 2) : i + 1; out.push({ kind: 'universal', text: compound.slice(i, j), at }); i = j; continue; }
        if (/[a-zA-Z\\]/.test(c)) { let j = ident(i); if (compound[j] === '|') j = ident(j + 1); out.push({ kind: 'tag', text: compound.slice(i, j), at }); i = j; continue; }
        if (c === '&') { out.push({ kind: 'nest', text: '&', at }); i++; continue; }
        out.push({ kind: 'other', text: c, at }); i++;
    }
    return out;
}

/** 크롬이 이 compound 를 어느 바구니에 넣나(대강): id · class · attr · tag · universal. 한 갈래 :is/:where(한 compound) 는 그 안으로 */
function bucketOf(compound) {
    const ts = tokens(compound);
    const main = [];
    for (const t of ts) { if (t.kind === 'pseudo-element') break; main.push(t); }
    for (const k of ['id', 'class', 'attr', 'tag']) if (main.some(t => t.kind === k)) return k;
    for (const t of main) {
        if (t.kind !== 'pseudo' || !/^(is|where)$/.test(t.name) || t.args == null) continue;
        const parts = lib.topSplit(t.args);
        if (parts.length !== 1 || lib.compounds(parts[0]).length !== 1 || /^\s*[>+~]/.test(parts[0])) continue;
        const b = bucketOf(parts[0].trim());
        if (b !== 'universal') return b;
    }
    return 'universal';
}

/** 이 compound 에 맞는 요소가 반드시 가진 단순 선택자들(갈래마다 하나). 못 찾으면 null */
function keysOf(compound, depth = 0) {
    if (depth > 6) return null;
    const ts = tokens(compound);
    const main = [];
    for (const t of ts) { if (t.kind === 'pseudo-element') break; main.push(t); }
    if (main.some(t => t.kind === 'nest' || t.kind === 'other')) return null;
    for (const k of ['id', 'class', 'attr', 'tag']) { const t = main.find(x => x.kind === k); if (t) return [t.text]; }
    let best = null;
    for (const t of main) {
        if (t.kind !== 'pseudo' || !/^(is|where)$/.test(t.name) || t.args == null) continue;
        const parts = lib.topSplit(t.args);
        if (!parts.length) continue;
        const keys = [];
        let ok = true;
        for (const p of parts) {
            const a = p.trim();
            if (/^\s*[>+~]/.test(a) || /::|:-(webkit|moz|ms)-|:(host|slotted|part)\b/i.test(a)) { ok = false; break; }
            const last = a.slice(lastCompoundStart(a));
            const k = keysOf(last, depth + 1);
            if (!k) { ok = false; break; }
            for (const x of k) if (!keys.includes(x)) keys.push(x);
        }
        if (!ok || !keys.length) continue;
        if (!best || keys.length < best.length) best = keys;
        if (best.length === 1) break;
    }
    return best;
}

/** compound 안에 :where(K) 를 넣을 자리: 맨 앞(타입 · * 뒤) */
function insertAt(compound) {
    const ts = tokens(compound);
    if (ts.length && (ts[0].kind === 'universal' || ts[0].kind === 'tag')) return ts[0].text.length;
    return 0;
}

/** 선택자 갈래 하나 → [바꾼 갈래들] (안 바꾸면 null) */
function keyOne(branch, stats) {
    const sel = branch.trim();
    if (/&|:host|::slotted|::part/.test(sel)) return null;
    const at = lastCompoundStart(sel);
    const head = sel.slice(0, at), last = sel.slice(at);
    if (bucketOf(last) !== 'universal') return null;
    stats.universal++;
    const keys = keysOf(last);
    if (!keys) { stats.noKey++; return null; }
    if (keys.length > MAX_SPLIT) { stats.tooMany++; return null; }
    const pos = insertAt(last);
    stats.keyed++;
    if (keys.length > 1) stats.split++;
    return keys.map(k => `${head}${last.slice(0, pos)}:where(${k})${last.slice(pos)}`);
}

function allRules(nodes, out = []) {
    for (const n of nodes) {
        if (n.type === 'rule') out.push(n);
        else if (n.type === 'at' && n.children) allRules(n.children, out);
    }
    return out;
}

/** @returns {{ text: string, stats: object, changed: Array<[string,string[]]> }} */
function keyize(css) {
    const stats = { rules: 0, branches: 0, universal: 0, keyed: 0, split: 0, noKey: 0, tooMany: 0, rulesChanged: 0 };
    const tree = lib.parse(css);
    if (tree.problems.length) throw new Error(`열쇠 달기 전 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const edits = []; const changed = [];
    for (const r of allRules(tree.children)) {
        stats.rules++;
        const end = r.bodyStart - 1;
        const prelude = css.slice(r.start, end);
        const parts = lib.topSplit(prelude);
        stats.branches += parts.length;
        let any = false; const out = [];
        for (const p of parts) {
            const k = keyOne(p, stats);
            if (!k) { out.push(p); continue; }
            any = true; out.push(...k); changed.push([p, k]);
        }
        if (!any) continue;
        stats.rulesChanged++;
        edits.push([r.start, end, `${out.join(',\n')} `]);
    }
    let text = css;
    for (let k = edits.length - 1; k >= 0; k--) { const [a, b, s] = edits[k]; text = text.slice(0, a) + s + text.slice(b); }
    verify(css, text, changed);
    return { text, stats, changed };
}

function verify(before, after, changed) {
    for (const [old, news] of changed) {
        const so = lib.spec(old).join('.');
        for (const n of news) {
            const m = /:where\(([^()]*)\)/g; let ok = false, x;
            while ((x = m.exec(n))) { if (n.slice(0, x.index) + n.slice(x.index + x[0].length) === old.trim()) { ok = true; break; } }
            if (!ok) throw new Error(`열쇠를 떼도 원래 갈래가 아님:\n  전 ${old.slice(0, 160)}\n  후 ${n.slice(0, 160)}`);
            if (lib.spec(n).join('.') !== so) throw new Error(`특이도가 달라짐 ${so} → ${lib.spec(n).join('.')}: ${n.slice(0, 160)}`);
        }
    }
    const A = lib.parse(before), B = lib.parse(after);
    if (B.problems.length) throw new Error(`열쇠 단 뒤 읽기 문제: ${B.problems.slice(0, 3).join(' / ')}`);
    const ra = allRules(A.children), rb = allRules(B.children);
    if (ra.length !== rb.length) throw new Error(`열쇠 단 뒤 규칙 수 ${ra.length} ≠ ${rb.length}`);
    for (let k = 0; k < ra.length; k++) {
        if (before.slice(ra[k].bodyStart, ra[k].bodyEnd) !== after.slice(rb[k].bodyStart, rb[k].bodyEnd)) throw new Error(`${k}번째 규칙 선언이 달라짐`);
        if (JSON.stringify(ra[k].ctx) !== JSON.stringify(rb[k].ctx)) throw new Error(`${k}번째 규칙의 @묶음이 달라짐`);
    }
}

module.exports = { keyize, keyOne, keysOf, bucketOf, tokens };

if (require.main === module) {
    const fs = require('fs');
    const { text, stats, changed } = keyize(fs.readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify(stats));
    if (process.argv[3]) fs.writeFileSync(process.argv[3], text);
    if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(changed, null, 1));
}
