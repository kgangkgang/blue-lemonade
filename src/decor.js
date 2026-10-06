import { drawPreset, FRAME_PRESETS, FRAME_PRESET_VERSION } from './frame-presets.js';
export const DECOR_DEFAULTS = { on: false, art: '', mask: '', ratio: 1, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover', radius: null, frameWidth: 100, frameHeight: 100 };
const validated = new WeakMap();
export function tidyDecor(owner) {
    const d = owner.decor;
    if (!d || typeof d !== 'object' || Array.isArray(d)) { owner.decor = { ...DECOR_DEFAULTS }; return; }
    for (const [key, def] of Object.entries(DECOR_DEFAULTS)) if (d[key] === undefined) d[key] = def;
    d.on = d.on === true || d.on === 'true';
    const previous = validated.get(d);
    for (const key of ['art', 'mask']) if (d[key] !== previous?.[key] && (typeof d[key] !== 'string' || d[key].length > 4000000 || !/^data:image\/png;base64,[a-z\d+/=]+$/i.test(d[key]))) d[key] = '';
    if (!previous || previous.art !== d.art || previous.mask !== d.mask) validated.set(d, { art: d.art, mask: d.mask });
    for (const [key, lo, hi] of [['frameWidth', 50, 200], ['frameHeight', 50, 200], ['ratio', 0.1, 10], ['opacity', 0, 100], ['zoom', 100, 200], ['x', 0, 100], ['y', 0, 100]]) {
        const n = Number(d[key]); d[key] = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : DECOR_DEFAULTS[key];
    }
    if (!['cover', 'contain'].includes(d.fit)) d.fit = 'cover';
    if (d.radius !== null) { const n = Number(d.radius); d.radius = Number.isFinite(n) ? Math.max(0, Math.min(120, n)) : null; }
}
// 기본 프리셋 액자 (보관함 액자가 아님) — presetId · 색 · 가로세로만으로 똑같이 다시 그릴 수 있다
export const isPresetFrame = d => !!(d?.presetId && !d.libraryId && FRAME_PRESETS.some(([id]) => id === d.presetId));
// 설정 창의 '액자 있음' — 그림이 있거나, 꺼 두어 그림을 비운 기본 프리셋
export const hasFrame = d => !!(d?.art || isPresetFrame(d));
// 5.6.4: 꺼 둔 기본 프리셋 액자는 그림(art · mask)을 settings.json 에 두지 않는다 — 수채화 두 벌이 설정의 73 %(1.55 MB)로 저장마다 오갔다.
// 켜면 prepareDecor 가 다시 그린다 (styles.js captureStyle 과 같은 규칙). 켜진 액자 · 불러온 액자 · 보관함 액자는 그대로 둔다
export function slimDecor(d) {
    if (!d || d.on || !isPresetFrame(d)) return;
    d.art = ''; d.mask = ''; delete d.presetVersion;
}
export const hasDecor = d => !!(d?.on && d.art && d.mask);
export const decorEnabled = settings => ({image:!!(settings.enabled && hasDecor(settings.image?.decor)),profile:!!(settings.enabled && settings.profile?.mode === 'banner' && hasDecor(settings.profile?.decor)),userProfile:!!(settings.enabled && settings.userProfile?.mode === 'banner' && hasDecor(settings.userProfile?.decor))});
export function decorVars(d, prefix, radius = 0) {
    return { [`--bl-${prefix}-decor-ratio`]: String(d.ratio * (d.frameWidth || 100) / (d.frameHeight || 100)), [`--bl-${prefix}-decor-opacity`]: String(d.opacity / 100),
        [`--bl-${prefix}-decor-zoom`]: String(d.zoom / 100), [`--bl-${prefix}-decor-position`]: `${d.x}% ${d.y}%`, [`--bl-${prefix}-decor-fit`]: d.fit, [`--bl-${prefix}-decor-radius`]: `${d.radius ?? radius}px` };
}
export function prepareDecor(settings) {
    const owners = ['image', 'profile', 'userProfile'];
    if (settings.enabled) for (const owner of owners) {
        const d = settings[owner]?.decor;
        // 꺼진 프리셋은 그리지 않는다 (slimDecor 가 비워 둠). 켜졌는데 그림이 없거나 판이 바뀌었으면 다시 그린다 — 같은 모양은 drawPreset 캐시에서 바로 나온다
        if (d?.on && (!d.art || !d.mask || d.presetVersion !== FRAME_PRESET_VERSION) && isPresetFrame(d)) {
            const next = drawPreset(d.presetId, d);
            d.art = next.art; d.mask = next.mask; d.ratio = next.ratio; d.presetVersion = FRAME_PRESET_VERSION;
        }
    }
}
let moduleJob, latest, previousSources = [];
export function syncDecor(settings) {
    latest = settings;
    // 큰 PNG 문자열은 슬라이더를 움직일 때마다 CSS로 다시 쓰지 않는다.
    const owners = ['image', 'profile', 'userProfile'];
    const enabled = decorEnabled(settings);
    const sources = owners.flatMap(owner => enabled[owner] ? [settings[owner].decor.art, settings[owner].decor.mask] : ['', '']);
    if (sources.length !== previousSources.length || sources.some((value, i) => value !== previousSources[i])) {
        let style = document.getElementById('bl-decor-data');
        if (!style) { style = document.createElement('style'); style.id = 'bl-decor-data'; document.head.append(style); }
        style.textContent = ':root{' + ['image-art', 'image-mask', 'profile-art', 'profile-mask', 'userProfile-art', 'userProfile-mask'].map((key, i) => {
            const [owner, kind] = key.split('-');
            return `--bl-${owner === 'userProfile' ? 'user-profile' : owner}-decor-${kind}:${sources[i] ? `url("${sources[i]}")` : 'none'};`;
        }).join('') + '}';
        previousSources = sources;
    }
    if (!moduleJob && !Object.values(enabled).some(Boolean)) return;
    moduleJob ||= import('./decor-view.js');
    moduleJob.then(m => m.syncDecorView(latest)).catch(error => { moduleJob = null; console.warn('[Blue Lemonade] 액자를 불러오지 못했어요', error); });
}
