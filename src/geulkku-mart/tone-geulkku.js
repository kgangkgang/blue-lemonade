// 생성물 — 글꾸 마트 mart/tone-geulkku.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { tone, fitInk, bandColor, oklchOf, oklchHex, over, speakerColor, INK_TARGET } from "./lib/log-copy/shared/char-tone.js";
import { parseColor, contrast } from "./lib/log-copy/shared/ink-paint.js";
import { pasteReady } from "./lib/log-copy/log-copy-lift.js";
const FRAME_WIDTH = 640;
const PAPER_COLORS = Object.freeze({
  white: { label: "흰색", light: ["#ffffff", "#f5f5f6"], dark: ["#25272b", "#1c1e21"] },
  ivory: { label: "미색", light: ["#fffdf6", "#f8f4e8"], dark: ["#2a2822", "#201f1a"] },
  gray: { label: "연회색", light: ["#f7f7f8", "#eeeef0"], dark: ["#2a2b2e", "#202124"] },
  sky: { label: "연하늘", light: ["#f6fafe", "#ecf3fa"], dark: ["#222833", "#1a1f28"] },
  pink: { label: "연분홍", light: ["#fef7f9", "#f9ecf0"], dark: ["#2d2329", "#231b20"] },
  mint: { label: "연민트", light: ["#f5fbf8", "#eaf5ef"], dark: ["#212b27", "#1a221f"] },
  lavender: { label: "연라벤더", light: ["#f9f7fe", "#f0ecf9"], dark: ["#26232f", "#1e1b26"] },
  lemon: { label: "연레몬", light: ["#fffdf0", "#f8f4dc"], dark: ["#2a2920", "#212019"] },
  apricot: { label: "연살구", light: ["#fff8f3", "#f8ece3"], dark: ["#2c2521", "#221d1a"] },
  kraft: { label: "크라프트", light: ["#f6efe4", "#ece2d2"], dark: ["#2c2720", "#221e19"] }
});
const TEXTURES = Object.freeze({
  plain: { label: "민무늬" },
  grid: { label: "모눈", hidden: true, css: (L) => `background-image:linear-gradient(${L} 1px,transparent 1px),linear-gradient(90deg,${L} 1px,transparent 1px);background-size:16px 16px` },
  lined: { label: "줄 노트", css: (L) => `background-image:repeating-linear-gradient(transparent 0 25px,${L} 25px 26px)` },
  dot: { label: "도트", css: (L) => `background-image:radial-gradient(${L} 1.1px,transparent 1.4px);background-size:14px 14px` },
  manuscript: { label: "원고지", hidden: true, css: (L) => `background-image:linear-gradient(${L} 1px,transparent 1px),linear-gradient(90deg,${L} 1px,transparent 1px);background-size:24px 24px;background-position:-1px -1px` },
  section: { label: "방안지", hidden: true, css: (L) => `background-image:linear-gradient(${L} 1px,transparent 1px),linear-gradient(90deg,${L} 1px,transparent 1px),linear-gradient(${L} 1px,transparent 1px),linear-gradient(90deg,${L} 1px,transparent 1px);background-size:40px 40px,40px 40px,8px 8px,8px 8px` }
});
const TEXTURE_LINE = { light: "rgba(30, 32, 48, 0.08)", dark: "rgba(255, 255, 255, 0.06)" };
function addTexture(html, t, mode, texture) {
  const tx = TEXTURES[texture];
  if (!tx?.css) return html;
  const cls = `blp-${texture}${mode === "light" ? "" : "-d"}`;
  const rule = `.${cls}{${tx.css(TEXTURE_LINE[mode === "light" ? "light" : "dark"])}}`;
  const surf = new RegExp(`background-color\\s*:\\s*(?:${t.card}|${t.log})(?=[;"]|$)`, "i");
  let n = 0;
  const out = html.replace(/<style>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (all, tag, attrs) => {
    if (!tag) return all;
    const m = attrs.match(/\sstyle="([^"]*)"/);
    if (!m || !surf.test(m[1]) || /background-image/i.test(m[1])) return all;
    n++;
    return /\sclass="/.test(attrs) ? all.replace(/\sclass="/, ` class="${cls} `) : `<${tag} class="${cls}"${attrs}>`;
  });
  if (!n) return html;
  return /<style>/.test(out) ? out.replace(/<style>/, `<style>${rule}`) : `<style>${rule}</style>${out}`;
}
const isC = (plan) => plan === "C" || plan === "P";
const TEXT_TARGET = 4.8;
const NEAR_GREY = 0.035;
const NEAR_BG = 0.16;
const QUOTE = /^[\s​]*(?:<[^>]+>\s*)*["“「『‘'«〈《]/;
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
const hexOf = (c) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
const lightOf = (value) => {
  const c = parseColor(value);
  return c ? oklchOf(hexOf(c)).l : null;
};
function sourceInks(html, roles) {
  const bg = roles?.panel || roles?.surface || roles?.face || roles?.bg;
  const text = roles?.text || roles?.faceText;
  if (bg && text) return { bg, text };
  const count = (re) => {
    const m = /* @__PURE__ */ new Map();
    for (const x of html.matchAll(re)) {
      const c = parseColor(x[1]);
      if (c && c.a > 0.9) {
        const h = hexOf(c);
        m.set(h, (m.get(h) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  return { bg: bg || count(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi) || "#ffffff", text: text || count(/(?:^|[;"\s])color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi) || "#222222" };
}
function toneMap(roles, K, { mode = "dark", plan = "B", html = "", paper = "white" } = {}) {
  const t0 = tone(K, { mode, plan: isC(plan) ? "C" : plan });
  const kk = speakerColor(K), ok0 = kk ? oklchOf(kk) : null;
  const pc = PAPER_COLORS[paper] && paper !== "white" && !isC(plan) ? PAPER_COLORS[paper][mode === "light" ? "light" : "dark"] : null;
  const t = pc ? { ...t0, card: pc[0], log: pc[1] } : plan !== "P" || !ok0 ? t0 : mode === "dark" ? { ...t0, card: oklchHex(0.34, Math.min(ok0.c * 0.5, 0.08), ok0.h) } : { ...t0, card: oklchHex(0.925, Math.min(ok0.c * 0.4, 0.07), ok0.h), log: oklchHex(0.988, Math.min(ok0.c * 0.08, 0.01), ok0.h) };
  const k = speakerColor(K), ko = k ? oklchOf(k) : null;
  const src = sourceInks(html, roles);
  const Lb = lightOf(src.bg) ?? 1, Lt = lightOf(src.text) ?? 0.2;
  const Lcard = oklchOf(t.card).l, Llog = oklchOf(t.log).l, Ltext = oklchOf(t.text).l;
  const span = Math.abs(Lt - Lb) < 0.2 ? Lt < Lb ? -0.6 : 0.6 : Lt - Lb;
  const shift = (value) => {
    const c = parseColor(value);
    if (!c) return null;
    const o = oklchOf(hexOf(c));
    const s = Math.max(-0.35, Math.min(1.35, (o.l - Lb) / span));
    const L = Math.max(0, Math.min(1, Lcard + s * (Ltext - Lcard)));
    let C = 0, H = o.h;
    if (o.c >= NEAR_GREY && Math.abs(s) > NEAR_BG) {
      if (isC(plan) && ko) {
        C = Math.min(o.c, ko.c);
        H = ko.h;
      } else if (ko && ko.c >= NEAR_GREY) {
        C = Math.min(o.c, ko.c);
        H = ko.h;
      }
    } else if (isC(plan) && ko) {
      C = Math.min(o.c * 0.3, ko.c * 0.3, 0.03);
      H = ko.h;
    }
    return { hex: oklchHex(L, C, H), a: c.a };
  };
  const pick = (value) => {
    const s = shift(value);
    return s?.hex ?? value;
  };
  const out = {};
  const face = isC(plan) ? t.card : Lb > 0.5 === (mode === "light") ? t.card : t.card;
  const panelOf = (name) => roles?.[name] ? pick(roles[name]) : t.log;
  const surface = { bg: t.card, face: t.card, panel: t.log, panel2: panelOf("panel2"), surface: t.log, raised: panelOf("raised"), chip: panelOf("chip") };
  const ink = (c, ...bgs) => bgs.reduce((x, b) => fitInk(x, b) ?? x, c);
  const accentInk = k ? ink(k, t.log, t.card) : t.text;
  const textInk = t.text;
  let dialogueInk = k ? ink(k, t.log, t.card) : t.dialogue;
  const bar = k ? oklchHex(Math.min(Math.max(ko.l, mode === "dark" ? 0.6 : 0.5), mode === "dark" ? 0.8 : 0.66), ko.c, ko.h) : mode === "dark" ? "#5c5e64" : "#b8b9be";
  const roleNew = {
    bg: surface.bg,
    face: surface.face,
    panel: surface.panel,
    panel2: surface.panel2,
    surface: surface.surface,
    raised: surface.raised,
    chip: surface.chip,
    text: textInk,
    faceText: textInk,
    thought: textInk,
    emphasis: textInk,
    chipText: null,
    faceMuted: null,
    muted: null,
    faint: null,
    name: accentInk,
    accent: accentInk,
    pop: accentInk,
    dialogue: dialogueInk,
    quoteBar: bar,
    deco1: bar,
    deco2: null,
    deco3: null,
    mark: over(bandColor(k, mode), t.log),
    marker: bandColor(k, mode),
    line: t.line,
    onAccent: null
  };
  for (const [name, value] of Object.entries(roles ?? {})) {
    if (typeof value !== "string") continue;
    let v = roleNew[name];
    if (v == null) {
      if (name === "faceMuted" || name === "muted" || name === "faint") v = ink(pick(value), t.log, t.card);
      else if (name === "chipText") v = ink(textInk, surface.chip);
      else if (name === "onAccent") v = contrast("#ffffff", accentInk) >= contrast("#111113", accentInk) ? "#ffffff" : "#111113";
      else v = pick(value);
    }
    out[name] = v;
  }
  if (out.dialogue && out.name && out.dialogue === out.name) {
    const c = parseColor(out.dialogue);
    out.dialogue = hexOf({ r: c.r, g: c.g, b: c.b ^ 1 });
    dialogueInk = out.dialogue;
  }
  const exact = /* @__PURE__ */ new Map();
  const order = ["bg", "face", "panel", "surface", "panel2", "raised", "chip", "text", "faceText", "dialogue", "name", "accent", "pop", "faceMuted", "muted", "faint", "thought", "emphasis", "chipText", "quoteBar", "deco1", "deco2", "deco3", "mark", "marker", "line", "onAccent"];
  for (const name of order) {
    const from = roles?.[name];
    if (typeof from !== "string" || !out[name]) continue;
    const c = parseColor(from);
    if (!c) continue;
    const key = `${hexOf(c)}|${c.a.toFixed(3)}`;
    if (!exact.has(key)) exact.set(key, out[name]);
  }
  const dialogueFrom = roles?.dialogue ? hexOf(parseColor(roles.dialogue)) : null;
  return { t, K: k, mode, plan, roles: out, exact, shift, dialogueFrom, dialogueInk, accentInk, textInk };
}
const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d[^)]*\)/g;
const SVG_HEX = /%23([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const fmt = (hex, a) => a >= 0.999 ? hex : `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${Math.round(a * 1e3) / 1e3})`;
function mapColor(map, value) {
  const c = parseColor(value);
  if (!c) return value;
  const key = `${hexOf(c)}|${c.a.toFixed(3)}`;
  const hit = map.exact.get(key);
  if (hit) {
    const h = parseColor(hit);
    return h.a < 0.999 ? hit : fmt(hexOf(h), c.a);
  }
  const solid = map.exact.get(`${hexOf(c)}|1.000`);
  if (solid && c.a < 0.999) {
    const h = parseColor(solid);
    return fmt(hexOf(h), c.a);
  }
  const s = map.shift(value);
  return s ? fmt(s.hex, c.a) : value;
}
function toneStyle(map, css, ctxBg) {
  const decls = css.split(/;(?![^(]*\))/);
  let bgHere = null;
  const outDecls = decls.map((d) => {
    const at = d.indexOf(":");
    if (at < 0) return d;
    const prop = d.slice(0, at).trim().toLowerCase();
    let val = d.slice(at + 1);
    if (/url\(/i.test(val)) {
      val = val.replace(SVG_HEX, (all, h) => {
        const m = mapColor(map, `#${h}`);
        const p = parseColor(m);
        return p ? `%23${hexOf(p).slice(1)}` : all;
      });
      val = val.replace(/(url\([^)]*\))|#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d[^)]*\)/g, (m, u) => u ? u : mapColor(map, m));
    } else val = val.replace(COLOR_RE, (m) => mapColor(map, m));
    return `${d.slice(0, at)}:${val}`;
  });
  const info = {};
  bgHere = bgOfStyle(outDecls.join(";"), ctxBg[0], info);
  if (bgHere && !info.grad && Math.max(contrast("#111113", bgHere), contrast("#f5f5f7", bgHere)) < TEXT_TARGET + 0.2) {
    const next = contrast("#111113", bgHere) >= contrast("#f5f5f7", bgHere) ? fitInk(bgHere, "#111113", TEXT_TARGET + 0.2) : fitInk(bgHere, "#f5f5f7", TEXT_TARGET + 0.2);
    if (next && next !== bgHere) {
      const from = bgHere;
      for (let i = 0; i < outDecls.length; i++) if (/^\s*background(?:-color)?\s*:/i.test(outDecls[i])) outDecls[i] = outDecls[i].replace(COLOR_RE, (m) => {
        const c = parseColor(m);
        return c && (hexOf(c) === from || c.a < 0.85 && over(m, ctxBg[0]) === from) ? next : m;
      });
      bgHere = next;
    }
  }
  return outDecls.map((d) => {
    const at = d.indexOf(":");
    if (at < 0) return d;
    const prop = d.slice(0, at).trim().toLowerCase();
    if (prop !== "color" && prop !== "-webkit-text-fill-color") return d;
    const c = parseColor(d.slice(at + 1).trim());
    if (!c || c.a < 0.5) return d;
    const bgs = bgHere ? [bgHere] : ctxBg;
    let h = hexOf(c);
    for (const b of bgs) h = fitInk(h, b, TEXT_TARGET) ?? h;
    if (bgs.some((b) => contrast(h, b) < TEXT_TARGET)) h = ["#111113", "#f5f5f7"].sort((x, y) => Math.min(...bgs.map((b) => contrast(y, b))) - Math.min(...bgs.map((b) => contrast(x, b))))[0];
    return `${d.slice(0, at)}:${h}`;
  }).join(";");
}
const VOID = /* @__PURE__ */ new Set(["br", "img", "hr", "input", "meta", "wbr", "source", "col", "area", "base", "link", "track", "embed", "param"]);
function bgOfStyle(css, under = null, info = {}) {
  const m = css.match(/(?:^|;)\s*background(?:-color|-image)?\s*:\s*([^;]+)/gi);
  if (!m) return null;
  let solid = null, grad = null;
  const solidOf = (text) => {
    const c = parseColor(text);
    if (!c) return null;
    if (c.a > 0.85) return hexOf(c);
    return c.a >= 0.3 && under ? over(text, under) : null;
  };
  for (const d of m) {
    const prop = d.slice(0, d.indexOf(":")).replace(/^[;\s]+/, "").toLowerCase(), v = d.slice(d.indexOf(":") + 1);
    if (prop === "background-color") {
      const s = solidOf(v.trim());
      if (s) solid = s;
      continue;
    }
    if (/url\(/i.test(v) && !/gradient/i.test(v)) continue;
    if (prop === "background" && !/gradient/i.test(v)) {
      const t0 = (v.trim().match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/) || [])[1];
      const s = t0 && solidOf(t0);
      if (s) {
        solid = s;
        grad = null;
      }
      continue;
    }
    if (/transparent|rgba\([^)]*,\s*0(?:\.\d+)?\)/i.test(v)) continue;
    const cs = (v.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || []).map(parseColor).filter((c) => c && c.a > 0.85);
    if (cs.length) grad = hexOf({ r: cs.reduce((s, c) => s + c.r, 0) / cs.length, g: cs.reduce((s, c) => s + c.g, 0) / cs.length, b: cs.reduce((s, c) => s + c.b, 0) / cs.length });
  }
  info.grad = !!grad;
  return grad || solid;
}
function walkStyles(html, fn, base = null) {
  const stack = [];
  return html.replace(/<style>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (all, close, open, attrs) => {
    if (close) {
      const name2 = close.toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === name2) {
        stack.length = i;
        break;
      }
      return all;
    }
    if (!open) return all;
    const name = open.toLowerCase();
    let bg = null;
    const next = attrs.replace(/(\sstyle=")([^"]*)(")/i, (x, a, css, b) => {
      const plain = css.replace(/&quot;/g, '"');
      const bgs = stack.map((s) => s.bg).filter(Boolean);
      const out = fn(plain, bgs);
      bg = bgOfStyle(out, bgs[bgs.length - 1] || base);
      return a + out.replace(/"/g, "&quot;") + b;
    });
    if (!VOID.has(name) && !/\/\s*$/.test(attrs)) stack.push({ tag: name, bg });
    return `<${open}${next}>`;
  });
}
function bandify(map, html) {
  const band = (who) => {
    const c = bandColor(who, map.mode);
    return `background-image:linear-gradient(transparent 5%, ${c} 5%, ${c} 100%, transparent 100%)`;
  };
  return html.replace(/<(span|q|em|i|b|strong)\b([^>]*?)\sstyle="([^"]*)"([^>]*)>/gi, (all, tagName, pre, css, post, offset, whole) => {
    const m = css.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (!m) return all;
    const c = parseColor(m[1].trim());
    if (!c) return all;
    const h = hexOf(c);
    const sameInk = () => {
      if (!map.dialogueInk) return false;
      const a = oklchOf(h), b = oklchOf(map.dialogueInk);
      if (b.c < 4e-3) return false;
      const d = Math.abs(a.h - b.h) % 360;
      return Math.abs(a.c - b.c) < Math.max(4e-3, b.c * 0.25) && Math.min(d, 360 - d) < 4;
    };
    const own = map.dialogueFrom && h === map.dialogueFrom || h === map.dialogueInk || sameInk();
    const lead = whole.slice(offset + all.length, offset + all.length + 40);
    const quoted = QUOTE.test(lead) || /^\s*(?:&quot;|&#39;|&#x27;)/.test(lead);
    if (!quoted || !(own || oklchOf(h).c >= 0.06) || /background-image\s*:\s*linear-gradient/i.test(css)) return all;
    const who = own ? map.K : h;
    const next = css.replace(/(^|;)\s*color\s*:\s*[^;]+/i, `$1color:${map.t.dialogue}`).replace(/(^|;)\s*-webkit-text-fill-color\s*:\s*[^;]+/i, `$1-webkit-text-fill-color:${map.t.dialogue}`).replace(/;?\s*$/, "") + `;${band(who)}`;
    return `<${tagName}${pre} style="${next}"${post}>`;
  });
}
function calmHtml(html, { keep = 1 } = {}) {
  const src = String(html ?? "");
  const re = /<style>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  const px = (css, k) => {
    const x = css.match(new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*(-?[\\d.]+)px`, "i"));
    return x ? Number(x[1]) : null;
  };
  const cands = [], stack = [];
  let m;
  while (m = re.exec(src)) {
    const [all, close, open, attrs] = m;
    if (close) {
      const name2 = close.toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === name2) {
        const top = stack[i];
        stack.length = i;
        if (top.cand) {
          top.cand.end = m.index + all.length;
        }
        if (stack.length) stack[stack.length - 1].kids = (stack[stack.length - 1].kids || 0) + 1 + (top.kids || 0);
        break;
      }
      continue;
    }
    if (!open) continue;
    const name = open.toLowerCase();
    const css = ((attrs.match(/\sstyle="([^"]*)"/) || [])[1] || "").replace(/&quot;/g, '"');
    if (VOID.has(name) || /\/\s*$/.test(attrs)) {
      if (stack.length) stack[stack.length - 1].kids = (stack[stack.length - 1].kids || 0) + 1;
      continue;
    }
    const inCand = stack.some((s) => s.cand);
    let cand = null;
    if (!inCand && /\saria-hidden="true"/.test(attrs) && /position\s*:\s*absolute/i.test(css)) {
      const cover = /(?:^|;)\s*left\s*:\s*0(?:px)?\s*(?:;|$)/i.test(css) && /(?:^|;)\s*right\s*:\s*0(?:px)?\s*(?:;|$)/i.test(css) && /(?:^|;)\s*top\s*:\s*0/i.test(css) && /(?:^|;)\s*bottom\s*:\s*0/i.test(css);
      if (!cover) {
        const w = px(css, "width"), h = px(css, "height");
        cand = { start: m.index, end: -1, w, h, css, image: /url\(|class=/.test(attrs) || /url\(/.test(css), round: /border-radius\s*:\s*(50%|9{2,}px)/i.test(css) };
        cands.push(cand);
      }
    }
    stack.push({ tag: name, cand, kids: 0 });
  }
  for (const c of cands) {
    const html2 = c.end > 0 ? src.slice(c.start, c.end) : "";
    c.hasChild = /<(?:div|span|svg|img|i|b)\b/i.test(html2.slice(html2.indexOf(">") + 1));
    c.blob = !c.image && !c.hasChild && (c.round || /gradient/i.test(c.css) || (c.w ?? 0) >= 120);
    c.area = (c.w ?? 40) * (c.h ?? 40);
  }
  const pool = cands.filter((c) => c.end > 0 && !c.blob && (c.w ?? 0) <= 320 && (c.h ?? 0) <= 320);
  const keepSet = /* @__PURE__ */ new Set();
  const motif = pool.filter((c) => c.image || c.hasChild).sort((a, b) => b.area - a.area)[0];
  if (motif && keep >= 1) keepSet.add(motif);
  if (keep >= 2) {
    const small = pool.filter((c) => !keepSet.has(c) && c.area <= 64 * 64)[0];
    if (small) keepSet.add(small);
  }
  const cut = cands.filter((c) => c.end > 0 && !keepSet.has(c)).map((c) => [c.start, c.end]);
  const kept = keepSet.size;
  if (!cut.length) return { html: src, removed: 0, kept };
  cut.sort((a, b) => a[0] - b[0]);
  let out = "", at = 0;
  for (const [s, e] of cut) {
    if (s < at) continue;
    out += src.slice(at, s);
    at = e;
  }
  out += src.slice(at);
  return { html: out, removed: cut.length, kept };
}
function widen(html) {
  return html.replace(/^(\s*(?:<!--[\s\S]*?-->\s*)*(?:<style>[\s\S]*?<\/style>\s*)*(?:<!--[\s\S]*?-->\s*)*<[a-z]+\b[^>]*?style="[^"]*?)max-width\s*:\s*\d+px/i, `$1max-width:${FRAME_WIDTH}px`);
}
function toneHtml(html, roles, K, { mode = "dark", plan = "B", width = true, band = true, paper = "white", texture = "plain" } = {}) {
  const src = String(html ?? "");
  const map = toneMap(roles, K, { mode, plan, html: src, paper });
  const ctx = [map.t.card, map.t.log];
  let out = src.replace(/(<style>)([\s\S]*?)(<\/style>)/gi, (all, a, body, b) => a + body.replace(SVG_HEX, (x, h) => {
    const p = parseColor(mapColor(map, `#${h}`));
    return p ? `%23${hexOf(p).slice(1)}` : x;
  }).replace(/(url\([^)]*\))|#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d[^)]*\)/g, (m, u) => u ? u : mapColor(map, m)) + b);
  const near = (b) => ctx.some((c) => contrast(b, c) < 1.25);
  out = walkStyles(out, (css, bgs) => {
    const b = bgs[bgs.length - 1];
    return toneStyle(map, css, !b ? ctx : near(b) ? [b, ...ctx] : [b]);
  }, map.t.card);
  out = out.replace(/\s(fill|stroke|stop-color)="(#[0-9a-fA-F]{3,8})"/g, (all, a, v) => ` ${a}="${mapColor(map, v)}"`);
  if (band) out = bandify(map, out);
  if (width) out = widen(out);
  return addTexture(out, map.t, mode, texture);
}
function keepHtml(html, roles, K, { width = true, clean = true } = {}) {
  const src = String(html ?? "");
  const k = speakerColor(K);
  const bg = roles?.panel || roles?.surface || roles?.bg || sourceInks(src, roles).bg;
  const text = roles?.text || sourceInks(src, roles).text;
  const light = (lightOf(bg) ?? 1) > 0.6;
  const name = roles?.name && k ? fitInk(k, bg, TEXT_TARGET) : null;
  const nameFrom = roles?.name ? hexOf(parseColor(roles.name)) : null;
  const tidy = (value) => {
    const c = parseColor(value);
    if (!c) return value;
    const h = hexOf(c);
    if (name && h === nameFrom) return fmt(name, c.a);
    const o = oklchOf(h);
    if (clean && o.c >= 0.03 && o.c < 0.09 && o.l > 0.3 && o.l < 0.6) return fmt(oklchHex(o.l, 0.1, o.h), c.a);
    return value;
  };
  const map = { exact: /* @__PURE__ */ new Map(), shift: (v) => {
    const t = tidy(v);
    const p = parseColor(t);
    return p ? { hex: hexOf(p), a: p.a } : null;
  }, K: k, mode: light ? "light" : "dark", dialogueFrom: roles?.dialogue ? hexOf(parseColor(roles.dialogue)) : null, dialogueInk: null, t: { dialogue: text } };
  const ctx = [bg];
  let out = walkStyles(src, (css, bgs) => toneStyle(map, css, bgs.length ? [bgs[bgs.length - 1]] : ctx), bg);
  out = bandify(map, out);
  if (width) out = widen(out);
  return out;
}
function mixStops(colors) {
  const n = colors.length;
  return colors.map((color, i) => ({ color, at: Number(((i + 0.5) / n * 100).toFixed(3)) }));
}
const mixCss = (colors) => `linear-gradient(90deg, ${mixStops(colors).map((s) => `${s.color} ${s.at}%`).join(", ")})`;
function toneMixHtml(html, roles, Ks, { mode = "dark", plan = "B", paper = "white", texture = "plain" } = {}) {
  const ks = (Ks || []).map(speakerColor).filter(Boolean).slice(0, 3);
  if (ks.length < 2) return toneHtml(html, roles, ks[0] || null, { mode, plan, paper, texture });
  const maps = ks.map((k) => toneMap(roles, k, { mode, plan, html, paper }));
  let out = toneHtml(html, roles, ks[0], { mode, plan, paper, texture });
  const t = maps[0].t;
  if (isC(plan)) {
    const wash = maps.map((m) => m.t.card);
    const cardRe = new RegExp(`background-color\\s*:\\s*${t.card}(?=[;"])`, "gi");
    out = out.replace(cardRe, (m) => `${m};background-image:${mixCss(wash)}`);
  }
  const lumOf = (c) => contrast(c, "#000000");
  const level = (list) => {
    const want = lumOf(list[0]);
    return list.map((c, i) => {
      if (!i) return c;
      const o = oklchOf(c);
      let lo = 0, hi = 1;
      for (let n = 0; n < 22; n++) {
        const mid = (lo + hi) / 2;
        if (lumOf(oklchHex(mid, o.c, o.h)) < want) lo = mid;
        else hi = mid;
      }
      return oklchHex((lo + hi) / 2, o.c, o.h);
    });
  };
  const solid = (from, raw) => {
    if (!from) return;
    const list = level(raw);
    const re = new RegExp(`background-color\\s*:\\s*${from}(?=[;"])`, "gi");
    out = out.replace(re, (m) => `${m};background-image:${mixCss(list)}`);
  };
  solid(maps[0].roles.quoteBar, maps.map((m) => m.roles.quoteBar));
  solid(maps[0].accentInk, maps.map((m) => m.accentInk));
  const accents = maps.map((m) => m.accentInk);
  out = out.replace(new RegExp(`(border(?:-top|-bottom|-left|-right)?\\s*:\\s*[\\d.]+px\\s+(?:solid|double|dashed|dotted)\\s+)(#[0-9a-f]{6})(?=[;"])`, "gi"), (m, lead, hex) => {
    const o = oklchOf(hex);
    const k02 = oklchOf(maps[0].accentInk);
    return o.c >= 0.06 && Math.abs(o.h - k02.h) < 30 ? `${m};border-image:${mixCss(accents)} 1` : m;
  });
  const band0 = bandColor(ks[0], mode);
  const bands = ks.map((k) => bandColor(k, mode));
  const k0 = oklchOf(ks[0]);
  const gap = (x, y) => {
    const d = Math.abs(x - y) % 360;
    return d > 180 ? 360 - d : d;
  };
  out = out.replace(/linear-gradient\(transparent 5%, (rgba\([^)]*\)) 5%, \1 100%, transparent 100%\)/g, (m, c) => {
    if (c === band0) return mixCss(bands);
    const p = parseColor(c);
    if (!p) return m;
    const o = oklchOf(hexOf(p));
    const mine = k0.c < 0.04 ? o.c < 0.04 : o.c >= 0.04 && gap(o.h, k0.h) < 12;
    return mine ? mixCss(bands) : m;
  });
  return out;
}
const L_rgba = (hex, a) => {
  const c = parseColor(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
};
function keepMixHtml(html, roles, Ks, options = {}) {
  const ks = (Ks || []).map(speakerColor).filter(Boolean).slice(0, 3);
  const out = keepHtml(html, roles, ks[0] || null, options);
  if (ks.length < 2) return out;
  const src = String(html ?? "");
  const bg = roles?.panel || roles?.surface || roles?.bg || sourceInks(src, roles).bg;
  const mode = (lightOf(bg) ?? 1) > 0.6 ? "light" : "dark";
  const b0 = bandColor(ks[0], mode);
  return out.split(`linear-gradient(transparent 5%, ${b0} 5%, ${b0} 100%, transparent 100%)`).join(mixCss(ks.map((k) => bandColor(k, mode))));
}
const plainSample = (html) => String(html ?? "").replace(/세라피나 님/g, "상대").replace(/세라피나|Seraphina/g, "상대");
function toneItem(item, K, { mode = "dark", plan = "B", paper = "white" } = {}) {
  if (!item) return item;
  const roles = item.colors || item.palette || null;
  const map = toneMap(roles, K, { mode, plan, html: item.template || item.preview || "", paper });
  const next = { ...item, tone: { K: map.K, mode, plan } };
  if (item.colors) next.colors = { ...item.colors, ...map.roles };
  if (item.palette) next.palette = { ...item.palette, ...map.roles };
  if (item.template) next.template = toneHtml(item.template, roles, K, { mode, plan, band: false, paper });
  if (item.preview) next.preview = toneHtml(item.preview, roles, K, { mode, plan, paper });
  return next;
}
function fillInks(html) {
  return String(html ?? "").replace(/ style="([^"]*)"/g, (all, css) => {
    const m = css.match(/(?:^|;)\s*color\s*:\s*([^;"]+)/i);
    if (!m) return all;
    const value = m[1].trim().replace(/\s*!important$/i, "");
    const rest = css.replace(/;?\s*-webkit-text-fill-color\s*:[^;]*/gi, "");
    return ` style="${rest.replace(/;?\s*$/, "")};-webkit-text-fill-color:${value}"`;
  });
}
function kkangtongReady(html) {
  const text = String(html ?? "");
  if (!text.trim()) return text;
  return pasteReady(fillInks(text));
}
function dialogueColors(html) {
  const counts = /* @__PURE__ */ new Map();
  const text = String(html ?? "");
  for (const m of text.matchAll(/<(span|font|q|em|i|b|strong)\b([^>]*)>(?=([\s\S]{0,60}))/gi)) {
    const attrs = m[2];
    const css = (attrs.match(/\sstyle\s*=\s*"([^"]*)"/i) || attrs.match(/\sstyle\s*=\s*'([^']*)'/i) || [])[1] || "";
    const raw = (css.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [])[1] || (attrs.match(/\scolor\s*=\s*["']?([#a-z0-9(),.\s]+?)["'\s>]/i) || [])[1];
    if (!raw) continue;
    if (!QUOTE.test(m[3]) && !/^\s*(?:&quot;|&#39;|&ldquo;)/.test(m[3])) continue;
    const c = speakerColor(raw.trim().replace(/\s*!important$/i, ""));
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color, count]) => ({ color, count }));
}
function readyReport(html) {
  const text = String(html ?? "");
  let inlineUrl = 0, noFill = 0;
  for (const m of text.matchAll(/ style="([^"]*)"/g)) {
    if (/url\(/i.test(m[1])) inlineUrl++;
    if (/(?:^|;)\s*color\s*:/i.test(m[1]) && !/-webkit-text-fill-color/i.test(m[1])) noFill++;
  }
  return { inlineUrl, noFill, ok: inlineUrl === 0 && noFill === 0 };
}
export {
  FRAME_WIDTH,
  PAPER_COLORS,
  TEXTURES,
  calmHtml,
  dialogueColors,
  fillInks,
  keepHtml,
  keepMixHtml,
  kkangtongReady,
  mixCss,
  mixStops,
  plainSample,
  readyReport,
  speakerColor,
  tone,
  toneHtml,
  toneItem,
  toneMap,
  toneMixHtml
};
