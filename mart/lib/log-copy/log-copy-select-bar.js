// 원본 블루레몬에이드 테마의 src/log-copy-select-bar.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 크게 보기 고른 글 옆 막대가 테마 로그 복사와 같은 막대를 써요)
// 로그 복사 · 글꾸 마트 크게 보기 — 고른 글 바로 옆에 뜨는 작은 막대(11-12 사용자 「드래그하면 복사 · 붙여넣기 · 자르기처럼 뜨게」)
// 미리보기에서 글을 끌어 고르면(폰은 손가락 고르기 · PC 는 마우스 끌기 · 키보드 Shift+화살표) 고른 글 옆에 단추 몇 개를 띄워요.
//   폰: 고른 글 바로 아래(기기 복사 메뉴는 보통 위에 떠요 · 고르기 손잡이 높이만큼 더 내려요) — 아래가 모자라면 위(기기 메뉴 높이만큼 더 올려요),
//       둘 다 모자라면 보이는 화면(자판 위) 바닥에 붙여요. PC: 고른 글 바로 위(모자라면 아래).
//   고른 것이 풀리거나 · 밖을 누르거나 · Esc · 굴리면 사라져요(굴림이 멈추면 고른 것이 남아 있을 때 다시 떠요).
//   키보드: 막대가 떠 있을 때 Alt+↓ 로 막대 단추로 · ←→ 로 옮기고 Enter · Esc 는 글로 돌아가요.
// 미리보기가 iframe 이면(테마 시트) 그 문서의 고르기를 듣고 iframe 자리만큼 옮겨 바깥 창(host)에 그려요. 테마 시트와 마트(같은 문서)가 같이 써요.
// 막대는 단추만 그려요 — 무엇을 할지는 부르는 쪽이 buttons(range) 로 정해요(숨기기 · 풀기 · 굵게 · 기울임).

export const BAR_CLASS = 'bl-selbar';
const STYLE_ID = 'bl-selbar-style';
const CSS = `.${BAR_CLASS}{position:fixed;left:0;top:0;z-index:2147483000;display:flex;gap:2px;align-items:center;max-width:calc(100vw - 16px);padding:3px;border-radius:10px;background:var(--bl-selbar-bg,#23262d);color:var(--bl-selbar-fg,#f4f5f7);box-shadow:0 4px 16px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.08);font:600 14px/1.2 system-ui,-apple-system,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;letter-spacing:0;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}`
    + `.${BAR_CLASS}[hidden]{display:none!important}`
    + `.${BAR_CLASS}>button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 12px;border-radius:7px;white-space:nowrap;cursor:pointer;color:inherit;font:inherit;-webkit-tap-highlight-color:transparent}`
    + `.${BAR_CLASS}>button+button{box-shadow:-1px 0 0 rgba(255,255,255,.14)}`
    + `.${BAR_CLASS}>button:hover{background:rgba(255,255,255,.12)}`
    + `.${BAR_CLASS}>button:focus-visible{outline:2px solid var(--bl-selbar-ring,#7fb2ff);outline-offset:-2px}`
    + `.${BAR_CLASS}>button[data-main]{color:var(--bl-selbar-main,#9cc6ff)}`
    + `@media (pointer:coarse){.${BAR_CLASS}>button{min-height:42px;padding:0 14px;font-size:15px}}`;

/**
 * 막대 자리(순수 함수 · 뷰포트 좌표). sel = { top, bottom, left, right, x } (x: 막대 가운데로 둘 가로 자리),
 * bar = { width, height }, view = { left, top, width, height } (보이는 화면 — 폰은 자판을 뺀 visualViewport).
 * touch: 아래 → 위 → 바닥 차례 · 아니면 위 → 아래. 돌려주는 값 { left, top, side: 'below' | 'above' | 'dock' }
 */
export function placeBar(sel, bar, view, { touch = false, gap = 8, handle = 26, osMenu = 56 } = {}) {
    const vTop = view.top + gap, vBottom = view.top + view.height - gap;
    const below = sel.bottom + gap + (touch ? handle : 0);
    const above = sel.top - gap - bar.height - (touch ? osMenu : 0);
    let top, side;
    const fitsBelow = below + bar.height <= vBottom, fitsAbove = above >= vTop;
    if (touch ? fitsBelow : !fitsAbove && fitsBelow) { top = below; side = 'below'; }
    else if (fitsAbove) { top = above; side = 'above'; }
    else if (!touch && fitsBelow) { top = below; side = 'below'; }
    else { top = vBottom - bar.height; side = 'dock'; }   // 고른 글이 화면을 거의 다 덮어요 — 보이는 화면 바닥(자판 위)
    const x = Number.isFinite(sel.x) ? sel.x : (sel.left + sel.right) / 2;
    const maxLeft = view.left + view.width - gap - bar.width;
    const left = Math.max(view.left + gap, Math.min(maxLeft, x - bar.width / 2));
    return { left: Math.round(left), top: Math.round(top), side };
}

