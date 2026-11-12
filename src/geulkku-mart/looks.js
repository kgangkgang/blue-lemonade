// 생성물 — 글꾸 마트 mart/looks.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
const LOOKS = Object.freeze([
  { id: "plain", label: "틀 그대로", look: null, motion: { text: "m", prop: "m" }, shape: null },
  { id: "clear", label: "또렷하게", look: { type: { weight: 500 }, dialogue: { weight: 650 }, profile: { nameWeight: 800 } }, motion: { text: "m", prop: "m" }, shape: { bandAlpha: 28 } },
  { id: "calm", label: "잔잔하게", look: { type: { lineHeight: 1.9 } }, motion: { text: "s", prop: "s" }, shape: { bandAlpha: 12 } },
  { id: "big", label: "큼직하게", look: { type: { sizeStep: 2, lineHeight: 1.9, para: 1.1 } }, motion: { text: "m", prop: "m" }, shape: null },
  { id: "book", label: "책처럼", look: { fonts: { text: "serif" }, type: { align: "justify-word", indent: true }, dialogue: { style: "plain" } }, motion: { text: "m", prop: "m" }, shape: { nameTag: "line" } },
  { id: "light", label: "가볍게", look: { fonts: { text: "gothic" }, type: { indent: false, para: 0.6 }, dialogue: { style: "full" } }, motion: { text: "m", prop: "m" }, shape: { radius: 16, nameTag: "pill" } }
]);
const sorted = (v) => v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
const sameLook = (a, b) => JSON.stringify(sorted(a || null)) === JSON.stringify(sorted(b || null));
export {
  LOOKS,
  sameLook
};
