(() => {
  const canTilt = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
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
  }
  canTilt.addEventListener('change', () => phones.forEach(reset));
  window.addEventListener('blur', () => phones.forEach(reset));
})();
