// 원래 클릭 대상은 유지하고, 즐겨찾기 이름과 항목 도구 묶음만 보탠다.
export function startCompactLayout() {

    // Chat Completion의 숫자 전용 응답 길이에 원래 입력값을 사용하는 슬라이더를 붙인다.
    const response = document.querySelector('#openai_max_tokens');
    if (response && !document.querySelector('#bl-response-range')) {
        const range = document.createElement('input');
        range.type = 'range'; range.id = 'bl-response-range';
        range.setAttribute('aria-label', response.closest('.range-block')?.querySelector('.range-block-title')?.textContent || '최대 응답 길이 (토큰)');
        response.closest('.range-block')?.append(range);
        const sync = () => {
            range.min = response.min || '1'; range.max = response.max || '128000'; range.step = response.step || '1';
            range.disabled = response.disabled;
            if (response.value && Number.isFinite(response.valueAsNumber)) range.value = response.value;
        };
        range.addEventListener('input', () => {
            response.value = range.value;
            response.dispatchEvent(new Event('input', {bubbles:true}));
        });
        range.addEventListener('change', () => response.dispatchEvent(new Event('change', {bubbles:true})));
        response.addEventListener('input', sync); response.addEventListener('change', sync);
        document.addEventListener('change', () => setTimeout(sync, 0));
        new MutationObserver(sync).observe(response, {attributes:true, attributeFilter:['min','max','step','disabled','value']});
        sync();
    }
    // 이름 앞 고정 여백 대신, 제목과 이름을 실제 한 줄의 이웃 요소로 배치한다.
    const personaControls = document.querySelector('#persona_controls');
    const personaHeading = document.querySelector('.persona_management_current_persona > h4.standoutHeader:first-child');
    const personaName = document.querySelector('#your_name');
    const personaTitleRow = document.createElement('div');
    personaTitleRow.className = 'bl-persona-title-row';
    function refreshPersonaTitle() {
        if (!personaControls || !personaHeading || !personaName) return;
        if (document.body.classList.contains('salty')) {
            if (!personaTitleRow.isConnected) {
                personaTitleRow.append(personaHeading, personaName);
                personaControls.prepend(personaTitleRow);
            }
        } else if (personaTitleRow.isConnected) {
            personaControls.before(personaHeading);
            personaControls.prepend(personaName);
            personaTitleRow.remove();
        }
    }
    refreshPersonaTitle();
    const favorites = document.querySelector('#HotSwapWrapper');
    const world = document.querySelector('#WorldInfo');
    function refreshFavorites() {
        if (!favorites) return;
        let heading = favorites.querySelector('.bl-favorites-heading');
        if (!heading) {
            heading = document.createElement('div');
            heading.className = 'bl-favorites-heading';
            heading.innerHTML = '<i class="fa-solid fa-star" aria-hidden="true"></i><span>즐겨찾기</span><small></small>';
            favorites.prepend(heading);
        }
        const avatars = favorites.querySelectorAll('.hotswap > .avatar');
        const count = heading.querySelector('small');
        if (count.textContent !== String(avatars.length)) count.textContent = String(avatars.length);
        for (const avatar of avatars) {
            const name = avatar.querySelector('img')?.alt || avatar.title.split('\n')[0];
            let label = avatar.querySelector('.bl-fav-name');
            if (!label) {
                label = document.createElement('span');
                label.className = 'bl-fav-name';
                avatar.append(label);
            }
            if (label.textContent !== name) label.textContent = name;
        }
    }
    function refreshWorld() {
        if (!world) return;
        if (!document.body.classList.contains("salty")) {
            for (const menu of world.querySelectorAll(".bl-wi-actions")) {
                for (const action of menu.querySelectorAll(".menu_button")) {
                    action.querySelector("span")?.remove();
                    menu.before(action);
                }
                menu.remove();
            }
            return;
        }
        for (const header of world.querySelectorAll('.world_entry > form > .inline-drawer > .inline-drawer-header')) {
            if (header.querySelector('.bl-wi-actions')) continue;
            const actions = [...header.children].filter(el => el.matches('.move_entry_button, .duplicate_entry_button, .delete_entry_button'));
            if (!actions.length) continue;
            const menu = document.createElement('details');
            menu.className = 'bl-wi-actions';
            const summary = document.createElement('summary');
            summary.setAttribute('aria-label', '항목 작업');
            summary.title = '항목 작업';
            summary.textContent = '⋯';
            menu.append(summary);
            const body = document.createElement('div');
            body.className = 'bl-wi-action-list';
            for (const action of actions) {
                const label = document.createElement('span');
                label.textContent = action.matches('.move_entry_button') ? '옮기기' : action.matches('.duplicate_entry_button') ? '복제' : '삭제';
                action.append(label);
                body.append(action);
            }
            menu.append(body);
            header.append(menu);
            body.addEventListener('click', () => { menu.open = false; });
        }
    }
    // 퀵 리플라이의 원래 버튼을 옮긴다. 확장의 다시 그리기/팝아웃도 그대로 따른다.
    const sendForm = document.querySelector('#send_form');
    const mobile = matchMedia('(max-width: 1000px)');
    function placeQuickReplies() {
        const bar = sendForm?.querySelector('#qr--bar');
        const row = sendForm?.querySelector('#nonQRFormItems');
        if (!bar || !row) return;
        const enabled = document.body.classList.contains('salty');
        const target = enabled && mobile.matches ? row : sendForm;
        if (bar.parentElement !== target) target.append(bar);
        if (!enabled && bar.nextElementSibling !== row) row.before(bar);
        if (enabled) {
            if (!bar.hasAttribute('tabindex')) bar.tabIndex = 0;
            bar.setAttribute('aria-label', '빠른 답장');
        }
    }
    placeQuickReplies();
    if (sendForm) new MutationObserver(placeQuickReplies).observe(sendForm, { childList: true, subtree: true });
    // 3.5.2 퀵 리플라이 줄은 가로 한 줄이라 마우스 휠(세로)로는 안 움직이고 Shift+휠이어야 넘어갔다 (사용자: "그냥 마우스 스크롤하면
    // 옆으로 넘어가게"). 줄이 넘칠 때 세로 휠을 가로로 바꿔 준다 — 줄이 다시 그려져도 되게 입력판에 한 번만 건다.
    // 휠 한 칸씩 부드럽게 가되 빨리 돌리면 목표를 이어 붙인다 (smooth 를 매번 새로 부르면 남은 거리를 잃음)
    let qrTarget = null;
    let qrIdle = 0;
    sendForm?.addEventListener('wheel', (event) => {
        if (!document.body.classList.contains('salty') || event.ctrlKey) return;
        const bar = event.target.closest?.('#qr--bar');
        if (!bar || bar.scrollWidth <= bar.clientWidth + 1) return;
        const dy = event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? bar.clientWidth : 1);
        if (!dy || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // 가로 휠 · 트랙패드 옆으로 밀기는 브라우저가 알아서
        event.preventDefault();
        const max = bar.scrollWidth - bar.clientWidth;
        qrTarget = Math.max(0, Math.min(max, (qrTarget ?? bar.scrollLeft) + dy));
        bar.scrollTo({ left: qrTarget, behavior: Math.abs(dy) >= 40 ? 'smooth' : 'auto' });
        clearTimeout(qrIdle);
        qrIdle = setTimeout(() => { qrTarget = null; }, 250);
    }, { passive: false });
    new MutationObserver(() => { placeQuickReplies(); refreshWorld(); refreshPersonaTitle(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mobile.addEventListener('change', placeQuickReplies);
    // 실리태번이 최근 대화 화면을 다시 그려도 버전 전체를 두 줄로 유지한다.
    function refreshWelcome() {
        for (const label of document.querySelectorAll('.welcomeHeaderVersionDisplay')) {
            if (label.querySelector('.bl-version-main')) continue;
            const value = label.textContent.trim();
            const match = value.match(/^(SillyTavern\s+\S+)(.*)$/);
            if (!match) continue;
            const main = document.createElement('span');
            main.className = 'bl-version-main'; main.textContent = match[1];
            const build = document.createElement('span');
            build.className = 'bl-version-build'; build.textContent = match[2];
            label.replaceChildren(main, build);
        }
    }
    refreshWelcome();
    const chat = document.querySelector('#chat');
    if (chat) new MutationObserver(mutations => {
        // 환영 화면은 메시지 안에 안 생긴다 — 답변이 자라며 들어오는 문단은 들여다보지 않는다 (2.5.2)
        if (mutations.some(m => !m.target.closest?.('.mes') && [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('.welcomePanel, .welcomeHeaderVersionDisplay') || n.querySelector?.('.welcomeHeaderVersionDisplay'))))) refreshWelcome();
    }).observe(chat, { childList: true, subtree: true });
    refreshFavorites();
    refreshWorld();
    if (favorites) new MutationObserver(refreshFavorites).observe(favorites, { childList: true, subtree: true });
    if (world) new MutationObserver(refreshWorld).observe(world, { childList: true, subtree: true });
    document.addEventListener('click', event => {
        for (const menu of document.querySelectorAll('.bl-wi-actions[open]')) {
            if (!menu.contains(event.target)) menu.open = false;
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        for (const menu of document.querySelectorAll('.bl-wi-actions[open]')) {
            menu.open = false;
            menu.querySelector('summary').focus();
        }
    });
}
