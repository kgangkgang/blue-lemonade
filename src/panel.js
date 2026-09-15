import { openCustomBuilder, customBuilder, bindCustomBuilder, setCustomMode, seedCustom, saveCustomPalette } from './custompalette.js';
// 설정 창. 확장 서랍과 ✦ 메뉴 팝업 두 곳에 같은 창을 띄울 수 있음.
// 위에서 대분류(탭) → 아래에서 소분류(칩)를 골라 한 번에 한 묶음만 보여 줌 (폰에서 창이 아래로 길어지지 않게)
import { getSettings, saveSettings, resetSettings, FONT_SET, FONT_SLOTS, IMAGE_RANGE, TEXT_LIMIT, FADE_AMOUNT } from './settings.js';
import { PALETTES, PALETTE_FAMILIES, paletteFamily, paletteVariant, TOKEN_GROUPS, paletteColors, parseColor, sameColor, safeColor } from './palettes.js';
import { GROUPS, LANGS, SAMPLES, fontsFor, findFont, previewStack, queuePreview, isPreviewReady, isPreviewBlank, addGoogleFont, addCssFont, uploadFont, removeCustomFont } from './fonts.js';
import { applyAll, syncSamples } from './apply.js';
import { getIssues } from './checks.js';
import { classifyAll } from './assets.js';

// 브랜드 레몬 — ✦ 메뉴 · 확장 서랍 · 스플래시와 같은 속찬 레몬(폰트어썸 fa-lemon U+F094) 윤곽 그대로
export const MARK = '<svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path transform="translate(0 448) scale(1 -1)" d="M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

// 대분류 탭 · 소분류 칩 — id 는 저장돼 있으니(localStorage) 바꾸지 말 것
// 2.7.0: 글꼴 탭을 글자 탭에 합침 — 역할(본문 · 대사 · 메뉴 · 속마음 · 강조 · 코드)마다 한 화면에서 글꼴 · 크기 · 굵기 · 자간을 다 만짐
const TABS = [['theme', '테마'], ['text', '글자'], ['chat', '채팅'], ['image', '이미지']];
const SUBS = {
    theme: [['palette', '색'], ['colors', '색 고치기'], ['backup', '백업']],
    text: [['text', '본문'], ['dialogue', '대사'], ['ui', '메뉴'], ['em', '속마음'], ['strong', '강조'], ['code', '코드'], ['para', '문단'], ['shadow', '그림자']],
    chat: [['message', '메시지'], ['screen', '화면'], ['etc', '기타']],
    image: [['layout', '배치'], ['shape', '모양'], ['size', '크기'], ['fade', '흐림']],
};

const panels = new Set();
const stored = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* 무시 */ } };

// 고른 탭·소분류는 서랍과 팝업이 같이 씀 (다시 그려도, 다시 열어도 그대로)
const ui = {
    previewKind: "photo",
    pic: 0, // 이미지 미리보기에서 고른 표본 번호 (PHOTOS)
    tab: stored('salty_tab', 'theme'),
    subOpen: false,      // 소분류 목록 팝업이 펼쳐져 있는지 (2.4.2)
    pvFold: stored('salty_pvfold', '0') === '1', // 붙어 있는 미리보기(예시)를 접어 둠 (2.4.4, 꺾쇠로 접기 · 펴기)
    subs: (() => {
        try {
            const v = JSON.parse(stored('salty_subs', '{}'));
            return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        } catch { return {}; }
    })(),
    picker: null,        // 열려 있는 글꼴 목록: { slot, lang }
    query: '',
    fontTag: 'all',      // 글꼴 목록 태그: 'all' | GROUPS 묶음
};

/** 그 탭에서 보고 있는 소분류 (저장된 값이 없거나 모르는 값이면 첫 칸) */
// 2.7.0 전 저장값 옮기기: 글꼴 탭(font) → 글자 탭, 없어진 소분류(크기 · 모양 → 본문, 형광펜 → 대사)
const OLD_SUBS = { size: 'text', shape: 'text', marker: 'dialogue' };
if (ui.tab === 'font') { ui.tab = 'text'; if (ui.subs.font && !ui.subs.text) ui.subs.text = ui.subs.font; }
function subOf(tab) {
    if (tab === 'theme' && ui.subs.theme === 'custom') return 'custom';
    const list = SUBS[tab] || [];
    if (tab === 'text' && OLD_SUBS[ui.subs.text]) ui.subs.text = OLD_SUBS[ui.subs.text];
    return list.some(([id]) => id === ui.subs[tab]) ? ui.subs[tab] : list[0]?.[0];
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = value;
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isSet = v => !!v && typeof v === 'object'; // 글꼴 칸이 언어별 묶음인지 ('same' 이 아닌지)

let saveTimer = null;
function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 300);
}

export function mountPanel(container, { popup = false } = {}) {
    const root = document.createElement('div');
    root.className = popup ? 'salty-panel in-popup' : 'salty-panel';
    container.appendChild(root);
    panels.add(root);
    bind(root);
    render(root);
    return root;
}

export function refreshPanels() {
    for (const root of panels) {
        if (!root.isConnected) {
            panels.delete(root);
            continue;
        }
        render(root);
    }
}

function update(mutator, rerender = true) {
    mutator(getSettings());
    saveSoon();
    applyAll();
    if (rerender) refreshPanels();
}

// ───────── 조각들 ─────────
function seg(path, options, fallback, cls = '') {
    const value = getPath(getSettings(), path);
    const current = value === undefined || value === null ? fallback : value;
    return `<div class="salty-seg${cls ? ` ${cls}` : ''}">${options.map(([v, label]) =>
        `<button data-act="seg" data-path="${path}" data-value="${esc(v)}" class="${String(current) === String(v) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
}

// 여러 개를 동시에 켜는 칩 줄 (seg 는 하나만 고르는 것) — 테두리를 그릴 면 고르기에 씀
function chips(items) {
    const s = getSettings();
    return `<div class="salty-seg">${items.map(([path, label]) =>
        `<button data-act="chip" data-path="${path}" class="${getPath(s, path) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
}

function toggle(path, checked) {
    return `<label class="salty-switch"><input type="checkbox" data-toggle="${path}" ${checked ? 'checked' : ''}><span></span></label>`;
}

function row(label, control, note = '') {
    return `<div class="salty-row"><span>${label}${note ? `<small>${note}</small>` : ''}</span>${control}</div>`;
}

// 고르기 버튼이 길 때: 라벨 위, 버튼 아래
function stack(label, control, note = '') {
    return `<div class="salty-stack"><span>${label}${note ? `<small>${note}</small>` : ''}</span>${control}</div>`;
}

// 묶음 제목 (+ 옆에 옅은 예시)
function cap(label, hint = '') {
    return `<div class="salty-label">${label}${hint ? ` <span class="salty-hint">${hint}</span>` : ''}</div>`;
}

// 라벨 속 *기울임* · **굵게**: 별표는 옅게 남기고 글자는 실제로 기울이거나 굵게 (먼저 이스케이프, 태그는 여기서만)
function mdLabel(text) {
    const mark = s => `<span class="salty-md-mark">${s}</span>`;
    return esc(text).replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, (_, b, i) => b
        ? `<b class="salty-md salty-md-b">${mark('**')}${b}${mark('**')}</b>`
        : `<em class="salty-md salty-md-i">${mark('*')}${i}${mark('*')}</em>`);
}

function color(token, label, note = '') {
    const pal = paletteColors(getSettings());
    // 투명한 색은 스와치가 빈 칸처럼 보여서 뒤에 투명 격자를 깔아 줌 (CSS .clear)
    const clear = parseColor(pal[token])[3] < 0.1 ? ' clear' : '';
    return `<div class="salty-row salty-color${clear}"><span>${mdLabel(label)}${note ? `<small>${note}</small>` : ''}</span><toolcool-color-picker data-token="${token}" color="${esc(pal[token])}"></toolcool-color-picker></div>`;
}

const fill = (value, min, max) => `${((value - min) / (max - min)) * 100}%`;
// 슬라이드바가 실제로 서는 값: 칸(step)에 맞춰 반올림, 범위 안 (입력칸 14.5 → 슬라이드바 15). 채움도 이 값으로 → 채움 끝이 늘 손잡이 밑
function snap(value, min, max, step) {
    const v = Number.isFinite(Number(value)) ? Number(value) : (min + max) / 2;
    const n = Math.round(Number(((v - min) / step).toFixed(9)));
    return Math.min(max, Math.max(min, Number((min + n * step).toFixed(9))));
}

// 슬라이드바 + 숫자 입력칸: 슬라이드는 한 칸(step)씩, 입력칸은 소수점까지 (범위 밖이면 끝값으로)
const NUM = {
    'type.size': { unit: 'px' },
    'type.dialogueSize': { unit: 'px' },
    'type.uiSize': { unit: 'px' },
    'type.codeSize': { unit: 'px' },
    'type.lineHeight': {},
    'type.letterSpacing': { unit: 'em', scale: 100 }, // 설정에는 1/100 em 로 저장
    'type.weight': {},
    // 역할별 글자 값 (2.7.0)
    'dialogue.weight': {}, 'dialogue.letterSpacing': { unit: 'em', scale: 100 },
    'em.size': { unit: 'px' }, 'em.weight': {}, 'em.letterSpacing': { unit: 'em', scale: 100 },
    'strong.size': { unit: 'px' }, 'strong.weight': {}, 'strong.letterSpacing': { unit: 'em', scale: 100 },
    'code.weight': {}, 'code.letterSpacing': { unit: 'em', scale: 100 },
    'ui.weight': {}, 'ui.letterSpacing': { unit: 'em', scale: 100 },
    'chat.userSize': { unit: '%' }, 'chat.userInk': { unit: '%' },
    'type.para': { unit: '줄' },
    'type.gutter': { unit: 'px' },
    'type.measure': { unit: 'px' },
    'dialogue.markerThick': { unit: '%' },
    'image.maxh': { pre: '화면의', unit: '%' },
    'image.height': { pre: '화면의', unit: '%' },
    'image.radius': { unit: 'px' },
    'image.edgeThick': { unit: 'px' },
    'image.edgeAlpha': { unit: '%' },
    'image.fadeY': { unit: '%' },
    'image.fadeX': { unit: '%' },
    'image.edgeGlow': { unit: 'px' },
    'image.angle': { unit: '도' },
    'image.cornerCut': { unit: '%' },
    'image.scratchAmount': { unit: '%' },
    'shadow.alpha': { unit: '%' },
    'chat.tone.light.s': { unit: '%' }, 'chat.tone.light.l': { unit: '%' }, 'chat.tone.dark.s': { unit: '%' }, 'chat.tone.dark.l': { unit: '%' },
    'shadow.angle': { unit: '도' },
    'shadow.distance': { unit: 'px' },
    'shadow.blur': { unit: 'px' },
};
const numText = (path, v) => String(Number((Number(v) / (NUM[path]?.scale || 1)).toFixed(4)));

/** 숫자 칸 · 슬라이드바 부품 (설정에 값이 아직 없으면 def) */
function sliderParts(path, min, max, step, def) {
    const raw = getPath(getSettings(), path);
    const value = isNum(raw) ? raw : (isNum(def) ? def : (min + max) / 2);
    const n = NUM[path] || {};
    return {
        num: `<span class="salty-num">${n.pre ? `<i>${n.pre}</i>` : ''}<input type="number" step="any" data-num="${path}" data-min="${min}" data-max="${max}" data-def="${value}" value="${numText(path, value)}"><i class="salty-unit">${n.unit || ''}</i></span>`,
        range: `<input type="range" data-range="${path}" min="${min}" max="${max}" step="${step}" value="${value}" style="--fill:${fill(snap(value, min, max, step), min, max)}">`,
    };
}

function slider(path, label, min, max, step, def) {
    const { num, range } = sliderParts(path, min, max, step, def);
    return `<div class="salty-slider"><header><span>${label}</span>${num}</header>${range}</div>`;
}

