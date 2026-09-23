import { syncDeviceLayout, saveDeviceLayout } from './device-layouts.js';
import { MASK_STYLES, normalizeMaskStyle } from './capture-style.js';
import { MIX_DEFAULT, tidyGradients } from './gradients.js';
import { tidyPins } from './mes-pins.js';
import { syncWeatherProfile } from './weather-profiles.js';
import { tidyFrameLibrary } from './frame-library.js';
import { DECOR_DEFAULTS, tidyDecor } from './decor.js';
import { FRAME_DEFAULTS, FRAME_RANGE, tidyFrame } from './frames.js';
// 설정 저장 칸: extension_settings.salty
import { PALETTES, PALETTE_ALIASES } from './palettes.js';

export const KEY = 'salty';
export const VERSION = 4; // 설정 구조 버전 (1.0.0 = 1 · 1.4 = 2 · 4.3.4 = 4)

// 언어별 글꼴 묶음. en/ja/zh 가 'auto' 면 한국어 글꼴이 그 글자도 맡음.
export const FONT_SET = { ko: 'pretendard', en: 'auto', ja: 'auto', zh: 'auto' };
// 글꼴 칸: 본문 · 대사 · 메뉴 · 속마음(*기울임*) · 강조(**굵게**) · 코드(`코드`)
export const FONT_SLOTS = ['text', 'dialogue', 'ui', 'em', 'strong', 'code', 'name', 'userName'];

