// 간격 재기(페이지 안 · 문자열로 보내요) — window.__gapMeasure(rootSel): 이웃한 것들 사이의 「실제 틈」을 화소로 재서 돌려줘요.
//   「실제 틈」 = 위 것의 잉크 아래 끝 ↔ 아래 것의 잉크 위 끝. 잉크 = 눈에 보이는 것의 상자:
//     · 칠해진 상자(바탕색이 뒤와 다름 · 테두리 · 그림자 · 그림 · 단추 · 입력칸)는 그 상자(border box)
//     · 글 덩이(글자가 바로 든 block)는 줄 상자(content box — line-height 가 든 높이)
//     · 안 칠해진 싸개는 안에 든 것들의 잉크를 합친 상자(싸개의 padding · margin 은 「틈」 쪽으로 들어가요)
//   그래서 margin · padding · gap 이 어디서 몇 번 더해졌든 눈에 보이는 틈 하나로 재져요. 틈이 어디서 왔는지(위 것 안쪽+바깥 · 부모 gap · 아래 것 바깥+안쪽)도 같이 적어요.
//   돌려주는 것: pairs(세로 · 가로 이웃 쌍 — 같은 꼴은 묶어 세요) · pads(칠해진 상자 안에서 내용이 가장자리에 닿은 곳) · lh(글자 크기 · 줄 높이) · empty(거의 빈 줄)
(() => {
  if (window.__gapMeasure) return true;
  const SKIP = '.mart-preview-in, .mart-sheet-preview, .mart-taste-preview, .bl-frame, .mart-stage, .mart-fit, .mart-ph, .mart-art, .mart-menu-cover, .gn-genie, .gn-sky, .mart-cart-thumb, .mart-tryon-photo, .room-frame-box, .room-stage, .room-stage-wrap, .kb-frame, .showcase, .tour-demo, .palette-stage, #mart-shadow-svg';   // 사용자 글 · 그림이 든 칸 — 한 덩어리(그림)로만 봐요
  const LEAF = 'img, video, canvas, svg, picture, iframe, hr, button, select, input, textarea, summary, a.btn, .btn, .chip, .tab, .pill, .tag, .mart-tag, .ibtn, [role=button], [role=tab], .mart-dn, label.check';   // 안을 들여다보지 않는 것(부품 하나)
  const CONTROL = 'button, summary, a.btn, .btn, .chip, .tab, .ibtn, [role=button], [role=tab], .mart-dn, label.check, input[type=checkbox], input[type=radio], input[type=range]';
  const FIELD = 'select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden])';
  const PILL = '.pill, .tag, .mart-tag, .badge';
  const px = v => parseFloat(v) || 0, R = v => Math.round(v * 2) / 2;
  const csOf = e => getComputedStyle(e);
  const vis = e => { if (!e.getClientRects().length) return false; const cs = csOf(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const rgb = c => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const behind = e => { for (let a = e.parentElement; a; a = a.parentElement) { const c = rgb(csOf(a).backgroundColor); if (c && c[3] >= 0.5) return c; } return [255, 255, 255, 1]; };
  const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 6;
  const lineOn = (w, c) => px(w) > 0 && (rgb(c)?.[3] ?? 0) > 0.03;
  const pathOf = el => { const parts = []; let e = el; for (let k = 0; k < 3 && e && e !== document.body; k++, e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id && !/\d{3,}/.test(e.id)) s += '#' + e.id; const cl = [...e.classList].filter(c => !/^(is-|has-)/.test(c)).slice(0, 2); if (cl.length) s += '.' + cl.join('.'); parts.unshift(s); } return parts.join(' > '); };
  const textOf = el => (el.getAttribute?.('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
  const paintMemo = new WeakMap();
  const paintOf = e => {
    if (paintMemo.has(e)) return paintMemo.get(e);
    const cs = csOf(e), leaf = e.matches(LEAF) || e.matches(SKIP);
    const c = rgb(cs.backgroundColor); let bg = false;
    if (c && c[3] > 0.03) { const u = behind(e); const mix = c.map((v, i) => i < 3 ? Math.round(v * c[3] + u[i] * (1 - c[3])) : 1); bg = !near(mix, u); }
    if (cs.backgroundImage !== 'none') bg = true;
    const bt = lineOn(cs.borderTopWidth, cs.borderTopColor), bb = lineOn(cs.borderBottomWidth, cs.borderBottomColor), bl = lineOn(cs.borderLeftWidth, cs.borderLeftColor), br = lineOn(cs.borderRightWidth, cs.borderRightColor);
    const shadow = cs.boxShadow !== 'none' && !/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px/.test(cs.boxShadow);
    const p = { leaf, bg, bt, bb, shadow, any: leaf || bg || bt || bb || bl || br || shadow };
    paintMemo.set(e, p); return p;
  };
  const flow = e => { const cs = csOf(e); return cs.position !== 'absolute' && cs.position !== 'fixed'; };
  const kidsOf = e => { const out = []; for (const k of e.children) { if (csOf(k).display === 'contents') out.push(...kidsOf(k)); else out.push(k); } return out; };
  /** 글 덩이: 글자가 바로 들었거나 안의 것이 전부 inline 인 block(줄 상자로 재요) */
  const textBlock = e => {
    const d = csOf(e).display; if (!/^(block|list-item|table-cell|inline-block|flow-root)$/.test(d)) return false;
    const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const kids = [...e.children].filter(k => k.getClientRects().length);
    if (!hasText && !kids.length) return false;
    return kids.every(k => /^inline/.test(csOf(k).display) && !k.matches(SKIP)) && (hasText || kids.some(k => k.textContent.trim()));
  };
  const inkMemo = new WeakMap();
  const ink = e => {
    if (inkMemo.has(e)) return inkMemo.get(e);
    let r = null;
    if (vis(e)) {
      const q = e.getBoundingClientRect(), p = paintOf(e), cs = csOf(e);
      if (p.any) r = { t: q.top, b: q.bottom, l: q.left, r: q.right, painted: true };
      else if (textBlock(e)) r = { t: q.top + px(cs.paddingTop), b: q.bottom - px(cs.paddingBottom), l: q.left + px(cs.paddingLeft), r: q.right - px(cs.paddingRight), painted: false, text: true };
      else {
        const rs = [];
        for (const k of e.childNodes) {
          if (k.nodeType === 3 && k.textContent.trim()) { const rg = document.createRange(); rg.selectNodeContents(k); for (const c of rg.getClientRects()) if (c.width > 0.5 && c.height > 0.5) rs.push({ t: c.top, b: c.bottom, l: c.left, r: c.right }); }
        }
        for (const k of kidsOf(e)) { if (!flow(k)) continue; const c = ink(k); if (c) rs.push(c); }
        if (rs.length) {
          r = { t: Math.min(...rs.map(x => x.t)), b: Math.max(...rs.map(x => x.b)), l: Math.min(...rs.map(x => x.l)), r: Math.max(...rs.map(x => x.r)), painted: false };
          if (/(auto|scroll|hidden|clip)/.test(cs.overflowY + cs.overflowX)) { r.t = Math.max(r.t, q.top); r.b = Math.min(r.b, q.bottom); r.l = Math.max(r.l, q.left); r.r = Math.min(r.r, q.right); if (r.b - r.t < 1 || r.r - r.l < 1) r = null; }
        }
      }
    }
    inkMemo.set(e, r); return r;
  };
  const flowKids = e => kidsOf(e).filter(k => flow(k) && ink(k));
  const rowsOf = kids => {   // 세로로 겹치는 것끼리 한 줄
    const list = kids.map(k => ({ el: k, i: ink(k) })).sort((a, b) => a.i.t - b.i.t || a.i.l - b.i.l), rows = [];
    for (const x of list) { const row = rows.at(-1); const mid = (x.i.t + x.i.b) / 2; if (row && mid > row.t && mid < row.b && x.i.t < row.b - 1) { row.items.push(x); row.b = Math.max(row.b, x.i.b); } else rows.push({ t: x.i.t, b: x.i.b, items: [x] }); }
    for (const r of rows) { r.items.sort((a, b) => a.i.l - b.i.l); r.l = Math.min(...r.items.map(x => x.i.l)); r.r = Math.max(...r.items.map(x => x.i.r)); }
    return rows;
  };
  const kindMemo = new WeakMap();
  const kindOf = e => {
    if (kindMemo.has(e)) return kindMemo.get(e);
    const tag = e.tagName.toLowerCase(), cs = csOf(e); let k;
    if (e.matches(SKIP) || /^(img|video|canvas|svg|picture|iframe)$/.test(tag)) k = '그림';
    else if (tag === 'hr') k = '선';
    else if (/^h[1-6]$/.test(tag) || e.getAttribute('role') === 'heading') k = '머리';
    else if (e.matches(PILL)) k = '딱지';
    else if (e.matches(FIELD)) k = '입력칸';
    else if (e.matches(CONTROL)) k = '단추';
    else if (textBlock(e) && !paintOf(e).any) { const fs = px(cs.fontSize), len = e.textContent.trim().length; k = +cs.fontWeight >= 600 && len <= 40 ? '머리' : (tag === 'label' || fs <= 13) ? '작은 글' : '글'; }
    else {
      const p = paintOf(e), q = e.getBoundingClientRect(), kids = flowKids(e);
      if (p.any && !p.leaf && px(cs.borderTopLeftRadius) >= 6 && q.height >= 56) k = '카드';
      else if (p.any && textBlock(e)) k = q.height <= 48 ? '딱지' : '판';
      else if (!kids.length) k = p.any ? '판' : '덩이';
      else if (kids.length === 1 && !p.any) k = kindOf(kids[0]);
      else {
        const rows = rowsOf(kids);
        if (rows.length === 1) { const ks = rows[0].items.map(x => kindOf(x.el)); const ctl = x => x === '단추' || x === '입력칸' || x === '단추 줄'; k = ks.every(ctl) ? '단추 줄' : (/^(작은 글|머리|글)$/.test(ks[0]) && ks.slice(1).every(ctl)) ? '이름표+단추 줄' : '줄'; }
        else k = p.any ? '판' : '묶음';
      }
    }
    kindMemo.set(e, k); return k;
  };
  const sticky = (e, root) => { for (let a = e; a && a !== root.parentElement; a = a.parentElement) { const p = csOf(a).position; if (p === 'sticky' || p === 'fixed') return true; } return false; };
  window.__gapMeasure = rootSel => {
    const root = rootSel ? document.querySelector(rootSel) : document.body; if (!root) return { error: '뿌리 없음 ' + rootSel };
    const pairs = new Map(), pads = new Map(), lh = new Map(), empty = new Map();
    const add = (map, key, rec) => { const v = map.get(key); if (v) v.n++; else map.set(key, { ...rec, n: 1 }); };
    const walk = C => {
      if (!vis(C) || C.matches(SKIP)) return;
      const cs = csOf(C);
      // 줄 높이: 글자가 바로 든 것(부품 안 글자는 한 줄짜리라 빼요 — 딱지는 봐요)
      if ([...C.childNodes].some(n => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent)) && (!C.closest(CONTROL + ', ' + FIELD + ', option, a, nav, .brand') || C.closest(PILL))) {   // 한 줄짜리 단추 · 바로가기 · 머리줄 글자는 줄 높이가 틈을 만들지 않아 빼요
        const fs = R(px(cs.fontSize)), l = cs.lineHeight === 'normal' ? 'normal' : R(px(cs.lineHeight)), role = C.closest(PILL) ? '딱지' : (+cs.fontWeight >= 600 || /^h[1-6]$/i.test(C.tagName)) ? '머리' : '글';
        add(lh, [role, fs, l].join('|'), { role, fs, lh: l, ratio: l === 'normal' ? 'normal' : Math.round(l / fs * 100) / 100, path: pathOf(C), text: textOf(C) });
      }
      if (C.matches(LEAF) || textBlock(C)) return;
      const kids = flowKids(C); if (!kids.length) return;
      const cq = C.getBoundingClientRect(), p = paintOf(C), scroller = /(auto|scroll)/.test(cs.overflowY);
      const rows = rowsOf(kids);
      // 칠해진 상자 안: 내용이 가장자리(위 · 아래)에 닿았는지
      if (p.any && (p.bg || p.bt || p.bb || p.shadow)) {
        const first = rows[0], last = rows.at(-1), top = R(first.t - (cq.top + px(cs.borderTopWidth))), bot = R((cq.bottom - px(cs.borderBottomWidth)) - last.b);
        const fk = first.items[0], lk = last.items[0];
        if (top < 4 && top > -1 && !first.items.some(x => x.i.painted) && !sticky(fk.el, root)) add(pads, ['위', top, pathOf(fk.el)].join('|'), { side: '위', pad: top, path: pathOf(C), kid: pathOf(fk.el), text: textOf(fk.el) });
        if (!scroller && bot < 4 && bot > -1 && !last.items.some(x => x.i.painted) && !sticky(lk.el, root)) add(pads, ['아래', bot, pathOf(lk.el)].join('|'), { side: '아래', pad: bot, path: pathOf(C), kid: pathOf(lk.el), text: textOf(lk.el) });
      }
      const colGap = /flex|grid/.test(cs.display) ? px(cs.rowGap) : 0;
      // 세로 이웃
      for (let i = 1; i < rows.length; i++) {
        const A = rows[i - 1], B = rows[i]; if (Math.min(A.r, B.r) - Math.max(A.l, B.l) < 1) continue;
        const a = A.items.length === 1 ? A.items[0] : null, b = B.items.length === 1 ? B.items[0] : null, ea = (a || A.items[0]).el, eb = (b || B.items[0]).el;
        const gap = R(B.t - A.b); if (gap < -1 || gap > 120) continue;
        const ka = a ? kindOf(a.el) : kindOf(A.items[0].el) + ' 줄', kb = b ? kindOf(b.el) : kindOf(B.items[0].el) + ' 줄';
        let src = null;
        if (a && b) { const qa = ea.getBoundingClientRect(), qb = eb.getBoundingClientRect(), ca = csOf(ea), cb = csOf(eb); src = { 위안: R(qa.bottom - a.i.b), 위밖: R(px(ca.marginBottom)), 부모: R(colGap), 아래밖: R(px(cb.marginTop)), 아래안: R(b.i.t - qb.top) }; }
        const pa = paintOf(ea), pb = paintOf(eb), wide = x => (x.r - x.l) >= (cq.width - px(cs.paddingLeft) - px(cs.paddingRight)) * 0.95;
        const rec = { dir: '세로', gap, ka, kb, pa: pathOf(ea), pb: pathOf(eb), ta: textOf(ea), tb: textOf(eb), aPainted: !!(a && a.i.painted), bPainted: !!(b && b.i.painted), bothText: !!(a && b && a.i.text && b.i.text), round: !!(a && b && (px(csOf(ea).borderBottomLeftRadius) > 2 || px(csOf(eb).borderTopLeftRadius) > 2)), divider: !!(a && b && (pa.bb || pb.bt || (pa.shadow && !pa.leaf) || (pb.shadow && !pb.leaf))), wide: wide(A) && wide(B), sticky: sticky(ea, root) || sticky(eb, root), src };
        add(pairs, ['v', gap, ka, kb, rec.pa, rec.pb].join('|'), rec);
      }
      // 가로 이웃(한 줄 안)
      for (const row of rows) for (let i = 1; i < row.items.length; i++) {
        const a = row.items[i - 1], b = row.items[i], gap = R(b.i.l - a.i.r); if (gap < -1 || gap > 64) continue;
        const ka = kindOf(a.el), kb = kindOf(b.el);
        if (cs.justifyContent === 'space-between' || csOf(b.el).marginLeft === 'auto' || px(csOf(b.el).marginLeft) > 64) continue;   // 양 끝으로 벌린 줄은 틈이 아니에요
        add(pairs, ['h', gap, ka, kb, pathOf(a.el), pathOf(b.el)].join('|'), { dir: '가로', gap, ka, kb, pa: pathOf(a.el), pb: pathOf(b.el), ta: textOf(a.el), tb: textOf(b.el), aPainted: !!a.i.painted, bPainted: !!b.i.painted, divider: false, wide: false, sticky: false, src: null });
      }
      // 거의 빈 줄: 오른쪽 끝에 부품 하나만 있고 폭의 대부분이 빈 줄이 세로 자리를 차지해요
      const innerW = cq.width - px(cs.paddingLeft) - px(cs.paddingRight);
      if (rows.length > 1 && innerW >= 240) for (const row of rows) {
        if (row.items.length !== 1) continue; const x = row.items[0], k = kindOf(x.el), w = x.i.r - x.i.l;
        const innerR = cq.right - px(cs.borderRightWidth) - px(cs.paddingRight);
        if ((k === '단추' || k === '딱지') && w <= innerW * 0.3 && row.b - row.t >= 24 && Math.abs(innerR - x.i.r) <= 4)   // 오른쪽 끝에 부품 하나만 — 왼쪽이 통째로 비어요(왼쪽 · 가운데에 선 단추 하나는 흔한 행동 줄이라 안 세요)
          add(empty, pathOf(x.el), { path: pathOf(x.el), text: textOf(x.el), w: Math.round(w), rowW: Math.round(innerW), h: Math.round(row.b - row.t), kind: k });
      }
      for (const k of kids) walk(k);
    };
    walk(root);
    return { pairs: [...pairs.values()], pads: [...pads.values()], lh: [...lh.values()], empty: [...empty.values()] };
  };
  return true;
})()
