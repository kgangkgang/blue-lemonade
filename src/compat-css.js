// 1.0.0 크로미움 밖 브라우저 · 다른 화면 폭 규칙 붙이기 — src/lite.js loadCompatCss 가 조건이 맞을 때만 이 모듈을 받아 불러요.
//
// 9.0.0(eb94ccbb) · 9.0.1(3a88fb33) 경량화는 내 기기(안드로이드 크롬 · PC 엣지/크롬, 폰 384 · PC 1280)에서 안 쓰는 규칙을 지웠어요.
// 공개판은 다른 브라우저 · 다른 폭도 쓰니 css/ 모듈에 되살렸고, 빌드(tools/css-compat.cjs)가 그 규칙을 첫 시트(style.css) 밖 두 장으로 떼요.
//   · src/compat-browser.gen.css — 겉 조건이 `@supports not …`(:has · subgrid · 컨테이너 · scrollbar-gutter · font-synthesis · mask-clip 없는 엔진) ·
//     `@media (forced-colors: active)` 이거나, 선택자에 -moz- 이름 · .bl-apple-webkit 이 든 규칙.
//     붙는 때: 그 @supports not 조건 중 하나라도 참(옛 엔진) · 게코(-moz-appearance 지원) · 애플 웹킷(사파리 · iOS 의 모든 브라우저) · 강제 색이 켜짐(나중에 켜져도).
//     크롬 최신은 http 로 연 실리태번(보안 문맥 아님)에서 navigator.userAgentData 가 없어서 브라우저 이름 대신 기능으로 봐요.
//   · src/compat-width.gen.css — 겉 @media 가 폰(384 · 손가락)과 PC(1280 · 마우스) 둘 다에서 거짓인 규칙(380 · 360 이하 폭, 1000 이하 + 마우스 …).
//     붙는 때: style.css 첫 :root 의 --bl-compat-media 조건 중 하나라도 맞을 때 — 창 크기가 바뀌어 맞게 되면 그때. 한 번 붙이면 그대로 둬요
//     (규칙마다 제 @media 가 있어 안 맞는 폭에서는 아무것도 안 바뀌어요).
// 중간 폭(440~760 · 900)의 중단점은 9.0.1 이 폰 · PC 머리로 바꿨던 것을 style.css 안에서 원래 값으로 되돌렸어요(폰 384 · PC 1280 결과는 같음).
// 떼어 낸 규칙은 테마 시트 뒤에 붙어 원래 자리보다 늦게 와요 — 크로미움 최신 · 폰 384 · PC 1280 에서는 어차피 안 맞아 결과가 같아요.
const URLS = { browser: new URL('./compat-browser.gen.css', import.meta.url).href, width: new URL('./compat-width.gen.css', import.meta.url).href };
const OWN_SHEET = new URL('../style.css', import.meta.url).href;

/** 사파리 · iOS 의 모든 브라우저(웹킷) — css/37-prompt-ink.css 의 여러 줄 인라인 마스크 우회 표시 (5.3.2) */
export function isAppleWebkit(nav) {
    const ua = nav?.userAgent || '';
    return /iP(hone|ad|od)/.test(ua) || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1) || (/Safari\//.test(ua) && /Macintosh/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua));
}

/** 1.4.x 사파리 호환: @container style(--사용자 속성) 를 모르는 엔진(사파리 · iOS 18 앞 · 파이어폭스)인가 — 작은 표본 하나로 한 번 재요.
 *  모르면 html 에 bl-no-sq 를 달아 브라우저 호환 시트의 옛 꼴 규칙(체크박스 · 몇 곳)이 대신 먹게 해요. 잴 수 없는 곳(시험의 가짜 문서)은 「안다」로 봐요 */
export function lacksStyleQueries(win) {
    const doc = win?.document;
    if (!doc?.body || typeof win.getComputedStyle !== 'function') return false;
    let host = null, sheet = null;
    try {
        sheet = doc.createElement('style');
        sheet.textContent = '@container style(--bl-sq-probe: 1) { .bl-sq-probe > i { --bl-sq-ok: 1; } }';
        host = doc.createElement('div');
        host.className = 'bl-sq-probe';
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;--bl-sq-probe:1';
        host.append(doc.createElement('i'));
        doc.head.append(sheet);
        doc.body.append(host);
        return win.getComputedStyle(host.firstChild).getPropertyValue('--bl-sq-ok').trim() !== '1';
    } catch {
        return false;
    } finally {
        try { host?.remove(); sheet?.remove(); } catch { /* 그대로 */ }
    }
}

function themeLink(doc) {
    for (const sheet of doc.styleSheets) if (sheet.href && (sheet.href === OWN_SHEET || /\/blue-lemonade\/style\.css/.test(sheet.href)) && sheet.ownerNode?.isConnected) return sheet.ownerNode;
    return null;
}

/** what = 'browser' | 'width' — 이미 붙어 있으면 그대로. 붙인 <link> (테마 시트가 없으면 null) */
export function attachCompat(what, win = window) {
    const doc = win.document;
    if (!URLS[what]) return null;
    if (what === 'browser' && isAppleWebkit(win.navigator)) doc.documentElement.classList.add('bl-apple-webkit');
    const id = `salty-compat-${what}`;
    const have = doc.getElementById(id);
    if (have?.isConnected) return have;
    if (what === 'browser' && lacksStyleQueries(win)) doc.documentElement.classList.add('bl-no-sq');
    const theme = themeLink(doc);
    if (!theme) return null;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = id;
    link.href = URLS[what];
    link.addEventListener('error', () => { console.info(`[Blue Lemonade] ${id} 를 못 받았어요 — 새로고침하면 다시 받아요`); link.remove(); }, { once: true });
    // 전체 교체 시트가 먼저 왔어도 그 뒤에 붙여요. 나중에 화면 폭/브라우저 조건이 맞을 때도
    // 첫 시트 → 전체 시트 → 브라우저 → 폭 순서를 유지해 전체 규칙이 호환 규칙을 다시 덮지 않아요.
    // 1.1.6 테마 시트 뒤 줄(가벼운 사본 · 전체 시트 · 뗀 규칙 시트 data-bl-gate) 끝 뒤 — src/lite.js themeRunEnd 와 같은 줄이에요(이 모듈은 lite.js 를 부르지 않아요)
    const full = doc.getElementById('salty-lazy-css');
    let base = full?.isConnected ? full : theme;
    for (let n = base.nextElementSibling; n && (n.id === 'salty-lazy-css' || n.id === 'salty-ext-css' || n.dataset?.blGate != null); n = n.nextElementSibling) base = n;
    const browser = doc.getElementById('salty-compat-browser');
    if (what === 'width' && browser?.isConnected) browser.after(link);
    else if (what === 'browser' && doc.getElementById('salty-compat-width')?.isConnected) doc.getElementById('salty-compat-width').before(link);
    else base.after(link);
    return link;
}
