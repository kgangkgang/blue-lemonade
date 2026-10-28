// 캐릭터 에셋 1.6.0 — 답장 뒤 다른 모델이 고르기: 그림 자리(빈 span) · 자리 고르기 · 고르는 모델에게 줄 글 · 대답 읽기.
// 실리태번을 import 하지 않는다 (tools/tests/assets-after-reply.mjs 가 node 로 시험한다). message-work.js 도 순수 함수.
//
// 왜: 이미지 프롬프트를 켜면 규칙과 그림 목록(캐릭터에 따라 수백 장)이 매 답변 본문 모델에게 간다 — 비싼 모델이면 그만큼 비싸다.
// 켜 두면 본문 모델에게는 아무것도 보내지 않고, 답을 받는 순간 대사 문단 앞 빈 줄에 빈 자리를 넣은 뒤(글은 그 뒤로 안 바뀐다)
// 연결한 (싼) 모델이 자리마다 그림 이름을 골라 extra 에만 적는다. 번역기 · TTS · 다시 쓰기는 자리를 글로 보지 않는다.
import { splitName } from './names.js';
import { thinkingHeadEnd } from '../../message-work.js';   // 1.6.8 순수 함수 (실리태번 없음)

export const SLOT_CLASS = 'bl-asset-slot';
/** 저장되는 자리 모양 — 이 모양 그대로만 자리로 본다 (번역기 보호 규칙 · 다시 쓰기 · TTS 도 같은 모양) */
export const slotMarkup = id => `<span class="${SLOT_CLASS}" data-asset-slot="${id}"></span>`;
const SLOT_SOURCE = '<span class="bl-asset-slot" data-asset-slot="([\\w-]+)"></span>';
/** 1.7.3 「이 채팅의 에셋 그림 떼기」가 그림 자리 · {{img::}} 대신 남기는 표시 — 아무것도 그리지 않고 위치만 남는다
 *  (그림 확장이 같은 자리에 제 그림을 넣을 수 있게). 자리와 같은 꼴이라 번역기 · 다시 쓰기 · TTS 가 자리처럼 지킨다 */
