// 7.7.4 시작 덮개: 실리태번은 처음 불러오는 동안 #preloader 로 화면 전체를 덮고, 다 불러온 뒤(APP_READY 바로 앞) 한 번만 걷는다.
// 덮여 있는 동안은 아무것도 보이지 않는데, 테마가 크기 · 계산 스타일을 재면(getComputedStyle · getClientRects) 그때마다 문서 전체
// 스타일을 그 자리에서 다시 계산했다 — 확장들이 계속 붙는 중이라 같은 계산을 여러 번 (폰 흉내 4배 CPU 부팅에서 강제 계산 수 초).
// 재고 칠하는 일은 덮개가 걷히는 순간 한 번에 한다. 걷히는 것을 MutationObserver 로 보므로 첫 화면을 그리기 전에 끝난다.
// #preloader 가 없는 실리태번(옛 판 · 이미 걷힘)이면 기다리지 않고 바로 한다 — 예전과 같다.
//
// 1.2.2 덮개 동안 붙는 시트 모으기(holdSheet): 덮개 동안 테마가 시트를 따로따로 붙일 때마다(켠 설정 시트 · 채팅 모양 · 과일 글자 꾸미기 · 태그 색 …)
//   그려진 요소 전부가 다시 계산됐어요. 그 시트들은 덮개가 걷힐 때만 맞으면 되니, 꺼 둔 채(media="not all") 붙였다가 걷히는 순간
//   afterBoot 대기자보다 먼저 한 번에 켜요 — 같은 마이크로태스크라 다시 계산은 한 번이에요.
//   · 덮개가 불투명할 때만 꺼 둬요(coverOpaque — apply.js 가 「테마 켬 + 팔레트 바탕이 불투명」일 때 알려요). 확장만 · 테마 끔이면
//     실리태번 기본 덮개(반투명 + 흐림)라 뒤가 비쳐서 꺼 두지 않아요 — 예전과 똑같이 붙어요.
//   · 덮개가 일찍 걷혀도(실리태번 오류 · 다른 확장이 로더를 닫음) 걷히는 순간이 곧 켜는 순간이에요(같은 감시자).
//     덮개가 끝내 안 걷히는 판이 오면 APP_READY 에서 시트만은 켜요(안전망 — 한 번만 듣고 끝나요 · 이 모듈을 처음 읽을 때 걸어요 — hookReady).
//   · 꺼 둔 시트의 media 를 코드가 바꿔야 하면 setSheetMedia 로 — 켤 때 쓸 값만 바꿔요(지금 바로 켜지지 않아요).
//   · 변수 시트(#salty-vars — 새로고침 첫 화면이 팔레트 색을 써요) · 글꼴 선언(#salty-fontfaces — 꺼 두면 글꼴을 안 받아요)은 꺼 두지 않아요.
let waiting = null;
let observer = null;
let held = null;          // Map<시트 요소, 켤 때 되돌릴 media 속성(null = 속성 없음)>
let opaque = false;       // 덮개가 불투명한가 (apply.js coverOpaque)
let readyHooked = false;
let appReady = false;     // APP_READY 를 봤나 — 그 뒤로는 덮개가 남아 있어도 꺼 두지 않아요
const OFF = 'not all';

/** 실리태번이 아직 첫 불러오기 덮개를 쓰고 있나 */
export function booting(doc = globalThis.document) {
    return !!doc?.getElementById?.('preloader');
}

/** 꺼 둔 시트를 한 번에 켜요 — 꺼 둔 뒤 다른 코드가 media 를 직접 바꿨으면 그 값을 그대로 둬요 */
function releaseSheets() {
    const list = held;
    held = null;
    if (!list) return;
    for (const [el, media] of list) {
        try {
            if (el.getAttribute('media') !== OFF) continue;
            if (media == null) el.removeAttribute('media'); else el.setAttribute('media', media);
        } catch (error) { console.error('[Blue Lemonade] 시작 뒤 시트 켜기', error); }
    }
}

function release() {
    if (booting()) return;
    observer?.disconnect();
    observer = null;
    releaseSheets();   // 대기자보다 먼저 — 대기자가 읽는 계산 스타일이 켜진 시트 기준이고, 켜기와 읽기가 다시 계산 한 번으로 묶여요
    const list = waiting ? [...waiting] : [];
    waiting = null;
    for (const fn of list) {
        try { fn(); } catch (error) { console.error('[Blue Lemonade] 시작 뒤 작업', error); }
    }
}