// 대사 · 메뉴 글자 크기: '본문과 같게' · '기본'(따로 안 씀 = null) 아니면 직접
// 직접일 때 배치는 본문 크기와 같게 — 윗줄에 이름 · 고르기 · 숫자칸, 아랫줄에 슬라이드바 전체 폭
function sizeOpt(path, label, sameLabel, min, max) {
    const own = isNum(getPath(getSettings(), path));
    const choice = `<div class="salty-seg salty-mini">${[['same', sameLabel], ['own', '직접']].map(([id, text]) =>
        `<button data-act="size" data-path="${path}" data-value="${id}" data-min="${min}" data-max="${max}" class="${(id === 'own') === own ? 'on' : ''}">${text}</button>`).join('')}</div>`;
    if (!own) return `<div class="salty-sizeopt">${row(label, choice)}</div>`;
    const { num, range } = sliderParts(path, min, max, 1);
    return `<div class="salty-sizeopt">${row(label, `<span class="salty-sizeopt-ctl">${choice}${num}</span>`)}<div class="salty-slider salty-slider-wide">${range}</div></div>`;
}

/** 실리태번이 지금 쓰는 메뉴 글자 크기(px) — '기본'에서 '직접'으로 갈 때 시작값 */
function stUiSize() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--mainFontSize, 15px)';
    document.body.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return Number.isFinite(px) ? Math.round(px * 2) / 2 : 15;
}

function sample() {
    return `<div class="salty-sample">
        <p>창밖으로 바닷바람이 스며들었다. 그는 식은 찻잔을 내려놓고 <strong>천천히</strong> 고개를 들었다.</p>
        <p><q>「……레몬 한 조각이면 충분해.」</q> <em>(정말 그걸로 될까.)</em></p>
        <p><code>【오후 4시 · 맑음】</code> 그는 잔을 다시 채워 내 쪽으로 밀어 놓았다.</p>
        <p class="salty-sample-more">Lemonade keeps the summer awake — 1234567890 · 夏の海 · 夏日海边</p>
    </div>`;
}

// 메뉴 글꼴 미리보기: 실제 메뉴 글꼴 · 메뉴 크기로 그린 줄 (이 창도 같은 글꼴이지만 크기까지 한눈에 보이게)
function uiSample() {
    return `<div class="salty-uisample">
        <p><b>설정</b> · 캐릭터 · 확장 · 되돌리기</p>
        <p>메뉴 · 단추 · 이 설정 창 글자에 쓰는 글꼴이에요.</p>
        <p>Settings · 1234567890 · 設定 · 设置</p>
    </div>`;
}

// ───────── 미리보기 ─────────
// 설정을 만지는 그 자리에서 결과가 보이게 — 실리태번 메시지 · 에셋 그림 DOM 을 그대로 흉내 낸 작은 무대.
// 모양은 style.css 가 댄다: #chat 규칙을 :is(#salty-nochat, .salty-preview) 로 복사한 자동 생성 블록(surfaces:preview)과
// 그 뒤 손으로 쓴 보정 블록. 그래서 여기서는 마크업만 만들고, 설정은 body 클래스 · --salty-* 변수로 저절로 따라온다.
// 클래스 · 속성 이름이 실제 채팅과 어긋나면 복사한 규칙이 하나도 안 먹으니 바꾸지 말 것

// 메타 세 칸은 늘 채워 넣는다 — 실리태번이 body.no-timer 류로 문서 전체에서 감추고
// 테마의 말풍선 위 여백도 같은 바디 클래스로 갈라지니, 실리태번 쪽 설정이 그대로 반영된다
const PREV_META = '<div class="mesIDDisplay">#42</div><div class="mes_timer">2.4s</div><div class="tokenCounterDisplay">318t</div>';
// ⋯ · 연필: 아이콘 설정(선 아이콘 · 기본)이 보이는 자리 (icons.js TARGETS 가 미리보기까지 노려야 바뀜)
const PREV_BTNS = '<div class="mes_buttons"><div class="mes_button extraMesButtonsHint fa-solid fa-ellipsis"></div><div class="mes_button mes_edit fa-solid fa-pencil"></div></div>';

// 메시지 한 줄 — 실리태번 #message_template 을 줄인 것. is_user 는 속성이라야 테마가 내 메시지를 가려낸다
function prevMes(user, name, text) {
    return `<div class="mes" is_user="${user}">
        <div class="mesAvatarWrapper"><div class="avatar"></div>${PREV_META}</div>
        <div class="mes_block">
            <div class="ch_name flex-container justifySpaceBetween">
                <div class="flex-container flex1 alignitemscenter"><div class="flex-container alignItemsBaseline">
                    <span class="name_text">${name}</span><small class="timestamp">오늘 4:12pm</small>
                </div></div>${PREV_BTNS}
            </div>
            <div class="mes_text">${text}</div>
        </div></div>`;
}

// 채팅 무대: 상대 한 줄(폰에서 두 줄로 꺾이는 길이) + 내 한 줄.
// 본문에 「대사」 · 굵게 · 기울임 · 코드를 섞어 글꼴 · 형광펜 · 강조 · 코드 글꼴이 한눈에 보이게 함
function chatStage() {
    return `<div class="salty-preview" data-prev="chat" aria-hidden="true">
        ${prevMes('false', '아린', '<p><q>「레몬 한 조각이면 충분해.」</q> 그는 <strong>식은 찻잔</strong>을 내려놓고 <em>천천히</em> 고개를 들었다.</p>')}
        ${prevMes('true', '나', '<p><q>「그럼 <code>4시</code>에.」</q> 나는 고개를 끄덕였다.</p>')}
    </div>`;
}

// 그림 무대: 에셋 확장 DOM 네 겹 그대로. .mes_text 가 있어야 테마의 에셋 규칙이 걸리고,
// .mes 가 있어야 '가로 꽉'의 음수 여백(좌우 --salty-gutter)이 되돌릴 여백을 갖는다. src 는 fillPreviews 가 꽂음
function imgStage(art) {
    return `<div class="salty-preview" data-prev="img" data-art="${art}" aria-hidden="true">
        <div class="mes"><div class="mes_block"><div class="mes_text">
            <div class="custom-cac-wrap"><div class="custom-cac-frame"><div class="custom-cac-inner">
                <img class="custom-cac-img" alt="">
            </div></div></div>
        </div></div></div>
    </div>`;
}

// 정규식 카드 무대: 데우스 카드(상태창 · 떡밥 · 트래커)를 줄인 표본 + 모델이 색을 칠한 글자.
// 실리태번이 메시지 안 클래스 앞에 custom- 을 붙이므로 여기도 custom-dem-… 으로 쓴다 — 색 통일 · 이모티콘 규칙이 그 이름을 본다.
// 카드 속 모양(원래 색)은 style.css '정규식 카드 표본' 블록이 댄다
function regexStage() {
    return `<div class="salty-preview" data-prev="regex" aria-hidden="true">
        ${prevMes('false', '아린', `<div class="custom-dem-card custom-dem-status"><div class="custom-dem-card__head"><span class="custom-dem-card__icon">📊</span><span class="custom-dem-card__title">Status</span><span class="custom-dem-card__tag">status</span></div>
            <div class="custom-dem-status-row"><span class="custom-dem-status-row__name">아린</span> <span class="custom-dem-status-row__label custom-dem-status-row__label--physical">몸</span> <span class="custom-dem-status-row__label custom-dem-status-row__label--clothes">옷</span> <span class="custom-dem-status-row__label custom-dem-status-row__label--mental">마음</span> <span class="custom-dem-status-row__score">72</span></div></div>
        <div class="custom-dem-card custom-dem-threads"><div class="custom-dem-card__head"><span class="custom-dem-card__icon">🧶</span><span class="custom-dem-card__title">Story Threads</span></div>
            <div class="custom-dem-threads__body"><span class="custom-dem-thread-tag custom-dem-thread-tag--current">[Current]</span> <span class="custom-dem-thread-tag custom-dem-thread-tag--unresolved">[Unresolved]</span> <span class="custom-dem-thread-tag custom-dem-thread-tag--seed">[Seed]</span></div></div>
        <div class="custom-dem-track"><span class="custom-dem-track__icon">🗓️</span><span class="custom-dem-track__value">3일째</span> <span class="custom-dem-track__icon">📍</span><span class="custom-dem-track__value">항구</span> <span class="custom-dem-track__temp">18°C</span></div>
        <p><font color="#e64553">붉게 칠한 글자</font>와 <span style="color:#40a02b">초록으로 칠한 글자</span>, <q>「그리고 대사.」</q></p>`)}
    </div>`;
}

// 무대 자리 — 탭 맨 위에 붙어 있는 칸. 테마를 끄면 아예 안 그린다:
// 복사한 규칙이 전부 body.salty 를 요구해서 꺼진 상태에선 맨 글자만 남아 더 헷갈린다
// 미리보기 칸 껍데기: 아래 가운데 꺾쇠(접기 · 펴기, 2.4.4 — 사용자: "예시는 꺾쇠로 접었다 폈다"). 접힌 상태는 판 넷이 같이 기억.
// 무대는 fillPreviews 가 뒤에 꽂으니 꺾쇠 단추를 먼저 두고 CSS 로 아래에 붙인다
function prevBox(attrs, inner = '') {
    const folded = ui.pvFold;
    return `<div class="salty-prevbox${folded ? ' folded' : ''}"${attrs ? ` ${attrs}` : ''}>
        <button type="button" class="salty-pvfold" data-act="pvfold" aria-expanded="${!folded}" aria-label="${folded ? '예시 펼치기' : '예시 접기'}"><i aria-hidden="true"></i></button>${inner}</div>`;
}

function chatPreview() {
    return getSettings().enabled ? prevBox('data-pv="chat"') : '';
}

function regexPreview() {
    return getSettings().enabled ? prevBox('data-pv="regex"') : '';
}

function imagePreview(s, sub) {
    if (!s.enabled) return '';
    // 표본 선택은 그림 밖 도구 줄에 두어 효과를 가리지 않는다.
    return prevBox(`data-pv="img" data-sub="${sub}" data-fit="${s.image.fit}" data-kind="${ui.previewKind}"`, `
        <div class="bl-preview-tools">
            <div class="bl-preview-kinds">${[['photo', '일반 이미지'], ['cut', '투명 이미지']].map(([kind, label]) =>
                `<button type="button" data-act="pvkind" data-kind="${kind}" aria-pressed="${ui.previewKind === kind}">${label}</button>`).join('')}</div>
            <div class="bl-preview-samples" ${ui.previewKind === 'cut' ? 'hidden' : ''}>
                <button type="button" data-act="pvpic" data-step="-1" aria-label="이전 표본">‹</button>
                <span>${PHOTOS[ui.pic]}</span>
                <button type="button" data-act="pvpic" data-step="1" aria-label="다음 표본">›</button>
            </div>
        </div>`);
}

// 표본 그림은 캔버스로 그린다 — 파일을 늘리지 않고, SVG data URI 는 naturalWidth 가 0 이라
// assets.js 의 투명 가장자리 판독(캔버스 읽기)이 실패한다. 한 번 그린 것은 문자열로 들고 있음.
// 네 장을 화살표로 넘긴다: 한 장만 두면 "이게 뭐야?" 싶고, 테두리가 어떤 그림에서 잘 보이는지도 견줄 수 없다.
// 고른 순서대로 노을(위 찬색 · 아래 더운색) · 밤(어두운 그림) · 흰 바탕(밝은 그림) · 숲(초록 계열) —
// 자동 색이 그림마다 다른 색을 뽑는 것과, 밝은 테두리가 흰 바탕에서 약해지는 것을 눈으로 확인할 수 있다
const PHOTOS = ['노을', '밤', '흰 바탕', '숲'];
const photoCache = [];

