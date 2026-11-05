// 사이트용 부품 수집기(페이지 안에서 돌아요 · 문자열로 보내요) — window.__siteCollect(rootSel, screenName) → { recs, colorBad, fontSeen, extras }
//   원본: automation checks/rig/census/collect.js(테마 전수조사). 서명 문자열 꼴(종류 · 크기 · 모서리 · 면 · 선 · 그림자 · 글자)은 그대로 두어 규칙(rules/*.mjs)이 그대로 읽어요.
//   다른 점: ① 팔레트는 :root 의 사용자 정의 속성 전부(--bg · --ink · --blue …) ② 글꾸 미리보기 틀 안(.mart-preview-in 등)은 빼요 ③ 담기 단추의 글꾸 강조색(style="--accent:…")은 「accent(글꾸)」로 이름 붙여요
//   ④ 탭 = .tab · [role=tab], 칩 = .chip, 세그 = .mart-seg > button · .room-seg > button(바꾸기 전 모양도 재요) ⑤ 큰 카드형 누름(미리보기 · 메뉴 줄 · 입구 카드 · 지니 답 카드)은 단추로 세지 않아요.
(() => {
  if (window.__siteCollect) return true;
  const R = v => Math.round(v);
  const H = v => Math.round(v * 2) / 2;
  // ── 미리보기 틀 안(글꾸 · 액자 · 지니 캐릭터 · 표지 그림)은 사이트 부품이 아니라 검사에서 빼요 ──
  const SKIP_IN = '.mart-preview-in, .mart-sheet-preview, .mart-taste-preview, .bl-frame, .mart-stage, .mart-fit, .mart-ph, .mart-art, .mart-menu-cover, .gn-genie, .gn-sky, .mart-cart-thumb, .mart-tryon-photo, .room-frame-box, .room-stage, svg, #mart-shadow-svg';
  // ── 팔레트 색 지도: :root · body · 뿌리의 사용자 정의 속성 중 색으로 풀리는 것 ──
  const probe = document.createElement('i'); probe.style.cssText = 'position:absolute;left:-9999px;top:0;';
  function paletteOf(scope) {
    const map = new Map();
    (scope || document.body).appendChild(probe);
    const names = new Set();
    for (const el of [document.documentElement, document.body, scope]) { if (!el) continue; const cs = getComputedStyle(el); for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith('--')) names.add(p); } }
    for (const sheet of document.styleSheets) { try { for (const rule of sheet.cssRules) { if (rule.style && /^(:root|html|body|\.gn)$/.test(rule.selectorText || '')) for (let i = 0; i < rule.style.length; i++) { const p = rule.style[i]; if (p.startsWith('--')) names.add(p); } } } catch { } }
    for (const p of names) {
      if (/^--(mart-photo|mart-pos|mart-fit|mart-radius|mart-tilt|mart-zoom|mart-opacity|font|ease|pop|shadow|card-shadow|gn-shadow|glyph-|r-|ts-|ph-)/.test(p) || /^--(ratio|win|k|i|mask|chev|ctl|icon|chip|touch|strong)$/.test(p)) continue;   // 색이 아닌 토큰(이름 끝까지 맞춰요 — --i 가 --ink 를 삼키지 않게)
      probe.style.color = ''; probe.style.color = `var(${p})`;
      const c = getComputedStyle(probe).color;
      if (!c || c === 'rgba(0, 0, 0, 0)') continue;
      const v = (getComputedStyle(scope || document.body).getPropertyValue(p) || '').trim();
      if (!v || /url\(|px|%$/.test(v) && !/^#|^rgb|^color-mix|^var/.test(v)) continue;
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(p);
    }
    probe.remove();
    return map;
  }
  const best = arr => arr.slice().sort((a, b) => (/^--on-/.test(a) - /^--on-/.test(b)) || a.length - b.length)[0];   // 같은 색이면 짧은 이름 · 「--on-…」(글자용)은 뒤로
  let PAL = null;
  const rgbOf = c => /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c || '');
  /** 색 이름 — 팔레트 변수 이름 · 알파만 다르면 이름@알파 · 담기 단추의 글꾸 강조색은 accent(글꾸) · 그 밖은 RAW */
  const cname = (c, el = null) => {
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return '투명';
    const hit = PAL.get(c); if (hit) return best(hit).replace(/^--/, '');
    const m = rgbOf(c);
    if (m) { for (const [k, v] of PAL) { const n = rgbOf(k); if (n && n[1] === m[1] && n[2] === m[2] && n[3] === m[3] && !n[4]) return best(v).replace(/^--/, '') + '@' + (m[4] || '1'); } }
    // 글꾸마다 다른 강조색(담기 단추 · 카드 꼬리표): 그 요소(또는 조상)의 --accent 값과 같으면 팔레트 안으로 쳐요
    if (el) { const host = el.closest?.('[style*="--accent"]'); if (host) { probe.style.color = ''; probe.style.color = host.style.getPropertyValue('--accent').trim(); host.appendChild(probe); const ac = getComputedStyle(probe).color; probe.remove(); const a = rgbOf(ac); if (a && m && a[1] === m[1] && a[2] === m[2] && a[3] === m[3]) return 'accent(글꾸)' + (m[4] && m[4] !== '1' ? '@' + m[4] : ''); } }
    if (c === 'rgb(255, 255, 255)') return '흰색(생)'; if (c === 'rgb(0, 0, 0)') return '검정(생)';
    return 'RAW:' + c.replace(/\s/g, '');
  };
  const vis = e => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const inView = r => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const border = (cs, el) => { const w = parseFloat(cs.borderTopWidth) || 0; if (!w || cs.borderTopStyle === 'none') { const s = cs.boxShadow || ''; const m = /inset 0px 0px 0px ([\d.]+)px/.exec(s); if (m) return `${H(+m[1])} ${cname(/rgba?\([^)]+\)/.exec(s)?.[0], el)}(고리)`; return '없음'; } return `${H(w)} ${cname(cs.borderTopColor, el)}`; };
  const shadow = cs => { const s = cs.boxShadow; if (!s || s === 'none') return '없음'; if (/inset/.test(s) && /0px 0px 0px [\d.]+px/.test(s) && !/,/.test(s)) return '없음'; if (/inset/.test(s)) return 'inset그림자'; return '그림자'; };
  const rad = (cs, h) => { const r = parseFloat(cs.borderTopLeftRadius) || 0; if (h && r >= h / 2 - 0.5) return '원/알약'; return String(H(r)); };
  const fsz = cs => H(parseFloat(cs.fontSize));
  const px = v => parseFloat(v) || 0;
  /** 누르는 칸의 그림(아이콘): svg · img · 마스크 가상 요소 · 이모지 글자 */
  const glyphOf = el => {
    const i = el.querySelector('svg, img');
    if (i) { const r = i.getBoundingClientRect(); return { g: i.tagName.toLowerCase(), gfs: H(Math.max(r.width, r.height)), gcol: cname(getComputedStyle(i).color, el) }; }
    for (const pe of ['::before', '::after']) {
      const ps = getComputedStyle(el, pe);
      if (ps.content && ps.content !== 'none' && (ps.maskImage && ps.maskImage !== 'none' || ps.webkitMaskImage && ps.webkitMaskImage !== 'none')) return { g: 'mask' + pe, gfs: H(px(ps.width)), gcol: cname(ps.backgroundColor, el) };
      if (ps.content && /^"[^"]+"$/.test(ps.content) && ps.content.length <= 4) return { g: 'css' + ps.content, gfs: fsz(ps), gcol: cname(ps.color, el) };
      if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && px(ps.borderRightWidth) > 0 && px(ps.width) < 12) return { g: 'css꺾쇠(선)', gfs: H(px(ps.width)), gcol: cname(ps.borderRightColor, el) };
    }
    const em = el.querySelector('.em, .mart-cart-icon, [aria-hidden="true"]');
    if (em && em.textContent.trim()) return { g: 'text:' + em.textContent.trim().slice(0, 3), gfs: fsz(getComputedStyle(em)), gcol: cname(getComputedStyle(em).color, el) };
    const t = (el.textContent || '').trim(); return { g: t ? 'text:' + t.slice(0, 3) : '없음', gfs: fsz(getComputedStyle(el)), gcol: cname(getComputedStyle(el).color, el) };
  };
  const pathOf = el => { const parts = []; let e = el; for (let k = 0; k < 4 && e && e !== document.body; k++, e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const cl = [...e.classList].filter(c => !/^(is-|has-)/.test(c)).slice(0, 3); if (cl.length) s += '.' + cl.join('.'); parts.unshift(s); if (e.id) break; } return parts.join(' > '); };
  const textOf = el => (el.getAttribute?.('aria-label') || el.title || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  const isClose = e => { const t = (e.textContent || '').trim(); const al = (e.getAttribute('aria-label') || e.title || '').trim(); return e.matches('.x') || /^(×|✕|✖|x|X)$/.test(t) || (/(닫기|빼기|close)$/i.test(al) && t.length <= 2); };
  const CLICK = 'button, [role=button], a.btn, a.tab, a.pill, a.button, input[type=button], input[type=submit], .top nav a';
  // 큰 카드형 누름 · 글 속 링크는 단추가 아니에요(미리보기 · 장바구니 줄 · 마트 메뉴 줄 · 입구 카드 · 지니 답 카드 — 시안 고유 부품 · 원작 링크)
  const NOT_BUTTON = '.mart-preview, .mart-cart-row, .mart-menu-go, .mart-cards > a, .gn-choices button, .gn-hint button, .mart-source, .text-link, .brand, .fresh-item, .card, .mart-cart-clear';
  const pressed = el => el.matches('[aria-pressed=true], [aria-selected=true], [aria-current=page], [aria-current=true], .active, .is-active, .selected, .on, .is-on');

  window.__siteCollect = (rootSel, screenName) => {
    const root = rootSel ? document.querySelector(rootSel) : document.body;
    if (!root) return { error: '뿌리 없음 ' + rootSel };
    PAL = paletteOf(root);
    try { document.activeElement?.blur?.(); } catch { }
    const out = [];
    const rec = (el, kind, sig, extra = {}) => {
      if (el.dataset?.uic && el.dataset.uic.split(',').includes(kind)) return;
      const r = el.getBoundingClientRect();
      if (!inView(r)) return;
      el.dataset.uic = (el.dataset.uic ? el.dataset.uic + ',' : '') + kind;
      out.push({ kind, sig, path: pathOf(el), cls: [...(el.classList || [])].join(' '), text: textOf(el), rect: { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, ours: true, ...extra });
    };
    const all = [root, ...root.querySelectorAll('*')].filter(el => !el.closest(SKIP_IN) || el.matches('.mart-preview'));
    for (const el of all) {
      const tag = el.tagName.toLowerCase();
      if (!vis(el)) { if (!(tag === 'input' && /^(checkbox|radio)$/.test(el.type) && vis(el.closest('label') || el.parentElement))) continue; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const cl = String(el.className?.baseVal ?? el.className);
      if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) {
        const bw = px(cs.borderLeftWidth) + px(cs.borderRightWidth), bh = px(cs.borderTopWidth) + px(cs.borderBottomWidth);
        const sbw = R(el.offsetWidth - el.clientWidth - bw), sbh = R(el.offsetHeight - el.clientHeight - bh);
        rec(el, 'scroll', `세로막대 ${sbw} · 가로막대 ${sbh} · scrollbar-width ${cs.scrollbarWidth}`, { bad: sbw > 0 || sbh > 0 });
      }
      if (tag === 'dialog' || el.matches('.mart-cart, .mart-menu, .mart-sheet, .mart-room')) rec(el, 'frame', `모서리 ${rad(cs, 0)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} · 안여백 ${R(px(cs.paddingTop))}/${R(px(cs.paddingLeft))}`);
      if (tag === 'input') {
        const ty = (el.type || 'text').toLowerCase();
        if (ty === 'hidden' || ty === 'file') continue;
        if (ty === 'checkbox') {
          let box = el; if (r.width < 6 || +cs.opacity < 0.05) box = [...(el.closest('label') || el.parentElement).querySelectorAll('span, i, b, em')].find(x => { const q = x.getBoundingClientRect(); return q.width >= 10 && q.width <= 28 && Math.abs(q.width - q.height) <= 3; }) || el;
          const bs = getComputedStyle(box); const br = box.getBoundingClientRect();
          rec(box, 'checkbox', `${R(br.width)}×${R(br.height)} · 모서리 ${rad(bs, br.height)} · 선 ${border(bs, box)} · 면 ${cname(bs.backgroundColor, box)}(${el.checked ? '체크' : '빈칸'}) · 그림자 ${shadow(bs)} · appearance ${bs.appearance}${el.disabled ? ' · 비활성' : ''}`, { on: el.checked, bad: bs.appearance === 'auto' });
          continue;
        }
        if (ty === 'radio') { rec(el, 'radio', `${R(r.width)}×${R(r.height)} · 모서리 ${rad(cs, r.height)} · 선 ${border(cs, el)} · 면 ${cname(cs.backgroundColor, el)}(${el.checked ? '고름' : '빈칸'}) · appearance ${cs.appearance}`); continue; }
        if (ty === 'range') { rec(el, 'range', `높이 ${R(r.height)} · 면 ${cname(cs.backgroundColor, el)} · accent ${cname(cs.accentColor, el)} · appearance ${cs.appearance} · 모서리 ${rad(cs, r.height)}`); continue; }
        if (ty === 'color') { rec(el, 'color', `${R(r.width)}×${R(r.height)} · 모서리 ${rad(cs, r.height)} · 선 ${border(cs, el)}`); continue; }
        if (!['button', 'submit', 'reset'].includes(ty)) {
          rec(el, ty === 'number' ? 'number' : 'text', `높이 ${R(r.height)} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} · 글자 ${fsz(cs)}${el.disabled ? ' · 비활성' : ''}`, { type: ty });
          continue;
        }
      }
      if (tag === 'textarea') { rec(el, 'textarea', `모서리 ${rad(cs, 0)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} · 글자 ${fsz(cs)}`); continue; }
      if (tag === 'select') {
        const arrow = cs.backgroundImage && cs.backgroundImage !== 'none' ? '▾있음' : (cs.appearance !== 'none' ? '기본▾' : '▾없음');
        rec(el, 'select', `높이 ${R(r.height)} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} · 글자 ${fsz(cs)} · ${arrow}`, { bad: arrow === '▾없음' });
        continue;
      }
      // ── 접힘 머리(summary · 「자세히」 · 칩 접기 ▾) ──
      if (tag === 'summary' || el.matches('.mart-head-more, .mart-chips-fold, .mart-bar-fold')) {
        const gl = el.querySelector('svg');
        const pe = ['::before', '::after'].map(p => getComputedStyle(el, p)).find(p => p.content && p.content !== 'none' && p.content !== 'normal' && (p.content !== '""' || (p.maskImage && p.maskImage !== 'none') || (p.webkitMaskImage && p.webkitMaskImage !== 'none')));
        const mk = tag === 'summary' && cs.listStyleType !== 'none' && cs.display === 'list-item' ? '기본▸' : '';
        const chev = gl ? `svg ${H(gl.getBoundingClientRect().width)}px(${gl.getBoundingClientRect().left > r.left + r.width / 2 ? '오른쪽' : '왼쪽'})` : pe ? (pe.maskImage && pe.maskImage !== 'none' || pe.webkitMaskImage && pe.webkitMaskImage !== 'none' ? `mask ${H(px(pe.width))}px ${cname(pe.backgroundColor, el)}` : `css${pe.content} ${fsz(pe)}px`) : mk || '화살표없음';
        rec(el, 'details', `높이 ${R(r.height)} · 글자 ${fsz(cs)}/${cs.fontWeight} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 모서리 ${rad(cs, r.height)} · 화살표 ${chev}`);
        continue;
      }
      if (/^h[1-6]$/.test(tag) || tag === 'legend') { rec(el, 'heading', `${tag} · 글자 ${fsz(cs)}/${cs.fontWeight} · 색 ${cname(cs.color, el)}`); }
      if (tag === 'hr' || el.matches('.vr')) rec(el, 'divider', `두께 ${R(Math.min(r.width, r.height))} · 색 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)}`);
      // ── 닫기 ✕ ──
      if (el.matches(CLICK) && r.width <= 56 && r.height <= 56 && isClose(el)) {
        const g = glyphOf(el);
        rec(el, 'close', `${R(r.width)}×${R(r.height)} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} · 그림 ${g.g} ${g.gfs}px ${g.gcol}`, { glyph: g.g });
        continue;
      }
      // ── 꼬리표 · 배지(누르는 것 아님) ──
      if (el.matches('.tag, .mart-tag, .mart-fx, .release-chip, .fresh-ver, .note .tag') && !el.matches(CLICK)) {
        if (r.height <= 32 && r.width <= 260) { rec(el, 'pill', `높이 ${R(r.height)} · 글자 ${fsz(cs)}/${cs.fontWeight} · 가로여백 ${R(px(cs.paddingLeft))} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 글자색 ${cname(cs.color, el)}`); continue; }
      }
      if (el.matches('.mart-cart-badge, [class*="badge"]')) { rec(el, 'badge', `${R(r.width)}×${R(r.height)} · 글자 ${fsz(cs)}/${cs.fontWeight} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 글자색 ${cname(cs.color, el)}`); continue; }
      // ── 탭 · 칩 · 세그 ──
      if (el.matches('.tab, [role=tab], .mart-groups > button, .gn-seg > button')) {
        if (r.height >= 18 && r.height <= 64) { const sel = pressed(el) ? '고름' : '안고름'; rec(el, 'tab', `높이 ${R(r.height)} · 글자 ${fsz(cs)}/${cs.fontWeight} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 모서리 ${rad(cs, r.height)} · 글자색 ${cname(cs.color, el)} (${sel})`, { selected: sel }); continue; }
      }
      const isChip = el.matches('.chip, .mart-chips > button, .mart-taste-chip, .mart-taste-names'); const isSeg = el.matches('.mart-seg > button, .room-seg > button, [data-fit]');
      if ((isChip || isSeg) && r.height >= 16 && r.height <= 56) {
        const on = pressed(el) || !!el.querySelector('input:checked');
        rec(el, isChip ? 'chip' : 'seg', `높이 ${R(r.height)} · 글자 ${fsz(cs)}/${cs.fontWeight} · 가로여백 ${R(px(cs.paddingLeft))} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} (${on ? '고름' : '안고름'})`, { selected: on });
        continue;
      }
      // ── 단추(글자 · 아이콘만) ──
      if (el.matches(CLICK) && !el.matches(NOT_BUTTON) && r.height >= 14 && r.height <= 64 && r.width <= 420) {
        if (el.closest('summary')) continue;
        const txt = [...el.querySelectorAll('span, b, small, .t')].some(s => !s.matches('.em, [aria-hidden="true"]') && s.textContent.trim() && vis(s)) || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        const g = glyphOf(el);
        const transparentFace = cname(cs.backgroundColor, el) === '투명' && border(cs, el) === '없음';
        const p0 = el.parentElement;
        if (txt && transparentFace && /inline/.test(cs.display) && p0 && [...p0.childNodes].some(n => n !== el && n.nodeType === 3 && n.textContent.trim())) { rec(el, 'link', `글자 ${fsz(cs)}/${cs.fontWeight} · 색 ${cname(cs.color, el)}`); continue; }
        const kind = txt ? 'button' : 'iconbtn';
        const on = pressed(el);
        const primary = el.matches('.primary, .mart-cart-pay');
        const pickBtn = el.matches('.mart-pick');   // 담기(G): 흰 면 + 1.5px 강조색 테두리 + 강조색 글자 · 650
        const sig = kind === 'button'
          ? `높이 ${R(r.height)} · 글자 ${fsz(cs)}/${cs.fontWeight} · 가로여백 ${R(px(cs.paddingLeft))} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${pickBtn && !on && cs.borderTopColor === cs.color ? `${H(px(cs.borderTopWidth))} 강조색` : border(cs, el)} · 그림자 ${shadow(cs)}${pickBtn && !on && cs.borderTopColor === cs.color ? ' · 글자색 강조색' : ''}${primary ? ' (주요)' : ''}${pickBtn ? ' (담기)' : ''}${on ? ' (켬)' : ''}`
          : `${R(r.width)}×${R(r.height)} · 모서리 ${rad(cs, r.height)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} · 그림 ${g.g} ${g.gfs}px ${g.gcol}${on ? ' (켬)' : ''}`;
        rec(el, kind, sig, { glyph: g.g, primary, on });
        continue;
      }
      if (el.matches('.mart-card, .mart-cards > a, .mart-tryon, .mart-howto, .mart-menu-go')) rec(el, 'card', `모서리 ${rad(cs, 0)} · 면 ${cname(cs.backgroundColor, el)} · 선 ${border(cs, el)} · 그림자 ${shadow(cs)} · 안여백 ${R(px(cs.paddingTop))}/${R(px(cs.paddingLeft))}`);
    }
    // ── 생 색 · 글꼴(보이는 모든 요소 · 미리보기 안 제외) ──
    const colorBad = [], fontSeen = {};
    for (const el of all) {
      if (!vis(el) || el.matches(SKIP_IN) || el.closest(SKIP_IN)) continue;
      const r = el.getBoundingClientRect(); if (!inView(r)) continue;
      const cs = getComputedStyle(el);
      const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const props = [['면', cs.backgroundColor], ['선', px(cs.borderTopWidth) ? cs.borderTopColor : null], ...(ownText ? [['글자', cs.color]] : [])];
      for (const pe of ['::before', '::after']) { const ps = getComputedStyle(el, pe); if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && px(ps.width) > 0) { props.push([`${pe}면`, ps.backgroundColor]); if (px(ps.borderLeftWidth)) props.push([`${pe}선`, ps.borderLeftColor]); } }
      for (const [p, c] of props) { if (!c) continue; const n = cname(c, el); if (/^RAW|생\)/.test(n)) colorBad.push({ p, n, path: pathOf(el), text: textOf(el).slice(0, 14), rect: { x: r.left, y: r.top, w: r.width, h: r.height } }); }
      if (/gradient/.test(cs.backgroundImage) && !el.matches('.mart-preview.frame, .room-stage, .lemon')) colorBad.push({ p: '그라데이션', n: cs.backgroundImage.slice(0, 120), path: pathOf(el), text: textOf(el).slice(0, 14), rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
      if (ownText) { const f = cs.fontFamily.split(',')[0].trim().replace(/"/g, ''); (fontSeen[f] ||= []).length < 3 && fontSeen[f].push(pathOf(el)); }
    }
    return { recs: out, colorBad, fontSeen };
  };
  return true;
})()
