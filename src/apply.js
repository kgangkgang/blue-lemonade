import { scratchMask, slantGeometry } from './image-shapes.js';
// 설정 → :root CSS 변수(--salty-*) + 실리태번 색 변수 덮기 + body 클래스 + 글꼴 합치기
import { getSettings, fontSet, FONT_SLOTS, DEFAULTS } from './settings.js';
import { PALETTES, LEGACY, TOKEN_KEYS, paletteColors, parseColor, sameColor, onColor } from './palettes.js';
import { buildComposite, slotStack, findFont } from './fonts.js';
import { iconsCss } from './icons.js';
import { classifyAll } from './assets.js';
import { syncFeatures } from './features.js';
import { syncSplash } from './splash.js';

function styleTag(id) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('style');
        el.id = id;
        document.head.appendChild(el);
    }
    return el;
}

function declarations(vars, important = false) {
    return Object.entries(vars).map(([k, v]) => `${k}: ${v}${important ? ' !important' : ''};`).join('\n');
}

// 실리태번은 입력칸·버튼 바탕을 검정 반투명(--black30a 등)으로 칠함 → 밝은 테마에선 글자색 기준의 옅은 음영으로
function lightShades(textColor) {
    const [r, g, b] = parseColor(textColor);
    const c = a => `rgba(${r}, ${g}, ${b}, ${a})`;
    return {
        '--black30a': c(0.05), '--black50a': c(0.08), '--black60a': c(0.11), '--black70a': c(0.14), '--black90a': c(0.3),
        '--white20a': c(0.08), '--white30a': c(0.12), '--white50a': c(0.2), '--white60a': c(0.26), '--white70a': c(0.32), '--white100': textColor,
        '--grey30a': c(0.06), '--grey5020a': c(0.07), '--grey5050a': c(0.16), '--grey7070a': c(0.2),
    };
}

