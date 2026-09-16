// 실리태번 설정 맞추기 (2.9.0)
//
// 블루 레몬에이드는 --SmartTheme* 변수를 직접 칠하지만, 실리태번 자체의 "사용자 설정" 값
// (말풍선 모양 · 아바타 · 흐림 · 그림자 · 글자 크기)은 건드리지 않는다.
// 기본값(Azure)을 그대로 둔 기기에서는 색만 에이드고 레이아웃은 기본이라 어긋나 보인다.
// 이 파일은 그 값들을 지금 팔레트에 맞춰 한 번에 맞춰 주고, 같은 값을 실리태번 테마로도 저장한다.
import { power_user, applyPowerUserSettings } from '../../../../power-user.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { getRequestHeaders } from '../../../../../script.js';
import { PALETTES } from './palettes.js';
import { getSettings } from './settings.js';

/** 팔레트 색을 실리태번이 쓰는 rgba 문자열로 */
function toRgba(color, alpha = 1) {
    const hex = String(color ?? '').trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
    if (m) {
        const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
        const n = parseInt(h, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }
    if (/^rgba?\(/i.test(hex)) return hex;
    return `rgba(0, 0, 0, ${alpha})`;
}

/**
 * 블루 레몬에이드가 기대하는 실리태번 값.
 * 색은 지금 팔레트에서, 나머지는 이 확장이 스스로 그리는 것과 겹치지 않게 끄는 쪽으로 맞춘다.
 */
export function themeValues() {
    const s = getSettings();
    const pal = { ...(PALETTES[s.palette] || PALETTES.night), ...(s.colorOverrides?.[s.palette] || {}) };
    return {
        // ── 색: 확장이 칠하는 것과 같은 값을 실리태번 쪽에도 적어 둔다 (색 고르개·내보내기와 어긋나지 않게)
        main_text_color: toRgba(pal.text),
        italics_text_color: toRgba(pal.em),
        underline_text_color: toRgba(pal.accent),
        quote_text_color: toRgba(pal.accent),
        blur_tint_color: toRgba(pal.surface),
        chat_tint_color: 'rgba(0, 0, 0, 0)',
        user_mes_blur_tint_color: toRgba(pal.raised),
        bot_mes_blur_tint_color: 'rgba(0, 0, 0, 0)',
        shadow_color: 'rgba(0, 0, 0, 0)',
        border_color: 'rgba(0, 0, 0, 0)',
        // ── 레이아웃: 확장이 직접 그리니 실리태번 쪽 효과는 끈다
        blur_strength: 0,     // 뒤 비침 흐림 — 폰에서 색이 번져 보인다
        shadow_width: 0,      // 글자 그림자 — 본문 가독성을 해친다
        noShadows: true,      // 칸 그림자
        fast_ui_mode: true,   // 흐림 대신 단색 (폰에서 눈에 띄게 가볍다)
        chat_display: 0,      // 납작하게 — 말풍선/문서 모드는 확장의 칸 디자인과 겹친다
        font_scale: 1,        // 글자 크기는 확장의 '글자' 탭에서 정한다
        reduced_motion: true,
        compact_input_area: true,
    };
}

/** 지금 팔레트로 실리태번 설정을 맞춘다. 바꾼 항목 수를 돌려준다 */
export function applySillyTavernTheme() {
    const values = themeValues();
    let changed = 0;
    for (const [key, value] of Object.entries(values)) {
        if (power_user[key] === value) continue;
        power_user[key] = value;
        changed++;
    }
    syncControls(values);
    applyPowerUserSettings();
    saveSettingsDebounced();
    return changed;
}

/** 설정 화면의 체크상자·슬라이더도 새 값으로 보이게 한다 (applyPowerUserSettings 는 화면만 칠한다) */
function syncControls(values) {
    const setChecked = (id, on) => { const el = document.getElementById(id); if (el) el.checked = !!on; };
    const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = String(value); };
    setChecked('fast_ui_mode', values.fast_ui_mode);
    setChecked('noShadows', values.noShadows);
    setChecked('reduced_motion', values.reduced_motion);
    setChecked('compact_input_area', values.compact_input_area);
    setValue('blur_strength', values.blur_strength);
    setValue('shadow_width', values.shadow_width);
    setValue('font_scale', values.font_scale);
    const display = document.getElementById('chat_display');
    if (display) display.value = String(values.chat_display);
    for (const [id, value] of [['blur_strength_counter', values.blur_strength], ['shadow_width_counter', values.shadow_width], ['font_scale_counter', values.font_scale]]) {
        const el = document.getElementById(id);
        if (el) el.value = String(value);
    }
}

/**
 * 같은 값을 실리태번 테마 파일로도 저장한다 — 다른 기기에서 테마 목록으로 골라 쓸 수 있다.
 * 실리태번의 테마 저장 함수는 내보내지 않으므로 서버 API 를 그대로 쓴다.
 */
export async function saveAsSillyTavernTheme(name) {
    const values = themeValues();
    const theme = {
        name,
        ...values,
        // 실리태번 테마가 담는 나머지 값은 지금 상태를 그대로 넣는다
        waifuMode: power_user.waifuMode,
        avatar_style: power_user.avatar_style,
        toastr_position: power_user.toastr_position,
        message_token_count_enabled: power_user.message_token_count_enabled,
        expand_message_actions: power_user.expand_message_actions,
        enableZenSliders: power_user.enableZenSliders,
        enableLabMode: power_user.enableLabMode,
        hotswap_enabled: power_user.hotswap_enabled,
        custom_css: power_user.custom_css,
        bogus_folders: power_user.bogus_folders,
        zoomed_avatar_magnification: power_user.zoomed_avatar_magnification,
        show_swipe_num_all_messages: power_user.show_swipe_num_all_messages,
        click_to_edit: power_user.click_to_edit,
        media_display: power_user.media_display,
    };
    const response = await fetch('/api/themes/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(theme),
    });
    if (!response.ok) throw new Error(`테마를 저장하지 못했어요 (HTTP ${response.status})`);
    // 테마 목록에도 넣어 두면 새로 고치지 않고 바로 고를 수 있다
    const select = document.getElementById('themes');
    if (select && !Array.from(select.options).some(option => option.value === name)) {
        const option = document.createElement('option');
        option.value = name;
        option.innerText = name;
        select.append(option);
    }
    if (select) select.value = name;
    power_user.theme = name;
    saveSettingsDebounced();
    return theme;
}

/** 지금 실리태번 값이 이미 맞춰져 있나 (버튼 문구에 쓴다) */
export function alreadyMatches() {
    const values = themeValues();
    return Object.entries(values).every(([key, value]) => power_user[key] === value);
}