function watchCover() {
    if (observer) return;
    const preloader = document.getElementById('preloader');
    observer = new MutationObserver(release);
    observer.observe(preloader.parentNode || document.documentElement, { childList: true });
}

/**
 * 안전망: 덮개가 걷히지 않은 채 APP_READY 가 오면 시트만은 켜요 (실리태번 판이 덮개를 다르게 다룰 때)
 * 이 모듈을 처음 읽을 때 걸어요(맨 아래) — 실리태번은 확장 모듈을 다 읽은 뒤(activateExtensions 를 기다린 뒤) APP_READY 를 보내요.
 *   예전처럼 첫 holdSheet 때 걸면, 그게 APP_READY 를 보내는 도중(앞 듣는 쪽을 기다리는 사이)일 때 이 듣기는 이번 보내기에 안 끼고(듣는 쪽 목록을 복사해 돌아요)
 *   늦은 듣기 자동 발사 값도 보내기가 끝나야 적혀서(lib/eventemitter.js emit) 영영 안 불렸어요 — 그 뒤 꺼 둔 시트가 안 켜질 수 있었어요.
 * 맥락이 아직 없으면(노드 시험 · 맥락 없는 판) 건 것으로 치지 않고 첫 holdSheet 때 다시 걸어 봐요.
 */
function hookReady() {
    if (readyHooked) return;
    try {
        const { eventSource, event_types } = globalThis.SillyTavern?.getContext?.() || {};
        const name = event_types?.APP_READY;
        if (typeof eventSource?.on !== 'function' || !name) return;
        readyHooked = true;
        const once = () => { eventSource.removeListener?.(name, once); appReady = true; releaseSheets(); };
        eventSource.on(name, once);   // 이미 보낸 뒤면 실리태번이 바로 불러 줘요(늦은 듣기 자동 발사)
    } catch { /* 맥락이 없으면 덮개 감시만 */ }
}

/** 덮개 뒤가 비치지 않나 — apply.js 가 테마를 칠할 때마다 알려요. 비치게 되면 꺼 둔 시트를 바로 켜요 */
export function coverOpaque(on) {
    opaque = !!on;
    if (!opaque) releaseSheets();
}

/**
 * 덮개 동안 붙는 시트를 꺼 둔 채로 두고, 덮개가 걷히는 순간 한 번에 켜요. 덮개가 없거나 비치거나 다른 문서(채팅 iframe)의 시트면 아무것도 안 해요.
 * 붙이기 전 · 뒤 어느 때 불러도 돼요(붙인 뒤면 그 자리에서 꺼요). 돌려주는 값: 꺼 뒀나
 */
export function holdSheet(el) {
    const doc = globalThis.document;
    if (!el || !opaque || appReady || el.ownerDocument !== doc || !booting(doc)) return false;
    if (!held?.has(el)) (held ??= new Map()).set(el, el.getAttribute('media'));
    if (el.getAttribute('media') !== OFF) el.setAttribute('media', OFF);
    watchCover();
    hookReady();
    return true;
}

/** 시트의 media 를 바꿔요 — 꺼 둔 시트면 켤 때 쓸 값만 바꿔요(빈 값 = 속성 없음) */
export function setSheetMedia(el, media) {
    if (!el) return;
    if (held?.has(el)) { held.set(el, media || null); return; }
    if (!media) { if (el.hasAttribute('media')) el.removeAttribute('media'); }
    else if (el.media !== media) el.media = media;
}

/** 코드가 정한 media(꺼 둔 시트면 켤 때 쓸 값) — 꺼 둔 동안에도 「켜져 있어야 하나」를 맞게 견주려고 */
export function sheetMedia(el) {
    if (held?.has(el)) return held.get(el) ?? '';
    return el?.media ?? '';
}

/** 진단 · 시험용: 꺼 둔 시트 수 */
export function heldSheets() { return held ? held.size : 0; }

/** 덮개가 걷힌 뒤 fn 을 한 번 (지금 덮개가 없으면 바로). 같은 함수를 여러 번 넘겨도 한 번만 */
export function afterBoot(fn) {
    if (!booting()) { fn(); return; }
    (waiting ??= new Set()).add(fn);
    watchCover();
}

hookReady();   // 안전망은 모듈을 처음 읽을 때 — APP_READY 를 보내기 전이에요(위 hookReady 설명)
