// 사본(11-12) — 원본 outputs/지시-1111/글꾸-질감/질감.cjs · CommonJS → ESM 만(마트 꼴 gk- 머리는 texture.js 가 맞춰요)
// 바탕 질감 고리(11-11 · Fable 5.2) — 사용자 「글꾸에 배경에 질감 넣는 거 … 모눈종이, 줄노트 … 좀 거칠거칠한 느낌 등등」
//   → 시안을 보고 「저 카드 질감 다 ㄱㅊ네 저거 저 지문 블럭에만 고를지 아니면 전체로 할지 선택 가능하게 해줘 ㅇㅇ 자유롭게」(여덟 다 채택 · 얹는 범위 고르기)
// 심플 틀의 바탕색 위에 질감을 얹어요. 바탕색(background-color)은 손대지 않고 background-image 겹만 더해서 색을 따라가요.
//
// 거는 법 — 틀 뿌리(<div class="gk tl tn-d k310 …">)에 class:
//   질감     tx-grid 모눈종이 · tx-line 줄 노트 · tx-dot 점 노트 · tx-rough 거친 종이 · tx-hanji 한지 · tx-canvas 캔버스 천 · tx-aged 오래된 종이 · tx-chalk 칠판
//   범위     tx-on-b 지문 블럭(글 칸)만 · tx-on-c 카드 전체(카드 + 글 칸)
//   진하기   tx-1 옅게 · (없음) 보통 · tx-3 진하게
//   그 밖    tx-mg 줄 노트 빨간 세로줄 · tx-t 알갱이를 「대체 타일」로(쓰지 않아요 — 아래 깡통 실측 줄)
//   규칙은 그 틀 <style> 끝에 덧붙어요(별점 · 커스텀 고리와 같은 자리). 틀의 기존 규칙은 한 글자도 안 바뀌어요.
//
// 쓰는 법:
//   apply(html, { tex, on: 'b'|'c', level: 1|2|3, margin, grain: 'turb'|'tile', base })  → 질감 건 HTML(걸 수 없는 틀 · tex 없음이면 받은 그대로)
//   info(html)   → { key, pane, tone, blocked, why }   pane = 글 칸이 제 바탕색을 가진 틀 · blocked = 질감을 걸지 않는 틀
//   strip(html)  → 질감 class · 규칙을 뗀 HTML(다시 걸기 전에)
//   생성기에 붙일 한 줄(아직 안 붙였어요 — 테마 1.1.3 출시 검사 뒤에):
//     try { const TX = require('../../지시-1111/글꾸-질감/질감.cjs').apply, BF = module.exports.buildFrame; module.exports.buildFrame = (no, opt) => (opt && opt.tex ? TX(BF(no, opt), opt.tex) : BF(no, opt)); } catch (e) {}
//   마트 연결: outputs/지시-1111/글꾸-질감/마트-연결.md
//
// 깡통 실측(11-11 · 글 162833 ~ 162837): 여덟 질감 다 살아요. 알갱이 다섯은 feTurbulence 판 · 대체 타일 판 둘 다 살고, 모눈 · 줄 · 점은 배율 1.25 · 1.65 · 2.25 · 폰 375 에서 줄 간격이 고르고 변에 붙는 줄 0.
//   → 알갱이 기본 = feTurbulence 판(더 곱고 가벼움). 대체 타일(grain: 'tile')은 코드에만 남기고 쓰지 않아요(캔버스는 너무 진하고 칠판은 거의 안 보였어요).
// 깡통 정화에서 사는 것만 써요: <style> 안 class 규칙의 background-image:url('data:image/svg+xml,…')(11-10 실측 · 사별 시리즈 2). 인라인 style · 가상 요소 · 떠 있는 판 · 요소 filter · blend 는 안 써요.
const enc = (svg) => "url('data:image/svg+xml," + String(svg).replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim().replace(/[%#<>"'()&;{}\\]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) + "')";
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const r3 = (n) => String(Math.round(n * 1000) / 1000).replace(/^0\./, '.');
const f1 = (n) => String(Math.round(n * 10) / 10);
const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// 잉크: 낮 = 검정을 옅게(바탕색을 누름) · 밤 = 흰색을 옅게(바탕색을 띄움) → 어떤 바탕색 위에서도 그 색의 명암으로 보여요
const INK = { d: '#000', n: '#fff' };
// 무늬 간격 20px: 배율 1.25 · 1.5 · 1.65 · 1.75 · 2 · 2.25 · 3 에서 전부 정수 화소라 줄마다 굵기가 같아요(24px 는 1.65 에서 39.6 — 물결쳐요)
const PITCH = 20;

/* ---------- 반듯한 무늬(모눈 · 줄 · 점): 크기 없는 SVG 한 장 + <pattern> ----------
   세로줄 겹은 좌우로만, 가로줄 겹은 위아래로만 10px 줄여요: 줄은 끝까지 뻗고, 가장자리와 나란한 줄은 변에서 10px 안으로 안 와요(테처럼 안 보임). */
const patSvg = (inner) => `<svg ${NS} width="100%" height="100%"><pattern id="p" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse">${inner}</pattern><rect width="100%" height="100%" fill="url(#p)"/></svg>`;
const vLines = (ink, a) => enc(patSvg(`<rect x="${PITCH / 2}" width="1" height="${PITCH}" fill="${ink}" fill-opacity="${r3(a)}"/>`));
const hLines = (ink, a) => enc(patSvg(`<rect y="${PITCH / 2}" width="${PITCH}" height="1" fill="${ink}" fill-opacity="${r3(a)}"/>`));
const dots = (ink, a) => enc(patSvg(`<circle cx="${PITCH / 2}" cy="${PITCH / 2}" r="1.1" fill="${ink}" fill-opacity="${r3(a)}"/>`));
const L_V = (img) => ({ img, size: 'calc(100% - 20px) 100%', pos: '50% 0', rep: 'no-repeat' });
const L_H = (img) => ({ img, size: '100% calc(100% - 20px)', pos: '0 50%', rep: 'no-repeat' });
const L_D = (img) => ({ img, size: 'calc(100% - 16px) calc(100% - 16px)', pos: '50% 50%', rep: 'no-repeat' });

/* ---------- 알갱이 무늬 ① feTurbulence 타일(기본) ---------- */
const noise = (o) => `<filter id="${o.id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${o.f}" numOctaves="${o.oct || 2}" seed="${o.seed || 3}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${o.rgb[0]} 0 0 0 0 ${o.rgb[1]} 0 0 0 0 ${o.rgb[2]} ${o.k} 0 0 0 ${o.b}"/></filter><rect width="100%" height="100%" filter="url(#${o.id})" opacity="${r3(o.a)}"/>`;
const tile = (size, inner) => ({ img: enc(`<svg ${NS} width="${size}" height="${size}">${inner}</svg>`), size: size + 'px ' + size + 'px', pos: '0 0', rep: 'repeat' });
const rgb = (hex) => { const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex; return [1, 3, 5].map((i) => r3(parseInt(h.slice(i, i + 2), 16) / 255)); };

/* ---------- 알갱이 무늬 ② 대체 타일 — 쓰지 않아요(깡통에서 feTurbulence 가 살아서). 남겨 두기만 해요 (filter 없이 점 · 올을 직접 뿌려요 — 씨앗 고정 난수라 늘 같은 그림) ---------- */
// 점: 1px 네모 점을 진하기 세 무리로
function specks(size, n, ink, a, seed) {
  const R = rng(seed), g = [[], [], []];
  for (let i = 0; i < n; i++) g[i % 3].push('M' + Math.floor(R() * size) + ' ' + (Math.floor(R() * size) + .5) + 'h' + (R() < .18 ? 2 : 1));
  return g.map((p, i) => `<path d="${p.join('')}" stroke="${ink}" stroke-opacity="${r3(a * [1, .62, .34][i])}"/>`).join('');
}
// 올: 짧고 굽은 섬유(타일 가장자리를 넘으면 반대쪽에 한 번 더 그려 이음매 없음)
function fibers(size, n, ink, a, seed) {
  const R = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = R() * size, y = R() * size, ang = R() * Math.PI, len = 10 + R() * 26, bend = (R() - .5) * 10, w = .5 + R() * .5;
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len, mx = x + dx / 2 - Math.sin(ang) * bend, my = y + dy / 2 + Math.cos(ang) * bend;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      const x0 = x + ox, y0 = y + oy, x1 = x0 + dx, y1 = y0 + dy;
      if (Math.max(x0, x1) < -6 || Math.min(x0, x1) > size + 6 || Math.max(y0, y1) < -6 || Math.min(y0, y1) > size + 6) continue;
      out.push(`<path d="M${f1(x0)} ${f1(y0)}Q${f1(mx + ox)} ${f1(my + oy)} ${f1(x1)} ${f1(y1)}" stroke-width="${f1(w)}"/>`);
    }
  }
  return `<g fill="none" stroke="${ink}" stroke-opacity="${r3(a)}" stroke-linecap="round">${out.join('')}</g>`;
}
// 실: 가로 · 세로로 길이가 제각각인 가는 실(간격이 불규칙해서 모아레 없음). dir 'h' | 'v'
function threads(size, n, ink, a, seed, dir, lenMin, lenMax, w) {
  const R = rng(seed), g = [[], []];
  for (let i = 0; i < n; i++) {
    const p = Math.floor(R() * size) + .5, q = Math.floor(R() * size), len = Math.round(lenMin + R() * (lenMax - lenMin));
    for (const o of [0, -size]) { if (q + o + len < 0) continue; g[i % 2].push(dir === 'h' ? 'M' + (q + o) + ' ' + p + 'h' + len : 'M' + p + ' ' + (q + o) + 'v' + len); }
  }
  return g.map((p, i) => `<path d="${p.join('')}" stroke="${ink}" stroke-width="${w}" stroke-opacity="${r3(a * [1, .55][i])}" stroke-linecap="round"/>`).join('');
}
// 얼룩: 가장자리가 풀어지는 둥근 얼룩(radialGradient — filter 아님)
function blobs(size, n, col, a, seed) {
  const R = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = R() * size, y = R() * size, rx = 40 + R() * 70, ry = 30 + R() * 50, o = .45 + R() * .55;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      if (x + ox + rx < 0 || x + ox - rx > size || y + oy + ry < 0 || y + oy - ry > size) continue;
      out.push(`<ellipse cx="${Math.round(x + ox)}" cy="${Math.round(y + oy)}" rx="${Math.round(rx)}" ry="${Math.round(ry)}" opacity="${r3(o)}"/>`);
    }
  }
  return `<radialGradient id="g"><stop offset="0" stop-color="${col}" stop-opacity="${r3(a)}"/><stop offset=".55" stop-color="${col}" stop-opacity="${r3(a * .55)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><g fill="url(#g)">${out.join('')}</g>`;
}

