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
    const rows = [...sum].filter(([, r]) => r.aff || r.trust).map(([n, r]) => `${n}: aff ${sign(r.aff)}, trust ${sign(r.trust)}`);
    const text = ['--- STATUS CHANGES RECORDED DURING THE STORY (written by the story AI after each reply; they are already part of the story — current values must include them) ---',
        'Names here are as the story AI wrote them and may be a title, rank or nickname; in every panel use each person’s real name exactly as in the card, lorebook or current panel data, never the title.',
        rows.length ? `Total relationship changes since the first message (aff = romance, trust = friendship): ${rows.join('; ')}` : '',
        last.place ? `Latest location: ${last.place}` : '', last.time ? `Latest time of day: ${last.time}` : '', last.date ? `Latest date change: ${last.date}` : '',
        events.length ? `Events in order (#N = message number):\n${events.join('\n')}` : ''].filter(Boolean).join('\n');
    return { text, people: rows.length, events: events.length, msgs, sums: sum, time: last.timeRaw || '' };
}
const withLedger = (c, body) => { try { const l = opsLedger(c); return l.text ? `${l.text}\n\n--- STORY TEXT ---\n${body}` : body; } catch { return body; } };
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
    state.once = { until: now() + ONCE_WAIT, seen: 0, level: lv };
    const r = await syncPrompt(onceBlock(lv), { c, doc, def });
    if (r.ok) await syncRules(state.level !== 'off', { c, doc }).catch(() => null);   // 줄 꼴 규칙은 본편 쪽이라 「이번 한 번만」 과 상관없이 평소 단계를 따라요
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
    await syncRules(state.level !== 'off', { c, doc }).catch(() => null);
    if (quiet) return true;
    try { toast?.info?.(seen ? (name === ONCE_NAME.all ? `채팅 전체를 실어 ${seen}번 보냈어요${amount}. 미트볼 문구를 원래 단계로 돌려놨어요.` : `「${name}」 ${josa(name, '으로', '로')} ${seen}번 보냈어요${amount}. 미트볼 문구를 원래 단계로 돌려놨어요.`) : (name === ONCE_NAME.all ? '미트볼 생성이 없어서 채팅 전체 싣기를 거두고 원래 단계로 돌려놨어요.' : `미트볼 생성이 없어서 「${name}」 ${josa(name, '을', '를')} 거두고 원래 단계로 돌려놨어요.`), '', { timeOut: amount ? 15000 : 9000 }); } catch { /* 알림 없이 */ }
    return true;
}
/** 설정이 바뀔 때마다(src/apply.js) — 그 확장이 아직 안 떴으면 조금 뒤 한 번 더 */
export async function syncMbPrompt(want, count = DEFAULT_COUNT, chars = DEFAULT_CHARS, { c = ctx(), doc = globalThis.document, retry = true, toast = globalThis.toastr, cap = state.cap } = {}) {
    state.level = level(want); state.count = count; state.chars = chars; state.cap = Math.max(0, Math.round(Number(cap)) || 0);
    if (readOnce()) {   // 「이번 한 번만」 이 걸려 있는 동안은 채팅 전체 그대로 — 때가 지났으면 여기서 돌려놔요
        if (state.once.until > now()) { ensureMacro(c); watchOnce(); state.last = await syncPrompt(onceBlock(state.once.level || 'all'), { c, doc }); if (state.last.ok) await syncRules(state.level !== 'off', { c, doc }).catch(() => null); return state.last; }
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
/** 마지막 시간대 글(「Evening -> Night」 면 화살표 뒤) → 그 확장 달력의 시간대 이름(달력 times 에 있을 때만) */
const TIME_WORDS = [[/late\s*night|midnight|심야|한밤/i, '심야'], [/dawn|새벽/i, '새벽'], [/morning|아침/i, '아침'], [/noon|afternoon|day|lunch|낮|점심|오후/i, '낮'], [/evening|dusk|sunset|저녁|해질/i, '저녁'], [/night|밤/i, '밤']];
export function timeOfDay(raw, times = []) {
    const s = String(raw ?? '').split(/->|→/).pop().trim(); if (!s) return null;
    const list = Array.isArray(times) ? times.map(String) : [];
    const exact = list.find(t => t.toLowerCase() === s.toLowerCase()); if (exact) return exact;
    for (const [re, ko] of TIME_WORDS) if (re.test(s)) { const hit = list.find(t => t === ko) || list.find(t => re.test(t)); if (hit) return hit; }
    return null;
}
/** 관계 숫자 바로잡기 — 바꾼 사람 목록을 돌려줘요. 자료는 그 자리에서 고쳐요(origin 도 같은 사람이면 같이) */
export function reconcileRel(c = ctx()) {
    const meta = metaMb(c), list = meta?.base?.data?.rel?.user, cal = meta?.base?.data?.calendar;
    const led = opsLedger(c), sums = led.sums;
    const changed = []; let checked = 0, time = null;
    // 시간대: 본편 AI 가 마지막으로 적은 시간대(그 확장 달력의 시간대 이름으로 바꿀 수 있을 때만) — 기본 틀 달력이 「아침」 에 머무는 것
    if (cal && led.time) { const t = timeOfDay(led.time, cal.times); if (t && t !== cal.time) { time = { from: cal.time, to: t }; cal.time = t; } }
    if (!Array.isArray(list) || !list.length || !sums?.size) return { changed, checked, time };
    const fix = (r, k, d) => { const v = Number(r[k]) || 0; if (!d) return v; return d > 0 ? Math.max(v, clampRel(d)) : Math.min(v, clampRel(d)); };
    for (const r of list) {
        const s = sumFor(r, sums, list); if (!s) continue; checked++;
        const aff = fix(r, 'aff', s.aff), trust = fix(r, 'trust', s.trust);
        if (aff === r.aff && trust === r.trust) continue;
        changed.push({ name: r.name, from: [r.aff, r.trust], to: [aff, trust], sum: [s.aff, s.trust] });
        r.aff = aff; r.trust = trust; r.stage = -1;
        const o = meta.origin?.data?.rel?.user?.find?.(x => x?.name === r.name); if (o) { o.aff = aff; o.trust = trust; o.stage = -1; }
    }
    return { changed, checked, time };
}
async function mbCore(doc = globalThis.document, load = url => import(url)) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;
        return await load(new URL('./src/core.js', src).href);
    } catch { return null; }
}
/**
 * 만들기 창이 닫힌 뒤(「채팅 전체」 · 「기억 요약」 으로 보냈을 때만): 상태창 기준 자료가 새것으로 바뀌면(적용) 관계 숫자를 바로잡고 저장 · 새로고침 · 알려요.
 *   before = 고르기를 걸 때의 기준 자료 · 적용이 창 닫힘보다 늦을 수 있어 잠깐(waitMs) 기다려요. 돌려주는 것: 바로잡은 결과 또는 null(적용 안 함)
 */
