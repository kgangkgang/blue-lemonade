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
// 1.6.3 (11-17 사용자 「첫 채팅부터 쫙으로 만들었는데 몇 분 만에 뚝딱 · 내용이 반영 안 된 것 같다」 「기억 요약 확장에서 매 챗마다 요약된 거라도 불러오면」):
//   · 채팅 전체가 상한을 넘으면 오래된 메시지부터 **그 메시지의 기억 요약으로 바꿔** 싣고(요약이 없을 때만 앞 1,000자) · 고를 때 미리 알리고 · 다 보낸 뒤 알림에 실은 양(메시지 수 · 글자 · 토큰 어림)을 적어요.
//     숨긴 메시지(기억 확장이 요약한 뒤 숨긴 것 등)는 본문 대신 그 요약이 있으면 요약을 실어요 — 「첫 채팅부터」 가 숨김 때문에 비지 않게.
//   · 「기억 요약」 단계(memo · 만들기 화면의 이번 한 번만): 기억 확장이 채팅 메타데이터에 남긴 **매 턴 요약**을 차례대로 + 마지막 요약 뒤 메시지는 원문.
//     읽는 자리(자료 모양만 읽어요 · 그 확장 코드는 안 불러요): chatMetadata.memoria.turns[]{ mesId, summary } · chatMetadata.long_memory.timeline[] / archive[]{ from, to, title, text }(가장 잘게 쪼갠 것만).
//     둘 다 있으면 턴마다 쪼갠 쪽(memoria)만 — 같은 이야기를 두 번 싣지 않게. 짧은 전체 요약(줄거리 한 덩이 · 실리태번 기본 요약)은 안 써요.
//   · 본문의 U+2800(점자 빈칸 — 일부 프리셋이 띄어쓰기 대신 씀)은 보통 띄어쓰기로 바꿔 실어요(읽기 쉽고 토큰이 덜 들어요).
import { mbOff } from './mb-switch.js';   // 1.7.3 미트볼 맞춤 스위치(줄 꼴 규칙 · 변화 장부 · 만든 뒤 바로잡기 · 프로필 채우기 · 직함 이름 · 합치기 · 중복 정리 — 끈 것은 더는 고치지 않아요)
const swOn = (key, doc = globalThis.document) => !mbOff(key, doc);
/** 줄 꼴 규칙을 붙일 때인가 — 단계가 「적용 안 함」 이 아니고 스위치 「줄 꼴 규칙 덧붙이기」 가 켜져 있을 때 */
export const rulesOn = (lv, doc = globalThis.document) => lv !== 'off' && swOn('rules', doc);
const META = 'statussim';        // 그 확장의 설정 칸 이름(읽고 · prompts 한 칸만 씀)
export const KEY = 'gen.system'; // 「생성 시스템 프롬프트」 — 상태창 만들기 · 칸 다시 생성 · AI로 수정이 모두 쓰는 칸
export const LEVELS = ['off', 'light', 'last', 'recent', 'all', 'memo'];   // memo 는 만들기 화면의 이번 한 번만(테마 설정 단계로는 안 골라요)
export const MACRO = 'bl_mb_recent', MACRO_ALL = 'bl_mb_all', MACRO_MEMO = 'bl_mb_memo';
export const DEFAULT_COUNT = 9, DEFAULT_CHARS = 2000, FULL_CAP = 40000;
// 1.6.5 (11-17 사용자 「채팅 전체 상한 기본값 두지마 다 열어 ㄱㄱ」): 상한 기본 12만 → 0(없음). 옛 저장값 12만은 src/settings.js 가 한 번 0 으로 옮겨요.
export const DEFAULT_CAP = 0, OLD_DEFAULT_CAP = 120000, HEAD_CHARS = 1000;   // 채팅 전체: 요청 1회 상한(어림 토큰 · 0 = 없음) · 상한을 넘을 때 오래된 메시지에 남기는 앞 글자 수
export const ONCE_KEY = 'bl-mb-prompt-once', ONCE_WAIT = 10 * 60000, ONCE_IDLE = 4 * 60000;
export const ONCE_LV_KEY = 'bl-mb-prompt-once-lv';   // 1.6.1 「이번 한 번만」 의 단계(채팅 전체가 아닐 때만 적어요 — 미트볼 만들기 화면의 「채팅 읽기」 고르기 src/mb-read.js)
const ONCE_NAME = { off: '기본', light: '기본', last: '마지막 답 전체', recent: '최근 답 여러 개', all: '채팅 전체', memo: '기억 요약' };
/** 「이번 한 번만」 단계가 실제로 붙이는 덩어리: 「마지막 답 전체」 는 요청이 불릴 때를 알 수 있게 테마 매크로({{bl_mb_recent}} · 앞 메시지 0개)로 실어요 */
const onceBlock = lv => (lv === 'last' ? 'recent' : level(lv));
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
    // 1.6.5 (11-17 사용자 「미트볼 반영 안 되는 거 같다니까 채팅」): 그 확장의 만들기 지시는 「시작 값 · 시작 날짜 · 시작 장소」 로 쓰여 있어 채팅이 다 실려도 처음 상태 쪽으로 채워요 — 이야기가 이미 흘렀으면 「지금(이야기 끝)」 으로 읽게 해요
    'NOT A NEW STORY: when the story text shows the story is already under way, fill every panel with the state NOW, at the END of the story text, not at the opening. Wherever the task says "start", "starting values" or "where the user starts", read it as "now": the in-story date and time at the end, the place the user is at the end, relationship numbers and stages moved from the realistic baseline by everything that has happened between them, what people hold now, and memos, summaries and profile lines that mention the latest events. Go through the story text from the first message to the last so early events are not lost.',
].join('\n');
const LAST = '\n\n--- LATEST STORY TURN (complete text of the newest reply) ---\n{{lastCharMessage}}';
const RECENT = `\n\n--- LATEST STORY TURNS (oldest first; only the newest is complete, older ones are shortened) ---\n{{${MACRO}}}`;
const ALL = `\n\n--- THE STORY SO FAR (every visible message, oldest first; lines starting with [Summary] are memory summaries standing in for a message) ---\n{{${MACRO_ALL}}}`;
const MEMO = `\n\n--- THE STORY SO FAR AS MEMORY SUMMARIES (one per chat turn, oldest first; [#N] is the message number; messages after the last summary follow in full) ---\n{{${MACRO_MEMO}}}`;

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
    const body = LIGHT + (lv === 'last' ? LAST : lv === 'recent' ? RECENT : lv === 'all' ? ALL : lv === 'memo' ? MEMO : '');
    return `${BEGIN}\n${body}\n=== END BLUE LEMONADE NOTE${d ? ` [d:${d}]` : ''} ===`;
}
/** 테마가 덧붙인 덩어리를 뗀 글 */
export const strip = text => String(text ?? '').replace(BLOCK_RE, '');
/** 지금 글에 붙어 있는 단계 */
export function levelOf(text) {
    const s = String(text ?? '');
    if (!s.includes(BEGIN)) return 'off';
    return s.includes(`{{${MACRO_MEMO}}}`) ? 'memo' : s.includes(`{{${MACRO_ALL}}}`) ? 'all' : s.includes(`{{${MACRO}}}`) ? 'recent' : s.includes('{{lastCharMessage}}') ? 'last' : 'light';
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
        .replace(/⠀/g, ' ')
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
// ── 기억 요약(기억 확장이 채팅 메타데이터에 남긴 매 턴 요약) ─────────────────────────────
const metaOf = c => { const m = c?.chatMetadata ?? c?.chat_metadata; return m && typeof m === 'object' ? m : {}; };
const int = v => (Number.isInteger(Number(v)) && v !== '' && v !== null ? Number(v) : NaN);
/**
 * 매 턴 요약 목록(메시지 번호 차례) — { list: [{ from, to, text }], source: 'memoria' | 'long_memory' | '' }
 *   memoria: turns[]{ mesId, summary, failed } · long_memory: timeline[] + archive[](kind timeline){ from, to, title, text } 중 다른 덩이를 품지 않는 가장 잘게 쪼갠 것만(장 · 줄거리 덩이는 빼요)
 */
export function memoEntries(c = ctx()) {
    const md = metaOf(c);
    const turns = Array.isArray(md.memoria?.turns) ? md.memoria.turns : [];
    const mo = [];
    for (const t of turns) {
        const s = typeof t?.summary === 'string' ? t.summary.trim() : '', id = int(t?.mesId);
        if (s && !t.failed && id >= 0) mo.push({ from: id, to: id, text: s });
    }
    if (mo.length) return { list: mo.sort((a, b) => a.from - b.from), source: 'memoria' };
    const E = md.long_memory && typeof md.long_memory === 'object' ? md.long_memory : null;
    if (!E) return { list: [], source: '' };
    const seen = new Set(), nodes = [];
    const arc = Array.isArray(E.archive) ? E.archive.filter(a => a?.kind === 'timeline') : [];
    for (const n of [...(Array.isArray(E.timeline) ? E.timeline : []), ...arc]) {
        if (!n || (n.id != null && seen.has(n.id))) continue; if (n.id != null) seen.add(n.id);
        const f = int(n.from), t = int(n.to), s = String(n.text ?? '').trim();
        if (s && f >= 0 && t >= f) nodes.push({ from: f, to: t, text: n.title ? `${String(n.title).trim()}: ${s}` : s });
    }
    const fine = nodes.filter(a => !nodes.some(b => b !== a && b.from >= a.from && b.to <= a.to && b.to - b.from < a.to - a.from));
    return { list: fine.sort((a, b) => a.from - b.from || a.to - b.to), source: fine.length ? 'long_memory' : '' };
}
const nameOf = x => x.name || (x.is_user ? 'User' : 'Character');
const rowSize = r => (r.drop ? 0 : tokensSafe(r.head + r.body) + 1);
/** 상한(어림 토큰)에 맞추기: 오래된 것부터 ① 그 메시지의 기억 요약으로 ② 앞 HEAD_CHARS 자로 ③ 빼기 — 가장 새 줄은 그대로. 바뀐 줄에 표시를 달아요 */
function fit(rows, cap, memoOf = () => null) {
    let sum = rows.reduce((a, r) => a + rowSize(r), 0);
    const full = sum, limit = Math.max(0, Math.round(Number(cap)) || 0), used = new Set();
    for (const r of rows) if (r.memo) used.add(r.memo);
    if (limit && sum > limit) {
        for (let i = 0; i < rows.length - 1 && sum > limit; i++) {
            const r = rows[i], e = r.memo ? null : memoOf(r.at); if (!e || r.drop) continue;
            const before = rowSize(r);
            if (used.has(e)) { r.drop = true; r.merged = true; } else { used.add(e); r.head = `[Summary] ${r.head}`; r.body = e.text; r.memo = e; r.sum = true; }
            sum += rowSize(r) - before;
        }
        for (let i = 0; i < rows.length - 1 && sum > limit; i++) {
            const r = rows[i]; if (r.drop || r.sum || r.body.length <= HEAD_CHARS) continue;
            const before = rowSize(r); r.body = `${r.body.slice(0, HEAD_CHARS)}…`; r.cut = true; sum += rowSize(r) - before;
        }
        for (let i = 0; i < rows.length - 1 && sum > limit; i++) if (!rows[i].drop) { sum -= rowSize(rows[i]); rows[i].drop = true; }
    }
    return { sum, full };
}
/** 1.6.5 (버그 사냥 6차) 숨긴 메시지 = 눈 감긴 메시지(is_system · 종류 없음 또는 내레이터). 실리태번 알림 · 주석(is_system · 다른 종류 — 도움말 · /comment 등)은 숨긴 것으로 세지 않고 빼요 */
const hiddenMsg = x => !!x?.is_system && (!x.extra?.type || x.extra.type === 'narrator');
const noticeMsg = x => !!x?.is_system && !!x.extra?.type && x.extra.type !== 'narrator';
const indexMemo = list => { const by = new Map(); for (const e of list) for (let i = e.from; i <= e.to && i - e.from < 5000; i++) if (!by.has(i)) by.set(i, e); return by; };
/**
 * 채팅 전체: 숨기지 않은 모든 메시지(내 메시지 포함)를 이름 붙여 차례대로. 숨긴 메시지는 기억 요약이 있으면 그 요약을([Summary]) 그 자리에.
 * cap(어림 토큰 · 0 이면 없음)을 넘으면 오래된 메시지부터 그 메시지의 기억 요약으로 바꾸고(요약이 없으면 앞 HEAD_CHARS 자로), 그래도 넘으면 오래된 것부터 빼요(가장 새 메시지는 남겨요).
 * 돌려주는 것: { text, count(실린 메시지 수 · 요약으로 바뀐 것 포함), total(숨기지 않은 메시지 수), summarized(요약으로 바꾼 수), cut(앞부분만), dropped(뺀 수),
 *   hidden(숨긴 메시지 수), hiddenSum(그중 요약을 실은 수), memo(이 채팅의 기억 요약 수), chars(실은 글자), fullChars(본문 그대로의 글자), tokens(어림), full(상한 없을 때 어림) }
 */
export function allText(c = ctx(), cap = DEFAULT_CAP) {
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    const { list } = memoEntries(c), by = indexMemo(list);
    const rows = []; let hidden = 0, hiddenSum = 0, fullChars = 0; const hiddenUsed = new Set();
    chat.forEach((x, at) => {
        if (!x || typeof x.mes !== 'string' || noticeMsg(x)) return;   // 실리태번 알림 · 주석은 이야기가 아니라 빼고 숨긴 수에도 안 세요
        if (hiddenMsg(x)) {
            hidden++; const e = by.get(at);
            if (e && !hiddenUsed.has(e)) { hiddenUsed.add(e); hiddenSum++; rows.push({ at, head: `[Summary #${e.from}${e.to !== e.from ? `-#${e.to}` : ''}] `, body: e.text, memo: e, sum: true, hiddenRow: true }); }
            return;
        }
        const body = plain(x.mes);
        if (body) { fullChars += body.length + nameOf(x).length + 2; rows.push({ at, head: `${nameOf(x)}: `, body }); }
    });
    const { sum, full } = fit(rows, cap, at => by.get(at) || null);
    const kept = rows.filter(r => !r.drop), vis = rows.filter(r => !r.hiddenRow), text = kept.map(r => r.head + r.body).join('\n\n');
    return {
        text, count: vis.filter(r => !r.drop || r.merged).length, total: vis.length, summarized: vis.filter(r => (r.sum && !r.drop) || r.merged).length,
        cut: vis.filter(r => r.cut && !r.drop).length, dropped: vis.filter(r => r.drop && !r.merged).length, hidden, hiddenSum: kept.filter(r => r.hiddenRow).length,
        memo: list.length, chars: text.length, fullChars, tokens: sum, full,
    };
}
/**
 * 기억 요약: 매 턴 요약을 차례대로([#N] 메시지 번호) + 마지막 요약 뒤의 숨기지 않은 메시지는 원문(상한을 넘으면 그 원문만 앞에서부터 줄여요).
 * 돌려주는 것: { text, count(요약 수), first · last(요약이 덮는 메시지 번호), tail(원문으로 실은 뒤 메시지 수), tailCut, source, chars, tokens } · 요약이 없으면 count 0 · text ''
 */
export function memoText(c = ctx(), cap = DEFAULT_CAP) {
    const { list, source } = memoEntries(c);
    if (!list.length) return { text: '', count: 0, first: -1, last: -1, tail: 0, tailCut: 0, dropped: 0, source: '', chars: 0, tokens: 0 };
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    const last = Math.max(...list.map(e => e.to));
    const lines = list.map(e => `[#${e.from}${e.to !== e.from ? `-#${e.to}` : ''}] ${e.text}`);
    const rows = [];
    chat.forEach((x, at) => { if (at > last && x && !hiddenMsg(x) && !noticeMsg(x) && typeof x.mes === 'string') { const body = plain(x.mes); if (body) rows.push({ at, head: `${nameOf(x)}: `, body }); } });
    const limit = Math.max(0, Math.round(Number(cap)) || 0);
    // 1.6.5 (버그 사냥 6차): 요약 머리만으로 상한을 넘으면 뒤 원문은 가장 새 메시지만 · 그래도 넘으면 오래된 요약부터 빼요(가장 새 요약은 남겨요) — 전엔 머리를 안 줄여 상한을 넘었어요
    const lineTok = lines.map(l => tokensSafe(l) + 1); let headTok = lineTok.reduce((a, b) => a + b, 0);
    fit(rows, limit ? Math.max(1, limit - headTok) : 0);
    const kept = rows.filter(r => !r.drop);
    let from = 0;
    if (limit) { const tailTok = kept.reduce((a, r) => a + rowSize(r), 0); while (from < lines.length - 1 && headTok + tailTok > limit) headTok -= lineTok[from++]; }
    const head = lines.slice(from).join('\n');
    const text = head + (kept.length ? `\n\n--- AFTER THE LAST SUMMARY (full text) ---\n${kept.map(r => r.head + r.body).join('\n\n')}` : '');
    return { text, count: list.length - from, first: list[from].from, last, tail: kept.length, tailCut: rows.filter(r => r.cut || r.drop).length, dropped: from, source, chars: text.length, tokens: tokensSafe(text) };
}
/**
 * 1.6.5 본편 AI 가 답마다 남긴 상태 변화 줄(그 확장이 메시지 extra.statussim.bySwipe 에 적어 둔 것)을 한 장으로 — 호감 · 우정 합 · 마지막 장소 · 시간 · 사건 차례.
 *   사용자 채팅(11-17): 답마다 「aff 이름 +N」 이 쌓여 사람마다 +12 ~ +19 인데, 만들기는 「시작 값(−10 ~ 10)」 으로 채워 숫자가 이야기를 안 따랐어요. 이 장을 실어 숫자 · 장소 · 날짜가 쌓인 변화를 따르게 해요.
 *   숨긴 메시지 · 고르지 않은 다른 답(스와이프)은 빼요. 돌려주는 것: { text, people, events, msgs } · 줄이 없으면 text ''
 */
// ── 1.6.8 이름 장부: 변화 줄에 직함으로 적힌 사람 → 카드 · 로어북 · 지금 상태창의 이름(짝) ─────────────────────────────
// 진짜 모델 시험(11-17): 본편 AI 가 변화 줄에 사람 이름 대신 직함을 적었고, 로어북 그 사람 항목의 「이름」 칸에도 직함이 먼저 적혀 있어
//   만들기 AI 가 관계 칸 이름을 직함으로 적었어요(다른 판에서는 이름으로 — 흔들림). 같은 직함이 다른 사람 항목의 열쇠에도 있어 코드로 아무렇게나 바꾸면 사람이 섞여요.
//   그래서 ① 변화 장에 「이름 (적힌 직함)」 짝을 분명히 적어 넘기고(한 사람에게만 속할 때) · 여럿이면 후보를 다 적고 AI 가 고르게 하고
//   ② 만든 뒤에는 그 직함이 **정확히 한 사람에게만** 속하고 그 사람 칸이 따로 없을 때만 이름으로 바꿔요. 둘 이상 · 모르는 항목이 섞이면 손대지 않아요.
//   「속한다」 = 로어북 항목의 열쇠(또는 상태창 한 사람의 이름 · 별칭 묶음)에 그 낱말과 그 사람 이름이 같이 있어요. 그 낱말이 든 항목에 아는 이름이 없으면(설정 항목 등) 「모름」 으로 세어 바꾸지 않아요.
const nmKey = s => String(s ?? '').normalize('NFC').trim().toLowerCase();
const panelRows = base => [...(base?.data?.rel?.user || []), ...(base?.data?.profile?.list || [])].filter(r => r && typeof r === 'object' && r.role !== 'user');
/** 이 채팅의 카드(그룹이면 사람마다) */
function cardsOf(c) {
    const all = Array.isArray(c?.characters) ? c.characters : [];
    if (c?.groupId) { const g = (Array.isArray(c?.groups) ? c.groups : []).find(x => x?.id === c.groupId); return (g?.members || []).map(a => all.find(x => x?.avatar === a)).filter(Boolean); }
    const one = all[Number(c?.characterId)]; return one ? [one] : [];
}
/** 확실한 사람 이름: 그때 상태창(관계 · 프로필)의 이름 · 카드 이름 — 사용자 이름은 빼요. 소문자 → 적힌 꼴 */
//   1.6.8 진짜 모델 시험(11-17 10:08): 앞 판 상태창에 직함이 이름으로 남아 있으면(관계 칸에 직함 줄 · 이름 줄 둘 다) 그 직함을 「확실한 이름」 으로 넘겨
//     AI 가 직함을 그대로 썼어요. 그래서 열쇠 묶음(sets)을 주면, 서로 다른 둘 이상의 사람 항목 열쇠에 같이 나오는 이름은 직함으로 보고 빼요
//     (사람 이름은 대개 자기 항목에만 나와요 — 남의 항목에 나와도 그 사람이 하나뿐이면 그대로 둬요). cards = false 면 카드 이름은 빼요(AI 에 넘기는 이름 목록).
export function knownNames(c = ctx(), base = metaMb(c)?.base, sets = null, { cards = true } = {}) {
    const out = new Map(); const put = v => { const s = String(v ?? '').trim(); if (s && !out.has(nmKey(s))) out.set(nmKey(s), s); };
    for (const r of panelRows(base)) put(r.name);
    if (cards) for (const ch of cardsOf(c)) put(ch?.name);
    if (c?.name1) out.delete(nmKey(c.name1));
    if (sets?.length) {
        const all = new Map(out);
        for (const k of [...out.keys()]) { const rest = new Map(all); rest.delete(k); if (holdersOf(k, rest, sets).names.length >= 2) out.delete(k); }
    }
    return out;
}
/** 열쇠 묶음: 로어북 항목마다 열쇠(정규식 열쇠는 빼요) + 그때 상태창 사람마다 [이름, ...별칭] */
export function keySets(books = [], base = null) {
    const sets = [];
    for (const b of books) for (const e of Object.values(b?.entries || {})) { const k = (Array.isArray(e?.key) ? e.key : []).map(x => String(x ?? '').trim()).filter(x => x && !/^\/.*\/[a-z]*$/i.test(x)); if (k.length) sets.push(k); }
    for (const r of panelRows(base)) if (Array.isArray(r.aliases) && r.aliases.length) sets.push([r.name, ...r.aliases].map(String));
    return sets;
}
/** 그 낱말이 누구의 것인지: self = 그 자체가 확실한 이름 · names = 같은 묶음에 든 확실한 이름들 · unknown = 아는 이름이 없는 묶음 수 */
export function holdersOf(word, known, sets) {
    const w = nmKey(word); if (!w) return { self: false, names: [], unknown: 0 };
    if (known?.has(w)) return { self: true, names: [known.get(w)], unknown: 0 };
    const names = new Set(); let unknown = 0;
    for (const s of sets || []) {
        const ks = s.map(nmKey); if (!ks.includes(w)) continue;
        const hit = [...new Set(ks.filter(k => k !== w && known?.has(k)).map(k => known.get(k)))];
        if (!hit.length) unknown++; for (const h of hit) names.add(h);
    }
    return { self: false, names: [...names], unknown };
}
/** 정확히 한 사람에게만 속할 때 그 이름 · 아니면 '' */
export const onlyHolder = h => (h && !h.self && h.names.length === 1 && !h.unknown ? h.names[0] : '');
const book = { key: '', sig: '', books: [], gen: 0 };   // 로어북은 받아 오는 게 느려(비동기) 고를 때 미리 받아 둬요 — 매크로(동기)는 받아 둔 것만 써요
const bookKey = c => `${c?.groupId ?? ''}|${c?.characterId ?? ''}|${(typeof c?.getCurrentChatId === 'function' ? c.getCurrentChatId() : '') ?? ''}`;
// 버그 사냥 9b: 같은 채팅에서 로어북을 고치거나(저장 → 실리태번 「로어북 바뀜」 사건) 채팅 · 카드에 건 로어북 이름이 바뀌면 받아 둔 열쇠 묶음은 옛것이에요.
//   전엔 채팅 열쇠만 봐서 세션 내내 옛 로어북으로 합치기 · 이름 바꾸기 · 같은 사람 확인을 했어요. → 건 로어북 이름(sig)도 같이 보고 · 사건이 오면 비워요(다음에 쓸 때 새로 받아요)
const bookSig = c => { try { return [...cardsOf(c).map(ch => String(ch?.data?.extensions?.world ?? '')), String(c?.chatMetadata?.world_info ?? '')].join('|'); } catch { return ''; } };
const booksFresh = c => book.key === bookKey(c) && book.sig === bookSig(c);
let bookHook = false;
function hookBooks(c) {
    if (bookHook) return;
    try {
        const ev = c?.eventTypes ?? c?.event_types, src = c?.eventSource; if (!ev || typeof src?.on !== 'function') return;
        const drop = () => { book.key = ''; book.sig = ''; book.books = []; book.gen++; };   // 받는 중이던 것도 남기지 않아요(gen)
        for (const k of ['WORLDINFO_UPDATED', 'CHARACTER_EDITED']) if (ev[k]) src.on(ev[k], drop);   // 로어북 저장 · 카드 고침(카드 안 책 · 건 로어북)
        bookHook = true;
    } catch { /* 채팅 · 이름이 바뀔 때만 새로 받아요 */ }
}
/** 이 채팅에 걸린 로어북(카드의 것 · 카드 안 책 · 채팅 로어북)을 읽어 둬요. 못 읽으면 빈 목록 */
//   버그 사냥 9: 열쇠는 받기 전에 잡아요 — 받는 사이 채팅이 바뀌면(같은 캐릭터의 다른 채팅) 받은 뒤 열쇠가 새 채팅 것이 돼 앞 채팅의 채팅 로어북으로
//   새 채팅 사람을 합쳤어요. 받는 사이 채팅이 바뀌었으면 받아 둔 것으로 남기지 않아요(돌려주기만).
export async function primeBooks(c = ctx()) {
    hookBooks(c);
    const books = [], key = bookKey(c), sig = bookSig(c), gen = book.gen;
    try {
        const names = new Set();
        for (const ch of cardsOf(c)) { const w = ch?.data?.extensions?.world; if (w) names.add(String(w)); const cb = ch?.data?.character_book; if (Array.isArray(cb?.entries)) books.push({ entries: Object.fromEntries(cb.entries.map((e, i) => [i, { key: e?.keys || e?.key || [] }])) }); }
        if (c?.chatMetadata?.world_info) names.add(String(c.chatMetadata.world_info));
        if (typeof c?.loadWorldInfo === 'function') for (const n of names) { try { const b = await c.loadWorldInfo(n); if (b?.entries) books.push(b); } catch { /* 그 책은 빼요 */ } }
    } catch { /* 빈 목록 */ }
    if (bookKey(c) === key && bookSig(c) === sig && book.gen === gen) { book.key = key; book.sig = sig; book.books = books; }
    return books;
}
const booksFor = c => (booksFresh(c) ? book.books : []);
/** 변화 장의 이름 하나를 적는 꼴: 이름이면 그대로 · 한 사람의 직함이면 「이름 (written as "직함")」 · 여럿이면 후보를 적어 AI 가 고르게 */
//   그 사람 이름도 변화 줄에 따로 있으면(본편 AI 가 둘을 다른 사람으로 셈 — 예: 함께 사는 동물 이름이 주인 항목 열쇠에 든 것) 짝을 짓지 않아요.
function ledgerName(n, known, sets, seen = new Set()) {
    if (!known?.size) return n;
    const h = holdersOf(n, known, sets);
    if (h.self) return n;
    const one = onlyHolder(h); if (one) return seen.has(nmKey(one)) ? n : `${one} (written as "${n}")`;
    if (h.names.length) return `"${n}" (a title or nickname shared in the lorebook by ${h.names.join(', ')}${h.unknown ? ' and other entries' : ''} — write the real name of the one the story means, never "${n}")`;
    if (h.unknown) return `"${n}" (a title or nickname, not a name in the current panel — write that person's real name from the card or lorebook, never "${n}")`;
    return n;
}
export function opsLedger(c = ctx()) {
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    const sum = new Map(), events = [], last = {}; let msgs = 0;
    const add = (name, k, n) => { if (!name) return; const r = sum.get(name) || { aff: 0, trust: 0 }; r[k] += n; sum.set(name, r); };
    chat.forEach((m, i) => {
        if (!m || m.is_system) return;
        const ops = m.extra?.statussim?.bySwipe?.[m.swipe_id ?? 0];
        if (!Array.isArray(ops) || !ops.length) return; msgs++;
        for (const op of ops) {
            if (!Array.isArray(op)) continue; const [k, v] = op, s = String(v ?? '').trim(); if (!s) continue;
            if (k === 'aff' || k === 'trust') { for (const part of s.split(/[,|]/)) { const x = /^\s*(.*?)\s*([+-]\d+)\s*$/.exec(part); if (x) add(x[1].trim(), k, Number(x[2])); } }
            else if (k === 'event') events.push(`#${i} ${s}`);
            else if (k === 'loc' || k === 'place') last.place = `${s} (#${i})`;
            else if (k === 'period' || k === 'time') { last.time = `${s} (#${i})`; last.timeRaw = s; }
            else if (k === 'date') last.date = `${s} (#${i})`;
        }
    });
    if (!msgs) return { text: '', people: 0, events: 0, msgs: 0, sums: new Map() };
    const sign = n => (n > 0 ? `+${n}` : String(n));
    let known = new Map(), sets = [];
    let shown = [];
    try { const base = metaMb(c)?.base; sets = keySets(booksFor(c), base); known = knownNames(c, base, sets); shown = [...knownNames(c, base, sets, { cards: false }).values()]; } catch { /* 이름 짝 없이 */ }
    const seen = new Set([...sum.keys()].map(nmKey));
    const rows = [...sum].filter(([, r]) => r.aff || r.trust).map(([n, r]) => `${ledgerName(n, known, sets, seen)}: aff ${sign(r.aff)}, trust ${sign(r.trust)}`);
    const real = shown.slice(0, 80);
    const text = ['--- STATUS CHANGES RECORDED DURING THE STORY (written by the story AI after each reply; they are already part of the story — current values must include them) ---',
        'Profiles: write a profile (role "main") for EVERY person in the relationship changes above, not only two or three — the "at most 3" limit in the task is only for extra background people.',
        'Names here are as the story AI wrote them and may be a title, rank or nickname; in every panel use each person’s real name exactly as in the card, lorebook or current panel data, never the title.',
        real.length ? `Real names already used for these people (current panel) — keep exactly these names in the "name" fields; a title goes in the label, never in the name: ${real.join(', ')}` : '',
        rows.length ? `Total relationship changes since the first message (aff = romance, trust = friendship): ${rows.join('; ')}` : '',
        last.place ? `Latest location: ${last.place}` : '', last.time ? `Latest time of day: ${last.time}` : '', last.date ? `Latest date change: ${last.date}` : '',
        events.length ? `Events in order (#N = message number):\n${events.join('\n')}` : ''].filter(Boolean).join('\n');
    return { text, people: rows.length, events: events.length, msgs, sums: sum, time: last.timeRaw || '' };
}
export const withLedger = (c, body) => {
    if (!swOn('ledger')) return body;   // 1.7.3 스위치 「변화 장부 · 이름 장부 싣기」 를 끔 — 본문만
    if (!booksFresh(c)) primeBooks(c).catch(() => { /* 다음 요청에 */ });   // 평소 단계가 「채팅 전체」 라 고르기를 안 거친 때: 다음 요청부터 이름 짝이 붙어요
    try { const l = opsLedger(c); return l.text ? `${l.text}\n\n--- STORY TEXT ---\n${body}` : body; } catch { return body; }
};
const kNum = n =>Math.round(Number(n) || 0).toLocaleString('ko-KR');
const kBig = n => { const v = Math.round(Number(n) || 0); return v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '')}만` : kNum(v); };
/** 실은 양 한 줄(만들기 화면 어림 줄 · 다 보낸 뒤 알림이 같이 써요) — f = allText · memoText 결과 */
export function fillLine(lv, f) {
    if (!f) return '';
    if (lv === 'memo') {
        if (!f.count) return '이 채팅에 매 턴 기억 요약이 없어요';
        return `기억 요약 ${kNum(f.count)}개(메시지 #${f.first}~#${f.last})${f.tail ? ` · 그 뒤 메시지 ${kNum(f.tail)}개는 원문${f.tailCut ? `(${kNum(f.tailCut)}개는 줄임)` : ''}` : ''}${f.dropped ? ` · 상한 때문에 오래된 요약 ${kNum(f.dropped)}개는 뺌` : ''} · ${kBig(f.chars)}자 · 약 ${kBig(f.tokens)} 토큰`;
    }
    const parts = [`메시지 ${kNum(f.count)}/${kNum(f.total)}개 · ${kBig(f.chars)}자 · 약 ${kBig(f.tokens)} 토큰`];
    if (f.summarized) parts.push(`오래된 ${kNum(f.summarized)}개는 기억 요약으로`);
    if (f.cut) parts.push(`${kNum(f.cut)}개는 앞 1,000자만`);
    if (f.dropped) parts.push(`${kNum(f.dropped)}개는 뺌`);
    if (f.hidden) parts.push(`숨긴 메시지 ${kNum(f.hidden)}개는 ${f.hiddenSum ? `요약 ${kNum(f.hiddenSum)}개로` : '뺌'}`);
    return parts.join(' · ');
}
/** 토큰 어림(한글은 두 글자에 하나쯤, 그 밖은 네 글자에 하나쯤) */
export function tokens(text) {
    const s = String(text ?? ''); const ko = (s.match(/[ㄱ-힣]/g) || []).length;
    return Math.ceil(ko / 2 + (s.length - ko) / 4);
}
/**
 * 1.6.5 접속한 모델의 맥락 한도(사용자가 실리태번 연결에 적어 둔 값) — 미트볼이 따로 연결 프로필을 쓰면 몰라요(0).
 *   채팅 완성(openai 꼴)은 chatCompletionSettings.openai_max_context, 그 밖은 maxContext.
 */
export function modelLimit(c = ctx()) {
    try {
        const mb = c?.extensionSettings?.[META] || {};
        if (mb.profGen || mb.aiProfile) return 0;
        const n = c?.mainApi === 'openai' ? Number(c?.chatCompletionSettings?.openai_max_context) : Number(c?.maxContext);
        return Number.isFinite(n) && n > 0 ? n : 0;
    } catch { return 0; }
}
/** 실을 글이 모델 한도를 넘는 게 확실할 때만(적게 잡는 어림 tokens 로 견줘요) 그 한도 · 아니면 · 모르면 0 — 막지 않고 알리기만 해요 */
export function overModel(text, c = ctx()) { const lim = modelLimit(c); return lim && tokens(text) > lim ? lim : 0; }
/** 단계마다 요청 1회에 더 드는 토큰 어림(지금 채팅 기준) */
export function estimate(lv, c = ctx(), count = DEFAULT_COUNT, chars = DEFAULT_CHARS, cap = DEFAULT_CAP) {
    lv = level(lv);
    if (lv === 'off') return 0;
    const fixed = tokens(block('light', '00000000'));
    if (lv === 'light') return fixed;
    if (lv === 'all') return fixed + allText(c, cap).tokens;
    if (lv === 'memo') return fixed + memoText(c, cap).tokens;
    if (lv === 'recent') return fixed + tokens(recentText(c, count, chars));
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    let mes = '';
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i] && !chat[i].is_user && !chat[i].is_system) { mes = String(chat[i].mes ?? ''); break; }
    return fixed + tokens(mes);
}

const state = { level: 'off', count: DEFAULT_COUNT, chars: DEFAULT_CHARS, cap: DEFAULT_CAP, macro: false, timer: null, last: null, once: null, onceTimer: null, fill: null, listeners: new Set() };
/** 매크로가 불려 글을 실을 때마다(실은 양) — 만들기 화면의 어림 줄이 「보냈어요」 로 바뀌어요 */
export function onFill(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); }
function filled(lv, f) {
    state.fill = { level: lv, ...f, text: undefined };
    if (state.once) state.once.fill = state.fill;
    for (const fn of state.listeners) { try { fn(state.fill); } catch { /* 다음에 */ } }
}
/** 지금 걸린 「이번 한 번만」 의 단계 · 보낸 수 · 마지막으로 실은 양 */
export const onceInfo = () => { const o = readOnce(); return o && o.until > now() ? { level: o.level || 'all', seen: o.seen || 0, fill: o.fill || null } : null; };
function ensureMacro(c = ctx()) {
    if (state.macro || typeof c?.registerMacro !== 'function') return state.macro;
    try {
        c.registerMacro(MACRO, () => { try { onceSeen(); const t = recentText(ctx(), state.once?.level === 'last' && state.once.until > now() ? 0 : state.count, state.chars); filled('recent', { chars: t.length, tokens: tokensSafe(t) }); return t; } catch { return ''; } }, '블루레몬: 눈 감긴 답을 뺀 최근 답 본문(미트볼 문구용)');
        c.registerMacro(MACRO_ALL, () => { try { onceSeen(); const c = ctx(), r = allText(c, state.cap); filled('all', r); return withLedger(c, r.text); } catch { return ''; } }, '블루레몬: 채팅 전체 본문(숨긴 메시지는 기억 요약 · 미트볼 문구용)');
        c.registerMacro(MACRO_MEMO, () => { try { onceSeen(); const c = ctx(), r = memoText(c, state.cap); filled('memo', r); return r.text ? withLedger(c, r.text) : ''; } catch { return ''; } }, '블루레몬: 기억 확장의 매 턴 요약(미트볼 문구용)');
        state.macro = true;
    } catch { /* 이 판에는 매크로 등록이 없어요 */ }
    return state.macro;
}

