// 11-11 「심플 새 틀」(클래스 + 틀 안 <style> 하나로 된 새 글꾸 틀 · 시안 → 이식판)을 글꾸 마트가 받는 길이에요. DOM 없는 순수 모듈(node 시험 — tools/geulkku-simple-test.mjs).
//   설계: W/outputs/지시-1110/심플-새틀-이식/이식-설계.md 1절 · 틀-계약.md · 보고 마트-길닦기.md
//   ① 캐릭터 색 다시 칠하기(toneSimple) — 틀 <style> 의 「색 블록」(화자 색 + 소품 톤)만 캐릭터 색 K 에서 다시 계산해 갈아 끼우고, 낮 · 밤은 뿌리 클래스만 바꿔요.
//      톤 사다리는 테마와 같은 식(lib/log-copy/shared/char-tone.js toneLadder — 테마 codex/tone-ladder-113 사본). 이름 글자 = fitInk(K, 그 칸 바탕) · 대사 띠 = bandColor(K, 낮밤).
//   ② 「HTML 복사」(simpleReady) — 틀 <style> 과 마트가 넣는 규칙(코멘트 빈칸 · 16px 간격 · 그림 규칙)을 <style> 하나로 합쳐 감싸는 div 첫 자식으로.
//   ③ 카드 미리보기 상태(peekSimple) — 처음엔 닫힌 틀(01 낫표 · 05 티백 · 07 성냥 · 08 블라인드)은 미리보기만 열린 판(details open + data-bl-peek).
//      복사 글은 mart.js shutPeek 가 원래(닫힌) 상태로 되돌려요.
//   ④ 목록에 넣기(withSimpleFrames) — 깃발 SIMPLE_FRAMES_ENABLED 가 꺼져 있으면 아무것도 안 받고 받은 목록을 그대로 돌려줘요.
// char-tone.js 는 꼬리를 달아 불러요 — 톤 사다리가 들어가기 전 사본이 캐시에 남아 있으면 이름을 못 찾아 마트 전체가 멈추니까요(같은 파일을 꼬리 없이 부르는 tone-geulkku.js 는 그대로)
import { toneLadder, fitInk, bandColor, over, speakerColor, tone, NEUTRAL_LADDER } from './lib/log-copy/shared/char-tone.js?v=20261111a';
import { kkangtongReady } from './tone-geulkku.js?v=20261110v';

/** 깃발: 심플 새 틀을 목록에 보일지. false = 목록 · 개수 · 기존 틀 출력이 깃발을 넣기 전과 같아요(simple-index.json 도 안 받아요) */
export const SIMPLE_FRAMES_ENABLED = false;
/** 심플 새 틀 목록(index.json 과 같은 꼴의 items · categories · chunks) — tools/geulkku-simple.mjs 가 써요 */
export const SIMPLE_INDEX = 'simple-index.json';

/**
 * 틀 계약 가운데 아직 정해지지 않은 것(이식판이 확정되면 여기만 맞춰요).
 *   blockSep  틀 <style> 안 「기본 규칙 / 화자 색 블록 / 소품 색 블록」 사이 구분(이식판 make-isik.cjs 는 빈 줄)
 *   cv        뿌리 gk-cv-<이름> → 그 틀을 만들 때 쓴 캐릭터 색(이식판 VAR · KA · KB) — 색 블록의 톤 값을 이 색의 사다리로 알아봐요
 *   faces     틀 번호 → 원래 판(orig) · 반대 판(alt)의 [틀 면, 로그 면] 바탕(이름 글자 · 밑줄 · 이름표 대비를 맞출 바탕) — 이식판 faces 표 · tn-n/tn-d 규칙에서 옮겼어요(04 밤 로그 면은 추정)
 *   peek      카드 미리보기에서 열어 둘 틀 번호(D4 「추천대로」: 01 열림 · 05 우린 판 · 07 켠 판 · 08 열림)
 *   tagMix    어두운 판 소리 카드 이름표 바탕 = 로그 면 위에 화자색을 이만큼 섞은 색(이식판 #1f3246 · #1c3554 에 가까운 값 · 추정) · 밝은 판은 사다리 c100
 *   speakers  화자 표시 글자(M = 주인공 · A · B …) — 주인공 자리 차례(M 이 있으면 M, 없으면 A)
 */
