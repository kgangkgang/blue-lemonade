// 생성물 — 글꾸 마트 mart/simple-frames.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { toneLadder, bandColor, speakerColor, tone, NEUTRAL_LADDER } from "./lib/log-copy/shared/char-tone.js";
import { kkangtongReady } from "./tone-geulkku.js";
const SIMPLE_CONTRACT = Object.freeze({
  blockSep: "\n\n",
  cv: Object.freeze({ bl: "#3aa7ff", pk: "#ff5fa2", mt: "#3ccfbf", yl: "#f0d878", pp: "#b799e8" }),
  faces: Object.freeze({
    k1: { orig: ["#fbfbfa", "#fbfbfa"], alt: ["#25272b", "#25272b"] },
    k2: { orig: ["#ffffff", "#f5f5f6"], alt: ["#25272b", "#1c1e21"] },
    k3: { orig: ["#f8f9fa", "#f8f9fa"], alt: ["#25272b", "#25272b"] },
    k4: { orig: ["#ffffff", "#ffffff"], alt: ["#25272b", "#1c1e21"] },
    k5: { orig: ["#fbfaf7", "#f3f1ec"], alt: ["#25272b", "#1c1e21"] },
    k6: { orig: ["#25272b", "#1c1e21"], alt: ["#ffffff", "#f5f5f6"] },
    k7: { orig: ["#1f2124", "#1f2124"], alt: ["#fbfbfa", "#fbfbfa"] },
    k8: { orig: ["#13233b", "#0d1a2d"], alt: ["#ffffff", "#f5f5f6"] }
  }),
  peek: Object.freeze(["k1", "k5", "k7", "k8"]),
  extraSteps: Object.freeze([Object.freeze({ s: 0.6, l: 0.16 })]),
  tagMix: Object.freeze({ light: 0.11, dark: 0.15 }),
  mainOrder: Object.freeze(["M", "A"]),
  ink: Object.freeze({ "gk-tl": "#26272b", "gk-td": "#e1e1e5", "gk-tx": "#e4e9f0" })
});
const BASES = ["gk-tl", "gk-td", "gk-tx"];
const OWN_CLASS = /^(?:sk|gk)-own$/;
const OWN_SEL = /\.(?:sk|gk)-own(?![\w-])/;
const hasOwnTone = (html) => /^\s*<div\b[^>]*\sclass="gk\s[^"]*\b(?:sk|gk)-own\b/.test(String(html ?? ""));
const TN = ["gk-tn-d", "gk-tn-n"];
const FRAME_KEY = /^gk-((?:k|q)\d+)$/;
const SPEAKER_SEL = /\.gk-[a-z]+[A-Z](?![\w-])|media-controls-timeline/;
const SPEAKER_CLASS = /^gk-([a-z]+)([A-Z])$/;
const OWN_TYPES = ["n", "d", "s", "u"];
const HEX6 = /(?:#|%23)[0-9a-f]{6}(?![0-9a-f])/gi;
const lineFilter = (hex) => {
  const m = /^#?([0-9a-f]{6})/i.exec(String(hex || ""));
  if (!m) return "";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, L = (mx + mn) / 2;
  if (d < 0.08) return "";
  const H = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const rot = Math.round(((H - 53) % 360 + 360) % 360), br = Math.min(1.15, Math.max(0.8, 0.52 + 0.765 * L));
  return `invert(${L >= 0.6 ? ".5" : ".55"}) sepia(1) saturate(9) hue-rotate(${rot}deg) brightness(${Number(br.toFixed(2))})`;
};
const h2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2h = (c) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
function toHsl(hex) {
  const [r, g, b] = h2rgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hue = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, sat, l];
}
function fromHsl(h, sat, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12, a = sat * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return rgb2h([f(0), f(8), f(4)]);
}
const lin = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex) => {
  const [r, g, b] = h2rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
function sianFit(C, bg, want = 4.6) {
  let [h, sat, l] = toHsl(C);
  const dir = lum(bg) > 0.4 ? -0.01 : 0.01;
  for (let i = 0; i < 100 && ratio(fromHsl(h, sat, l), bg) < want; i++) l = Math.min(1, Math.max(0, l + dir));
  return fromHsl(h, sat, l);
}
const mix = (K, bg, a) => {
  const k = h2rgb(K), b = h2rgb(bg);
  return rgb2h(k.map((v, i) => v * a + b[i] * (1 - a)));
};
const sianBand = (K) => `rgba(${h2rgb(K).join(",")},.18)`;
const CV_TAIL = /(?:-(?:[0-9a-f]{6}|x)){1,2}$/;
const ROOT_RE = /^(\s*)<div\b([^>]*?)\sclass="(gk(?:\s[^"]*)?)"([^>]*)>(\s*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>/;
function rulesOf(css) {
  const out = [];
  let depth = 0, quote = "", start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        out.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  return out.filter(Boolean);
}
const selOf = (rule) => rule.slice(0, rule.indexOf("{"));
const bodyOf = (rule) => rule.slice(rule.indexOf("{"));
const modeOf = (base) => base === "gk-tl" ? "light" : "dark";
const cvNameOf = (K) => K ? K.slice(1) : "none";
const speakersOfSel = (item, soundX) => /media-controls-timeline/.test(item) ? [soundX || "?"] : [...item.matchAll(/\.gk-[a-z]+([A-Z])(?![\w-])/g)].map((m) => m[1]);
function simpleFrameInfo(html) {
  const text = String(html ?? "");
  const m = text.match(ROOT_RE);
  if (!m) return null;
  const classes = m[3].split(/\s+/).filter(Boolean);
  const key = classes.map((c) => (c.match(FRAME_KEY) || [])[1]).find(Boolean) || "";
  const no = /^k\d+$/.test(key) ? Number(key.slice(1)) : 0;
  const base = classes.find((c) => BASES.includes(c)) || null;
  const cvClass = classes.find((c) => /^gk-cv-[\w-]+$/.test(c)) || null;
  const cvName = cvClass ? cvClass.slice(6) : null;
  const cvMain = cvName == null ? null : cvName.replace(CV_TAIL, "");
  const K0 = cvName == null ? void 0 : cvMain === "none" ? null : SIMPLE_CONTRACT.cv[cvMain] || (/^[0-9a-f]{6}$/.test(cvMain) ? `#${cvMain}` : void 0);
  const css = m[6].replace(/^\n/, "").replace(/\n$/, "");
  const parts = css.split(SIMPLE_CONTRACT.blockSep);
  const rest = text.slice(m.index + m[0].length);
  const used = /* @__PURE__ */ new Set();
  for (const [, v] of rest.matchAll(/\sclass="([^"]*)"/g)) for (const c of v.split(/\s+/)) if (c) used.add(c);
  const speakers = [...new Set([...used].map((c) => (c.match(SPEAKER_CLASS) || [])[2]).filter(Boolean))].sort();
  const extra = {};
  for (const r of rulesOf(parts.slice(1).join("\n"))) {
    for (const item of selOf(r).split(",")) {
      const t = (item.trim().match(/\.gk-([a-z]+)[A-Z]$/) || [])[1];
      if (!t || OWN_TYPES.includes(t)) continue;
      const props = extra[t] ??= /* @__PURE__ */ new Set();
      for (const d of bodyOf(r).slice(1, -1).split(";")) {
        const k = d.split(":")[0].trim();
        if (/color$/.test(k) && k !== "-webkit-text-fill-color") props.add(k);
      }
    }
  }
  const soundBy = [...rest.matchAll(/\sclass="[^"]*\bgk-sn\s+gk-s([A-Z])\b[^"]*"/g)].map((x) => x[1]);
  return { key, no, base, classes, cvClass, cvName, K0, css, parts, base_css: parts[0], color_css: parts.slice(1).join("\n"), speakers, extra, soundBy, used, imageBand: /\.gk-d[A-Z]\{background-image:/.test(parts.slice(1).join("\n")), audio: /<audio\b/.test(rest), match: m };
}
function facesOf(info, origBase) {
  if (SIMPLE_CONTRACT.faces[info.key]) return SIMPLE_CONTRACT.faces[info.key];
  const k = info.key.replace(/[^\w-]/g, ""), all = rulesOf(info.css);
  const find = (re) => {
    for (const r of all) for (const item of selOf(r).split(",")) if (re.test(item.trim())) {
      const v = (bodyOf(r).match(/background-color:\s*(#[0-9a-f]{6})/i) || [])[1];
      if (v) return v.toLowerCase();
    }
    return null;
  };
  const cv = "(?:\\.gk-cv-[\\w-]+)?", b = `(?:\\.${origBase})?`;
  const oc = find(new RegExp(`^\\.gk-${k}${cv}${b}$`)), ol = find(new RegExp(`^\\.gk-${k}${cv}${b} \\.gk-lg$`));
  const ac = find(new RegExp(`^\\.gk-${k}${cv}\\.gk-tn-[nd]$`)), al = find(new RegExp(`^\\.gk-${k}${cv}\\.gk-tn-[nd] \\.gk-lg$`));
  const light = modeOf(origBase) === "light";
  const def = (dark) => dark ? ["#25272b", "#1c1e21"] : ["#ffffff", "#f5f5f6"];
  return { orig: [oc || def(!light)[0], ol || oc || def(!light)[1]], alt: [ac || def(light)[0], al || ac || def(light)[1]] };
}
function speakerColorsOf(colorCss) {
  const out = {};
  for (const r of rulesOf(colorCss)) {
    const m = r.match(/\.gk-d([A-Z])\{background-color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/) || r.match(/\.gk-d([A-Z])\{background-image:[^}]*?rgba?%28(\d+),(\d+),(\d+)/);
    if (m && !(m[1] in out)) out[m[1]] = speakerColor(`rgb(${m[2]}, ${m[3]}, ${m[4]})`);
  }
  return out;
}
function speakerRules({ sel, base, mode, card, log, speakers, colors, used, extra = {} }) {
  const out = [], dark = mode === "dark";
  const neutral = tone(null, { mode });
  for (const X of speakers) {
    const K = colors[X] ?? null;
    const name = K ? sianFit(K, log) : SIMPLE_CONTRACT.ink[base] || neutral.text;
    const rule = sianFit(K || NEUTRAL_LADDER.c500, card);
    const tag = mix(K || NEUTRAL_LADDER.c500, dark ? log : "#ffffff", SIMPLE_CONTRACT.tagMix[dark ? "dark" : "light"]);
    const tagInk = K ? sianFit(K, tag) : name;
    if (used.has(`gk-d${X}`)) out.push(`${sel} .gk-d${X}{background-color:${K ? sianBand(K) : bandColor(null, mode)}}`);
    if (used.has(`gk-n${X}`)) out.push(`${sel} .gk-nm.gk-n${X}{color:${name};-webkit-text-fill-color:${name}}`);
    if (used.has(`gk-s${X}`)) out.push(`${sel} .gk-sn.gk-s${X}{color:${tagInk};-webkit-text-fill-color:${tagInk};background-color:${tag}}`);
    if (used.has(`gk-u${X}`)) out.push(`${sel} .gk-u${X}{background-color:${rule}}`);
    for (const [t, props] of Object.entries(extra)) {
      if (!used.has(`gk-${t}${X}`) || !props.size) continue;
      out.push(`${sel} .gk-${t}${X}{${[...props].map((k) => k === "color" ? `color:${name};-webkit-text-fill-color:${name}` : `${k}:${rule}`).join(";")}}`);
    }
  }
  return out;
}
function originalBase(info) {
  if (!info.classes.some((c) => TN.includes(c))) return info.base;
  if (info.base !== "gk-tl") return "gk-tl";
  return new RegExp(`\\.gk-tx(?![\\w-])`).test(info.css) ? "gk-tx" : "gk-td";
}
const ORIGINAL = /* @__PURE__ */ Symbol("원래 색");
function kkGuard(html, key) {
  const text = String(html ?? "");
  if (!key || !/<details\b/.test(text)) return "";
  const css = text.slice(0, text.indexOf("</style>")), out = [];
  if (!/details>summary~:not\(\[class\]\)\{display:none/.test(css)) out.push(`div.gk-${key} details>summary~:not([class]){display:none}`);
  if (!/details\{margin:0/.test(css)) out.push(`div.gk-${key} details{margin:0}`);
  return out.length ? `
${out.join("\n")}` : "";
}
const THIRD = "Z";
function toneSimple(html, K, { mode = "dark", main, other, prop, own, third } = {}) {
  const info = simpleFrameInfo(html);
  if (!info || !info.key || !info.base || info.K0 === void 0) return html;
  const original = K === ORIGINAL;
  const k = original ? info.K0 : speakerColor(K);
  const origBase = originalBase(info), faces = facesOf(info, origBase);
  const origMode = modeOf(origBase), want = mode === "light" ? "light" : "dark";
  const alt = origBase === "gk-tl" ? "gk-td" : "gk-tl";
  const nowBase = want === origMode ? origBase : alt;
  const nowTn = want === origMode ? null : want === "dark" ? "gk-tn-n" : "gk-tn-d";
  const k2 = speakerColor(other) || null;
  const kp = speakerColor(prop) || null;
  const cvBase = original && info.cvClass ? info.cvClass.replace(CV_TAIL, "") : `gk-cv-${cvNameOf(k)}`;
  const cv = kp ? `${cvBase}-${k2 ? k2.slice(1) : "x"}-${kp.slice(1)}` : k2 ? `${cvBase}-${k2.slice(1)}` : cvBase;
  const renameCv = (s) => info.cvClass ? s.split(`.${info.cvClass}`).join(`.${cv}`) : s;
  const kept = info.classes.filter((c) => c !== "gk" && !BASES.includes(c) && !TN.includes(c) && !(own === false && OWN_CLASS.test(c))).map((c) => c === info.cvClass ? cv : c);
  const rootClass = ["gk", nowBase, nowTn, ...kept].filter(Boolean).join(" ");
  const colors0 = speakerColorsOf(info.color_css);
  const mainX = main || info.speakers.find((X) => info.K0 && colors0[X] === info.K0) || SIMPLE_CONTRACT.mainOrder.find((x) => info.speakers.includes(x)) || info.speakers[0];
  const k3 = speakerColor(third) || null;
  const colors = Object.fromEntries(info.speakers.map((X) => [X, X === THIRD && X !== mainX ? k3 : X === mainX ? k : k2 || (colors0[X] ?? null)]));
  const same = (X) => X !== "?" && (colors[X] ?? null) === (colors0[X] ?? null);
  const soundX = info.soundBy[0];
  const keepSpeaker = (r) => {
    const items = selOf(r).split(",").filter((item) => speakersOfSel(item, soundX).every(same));
    return items.length ? renameCv(items.join(",")) + bodyOf(r) : null;
  };
  const changed = info.speakers.filter((X) => !same(X));
  const sel = (b) => `.gk-${info.key}.${cv}.${b}`;
  const used = info.imageBand ? new Set([...info.used].filter((c) => !/^gk-d[A-Z]$/.test(c))) : info.used;
  const fresh = [
    ...speakerRules({ sel: sel(origBase), base: origBase, mode: origMode, card: faces.orig[0], log: faces.orig[1], speakers: changed, colors, used, extra: info.extra }),
    ...speakerRules({ sel: sel(alt), base: alt, mode: origMode === "light" ? "dark" : "light", card: faces.alt[0], log: faces.alt[1], speakers: changed, colors, used, extra: info.extra })
  ];
  if (info.audio && soundX && !same(soundX)) {
    const lf = lineFilter(colors[soundX]);
    if (lf) fresh.push(`.gk-${info.key}.gk-${info.key}.gk-${info.key}.${cv} audio::-webkit-media-controls-timeline{filter:${lf}!important}`);
  }
  const swap = /* @__PURE__ */ new Map(), put = (a, b) => {
    if (a && b && !swap.has(a.toLowerCase())) swap.set(a.toLowerCase(), b.toLowerCase());
  };
  const from = toneLadder(info.K0), to = toneLadder(kp || k);
  for (const step of Object.keys(from)) put(from[step], to[step]);
  const seed0 = info.K0 || NEUTRAL_LADDER.c500, seed1 = kp || k || NEUTRAL_LADDER.c500;
  for (const { s, l } of SIMPLE_CONTRACT.extraSteps) {
    const [h0, s0, l0] = toHsl(seed0), [h1, s1, l1] = toHsl(seed1);
    put(fromHsl(h0, s0 * s, l0 * l), fromHsl(h1, s1 * s, l1 * l));
  }
  for (const bg of [...faces.orig, ...faces.alt, "#ffffff"]) put(sianFit(seed0, bg), sianFit(seed1, bg));
  if (k2) for (const X of info.speakers) {
    if (X === mainX || !colors0[X] || colors0[X] === k2) continue;
    put(colors0[X], k2);
    for (const bg of [...faces.orig, ...faces.alt, "#ffffff"]) put(sianFit(colors0[X], bg), sianFit(k2, bg));
  }
  const rgbOf = (K0) => h2rgb(K0 || NEUTRAL_LADDER.c500).join(",");
  const swapRgb = (body) => changed.reduce((b, X) => colors0[X] ? b.split(`(${rgbOf(colors0[X])},`).join(`(${rgbOf(colors[X])},`).split(`rgb%28${rgbOf(colors0[X])}%29`).join(`rgb%28${rgbOf(colors[X])}%29`) : b, body);
  const swapHex = (body) => body.replace(HEX6, (h) => {
    const pre = h[0] === "#" ? "#" : "%23", v = swap.get(`#${h.slice(pre.length).toLowerCase()}`);
    return v ? pre + v.slice(1) : h;
  });
  const imageBand = (r) => /^\{background-image:/.test(bodyOf(r)) && /\.gk-d[A-Z](?![\w-])/.test(selOf(r));
  const chunk = (css2) => rulesOf(css2).map((r) => {
    if (imageBand(r)) return renameCv(selOf(r)) + swapRgb(bodyOf(r));
    if (SPEAKER_SEL.test(selOf(r))) return keepSpeaker(r);
    if (OWN_SEL.test(selOf(r))) return renameCv(selOf(r)) + bodyOf(r);
    return renameCv(selOf(r)) + swapRgb(swapHex(bodyOf(r)));
  }).filter(Boolean);
  const spk = [...chunk(info.parts[1] || ""), ...fresh];
  const propCss = info.parts.slice(2).flatMap(chunk);
  const css = [info.base_css, spk.join("\n"), propCss.join("\n")].filter(Boolean).join(SIMPLE_CONTRACT.blockSep);
  const m = info.match;
  let out = `${m[1]}<div${m[2]} class="${rootClass}"${m[4]}>${m[5]}<style>
${css}
</style>` + html.slice(m.index + m[0].length);
  out = out.replace(/(<audio\b[^>]*\sstyle="[^"]*color-scheme:)(light|dark)/g, `$1${want}`);
  return out;
}
function speakerPair(html) {
  const info = simpleFrameInfo(html);
  if (!info || info.K0 === void 0) return { main: null, other: null };
  const colors0 = speakerColorsOf(info.color_css);
  const mainX = info.speakers.find((X) => info.K0 && colors0[X] === info.K0) || SIMPLE_CONTRACT.mainOrder.find((x) => info.speakers.includes(x)) || info.speakers[0];
  return { main: info.K0 || null, other: colors0[info.speakers.find((X) => X !== mainX)] || null };
}
function hasPropTone(html) {
  const bare = (s) => s.slice(0, s.indexOf("</style>")).replace(/gk-cv-[\w-]+/g, "");
  return bare(toneSimple(html, ORIGINAL, { mode: "light" })) !== bare(toneSimple(html, ORIGINAL, { mode: "light", prop: "#00c853" }));
}
function peekSimple(html, open) {
  const info = simpleFrameInfo(html);
  const on = open ?? (info ? SIMPLE_CONTRACT.peek.includes(info.key) : false);
  if (!info || !on) return String(html ?? "");
  return String(html).replace(/<details\b(?![^>]*\sopen(?:=|\s|>))([^>]*)>/, '<details$1 open="" data-bl-peek="">');
}
function hoistStyle(html) {
  const text = String(html ?? "");
  const m = text.match(ROOT_RE);
  if (!m) return text;
  return `${m[1]}<style>${m[6]}</style><div${m[2]} class="${m[3]}"${m[4]}>${m[5]}` + text.slice(m.index + m[0].length).replace(/^\n/, "");
}
const EDIT_MARKS = Object.freeze([
  ["gk-tt", "제목"],
  ["gk-nr", "지문"],
  ["gk-nm", "화자 이름"],
  ["gk-dl", "대사"],
  ["gk-sd", "소리 카드 — 이름표 글자 · audio 의 src(mp3 주소)"],
  ["gk-hl", "숨은 한 줄(찻물이 차면 나와요)"]
]);
const MARK_HEAD = "<!-- ▲ 위 스타일 칸은 틀 모양 · 색이에요(고치지 않아도 돼요) · ▼ 아래는 글 — 「✎」 주석 바로 뒤 요소의 글자만 바꿔요 · 대사 · 지문 줄은 복사해 늘리거나 지워도 돼요 -->";
const HIDDEN_LINE_FRAMES = Object.freeze(["k5"]);
const frameKeyOf = (html) => (String(html ?? "").match(/\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || "";
function markEdits(html, { skip = [] } = {}) {
  const text = String(html ?? "");
  if (text.includes("「✎」")) return text;
  const at = text.indexOf("</style>");
  if (at < 0) return text;
  const head = text.slice(0, at + 8), body = text.slice(at + 8);
  const marks = new Map(EDIT_MARKS.filter(([cls]) => !skip.includes(cls)));
  const marked = body.replace(/<([a-z][a-z0-9]*)\b([^>]*?)\sclass="([^"]*)"/g, (all, tag, pre, cls, at2, whole) => {
    const hit = cls.split(/\s+/).find((c) => marks.has(c));
    if (!hit || /<!--\s*✎[^>]*-->\s*$/.test(whole.slice(Math.max(0, at2 - 200), at2))) return all;
    return `<!-- ✎ ${marks.get(hit)} -->${all}`;
  });
  return `${head}
${MARK_HEAD}${marked.startsWith("\n") ? "" : "\n"}${marked}`;
}
const withGuard = (html) => {
  const g = kkGuard(html, frameKeyOf(html));
  if (!g) return html;
  const at = html.indexOf("\n</style>");
  return at < 0 ? html : html.slice(0, at) + g + html.slice(at);
};
const simpleReady = (html) => markEdits(kkangtongReady(hoistStyle(withGuard(html))), { skip: HIDDEN_LINE_FRAMES.includes(frameKeyOf(html)) ? [] : ["gk-hl"] });
export {
  EDIT_MARKS,
  HIDDEN_LINE_FRAMES,
  ORIGINAL,
  SIMPLE_CONTRACT,
  THIRD,
  facesOf,
  hasOwnTone,
  hasPropTone,
  hoistStyle,
  lineFilter,
  markEdits,
  peekSimple,
  sianFit,
  simpleFrameInfo,
  simpleReady,
  speakerPair,
  toneSimple
};
