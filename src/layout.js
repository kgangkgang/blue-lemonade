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
        // 폰(1000px 이하)은 입력 줄의 남는 폭(아이콘 줄)에 끼워 넣는다. 단 '입력창 위'(3.7.1, body.salty-qr-top)를 골랐으면
        // 끼워 넣지 않고 #send_form 에 두어 입력판 위 한 줄을 통째로 쓴다 — 아이콘을 많이 빼 둔 사람은 아이콘 줄이 좁아서 고른 설정이다
        const top = enabled && document.body.classList.contains('salty-qr-top');
        const target = enabled && mobile.matches && !top ? row : sendForm;
        if (bar.parentElement !== target) target.append(bar);
        if (!enabled && bar.nextElementSibling !== row) row.before(bar);
        if (enabled) {
            if (!bar.hasAttribute('tabindex')) bar.tabIndex = 0;
            bar.setAttribute('aria-label', '빠른 답장');
        }
        syncQrFind(bar, enabled);
        syncQrTitles(enabled);
        scheduleQrEdges();
    }
    function syncQrTitles(enabled = document.body.classList.contains('salty')) {
        const settings = globalThis.quickReplyApi?.settings;
        if (!settings) return;
        const links = [settings.config, settings.chatConfig, settings.charConfig].flatMap(config => config?.setList || []);
        const seen = new Set();
        for (const link of links) for (const qr of link.set?.qrList || []) {
            if (seen.has(qr)) continue;
            seen.add(qr);
            const expander = qr.dom?.querySelector('.qr--button-expander');
            if (!expander || !qr.hasContext) continue;
            const names = [...new Set((qr.contextList || []).map(c => c.set?.name).filter(Boolean))];
            const title = names.join(' · ');
            const text = enabled && title ? title : '⋮';
            if (expander.textContent !== text) expander.textContent = text;
            const tooltip = title ? `${title} 목록 열기` : '목록 열기';
            if (expander.title !== tooltip) expander.title = tooltip;
        }
    }
    // 3.6.1: 몸 클래스 · 입력판이 바뀔 때마다 그 자리에서 재면, 답변이 자라는 도중에 문서 전체 강제 레이아웃이 돌았다
    // (폰 리그 답변 한 번에 0.25초 — 실리태번이 스트리밍 중 hideAllSwipeButtons 를 붙였다 뗌). 다음 프레임 직전에 한 번만 잰다:
    // 그때는 그 프레임의 레이아웃을 어차피 해야 하고, 값이 같으면 아무것도 안 써서 다시 계산도 없다. 넘기기(scroll)는 그대로 바로
    let qrEdgeFrame = 0;
    function scheduleQrEdges() {
        if (qrEdgeFrame) return;
        qrEdgeFrame = requestAnimationFrame(() => {
            qrEdgeFrame = 0;
            updateQrEdges(sendForm?.querySelector('#qr--bar'));
        });
    }
    // 3.5.3 QR 줄 앞 돋보기: 모든 퀵 리플라이를 목록으로 찾기 (qrfind.js — 처음 누를 때 불러옴). 확장이 줄을 다시 그리면 다시 붙임
    let qrFinderModule = null;
    function syncQrFind(bar, enabled) {
        let find = bar.querySelector(':scope > #bl-qr-find');
        const hasButtons = !!bar.querySelector('.qr--button');
        if (!enabled || !hasButtons || document.body.classList.contains('salty-qr-find-off')) {
            find?.remove();
            qrFinderModule?.closeQrFind();
            return;
        }
        if (!find) {
            find = document.createElement('button');
            find.type = 'button';
            find.id = 'bl-qr-find';
            find.className = 'menu_button';
            find.setAttribute('aria-label', '퀵 리플라이 찾기');
            find.innerHTML = '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>';
            find.addEventListener('click', (event) => {
                event.stopPropagation();
                import('./qrfind.js').then(m => {
                    qrFinderModule = m;
                    if (find.isConnected && !document.body.classList.contains('salty-qr-find-off')) m.openQrFind(find);
                }).catch(error => console.warn('[Blue Lemonade] 퀵 리플라이 찾기', error));
            });
        }
        const pop = bar.querySelector(':scope > #qr--popoutTrigger');
        const wanted = pop ? pop.nextElementSibling : bar.firstElementChild;
        if (wanted !== find) (pop ? pop.after(find) : bar.prepend(find));
    }
    // 3.7.4 QR ⋮ 하위 목록: 실리태번은 누른 자리를 바닥으로 위로 키우고(bottom) 높이 제한이 없어, 항목이 많으면 화면 위로 솟구쳐
    // 잘린 항목을 못 골랐다. 목록이 붙는 순간 누른 자리 위 남는 높이를 --bl-ctx-max 로 주고(넘치면 CSS 가 안에서 스크롤),
    // 위가 너무 좁으면(160px 미만이고 아래가 더 넓음) 아래로 펼치고, 오른쪽으로 넘치면 안쪽으로 당긴다. 몸의 직계 자식만 본다(가벼움).
    // Context QR buttons open their menu from the entire tile, including the label.
    // Delegate to the native expander so chaining and menu execution stay in Quick Reply.
    document.addEventListener('click', event => {
        if (!document.body.classList.contains('salty')) return;
        const button = event.target.closest?.('#qr--bar .qr--button.qr--hasCtx, #qr--popout .qr--button.qr--hasCtx');
        if (!button || event.target.closest('.qr--button-expander')) return;
        const expander = button.querySelector('.qr--button-expander');
        if (!expander) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const rect = button.getBoundingClientRect();
        expander.dispatchEvent(new MouseEvent('click', {
            bubbles: true, cancelable: true,
            clientX: event.clientX || rect.left + rect.width / 2,
            clientY: event.clientY || rect.top + rect.height / 2,
        }));
    }, true);
    const fitQrMenu = (blocker) => {
        const menu = blocker.querySelector(':scope > .ctx-menu');
        if (!menu || !document.body.classList.contains('salty')) return;
        menu.classList.toggle('bl-ctx-single', menu.querySelectorAll(':scope > .ctx-header').length === 1);
        const vh = window.innerHeight, vw = window.innerWidth, gap = 8;
        const bottom = parseFloat(menu.style.bottom);
        if (Number.isFinite(bottom)) {
            const tapY = vh - bottom;
            const above = tapY - gap, below = vh - tapY - gap;
            if (above < 160 && below > above) {
                menu.style.bottom = 'auto';
                menu.style.top = `${tapY}px`;
                menu.style.setProperty('--bl-ctx-max', `${Math.max(120, below)}px`);
            } else {
                menu.style.setProperty('--bl-ctx-max', `${Math.max(120, above)}px`);
            }
        }
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > vw - gap) menu.style.left = `${Math.max(gap, vw - gap - rect.width)}px`;
        });
    };
    const qrPopoutObservers = new Map();
    const watchQrPopout = node => {
        if (qrPopoutObservers.has(node)) return;
        syncQrTitles();
        const observer = new MutationObserver(() => syncQrTitles());
        observer.observe(node, {childList: true, subtree: true});
        qrPopoutObservers.set(node, observer);
    };
    const initialPopout = document.getElementById('qr--popout');
    if (initialPopout) watchQrPopout(initialPopout);
    new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node.nodeType === 1 && node.classList.contains('ctx-blocker')) fitQrMenu(node);
                if (node.nodeType === 1 && node.id === 'qr--popout') {
                    watchQrPopout(node);
                }
            }
        }
        for (const [node, observer] of qrPopoutObservers) {
            if (!node.isConnected) { observer.disconnect(); qrPopoutObservers.delete(node); }
        }
    }).observe(document.body, { childList: true });
    // QR 줄 흐림 · 스냅 · 휠 · 끌기는 아래 모듈 함수 (설정 창 미리보기 줄도 같이 씀)
    sendForm?.addEventListener('scroll', (event) => { if (event.target.id === 'qr--bar') updateQrEdges(event.target); }, true);
    window.addEventListener('resize', scheduleQrEdges);
    placeQuickReplies();
    if (sendForm) new MutationObserver(placeQuickReplies).observe(sendForm, { childList: true, subtree: true });
    sendForm?.addEventListener('wheel', event => qrWheel(event, event.target.closest?.('#qr--bar')), { passive: false });
    sendForm?.addEventListener('pointerdown', event => qrPointerDown(event, event.target.closest?.('#qr--bar')));
    let wasEnabled = document.body.classList.contains('salty');
    let wasQrTop = document.body.classList.contains('salty-qr-top');
    let wasQrVertical = document.body.classList.contains('salty-qr-y');
    let wasFindOff = document.body.classList.contains('salty-qr-find-off');
    new MutationObserver(() => {
        const enabled = document.body.classList.contains('salty');
        const qrTop = document.body.classList.contains('salty-qr-top');
        const qrVertical = document.body.classList.contains('salty-qr-y');
        const findOff = document.body.classList.contains('salty-qr-find-off');
        const themeChanged = enabled !== wasEnabled;
        if (themeChanged || qrTop !== wasQrTop || qrVertical !== wasQrVertical || findOff !== wasFindOff) placeQuickReplies();
        if (themeChanged) { refreshWorld(); refreshPersonaTitle(); }
        wasEnabled = enabled; wasQrTop = qrTop; wasQrVertical = qrVertical; wasFindOff = findOff;
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
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

// ───────── 퀵 리플라이 줄 (3.5.2~3.5.4) — 입력판의 #qr--bar 와 설정 창 미리보기(.bl-qr-sample)가 같이 씀 ─────────
const QR_LEADS = ':scope > #qr--popoutTrigger, :scope > #bl-qr-find, :scope > .bl-qr-find-sample';

// 3.5.3 넘치는 쪽 끝 흐림 + 스냅 자리. 앞에 붙은 단추(창 띄우기 · 돋보기) 폭만큼은 빼고 잰다
export function updateQrEdges(bar) {
    if (!bar || !document.body.classList.contains('salty')) return;
    const max = bar.scrollWidth - bar.clientWidth;
    bar.classList.toggle('bl-qr-more-left', max > 2 && bar.scrollLeft > 2);
    bar.classList.toggle('bl-qr-more-right', max > 2 && bar.scrollLeft < max - 2);
    const leads = [...bar.querySelectorAll(QR_LEADS)];
    // sticky 의 left 는 줄의 안쪽 여백 안쪽부터 잰다 → 여백 · 테두리를 뺌 (폰 줄은 좌우 4px — 안 빼면 4px 틈으로 글자가 보임)
    const cs = getComputedStyle(bar);
    const box = bar.getBoundingClientRect();
    const right = leads.length ? Math.max(...leads.map(el => el.getBoundingClientRect().right)) : 0;
    const lead = leads.length ? right - (box.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)) : 0;
    bar.style.setProperty('--bl-qr-lead', `${Math.max(0, Math.round(lead))}px`);
    // 스냅 자리: 스크롤 칸(안쪽 여백 포함) 왼쪽 끝부터 앞 단추 오른쪽 + 간격 (앞 단추가 없으면 안쪽 여백만)
    const gap = parseFloat(cs.columnGap) || 0;
    const snap = leads.length ? right - (box.left + parseFloat(cs.borderLeftWidth)) + gap : parseFloat(cs.paddingLeft);
    bar.style.setProperty('--bl-qr-snap', `${Math.max(0, Math.round(snap))}px`);
    const pop = bar.querySelector(':scope > #qr--popoutTrigger');
    const find = bar.querySelector(':scope > #bl-qr-find, :scope > .bl-qr-find-sample');
    if (find) find.style.left = pop ? `${Math.round(pop.getBoundingClientRect().width) + 5}px` : '0px';
    // 3.5.4 왼쪽 흐림은 버튼이 앞 단추 밑으로 반쯤 걸려 있을 때만 (넘기는 중) — 멈추면 스냅으로 딱 붙어 흐림도 꺼짐.
    // 늘 켜 두면 스냅된 첫 버튼 왼쪽이 흐려져 밝은 조각처럼 보였다 (사용자: "흰색 네모" · "흐림은 있는 게 낫다")
    let cut = false;
    if (leads.length && bar.scrollLeft > 2 && max > 2) {
        const edge = box.left + parseFloat(cs.borderLeftWidth) + snap;
        for (const pill of bar.querySelectorAll('.qr--button')) {
            const r = pill.getBoundingClientRect();
            if (r.right <= edge - gap + 1) continue; // 앞 단추 밑에 다 숨은 것
            cut = r.left < edge - 1.5;
            break;
        }
    }
    bar.classList.toggle('bl-qr-cut-left', cut);
}

// 3.5.2 줄이 가로로 넘칠 때 세로 휠을 가로로 (Shift 없이). 휠 한 칸씩 부드럽게, 빨리 돌리면 목표를 이어 붙임.
// 세로 스크롤 모드(가로로 안 넘침)면 손대지 않음 — 브라우저가 위아래로
let qrTarget = null;
let qrIdle = 0;
function qrWheel(event, bar) {
    if (!bar || !document.body.classList.contains('salty') || event.ctrlKey) return;
    if (bar.scrollWidth <= bar.clientWidth + 1) return;
    const dy = event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? bar.clientWidth : 1);
    if (!dy || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // 가로 휠 · 트랙패드 옆으로 밀기는 브라우저가 알아서
    event.preventDefault();
    const max = bar.scrollWidth - bar.clientWidth;
    qrTarget = Math.max(0, Math.min(max, (qrTarget ?? bar.scrollLeft) + dy));
    bar.scrollTo({ left: qrTarget, behavior: Math.abs(dy) >= 40 ? 'smooth' : 'auto' });
    clearTimeout(qrIdle);
    qrIdle = setTimeout(() => { qrTarget = null; }, 250);
}

// 3.5.3 PC 마우스로 잡아 끌기. 6px 넘게 움직였을 때만 — 그 뒤 따라오는 click 은 삼켜 버튼이 눌리지 않게
let qrDrag = null;
let dragHooked = false;
function qrPointerDown(event, bar) {
    if (!bar || event.pointerType !== 'mouse' || event.button !== 0 || !document.body.classList.contains('salty')) return;
    if (bar.scrollWidth <= bar.clientWidth + 1 || event.target.closest('#bl-qr-find, #qr--popoutTrigger, .bl-qr-find-sample')) return;
    hookDrag();
    qrDrag = { bar, x: event.clientX, left: bar.scrollLeft, moved: false, id: event.pointerId };
}
function hookDrag() {
    if (dragHooked) return;
    dragHooked = true;
    window.addEventListener('pointermove', (event) => {
        if (!qrDrag || event.pointerId !== qrDrag.id) return;
        const dx = event.clientX - qrDrag.x;
        if (!qrDrag.moved && Math.abs(dx) < 6) return;
        if (!qrDrag.moved) {
            qrDrag.moved = true;
            qrDrag.bar.classList.add('bl-qr-dragging');
            qrTarget = null;
        }
        qrDrag.bar.scrollLeft = qrDrag.left - dx;
    });
    const endDrag = () => {
        if (!qrDrag) return;
        const { bar, moved } = qrDrag;
        qrDrag = null;
        bar.classList.remove('bl-qr-dragging');
        if (!moved) return;
        const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
}

/** 3.5.4 설정 창 미리보기 줄에 입력판 QR 줄과 같은 휠 · 끌기 · 흐림 · 스냅 */
export function bindQrScroller(el) {
    if (!el || el._blQr) return;
    el._blQr = true;
    el.addEventListener('wheel', event => qrWheel(event, el), { passive: false });
    el.addEventListener('pointerdown', event => qrPointerDown(event, el));
    el.addEventListener('scroll', () => updateQrEdges(el), { passive: true });
    requestAnimationFrame(() => updateQrEdges(el));
}
