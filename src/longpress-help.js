// 단추 길게 누르기 설명 (8.1.2 후보). 실리태번 · 테마 단추를 꾹 누르면 무슨 기능인지 작은 설명 창(help-sheet.js, 월드인포 ? 와 같은 창)이 떠요.
// 가볍게: 문서에 위임 리스너 한 벌만 — 감시자 · 단추마다 리스너 · 부팅 때 훑기 없음. 설명 사전(longpress-help-data.js)은
// 처음 길게 누를 때(PC 는 마우스를 올려 둘 때) 한 번만 불러와요. 짧게 누르면 원래 동작 그대로이고, 설명이 뜬 누름만 손을 뗄 때의 click 을 한 번 막아요.
// 열쇠: 요소 id → class → data-i18n 키 → title · aria-label 글 (누른 요소와 조상 3단계) — 실리태번이 단추 자리를 옮겨도 따라가요.

export const HOLD_MS = 500, HOVER_MS = 600, PREFETCH_MS = 200, MOVE_PX = 10, UP_LEVELS = 3, CLICK_GUARD_MS = 1500;
// 자기 길게 누르기가 있거나 이미 설명이 붙은 곳 — 기존 것이 이겨요. tools/scripts-src/longpress-help/help.json 의 excluded 와 같아야 해요(시험이 봐요).
export const SKIP = [
    '.mes_buttons > .extraMesButtons > *', '.mes_buttons > .bl-pinned', '.cg-mes-btn', '#jj-button', '#jj-popup .jj-prompts', '.bl-notes-more', '.bl-note', '.bl-note-owner', '.bl-look-fmtrow',
    '#llm_translate_input_button', '.mes_text img', '.bl-art-frame[data-bl-frame="image"]', 'span[data-asset-slot]', '.eh-pchip', '#chat .mes .name_text', '#chat .mes_text',
    '.cg-select-chip', '.llmt-select-delete', '.bwr_quickban', '#llmt-selection-selection', '#fruit-heart-v6', '#bl-deus-popover', '.bl-wi-help', '.salty-panel',
    '.swipes-counter', '#world_button', '.chat_lorebook_button', '#persona_lore_button',
    '.bl-wi-help-dialog',
].join(',');
// PC 마우스 올려 두기: 누르기 동작과는 안 겹치니 이미 설명이 있는 창 · 답 글 안만 빼요(… 메뉴 단추도 풍선 글은 보여요)
export const HOVER_SKIP = '#fruit-heart-v6,#bl-deus-popover,.salty-panel,.bl-wi-help,.bl-wi-help-dialog,#chat .mes_text';
// 글을 치는 칸 · 끄는 막대는 길게 누르기가 글 고르기 · 끌기예요
const TYPING = 'textarea,[contenteditable=""],[contenteditable="true"],input:not([type]),input[type=text],input[type=search],input[type=number],input[type=password],input[type=email],input[type=url],input[type=range]';
const MENU_ITEMS = '.mes_buttons > .extraMesButtons > *, .mes_buttons > .bl-pinned';

// 설명 창은 월드인포 ? 와 같은 help-sheet.js (그쪽이 시작할 때 이미 읽어 둬서 바로 와요)
const openSheet = help => import('./help-sheet.js').then(m => { const dialog = m.openHelpSheet(help); if (dialog) dialog.scrollTop = 0; return dialog; }) // 닫기 단추에 초점이 가며 긴 목록이 맨 아래로 내려가지 않게.catch(error => console.warn('[Blue Lemonade] 길게 누르기 설명 창', error));

/** 사전 목록 → 열쇠별 찾기표. 같은 열쇠는 scope 가 다를 때만 여럿 */
export function indexHelp(list) {
    const ids = new Map(), classes = new Map(), texts = new Map();
    const put = (map, key, entry) => { const old = map.get(key); if (old) old.push(entry); else map.set(key, [entry]); };
    for (const entry of list || []) {
        for (const id of entry.ids || []) put(ids, id, entry);
        for (const name of entry.classes || []) put(classes, name, entry);
        for (const text of entry.texts || []) put(texts, text, entry);
    }
    return { ids, classes, texts };
}

const pick = (list, node) => list?.find(entry => !entry.scope || node.closest(entry.scope)) || null;
/** data-i18n="[title]Foo;Bar" → ['Foo', 'Bar'] */
export const i18nKeys = node => String(node.getAttribute?.('data-i18n') || '').split(';').map(key => key.replace(/^\s*\[[^\]]*\]/, '').trim()).filter(Boolean);

