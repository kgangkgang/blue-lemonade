// 블루 레몬에이드 레몬 — 테마가 실리태번 안(✦ 메뉴 · 확장 서랍 · 설정 창 머리 · 탭 아이콘)에서 쓰는 레몬 그림 하나(lemon.svg)를
// 사이트 모든 곳이 같이 써요. 글자 줄에 들어가는 레몬(🍋)도 이 그림으로 바꿔 글자 크기에 맞춰 넣어요(.bl-lemon — site.css).
// 자료(글꾸 목록 emoji · 테마로 보내는 .bl-mart.json)의 🍋 는 그대로 두고, 화면에 그릴 때만 바꿔요.
export const LEMON = '🍋';
export const LEMON_SRC = new URL('../lemon.svg?v=20261109a', import.meta.url).href;
export const lemonHtml = (cls = '') => `<img class="bl-lemon${cls ? ' ' + cls : ''}" src="${LEMON_SRC}" alt="" aria-hidden="true" decoding="async">`;
/** 이미 이스케이프한 HTML 속 🍋 를 레몬 그림으로 */
export const lemonize = html => String(html).split(LEMON).join(lemonHtml());
/** textContent 처럼 글자를 넣되 🍋 만 레몬 그림으로(글은 글 그대로라 안전해요) */
export function setLemonText(el, text) {
    const parts = String(text).split(LEMON);
    el.replaceChildren(...parts.flatMap((s, i) => {
        const out = [];
        if (i) { const img = document.createElement('img'); Object.assign(img, { className: 'bl-lemon', src: LEMON_SRC, alt: '', decoding: 'async' }); img.setAttribute('aria-hidden', 'true'); out.push(img); }
        if (s) out.push(document.createTextNode(s));
        return out;
    }));
}
