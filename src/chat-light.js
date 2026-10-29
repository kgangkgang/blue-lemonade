// 긴 채팅 가볍게 (10-29 perf-typing · 성능 빈틈 전수조사 7절 「페르소나 설명 타이핑」 계기 추적)
//
// 왜: 실리태번 본체 CSS 가 body 를 :has() 주어로 쓴다(body:has(.drawer-content.open) …). 그래서 문서 어디서든 노드가 들어오거나 빠지면
//   (페르소나 설명 한 글자 → 실리태번이 목록의 .ch_description 글을 다시 씀 · 전개 지시 창의 상태 글 …) Blink 가 body 에서 :has 무효화 집합을
//   다시 적용하고, 그 집합에 div · p · i · small 같은 태그가 들어 있어 300메시지 채팅의 요소 1만 4천 개가 글자마다 다시 계산됐어요
//   (PC 글자당 재계산 117~166ms · 순정 40ms — 순정에도 같은 일이 있지만 테마의 규칙이 많아 요소마다 더 비쌌어요).
// 어떻게: 메시지가 THRESHOLD 개 이상 그려져 있으면 #chat 에 bl-chat-light 를 붙이고, CSS(css/05-chat.css)가 화면 밖 메시지에
//   content-visibility: auto 를 걸어 그 메시지 안의 스타일 · 배치 계산을 건너뛴다(브라우저가 화면 가까이 오면 다시 그린다 · 한 번 그린 크기는 auto 로 기억).
//   마지막 메시지(스트리밍 · 스와이프 줄) · 바닥 10개(실리태번의 바닥 붙이기가 정확하게) · 메뉴 열린 · 고른 메시지는 CSS 가 뺀다. 리그 재현: 글자당 재계산 163 → 48ms · 입력 지연 240 → 83ms.
// (8.2.7) 표식은 html 에 단다(html.bl-chat-light) — #chat 의 class 를 바꾸면 기록마다 실리태번 keyboard.js 가 #chat 아래 전부(메시지 300개면 요소 2~3만 개)를
//   선택자 31개로 다시 훑고, body 전체를 보는 테마 감시자도 #chat 을 다시 봤다(긴 채팅을 열 때 뗐다 붙이며 두 번). html 은 그 감시자들이 안 본다. 모양은 같다.
// 여기서는 #chat 에만 childList 감시자(subtree 없음)를 걸어 .mes 수를 센다. 설정: 채팅 › 화면 「긴 채팅의 화면 밖 메시지 가볍게」(chat.chatLight · 기본 켬).
export const THRESHOLD = 60;
export const CLASS = 'bl-chat-light';
let on = false, mo = null, chat = null;

/** 메시지 수를 세어 클래스를 맞춘다. 돌려주는 값: 가볍게 상태인지 */
export function measure(el = chat) {
    if (!el) return false;
    const light = on && el.querySelectorAll(':scope > .mes').length >= THRESHOLD;
    const mark = document.documentElement.classList;
    if (mark.contains(CLASS) !== light) mark.toggle(CLASS, light);   // 같으면 쓰지 않는다 (속성 변경 → 감시자 · 재계산)
    return light;
}

export function syncChatLight(enabled) {
    on = !!enabled;
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') syncChatCover(on);   // 같은 설정(긴 채팅 가볍게) — 아래 서랍 덮개
    if (!on) { mo?.disconnect(); mo = null; if (chat && document.documentElement.classList.contains(CLASS)) document.documentElement.classList.remove(CLASS); chat = null; return; }
    const el = document.getElementById('chat');
    if (!el) { mo?.disconnect(); mo = null; chat = null; return; }
    if (el !== chat) {
        mo?.disconnect();
        chat = el;
        mo = new MutationObserver(() => measure());
        mo.observe(el, { childList: true });
    }
    measure();
}

export const _test = { state: () => ({ on, watching: !!mo, chat }) };

