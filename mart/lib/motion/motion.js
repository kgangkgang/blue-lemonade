// 사본(11-12 · 끔 들어온 판) — 원본 outputs/지시-1110/심플-기존틀-새방식/글움직임-세기.cjs · CommonJS → ESM · 상한 표 열쇠만 마트 열쇠로(설명서 지시-1111/글움직임-세기/마트-연결.md)
// 움직임 세기(11-11 · 지시-1111 글움직임-세기 · Fable 5.2) — 틀을 쓰는 사람이 「글 움직임」과 「소품(위쪽 일러스트) 움직임」을 따로 끔 · 약 · 중 · 강으로 골라요.
//   사용자 말: 「글자애니메이션 강도 강 중 약 고를수있게해줘」 · 「모바일에서 보니까 좀 강한거같아서」 · 「그 글자 애니메이션도 그렇고 위에 일러스트 애니메이션도 그렇고 말야 둘이 따로 선택가능하게 해줘」 · 「글꾸들도 애니메이션 on off 기능 주자」
//   설명서: outputs/지시-1111/글움직임-세기/보고.md · 마트-연결.md
// 방식 — 뿌리 class + 그 class 에만 걸리는 규칙(깡통 정화에서 이미 사는 것만: class · <style> 규칙 · @keyframes):
//   글 움직임  끔 = 뿌리 class `gm-0` · 약 = `gm-s` · 중 = 없음(또는 `gm-m`) · 강 = `gm-l`
//   소품 움직임 끔 = 뿌리 class `gp-0` · 약 = `gp-s` · 중 = 없음(또는 `gp-m`) · 강 = `gp-l`      (마트 꼴이면 `gk-gm-s` … 머리를 저절로 붙여요)
//   「중」은 지금 출력에서 한 글자도 안 바꿔요(사용자가 합격한 세기). 끔 · 약 · 강은 ① 기본 덩이 끝에 그 class 에만 걸리는 규칙을 덧붙여요.
//   CSS 변수 곱(calc(var(--gm,1)*6px))은 안 써요 — var() · calc 가 따로는 사는 것이 확인됐지만 @keyframes 안 곱은 깡통 실측이 없어요(보고 2절).
// 약 · 강이 바꾸는 것(생성 뒤 문자열 변환 — 틀 본문 · 고리 모듈은 안 건드려요):
//   ① @keyframes 의 값: 끝(100%) 값에서 벗어난 만큼에 세기를 곱해요(translate · rotate · skew · scale). 끝 값에 닿기 전의 「가는 길」과 0% · 100% 값은 그대로
//      (글이 숨은 채 들어오는 꼴만 처음 값도 곱해요) → 멎은 뒤 모습 · 자리는 세기와 상관없이 같아요. 소품 자리(소품자리.cjs) 규칙은 키프레임이 아니라서 안 닿아요.
//   ② 튀는 곡선(cubic-bezier 의 y 가 0~1 밖)의 넘침: 약은 줄이고 강은 키워요(변형 전환 · 키프레임).
//   ③ 글 쪽만: 옅어졌다 돌아오는 깊이(opacity) · 변형이 없는 가림 · 긋기 꼴은 길이(약 0.75배 · 강 1.25배 · 늦춤 + 길이 3.5초 안) · 숨은 채 비켜 있는 시작 자리.
//   안 바꾸는 것: 뜻이 있는 큰 이동이 한 번이라도 있는 축(소품 32px · 30도 · 크기 0.5 이상 / 글 120px · 60도 — 도장이 내려오는 거리 · 펜이 긋는 길이) · 납작하게 접힘(scale 0.3 이하) · 색 · 가림 꼴.
// 끔이 하는 것: 그 묶음(글 / 소품)의 animation · transition 을 다 none 으로. 끝 모습이 채움(forwards · both)에 기대는 움직임은 끝(100%) 값을 !important 로 직접 박아요. 인라인 style 의 움직임도 class 로 잡아 꺼요.
//   열고 닫히는 것은 details 라서 그대로 살아요. 계속 도는 반복은 멈춘(움직임이 안 걸린) 모습이 돼요.
// 굳은 규칙(약 · 강에서도): 한 번만 · 3.5초 안 · 멎은 뒤 변형 0 · 지문 위 공백 변화 0 · 흐림 0 · 번쩍임 0 · 글은 위로 3px 까지 · 세로 오므림 70% 아래 없음.
const F = { s: 0.5, l: 1.4 };          // 키프레임 도중 값 곱
const G = { s: 0.35, l: 1.5 };         // 전환 곡선 넘침 곱
const FLOOR = 2.8;                     // 글 「약」이 그래도 보이게 — 어림 이동이 이보다 작아지면 곱을 올려요(1 까지)
const r2 = (v) => { const s = (Math.round(v * 100) / 100).toString(); return s === '-0' ? '0' : s; };

/* ---------- CSS 읽기 ---------- */
function blocks(css) { const out = []; let i = 0;
  while (i < css.length) { const o = css.indexOf('{', i); if (o < 0) break; let d = 1, j = o + 1; while (j < css.length && d) { const c = css[j]; if (c === '{') d++; else if (c === '}') d--; j++; }
    const raw = css.slice(i, o); out.push({ head: raw.trim(), body: css.slice(o + 1, j - 1), start: i + (raw.length - raw.trimStart().length), end: j }); i = j; }
  return out; }