function samplePhoto(index = ui.pic) {
    const i = ((index % PHOTOS.length) + PHOTOS.length) % PHOTOS.length;
    if (photoCache[i]) return photoCache[i];
    const w = 480, h = 260;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (i === 1) return (photoCache[i] = photoNight(cv, g, w, h));
    if (i === 2) return (photoCache[i] = photoPaper(cv, g, w, h));
    if (i === 3) return (photoCache[i] = photoForest(cv, g, w, h));
    const sky = g.createLinearGradient(0, 0, 0, h);
    [[0, '#2E5E96'], [0.42, '#7FAFD4'], [0.62, '#E9D79A'], [0.78, '#E7B44E'], [1, '#A85E22']].forEach(([o, c]) => sky.addColorStop(o, c));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.72, h * 0.46, 0, w * 0.72, h * 0.46, h * 0.32);
    sun.addColorStop(0, 'rgba(255,252,235,0.95)'); sun.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,52,86,0.55)';           // 물결 한 줄: 흐림 · 찢긴 결을 견줄 또렷한 선
    g.beginPath(); g.moveTo(0, h * 0.66);
    g.bezierCurveTo(w * 0.22, h * 0.58, w * 0.38, h * 0.70, w * 0.62, h * 0.63);
    g.bezierCurveTo(w * 0.8, h * 0.58, w * 0.9, h * 0.66, w, h * 0.62);
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(74,36,14,0.42)'; g.fillRect(0, h * 0.87, w, 3);
    return (photoCache[0] = cv.toDataURL('image/png'));
}

// 밤: 거의 검은 그림. 어두운 그림에서는 밝은 띠 · 바깥 블룸만 읽히고 잉크 층은 묻힌다
function photoNight(cv, g, w, h) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    [[0, '#070C16'], [0.55, '#101B2E'], [1, '#1B2A3F']].forEach(([o, c]) => sky.addColorStop(o, c));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,244,214,0.9)';          // 창 두 칸 — 따뜻한 빛
    g.fillRect(w * 0.62, h * 0.34, w * 0.09, h * 0.13);
    g.fillRect(w * 0.76, h * 0.42, w * 0.06, h * 0.09);
    g.fillStyle = 'rgba(140,200,255,0.5)';
    for (const [x, y] of [[0.12, 0.16], [0.3, 0.1], [0.46, 0.22], [0.84, 0.14], [0.2, 0.3]]) {
        g.beginPath(); g.arc(w * x, h * y, 1.6, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';               // 아래 지붕 실루엣
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.72); g.lineTo(w * 0.34, h * 0.62);
    g.lineTo(w * 0.58, h * 0.74); g.lineTo(w, h * 0.66); g.lineTo(w, h); g.closePath(); g.fill();
    return cv.toDataURL('image/png');
}

// 흰 바탕: 일러스트처럼 거의 흰 그림. '흰 배경 지우기' 와 밝은 테두리가 여기서 어떻게 되는지 보인다
function photoPaper(cv, g, w, h) {
    g.fillStyle = '#F6F8FB'; g.fillRect(0, 0, w, h);
    const soft = g.createLinearGradient(0, h * 0.5, 0, h);
    soft.addColorStop(0, 'rgba(206,222,238,0)'); soft.addColorStop(1, 'rgba(186,206,226,0.75)');
    g.fillStyle = soft; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(52,74,102,0.8)'; g.lineWidth = 3;  // 선화 한 덩이
    g.beginPath(); g.arc(w * 0.42, h * 0.44, h * 0.19, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(w * 0.42, h * 0.63); g.lineTo(w * 0.42, h * 0.9); g.stroke();
    g.beginPath(); g.moveTo(w * 0.26, h * 0.74); g.lineTo(w * 0.58, h * 0.74); g.stroke();
    g.fillStyle = 'rgba(233,190,0,0.85)';
    g.beginPath(); g.ellipse(w * 0.7, h * 0.58, w * 0.06, h * 0.08, 0.3, 0, Math.PI * 2); g.fill();
    return cv.toDataURL('image/png');
}

// 숲: 초록~청록. 자동 색이 노을과 전혀 다른 색을 뽑는 걸 견줄 장면
function photoForest(cv, g, w, h) {
    const air = g.createLinearGradient(0, 0, 0, h);
    [[0, '#9FD6C2'], [0.45, '#3E8E77'], [1, '#14382F']].forEach(([o, c]) => air.addColorStop(o, c));
    g.fillStyle = air; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,252,225,0.28)';         // 빗살 빛
    for (let k = 0; k < 5; k++) {
        g.beginPath(); g.moveTo(w * (0.1 + k * 0.18), 0); g.lineTo(w * (0.2 + k * 0.18), 0);
        g.lineTo(w * (0.02 + k * 0.18), h); g.lineTo(w * (-0.06 + k * 0.18), h); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(10,32,26,0.72)';            // 나무 줄기 셋
    for (const x of [0.18, 0.52, 0.83]) g.fillRect(w * x, h * 0.1, w * 0.045, h);
    g.fillStyle = 'rgba(8,26,22,0.85)';
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.84); g.lineTo(w * 0.5, h * 0.78);
    g.lineTo(w, h * 0.86); g.lineTo(w, h); g.closePath(); g.fill();
    return cv.toDataURL('image/png');
}

let cutSrc = '';
// 투명 PNG 컷 표본: 가장자리를 비워 두면 assets.js 가 테두리 알파를 세어 .salty-cutout 을 붙인다
// (배치 칸에서 지운 안내문 자리 — 자르지 않고 아래만 녹는 그 처리를 글 대신 그림이 보여 준다).
// 48칸 격자의 가장자리 192칸 중 156칸이 비어 판정 기준(25%)을 한참 넘는다
function sampleCut() {
    if (cutSrc) return cutSrc;
    const w = 240, h = 260;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const body = g.createLinearGradient(0, 0, 0, h);
    [[0, '#3C6C93'], [0.55, '#8E7AA8'], [1, '#D9863F']].forEach(([o, c]) => body.addColorStop(o, c));
    g.fillStyle = body;
    g.beginPath();                                  // 어깨에서 아래로 퍼지는 실루엣 — 위 · 좌우는 투명하게 남는다
    g.moveTo(w * 0.5, h * 0.34);
    g.bezierCurveTo(w * 0.86, h * 0.46, w * 0.92, h * 0.8, w * 0.88, h);
    g.lineTo(w * 0.12, h);
    g.bezierCurveTo(w * 0.08, h * 0.8, w * 0.14, h * 0.46, w * 0.5, h * 0.34);
    g.closePath(); g.fill();
    g.beginPath(); g.ellipse(w * 0.5, h * 0.23, w * 0.18, h * 0.145, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,238,214,0.92)';         // 얼굴 — 사람 모양으로 읽히게
    g.beginPath(); g.ellipse(w * 0.5, h * 0.25, w * 0.125, h * 0.1, 0, 0, Math.PI * 2); g.fill();
    cutSrc = cv.toDataURL('image/png');
    return cutSrc;
}

// 지금 채팅에 있는 아바타를 빌려 온다 (미리보기에 내 캐릭터가 나온다).
// 없으면 빈 div 그대로 두고 보정 CSS 가 팔레트색 동그라미로 칠한다 (모서리는 실리태번 설정이 정함)
function prevFaces(stage) {
    for (const mes of stage.querySelectorAll('.mes')) {
        const mine = mes.getAttribute('is_user') === 'true';
        const src = document.querySelector(`#chat .mes${mine ? '[is_user="true"]' : ':not([is_user="true"])'} .avatar img`)?.src;
        const box = mes.querySelector('.avatar');
        const had = box.querySelector('img');
        if (!src) {
            had?.remove();
            continue;
        }
        if (had) {
            if (had.src !== src) had.src = src; // 캐릭터를 바꾼 뒤 다시 그릴 때
            continue;
        }
        const img = document.createElement('img');
        img.alt = '';
        img.src = src;
        box.append(img);
    }
}

// 무대는 판마다 한 번만 만들어 자리에 다시 꽂는다. 다시 그릴 때마다 새로 만들면 <img> 가 다시 실리는 동안
// .salty-asset · --salty-imin 이 한 프레임 사라져 모양 · 흐림이 벗겨졌다 입혀진다 (고르기 단추를 톡톡 누를 때 깜빡임).
// 소분류 · 비율 유지/높이 맞춤은 마크업을 다시 만들지 않고 속성으로만 옮겨 담는다
function fillPreviews(root) {
    root._pv ??= {};
    for (const box of root.querySelectorAll('.salty-prevbox[data-pv]')) {
        const kinds = box.dataset.pv === 'regex' ? ['regex'] : box.dataset.pv !== 'img' ? ['chat'] : [box.dataset.kind || 'photo'];
        for (const kind of kinds) {
            let stage = root._pv[kind];
            if (!stage) {
                const holder = document.createElement('div');
                holder.innerHTML = kind === 'chat' ? chatStage() : kind === 'regex' ? regexStage() : imgStage(kind);
                stage = root._pv[kind] = holder.firstElementChild;
            }
            // 표본 고르기가 바뀌면 그림만 갈아 끼운다 (무대는 그대로 — 깜빡임 없음).
            // 같은 값을 넣으면 브라우저가 다시 불러오지 않는다
            const img = stage.querySelector('img.custom-cac-img');
            if (img) {
                const want = kind === 'cut' ? sampleCut() : samplePhoto();
                if (img.getAttribute('src') !== want) img.src = want;
            }
            if (box.dataset.sub) stage.dataset.sub = box.dataset.sub;
            if (box.dataset.fit) stage.dataset.fit = box.dataset.fit;
            box.append(stage);
            // .salty-asset · .salty-cutout · --salty-ar/iw/ih/imin 은 실제 채팅과 같은 코드가 붙인다.
            // 떨어졌다 다시 붙은 무대는 ResizeObserver 가 스스로 빠져 있으니 꽂을 때마다 한 번 더 부름
            if (kind === 'chat') prevFaces(stage);
            else if (kind !== 'regex') classifyAll(stage);
        }
    }
}

// ───────── 글꼴 ─────────
const sizeBadge = f => f.size >= 1000 ? `${(f.size / 1000).toFixed(1)}MB` : (f.size ? `${f.size}KB` : '');

function fontRow(slot, lang, set) {
    const id = set[lang];
    const auto = lang !== 'ko' && (!id || id === 'auto');
    const font = auto ? null : findFont(id);
    if (font) queuePreview(font);
    const open = ui.picker?.slot === slot && ui.picker?.lang === lang;
    const label = LANGS.find(([l]) => l === lang)[1];
    const name = auto ? '<span class="auto">한국어 글꼴 따라감</span>' : (font ? esc(font.label) : '<span class="auto">없음</span>');
    return `<button class="salty-fontrow ${open ? 'open' : ''}" data-act="picker" data-slot="${slot}" data-lang="${lang}">
        <small>${label}</small><strong style="font-family:${font ? esc(previewStack(font, lang)) : 'inherit'}">${name}</strong></button>
        ${open ? fontList(slot, lang, set) : ''}`;
}

const BLANK_BADGE = '<em class="salty-blank">이 기기에서 안 그려짐</em>';
// 표본 줄은 글꼴을 다 받을 때까지 기기 글꼴로 그린다 (받는 몇 초 동안 줄이 비어 보이던 것). fonts.js settlePreview 가
// 받았다고(salty:font-ready) 알리면 data-font 에 적어 둔 진짜 묶음으로 바꾸고, 안 그려진다고(salty:font-blank) 알리면 표시를 붙인다.
// 다시 그릴 때는 fontItem 이 isPreviewReady · isPreviewBlank 로 같은 상태를 바로 그린다
const itemsFor = id => [...panels].flatMap(root => [...root.querySelectorAll(`.salty-fontitem[data-id="${CSS.escape(String(id))}"]`)]);
document.addEventListener('salty:font-ready', (e) => {
    for (const item of itemsFor(e.detail)) {
        const sample = item.querySelector('.salty-fontinfo small');
        if (sample?.dataset.font) sample.style.fontFamily = sample.dataset.font;
    }
});
document.addEventListener('salty:font-blank', (e) => {
    for (const item of itemsFor(e.detail)) {
        if (item.classList.contains('blank')) continue;
        item.classList.add('blank');
        item.querySelector('.salty-fontinfo b')?.insertAdjacentHTML('beforeend', BLANK_BADGE);
        const sample = item.querySelector('.salty-fontinfo small');
        if (sample) sample.style.fontFamily = 'inherit';
    }
});

