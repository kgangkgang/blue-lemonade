import { preserveLocks } from './setting-locks.js';
// 스타일 (3.1.0) — 지금 모습(팔레트 · 색 · 글꼴 · 글자 · 채팅 모양 · 이미지 모양)을 이름 붙여 저장하고, 코드 · 파일로 나누고,
// 완성된 스타일(소설책 · 메신저 …)을 입힌다. 캐릭터별 연결은 charstyle.js.
//
// 스타일에 담지 않는 것: 테마 켬/끔 · 공지 · 내 글꼴 목록 · 도형 목록 · 동작 설정(고르기 팝업 · 페이드 인 · 폰 접기 · 몰입 읽기 · 한 손 버튼)
// — 모양만 바꾸고 쓰는 방식은 그대로 두려고. 저장한 도형을 쓰는 스타일은 그림 대신 도형 id 만 담는다 (설정 파일이 무거워지지 않게).
import { getSettings, DEFAULTS, FONT_SET, isCssColor } from './settings.js';

export const STYLE_KEYS = ['gradients', 'palette', 'nightTint', 'lightTint', 'customName', 'colorOverrides', 'fonts', 'type', 'dialogue', 'ui', 'code', 'em', 'strong', 'shadow', 'chat', 'image', 'profile', 'userProfile'];
const CHAT_BEHAVIOR = ['triangleFold', 'weatherAutoRest', 'selectPop', 'colorPop', 'streamFade', 'demFold', 'qrFind'];
export const MAX_STYLES = 20;
const CODE_PREFIX = 'BLS1.';     // deflate-raw + base64url
const PLAIN_PREFIX = 'BLS0.';    // 압축 못 하는 브라우저: base64url 만

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
/** 스타일 칸의 값이 기본값과 같은 생김새인가 (객체 칸은 객체, 나머지는 같은 typeof) — fonts: "pretendard" 같은 것이 apply 를 죽였다 (5.1.2) */
const sameShape = (key, value) => isObj(DEFAULTS[key]) ? isObj(value) : typeof value === typeof DEFAULTS[key];
/** 직접 고친 색: 팔레트별 { token: 색 } 만 남긴다 — 색이 아닌 문자열은 <style> 에 규칙을 끼워 넣을 수 있다 (5.1.2) */
function cleanOverrides(overrides) {
    for (const [id, colors] of Object.entries(overrides)) {
        if (UNSAFE.has(id) || !isObj(colors)) { delete overrides[id]; continue; }
        for (const [token, value] of Object.entries(colors)) if (UNSAFE.has(token) || !(value === '' || isCssColor(value))) delete colors[token];
    }
}

/** 지금 설정에서 스타일 데이터 떼어 내기 */
export function captureStyle(s = getSettings()) {
    const data = {};
    for (const key of STYLE_KEYS) data[key] = structuredClone(s[key]);
    for (const key of CHAT_BEHAVIOR) delete data.chat[key];
    delete data.image.masks;
    if (data.image.maskId && s.image.masks?.some(m => m.id === data.image.maskId)) data.image.mask = '';
    if (data.chat.weatherImageId && s.weatherImages?.some(w => w.id === data.chat.weatherImageId)) data.chat.weatherImage = '';
    return data;
}

/** 스타일 데이터를 설정에 입히기 (일부만 든 스타일은 든 칸만). chat · image 는 칸 안의 값만 덮어 동작 설정 · 도형 목록은 남는다 */
export function applyStyleData(s, data) {
    if (!isObj(data)) return;
    const restoreLocked=preserveLocks(s);
    try {
    for (const key of STYLE_KEYS) {
        const value = data[key];
        if (value === undefined || value === null || !sameShape(key, value)) continue;
        if (key === 'chat' || key === 'image' || key === 'profile' || key === 'userProfile') {
            // 아는 칸만 (기본값에 있거나 정리된 설정에 이미 있는 이름) — Object.assign 은 own __proto__ 까지 옮겨 붙였다 (5.1.2)
            if (!isObj(s[key])) s[key] = structuredClone(DEFAULTS[key]);
            const target = s[key];
            for (const [k, v] of Object.entries(value)) {
                if (UNSAFE.has(k) || !(Object.hasOwn(DEFAULTS[key], k) || Object.hasOwn(target, k))) continue;
                if ((key === 'chat' && CHAT_BEHAVIOR.includes(k)) || (key === 'image' && k === 'masks')) continue;
                target[k] = structuredClone(v);
            }
            continue;
        }
        s[key] = structuredClone(value);
        if (key === 'colorOverrides') cleanOverrides(s[key]);
    }
    if (s.chat?.weatherImageId && !s.chat.weatherImage) {
        const pic = s.weatherImages?.find(w => w.id === s.chat.weatherImageId);
        if (pic) s.chat.weatherImage = pic.data;
    }
    // 도형 id 만 든 스타일: 내 도형 목록에서 그림을 찾아 채운다 (없으면 네모처럼 보임)
    if (s.image?.maskId && !s.image.mask) {
        const mask = s.image.masks?.find(m => m.id === s.image.maskId);
        if (mask) s.image.mask = mask.data;
    }
    } finally { restoreLocked(); }
}

