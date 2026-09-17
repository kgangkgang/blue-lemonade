// 화이트 · 나이트 자동 (3.2.0) — 기기의 다크 모드를 따라가거나, 정한 시간에 팔레트 밝기를 바꾼다.
// 고른 팔레트 묶음(블루 레몬에이드 · 멜론 …)은 그대로 두고 그 묶음의 화이트 ↔ 나이트만 갈아 끼운다.
// 켜 두었을 때만 불러온다 (features.js). 해/달 단추를 직접 누르면 자동은 꺼진다 (panel.js).
import { getSettings, saveSettings } from './settings.js';
import { PALETTES, paletteFamily, paletteVariant } from './palettes.js';

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
let hooks = { applyAll: null, refreshPanels: null };
let active = false;
let timer = 0;

const minutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** 지금 되어야 할 밝기: 'light' | 'dark' */
export function wantMode(auto, now = new Date(), dark = systemDark.matches) {
    if (auto?.by !== 'time') return dark ? 'dark' : 'light';
    const t = now.getHours() * 60 + now.getMinutes();
    const night = minutes(auto.night);
    const day = minutes(auto.day);
    if (night === day) return 'light';
    // 나이트 시작이 화이트 시작보다 늦으면(20:00 → 07:00) 자정을 건너는 구간
    return night > day ? (t >= night || t < day ? 'dark' : 'light') : (t >= night && t < day ? 'dark' : 'light');
}

function check() {
    const s = getSettings();
    if (!s.enabled || !s.auto?.on) return;
    const want = wantMode(s.auto);
    if ((PALETTES[s.palette]?.mode || 'light') === want) return;
    s.palette = paletteVariant(paletteFamily(s.palette), want);
    saveSettings();
    hooks.applyAll?.();
    hooks.refreshPanels?.();
}

function schedule() {
    clearTimeout(timer);
    if (!active || getSettings().auto?.by !== 'time') return;
    // 다음 분이 바뀌는 때에 한 번 (폰이 잠들면 타이머가 늦어지니 깨어날 때도 본다)
    const now = new Date();
    timer = setTimeout(() => { check(); schedule(); }, (60 - now.getSeconds()) * 1000 + 50);
}

function onVisible() {
    if (document.visibilityState === 'visible') { check(); schedule(); }
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncAutoMode(on, nextHooks) {
    if (nextHooks) hooks = nextHooks;
    if (on && !active) {
        active = true;
        systemDark.addEventListener('change', check);
        document.addEventListener('visibilitychange', onVisible);
    } else if (!on && active) {
        active = false;
        clearTimeout(timer);
        systemDark.removeEventListener('change', check);
        document.removeEventListener('visibilitychange', onVisible);
    }
    if (active) {
        check();
        schedule();
    }
}
