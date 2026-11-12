// 생성물 — 글꾸 마트 mart/lib/texture/tex.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
const enc = (svg) => "url('data:image/svg+xml," + String(svg).replace(/\s*\n\s*/g, " ").replace(/>\s+</g, "><").trim().replace(/[%#<>"'()&;{}\\]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")) + "')";
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const r3 = (n) => String(Math.round(n * 1e3) / 1e3).replace(/^0\./, ".");
const f1 = (n) => String(Math.round(n * 10) / 10);
const rng = (seed) => {
  let s = seed;
  return () => (s = s * 16807 % 2147483647) / 2147483647;
};
const INK = { d: "#000", n: "#fff" };
const PITCH = 20;
const patSvg = (inner) => `<svg ${NS} width="100%" height="100%"><pattern id="p" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse">${inner}</pattern><rect width="100%" height="100%" fill="url(#p)"/></svg>`;
const vLines = (ink, a) => enc(patSvg(`<rect x="${PITCH / 2}" width="1" height="${PITCH}" fill="${ink}" fill-opacity="${r3(a)}"/>`));
const hLines = (ink, a) => enc(patSvg(`<rect y="${PITCH / 2}" width="${PITCH}" height="1" fill="${ink}" fill-opacity="${r3(a)}"/>`));
const dots = (ink, a) => enc(patSvg(`<circle cx="${PITCH / 2}" cy="${PITCH / 2}" r="1.1" fill="${ink}" fill-opacity="${r3(a)}"/>`));
const L_V = (img) => ({ img, size: "calc(100% - 20px) 100%", pos: "50% 0", rep: "no-repeat" });
const L_H = (img) => ({ img, size: "100% calc(100% - 20px)", pos: "0 50%", rep: "no-repeat" });
const L_D = (img) => ({ img, size: "calc(100% - 16px) calc(100% - 16px)", pos: "50% 50%", rep: "no-repeat" });
const noise = (o) => `<filter id="${o.id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${o.f}" numOctaves="${o.oct || 2}" seed="${o.seed || 3}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${o.rgb[0]} 0 0 0 0 ${o.rgb[1]} 0 0 0 0 ${o.rgb[2]} ${o.k} 0 0 0 ${o.b}"/></filter><rect width="100%" height="100%" filter="url(#${o.id})" opacity="${r3(o.a)}"/>`;
const tile = (size, inner) => ({ img: enc(`<svg ${NS} width="${size}" height="${size}">${inner}</svg>`), size: size + "px " + size + "px", pos: "0 0", rep: "repeat" });
const rgb = (hex) => {
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex;
  return [1, 3, 5].map((i) => r3(parseInt(h.slice(i, i + 2), 16) / 255));
};
function specks(size, n, ink, a, seed) {
  const R = rng(seed), g = [[], [], []];
  for (let i = 0; i < n; i++) g[i % 3].push("M" + Math.floor(R() * size) + " " + (Math.floor(R() * size) + 0.5) + "h" + (R() < 0.18 ? 2 : 1));
  return g.map((p, i) => `<path d="${p.join("")}" stroke="${ink}" stroke-opacity="${r3(a * [1, 0.62, 0.34][i])}"/>`).join("");
}
function fibers(size, n, ink, a, seed) {
  const R = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = R() * size, y = R() * size, ang = R() * Math.PI, len = 10 + R() * 26, bend = (R() - 0.5) * 10, w = 0.5 + R() * 0.5;
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len, mx = x + dx / 2 - Math.sin(ang) * bend, my = y + dy / 2 + Math.cos(ang) * bend;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      const x0 = x + ox, y0 = y + oy, x1 = x0 + dx, y1 = y0 + dy;
      if (Math.max(x0, x1) < -6 || Math.min(x0, x1) > size + 6 || Math.max(y0, y1) < -6 || Math.min(y0, y1) > size + 6) continue;
      out.push(`<path d="M${f1(x0)} ${f1(y0)}Q${f1(mx + ox)} ${f1(my + oy)} ${f1(x1)} ${f1(y1)}" stroke-width="${f1(w)}"/>`);
    }
  }
  return `<g fill="none" stroke="${ink}" stroke-opacity="${r3(a)}" stroke-linecap="round">${out.join("")}</g>`;
}
function threads(size, n, ink, a, seed, dir, lenMin, lenMax, w) {
  const R = rng(seed), g = [[], []];
  for (let i = 0; i < n; i++) {
    const p = Math.floor(R() * size) + 0.5, q = Math.floor(R() * size), len = Math.round(lenMin + R() * (lenMax - lenMin));
    for (const o of [0, -size]) {
      if (q + o + len < 0) continue;
      g[i % 2].push(dir === "h" ? "M" + (q + o) + " " + p + "h" + len : "M" + p + " " + (q + o) + "v" + len);
    }
  }
  return g.map((p, i) => `<path d="${p.join("")}" stroke="${ink}" stroke-width="${w}" stroke-opacity="${r3(a * [1, 0.55][i])}" stroke-linecap="round"/>`).join("");
}
function blobs(size, n, col, a, seed) {
  const R = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = R() * size, y = R() * size, rx = 40 + R() * 70, ry = 30 + R() * 50, o = 0.45 + R() * 0.55;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      if (x + ox + rx < 0 || x + ox - rx > size || y + oy + ry < 0 || y + oy - ry > size) continue;
      out.push(`<ellipse cx="${Math.round(x + ox)}" cy="${Math.round(y + oy)}" rx="${Math.round(rx)}" ry="${Math.round(ry)}" opacity="${r3(o)}"/>`);
    }
  }
  return `<radialGradient id="g"><stop offset="0" stop-color="${col}" stop-opacity="${r3(a)}"/><stop offset=".55" stop-color="${col}" stop-opacity="${r3(a * 0.55)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><g fill="url(#g)">${out.join("")}</g>`;
}
const AGED = { d: ["#8a5a1e", "#5a3c14"], n: ["#ffd9a0", "#ffe9c4"] };
const TEX = {
  grid: {
    name: "모눈종이",
    kind: "geo",
    a: { d: [0.045, 0.07, 0.105], n: [0.04, 0.06, 0.09] },
    layers: (t, a) => [L_V(vLines(INK[t], a)), L_H(hLines(INK[t], a))]
  },
  line: {
    name: "줄 노트",
    kind: "geo",
    a: { d: [0.06, 0.09, 0.13], n: [0.05, 0.075, 0.11] },
    layers: (t, a, o) => (o.margin ? [{ img: "linear-gradient(" + [0, 0].map(() => (t === "d" ? "rgba(214,72,72," : "rgba(255,128,128,") + r3(a * 4.2) + ")").join(",") + ")", size: "1px 100%", pos: "10px 0", rep: "no-repeat" }] : []).concat([L_H(hLines(INK[t], a))])
  },
  dot: {
    name: "점 노트",
    kind: "geo",
    a: { d: [0.13, 0.2, 0.29], n: [0.11, 0.17, 0.25] },
    layers: (t, a) => [L_D(dots(INK[t], a))]
  },
  rough: {
    name: "거친 종이",
    kind: "grain",
    a: { d: [0.4, 0.62, 0.88], n: [0.45, 0.7, 1] },
    layers: (t, a) => [tile(160, noise({ id: "a", f: ".85", oct: 3, seed: 7, rgb: rgb(INK[t]), k: t === "d" ? 0.55 : 0.42, b: t === "d" ? -0.2 : -0.15, a }))],
    alt: (t, a) => [tile(120, specks(120, 340, INK[t], (t === "d" ? 0.34 : 0.26) * a, 7))]
  },
  hanji: {
    name: "한지",
    kind: "grain",
    a: { d: [0.5, 0.75, 1], n: [0.5, 0.75, 1] },
    layers: (t, a) => [tile(240, fibers(240, 34, INK[t], (t === "d" ? 0.16 : 0.15) * a, 11) + noise({ id: "a", f: ".5", oct: 2, seed: 4, rgb: rgb(INK[t]), k: 0.34, b: -0.13, a }))],
    alt: (t, a) => [tile(240, fibers(240, 34, INK[t], (t === "d" ? 0.16 : 0.15) * a, 11) + specks(240, 170, INK[t], (t === "d" ? 0.2 : 0.16) * a, 4))]
  },
  canvas: {
    name: "캔버스 천",
    kind: "grain",
    a: { d: [0.2, 0.31, 0.46], n: [0.17, 0.27, 0.4] },
    layers: (t, a) => [tile(180, noise({ id: "a", f: ".03 .85", oct: 2, seed: 2, rgb: rgb(INK[t]), k: 0.62, b: -0.25, a }) + noise({ id: "b", f: ".85 .03", oct: 2, seed: 9, rgb: rgb(INK[t]), k: 0.62, b: -0.25, a }))],
    alt: (t, a) => [tile(140, threads(140, 150, INK[t], 0.35 * a, 2, "h", 14, 60, 0.7) + threads(140, 150, INK[t], 0.35 * a, 9, "v", 14, 60, 0.7))]
  },
  aged: {
    name: "오래된 종이",
    kind: "grain",
    a: { d: [0.5, 0.75, 1], n: [0.5, 0.75, 1] },
    layers: (t, a) => [tile(420, noise({ id: "a", f: ".011", oct: 4, seed: 5, rgb: rgb(AGED[t][0]), k: t === "d" ? 1.2 : 1, b: t === "d" ? -0.56 : -0.47, a: a * (t === "d" ? 0.34 : 0.26) }) + noise({ id: "b", f: ".8", oct: 2, seed: 12, rgb: rgb(AGED[t][1]), k: 0.4, b: -0.16, a: a * 0.8 }))],
    alt: (t, a) => [tile(420, blobs(420, 9, AGED[t][0], (t === "d" ? 0.17 : 0.1) * a, 5) + specks(420, 300, AGED[t][1], (t === "d" ? 0.3 : 0.22) * a, 12))]
  },
  chalk: {
    name: "칠판",
    kind: "grain",
    a: { d: [0.22, 0.34, 0.5], n: [0.34, 0.52, 0.75] },
    layers: (t, a) => [tile(360, noise({ id: "a", f: ".004 .2", oct: 3, seed: 8, rgb: rgb(INK[t]), k: t === "d" ? 0.5 : 0.46, b: t === "d" ? -0.2 : -0.18, a }) + noise({ id: "b", f: ".9", oct: 2, seed: 21, rgb: rgb(INK[t]), k: 0.5, b: -0.21, a }))],
    alt: (t, a) => [tile(300, threads(300, 60, INK[t], 0.2 * a, 8, "h", 70, 240, 1.6) + threads(300, 80, INK[t], 0.17 * a, 5, "h", 30, 130, 0.8) + specks(300, 170, INK[t], 0.26 * a, 21))]
  }
};
const ORDER = ["grid", "line", "dot", "rough", "hanji", "canvas", "aged", "chalk"];
const NO_TEX = {
  k279: "X 타래(화면 꼴)",
  kt363: "X 타래 · 빈 타래(화면 꼴)",
  kt364: "X 타래 · 줄에 건 쪽지와 타래 꼴 글(화면 꼴)",
  k281: "디스코드(화면 꼴)",
  k283: "배달앱 리뷰(화면 꼴)",
  k286: "통화 기록(화면 꼴)",
  kt362: "통화 기록 · 접힌 통화 목록(화면 꼴)",
  k288: "블로그 글(화면 꼴)",
  kt361: "블로그 글 · 노트북과 블로그 꼴 글(화면 꼴)",
  k302: "미니홈피(화면 꼴)",
  kt365: "미니홈피 · 다이어리 탭(화면 꼴)",
  kt366: "미니홈피 · 미니룸과 방명록(화면 꼴)",
  kt371: "인스타 DM(화면 꼴)",
  kt372: "인스타 피드(화면 꼴)",
  kt373: "인스타 스토리(화면 꼴)",
  k104: "경찰 분실물 접수(글 칸에 제 바탕 그림이 있음)"
};
const SKIP = /^(gk|tl|td|tn-[dn]|cv-.*|sk-.*|st-.*|tx-.*|gk-.*|bg-.*)$/;
function info(html) {
  const m = String(html).match(/^(\s*<div class=")([^"]*)(">)/);
  if (!m || !/(^| )gk( |$)/.test(m[2])) return { blocked: true, why: "글꾸 틀이 아님" };
  const cls = m[2].split(/\s+/), end = html.indexOf("</style>");
  if (end < 0) return { blocked: true, why: "style 없음" };
  const head = html.slice(0, end), first = (head.match(/<style>\s*\.([A-Za-z0-9_-]+)\{/) || [])[1];
  const key = first && cls.includes(first) ? first : cls.find((c) => !SKIP.test(c));
  if (!key) return { blocked: true, why: "틀 class 없음" };
  const esc = key.replace(/[-]/g, "\\-");
  const rule = (sel) => [...head.matchAll(new RegExp("(?:^|[\\n,}])\\s*" + sel + "\\{([^}]*)\\}", "g"))].map((x) => x[1]).join(";");
  const col = (t) => (t.match(/background-color:([^;}]+)/g) || []).map((x) => x.slice(17)).pop();
  const root = rule("\\." + esc), lg = rule("\\." + esc + " \\.lg");
  const tone = cls.includes("tn-n") ? "n" : "d", pane = !!col(lg);
  const base = { c: { d: col(root), n: col(rule("\\." + esc + "\\.tn-n")) || col(root) }, b: { d: col(lg), n: col(rule("\\." + esc + "\\.tn-n \\.lg")) || col(lg) } };
  const speak = [...head.matchAll(new RegExp("\\." + esc + " \\.(d[A-Z])\\{background-color:([^;}]+)", "g"))].map((x) => [x[1], x[2]]);
  let why = NO_TEX[key] || "";
  if (!why && !col(root)) why = "뿌리 바탕색이 없는 틀(화면 꼴)";
  if (!why && /background(-image)?:[^;}]*(url\(|gradient)/.test(root + ";" + lg)) why = "얹을 면에 이미 바탕 그림이 있음";
  return { key, cls, pane, tone, base, speak, hasSound: /class="sd"/.test(html), blocked: !!why, why, m, end };
}
const decl = (ls) => "background-image:" + ls.map((l) => l.img).join(",") + ";background-size:" + ls.map((l) => l.size).join(",") + ";background-position:" + ls.map((l) => l.pos).join(",") + ";background-repeat:" + ls.map((l) => l.rep).join(",");
function css(i, o) {
  const T = TEX[o.tex];
  if (!T) return "";
  const on = o.on === "c" ? "c" : "b", lv = [1, 2, 3].includes(o.level) ? o.level : 2, tileMode = T.kind === "grain" && o.grain === "tile";
  const rows = [];
  for (const t of o.tones || [i.tone]) {
    const root = "." + i.key + ".tx-" + o.tex + ".tx-on-" + on + (lv === 2 ? "" : ".tx-" + lv) + (tileMode ? ".tx-t" : "") + ".tn-" + t;
    const tgt = !i.pane ? root : on === "c" ? root + "," + root + " .lg" : root + " .lg";
    rows.push(tgt + "{" + decl((tileMode ? T.alt : T.layers)(t, T.a[t][lv - 1], o)) + "}");
    {
      const b = o.base && o.base[t] || (i.pane ? i.base.b[t] : i.base.c[t]);
      if (b) {
        for (const [c, tint] of i.speak) rows.push(root + " ." + c + "{background-image:linear-gradient(" + tint + "," + tint + "),linear-gradient(" + b + "," + b + ")}");
        if (i.hasSound) rows.push(root + " .sd{background-color:" + b + "}");
      }
    }
  }
  return rows.join("\n");
}
const stripCls = (c) => c.filter((x) => !/^tx-/.test(x));
function strip(html) {
  const i = info(html);
  if (!i.m) return html;
  const head = html.slice(i.m[0].length, i.end).split("\n").filter((l) => !new RegExp("^\\." + i.key.replace(/[-]/g, "\\-") + "\\.tx-").test(l)).join("\n");
  return i.m[1] + stripCls(i.cls).join(" ") + i.m[3] + head + html.slice(i.end);
}
function apply(html, o) {
  const clean = /(^|[ "])tx-/.test(String(html).slice(0, 300)) ? strip(html) : html;
  if (!o || !o.tex || o.tex === "none" || !TEX[o.tex]) return clean;
  const i = info(clean);
  if (i.blocked) return clean;
  const on = o.on === "c" ? "c" : "b", lv = [1, 2, 3].includes(o.level) ? o.level : 2;
  const add = ["tx-" + o.tex, "tx-on-" + on].concat(lv === 2 ? [] : ["tx-" + lv]).concat(o.margin && o.tex === "line" ? ["tx-mg"] : []).concat(TEX[o.tex].kind === "grain" && o.grain === "tile" ? ["tx-t"] : []);
  return i.m[1] + i.cls.concat(add).join(" ") + i.m[3] + clean.slice(i.m[0].length, i.end) + css(i, o) + "\n" + clean.slice(i.end);
}
export {
  NO_TEX,
  ORDER,
  TEX,
  apply,
  css,
  enc,
  info,
  strip
};
