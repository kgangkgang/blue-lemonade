// 1.6.0 미트볼 문구: 블루레몬 추천 — 미트볼 상태창이 「상태창 만들기 · 칸 다시 생성 · AI로 수정」 때 보내는 글 끝에 테마가 쓴 줄을 덧붙이는 설정이에요(기본 「적용 안 함」).
// 11-16 사용자 「재생성해도 기존 채팅들 반영 안 되는 것 같음」 「앞 700자는 어캐 못 바꾸나」 「블루레몬 추천 프롬프트 프리셋 설정 가능하게」:
//   그 확장은 다시 만들 때 최근 채팅을 메시지마다 앞 몇백 자만 읽어요(재료를 모으는 코드 쪽 · 문구로는 못 늘려요). 대신 사용자가 고칠 수 있는 문구(프롬프트 · 토큰 › 수정)는
//   보내기 직전에 실리태번 매크로 치환을 거쳐요 — 그래서 문구 끝에 「최근 답 본문」 매크로를 덧붙이면 재료가 늘어요.
//   원작 파일은 안 고쳐요. 사용자가 화면에서 고칠 수 있는 **설정 값 하나**(생성 시스템 프롬프트)만 바꿔요 — 그 확장이 손으로 고친 문구를 넣어 두는 자리와 같은 자리예요.
//   테마에는 원작 문구를 담지 않아요: 덧붙이는 줄(아래 · 테마가 쓴 글)만 갖고 있고, 지금 문구는 그때 그 확장에게서 읽어요.
//   · 덧붙인 줄은 머리 · 꼬리 표식 사이에 있어요 → 되돌리기 = 그 사이만 떼기(사용자가 손으로 고친 앞부분은 글자 하나 안 바뀌어요 · 적용 뒤 손으로 더 고친 것도 살아요).
//   · 떼고 난 글이 원작 기본 문구와 같으면 고친 문구 칸을 비워요(그 확장의 「기본값」 과 같은 상태 — 원작이 문구를 바꾸면 따라가요).
//   · 기본 문구 위에 덧붙였으면 꼬리 표식에 그때 기본 문구의 지문을 적어 둬요 → 원작이 기본 문구를 바꾼 뒤 다시 맞출 때 새 기본 문구 위로 옮겨요(손으로 고친 글이면 안 옮겨요).
//   · 그 확장이 없거나 · 문구 자리를 못 찾으면(다른 판) 아무것도 안 바꾸고 까닭을 돌려줘요.
// 1.6.1: 단계가 「적용 안 함」 이 아니면 본편 출력 규칙 · 별도 분석 문구 끝에 「줄 꼴 규칙」 한 덩이도 같이 붙여요(아래 RULE_KEYS · syncRules).
// 단계: off(적용 안 함) · light(지시 줄만) · last(+ 마지막 답 전체 — 실리태번 매크로) · recent(+ 최근 답 여러 개 — 테마 매크로 {{bl_mb_recent}}) · all(+ 채팅 전체 — 테마 매크로 {{bl_mb_all}})
// 「채팅 전체」(11-16 사용자 「채팅 전체 만들어줘」): 보이는 메시지 전부의 본문(내 메시지 포함 · 이름 붙여 · 차례대로 · 눈 감긴 메시지 · 꾸밈 태그 · 상태 블록 제외)을 실어요.
//   토큰이 크게 느는 단계라: 설정 줄에 지금 채팅 기준 어림을 숫자로 · 요청 1회 상한(넘으면 오래된 메시지부터 앞 1,000자로 줄이고, 그래도 넘으면 오래된 것부터 뺌) · 고를 때 확인 창(src/panel.js).
//   「이번 한 번만」: 단계는 그대로 두고 다음 생성 묶음에만 채팅 전체를 실어요 — 그 확장이 요청을 보낼 때마다 매크로가 불리는 것으로 시작을 알고,
//   마지막 요청 뒤 한동안(ONCE_IDLE) 조용하거나 · 누른 뒤 ONCE_WAIT 안에 요청이 없으면 원래 단계로 돌려놓고 알려요(그 확장은 생성 시작 · 끝 사건을 내지 않아요).
//   새로 고쳐도 돌아가게 이 기기 저장소에 끝날 때를 적어 둬요(src/apply.js 가 그 표시가 있으면 모듈을 받아요).
const META = 'statussim';        // 그 확장의 설정 칸 이름(읽고 · prompts 한 칸만 씀)
export const KEY = 'gen.system'; // 「생성 시스템 프롬프트」 — 상태창 만들기 · 칸 다시 생성 · AI로 수정이 모두 쓰는 칸
export const LEVELS = ['off', 'light', 'last', 'recent', 'all'];
export const MACRO = 'bl_mb_recent', MACRO_ALL = 'bl_mb_all';
export const DEFAULT_COUNT = 9, DEFAULT_CHARS = 2000, FULL_CAP = 40000;
export const DEFAULT_CAP = 120000, HEAD_CHARS = 1000;   // 채팅 전체: 요청 1회 상한(어림 토큰 · 0 = 없음) · 상한을 넘을 때 오래된 메시지에 남기는 앞 글자 수
export const ONCE_KEY = 'bl-mb-prompt-once', ONCE_WAIT = 10 * 60000, ONCE_IDLE = 4 * 60000;
const SEP = '\n\n';
const BEGIN = '=== BLUE LEMONADE NOTE ===';
const END_RE = /=== END BLUE LEMONADE NOTE(?: \[d:([0-9a-f]{8})\])? ===/;
const BLOCK_RE = /(?:\r?\n){0,2}=== BLUE LEMONADE NOTE ===[\s\S]*?=== END BLUE LEMONADE NOTE(?: \[d:[0-9a-f]{8}\])? ===/g;