/** 고른 자리의 상자들(바깥 창 좌표) → placeBar 의 sel. 첫 줄 · 끝 줄을 따로 봐요(폰은 끝 줄 아래 · PC 는 첫 줄 위) */
export function selBox(rects, offset = { x: 0, y: 0 }, touch = false) {
    const list = [...rects].filter(r => r && (r.width > 0 || r.height > 0));
    if (!list.length) return null;
    const first = list[0], last = list[list.length - 1];
    const pick = touch ? last : first;
    return {
        top: first.top + offset.y,
        bottom: last.bottom + offset.y,
        left: Math.min(...list.map(r => r.left)) + offset.x,
        right: Math.max(...list.map(r => r.right)) + offset.x,
        x: (pick.left + pick.right) / 2 + offset.x,
    };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * 막대 하나를 host(테마 시트 dialog · 마트 크게 보기 dialog — 위 층에 같이 떠야 보여요) 안에 만들어요.
 * 돌려주는 것: { el, watch(doc, { frame, within, buttons }) → 그만 듣기, hide(), destroy() }
 *   buttons(range) → [{ id, label, title?, main?, run(range) }] — 빈 배열이면 막대를 안 띄워요
 *   within(node) → 이 마디 고르기만(빠지면 문서 전체) · caret(range) → 커서만 있어도 띄울지(숨긴 글을 누른 때)
 */
export function createSelectBar({ host, label = '고른 글' } = {}) {
    const top = host.ownerDocument ?? document, win = top.defaultView ?? globalThis;
    if (!top.getElementById(STYLE_ID)) {
        const style = top.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        top.head.append(style);
    }
    const el = top.createElement('div');
    el.className = BAR_CLASS;
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', label);
    el.hidden = true;
    host.append(el);

    let watched = null;   // { doc, frame, within, buttons, off }
    let shown = null;     // { range, list }
    let timer = 0, scrollTimer = 0, pressed = false, touchy = false;

    const hide = () => { clearTimeout(timer); el.hidden = true; shown = null; };
    const rangeOf = () => {
        const doc = watched?.doc;
        const sel = doc?.getSelection?.();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        const inside = watched.within;
        if (range.collapsed || !sel.toString().trim()) {   // 커서만(고른 글 없음): 부르는 쪽이 괜찮다 할 때만(숨긴 글을 누르면 「숨김 풀기」)
            if (!watched.caret?.(range) || (inside && !inside(range.startContainer))) return null;
            return range;
        }
        if (inside && !(inside(range.startContainer) && inside(range.endContainer))) return null;
        return range;
    };
    const place = () => {
        if (!shown) return;
        const { frame } = watched;
        let offset = { x: 0, y: 0 };
        if (frame) { const f = frame.getBoundingClientRect(); offset = { x: f.left + frame.clientLeft, y: f.top + frame.clientTop }; }
        const rects = [...shown.range.getClientRects()];
        if (!rects.length) { const host = shown.range.startContainer?.nodeType === 1 ? shown.range.startContainer : shown.range.startContainer?.parentElement; const r = host?.closest?.('summary, details')?.getBoundingClientRect?.() ?? host?.getBoundingClientRect?.(); if (r) rects.push(r); }   // 커서만일 때 · 접힌 숨긴 글 안
        const box = selBox(rects, offset, touchy);
        if (!box) { hide(); return; }
        // 고른 글이 미리보기 칸 밖으로 굴러 나갔으면 숨겨요
        if (frame) { const f = frame.getBoundingClientRect(); if (box.bottom < f.top || box.top > f.bottom) { el.hidden = true; return; } }
        const vv = win.visualViewport;
        const view = vv ? { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height } : { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight };
        el.hidden = false;
        el.style.left = '0px'; el.style.top = '0px';
        const r0 = el.getBoundingClientRect();   // 창(dialog)이 transform 을 가지면 fixed 의 0,0 이 화면 0,0 이 아니에요 — 그만큼 빼요
        const spot = placeBar(box, { width: r0.width, height: r0.height }, view, { touch: touchy });
        el.style.left = `${spot.left - r0.left}px`;
        el.style.top = `${spot.top - r0.top}px`;
        el.dataset.side = spot.side;
    };
    const update = () => {
        clearTimeout(timer);
        if (!watched) return;
        const range = rangeOf();
        if (!range) { hide(); return; }
        let list = [];
        try { list = watched.buttons(range) || []; } catch { list = []; }
        if (!list.length) { hide(); return; }
        const sig = list.map(b => b.id).join('|');
        if (el.dataset.sig !== sig) {
            el.innerHTML = list.map(b => `<button type="button" data-sb="${esc(b.id)}"${b.main ? ' data-main=""' : ''}${b.title ? ` title="${esc(b.title)}" aria-label="${esc(b.title)}"` : ''}>${esc(b.label)}</button>`).join('');
            el.dataset.sig = sig;
        }
        shown = { range: range.cloneRange(), list };
        place();
    };
    const later = (ms) => { clearTimeout(timer); timer = setTimeout(update, ms); };

    // 막대 누름: 고른 것 · 글 칸 포커스를 안 잃게 기본 동작을 막아요
    el.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); });
    el.addEventListener('mousedown', (event) => event.preventDefault());
    el.addEventListener('click', (event) => {
        const btn = event.target.closest?.('button[data-sb]');
        event.stopPropagation();   // 창(dialog)의 누름 처리로 안 가게 — 막대 단추는 그 창의 칩이 아니에요
        if (!btn || !shown) return;
        const item = shown.list.find(b => b.id === btn.dataset.sb), range = shown.range;
        const back = top.activeElement === btn;   // 키보드로 왔으면 글로 포커스를 돌려줘요
        hide();
        try { item?.run(range); } finally {
            if (back) { (watched?.frame ?? range.startContainer?.parentElement?.closest?.('[contenteditable],[tabindex]'))?.focus?.({ preventScroll: true }); }
            later(60);   // 굵게 · 기울임은 고른 것이 남아요 — 막대도 다시
        }
    });
    el.addEventListener('keydown', (event) => {
        const buttons = [...el.querySelectorAll('button')], at = buttons.indexOf(top.activeElement);
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            buttons[(at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        } else if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            const range = shown?.range;
            hide();
            (watched?.frame ?? range?.startContainer?.parentElement?.closest?.('[contenteditable],[tabindex]'))?.focus?.({ preventScroll: true });
        }
    });

    // 바깥 창: 막대 밖을 누르면 숨겨요(새로 고르면 다시 떠요) · 굴리면 숨겼다가 멈추면 다시 · 보이는 화면이 바뀌면(자판) 자리만 다시
    const onTopDown = (event) => { if (!el.contains(event.target) && event.target !== watched?.frame) hide(); };
    const onScroll = (event) => {
        if (el.contains(event.target)) return;
        if (!shown && !watched) return;
        el.hidden = true;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => { if (watched && !pressed) update(); }, 260);
    };
    const onView = () => { if (shown && !el.hidden) place(); };
    top.addEventListener('pointerdown', onTopDown, true);
    top.addEventListener('scroll', onScroll, true);
    win.visualViewport?.addEventListener('resize', onView);
    win.visualViewport?.addEventListener('scroll', onView);
    win.addEventListener('resize', onView);

    function watch(doc, { frame = null, within = null, caret = null, buttons } = {}) {
        watched?.off?.();
        hide();
        const view = doc.defaultView;
        const onSel = () => { if (pressed) { el.hidden = true; return; } later(touchy ? 320 : 140); };   // 손가락 · 손잡이로 넓히는 동안은 잠깐 기다려요
        const onDown = (event) => {
            touchy = event.pointerType === 'touch' || event.pointerType === 'pen';
            if (event.target && el.contains(event.target)) return;
            pressed = true; hide();
        };
        const onUp = () => { if (!pressed) return; pressed = false; later(touchy ? 320 : 40); };
        const onTouch = () => { touchy = true; };   // 손가락 고르기(길게 누름)는 pointerdown 없이 올 때가 있어요
        const onKey = (event) => {
            if (event.key === 'Escape' && shown && !el.hidden) { event.preventDefault(); event.stopImmediatePropagation(); hide(); return; }   // 첫 Esc 는 막대만 닫아요(시트 Esc 닫기 앞)
            if (event.altKey && event.key === 'ArrowDown' && shown && !el.hidden) { event.preventDefault(); event.stopImmediatePropagation(); el.querySelector('button')?.focus(); return; }
            if (!event.altKey && !event.ctrlKey && !event.metaKey) touchy = false;   // 키보드로 고르면 PC 자리
        };
        const onFrameScroll = (event) => onScroll(event);
        doc.addEventListener('selectionchange', onSel);
        doc.addEventListener('pointerdown', onDown, true);
        doc.addEventListener('touchstart', onTouch, { capture: true, passive: true });
        view?.addEventListener('pointerup', onUp, true);
        view?.addEventListener('pointercancel', onUp, true);
        doc.addEventListener('keydown', onKey, true);
        if (frame) doc.addEventListener('scroll', onFrameScroll, true);
        const off = () => {
            doc.removeEventListener('selectionchange', onSel);
            doc.removeEventListener('pointerdown', onDown, true);
            doc.removeEventListener('touchstart', onTouch, { capture: true });
            view?.removeEventListener('pointerup', onUp, true);
            view?.removeEventListener('pointercancel', onUp, true);
            doc.removeEventListener('keydown', onKey, true);
            if (frame) doc.removeEventListener('scroll', onFrameScroll, true);
            if (watched?.doc === doc) { watched = null; hide(); }
        };
        watched = { doc, frame, within, caret, buttons, off };
        pressed = false;
        return off;
    }
    function destroy() {
        watched?.off?.();
        clearTimeout(timer); clearTimeout(scrollTimer);
        top.removeEventListener('pointerdown', onTopDown, true);
        top.removeEventListener('scroll', onScroll, true);
        win.visualViewport?.removeEventListener('resize', onView);
        win.visualViewport?.removeEventListener('scroll', onView);
        win.removeEventListener('resize', onView);
        el.remove();
    }
    return { el, watch, hide, destroy, refresh: update };
}
