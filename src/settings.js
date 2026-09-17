// 설정 저장 칸: extension_settings.salty
import { PALETTES, PALETTE_ALIASES } from './palettes.js';

export const KEY = 'salty';
export const VERSION = 3; // 설정 구조 버전 (1.0.0 = 1 · 1.4 = 2)

// 언어별 글꼴 묶음. en/ja/zh 가 'auto' 면 한국어 글꼴이 그 글자도 맡음.
export const FONT_SET = { ko: 'pretendard', en: 'auto', ja: 'auto', zh: 'auto' };
// 글꼴 칸: 본문 · 대사 · 메뉴 · 속마음(*기울임*) · 강조(**굵게**) · 코드(`코드`)
export const FONT_SLOTS = ['text', 'dialogue', 'ui', 'em', 'strong', 'code'];

export const DEFAULTS = {
    version: VERSION,
    enabled: true,
    noticeSeen: '', // 3.0.0: 공지사항을 열어 본 마지막 버전 — 지금 버전이 더 새것이면 버전 알약이 빛난다 (notice.js)
    palette: 'salt',
    customName: '', // 커스텀 에이드 이름. 색은 기존 colorOverrides에 모드별로 저장.
    colorOverrides: {},           // { [paletteId]: { token: color } }
    fonts: {
        text: { ...FONT_SET },    // 본문
        dialogue: 'same',         // 대사: 'same' | { ko, en, ja, zh }
        ui: 'same',               // 메뉴: 'same' | { ko, en, ja, zh }
        em: 'same',               // 속마음(*기울임*): 'same'(둘레 글꼴 그대로) | { ko, en, ja, zh }
        strong: 'same',           // 강조(**굵게**): 'same' | { ko, en, ja, zh }
        code: { ...FONT_SET, ko: 'neodgm' }, // 코드(`코드`): 기본은 도트 글꼴 Neo둥근모 — 'same' 이면 둘레 글꼴 그대로
        hanja: 'auto',            // 한자(漢字)는 어느 글꼴로: auto | ko | ja | zh
    },
    customFonts: [],              // [{ id, label, family, group: 'custom', lang?, google? | css? | file? }]
    type: {
        size: 16,                 // px, 본문
        dialogueSize: null,       // px, 대사 — null = 본문과 같게
        uiSize: null,             // px, 메뉴(실리태번 화면 글자) — null = 실리태번 글자 배율 그대로
        codeSize: null,           // px, 코드(`코드`) — null = 본문과 같게
        lineHeight: 1.8,
        letterSpacing: -1,        // 1/100 em
        weight: 400,
        para: 0.9,                // em, 문단 사이
        measure: 720,             // px, PC 본문 최대 폭
        gutter: 20,               // px, 좌우 여백
        indent: false,
        align: 'left',            // left 왼쪽 | justify-word 양쪽(낱말 안 끊음) | justify-break 양쪽(한글도 음절 사이에서 끊음)
    },
    dialogue: { style: 'marker', weight: 400, tilt: 'flat', markerThick: 54, markerPos: 'center', letterSpacing: null }, // letterSpacing: 1/100 em, null = 본문과 같게 (2.7.0)
    ui: { weight: null, letterSpacing: null },   // 메뉴 글자 굵기 · 자간 — null = 실리태번 기본 (2.7.0; 크기는 type.uiSize)
    code: { weight: null, letterSpacing: null }, // 코드 글자 굵기 · 자간 — null = 둘레 글자 그대로 (2.7.0; 크기는 type.codeSize)
    // 글자 그림자 (2.4.0): 켬/끔 + 어디에(본문 · 대사 · 속마음 · 강조 · 코드) + 모양 하나. 기본 끔 — 폰에서 text-shadow 는 번질 수 있음. angle 도 · distance/blur px · alpha %
    shadow: { on: false, targets: { text: false, dialogue: true, em: false, strong: false, code: false }, color: '#000000', alpha: 45, angle: 135, distance: 2, blur: 3 },   // style: marker | full | bold | tint | plain · tilt(형광펜 기울기): flat | slant | steep · markerThick(형광펜 두께): 글자 상자 높이 % · markerPos(위치): center 가운데 | bottom 아래(기울기를 눕혀 밑줄처럼 — 두께는 굵기 값 그대로)
    em: { italic: false, weight: 400, size: null, letterSpacing: null },   // *속마음* — 기울일지, 굵기, 크기(px · null = 본문과 같게), 자간(1/100 em · null = 본문과 같게)
    strong: { weight: 650, size: null, letterSpacing: null },              // **강조**
    chat: { user: 'bubble', header: 'full', userSize: 100, userInk: 100, icons: 'line', bgImage: false, unifyRegex: true, unifyInline: true, regexIcons: false, selectPop: true, streamFade: false, demSkin: false, demFold: true, toneInline: false, tone: { light: { s: 58, l: 38 }, dark: { s: 70, l: 74 } } }, // streamFade: 스트리밍 중 새 글자만 가볍게 페이드 인 (2.9.5, streamfade.js — 실리태번 페이드 인이 켜져 있으면 쉼) · tone: 톤 맞추기의 채도 · 밝기(%) 화이트/나이트 따로 (2.6.1) · toneInline: 본문 글자색의 색상만 두고 채도 · 밝기를 테마에 맞춤 (2.6.0, unifyInline 이 꺼져 있을 때) · selectPop: 실리태번 select 를 테마가 그린 목록 팝업으로 (2.5.0) · regexIcons: 정규식 카드 제목 앞 이모티콘 보이기 · unifyRegex: 프리셋 정규식 카드(DEM 등)의 모듈별 색 → 포인트색 하나 · unifyInline: 메시지에 적힌 글자색(<font color> · style) 무시
    // 3.1.0: 몰입 읽기(폰 — 아래로 밀면 위 바 · 입력창 숨김, reader.js) · 한 손 버튼 줄(입력판 위 ‹ › 사칭 · 이어 쓰기 · 다시 생성, onehand.js)
    reader: { autoHide: false },
    onehand: { on: false, swipe: true, imp: true, cont: true, regen: true },
    // 3.1.0 스타일: 내 스타일 목록 [{ id, name, data }] · 캐릭터 연결 { 'c:아바타' | 'g:그룹': 스타일 id } · 지금 입힌 캐릭터 스타일 { id, key } · 그 전 원래 모습 (styles.js · charstyle.js)
    styles: [],
    charStyles: {},
    activeStyle: null,
    baseStyle: null,
    image: { layout: 'bleed', shape: 'rect', fit: 'ratio', maxh: 78, height: 40, blendWhite: true, cutoutSame: true, fade: 'soft', fadeY: 10, fadeX: 0, angle: 3, radius: 14, cornerCut: 10, scratchAmount: 45, scratchDirection: 'straight', scratchTexture: 'sharp', edge: 'none', edgeAuto: true, edgeSideTop: true, edgeSideRight: true, edgeSideBottom: true, edgeSideLeft: true, edgeThick: 1, edgeAlpha: 30, edgeGlow: 0, mask: '', maskFit: 'stretch', masks: [], maskId: '' }, // shape: rect | custom(mask = 투명 PNG data URL, maskFit: stretch | contain) — angle · cornerCut · scratch* 는 뺀 모양의 옛 값(CSS 는 남아 있음) · fit(크기): ratio 비율 유지(maxh = 최대 높이) | fixed 높이 맞춤(height = 높이), 둘 다 화면 높이 % · fade(흐림): off | soft | medium | strong · angle: 대각선 기울기(도)
};

