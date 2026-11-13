/* =========================================================
   1.1.6 CSS 줄이기 첫 걸음 — tools/css-gates.cjs (기준 · 예외: tools/css-gates.json)

   왜: 늘 붙는 두 시트(첫 장 style.css · 전체 장 src/style-lazy.gen.css)에 「설정을 켜야만 맞는 규칙」(글자 외곽선 선택자 하나가 5만 자)과
   「테마 설정 창 안에서만 맞는 규칙」이 매 부팅 실려 해석 · 선택자 바구니 비용을 냈어요. 1.1.1 마크다운 · 9.0.1 미리보기처럼 떼어 두고 쓸 때만 붙여요.

   무엇을(선택자 글만으로 · 손으로 고르지 않아요):
     · 켜짐 규칙: 쉼표 갈래 하나하나가 css-gates.json gates 의 클래스를 꼭 요구해요 — 괄호 밖 칸에 그 클래스가 있거나,
       괄호 밖 칸의 :is(.a, .b) 갈래가 모두 gates 클래스예요(그중 하나만 켜도 맞을 수 있어 둘 다 「켜는 클래스」로 셈).
       gates 는 기본값에서 꺼진 설정의 클래스만이라, 기본값에서는 이 규칙이 하나도 맞지 않아요.
     · 설정 창 규칙: :is · :where 를 끝까지 펼친 갈래마다 :not 밖 · 괄호 밖 칸에 .salty-panel 이 있어요(창이 없으면 안 맞아요).
   차례(가장 중요): 뗀 규칙은 테마 시트(첫 장 · 전체 장) · 미리보기 시트 뒤에 시트 차례(sheets 차례 → 설정 창)로 붙어요. 그래서 원래 그 규칙보다 뒤에 있던 규칙과
     「같은 요소에 맞을 수 있고 · 같은 속성 묶음(줄임 · 긴 속성 · 접두사) · 같은 !important · 같은 특이도」면 덮어쓰기가 뒤집혀요 —
     그런 짝이 하나라도 있으면 그 규칙은 떼지 않고 제자리에 둬요(예외, 끝까지 되풀이). 미리보기 시트 규칙과의 앞뒤도 같은 셈으로 따지고, 자리를 모르는 호환 시트와 겨루는 규칙은 남겨요.
     → 남은 규칙끼리 · 뗀 규칙끼리의 차례는 그대로이고, 차례가 바뀐 짝은 모두 서로 덮지 않는 짝이에요(tools/tests/css-gates-order.mjs 가 매번 다시 셈).
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./css-lib.cjs');

const CONFIG = path.join(__dirname, 'css-gates.json');
const SENTINEL = '#salty-lazy-panel-start {}';

function loadConfig(file = CONFIG) {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    const classes = new Set(), prefixes = [];
    for (const g of c.gates) { if (g.class) classes.add(g.class); if (g.prefix) prefixes.push(g.prefix); }
    // 접두사(salty-md-)는 body 칸에서만 — 같은 접두사의 요소 클래스(.salty-md-i · .salty-md-mark …)는 늘 붙어 있어요. 이름을 다 적은 클래스는 어느 칸이든(apply.js 만 붙여요)
    const eligible = (name, onBody = true) => classes.has(name) || (onBody && prefixes.some(p => name.startsWith(p)));
    return { ...c, eligible, gateClasses: classes, gatePrefixes: prefixes };
}

// 화면 뿌리(tools/css-gates.json roots) — 갈래가 어느 뿌리 안에서만 맞나. 펼친 갈래마다 뿌리 종류 모음(빈 모음 = 어디서나)
let ROOTS = null;
const rootCache = new Map();
function rootKinds(branch) {
    let hit = rootCache.get(branch);
    if (hit) return hit;
    hit = lib.expand(branch).map(sub => {
        const outer = bare(lib.stripNot(sub));
        const kinds = new Set();
        for (const [kind, names] of ROOTS.kinds) if (names.some(n => new RegExp(`${n.replace(/[.#]/g, m => `\\${m}`)}(?![\\w-])`).test(outer))) kinds.add(kind);
        return kinds;
    });
    rootCache.set(branch, hit);
    return hit;
}
/** 갈래의 body 칸(괄호 밖)에 꼭 있어야 하는 클래스 가운데 한 번에 하나만 붙는 묶음(exclusive) 것 → Map(묶음 → 클래스) */
const exclCache = new Map();
function exclusiveOf(branch) {
    let hit = exclCache.get(branch);
    if (hit) return hit;
    hit = new Map();
    const lead = lib.compounds(branch).find(c => /^body(?![\w-])/.test(c));
    for (const name of lead ? (bare(lead).match(/\.[\w-]+/g) || []).map(x => x.slice(1)) : []) {
        for (const [i, re] of ROOTS.exclusive.entries()) { const m = re.exec(name); if (m) hit.set(`${i}:${m[1]}`, name); }
    }
    exclCache.set(branch, hit);
    return hit;
}
/** 두 갈래가 같은 요소에 같은 때 맞을 수 없나 — 서로 안에 들어가지 않는 화면 뿌리 · 한 번에 하나만 붙는 body 클래스 */
function apart(x, y) {
    if (ROOTS?.exclusive.length) {
        const a = exclusiveOf(x), b = exclusiveOf(y);
        for (const [g, name] of a) if (b.has(g) && b.get(g) !== name) return true;
    }
    if (!ROOTS || !ROOTS.apart.length) return false;
    const kx = rootKinds(x), ky = rootKinds(y);
    return kx.every(a => ky.every(b => [...a].some(p => [...b].some(q => ROOTS.apart.some(([u, v]) => (u === p && v === q) || (u === q && v === p))))));
}
function setRoots(cfg) {
    const r = cfg.roots || {};
    ROOTS = { kinds: Object.entries(r).filter(([k, v]) => Array.isArray(v) && k !== 'apart'), apart: r.apart || [], exclusive: (cfg.exclusive?.patterns || []).map(p => new RegExp(p)) };
    rootCache.clear(); exclCache.clear();
}

