// 11-11 「심플 새 틀」(클래스 + 틀 안 <style> 하나로 된 새 글꾸 틀 · 시안 → 이식판)을 글꾸 마트가 받는 길이에요. DOM 없는 순수 모듈(node 시험 — tools/geulkku-simple-test.mjs).
//   설계: W/outputs/지시-1110/심플-새틀-이식/이식-설계.md 1절 · 틀-계약.md · 보고 마트-길닦기.md
//   ① 캐릭터 색 다시 칠하기(toneSimple) — 틀 <style> 의 「색 블록」(화자 색 + 소품 톤)만 갈아 끼우고, 낮 · 밤은 뿌리 클래스만 바꿔요.
//      화자 색: 그 화자의 색이 틀을 만든 색 그대로면 시안 규칙을 한 글자도 안 바꾸고(사용자가 합격시킨 색), 다른 색이면 시안 식(HSL 명도 맞춤 4.6 · 띠 rgba .18)으로 만들어요.
//      소품 톤: 테마와 같은 톤 사다리(lib/log-copy/shared/char-tone.js toneLadder — 테마 codex/tone-ladder-113 사본 · 시안 tones 와 같은 값).
//   ② 「HTML 복사」(simpleReady) — 틀 <style> 과 마트가 넣는 규칙(코멘트 빈칸 · 16px 간격 · 그림 규칙)을 <style> 하나로 합쳐 감싸는 div 첫 자식으로 · 고칠 자리에 「✎」 주석.
//   ③ 카드 미리보기 상태(peekSimple) — 처음엔 닫힌 틀은 미리보기만 열린 판(details open + data-bl-peek). 복사 글은 mart.js shutPeek 가 원래(닫힌) 상태로.
//   11-11 사용자 「마트에 옛날것들 다 없애라」 — 글꾸 마트 목록(data/geulkku/index.json)은 이제 심플 새 틀만이에요(tools/geulkku-simple.mjs 가 써요).
// char-tone.js 는 꼬리를 달아 불러요 — 톤 사다리가 들어가기 전 사본이 캐시에 남아 있으면 이름을 못 찾아 마트 전체가 멈추니까요(같은 파일을 꼬리 없이 부르는 tone-geulkku.js 는 그대로)
import { toneLadder, bandColor, speakerColor, tone, NEUTRAL_LADDER } from './lib/log-copy/shared/char-tone.js?v=20261111a';
import { kkangtongReady } from './tone-geulkku.js?v=20261110v';


/**
 * 틀 계약 가운데 이식판이 정한 값 · 아직 안 정한 값(이식판이 바뀌면 여기만 맞춰요).
 *   blockSep  틀 <style> 안 「기본 규칙 / 화자 색 블록 / 소품 색 블록」 사이 구분(이식판 make-isik.cjs 는 빈 줄)
 *   cv        뿌리 gk-cv-<이름> → 그 틀을 만들 때 쓴 캐릭터 색(이식판 VAR · KA · KB)
 *   faces     틀 이름 → 원래 판(orig) · 반대 판(alt)의 [틀 면, 로그 면] — 이식판 faces 표 · tn-n/tn-d 규칙에서 옮겼어요(04 밤 로그 면은 추정).
 *             표에 없는 틀(09~18 · q01~q10)은 그 틀 <style> 에서 읽어요(facesOf)
 *   peek      카드 미리보기에서 열어 둘 틀(설명서 9-1 · D4: 01 열림 · 05 우린 판 · 07 켠 판 · 08 열림) — 새 틀은 tools/geulkku-simple.mjs DEFS 의 peek 로
 *   tagMix    다른 색 화자의 소리 이름표 바탕 = 그 판 바탕 위에 화자색을 이만큼(밝은 판 .11 · 어두운 판 .15 — 시안 파랑 · 분홍 이름표에 가까운 값 · 시안은 식 없이 손으로 맞춤)
 *   mainOrder 주인공 화자 글자 차례(M 이 있으면 M, 없으면 A)
 *   ink       바탕 종류별 본문 글자색(캐릭터 없음일 때 이름 글자 · 마트 카드 자리 그림)
 */