const splitTop = (s, ch) => { const out = []; let d = 0, q = '', cur = ''; for (const c of s) { if (q) { if (c === q) q = ''; cur += c; continue; } if (c === '"' || c === "'") { q = c; cur += c; continue; } if (c === '(') d++; else if (c === ')') d--; if (c === ch && d === 0) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
const decls = (body) => splitTop(body, ';').map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf(':'); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; });

/* ---------- transform ---------- */
const ID = (fn) => (fn === 'scale' ? [1, 1] : fn === 'translate' ? [0, 0] : [0]);
const ROT = new Set(['rotate', 'rotateX', 'rotateY', 'rotateZ']), SKEW = new Set(['skewX', 'skewY']);
function parseTf(v) {   // → [{fn, a:[수], u:[단위]}] | null(못 다루는 꼴)
  v = v.replace(/\s*!important\s*$/, '').trim(); if (v === 'none') return [];
  const out = [], re = /([a-zA-Z0-9]+)\(([^()]*)\)/g; let m, rest = v;
  while ((m = re.exec(v))) { let fn = m[1]; const args = m[2].split(',').map((x) => x.trim()); const a = [], u = [];
    for (const x of args) { const k = x.match(/^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/); if (!k) return null; a.push(+k[1]); u.push(k[2]); }
    if (fn === 'translateX') { fn = 'translate'; a.push(0); u.push(u[0]); } else if (fn === 'translateY') { fn = 'translate'; a.unshift(0); u.unshift(u[0]); }
    else if (fn === 'translate') { if (a.length === 1) { a.push(0); u.push(u[0]); } }
    else if (fn === 'scaleX') { fn = 'scale'; a.push(1); u.push(''); } else if (fn === 'scaleY') { fn = 'scale'; a.unshift(1); u.unshift(''); }
    else if (fn === 'scale') { if (a.length === 1) { a.push(a[0]); u.push(''); } }
    else if (ROT.has(fn) || SKEW.has(fn) || fn === 'perspective') { if (a.length !== 1) return null; }
    else return null;
    if (fn === 'translate') { const un = u.filter((x, i) => a[i] !== 0); if (new Set(un).size > 1) return null; const one = un[0] || u[0] || 'px'; u[0] = u[1] = one; }
    if (out.some((o) => o.fn === fn)) return null;
    out.push({ fn, a, u }); rest = rest.replace(m[0], ''); }
  return rest.trim() ? null : out; }
const fmtTf = (list) => { const s = list.map((o) => o.fn === 'translate' ? (o.a[1] === 0 ? 'translateX(' + r2(o.a[0]) + o.u[0] + ')' : o.a[0] === 0 ? 'translateY(' + r2(o.a[1]) + o.u[1] + ')' : 'translate(' + r2(o.a[0]) + o.u[0] + ',' + r2(o.a[1]) + o.u[1] + ')')
  : o.fn === 'scale' ? (o.a[0] === o.a[1] ? 'scale(' + r2(o.a[0]) + ')' : 'scale(' + r2(o.a[0]) + ',' + r2(o.a[1]) + ')') : o.fn + '(' + r2(o.a[0]) + o.u[0] + ')').join(' '); return s || 'none'; };
// 튀는 곡선 넘침에 g 를 곱해요
const bez = (s, g) => s.replace(/cubic-bezier\(([^)]*)\)/g, (m, inner) => { const p = inner.split(',').map((x) => +x.trim()); if (p.length !== 4 || p.some(isNaN)) return m; let ch = false;
  for (const i of [1, 3]) { if (p[i] > 1) { p[i] = 1 + (p[i] - 1) * g; ch = true; } else if (p[i] < 0) { p[i] = p[i] * g; ch = true; } }
  return ch ? 'cubic-bezier(' + p.map((x) => r2(x).replace(/^0\./, '.').replace(/^-0\./, '-.')).join(',') + ')' : m; });

/* ---------- 키프레임 하나를 세기 f 로 ----------
   opt.text 글 쪽(위로 3px · 세로 70% · 옅어짐 깊이) · opt.alt 오가며 도는 반복(0% · 100% 가 양 끝) → 가운데 기준 · 돌려주는 값 { body, moved(변형을 바꿈), est(중일 때 어림 이동 px), kind } */
