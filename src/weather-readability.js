export function weatherReadability(settings, mode) {
    const c = settings.chat;
    const active = settings.enabled && c?.weatherReadability === true && c.weather && c.weather !== 'off' && (c.weather !== 'tracker' || settings.deus?.on);
    return { active: !!active, shadow: mode === 'dark' ? '0 1px 2px rgba(0,0,0,.85)' : '0 1px 2px rgba(255,255,255,.95)' };
}