function fill(target, defaults) {
    for (const [key, value] of Object.entries(defaults)) {
        if (target[key] === undefined) {
            target[key] = structuredClone(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object') {
            fill(target[key], value);
        }
    }
    return target;
}

/** 예전 설정 → 지금 구조. 1 → 2: 글꼴이 언어별 묶음으로 */
function migrate(s) {
    const from = s.version || 1;
    if (from >= VERSION) return s;
    if (from < 2) {
        const f = s.fonts || {};
        const toSet = id => ({ ...FONT_SET, ko: typeof id === 'string' && id !== 'same' ? id : FONT_SET.ko });
        const text = typeof f.text === 'string' ? toSet(f.text) : (f.text && typeof f.text === 'object' ? { ...FONT_SET, ...f.text } : { ...FONT_SET });
        const dialogue = typeof f.dialogue === 'string' ? (f.dialogue === 'same' ? 'same' : toSet(f.dialogue)) : (f.dialogue || 'same');
        let ui = typeof f.ui === 'string' ? (f.ui === 'same' ? 'same' : toSet(f.ui)) : (f.ui || 'same');
        if (ui !== 'same' && ui.ko === text.ko) ui = 'same';
        s.fonts = { text, dialogue, ui, hanja: f.hanja || 'auto' };
        if (s.chat?.user === 'line') s.chat.user = 'plain';
    }
    // 2 → 3: 양쪽 정렬 켜기/끄기(type.justify) → 정렬 방식(type.align). 가져온 파일에도 남아 있을 수 있어 tidyType 이 매번 바꿈
    s.version = VERSION;
    return s;
}

const TILT_RENAME = { slight: 'slant', more: 'steep' }; // 1.2.0 초안 이름
const IMAGE_SHAPES = ['rect', 'custom']; // 에셋 이미지 모양: 네모 | custom = 내가 고른 투명 PNG 의 알파를 마스크로 (2.2.1 에 대각선 · 코너 컷 · 스크래치를 뺌 → 예전 값은 네모로)
const MASK_FITS = ['stretch', 'contain']; // 커스텀 도형을 그림에 맞추는 법: 늘리기(그림 상자 가득) | 맞추기(비율 유지, 가운데)
const IMAGE_FITS = ['ratio', 'fixed']; // 에셋 이미지 크기: 비율 유지 | 높이 맞춤
// 값 문자열은 예전 설정 호환 때문에 고정 — 1.6.0 에서 그림만 바뀌었다 (안쪽은 outline 한 줄, 바깥은 면마다 다른 색)
const IMAGE_EDGES = ['none', 'line', 'inset', 'glow', 'prism']; // 그림 테두리: 없음 | 선(면마다 다른 색 띠) | 안쪽(눌린 단면) | 빛(바깥 블룸 3겹) | 프리즘(하늘 · 민트 · 레몬 · 살구 + 남색 대기광)
const IMAGE_FADES = ['off', 'soft', 'medium', 'strong']; // 에셋 이미지 흐림: 끔 | 약함 | 중간 | 강함
// 네 단계는 CSS 클래스(salty-fade-*)의 출처로 남긴다 — 여백 · 마스크 모양이 단계별로 다르다.
// 실제 번짐 폭은 fadeY · fadeX(%) 가 정하고, 단계를 고르면 그 값이 아래 표대로 채워진다
export const FADE_AMOUNT = { off: [0, 0], soft: [10, 0], medium: [18, 6], strong: [30, 22] };
export const IMAGE_RANGE = { maxh: [15, 100], height: [15, 90], angle: [-15, 15], cornerCut: [3, 25], scratchAmount: [0, 100], fadeY: [0, 45], fadeX: [0, 35], edgeThick: [1, 8], edgeAlpha: [10, 100], edgeGlow: [0, 40] }; // maxh · height = 화면 높이 %, angle = 대각선 기울기(도) — 설정 창 슬라이더도 이 범위를 씀

/** 1.4.0 까지의 위아래 흐림 %(0~20) → 가까운 단계 (약함 6 · 중간 12 · 강함 20 기준). 0 만 끔 — 조금이라도 켰으면 약함부터 */
function fadeLevel(value) {
    const v = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(v)) return DEFAULTS.image.fade;
    if (v <= 0) return 'off';
    return v < 9 ? 'soft' : v < 16 ? 'medium' : 'strong';
}