function scaleKf(body, f, opt = {}) {
  const stops = blocks(body).map((b) => ({ b, ps: b.head.split(',').map((x) => { x = x.trim(); return x === 'from' ? 0 : x === 'to' ? 100 : parseFloat(x); }), d: decls(b.body) }));
  const at = (p, prop) => { for (const s of stops) if (s.ps.includes(p)) { const d = s.d.find((x) => x[0] === prop); if (d) return d[1]; } return undefined; };
  const has = (prop) => stops.some((s) => s.d.some((x) => x[0] === prop));
  const kind = has('transform') ? '변형' : (has('clip-path') || has('-webkit-mask-size') || has('mask-size') || has('-webkit-mask-position') || has('mask-position') || has('background-size') || has('background-position')) ? '가림' : has('opacity') ? '옅어짐' : '그 밖';
  let moved = false, est = 0, changed = false;
  // 곱하지 않는 크기(그 이상은 「가는 길」 — 도장이 내려오는 거리 · 펜이 긋는 길이 · 뚜껑이 열리는 각처럼 뜻이 있는 이동이라 그대로 둬요)
  const K = opt.text ? { px: 120, pc: 60, rot: 60, sc: 9 } : { px: 32, pc: 30, rot: 30, sc: 0.5 };
  const res = { kind, moved: false, est: 0, body };
  let t0, t1, ok = has('transform');
  if (ok) { const a = at(0, 'transform'), b = at(100, 'transform');
    if (a === undefined || b === undefined) { if (opt.text && a === undefined && b === undefined) { t0 = []; t1 = []; } else ok = false; } else { t0 = parseTf(a); t1 = parseTf(b); if (!t0 || !t1) ok = false; } }
  const parsed = new Map();
  if (ok) for (const s of stops) { const d = s.d.find((x) => x[0] === 'transform'); if (!d) continue; const t = parseTf(d[1]); if (!t) { ok = false; break; } parsed.set(s, t); }
  if (ok) { const get = (list, fn) => list.find((o) => o.fn === fn);
    // 단위가 섞이면(px 와 %) 그 키프레임은 안 건드려요
    const units = {}; for (const t of [t0, t1, ...parsed.values()]) for (const o of t) if (o.fn === 'translate') for (const i of [0, 1]) if (o.a[i] !== 0) (units[i] = units[i] || new Set()).add(o.u[i]);
    if (Object.values(units).some((s) => s.size > 1)) ok = false;
    if (ok) { const isId = (t) => t.every((o) => o.fn === 'perspective' || o.a.every((x, i) => Math.abs(x - ID(o.fn)[i]) < 0.004));
      const all = opt.alt || (opt.text && isId(t1) && !isId(t0));   // 오가며 도는 반복 · 글이 들어오는 꼴(끝이 제자리)은 처음 값까지 같이 곱해요
      const arrived = {}; const order = stops.filter((s) => parsed.get(s)).sort((x, y) => Math.min(...x.ps) - Math.min(...y.ps));
      const big = {}; for (const s of order) { const t = parsed.get(s); for (const fn of new Set([...t.map((o) => o.fn), ...t1.map((o) => o.fn)])) { if (fn === 'perspective') continue; const cur = get(t, fn), a0 = get(t0, fn), a1 = get(t1, fn), id = ID(fn), u = (cur || a0 || a1).u; for (let i = 0; i < id.length; i++) { const end = opt.alt ? ((a0 ? a0.a[i] : id[i]) + (a1 ? a1.a[i] : id[i])) / 2 : (a1 ? a1.a[i] : id[i]); const dev = Math.abs((cur ? cur.a[i] : id[i]) - end); const lim = ROT.has(fn) ? K.rot : fn === 'scale' ? K.sc : fn === 'translate' ? (u[i] === '%' ? K.pc : K.px) : 1e9; if (dev >= lim) big[fn + i] = true; } } }
      for (const s of order) { const t = parsed.get(s); const ends = s.ps.some((p) => p <= 0 || p >= 100);
        if (ends && !(all && !s.ps.some((p) => p >= 100) ) && !opt.alt) continue;   // 0% · 100% 는 그대로(글이 들어오는 꼴의 0% 만 예외)
        const fns = [...new Set([...t.map((o) => o.fn), ...t0.map((o) => o.fn), ...t1.map((o) => o.fn)])].filter((fn) => fn !== 'perspective');
        const out = []; let dx = 0, dy = 0, rot = 0, sk = 0, sc = 0, touched = false;
        for (const fn of fns) { const cur = get(t, fn), a0 = get(t0, fn), a1 = get(t1, fn), id = ID(fn); const u = (cur || a0 || a1).u;
          const v = cur ? cur.a : id, b0 = a0 ? a0.a : id, b1 = a1 ? a1.a : id; const nv = [];
          for (let i = 0; i < id.length; i++) { const key = fn + i; const end = opt.alt ? (b0[i] + b1[i]) / 2 : b1[i]; if (arrived[key] === undefined) arrived[key] = all || Math.abs(b0[i] - b1[i]) < 0.004;
            let dev = v[i] - end, scale = arrived[key];
            if (!scale) { if (Math.abs(dev) < 0.004) arrived[key] = true; else if (dev * (b0[i] - end) < 0) { arrived[key] = true; scale = true; } }   // 끝 값에 닿기 전(가는 길)은 그대로 · 닿은 뒤와 지나친 몫만 곱해요
            let n = scale ? end + dev * f : v[i]; if (!scale) dev = 0;
            if (big[key]) n = v[i];   // 이 축은 「가는 길」(큰 이동이 한 번이라도 있음) — 통째로 그대로
            else if (ROT.has(fn) && Math.abs(dev) >= K.rot) n = v[i];
            else if (fn === 'scale' && (v[i] <= 0.3 || end <= 0.3 || Math.abs(dev) >= K.sc)) n = v[i];
            else if (fn === 'translate' && u[i] !== '%' && Math.abs(dev) >= K.px) n = v[i];
            else if (fn === 'translate' && u[i] === '%' && Math.abs(dev) >= K.pc) n = v[i];
            if (opt.text && f > 1) { if (fn === 'translate' && i === 1 && n < -3) n = Math.min(v[i], -3); if (fn === 'scale' && i === 1 && n < 0.7) n = Math.max(n, Math.min(v[i], 0.7)); }
            if (Math.abs(n - v[i]) > 0.004) touched = true; nv.push(n);
            if (fn === 'translate' && u[i] !== '%') { if (i === 0) dx = dev; else dy = dev; } else if (ROT.has(fn)) rot = Math.max(rot, Math.abs(dev) < K.rot ? Math.abs(dev) : 0); else if (SKEW.has(fn)) sk = Math.abs(dev); else if (fn === 'scale') sc = Math.max(sc, Math.abs(dev) * (i === 0 ? 1 : 0.1)); }
          if (cur || nv.some((x, i) => Math.abs(x - id[i]) > 0.004)) { const o = { fn, a: nv, u }; if (cur) out.push(o); else if (fn === 'translate') out.unshift(o); else out.push(o); } }
        const per = get(t, 'perspective'); if (per) out.unshift(per);
        est = Math.max(est, Math.hypot(dx, dy) + 3.5 * rot + 0.4 * sk + 150 * sc);
        if (touched) { s.d.find((x) => x[0] === 'transform')[1] = fmtTf(out); moved = true; changed = true; } } } }
  // 글 쪽: 옅어졌다 돌아오는 깊이(가림 꼴 · 0 으로 숨기는 꼴은 그대로)
  if (opt.text && has('opacity') && kind !== '가림' && !has('-webkit-mask-image')) { const a = at(0, 'opacity'), b = at(100, 'opacity');
    if ((a === undefined || +a === 1) && (b === undefined || +b === 1)) for (const s of stops) { if (!s.ps.every((p) => p > 0 && p < 100)) continue; const d = s.d.find((x) => x[0] === 'opacity'); if (!d) continue; const v = +d[1]; if (!(v >= 0.15 && v < 1)) continue;
      let n = 1 - (1 - v) * f; if (f > 1) n = Math.max(n, Math.min(v, 0.25)); if (Math.abs(n - v) > 0.004) { d[1] = r2(n).replace(/^0\./, '.'); changed = true; } } }
  // 튀는 곡선
  for (const s of stops) for (const d of s.d) if (d[0] === 'animation-timing-function') { const n = bez(d[1], f); if (n !== d[1]) { d[1] = n; changed = true; moved = true; } }
  res.moved = moved; res.est = est;
  if (changed) res.body = stops.map((s) => s.b.head + '{' + s.d.map((x) => x[0] + ':' + x[1]).join(';') + '}').join('');
  res.changed = changed; return res; }