function fontItem(f, lang, current) {
    const on = current === f.id;
    const blank = isPreviewBlank(f.id);
    const stack = esc(previewStack(f, f.lang || lang));
    const family = blank ? 'inherit' : (isPreviewReady(f.id) || f.group === 'custom' ? stack : 'inherit');
    return `<button class="salty-fontitem ${on ? 'on' : ''}${blank ? ' blank' : ''}" data-act="font" data-id="${esc(f.id)}" data-preview="${esc(f.id)}">
        <span class="salty-fontinfo"><b>${esc(f.label)}${f.native ? ` <i>${esc(f.native)}</i>` : ''}${f.size ? `<em>${sizeBadge(f)}</em>` : ''}${f.single ? '<em>굵기 하나</em>' : ''}${blank ? BLANK_BADGE : ''}</b>
        <small data-font="${stack}" style="font-family:${family}">${esc(SAMPLES[f.lang || lang] || SAMPLES.ko)}</small></span>
        ${on ? `<span class="salty-check-ic">${CHECK}</span>` : ''}
        ${f.group === 'custom' ? `<span class="salty-x" data-act="rmfont" data-id="${esc(f.id)}" title="목록에서 지우기">✕</span>` : ''}
    </button>`;
}

// 글꼴 목록을 열 때 처음 태그: 지금 글꼴의 묶음 (따라감이면 고딕)
function defaultTag(lang, id) {
    const group = (id && id !== 'auto' && findFont(id)?.group) || 'sans';
    return fontsFor(lang).some(f => f.group === group) ? group : 'all';
}

function fontList(slot, lang, set) {
    const current = set[lang];
    const fonts = fontsFor(lang);
    const present = GROUPS.map(([group, label]) => [group, label, fonts.filter(f => f.group === group)]).filter(([, , list]) => list.length);
    if (ui.fontTag !== 'all' && !present.some(([group]) => group === ui.fontTag)) ui.fontTag = 'all'; // 내 글꼴을 다 지운 경우 등
    const groups = present.map(([group, label, list]) =>
        `<div class="salty-fontgroup" data-group="${group}"><h5>${label} <span>${list.length}</span></h5>${list.map(f => fontItem(f, lang, current)).join('')}</div>`).join('');
    const tags = [['all', '전체', present.reduce((n, [, , list]) => n + list.length, 0)], ...present.map(([group, label, list]) => [group, label, list.length])]
        .map(([id, label, n]) => `<button data-act="fonttag" data-tag="${id}" class="${ui.fontTag === id ? 'on' : ''}">${label}<span>${n}</span></button>`).join('');
    const auto = lang !== 'ko'
        ? `<button class="salty-fontitem ${!current || current === 'auto' ? 'on' : ''}" data-act="font" data-id="auto">
            <span class="salty-fontinfo"><b>한국어 글꼴 따라감</b><small>따로 고르지 않고 한국어 글꼴에 든 ${LANGS.find(([l]) => l === lang)[1]} 글자를 씀</small></span>
            ${!current || current === 'auto' ? `<span class="salty-check-ic">${CHECK}</span>` : ''}</button>`
        : '';
    return `<div class="salty-fontlist" data-slot="${slot}" data-lang="${lang}">
        <div class="salty-fonthead">
            <div class="salty-fontsearch"><input type="search" placeholder="글꼴 이름 찾기" data-search="font" value="${esc(ui.query)}" autocomplete="off"></div>
            <div class="salty-fonttags">${tags}</div>
        </div>
        <div class="salty-fontscroll">${auto}${groups}
        <p class="salty-fontempty" hidden><span>그런 이름의 글꼴이 없어요</span><button data-act="fonttag" data-tag="all" hidden>전체<span></span></button></p></div>
        <div class="salty-fontadd">
            <button class="salty-btn" data-act="add-google">+ 구글 폰트</button>
            <button class="salty-btn" data-act="add-file">+ 글꼴 파일</button>
            <button class="salty-btn" data-act="add-css">+ CSS 링크</button>
            <input type="file" accept=".woff2,.woff,.ttf,.otf" hidden data-file="font">
        </div></div>`;
}

// 글꼴 칸 (역할 화면의 한 묶음): 언어별 글꼴 줄 — 본문 말고는 '본문 글꼴과 같게' 스위치가 먼저 (2.7.0 부터 글자 탭 안)
function fontBlock(s, slot) {
    if (!FONT_SLOTS.includes(slot)) slot = 'text';
    const own = slot === 'text' || isSet(s.fonts[slot]);
    const set = own ? s.fonts[slot] : null;
    const rows = own ? `<div class="salty-fontrows">${LANGS.map(([lang]) => fontRow(slot, lang, set)).join('')}</div>` : '';
    if (slot === 'text') {
        return `${rows}
            <div class="salty-group">
                ${stack('한자(漢字)는', seg('fonts.hanja', [['auto', '자동'], ['ko', '한국어'], ['ja', '일본어'], ['zh', '중국어']]), '자동: 중국어 → 일본어 → 한국어 글꼴 순으로 있는 것')}
            </div>
            <p class="salty-note">영어·일본어·중국어 글꼴을 따로 고르면 그 글자만 그 글꼴로 바뀌고, 나머지는 한국어 글꼴이 맡아요.</p>`;
    }
    return `<div class="salty-group">${row('본문 글꼴과 같게', toggle(`fonts.${slot}.same`, !own))}</div>
        ${rows}`;
}

// ───────── 테마 ─────────
function tabTheme(s, sub) {
    if (sub === 'custom') return customBuilder(s);
    if (sub === 'backup') return tabBackup();
    if (sub === 'colors') {
        const colors = TOKEN_GROUPS.map(([label, list]) =>
            `${cap(label)}<div class="salty-group">${list.map(([key, name]) => color(key, name)).join('')}</div>`).join('');
        return `${colors}
            <div class="salty-btns"><button class="salty-btn" data-act="reset-colors">${esc(PALETTES[s.palette]?.label || '이 테마')} 색 처음으로</button></div>
            <p class="salty-note">색은 테마마다 따로 저장돼요.</p>`;
    }
    const mode = PALETTES[s.palette]?.mode || 'light';
    const selected = paletteFamily(s.palette);
    const renderCard = (family, data) => {
        const id = paletteVariant(family, mode), p = PALETTES[id];
        const c = { ...p, ...(s.colorOverrides?.[id] || {}) };
        const v = k => safeColor(c[k]);
        const label = family === 'custom' ? s.customName || data.label : data.label;
        return `<button type="button" class="salty-pal ${selected === family ? 'on' : ''}" data-act="palette" data-family="${family}" aria-pressed="${selected === family}"
            style="--pal-bg:${v('bg')};--pal-surface:${v('surface')};--pal-raised:${v('raised')};--pal-text:${v('text')};--pal-muted:${v('muted')};--pal-accent:${v('accent')};--pal-marker:${v('marker')};--pal-gold:${v('gold')};--pal-strong:${v('strong')};--pal-pop:${safeColor(c.pop || c.accent)};--pal-marker-ink:${c.markerInk ? safeColor(c.markerInk) : 'inherit'};--pal-mark-top:${c.markerInk ? '8%' : '55%'}">
            <span class="salty-pal-page"><span><b>${esc(data.sample)}</b><br><mark>「에이드」</mark></span><i></i></span>
            <b>${esc(label)}</b><small>${family === 'custom' ? '내가 만든 레시피' : esc(p.desc)}</small></button>`;
    };
    const cards = Object.entries(PALETTE_FAMILIES).filter(([family]) => family !== 'custom').map(([family, data]) => renderCard(family, data)).join('');
    const hasCustom = Boolean(s.customName || s.colorOverrides?.['custom-light'] || s.colorOverrides?.['custom-night']);
    const custom = hasCustom ? `<div class="salty-custom-card">${renderCard('custom', PALETTE_FAMILIES.custom)}<button type="button" class="salty-custom-edit" data-act="custom-open" aria-label="커스텀 에이드 편집"><i class="fa-solid fa-pen" aria-hidden="true"></i></button></div>`
        : '<button type="button" class="salty-pal salty-pal-create" data-act="custom-open"><span class="salty-create-icon" aria-hidden="true">+</span><b>커스텀 에이드 만들기</b><small>나만의 색을 섞어 보세요</small></button>';
    return `<div class="salty-palette-toolbar"><span>${mode === 'light' ? '화이트' : '나이트'}${s.palette === 'night' ? ' · 블루 아워' : ''}</span><div class="salty-mode-switch" role="group" aria-label="테마 밝기">${['light', 'dark'].map(kind => `<button type="button" data-act="palette-mode" data-mode="${kind}" aria-label="${kind === 'light' ? '화이트' : '나이트'} 모드" title="${kind === 'light' ? '화이트' : '나이트'}" aria-pressed="${mode === kind}"><i class="fa-regular fa-${kind === 'light' ? 'sun' : 'moon'}" aria-hidden="true"></i></button>`).join('')}</div></div><div class="salty-palettes">${cards}${custom}</div>`;

}

function tabBackup() {
    return `<div class="salty-group">
            ${row('설정 파일', '<span class="salty-btns"><button class="salty-btn" data-act="export">내보내기</button><button class="salty-btn" data-act="import">가져오기</button></span>')}
            ${row('처음 설정으로', '<button class="salty-btn salty-btn-danger" data-act="reset">되돌리기</button>', '내 글꼴 목록은 남아요')}
        </div>
        <input type="file" accept=".json" hidden data-file="settings">`;
}

