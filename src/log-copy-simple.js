// 1.1.3 로그 복사 「심플」 새 틀 — 클래스 + <style> 하나로 된 틀(글꾸 마트 새 틀과 같은 틀 · 소리 카드 줄만 뺀 판)에 고른 메시지를 채워요.
//   틀 하나 = 등록 값(log-copy-simple.gen.js — tools/mart/simple-frames.mjs 가 이식판에서 만들어요): 혼자 서는 HTML(감싸는 div + 첫 자식 <style> 하나 + 자리표) + 줄 꼴(지문 · 이름 · 대사)
//     + 주인공 · 상대 화자 글자 + 종이 색 · 낮밤 뿌리 클래스(표시 · 시트용) + 미리보기 상태.
//   - 제목 · 로그 자리표를 채우고, 메시지를 문단마다 지문 줄 / 대사 줄로 나눠 그려요(문단이 다 대사면 대사 줄, 아니면 지문 줄 안에 대사 띠).
//   - 색: 글꾸 마트와 같은 규칙(log-copy-simple-tone.js toneSimple) — 화자 색이 틀을 만든 색 그대로이거나 색을 모르면 시안 그대로, 다른 색이면 시안 식.
//   - 낮밤: 고른 팔레트의 밝기(o.mode)로 뿌리 클래스만 바꿔요. 모양 · 자리 · 움직임은 같은 HTML.
//   - 소리 카드는 테마 복사 글에서 못 살아요(log-copy-sanitize.js 가 <audio> 를 지워요) → 등록 값에 소리 줄이 없고 소리 카드가 있던 틀은 뿌리에 gk-noaud.
//   - 복사 글을 사람이 고치기 쉽게: 줄 하나에 항목 하나 · 고칠 자리 앞에 「✎」 주석(마트 복사 글과 같은 문구).
//   - <style> 하나 합치기는 복사 길(log-copy-lift.js insertHead · 뿌리 표시 gk-k<번호> · gk-q<번호>)이 해요.
// 틀-계약이 정하지 않은 것은 아래 SIMPLE 한 곳에 모았어요. DOM 없는 순수 모듈(시험 tools/tests/log-copy-simple*.mjs).
import { esc } from './log-copy-render.js';
import { speakersOf, retintModel } from './log-copy-tone.js';
import { tone, speakerColor } from './shared/char-tone.js';
import { toneSimple, ORIGINAL, markEdits, simpleFrameInfo, speakerColorsOf } from './log-copy-simple-tone.js';
import { SIMPLE_FRAMES as REGISTERED } from './log-copy-simple.gen.js';
import { spoilerHtml, unparagraphHtml } from './log-copy-spoiler.js';   // 1.1.8 거둔 숨긴 글 다시 그리기 · 그 글이 든 <p> 줄은 div.blsp-p 로

export const SIMPLE = Object.freeze({
    category: 'simple',                 // 프리셋 분류 id(log-copy-presets.js ALL_CATEGORIES)
    title: '{{제목}}',                  // 틀-계약 7절
    log: '{{로그}}',                    // 로그 칸 안 줄이 들어갈 자리
    log2: '{{로그:2}}',                 // 둘째 쪽(03 바인더 — pages: 2)
    hidden: '{{숨은줄}}',               // 05 티백 숨은 한 줄(o.fields.hidden · 없으면 빈 칸 — 「✎」 주석이 자리를 알려 줘요)
    who: '{{화자}}', delay: '{{지연}}', // 줄 꼴 안(계약 7절)
    rows: Object.freeze(['지문', '이름', '대사']),
    band: '<span class="gk-d gk-d{{화자}}">{{대사}}</span>',   // 지문 줄 안 대사 조각
    root: 'gk', frame: key => `gk-${key}`,
    colorPrefix: 'gk-cv-',              // 뿌리 색 묶음 클래스 머리(이식판 9-3)
    noAudio: 'gk-noaud',                // 소리 없는 판(이식판 9-4)
    modeClasses: Object.freeze(['gk-tl', 'gk-td', 'gk-tx', 'gk-tn-d', 'gk-tn-n']),   // 낮밤이 바꾸는 뿌리 클래스(틀-계약 C-3 · C-4)
    blocks: /\n[ \t]*\n/,               // <style> = ① 기본 \n\n ② 화자 색 \n\n ③ 소품 색(이식판 9-4)
    letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    quoted: /^[\s​]*[「『"“][\s\S]*[」』"”][\s​]*$/,   // 색 없이 따옴표로 열고 닫은 문단도 대사 줄로
    delayStart: 0.2, delayStep: 0.25, delayMax: 1.2,   // 대사 줄 등장 지연(시안 0.2s 부터 0.25s 씩) · 긴 로그는 1.2s 에서 멈춰요(뒤 줄이 오래 안 보이지 않게)
});
const MODES = ['light', 'dark'];