/* ---------- animation 줄 ---------- */
const TIME = /^-?(?:\d+\.?\d*|\.\d+)m?s$/;
const secOf = (t) => (/ms$/.test(t) ? parseFloat(t) / 1000 : parseFloat(t));
const fmtSec = (v) => String(+v.toFixed(3)).replace(/^0\./, '.') + 's';

/* ---------- 틀 하나 ---------- */
function frameInfo(html) {
  const m = html.match(/<div class="(gk [^"]*)"><style>/); if (!m) return null;
  const rootCls = m[1].split(/\s+/); const si = html.indexOf('<style>', m.index) + 7, se = html.indexOf('</style>', si); const css = html.slice(si, se);
  const cnt = {}; for (const b of blocks(css)) { const k = (b.head.match(/^(?:div)?\.([\w-]+)/) || [])[1]; if (k && rootCls.includes(k)) cnt[k] = (cnt[k] || 0) + 1; }
  const k = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; if (!k) return null;
  const pre = /^gk-/.test(k) ? 'gk-' : '';
  // 글 칸(.lg) · 제목 칸(.tc) 안 class 와 소품(.kx) 안 class
  const body = html.slice(se); const inLg = new Set(), inKx = new Set(), stack = [], pcls = [], inline = []; const re = /<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)([^>]*)>/g; let t;
  const VOID = new Set(['br', 'img', 'input', 'hr', 'source', 'wbr', 'audio-x']);
  while ((t = re.exec(body))) { if (t[1]) { stack.pop(); pcls.pop(); continue; } const tag = t[2].toLowerCase(); const cs = ((t[3].match(/\sclass="([^"]*)"/) || [, ''])[1]).split(/\s+/).filter(Boolean);
    const zone = cs.includes(pre + 'kx') ? 'kx' : (cs.includes(pre + 'lg') || cs.includes(pre + 'tc') || cs.includes(pre + 'sd')) ? 'lg' : (stack.length ? stack[stack.length - 1] : '');
    for (const c of cs) { if (zone === 'kx') inKx.add(c); else if (zone === 'lg') inLg.add(c); }
    const ia = (t[3].match(/\sstyle="([^"]*)"/) || [, ''])[1].match(/(?:^|;)\s*animation:([^;]*)/); if (ia && !/^\s*none/.test(ia[1])) inline.push({ zone, cls: cs[0] || (pcls[pcls.length - 1] ? pcls[pcls.length - 1] + '>' + tag : ''), tag, v: ia[1].trim() });
    if (!VOID.has(tag) && !/\/$/.test(t[3])) { stack.push(zone); pcls.push(cs[0] || ''); } }
  return { k, pre, rootCls, si, se, css, inLg, inKx, inline, rootAt: m.index }; }
