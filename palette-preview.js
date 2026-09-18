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
  function render(announce = true) {
    const family = families.find(f => f.id === selected);
    const palette = family[mode];
    for (const key of tokens) stage.style.setProperty('--preview-' + key, palette[key]);
    // like the theme (apply.js): light bubbles take 16% of the ade's marker hue over the surface; night keeps the raised color
    stage.style.setProperty('--preview-user', mode === 'light' ? mixRgb(palette.marker, palette.surface, .16) : palette.raised);
    stage.style.colorScheme = mode;
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
      name.textContent = label; item.title = `${label}: ${palette[key]}`;
      item.style.setProperty('--i', swatches.children.length); item.append(chip, name); swatches.append(item);
    }
    if (announce) { const chat = stage.querySelector('.palette-chat'); chat.classList.remove('swap'); void chat.offsetWidth; chat.classList.add('swap'); }
    if (announce) document.querySelector('#palette-announcement').textContent = `${family.label} ${mode === 'light' ? '화이트' : '나이트'} 미리보기`;
  }
  modes.forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; pickedMode = true; render(); }));
  // the demo follows the site's white / night switch until a brightness is picked here
  document.addEventListener('bl-theme', event => { if (pickedMode) return; mode = event.detail; if (families.length) render(false); });
  fetch('theme-palettes.json').then(r => { if (!r.ok) throw new Error('palettes'); return r.json(); }).then(data => {
    families = data;
    for (const family of families) {
      const button = document.createElement('button'), dot = document.createElement('span'), label = document.createElement('span');
      button.type = 'button'; button.dataset.family = family.id; button.style.setProperty('--i', choices.children.length);
      dot.className = 'palette-dot'; dot.setAttribute('aria-hidden','true'); label.textContent = family.label;
      button.append(dot, label); button.addEventListener('click', () => { selected = family.id; render(); }); choices.append(button);
    }
    render(false); demo.hidden = false; document.querySelector('#palette-loading').hidden = true;
  }).catch(() => { document.querySelector('#palette-loading').textContent = '색상을 불러오지 못했어요. 잠시 후 새로고침해 주세요.'; });
})();
