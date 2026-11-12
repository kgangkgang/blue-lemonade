// 1.1.4 글꾸 마트 「테마로 담기」로 받은 심플 틀(틀 원래 판 HTML — 견본 제목 · 견본 줄이 든 꼴)을 로그 복사 등록 값으로 바꿔요.
//   규칙은 내장 심플 틀 생성기(tools/mart/simple-frames.mjs frameEntry)와 같아요: 뽑기용 별칭 떼기 · 소리 카드 줄 빼기(gk-noaud) ·
//   견본 제목 → {{제목}} · 로그 칸 견본 줄 → {{로그}}(둘째 쪽 {{로그:2}}) · 숨은 한 줄 → {{숨은줄}} · 줄 꼴(지문 · 이름 · 대사) · 화자 글자 · 종이 색 · 낮밤 뿌리 클래스.
//   생성기와 다른 점: 마트 견본 글의 지문 · 대사 줄 안 꾸밈(<em> · <strong> · <s>)을 받아요 · 미리보기로만 펼친 상자(data-bl-peek)를 닫아요.
//   로그 칸이 「지문 · 이름 · 대사」 한 꼴로 늘어나지 않는 틀(줄마다 다른 class · 쪽이 셋 이상)은 받지 못해요(까닭을 돌려줘요).
// DOM 없는 순수 모듈 — 마트에서 가져오기(mart-import.js)가 받을 때 한 번만 불러요. 시험 tools/tests/log-copy-simple-import.mjs.
import * as tone from './log-copy-simple-tone.js';
import { checkFrame } from './log-copy-simple.js';
import * as more from './log-copy-simple-more.js';   // 1.1.8 줄 갈래 · 칸 묶음(한 꼴로 안 늘어나는 틀)

export const SAMPLE_TITLE = '비 그친 뒤, 옥상에서';   // 마트 · 이식판 공통 견본 제목(생성기와 같은 글)
const LOG = '{{로그}}', LOG2 = '{{로그:2}}', HIDDEN = '{{숨은줄}}', TITLE = '{{제목}}';
const ROW = /^<p class="gk-(nr|nm|dl)\b/;
const SOUND_LINE = /^<div class="gk-sd">.*<\/div>$/;
const NR = /^<p class="gk-nr">(?:(?!<\/?p\b).)+<\/p>$/;
const NM = /^<p class="gk-nm gk-n[A-Z]">[^<]+<\/p>$/;
const DL = /^(<p class="gk-dl"[^>]*>)<span class="gk-d gk-d[A-Z]">(?:(?!<\/?(?:p|span)\b).)+<\/span><\/p>$/;
const ROW_HEAD = /^<p class="(gk-(?:nr|nm|dl)(?: [\w-]+)*)"/;
/**
 * 1.1.5 줄 머리의 덤 class 가운데 틀 <style> 이 한 번도 안 쓰는 것은 떼요(모양에 아무 일도 안 하는 이름표 — 줄 차례 gk-q1 · gk-w1, 화자 gk-lA 따위).
 * 줄 꼴이 하나로 모여 로그 길이만큼 늘릴 수 있어요. 규칙이 쓰는 class 는 그대로 두고 꼴 검사에 맡겨요(줄마다 꾸밈이 다른 틀은 여전히 못 받아요).
 */
function plainRow(line, css) {
    const m = line.match(ROW_HEAD);
    if (!m) return line;
    const kept = m[1].split(' ').filter((c, i) => i === 0 || /^gk-n[A-Z]$/.test(c) || new RegExp(`\\.${c}(?![\\w-])`).test(css));
    return `<p class="${kept.join(' ')}"${line.slice(m[0].length)}`;
}