function groupOf(sel, info) {   // 'text' | 'prop' | 'both'
  const P = info.pre, bare = sel.replace(/:has\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '').replace(/::?[a-z-]+(\([^)]*\))?/g, (x) => (/^:(not|is|where|nth)/.test(x) ? x : ''));
  const cls = (bare.match(/\.[\w-]+/g) || []).map((x) => x.slice(1));
  if (cls.some((c) => c === P + 'lg' || c === P + 'tc' || c === P + 'tt' || c === P + 'sd')) return 'text';
  if (cls.some((c) => c === P + 'kx' || c === P + 'pb')) return 'prop';
  const last = bare.trim().split(/[\s>+~]+/).pop() || ''; const lc = (last.match(/\.[\w-]+/g) || []).map((x) => x.slice(1));
  if (/(^|[\s>+~])\*$/.test(bare.trim()) && !lc.length) return 'both';
  if (lc.some((c) => info.inKx.has(c))) return 'prop';
  if (lc.some((c) => info.inLg.has(c))) return 'text';
  if (cls.some((c) => info.inKx.has(c))) return 'prop';
  if (cls.some((c) => info.inLg.has(c) && !info.rootCls.includes(c))) return 'text';
  return 'prop'; }
const addRoot = (sel, k, cls) => { const i = sel.indexOf('.' + k); if (i < 0) return null; const j = i + k.length + 1; if (/[\w-]/.test(sel[j] || '')) return null; return sel.slice(0, j) + cls + sel.slice(j); };

