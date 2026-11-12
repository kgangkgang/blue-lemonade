// 11-12 「테마 아직 못 받음」 — 블루레몬 테마 「마트에서 가져오기」가 이 심플 틀을 받는지 마트에서 미리 가려요.
//   테마 받기 검사를 그대로 옮겼어요: src/mart-import.js checkSimple(꼴 · 크기 · 받지 않는 요소) + src/log-copy-simple-frame.js frameFromHtml(로그 칸 · 줄 꼴 · 제목 · 화자 색)
//   + src/log-copy-simple.js checkFrame(등록 값 점검). 테마 분기 codex/builtin-out-review(24eec83f2) 기준 · 받는 틀 357 / 410.
//   시험 tools/geulkku-simple-test.mjs 가 410틀 모두 테마 판정(tools/fixtures/theme-takeable.json · 테마 사본이 있으면 테마 코드를 바로 돌려서도)과 맞대요.
//   테마 쪽 규칙이 바뀌면(받는 틀이 늘면) 여기 · 고정 자료를 같이 고쳐요.
//   쓰는 곳: tools/geulkku-simple.mjs(목록 index.json 의 nt — 못 받는 까닭) · mart.js(내 글꾸 · 크게 보기 「테마로 담기」 칸).
// DOM 없는 순수 모듈.
import { simpleFrameInfo, facesOf, SIMPLE_CONTRACT } from './simple-frames.js?v=20261112b';
import { speakerColor } from './lib/log-copy/shared/char-tone.js?v=20261111a';