export const SIMPLE_CONTRACT = Object.freeze({
    blockSep: '\n\n',
    cv: Object.freeze({ bl: '#3aa7ff', pk: '#ff5fa2', mt: '#3ccfbf', yl: '#f0d878', pp: '#b799e8' }),
    faces: Object.freeze({
        1: { orig: ['#fbfbfa', '#fbfbfa'], alt: ['#25272b', '#25272b'] },
        2: { orig: ['#ffffff', '#f5f5f6'], alt: ['#25272b', '#1c1e21'] },
        3: { orig: ['#f8f9fa', '#f8f9fa'], alt: ['#25272b', '#25272b'] },
        4: { orig: ['#ffffff', '#ffffff'], alt: ['#25272b', '#1c1e21'] },
        5: { orig: ['#fbfaf7', '#f3f1ec'], alt: ['#25272b', '#1c1e21'] },
        6: { orig: ['#25272b', '#1c1e21'], alt: ['#ffffff', '#f5f5f6'] },
        7: { orig: ['#1f2124', '#1f2124'], alt: ['#fbfbfa', '#fbfbfa'] },
        8: { orig: ['#13233b', '#0d1a2d'], alt: ['#ffffff', '#f5f5f6'] },
    }),
    peek: Object.freeze([1, 5, 7, 8]),
    tagMix: 0.15,
    mainOrder: Object.freeze(['M', 'A']),
});
const BASES = ['gk-tl', 'gk-td', 'gk-tx'];
const TN = ['gk-tn-d', 'gk-tn-n'];
const SPEAKER_SEL = /\.gk-[ndsu][A-Z](?![\w-])|media-controls-timeline/;
const HEX6 = /#[0-9a-f]{6}(?![0-9a-f])/gi;

/** 진행 선 색 필터 — tools/song-templates.cjs lineFilter 와 같은 식(시험이 두 식의 값을 맞대 봐요 · 실측 민트 · 분홍에 맞춘 계산 · 마트-설계 7-4) */
export const lineFilter = (hex) => {
    const m = /^#?([0-9a-f]{6})/i.exec(String(hex || '')); if (!m) return '';
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, L = (mx + mn) / 2;
    if (d < 0.08) return '';
    const H = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    const rot = Math.round(((H - 53) % 360 + 360) % 360), br = Math.min(1.15, Math.max(0.8, 0.52 + 0.765 * L));
    return `invert(${L >= 0.6 ? '.5' : '.55'}) sepia(1) saturate(9) hue-rotate(${rot}deg) brightness(${Number(br.toFixed(2))})`;
};

// 뿌리 div 여는 태그 + 바로 안 첫 <style>
const ROOT_RE = /^(\s*)<div\b([^>]*?)\sclass="(gk(?:\s[^"]*)?)"([^>]*)>(\s*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>/;

