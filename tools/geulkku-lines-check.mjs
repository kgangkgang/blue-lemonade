#!/usr/bin/env node
// 글꾸 심플 틀 「글 문단 움직임」 검사 — 견본 글 구조에 박힌 자리 번호 규칙을 잡아요(11-15 「화내기」 글이 가운데만 움직이던 일).
// - 실행: node tools/geulkku-lines-check.mjs [틀…] [--table <파일.md>] [--json]   (node 24 · 외부 의존 없음)
//   틀을 안 주면 tools/simple-frames/*.html 전부. 실패(허용 목록 밖)가 있으면 1로 끝나요.
// - 하는 일
//   ① 정적: 누름(details[open]) 뒤 움직이는 규칙 가운데 본문(.gk-lg) 문단을 nth-child · nth-of-type 으로 고르는 것을 모아요.
//      「종류 + 자리」(예: .gk-dl:nth-child(3) — 셋째 자식이 대사일 때만 걸림)는 글 구조가 바뀌면 늘 틀리니 실패로 셉니다.
//   ② 구조 여섯 가지: 틀의 .gk-lg 자식을 견본 꼴 · 이름 숨김 · 서술만 · 대사만 · 문단 1개 · 문단 30개로 갈아 끼우고, 연 상태에서
//      어느 문단이 움직이는지 CSS 선택자를 직접 맞대 계산해요(작은 선택자 엔진 · :has · :not · :is · :nth-child(of) · ~ · + 지원).
//      견본 꼴에서 종류(서술 · 이름 · 대사)마다 「전부 / 일부 / 안 움직임」을 읽고, 다른 구조에서도 같은 뜻인지 봐요:
//        전부 → 그 종류는 전부 움직여야 · 안 움직임 → 하나도 안 움직여야 · 일부 → 하나 이상 움직여야.
// - 브라우저가 아니라 선택자 계산이에요. 실제 화면은 리그 사진으로 따로 봐요.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools', 'simple-frames');

// 의도를 가릴 수 없어 일부러 남긴 틀(까닭을 꼭 적어요) — 여기 넣으면 실패 대신 「허용」으로 보여요
//   지금은 비어 있어요. 11-15 에 의도를 못 가려 손대지 않은 k1205(.gk-nm:nth-child(n+4)) · k1274(.gk-nr:nth-child(n+4))는 검사를 지나가서 여기 없어요
//   (꼬리 n+K 꼴이라 「첫 메시지 빼기」로 읽혀요 — 고칠지는 사용자 판정 몫)
export const ALLOW = {};