/* ---------- 질감 표 ----------
   kind 'geo' = 반듯한 무늬 · 'grain' = 알갱이.  a = [옅게, 보통, 진하게].  layers = feTurbulence 판 · alt = 대체 타일 판(알갱이만) */
const AGED = { d: ['#8a5a1e', '#5a3c14'], n: ['#ffd9a0', '#ffe9c4'] };
const TEX = {
  grid: { name: '모눈종이', kind: 'geo', a: { d: [.045, .07, .105], n: [.04, .06, .09] },
    layers: (t, a) => [L_V(vLines(INK[t], a)), L_H(hLines(INK[t], a))] },
  line: { name: '줄 노트', kind: 'geo', a: { d: [.06, .09, .13], n: [.05, .075, .11] },
    layers: (t, a, o) => (o.margin ? [{ img: 'linear-gradient(' + [0, 0].map(() => (t === 'd' ? 'rgba(214,72,72,' : 'rgba(255,128,128,') + r3(a * 4.2) + ')').join(',') + ')', size: '1px 100%', pos: '10px 0', rep: 'no-repeat' }] : []).concat([L_H(hLines(INK[t], a))]) },
  dot: { name: '점 노트', kind: 'geo', a: { d: [.13, .2, .29], n: [.11, .17, .25] },
    layers: (t, a) => [L_D(dots(INK[t], a))] },
  rough: { name: '거친 종이', kind: 'grain', a: { d: [.4, .62, .88], n: [.45, .7, 1] },
    layers: (t, a) => [tile(160, noise({ id: 'a', f: '.85', oct: 3, seed: 7, rgb: rgb(INK[t]), k: t === 'd' ? .55 : .42, b: t === 'd' ? -.2 : -.15, a }))],
    alt: (t, a) => [tile(120, specks(120, 340, INK[t], (t === 'd' ? .34 : .26) * a, 7))] },
  hanji: { name: '한지', kind: 'grain', a: { d: [.5, .75, 1], n: [.5, .75, 1] },
    layers: (t, a) => [tile(240, fibers(240, 34, INK[t], (t === 'd' ? .16 : .15) * a, 11) + noise({ id: 'a', f: '.5', oct: 2, seed: 4, rgb: rgb(INK[t]), k: .34, b: -.13, a }))],
    alt: (t, a) => [tile(240, fibers(240, 34, INK[t], (t === 'd' ? .16 : .15) * a, 11) + specks(240, 170, INK[t], (t === 'd' ? .2 : .16) * a, 4))] },
  canvas: { name: '캔버스 천', kind: 'grain', a: { d: [.2, .31, .46], n: [.17, .27, .4] },
    layers: (t, a) => [tile(180, noise({ id: 'a', f: '.03 .85', oct: 2, seed: 2, rgb: rgb(INK[t]), k: .62, b: -.25, a }) + noise({ id: 'b', f: '.85 .03', oct: 2, seed: 9, rgb: rgb(INK[t]), k: .62, b: -.25, a }))],
    alt: (t, a) => [tile(140, threads(140, 150, INK[t], .35 * a, 2, 'h', 14, 60, .7) + threads(140, 150, INK[t], .35 * a, 9, 'v', 14, 60, .7))] },
  aged: { name: '오래된 종이', kind: 'grain', a: { d: [.5, .75, 1], n: [.5, .75, 1] },
    layers: (t, a) => [tile(420, noise({ id: 'a', f: '.011', oct: 4, seed: 5, rgb: rgb(AGED[t][0]), k: t === 'd' ? 1.2 : 1, b: t === 'd' ? -.56 : -.47, a: a * (t === 'd' ? .34 : .26) }) + noise({ id: 'b', f: '.8', oct: 2, seed: 12, rgb: rgb(AGED[t][1]), k: .4, b: -.16, a: a * .8 }))],
    alt: (t, a) => [tile(420, blobs(420, 9, AGED[t][0], (t === 'd' ? .17 : .1) * a, 5) + specks(420, 300, AGED[t][1], (t === 'd' ? .3 : .22) * a, 12))] },
  chalk: { name: '칠판', kind: 'grain', a: { d: [.22, .34, .5], n: [.34, .52, .75] },
    layers: (t, a) => [tile(360, noise({ id: 'a', f: '.004 .2', oct: 3, seed: 8, rgb: rgb(INK[t]), k: t === 'd' ? .5 : .46, b: t === 'd' ? -.2 : -.18, a }) + noise({ id: 'b', f: '.9', oct: 2, seed: 21, rgb: rgb(INK[t]), k: .5, b: -.21, a }))],
    alt: (t, a) => [tile(300, threads(300, 60, INK[t], .2 * a, 8, 'h', 70, 240, 1.6) + threads(300, 80, INK[t], .17 * a, 5, 'h', 30, 130, .8) + specks(300, 170, INK[t], .26 * a, 21))] },
};
const ORDER = ['grid', 'line', 'dot', 'rough', 'hanji', 'canvas', 'aged', 'chalk'];

