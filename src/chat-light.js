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
// 1.0.6 실측: 30~50개에도 적용하면 미리 그리기와 스타일 재계산이 늘어 기존 60개 문턱을 유지해요.
export const THRESHOLD = 60;
export const CLASS = 'bl-chat-light';
// (1.1.1 longchat) 바닥 10개 표식: CSS 가 :nth-last-child(-n+10) 로 고르면 #chat 이 「뒤에서 세는 자리 규칙」을 갖게 되어, 메시지가 하나 붙을 때마다
//   크롬이 형제 메시지 전부(2,000개면 2,000개)에 nth 무효화 집합을 걸어요 — 그 집합에 다른 규칙(표의 tr:nth-child(even) td · :not(pre *) …)의 「아래 전부」가
//   섞여 메시지 안쪽까지 훑고 다시 계산했어요(흉내 2,000개: 답 하나 스타일 58ms · 순정 1.4ms). 같은 10개를 JS 가 data 속성으로 달면 붙인 메시지 · 표식이 바뀐 둘만 다시 계산해요.
//   셈은 nth-last-child 와 같아요(#chat 의 마지막 요소 10개 중 .mes — 「더 보기」 같은 다른 요소도 자리를 차지). class 가 아니라 data 속성이라 실리태번 keyboard.js 감시(class 만)가 다시 훑지 않아요.
export const TAIL_ATTR = 'data-bl-tail';
export const TAIL = 10;
let on = false, mo = null, chat = null, tail = new Set();

/** #chat 바로 아래 .mes 를 need 개까지만 센다(querySelectorAll(':scope > .mes') 는 메시지 안쪽 요소까지 다 훑어요) */
function countMes(el, need) {
    let n = 0;
    for (let c = el.firstElementChild; c && n < need; c = c.nextElementSibling) if (c.classList.contains('mes')) n++;
    return n;
}
/** #chat 바로 아래 .mes 들(형제 차례로 — 메시지 안쪽은 훑지 않아요) */
export function mesKids(el) { const out = []; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.classList.contains('mes')) out.push(c); return out; }
/** 바닥 표식을 맞춘다 — 바뀐 메시지에만 쓴다 */
function markTail(el, light) {
    const want = new Set();
    if (light) { let k = 0; for (let c = el.lastElementChild; c && k < TAIL; c = c.previousElementSibling, k++) if (c.classList.contains('mes')) want.add(c); }
    for (const m of tail) if (!want.has(m) && m.hasAttribute(TAIL_ATTR)) m.removeAttribute(TAIL_ATTR);
    for (const m of want) if (!m.hasAttribute(TAIL_ATTR)) m.setAttribute(TAIL_ATTR, '');
    tail = want;
}

/** 메시지 수를 세어 클래스 · 바닥 표식을 맞춘다. 돌려주는 값: 가볍게 상태인지 */
export function measure(el = chat) {
    if (!el) return false;
    const light = on && countMes(el, THRESHOLD) >= THRESHOLD;
    markTail(el, light);   // 표식을 먼저 — class 가 붙는 같은 계산에서 바닥 10개가 이미 빠져 있게
    const mark = document.documentElement.classList;
    if (mark.contains(CLASS) !== light) mark.toggle(CLASS, light);   // 같으면 쓰지 않는다 (속성 변경 → 감시자 · 재계산)
    return light;
}

export function syncChatLight(enabled) {
    on = !!enabled;
    kickWarm();   // (10-30 perf-chatlight) 쉴 때 미리 그리기 — 아래
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') syncChatCover(on);   // 같은 설정(긴 채팅 가볍게) — 아래 서랍 덮개
    if (!on) { mo?.disconnect(); mo = null; if (chat) markTail(chat, false); if (chat && document.documentElement.classList.contains(CLASS)) document.documentElement.classList.remove(CLASS); chat = null; return; }
    const el = document.getElementById('chat');
    if (!el) { mo?.disconnect(); mo = null; chat = null; return; }
    if (el !== chat) {
        mo?.disconnect();
        if (chat) markTail(chat, false);
        chat = el;
        mo = new MutationObserver(() => { measure(); kickWarm(); });
        mo.observe(el, { childList: true });
    }
    measure();
}

export const _test = { state: () => ({ on, watching: !!mo, chat }) };

