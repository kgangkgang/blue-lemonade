// 아래쪽 장면 영상: 화면에 들어올 때만 받아서 조용히 되풀이 · 움직임 줄이기면 멈춘 그림 · 숨은 화면은 받지 않아요. 접힌 칸 안 자리로 가는 링크는 그 칸을 열어요.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const io = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.isIntersecting && !reduced.matches && v.offsetParent) { if (!v.getAttribute('src')) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause(); }), { threshold: .35 });
  const films = [...document.querySelectorAll('[data-film] video')]; films.forEach(v => io.observe(v));
  // 기기를 바꾸면 보이는 화면이 달라지니 다시 봐요 · 장면 아래 작은 고르기는 첫 화면의 고르기를 눌러 줘요
  document.addEventListener('bl-device', () => films.forEach(v => { io.unobserve(v); if (!v.offsetParent) v.pause(); io.observe(v); }));
  document.addEventListener('click', e => { const b = e.target.closest('.scene-pick [data-device]'); if (b) document.querySelector('.hero .device-pick [data-device="' + b.dataset.device + '"]')?.click(); });
  const openTo = h => { if (!h || h.length < 2) return; let t; try { t = document.querySelector(h); } catch { return; } if (!t) return; let moved = false; for (let p = t.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) { p.open = true; moved = true; } if (moved) requestAnimationFrame(() => t.scrollIntoView({ block: 'start' })); };
  addEventListener('hashchange', () => openTo(location.hash));
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a) openTo(a.getAttribute('href')); });
  openTo(location.hash);
})();