/* ---------- 질감을 걸지 않는 틀 ----------
   글 칸 자체가 서비스 화면 꼴인 틀(종이 질감이 얹히면 화면 느낌이 깨져요) + 글 칸에 이미 제 바탕 그림이 있는 틀.
   11-11 밤 369틀을 인화지로 훑어 정했어요(설계.md 3절). 이 표에 없어도 「뿌리 바탕색이 없는 틀」 · 「얹을 면에 이미 바탕 그림이 있는 틀」은 스스로 막아요. */
const NO_TEX = {
  k279: 'X 타래(화면 꼴)', kt363: 'X 타래 · 빈 타래(화면 꼴)', kt364: 'X 타래 · 줄에 건 쪽지와 타래 꼴 글(화면 꼴)',
  k281: '디스코드(화면 꼴)', k283: '배달앱 리뷰(화면 꼴)',
  k286: '통화 기록(화면 꼴)', kt362: '통화 기록 · 접힌 통화 목록(화면 꼴)',
  k288: '블로그 글(화면 꼴)', kt361: '블로그 글 · 노트북과 블로그 꼴 글(화면 꼴)',
  k302: '미니홈피(화면 꼴)', kt365: '미니홈피 · 다이어리 탭(화면 꼴)', kt366: '미니홈피 · 미니룸과 방명록(화면 꼴)',
  kt371: '인스타 DM(화면 꼴)', kt372: '인스타 피드(화면 꼴)', kt373: '인스타 스토리(화면 꼴)',
  k104: '경찰 분실물 접수(글 칸에 제 바탕 그림이 있음)',
};