// ───────── 글자 ─────────
function tabText(s, sub) {
    let body = '';
    if (sub === 'para') {
        body = `<div class="salty-group">
                ${stack('정렬', seg('type.align', [['left', '왼쪽'], ['justify-word', '양쪽'], ['justify-break', '양쪽(끊어서)']], s.type.justify ? 'justify-word' : 'left'), '양쪽(끊어서): 낱말이 잘려도 빈틈 없이')}
                ${row('첫 줄 들여쓰기', toggle('type.indent', s.type.indent))}
            </div>
            <div class="salty-group">
                ${slider('type.para', '문단 사이', 0, 2, 0.01)}
                ${slider('type.gutter', '좌우 여백', 8, 40, 1)}
                ${slider('type.measure', 'PC에서 본문 최대 폭', 480, 1000, 1)}
            </div>`;
    } else if (sub === 'shadow') {
        // 글자 그림자 — 어디에(본문 · 대사 · 속마음 · 강조 · 코드) + 각도(0 = 오른쪽, 시계 방향) · 거리 · 퍼짐 · 색 · 투명도. 폰의 번짐 방지 규칙을 고른 대상에서만 푼다
        const sh = s.shadow;
        body = `${cap('글자 그림자')}
            <div class="salty-group">
                ${row('그림자', toggle('shadow.on', sh.on), '글자 뒤에 그림자를 깔아요')}
                ${sh.on ? stack('어디에', chips([['shadow.targets.text', '본문'], ['shadow.targets.dialogue', '대사'], ['shadow.targets.em', '속마음'], ['shadow.targets.strong', '강조'], ['shadow.targets.code', '코드']]), '여러 개 골라도 돼요 · 본문은 글 전체') : ''}
                ${sh.on ? `<div class="salty-row"><span>색</span><input type="color" data-color-path="shadow.color" value="${esc(sh.color)}" aria-label="그림자 색"></div>` : ''}
                ${sh.on ? slider('shadow.alpha', '투명도', 0, 100, 1) : ''}
                ${sh.on ? slider('shadow.angle', '각도', 0, 360, 1) : ''}
                ${sh.on ? slider('shadow.distance', '거리', 0, 12, 0.5) : ''}
                ${sh.on ? slider('shadow.blur', '퍼짐', 0, 24, 0.5) : ''}
            </div>
            ${sh.on ? '<p class="salty-note">각도는 그림자가 지는 방향(0 = 오른쪽, 90 = 아래), 거리는 글자에서 얼마나 떨어질지예요. 폰에서 글자가 번져 보이면 퍼짐을 줄이거나 꺼 주세요.</p>' : ''}`;
    } else if (sub === 'dialogue') {
        // 대사: 표시 · 형광펜 모양 · 색 → 글자(크기 · 굵기 · 자간) → 글꼴. 2.7.0 부터 한 화면 (미리보기를 접을 수 있어 길어도 됨)
        const marker = s.dialogue.style === 'marker';
        const pen = marker || s.dialogue.style === 'full';
        body = `${cap('대사', '"…"')}
            <div class="salty-group">
                ${stack('표시', seg('dialogue.style', [['marker', '형광펜'], ['full', '전체 칠'], ['bold', '굵게'], ['tint', '색'], ['plain', '없음']]))}
                ${marker ? stack('형광펜 기울기', seg('dialogue.tilt', [['flat', '일직선'], ['slant', '대각선'], ['steep', '완전 대각선']])) : ''}
                ${marker ? stack('형광펜 위치', seg('dialogue.markerPos', [['center', '가운데'], ['bottom', '아래']], 'center'), '아래: 밑줄 긋듯 글자 아랫부분에') : ''}
                ${marker ? slider('dialogue.markerThick', '형광펜 굵기', ...TEXT_LIMIT.markerThick, 1, 54) : ''}
                ${pen ? color('marker', '형광펜 색') : ''}
                ${color('dialogue', '글자 색')}
            </div>
            ${roleType('대사', [sizeOpt('type.dialogueSize', '크기', '본문과 같게', ...TEXT_LIMIT.dialogueSize), slider('dialogue.weight', '굵기', 300, 800, 1), sizeOpt('dialogue.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('대사 글꼴')}${fontBlock(s, 'dialogue')}`;
    } else if (sub === 'ui') {
        body = `${roleType('메뉴', [sizeOpt('type.uiSize', '크기', '기본', ...TEXT_LIMIT.uiSize), sizeOpt('ui.weight', '굵기', '기본', 300, 800), sizeOpt('ui.letterSpacing', '자간', '기본', ...TEXT_LIMIT.letterSpacing)], '메뉴 · 단추 · 설정창 글자')}
            ${cap('메뉴 글꼴')}${fontBlock(s, 'ui')}`;
    } else if (sub === 'em') {
        body = `${cap('속마음', mdLabel('*기울임*'))}
            <div class="salty-group">
                ${row('기울여 쓰기', toggle('em.italic', s.em.italic), '끄면 바로 세워서 색으로만 구분')}
                ${color('em', '글자 색')}
            </div>
            ${roleType('속마음', [sizeOpt('em.size', '크기', '본문과 같게', ...TEXT_LIMIT.roleSize), slider('em.weight', '굵기', 300, 700, 1), sizeOpt('em.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('속마음 글꼴')}${fontBlock(s, 'em')}`;
    } else if (sub === 'strong') {
        body = `${cap('강조', mdLabel('**굵게**'))}
            <div class="salty-group">
                ${color('strong', '글자 색')}
            </div>
            ${roleType('강조', [sizeOpt('strong.size', '크기', '본문과 같게', ...TEXT_LIMIT.roleSize), slider('strong.weight', '굵기', 400, 900, 1), sizeOpt('strong.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('강조 글꼴')}${fontBlock(s, 'strong')}`;
    } else if (sub === 'code') {
        body = `${cap('코드', '\`코드\`')}
            ${roleType('코드', [sizeOpt('type.codeSize', '크기', '본문과 같게', ...TEXT_LIMIT.codeSize), sizeOpt('code.weight', '굵기', '본문과 같게', 300, 800), sizeOpt('code.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('코드 글꼴')}${fontBlock(s, 'code')}
            <p class="salty-note">기본은 도트 글꼴(Neo둥근모)이에요.</p>`;
    } else {
        // 본문: 크기 · 굵기 · 자간 · 줄 간격 → 글꼴 (예전 '크기' · '모양' 칸을 합침)
        body = `${roleType('본문', [slider('type.size', '크기', 12, 22, 1), slider('type.weight', '굵기', 300, 600, 1), slider('type.letterSpacing', '자간', -5, 8, 1), slider('type.lineHeight', '줄 간격', 1.4, 2.2, 0.01)])}
            ${cap('본문 글꼴')}${fontBlock(s, 'text')}`;
    }
    // 미리보기는 탭 맨 위에 붙어 있는 칸 안에 — 슬라이드바를 미는 동안 화면에 남게 (길면 꺾쇠로 접음). 메뉴 칸은 메뉴 글꼴 · 크기로 그린 미리보기
    return `${prevBox('', sub === 'ui' ? uiSample() : sample())}${body}`;
}

// 역할의 글자 값 묶음: 제목 + 크기 · 굵기 · 자간 (· 줄 간격) — 여섯 역할이 같은 모양이라 한눈에 견줄 수 있게
function roleType(label, controls, hint = '') {
    return `${cap(`${label} 글자`, hint)}<div class="salty-group salty-sizes">${controls.join('')}</div>`;
}

// ───────── 채팅 ─────────
function tabChat(s, sub) {
    if (sub === 'etc') {
        return `${regexPreview()}${cap('색 통일')}<div class="salty-group">
            ${row('정규식 카드', toggle('chat.unifyRegex', s.chat.unifyRegex), '상태창 · 씬플랜 같은 카드의 모듈별 색을 포인트색 하나로')}
            ${row('본문 색 지정', toggle('chat.unifyInline', s.chat.unifyInline), '메시지에 적힌 글자색을 무시하고 테마 글자색으로')}
            ${s.chat.unifyInline ? '' : row('글자색 톤 맞추기', toggle('chat.toneInline', s.chat.toneInline), '색은 그대로 두고 채도 · 밝기만 테마에 맞춤 — 퍼스널 컬러가 들쭉날쭉할 때')}
        </div>
        ${!s.chat.unifyInline && s.chat.toneInline ? `${cap('톤 값', PALETTES[s.palette]?.mode === 'dark' ? '지금은 나이트 값이 보여요' : '지금은 화이트 값이 보여요')}<div class="salty-group">
            ${slider('chat.tone.light.s', '화이트 채도', 0, 100, 1)}
            ${slider('chat.tone.light.l', '화이트 밝기', 10, 90, 1)}
            ${slider('chat.tone.dark.s', '나이트 채도', 0, 100, 1)}
            ${slider('chat.tone.dark.l', '나이트 밝기', 10, 90, 1)}
        </div>` : ''}
        ${cap('정규식 카드')}<div class="salty-group">
            ${row('이모티콘', toggle('chat.regexIcons', s.chat.regexIcons), '끄면 카드 제목 앞 그림 없이 글자만')}
        </div>`;
    }
    if (sub === 'screen') {
        return `${chatPreview()}<div class="salty-group">
            ${stack('아이콘', seg('chat.icons', [['line', '선 아이콘'], ['default', '기본']]))}
            ${row('배경 이미지 비치기', toggle('chat.bgImage', s.chat.bgImage), '끄면 깨끗한 종이색 바탕')}
            ${row('고르기 목록 팝업', toggle('chat.selectPop', s.chat.selectPop !== false), '모델 · 프리셋 같은 목록을 테마가 그린 팝업으로 (끄면 폰 기본 목록)')}
        </div>`;
    }
    const hideAvatars = document.getElementById('hideChatAvatarsEnabled')?.checked ?? false;
    return `${chatPreview()}<div class="salty-group">
        ${stack('내 메시지', seg('chat.user', [['bubble', '말풍선'], ['card', '카드'], ['table', '테이블'], ['plain', '글자만']]))}
        ${stack('이름 줄', seg('chat.header', [['full', '이름+시간'], ['name', '이름만'], ['none', '숨김']]))}
        ${row('아바타 숨기기 (권장)', toggle('st.hideAvatars', hideAvatars), '숨기면 이미지가 화면 끝까지 넓어져요')}
    </div>
    ${cap('내 메시지 글자', '100 = 캐릭터 글과 같게')}<div class="salty-group salty-sizes">
        ${slider('chat.userSize', '크기', 60, 140, 1, 100)}
        ${slider('chat.userInk', '진하기', 30, 100, 1, 100)}
    </div>`;
}

// 테두리가 지금 설정에서 실제로 보이는지 알려 준다.
// 흐림은 그림에 마스크를 씌우는데 마스크는 box-shadow 까지 지우고, 가로 꽉은 좌우가 화면 밖으로 나간다.
// 그래서 '가로 꽉 + 흐림' 조합에서는 네 변 모두 보이지 않는다 — 그걸 모르면 "적용이 안 된다" 로 보인다.
// 켠 면이 몇 개인지에 따라 한 줄 설명 — 두 면만 켜면 영화 같은 띠가 된다
function sideHint(s) {
    const on = ['Top', 'Bottom', 'Left', 'Right'].filter(f => s.image[`edgeSide${f}`]);
    if (!on.length) return '네 면 다 꺼서 테두리가 안 보여요';
    if (on.length === 4) return '';
    if (on.length === 2 && s.image.edgeSideTop && s.image.edgeSideBottom) return '위 · 아래만 — 영화 화면처럼 보여요';
    return '켠 면만 테두리가 나와요';
}

function edgeHint(s) {
    if (s.image.edge === 'none') return '';
    const bleed = s.image.layout === 'bleed';
    const faded = s.image.fade !== 'off';
    if (bleed && faded) return '지금은 <b>안 보여요</b> — 가로 꽉은 좌우가 화면 밖이고, 흐림이 위아래를 녹여요. 흐림을 끄거나 배치를 본문 폭으로 바꿔 주세요';
    if (bleed) return '가로 꽉이라 위 · 아래 테두리만 보여요';
    if (faded) return '흐림이 위아래를 녹이니 좌우 테두리가 보여요 (네 변 다 보려면 흐림 끔)';
    // 자동 색은 그림에서 뽑은 색을 쓰니 테마 색 설명이 맞지 않는다 — 켜져 있으면 마지막 줄을 바꿔 준다
    if (s.image.edgeAuto && s.image.edge !== 'none') return '자동 색: 그림 가장자리 색을 면마다 이어 써요';
    return '위는 하늘빛 · 아래는 레몬빛 (프리즘은 네 면이 네 색)';
}

// ───────── 이미지 ─────────
// 이미지 모양: [값, 이름, 작은 그림] — 그림은 currentColor 라 테마 색을 따라감
const SHAPES = [
    ['rect', '네모', '<svg viewBox="0 0 44 30" fill="currentColor" aria-hidden="true"><rect x="5" y="6" width="34" height="18" rx="2.5"/></svg>'],
    // 2.2.1: 대각선 · 코너 컷 · 스크래치는 뺌 (사용자: "네모랑 커스텀만 두자") — CSS · 저장 키는 남아 있고 예전 값은 settings.js 가 네모로 돌림
    ['custom', '커스텀', '<svg viewBox="0 0 44 30" fill="currentColor" aria-hidden="true"><path d="M22 4l4.6 8.4 9.4 1.6-6.6 6.9 1.4 9.4L22 26l-8.8 4.3 1.4-9.4L8 14l9.4-1.6Z"/></svg>'], // 내가 고른 투명 PNG 의 모양
];

/** 커스텀 도형 칸: 고른 도형 미리보기 + 이미지 고르기 · 지우기 + 맞추는 법 (투명 PNG 의 알파가 마스크) */
/** 저장된 도형 목록 최대 (도형 하나가 설정에 수십 KB 로 들어가므로) */
const MASK_SLOTS = 12;
/** '바꾸기'를 누른 뒤 파일을 고르면 이 칸의 그림을 갈아 끼운다 (파일 창이 닫히면 비움) */
let maskReplaceId = '';

