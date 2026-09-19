(() => {
  'use strict';
  const demo = document.querySelector('#palette-demo');
  const choices = document.querySelector('#palette-families');
  const stage = document.querySelector('#palette-stage');
  const modes = [...document.querySelectorAll('.palette-modes button')];
  const swatches = document.querySelector('#palette-swatches');
  const tokens = ['bg','surface','raised','text','dialogue','em','strong','muted','accent','pop','marker','gold','line','shadow'];
  const siteTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const rgb = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (m) return m[1].split(',').slice(0, 3).map(Number); const h = String(c).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const mixRgb = (a, b, t) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(', ')})`; };
  let selected = 'blue', mode = siteTheme(), families = [], pickedMode = false;
  // 에이드 혼합하기 — same rules as the theme (gradients.js): 2~3 ades, angle 0~360, blend 0~100, weights 1~100, white and night kept apart
  const mixes = { light: { on: false, families: ['blue', 'strawberry'], angle: 90, weights: [50, 50, 50], blend: 50 }, dark: { on: false, families: ['blue', 'strawberry'], angle: 90, weights: [50, 50, 50], blend: 50 } };
  const clamp = (v, lo, hi, d) => Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d;
  // 번짐 (3.9.7): 50 = each color peaks mid-share; below 50 solid bands widen to hard edges at 0; above 50 the end colors slide to the edges
  const stops = (colors, weights, blend = 50) => { const w = colors.map((_, i) => clamp(weights?.[i], 1, 100, 50)), sum = w.reduce((a, b) => a + b, 0), b = clamp(blend, 0, 100, 50), last = colors.length - 1, at = v => `${Number(v.toFixed(3))}%`; let used = 0;
    return colors.flatMap((color, i) => { const mid = (used + w[i] / 2) / sum * 100, half = w[i] / 2 / sum * 100; used += w[i];
      if (b >= 50) { const u = (b - 50) / 50; return [`${color} ${at(i === 0 ? mid * (1 - u) : i === last ? mid + (100 - mid) * u : mid)}`]; }
      const band = half * (1 - b / 50); return [`${color} ${at(mid - band)}`, `${color} ${at(mid + band)}`]; }); };
  const gradientCss = (colors, m) => `linear-gradient(${m.angle}deg, ${stops(colors, m.weights, m.blend).join(', ')})`;
  const variant = f => families.find(x => x.id === f)[mode];
  const transparent = c => /,\s*0(\.0+)?\s*\)$/.test(String(c));
  const mixSwatches = document.querySelector('#palette-mix-swatches'), mixSliders = document.querySelector('#palette-mix-sliders'), mixBody = document.querySelector('#palette-mix-body'), mixToggle = document.querySelector('#palette-mix-toggle');
  const FILL = ['bg', 'surface', 'raised'];
  function paintMix() {
    const m = mixes[mode];
    for (const key of FILL) stage.style.removeProperty('--preview-fill-' + key);
    for (const key of ['--preview-fill-user', '--preview-band-marker', '--preview-band-gold']) stage.style.removeProperty(key);
    if (!m.on) return;
    for (const key of FILL) stage.style.setProperty('--preview-fill-' + key, gradientCss(m.families.map(f => variant(f)[key]), m));
    // light bubbles: each ade's marker at 16% over its surface (gradients.js user-bg rule); night follows raised
    stage.style.setProperty('--preview-fill-user', mode === 'light' ? gradientCss(m.families.map(f => mixRgb(variant(f).marker, variant(f).surface, .16)), m) : gradientCss(m.families.map(f => variant(f).raised), m));
    // dialogue band and strong underline take the mixed marker / gold, drawn as bands like the solid ones
    stage.style.setProperty('--preview-band-marker', `${gradientCss(m.families.map(f => variant(f).marker), m)} 0 83.9% / 100% 44% no-repeat`);
    if (m.families.some(f => !transparent(variant(f).gold))) stage.style.setProperty('--preview-band-gold', `${gradientCss(m.families.map(f => variant(f).gold), m)} 0 84.6% / 100% 35% no-repeat`);
  }
  function renderMix() {
    const m = mixes[mode];
    document.querySelector('#palette-mix-scope').textContent = `${mode === 'light' ? '라이트' : '나이트'} 전용 · 2~3가지 에이드를 섞어요. 글자는 따로 골라요.`;
    mixToggle.setAttribute('aria-pressed', String(m.on)); mixToggle.textContent = m.on ? '혼합 끄기' : '에이드 혼합하기';
    mixBody.hidden = !m.on;
    if (!m.on) return;
    // Same split swatches as the family picker and the theme mix controls.
    mixSwatches.replaceChildren(...families.map(f => {
      const b = document.createElement('button'), dot = document.createElement('i'), name = document.createElement('span'), i = m.families.indexOf(f.id);
      b.type = 'button'; b.dataset.family = f.id; b.setAttribute('aria-pressed', String(i >= 0));
      b.disabled = i < 0 && m.families.length === 3; dot.setAttribute('aria-hidden', 'true'); dot.style.background = `linear-gradient(135deg, ${f[mode].bg} 50%, ${f[mode].pop} 50%)`; name.textContent = f.label; b.append(dot, name);
      if (i >= 0) { const n = document.createElement('b'); n.textContent = i + 1; b.append(n); }
      return b;
    }));
    const slider = (key, label, min, max, value) => `<div class="st-slider"><div class="st-slider-head"><span>${label}</span><label class="st-num"><input type="number" data-mix="${key}" min="${min}" max="${max}" step="1" value="${value}"><i></i></label></div><input type="range" data-mix="${key}" min="${min}" max="${max}" step="1" value="${value}" aria-label="${label}"></div>`;
    mixSliders.innerHTML = slider('angle', '혼합 방향 (°)', 0, 360, m.angle) + slider('blend', '번짐', 0, 100, m.blend) + m.families.map((f, i) => slider('w' + i, families.find(x => x.id === f).label + ' 비중', 1, 100, m.weights[i])).join('');
    mixSliders.querySelectorAll('input[type=range]').forEach(fillRange);
  }
  const fillRange = input => input.style.setProperty('--fill', `${((+input.value - +input.min) / (+input.max - +input.min)) * 100}%`);
  mixToggle.addEventListener('click', () => { mixes[mode].on = !mixes[mode].on; renderMix(); render(); });
  mixSwatches.addEventListener('click', e => {
    const b = e.target.closest('button[data-family]'); if (!b || b.disabled) return;
    const m = mixes[mode], key = b.dataset.family, i = m.families.indexOf(key);
    if (i >= 0 && m.families.length > 2) { m.families.splice(i, 1); m.weights.splice(i, 1); m.weights.push(50); }
    else if (i < 0 && m.families.length < 3) m.families.push(key);
    renderMix(); render();
  });
  mixSliders.addEventListener('input', e => {
    const input = e.target.closest('input[data-mix]'); if (!input) return;
    const m = mixes[mode], v = Math.min(+input.max, Math.max(+input.min, Number(input.value) || +input.min));
    if (input.dataset.mix === 'angle') m.angle = v; else if (input.dataset.mix === 'blend') m.blend = v; else m.weights[Number(input.dataset.mix.slice(1))] = v;
    mixSliders.querySelectorAll(`input[data-mix="${input.dataset.mix}"]`).forEach(x => { if (x !== input) x.value = v; if (x.type === 'range') fillRange(x); });
    paintMix();
  });
  function render(announce = true) {
    const family = families.find(f => f.id === selected);
    const palette = family[mode];
    for (const key of tokens) stage.style.setProperty('--preview-' + key, palette[key]);
    // like the theme (apply.js): light bubbles take 16% of the ade's marker hue over the surface; night keeps the raised color
    stage.style.setProperty('--preview-user', mode === 'light' ? mixRgb(palette.marker, palette.surface, .16) : palette.raised);
    stage.style.colorScheme = mode;
    paintMix();
    document.querySelector('#palette-name').textContent = family.label;
    document.querySelector('#palette-description').textContent = palette.desc;
    document.querySelector('#palette-mode-label').textContent = mode === 'light' ? '화이트' : '나이트';
    for (const button of choices.children) {
      button.setAttribute('aria-pressed', String(button.dataset.family === selected));
      const p = families.find(f => f.id === button.dataset.family)[mode];
      button.querySelector('.palette-dot').style.background = `linear-gradient(135deg, ${p.bg} 50%, ${p.pop} 50%)`;
    }
    modes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    swatches.replaceChildren();
    for (const [key, label] of [['bg','바탕'],['text','본문'],['accent','포인트'],['marker','대사 형광펜']]) {
      const item = document.createElement('div'), chip = document.createElement('span'), name = document.createElement('span');
      chip.className = 'palette-chip'; chip.style.backgroundColor = palette[key]; chip.setAttribute('aria-hidden','true');
      if (mixes[mode].on && ['bg', 'marker'].includes(key)) chip.style.backgroundImage = gradientCss(mixes[mode].families.map(f => variant(f)[key]), mixes[mode]);
      name.textContent = label; item.title = `${label}: ${palette[key]}`;
      item.style.setProperty('--i', swatches.children.length); item.append(chip, name); swatches.append(item);
    }
    if (announce) { const chat = stage.querySelector('.palette-chat'); chat.classList.remove('swap'); void chat.offsetWidth; chat.classList.add('swap'); }
    if (announce) document.querySelector('#palette-announcement').textContent = `${family.label} ${mode === 'light' ? '화이트' : '나이트'} 미리보기`;
  }
  modes.forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; pickedMode = true; renderMix(); render(); }));
  // the demo follows the site's white / night switch until a brightness is picked here
  document.addEventListener('bl-theme', event => { if (pickedMode) return; mode = event.detail; if (families.length) { renderMix(); render(false); } });
  fetch('theme-palettes.json').then(r => { if (!r.ok) throw new Error('palettes'); return r.json(); }).then(data => {
    families = data;
    for (const family of families) {
      const button = document.createElement('button'), dot = document.createElement('span'), label = document.createElement('span');
      button.type = 'button'; button.dataset.family = family.id; button.style.setProperty('--i', choices.children.length);
      dot.className = 'palette-dot'; dot.setAttribute('aria-hidden','true'); label.textContent = family.label;
      button.append(dot, label); button.addEventListener('click', () => { selected = family.id; render(); }); choices.append(button);
    }
    renderMix(); render(false); demo.hidden = false; document.querySelector('#palette-loading').hidden = true;
  }).catch(() => { document.querySelector('#palette-loading').textContent = '색상을 불러오지 못했어요. 잠시 후 새로고침해 주세요.'; });
})();
