// 생성물 — 글꾸 마트 mart/edit-blocks.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
import { EDIT_CLASSES, EDIT_TAGS, hasLetters } from "./tune.js";
const RICH = ["B", "I", "STRONG", "EM", "S", "BR"];
const SKIP = ["STYLE", "SCRIPT", "AUDIO", "BR", "TITLE"];
const leafy = (el) => ![...el.childNodes].some((n) => n.nodeType === 8) && [...el.querySelectorAll("*")].every((c) => RICH.includes(c.tagName) && !c.attributes.length || c.hasAttribute("data-bl-mask") || !!c.closest("[data-bl-spoiler]"));
function markSlots(root) {
  const base = [], extra = [];
  let inside = null;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let el = walk.nextNode(); el; el = walk.nextNode()) {
    if (inside?.contains(el)) {
      el.removeAttribute("contenteditable");
      delete el.dataset.blEd;
      continue;
    }
    delete el.dataset.blEd;
    if (el.closest(".blsp-h")) continue;
    if (SKIP.includes(el.tagName) || !leafy(el)) continue;
    inside = el;
    let prev = el.previousSibling;
    while (prev && prev.nodeType === 3 && !prev.data.trim()) prev = prev.previousSibling;
    const marked = prev?.nodeType === 8 && /^\s*✎/.test(prev.data);
    const hit = EDIT_CLASSES.find((c) => el.classList.contains(c));
    if (hit || marked || EDIT_TAGS.includes(el.tagName.toLowerCase())) {
      if (!(hit === "gk-hl" && !el.textContent.trim())) base.push(el);
      continue;
    }
    if (hasLetters(el.textContent)) extra.push(el);
  }
  const all = [...base, ...extra];
  all.forEach((el, i) => {
    el.dataset.blEd = String(i);
  });
  return all;
}
const propDetails = (root) => [...root.querySelectorAll("details")].filter((d) => !d.matches("[data-bl-spoiler], .blsp-s"));
const stepLabels = (n) => n <= 0 ? [] : n === 1 ? ["전", "후"] : ["전", ...Array.from({ length: n }, (_, i) => `후 ${i + 1}`)];
function setStep(root, k) {
  const ds = propDetails(root);
  root.classList.add("bl-eb-freeze");
  ds.forEach((d, i) => {
    const open = i < k;
    d.open = open;
    d.dataset.blHold = String(open);
  });
  settle(root);
}
function settle(root) {
  for (const a of root.getAnimations?.({ subtree: true }) || []) {
    try {
      a.finish();
    } catch {
      try {
        a.pause();
      } catch {
      }
    }
  }
}
const CSS = `.bl-eb-on [data-bl-ed]{outline:1.5px dashed color-mix(in srgb,var(--bl-eb-c,#2477d3) 85%,transparent)!important;outline-offset:2px!important;border-radius:2px;cursor:text;min-width:.6em;min-height:1em}
.bl-eb-on [data-bl-ed]:hover{outline-style:solid!important;position:relative;z-index:3}
.bl-eb-on [data-bl-ed]:focus{outline:2px solid var(--bl-eb-c,#2477d3)!important;outline-offset:2px!important;background-color:color-mix(in srgb,var(--bl-eb-c,#2477d3) 12%,transparent);position:relative;z-index:4}
.bl-eb-freeze,.bl-eb-freeze *{transition:none!important}
.bl-eb-steps{display:flex;gap:6px;align-items:center;margin:0 0 10px;font:600 13px/1.2 system-ui,sans-serif}
.bl-eb-steps>span{opacity:.7;margin-right:2px}
.bl-eb-steps button{min-width:44px;min-height:32px;padding:4px 12px;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.bl-eb-steps button[aria-pressed=true]{border-color:var(--bl-eb-c,#2477d3);background:var(--bl-eb-c,#2477d3);color:#fff}`;
function ensureCss(doc) {
  if (doc.getElementById("bl-eb-css")) return;
  const s = doc.createElement("style");
  s.id = "bl-eb-css";
  s.textContent = CSS;
  doc.head.append(s);
}
function createEditBlocks(host, opt = {}) {
  const doc = host.ownerDocument;
  ensureCss(doc);
  const st = { on: false, step: 0, hold: null, past: [], future: [], editing: null, before: "" };
  const root = () => host.querySelector(".gk");
  const bar = () => host.querySelector(":scope > .bl-eb-steps");
  const drawBar = () => {
    bar()?.remove();
    const r = root();
    if (!st.on || !r) return;
    const labels = stepLabels(propDetails(r).length);
    if (!labels.length) return;
    const b = doc.createElement("div");
    b.className = "bl-eb-steps";
    b.setAttribute("role", "group");
    b.setAttribute("aria-label", "소품 전 · 후");
    b.innerHTML = `<span>${opt.label || "소품"}</span>` + labels.map((l, k) => `<button type="button" data-bl-step="${k}" aria-pressed="${k === st.step}">${l}</button>`).join("");
    host.prepend(b);
  };
  const arm = () => {
    const r = root();
    if (!r) return;
    const cells = markSlots(r);
    for (const el of cells) {
      if (st.on) {
        el.setAttribute("contenteditable", "true");
        el.setAttribute("spellcheck", "false");
      } else {
        el.removeAttribute("contenteditable");
        el.removeAttribute("spellcheck");
      }
    }
    host.classList.toggle("bl-eb-on", st.on);
    if (st.on) setStep(r, st.step);
    else r.classList.remove("bl-eb-freeze");
    drawBar();
  };
  const write = (i, html) => {
    const el = root()?.querySelector(`[data-bl-ed="${i}"]`);
    if (!el) return false;
    el.innerHTML = html;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return true;
  };
  const onFocusIn = (e) => {
    const el = e.target.closest?.("[data-bl-ed]");
    if (!st.on || !el || !host.contains(el)) return;
    st.editing = el.dataset.blEd;
    st.before = el.innerHTML;
    keepInView(el);
  };
  const onFocusOut = (e) => {
    const el = e.target.closest?.("[data-bl-ed]");
    if (!el || el.dataset.blEd !== st.editing) return;
    if (el.innerHTML !== st.before) {
      st.past.push({ i: st.editing, from: st.before, to: el.innerHTML });
      st.future = [];
    }
    st.editing = null;
  };
  const onKey = (e) => {
    const el = e.target.closest?.("[data-bl-ed]");
    if (!st.on || !el) return;
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      e.stopImmediatePropagation();
      el.blur();
    }
    if (e.key === "Escape") {
      el.innerHTML = st.before;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      el.blur();
    }
  };
  const onClick = (e) => {
    const b = e.target.closest?.("[data-bl-step]");
    if (!b || !host.contains(b)) return;
    e.preventDefault();
    api.setStep(Number(b.dataset.blStep));
  };
  const keepInView = (el) => {
    const go = () => el.scrollIntoView?.({ block: "center", inline: "nearest" });
    setTimeout(go, 60);
    doc.defaultView?.visualViewport?.addEventListener("resize", go, { once: true });
  };
  host.addEventListener("focusin", onFocusIn);
  host.addEventListener("focusout", onFocusOut);
  host.addEventListener("keydown", onKey, true);
  host.addEventListener("click", onClick);
  const api = {
    get on() {
      return st.on;
    },
    get step() {
      return st.step;
    },
    setOn(v) {
      v = !!v;
      if (v === st.on) {
        arm();
        return;
      }
      const r = root();
      if (v) {
        st.hold = r ? propDetails(r).map((d) => d.open) : null;
        st.step = st.hold ? st.hold.filter(Boolean).length : 0;
      }
      st.on = v;
      arm();
      if (!v && r) {
        const ds = propDetails(r);
        ds.forEach((d, i) => {
          d.open = !!st.hold?.[i];
          delete d.dataset.blHold;
        });
        st.past = [];
        st.future = [];
      }
    },
    refresh: arm,
    setStep(k) {
      const r = root();
      if (!r) return;
      st.step = Math.max(0, Math.min(propDetails(r).length, k));
      setStep(r, st.step);
      drawBar();
      opt.onStep?.(st.step);
    },
    steps: () => root() ? stepLabels(propDetails(root()).length) : [],
    undo() {
      const x = st.past.pop();
      if (!x) return false;
      st.future.push(x);
      return write(x.i, x.from);
    },
    redo() {
      const x = st.future.pop();
      if (!x) return false;
      st.past.push(x);
      return write(x.i, x.to);
    },
    canUndo: () => st.past.length > 0,
    canRedo: () => st.future.length > 0,
    slots: () => root() ? markSlots(root()) : [],
    destroy() {
      api.setOn(false);
      host.removeEventListener("focusin", onFocusIn);
      host.removeEventListener("focusout", onFocusOut);
      host.removeEventListener("keydown", onKey, true);
      host.removeEventListener("click", onClick);
    }
  };
  return api;
}
export {
  createEditBlocks,
  markSlots,
  propDetails,
  setStep,
  stepLabels
};