// 덧붙이는 글(테마가 쓴 글 · 그 확장이 영어로 보내는 요청에 맞춰 영어)
const LIGHT = [
    'The RECENT CHAT / RECENT STORY excerpts keep only the opening few hundred characters of each message, so they miss most of what happened.',
    'Where the story text (the excerpts, and any fuller text below) disagrees with the character card or lorebook about the present situation, who is in the scene, or how people stand with each other, follow the story text.',
    'Do not add a person who appears in none of the sources.',
    'Use one spelling per name: reuse the exact spelling already used in the current panel data and the sources, and never list the same person twice under different spellings or translations.',
].join('\n');
const LAST = '\n\n--- LATEST STORY TURN (complete text of the newest reply) ---\n{{lastCharMessage}}';
const RECENT = `\n\n--- LATEST STORY TURNS (oldest first; only the newest is complete, older ones are shortened) ---\n{{${MACRO}}}`;
const ALL = `\n\n--- THE STORY SO FAR (every visible message, oldest first) ---\n{{${MACRO_ALL}}}`;

// 1.6.1 줄 꼴 규칙 — 본편 AI 가 답 끝에 적는 변화 줄(<meatball>)의 꼴을 바로잡는 한 덩이예요(테마가 쓴 글 · 예시도 테마가 지은 것).
//   사용자 채팅에서 본 두 가지: ① 「period: Evening -> Night」 · 「loc: 집 -> 편의점」 처럼 「앞 -> 뒤」 로 적으면 그 확장은 글 통째를 시간 · 장소 값으로 받아요(새 이름의 지도 칸까지 생겨요)
//   ② 「npc: -A, -B, +C」 처럼 한 줄에 여럿을 적으면 줄이 통째로 버려지고, 「+A | 설명, +B | 설명」 은 첫 사람만 들어가요(그 확장의 npc 줄은 한 사람 소개 전용 · 빼기 뜻이 없어요).
//   이 줄들은 「생성 시스템 프롬프트」 가 아니라 **출력 규칙 문구**(본편 생성마다 실리는 칸 둘)와 **별도 분석 문구**에 붙어야 들어요 → 단계가 「적용 안 함」 이 아니면 그 세 칸 끝에 같은 한 덩이를 덧붙여요.
//   떼기 · 손으로 고친 문구 보존 · 기본 문구가 바뀌면 따라가기는 위 덩어리와 같은 방식이에요(표식만 달라요). 그 확장 판에 그 칸이 없으면 그 칸은 건너뛰어요.
export const RULE_KEYS = ['inj.output', 'inj.ultra.output', 'ai.analyze'];
const RULES = 'period (time) and loc lines carry only the NEW value, e.g. "period: Night" or "loc: Corner bakery"; never write "old -> new". '
    + 'An npc line introduces exactly ONE new person, e.g. "npc: Mira | florist next door"; use a separate npc line for each person, never join several names with commas, and never write "-Name" for people who leave.';