/** 한 틀의 CSS 에서 세기 규칙을 만들어요 → { text:{s,l}, prop:{s,l} (각 CSS 글 · 없으면 '') , stat } */
function build(html, opt = {}) { const capB = Object.assign({}, opt.key && CAP[opt.key], opt.cap);
  const info = frameInfo(html); if (!info) return null;
  const { k, pre } = info; const css = stripOld(info.css, info);
  const top = blocks(css); const kf = {}; const rules = [];
  const walk = (list, media) => { for (const b of list) { if (/^@keyframes/.test(b.head)) kf[b.head.split(/\s+/)[1]] = b.body; else if (/^@(media|supports)/.test(b.head)) { if (/prefers-reduced-motion/.test(b.head)) continue; walk(blocks(b.body), b.head); } else if (!b.head.startsWith('@')) rules.push({ head: b.head, d: decls(b.body), media }); } };
  walk(top, '');
  const out = { text: { s: '', l: '' }, prop: { s: '', l: '' } }; const stat = { text: { anim: 0, moved: 0, kinds: {}, fS: [], same: 0 }, prop: { anim: 0, moved: 0, trans: 0, loop: 0, same: 0 } };
  for (const grp of ['text', 'prop']) for (const lv of ['s', 'l']) {
    const tagK = '-g' + (grp === 'text' ? 'm' : 'p') + lv; const rootCls = '.' + pre + 'g' + (grp === 'text' ? 'm' : 'p') + '-' + lv;
    const kfOut = new Map(); const lines = []; let anyAnim = false, anyTrans = false;
    const variant = (name, alt, loop) => { const key = name + (alt ? '|a' : ''); if (kfOut.has(key)) return kfOut.get(key);
      let f = F[lv]; if (grp === 'text' && lv === 's' && capB.textSf) f = capB.textSf; let r = scaleKf(kf[name], f, { text: grp === 'text', alt });
      if (grp === 'text' && lv === 's' && !capB.textSf && r.moved && r.est > 0 && r.est * f < FLOOR) { f = Math.min(1, FLOOR / r.est); r = f >= 0.995 ? Object.assign(r, { changed: false, moved: false }) : scaleKf(kf[name], f, { text: true, alt }); }
      const v = { name: r.changed ? name + tagK + (alt ? 'a' : '') : name, r, f, body: r.body }; kfOut.set(key, v); return v; };
    const mine = rules.filter((r) => { const g = splitTop(r.head, ',').map((s) => groupOf(s, info)); r._g = g; return g.some((x) => x === grp || x === 'both'); });
    const idTf = (v) => { const t = parseTf(v); return !!t && t.every((o) => o.fn === 'perspective' || o.a.every((x, i) => Math.abs(x - ID(o.fn)[i]) < 0.004)); };
    const openId = grp === 'text' && mine.some((r) => /[open]/.test(r.head) && r.d.some(([p, v]) => p === 'transform' && idTf(v)));
    let anyX = false;
    for (const r of mine) { const nd = []; let chA = false, chT = false;
      // 글 쪽: 숨은 채(opacity:0) 비켜 있다가 열릴 때 제자리로 들어오는 꼴 — 숨어 있는 시작 자리만 곱해요(열린 자리는 그대로)
      if (openId && !/[open]/.test(r.head) && r.d.some(([p, v]) => p === 'opacity' && +v === 0)) { const td = r.d.find(([p]) => p === 'transform'); const t = td && parseTf(td[1]);
        if (t && t.length && !idTf(td[1])) { let f = F[lv]; const tr = t.find((o) => o.fn === 'translate'); const est = tr && tr.u[0] !== '%' ? Math.hypot(tr.a[0], tr.a[1]) : 99; if (lv === 's' && est * f < FLOOR) f = Math.min(1, FLOOR / est);
          const nt = t.map((o) => ({ fn: o.fn, u: o.u, a: o.a.map((v, i) => { const id = ID(o.fn)[i], dev = v - id; if (o.fn === 'perspective' || (ROT.has(o.fn) && Math.abs(dev) >= 60) || (o.fn === 'scale' && v <= 0.3) || (o.fn === 'translate' && Math.abs(dev) >= (o.u[i] === '%' ? 60 : 120))) return v; return id + dev * f; }) }));
          const nv = fmtTf(nt); if (nv !== fmtTf(t)) { nd.push(['transform', nv, 'x']); anyX = true; if (lv === 's') stat.text.hid = (stat.text.hid || 0) + 1; } } }
      for (const [p, v] of r.d) {
        if (p === 'animation' || p === 'animation-name') { const imp = /!important\s*$/.test(v) ? '!important' : ''; const parts = splitTop(v.replace(/\s*!important\s*$/, ''), ',').map((x) => x.trim());
          const np = parts.map((part) => { const tok = part.split(/\s+/); const ni = tok.findIndex((t) => kf[t] !== undefined); if (ni < 0) return part;
            const loop = tok.includes('infinite'), alt = loop && tok.some((t) => /^alternate/.test(t)); const va = variant(tok[ni], alt, loop);
            if (lv === 's') { stat[grp].anim++; if (loop) stat[grp].loop = (stat[grp].loop || 0) + 1; }
            const ti = tok.map((t, i) => (TIME.test(t) ? i : -1)).filter((i) => i >= 0); let durCh = false;
            if (grp === 'text' && ti.length && !loop) { const dur = secOf(tok[ti[0]]), del = ti[1] !== undefined ? secOf(tok[ti[1]]) : 0; let nd2 = dur;
              if (va.r.kind === '변형') { if (lv === 's' && va.r.changed && va.r.moved && dur < 1.6) nd2 = dur * 0.85; }
              else if (va.r.kind === '가림' || (va.r.kind === '옅어짐' && !va.r.changed)) { nd2 = dur * (lv === 's' ? 0.75 : 1.25); if (del + nd2 > 3.5) nd2 = Math.max(dur, 3.5 - del); if (del + dur > 3.5) nd2 = dur; }
              if (Math.abs(nd2 - dur) > 0.004) { tok[ti[0]] = fmtSec(nd2); durCh = true; } }
            if (lv === 's') { stat[grp].kinds && (stat[grp].kinds[va.r.kind] = (stat[grp].kinds[va.r.kind] || 0) + 1); if (va.r.changed || durCh) stat[grp].moved++; else stat[grp].same++; if (grp === 'text' && va.r.moved) stat.text.fS.push(+va.f.toFixed(2)); }
            if (va.r.changed) { tok[ni] = va.name; chA = true; } if (durCh) chA = true; const j = tok.join(' '), jb = bez(j, F[lv]); if (jb !== j) chA = true; return jb; });
          nd.push([p, np.join(',') + imp, 'a']); }
        else if (p === 'transition') { const n = splitTop(v, ',').map((x) => (/^\s*(transform|translate|rotate|scale|all)(?![\w-])/.test(x) ? bez(x, G[lv]) : x)).join(',');   /* 변형 전환의 튐만 — 칸 높이 · 여백 전환은 글 자리를 흔들 수 있어서 그대로 */ if (n !== v) { chT = true; if (lv === 's') stat[grp].trans = (stat[grp].trans || 0) + 1; } nd.push([p, n, 't']); }
        else if (p === 'animation-timing-function') { const n = bez(v, F[lv]); if (n !== v) chA = true; nd.push([p, n, 'a']); }
        else if (/^animation-|^transition-/.test(p)) nd.push([p, v, p[0]]); }
      r._nd = nd; r._chA = chA; r._chT = chT; if (chA) anyAnim = true; if (chT) anyTrans = true; }
    if (!anyAnim && !anyTrans && !anyX) continue;
    // 바뀐 갈래(animation / transition)는 그 묶음의 모든 규칙을 같은 차례로 다시 적어요 — 원래 규칙끼리의 이기고 지는 차례가 그대로 남아요
    for (const [key, v] of kfOut) if (v.r.changed) lines.push('@keyframes ' + v.name + '{' + v.body + '}');
    for (const r of mine) { const keep = r._nd.filter((x) => (x[2] === 'a' && anyAnim) || (x[2] === 't' && anyTrans) || x[2] === 'x'); if (!keep.length) continue;
      const sels = splitTop(r.head, ',').map((s, i) => (r._g[i] === grp || r._g[i] === 'both' ? addRoot(s.trim(), k, rootCls) : null)).filter(Boolean); if (!sels.length) continue;
      const line = sels.join(',') + '{' + keep.map((x) => x[0] + ':' + x[1]).join(';') + '}'; lines.push(r.media ? r.media + '{' + line + '}' : line); }
    out[grp][lv] = lines.join('\n'); }
  // 끔(gm-0 · gp-0): 그 묶음의 움직임 · 전환을 다 꺼요 — 누르면 바로 끝 모습. 끝 모습이 채움(forwards · both)에 기대는 움직임은 끝(100%) 값을 직접 박아요
  const endOf = (name, tok) => { const want = tok.includes('reverse') || tok.includes('alternate-reverse') ? 0 : 100, o = []; for (const b of blocks(kf[name] || '')) { const ps = b.head.split(',').map((x) => { x = x.trim(); return x === 'from' ? 0 : x === 'to' ? 100 : parseFloat(x); }); if (!ps.includes(want)) continue; for (const [pp, vv] of decls(b.body)) if (pp !== 'animation-timing-function') o.push(pp + ':' + vv.replace(/\s*!important\s*$/, '') + '!important'); } return o; };
  for (const grp of ['text', 'prop']) { const rootCls = '.' + pre + 'g' + (grp === 'text' ? 'm' : 'p') + '-0'; const lines = []; let pins = 0;
    for (const r of rules) { const g = splitTop(r.head, ',').map((s) => groupOf(s, info)); if (!g.some((x) => x === grp || x === 'both')) continue;
      const A = r.d.filter(([p]) => /^animation/.test(p)), T = r.d.filter(([p]) => /^transition/.test(p)); if (!A.length && !T.length) continue;
      const dd = []; if (A.length) dd.push('animation:none' + (A.some(([, v]) => /!important/.test(v)) ? '!important' : '')); if (T.length) dd.push('transition:none' + (T.some(([, v]) => /!important/.test(v)) ? '!important' : ''));
      const fillD = A.some(([p, v]) => p === 'animation-fill-mode' && /forwards|both/.test(v));
      for (const [p, v] of A) if (p === 'animation') for (const part of splitTop(v.replace(/\s*!important\s*$/, ''), ',')) { const tok = part.trim().split(/\s+/), name = tok.find((t) => kf[t] !== undefined); if (!name || tok.includes('infinite') || !(fillD || tok.includes('forwards') || tok.includes('both'))) continue; const e = endOf(name, tok); if (e.length) { dd.push(...e); pins++; } }
      const sels = splitTop(r.head, ',').map((s, i) => (g[i] === grp || g[i] === 'both' ? addRoot(s.trim(), k, rootCls) : null)).filter(Boolean); if (!sels.length) continue;
      const line = sels.join(',') + '{' + dd.join(';') + '}'; lines.push(r.media ? r.media + '{' + line + '}' : line); }
    // 인라인 style 로 박힌 움직임(새 틀 일부) — class 로 잡아 끄고, 채움에 기대면 끝 값을 박아요
    const seen = new Set(); for (const it of info.inline) { const zg = it.zone === 'lg' ? 'text' : 'prop'; if (zg !== grp || !it.cls || seen.has(it.cls)) continue; seen.add(it.cls);
      const dd = ['animation:none!important']; for (const part of splitTop(it.v, ',')) { const tok = part.trim().split(/\s+/), name = tok.find((t) => kf[t] !== undefined); if (name && !tok.includes('infinite') && (tok.includes('forwards') || tok.includes('both'))) { dd.push(...endOf(name, tok)); pins++; } }
      lines.push('.' + k + rootCls + ' .' + it.cls + '{' + dd.join(';') + '}'); }
    out[grp]['0'] = lines.join('\n'); stat[grp].pins = pins; stat[grp].inlineNoCls = info.inline.filter((it) => (it.zone === 'lg' ? 'text' : 'prop') === grp && !it.cls).length; }
  return { info, css, add: out, stat }; }