/* ---------- 아주 작은 HTML 나무 ---------- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function el(tag, attrs = {}, kids = []) {
  const e = { tag, attrs, kids: [], parent: null, cls: new Set(String(attrs.class || '').split(/\s+/).filter(Boolean)) };
  for (const k of kids) add(e, k);
  return e;
}
function add(p, c) { c.parent = p; p.kids.push(c); return c; }
export function parseHtml(html) {
  const root = el('#root');
  let cur = root;
  const s = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const re = /<\/?([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = re.exec(s))) {
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') {
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent;
      continue;
    }
    const attrs = {};
    for (const a of m[2].matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    const e = add(cur, el(tag, attrs));
    if (!VOID.has(tag) && !m[0].endsWith('/>')) cur = e;
  }
  return root;
}
const elKids = e => e.kids;
function* walk(e) { for (const k of e.kids) { yield k; yield* walk(k); } }

/* ---------- CSS 규칙 ---------- */
function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const o = css.indexOf('{', i);
    if (o < 0) break;
    let d = 1, j = o + 1;
    while (j < css.length && d) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
    out.push({ head: css.slice(i, o).trim(), body: css.slice(o + 1, j - 1) });
    i = j;
  }
  return out;
}
export function rulesOf(css) {
  const out = [];
  for (const b of blocks(String(css).replace(/\/\*[\s\S]*?\*\//g, ''))) {
    if (b.head.startsWith('@')) {
      if (/^@(-\w+-)?keyframes|^@font-face/i.test(b.head)) continue;
      if (/prefers-reduced-motion\s*:\s*reduce/i.test(b.head)) continue;   // 움직임 줄이기 판은 따로(다 꺼요)
      out.push(...rulesOf(b.body));
      continue;
    }
    out.push({ sel: b.head, decl: b.body });
  }
  return out;
}
const isMotion = r => {
  const an = /(^|;)\s*animation(-name)?\s*:\s*([^;]*)/i.exec(r.decl);
  if (an && !/^\s*none\b/i.test(an[3])) return true;
  if (/(^|;)\s*animation-delay\s*:/i.test(r.decl)) return true;
  if (/(^|;)\s*transition(-delay)?\s*:/i.test(r.decl) && /\[open\]|:checked/.test(r.sel)) return true;
  return false;
};

/* ---------- 선택자 엔진(필요한 만큼) ---------- */
function splitTop(s, ch) {
  const out = []; let d = 0, q = null, cur = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(' || c === '[') d++;
    if (c === ')' || c === ']') d--;
    if (c === ch && !d) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
// 복합 선택자 목록 → [{ comb, parts }] (왼쪽부터)
function parseComplex(sel) {
  const seq = []; let i = 0, comb = null;
  const s = sel.trim();
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) || c === '>' || c === '~' || c === '+') {
      let j = i, k = ' ';
      while (j < s.length && /[\s>~+]/.test(s[j])) { if (s[j] !== ' ' && !/\s/.test(s[j])) k = s[j]; j++; }
      comb = k; i = j; continue;
    }
    let j = i, d = 0, q = null;
    while (j < s.length) {
      const x = s[j];
      if (q) { if (x === q) q = null; j++; continue; }
      if (x === '"' || x === "'") { q = x; j++; continue; }
      if (x === '(' || x === '[') d++;
      else if (x === ')' || x === ']') d--;
      else if (!d && (/\s/.test(x) || x === '>' || x === '~' || x === '+')) break;
      j++;
    }
    seq.push({ comb: seq.length ? comb || ' ' : null, parts: parseCompound(s.slice(i, j)) });
    comb = null; i = j;
  }
  return seq;
}
function parseCompound(t) {
  const parts = []; let i = 0;
  const name = () => { let j = i; while (j < t.length && /[\w\-\\]/.test(t[j])) j++; const v = t.slice(i, j); i = j; return v; };
  while (i < t.length) {
    const c = t[i];
    if (c === '*') { i++; continue; }
    if (c === '.') { i++; parts.push({ k: 'cls', v: name() }); continue; }
    if (c === '#') { i++; parts.push({ k: 'id', v: name() }); continue; }
    if (c === '[') { const j = t.indexOf(']', i); const body = t.slice(i + 1, j); i = j + 1; const m = /^([\w-]+)\s*(?:([~|^$*]?=)\s*["']?([^"'\]]*)["']?)?/.exec(body); parts.push({ k: 'attr', n: m[1].toLowerCase(), op: m[2], v: m[3] }); continue; }
    if (c === ':') {
      const pe = t[i + 1] === ':'; i += pe ? 2 : 1;
      const n = name().toLowerCase();
      let arg = null;
      if (t[i] === '(') { let d = 1, j = i + 1; while (j < t.length && d) { if (t[j] === '(') d++; else if (t[j] === ')') d--; j++; } arg = t.slice(i + 1, j - 1); i = j; }
      if (pe || ['before', 'after', 'first-letter', 'first-line', 'marker', 'selection', 'placeholder'].includes(n)) { parts.push({ k: 'pe' }); continue; }
      parts.push({ k: 'ps', n, arg });
      continue;
    }
    if (/[a-zA-Z]/.test(c)) { parts.push({ k: 'tag', v: name().toLowerCase() }); continue; }
    i++;
  }
  return parts;
}
const cache = new Map();
const compile = sel => { if (!cache.has(sel)) cache.set(sel, splitTop(sel, ',').map(parseComplex)); return cache.get(sel); };
function anb(arg) {
  const a0 = arg.trim().toLowerCase();
  if (a0 === 'odd') return [2, 1];
  if (a0 === 'even') return [2, 0];
  const m = /^([+-]?\d*)?n\s*(?:([+-])\s*(\d+))?$/.exec(a0.replace(/\s+/g, ''));
  if (m) { const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : +(m[1] ?? 1); return [a, m[2] ? (m[2] === '-' ? -1 : 1) * +m[3] : 0]; }
  return [0, +a0];
}
const fits = ([a, b], i) => (a === 0 ? i === b : (i - b) / a >= 0 && (i - b) % a === 0);
function matchCompound(e, parts) {
  if (!e || e.tag === '#root') return false;
  for (const p of parts) {
    if (p.k === 'pe') continue;
    if (p.k === 'tag' && e.tag !== p.v) return false;
    if (p.k === 'cls' && !e.cls.has(p.v)) return false;
    if (p.k === 'id' && e.attrs.id !== p.v) return false;
    if (p.k === 'attr') {
      const v = e.attrs[p.n];
      if (v == null) return false;
      if (p.op === '=' && v !== p.v) return false;
      if (p.op === '~=' && !v.split(/\s+/).includes(p.v)) return false;
      if (p.op === '*=' && !v.includes(p.v)) return false;
      if (p.op === '^=' && !v.startsWith(p.v)) return false;
      if (p.op === '$=' && !v.endsWith(p.v)) return false;
    }
    if (p.k === 'ps' && !matchPseudo(e, p)) return false;
  }
  return true;
}
function matchPseudo(e, p) {
  const sib = e.parent ? elKids(e.parent) : [e];
  const idx = sib.indexOf(e);
  switch (p.n) {
    case 'has': return compile(p.arg.replace(/^\s*>/, ':scope>')).some(seq => [...walk(e)].some(d => matchSeq(d, seq, e)));
    case 'not': return !compile(p.arg).some(seq => matchSeq(e, seq));
    case 'is': case 'where': case 'matches': return compile(p.arg).some(seq => matchSeq(e, seq));
    case 'scope': return true;
    case 'first-child': return idx === 0;
    case 'last-child': return idx === sib.length - 1;
    case 'only-child': return sib.length === 1;
    case 'first-of-type': return sib.filter(x => x.tag === e.tag).indexOf(e) === 0;
    case 'last-of-type': { const t = sib.filter(x => x.tag === e.tag); return t.indexOf(e) === t.length - 1; }
    case 'empty': return !e.kids.length;
    case 'nth-child': case 'nth-last-child': {
      const [f, of] = p.arg.split(/\s+of\s+/i);
      let list = sib;
      if (of) { if (!matchSeqList(e, of)) return false; list = sib.filter(x => matchSeqList(x, of)); }
      const i = list.indexOf(e);
      return fits(anb(f), p.n === 'nth-child' ? i + 1 : list.length - i);
    }
    case 'nth-of-type': case 'nth-last-of-type': {
      const list = sib.filter(x => x.tag === e.tag), i = list.indexOf(e);
      return fits(anb(p.arg), p.n === 'nth-of-type' ? i + 1 : list.length - i);
    }
    case 'checked': return e.attrs.checked != null;
    default: return false;   // :hover · :focus 등은 누른 뒤 상태가 아니에요
  }
}
const matchSeqList = (e, sel) => compile(sel).some(seq => matchSeq(e, seq));
// seq 를 오른쪽부터 e 에 맞대요 (scope = :has 의 기준 요소)
function matchSeq(e, seq, scope = null, at = seq.length - 1) {
  const step = seq[at];
  if (step.parts.some(p => p.k === 'ps' && p.n === 'scope')) { if (e !== scope) return false; }
  else if (!matchCompound(e, step.parts)) return false;
  if (at === 0) return scope ? isUnder(e, scope) : true;
  const comb = step.comb;
  if (comb === '>') return matchSeq(e.parent, seq, scope, at - 1) || false;
  if (comb === ' ') { for (let p = e.parent; p && p.tag !== '#root'; p = p.parent) { if (matchSeq(p, seq, scope, at - 1)) return true; if (p === scope) break; } return false; }
  const sib = e.parent ? elKids(e.parent) : [];
  const i = sib.indexOf(e);
  if (comb === '+') return i > 0 && matchSeq(sib[i - 1], seq, scope, at - 1);
  if (comb === '~') { for (let j = i - 1; j >= 0; j--) if (matchSeq(sib[j], seq, scope, at - 1)) return true; return false; }
  return false;
}
const isUnder = (e, scope) => { for (let p = e; p; p = p.parent) if (p === scope) return true; return false; };

/* ---------- 구조 여섯 가지 ---------- */
const NR = () => el('p', { class: 'gk-nr' });
const NM = x => el('p', { class: 'gk-nm gk-n' + x });
const DL = x => el('p', { class: 'gk-dl' }, [el('span', { class: 'gk-d gk-d' + x })]);
export const SHAPES = {
  견본: () => [NR(), NM('A'), DL('A'), NR(), NM('B'), DL('B')],
  이름숨김: () => [NR(), DL('A'), NR(), DL('B'), NR(), DL('A')],
  서술만: () => [NR(), NR(), NR(), NR()],
  대사만: () => [DL('A'), DL('B'), DL('A'), DL('B')],
  문단1: () => [NR()],
  문단30: () => Array.from({ length: 30 }, (_, i) => (i % 2 ? DL(i % 4 === 1 ? 'A' : 'B') : NR())),
};
const ga = k => (k === '대사' ? '대사가' : k + '이');
const kindOf = e => (e.cls.has('gk-dl') ? '대사' : e.cls.has('gk-nm') ? '이름' : '서술');

/** 한 틀 · 한 구조: 연 상태에서 움직이는 .gk-lg 자식 번호(1부터) */
export function movedLines(html, rules, shape) {
  const root = parseHtml(html);
  const all = [...walk(root)];
  for (const d of all) if (d.cls.has('gk-kx') && d.tag === 'details') d.attrs.open = '';
  const lg = all.find(d => d.cls.has('gk-lg'));
  if (!lg) return null;
  lg.kids = [];
  for (const c of SHAPES[shape]()) add(lg, c);
  const kids = elKids(lg), moved = new Set(), by = new Map();
  for (const r of rules) {
    const seqs = compile(r.sel);
    kids.forEach((k, i) => {
      for (const t of [k, ...walk(k)]) if (seqs.some(seq => matchSeq(t, seq))) { moved.add(i + 1); if (!by.has(i + 1)) by.set(i + 1, r.sel); break; }
    });
  }
  return { n: kids.length, kinds: kids.map(kindOf), moved: [...moved].sort((a, b) => a - b), by };
}

/** 정적: 본문 문단을 자리 번호로 고르는 움직임 규칙 */
//   「종류 + 자리」라도 같은 종류에 꼬리 규칙(:nth-child(n+K) 꼴)이 있으면 물결의 한 칸이라 실패로 안 셉니다(예: 종 치기 k1181 — 줄마다 차례 + 대사는 울림 하나 더)
const KIND_POS = /\.gk-(dl|nr|nm)\b[^\s>~+]*:nth-(?:last-)?(?:child|of-type)\((?![^)]*\bof\b)([^)]*)\)|:nth-(?:last-)?(?:child|of-type)\((?![^)]*\bof\b)([^)]*)\)[^\s>~+]*\.gk-(dl|nr|nm)\b/;
export function positional(rules) {
  const out = [];
  for (const r of rules) for (const one of splitTop(r.sel, ',')) {
    const at = one.lastIndexOf('gk-lg');
    const tail = at < 0 ? one.slice(one.search(/\.gk-(dl|nr|nm)\b/) < 0 ? one.length : one.search(/\.gk-(dl|nr|nm)\b/)) : one.slice(at);
    if (!/:nth-(last-)?(child|of-type)\(/.test(tail)) continue;
    const m = KIND_POS.exec(tail);
    out.push({ sel: one, kind: m ? m[1] || m[4] : null, arg: m ? (m[2] ?? m[3]).trim() : null });
  }
  for (const p of out) {
    // 꼬리(n+K) 자체이거나, 같은 종류의 꼬리가 있는 물결 칸이면 괜찮아요
    p.kindPos = !!p.kind && !/n\s*\+/.test(p.arg) && !out.some(q => q.kind === p.kind && /^n\s*\+\s*\d+$/.test(q.arg));
  }
  return out;
}

export function checkFrame(file) {
  const html = fs.readFileSync(file, 'utf8');
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const rules = rulesOf(css).filter(isMotion);
  const frame = path.basename(file, '.html');
  const res = {};
  for (const s of Object.keys(SHAPES)) res[s] = movedLines(html, rules, s);
  const pos = positional(rules);
  const fails = [];
  for (const p of pos) if (p.kindPos) fails.push('종류 + 자리 번호: ' + p.sel.replace(/\s+/g, ' ').slice(0, 120));
  const base = res.견본;
  // 「첫 줄은 그대로 · 둘째 줄부터」(지문 위 공백을 지키려고 첫 자식을 일부러 뺀 물결 — 글움직임-R1.cjs #60 주석): 다른 구조에서도 첫 자식만 빼고 전부여야 해요
  const from2 = base && base.n > 2 && !base.moved.includes(1) && base.moved.length === base.n - 1;
  if (from2) {
    for (const [s, r] of Object.entries(res)) {
      if (s === '견본' || !r) continue;
      const miss = Array.from({ length: r.n - 1 }, (_, i) => i + 2).filter(i => !r.moved.includes(i));
      if (miss.length) fails.push(`${s}: 견본에선 첫 줄 빼고 전부 움직이는데 ${miss.slice(0, 6).join(',')}번이 안 움직임`);
      if (r.moved.includes(1)) fails.push(`${s}: 견본에선 첫 줄이 가만있는데 움직임`);
    }
    res.뜻 = '첫 줄 빼고 전부';
  } else if (base) {
    const want = {};
    for (const k of ['서술', '이름', '대사']) {
      const idx = base.kinds.map((x, i) => (x === k ? i + 1 : 0)).filter(Boolean);
      const mv = idx.filter(i => base.moved.includes(i));
      want[k] = !idx.length ? null : mv.length === idx.length ? '전부' : mv.length ? '일부' : '없음';
    }
    for (const [s, r] of Object.entries(res)) {
      if (s === '견본' || !r) continue;
      for (const k of ['서술', '이름', '대사']) {
        const idx = r.kinds.map((x, i) => (x === k ? i + 1 : 0)).filter(Boolean);
        if (!idx.length || !want[k]) continue;
        const mv = idx.filter(i => r.moved.includes(i));
        if (want[k] === '전부' && mv.length !== idx.length) fails.push(`${s}: 견본에선 ${k} 전부가 움직이는데 ${idx.length}개 중 ${mv.length}개만 (안 움직임 ${idx.filter(i => !mv.includes(i)).slice(0, 6).join(',')}${idx.length - mv.length > 6 ? '…' : ''})`);
        if (want[k] === '없음' && mv.length) fails.push(`${s}: 견본에선 ${ga(k)} 안 움직이는데 ${mv.join(',')}번 ${ga(k)} 움직임`);
        if (want[k] === '일부' && !mv.length) fails.push(`${s}: 견본에선 ${k} 일부가 움직이는데 하나도 안 움직임`);
      }
    }
    res.뜻 = want;
  }
  return { frame, res, pos, fails, allow: ALLOW[frame] || null };
}

const fmt = r => (r ? (r.moved.length ? (r.moved.length === r.n ? '전부' : r.moved.join(',')) : '-') + '/' + r.n : '없음');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ti = args.indexOf('--table'), tableOut = ti >= 0 ? args[ti + 1] : null;
  const names = args.filter((a, i) => !a.startsWith('--') && !(ti >= 0 && i === ti + 1));
  const files = (names.length ? names.map(n => path.join(SRC, n.replace(/\.html$/, '') + '.html')) : fs.readdirSync(SRC).filter(n => n.endsWith('.html')).sort().map(n => path.join(SRC, n)));
  const all = files.map(checkFrame);
  const bad = all.filter(x => x.fails.length && !x.allow), allowed = all.filter(x => x.fails.length && x.allow);
  const withPos = all.filter(x => x.pos.length);
  if (args.includes('--json')) { console.log(JSON.stringify(all.map(({ frame, fails, allow, pos }) => ({ frame, fails, allow, pos: pos.length })), null, 1)); }
  else {
    for (const x of bad) { console.log('실패 ' + x.frame); for (const f of x.fails) console.log('   ' + f); }
    for (const x of allowed) console.log('허용 ' + x.frame + ' — ' + x.allow);
  }
  if (tableOut) {
    const S = Object.keys(SHAPES);
    const rows = all.filter(x => x.pos.length || x.fails.length || Object.values(x.res).some(r => r && r.moved && r.moved.length));
    const t = ['# 글꾸 틀 글 문단 움직임 표 (node tools/geulkku-lines-check.mjs --table)', '', '칸 값 = 연 뒤 움직이는 문단 번호 / 문단 수 · 「전부」 = 다 움직임 · 「-」 = 하나도 안 움직임', '',
      '| 틀 | ' + S.join(' | ') + ' | 자리 번호 규칙 | 판정 |', '|' + '---|'.repeat(S.length + 3)];
    for (const x of rows) t.push('| ' + x.frame + ' | ' + S.map(s => fmt(x.res[s])).join(' | ') + ' | ' + x.pos.length + ' | ' + (x.fails.length ? (x.allow ? '허용' : '실패 ' + x.fails.length) : '통과') + ' |');
    fs.writeFileSync(tableOut, t.join('\n') + '\n', 'utf8');
  }
  console.log(`틀 ${all.length} · 움직이는 틀 ${all.filter(x => Object.values(x.res).some(r => r && r.moved && r.moved.length)).length} · 자리 번호 규칙 있는 틀 ${withPos.length} · 실패 ${bad.length} · 허용 ${allowed.length}`);
  process.exit(bad.length ? 1 : 0);
}
