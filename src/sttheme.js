// 실리태번 설정 맞추기 (2.9.0)
//
// 블루 레몬에이드는 --SmartTheme* 변수를 직접 칠하지만, 실리태번 자체의 "사용자 설정" 값
// (말풍선 모양 · 아바타 · 흐림 · 그림자 · 글자 크기)은 건드리지 않는다.
// 기본값(Azure)을 그대로 둔 기기에서는 색만 에이드고 레이아웃은 기본이라 어긋나 보인다.
// 이 파일은 그 값들을 지금 팔레트에 맞춰 한 번에 맞춰 주고, 같은 값을 실리태번 테마로도 저장한다.
//
// 5.5.6: 맞춘 값은 실리태번 자체 설정이라 테마를 끄거나 '확장만' 으로 바꿔도 남는다 — 테마가 덮고 있을 땐 안 보이다가
// 테마가 빠지는 순간 채팅 바탕 투명 · 테두리/그림자 없음 · 팔레트 글자색이 그대로 드러났다 (제보: "확장만인데 창이 전부 투명").
// 그래서 맞추기 전 값을 따로 적어 두고(백업), 되돌리기로 그 값을 실리태번의 제 핸들러를 거쳐 다시 입힌다.
import { power_user, applyPowerUserSettings } from '../../../../power-user.js';
import { saveSettingsDebounced, saveSettings as saveSillyTavernSettings } from '../../../../../script.js';
import { getRequestHeaders } from '../../../../../script.js';
import { paletteColors, parseColor } from './palettes.js';
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';

