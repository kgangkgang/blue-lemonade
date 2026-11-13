// 머리줄 「마트」 단추 — 누르면 「어느 마트로 갈까요?」(액자 마트 · 글꾸 마트)에서 바로 골라 가요. 홈 · 마트 페이지 공용(top-mart.css).
// PC 는 단추 아래 작은 메뉴, 폰(640 이하)은 아래에서 올라오는 시트. 바깥 누르기 · Esc · 고르기로 닫혀요.
(() => {
    // 마트 자료 항목 수(mart/data/frames.json · geulkku/index.json) — 홈이 큰 자료를 받지 않게 여기 적어 두고, 마트 검사(martux.mjs)가 자료와 같은지 확인해요
    const COUNTS = { frames: 1854, geulkku: 418 };   // 11-11 글꾸 = 심플 새 틀 수(data/geulkku/index.json count · 옛 글꾸는 뺐어요)
    const btn = document.querySelector('.top-mart');
    if (!btn) return;
    const base = btn.dataset.martBase || 'mart/';
    const here = document.body.dataset.mart || '';
    const go = (id, name, sub) => `<a class="mart-menu-go" href="${base}${id}/"${here === id ? ' aria-current="page"' : ''}><span class="mart-menu-cover is-${id}" aria-hidden="true"></span><span class="mart-menu-text"><b>${name}</b><small>${sub}</small></span><span class="mart-menu-arrow" aria-hidden="true">›</span></a>`;
    const menu = document.createElement('div');
    menu.className = 'mart-menu'; menu.id = 'mart-menu'; menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-labelledby', 'mart-menu-title');
    menu.innerHTML = `<span class="mart-menu-grip" aria-hidden="true"></span><p class="mart-menu-title" id="mart-menu-title">어느 마트로 갈까요?</p>${go('frames', '액자 마트', `사진 · 프로필 장식 액자 <b>${COUNTS.frames}</b>종`)}${go('geulkku', '글꾸 마트', `로그 복사 꾸밈 틀 <b>${COUNTS.geulkku}</b>종`)}`;
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

// 11-12 밤 PC 가로 넘김 줄: 세로 휠만 돌려도 옆으로 넘겨요(사용자 「걍 스크롤 마우스 휠 돌리면 되는 걸로 해 줘 … 쉬프트 누르고 해야 함 PC」) — 홈 · 글꾸 마트 · 액자 마트 공용.
//   가로로 넘치는 줄(overflow-x auto · scroll — .mart-hscroll · 분류 칩 · 묶음 탭 · 거르기 줄 · 표본 사진 줄 · 홈 주제 탭 …) 위에서 세로 휠 → 그 줄을 옆으로.
//   줄 끝에 닿았거나 넘칠 것이 없으면 막지 않아요(페이지 · 창이 그대로 내려가요 — 갇히지 않게). 트랙패드 가로 제스처 · Shift+휠 · Ctrl+휠(확대) · 폰 터치는 그대로.
//   안 건드리는 것: 세로로도 넘기는 칸(그 칸의 세로 스크롤이 먼저) · 한 장씩 딱 멈추는 넘김(scroll-snap — 홈 큰 사진 띠: 페이지를 내리다 갇혀요) · 글꾸 틀 안(.gk — 복사 글 그대로).
(() => {
    const over = (el, axis) => { const o = getComputedStyle(el)[axis === 'x' ? 'overflowX' : 'overflowY']; return o === 'auto' || o === 'scroll'; };
    document.addEventListener('wheel', (e) => {
        if (e.defaultPrevented || e.ctrlKey || e.shiftKey || e.metaKey || e.altKey) return;
        if (!e.deltaY || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const step = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerWidth : e.deltaY;
        for (let el = e.target instanceof Element ? e.target : e.target?.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
            if (el.scrollHeight > el.clientHeight + 1 && over(el, 'y')) {   // 세로로 넘기는 칸: 그쪽으로 더 갈 수 있으면 그 칸 몫
                if (step > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return;
                continue;
            }
            if (el.scrollWidth <= el.clientWidth + 1 || !over(el, 'x')) continue;
            if (el.closest('.gk') || getComputedStyle(el).scrollSnapType !== 'none') return;
            const before = el.scrollLeft; el.scrollLeft += step;
            if (el.scrollLeft !== before) e.preventDefault();
            return;
        }
    }, { passive: false });
})();