const R_BEGIN = '[BL LINE RULES]';
const R_END_RE = /\[\/BL LINE RULES(?: d:([0-9a-f]{8}))?\]/;
const R_BLOCK_RE = /(?:\r?\n)?\[BL LINE RULES\][\s\S]*?\[\/BL LINE RULES(?: d:[0-9a-f]{8})?\]/g;
/** 줄 꼴 규칙 한 덩이 — d 는 기본 문구 위에 붙일 때의 기본 문구 지문 */
export const ruleBlock = (d = '') => `${R_BEGIN} ${RULES} [/BL LINE RULES${d ? ` d:${d}` : ''}]`;
export const stripRules = text => String(text ?? '').replace(R_BLOCK_RE, '');
export const hasRules = text => String(text ?? '').includes(R_BEGIN);

const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };
const level = v => (LEVELS.includes(v) ? v : 'off');
/** 짧은 지문(글이 같은지 가리는 데만 써요) */
export function mark8(text) {
    let h = 0x811c9dc5; const s = String(text ?? '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
}
/** 덧붙이는 덩어리 — d 는 기본 문구 위에 붙일 때의 기본 문구 지문 */
export function block(lv, d = '') {
    const body = LIGHT + (lv === 'last' ? LAST : lv === 'recent' ? RECENT : lv === 'all' ? ALL : '');
    return `${BEGIN}\n${body}\n=== END BLUE LEMONADE NOTE${d ? ` [d:${d}]` : ''} ===`;
}
/** 테마가 덧붙인 덩어리를 뗀 글 */
export const strip = text => String(text ?? '').replace(BLOCK_RE, '');
/** 지금 글에 붙어 있는 단계 */
export function levelOf(text) {
    const s = String(text ?? '');
    if (!s.includes(BEGIN)) return 'off';
    return s.includes(`{{${MACRO_ALL}}}`) ? 'all' : s.includes(`{{${MACRO}}}`) ? 'recent' : s.includes('{{lastCharMessage}}') ? 'last' : 'light';
}

/** 그 확장의 기본 문구를 그 확장에게서 읽어요(같은 모듈 주소 — 새로 띄우지 않아요). 못 찾으면 null */
export async function readDefault(doc = globalThis.document, load = url => import(url)) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;   // 주소가 다르면 모듈이 한 벌 더 떠요 — 그럴 바엔 안 읽어요
        const mod = await load(new URL('./src/prompts.js', src).href);
        const text = mod?.PROMPT_MAP?.[KEY]?.text;
        return typeof text === 'string' && text ? text : null;
    } catch { return null; }
}

/** 그 확장의 기본 문구 여러 칸을 한 번에 읽어요 → { 칸: 글 } (없는 칸은 빠져요) · 못 읽으면 null */
export async function readDefaults(keys, doc = globalThis.document, load = url => import(url)) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;
        const map = (await load(new URL('./src/prompts.js', src).href))?.PROMPT_MAP;
        if (!map || typeof map !== 'object') return null;
        const out = {};
        for (const k of keys) { const t = map[k]?.text; if (typeof t === 'string' && t) out[k] = t; }
        return out;
    } catch { return null; }
}
/**
 * 줄 꼴 규칙을 출력 규칙 · 별도 분석 문구에 붙이거나(on) 떼요. 돌려주는 것: { ok, changed(바뀐 칸 수), keys(붙어 있는 칸) }
 *   그 확장 설정이 없거나 기본 문구를 못 읽으면 아무것도 안 바꿔요(ok: false).
 */
