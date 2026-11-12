// 생성물 — 글꾸 마트 mart/motion-state.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { applyLevel, describe, FELT } from "./lib/motion/motion.js";
const MOTION_KEY = "bl-mart-motion-v1";
const MOTION_LEVELS = Object.freeze([["0", "끔"], ["s", "약"], ["m", "중"], ["l", "강"]]);
const SPEEDS = Object.freeze([["s", "느리게"], ["m", "보통"], ["l", "빠르게"]]);
const SPEED_X = { s: 1.3, l: 0.75 }, CAP_S = 3.5;
const ok = (v) => v === "0" || v === "s" || v === "l" ? v : "m";
const okSpeed = (v) => v === "s" || v === "l" ? v : "m";
const store = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};
const tidy = (v) => ({ text: ok(v?.text), prop: ok(v?.prop), speed: okSpeed(v?.speed), open: v?.open === true });
let motion = (() => {
  try {
    return tidy(JSON.parse(store()?.getItem(MOTION_KEY) || "null") || {});
  } catch {
    return tidy({});
  }
})();
let rev = 0;
const motionNow = () => ({ ...motion });
const motionRev = () => rev;
const motionPlain = (v = motion) => {
  const t = tidy(v);
  return t.text === "m" && t.prop === "m" && t.speed === "m" && !t.open;
};
function setMotion(next = {}) {
  if ("text" in next) motion.text = ok(next.text);
  if ("prop" in next) motion.prop = ok(next.prop);
  if ("speed" in next) motion.speed = okSpeed(next.speed);
  if ("open" in next) motion.open = next.open === true;
  rev++;
  const keep = {};
  if (motion.text !== "m") keep.text = motion.text;
  if (motion.prop !== "m") keep.prop = motion.prop;
  if (motion.speed !== "m") keep.speed = motion.speed;
  if (motion.open) keep.open = true;
  try {
    store()?.setItem(MOTION_KEY, JSON.stringify(keep));
  } catch {
  }
  try {
    document.dispatchEvent(new CustomEvent("bl-tone-change", { detail: { motion: true } }));
  } catch {
  }
  return motionNow();
}
const keyOf = (html) => (String(html ?? "").match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || "";
const TIME = /^-?(?:\d+\.?\d*|\.\d+)m?s$/;
const secOf = (t) => /ms$/.test(t) ? parseFloat(t) / 1e3 : parseFloat(t);
const fmt = (v) => `${Number(v.toFixed(3))}s`;
function topRules(css) {
  const out = [];
  let depth = 0, at = 0, sel = "", skip = false;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      if (depth === 0) {
        sel = css.slice(at, i).trim();
        skip = sel.startsWith("@");
        at = i + 1;
      }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        if (!skip) out.push({ sel, body: css.slice(at, i) });
        at = i + 1;
      }
    }
  }
  return out;
}
const splitTop = (s, ch) => {
  const out = [];
  let d = 0, cur = "";
  for (const c of s) {
    if (c === "(") d++;
    else if (c === ")") d--;
    if (c === ch && !d) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
};
const scaleT = (t, x, loop = false) => {
  const v = secOf(t);
  if (!v) return "0s";
  const n = v * x;
  return fmt(x > 1 && !loop && v <= CAP_S ? Math.min(n, CAP_S) : n);
};
function scaledDecls(body, x) {
  const list = [];
  for (const d of splitTop(body, ";")) {
    const i = d.indexOf(":");
    if (i < 0) continue;
    const p = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim().replace(/\s*!important$/, "");
    if (/^(animation|transition)-(duration|delay)$/.test(p)) {
      const ts = splitTop(v, ",");
      if (ts.every((t) => TIME.test(t))) list.push(`${p}:${ts.map((t) => scaleT(t, x)).join(",")}`);
      continue;
    }
    if (p !== "animation" && p !== "transition") continue;
    if (/^none$/i.test(v)) continue;
    const durs = [], dels = [];
    for (const item of splitTop(v, ",")) {
      const loop = /\binfinite\b/.test(item), times = item.split(/\s+/).filter((t) => TIME.test(t));
      durs.push(scaleT(times[0] || "0s", x, loop));
      dels.push(scaleT(times[1] || "0s", x, loop));
    }
    if (durs.some((t) => t !== "0s")) list.push(`${p}-duration:${durs.join(",")}`, `${p}-delay:${dels.join(",")}`);
  }
  return list.join(";");
}
function scaleInline(style, x) {
  return splitTop(style, ";").map((d) => {
    const i = d.indexOf(":");
    if (i < 0) return d;
    const p = d.slice(0, i).trim().toLowerCase();
    if (!/^(animation|transition)(-duration|-delay)?$/.test(p)) return d;
    const items = splitTop(d.slice(i + 1), ",").map((item) => {
      const loop = /\binfinite\b/.test(item);
      return item.split(/\s+/).map((t) => TIME.test(t) && secOf(t) ? scaleT(t, x, loop) : t).join(" ");
    });
    return `${d.slice(0, i).trim()}:${items.join(",")}`;
  }).join(";");
}
const INLINE_MOTION = /\sstyle="([^"]*(?:animation|transition)[^"]*)"/g;
function speedCaps(html) {
  const text = String(html ?? ""), key = keyOf(text), end = text.indexOf("</style>");
  if (!key || end < 0) return false;
  return topRules(text.slice(text.indexOf("<style>") + 7, end)).some((r) => scaledDecls(r.body, 2) !== "") || /\sstyle="[^"]*(?:animation|transition)[^"]*\d/.test(text.slice(end));
}
function applySpeed(html, speed) {
  const x = SPEED_X[speed];
  if (!x) return html;
  const text = String(html ?? ""), key = keyOf(text), end = text.indexOf("</style>");
  if (!key || end < 0) return text;
  const K = `.gk-${key}`, C = `gk-gs-${speed}`, rows = [];
  for (const r of topRules(text.slice(text.indexOf("<style>") + 7, end))) {
    const d = scaledDecls(r.body, x);
    if (!d) continue;
    const sels = r.sel.split(",").map((s) => s.trim()).filter((s) => s.startsWith(K) && !/[\w-]/.test(s[K.length] || "")).map((s) => `${K}.${C}${s.slice(K.length)}`);
    if (sels.length) rows.push(`${sels.join(",")}{${d}}`);
  }
  const bodyOld = text.slice(end), bodyNew = bodyOld.replace(INLINE_MOTION, (m, st) => ` style="${scaleInline(st, x)}"`);
  if (!rows.length && bodyNew === bodyOld) return text;
  const out = (text.slice(0, end) + bodyNew).replace(/^(\s*<div\b[^>]*\sclass=")(gk(?:\s[^"]*)?)(")/, (m, a, c, z) => `${a}${c} ${C}${z}`);
  const at = out.indexOf("\n</style>");
  return !rows.length || at < 0 ? out : `${out.slice(0, at)}
${rows.join("\n")}${out.slice(at)}`;
}
const openCaps = (html) => /<details class="gk-kx"/.test(String(html ?? ""));
const TYPE = /(^|[\s>+~(])(details|summary)(?![\w-])/;
function openSel(sel) {
  const parts = splitTop(sel.replace(/\.gk-kx\[open\]/g, ".gk-kx.gk-det").replace(/:not\(summary\)/g, ":not(summary,figcaption)"), ",");
  const extra = parts.filter((p) => TYPE.test(p)).map((p) => p.replace(/(^|[\s>+~(])details\[open\]/g, "$1figure.gk-det").replace(/(^|[\s>+~(])details:not\(\[open\]\)/g, "$1figure:not(.gk-det)").replace(/(^|[\s>+~(])details(?![\w-])/g, "$1figure").replace(/(^|[\s>+~(])summary(?![\w-])/g, "$1figcaption"));
  return [...parts, ...extra].join(",");
}
function openCss(css) {
  let out = "", i = 0;
  while (i < css.length) {
    const a = css.indexOf("{", i);
    if (a < 0) {
      out += css.slice(i);
      break;
    }
    const pre = css.slice(i, a), lead = pre.match(/^\s*/)[0], sel = pre.trim();
    let d = 1, j = a + 1;
    for (; j < css.length && d; j++) {
      if (css[j] === "{") d++;
      else if (css[j] === "}") d--;
    }
    const inner = css.slice(a + 1, j - 1);
    if (/^@(media|supports)/.test(sel)) out += `${lead}${sel}{${openCss(inner)}}`;
    else if (sel.startsWith("@")) out += `${lead}${sel}{${inner}}`;
    else out += `${lead}${openSel(sel)}{${inner}}`;
    i = j;
  }
  return out;
}
function applyOpen(html) {
  const text = String(html ?? "");
  if (!openCaps(text)) return text;
  const s0 = text.indexOf("<style>") + 7, e0 = text.indexOf("</style>");
  if (s0 < 7 || e0 < 0) return text;
  let body = text.slice(e0), at = 0;
  const RE = /<details class="gk-kx"([^>]*)>/g;
  for (; ; ) {
    RE.lastIndex = at;
    const m = RE.exec(body);
    if (!m) break;
    const attrs = m[1].replace(/\sopen(?:="[^"]*")?(?=[\s>]|$)/, "").replace(/\sdata-bl-peek=""/, ""), head = `<figure class="gk-kx gk-det"${attrs}>`;
    let rest = body.slice(m.index + m[0].length);
    const sm = /^(\s*)<summary\b([^>]*)>/.exec(rest);
    if (sm) {
      rest = `${sm[1]}<figcaption${sm[2]}>${rest.slice(sm[0].length).replace("</summary>", "</figcaption>")}`;
    }
    rest = rest.replace("</details>", "</figure>");
    body = body.slice(0, m.index) + head + rest;
    at = m.index + head.length;
  }
  return (text.slice(0, s0) + "\n.gk figure{margin:0}" + openCss(text.slice(s0, e0)) + body).replace(/^(\s*<div\b[^>]*\sclass=")(gk(?:\s[^"]*)?)(")/, (mm, a, c, z) => `${a}${c} gk-op${z}`);
}
function levelCaps(html) {
  const key = keyOf(html), d = describe(html, { key });
  if (!d) return null;
  const f = FELT[key] || {};
  return { text: { 0: !!d.text.off, s: !!d.text.s && f.ts !== false, l: !!d.text.l && f.tl !== false }, prop: { 0: !!d.prop.off, s: !!d.prop.s && f.ps !== false, l: !!d.prop.l && f.pl !== false } };
}
function motionCaps(html) {
  let text = { 0: false, s: false, l: false }, prop = { 0: false, s: false, l: false };
  try {
    const c = levelCaps(String(html ?? ""));
    if (c) ({ text, prop } = c);
  } catch {
  }
  let speed = false;
  try {
    speed = speedCaps(html);
  } catch {
  }
  return { text, prop, speed, open: openCaps(html) };
}
function applyMotion(html, value = motion) {
  const v = tidy(value);
  if (motionPlain(v)) return html;
  let out = String(html ?? "");
  try {
    if (v.text !== "m" || v.prop !== "m") {
      const caps = levelCaps(out);
      const t = caps && v.text !== "m" && caps.text[v.text] ? v.text : "m", p = caps && v.prop !== "m" && caps.prop[v.prop] ? v.prop : "m";
      if (t !== "m" || p !== "m") out = applyLevel(out, { text: t, prop: p, key: keyOf(out) });
    }
  } catch {
  }
  try {
    if (v.speed !== "m" && !(v.text === "0" && v.prop === "0")) out = applySpeed(out, v.speed);
  } catch {
  }
  if (v.open) out = applyOpen(out);
  return out;
}
export {
  MOTION_KEY,
  MOTION_LEVELS,
  SPEEDS,
  applyMotion,
  applyOpen,
  applySpeed,
  motionCaps,
  motionNow,
  motionPlain,
  motionRev,
  openCaps,
  setMotion,
  speedCaps
};