/** 에셋 이미지 크기 · 흐림 정리. 예전엔 maxh(최대 높이 40~100)만 있었음 → 뜻이 같아서 값 그대로 '비율 유지'의 최대 높이로 씀 */
function tidyImage(image) {
    if (!['straight', 'diagonal'].includes(image.scratchDirection)) image.scratchDirection = 'straight';
    if (!['sharp', 'soft'].includes(image.scratchTexture)) image.scratchTexture = 'sharp';
    if (!IMAGE_FITS.includes(image.fit)) image.fit = 'ratio';
    if (!IMAGE_FADES.includes(image.fade)) image.fade = fadeLevel(image.fade);
    if (!IMAGE_EDGES.includes(image.edge)) image.edge = 'none';
    // 커스텀 도형의 마스크는 data URL 만 (아직 안 골랐으면 빈 값 — 모양은 custom 인 채로 두어 고르기 칸이 보이게, CSS 는 mask none 이라 그대로 보임)
    if (typeof image.mask !== 'string' || !image.mask.startsWith('data:image/')) image.mask = '';
    if (!MASK_FITS.includes(image.maskFit)) image.maskFit = 'stretch';
    // 저장한 도형 목록 [{ id, name, data }] — 깨진 항목은 버리고, 가리키는 칸이 없으면 '저장 안 된 그림' 상태로
    if (!Array.isArray(image.masks)) image.masks = [];
    image.masks = image.masks.filter(item => item && typeof item === 'object' && typeof item.id === 'string' && item.id && typeof item.data === 'string' && item.data.startsWith('data:image/'))
        .map(item => ({ id: item.id, name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 24) : '커스텀', data: item.data }));
    if (typeof image.maskId !== 'string' || !image.masks.some(item => item.id === image.maskId)) image.maskId = '';
    // 자동 색은 불리언 — 가져온 파일의 "false" 는 문자열이라 그냥 두면 참으로 읽힌다 (tidyType 의 justify 와 같은 방식).
    // fill() 이 먼저 돌아 없는 키는 이미 기본값이라 여기서 undefined 를 볼 일은 없다 — 이 줄은 반드시 fill() 뒤여야 한다
    image.edgeAuto = image.edgeAuto === true || image.edgeAuto === 'true';
    // 투명 배경 캐릭터 컷도 보통 그림과 같은 모양 · 흐림 · 테두리 (2.7.8, 기본 켬) — 끄면 예전처럼 자르지 않고 아래만 살짝 흐림
    image.cutoutSame = image.cutoutSame !== false && image.cutoutSame !== 'false';
    // 테두리를 그릴 면 — 가져온 설정의 문자열 "false" 를 걸러낸다 (자동 색과 같은 방식)
    for (const face of ['Top', 'Right', 'Bottom', 'Left']) {
        const key = `edgeSide${face}`;
        image[key] = image[key] === true || image[key] === 'true';
    }
    for (const [key, [min, max]] of Object.entries(IMAGE_RANGE)) {
        const v = typeof image[key] === 'number' ? image[key] : parseFloat(image[key]);
        image[key] = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : DEFAULTS.image[key];
    }
}