/** 두 스타일이 같은 모습인가 (저장 · 되돌리기 판단) */
export function sameStyle(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// ───────── 완성된 스타일 ─────────
// 글자 · 채팅 모양만 바꾼다 (팔레트 · 직접 고친 색 · 이미지는 그대로 — 내 색을 잃지 않게)
const set = ko => ({ ...FONT_SET, ko });
export const PRESETS = [
    {
        id: 'default', name: '처음 모습', desc: '블루 레몬에이드 기본 글자',
        data: () => ({
            fonts: structuredClone(DEFAULTS.fonts), type: structuredClone(DEFAULTS.type), dialogue: structuredClone(DEFAULTS.dialogue),
            ui: structuredClone(DEFAULTS.ui), code: structuredClone(DEFAULTS.code), em: structuredClone(DEFAULTS.em), strong: structuredClone(DEFAULTS.strong),
            shadow: structuredClone(DEFAULTS.shadow), chat: { user: DEFAULTS.chat.user, header: DEFAULTS.chat.header, userSize: 100, userInk: 100 },
        }),
    },
    {
        id: 'novel', name: '소설책', desc: '바탕체 · 양쪽 정렬 · 들여쓰기',
        data: () => ({
            fonts: { ...structuredClone(DEFAULTS.fonts), text: set('ridibatang') },
            type: { ...structuredClone(DEFAULTS.type), size: 17, lineHeight: 1.9, letterSpacing: -2, para: 0.35, indent: true, align: 'justify-word', measure: 680 },
            dialogue: { ...structuredClone(DEFAULTS.dialogue), style: 'plain' },
            chat: { user: 'plain', header: 'name', userSize: 100, userInk: 85 },
        }),
    },
    {
        id: 'messenger', name: '메신저', desc: '작은 글자 · 말풍선 · 색 대사',
        data: () => ({
            fonts: { ...structuredClone(DEFAULTS.fonts), text: set('pretendard') },
            type: { ...structuredClone(DEFAULTS.type), size: 15, lineHeight: 1.65, letterSpacing: -1, para: 0.7, indent: false, align: 'left' },
            dialogue: { ...structuredClone(DEFAULTS.dialogue), style: 'tint', weight: 500 },
            chat: { user: 'bubble', header: 'full', userSize: 96, userInk: 100 },
        }),
    },
    {
        id: 'clear', name: '또렷하게', desc: '큰 글자 · 굵은 대사',
        data: () => ({
            fonts: { ...structuredClone(DEFAULTS.fonts), text: set('suit') },
            type: { ...structuredClone(DEFAULTS.type), size: 18, weight: 500, lineHeight: 1.85, letterSpacing: 0, para: 1, indent: false, align: 'left' },
            dialogue: { ...structuredClone(DEFAULTS.dialogue), style: 'bold', weight: 650 },
            strong: { ...structuredClone(DEFAULTS.strong), weight: 800 },
            chat: { user: 'card', header: 'name', userSize: 100, userInk: 100 },
        }),
    },
];

// ───────── 코드 · 파일 ─────────
const toBase64Url = (bytes) => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (text) => {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
};
async function pipeBytes(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
}

/** 스타일이 쓰는 내 글꼴(구글 · CSS · 올린 파일) 항목 — 받는 쪽 목록에 없으면 더해 준다 */
function usedCustomFonts(data, s) {
    const ids = new Set();
    for (const slot of Object.values(data.fonts || {})) {
        if (isObj(slot)) Object.values(slot).forEach(id => ids.add(id));
    }
    return (s.customFonts || []).filter(f => ids.has(f.id));
}

/** 나누기용 묶음: 저장한 도형은 그림을 채워 넣는다 (받는 쪽에는 그 도형이 없으니) */
export function sharePayload(name, data, s = getSettings()) {
    const style = structuredClone(data);
    if (style.image?.maskId && !style.image.mask) {
        const mask = s.image.masks?.find(m => m.id === style.image.maskId);
        if (mask) style.image.mask = mask.data;
    }
    if (style.image) style.image.maskId = '';
    if (style.chat?.weatherImageId && !style.chat.weatherImage) {
        const pic = s.weatherImages?.find(w => w.id === style.chat.weatherImageId);
        if (pic) style.chat.weatherImage = pic.data;
    }
    if (style.chat) style.chat.weatherImageId = '';
    return { saltyStyle: 1, name: String(name || '스타일').slice(0, 24), style, fonts: usedCustomFonts(style, s) };
}

export async function encodeStyle(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (typeof CompressionStream === 'function') {
        try {
            return CODE_PREFIX + toBase64Url(await pipeBytes(bytes, new CompressionStream('deflate-raw')));
        } catch { /* 아래로 */ }
    }
    return PLAIN_PREFIX + toBase64Url(bytes);
}

/** 코드 또는 파일 글자 → { name, style, fonts }. 모르는 것이면 오류 */
export async function decodeStyle(input) {
    const text = String(input || '').trim();
    let payload = null;
    if (text.startsWith('{')) {
        payload = JSON.parse(text);
    } else {
        const code = text.replace(/\s+/g, '');
        let bytes;
        if (code.startsWith(CODE_PREFIX)) {
            if (typeof DecompressionStream !== 'function') throw new Error('이 브라우저는 압축된 코드를 못 읽어요');
            bytes = await pipeBytes(fromBase64Url(code.slice(CODE_PREFIX.length)), new DecompressionStream('deflate-raw'));
        } else if (code.startsWith(PLAIN_PREFIX)) {
            bytes = fromBase64Url(code.slice(PLAIN_PREFIX.length));
        } else {
            throw new Error('블루 레몬에이드 스타일 코드가 아니에요');
        }
        payload = JSON.parse(new TextDecoder().decode(bytes));
    }
    if (!isObj(payload) || !payload.saltyStyle || !isObj(payload.style)) throw new Error('블루 레몬에이드 스타일이 아니에요');
    const style = {};
    for (const key of STYLE_KEYS) if (payload.style[key] !== undefined && sameShape(key, payload.style[key])) style[key] = payload.style[key]; // 생김새가 다른 칸은 버림 (5.1.2)
    if (style.colorOverrides) cleanOverrides(style.colorOverrides);
    if (!Object.keys(style).length) throw new Error('스타일 안에 든 값이 없어요');
    const fonts = Array.isArray(payload.fonts) ? payload.fonts.filter(f => isObj(f) && typeof f.id === 'string' && typeof f.family === 'string') : [];
    return { name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 24) : '받은 스타일', style, fonts };
}

