// 생성물 — 글꾸 마트 mart/lib/log-copy/log-copy-lift.js 사본(마트 97a96f7a · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { polishHtml, SCROLL_RULE } from "./log-copy-polish.js";
const LIFT_CLASS = "blq-";
const RAW_TAGS = /* @__PURE__ */ new Set(["style", "script", "textarea", "title", "xmp"]);
const START = /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)(\s*\/?)>/y;
const ATTR = /(\s+)([^\s"'>/=]+)(?:(\s*=\s*)("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const URL_RE = /url\s*\(/i;
const ENT = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " " };
const decode = (s) => String(s).replace(/&(#\d+|#x[0-9a-f]+|quot|amp|lt|gt|apos|nbsp);/gi, (all, e) => {
  const k = e.toLowerCase();
  if (k[0] === "#") {
    const n = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(n) && n >= 0 && n <= 1114111 ? String.fromCodePoint(n) : all;
  }
  return ENT[k] ?? all;
});
const encode = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
function splitDeclarations(text) {
  const out = [];
  let depth = 0, quote = "", start = 0;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === ";" && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((d) => d.trim()).filter(Boolean).map((d) => {
    const at = d.indexOf(":");
    const prop = at > 0 ? d.slice(0, at).trim() : "";
    return prop ? { prop: prop.startsWith("--") ? prop : prop.toLowerCase(), value: d.slice(at + 1).trim() } : null;
  }).filter(Boolean);
}
function family(prop) {
  const p = String(prop).toLowerCase().replace(/^-(webkit|moz|ms|o)-/, "");
  if (p.startsWith("--")) return p;
  if (p.startsWith("border-image")) return "border-image";
  if (p.startsWith("list-style")) return "list-style";
  if (p.startsWith("mask-border")) return "mask-border";
  return p.split("-")[0];
}
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}
const tidyUrls = (value) => String(value).replace(/url\(\s*(["']?)([\s\S]*?)\1\s*\)/gi, (all, q, inner) => {
  let body = inner;
  if (/^data:image\/svg\+xml/i.test(body)) body = body.replace(/[{}<>]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return body.includes("'") ? `url("${body}")` : `url('${body}')`;
});
function liftStyle(styleText) {
  if (!URL_RE.test(styleText)) return null;
  const list = splitDeclarations(styleText);
  const fams = new Set(list.filter((d) => URL_RE.test(d.value)).map((d) => family(d.prop)));
  if (!fams.size) return null;
  const moved = list.filter((d) => fams.has(family(d.prop)));
  const rule = moved.map((d) => {
    const v = URL_RE.test(d.value) ? tidyUrls(d.value) : d.value;
    return `${d.prop}:${/!\s*important\s*$/i.test(v) ? v : `${v}!important`}`;
  }).join(";");
  if (/<\/(style|script)/i.test(rule) || /[{}<]/.test(rule.replace(/'[^']*'|"[^"]*"/g, ""))) return null;
  const keep = list.filter((d) => !URL_RE.test(d.value)).map((d) => `${d.prop}: ${d.value}`).join("; ");
  return { keep, rule };
}
function liftInlineUrls(html) {
  const source = String(html ?? "");
  if (!URL_RE.test(source)) return { html: source, css: "" };
  const rules = /* @__PURE__ */ new Map();
  const fix = (whole, name, attrs, end) => {
    if (!attrs || !/\sstyle\s*=/i.test(attrs)) return whole;
    let style = null, cls = null;
    attrs.replace(ATTR, (a, sp, key, eq, raw, dq, sq, bare) => {
      const k = key.toLowerCase();
      const v = dq ?? sq ?? bare ?? "";
      if (k === "style" && style === null) style = decode(v);
      if (k === "class" && cls === null) cls = decode(v);
      return a;
    });
    const lifted = style === null ? null : liftStyle(style);
    if (!lifted) return whole;
    const id = `${LIFT_CLASS}${hash(lifted.rule)}`;
    if (!rules.has(id)) rules.set(id, lifted.rule);
    let seenStyle = false, seenClass = false;
    let out = attrs.replace(ATTR, (a, sp, key) => {
      const k = key.toLowerCase();
      if (k === "style" && !seenStyle) {
        seenStyle = true;
        return lifted.keep ? `${sp}style="${encode(lifted.keep)}"` : "";
      }
      if (k === "class" && !seenClass) {
        seenClass = true;
        return `${sp}class="${encode(`${cls} ${id}`.trim())}"`;
      }
      return a;
    });
    if (!seenClass) out += ` class="${id}"`;
    return `<${name}${out}${end}>`;
  };
  let result = "", at = 0;
  const lower = source.toLowerCase();
  while (at < source.length) {
    const lt = source.indexOf("<", at);
    if (lt < 0) {
      result += source.slice(at);
      break;
    }
    result += source.slice(at, lt);
    if (source.startsWith("<!--", lt)) {
      const e = source.indexOf("-->", lt + 4);
      const stop = e < 0 ? source.length : e + 3;
      result += source.slice(lt, stop);
      at = stop;
      continue;
    }
    START.lastIndex = lt;
    const m = START.exec(source);
    if (!m) {
      result += "<";
      at = lt + 1;
      continue;
    }
    result += fix(m[0], m[1], m[2], m[3]);
    at = lt + m[0].length;
    const tagName = m[1].toLowerCase();
    if (RAW_TAGS.has(tagName)) {
      const close = lower.indexOf(`</${tagName}`, at);
      const stop = close < 0 ? source.length : close;
      result += source.slice(at, stop);
      at = stop;
    }
  }
  const css = [...rules].map(([id, rule]) => `.${id}.${id}.${id}{${rule}}`).join("");
  return { html: result, css };
}
function joinHead(head, css) {
  const text = String(head ?? "");
  const one = text.match(/^\s*<style>((?:(?!<\/?style)[\s\S])*)<\/style>\s*$/i);
  if (!one && text.trim()) return text + (css ? `<style>${css}</style>` : "");
  const all = (one ? one[1] : "") + (css || "");
  return all ? `<style>${all}</style>` : "";
}
function copyBody(html) {
  return liftInlineUrls(polishHtml(String(html ?? ""), { preview: false }));
}
function insertHead(html, head) {
  const text = String(html ?? "");
  if (!head) return text;
  const m = text.match(/^((?:\s*<!--[\s\S]*?-->)*\s*<(?!style\b|script\b|br\b|img\b|hr\b|input\b)[a-zA-Z][\w-]*(?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*>)/);
  return m ? m[1] + head + text.slice(m[1].length) : head + text;
}
function commentCss(width = 640) {
  const w = Number(width) > 0 ? Math.round(Number(width)) : 640;
  return `.content>p,.blq-cm{box-sizing:border-box;max-width:${w}px;margin-left:auto!important;margin-right:auto!important;padding-left:16px!important;padding-right:16px!important;text-align:left!important;text-indent:0}.blq-cm p{text-align:left!important}.content>div+p,.content>div+.blq-cm{margin-top:16px!important}.content>p+div,.content>.blq-cm+div{margin-top:16px!important}.content>div:not(.blq-cm)+p:has(>br:only-child),.content>p:has(>br:only-child):has(+div:not(.blq-cm)){display:none!important}.content>*+div:not(.blq-cm){margin-top:16px!important}.content>div:not(.blq-cm)+p:has(>br:only-child)+p,.content>div:not(.blq-cm)+p:has(>br:only-child)+.blq-cm{margin-top:16px!important}.blq-cm>p:first-child:has(>br:only-child),.blq-cm>p:last-child:has(>br:only-child){display:none!important}`;
}
const COMMENT_SLOT = "<p><br></p>";
const withCommentSlots = (html) => `${COMMENT_SLOT}${html}${COMMENT_SLOT}`;
function liftForCopy(html, motionHead = "", { comments = true, width = 640 } = {}) {
  const { html: out, css } = copyBody(html);
  const scroll = /scrollbar-width\s*:\s*none/i.test(out) ? SCROLL_RULE : "";
  const head = joinHead(motionHead, css + scroll + (comments ? commentCss(width) : ""));
  const full = insertHead(out, head);
  return { head, html: out, full: comments ? withCommentSlots(full) : full };
}
function pasteReady(html) {
  let text = String(html ?? "");
  if (!text.trim() || text.includes(".content>p,.blq-cm{")) return text;
  text = text.replace(/^\s*<p><br><\/p>/, "").replace(/<p><br><\/p>\s*$/, "");
  const lead = text.match(/^(\s*(?:<!--[\s\S]*?-->\s*)*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>\s*/i);
  const motion = lead ? `<style>${lead[2]}</style>` : "";
  const rest = lead ? lead[1] + text.slice(lead[0].length) : text;
  return liftForCopy(rest, motion).full;
}
export {
  COMMENT_SLOT,
  LIFT_CLASS,
  commentCss,
  copyBody,
  family,
  insertHead,
  joinHead,
  liftForCopy,
  liftInlineUrls,
  liftStyle,
  pasteReady,
  splitDeclarations,
  withCommentSlots
};
