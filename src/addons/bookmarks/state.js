// 북마크 — 설정, 색, 테마, 모듈 사이 연결
import { syncAltPalette } from './alt-palette.js';
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';

export const MODULE = 'chaekgalpi';
export const VERSION = '1.3.2';

export const DEFAULT_COLORS = Object.freeze({ accent: '#a98bd9', user: '#5aa9e6', icon: '#f2c14e' });
const COLOR_KEYS = Object.keys(DEFAULT_COLORS);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const DEFAULTS = Object.freeze({
    theme: 'auto',          // auto: 실리태번 테마를 따른다 / light / dark
    iconStyle: 'star',      // 메시지에 붙는 아이콘: star / bookmark
    collapseLong: true,     // 긴 메시지를 접어서 보여 준다
    itemsPerPage: 10,
    contextRange: 1,        // 앞뒤 문맥 창에서 앞뒤로 보여 줄 메시지 수
    sortOrder: 'asc',       // asc: 처음부터 / desc: 최근부터
    followTheme: true,      // 블루 레몬에이드가 켜져 있으면 테마와 색을 그 팔레트에 맞춘다
    deusProseOnly: true,    // 데우스 엑스 마키나: 카드에 본문만 (끄면 장면 계획 · 트래커 같은 정규식 카드도 같이)
});

/** 다른 모듈이 서로를 직접 import하지 않도록 여기에 함수를 걸어 둔다. */
export const hooks = {
    openPanel: async () => {},
    closePanel: () => {},
    refreshPanel: async () => {},
    isPanelOpen: () => false,
    refreshMessageIcons: () => {},
    syncBookmarks: () => {},
};

export function settings() {
    return extension_settings[MODULE];
}

export function saveSettings() {
    saveSettingsDebounced();
}

