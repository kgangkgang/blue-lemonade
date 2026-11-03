import { presetColors } from './frame-presets.js';
import { GRADIENT_KEYS } from './gradients.js';
import { DEFAULTS } from './settings.js';
import { PALETTES, paletteColors } from './palettes.js';
import './palette-data.js';   // 1.0.0 팔레트 11벌 · 커스텀 색 정의 (시작 그래프 밖 — 이 모듈은 지연으로 받아요)
import { FILTER_KEYS } from './capture-style.js';
import { ROLE_IDS } from './role-icons-core.js';
const read = (obj, path) => path.split('.').reduce((v, k) => v != null && Object.hasOwn(v,k) ? v[k] : undefined, obj);
// 날씨 양의 기본값 칸은 옛 세 단계 값을 이어받으려고 null 이고, 정리하면 100 이 돼요. 비교 · 복원은 정리된 값으로 해요
const SETTLED_DEFAULTS = { 'chat.weatherAmount': 100, 'chat.weather2Amount': 100 };
const equal = (a, b) => a === b || (!!a && !!b && typeof a === 'object' && typeof b === 'object' && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => equal(a[k], b[k])));
const omitted = new Set(['appearanceHistory',   /* 9.0.2 그라데이션 · 기기별 배치는 걷어 「변경한 설정」에서도 뺀다 */
    'version','noticeSeen','addonCarry','frameLibrary','customFonts','styles','charStyles','promptBinds','headSwitches','activeStyle','baseStyle','weatherImages','customPalettes','activeCustomPalette','wordTools','multiAvatar']);