// ---------------------------------------------------------------- (10-29 perf-persona) 서랍이 채팅을 다 덮으면 뒤의 #chat 을 통째로 건너뛰기
// 제보: 「모바일 기준 유저 페르소나 편집하는데 많이 버벅거림 · 300챗 장기 챗」. 폰에서는 페르소나 관리 같은 서랍이 채팅을 화면 가득 덮는데도
//   서랍 안의 일(페르소나 고르기 → 실리태번이 메시지 300개의 아바타 src 를 다시 씀 · 설명 글 갱신 → body :has 무효화)마다 뒤의 #chat 요소가 전부 다시 계산됐다.
//   서랍이 #chat 의 보이는 자리를 다 덮고 바탕이 불투명할 때만 #chat 에 COVER_CLASS(css/05-chat.css: content-visibility: hidden)를 붙인다 — 보이지 않는 것만 건너뛰니 모양은 같다.
//   닫히는 순간(openDrawer 가 빠짐) 바로 뗀다. 숨긴 동안 채팅이 바뀌면(새 메시지 · 다른 채팅 · 생성 시작) 바로 떼고 다시 붙이지 않는다(다음에 서랍을 열 때까지).
//   뗄 때 스크롤: 숨기기 전 바닥이었으면 바닥으로, 아니면 그 자리로(값이 다를 때만 쓴다).
//   리그(폰 384): 숨기면 브라우저가 #chat 의 스크롤 범위를 0 으로 보고 scroll 이벤트(scrollTop 0)를 한 번, 다시 보이면 원래 자리로 되돌리며 한 번 더 쏜다.
//   읽던 자리 저장(reading-resume) · 바닥 따라가기(stream-follow) 같은 리스너가 그 0 을 「읽는 사람이 맨 위로 갔다」로 보지 않게, 덮인 동안과 뗀 직후 두 프레임은
//   #chat 의 scroll 이벤트를 창 캡처 단계에서 멈춘다(그 사이 사람이 채팅을 굴릴 수는 없다 — 서랍이 덮고 있다).
export const COVER_CLASS = 'bl-chat-covered';
const COVER_CHECKS = [0, 120, 300, 600, 1000];   // 서랍 여는 전환(opacity · transform) 이 끝난 뒤에야 덮였는지 알 수 있다
let cover = { on: false, drawers: [], mo: null, chatMo: null, covered: false, saved: null, timers: [], offs: [], blocked: false, mute: false, muted: 0 };

/** a 가 b 를 다 덮는가(1px 여유) */
export function rectCovers(a, b, tol = 1) {
    if (!a || !b || b.right - b.left < 1 || b.bottom - b.top < 1) return false;
    return a.left <= b.left + tol && a.top <= b.top + tol && a.right >= b.right - tol && a.bottom >= b.bottom - tol;
}
/** 불투명한 바탕인가 — rgba 알파 1 · 요소 opacity 1 · visibility visible · 변환 없음(여는 중) */
export function opaqueStyle(cs) {
    if (!cs || cs.visibility !== 'visible' || Number(cs.opacity) < 0.999) return false;
    if (cs.transform && cs.transform !== 'none') return false;
    const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || '');
    if (!m) return false;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    const alpha = parts.length >= 4 ? Number(parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parts[3]) : 1;
    return alpha >= 0.999;
}
function chatViewRect(el, win) {
    const r = el.getBoundingClientRect(); const vw = win.innerWidth, vh = win.innerHeight;
    return { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, vw), bottom: Math.min(r.bottom, vh) };
}
/** 지금 열린 서랍 중 #chat 을 다 덮는 불투명한 것이 있는가 */
export function drawerCoversChat(drawers, el, win) {
    const open = drawers.filter(d => d.classList.contains('openDrawer'));
    if (!open.length || !el) return false;
    const view = chatViewRect(el, win);
    return open.some(d => rectCovers(d.getBoundingClientRect(), view) && opaqueStyle(win.getComputedStyle(d)));
}
function hide(el) {
    if (cover.covered) return;
    const bottom = el.scrollHeight - el.clientHeight - el.scrollTop < 5;
    cover.saved = { top: el.scrollTop, bottom };
    cover.covered = true; cover.mute = true;
    el.classList.add(COVER_CLASS);
}
const nextFrames = fn => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => requestAnimationFrame(fn)) : setTimeout(fn, 34));
function show(el = document.getElementById('chat')) {
    if (!cover.covered) return;
    cover.covered = false;
    const saved = cover.saved; cover.saved = null;
    if (!el) return;
    el.classList.remove(COVER_CLASS);
    if (!saved) return;
    const want = saved.bottom ? el.scrollHeight - el.clientHeight : saved.top;
    if (Math.abs(el.scrollTop - want) > 1) el.scrollTop = want;
    // 되돌리는 scroll 이벤트는 다음 프레임에 온다 — 두 프레임 뒤에 푼다(그새 다시 덮이면 그대로 둔다)
    nextFrames(() => { if (!cover.covered) cover.mute = false; });
}
function clearChecks() { for (const t of cover.timers.splice(0)) clearTimeout(t); }
function evaluate() {
    const el = document.getElementById('chat');
    if (!cover.on || !el) return;
    const anyOpen = cover.drawers.some(d => d.classList.contains('openDrawer'));
    if (!anyOpen) { clearChecks(); cover.blocked = false; show(el); return; }
    if (cover.blocked) return;
    if (drawerCoversChat(cover.drawers, el, window)) hide(el); else show(el);
}
function scheduleChecks() { clearChecks(); for (const ms of COVER_CHECKS) cover.timers.push(setTimeout(evaluate, ms)); }
/** 숨긴 동안 채팅이 바뀌면 — 바로 보이게 하고 이번 서랍이 닫힐 때까지 다시 숨기지 않는다 */
function release() { if (!cover.covered) return; cover.blocked = true; clearChecks(); show(); }