export const GONE_CLASS = 'bl-asset-gone';
export const goneMarkup = id => `<span class="${GONE_CLASS}" data-asset-was="${id}"></span>`;
/** 번역기에 등록할 보호 규칙 (번역하지 않고 제자리에 한 번만) — 자리와 뗀 표시 둘 다 */
export const PROTECT_RE = /<span class="bl-asset-(?:slot" data-asset-slot|gone" data-asset-was)="[\w-]+"><\/span>/g;
const slotRe = () => new RegExp(SLOT_SOURCE, 'g');
// 그림 확장의 그림 자리 (번호 있든 없든) — 고르는 모델에게 보내는 글에서는 뺀다
const AUTOPIC_SLOT = /<span class="autopic-image-slot"(?: data-autopic-slot="[\w-]+")?>[^<]*<\/span>/g;
const TAG = /\{\{img::/i;

// 1.6.8 답 머리의 생각 블록 (과일의 마음 ECoT: "[RE:]⏎<ECoT>…</ECoT>⏎본문" — message-work.js thinkingHeadEnd). 과일 ECoT 스크립트가 우리 다음 차례에
//   추론으로 옮기기 전에 읽으면 생각 글이 고르는 모델에게 통째로 갔고(돈 · 오판), 생각 속 「<content>」 언급에 자리가 생각 블록 안으로 들어가 추론으로 쓸려 갔다.
/** 답을 머리의 생각 블록(head)과 본문(body)으로 — 생각 블록이 없으면 head 는 '' */
export function splitThinking(text) {
    const s = String(text ?? ''), end = thinkingHeadEnd(s);
    return end < 0 ? { head: '', body: s } : { head: s.slice(0, end), body: s.slice(end) };
}

export const slotIds = text => [...String(text ?? '').matchAll(slotRe())].map(match => match[1]);
export const hasAssetTag = text => TAG.test(String(text ?? ''));

/** 그림 자리(에셋 · 그림 확장)를 뺀 글 — 자리만 남은 빈 줄은 하나로 */
export function stripSlots(text) {
    return String(text ?? '').replace(slotRe(), '').replace(AUTOPIC_SLOT, '').replace(/\n{3,}/g, '\n\n');
}

/** 본문 모델에 보내는 글에서 에셋 자리를 뺀다 — 넣은 모양(앞 빈 줄 + 자리)은 통째로, 다른 데 남은 자리도. 자리가 없으면 글 그대로 */
export function stripSlotsForPrompt(text) {
    const s = String(text ?? '');
    if (!s.includes('data-asset-slot') && !s.includes('data-asset-was')) return s;
    return s.replace(/\r?\n\r?\n<span class="bl-asset-(?:slot" data-asset-slot|gone" data-asset-was)="[\w-]+"><\/span>(?=\r?\n|$)/g, '').replace(PROTECT_RE, '');
}
/** 기록(extra)이 없는 자리 = 모델이 따라 쓴 것 — 빼고 그 번호들 */
export function dropUnknownSlots(text, records) {
    const known = records && typeof records === 'object' ? records : {};
    const unknown = slotIds(text).filter(id => !Object.prototype.hasOwnProperty.call(known, id));
    let out = String(text ?? '');
    for (const id of unknown) out = out.split(`\n\n${slotMarkup(id)}`).join('').split(slotMarkup(id)).join('');
    return { text: out, unknown };
}
/** 자리 번호 — 채팅 파일에 남으니 짧게, 겹치지 않게 */
export function newSlotId(random = globalThis.crypto) {
    const hex = random?.randomUUID ? random.randomUUID().replace(/-/g, '') : Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `as${hex.slice(0, 12)}`;
}

// 이 갈래의 답에는 자리를 넣지 않는다 (이어 쓰기는 같은 답에 덧붙고, 첫 인사 · 조용한 요청 · 사칭은 대화가 아니다)
const SKIP_TYPES = new Set(['continue', 'append', 'appendFinal', 'first_message', 'quiet', 'impersonate', 'command', 'extension']);
export const skipReplyType = type => SKIP_TYPES.has(String(type || ''));

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'wbr', 'source', 'area', 'col', 'embed', 'param', 'track']);
const TOKEN = /<!--[\s\S]*?-->|```|~~~|<\/?([a-zA-Z][\w:-]*)\b[^>]*>|\r?\n[ \t\r]*\n/g;

/** 이야기 칸: <prose>…</prose>(데우스) · <content>…</content>(과일) 가 있으면 그 안만, 없으면 글 전체
 *  6.5.3 과일 답은 본문이 <content> 안이라 예전엔 안쪽 경계를 모두 「다른 태그 안」으로 건너뛰어 상태창 아래 한 자리만 생겼다 (설정 4장 → 1장, 사용자 10-15) */
const STORY_TAGS = ['prose', 'content'];
function storyRegion(text) {
    for (const tag of STORY_TAGS) {
        const open = new RegExp(`<${tag}\\b[^>]*>`, 'i').exec(text);
        if (!open) continue;
        const close = text.toLowerCase().indexOf(`</${tag}>`, open.index + open[0].length);
        if (close > 0) return [open.index + open[0].length, close];
    }
    return [0, text.length];
}

/**
 * 빈 줄 경계 가운데 다른 태그 · 코드 블록 안이 아니고, 앞 · 뒤 문단이 둘 다 글이며 그림 자리만 든 문단이 아닌 곳 — 글 순서대로.
 * at = 앞 문단 글이 끝나는 곳 (여기에 `\n\n<자리>` 를 넣는다), next = 뒤 문단 글
 * @returns {{ at: number, next: string }[]}
 */
export function paragraphBoundaries(text) {
    const s = String(text ?? '');
    const [start, end] = storyRegion(s);
    const region = s.slice(start, end);
    const stack = [];
    let fence = '', last = 0;
    const out = [];
    for (const m of region.matchAll(TOKEN)) {
        const token = m[0];
        if (token === '```' || token === '~~~') { if (!fence) fence = token; else if (fence === token) fence = ''; continue; }
        if (fence || token.startsWith('<!--')) continue;
        if (m[1]) {
            const name = m[1].toLowerCase();
            if (token.startsWith('</')) { const at = stack.lastIndexOf(name); if (at >= 0) stack.length = at; }
            else if (!token.endsWith('/>') && !VOID.has(name)) stack.push(name);
            continue;
        }
        const before = region.slice(last, m.index);
        last = m.index + token.length;
        if (stack.length || !stripSlots(before).trim()) continue;
        const after = region.slice(last);
        const next = after.split(/\r?\n[ \t\r]*\n/)[0];
        if (!stripSlots(next).trim() || /^\s*<\/(?:prose|content)\b/i.test(after)) continue;
        out.push({ at: start + m.index, next });
    }
    return out;
}

