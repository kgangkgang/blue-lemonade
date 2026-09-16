// 글자색 톤 맞추기 (2.6.0) — 메시지 안에 적힌 글자색(<font color> · style="color") 의 색상(hue)은 두고
// 채도 · 밝기만 테마에 맞춘다. 사용자: "애들 퍼스널 컬러 정규식 색깔이 들쭉날쭉 — 채도 · 명도는 똑같고 색깔만 다르게".
//
// CSS 는 색에서 색상만 뽑아낼 수 없으니 여기서 잰다: 요소의 색을 rgb 로 읽어 HSL 로 바꾸고 --bl-hue 만 요소에 심는다.
// 실제 색은 style.css 가 hsl(var(--bl-hue) var(--bl-tone-s) var(--bl-tone-l)) 로 그린다 — 채도 · 밝기는 라이트/나이트마다
// CSS 값이라 팔레트를 바꿔도 다시 잴 필요가 없다. 회색끼(채도 낮음)는 색상이 뜻이 없으니 테마 글자색으로 (--bl-hue 없음 · bl-tone-grey).
// 켜짐 여부는 body.salty-tone (apply.js) — 꺼져 있으면 아무것도 안 잰다. 본문 색 지정(unifyInline)이 켜져 있으면 그쪽이 이긴다.
import { getSettings } from './settings.js';

const SEL = '.mes_text font[color], .mes_text [style*="color"]';
const GREY = 0.14; // 이 아래 채도는 회색으로 침
let probe = null;  // 이름 색(darkred 같은 것) · 온갖 표기를 브라우저에게 rgb 로 바꾸게 하는 숨은 요소
let timer = null;

function enabled() {
    const s = getSettings();
    return s.enabled && s.chat?.toneInline && !s.chat?.unifyInline;
}

function toRgb(value) {
    if (!value) return null;
    if (!probe) {
        probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
        document.body.append(probe);
    }
    probe.style.color = '';
    probe.style.color = value;
    if (!probe.style.color) return null; // 브라우저가 못 읽는 값
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(getComputedStyle(probe).color);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function hueSat([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = Math.round(h * 60); if (h < 0) h += 360;
    }
    return { h, s };
}

function sourceColor(el) {
    // <font color="…"> 가 우선, 아니면 style 의 color (이미 우리가 심은 --bl-hue 는 건너뜀)
    const attr = el.getAttribute('color');
    if (attr) return attr;
    const m = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(el.getAttribute('style') || '');
    return m ? m[1].trim() : '';
}

// 같은 색 표기는 같은 결과 — 퍼스널 컬러는 메시지마다 되풀이되니 한 번만 잰다
const measured = new Map(); // src → { h, s } | null
function hueOf(src) {
    if (measured.has(src)) return measured.get(src);
    const rgb = toRgb(src);
    const hs = rgb ? hueSat(rgb) : null;
    // var(--…) · currentColor 같은 것은 테마를 바꾸면 달라지니 기억하지 않음
    if (!/var\(|currentcolor|inherit|initial|unset|revert/i.test(src)) {
        if (measured.size > 300) measured.clear();
        measured.set(src, hs);
    }
    return hs;
}

/** 채팅(· 북마크 창) 안의 색 글자를 전부 잰다 — 새 메시지 · 다시 그린 메시지만 실제로 계산(같은 색은 건너뜀) */
// 2.9.2: 예전에는 글자 하나마다 [잰다(getComputedStyle) → --bl-hue 를 쓴다] 를 번갈아 해서, 쓸 때마다 다음 재기가
// 스타일 재계산을 강제했다 — 답변이 끝날 때 색 글자 8개에 45ms (PC, 글자당 6ms). 이제 전부 잰 다음 한꺼번에 쓴다
export function retoneAll() {
    if (!enabled()) return;
    const todo = [];
    // 설정창의 정규식 카드 미리보기(.salty-preview)도 — 슬라이더를 밀 때 그 자리에서 보이게
    for (const root of document.querySelectorAll('#chat, .cg-root, .salty-preview')) {
        for (const el of root.querySelectorAll(SEL)) {
            const src = sourceColor(el);
            if (!src || el.dataset.blToned === src) continue;
            todo.push([el, src, hueOf(src)]); // 읽기만
        }
    }
    for (const [el, src, hs] of todo) { // 쓰기만
        el.dataset.blToned = src;
        if (!hs) continue;
        if (hs.s < GREY) { el.classList.add('bl-tone-grey'); el.style.removeProperty('--bl-hue'); }
        else { el.classList.remove('bl-tone-grey'); el.style.setProperty('--bl-hue', String(hs.h)); }
    }
}

export function startInlineTone() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    retoneAll();
    // 답변이 한 글자씩 자랄 때마다 도는 것을 막으려 0.4초 묶음 — 스트리밍 중엔 마지막 메시지만 늦게 칠해진다
    new MutationObserver(() => {
        // 답변이 자라는 동안 조각마다 불린다 — 설정을 다시 읽지 않고 apply.js 가 붙인 body.salty-tone 으로 (켜짐 조건이 같음, 2.9.2)
        if (!document.body.classList.contains('salty-tone')) return;
        clearTimeout(timer);
        timer = setTimeout(retoneAll, 400);
    }).observe(chat, { childList: true, subtree: true });
}