// 앞서 넣은 세기 규칙을 걷어요(두 번 걸어도 같은 결과)
function stripOld(css, info) { const P = info.pre; const re = new RegExp('\\.' + P.replace(/-/g, '\\-') + 'g[mp]\\-[sml0](?![\\w-])');
  let out = '', last = 0; for (const b of blocks(css)) { const old = /^@keyframes\s+\S+-g[mp][sl]a?$/.test(b.head) || (re.test(b.head) && !/^@keyframes/.test(b.head)) || (/^@(media|supports)/.test(b.head) && re.test(b.body) && /\bg[mp]-/.test(b.body) && blocks(b.body).every((x) => re.test(x.head)));
    if (old) { out += css.slice(last, b.start).replace(/\n$/, ''); last = b.end; } }
  return out + css.slice(last); }

/** 틀 HTML 에 세기를 걸어요.
 *  opt.text · opt.prop : '0'(끔 · 'off' 도 됨) | 's' | 'm' | 'l' (빼면 'm')
 *  opt.emit  : 'chosen'(기본 — 고른 세기의 규칙만 넣어요 · 마트 「HTML 복사」용) | 'all'(약 · 강 규칙을 다 넣고 class 만 고름 — 테마 설정 · 시험용)
 *  opt.cap   : { textL:false, propL:false } — 강을 중과 같게 묶을 때(틀별 상한 표 세기-상한.json 의 값). opt.key('30:k119')를 주면 표에서 저절로 찾아요
 *  opt.phone : true 면 폰 폭(480px 이하)에서 「아무 것도 안 고른 틀」의 기본을 약으로(미디어 쿼리) — 꺼 둔 스위치예요. 이때 중을 굳히려면 class gm-m · gp-m
 *  opt.mark  : false 면 뿌리 class 를 안 붙이고 규칙만 넣어요 */
