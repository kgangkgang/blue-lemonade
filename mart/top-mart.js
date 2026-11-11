// 머리줄 「마트」 단추 — 누르면 「어느 마트로 갈까요?」(액자 마트 · 글꾸 마트)에서 바로 골라 가요. 홈 · 마트 페이지 공용(top-mart.css).
// PC 는 단추 아래 작은 메뉴, 폰(640 이하)은 아래에서 올라오는 시트. 바깥 누르기 · Esc · 고르기로 닫혀요.
(() => {
    // 마트 자료 항목 수(mart/data/frames.json · geulkku/index.json) — 홈이 큰 자료를 받지 않게 여기 적어 두고, 마트 검사(martux.mjs)가 자료와 같은지 확인해요
    const COUNTS = { frames: 1448, geulkku: 407 };   // 11-11 글꾸 = 심플 새 틀 수(data/geulkku/index.json count · 옛 글꾸는 뺐어요)
    const btn = document.querySelector('.top-mart');
    if (!btn) return;
    const base = btn.dataset.martBase || 'mart/';
    const here = document.body.dataset.mart || '';
    const go = (id, name, sub) => `<a class="mart-menu-go" href="${base}${id}/"${here === id ? ' aria-current="page"' : ''}><span class="mart-menu-cover is-${id}" aria-hidden="true"></span><span class="mart-menu-text"><b>${name}</b><small>${sub}</small></span><span class="mart-menu-arrow" aria-hidden="true">›</span></a>`;
    const menu = document.createElement('div');
    menu.className = 'mart-menu'; menu.id = 'mart-menu'; menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-labelledby', 'mart-menu-title');
    menu.innerHTML = `<span class="mart-menu-grip" aria-hidden="true"></span><p class="mart-menu-title" id="mart-menu-title">어느 마트로 갈까요?</p>${go('frames', '액자 마트', `사진 · 프로필 장식 액자 <b>${COUNTS.frames}</b>종`)}${go('geulkku', '글꾸 마트', `로그 복사 꾸밈 틀 <b>${COUNTS.geulkku}</b>종`)}${go('genie', '🧞 글꾸 지니', '질문 몇 개로 글꾸 · 액자를 맞혀 줘요')}`;
    const scrim = Object.assign(document.createElement('div'), { className: 'mart-menu-scrim', hidden: true });
    document.body.append(scrim, menu);
    btn.setAttribute('aria-controls', 'mart-menu');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    const phone = matchMedia('(max-width:640px)');
    const place = () => {
        if (phone.matches) { menu.style.left = ''; menu.style.top = ''; return; }
        const r = btn.getBoundingClientRect(), w = menu.offsetWidth || 320;
        menu.style.top = `${Math.round(r.bottom + 8)}px`;
        menu.style.left = `${Math.round(Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8))}px`;
    };
    const open = () => {
        menu.hidden = false; scrim.hidden = !phone.matches;
        place();
        btn.setAttribute('aria-expanded', 'true');
        menu.querySelector('a')?.focus({ preventScroll: true });
    };
    const close = (back) => {
        if (menu.hidden) return;
        menu.hidden = true; scrim.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        if (back) btn.focus({ preventScroll: true });
    };
    btn.addEventListener('click', () => (menu.hidden ? open() : close(true)));
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) close(false); });
    scrim.addEventListener('click', () => close(true));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); close(true); } });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
    addEventListener('resize', () => { if (!menu.hidden) { scrim.hidden = !phone.matches; place(); } });
    addEventListener('scroll', () => { if (!menu.hidden && !phone.matches) place(); }, { passive: true });
})();
