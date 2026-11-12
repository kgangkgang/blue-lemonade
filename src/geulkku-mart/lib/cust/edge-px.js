// 생성물 — 글꾸 마트 mart/lib/cust/edge-px.js 사본(마트 97a96f7a · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.
const f2 = (v) => String(+(+v).toFixed(2));
const attr = (a, k) => {
  const m = a.match(new RegExp("(?:^|\\s)" + k + '="([^"]*)"'));
  return m ? m[1] : null;
};
function pathSegs(d) {
  const out = [];
  let i = 0;
  const n = d.length;
  const ws = () => {
    while (i < n && /[\s,]/.test(d[i])) i++;
  };
  const num = () => {
    ws();
    const m = /^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/i.exec(d.slice(i, i + 40));
    if (!m) {
      i = n;
      return NaN;
    }
    i += m[0].length;
    return +m[0];
  };
  const flag = () => {
    ws();
    const c2 = d[i];
    i++;
    return c2 === "1" ? 1 : 0;
  };
  const more = () => {
    ws();
    return i < n && /[-.\d]/.test(d[i]);
  };
  let c = "", x = 0, y = 0, sx = 0, sy = 0, pcx = null, pcy = null, pq = null;
  const push = (t, nx, ny, cmd) => {
    out.push({ t, x0: x, y0: y, x1: nx, y1: ny, cmd });
    x = nx;
    y = ny;
  };
  while (i < n) {
    ws();
    if (i >= n) break;
    if (/[a-zA-Z]/.test(d[i])) {
      c = d[i++];
      if (c === "Z" || c === "z") {
        if (x !== sx || y !== sy) push("L", sx, sy, "L" + f2(sx) + " " + f2(sy));
        pcx = pq = null;
        continue;
      }
    } else if (!c) break;
    if (!more()) {
      if (!/[a-zA-Z]/.test(d[i] || "")) break;
      continue;
    }
    const r = c === c.toLowerCase(), ox = r ? x : 0, oy = r ? y : 0, C = c.toUpperCase();
    if (C === "M") {
      x = ox + num();
      y = oy + num();
      sx = x;
      sy = y;
      c = r ? "l" : "L";
      pcx = pq = null;
    } else if (C === "L") {
      const nx = ox + num(), ny = oy + num();
      push("L", nx, ny, "L" + f2(nx) + " " + f2(ny));
      pcx = pq = null;
    } else if (C === "H") {
      const nx = ox + num();
      push("L", nx, y, "L" + f2(nx) + " " + f2(y));
      pcx = pq = null;
    } else if (C === "V") {
      const ny = oy + num();
      push("L", x, ny, "L" + f2(x) + " " + f2(ny));
      pcx = pq = null;
    } else if (C === "C") {
      const a = ox + num(), b = oy + num(), e = ox + num(), f = oy + num(), nx = ox + num(), ny = oy + num();
      push("C", nx, ny, "C" + [a, b, e, f, nx, ny].map(f2).join(" "));
      pcx = [e, f];
      pq = null;
    } else if (C === "S") {
      const a = pcx ? 2 * x - pcx[0] : x, b = pcx ? 2 * y - pcx[1] : y, e = ox + num(), f = oy + num(), nx = ox + num(), ny = oy + num();
      push("C", nx, ny, "C" + [a, b, e, f, nx, ny].map(f2).join(" "));
      pcx = [e, f];
      pq = null;
    } else if (C === "Q") {
      const a = ox + num(), b = oy + num(), nx = ox + num(), ny = oy + num();
      push("Q", nx, ny, "Q" + [a, b, nx, ny].map(f2).join(" "));
      pq = [a, b];
      pcx = null;
    } else if (C === "T") {
      const a = pq ? 2 * x - pq[0] : x, b = pq ? 2 * y - pq[1] : y, nx = ox + num(), ny = oy + num();
      push("Q", nx, ny, "Q" + [a, b, nx, ny].map(f2).join(" "));
      pq = [a, b];
      pcx = null;
    } else if (C === "A") {
      const rx = num(), ry = num(), rot = num(), la = flag(), sw = flag(), nx = ox + num(), ny = oy + num();
      push("A", nx, ny, "A" + [rx, ry, rot].map(f2).join(" ") + " " + la + " " + sw + " " + f2(nx) + " " + f2(ny));
      pcx = pq = null;
    } else break;
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
  }
  return out;
}
const isAxis = (s) => s.t === "L" && (Math.abs(s.x1 - s.x0) < 1e-6 || Math.abs(s.y1 - s.y0) < 1e-6);
const segLen = (s) => Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
const turned = (tf) => {
  if (!tf) return false;
  if (/skew|matrix/.test(tf)) return true;
  const m = tf.match(/rotate\(\s*(-?[\d.]+)/g) || [];
  return m.some((r) => {
    const a = Math.abs(parseFloat(r.replace(/rotate\(\s*/, ""))) % 90;
    return a > 0.01 && a < 89.99;
  });
};
const FEATHER = (col) => ' fill="none" stroke="' + col + '" stroke-opacity=".45"';
const SELF = (col, join) => ' stroke="' + col + '" stroke-opacity=".45"' + (join ? ' stroke-linejoin="round"' : "");
const featherPath = (list, col, tf) => {
  let d = "", px2 = null, py = null;
  for (const s of list) {
    d += (s.x0 === px2 && s.y0 === py ? "" : "M" + f2(s.x0) + " " + f2(s.y0)) + s.cmd;
    px2 = s.x1;
    py = s.y1;
  }
  return d ? '<path d="' + d + '"' + FEATHER(col) + ' stroke-linejoin="round"' + (tf ? ' transform="' + tf + '"' : "") + "/>" : "";
};
const OLD_FZ = /<path d="[^"]*" fill="none" stroke="[^"]*" stroke-opacity="\.45"(?: stroke-width="1")?(?: stroke-linejoin="round")?(?: transform="[^"]*")?\/>/g;
const SKIP_IN = /^(defs|mask|clipPath|pattern|text|symbol|marker|linearGradient|radialGradient|filter)$/;
function px(svg) {
  svg = String(svg);
  if (!/<svg\b/.test(svg) || /crispEdges|preserveAspectRatio="none"|viewBox="0 0 472 472"|data-px="0"/.test(svg)) return svg;
  svg = svg.replace(OLD_FZ, "");
  const st = [];
  let skip = 0, out = "", last = 0, lastEl = "", doneG = null;
  const re = /<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g;
  let m;
  const top = () => st[st.length - 1] || { fill: "#000", stroke: null, sw: 1, op: false, rot: false, done: false, round: false };
  while (m = re.exec(svg)) {
    out += svg.slice(last, m.index);
    last = re.lastIndex;
    let tag = m[0];
    const close = m[1] === "/", name = m[2], a = m[3], self = m[4] === "/";
    if (close) {
      if (SKIP_IN.test(name)) skip--;
      else if (name === "g" || name === "svg") st.pop();
      out += tag;
      lastEl = tag;
      continue;
    }
    if (SKIP_IN.test(name)) {
      if (!self) skip++;
      out += tag;
      lastEl = tag;
      continue;
    }
    const p = top();
    const fillA = attr(a, "fill"), strokeA = attr(a, "stroke"), swA = attr(a, "stroke-width"), tf = attr(a, "transform");
    const cur = { fill: fillA != null ? fillA : p.fill, stroke: strokeA != null ? strokeA === "none" ? null : strokeA : p.stroke, sw: swA != null ? +swA : p.sw, op: p.op || /(?:^|\s)(?:opacity|fill-opacity|stroke-opacity)="/.test(a) || /style="/.test(a), rot: p.rot || turned(tf), done: p.done, round: p.round || /stroke-line(?:cap|join)="round"/.test(a) };
    if (name === "g" || name === "svg") {
      if (!self) {
        if (name === "g") {
          const end = svg.indexOf("</g>", last), inner = end >= 0 ? svg.slice(last, end) : "";
          if (/stroke-opacity="\.45"/.test(a)) doneG = inner;
          else if (doneG != null && doneG === inner) {
            cur.done = true;
            doneG = null;
          }
        }
        st.push(cur);
      }
      out += tag;
      lastEl = tag;
      continue;
    }
    if (skip || cur.op || !/^(path|polygon|polyline|circle|ellipse|rect|line)$/.test(name)) {
      out += tag;
      lastEl = tag;
      continue;
    }
    const filled = cur.fill !== "none" && name !== "line" && name !== "polyline", stroked = !!cur.stroke;
    const okCol = (c) => /^#[0-9a-fA-F]{3,8}$|^rgb\(|^[a-z]+$/.test(c) && c !== "currentColor" && c !== "transparent";
    let segs = null, allTurn = cur.rot;
    if (name === "path") {
      const d = attr(a, "d");
      segs = d ? pathSegs(d) : null;
      if (!segs) {
        out += tag;
        lastEl = tag;
        continue;
      }
    } else if (name === "polygon" || name === "polyline") {
      const q = (attr(a, "points") || "").trim().split(/[\s,]+/).map(Number);
      segs = [];
      const cnt = q.length >> 1;
      for (let k = 0; k < cnt; k++) {
        const j = (k + 1) % cnt;
        if (name === "polyline" && k === cnt - 1) break;
        segs.push({ t: "L", x0: q[2 * k], y0: q[2 * k + 1], x1: q[2 * j], y1: q[2 * j + 1], cmd: "L" + f2(q[2 * j]) + " " + f2(q[2 * j + 1]) });
      }
    } else if (name === "line") {
      segs = [{ t: "L", x0: +attr(a, "x1") || 0, y0: +attr(a, "y1") || 0, x1: +attr(a, "x2") || 0, y1: +attr(a, "y2") || 0, cmd: "" }];
    }
    const body = tag.replace(/\s*\/?>$/, "");
    if (filled && !stroked) {
      if (!okCol(cur.fill)) {
        out += tag;
        lastEl = tag;
        continue;
      }
      if (name === "circle" || name === "ellipse") tag = body + SELF(cur.fill, false) + "/>";
      else if (name === "rect") {
        const x = +attr(a, "x") || 0, y = +attr(a, "y") || 0, w = +attr(a, "width") || 0, h = +attr(a, "height") || 0;
        let rx = attr(a, "rx"), ry = attr(a, "ry");
        rx = rx != null ? +rx : ry != null ? +ry : 0;
        ry = ry != null ? +ry : rx;
        rx = Math.min(rx, w / 2);
        ry = Math.min(ry, h / 2);
        if (allTurn) tag = body + SELF(cur.fill, true) + "/>";
        else if (rx >= 2 && ry >= 2) {
          const A = "A" + f2(rx) + " " + f2(ry) + " 0 0 1 ";
          const d = "M" + f2(x) + " " + f2(y + ry) + A + f2(x + rx) + " " + f2(y) + "M" + f2(x + w - rx) + " " + f2(y) + A + f2(x + w) + " " + f2(y + ry) + "M" + f2(x + w) + " " + f2(y + h - ry) + A + f2(x + w - rx) + " " + f2(y + h) + "M" + f2(x + rx) + " " + f2(y + h) + A + f2(x) + " " + f2(y + h - ry);
          tag = tag + '<path d="' + d + '"' + FEATHER(cur.fill) + (tf ? ' transform="' + tf + '"' : "") + "/>";
        }
      } else {
        const pick = allTurn ? segs.filter((s) => segLen(s) > 0) : segs.filter((s) => !isAxis(s) && segLen(s) > 0);
        if (pick.length && pick.length === segs.filter((s) => segLen(s) > 0).length) tag = body + SELF(cur.fill, segs.some((s) => s.t === "L")) + "/>";
        else if (pick.length) tag = tag + featherPath(pick, cur.fill, tf);
      }
    } else if (stroked && (!filled || cur.fill === cur.stroke) && !cur.done && cur.sw > 0 && okCol(cur.stroke) && !/stroke-opacity="\.45"/.test(lastEl)) {
      const live = segs ? segs.filter((s) => segLen(s) > 0) : null, pick = live ? allTurn ? live : live.filter((s) => !isAxis(s)) : null;
      const flat = name === "rect" ? !allTurn && !(+attr(a, "rx") >= 2) : name === "circle" || name === "ellipse" ? false : !pick.length;
      if (!flat) {
        if (!live || pick.length === live.length || name === "rect") {
          const setA = (u2, k, v) => new RegExp("\\s" + k + '="').test(u2) ? u2.replace(new RegExp("(\\s)" + k + '="[^"]*"'), "$1" + k + '="' + v + '"') : u2 + " " + k + '="' + v + '"';
          let u = setA(body, "stroke-width", f2(cur.sw + 1));
          if (filled) u = setA(u, "fill", "none");
          tag = u + ' stroke-opacity=".45"/>' + tag;
        } else {
          let d = "", qx = null, qy = null;
          for (const s of pick) {
            d += (s.x0 === qx && s.y0 === qy ? "" : "M" + f2(s.x0) + " " + f2(s.y0)) + s.cmd;
            qx = s.x1;
            qy = s.y1;
          }
          const rnd = cur.round ? ' stroke-linecap="round" stroke-linejoin="round"' : "";
          tag = '<path d="' + d + '" fill="none" stroke="' + cur.stroke + '" stroke-width="' + f2(cur.sw + 1) + '" stroke-opacity=".45"' + rnd + (tf ? ' transform="' + tf + '"' : "") + "/>" + tag;
        }
      }
    }
    out += tag;
    lastEl = m[0];
  }
  return out + svg.slice(last);
}
function kinds(svg) {
  const k = { 긴사선: 0, 작은사선: 0, 곡선: 0, 작은원: 0, 둥근끝: 0, 선사선: 0, 선곡선: 0, 돌림: 0, 소수px: 0, 가장자리있음: 0 };
  svg = String(svg);
  if (!/<svg\b/.test(svg) || /viewBox="0 0 472 472"/.test(svg)) return k;
  k.가장자리있음 = (svg.match(/stroke-opacity="\.45"/g) || []).length;
  const bare = svg.replace(OLD_FZ, "");
  const re = /<(path|polygon|polyline|circle|ellipse|rect|line)\b([^>]*?)\/?>/g;
  let m;
  const gNone = /<g[^>]*fill="none"/.test(bare);
  while (m = re.exec(bare)) {
    const name = m[1], a = m[2];
    if (/stroke-opacity="\.45"/.test(a)) continue;
    const stroked = /fill="none"/.test(a) || /(?:^|\s)stroke="/.test(a) || name === "line" || name === "polyline" || gNone && /<g[^>]*fill="none"[^>]*>(?:(?!<\/g>)[\s\S])*$/.test(bare.slice(0, m.index));
    if (turned(attr(a, "transform"))) k.돌림++;
    if (name === "rect") {
      for (const q of ["x", "y", "width", "height"]) {
        const v = attr(a, q);
        if (v != null && Math.abs(+v - Math.round(+v)) > 1e-6) {
          k.소수px++;
          break;
        }
      }
      const rx = +(attr(a, "rx") || attr(a, "ry") || 0), w = +attr(a, "width"), h = +attr(a, "height");
      if (rx >= 2 && rx >= Math.min(w, h) / 2 - 0.01) k.둥근끝++;
      continue;
    }
    if (name === "circle" || name === "ellipse") {
      const r = Math.max(+(attr(a, "r") || 0), +(attr(a, "rx") || 0), +(attr(a, "ry") || 0));
      if (stroked) k.선곡선++;
      else if (r <= 8) k.작은원++;
      else k.곡선++;
      continue;
    }
    let segs = null;
    if (name === "path") segs = pathSegs(attr(a, "d") || "");
    else if (name === "line") segs = [{ t: "L", x0: +attr(a, "x1") || 0, y0: +attr(a, "y1") || 0, x1: +attr(a, "x2") || 0, y1: +attr(a, "y2") || 0 }];
    else {
      const q = (attr(a, "points") || "").trim().split(/[\s,]+/).map(Number);
      segs = [];
      const cnt = q.length >> 1;
      for (let i = 0; i < cnt; i++) {
        const j = (i + 1) % cnt;
        if (name === "polyline" && i === cnt - 1) break;
        segs.push({ t: "L", x0: q[2 * i], y0: q[2 * i + 1], x1: q[2 * j], y1: q[2 * j + 1] });
      }
    }
    if (!segs) continue;
    const diag = segs.filter((s) => s.t === "L" && !isAxis(s) && segLen(s) > 0), curve = segs.filter((s) => s.t !== "L");
    const dl = diag.reduce((t, s) => t + segLen(s), 0);
    if (stroked) {
      if (dl >= 3) k.선사선++;
      if (curve.length) k.선곡선++;
    } else {
      if (dl >= 16) k.긴사선++;
      else if (dl >= 2) k.작은사선++;
      if (curve.length) k.곡선++;
    }
  }
  return k;
}
const svgUrl = (svg) => "url('data:image/svg+xml," + String(svg).replace(/[%#<>"'()&;{}\\]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")) + "')";
function clipMask(w, h, pts) {
  const raw = String(pts).trim().replace(/^polygon\(/, "").replace(/\)$/, "");
  const back = "clip-path:polygon(" + raw + ")";
  const conv = (v, full) => /^-?[\d.]+%$/.test(v) ? +(parseFloat(v) * full / 100).toFixed(2) : /^-?[\d.]+(px)?$/.test(v) ? parseFloat(v) : NaN;
  const P = raw.split(",").map((q) => q.trim().split(/\s+/)).map((q) => [conv(q[0], w), conv(q[1], h)]);
  if (!P.length || P.some((q) => Number.isNaN(q[0]) || Number.isNaN(q[1]))) return back;
  const u = svgUrl(px('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '"><polygon points="' + P.map((q) => q.join(",")).join(" ") + '"/></svg>'));
  return "-webkit-mask-image:" + u + ";mask-image:" + u + ";-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:" + w + "px " + h + "px;mask-size:" + w + "px " + h + "px";
}
export {
  clipMask,
  kinds,
  pathSegs,
  px,
  turned
};