function clampInt(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function initSettings() {
    const existing = extension_settings[MODULE];
    const isFirstRun = !existing || typeof existing !== 'object';
    extension_settings[MODULE] = isFirstRun
        ? { ...DEFAULTS, colors: { default: {}, chats: {} }, ...migrateFromStar() }
        : { ...DEFAULTS, ...existing };

    const store = extension_settings[MODULE];
    store.colors ??= {};
    store.colors.default ??= {};
    store.colors.chats ??= {};
    store.itemsPerPage = clampInt(store.itemsPerPage, 1, 50, DEFAULTS.itemsPerPage);
    store.contextRange = clampInt(store.contextRange, 0, 10, DEFAULTS.contextRange);
    // 1.2.0: 이름을 '북마크'로 바꾸면서 아이콘도 별로 바꿨다. 예전에 저장된 모양도 한 번만 별로 바꾸고,
    // 그 뒤로는 설정에서 고른 대로 둔다.
    const upgradeIcon = !isFirstRun && !store.starIconApplied;
    if (upgradeIcon) store.iconStyle = 'star';
    store.starIconApplied = true;
    if (isFirstRun || upgradeIcon) saveSettingsDebounced();
    return store;
}

/**
 * 이전 확장(star · 채팅 북마크)의 설정을 옮겨 온다.
 * 북마크 자체는 각 채팅 파일의 chat_metadata.favorites에 있어서 그대로 읽힌다.
 */
function migrateFromStar() {
    const old = extension_settings.star;
    if (!old || typeof old !== 'object') return {};
    const migrated = { migratedFrom: 'star' };
    if (old.colors && typeof old.colors === 'object') {
        const chats = Object.entries(old.colors.chats ?? {})
            .map(([key, colors]) => [key, pickColors(colors)])
            .filter(([, colors]) => Object.keys(colors).length > 0);
        migrated.colors = { default: pickColors(old.colors.default), chats: Object.fromEntries(chats) };
    }
    if (Number.isInteger(old.contextViewRange)) migrated.contextRange = old.contextViewRange;
    if (Number.isInteger(old.itemsPerPage)) migrated.itemsPerPage = old.itemsPerPage;
    try {
        if (localStorage.getItem('favorites-theme') === 'dark') migrated.theme = 'dark';
    } catch {
        // 저장소를 못 쓰는 환경이면 자동 테마를 쓴다.
    }
    return migrated;
}

// ── 채팅 이름 ────────────────────────────────────────────────

export function chatKey(chatId) {
    return String(chatId ?? '').replace(/\.jsonl$/i, '');
}

export function currentChatKey() {
    return chatKey(getContext().chatId);
}

// ── 색 ──────────────────────────────────────────────────────

export function pickColors(source) {
    const picked = {};
    for (const key of COLOR_KEYS) {
        if (HEX_COLOR.test(source?.[key] ?? '')) picked[key] = source[key].toLowerCase();
    }
    return picked;
}

/** 전용 색이 없는 채팅이 쓰는 기본 색 */
export function baseColors() {
    return { ...DEFAULT_COLORS, ...pickColors(settings().colors.default) };
}

/**
 * 블루 레몬에이드(설정 키 salty)가 켜져 있으면 지금 팔레트에서 뽑은 색. 꺼져 있거나 없으면 null.
 * 그 테마는 팔레트 색을 :root 변수(--salty-accent, --salty-pop)로 써 두고, 켜져 있을 때만 body에 salty 클래스를 붙인다.
 * 포인트 · 유저 = 포인트색, 아이콘 = 두 번째 포인트(블루 아워는 레몬, 나머지는 포인트색).
 */
export function themeColors() {
    if (!document.body?.classList.contains('salty')) return null;
    const style = getComputedStyle(document.documentElement);
    const hexOf = (name) => {
        const rgb = parseCssColor(style.getPropertyValue(name));
        return rgb ? `#${rgb.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}` : null;
    };
    const accent = hexOf('--salty-accent');
    if (!accent) return null;
    return { accent, user: accent, icon: hexOf('--salty-pop') ?? accent };
}

/** 테마를 따라가는 중인가 (설정이 켜져 있고 블루 레몬에이드도 켜져 있을 때) */
export function isFollowingTheme() {
    return !!settings().followTheme && !!themeColors();
}

/** 테마를 따라가면 그 색, 아니면 채팅 전용 색 → 기본 색 → 확장 기본값 순서로 고른다. */
export function colorsFor(key) {
    if (settings().followTheme) {
        const theme = themeColors();
        if (theme) return theme;
    }
    const own = key ? settings().colors.chats[chatKey(key)] : null;
    return { ...baseColors(), ...pickColors(own) };
}

export function hasOwnColors(key) {
    return Object.keys(pickColors(settings().colors.chats[chatKey(key)])).length > 0;
}

// 밝은 색 위에는 어두운 글자, 어두운 색 위에는 흰 글자
export function contrastInk(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    const luminance = 0.299 * (value >> 16 & 255) + 0.587 * (value >> 8 & 255) + 0.114 * (value & 255);
    return luminance > 160 ? '#1b1820' : '#ffffff';
}

/** :root 변수로 넣어서 패널, 창, 채팅의 아이콘이 함께 따라가게 한다. */
export function applyColors(colors) {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--cg-accent', colors.accent);
    rootStyle.setProperty('--cg-user', colors.user);
    rootStyle.setProperty('--cg-icon', colors.icon);
    rootStyle.setProperty('--cg-accent-ink', contrastInk(colors.accent));
}

// 모바일 색 선택기로는 정확한 색을 고르기 어려우므로 색 코드를 기준으로 삼는다.
// 받는 형식: #51a0de, 51a0de, #fff, rgb(81, 160, 222), 81,160,222, 81 160 222 → '#rrggbb' (잘못된 값은 null)
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
        if (channels.every(channel => channel <= 255)) {
            return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
        }
    }
    return null;
}

// ── 테마 ────────────────────────────────────────────────────

function parseCssColor(text) {
    const value = String(text ?? '').trim();
    const rgb = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (rgb) return rgb.slice(1, 4).map(Number);
    const hex = parseColorCode(value);
    if (hex) return [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
    return null;
}

/** 'light' 또는 'dark'. 자동이면 실리태번 글자색이 밝은지(=어두운 테마인지)로 판단한다. */
export function resolvedTone() {
    const mode = effectiveTheme();
    if (mode === 'light' || mode === 'dark') return mode;
    const text = parseCssColor(getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor'));
    if (!text) return 'dark';
    const [red, green, blue] = text;
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.5 ? 'dark' : 'light';
}

/** 테마를 따라가는 중이면 자동(실리태번 = 블루 레몬에이드의 글자색 · 배경색), 아니면 고른 테마 */
function effectiveTheme() {
    return isFollowingTheme() ? 'auto' : settings().theme;
}

/** 패널과 창에 붙이는 테마 속성 */
export function applyTheme(element) {
    element.dataset.cgTheme = effectiveTheme();
    element.dataset.cgTone = resolvedTone();
    // 블루 레몬에이드를 따라가는 중에도 밝게 / 어둡게를 직접 고르면 북마크 창만 같은 에이드의 반대쪽 팔레트로 보여 준다 (alt-palette.js)
    const alt = isFollowingTheme() ? syncAltPalette(settings().theme) : '';
    if (alt) { element.dataset.blAlt = alt; element.dataset.cgTone = alt; } else delete element.dataset.blAlt;
}

export function iconName() {
    return settings().iconStyle === 'star' ? 'fa-star' : 'fa-bookmark';
}