// ───────── 캐릭터 열쇠 (charstyle.js · 설정 창) ─────────
/** 지금 열린 채팅의 캐릭터 · 그룹 열쇠 (없으면 '') */
export function currentKey() {
    const ctx = SillyTavern.getContext();
    if (ctx.groupId) return `g:${ctx.groupId}`;
    const avatar = ctx.characterId !== undefined && ctx.characterId !== null ? ctx.characters?.[ctx.characterId]?.avatar : '';
    return avatar ? `c:${avatar}` : '';
}

/** 열쇠 → 보이는 이름 */
export function keyLabel(key) {
    const ctx = SillyTavern.getContext();
    if (key.startsWith('g:')) return ctx.groups?.find(g => String(g.id) === key.slice(2))?.name || '그룹';
    const avatar = key.slice(2);
    return ctx.characters?.find(c => c.avatar === avatar)?.name || avatar.replace(/.png$/i, '');
}

// ───────── 목록 ─────────
export function newStyleId() {
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** 이름이 겹치면 뒤에 2, 3 … */
export function uniqueName(name, styles, exceptId = '') {
    const base = String(name || '스타일').trim().slice(0, 22) || '스타일';
    const taken = new Set(styles.filter(x => x.id !== exceptId).map(x => x.name));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** 받은 스타일의 내 글꼴 항목을 목록에 더하기 (같은 id 가 있으면 그대로) */
export function mergeFonts(s, fonts) {
    let added = 0;
    for (const font of fonts || []) {
        if (s.customFonts.some(f => f.id === font.id)) continue;
        s.customFonts.push(structuredClone(font));
        added++;
    }
    return added;
}