/** 누른 요소에서 설명 찾기 → { entry, node } 또는 null. 1차 id · class(가까운 것부터), 2차 i18n 키 · title · aria-label */
export function findHelp(start, index, levels = UP_LEVELS) {
    if (!index || !start || start.nodeType !== 1) return null;
    const chain = [];
    for (let node = start, depth = 0; node && node.nodeType === 1 && depth <= levels; node = node.parentElement, depth++) {
        chain.push(node);
        if (node.matches('.mes, dialog, body, #chat')) break; // 메시지 · 창 바깥으로는 올라가지 않아요
    }
    for (const node of chain) {
        const ids = [node.id];
        if (node.tagName === 'LABEL' && node.htmlFor) ids.push(node.htmlFor);
        if (node.matches('label, .checkbox_label, .range-block')) for (const control of node.querySelectorAll('input[id], select[id], textarea[id]')) ids.push(control.id);
        for (const id of ids) { if (!id) continue; const entry = pick(index.ids.get(id), node); if (entry) return { entry, node }; }
        for (const name of node.classList) { const entry = pick(index.classes.get(name), node); if (entry) return { entry, node }; }
    }
    for (const node of chain) {
        for (const key of [...i18nKeys(node), node.getAttribute('title'), node.getAttribute('aria-label')]) {
            const text = String(key || '').trim();
            if (!text) continue;
            const entry = pick(index.texts.get(text), node);
            if (entry) return { entry, node };
        }
    }
    return null;
}

/** … 단추: 그 메시지의 … 메뉴 · 꺼내 둔 단추 설명을 한 창에 (메뉴 안 단추는 길게 누르면 꺼내기 · 넣기라 따로 설명을 못 띄워요) */
export function menuHelp(hint, entry, index, view = globalThis) {
    const list = [], seen = new Set();
    const buttons = [...(hint.closest('.mes')?.querySelectorAll(MENU_ITEMS) || [])].filter(button => button !== hint);
    const shown = button => view.getComputedStyle?.(button).display !== 'none';
    // 메뉴가 접혀 있거나 테마가 단추 줄을 통째로 숨긴 때는 모두 none 이라 가릴 수 없어요 — 그땐 직접 숨긴(style) 것만 빼요
    const anyShown = buttons.some(shown);
    for (const button of buttons) {
        if (anyShown ? !shown(button) : button.style?.display === 'none') continue;
        const found = findHelp(button, index, 0);
        if (!found || seen.has(found.entry)) continue;
        seen.add(found.entry);
        list.push([found.entry.title, found.entry.text]);
    }
    const body = [entry.text];
    if (list.length) body.push('아래는 이 메시지의 … 메뉴에 지금 있는 단추예요. 메뉴 안 단추를 길게 누르면 그 단추를 이름 줄로 꺼내거나 다시 메뉴로 넣어요.');
    return { title: entry.title, body, list };
}

export function helpFor(found, index, view) {
    if (found.node.matches('.extraMesButtonsHint')) return menuHelp(found.node, found.entry, index, view);
    return { title: found.entry.title, body: [found.entry.text] };
}

/**
 * 위임 리스너를 걸어요. isEnabled() 가 false 면 아무것도 하지 않아요(설정 · 테마 꺼짐). 반환값 = 떼기.
 * load() 는 사전 모듈을 돌려줘요(시험용으로 바꿀 수 있어요).
 */