// 문단 앞의 여는 태그(<quiet> · <shout> · <span style="color…"> · <font color> …) · 기울임 표시를 벗긴다. 속마음(<true_thoughts>)은 대사가 아니다.
const LEAD = /^(?:\s+|[*_~]+|<(?!\/)([a-zA-Z][\w:-]*)\b([^>]*)>)/;
const QUOTE_START = /^[「『“"«]/;
const NAME_COLON = /^[^\s:：「『“"<]{1,20}\s*[:：]\s*[「『“"]/;
const NAME_BRACKET = /^[^\s「『<]{1,20}[「『]/;
const HEX_QUOTE = /^#[0-9a-fA-F]{6}[ \t]*[「『“"]/;
/** 이 문단이 대사로 시작하나 (「」 · “” · "…" · 대사 색 span · 이름: 「…」) */
export function isDialogueStart(paragraph) {
    let rest = String(paragraph ?? '');
    let colored = false;
    for (let guard = 0; guard < 20; guard++) {
        const m = LEAD.exec(rest);
        if (!m) break;
        if (m[1]) {
            const name = m[1].toLowerCase();
            if (name === 'true_thoughts' || name === 'think' || name === 'thinking') return false;
            if ((name === 'span' || name === 'font') && /\bcolor\s*[:=]/i.test(m[2])) colored = true;
        }
        rest = rest.slice(m[0].length);
    }
    if (!rest) return false;
    return colored || QUOTE_START.test(rest) || HEX_QUOTE.test(rest) || NAME_COLON.test(rest) || NAME_BRACKET.test(rest);
}

/** 자리 n 개 — 대사 문단 바로 앞 경계 가운데 고르게 (대사가 없으면 모든 경계 가운데). 오름차순 위치 목록, 모자라면 적게 */
export function slotSpots(text, count) {
    const n = Math.max(1, Math.min(4, Math.round(Number(count)) || 1));
    const all = paragraphBoundaries(text);
    const dialogue = all.filter(boundary => isDialogueStart(boundary.next));
    const pool = dialogue.length ? dialogue : all;
    const m = pool.length, picks = [];
    for (let j = 0; j < n; j++) {
        const index = Math.floor((j + 1) * (m + 1) / (n + 1)) - 1;
        if (index >= 0 && index < m && !picks.includes(pool[index].at)) picks.push(pool[index].at);
    }
    return picks.sort((a, b) => a - b);
}

/** 고른 자리에 빈 자리를 독립 문단으로 넣는다 (뒤에서부터 — 위치가 밀리지 않게). ids 는 글 순서대로 */
export function insertSlots(text, spots, makeId = newSlotId) {
    let out = String(text ?? '');
    const sorted = [...new Set(spots)].filter(at => Number.isInteger(at) && at >= 0 && at <= out.length).sort((a, b) => b - a);
    const ids = [];
    for (const at of sorted) {
        const id = makeId();
        out = `${out.slice(0, at)}\n\n${slotMarkup(id)}${out.slice(at)}`;
        ids.unshift(id);
    }
    return { text: out, ids };
}

// 7.2.4 고르는 모델에게는 본문만: 번역기가 번역에 보내지 않는 것(생각 · 주석 · 사용자 보호 규칙)과 그림 쪽 표식 · 상태창 코드 · 태그 껍데기를 뗀다 (token-audit: 요청 4,430자 중 본문 아닌 480자)
const CODE_FENCE = /(^|\n)[ \t]*(```|~~~)[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;
const HTML_TAG = /<\/?[a-zA-Z][\w:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const PICTURE_MARKS = [/<!--[\s\S]*?-->/g, /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, /<pic\b[^>]*>/gi, /\{\{img::[^{}]*\}\}/gi, /<autopic\b[\s\S]*?<\/autopic>/gi, /<(think|thinking|ECoT|scene_plan|scene_reasoning|tableEdit|UpdateVariable)\b[^>]*>[\s\S]*?<\/\1\s*>/gi];
/** 고르는 모델에게 보낼 본문 — strip = 번역기 다리의 stripForModel(있으면) 을 먼저. [ASSET n] 표식이 하나라도 사라지면 원래 글 그대로 */
export function bodyForPicker(text, count, strip = null) {
    let s = String(text ?? '');
    try { if (typeof strip === 'function') s = String(strip(s) ?? ''); } catch { /* 옛 번역기 */ }
    for (const re of PICTURE_MARKS) s = s.replace(new RegExp(re.source, re.flags), '');
    s = s.replace(CODE_FENCE, '$1').replace(HTML_TAG, '').replace(/\n{3,}/g, '\n\n').trim();
    for (let i = 1; i <= count; i++) if (!s.includes(`[ASSET ${i}]`)) return String(text ?? '');
    return s;
}
/** 고르는 모델에게 보낼 답: 고를 자리는 [ASSET n], 다른 그림 자리는 뺀다 */
export function markedReply(text, ids, strip = null) {
    let out = String(text ?? '');
    ids.forEach((id, i) => { out = out.split(slotMarkup(id)).join(`[ASSET ${i + 1}]`); });
    return bodyForPicker(stripSlots(out).trim(), ids.length, strip);
}

/**
 * 고르는 모델에게 보내는 글. rules = 사용자의 그림 규칙(본문 모델용이던 글 — 목록 매크로 자리는 아래 목록을 가리키게), list = 켜진 그림 이름들.
 * @returns {{ role: string, content: string }[]}
 */
export function pickPrompt({ rules = '', list = '', reply = '', count = 1, previous = '', character = '', names = '', persona = '', avoid = [], strip = null }) {
    const n = Math.max(1, Number(count) || 1);
    const markers = n === 1 ? 'one marker, [ASSET 1],' : `${n} markers, [ASSET 1] to [ASSET ${n}],`;
    const system = [
        'You pick character images for a finished roleplay reply. You do NOT write, continue or change the story.',
        `The reply contains ${markers} each placed right before a paragraph (usually a line of dialogue).`,
        'For each marker, choose the one image from <available_images> that best fits the paragraph right after it: the character from <available_images> who speaks, acts or reacts there, with the expression and mood of that moment.',
        // 6.4.1 자리를 채운다 (사용자: 최대 4장인데 1장) — 같은 인물이 이어 말해도 다른 표정으로 · 말하는 사람 그림이 없으면 그 장면의 듣는 · 반응하는 인물
        'Give every marker an image while a character from <available_images> is in the scene. The same character may appear at several markers with different expressions. If the speaker has images, pick the speaker. If the speaker has no images, pick the character from <available_images> they talk to or who reacts. Answer none only when no character from <available_images> is in that moment.',
        // 6.4.1 내 캐릭터(페르소나 — 실행 때 이름): 그 사람 그림이 목록에 있으면 그것, 없으면 듣는 · 반응하는 인물 (사용자 10-13 결정)
        ...(String(persona || '').trim() ? [`The user's own character is ${String(persona).trim().replace(/[\r\n]+/g, ' ')}. When they speak, pick one of their images if <available_images> has any; otherwise pick the character from <available_images> who listens or reacts in that moment.`] : []),
        'Use only exact file names from <available_images>, including the extension. Do not invent, shorten or modify names. Do not pick the same image twice in this reply.',
        'The rules in <image_rules> were written for the story writer. Follow what they say about which images suit which moments; ignore anything about where to put tags, how to write them or how many to use.',
        '',
        '<image_rules>',
        String(rules || '').trim() || '(none)',
        '</image_rules>',
        '',
        '<available_images>',
        String(list || '').trim(),
        '</available_images>',
        '',
        // 6.3.x 그림 주인의 다른 표기 (영 · 한 · 일) — 글이 일본어 · 한국어 이름을 써도 같은 주인의 그림을 고르게. 표기가 없으면 예전과 같은 글
        ...(String(names || '').trim() ? ['The reply may write a name in English, Korean or Japanese. <name_spellings> lists the spellings of each image owner.', '<name_spellings>', String(names).trim(), '</name_spellings>', ''] : []),
        // 6.5.3 메시지 ··· 메뉴의 다시 고르기: 지금 보이던 그림은 피하게 (맞는 다른 그림이 없으면 같은 것도 된다)
        ...((Array.isArray(avoid) ? avoid : []).filter(Boolean).length ? [`The user asked to pick again. These images were shown last time: ${avoid.filter(Boolean).join(', ')}. Prefer different images when another one fits the moment.`, ''] : []),
        `Answer with exactly ${n} line${n === 1 ? '' : 's'}, one per marker in order, and nothing else:`,
        ...Array.from({ length: n }, (_, i) => `${i + 1}: filename.ext`),
        // 6.4.1 예시의 2번~ 'none' 이 비우라고 부추겼다 — 예시는 모두 파일 이름, none 은 그 아래 한 줄로만
        'Write none in place of a file name only when no character from <available_images> is in that moment.',
    ].join('\n');
    const prev = bodyForPicker(stripSlots(previous), 0, strip).trim();   // 7.2.4 앞 메시지도 본문만
    const user = [
        ...(prev ? ['<previous_message>', prev.slice(-1500), '</previous_message>', ''] : []),
        `<finished_reply${character ? ` speaker="${String(character).replace(/"/g, '')}"` : ''}>`,
        String(reply || ''),
        '</finished_reply>',
    ].join('\n');
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** 사용자 규칙 글에서 목록 매크로 자리를 <available_images> 를 가리키게 (목록을 두 번 보내지 않게) */
export function rulesForPicker(prompt, folder = '') {
    return String(prompt ?? '')
        .replace(/\{\{\s*(img_keywords_autogen|img_keywords_grouped|img_keywords)\s*\}\}/gi, '(see <available_images>)')
        .replace(/\{\{\s*charkey\s*\}\}/gi, () => folder);
}

