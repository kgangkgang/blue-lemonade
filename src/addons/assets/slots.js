// 캐릭터 에셋 1.6.0 — 답장 뒤 다른 모델이 고르기: 그림 자리(빈 span) · 자리 고르기 · 고르는 모델에게 줄 글 · 대답 읽기.
// 실리태번을 import 하지 않는다 (tools/tests/assets-after-reply.mjs 가 node 로 시험한다).
//
// 왜: 이미지 프롬프트를 켜면 규칙과 그림 목록(캐릭터에 따라 수백 장)이 매 답변 본문 모델에게 간다 — 비싼 모델이면 그만큼 비싸다.
// 켜 두면 본문 모델에게는 아무것도 보내지 않고, 답을 받는 순간 대사 문단 앞 빈 줄에 빈 자리를 넣은 뒤(글은 그 뒤로 안 바뀐다)
// 연결한 (싼) 모델이 자리마다 그림 이름을 골라 extra 에만 적는다. 번역기 · TTS · 다시 쓰기는 자리를 글로 보지 않는다.

export const SLOT_CLASS = 'bl-asset-slot';
/** 저장되는 자리 모양 — 이 모양 그대로만 자리로 본다 (번역기 보호 규칙 · 다시 쓰기 · TTS 도 같은 모양) */
export const slotMarkup = id => `<span class="${SLOT_CLASS}" data-asset-slot="${id}"></span>`;
const SLOT_SOURCE = '<span class="bl-asset-slot" data-asset-slot="([\\w-]+)"></span>';
/** 번역기에 등록할 보호 규칙 (번역하지 않고 제자리에 한 번만) */
export const PROTECT_RE = /<span class="bl-asset-slot" data-asset-slot="[\w-]+"><\/span>/g;
const slotRe = () => new RegExp(SLOT_SOURCE, 'g');
// 그림 확장의 그림 자리 (번호 있든 없든) — 고르는 모델에게 보내는 글에서는 뺀다
const AUTOPIC_SLOT = /<span class="autopic-image-slot"(?: data-autopic-slot="[\w-]+")?>[^<]*<\/span>/g;
const TAG = /\{\{img::/i;

export const slotIds = text => [...String(text ?? '').matchAll(slotRe())].map(match => match[1]);
export const hasAssetTag = text => TAG.test(String(text ?? ''));

/** 그림 자리(에셋 · 그림 확장)를 뺀 글 — 자리만 남은 빈 줄은 하나로 */
export function stripSlots(text) {
    return String(text ?? '').replace(slotRe(), '').replace(AUTOPIC_SLOT, '').replace(/\n{3,}/g, '\n\n');
}

/** 본문 모델에 보내는 글에서 에셋 자리를 뺀다 — 넣은 모양(앞 빈 줄 + 자리)은 통째로, 다른 데 남은 자리도. 자리가 없으면 글 그대로 */
export function stripSlotsForPrompt(text) {
    const s = String(text ?? '');
    if (!s.includes('data-asset-slot')) return s;
    return s.replace(/\r?\n\r?\n<span class="bl-asset-slot" data-asset-slot="[\w-]+"><\/span>(?=\r?\n|$)/g, '').replace(PROTECT_RE, '');
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

/** 이야기 칸: <prose>…</prose> 가 있으면 그 안만, 없으면 글 전체 */
function storyRegion(text) {
    const open = /<prose\b[^>]*>/i.exec(text);
    if (open) {
        const close = text.toLowerCase().indexOf('</prose>', open.index + open[0].length);
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
        if (!stripSlots(next).trim() || /^\s*<\/(?:prose)\b/i.test(after)) continue;
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

/** 고르는 모델에게 보낼 답: 고를 자리는 [ASSET n], 다른 그림 자리는 뺀다 */
export function markedReply(text, ids) {
    let out = String(text ?? '');
    ids.forEach((id, i) => { out = out.split(slotMarkup(id)).join(`[ASSET ${i + 1}]`); });
    return stripSlots(out).trim();
}

/**
 * 고르는 모델에게 보내는 글. rules = 사용자의 그림 규칙(본문 모델용이던 글 — 목록 매크로 자리는 아래 목록을 가리키게), list = 켜진 그림 이름들.
 * @returns {{ role: string, content: string }[]}
 */
export function pickPrompt({ rules = '', list = '', reply = '', count = 1, previous = '', character = '' }) {
    const n = Math.max(1, Number(count) || 1);
    const markers = n === 1 ? 'one marker, [ASSET 1],' : `${n} markers, [ASSET 1] to [ASSET ${n}],`;
    const system = [
        'You pick character images for a finished roleplay reply. You do NOT write, continue or change the story.',
        `The reply contains ${markers} each placed right before a paragraph (usually a line of dialogue).`,
        'For each marker, choose the one image from <available_images> that best fits the paragraph right after it: who speaks or acts there, their expression and the mood. If no image clearly fits, answer none.',
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
        `Answer with exactly ${n} line${n === 1 ? '' : 's'}, one per marker in order, and nothing else:`,
        ...Array.from({ length: n }, (_, i) => `${i + 1}: ${i === 0 ? 'filename.ext' : 'none'}`),
    ].join('\n');
    const prev = stripSlots(previous).trim();
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
