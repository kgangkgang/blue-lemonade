import { DEFAULTS } from './settings.js';
import { PALETTES, paletteColors } from './palettes.js';
import { presetColors } from './frame-presets.js';
const read = (obj, path) => path.split('.').reduce((v, k) => v != null && Object.hasOwn(v,k) ? v[k] : undefined, obj);
const equal = (a, b) => a === b || (!!a && !!b && typeof a === 'object' && typeof b === 'object' && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => equal(a[k], b[k])));
const omitted = new Set(['version','noticeSeen','frameLibrary','customFonts','styles','charStyles','activeStyle','baseStyle','weatherImages']);
const omittedPaths = new Set(['image.masks','image.maskId','chat.weatherImageId']);
const safe = path => typeof path === 'string' && !path.split('.').some(k => ['__proto__','constructor','prototype'].includes(k));
export function settingDefault(settings, path) {
    if (!safe(path) || omitted.has(path.split('.')[0]) || omittedPaths.has(path)) return { allowed: false };
    if (path.startsWith('colorOverrides.')) {
        const [, palette, token, extra] = path.split('.');
        return { allowed: !extra && !!PALETTES[palette] && Object.hasOwn(PALETTES[palette], token), value: undefined };
    }
    if (/^(image|profile|userProfile)\.decor\.preset(Color|Accent)$/.test(path)) {
        const decor = settings[path.split('.')[0]]?.decor;
        return { allowed: !!decor?.presetId, value: presetColors(decor?.presetId)[path.endsWith('presetAccent') ? 1 : 0] };
    }
    const value = read(DEFAULTS, path);
    return { allowed: value !== undefined, value };
}
export function settingChanged(settings, path) {
    const def = settingDefault(settings, path);
    return def.allowed && !equal(read(settings, path), def.value);
}
export function resetSetting(settings, path) {
    const def = settingDefault(settings, path);
    if (!def.allowed) return false;
    const keys = path.split('.'), key = keys.pop(); let target = settings;
    for (const part of keys) { if (!target[part] || typeof target[part] !== 'object') target[part] = {}; target = target[part]; }
    if (def.value === undefined) delete target[key];
    else target[key] = structuredClone(def.value);
    if (path === 'image.mask') settings.image.maskId = '';
    if (path === 'chat.weatherImage') settings.chat.weatherImageId = '';
    return true;
}
export function changedSettings(settings) {
    const result = [];
    function visit(defaults, value, path) {
        if (omitted.has(path.split('.')[0]) || omittedPaths.has(path)) return;
        // Uploaded frame artwork and its mask are an atomic pair; saved copies remain untouched.
        if (path.endsWith('.decor') || path === 'image.mask' || !defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
            if (!equal(defaults, value)) result.push({ path, before: defaults, value });
            return;
        }
        for (const key of Object.keys(defaults)) visit(defaults[key], value?.[key], path ? `${path}.${key}` : key);
    }
    for (const key of Object.keys(DEFAULTS)) if (key !== 'colorOverrides') visit(DEFAULTS[key], settings[key], key);
    for (const [palette, colors] of Object.entries(settings.colorOverrides || {})) for (const [token, value] of Object.entries(colors || {})) {
        const path = `colorOverrides.${palette}.${token}`;
        if (settingDefault(settings, path).allowed) result.push({ path, before: paletteColors({ ...settings, palette, colorOverrides: {} })[token], value });
    }
    return result;
}
export function settingRoute(path) {
    const [scope, key] = path.split('.');
    if (scope === 'colorOverrides') return { tab:'theme', sub:'colors' };
    if (['palette','lightTint','nightTint','auto','enabled','customName'].includes(scope)) return {tab:'theme',sub:'palette'};
    if (scope === 'fonts') return key === 'name' || key === 'userName' ? {tab:'chat',sub:key === 'name' ? 'name' : 'user-name'} : {tab:'text',sub:key === 'hanja' ? 'text' : key};
    if (scope === 'profile' || scope === 'userProfile') return {tab:'chat',sub:/^(name|header|meta|button)/.test(key) ? scope === 'profile' ? 'name' : 'user-name' : scope === 'profile' ? 'profile' : 'user-profile'};
    if (scope === 'type') return {tab:'text',sub:({dialogueSize:'dialogue',uiSize:'ui',codeSize:'code',para:'para',gutter:'para',measure:'para',indent:'para',align:'para'})[key] || 'text'};
    if (['dialogue','em','strong','ui','code'].includes(scope)) return {tab:'text',sub:scope};
    if (['shadow','outline'].includes(scope)) return {tab:'text',sub:'shadow'};
    if (scope === 'image') return {tab:'image',sub:key.startsWith('edge') || key === 'decor' ? 'frame' : /^(fit|maxh|height)$/.test(key) ? 'size' : /^(fade|blendWhite)/.test(key) ? 'fade' : key === 'layout' ? 'layout' : 'shape'};
    if (scope === 'deus' || scope === 'chat' && /^dem/.test(key)) return {tab:'prompt',sub:'deus'};
    if (scope === 'compat' || scope === 'chat' && /^(unify|tone|regexIcons)/.test(key)) return {tab:'chat',sub:'etc'};
    if (scope === 'chat' && /^(user|header)/.test(key)) return {tab:'chat',sub:'message'};
    return {tab:'chat',sub:'screen'};
}
