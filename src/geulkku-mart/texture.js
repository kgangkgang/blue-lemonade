// 생성물 — 글꾸 마트 mart/texture.js 사본(마트 97a96f7a · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { TEX, ORDER } from "./lib/texture/tex.js";
import { simpleFrameInfo } from "./simple-frames.js";
const TEX_KEY = "bl-mart-texture-v1";
const TEX_NAMES = Object.freeze(Object.fromEntries(ORDER.map((k) => [k, TEX[k].name])));
const NO_TEX_MART = Object.freeze({
  k1228: "X 타래(화면 꼴)",
  k1363: "X 타래 · 빈 타래(화면 꼴)",
  k1364: "X 타래 · 줄에 건 쪽지와 타래 꼴 글(화면 꼴)",
  k1101: "디스코드(화면 꼴)",
  k1193: "배달앱 리뷰(화면 꼴)",
  k1224: "통화 기록(화면 꼴)",
  k1362: "통화 기록 · 접힌 통화 목록(화면 꼴)",
  k1223: "블로그 글(화면 꼴)",
  k1361: "블로그 글 · 노트북과 블로그 꼴 글(화면 꼴)",
  k1192: "미니홈피(화면 꼴)",
  k1365: "미니홈피 · 다이어리 탭(화면 꼴)",
  k1366: "미니홈피 · 미니룸과 방명록(화면 꼴)",
  k1371: "인스타 DM(화면 꼴)",
  k1372: "인스타 피드(화면 꼴)",
  k1373: "인스타 스토리(화면 꼴)",
  k1138: "경찰 분실물 접수(글 칸에 제 바탕 그림이 있음)"
});
function cleanTex(v) {
  if (!v || typeof v !== "object" || !ORDER.includes(v.tex)) return null;
  return { tex: v.tex, on: v.on === "c" ? "c" : "b", level: [1, 2, 3].includes(Number(v.level)) ? Number(v.level) : 2, ...v.tex === "line" && v.margin === true ? { margin: true } : {} };
}
const store = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};
let tex = (() => {
  try {
    return cleanTex(JSON.parse(store()?.getItem(TEX_KEY) || "null"));
  } catch {
    return null;
  }
})(), rev = 0;
const texNow = () => tex ? { ...tex } : null;
const texRev = () => rev;
function setTex(next) {
  tex = cleanTex(next);
  rev++;
  try {
    store()?.setItem(TEX_KEY, JSON.stringify(tex));
  } catch {
  }
  try {
    document.dispatchEvent(new CustomEvent("bl-tone-change", { detail: { tex: true } }));
  } catch {
  }
  return texNow();
}
const esc = (s) => s.replace(/[-]/g, "\\-");
const ROOT = /^(\s*<div\b[^>]*?\sclass=")(gk(?:\s[^"]*)?)(")/;
function texInfo(html) {
  const text = String(html ?? ""), m = text.match(ROOT), fi = simpleFrameInfo(text);
  if (!m || !fi?.key) return { blocked: true, why: "글꾸 틀이 아님" };
  const key = `gk-${fi.key}`, cls = m[2].split(/\s+/), end = text.indexOf("</style>");
  if (NO_TEX_MART[fi.key]) return { key, blocked: true, why: NO_TEX_MART[fi.key] };
  const head = text.slice(0, end), K = esc(key);
  const mode = cls.find((c) => c === "gk-tl" || c === "gk-td" || c === "gk-tx") || "gk-tl", tn = cls.find((c) => c === "gk-tn-d" || c === "gk-tn-n");
  const rules = [...head.matchAll(/(^|[\n}])([^{}\n]+)\{([^{}]*)\}/g)].map((x) => [x[2].trim(), x[3]]);
  const cv = cls.find((c) => /^gk-cv-/.test(c)), nowQ = tn || mode;
  const okQual = (q) => {
    const t = q.split(".").filter(Boolean);
    return t.every((c) => c === cv || c === nowQ || !tn && c === mode) && (tn ? t.includes(tn) : true);
  };
  const bgOf = (tail) => {
    let v = null, img = false;
    for (const [sel, body] of rules) for (const s of sel.split(",")) {
      const st = s.trim();
      if (!st.startsWith(`.${key}`) || !st.endsWith(tail)) continue;
      const q = st.slice(key.length + 1, st.length - tail.length);
      if (tail && q.includes(" ")) continue;
      if (!tail && /\s/.test(q)) continue;
      if (!okQual(q)) continue;
      const c = body.match(/background-color:([^;}]+)/);
      if (c) v = c[1].trim();
      if (/background(?:-image)?:[^;}]*(?:url\(|gradient)/.test(body)) img = true;
    }
    return { v, img };
  };
  const card = bgOf(""), lg = bgOf(" .gk-lg"), pane = !!lg.v;
  const speak = /* @__PURE__ */ new Map();
  for (const [sel, body] of rules) for (const s of sel.split(",")) {
    const mm = s.trim().match(new RegExp(`^\\.${K}((?:\\.[\\w-]+)*) \\.(gk-d[A-Z])$`));
    if (!mm) continue;
    const q = mm[1].split(".").filter(Boolean);
    if (q.some((c2) => /^gk-(?:tl|td|tx|tn-[dn])$/.test(c2) && c2 !== mode && c2 !== tn)) continue;
    const c = body.match(/^background-color:([^;}]+)$/);
    if (c) speak.set(mm[2], c[1].trim());
  }
  let why = "";
  if (!card.v) why = "뿌리 바탕색이 없는 틀(화면 꼴)";
  else if (card.img || lg.img) why = "얹을 면에 이미 바탕 그림이 있음";
  return { key, cls, mode, tn, tone: mode === "gk-tl" ? "d" : "n", pane, base: { c: card.v, b: lg.v }, speak: [...speak], hasSound: /class="gk-sd"/.test(text), blocked: !!why, why, m, end };
}
const decl = (ls) => `background-image:${ls.map((l) => l.img).join(",")};background-size:${ls.map((l) => l.size).join(",")};background-position:${ls.map((l) => l.pos).join(",")};background-repeat:${ls.map((l) => l.rep).join(",")}`;
function stripTex(html) {
  const text = String(html ?? ""), m = text.match(ROOT);
  if (!m || !/\bgk-tx-/.test(m[2])) return text;
  const cls = m[2].split(/\s+/).filter((c) => !/^gk-tx-/.test(c)).join(" ");
  const end = text.indexOf("</style>"), head = text.slice(m[0].length, end).split("\n").filter((l) => !/^\.gk-(?:k|q)\d+\.gk-(?:k|q)\d+\.gk-(?:k|q)\d+\.gk-tx-/.test(l)).join("\n");
  return m[1] + cls + m[3] + head + text.slice(end);
}
function applyTex(html, value = tex) {
  const clean = stripTex(html), o = cleanTex(value);
  if (!o) return clean;
  const i = texInfo(clean);
  if (i.blocked) return clean;
  const T = TEX[o.tex], t = i.tone, lv = o.level;
  const R = `.${i.key}.${i.key}.${i.key}.gk-tx-${o.tex}.gk-tx-on-${o.on}${lv === 2 ? "" : `.gk-tx-${lv}`}.${i.tn || i.mode}`;
  const tgt = !i.pane ? R : o.on === "c" ? `${R},${R} .gk-lg` : `${R} .gk-lg`;
  const rows = [`${tgt}{${decl(T.layers(t, T.a[t][lv - 1], { margin: !!o.margin }))}}`];
  const b = i.pane && o.on === "b" ? i.base.b : i.pane ? i.base.b : i.base.c;
  if (b) {
    for (const [c, tint] of i.speak) rows.push(`${R} .${c}{background-image:linear-gradient(${tint},${tint}),linear-gradient(${b},${b})}`);
    if (i.hasSound) rows.push(`${R} .gk-sd{background-color:${b}}`);
  }
  const add = [`gk-tx-${o.tex}`, `gk-tx-on-${o.on}`, ...lv === 2 ? [] : [`gk-tx-${lv}`], ...o.margin ? ["gk-tx-mg"] : []];
  const out = i.m[1] + [...i.cls, ...add].join(" ") + i.m[3] + clean.slice(i.m[0].length);
  const at = out.indexOf("\n</style>");
  return at < 0 ? out : `${out.slice(0, at)}
${rows.join("\n")}${out.slice(at)}`;
}
export {
  NO_TEX_MART,
  TEX_KEY,
  TEX_NAMES,
  ORDER as TEX_ORDER,
  applyTex,
  cleanTex,
  setTex,
  stripTex,
  texInfo,
  texNow,
  texRev
};
