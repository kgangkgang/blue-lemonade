// 2026-10-19 「처음이면 이것만」: 주소 복사 · 지금 판 화면 크게 보기 (#lightbox 를 같이 씀)
(() => {
  'use strict';
  const root = document.querySelector('#start');
  if (!root) return;
  const copy = root.querySelector('[data-copy-repo]'), status = root.querySelector('[data-copy-status]');
  const statusHtml = status ? status.innerHTML : '';
  let timer = 0;
  copy?.addEventListener('click', async () => {
    const text = root.querySelector('.start-copy code').textContent.trim();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const range = document.createRange(); range.selectNodeContents(root.querySelector('.start-copy code'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    }
    copy.textContent = ok ? '복사했어요' : '선택했어요';
    if (status) status.textContent = ok ? '복사했어요. 실리태번 확장 설치 칸에 붙여 넣으세요.' : '주소를 선택했어요. 길게 눌러 복사해 주세요.';
    clearTimeout(timer);
    timer = setTimeout(() => { copy.textContent = '주소 복사'; if (status) status.innerHTML = statusHtml; }, 2600);
  });
  const lightbox = document.querySelector('#lightbox');
  root.querySelectorAll('.start-shot-open').forEach(button => button.addEventListener('click', () => {
    const img = [...button.querySelectorAll('img')].find(i => getComputedStyle(i).display !== 'none') || button.querySelector('img');
    if (!lightbox || !img) return;
    const big = lightbox.querySelector('img');
    big.src = img.currentSrc || img.src; big.alt = img.alt;
    const note = lightbox.querySelector('p'); if (note) note.textContent = button.dataset.title || '';
    lightbox.showModal();
  }));
})();
