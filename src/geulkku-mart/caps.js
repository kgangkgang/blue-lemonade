// 생성물 — 글꾸 마트 mart/caps.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { shapeCaps } from "./shape.js";
import { motionCaps } from "./motion-state.js";
let table = null, loading = null, rev = 0;
const capsRev = () => rev;
function loadCaps(url = new URL("./data/geulkku/caps.json", import.meta.url).href) {
  if (table || loading) return loading || Promise.resolve(table);
  loading = fetch(url).then((r) => r.ok ? r.json() : null).then((v) => {
    table = v?.frames || {};
    rev++;
    try {
      document.dispatchEvent(new CustomEvent("bl-tone-change", { detail: { caps: true } }));
    } catch {
    }
    return table;
  }, () => {
    table = {};
    return table;
  });
  return loading;
}
const setCapsTable = (t) => {
  table = t || {};
  rev++;
};
const keyOf = (html) => (String(html ?? "").match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || "";
function capsStatic(html) {
  const s = shapeCaps(html), m = motionCaps(html);
  return { band: s.band, bg: s.bg, border: s.border, radius: s.radius, underline: s.underline, hideProp: s.hideProp, pad: s.pad ? [70, 130] : false, width: s.width ? [480, 560, 640] : false, title: { max: 28 }, nameTag: s.nameTag ? ["pill", "line"] : false, motion: { text: m.text, prop: m.prop, speed: m.speed }, open: m.open, unmeasured: true };
}
function capsOf(item) {
  const html = item?.preview || "", k = keyOf(html), row = item?.simple && !item?.own && table?.[k];
  return row || capsStatic(html);
}
function capWhy(caps, cap, value) {
  if (!caps || !cap) return "";
  if (cap === "band") return caps.band === "color" ? "" : caps.band === "image" ? "이 틀은 대사 띠를 그림으로 그어요" : "이 틀은 대사 띠가 없어요";
  if (cap === "bg") return caps.bg ? "" : "이 틀은 카드 바탕이 그림이거나 안쪽 칸에 있어요";
  if (cap === "border") return caps.border ? "" : "이 틀은 카드 테두리가 없어요";
  if (cap === "radius") return caps.radius ? "" : "이 틀은 카드 모서리를 안쪽 칸이 정해요";
  if (cap === "pad") return caps.pad ? "" : "이 틀은 안쪽 칸이 여백을 가져서 못 바꿔요";
  if (cap === "width") return caps.width && (value == null || caps.width.includes(value)) ? "" : "이 틀은 그 폭에서 글이 넘쳐요";
  if (cap === "title") return caps.title ? "" : "이 틀은 제목이 소품과 붙어 있어 크기를 못 바꿔요";
  if (cap === "nameTag") return caps.nameTag && (value == null || value === "plain" || caps.nameTag.includes(value)) ? "" : caps.nameTag ? "이 틀에서는 그 이름표가 글과 겹쳐요" : "이 틀은 이름 줄이 없어요";
  if (cap === "underline") return caps.underline ? "" : "이 틀은 제목 밑줄이 없어요";
  if (cap === "hideProp") return caps.hideProp ? "" : "이 틀은 소품이 글과 한 칸이라 숨기면 글도 숨어요";
  if (cap === "speed") return caps.motion?.speed ? "" : "이 틀은 움직임이 없어요";
  if (cap === "open") return caps.open ? "" : "이 틀은 눌러서 여는 칸이 없어요";
  return "";
}
function shapeGate(caps, value) {
  if (!caps) return null;
  const g = {};
  for (const k of ["band", "bg", "border", "radius", "pad", "underline", "hideProp"]) g[k] = k === "band" ? caps.band === "color" : !!caps[k];
  g.width = !!caps.width && (value?.width == null || caps.width.includes(value.width));
  g.nameTag = !!caps.nameTag && (value?.nameTag == null || caps.nameTag.includes(value.nameTag));
  return g;
}
const padIn = (caps, v) => v == null || !caps?.pad ? v : Math.min(caps.pad[1], Math.max(caps.pad[0], v));
const titleIn = (caps, v) => v == null || !caps?.title ? v : Math.min(caps.title.max, v);
export {
  capWhy,
  capsOf,
  capsRev,
  capsStatic,
  loadCaps,
  padIn,
  setCapsTable,
  shapeGate,
  titleIn
};