export function startLongpressHelp({ isEnabled = () => true, doc = document, host = window, load = () => import('./longpress-help-data.js'), open = openSheet } = {}) {
    let index = null, loading = null, gesture = null, guardUntil = 0, hover = null;
    const ensure = () => loading ||= Promise.resolve().then(load).then(module => (index = indexHelp(module.HELP)), error => { loading = null; throw error; });
    const block = event => { event.preventDefault(); event.stopImmediatePropagation(); };
    const clear = g => { if (!g) return; host.clearTimeout(g.timer); host.clearTimeout(g.pre); };
    const cancel = () => { if (gesture && !gesture.shown) { clear(gesture); gesture = null; } };
    const show = (g, found) => {
        clear(g);
        g.shown = true;
        guardUntil = Date.now() + CLICK_GUARD_MS;
        if (g.touch) { try { host.navigator?.vibrate?.(12); } catch { /* 진동이 없는 기기 */ } }
        open(helpFor(found, index, host));
    };
    const fire = async g => {
        if (gesture !== g) return;
        try { await ensure(); } catch (error) { console.warn('[Blue Lemonade] 길게 누르기 설명 사전', error); return; }
        if (gesture !== g || g.shown || !g.target.isConnected) return; // 사전을 읽는 사이 손을 뗐으면 원래 누름 그대로
        const found = findHelp(g.target, index);
        if (found) show(g, found);
    };
    function down(event) {
        guardUntil = 0; // 새 누름: 앞 길게 누르기의 click 은 이미 왔거나 오지 않아요
        if (gesture) { clear(gesture); gesture = null; }
        if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const target = event.target;
        if (!(target instanceof host.Element) || !isEnabled()) return;
        if (target.closest(SKIP) || target.closest(TYPING) || (event.pointerType === 'mouse' && target.closest('select'))) return;
        const g = { target, x: event.clientX, y: event.clientY, id: event.pointerId, touch: event.pointerType !== 'mouse', shown: false };
        if (!index) g.pre = host.setTimeout(() => { ensure().catch(() => {}); }, PREFETCH_MS);
        g.timer = host.setTimeout(() => { void fire(g); }, HOLD_MS);
        gesture = g;
    }
    function move(event) {
        const g = gesture;
        if (g && !g.shown && event.pointerId === g.id && Math.hypot(event.clientX - g.x, event.clientY - g.y) > MOVE_PX) cancel();
    }
    function up(event) {
        const g = gesture;
        if (!g || event.pointerId !== g.id) return;
        if (g.shown) block(event);
        clear(g);
        gesture = null;
    }
    // 폰은 길게 누르면 타이머보다 먼저 길게 누르기 메뉴 신호(contextmenu)를 보내기도 해요 — 사전이 있으면 그때 바로 띄워요. 마우스 오른쪽 클릭은 그대로
    function menu(event) {
        const g = gesture;
        if (g?.shown || (guardUntil && Date.now() < guardUntil)) { event.preventDefault(); return; }
        if (!g || !g.touch || !index) return;
        const found = findHelp(g.target, index);
        if (!found) return;
        event.preventDefault();
        show(g, found);
    }
    function click(event) {
        // 키보드로 누른 click(detail 0)은 그대로. 손을 뗄 때의 click 은 설명 창 위로 떨어지기도 해요(폰: 창이 뜬 뒤 pointerup 없이 click 이 창으로) —
        // 새 누름(pointerdown) 없이 온 첫 click 이니 어디로 오든 막아요. 그러지 않으면 창의 「바깥 누르면 닫기」가 방금 연 창을 바로 닫아요
        if (!guardUntil || event.detail === 0) return;
        const fresh = Date.now() < guardUntil;
        guardUntil = 0;
        if (fresh) block(event);
    }
    // PC: 마우스를 올려 두면(0.6초) 원래 title 풍선 글을 설명으로 바꿔 보여 줘요. 내려가면 원래 title 로 돌려요
    function leave() {
        const h = hover;
        hover = null;
        if (!h) return;
        host.clearTimeout(h.timer);
        if (h.set && h.el.getAttribute('title') === h.set) { if (h.had) h.el.setAttribute('title', h.old); else h.el.removeAttribute('title'); }
    }
    function over(event) {
        if (event.pointerType !== 'mouse') return;
        const el = event.target;
        if (el === hover?.el) return;
        leave();
        if (!(el instanceof host.Element) || !isEnabled() || el.closest(HOVER_SKIP) || el.closest(TYPING)) return;
        const h = { el };
        h.timer = host.setTimeout(async () => {
            try { await ensure(); } catch { return; }
            if (hover !== h || !el.isConnected) return;
            const found = findHelp(el, index);
            if (!found || found.node.matches('.extraMesButtonsHint')) return;
            h.had = el.hasAttribute('title');
            h.old = el.getAttribute('title');
            h.set = `${found.entry.title}\n${found.entry.text}`;
            el.setAttribute('title', h.set);
        }, HOVER_MS);
        hover = h;
    }
    function out(event) { if (hover && event.target === hover.el) leave(); }
    const listeners = [
        [doc, 'pointerdown', down, { capture: true, passive: true }], [doc, 'pointermove', move, { capture: true, passive: true }],
        [host, 'pointerup', up, true], [doc, 'pointercancel', cancel, { capture: true, passive: true }], [doc, 'scroll', cancel, { capture: true, passive: true }],
        [host, 'click', click, true], [host, 'contextmenu', menu, true], [doc, 'pointerover', over, { capture: true, passive: true }], [doc, 'pointerout', out, { capture: true, passive: true }],
    ];
    for (const [where, type, fn, options] of listeners) where.addEventListener(type, fn, options);
    host.addEventListener('blur', cancel);
    return () => {
        for (const [where, type, fn, options] of listeners) where.removeEventListener(type, fn, options);
        host.removeEventListener('blur', cancel);
        clear(gesture); gesture = null; leave();
    };
}
