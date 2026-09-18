(() => {
  const form = document.querySelector('#reading-controls');
  const sample = document.querySelector('#reading-sample');
  const values = [
    ['size', 'px', 1], ['spacing', 'em', .01], ['line', '', 1],
    ['para', 'em', 1], ['gutter', 'px', 1],
  ];
  function updateReading() {
    for (const [key, unit, multiplier] of values) {
      const input = document.querySelector('#read-' + key);
      const value = Number((Number(input.value) * multiplier).toFixed(2)) + unit;
      sample.style.setProperty('--read-' + key, value);
      form.querySelector(`output[for="${input.id}"]`).textContent = value;
      input.setAttribute('aria-valuetext', value);
    }
    const align = document.querySelector('#read-align').value;
    sample.style.textAlign = align === 'left' ? 'left' : 'justify';
    sample.style.wordBreak = align === 'break' ? 'break-all' : 'keep-all';
    sample.style.setProperty('--read-indent', document.querySelector('#read-indent').checked ? '1em' : '0');
    paintMarker();
  }

  // Dialogue highlighter — the same geometry the theme draws (src/apply.js markerGeometry / markerBackground)
  const marker = { shape: 'stroke', tilt: 'flat', pos: 'center' };
  const TILT = { flat: { rise: 0, mid: 57 }, slant: { rise: 18, mid: 56 }, steep: { rise: 48, mid: 50 } };
  const POS = { center: {}, bottom: { tiltK: 0.5, base: 96 } };
  const n = v => Number(v.toFixed(2));
  const parseColor = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; } const h = String(c).trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1); };
  function geometry(thick, tiltKey, posKey) {
    const tilt = TILT[tiltKey] || TILT.flat, pos = POS[posKey] || POS.center;
    const T = Math.min(100, Math.max(10, thick));
    const rise = Math.max(0, Math.min(tilt.rise * (pos.tiltK || 1), 100 - T));
    const half = (rise + T) / 2;
    const mid = Math.min(100 - half, Math.max(half, pos.base ? pos.base - T / 2 : tilt.mid));
    return { T, l: mid + rise / 2 - T / 2, r: mid - rise / 2 - T / 2 };
  }
  function markerBackground(color, thick) {
    const { T, l, r } = geometry(thick, marker.shape === 'stroke' ? marker.tilt : 'flat', marker.pos);
    const lb = l + T, rb = r + T, w = Math.min(1.8, T * 0.07);
    const [cr, cg, cb, ca] = parseColor(color), rgb = `rgb(${cr},${cg},${cb})`, op = Math.min(1, ca);
    if (marker.shape === 'pill') {
      const ink = `rgba(${cr},${cg},${cb},${n(op)})`, cap = n(T / 200), y = T === 100 ? 50 : n(l / (100 - T) * 100);
      return `radial-gradient(ellipse 100% 50% at 100% 50%, ${ink} 99%, transparent 100%) left ${y}% / min(${cap}em, 50%) ${n(T)}% no-repeat, radial-gradient(ellipse 100% 50% at 0% 50%, ${ink} 99%, transparent 100%) right ${y}% / min(${cap}em, 50%) ${n(T)}% no-repeat, linear-gradient(${ink}, ${ink}) center ${y}% / max(0px, calc(100% - ${n(cap * 2)}em)) ${n(T)}% no-repeat`;
    }
    const svg = marker.shape === 'rectangle'
      ? `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><rect x='0' y='${n(l)}' width='100' height='${n(T)}' fill='${rgb}' fill-opacity='${n(op)}'/></svg>`
      : (() => {
        const stroke = [`M0,${n(l + T * 0.22)}`, `L2.2,${n(l)}`, `Q25,${n(l - w + (r - l) * 0.25)} 50,${n((l + r) / 2)}`, `T98.6,${n(r)}`,
          `L100,${n(r + T * 0.5)}`, `L97.2,${n(rb)}`, `Q75,${n(rb + w - (rb - lb) * 0.25)} 50,${n((lb + rb) / 2)}`, `T0.8,${n(lb)}`, 'Z'].join(' ');
        return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='p' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='${rgb}' stop-opacity='${n(op * 0.45)}'/><stop offset='0.14' stop-color='${rgb}' stop-opacity='0'/></linearGradient></defs><path d='${stroke}' fill='${rgb}' fill-opacity='${n(op)}'/><path d='${stroke}' fill='url(#p)'/></svg>`;
      })();
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
  }
  const thickInput = document.querySelector('#read-thick');
  function paintMarker() {
    if (!thickInput) return;
    const thick = Number(thickInput.value);
    form.querySelector('output[for="read-thick"]').textContent = thick + '%';
    thickInput.setAttribute('aria-valuetext', thick + '%');
    const color = getComputedStyle(document.documentElement).getPropertyValue('--marker') || 'rgba(20,165,255,.24)';
    sample.style.setProperty('--read-marker', markerBackground(color, thick));
    for (const group of form.querySelectorAll('.seg[data-key]')) for (const b of group.children) b.setAttribute('aria-pressed', String(b.dataset.value === marker[group.dataset.key]));
    // like the theme, the rectangle and the pill always lie flat
    for (const b of form.querySelectorAll('.seg[data-key="tilt"] button')) b.disabled = marker.shape !== 'stroke';
  }
  form.addEventListener('click', event => {
    const b = event.target.closest('.seg[data-key] button');
    if (!b || b.disabled) return;
    marker[b.parentElement.dataset.key] = b.dataset.value;
    paintMarker();
  });
  // the highlighter color follows the site's white / night
  document.addEventListener('bl-theme', () => requestAnimationFrame(paintMarker));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintMarker);
  form.addEventListener('input', updateReading);
  form.addEventListener('change', updateReading);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => { Object.assign(marker, { shape: 'stroke', tilt: 'flat', pos: 'center' }); requestAnimationFrame(updateReading); });
  updateReading();

  const query = document.querySelector('#feature-query');
  const groups = [...document.querySelectorAll('.feature-group')];
  const cards = [...document.querySelectorAll('.feature-card')];
  const originalOpen = new Map();
  groups.forEach(group => group.querySelectorAll('.feature-card').forEach((card, i) => card.style.setProperty('--i', Math.min(i, 12))));
  let searching = false;
  function filter() {
    const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length && !searching) groups.forEach(group => originalOpen.set(group, group.open));
    let total = 0;
    for (const group of groups) {
      let count = 0;
      for (const card of group.querySelectorAll('.feature-card')) {
        const text = card.textContent.toLocaleLowerCase();
        const matches = terms.every(term => text.includes(term));
        card.hidden = !matches;
        if (matches) count++;
      }
      group.hidden = count === 0;
      group.querySelector('.feature-group-count').textContent = count + '가지';
      if (terms.length) group.open = count > 0;
      else if (searching) group.open = originalOpen.get(group);
      total += count;
    }
    searching = terms.length > 0;
    document.querySelector('#feature-result').textContent = searching
      ? `${cards.length}가지 중 ${total}가지 기능` : `${cards.length}가지 기능 안내`;
    document.querySelector('#feature-empty').hidden = total > 0;
  }
  query.addEventListener('input', filter);
  document.querySelector('#feature-clear').addEventListener('click', () => {
    query.value = ''; filter(); query.focus();
  });
  filter();
  document.querySelector('.feature-search').hidden = false;
})();
