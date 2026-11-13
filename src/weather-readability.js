/** 미트볼 상태창이 깔려 켜져 있나(그 확장 설정 칸) — 「트래커 따라」를 데우스 호환 없이 고를 수 있어요 */
export const meatballStatusOn = () => { try { const x = globalThis.SillyTavern?.getContext?.().extensionSettings?.statussim; return !!x && typeof x === 'object' && x.enabled !== false; } catch { return false; } };
/** 「트래커 따라」를 쓸 수 있나: 데우스 호환 켬(데우스 칸 · 상태창 글 · 미트볼) 또는 미트볼 상태창 켬(미트볼 날씨만) */
export const trackerWeatherOn = s => !!s?.deus?.on || meatballStatusOn();
export function weatherReadability(settings, mode) {
    const c = settings.chat;
    const active = settings.enabled && c?.weatherReadability === true && c.weather && c.weather !== 'off' && (c.weather !== 'tracker' || trackerWeatherOn(settings));
    return { active: !!active, shadow: mode === 'dark' ? '0 1px 2px rgba(0,0,0,.85)' : '0 1px 2px rgba(255,255,255,.95)' };
}