export const SAMPLE_TITLE = '비 그친 뒤, 옥상에서';   // 마트 · 테마 공통 견본 제목
export const SIMPLE_HTML_MAX = 60000;                  // 테마 mart-import.js 와 같은 값
const CUSTOM_ID = /^[a-z0-9-]{1,24}$/i, SIMPLE_KEY = /^(?:k|q)\d{1,5}$/;
const SIMPLE_BAD = [
    [/<\/?(?:script|iframe|frame|object|embed|link|meta|base|form|input|textarea|select|button|video|source|track|svg|math|template|portal|img)\b/i, '틀 안에 받지 않는 요소가 있어요'],
    [/\son[a-z]+\s*=/i, '틀 안에 동작 속성(on…)이 있어요'],
    [/javascript:|vbscript:/i, '틀 안에 스크립트 주소가 있어요'],
    [/url\(\s*(?!['"]?data:image\/)/i, '틀 안에 바깥 주소 그림이 있어요(data: 그림만 받아요)'],
    [/@import|expression\s*\(|behavior\s*:/i, '틀 안에 받지 않는 스타일 규칙이 있어요'],
];
const LOG = '{{로그}}', LOG2 = '{{로그:2}}', HIDDEN = '{{숨은줄}}', TITLE = '{{제목}}';
const ROW = /^<p class="gk-(nr|nm|dl)\b/;
const SOUND_LINE = /^<div class="gk-sd">.*<\/div>$/;
const NR = /^<p class="gk-nr">(?:(?!<\/?p\b).)+<\/p>$/;
const NM = /^<p class="gk-nm gk-n[A-Z]">[^<]+<\/p>$/;
const DL = /^(<p class="gk-dl"[^>]*>)<span class="gk-d gk-d[A-Z]">(?:(?!<\/?(?:p|span)\b).)+<\/span><\/p>$/;
const ROW_HEAD = /^<p class="(gk-(?:nr|nm|dl)(?: [\w-]+)*)"/;
const TN = ['gk-tn-d', 'gk-tn-n'];
const MODE_CLASSES = ['gk-tl', 'gk-td', 'gk-tx', 'gk-tn-d', 'gk-tn-n'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 줄 머리의 덤 class 가운데 틀 <style> 이 안 쓰는 것을 떼요(테마 plainRow) */
function plainRow(line, css) {
    const m = line.match(ROW_HEAD);
    if (!m) return line;
    const kept = m[1].split(' ').filter((c, i) => i === 0 || /^gk-n[A-Z]$/.test(c) || new RegExp(`\\.${c}(?![\\w-])`).test(css));
    return `<p class="${kept.join(' ')}"${line.slice(m[0].length)}`;
}
const stripAlias = html => html.replace(/^(\s*<div\b[^>]*\sclass=")([^"]*)"/, (all, a, v) => `${a}${v.split(/\s+/).filter(c => c === 'gk' || c.startsWith('gk-')).join(' ')}"`);
const shutPeek = html => html.replace(/<details\b[^>]*\sdata-bl-peek=""[^>]*>/g, t => t.replace(/\sopen(?:="[^"]*")?(?=[\s>])/, '').replace(/\sdata-bl-peek=""/, ''));
function quietFrame(html) {
    const lines = html.split('\n');
    const kept = lines.filter(line => !SOUND_LINE.test(line));
    if (kept.length === lines.length) return html;
    return kept.join('\n').replace(/^(<div class="gk [^"]*)"/, '$1 gk-noaud"');
}
/** CSS 규칙 나누기(마트 simple-frames.js rulesOf 와 같아요) */
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
function speakerColorsOf(colorCss) {
    const out = {};
    for (const r of rulesOf(colorCss)) {
        const m = r.match(/\.gk-d([A-Z])\{background-color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/) || r.match(/\.gk-d([A-Z])\{background-image:[^}]*?rgba?%28(\d+),(\d+),(\d+)/);
        if (m && !(m[1] in out)) out[m[1]] = speakerColor(`rgb(${m[2]}, ${m[3]}, ${m[4]})`);
    }
    return out;
}
function originalBase(info) {
    if (!info.classes.some(c => TN.includes(c))) return info.base;
    if (info.base !== 'gk-tl') return 'gk-tl';
    return /\.gk-tx(?![\w-])/.test(info.css) ? 'gk-tx' : 'gk-td';
}
/** 테마 simpleFrameInfo 의 K0 — 테마는 상대 색 꼬리(gk-cv-bl-d19cff)를 아직 몰라요(마트 쪽만 떼요) */
const themeK0 = info => (info.cvName == null ? undefined : info.cvName === 'none' ? null : SIMPLE_CONTRACT.cv[info.cvName] || (/^[0-9a-f]{6}$/.test(info.cvName) ? `#${info.cvName}` : undefined));

/** 테마 frameFromHtml 의 판정 부분 — 받을 수 없으면 Error(까닭 한 줄)를 던져요 · 받으면 등록 값 모양 몇 칸 */
function frameCheck(raw, id) {
    const quiet = quietFrame(stripAlias(shutPeek(String(raw ?? '').replace(/\r\n/g, '\n').trim())));
    const info0 = simpleFrameInfo(quiet);
    const info = info0 && { ...info0, K0: themeK0(info0) };
    if (!info?.key || !info.base || info.K0 === undefined) throw new Error('심플 틀 꼴이 아니에요');
    const css = quiet.slice(0, Math.max(0, quiet.indexOf('</style>')));
    const lines = quiet.split('\n').map(line => (ROW.test(line) ? plainRow(line, css) : line));
    const groups = [];
    lines.forEach((line, i) => { if (!ROW.test(line)) return; const g = groups[groups.length - 1]; if (g && g.end === i) g.end = i + 1; else groups.push({ start: i, end: i + 1 }); });
    if (groups.length < 1 || groups.length > 2) throw new Error('로그 칸이 여러 곳으로 나뉜 틀이에요');
    const forms = { 지문: new Set(), 이름: new Set(), 대사: new Set() };
    for (const line of groups.flatMap(g => lines.slice(g.start, g.end))) {
        let m;
        if (NR.test(line)) forms.지문.add('<p class="gk-nr">{{지문}}</p>');
        else if (NM.test(line)) forms.이름.add('<p class="gk-nm gk-n{{화자}}">{{이름}}</p>');
        else if ((m = line.match(DL))) forms.대사.add(`${m[1].replace(/ease-out [\d.]+s both/, 'ease-out {{지연}} both')}<span class="gk-d gk-d{{화자}}">{{대사}}</span></p>`);
        else throw new Error('줄마다 꾸밈이 다른 틀이에요');
    }
    for (const set of Object.values(forms)) if (set.size !== 1) throw new Error('줄마다 꾸밈이 다른 틀이에요');
    const out = [...lines];
    [...groups].reverse().forEach((g, i) => out.splice(g.start, g.end - g.start, groups.length - 1 - i === 0 ? LOG : LOG2));
    let html = out.join('\n');
    if (html.split(`class="gk-tt">${SAMPLE_TITLE}`).length !== 2) throw new Error('제목 자리를 찾지 못했어요');
    html = html.replace(`class="gk-tt">${SAMPLE_TITLE}`, `class="gk-tt">${TITLE}`);
    const hidden = html.match(/<span class="gk-hl">[^<]+<\/span>/g) ?? [];
    if (hidden.length > 1) throw new Error('숨은 한 줄이 여러 곳이에요');
    if (hidden.length) html = html.replace(hidden[0], `<span class="gk-hl">${HIDDEN}</span>`);
    const colors0 = speakerColorsOf(info.color_css);
    const main = info.speakers.find(X => info.K0 && colors0[X] === info.K0) || SIMPLE_CONTRACT.mainOrder.find(x => info.speakers.includes(x)) || info.speakers[0];
    const second = Object.keys(colors0).find(x => x !== main);
    if (!second) throw new Error('상대 화자 색을 찾지 못했어요');
    const base = originalBase(info), faces = facesOf(info, base), light = base === 'gk-tl';
    const ink = SIMPLE_CONTRACT.ink;
    const frame = {
        id, key: info.key, pages: groups.length === 2 ? 2 : 1, hidden: hidden.length > 0, main, second, sample: info.K0,
        roots: { light: light ? base : 'gk-tl gk-tn-d', dark: light ? 'gk-td gk-tn-n' : base },
        paper: {
            light: { card: (light ? faces.orig : faces.alt)[0], log: (light ? faces.orig : faces.alt)[1], text: ink['gk-tl'] },
            dark: { card: (light ? faces.alt : faces.orig)[0], log: (light ? faces.alt : faces.orig)[1], text: ink[light ? 'gk-td' : base] },
        },
        rows: { 지문: [...forms.지문][0], 이름: [...forms.이름][0], 대사: [...forms.대사][0] },
        html,
    };
    const bad = checkFrame(frame);
    if (bad.length) throw new Error(`틀 꼴이 맞지 않아요(${bad.slice(0, 2).join(' · ')})`);
    return frame;
}

/** 테마 checkFrame(등록 값 점검)과 같은 규칙 — 문제 글 목록 */
function checkFrame(f) {
    const bad = [];
    if (!/^[a-z0-9-]{1,24}$/.test(String(f.id ?? ''))) bad.push('id');
    if (!/^[kq]\d+$/.test(String(f.key ?? ''))) bad.push('key');
    const html = String(f.html ?? '');
    const m = html.match(/^\s*<div\b[^>]*\sclass="([^"]*)"[^>]*>\s*<style>((?:(?!<\/?style)[\s\S])*)<\/style>/i);
    const parts = m && { classes: m[1].split(/\s+/).filter(Boolean), blocks: m[2].replace(/^\n/, '').replace(/\n$/, '').split(/\n[ \t]*\n/) };
    if (!parts) bad.push('감싸는 div 의 첫 자식 <style>');
    else {
        if (!parts.classes.includes('gk') || !parts.classes.includes(`gk-${f.key}`)) bad.push(`뿌리 class gk gk-${f.key}`);
        if (parts.blocks.length < 2 || parts.blocks.length > 3) bad.push('<style> 덩이 둘 · 셋(① 기본 · ② 화자 · ③ 소품 — 소품이 없는 틀은 ③ 없음)');
    }
    if ((html.match(/<style\b/gi) ?? []).length !== 1) bad.push('<style> 하나');
    if (html.split(LOG).length !== 2) bad.push(`${LOG} 하나`);
    if (html.split(LOG2).length !== (f.pages === 2 ? 2 : 1)) bad.push(`${LOG2} 는 pages: 2 일 때 하나`);
    if (html.split(TITLE).length > 2) bad.push(`${TITLE} 하나 이하`);
    if (html.split(HIDDEN).length !== (f.hidden ? 2 : 1)) bad.push(`${HIDDEN} 는 hidden 일 때 하나`);
    if (/<(input|audio|video|source|script|svg)\b/i.test(html) || /\{\{소리/.test(html)) bad.push('테마 복사 글이 지우는 요소(input · audio …) · 소리 자리 없음');
    for (const key of ['지문', '이름', '대사']) if (typeof f.rows?.[key] !== 'string' || !f.rows[key].includes(`{{${key}}}`)) bad.push(`줄 꼴 ${key}`);
    for (const key of ['이름', '대사']) if (typeof f.rows?.[key] === 'string' && !f.rows[key].includes('{{화자}}')) bad.push(`줄 꼴 ${key} 의 {{화자}}`);
    for (const mode of ['light', 'dark']) {
        if (!String(f.roots?.[mode] ?? '').split(/\s+/).filter(Boolean).every(c => MODE_CLASSES.includes(c)) || !f.roots?.[mode]) bad.push(`roots.${mode}`);
        for (const key of ['card', 'log', 'text']) if (!speakerColor(f.paper?.[mode]?.[key])) bad.push(`paper.${mode}.${key}`);
    }
    if (!speakerColor(f.sample)) bad.push('sample');
    if (!LETTERS.includes(f.main ?? '') || !f.main) bad.push('main');
    if (!LETTERS.includes(f.second ?? '') || !f.second || f.second === f.main) bad.push('second');
    const colors0 = parts ? speakerColorsOf(parts.blocks.slice(1).join('\n')) : {};
    if (f.main && f.second && !(f.main in colors0 && f.second in colors0)) bad.push('② 에 주인공 · 상대 띠 색');
    return bad;
}

/**
 * 이 틀을 테마가 받는지 — { ok: true } | { ok: false, reason, why }
 *   reason = 테마가 건너뛸 때 보여 주는 글 그대로 · why = 짧은 까닭(마트 표시 — 「줄마다 꾸밈이 다른 틀이에요」 꼴)
 * @param {string} html 꾸러미에 싣는 틀 HTML(조각의 preview — 원래 판)
 * @param {{ id: string, key: string }} meta 꾸러미에 싣는 id · 열쇠(mart.js themePack 과 같은 값)
 */
export function themeTakeable(html, { id, key } = {}) {
    const no = (reason, why = reason) => ({ ok: false, reason, why });
    if (!CUSTOM_ID.test(id ?? '')) return no('글꾸 id 가 틀려요');
    if (!SIMPLE_KEY.test(key ?? '')) return no('틀 열쇠가 틀려요');
    if (typeof html !== 'string' || !html.trim()) return no('틀 HTML 이 없어요');
    if (html.length > SIMPLE_HTML_MAX) return no('틀이 너무 커요(60KB 까지)');
    if (!/^\s*<div class="gk [^"]*"[^>]*>\s*<style>/.test(html) || (html.match(/<style\b/gi) ?? []).length !== 1) return no('심플 글꾸 꼴이 아니에요(class + <style> 하나)');
    const plain = html.replace(/<div class="gk-sd">.*<\/div>/g, '');
    for (const [re, reason] of SIMPLE_BAD) if (re.test(plain)) return no(reason);
    let frame;
    try { frame = frameCheck(html, id); }
    catch (error) { return no(`이 틀은 아직 테마 로그 복사가 받지 못해요 — ${error.message}(마트 「HTML 복사」로 써요)`, error.message); }
    if (frame.key !== key) return no('틀 열쇠가 HTML 과 달라요');
    return { ok: true };
}