/** 틀 HTML 을 읽어요: 뿌리 클래스 · 틀 번호 · 바탕(tl/td/tx) · 캐릭터 색 클래스 · <style> 세 덩이 · 화자 · 소리 카드. 심플 새 틀 꼴이 아니면 null */
export function simpleFrameInfo(html) {
    const text = String(html ?? '');
    const m = text.match(ROOT_RE);
    if (!m) return null;
    const classes = m[3].split(/\s+/).filter(Boolean);
    const no = Number((classes.find(c => /^gk-k\d$/.test(c)) || '').slice(4)) || 0;
    const base = classes.find(c => BASES.includes(c)) || null;
    const cvClass = classes.find(c => /^gk-cv-[\w-]+$/.test(c)) || null;
    const cvName = cvClass ? cvClass.slice(6) : null;
    const K0 = cvName == null ? undefined : cvName === 'none' ? null : SIMPLE_CONTRACT.cv[cvName] || (/^[0-9a-f]{6}$/.test(cvName) ? `#${cvName}` : undefined);
    const css = m[6].replace(/^\n/, '').replace(/\n$/, '');
    const parts = css.split(SIMPLE_CONTRACT.blockSep);
    const rest = text.slice(m.index + m[0].length);
    const used = new Set();
    for (const [, v] of rest.matchAll(/\sclass="([^"]*)"/g)) for (const c of v.split(/\s+/)) if (c) used.add(c);
    const speakers = [...new Set([...used].map(c => (c.match(/^gk-[ndsu]([A-Z])$/) || [])[1]).filter(Boolean))].sort();
    const soundBy = [...rest.matchAll(/\sclass="[^"]*\bgk-sn\s+gk-s([A-Z])\b[^"]*"/g)].map(x => x[1]);
    return { no, base, classes, cvClass, cvName, K0, css, base_css: parts[0], color_css: parts.slice(1).join('\n'), speakers, soundBy, used, audio: /<audio\b/.test(rest), match: m };
}

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
const modeOf = base => (base === 'gk-tl' ? 'light' : 'dark');
const altBase = base => (base === 'gk-tl' ? 'gk-td' : 'gk-tl');
const cvNameOf = K => (K ? K.slice(1) : 'none');
const rgbaOf = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

