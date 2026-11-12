// 생성물 — 글꾸 마트 mart/lib/motion/motion.js 사본(마트 1466d38b · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
if ((globalThis.process?.env || {}).GM_BLOCK) throw new Error("GM_BLOCK — 세기 고리를 막은 판(고리가 있을 때 ↔ 없을 때 대조용)");
const F = { s: 0.5, l: 1.4 };
const G = { s: 0.35, l: 1.5 };
const FLOOR = 2.8;
const r2 = (v) => {
  const s = (Math.round(v * 100) / 100).toString();
  return s === "-0" ? "0" : s;
};
function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const o = css.indexOf("{", i);
    if (o < 0) break;
    let d = 1, j = o + 1;
    while (j < css.length && d) {
      const c = css[j];
      if (c === "{") d++;
      else if (c === "}") d--;
      j++;
    }
    const raw = css.slice(i, o);
    out.push({ head: raw.trim(), body: css.slice(o + 1, j - 1), start: i + (raw.length - raw.trimStart().length), end: j });
    i = j;
  }
  return out;
}
const splitTop = (s, ch) => {
  const out = [];
  let d = 0, q = "", cur = "";
  for (const c of s) {
    if (q) {
      if (c === q) q = "";
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      cur += c;
      continue;
    }
    if (c === "(") d++;
    else if (c === ")") d--;
    if (c === ch && d === 0) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
};
const decls = (body) => splitTop(body, ";").map((x) => x.trim()).filter(Boolean).map((x) => {
  const i = x.indexOf(":");
  return [x.slice(0, i).trim(), x.slice(i + 1).trim()];
});
const ID = (fn) => fn === "scale" ? [1, 1] : fn === "translate" ? [0, 0] : [0];
const ROT = /* @__PURE__ */ new Set(["rotate", "rotateX", "rotateY", "rotateZ"]), SKEW = /* @__PURE__ */ new Set(["skewX", "skewY"]);
function parseTf(v) {
  v = v.replace(/\s*!important\s*$/, "").trim();
  if (v === "none") return [];
  const out = [], re = /([a-zA-Z0-9]+)\(([^()]*)\)/g;
  let m, rest = v;
  while (m = re.exec(v)) {
    let fn = m[1];
    const args = m[2].split(",").map((x) => x.trim());
    const a = [], u = [];
    for (const x of args) {
      const k = x.match(/^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/);
      if (!k) return null;
      a.push(+k[1]);
      u.push(k[2]);
    }
    if (fn === "translateX") {
      fn = "translate";
      a.push(0);
      u.push(u[0]);
    } else if (fn === "translateY") {
      fn = "translate";
      a.unshift(0);
      u.unshift(u[0]);
    } else if (fn === "translate") {
      if (a.length === 1) {
        a.push(0);
        u.push(u[0]);
      }
    } else if (fn === "scaleX") {
      fn = "scale";
      a.push(1);
      u.push("");
    } else if (fn === "scaleY") {
      fn = "scale";
      a.unshift(1);
      u.unshift("");
    } else if (fn === "scale") {
      if (a.length === 1) {
        a.push(a[0]);
        u.push("");
      }
    } else if (ROT.has(fn) || SKEW.has(fn) || fn === "perspective") {
      if (a.length !== 1) return null;
    } else return null;
    if (fn === "translate") {
      const un = u.filter((x, i) => a[i] !== 0);
      if (new Set(un).size > 1) return null;
      const one = un[0] || u[0] || "px";
      u[0] = u[1] = one;
    }
    if (out.some((o) => o.fn === fn)) return null;
    out.push({ fn, a, u });
    rest = rest.replace(m[0], "");
  }
  return rest.trim() ? null : out;
}
const fmtTf = (list) => {
  const s = list.map((o) => o.fn === "translate" ? o.a[1] === 0 ? "translateX(" + r2(o.a[0]) + o.u[0] + ")" : o.a[0] === 0 ? "translateY(" + r2(o.a[1]) + o.u[1] + ")" : "translate(" + r2(o.a[0]) + o.u[0] + "," + r2(o.a[1]) + o.u[1] + ")" : o.fn === "scale" ? o.a[0] === o.a[1] ? "scale(" + r2(o.a[0]) + ")" : "scale(" + r2(o.a[0]) + "," + r2(o.a[1]) + ")" : o.fn + "(" + r2(o.a[0]) + o.u[0] + ")").join(" ");
  return s || "none";
};
const bez = (s, g) => s.replace(/cubic-bezier\(([^)]*)\)/g, (m, inner) => {
  const p = inner.split(",").map((x) => +x.trim());
  if (p.length !== 4 || p.some(isNaN)) return m;
  let ch = false;
  for (const i of [1, 3]) {
    if (p[i] > 1) {
      p[i] = 1 + (p[i] - 1) * g;
      ch = true;
    } else if (p[i] < 0) {
      p[i] = p[i] * g;
      ch = true;
    }
  }
  return ch ? "cubic-bezier(" + p.map((x) => r2(x).replace(/^0\./, ".").replace(/^-0\./, "-.")).join(",") + ")" : m;
});
function scaleKf(body, f, opt = {}) {
  const stops = blocks(body).map((b) => ({ b, ps: b.head.split(",").map((x) => {
    x = x.trim();
    return x === "from" ? 0 : x === "to" ? 100 : parseFloat(x);
  }), d: decls(b.body) }));
  const at = (p, prop) => {
    for (const s of stops) if (s.ps.includes(p)) {
      const d = s.d.find((x) => x[0] === prop);
      if (d) return d[1];
    }
    return void 0;
  };
  const has = (prop) => stops.some((s) => s.d.some((x) => x[0] === prop));
  const kind = has("transform") ? "변형" : has("clip-path") || has("-webkit-mask-size") || has("mask-size") || has("-webkit-mask-position") || has("mask-position") || has("background-size") || has("background-position") ? "가림" : has("opacity") ? "옅어짐" : "그 밖";
  let moved = false, est = 0, changed = false;
  const K = opt.text ? { px: 120, pc: 60, rot: 60, sc: 9 } : { px: 32, pc: 30, rot: 30, sc: 0.5 };
  const res = { kind, moved: false, est: 0, body };
  let t0, t1, ok = has("transform");
  if (ok) {
    const a = at(0, "transform"), b = at(100, "transform");
    if (a === void 0 || b === void 0) {
      if (opt.text && a === void 0 && b === void 0) {
        t0 = [];
        t1 = [];
      } else ok = false;
    } else {
      t0 = parseTf(a);
      t1 = parseTf(b);
      if (!t0 || !t1) ok = false;
    }
  }
  const parsed = /* @__PURE__ */ new Map();
  if (ok) for (const s of stops) {
    const d = s.d.find((x) => x[0] === "transform");
    if (!d) continue;
    const t = parseTf(d[1]);
    if (!t) {
      ok = false;
      break;
    }
    parsed.set(s, t);
  }
  if (ok) {
    const get = (list, fn) => list.find((o) => o.fn === fn);
    const units = {};
    for (const t of [t0, t1, ...parsed.values()]) for (const o of t) if (o.fn === "translate") {
      for (const i of [0, 1]) if (o.a[i] !== 0) (units[i] = units[i] || /* @__PURE__ */ new Set()).add(o.u[i]);
    }
    if (Object.values(units).some((s) => s.size > 1)) ok = false;
    if (ok) {
      const isId = (t) => t.every((o) => o.fn === "perspective" || o.a.every((x, i) => Math.abs(x - ID(o.fn)[i]) < 4e-3));
      const all = opt.alt || opt.text && isId(t1) && !isId(t0);
      const arrived = {};
      const order = stops.filter((s) => parsed.get(s)).sort((x, y) => Math.min(...x.ps) - Math.min(...y.ps));
      const big = {};
      for (const s of order) {
        const t = parsed.get(s);
        for (const fn of /* @__PURE__ */ new Set([...t.map((o) => o.fn), ...t1.map((o) => o.fn)])) {
          if (fn === "perspective") continue;
          const cur = get(t, fn), a0 = get(t0, fn), a1 = get(t1, fn), id = ID(fn), u = (cur || a0 || a1).u;
          for (let i = 0; i < id.length; i++) {
            const end = opt.alt ? ((a0 ? a0.a[i] : id[i]) + (a1 ? a1.a[i] : id[i])) / 2 : a1 ? a1.a[i] : id[i];
            const dev = Math.abs((cur ? cur.a[i] : id[i]) - end);
            const lim = ROT.has(fn) ? K.rot : fn === "scale" ? K.sc : fn === "translate" ? u[i] === "%" ? K.pc : K.px : 1e9;
            if (dev >= lim) big[fn + i] = true;
          }
        }
      }
      for (const s of order) {
        const t = parsed.get(s);
        const ends = s.ps.some((p) => p <= 0 || p >= 100);
        if (ends && !(all && !s.ps.some((p) => p >= 100)) && !opt.alt) continue;
        const fns = [.../* @__PURE__ */ new Set([...t.map((o) => o.fn), ...t0.map((o) => o.fn), ...t1.map((o) => o.fn)])].filter((fn) => fn !== "perspective");
        const out = [];
        let dx = 0, dy = 0, rot = 0, sk = 0, sc = 0, touched = false;
        for (const fn of fns) {
          const cur = get(t, fn), a0 = get(t0, fn), a1 = get(t1, fn), id = ID(fn);
          const u = (cur || a0 || a1).u;
          const v = cur ? cur.a : id, b0 = a0 ? a0.a : id, b1 = a1 ? a1.a : id;
          const nv = [];
          for (let i = 0; i < id.length; i++) {
            const key = fn + i;
            const end = opt.alt ? (b0[i] + b1[i]) / 2 : b1[i];
            if (arrived[key] === void 0) arrived[key] = all || Math.abs(b0[i] - b1[i]) < 4e-3;
            let dev = v[i] - end, scale = arrived[key];
            if (!scale) {
              if (Math.abs(dev) < 4e-3) arrived[key] = true;
              else if (dev * (b0[i] - end) < 0) {
                arrived[key] = true;
                scale = true;
              }
            }
            let n = scale ? end + dev * f : v[i];
            if (!scale) dev = 0;
            if (big[key]) n = v[i];
            else if (ROT.has(fn) && Math.abs(dev) >= K.rot) n = v[i];
            else if (fn === "scale" && (v[i] <= 0.3 || end <= 0.3 || Math.abs(dev) >= K.sc)) n = v[i];
            else if (fn === "translate" && u[i] !== "%" && Math.abs(dev) >= K.px) n = v[i];
            else if (fn === "translate" && u[i] === "%" && Math.abs(dev) >= K.pc) n = v[i];
            if (opt.text && f > 1) {
              if (fn === "translate" && i === 1 && n < -3) n = Math.min(v[i], -3);
              if (fn === "scale" && i === 1 && n < 0.7) n = Math.max(n, Math.min(v[i], 0.7));
            }
            if (Math.abs(n - v[i]) > 4e-3) touched = true;
            nv.push(n);
            if (fn === "translate" && u[i] !== "%") {
              if (i === 0) dx = dev;
              else dy = dev;
            } else if (ROT.has(fn)) rot = Math.max(rot, Math.abs(dev) < K.rot ? Math.abs(dev) : 0);
            else if (SKEW.has(fn)) sk = Math.abs(dev);
            else if (fn === "scale") sc = Math.max(sc, Math.abs(dev) * (i === 0 ? 1 : 0.1));
          }
          if (cur || nv.some((x, i) => Math.abs(x - id[i]) > 4e-3)) {
            const o = { fn, a: nv, u };
            if (cur) out.push(o);
            else if (fn === "translate") out.unshift(o);
            else out.push(o);
          }
        }
        const per = get(t, "perspective");
        if (per) out.unshift(per);
        est = Math.max(est, Math.hypot(dx, dy) + 3.5 * rot + 0.4 * sk + 150 * sc);
        if (touched) {
          s.d.find((x) => x[0] === "transform")[1] = fmtTf(out);
          moved = true;
          changed = true;
        }
      }
    }
  }
  if (opt.text && has("opacity") && kind !== "가림" && !has("-webkit-mask-image")) {
    const a = at(0, "opacity"), b = at(100, "opacity");
    if ((a === void 0 || +a === 1) && (b === void 0 || +b === 1)) for (const s of stops) {
      if (!s.ps.every((p) => p > 0 && p < 100)) continue;
      const d = s.d.find((x) => x[0] === "opacity");
      if (!d) continue;
      const v = +d[1];
      if (!(v >= 0.15 && v < 1)) continue;
      let n = 1 - (1 - v) * f;
      if (f > 1) n = Math.max(n, Math.min(v, 0.25));
      if (Math.abs(n - v) > 4e-3) {
        d[1] = r2(n).replace(/^0\./, ".");
        changed = true;
      }
    }
  }
  for (const s of stops) for (const d of s.d) if (d[0] === "animation-timing-function") {
    const n = bez(d[1], f);
    if (n !== d[1]) {
      d[1] = n;
      changed = true;
      moved = true;
    }
  }
  res.moved = moved;
  res.est = est;
  if (changed) res.body = stops.map((s) => s.b.head + "{" + s.d.map((x) => x[0] + ":" + x[1]).join(";") + "}").join("");
  res.changed = changed;
  return res;
}
const TIME = /^-?(?:\d+\.?\d*|\.\d+)m?s$/;
const secOf = (t) => /ms$/.test(t) ? parseFloat(t) / 1e3 : parseFloat(t);
const fmtSec = (v) => String(+v.toFixed(3)).replace(/^0\./, ".") + "s";
function frameInfo(html) {
  const m = html.match(/<div class="(gk [^"]*)"><style>/);
  if (!m) return null;
  const rootCls = m[1].split(/\s+/);
  const si = html.indexOf("<style>", m.index) + 7, se = html.indexOf("</style>", si);
  const css = html.slice(si, se);
  const cnt = {};
  for (const b of blocks(css)) {
    const k2 = (b.head.match(/^(?:div)?\.([\w-]+)/) || [])[1];
    if (k2 && rootCls.includes(k2)) cnt[k2] = (cnt[k2] || 0) + 1;
  }
  const k = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  if (!k) return null;
  const pre = /^gk-/.test(k) ? "gk-" : "";
  const body = html.slice(se);
  const inLg = /* @__PURE__ */ new Set(), inKx = /* @__PURE__ */ new Set(), stack = [], pcls = [], inline = [];
  const re = /<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)([^>]*)>/g;
  let t;
  const VOID = /* @__PURE__ */ new Set(["br", "img", "input", "hr", "source", "wbr", "audio-x"]);
  while (t = re.exec(body)) {
    if (t[1]) {
      stack.pop();
      pcls.pop();
      continue;
    }
    const tag = t[2].toLowerCase();
    const cs = (t[3].match(/\sclass="([^"]*)"/) || [, ""])[1].split(/\s+/).filter(Boolean);
    const zone = cs.includes(pre + "kx") ? "kx" : cs.includes(pre + "lg") || cs.includes(pre + "tc") || cs.includes(pre + "sd") ? "lg" : stack.length ? stack[stack.length - 1] : "";
    for (const c of cs) {
      if (zone === "kx") inKx.add(c);
      else if (zone === "lg") inLg.add(c);
    }
    const ia = (t[3].match(/\sstyle="([^"]*)"/) || [, ""])[1].match(/(?:^|;)\s*animation:([^;]*)/);
    if (ia && !/^\s*none/.test(ia[1])) inline.push({ zone, cls: cs[0] || (pcls[pcls.length - 1] ? pcls[pcls.length - 1] + ">" + tag : ""), tag, v: ia[1].trim() });
    if (!VOID.has(tag) && !/\/$/.test(t[3])) {
      stack.push(zone);
      pcls.push(cs[0] || "");
    }
  }
  return { k, pre, rootCls, si, se, css, inLg, inKx, inline, rootAt: m.index };
}
function groupOf(sel, info) {
  const P = info.pre, bare = sel.replace(/:has\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "").replace(/::?[a-z-]+(\([^)]*\))?/g, (x) => /^:(not|is|where|nth)/.test(x) ? x : "");
  const cls = (bare.match(/\.[\w-]+/g) || []).map((x) => x.slice(1));
  if (cls.some((c) => c === P + "lg" || c === P + "tc" || c === P + "tt" || c === P + "sd")) return "text";
  if (cls.some((c) => c === P + "kx" || c === P + "pb")) return "prop";
  const last = bare.trim().split(/[\s>+~]+/).pop() || "";
  const lc = (last.match(/\.[\w-]+/g) || []).map((x) => x.slice(1));
  if (/(^|[\s>+~])\*$/.test(bare.trim()) && !lc.length) return "both";
  if (lc.some((c) => info.inKx.has(c))) return "prop";
  if (lc.some((c) => info.inLg.has(c))) return "text";
  if (cls.some((c) => info.inKx.has(c))) return "prop";
  if (cls.some((c) => info.inLg.has(c) && !info.rootCls.includes(c))) return "text";
  return "prop";
}
const addRoot = (sel, k, cls) => {
  const i = sel.indexOf("." + k);
  if (i < 0) return null;
  const j = i + k.length + 1;
  if (/[\w-]/.test(sel[j] || "")) return null;
  return sel.slice(0, j) + cls + sel.slice(j);
};
function build(html, opt = {}) {
  const capB = Object.assign({}, opt.key && CAP[opt.key], opt.cap);
  const info = frameInfo(html);
  if (!info) return null;
  const { k, pre } = info;
  const css = stripOld(info.css, info);
  const top = blocks(css);
  const kf = {};
  const rules = [];
  const walk = (list, media) => {
    for (const b of list) {
      if (/^@keyframes/.test(b.head)) kf[b.head.split(/\s+/)[1]] = b.body;
      else if (/^@(media|supports)/.test(b.head)) {
        if (/prefers-reduced-motion|animation-timeline/.test(b.head)) continue;
        walk(blocks(b.body), b.head);
      } else if (!b.head.startsWith("@")) {
        const d = decls(b.body);
        if (d.some(([p]) => p === "animation-timeline")) continue;
        rules.push({ head: b.head, d, media });
      }
    }
  };
  walk(top, "");
  const out = { text: { s: "", l: "" }, prop: { s: "", l: "" } };
  const stat = { text: { anim: 0, moved: 0, kinds: {}, fS: [], same: 0 }, prop: { anim: 0, moved: 0, trans: 0, loop: 0, same: 0 } };
  for (const grp of ["text", "prop"]) for (const lv of ["s", "l"]) {
    const tagK = "-g" + (grp === "text" ? "m" : "p") + lv;
    const rootCls = "." + pre + "g" + (grp === "text" ? "m" : "p") + "-" + lv;
    const kfOut = /* @__PURE__ */ new Map();
    const lines = [];
    let anyAnim = false, anyTrans = false;
    const variant = (name, alt, loop) => {
      const key = name + (alt ? "|a" : "");
      if (kfOut.has(key)) return kfOut.get(key);
      let f = F[lv];
      if (grp === "text" && lv === "s" && capB.textSf) f = capB.textSf;
      let r = scaleKf(kf[name], f, { text: grp === "text", alt });
      if (grp === "text" && lv === "s" && !capB.textSf && r.moved && r.est > 0 && r.est * f < FLOOR) {
        f = Math.min(1, FLOOR / r.est);
        r = f >= 0.995 ? Object.assign(r, { changed: false, moved: false }) : scaleKf(kf[name], f, { text: true, alt });
      }
      const v = { name: r.changed ? name + tagK + (alt ? "a" : "") : name, r, f, body: r.body };
      kfOut.set(key, v);
      return v;
    };
    const mine = rules.filter((r) => {
      const g = splitTop(r.head, ",").map((s) => groupOf(s, info));
      r._g = g;
      return g.some((x) => x === grp || x === "both");
    });
    const idTf = (v) => {
      const t = parseTf(v);
      return !!t && t.every((o) => o.fn === "perspective" || o.a.every((x, i) => Math.abs(x - ID(o.fn)[i]) < 4e-3));
    };
    const openId = grp === "text" && mine.some((r) => /[open]/.test(r.head) && r.d.some(([p, v]) => p === "transform" && idTf(v)));
    let anyX = false;
    for (const r of mine) {
      const nd = [];
      let chA = false, chT = false;
      if (openId && !/[open]/.test(r.head) && r.d.some(([p, v]) => p === "opacity" && +v === 0)) {
        const td = r.d.find(([p]) => p === "transform");
        const t = td && parseTf(td[1]);
        if (t && t.length && !idTf(td[1])) {
          let f = F[lv];
          const tr = t.find((o) => o.fn === "translate");
          const est = tr && tr.u[0] !== "%" ? Math.hypot(tr.a[0], tr.a[1]) : 99;
          if (lv === "s" && est * f < FLOOR) f = Math.min(1, FLOOR / est);
          const nt = t.map((o) => ({ fn: o.fn, u: o.u, a: o.a.map((v, i) => {
            const id = ID(o.fn)[i], dev = v - id;
            if (o.fn === "perspective" || ROT.has(o.fn) && Math.abs(dev) >= 60 || o.fn === "scale" && v <= 0.3 || o.fn === "translate" && Math.abs(dev) >= (o.u[i] === "%" ? 60 : 120)) return v;
            return id + dev * f;
          }) }));
          const nv = fmtTf(nt);
          if (nv !== fmtTf(t)) {
            nd.push(["transform", nv, "x"]);
            anyX = true;
            if (lv === "s") stat.text.hid = (stat.text.hid || 0) + 1;
          }
        }
      }
      for (const [p, v] of r.d) {
        if (p === "animation" || p === "animation-name") {
          const imp = /!important\s*$/.test(v) ? "!important" : "";
          const parts = splitTop(v.replace(/\s*!important\s*$/, ""), ",").map((x) => x.trim());
          const np = parts.map((part) => {
            const tok = part.split(/\s+/);
            const ni = tok.findIndex((t) => kf[t] !== void 0);
            if (ni < 0) return part;
            const loop = tok.includes("infinite"), alt = loop && tok.some((t) => /^alternate/.test(t));
            const va = variant(tok[ni], alt, loop);
            if (lv === "s") {
              stat[grp].anim++;
              if (loop) stat[grp].loop = (stat[grp].loop || 0) + 1;
            }
            const ti = tok.map((t, i) => TIME.test(t) ? i : -1).filter((i) => i >= 0);
            let durCh = false;
            if (lv === "s") {
              stat[grp].kinds && (stat[grp].kinds[va.r.kind] = (stat[grp].kinds[va.r.kind] || 0) + 1);
              if (va.r.changed || durCh) stat[grp].moved++;
              else stat[grp].same++;
              if (grp === "text" && va.r.moved) stat.text.fS.push(+va.f.toFixed(2));
            }
            if (va.r.changed) {
              tok[ni] = va.name;
              chA = true;
            }
            if (durCh) chA = true;
            const j = tok.join(" "), jb = bez(j, F[lv]);
            if (jb !== j) chA = true;
            return jb;
          });
          nd.push([p, np.join(",") + imp, "a"]);
        } else if (p === "transition") {
          const n = splitTop(v, ",").map((x) => /^\s*(transform|translate|rotate|scale|all)(?![\w-])/.test(x) ? bez(x, G[lv]) : x).join(",");
          if (n !== v) {
            chT = true;
            if (lv === "s") stat[grp].trans = (stat[grp].trans || 0) + 1;
          }
          nd.push([p, n, "t"]);
        } else if (p === "animation-timing-function") {
          const n = bez(v, F[lv]);
          if (n !== v) chA = true;
          nd.push([p, n, "a"]);
        } else if (/^animation-|^transition-/.test(p)) nd.push([p, v, p[0]]);
      }
      r._nd = nd;
      r._chA = chA;
      r._chT = chT;
      if (chA) anyAnim = true;
      if (chT) anyTrans = true;
    }
    if (!anyAnim && !anyTrans && !anyX) continue;
    for (const [key, v] of kfOut) if (v.r.changed) lines.push("@keyframes " + v.name + "{" + v.body + "}");
    for (const r of mine) {
      const keep = r._nd.filter((x) => x[2] === "a" && anyAnim || x[2] === "t" && anyTrans || x[2] === "x");
      if (!keep.length) continue;
      const sels = splitTop(r.head, ",").map((s, i) => r._g[i] === grp || r._g[i] === "both" ? addRoot(s.trim(), k, rootCls) : null).filter(Boolean);
      if (!sels.length) continue;
      const line = sels.join(",") + "{" + keep.map((x) => x[0] + ":" + x[1]).join(";") + "}";
      lines.push(r.media ? r.media + "{" + line + "}" : line);
    }
    out[grp][lv] = lines.join("\n");
  }
  const endOf = (name, tok) => {
    const want = tok.includes("reverse") || tok.includes("alternate-reverse") ? 0 : 100, o = [];
    for (const b of blocks(kf[name] || "")) {
      const ps = b.head.split(",").map((x) => {
        x = x.trim();
        return x === "from" ? 0 : x === "to" ? 100 : parseFloat(x);
      });
      if (!ps.includes(want)) continue;
      for (const [pp, vv] of decls(b.body)) if (pp !== "animation-timing-function") o.push(pp + ":" + vv.replace(/\s*!important\s*$/, "") + "!important");
    }
    return o;
  };
  for (const grp of ["text", "prop"]) {
    const rootCls = "." + pre + "g" + (grp === "text" ? "m" : "p") + "-0";
    const lines = [];
    let pins = 0;
    for (const r of rules) {
      const g = splitTop(r.head, ",").map((s) => groupOf(s, info));
      if (!g.some((x) => x === grp || x === "both")) continue;
      const A = r.d.filter(([p]) => /^animation/.test(p)), T = r.d.filter(([p]) => /^transition/.test(p));
      if (!A.length && !T.length) continue;
      const flow = A.some(([p, v]) => p === "animation" && splitTop(v, ",").some((part) => {
        const tok = part.trim().split(/\s+/), name = tok.find((t) => kf[t] !== void 0);
        return name && tok.includes("infinite") && !tok.some((t) => /^alternate/.test(t)) && /translate(X)?\(\s*-100%/.test(kf[name]);
      }));
      if (flow) {
        if (!T.length) continue;
        A.length = 0;
      }
      const dd = [];
      if (A.length) dd.push("animation:none" + (A.some(([, v]) => /!important/.test(v)) ? "!important" : ""));
      if (T.length) dd.push("transition:none" + (T.some(([, v]) => /!important/.test(v)) ? "!important" : ""));
      const fillD = A.some(([p, v]) => p === "animation-fill-mode" && /forwards|both/.test(v));
      for (const [p, v] of A) if (p === "animation") for (const part of splitTop(v.replace(/\s*!important\s*$/, ""), ",")) {
        const tok = part.trim().split(/\s+/), name = tok.find((t) => kf[t] !== void 0);
        if (!name || tok.includes("infinite") || !(fillD || tok.includes("forwards") || tok.includes("both"))) continue;
        const e = endOf(name, tok);
        if (e.length) {
          dd.push(...e);
          pins++;
        }
      }
      const sels = splitTop(r.head, ",").map((s, i) => g[i] === grp || g[i] === "both" ? addRoot(s.trim(), k, rootCls) : null).filter(Boolean);
      if (!sels.length) continue;
      const line = sels.join(",") + "{" + dd.join(";") + "}";
      lines.push(r.media ? r.media + "{" + line + "}" : line);
    }
    const seen = /* @__PURE__ */ new Set();
    for (const it of info.inline) {
      const zg = it.zone === "lg" ? "text" : "prop";
      if (zg !== grp || !it.cls || seen.has(it.cls)) continue;
      seen.add(it.cls);
      const dd = ["animation:none!important"];
      for (const part of splitTop(it.v, ",")) {
        const tok = part.trim().split(/\s+/), name = tok.find((t) => kf[t] !== void 0);
        if (name && !tok.includes("infinite") && (tok.includes("forwards") || tok.includes("both"))) {
          dd.push(...endOf(name, tok));
          pins++;
        }
      }
      lines.push("." + k + rootCls + " ." + it.cls + "{" + dd.join(";") + "}");
    }
    out[grp]["0"] = lines.join("\n");
    stat[grp].pins = pins;
    stat[grp].inlineNoCls = info.inline.filter((it) => (it.zone === "lg" ? "text" : "prop") === grp && !it.cls).length;
  }
  return { info, css, add: out, stat };
}
function stripOld(css, info) {
  const P = info.pre;
  const re = new RegExp("\\." + P.replace(/-/g, "\\-") + "g[mp]\\-[sml0](?![\\w-])");
  let out = "", last = 0;
  for (const b of blocks(css)) {
    const old = /^@keyframes\s+\S+-g[mp][sl]a?$/.test(b.head) || re.test(b.head) && !/^@keyframes/.test(b.head) || /^@(media|supports)/.test(b.head) && re.test(b.body) && /\bg[mp]-/.test(b.body) && blocks(b.body).every((x) => re.test(x.head));
    if (old) {
      out += css.slice(last, b.start).replace(/\n$/, "");
      last = b.end;
    }
  }
  return out + css.slice(last);
}
function applyLevel(html, opt = {}) {
  const b = build(html, opt);
  if (!b) return html;
  const { info, css, add } = b;
  const P = info.pre;
  const cap = Object.assign({}, opt.key && CAP[opt.key], opt.cap);
  const LV = (v) => v === "off" || v === 0 || v === "0" ? "0" : v === "s" || v === "l" ? v : "m";
  const lv = { text: LV(opt.text), prop: LV(opt.prop) };
  if (cap.textL === false) {
    add.text.l = "";
  }
  if (cap.propL === false) {
    add.prop.l = "";
  }
  const want = [];
  for (const g of ["text", "prop"]) for (const l of ["0", "s", "l"]) if (add[g][l] && (opt.emit === "all" || lv[g] === l)) want.push(add[g][l]);
  if (opt.phone) for (const g of ["text", "prop"]) {
    if (!add[g].s) continue;
    const c = P + "g" + (g === "text" ? "m" : "p");
    const not = ":not(." + c + "-m):not(." + c + "-l)";
    const body = add[g].s.split("." + c + "-s").join(not);
    want.push("@media (max-width:480px){" + body.split("\n").filter((x) => !x.startsWith("@keyframes")).join("\n") + "}");
    const kfs = add[g].s.split("\n").filter((x) => x.startsWith("@keyframes"));
    if (kfs.length && !(opt.emit === "all" || lv[g] === "s")) want.push(kfs.join("\n"));
  }
  let ncss = css;
  if (want.length) {
    const cut = ncss.indexOf("\n\n");
    const at = cut < 0 ? ncss.length : cut;
    ncss = ncss.slice(0, at).replace(/\n$/, "") + "\n" + want.join("\n") + ncss.slice(at);
  }
  let out = html.slice(0, info.si) + ncss + html.slice(info.se);
  if (opt.mark !== false) {
    const keep = info.rootCls.filter((c) => !new RegExp("^" + P + "g[mp]-[sml0]$").test(c));
    const extra = [];
    if (lv.text !== "m" && (add.text[lv.text] || opt.emit === "all")) extra.push(P + "gm-" + lv.text);
    else if (opt.phone && lv.text === "m" && opt.text) extra.push(P + "gm-m");
    if (lv.prop !== "m" && (add.prop[lv.prop] || opt.emit === "all")) extra.push(P + "gp-" + lv.prop);
    else if (opt.phone && lv.prop === "m" && opt.prop) extra.push(P + "gp-m");
    out = out.slice(0, info.rootAt) + '<div class="' + keep.concat(extra).join(" ") + '"><style>' + out.slice(info.si);
  }
  return out;
}
function applyAll(html, opt = {}) {
  const parts = html.split(/(?=<div class="gk [^"]*"><style>)/);
  return parts.map((p) => /^<div class="gk [^"]*"><style>/.test(p) ? applyLevel(p, opt) : p).join("");
}
function describe(html, opt = {}) {
  const b = build(html, opt);
  if (!b) return null;
  const cap = Object.assign({}, opt.key && CAP[opt.key], opt.cap);
  return { k: b.info.k, pre: b.info.pre, text: { off: !!b.add.text["0"], s: !!b.add.text.s, l: !!b.add.text.l && cap.textL !== false }, prop: { off: !!b.add.prop["0"], s: !!b.add.prop.s, l: !!b.add.prop.l && cap.propL !== false }, stat: b.stat, bytes: { textS: b.add.text.s.length, textL: b.add.text.l.length, propS: b.add.prop.s.length, propL: b.add.prop.l.length, textOff: b.add.text["0"].length, propOff: b.add.prop["0"].length } };
}
function wrap(nn) {
  return (no, html, opt = {}) => {
    if (!opt || !opt.gm && !opt.gp && !opt.gmAll) return html;
    try {
      const info = frameInfo(html);
      return applyLevel(html, { text: opt.gm, prop: opt.gp, key: nn + ":" + (info ? info.k : ""), phone: !!opt.gmPhone, emit: opt.gmAll ? "all" : "chosen" });
    } catch (e) {
      return html;
    }
  };
}
function wrapPage(html, env = globalThis.process?.env || {}) {
  if (!env.GM_TEXT && !env.GM_PROP && !env.GM_ALL) return html;
  try {
    const parts = html.split(/(?=<div class="gk [^"]*"><style>)/);
    return parts.map((p) => {
      if (!/^<div class="gk [^"]*"><style>/.test(p)) return p;
      const info = frameInfo(p);
      const k = info ? info.k.replace(/^gk-/, "") : "";
      return applyLevel(p, { text: env.GM_TEXT, prop: env.GM_PROP, key: (/^kb/.test(k) ? "기본:" : "새:") + k, emit: env.GM_ALL ? "all" : "chosen" });
    }).join("");
  } catch (e) {
    return html;
  }
}
const CAP = { "k1266": { "propL": false }, "k1017": { "propL": false }, "k1209": { "textL": false }, "k1197": { "textSf": 0.65 }, "k1218": { "textL": false }, "k1081": { "propL": false }, "k1057": { "propL": false }, "k1179": { "textL": false }, "k1180": { "textL": false }, "k1165": { "propL": false }, "k1119": { "textL": false }, "k1005": { "propL": false }, "k1322": { "propL": false }, "k1326": { "textL": false }, "k1328": { "textL": false }, "k1330": { "textL": false }, "k1350": { "propL": false } };
const FELT = { "k1132": { "ps": false, "pl": false }, "k1012": { "ps": false, "pl": false }, "k1275": { "ts": false, "tl": false }, "k1023": { "ps": false, "pl": false }, "k1131": { "pl": false }, "k1078": { "ps": false }, "k1024": { "ps": false, "pl": false }, "k1013": { "ps": false, "pl": false }, "k1014": { "ps": false, "pl": false }, "k1015": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1016": { "ts": false, "ps": false, "tl": false }, "k1277": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1266": { "tl": false }, "k1267": { "ts": false, "tl": false }, "k1206": { "ps": false }, "k1201": { "ts": false }, "k1128": { "ts": false, "tl": false }, "k1215": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1113": { "ts": false, "tl": false }, "k1120": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1279": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1202": { "ps": false, "pl": false }, "k1125": { "ts": false, "tl": false }, "k1268": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1280": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1017": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1214": { "ts": false, "tl": false }, "k1126": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1121": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1129": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1033": { "ps": false, "pl": false }, "k1211": { "ts": false, "ps": false, "pl": false }, "k1133": { "ps": false, "pl": false }, "k1195": { "ps": false, "tl": false, "pl": false }, "k1209": { "ps": false, "pl": false }, "k1196": { "ts": false, "tl": false, "pl": false }, "k1296": { "ps": false, "tl": false, "pl": false }, "k1197": { "ps": false, "pl": false }, "k1263": { "ps": false, "tl": false, "pl": false }, "k1198": { "ts": false, "ps": false, "pl": false }, "k1244": { "ps": false, "pl": false }, "k1200": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1205": { "ps": false, "pl": false }, "k1203": { "ts": false, "ps": false, "pl": false }, "k1122": { "ts": false, "tl": false }, "k1142": { "ts": false, "tl": false }, "k1199": { "ps": false, "pl": false }, "k1229": { "tl": false }, "k1184": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1213": { "ts": false, "ps": false, "tl": false }, "k1297": { "ps": false, "pl": false }, "k1239": { "ps": false, "pl": false }, "k1114": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1272": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1210": { "tl": false }, "k1273": { "ts": false }, "k1204": { "ps": false, "pl": false }, "k1220": { "tl": false }, "k1216": { "ps": false, "pl": false }, "k1226": { "ts": false, "tl": false }, "k1221": { "ps": false, "pl": false }, "k1240": { "ps": false, "pl": false }, "k1222": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1228": { "ps": false, "pl": false }, "k1225": { "ps": false, "pl": false }, "k1101": { "ps": false, "pl": false }, "k1102": { "ts": false, "tl": false }, "k1299": { "ps": false, "pl": false }, "k1103": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1217": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1192": { "ps": false, "pl": false }, "k1300": { "ps": false, "pl": false }, "k1183": { "ts": false, "tl": false }, "k1218": { "ps": false }, "k1104": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1050": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1051": { "ts": false, "tl": false }, "k1061": { "ts": false, "tl": false }, "k1045": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1095": { "ps": false, "pl": false }, "k1042": { "ts": false, "tl": false }, "k1269": { "ts": false, "tl": false }, "k1127": { "ts": false, "tl": false }, "k1301": { "tl": false }, "k1302": { "ps": false, "pl": false }, "k1270": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1046": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1241": { "ps": false, "pl": false }, "k1242": { "tl": false }, "k1115": { "ts": false, "tl": false }, "k1254": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1236": { "ps": false, "pl": false }, "k1237": { "ps": false, "pl": false }, "k1047": { "ts": false, "tl": false }, "k1304": { "ps": false, "pl": false }, "k1238": { "ps": false, "pl": false }, "k1243": { "ps": false, "pl": false }, "k1062": { "ts": false, "tl": false }, "k1156": { "ts": false, "ps": false, "pl": false }, "k1066": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1265": { "ts": false, "tl": false }, "k1305": { "ts": false, "ps": false, "pl": false }, "k1096": { "ts": false, "ps": false, "pl": false }, "k1186": { "ts": false, "ps": false, "tl": false }, "k1043": { "ts": false, "tl": false }, "k1248": { "ps": false, "pl": false }, "k1194": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1137": { "ts": false, "tl": false }, "k1306": { "ps": false, "pl": false }, "k1041": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1253": { "ps": false, "pl": false }, "k1021": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1285": { "ts": false, "tl": false }, "k1048": { "ts": false, "tl": false }, "k1246": { "ps": false, "tl": false, "pl": false }, "k1075": { "ps": false, "pl": false }, "k1079": { "ps": false, "pl": false }, "k1116": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1160": { "ps": false }, "k1182": { "ts": false, "tl": false }, "k1063": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1111": { "ps": false, "pl": false }, "k1018": { "ps": false, "pl": false }, "k1052": { "ts": false, "tl": false }, "k1257": { "ts": false }, "k1310": { "ts": false, "ps": false, "tl": false }, "k1162": { "ps": false, "pl": false }, "k1035": { "ps": false }, "k1141": { "ps": false, "pl": false }, "k1025": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1145": { "ts": false, "tl": false }, "k1283": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1010": { "ts": false, "tl": false }, "k1249": { "ps": false, "pl": false }, "k1251": { "ps": false, "pl": false }, "k1152": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1009": { "ts": false, "tl": false }, "k1026": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1068": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1055": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1036": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1281": { "ts": false, "tl": false }, "k1059": { "ts": false, "tl": false }, "k1151": { "ts": false, "tl": false }, "k1153": { "ts": false, "tl": false }, "k1090": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1130": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1011": { "ts": false, "tl": false }, "k1282": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1019": { "ts": false, "tl": false }, "k1085": { "ps": false, "pl": false }, "k1143": { "ts": false, "tl": false }, "k1053": { "ps": false, "pl": false }, "k1020": { "ts": false, "tl": false }, "k1138": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1091": { "ts": false, "tl": false }, "k1144": { "ts": false, "tl": false }, "k1288": { "ts": false, "ps": false, "pl": false }, "k1064": { "ps": false, "pl": false }, "k1252": { "tl": false }, "k1054": { "ts": false, "tl": false }, "k1261": { "ps": false, "pl": false }, "k1097": { "ts": false, "tl": false }, "k1029": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1056": { "ts": false, "tl": false }, "k1069": { "ts": false, "tl": false }, "k1001": { "ts": false, "tl": false }, "k1287": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1092": { "ts": false, "tl": false }, "k1262": { "ps": false, "pl": false }, "k1037": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1176": { "ts": false, "tl": false }, "k1067": { "ps": false, "tl": false, "pl": false }, "k1286": { "ps": false, "tl": false, "pl": false }, "k1071": { "ps": false, "pl": false }, "k1166": { "ps": false, "pl": false }, "k1191": { "ts": false, "tl": false }, "k1123": { "ts": false, "tl": false }, "k1072": { "ps": false, "pl": false }, "k1028": { "ts": false, "tl": false }, "k1219": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1139": { "ps": false, "tl": false, "pl": false }, "k1284": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1065": { "ts": false, "tl": false }, "k1258": { "ps": false, "pl": false }, "k1259": { "ps": false, "pl": false }, "k1070": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1147": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1088": { "ps": false, "pl": false }, "k1098": { "ts": false, "tl": false, "pl": false }, "k1058": { "tl": false }, "k1099": { "ts": false, "tl": false }, "k1074": { "ps": false }, "k1155": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1171": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1027": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1038": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1093": { "ts": false, "tl": false }, "k1291": { "ps": false, "pl": false }, "k1312": { "ts": false }, "k1185": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1106": { "ps": false, "pl": false }, "k1294": { "ts": false, "tl": false }, "k1031": { "ts": false, "tl": false }, "k1105": { "ts": false, "tl": false }, "k1148": { "ps": false, "pl": false }, "k1172": { "ts": false, "tl": false }, "k1295": { "ts": false, "tl": false }, "k1118": { "ps": false, "pl": false }, "k1163": { "ts": false, "ps": false, "pl": false }, "k1187": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1175": { "ts": false, "tl": false }, "k1107": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1174": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1087": { "ps": false, "pl": false }, "k1006": { "tl": false }, "k1189": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1108": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1109": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1110": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1159": { "ts": false, "ps": false, "pl": false }, "k1292": { "tl": false }, "k1293": { "ts": false, "ps": false, "pl": false }, "k1169": { "ps": false, "pl": false }, "k1030": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1004": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1117": { "ts": false, "tl": false }, "k1274": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1313": { "ps": false, "pl": false }, "k1089": { "ts": false, "tl": false }, "k1149": { "ps": false, "pl": false }, "k1190": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1315": { "ts": false, "tl": false }, "k1316": { "ps": false, "pl": false }, "k1317": { "ps": false, "pl": false }, "k1321": { "ps": false, "pl": false }, "k1324": { "ts": false, "ps": false, "tl": false }, "k1325": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1326": { "ps": false, "pl": false }, "k1327": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1328": { "ps": false, "pl": false }, "k1329": { "ps": false }, "k1330": { "ps": false, "pl": false }, "k1331": { "ts": false, "tl": false }, "k1332": { "ps": false, "pl": false }, "k1334": { "ps": false, "pl": false }, "k1336": { "ps": false, "pl": false }, "k1338": { "tl": false }, "k1339": { "ps": false }, "k1340": { "ps": false, "pl": false }, "k1341": { "ps": false, "pl": false }, "k1342": { "ps": false, "pl": false }, "k1343": { "ts": false, "ps": false, "pl": false }, "k1347": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1348": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1349": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1355": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1356": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1357": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1358": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1359": { "ts": false, "tl": false }, "k1360": { "ts": false, "tl": false }, "k1362": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1363": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1364": { "ts": false, "tl": false }, "k1365": { "ps": false, "pl": false }, "k1344": { "ps": false, "pl": false }, "k1345": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1346": { "ts": false, "tl": false, "pl": false }, "k1368": { "ts": false, "tl": false }, "k1369": { "ps": false, "pl": false }, "k1": { "ts": false, "ps": false, "tl": false, "pl": false }, "k2": { "ts": false, "ps": false, "tl": false, "pl": false }, "k3": { "ts": false, "ps": false, "tl": false, "pl": false }, "k4": { "ts": false, "ps": false, "tl": false, "pl": false }, "k5": { "ts": false, "ps": false, "tl": false, "pl": false }, "k6": { "ts": false, "ps": false, "tl": false, "pl": false }, "k7": { "ts": false, "ps": false, "tl": false, "pl": false }, "k8": { "ps": false, "tl": false, "pl": false }, "k09": { "ts": false, "ps": false, "tl": false, "pl": false }, "k10": { "ts": false, "ps": false, "tl": false, "pl": false }, "k11": { "ts": false, "ps": false, "tl": false, "pl": false }, "k12": { "ts": false, "ps": false, "tl": false, "pl": false }, "k13": { "ts": false, "ps": false, "tl": false, "pl": false }, "k14": { "ps": false, "pl": false }, "k15": { "ps": false }, "k16": { "ts": false, "tl": false }, "k17": { "ps": false, "pl": false }, "k18": { "ps": false }, "q01": { "ts": false, "ps": false, "tl": false, "pl": false }, "q02": { "ps": false, "pl": false }, "q04": { "ts": false, "ps": false, "pl": false }, "q06": { "ts": false, "tl": false }, "q07": { "ts": false, "ps": false, "pl": false }, "q08": { "ts": false, "ps": false, "tl": false, "pl": false }, "q09": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1429": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1430": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1431": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1433": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1434": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1435": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1436": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1437": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1438": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1439": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1440": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1441": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1442": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1443": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1444": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1445": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1446": { "ts": false, "ps": false, "tl": false, "pl": false }, "k1447": { "ts": false, "ps": false, "tl": false, "pl": false } };
export {
  CAP,
  F,
  FELT,
  G,
  applyAll,
  applyLevel,
  bez,
  build,
  describe,
  scaleKf,
  wrap,
  wrapPage
};