export async function afterWizard({ before = null, level = '', c = undefined, toast = globalThis.toastr, waitMs = 8000, step = 250, doc = globalThis.document, core = undefined } = {}) {
    if (level !== 'all' && level !== 'memo') return null;
    const cx = () => c || ctx();
    let base = baseRef(cx());
    for (let t = 0; (!base || base === before) && t < waitMs; t += step) { await new Promise(r => setTimeout(r, step)); base = baseRef(cx()); }
    if (!base || base === before) return null;
    const res = reconcileRel(cx());
    if (res.changed.length || res.time) {
        try { await cx().saveMetadata?.(); } catch { /* 다음 저장 때 */ }
        try { const m = core === undefined ? await mbCore(doc) : core; m?.app?.refreshNow?.(); } catch { /* 다음 새로고침 때 */ }
    }
    try {
        const tm = res.time ? ` 시간대도 채팅의 마지막 시간대 「${res.time.to}」 로 맞췄어요.` : '';
        if (res.changed.length) toast?.success?.(`관계 숫자를 채팅 기록(${res.changed.length}명)에 맞췄어요 — 본편 AI 가 답마다 남긴 애정 · 우정 변화 합보다 낮게 만들어진 사람만 그 합까지 올렸어요.${tm}`, '', { timeOut: 12000 });
        else if (res.checked) toast?.info?.(`관계 숫자가 채팅 기록을 따라요(${res.checked}명 확인).${tm}`, '', { timeOut: 6000 });
        else if (tm) toast?.info?.(tm.trim(), '', { timeOut: 6000 });
    } catch { /* 알림 없이 */ }
    return res;
}
export const lastResult = () => state.last;
/** 지금 걸려 있는 「이번 한 번만」 단계(없으면 '') */
export const onceLevel = () => (onceActive() ? (state.once.level || 'all') : '');
