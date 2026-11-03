// 8.2.1 테마가 꺼진 동안(「확장만」 · 테마 끔)은 큰 style.css(1.8MB) 대신 가벼운 사본 style-ext.css(약 0.3MB)를 켜요.
// 그 모드에서는 body 에서 salty 를 떼서 style.css 규칙의 9할이 하나도 맞지 않는데, 브라우저는 다시 계산할 때마다 그 규칙들을 견줬어요
// (폰 4배 리그: 부팅 스타일 재계산 순정 0.5초 → 확장만 1.5초 · 300메시지 채팅 열기 0.18 → 0.55초 — 10-29 「확장만인데도 버벅여요」 제보).
// 사본은 빌드(tools/build-css.cjs extText)가 같은 차례로 만든, 그 모드에서 맞을 수 있는 규칙 전부라 화면은 같아요.
// 큰 시트는 지우지 않고 sheet.disabled 로만 꺼요 — src/lite.js 가 계속 그 시트를 찾아 미리보기 · 게으른 칸을 다뤄요. 사본을 못 받으면 큰 시트를 그대로 둬요.
const OWN_SHEET = new URL('../style.css', import.meta.url).href;
const EXT_SHEET = new URL('../style-ext.css', import.meta.url).href;
export const EXT_SHEET_ID = 'salty-ext-css';
let failed = false;
// 전체 교체 시트가 오기 전에는 첫 시트, 온 뒤에는 전체 시트 한 벌만 켜요. 확장만 모드에는 둘 다 꺼요.
const lazyLink = () => document.getElementById('salty-lazy-css');
const fullReady = () => { const l = lazyLink(); return l?.dataset?.blFullTheme === 'ready' && !!l.sheet?.cssRules.length; };
const setLazy = disabled => { const l = lazyLink(); const off = disabled || !fullReady(); if (l?.sheet && l.sheet.disabled !== off) l.sheet.disabled = off; };
// 전체 시트가 준비되면 첫 시트는 메타/99꼬리의 원본으로만 남고 다시 켜지 않아요.
const enableTheme = main => { main.sheet.disabled = fullReady(); setLazy(false); };

/** 실리태번이 manifest 로 붙인 테마 style.css 의 <link> (폴더 이름이 달라도 이 파일 기준 주소가 먼저) */
function mainLink() {
    const links = [...document.querySelectorAll('link[rel~="stylesheet"]')];
    return links.find(l => l.href === OWN_SHEET) || links.find(l => /\/blue-lemonade[^/]*\/style\.css(\?|$)/.test(l.href) && l.id !== EXT_SHEET_ID) || null;
}

/** 테마가 화면에 켜져 있는지에 맞춰 큰 시트 · 가벼운 사본 중 하나만 켜요(applyAll 마다 불려도 바뀐 게 없으면 아무것도 안 해요) */
export function syncThemeSheet(themeOn) {
    const main = mainLink();
    if (!main?.sheet) return;   // 아직 안 붙었으면 다음 applyAll 때
    let ext = document.getElementById(EXT_SHEET_ID);
    if (themeOn || failed) {   // 테마를 켜면 큰 시트를 먼저 켜고 사본을 떼요(사본만 남아 잠깐 빠지는 규칙이 없게)
        enableTheme(main);
        ext?.remove();
        return;
    }
    if (!ext) {
        ext = document.createElement('link');
        ext.id = EXT_SHEET_ID; ext.rel = 'stylesheet'; ext.href = EXT_SHEET;
        // 다 받은 뒤에 큰 시트를 꺼요 — 그 사이엔 둘 다 켜져 있어 화면이 비지 않아요. 큰 시트 바로 뒤라 다른 확장 CSS 와의 차례도 같아요
        ext.addEventListener('load', () => { if (document.getElementById(EXT_SHEET_ID) === ext && ext.sheet?.cssRules?.length) { main.sheet.disabled = true; setLazy(true); } }, { once: true });
        ext.addEventListener('error', () => { if (document.getElementById(EXT_SHEET_ID) !== ext) return; failed = true; ext.remove(); enableTheme(main); console.info('[Blue Lemonade] 가벼운 테마 사본(style-ext.css)을 못 받아 큰 시트를 그대로 써요'); }, { once: true });
        main.after(ext);
        enableTheme(main);   // 사본을 받는 동안 첫 시트 또는 준비된 전체 시트 한 벌만 유지해요.
        return;
    }
    if (ext.sheet?.cssRules?.length && !main.sheet.disabled) main.sheet.disabled = true;
    if (ext.sheet?.cssRules?.length) setLazy(true);   // 둘째 장이 큰 시트를 끈 뒤에 붙었을 수도 있어요
    else enableTheme(main);
}

/** 진단용: 지금 어느 쪽이 켜져 있나 */
export function themeSheetState() {
    const main = mainLink(), ext = document.getElementById(EXT_SHEET_ID);
    const boot = !!main?.sheet && !main.sheet.disabled, full = fullReady() && !lazyLink().sheet.disabled;
    return { main: boot || full, boot, full, ext: !!ext?.sheet && !ext.sheet.disabled, failed };
}
