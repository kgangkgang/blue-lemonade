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
    if (html.split(SIMPLE.log2).length !== (f.pages === 2 ? 2 : 1)) bad.push(`${SIMPLE.log2} 는 pages: 2 일 때 하나`);
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
    const colors0 = parts ? speakerColorsOf(parts.blocks.slice(1).join('\n')) : {};
    if (f.main && f.second && !(f.main in colors0 && f.second in colors0)) bad.push('② 에 주인공 · 상대 띠 색');
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
 * 화자 색 → toneSimple 인자. 규칙(글꾸 마트와 같게):
 *   주인공: 색을 모르면 「원래 색」(시안 그대로) · 색이 있으면 그 색(틀을 만든 색과 같으면 시안 그대로, 다르면 시안 식)
 *   상대(second): 색을 모르면 틀이 정한 색 그대로 · 색이 있으면 그 색(같은 규칙)
 *   셋째부터: 틀에 색이 없어서 그 사람 색(모르면 무채)으로 시안 식 — 색 묶음 이름에 꼬리를 달아 한 글에 다른 로그와 붙여도 안 부딪혀요
 */
export function simpleTone(frame, colors) {
    const colors0 = speakerColorsOf(simpleFrameInfo(frame.html)?.color_css ?? '');
    const K = colors.get(frame.main) ?? ORIGINAL;
    const others = {};
    for (const [letter, color] of colors) {
        if (letter === frame.main) continue;
        if (letter === frame.second ? color != null : true) others[letter] = color ?? null;
    }
    const tail = Object.entries(others).filter(([x, c]) => !(x === frame.second && c === colors0[x])).map(([x, c]) => `${x}${c ?? '-'}`);
    return { K, others, cvTail: tail.length ? hash(tail.join('|')) : '' };
}

/** 문단 나누기: 다시 칠한 메시지 노드 → [[{ dlg, html, text }]] (대사 = 띠를 단 조각 · 굵게 · 기울임은 b · i 로) */
function paragraphs(nodes) {
    const out = [];
    let cur = [];
    const flush = () => {
        while (cur.length && cur[0].br) cur.shift();
        while (cur.length && cur[cur.length - 1].br) cur.pop();
        if (cur.some(p => p.text.trim())) out.push(cur);
        cur = [];
    };
    const walk = (list, ctx) => {
        for (const node of list ?? []) {
            if (node.t === 'text') {
                let html = esc(node.text);
                if (ctx.i) html = `<i>${html}</i>`;
                if (ctx.b) html = `<b>${html}</b>`;
                cur.push({ dlg: ctx.dlg, html, text: node.text });
            } else if (node.t === 'br') cur.push({ dlg: ctx.dlg, html: '<br>', text: '', br: true });
            else if (node.t === 'hr') flush();
            else if (node.t === 'el') {
                const s = node.style ?? {};
                const next = {
                    dlg: ctx.dlg || (!node.block && /gradient\(/i.test(String(s['background-image'] ?? ''))),
                    b: ctx.b || /^(bold|bolder|[6-9]\d\d)$/.test(String(s['font-weight'] ?? '').trim()),
                    i: ctx.i || /italic|oblique/.test(String(s['font-style'] ?? '')),
                };
                if (node.block) { flush(); walk(node.children, next); flush(); } else walk(node.children, next);
            }
        }
    };
    walk(nodes, { dlg: false, b: false, i: false });
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
    const who = speakerLetters(model, { main: frame.main, second: frame.second, lookup: o.lookup });
    // 메시지 글: 깡통 로그 틀과 같은 다시 칠하기(띠 · 따옴표 색 글자 → 대사, 속마음 · 강조 색 → 본문) 뒤 문단으로 · 글꼴은 틀이 맡아요
    const t = tone(who.main, { mode, plan: 'B' });
    const painted = retintModel(model, t, { font: false });
    const showNames = o.names !== false && who.count > 1;
    const bandForm = frame.rows.띠 ?? SIMPLE.band;
    let lines = 0;
    const blocks = painted.messages.map((message) => {
        const name = String(message.name ?? '').trim();
        const letter = who.letterOf.get(name) ?? frame.main;
        const head = showNames && name ? [fill(frame.rows.이름, { [SIMPLE.who]: letter, '{{이름}}': esc(name) })] : [];
        const body = paragraphs(message.nodes).map((list) => {
            const talk = list.filter(p => p.text.trim());
            if (talk.every(p => p.dlg) || SIMPLE.quoted.test(list.map(p => p.text).join(''))) {
                const delay = seconds(Math.min(SIMPLE.delayStart + SIMPLE.delayStep * lines++, SIMPLE.delayMax));
                return fill(frame.rows.대사, { [SIMPLE.who]: letter, [SIMPLE.delay]: delay, '{{대사}}': list.map(p => p.html).join('').trim() });
            }
            let html = '', run = null;
            const close = () => { if (run) html += fill(bandForm, { [SIMPLE.who]: letter, '{{대사}}': run }); run = null; };
            for (const p of list) {
                if (p.dlg) run = (run ?? '') + p.html;
                else { close(); html += p.html; }
            }
            close();
            return fill(frame.rows.지문, { '{{지문}}': html.trim() });
        });
        return body.length ? [...head, ...body] : [];
    }).filter(b => b.length);
    const [page1, page2] = frame.pages === 2 ? splitPages(blocks) : [blocks.flat(), []];
    const title = esc(String(o.fields?.title ?? '').trim());
    let filled = fill(frame.html, { [SIMPLE.title]: title, [SIMPLE.hidden]: esc(String(o.fields?.hidden ?? '').trim()) });
    filled = filled.split(`\n${SIMPLE.log2}\n`).join(page2.length ? `\n${page2.join('\n')}\n` : '\n');
    filled = filled.split(`\n${SIMPLE.log}\n`).join(page1.length ? `\n${page1.join('\n')}\n` : '\n');
    // 색: 글꾸 마트와 같은 다시 칠하기(화자 글자마다 그 사람 색 — 규칙은 simpleTone)
    const { K, others, cvTail } = simpleTone(frame, who.colors);
    let html = toneSimple(filled, K, { mode, main: frame.main, others, cvTail });
    if (o.marks !== false) html = markEdits(html, { skip: frame.hidden ? [] : ['gk-hl'] });
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