const SKIP = /^(gk|tl|td|tn-[dn]|cv-.*|sk-.*|st-.*|tx-.*|gk-.*|bg-.*)$/;
function info(html) {
  const m = String(html).match(/^(\s*<div class=")([^"]*)(">)/); if (!m || !/(^| )gk( |$)/.test(m[2])) return { blocked: true, why: '글꾸 틀이 아님' };
  const cls = m[2].split(/\s+/), end = html.indexOf('</style>'); if (end < 0) return { blocked: true, why: 'style 없음' };
  const head = html.slice(0, end), first = (head.match(/<style>\s*\.([A-Za-z0-9_-]+)\{/) || [])[1];
  const key = first && cls.includes(first) ? first : cls.find((c) => !SKIP.test(c)); if (!key) return { blocked: true, why: '틀 class 없음' };
  const esc = key.replace(/[-]/g, '\\-');
  const rule = (sel) => [...head.matchAll(new RegExp('(?:^|[\\n,}])\\s*' + sel + '\\{([^}]*)\\}', 'g'))].map((x) => x[1]).join(';');
  const col = (t) => (t.match(/background-color:([^;}]+)/g) || []).map((x) => x.slice(17)).pop();
  const root = rule('\\.' + esc), lg = rule('\\.' + esc + ' \\.lg');
  const tone = cls.includes('tn-n') ? 'n' : 'd', pane = !!col(lg);
  const base = { c: { d: col(root), n: col(rule('\\.' + esc + '\\.tn-n')) || col(root) }, b: { d: col(lg), n: col(rule('\\.' + esc + '\\.tn-n \\.lg')) || col(lg) } };
  const speak = [...head.matchAll(new RegExp('\\.' + esc + ' \\.(d[A-Z])\\{background-color:([^;}]+)', 'g'))].map((x) => [x[1], x[2]]);
  let why = NO_TEX[key] || '';
  if (!why && !col(root)) why = '뿌리 바탕색이 없는 틀(화면 꼴)';
  if (!why && /background(-image)?:[^;}]*(url\(|gradient)/.test(root + ';' + lg)) why = '얹을 면에 이미 바탕 그림이 있음';
  return { key, cls, pane, tone, base, speak, hasSound: /class="sd"/.test(html), blocked: !!why, why, m, end };
}

const decl = (ls) => 'background-image:' + ls.map((l) => l.img).join(',') + ';background-size:' + ls.map((l) => l.size).join(',') + ';background-position:' + ls.map((l) => l.pos).join(',') + ';background-repeat:' + ls.map((l) => l.rep).join(',');

/* 틀 하나에 붙일 규칙.  i = info() 결과 · o: { tex, on, level, margin, grain, tones, base }
   얹히는 면:   글 칸이 따로 있는 틀  tx-on-b → .lg 만      tx-on-c → 뿌리 + .lg
               카드에 바로 쓰는 틀   tx-on-b · tx-on-c 모두 뿌리(글 칸이 따로 없어서 — 마트가 그렇게 알려 줘요)
   모든 질감에서 대사 띠 · 소리 카드 밑으로 무늬가 비치지 않게, 띠와 소리 카드에 그 면의 바탕색을 한 겹 받쳐요(보이는 색은 그대로). */
function css(i, o) {
  const T = TEX[o.tex]; if (!T) return '';
  const on = o.on === 'c' ? 'c' : 'b', lv = [1, 2, 3].includes(o.level) ? o.level : 2, tileMode = T.kind === 'grain' && o.grain === 'tile';
  const rows = [];
  for (const t of o.tones || [i.tone]) {
    const root = '.' + i.key + '.tx-' + o.tex + '.tx-on-' + on + (lv === 2 ? '' : '.tx-' + lv) + (tileMode ? '.tx-t' : '') + '.tn-' + t;
    const tgt = !i.pane ? root : on === 'c' ? root + ',' + root + ' .lg' : root + ' .lg';
    rows.push(tgt + '{' + decl((tileMode ? T.alt : T.layers)(t, T.a[t][lv - 1], o)) + '}');
    {   // 11-11 깡통 실측(162833 ~ 162837) 뒤: 알갱이 질감도 띠 · 소리 카드 밑으로 비쳐서 모든 질감에 받침을 넣어요
      const b = (o.base && o.base[t]) || (i.pane ? i.base.b[t] : i.base.c[t]);
      if (b) {
        for (const [c, tint] of i.speak) rows.push(root + ' .' + c + '{background-image:linear-gradient(' + tint + ',' + tint + '),linear-gradient(' + b + ',' + b + ')}');
        if (i.hasSound) rows.push(root + ' .sd{background-color:' + b + '}');
      }
    }
  }
  return rows.join('\n');
}

const stripCls = (c) => c.filter((x) => !/^tx-/.test(x));
function strip(html) {
  const i = info(html); if (!i.m) return html;
  const head = html.slice(i.m[0].length, i.end).split('\n').filter((l) => !new RegExp('^\\.' + i.key.replace(/[-]/g, '\\-') + '\\.tx-').test(l)).join('\n');
  return i.m[1] + stripCls(i.cls).join(' ') + i.m[3] + head + html.slice(i.end);
}

// 틀 HTML 한 덩이에 질감을 걸어요. tex 가 없거나 'none' · 걸지 않는 틀이면 받은 그대로(이미 걸린 질감은 떼고) 돌려줘요.
function apply(html, o) {
  const clean = /(^|[ "])tx-/.test(String(html).slice(0, 300)) ? strip(html) : html;
  if (!o || !o.tex || o.tex === 'none' || !TEX[o.tex]) return clean;
  const i = info(clean); if (i.blocked) return clean;
  const on = o.on === 'c' ? 'c' : 'b', lv = [1, 2, 3].includes(o.level) ? o.level : 2;
  const add = ['tx-' + o.tex, 'tx-on-' + on].concat(lv === 2 ? [] : ['tx-' + lv]).concat(o.margin && o.tex === 'line' ? ['tx-mg'] : []).concat(TEX[o.tex].kind === 'grain' && o.grain === 'tile' ? ['tx-t'] : []);
  return i.m[1] + i.cls.concat(add).join(' ') + i.m[3] + clean.slice(i.m[0].length, i.end) + css(i, o) + '\n' + clean.slice(i.end);
}

export { TEX, ORDER, NO_TEX, apply, strip, info, css, enc };
