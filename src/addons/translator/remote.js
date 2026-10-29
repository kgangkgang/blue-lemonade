// 번역 리모컨 (8.2.7 뒤 · translate-remote) — 한 단추로 자동 번역 켬/끔 · 번역 · 번역 수정 · 번역 삭제와 부가 기능.
// 아이디어 · 원작: 커뮤니티에 공유된 태번 헬퍼(JS-Slash-Runner) 스크립트 「✨️번역 리모컨」. 원작자의 허락으로 고쳐 번역 애드온 안에 넣었어요
//   (THIRD-PARTY-NOTICES.md · README.md). 고마워요 💙
// 원작에서 그대로 살린 것: 짧게 누르기 = 대표 기능, 길게 누르기 · 우클릭 = 나머지 기능 + 빠른 설정, 플로팅 단추 끌어 옮기기 · 크기 · 위치(기기마다),
//   「화면에서 가장 많이 보이는 메시지」가 대상, 번역 수정은 읽던 자리에서 열고 다시 누르면 저장 · 저장 뒤 고치던 자리로(앞뒤 글 조각 앵커).
// 애드온 안으로 옮기며 바꾼 것:
//   · 메시지의 숨은 단추를 누르는 대신 번역 애드온 함수를 바로 불러요(host.run) — 메시지 아이콘을 숨겨도 · 판이 달라도 같아요.
//   · 1초마다 도는 감시 대신 일이 생길 때만 다시 그려요(자동 번역 바꿈 · 수정 창 열고 닫기 · 채팅 바꿈 · 창 크기).
//   · 보이는 메시지는 채팅 칸 안에서만 재고, 아래에서 위로 훑다 화면 위로 벗어나면 멈춰요(긴 채팅에서도 몇 개만 잼).
//   · 길게 누르기 메뉴는 테마의 ✦ 메뉴와 같은 꼴(아이콘 + 글자 줄), 원작 스크립트가 돌고 있으면 이쪽은 쉬어요(두 단추가 겹치지 않게).
//   · 원작이 이 기기에 남긴 위치 · 크기 · 대표 기능을 처음 한 번 옮겨 와요.
// 유료 번역 요청: 번역 · 다시 번역은 누른 그 메시지 하나만, 채팅 전체 번역은 확인 창(남은 메시지 수)을 거쳐요. 몰래 늘어나는 요청은 없어요.

export const ACTIONS = Object.freeze({
    auto: { icon: 'fa-language', label: '자동 번역' },
    translate: { icon: 'fa-brain', label: '번역' },
    retranslate: { icon: 'fa-rotate', label: '다시 번역' },
    edit: { icon: 'fa-pen-to-square', label: '번역 수정' },
    delete: { icon: 'fa-trash', label: '번역 삭제' },
    toggleAll: { icon: 'fa-magnifying-glass', label: '모두 원문/번역' },
    translateAll: { icon: 'fa-layer-group', label: '채팅 전체 번역' },
});
export const ORDER = Object.freeze(['auto', 'translate', 'retranslate', 'edit', 'delete', 'toggleAll', 'translateAll']);
const MODE_LABEL = { ai: 'AI 메시지', all: '전체', user: '내 메시지' };

export const SETTINGS_DEFAULTS = Object.freeze({ enabled: false, main: 'translate', hidden: Object.freeze([]), lastAuto: 'ai' });
export const LAYOUT_KEY = 'llmt.remote.layout.v1';
export const SCRIPT_KEY = 'tcb.translate-combo.v1';   // 원작 스크립트가 기기마다 남긴 설정 (위치 · 크기 · 대표 기능)
export const LAYOUT_DEFAULTS = Object.freeze({ place: 'left', size: 44, x: 0.96, y: 0.62 });
export const PLACES = Object.freeze(['float', 'left', 'right']);
export const SIZE_MIN = 20, SIZE_MAX = 120;
export const LONG_PRESS_MS = 450, DRAG_PX = 8, BOOT_GRACE_MS = 20000;
export const BUTTON_ID = 'llmt_remote_button', MENU_ID = 'llmt_remote_menu';
// 원작 스크립트: 태번 헬퍼 스크립트 id · 이름, 돌 때 만드는 요소 id
export const ORIGINAL = Object.freeze({ scriptId: 'a336bdf3-2935-472d-83dc-241850785c76', name: /번역\s*리모컨/, dom: ['tcb-btn', 'tcb-style', 'tcb-pop'] });
const DOCK = { left: '#leftSendForm', right: '#rightSendForm' };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);