function maskControls(s) {
    const { mask, maskId, masks } = s.image;
    const has = !!mask;
    const current = masks.find(item => item.id === maskId) || null;
    const thumb = (data, extra = '') => `<span class="salty-mask-thumb${extra}" style="--salty-img-mask:url(&quot;${data}&quot;)" aria-hidden="true"><i></i></span>`;
    const library = masks.length ? `<div class="salty-mask-lib" role="listbox" aria-label="저장한 도형">${masks.map(item =>
        `<button type="button" class="salty-mask-item${item.id === maskId ? ' on' : ''}" data-act="mask-use" data-id="${item.id}" aria-pressed="${item.id === maskId}">${thumb(item.data)}<small>${esc(item.name)}</small></button>`).join('')}</div>` : '';
    return `${library}
        <div class="salty-mask-row">
            <div class="salty-mask-thumb" aria-hidden="true">${has ? '<i></i>' : ''}</div>
            <div class="salty-btns">
                <button class="salty-btn" data-act="mask-pick">${has ? '다른 이미지 고르기' : '이미지 고르기'}</button>
                ${has && !current ? `<button class="salty-btn" data-act="mask-save">저장</button>` : ''}
                ${current ? `<button class="salty-btn" data-act="mask-replace" data-id="${current.id}">바꾸기</button><button class="salty-btn salty-btn-danger" data-act="mask-delete" data-id="${current.id}">삭제</button>` : ''}
                ${has && !current ? '<button class="salty-btn" data-act="mask-clear">지우기</button>' : ''}
            </div>
        </div>
        <input type="file" accept="image/*" hidden data-file="mask">
        ${has ? stack('맞추는 법', seg('image.maskFit', [['stretch', '늘리기'], ['contain', '맞추기']]), '늘리기: 도형을 그림 상자에 가득 · 맞추기: 도형 비율 그대로 가운데') : ''}
        <p class="salty-note">배경이 투명한 PNG 의 <b>불투명한 부분</b>만 그림이 보여요. 폰에서는 갤러리에서 바로 고를 수 있어요. 512px 로 줄여 설정에 저장돼요.${has && !current ? ' <b>저장</b>을 누르면 목록에 커스텀 1 · 2 … 로 남아 나중에 골라 쓸 수 있어요.' : ''}</p>`;
}

/** 새 칸 이름: 커스텀 1, 2 … (지운 번호는 안 다시 씀) */
function nextMaskName(masks) {
    const used = masks.map(item => Number((/^커스텀 (\d+)$/.exec(item.name) || [])[1]) || 0);
    return `커스텀 ${Math.max(0, ...used) + 1}`;
}
// 흐림 단계: 강함이면 네 가장자리가 바탕에 녹아듦
const FADES = [['off', '끔'], ['soft', '약함'], ['medium', '중간'], ['strong', '강함']];

function shapePicker(current) {
    return `<div class="salty-shapes">${SHAPES.map(([value, label, svg]) =>
        `<button type="button" aria-pressed="${current === value}" data-act="seg" data-path="image.shape" data-value="${value}" class="${current === value ? 'on' : ''}">${svg}<span>${label}</span></button>`).join('')}</div>`;
}

/**
 * 고른 도형 이미지 → 설정에 넣을 PNG data URL. 긴 변 512px 로 줄여 설정 파일이 무거워지지 않게 (마스크는 알파만 쓰니 충분).
 * 투명한 곳이 하나도 없으면(JPG 등) 오려질 데가 없어 알려 준다.
 */
async function readMaskImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('이미지 파일이 아니에요');
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
            image.src = url;
        });
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const g = canvas.getContext('2d');
        g.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
        let clear = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] < 128) clear++;
        if (clear === 0) throw new Error('투명한 부분이 없는 그림이에요. 배경이 투명한 PNG 를 골라 주세요');
        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(url);
    }
}

function tabImage(s, sub) {
    const light = PALETTES[s.palette]?.mode === 'light';
    const { layout, shape, fit } = s.image;
    // 모서리는 둥근 모서리가 보일 때만: 네모 · 아치 아래쪽 (가로 꽉이면 화면 끝까지라 모서리가 없음)
    const rounds = layout !== 'bleed' && shape === 'rect';
    if (sub === 'shape') {
        // 테두리는 네모 · 아치에만 (대각선 · 스크래치는 잘린 모양이라 사각 테가 남음)
        // 자동 색은 테두리를 켰을 때만 보여 준다 — '없음'에서는 뽑을 색이 쓰일 데가 없다 (apply.js 도 그때만 salty-edge-auto 를 붙임)
        const edges = shape === 'rect';
        return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${shapePicker(shape)}</div>
            ${shape === 'custom' ? maskControls(s) : ''}
            ${row('투명 그림도 똑같이', toggle('image.cutoutSame', s.image.cutoutSame), s.image.cutoutSame ? '배경 없는 캐릭터 컷에도 모양 · 흐림 · 테두리가 그대로 걸려요' : '캐릭터 컷은 자르지 않고 아래만 살짝 흐려요')}
            ${rounds ? slider('image.radius', '모서리', 0, 24, 1) : ''}
            ${edges ? stack('테두리', seg('image.edge', [['none', '없음'], ['line', '선'], ['inset', '안쪽'], ['glow', '빛'], ['prism', '프리즘']]), edgeHint(s)) : ''}
            ${edges && s.image.edge !== 'none' ? row('자동 색', toggle('image.edgeAuto', s.image.edgeAuto), '그림 가장자리에서 색을 뽑아 써요') : ''}
            ${edges && s.image.edge !== 'none' ? stack('테두리 면', chips([['image.edgeSideTop', '위'], ['image.edgeSideBottom', '아래'], ['image.edgeSideLeft', '왼쪽'], ['image.edgeSideRight', '오른쪽']]), sideHint(s)) : ''}
            ${edges && s.image.edge !== 'none' ? slider('image.edgeThick', '두께', ...IMAGE_RANGE.edgeThick, 1) : ''}
            ${edges && s.image.edge !== 'none' ? slider('image.edgeAlpha', '진하기', ...IMAGE_RANGE.edgeAlpha, 1) : ''}
            ${edges && (s.image.edge === 'glow' || s.image.edge === 'prism' || s.image.edge === 'inset') ? slider('image.edgeGlow', '번짐', ...IMAGE_RANGE.edgeGlow, 1) : ''}
        </div>`;
    }
    if (sub === 'size') {
        // 비율 유지 = 최대 높이(더 짧은 그림은 그대로) · 높이 맞춤 = 모든 그림을 이 높이로 (둘 다 화면 높이 %, 범위는 settings.js IMAGE_RANGE)
        return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${seg('image.fit', [['ratio', '비율 유지'], ['fixed', '높이 맞춤']])}</div>
            ${fit === 'fixed' ? slider('image.height', '높이', ...IMAGE_RANGE.height, 1) : slider('image.maxh', '최대 높이', ...IMAGE_RANGE.maxh, 1)}
        </div>`;
    }
    if (sub === 'fade') {
        return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${seg('image.fade', FADES)}</div>
            ${s.image.fade !== 'off' ? slider('image.fadeY', '위아래', ...IMAGE_RANGE.fadeY, 1) : ''}
            ${s.image.fade !== 'off' ? slider('image.fadeX', '옆', ...IMAGE_RANGE.fadeX, 1) : ''}
            ${row('흰 배경 지우기', toggle('image.blendWhite', s.image.blendWhite), light ? '흰 배경이 종이색에 녹아들어요' : '밝은 테마에서만 돼요')}
        </div>`;
    }
    return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${seg('image.layout', [['bleed', '가로 꽉'], ['column', '본문 폭'], ['inset', '작게']])}</div>
        </div>`;
}

// ───────── 그리기 ─────────
function render(root) {
    const s = getSettings();
    const issues = getIssues();
    root._issues = issues;
    const body = { theme: tabTheme, text: tabText, chat: tabChat, image: tabImage };
    if (!body[ui.tab]) ui.tab = 'theme';
    const sub = subOf(ui.tab);
    // 2.4.1: 대분류는 위 가로 탭 그대로, 소분류는 칩 줄 대신 드롭다운 하나 — 폰에서는 실리태번 모델 고르기처럼 팝업 목록으로 뜬다
    // 2.4.2: OS 가 그리는 select 팝업은 못 꾸미므로 목록을 직접 그린다 — 단추 밑에 카드로 펼쳐지는 라디오 목록 (테마 색 · 글꼴)
    const subList = SUBS[ui.tab] || [];
    const subNow = ui.tab === 'theme' && sub === 'custom' ? 'palette' : sub;
    const subLabel = subList.find(([id]) => id === subNow)?.[1] ?? '';
    const subSelect = subList.length ? `<div class="salty-subsel${ui.subOpen ? ' open' : ''}">
            <button type="button" data-act="sub-open" aria-haspopup="listbox" aria-expanded="${ui.subOpen}"><span>${subLabel}</span><i aria-hidden="true"></i></button>
            ${ui.subOpen ? `<div class="salty-pick" role="listbox" aria-label="세부 항목">${subList.map(([id, label]) =>
        `<button type="button" role="option" data-act="sub-pick" data-sub="${id}" aria-selected="${subNow === id}" class="${subNow === id ? 'on' : ''}"><span>${label}</span><i aria-hidden="true"></i></button>`).join('')}</div>` : ''}
        </div>` : '';
    // 서랍은 실리태번 머리에 이미 'Blue Lemonade' 가 있어서 켜기 한 줄만 (팝업은 머리가 없으니 제목을 그림)
    const head = root.classList.contains('in-popup')
        ? `<div class="salty-head">
            <div class="salty-mark">${MARK}</div>
            <div><div class="salty-title">Blue Lemonade</div><div class="salty-sub">읽기 편한 테마</div></div>
            <label class="salty-switch" title="테마 켜기"><input type="checkbox" data-toggle="enabled" ${s.enabled ? 'checked' : ''}><span></span></label>
        </div>`
        : `<div class="salty-head salty-head-slim"><span>테마 켜기</span>${toggle('enabled', s.enabled)}</div>`;
    root.innerHTML = `
        ${head}
        <div class="salty-checks">${issues.map((issue, i) =>
            `<div class="salty-check"><span>${issue.text}</span>${issue.fix ? `<button class="salty-btn" data-act="fix" data-i="${i}">${issue.fix}</button>` : ''}</div>`).join('')}</div>
        <div class="salty-nav">
            <div class="salty-tabs">${TABS.map(([id, label]) =>
        `<button data-act="tab" data-tab="${id}" class="${ui.tab === id ? 'on' : ''}" aria-pressed="${ui.tab === id}">${label}</button>`).join('')}</div>
            ${subSelect}
        </div>
        <section class="salty-sec" data-tab="${ui.tab}" data-sub="${sub}">${body[ui.tab](s, sub)}</section>`;
    bindCustomBuilder(root);
    fillPreviews(root); // 미리보기 무대 다시 꽂기 (만들지 않고 옮겨 담기만)
    syncSamples(s); // 미리보기 문단 클래스 맞추기

    // 색 고르기: 처음 그릴 때 나는 change 는 무시하고, 사용자가 만진 뒤부터 저장
    root.querySelectorAll('toolcool-color-picker[data-token]').forEach((picker) => {
        const arm = () => { picker._armed = true; };
        picker.addEventListener('pointerdown', arm);
        picker.addEventListener('keydown', arm);
        picker.addEventListener('change', (event) => {
            if (!picker._armed) return;
            const value = event.detail?.rgba || picker.color;
            if (!value) return;
            picker.closest('.salty-color')?.classList.toggle('clear', parseColor(value)[3] < 0.1);
            update((st) => {
                const token = picker.dataset.token;
                if (sameColor(value, paletteColors(st)[token])) return;
                st.colorOverrides[st.palette] = { ...(st.colorOverrides[st.palette] || {}), [token]: value };
            }, false);
        });
    });

    // 글꼴 묶음 태그 줄: 밀면 끝 흐림, 고른 칩은 보이게 (팝업·접힌 서랍은 화면에 붙기 전에 그려지니 폭이 생길 때 다시)
    //   소분류 칩은 줄이 넘치면 다음 줄로 내려가니 여기 없음
    root._rowsRO?.disconnect();
    root._rowsRO = new ResizeObserver(entries => entries.forEach(e => showTag(e.target)));
    root.querySelectorAll('.salty-fonttags').forEach((chips) => {
        chips.addEventListener('scroll', () => fadeTags(chips), { passive: true });
        root._rowsRO.observe(chips);
    });

    // 탭 줄 높이를 변수로 내보냄: 글꼴 찾기 줄이 탭 줄 바로 아래에 붙어야 겹치지 않음
    // (소분류 칩이 두 줄로 내려가면 높이가 달라지니 지켜봄)
    const nav = root.querySelector('.salty-nav');
    root._navRO?.disconnect();
    if (nav) {
        const setNavH = () => root.style.setProperty('--salty-navh', `${Math.round(nav.getBoundingClientRect().height)}px`);
        setNavH();
        root._navRO = new ResizeObserver(setNavH);
        root._navRO.observe(nav);
    }

    // 글꼴 목록: 보이는 항목의 미리보기만 불러오기
    const list = root.querySelector('.salty-fontscroll');
    if (list) {
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (!e.isIntersecting) continue;
                queuePreview(findFont(e.target.dataset.preview));
                io.unobserve(e.target);
            }
        }, { root: list, rootMargin: '120px 0px' });
        list.querySelectorAll('[data-preview]').forEach(el => io.observe(el));
        filterFonts(root);
    }
}

