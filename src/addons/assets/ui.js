// 캐릭터 에셋 — 알림, 확인 창, 입력 창, 복사, 테마 색
import { POPUP_TYPE, POPUP_RESULT, callGenericPopup } from '../../../../../../popup.js';
import { TITLE } from './state.js';

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** @param {'success'|'info'|'warning'|'error'} kind 실리태번의 toastr는 escapeHtml이 켜져 있어 글을 그대로 넘긴다. */
export function toast(kind, message, options = {}) {
    if (typeof toastr === 'undefined') {
        console.log(`[${TITLE}] ${kind}: ${message}`);
        return null;
    }
    return toastr[kind](String(message), TITLE, { escapeHtml: true, ...options });
}

function popupHtml(text) {
    return `<div class="eh-popup-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
}

/** 확인 창. 확인을 누르면 true */
export async function confirmDialog(text, { ok = '확인', cancel = '취소' } = {}) {
    const result = await callGenericPopup(popupHtml(text), POPUP_TYPE.CONFIRM, '', { okButton: ok, cancelButton: cancel });
    return result === POPUP_RESULT.AFFIRMATIVE;
}

/** 한 줄 입력 창. 취소하면 null */
export async function inputDialog(text, value = '', { ok = '확인' } = {}) {
    const result = await callGenericPopup(popupHtml(text), POPUP_TYPE.INPUT, value, { okButton: ok, cancelButton: '취소' });
    return typeof result === 'string' ? result : null;
}

/**
 * 고르기 창: 글 + 고르기 목록. 취소하면 null, 아니면 고른 값
 * @param {string} text
 * @param {{ value: string, label: string }[]} options
 */
export async function pickDialog(text, options, { ok = '확인', value = '' } = {}) {
    const wrap = document.createElement('div');
    wrap.innerHTML = popupHtml(text);
    const select = document.createElement('select');
    select.className = 'text_pole eh-pick';
    for (const option of options) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        node.selected = option.value === value;
        select.append(node);
    }
    wrap.append(select);
    const result = await callGenericPopup(wrap, POPUP_TYPE.CONFIRM, '', { okButton: ok, cancelButton: '취소' });
    return result === POPUP_RESULT.AFFIRMATIVE ? select.value : null;
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // http로 열었거나 권한이 없을 때
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        area.remove();
        return ok;
    }
}

// ── 테마 색 ───────────────────────────────────────────────────

/** #fac679, fac679, #fff, rgb(250, 198, 121) → '#rrggbb' (아니면 null) */
export function parseColorCode(text) {
    const value = String(text ?? '').trim().toLowerCase();
    const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
        const digits = hex[1].length === 3 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1];
        return `#${digits}`;
    }
    const rgb = value.match(/^(?:rgba?\s*\()?\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/\s]\s*[\d.]+%?\s*)?\)?$/);
    if (rgb) {
        const channels = rgb.slice(1, 4).map(Number);
        if (channels.every(channel => channel <= 255)) return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    }
    return null;
}

function luminanceOf(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    return 0.299 * (value >> 16 & 255) + 0.587 * (value >> 8 & 255) + 0.114 * (value & 255);
}

/** 포인트 색 위에 올릴 글자색과 바탕 톤을 확장 뿌리 요소에 적어 둔다. */
export function applyThemeVars(root) {
    const style = getComputedStyle(document.documentElement);
    const accent = parseColorCode(style.getPropertyValue('--SmartThemeQuoteColor')) ?? '#a98bd9';
    const text = parseColorCode(style.getPropertyValue('--SmartThemeBodyColor')) ?? '#cccccc';
    root.style.setProperty('--eh-accent-ink', luminanceOf(accent) > 160 ? '#1b1820' : '#ffffff');
    // 글자색이 밝으면 어두운 테마
    root.dataset.ehTone = luminanceOf(text) > 128 ? 'dark' : 'light';
}

let themeTimer = 0;

/**
 * 떠 있는 모든 확장 화면(패널, 크게 보기)의 테마 색을 다시 계산한다.
 * requestAnimationFrame 대신 타이머를 쓴다: 화면에 안 보이는 탭에서는 프레임이 돌지 않아 계산이 영영 밀린다.
 */
export function refreshThemeVars() {
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => {
        document.querySelectorAll('.eh-root').forEach(applyThemeVars);
    }, 60);
}

/**
 * 테마 색이 바뀌는 곳을 모두 지켜본다.
 * - 실리태번 테마: <html style>의 --SmartTheme* 변수
 * - 블루 레몬에이드: <head>의 <style id="salty-vars"> 글자 (html style 속성이 아님) · 켜고 끄면 body 클래스
 * 패널이 먼저 만들어지고 테마가 나중에 적용되기 때문에(불러오는 순서) 이것 없이는 첫 계산에 머문다.
 * applyThemeVars는 .eh-root에만 쓰므로 여기로 다시 들어오지 않는다.
 */
export function watchThemeVars() {
    const observer = new MutationObserver(refreshThemeVars);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    refreshThemeVars();
}
