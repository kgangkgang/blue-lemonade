import { DEFAULTS } from './settings.js';
import { PALETTES, paletteColors } from './palettes.js';
import { presetColors } from './frame-presets.js';
const read = (obj, path) => path.split('.').reduce((v, k) => v != null && Object.hasOwn(v,k) ? v[k] : undefined, obj);
const equal = (a, b) => a === b || (!!a && !!b && typeof a === 'object' && typeof b === 'object' && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => equal(a[k], b[k])));
const omitted = new Set(['appearanceHistory','version','noticeSeen','frameLibrary','customFonts','styles','charStyles','activeStyle','baseStyle','weatherImages','customPalettes','activeCustomPalette','wordTools']);
const omittedPaths = new Set(['deviceLayouts.pc','deviceLayouts.mobile','image.masks','image.maskId','chat.weatherImageId']);
const safe = path => typeof path === 'string' && !path.split('.').some(k => ['__proto__','constructor','prototype'].includes(k));
export function settingDefault(settings, path) {
    if (!safe(path) || omitted.has(path.split('.')[0]) || omittedPaths.has(path)) return { allowed: false };
    if (path === 'gradients.overrides' || path.startsWith('gradients.overrides.')) return {allowed:true,value:path==='gradients.overrides'?{}:undefined};
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
        if (path === 'gradients.overrides' || path.endsWith('.decor') || path === 'image.mask' || !defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
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
    if (scope === 'addons') return {tab:'extensions',sub:key === 'modelorder' ? 'models' : key}; // 모델 순서는 모델 등록으로 합쳐짐
    if (scope === 'captureTools') return {tab:'extensions',sub:'capture'};
    if (scope === 'addonUI') return {tab:'extensions',sub:/^perf/.test(key) ? 'perf' : /^words/.test(key) ? 'words' : /^capture/.test(key) ? 'capture' : 'order'};
    if (scope === 'gradients') return {tab:'theme',sub:key!=='overrides'?'palette':'colors'};
    if (scope === 'colorOverrides') return { tab:'theme', sub:'colors' };
    if (['palette','lightTint','nightTint','auto','enabled','customName'].includes(scope)) return {tab:'theme',sub:'palette'};
    if (scope === 'fonts') return key === 'name' || key === 'userName' ? {tab:'chat',sub:key === 'name' ? 'name' : 'user-name'} : {tab:'text',sub:key === 'hanja' ? 'text' : key};
    if (path === 'userProfile.metaSide') return {tab:'chat',sub:'user-profile'}; // 번호 · 시간 줄 위치는 작은 사진 옆이라 내 프로필에
    if (scope === 'profile' || scope === 'userProfile') return {tab:'chat',sub:/^(name|header|meta|button)/.test(key) ? scope === 'profile' ? 'name' : 'user-name' : scope === 'profile' ? 'profile' : 'user-profile'};
    if (scope === 'type') return {tab:'text',sub:({dialogueSize:'dialogue',uiSize:'ui',codeSize:'code',para:'para',gutter:'para',measure:'para',indent:'para',align:'para'})[key] || 'text'};
    if (['dialogue','em','strong','ui','code'].includes(scope)) return {tab:'text',sub:scope};
    if (['shadow','outline'].includes(scope)) return {tab:'text',sub:'shadow'};
    if (scope === 'image') return {tab:'image',sub:key.startsWith('edge') || key === 'decor' ? 'frame' : /^(fit|maxh|height)$/.test(key) ? 'size' : /^(fade|blendWhite)/.test(key) ? 'fade' : key === 'layout' ? 'layout' : 'shape'};
    // 카드 · 색 통일 · 톤 값은 데우스 화면에 있다 (채팅 › 기타에는 커스텀 CSS 끄기만)
    if (scope === 'deus' || scope === 'chat' && /^(dem|unify|tone|markerTone|regexIcons)/.test(key)) return {tab:'prompt',sub:'deus'};
    if (scope === 'deviceLayouts') return {tab:'text',sub:'para'};
    if (scope === 'settingLocks') return {tab:'theme',sub:'backup'};
    if (scope === 'compat') return {tab:'chat',sub:'etc'};
    if (scope === 'chat' && /^(user|header)/.test(key)) return {tab:'chat',sub:'message'};
    return {tab:'chat',sub:'screen'};
}