function applyLevel(html, opt = {}) {
  const b = build(html, opt); if (!b) return html; const { info, css, add } = b; const P = info.pre;
  const cap = Object.assign({}, opt.key && CAP[opt.key], opt.cap); const LV = (v) => (v === 'off' || v === 0 || v === '0' ? '0' : v === 's' || v === 'l' ? v : 'm'); const lv = { text: LV(opt.text), prop: LV(opt.prop) };
  if (cap.textL === false) { add.text.l = ''; } if (cap.propL === false) { add.prop.l = ''; }
  const want = []; for (const g of ['text', 'prop']) for (const l of ['0', 's', 'l']) if (add[g][l] && (opt.emit === 'all' || lv[g] === l)) want.push(add[g][l]);
  if (opt.phone) for (const g of ['text', 'prop']) { if (!add[g].s) continue; const c = P + 'g' + (g === 'text' ? 'm' : 'p'); const not = ':not(.' + c + '-m):not(.' + c + '-l)';
    const body = add[g].s.split('.' + c + '-s').join(not); want.push('@media (max-width:480px){' + body.split('\n').filter((x) => !x.startsWith('@keyframes')).join('\n') + '}');
    const kfs = add[g].s.split('\n').filter((x) => x.startsWith('@keyframes')); if (kfs.length && !(opt.emit === 'all' || lv[g] === 's')) want.push(kfs.join('\n')); }
  let ncss = css; if (want.length) { const cut = ncss.indexOf('\n\n'); const at = cut < 0 ? ncss.length : cut; ncss = ncss.slice(0, at).replace(/\n$/, '') + '\n' + want.join('\n') + ncss.slice(at); }
  let out = html.slice(0, info.si) + ncss + html.slice(info.se);
  if (opt.mark !== false) { const keep = info.rootCls.filter((c) => !new RegExp('^' + P + 'g[mp]-[sml0]$').test(c)); const extra = [];
    if (lv.text !== 'm' && (add.text[lv.text] || opt.emit === 'all')) extra.push(P + 'gm-' + lv.text); else if (opt.phone && lv.text === 'm' && opt.text) extra.push(P + 'gm-m');
    if (lv.prop !== 'm' && (add.prop[lv.prop] || opt.emit === 'all')) extra.push(P + 'gp-' + lv.prop); else if (opt.phone && lv.prop === 'm' && opt.prop) extra.push(P + 'gp-m');
    out = out.slice(0, info.rootAt) + '<div class="' + keep.concat(extra).join(' ') + '"><style>' + out.slice(info.si); }
  return out; }
/** 여러 틀이 든 HTML(이식판 · 시험 글)의 틀마다 걸어요 */
function applyAll(html, opt = {}) { const parts = html.split(/(?=<div class="gk [^"]*"><style>)/); return parts.map((p) => (/^<div class="gk [^"]*"><style>/.test(p) ? applyLevel(p, opt) : p)).join(''); }
/** 이 틀에서 고를 수 있는 것 — 마트 칩을 보일지 정할 때: { text:{s:bool,l:bool}, prop:{s:bool,l:bool} } */
function describe(html, opt = {}) { const b = build(html, opt); if (!b) return null; const cap = Object.assign({}, opt.key && CAP[opt.key], opt.cap);
  return { k: b.info.k, pre: b.info.pre, text: { off: !!b.add.text['0'], s: !!b.add.text.s, l: !!b.add.text.l && cap.textL !== false }, prop: { off: !!b.add.prop['0'], s: !!b.add.prop.s, l: !!b.add.prop.l && cap.propL !== false }, stat: b.stat, bytes: { textS: b.add.text.s.length, textL: b.add.text.l.length, propS: b.add.prop.s.length, propL: b.add.prop.l.length, textOff: b.add.text['0'].length, propOff: b.add.prop['0'].length } }; }
/** 생성기 끝 한 줄용(커스텀 고리와 같은 꼴 — 아직 생성기에는 안 걸었어요): const GMW = require('../글움직임-세기.cjs').wrap('30'), BF = module.exports.buildFrame; module.exports.buildFrame = (no, opt) => GMW(no, BF(no, opt), opt);
 *  buildFrame(no, { gm: 's', gp: 'l' }) 일 때만 걸어요 — gm · gp 를 안 주면 받은 HTML 을 그대로 돌려줘요 */
function wrap(nn) { return (no, html, opt = {}) => { if (!opt || (!opt.gm && !opt.gp)) return html; try { const info = frameInfo(html); return applyLevel(html, { text: opt.gm, prop: opt.gp, key: nn + ':' + (info ? info.k : ''), phone: !!opt.gmPhone }); } catch (e) { return html; } }; }
const CAP = {"k1266":{"propL":false},"k1209":{"textL":false},"k1197":{"textSf":0.65},"k1218":{"textL":false},"k1081":{"propL":false},"k1179":{"textL":false},"k1180":{"textL":false},"k1165":{"propL":false},"k1119":{"textL":false},"k1005":{"propL":false},"k1326":{"textL":false},"k1328":{"textL":false},"k1330":{"textL":false}};   // 세기-상한.json 을 마트 열쇠(k1NNN)로 옮긴 것
export { applyLevel, applyAll, describe, wrap, build, scaleKf, bez, F, G, CAP };