export const SIMPLE_CONTRACT = Object.freeze({
    blockSep: '\n\n',
    cv: Object.freeze({ bl: '#3aa7ff', pk: '#ff5fa2', mt: '#3ccfbf', yl: '#f0d878', pp: '#b799e8' }),
    faces: Object.freeze({
        k1: { orig: ['#fbfbfa', '#fbfbfa'], alt: ['#25272b', '#25272b'] },
        k2: { orig: ['#ffffff', '#f5f5f6'], alt: ['#25272b', '#1c1e21'] },
        k3: { orig: ['#f8f9fa', '#f8f9fa'], alt: ['#25272b', '#25272b'] },
        k4: { orig: ['#ffffff', '#ffffff'], alt: ['#25272b', '#1c1e21'] },
        k5: { orig: ['#fbfaf7', '#f3f1ec'], alt: ['#25272b', '#1c1e21'] },
        k6: { orig: ['#25272b', '#1c1e21'], alt: ['#ffffff', '#f5f5f6'] },
        k7: { orig: ['#1f2124', '#1f2124'], alt: ['#fbfbfa', '#fbfbfa'] },
        k8: { orig: ['#13233b', '#0d1a2d'], alt: ['#ffffff', '#f5f5f6'] },
    }),
    peek: Object.freeze(['k1', 'k5', 'k7', 'k8']),
    // 사다리 밖 단계(시안 식 — 캐릭터 색 HSL 의 채도 ×s · 명도 ×l): 09 지퍼 밤 안감(시안 ZLIN_N · 파랑 → #0a1b28) · 캐릭터 없음은 무채 c500 에 같은 식
    extraSteps: Object.freeze([Object.freeze({ s: 0.6, l: 0.16 })]),
    tagMix: Object.freeze({ light: 0.11, dark: 0.15 }),
    mainOrder: Object.freeze(['M', 'A']),
    ink: Object.freeze({ 'gk-tl': '#26272b', 'gk-td': '#e1e1e5', 'gk-tx': '#e4e9f0' }),
});
const BASES = ['gk-tl', 'gk-td', 'gk-tx'];
// 「기본 색」 틀: 뿌리에 이 class 가 있으면 소품이 고정 기본 색 · 없으면 화자 색 톤(묶음 틀 sk-own · 마트 접두 gk-own 둘 다 받아요)
const OWN_CLASS = /^(?:sk|gk)-own$/;
const OWN_SEL = /\.(?:sk|gk)-own(?![\w-])/;
/** 그 틀에 「기본 색」 판이 있는가(뿌리 class) */
export const hasOwnTone = html => /^\s*<div\b[^>]*\sclass="gk\s[^"]*\b(?:sk|gk)-own\b/.test(String(html ?? ''));
const TN = ['gk-tn-d', 'gk-tn-n'];
const FRAME_KEY = /^gk-((?:k|q)\d+)$/;
// 화자 표시 클래스 = gk-<소문자><대문자 한 글자>: nA 이름 · dA 띠 · sA 소리 이름표 · uA 밑줄 · 그 밖의 것(04 의 cA 커서처럼)은 「그 화자 색 포인트」
const SPEAKER_SEL = /\.gk-[a-z]+[A-Z](?![\w-])|media-controls-timeline/;
const SPEAKER_CLASS = /^gk-([a-z]+)([A-Z])$/;
const OWN_TYPES = ['n', 'd', 's', 'u'];
const HEX6 = /(?:#|%23)[0-9a-f]{6}(?![0-9a-f])/gi;   // 그림(data-URL) 안의 %23rrggbb 도(09 지퍼 쐐기)

/** 진행 선 색 필터 — tools/song-templates.cjs lineFilter 와 같은 식(시험이 두 식의 값을 맞대 봐요 · 실측 민트 · 분홍에 맞춘 계산 · 마트-설계 7-4) */
export const lineFilter = (hex) => {
    const m = /^#?([0-9a-f]{6})/i.exec(String(hex || '')); if (!m) return '';
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, L = (mx + mn) / 2;
    if (d < 0.08) return '';
    const H = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    const rot = Math.round(((H - 53) % 360 + 360) % 360), br = Math.min(1.15, Math.max(0.8, 0.52 + 0.765 * L));
    return `invert(${L >= 0.6 ? '.5' : '.55'}) sepia(1) saturate(9) hue-rotate(${rot}deg) brightness(${Number(br.toFixed(2))})`;
};

// ── 시안 색 식(심플-새틀-시안/make-isik.cjs 의 fit 과 같은 식 — 시험이 시안 05 · 07 값으로 맞대 봐요) ──
const h2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2h = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
function toHsl(hex) {
    const [r, g, b] = h2rgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const hue = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [hue * 60, sat, l];
}
function fromHsl(h, sat, l) {
    const f = n => { const k = (n + h / 30) % 12, a = sat * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return rgb2h([f(0), f(8), f(4)]);
}
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = hex => { const [r, g, b] = h2rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** 시안 글자 맞춤: 같은 색상 · 채도에서 HSL 명도만 바탕 반대쪽으로 0.01씩 옮겨 대비 want 까지 */
export function sianFit(C, bg, want = 4.6) {
    let [h, sat, l] = toHsl(C); const dir = lum(bg) > 0.4 ? -0.01 : 0.01;
    for (let i = 0; i < 100 && ratio(fromHsl(h, sat, l), bg) < want; i++) l = Math.min(1, Math.max(0, l + dir));
    return fromHsl(h, sat, l);
}
const mix = (K, bg, a) => { const k = h2rgb(K), b = h2rgb(bg); return rgb2h(k.map((v, i) => v * a + b[i] * (1 - a))); };
const sianBand = K => `rgba(${h2rgb(K).join(',')},.18)`;

// 뿌리 캐릭터 색 클래스의 꼬리: gk-cv-<깡통>[-<깡캐 색 6자 | x>[-<소품 색 6자>]] — 깡캐 · 소품 색을 따로 고른 판끼리 한 글에서 안 부딪히게
const CV_TAIL = /(?:-(?:[0-9a-f]{6}|x)){1,2}$/;
// 뿌리 div 여는 태그 + 바로 안 첫 <style>
const ROOT_RE = /^(\s*)<div\b([^>]*?)\sclass="(gk(?:\s[^"]*)?)"([^>]*)>(\s*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>/;

