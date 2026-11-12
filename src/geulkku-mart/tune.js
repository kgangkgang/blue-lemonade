// 생성물 — 글꾸 마트 mart/tune.js 사본(마트 97a96f7a · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
const TUNE_KEY = "bl-mart-tune-v1";
const MINE_KEY = "bl-mart-mine-v1";
import { spoilerHtml, spoilerStyle, SPOILER_LABEL, unparagraphHtml } from "./lib/log-copy/log-copy-spoiler.js";
import { cleanLook } from "./look.js";
import { applyVals } from "./custom.js";
import { PAINT_ROLES } from "./shape.js";
import { cleanShape } from "./shape.js";
const HEX = /^#[0-9a-f]{6}$/i;
const TUNE_ROLES = Object.freeze([
  Object.freeze({ role: "title", label: "제목", cls: "gk-tt", sel: ".gk-tt" }),
  Object.freeze({ role: "text", label: "본문", cls: "gk-nr", sel: "p.gk-nr" }),
  Object.freeze({ role: "dialogue", label: "대사", cls: "gk-d", sel: ".gk-d" }),
  Object.freeze({ role: "name", label: "이름", cls: "gk-nm", sel: "p.gk-nm" })
]);
const EDIT_CLASSES = Object.freeze(["gk-tt", "gk-nr", "gk-nm", "gk-d", "gk-sn", "gk-hl"]);
const EDIT_TAGS = Object.freeze(["em", "strong", "s"]);
const LINES_RANGE = Object.freeze([-1, 2]);
const MODES = ["light", "dark"];
const DARK_BASES = ["gk-td", "gk-tx"];
const escText = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const oneLine = (s) => String(s ?? "").replace(/[\r\n\t]+/g, " ").slice(0, 600);
const RICH_TAGS = Object.freeze(["br", "b", "i", "strong", "em", "s"]);
function cleanRich(v) {
  let s = String(v ?? "").slice(0, 4e3).replace(/\r\n?/g, "\n");
  const out = [], stack = [];
  for (const m of s.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>|([^<]+)|(<)/gi)) {
    if (m[3] != null || m[4] != null) {
      out.push(String(m[3] ?? m[4]).replace(/&(?!(?:amp|lt|gt|quot|#39|#x?[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"));
      continue;
    }
    const close = m[1] === "/", tag = m[2].toLowerCase();
    if (tag === "div" || tag === "p") {
      if (!close && out.length) out.push("<br>");
      continue;
    }
    if (!RICH_TAGS.includes(tag)) continue;
    if (tag === "br") {
      out.push("<br>");
      continue;
    }
    if (!close) {
      out.push(`<${tag}>`);
      stack.push(tag);
    } else {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) out.push(`</${stack.pop()}>`);
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("").replace(/(<br>){3,}/g, "<br><br>").replace(/^(<br>)+|(<br>)+$/g, "").slice(0, 2e3);
}
const store = (kind) => {
  try {
    return kind === "session" ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return null;
  }
};
const read = (kind, key, fallback) => {
  try {
    const v = JSON.parse(store(kind)?.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (kind, key, value) => {
  try {
    store(kind)?.setItem(key, JSON.stringify(value));
  } catch {
  }
};
function cleanTune(t) {
  if (!t || typeof t !== "object") return null;
  const out = {};
  const inks = {};
  for (const m of MODES) {
    const row = {};
    for (const { role } of [...TUNE_ROLES, ...PAINT_ROLES]) {
      const v = t.inks?.[m]?.[role];
      if (HEX.test(v || "")) row[role] = v.toLowerCase();
    }
    if (Object.keys(row).length) inks[m] = row;
  }
  if (Object.keys(inks).length) out.inks = inks;
  if (HEX.test(t.prop || "")) out.prop = t.prop.toLowerCase();
  if (t.own === false || t.own === true) out.own = t.own;
  if (t.hideTitle === true) out.hideTitle = true;
  if (t.hideNames === true) out.hideNames = true;
  for (const key of ["spoilers", "mineSpoilers"]) {
    const list = [...new Set((Array.isArray(t[key]) ? t[key] : []).map((x) => Number(x?.i)).filter((i) => Number.isInteger(i) && i >= 0))].slice(0, 20).map((i) => ({ i }));
    if (list.length) out[key] = list;
  }
  const lines = Number(t.lines);
  if (Number.isInteger(lines) && lines !== 0 && lines >= LINES_RANGE[0] && lines <= LINES_RANGE[1]) out.lines = lines;
  const texts = {};
  for (const [i, v] of Object.entries(t.texts || {})) if (/^\d+$/.test(i) && typeof v === "string") texts[i] = cleanRich(v);
  if (Object.keys(texts).length) out.texts = texts;
  const mineTexts = {};
  for (const [i, v] of Object.entries(t.mineTexts || {})) if (/^\d+$/.test(i) && typeof v === "string") mineTexts[i] = cleanRich(v);
  if (Object.keys(mineTexts).length) out.mineTexts = mineTexts;
  const vals = {};
  for (const [k, v] of Object.entries(t.vals && typeof t.vals === "object" ? t.vals : {}).slice(0, 40)) if (/^[\p{L}\p{N}_ -]{1,24}$/u.test(k) && (Number.isFinite(v) || typeof v === "string" && v.length <= 80)) vals[k] = typeof v === "string" ? v.replace(/[<>]/g, "") : v;
  if (Object.keys(vals).length) out.vals = vals;
  return Object.keys(out).length ? out : null;
}
const tunes = (() => {
  const all = read("session", TUNE_KEY, {});
  const out = {};
  for (const [id, t] of Object.entries(all && typeof all === "object" ? all : {})) {
    const c = cleanTune(t);
    if (c) out[id] = c;
  }
  return out;
})();
let rev = 0;
const tuneOf = (id) => tunes[id] || null;
const tuneRev = () => rev;
function dropMineEdits() {
  let n = 0;
  for (const [id, t] of Object.entries(tunes)) {
    if (!t.mineTexts && !t.mineSpoilers) continue;
    const { mineTexts, mineSpoilers, ...rest } = t, c = cleanTune(rest);
    if (c) tunes[id] = c;
    else delete tunes[id];
    n++;
  }
  if (n) {
    rev++;
    write("session", TUNE_KEY, tunes);
    try {
      document.dispatchEvent(new CustomEvent("bl-tune-change", { detail: { id: null } }));
    } catch {
    }
  }
  return n;
}
function setTune(id, next, { textOnly = false } = {}) {
  const c = cleanTune(next);
  if (c) tunes[id] = c;
  else delete tunes[id];
  rev++;
  write("session", TUNE_KEY, tunes);
  try {
    document.dispatchEvent(new CustomEvent("bl-tune-change", { detail: { id, textOnly } }));
  } catch {
  }
  return c;
}
const LEAF = /(<!--\s*✎[^>]*-->\s*)?<([a-z][a-z0-9]*)\b([^>]*)>((?:[^<]|<br\s*\/?>|<\/?(?:b|i|strong|em|s)>)*)<\/\2>/g;
function editables(html) {
  const text = String(html ?? ""), at = text.indexOf("</style>");
  const from = at < 0 ? 0 : at + 8, out = [];
  LEAF.lastIndex = from;
  for (let m; m = LEAF.exec(text); ) {
    const cls = ((m[3].match(/\sclass="([^"]*)"/) || [])[1] || "").split(/\s+/);
    const hit = EDIT_CLASSES.find((c) => cls.includes(c));
    if (!hit && !m[1] && !EDIT_TAGS.includes(m[2])) continue;
    if (hit === "gk-hl" && !m[4].trim()) continue;
    if (m[2] === "style" || m[2] === "script" || m[2] === "audio") continue;
    const end = m.index + m[0].length - `</${m[2]}>`.length;
    out.push({ i: out.length, cls: hit || (EDIT_TAGS.includes(m[2]) ? m[2] : "mark"), text: m[4], start: end - m[4].length, end });
  }
  return out;
}
function applyTexts(html, texts) {
  const keys = Object.keys(texts || {});
  if (!keys.length) return String(html ?? "");
  let text = String(html ?? "");
  for (const e of editables(text).reverse()) if (Object.hasOwn(texts, e.i)) text = text.slice(0, e.start) + cleanRich(texts[e.i]) + text.slice(e.end);
  return text;
}
function inkRules(html, inks) {
  const key = (String(html ?? "").match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
  if (!key || !inks) return [];
  const K = `.gk-${key}`.repeat(3), out = [];
  for (const m of MODES) for (const { role, sel } of TUNE_ROLES) {
    const v = inks[m]?.[role];
    if (!HEX.test(v || "")) continue;
    const roots = m === "light" ? [`${K}.gk-tl`] : DARK_BASES.map((b) => `${K}.${b}`);
    out.push(`${roots.map((r) => `${r} ${sel}`).join(",")}{color:${v};-webkit-text-fill-color:${v}}`);
  }
  return out;
}
const titleInPress = (html) => [...String(html ?? "").matchAll(/<(summary|label)\b[\s\S]*?<\/\1>/g)].some((m) => /class="(?:[^"]*\s)?gk-tt(?:\s[^"]*)?"/.test(m[0]));
function showRules(html, t) {
  const key = (String(html ?? "").match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
  if (!key || !t) return [];
  const K = `.gk-${key}`.repeat(3), out = [];
  if (t.hideTitle && !titleInPress(html)) out.push(`${K} .gk-tt,${K} .gk-ul{display:none}`);
  if (t.hideNames) out.push(`${K} p.gk-nm{display:none}`);
  return out;
}
const PAIR_G = /<p class="gk-nm gk-n([A-Z])">[^<]*<\/p>\s*<p class="gk-dl"[^>]*><span class="gk-d gk-d[A-Z]">(?:(?!<\/p>)[\s\S])*?<\/span><\/p>/g;
function applyLines(html, n) {
  const text = String(html ?? ""), k = Number(n);
  if (!Number.isInteger(k) || !k) return text;
  const at = text.indexOf("</style>"), pairs = [...text.matchAll(PAIR_G)].filter((m) => m.index > at);
  if (pairs.length < 2) return text;
  const last = pairs.at(-1), end = last.index + last[0].length;
  if (k < 0) {
    const cut = Math.max(-k, 0), keep = pairs.length - cut;
    if (keep < 1) return text;
    const from = pairs[keep].index;
    return text.slice(0, from).replace(/\s*$/, "") + text.slice(end);
  }
  const gap = (text.slice(pairs.at(-2).index + pairs.at(-2)[0].length, last.index).match(/^\s*/) || [""])[0] || "\n";
  let add = "";
  for (let i = 0; i < k; i++) add += `${gap.includes("\n") ? "\n" : gap}${pairs[pairs.length - 2 + i % 2][0]}`;
  return text.slice(0, end) + add + text.slice(end);
}
const SPOILER_LOOK = { line: "transparent", raised: "rgba(127,127,127,.16)", muted: "#8b8e96" };
const spoilerOf = (inner) => spoilerHtml(inner, SPOILER_LOOK, false).replace("color:#8b8e96;", "color:#8b8e96;-webkit-text-fill-color:#8b8e96;");
const SPOILER_RULES = spoilerStyle().replace(/^<style>|<\/style>$/g, "");
const escAttr = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
function applySpoilers(html, list) {
  let text = String(html ?? "");
  if (!Array.isArray(list) || !list.length) return text;
  const cells = editables(text), spans = [];
  for (const sp of list) {
    const cell = cells[sp.i];
    if (!cell || !["gk-nr", "gk-d"].includes(cell.cls)) continue;
    const open = text.lastIndexOf("<p", cell.start);
    if (open < 0) continue;
    const inner = text.indexOf(">", open) + 1, close = text.indexOf("</p>", cell.end);
    if (!inner || close < 0) continue;
    if (!spans.some((x) => x.start === inner)) spans.push({ start: inner, end: close });
  }
  if (!spans.length) return text;
  spans.sort((x, y) => y.start - x.start);
  for (const x of spans) text = text.slice(0, x.start) + spoilerOf(text.slice(x.start, x.end)) + text.slice(x.end);
  if (!text.includes(".blsp-s>summary{")) {
    const at = text.indexOf("\n</style>");
    if (at >= 0) text = `${text.slice(0, at)}
${SPOILER_RULES}${text.slice(at)}`;
  }
  return unparagraphHtml(text);
}
const spoilersOf = (tune, { mine = false } = {}) => {
  const t = cleanTune(tune);
  return t && (mine ? t.mineSpoilers : t.spoilers) || null;
};
function applyTune(html, tune, { mine = false, nospoil = false } = {}) {
  const t = cleanTune(tune);
  let text = String(html ?? "");
  if (!t) return text;
  if (!mine && t.lines) text = applyLines(text, t.lines);
  if (t.vals) text = applyVals(text, t.vals);
  const rules = [...inkRules(text, t.inks), ...showRules(text, t)];
  if (rules.length) {
    const at = text.indexOf("\n</style>");
    if (at >= 0) text = `${text.slice(0, at)}
${rules.join("\n")}${text.slice(at)}`;
  }
  const texted = applyTexts(text, mine ? t.mineTexts : t.texts);
  return nospoil ? texted : applySpoilers(texted, mine ? t.mineSpoilers : t.spoilers);
}
const cleanMotion = (v) => {
  const L = (x) => ["0", "s", "l"].includes(x) ? x : "m";
  const o = { text: L(v?.text), prop: L(v?.prop), speed: ["s", "l"].includes(v?.speed) ? v.speed : "m", open: v?.open === true };
  return o;
};
const cleanName = (s) => String(s ?? "").replace(/[<>"'`]/g, "").trim().slice(0, 24);
const cleanMine = (x) => {
  if (!x || typeof x !== "object" || typeof x.frame !== "string" || !/^[a-z0-9-]{1,40}$/.test(x.frame)) return null;
  const name = cleanName(x.name);
  if (!name) return null;
  const tone = x.tone && typeof x.tone === "object" ? x.tone : {};
  const hex = (v) => HEX.test(v || "") ? v.toLowerCase() : null;
  return {
    id: /^[a-z0-9]{4,16}$/.test(x.id || "") ? x.id : Math.random().toString(36).slice(2, 10),
    frame: x.frame,
    frameName: cleanName(x.frameName),
    name,
    tone: { on: tone.on === true, k: hex(tone.k), name: cleanName(tone.name), k2: hex(tone.k2), name2: cleanName(tone.name2), ...hex(tone.k3) ? { k3: hex(tone.k3), name3: cleanName(tone.name3) } : {}, mode: tone.mode === "light" ? "light" : "dark", none: tone.none === true },
    tune: cleanTune(x.tune),
    ...x.look !== void 0 ? { look: cleanLook(x.look) } : {},
    ...x.shape !== void 0 ? { shape: cleanShape(x.shape) } : {},
    ...x.motion && typeof x.motion === "object" ? { motion: cleanMotion(x.motion) } : {},
    ...x.tone?.auto === true ? { auto: true } : {},
    at: Number(x.at) || 0
  };
};
function mineList() {
  const list = read("local", MINE_KEY, []);
  return Array.isArray(list) ? list.map(cleanMine).filter(Boolean).slice(0, 60) : [];
}
function saveMine({ frame, frameName, name, tone, tune, look, shape, motion }) {
  const row = cleanMine({ frame, frameName, name, tone, tune, look, shape, motion, at: Date.now() });
  if (!row) return null;
  const list = mineList().filter((x) => !(x.frame === row.frame && x.name === row.name));
  list.unshift(row);
  write("local", MINE_KEY, list.slice(0, 60));
  return row;
}
function forgetMine(id) {
  write("local", MINE_KEY, mineList().filter((x) => x.id !== id));
}
const SET_MARK = "bl-mart-set";
function setsFile(rows) {
  const sets = (rows || []).map(cleanMine).filter(Boolean).map(({ id, at, ...rest }) => rest);
  return `${JSON.stringify({ [SET_MARK]: 1, sets }, null, 1)}
`;
}
function readSets(text) {
  let v = null;
  try {
    v = JSON.parse(String(text ?? "").replace(/^﻿/, ""));
  } catch {
    return [];
  }
  const list = v && typeof v === "object" && v[SET_MARK] === 1 && Array.isArray(v.sets) ? v.sets : v && typeof v === "object" && typeof v.frame === "string" ? [v] : [];
  return list.slice(0, 60).map((x) => cleanMine({ ...x, id: "" })).filter(Boolean);
}
function addSets(rows) {
  const out = [];
  for (const r of [...rows || []].reverse()) {
    const row = saveMine(r);
    if (row) out.unshift(row);
  }
  return out;
}
export {
  EDIT_CLASSES,
  EDIT_TAGS,
  LINES_RANGE,
  MINE_KEY,
  RICH_TAGS,
  SET_MARK,
  SPOILER_LABEL,
  TUNE_KEY,
  TUNE_ROLES,
  addSets,
  applyLines,
  applySpoilers,
  applyTexts,
  applyTune,
  cleanRich,
  cleanTune,
  dropMineEdits,
  editables,
  forgetMine,
  inkRules,
  mineList,
  readSets,
  saveMine,
  setTune,
  setsFile,
  showRules,
  spoilersOf,
  titleInPress,
  tuneOf,
  tuneRev
};