export const DEFAULTS = {
    version: VERSION,
    enabled: true,
    appearanceHistory: [],
    settingLocks: {fonts:false,size:false,spacing:false,colors:false,profile:false},
    deviceLayouts: { on: false, pc: {}, mobile: {} },
    gradients: { light: structuredClone(MIX_DEFAULT), dark: structuredClone(MIX_DEFAULT), overrides: {} },
    frameLibrary: [],
    noticeSeen: '', // 3.0.0: 공지사항을 열어 본 마지막 버전 — 지금 버전이 더 새것이면 버전 알약이 빛난다 (notice.js)
    palette: 'salt',
    nightTint: 1,                // Stock night surfaces: theme-color mix, 1–20%.
    lightTint: .5,               // Stock light surfaces: theme-color mix, 0.5–20%.
    customName: '', // 커스텀 에이드 이름. 색은 기존 colorOverrides에 모드별로 저장.
    colorOverrides: {},           // { [paletteId]: { token: color } }
    fonts: {
        text: { ...FONT_SET },    // 본문
        dialogue: 'same',         // 대사: 'same' | { ko, en, ja, zh }
        ui: 'same',               // 메뉴: 'same' | { ko, en, ja, zh }
        em: 'same',               // 속마음(*기울임*): 'same'(둘레 글꼴 그대로) | { ko, en, ja, zh }
        strong: 'same',           // 강조(**굵게**): 'same' | { ko, en, ja, zh }
        code: { ...FONT_SET, ko: 'neodgm' }, // 코드(`코드`): 기본은 도트 글꼴 Neo둥근모 — 'same' 이면 둘레 글꼴 그대로
        name: 'same',
        userName: 'same',
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
    dialogue: { style: 'marker', markerShape: 'stroke', weight: 400, tilt: 'flat', markerThick: 54, markerPos: 'center', letterSpacing: null }, // letterSpacing: 1/100 em, null = 본문과 같게 (2.7.0)
    ui: { weight: null, letterSpacing: null },   // 메뉴 글자 굵기 · 자간 — null = 실리태번 기본 (2.7.0; 크기는 type.uiSize)
    code: { weight: null, letterSpacing: null }, // 코드 글자 굵기 · 자간 — null = 둘레 글자 그대로 (2.7.0; 크기는 type.codeSize)
    // 글자 그림자 (2.4.0): 켬/끔 + 어디에(본문 · 대사 · 속마음 · 강조 · 코드) + 모양 하나. 기본 끔 — 폰에서 text-shadow 는 번질 수 있음. angle 도 · distance/blur px · alpha %
    shadow: { on: false, targets: { text: false, dialogue: true, em: false, strong: false, code: false }, color: '#000000', alpha: 45, angle: 135, distance: 2, blur: 3 },   // style: marker | full | bold | tint | plain · tilt(형광펜 기울기): flat | slant | steep · markerThick(형광펜 두께): 글자 상자 높이 % · markerPos(위치): center 가운데 | bottom 아래(기울기를 눕혀 밑줄처럼 — 두께는 굵기 값 그대로)
    // 글자 외곽선 (3.7.0): 켬/끔 + 어디에(전체 · 데우스 프롬프트가 칠한 글자만) + 두께 · 색 · 진하기.
    // 그림자와 달리 -webkit-text-stroke + paint-order 라 글자 속을 파먹지 않는다. 색이 진한 대사가 배경에 묻힐 때 읽히게 하는 용도
    outline: { on: false, color: '#000000', alpha: 100, width: 1 },   // 전체(메시지 본문) 외곽선 · width: px(0.2~3) · alpha: %
    em: { italic: false, weight: 400, size: null, letterSpacing: null },   // *속마음* — 기울일지, 굵기, 크기(px · null = 본문과 같게), 자간(1/100 em · null = 본문과 같게)
    strong: { weight: 650, size: null, letterSpacing: null },              // **강조**
    chat: { user: 'bubble', header: 'full', userSize: 100, userInk: 100, icons: 'line', bgImage: false, bgAlpha: 82, mesPins: [], unifyRegex: true, unifyInline: true, regexIcons: false, selectPop: true, colorPop: true, streamFade: false, demSkin: false, demFold: true, weather: 'off', weatherReadability: false, weatherAutoRest: true, weatherLevel: 2, weatherAmount: null, weather2Amount: null, weatherOpacity: 100, weatherSize: 100, weatherSpeed: 100, weatherAngle: -9, weatherMotion: 'natural', weatherSway: 100, weatherSpin: 100, weatherCurvature:65, weatherOrbitSize:100, weatherOrbitDirection:'right', weatherArtStyle:'real', weatherIllustrated:false, weatherArtOutline:false, weatherColorMode:'auto', weatherColor:'#91cfff', weatherImage: '', weatherImageId: '', qrScroll: 'x', qrFind: true, qrRows: 2, qrPlace: 'bottom', demInk: false, demInkMode: 'text', toneInline: false, tone: { light: { s: 58, l: 38 }, dark: { s: 70, l: 74 } }, markerTone: { light: { s: 88, l: 72 }, dark: { s: 62, l: 46 } } }, // streamFade: 스트리밍 중 새 글자만 가볍게 페이드 인 (2.9.5, streamfade.js — 실리태번 페이드 인이 켜져 있으면 쉼) · tone: 톤 맞추기의 채도 · 밝기(%) 화이트/나이트 따로 (2.6.1) · toneInline: 본문 글자색의 색상만 두고 채도 · 밝기를 테마에 맞춤 (2.6.0, unifyInline 이 꺼져 있을 때) · selectPop: 실리태번 select 를 테마가 그린 목록 팝업으로 (2.5.0) · colorPop: 설정 창 밖 색 칸도 테마 색 고르기로 (3.5.0, colorpop.js) · regexIcons: 정규식 카드 제목 앞 이모티콘 보이기 · unifyRegex: 프리셋 정규식 카드(DEM 등)의 모듈별 색 → 포인트색 하나 · unifyInline: 메시지에 적힌 글자색(<font color> · style) 무시
    // 3.1.0: 몰입 읽기(폰 — 아래로 밀면 위 바 · 입력창 숨김, reader.js) · 한 손 버튼 줄(입력판 위 ‹ › 사칭 · 이어 쓰기 · 다시 생성, onehand.js)
    reader: { autoHide: false },
    // 3.4.0 프롬프트 호환: 데우스 엑스 마키나 — 끄면 카드 스킨 · 폰 접기 · 카드 색 통일 · 카드 이모티콘 · 트래커 날씨가 모두 쉰다 (값은 남음)
    // 3.7.1 데우스 대사 색상 가독성 향상: 프롬프트가 칠한 글자(@Dialogue Color)에만 거는 외곽선 · 그림자.
    // 색에 따라 배경에 묻혀 안 읽히는 경우를 위해 — 둘 다 켜도 되고 하나만 켜도 된다. 파라미터는 전체 외곽선 · 글자 그림자와 같은 것들.
    // 3.7.2 다른 CSS: 사용자 설정 › 커스텀 CSS 를 테마가 켜진 동안 꺼 둘지 (내용은 그대로 — 끄면 바로 돌아온다)
    compat: { muteCustomCss: false },
    deus: {
        on: false,
        ink: {
            outline: { on: false, color: '#000000', alpha: 100, width: 0.6 },
            shadow: { on: false, color: '#000000', alpha: 60, angle: 135, distance: 1.5, blur: 2 },
        },
        // 4.1.2 감정 대사 효과(Expressive Dialogue): 움직임 soft|normal|big · 빛 · 색 흐름 · 기기의 애니메이션 줄이기 무시 (css/55-dem-expressive.css)
        fx: { on: true, motion: 'normal', glow: true, flow: false, flowMode: 'text', force: false }, // flowMode: 색 흐름을 글자에(text) | 형광펜 띠에(marker)
    },
    // 3.2.0 화이트 · 나이트 자동: by = system(기기 다크 모드) | time(night 부터 day 까지 나이트) — automode.js
    auto: { on: false, by: 'system', night: '20:00', day: '07:00' },
    // 3.3.1 날씨 효과의 내 그림 목록 [{ id, name, data }] — 스타일에는 안 담김 (고른 그림만 chat.weatherImage)
    weatherImages: [],
    customPalettes: [],
    activeCustomPalette: '',
    addons: { order: false, perf: false, words: false, capture: false, models: false, modelorder: false, modelswitch: false, regexlink: false, rewrite: false, bookmarks: false },
    addonUI: { orderIcon: false, perfIcon: false, wordsMenu: false, captureMenu: false, perfMenu: { watchdog:false, timer:true, perf:false, log:true, dedupe:false },
        // 4.5.5: 성능 보조의 도구를 아예 안 불러오게 (perfMenu 는 '메뉴에 보이기', 이것은 '불러오기').
        // 기본은 전부 켬 — 지금 쓰던 대로 돌아가고, 안 쓰는 도구를 끄면 그만큼 시작이 가벼워진다.
        perfLoad: { watchdog:true, timer:true, perf:true, log:true, dedupe:true } },
    wordTools: { messageView: 'translation', rules: [], presets: [], syntax: 'comma', caseSensitive: false, wholeWords: false, particles: true },
    captureTools: { replace: false, preset: '', redact: false, names: [], mask: 'auto', maskStyles: {}, format:'image', duration:6, maxMB:8, maxParagraphs:4, resolution:1080, backgroundTint:60, includeWeather:true, includeBackground:true, showName:true, showAvatar:true, showAssets:true, showTimestamp:true, showModel:true, showMessageId:true, showTokens:true, showGenerationTime:true },
    onehand: { on: false, swipe: true, imp: true, cont: true, regen: true },
    replyNotify: { on: false }, // 4.8.7 답 완료 알림: 다른 앱을 보고 있을 때 답이 끝나면 폰 알림 · 진동 (reply-notify.js)
    bgWindow: { on: false, mode: 'audio' }, // 4.3.2 백그라운드 창 (실험): 답을 기다리는 동안 PIP 작은 창을 띄워 다른 앱을 봐도 생성 · 번역이 이어지게
    // 3.1.0 스타일: 내 스타일 목록 [{ id, name, data }] · 캐릭터 연결 { 'c:아바타' | 'g:그룹': 스타일 id } · 지금 입힌 캐릭터 스타일 { id, key } · 그 전 원래 모습 (styles.js · charstyle.js)
    styles: [],
    charStyles: {},
    activeStyle: null,
    baseStyle: null,
    profile: { decor: { ...DECOR_DEFAULTS }, nameSize: 24, nameWeight: 650, nameSpacing: 0, nameHeight: 1.3, nameColor: '#91a5ba', nameAuto: true, nameAlign: 'center', nameItalic: false, nameUnderline: false, headerLayout: 'below-two', headerGap: 8, metaSize: 12, metaOpacity: 70, buttonGap: 8, nameOutline: 0, nameOutlineColor: '#000000', nameShadow: false, nameShadowBlur: 4, nameShadowY: 1, nameShadowAlpha: 25, ...FRAME_DEFAULTS, mode: 'small', layout: 'column', sizing: 'pixels', screenHeight: 45, maxHeight: 70, visibleHeight: 100, width: 100, height: 320, fit: 'cover', positionX: 50, positionY: 35, radius: 18, gap: 20, blur: 0, opacity: 100, fadeY: 0, fadeX: 0, original: true },
    image: { decor: { ...DECOR_DEFAULTS }, ...FRAME_DEFAULTS, layout: 'bleed', shape: 'rect', fit: 'ratio', maxh: 78, height: 40, blendWhite: true, cutoutSame: true, fade: 'soft', fadeY: 10, fadeX: 0, angle: 3, radius: 14, cornerCut: 10, scratchAmount: 45, scratchDirection: 'straight', scratchTexture: 'sharp', edge: 'none', edgeAuto: true, edgeSideTop: true, edgeSideRight: true, edgeSideBottom: true, edgeSideLeft: true, edgeThick: 1, edgeAlpha: 30, edgeGlow: 0, mask: '', maskFit: 'stretch', masks: [], maskId: '' }, // shape: rect | custom(mask = 투명 PNG data URL, maskFit: stretch | contain) — angle · cornerCut · scratch* 는 뺀 모양의 옛 값(CSS 는 남아 있음) · fit(크기): ratio 비율 유지(maxh = 최대 높이) | fixed 높이 맞춤(height = 높이), 둘 다 화면 높이 % · fade(흐림): off | soft | medium | strong · angle: 대각선 기울기(도)
};

DEFAULTS.userProfile = { ...structuredClone(DEFAULTS.profile), mode: 'none', side: 'auto', metaSide: 'auto' }; // auto = 말풍선이면 오른쪽(메신저처럼), 나머지 모양은 왼쪽

export const PROFILE_RANGE = { screenHeight: [10, 100], maxHeight: [10, 100], visibleHeight: [10, 100], nameSize: [10, 60], nameWeight: [100, 900], nameSpacing: [-10, 30], nameHeight: [1, 2.5], headerGap: [0, 32], metaSize: [8, 24], metaOpacity: [20, 100], buttonGap: [0, 24], nameOutline: [0, 3], nameShadowBlur: [0, 20], nameShadowY: [-10, 10], nameShadowAlpha: [0, 100], width: [30, 100], height: [100, 720], positionX: [0, 100], positionY: [0, 100], radius: [0, 80], gap: [0, 64], blur: [0, 16], opacity: [20, 100], fadeY: [0, 45], fadeX: [0, 45] };

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
    // 3 → 4 (4.3.4): 내 작은 사진 위치의 예전 기본값 '왼쪽'을 '자동'으로 (말풍선이면 오른쪽 — 왼쪽 끝에 있으면 말풍선이 붕 떠 보였다). 그 뒤에 왼쪽을 다시 고르면 그대로 둔다
    if (from < 4 && s.userProfile && typeof s.userProfile === 'object' && s.userProfile.side === 'left') s.userProfile.side = 'auto';
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
export const IMAGE_RANGE = { radius: [0, 80], maxh: [15, 100], height: [15, 90], angle: [-15, 15], cornerCut: [3, 25], scratchAmount: [0, 100], fadeY: [0, 45], fadeX: [0, 35], ...FRAME_RANGE }; // maxh · height = 화면 높이 %, angle = 대각선 기울기(도) — 설정 창 슬라이더도 이 범위를 씀

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
export const TEXT_LIMIT = { dialogueSize: [8, 40], uiSize: [8, 32], codeSize: [8, 32], markerThick: [10, 100], roleSize: [8, 40], letterSpacing: [-10, 20], weight: [100, 900], gutter: [8, 40] };

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
        s.chat.bgAlpha = num(s.chat.bgAlpha, [0, 100]) ?? 82; // 배경 이미지 위 채팅 바탕 농도 (4.1.3) — 100 = 불투명
        s.chat.mesPins = tidyPins(s.chat.mesPins); // ··· 메뉴에서 꺼내 늘 보이게 할 버튼 (4.1.3, mes-pins.js)
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
    // 3.3.1 날씨 그림 목록
    const okImage = x => isObj(x) && typeof x.id === 'string' && x.id && typeof x.data === 'string' && x.data.startsWith('data:image/');
    if (!Array.isArray(s.weatherImages)) s.weatherImages = [];
    else if (s.weatherImages.length > 12 || !s.weatherImages.every(okImage)) s.weatherImages = s.weatherImages.filter(okImage).slice(0, 12);
}

