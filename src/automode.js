// 화이트 · 나이트 자동 (3.2.0) — 기기의 다크 모드를 따라가거나, 정한 시간에 팔레트 밝기를 바꾼다.
// 고른 팔레트 묶음(블루 레몬에이드 · 멜론 …)은 그대로 두고 그 묶음의 화이트 ↔ 나이트만 갈아 끼운다.
// 켜 두었을 때만 불러온다 (features.js). 해/달 단추를 직접 누르면 자동은 꺼진다 (panel.js).
import { getSettings } from './settings.js';
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

// 7.0.2 자동 전환은 저장하지 않는다 — 시각 · 기기 다크 모드에서 언제든 다시 계산되는 값인데, 숨은/잠든 탭의 타이머 · 다시 보이기에서
// 실리태번 설정 전체를 저장하면 그 탭의 옛 설정이 다른 기기(폰 · PC, Syncthing)의 변경을 덮었다. 메모리 팔레트만 바꾸고, 다음 사용자 저장 때 함께 간다.
// 해/달 단추처럼 사용자가 직접 바꾸는 길(panel.js)은 그대로 저장한다
export function check() {
    const s = getSettings();
    if (!s.enabled || !s.auto?.on) return false;
    const want = wantMode(s.auto);
    if ((PALETTES[s.palette]?.mode || 'light') === want) return false;
    s.palette = paletteVariant(paletteFamily(s.palette), want);
    hooks.applyAll?.();
    hooks.refreshPanels?.();
    return true;
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