export function syncChatCover(enabled) {
    const want = !!enabled && typeof window !== 'undefined';
    if (!want) {
        clearChecks(); cover.mo?.disconnect(); cover.chatMo?.disconnect(); show(); for (const off of cover.offs.splice(0)) { try { off(); } catch { } }
        cover = { on: false, drawers: [], mo: null, chatMo: null, covered: false, saved: null, timers: [], offs: [], blocked: false, mute: false, muted: 0 };
        return;
    }
    const el = document.getElementById('chat');
    const drawers = [...document.querySelectorAll('.drawer-content')];
    if (cover.on && cover.chatEl === el && drawers.length === cover.drawers.length && drawers.every((d, i) => d === cover.drawers[i])) return;
    syncChatCover(false);
    cover.on = true; cover.drawers = drawers; cover.chatEl = el;
    if (!drawers.length || !el) return;
    // 서랍 class 만(subtree 없음) — openDrawer 가 붙으면 전환이 끝날 때까지 몇 번 보고, 빠지면 그 자리에서 바로 뗀다
    cover.mo = new MutationObserver(records => {
        const closed = records.some(r => !r.target.classList.contains('openDrawer') && (r.oldValue || '').split(/\s+/).includes('openDrawer'));
        if (closed) evaluate();
        if (cover.drawers.some(d => d.classList.contains('openDrawer'))) scheduleChecks();
    });
    for (const d of drawers) cover.mo.observe(d, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    cover.chatMo = new MutationObserver(() => release());
    cover.chatMo.observe(el, { childList: true });
    const onScroll = event => { if (cover.mute && event.target === cover.chatEl) { cover.muted++; event.stopImmediatePropagation(); } };
    window.addEventListener('scroll', onScroll, true);
    cover.offs.push(() => window.removeEventListener('scroll', onScroll, true));
    const onResize = () => { if (cover.drawers.some(d => d.classList.contains('openDrawer'))) scheduleChecks(); };
    window.addEventListener('resize', onResize, { passive: true });
    cover.offs.push(() => window.removeEventListener('resize', onResize));
    try {
        const ctx = globalThis.SillyTavern?.getContext?.(); const es = ctx?.eventSource, T = ctx?.eventTypes || ctx?.event_types;
        for (const name of ['GENERATION_STARTED', 'CHAT_CHANGED', 'MESSAGE_SWIPED']) {
            const ev = T?.[name]; if (!es?.on || !ev) continue;
            es.on(ev, release); cover.offs.push(() => (es.removeListener || es.off)?.call(es, ev, release));
        }
    } catch { }
    if (drawers.some(d => d.classList.contains('openDrawer'))) scheduleChecks();
}
export const _cover = { state: () => ({ on: cover.on, covered: cover.covered, blocked: cover.blocked, drawers: cover.drawers.length, saved: cover.saved, mute: cover.mute, muted: cover.muted }), evaluate, show, release };