export async function syncRules(on, { c = ctx(), defs = undefined, doc = globalThis.document } = {}) {
    const set = c?.extensionSettings?.[META];
    if (!set || typeof set !== 'object' || (set.prompts != null && typeof set.prompts !== 'object')) return { ok: false, changed: 0, keys: [] };
    const bases = defs === undefined ? await readDefaults(RULE_KEYS, doc) : defs;
    if (!bases || typeof bases !== 'object') return { ok: false, changed: 0, keys: [] };
    let changed = 0; const keys = [];
    for (const key of RULE_KEYS) {
        const base0 = bases[key];
        if (typeof base0 !== 'string' || !base0) continue;                    // 이 판에는 그 칸이 없어요
        const has = typeof set.prompts?.[key] === 'string';
        const cur = has ? set.prompts[key] : base0;
        let base = stripRules(cur);
        const was = cur.match(R_END_RE)?.[1];
        if (was && mark8(base) === was) base = base0;                         // 기본 문구 위에 붙여 둔 글 — 원작이 기본 문구를 바꿨으면 새 기본 문구로
        const next = on ? `${base}\n${ruleBlock(base === base0 ? mark8(base0) : '')}` : base;
        if (on) keys.push(key);
        if (next === cur) continue;
        if (next === base0) { if (set.prompts) delete set.prompts[key]; }
        else (set.prompts ??= {})[key] = next;
        changed++;
    }
    if (changed) { try { c.saveSettingsDebounced?.(); } catch { /* 다음 저장 때 */ } }
    return { ok: true, changed, keys };
}
/** 줄 꼴 규칙이 본편 답마다 더하는 토큰 어림 */
export const ruleTokens = () => tokens(ruleBlock('00000000'));

/**
 * 그 확장의 문구 설정을 단계에 맞춰요. 돌려주는 것: { ok, changed, why, level }
 *   why: 'none'(그 확장 설정 없음) · 'shape'(기본 문구를 못 읽음 — 다른 판) · ''(됨)
 */
export async function syncPrompt(want, { c = ctx(), def = undefined, doc = globalThis.document } = {}) {
    const lv = level(want);
    const set = c?.extensionSettings?.[META];
    if (!set || typeof set !== 'object') return { ok: false, changed: false, why: 'none', level: lv };
    const base0 = def === undefined ? await readDefault(doc) : def;
    if (typeof base0 !== 'string' || !base0) return { ok: false, changed: false, why: 'shape', level: lv };
    if (set.prompts != null && typeof set.prompts !== 'object') return { ok: false, changed: false, why: 'shape', level: lv };
    const has = typeof set.prompts?.[KEY] === 'string';
    const cur = has ? set.prompts[KEY] : base0;
    let base = strip(cur);
    // 기본 문구 위에 붙여 둔 글인데 원작이 기본 문구를 바꿨으면 새 기본 문구로 옮겨요
    const was = cur.match(END_RE)?.[1];
    if (was && mark8(base) === was) base = base0;
    const onDefault = base === base0;
    const next = lv === 'off' ? base : base + SEP + block(lv, onDefault ? mark8(base0) : '');
    if (next === cur) return { ok: true, changed: false, why: '', level: lv };
    if (next === base0) { if (set.prompts) delete set.prompts[KEY]; }
    else (set.prompts ??= {})[KEY] = next;
    try { c.saveSettingsDebounced?.(); } catch { /* 다음 저장 때 */ }
    return { ok: true, changed: true, why: '', level: lv };
}

