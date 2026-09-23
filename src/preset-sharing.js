import { preserveLocks } from './setting-locks.js';
// Portable, opt-in appearance presets. Never include chats, addon credentials or libraries.
import { WEATHER_FIELDS, WEATHER_MODES } from './weather-profiles.js';
import { DEFAULTS } from './settings.js';
import { PALETTES } from './palettes.js';
import { GRADIENT_KEYS } from './gradients.js';

export const PRESET_GROUPS = [
    ['marker', '형광펜'], ['text', '글꼴 · 글자 · 문단'], ['colors', '테마 색'],
    ['profile', '프로필 · 이름'], ['image', '이미지 모양'], ['weather', '날씨'], ['chat', '채팅 모양'],
];
const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
const marker = new Set(['style', 'markerShape', 'tilt', 'markerThick', 'markerPos']);
const chatKeys = new Set(['user', 'header', 'userSize', 'userInk', 'icons', 'bgImage', 'bgAlpha']);
const privateKeys = new Set(['art','mask','masks','maskId','libraryId','presetVersion','weatherImage','weatherImageId']);
const weatherStrings = new Set(['weather','weather2','weatherArtStyle','weatherMotion','weatherOrbitDirection','weatherColorMode','weatherColor','weatherColor2','weatherShadowStyle','weatherWaterStyle','weatherWaterArea','weatherSunStyle','weatherStarStyle','weatherFogStyle','weatherFogArea']);
function template(path) {
    const parts=path.split('.');
    if (parts.some(k=>unsafe.has(k)||privateKeys.has(k))) return undefined;
    if (parts[0]==='colorOverrides'&&parts.length===3&&Object.hasOwn(PALETTES,parts[1])&&Object.hasOwn(PALETTES[parts[1]].colors||PALETTES[parts[1]],parts[2])) return '';
    if (parts[0]==='gradients'&&parts[1]==='overrides'&&parts.length===5&&Object.hasOwn(PALETTES,parts[2])&&GRADIENT_KEYS.includes(parts[3])) return ({mode:'',colors:[''],angle:0,weights:[0]})[parts[4]];
    if (parts[0]==='fonts'&&parts.length===3&&Object.hasOwn(DEFAULTS.fonts,parts[1])&&['ko','en','ja','zh'].includes(parts[2])) return '';
    if (parts[0]==='chat') {
        const key=parts[1]==='weatherProfiles'&&parts.length===4&&WEATHER_MODES.includes(parts[2])?parts[3]:parts.length===2?parts[1]:'';
        if (WEATHER_FIELDS.includes(key)||['weather','weather2','weather2Level','weather2Amount','weatherBubble'].includes(key)) return ['weatherAmount','weather2Amount'].includes(key)?null:weatherStrings.has(key)?'':['weatherIllustrated','weatherArtOutline','weatherBubble'].includes(key)?false:0;
    }
    let v=DEFAULTS;for(const key of parts){if(!v||typeof v!=='object'||!Object.hasOwn(v,key))return undefined;v=v[key];}
    return v;
}
function groupFor(path) {
    const [a,b,c,d] = path.split('.');
    const shape=template(path);
    if (shape===undefined||(shape&&typeof shape==='object'&&!Array.isArray(shape))) return '';
    if (a==='dialogue') return marker.has(b)?'marker':'text';
    if (a==='colorOverrides'||a==='gradients') {
        if ((a==='colorOverrides'&&c==='marker')||(a==='gradients'&&b==='overrides'&&d==='marker')) return 'marker';
        return 'colors';
    }
    if (['palette','nightTint','lightTint','customName'].includes(a)) return 'colors';
    if (['fonts','type','ui','code','em','strong','shadow','outline'].includes(a)) return 'text';
    if (['profile','userProfile'].includes(a)) return 'profile';
    if (a==='image') return 'image';
    if (a==='chat') {
        if (b==='markerTone') return 'marker';
        if (chatKeys.has(b)) return 'chat';
        if (['weather','weather2','weather2Level','weather2Amount','weatherBubble','weatherReadability'].includes(b)||WEATHER_FIELDS.includes(b)) return 'weather';
        if (b==='weatherProfiles'&&WEATHER_MODES.includes(c)&&WEATHER_FIELDS.includes(d)) return 'weather';
    }
    return '';
}
function flatten(value, path='', result={}) {
    if (value&&typeof value==='object'&&!Array.isArray(value)) {
        for (const [key,v] of Object.entries(value)) {
            if (unsafe.has(key)||key.includes('.')) throw new Error('지원하지 않는 설정 이름이에요');
            flatten(v,path?`${path}.${key}`:key,result);
        }
    } else if (path&&groupFor(path)) result[path]=value;
    return result;
}
function validValue(v) {return v===null||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&v.length<=2048)||(Array.isArray(v)&&v.length<=10&&v.every(x=>!Array.isArray(x)&&validValue(x)));}
function validField(path,value) {
    const shape=template(path);
    if(!validValue(value))return false;
    if(shape===null)return value===null||typeof value==='number';
    if(Array.isArray(shape))return Array.isArray(value)&&value.every(v=>typeof v===typeof shape[0]);
    return typeof value===typeof shape;
}
export function capturePreset(settings, selected) {
    const groups={};const pick=new Set(selected);
    for (const [path,value] of Object.entries(flatten(settings))) {
        const group=groupFor(path);if (!pick.has(group)||!validField(path,value)) continue;
        (groups[group]??={})[path]=structuredClone(value);
    }
    return {blueLemonadePreset:true,version:1,groups};
}
export function readPreset(data) {
    if (!data||data.blueLemonadePreset!==true||data.version!==1||!data.groups||typeof data.groups!=='object'||Array.isArray(data.groups)) throw new Error('선택 공유 프리셋 파일이 아니에요');
    const groups={};let count=0;
    for (const [id] of PRESET_GROUPS) {
        const values=data.groups[id];if (!values) continue;
        if (typeof values!=='object'||Array.isArray(values)) throw new Error('프리셋 내용이 올바르지 않아요');
        for (const [path,value] of Object.entries(values)) {
            if (path.length>180||path.split('.').some(k=>unsafe.has(k))||groupFor(path)!==id||!validField(path,value)||++count>5000) throw new Error('프리셋에 지원하지 않는 값이 있어요');
            (groups[id]??={})[path]=value;
        }
    }
    if (!Object.keys(groups).length) throw new Error('불러올 설정이 없어요');
    return {blueLemonadePreset:true,version:1,groups};
}
export function applyPreset(settings, raw, selected) {
    const data=readPreset(raw), pick=new Set(selected);
    const restoreLocked=preserveLocks(settings);
    try {
    for (const [id,values] of Object.entries(data.groups)) {
        if (!pick.has(id)) continue;
        for (const [path,value] of Object.entries(values)) {
            const parts=path.split('.');let parent=settings;
            for (const key of parts.slice(0,-1)) {
                if (!parent[key]||typeof parent[key]!=='object'||Array.isArray(parent[key])) parent[key]={};
                parent=parent[key];
            }
            if (parts[0] === 'gradients' && parts[1] === 'overrides' && parts.at(-1) === 'mode' && value === 'inherit') {
                delete settings.gradients.overrides[parts[2]][parts[3]];
            } else parent[parts.at(-1)]=structuredClone(value);
        }
    }
    if (pick.has('weather')&&data.groups.weather) settings.chat.weatherProfileMode=settings.chat.weather;
    } finally { restoreLocked(); }
}