// 검색어 + 태그로 거르기. 태그 숫자는 검색어에 맞는 개수, 한 묶음만 볼 땐 묶음 제목 숨김
function filterFonts(root) {
    const list = root.querySelector('.salty-fontlist');
    if (!list) return;
    const q = ui.query.trim().toLowerCase();
    const one = ui.fontTag !== 'all';
    const counts = { all: 0 };
    let shown = 0;
    list.querySelectorAll('.salty-fontgroup').forEach((group) => {
        let n = 0;
        group.querySelectorAll('.salty-fontitem').forEach((item) => {
            const hit = !q || item.querySelector('b').textContent.toLowerCase().includes(q);
            item.hidden = !hit;
            if (hit) n++;
        });
        group.querySelector('h5 span').textContent = n;
        counts[group.dataset.group] = n;
        counts.all += n;
        group.hidden = !n || (one && group.dataset.group !== ui.fontTag);
        if (!group.hidden) shown += n;
    });
    list.classList.toggle('one', one);
    list.querySelectorAll('.salty-fonttags [data-act="fonttag"]').forEach((tag) => {
        const n = counts[tag.dataset.tag] || 0;
        tag.classList.toggle('on', tag.dataset.tag === ui.fontTag);
        tag.classList.toggle('none', !n);
        tag.lastElementChild.textContent = n;
    });
    // 빈 목록: 다른 묶음에만 맞으면 그렇다고 하고 전체로 가는 태그
    const empty = list.querySelector('.salty-fontempty');
    if (empty) {
        const elsewhere = !shown && counts.all > 0;
        empty.hidden = shown > 0;
        empty.firstElementChild.textContent = elsewhere ? '이 묶음엔 없어요' : '그런 이름의 글꼴이 없어요';
        empty.lastElementChild.hidden = !elsewhere;
        empty.lastElementChild.lastElementChild.textContent = counts.all;
    }
    const tags = list.querySelector('.salty-fonttags');
    if (tags) showTag(tags);
}

// 칩 줄 양 끝 흐림: 더 밀 수 있는 쪽만, 남은 거리만큼 (최대 FADE). 넘치지 않으면 흐림 자체를 끔
const FADE = 28;
function fadeTags(row) {
    const rest = row.scrollWidth - row.clientWidth - row.scrollLeft;
    row.classList.toggle('over', row.scrollWidth > row.clientWidth + 1);
    row.style.setProperty('--salty-fade-l', `${Math.max(0, Math.min(FADE, row.scrollLeft))}px`);
    row.style.setProperty('--salty-fade-r', `${Math.max(0, Math.min(FADE, rest))}px`);
}

// 고른 칩이 줄 밖이나 흐린 끝에 있으면 보이게 (아직 폭이 0이면 건너뜀 → ResizeObserver 가 다시 부름)
function showTag(row) {
    if (!row.clientWidth) return;
    const on = row.querySelector('.on');
    if (on) row.scrollLeft = Math.min(Math.max(row.scrollLeft, on.offsetLeft + on.offsetWidth + FADE - row.clientWidth), on.offsetLeft - FADE);
    fadeTags(row);
}

// 글꼴 목록을 스크롤하는 칸. 목록은 이제 창과 같이 흐르므로(스크롤바 하나) 보통 바깥 칸이 나옴 —
// 예전처럼 안쪽에 스크롤이 생긴 경우(좁은 화면 등)에는 그 안쪽 칸을 그대로 씀
function fontBox(root) {
    const inner = root.querySelector('.salty-fontscroll');
    if (!inner) return null;
    if (inner.scrollHeight > inner.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(inner).overflowY)) return inner;
    return scrollBox(inner);
}

// 창을 담고 있는 스크롤 칸 (팝업 본문 · 확장 서랍)
function scrollBox(el) {
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
        if (box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY)) return box;
    }
    return null;
}

// 탭·칩을 누른 뒤: 새 묶음 첫 줄이 붙어 있는 탭 줄 바로 아래로 (위로만 끌어올림 — 이미 보이면 그대로)
function showSec(root) {
    const nav = root.querySelector('.salty-nav');
    const sec = root.querySelector('.salty-sec');
    const box = scrollBox(root);
    if (!nav || !sec || !box) return;
    const top = sec.getBoundingClientRect().top - box.getBoundingClientRect().top - nav.offsetHeight;
    if (top < 0) box.scrollTop += top;
}

// 태그·검색어만 바뀔 땐 다시 그리지 않고 열린 목록들만 거르기 (가로 스크롤·입력 중인 칸 그대로)
function syncFontLists() {
    for (const root of panels) {
        if (!root.isConnected) continue;
        const input = root.querySelector('input[data-search="font"]');
        if (input && input !== document.activeElement) input.value = ui.query;
        filterFonts(root);
        const box = fontBox(root);
        const inner = root.querySelector('.salty-fontscroll');
        if (box && box === inner) box.scrollTop = 0;
        else if (box) {
            // 바깥이 스크롤되는 경우 창 전체가 맨 위로 튀면 안 됨 → 목록 머리를 탭 줄 밑으로만
            const list = root.querySelector('.salty-fontlist');
            const navH = root.querySelector('.salty-nav')?.offsetHeight || 0;
            if (list) {
                const top = list.getBoundingClientRect().top - box.getBoundingClientRect().top - navH;
                if (top < 0) box.scrollTop += top;
            }
        }
    }
}

// 글꼴을 골라 창을 다시 그려도 목록 스크롤 자리는 그대로
function keepFontScroll(fn) {
    const tops = new Map([...panels].map(root => [root, [fontBox(root), fontBox(root)?.scrollTop || 0]]));
    fn();
    tops.forEach(([box, top]) => {
        if (box?.isConnected) box.scrollTop = top;
    });
}

// 고른 글꼴이 목록 가운데 보이게 (찾기를 풀어 목록이 다시 길어졌을 때)
function showPickedFont() {
    for (const root of panels) {
        const scroll = fontBox(root);
        const item = root.querySelector('.salty-fontitem.on');
        if (!item || !scroll?.clientHeight) continue;
        scroll.scrollTop += item.getBoundingClientRect().top - scroll.getBoundingClientRect().top - (scroll.clientHeight - item.offsetHeight) / 2;
    }
}

// ───────── 이벤트 ─────────
async function ask(message, value = '') {
    const ctx = SillyTavern.getContext();
    if (ctx.callGenericPopup && ctx.POPUP_TYPE) {
        const result = await ctx.callGenericPopup(message, ctx.POPUP_TYPE.INPUT, value);
        return typeof result === 'string' ? result : null;
    }
    return prompt(message, value);
}

function pickFont(font) {
    const { slot, lang } = ui.picker || { slot: 'text', lang: 'ko' };
    ui.fontTag = font.group || 'all'; // 새로 넣은 글꼴이 목록에 보이게
    ui.query = '';
    update((st) => {
        if (!isSet(st.fonts[slot])) st.fonts[slot] = { ...FONT_SET };
        st.fonts[slot][lang] = font.id;
    });
    toastr.success(`${font.label} 글꼴을 쓸게요`, 'Blue Lemonade');
}

// 소분류 목록 팝업: 목록 밖을 누르거나 Esc 를 누르면 닫힘 (문서 전체에 한 번만 걸어 둠 — 팝업 · 서랍 어디서 열렸든)
let subPickGuard = false;
function guardSubPick() {
    if (subPickGuard) return;
    subPickGuard = true;
    document.addEventListener('pointerdown', (event) => {
        if (!ui.subOpen || event.target.closest?.('.salty-subsel')) return;
        ui.subOpen = false;
        refreshPanels();
    }, true);
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !ui.subOpen) return;
        ui.subOpen = false;
        refreshPanels();
        event.stopPropagation();
    }, true);
}

