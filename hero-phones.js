(() => {
  const canTilt = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const art = document.querySelector('.hero-art');
  const phones = [...document.querySelectorAll('.hero-art .phone')];
  const reset = phone => {
    for (const key of ['--tilt-x', '--tilt-y', '--lift']) phone.style.removeProperty(key);
  };
  for (const phone of phones) {
    phone.addEventListener('pointermove', event => {
      if (!canTilt.matches || event.pointerType === 'touch') return;
      const box = phone.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
      phone.style.setProperty('--tilt-x', `${(-y * 3).toFixed(2)}deg`);
      phone.style.setProperty('--tilt-y', `${(x * 8).toFixed(2)}deg`);
      phone.style.setProperty('--lift', '-4px');
    });
    phone.addEventListener('pointerleave', () => reset(phone));
    phone.addEventListener('pointercancel', () => reset(phone));
    // tap: the phone hops to the front with a small bounce
    phone.addEventListener('click', () => {
      phones.forEach(p => p.classList.toggle('front', p === phone));
      if (still.matches) return;
      phone.style.scale = '1.06';
      setTimeout(() => phone.style.removeProperty('scale'), 170);
    });
  }
  canTilt.addEventListener('change', () => phones.forEach(reset));
  window.addEventListener('blur', () => phones.forEach(reset));

  // scroll depth: the two phones drift at different speeds and lean back as the hero leaves
  if (!art) return;
  let frame = 0, visible = true;
  const paint = () => {
    frame = 0;
    if (still.matches) return;
    const box = art.getBoundingClientRect();
    const p = Math.max(-1, Math.min(1, (innerHeight / 2 - (box.top + box.height / 2)) / innerHeight));
    art.style.setProperty('--par-y', `${(-p * 70).toFixed(1)}px`);
    art.style.setProperty('--par-rx', `${(Math.max(0, p) * 10).toFixed(2)}deg`);
  };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; art.classList.toggle('idle', !visible); if (visible) paint(); }).observe(art);
  addEventListener('scroll', () => { if (visible && !frame) frame = requestAnimationFrame(paint); }, { passive: true });
  addEventListener('resize', paint);
  paint();
})();