// ── 「최근 답 여러 개」 매크로 ─────────────────────────────
/** 재료로 보낼 본문: 꾸밈 태그 · HTML · 상태 블록을 걷어내고 빈 줄을 줄여요 */
export function plain(text) {
    return String(text ?? '')
        .replace(/<(meatball|status)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
        .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
/** 눈 감긴 메시지를 뺀 최근 메시지: 가장 새 AI 답은 전체, 그 앞 count 개는 chars 자씩(오래된 것부터) */
export function recentText(c = ctx(), count = DEFAULT_COUNT, chars = DEFAULT_CHARS) {
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    const n = Math.max(0, Math.min(40, Math.round(Number(count)) || 0)), m = Math.max(200, Math.min(20000, Math.round(Number(chars)) || DEFAULT_CHARS));
    const seen = chat.filter(x => x && !x.is_system && typeof x.mes === 'string');
    let last = -1;
    for (let i = seen.length - 1; i >= 0; i--) if (!seen[i].is_user) { last = i; break; }
    if (last < 0) return '';
    const out = [];
    for (let i = Math.max(0, last - n); i <= last; i++) {
        const body = plain(seen[i].mes);
        if (!body) continue;
        out.push(`${seen[i].name || (seen[i].is_user ? 'User' : 'Character')}: ${i === last ? cut(body, FULL_CAP) : cut(body, m)}`);
    }
    return out.join('\n\n');
}
/** 넉넉하게 잡은 토큰 어림(채팅 전체용): 한글은 글자마다 0.7 · 한자 · 가나는 글자마다 1 · 그 밖은 세 글자 반에 하나 — 실제보다 적게 나오지 않게 */
export function tokensSafe(text) {
    const s = String(text ?? '');
    const ko = (s.match(/[\u3131-\u318E\uAC00-\uD7A3]/g) || []).length, cjk = (s.match(/[\u3040-\u30FF\u3400-\u9FFF]/g) || []).length;
    return Math.ceil(ko * 0.7 + cjk + (s.length - ko - cjk) / 3.5);
}
/**
 * 채팅 전체: 눈 감긴 메시지를 뺀 모든 메시지(내 메시지 포함)를 이름 붙여 차례대로.
 * cap(어림 토큰 · 0 이면 없음)을 넘으면 오래된 메시지부터 앞 HEAD_CHARS 자로 줄이고, 다 줄여도 넘으면 오래된 것부터 빼요(가장 새 메시지는 남겨요).
 * 돌려주는 것: { text, count(실린 메시지 수), total(보이는 메시지 수), cut(줄인 수), dropped(뺀 수), tokens(어림), full(상한 없을 때 어림) }
 */
export function allText(c = ctx(), cap = DEFAULT_CAP) {
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    const rows = [];
    for (const x of chat) {
        if (!x || x.is_system || typeof x.mes !== 'string') continue;
        const body = plain(x.mes);
        if (body) rows.push({ head: `${x.name || (x.is_user ? 'User' : 'Character')}: `, body, cut: false, drop: false });
    }
    const size = r => (r.drop ? 0 : tokensSafe(r.head + r.body) + 1);
    let sum = rows.reduce((a, r) => a + size(r), 0);
    const full = sum, limit = Math.max(0, Math.round(Number(cap)) || 0);
    if (limit && sum > limit) {
        for (let i = 0; i < rows.length - 1 && sum > limit; i++) {
            const r = rows[i]; if (r.body.length <= HEAD_CHARS) continue;
            const before = size(r); r.body = `${r.body.slice(0, HEAD_CHARS)}…`; r.cut = true; sum += size(r) - before;
        }
        for (let i = 0; i < rows.length - 1 && sum > limit; i++) { sum -= size(rows[i]); rows[i].drop = true; }
    }
    const kept = rows.filter(r => !r.drop);
    return { text: kept.map(r => r.head + r.body).join('\n\n'), count: kept.length, total: rows.length, cut: kept.filter(r => r.cut).length, dropped: rows.length - kept.length, tokens: sum, full };
}
/** 토큰 어림(한글은 두 글자에 하나쯤, 그 밖은 네 글자에 하나쯤) */
export function tokens(text) {
    const s = String(text ?? ''); const ko = (s.match(/[ㄱ-힣]/g) || []).length;
    return Math.ceil(ko / 2 + (s.length - ko) / 4);
}
/** 단계마다 요청 1회에 더 드는 토큰 어림(지금 채팅 기준) */
export function estimate(lv, c = ctx(), count = DEFAULT_COUNT, chars = DEFAULT_CHARS, cap = DEFAULT_CAP) {
    lv = level(lv);
    if (lv === 'off') return 0;
    const fixed = tokens(block('light', '00000000'));
    if (lv === 'light') return fixed;
    if (lv === 'all') return fixed + allText(c, cap).tokens;
    if (lv === 'recent') return fixed + tokens(recentText(c, count, chars));
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    let mes = '';
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i] && !chat[i].is_user && !chat[i].is_system) { mes = String(chat[i].mes ?? ''); break; }
    return fixed + tokens(mes);
}