// ── 「이번 한 번만 채팅 전체로」 ─────────────────────────────
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const now = () => Date.now();
function readOnce() {
    if (state.once) return state.once;
    try { const until = Number(store()?.getItem(ONCE_KEY)); if (Number.isFinite(until) && until > 0) { const lv = store()?.getItem(ONCE_LV_KEY); state.once = { until, seen: 0, level: LEVELS.includes(lv) ? lv : 'all' }; } } catch { /* 표시 없이 */ }
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
/** 누르면: 다음 생성 묶음에만 그 단계(기본 = 채팅 전체). 걸었으면 true · quiet 면 걸렸다는 알림을 안 띄워요(만들기 화면의 고르기) */
export async function armOnce({ c = ctx(), doc = globalThis.document, toast = globalThis.toastr, def = undefined, level: want = 'all', quiet = false } = {}) {
    const lv = level(want);
    if (lv !== 'off' && lv !== 'light' && !ensureMacro(c)) { try { toast?.warning?.('이 실리태번 판은 매크로 등록이 없어 채팅 전체를 실을 수 없어요.', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ } return false; }
    if (lv === 'all' || lv === 'memo') await primeBooks(c).catch(() => null);   // 1.6.8 변화 장의 이름 짝에 쓸 로어북 열쇠
    state.once = { until: now() + ONCE_WAIT, seen: 0, level: lv };
    const r = await syncPrompt(onceBlock(lv), { c, doc, def });
    if (r.ok) await syncRules(rulesOn(state.level, doc), { c, doc }).catch(() => null);   // 줄 꼴 규칙은 본편 쪽이라 「이번 한 번만」 과 상관없이 평소 단계를 따라요
    if (!r.ok) { state.once = null; try { toast?.warning?.(r.why === 'none' ? '미트볼 상태창 설정을 못 찾았어요.' : '미트볼의 「생성 시스템 프롬프트」 자리를 못 찾았어요(다른 판).', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ } return false; }
    try { store()?.setItem(ONCE_KEY, String(state.once.until)); if (lv === 'all') store()?.removeItem(ONCE_LV_KEY); else store()?.setItem(ONCE_LV_KEY, lv); } catch { /* 이 세션에서만 */ }
    watchOnce();
    if (quiet) return true;
    try { toast?.info?.('다음 미트볼 생성(상태창 만들기 · 칸 다시 생성 · AI로 수정)에 채팅 전체를 실어요. 끝나거나 10분 안에 안 만들면 원래 단계로 돌아가요.', '', { timeOut: 9000 }); } catch { /* 알림 없이 */ }
    return true;
}
/** 받침 따라 조사(「기억 요약」 으로 · 「마지막 답 전체」 로 — 받침 ㄹ 은 「로」) */
const josa = (w, withEnd, without) => { const k = String(w).charCodeAt(String(w).length - 1) - 0xac00; const end = k >= 0 && k < 11172 ? k % 28 : 0; return end && (withEnd !== '으로' || end !== 8) ? withEnd : without; };
/** 끝: 원래 단계로. 돌려놨으면 true */
export async function endOnce({ c = ctx(), doc = globalThis.document, toast = globalThis.toastr, force = false, def = undefined, quiet = false } = {}) {
    const o = readOnce(); if (!o) return false;
    if (!force && o.until > now()) { watchOnce(); return false; }
    const seen = o.seen, name = ONCE_NAME[o.level] || ONCE_NAME.all, lv = o.level || 'all';
    const amount = seen && o.fill && (lv === 'all' || lv === 'memo') ? ` — 요청마다 ${fillLine(lv, o.fill)}` : '';
    state.once = null; if (state.onceTimer) { try { clearTimeout(state.onceTimer); } catch { /* 그대로 */ } state.onceTimer = null; }
    try { store()?.removeItem(ONCE_KEY); store()?.removeItem(ONCE_LV_KEY); } catch { /* 표시 없이 */ }
    state.last = await syncPrompt(state.level, { c, doc, def });
    await syncRules(rulesOn(state.level, doc), { c, doc }).catch(() => null);
    if (quiet) return true;
    try { toast?.info?.(seen ? (name === ONCE_NAME.all ? `채팅 전체를 실어 ${seen}번 보냈어요${amount}. 미트볼 문구를 원래 단계로 돌려놨어요.` : `「${name}」 ${josa(name, '으로', '로')} ${seen}번 보냈어요${amount}. 미트볼 문구를 원래 단계로 돌려놨어요.`) : (name === ONCE_NAME.all ? '미트볼 생성이 없어서 채팅 전체 싣기를 거두고 원래 단계로 돌려놨어요.' : `미트볼 생성이 없어서 「${name}」 ${josa(name, '을', '를')} 거두고 원래 단계로 돌려놨어요.`), '', { timeOut: amount ? 15000 : 9000 }); } catch { /* 알림 없이 */ }
    return true;
}
/** 설정이 바뀔 때마다(src/apply.js) — 그 확장이 아직 안 떴으면 조금 뒤 한 번 더 */
export async function syncMbPrompt(want, count = DEFAULT_COUNT, chars = DEFAULT_CHARS, { c = ctx(), doc = globalThis.document, retry = true, toast = globalThis.toastr, cap = state.cap } = {}) {
    state.level = level(want); state.count = count; state.chars = chars; state.cap = Math.max(0, Math.round(Number(cap)) || 0);
    watchDupes(c);
    if (readOnce()) {   // 「이번 한 번만」 이 걸려 있는 동안은 채팅 전체 그대로 — 때가 지났으면 여기서 돌려놔요
        if (state.once.until > now()) { ensureMacro(c); watchOnce(); state.last = await syncPrompt(onceBlock(state.once.level || 'all'), { c, doc }); if (state.last.ok) await syncRules(rulesOn(state.level, doc), { c, doc }).catch(() => null); return state.last; }
        await endOnce({ c, doc, toast, force: true });
        return state.last ?? { ok: true, changed: true, why: '', level: state.level };
    }
    if ((state.level === 'recent' || state.level === 'all') && !ensureMacro(c)) {
        try { toast?.warning?.('이 실리태번 판은 매크로 등록이 없어 「최근 답 여러 개 · 채팅 전체」 를 못 써요 — 「마지막 답 전체」 로 적용했어요.', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ }
        state.level = 'last';
    }
    const r = await syncPrompt(state.level, { c, doc });
    state.last = r;
    if (r.ok) await syncRules(rulesOn(state.level, doc), { c, doc }).catch(() => null);   // 1.6.1 줄 꼴 규칙: 단계가 무엇이든(「가볍게」 부터) 같이 붙고, 「적용 안 함」 이면 같이 떼요
    if (!r.ok && retry && !state.timer && globalThis.setTimeout) state.timer = setTimeout(() => { state.timer = null; syncMbPrompt(state.level, state.count, state.chars, { retry: false }).catch(() => { /* 다음 설정 바뀜에 */ }); }, 4000);
    if (!r.ok && !retry && state.level !== 'off' && r.why === 'shape') { try { toast?.warning?.('미트볼의 「생성 시스템 프롬프트」 자리를 못 찾았어요(다른 판) — 문구는 그대로 뒀어요.', '', { timeOut: 8000 }); } catch { /* 알림 없이 */ } }
    return r;
}
// ── 1.6.5 만들기 뒤 관계 숫자 바로잡기(AI 에 기대지 않는 안전망) ─────────────────────────────
// 11-17 사용자 「완벽하게 고쳐」: 「채팅 전체」 · 「기억 요약」 으로 만들어 적용한 직후, 관계 칸의 애정 · 우정이 본편 AI 가 답마다 남긴 변화 합보다
//   처음 쪽(0 근처)에 머물러 있으면 그 합까지 끌어올려요(합이 음수면 그만큼 끌어내려요). AI 가 이미 합을 따랐으면 그대로예요.
//   고른 방식 — 「max(AI 값, 채팅 변화 합)」(음수 합은 min): 그 확장의 관계 값은 −100 ~ 100 이고 만들기 지시의 시작 값이 대개 −10 ~ 10(애정) · −10 ~ 30(우정)이라,
//     변화 합은 「처음 만났을 때부터 쌓인 양」 의 아래 끝이에요. 「시작 기준값 + 합」 은 시작 값을 몰라 AI 가 이미 합을 더한 값에 또 더할 위험이 있고(두 번 셈),
//     「합으로 덮어쓰기」 는 카드 · 로어북의 오랜 사이(어릴 적 인연 등)를 지워요. max 는 그 둘을 피하고, AI 가 맞게 준 값은 건드리지 않아요.
//   단계는 숫자가 바뀐 사람만 −1(그 확장의 「자동」 — 계산할 때 단계 기준표 stageIndex(애정 · 우정 문턱)로 정해요)로 돌려 그 확장이 다시 계산하게 해요.
//   이름 맞추기: 정확히 같은 이름 · 별칭(aliases) · 이름표(label) 안의 낱말(직함으로 적힌 변화 줄 — 예: 사람 이름 대신 직함). 못 맞춘 사람은 그대로.
//   그 확장 파일은 안 고쳐요: 채팅 메타데이터의 상태창 자료(statussim.base · origin)만 고치고, 그 확장이 이미 띄운 core 모듈의 화면 새로고침(app.refreshNow)을 불러요(같은 모듈 주소).
const metaMb = c => c?.chatMetadata?.statussim || null;
/** 지금 상태창 기준 자료(만들기 적용 전후를 가리려고 같은 것인지만 봐요) */
export const baseRef = (c = ctx()) => metaMb(c)?.base || null;
const clampRel = n => Math.max(-100, Math.min(100, Math.round(n)));
const words = s => String(s ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** 관계 한 사람에 맞는 변화 합(없으면 null) */
const namesOf = r => [String(r?.name ?? '').toLowerCase(), ...(Array.isArray(r?.aliases) ? r.aliases : []).map(a => String(a).toLowerCase())].filter(Boolean);
export function sumFor(r, sums, list = [r]) {
    if (!r?.name || !sums?.size) return null;
    const mine = namesOf(r);
    for (const [k, v] of sums) if (mine.includes(String(k).toLowerCase())) return v;
    if ([...sums.keys()].some(k => mine.includes(String(k).toLowerCase()))) return null;
    // 이름표의 낱말(직함)로 맞추기는 아주 좁게: 그 낱말이 누구의 이름 · 별칭도 아니고, 이름표에 그 낱말이 든 사람이 딱 한 명일 때만
    //   (진짜 모델 다시 넣기에서 「the very first Captain」 같은 다른 사람 이름표에 걸려 엉뚱한 사람이 올라간 것을 막아요)
    const all = Array.isArray(list) && list.length ? list : [r];
    for (const [k, v] of sums) {
        const kk = String(k).toLowerCase(); if (kk.includes(' ')) continue;
        if (all.some(p => namesOf(p).includes(kk))) continue;
        const holders = all.filter(p => words(p?.label).includes(kk));
        if (holders.length === 1 && holders[0] === r) return v;
    }
    return null;
}
/** 1.6.8 알림에 보일 시간대 이름: 화면 언어가 한국어면 영어 시간대를 아침 · 낮 · 저녁 · 밤 · 심야 · 새벽으로(달력 값은 그대로 · 보이는 글만) */
export function timeLabel(t, c = ctx()) {
    const s = String(t ?? ''); let ko = false;
    try { ko = /^ko(?:[-_]|$)/i.test(String(c?.getCurrentLocale?.() ?? globalThis.document?.documentElement?.lang ?? '')); } catch { ko = false; }
    if (!ko || /[ㄱ-힣]/.test(s)) return s;
    return slotWord(s)?.word ?? s;
}
/** 마지막 시간대 글(「Evening -> Night」 면 화살표 뒤) → 그 확장 달력의 시간대 이름(달력 times 에 있을 때만) */
// 버그 사냥 2: 저녁 · 밤을 낮보다 먼저 — 「낮」 규칙의 오후 · day 가 「저녁 (오후 7시)」 · 「Sunday night」 을 먼저 잡아 달력이 낮으로 바뀌었어요.
//   day 는 낱말로만(Sunday 의 day 아님) · 오전/오후는 시각과 함께면 시각으로(「오후 11시」 = 밤) · 시각만 적힌 글은 그 확장 timeWords 와 같은 칸으로
const TIME_WORDS = [[/late\s*night|midnight|심야|한밤/i, '심야'], [/dawn|새벽/i, '새벽'], [/evening|dusk|sunset|저녁|해질/i, '저녁'], [/night|밤/i, '밤'], [/morning|아침/i, '아침'], [/noon|afternoon|\bday(?:time)?\b(?!\s*\d)|lunch|낮|점심/i, '낮']];
const HALF_WORDS = [[/오전/, '아침'], [/오후/, '낮']];
/** 시각 글(「23:30」 · 「오후 11시」 · 「6:30 AM」) → 그 확장 timeWords 의 시간대 이름(못 읽으면 null) */
// 버그 사냥 4: 「+2시간」 · 「2시간 후」 · 「Day 3: 10 minutes later」 는 지난 시간(그 확장도 「N시간 지남」 으로 읽어요)이지 시각이 아니에요 — 「2시」 · 「3: 10」 으로 읽어 심야로 덮었어요
const RELATIVE = /^[+＋]\s*\d|\d\s*(?:시간|時間)|\d\s*(?:hours?|hrs?|minutes?|mins?)\b|\d\s*분\s*(?:후|뒤|지나)|\blater\b/i;
function clockSlot(s) {
    let h, m = 0, x;
    if (RELATIVE.test(s)) return null;
    if ((x = s.match(/(\d{1,2})\s*[:：]\s*(\d{2})(?!\d)/))) { h = +x[1]; m = +x[2]; }
    else if ((x = s.match(/(\d{1,2})\s*[시時](?:\s*(\d{1,2})\s*[분分]|\s*(반))?/))) { h = +x[1]; m = x[3] ? 30 : +(x[2] ?? 0); }
    else if ((x = s.match(/(?:^|[^\d])(\d{1,2})\s*[ap]\.?m\b/i))) h = +x[1];
    else return null;
    if (!(h >= 0 && h <= 24 && m >= 0 && m <= 59)) return null;
    const pm = /오후|午後|\d\s*p\.?m\b/i.test(s), am = /오전|午前|\d\s*a\.?m\b/i.test(s);
    if (pm && h < 12) h += 12; else if (am && h === 12) h = 0;
    const min = (h % 24) * 60 + m;
    return min < 300 ? '심야' : min < 420 ? '새벽' : min < 660 ? '아침' : min < 1080 ? '낮' : min < 1260 ? '저녁' : '밤';
}
/** 시간대 글 → { re, word } (낱말 → 시각 → 오전/오후) · 못 읽으면 null */
function slotWord(s) {
    for (const [re, word] of TIME_WORDS) if (re.test(s)) return { re, word };
    const c = clockSlot(s); if (c) return { re: new RegExp(c), word: c };
    for (const [re, word] of HALF_WORDS) if (re.test(s)) return { re, word };
    return null;
}
export function timeOfDay(raw, times = []) {
    const s = String(raw ?? '').split(/->|→|=>|⇒|\u27A1/).pop().replace(/^[\uFE0F\s]+/, '').trim(); if (!s) return null;   // 버그 사냥 2: 그 확장처럼 => · ⇒ · 굵은 오른쪽 화살표(U+27A1)도 나눠요
    const list = Array.isArray(times) ? times.map(String) : [];
    const exact = list.find(t => t.toLowerCase() === s.toLowerCase()); if (exact) return exact;
    const w = slotWord(s); if (!w) return null;
    return list.find(t => t === w.word) || list.find(t => w.re.test(t)) || null;
}
/** 관계 숫자 바로잡기 — 바꾼 사람 목록을 돌려줘요. 자료는 그 자리에서 고쳐요(origin 도 같은 사람이면 같이) */
export function reconcileRel(c = ctx(), { rel = true, fill = true } = {}) {   // 1.7.3 rel = 관계 숫자 · 시간대 바로잡기(스위치 relfix) · fill = 빈 프로필 채우기(스위치 fill)
    const meta = metaMb(c), list = meta?.base?.data?.rel?.user, cal = meta?.base?.data?.calendar;
    const led = opsLedger(c), sums = led.sums;
    const changed = []; let checked = 0, time = null;
    // 시간대: 본편 AI 가 마지막으로 적은 시간대(그 확장 달력의 시간대 이름으로 바꿀 수 있을 때만) — 기본 틀 달력이 「아침」 에 머무는 것
    //   1.7.8 시각 달력(그 확장 2.9.0 「시간 적는 법」 24시 · 오전 오후 · 시간대 + 시각 — cal.clock)은 그 확장이 시간 줄을 제 적는 법으로 읽어요. 여기서 시간대 낱말을 덮어쓰면
    //   「갈 곳」 도착 시각 · 다음 시간 셈이 그 낱말을 시각으로 못 읽어 0시로 셈해요 → 시각 달력이면 손대지 않아요(시험 tools/tests/mb-29x.mjs ② · 버그 사냥 2 의 같은 고침과 합침)
    if (rel && cal && led.time && !cal.clock) { const t = timeOfDay(led.time, cal.times); if (t && t !== cal.time) { time = { from: cal.time, to: t }; cal.time = t; } }
    if (!Array.isArray(list) || !list.length || !sums?.size) return { changed, checked, time, added: [] };
    const fix = (r, k, d) => { const v = Number(r[k]) || 0; if (!d) return v; return d > 0 ? Math.max(v, clampRel(d)) : Math.min(v, clampRel(d)); };
    if (rel) for (const r of list) {
        const s = sumFor(r, sums, list); if (!s) continue; checked++;
        const aff = fix(r, 'aff', s.aff), trust = fix(r, 'trust', s.trust);
        if (aff === r.aff && trust === r.trust) continue;
        changed.push({ name: r.name, from: [r.aff, r.trust], to: [aff, trust], sum: [s.aff, s.trust] });
        r.aff = aff; r.trust = trust; r.stage = -1;
        const o = meta.origin?.data?.rel?.user?.find?.(x => x?.name === r.name); if (o) { o.aff = aff; o.trust = trust; o.stage = -1; }
    }
    // 1.6.6 (11-17 사용자 「나에 나오는 사람이 왜 이렇게 적음?」): 그 확장의 프로필 지시는 「주요 인물 + NPC 는 많아야 3」 이라, 관계 칸에는 15명이 있어도 프로필은 6명만 만들기도 해요.
    //   이야기에 변화 줄이 남은 사람(관계 칸에 있고 변화 합이 맞는 사람)인데 프로필이 없으면, 그 사람 관계 칸의 이름표 · 메모로 짧은 프로필을 더해요(AI 호출 없음 · 지어내는 글 없음).
    // 1.6.8 (11-17 사용자: 직함과 이름이 같은 사람인데 프로필에 다른 사람으로 나와요): 관계 칸에 직함으로 적힌 사람을 다른 사람으로 보고 프로필을 더했어요.
    //   더하기 전에 같은 사람일 수 있는지 봐요(maybeSame) — 그럴 수 있으면 더하지 않아요. 더한 프로필에는 표식(FILL_MARK)을 남겨 나중에 중복을 정리할 수 있게 해요.
    const added = [], prof = meta?.base?.data?.profile;
    if (fill && prof && Array.isArray(prof.list)) {
        const has = new Set(prof.list.flatMap(p => namesOf(p)));
        const sets = keySets(booksFor(c), meta?.base);
        for (const r of list) {
            if (!sumFor(r, sums, list) || namesOf(r).some(n => has.has(n))) continue;
            if (maybeSame(r.name, meta.base, sets, r)) continue;
            const p = { name: r.name, role: 'npc', summary: fillSummary(r), fields: [], home: '', sched: '', [FILL_MARK]: 1 };
            prof.list.push(p); added.push(r.name); for (const n of namesOf(r)) has.add(n);
            const op = meta.origin?.data?.profile?.list; if (Array.isArray(op) && !op.some(x => x?.name === r.name)) op.push(structuredClone(p));
        }
    }
    return { changed, checked, time, added };
}
const FILL_MARK = 'blFill';   // 1.6.8 테마가 관계 칸으로 더한 프로필 표식
const fillSummary = r => [r?.label, r?.memo].map(x => String(x ?? '').trim()).filter(Boolean).join(' — ').slice(0, 200);
const profText = p => [p?.summary, ...(Array.isArray(p?.fields) ? p.fields.flatMap(f => [f?.k, f?.v]) : [])].map(x => String(x ?? '')).join(' ');
/**
 * 1.6.8 관계 칸 이름이 이미 있는 다른 사람과 같은 사람일 수 있나(프로필을 더하기 전에 — 그럴 수 있으면 안 더해요).
 *   ① 로어북 열쇠 묶음에서 그 낱말이 상태창의 다른 사람(관계 · 프로필) 이름과 같이 나오면(직함 · 별명일 수 있어요)
 *   ② 로어북을 못 읽었으면: 다른 프로필의 글(요약 · 칸)에 그 낱말이 낱말로 나오면
 */
export function maybeSame(name, base, sets, self = null) {
    const w = nmKey(name); if (!w) return true;
    const others = new Map();
    for (const r of panelRows(base)) if (r !== self && r.name && nmKey(r.name) !== w) others.set(nmKey(r.name), String(r.name));
    if (sets?.length) return holdersOf(name, others, sets).names.length > 0;
    // 버그 사냥 9b: 한글은 조사가 붙은 꼴(「왕이라」)도 낱말로 봐요 — 전엔 글자 경계만 봐서 못 알아보고 같은 사람 프로필을 하나 더 더했어요
    return (base?.data?.profile?.list || []).some(p => p && p !== self && nmKey(p.name) !== w && hasWord(profText(p), name));
}
/** 테마가 관계 칸으로 더한 프로필인가: 표식이 있거나 · 1.6.6 꼴(표식 전) 그대로 — npc · 칸 없음 · 요약이 그 이름 관계 칸의 「이름표 — 메모」 와 글자 하나 안 다름 */
export function isFilled(p, rel = []) {
    if (!p || typeof p !== 'object' || p.role !== 'npc') return false;
    if (p[FILL_MARK]) return true;
    if ((Array.isArray(p.fields) ? p.fields.length : 1) || String(p.home ?? '') || String(p.sched ?? '')) return false;
    const r = (Array.isArray(rel) ? rel : []).find(x => x?.name === p.name);
    return !!r && String(p.summary ?? '') === fillSummary(r) && String(p.summary ?? '') !== '';
}
/**
 * 1.6.8 이미 생긴 중복 프로필 정리 — 테마가 더한 프로필(isFilled)만 보고, 사용자가 만든 프로필 · AI 가 만든 프로필은 손대지 않아요.
 *   지우는 때(같은 사람으로 확인될 때만): 그 이름이 다른 프로필 이름과 같거나, 로어북 열쇠 묶음에서 그 낱말이 나오는 항목 **모두**에
 *   프로필이 있는 사람 이름이 들어 있고(아는 이름 없는 항목이 하나라도 있으면 안 지워요) — 그 낱말이 누구를 가리키든 그 사람 프로필이 이미 있어요.
 *   로어북을 못 읽었으면 지우지 않아요. 돌려주는 것: 지운 이름 목록(base · origin 같이)
 */
export function dedupeFilled(c = ctx(), { books = booksFor(c) } = {}) {
    const meta = metaMb(c), list = meta?.base?.data?.profile?.list, rel = meta?.base?.data?.rel?.user;
    const out = []; if (!Array.isArray(list)) return out;
    const sets = keySets(books, meta.base);
    for (const p of [...list]) {
        if (!isFilled(p, rel)) continue;
        const w = nmKey(p.name), rest = list.filter(x => x && x !== p && x.role !== 'user' && !out.includes(x));
        let same = rest.some(x => namesOf(x).includes(w));
        if (!same && sets.length) {
            const profs = new Map(rest.filter(x => x.name).map(x => [nmKey(x.name), String(x.name)]));
            const h = holdersOf(p.name, profs, sets);
            same = !h.self && h.names.length > 0 && h.unknown === 0;
        }
        if (!same) continue;
        out.push(p); list.splice(list.indexOf(p), 1);
        const ol = meta.origin?.data?.profile?.list; if (Array.isArray(ol)) { const i = ol.findIndex(x => x?.name === p.name && isFilled(x, meta.origin?.data?.rel?.user || rel)); if (i >= 0) ol.splice(i, 1); }
    }
    return out.map(p => p.name);
}
/** 1.6.8 채팅이 바뀔 때마다 중복 프로필 정리(한 번만 걸어요 · 지금 채팅도 바로) */
let dupeWatch = false;
/** 1.6.9 미트볼 문(src/mb-read.js)이 상태창 있는 채팅을 처음 열 때 불러요 — 「미트볼 문구」 를 안 써도 채팅을 열 때 정리가 돌게 */
export const watchChats = (c = ctx()) => watchDupes(c);
function watchDupes(c = ctx()) {
    if (dupeWatch) return; dupeWatch = true;
    const run = () => { cleanupDupes().catch(() => { /* 다음 채팅에 */ }); };
    try { const ev = c?.eventTypes?.CHAT_CHANGED ?? c?.event_types?.CHAT_CHANGED; if (ev && c?.eventSource?.on) c.eventSource.on(ev, () => setTimeout(run, 1500)); } catch { /* 만들기 창 · 만든 뒤에만 */ }
    Promise.resolve().then(run);
}
/** 채팅을 열 때 · 만들기 창이 뜰 때: 중복 프로필을 정리하고 저장 · 새로고침 · 한 줄 알려요(채팅마다 한 번)
 *   재현(11-17): 알림이 두 번 떴어요(채팅 열 때 + 만들기 창). 그래서 알린 이름 · 도는 중인 정리를 globalThis 에 두고(모듈이 두 벌 떠도 같이 봐요),
 *   같은 채팅에서 이미 알린 이름은 다시 지워져도(그 확장이 화면 자료로 되살렸다 다시 걸리는 때) 알림 없이 정리만 해요. */
const DEDUP = (globalThis.__blMbDedupe ||= { seen: new Set(), told: new Set(), run: null });
export async function cleanupDupes({ c = undefined, toast = globalThis.toastr, doc = globalThis.document, core = undefined, engine = undefined, force = false } = {}) {
    const cx = c || ctx(); if (!metaMb(cx)?.base) return [];
    if (!swOn('dedupe', doc) && !swOn('merge', doc)) return [];   // 1.7.3 스위치 둘 다 끔 — 손대지 않고 「한 번 함」 으로도 안 적어요(다시 켜고 열면 해요)
    if (themeOff(doc)) return [];   // 버그 사냥 9b: 테마를 꺼 뒀으면(「블루레몬에이드 사용」 끔) 그 확장 자료를 고치지 않아요 — 「한 번 함」 으로도 안 적어 다시 켜고 열면 해요
    const key = bookKey(cx); if (!force && DEDUP.seen.has(key)) return [];
    while (DEDUP.run) { try { await DEDUP.run; } catch { /* 앞 정리 실패해도 이어서 */ } }   // 한 번에 하나씩
    if (!force && DEDUP.seen.has(key)) return [];
    DEDUP.seen.add(key);
    let done; DEDUP.run = new Promise(r => { done = r; });
    let gone = [], merged = [];
    try {
        if (!booksFresh(cx)) await primeBooks(cx);
        // 버그 사냥 9: 기다리는 사이(앞 정리 · 로어북 받기) 채팅이 바뀌었으면 손대지 않아요 — 앞 채팅 자료를 고쳐 놓고 새 채팅을 저장 · 알리던 것. 그 채팅을 다시 열면 그때 해요
        if (bookKey(cx) !== key) { DEDUP.seen.delete(key); return []; }
        gone = swOn('dedupe', doc) ? dedupeFilled(cx) : [];   // 1.7.3 스위치 「중복 프로필 정리」
        try { merged = swOn('merge', doc) ? mergeTitles(cx) : []; } catch { merged = []; }   // 1.7.3 스위치 「직함 줄 · 이름 줄 합치기」   // 1.6.9 관계 칸의 직함 줄 · 이름 줄 합치기(그 확장의 「합치기」 와 같은 기록으로)
        if (merged.length) await fitAdjust(metaMb(cx), doc, engine);
        if (gone.length || merged.length) {
            try { await cx.saveMetadata?.(); } catch { /* 다음 저장 때 */ }
            try { const m = core === undefined ? await mbCore(doc) : core; m?.app?.refreshNow?.(); } catch { /* 다음 새로고침 때 */ }
            const fresh = gone.filter(n => !DEDUP.told.has(`${key}|${nmKey(n)}`));
            for (const n of gone) DEDUP.told.add(`${key}|${nmKey(n)}`);
            if (fresh.length) { try { toast?.info?.(`같은 사람이 프로필에 둘로 나뉘어 있어 블루레몬이 더했던 프로필 ${fresh.length}개를 정리했어요(${fresh.join(' · ')}). 직접 만든 프로필은 그대로예요.`, '', { timeOut: 10000 }); } catch { /* 알림 없이 */ } }
            if (merged.length) { try { toast?.info?.(mergeLine(merged, cx), '', { timeOut: 14000 }); } catch { /* 알림 없이 */ } }
        }
    } finally { DEDUP.run = null; done(); }
    Object.defineProperty(gone, 'merged', { value: merged });   // 목록 비교에 안 섞이게(숨은 칸)
    return gone;
}
/**
 * 1.6.9 관계 칸에 같은 사람이 직함 줄과 이름 줄로 따로 있을 때 — 이미 만든 상태창도 채팅을 열 때 합쳐요(11-17 사용자: 직함 줄 · 이름 줄이 따로 나와요).
 *   같은 사람으로 보는 때(아주 좁게 · 하나라도 어긋나면 그대로):
 *   ① 그 줄 이름(직함 X)이 사용자 · 카드 이름이 아니고, 테마가 더한 것이 아닌 프로필(사람이 쓴 · AI 가 만든)도 없어요(진짜 이름의 사람이 아니에요)
 *   ② 로어북 열쇠 묶음에서 X 가 나오는 항목 **모두**에 상태창의 다른 사람 이름이 들어 있어요(사람 없는 설정 항목에 나오는 낱말이면 그대로) — 로어북을 못 읽으면 그대로
 *   ③ 그 후보들 가운데 **관계 칸 자기 글(이름표 · 메모)에 X 가 낱말로 든 사람이 정확히 하나**예요(예: 메모 「… known by staff as X」).
 *      프로필 요약은 안 봐요 — 같은 직함을 예전에 가졌던 다른 사람 요약에도 그 낱말이 나와요(「former X」)
 *   ④ X 줄 자기 글에 그 후보 이름이 나오면 안 합쳐요(그 사람과 관계가 있는 다른 이 — 예: 「후보의 고양이」)
 *   ⑤ 둘 이상의 직함이 한 사람으로 모이거나, 합칠 사람이 또 다른 줄로 합쳐지는 꼴이면 그대로
 *   합치는 방법: 그 확장의 「합치기」 단추(관계 카드 🔗)가 남기는 것과 똑같은 편집 기록(`_merge` 「X => 이름」)을 더해요 —
 *     그 확장이 계산할 때 X 의 애정 · 우정을 그 사람에게 더하고(두 줄은 본편 AI 가 따로 센 변화라 더한 값이 채팅 변화 합과 같아요) 비어 있는 이름표 · 메모 · 만난 곳은
 *     X 쪽 것으로 채우고 · 관계 짝(a · b) · 지난 일도 그 사람으로 · 앞으로 본편 AI 가 X 라고 적는 변화도 그 사람에게 가요. 관리 탭 되돌리기로 되돌릴 수 있어요.
 *   돌려주는 것: [{ from, to }]
 */
export function titleMerges(c = ctx(), { books = booksFor(c) } = {}) {
    const meta = metaMb(c), base = meta?.base; if (!base?.data) return [];
    const sets = keySets(books, base); if (!sets.length) return [];
    const list = relNow(meta); if (list.length < 2) return [];
    const done = mergedFrom(meta);
    for (const n of mergedOnce(c)) done.add(n);   // 버그 사냥 9: 테마가 한 번 합친 이름은 그 기록을 사용자가 되돌렸어도(기록이 빠짐) 다시 안 합쳐요
    const baseRel = base.data.rel?.user || [];
    const people = (base.data.profile?.list || []).filter(p => p?.name && p.role !== 'user' && !isFilled(p, baseRel));
    const realProf = new Set(people.map(p => nmKey(p.name)));
    const skip = new Set([nmKey(c?.name1), ...cardsOf(c).map(ch => nmKey(ch?.name)), ...(base.data.profile?.list || []).filter(p => p?.role === 'user').map(p => nmKey(p.name))].filter(Boolean));
    const rowOf = n => list.find(x => nmKey(x?.name) === nmKey(n));
    const out = [];
    for (const r of list) {
        const X = String(r?.name ?? '').trim(), w = nmKey(X); if (!w || skip.has(w) || realProf.has(w) || done.has(w)) continue;
        const others = new Map(); for (const x of [...list, ...people]) if (x !== r && x?.name && nmKey(x.name) !== w && !skip.has(nmKey(x.name))) others.set(nmKey(x.name), String(x.name));   // 상태창의 다른 사람(관계 줄 · 진짜 프로필)
        const h = holdersOf(X, others, sets); if (h.self || !h.names.length || h.unknown) continue;
        if (h.names.some(n => mentions(rowText(r), n))) continue;                                 // ④ 넓게(들어 있으면) — 다른 이일 수 있으면 안 합쳐요
        // ③ 버그 사냥 9b: 낱말로 든 후보가 정확히 하나이고, 다른 후보 글에는 그 글자가 아예 없을 때만(「왕」 ↔ 「왕자」 · 「여왕」 — 좁혀서 생기는 새 합치기는 없어요)
        const cand = h.names.filter(n => { const t = rowOf(n); return t && hasWord(rowText(t), X); });
        const loose = h.names.filter(n => { const t = rowOf(n); return t && mentions(rowText(t), X); });
        if (cand.length === 1 && loose.length === 1) out.push({ from: X, to: String(rowOf(cand[0]).name) });
    }
    return out.filter(m => out.filter(x => x.to === m.to).length === 1 && !out.some(x => nmKey(x.from) === nmKey(m.to)));   // ⑤
}
const rowText = r => [r?.label, r?.memo].map(x => String(x ?? '')).join(' \n ');
/** 글에 들어 있나(넓게 · 대소문자 무시) — 라틴 글자 낱말은 낱말 경계로, 그 밖(한글 · 한자 · 가나 등)은 들어 있으면. 「다른 이일 수 있나」 처럼 넓게 볼수록 안전한 자리에 써요(1.6.9 의 hasWord) */
function mentions(text, word) {
    const w = String(word ?? '').normalize('NFC').trim(); if (!w) return false;
    const t = String(text ?? '').normalize('NFC');
    if (!/^[\p{Script=Latin}\p{N}\s'’.-]+$/u.test(w)) return t.toLowerCase().includes(w.toLowerCase());
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w)}($|[^\\p{L}\\p{N}])`, 'iu').test(t);
}
// 버그 사냥 9b: 한글 낱말 뒤에 붙어도 같은 낱말로 보는 조사 · 어미(그 뒤는 글자가 아니어야 해요). 앞에 글자가 붙으면(「여왕」 · 「국왕」) 다른 낱말이에요
const KO_TAIL = '(?:이|가|은|는|을|를|의|에|에게|에게서|에서|께|께서|와|과|도|만|로|으로|로서|으로서|랑|이랑|한테|처럼|보다|님|씨|이다|다|이며|며|이고|고|이자|자|인|이던|이었던|였던|이라|라|이라고|라고|이라는|라는|이란|란|이야|야|이여|여|이었다|였다|이에요|예요|이지만|지만)?';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 낱말로 들었나(대소문자 무시) — 라틴 글자 낱말은 낱말 경계로 · 한글 낱말은 앞이 글자가 아니고 뒤가 조사 · 어미뿐일 때 · 그 밖(한자 · 가나 등 띄어쓰기 없는 글)은 들어 있으면 */
function hasWord(text, word) {
    const w = String(word ?? '').normalize('NFC').trim(); if (!w) return false;
    const t = String(text ?? '').normalize('NFC');
    if (/^[\p{Script=Hangul}\p{N}\s]+$/u.test(w)) return new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w)}${KO_TAIL}($|[^\\p{L}\\p{N}])`, 'iu').test(t);
    return mentions(t, w);
}
/** 지금 관계 칸 줄: 그 확장의 마지막 「칸 통째 저장」 편집(직접 편집 · AI 로 수정) 기록이 있으면 그것 · 없으면 기준 자료 */
function relNow(meta) {
    const adj = (Array.isArray(meta?.adjust) ? meta.adjust : []).filter(a => !a?._off && a?.set?.mod === 'rel' && Array.isArray(a.set.data?.user));
    const last = adj.sort((a, b) => (a.at - b.at) || (a.t - b.t)).at(-1);
    return (last ? last.set.data.user : meta?.base?.data?.rel?.user || []).filter(r => r && typeof r === 'object');
}
/** 이미 합친 이름(그 확장의 합치기 기록 · 이름 표) — 다시 합치지 않아요 */
function mergedFrom(meta) {
    const out = new Set();
    for (const a of Array.isArray(meta?.adjust) ? meta.adjust : []) if (!a?._off) for (const op of a?.ops || []) if (op?.[0] === '_merge') { const f = String(op[1] ?? '').split('=>')[0]; if (f.trim()) out.add(nmKey(f)); }
    for (const al of [meta?.base?.data?.rel?.alias, ...(meta?.adjust || []).map(a => a?.set?.mod === 'rel' ? a.set.data?.alias : null)]) if (al && typeof al === 'object') for (const k of Object.keys(al)) out.add(nmKey(k));
    return out;
}
/**
 * 버그 사냥 9: 테마가 합친 이름 장부(채팅 메타데이터 bl_mb_merged — 그 확장 자료 밖 · 채팅 파일에 같이 저장돼요).
 *   그 확장의 되돌리기(관리 탭 · /ss-undo)는 합치기 기록을 통째로 빼서, 장부 없이는 다음에 채팅을 열 때 · 만들기 창을 닫을 때 같은 합치기를 또 더했어요
 *   (알림이 「되돌릴 수 있어요」 라고 해 놓고 되돌릴 수 없던 것).
 */
const MERGED_KEY = 'bl_mb_merged';
function mergedOnce(c) { const v = c?.chatMetadata?.[MERGED_KEY]; return Array.isArray(v) ? v.map(nmKey).filter(Boolean) : []; }
/** 합치기 기록을 더해요(그 확장의 addAdjust 와 같은 꼴 · 메시지에 묶지 않는 편집) — 돌려주는 것: 더한 [{ from, to }] */
export function mergeTitles(c = ctx(), { books = booksFor(c), now = Date.now } = {}) {
    const meta = metaMb(c); if (!meta?.base) return [];
    const list = titleMerges(c, { books }); if (!list.length) return [];
    meta.adjust = Array.isArray(meta.adjust) ? meta.adjust : [];
    const at = Array.isArray(c?.chat) ? c.chat.length : 0;
    for (const { from, to } of list) {
        let t = now(); for (const e of meta.adjust) if (e?.t >= t) t = e.t + 0.001;
        for (const e of meta.adjust) if (e && !e.an && e.at > at) e.at = at;
        meta.adjust.push({ at, t, ops: [['_merge', `${from} => ${to}`]], label: `🔗 ${from} → ${to} 합침` });
    }
    if (c?.chatMetadata && typeof c.chatMetadata === 'object') {
        const was = Array.isArray(c.chatMetadata[MERGED_KEY]) ? c.chatMetadata[MERGED_KEY] : [];
        c.chatMetadata[MERGED_KEY] = [...new Set([...was, ...list.map(m => m.from)])].slice(-200);
    }
    return list;
}
/** 합친 알림 한 줄 — 이름은 그 확장의 화면 번역(채팅마다 쌓인 사전)이 있으면 그 글로 */
export function mergeLine(list, c = ctx()) {
    const tr = metaMb(c)?.tr; const shown = n => (tr && typeof tr === 'object' && typeof tr[n] === 'string' && tr[n].trim()) || n;
    const pairs = list.map(m => `${shown(m.from)} → ${shown(m.to)}`).join(' · '), first = shown(list[0].from);
    return `관계 칸에 같은 사람이 직함 줄과 이름 줄로 나뉘어 있어 합쳤어요(${pairs}). 미트볼 「합치기」 와 같아요 — 애정 · 우정은 두 줄을 더하고, 앞으로 「${first}」${josa(first, '으로', '로')} 적힌 변화도 그 사람에게 가요. 관리 탭 되돌리기로 되돌릴 수 있어요.`;
}
/**
 * 1.6.8 만든 뒤 이름 칸이 직함이면 이름으로 — 아주 좁게(사람이 섞이지 않게):
 *   ① 그 이름이 만들기 전 상태창 · 카드에 있던 이름이 아니고(before = 만들기 전 기준 자료) ② 그 낱말이 든 열쇠 묶음(로어북 항목 · 그때 상태창의 이름 · 별칭)을 다 모아
 *   확실한 이름이 정확히 한 사람만 나오고 · 아는 이름이 없는 묶음도 없고 ③ 새 상태창에 그 사람 칸이 따로 없을 때만 바꿔요(둘을 합치지 않아요).
 *   바꾸는 자리: 관계 칸 · 관계 짝(a · b) · 프로필 — origin 도 같은 이름이면 같이. 돌려주는 것: [{ from, to }]
 */
export function renameTitles(c = ctx(), { before = null, books = booksFor(c) } = {}) {
    const meta = metaMb(c), d = meta?.base?.data, out = [];
    if (!d) return out;
    const sets = keySets(books, before), known = knownNames(c, before, sets);
    if (!known.size || !sets.length) return out;
    let seen = new Set(); try { seen = new Set([...opsLedger(c).sums.keys()].map(nmKey)); } catch { /* 변화 줄 없이 */ }   // 본편 AI 가 따로 센 사람끼리는 안 합쳐요
    const odata = meta.origin?.data;
    const lists = [[d.rel?.user, odata?.rel?.user], [d.profile?.list, odata?.profile?.list]];
    const rows = lists.flatMap(([list, olist]) => [...(Array.isArray(list) ? list : []), ...(Array.isArray(olist) ? olist : [])]).filter(r => r && typeof r === 'object');
    const swap = new Map();
    for (const r of rows) {
        if (!r.name || r.role === 'user' || swap.has(r.name)) continue;
        const from = r.name, t = onlyHolder(holdersOf(from, known, sets)); if (!t || seen.has(nmKey(t))) continue;
        if (rows.some(x => x.name !== from && namesOf(x).includes(nmKey(t)))) continue;   // 그 사람 칸이 어디든 따로 있으면 손대지 않아요(둘을 합치지 않아요)
        swap.set(from, t);
    }
    const vals = [...swap.values()];
    for (const [from, to] of [...swap]) if (vals.filter(v => v === to).length > 1) swap.delete(from);   // 두 직함이 한 사람으로 모이면 둘 다 그대로
    const unsure = new Map();   // 직함으로 보이는데 후보가 둘 이상이라 그대로 둔 이름 → 후보(알림에만 써요)
    for (const r of rows) { if (!r.name || r.role === 'user' || swap.has(r.name) || unsure.has(r.name)) continue; const h = holdersOf(r.name, known, sets); if (!h.self && h.names.length >= 2) unsure.set(r.name, h.names); }
    Object.defineProperty(out, 'unsure', { value: [...unsure].map(([name, of]) => ({ name, of })) });   // 목록 비교에 안 섞이게(숨은 칸)
    for (const [from, to] of swap) {
        for (const r of rows) if (r.name === from) r.name = to;
        for (const p of [...(d.rel?.pairs || []), ...(odata?.rel?.pairs || [])]) { if (p?.a === from) p.a = to; if (p?.b === from) p.b = to; }
        out.push({ from, to });
    }
    return out;
}
async function mbCore(doc = globalThis.document, load = url => import(url), file = './src/core.js') {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;
        return await load(new URL(file, src).href);
    } catch { return null; }
}
/** 테마를 꺼 뒀나(body.salty 없음) — 문서를 모르면(시험 · 옛 판) 켜진 것으로 */
const themeOff = doc => !!doc?.body?.classList?.contains && !doc.body.classList.contains('salty');
/**
 * 버그 사냥 9b: 그 확장은 편집 기록을 더할 때(addAdjust) 80개를 넘으면 그 자리에서 squash 로 오래된 기록을 굳혀요. 테마가 합치기 기록을 더할 때도 같은 규칙으로 —
 *   그 확장이 이미 띄운 engine 모듈(같은 주소)의 squash 를 불러요(굳히는 계산은 그 확장 몫 · 테마는 문턱만 같이 봐요). 못 받으면 그대로(그 확장의 다음 addAdjust 가 정리해요).
 */
async function fitAdjust(meta, doc = globalThis.document, engine = undefined) {
    if (!Array.isArray(meta?.adjust) || meta.adjust.length <= 80) return false;
    try { const e = engine === undefined ? await mbCore(doc, undefined, './src/engine.js') : engine; if (typeof e?.squash !== 'function') return false; e.squash(meta); return true; } catch { return false; }
}
/**
 * 만들기 창이 닫힌 뒤(「채팅 전체」 · 「기억 요약」 으로 보냈을 때만): 상태창 기준 자료가 새것으로 바뀌면(적용) 관계 숫자를 바로잡고 저장 · 새로고침 · 알려요.
 *   before = 고르기를 걸 때의 기준 자료 · 적용이 창 닫힘보다 늦을 수 있어 잠깐(waitMs) 기다려요. 돌려주는 것: 바로잡은 결과 또는 null(적용 안 함)
 */
/** 지금 채팅을 가리는 열쇠(그룹 · 캐릭터 · 채팅 파일) — 만들기 고르기를 걸 때 적어 두고 afterWizard 에 넘겨요 */
export const chatKey = (c = ctx()) => bookKey(c);
export async function afterWizard({ before = null, level = '', chat = undefined, c = undefined, toast = globalThis.toastr, waitMs = 8000, step = 250, doc = globalThis.document, core = undefined, engine = undefined } = {}) {
    if (level !== 'all' && level !== 'memo') return null;
    const cx = () => c || ctx();
    // 버그 사냥 9: 창을 닫자마자(또는 창이 열린 채) 다른 채팅으로 가면 그 채팅의 상태창을 「새로 적용됨」 으로 보고 숫자 · 이름을 고쳐 저장했어요(만들기를 안 한 채팅).
    //   고르기를 건 채팅(chat = chatKey() — 채팅을 바꿔 창이 치워진 때는 부를 때 이미 다른 채팅이에요)에서만 해요 — 기다리는 동안 · 로어북을 받은 뒤 채팅이 바뀌었으면 그만둬요
    const chat0 = chat ?? bookKey(cx()), same = () => bookKey(cx()) === chat0;
    let base = baseRef(cx());
    for (let t = 0; (!base || base === before) && t < waitMs && same(); t += step) { await new Promise(r => setTimeout(r, step)); base = baseRef(cx()); }
    if (!base || base === before || !same()) return null;
    try { if (!booksFresh(cx())) await primeBooks(cx()); } catch { /* 로어북 없이 */ }   // 1.6.8 프로필을 더하기 전 같은 사람 확인 · 직함 이름 바꾸기에 써요
    if (!same()) return null;
    const res = reconcileRel(cx(), { rel: swOn('relfix', doc), fill: swOn('fill', doc) });   // 1.7.3 스위치 「만든 뒤 관계 숫자 · 시간대 바로잡기」 · 「만든 뒤 빈 프로필 채우기」
    try { res.renamed = swOn('rename', doc) ? renameTitles(cx(), { before }) : []; } catch { res.renamed = []; }   // 숫자를 맞춘 뒤에(직함 이름으로 변화 합을 찾고 나서) 이름을 바꿔요 · 1.7.3 스위치 「만든 뒤 직함 이름 바꾸기」
    try { res.merged = swOn('merge', doc) ? mergeTitles(cx()) : []; } catch { res.merged = []; }   // 1.6.9 그래도 직함 줄 · 이름 줄이 둘 다 남았으면 합치기 기록으로(채팅을 열 때와 같은 규칙)
    if (res.merged.length) await fitAdjust(metaMb(cx()), doc, engine);   // 버그 사냥 9b: 그 확장 addAdjust 처럼 80개를 넘으면 정리
    if (res.changed.length || res.time || res.added?.length || res.renamed.length || res.merged.length) {
        try { await cx().saveMetadata?.(); } catch { /* 다음 저장 때 */ }
        try { const m = core === undefined ? await mbCore(doc) : core; m?.app?.refreshNow?.(); } catch { /* 다음 새로고침 때 */ }
    }
    try {
        const tw = res.time ? timeLabel(res.time.to, cx()) : '';
        const tm = (res.time ? ` 시간대도 채팅의 마지막 시간대 「${tw}」${josa(tw, '으로', '로')} 맞췄어요.` : '') + (res.added?.length ? ` 프로필이 없던 ${res.added.length}명은 관계 칸의 이름표 · 메모로 프로필을 더했어요.` : '')
            + (res.renamed.length ? ` 이름 칸에 직함으로 적힌 ${res.renamed.length}명은 카드 · 로어북 이름으로 바꿨어요(${res.renamed.map(x => `${x.from} → ${x.to}`).join(' · ')}).` : '')
            + (res.renamed.unsure?.length ? ` 「${res.renamed.unsure.map(x => x.name).join('」 · 「')}」${josa(res.renamed.unsure.at(-1).name, '은', '는')} 여러 사람의 직함이라(후보 ${res.renamed.unsure.map(x => x.of.join(' · ')).join(' / ')}) 누구인지 몰라 그대로 뒀어요 — 미트볼에서 이름을 고쳐 주세요.` : '');
        if (res.changed.length) toast?.success?.(`관계 숫자를 채팅 기록(${res.changed.length}명)에 맞췄어요 — 본편 AI 가 답마다 남긴 애정 · 우정 변화 합보다 낮게 만들어진 사람만 그 합까지 올렸어요.${tm}`, '', { timeOut: 12000 });
        else if (res.checked) toast?.info?.(`관계 숫자가 채팅 기록을 따라요(${res.checked}명 확인).${tm}`, '', { timeOut: 6000 });
        else if (tm) toast?.info?.(tm.trim(), '', { timeOut: 6000 });
        if (res.merged.length) toast?.info?.(mergeLine(res.merged, cx()), '', { timeOut: 14000 });
    } catch { /* 알림 없이 */ }
    return res;
}
export const lastResult = () => state.last;
/** 지금 걸려 있는 「이번 한 번만」 단계(없으면 '') */
export const onceLevel = () => (onceActive() ? (state.once.level || 'all') : '');