/** 원래 색 블록에서 화자마다 그 틀이 쓴 대사색(띠 rgba 의 색 · 없으면 null) */
function speakerColorsOf(colorCss) {
    const out = {};
    for (const r of rulesOf(colorCss)) {
        const m = r.match(/\.gk-d([A-Z])\{background-color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);   // 띠는 알파 .18 — 색만 읽어요
        if (m && !(m[1] in out)) out[m[1]] = speakerColor(`rgb(${m[2]}, ${m[3]}, ${m[4]})`);
    }
    return out;
}

/** 한 판(바탕 하나)의 화자 색 규칙 */
function speakerRules({ sel, mode, card, log, speakers, colors, used }) {
    const out = [], dark = mode === 'dark';
    const neutral = tone(null, { mode });
    for (const X of speakers) {
        const K = colors[X] ?? null;
        const name = K ? fitInk(K, log) : neutral.text;
        const rule = fitInk(K || NEUTRAL_LADDER.c500, card);
        const tag = dark ? over(rgbaOf(K || NEUTRAL_LADDER.c500, SIMPLE_CONTRACT.tagMix), log) : toneLadder(K).c100;
        const tagInk = K ? fitInk(K, tag) : neutral.text;
        if (used.has(`gk-d${X}`)) out.push(`${sel} .gk-d${X}{background-color:${bandColor(K, mode)}}`);
        if (used.has(`gk-n${X}`)) out.push(`${sel} .gk-nm.gk-n${X}{color:${name};-webkit-text-fill-color:${name}}`);
        if (used.has(`gk-s${X}`)) out.push(`${sel} .gk-sn.gk-s${X}{color:${tagInk};-webkit-text-fill-color:${tagInk};background-color:${tag}}`);
        if (used.has(`gk-u${X}`)) out.push(`${sel} .gk-u${X}{background-color:${rule}}`);
    }
    return out;
}

/**
 * 심플 새 틀을 캐릭터 색 K 로 다시 칠해요(낮 · 밤은 뿌리 클래스만 바꿔요).
 * @param {string} html 틀 HTML(조각의 preview — 원래 판이든 이 함수가 칠한 판이든)
 * @param {string|null} K 캐릭터 대사색(없으면 무채 사다리)
 * @param {{ mode?: 'light'|'dark', main?: string }} [options] main: 주인공 화자 글자(없으면 M → A)
 * @returns {string} 꼴이 아니면 받은 그대로
 */
export function toneSimple(html, K, { mode = 'dark', main } = {}) {
    const info = simpleFrameInfo(html);
    if (!info || !info.no || !info.base || info.K0 === undefined) return html;
    const k = speakerColor(K);
    const faces = SIMPLE_CONTRACT.faces[info.no];
    // 원래 판 바탕: 뿌리에 tn-* 가 있으면 지금은 반대 판이에요
    const flipped = info.classes.some(c => TN.includes(c));
    const origBase = flipped ? (info.base === 'gk-tl' ? (info.no === 8 ? 'gk-tx' : 'gk-td') : 'gk-tl') : info.base;
    const origMode = modeOf(origBase), want = mode === 'light' ? 'light' : 'dark';
    const alt = origBase === 'gk-tx' ? 'gk-tl' : altBase(origBase);
    const nowBase = want === origMode ? origBase : alt;
    const nowTn = want === origMode ? null : (want === 'dark' ? 'gk-tn-n' : 'gk-tn-d');
    const cv = `gk-cv-${cvNameOf(k)}`;
    // ① 뿌리 클래스: gk 바로 뒤에 바탕 · 낮밤, 캐릭터 색 클래스는 새 색 이름
    const kept = info.classes.filter(c => c !== 'gk' && !BASES.includes(c) && !TN.includes(c)).map(c => (c === info.cvClass ? cv : c));
    const rootClass = ['gk', nowBase, nowTn, ...kept].filter(Boolean).join(' ');
    // ② 색 블록: 화자 색은 새로 만들고, 소품 톤은 옛 색 사다리 → 새 색 사다리로 바꿔요
    const colors0 = speakerColorsOf(info.color_css);
    const mainX = main || SIMPLE_CONTRACT.mainOrder.find(x => info.speakers.includes(x)) || info.speakers[0];
    const colors = Object.fromEntries(info.speakers.map(X => [X, X === mainX ? k : (colors0[X] ?? null)]));
    const sel = b => `.gk-k${info.no}.${cv}.${b}`;
    const spk = [
        ...speakerRules({ sel: sel(origBase), mode: origMode, card: faces.orig[0], log: faces.orig[1], speakers: info.speakers, colors, used: info.used }),
        ...speakerRules({ sel: sel(alt), mode: origMode === 'light' ? 'dark' : 'light', card: faces.alt[0], log: faces.alt[1], speakers: info.speakers, colors, used: info.used }),
    ];
    const soundK = info.soundBy.length ? colors[info.soundBy[0]] : null;
    const lf = info.audio ? lineFilter(soundK) : '';
    if (lf) spk.push(`.gk-k${info.no}.gk-k${info.no}.gk-k${info.no}.${cv} audio::-webkit-media-controls-timeline{filter:${lf}!important}`);
    const from = toneLadder(info.K0), to = toneLadder(k), swap = new Map();
    for (const step of Object.keys(from)) if (!swap.has(from[step].toLowerCase())) swap.set(from[step].toLowerCase(), to[step]);
    const prop = rulesOf(info.color_css).filter(r => !SPEAKER_SEL.test(selOf(r))).map((r) => {
        const at = r.indexOf('{');
        const s = info.cvClass ? selOf(r).split(`.${info.cvClass}`).join(`.${cv}`) : selOf(r);
        return s + r.slice(at).replace(HEX6, h => swap.get(h.toLowerCase()) ?? h);
    });
    const css = [info.base_css, spk.join('\n'), prop.join('\n')].filter(Boolean).join(SIMPLE_CONTRACT.blockSep);
    const m = info.match;
    let out = `${m[1]}<div${m[2]} class="${rootClass}"${m[4]}>${m[5]}<style>\n${css}\n</style>` + html.slice(m.index + m[0].length);
    // ③ 소리 카드 단추 색(깡통 기본은 어두운 판 — 밝은 판은 light 를 꼭 적어요)
    out = out.replace(/(<audio\b[^>]*\sstyle="[^"]*color-scheme:)(light|dark)/g, `$1${want}`);
    return out;
}