/** 저장된 리모컨 설정(번역 애드온 설정 remote)을 제자리에서 고쳐 돌려줘요 — 잘못된 값은 기본값 */
export function normalizeSettings(owner, key = 'remote') {
    const raw = owner[key] && typeof owner[key] === 'object' && !Array.isArray(owner[key]) ? owner[key] : (owner[key] = {});
    raw.enabled = raw.enabled === true;
    if (!ORDER.includes(raw.main)) raw.main = SETTINGS_DEFAULTS.main;
    raw.hidden = Array.isArray(raw.hidden) ? [...new Set(raw.hidden.filter(a => ORDER.includes(a)))] : [];
    if (!['ai', 'all', 'user'].includes(raw.lastAuto)) raw.lastAuto = SETTINGS_DEFAULTS.lastAuto;
    return raw;
}

/** 기기마다의 자리 · 크기 (원작 스크립트의 cfg 와 같은 이름) */
export function sanitizeLayout(raw) {
    const c = raw && typeof raw === 'object' ? raw : {};
    return {
        place: PLACES.includes(c.place) ? c.place : LAYOUT_DEFAULTS.place,
        size: clamp(num(c.size, LAYOUT_DEFAULTS.size) || LAYOUT_DEFAULTS.size, SIZE_MIN, SIZE_MAX),
        x: clamp(num(c.x, LAYOUT_DEFAULTS.x), 0, 1),
        y: clamp(num(c.y, LAYOUT_DEFAULTS.y), 0, 1),
    };
}

/** 이 기기의 자리를 읽어요. 처음이면 원작 스크립트가 남긴 설정을 옮겨 와요 → { layout, migrated: { main } | null } */
export function readLayout(storage) {
    const parse = key => { try { const v = JSON.parse(storage?.getItem?.(key) ?? 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } };
    const own = parse(LAYOUT_KEY);
    if (own) return { layout: sanitizeLayout(own), migrated: null };
    const script = parse(SCRIPT_KEY);
    if (!script) return { layout: sanitizeLayout(null), migrated: null };
    const layout = sanitizeLayout(script);
    try { storage?.setItem?.(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* 저장소가 막혀도 이번엔 그대로 씀 */ }
    return { layout, migrated: { main: ORDER.includes(script.main) ? script.main : null } };
}

/**
 * 원작 스크립트가 있나: 'running'(지금 돌며 단추를 만들었음) · 'listed'(태번 헬퍼 전역 스크립트 목록에 켜져 있음) · ''
 * 판정은 요소 id 가 먼저 — 캐릭터 · 프리셋 스크립트로 넣어도, 이름을 바꿔도 돌고 있으면 보여요.
 */
export function detectOriginal(doc, thSettings) {
    if (ORIGINAL.dom.some(id => doc?.getElementById?.(id))) return 'running';
    const script = thSettings?.script;
    if (!script || script.enabled?.global === false || !Array.isArray(script.scripts)) return '';
    const hit = s => s && s.enabled === true && (s.id === ORIGINAL.scriptId || ORIGINAL.name.test(String(s.name || '')));
    for (const node of script.scripts) {
        if (node?.type === 'folder') { if (node.enabled !== false && Array.isArray(node.scripts) && node.scripts.some(hit)) return 'listed'; }
        else if (hit(node)) return 'listed';
    }
    return '';
}

/**
 * 화면에서 가장 많이 보이는 메시지 (원작과 같은 기준: 보이는 세로 길이가 가장 긴 것).
 * 채팅 칸(#chat)과 창이 겹치는 범위만 보고, 아래에서 위로 훑다 화면 위로 벗어난 메시지를 만나면 멈춰요 — 위쪽 수백 개를 재지 않아요.
 */
export function pickVisibleMessage(doc, win) {
    const chat = doc.getElementById('chat');
    const list = chat ? chat.querySelectorAll('.mes') : [];
    if (!list.length) return null;
    const box = chat.getBoundingClientRect();
    let top = Math.max(box.top, 0), bottom = Math.min(box.bottom, win.innerHeight || box.bottom);
    if (!(bottom > top)) { top = 0; bottom = win.innerHeight || 0; }
    let best = null, bestSeen = 0;
    for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i].getBoundingClientRect();
        if (!r.height) continue;   // 숨긴 메시지(크기 0) — 멈추는 기준으로 쓰지 않아요
        if (r.bottom <= top) break;
        const seen = Math.min(r.bottom, bottom) - Math.max(r.top, top);
        if (seen > bestSeen) { bestSeen = seen; best = list[i]; }
    }
    return best || list[list.length - 1];
}

