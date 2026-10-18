// 7.2.1 테마가 빠져 있을 때(확장만 · 테마 끔) 실리태번 서랍 · 위 막대 · 입력줄이 비쳐 글자가 겹치지 않게.
// 실리태번 테마의 판 색(--SmartThemeBlurTintColor)이 반투명인데 흐림이 꺼져 있으면(빠른 UI · 흐림 0 — '실리태번 설정 맞추기'가 남긴 값일 때가 많다)
// 서랍 글자가 뒤 채팅 글자 위에 그대로 겹친다 (제보: "확장만으로 하니까 메뉴 화면이랑 챗 화면의 밑배경이 아예 없어져").
// 그때만 같은 색을 불투명하게 칠한다 — 색은 실리태번 테마 그대로, 흐림이 켜져 있거나 이미 불투명하면 아무것도 안 한다.
// 7.2.2 채팅 칸: 채팅 바탕이 거의 투명한데 그게 '맞추기'가 넣은 값일 때만(sttheme.js restoreState) 같은 불투명 판을 깐다.
// 사용자가 직접 고른 투명 채팅(맞추기 흔적이 없음)은 건드리지 않고, 실리태번 값 자체도 바꾸지 않는다 (되돌리기는 기존 알림 · 설정에서).
// 테마가 켜져 있으면(body.salty) 테마가 판을 칠하므로 둘 다 뗀다.
import { parseColor } from './palettes.js';

const CLASS = 'bl-st-solid', CHAT = 'bl-st-solid-chat';
let started = false, soon = () => {};
// 맞추기 흔적 판정 (sttheme.js 는 채팅 바탕이 투명할 때만 처음 받는다): undefined = 아직 안 받음 · null = 받는 중 · 함수
let restoreState;

function leftover() {
    if (restoreState === undefined) {
        restoreState = null;
        import('./sttheme.js').then(m => { restoreState = m.restoreState; }).catch(error => { console.warn('[Blue Lemonade] 맞추기 흔적 확인', error); restoreState = () => null; }).finally(() => soon());
    }
    if (typeof restoreState !== 'function') return false;
    try { return !!restoreState(); } catch { return false; }
}

function sync() {
    const root = document.documentElement, body = document.body;
    if (!body) return;
    const css = getComputedStyle(root);
    const off = !body.classList.contains('salty');
    const raw = css.getPropertyValue('--SmartThemeBlurTintColor').trim().toLowerCase();
    // 비었거나 transparent 면 색이 없다 — 실리태번 글자색이 어두우면 밝은 판, 밝으면 실리태번 기본 어두운 판
    let [r, g, b, a] = !raw || raw === 'transparent' ? [0, 0, 0, 0] : parseColor(raw);
    if (a < 0.05) {
        const [tr, tg, tb] = parseColor(css.getPropertyValue('--SmartThemeBodyColor').trim() || '#dcdcd2');
        [r, g, b] = (0.299 * tr + 0.587 * tg + 0.114 * tb) > 128 ? [23, 23, 23] : [250, 250, 250];
    }
    // 흐림 세기 변수는 calc(…) 로 계산돼 숫자로 못 읽는다 — 서랍 판에 실제로 걸린 backdrop-filter 로 본다
    const drawer = document.querySelector('#top-settings-holder .drawer-content');
    const filter = drawer ? getComputedStyle(drawer).backdropFilter : 'none';
    const noBlur = body.classList.contains('no-blur') || !filter || filter === 'none' || /blur\(0(px)?\)/.test(filter);
    const valid = [r, g, b].every(Number.isFinite);
    const want = off && noBlur && a < 0.97 && valid;
    const chatRaw = css.getPropertyValue('--SmartThemeChatTintColor').trim().toLowerCase();
    const chatAlpha = !chatRaw || chatRaw === 'transparent' ? 0 : parseColor(chatRaw)[3];
    const chat = off && valid && chatAlpha < 0.5 && leftover();
    const color = want || chat ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})` : '';
    if (root.style.getPropertyValue('--bl-st-solid-tint') !== color) {
        if (color) root.style.setProperty('--bl-st-solid-tint', color); else root.style.removeProperty('--bl-st-solid-tint');
    }
    if (root.classList.contains(CLASS) !== want) root.classList.toggle(CLASS, want);
    if (root.classList.contains(CHAT) !== chat) root.classList.toggle(CHAT, chat);
}

export function startStSolid() {
    if (started) return;
    started = true;
    let pending = 0;
    soon = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; sync(); }); };
    // 실리태번은 테마 색을 html 의 인라인 style 로, 빠른 UI 를 body 클래스로 바꾼다 — 그 둘만 본다 (내가 쓰는 변수 하나는 값이 같으면 다시 안 쓴다)
    new MutationObserver(soon).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // 되돌리기 · 테마 고르기는 실리태번 설정 저장으로 끝난다 — 색이 같아도(맞추기 흔적만 사라져도) 다시 본다
    try { const { eventSource, event_types } = SillyTavern.getContext(); if (event_types?.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, soon); } catch { /* 이벤트를 못 걸면 관찰만 */ }
    sync();
}