/** 괄호 · 대괄호 묶음을 지운 글 */
function bare(s) {
    let out = '', depth = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '"' || c === "'") { const e = lib.endString(s, i); if (!depth) out += s.slice(i, e); i = e - 1; continue; }
        if (c === '(' || c === '[') { depth++; continue; }
        if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); continue; }
        if (!depth) out += c;
    }
    return out;
}
/** compound 의 괄호 밖 :is( … ) · :where( … ) 인자 목록들 */
function topIsGroups(compound) {
    const out = [];
    let depth = 0;
    for (let i = 0; i < compound.length; i++) {
        const c = compound[i];
        if (c === '(' || c === '[') { depth++; continue; }
        if (c === ')' || c === ']') { depth--; continue; }
        if (depth || c !== ':') continue;
        const m = /^:(is|where)\(/i.exec(compound.slice(i));
        if (!m) continue;
        const open = i + m[0].length - 1, close = lib.endParen(compound, open);
        out.push(lib.topSplit(compound.slice(open + 1, close)));
        i = close;
    }
    return out;
}
/** 갈래 하나를 맞추려면 켜져야 하는 gates 클래스 — [하나] 또는 [아무거나 하나(:is)], 없으면 null */
function branchTriggers(branch, eligible) {
    const comps = lib.compounds(branch);
    const onBody = comp => /^body(?![\w-])/.test(comp);
    for (const comp of comps) {
        const plain = (bare(comp).match(/\.[\w-]+/g) || []).map(x => x.slice(1));
        const hit = plain.find(n => eligible(n, onBody(comp)));
        if (hit) return [hit];
    }
    for (const comp of comps) {
        for (const args of topIsGroups(comp)) {
            const names = args.map(a => (/^\.([\w-]+)$/.exec(a.trim()) || [])[1]);
            if (names.length && names.every(n => n && eligible(n, onBody(comp)))) return names;
        }
    }
    return null;
}
/** 규칙의 켜는 클래스 모음(아무거나 하나라도 켜지면 맞을 수 있음) — 갈래 하나라도 gates 를 안 요구하면 null */
function ruleTriggers(selector, eligible) {
    const set = new Set();
    for (const b of lib.topSplit(selector)) {
        const t = branchTriggers(b, eligible);
        if (!t) return null;
        t.forEach(x => set.add(x));
    }
    return set.size ? set : null;
}
/** 설정 창(.salty-panel) 안에서만 맞나 */
function panelOnly(selector, root = 'salty-panel') {
    const re = new RegExp(`\\.${root}(?![\\w-])`);
    if (!re.test(selector)) return false;
    return lib.topSplit(selector).every(part => lib.expand(part).every(branch => re.test(bare(lib.stripNot(branch)))));
}

/** 시트 글 → 겨루기 색인 { key → [{ idx, branch }] } (key = 속성 묶음 | !important | 특이도) */
function conflictIndex(rules) {
    const index = new Map();
    rules.forEach((r, idx) => {
        const branches = lib.topSplit(r.selector).map(b => ({ b, s: lib.spec(b).join(',') }));
        const fams = new Set(), sig = new Map();
        for (const d of r.decls) {
            if (d.nested) continue;
            const f = `${lib.family(d.lname)}\u0001${d.important ? 1 : 0}`;
            fams.add(f);
            sig.set(f, `${sig.get(f) || ''}${d.lname}:${d.value.replace(/\s+/g, ' ')};`);
        }
        r._sig = sig;
        const push = (key, b) => { let list = index.get(key); if (!list) index.set(key, list = []); list.push({ idx, branch: b }); };
        for (const f of fams) {
            const [fam, imp] = f.split('\u0001');
            for (const { b, s } of branches) {
                push(`${fam}\u0001${imp}\u0001${s}`, b);
                if (!fam.startsWith('--')) push(`ANY\u0001${imp}\u0001${s}`, b);   // all 을 쓰는 규칙이 찾을 자리
            }
        }
        r._fams = fams; r._branches = branches;
    });
    return index;
}
/** rule 과 차례에 따라 결과가 달라질 수 있는 규칙 번호들 — 같은 요소에 맞을 수 있고(글로 못 가름) 같은 속성 묶음 · 같은 !important · 같은 특이도.
 *  그 속성 묶음의 선언이 글자까지 같으면(미리보기 사본 같은 것) 누가 이겨도 값이 같아 빼요 */
function pairsWith(index, rule, filter, rules) {
    const out = new Set();
    for (const f of rule._fams) {
        const [fam, imp] = f.split('\u0001');
        for (const { b, s } of rule._branches) {
            const keys = fam === '*' ? [`ANY\u0001${imp}\u0001${s}`] : [`${fam}\u0001${imp}\u0001${s}`, ...(fam.startsWith('--') ? [] : [`*\u0001${imp}\u0001${s}`])];
            for (const key of keys) for (const y of index.get(key) || []) {
                if (out.has(y.idx) || !filter(y.idx)) continue;
                const other = rules[y.idx];
                if (fam !== '*' && !key.startsWith('*') && other._sig.get(f) === rule._sig.get(f)) continue;
                if (!lib.disjoint(b, y.branch) && !apart(b, y.branch)) out.add(y.idx);
            }
        }
    }
    return out;
}

/** 시트 글의 99 꼬리 앞 · 규칙 목록 */
function headRules(text, what) {
    const cut = text.lastIndexOf(SENTINEL);
    const head = cut >= 0 ? text.slice(0, cut) : text;
    const tree = lib.parse(head);
    if (tree.problems.length) throw new Error(`[css-gates] ${what} 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    return { head, rules: lib.flatRules(tree) };
}

/**
 * 뗄 규칙을 정해요. 차례는 미리보기 · 호환 규칙이 아직 제자리에 있는 글(build-css pipe 의 펼친 글)로 따지고, 정한 것을 마지막 글(전체 장)에 옮겨 적어요.
 * 마지막 차례(브라우저가 보는 것): 남은 규칙(원래 차례) → 미리보기 시트 → sheets 차례의 켜짐 시트들 → 설정 창 시트. 호환 시트는 자리를 모른다고 봐요.
 * @param {{ order: string, previewOnly: (sel: string) => boolean, compatKeys: string[], final: string, config?: object }} input
 *   order = 미리보기 · 호환을 떼기 전 펼친 글 · compatKeys = 그 글에서 호환 시트로 간 규칙 열쇠(keyOf) · final = 데우스 칸 나누기 전 마지막 전체 장 글
 */
function plan(input) {
    const cfg = input.config || loadConfig();
    setRoots(cfg);
    const { head: oHead, rules: O } = headRules(input.order, '차례 글');
    const { head, rules: F } = headRules(input.final, '전체 장');
    const nGate = cfg.sheets.length, PANEL = nGate, PREVIEW = nGate + 1, COMPAT = -1;
    const compat = new Map();
    for (const k of input.compatKeys || []) compat.set(k, (compat.get(k) || 0) + 1);
    // 규칙마다 갈 곳: undefined = 남음 · 0..nGate-1 켜짐 시트 · PANEL · PREVIEW(고정) · COMPAT(고정, 자리 모름)
    const place = new Array(O.length);
    const fixed = new Set();
    const finalOf = new Array(O.length).fill(-1);
    let f = 0;
    O.forEach((r, i) => {
        if (input.previewOnly(r.selector)) { place[i] = PREVIEW; fixed.add(i); return; }
        const k = keyOf(oHead, r);
        if (compat.get(k)) { compat.set(k, compat.get(k) - 1); place[i] = COMPAT; fixed.add(i); return; }
        finalOf[i] = f++;
    });
    if (f !== F.length) throw new Error(`[css-gates] 차례 글(미리보기 · 호환 뺌) 규칙 ${f}개 ≠ 전체 장 ${F.length}개 — 바꿔 쓰기가 규칙 수를 바꿨어요`);
    O.forEach((r, i) => {
        const j = finalOf[i]; if (j < 0) return;
        const a = r.decls.filter(d => !d.nested).map(d => d.lname).join(','), b = F[j].decls.filter(d => !d.nested).map(d => d.lname).join(',');
        if (a !== b) throw new Error(`[css-gates] ${i}번째 규칙이 전체 장 ${j}번째와 선언이 달라요: ${r.selector.slice(0, 80)} ↔ ${F[j].selector.slice(0, 80)}`);
    });
    // 같은 글 규칙이 두 번 있으면 떼지 않아요(열쇠로 지우므로)
    const seen = new Map();
    F.forEach(r => { const k = keyOf(head, r); seen.set(k, (seen.get(k) || 0) + 1); });
    const triggers = new Map();
    const kept = [];
    const keepManual = (cfg.keep || []).map(k => k.selectorIncludes).filter(Boolean);
    O.forEach((r, i) => {
        if (fixed.has(i)) return;
        const fin = F[finalOf[i]];
        if (/^#bl-dem-slot-/.test(fin.selector) || r.selector === ':root') return;
        const t = ruleTriggers(r.selector, cfg.eligible);
        const g = t ? cfg.sheets.findIndex(s => s.prefixes.includes('*') || [...t].every(c => s.classes.includes(c) || s.prefixes.some(p => c.startsWith(p))))
            : cfg.panel && panelOnly(r.selector, cfg.panel.root) ? PANEL : -1;
        if (g < 0) return;
        if (keepManual.some(k => r.selector.includes(k))) { kept.push({ i, why: 'keep 목록' }); return; }
        if (seen.get(keyOf(head, fin)) > 1) { kept.push({ i, why: '같은 글 규칙이 둘' }); return; }
        place[i] = g; if (t) triggers.set(i, t);
    });
    // 되풀이: 뗀 규칙 m 과 겨루는 규칙 x 의 마지막 차례가 원래와 뒤집히면 m 을 제자리에 둬요(호환은 자리를 모르니 겨루기만 해도)
    // 미리보기 시트는 뗀 규칙 시트들 앞(1.1.6 — 미리보기 사본(23-preview.gen)은 원래 앞 모듈이라 이 차례가 덜 뒤집혀요)
    const rank = i => (place[i] === undefined ? 0 : place[i] === COMPAT ? NaN : place[i] === PREVIEW ? 1 : 2 + place[i]);
    const movable = i => !fixed.has(i) && place[i] !== undefined;
    const index = conflictIndex(O);
    for (let changed = true; changed;) {
        changed = false;
        for (let m = 0; m < O.length; m++) {
            if (!movable(m)) continue;
            let why = null, other = -1;
            for (const x of pairsWith(index, O[m], idx => idx !== m, O)) {
                if (place[x] === COMPAT) { why = '호환 시트 규칙과 겨룸(자리 모름)'; other = x; break; }
                const flips = x > m ? rank(m) > rank(x) : rank(x) > rank(m);
                if (!flips) continue;
                why = x > m ? (place[x] === undefined ? '뒤 규칙(제자리)과 겨룸' : '뒤 규칙(앞 시트로 감)과 겨룸') : (place[x] === PREVIEW ? '앞 미리보기 규칙과 겨룸' : '앞 규칙(뒤 시트로 감)과 겨룸');
                other = x; break;
            }
            if (why) { kept.push({ i: m, why, with: O[other].selector }); place[m] = undefined; triggers.delete(m); changed = true; }
        }
    }
    const groups = [...cfg.sheets.map(s => ({ ...s, kind: 'gate' })), ...(cfg.panel ? [{ id: 'panel', out: cfg.panel.out, kind: 'panel', classes: [], prefixes: [], what: cfg.panel.what }] : [])]
        .map(s => ({ ...s, rules: [], trig: new Set() }));
    const moved = new Set();
    O.forEach((r, i) => {
        if (!movable(i)) return;
        const fin = F[finalOf[i]];
        groups[place[i]].rules.push(fin);
        for (const c of triggers.get(i) || []) groups[place[i]].trig.add(c);
        moved.add(keyOf(head, fin));
    });
    for (const g of groups) g.text = wrapRuns(head, g.rules);
    const finalKept = kept.filter(k => !movable(k.i)).map(k => ({ why: k.why, selector: F[finalOf[k.i]].selector, with: k.with, bytes: Buffer.byteLength(head.slice(F[finalOf[k.i]].start, F[finalOf[k.i]].end)) }));
    return { groups, moved, kept: finalKept, head };
}
function keyOf(text, r) { return `${r.ctx.join(' / ')}\n${text.slice(r.start, r.end)}`; }
/** 규칙들을 겉 조건(@media · @supports)으로 다시 싸서 차례대로 — 나란히 같은 겉이면 한 묶음 */
function wrapRuns(text, rules) {
    const out = [];
    let run = [], ctx = null;
    const flush = () => {
        if (!run.length) return;
        let block = run.map(r => text.slice(r.start, r.end)).join('\n');
        for (const outer of [...ctx].reverse()) block = `${outer} {\n${block}\n}`;
        out.push(block); run = [];
    };
    for (const r of rules) { const c = r.ctx.join('\u0000'); if (ctx === null || c !== ctx.join('\u0000')) { flush(); ctx = r.ctx; } run.push(r); }
    flush();
    return out.join('\n');
}
/** 시트 글에서 뗀 규칙(겉 조건 + 규칙 글이 같은 것)을 지워요 — 99 꼬리 뒤는 그대로. 빈 @media 껍데기도 지워요 */
function strip(text, moved) {
    const cut = text.lastIndexOf(SENTINEL);
    const head = cut >= 0 ? text.slice(0, cut) : text, tail = cut >= 0 ? text.slice(cut) : '';
    const tree = lib.parse(head);
    if (tree.problems.length) throw new Error(`[css-gates] 지우기 전 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const drop = lib.flatRules(tree).filter(r => moved.has(keyOf(head, r)));
    let out = head;
    for (const r of drop.sort((a, b) => b.start - a.start)) {
        let end = r.end; if (out[end] === '\n') end++;
        out = out.slice(0, r.start) + out.slice(end);
    }
    out = require('./css-park.cjs').dropEmptyGroups(out);
    return { text: out + tail, removed: drop.length };
}
/** 실행 중 표(src/css-gates.gen.js) — 시트마다 켜는 클래스(설정의 접두사로 접음) */
function runtimeTable(groups, cfg) {
    const fold = set => {
        const prefixes = new Set(), classes = new Set();
        for (const c of set) { const p = cfg.gatePrefixes.find(x => c.startsWith(x)); if (p) prefixes.add(p); else classes.add(c); }
        return { prefixes: [...prefixes].sort(), classes: [...classes].sort() };
    };
    const gates = groups.filter(g => g.kind === 'gate' && g.rules.length).map(g => ({ id: g.id, file: `./${path.posix.basename(g.out)}`, ...fold(g.trig) }));
    const panel = groups.find(g => g.kind === 'panel' && g.rules.length);
    return { gates, panel: panel ? `./${path.posix.basename(panel.out)}` : null };
}

module.exports = { loadConfig, setRoots, apart, branchTriggers, ruleTriggers, panelOnly, plan, strip, runtimeTable, wrapRuns, keyOf, conflictIndex, pairsWith, SENTINEL, CONFIG };