// ---------------------------------------------------------------- (9.0.3) 강제 배치 없이 — 프레임 도우미
// 이 모듈은 DOM 에 쓴 뒤 같은 작업 안에서 자리 · 크기를 읽지 않아요(읽으면 브라우저가 그 자리에서 스타일 · 배치를 끝내야 해서 — 강제 배치).
//   읽어야 하는 일(덮였는지 재기 · 스크롤 되돌리기)은 afterLayout 으로 「그 프레임의 배치가 끝난 뒤 · 칠하기 전」에 해요: ResizeObserver 알림은 배치 뒤 · 칠하기 전에 와서
//   그 안에서 읽는 값은 이미 계산된 것이고, 거기서 쓴 스크롤은 같은 프레임에 칠해져요(깜빡임 없음). 쓰는 일(미리 그리기 표식)은 프레임 첫머리(rAF)에 몰아 그 프레임이 한 번에 계산해요.
//   시험 tools/tests/chat-light-layout.mjs 가 이 규칙(쓰기 뒤 동기 배치 읽기 없음)을 정적으로 지켜요.
const hasRaf = () => typeof requestAnimationFrame === 'function';
const raf = fn => (hasRaf() ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const cancelRaf = id => { if (!id) return; if (hasRaf() && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id); else clearTimeout(id); };
const AFTER_LAYOUT_FALLBACK_MS = 300;   // 크기가 0 인 칸(숨김) · 그리지 않는 탭은 ResizeObserver 첫 알림이 오지 않을 수 있어 — 그때만 늦게라도 한 번(바쁜 폰에서 첫 프레임보다 먼저 오지 않게 넉넉히)
/** el 이 그려지는 다음 프레임의 배치가 끝난 뒤(칠하기 전) fn 을 한 번 — 돌려주는 함수로 취소 */
function afterLayout(el, fn) {
    let done = false, ro = null, fallback = 0;
    const run = () => { if (done) return; done = true; ro?.disconnect(); if (ro) clearTimeout(fallback); fn(); };
    if (el && typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(run);   // 첫 알림 = 관찰을 시작한 뒤 첫 배치 직후
        ro.observe(el);
        fallback = setTimeout(run, AFTER_LAYOUT_FALLBACK_MS);
    } else fallback = raf(run);   // 없으면 다음 프레임 첫머리 — 그 프레임이 어차피 할 배치를 한 번 앞당길 뿐
    return () => { if (done) return; done = true; ro?.disconnect(); if (ro) clearTimeout(fallback); else cancelRaf(fallback); };
}

// ---------------------------------------------------------------- (10-29 perf-persona) 서랍이 채팅을 다 덮으면 뒤의 #chat 을 통째로 건너뛰기
// 제보: 「모바일 기준 유저 페르소나 편집하는데 많이 버벅거림 · 300챗 장기 챗」. 폰에서는 페르소나 관리 같은 서랍이 채팅을 화면 가득 덮는데도
//   서랍 안의 일(페르소나 고르기 → 실리태번이 메시지 300개의 아바타 src 를 다시 씀 · 설명 글 갱신 → body :has 무효화)마다 뒤의 #chat 요소가 전부 다시 계산됐다.
//   서랍이 #chat 의 보이는 자리를 다 덮고 바탕이 불투명할 때만 #chat 에 COVER_CLASS(css/05-chat.css: content-visibility: hidden)를 붙인다 — 보이지 않는 것만 건너뛰니 모양은 같다.
//   닫히는 순간(openDrawer 가 빠짐) 바로 뗀다. 숨긴 동안 채팅이 바뀌면(새 메시지 · 다른 채팅 · 생성 시작) 바로 떼고 다시 붙이지 않는다(다음에 서랍을 열 때까지).
//   뗄 때 스크롤: 숨기기 전 바닥이었으면 바닥으로, 아니면 그 자리로(값이 다를 때만 쓴다).
//   리그(폰 384): 숨기면 브라우저가 #chat 의 스크롤 범위를 0 으로 보고 scroll 이벤트(scrollTop 0)를 한 번, 다시 보이면 원래 자리로 되돌리며 한 번 더 쏜다.
//   읽던 자리 저장(reading-resume) · 바닥 따라가기(stream-follow) 같은 리스너가 그 0 을 「읽는 사람이 맨 위로 갔다」로 보지 않게, 덮인 동안과 되돌린 뒤 두 프레임은
//   #chat 의 scroll 이벤트를 창 캡처 단계에서 멈춘다(그 사이 사람이 채팅을 굴릴 수는 없다 — 서랍이 덮고 있다).
// (9.0.3) 덮개는 content-visibility: hidden 그대로예요 — transform · opacity 로는 뒤 채팅의 스타일 계산을 건너뛸 수 없어서(이 덮개의 이유) 바꾸지 않았어요.
//   대신 읽기 · 쓰기를 갈랐어요: 덮였는지 재기(evaluate — 서랍 · 채팅 자리와 서랍의 계산된 스타일)와 스크롤 되돌리기(restoreScroll)는 afterLayout 에서만 읽고,
//   떼기(show)는 class 만 빼고 바로 돌아가요. 예전에는 class 를 뺀 그 자리에서 scrollHeight · scrollTop 을 읽어(폰 157+184ms) 서랍을 닫는 클릭 안에서
//   채팅 전체 배치를 강제로 끝냈고, 같은 클릭의 다른 쓰기(아이콘 · 다른 서랍)로 그 프레임이 배치를 한 번 더 했어요 — 이제 그 프레임의 배치 한 번에 모여요.
//   덮였는지 재기도 예전에는 타이머(서랍을 연 뒤 0 · 120 · 300 · 600 · 1000ms)에서 바로 읽어, 여는 전환 중 더러워진 스타일 · 배치를 그때마다 강제로 끝냈어요.
export const COVER_CLASS = 'bl-chat-covered';
const COVER_CHECKS = [0, 120, 300, 600, 1000];   // 서랍 여는 전환(opacity · transform) 이 끝난 뒤에야 덮였는지 알 수 있다
const freshCover = () => ({ on: false, drawers: [], mo: null, chatMo: null, covered: false, saved: null, timers: [], offs: [], blocked: false, mute: false, muted: 0, check: null, restoring: null });
let cover = freshCover();

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
/** 지금 열린 서랍 중 #chat 을 다 덮는 불투명한 것이 있는가 (읽기만 — afterLayout 안의 evaluate 에서 불러요) */
export function drawerCoversChat(drawers, el, win) {
    const open = drawers.filter(d => d.classList.contains('openDrawer'));
    if (!open.length || !el) return false;
    const view = chatViewRect(el, win);
    return open.some(d => rectCovers(d.getBoundingClientRect(), view) && opaqueStyle(win.getComputedStyle(d)));
}
const anyOpenDrawer = () => cover.drawers.some(d => d.classList.contains('openDrawer'));
/** 덮는다 — 읽기(지금 스크롤) 먼저, 쓰기(class) 마지막. evaluate(afterLayout) 에서만 불러요 */
function hide(el) {
    if (cover.covered) return;
    const pending = cover.restoring;   // 떼고 아직 되돌리기 전에 다시 덮이면 그때 적어 둔 자리를 그대로 이어요
    if (pending) { pending.cancel(); cover.restoring = null; }
    const saved = pending ? pending.saved : { top: el.scrollTop, bottom: el.scrollHeight - el.clientHeight - el.scrollTop < 5 };
    cover.saved = saved;
    cover.covered = true; cover.mute = true;
    el.classList.add(COVER_CLASS);
}
const nextFrames = fn => (hasRaf() ? requestAnimationFrame(() => requestAnimationFrame(fn)) : setTimeout(fn, 34));
/** 뗀다 — class 만 빼고(쓰기만) 스크롤은 그 프레임의 배치가 끝난 뒤 되돌려요(restoreScroll: 읽기 → 쓰기 한 번) */
function show(el = document.getElementById('chat')) {
    if (!cover.covered) return;
    cover.covered = false;
    const saved = cover.saved; cover.saved = null;
    if (!el) { cover.mute = false; return; }
    el.classList.remove(COVER_CLASS);
    if (!saved) { cover.mute = false; return; }
    cover.restoring?.cancel();
    const job = { saved, cancel: null };
    cover.restoring = job;
    job.cancel = afterLayout(el, () => {
        if (cover.restoring === job) cover.restoring = null;
        restoreScroll(el, saved);
        // 되돌리는 scroll 이벤트는 다음 프레임에 온다 — 두 프레임 뒤에 푼다(그새 다시 덮이면 그대로 둔다)
        nextFrames(() => { if (!cover.covered) cover.mute = false; });
    });
}
/** 배치가 끝난 뒤에만 불러요 — 읽기 셋을 먼저, 다를 때만 scrollTop 한 번 쓰기 */
function restoreScroll(el, saved) {
    if (cover.covered || el.isConnected === false) return;   // 그새 다시 덮였거나 채팅 칸이 바뀌었으면 두어요
    const top = el.scrollTop, max = el.scrollHeight - el.clientHeight;
    const want = saved.bottom ? max : saved.top;
    if (Math.abs(top - want) > 1) el.scrollTop = want;
}
function clearChecks() { for (const t of cover.timers.splice(0)) clearTimeout(t); cover.check?.(); cover.check = null; }
/** 덮였는지 재고 맞춘다 — 서랍 · 채팅 자리와 서랍의 계산된 스타일을 읽어요(읽기 다음 쓰기). 배치가 끝난 뒤(checkSoon)에만 불러요 */
function evaluate() {
    const el = document.getElementById('chat');
    if (!cover.on || !el) return;
    if (!anyOpenDrawer()) { clearChecks(); cover.blocked = false; show(el); return; }
    if (cover.blocked) return;
    if (drawerCoversChat(cover.drawers, el, window)) hide(el); else show(el);
}
/** 다음 프레임의 배치가 끝난 뒤 한 번 잰다(이미 잡혀 있으면 그것으로) */
function checkSoon() {
    if (cover.check || !cover.on) return;
    const el = document.getElementById('chat');
    if (!el) return;
    cover.check = afterLayout(el, () => { cover.check = null; evaluate(); });
}
function scheduleChecks() { clearChecks(); for (const ms of COVER_CHECKS) cover.timers.push(setTimeout(checkSoon, ms)); }
/** 숨긴 동안 채팅이 바뀌면 — 바로 보이게 하고 이번 서랍이 닫힐 때까지 다시 숨기지 않는다 */
function release() { if (!cover.covered) return; cover.blocked = true; clearChecks(); show(); }

export function syncChatCover(enabled) {
    const want = !!enabled && typeof window !== 'undefined';
    if (!want) {
        clearChecks(); cover.mo?.disconnect(); cover.chatMo?.disconnect(); show(); for (const off of cover.offs.splice(0)) { try { off(); } catch { } }
        const restoring = cover.restoring;   // 끄는 순간 뗀 덮개의 스크롤 되돌리기는 그대로 끝내요
        cover = freshCover(); cover.restoring = restoring;
        return;
    }
    const el = document.getElementById('chat');
    const drawers = [...document.querySelectorAll('.drawer-content')];
    if (cover.on && cover.chatEl === el && drawers.length === cover.drawers.length && drawers.every((d, i) => d === cover.drawers[i])) return;
    syncChatCover(false);
    cover.on = true; cover.drawers = drawers; cover.chatEl = el;
    if (!drawers.length || !el) return;
    // 서랍 class 만(subtree 없음) — openDrawer 가 붙으면 전환이 끝날 때까지 몇 번 재고, 다 닫히면 그 자리에서 바로 뗀다(쓰기만 · 읽지 않아요)
    cover.mo = new MutationObserver(records => {
        const closed = records.some(r => !r.target.classList.contains('openDrawer') && (r.oldValue || '').split(/\s+/).includes('openDrawer'));
        const open = anyOpenDrawer();
        if (closed && !open) { clearChecks(); cover.blocked = false; show(); }
        warmOnDrawers();   // (10-30 perf-chatlight) 서랍이 열리면 미리 그리기를 쉬고 화면 밖을 되돌려요
        if (open) scheduleChecks();
    });
    for (const d of drawers) cover.mo.observe(d, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    cover.chatMo = new MutationObserver(() => release());
    cover.chatMo.observe(el, { childList: true });
    const onScroll = event => { if (cover.mute && event.target === cover.chatEl) { cover.muted++; event.stopImmediatePropagation(); } };
    window.addEventListener('scroll', onScroll, true);
    cover.offs.push(() => window.removeEventListener('scroll', onScroll, true));
    const onResize = () => { if (anyOpenDrawer()) scheduleChecks(); };
    window.addEventListener('resize', onResize, { passive: true });
    cover.offs.push(() => window.removeEventListener('resize', onResize));
    try {
        const ctx = globalThis.SillyTavern?.getContext?.(); const es = ctx?.eventSource, T = ctx?.eventTypes || ctx?.event_types;
        for (const name of ['GENERATION_STARTED', 'CHAT_CHANGED', 'MESSAGE_SWIPED']) {
            const ev = T?.[name]; if (!es?.on || !ev) continue;
            es.on(ev, release); cover.offs.push(() => (es.removeListener || es.off)?.call(es, ev, release));
        }
    } catch { }
    if (anyOpenDrawer()) scheduleChecks();
}
export const _cover = { state: () => ({ on: cover.on, covered: cover.covered, blocked: cover.blocked, drawers: cover.drawers.length, saved: cover.saved, mute: cover.mute, muted: cover.muted, restoring: !!cover.restoring }), evaluate, show, release };

// ---------------------------------------------------------------- (10-30 perf-chatlight) 쉴 때 화면 밖 메시지를 미리 그려 두기
// 왜: 성능 관문 스크롤(150개 메시지를 1초에 맨 위까지 올렸다 내림 · 폰 4배)에서 50ms 넘는 프레임이 끄면 3개 · 켜면 33~34개였어요. 프로파일:
//   content-visibility:auto 로 건너뛴 메시지는 화면에 들어오는 그 프레임에 스타일(메시지 하나 약 16ms) · 배치 · 칠하기 · 그림 칠하기를 해요(프레임마다 새 메시지 5개 남짓 → 80~200ms).
//   한 번 그린 메시지도 다시 화면 밖으로 나가면 건너뛰어, 돌아올 때 배치 · 칠하기를 또 해서 내려오는 길도 느렸어요.
// 어떻게: 채팅이 조용해지면(메시지가 들고 난 뒤 WARM_QUIET_MS) 지금 보는 자리에 가까운 메시지부터 data-bl-warm 을 달아 건너뛰기를 풀어요(css/05-chat.css).
//   다 풀면 끈 것과 같은 스크롤이고, 여는 순간(긴 채팅 열기)은 예전처럼 화면 밖을 건너뛰어 빨라요(그 일을 쉬는 시간으로 옮길 뿐 · 모양은 같아요).
//   생성 중(body data-generating) · 답장 토큰이 오는 동안 · 서랍이 열린 동안(고정 서랍 빼고)은 쉬고, 그때 푼 메시지를 다시 건너뛰게 돌려놔요 —
//   페르소나 설명 타이핑처럼 서랍 안 일마다 메시지 전체가 다시 계산되던 것(이 모듈의 원래 이유)을 그대로 막아요. 닫히면 다시 쉬는 시간에 풀어요.
//   표식은 class 가 아니라 data 속성 — 실리태번 keyboard.js 감시자(class 만 봐요)와 네모 단추 감시(class · style …)가 메시지마다 다시 훑지 않게.
// (9.0.3) 고르기는 계산된 스타일 · 자리를 읽지 않아요 — 건너뛰는지는 CSS 와 같은 선택자(SKIP_SELECTOR)를 matches 로, 보는 자리는 IntersectionObserver 첫 알림
//   (배치 뒤에 비동기로 와요)으로 가운데 메시지를 찾고 DOM 차례로 가까운 것부터. 예전(8.2.4)에는 메시지마다 getComputedStyle · getBoundingClientRect 를 읽었어요.
// (1.0.0 scroll-919) 묶음은 다시 낮은 우선순위 작업 안에서 끝내요 — 표식을 달고 그 작업 안에서 스타일 · 배치를 한 번 끝낸 뒤(void el.offsetHeight) 걸린 시간으로 묶음 크기를 맞춰요.
//   9.0.3 은 표식을 프레임 첫머리(rAF)에 달고 읽지 않게 바꿨는데, 이 테마는 표식이 바뀐 프레임마다 칠하기(폰 4배 Paint 30~160ms)가 붙어
//   묶음 하나(묶음 크기가 늘 1 로 줄었어요)마다 그 칠하기를 따로 냈어요 — 리그 폰 4배 쉬는 동안: 4초에 35개 · 긴 작업 34개(8.2.4 는 5초에 112개 · 긴 작업 12개).
//   작업 안에서 끝내면 묶음 여럿이 다음 프레임의 칠하기 한 번을 나눠 써요. 또 9.0.3 은 키 · 누름 · 클릭 · 휠 · 터치 뒤 1초를 쉬어, 답장을 받은 뒤(토큰 동안 표식을 뗌)
//   글을 치다 바로 굴리면(관문: 스트리밍 → 타이핑 → 0.3초 뒤 스크롤) 하나도 풀리지 않은 채로 굴렸어요(관문 폰 50ms 넘는 프레임 0 → 22 · p95 16.8 → 116.6ms).
//   이제 시간으로 쉬지 않고, 처리를 기다리는 입력이 있으면(navigator.scheduling.isInputPending) 그 묶음을 미뤄 입력이 먼저 돌게 해요 —
//   한 묶음은 WARM_SLICE_MS 안팎이라 막 온 키 · 누름이 기다려도 그만큼이에요. 굴리는 손가락(휠 · 터치)은 오히려 풀어야 할 때라 쉬지 않아요.
export const WARM_ATTR = 'data-bl-warm';
export const WARM_QUIET_MS = 500;
const WARM_RETRY_MS = 1000;   // 쉬는 조건(생성 중 · 서랍)이 풀렸는지 다시 볼 간격
// 한 묶음(낮은 우선순위 작업 하나)의 목표 시간 · 묶음 크기는 8.2.4 값 그대로. 폰 4배에서 표식을 바꾸고 배치를 끝내면 메시지 수와 상관없는 고정 몫(스타일 약 12ms · #chat 배치 약 7ms)이 있어
//   작게(9.0.3 의 32ms · 최대 8 · 처음 2) 잡으면 묶음이 늘 하나라 고정 몫만 되풀이해요 — 리그 폰 4배: 관문 타이핑 동안 145개 중 74~122개만 풀려 스크롤에 50ms 넘는 프레임 10~20개
//   (8.2.4 값이면 타이핑 동안 145개 다). 지난 묶음이 0.6 배보다 빨랐으면 두 배, 1.5 배를 넘었으면 절반. 입력 · 그리기 · 보통 작업이 먼저 돌아요(background 우선순위).
export const WARM_SLICE_MS = 50;
export const WARM_BATCH_MAX = 12;   // 깨끗한 메시지(하나 1ms 남짓)로 키운 묶음이 처음 그리는 메시지(하나 4ms 안팎)를 만나도 한 묶음이 너무 길지 않게
// css/05-chat.css 의 「긴 채팅 가볍게」 규칙과 같은 꼴(시험이 둘을 맞춰 봐요) — 이 선택자에 맞고 표식이 없는 메시지가 건너뛰는 메시지예요
export const SKIP_SELECTOR = '.mes:not(.last_mes, .bl-menu-open, .selected):not([data-bl-tail])';
let warm = { timer: 0, job: 0, look: null, list: null, i: 0, k: 4, done: 0, slices: 0, yielded: 0, cool: false, gate: null, parked: false, gated: 0 };
// (1.2.1 opt121-warm) 키 · 입력 · 누름 뒤 「그 입력의 프레임」이 칠해질 때까지는 새 묶음을 시작하지 않아요.
//   isInputPending 은 아직 처리 안 된 입력만 알려 줘서, 입력 처리가 끝나고 그 화면이 그려지기 전 빈틈에 묶음(폰 4배 30~70ms)이 끼면
//   글자가 화면에 나오는 것이 그만큼 늦었어요(관문 폰 타이핑: stepWarm 668ms · 입력 지연 최대 순정 27.7 → 53.8ms).
//   시간을 두고 쉬지는 않아요(9.0.3 은 1초를 쉬어 치다 바로 굴리면 하나도 안 풀렸어요) — 다음 프레임(rAF) 첫머리에서 바로 풀고,
//   미룬 묶음은 그때 낮은 우선순위 작업으로 다시 잡아 그 프레임이 칠해진 뒤에 돌아요. 한 묶음의 크기 · 차례 · 끝 결과는 그대로예요.
//   그리지 않는 탭(rAF 가 안 옴)은 INPUT_GATE_MAX_MS 뒤 풀어요. 미리 그릴 일이 남아 있을 때만 프레임을 잡아요(평소 타이핑엔 아무것도 안 해요).
const INPUT_GATE_EVENTS = ['keydown', 'input', 'pointerdown'];
const INPUT_GATE_MAX_MS = 100;
function releaseGate() {
    const g = warm.gate;
    if (!g) return;
    warm.gate = null; cancelRaf(g.frame); clearTimeout(g.timer);
    if (warm.parked) { warm.parked = false; if (warm.list && !warm.job) warm.job = bgTask(stepWarm); }
}
function onInputGate() {
    if (warm.gate || !(warm.job || warm.list)) return;   // 미리 그리는 중일 때만
    warm.gate = { frame: 0, timer: 0 };
    warm.gate.frame = raf(releaseGate);
    warm.gate.timer = setTimeout(releaseGate, INPUT_GATE_MAX_MS);
}
const bgTask = fn => {
    if (typeof scheduler !== 'undefined' && typeof scheduler?.postTask === 'function' && typeof AbortController === 'function') {
        const ctl = new AbortController(); scheduler.postTask(fn, { priority: 'background', signal: ctl.signal }).catch(() => { }); return ctl;
    }
    return setTimeout(fn, 16);
};
const cancelBg = job => { if (!job) return; if (typeof job.abort === 'function') job.abort(); else clearTimeout(job); };
function stopWarm() {
    clearTimeout(warm.timer); cancelBg(warm.job); warm.look?.cancel();
    warm.timer = 0; warm.job = 0; warm.look = null; warm.list = null; warm.i = 0; warm.parked = false;
}
/** 미리 그리기를 쉬어야 하나 — 꺼짐 · 시작 덮개(#preloader · boot-gate.js 와 같은 판정) · 생성 중 · (고정 아닌) 서랍이 열림 */
export function warmPaused(doc = document) {
    if (!on) return true;
    if (doc.getElementById?.('preloader')) return true;   // 처음 불러오는 동안은 그리는 일을 보태지 않아요(걷힌 뒤 다시 봐요)
    if (doc.body?.dataset?.generating === 'true') return true;
    return !!doc.querySelector?.('.drawer-content.openDrawer:not(.pinnedOpen)');
}
/** 처리를 기다리는 키 · 누름이 있나 — 있으면 묶음을 미뤄 입력이 먼저(없는 브라우저는 늘 false) */
export function inputPending(nav = typeof navigator !== 'undefined' ? navigator : null) {
    try { return !!nav?.scheduling?.isInputPending?.(); } catch { return false; }
}
/** 긴 채팅 가볍게가 지금 걸려 있나 — 스타일을 읽지 않고(표식만). 표식은 판에 따라 html 또는 #chat 에 붙어요 */
const lightNow = el => !!el && (!!document.documentElement?.classList?.contains(CLASS) || !!el.classList?.contains?.(CLASS));
/** 메시지가 들고 났거나 설정이 바뀌면 — 조용해진 뒤 처음부터 다시 고른다 */
export function kickWarm(delay = WARM_QUIET_MS) {
    stopWarm();
    if (!on || typeof document === 'undefined') return;
    listenWarm();
    warm.timer = setTimeout(startWarm, delay);
}
function startWarm() {
    warm.timer = 0;
    if (warmPaused()) { warm.timer = setTimeout(startWarm, WARM_RETRY_MS); return; }
    const el = document.getElementById('chat');
    if (!lightNow(el)) return;   // 짧은 채팅이면 고를 것도 없다
    warm.look = findAnchor(el, anchor => {
        warm.look = null;
        warm.list = warmCandidates(el, anchor); warm.i = 0;
        if (warm.list.length) warm.job = bgTask(stepWarm); else warm.list = null;
    });
}
/** 보는 자리의 가운데 메시지 차례(:scope > .mes 안 번호 · 반 칸도 됨)를 IntersectionObserver 첫 알림으로 — 자리를 직접 읽지 않아요.
 *  없거나 ANCHOR_WAIT_MS 안에 알림이 없으면(그리지 않는 탭 등) 바닥(채팅은 바닥에서 열려요) — 관찰은 어느 쪽이든 바로 끊어요(메시지를 붙잡지 않게).
 *  돌려주는 것: { cancel } 또는 null(그 자리에서 불렀음) */
const ANCHOR_WAIT_MS = 300;
export function findAnchor(el, cb) {
    const all = mesKids(el);
    if (!all.length || typeof IntersectionObserver !== 'function') { cb(all.length - 1); return null; }
    const index = new Map(all.map((mes, i) => [mes, i]));
    let done = false, timer = 0, io = null;
    const finish = entries => {
        if (done) return;
        done = true; io.disconnect(); clearTimeout(timer);
        let lo = Infinity, hi = -Infinity;
        for (const e of entries || []) if (e.isIntersecting && index.has(e.target)) { const i = index.get(e.target); if (i < lo) lo = i; if (i > hi) hi = i; }
        index.clear();
        cb(hi >= lo ? (lo + hi) / 2 : all.length - 1);
    };
    io = new IntersectionObserver(finish, { root: el });
    for (const mes of all) io.observe(mes);
    timer = setTimeout(() => finish(null), ANCHOR_WAIT_MS);
    return { cancel() { if (done) return; done = true; io.disconnect(); clearTimeout(timer); index.clear(); } };
}
/** 건너뛰는 메시지(SKIP_SELECTOR · 표식 없음)를 anchor 에서 DOM 차례로 가까운 것부터 — 계산된 스타일 · 자리를 읽지 않아요 */
export function warmCandidates(el, anchor = Infinity) {
    const all = mesKids(el);
    const at = Number.isFinite(anchor) && anchor >= 0 ? anchor : all.length - 1;
    const out = [];
    all.forEach((mes, i) => { if (!mes.hasAttribute(WARM_ATTR) && mes.matches(SKIP_SELECTOR)) out.push([mes, Math.abs(i - at), i]); });
    out.sort((a, b) => a[1] - b[1] || b[2] - a[2]);   // 같은 거리면 아래 것 먼저
    return out.map(x => x[0]);
}
// 크롬은 content-visibility 가 auto → visible 로 바뀌어 건너뛰기가 풀릴 때 contentvisibilityautostatechange 를 내지 않아요(리그 확인).
//   네모 단추 감시(squared-buttons.js)는 그 사건(skipped=false)을 받아 건너뛰어 둔 메시지 안 단추를 재므로, 풀어 준 메시지마다 같은 꼴로 알려 줘요.
//   알림은 배치를 끝낸 뒤라 감시가 재는 값은 이미 계산돼 있어요.
function announce(mes) {
    try {
        const E = typeof ContentVisibilityAutoStateChangeEvent === 'function' ? ContentVisibilityAutoStateChangeEvent : Event;
        const ev = new E('contentvisibilityautostatechange', { skipped: false });
        if (!('skipped' in ev)) Object.defineProperty(ev, 'skipped', { value: false });
        mes.dispatchEvent(ev);
    } catch { }
}
const stillSkipped = (mes, el) => mes.isConnected && mes.parentElement === el && !mes.hasAttribute(WARM_ATTR) && mes.matches(SKIP_SELECTOR);
/** 낮은 우선순위 작업 하나 = 묶음 하나: 표식을 달고 → 이 작업 안에서 스타일 · 배치를 한 번 끝내고(void el.offsetHeight) → 걸린 시간으로 다음 묶음 크기.
 *  처리를 기다리는 입력이 있으면 달지 않고 다음 작업으로 미뤄요(입력 작업이 먼저 돌아요). */
function stepWarm() {
    warm.job = 0; warm.slices++;
    if (warmPaused()) { warm.list = null; warm.timer = setTimeout(startWarm, WARM_RETRY_MS); return; }
    const el = document.getElementById('chat');
    if (!el || !warm.list || !lightNow(el)) { warm.list = null; return; }
    if (inputPending()) { warm.yielded++; warm.job = bgTask(stepWarm); return; }
    if (warm.gate) { warm.gated++; warm.parked = true; return; }   // 막 처리한 입력의 프레임이 아직 — 그 프레임에서 다시 잡아요(releaseGate)
    const picked = [];
    while (warm.i < warm.list.length && picked.length < warm.k) {
        const mes = warm.list[warm.i++];
        if (stillSkipped(mes, el)) picked.push(mes);
    }
    if (picked.length) {
        const t = performance.now();
        for (const mes of picked) mes.setAttribute(WARM_ATTR, '');
        warm.cool = false;
        void el.offsetHeight;   // 풀린 안쪽의 스타일 · 배치를 지금(이 낮은 우선순위 작업 안에서) 끝낸다 — 칠하기는 다음 프레임에 묶음 여럿이 한 번
        const spent = performance.now() - t;
        if (picked.length === warm.k && spent < WARM_SLICE_MS * 0.6) warm.k = Math.min(warm.k * 2, WARM_BATCH_MAX);
        else if (spent > WARM_SLICE_MS * 1.5) warm.k = Math.max(1, warm.k >> 1);
        warm.done += picked.length;
        for (const mes of picked) announce(mes);   // 알림을 받은 쪽이 미리 그리기를 멈췄을 수도 있어요(아래 warm.list 확인)
    }
    if (warm.list && warm.i < warm.list.length) warm.job = bgTask(stepWarm);
    else warm.list = null;
}
/** 푼 메시지를 다시 건너뛸 수 있게 돌려놓는다 — 서랍이 열릴 때 · 답장을 받기 시작할 때.
 *  표식을 모두 떼도 보이는 메시지는 content-visibility:auto 라 그대로 그려지고(화면 밖 것만 건너뜀), 자리를 재지 않는다 —
 *  서랍이 열리는 순간 · 토큰이 막 바뀐 순간에 재면 그때 더러워진 스타일 · 배치를 푼 메시지 전부와 함께 강제로 계산해 버린다. */
export function coolOffscreen(doc = document) {
    stopWarm(); warm.cool = true;
    const el = doc.getElementById('chat');
    const warmed = el ? mesKids(el).filter(mes => mes.hasAttribute(WARM_ATTR)) : [];
    for (const mes of warmed) mes.removeAttribute(WARM_ATTR);
    return warmed.length;
}
/** (1.1.1 restyle) 문서 전체 다시 계산을 앞두고 — 테마 설정 적용(src/apply.js applyAll: :root 변수 시트 · body class · html 속성)처럼 모든 요소가 다시 계산될 쓰기 직전에 불러요
 *  (features.js coolChatForRestyle 다리). 푼(미리 그린) 메시지를 되돌려 그 계산이 화면 밖 메시지 안쪽(2,000개면 요소 14만 개)을 건너뛰게 하고, 조용해지면(WARM_QUIET_MS) 다시 미리 그려요.
 *  보이는 메시지는 content-visibility:auto 라 그대로 그려져 모양은 같아요(coolOffscreen · 자리를 재지 않음). 흉내 2,000개(PC): 밝기 바꾸기 스타일 재계산 1,139 → 212ms.
 *  서랍 열기 자체(openDrawer 토글)는 문서 전체를 다시 계산하지 않아요(흉내 2,000개 1.8ms · 요소 1개) — 재계산은 테마의 설정 적용 쓰기가 일으켜요.
 *  돌려주는 값: 되돌린 메시지 수(0 이면 손댄 것이 없어요 — 꺼짐 · 짧은 채팅 · 이미 되돌린 상태). */
export function coolForRestyle(doc = document) {
    if (!on) return 0;
    const el = doc.getElementById?.('chat');
    if (!el || !lightNow(el)) return 0;
    const busy = !!(warm.job || warm.look || warm.timer);   // 고르는 중 · 푸는 중이었으면 다시 계산이 끝난 뒤 처음부터
    const n = coolOffscreen(doc);
    if (n || busy) kickWarm();
    return n;
}
/** 서랍이 열리면 쉬면서 화면 밖을 되돌리고, 닫히면 다시 미리 그린다 */
export function warmOnDrawers(doc = document) {
    if (!on) return;
    if (doc.querySelector('.drawer-content.openDrawer:not(.pinnedOpen)')) { if (!warm.cool || warm.timer || warm.job || warm.look) coolOffscreen(doc); } else kickWarm();
}
// 답장을 받는 동안: 토큰마다 마지막 메시지가 다시 그려질 때 푼 메시지 전부가 배치 · 층 나누기 · 넘기기에 끼어(폰 4배 스트리밍 50ms 넘는 프레임 3 → 14개)
//   첫 토큰(또는 생성 시작)에 화면 밖을 되돌리고, 토큰이 STREAM_QUIET_MS 끊기거나 생성이 끝나면 다시 쉬는 시간에 푼다. 드라이런(토큰 세기)은 건너뛴다.
//   (실제 생성은 body data-generating 동안 내내 쉬어요 — 토큰 간격은 그 표식이 없는 스트림(확장 · 측정 장면)을 위한 것)
export const STREAM_QUIET_MS = 400;
let warmEvents = null;
// 굴려서 한 번 그려진 메시지(크롬이 건너뛰기를 푼 때 · contentvisibilityautostatechange skipped=false)는 그대로 둔다 — 다시 화면 밖으로 나갔다 돌아올 때
//   배치 · 칠하기를 또 하지 않게(관문 스크롤의 내려오는 길). 쉬는 동안(생성 중 · 서랍)은 달지 않는다.
let revealOn = false;
function onReveal(event) {
    const mes = event.target;
    if (event.skipped || !on || warm.cool || !mes?.classList?.contains('mes') || mes.hasAttribute(WARM_ATTR) || mes.parentElement?.id !== 'chat' || warmPaused()) return;
    mes.setAttribute(WARM_ATTR, '');
}
function listenWarm() {
    if (!revealOn && typeof document.addEventListener === 'function') {
        revealOn = true;
        document.addEventListener('contentvisibilityautostatechange', onReveal, true);
        for (const type of INPUT_GATE_EVENTS) document.addEventListener(type, onInputGate, { capture: true, passive: true });
    }
    if (warmEvents) return;
    try {
        const ctx = globalThis.SillyTavern?.getContext?.(); const es = ctx?.eventSource, T = ctx?.eventTypes || ctx?.event_types;
        if (!es?.on || !T) return;
        warmEvents = es;
        const onToken = () => { if (!on) return; if (!warm.cool) coolOffscreen(); kickWarm(STREAM_QUIET_MS); };
        const onStart = (_type, _opts, dryRun) => { if (!on || dryRun) return; coolOffscreen(); kickWarm(STREAM_QUIET_MS); };
        const onEnd = () => { if (on) kickWarm(); };
        if (T.STREAM_TOKEN_RECEIVED) es.on(T.STREAM_TOKEN_RECEIVED, onToken);
        if (T.GENERATION_STARTED) es.on(T.GENERATION_STARTED, onStart);
        for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'MESSAGE_RECEIVED']) if (T[name]) es.on(T[name], onEnd);
    } catch { }
}
export const _warm = {
    state: () => ({ timer: !!warm.timer, job: !!warm.job, look: !!warm.look, pending: warm.list ? warm.list.length - warm.i : null, k: warm.k, done: warm.done, slices: warm.slices, yielded: warm.yielded, cool: warm.cool, gated: warm.gated, gate: !!warm.gate, parked: warm.parked }),
    stop: stopWarm, step: stepWarm, start: startWarm,
};
// 1.1.4 측정 도구가 묶음(dist) 밖에서 미리 그리기 상태를 읽는 길(감시 허브의 stats() 와 같은 꼴): globalThis[Symbol.for('blue-lemonade.diag.v1')].warm()
try { (globalThis[Symbol.for('blue-lemonade.diag.v1')] ??= {}).warm = () => _warm.state(); } catch { /* 진단용 — 못 걸어도 동작은 같아요 */ }