/**
 * 대답 `n: 파일이름` · `n: none` → 자리마다 이름('' = 없음) · 대답이 없으면 null. 같은 번호가 여럿이면 마지막 것 (생각을 앞에 쓰는 모델).
 * {{img::이름}} · 따옴표 · 백틱 · 끝 문장부호는 벗긴다.
 * @returns {(string|null)[]}
 */
export function parsePicks(raw, count) {
    const n = Math.max(0, Number(count) || 0);
    const out = new Array(n).fill(null);
    const text = String(raw ?? '').replace(/<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    for (const line of text.split(/\r?\n/)) {
        const m = /^\s*[-*]?\s*\[?(?:ASSET\s*)?(\d{1,2})\]?\s*[:：.)-]\s*(.*?)\s*$/i.exec(line);
        if (!m) continue;
        const i = Number(m[1]) - 1;
        if (i < 0 || i >= n) continue;
        const name = m[2]
            .replace(/^\{\{\s*img::\s*/i, '').replace(/\s*\}\}$/, '')
            .replace(/^[`"'“”‘’「」『』*]+/, '').replace(/[`"'“”‘’「」『』*.,;]+$/, '')
            .trim();
        out[i] = !name || /^(?:none|no image|없음|n\/a|-)$/i.test(name) ? '' : name;
    }
    return out;
}

// ── 자리 기록 (메시지 extra.bl_asset_slots[자리 번호] = { name, pending, error?, asked?, repeat? }) ──

export const RECORD_KEY = 'bl_asset_slots';
/** 1.7.6 「에셋 그림 떼기」가 뗀 자리의 선택(자리 기록 · {{img::}} 원문)을 숨겨 두는 칸 — extra.bl_asset_gone_slots[뗀 자리 id] = 기록 | { tag }.
 *  화면에 그리지 않고, 「그림 확장 그림을 에셋으로」가 같은 자리를 모델 없이 되살릴 때만 읽는다 (from-pictures.js) */
export const GONE_KEY = 'bl_asset_gone_slots';
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const swipeOf = message => Number(message?.swipe_id) || 0;
export const textOf = (message, swipe) => swipeOf(message) === swipe ? String(message.mes ?? '') : String(message.swipes?.[swipe] ?? '');

/** 자리 기록 쓰기 — 지금 스와이프면 extra 와 swipe_info 거울 둘 다, 다른 스와이프로 넘어갔으면 그 스와이프의 swipe_info 에만 */
export function writeRecords(message, swipe, records) {
    const targets = [];
    if (swipeOf(message) === swipe) {
        if (!isObj(message.extra)) message.extra = {};
        targets.push(message.extra);
    }
    const info = Array.isArray(message.swipe_info) ? message.swipe_info[swipe] : null;
    if (isObj(info)) {
        if (!isObj(info.extra)) info.extra = {};
        if (!targets.includes(info.extra)) targets.push(info.extra);
    }
    const alive = new Set(slotIds(textOf(message, swipe)));
    for (const extra of targets) {
        const map = isObj(extra[RECORD_KEY]) ? extra[RECORD_KEY] : (extra[RECORD_KEY] = {});
        for (const [id, record] of Object.entries(records)) map[id] = { ...record };
        for (const id of Object.keys(map)) if (!alive.has(id)) delete map[id];   // 글에 없는 자리는 지운다 (다시 뽑은 답 · 지운 자리)
    }
}

/** 고른 이름들 → 자리 기록. 모르는 이름 = 없음, 같은 그림이 앞에 이미 있고 번호 묶음이 없으면 없음 */
export function recordsFromPicks(ids, picks, info) {
    const records = {};
    const used = new Set();
    ids.forEach((id, i) => {
        const name = picks[i];
        if (name === null || name === undefined) { records[id] = { name: '', pending: false, error: 'missing' }; return; }
        const asset = name ? info(name) : null;
        if (!asset) { records[id] = { name: '', pending: false, ...(name ? { asked: String(name).slice(0, 120) } : {}) }; return; }
        const key = asset.variants ? null : asset.file.toLowerCase();
        if (key && used.has(key)) { records[id] = { name: '', pending: false, repeat: asset.file }; return; }
        if (key) used.add(key);
        records[id] = { name: asset.file, pending: false };
    });
    return records;
}

// ── 꾹 눌러 「이 자리만」 (hold.js → viewer.js 의 「이 자리」 줄 → after-reply.js setSlotPick) ──
// 답장의 그림 하나를 꾹 누르면 그 자리만 같은 캐릭터의 다른 그림으로 바꾸거나 뺀다. 그 메시지 · 그 스와이프의 그 자리 기록만 바뀐다
// (다른 자리 · 다른 채팅 · 파일은 그대로). 사용자가 정한 자리(manual)는 다시 고르기가 건드리지 않고, 번호 묶음 고르기도 그 파일 그대로 그린다.

/** 사용자가 정한 자리 기록 — name = 파일 이름, '' = 빼기 */
export const manualRecord = name => ({ name: String(name ?? ''), pending: false, manual: true });
export const isManual = record => isObj(record) && record.manual === true;

/**
 * 한 자리를 손으로 정할 때 같은 답장의 다른 자리(그림이 보이는 자동 자리)를 지금 보이는 파일로 같이 고정한다 — shown = { 자리 id: 보이는 파일 }.
 * 번호 묶음 고르기는 답장의 그림을 차례로 보며 묶음 안에서 안 쓴 번호를 고르므로, 한 자리만 빠지거나 바뀌면 뒤 자리의 번호가 같이 바뀐다. 고정해 두면 그대로다.
 * 이미 정한 자리 · 고르는 중 · 빈 자리는 건드리지 않는다
 */
export function freezeOthers(map, shown, slotId) {
    const records = isObj(map) ? map : {};
    const out = {};
    for (const [id, file] of Object.entries(isObj(shown) ? shown : {})) {
        const record = records[id];
        if (id === slotId || !file || !isObj(record) || isManual(record) || record.pending || !record.name) continue;
        out[id] = manualRecord(file);
    }
    return out;
}

/** 다시 고르기 단추가 다시 물을 자리: 누른 자리 + 비었거나 실패 · 끊긴 자리. 사용자가 정한 자리는 빼고 */
export function retryTargets(ids, map, running, slotId) {
    const records = isObj(map) ? map : {};
    const busy = id => !!running?.has?.(id);
    return ids.filter(id => id === slotId || (!isManual(records[id]) && !records[id]?.name && (records[id]?.error || (records[id]?.pending && !busy(id)))));
}

const NAME_ORDER = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const baseName = asset => String(asset?.base ?? String(asset?.file ?? '').replace(/\.[^.]+$/, ''));
const ownerKey = asset => splitName(baseName(asset))?.owner.toLowerCase() ?? '';
/** 번호 묶음 이름 (assets.js groupLabelOf 와 같은 규칙: Name_smile-1 → Name_smile) — 같은 표정은 번호 없는 파일부터 붙여 놓는다 */
const groupOf = asset => baseName(asset).replace(/[-_.]\d+$/, '');
function choiceOrder(a, b) {
    const ga = groupOf(a), gb = groupOf(b);
    const byGroup = NAME_ORDER.compare(ga, gb);
    if (byGroup) return byGroup;
    const ea = baseName(a).toLowerCase() === ga.toLowerCase(), eb = baseName(b).toLowerCase() === gb.toLowerCase();
    if (ea !== eb) return ea ? -1 : 1;
    return NAME_ORDER.compare(a.file, b.file);
}

/**
 * 「이 자리」 창에서 ‹ › 로 넘길 그림: 지금 그림과 같은 캐릭터(이름 앞머리 — Name_smile 의 Name)의 그림, 표정(번호 묶음)끼리 이름순 — 번호 없는 파일이 먼저.
 * 앞머리가 없거나 그 캐릭터의 다른 그림이 없으면 목록 전부. 꺼 둔 그림 · 이 답장에 이미 나온 그림 · 지금 그림과 이름이 같은 다른 폴더 파일은 뺀다 (지금 그림은 늘 남긴다).
 * @template {{ file: string, base?: string }} A
 * @param {A[]} assets 켜진 폴더를 합친 목록 (store.js runtime.assets)
 * @param {A} current 지금 그 자리에 보이는 그림
 * @param {{ shown?: Iterable<string>, off?: (asset: A) => boolean }} [options] shown = 이 답장의 다른 그림 파일 이름
 * @returns {{ items: A[], start: number }}
 */
export function slotChoices(assets, current, { shown = [], off = () => false } = {}) {
    const list = Array.isArray(assets) ? assets.filter(asset => asset && asset.file) : [];
    const owner = current ? ownerKey(current) : '';
    const mine = owner ? list.filter(asset => ownerKey(asset) === owner) : [];
    const pool = mine.some(asset => asset !== current) ? mine : list;
    const seen = new Set([...shown].map(file => String(file).toLowerCase()));
    const own = String(current?.file ?? '').toLowerCase();
    const items = pool.filter(asset => asset === current || (String(asset.file).toLowerCase() !== own && !off(asset) && !seen.has(String(asset.file).toLowerCase())));
    if (current && !items.includes(current)) items.push(current);
    items.sort(choiceOrder);
    return { items, start: Math.max(0, items.indexOf(current)) };
}

/**
 * 화면에 무엇을 보일까 — 'img'(name) · 'wait'(고르는 중) · 'retry'(reason) · 'none'(없음 · 모르는 자리)
 * running = 이 페이지에서 지금 고르는 중인가 (pending 인데 아니면 새로 고침 등으로 끊긴 것)
 */
const REASONS = { missing: '대답이 모자랐어요', stale: '고르다 끊겼어요' };
export function slotView(record, running = false) {
    if (!isObj(record)) return { state: 'none' };
    if (record.name) return { state: 'img', name: String(record.name) };
    if (record.pending) return running ? { state: 'wait' } : { state: 'retry', reason: REASONS.stale };
    if (record.error) return { state: 'retry', reason: REASONS[record.error] ?? String(record.error).slice(0, 60) };
    return { state: 'none' };
}
