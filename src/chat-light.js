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
    kickWarm();   // (10-30 perf-chatlight) 쉴 때 미리 그리기 — 아래
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') syncChatCover(on);   // 같은 설정(긴 채팅 가볍게) — 아래 서랍 덮개
    if (!on) { mo?.disconnect(); mo = null; if (chat && document.documentElement.classList.contains(CLASS)) document.documentElement.classList.remove(CLASS); chat = null; return; }
    const el = document.getElementById('chat');
    if (!el) { mo?.disconnect(); mo = null; chat = null; return; }
    if (el !== chat) {
        mo?.disconnect();
        chat = el;
        mo = new MutationObserver(() => { measure(); kickWarm(); });
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
        warmOnDrawers();   // (10-30 perf-chatlight) 서랍이 열리면 미리 그리기를 쉬고 화면 밖을 되돌려요
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

// ---------------------------------------------------------------- (10-30 perf-chatlight) 쉴 때 화면 밖 메시지를 미리 그려 두기
// 왜: 성능 관문 스크롤(150개 메시지를 1초에 맨 위까지 올렸다 내림 · 폰 4배)에서 50ms 넘는 프레임이 끄면 3개 · 켜면 33~34개였어요. 프로파일:
//   content-visibility:auto 로 건너뛴 메시지는 화면에 들어오는 그 프레임에 스타일(메시지 하나 약 16ms) · 배치 · 칠하기 · 그림 칠하기를 해요(프레임마다 새 메시지 5개 남짓 → 80~200ms).
//   한 번 그린 메시지도 다시 화면 밖으로 나가면 건너뛰어, 돌아올 때 배치 · 칠하기를 또 해서 내려오는 길도 느렸어요.
//   스크롤 전에 그 자리에서 강제로 재 두기(getBoundingClientRect)는 스타일만 남고 배치 · 칠하기는 그대로라 30개였어요 — 건너뛰기를 풀어야 해요.
// 어떻게: 채팅이 조용해지면(메시지가 들고 난 뒤 WARM_QUIET_MS) 낮은 우선순위 작업으로 지금 보는 자리에 가까운 메시지부터 data-bl-warm 을 달아
//   건너뛰기를 풀고(css/05-chat.css) 그 자리에서 배치까지 끝내요 — 한 조각 WARM_SLICE_MS 안에서 몇 개씩 묶어(비용을 재 가며). 다 풀면 끈 것과 같은 스크롤이고,
//   여는 순간(긴 채팅 열기)은 예전처럼 화면 밖을 건너뛰어 빨라요(그 일을 쉬는 시간으로 옮길 뿐 · 모양은 같아요).
//   생성 중(body data-generating) · 답장 토큰이 오는 동안 · 서랍이 열린 동안(고정 서랍 빼고)은 쉬고, 그때 푼 메시지를 다시 건너뛰게 돌려놔요 —
//   페르소나 설명 타이핑처럼 서랍 안 일마다 메시지 전체가 다시 계산되던 것(이 모듈의 원래 이유)을 그대로 막아요. 닫히면 다시 쉬는 시간에 풀어요.
//   표식은 class 가 아니라 data 속성 — 실리태번 keyboard.js 감시자(class 만 봐요)와 네모 단추 감시(class · style …)가 메시지마다 다시 훑지 않게.
//   건너뛰는지는 계산된 content-visibility 로 봐요(표식이 #chat · html 어디에 붙든 · 바닥 10개 · 마지막 · 메뉴 열린 메시지는 처음부터 안 건너뛰어 고르지 않아요).
export const WARM_ATTR = 'data-bl-warm';
export const WARM_QUIET_MS = 500;
const WARM_RETRY_MS = 1000;   // 쉬는 조건(생성 중 · 서랍)이 풀렸는지 다시 볼 간격
let warm = { timer: 0, job: 0, list: null, i: 0, k: 4, done: 0, slices: 0, cool: false };
// 한 조각의 목표 시간(묶음 크기를 이것에 맞춰요). requestIdleCallback 은 화면이 계속 그려지는 동안(애니메이션 · rAF 고리) 프레임 사이 몇 ms 만 줘서, 메시지 하나(고정 몫 약 20ms)도 못 들어가
//   리그에서 300개에 1분 넘게 걸렸어요. 그래서 낮은 우선순위 작업(scheduler.postTask background — 입력 · 그리기 · 보통 작업이 먼저)으로 한 묶음씩 하고 비켜요.
export const WARM_SLICE_MS = 50;
export const WARM_BATCH_MAX = 12;   // 깨끗한 메시지(하나 1ms 남짓)로 키운 묶음이 처음 그리는 메시지(하나 4ms 안팎)를 만나도 한 조각이 너무 길지 않게
const bgTask = fn => {
    if (typeof scheduler !== 'undefined' && typeof scheduler?.postTask === 'function' && typeof AbortController === 'function') {
        const ctl = new AbortController(); scheduler.postTask(fn, { priority: 'background', signal: ctl.signal }).catch(() => { }); return ctl;
    }
    return setTimeout(fn, 16);
};
const cancelBg = job => { if (!job) return; if (typeof job.abort === 'function') job.abort(); else clearTimeout(job); };
function stopWarm() { clearTimeout(warm.timer); cancelBg(warm.job); warm.timer = 0; warm.job = 0; warm.list = null; warm.i = 0; }
/** 미리 그리기를 쉬어야 하나 — 꺼짐 · 생성 중 · (고정 아닌) 서랍이 열림 */
export function warmPaused(doc = document) {
    if (!on) return true;
    if (doc.body?.dataset?.generating === 'true') return true;
    return !!doc.querySelector?.('.drawer-content.openDrawer:not(.pinnedOpen)');
}
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
    warm.job = bgTask(stepWarm);
}
/** 지금 건너뛰는(content-visibility:auto) 메시지를 보는 자리에서 가까운 차례로 */
export function warmCandidates(el, win = window) {
    const out = [];
    for (const mes of el.querySelectorAll(':scope > .mes:not([' + WARM_ATTR + '])')) if (win.getComputedStyle(mes).contentVisibility === 'auto') out.push(mes);
    if (out.length < 2) return out;
    const box = el.getBoundingClientRect(); const mid = box.top + box.height / 2;
    const dist = new Map(out.map(mes => { const r = mes.getBoundingClientRect(); return [mes, Math.abs(r.top + r.height / 2 - mid)]; }));
    return out.sort((a, b) => dist.get(a) - dist.get(b));
}
// 크롬은 content-visibility 가 auto → visible 로 바뀌어 건너뛰기가 풀릴 때 contentvisibilityautostatechange 를 내지 않아요(리그 확인).
//   네모 단추 감시(squared-buttons.js)는 그 사건(skipped=false)을 받아 건너뛰어 둔 메시지 안 단추를 재므로, 풀어 준 메시지마다 같은 꼴로 알려 줘요.
function announce(mes) {
    try {
        const E = typeof ContentVisibilityAutoStateChangeEvent === 'function' ? ContentVisibilityAutoStateChangeEvent : Event;
        const ev = new E('contentvisibilityautostatechange', { skipped: false });
        if (!('skipped' in ev)) Object.defineProperty(ev, 'skipped', { value: false });
        mes.dispatchEvent(ev);
    } catch { }
}
function stepWarm() {
    warm.job = 0; warm.slices++;
    if (warmPaused()) { warm.list = null; warm.timer = setTimeout(startWarm, WARM_RETRY_MS); return; }
    const el = document.getElementById('chat');
    if (!el) return;
    if (!warm.list) { warm.list = warmCandidates(el); warm.i = 0; }
    // 한 조각에 한 묶음 — 잴 때마다(스타일 · 배치 한 번) 메시지 수와 상관없는 고정 몫이 있어서(폰 4배 스타일 약 12ms · #chat 배치 약 7ms)
    //   하나씩 재면 메시지마다 그 몫을 또 냈어요(하나 20~25ms · 10개 30~44ms). 묶음 크기는 지난 조각 시간으로 맞춘다:
    //   WARM_SLICE_MS 의 0.6 배보다 빨랐으면 두 배, 1.5 배를 넘었으면 절반(스타일이 깨끗한 메시지는 싸고 처음 그리는 메시지는 비싸서 그때그때 달라요 ·
    //   바쁠 때 한두 번 튄 시간으로 묶음이 하나까지 줄면 고정 몫만 내다 끝나서 — 리그: 타이핑 동안 38조각에 98개 — 넉넉히 봐요).
    const picked = [];
    while (warm.i < warm.list.length && picked.length < warm.k) {
        const mes = warm.list[warm.i++];
        if (mes.isConnected && !mes.hasAttribute(WARM_ATTR) && mes.parentElement === el) picked.push(mes);
    }
    if (picked.length) {
        const t = performance.now();
        for (const mes of picked) mes.setAttribute(WARM_ATTR, '');
        warm.cool = false;
        void el.offsetHeight;   // 건너뛰기가 풀린 안쪽 스타일 · 배치를 지금(낮은 우선순위 작업 안에서) 끝낸다
        const spent = performance.now() - t;
        if (picked.length === warm.k && spent < WARM_SLICE_MS * 0.6) warm.k = Math.min(warm.k * 2, WARM_BATCH_MAX);
        else if (spent > WARM_SLICE_MS * 1.5) warm.k = Math.max(1, warm.k >> 1);
        warm.done += picked.length;
        for (const mes of picked) announce(mes);
    }
    if (warm.i < warm.list.length) warm.job = bgTask(stepWarm);
    else warm.list = null;
}
/** 푼 메시지를 다시 건너뛸 수 있게 돌려놓는다 — 서랍이 열릴 때 · 답장을 받기 시작할 때.
 *  표식을 모두 떼도 보이는 메시지는 content-visibility:auto 라 그대로 그려지고(화면 밖 것만 건너뜀), 자리를 재지 않는다 —
 *  서랍이 열리는 순간 · 토큰이 막 바뀐 순간에 재면 그때 더러워진 스타일 · 배치를 푼 메시지 전부와 함께 강제로 계산해 버린다. */
export function coolOffscreen(doc = document) {
    stopWarm(); warm.cool = true;
    const el = doc.getElementById('chat');
    const warmed = el ? el.querySelectorAll(':scope > .mes[' + WARM_ATTR + ']') : [];
    for (const mes of warmed) mes.removeAttribute(WARM_ATTR);
    return warmed.length;
}
/** 서랍이 열리면 쉬면서 화면 밖을 되돌리고, 닫히면 다시 미리 그린다 */
export function warmOnDrawers(doc = document) {
    if (!on) return;
    if (doc.querySelector('.drawer-content.openDrawer:not(.pinnedOpen)')) { if (!warm.cool || warm.timer || warm.job) coolOffscreen(doc); } else kickWarm();
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
    if (!revealOn && typeof document.addEventListener === 'function') { revealOn = true; document.addEventListener('contentvisibilityautostatechange', onReveal, true); }
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
export const _warm = { state: () => ({ timer: !!warm.timer, job: !!warm.job, pending: warm.list ? warm.list.length - warm.i : null, k: warm.k, done: warm.done, slices: warm.slices, cool: warm.cool }), stop: stopWarm, step: stepWarm, start: startWarm };