// ── 읽던 자리 (원작의 앵커 방식) ──
export function makeAnchor(text, offset) {
    return { after: text.slice(offset, offset + 40), before: text.slice(Math.max(0, offset - 40), offset), ratio: text.length ? offset / text.length : 0 };
}
/** 앵커 글 조각을 새 글에서 찾아 위치 (못 찾으면 비율) */
export function locateAnchor(text, anchor) {
    if (!anchor) return null;
    const MIN = 6;
    const shrink = (snippet, fromEnd) => {
        if (!snippet) return null;
        for (let len = snippet.length; len >= MIN; len -= 2) {
            const piece = fromEnd ? snippet.slice(snippet.length - len) : snippet.slice(0, len);
            const i = text.indexOf(piece);
            if (i !== -1) return fromEnd ? i + piece.length : i;
        }
        return null;
    };
    return shrink(anchor.after, false) ?? shrink(anchor.before, true) ?? Math.round((anchor.ratio || 0) * text.length);
}

/** @param {object} host index.js 가 주는 연결 (문서 · 설정 · 번역 함수) */
export function createRemote(host) {
    const { doc, win } = host;
    const now = host.now || (() => Date.now());
    const raf = fn => (win.requestAnimationFrame ? win.requestAnimationFrame(fn) : win.setTimeout(fn, 16));
    const settings = () => host.settings();
    const toast = host.toast || {};
    const say = (kind, text, opts) => { try { toast[kind]?.(text, '', { timeOut: 1600, ...opts }); } catch { /* 알림 없음 */ } };
    const read = readLayout(host.storage);
    let layout = read.layout;
    if (read.migrated?.main && settings().main === SETTINGS_DEFAULTS.main) { settings().main = read.migrated.main; host.save?.(); }
    if (read.migrated) say('info', '번역 리모컨 스크립트에서 쓰던 자리 · 크기 · 대표 기능을 옮겨 왔어요.', { timeOut: 3000 });
    const saveLayout = () => { try { host.storage?.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* 막힘 */ } };
    const bootUntil = now() + (host.bootGraceMs ?? BOOT_GRACE_MS);

    let btn = null, icon = null, menu = null, showSet = false, running = 0, resting = '', stopped = true;
    let down = null, lpTimer = 0, graceTimer = 0, headWatch = null, frame = 0, lastCursor = null;

    // ── 쉬기 (원작 스크립트가 돌고 있으면) ──
    function restState() {
        const found = detectOriginal(doc, host.thSettings?.());
        if (found === 'running') return 'running';
        if (found === 'listed' && now() < bootUntil) return 'starting';   // 시작 직후엔 원작이 아직 단추를 못 만들었을 수 있어요 — 잠깐 기다려요
        return '';
    }
    function watchOriginal() {
        if (headWatch || !win.MutationObserver || !doc.head) return;
        // 원작은 <head> 에 자기 style(#tcb-style)을 넣고 끌 때 뺀다 — head 의 직계 자식만 봐요(드물게 바뀜)
        headWatch = new win.MutationObserver(() => { if (!stopped) sync(); });
        headWatch.observe(doc.head, { childList: true });
    }

    // ── 단추 ──
    const openEditor = () => doc.querySelector('#chat .translation_edit_textarea');
    function build() {
        btn = doc.createElement('div');
        btn.id = BUTTON_ID;
        btn.className = 'interactable';
        btn.tabIndex = 0;
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-haspopup', 'menu');
        icon = doc.createElement('i');
        icon.className = 'fa-solid';
        icon.setAttribute('aria-hidden', 'true');
        btn.append(icon);
        btn.addEventListener('pointerdown', onDown);
        btn.addEventListener('pointermove', onMove);
        btn.addEventListener('pointerup', onUp);
        btn.addEventListener('pointercancel', onUp);
        btn.addEventListener('pointerleave', () => { if (down && !isFloat()) { win.clearTimeout(lpTimer); down = null; } });   // 입력줄 단추에서 손가락 · 마우스가 벗어나면 누름 취소
        btn.addEventListener('mousedown', e => e.preventDefault());   // 입력칸 초점 · 폰 키보드를 그대로 (원작과 같게)
        btn.addEventListener('contextmenu', e => { e.preventDefault(); if (down) down.long = true; openMenu(); });
        btn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(settings().main); }
            else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); openMenu({ focus: true }); }   // 키보드로 메뉴 열기
        });
    }
    const isFloat = () => btn?.classList.contains('llmt-remote-float');
    function applyFloatPos() {
        if (!btn || !isFloat()) return;
        const s = layout.size;
        btn.style.setProperty('--llmt-remote-size', `${s}px`);
        btn.style.left = `${Math.round(layout.x * Math.max(0, win.innerWidth - s))}px`;
        btn.style.top = `${Math.round(layout.y * Math.max(0, win.innerHeight - s))}px`;
    }
    function mount() {
        if (!btn) build();
        const host2 = layout.place === 'float' ? null : doc.querySelector(DOCK[layout.place]);
        if (host2) {
            btn.classList.remove('llmt-remote-float', 'is-dragging');
            for (const p of ['left', 'top', '--llmt-remote-size']) btn.style.removeProperty(p);
            if (btn.parentElement !== host2) host2.append(btn);
        } else {
            btn.classList.add('llmt-remote-float');
            if (btn.parentElement !== doc.body) doc.body.append(btn);
            applyFloatPos();
        }
    }
    function unmount() {
        closeMenu();
        btn?.remove();
    }

    function batch() { try { return host.batch?.() || null; } catch { return null; } }
    function autoOn() { const m = host.autoMode?.(); return !!m && m !== 'none'; }
    function render() {
        if (!btn) return;
        const main = settings().main, a = ACTIONS[main];
        let glyph = a.icon, label = a.label, state = '';
        const b = batch();
        if (main === 'auto') { const m = host.autoMode?.(); state = autoOn() ? ` · 켜짐(${MODE_LABEL[m] || m})` : ' · 꺼짐'; }
        if (main === 'edit' && openEditor()) { glyph = 'fa-check'; label = '수정한 번역 저장'; }
        if (main === 'translateAll' && b) { glyph = 'fa-circle-stop'; label = `전체 번역 멈추기 ${b.done}/${b.total}`; }
        // 같은 값이면 쓰지 않아요 — 다시 그리기 신호가 와도 스타일 계산을 새로 부르지 않게
        const put = (el, k, v) => { if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); } else if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
        put(icon, 'class', `fa-solid ${glyph}`);
        if (btn.classList.contains('is-on') !== (main === 'auto' && autoOn())) btn.classList.toggle('is-on');
        if (btn.classList.contains('is-busy') !== (running > 0 || !!b)) btn.classList.toggle('is-busy');
        put(btn, 'aria-pressed', main === 'auto' ? String(autoOn()) : null);
        put(btn, 'aria-label', `번역 리모컨: ${label}${state}`);
        put(btn, 'title', `${label}${state}\n길게 누르거나 우클릭하면 다른 기능 · 설정`);
        if (menu && !menu.hidden) fillMenu();
    }

    // ── 누르기: 짧게 = 대표 기능 · 끌기 = 옮기기(플로팅) · 길게 / 우클릭 = 메뉴 ──
    function onDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const r = btn.getBoundingClientRect();
        down = { id: e.pointerId, sx: e.clientX, sy: e.clientY, bx: r.left, by: r.top, moved: false, long: false, closing: !!(menu && !menu.hidden) };
        win.clearTimeout(lpTimer);
        lpTimer = win.setTimeout(() => {
            if (!down || down.moved || down.closing) return;
            down.long = true;
            try { win.navigator?.vibrate?.(20); } catch { /* 진동 없음 */ }
            openMenu();
        }, LONG_PRESS_MS);
        if (isFloat()) { try { btn.setPointerCapture?.(e.pointerId); } catch { /* 지원 안 함 */ } }
    }
    function onMove(e) {
        if (!down || e.pointerId !== down.id || !isFloat()) return;
        const dx = e.clientX - down.sx, dy = e.clientY - down.sy;
        if (!down.moved) {
            if (Math.hypot(dx, dy) < DRAG_PX) return;
            down.moved = true;
            win.clearTimeout(lpTimer);
            btn.classList.add('is-dragging');
            closeMenu();
        }
        const s = layout.size;
        btn.style.left = `${clamp(down.bx + dx, 0, Math.max(0, win.innerWidth - s))}px`;
        btn.style.top = `${clamp(down.by + dy, 0, Math.max(0, win.innerHeight - s))}px`;
    }
    function onUp(e) {
        if (!down || e.pointerId !== down.id) return;
        win.clearTimeout(lpTimer);
        const d = down;
        down = null;
        btn.classList.remove('is-dragging');
        if (e.type === 'pointercancel') return;
        if (d.moved) {
            const r = btn.getBoundingClientRect(), s = layout.size;
            const spanX = win.innerWidth - s, spanY = win.innerHeight - s;
            layout.x = spanX > 0 ? clamp(r.left / spanX, 0, 1) : 0.5;
            layout.y = spanY > 0 ? clamp(r.top / spanY, 0, 1) : 0.5;
            saveLayout();
        } else if (d.closing) closeMenu();
        else if (!d.long) run(settings().main);
    }

    // ── 기능 ──
    const warn = text => say('warning', text, { timeOut: 2200 });
    async function run(action) {
        if (!ACTIONS[action]) return;
        running++;
        render();
        try {
            if (action === 'auto') toggleAuto();
            else if (action === 'translateAll') await host.run.translateAll();
            else if (action === 'toggleAll') await host.run.toggleAll();
            else if (action === 'edit') await editAction();
            else await onMessage(action);
        } catch (error) {
            console.warn('[LLM Translator] 번역 리모컨', action, error);
            say('error', error?.message || '번역 리모컨에서 오류가 났어요.', { timeOut: 4000 });
        } finally {
            running--;
            render();
        }
    }
    function toggleAuto() {
        const s = settings(), mode = host.autoMode?.();
        if (mode == null) { warn('번역 애드온 설정을 아직 못 읽었어요.'); return; }
        // 원작은 AI ↔ 끔만 오갔어요 — 전체 · 내 메시지로 쓰던 사람은 끌 때 그 값을 기억해 두었다 다시 켤 때 되살려요
        const next = mode === 'none' ? s.lastAuto : 'none';
        if (mode !== 'none' && s.lastAuto !== mode) { s.lastAuto = mode; host.save?.(); }
        host.setAutoMode(next);
        say('info', next === 'none' ? '자동 번역 꺼짐' : `자동 번역 켜짐 · ${MODE_LABEL[next] || next}`, { timeOut: 1300 });
    }
    function target() {
        const mes = pickVisibleMessage(doc, win);
        const id = mes?.getAttribute('mesid');
        if (!mes || !/^\d+$/.test(String(id ?? ''))) { warn('채팅 메시지가 없어요.'); return null; }
        return { mes, id: String(id) };
    }
    async function onMessage(action) {
        const t = target();
        if (!t) return;
        if (action === 'translate') return host.run.translate(t.id);
        if (action === 'retranslate') {
            if (host.busy?.(t.id)) { say('info', `#${t.id} 메시지는 지금 번역하는 중이에요.`); return; }
            if (host.editedByHand?.(t.id) && !await host.ask(`#${t.id} 메시지의 번역은 손으로 고친 거예요. 새로 번역하면 고친 내용이 바뀌어요.\n다시 번역할까요?`, { ok: '다시 번역', cancel: '취소' })) return;
            return host.run.retranslate(t.id);
        }
        if (action === 'delete') {
            if (!host.hasTranslation?.(t.id)) { say('info', `#${t.id} 메시지에는 지울 번역문이 없어요.`); return; }
            if (!await host.ask(`보고 있는 메시지(#${t.id})의 번역문을 지울까요?`, { ok: '지우기', cancel: '취소', danger: true })) return;
            return host.run.delete(t.id);
        }
    }

    // 번역 수정: 첫 누름 = 읽던 자리에서 열기, 수정 창이 열려 있으면 = 저장하고 고치던 자리로 (원작 흐름)
    async function editAction() {
        const ta = openEditor();
        if (ta) { await saveEdit(ta); return; }
        const t = target();
        if (!t) return;
        if (!host.hasTranslation?.(t.id)) { say('info', `#${t.id} 메시지에는 아직 번역문이 없어요.`); return; }
        const textEl = t.mes.querySelector('.mes_text');
        const anchor = textEl ? readingAnchor(textEl) : null;   // 수정 창이 글을 가리기 전에
        await host.run.edit(t.id);
        const area = await waitFor(() => doc.querySelector(`#chat .mes[mesid="${t.id}"] .translation_edit_textarea`), 3000);
        if (!area) return;   // 번역 애드온이 이유를 알렸어요(번역문 없음 등)
        if (anchor) scrollTextareaTo(area, locateAnchor(area.value, anchor));
        trackCursor(area);
        render();
    }
    async function saveEdit(ta) {
        const mes = ta.closest('.mes');
        const done = mes?.querySelector('.translation_edit_done');
        if (!done) return;
        const id = mes.getAttribute('mesid');
        const idx = lastCursor?.ta === ta ? lastCursor.idx : (ta.selectionStart ?? ta.value.length);
        const anchor = makeAnchor(ta.value, idx);
        const sc = mes.closest('#chat') || doc.scrollingElement;
        const lockedTop = sc ? sc.scrollTop : null;
        let holding = !!sc;
        const hold = () => { if (!holding) return; sc.scrollTop = lockedTop; raf(hold); };   // 수정 창이 닫히며 높이가 바뀌는 동안 화면이 튀지 않게
        if (holding) hold();
        try {
            done.click();
            const textEl = await waitFor(() => {
                const m = doc.querySelector(`#chat .mes[mesid="${id}"]`);
                const el = m?.querySelector('.mes_text');
                return el && el.offsetParent !== null && !m.querySelector('.translation_edit_textarea') ? el : null;
            }, 2000);
            if (textEl) {
                await waitForViewportStable();
                holding = false;
                const i = locateAnchor(textEl.textContent, anchor);
                if (i != null) scrollRenderedTo(textEl, i);
            }
        } finally { holding = false; }
    }
    function readingAnchor(el) {   // 화면 세로 가운데의 글 위치
        const rect = el.getBoundingClientRect();
        const y = Math.max(rect.top + 1, Math.min(rect.bottom - 1, win.innerHeight / 2));
        const x = rect.left + rect.width / 2;
        let range = null;
        try {
            if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
            else if (doc.caretPositionFromPoint) {
                const pos = doc.caretPositionFromPoint(x, y);
                if (pos) { range = doc.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
            }
            if (!range || !el.contains(range.startContainer)) return null;
            const pre = doc.createRange();
            pre.selectNodeContents(el);
            pre.setEnd(range.startContainer, range.startOffset);
            return makeAnchor(el.textContent, pre.toString().length);
        } catch { return null; }
    }
    function scrollTextareaTo(ta, idx) {
        if (idx == null) return;
        idx = clamp(idx, 0, ta.value.length);
        const full = ta.value;
        try {
            ta.focus({ preventScroll: true });
            ta.value = full.slice(0, idx);
            ta.scrollTop = ta.scrollHeight;
            ta.value = full;
            ta.setSelectionRange(idx, idx);
            ta.scrollIntoView?.({ block: 'center' });
        } catch { ta.value = full; }
    }
    function scrollRenderedTo(el, offset) {
        try {
            const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
            let node, count = 0, hit = null, local = 0;
            while ((node = walker.nextNode())) {
                const len = node.textContent.length;
                if (count + len >= offset) { hit = node; local = clamp(offset - count, 0, len); break; }
                count += len;
            }
            if (!hit) return;
            const range = doc.createRange();
            range.setStart(hit, local);
            range.collapse(true);
            const marker = doc.createElement('span');
            marker.style.cssText = 'display:inline-block;width:0;height:0;';
            try { range.insertNode(marker); marker.scrollIntoView({ block: 'center' }); } finally { marker.remove(); }
        } catch { /* 자리 맞추기만 못 해요 */ }
    }
    function trackCursor(ta) {
        const update = () => { lastCursor = { ta, idx: ta.selectionStart }; };
        update();
        for (const type of ['keyup', 'click', 'touchend', 'input', 'select']) ta.addEventListener(type, update);
    }
    function waitFor(fn, ms) {
        return new Promise(resolve => {
            const start = now();
            const check = () => { const r = fn(); if (r) return resolve(r); if (now() - start > ms) return resolve(null); raf(check); };
            check();
        });
    }
    function waitForViewportStable(maxMs = 600) {   // 폰 키보드가 다 닫힐 때까지
        return new Promise(resolve => {
            const vv = win.visualViewport;
            if (!vv) { win.setTimeout(resolve, 0); return; }
            let last = vv.height, stable = 0;
            const start = now();
            const check = () => {
                if (vv.height === last) stable++; else { stable = 0; last = vv.height; }
                if (stable >= 3 || now() - start > maxMs) return resolve();
                raf(check);
            };
            check();
        });
    }

    // ── 길게 누르기 메뉴 (✦ 메뉴와 같은 꼴: 아이콘 + 글자 줄, 바깥을 누르면 닫힘) ──
    function el(tag, cls, text) { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function item(action, glyph, label, extra) {
        const b = el('button', 'llmt-remote-item');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.dataset.action = action;
        const i = el('i', `fa-solid ${glyph}`);
        i.setAttribute('aria-hidden', 'true');
        b.append(i, el('span', '', label));
        if (extra) b.append(extra);
        return b;
    }
    function fillMenu() {
        const s = settings(), b = batch();
        const list = menu.querySelector('.llmt-remote-items');
        list.textContent = '';
        for (const a of ORDER) {
            if (a === s.main || s.hidden.includes(a)) continue;
            const def = ACTIONS[a];
            if (a === 'auto') {
                const row = item(a, def.icon, def.label, el('small', 'llmt-remote-state', autoOn() ? '켬' : '끔'));
                row.classList.toggle('is-on', autoOn());
                row.setAttribute('aria-checked', String(autoOn()));
                row.setAttribute('role', 'menuitemcheckbox');
                list.append(row);
            } else if (a === 'translateAll' && b) list.append(item(a, 'fa-circle-stop', '전체 번역 멈추기', el('small', 'llmt-remote-state', `${b.done}/${b.total}`)));
            else if (a === 'edit' && openEditor()) list.append(item(a, 'fa-check', '수정한 번역 저장'));
            else list.append(item(a, def.icon, def.label));
        }
        const gear = item('settings', 'fa-gear', '설정');
        gear.setAttribute('aria-expanded', String(showSet));
        list.append(gear);
        const set = menu.querySelector('.llmt-remote-set');
        set.hidden = !showSet;
        if (showSet) fillSettings(set);
    }
    function fillSettings(set) {
        const s = settings(), floating = layout.place === 'float';
        set.textContent = '';
        set.append(el('div', 'llmt-remote-lab', '짧게 누르면'));
        const mains = el('div', 'llmt-remote-grid');
        mains.setAttribute('role', 'group');
        mains.setAttribute('aria-label', '짧게 누를 때 할 일');
        for (const a of ORDER) {
            const c = el('button', 'llmt-remote-chip', ACTIONS[a].label);
            c.type = 'button';
            c.dataset.main = a;
            c.setAttribute('aria-pressed', String(a === s.main));
            mains.append(c);
        }
        set.append(mains, el('div', 'llmt-remote-lab', '자리'));
        const seg = el('div', 'llmt-remote-seg');
        seg.setAttribute('role', 'group');
        seg.setAttribute('aria-label', '단추 자리');
        for (const [place, label, title] of [['float', '플로팅', '화면 위에 떠 있게'], ['left', '왼쪽', '입력칸 왼쪽 단추 줄'], ['right', '오른쪽', '입력칸 오른쪽 단추 줄']]) {
            const c = el('button', 'llmt-remote-chip', label);
            c.type = 'button';
            c.dataset.place = place;
            c.title = title;
            c.setAttribute('aria-pressed', String(place === layout.place));
            seg.append(c);
        }
        set.append(seg);
        if (floating) {
            const head = el('label', 'llmt-remote-size');
            const out = el('output', '', `${layout.size}px`);
            head.append(el('span', 'llmt-remote-lab', '크기'), out);
            const range = el('input');
            range.type = 'range';
            range.min = String(SIZE_MIN);
            range.max = String(SIZE_MAX);
            range.step = '2';
            range.value = String(layout.size);
            range.setAttribute('aria-label', '단추 크기');
            range.addEventListener('input', () => {
                layout.size = clamp(Number(range.value) || LAYOUT_DEFAULTS.size, SIZE_MIN, SIZE_MAX);
                out.textContent = `${layout.size}px`;
                saveLayout(); applyFloatPos(); placeMenu();
            });
            head.append(range);
            set.append(head, el('small', 'llmt-remote-hint', '단추를 끌어서 옮길 수 있어요.'));
        }
        const reset = el('button', 'llmt-remote-chip llmt-remote-reset', '위치 · 크기 처음대로');
        reset.type = 'button';
        reset.dataset.reset = '1';
        set.append(reset);
    }
    function buildMenu() {
        menu = el('div', 'llmt-remote-menu');
        menu.id = MENU_ID;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', '번역 리모컨');
        menu.hidden = true;
        menu.append(el('div', 'llmt-remote-items'), el('div', 'llmt-remote-set'));
        menu.addEventListener('click', onMenuClick);
        menu.addEventListener('keydown', onMenuKey);
        doc.body.append(menu);
    }
    function onMenuClick(e) {
        const t = e.target?.closest?.('button');
        if (!t || !menu.contains(t)) return;
        const s = settings();
        if (t.dataset.action === 'settings') { showSet = !showSet; fillMenu(); placeMenu(); return; }
        if (t.dataset.action) { const a = t.dataset.action; if (a !== 'auto') closeMenu({ focus: false }); run(a); return; }
        if (t.dataset.main) { s.main = t.dataset.main; host.save?.(); host.changed?.(); render(); placeMenu(); return; }
        if (t.dataset.place) { setPlace(t.dataset.place); return; }
        if (t.dataset.reset) { Object.assign(layout, { size: LAYOUT_DEFAULTS.size, x: LAYOUT_DEFAULTS.x, y: LAYOUT_DEFAULTS.y }); saveLayout(); applyFloatPos(); fillMenu(); placeMenu(); }
    }
    function onMenuKey(e) {
        const items = [...menu.querySelectorAll('button')];
        const i = items.indexOf(doc.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); closeMenu({ focus: true }); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
            next?.focus();
        }
    }
    function placeMenu() {
        if (!menu || menu.hidden || !btn) return;
        const r = btn.getBoundingClientRect(), pw = menu.offsetWidth, ph = menu.offsetHeight, m = 8;
        const above = r.top - m - ph >= m, below = r.bottom + m + ph <= win.innerHeight - m;
        const top = above ? r.top - m - ph : below ? r.bottom + m : win.innerHeight - ph - m;   // 입력줄은 화면 아래 — 위가 먼저
        menu.style.top = `${clamp(top, m, Math.max(m, win.innerHeight - ph - m))}px`;
        menu.style.left = `${clamp(r.left + r.width / 2 - pw / 2, m, Math.max(m, win.innerWidth - pw - m))}px`;
    }
    const onOutside = e => { if (menu && !menu.contains(e.target) && !btn?.contains(e.target)) closeMenu(); };
    const onDocKey = e => { if (e.key === 'Escape' && menu && !menu.hidden) closeMenu({ focus: true }); };
    function openMenu({ focus = false } = {}) {
        if (!btn) return;
        if (menu && !menu.hidden) return;   // 터치 길게 누르기는 타이머와 contextmenu 가 둘 다 와요
        if (!menu) buildMenu();
        menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        render();
        fillMenu();
        placeMenu();
        doc.addEventListener('pointerdown', onOutside, true);
        doc.addEventListener('keydown', onDocKey, true);
        if (focus) menu.querySelector('button')?.focus();
    }
    function closeMenu({ focus = false } = {}) {
        if (menu && !menu.hidden) { menu.hidden = true; btn?.setAttribute('aria-expanded', 'false'); if (focus) btn?.focus(); }
        showSet = false;
        doc.removeEventListener('pointerdown', onOutside, true);
        doc.removeEventListener('keydown', onDocKey, true);
    }
    function setPlace(place) {
        if (!PLACES.includes(place)) return;
        layout.place = place;
        saveLayout();
        mount();
        render();
        if (menu && !menu.hidden) { fillMenu(); placeMenu(); }
    }

    // ── 다시 그리기 신호 ──
    const later = () => { if (frame) return; frame = raf(() => { frame = 0; render(); }); };
    const onEditClick = e => { if (e.target?.closest?.('.translation_edit_done, .translation_edit_cancel, .mes_edit_translation')) win.setTimeout(later, 0); };
    const onFocusIn = e => { if (e.target?.classList?.contains('translation_edit_textarea')) later(); };
    const onResize = () => { if (!btn) return; applyFloatPos(); placeMenu(); };
    function listen(on) {
        const m = on ? 'addEventListener' : 'removeEventListener';
        doc[m]('click', onEditClick, true);
        doc[m]('focusin', onFocusIn, true);
        doc[m]('llm-translator:batch', later);
        win[m]('resize', onResize);
    }

    /** 설정 · 원작 유무에 맞춰 붙이거나 떼요 (여러 번 불러도 같아요) */
    function sync() {
        const s = settings();
        win.clearTimeout(graceTimer);
        if (!s.enabled) { stop(); return; }
        if (stopped) { stopped = false; listen(true); }
        watchOriginal();
        const was = resting;
        resting = restState();
        if (resting === 'starting') graceTimer = win.setTimeout(sync, Math.max(0, bootUntil - now()) + 50);
        if (resting) unmount();
        else { mount(); render(); }
        if (was !== resting) host.onRest?.(resting);
    }
    function stop() {
        if (!stopped) listen(false);
        stopped = true;
        headWatch?.disconnect();
        headWatch = null;
        win.clearTimeout(lpTimer);
        win.clearTimeout(graceTimer);
        unmount();
        if (resting) { resting = ''; host.onRest?.(''); }
    }

    return {
        sync, stop, render, run, setPlace,
        openMenu, closeMenu,
        resting: () => resting,
        layout: () => ({ ...layout }),
        reset() { Object.assign(layout, { size: LAYOUT_DEFAULTS.size, x: LAYOUT_DEFAULTS.x, y: LAYOUT_DEFAULTS.y }); saveLayout(); applyFloatPos(); },
        element: () => btn,
        menuElement: () => menu,
    };
}