// 시작 화면 로고 자리에 넣는 테마 아이콘 (설정 창 머리 아이콘과 같은 모양, 레몬색)
function logoUrl(color) {
    const [r, g, b] = parseColor(color);
    // 속찬 레몬 — panel.js MARK · 스플래시(surfaces:loader)와 똑같은 path (윤곽이 네 곳에서 같아야 함)
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'><path fill='rgb(${r},${g},${b})' transform='translate(0 448) scale(1 -1)' d='M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function alpha(color, a) {
    const [r, g, b] = parseColor(color);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function scaleAlpha(color, k) {
    const [r, g, b, a] = parseColor(color);
    return `rgba(${r}, ${g}, ${b}, ${Number((a * k).toFixed(3))})`;
}
/** a 를 pa 만큼, b 를 나머지만큼 섞은 불투명 색 */
function mix(a, b, pa) {
    const x = parseColor(a);
    const y = parseColor(b);
    return `rgb(${[0, 1, 2].map(i => Math.round(x[i] * pa + y[i] * (1 - pa))).join(', ')})`;
}

/** 1.0.0 버그로 저장된 "직접 고친 색" 중 그때 기본값과 같은 것은 지움 (안 지우면 새 기본 색이 안 보임) */
export function dropStaleOverrides(s = getSettings()) {
    let changed = false;
    for (const [pal, colors] of Object.entries(s.colorOverrides || {})) {
        for (const [token, value] of Object.entries(colors || {})) {
            const legacy = (LEGACY[pal] || []).map(old => old[token]).filter(Boolean);
            const current = PALETTES[pal]?.[token];
            if (legacy.some(old => sameColor(value, old)) || (current && sameColor(value, current))) {
                delete colors[token];
                changed = true;
            }
        }
        if (!Object.keys(colors || {}).length) delete s.colorOverrides[pal];
    }
    return changed;
}

// ───────── 글꼴 ─────────
let fontGen = 0;
const compositeCache = new Map();
let lastFaces = null;
const fontRetry = { timer: 0, count: 0 };

// 본문은 늘 묶음, 나머지(대사 · 메뉴 · 속마음 · 강조)는 '같게'면 null
function slotSets(s) {
    return Object.fromEntries(FONT_SLOTS.map(slot => [slot, slot === 'text'
        ? fontSet(s, 'text')
        : (!s.fonts[slot] || s.fonts[slot] === 'same' ? null : s.fonts[slot])]));
}

function fontVars(s) {
    const sets = slotSets(s);
    const vars = {};
    for (const [slot, set] of Object.entries(sets)) {
        if (!set) {
            // 메뉴는 본문 글꼴, 대사 · 속마음 · 강조는 둘레 글꼴 그대로 (대사 안의 속마음이면 대사 글꼴)
            vars[`--salty-font-${slot}`] = slot === 'ui' ? 'var(--salty-font-text)' : 'inherit';
            continue;
        }
        vars[`--salty-font-${slot}`] = slotStack(slot, set);
    }
    return vars;
}

async function applyFonts(s) {
    const gen = ++fontGen;
    // 테마를 끄면 @font-face 도 비움 — 안 쓰는 CDN 글꼴이 문서에 걸려 있으면 안 됨
    if (!s.enabled) {
        clearTimeout(fontRetry.timer);
        fontRetry.count = 0;
        if (lastFaces) styleTag('salty-fontfaces').textContent = '';
        lastFaces = '';
        return;
    }
    const sets = slotSets(s);
    const jobs = Object.entries(sets).filter(([, set]) => set).map(([slot, set]) => {
        const key = `${slot}|${JSON.stringify(set)}|${s.fonts.hanja}|${s.customFonts.map(f => f.id + ':' + (f.google || f.css || f.file || '') + (f.cors === false ? '!' : '')).join(',')}`;
        if (!compositeCache.has(key)) {
            const p = buildComposite(slot, set, s.fonts.hanja);
            // 못 받아온 글꼴이 있으면 다음 적용 때 다시 시도 (fetchCss 도 실패한 주소는 캐시에서 지움)
            p.then(r => { if (r.failed.length) compositeCache.delete(key); }, () => compositeCache.delete(key));
            compositeCache.set(key, p);
        }
        return compositeCache.get(key);
    });
    const results = (await Promise.allSettled(jobs)).filter(r => r.status === 'fulfilled').map(r => r.value);
    if (gen !== fontGen) return;
    const css = results.map(r => r.css).join('\n');
    if (css !== lastFaces) {
        styleTag('salty-fontfaces').textContent = css;
        lastFaces = css;
        syncSplash(s); // 3.5.2 새로고침 첫 화면 파일에 메뉴 글꼴도 (글꼴 CSS 는 applyAll 보다 늦게 옴)
    }
    const failed = [...new Set(results.flatMap(r => r.failed))];
    if (failed.length && !applyFonts.warned) {
        applyFonts.warned = true;
        console.warn('[Salty] 글꼴 CSS를 직접 못 받아와 통째로 불러옴 (언어별 나누기 안 됨):', failed.join(', '));
    }
    // 받아오다 실패한 글꼴은 조금 뒤 다시 합쳐 봄 (폰이 막 깨어나 인터넷이 늦게 붙으면 설정을 바꿀 때까지 통째 불러오기로 남았음)
    // CSS 를 원래 못 읽는 주소(cors: false)는 다시 해도 같아서 뺌
    clearTimeout(fontRetry.timer);
    if (!failed.some(id => findFont(id)?.cors !== false)) fontRetry.count = 0;
    else if (fontRetry.count < 4) fontRetry.timer = setTimeout(() => { fontRetry.count++; applyFonts(getSettings()); }, 3000 * 2 ** fontRetry.count);
}

// ───────── 글자 크기 ─────────
// 본문 · 대사 · 메뉴를 따로. 대사는 본문 대비 배율(--salty-dialogue-scale)도 같이 줘서
// 내 메시지(본문의 0.94배)나 작은 글 안의 대사도 같은 비율로 커지고, 줄 높이는 둘레 줄에 맞출 수 있음.
// 역할(대사 · 속마음 · 강조 · 코드 · 메뉴)의 자간 · 크기: 설정에 없으면(null) 둘레 값 그대로
const roleSpacing = (v, fallback = 'inherit') => (typeof v === 'number' && Number.isFinite(v) ? `${v / 100}em` : fallback);
const roleScale = (size, base) => (typeof size === 'number' && size > 0 && base > 0 ? String(Number((size / base).toFixed(4))) : '1');

// 메뉴 크기(--salty-ui-size)는 따로 정했을 때만 — 안 정하면 실리태번 글자 배율 그대로
function typeVars(type) {
    const scale = type.dialogueSize && type.size > 0 ? Number((type.dialogueSize / type.size).toFixed(4)) : 1;
    const vars = {
        '--salty-size': `${type.size}px`,
        '--salty-dialogue-size': type.dialogueSize ? `${type.dialogueSize}px` : 'var(--salty-size)',
        '--salty-dialogue-scale': String(scale),
    };
    if (type.uiSize) vars['--salty-ui-size'] = `${type.uiSize}px`;
    if (type.codeSize) vars['--salty-code-size'] = `${type.codeSize}px`;
    return vars;
}

// ───────── 대사 형광펜 ─────────
// 실제 형광펜 자국처럼: 펜촉이 비스듬한 시작·끝, 시작 쪽에 잉크가 조금 고인 느낌, 위아래는 아주 살짝 물결.
// 한 장의 SVG 로 그려서(조각을 겹치면 이음매가 세로줄로 보임) 대사 길이에 맞춰 늘어남.
// 줄마다 따로 칠해져서(box-decoration-break: clone) 여러 줄 대사도 줄마다 한 획씩.
//   % 는 q 의 인라인 상자(글꼴의 ascent+descent 영역) 기준 — 리디바탕은 한글이 이 상자를 꽉 채우고 기준선이 81% 쯤.
//   tilt(기울기): rise = 왼쪽과 오른쪽 띠 높이 차, mid = 가운데에 놓을 때 띠 한가운데
//   markerThick(두께, %) — 위치와 상관없이 같은 두께 (숫자가 곧 두께) · 아래로 MIN_THICK 은 획이 보이는 한계
//   markerPos(위치): center 가운데 | bottom 아래 — 밑줄 긋듯 기울기를 절반으로 눕히고 띠 아랫변을 글자 아랫부분에
const MARKER_TILT = {
    flat: { rise: 0, mid: 57 },    // 두께 54 → 30~84
    slant: { rise: 18, mid: 56 },  // 두께 54 → 왼쪽 38~92, 오른쪽 20~74
    steep: { rise: 48, mid: 50 },  // 줄 높이를 통째로 가로지름
};
const MARKER_POS = {
    center: {},
    bottom: { tiltK: 0.5, base: 96 },  // base = 띠 아랫변 높이 · tiltK = 기울기만 절반
};
const MIN_THICK = 10; // % — 이보다 얇으면 폰 화면에서 획이 아예 안 보임 (settings.js TEXT_LIMIT.markerThick 과 같은 값)

/** 형광펜 띠: 두께 T 와 왼쪽·오른쪽 윗변 높이 (%). 두꺼우면 상자(0~100)를 넘지 않게 기울기를 줄이고 안으로 밀어 넣음 — 넘치면 잘려서 각진 끝이 보임 */
export function markerGeometry(d) {
    const tilt = MARKER_TILT[d.tilt] || MARKER_TILT.flat;
    const pos = MARKER_POS[d.markerPos] || MARKER_POS.center;
    const thick = Number(d.markerThick) > 0 ? Number(d.markerThick) : DEFAULTS.dialogue.markerThick;
    const T = Math.min(100, Math.max(MIN_THICK, thick));
    const rise = Math.max(0, Math.min(tilt.rise * (pos.tiltK || 1), 100 - T));
    const half = (rise + T) / 2;
    const mid = Math.min(100 - half, Math.max(half, pos.base ? pos.base - T / 2 : tilt.mid));
    return { T, l: mid + rise / 2 - T / 2, r: mid - rise / 2 - T / 2 };
}

export function markerBackground(s, color) {
    const { T, l, r } = markerGeometry(s.dialogue);
    const lb = l + T;
    const rb = r + T;
    const w = Math.min(1.8, T * 0.07); // 위아래 물결 — 얇은 획은 덜 출렁이게
    const [cr, cg, cb, ca] = parseColor(color);
    const rgb = `rgb(${cr},${cg},${cb})`;
    const op = Math.min(1, ca);
    const n = v => Number(v.toFixed(2));
    // 획 하나: 시작은 펜촉처럼 비스듬히(위가 조금 오른쪽), 끝도 비스듬히 잘림(아래가 조금 왼쪽)
    const stroke = [
        `M0,${n(l + T * 0.22)}`, `L2.2,${n(l)}`,
        `Q25,${n(l - w + (r - l) * 0.25)} 50,${n((l + r) / 2)}`, `T98.6,${n(r)}`,
        `L100,${n(r + T * 0.5)}`, `L97.2,${n(rb)}`,
        `Q75,${n(rb + w - (rb - lb) * 0.25)} 50,${n((lb + rb) / 2)}`, `T0.8,${n(lb)}`, 'Z',
    ].join(' ');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>`
        + `<defs><linearGradient id='p' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='${rgb}' stop-opacity='${n(op * 0.45)}'/><stop offset='0.14' stop-color='${rgb}' stop-opacity='0'/></linearGradient></defs>`
        + `<path d='${stroke}' fill='${rgb}' fill-opacity='${n(op)}'/>`
        // 시작 쪽에 잉크가 고인 느낌: 같은 획 안에서만 겹치므로 이음매 없음
        + `<path d='${stroke}' fill='url(#p)'/>`
        + `</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
}

/** 글자 그림자: 각도(0 = 오른쪽, 시계 방향) · 거리 → x/y, 퍼짐, 색 + 투명도. 끄면 none */
function textShadow(shadow) {
    if (!shadow?.on) return 'none';
    const rad = (Number(shadow.angle) || 0) * Math.PI / 180;
    const d = Number(shadow.distance) || 0;
    const [r, g, b] = parseColor(shadow.color);
    const a = Math.min(1, Math.max(0, (Number(shadow.alpha) || 0) / 100));
    return `${(Math.cos(rad) * d).toFixed(2)}px ${(Math.sin(rad) * d).toFixed(2)}px ${Number(shadow.blur) || 0}px rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 글자 그림자가 켜진 대상 → body · 미리보기 문단 클래스 (salty-shadow-text · -dialogue · -em · -strong · -code) */
function shadowClasses(s) {
    const sh = s.shadow;
    if (!sh?.on) return [];
    return Object.entries(sh.targets || {}).filter(([, on]) => on).map(([key]) => `salty-shadow-${key}`);
}

/** 설정 창 미리보기 문단의 클래스를 설정에 맞춤 */
export function syncSamples(s = getSettings()) {
    const name = `salty-sample salty-dlg-${s.dialogue.style} salty-align-${s.type.align}${s.type.indent ? ' salty-indent' : ''}${shadowClasses(s).map(c => ` ${c}`).join('')}`;
    document.querySelectorAll('.salty-sample').forEach((el) => { if (el.className !== name) el.className = name; });
}

// ───────── 에셋 이미지 크기 ─────────
// 비율 유지: 최대 높이만 (더 긴 그림은 위아래를 잘라 채움) · 높이 맞춤: 모든 그림을 같은 높이로 (넘치는 쪽을 잘라 채움)
// 화면 높이 % 는 svh(주소창이 펼쳐진 화면 기준) → 스크롤로 주소창이 접혀도 그림 높이가 안 흔들림. svh 를 모르면 vh
const SVH = globalThis.CSS?.supports?.('height', '1svh') ? 'svh' : 'vh';
function imageHeight(image) {
    const fixed = image.fit === 'fixed';
    const cap = `${fixed ? image.height : image.maxh}${SVH}`;
    return {
        '--salty-img-height': fixed ? cap : 'auto',
        '--salty-img-maxh': fixed ? 'none' : cap,
        '--salty-img-cap': cap, // 투명 캐릭터 컷: 틀을 키우지 않고 최대 높이로만 씀
    };
}

// ───────── 에셋 이미지 모양 · 흐림 ─────────
// 흐림 단계: y = 위아래(대각선은 자른 선, 아치는 둥근 윗면) · x = 옆 — 그림 짧은 변에 곱하는 비율. 강함은 네 가장자리가 바탕에 녹아듦
// 예전 단계별 고정값 (지금은 settings.js 의 FADE_AMOUNT 가 슬라이더 기본값으로 씀 — 참고용으로 남김)
const IMAGE_FADE = {
    off: { y: 0, x: 0 },
    soft: { y: 0.1, x: 0 },
    medium: { y: 0.18, x: 0.06 },
    strong: { y: 0.3, x: 0.22 },
};
function imageShape(image) {
    // 번짐 폭은 슬라이더 값(%) 이 정한다. 단계는 클래스 출처로만 남고, '끔' 이면 값과 무관하게 0
     // (끔 상태에서 옛 값이 남아 마스크가 살아 있으면 테두리가 지워진다)
    const off = image.fade === 'off';
    const f = { y: off ? 0 : (image.fadeY ?? 10) / 100, x: off ? 0 : (image.fadeX ?? 0) / 100 };
    const slant = slantGeometry(image.angle);
    return {
        '--salty-feather-y': String(f.y),
        '--salty-feather-x': String(f.x),
        '--salty-scratch-mask': scratchMask(image.scratchAmount, image.scratchDirection, image.scratchTexture),
        // 커스텀 도형: 설정에 든 투명 PNG(data URL)의 알파로 오림. 늘리기 = 그림 상자 가득, 맞추기 = 비율 유지 가운데
        '--salty-img-mask': image.mask ? `url("${image.mask}")` : 'none',
        '--salty-img-mask-size': image.maskFit === 'contain' ? 'contain' : '100% 100%',
        '--salty-corner-cut': String(image.cornerCut / 100),
        '--salty-slant-deg': `${slant.degrees}deg`,
        '--salty-slant-sin': slant.sin.toFixed(4),
        '--salty-slant-cos': slant.cos.toFixed(4), // 흐림 폭 상한: 자르고 남은 띠 두께 = 높이 × cos - 자른 거리
        '--salty-slant-tan': slant.tan.toFixed(4),
    };
}

// ───────── 자동완성 색 ─────────
// 실리태번 'theme' 모양은 어두운 화면용 고정 색(연어색 값 · 민트 타입 · 보라 괄호) + 회색 판 고른 줄이라 흰 바탕에서 안 보임
//   → 이름은 밝은 글자, 인자 이름은 파랑, 값은 무채색, 고른 줄은 옅은 포인트 면 (모든 글자가 고른 줄 위에서도 4.5:1 이상)
function autocompleteVars(pal, mode) {
    const dark = mode === 'dark';
    const bg = pal.surface;
    const link = dark ? mix(pal.accent, pal.dialogue, 0.6) : mix(pal.accent, pal.text, 0.7); // 글자로 쓰는 포인트
    const value = dark ? pal.text : pal.dialogue; // 값(true · 문자열 · 숫자): 무채색 — 레몬으로 칠하면 긴 목록이 노란 벽이 됨
    const quiet = dark ? mix(pal.muted, pal.dialogue, 0.55) : pal.muted;
    const vars = {
        background: bg, border: 'transparent', text: pal.text,
        matchedBackground: 'transparent', matchedText: pal.accent,
        selectedBackground: mix(pal.accent, bg, dark ? 0.16 : 0.1), selectedText: dark ? pal.dialogue : pal.text,
        notSelectableBackground: mix(pal.text, bg, 0.08), notSelectableText: pal.muted,
        hoveredBackground: mix(pal.text, bg, 0.05), hoveredText: pal.text,
        cmd: dark ? pal.dialogue : pal.text, argName: link, type: quiet, symbol: pal.accent,
        string: value, number: value, variable: link, variableLanguage: pal.accent, keyword: pal.accent,
        punctuation: quiet, punctuationL1: link, punctuationL2: pal.accent, currentParenthesis: pal.pop || pal.accent,
        comment: dark ? pal.muted : pal.em, abort: pal.pop || pal.accent,
    };
    return Object.fromEntries(Object.entries(vars).map(([k, v]) => [`--ac-style-color-${k}`, v]));
}

// ───────── 전체 적용 ─────────
export function applyAll() {
    const s = getSettings();
    const pal = paletteColors(s);
    const mode = (PALETTES[s.palette] || PALETTES.salt).mode;

    const vars = {};
    for (const key of TOKEN_KEYS) vars[`--salty-${key}`] = pal[key];
    vars['--salty-on-accent'] = onColor(pal.accent); // 포인트색 위 글자색 (밝은 포인트면 어두운 글자)
    // 두 번째 포인트(지금 있는 곳 · 고른 것): 블루 아워는 레몬, 없으면 포인트색. 밝은 pop 위 글자는 어두운 테마면 바탕 남색
    const pop = pal.pop || pal.accent;
    const onPop = onColor(pop);
    vars['--salty-pop'] = pop;
    vars['--salty-danger'] = pal.danger;
    vars['--salty-danger-ink'] = mode === 'dark' ? pal.bg : '#FFFFFF';
    vars['--salty-danger-soft'] = alpha(pal.danger, mode === 'dark' ? 0.16 : 0.12);
    vars['--salty-on-pop'] = mode === 'dark' && onPop !== '#FFFFFF' ? pal.bg : onPop;
    // 파생 톤은 JS 로 계산 (color-mix 를 모르는 예전 브라우저에서도 면·입력칸·포커스 링이 나오게)
    Object.assign(vars, {
        '--salty-shade': alpha(pal.text, 0.06),
        '--salty-shade-2': alpha(pal.text, 0.11),
        '--salty-field': mix(pal.raised, pal.surface, 0.6),
        '--salty-ring': `0 0 0 3px ${alpha(pal.accent, 0.26)}`,
        '--salty-lift': `0 10px 30px -14px ${pal.shadow}, 0 1px 3px ${scaleAlpha(pal.shadow, 0.4)}`,
        '--salty-lift-lg': `0 24px 60px -20px ${pal.shadow}, 0 2px 8px ${scaleAlpha(pal.shadow, 0.35)}`,
        '--salty-accent-8': scaleAlpha(pal.accent, 0.08),
        '--salty-accent-10': scaleAlpha(pal.accent, 0.1),
        '--salty-accent-13': scaleAlpha(pal.accent, 0.13),
        '--salty-accent-22': scaleAlpha(pal.accent, 0.22),
        '--salty-accent-28': scaleAlpha(pal.accent, 0.28),
        '--salty-accent-40': scaleAlpha(pal.accent, 0.4),
        '--salty-accent-70': scaleAlpha(pal.accent, 0.7),
        '--salty-tint-12': mix(pal.accent, pal.surface, 0.12),
        '--salty-tint-14': mix(pal.accent, pal.surface, 0.14),
        '--salty-tint-18': mix(pal.accent, pal.surface, 0.18),
        '--salty-tint-bg-12': mix(pal.accent, pal.bg, 0.12),
        '--salty-accent-press': mix(pal.accent, pal.text, 0.86),
        '--salty-accent-dlg': mix(pal.accent, pal.dialogue, 0.6),
        '--salty-bg-82': scaleAlpha(pal.bg, 0.82),
        '--salty-text-90': scaleAlpha(pal.text, 0.9),
        '--salty-shadow-50': scaleAlpha(pal.shadow, 0.5),
        '--salty-surface-shade': mix(pal.text, pal.surface, 0.06),
        '--salty-toast-error': pal.surface,
        '--salty-toast-warning': mix(pal.text, pal.surface, 0.06),
        '--salty-toast-success': mix(pal.accent, pal.surface, 0.10),
        // 로고 레몬은 두 테마 다 노란색 (스플래시 · 서랍 머리 레몬과 같은 값). 뒤에 판은 깔지 않음
        '--salty-lemon': pal.brand || (mode === 'dark' ? '#FFE973' : '#E9BE00'),
        '--salty-logo': logoUrl(pal.brand || (mode === 'dark' ? '#FFE973' : '#E9BE00')),
    });
    // 그림자 5단(--bl-e1~e5) · 버튼 면: 팔레트 그림자색에서 계산 (그림자색을 바꾸면 따라감, color-mix 없이)
    const [sr, sg, sb, sa] = parseColor(pal.shadow);
    const sh = k => `rgba(${sr}, ${sg}, ${sb}, ${Math.min(0.9, Number((sa * k).toFixed(3)))})`;
    const hi = a => `inset 0 2px 3px -2px rgba(255, 255, 255, ${a})`; // 어두운 테마: 윗면 옅은 빛 (선으로 보이지 않게 부드럽게)
    Object.assign(vars, mode === 'dark' ? {
        '--salty-e1': `${hi(0.16)}, 0 1px 1px ${sh(0.31)}, 0 2px 6px -2px ${sh(0.39)}`,
        '--salty-e2': `${hi(0.2)}, 0 1px 2px ${sh(0.39)}, 0 3px 7px -3px ${sh(0.45)}`,
        '--salty-e3': `${hi(0.16)}, 0 1px 3px ${sh(0.33)}, 0 8px 18px -8px ${sh(0.63)}`,
        '--salty-e4': `${hi(0.2)}, 0 2px 6px ${sh(0.39)}, 0 14px 30px -12px ${sh(0.76)}`,
        '--salty-e5': `${hi(0.18)}, 0 4px 12px ${sh(0.45)}, 0 22px 48px -18px ${sh(0.83)}`,
        '--salty-sheet': `inset 0 10px 10px -10px ${sh(0.56)}, 0 16px 34px -14px ${sh(0.69)}`,
        '--salty-press': `inset 0 1px 3px ${sh(0.63)}`,
        '--salty-well-in': `inset 0 1px 1px ${sh(0.2)}`,
        '--salty-track': `inset 0 1px 2px ${sh(0.42)}`,
        '--salty-knob': `0 1px 2px ${sh(0.56)}, 0 2px 6px -1px ${sh(0.49)}`,
        // 층은 유지하되 밝기 차이를 줄여 겹친 카드가 두꺼워 보이지 않게 한다
        '--salty-card': mix(pal.text, pal.surface, 0.035),
        '--salty-overlay': mix(pal.text, pal.surface, 0.08),
        // 오목한 칸(시트 위 입력칸)은 반대쪽으로 한 톤: 바탕보다 어둡게 — 버튼(한 톤 위)과 안 겹치게
        '--salty-sunk': mix('#000000', pal.bg, 0.12),
        '--salty-control': mix(pal.text, pal.raised, 0.045),
        '--salty-control-hover': mix(pal.text, pal.raised, 0.10),
        '--salty-scrim': alpha(pal.bg, 0.72),
    } : {
        '--salty-e1': `0 1px 3px ${sh(0.25)}`,
        '--salty-e2': `0 1px 4px ${sh(0.4)}`,
        '--salty-e3': `0 1px 3px ${sh(0.43)}, 0 10px 28px -10px ${sh(1.43)}`,
        '--salty-e4': `0 2px 6px ${sh(0.5)}, 0 18px 44px -12px ${sh(1.86)}`,
        '--salty-e5': `0 4px 14px ${sh(0.57)}, 0 34px 80px -20px ${sh(2.43)}`,
        '--salty-sheet': `inset 0 12px 12px -12px ${sh(0.86)}, 0 24px 48px -16px ${sh(1.86)}`,
        '--salty-press': `inset 0 1px 3px ${sh(1)}`,
        '--salty-well-in': `inset 0 1px 2px ${sh(0.5)}`,
        '--salty-track': `inset 0 1px 2px ${sh(0.71)}`,
        '--salty-knob': `0 1px 2px ${sh(1.43)}, 0 3px 8px -1px ${sh(1.43)}`,
        '--salty-card': pal.surface,
        '--salty-overlay': pal.surface,
        '--salty-control': pal.surface,
        '--salty-control-hover': mix(pal.text, pal.surface, 0.04),
        '--salty-scrim': alpha(mix(pal.text, pal.accent, 0.8), 0.34),
    });
    // 네 면이 다 켜졌는지 — CSS 의 -all(감싸는 겹) · -part(빛의 방향 블룸) 두 스위치가 이 값을 쓴다
    const edgeSidesAll = s.image.edgeSideTop && s.image.edgeSideRight && s.image.edgeSideBottom && s.image.edgeSideLeft;
    Object.assign(vars, fontVars(s), typeVars(s.type), {
        '--salty-lh': String(s.type.lineHeight),
        '--salty-ls': `${s.type.letterSpacing / 100}em`,
        '--salty-weight': String(s.type.weight),
        '--salty-para': `${s.type.para}em`,
        '--salty-measure': `${s.type.measure}px`,
        '--salty-gutter': `${s.type.gutter}px`,
        '--salty-align': s.type.align === 'left' ? 'left' : 'justify',
        '--salty-dialogue-weight': String(s.dialogue.weight),
        '--salty-marker-bg': markerBackground(s, pal.marker),
        '--salty-shadow': textShadow(s.shadow),
        '--salty-marker-ink': pal.markerInk || pal.dialogue, // 형광펜 안 글자색 — 어두운 바탕에 밝은 레몬 띠(레몬 블루 나이트)는 어두운 글자
        // 글자색 톤 맞추기(tone.js)의 채도 · 밝기 — 지금 팔레트가 나이트면 dark 값 (2.6.1 슬라이더)
        '--bl-tone-s': `${(s.chat.tone?.[pal.mode === 'dark' ? 'dark' : 'light']?.s ?? (pal.mode === 'dark' ? 70 : 58))}%`,
        '--bl-tone-l': `${(s.chat.tone?.[pal.mode === 'dark' ? 'dark' : 'light']?.l ?? (pal.mode === 'dark' ? 74 : 38))}%`,

        '--salty-em-style': s.em.italic ? 'italic' : 'normal',
        '--salty-em-weight': String(s.em.weight),
        '--salty-strong-weight': String(s.strong.weight),
        // 역할별 크기(둘레 글자 대비 배율) · 자간 · 굵기 (2.7.0) — 없음(null) 이면 둘레 값 그대로 (inherit)
        '--salty-dialogue-ls': roleSpacing(s.dialogue.letterSpacing),
        '--salty-em-scale': roleScale(s.em.size, s.type.size),
        '--salty-em-ls': roleSpacing(s.em.letterSpacing),
        '--salty-strong-scale': roleScale(s.strong.size, s.type.size),
        '--salty-strong-ls': roleSpacing(s.strong.letterSpacing),
        '--salty-code-weight': s.code?.weight ? String(s.code.weight) : 'inherit',
        '--salty-code-ls': roleSpacing(s.code?.letterSpacing),
        '--salty-user-scale': String(Number(((s.chat.userSize ?? 100) / 100).toFixed(3))), // 내 메시지 크기 (본문 대비)
        '--salty-user-ink': `${s.chat.userInk ?? 100}%`,                                     // 내 메시지 글자 진하기
        '--salty-ui-weight': s.ui?.weight ? String(s.ui.weight) : 'normal',
        '--salty-ui-ls': roleSpacing(s.ui?.letterSpacing, 'normal'),
        '--salty-img-radius': `${s.image.radius}px`,
        // 테두리 파라미터 (설정 창 슬라이더 → CSS 가 이 값으로 두께 · 진하기 · 번짐을 계산)
        '--salty-edge-thick': `${s.image.edgeThick}px`,
        '--salty-edge-alpha': String(Math.min(1, Math.max(0.05, s.image.edgeAlpha / 100))),
        '--salty-edge-glow': `${s.image.edgeGlow}px`,
        // 테두리를 그릴 면 (1 · 0). -all 은 네 면이 다 켜졌을 때만 1 — 네 면을 한꺼번에 감싸는 겹(균일 링 · 대기광 · 안쪽 선)이
        // 그때만 나오게 해서, 한 면이라도 끄면 영화처럼 켠 면만 깨끗하게 남는다. -part 는 그 반대(빛이 방향 블룸으로 갈아타는 스위치)
        '--salty-side-top': s.image.edgeSideTop ? '1' : '0',
        '--salty-side-right': s.image.edgeSideRight ? '1' : '0',
        '--salty-side-bottom': s.image.edgeSideBottom ? '1' : '0',
        '--salty-side-left': s.image.edgeSideLeft ? '1' : '0',
        '--salty-side-all': edgeSidesAll ? '1' : '0',
        '--salty-side-part': edgeSidesAll ? '0' : '1',
    }, imageHeight(s.image), imageShape(s.image));
    // 테마를 끄면 토큰은 설정 창에만 — :root 에 두면 안 쓰는 변수가 문서 전체에 깔림 (설정 창은 꺼도 자기 색으로 보임)
    let css = `${s.enabled ? ':root' : '.salty-panel'} {\n${declarations(vars)}\n}`;

    if (s.enabled) {
        const [ar, ag, ab] = parseColor(pal.accent);
        const st = {
            '--SmartThemeBodyColor': pal.text,
            '--SmartThemeEmColor': pal.em,
            '--SmartThemeUnderlineColor': pal.accent,
            // 실리태번 · 확장(타번 헬퍼 · 전개지시 등)은 이 변수를 포인트색으로 씀 — 채팅 대사 색은 테마가 q 에 따로 칠함
            '--SmartThemeQuoteColor': pal.accent,
            '--SmartThemeBlurTintColor': pal.surface,
            '--SmartThemeChatTintColor': 'transparent',
            '--SmartThemeUserMesBlurTintColor': pal.raised,
            '--SmartThemeBotMesBlurTintColor': 'transparent',
            '--SmartThemeShadowColor': 'transparent',   // 글자 그림자 색 → 아예 없음 (번짐 방지)
            '--SmartThemeBorderColor': 'transparent',   // 가는 테두리선 없애기 — 칸은 면 색으로 구분
            '--SmartThemeBlurStrength': '0px',           // 뒤 비침 흐림 끄기 (폰에서 색이 번져 보이는 원인)
            '--SmartThemeCheckboxBgColorR': ar,
            '--SmartThemeCheckboxBgColorG': ag,
            '--SmartThemeCheckboxBgColorB': ab,
            '--SmartThemeCheckboxBgColorA': 1,
            '--shadowWidth': 0,
            '--mainFontFamily': 'var(--salty-font-ui)',
            '--interactable-outline-color': pal.accent,
            '--interactable-outline-color-faint': pal.line,
        };
        if (mode === 'light') Object.assign(st, lightShades(pal.text));
        // 메뉴 글자 크기를 따로 정했으면 실리태번 글자 배율 대신 그 크기 — 테마 UI 글자 단계(--bl-fs-*)가 이걸 따라감
        if (s.type.uiSize) st['--mainFontSize'] = 'var(--salty-ui-size)';
        css += `\n:root {\n${declarations(st, true)}\n}`;
        // 자동완성 색은 실리태번이 body 에 박는 변수라 :root 로는 안 덮임 → body.salty 에
        css += `\nbody.salty {\n${declarations(autocompleteVars(pal, mode), true)}\n}`;
    }
    styleTag('salty-vars').textContent = css;

    // 아이콘 CSS(15KB)도 테마를 끄면 비움 — body.salty 밖에선 쓸 데가 없음
    const icons = s.enabled ? styleTag('salty-icons') : document.getElementById('salty-icons');
    const iconText = s.enabled ? iconsCss() : '';
    if (icons && icons.textContent !== iconText) icons.textContent = iconText;

    const want = new Set();
    if (s.enabled) {
        ['salty', `salty-${mode}`, `salty-user-${s.chat.user}`, `salty-header-${s.chat.header}`, `salty-img-${s.image.layout}`, `salty-shape-${s.image.shape}`, `salty-fade-${s.image.fade}`, `salty-edge-${s.image.edge}`, `salty-dlg-${s.dialogue.style}`].forEach(c => want.add(c));
        if (s.chat.icons === 'line') want.add('salty-icons-line');
        shadowClasses(s).forEach(c => want.add(c)); // 글자 그림자 대상별 클래스 (style.css 끝 규칙)
        if (s.chat.bgImage) want.add('salty-bgimg');
        const deus = !!s.deus?.on; // 3.4.0 프롬프트 › 데우스 엑스 마키나 2.3 호환 — 끄면 아래 데우스 카드 클래스가 모두 빠진다
        if (deus && s.chat.unifyRegex) want.add('salty-unify-regex');   // 정규식 카드 색 통일 (style.css '색 통일' 블록)
        if (s.chat.unifyInline) want.add('salty-unify-inline'); // 본문에 적힌 글자색 무시
        else if (s.chat.toneInline) want.add('salty-tone');     // 글자색의 색상만 두고 채도 · 밝기 맞춤 (tone.js + style.css 끝 규칙)
        if (deus && !s.chat.regexIcons) want.add('salty-regex-noicons'); // 정규식 카드의 이모티콘 숨김
        if (deus && s.chat.demSkin) want.add('salty-dem-skin');          // 3.1.0 데우스 카드 스킨 (css/30-dem-skin.css)
        if (deus && s.chat.demSkin && s.chat.demFold !== false) want.add('salty-dem-fold'); // 폰: 트래커 한 줄 · 펼쳐 오는 카드 접기 (demskin.js)
        if (s.type.indent) want.add('salty-indent');
        want.add(`salty-align-${s.type.align}`);
        if (mode === 'light' && s.image.blendWhite && !s.chat.bgImage) want.add('salty-blend');
        if (s.image.cutoutSame) want.add('salty-cutout-same'); // assets.js 가 이 클래스를 보고 .salty-cutout 을 안 붙임 → 컷도 보통 그림 규칙을 탐
        // 자동 색: 테두리를 켰고 · 자동이고 · 테두리가 나오는 모양(네모 · 아치)일 때만.
        // 조건을 CSS 선택자(:is(.salty-shape-rect, .salty-shape-mirror))와 똑같이 맞춰, 클래스는 붙었는데 CSS 는 안 먹는 상태를 막는다.
        // assets.js 는 이 클래스와 무관하게 그림마다 --salty-pick-* 를 미리 칠해 두므로, 켜는 순간 다시 훑을 필요가 없다
        if (s.image.edge !== 'none' && s.image.edgeAuto && s.image.shape === 'rect') want.add('salty-edge-auto');
    }
    // 바뀐 클래스만 만지기 (전부 뗐다 붙이면 매번 화면 전체를 다시 그림)
    const cls = document.body.classList;
    const cutoutBefore = cls.contains('salty-cutout-same');
    [...cls].filter(c => (c === 'salty' || c.startsWith('salty-')) && !want.has(c)).forEach(c => cls.remove(c));
    want.forEach(c => { if (!cls.contains(c)) cls.add(c); });
    // 컷 취급이 바뀌면 이미 분류한 그림의 .salty-cutout 을 다시 정해야 한다 (스위치를 누른 순간 채팅에 바로 보이게)
    if (cutoutBefore !== cls.contains('salty-cutout-same')) classifyAll();

    syncSamples(s);

    applyFonts(s);
    syncFeatures(s); // 3.1.0 켤 때만 불러오는 기능 (features.js)
}