const ALIGNS = ['left', 'justify-word', 'justify-break'];
const MARKER_POSITIONS = ['center', 'bottom'];
// 가져온 파일 · 손으로 고친 값 거르기용 한계: 크기 px, 형광펜 두께 %
// 두께 아래 10 은 눈금이 아니라 '보이는 획'의 한계 — 5~9 는 화면에서 획이 사라짐 (apply.js MIN_THICK 과 같은 값)
export const TEXT_LIMIT = { dialogueSize: [8, 40], uiSize: [8, 32], codeSize: [8, 32], markerThick: [10, 100], roleSize: [8, 40], letterSpacing: [-10, 20], weight: [100, 900] };

/** 역할별 글자 값(2.7.0): 크기 px · 자간 1/100 em · 굵기 — 없음(null) 은 그대로, 숫자는 범위 안으로 */
function tidyRoles(s) {
    const num = (v, range, allowNull = true) => {
        const n = v === null || v === undefined ? NaN : (typeof v === 'number' ? v : parseFloat(v));
        return Number.isFinite(n) ? clampTo(n, range) : (allowNull ? null : range[0]);
    };
    for (const role of ['em', 'strong']) {
        if (!isObj(s[role])) continue;
        s[role].size = num(s[role].size, TEXT_LIMIT.roleSize);
        s[role].letterSpacing = num(s[role].letterSpacing, TEXT_LIMIT.letterSpacing);
        s[role].weight = num(s[role].weight, TEXT_LIMIT.weight) ?? DEFAULTS[role].weight;
    }
    if (isObj(s.dialogue)) {
        s.dialogue.letterSpacing = num(s.dialogue.letterSpacing, TEXT_LIMIT.letterSpacing);
        s.dialogue.weight = num(s.dialogue.weight, TEXT_LIMIT.weight) ?? DEFAULTS.dialogue.weight;
    }
    for (const role of ['ui', 'code']) {
        if (!isObj(s[role])) s[role] = structuredClone(DEFAULTS[role]);
        s[role].weight = num(s[role].weight, TEXT_LIMIT.weight);
        s[role].letterSpacing = num(s[role].letterSpacing, TEXT_LIMIT.letterSpacing);
    }
    // 내 메시지 크기(본문의 %) · 진하기(%) (2.7.3) — 없으면 100 = 캐릭터 글과 같게
    if (isObj(s.chat)) {
        s.chat.userSize = num(s.chat.userSize, [60, 140]) ?? 100;
        s.chat.userInk = num(s.chat.userInk, [30, 100]) ?? 100;
    }
}
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const flag = (v, def) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : def);

