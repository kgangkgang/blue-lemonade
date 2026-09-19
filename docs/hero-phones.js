(() => {
  const canTilt = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const art = document.querySelector('.hero-art');
  const phones = [...document.querySelectorAll('.hero-art .phone')];
  const screens = [...phones, ...document.querySelectorAll('.hero-art .browser')];
  const reset = phone => {
    for (const key of ['--tilt-x', '--tilt-y', '--lift']) phone.style.removeProperty(key);
  };
  for (const phone of screens) {
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
  }
  for (const phone of phones) {
    // tap: the phone hops to the front with a small bounce
    phone.addEventListener('click', () => {
      phones.forEach(p => p.parentElement.classList.toggle('front', p === phone));
      if (still.matches) return;
      phone.style.scale = '1.06';
      setTimeout(() => phone.style.removeProperty('scale'), 170);
    });
  }
  canTilt.addEventListener('change', () => screens.forEach(reset));
  window.addEventListener('blur', () => screens.forEach(reset));

  // pause the idle float, bubbles and glow while the hero is off screen
  if (art) new IntersectionObserver(([entry]) => art.classList.toggle('idle', !entry.isIntersecting)).observe(art);
})();
