// 생성물 — 글꾸 마트 mart/geulkku-set.js 사본(마트 97a96f7a · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { cleanLook, importPreset, codeBytes } from "./look.js";
import { cleanTune, readSets } from "./tune.js";
import { cleanTex } from "./texture.js";
import { cleanShape } from "./shape.js";
const SET_V = 2;
const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v) => HEX.test(v || "") ? v.toLowerCase() : null;
const name = (s) => String(s ?? "").replace(/[<>"'`]/g, "").trim().slice(0, 24);
const lv = (v) => v === "0" || v === "s" || v === "l" ? v : "m";
const sp = (v) => v === "s" || v === "l" ? v : "m";
const frameKeyOf = (id) => (String(id || "").match(/(?:^|-)((?:k|q)\d+)$/) || [])[1] || "";
function makeSet({ tone = {}, look = null, motion = null, tex = null, shape = null, tune = null, frame = "", label = "" } = {}) {
  const out = { blGeulkku: SET_V, from: "mart" };
  if (name(label)) out.name = name(label);
  const style = {}, cast = {};
  if (tone.on) cast.main = hex(tone.k) ? { name: name(tone.name), color: hex(tone.k) } : { none: true };
  if (hex(tone.k2)) cast.other = { name: name(tone.name2), color: hex(tone.k2) };
  if (hex(tone.k3)) cast.third = { name: name(tone.name3), color: hex(tone.k3) };
  if (tone.cover === false) cast.cover = false;
  if (Object.keys(cast).length) style.cast = cast;
  if (tone.auto === true) style.mode = "auto";
  else if (tone.mode === "light" || tone.mode === "dark") style.mode = tone.mode;
  const L = cleanLook(look);
  if (L) {
    const { lemon, ...rest } = L;
    if (Object.keys(rest).length) style.look = rest;
    if (lemon?.off) style.show = { lemon: false };
  }
  if (motion && (lv(motion.text) !== "m" || lv(motion.prop) !== "m" || sp(motion.speed) !== "m" || motion.open === true)) style.motion = { text: lv(motion.text), prop: lv(motion.prop), ...sp(motion.speed) !== "m" ? { speed: sp(motion.speed) } : {}, ...motion.open === true ? { open: true } : {} };
  const S = cleanShape(shape) || {}, shp = {};
  if (S.bandAlpha != null || S.borderAlpha != null) style.colors = { ...S.bandAlpha != null ? { bandAlpha: S.bandAlpha } : {}, ...S.borderAlpha != null ? { borderAlpha: S.borderAlpha } : {} };
  for (const k of ["radius", "pad", "width", "nameTag", "nameAlign"]) if (S[k] != null) shp[k] = S[k];
  if (S.noBorder) shp.border = false;
  if (S.hideUl) style.show = { ...style.show || {}, underline: false };
  if (S.hideProp) style.prop = { show: false };
  const tx = cleanTex(tex);
  if (tx) shp.texture = tx;
  if (Object.keys(shp).length) style.shape = shp;
  if (Object.keys(style).length) out.style = style;
  const key = frameKeyOf(frame);
  if (key) {
    out.frame = key;
    const t = cleanTune(tune) || {}, f = {};
    if (t.vals) f.vals = t.vals;
    if (t.lines) f.lines = t.lines;
    if (t.texts) f.texts = t.texts;
    if (t.spoilers) f.spoilers = t.spoilers;
    if (t.inks) f.colors = t.inks;
    if (t.prop || t.own === true || t.own === false) f.prop = { ...t.own === true ? { tone: "own" } : t.own === false ? { tone: "cast" } : {}, ...t.prop ? { tone: "pick", color: t.prop } : {} };
    if (t.hideTitle || t.hideNames) f.show = { ...t.hideTitle ? { title: false } : {}, ...t.hideNames ? { names: false } : {} };
    if (Object.keys(f).length) out.frames = { [key]: f };
  }
  return out;
}
const SET_EXT = ".bl-geulkku.json";
const B64 = {
  enc: (bytes) => {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec: (t) => {
    const s = String(t).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(s + "=".repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));
  }
};
const flow = async (bytes, Kind) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Kind("deflate-raw"))).arrayBuffer());
async function encodeSet(set) {
  const json = new TextEncoder().encode(JSON.stringify(set));
  try {
    if (globalThis.CompressionStream) return `BLG1.${B64.enc(await flow(json, CompressionStream))}`;
  } catch {
  }
  return `BLG0.${B64.enc(json)}`;
}
async function decodeCode(text) {
  const m = String(text ?? "").replace(/\s+/g, "").match(/^BLG([01])\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const bytes = B64.dec(m[2]);
    return JSON.parse(new TextDecoder().decode(m[1] === "1" ? await flow(bytes, DecompressionStream) : bytes));
  } catch {
    return null;
  }
}
function setFile(sets) {
  const list = (Array.isArray(sets) ? sets : [sets]).filter(Boolean);
  return `${JSON.stringify(list.length === 1 ? list[0] : { blGeulkku: SET_V, sets: list }, null, 1)}
`;
}
function upgrade(v) {
  if (!v || typeof v !== "object") return null;
  if (v.blGeulkku === SET_V) return Array.isArray(v.sets) ? v.sets.find((x) => x?.blGeulkku === SET_V) || null : v;
  if (v["bl-mart"] === 1 && Array.isArray(v.items)) {
    const it = v.items.find((x) => x?.set?.blGeulkku === SET_V);
    return it ? it.set : null;
  }
  if (v["bl-mart-set"] === 1 || typeof v.frame === "string" && v.tone) {
    const r = readSets(JSON.stringify(v))[0];
    if (!r) return null;
    return makeSet({ tone: { ...r.tone, ...r.auto ? { auto: true } : {} }, look: r.look, motion: r.motion, shape: r.shape, tune: r.tune, frame: r.frame, label: r.name });
  }
  return null;
}
const fromPreset = (p) => makeSet({ tone: { ...p.tone, on: p.tone.on || p.tone.none }, look: p.look, shape: p.shape, label: p.name });
async function readAny(text) {
  const t = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!t) return null;
  if (/^BLG[01]\./.test(t)) {
    const set2 = upgrade(await decodeCode(t));
    return set2 ? { set: set2, from: "code" } : null;
  }
  if (/^BL[SM][01]\./.test(t)) {
    let json = null;
    if (/^BLS1\./.test(t)) {
      try {
        json = new TextDecoder().decode(await flow(codeBytes(t), DecompressionStream));
      } catch {
        return null;
      }
    }
    const got2 = importPreset(t, json ? { json } : {});
    return got2 ? { set: fromPreset(got2.preset), from: got2.from === "theme" ? "theme" : "old" } : null;
  }
  let v = null;
  try {
    v = JSON.parse(t);
  } catch {
    return null;
  }
  const set = upgrade(v);
  if (set) return { set, from: v.blGeulkku === SET_V ? "file" : "old" };
  const got = importPreset(t);
  return got ? { set: fromPreset(got.preset), from: got.from === "theme" ? "theme" : "old" } : null;
}
function readSet(raw) {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v.replace(/^﻿/, ""));
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v.sets)) v = v.sets[0];
  if (!v || v.blGeulkku !== SET_V) return null;
  const s = v.style && typeof v.style === "object" ? v.style : {}, c = s.cast || {};
  const tone = { mode: s.mode === "auto" ? "auto" : s.mode === "light" ? "light" : "dark", auto: s.mode === "auto", cover: c.cover !== false };
  if (c.main?.none) Object.assign(tone, { on: true, k: null, name: "" });
  else if (hex(c.main?.color)) Object.assign(tone, { on: true, k: hex(c.main.color), name: name(c.main.name) });
  else tone.on = false;
  tone.k2 = hex(c.other?.color);
  tone.name2 = tone.k2 ? name(c.other.name) : "";
  tone.k3 = hex(c.third?.color);
  tone.name3 = tone.k3 ? name(c.third.name) : "";
  const look = cleanLook({ ...s.look || {}, ...s.show?.lemon === false ? { lemon: { off: true } } : {} });
  const motion = { text: lv(s.motion?.text), prop: lv(s.motion?.prop), speed: sp(s.motion?.speed), open: s.motion?.open === true }, tex = cleanTex(s.shape?.texture);
  const sh = s.shape || {}, shape = cleanShape({ bandAlpha: s.colors?.bandAlpha, borderAlpha: s.colors?.borderAlpha, radius: sh.radius, pad: sh.pad, width: sh.width, nameTag: sh.nameTag, nameAlign: sh.nameAlign, noBorder: sh.border === false, hideUl: s.show?.underline === false, hideProp: s.prop?.show === false });
  const frame = frameKeyOf(v.frame), f = frame && v.frames?.[frame] || {};
  const tune = cleanTune({ vals: f.vals, lines: f.lines, texts: f.texts, spoilers: f.spoilers, inks: f.colors, prop: f.prop?.tone === "pick" ? f.prop.color : void 0, own: f.prop?.tone === "own" ? true : f.prop?.tone === "cast" ? false : void 0, hideTitle: f.show?.title === false, hideNames: f.show?.names === false });
  return { tone, look, motion, tex, shape, frame, tune, name: name(v.name) };
}
export {
  SET_EXT,
  SET_V,
  decodeCode,
  encodeSet,
  makeSet,
  readAny,
  readSet,
  setFile,
  upgrade
};