/** CSS 덩이 → 규칙 글 목록(맨 위 단계에서 나눠요 · 따옴표 안 { } 는 그대로) */
function rulesOf(css) {
    const out = []; let depth = 0, quote = '', start = 0;
    for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { out.push(css.slice(start, i + 1).trim()); start = i + 1; } }
    }
    return out.filter(Boolean);
}
const selOf = rule => rule.slice(0, rule.indexOf('{'));
const bodyOf = rule => rule.slice(rule.indexOf('{'));
const modeOf = base => (base === 'gk-tl' ? 'light' : 'dark');
const cvNameOf = K => (K ? K.slice(1) : 'none');
/** 한 선택자(쉼표로 나눈 하나)가 가리키는 화자 글자들(진행 선 규칙은 소리 카드 화자) */
const speakersOfSel = (item, soundX) => (/media-controls-timeline/.test(item) ? [soundX || '?'] : [...item.matchAll(/\.gk-[a-z]+([A-Z])(?![\w-])/g)].map(m => m[1]));

/** 틀 HTML 을 읽어요: 뿌리 클래스 · 틀 이름(k1 · q01 …) · 바탕(tl/td/tx) · 캐릭터 색 클래스 · <style> 세 덩이 · 화자 · 소리 카드. 심플 새 틀 꼴이 아니면 null */
export function simpleFrameInfo(html) {
    const text = String(html ?? '');
    const m = text.match(ROOT_RE);
    if (!m) return null;
    const classes = m[3].split(/\s+/).filter(Boolean);
    const key = (classes.map(c => (c.match(FRAME_KEY) || [])[1]).find(Boolean)) || '';
    const no = /^k\d+$/.test(key) ? Number(key.slice(1)) : 0;
    const base = classes.find(c => BASES.includes(c)) || null;
    const cvClass = classes.find(c => /^gk-cv-[\w-]+$/.test(c)) || null;
    const cvName = cvClass ? cvClass.slice(6) : null;
    // 상대 색을 따로 칠한 판은 이름 끝에 「-<상대 색 6자>」가 붙어요(gk-cv-bl-d19cff) — 주인공 색은 그 앞부분
    const cvMain = cvName == null ? null : cvName.replace(CV_TAIL, '');
    const K0 = cvName == null ? undefined : cvMain === 'none' ? null : SIMPLE_CONTRACT.cv[cvMain] || (/^[0-9a-f]{6}$/.test(cvMain) ? `#${cvMain}` : undefined);
    const css = m[6].replace(/^\n/, '').replace(/\n$/, '');
    const parts = css.split(SIMPLE_CONTRACT.blockSep);
    const rest = text.slice(m.index + m[0].length);
    const used = new Set();
    for (const [, v] of rest.matchAll(/\sclass="([^"]*)"/g)) for (const c of v.split(/\s+/)) if (c) used.add(c);
    const speakers = [...new Set([...used].map(c => (c.match(SPEAKER_CLASS) || [])[2]).filter(Boolean))].sort();
    // 그 밖의 화자 표시(n · d · s · u 말고): 종류 → 원래 색 블록에서 그 종류가 칠한 색 속성들
    const extra = {};
    for (const r of rulesOf(parts.slice(1).join('\n'))) {
        for (const item of selOf(r).split(',')) {
            const t = (item.trim().match(/\.gk-([a-z]+)[A-Z]$/) || [])[1];
            if (!t || OWN_TYPES.includes(t)) continue;
            const props = extra[t] ??= new Set();
            for (const d of bodyOf(r).slice(1, -1).split(';')) { const k = d.split(':')[0].trim(); if (/color$/.test(k) && k !== '-webkit-text-fill-color') props.add(k); }
        }
    }
    const soundBy = [...rest.matchAll(/\sclass="[^"]*\bgk-sn\s+gk-s([A-Z])\b[^"]*"/g)].map(x => x[1]);
    return { key, no, base, classes, cvClass, cvName, K0, css, parts, base_css: parts[0], color_css: parts.slice(1).join('\n'), speakers, extra, soundBy, used, imageBand: /\.gk-d[A-Z]\{background-image:/.test(parts.slice(1).join('\n')), audio: /<audio\b/.test(rest), match: m };
}

/** 원래 판 · 반대 판의 [틀 면, 로그 면] — 표(SIMPLE_CONTRACT.faces)에 없으면 그 틀 <style> 에서 읽어요 */
export function facesOf(info, origBase) {
    if (SIMPLE_CONTRACT.faces[info.key]) return SIMPLE_CONTRACT.faces[info.key];
    const k = info.key.replace(/[^\w-]/g, ''), all = rulesOf(info.css);
    const find = (re) => {
        for (const r of all) for (const item of selOf(r).split(',')) if (re.test(item.trim())) { const v = (bodyOf(r).match(/background-color:\s*(#[0-9a-f]{6})/i) || [])[1]; if (v) return v.toLowerCase(); }
        return null;
    };
    const cv = '(?:\\.gk-cv-[\\w-]+)?', b = `(?:\\.${origBase})?`;
    const oc = find(new RegExp(`^\\.gk-${k}${cv}${b}$`)), ol = find(new RegExp(`^\\.gk-${k}${cv}${b} \\.gk-lg$`));
    const ac = find(new RegExp(`^\\.gk-${k}${cv}\\.gk-tn-[nd]$`)), al = find(new RegExp(`^\\.gk-${k}${cv}\\.gk-tn-[nd] \\.gk-lg$`));
    const light = modeOf(origBase) === 'light';
    const def = dark => (dark ? ['#25272b', '#1c1e21'] : ['#ffffff', '#f5f5f6']);
    return { orig: [oc || def(!light)[0], ol || oc || def(!light)[1]], alt: [ac || def(light)[0], al || ac || def(light)[1]] };
}

/** 원래 색 블록에서 화자마다 그 틀이 쓴 대사색(띠 rgba 의 색 · 없으면 null) */
function speakerColorsOf(colorCss) {
    const out = {};
    for (const r of rulesOf(colorCss)) {
        // 띠는 알파 .18 바탕색 — 색만 읽어요 · 13 형광펜처럼 띠를 그림으로 그으면 그림 안 rgb%28r,g,b%29 에서
        const m = r.match(/\.gk-d([A-Z])\{background-color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/) || r.match(/\.gk-d([A-Z])\{background-image:[^}]*?rgba?%28(\d+),(\d+),(\d+)/);
        if (m && !(m[1] in out)) out[m[1]] = speakerColor(`rgb(${m[2]}, ${m[3]}, ${m[4]})`);
    }
    return out;
}

/** 한 판(바탕 하나)의 화자 색 규칙 — 색이 바뀐 화자만(시안 식) */
function speakerRules({ sel, base, mode, card, log, speakers, colors, used, extra = {} }) {
    const out = [], dark = mode === 'dark';
    const neutral = tone(null, { mode });
    for (const X of speakers) {
        const K = colors[X] ?? null;
        const name = K ? sianFit(K, log) : SIMPLE_CONTRACT.ink[base] || neutral.text;
        const rule = sianFit(K || NEUTRAL_LADDER.c500, card);
        const tag = mix(K || NEUTRAL_LADDER.c500, dark ? log : '#ffffff', SIMPLE_CONTRACT.tagMix[dark ? 'dark' : 'light']);
        const tagInk = K ? sianFit(K, tag) : name;
        if (used.has(`gk-d${X}`)) out.push(`${sel} .gk-d${X}{background-color:${K ? sianBand(K) : bandColor(null, mode)}}`);
        if (used.has(`gk-n${X}`)) out.push(`${sel} .gk-nm.gk-n${X}{color:${name};-webkit-text-fill-color:${name}}`);
        if (used.has(`gk-s${X}`)) out.push(`${sel} .gk-sn.gk-s${X}{color:${tagInk};-webkit-text-fill-color:${tagInk};background-color:${tag}}`);
        if (used.has(`gk-u${X}`)) out.push(`${sel} .gk-u${X}{background-color:${rule}}`);
        // 그 밖의 화자 표시: 글자색이면 이름과 같은 값, 면 · 선 색이면 밑줄과 같은 값
        for (const [t, props] of Object.entries(extra)) {
            if (!used.has(`gk-${t}${X}`) || !props.size) continue;
            out.push(`${sel} .gk-${t}${X}{${[...props].map(k => (k === 'color' ? `color:${name};-webkit-text-fill-color:${name}` : `${k}:${rule}`)).join(';')}}`);
        }
    }
    return out;
}

/** 지금 뿌리 클래스에서 원래 판 바탕을 알아내요(뿌리에 tn-* 가 있으면 지금은 반대 판) */
function originalBase(info) {
    if (!info.classes.some(c => TN.includes(c))) return info.base;
    if (info.base !== 'gk-tl') return 'gk-tl';
    return new RegExp(`\\.gk-tx(?![\\w-])`).test(info.css) ? 'gk-tx' : 'gk-td';
}

/**
 * 심플 새 틀을 캐릭터 색 K 로 다시 칠해요(낮 · 밤은 뿌리 클래스만 바꿔요).
 * @param {string} html 틀 HTML(조각의 preview — 원래 판)
 * @param {string|null} K 캐릭터 대사색(없으면 무채 사다리)
 * @param {{ mode?: 'light'|'dark', main?: string, other?: string|null, prop?: string|null }} [options] main: 주인공 화자 글자(없으면 M → A) · other: 상대(주인공이 아닌 화자) 대사색 — 없으면 틀이 정해 둔 색 그대로
 *   prop: 소품 색(톤 사다리의 씨앗)을 깡통 색과 따로 — 없으면 깡통 색을 따라가요(11-11 조절 칸)
 *   own: 「기본 색」이 있는 틀(뿌리 class sk-own · gk-own — 소품이 제 색)에서 false 면 그 class 를 떼어 소품을 캐릭터 색 톤으로 · 그 밖에는 틀 그대로(기본 색 먼저)
 * @returns {string} 꼴이 아니면 받은 그대로
 */
/** 「원래 색」 표시 — toneSimple(html, ORIGINAL, { mode }) 는 틀을 만든 색 그대로(캐릭터 색 클래스 이름까지 이식판 글자 그대로) 낮 · 밤만 바꿔요 */
export const ORIGINAL = Symbol('원래 색');
/**
 * 11-11 독립 점검 2 — 깡통은 summary 뒤마다 <div><br></div> 를 끼우고 사이트 details 에 여백을 줘요. 그 막는 규칙이 없는 틀(첫 심플 26틀)에만
 *   div.gk-키 details>summary~:not([class]){display:none} · div.gk-키 details{margin:0} 을 붙여요(div. 붙인 낮은 우선 — 틀이 제 여백을 정해 두었으면 그쪽이 이겨요).
 */
function kkGuard(html, key) {
    const text = String(html ?? '');
    if (!key || !/<details\b/.test(text)) return '';
    const css = text.slice(0, text.indexOf('</style>')), out = [];
    if (!/details>summary~:not\(\[class\]\)\{display:none/.test(css)) out.push(`div.gk-${key} details>summary~:not([class]){display:none}`);
    if (!/details\{margin:0/.test(css)) out.push(`div.gk-${key} details{margin:0}`);
    return out.length ? `\n${out.join('\n')}` : '';
}
export function toneSimple(html, K, { mode = 'dark', main, other, prop, own } = {}) {
    const info = simpleFrameInfo(html);
    if (!info || !info.key || !info.base || info.K0 === undefined) return html;
    const original = K === ORIGINAL;
    const k = original ? info.K0 : speakerColor(K);
    const origBase = originalBase(info), faces = facesOf(info, origBase);
    const origMode = modeOf(origBase), want = mode === 'light' ? 'light' : 'dark';
    const alt = origBase === 'gk-tl' ? 'gk-td' : 'gk-tl';
    const nowBase = want === origMode ? origBase : alt;
    const nowTn = want === origMode ? null : (want === 'dark' ? 'gk-tn-n' : 'gk-tn-d');
    // 11-11 상대 색(사용자 「왜 친구 글자색은 안바뀜?」): 고르면 주인공이 아닌 화자를 그 색으로 — 주인공과 같은 식(이름 · 띠 · 밑줄 · 이름표). 안 고르면 한 글자도 안 달라져요
    const k2 = speakerColor(other) || null;
    const kp = speakerColor(prop) || null;   // 소품 색을 따로 골랐을 때만
    const cvBase = original && info.cvClass ? info.cvClass.replace(CV_TAIL, '') : `gk-cv-${cvNameOf(k)}`;
    const cv = kp ? `${cvBase}-${k2 ? k2.slice(1) : 'x'}-${kp.slice(1)}` : k2 ? `${cvBase}-${k2.slice(1)}` : cvBase;   // 같은 틀을 상대 색만 달리해 한 글에 둘 붙여도 안 부딪혀요
    const renameCv = s => (info.cvClass ? s.split(`.${info.cvClass}`).join(`.${cv}`) : s);
    // ① 뿌리 클래스: gk 바로 뒤에 바탕 · 낮밤, 캐릭터 색 클래스는 새 색 이름
    const kept = info.classes.filter(c => c !== 'gk' && !BASES.includes(c) && !TN.includes(c) && !(own === false && OWN_CLASS.test(c))).map(c => (c === info.cvClass ? cv : c));
    const rootClass = ['gk', nowBase, nowTn, ...kept].filter(Boolean).join(' ');
    // ② 화자 색: 색이 그대로인 화자는 시안 규칙 그대로 · 바뀐 화자만 새로
    const colors0 = speakerColorsOf(info.color_css);
    // 주인공 = 틀을 만든 캐릭터 색(gk-cv-…)과 같은 색인 화자(03 바인더는 분홍 B) → 없으면 M → A
    const mainX = main || info.speakers.find(X => info.K0 && colors0[X] === info.K0) || SIMPLE_CONTRACT.mainOrder.find(x => info.speakers.includes(x)) || info.speakers[0];
    const colors = Object.fromEntries(info.speakers.map(X => [X, X === mainX ? k : (k2 || (colors0[X] ?? null))]));
    const same = X => X !== '?' && (colors[X] ?? null) === (colors0[X] ?? null);
    const soundX = info.soundBy[0];
    const keepSpeaker = (r) => {   // 화자 규칙 하나 → 그대로 둘 선택자만 남긴 규칙(없으면 null)
        const items = selOf(r).split(',').filter(item => speakersOfSel(item, soundX).every(same));
        return items.length ? renameCv(items.join(',')) + bodyOf(r) : null;
    };
    const changed = info.speakers.filter(X => !same(X));
    const sel = b => `.gk-${info.key}.${cv}.${b}`;
    // 띠를 그림으로 긋는 틀(13 형광펜)은 띠 바탕색 규칙을 새로 만들지 않아요(그림 규칙의 색만 바꿔요)
    const used = info.imageBand ? new Set([...info.used].filter(c => !/^gk-d[A-Z]$/.test(c))) : info.used;
    const fresh = [
        ...speakerRules({ sel: sel(origBase), base: origBase, mode: origMode, card: faces.orig[0], log: faces.orig[1], speakers: changed, colors, used, extra: info.extra }),
        ...speakerRules({ sel: sel(alt), base: alt, mode: origMode === 'light' ? 'dark' : 'light', card: faces.alt[0], log: faces.alt[1], speakers: changed, colors, used, extra: info.extra }),
    ];
    if (info.audio && soundX && !same(soundX)) { const lf = lineFilter(colors[soundX]); if (lf) fresh.push(`.gk-${info.key}.gk-${info.key}.gk-${info.key}.${cv} audio::-webkit-media-controls-timeline{filter:${lf}!important}`); }
    // ③ 소품 톤: 옛 색에서 나온 값 → 새 색에서 나온 값(값만 바꿔요 · 색 블록 안 화자 규칙(05 · 07 의 M)은 ② 와 같은 기준)
    //    바꾸는 값: 톤 사다리 다섯 · 사다리 밖 단계(SIMPLE_CONTRACT.extraSteps — 09 밤 안감) · 바탕별 글자 맞춤 값(q10 레벨 글자) — #rrggbb 와 그림 안 %23rrggbb 둘 다
    //    + 바뀐 화자 색의 rgb 셋(키프레임 · 그림 안 — 15 요람 띠 번쩍임 · 13 형광 띠)
    const swap = new Map(), put = (a, b) => { if (a && b && !swap.has(a.toLowerCase())) swap.set(a.toLowerCase(), b.toLowerCase()); };
    const from = toneLadder(info.K0), to = toneLadder(kp || k);
    for (const step of Object.keys(from)) put(from[step], to[step]);
    const seed0 = info.K0 || NEUTRAL_LADDER.c500, seed1 = kp || k || NEUTRAL_LADDER.c500;
    for (const { s, l } of SIMPLE_CONTRACT.extraSteps) { const [h0, s0, l0] = toHsl(seed0), [h1, s1, l1] = toHsl(seed1); put(fromHsl(h0, s0 * s, l0 * l), fromHsl(h1, s1 * s, l1 * l)); }
    for (const bg of [...faces.orig, ...faces.alt, '#ffffff']) put(sianFit(seed0, bg), sianFit(seed1, bg));
    // 상대 색을 골랐으면 상대의 옛 색 그대로 칠한 소품(15 요람 공 · 17 바람개비 날개처럼)과 바탕별 글자 맞춤 값도 새 상대 색으로
    if (k2) for (const X of info.speakers) {
        if (X === mainX || !colors0[X] || colors0[X] === k2) continue;
        put(colors0[X], k2);
        for (const bg of [...faces.orig, ...faces.alt, '#ffffff']) put(sianFit(colors0[X], bg), sianFit(k2, bg));
    }
    const rgbOf = K0 => h2rgb(K0 || NEUTRAL_LADDER.c500).join(',');
    const swapRgb = body => changed.reduce((b, X) => (colors0[X] ? b.split(`(${rgbOf(colors0[X])},`).join(`(${rgbOf(colors[X])},`).split(`rgb%28${rgbOf(colors0[X])}%29`).join(`rgb%28${rgbOf(colors[X])}%29`) : b), body);
    const swapHex = body => body.replace(HEX6, (h) => { const pre = h[0] === '#' ? '#' : '%23', v = swap.get(`#${h.slice(pre.length).toLowerCase()}`); return v ? pre + v.slice(1) : h; });
    const imageBand = r => /^\{background-image:/.test(bodyOf(r)) && /\.gk-d[A-Z](?![\w-])/.test(selOf(r));
    const chunk = css => rulesOf(css).map((r) => {
        if (imageBand(r)) return renameCv(selOf(r)) + swapRgb(bodyOf(r));   // 그림으로 그은 띠(13 형광펜): 색만 바꿔 남겨요(긋는 움직임 그대로)
        if (SPEAKER_SEL.test(selOf(r))) return keepSpeaker(r);
        if (OWN_SEL.test(selOf(r))) return renameCv(selOf(r)) + bodyOf(r);   // 기본 색 줄(뿌리 sk-own 일 때만 걸리는 고정값)은 값이 사다리 값과 우연히 같아도 안 바꿔요
        return renameCv(selOf(r)) + swapRgb(swapHex(bodyOf(r)));
    }).filter(Boolean);
    const spk = [...chunk(info.parts[1] || ''), ...fresh];
    const propCss = info.parts.slice(2).flatMap(chunk);
    const css = [info.base_css, spk.join('\n'), propCss.join('\n')].filter(Boolean).join(SIMPLE_CONTRACT.blockSep);
    const m = info.match;
    let out = `${m[1]}<div${m[2]} class="${rootClass}"${m[4]}>${m[5]}<style>\n${css}\n</style>` + html.slice(m.index + m[0].length);
    // ④ 소리 카드 단추 색(깡통 기본은 어두운 판 — 밝은 판은 light 를 꼭 적어요)
    out = out.replace(/(<audio\b[^>]*\sstyle="[^"]*color-scheme:)(light|dark)/g, `$1${want}`);
    return out;
}

/** 그 틀의 화자 색 한 쌍 — { main: 깡통(틀 캐릭터 색 · 없으면 null), other: 깡캐(틀이 정해 둔 상대 색 · 없으면 null) } */
export function speakerPair(html) {
    const info = simpleFrameInfo(html);
    if (!info || info.K0 === undefined) return { main: null, other: null };
    const colors0 = speakerColorsOf(info.color_css);
    const mainX = info.speakers.find(X => info.K0 && colors0[X] === info.K0) || SIMPLE_CONTRACT.mainOrder.find(x => info.speakers.includes(x)) || info.speakers[0];
    return { main: info.K0 || null, other: colors0[info.speakers.find(X => X !== mainX)] || null };
}
/** 소품 색을 따로 줄 수 있는 틀인가 — 소품 톤(사다리 값)이 하나라도 있는 틀만(없으면 조절 칸에 「소품」 칸을 안 보여요) */
export function hasPropTone(html) {
    const bare = s => s.slice(0, s.indexOf('</style>')).replace(/gk-cv-[\w-]+/g, '');
    return bare(toneSimple(html, ORIGINAL, { mode: 'light' })) !== bare(toneSimple(html, ORIGINAL, { mode: 'light', prop: '#00c853' }));
}

/** 카드 미리보기용: 처음엔 닫힌 틀의 첫 details 를 열어 둬요(open 을 안 주면 SIMPLE_CONTRACT.peek) — data-bl-peek 표시라 복사 글은 mart.js shutPeek 가 다시 닫아요 */
export function peekSimple(html, open) {
    const info = simpleFrameInfo(html);
    const on = open ?? (info ? SIMPLE_CONTRACT.peek.includes(info.key) : false);
    if (!info || !on) return String(html ?? '');
    return String(html).replace(/<details\b(?![^>]*\sopen(?:=|\s|>))([^>]*)>/, '<details$1 open="" data-bl-peek="">');
}

/** 틀 안 첫 <style> 을 뿌리 div 앞으로 꺼내요(그러면 마트 「HTML 복사」 정리 pasteReady 가 맨 앞 <style> 로 읽고 자기 규칙과 하나로 합쳐요) */
export function hoistStyle(html) {
    const text = String(html ?? '');
    const m = text.match(ROOT_RE);
    if (!m) return text;
    return `${m[1]}<style>${m[6]}</style><div${m[2]} class="${m[3]}"${m[4]}>${m[5]}` + text.slice(m.index + m[0].length).replace(/^\n/, '');
}

/**
 * 복사 글에서 사람이 고칠 자리 — 그 클래스가 붙은 요소 바로 앞에 짧은 「✎」 주석을 달아요(화면에는 안 보여요).
 * 새 틀(09~ · q01~)에 고칠 글자가 든 소품이 있으면 여기에 한 줄 더해요.
 */
export const EDIT_MARKS = Object.freeze([
    ['gk-tt', '제목'],
    ['gk-nr', '지문'],
    ['gk-nm', '화자 이름'],
    ['gk-dl', '대사'],
    ['gk-sd', '소리 카드 — 이름표 글자 · audio 의 src(mp3 주소)'],
    ['gk-hl', '숨은 한 줄(찻물이 차면 나와요)'],
]);
const MARK_HEAD = '<!-- ▲ 위 스타일 칸은 틀 모양 · 색이에요(고치지 않아도 돼요) · ▼ 아래는 글 — 「✎」 주석 바로 뒤 요소의 글자만 바꿔요 · 대사 · 지문 줄은 복사해 늘리거나 지워도 돼요 -->';
/** 「숨은 한 줄」(gk-hl)이 있는 틀 — 15 요람의 gk-hl 은 공 빛 조각이라 주석을 안 달아요(테마 markEdits 의 skip 과 같은 규칙) */
export const HIDDEN_LINE_FRAMES = Object.freeze(['k5']);
const frameKeyOf = html => (String(html ?? '').match(/\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || '';
/** 고칠 자리 주석 달기(이미 달았으면 그대로) · skip: 이 틀에서는 안 달 클래스(테마 markEdits 와 같은 꼴) */
export function markEdits(html, { skip = [] } = {}) {
    const text = String(html ?? '');
    if (text.includes('「✎」')) return text;
    const at = text.indexOf('</style>');
    if (at < 0) return text;
    const head = text.slice(0, at + 8), body = text.slice(at + 8);
    const marks = new Map(EDIT_MARKS.filter(([cls]) => !skip.includes(cls)));
    const marked = body.replace(/<([a-z][a-z0-9]*)\b([^>]*?)\sclass="([^"]*)"/g, (all, tag, pre, cls, at, whole) => {
        const hit = cls.split(/\s+/).find(c => marks.has(c));
        if (!hit || /<!--\s*✎[^>]*-->\s*$/.test(whole.slice(Math.max(0, at - 200), at))) return all;   // 틀이 이미 단 「✎」 주석(q09 영수증 · q10)은 두 번 안 달아요
        return `<!-- ✎ ${marks.get(hit)} -->${all}`;
    });
    return `${head}\n${MARK_HEAD}${marked.startsWith('\n') ? '' : '\n'}${marked}`;
}

/** 심플 새 틀 「HTML 복사」 글: 틀 <style> + 그림 규칙 + 코멘트 빈칸 · 16px 간격 규칙을 <style> 하나로(감싸는 div 첫 자식) · 위아래 코멘트 빈칸 · 글자색 fill · 고칠 자리 주석 */
/** 복사 글에만: 깡통 빈 줄 · details 여백 막기(kkGuard)를 틀 <style> 끝에 — 마트 미리보기에는 깡통이 끼우는 줄이 없어 안 걸어요 */
const withGuard = (html) => { const g = kkGuard(html, frameKeyOf(html)); if (!g) return html; const at = html.indexOf('\n</style>'); return at < 0 ? html : html.slice(0, at) + g + html.slice(at); };
export const simpleReady = html => markEdits(kkangtongReady(hoistStyle(withGuard(html))), { skip: HIDDEN_LINE_FRAMES.includes(frameKeyOf(html)) ? [] : ['gk-hl'] });
