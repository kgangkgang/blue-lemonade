// Reading preview — the theme's 글자 tab on the site: role fonts per language, sizes, weights, spacing,
// dialogue display and highlighter, 속마음 italic, paragraph layout, text shadow and outline.
// Geometry and defaults follow the theme (src/settings.js DEFAULTS, src/apply.js markerGeometry / markerBackground).
(() => {
  'use strict';
  const lab = document.querySelector('#reading-lab');
  const sample = document.querySelector('#reading-sample');
  const form = document.querySelector('#reading-controls');
  if (!lab || !sample || !form) return;

  const DEFAULTS = () => ({
    text: { font: { ko: 'pretendard', en: 'auto', ja: 'auto', zh: 'auto' }, size: 16, weight: 400, spacing: -1 },
    dialogue: { font: 'same', size: null, weight: 400, spacing: null, style: 'marker', shape: 'stroke', tilt: 'flat', pos: 'center', thick: 54 },
    em: { font: 'same', size: null, weight: 400, spacing: null, italic: false },
    strong: { font: 'same', size: null, weight: 650, spacing: null },
    code: { font: { ko: 'neodgm', en: 'auto', ja: 'auto', zh: 'auto' }, size: null, weight: null, spacing: null },
    para: { line: 1.8, gap: 0.9, gutter: 20, align: 'left', indent: false },
    hanja: 'auto',
    shadow: { on: false, targets: { text: false, dialogue: true, em: false, strong: false, code: false }, color: '#000000', alpha: 45, angle: 135, distance: 2, blur: 3 },
    outline: { on: false, color: '#000000', alpha: 100, width: 1 },
  });
  let S = DEFAULTS(), role = 'text', fonts = null;
  const ROLES = [['text', '본문'], ['dialogue', '대사'], ['em', '속마음'], ['strong', '강조'], ['code', '코드'], ['para', '문단'], ['shadow', '그림자 · 외곽선']];
  const LANGS = [['ko', '한국어'], ['en', 'English'], ['ja', '日本語'], ['zh', '中文']];
  const GROUPS = { sans: '고딕', serif: '명조', display: '꾸밈 · 손글씨', mono: '고정폭 · 도트' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = path => path.split('.').reduce((o, k) => o?.[k], S);
  const set = (path, v) => { const keys = path.split('.'), last = keys.pop(); keys.reduce((o, k) => o[k], S)[last] = v; };

  // ---- fonts: the theme's catalog, loaded only when a font is picked
  const loaded = new Set(['pretendard']);
  const byId = id => fonts?.find(f => f.id === id);
  function ensureFont(id) {
    const f = byId(id); if (!f || loaded.has(id)) return; loaded.add(id);
    const link = href => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l); };
    if (f.google) link(`https://fonts.googleapis.com/css2?family=${f.google}&display=swap`);
    for (const href of [].concat(f.css || [])) link(href);
    for (const file of f.files || []) {
      const face = new FontFace(f.family.replace(/['"]/g, '').split(',')[0].trim(), `url(${file.url})`, { weight: String(file.weight || 400) });
      face.load().then(ff => document.fonts.add(ff)).catch(() => {});
    }
  }
  const family = id => { const f = byId(id); return f ? `${f.family}, 'Pretendard Variable', sans-serif` : null; };
  const roleFonts = r => { const v = S[r].font; return v === 'same' ? null : v; };

  // ---- theme marker geometry (apply.js)
  const TILT = { flat: { rise: 0, mid: 57 }, slant: { rise: 18, mid: 56 }, steep: { rise: 48, mid: 50 } };
  const POS = { center: {}, bottom: { tiltK: 0.5, base: 96 } };
  const n2 = v => Number(v.toFixed(2));
  const parseColor = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; } const h = String(c).trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1); };
  function geometry(thick, tiltKey, posKey) {
    const tilt = TILT[tiltKey] || TILT.flat, pos = POS[posKey] || POS.center;
    const T = Math.min(100, Math.max(10, thick));
    const rise = Math.max(0, Math.min(tilt.rise * (pos.tiltK || 1), 100 - T));
    const half = (rise + T) / 2;
    const mid = Math.min(100 - half, Math.max(half, pos.base ? pos.base - T / 2 : tilt.mid));
    return { T, l: mid + rise / 2 - T / 2, r: mid - rise / 2 - T / 2 };
  }
  function markerBackground(color) {
    const d = S.dialogue;
    const { T, l, r } = geometry(d.thick, d.shape === 'stroke' ? d.tilt : 'flat', d.pos);
    const lb = l + T, rb = r + T, w = Math.min(1.8, T * 0.07);
    const [cr, cg, cb, ca] = parseColor(color), rgb = `rgb(${cr},${cg},${cb})`, op = Math.min(1, ca);
    if (d.shape === 'pill') {
      const ink = `rgba(${cr},${cg},${cb},${n2(op)})`, cap = n2(T / 200), y = T === 100 ? 50 : n2(l / (100 - T) * 100);
      return `radial-gradient(ellipse 100% 50% at 100% 50%, ${ink} 99%, transparent 100%) left ${y}% / min(${cap}em, 50%) ${n2(T)}% no-repeat, radial-gradient(ellipse 100% 50% at 0% 50%, ${ink} 99%, transparent 100%) right ${y}% / min(${cap}em, 50%) ${n2(T)}% no-repeat, linear-gradient(${ink}, ${ink}) center ${y}% / max(0px, calc(100% - ${n2(cap * 2)}em)) ${n2(T)}% no-repeat`;
    }
    const svg = d.shape === 'rectangle'
      ? `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><rect x='0' y='${n2(l)}' width='100' height='${n2(T)}' fill='${rgb}' fill-opacity='${n2(op)}'/></svg>`
      : (() => {
        const stroke = [`M0,${n2(l + T * 0.22)}`, `L2.2,${n2(l)}`, `Q25,${n2(l - w + (r - l) * 0.25)} 50,${n2((l + r) / 2)}`, `T98.6,${n2(r)}`,
          `L100,${n2(r + T * 0.5)}`, `L97.2,${n2(rb)}`, `Q75,${n2(rb + w - (rb - lb) * 0.25)} 50,${n2((lb + rb) / 2)}`, `T0.8,${n2(lb)}`, 'Z'].join(' ');
        return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='p' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='${rgb}' stop-opacity='${n2(op * 0.45)}'/><stop offset='0.14' stop-color='${rgb}' stop-opacity='0'/></linearGradient></defs><path d='${stroke}' fill='${rgb}' fill-opacity='${n2(op)}'/><path d='${stroke}' fill='url(#p)'/></svg>`;
      })();
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
  }
  const rgba = (hex, alpha) => { const [r, g, b] = parseColor(hex); return `rgba(${r},${g},${b},${n2(alpha / 100)})`; };

  // ---- paint the sample
  function apply() {
    const st = sample.style, css = (k, v) => v === null || v === undefined ? st.removeProperty(k) : st.setProperty(k, v);
    const tf = S.text.font;
    for (const id of Object.values(tf)) ensureFont(id);
    const fam = (set, lang) => family(set[lang] === 'auto' || !set[lang] ? set.ko : set[lang]);
    css('--f-text', family(tf.ko)); css('--f-text-en', fam(tf, 'en')); css('--f-text-ja', fam(tf, 'ja')); css('--f-text-zh', fam(tf, 'zh'));
    css('--f-hanja', S.hanja === 'auto' ? null : fam(tf, S.hanja));
    for (const r of ['dialogue', 'em', 'strong', 'code']) {
      const f = roleFonts(r);
      if (f) { for (const id of Object.values(f)) ensureFont(id); }
      css(`--f-${r}`, f ? family(f.ko) : null);
      const rs = S[r];
      css(`--s-${r}`, rs.size === null ? null : rs.size + 'px');
      css(`--w-${r}`, rs.weight === null ? null : String(rs.weight));
      css(`--ls-${r}`, rs.spacing === null ? null : (rs.spacing / 100) + 'em');
    }
    css('--read-size', S.text.size + 'px'); css('--read-weight', String(S.text.weight)); css('--read-spacing', (S.text.spacing / 100) + 'em');
    css('--read-line', String(S.para.line)); css('--read-para', S.para.gap + 'em'); css('--read-gutter', S.para.gutter + 'px'); css('--read-indent', S.para.indent ? '1em' : '0');
    st.textAlign = S.para.align === 'left' ? 'left' : 'justify';
    st.wordBreak = S.para.align === 'justify-break' ? 'break-all' : 'keep-all';
    css('--em-style', S.em.italic ? 'italic' : 'normal');
    sample.dataset.dlg = S.dialogue.style;
    const marker = getComputedStyle(document.documentElement).getPropertyValue('--marker') || 'rgba(20,165,255,.24)';
    css('--read-marker', markerBackground(marker));
    // shadow: angle 0 = right, clockwise; distance / blur in px
    const sh = S.shadow, a = sh.angle * Math.PI / 180;
    const shadow = sh.on ? `${n2(Math.cos(a) * sh.distance)}px ${n2(Math.sin(a) * sh.distance)}px ${sh.blur}px ${rgba(sh.color, sh.alpha)}` : null;
    for (const t of ['text', 'dialogue', 'em', 'strong', 'code']) css(`--sh-${t}`, shadow && sh.targets[t] ? shadow : (t === 'text' ? null : 'none'));
    css('--read-stroke', S.outline.on ? `${S.outline.width}px ${rgba(S.outline.color, S.outline.alpha)}` : null);
  }

  // ---- controls, built like the theme's settings panel
  const seg = (path, options, value) => `<div class="st-seg" data-set="${path}">${options.map(([v, l]) => `<button type="button" data-value="${v}" aria-pressed="${String(v) === String(value)}">${l}</button>`).join('')}</div>`;
  const row = (label, desc, control) => `<div class="st-row${control.startsWith('<div class="st-seg"') ? ' stack' : ''}"><span>${label}${desc ? `<small>${desc}</small>` : ''}</span>${control}</div>`;
  const toggle = (path, on) => `<label class="st-switch"><input type="checkbox" data-path="${path}" ${on ? 'checked' : ''}><span></span></label>`;
  const slider = (path, label, min, max, step, unit, fallback) => {
    const v = get(path), same = fallback !== undefined, value = v === null ? fallback : v;
    return `<div class="st-slider${same && v === null ? ' is-same' : ''}"><div class="st-slider-head"><span>${label}</span>${same ? seg(path + '#same', [['same', '본문과 같게'], ['own', '직접']], v === null ? 'same' : 'own') : ''}<label class="st-num"><input type="number" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}" ${same && v === null ? 'disabled' : ''}><i>${unit}</i></label></div><input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}" ${same && v === null ? 'disabled' : ''}></div>`;
  };
  const color = (path, label) => row(label, '', `<input type="color" class="st-color" data-path="${path}" value="${get(path)}">`);
  function fontSelect(roleKey, lang) {
    const set = S[roleKey].font, cur = set === 'same' ? 'same' : set[lang];
    const list = fonts ? fonts.filter(f => f.lang === lang || (lang === 'en' && f.latin)) : [];
    const first = lang === 'ko' ? (roleKey === 'text' ? '' : `<option value="same" ${cur === 'same' ? 'selected' : ''}>본문과 같게</option>`) : `<option value="auto" ${cur === 'auto' ? 'selected' : ''}>한국어 글꼴 따라가기</option>`;
    const groups = Object.entries(GROUPS).map(([g, gl]) => { const items = list.filter(f => f.group === g); return items.length ? `<optgroup label="${gl}">${items.map(f => `<option value="${f.id}" ${f.id === cur ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</optgroup>` : ''; }).join('');
    const disabled = lang !== 'ko' && set === 'same';
    return row(LANGS.find(l => l[0] === lang)[1], '', `<select class="st-select" data-font="${roleKey}" data-lang="${lang}" ${disabled ? 'disabled' : ''}>${first}${groups}</select>`);
  }
  const fontBlock = r => `<div class="st-group"><p class="st-title">글꼴</p>${fonts ? LANGS.map(([l]) => fontSelect(r, l)).join('') : '<p class="st-note">글꼴 목록을 불러오는 중이에요.</p>'}${r === 'text' ? row('한자', '한자를 어느 언어 글꼴로 보여 줄지', seg('hanja', [['auto', '자동'], ['ko', '한국어'], ['ja', '日本語'], ['zh', '中文']], S.hanja)) : ''}</div>`;
  const PANES = {
    text: () => fontBlock('text') + `<div class="st-group">${slider('text.size', '크기', 12, 24, 1, 'px')}${slider('text.weight', '굵기', 100, 900, 50, '')}${slider('text.spacing', '자간', -10, 20, 1, '/100em')}</div>`,
    dialogue: () => `<div class="st-group">${row('표시', '', seg('dialogue.style', [['marker', '형광펜'], ['full', '전체 칠'], ['bold', '굵게'], ['tint', '색'], ['plain', '없음']], S.dialogue.style))}`
      + (S.dialogue.style === 'marker' ? row('형광펜 모양', '', seg('dialogue.shape', [['stroke', '펜 자국'], ['rectangle', '직사각형'], ['pill', '알약']], S.dialogue.shape))
        + (S.dialogue.shape === 'stroke' ? row('형광펜 기울기', '', seg('dialogue.tilt', [['flat', '일직선'], ['slant', '대각선'], ['steep', '완전 대각선']], S.dialogue.tilt)) : '')
        + row('형광펜 위치', '아래: 밑줄 긋듯 글자 아랫부분에', seg('dialogue.pos', [['center', '가운데'], ['bottom', '아래']], S.dialogue.pos))
        + slider('dialogue.thick', '형광펜 굵기', 10, 100, 1, '%') : '') + `</div>`
      + fontBlock('dialogue') + `<div class="st-group">${slider('dialogue.size', '크기', 8, 40, 1, 'px', S.text.size)}${slider('dialogue.weight', '굵기', 100, 900, 50, '')}${slider('dialogue.spacing', '자간', -10, 20, 1, '/100em', S.text.spacing)}</div>`,
    em: () => `<div class="st-group">${row('기울임', '끄면 색으로만 구분해요', toggle('em.italic', S.em.italic))}</div>` + fontBlock('em')
      + `<div class="st-group">${slider('em.size', '크기', 8, 40, 1, 'px', S.text.size)}${slider('em.weight', '굵기', 100, 900, 50, '')}${slider('em.spacing', '자간', -10, 20, 1, '/100em', S.text.spacing)}</div>`,
    strong: () => fontBlock('strong') + `<div class="st-group">${slider('strong.size', '크기', 8, 40, 1, 'px', S.text.size)}${slider('strong.weight', '굵기', 100, 900, 50, '')}${slider('strong.spacing', '자간', -10, 20, 1, '/100em', S.text.spacing)}</div>`,
    code: () => fontBlock('code') + `<div class="st-group">${slider('code.size', '크기', 8, 32, 1, 'px', S.text.size)}${slider('code.weight', '굵기', 100, 900, 50, '', S.text.weight)}${slider('code.spacing', '자간', -10, 20, 1, '/100em', S.text.spacing)}</div>`,
    para: () => `<div class="st-group">${slider('para.line', '줄 간격', 1.2, 2.6, 0.05, '')}${slider('para.gap', '문단 간격', 0, 2.5, 0.05, 'em')}${slider('para.gutter', '좌우 여백', 0, 48, 1, 'px')}`
      + row('정렬', '', seg('para.align', [['left', '왼쪽'], ['justify-word', '양쪽'], ['justify-break', '양쪽 · 끊기']], S.para.align))
      + row('첫 줄 들여쓰기', '', toggle('para.indent', S.para.indent)) + `</div>`,
    shadow: () => `<div class="st-group"><p class="st-title">글자 그림자</p>${row('그림자', '글자 뒤에 그림자를 깔아요', toggle('shadow.on', S.shadow.on))}`
      + (S.shadow.on ? `<div class="st-chips" data-targets>${[['text', '본문'], ['dialogue', '대사'], ['em', '속마음'], ['strong', '강조'], ['code', '코드']].map(([k, l]) => `<button type="button" data-target="${k}" aria-pressed="${S.shadow.targets[k]}">${l}</button>`).join('')}</div>`
        + color('shadow.color', '색') + slider('shadow.alpha', '투명도', 0, 100, 1, '%') + slider('shadow.angle', '각도', 0, 360, 1, '°') + slider('shadow.distance', '거리', 0, 12, 0.5, 'px') + slider('shadow.blur', '퍼짐', 0, 24, 0.5, 'px') : '')
      + `</div><div class="st-group"><p class="st-title">글자 외곽선</p>${row('외곽선', '글자 둘레에 테두리를 둘러 배경과 섞이지 않게', toggle('outline.on', S.outline.on))}`
      + (S.outline.on ? color('outline.color', '색') + slider('outline.width', '두께', 0.2, 3, 0.1, 'px') + slider('outline.alpha', '진하기', 0, 100, 1, '%') : '') + `</div>`,
  };
  const fill = input => { const min = +input.min, max = +input.max; input.style.setProperty('--fill', `${((+input.value - min) / (max - min)) * 100}%`); };
  function render() {
    lab.innerHTML = `<div class="st-tabs">${seg('#role', ROLES, role)}</div><div class="st-pane">${PANES[role]()}</div>`;
    lab.querySelectorAll('input[type=range]').forEach(fill);
  }
  const numberOf = el => { const v = Number(el.value); return Number.isFinite(v) ? Math.min(+el.max, Math.max(+el.min, v)) : +el.min; };
  lab.addEventListener('click', e => {
    const b = e.target.closest('.st-seg button, [data-target]'); if (!b) return;
    if (b.dataset.target) { S.shadow.targets[b.dataset.target] = !S.shadow.targets[b.dataset.target]; b.setAttribute('aria-pressed', String(S.shadow.targets[b.dataset.target])); apply(); return; }
    const path = b.parentElement.dataset.set, v = b.dataset.value;
    if (path === '#role') role = v;
    else if (path.endsWith('#same')) { const p = path.slice(0, -5), key = p.split('.').pop(); set(p, v === 'same' ? null : (S.text[key === 'weight' ? 'weight' : key] ?? 0)); }
    else set(path, v);
    render(); apply();
  });
  lab.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('input[type=range], input[type=number]')) {
      const v = numberOf(el); set(el.dataset.path, v);
      const twin = lab.querySelector(`input[data-path="${el.dataset.path}"]:not([type="${el.type}"])`); if (twin && el.type === 'range') twin.value = v; else if (twin) twin.value = v;
      lab.querySelectorAll(`input[type=range][data-path="${el.dataset.path}"]`).forEach(fill);
      apply();
    } else if (el.matches('input[type=color]')) { set(el.dataset.path, el.value); apply(); }
  });
  lab.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('input[type=checkbox][data-path]')) { set(el.dataset.path, el.checked); render(); apply(); }
    else if (el.matches('select[data-font]')) {
      const r = el.dataset.font, lang = el.dataset.lang, v = el.value;
      if (lang === 'ko' && v === 'same') S[r].font = 'same';
      else { if (S[r].font === 'same') S[r].font = { ko: S.text.font.ko, en: 'auto', ja: 'auto', zh: 'auto' }; S[r].font[lang] = v; }
      if (v !== 'same' && v !== 'auto') ensureFont(v);
      render(); apply();
    }
  });
  form.addEventListener('reset', e => { e.preventDefault(); S = DEFAULTS(); render(); apply(); });
  form.addEventListener('submit', e => e.preventDefault());
  // the highlighter color follows the site's white / night
  document.addEventListener('bl-theme', () => requestAnimationFrame(apply));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);

  render(); apply();
  // font list: fetched when the section comes near, so the page itself stays light
  const load = () => fetch('fonts.json').then(r => r.json()).then(list => { fonts = list; render(); apply(); }).catch(() => {});
  new IntersectionObserver((entries, io) => { if (entries.some(x => x.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '400px' }).observe(form);
})();
