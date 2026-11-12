// 생성물 — 글꾸 마트 mart/lib/log-copy/log-copy-spoiler.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
const SPOILER_LABEL = "숨겨진 글 보기";
const STYLE = ".blsp-s>summary{list-style:none}.blsp-s>summary::-webkit-details-marker{display:none}.blsp-s:not([open])>summary>.blsp-l{display:none!important}.blsp-s:not([open])>summary>.blsp-b{display:inline!important;filter:blur(5px);-webkit-user-select:none;user-select:none;transition:filter .2s}.blsp-k:not([open])>summary>.blsp-b{display:block!important}.blsp-s:not([open])>summary:hover>.blsp-b,.blsp-s:not([open])>summary:focus-visible>.blsp-b{filter:blur(3px)}.blsp-s[open]>summary{display:none!important}";
const spoilerStyle = () => `<style>${STYLE}</style>`;
const PARA_CLASS = "blsp-p";
const P_TYPE = /(^|[\s>+~(,])p(?=$|[\s>+~.:#[),])/;
const P_TYPE_ALL = new RegExp(P_TYPE.source, "g");
function splitSelectors(list) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out;
}
function paragraphTwin(css) {
  const text = String(css ?? "");
  if (text.includes(`.${PARA_CLASS}`)) return text;
  return text.replace(/([^{}]+)\{/g, (all, prelude) => {
    if (prelude.trim().startsWith("@") || !P_TYPE.test(prelude.trim())) return all;
    const lead = prelude.match(/^\s*/)[0], body = prelude.slice(lead.length).replace(/\s+$/, "");
    const twins = splitSelectors(body).map((s) => s.trim()).filter((s) => P_TYPE.test(s)).map((s) => s.replace(P_TYPE_ALL, (m, before) => `${before}.${PARA_CLASS}`));
    return twins.length ? `${lead}${body},${twins.join(",")}{` : all;
  });
}
function unparagraphHtml(html) {
  const text = String(html ?? "");
  if (!text.includes("data-bl-spoiler")) return text;
  let changed = false;
  const out = text.replace(/<p\b([^>]*)>((?:(?!<\/?p\b)[\s\S])*?)<\/p>/g, (all, attrs, inner) => {
    if (!inner.includes("data-bl-spoiler")) return all;
    changed = true;
    const cls = attrs.match(/\sclass="([^"]*)"/);
    const next = cls ? attrs.replace(cls[0], ` class="${`${cls[1]} ${PARA_CLASS}`.trim()}"`) : ` class="${PARA_CLASS}"${attrs}`;
    return `<div${next}>${inner}</div>`;
  });
  return changed ? out.replace(/(<style>)([\s\S]*?)(<\/style>)/, (all, open, css, close) => open + paragraphTwin(css) + close) : text;
}
function unparagraph(doc, details) {
  let swapped = false;
  for (let p = details.parentElement?.closest("p"); p; p = details.parentElement?.closest("p")) {
    const div = doc.createElement("div");
    for (const a of [...p.attributes]) div.setAttribute(a.name, a.value);
    div.classList.add(PARA_CLASS);
    div.append(...p.childNodes);
    p.replaceWith(div);
    swapped = true;
  }
  if (!swapped) return;
  for (const style of doc.body.querySelectorAll("style:not([data-bl-sp])")) {
    const next = paragraphTwin(style.textContent);
    if (next !== style.textContent) style.textContent = next;
  }
}
const blockOf = (doc, node) => {
  for (let el = node?.nodeType === 1 ? node : node?.parentElement; el && el !== doc.body; el = el.parentElement) {
    const display = doc.defaultView.getComputedStyle(el).display;
    if (!display.startsWith("inline") && display !== "contents") return el;
  }
  return doc.body;
};
const make = (doc, tag, cls, style) => {
  const el = doc.createElement(tag);
  if (cls) el.className = cls;
  if (style) el.setAttribute("style", style);
  return el;
};
const labelStyle = (c, ui) => `display:inline-block;padding:0 8px;border:1px solid ${c.line};border-radius:6px;background-color:${c.raised};color:${c.muted};font-family:${String(ui.family).replace(/"/g, "'")};font-size:13px;font-style:normal;font-weight:650;line-height:1.6;letter-spacing:${ui.tracking};text-indent:0`;
const escText = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
function spoilerHtml(inner, sp, inline = true) {
  const c = { line: sp?.line || "#8884", raised: sp?.raised || "transparent", muted: sp?.muted || "inherit" }, ui = { family: sp?.family || "inherit", tracking: sp?.tracking || "0" };
  const details = `display:${inline ? "inline-block;max-width:100%;vertical-align:baseline" : "block;margin:8px 0"}`;
  const blur = inline ? "span" : "div", content = inline ? "span" : "div";
  return `<details class="${inline ? "blsp-s" : "blsp-s blsp-k"}" data-bl-spoiler="" style="${details}"><summary class="blsp-h" style="display:${inline ? "inline" : "block"};list-style:none;cursor:pointer"><span class="blsp-l" style="${escText(labelStyle(c, ui))}">${SPOILER_LABEL}</span><${blur} class="blsp-b" aria-hidden="true" style="display:none">${inner}</${blur}></summary><${content} class="blsp-c">${inner}</${content}></details>`;
}
function wrapSpoiler(doc, range, c, ui) {
  if (!range || range.collapsed) return null;
  if (range.startContainer.parentElement?.closest("[data-bl-spoiler]") || range.endContainer.parentElement?.closest("[data-bl-spoiler]")) return null;
  const inline = blockOf(doc, range.startContainer) === blockOf(doc, range.endContainer);
  const piece = range.cloneContents();
  if (!piece.textContent.trim()) return null;
  const frag = range.extractContents();
  const details = make(doc, "details", inline ? "blsp-s" : "blsp-s blsp-k", inline ? "display:inline-block;max-width:100%;vertical-align:baseline" : "display:block;margin:8px 0");
  details.setAttribute("data-bl-spoiler", "");
  const summary = make(doc, "summary", "blsp-h", `display:${inline ? "inline" : "block"};list-style:none;cursor:pointer`);
  const label = make(doc, "span", "blsp-l", labelStyle(c, ui));
  label.textContent = SPOILER_LABEL;
  const blur = make(doc, inline ? "span" : "div", "blsp-b", "display:none");
  blur.setAttribute("aria-hidden", "true");
  blur.append(piece);
  summary.append(label, blur);
  const content = make(doc, inline ? "span" : "div", "blsp-c", "");
  content.append(frag);
  details.append(summary, content);
  range.insertNode(details);
  unparagraph(doc, details);
  ensureStyle(doc);
  return details;
}
function unwrapSpoiler(details) {
  const content = details?.querySelector(":scope > .blsp-c");
  if (!content) return false;
  details.replaceWith(...content.childNodes);
  return true;
}
const spoilerAt = (range) => (range?.startContainer?.nodeType === 1 ? range.startContainer : range?.startContainer?.parentElement)?.closest?.("[data-bl-spoiler]") ?? null;
function ensureStyle(doc) {
  const has = doc.querySelector("[data-bl-spoiler]");
  let style = doc.body.querySelector("style[data-bl-sp]");
  if (!has) {
    style?.remove();
    return;
  }
  if (!style) {
    style = doc.createElement("style");
    style.setAttribute("data-bl-sp", "");
    style.textContent = STYLE;
    doc.body.prepend(style);
  }
}
function previewModel(doc) {
  const view = doc.defaultView;
  const messages = [...doc.querySelectorAll("[data-bl-msg]")];
  if (!messages.length) return null;
  const convert = (parent, base) => {
    const out = [];
    for (const node of parent.childNodes) {
      if (node.nodeType === 3) {
        const text = node.data.replace(/[ \t\r\n\f]+/g, " ");
        if (text.trim() || text === " ") out.push({ t: "text", text });
        continue;
      }
      if (node.nodeType !== 1) continue;
      if (node.matches("style, script, summary, [data-bl-name], .blsp-b")) continue;
      if (node.tagName === "BR") {
        out.push({ t: "br" });
        continue;
      }
      if (node.matches("[data-bl-spoiler]")) {
        const content = node.querySelector(":scope > .blsp-c");
        const blockSp = node.classList.contains("blsp-k");
        out.push({ t: "el", block: blockSp, tag: blockSp ? "div" : "span", kind: "spoiler", style: {}, children: content ? convert(content, base) : [] });
        continue;
      }
      const style = view.getComputedStyle(node);
      if (style.display === "none") continue;
      const block = !style.display.startsWith("inline");
      let kind = null;
      if (block) {
        if (/^H[1-6]$/.test(node.tagName)) kind = node.tagName.toLowerCase();
        else if (node.matches("ul, ol, li")) kind = node.tagName.toLowerCase();
        else if (Number.parseFloat(style.borderLeftWidth) >= 2 && style.borderLeftStyle !== "none") kind = "quote";
        else kind = "p";
      } else {
        const kinds = [];
        if ((Number.parseInt(style.fontWeight, 10) || 400) - base.weight >= 200) kinds.push("strong");
        if (style.fontStyle !== "normal" && !base.italic) kinds.push("em");
        if (/line-through/.test(style.textDecorationLine) || node.matches("s, del, strike")) kinds.push("del");
        kind = kinds.join(" ") || null;
      }
      out.push({ t: "el", block, tag: block ? "div" : "span", kind, style: {}, children: convert(node, base) });
    }
    return out;
  };
  return {
    messages: messages.map((el) => {
      const style = view.getComputedStyle(el);
      const base = { weight: Number.parseInt(style.fontWeight, 10) || 400, italic: style.fontStyle !== "normal" };
      const name = (el.querySelector("[data-bl-name]")?.textContent || el.getAttribute("data-bl-who") || "").trim();
      return { name, nodes: convert(el, base) };
    })
  };
}
export {
  PARA_CLASS,
  SPOILER_LABEL,
  ensureStyle,
  paragraphTwin,
  previewModel,
  spoilerAt,
  spoilerHtml,
  spoilerStyle,
  unparagraphHtml,
  unwrapSpoiler,
  wrapSpoiler
};
