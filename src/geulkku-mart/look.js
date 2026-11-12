// 생성물 — 글꾸 마트 mart/look.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { cleanShape } from "./shape.js";
const LOOK_KEY = "bl-mart-look-v1";
const PRESET_KEY = "bl-mart-preset-v1";
const HEX = /^#[0-9a-f]{6}$/i;
const FONT_STACKS = Object.freeze([
  Object.freeze({ id: "gothic", label: "고딕", family: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans CJK KR",sans-serif' }),
  Object.freeze({ id: "serif", label: "명조", family: '"AppleMyungjo","Batang","Noto Serif KR","Noto Serif CJK KR",serif' }),
  Object.freeze({ id: "gungsuh", label: "궁서", family: '"Gungsuh","GungSeo","AppleMyungjo","Batang",serif' }),
  Object.freeze({ id: "round", label: "굴림", family: '"Gulim","AppleGothic","Malgun Gothic",sans-serif' }),
  Object.freeze({ id: "hand", label: "손글씨", family: '"Nanum Pen Script","Nanum Brush Script","Apple SD Gothic Neo",cursive' }),
  Object.freeze({ id: "mono", label: "고정폭", family: '"D2Coding","Consolas","Menlo","Nanum Gothic Coding",monospace' })
]);
const stackOf = (id) => FONT_STACKS.find((x) => x.id === id) || null;
const LOOK_FIELDS = Object.freeze([
  { tab: "text", path: "fonts.text", label: "본문 글꼴", kind: "font" },
  { tab: "text", path: "type.size", label: "크기", kind: "range", min: 12, max: 22, step: 1, def: 16, unit: "px" },
  { tab: "text", path: "type.weight", label: "굵기", kind: "range", min: 300, max: 600, step: 1, def: 400 },
  { tab: "text", path: "type.letterSpacing", label: "자간", kind: "range", min: -5, max: 8, step: 1, def: -1, scale: 100, unit: "em" },
  { tab: "text", path: "type.lineHeight", label: "줄 간격", kind: "range", min: 1.4, max: 2.2, step: 0.01, def: 1.8 },
  { tab: "simple", path: "type.sizeStep", label: "글 크기", kind: "pick", options: [[-1, "작게"], [2, "크게"]] },
  { tab: "dialogue", path: "fonts.dialogue", label: "대사 글꼴", kind: "font" },
  { tab: "dialogue", path: "dialogue.style", label: "표시", kind: "pick", options: [["marker", "형광펜"], ["full", "전체 칠"], ["bold", "굵게"], ["plain", "없음"]] },
  { tab: "dialogue", path: "dialogue.markerShape", label: "형광펜 모양", kind: "pick", options: [["stroke", "펜 자국"], ["rectangle", "직사각형"], ["pill", "알약"]], when: "marker" },
  { tab: "dialogue", path: "dialogue.tilt", label: "형광펜 기울기", kind: "pick", options: [["flat", "일직선"], ["slant", "대각선"], ["steep", "완전 대각선"]], when: "pen" },
  { tab: "dialogue", path: "dialogue.markerPos", label: "형광펜 위치", kind: "pick", options: [["center", "가운데"], ["bottom", "아래"]], when: "marker" },
  { tab: "dialogue", path: "dialogue.markerThick", label: "형광펜 굵기", kind: "range", min: 10, max: 100, step: 1, def: 54, unit: "%", when: "marker" },
  { tab: "dialogue", path: "type.dialogueSize", label: "크기", kind: "range", min: 12, max: 24, step: 1, def: 16, unit: "px" },
  { tab: "dialogue", path: "dialogue.weight", label: "굵기", kind: "range", min: 300, max: 800, step: 1, def: 400 },
  { tab: "dialogue", path: "dialogue.letterSpacing", label: "자간", kind: "range", min: -10, max: 20, step: 1, def: 0, scale: 100, unit: "em" },
  { tab: "dialogue", path: "dialogue.lineHeight", label: "대사 줄 간격", kind: "range", min: 1.4, max: 2.2, step: 0.01, def: 1.8 },
  { tab: "dialogue", path: "dialogue.indent", label: "대사 들여쓰기", kind: "pick", options: [[true, "켬"], [false, "끔"]] },
  { tab: "em", path: "em.italic", label: "기울여 쓰기", kind: "pick", options: [[true, "켬"], [false, "끔"]] },
  { tab: "em", path: "em.color", label: "글자 색", kind: "color", def: "#6b4fa0" },
  { tab: "em", path: "em.size", label: "크기", kind: "range", min: 12, max: 24, step: 1, def: 16, unit: "px" },
  { tab: "em", path: "em.weight", label: "굵기", kind: "range", min: 300, max: 700, step: 1, def: 400 },
  { tab: "em", path: "em.letterSpacing", label: "자간", kind: "range", min: -10, max: 20, step: 1, def: 0, scale: 100, unit: "em" },
  { tab: "strike", path: "strike.line", label: "선", kind: "pick", options: [["text", "글자 색"], ["own", "직접 색"], ["none", "없음"]] },
  { tab: "strike", path: "strike.color", label: "선 색", kind: "color", def: "#ff7a7a", when: "strikeOwn" },
  { tab: "strike", path: "strike.italic", label: "기울이기", kind: "pick", options: [[true, "켬"], [false, "끔"]] },
  { tab: "strike", path: "strike.thickness", label: "선 굵기", kind: "range", min: 1, max: 4, step: 0.5, def: 2, unit: "px" },
  { tab: "strike", path: "strike.fade", label: "흐리기", kind: "range", min: 20, max: 100, step: 5, def: 55, unit: "%" },
  { tab: "strong", path: "strong.color", label: "글자 색", kind: "color", def: "#9a2f4a" },
  { tab: "strong", path: "strong.gold", label: "강조 형광펜 색", kind: "color", def: "#ffe23c" },
  { tab: "strong", path: "strong.size", label: "크기", kind: "range", min: 12, max: 24, step: 1, def: 16, unit: "px" },
  { tab: "strong", path: "strong.weight", label: "굵기", kind: "range", min: 400, max: 900, step: 1, def: 650 },
  { tab: "strong", path: "strong.letterSpacing", label: "자간", kind: "range", min: -10, max: 20, step: 1, def: 0, scale: 100, unit: "em" },
  { tab: "para", path: "type.align", label: "정렬", kind: "pick", options: [["left", "왼쪽"], ["justify-word", "양쪽"]] },
  { tab: "para", path: "type.indent", label: "첫 줄 들여쓰기", kind: "pick", options: [[true, "켬"], [false, "끔"]] },
  { tab: "para", path: "type.para", label: "문단 사이", kind: "range", min: 0, max: 2, step: 0.01, def: 0.9, unit: "줄" },
  { tab: "name", path: "fonts.name", label: "이름 글꼴", kind: "font" },
  { tab: "name", path: "profile.nameSize", label: "크기", kind: "range", min: 10, max: 24, step: 1, def: 13, unit: "px" },
  { tab: "name", path: "profile.nameWeight", label: "굵기", kind: "range", min: 100, max: 900, step: 50, def: 700 },
  { tab: "name", path: "profile.nameSpacing", label: "자간", kind: "range", min: -10, max: 30, step: 1, def: 0, scale: 100, unit: "em" },
  { tab: "title", path: "fonts.title", label: "제목 글꼴", kind: "font" },
  { tab: "title", path: "title.size", label: "크기", kind: "range", min: 16, max: 28, step: 1, def: 20, unit: "px", cap: "title" },
  { tab: "title", path: "title.weight", label: "굵기", kind: "range", min: 400, max: 900, step: 50, def: 700 },
  { tab: "title", path: "title.letterSpacing", label: "자간", kind: "range", min: -5, max: 10, step: 1, def: -1, scale: 100, unit: "em" },
  { tab: "title", path: "title.align", label: "정렬", kind: "pick", options: [["left", "왼쪽"], ["center", "가운데"]] },
  { tab: "shadow", path: "shadow.on", label: "그림자", kind: "toggle" },
  { tab: "shadow", path: "shadow.targets", label: "어디에", kind: "targets", options: [["text", "본문"], ["dialogue", "대사"], ["title", "제목"], ["name", "이름"]], when: "shadow" },
  { tab: "shadow", path: "shadow.color", label: "색", kind: "color", def: "#000000", when: "shadow" },
  { tab: "shadow", path: "shadow.alpha", label: "투명도", kind: "range", min: 0, max: 100, step: 1, def: 45, unit: "%", when: "shadow" },
  { tab: "shadow", path: "shadow.angle", label: "각도", kind: "range", min: 0, max: 360, step: 1, def: 135, unit: "°", when: "shadow" },
  { tab: "shadow", path: "shadow.distance", label: "거리", kind: "range", min: 0, max: 12, step: 0.5, def: 2, unit: "px", when: "shadow" },
  { tab: "shadow", path: "shadow.blur", label: "퍼짐", kind: "range", min: 0, max: 24, step: 0.5, def: 3, unit: "px", when: "shadow" },
  { tab: "outline", path: "outline.on", label: "외곽선", kind: "toggle" },
  { tab: "outline", path: "outline.color", label: "색", kind: "color", def: "#000000", when: "outline" },
  { tab: "outline", path: "outline.width", label: "두께", kind: "range", min: 0.2, max: 3, step: 0.1, def: 1, unit: "px", when: "outline" },
  { tab: "outline", path: "outline.alpha", label: "진하기", kind: "range", min: 0, max: 100, step: 1, def: 100, unit: "%", when: "outline" },
  { tab: "head", path: "lemon.off", label: "레몬 바로가기", kind: "toggle" }
].map(Object.freeze));
const LOOK_TABS = Object.freeze([["color", "색"], ["text", "본문"], ["dialogue", "대사"], ["em", "속마음"], ["strike", "취소선"], ["strong", "강조"], ["para", "문단"], ["name", "이름"], ["title", "제목"], ["shadow", "그림자"], ["outline", "외곽선"]]);
const SHADOW_TARGETS = ["text", "dialogue", "title", "name"];
const get = (o, path) => path.split(".").reduce((a, k) => a == null ? void 0 : a[k], o);
const put = (o, path, v) => {
  const ks = path.split(".");
  let a = o;
  for (const k of ks.slice(0, -1)) a = a[k] ??= {};
  if (v == null) delete a[ks.at(-1)];
  else a[ks.at(-1)] = v;
};
const num = (v, f) => {
  const n = Number(v);
  if (v === null || v === "" || typeof v === "boolean" || !Number.isFinite(n)) return null;
  const c = Math.min(f.max, Math.max(f.min, n));
  return Number((Math.round(c / f.step) * f.step).toFixed(4));
};
const prune = (o) => {
  for (const [k, v] of Object.entries(o)) if (v && typeof v === "object" && !Array.isArray(v)) {
    prune(v);
    if (!Object.keys(v).length) delete o[k];
  }
  return o;
};
function cleanLook(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const f of LOOK_FIELDS) {
    const v = get(raw, f.path);
    if (v == null) continue;
    if (f.kind === "range") {
      const n = num(v, f);
      if (n != null) put(out, f.path, n);
    } else if (f.kind === "pick") {
      const hit = f.options.find(([id]) => id === v || f.path === "type.align" && v === "justify-break" && id === "justify-word");
      if (hit) put(out, f.path, hit[0]);
    } else if (f.kind === "toggle") {
      if (v === true) put(out, f.path, true);
    } else if (f.kind === "color") {
      if (HEX.test(v)) put(out, f.path, v.toLowerCase());
    } else if (f.kind === "font") {
      const id = typeof v === "string" ? v : v?.ko;
      if (stackOf(id)) put(out, f.path, id);
    } else if (f.kind === "targets") {
      const t = {};
      for (const k of SHADOW_TARGETS) if (v?.[k] === true) t[k] = true;
      if (Object.keys(t).length) put(out, f.path, t);
    }
  }
  prune(out);
  return Object.keys(out).length ? out : null;
}
const store = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};
const read = (key, fallback) => {
  try {
    const v = JSON.parse(store()?.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
  }
};
let look = cleanLook(read(LOOK_KEY, null)), rev = 0;
const lookNow = () => look;
const lookRev = () => rev;
const lookValue = (path) => get(look, path) ?? null;
function setLook(next) {
  look = cleanLook(next);
  rev++;
  write(LOOK_KEY, look);
  try {
    document.dispatchEvent(new CustomEvent("bl-tone-change", { detail: { look: true } }));
  } catch {
  }
  return look;
}
function setLookValue(path, value) {
  const o = JSON.parse(JSON.stringify(look || {}));
  put(o, path, value);
  return setLook(o);
}
const rgba = (hex2, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex2 || "") || [, "000000"];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${Number((a / 100).toFixed(2))})`;
};
const px = (n) => `${Number(Number(n).toFixed(2))}px`;
function shadowValue(s = {}) {
  const a = (s.angle ?? 135) * Math.PI / 180, d = s.distance ?? 2;
  return `${px(Math.cos(a) * d)} ${px(Math.sin(a) * d)} ${px(s.blur ?? 3)} ${rgba(s.color || "#000000", s.alpha ?? 45)}`;
}
const MARKER_TILT = { flat: { rise: 0, mid: 57 }, slant: { rise: 18, mid: 56 }, steep: { rise: 48, mid: 50 } };
const MARKER_POS = { center: {}, bottom: { tiltK: 0.5, base: 96 } };
const MIN_THICK = 10;
function markerGeometry(d) {
  const tilt = MARKER_TILT[d.tilt] || MARKER_TILT.flat, pos = MARKER_POS[d.markerPos] || MARKER_POS.center;
  const thick = Number(d.markerThick) > 0 ? Number(d.markerThick) : 54, T = Math.min(100, Math.max(MIN_THICK, thick));
  const rise = Math.max(0, Math.min(tilt.rise * (pos.tiltK || 1), 100 - T)), half = (rise + T) / 2;
  const mid = Math.min(100 - half, Math.max(half, pos.base ? pos.base - T / 2 : tilt.mid));
  return { T, l: mid + rise / 2 - T / 2, r: mid - rise / 2 - T / 2 };
}
const parseColor = (c) => {
  const m = String(c).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  const h = /^#?([0-9a-f]{6})/i.exec(c || "");
  return h ? [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)).concat(1) : [0, 0, 0, 1];
};
function markerBackground(d, color) {
  const shape = d.markerShape || "stroke";
  const { T, l, r } = markerGeometry(["rectangle", "pill"].includes(shape) ? { ...d, tilt: "flat" } : d);
  const lb = l + T, rb = r + T, w = Math.min(1.8, T * 0.07);
  const [cr, cg, cb, ca] = parseColor(color), rgb = `rgb(${cr},${cg},${cb})`, op = Math.min(1, ca);
  const n = (v) => Number(v.toFixed(2));
  if (shape === "pill") {
    const half = (right) => `<svg x='${right ? 49 : 0}%' width='51%' height='100%'><svg width='100%' height='100%' viewBox='0 0 50 100' preserveAspectRatio='${right ? "xMaxYMid" : "xMinYMid"} meet' overflow='visible'><circle cx='${right ? 0 : 50}' cy='50' r='50' fill='#fff'/><rect x='${right ? -1e5 : 50}' y='0' width='100000' height='100' fill='#fff'/></svg></svg>`;
    const y = T === 100 ? 50 : n(l / (100 - T) * 100);
    const svg2 = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><defs><mask id='m' maskUnits='userSpaceOnUse' x='0' y='0' width='100%' height='100%'>${half(false)}${half(true)}</mask></defs><rect width='100%' height='100%' fill='${rgb}' fill-opacity='${n(op)}' mask='url(#m)'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg2)}") center ${y}% / 100% ${n(T)}% no-repeat`;
  }
  if (shape === "rectangle") {
    const svg2 = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><rect x='0' y='${n(l)}' width='100' height='${n(T)}' fill='${rgb}' fill-opacity='${n(op)}'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg2)}") center / 100% 100% no-repeat`;
  }
  const stroke = [`M0,${n(l + T * 0.22)}`, `L2.2,${n(l)}`, `Q25,${n(l - w + (r - l) * 0.25)} 50,${n((l + r) / 2)}`, `T98.6,${n(r)}`, `L100,${n(r + T * 0.5)}`, `L97.2,${n(rb)}`, `Q75,${n(rb + w - (rb - lb) * 0.25)} 50,${n((lb + rb) / 2)}`, `T0.8,${n(lb)}`, "Z"].join(" ");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='p' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='${rgb}' stop-opacity='${n(op * 0.45)}'/><stop offset='0.14' stop-color='${rgb}' stop-opacity='0'/></linearGradient></defs><path d='${stroke}' fill='${rgb}' fill-opacity='${n(op)}'/><path d='${stroke}' fill='url(#p)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
}
const markerImage = (color, pos, thick) => {
  const t = Math.min(100, Math.max(10, thick ?? 54));
  if (pos === "bottom") return `linear-gradient(transparent ${100 - t}%,${color} ${100 - t}%)`;
  const a = Number(((100 - t) / 2).toFixed(1));
  return `linear-gradient(transparent ${a}%,${color} ${a}%,${color} ${100 - a}%,transparent ${100 - a}%)`;
};
function lookRules(html, value) {
  const L = cleanLook(value);
  if (!L) return [];
  const text = String(html ?? "");
  const key = (text.match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
  if (!key) return [];
  const K = `.gk-${key}`.repeat(3), out = [];
  const SEL = { text: `${K} p:not(.gk-nm)`, dialogue: `${K} .gk-d`, title: `${K} .gk-tt`, name: `${K} p.gk-nm` };
  const t = L.type || {}, d = L.dialogue || {};
  const body = [];
  const step = t.sizeStep || 0, css0 = step ? text.slice(0, text.indexOf("</style>")) : "";
  const sizeIn = (re, fb) => {
    if (!step) return null;
    for (const m of css0.matchAll(/([^{}\n]+)\{([^{}]*)\}/g)) {
      if (!re.test(m[1])) continue;
      const v = m[2].match(/(?:^|;)\s*font-size:\s*(\d+(?:\.\d+)?)px/) || m[2].match(/(?:^|;)\s*font:[^;]*?(\d+(?:\.\d+)?)px/);
      if (v) return Number(v[1]);
    }
    return fb;
  };
  const stepped = (fixed, re, fb, add = step) => fixed != null ? fixed : step ? Math.round(sizeIn(re, fb) + add) : null;
  const bodySize = stepped(t.size, /(?:p\.gk-nr|\.gk-nr|\.gk-lg p)\s*$/, 16), dlSize = stepped(t.dialogueSize, /\.gk-d\s*$|\.gk-dl\s*$/, bodySize ?? 16), nmSize = stepped(L.profile?.nameSize, /\.gk-nm\s*$/, 13, Math.ceil(step / 2));
  if (L.fonts?.text) body.push(`font-family:${stackOf(L.fonts.text).family}`);
  if (bodySize != null) body.push(`font-size:${bodySize}px`);
  if (t.weight != null) body.push(`font-weight:${t.weight}`);
  if (t.letterSpacing != null) body.push(`letter-spacing:${t.letterSpacing / 100}em`);
  if (t.lineHeight != null) body.push(`line-height:${t.lineHeight}`);
  if (t.align) body.push(t.align === "left" ? "text-align:left" : "text-align:justify;word-break:keep-all");
  if (t.indent != null) body.push(`text-indent:${t.indent ? "1em" : "0"}`);
  if (t.para != null) body.push(`margin-bottom:${t.para}em`);
  if (body.length) out.push(`${SEL.text}{${body.join(";")}}`);
  if (t.para != null) out.push(`${K} .gk-lg>p:last-child{margin-bottom:0}`);
  const dl = [];
  if (L.fonts?.dialogue) dl.push(`font-family:${stackOf(L.fonts.dialogue).family}`);
  if (dlSize != null) dl.push(`font-size:${dlSize}px`);
  if (d.weight != null) dl.push(`font-weight:${d.weight}`);
  else if (d.style === "bold") dl.push("font-weight:650");
  if (d.letterSpacing != null) dl.push(`letter-spacing:${d.letterSpacing / 100}em`);
  if (dl.length) out.push(`${SEL.dialogue}{${dl.join(";")}}`);
  const dlp = [];
  if (d.lineHeight != null) dlp.push(`line-height:${d.lineHeight}`);
  if (d.indent != null) dlp.push(`text-indent:${d.indent ? "1em" : "0"}`);
  if (dlp.length) out.push(`${K} p.gk-dl{${dlp.join(";")}}`);
  const tt = L.title || {}, ttr = [];
  if (L.fonts?.title) ttr.push(`font-family:${stackOf(L.fonts.title).family}`);
  if (tt.size != null) ttr.push(`font-size:${tt.size}px;line-height:1.4`);
  if (tt.weight != null) ttr.push(`font-weight:${tt.weight}`);
  if (tt.letterSpacing != null) ttr.push(`letter-spacing:${tt.letterSpacing / 100}em`);
  if (tt.align) ttr.push(`text-align:${tt.align}`);
  if (ttr.length) out.push(`${SEL.title}{${ttr.join(";")}}`);
  if (d.style && d.style !== "full") {
    const css = text.slice(0, text.indexOf("</style>"));
    const seen = /* @__PURE__ */ new Set();
    for (const m of css.matchAll(/(?:^|\n)(\.gk-[^{}\n]*\.gk-d[A-Z])\{background-color:([^;}]+)\}/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const sel = `.gk-${key}.gk-${key}${m[1]}`;
      out.push(d.style === "marker" ? `${sel}{background:${markerBackground(d, m[2].trim())}}` : `${sel}{background-color:transparent}`);
    }
  }
  const ink = (c) => `color:${c};-webkit-text-fill-color:${c}`;
  const em = L.em || {}, emr = [];
  if (em.italic != null) emr.push(`font-style:${em.italic ? "italic" : "normal"}`);
  if (em.color) emr.push(ink(em.color));
  if (em.size != null) emr.push(`font-size:${em.size}px`);
  if (em.weight != null) emr.push(`font-weight:${em.weight}`);
  if (em.letterSpacing != null) emr.push(`letter-spacing:${em.letterSpacing / 100}em`);
  if (emr.length) out.push(`${K} em{${emr.join(";")}}`);
  const st = L.strong || {}, str = [];
  if (st.color) str.push(ink(st.color));
  if (st.gold) str.push(`box-shadow:inset 0 -0.36em ${rgba(st.gold, 62)}`);
  if (st.size != null) str.push(`font-size:${st.size}px`);
  if (st.weight != null) str.push(`font-weight:${st.weight}`);
  if (st.letterSpacing != null) str.push(`letter-spacing:${st.letterSpacing / 100}em`);
  if (str.length) out.push(`${K} strong{${str.join(";")}}`);
  const sk = L.strike || {}, skr = [];
  if (sk.line === "none") skr.push("text-decoration-line:none");
  else if (sk.line) skr.push(`text-decoration-line:line-through;text-decoration-color:${sk.line === "own" ? sk.color || "#ff7a7a" : "currentColor"}`);
  if (sk.thickness != null && sk.line !== "none") skr.push(`text-decoration-thickness:${sk.thickness}px`);
  if (sk.italic != null) skr.push(`font-style:${sk.italic ? "italic" : "normal"}`);
  if (sk.fade != null) skr.push(`opacity:${sk.fade / 100}`);
  if (skr.length) out.push(`${K} s{${skr.join(";")}}`);
  const pf = L.profile || {}, nm = [];
  if (L.fonts?.name) nm.push(`font-family:${stackOf(L.fonts.name).family}`);
  if (nmSize != null) nm.push(`font-size:${nmSize}px`);
  if (pf.nameWeight != null) nm.push(`font-weight:${pf.nameWeight}`);
  if (pf.nameSpacing != null) nm.push(`letter-spacing:${pf.nameSpacing / 100}em`);
  if (nm.length) out.push(`${SEL.name}{${nm.join(";")}}`);
  if (L.shadow?.on) {
    const targets = L.shadow.targets || { dialogue: true }, sels = SHADOW_TARGETS.filter((k) => targets[k]).map((k) => SEL[k]);
    if (sels.length) out.push(`${sels.join(",")}{text-shadow:${shadowValue(L.shadow)}}`);
  }
  if (L.outline?.on) out.push(`${Object.values(SEL).join(",")}{-webkit-text-stroke:${px(L.outline.width ?? 1)} ${rgba(L.outline.color || "#000000", L.outline.alpha ?? 100)};paint-order:stroke fill}`);
  return out;
}
function dropLemon(html) {
  let text = String(html ?? "");
  const key = (text.match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
  const lm = /<a\b[^>]*\bclass="gk-lm"[^>]*>(?:(?!<\/a>)[\s\S])*<\/a>/.exec(text);
  if (!key || !lm) return { html: text, rules: [] };
  let at = lm.index, end = at + lm[0].length;
  const hd = /<div class="gk-hd">\s*$/.exec(text.slice(0, at)), close = /^\s*<\/div>/.exec(text.slice(end));
  const rules = [];
  if (hd && close) {
    at = hd.index;
    end += close[0].length;
  } else if (hd) rules.push(`${`.gk-${key}`.repeat(3)} .gk-hd{justify-content:flex-end}`);
  text = text.slice(0, at) + text.slice(end);
  if (/^\s*<(?:div|span|p)\b[^>]*class="(?:[^"]*\s)?gk-tt(?:\s[^"]*)?"/.test(text.slice(at))) rules.push(`${`.gk-${key}`.repeat(3)} .gk-tt{margin-top:0}`);
  const css = text.indexOf("</style>");
  if (css > 0) text = text.slice(0, css).split("\n").filter((l) => !/^[^{}]*\.gk-lmi?\b[^{}]*\{[^{}]*\}$/.test(l) || l.split("{")[0].split(",").some((s) => !/\.gk-lmi?\b/.test(s))).join("\n") + text.slice(css);
  return { html: text, rules };
}
function applyLook(html, value = look) {
  let text = String(html ?? "");
  const rules = lookRules(text, value);
  if (cleanLook(value)?.lemon?.off) {
    const cut = dropLemon(text);
    text = cut.html;
    rules.push(...cut.rules);
  }
  if (!rules.length) return text;
  const at = text.indexOf("\n</style>");
  return at < 0 ? text : `${text.slice(0, at)}
${rules.join("\n")}${text.slice(at)}`;
}
function lookFromTheme(obj) {
  if (!obj || typeof obj !== "object") return null;
  let src = obj.style || obj.settings || null;
  if (!src && obj.groups && typeof obj.groups === "object") {
    src = {};
    for (const g of Object.values(obj.groups)) for (const [path, v] of Object.entries(g || {})) if (/^(type|dialogue|shadow|outline|em|strong|strike|profile)\./.test(path)) put(src, path, v);
  }
  if (!src) return null;
  const pick = {};
  for (const f of LOOK_FIELDS) {
    if (f.kind === "font" || f.kind === "color" && /^(em|strong)\./.test(f.path)) continue;
    let v = get(src, f.path);
    if (f.path === "strike.line" && v != null) v = v === false ? "none" : get(src, "strike.own") ? "own" : "text";
    if (v != null) put(pick, f.path, v);
  }
  if (pick.dialogue?.style && !["marker", "full", "bold", "plain"].includes(pick.dialogue.style)) delete pick.dialogue.style;
  return cleanLook(pick);
}
const cleanName = (s) => String(s ?? "").replace(/[<>"'`]/g, "").trim().slice(0, 24);
const hex = (v) => HEX.test(v || "") ? v.toLowerCase() : null;
function cleanPreset(x) {
  if (!x || typeof x !== "object") return null;
  const name = cleanName(x.name);
  if (!name) return null;
  const tone = x.tone && typeof x.tone === "object" ? x.tone : {}, c = x.colors && typeof x.colors === "object" ? x.colors : {};
  const inks = {};
  for (const m of ["light", "dark"]) {
    const row = {};
    for (const r of ["title", "text", "dialogue"]) {
      const v = hex(c.inks?.[m]?.[r]);
      if (v) row[r] = v;
    }
    if (Object.keys(row).length) inks[m] = row;
  }
  return {
    id: /^[a-z0-9]{4,16}$/.test(x.id || "") ? x.id : Math.random().toString(36).slice(2, 10),
    name,
    tone: { on: tone.on === true, k: hex(tone.k), name: cleanName(tone.name), k2: hex(tone.k2), name2: cleanName(tone.name2), none: tone.none === true },
    colors: { ...Object.keys(inks).length ? { inks } : {}, ...hex(c.prop) ? { prop: hex(c.prop) } : {}, ...c.own === false ? { own: false } : {} },
    look: cleanLook(x.look),
    ...cleanShape(x.shape) ? { shape: cleanShape(x.shape) } : {},
    at: Number(x.at) || 0
  };
}
const presetStore = () => {
  const v = read(PRESET_KEY, {});
  return { list: (Array.isArray(v?.list) ? v.list : []).map(cleanPreset).filter(Boolean).slice(0, 40), last: typeof v?.last === "string" ? v.last : "" };
};
const presetList = () => presetStore().list;
const presetLast = () => {
  const s = presetStore();
  return s.list.some((x) => x.id === s.last) ? s.last : "";
};
function markPreset(id) {
  const s = presetStore();
  write(PRESET_KEY, { list: s.list, last: id || "" });
}
function savePreset(data) {
  const row = cleanPreset({ ...data, at: Date.now() });
  if (!row) return null;
  const s = presetStore(), old = s.list.find((x) => x.name === row.name);
  if (old) row.id = old.id;
  write(PRESET_KEY, { list: [row, ...s.list.filter((x) => x.name !== row.name)].slice(0, 40), last: row.id });
  return row;
}
function renamePreset(id, name) {
  const n = cleanName(name), s = presetStore();
  if (!n || s.list.some((x) => x.name === n && x.id !== id)) return false;
  const row = s.list.find((x) => x.id === id);
  if (!row) return false;
  row.name = n;
  write(PRESET_KEY, s);
  return true;
}
function forgetPreset(id) {
  const s = presetStore();
  write(PRESET_KEY, { list: s.list.filter((x) => x.id !== id), last: s.last === id ? "" : s.last });
}
const b64 = { enc: (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}, bytes: (t) => {
  const bin = atob(String(t).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
} };
const codeBytes = (text) => b64.bytes(String(text).trim().replace(/^BL[SM][01]\./, ""));
function exportPreset(p) {
  const row = cleanPreset(p);
  if (!row) return "";
  const { id, at, ...rest } = row;
  return `BLM1.${b64.enc(JSON.stringify({ blueLemonMart: 1, ...rest }))}`;
}
function importPreset(text, { json = null, name = "" } = {}) {
  try {
    const raw = String(text ?? "").trim();
    const obj = json ? JSON.parse(json) : /^BL[SM]0\./.test(raw) || /^BLM1\./.test(raw) ? JSON.parse(new TextDecoder().decode(codeBytes(raw))) : JSON.parse(raw);
    if (obj?.blueLemonMart) {
      const p2 = cleanPreset({ ...obj, name: cleanName(obj.name) || name || "가져온 프리셋" });
      return p2 ? { preset: p2, from: "mart" } : null;
    }
    const lookOnly = lookFromTheme(obj);
    if (!lookOnly) return null;
    const p = cleanPreset({ name: cleanName(obj.name) || name || "테마에서 가져온 글 모양", look: lookOnly });
    return p ? { preset: p, from: "theme" } : null;
  } catch {
    return null;
  }
}
export {
  FONT_STACKS,
  LOOK_FIELDS,
  LOOK_KEY,
  LOOK_TABS,
  PRESET_KEY,
  applyLook,
  cleanLook,
  cleanPreset,
  codeBytes,
  dropLemon,
  exportPreset,
  forgetPreset,
  importPreset,
  lookFromTheme,
  lookNow,
  lookRev,
  lookRules,
  lookValue,
  markPreset,
  markerBackground,
  markerGeometry,
  presetLast,
  presetList,
  renamePreset,
  savePreset,
  setLook,
  setLookValue,
  shadowValue
};