/** 카드 미리보기용: 처음엔 닫힌 틀(SIMPLE_CONTRACT.peek)의 첫 details 를 열어 둬요 — data-bl-peek 표시라 복사 글은 mart.js shutPeek 가 다시 닫아요 */
export function peekSimple(html) {
    const info = simpleFrameInfo(html);
    if (!info || !SIMPLE_CONTRACT.peek.includes(info.no)) return String(html ?? '');
    return String(html).replace(/<details\b(?![^>]*\sopen(?:=|\s|>))([^>]*)>/, '<details$1 open="" data-bl-peek="">');
}

/** 틀 안 첫 <style> 을 뿌리 div 앞으로 꺼내요(그러면 마트 「HTML 복사」 정리 pasteReady 가 맨 앞 <style> 로 읽고 자기 규칙과 하나로 합쳐요) */
export function hoistStyle(html) {
    const text = String(html ?? '');
    const m = text.match(ROOT_RE);
    if (!m) return text;
    return `${m[1]}<style>${m[6]}</style><div${m[2]} class="${m[3]}"${m[4]}>${m[5]}` + text.slice(m.index + m[0].length).replace(/^\n/, '');
}

/** 심플 새 틀 「HTML 복사」 글: 틀 <style> + 그림 규칙 + 코멘트 빈칸 · 16px 간격 규칙을 <style> 하나로(감싸는 div 첫 자식) · 위아래 코멘트 빈칸 · 글자색 fill */
export const simpleReady = html => kkangtongReady(hoistStyle(html));

/**
 * 글꾸 목록(index.json 을 읽은 것)에 심플 새 틀을 붙여요. 깃발이 꺼져 있으면 받은 data 를 그대로(같은 객체) 돌려줘요.
 * @param {{ items, categories, chunks, count }} data
 * @param {{ enabled?: boolean, load?: () => Promise<object> }} [options] load: simple-index.json 을 읽는 함수(시험이 바꿔 끼워요)
 */
export async function withSimpleFrames(data, { enabled = SIMPLE_FRAMES_ENABLED, load } = {}) {
    if (!enabled || !data) return data;
    let extra;
    try { extra = await (load ? load() : fetch(new URL(`./data/geulkku/${SIMPLE_INDEX}`, import.meta.url), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`심플 새 틀 목록 ${r.status}`); return r.json(); })); }
    catch { return data; }   // 못 받으면 원래 목록 그대로
    const rows = (extra?.items || []).filter(x => x && x.id && x.simple);
    if (!rows.length) return data;
    const ids = new Set(rows.map(x => x.id));
    const keep = (data.items || []).filter(x => !ids.has(x.id));
    // 차례: 노래 앨범 뒤(없으면 심플 그림체 끝) — tools/geulkku-song.mjs 의 자리 잡기와 같은 생각
    let at = keep.map(x => x.category).lastIndexOf('song') + 1;
    if (at <= 0) { at = keep.findIndex(x => (x.style || '일러스트') !== '심플'); if (at < 0) at = keep.length; }
    const items = [...keep.slice(0, at), ...rows, ...keep.slice(at)];
    const newCats = (extra.categories || []).filter(c => !(data.categories || []).some(d => d.id === c.id));
    const cats = [...(data.categories || [])];
    const after = cats.findIndex(c => c.id === 'song');
    cats.splice(after >= 0 ? after + 1 : cats.length, 0, ...newCats);
    return { ...data, count: items.length, categories: cats, chunks: { ...(data.chunks || {}), ...(extra.chunks || {}) }, items };
}