/** 뽑기용 별칭(접두 없는 class)을 뿌리에서 떼요 — 생성기 stripAlias 와 같아요 */
const stripAlias = html => html.replace(/^(\s*<div\b[^>]*\sclass=")([^"]*)"/, (all, a, v) => `${a}${v.split(/\s+/).filter(c => c === 'gk' || c.startsWith('gk-')).join(' ')}"`);
/** 미리보기로만 펼친 상자를 닫힌 꼴로(마트 카드 미리보기 표시 — 복사 글은 닫힌 채 시작해요) */
const shutPeek = html => html.replace(/<details\b[^>]*\sdata-bl-peek=""[^>]*>/g, t => t.replace(/\sopen(?:="[^"]*")?(?=[\s>])/, '').replace(/\sdata-bl-peek=""/, ''));
/** 소리 카드 줄을 뺀 판(있던 틀만 뿌리 끝에 gk-noaud) — 생성기 quietFrame 과 같아요 */
function quietFrame(html) {
    const lines = html.split('\n');
    const kept = lines.filter(line => !SOUND_LINE.test(line));
    if (kept.length === lines.length) return html;
    return kept.join('\n').replace(/^(<div class="gk [^"]*)"/, '$1 gk-noaud"');
}

/**
 * 틀 원래 판 → 등록 값(log-copy-simple.js drawSimple 이 그려요) · 꼴이 어긋나면 Error(까닭 한 줄)를 던져요.
 * @param {string} raw 마트 꾸러미의 html
 * @param {{ id: string, label?: string, emoji?: string }} meta
 */
export function frameFromHtml(raw, meta) {
    const quiet = quietFrame(stripAlias(shutPeek(String(raw ?? '').replace(/\r\n/g, '\n').trim())));
    const info = tone.simpleFrameInfo(quiet);
    if (!info?.key || !info.base || info.K0 === undefined) throw new Error('심플 틀 꼴이 아니에요');
    try { return rowsFrame(quiet, info, meta, false); }
    catch (error) {
        // 1.1.8 한 꼴로 안 늘어나는 틀: 줄 갈래(vary) → 칸 묶음(units) 차례로 · 둘 다 안 되면 처음 까닭 그대로
        if (!/줄마다 꾸밈이 다른 틀|로그 칸이 여러 곳|소리 자리 없음/.test(error.message)) throw error;
        const lines = quiet.split('\n'), kept = lines.filter(line => !more.SOUND_WRAP.test(line));
        const calm = kept.length === lines.length ? quiet : kept.join('\n').replace(/^(<div class="gk [^"]*?)(?: gk-noaud)?"/, '$1 gk-noaud"');
        const calmInfo = calm === quiet ? info : tone.simpleFrameInfo(calm);
        // 줄 갈래는 줄 머리 class 차례를 맞춰 봐요(gk-t1 gk-nr → gk-nr gk-t1 — 모양은 같아요)
        const ordered = calm.replace(/^<p class="([^"]*)"/gm, (all, v) => { const c = v.split(' '), i = c.findIndex(x => /^gk-(?:nr|nm|dl)$/.test(x)); return i > 0 ? `<p class="${[c[i], ...c.filter((x, j) => j !== i)].join(' ')}"` : all; });
        try { return rowsFrame(ordered, calmInfo, meta, true); } catch { /* 칸 묶음으로 */ }
        try { return unitsFrame(calm, calmInfo, meta); } catch { throw error; }
    }
}

/** 줄 꼴로 늘리는 틀(로그 줄이 한두 덩이) — vary: 1.1.8 줄 갈래(줄마다 덤 class · 끝 꾸밈)까지 받아요(false 면 1.1.5 그대로) */
function rowsFrame(quiet, info, meta, vary) {
    const css = quiet.slice(0, Math.max(0, quiet.indexOf('</style>')));
    const lines = quiet.split('\n').map(line => (ROW.test(line) ? plainRow(line, css) : line));
    const groups = [];
    lines.forEach((line, i) => { if (!ROW.test(line)) return; const g = groups[groups.length - 1]; if (g && g.end === i) g.end = i + 1; else groups.push({ start: i, end: i + 1 }); });
    if (groups.length < 1 || groups.length > 2) throw new Error('로그 칸이 여러 곳으로 나뉜 틀이에요');
    let rows, varied = null;
    if (vary) {
        const found = groups.flatMap(g => lines.slice(g.start, g.end)).map(more.varyRow);
        if (found.some(r => !r)) throw new Error('줄마다 꾸밈이 다른 틀이에요');
        ({ rows, vary: varied } = more.varyForms(found));
    } else {
        const forms = { 지문: new Set(), 이름: new Set(), 대사: new Set() };
        for (const line of groups.flatMap(g => lines.slice(g.start, g.end))) {
            let m;
            if (NR.test(line)) forms.지문.add('<p class="gk-nr">{{지문}}</p>');
            else if (NM.test(line)) forms.이름.add('<p class="gk-nm gk-n{{화자}}">{{이름}}</p>');
            else if ((m = line.match(DL))) forms.대사.add(`${m[1].replace(/ease-out [\d.]+s both/, 'ease-out {{지연}} both')}<span class="gk-d gk-d{{화자}}">{{대사}}</span></p>`);
            else throw new Error('줄마다 꾸밈이 다른 틀이에요');
        }
        for (const set of Object.values(forms)) if (set.size !== 1) throw new Error('줄마다 꾸밈이 다른 틀이에요');
        rows = { 지문: [...forms.지문][0], 이름: [...forms.이름][0], 대사: [...forms.대사][0] };
    }
    const out = [...lines];
    [...groups].reverse().forEach((g, i) => out.splice(g.start, g.end - g.start, groups.length - 1 - i === 0 ? LOG : LOG2));
    return finish(out.join('\n'), info, meta, { rows, ...(groups.length === 2 ? { pages: 2 } : {}), ...(varied && Object.keys(varied).length ? { vary: varied } : {}) });
}

/** 1.1.8 칸 묶음 틀(메시지마다 감싸는 칸 — log-copy-simple-more.js unitsOf) */
function unitsFrame(quiet, info, meta) {
    const u = more.unitsOf(quiet);
    return finish(u.html, info, meta, { rows: u.rows, units: u.units, ...(Object.keys(u.nameFill).length ? { nameFill: u.nameFill } : {}) });
}

/** 제목 · 숨은 줄 자리표 · 화자 · 종이 색 · 낮밤 → 등록 값(checkFrame 통과) — extra: pages(둘째 쪽) · vary(줄 갈래) · units · nameFill(칸 묶음) */
function finish(html, info, meta, { rows, ...extra }) {
    if (html.split(`class="gk-tt">${SAMPLE_TITLE}`).length !== 2) throw new Error('제목 자리를 찾지 못했어요');
    html = html.replace(`class="gk-tt">${SAMPLE_TITLE}`, `class="gk-tt">${TITLE}`);
    const hidden = html.match(/<span class="gk-hl">[^<]+<\/span>/g) ?? [];
    if (hidden.length > 1) throw new Error('숨은 한 줄이 여러 곳이에요');
    if (hidden.length) html = html.replace(hidden[0], `<span class="gk-hl">${HIDDEN}</span>`);
    // 1.1.8 칸 묶음 틀 가운데 대사 띠 색이 없는 틀(채팅 화면 꼴)은 화자 색을 얼굴 동그라미(gk-aX) 색으로 읽어 둬요(colors0 — 다시 칠할 때 「원래 색」 기준)
    let colors0 = tone.speakerColorsOf(info.color_css), own = null;
    if (extra.units && Object.keys(colors0).length < 2) {
        own = {};
        for (const m of info.color_css.matchAll(/\.gk-k\d+ \.gk-a([A-Z])\{background-color:(#[0-9a-f]{6})\}/gi)) own[m[1]] ??= m[2].toLowerCase();
        colors0 = own;
    }
    const main = own ? info.speakers.find(X => info.K0 && own[X] === info.K0) || tone.SIMPLE_CONTRACT.mainOrder.find(x => info.speakers.includes(x)) || info.speakers[0] : tone.mainLetterOf(info);
    const second = Object.keys(colors0).find(x => x !== main);
    if (!second) throw new Error('상대 화자 색을 찾지 못했어요');
    const base = tone.originalBase(info), faces = tone.facesOf(info, base), light = base === 'gk-tl';
    const ink = tone.SIMPLE_CONTRACT.ink;
    const frame = {
        id: meta.id, label: meta.label || '글꾸', ...(meta.emoji ? { emoji: meta.emoji } : {}), key: info.key,
        ...(extra.pages ? { pages: 2 } : {}), ...(hidden.length ? { hidden: true } : {}),
        main, second, sample: info.K0,
        roots: { light: light ? base : 'gk-tl gk-tn-d', dark: light ? 'gk-td gk-tn-n' : base },
        paper: {
            light: { card: (light ? faces.orig : faces.alt)[0], log: (light ? faces.orig : faces.alt)[1], text: ink['gk-tl'] },
            dark: { card: (light ? faces.alt : faces.orig)[0], log: (light ? faces.alt : faces.orig)[1], text: ink[light ? 'gk-td' : base] },
        },
        rows: { 지문: rows.지문, 이름: rows.이름, 대사: rows.대사 },
        html,
        ...(extra.vary ? { vary: extra.vary } : {}), ...(extra.units ? { units: extra.units } : {}), ...(extra.nameFill ? { nameFill: extra.nameFill } : {}), ...(own ? { colors0: own } : {}),
    };
    const bad = checkFrame(frame);
    if (bad.length) throw new Error(`틀 꼴이 맞지 않아요(${bad.slice(0, 2).join(' · ')})`);
    return frame;
}
