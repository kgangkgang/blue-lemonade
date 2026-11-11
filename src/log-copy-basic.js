// 1.1.3 로그 복사 「기본 글꾸」 새 틀 18 — 사용자가 합격시킨 시안(지시-1110/기본글꾸-새시안)의 그림으로 기본 · 대화 · 종이 · 갤러리 틀을 그려요.
//   그림은 생성물 log-copy-basic.gen.js(tools/mart/basic-frames.mjs 가 시안 생성기에서 옮긴 것 — 손으로 고치지 않아요)의 buildFrame 그대로:
//   감싸는 div(class gk kbNNN …) + 첫 자식 <style> 하나 · 누름은 전부 <details><summary> · 무테 · 그라데이션 0.
//   여기서 하는 일은 시트가 넘기는 값을 생성기 옵션으로 잇는 것뿐이에요.
//   - 메시지: 깡통 로그 틀과 같은 다시 칠하기(retintModel)로 대사 띠를 찾아 문단마다 지문 / 대사로 나눠요(log-copy-simple.js paragraphs).
//     첫 대사 문단 앞의 지문은 이름 앞(시안의 「지문 → 이름 → 대사」 박자), 나머지는 이름 뒤에 차례대로.
//   - 화자 색: 주인공 = A · 둘째로 나온 사람 = B(시안의 견본 색 자리에 그 사람 대사색 — 색을 모르면 시안 색 그대로) · 셋째부터 C … 는 그 사람 색(모르면 무채)
//   - 정보 칸 info: 'off'(기본) · 'chip' · 'tab' · 높이 height: '' · 's' · 'm' · 'l'(틀 안 스크롤) — 뿌리 class 하나씩(생성기 약속)
//   - 견본 글(시각 21:04 · 사진 이름 · 받는 이 …)은 남기지 않아요: 시각은 메시지 시각, 사진은 붙인 그림(없으면 사진 칸 없음), 받는 이는 제목
//   - 레몬 바로가기를 끄면 레몬 그림은 그대로, 링크만 빼요(링크 0개 — 1.1.2 감사 R5)
//   - marks: 미리보기에서 눌러 고칠 칸 표시(data-f — 제목 · LOG · 모델 · 프롬프트 · 탭 이름) · 복사할 때 시트 소독이 걷어요
// DOM 없는 순수 모듈(시험 tools/tests/log-copy-basic.mjs).
import { esc } from './log-copy-render.js';
import { retintModel } from './log-copy-tone.js';
import { tone } from './shared/char-tone.js';
import { speakerLetters, SIMPLE } from './log-copy-simple.js';
import { spoilerHtml, unparagraphHtml } from './log-copy-spoiler.js';
import { buildFrame, frames as GEN_FRAMES, HEIGHTS as GEN_HEIGHTS, LEMON_HOME } from './log-copy-basic.gen.js';