const omittedPaths = new Set(['deviceLayouts.pc','deviceLayouts.mobile','image.masks','image.maskId','chat.weatherImageId','compat.cssAsked','logCopy.shape','logCopy.palette','logCopy.category','logCopy.recent','logCopy.fav','logCopy.custom']);   // cssAsked: 「쓰던 테마가 있어요」에 답한 지문 (설정이 아니라 기억) · logCopy.*: 로그 복사 시트가 기억하는 마지막 모양 · 색 · 최근 · 즐겨찾기 · 내 글꾸 (켜기만 설정)
const safe = path => typeof path === 'string' && !path.split('.').some(k => ['__proto__','constructor','prototype'].includes(k));
export function settingDefault(settings, path) {
    if (!safe(path) || omitted.has(path.split('.')[0]) || omittedPaths.has(path)) return { allowed: false };
    if (path === 'gradients.overrides' || path.startsWith('gradients.overrides.')) {
        const [, , palette, token, extra] = path.split('.');
        return {allowed: !extra && !!PALETTES[palette] && GRADIENT_KEYS.includes(token), value:undefined};
    }
    if (path === 'roleIcons' || path.startsWith('roleIcons.')) { // 7.9.3 단추 아이콘: 역할 하나가 한 칸, 처음 값 = 칸이 없음
        const [, role, extra] = path.split('.');
        return { allowed: !extra && ROLE_IDS.includes(role), value: undefined };
    }
    if (path === 'pickedIcons' || path.startsWith('pickedIcons.')) { // 화면에서 고른 단추: 한 단추가 한 칸, 처음 값 = 칸이 없음(목록에서 빠짐)
        const [, slug, extra] = path.split('.');
        return { allowed: !extra && /^p[0-9a-z]{7}$/.test(slug || ''), value: undefined };
    }
    if (path.startsWith('colorOverrides.')) {
        const [, palette, token, extra] = path.split('.');
        return { allowed: !extra && !!PALETTES[palette] && Object.hasOwn(PALETTES[palette], token), value: undefined };
    }
    if (/^(image|profile|userProfile)\.decor\.preset(Color|Accent)$/.test(path)) {
        const decor = settings[path.split('.')[0]]?.decor;
        return { allowed: !!decor?.presetId, value: presetColors(decor?.presetId)[path.endsWith('presetAccent') ? 1 : 0] };
    }
    const value = Object.hasOwn(SETTLED_DEFAULTS, path) ? SETTLED_DEFAULTS[path] : read(DEFAULTS, path);
    return { allowed: value !== undefined, value };
}
export function settingChanged(settings, path) {
    const def = settingDefault(settings, path);
    return def.allowed && !equal(read(settings, path), def.value);
}
export function resetSetting(settings, path) {
    if (path === 'usageMode') return false; // The dedicated control saves durably before reloading.
    const def = settingDefault(settings, path);
    if (!def.allowed) return false;
    const keys = path.split('.'), key = keys.pop(); let target = settings;
    for (const part of keys) { if (!target[part] || typeof target[part] !== 'object') target[part] = {}; target = target[part]; }
    if (def.value === undefined) delete target[key];
    else target[key] = structuredClone(def.value);
    if (path === 'image.mask') settings.image.maskId = '';
    if (path === 'chat.weatherImage') settings.chat.weatherImageId = '';
    // 5.5.3 캡처 필터: 프리셋과 여섯 값은 한 묶음 — 프리셋을 되돌리면 값도, 값 하나를 되돌리면 프리셋은 '직접'(전부 0 이면 '없음')
    const capture = settings.captureTools;
    if (capture && path === 'captureTools.filterPreset') for (const k of FILTER_KEYS) capture[k] = DEFAULTS.captureTools[k];
    else if (capture && keys[0] === 'captureTools' && keys.length === 1 && FILTER_KEYS.includes(key)) capture.filterPreset = FILTER_KEYS.every(k => !Number(capture[k])) ? 'none' : 'custom';
    return true;
}
export function changedSettings(settings) {
    const result = [];
    function visit(defaults, value, path) {
        if (omitted.has(path.split('.')[0]) || omittedPaths.has(path)) return;
        // Uploaded frame artwork and its mask are an atomic pair; saved copies remain untouched.
        if (path === 'gradients.overrides') {
            for (const [palette, tokens] of Object.entries(value || {})) for (const [token, gradient] of Object.entries(tokens || {})) {
                const itemPath = `${path}.${palette}.${token}`;
                if (settingDefault(settings,itemPath).allowed) result.push({path:itemPath,before:undefined,value:gradient});
            }
            return;
        }
        if (path.endsWith('.decor') || path === 'image.mask' || !defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
            const base = Object.hasOwn(SETTLED_DEFAULTS, path) ? SETTLED_DEFAULTS[path] : defaults;
            if (!equal(base, value)) result.push({ path, before: base, value });
            return;
        }
        for (const key of Object.keys(defaults)) visit(defaults[key], value?.[key], path ? `${path}.${key}` : key);
    }
    for (const key of Object.keys(DEFAULTS)) if (key !== 'colorOverrides') visit(DEFAULTS[key], settings[key], key);
    for (const role of ROLE_IDS) if (typeof settings.roleIcons?.[role] === 'string') result.push({ path: `roleIcons.${role}`, before: undefined, value: settings.roleIcons[role] });
    for (const [slug, entry] of Object.entries(settings.pickedIcons || {})) if (entry && typeof entry === 'object') result.push({ path: `pickedIcons.${slug}`, before: undefined, value: entry });
    for (const [palette, colors] of Object.entries(settings.colorOverrides || {})) for (const [token, value] of Object.entries(colors || {})) {
        const path = `colorOverrides.${palette}.${token}`;
        if (settingDefault(settings, path).allowed) result.push({ path, before: paletteColors({ ...settings, palette, colorOverrides: {} })[token], value });
    }
    return result;
}
/** 1.0.0 중복 정리: 글자 › 글자 모양(역할 칩)에 같은 칸이 있는 색 토큰 → 그 화면 */
export const TEXT_TOKEN_ROUTE = { text: { tab: 'text', sub: 'text' }, dialogue: { tab: 'text', sub: 'dialogue' }, marker: { tab: 'text', sub: 'dialogue' }, em: { tab: 'text', sub: 'em' }, strong: { tab: 'text', sub: 'strong' }, gold: { tab: 'text', sub: 'strong' } };
export function settingRoute(path) {
    const [scope, key] = path.split('.');
    if (scope === 'addons') return {tab:'extensions',sub:['modelswitch'].includes(key) ? 'models' : key === 'regexlink' ? 'perf' : key}; // 모델 순서는 모델 등록으로 합쳐짐
    if (scope === 'captureTools') return {tab:'extensions',sub:'capture'};
    if (scope === 'addonUI') return {tab:'extensions',sub:/^modelswitch/.test(key) ? 'models' : /^perf/.test(key) ? 'perf' : /^words/.test(key) ? 'words' : /^capture/.test(key) ? 'capture' : /^translator/.test(key) ? 'translator' : /^tts/.test(key) ? 'tts' : /^notes/.test(key) ? 'notes' : /^zipinstall/.test(key) ? 'zipinstall' : 'order'};
    if (scope === 'gradients') return {tab:'theme',sub:key!=='overrides'?'palette':'colors'};
    if (scope === 'colorOverrides') { const t = path.split('.')[2]; return TEXT_TOKEN_ROUTE[t] || { tab:'theme', sub:'colors' }; }   // 1.0.0 중복 정리: 글자 모양에 있는 색은 그 화면으로
    if (scope === 'roleIcons' || scope === 'pickedIcons') return { tab:'theme', sub:'icons' };
    if (['palette','lightTint','nightTint','auto','enabled','customName'].includes(scope)) return {tab:'theme',sub:'palette'};
    if (scope === 'fonts') return key === 'name' || key === 'userName' ? {tab:'chat',sub:key === 'name' ? 'name' : 'user-name'} : {tab:'text',sub:key === 'hanja' ? 'text' : key};
    if (path === 'userProfile.metaSide') return {tab:'chat',sub:'user-profile'};
    if (scope === 'profile' || scope === 'userProfile') return {tab:'chat',sub:/^(name|header|meta|button)/.test(key) ? scope === 'profile' ? 'name' : 'user-name' : scope === 'profile' ? 'profile' : 'user-profile'};
    if (scope === 'type') return {tab:'text',sub:({dialogueSize:'dialogue',uiSize:'ui',codeSize:'code',para:'para',gutter:'para',measure:'para',indent:'para',align:'para'})[key] || 'text'};
    if (scope === 'markdown') return {tab:'text',sub:'markdown'};
    if (['dialogue','em','strong','ui','code','strike'].includes(scope)) return {tab:'text',sub:scope};
    if (scope === 'usageMode') return {tab:'theme',sub:'etc'};
    if (scope === 'updateCheck') return {tab:'theme',sub:'etc'};   // 새 버전 자동 확인 스위치는 기타 설정 화면 (1.0.0 바탕 — 옛 업데이트 · 설치 점검 탭은 없음)
    if (['headSwitchRows','koUi','longpressHelp','searchAi','logCopy','syncWatch'].includes(scope)) return {tab:'chat',sub:'etc'};   // 채팅 › 기타의 스위치 · searchAi(10-31 「AI 로 설정 바꾸기」) (예전엔 아래 끝 줄로 떨어져 채팅 › 화면으로 갔어요)
    if (scope === 'fruitTypography' || scope.startsWith('fruitEntry')) return {tab:'prompt',sub:'fruit'};
    if (['shadow','outline'].includes(scope)) return {tab:'text',sub:'shadow'};
    if (scope === 'image' && key === 'cutEdge') return {tab:'image',sub:'cutedge'}; // 6.1.6 투명 그림 외곽선 · 그림자
    if (scope === 'image') return {tab:'image',sub:key.startsWith('edge') || key === 'decor' ? 'frame' : /^(fit|maxh|height)$/.test(key) ? 'size' : /^(fade|blendWhite)/.test(key) ? 'shape' : key === 'layout' ? 'layout' : 'shape'};
    // 카드 · 색 통일 · 톤 값은 데우스 화면에 있다 (채팅 › 기타에는 커스텀 CSS 끄기만)
    if (scope === 'fruit') return {tab:'prompt',sub:'fruit'};
    if (scope === 'promptLink') return {tab:'prompt',sub:'fruit'};   // 6.5.2 캐릭터 이름 연동 (프롬프트 › 과일)
    if (scope === 'deus' || scope === 'chat' && /^(dem|unify|tone|markerTone|regexIcons)/.test(key)) return {tab:'prompt',sub:'deus'};
    if (scope === 'deviceLayouts') return {tab:'text',sub:'para'};
    if (scope === 'settingLocks') return {tab:'theme',sub:'backup'};
    if (scope === 'compat') return key === 'preserveExtensionColors' || key === 'extensionColorsOff' ? {tab:'theme',sub:'etc'} : {tab:'chat',sub:'etc'};
    if (scope === 'chat' && key === 'triangleFold') return {tab:'chat',sub:'etc'};
    if (scope === 'chat' && key === 'emptyGuard') return {tab:'chat',sub:'etc'};   // 성능 보조를 꺼도 쓰는 보호라 채팅 › 기타에 줄이 있어요
    if (scope === 'chat' && /^(user|header|char$|bubbleSplit$)/.test(key)) return {tab:'chat',sub:'message'};   // 캐릭터 메시지 · 말풍선 나누기도 메시지 화면
    return {tab:'chat',sub:'screen'};
}