const state = { level: 'off', count: DEFAULT_COUNT, chars: DEFAULT_CHARS, cap: DEFAULT_CAP, macro: false, timer: null, last: null, once: null, onceTimer: null };
function ensureMacro(c = ctx()) {
    if (state.macro || typeof c?.registerMacro !== 'function') return state.macro;
    try {
        c.registerMacro(MACRO, () => { try { return recentText(ctx(), state.count, state.chars); } catch { return ''; } }, '블루레몬: 눈 감긴 답을 뺀 최근 답 본문(미트볼 문구용)');
        c.registerMacro(MACRO_ALL, () => { try { onceSeen(); return allText(ctx(), state.cap).text; } catch { return ''; } }, '블루레몬: 눈 감긴 메시지를 뺀 채팅 전체 본문(미트볼 문구용)');
        state.macro = true;
    } catch { /* 이 판에는 매크로 등록이 없어요 */ }
    return state.macro;
}

// ── 「이번 한 번만 채팅 전체로」 ─────────────────────────────
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const now = () => Date.now();
function readOnce() {
    if (state.once) return state.once;
    try { const until = Number(store()?.getItem(ONCE_KEY)); if (Number.isFinite(until) && until > 0) state.once = { until, seen: 0 }; } catch { /* 표시 없이 */ }
    return state.once;
}
export const onceActive = () => { const o = readOnce(); return !!o && o.until > now(); };
function watchOnce() {
    if (state.onceTimer) { try { clearTimeout(state.onceTimer); } catch { /* 그대로 */ } state.onceTimer = null; }
    const o = state.once; if (!o || !globalThis.setTimeout) return;
    state.onceTimer = setTimeout(() => { state.onceTimer = null; endOnce().catch(() => { /* 다음 맞추기에 */ }); }, Math.max(1000, o.until - now()));
}
/** 그 확장이 요청을 보낼 때(매크로가 불릴 때): 그때부터는 「마지막 요청 뒤 ONCE_IDLE」 로 끝을 잡아요 */
function onceSeen() {
    const o = state.once; if (!o || o.until <= now()) return;
    o.seen++; o.until = now() + ONCE_IDLE;
    try { store()?.setItem(ONCE_KEY, String(o.until)); } catch { /* 표시 없이 */ }
    watchOnce();
}
/** 누르면: 다음 생성 묶음에만 채팅 전체. 걸었으면 true */
export async function armOnce({ c = ctx(), doc = globalThis.document, toast = globalThis.toastr, def = undefined } = {}) {
    if (!ensureMacro(c)) { try { toast?.warning?.('이 실리태번 판은 매크로 등록이 없어 채팅 전체를 실을 수 없어요.', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ } return false; }
    state.once = { until: now() + ONCE_WAIT, seen: 0 };
    const r = await syncPrompt('all', { c, doc, def });
    if (r.ok) await syncRules(true, { c, doc }).catch(() => null);
    if (!r.ok) { state.once = null; try { toast?.warning?.(r.why === 'none' ? '미트볼 상태창 설정을 못 찾았어요.' : '미트볼의 「생성 시스템 프롬프트」 자리를 못 찾았어요(다른 판).', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ } return false; }
    try { store()?.setItem(ONCE_KEY, String(state.once.until)); } catch { /* 이 세션에서만 */ }
    watchOnce();
    try { toast?.info?.('다음 미트볼 생성(상태창 만들기 · 칸 다시 생성 · AI로 수정)에 채팅 전체를 실어요. 끝나거나 10분 안에 안 만들면 원래 단계로 돌아가요.', '', { timeOut: 9000 }); } catch { /* 알림 없이 */ }
    return true;
}
/** 끝: 원래 단계로. 돌려놨으면 true */
export async function endOnce({ c = ctx(), doc = globalThis.document, toast = globalThis.toastr, force = false, def = undefined } = {}) {
    const o = readOnce(); if (!o) return false;
    if (!force && o.until > now()) { watchOnce(); return false; }
    const seen = o.seen;
    state.once = null; if (state.onceTimer) { try { clearTimeout(state.onceTimer); } catch { /* 그대로 */ } state.onceTimer = null; }
    try { store()?.removeItem(ONCE_KEY); } catch { /* 표시 없이 */ }
    state.last = await syncPrompt(state.level, { c, doc, def });
    await syncRules(state.level !== 'off', { c, doc }).catch(() => null);
    try { toast?.info?.(seen ? `채팅 전체를 실어 ${seen}번 보냈어요. 미트볼 문구를 원래 단계로 돌려놨어요.` : '미트볼 생성이 없어서 채팅 전체 싣기를 거두고 원래 단계로 돌려놨어요.', '', { timeOut: 9000 }); } catch { /* 알림 없이 */ }
    return true;
}
/** 설정이 바뀔 때마다(src/apply.js) — 그 확장이 아직 안 떴으면 조금 뒤 한 번 더 */
export async function syncMbPrompt(want, count = DEFAULT_COUNT, chars = DEFAULT_CHARS, { c = ctx(), doc = globalThis.document, retry = true, toast = globalThis.toastr, cap = state.cap } = {}) {
    state.level = level(want); state.count = count; state.chars = chars; state.cap = Math.max(0, Math.round(Number(cap)) || 0);
    if (readOnce()) {   // 「이번 한 번만」 이 걸려 있는 동안은 채팅 전체 그대로 — 때가 지났으면 여기서 돌려놔요
        if (state.once.until > now()) { ensureMacro(c); watchOnce(); state.last = await syncPrompt('all', { c, doc }); if (state.last.ok) await syncRules(true, { c, doc }).catch(() => null); return state.last; }
        await endOnce({ c, doc, toast, force: true });
        return state.last ?? { ok: true, changed: true, why: '', level: state.level };
    }
    if ((state.level === 'recent' || state.level === 'all') && !ensureMacro(c)) {
        try { toast?.warning?.('이 실리태번 판은 매크로 등록이 없어 「최근 답 여러 개 · 채팅 전체」 를 못 써요 — 「마지막 답 전체」 로 적용했어요.', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ }
        state.level = 'last';
    }
    const r = await syncPrompt(state.level, { c, doc });
    state.last = r;
    if (r.ok) await syncRules(state.level !== 'off', { c, doc }).catch(() => null);   // 1.6.1 줄 꼴 규칙: 단계가 무엇이든(「가볍게」 부터) 같이 붙고, 「적용 안 함」 이면 같이 떼요
    if (!r.ok && retry && !state.timer && globalThis.setTimeout) state.timer = setTimeout(() => { state.timer = null; syncMbPrompt(state.level, state.count, state.chars, { retry: false }).catch(() => { /* 다음 설정 바뀜에 */ }); }, 4000);
    if (!r.ok && !retry && state.level !== 'off' && r.why === 'shape') { try { toast?.warning?.('미트볼의 「생성 시스템 프롬프트」 자리를 못 찾았어요(다른 판) — 문구는 그대로 뒀어요.', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ } }
    return r;
}
export const lastResult = () => state.last;