/** 3.1.0 켜고 끄는 값: 가져온 파일의 "false" 문자열 · 깨진 값 거르기 */
function tidyFlags(s) {
    if (!isObj(s.reader)) s.reader = structuredClone(DEFAULTS.reader);
    s.reader.autoHide = flag(s.reader.autoHide, false);
    if (!isObj(s.deus)) s.deus = structuredClone(DEFAULTS.deus);
    s.deus.on = flag(s.deus.on, false);
    if (!isObj(s.auto)) s.auto = structuredClone(DEFAULTS.auto);
    s.auto.on = flag(s.auto.on, false);
    if (!['system', 'time'].includes(s.auto.by)) s.auto.by = 'system';
    for (const key of ['night', 'day']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.auto[key]))) s.auto[key] = DEFAULTS.auto[key];
    if (!isObj(s.onehand)) s.onehand = structuredClone(DEFAULTS.onehand);
    if (!isObj(s.bgWindow)) s.bgWindow = structuredClone(DEFAULTS.bgWindow);
    s.replyNotify = { on: isObj(s.replyNotify) && s.replyNotify.on === true };
    s.bgWindow = { on: s.bgWindow.on === true, mode: s.bgWindow.mode === 'pip' ? 'pip' : 'audio' };
    for (const key of Object.keys(DEFAULTS.onehand)) s.onehand[key] = flag(s.onehand[key], DEFAULTS.onehand[key]);
    if (isObj(s.chat)) {
        s.chat.demSkin = flag(s.chat.demSkin, false);
        s.chat.demFold = flag(s.chat.demFold, true);
        // 3.3.0 날씨 효과: off | rain | snow | tracker(데우스 트래커 날씨 따라) · 세기 1~3
        if (!['off', 'rain', 'snow', 'fog', 'sun', 'star', 'firefly', 'rainbow', 'shadow', 'breeze', 'glass', 'water', 'lemon', 'petal', 'feather', 'butterfly', 'meteor', 'custom', 'tracker'].includes(s.chat.weather)) s.chat.weather = 'off';
        if (!['off', 'rain', 'snow', 'fog', 'sun', 'star', 'firefly', 'rainbow', 'shadow', 'breeze', 'glass', 'water', 'lemon', 'petal', 'feather', 'butterfly', 'meteor'].includes(s.chat.weather2)) s.chat.weather2 = 'off';
        s.chat.weather2Level = [1, 2, 3].includes(Number(s.chat.weather2Level)) ? Number(s.chat.weather2Level) : 2;
        // 끌어서 정한 자리 (화면 비율 0~1). 없으면 자동 배치
        { const spots = s.chat.weatherSpots && typeof s.chat.weatherSpots === 'object' && !Array.isArray(s.chat.weatherSpots) ? s.chat.weatherSpots : {}; const clean = {};
          for (const [mode, max] of [['shadow', 3], ['rainbow', 1], ['sun', 1]]) { const list = Array.isArray(spots[mode]) ? spots[mode].slice(0, max).map(p => (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) ? { x: Math.max(0, Math.min(1, Number(p.x))), y: Math.max(0, Math.min(1, Number(p.y))) } : null)) : []; if (list.some(Boolean)) clean[mode] = list; }
          s.chat.weatherSpots = clean; }
        s.chat.weatherTrackerSkip = Array.isArray(s.chat.weatherTrackerSkip) ? [...new Set(s.chat.weatherTrackerSkip)].filter(mode => ['rain', 'snow', 'fog', 'sun', 'star', 'glass', 'rainbow', 'breeze'].includes(mode)) : []; // 트래커 따라에서 제외할 날씨
        if(!['real','anime','cel'].includes(s.chat.weatherArtStyle))s.chat.weatherArtStyle='real';
        if(!['auto','custom','gradient'].includes(s.chat.weatherColorMode))s.chat.weatherColorMode='auto';
        if(!/^#[0-9a-f]{6}$/i.test(s.chat.weatherColor2||''))s.chat.weatherColor2='#f5b8e4';
        if(!['soft','anime','wisp'].includes(s.chat.weatherFogStyle))s.chat.weatherFogStyle='soft';
        s.chat.weatherSunStyle='flare';
        if(!['sky','milky'].includes(s.chat.weatherStarStyle))s.chat.weatherStarStyle='sky';
        if(!['palm','leaf'].includes(s.chat.weatherShadowStyle))s.chat.weatherShadowStyle='palm';
        if(!['pool','sea'].includes(s.chat.weatherWaterStyle))s.chat.weatherWaterStyle='pool';
        if(!['bottom','top','all'].includes(s.chat.weatherWaterArea))s.chat.weatherWaterArea='bottom';
        if(!['all','bottom','top','both'].includes(s.chat.weatherFogArea))s.chat.weatherFogArea='all';
        if(!/^#[0-9a-f]{6}$/i.test(s.chat.weatherColor||''))s.chat.weatherColor='#91cfff';
        s.chat.weatherLevel = [1, 2, 3].includes(Number(s.chat.weatherLevel)) ? Number(s.chat.weatherLevel) : 2;
        const range = (key, min, max, def) => { const n = Number(s.chat[key]); s.chat[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
        range('weatherOpacity', 10, 100, 100);
        range('weatherSize', 40, 250, 100);
        range('weatherSpeed', 20, 250, 100);
        range('weatherAngle', -45, 45, -9);
        range('weatherBubble',30,100,70); // 날씨를 켠 동안 내 메시지 면의 농도
        range('weatherShadowBlur',0,100,35);
        range('weatherFogStretch',50,300,100); range('weatherFogEdge',0,100,30); range('weatherFogSwell',0,300,100); range('weatherFogDepth',0,200,100);
        range('weatherCurvature',0,100,65); range('weatherOrbitSize',40,240,100);
        if(!['left','right'].includes(s.chat.weatherOrbitDirection))s.chat.weatherOrbitDirection='right';
        range('weatherSway', 0, 300, 100); range('weatherSpin', 0, 300, 100);
        if (!['natural', 'straight', 'flutter', 'streak'].includes(s.chat.weatherMotion)) s.chat.weatherMotion = 'natural';
        // 날씨 값을 전부 다듬은 뒤에 프로필에 적는다 — 먼저 적으면 새 값이 빈 채로 저장됐다가 다음 불러오기에서 채워져, 저장 · 불러오기를 되풀이한 결과가 달라진다
        syncWeatherProfile(s.chat);
        // 3.5.4 퀵 리플라이 줄: x 가로 스크롤 · y 세로 스크롤(보이는 줄 1~4)
        if (!['x', 'y'].includes(s.chat.qrScroll)) s.chat.qrScroll = 'x';
        s.chat.qrFind = flag(s.chat.qrFind, true);
        range('qrRows', 1, 4, 2);
        // 3.7.0 퀵 리플라이 줄 자리: bottom 입력창 아래(여태 모양) | top 입력창 위 (사용자 요청 — 입력창 옆에 아이콘을 많이 빼 두면 줄이 좁아서)
        if (!['bottom', 'top'].includes(s.chat.qrPlace)) s.chat.qrPlace = 'bottom';
        // 3.7.0 데우스 프롬프트가 칠한 대사 색 그대로 (형광펜 · 테마 대사색보다 먼저)
        s.chat.demInk = flag(s.chat.demInk, false);
        // 3.7.1 그 색을 어디에: text 글자 색 | marker 형광펜 띠 색 (글자는 테마 색 그대로)
        if (!['text', 'marker'].includes(s.chat.demInkMode)) s.chat.demInkMode = 'text';
        if (typeof s.chat.weatherImage !== 'string' || (s.chat.weatherImage && !s.chat.weatherImage.startsWith('data:image/'))) s.chat.weatherImage = '';
        if (typeof s.chat.weatherImageId !== 'string') s.chat.weatherImageId = '';
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
    // 좌우 여백은 슬라이더(8~40) 밖 값이 가져오기 · 스타일 파일로 들어올 수 있다 — 8 아래면 버튼 줄의 -8px 여백이 화면 밖으로 나간다 (4.6.9)
    const gutter = typeof type.gutter === 'number' ? type.gutter : parseFloat(type.gutter);
    type.gutter = Number.isFinite(gutter) ? clampTo(gutter, TEXT_LIMIT.gutter) : DEFAULTS.type.gutter;
}

/** 형광펜 두께 · 위치 정리 */
export const SHADOW_LIMIT = { alpha: [0, 100], angle: [0, 360], distance: [0, 12], blur: [0, 24] };
export const SHADOW_TARGETS = ['text', 'dialogue', 'em', 'strong', 'code'];

function tidyDialogue(d) {
    if (!['stroke', 'rectangle', 'pill'].includes(d.markerShape)) d.markerShape = 'stroke';
    if (!MARKER_POSITIONS.includes(d.markerPos)) d.markerPos = 'center';
    const v = typeof d.markerThick === 'number' ? d.markerThick : parseFloat(d.markerThick);
    d.markerThick = Number.isFinite(v) ? clampTo(v, TEXT_LIMIT.markerThick) : DEFAULTS.dialogue.markerThick;
}

export const OUTLINE_LIMIT = { alpha: [0, 100], width: [0.2, 3] };
export const INK_SHADOW_LIMIT = { alpha: [0, 100], angle: [0, 360], distance: [0, 12], blur: [0, 24] };

/** 켬/끔 · 색 #rrggbb · 숫자는 범위 안 (전체 외곽선 · 데우스 가독성 외곽선 · 데우스 가독성 그림자가 같이 씀) */
function tidyInkPart(part, defaults, limit) {
    part.on = part.on === true || part.on === 'true';
    if (!/^#[0-9a-f]{6}$/i.test(String(part.color))) part.color = defaults.color;
    for (const [key, range] of Object.entries(limit)) {
        const n = Number(part[key]);
        part[key] = Number.isFinite(n) ? clampTo(n, range) : defaults[key];
    }
}

/** 글자 외곽선 (3.7.0) + 데우스 대사 색상 가독성 향상 (3.7.1) */
function tidyOutline(s) {
    if (!isObj(s.outline)) s.outline = structuredClone(DEFAULTS.outline);
    delete s.outline.scope; // 3.7.0 의 '어디에' — 데우스 쪽은 제 칸(deus.ink)으로 옮겼다
    tidyInkPart(s.outline, DEFAULTS.outline, OUTLINE_LIMIT);

    if (!isObj(s.deus)) s.deus = structuredClone(DEFAULTS.deus);
    if (!isObj(s.deus.ink)) s.deus.ink = structuredClone(DEFAULTS.deus.ink);
    if (!isObj(s.deus.ink.outline)) s.deus.ink.outline = structuredClone(DEFAULTS.deus.ink.outline);
    if (!isObj(s.deus.ink.shadow)) s.deus.ink.shadow = structuredClone(DEFAULTS.deus.ink.shadow);
    tidyInkPart(s.deus.ink.outline, DEFAULTS.deus.ink.outline, OUTLINE_LIMIT);
    tidyInkPart(s.deus.ink.shadow, DEFAULTS.deus.ink.shadow, INK_SHADOW_LIMIT);
    if (!isObj(s.deus.fx)) s.deus.fx = structuredClone(DEFAULTS.deus.fx);
    for (const key of ['on', 'glow', 'flow', 'force']) s.deus.fx[key] = flag(s.deus.fx[key], DEFAULTS.deus.fx[key]);
    if (!['soft', 'normal', 'big'].includes(s.deus.fx.motion)) s.deus.fx.motion = DEFAULTS.deus.fx.motion;
    if (!['text', 'marker'].includes(s.deus.fx.flowMode)) s.deus.fx.flowMode = DEFAULTS.deus.fx.flowMode;
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
    // 3.4.0 전 설정: 데우스 카드 스킨이나 트래커 날씨를 쓰던 사람이면 호환을 켠 채로 시작 (한 번만)
    const firstDeus = ext[KEY].deus === undefined;
    const migrateUserMode = !ext[KEY].userProfile || ext[KEY].userProfile.mode === 'inherit';
    const migrateWordSyntax = ext[KEY].wordTools && ext[KEY].wordTools.syntax !== 'comma';
    const s = fill(ext[KEY], DEFAULTS);
    if (migrateUserMode) s.userProfile.mode = SillyTavern.getContext().powerUserSettings?.hideChatAvatars_enabled || s.chat.user === 'bubble' ? 'none' : 'small';
    syncDeviceLayout(s);
    if (TILT_RENAME[s.dialogue?.tilt]) s.dialogue.tilt = TILT_RENAME[s.dialogue.tilt];
    if (isObj(s.dialogue)) tidyDialogue(s.dialogue);
    tidyShadow(s);
    tidyOutline(s);
    if (!isObj(s.compat)) s.compat = structuredClone(DEFAULTS.compat);
    s.compat.muteCustomCss = flag(s.compat.muteCustomCss, false);
    if (isObj(s.type)) tidyType(s.type);
    tidyRoles(s);
    if (isObj(s.fonts)) ['em', 'strong', 'code', 'name', 'userName'].forEach(slot => tidyFontSlot(s.fonts, slot));
    if (s.image && !IMAGE_SHAPES.includes(s.image.shape)) s.image.shape = 'rect'; // 모르는 모양(가져온 파일 · 뺀 유리 조각 · 물방울) → 네모
    if (s.image) { tidyImage(s.image); tidyFrame(s.image); }
    tidyDecor(s.image);
    for (const owner of ['profile', 'userProfile']) {
        if (!isObj(s[owner])) s[owner] = structuredClone(DEFAULTS[owner]);
        fill(s[owner], DEFAULTS[owner]);
        tidyFrame(s[owner]);
        tidyDecor(s[owner]);
        for (const key of ['nameAuto', 'nameItalic', 'nameUnderline', 'nameShadow']) s[owner][key] = flag(s[owner][key], DEFAULTS[owner][key]);
        for (const key of ['nameColor', 'nameOutlineColor']) if (!/^#[a-f\d]{6}$/i.test(s[owner][key])) s[owner][key] = DEFAULTS[owner][key];
        if (!['left', 'center', 'right'].includes(s[owner].nameAlign)) s[owner].nameAlign = 'center';
        if (!['side', 'below-one', 'below-two'].includes(s[owner].headerLayout)) s[owner].headerLayout = 'below-two';
        if (owner === 'profile' && s[owner].modeVersion !== 1) {
            if (s[owner].mode === 'small' && SillyTavern.getContext().powerUserSettings?.hideChatAvatars_enabled) s[owner].mode = 'none';
            s[owner].modeVersion = 1;
        }
        if (!['none', 'small', 'banner'].includes(s[owner].mode)) s[owner].mode = DEFAULTS[owner].mode;
        if (owner === 'userProfile' && !['auto', 'left', 'right'].includes(s[owner].side)) s[owner].side = 'auto';
        if (owner === 'userProfile' && !['auto', 'left', 'right'].includes(s[owner].metaSide)) s[owner].metaSide = 'auto'; // 번호 · 시간 · 토큰 줄 (auto = 사진을 따라감)
        if (!['cover', 'contain'].includes(s[owner].fit)) s[owner].fit = 'cover';
        if (!['column', 'bleed', 'inset'].includes(s[owner].layout)) s[owner].layout = 'column';
        if (!['pixels', 'screen', 'ratio'].includes(s[owner].sizing)) s[owner].sizing = 'pixels';
        s[owner].original = flag(s[owner].original, true);
        for (const [key, range] of Object.entries(PROFILE_RANGE)) {
            const n = Number(s[owner][key]);
            s[owner][key] = Number.isFinite(n) ? clampTo(n, range) : DEFAULTS[owner][key];
        }
    }
    tidyFrameLibrary(s);
    if (PALETTE_ALIASES[s.palette]) s.palette = PALETTE_ALIASES[s.palette];
    if (!PALETTES[s.palette]) s.palette = 'salt';
    s.nightTint = Number.isFinite(Number(s.nightTint)) ? Math.max(1, Math.min(20, Number(s.nightTint))) : 1;
    s.lightTint = Number.isFinite(Number(s.lightTint)) ? Math.max(.5, Math.min(20, Number(s.lightTint))) : .5;
    delete s.pastel; // 1.8.2~1.9.1 의 파스텔 스위치 — 파스텔로 정착하며 없앰 (id 는 PALETTE_ALIASES 가 원래 id 로)
    s.customName = typeof s.customName === 'string' ? s.customName.trim().slice(0, 24) : '';
    s.noticeSeen = typeof s.noticeSeen === 'string' ? s.noticeSeen.slice(0, 20) : '';
    s.gradients = tidyGradients(s.gradients);
    tidyFlags(s);
    tidyStyles(s);
    if (!Array.isArray(s.customPalettes)) s.customPalettes=[];
    if (typeof s.activeCustomPalette !== 'string') s.activeCustomPalette='';
    if (!isObj(s.addons)) s.addons=structuredClone(DEFAULTS.addons);
    for (const key of Object.keys(DEFAULTS.addons)) s.addons[key]=s.addons[key]===true;
    if (!isObj(s.addonUI)) s.addonUI=structuredClone(DEFAULTS.addonUI);
    if (!isObj(s.addonUI.perfMenu)) s.addonUI.perfMenu=structuredClone(DEFAULTS.addonUI.perfMenu);
    if (!isObj(s.addonUI.perfLoad)) s.addonUI.perfLoad=structuredClone(DEFAULTS.addonUI.perfLoad);
    for (const k of Object.keys(DEFAULTS.addonUI.perfLoad)) if (typeof s.addonUI.perfLoad[k] !== 'boolean') s.addonUI.perfLoad[k]=true;
    for (const key of ['orderIcon','perfIcon','wordsMenu','captureMenu']) s.addonUI[key]=flag(s.addonUI[key],false);
    for (const key of Object.keys(DEFAULTS.addonUI.perfMenu)) s.addonUI.perfMenu[key]=flag(s.addonUI.perfMenu[key],DEFAULTS.addonUI.perfMenu[key]);
    if (!isObj(s.wordTools)) s.wordTools=structuredClone(DEFAULTS.wordTools);
    s.wordTools.messageView=s.wordTools.messageView==='original'?'original':'translation';
    if (!Array.isArray(s.wordTools.rules)) s.wordTools.rules=[];
    s.wordTools.rules=s.wordTools.rules.filter(rule=>rule&&typeof rule==='object').slice(0,500);
    if(!Array.isArray(s.wordTools.presets))s.wordTools.presets=[];
    s.wordTools.presets=s.wordTools.presets.filter(p=>p&&typeof p.id==='string'&&Array.isArray(p.rules)).slice(0,24);
    if(migrateWordSyntax) {
        for(const rules of [s.wordTools.rules,...s.wordTools.presets.map(p=>p.rules)])for(const rule of rules)if(rule&&typeof rule.from==='string')rule.from=rule.from.split('||').join(', ');
        s.wordTools.syntax='comma';
    }
    if(!isObj(s.captureTools))s.captureTools=structuredClone(DEFAULTS.captureTools);
    s.captureTools.format=['video','gif','apng','webp'].includes(s.captureTools.format)?s.captureTools.format:'image';
    s.captureTools.resolution=Number(s.captureTools.resolution)===1440?1440:1080;
    s.captureTools.backgroundTint=Math.min(100,Math.max(0,Number(s.captureTools.backgroundTint??60)||0));
    s.captureTools.maxParagraphs=Math.min(20,Math.max(1,Math.floor(Number(s.captureTools.maxParagraphs)||4)));
    s.captureTools.duration=Math.min(30,Math.max(3,Number(s.captureTools.duration)||6));
    s.captureTools.capturePresets=(Array.isArray(s.captureTools.capturePresets)?s.captureTools.capturePresets:[]).filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&isObj(p.values)).slice(0,12); // 채팅 캡처 › 내 프리셋
    s.captureTools.maxMB=Math.min(200,Math.max(0,Number(s.captureTools.maxMB??8)||0)); // APNG · WebP 움짤의 최대 용량 (0 = 제한 없음)
    for(const key of ['showName','showAvatar','showAssets','showTimestamp','showModel','showMessageId','showTokens','showGenerationTime','includeWeather','includeBackground'])s.captureTools[key]=s.captureTools[key]!==false;
    s.captureTools.replace=s.captureTools.replace===true;s.captureTools.redact=s.captureTools.redact===true;
    s.captureTools.names=Array.isArray(s.captureTools.names)?s.captureTools.names.filter(n=>typeof n==='string').slice(0,40):[];
    if(!['auto','white','black','mosaic','tape'].includes(s.captureTools.mask))s.captureTools.mask='auto';
    if(typeof s.captureTools.preset!=='string')s.captureTools.preset='';
    if(!isObj(s.captureTools.maskStyles))s.captureTools.maskStyles={};
    for(const style of MASK_STYLES)s.captureTools.maskStyles[style]=normalizeMaskStyle(s.captureTools.maskStyles[style]);
    s.customPalettes=s.customPalettes.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&isObj(item.light)&&isObj(item.dark)).slice(0,24);
    if (firstDeus) s.deus.on = !!(s.chat?.demSkin || s.chat?.weather === 'tracker');
    for (const id of Object.keys(s.colorOverrides || {})) if (!PALETTES[id]) delete s.colorOverrides[id];
    return s;
}

export function saveSettings() {
    const s = SillyTavern.getContext().extensionSettings[KEY];
    if (s) saveDeviceLayout(s);
    SillyTavern.getContext().saveSettingsDebounced();
}

// 4.7.0: 무엇을 되돌릴지 고른다 — look(테마 모습) · addons(애드온 켬 · 설정) · tools(단어 치환 · 캡처) · library(프레임 · 팔레트 · 날씨 그림 · 모양)
// 내 글꼴 · 본 공지 · 내 스타일 · 캐릭터 연결은 늘 남긴다 (입혀 둔 캐릭터 스타일 상태는 비움)
const RESET_GROUPS = { addons: ['addons', 'addonUI'], tools: ['wordTools', 'captureTools'], library: ['frameLibrary', 'customPalettes', 'weatherImages'] };
export function resetSettings(groups = { look: true }) {
    const ext = SillyTavern.getContext().extensionSettings;
    const old = ext[KEY] || {};
    const fresh = structuredClone(DEFAULTS);
    const next = groups.look ? fresh : structuredClone(old);
    if (groups.look) for (const key of ['appearanceHistory', 'customFonts', 'noticeSeen', 'styles', 'charStyles']) next[key] = structuredClone(old[key] ?? fresh[key]);
    for (const [group, keys] of Object.entries(RESET_GROUPS)) for (const key of keys) next[key] = structuredClone(groups[group] ? DEFAULTS[key] : (old[key] ?? DEFAULTS[key]));
    if (!next.image || typeof next.image !== 'object') next.image = structuredClone(DEFAULTS.image);
    if (groups.library) { next.image.masks = []; next.image.maskId = ''; if (next.image.shape === 'custom') next.image.shape = 'rect'; }
    else if (groups.look) next.image.masks = structuredClone(old.image?.masks || []);
    ext[KEY] = next;
    saveSettings();
    return next;
}

/** 글꼴 묶음 꺼내기 (slot: text | dialogue | ui | em | strong). 'same' 이면 본문 묶음. */
export function fontSet(s, slot) {
    const v = s.fonts[slot];
    if (slot === 'text') return v;
    return v === 'same' ? s.fonts.text : v;
}