function bind(root) {
    guardSubPick();
    root.addEventListener('click', async (event) => {
        const el = event.target.closest('[data-act]');
        if (!el || !root.contains(el)) return;
        event.preventDefault();
        event.stopPropagation();
        const { act } = el.dataset;
        try {
            switch (act) {
                case 'tab':
                    ui.tab = el.dataset.tab;
                    ui.picker = null;
                    ui.subOpen = false;
                    store('salty_tab', ui.tab);
                    refreshPanels();
                    showSec(root);
                    break;
                case 'pvfold': // 미리보기(예시) 접기 · 펴기 — 서랍 · 팝업 · 탭 모두 같이
                    ui.pvFold = !ui.pvFold;
                    store('salty_pvfold', ui.pvFold ? '1' : '0');
                    refreshPanels();
                    break;
                case 'sub-open': // 소분류 목록 열기/닫기 (바깥을 누르면 closeSubPick 이 닫음)
                    ui.subOpen = !ui.subOpen;
                    refreshPanels();
                    break;
                case 'sub-pick':
                    ui.subs[ui.tab] = el.dataset.sub;
                    ui.picker = null;
                    ui.subOpen = false;
                    store('salty_subs', JSON.stringify(ui.subs));
                    refreshPanels();
                    showSec(root);
                    break;
                case 'palette':
                    update(st => { st.palette = paletteVariant(el.dataset.family, PALETTES[st.palette]?.mode); });
                    break;
                case 'palette-mode':
                    update(st => { st.palette = paletteVariant(paletteFamily(st.palette), el.dataset.mode); });
                    break;
                case 'custom-open':
                    openCustomBuilder(getSettings(), PALETTES[getSettings().palette]?.mode);
                    ui.subs.theme = 'custom';
                    ui.tab = 'theme';
                    store('salty_tab', ui.tab);
                    refreshPanels();
                    showSec(root);
                    break;
                case 'custom-mode':
                    setCustomMode(el.dataset.mode);
                    refreshPanels();
                    break;
                case 'custom-seed':
                    seedCustom(el.dataset.family);
                    refreshPanels();
                    break;
                case 'custom-save':
                    ui.subs.theme = 'palette';
                    update(saveCustomPalette);
                    break;
                case 'custom-back':
                    ui.subs.theme = 'palette';
                    refreshPanels();
                    break;
                case 'reset-colors':
                    update((st) => { delete st.colorOverrides[st.palette]; });
                    break;
                case 'seg': {
                    // 테두리와 흐림은 원리상 양립 불가: 흐림 마스크가 box-shadow(테두리)까지 지운다.
                    // 그래서 테두리를 고르면 흐림을 끄고, 흐림을 켜면 테두리를 없앤다 — 고른 것이 바로 보이게.
                    if (el.dataset.path === 'image.edge' && el.dataset.value !== 'none' && getSettings().image.fade !== 'off') {
                        update(st => { setPath(st, 'image.edge', el.dataset.value); st.image.fade = 'off'; });
                        break;
                    }
                    if (el.dataset.path === 'image.fade') {
                        // 단계는 빠른 고르기 · 슬라이더는 미세 조정 — 단계를 고르면 그 단계 값으로 슬라이더를 채운다
                        const [fy, fx] = FADE_AMOUNT[el.dataset.value] || FADE_AMOUNT.off;
                        const clash = el.dataset.value !== 'off' && getSettings().image.edge !== 'none';
                        update(st => {
                            setPath(st, 'image.fade', el.dataset.value);
                            if (el.dataset.value !== 'off') { st.image.fadeY = fy; st.image.fadeX = fx; }
                            if (clash) st.image.edge = 'none'; // 흐림 마스크가 테두리 그림자까지 지운다 — 같이 켤 수 없음
                        });
                        break;
                    }
                    const { path, value } = el.dataset;
                    const current = getPath(getSettings(), path);
                    update(st => setPath(st, path, typeof current === 'number' ? Number(value) : value));
                    break;
                }
                case 'pvkind': {
                    ui.previewKind = el.dataset.kind === 'cut' ? 'cut' : 'photo';
                    refreshPanels();
                    break;
                }
                case 'pvpic': {
                    // 표본 넘기기 — 설정이 아니라 보기 상태라 저장하지 않는다 (창을 닫으면 첫 장으로)
                    ui.pic = (ui.pic + Number(el.dataset.step) + PHOTOS.length) % PHOTOS.length;
                    refreshPanels();
                    break;
                }
                case 'chip': {
                    // 테두리를 그릴 면 켜고 끄기 — 마지막 한 면까지 끄는 것도 허용한다 (테두리 자체를 '없음'으로 두는 것과 같음)
                    const { path } = el.dataset;
                    update(st => setPath(st, path, !getPath(st, path)));
                    break;
                }
                case 'size': {
                    // '본문과 같게' · '기본' = 값 없음(null) · '직접' = 지금 크기부터
                    const { path, value } = el.dataset;
                    const current = getPath(getSettings(), path);
                    if (value === 'same') {
                        if (current !== null) update(st => setPath(st, path, null));
                        break;
                    }
                    if (isNum(current)) break;
                    const min = Number(el.dataset.min);
                    const max = Number(el.dataset.max);
                    // '직접' 의 출발값: 크기는 본문 크기(메뉴는 실리태번 배율), 자간은 본문 자간, 굵기는 보통(400)
                    const start = path.endsWith('letterSpacing') ? getSettings().type.letterSpacing
                        : path.endsWith('weight') ? 400
                            : path === 'type.uiSize' ? stUiSize() : getSettings().type.size;
                    update(st => setPath(st, path, Math.min(max, Math.max(min, Number(start) || min))));
                    break;
                }
                case 'picker': {
                    const { slot, lang } = el.dataset;
                    ui.picker = ui.picker?.slot === slot && ui.picker?.lang === lang ? null : { slot, lang };
                    ui.query = '';
                    if (ui.picker) ui.fontTag = defaultTag(lang, getSettings().fonts[slot]?.[lang]);
                    refreshPanels();
                    break;
                }
                case 'fonttag':
                    ui.fontTag = el.dataset.tag;
                    syncFontLists();
                    break;
                case 'font': {
                    const { slot, lang } = ui.picker || { slot: 'text', lang: 'ko' };
                    const { id } = el.dataset;
                    const choose = () => update((st) => {
                        if (!isSet(st.fonts[slot])) st.fonts[slot] = { ...FONT_SET };
                        st.fonts[slot][lang] = id;
                    });
                    if (!ui.query.trim()) {
                        keepFontScroll(choose);
                        break;
                    }
                    // 찾기로 골랐으면 찾기를 풀고 고른 글꼴의 묶음으로 (안 풀면 다시 고를 때 목록에 방금 고른 글꼴만 남음)
                    ui.query = '';
                    ui.fontTag = defaultTag(lang, id);
                    choose();
                    showPickedFont();
                    break;
                }
                case 'rmfont':
                    if (!confirm('이 글꼴을 목록에서 지울까요?')) return;
                    await removeCustomFont(el.dataset.id);
                    applyAll();
                    refreshPanels();
                    break;
                case 'add-google': {
                    const name = await ask('구글 폰트 이름 (fonts.google.com 에 적힌 그대로)\n예: Gowun Batang, Nanum Gothic, Diphylleia');
                    if (!name) return;
                    pickFont(await addGoogleFont(name));
                    break;
                }
                case 'add-css': {
                    const url = await ask('글꼴 CSS 주소 (https://…)');
                    if (!url) return;
                    const family = await ask('그 CSS 안의 font-family 이름');
                    if (!family) return;
                    const added = await addCssFont(url, family);
                    pickFont(added);
                    if (added.cors === false) toastr.info('이 주소는 글꼴을 언어별로 나눌 수 없어요. 한국어 칸에서 고르면 모든 글자에 쓰여요.', 'Blue Lemonade');
                    break;
                }
                case 'add-file':
                    root.querySelector('input[data-file="font"]')?.click();
                    break;
                case 'mask-pick':
                    maskReplaceId = '';
                    root.querySelector('input[data-file="mask"]')?.click();
                    break;
                case 'mask-replace':
                    maskReplaceId = el.dataset.id;
                    root.querySelector('input[data-file="mask"]')?.click();
                    break;
                case 'mask-clear':
                    update(st => { st.image.mask = ''; st.image.maskId = ''; st.image.shape = 'rect'; });
                    break;
                case 'mask-save':
                    update(st => {
                        if (!st.image.mask) return;
                        if (st.image.masks.length >= MASK_SLOTS) { toastr.warning(`도형은 ${MASK_SLOTS}개까지 저장할 수 있어요. 안 쓰는 것을 지워 주세요.`, 'Blue Lemonade'); return; }
                        const item = { id: `m${Date.now().toString(36)}`, name: nextMaskName(st.image.masks), data: st.image.mask };
                        st.image.masks.push(item);
                        st.image.maskId = item.id;
                    });
                    break;
                case 'mask-use':
                    update(st => {
                        const item = st.image.masks.find(x => x.id === el.dataset.id);
                        if (!item) return;
                        st.image.mask = item.data;
                        st.image.maskId = item.id;
                        st.image.shape = 'custom';
                    });
                    break;
                case 'mask-delete': {
                    const item = getSettings().image.masks.find(x => x.id === el.dataset.id);
                    if (!item || !confirm(`${item.name}을(를) 지울까요?`)) return;
                    update(st => {
                        st.image.masks = st.image.masks.filter(x => x.id !== item.id);
                        if (st.image.maskId === item.id) { st.image.maskId = ''; st.image.mask = ''; }
                    });
                    break;
                }
                case 'fix':
                    await root._issues?.[Number(el.dataset.i)]?.run();
                    setTimeout(refreshPanels, 400);
                    break;
                case 'export': {
                    const blob = new Blob([JSON.stringify({ saltySettings: true, version: 2, settings: getSettings() }, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `blue-lemonade-settings-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                    break;
                }
                case 'import':
                    root.querySelector('input[data-file="settings"]')?.click();
                    break;
                case 'reset':
                    if (!confirm('테마 설정을 처음 상태로 돌릴까요? (내 글꼴 목록은 남아요)')) return;
                    resetSettings();
                    applyAll();
                    refreshPanels();
                    break;
            }
        } catch (error) {
            toastr.error(error.message || String(error), 'Blue Lemonade');
        }
    });

    // 숫자 칸에서 Enter = 입력 확정 (팝업의 Enter 닫기로 넘어가지 않게)
    root.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || !event.target.matches('input[data-num]')) return;
        event.preventDefault();
        event.stopPropagation();
        event.target.dispatchEvent(new Event('change', { bubbles: true }));
        event.target.blur();
    });

    root.addEventListener('input', (event) => {
        const search = event.target.closest('input[data-search="font"]');
        if (search) {
            if (!ui.query.trim() && search.value.trim()) ui.fontTag = 'all'; // 찾기 시작하면 모든 묶음에서
            ui.query = search.value;
            syncFontLists();
            return;
        }
        const picker = event.target.closest('input[data-color-path]');
        if (picker) {
            if (/^#[0-9a-f]{6}$/i.test(picker.value)) update(st => setPath(st, picker.dataset.colorPath, picker.value), false);
            return;
        }
        const range = event.target.closest('input[data-range]');
        if (!range) return;
        const path = range.dataset.range;
        const value = Number(range.value);
        range.style.setProperty('--fill', fill(value, Number(range.min), Number(range.max)));
        update(st => setPath(st, path, value), false);
        const num = root.querySelector(`input[data-num="${path}"]`);
        if (num && document.activeElement !== num) num.value = numText(path, value);
    });

    root.addEventListener('change', async (event) => {
        const target = event.target;
        if (target.matches('input[data-num]')) {
            const path = target.dataset.num;
            const min = Number(target.dataset.min);
            const max = Number(target.dataset.max);
            const current = getPath(getSettings(), path);
            const base = isNum(current) ? current : Number(target.dataset.def);
            const typed = parseFloat(String(target.value).replace(',', '.'));
            let value = Number.isFinite(typed) ? typed * (NUM[path]?.scale || 1) : base;
            if (!Number.isFinite(value)) value = min;
            value = Number(Math.min(max, Math.max(min, value)).toFixed(4));
            target.value = numText(path, value);
            const range = root.querySelector(`input[data-range="${path}"]`);
            if (range) {
                range.value = value;
                range.style.setProperty('--fill', fill(Number(range.value), min, max)); // 칸 사이 값이면 슬라이드바는 가까운 칸에 섬 → 그 자리까지 채움
            }
            if (value !== current) update(st => setPath(st, path, value), false);
            return;
        }
        if (target.matches('input[data-toggle]')) {
            const path = target.dataset.toggle;
            if (path === 'st.hideAvatars') {
                $('#hideChatAvatarsEnabled').prop('checked', target.checked).trigger('input').trigger('change');
                return;
            }
            const m = path.match(/^fonts\.(dialogue|ui|em|strong|code)\.same$/);
            if (m) {
                ui.picker = null;
                update((st) => { st.fonts[m[1]] = target.checked ? 'same' : structuredClone(st.fonts.text); });
                return;
            }
            // 자동 색은 켜고 끌 때 테두리 설명(edgeHint) 문구가 바뀌니 창을 다시 그린다
            update(st => setPath(st, path, target.checked), path === 'enabled' || path === 'chat.bgImage' || path === 'em.italic' || path === 'image.edgeAuto' || path === 'shadow.on');
            return;
        }
        if (target.matches('input[data-file="font"]') && target.files?.[0]) {
            try {
                toastr.info('글꼴 올리는 중…', 'Blue Lemonade');
                pickFont(await uploadFont(target.files[0]));
            } catch (error) {
                toastr.error(error.message, 'Blue Lemonade');
            }
            target.value = '';
            return;
        }
        if (target.matches('input[data-file="mask"]') && target.files?.[0]) {
            try {
                const mask = await readMaskImage(target.files[0]);
                const replace = maskReplaceId;
                maskReplaceId = '';
                update(st => {
                    st.image.mask = mask;
                    st.image.shape = 'custom';
                    const slot = replace ? st.image.masks.find(x => x.id === replace) : null;
                    if (slot) { slot.data = mask; st.image.maskId = slot.id; } // 바꾸기: 그 칸의 그림을 갈아 끼움
                    else st.image.maskId = ''; // 새로 고른 그림 — 저장을 누르기 전까지는 목록에 없음
                });
            } catch (error) {
                toastr.error(error.message, 'Blue Lemonade');
            }
            target.value = '';
            return;
        }
        if (target.matches('input[data-file="settings"]') && target.files?.[0]) {
            try {
                const data = JSON.parse(await target.files[0].text());
                const incoming = data?.settings;
                if (!data?.saltySettings || !incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('이 테마의 설정 파일이 아니에요');
                const ext = SillyTavern.getContext().extensionSettings;
                const backup = ext.salty;
                try {
                    ext.salty = structuredClone(incoming);
                    for (const k of Object.keys(ext.salty)) if (ext.salty[k] === null) delete ext.salty[k];
                    getSettings();
                    applyAll();
                } catch (error) {
                    ext.salty = backup;
                    getSettings();
                    applyAll();
                    throw new Error('설정 파일 내용이 이상해서 되돌렸어요: ' + (error.message || error));
                }
                saveSettings();
                refreshPanels();
                toastr.success('설정을 가져왔어요', 'Blue Lemonade');
            } catch (error) {
                toastr.error(error.message, 'Blue Lemonade');
            }
            target.value = '';
        }
    });
}