/** 팔레트 색을 실리태번이 쓰는 rgba 문자열로 */
function toRgba(color, alpha = 1) {
    const hex = String(color ?? '').trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
    if (m) {
        const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
        const n = parseInt(h, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }
    // 5.5.6: rgb()/rgba() 로 적힌 팔레트 색도 실리태번 색 칸이 내보내는 꼴(rgba(R, G, B, A) · 알파 소수 둘째 자리)로 —
    // 새로고침하면 실리태번이 이 꼴로 다시 적어서, 다른 꼴로 적어 두면 '맞춘 값' 과 달라 보여 되돌리기가 그 색을 건너뛴다
    const [r,g,b,a] = parseColor(hex);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * alpha * 100) / 100})`;
}

/**
 * 블루 레몬에이드가 기대하는 실리태번 값.
 * 색은 지금 팔레트에서, 나머지는 이 확장이 스스로 그리는 것과 겹치지 않게 끄는 쪽으로 맞춘다.
 */
export function themeValues() {
    const s = getSettings();
    const pal = paletteColors(s);
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

// ── 맞추기 전 값 (5.5.6) ─────────────────────────────────────
// 테마 설정(salty)과 다른 키에 둔다 — 테마 설정 파일 가져오기 · 초기화 · 변경 내역 · 되돌리기 기록에 섞이지 않게.
const STORE = 'salty_st';
const KEYS = ['main_text_color', 'italics_text_color', 'underline_text_color', 'quote_text_color', 'blur_tint_color', 'chat_tint_color', 'user_mes_blur_tint_color', 'bot_mes_blur_tint_color', 'shadow_color', 'border_color', 'blur_strength', 'shadow_width', 'noShadows', 'fast_ui_mode', 'chat_display', 'font_scale', 'reduced_motion', 'compact_input_area'];
// 실리태번 사용자 설정의 색 칸 (power-user.js applyTheme 과 같은 표). 'color' 속성을 바꾸면 그 칸의 change 핸들러가 화면에 칠한다
const PICKERS = {
    main_text_color: 'main-text-color-picker', italics_text_color: 'italics-color-picker', underline_text_color: 'underline-color-picker', quote_text_color: 'quote-color-picker',
    blur_tint_color: 'blur-tint-color-picker', chat_tint_color: 'chat-tint-color-picker', user_mes_blur_tint_color: 'user-mes-blur-tint-color-picker', bot_mes_blur_tint_color: 'bot-mes-blur-tint-color-picker',
    shadow_color: 'shadow-color-picker', border_color: 'border-color-picker',
};
const CLEAR = 'rgba(0, 0, 0, 0)';
const BL_THEME = /^Blue Lemonade · /;
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);

function store() {
    const ext = SillyTavern.getContext().extensionSettings;
    if (!isObj(ext[STORE])) ext[STORE] = {};
    return ext[STORE];
}

function backupOf() {
    const st = store();
    const backup = st.backup;
    if (!isObj(backup) || !isObj(backup.values) || !isObj(backup.applied)) return null;
    // 맞춘 뒤 실리태번 테마 목록에서 다른 테마를 골랐으면 실리태번이 값을 통째로 바꾼 것이다 — 백업은 낡았다.
    // (새 테마의 값 몇 개가 우연히 맞춘 값과 같으면 그것만 옛 값으로 되돌려 두 테마가 섞였다)
    const theme = String(power_user.theme ?? '');
    if (!BL_THEME.test(theme) && theme !== String(backup.theme ?? '')) { st.backup = null; return null; }
    return backup;
}

/** 이 값이 맞추기가 적은 값인가 — 팔레트를 바꿔 다시 맞춘 경우의 예전 값(seen)도 맞춘 값으로 친다 */
function wasApplied(backup, key, value) {
    return value === backup.applied[key] || (Array.isArray(backup.seen?.[key]) && backup.seen[key].includes(value));
}

/** 지금 실리태번 값이 '맞추기' 가 적은 모양인가 — 백업 없이 눌렀던 예전 사용자를 알아본다 (테마 이름, 또는 투명 네 값 + 흐림 0) */
function looksMatched() {
    if (BL_THEME.test(String(power_user.theme ?? ''))) return true;
    return power_user.chat_tint_color === CLEAR && power_user.bot_mes_blur_tint_color === CLEAR && power_user.shadow_color === CLEAR
        && power_user.border_color === CLEAR && Number(power_user.blur_strength) === 0;
}

/** 맞추기 직전: 처음 값은 한 번만 적는다. 다시 맞추기는 '맞춘 값' 만 새로 적고, 그 사이 사용자가 직접 바꾼 칸은 그 값을 처음 값으로 삼는다 */
function rememberBefore(values) {
    const st = store();
    const old = backupOf();
    if (old) {
        for (const key of KEYS) if (power_user[key] !== undefined && !wasApplied(old, key, power_user[key])) old.values[key] = power_user[key];
        if (!BL_THEME.test(String(power_user.theme ?? ''))) old.theme = String(power_user.theme ?? '');
        // 다른 팔레트로 다시 맞추면 예전에 적은 값도 기억해 둔다 (예전 'Blue Lemonade · …' 테마를 다시 골랐을 때 그 색을 사용자가 고친 값으로 오해하지 않게)
        old.seen = isObj(old.seen) ? old.seen : {};
        for (const key of KEYS) if (old.applied[key] !== undefined && old.applied[key] !== values[key]) old.seen[key] = [...new Set([...(Array.isArray(old.seen[key]) ? old.seen[key] : []), old.applied[key]])].slice(-8);
        old.applied = { ...values };
        return;
    }
    if (looksMatched()) return; // 이미 맞춰진 상태(백업 없던 예전 판)에서는 원래 값을 알 수 없다 — 맞춘 값을 '원래 값' 으로 적지 않는다
    st.backup = {
        v: 1, at: Date.now(), theme: String(power_user.theme ?? ''),
        values: Object.fromEntries(KEYS.filter(key => power_user[key] !== undefined).map(key => [key, power_user[key]])),
        applied: { ...values },
    };
}

/**
 * 되돌릴 것이 있나: 'backup' = 맞추기 전 값을 갖고 있다 · 'legacy' = 백업은 없지만 맞춘 모양이다 (실리태번 테마를 골라 되돌린다) · null
 */
export function restoreState() {
    const backup = backupOf();
    if (backup) {
        const pending = KEYS.some(key => backup.values[key] !== undefined && backup.values[key] !== null && wasApplied(backup, key, power_user[key]) && power_user[key] !== backup.values[key]);
        return pending || BL_THEME.test(String(power_user.theme ?? '')) ? 'backup' : null;
    }
    return looksMatched() && stockThemes().length ? 'legacy' : null;
}

/** 되돌릴 때 고를 수 있는 실리태번 테마 (맞추기가 만든 'Blue Lemonade · …' 는 뺀다) */
export function stockThemes() {
    return [...document.querySelectorAll('#themes option')].filter(option => !option.disabled && option.value && !BL_THEME.test(option.value)).map(option => option.value);
}

/** 실리태번 화면의 칸과 화면에 지금 power_user 값을 입힌다 — 실리태번의 제 핸들러로 (색 칸 · 메시지 모양 · 움직임 · 입력칸) */
function paintFromPowerUser(colorKeys = Object.keys(PICKERS)) {
    for (const key of colorKeys) {
        const picker = document.getElementById(PICKERS[key]);
        if (picker && typeof power_user[key] === 'string') picker.setAttribute('color', power_user[key]);
    }
    syncControls(power_user);
    applyPowerUserSettings();
    $('#chat_display').trigger('change');
    $('#reduced_motion').trigger('input');
    $('#compact_input_area').trigger('input');
}

/**
 * 맞추기 전 값으로 되돌린다. 맞춘 뒤 사용자가 직접 바꾼 칸은 건드리지 않는다.
 * 저장까지 기다린다 — 바로 뒤에 새로고침하는 경로(사용 모드 바꾸기)에서 부른다.
 */
export async function restoreSillyTavernTheme() {
    const st = store();
    const backup = backupOf();
    if (!backup) return 0;
    const changed = [];
    for (const key of KEYS) {
        const value = backup.values[key];
        if (value === undefined || value === null || !wasApplied(backup, key, power_user[key]) || power_user[key] === value) continue;
        power_user[key] = value;
        changed.push(key);
    }
    paintFromPowerUser(changed.filter(key => PICKERS[key]));
    // 테마 이름은 표시만 되돌린다 (change 를 쏘면 테마 파일 값이 통째로 다시 입혀져, 파일에 저장 안 한 사용자의 손질이 사라진다)
    // 원래 테마가 목록에서 사라졌어도 'Blue Lemonade · …' 이름은 뗀다 — 남겨 두면 되돌린 뒤에도 '맞춘 상태' 로 보여 같은 창이 다시 뜬다
    if (BL_THEME.test(String(power_user.theme ?? ''))) {
        const name = String(backup.theme ?? '');
        power_user.theme = name;
        const select = document.getElementById('themes');
        if (select) select.value = stockThemes().includes(name) ? name : '';
    }
    st.backup = null;
    await saveSillyTavernSettings();
    return changed.length;
}

/**
 * 백업이 없는 예전 사용자: 고른 실리태번 테마 파일에서 '맞추기' 가 바꾼 값들만 가져와 입힌다.
 * 실리태번의 테마 고르기(#themes change)를 그대로 쏘지 않는 까닭: 테마 파일에는 채팅 폭 · 아바타 모양 · 시간 표시 · 커스텀 CSS 같은
 * 다른 설정도 들어 있어, 되돌리기가 그것까지 바꿔 버린다.
 */
export async function applyStockTheme(name) {
    if (!stockThemes().includes(name)) throw new Error('실리태번 테마를 찾지 못했어요');
    const response = await fetch('/api/settings/get', { method: 'POST', headers: getRequestHeaders(), body: '{}', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`실리태번 테마를 읽지 못했어요 (HTTP ${response.status})`);
    const data = await response.json();
    const theme = (Array.isArray(data.themes) ? data.themes : []).find(item => item?.name === name);
    if (!isObj(theme)) throw new Error('실리태번 테마를 찾지 못했어요');
    const changed = [];
    for (const key of KEYS) {
        if (theme[key] === undefined || theme[key] === null || power_user[key] === theme[key]) continue;
        power_user[key] = theme[key];
        changed.push(key);
    }
    paintFromPowerUser(changed.filter(key => PICKERS[key]));
    power_user.theme = name;
    const select = document.getElementById('themes');
    if (select) select.value = name;
    store().backup = null;
    await saveSillyTavernSettings();
    return changed.length;
}

/** 확인 없이 그대로 두기로 했을 때 — 시작 알림을 다시 띄우지 않는다 */
export function dismissRestoreNotice() {
    const st = store();
    if (st.noticeSeen) return;
    st.noticeSeen = true;
    saveSettingsDebounced();
}

/**
 * 되돌릴지 묻는 창. 돌려주는 값: 'restored' | 'kept' | 'none'(되돌릴 것 없음)
 * 백업이 있으면 예/아니오, 없으면 실리태번 테마를 고르게 한다.
 */
export async function offerRestore() {
    const state = restoreState();
    if (!state) return 'none';
    const ctx = SillyTavern.getContext();
    const box = document.createElement('div');
    box.className = 'bl-st-restore';
    box.style.textAlign = 'left';
    const head = document.createElement('p');
    const title = document.createElement('b');
    title.textContent = '실리태번 모습도 원래대로 되돌릴까요?';
    head.append(title);
    const note = document.createElement('p');
    note.textContent = '‘실리태번 설정 맞추기’ 가 바꾼 색 · 흐림 · 테두리 · 메시지 모양이 실리태번에 남아 있어요. 테마를 끄면 채팅 바탕이 투명하게 보여요.';
    box.append(head, note);
    let select = null;
    if (state === 'legacy') {
        const themes = stockThemes();
        if (!themes.length) return 'none';
        const label = document.createElement('label');
        label.textContent = '되돌릴 실리태번 테마 ';
        select = document.createElement('select');
        select.className = 'text_pole';
        for (const name of themes) select.append(new Option(name, name));
        select.value = themes.includes('Dark Lite') ? 'Dark Lite' : themes[0];
        label.append(select);
        box.append(label);
    }
    const yes = await ctx.callGenericPopup(box, ctx.POPUP_TYPE.CONFIRM, '', { okButton: '되돌리기', cancelButton: '그대로 두기' });
    if (!yes) { store().noticeSeen = true; saveSettingsDebounced(); return 'kept'; }
    // 실패하면(테마를 못 읽음 등) 알림 끔 표시를 남기지 않는다 — 다음에 다시 안내할 수 있게
    if (state === 'legacy') await applyStockTheme(select.value);
    else await restoreSillyTavernTheme();
    store().noticeSeen = true;
    saveSettingsDebounced();
    return 'restored';
}

/** 시작할 때 한 번: 테마가 꺼져 있는데(확장만 · 테마 끔) 맞춘 값이 남아 있으면 알린다. 누르면 되돌리기 창 */
let noticed = false;
export function noticeRestoreIfNeeded() {
    if (noticed || themeEnabled(getSettings()) || store().noticeSeen || !restoreState()) return false;
    noticed = true;
    toastr.info('테마를 껐는데 실리태번에 ‘맞추기’ 값이 남아 있어요. 여기를 누르면 원래 모습으로 되돌려요.', 'Blue Lemonade', {
        timeOut: 0, extendedTimeOut: 0, closeButton: true,
        onclick: () => { offerRestore().then(result => { if (result === 'restored') toastr.success('실리태번 모습을 되돌렸어요', 'Blue Lemonade'); }).catch(error => toastr.error(error.message || String(error), 'Blue Lemonade')); },
        onCloseClick: dismissRestoreNotice, // × 로 닫으면 다시 알리지 않는다 (설정 › 테마 › 백업의 되돌리기는 남는다)
    });
    return true;
}

/** 지금 팔레트로 실리태번 설정을 맞춘다. 바꾼 항목 수를 돌려준다 */
export function applySillyTavernTheme() {
    const values = themeValues();
    rememberBefore(values);
    let changed = 0;
    for (const [key, value] of Object.entries(values)) {
        if (power_user[key] === value) continue;
        power_user[key] = value;
        changed++;
    }
    syncControls(values);
    applyPowerUserSettings();
    // 2.9.2: applyPowerUserSettings 는 메시지 모양(chat_display) · 움직임 줄이기 · 좁은 입력칸을 화면에 칠하지 않는다 —
    // 값만 바뀌고 말풍선 · 애니메이션 · 넓은 입력칸이 새로 고칠 때까지 남았다. 실리태번 자기 칸의 핸들러로 그 자리에서 적용 (값은 syncControls 가 넣음)
    $('#chat_display').trigger('change');
    $('#reduced_motion').trigger('input');
    $('#compact_input_area').trigger('input');
    saveSettingsDebounced();
    return changed;
}

/** 설정 화면의 체크상자·슬라이더도 새 값으로 보이게 한다 (applyPowerUserSettings 는 화면만 칠한다) */
function syncControls(values) {
    const setChecked = (id, on) => { const el = document.getElementById(id); if (el) el.checked = !!on; };
    const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = String(value); };
    setChecked('fast_ui_mode', values.fast_ui_mode);
    setChecked('noShadowsmode', values.noShadows); // 실리태번의 칸 id 는 noShadowsmode (5.5.6: 예전엔 없는 id noShadows 를 찾았다)
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
    // ST keeps its theme objects in a private module array. A new/updated option
    // cannot safely be selected again until ST reloads that array from disk.
    const select = document.getElementById('themes');
    if (select) {
        const option = Array.from(select.options).find(option => option.value === name) || document.createElement('option');
        option.value = name;
        option.textContent = `${name} (새로고침 후 다시 선택)`;
        option.disabled = true;
        if (!option.isConnected) select.append(option);
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
