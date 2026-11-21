/** 미트볼 상태창이 깔려 켜져 있나(그 확장 설정 칸) — 「트래커 따라」를 데우스 호환 없이 고를 수 있어요 */
export const meatballStatusOn = () => { try { const x = globalThis.SillyTavern?.getContext?.().extensionSettings?.statussim; return !!x && typeof x === 'object' && x.enabled !== false; } catch { return false; } };
/** 1.9.9 상태창 날씨 창구가 있나(weather-meatball.js STATUS_WEATHER 와 같은 열쇠 — 이 파일은 첫 장이라 그 모듈을 안 불러요) */
export const statusWeatherOn = () => { try { return typeof globalThis[Symbol.for('blue-lemonade.status-weather.v1')]?.read === 'function'; } catch { return false; } };
/** 「트래커 따라」를 쓸 수 있나: 데우스 호환 켬(데우스 칸 · 상태창 글 · 미트볼) 또는 미트볼 상태창 켬 · 상태창 창구 있음(상태창 날씨만) */
export const trackerWeatherOn = s => !!s?.deus?.on || meatballStatusOn() || statusWeatherOn();
export function weatherReadability(settings, mode) {
    const c = settings.chat;
    const active = settings.enabled && c?.weatherReadability === true && c.weather && c.weather !== 'off' && (c.weather !== 'tracker' || trackerWeatherOn(settings));
    return { active: !!active, shadow: mode === 'dark' ? '0 1px 2px rgba(0,0,0,.85)' : '0 1px 2px rgba(255,255,255,.95)' };
}