/** 틀 등록 값 점검 — 문제 글 목록(빈 배열이면 통과) */
export function checkFrame(frame) {
    const bad = [];
    const f = frame ?? {};
    if (!/^[a-z0-9-]{1,24}$/.test(String(f.id ?? ''))) bad.push('id');
    if (!/^[kq]\d+$/.test(String(f.key ?? ''))) bad.push('key');
    const html = String(f.html ?? '');
    const parts = splitFrame(html);
    if (!parts) bad.push('감싸는 div 의 첫 자식 <style>');
    else {
        if (!parts.classes.includes(SIMPLE.root) || !parts.classes.includes(SIMPLE.frame(f.key))) bad.push(`뿌리 class ${SIMPLE.root} ${SIMPLE.frame(f.key)}`);
        if (parts.blocks.length < 2 || parts.blocks.length > 3) bad.push('<style> 덩이 둘 · 셋(① 기본 · ② 화자 · ③ 소품 — 소품이 없는 틀은 ③ 없음)');
    }
    if ((html.match(/<style\b/gi) ?? []).length !== 1) bad.push('<style> 하나');
    if (html.split(SIMPLE.log).length !== 2) bad.push(`${SIMPLE.log} 하나`);
    if (html.split(SIMPLE.log2).length !== (f.pages === 2 || f.units ? 2 : 1)) bad.push(`${SIMPLE.log2} 는 pages: 2 일 때 하나`);
    if (f.vary !== undefined || f.units !== undefined || f.nameFill !== undefined || f.colors0 !== undefined) bad.push(...checkMore(f));
    if (html.split(SIMPLE.title).length > 2) bad.push(`${SIMPLE.title} 하나 이하`);
    if (html.split(SIMPLE.hidden).length !== (f.hidden ? 2 : 1)) bad.push(`${SIMPLE.hidden} 는 hidden 일 때 하나`);
    if (/<(input|audio|video|source|script|svg)\b/i.test(html) || /\{\{소리/.test(html)) bad.push('테마 복사 글이 지우는 요소(input · audio …) · 소리 자리 없음');
    for (const key of SIMPLE.rows) if (typeof f.rows?.[key] !== 'string' || !f.rows[key].includes(`{{${key}}}`)) bad.push(`줄 꼴 ${key}`);
    for (const key of ['이름', '대사']) if (typeof f.rows?.[key] === 'string' && !f.rows[key].includes(SIMPLE.who)) bad.push(`줄 꼴 ${key} 의 ${SIMPLE.who}`);
    for (const mode of MODES) {
        if (!String(f.roots?.[mode] ?? '').split(/\s+/).filter(Boolean).every(c => SIMPLE.modeClasses.includes(c)) || !f.roots?.[mode]) bad.push(`roots.${mode}`);
        for (const key of ['card', 'log', 'text']) if (!speakerColor(f.paper?.[mode]?.[key])) bad.push(`paper.${mode}.${key}`);
    }
    if (!speakerColor(f.sample)) bad.push('sample');
    if (!SIMPLE.letters.includes(f.main ?? '') || !f.main) bad.push('main');
    if (!SIMPLE.letters.includes(f.second ?? '') || !f.second || f.second === f.main) bad.push('second');
    const colors0 = f.colors0 ?? (parts ? speakerColorsOf(parts.blocks.slice(1).join('\n')) : {});
    if (f.main && f.second && !(f.main in colors0 && f.second in colors0)) bad.push('② 에 주인공 · 상대 띠 색');
    return bad;
}

/** 1.1.8 줄 갈래(vary) · 칸 묶음(units · nameFill) 점검 — 문제 글 목록 */
const BAD_TAG = /<(input|audio|video|source|script|svg|style|iframe|img)\b|\{\{소리/i;
function checkMore(f) {
    const bad = [];
    const form = (kind, v) => typeof v === 'string' && v.includes(`{{${kind}}}`) && (kind === '지문' || v.includes(SIMPLE.who)) && !BAD_TAG.test(v);
    if (f.vary !== undefined) {
        if (!f.vary || typeof f.vary !== 'object' || f.units) bad.push('vary');
        else for (const [kind, v] of Object.entries(f.vary)) {
            const ok = SIMPLE.rows.includes(kind) && (v?.forms ? Array.isArray(v.forms) && v.forms.length >= 2 && v.forms.length <= 12 && v.forms.every(x => form(kind, x))
                : form(kind, v?.base) && form(kind, v?.accent) && ['first', 'last'].includes(v?.at));
            if (!ok) bad.push(`vary.${kind}`);
        }
    }
    if (f.units !== undefined) {
        const u = f.units;
        if (!Array.isArray(u) || u.length !== 2 || f.pages) bad.push('units');
        else u.forEach((x, i) => {
            const has = (s, k) => typeof s === 'string' && s.split(k).length === 2 && !BAD_TAG.test(s);
            if (!has(x?.both, '{{지문들}}') || !has(x.both, '{{대사들}}') || !has(x.nr, '{{지문들}}') || x.nr.includes('{{대사들}}') || !has(x.dl, '{{대사들}}') || x.dl.includes('{{지문들}}')) bad.push(`units.${i}`);
            if (!form('지문', x?.rows?.지문) || !form('대사', x?.rows?.대사)) bad.push(`units.${i}.rows`);
        });
    }
    if (f.colors0 !== undefined && (!f.units || !f.colors0 || typeof f.colors0 !== 'object' || Object.entries(f.colors0).some(([k, v]) => k.length !== 1 || !SIMPLE.letters.includes(k) || !/^#[0-9a-f]{6}$/.test(v)))) bad.push('colors0');
    if (f.nameFill !== undefined &&(!f.nameFill || typeof f.nameFill !== 'object' || Object.entries(f.nameFill).some(([k, v]) => !SIMPLE.letters.includes(k) || k.length !== 1 || typeof v !== 'string' || v.length > 40 || /[<>{}]/.test(v)))) bad.push('nameFill');
    return bad;
}

/** 틀 HTML → { classes, blocks } | null */
function splitFrame(html) {
    const m = String(html ?? '').match(/^\s*<div\b[^>]*\sclass="([^"]*)"[^>]*>\s*<style>((?:(?!<\/?style)[\s\S])*)<\/style>/i);
    if (!m) return null;
    return { classes: m[1].split(/\s+/).filter(Boolean), blocks: m[2].replace(/^\n/, '').replace(/\n$/, '').split(SIMPLE.blocks) };
}

/** FNV-1a 32 → 36진(색 묶음 이름 꼬리) */
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
}

/**
 * 화자 글자 나누기 — 주인공(speakersOf.main · 사용자 말이 아닌 메시지 가운데 글이 가장 많은 사람)이 틀의 main 글자,
 * 둘째로 나온 사람이 틀의 second 글자(틀이 상대 화자 색을 정해 둔 글자), 나머지는 나온 차례대로 A, B, C …(두 글자는 건너뛰어요).
 * 글자가 모자라면(26명 넘게) 남은 사람은 마지막 글자를 같이 쓰고 그 글자는 무채예요.
 * @returns {{ letterOf: Map<string,string>, colors: Map<string,string|null>, main: string|null, count: number }}
 */
export function speakerLetters(model, { main = 'A', second = main === 'A' ? 'B' : 'A', lookup = null } = {}) {
    const speakers = speakersOf(model, lookup);
    const names = [];
    for (const message of model?.messages ?? []) { const name = String(message.name ?? '').trim(); if (!names.includes(name)) names.push(name); }
    const lead = speakers.mainName ?? names[0] ?? '';
    const free = [second, ...[...SIMPLE.letters].filter(x => x !== main && x !== second)];
    const letterOf = new Map([[lead, main]]);
    const colors = new Map([[main, speakers.byName.get(lead) ?? null]]);
    let i = 0;
    for (const name of names) {
        if (letterOf.has(name)) continue;
        const letter = free[Math.min(i, free.length - 1)];
        if (i >= free.length - 1 && colors.has(letter)) colors.set(letter, null);   // 같이 쓰는 마지막 글자는 무채
        else colors.set(letter, speakers.byName.get(name) ?? null);
        letterOf.set(name, letter); i++;
    }
    return { letterOf, colors, main: colors.get(main) ?? null, count: speakers.count };
}

/**
 * 1.1.5 시트에서 고른 화자 색을 얹어요 — cast: { main?, other? } 값은 '#rrggbb'(직접 색) · 'orig'(틀을 만든 색 = 색 모름과 같은 길) · 없으면 인물표 색 그대로.
 * 깡캐(other)는 틀의 second 글자예요(로그에 둘째 화자가 없어도 틀 규칙의 색만 바뀌어요).
 */
export function castLetters(who, frame, cast) {
    if (!cast || (!cast.main && !cast.other)) return who;
    const colors = new Map(who.colors), second = frame.second ?? (frame.main === 'A' ? 'B' : 'A');
    const put = (letter, v) => { if (v === 'orig') { if (colors.has(letter)) colors.set(letter, null); } else if (/^#[0-9a-f]{6}$/i.test(v || '')) colors.set(letter, v.toLowerCase()); };
    put(frame.main, cast.main); put(second, cast.other);
    return { ...who, colors, main: colors.get(frame.main) ?? null };
}

/**
 * 화자 색 → toneSimple 인자. 규칙(글꾸 마트와 같게):
 *   주인공: 색을 모르면 「원래 색」(시안 그대로) · 색이 있으면 그 색(틀을 만든 색과 같으면 시안 그대로, 다르면 시안 식)
 *   상대(second): 색을 모르면 틀이 정한 색 그대로 · 색이 있으면 그 색(같은 규칙)
 *   셋째부터: 틀에 색이 없어서 그 사람 색(모르면 무채)으로 시안 식 — 색 묶음 이름에 꼬리를 달아 한 글에 다른 로그와 붙여도 안 부딪혀요
 */
export function simpleTone(frame, colors) {
    const colors0 = frame.colors0 ?? speakerColorsOf(simpleFrameInfo(frame.html)?.color_css ?? '');
    const K = colors.get(frame.main) ?? ORIGINAL;
    const others = {};
    for (const [letter, color] of colors) {
        if (letter === frame.main) continue;
        if (letter === frame.second ? color != null : true) others[letter] = color ?? null;
    }
    const tail = Object.entries(others).filter(([x, c]) => !(x === frame.second && c === colors0[x])).map(([x, c]) => `${x}${c ?? '-'}`);
    return { K, others, cvTail: tail.length ? hash(tail.join('|')) : '' };
}

/** 문단 나누기: 다시 칠한 메시지 노드 → [[{ dlg, html, text }]] (대사 = 띠를 단 조각 · 굵게 · 기울임 · 취소선은 strong · em · s 로 — 마트 견본과 같게) */
function paragraphs(nodes) {
    const out = [];
    let cur = [];
    const flush = () => {
        while (cur.length && cur[0].br) cur.shift();
        while (cur.length && cur[cur.length - 1].br) cur.pop();
        if (cur.some(p => p.text.trim())) out.push(cur);
        cur = [];
    };
    const inline = (list, ctx) => (list ?? []).map((node) => {   // 숨긴 글 속 글만
        if (node.t === 'text') { let h = esc(node.text); if (ctx.s) h = `<s>${h}</s>`; if (ctx.i) h = `<em>${h}</em>`; if (ctx.b) h = `<strong>${h}</strong>`; return h; }   // 11-12 바깥 글과 같은 태그(마트 견본 · 세밀 규칙)
        return node.t === 'br' ? '<br>' : node.t === 'el' ? inline(node.children, ctx) + (node.block ? '<br>' : '') : '';   // 여러 줄을 숨겼으면 줄마다 줄바꿈
    }).join('');
    const walk = (list, ctx) => {
        for (const node of list ?? []) {
            if (node.t === 'text') {
                let html = esc(node.text);
                // 11-12: 마트 견본 글과 같은 태그(<em> · <strong> · <s>) — 받은 심플 글꾸의 세밀 「속마음 · 강조 · 취소선」 규칙(마트 look.js)이 em · strong · s 를 겨눠요.
                //   전엔 <i> · <b> 로 그리고 취소선은 빼서 그 갈래 칸(색 · 크기 · 굵기 · 자간 · 형광펜 · 선)을 눌러도 미리보기 · 복사 글이 그대로였어요
                if (ctx.s) html = `<s>${html}</s>`;
                if (ctx.i) html = `<em>${html}</em>`;
                if (ctx.b) html = `<strong>${html}</strong>`;
                cur.push({ dlg: ctx.dlg, html, text: node.text });
            } else if (node.t === 'br') cur.push({ dlg: ctx.dlg, html: '<br>', text: '', br: true });
            else if (node.t === 'hr') flush();
            else if (node.t === 'el' && node.kind === 'spoiler') {   // 1.1.8 미리보기에서 숨긴 글(거둔 모델에만 있어요 — log-copy-basic.js 와 같은 길)
                const html = spoilerHtml(inline(node.children, ctx).replace(/^(<br>)+|(<br>)+$/g, ''), node.sp, !node.block);
                if (node.block) { flush(); cur.push({ dlg: false, html, text: '숨긴 글' }); flush(); } else cur.push({ dlg: false, html, text: '숨긴 글' });
            } else if (node.t === 'el') {
                const s = node.style ?? {};
                const next = {
                    dlg: ctx.dlg || (!node.block && /gradient\(/i.test(String(s['background-image'] ?? ''))),
                    b: ctx.b || /^(bold|bolder|[6-9]\d\d)$/.test(String(s['font-weight'] ?? '').trim()),
                    i: ctx.i || /italic|oblique/.test(String(s['font-style'] ?? '')),
                    s: ctx.s || /line-through/.test(String(s['text-decoration'] ?? s['text-decoration-line'] ?? '')),
                };
                if (node.block) { flush(); walk(node.children, next); flush(); } else walk(node.children, next);
            }
        }
    };
    walk(nodes, { dlg: false, b: false, i: false, s: false });
    flush();
    return out;
}

const fill = (form, values) => Object.entries(values).reduce((text, [key, value]) => text.split(key).join(value), form);
const seconds = v => `${Number(v.toFixed(2))}s`;
const plainLength = lines => lines.join('').replace(/<[^>]*>/g, '').length;

/**
 * 03 바인더(2쪽 고정) 나누기: 메시지 경계에서 두 쪽 글 길이가 가장 비슷한 자리 · 메시지가 하나면 그 메시지의 줄 경계(이름 줄 바로 뒤는 안 끊어요) ·
 * 줄이 하나뿐이면 둘째 쪽은 빈 쪽. @param {string[][]} blocks 메시지마다 줄 목록 @returns {[string[], string[]]}
 */
export function splitPages(blocks) {
    const cut = (units, at) => [units.slice(0, at).flat(), units.slice(at).flat()];
    const best = (units, from = 1) => {
        let pick = -1, gap = Infinity;
        const total = plainLength(units.flat());
        for (let i = from; i < units.length; i++) { const d = Math.abs(total - 2 * plainLength(units.slice(0, i).flat())); if (d < gap) { gap = d; pick = i; } }
        return pick;
    };
    if (blocks.length >= 2) return cut(blocks, best(blocks));
    const lines = (blocks[0] ?? []).map(line => [line]);
    const from = /class="gk-nm\b/.test(lines[0]?.[0] ?? '') ? 2 : 1;
    if (lines.length <= from) return [lines.flat(), []];
    return cut(lines, best(lines, from));
}

// ── 1.1.8 미리보기 표지(받은 심플 글꾸도 고친 글 · 숨긴 글 · 제목이 다시 그려도 남게) ──
//   줄 꼴(<p class="gk-nr|nm|dl">)은 메시지 하나가 여러 줄이라 감쌀 수 없고, 마트 조절 코드가 줄 머리 글자를 그대로 맞대요(tune.js PAIR_G 등) —
//   그래서 줄 사이에 주석 한 줄만 끼워요. 복사 글에서는 log-copy-spoiler.js stripRowMarks 가 걷어 고치기 전과 한 글자도 같아요(시험 log-copy-simple-rows.mjs).
/** 쪽마다 메시지가 바뀌는 줄 앞에 <!--blm:n-->, 쪽 끝에 <!--blm:e-->(로그 칸 뒤 틀 글이 마지막 메시지에 안 섞이게) · 빈 메시지도 자리 표지 하나 — 메시지 수가 그대로여야 거둘 수 있어요 */
function markRows(counts, page1, page2) {
    const items = counts.flatMap((n, i) => (n ? Array.from({ length: n }, () => i) : [-1 - i]));
    const pages = [[], []];
    let page = 0, used = 0, last = null;
    for (const it of items) {
        if (it >= 0 && page === 0 && used >= page1.length) { page = 1; last = null; }
        const i = it >= 0 ? it : -1 - it, out = pages[page];
        if (it < 0 || i !== last) out.push(`<!--blm:${i}-->`);
        last = i;
        if (it >= 0) { out.push(page ? page2[used - page1.length] : page1[used]); used++; }
    }
    for (const out of pages) if (out.length) out.push('<!--blm:e-->');
    return pages;
}
/** 다 그린 글의 제목 · 숨은 줄 표지 → 그 칸 여는 태그의 data-f(미리보기에서 눌러 고친 글을 시트가 읽어요) · 못 붙이면 표지만 걷어요 */
export const rowMarks = html => String(html ?? '')
    .replace(/(<[a-zA-Z][\w-]*\b(?:[^<>"']|"[^"]*"|'[^']*')*?)(\s*)><!--blf:(title|hidden)-->([^<]*)<!--\/blf-->(?=<\/)/g, (all, open, sp, key, text) => `${open} data-f="${key}"${sp}>${text}`)
    .replace(/<!--\/?blf(?::\w+)?-->/g, '');

/**
 * 1.1.8 줄 꼴 고르기 — 줄 갈래(frame.vary)가 없으면 늘 rows 그대로. 갈래가 있으면 종류마다 몇 번째 줄인지 세어
 *   forms: 견본 차례대로 돌려 써요 · accent: 끝 꾸밈은 한 줄에만(첫 줄 · 끝 줄) 나머지는 base.
 * @returns {(kind: string) => string} 부를 때마다 그 종류 다음 줄의 꼴
 */
function rowForm(frame, said, showNames) {
    const vary = frame.vary;
    if (!vary) return kind => frame.rows[kind];
    const total = { 이름: said.filter(m => showNames && m.name).length, 대사: 0, 지문: 0 };
    for (const m of said) for (const b of m.body) total[b.kind]++;
    const seen = { 이름: 0, 대사: 0, 지문: 0 };
    return (kind) => {
        const i = seen[kind]++, v = vary[kind];
        if (!v) return frame.rows[kind];
        if (v.forms) return v.forms[i % v.forms.length];
        return i === (v.at === 'last' ? total[kind] - 1 : 0) ? v.accent : v.base;
    };
}

/**
 * 1.1.8 칸 묶음 틀 — 메시지를 [지문 … 대사 …] 묶음으로 나눠 첫 묶음은 첫 칸(units[0])에, 나머지는 둘째 칸(units[1])에 하나씩 담아요.
 *   칸마다 세 판(both · nr · dl) 가운데 묶음에 맞는 것 · 이름 칸은 이름을 숨기면 비워서 빼요.
 * @returns {[string[], string[], number[]]} {{로그}} 자리 · {{로그:2}} 자리 · 메시지마다 묶음 수(미리보기 표지 markRows 가 써요)
 */
function unitPages(frame, said, showNames) {
    const pages = [[], []], counts = [];
    let n = 0;
    for (const m of said) {
        const chunks = [];
        for (const b of m.body) {
            const last = chunks[chunks.length - 1];
            if (!last || (b.kind === '지문' && last.dl.length)) chunks.push({ nr: [], dl: [] });
            chunks[chunks.length - 1][b.kind === '대사' ? 'dl' : 'nr'].push(b.vals);
        }
        for (const c of chunks) {
            const unit = frame.units[n++ ? 1 : 0];
            const map = {
                '{{화자}}': m.letter, '{{이름}}': showNames && m.name ? esc(m.name) : '',
                '{{지문들}}': c.nr.map(v => fill(unit.rows.지문, v)).join('\n'), '{{대사들}}': c.dl.map(v => fill(unit.rows.대사, v)).join('\n'),
            };
            const html = (c.nr.length && c.dl.length ? unit.both : c.nr.length ? unit.nr : unit.dl).replace(/\{\{(?:화자|이름|지문들|대사들)\}\}/g, k => map[k]);
            pages[n === 1 ? 0 : 1].push(html.replace(/<(p|span) class="gk-nm\b[^"]*"><\/\1>\n?/g, ''));
        }
        counts.push(chunks.length);
    }
    return [pages[0], pages[1], counts];
}

/**
 * 틀 그리기.
 * @param {object} frame 등록 값(checkFrame 통과)
 * @param {object} model captureLog() 결과(고른 메시지)
 * @param {{ mode?: 'light'|'dark', lookup?: (name: string) => any, fields?: { title?: string, hidden?: string }, names?: boolean, marks?: boolean }} [o]
 *   marks: 고칠 자리 「✎」 주석(기본 켬)
 * @returns {{ html: string, mode: 'light'|'dark', cv: string, letters: Map<string,string>, colors: Map<string,string|null>, main: string|null }}
 */
export function drawSimple(frame, model, o = {}) {
    const mode = o.mode === 'light' ? 'light' : 'dark';
    const empty = { html: '', mode, cv: '', letters: new Map(), colors: new Map(), main: null };
    if (!model?.messages?.length) return empty;
    const parts = splitFrame(frame?.html);
    if (!parts || parts.blocks.length < 2) return empty;
    const who = castLetters(speakerLetters(model, { main: frame.main, second: frame.second, lookup: o.lookup }), frame, o.cast);
    // 메시지 글: 깡통 로그 틀과 같은 다시 칠하기(띠 · 따옴표 색 글자 → 대사, 속마음 · 강조 색 → 본문) 뒤 문단으로 · 글꼴은 틀이 맡아요
    const t = tone(who.main, { mode, plan: 'B' });
    const painted = retintModel(model, t, { font: false });
    const showNames = o.names !== false && who.count > 1;
    const bandForm = frame.rows.띠 ?? SIMPLE.band;
    let lines = 0;
    // 메시지마다 { name, letter, body: [{ kind: '대사'|'지문', vals }] } — 줄 꼴은 아래에서 골라 채워요(1.1.8 줄 갈래 · 칸 묶음)
    const said = painted.messages.map((message) => {
        const name = String(message.name ?? '').trim();
        const letter = who.letterOf.get(name) ?? frame.main;
        const body = paragraphs(message.nodes).map((list) => {
            const talk = list.filter(p => p.text.trim());
            if (talk.every(p => p.dlg) || SIMPLE.quoted.test(list.map(p => p.text).join(''))) {
                const delay = seconds(Math.min(SIMPLE.delayStart + SIMPLE.delayStep * lines++, SIMPLE.delayMax));
                return { kind: '대사', vals: { [SIMPLE.who]: letter, [SIMPLE.delay]: delay, '{{대사}}': list.map(p => p.html).join('').trim() } };
            }
            let html = '', run = null;
            const close = () => { if (run) html += fill(bandForm, { [SIMPLE.who]: letter, '{{대사}}': run }); run = null; };
            for (const p of list) {
                if (p.dlg) run = (run ?? '') + p.html;
                else { close(); html += p.html; }
            }
            close();
            return { kind: '지문', vals: { '{{지문}}': html.trim() } };
        });
        return { name, letter, body };
    });
    // 쪽에 들어갈 줄(칸 묶음 틀은 묶음 하나가 한 줄) · rowCount = 메시지마다 그 줄 수(빈 메시지는 0 — markRows 가 자리 표지만 남겨요)
    const live = said.filter(m => m.body.length);
    let page1, page2, rowCount;
    if (frame.units) {
        let counts, k = 0;
        [page1, page2, counts] = unitPages(frame, live, showNames);
        rowCount = said.map(m => (m.body.length ? counts[k++] : 0));
    } else {
        const form = rowForm(frame, live, showNames);
        const perMessage = said.map(m => (m.body.length ? [...(showNames && m.name ? [fill(form('이름'), { [SIMPLE.who]: m.letter, '{{이름}}': esc(m.name) })] : []), ...m.body.map(b => fill(form(b.kind), b.vals))] : []));
        rowCount = perMessage.map(b => b.length);
        const blocks = perMessage.filter(b => b.length);
        [page1, page2] = frame.pages === 2 ? splitPages(blocks) : [blocks.flat(), []];
    }
    // 1.1.8 o.rows(시트 미리보기만): 메시지마다 첫 줄 앞에 표지 주석 <!--blm:n--> 한 줄 · 제목 · 숨은 줄은 표지로 감싸요(rowMarks 가 칸 표시 data-f 로) — 복사할 때 stripRowMarks 가 걷어 바이트가 같아요
    if (o.rows) [page1, page2] = markRows(rowCount, page1, page2);
    const field = (key, v) => (o.rows ? `<!--blf:${key}-->${v}<!--/blf-->` : v);
    const title = esc(String(o.fields?.title ?? '').trim());
    let filled = fill(frame.html, { [SIMPLE.title]: field('title', title), [SIMPLE.hidden]: field('hidden', esc(String(o.fields?.hidden ?? '').trim())) });
    if (frame.nameFill) filled = filled.replace(/\{\{이름:([A-Z])\}\}/g, (all, x) => { const name = o.names !== false && [...who.letterOf].find(([, l]) => l === x)?.[0]; return esc(name || frame.nameFill[x] || ''); });
    filled = filled.split(`\n${SIMPLE.log2}\n`).join(page2.length ? `\n${page2.join('\n')}\n` : '\n');
    filled = filled.split(`\n${SIMPLE.log}\n`).join(page1.length ? `\n${page1.join('\n')}\n` : '\n');
    // 색: 글꾸 마트와 같은 다시 칠하기(화자 글자마다 그 사람 색 — 규칙은 simpleTone)
    const { K, others, cvTail } = simpleTone(frame, who.colors);
    let html = toneSimple(filled, K, { mode, main: frame.main, others, cvTail, colors0: frame.colors0 });
    if (o.marks !== false) html = unparagraphHtml(html);   // 숨긴 글이 없으면 그대로 · marks: false(받은 글꾸)면 renderLog 가 조절 값을 입힌 뒤에
    if (o.marks !== false) html = markEdits(html, { skip: frame.hidden ? [] : ['gk-hl'] });
    if (o.rows && o.marks !== false) html = rowMarks(html);   // marks: false(받은 글꾸 — 조절 값을 입힌 뒤 표시)면 renderLog 가 마지막에 걸어요
    const cv = (html.match(/^<div class="[^"]*\b(gk-cv-[\w-]+)/) || [])[1] ?? '';
    return { html, mode, cv, letters: who.letterOf, colors: who.colors, main: who.main };
}

// ── 프리셋 받는 자리 ─────────────────────────────────────────
/** 깃발: 시트 연결(분류 칩 · 미리보기 · 색 칩 · 인물표 색 · 레몬 바로가기)을 마칠 때까지 꺼 둬요 — 꺼져 있으면 PRESETS · 분류 칩에 안 들어가요(화면 변화 0) */
export const SIMPLE_FRAMES_ENABLED = false;
/** 등록한 심플 새 틀 28(생성물 log-copy-simple.gen.js) */
export const SIMPLE_FRAMES = REGISTERED;
/** 등록 값 → PRESETS 한 줄(분류 「심플」 · 그리기는 renderLog 의 simple 갈래가 drawSimple 로) */
export const simplePreset = frame => Object.freeze({ id: frame.id, label: frame.label, ...(frame.emoji ? { emoji: frame.emoji } : { icon: frame.icon ?? 'fa-feather' }), category: SIMPLE.category, simple: true, frame, render: (m, o) => drawSimple(frame, m, o).html });
/** PRESETS 에 넣을 줄(깃발이 꺼져 있으면 빈 목록) */
export const simplePresets = (on = SIMPLE_FRAMES_ENABLED) => (on ? SIMPLE_FRAMES.map(simplePreset) : []);
