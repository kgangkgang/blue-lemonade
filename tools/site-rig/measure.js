// 사이트용 페이지 안 측정기(문자열로 보내요) — window.__siteMeasure: 가로 넘침 · 폰 누름 상자 44 · 간격 리듬 · 글자 대비 · 아이콘 잉크 대비(계산값) · 가운데 맞춤 후보 열거
//   가운데 맞춤 · 아이콘 잉크의 화소 측정은 site-rig.mjs 가 center(bid) 로 요소를 찾아 사진 세 장을 찍어요(pixel.mjs).
(() => {
  if (window.__siteMeasure) return true;
  const SKIP_IN = '.mart-preview-in, .mart-sheet-preview, .mart-taste-preview, .bl-frame, .mart-stage, .mart-fit, .mart-ph, .mart-art, .mart-menu-cover, .gn-genie, .gn-sky, .mart-cart-thumb, .mart-tryon-photo, .room-frame-box, .room-stage, svg, #mart-shadow-svg';
  const px = v => parseFloat(v) || 0;
  const vis = e => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const inView = r => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const pathOf = el => { const parts = []; let e = el; for (let k = 0; k < 4 && e && e !== document.body; k++, e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const cl = [...e.classList].filter(c => !/^(is-|has-)/.test(c)).slice(0, 3); if (cl.length) s += '.' + cl.join('.'); parts.unshift(s); if (e.id) break; } return parts.join(' > '); };
  const textOf = el => (el.getAttribute?.('aria-label') || el.title || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  const rgb = c => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lumi = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const A = lumi(a), B = lumi(b); return Math.round((Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05) * 100) / 100; };
  const blend = (top, under) => top.map((v, i) => i < 3 ? Math.round(v * top[3] + under[i] * (1 - top[3])) : 1);
  /** 요소 뒤의 실제 바탕색(조상 면을 알파로 겹쳐요 · 가상 요소 면은 안 봐요) */
  function bgOf(el) {
    let acc = null;
    for (let e = el; e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor); if (!c || !c[3]) continue;
      acc = acc ? blend(acc, c) : c; if (c[3] >= 0.999) break;
      if (e === document.documentElement) break;
    }
    if (!acc) acc = [253, 254, 255, 1]; else if (acc[3] < 0.999) acc = blend(acc, [253, 254, 255, 1]);
    return acc;
  }
  const rootOf = s => (s ? document.querySelector(s) : document.body);
  const CLICK = 'button, [role=button], a[href], summary, input:not([type=hidden]), select, textarea, label.check, .mart-tryon-keep';
  const PARTS = '.mart-head, .mart-tabs, .tabset, .mart-tools, .mart-search-row, .mart-filters, .mart-seg, .mart-groups, .mart-chips, .mart-grid, .mart-card, .mart-title, .mart-tags, .mart-actions, .mart-sheet-head, .mart-sheet-name, .mart-sheet-foot, .mart-sheet-extra, .mart-sheet-body, .mart-cart-head, .mart-cart-foot, .mart-cart-list, .mart-cart-list > li, .mart-cart-row, .mart-cart-empty, .mart-cart-empty nav, .mart-tryon, .mart-tryon-body, .mart-tryon-row, .room-head, .room-photo, .room-controls, .room-group, .room-actions, .room-stage-bar, .room-seg, .room-preset, .mart-taste-in, .mart-taste-roles, .mart-taste-fields, .mart-taste-bar, .top-inner, .top-actions, .top nav, .mart-menu, .mart-menu-go, .mart-howto, .mart-params, .mart-random-links, .mart-cards, .mart-cards > a, .gn-head, .gn-result, .btn, .chip, .tab, .tag, .ibtn, .field, .mart-note-line';
  const STEP = new Set([0, 4, 8, 12, 16, 24, 32, 48]);   // 4 · 8 · 12 · 16 · 24 + 쪽 바깥 여백 32 · 48(머리줄 · 본문 좌우 — 8의 배수 큰 단계)
  window.__siteMeasure = {
    overflow(rootSel) {
      const root = rootOf(rootSel); const de = document.documentElement;
      const out = [];
      if (!rootSel && de.scrollWidth > de.clientWidth + 1) out.push({ what: '문서', over: de.scrollWidth - de.clientWidth });
      if (root && root !== document.body && root.scrollWidth > root.clientWidth + 1 && !/(auto|scroll)/.test(getComputedStyle(root).overflowX)) {
        // 손가락 화면의 투명 누름 상자(가상 요소)만 삐져나간 것은 넘침이 아니에요 — 보이는 요소가 뿌리 오른쪽 밖으로 나간 것만 세요
        const rr = root.getBoundingClientRect(); const right = rr.left + root.clientWidth + px(getComputedStyle(root).borderLeftWidth);
        const far = [...root.querySelectorAll('*')].find(e => { if (!vis(e) || e.closest(SKIP_IN)) return false; const q = e.getBoundingClientRect(); if (q.right <= right + 1) return false; for (let a = e.parentElement; a && a !== root; a = a.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return false; return true; });
        if (far) out.push({ what: pathOf(root), over: root.scrollWidth - root.clientWidth, text: '밖으로 나간 것 ' + pathOf(far).split(' > ').at(-1) });
      }
      // 뷰포트 오른쪽 밖으로 삐져나간 보이는 요소(가로로 미는 칸 안은 빼요)
      for (const el of root.querySelectorAll('*')) {
        if (!vis(el) || el.closest(SKIP_IN)) continue;
        const r = el.getBoundingClientRect(); if (r.right <= innerWidth + 1 || r.left >= innerWidth) continue;
        let scroller = false; for (let a = el.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { scroller = true; break; } }
        if (scroller) continue;
        out.push({ what: pathOf(el), over: Math.round(r.right - innerWidth), text: textOf(el) });
        if (out.length > 12) break;
      }
      return out;
    },
    /** 폰: 누르는 요소의 누름 상자(보이는 상자 ∪ 투명 가상 상자)가 44 이상인지 */
    touch(rootSel) {
      const root = rootOf(rootSel), out = [];
      for (const el of root.querySelectorAll(CLICK)) {
        if (!vis(el) || el.closest(SKIP_IN) || el.matches('input[type=range], input[type=color], textarea, .mart-cart-clear, .mart-source, .gn-foot a, .gn-hint button, .text-link')) continue;
        const r = el.getBoundingClientRect(); if (!inView(r)) continue;
        let w = r.width, h = r.height;
        for (const pe of ['::before', '::after']) { const ps = getComputedStyle(el, pe); if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && ps.position === 'absolute' && (ps.backgroundColor === 'rgba(0, 0, 0, 0)' || !ps.backgroundColor)) { const pw = px(ps.width), ph = px(ps.height); if (/max\(/.test(ps.width) || pw >= w) w = Math.max(w, pw || 0); if (ph >= h) h = Math.max(h, ph); } }
        // 상자가 작아도 부모 줄(label · 카드 줄)이 44 이상이면 그 줄이 누르는 넓이
        const lab = el.closest('label'); if (lab && lab !== el) { const q = lab.getBoundingClientRect(); w = Math.max(w, q.width); h = Math.max(h, q.height); for (const pe of ['::before', '::after']) { const ps = getComputedStyle(lab, pe); if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && ps.position === 'absolute' && (ps.backgroundColor === 'rgba(0, 0, 0, 0)' || !ps.backgroundColor)) { w = Math.max(w, px(ps.width)); h = Math.max(h, px(ps.height)); } } }
        if (h < 43.5 || (w < 43.5 && !el.matches('a, input, select'))) out.push({ path: pathOf(el), text: textOf(el), w: Math.round(w), h: Math.round(h) });
      }
      return out;
    },
    /** 간격 리듬: 우리 부품의 gap · padding 이 0 · 4 · 8 · 12 · 16 · 24 밖이면 */
    rhythm(rootSel) {
      const root = rootOf(rootSel), out = [], seen = new Set();
      for (const el of [root, ...root.querySelectorAll(PARTS)]) {
        if (!el.matches || !el.matches(PARTS) || !vis(el) || el.closest(SKIP_IN)) continue;
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if (!inView(r)) continue;
        const vals = [['row-gap', cs.rowGap], ['column-gap', cs.columnGap], ['padding-top', cs.paddingTop], ['padding-bottom', cs.paddingBottom], ['padding-left', cs.paddingLeft], ['padding-right', cs.paddingRight]];
        const bad = [];
        for (const [k, v] of vals) { if (v === 'normal' || v === '') continue; const n = Math.round(px(v) * 2) / 2; if (!STEP.has(n)) bad.push(`${k} ${n}`); }
        if (!bad.length) continue;
        const key = pathOf(el) + '|' + bad.join(','); if (seen.has(key)) continue; seen.add(key);
        out.push({ path: pathOf(el), bad, text: textOf(el).slice(0, 12) });
      }
      return out;
    },
    /** 글자 대비 4.5:1(작은 글자) — 자기 글이 있는 요소 · 꺼진 것(opacity<1 조상)은 빼요 */
    contrast(rootSel) {
      const root = rootOf(rootSel), out = [], seen = new Set();
      for (const el of root.querySelectorAll('*')) {
        if (!vis(el) || el.closest(SKIP_IN) || el.matches('input, textarea, select, option, script, style')) continue;
        if (![...el.childNodes].some(n => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent))) continue;
        const r = el.getBoundingClientRect(); if (!inView(r)) continue;
        let dim = false; for (let a = el; a && a !== document.body; a = a.parentElement) { if (+getComputedStyle(a).opacity < 0.95 || a.matches(':disabled, [aria-disabled="true"]') || a.closest(':disabled')) { dim = true; break; } }
        if (dim) continue;
        const cs = getComputedStyle(el); const fg = rgb(cs.color); if (!fg) continue;
        const bg = bgOf(el); const cr = contrast(fg, bg);
        const big = px(cs.fontSize) >= 24 || (px(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
        if (cr >= (big ? 3 : 4.5)) continue;
        const key = pathOf(el); if (seen.has(key)) continue; seen.add(key);
        out.push({ path: key, text: textOf(el).slice(0, 16), cr, fg: cs.color, bg: `rgb(${bg.slice(0, 3).join(', ')})`, fs: px(cs.fontSize) });
      }
      return out;
    },
    /** 아이콘 잉크(계산값): 마스크 · 선 꺾쇠 가상 요소의 색 ↔ 그 칸 바탕 3:1 · 이모지는 여러 색이라 빼요 */
    iconInk(rootSel) {
      const root = rootOf(rootSel), out = [];
      for (const el of root.querySelectorAll('.ibtn, .x, .chev, .top-mart, .mart-chips-fold, .mart-head-more, .mart-menu-arrow, select, .check input')) {
        if (!vis(el) || el.closest(SKIP_IN)) continue;
        const r = el.getBoundingClientRect(); if (!inView(r)) continue;
        const bg = bgOf(el);
        for (const pe of ['::before', '::after']) {
          const ps = getComputedStyle(el, pe); if (!ps.content || ps.content === 'none' || ps.content === 'normal' || px(ps.width) <= 0) continue;
          const mask = (ps.maskImage && ps.maskImage !== 'none') || (ps.webkitMaskImage && ps.webkitMaskImage !== 'none');
          const ink = rgb(mask ? ps.backgroundColor : (px(ps.borderRightWidth) ? ps.borderRightColor : ps.color)); if (!ink || !ink[3]) continue;
          const cr = contrast(blend(ink, bg), bg);
          if (cr < 3) out.push({ path: pathOf(el), pe, cr, text: textOf(el).slice(0, 16) });
        }
        if (el.matches('select')) { const ink = rgb(getComputedStyle(el).color); if (ink) { const cr = contrast(ink, bg); if (cr < 3) out.push({ path: pathOf(el), pe: 'text', cr, text: textOf(el).slice(0, 16) }); } }
      }
      return out;
    },
    // ── 가운데 맞춤 후보(글자 단추 · 칩 · 탭 · 아이콘 단추 · 접힘 머리 · 꼬리표) → data-px 번호를 붙여 돌려줘요 ──
    centerList(rootSel, max = 120) {
      const root = rootOf(rootSel), out = [];
      let n = Number(document.body.dataset.pxN || 0);
      const SEL = '.btn, .chip, .tab, .ibtn, .pill, .button.small, .top-mart, .top nav a, .mart-head-more, .mart-chips-fold, .mart-bar-fold, .tag, .mart-tag, .mart-actions button, .mart-tabs > a, .mart-tabs > button, .mart-chips > button, .mart-groups > button, .mart-seg > button, .room-seg > button, .mart-cart-x, .mart-sheet-x, .room-x, .mart-cart-del, .mart-cart-btn, .mart-cart-pay, .mart-cart-get, .mart-taste-open, .mart-random-more, .mart-tryon-pick, .mart-tryon-clear, .room-stage-bar button, .room-actions button, .mart-taste-bar button, .mart-taste-swap, .mart-taste-sample, .mart-taste-names, .mart-reset, .mart-cart-empty nav a, .mart-random-links a, .mart-mylog-off, .gn-seg button';
      for (const el of root.querySelectorAll(SEL)) {
        if (el.dataset.px || !vis(el) || el.closest(SKIP_IN) || el.matches(':disabled')) continue;
        const r = el.getBoundingClientRect(); if (!inView(r) || r.height < 12 || r.height > 64 || r.width > 420) continue;
        const t = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), Math.min(innerHeight - 1, r.top + r.height / 2));
        if (!t || !(t === el || el.contains(t) || t.contains(el))) continue;
        const cs = getComputedStyle(el);
        const hasText = [...el.childNodes].some(k => k.nodeType === 3 && k.textContent.trim()) || [...el.querySelectorAll('span, b, small, .t')].some(s => !s.matches('.em, [aria-hidden="true"]') && s.textContent.trim() && vis(s));
        const centered = cs.textAlign === 'center' || cs.justifyContent === 'center' || !hasText;
        // 가로는 테마 center-marks ④ 와 같이 상자 기준 후보(> 0.25)만 화소로 다시 재요: 안 내용(글자 · 아이콘 · 흐름 안 가상 요소 ⌄ · ✔) 덩어리 가운데 ↔ 요소 안쪽(테두리 안) 가운데
        let boxDx = 0;
        if (hasText) {
          // 자식 요소는 그 상자(이모지 .em 은 1em 칸 — 글리프가 칸 밖으로 넘쳐도 칸이 자리), 글자 마디는 글자 상자
          const rs = []; for (const k of el.childNodes) { if (k.nodeType === 3 && k.textContent.trim()) { const rg = document.createRange(); rg.selectNodeContents(k); rs.push(...rg.getClientRects()); } else if (k.nodeType === 1 && vis(k)) rs.push(k.getBoundingClientRect()); }
          const gap = /flex|grid/.test(cs.display) ? px(cs.columnGap) : 0;
          if (rs.length) {
            let L = Math.min(...rs.map(q => q.left)), Rr = Math.max(...rs.map(q => q.right));
            for (const pe of ['::before', '::after']) { const ps = getComputedStyle(el, pe); if (!ps.content || ps.content === 'none' || ps.content === 'normal' || ps.position === 'absolute' || ps.position === 'fixed' || ps.display === 'none') continue; const wv = px(ps.width) + px(ps.marginLeft) + px(ps.marginRight) + gap; if (pe === '::before') L -= wv; else Rr += wv; }   // 흐름 안 가상 요소도 flex 틈(gap)을 받아요
            const bl = r.left + px(cs.borderLeftWidth), br = r.right - px(cs.borderRightWidth);
            boxDx = Math.round(((L + Rr) / 2 - (bl + br) / 2) * 100) / 100;
          }
        }
        const dark = lumi(bgOf(el)) < 0.18;   // 짙은 면(주요 단추) — 아이콘 실루엣을 흰색으로 재요
        const bid = ++n; el.dataset.px = String(bid);
        out.push({ bid, path: pathOf(el), label: textOf(el), hasText, centered, boxDx, dark, w: r.width, h: r.height, sig: [el.tagName.toLowerCase(), [...el.classList].filter(c => !/^(is-|has-)/.test(c)).slice(0, 3).join('.'), Math.round(r.width) + 'x' + Math.round(r.height), hasText ? '글자' : '아이콘'].join('|') });
        if (out.length >= max) break;
      }
      document.body.dataset.pxN = String(n);
      return out;
    },
    where(bid) { const el = document.querySelector(`[data-px="${bid}"]`); if (!el) return null; el.scrollIntoView?.({ block: 'center', inline: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: inView(r) && r.top >= 0 && r.bottom <= innerHeight }; },
  };
  return true;
})()
