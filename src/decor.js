export const DECOR_DEFAULTS = { on: false, art: '', mask: '', ratio: 1, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover', radius: null };
const validated = new WeakMap();
export function tidyDecor(owner) {
    const d = owner.decor;
    if (!d || typeof d !== 'object' || Array.isArray(d)) { owner.decor = { ...DECOR_DEFAULTS }; return; }
    for (const [key, def] of Object.entries(DECOR_DEFAULTS)) if (d[key] === undefined) d[key] = def;
    d.on = d.on === true || d.on === 'true';
    const previous = validated.get(d);
    for (const key of ['art', 'mask']) if (d[key] !== previous?.[key] && (typeof d[key] !== 'string' || d[key].length > 4000000 || !/^data:image\/png;base64,[a-z\d+/=]+$/i.test(d[key]))) d[key] = '';
    if (!previous || previous.art !== d.art || previous.mask !== d.mask) validated.set(d, { art: d.art, mask: d.mask });
    for (const [key, lo, hi] of [['ratio', 0.1, 10], ['opacity', 0, 100], ['zoom', 100, 200], ['x', 0, 100], ['y', 0, 100]]) {
        const n = Number(d[key]); d[key] = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : DECOR_DEFAULTS[key];
    }
    if (!['cover', 'contain'].includes(d.fit)) d.fit = 'cover';
    if (d.radius !== null) { const n = Number(d.radius); d.radius = Number.isFinite(n) ? Math.max(0, Math.min(120, n)) : null; }
}
export const hasDecor = d => !!(d?.on && d.art && d.mask);
export function decorVars(d, prefix, radius = 0) {
    return { [`--bl-${prefix}-decor-ratio`]: String(d.ratio), [`--bl-${prefix}-decor-opacity`]: String(d.opacity / 100),
        [`--bl-${prefix}-decor-zoom`]: String(d.zoom / 100), [`--bl-${prefix}-decor-position`]: `${d.x}% ${d.y}%`, [`--bl-${prefix}-decor-fit`]: d.fit, [`--bl-${prefix}-decor-radius`]: `${d.radius ?? radius}px` };
}
let moduleJob, latest, previousSources = [];
export function syncDecor(settings) {
    latest = settings;
    // 큰 PNG 문자열은 슬라이더를 움직일 때마다 CSS로 다시 쓰지 않는다.
    const sources = settings.enabled ? [settings.image.decor.art, settings.image.decor.mask, settings.profile.decor.art, settings.profile.decor.mask] : [];
    if (sources.length !== previousSources.length || sources.some((value, i) => value !== previousSources[i])) {
        let style = document.getElementById('bl-decor-data');
        if (!style) { style = document.createElement('style'); style.id = 'bl-decor-data'; document.head.append(style); }
        style.textContent = ':root{' + ['image-art', 'image-mask', 'profile-art', 'profile-mask'].map((key, i) => {
            const [owner, kind] = key.split('-');
            return `--bl-${owner}-decor-${kind}:${sources[i] ? `url("${sources[i]}")` : 'none'};`;
        }).join('') + '}';
        previousSources = sources;
    }
    if (!moduleJob && (!settings.enabled || (!hasDecor(settings.image.decor) && !(settings.profile.mode === 'banner' && hasDecor(settings.profile.decor))))) return;
    moduleJob ||= import('./decor-view.js');
    moduleJob.then(m => m.syncDecorView(latest)).catch(error => { moduleJob = null; console.warn('[Blue Lemonade] 액자를 불러오지 못했어요', error); });
}
