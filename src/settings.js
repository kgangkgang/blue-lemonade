import { appearance } from './device-layouts.js';
import { tidyRoleIcons, tidyPickedIcons } from './role-icons-core.js';
import { tidyFruitType } from './fruit-type-tidy.js';   // 1.0.x 시작에는 설정 고르기만(종류 전체 목록 · 선택자는 상태창 글자를 쓸 때 받아요)
import { entryDisplay, entryIcon } from './scripts/fruit-entry-icons.js';
import { MASK_STYLES, normalizeMaskStyle, FILTER_RANGES, FILTER_PRESET_IDS, FILTER_PRESETS } from './capture-style.js';
import { MARKDOWN_DEFAULTS, tidyMarkdown } from './markdown.js';
import { tidyPins } from './mes-pins-keys.js';
import { syncWeatherProfile } from './weather-profiles.js';
import { tidySceneSound } from './scene-sound-keys.js';   // 6.9.8 장면 소리 설정 정리 (순수 모듈)
import { tidyMultiAvatar } from './multi-avatar/pick-keys.js';   // 7.9.9 프로필 여러 개 (순수)
// 추가 모양의 정리 코드는 첫 프레임 뒤에 연결하고 저장 키는 그대로 둬요.
const DECOR_DEFAULTS = { on: false, art: '', mask: '', ratio: 1, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover', radius: null, frameWidth: 100, frameHeight: 100, presetTilt: 0, frameHue: 0, frameSat: 100, frameBright: 100 };   // presetTilt: 1.0.1 액자 기울기(도, -10~10)
const MIX_DEFAULT = { on: false, families: ['blue', 'strawberry'], angle: 90, weights: [50, 50, 50], blend: 50 };
import { FRAME_DEFAULTS, FRAME_RANGE, tidyFrame } from './frames.js';
import { cutEdgeDefaults, tidyCutEdge } from './cutedge.js';
// 설정 저장 칸: extension_settings.salty
import { PALETTE_ALIASES, isPaletteId } from './palettes.js';
import { PRIVATE_FLAGS } from './private-addons.js';   // 내장 단독 확장 플래그(공개판은 빈 표)

export const KEY = 'salty';
// 6.9.5 처음 설정 안내(first-run.js): 이 모듈을 읽는 순간 테마 설정 칸이 없었나 — getSettings() 가 칸을 만들기 전에 잰다 (기존 사용자는 늘 false · 1.0.0 되살림)
export const FRESH_SETTINGS = (() => {
    try { const saved = SillyTavern.getContext().extensionSettings?.[KEY]; return !(saved && typeof saved === 'object' && !Array.isArray(saved)); }
    catch { return false; }
})();
export const VERSION = 4; // 설정 구조 버전 (1.0.0 = 1 · 1.4 = 2 · 4.3.4 = 4)
// 언어별 글꼴 묶음. en/ja/zh 가 'auto' 면 한국어 글꼴이 그 글자도 맡음.
export const FONT_SET = { ko: 'pretendard', en: 'auto', ja: 'auto', zh: 'auto' };
// 글꼴 칸: 본문 · 대사 · 메뉴 · 속마음(*기울임*) · 강조(**굵게**) · 코드(`코드`)
export const FONT_SLOTS = ['text', 'dialogue', 'ui', 'em', 'strong', 'code', 'name', 'userName'];

export const DEFAULTS = {
    version: VERSION,
    enabled: true,
    usageMode: 'both',
    appearanceHistory: [],
    settingLocks: {fonts:false,size:false,spacing:false,colors:false,profile:false},
    deviceLayouts: { on: false, pc: {}, mobile: {} },
    gradients: { light: structuredClone(MIX_DEFAULT), dark: structuredClone(MIX_DEFAULT), overrides: {} },
    frameLibrary: [],
    noticeSeen: '', // 3.0.0: 공지사항을 열어 본 마지막 버전 — 지금 버전이 더 새것이면 버전 알약이 빛난다 (notice.js)
    syncWatch: false, // 첫 설정에서 여러 기기 사용 여부를 골라요.
    squareButtons: false,
    updateCheck: true, // 5.7.0 새 버전 자동 확인 (src/update-check.js — 1.0.0 바탕에서 되살림, 스위치는 테마 › 기타 설정)
    palette: 'salt',
    nightTint: 1,                // Stock night surfaces: theme-color mix, 1–20%.
    lightTint: .5,               // Stock light surfaces: theme-color mix, 0.5–20%.
    customName: '', // 커스텀 에이드 이름 (색은 colorOverrides 에)
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
    markdown: { ...MARKDOWN_DEFAULTS },
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
    em: { italic: true, weight: 400, size: null, letterSpacing: null },
    strike: { line: true, own: false, color: '#ff7a7a', thickness: 2, fade: 55, italic: false },   // ~~취소선~~ — own: 선 색을 따로(false 면 글자 색), thickness px, fade: 지워진 글자를 남기는 정도 %   // *속마음* — 기울일지, 굵기, 크기(px · null = 본문과 같게), 자간(1/100 em · null = 본문과 같게)
    strong: { weight: 650, size: null, letterSpacing: null },              // **강조**
    chat: { user: 'bubble', char: 'plain', bubbleSplit: 'whole', header: 'full', userSize: 100, userInk: 100, icons: 'line', bgImage: false, bgAlpha: 82, mesPins: [], inkContrast: true, triangleFold: false, weatherBubble: 70, qrCtxNames: false, unifyRegex: true, unifyInline: true, regexIcons: false, selectPop: true, colorPop: true, numComma: false, helpMarks: true, webSearchMarks: true, personaTall: false, hideSendTextarea: false, showMoreAuto: true, lazyAvatars: true, searchIme: true, codePlain: false, worldInfoLight: true, chatLight: true, personaDefer: true, emptyGuard: true, replyTop: false, sentTokens: true, streamFade: false, hiddenFade: false, hiddenOpacity: 40, hiddenGray: 30, hiddenHover: true, reasoningFollow: true, demSkin: false, solaStyle: 'original', homeIcon: 'auto', demFold: true, weather: 'off', weatherReadability: false, weatherAutoRest: true, weatherLevel: 2, weatherAmount: null, weather2Amount: null, weatherOpacity: 100, weatherSize: 100, weatherSpeed: 100, weatherAngle: -9, weatherMotion: 'natural', weatherSway: 100, weatherSpin: 100, weatherCurvature:65, weatherOrbitSize:100, weatherOrbitDirection:'right', weatherArtStyle:'real', weatherIllustrated:false, weatherArtOutline:false, weatherColorMode:'auto', weatherColor:'#91cfff', weatherImage: '', weatherImageId: '', qrScroll: 'x', qrFind: true, qrFold: true, qrFolded: false, qrRows: 2, qrPlace: 'bottom', demInk: false, demInkMode: 'text', toneInline: false, tone: { light: { s: 58, l: 38 }, dark: { s: 70, l: 74 } }, markerTone: { light: { s: 88, l: 72 }, dark: { s: 62, l: 46 } } }, // 채팅 설정 뜻은 각 기능 모듈의 머리 주석에 있어요.
    // 3.1.0: 몰입 읽기(폰 — 아래로 밀면 위 바 · 입력창 숨김, reader.js) · 한 손 버튼 줄(입력판 위 ‹ › 사칭 · 이어 쓰기 · 다시 생성, onehand.js)
    reader: { autoHide: false },
    // 3.4.0 프롬프트 호환: 데우스 엑스 마키나 — 끄면 카드 스킨 · 폰 접기 · 카드 색 통일 · 카드 이모티콘 · 트래커 날씨가 모두 쉰다 (값은 남음)
    // 3.7.1 데우스 대사 색상 가독성 향상: 프롬프트가 칠한 글자(@Dialogue Color)에만 거는 외곽선 · 그림자.
    // 색에 따라 배경에 묻혀 안 읽히는 경우를 위해 — 둘 다 켜도 되고 하나만 켜도 된다. 파라미터는 전체 외곽선 · 글자 그림자와 같은 것들.
    // 3.7.2 다른 CSS: 사용자 설정 › 커스텀 CSS 를 테마가 켜진 동안 꺼 둘지 (내용은 그대로 — 끄면 바로 돌아온다)
    compat: { muteCustomCss: false, preserveExtensionColors: false, extensionColorsOff: [], cssAsked: '' },   // cssAsked: 7.2.6 「쓰던 테마가 있어요」에 답한 다른 CSS 지문
    deus: {
        on: false,
        ink: {
            outline: { on: false, color: '#000000', alpha: 100, width: 0.6 },
            shadow: { on: false, color: '#000000', alpha: 60, angle: 135, distance: 1.5, blur: 2 },
        },
        // 4.1.2 감정 대사 효과(Expressive Dialogue): 움직임 soft|normal|big · 빛 · 색 흐름 · 기기의 애니메이션 줄이기 무시 (css/55-dem-expressive.css)
        fx: { on: true, motion: 'normal', glow: true, flow: false, flowMode: 'text', force: false }, // flowMode: 색 흐름을 글자에(text) | 형광펜 띠에(marker)
    },
    // 3.2.0 화이트 · 나이트 자동: by = system(기기 다크 모드) | time(night 부터 day 까지 나이트) — automode.js (1.0.0 되살림 · 8.2.5 와 같은 키)
    auto: { on: false, by: 'system', night: '20:00', day: '07:00' },
    // 3.3.1 날씨 효과의 내 그림 목록 [{ id, name, data }] — 스타일에는 안 담김 (고른 그림만 chat.weatherImage)
    weatherImages: [],
    // 7.9.9 프로필 여러 개: 캐릭터 아바타 사진을 여러 장 등록해 두고 채팅방을 열 때마다 하나를 고른다 (multi-avatar/). 파일은 서버 user/images, 여기엔 경로 · 고정만
    multiAvatar: { on: true, when: 'chat', includeCard: true, chars: {} },
    customPalettes: [],   // [{ id, name, light, dark }] custompalette.js
    activeCustomPalette: '',
    addons: { zipinstall: false, tts: false, direction: false, assets: false, order: false, perf: false, words: false, capture: false, models: false, modelswitch: false, regexlink: false, rewrite: false, bookmarks: false, notes: false, translator: false, prompt: false, customstyle: false, mermaid: false, 'prompt-template': false, ...PRIVATE_FLAGS },
    addonCarry: 0,   // 8.3.0 개인 확장 플래그 이어받기를 어느 단계까지 했나 (private-addons.js ADDON_CARRY · addons.js 가 한 번 올린다)
    addonUI: { translatorDrawer: true, ttsDrawer: true, orderIcon: false, perfIcon: false, wordsMenu: false, captureMenu: false, modelswitchMenu: true, notesMenu: true, notesBarMenu: true, zipinstallMenu: true, perfMenu: { watchdog:false, timer:true, perf:false, log:true, dedupe:false, storage:true },
        // 4.5.5: 성능 보조의 도구를 아예 안 불러오게 (perfMenu 는 '메뉴에 보이기', 이것은 '불러오기').
        // 기본은 전부 켬 — 지금 쓰던 대로 돌아가고, 안 쓰는 도구를 끄면 그만큼 시작이 가벼워진다.
        perfLoad: { watchdog:true, timer:true, perf:true, log:true, dedupe:true } },
    wordTools: { messageView: 'translation', rules: [], presets: [], syntax: 'comma', caseSensitive: false, wholeWords: false, particles: true, maskWords: '' }, // maskWords: 6.0.4 잠시 가리기 낱말(한 줄에 하나 · 쉼표) — 스위치는 세션 안에서만, 저장하지 않는다 (wordmask.js) · 1.0.0 되살림(9.0.0 5357f89e 에서 걷었던 단어 치환)
    captureTools: { replace: false, replaceRules: [], preset: '', redact: false, names: [], mask: 'auto', maskWord: '○○', maskStyles: {}, format:'image', imagePages:false, duration:6, maxMB:8, maxParagraphs:4, resolution:1080, backgroundTint:60, includeWeather:true, includeBackground:true, showName:true, showAvatar:true, showAssets:true, showTimestamp:true, showModel:true, showMessageId:true, showTokens:true, showGenerationTime:true, filterPreset:'none', grain:0, brightness:0, contrast:0, saturation:0, temperature:0, vignette:0 }, // filterPreset · grain … vignette: 5.5.3 캡처 필터 (프리셋 none|mono|film|vintage|cool|warm|custom · 전부 0 이면 결과 픽셀 그대로)
    onehand: { on: false, swipe: true, imp: true, cont: true, regen: true, top: true, bottom: true, jump: true, delLast: true },
    logCopy: { on: true, shape: 'card', palette: '', category: 'basic', recent: [], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto' },   // 로그 복사 — on 만 설정 창 · 나머지는 시트가 기억
    extcheck: { aiConsent: false, profileId: '' },   // 1.0.3 확장 충돌 검사 AI 전송 동의 · 연결(기억)
    searchAi: { on: false, profileId: '', provider: '', models: {}, customModels: {}, customUrl: '' },
    replyNotify: { on: false }, // 4.8.7 답 완료 알림: 다른 앱을 보고 있을 때 답이 끝나면 폰 알림 · 진동 (reply-notify.js)
    bgWindow: { on: false, mode: 'audio' }, // 4.3.2 백그라운드 창 (실험): 답을 기다리는 동안 PIP 작은 창을 띄워 다른 앱을 봐도 생성 · 번역이 이어지게
    sceneSound: { on: false, volume: 40, thunder: true, background: true, files: {}, music: { on: false, volume: 30, mood: 'auto', files: {} } }, // 6.9.8 장면 소리: 날씨 효과에 맞춘 배경 소리 (scene-sound.js) — volume %, thunder 비에 천둥, background 숨은 탭에서도, files { rain | wind | hush | water: '/user/files/…' }
    // 3.1.0 스타일: 내 스타일 목록 [{ id, name, data }] · 캐릭터 연결 { 'c:아바타' | 'g:그룹': 스타일 id } · 지금 입힌 캐릭터 스타일 { id, key } · 그 전 원래 모습 (styles.js · charstyle.js)
    styles: [],
    charStyles: {},
    promptBinds: {},   // 6.0.4 프롬프트 귀속 { <프롬프트 identifier>: { keys: ['c:아바타' | 'g:그룹' | 'c:아바타/채팅' | 'g:그룹/채팅'], regex: [정규식 id] } } (promptbind.js)
    fruitEntryMode: 'wand',
    fruitEntryDisplay: 'both',
    fruitEntryIcon: 'fa-apple-whole',
    fruitTypography: {on:false,kind:'status',types:{}},
    promptFolders: { on: true, presets: {} },   // 1.0.1 다듬기는 prompt-folders.js
    chatOrganizer: { on: false, folders: [], chats: {} },
    inputBox: { hold: false, noCorrect: false },   // 1.1.2 입력칸 높이 고정 · 자동 수정 밑줄 끄기 (input-box.js — 켤 때만 받아요)
    apiStatus: { on: false },   // 1.0.3 API 서버 상태 — 켜면 회사 공식 상태 페이지(바깥 주소)를 읽어요 (api-status.js)
    qrShelf: { on: false, items: {}, recent: [] },   // 1.0.3 QR 책장 (모양은 qr-shelf-core.js tidyStore)
    promptSaves: { on: false, presets: {} }, presetFolders: { on: false, folders: [] }, quick: { selEdit: false, mesDelete: false, rangeDelete: true, selEditTr: false, adeChat: false, adeDaily: false, wiSkip: false, qrFold: false },   // 1.0.3 편의 기능 (src/quick/) · 1.1.1 시제품
    promptLink: { on: false, rows: [] },   // 6.5.2 캐릭터 이름 연동 — 이름이 든 프롬프트·정규식을 그 캐릭터 채팅에서만 켜고 「기본」 짝은 반대로 · 6.7.5 여러 줄 rows [{ word, cards: [아바타] }] (prompt-link.js · promptbind.js)
    longpressHelp: true,   // 8.1.2 단추 길게 누르면 설명 (longpress-help.js — 끄면 길게 눌러도 원래 동작만)
    koUi: true,   // 6.9.0 실리태번 한국어 화면 다듬기 (ko-ui.js — 언어가 ko-kr 일 때만, 바꾸면 새로고침 뒤)
    headSwitchRows: false,   // 새 설치에서는 확장 위 스위치 안내 줄을 꺼 두어요.
    roleIcons: {},   // 7.9.3 단추 아이콘 바꾸기 { <역할 id>: 'fa:s:이름:번호' | 'tx:글자' | 'im:data:…' } — 바꾼 역할만 (role-icons-core.js)
    pickedIcons: {},   // 화면에서 고른 단추 { <열쇠 해시>: { key, label, icon?, value? } } — 확장이 더한 단추(role-icons-pick.js)
    headSwitches: {},   // 6.0.4 확장 위 스위치 { <창 열쇠 id:…|cls:…>: true } — 창 안 「확장 탭에 보이기」로 고른 확장 창 (headswitch.js)
    activeStyle: null,
    baseStyle: null,
    profile: { decor: { ...DECOR_DEFAULTS }, nameSize: 24, nameWeight: 650, nameSpacing: 0, nameHeight: 1.3, nameColor: '#91a5ba', nameAuto: true, nameAlign: 'center', nameRowAlign: 'left', nameItalic: false, nameUnderline: false, headerLayout: 'below-two', headerGap: 8, metaSize: 12, metaOpacity: 70, buttonGap: 8, nameOutline: 0, nameOutlineColor: '#000000', nameShadow: false, nameShadowBlur: 4, nameShadowY: 1, nameShadowAlpha: 25, ...FRAME_DEFAULTS, mode: 'small', layout: 'column', sizing: 'pixels', screenHeight: 45, maxHeight: 70, visibleHeight: 100, width: 100, height: 320, fit: 'cover', positionX: 50, positionY: 35, radius: 18, gap: 20, blur: 0, opacity: 100, fadeY: 0, fadeX: 0, original: true },
    image: { decor: { ...DECOR_DEFAULTS }, ...FRAME_DEFAULTS, layout: 'bleed', shape: 'rect', fit: 'ratio', maxh: 78, height: 40, blendWhite: true, cutoutSame: true, fade: 'soft', fadeY: 10, fadeX: 0, angle: 3, radius: 14, cornerCut: 10, scratchAmount: 45, scratchDirection: 'straight', scratchTexture: 'sharp', edge: 'none', edgeAuto: true, edgeSideTop: true, edgeSideRight: true, edgeSideBottom: true, edgeSideLeft: true, edgeThick: 1, edgeAlpha: 30, edgeGlow: 0, mask: '', maskFit: 'stretch', masks: [], maskId: '', cutEdge: cutEdgeDefaults() }, // cutEdge 6.1.6(cutedge.js) · shape rect|custom · fit ratio|fixed · fade off|soft|medium|strong — angle · cornerCut · scratch* 는 옛 값
};

DEFAULTS.userProfile = { ...structuredClone(DEFAULTS.profile), mode: 'none', side: 'auto', metaSide: 'auto' }; // auto = 말풍선이면 오른쪽(메신저처럼), 나머지 모양은 왼쪽

// 스타일 시트에 그대로 들어가는 색 문자열 — #hex · rgb(a) · hsl(a) 만.
// 주석·따옴표·역슬래시도 거른다: 닫히지 않은 토큰은 뒤의 변수 선언까지 삼킨다.
// (직접 고친 색 · 나눈 스타일 · 선택 공유 프리셋이 같이 씀)
export const CSS_COLOR = /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgba?|hsla?)\([\w .,%+\-/]*\))$/i;
export const isCssColor = value => typeof value === 'string' && CSS_COLOR.test(value.trim());
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// 5.3.4: 그림 data URL 은 base64 글자만 — 'data:image/' 로 시작하는지만 보면 따옴표 · 괄호가 섞여 style 속성 · CSS url() 을 빠져나갔다 (공유 코드로 스크립트 실행)
// 지금 설정 창이 만드는 것은 PNG 뿐이지만 예전에 저장한 다른 형식도 그대로 읽히게
export const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif|avif);base64,[a-z\d+/=]+$/i;
export const isDataImage = value => typeof value === 'string' && value.length <= 8000000 && DATA_IMAGE.test(value);
// 큰 그림은 내용이 바뀔 때만 재검사한다. 소유 객체가 사라지면 캐시도 함께 회수된다.
const checkedImages = new WeakMap();
function validOwnedImage(owner, value) {
    if (typeof value === 'string' && checkedImages.get(owner) === value) return true;
    if (!isDataImage(value)) { checkedImages.delete(owner); return false; }
    checkedImages.set(owner, value);
    return true;
}
// 5.3.4: body 클래스로 들어가는 값은 아는 것만 — 공백이 든 값 하나로 classList.add 가 던져 시작할 때마다 테마가 죽었다
// char: 캐릭터 메시지 — plain 글자만(기본, 예전 모습) | bubble 말풍선 (5.8.2, css/06-chat-text.css)
// bubbleSplit: 말풍선 나누기 — whole 메시지 하나 = 말풍선 하나(기본, 내 말풍선 예전 모습) | para 빈 줄(엔터 두 번)로 나눈 문단마다 (내 · 캐릭터 말풍선 둘 다, body.salty-bubble-<값>)
const CLASS_VALUES = { user: ['bubble', 'card', 'table', 'plain'], char: ['plain', 'bubble'], bubbleSplit: ['whole', 'para'], header: ['full', 'name', 'none'], icons: ['line', 'default'], layout: ['bleed', 'column', 'inset'], style: ['marker', 'full', 'bold', 'tint', 'plain'], tilt: ['flat', 'slant', 'steep'] };
// 5.3.4: 내 글꼴 항목 거르기 — family · 주소가 <style> 과 @font-face 에 들어간다. 공유 코드로 받은 항목도 이 검사를 지난다
// 5.3.5: 따옴표 없는 이름은 글자 · 숫자 · 띄어쓰기 · _ - 만 ('x /* ' 한 줄이 변수 시트 9KB 를 주석으로 삼켰다), 따옴표 안은 /* */ \ 제어 문자 금지.
// 쓰는 쪽(fonts.js)은 늘 cssFamily · cssUrl 을 거친 값만 CSS 에 넣는다
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong']);
const FAMILY_BARE = /^[\p{L}\p{N}\p{M} _-]{1,200}$/u;
const FAMILY_QUOTED = /^[^'"\\;{}<>\p{Cc}]{1,200}$/u;
/** 글꼴 가족 이름 하나 → CSS 에 넣을 값 ('이름' 으로 감쌈, 기본 가족은 그대로). 못 쓰는 이름이면 null */
export function cssFamily(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    const q = /^(['"])([\s\S]*)\1$/.exec(v);
    if (q) {
        const body = q[2];
        return body.trim() && FAMILY_QUOTED.test(body) && !body.includes('/*') && !body.includes('*/') ? `'${body}'` : null;
    }
    if (!FAMILY_BARE.test(v) || !v.trim()) return null;
    return GENERIC_FAMILIES.has(v.toLowerCase()) ? v : `'${v}'`;
}
const FONT_DATA = /^data:(?:font|application)\/[\w.+-]{1,40};base64,[a-z\d+/=]+$/i;
/** 글꼴 파일 주소 → url("…") 안에 넣을 값. https:// · 같은 서버(/…) · data: 글꼴만, 따옴표 · 괄호 · 공백 · \ 는 %XX 로 바꿈. 못 쓰면 null */
export function cssUrl(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (/^data:/i.test(v)) return v.length <= 64000000 && FONT_DATA.test(v) ? v : null;
    if (v.length > 2000 || /\p{Cc}/u.test(v) || !(/^https:\/\/[^\s/\\]/i.test(v) || /^\/(?![/\\])/.test(v))) return null;
    return v.replace(/[\s"'()\\<>]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}
// 글꼴 CSS 주소 (fetch · <link href> 로만 쓰임 — CSS 글에는 안 들어감): https 만, 제어 문자 없이
export const cssLink = u => typeof u === 'string' && u.length <= 2000 && /^https:\/\/[^\s/\\]/i.test(u.trim()) && !/\p{Cc}/u.test(u);
/** 이 글꼴 항목을 적용해도 되는지. 공유 코드 · 가져오기는 이것을 못 지나면 버리고, 저장된 내 글꼴은 남겨 두되 적용만 안 함 (fonts.js allFonts) */
export function safeFont(f) {
    if (!isObj(f) || typeof f.id !== 'string' || !/^[\w.-]{1,80}$/.test(f.id) || cssFamily(f.family) === null) return false;
    if (f.label !== undefined && typeof f.label !== 'string') return false;
    if (f.google !== undefined && (typeof f.google !== 'string' || !/^[^\s&#"'<>\\\p{Cc}]{1,300}$/u.test(f.google))) return false;
    if (f.fa !== undefined && (typeof f.fa !== 'string' || !/^[\w.-]{1,100}$/.test(f.fa))) return false;
    if (f.css !== undefined && ![].concat(f.css).every(cssLink)) return false;
    if (f.file !== undefined && cssUrl(f.file) === null) return false;
    if (f.files !== undefined && !(Array.isArray(f.files) && f.files.every(x => isObj(x) && cssUrl(x.url) !== null
        && (x.weight == null || /^\d{1,3}( \d{1,3})?$/.test(String(x.weight))) && (x.style == null || ['normal', 'italic', 'oblique'].includes(x.style))))) return false;
    return true;
}

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
    if (!validOwnedImage(image, image.mask)) image.mask = ''; // base64 글자만 (url("…") 에 그대로 들어간다)
    if (!MASK_FITS.includes(image.maskFit)) image.maskFit = 'stretch';
    // 저장한 도형 목록 [{ id, name, data }] — 깨진 항목은 버리고, 가리키는 칸이 없으면 '저장 안 된 그림' 상태로
    if (!Array.isArray(image.masks)) image.masks = [];
    const maskName = item => typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 24) : '커스텀';
    const validMask = item => isObj(item) && typeof item.id === 'string' && /^[\w-]{1,40}$/.test(item.id) && validOwnedImage(item, item.data);
    if (!image.masks.every(item => validMask(item) && Object.keys(item).length === 3 && item.name === maskName(item))) {
        image.masks = image.masks.filter(validMask).map(item => ({ id: item.id, name: maskName(item), data: item.data }));
    }
    if (typeof image.maskId !== 'string' || !image.masks.some(item => item.id === image.maskId)) image.maskId = '';
    // 자동 색은 불리언 — 가져온 파일의 "false" 는 문자열이라 그냥 두면 참으로 읽힌다 (tidyType 의 justify 와 같은 방식).
    // fill() 이 먼저 돌아 없는 키는 이미 기본값이라 여기서 undefined 를 볼 일은 없다 — 이 줄은 반드시 fill() 뒤여야 한다
    image.edgeAuto = image.edgeAuto === true || image.edgeAuto === 'true';
    // 투명 배경 캐릭터 컷도 보통 그림과 같은 모양 · 흐림 · 테두리 (2.7.8, 기본 켬) — 끄면 예전처럼 자르지 않고 아래만 살짝 흐림
    image.cutoutSame = image.cutoutSame !== false && image.cutoutSame !== 'false';
    // 6.1.6 투명 그림 외곽선 · 그림자: 범위 · 색 · 켬/끔을 그 자리에서 정리 (가져온 파일의 문자열 "false" 도)
    tidyCutEdge(image);
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
    // 5.3.2 취소선
    if (!isObj(s.strike)) s.strike = structuredClone(DEFAULTS.strike);
    s.strike.own = !!s.strike.own; s.strike.line = s.strike.line !== false; s.strike.italic = !!s.strike.italic;
    if (!/^#[0-9a-f]{6}$/i.test(String(s.strike.color))) s.strike.color = DEFAULTS.strike.color;
    s.strike.thickness = Number.isFinite(parseFloat(s.strike.thickness)) ? clampTo(parseFloat(s.strike.thickness), [1, 4]) : DEFAULTS.strike.thickness;
    s.strike.fade = Number.isFinite(parseFloat(s.strike.fade)) ? clampTo(parseFloat(s.strike.fade), [20, 100]) : DEFAULTS.strike.fade;
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
/** 5.3.4: body 클래스 · 변수 시트로 가는 모양 값 — 모르는 값은 기본값, 톤(채도 · 밝기 %)은 0~100 숫자 */
function tidyClassValues(s) {
    const pick = (owner, key, list) => { if (isObj(owner) && !list.includes(owner[key])) owner[key] = list[0]; }; // 목록 첫 값 = 기본값
    for (const key of ['user', 'char', 'bubbleSplit', 'header', 'icons']) pick(s.chat, key, CLASS_VALUES[key]);
    pick(s.image, 'layout', CLASS_VALUES.layout);
    pick(s.dialogue, 'style', CLASS_VALUES.style);
    pick(s.dialogue, 'tilt', CLASS_VALUES.tilt);
    if (!isObj(s.chat)) return;
    for (const tone of ['tone', 'markerTone']) {
        if (!isObj(s.chat[tone])) s.chat[tone] = structuredClone(DEFAULTS.chat[tone]);
        for (const mode of ['light', 'dark']) {
            if (!isObj(s.chat[tone][mode])) s.chat[tone][mode] = structuredClone(DEFAULTS.chat[tone][mode]);
            for (const key of ['s', 'l']) {
                const n = Number(s.chat[tone][mode][key]);
                s.chat[tone][mode][key] = Number.isFinite(n) ? clampTo(n, [0, 100]) : DEFAULTS.chat[tone][mode][key];
            }
        }
    }
}
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const flag = (v, def) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : def);
// 새 설치 기본값과 달리, 기존 설정의 생략·잘못된 값은 예전 켬 동작으로 이어받아요.
function preserveLegacyLightFlags(saved) {
    for (const key of ['syncWatch', 'squareButtons', 'headSwitchRows']) saved[key] = flag(saved[key], true);
    if (!isObj(saved.chat)) saved.chat = {};
    saved.chat.numComma = flag(saved.chat.numComma, true);
}
// 6.7.5 캐릭터 이름 연동 줄: 말은 다듬은 80자, 카드는 아바타 파일 이름 50장까지 중복 없이, 20줄까지 · 예전 한 줄 { name } 은 첫 줄로 옮긴다 (말 · 카드는 설정에만 있다)
const linkText = v => typeof v === 'string' ? Array.from(v.trim()).slice(0, 80).join('') : '';
function tidyLinkRows(link) {
    const rows = Array.isArray(link.rows) && link.rows.length ? link.rows : linkText(link.name) ? [{ word: link.name, cards: [] }] : [];   // 기본값이 먼저 채운 빈 rows 에도 옮긴다
    return rows.filter(isObj).slice(0, 20).map(r => ({ word: linkText(r.word), cards: [...new Set((Array.isArray(r.cards) ? r.cards : []).filter(c => typeof c === 'string' && c && c.length <= 255))].slice(0, 50) }));
}

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
    // 6.0.4 프롬프트 귀속: 열쇠는 c:/g: 로 시작하는 글자만, 중복 없이 200개까지 · 빈 묶음은 지운다
    if (!isObj(s.promptBinds)) s.promptBinds = {};
    for (const [id, bind] of Object.entries(s.promptBinds)) {
        if (!id || !isObj(bind)) { delete s.promptBinds[id]; continue; }
        bind.keys = [...new Set((Array.isArray(bind.keys) ? bind.keys : []).filter(k => typeof k === 'string' && /^[cg]:./.test(k)))].slice(0, 200); bind.regex = [...new Set((Array.isArray(bind.regex) ? bind.regex : []).filter(r => typeof r === 'string' && r))].slice(0, 64);
        if (!bind.keys.length && !bind.regex.length) delete s.promptBinds[id];
    }
    // 6.5.2 캐릭터 이름 연동: 켜짐은 불리언 · 6.7.5 줄은 tidyLinkRows (예전 이름은 첫 줄로)
    if (!isObj(s.promptLink)) s.promptLink = structuredClone(DEFAULTS.promptLink);
    s.fruitTypography = tidyFruitType(s.fruitTypography);
    if(!['wand','qr','cat'].includes(s.fruitEntryMode))s.fruitEntryMode='wand';
    s.fruitEntryDisplay=entryDisplay(s.fruitEntryDisplay);s.fruitEntryIcon=entryIcon(s.fruitEntryIcon);
    s.promptLink.on = flag(s.promptLink.on, false);
    s.promptLink.rows = tidyLinkRows(s.promptLink);
    delete s.promptLink.name;
    // 6.0.4 확장 위 스위치: true 인 글자 열쇠만, 100개까지
    if (!isObj(s.headSwitches)) s.headSwitches = {};
    for (const [k, v] of Object.entries(s.headSwitches)) if (!k || v !== true) delete s.headSwitches[k];
    for (const k of Object.keys(s.headSwitches).slice(100)) delete s.headSwitches[k];
    s.headSwitchRows = flag(s.headSwitchRows, DEFAULTS.headSwitchRows);
    s.koUi = s.koUi !== false;   // 6.9.0
    s.longpressHelp = s.longpressHelp !== false;   // 8.1.2
    if (s.baseStyle !== null && !isObj(s.baseStyle)) s.baseStyle = null;
    // 3.3.1 날씨 그림 목록
    const okImage = x => isObj(x) && typeof x.id === 'string' && /^[\w-]{1,40}$/.test(x.id) && validOwnedImage(x, x.data); // id 는 data-id 속성에, 그림은 style 속성에 들어간다
    if (!Array.isArray(s.weatherImages)) s.weatherImages = [];
    else if (s.weatherImages.length > 12 || !s.weatherImages.every(okImage)) s.weatherImages = s.weatherImages.filter(okImage).slice(0, 12);
    s.multiAvatar = tidyMultiAvatar(s.multiAvatar, DEFAULTS.multiAvatar);   // 7.9.9
}

/** 3.1.0 켜고 끄는 값: 가져온 파일의 "false" 문자열 · 깨진 값 거르기 */
function tidyFlags(s) {
    s.squareButtons = flag(s.squareButtons, DEFAULTS.squareButtons);
    s.syncWatch = flag(s.syncWatch, DEFAULTS.syncWatch);
    if (!isObj(s.reader)) s.reader = structuredClone(DEFAULTS.reader);
    s.reader.autoHide = flag(s.reader.autoHide, false);
    if (!isObj(s.deus)) s.deus = structuredClone(DEFAULTS.deus);
    s.deus.on = flag(s.deus.on, false);
    // 6.5.2: 과일 상태 카드 꾸미기(6.5.0~6.5.1 의 fruit.cards)를 뺐다 — 켜 둔 채 올려도 저장값만 조용히 버린다
    if (isObj(s.fruit)) delete s.fruit.cards;
    if (!isObj(s.fruit) || !Object.keys(s.fruit).length) delete s.fruit;
    if (!isObj(s.onehand)) s.onehand = structuredClone(DEFAULTS.onehand);
    if (!isObj(s.bgWindow)) s.bgWindow = structuredClone(DEFAULTS.bgWindow);
    s.replyNotify = { on: isObj(s.replyNotify) && s.replyNotify.on === true };
    s.apiStatus = { on: isObj(s.apiStatus) && s.apiStatus.on === true };   // 1.0.3
    s.logCopy = tidyLogCopy(s.logCopy);
    const profile = v => typeof v === 'string' ? v.slice(0,120) : '';
    const xc = isObj(s.extcheck) ? s.extcheck : {}; s.extcheck = { aiConsent: xc.aiConsent === true, profileId: profile(xc.profileId) };
    const q = isObj(s.qrShelf) ? s.qrShelf : {};   // 1.0.3 QR 책장 (칸 안쪽은 열 때 tidyStore)
    s.qrShelf = { ...q, on: q.on === true, items: isObj(q.items) ? q.items : {}, recent: Array.isArray(q.recent) ? q.recent : [] };
    {
        const ai = s.searchAi, text = (v,n) => typeof v === 'string' ? v.trim().slice(0,n) : '';
        const modelMap = v => isObj(v) ? v : {};
        s.searchAi = { on: ai.on === true, profileId: profile(ai.profileId), provider: text(ai.provider,32), models: modelMap(ai.models), customModels: modelMap(ai.customModels), customUrl: text(ai.customUrl,2048) };
    }
    s.bgWindow = { on: s.bgWindow.on === true, mode: s.bgWindow.mode === 'pip' ? 'pip' : 'audio' };
    s.sceneSound = tidySceneSound(s.sceneSound);   // 6.9.8 장면 소리
    for (const key of Object.keys(DEFAULTS.onehand)) s.onehand[key] = flag(s.onehand[key], DEFAULTS.onehand[key]);
    if (!isObj(s.inputBox)) s.inputBox = {};
    for (const key of Object.keys(DEFAULTS.inputBox)) s.inputBox[key] = flag(s.inputBox[key], false);
    if (!isObj(s.quick)) s.quick = {};
    for (const key of Object.keys(DEFAULTS.quick)) s.quick[key] = flag(s.quick[key], DEFAULTS.quick[key]);
    if (!isObj(s.promptSaves)) s.promptSaves = {};
    s.promptSaves.on = flag(s.promptSaves.on, false);
    if (!isObj(s.promptSaves.presets)) s.promptSaves.presets = {};
    if (!isObj(s.presetFolders)) s.presetFolders = {};
    s.presetFolders.on = flag(s.presetFolders.on, false);
    if (!Array.isArray(s.presetFolders.folders)) s.presetFolders.folders = [];
    if (isObj(s.chat)) {
        s.chat.demSkin = flag(s.chat.demSkin, false);
        s.chat.solaStyle = s.chat.solaStyle === 'lemon' ? 'lemon' : 'original';
        s.chat.homeIcon = s.chat.homeIcon === 'lemon' || s.chat.homeIcon === 'square' ? s.chat.homeIcon : 'auto';   // 1.1.2 홈 화면 아이콘 모양(splash.js)
        s.chat.demFold = flag(s.chat.demFold, true);
        s.chat.demGlow = Number.isFinite(Number(s.chat.demGlow)) ? Math.min(100, Math.max(0, Math.round(Number(s.chat.demGlow)))) : 35; // 8.0.9 데우스 V3 테두리 빛 (css/30-dem-skin.css --bl-dem-glow)
        s.chat.demPreviewVersion = s.chat.demPreviewVersion === '2.5' ? '2.5' : 'v3'; // 8.1.0 상태창 글자 미리보기의 데우스 표본 판 (fruit-type-ui.js, 데우스 전체에 하나)
        s.chat.numComma = flag(s.chat.numComma, DEFAULTS.chat.numComma);
        s.chat.chatLight = flag(s.chat.chatLight, true); // (10-29) 긴 채팅의 화면 밖 메시지 가볍게 (chat-light.js) — 예전 설정에는 없으니 켬
        s.chat.personaDefer = flag(s.chat.personaDefer, true); // (10-29 perf-persona) 입력 중 목록 갱신 미루기 (persona-defer.js) — 예전 설정에는 없으니 켬
        s.chat.emptyGuard = flag(s.chat.emptyGuard, true); // 8.2.6 빈 채팅 덮어쓰기 막기 (empty-guard-boot.js · 성능 보조 없이도) — 예전 설정에는 없으니 켬 (저장 정리에서 끈 사람은 getSettings 가 먼저 끔으로)
        s.chat.helpMarks = flag(s.chat.helpMarks, true); // 6.1.5 설명 ? 단추 (월드인포 · 한글화 패널)
        s.chat.webSearchMarks = flag(s.chat.webSearchMarks, true); // 6.2.6 웹 검색 · 출처 표시 (websearch.js) — 예전 설정에는 없으니 켬
        s.chat.showMoreAuto = flag(s.chat.showMoreAuto, true); // 6.9.8 「이전 메시지 더 보기」 저절로 (show-more-auto.js) — 예전 설정에는 없으니 켬
        s.chat.lazyAvatars = flag(s.chat.lazyAvatars, true); // 아바타는 가까워질 때 받기 (lazy-avatars.js) — 예전 설정에는 없으니 켬
        s.chat.searchIme = flag(s.chat.searchIme, true); // 검색은 글자 조합이 끝난 뒤 (search-ime.js) — 예전 설정에는 없으니 켬
        s.chat.codePlain = flag(s.chat.codePlain, false); // 코드 색 입히기 끄기 (code-plain.js) — 켤 때만
        s.chat.worldInfoLight = flag(s.chat.worldInfoLight, true); // 월드인포 긴 목록 가볍게 (worldinfo-light.js) — 예전 설정에는 없으니 켬
        s.chat.replyTop = flag(s.chat.replyTop, false); // 6.9.8 새 답 첫 줄로 가는 ↑ (reply-top.js) — 켤 때만
        s.chat.sentTokens = flag(s.chat.sentTokens, true); // 7.0.3 메시지 토큰 (sent-tokens.js, 7.0.4 부터 누르면 내역) — 예전 설정에는 없으니 켬
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
        // 날씨 값을 다 다듬은 뒤에 프로필에 적어요(먼저 적으면 저장 · 불러오기 결과가 달라져요)
        syncWeatherProfile(s.chat);
        // 3.5.4 퀵 리플라이 줄: x 가로 스크롤 · y 세로 스크롤(보이는 줄 1~4)
        if (!['x', 'y'].includes(s.chat.qrScroll)) s.chat.qrScroll = 'x';
        s.chat.qrFind = flag(s.chat.qrFind, true);
        s.chat.qrFold = flag(s.chat.qrFold, true);     // 1.0.1 퀵 리플라이 줄 앞 접기 · 펴기 단추 (layout.js syncQrFold · css/35-qr-bar.css)
        s.chat.qrFolded = flag(s.chat.qrFolded, false); // 1.0.1 접힌 상태 기억 (apply.js salty-qr-folded)
        s.chat.qrCtxNames = flag(s.chat.qrCtxNames, false);   // 7.9.7 하위 세트를 묶은 QR 의 ⋮ 자리에 세트 이름 (기본 ⋮ 만 — 제보: 미리보기와 달리 세트 이름이 이중으로 보였다)
        s.chat.personaTall = flag(s.chat.personaTall, false);
        s.chat.hideSendTextarea = flag(s.chat.hideSendTextarea, false); // 8.2.5 채팅 입력칸 숨기기 (단추 줄만 남김 · apply.js salty-send-textarea-off)
        s.chat.reasoningFollow = flag(s.chat.reasoningFollow, true); // 5.7.5 추론 요청을 끄면 지난 추론도 숨기기 (apply.js stReasoningOff)
        range('qrRows', 1, 4, 2);
        // 3.7.0 퀵 리플라이 줄 자리: bottom 입력창 아래(여태 모양) | top 입력창 위 (사용자 요청 — 입력창 옆에 아이콘을 많이 빼 두면 줄이 좁아서)
        if (!['bottom', 'top'].includes(s.chat.qrPlace)) s.chat.qrPlace = 'bottom';
        // 3.7.0 데우스 프롬프트가 칠한 대사 색 그대로 (형광펜 · 테마 대사색보다 먼저)
        s.chat.demInk = flag(s.chat.demInk, false);
        // 3.7.1 그 색을 어디에: text 글자 색 | marker 형광펜 띠 색 (글자는 테마 색 그대로)
        if (!['text', 'marker'].includes(s.chat.demInkMode)) s.chat.demInkMode = 'text';
        if (s.chat.weatherImage !== '' && !validOwnedImage(s.chat, s.chat.weatherImage)) s.chat.weatherImage = ''; // base64 글자만 — 설정 창 style 속성에 들어간다
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
    // 5.3.4: 나머지 글자 값도 숫자 · 범위 안으로 — 문자열이 그대로 변수 시트에 들어가 "16px;} body{display:none" 같은 규칙을 끼워 넣을 수 있었다.
    // 범위는 슬라이더보다 넓게 (가져온 파일 · 완성된 스타일의 값이 바뀌지 않게)
    for (const [key, range] of Object.entries(TYPE_RANGE)) {
        const n = typeof type[key] === 'number' ? type[key] : parseFloat(type[key]);
        type[key] = Number.isFinite(n) ? clampTo(n, range) : DEFAULTS.type[key];
    }
    type.indent = flag(type.indent, false);
}
const TYPE_RANGE = { size: [8, 40], lineHeight: [1, 3], letterSpacing: [-20, 40], weight: [100, 900], para: [0, 4], measure: [320, 2400] };

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

// 9.0.2 설정 정리(fill · tidy)는 「설정 사건」 때만 다시 해요 — 예전(5.1.2 ~ 9.0.1)에는 메모가 마이크로태스크 하나만 살아
//   작업마다(타이머 · 감시 콜백 · 키 · 채팅 열기 …) 설정 전체를 다시 채우고 정리했어요(폰 4배 프로파일 getSettings 자기 시간 약 200ms).
//   설정 사건 = saveSettings · invalidateSettings · resetSettings · 저장 칸 객체가 통째로 바뀜(가져오기 · 실리태번이 설정을 다시 읽음) ·
//   실리태번 SETTINGS_UPDATED · SETTINGS_LOADED · SETTINGS_LOADED_AFTER · 기기 간 합치기(index.js 가 invalidateSettings 를 불러요).
//   돌려주는 것은 늘 저장 칸 그 객체라 제자리에서 고친 값은 바로 보이고, 늦어지는 것은 정리(범위 · 형식 맞추기)뿐이에요 —
//   고친 뒤 정리된 값을 바로 받아야 하는 곳(설정 창 update · 스타일 입히기 · 여러 장 프로필)은 예전처럼 invalidateSettings() 를 불러요.
let memo = null;
/** 로그 복사 설정 정리 — 모양 id 는 짧은 글자만(모르는 id 는 시트가 「카드」로), 내 글꾸는 20개 · 60KB 까지 (html 은 시트가 소독해 넣은 것) */
function tidyLogCopy(value) {
    const v = isObj(value) ? value : {};
    const id = x => typeof x === 'string' && /^[a-z0-9-]{1,24}$/i.test(x);
    const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
    // 1.0.1 글꾸 마트에서 받은 것은 html 대신 template(네 자리 틈 템플릿 · 가져올 때 검사) + 색 묶음 · 메시지 배치 · 꼬리 · 이모지
    const custom = (Array.isArray(v.custom) ? v.custom : []).filter(c => isObj(c) && id(c.id) && (typeof c.template === 'string' ? c.template.length <= 65536 : typeof c.html === 'string' && c.html.length <= 60000)).slice(0, 20)
        .map(c => ({ id: c.id, name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 40) : '내 글꾸', html: str(c.html, 60000),
            ...(typeof c.template === 'string' ? { template: c.template, colors: isObj(c.colors) ? c.colors : {}, messages: str(c.messages, 12) || 'box', tail: str(c.tail, 60), emoji: str(c.emoji, 8), ...(isObj(c.type) ? { type: c.type } : {}) } : {}),
            slot: c.slot === 'auto' ? 'auto' : Array.isArray(c.slot) && c.slot.length <= 64 && c.slot.every(n => Number.isInteger(n) && n >= 0 && n < 10000) ? c.slot : null }));
    const ids = (list, max = 24) => [...new Set((Array.isArray(list) ? list : []).filter(id))].slice(0, max);
    return { on: v.on !== false, shape: id(v.shape) ? v.shape : 'card', palette: isPaletteId(v.palette) ? v.palette : '', category: id(v.category) ? v.category : 'basic', recent: ids(v.recent).slice(0, 5), fav: ids(v.fav, 96), custom, tagsOff: v.tagsOff === true, titleOff: v.titleOff === true, dateOff: v.dateOff === true, namesOff: v.namesOff === true, topOff: v.topOff === true, bottomOff: v.bottomOff === true, lemonLink: v.lemonLink === true, lemonAt: ['tl', 'tr', 'bl', 'br'].includes(v.lemonAt) ? v.lemonAt : 'auto', blank: Array.isArray(v.blank) ? [...new Set(v.blank)].filter(k => /^(title|date|char|model|prompt)$/.test(k)) : [] };   // 1.0.7 빼기 칩 · 1.0.8 비운 머리 칸
}
export function invalidateSettings() { memo = null; }
export const settingsStats = { tidy: 0 };   // 정리를 몇 번 했나 (시험 · 진단용)
let bound = false;
function bindInvalidation() {
    if (bound) return;
    bound = true;
    try {
        const { eventSource, event_types: t } = SillyTavern.getContext();
        for (const name of ['SETTINGS_UPDATED', 'SETTINGS_LOADED', 'SETTINGS_LOADED_AFTER']) if (t?.[name]) eventSource?.on?.(t[name], invalidateSettings);
    } catch { bound = false; /* 실리태번 문맥이 아직 없으면 다음 정리 때 다시 */ }
}
// 8.2.6 에 뜨거운 읽기 자리를 위해 따로 둔 readSettings 는 이제 getSettings 와 같아요 (부르는 곳이 많아 이름은 남겨요)
export function readSettings() { return getSettings(); }

export function getSettings() {
    const ext = SillyTavern.getContext().extensionSettings;
    if (memo && ext[KEY] === memo) return memo;
    settingsStats.tidy++;
    if (!isObj(ext[KEY])) ext[KEY] = structuredClone(DEFAULTS);
    else preserveLegacyLightFlags(ext[KEY]);
    // 5.1.2: 칸 자체가 깨진 값이면 기본값으로(fill() 은 있는 값을 안 건드려 정리 · apply 가 죽었다)
    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (isObj(value) ? !isObj(ext[KEY][key]) : Array.isArray(value) ? !Array.isArray(ext[KEY][key]) : false) ext[KEY][key] = structuredClone(value);
    }
    // 옛 스크립트 접기 값 이어받기
    if (isObj(ext[KEY].chat) && ext[KEY].chat.triangleFold === undefined && typeof ext.blue_lemonade_scripts?.enabled?.fold === 'boolean') ext[KEY].chat.triangleFold = ext.blue_lemonade_scripts.enabled.fold;
    const migrateWordSyntax = ext[KEY].wordTools && ext[KEY].wordTools.syntax !== 'comma';
    const s = fill(ext[KEY], DEFAULTS);
    appearance?.syncDeviceLayout(s);
    if (isObj(s.dialogue)) tidyDialogue(s.dialogue);
    tidyShadow(s);
    tidyOutline(s);
    if (!isObj(s.compat)) s.compat = structuredClone(DEFAULTS.compat);
    s.compat.muteCustomCss = flag(s.compat.muteCustomCss, false);
    s.compat.preserveExtensionColors = flag(s.compat.preserveExtensionColors, false);
    // 5.5.2: 색을 유지하지 않을 확장(키 목록). 기본 빈 목록 = 켜면 전부 유지 (새로 깐 확장도 유지)
    s.compat.extensionColorsOff = Array.isArray(s.compat.extensionColorsOff)
        ? [...new Set(s.compat.extensionColorsOff.filter(k => typeof k === 'string' && k && k.length < 200))].slice(0, 200) : [];
    // 7.2.6 「쓰던 테마가 있어요」 팝업에 답한 다른 CSS 묶음의 지문 (diagnose.js otherCssFingerprint) — 같은 묶음이면 다시 묻지 않는다
    s.compat.cssAsked = typeof s.compat.cssAsked === 'string' ? s.compat.cssAsked.slice(0, 80) : '';
    if (isObj(s.type)) tidyType(s.type);
    tidyMarkdown(s.markdown);
    tidyRoles(s);
    tidyClassValues(s);
    if (isObj(s.fonts)) {
        FONT_SLOTS.forEach(slot => tidyFontSlot(s.fonts, slot));
        if (!isObj(s.fonts.text)) s.fonts.text = { ...FONT_SET }; // 본문은 'same' 이 없다 (fonts.js slotStack 이 묶음을 기대)
        if (!['auto', 'ko', 'ja', 'zh'].includes(s.fonts.hanja)) s.fonts.hanja = 'auto';
    }
    if (s.image && !IMAGE_SHAPES.includes(s.image.shape)) s.image.shape = 'rect'; // 모르는 모양(가져온 파일 · 뺀 유리 조각 · 물방울) → 네모
    if (s.image) { tidyImage(s.image); tidyFrame(s.image); }
    appearance?.tidyDecor(s.image);
    appearance?.slimDecor(s.image.decor); // 5.6.4: 꺼 둔 기본 프리셋 액자의 그림은 저장하지 않음 (켜면 다시 그림) — 예전 설정도 다음 저장부터 가벼워진다
    for (const owner of ['profile', 'userProfile']) {
        if (!isObj(s[owner])) s[owner] = structuredClone(DEFAULTS[owner]);
        fill(s[owner], DEFAULTS[owner]);
        tidyFrame(s[owner]);
        appearance?.tidyDecor(s[owner]);
        appearance?.slimDecor(s[owner].decor);
        for (const key of ['nameAuto', 'nameItalic', 'nameUnderline', 'nameShadow']) s[owner][key] = flag(s[owner][key], DEFAULTS[owner][key]);
        for (const key of ['nameColor', 'nameOutlineColor']) if (!/^#[a-f\d]{6}$/i.test(s[owner][key])) s[owner][key] = DEFAULTS[owner][key];
        if (!['left', 'center', 'right'].includes(s[owner].nameAlign)) s[owner].nameAlign = 'center';
        if (!['left', 'center', 'right'].includes(s[owner].nameRowAlign)) s[owner].nameRowAlign = 'left'; // 5.8.3 큰 프로필이 아닐 때(작은 · 없음)의 정보 정렬 — 기본 왼쪽 = 예전 모양
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
    if (PALETTE_ALIASES[s.palette]) s.palette = PALETTE_ALIASES[s.palette];
    if (!isPaletteId(s.palette)) s.palette = 'salt';
    if (!isObj(s.auto)) s.auto = structuredClone(DEFAULTS.auto);
    s.auto.on = flag(s.auto.on, false);
    if (!['system', 'time'].includes(s.auto.by)) s.auto.by = 'system';
    for (const key of ['night', 'day']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.auto[key]))) s.auto[key] = DEFAULTS.auto[key];
    s.nightTint = Number.isFinite(Number(s.nightTint)) ? Math.max(1, Math.min(20, Number(s.nightTint))) : 1;
    s.lightTint = Number.isFinite(Number(s.lightTint)) ? Math.max(.5, Math.min(20, Number(s.lightTint))) : .5;
    s.customName = typeof s.customName === 'string' ? s.customName.trim().slice(0, 24) : '';
    s.noticeSeen = typeof s.noticeSeen === 'string' ? s.noticeSeen.slice(0, 20) : '';
    s.updateCheck = s.updateCheck !== false;
    if (appearance) {
        appearance.tidyFrameLibrary(s);
        const gradients = appearance.tidyGradients(s.gradients);
        if (JSON.stringify(gradients) !== JSON.stringify(s.gradients)) s.gradients = gradients;
    }
    tidyFlags(s);
    { const icons = tidyRoleIcons(s.roleIcons); if (icons !== s.roleIcons) s.roleIcons = icons; } // 7.9.3 아는 역할 · 올바른 값만 (가져온 파일의 SVG 도 다시 정리해 본다)
    { const picks = tidyPickedIcons(s.pickedIcons); if (picks !== s.pickedIcons) s.pickedIcons = picks; } // 올바른 열쇠 · 값만
    tidyStyles(s);
    // 5.3.5: 저장된 내 글꼴은 지우지 않는다 (5.3.4 는 괄호 · 공백 든 주소, 긴 이름을 업데이트 때 영영 지웠다) —
    // 못 쓰는 항목도 남기고, 적용할 때 fonts.js 가 safeFont 로 거른다. 항목 모양이 아닌 것만 뺌 (멀쩡하면 배열을 새로 만들지 않음)
    if (!Array.isArray(s.customFonts)) s.customFonts = [];
    else if (!s.customFonts.every(isObj)) s.customFonts = s.customFonts.filter(isObj);
    if (!isObj(s.addons)) s.addons=structuredClone(DEFAULTS.addons);
    for (const key of Object.keys(DEFAULTS.addons)) s.addons[key]=s.addons[key]===true;
    s.addonCarry=Number.isInteger(s.addonCarry)&&s.addonCarry>0?s.addonCarry:0;
    if (!isObj(s.addonUI)) s.addonUI=structuredClone(DEFAULTS.addonUI);
    if (!isObj(s.addonUI.perfMenu)) s.addonUI.perfMenu=structuredClone(DEFAULTS.addonUI.perfMenu);
    if (!isObj(s.addonUI.perfLoad)) s.addonUI.perfLoad=structuredClone(DEFAULTS.addonUI.perfLoad);
    for (const k of Object.keys(DEFAULTS.addonUI.perfLoad)) if (typeof s.addonUI.perfLoad[k] !== 'boolean') s.addonUI.perfLoad[k]=true;
    s.addonUI.translatorDrawer=flag(s.addonUI.translatorDrawer,true);
    s.addonUI.ttsDrawer=flag(s.addonUI.ttsDrawer,true);
    for (const key of ['orderIcon','perfIcon','wordsMenu','captureMenu']) s.addonUI[key]=flag(s.addonUI[key],false);
    for (const key of Object.keys(DEFAULTS.addonUI.perfMenu)) s.addonUI.perfMenu[key]=flag(s.addonUI.perfMenu[key],DEFAULTS.addonUI.perfMenu[key]);
    if (!isObj(s.wordTools)) s.wordTools=structuredClone(DEFAULTS.wordTools);
    s.wordTools.messageView=s.wordTools.messageView==='original'?'original':'translation';
    if (!Array.isArray(s.wordTools.rules)) s.wordTools.rules=[];
    if (!s.wordTools.rules.every(rule=>rule&&typeof rule==='object')) s.wordTools.rules=s.wordTools.rules.filter(rule=>rule&&typeof rule==='object');
    if(!Array.isArray(s.wordTools.presets))s.wordTools.presets=[];
    s.wordTools.presets=s.wordTools.presets.filter(p=>p&&typeof p.id==='string'&&Array.isArray(p.rules)).slice(0,24);
    s.wordTools.maskWords=typeof s.wordTools.maskWords==='string'?s.wordTools.maskWords.slice(0,2000):''; // 6.0.4 잠시 가리기 낱말 (2,000자까지 · 스위치는 저장하지 않는다)
    if(migrateWordSyntax) {
        for(const rules of [s.wordTools.rules,...s.wordTools.presets.map(p=>p.rules)])for(const rule of rules)if(rule&&typeof rule.from==='string')rule.from=rule.from.split('||').join(', ');
        s.wordTools.syntax='comma';
    }
    if(!isObj(s.captureTools))s.captureTools=structuredClone(DEFAULTS.captureTools);
    s.captureTools.format=['video','gif','apng','webp'].includes(s.captureTools.format)?s.captureTools.format:'image';
    s.captureTools.imagePages=s.captureTools.imagePages===true;
    s.captureTools.resolution=Number(s.captureTools.resolution)===1440?1440:1080;
    s.captureTools.maskWord=(typeof s.captureTools.maskWord==='string'&&s.captureTools.maskWord.trim())?s.captureTools.maskWord.trim().slice(0,12):'○○';   // 로그 복사 이름 숨김의 가림 글자(11-03 사용자 요청: 직접 정함)
    s.captureTools.backgroundTint=Math.min(100,Math.max(0,Number(s.captureTools.backgroundTint??60)||0));
    s.captureTools.maxParagraphs=Math.min(20,Math.max(1,Math.floor(Number(s.captureTools.maxParagraphs)||4)));
    s.captureTools.duration=Math.min(30,Math.max(3,Number(s.captureTools.duration)||6));
    s.captureTools.capturePresets=(Array.isArray(s.captureTools.capturePresets)?s.captureTools.capturePresets:[]).filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&isObj(p.values)).slice(0,12); // 채팅 캡처 › 내 프리셋
    s.captureTools.maxMB=Math.min(200,Math.max(0,Number(s.captureTools.maxMB??8)||0)); // APNG · WebP 움짤의 최대 용량 (0 = 제한 없음)
    s.captureTools.filterPreset=FILTER_PRESET_IDS.includes(s.captureTools.filterPreset)?s.captureTools.filterPreset:'none'; // 5.5.3 캡처 필터: 프리셋은 아는 것만, 값은 범위 안의 정수 (예전 저장값은 문자열일 수 있다)
    for(const [key,[min,max]] of Object.entries(FILTER_RANGES))s.captureTools[key]=Math.min(max,Math.max(min,Math.round(Number(s.captureTools[key])||0)));
    if(s.captureTools.filterPreset!=='custom')Object.assign(s.captureTools,FILTER_PRESETS[s.captureTools.filterPreset]); // 이름 있는 프리셋이면 여섯 값을 표에 맞춘다 (가져온 설정 · 표가 바뀐 판에서도 화면과 결과가 같게)
    for(const key of ['showName','showAvatar','showAssets','showTimestamp','showModel','showMessageId','showTokens','showGenerationTime','includeWeather','includeBackground'])s.captureTools[key]=s.captureTools[key]!==false;
    s.captureTools.replace=s.captureTools.replace===true;s.captureTools.redact=s.captureTools.redact===true;
    s.captureTools.replaceRules=(Array.isArray(s.captureTools.replaceRules)?s.captureTools.replaceRules:[]).filter(r=>isObj(r)&&typeof r.from==='string'&&typeof r.to==='string').map(r=>({from:r.from.slice(0,100),to:r.to.slice(0,100)})).slice(0,50); // 로그 복사 「바꾸기」 찾을 말 → 바꿀 말 (replace 가 켬 · 이름 가림과 같은 묶음)
    s.captureTools.names=Array.isArray(s.captureTools.names)?s.captureTools.names.filter(n=>typeof n==='string').slice(0,40):[];
    if(!['auto','white','black','mosaic','tape'].includes(s.captureTools.mask))s.captureTools.mask='auto';
    if(typeof s.captureTools.preset!=='string')s.captureTools.preset='';
    if(!isObj(s.captureTools.maskStyles))s.captureTools.maskStyles={};
    for(const style of MASK_STYLES)s.captureTools.maskStyles[style]=normalizeMaskStyle(s.captureTools.maskStyles[style]);
    // 커스텀 에이드 보관함: 모양이 맞는 것만 · 24개까지 · 색은 색 문자열만
    if (typeof s.activeCustomPalette !== 'string') s.activeCustomPalette = '';
    const okPal = item => item && typeof item.id === 'string' && typeof item.name === 'string' && isObj(item.light) && isObj(item.dark);
    if (!Array.isArray(s.customPalettes) || s.customPalettes.length > 24 || !s.customPalettes.every(okPal)) s.customPalettes = (Array.isArray(s.customPalettes) ? s.customPalettes : []).filter(okPal).slice(0, 24);
    for (const item of s.customPalettes) for (const colors of [item.light, item.dark]) for (const [token, value] of Object.entries(colors)) {
        if (UNSAFE_KEYS.has(token) || !isCssColor(value)) delete colors[token];
        else if (value !== value.trim()) colors[token] = value.trim();
    }
    // 직접 고친 색: 팔레트 id 는 아는 것만, 값은 색 문자열만 — 값이 <style> 에 그대로 들어가니 "red} body{display:none}" 같은 것이 화면을 지웠다 (5.1.2)
    for (const [id, colors] of Object.entries(s.colorOverrides)) {
        if (!isPaletteId(id) || !isObj(colors)) { delete s.colorOverrides[id]; continue; }
        for (const [token, value] of Object.entries(colors)) {
            if (UNSAFE_KEYS.has(token) || !isCssColor(value)) delete colors[token];
            else if (value !== value.trim()) colors[token] = value.trim();
        }
    }
    memo = s;
    bindInvalidation();
    return s;
}

export function saveSettings() {
    const state = SillyTavern.getContext().extensionSettings[KEY];
    if (state) appearance?.saveDeviceLayout(state);
    memo = null;   // 저장하는 값은 다음 읽기 때 한 번 다시 정리해요 (고친 값의 범위 · 형식)
    SillyTavern.getContext().saveSettingsDebounced();
}

// 4.7.0: 무엇을 되돌릴지 고른다 — look(테마 모습) · addons(애드온 켬 · 설정) · tools(단어 치환 · 캡처) · library(프레임 · 팔레트 · 날씨 그림 · 모양)
// 내 글꼴 · 본 공지 · 내 스타일 · 캐릭터 연결은 늘 남긴다 (입혀 둔 캐릭터 스타일 상태는 비움)
const RESET_GROUPS = { addons: ['addons', 'addonUI'], tools: ['wordTools', 'captureTools'], library: ['frameLibrary', 'customPalettes', 'weatherImages'] };
// 테마 모습이 아닌 쓰는 방식(켬 · 사용 모드 · 잠금 · 자동 화이트/나이트 · 한 손 · 몰입 읽기 · 백그라운드 창 · 알림 · 다른 CSS)은 '테마 모습' 초기화에 남긴다
const RESET_KEEP = ['appearanceHistory', 'customFonts', 'noticeSeen', 'updateCheck', 'syncWatch', 'styles', 'charStyles', 'promptBinds', 'promptLink', 'promptFolders', 'chatOrganizer', 'quick', 'promptSaves', 'presetFolders', 'qrShelf', 'apiStatus', 'headSwitches', 'enabled', 'usageMode', 'settingLocks', 'compat', 'auto', 'onehand', 'reader', 'bgWindow', 'replyNotify', 'searchAi', 'extcheck', 'logCopy', 'sceneSound'];
export function resetSettings(groups = { look: true }) {
    const ext = SillyTavern.getContext().extensionSettings;
    const old = ext[KEY] || {};
    const fresh = structuredClone(DEFAULTS);
    const next = groups.look ? fresh : structuredClone(old);
    if (groups.look) {
        for (const key of RESET_KEEP) next[key] = structuredClone(old[key] ?? fresh[key]);
        // 기기별 배치는 켬/끔만 남긴다 — 담긴 pc · mobile 값은 모습이라, 남기면 syncDeviceLayout 이 초기화한 모습 위에 옛 배치를 도로 입힌다
        next.deviceLayouts = { on: old.deviceLayouts?.on === true, pc: {}, mobile: {} };
        // 5.2.3: chat 안의 동작 값과 고정 메시지(데이터)도 모습이 아니다 — 남긴다 (styles.js CHAT_BEHAVIOR 와 같은 목록 + QR 배치 · 고정)
        if (old.chat && typeof old.chat === 'object') {
            for (const key of ['triangleFold', 'weatherAutoRest', 'selectPop', 'colorPop', 'numComma', 'helpMarks', 'webSearchMarks', 'personaTall', 'showMoreAuto', 'replyTop', 'sentTokens', 'streamFade', 'reasoningFollow', 'demFold', 'hideSendTextarea', 'qrFind', 'qrFold', 'qrFolded', 'qrCtxNames', 'qrScroll', 'qrRows', 'qrPlace', 'mesPins', 'lazyAvatars', 'searchIme', 'codePlain', 'worldInfoLight', 'chatLight', 'personaDefer', 'emptyGuard']) {
                if (key in old.chat) next.chat[key] = structuredClone(old.chat[key]);
            }
        }
        if (old.deus && typeof old.deus === 'object' && next.deus && typeof next.deus === 'object' && 'on' in old.deus) next.deus.on = old.deus.on;
    }
    for (const [group, keys] of Object.entries(RESET_GROUPS)) for (const key of keys) next[key] = structuredClone(groups[group] ? DEFAULTS[key] : (old[key] ?? DEFAULTS[key]));
    if (!next.image || typeof next.image !== 'object') next.image = structuredClone(DEFAULTS.image);
    if (groups.library) { next.activeCustomPalette = ''; next.image.masks = []; next.image.maskId = ''; if (next.image.shape === 'custom') next.image.shape = 'rect'; }
    else if (groups.look) next.image.masks = structuredClone(old.image?.masks || []);
    ext[KEY] = next;
    memo = null;
    saveSettings();
    return next;
}

/** 글꼴 묶음 꺼내기 (slot: text | dialogue | ui | em | strong). 'same' 이면 본문 묶음. */
export function fontSet(s, slot) {
    const v = s.fonts[slot];
    if (slot === 'text') return v;
    return v === 'same' ? s.fonts.text : v;
}