/** 3.1.0 스타일 목록 · 캐릭터 연결: 깨진 항목만 걸러 낸다 (멀쩡하면 배열을 새로 만들지 않음 — getSettings 는 자주 불림) */
function tidyStyles(s) {
    const okStyle = x => isObj(x) && typeof x.id === 'string' && x.id && isObj(x.data);
    if (!Array.isArray(s.styles)) s.styles = [];
    else if (s.styles.length > 20 || !s.styles.every(okStyle)) s.styles = s.styles.filter(okStyle).slice(0, 20);
    for (const style of s.styles) {
        if (typeof style.name !== 'string' || !style.name.trim() || style.name.length > 24) style.name = (typeof style.name === 'string' && style.name.trim() ? style.name.trim() : '스타일').slice(0, 24);
    }
    if (!isObj(s.charStyles)) s.charStyles = {};
    for (const [key, id] of Object.entries(s.charStyles)) {
        if (!/^[cg]:./.test(key) || typeof id !== 'string' || !s.styles.some(x => x.id === id)) delete s.charStyles[key];
    }
    if (s.activeStyle !== null && !(isObj(s.activeStyle) && typeof s.activeStyle.id === 'string' && typeof s.activeStyle.key === 'string')) s.activeStyle = null;
    if (s.baseStyle !== null && !isObj(s.baseStyle)) s.baseStyle = null;
}

/** 3.1.0 켜고 끄는 값: 가져온 파일의 "false" 문자열 · 깨진 값 거르기 */
function tidyFlags(s) {
    if (!isObj(s.reader)) s.reader = structuredClone(DEFAULTS.reader);
    s.reader.autoHide = flag(s.reader.autoHide, false);
    if (!isObj(s.onehand)) s.onehand = structuredClone(DEFAULTS.onehand);
    for (const key of Object.keys(DEFAULTS.onehand)) s.onehand[key] = flag(s.onehand[key], DEFAULTS.onehand[key]);
    if (isObj(s.chat)) {
        s.chat.demSkin = flag(s.chat.demSkin, false);
        s.chat.demFold = flag(s.chat.demFold, true);
    }
}
const clampTo = (v, [min, max]) => Math.min(max, Math.max(min, v));

/** 글자 크기 · 정렬 정리. 1.4 까지의 양쪽 정렬 켜기/끄기 → 정렬 방식 (켜져 있었으면 지금과 같은 '낱말 안 끊음') */
function tidyType(type) {
    if (type.justify !== undefined) {
        type.align = type.justify === true || type.justify === 'true' ? 'justify-word' : 'left';
        delete type.justify;
    }
    if (!ALIGNS.includes(type.align)) type.align = 'left';
    for (const key of ['dialogueSize', 'uiSize', 'codeSize']) {
        const v = type[key] === null ? NaN : (typeof type[key] === 'number' ? type[key] : parseFloat(type[key]));
        type[key] = Number.isFinite(v) && v > 0 ? clampTo(v, TEXT_LIMIT[key]) : null; // null = 따로 안 정함
    }
}

/** 형광펜 두께 · 위치 정리 */
export const SHADOW_LIMIT = { alpha: [0, 100], angle: [0, 360], distance: [0, 12], blur: [0, 24] };
export const SHADOW_TARGETS = ['text', 'dialogue', 'em', 'strong', 'code'];

function tidyDialogue(d) {
    if (!MARKER_POSITIONS.includes(d.markerPos)) d.markerPos = 'center';
    const v = typeof d.markerThick === 'number' ? d.markerThick : parseFloat(d.markerThick);
    d.markerThick = Number.isFinite(v) ? clampTo(v, TEXT_LIMIT.markerThick) : DEFAULTS.dialogue.markerThick;
}

