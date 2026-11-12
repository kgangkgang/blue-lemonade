// 생성물 — 글꾸 마트 mart/custom.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { applyCust, wid } from "./lib/cust/cust.js";
import { CUST } from "./lib/cust/cust-table.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const keyOf = (html) => (String(html ?? "").match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-(k\d+)(?=[\s"])/) || [])[1] || "";
const DATE = /^(1[0-2]|[1-9])-(3[01]|[12]\d|[1-9])$/;
const STAR_KEY = "별";
function starOf(html) {
  const text = String(html ?? ""), css = text.slice(0, text.indexOf("</style>"));
  const m = css.match(/\.((?:gk-)?)st-[0-5]h?(?![\w-])/);
  return m ? m[1] : null;
}
const starCls = (pre, n) => `${pre}st-${Math.floor(n)}${n % 1 ? "h" : ""}`;
const ROOT_PICKS = [
  { key: "정보 칸", test: /\.(?:gk-)?gi-(?:chip|tab)(?![\w-])/, options: ["끔", "칩", "탭"], labels: ["끔", "칩 「LOG · 모델 · 프롬프트」", "탭 「LOG · 프롬프트」"], cls: { 칩: "gi-chip", 탭: "gi-tab" }, def: "끔" },
  { key: "높이", test: /\.(?:gk-)?gh-[sml](?![\w-])/, options: ["늘어남", "s", "m", "l"], labels: ["늘어남", "짧게", "보통", "길게"], cls: { s: "gh-s", m: "gh-m", l: "gh-l" }, def: "늘어남" }
];
const GV = [["gv-log", "LOG 글자"], ["gv-model", "모델"], ["gv-prompt", "프롬프트"], ["gv-tab-log", "첫 탭 이름"], ["gv-tab-info", "둘째 탭 이름"]];
const gvRe = (pre, c) => new RegExp('(<(\\w+)\\b[^>]*\\sclass="(?:[^"]*\\s)?' + pre + c + '(?:\\s[^"]*)?"[^>]*>)([^<]*)(</\\2>)', "g");
function rootFields(html) {
  const text = String(html ?? ""), css = text.slice(0, text.indexOf("</style>")), body = text.slice(text.indexOf("</style>"));
  const pre = /\.gk-g[ih]-/.test(css) || /class="[^"]*\bgk-gv-/.test(body) ? "gk-" : "";
  const out = ROOT_PICKS.filter((p) => p.test.test(css)).map((p) => ({ ...p, name: p.key, label: p.key, kind: "pick", group: "named", root: pre }));
  for (const [c, label] of GV) {
    const m = gvRe(pre, c).exec(body);
    if (m) out.push({ key: label, name: label, label, kind: "text", def: m[3], max: 20, group: "named", gv: pre + c });
  }
  return out;
}
function custOf(html) {
  const k = keyOf(html);
  return k && CUST[k] || null;
}
function fieldsOf(html) {
  const star = starOf(html), starField = star == null ? [] : [{ key: STAR_KEY, name: STAR_KEY, label: "별 개수", kind: "num", min: 0, max: 5, step: 0.5, def: 5, group: "named", star }];
  const extra = [...starField, ...rootFields(html)];
  const c = custOf(html);
  if (!c) return extra;
  const used = new Set(c.named.flatMap((n) => [n.slot, ...n.slots || []]).filter(Boolean));
  const named = c.named.map((n) => ({ ...n, key: n.name, group: "named" }));
  const slots = c.slots.filter((s) => !used.has(s.t)).map((s) => ({ key: s.t, name: s.t, label: s.def, kind: "text", def: s.def, max: s.max, group: "slot" }));
  return [...extra, ...named, ...slots];
}
function valOk(f, v) {
  if (v == null || v === "") return true;
  if (f.kind === "num") {
    const n = Number(v), unit = f.step < 1 ? f.step : 1;
    return Number.isFinite(n) && n >= f.min && n <= f.max && Math.abs(Math.round(n / unit) * unit - n) < 1e-9;
  }
  if (f.kind === "pick") return f.options.map(String).includes(String(v));
  if (f.kind === "chars") return [...String(v)].length === f.len && !/[<>\n]/.test(v);
  if (f.kind === "date") return DATE.test(String(v));
  return !/[<>\n]/.test(String(v)) && wid(String(v)) <= Math.max(4, f.max || 0);
}
function cleanVals(raw, fields) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const f of fields) {
    let v = raw[f.key];
    if (v == null || v === "") continue;
    if (f.kind === "num") v = Number(v);
    if (!valOk(f, v) || String(v) === String(f.def)) continue;
    out[f.key] = f.kind === "pick" ? f.options.find((o) => String(o) === String(v)) : v;
  }
  return Object.keys(out).length ? out : null;
}
function applyVals(html, vals) {
  let text = String(html ?? "");
  const v = cleanVals(vals, fieldsOf(text));
  if (!v) return text;
  const star = starOf(text);
  if (star != null && STAR_KEY in v) {
    const cls = starCls(star, Number(v[STAR_KEY]));
    delete v[STAR_KEY];
    text = text.replace(/^(\s*<div\b[^>]*\sclass="gk\s)([^"]*)"/, (m, a, c2) => `${a}${c2.split(/\s+/).filter((x) => !/^(?:gk-)?st-[0-5]h?$/.test(x)).join(" ")} ${cls}"`);
  }
  for (const f of rootFields(text)) {
    if (!(f.key in v)) continue;
    const val = v[f.key];
    delete v[f.key];
    if (f.kind === "pick") {
      const all = Object.values(f.cls).map((x) => f.root + x), add = f.cls[val] ? f.root + f.cls[val] : "";
      text = text.replace(/^(\s*<div\b[^>]*\sclass="gk\s)([^"]*)"/, (m, a, c2) => a + [...c2.split(/\s+/).filter((x) => !all.includes(x)), add].filter(Boolean).join(" ") + '"');
    } else text = text.replace(gvRe("", f.gv), (m, open, tag, old, close) => open + esc(val) + close);
  }
  const c = custOf(text);
  if (!c || !Object.keys(v).length) return text;
  try {
    return applyCust(text, c.key, v);
  } catch {
    return text;
  }
}
function valsHtml(fields, vals = {}) {
  const named = fields.filter((f) => f.group === "named"), slots = fields.filter((f) => f.group === "slot");
  const cur = (f) => vals?.[f.key] ?? f.def;
  const nums = named.filter((f) => f.kind === "num");
  const numHtml = nums.map((f, i) => {
    const v = Number(cur(f)), fill = `${Number(((v - f.min) / (f.max - f.min) * 100).toFixed(1))}%`, wide = nums.length % 2 === 1 && i === nums.length - 1;
    return `<div class="mart-param${wide ? " is-wide" : ""}"><header><span class="mart-param-name">${esc(f.label)}</span>${undo(f, vals)}<span class="mart-num"><input type="number" step="${f.step}" min="${f.min}" max="${f.max}" inputmode="numeric" data-val-num="${esc(f.key)}" value="${v}" aria-label="${esc(f.label)} 숫자"></span></header><input type="range" data-val="${esc(f.key)}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}" style="--fill:${fill}" aria-label="${esc(f.label)}"></div>`;
  }).join("");
  const pickHtml = named.filter((f) => f.kind === "pick").map((f) => `<div class="mart-look-row is-wrap"><span class="mart-look-label">${esc(f.label)}${undo(f, vals)}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}">${f.options.map((o) => `<button type="button" class="chip" data-val-pick="${esc(f.key)}" data-v="${esc(o)}" aria-pressed="${String(o) === String(cur(f))}">${esc(f.labels?.[f.options.indexOf(o)] ?? o)}</button>`).join("")}</span></div>`).join("");
  const textRow = (f) => `<div class="mart-look-row is-wrap"><span class="mart-look-label">${esc(f.label)}</span><label class="field-wrap mart-head-field"><input type="text" class="field" data-val="${esc(f.key)}" value="${esc(vals?.[f.key] ?? "")}" placeholder="${esc(f.def)}" ${f.kind === "chars" ? `maxlength="${f.len}" ` : ""}aria-label="${esc(f.label)}"${hint(f)}></label>${undo(f, vals)}</div>`;
  const texts = named.filter((f) => ["text", "chars", "date"].includes(f.kind)).map(textRow).join("");
  const slotHtml = slots.length ? `<details class="mart-vals-slots"><summary class="mart-look-row chev"><span class="mart-look-label">소품 글자</span><span class="mart-tune-hint">${slots.length}자리 · 비우면 기본 글자</span></summary>${slots.map(textRow).join("")}</details>` : "";
  return `<div class="mart-look">${numHtml}${pickHtml}${texts}${slotHtml}<p class="mart-tune-hint">이 틀에만 걸려요 · 글자는 기본 글자 폭까지(한글 2 · 그 밖 1) · 「전부 처음으로」 하면 틀 값으로</p></div>`;
}
const undo = (f, vals) => `<button type="button" class="mart-tune-undo" data-val-reset="${esc(f.key)}" title="${esc(f.label)} · 틀 그대로" aria-label="${esc(f.label)} · 틀 그대로"${vals?.[f.key] == null ? " hidden" : ""}>↺</button>`;
const hint = (f) => f.kind === "date" ? ' inputmode="numeric" pattern="\\d{1,2}-\\d{1,2}" title="월-일(예 12-31)"' : f.kind === "chars" ? ` title="${f.len}글자"` : ` title="폭 ${Math.max(4, f.max || 0)}까지(한글 2 · 그 밖 1)"`;
export {
  STAR_KEY,
  applyVals,
  cleanVals,
  custOf,
  fieldsOf,
  starOf,
  valOk,
  valsHtml
};