/** 새 그림으로 바꾼 틀 — 432 상태창(status)은 사용자 결정 보류라 옛 그림 그대로예요 */
export const BASIC_FRAMES = Object.freeze(GEN_FRAMES.filter(f => f.id !== 'status').map(f => Object.freeze({ id: f.id, no: f.no, key: f.k })));
export const BASIC_IDS = Object.freeze(BASIC_FRAMES.map(f => f.id));
export const isBasicShape = id => BASIC_IDS.includes(id);
/** 정보 칸 · 높이 고르기 차례(시트 칩이 누를 때마다 다음 것으로) */
export const BASIC_INFO = Object.freeze(['off', 'chip', 'tab']);
export const BASIC_HEIGHT = Object.freeze(['', 's', 'm', 'l']);
export const BASIC_INFO_LABEL = Object.freeze({ off: '끔', chip: '칩', tab: '탭' });
export const BASIC_HEIGHT_LABEL = Object.freeze({ '': '자동', s: '작게', m: '중간', l: '크게' });
const GREY = '#8b8e96';   // 무채(생성기 tones(null) 의 500)
const NAME_EMPTY = /<p class="nm n[A-Z](?: me)?"><\/p>\n?/g;
const LEMON_A = `<a class="lm" href="${LEMON_HOME}" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="lmi"></span></a>`;
const two = n => String(n).padStart(2, '0');
const clockOf = (ms) => { const d = new Date(ms); return ms != null && Number.isFinite(d.getTime()) ? `${two(d.getHours())}:${two(d.getMinutes())}` : ''; };
/** CSS 설명 주석 걷기(앞 공백까지) */
export const stripCssNotes = css => String(css).replace(/[ \t]*\/\*[\s\S]*?\*\//g, '');
const GV = [['gv-log', 'mark'], ['gv-model', 'model'], ['gv-prompt', 'prompt'], ['gv-tab-log', 'tabLog'], ['gv-tab-info', 'tabInfo']];

/**
 * 문단 나누기: 다시 칠한 메시지 노드 → [[{ dlg, html, text }]] — 심플 새 틀(log-copy-simple.js)과 같은 규칙(대사 = 띠를 단 조각 · 굵게 · 기울임은 b · i)에
 * 이름 가림 칸(mask — 글자 = 바탕 색 칸)과 미리보기에서 숨긴 글(spoiler)을 그대로 남기는 것만 더했어요(가린 이름 · 숨긴 글이 드러나지 않게)
 */
export function paragraphs(nodes) {
    const out = [];
    let cur = [];
    const flush = () => {
        while (cur.length && cur[0].br) cur.shift();
        while (cur.length && cur[cur.length - 1].br) cur.pop();
        if (cur.some(p => p.text.trim())) out.push(cur);
        cur = [];
    };
    const inline = (list, ctx) => {   // 조각 안 글만(숨긴 글 속)
        let html = '';
        for (const node of list ?? []) {
            if (node.t === 'text') { let h = esc(node.text); if (ctx.i) h = `<i>${h}</i>`; if (ctx.b) h = `<b>${h}</b>`; html += h; }
            else if (node.t === 'br') html += '<br>';
            else if (node.t === 'el') html += inline(node.children, ctx);
        }
        return html;
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
            else if (node.t === 'el' && node.kind === 'spoiler') {
                const html = spoilerHtml(inline(node.children, ctx), node.sp, !node.block);
                if (node.block) { flush(); cur.push({ dlg: false, html, text: '숨긴 글' }); flush(); } else cur.push({ dlg: false, html, text: '숨긴 글' });
            } else if (node.t === 'el' && node.mask) {
                const s = node.style ?? {}, fill = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(String(s['background-color'] ?? '').trim()) ? s['background-color'].trim() : '#111318';
                const r = /^\d+px$/.test(String(s['border-radius'] ?? '').trim()) ? s['border-radius'].trim() : '4px';
                const text = inline(node.children, {});
                cur.push({ dlg: false, html: `<span style="background-color:${fill};color:${fill};-webkit-text-fill-color:${fill};border-radius:${r}">${text}</span>`, text: text || '　' });
            } else if (node.t === 'el') {
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

/** 문단 하나 → { dlg, html, plain(띠 없는 글 — 메신저 말풍선 안) } */
function paraOf(list, letter) {
    const talk = list.filter(p => p.text.trim());
    const plain = list.map(p => p.html).join('').trim();
    if (talk.every(p => p.dlg) || SIMPLE.quoted.test(list.map(p => p.text).join(''))) return { dlg: true, html: plain, plain };
    let html = '', run = null;
    const close = () => { if (run) html += `<span class="d d${letter}">${run}</span>`; run = null; };
    for (const p of list) { if (p.dlg) run = (run ?? '') + p.html; else { close(); html += p.html; } }
    close();
    return { dlg: false, html: html.trim(), plain };
}

/** 메시지 → 생성기 메시지 { who, name, lead, rest, nr, dl } (글이 없으면 null) */
function messageOf(message, letter, names) {
    const paras = paragraphs(message.nodes).map(list => paraOf(list, letter)).filter(p => p.html);
    if (!paras.length) return null;
    const first = paras.findIndex(p => p.dlg);
    const lead = first > 0 ? paras.slice(0, first).map(p => p.html) : [];
    const rest = first > 0 ? paras.slice(first) : paras;
    const safe = lead.length && /^[^<&\s]/.test(lead[0]);
    return {
        who: letter, name: names ? esc(String(message.name ?? '').trim()) : '', lead, rest: rest.map(p => ({ dlg: p.dlg, html: p.html })),
        nr: lead.length ? (safe ? lead[0] : ' ') : '',   // 442 첫 글자 · 435 같은 사람 이어짐이 읽는 값(첫 글자가 태그면 첫 글자 장식은 건너뛰어요)
        dl: rest.map(p => p.plain).join('<br>'),   // 435 말풍선 안(띠 없이)
        time: message.time,
    };
}

/**
 * @param {string} id 틀 id(card · tab · window …)
 * @param {object} model captureLog() 결과
 * @param {{ mode?: 'light'|'dark', lookup?: Function, fields?: object, names?: boolean, info?: string, height?: string, images?: {src:string, alt?:string}[], lemonLink?: boolean, marks?: boolean }} [o]
 * @returns {{ html: string, letters: Map<string,string>, colors: Map<string,string|null> }}
 */
export function drawBasic(id, model, o = {}) {
    const frame = BASIC_FRAMES.find(f => f.id === id);
    const empty = { html: '', letters: new Map(), colors: new Map() };
    if (!frame || !model?.messages?.length) return empty;
    const mode = o.mode === 'light' ? 'light' : 'dark';
    const who = speakerLetters(model, { main: 'A', second: 'B', lookup: o.lookup });
    const painted = retintModel(model, tone(who.main, { mode, plan: 'B' }), { font: false });
    const names = o.names !== false;
    const msgs = painted.messages.map((message) => messageOf(message, who.letterOf.get(String(message.name ?? '').trim()) ?? 'A', names)).filter(Boolean);
    if (!msgs.length) return empty;
    const f = o.fields ?? {};
    const text = v => esc(String(v ?? '').trim());
    const images = (o.images ?? []).filter(x => x?.src).slice(0, 40);
    const gallery = id.startsWith('gallery');
    const fields = {
        mark: text(f.mark ?? 'LOG'), tabLog: text(f.tabLog) || 'LOG', tabInfo: text(f.tabInfo) || '프롬프트',
        model: text(f.model), prompt: text(f.prompt), date: text(f.date), dateShort: '', page: text(f.page) || '1',
        from: text(f.from), to: text(f.to ?? f.title), subtitle: text(f.subtitle), photos: gallery ? images.length : 0,
    };
    const lower = c => (c ? String(c).toLowerCase() : c);
    const colors = {}, extra = {};
    if (who.colors.get('A')) colors.A = lower(who.colors.get('A'));
    if (who.colors.get('B')) colors.B = lower(who.colors.get('B'));
    for (const [letter, c] of who.colors) if (letter !== 'A' && letter !== 'B') extra[letter] = lower(c) || GREY;
    for (const m of msgs) if (m.who !== 'A' && m.who !== 'B' && !extra[m.who]) extra[m.who] = GREY;
    let html = buildFrame(frame.no, {
        night: mode === 'dark', msgs, text: { title: text(f.title), name1: '', name2: '' }, fields, colors, extra,
        info: o.info === 'chip' || o.info === 'tab' ? o.info : 'off', height: GEN_HEIGHTS[o.height] ? o.height : undefined,
    });
    // <style> 안 설명 주석(/* … */)은 빼요 — 붙일 곳 소독기가 어차피 걷어요(모양 그대로 · 미리보기와 복사 글이 같게)
    html = html.replace(/(<style>)([\s\S]*?)(<\/style>)/, (all, open, css, close) => open + stripCssNotes(css) + close);
    // 시각: 견본 시각(21:04 …)을 메시지 시각으로 — 생성기는 메시지 차례대로 찍어요(436 알림 · 438 기록)
    let at = 0;
    html = html.replace(/<span class="tm">21:\d+<\/span>/g, () => `<span class="tm">${clockOf(msgs[at++]?.time)}</span>`);
    if (!names) html = html.replace(NAME_EMPTY, '');
    // 비운 칸: 빈 제목 · 부제 · 날짜 줄은 빼요(빈 칸이 여백만 남기지 않게)
    html = html.replace(/<div class="tt"><\/div>/g, '').replace(/<p class="(?:sb|dt)"><\/p>\n?/g, '');
    if (gallery) {
        if (!images.length) html = html.replace(/<div class="gf"><div class="gt">\n\n<\/div><\/div>\n?/, '').replace(/<div class="gg">\n\n<\/div>\n?/, '');
        let i = 0, j = 0;
        html = html.replace(/<span class="ph (f\d)"><\/span>/g, (all, tint) => { const img = images[i++]; return img ? `<img class="ph ${tint}" src="${esc(img.src)}" alt="${esc(img.alt || '')}" loading="lazy">` : all; });
        html = html.replace(/<p class="cn">[^<]*<\/p>/g, () => { const img = images[j]; j++; return `<p class="cn">${esc(img?.alt || `#${j}`)}</p>`; });
    }
    // 숨긴 글이 든 문단: <p> 안의 <details> 는 붙인 곳에서 문단을 쪼개요 → 그 문단만 div.blsp-p 로(틀 <style> 에 문단 규칙의 짝을 더해 모양은 그대로)
    html = unparagraphHtml(html);
    if (!o.lemonLink) html = html.split(LEMON_A).join('<span class="lm" title="블루레몬에이드"><span class="lmi"></span></span>');
    if (o.marks) {
        for (const [cls, key] of GV) html = html.replace(new RegExp(`class="([^"]*\\b${cls}\\b[^"]*)"`, 'g'), (all) => `${all} data-f="${key}"`);
        if (fields.date || f.title) html = html.replace(/<div class="tt">([^<]*)<\/div>/, (all, inner) => (inner && inner === text(f.title) ? `<div class="tt" data-f="title">${inner}</div>` : all));
    }
    return { html, letters: who.letterOf, colors: who.colors };
}