/** 글자 그림자: 켬/끔 · 대상은 불리언, 색은 #rrggbb, 숫자는 범위 안. 2.3.0 의 dialogue.shadow(대사만) 는 여기로 옮김 */
function tidyShadow(s) {
    const old = s.dialogue?.shadow;
    if (!isObj(s.shadow)) s.shadow = structuredClone(DEFAULTS.shadow);
    if (isObj(old)) {
        Object.assign(s.shadow, { on: old.on, color: old.color, alpha: old.alpha, angle: old.angle, distance: old.distance, blur: old.blur });
        delete s.dialogue.shadow;
    }
    const sh = s.shadow;
    sh.on = sh.on === true || sh.on === 'true';
    if (!isObj(sh.targets)) sh.targets = structuredClone(DEFAULTS.shadow.targets);
    for (const key of SHADOW_TARGETS) sh.targets[key] = sh.targets[key] === true || sh.targets[key] === 'true';
    if (!/^#[0-9a-f]{6}$/i.test(String(sh.color))) sh.color = DEFAULTS.shadow.color;
    for (const [key, range] of Object.entries(SHADOW_LIMIT)) {
        const n = Number(sh[key]);
        sh[key] = Number.isFinite(n) ? clampTo(n, range) : DEFAULTS.shadow[key];
    }
}

/** 속마음 · 강조 글꼴: 'same' | 언어별 묶음. 글꼴 id 한 개(문자열)면 한국어 칸으로. 묶음은 그 자리에서 채움(설정 창이 잡고 있는 객체 유지) */
function tidyFontSlot(fonts, slot) {
    const v = fonts[slot];
    if (v === 'same') return;
    if (typeof v === 'string' && v) fonts[slot] = { ...FONT_SET, ko: v };
    else if (isObj(v)) { for (const [lang, id] of Object.entries(FONT_SET)) if (typeof v[lang] !== 'string' || !v[lang]) v[lang] = id; }
    else fonts[slot] = 'same';
}

export function getSettings() {
    const ext = SillyTavern.getContext().extensionSettings;
    if (!ext[KEY]) ext[KEY] = structuredClone(DEFAULTS);
    migrate(ext[KEY]);
    const s = fill(ext[KEY], DEFAULTS);
    if (TILT_RENAME[s.dialogue?.tilt]) s.dialogue.tilt = TILT_RENAME[s.dialogue.tilt];
    if (isObj(s.dialogue)) tidyDialogue(s.dialogue);
    tidyShadow(s);
    if (isObj(s.type)) tidyType(s.type);
    tidyRoles(s);
    if (isObj(s.fonts)) ['em', 'strong', 'code'].forEach(slot => tidyFontSlot(s.fonts, slot));
    if (s.image && !IMAGE_SHAPES.includes(s.image.shape)) s.image.shape = 'rect'; // 모르는 모양(가져온 파일 · 뺀 유리 조각 · 물방울) → 네모
    if (s.image) tidyImage(s.image);
    if (PALETTE_ALIASES[s.palette]) s.palette = PALETTE_ALIASES[s.palette];
    if (!PALETTES[s.palette]) s.palette = 'salt';
    delete s.pastel; // 1.8.2~1.9.1 의 파스텔 스위치 — 파스텔로 정착하며 없앰 (id 는 PALETTE_ALIASES 가 원래 id 로)
    s.customName = typeof s.customName === 'string' ? s.customName.trim().slice(0, 24) : '';
    s.noticeSeen = typeof s.noticeSeen === 'string' ? s.noticeSeen.slice(0, 20) : '';
    tidyFlags(s);
    tidyStyles(s);
    for (const id of Object.keys(s.colorOverrides || {})) if (!PALETTES[id]) delete s.colorOverrides[id];
    return s;
}

export function saveSettings() {
    SillyTavern.getContext().saveSettingsDebounced();
}

export function resetSettings() {
    const ext = SillyTavern.getContext().extensionSettings;
    const keepFonts = ext[KEY]?.customFonts || [];
    const keepSeen = ext[KEY]?.noticeSeen || ''; // 초기화해도 이미 본 공지가 다시 빛나지 않게
    const keepStyles = ext[KEY]?.styles || []; // 내 스타일 · 캐릭터 연결도 남김 (입혀 둔 캐릭터 스타일 상태는 비움)
    const keepLinks = ext[KEY]?.charStyles || {};
    ext[KEY] = structuredClone(DEFAULTS);
    ext[KEY].customFonts = keepFonts;
    ext[KEY].noticeSeen = keepSeen;
    ext[KEY].styles = keepStyles;
    ext[KEY].charStyles = keepLinks;
    saveSettings();
    return ext[KEY];
}

/** 글꼴 묶음 꺼내기 (slot: text | dialogue | ui | em | strong). 'same' 이면 본문 묶음. */
export function fontSet(s, slot) {
    const v = s.fonts[slot];
    if (slot === 'text') return v;
    return v === 'same' ? s.fonts.text : v;
}
