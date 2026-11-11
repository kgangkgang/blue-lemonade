// 생성물 — tools/mart/basic-frames.mjs 가 시안 생성기(make-기본.cjs)에서 옮겼어요. 고치지 말고 다시 만들어요.
// 지문: 생성기 1x836v0 · 가장자리 1wk4ii0 · 레몬 tou5y4
// 1.1.3 「기본 글꾸」 새 틀 18 — log-copy-basic.js 가 drawBasic 으로 그려요. 생김새는 생성기 출력 그대로(무테 · 그라데이션 0 · 밤 그림자 0).
/* eslint-disable */

// ── 가장자리 매끈하게(가장자리-px.cjs 그대로) ──
const px = (() => {
// 가장자리 매끈하게(11-11 전수-2) — svg 조각의 「비스듬한 변 · 굽은 변」에만 몸과 같은 색 1px · 45% 가장자리를 덧대요.
//   사용자 화면은 배율 165% 쯤이라 작은 그림의 사선 · 곡선이 계단처럼 깨져 보여요((작업 기록) · 전수-2/보고.md).
//   px(svg 글) → 고친 svg 글. 묶음 생성기의 svgUrl() 이 불러요(모든 마스크 · 배경 svg 가 여기를 지나가요).
//   · 채운 도형: 곧은 사선 변 + 굽은 변(C · Q · A)에만 가장자리. 가로 · 세로 변은 그대로(또렷한 변을 번지게 하지 않아요)
//     - 모든 변이 사선 · 곡선이면(원 · 타원 · 세모 · 돌린 네모) 그 도형에 바로 stroke 를 붙여요
//     - 섞여 있으면(사다리꼴 · 둥근 끝 막대) 사선 · 곡선 변만 따로 그린 덧선을 바로 뒤에 붙여요
//   · 선으로 그린 것(fill none + stroke) · 채움에 같은 색 선을 두른 도형: 1px 굵은 45% 밑선을 바로 앞에 깔아요. 가로 · 세로 선은 그대로
//   · 가장자리 색 = 그 도형의 채움 색(마스크는 #000) — 테두리로 보이지 않아요(무테). opacity 가 걸린 것 · 채움과 선의 색이 다른 것은 건드리지 않아요
//   · 다시 걸어도 같은 결과(앞선 fz() 의 사선 테는 걷어 내고 다시 붙여요)
//   · 건너뛰는 svg: crispEdges · preserveAspectRatio="none" · 레몬 로고(viewBox 472) · <defs>/<mask>/<clipPath>/<pattern>/<text> 안쪽
const f2 = (v) => String(+(+v).toFixed(2));
const attr = (a, k) => { const m = a.match(new RegExp('(?:^|\\s)' + k + '="([^"]*)"')); return m ? m[1] : null; };
// path 글 → 변 목록 [{ t:'L'|'C'|'Q'|'A', x0, y0, x1, y1, cmd(절대 좌표 명령 글) }]
function pathSegs(d) {
  const out = []; let i = 0; const n = d.length;
  const ws = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
  const num = () => { ws(); const m = /^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/i.exec(d.slice(i, i + 40)); if (!m) { i = n; return NaN; } i += m[0].length; return +m[0]; };
  const flag = () => { ws(); const c = d[i]; i++; return c === '1' ? 1 : 0; };
  const more = () => { ws(); return i < n && /[-.\d]/.test(d[i]); };
  let c = '', x = 0, y = 0, sx = 0, sy = 0, pcx = null, pcy = null, pq = null;
  const push = (t, nx, ny, cmd) => { out.push({ t, x0: x, y0: y, x1: nx, y1: ny, cmd }); x = nx; y = ny; };
  while (i < n) {
    ws(); if (i >= n) break;
    if (/[a-zA-Z]/.test(d[i])) { c = d[i++]; if (c === 'Z' || c === 'z') { if (x !== sx || y !== sy) push('L', sx, sy, 'L' + f2(sx) + ' ' + f2(sy)); pcx = pq = null; continue; } }
    else if (!c) break;
    if (!more()) { if (!/[a-zA-Z]/.test(d[i] || '')) break; continue; }
    const r = c === c.toLowerCase(), ox = r ? x : 0, oy = r ? y : 0, C = c.toUpperCase();
    if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; c = r ? 'l' : 'L'; pcx = pq = null; }
    else if (C === 'L') { const nx = ox + num(), ny = oy + num(); push('L', nx, ny, 'L' + f2(nx) + ' ' + f2(ny)); pcx = pq = null; }
    else if (C === 'H') { const nx = ox + num(); push('L', nx, y, 'L' + f2(nx) + ' ' + f2(y)); pcx = pq = null; }
    else if (C === 'V') { const ny = oy + num(); push('L', x, ny, 'L' + f2(x) + ' ' + f2(ny)); pcx = pq = null; }
    else if (C === 'C') { const a = ox + num(), b = oy + num(), e = ox + num(), f = oy + num(), nx = ox + num(), ny = oy + num(); push('C', nx, ny, 'C' + [a, b, e, f, nx, ny].map(f2).join(' ')); pcx = [e, f]; pq = null; }
    else if (C === 'S') { const a = pcx ? 2 * x - pcx[0] : x, b = pcx ? 2 * y - pcx[1] : y, e = ox + num(), f = oy + num(), nx = ox + num(), ny = oy + num(); push('C', nx, ny, 'C' + [a, b, e, f, nx, ny].map(f2).join(' ')); pcx = [e, f]; pq = null; }
    else if (C === 'Q') { const a = ox + num(), b = oy + num(), nx = ox + num(), ny = oy + num(); push('Q', nx, ny, 'Q' + [a, b, nx, ny].map(f2).join(' ')); pq = [a, b]; pcx = null; }
    else if (C === 'T') { const a = pq ? 2 * x - pq[0] : x, b = pq ? 2 * y - pq[1] : y, nx = ox + num(), ny = oy + num(); push('Q', nx, ny, 'Q' + [a, b, nx, ny].map(f2).join(' ')); pq = [a, b]; pcx = null; }
    else if (C === 'A') { const rx = num(), ry = num(), rot = num(), la = flag(), sw = flag(), nx = ox + num(), ny = oy + num(); push('A', nx, ny, 'A' + [rx, ry, rot].map(f2).join(' ') + ' ' + la + ' ' + sw + ' ' + f2(nx) + ' ' + f2(ny)); pcx = pq = null; }
    else break;
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
  }
  return out;
}
const isAxis = (s) => s.t === 'L' && (Math.abs(s.x1 - s.x0) < 1e-6 || Math.abs(s.y1 - s.y0) < 1e-6);
const segLen = (s) => Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
// 돌림 · 기울임이 든 transform 인가(90도 배수 돌림은 아니에요)
const turned = (tf) => { if (!tf) return false; if (/skew|matrix/.test(tf)) return true; const m = tf.match(/rotate\(\s*(-?[\d.]+)/g) || []; return m.some((r) => { const a = Math.abs(parseFloat(r.replace(/rotate\(\s*/, ''))) % 90; return a > 0.01 && a < 89.99; }); };
const FEATHER = (col) => ' fill="none" stroke="' + col + '" stroke-opacity=".45"';
const SELF = (col, join) => ' stroke="' + col + '" stroke-opacity=".45"' + (join ? ' stroke-linejoin="round"' : '');
const featherPath = (list, col, tf) => { let d = '', px = null, py = null; for (const s of list) { d += (s.x0 === px && s.y0 === py ? '' : 'M' + f2(s.x0) + ' ' + f2(s.y0)) + s.cmd; px = s.x1; py = s.y1; } return d ? '<path d="' + d + '"' + FEATHER(col) + ' stroke-linejoin="round"' + (tf ? ' transform="' + tf + '"' : '') + '/>' : ''; };
const OLD_FZ = /<path d="[^"]*" fill="none" stroke="[^"]*" stroke-opacity="\.45"(?: stroke-width="1")?(?: stroke-linejoin="round")?(?: transform="[^"]*")?\/>/g;
const SKIP_IN = /^(defs|mask|clipPath|pattern|text|symbol|marker|linearGradient|radialGradient|filter)$/;

function px(svg) {
  svg = String(svg);
  if (!/<svg\b/.test(svg) || /crispEdges|preserveAspectRatio="none"|viewBox="0 0 472 472"|data-px="0"/.test(svg)) return svg;
  svg = svg.replace(OLD_FZ, '');
  const st = []; let skip = 0, out = '', last = 0, lastEl = '', doneG = null; const re = /<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g; let m;
  const top = () => st[st.length - 1] || { fill: '#000', stroke: null, sw: 1, op: false, rot: false, done: false, round: false };
  while ((m = re.exec(svg))) {
    out += svg.slice(last, m.index); last = re.lastIndex; let tag = m[0]; const close = m[1] === '/', name = m[2], a = m[3], self = m[4] === '/';
    if (close) { if (SKIP_IN.test(name)) skip--; else if (name === 'g' || name === 'svg') st.pop(); out += tag; lastEl = tag; continue; }
    if (SKIP_IN.test(name)) { if (!self) skip++; out += tag; lastEl = tag; continue; }
    const p = top(); const fillA = attr(a, 'fill'), strokeA = attr(a, 'stroke'), swA = attr(a, 'stroke-width'), tf = attr(a, 'transform');
    const cur = { fill: fillA != null ? fillA : p.fill, stroke: strokeA != null ? (strokeA === 'none' ? null : strokeA) : p.stroke, sw: swA != null ? +swA : p.sw, op: p.op || /(?:^|\s)(?:opacity|fill-opacity|stroke-opacity)="/.test(a) || /style="/.test(a), rot: p.rot || turned(tf), done: p.done, round: p.round || /stroke-line(?:cap|join)="round"/.test(a) };
    if (name === 'g' || name === 'svg') {
      if (!self) { if (name === 'g') { const end = svg.indexOf('</g>', last), inner = end >= 0 ? svg.slice(last, end) : ''; if (/stroke-opacity="\.45"/.test(a)) doneG = inner; else if (doneG != null && doneG === inner) { cur.done = true; doneG = null; } } st.push(cur); }
      out += tag; lastEl = tag; continue; }
    if (skip || cur.op || !/^(path|polygon|polyline|circle|ellipse|rect|line)$/.test(name)) { out += tag; lastEl = tag; continue; }
    const filled = cur.fill !== 'none' && name !== 'line' && name !== 'polyline', stroked = !!cur.stroke;
    const okCol = (c) => /^#[0-9a-fA-F]{3,8}$|^rgb\(|^[a-z]+$/.test(c) && c !== 'currentColor' && c !== 'transparent';
    let segs = null, allTurn = cur.rot;
    if (name === 'path') { const d = attr(a, 'd'); segs = d ? pathSegs(d) : null; if (!segs) { out += tag; lastEl = tag; continue; } }
    else if (name === 'polygon' || name === 'polyline') { const q = (attr(a, 'points') || '').trim().split(/[\s,]+/).map(Number); segs = []; const cnt = q.length >> 1; for (let k = 0; k < cnt; k++) { const j = (k + 1) % cnt; if (name === 'polyline' && k === cnt - 1) break; segs.push({ t: 'L', x0: q[2 * k], y0: q[2 * k + 1], x1: q[2 * j], y1: q[2 * j + 1], cmd: 'L' + f2(q[2 * j]) + ' ' + f2(q[2 * j + 1]) }); } }
    else if (name === 'line') { segs = [{ t: 'L', x0: +attr(a, 'x1') || 0, y0: +attr(a, 'y1') || 0, x1: +attr(a, 'x2') || 0, y1: +attr(a, 'y2') || 0, cmd: '' }]; }
    const body = tag.replace(/\s*\/?>$/, '');
    if (filled && !stroked) {
      if (!okCol(cur.fill)) { out += tag; lastEl = tag; continue; }
      if (name === 'circle' || name === 'ellipse') tag = body + SELF(cur.fill, false) + '/>';
      else if (name === 'rect') {
        const x = +attr(a, 'x') || 0, y = +attr(a, 'y') || 0, w = +attr(a, 'width') || 0, h = +attr(a, 'height') || 0; let rx = attr(a, 'rx'), ry = attr(a, 'ry'); rx = rx != null ? +rx : (ry != null ? +ry : 0); ry = ry != null ? +ry : rx; rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        if (allTurn) tag = body + SELF(cur.fill, true) + '/>';
        else if (rx >= 2 && ry >= 2) { const A = 'A' + f2(rx) + ' ' + f2(ry) + ' 0 0 1 '; const d = 'M' + f2(x) + ' ' + f2(y + ry) + A + f2(x + rx) + ' ' + f2(y) + 'M' + f2(x + w - rx) + ' ' + f2(y) + A + f2(x + w) + ' ' + f2(y + ry) + 'M' + f2(x + w) + ' ' + f2(y + h - ry) + A + f2(x + w - rx) + ' ' + f2(y + h) + 'M' + f2(x + rx) + ' ' + f2(y + h) + A + f2(x) + ' ' + f2(y + h - ry); tag = tag + '<path d="' + d + '"' + FEATHER(cur.fill) + (tf ? ' transform="' + tf + '"' : '') + '/>'; }
      } else {
        const pick = allTurn ? segs.filter((s) => segLen(s) > 0) : segs.filter((s) => !isAxis(s) && segLen(s) > 0);
        if (pick.length && pick.length === segs.filter((s) => segLen(s) > 0).length) tag = body + SELF(cur.fill, segs.some((s) => s.t === 'L')) + '/>';
        else if (pick.length) tag = tag + featherPath(pick, cur.fill, tf);
      }
    } else if (stroked && (!filled || cur.fill === cur.stroke) && !cur.done && cur.sw > 0 && okCol(cur.stroke) && !/stroke-opacity="\.45"/.test(lastEl)) {
      // 선으로 그린 것 · 「채움 + 같은 색 선」(모서리를 굴리려고 선을 두른 도형): 1px 굵은 45% 밑선을 바로 앞에 깔아요
      const live = segs ? segs.filter((s) => segLen(s) > 0) : null, pick = live ? (allTurn ? live : live.filter((s) => !isAxis(s))) : null;
      const flat = name === 'rect' ? !allTurn && !(+attr(a, 'rx') >= 2) : (name === 'circle' || name === 'ellipse' ? false : !pick.length);
      if (!flat) {
        if (!live || pick.length === live.length || name === 'rect') { const setA = (u, k, v) => (new RegExp('\\s' + k + '="').test(u) ? u.replace(new RegExp('(\\s)' + k + '="[^"]*"'), '$1' + k + '="' + v + '"') : u + ' ' + k + '="' + v + '"'); let u = setA(body, 'stroke-width', f2(cur.sw + 1)); if (filled) u = setA(u, 'fill', 'none'); tag = u + ' stroke-opacity=".45"/>' + tag; }
        else { let d = '', qx = null, qy = null; for (const s of pick) { d += (s.x0 === qx && s.y0 === qy ? '' : 'M' + f2(s.x0) + ' ' + f2(s.y0)) + s.cmd; qx = s.x1; qy = s.y1; } const rnd = cur.round ? ' stroke-linecap="round" stroke-linejoin="round"' : ''; tag = '<path d="' + d + '" fill="none" stroke="' + cur.stroke + '" stroke-width="' + f2(cur.sw + 1) + '" stroke-opacity=".45"' + rnd + (tf ? ' transform="' + tf + '"' : '') + '/>' + tag; }
      }
    }
    out += tag; lastEl = m[0];
  }
  return out + svg.slice(last);
}

// 소스 읽기(전수 표 · 검사용): svg 한 장에서 「깨지기 쉬운 조각」 종류를 세요
function kinds(svg) {
  const k = { 긴사선: 0, 작은사선: 0, 곡선: 0, 작은원: 0, 둥근끝: 0, 선사선: 0, 선곡선: 0, 돌림: 0, 소수px: 0, 가장자리있음: 0 };
  svg = String(svg); if (!/<svg\b/.test(svg) || /viewBox="0 0 472 472"/.test(svg)) return k;
  k.가장자리있음 = (svg.match(/stroke-opacity="\.45"/g) || []).length;
  const bare = svg.replace(OLD_FZ, ''); const re = /<(path|polygon|polyline|circle|ellipse|rect|line)\b([^>]*?)\/?>/g; let m;
  const gNone = /<g[^>]*fill="none"/.test(bare);
  while ((m = re.exec(bare))) { const name = m[1], a = m[2]; if (/stroke-opacity="\.45"/.test(a)) continue;
    const stroked = /fill="none"/.test(a) || /(?:^|\s)stroke="/.test(a) || name === 'line' || name === 'polyline' || (gNone && /<g[^>]*fill="none"[^>]*>(?:(?!<\/g>)[\s\S])*$/.test(bare.slice(0, m.index)));
    if (turned(attr(a, 'transform'))) k.돌림++;
    if (name === 'rect') { for (const q of ['x', 'y', 'width', 'height']) { const v = attr(a, q); if (v != null && Math.abs(+v - Math.round(+v)) > 1e-6) { k.소수px++; break; } } const rx = +(attr(a, 'rx') || attr(a, 'ry') || 0), w = +attr(a, 'width'), h = +attr(a, 'height'); if (rx >= 2 && rx >= Math.min(w, h) / 2 - 0.01) k.둥근끝++; continue; }
    if (name === 'circle' || name === 'ellipse') { const r = Math.max(+(attr(a, 'r') || 0), +(attr(a, 'rx') || 0), +(attr(a, 'ry') || 0)); if (stroked) k.선곡선++; else if (r <= 8) k.작은원++; else k.곡선++; continue; }
    let segs = null; if (name === 'path') segs = pathSegs(attr(a, 'd') || ''); else if (name === 'line') segs = [{ t: 'L', x0: +attr(a, 'x1') || 0, y0: +attr(a, 'y1') || 0, x1: +attr(a, 'x2') || 0, y1: +attr(a, 'y2') || 0 }]; else { const q = (attr(a, 'points') || '').trim().split(/[\s,]+/).map(Number); segs = []; const cnt = q.length >> 1; for (let i = 0; i < cnt; i++) { const j = (i + 1) % cnt; if (name === 'polyline' && i === cnt - 1) break; segs.push({ t: 'L', x0: q[2 * i], y0: q[2 * i + 1], x1: q[2 * j], y1: q[2 * j + 1] }); } }
    if (!segs) continue; const diag = segs.filter((s) => s.t === 'L' && !isAxis(s) && segLen(s) > 0), curve = segs.filter((s) => s.t !== 'L');
    const dl = diag.reduce((t, s) => t + segLen(s), 0);
    if (stroked) { if (dl >= 3) k.선사선++; if (curve.length) k.선곡선++; }
    else { if (dl >= 16) k.긴사선++; else if (dl >= 2) k.작은사선++; if (curve.length) k.곡선++; }
  }
  return k;
}
// clip-path:polygon() 으로 그린 도형(사다리꼴 · 세모 · 별)을 같은 꼴의 마스크로 바꿔요 — clip-path 는 가장자리를 덧댈 수 없어서 165% 배율에서 계단이 그대로 보여요.
//   clipMask(칸 너비, 칸 높이, '0 0,28px 0,24px 32px,4px 32px' 또는 'polygon(…)') → 마스크 선언 글. 좌표는 px 나 % 만(다른 것이 있으면 clip-path 그대로 돌려줘요). 움직이는(transition · keyframes) clip-path 에는 쓰지 않아요
const svgUrl = (svg) => "url('data:image/svg+xml," + String(svg).replace(/[%#<>"'()&;{}\\]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) + "')";
function clipMask(w, h, pts) {
  const raw = String(pts).trim().replace(/^polygon\(/, '').replace(/\)$/, ''); const back = 'clip-path:polygon(' + raw + ')';
  const conv = (v, full) => (/^-?[\d.]+%$/.test(v) ? +(parseFloat(v) * full / 100).toFixed(2) : /^-?[\d.]+(px)?$/.test(v) ? parseFloat(v) : NaN);
  const P = raw.split(',').map((q) => q.trim().split(/\s+/)).map((q) => [conv(q[0], w), conv(q[1], h)]); if (!P.length || P.some((q) => Number.isNaN(q[0]) || Number.isNaN(q[1]))) return back;
  const u = svgUrl(px('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polygon points="' + P.map((q) => q.join(',')).join(' ') + '"/></svg>'));
  return '-webkit-mask-image:' + u + ';mask-image:' + u + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:' + w + 'px ' + h + 'px;mask-size:' + w + 'px ' + h + 'px';
}
return px;
})();

/* ---------- 색 계산(첫 묶음 tones() · fit() 그대로) ---------- */
const h2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2h = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
function toHsl(hex) {
  const [r, g, b] = h2rgb(hex).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hue = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, sat, l];
}
function fromHsl(h, sat, l) {
  const f = (n) => { const k = (n + h / 30) % 12, a = sat * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return rgb2h([f(0), f(8), f(4)]);
}
function tones(C) {
  if (!C) return { 100: '#f1f1f3', 300: '#c9cacf', 500: '#8b8e96', 700: '#4c4e55', 900: '#26272b' };
  const [h, sat, l] = toHsl(C);
  return { 100: fromHsl(h, sat * 0.8, l + (1 - l) * 0.85), 300: fromHsl(h, sat * 0.95, l + (1 - l) * 0.45), 500: C, 700: fromHsl(h, sat * 0.85, l * 0.62), 900: fromHsl(h, sat * 0.7, l * 0.34) };
}
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const Lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const x = Lum(a), y = Lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
function fit(C, bg, want = 4.6) {
  let [h, sat, l] = toHsl(C); const dir = Lum(h2rgb(bg)) > 0.4 ? -0.01 : 0.01;
  for (let i = 0; i < 100 && cr(h2rgb(fromHsl(h, sat, l)), h2rgb(bg)) < want; i++) l = Math.min(1, Math.max(0, l + dir));
  return fromHsl(h, sat, l);
}
const KA = '#3aa7ff', KB = '#ff5fa2';   // 견본 두 화자 색 — 다른 시안과 같은 값
const FIXED = {
  [KA]: { l: '#0a69ae', d: '#3aa7ff', tagL: '#e8f4ff', tagD: '#1f3246' },
  [KB]: { l: '#c81e6a', d: '#ff5fa2', tagL: '#ffeef5', tagD: '#422432' },
};
const LREF = '#f3f1ec', DREF = '#25272b';
function speaker(hex) {
  const k = hex.toLowerCase(), f = FIXED[k], t = tones(k);
  return {
    k, t, rgb: h2rgb(k).join(','),
    inkL: f ? f.l : fit(k, LREF), inkD: f ? f.d : fit(k, DREF),
    tagL: f ? f.tagL : t[100], tagD: f ? f.tagD : t[900],
    tagInkL: f ? f.l : fit(k, t[100]), tagInkD: f ? f.d : fit(k, t[900]),
  };
}

/* ---------- 레몬 로고: 블루레몬 테마 원본에서 읽어 그대로(손으로 그리지 않아요) ---------- */
const LEMON_D = "M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z";   // 테마 src/log-copy-lemon.js 값
if (!LEMON_D) throw new Error('LEMON_D 를 못 읽었어요');
const LEMON_HOME = 'https://kkangtong.xyz/posts/157369';
// 가장자리 매끈하게(11-11 pre32): 마스크 svg 의 비스듬한 변 · 굽은 변에 몸과 같은 색 1px · 45% 가장자리(레몬 로고는 도우미가 건너뛰어요)
const PX = px;   // 가장자리 매끈하게(가장자리-px.cjs — 아래 감싼 글 그대로)
const svgUrl = (svg) => "url('data:image/svg+xml," + PX(String(svg).replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim()).replace(/[%#<>"'()&;{}\\]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) + "')";
const lemonSvg = (fill, stroke, sw = 12) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 472 472"><path fill="' + fill + '" fill-rule="evenodd" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round" transform="translate(12 428) scale(1 -1)" d="' + LEMON_D + '"/></svg>';
const lemon = () => '<a class="lm" href="' + LEMON_HOME + '" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="lmi"></span></a>';
// 그림(마스크)은 실제 px 크기와 1:1
const mask1 = (sel, w, h, inner) => { const u = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="geometricPrecision">' + inner + '</svg>'); return sel + '{-webkit-mask-image:' + u + ';mask-image:' + u + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:' + w + 'px ' + h + 'px;mask-size:' + w + 'px ' + h + 'px}'; };

/* ---------- 견본 글(다른 시안과 같은 글) + 긴 견본(메시지 12개 — 대사가 많아도 견디는지 보는 용) ---------- */
const TEXT = {
  title: '비 그친 뒤, 옥상에서',
  n1: '옥상 문을 밀자 젖은 바닥 냄새가 먼저 올라왔다. 이름은 난간에 기대어, 아직 다 마르지 않은 하늘을 한참 올려다보고 있었다.',
  d1: '「……여기 있을 줄 알았어. 전화는 왜 안 받아?」',
  n2: '친구는 대답 대신 주머니에서 캔 커피 두 개를 꺼냈다. 하나는 미지근했고, 하나는 아직 따뜻했다.',
  d2: '「받으면 네가 안 올라올 것 같아서. 따뜻한 쪽은 네 거야.」',
  name1: '이름', name2: '친구',
};
const FIELDS = { mark: 'LOG', tabLog: 'LOG', tabInfo: '프롬프트', model: 'Argon', prompt: '천사깡', date: '2026년 11월 3일 화요일', dateShort: '2026.11.03', page: '1', stamp: ['참 잘', '했어요'], from: '', to: '', subtitle: '사진 기록', photos: 6 };
const baseMsgs = (t) => [{ who: 'A', name: t.name1, nr: t.n1, dl: t.d1 }, { who: 'B', name: t.name2, nr: t.n2, dl: t.d2 }];
const MORE = [
  ['A', '이름은 따뜻한 캔을 두 손으로 감싸 쥐었다. 손끝에 닿는 온기가 생각보다 오래갔다.', '「……치사하게. 이러면 화를 못 내잖아.」'],
  ['B', '친구가 난간 아래를 내려다보았다. 물웅덩이마다 가로등이 하나씩 떠 있었다.', '「화내도 돼. 대신 다 마시고 내.」'],
  ['A', '', '「그럼 반만 낼게.」'],
  ['B', '', '「반은 어디다 두고?」'],
  ['A', '이름은 대답 대신 캔을 땄다. 김이 아주 잠깐 올랐다가 밤공기에 섞였다.', '「내일. 내일 마저 낼 거야.」'],
  ['B', '친구는 웃음을 삼키느라 고개를 돌렸다.', '「그래, 내일도 올라와. 커피는 내가 살게.」'],
  ['A', '', '「따뜻한 걸로.」'],
  ['B', '', '「따뜻한 걸로.」'],
  ['A', '구름이 걷힌 자리로 늦은 별 하나가 보였다. 둘은 한동안 말없이 같은 쪽을 보았다.', '「……전화, 다음엔 받을게.」'],
  ['B', '', '「응. 안 받으면 또 올라올게.」'],
];
const longMsgs = (t) => baseMsgs(t).concat(MORE.map(([who, nr, dl]) => ({ who, name: who === 'A' ? t.name1 : t.name2, nr, dl })));
const clock = (i) => '21:' + String(4 + i).padStart(2, '0');

/* ---------- 작은 도구 ---------- */
const GOTHIC = 'Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
const SERIF = '"RIDIBatang","Noto Serif KR",serif';
const tc = (c) => 'color:' + c + ';-webkit-text-fill-color:' + c;
const hw = (w, h) => 'width:' + w + 'px;height:' + h + 'px;block-size:' + h + 'px';
const hh = (h) => 'height:' + h + 'px;block-size:' + h + 'px';
const box = (w, h) => 'grid-template-columns:' + w + 'px;grid-template-rows:' + h + 'px;' + hw(w, h);
const LY = 'display:block;grid-area:1/1/2/2;justify-self:start;align-self:start';
const sp = (cls) => '<span class="' + cls + '"></span>';
const INK = { l: { text: '#26272b', dlg: '#111113', title: '#1b1c20', muted: '#5f6168' }, d: { text: '#e1e1e5', dlg: '#f5f5f7', title: '#f0f0f3', muted: '#9a9da6' } };
const PAPER = { l: '#ffffff', d: '#25272b' }, WELL = { l: '#f5f5f6', d: '#1c1e21' };   // 틀 바탕 · 글 칸(무채 — 눌러도 안 바뀌어요)
const ZE = 'cubic-bezier(.45,0,.3,1.35)';     // 걸렸다 → 주르륵 → 끝에서 조금(약 6%) 지나쳤다 제자리 — 443 가름끈(44px 이동 · 지나침 약 2.6px)
const K8 = 'cubic-bezier(.4,0,.2,1)';         // 08 블라인드의 곡선
const POP = 'cubic-bezier(.3,1.6,.5,1)';      // 톡 튀어나왔다 제자리

/* ---------- ① 기본 규칙(뼈대 · 캐릭터 색 값 0) ----------
   o.pad 뿌리 안쪽 여백 · o.card / o.cardN 틀 바탕(낮 / 밤) · o.maxw 틀 폭 · o.rad 모서리 · o.chipOn 'well' = 칩이 글 칸 색 면 위에 놓임
   줄 높이는 전부 짝수 px(150% 배율에서 아래 조각이 반 화소로 밀리지 않게 — 11-11 b) */
const baseCss = (k, o = {}) => {
  const p = '.' + k, card = o.card || PAPER.l, cardN = o.cardN || PAPER.d, chipL = o.chipOn === 'well' ? PAPER.l : WELL.l, chipD = o.chipOn === 'well' ? PAPER.d : WELL.d;
  const root = `${p}{box-sizing:border-box;width:100%;max-width:${o.maxw || 640}px;margin:0 auto;padding:${o.pad || '16px 20px'};overflow:clip;text-align:left;border:1px solid rgba(20,20,24,.10);border-radius:${o.rad || 12}px;background-color:${card}}`;
  return `
${root}
${p} *{box-sizing:border-box}
${p} .hd{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:22px}
${p} .lm{display:block;flex:0 0 22px;${hw(22, 22)};line-height:0;text-decoration:none}
${p} .lmi{display:block;${hw(22, 22)};background:${svgUrl(lemonSvg('#FFE23C', '#E9BE00'))} center/100% 100% no-repeat}
${p} .tt{display:block;margin:12px 0 0;font:700 20px/28px ${GOTHIC};letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
${p} .ul{display:block;${hw(36, 2)};margin:8px 0 0}
${p} p{margin:0 0 10px;font:400 14.5px/24px ${SERIF};text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
${p} p.nm{margin:14px 0 2px;font:700 13px/20px ${GOTHIC}}
${p} .lg>p:first-child{margin-top:0}
${p} .lg>p:last-child{margin-bottom:0}
${p} .d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
${p} .cp{display:flex;flex:0 1 auto;flex-wrap:wrap;justify-content:flex-end;gap:4px;min-width:0;margin:0;text-indent:0;line-height:0}
${p} .c{display:block;flex:0 1 auto;min-width:0;${hh(20)};padding:0 8px;border-radius:4px;font:700 11px/20px ${GOTHIC};white-space:nowrap;overflow:clip;text-overflow:ellipsis;background-color:${chipL}}
${p}.tn-n .c{background-color:${chipD}}
${p} p.mt{flex:0 1 auto;min-width:0;margin:0;text-indent:0;text-align:right;font:400 12px/20px ${GOTHIC}}
${p} p.mt b{font-weight:700}
${p} .kx{display:block;margin:0}
${p} summary{display:grid;list-style:none;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
${p} summary::-webkit-details-marker{display:none}
${p} details>summary~:not([class]){display:none}
${p} summary:focus:not(:focus-visible){outline:none}
${p} summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
${p}.tl .tt{${tc(INK.l.title)}}
${p}.tl p{${tc(INK.l.text)}}
${p}.tl .d{${tc(INK.l.dlg)}}
${p}.tl .c,${p}.tl p.mt{${tc(INK.l.muted)}}
${p}.tl p.mt b{${tc(INK.l.title)}}
${p}.td .tt{${tc(INK.d.title)}}
${p}.td p{${tc(INK.d.text)}}
${p}.td .d{${tc(INK.d.dlg)}}
${p}.td .c,${p}.td p.mt{${tc(INK.d.muted)}}
${p}.td p.mt b{${tc(INK.d.title)}}
${p}.tn-n{border-color:rgba(224,224,228,.09);background-color:${cardN}}`;
};
const RM = (k) => '\n@media (prefers-reduced-motion:reduce){.' + k + ' *{animation:none!important;transition:none!important}}';
const ON = (k) => '.' + k + ':has(.kx[open])';
const well = (p, sel, more = '') => `${p} ${sel}{${more}background-color:${WELL.l}}\n${p}.tn-n ${sel}{background-color:${WELL.d}}`;
/* 접었다 펴는 칸: 바깥 .sl 이 자르고(overflow:clip) 안 .lw 는 자르지 않아요.
   까닭(11-11 b · 리그 인화지로 확인): grid-template-rows 가 0fr↔1fr 사이(f)일 때 크롬은 칸 높이를 f×H 로 잡지만 그 안 줄(track)은 f×f×H 로 한 번 더 줄여요.
   안쪽 .lw 가 자르면 「칸은 46% 벌어졌는데 글은 21% 만 보이는」 빈 바닥이 생겨요. 바깥에서 자르면 칸 높이만큼 글이 그대로 보여요 */
const fold = (p, dur, from = '0fr', to = '1fr') => `${p} .sl{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:${from};overflow:clip;transition:grid-template-rows ${dur}s ${K8}}
.${p.slice(1)}:has(.kx[open]) .sl{grid-template-rows:${to}}
${p} .lw{min-height:0}`;

/* ---------- ② 화자 색 블록(이름 · 대사 띠 · 밑줄 · 동그란 이름표 · 말풍선 · 점) ---------- */
function speakerCss(k, S) {
  const p = '.' + k; let o = '';
  for (const x of Object.keys(S)) {
    const s = S[x];
    o += `\n${p}.tl .n${x}{${tc(s.inkL)}}\n${p}.td .n${x}{${tc(s.inkD)}}`
      + `\n${p}.tl .d${x},${p}.tl .b${x}{background-color:rgba(${s.rgb},.18)}\n${p}.td .d${x},${p}.td .b${x}{background-color:rgba(${s.rgb},.18)}`
      + `\n${p}.tl .u${x}{background-color:${s.inkL}}\n${p}.td .u${x}{background-color:${s.inkD}}`
      + `\n${p}.tl .s${x}{${tc(s.tagInkL)};background-color:${s.tagL}}\n${p}.td .s${x}{${tc(s.tagInkD)};background-color:${s.tagD}}`
      + `\n${p} .o${x}{background-color:${s.t[500]}}`;
  }
  return o;
}
/* ③ 소품 색 블록: rows = [선택자, 속성, 낮 값, 밤 값]. 속성 'ink' = 글자색(color + fill). 선택자가 '@on ' 으로 시작하면 눌린 상태(:has(.kx[open])) */
function toneCss(k, cv, rows) {
  const base = '.' + k + '.cv-' + cv; let d = '', n = '';
  const decl = (prop, v) => (prop === 'ink' ? tc(v) : prop + ':' + v);
  for (const [sel0, prop, day, night] of rows) {
    const tab = sel0.startsWith('@tab '), on = tab || sel0.startsWith('@on '), sel = tab ? sel0.slice(5) : on ? sel0.slice(4) : sel0, st = tab ? '.gi-tab:has(.tx[open])' : on ? ':has(.kx[open])' : '';
    d += `\n${base}${st} ${sel}{${decl(prop, day)}}`;
    if (night && (night !== day || on)) n += `\n${base}.tn-n${st} ${sel}{${decl(prop, night)}}`;
  }
  return d + n;
}

/* ---------- 글 조립(메시지 → 문단). 사람이 고치기 쉽게: 줄 하나에 문단 하나 ---------- */
const nr = (m) => (m.lead ? m.lead.map((h) => '<p class="nr">' + h + '</p>\n').join('') : m.nr ? '<p class="nr">' + m.nr + '</p>\n' : '');
const nm = (m, more = '') => '<p class="nm n' + m.who + more + '">' + m.name + '</p>\n';
const dl = (m) => (m.rest ? m.rest.map((r) => (r.dlg ? '<p class="dl"><span class="d d' + m.who + '">' + r.html + '</span></p>' : '<p class="nr">' + r.html + '</p>')).join('\n') : '<p class="dl"><span class="d d' + m.who + '">' + m.dl + '</span></p>');
const flow = (msgs) => msgs.map((m) => nr(m) + nm(m) + dl(m)).join('\n');
const initial = (s) => [...String(s || '')].find((ch) => /[\p{L}\p{N}]/u.test(ch)) || '';
const titleBlock = (t, tag = 'div') => '<' + tag + ' class="tt">' + t + '</' + tag + '>';

/* =====================================================================================
   429 카드 — 가장 기본. 장치 없음(비례 · 여백 · 톤만). 흰 카드 + 무채 글 칸 · 정보 칩은 레몬 줄 오른쪽
   ===================================================================================== */
const css429 = (k) => { const p = '.' + k; return `
${well(p, '.lg', 'margin-top:16px;padding:16px 18px;border-radius:8px;')}`; };

/* =====================================================================================
   430 탭 — 탭이 진짜 탭. 「글」 탭과 「정보」 탭(모델 · 프롬프트 · 추가 정보)이 있고 탭 줄을 누르면 넘어가요
   11-11 b: 탭 줄을 틀(카드) 안으로 넣었어요 — 맨 위 무채 띠(높이 48 · overflow:clip) 위에 탭 둘. 앞 탭 = 틀 바탕색(아래 종이와 이어짐) · 뒤 탭만 캐릭터 색(8px 내려가 띠 아래로 잘림)
   내용은 「정보 칸 · 글 칸」 두 접는 칸이 서로 반대로 접혀요(visibility 전환 없음 · 정보 쪽이 짧으면 틀도 짧아져요 — 빈 종이 없음)
   ===================================================================================== */
const css430 = (k) => { const p = '.' + k; return `
${well(p, '.lg', 'margin-top:16px;padding:16px 18px;border-radius:8px;')}`; };   // 11-11 정보 칸: 탭 줄(.tq) · 글 ↔ 정보 접는 칸(.zw)은 infoCss 가 그려요(f.tab.always)
const tabTone = (s) => ({ bgL: s.t[300], bgD: s.t[700], inkL: fit(s.t[900], s.t[300]), inkD: fit(s.t[100], s.t[700]) });   // 뒤 탭 = 색 인덱스 탭(낮 300 · 밤 700), 글자는 그 면에서 대비 4.6 이상
const spk435 = (k, S) => Object.keys(S).map((x) => `\n.${k} .rx[open] .b${x}{background-color:rgba(${S[x].rgb},.32)}`).join('');   // 공감한 말풍선은 화자 색이 짙어져요(② 덩이)

/* =====================================================================================
   431 창 — 제목줄의 단추 셋이 일을 해요. 누르면 창이 제목줄만 남기고 말려 올라가고(0.45초) 단추 셋이 하나로 모여요. 다시 누르면 펴져요
   다 보이는 채 시작(열린 details = 접힌 창) · 단추는 캐릭터 색 세 톤(300 · 500 · 700) · 정보 칩 · 꼬리 문구는 창 맨 아래 「상태 표시줄」(무채 띠)
   ===================================================================================== */
const css431 = (k) => { const p = '.' + k, on = ON(k); return `
${well(p, '.wb', `display:flex;align-items:center;gap:10px;${hh(48)};padding:0 4px 0 16px;`)}
${p} .wb .tt{flex:1 1 auto;min-width:0;margin:0;font-size:16px;line-height:24px;white-space:nowrap;overflow:clip;text-overflow:ellipsis}
${p} .kx{flex:0 0 76px}
${p} .wd{place-items:center;${hw(76, 48)}}
${p} .dg{display:flex;gap:8px}
${p} .o{display:block;${hw(12, 12)};border-radius:50%;transform:translateX(0);transition:transform .45s ${K8}}
${on} .o1{transform:translateX(20px)}
${on} .o3{transform:translateX(-20px)}
${fold(p, 0.45, '1fr', '0fr')}
${p} .lg{padding:16px 20px 18px}
${well(p, '.sb', 'display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;padding:8px 16px;')}
${p} .sb .cp{justify-content:flex-start}
${p} .sb p.mt{text-align:left}
${p} .sb{display:none}
${p}.gi-chip .sb{display:flex}`; };
const tone431 = (S, m) => { const t = S[m].t; return [['.o1', 'background-color', t[300], t[700]], ['.o2', 'background-color', t[500], t[500]], ['.o3', 'background-color', t[700], t[300]]]; };

/* =====================================================================================
   432 상태창 — 정보가 주인공인 틀. 「정보 줄」이 아니라 계기판 한 띠(화자 색 옅은 면 한 장 · 칸 안 칸 없음)에 칸 넷: 모델 · 프롬프트 · 메시지 · 날짜
   메시지 칸은 숫자 + 「대화 점 계기」 — 메시지마다 점 하나(8px), 말한 화자의 색(누가 몇 번 말했는지가 보여요 · 최대 10점). 누름 없음
   ===================================================================================== */
const css432 = (k) => { const p = '.' + k; return `
${p} .ip{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px 16px;margin-top:16px;padding:12px 16px;border-radius:8px}
${p} .ic{min-width:0}
${p} p.kl{margin:0;text-indent:0;font:700 11px/16px ${GOTHIC}}
${p} p.kv{margin:2px 0 0;text-indent:0;font:700 13px/20px ${GOTHIC};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:clip;text-overflow:ellipsis}
${p} .gd{display:inline-flex;gap:2px;margin-left:8px;vertical-align:middle}
${p} .g{display:block;${hw(8, 8)};border-radius:50%}
${well(p, '.lg', 'margin-top:12px;padding:16px 18px;border-radius:8px;')}`; };

/* =====================================================================================
   433 미니 — 가장 가벼운 틀. 장치 없음. 레몬 · 제목 한 줄 · 정보 칩(오른쪽 끝) + 글(칸 없음)
   ===================================================================================== */
const css433 = (k) => { const p = '.' + k; return `
${p} .hd{justify-content:flex-start}
${p} .hd .tt{flex:1 1 auto;min-width:0;margin:0;font-size:15px;line-height:22px;white-space:nowrap;overflow:clip;text-overflow:ellipsis}
${p} .hd .cp{flex:0 1 auto;flex-wrap:nowrap}
${p} .hd p.mt{white-space:nowrap;overflow:clip;text-overflow:ellipsis}
${p} .ul{${hw(24, 2)};margin:8px 0 0 30px}
${p} .lg{margin-top:12px}`; };

/* =====================================================================================
   434 레몬 — 장치 없음. 레몬 로고(테마 경로 그대로)는 제목 앞, 위에 레몬색 포인트 막대 하나(4px · 폭 46%) · 정보 칩은 막대와 같은 줄 오른쪽
   ===================================================================================== */
const css434 = (k) => { const p = '.' + k; return `
${p} .pr{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:20px}
${p} .pb{display:block;flex:0 0 46%;${hh(4)};border-radius:2px;background-color:#FFE23C}
${p} .hd{justify-content:flex-start;margin-top:10px}
${p} .hd .tt{flex:1 1 auto;min-width:0;margin:0}
${well(p, '.lg', 'margin-top:16px;padding:16px 18px;border-radius:8px;')}`; };

/* =====================================================================================
   435 메신저 — 지문은 그냥 글, 대사만 말풍선(화자 색 틴트 .18). 말풍선을 누르면 확인 표시(✓)가 톡(0.28초) — 말풍선마다 따로, 다시 누르면 사라져요
   11-11 pre32: 하트 → ✓(귀여운 척 장식 없음) · 종이색 동그라미 테 대신 화자 색 동그라미(24px) 한 장 위 종이색 ✓ 14×12 · 누른 말풍선은 쏙 눌렸다 돌아오고 화자 색이 짙어져요(.18 → .32)
   동그라미는 말풍선 아래 변에 걸쳐요(안 8px · 밖 16px · 글줄과 안 겹침) · 정보 칩은 제목 밑(대화방 상태 줄 자리)
   ===================================================================================== */
const TICK = 'M2.5 6.5L5.5 9.5L11.5 2.5';   // 11-11 pre32: 공감 하트를 확인 표시(✓)로 바꿨어요(귀여운 척 장식 없음)
const css435 = (k) => { const p = '.' + k; return `
${p} .hd{justify-content:flex-start;gap:10px}
${p} .av{display:block;flex:0 0 36px;${hw(36, 36)};border-radius:50%;font:700 15px/36px ${GOTHIC};text-align:center}
${p} .hs{flex:1 1 auto;min-width:0}
${p} .hs .tt{margin:0;font-size:16px;line-height:24px}
${p} .hs .cp{justify-content:flex-start;margin-top:4px}
${p} .hs p.mt{text-align:left}
${p} .lg{margin-top:18px}
${p} p.nm{text-indent:0}
${p} p.me{text-align:right}
${p} .dl{display:flex;justify-content:flex-start;margin:0 0 18px}
${p} .dl.me{justify-content:flex-end}
${p} .lg>.dl:last-child{margin-bottom:8px}
${p} .rx{display:block;max-width:80%;margin:0}
@keyframes kb435-pp{0%{transform:none}32%{transform:scale(.965)}68%{transform:scale(1.02)}100%{transform:none}}
${p} .rx[open] .bb{animation:kb435-pp .34s ease-out 0s 1}
${p} .bb{grid-template-columns:minmax(0,1fr);padding:8px 12px;transition:background-color .2s ease;border-radius:16px 16px 16px 4px;font:400 14.5px/24px ${SERIF};word-break:keep-all;overflow-wrap:anywhere;-webkit-user-select:text;user-select:text}
${p} .me .bb{border-radius:16px 16px 4px 16px}
${p} .bt{display:block;grid-area:1/1/2/2;min-width:0}
${p} .ht{display:grid;grid-area:1/1/2/2;justify-self:end;align-self:end;place-items:center;${hw(24, 24)};margin:0 0 -24px;border-radius:50%;opacity:0;transform:scale(0);transition:transform .16s ease,opacity .16s ease}
${p} .me .ht{justify-self:start}
${p} .rx[open] .ht{opacity:1;transform:scale(1);transition:transform .28s ${POP},opacity .1s ease}
${p} .hh{display:block;${hw(14, 12)};background-color:${PAPER.l}}
${p}.tn-n .hh{background-color:${PAPER.d}}
${mask1(p + ' .hh', 14, 12, '<path d="' + TICK + '" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>')}
${p}.tl .bb{${tc(INK.l.dlg)}}
${p}.td .bb{${tc(INK.d.dlg)}}`; };

/* =====================================================================================
   436 알림 — 알림이 쌓여 있어요. 처음엔 첫 알림 한 장 + 그 밑에 깔린 두 장의 아랫단. 누르면 쌓인 알림이 아래로 펼쳐지고(0.45초) 아랫단은 접는 손잡이로 바뀌어요
   11-11 b: 아랫단 = 알림 카드와 같은 무채 계열의 옅은 두 겹(한 장씩 12px 좁아지고 아래 모서리 둥글게 — 진한 파란 막대가 「진행 막대」로 읽혀서 바꿨어요)
           펼침 칸은 바깥에서 잘라요(fold 주석) — 칸만 먼저 벌어져 아래가 비는 순간이 없어요
   알림이 하나면 쌓임 · 손잡이 없음. 무채 판(글 칸 색) 위에 흰 알림 카드
   ===================================================================================== */
const LIP = { l: ['#e7e8eb', '#dbdce0'], d: ['#17181b', '#111214'] };   // 깔린 카드 두 장(위 · 아래) — 판보다 한 단 · 두 단 어두운 무채
const css436 = (k) => { const p = '.' + k, on = ON(k); return `
${p} .nl{margin-top:8px}
${p} .nc{margin:8px 0 0;padding:12px 14px;border-radius:12px;background-color:${PAPER.l}}
${p}.tn-n .nc{background-color:${PAPER.d}}
${p} .nc>p:last-child{margin-bottom:0}
${p} p.nh{display:flex;align-items:center;gap:8px;margin:0 0 6px;text-indent:0;font:700 13px/20px ${GOTHIC}}
${p} .av{display:block;flex:0 0 20px;${hw(20, 20)};border-radius:50%;font:700 11px/20px ${GOTHIC};text-align:center}
${p} .tm{margin-left:auto;font:400 12px/20px ${GOTHIC};font-variant-numeric:tabular-nums}
${fold(p, 0.45)}
${p} .st{grid-template-columns:minmax(0,1fr);grid-template-rows:40px;${hh(40)}}
${p} .s1,${p} .s2{display:block;grid-area:1/1/2/2;align-self:start;${hh(8)};border-radius:0 0 12px 12px;transform-origin:50% 0;transform:scaleY(1);opacity:1;transition:transform .2s ease .45s,opacity .2s ease .45s}
${p} .s1{margin:0 12px;background-color:${LIP.l[0]}}
${p} .s2{margin:8px 24px 0;background-color:${LIP.l[1]}}
${p}.tn-n .s1{background-color:${LIP.d[0]}}
${p}.tn-n .s2{background-color:${LIP.d[1]}}
${on} .s1,${on} .s2{transform:scaleY(0);opacity:0;transition:transform .1s ease 0s,opacity .1s ease 0s}
${on} .sl{transition-delay:.08s}
${p} .gr{display:block;grid-area:1/1/2/2;justify-self:center;align-self:center;${hw(36, 4)};border-radius:2px;opacity:0;transition:opacity .12s ease 0s}
${on} .gr{opacity:1;transition:opacity .2s ease .4s}
${p}.tl .tm{${tc(INK.l.muted)}}
${p}.td .tm{${tc(INK.d.muted)}}`; };
const tone436 = (S, m) => { const t = S[m].t; return [['.gr', 'background-color', t[300], t[700]]]; };

/* =====================================================================================
   437 대본 — 장치 없음. 조판만: 이름 칸(72px · 오른쪽 맞춤 · 화자 색) | 대사 칸. 지문은 대사 칸 쪽에만 흘러요(이름 칸은 비움) · 정보 칩은 제목 밑 가운데(표지의 제작 줄)
   ===================================================================================== */
const css437 = (k) => { const p = '.' + k; return `
${p} .tt{text-align:center}
${p} .ul{margin:8px auto 0}
${p} .cp{justify-content:center;margin-top:12px}
${p} p.mt{margin-top:12px;text-align:center}
${p} .lg{display:grid;grid-template-columns:72px minmax(0,1fr);column-gap:16px;margin-top:20px}
${p} .lg>p{grid-column:2;text-indent:0}
${p} .lg>p.nm{grid-column:1;margin:0 0 10px;text-align:right;font:700 13px/24px ${GOTHIC}}
${p} .lg>p.nr{margin-bottom:12px}
${p} .lg>p.dl{margin-bottom:12px}
${p} .lg>p.dl:last-child{margin-bottom:0}`; };

/* =====================================================================================
   438 기록 — 장치 없음. 시각 칸 | 타임라인(2px 줄 + 화자 색 점) | 이름 · 글. 줄은 첫 점에서 시작해 마지막 점에서 끝나요
   ===================================================================================== */
const css438 = (k) => { const p = '.' + k; return `
${p} .lg{margin-top:18px}
${p} .rw{display:grid;grid-template-columns:40px 16px minmax(0,1fr);column-gap:8px}
${p} .tm{display:block;grid-area:1/1/2/2;font:400 12px/20px ${GOTHIC};font-variant-numeric:tabular-nums;text-align:right}
${p} .rl{display:block;grid-area:1/2/2/3;justify-self:center;width:2px}
${p} .rw:first-child .rl{margin-top:10px}
${p} .rw:last-child .rl{align-self:start;${hh(10)}}
${p} .rw:first-child:last-child .rl{${hh(0)}}
${p} .dt{display:block;grid-area:1/2/2/3;justify-self:center;align-self:start;${hw(8, 8)};margin-top:6px;border-radius:50%}
${p} .rc{grid-area:1/3/2/4;min-width:0;padding-bottom:16px}
${p} .rw:last-child .rc{padding-bottom:0}
${p} .rc>p.nm{margin:0 0 4px;text-indent:0;line-height:20px}
${p} .rc>p:last-child{margin-bottom:0}
${p}.tl .tm{${tc(INK.l.muted)}}
${p}.td .tm{${tc(INK.d.muted)}}`; };
const tone438 = (S, m) => { const t = S[m].t; return [['.rl', 'background-color', t[300], t[700]]]; };

/* =====================================================================================
   439 노트 — 장치 없음(다듬기만). 공책 한 장: 틀 전체가 종이 한 톤(무채 글 칸 색 · 안쪽 칸 없음) · 날짜 작게 · 왼쪽에 공책의 겹 여백 선(2px 둘 · 캐릭터 색 300 / 500)
   모눈 · 줄(「격자 끔」 결정) · 고리(바인더 03) · 모서리 접기(견출지 02) · 인덱스 플래그(묶음 13)는 안 써요
   ===================================================================================== */
const css439 = (k) => { const p = '.' + k; return `
${p} p.sb{margin:12px 0 0;text-indent:0;font:400 12px/18px ${GOTHIC};font-variant-numeric:tabular-nums}
${p} .tt{margin-top:2px}
${p} .nb{display:grid;grid-template-columns:2px 2px 2px minmax(0,1fr);margin-top:18px}
${p} .m1{display:block;grid-area:1/1/2/2}
${p} .m2{display:block;grid-area:1/3/2/4}
${p} .lg{grid-area:1/4/2/5;min-width:0;padding:2px 0 2px 16px}
${p}.tl p.sb{${tc(INK.l.muted)}}
${p}.td p.sb{${tc(INK.d.muted)}}`; };
const tone439 = (S, m) => { const t = S[m].t; return [['.m1', 'background-color', t[300], t[700]], ['.m2', 'background-color', t[500], t[500]]]; };

/* =====================================================================================
   440 편지 — 장치 없음(조판 + 우표 한 장). 좁은 편지지: To. 받는 이(굵게) · 글 · From. 보낸 이(오른쪽) · 날짜 · 오른쪽 위에 우표(36×44 · 톱니 테 · 캐릭터 색 세 톤)
   우표 그림 = 옅은 하늘 면 + 해(8px) + 언덕(둥근 면) · 소인 「탁」은 안 넣었어요(441 도장과 같은 꼴 · 「이제 도장을 쓰지 않아요」) — 우표는 붙어 있기만 해요
   ===================================================================================== */
const PERF = (() => { let d = 'M0 0H36V44H0Z'; const c = (x, y) => { d += 'M' + (x - 2) + ' ' + y + 'a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Z'; }; for (let i = 0; i < 6; i++) { c(3 + 6 * i, 0); c(3 + 6 * i, 44); } for (let j = 0; j < 7; j++) { c(0, 4 + 6 * j); c(36, 4 + 6 * j); } return d; })();
const css440 = (k) => { const p = '.' + k; return `
${p} .hd{align-items:flex-start}
${p} .pt{display:grid;flex:0 0 36px;${box(36, 44)};place-items:center}
${mask1(p + ' .pt', 36, 44, '<path fill-rule="evenodd" d="' + PERF + '"/>')}
${p} .pv{display:grid;grid-area:1/1/2/2;${box(24, 32)};overflow:clip}
${p} .pc{display:block;grid-area:1/1/2/2;justify-self:end;align-self:start;${hw(8, 8)};margin:6px 4px 0 0;border-radius:50%}
${p} .ph{display:block;grid-area:1/1/2/2;justify-self:start;align-self:end;${hw(36, 28)};margin:0 0 -12px -14px;border-radius:50%}
${p} p.to{margin:-10px 0 0;padding-right:48px;text-indent:0;font:700 18px/26px ${GOTHIC};word-break:keep-all}
${p} p.fr{margin:0;text-indent:0;text-align:right;font:700 16px/24px ${GOTHIC}}
${p} .tk{font-weight:400;font-size:13px}
${p} p.dt{margin:2px 0 0;text-indent:0;text-align:right;font:400 12px/18px ${GOTHIC};font-variant-numeric:tabular-nums}
${p} .lg{margin-top:20px}
${p} .sg{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:20px}
${p} .sg .cp{justify-content:flex-start}
${p} .sg p.mt{text-align:left}
${p} .sr{flex:1 1 auto;min-width:0}
${p}.tl p.to,${p}.tl p.fr{${tc(INK.l.title)}}
${p}.td p.to,${p}.td p.fr{${tc(INK.d.title)}}
${p}.tl .tk,${p}.tl p.dt{${tc(INK.l.muted)}}
${p}.td .tk,${p}.td p.dt{${tc(INK.d.muted)}}`; };
const tone440 = (S, m) => { const t = S[m].t; return [['.pt', 'background-color', t[300], t[700]], ['.pv', 'background-color', t[100], t[900]], ['.pc', 'background-color', t[500], t[300]], ['.ph', 'background-color', t[500], t[500]]]; };

/* =====================================================================================
   441 일기 — 「참 잘했어요」 도장. 글 아래 오른쪽에 도장이 서 있어요. 누르면 도장이 들려 가서 꾹(0.4초) 찍고 제자리로(1초). 다시 누르면 찍힌 자국이 지워져요
   11-11 pre32 글 움직임: 누르기 전엔 대사 띠가 꺼져 있다가, 도장이 꾹 찍히는 순간(0.4초) 글이 3px 쿵 눌렸다 돌아오고 화자 색 띠가 켜져요. 지우면 띠도 꺼져요
   칸 144×84 · 자국 64×64(꽃 테 + 두 줄 글자 · −10도) · 도장 32×38(손잡이 · 목 · 몸 · 고무) — 쉬는 자리 오른쪽 아래
   ===================================================================================== */
const FLOWER = (() => { const n = 10, c = 32, R = 26, r = 9; const P = (i) => { const a = (i * 360 / n - 90) * Math.PI / 180; return (c + R * Math.cos(a)).toFixed(2) + ' ' + (c + R * Math.sin(a)).toFixed(2); }; let d = 'M' + P(0); for (let i = 1; i <= n; i++) d += 'A' + r + ' ' + r + ' 0 0 1 ' + P(i % n); return d + 'Z'; })();
const stampHtml = (f) => '<span class="im">' + sp('fl') + '<span class="sw">' + f.stamp[0] + '<br>' + f.stamp[1] + '</span></span><span class="sp">' + sp('k1') + sp('k2') + sp('k3') + sp('k4') + '</span>';
const css441 = (k) => { const p = '.' + k, on = ON(k), T = (x, y) => 'transform:translate(' + x + 'px,' + y + 'px)'; return `
${p} p.sb{margin:4px 0 0;text-indent:0;font:400 13px/20px ${GOTHIC}}
${p} .lg{margin-top:18px}
${p} .fz{display:flex;justify-content:flex-end;margin-top:4px}
${p} .sz{${box(144, 84)}}
${p} .im{display:grid;grid-area:1/1/2/2;justify-self:start;align-self:start;${box(64, 64)};margin:20px 0 0;transform:rotate(-10deg);opacity:0;transition:opacity .25s ease 0s}
${on} .im{opacity:1;transition:opacity .04s linear .42s}
${p} .fl{${LY};${hw(64, 64)}}
${mask1(p + ' .fl', 64, 64, '<path d="' + FLOWER + '" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="round"/>')}
${p} .sw{display:block;grid-area:1/1/2/2;justify-self:center;align-self:center;font:700 12px/14px ${GOTHIC};letter-spacing:-.02em;text-align:center}
${p} .sp{display:grid;grid-area:1/1/2/2;justify-self:start;align-self:start;${box(32, 38)};margin:46px 0 0 108px;${T(0, 0)}}
@keyframes kb441-sp{0%{${T(0, 0)}}26%{${T(-92, -44)}}40%{${T(-92, -20)}}54%{${T(-92, -20)}}72%{${T(-92, -44)}}100%{${T(0, 0)}}}
${on} .sp{animation:kb441-sp 1s ${K8} 0s 1}
${p} .lg .d{transition:background-color .2s ease 0s}
${p}:not(:has(.kx[open])) .lg .d{background-color:transparent}
${on} .lg .d{transition:background-color .06s linear .42s}
@keyframes kb441-tk{0%{transform:none;animation-timing-function:cubic-bezier(.2,.8,.4,1)}24%{transform:translateY(3px);animation-timing-function:${K8}}100%{transform:none}}
${on} .lg{animation:kb441-tk .32s linear .4s 1}
${p} .k1{${LY};${hw(16, 16)};margin:0 0 0 8px;border-radius:50%}
${p} .k2{${LY};${hw(8, 12)};margin:14px 0 0 12px}
${p} .k3{${LY};${hw(32, 8)};margin:26px 0 0;border-radius:4px 4px 0 0}
${p} .k4{${LY};${hw(32, 4)};margin:34px 0 0;border-radius:0 0 2px 2px}
${p}.tl p.sb{${tc(INK.l.muted)}}
${p}.td p.sb{${tc(INK.d.muted)}}`; };
const tone441 = (S, m) => { const t = S[m].t; return [
  ['.fl', 'background-color', S[m].inkL, S[m].inkD], ['.sw', 'ink', S[m].inkL, S[m].inkD],
  ['.k1', 'background-color', t[500], t[500]], ['.k2', 'background-color', t[700], t[300]], ['.k3', 'background-color', t[300], t[700]], ['.k4', 'background-color', t[300], t[700]],   // 11-11 pre32: 고무 띠도 몸과 한 톤(가는 다른 톤 띠 없음)
]; };

/* =====================================================================================
   442 기사 — 장치 없음. 조판만: 명조 큰 제목 · 기자란(날짜 · 모델 · 프롬프트) · 굵은 줄(4px) + 가는 줄(2px · 화자 색) · 첫 글자 크게
   11-11 b: 기본은 한 단이에요(두 단 columns 는 고르는 판 opt.cols — 다시 그릴 때 단 나눔이 달라질 수 있는 속성이라 기본에서 뺐어요).
           첫 글자는 ::first-letter 가 아니라 진짜 span(.dc) 하나 — 가상 요소가 안 먹는 곳에서도 그대로예요
   ===================================================================================== */
const css442 = (k, o = {}) => { const p = '.' + k; return `
${p} .tt{margin-top:10px;font:700 24px/32px ${SERIF};letter-spacing:-.02em}
${p} p.by{margin:8px 0 0;text-indent:0;font:400 12px/18px ${GOTHIC}}
${p} .bx{display:none}
${p}.gi-chip .bx{display:inline}
${p} .r1{display:block;${hh(4)};margin:12px 0 0;background-color:${INK.l.title}}
${p}.tn-n .r1{background-color:${INK.d.title}}
${p} .r2{display:block;${hh(2)};margin:4px 0 0}
${p} .lg{margin-top:16px${o.cols ? ';columns:260px 2;column-gap:28px' : ''}}${o.cols ? `
${p} .lg>p.nm{-webkit-column-break-after:avoid;break-after:avoid}
${p} .lg>p.dl{-webkit-column-break-inside:avoid;break-inside:avoid}` : ''}
${p} .lg>p.nr:first-child{text-indent:0}
${p} .dc{float:left;margin:0 8px 0 0;font:700 44px/48px ${SERIF}}
${p}.tl p.by{${tc(INK.l.muted)}}
${p}.td p.by{${tc(INK.d.muted)}}
${p}.tl .dc{${tc(INK.l.title)}}
${p}.td .dc{${tc(INK.d.title)}}`; };

/* =====================================================================================
   443 책 — 가름끈. 오른쪽 위 책등에서 끈 끝(20px)이 나와 있어요. 누르면 끈이 주르륵 내려와(64px · 0.5초 · 끝에서 2.6px 쯤 지나쳤다 멎음) 오른쪽 여백에 걸려요. 다시 누르면 올라가요
   11-11 pre32 글 움직임: 끈이 내려오는 박자에 글 줄이 위에서부터 차례로(0.05초 간격) 살짝 들려 흐려졌다 내려앉아요(0.76초에 끝) · 끈 모양은 clip-path 가 아니라 마스크(가장자리 도우미)
   끈은 움직이지 않는 창(12×72 · overflow:clip) 안에서만 미끄러져요 · 글 오른쪽 여백(48px) 안이라 글자와 안 겹쳐요 · 정보 칩은 쪽 번호 밑 가운데(판권 줄 자리)
   ===================================================================================== */
const css443 = (k) => { const p = '.' + k, on = ON(k); return `
${p} .hd p.rh{flex:1 1 auto;min-width:0;margin:0;padding:0 8px;text-indent:0;text-align:center;font:400 12px/22px ${GOTHIC};letter-spacing:.06em;white-space:nowrap;overflow:clip;text-overflow:ellipsis}
${p} .kx{flex:0 0 44px;margin:-16px -8px -34px 0}
${p} .rb{${box(44, 72)}}
${p} .rw{display:grid;grid-area:1/1/2/2;justify-self:center;align-self:start;${box(12, 72)};overflow:clip}
${p} .rr{display:grid;grid-area:1/1/2/2;justify-self:start;align-self:start;${box(12, 64)};transform:translateY(-44px);transition:transform .5s ${ZE}}
${mask1(p + ' .rr', 12, 64, '<path d="M0 0H12V64L6 58L0 64Z"/>')}
${on} .rr{transform:translateY(0)}
@keyframes kb443-pg{0%{opacity:1;transform:none;animation-timing-function:ease-out}28%{opacity:.25;transform:translateY(-5px);animation-timing-function:cubic-bezier(.3,0,.3,1.3)}100%{opacity:1;transform:none}}
${Array.from({ length: 8 }, (_, i) => `${on} .lg>*:nth-child(${i < 7 ? i + 1 : 'n+8'}){animation:kb443-pg .4s linear ${(0.06 + 0.05 * i).toFixed(2)}s 1}`).join('\n')}
${p} .lg{margin-top:22px;padding:0 28px}
${p} p.pn{margin:22px 0 0;text-indent:0;text-align:center;font:400 12px/18px ${GOTHIC}}
${p} .cp{justify-content:center;margin-top:10px}
${p} p.mt{margin-top:10px;text-align:center}
${p}.tl p.rh,${p}.tl p.pn{${tc(INK.l.muted)}}
${p}.td p.rh,${p}.td p.pn{${tc(INK.d.muted)}}`; };
const tone443 = (S, m) => { const t = S[m].t; return [['.rr', 'background-color', t[500], t[500]]]; };   // 11-11 b: 끈은 한 톤(오른쪽 4px 진한 줄이 광택 조각으로 읽혀서 뺐어요)

/* =====================================================================================
   444~447 갤러리 넷 — 사진 자리가 주인공. 시안의 사진은 「견본 색 면」(span.ph · 캐릭터 색 톤)이고, 실제로는 같은 자리에 진짜 <img class="ph">(첨부 목록에 뜨게)
   가로 띠(444 · 445): 폰 = 손가락 가로 넘김 + scroll-snap / PC = −90도 회전 트랙으로 Shift 없이 휠(조건 (hover:hover) and (pointer:fine) and (min-width:560px) · 스냅 끔) · overflow:hidden 0 · 스크롤바 숨김
     띠는 틀 좌우 끝까지(틀 여백을 음수 여백으로 넘겨요) — 마지막 사진이 틀 변에서 잘려 「더 있다」가 보여요. 첫 사진은 글과 같은 20px 줄에 맞아요
   444 가로 넘김: 3:4 세로 사진(150×200) · 간격 8 · 모서리 8 · 오른쪽 위 반투명 번호
   445 가로 즉석 사진: 무채 띠 위 흰 사진 카드(152×184 · 사진 136×136 · 아래 사진 이름) · 옅은 그림자 — 번호 대신 이름
   446 격자: 3열 · 간격 4 · 정사각 · 장수가 3의 배수면 첫 장이 2×2(대표 사진) · 바깥 모서리 8 · 반투명 번호
   447 격자 즉석 사진(사진 기록장): 무채 판 위 흰 사진 카드 격자(136px 이상 — 640 에서 석 장, 폰에서 두 장 · 간격 16) · 카드가 번갈아 살짝 기울어요(−2 · 2도) · 날짜 줄
   ===================================================================================== */
const PHN = ['옥상', '난간', '캔 커피', '물웅덩이', '가로등', '늦은 별'];
const stripCss = (p, W, pad) => `
${p} .gf{display:block;container-type:inline-size;${hh(200)};margin:16px -20px 0;overflow:clip}
${p} .gt{display:flex;gap:8px;${hh(200)};padding:0 20px;overflow-x:auto;overflow-y:clip;scroll-snap-type:x mandatory;scroll-padding:0 20px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
${p} .gt::-webkit-scrollbar{display:none}
${p} .gi{display:block;flex:0 0 ${W}px;${hw(W, 200)};scroll-snap-align:start}
${p} .gl{display:grid;grid-template-columns:${W}px;grid-template-rows:${200 - pad * 2}px;${hw(W, 200)};padding:${pad}px 0}
@media (hover:hover) and (pointer:fine) and (min-width:560px){
${p} .gt{display:block;width:200px;height:100cqw;block-size:100cqw;padding:20px 0;overflow-x:clip;overflow-y:auto;scroll-snap-type:none;transform-origin:0 0;transform:translateY(200px) rotate(-90deg)}
${p} .gi{width:200px;height:${W}px;block-size:${W}px;margin:0 0 8px}
${p} .gl{transform-origin:0 0;transform:translateX(200px) rotate(90deg)}
}`;
const numCss = (p) => `
${p} .gn{display:block;grid-area:1/1/2/2;justify-self:end;align-self:start;margin:6px;padding:0 6px;border-radius:4px;font:700 11px/18px ${GOTHIC};font-variant-numeric:tabular-nums;background-color:rgba(17,18,20,.4);${tc('#fff')}}`;
const cardCss = (p) => `
${p} .pk{display:block;grid-area:1/1/2/2;padding:8px 8px 0;border-radius:2px;background-color:#fff;box-shadow:0 2px 6px rgba(20,20,24,.14)}
${p}.tn-n .pk{box-shadow:none}
${p} .pk .ph{border-radius:0}
${p}.gk p.cn{margin:0;padding:6px 0 8px;text-indent:0;text-align:center;font:400 12px/20px ${GOTHIC};white-space:nowrap;overflow:clip;text-overflow:ellipsis;${tc('#5f6168')}}`;
const css444 = (k) => { const p = '.' + k; return `${stripCss(p, 150, 0)}
${p} .ph{display:block;grid-area:1/1/2/2;width:150px;height:200px!important;block-size:200px!important;border-radius:8px;object-fit:cover}${numCss(p)}
${well(p, '.lg', 'margin-top:16px;padding:16px 18px;border-radius:8px;')}`; };
const css445 = (k) => { const p = '.' + k; return `${stripCss(p, 152, 8)}
${well(p, '.gf', '')}
${p} .ph{display:block;width:136px;height:136px!important;block-size:136px!important;object-fit:cover}${cardCss(p)}
${p} .lg{margin-top:16px}`; };
const css446 = (k) => { const p = '.' + k; return `
${p} .gg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:16px;border-radius:8px;overflow:clip}
${p} .gc{display:grid;grid-template-columns:minmax(0,1fr);min-width:0}
${p} .gc.big{grid-column:1/3;grid-row:1/3}
${p} .ph{display:block;grid-area:1/1/2/2;width:100%;aspect-ratio:1/1;object-fit:cover}${numCss(p)}
${well(p, '.lg', 'margin-top:16px;padding:16px 18px;border-radius:8px;')}`; };
const css447 = (k) => { const p = '.' + k; return `
${p} p.sb{margin:4px 0 0;text-indent:0;font:400 13px/20px ${GOTHIC}}
${p} p.dt{margin:2px 0 0;text-indent:0;font:400 12px/18px ${GOTHIC};font-variant-numeric:tabular-nums}
${p} .gg{display:grid;grid-template-columns:repeat(auto-fill,minmax(136px,1fr));gap:16px;margin-top:20px;padding:0 4px}
${p} .gc{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;transform:rotate(-2deg)}
${p} .gc:nth-child(2n){transform:rotate(2deg)}
${p} .gc:nth-child(3n){transform:rotate(0deg)}
${p} .ph{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}${cardCss(p)}
${p} .lg{margin-top:20px;padding:16px 18px;border-radius:8px;background-color:${PAPER.l}}
${p}.tn-n .lg{background-color:${PAPER.d}}
${p}.tl p.sb,${p}.tl p.dt{${tc(INK.l.muted)}}
${p}.td p.sb,${p}.td p.dt{${tc(INK.d.muted)}}`; };
const toneGal = (S, m) => { const t = S[m].t; return [['.f1', 'background-color', t[300], t[700]], ['.f2', 'background-color', t[500], t[500]], ['.f3', 'background-color', t[100], t[900]], ['.f4', 'background-color', t[700], t[300]]]; };
const phSpan = (i) => '<span class="ph f' + (i % 4 + 1) + '"></span>';
const num2 = (i) => String(i + 1).padStart(2, '0');
const stripHtml = (n, polaroid) => '<div class="gf"><div class="gt">\n' + Array.from({ length: n }, (_, i) => '<div class="gi"><div class="gl">' + (polaroid ? '<div class="pk">' + phSpan(i) + '<p class="cn">' + PHN[i % PHN.length] + '</p></div>' : phSpan(i) + '<span class="gn">' + num2(i) + '</span>') + '</div></div>').join('\n') + '\n</div></div>';
const gridHtml = (n, polaroid) => '<div class="gg">\n' + Array.from({ length: n }, (_, i) => '<div class="gc' + (!polaroid && n % 3 === 0 && i === 0 ? ' big' : '') + '">' + (polaroid ? '<div class="pk">' + phSpan(i) + '<p class="cn">' + PHN[i % PHN.length] + '</p></div>' : phSpan(i) + '<span class="gn">' + num2(i) + '</span>') + '</div>').join('\n') + '\n</div>';

/* =====================================================================================
   정보 칸(11-11 사용자 결정) — 모델 · 프롬프트를 적는 칸의 꼴을 뿌리 class 하나로 골라요. 마크업은 세 꼴 모두 늘 들어 있고 CSS 가 숨겨요
     (없음)    끔 — 기본. 칩도 탭도 안 보여요
     gi-chip   알약 칩 셋 「LOG」 · 모델 · 프롬프트(틀마다 정해진 자리 — p.cp)
     gi-tab    「LOG」 · 「프롬프트」 탭(details.tx > summary.tq) — 「프롬프트」를 누르면 글 칸 자리에 모델 · 프롬프트 줄(.zp)이 나와요. 탭 꼴은 열아홉 틀 모두 430 판(맨 위 띠 위 탭 둘 — 11-11 「탭은 이 버전이 나음」)
   글자를 갈아 끼울 자리: .gv-tab-log · .gv-tab-info(탭 이름 둘 — 기본 「LOG」 · 「프롬프트」 · 기호도 돼요) · .gv-log(칩 첫 글자) · .gv-model · .gv-prompt (칩과 정보 줄 양쪽에 같은 class — 둘 다 바꿔요. 비우려면 그 span/p 를 지워요)
   탭 꼴 둘: 'band' = 430 처럼 맨 위 무채 띠 위에 탭 둘(앞 탭 = 틀 바탕색 · 뒤 탭 = 화자 색) / 'index' = 종이 틀용 색인 탭(틀 윗변에 붙어서 내려온 탭 — 탭 꼴일 때는 틀의 위 테두리 1px 를 없애 탭 위에 바탕색 줄이 안 남아요 — 고른 탭 = 화자 색 · 안 고른 탭 = 무채, 8px 짧음)
   글 ↔ 정보는 한 칸(.zw)에 겹쳐 놓아요(.zs.z1 글 · .zs.z2 정보) — 둘의 윗변이 같아서 넘기는 내내 그 위 간격이 안 바뀌어요. 정보 칸은 바로 펴지고(닫을 때는 0.32초 뒤에 접힘) 글 칸만 0.32초에 접혀요 — 틀 높이가 한쪽으로만 움직여요
   f.tab = { style, mt(정보 줄 위 여백 = 그 틀 글 칸의 위 여백), well(무채 칸에 담을지), pp(정보 줄 칸의 안쪽 여백 등), at:'lw'(431 — 탭 줄을 접는 창 안에), always(430 — 끔 · 칩일 때도 「글」 탭 하나는 보임) }
   ===================================================================================== */
const padOf = (s) => { const a = String(s || '16px 20px').trim().split(/\s+/).map((v) => parseFloat(v)); return a.length === 1 ? [a[0], a[0], a[0], a[0]] : a.length === 2 ? [a[0], a[1], a[0], a[1]] : a.length === 3 ? [a[0], a[1], a[2], a[1]] : a; };
const tabOf = (f) => Object.assign({ style: 'band', mt: 16, well: true, pp: '' }, f.tab || {});
const infoCss = (k, f, o) => {
  const p = '.' + k, t = tabOf(f), T = t.always ? p : p + '.gi-tab', on = p + '.gi-tab:has(.tx[open])', onB = p + '.gk.gk.gi-tab:has(.tx[open])', onBN = p + '.gk.gk.tn-n.gi-tab:has(.tx[open])';
  const card = o.card || PAPER.l, cardN = o.cardN || PAPER.d, inv = card === WELL.l, altL = inv ? PAPER.l : WELL.l, altD = inv ? PAPER.d : WELL.d;
  const [pt, pr, pb, pl] = padOf(o.pad), mb = t.at === 'lw' ? 0 : Math.max(0, pt - pb);   // 틀 아래 여백이 위보다 작은 틀(436 — 아랫단 칸이 바닥 여백 노릇)은 정보 칸 밑에 그만큼 여백을 줘요
  const tv = `display:block;flex:0 1 auto;min-width:64px;${hh(36)};font:700 13px/28px ${GOTHIC};text-align:center;white-space:nowrap;overflow:clip;text-overflow:ellipsis`, tr = 'background-color .2s ease,color .2s ease,-webkit-text-fill-color .2s ease';
  const strip = t.style === 'index' ? `
${p}.gi-tab{border-top-width:0;padding-top:${pt + 1}px}
${p} .tq{display:flex;align-items:flex-start;gap:4px;${hh(36)};margin:-${pt + 1}px 0 12px;overflow:clip}
${p} .tv{${tv};padding:8px 16px 0;border-radius:0 0 10px 10px;transition:margin-top .24s ${K8},${tr}}
${p} .t1{margin-top:0}
${p} .t2{margin-top:-8px;background-color:${altL};${tc(INK.l.muted)}}
${p}.tn-n .t2{background-color:${altD};${tc(INK.d.muted)}}
${on} .t1{margin-top:-8px}
${on} .t2{margin-top:0}
${onB} .t1{background-color:${altL};${tc(INK.l.muted)}}
${onBN} .t1{background-color:${altD};${tc(INK.d.muted)}}` : `
${p} .tq{display:flex;align-items:flex-end;gap:4px;${hh(48)};margin:${t.at === 'lw' ? '0' : `-${pt}px -${pr}px ${pt}px -${pl}px`};padding:0 ${pl || 20}px;overflow:clip;background-color:${altL}}
${p}.tn-n .tq{background-color:${altD}}
${p} .tv{${tv};padding:0 16px 8px;border-radius:10px 10px 0 0;transition:margin-bottom .24s ${K8},padding .24s ${K8},${tr}}
${p} .t1{margin-bottom:0;padding:8px 16px 0;background-color:${card};${tc(INK.l.title)}}
${p}.tn-n .t1{background-color:${cardN};${tc(INK.d.title)}}
${p} .t2{margin-bottom:-8px}
${on} .t1{margin-bottom:-8px;padding:0 16px 8px}
${on} .t2{margin-bottom:0;padding:8px 16px 0}
${onB} .t2{background-color:${card};${tc(INK.l.title)}}
${onBN} .t2{background-color:${cardN};${tc(INK.d.title)}}`;
  return `
${p} .cp,${p} p.mt{display:none}
${p}.gi-chip .cp{display:flex}
${p}.gi-chip p.mt{display:block}
${p} .tx{display:${t.always ? 'block' : 'none'};margin:0}${t.always ? `
${p}:not(.gi-tab) .t2{display:none}
${p}:not(.gi-tab) .tq{cursor:default}` : `
${p}.gi-tab .tx{display:block}`}${strip}
${p}:not(.gi-tab) .zs.z2{display:none}
${T} .zw{display:grid;grid-template-columns:minmax(0,1fr)}
${T} .zs{display:grid;grid-area:1/1/2/2;align-self:start;grid-template-columns:minmax(0,1fr);overflow-x:visible;overflow-y:clip;transition:grid-template-rows .32s ${K8}}   /* 접힘은 세로로만 — 가로로 자르면 줄 끝 대사 바탕의 둥근 끝(좌우 2px)이 잘려요(11-11 검수) */
${T} .zi{min-height:0;transition:opacity .2s ease 0s}
${T} .z1{grid-template-rows:1fr}
${T} .z2{grid-template-rows:0fr;transition:grid-template-rows 0s linear .32s}
${T} .z2 .zi{opacity:0}
${on} .z1{grid-template-rows:0fr}
${on} .z2{grid-template-rows:1fr;transition:grid-template-rows 0s linear 0s}
${on} .z1 .zi{opacity:0}
${on} .z2 .zi{opacity:1;transition:opacity .2s ease .1s}
${f.scPad ? `${T}:not(.gh-s):not(.gh-m):not(.gh-l) .z1{margin-bottom:-${f.scPad}px}
${p}.gi-tab ${f.sc || '.lg'}{padding-bottom:${f.scPad}px}
` : ''}${p} .zp{margin-top:${t.mt}px;${mb ? 'margin-bottom:' + mb + 'px;' : ''}${t.well ? 'padding:16px 18px;border-radius:8px;' : ''}${t.pp}${t.well ? `background-color:${altL}` : ''}}${t.well ? `
${p}.tn-n .zp{background-color:${altD}}` : ''}
${p} p.ir{margin:0 0 4px;text-indent:0;font:400 13px/22px ${GOTHIC}}
${p} .zp>p:last-child{margin-bottom:0}
${p} .ik{display:inline-block;min-width:72px;font-weight:700}
${p}.tl .ik{${tc(INK.l.muted)}}
${p}.td .ik{${tc(INK.d.muted)}}`;
};
// 탭의 화자 색(③ 덩이) — band: 뒤 탭 · index: 고른 탭
const tabRows = (f, s) => { const c = tabTone(s), a = tabOf(f).style === 'index' ? ['.t1', '@tab .t2'] : ['.t2', '@tab .t1'];
  return a.flatMap((sel) => [[sel, 'background-color', c.bgL, c.bgD], [sel, 'ink', c.inkL, c.inkD]]); };

/* =====================================================================================
   높이 제한(11-11 사용자 결정) — 기본은 글 길이만큼 늘어나요. 뿌리에 gh-s(280) · gh-m(420) · gh-l(600)을 붙이면 글 칸(f.sc — 없으면 .lg) 안에서만 세로로 넘겨요
   값은 테마 src/log-copy-presets.js 의 HEIGHTS 그대로 · 정보 칸 class(gi-chip · gi-tab)와 따로라 함께 켜도 돼요 · 제목 · 정보 칸 · 소품(도장 · 끈 · 창 단추)은 스크롤 칸 밖이에요
   스크롤 표시: B안 확정(11-11 · 「이게 낫긴한데 … 꺽쇠모양으로」) — 아래 SHAPES 주석
   깡통 정화기가 ::-webkit-scrollbar 규칙 묶음의 첫 선택자 앞머리를 떼어 버려서(글 안 모든 막대가 숨겨짐) 맨 앞에 안 쓰는 선택자(.sq0)를 하나 둬요
   스크롤 막대는 안 보여요(scrollbar-width:none + ::-webkit-scrollbar{display:none} — 11-11 「스크롤바 안보이게해줘」). 아랫변을 옅게 가리는 마스크는 안 넣었어요(그라데이션 0 규칙 · 마지막 줄 글자가 늘 흐려져요) — 글 줄이 칸 아랫변에서 잘려 보이는 것으로 「더 있다」가 읽혀요
   ===================================================================================== */
/* 스크롤 표시(11-11 사용자 결정 B안 — 글 칸 밑 가운데 작은 표시 · 높이 제한을 켜면 늘 들어가요 · 모양은 고르는 중)
   모양: (가) 둥근 꺽쇠 ﹀ 확정(11-11 「이걸로 체택」 · 시안이던 겹꺽쇠 · 둥근 삼각 · 처진 점 셋은 뺐어요) — 선 2.2px · 끝 둥금 · 14×8 · 무채 흐린 글자색 한 톤 · 테 없음
   표시는 글 칸을 감싼 .zi 를 격자로 만들어 글 칸 밑 4px 에 겹쳐 놓아요(position 없음). 스크롤 연동을 아는 브라우저에서는 넘칠 것이 없으면 안 나오고 끝까지 내리면 사라져요 */
const SHAPES = {   // 스크롤 표시 모양(확정 하나)
  v: [14, 8, '<path d="M2.5 2.5L7 6L11.5 2.5" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'],
};
const scrollCss = (k, f, o = {}) => {
  const p = '.' + k, sc = f.sc || '.lg', hs = Object.keys(HEIGHTS), all = (suf = '') => hs.map((h) => `${p}.gh-${h} ${sc}${suf}`).join(',');
  const G = (suf, pre = '') => hs.map((h) => `${p}${pre}.gh-${h} ${suf}`).join(',');   // 높이 제한이 켜졌을 때만
  const mb = f.smMb || 0, kf = k.split('.')[0] + '-sm', tp = tabOf(f).always ? '' : '.gi-tab', [vw, vh] = SHAPES.v;
  return `
${all()}{overflow-x:clip;overflow-y:auto;scrollbar-width:none${f.scPad ? ';padding-bottom:' + f.scPad + 'px' : ''}${f.scMb ? ';padding-bottom:0;margin-bottom:' + f.scMb + 'px' : ''}${f.scTop ? ';padding-top:0;margin-top:' + f.scTop + 'px' : ''}${f.scR ? ';margin-right:-' + f.scR + 'px;padding-right:' + f.scR + 'px' : ''}}
${p} .sq0,${all('::-webkit-scrollbar')}{display:none;width:0;height:0}
${hs.map((h) => `${p}.gh-${h} ${sc}{max-height:${HEIGHTS[h]}px}`).join('\n')}${f.scExtra ? '\n' + hs.map((h) => `${p}.gh-${h} ${f.scExtra}`).join('\n') : ''}
${p} .sm{display:none}
${G('.z1 .zi')}{display:grid;grid-template-columns:minmax(0,1fr);timeline-scope:--gs}
${G('.z1 .zi>*')}{grid-area:1/1/2/2}
${all()}{scroll-timeline-name:--gs}
${G('.sm')}{display:block;align-self:end;justify-self:center;margin:0 0 ${mb - 4 - vh}px;pointer-events:none}
${mb < 4 + 10 ? G('.zw') + '{margin-bottom:12px}\n' : ''}${G('.z1', tp)}{margin-bottom:-12px}
${G('.z1>.zi', tp)}{padding-bottom:12px}
${p} .sy{display:block;${hw(vw, vh)};background-color:${INK.l.muted}}
${p}.tn-n .sy{background-color:${INK.d.muted}}
${mask1(p + ' .sy', vw, vh, SHAPES.v[2])}
@keyframes ${kf}{0%{opacity:1}94%{opacity:1}100%{opacity:0}}
@supports (animation-timeline:scroll()){
${G('.sm')}{opacity:0;animation:${kf} 1s linear 0s 1 both;animation-timeline:--gs}
}`;
};

/* ---------- 틀 열아홉 ----------
   lay(X): X = { t(글), f(칸), msgs, me(주 화자), lemon, body(흐르는 글), chips(정보 칩 — 표시 · 모델 · 프롬프트), chipsOf(키들), tail · info(선택 칸 HTML), open }
   w0 = 그 틀의 원래 폭(없으면 640) · sc = 높이 고르기(세로 스크롤)를 걸 칸 · bg = [글이 놓이는 바탕, 제목이 놓이는 바탕] (대비 검산용 'P' 틀 바탕 · 'W' 글 칸 색) */
const head = (X) => `<div class="hd">${X.lemon}${X.chips}</div>`;
const frames = [
  { no: 429, id: 'card', k: 'kb429', name: '카드', css: css429, tone: () => [], bg: 'WP', add: '장치 없음 — 비례 · 여백 · 톤만',
    lay: (X) => `${head(X)}\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 430, id: 'tab', k: 'kb430', name: '탭', css: css430, tone: () => [], tab: { always: true }, bg: 'WP', add: '탭 줄을 누르면 「글」 ↔ 「정보」가 넘어가요',
    lay: (X) => `${head(X)}\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 431, id: 'window', k: 'kb431', scMb: 28, smMb: 28, scTop: 16, tab: { at: 'lw', mt: 0, well: false, pp: 'padding:16px 20px 18px;' }, name: '창', pad: '0', chipOn: 'well', css: css431, tone: tone431, bg: 'PW', add: '단추 셋을 누르면 창이 제목줄로 말려 올라가요',
    lay: (X) => `<div class="wb">${X.lemon}${titleBlock(X.t.title)}<details class="kx"${X.open}><summary class="wd" aria-label="창 접기"><span class="dg">${sp('o o1')}${sp('o o2')}${sp('o o3')}</span></summary></details></div>\n<div class="sl"><div class="lw">${X.strip}${X.swap(`<div class="lg">\n${X.body}\n</div>`)}\n<div class="sb">${X.chips}</div></div></div>` },
  { no: 432, id: 'status', k: 'kb432', tab: { mt: 12 }, name: '상태창', css: css432, tone: () => [], bg: 'WP', add: '계기판 한 띠 — 메시지 칸은 화자 색 점 계기',
    lay: (X) => {
      const dots = X.msgs.slice(0, 10).map((m) => '<span class="g o' + m.who + '"></span>').join('');
      const cells = [['모델', X.f.model], ['프롬프트', X.f.prompt], ['메시지', X.msgs.length + '<span class="gd">' + dots + '</span>'], ['날짜', X.f.dateShort || X.f.date]].filter((c) => c[1]);
      const panel = `<div class="ip s${X.me}">\n` + cells.map(([l, v]) => `<div class="ic"><p class="kl n${X.me}">${l}</p><p class="kv">${v}</p></div>`).join('\n') + '\n</div>';
      return `<div class="hd">${X.lemon}${X.chipsOf(['mark'])}</div>\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${panel}\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}`;
    } },
  { no: 433, id: 'mini', k: 'kb433', scR: 8, tab: { mt: 12, well: false }, name: '미니', w0: 520, pad: '12px 16px 14px', css: css433, tone: () => [], add: '장치 없음 — 머리 한 줄 + 글',
    lay: (X) => `<div class="hd">${X.lemon}${titleBlock(X.t.title)}${X.chips}</div>\n<span class="ul u${X.me}"></span>\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 434, id: 'lemon', k: 'kb434', name: '레몬', css: css434, tone: () => [], bg: 'WP', add: '장치 없음 — 레몬 로고와 포인트 막대는 그대로',
    lay: (X) => `<div class="pr"><span class="pb"></span>${X.chips}</div>\n<div class="hd">${X.lemon}${titleBlock(X.t.title)}</div>\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 435, id: 'messenger', k: 'kb435', scPad: 10, tab: { mt: 18, well: false }, name: '메신저', w0: 400, rad0: 20, css: css435, spk: spk435, tone: () => [], add: '말풍선을 누르면 확인 표시가 톡',
    lay: (X) => {
      const rows = X.msgs.map((m, i) => { const me = m.who !== X.me ? ' me' : '', same = i && X.msgs[i - 1].who === m.who && !m.nr;
        return nr(m) + (same ? '' : nm(m, me)) + `<div class="dl${me}"><details class="rx"><summary class="bb b${m.who}" aria-label="확인 표시"><span class="bt">${m.dl}</span><span class="ht o${m.who}"><span class="hh"></span></span></summary></details></div>`; }).join('\n');
      return `<div class="hd"><span class="av s${X.me}">${initial(X.t.title)}</span><div class="hs">${titleBlock(X.t.title)}${X.chips}</div>${X.lemon}</div>\n${X.swap(`<div class="lg">\n${rows}\n</div>`)}`;
    } },
  { no: 436, id: 'notify', k: 'kb436', tab: { mt: 8, pp: 'padding:12px 14px;border-radius:12px;' }, name: '알림', w0: 400, pad: '16px 20px 0', card: WELL.l, cardN: WELL.d, chipOn: 'well', sc: '.nq', scExtra: '.nq>.nc:first-child{margin-top:0}', smMb: 40, css: css436, tone: tone436, bg: 'PW', add: '쌓인 알림을 누르면 아래로 펼쳐져요',
    lay: (X) => {
      const cardOf = (m, i) => `<div class="nc"><p class="nh"><span class="av s${m.who}">${initial(m.name)}</span><span class="nn n${m.who}">${m.name}</span><span class="tm">${clock(i)}</span></p>\n${nr(m)}${dl(m)}</div>`;
      const first = cardOf(X.msgs[0], 0), rest = X.msgs.slice(1).map((m, i) => cardOf(m, i + 1)).join('\n');
      const stack = rest ? `\n<div class="sl"><div class="lw"><div class="lq">\n${rest}\n</div></div></div>\n</div>\n<details class="kx"${X.open}><summary class="st" aria-label="알림 펼치기">${sp('s1')}${sp('s2')}${sp('gr')}</summary></details>` : '\n</div><div class="st"></div>';
      return `${head(X)}\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${X.swap(`<div class="nl">\n<div class="nq">\n${first}${stack}\n</div>`)}`;
    } },
  { no: 437, id: 'script', k: 'kb437', scR: 8, tab: { mt: 20, well: false, pp: 'padding-left:88px;' }, name: '대본', css: css437, tone: () => [], add: '장치 없음 — 이름 칸 | 대사 칸 조판',
    lay: (X) => `<div class="hd">${X.lemon}</div>\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>${X.chips}\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 438, id: 'record', k: 'kb438', scR: 8, tab: { mt: 18, well: false }, name: '기록', css: css438, tone: tone438, add: '장치 없음 — 시각 칸 옆 타임라인(화자 색 점)',
    lay: (X) => {
      const rows = X.msgs.map((m, i) => `<div class="rw"><span class="tm">${clock(i)}</span>${sp('rl')}${sp('dt o' + m.who)}<div class="rc">\n${nm(m)}${nr(m)}${dl(m)}\n</div></div>`).join('\n');
      return `${head(X)}\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${X.swap(`<div class="lg">\n${rows}\n</div>`)}`;
    } },
  { no: 439, id: 'note', k: 'kb439', scR: 8, tab: { mt: 18, well: false, pp: 'padding-left:22px;' }, name: '노트', card: WELL.l, cardN: WELL.d, chipOn: 'well', css: css439, tone: tone439, bg: 'WW', add: '장치 없음 — 종이 한 톤 · 겹 여백 선',
    lay: (X) => `${head(X)}\n<p class="sb">${X.f.date}</p>\n${titleBlock(X.t.title)}\n${X.swap(`<div class="nb">${sp('m1')}${sp('m2')}<div class="lg">\n${X.body}\n</div></div>`)}` },
  { no: 440, id: 'letter', k: 'kb440', scR: 8, tab: { mt: 20, well: false }, name: '편지', w0: 480, pad: '20px 24px', css: css440, tone: tone440, add: '장치 없음 — To. / From. 조판 + 우표 한 장',
    lay: (X) => `<div class="hd">${X.lemon}<span class="pt"><span class="pv">${sp('pc')}${sp('ph')}</span></span></div>\n<p class="to"><span class="tk">To.</span> ${X.f.to || X.t.name1}</p>\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}\n<div class="sg">${X.chips}<div class="sr"><p class="fr"><span class="tk">From.</span> ${X.f.from || X.t.name2}</p><p class="dt">${X.f.date}</p></div></div>` },
  { no: 441, id: 'diary', k: 'kb441', scR: 8, tab: { mt: 18, well: false }, name: '일기', css: css441, tone: tone441, add: '도장을 누르면 「참 잘했어요」가 꾹',
    lay: (X) => `${head(X)}\n${titleBlock(X.f.date)}\n<p class="sb">${X.t.title}</p><span class="ul u${X.me}"></span>\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}\n<div class="fz"><details class="kx"${X.open}><summary class="sz" aria-label="도장 찍기">${stampHtml(X.f)}</summary></details></div>` },
  { no: 442, id: 'article', k: 'kb442', scR: 8, tab: { mt: 16, well: false }, name: '기사', css: css442, tone: () => [], add: '장치 없음 — 큰 명조 제목 · 겹줄 · 첫 글자',
    lay: (X) => {
      let body = X.body; const m0 = X.msgs[0];
      if (m0 && m0.nr) { const ch = [...m0.nr][0]; body = body.replace('<p class="nr">' + m0.nr, '<p class="nr"><span class="dc">' + ch + '</span>' + [...m0.nr].slice(1).join('')); }
      return `<div class="hd">${X.lemon}${X.chipsOf(['mark'])}</div>\n${titleBlock(X.t.title)}\n<p class="by">${X.f.date}<span class="bx">${(X.f.model ? ' · <span class="gv-model">' + X.f.model + '</span>' : '') + (X.f.prompt ? ' · <span class="gv-prompt">' + X.f.prompt + '</span>' : '')}</span></p>\n<span class="r1"></span><span class="r2 u${X.me}"></span>\n${X.swap(`<div class="lg">\n${body}\n</div>`)}`;
    } },
  { no: 443, id: 'book', k: 'kb443', scR: 8, tab: { mt: 22, well: false, pp: 'padding:0 28px;' }, name: '책', w0: 520, pad: '16px 20px 20px', css: css443, tone: tone443, add: '가름끈을 누르면 주르륵 내려와요',
    lay: (X) => `<div class="hd">${X.lemon}<p class="rh">${X.t.title}</p><details class="kx"${X.open}><summary class="rb" aria-label="가름끈 당기기"><span class="rw"><span class="rr"></span></span></summary></details></div>\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}\n<p class="pn">— ${X.f.page} —</p>${X.chips}` },
  { no: 444, id: 'gallery-strip', k: 'kb444', name: '가로 넘김', css: css444, tone: toneGal, bg: 'WP', add: '사진 띠 — 폰은 손가락, PC 는 휠로 넘겨요',
    lay: (X) => `${head(X)}\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${stripHtml(X.f.photos, false)}\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 445, id: 'gallery-strip-polaroid', k: 'kb445', scR: 8, tab: { well: false }, name: '가로 폴라로이드', css: css445, tone: toneGal, add: '흰 사진 카드 띠 — 사진 이름이 아래에',
    lay: (X) => `${head(X)}\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${stripHtml(X.f.photos, true)}\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 446, id: 'gallery-grid', k: 'kb446', name: '격자', css: css446, tone: toneGal, bg: 'WP', add: '3열 격자 — 첫 장이 대표 사진(2×2)',
    lay: (X) => `${head(X)}\n${titleBlock(X.t.title)}<span class="ul u${X.me}"></span>\n${gridHtml(X.f.photos, false)}\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
  { no: 447, id: 'gallery-grid-polaroid', k: 'kb447', tab: { mt: 20 }, name: '격자 폴라로이드', card: WELL.l, cardN: WELL.d, chipOn: 'well', css: css447, tone: toneGal, bg: 'PW', add: '사진 기록장 — 흰 사진 카드가 번갈아 살짝 기울어요',
    lay: (X) => `${head(X)}\n${titleBlock(X.t.title)}\n<p class="sb">${X.f.subtitle}</p>\n<p class="dt">${X.f.date}</p>\n${gridHtml(X.f.photos, true)}\n${X.swap(`<div class="lg">\n${X.body}\n</div>`)}` },
];
const byNo = (no) => { const f = frames.find((x) => x.no === +no || x.id === no); if (!f) throw new Error('없는 틀: ' + no); return f; };
const LATER = [];   // 11-11 b: 방향만 잡았던 일곱(432 · 439 · 440 · 444~447)도 시안이 됐어요
const NEW7 = [432, 439, 440, 444, 445, 446, 447];

/* ---------- 고르는 판(틀 뿌리에 클래스가 하나 더 붙고, 그 판의 <style> 은 그 클래스까지 적어요 — 한 글에 기본 판과 같이 넣어도 안 부딪혀요) ----------
   opt.width   640 = 원래 폭이 좁은 틀(메신저 · 알림 400 / 미니 · 책 520 / 편지 480)을 640 으로(클래스 vw). 빼면 그 틀의 원래 폭
   opt.height  's' 280 · 'm' 420 · 'l' 600 = 글 칸 높이를 묶고 안쪽만 세로로 넘겨요(클래스 vhs · vhm · vhl · 스크롤바 숨김). 빼면 글 길이만큼
   opt.palette 'aide' = 에이드 팔레트 판(블루 레몬에이드 화이트 / 블루 아워 — 틀 · 글 칸 · 글자색이 팔레트 값, 화자 색 대신 팔레트 포인트색 하나 · 클래스 vp). 빼면 화자 대사색 판
   opt.cols    true = 442 기사 두 단(클래스 vc)
   opt.chips   'line' = 정보 칩을 「흐린 글자 한 줄」로(HTML 만 달라요 · 클래스 없음). 빼면 「꼬리표 칩」 */
const HEIGHTS = { s: 280, m: 420, l: 600 };
const AIDE = { point: '#398EE8', map: [['#ffffff', '#FDFEFF'], ['#f5f5f6', '#E5F1FF'], ['#25272b', '#1C293B'], ['#1c1e21', '#141F2E'], ['#26272b', '#222D3A'], ['#111113', '#16202B'], ['#1b1c20', '#222D3A'], ['#5f6168', '#4F627A'], ['#e1e1e5', '#DBE2EB'], ['#f5f5f7', '#EEF3F9'], ['#f0f0f3', '#E6ECF3'], ['#9a9da6', '#ABBACE'], ['#e7e8eb', '#D3E4F8'], ['#dbdce0', '#C2D8F2'], ['#17181b', '#0F1824'], ['#111214', '#0B121C']] };
function variantOf(f, opt) {
  const v = [];
  if (opt.width === 640 && f.w0) v.push('vw');
  if (opt.palette === 'aide') v.push('vp');
  if (opt.cols && f.no === 442) v.push('vc');
  return v;
}

/* ---------- 새 시안 틀 하나 ----------
   opt.night   true = 밤 판 · opt.long true = 긴 견본(메시지 12개) · opt.msgs 직접 넣기 [{ who:'A'|'B', name, nr, dl }]
   opt.text    { title, n1, d1, n2, d2, name1, name2 } 중 바꿀 것만 · opt.colors { A, B } 화자 색(빼면 견본 파랑 · 분홍)
   opt.fields  { mark, model, prompt, date, page, stamp, from, to, subtitle, photos } 중 바꿀 것만(mark · model · prompt 를 '' 로 주면 그 칩 · 줄이 빠져요)
   opt.info    'chip' = 알약 칩 「LOG」 · 모델 · 프롬프트 / 'tab' = 「글」 · 「정보」 탭 / 빼면 끔(기본) — 뿌리 class gi-chip · gi-tab
   opt.height  's' 280 · 'm' 420 · 'l' 600 = 글 칸 높이를 묶고 안쪽만 세로로 넘겨요(뿌리 class gh-s · gh-m · gh-l). 빼면 글 길이만큼
   opt.fill    (옛 이름) 값이 있으면 opt.info 'chip' 과 같아요(430 탭은 'tab') — 꼬리 문구 · 추가 정보 칸은 11-11 에 없앴어요
   opt.open    true 면 details 를 연 채로(431 접힌 창 · 436 펼친 알림 · 441 찍힌 도장 · 443 내린 끈) */
function frameStyle(no, opt = {}) {
  const f = byNo(no), aide = opt.palette === 'aide';
  const S = aide ? { A: speaker(AIDE.point), B: speaker(AIDE.point) } : { A: speaker((opt.colors && opt.colors.A) || KA), B: speaker((opt.colors && opt.colors.B) || KB) };
  if (!aide) for (const [x, c] of Object.entries(opt.extra || {})) if (!S[x]) S[x] = speaker(c);   // 테마: 셋째 화자부터
  const cv = opt.cv || (aide ? 'ad' : S.A.k === KA ? 'bl' : S.A.k === KB ? 'pk' : 'c' + S.A.k.slice(1));
  const v = variantOf(f, opt), k = [f.k].concat(v).join('.');
  const o = Object.assign({}, f, { maxw: v.includes('vw') ? 640 : (f.w0 || 640), rad: v.includes('vw') ? 12 : (f.rad0 || 12), cols: v.includes('vc') });
  let one = baseCss(k, o) + f.css(k, o) + infoCss(k, f, o) + scrollCss(k, f, o) + RM(k), two = speakerCss(k, S) + (f.spk ? f.spk(k, S) : ''), three = toneCss(k, cv, f.tone(S, 'A').concat(tabRows(f, S.A)));
  if (aide) { const sw = (s) => AIDE.map.reduce((a, [x, y]) => a.split(x).join(y), s); one = sw(one); two = sw(two); three = sw(three); }
  return { k: f.k, cls: [f.k].concat(v).join(' '), cv, S, css: one + '\n\n' + two.trimStart() + (three ? '\n\n' + three.trimStart() : '') + '\n', parts: { one, two, three } };
}
const GV = { mark: 'gv-log', model: 'gv-model', prompt: 'gv-prompt' };
function buildFrame(no, opt = {}) {
  const f = byNo(no), night = !!opt.night, t = Object.assign({}, TEXT, opt.text || {}), fl = Object.assign({}, FIELDS, opt.fields || {});
  const mode = opt.info === 'chip' || opt.info === 'tab' ? opt.info : opt.info === 'off' ? '' : opt.fill ? (f.id === 'tab' ? 'tab' : 'chip') : '';
  const msgs = opt.msgs || (opt.long ? longMsgs(t) : baseMsgs(t)), st = frameStyle(no, opt);
  const chipsOf = (keys) => { const list = keys.filter((key) => fl[key]); if (!list.length) return '';
    return opt.chips === 'line' ? '<p class="mt">' + list.map((key) => (key === 'mark' ? '<b class="' + GV[key] + '">' + fl[key] + '</b>' : '<span class="' + GV[key] + '">' + fl[key] + '</span>')).join(' · ') + '</p>'
      : '<p class="cp">' + list.map((key) => '<span class="c' + (key === 'mark' ? ' sA' : '') + ' ' + GV[key] + '">' + fl[key] + '</span>').join('') + '</p>'; };
  const rows = (fl.model ? '<p class="ir"><span class="ik">모델</span><span class="gv-model">' + fl.model + '</span></p>\n' : '') + (fl.prompt ? '<p class="ir"><span class="ik">프롬프트</span><span class="gv-prompt">' + fl.prompt + '</span></p>\n' : '');
  const strip = '<details class="tx"><summary class="tq" aria-label="정보 칸 탭"><span class="tv t1 gv-tab-log">' + (fl.tabLog || 'LOG') + '</span><span class="tv t2 gv-tab-info">' + (fl.tabInfo || '프롬프트') + '</span></summary></details>\n';
  const X = {
    t, f: fl, msgs, me: 'A', lemon: lemon(), body: f.id === 'script' ? msgs.map((m) => nr(m) + nm(m) + dl(m)).join('\n') : flow(msgs), open: opt.open ? ' open' : '',
    chips: chipsOf(['mark', 'model', 'prompt']), chipsOf, strip,
    swap: (html) => '<div class="zw"><div class="zs z2"><div class="zi"><div class="zp">\n' + rows + '</div></div></div><div class="zs z1"><div class="zi">' + html + '<span class="sm"><span class="sy"></span></span></div></div></div>',
  };
  const gh = HEIGHTS[opt.height] ? ' gh-' + opt.height : '';
  return '<div class="gk ' + (night ? 'td tn-n' : 'tl tn-d') + ' ' + st.cls + ' cv-' + st.cv + (mode ? ' gi-' + mode : '') + gh + '"><style>' + st.css + '</style>\n' + (tabOf(f).at === 'lw' ? '' : strip) + f.lay(X) + '\n</div>';
}

export { frames, buildFrame, frameStyle, HEIGHTS, speaker, tones, fit, KA, KB, FIELDS, TEXT, LEMON_D, LEMON_HOME };
