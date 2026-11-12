// 글꾸 마트 「🍽️ 시식하기」 — 붙여 넣은 채팅 로그(글)를 테마 로그 복사의 model(omni-next src/log-copy-capture.js 결과와 같은 모양)로 바꿔요.
// DOM 없는 순수 함수예요(node 로 시험). 그리기는 테마 모듈 사본(mart/lib/log-copy/)이 그대로 해요(taste-render.js).
// 나누는 규칙:
//   ① 줄 앞에 「이름:」(전각 「：」 도)이 있으면 그 이름으로 메시지를 나눠요 — 같은 이름이 두 번 이상 나오거나, 이름 줄이 둘 이상이면 이 길이에요.
//   ② 실리태번 화면에서 그대로 복사한 글(이름 한 줄 · 시간 한 줄 · 본문)도 받아요 — 짧은 줄이 혼자 두 번 이상 나오면 이름으로 보고, 시간 줄은 시각으로 읽고 본문에서 빼요.
//      (11-12 밤) 이름만 있는 짧은 줄 바로 다음 줄이 따옴표 · 낫표 대사면 한 번만 나와도 이름이에요(「나깡 ⏎ "대사"」 — 지문 줄 바로 뒤에 붙어 있어도 따로 떼어 읽어요).
//   ③ 이름이 없으면 빈 줄로 문단을 나누고 번갈아 깡통 · 나로 봐요(빈 줄 두 개 이상으로 나뉜 덩이가 있으면 그 덩이가 메시지 · 한 줄 빈 줄은 문단).
//   처음 나온 이름 둘을 깡통 · 나로 추정하고(셋 이상이면 나머지는 깡통 쪽), 「바꾸기」(swap)로 뒤집어요.
// 글 안 표기: "대사" · “대사” · 「대사」 → 대사 색, *행동* · 『속마음』 → 속마음(기울임), **강조** · ~~취소~~ · `코드`, 줄 앞 # 제목 · > 인용 · - 목록 · 1. 목록 · --- 구분선.
//   색은 테마 마트 빌드의 표본 화면 색(SCREEN — omni-next tools/mart/sample.mjs SAMPLE_SCREEN 과 같은 값)으로 적어 두면, 테마가 틀 색 묶음으로 바꿔 입혀요(conceptModel → recolorLog).

/** 표본 화면 색 — 역할마다 다른 색이어야 틀 색으로 제대로 옮겨져요(값은 테마 tools/mart/sample.mjs 와 같아요) */
export const SCREEN = { bg: '#ffffff', surface: '#ffffff', raised: '#f3f5f8', text: '#1c2a3a', dialogue: '#b4572a', em: '#6b4fa0', strong: '#9a2f4a', marker: '#fff1a8', muted: '#6b7785', faint: '#8a95a3', accent: '#2f7cf6', pop: '#2f7cf6', line: '#d5dbe3' };
/** 사이트 기본 글꼴 묶음(테마 기본 글꼴 묶음과 비슷한 웹폰트 · 마트 미리보기와 같은 값) */
export const FONT = { 'font-family': "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", 'font-size': '15px', 'font-weight': '400', 'letter-spacing': '-0.025em', 'line-height': '1.7', color: SCREEN.text };
/** 이름 기본 색 — 깡통 파랑 · 나 분홍(틀에 끼우면 틀의 이름 색으로 바뀌고, 「그대로」 모양에서만 보여요) */
export const NAME_INK = { char: '#2f7cf6', user: '#d6457a' };
export const DEFAULT_NAMES = ['깡통', '나'];
export const MAX_TEXT = 200000;
export const MAX_MESSAGES = 300;

const S = SCREEN;
const text = t => ({ t: 'text', text: t });
const run = (children, style = {}, kind = null) => ({ t: 'el', block: false, tag: 'span', kind, style, children });
const block = (children, style = {}, kind = 'p', tag = 'div') => ({ t: 'el', block: true, tag, kind, style, children });

// ── 줄 알아보기 ──
const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DATE_KO = '\\d{4}\\s*[.\\-/년]\\s*\\d{1,2}\\s*[.\\-/월]\\s*\\d{1,2}\\s*일?\\.?(?:\\s*\\(?[월화수목금토일]요?일?\\)?)?';
const DATE_EN = `(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}\\s+(?:${MONTHS})\\.?\\s+\\d{4}`;
const CLOCK = '(?:(?:오전|오후|AM|PM|am|pm)\\s*)?\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*(?:AM|PM|am|pm|오전|오후))?';
/** 시간 줄(실리태번 메시지 머리의 보낸 시각) — 날짜 + 시각 · 시각만 · 날짜만 */
export const TIME_LINE = new RegExp(`^(?:(?:${DATE_KO}|${DATE_EN})\\s*,?\\s*(?:${CLOCK})?|${CLOCK})$`, 'i');
// 실리태번 화면 찌꺼기: 메시지 번호(#12) · 스와이프(1 / 3) · 토큰 수 · 기호만 있는 줄
const JUNK_LINE = /^(?:#\d+|\d+(?:\.\d+)?\s*(?:s|초)|\d+\s*\/\s*\d+|(?:tokens?|토큰)\s*[:：]?\s*\d+|[\p{S}\p{P}\s]+)$/iu;
const HR_LINE = /^(?:-{3,}|\*{3,}|_{3,}|─{3,}|―{3,}|={3,})$/;
/** 「이름: 글」 줄 — 이름은 24자 이하, 따옴표 · 주소 · 표기 글자로 시작하지 않아요 */
const NAME_LINE = /^([^\s"“「『*#>\-:：/\\][^:：\n]{0,23}?)\s*[:：]\s*(.*)$/u;
const nameOk = name => !TIME_LINE.test(name) && !/https?$|^\d+$|[\\/]/.test(name) && /[\p{L}\p{N}]/u.test(name);
/** 혼자 선 짧은 줄(실리태번 화면 복사의 이름 줄 후보) — 20자 이하, 문장 끝 기호 없음, 글자 있음 */
const standalone = line => line.length <= 20 && /[\p{L}\p{N}]/u.test(line) && !/[.!?。…」"』)\]:：,]$/u.test(line) && !/[:：]/.test(line) && !TIME_LINE.test(line) && !JUNK_LINE.test(line) && !HR_LINE.test(line) && line.split(/\s+/).length <= 3;

/** 대사 줄 머리(따옴표 · 낫표) */
const QUOTE_START = /^["“”「『'‘]/;

const EN_MONTH = Object.fromEntries('jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').map((m, i) => [m, i]));
/** 시간 줄 → ms(날짜가 없으면 오늘) · 못 읽으면 null */
export function parseTime(line, now = new Date()) {
    const s = String(line ?? '').trim();
    if (!TIME_LINE.test(s)) return null;
    let y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
    const ko = s.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
    const en = s.match(new RegExp(`(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i')) || s.match(new RegExp(`(\\d{1,2})\\s+(${MONTHS})\\.?\\s+(\\d{4})`, 'i'));
    if (ko) { y = Number(ko[1]); mo = Number(ko[2]) - 1; d = Number(ko[3]); }
    else if (en) {
        const name = (/^\d/.test(en[1]) ? en[2] : en[1]).slice(0, 3).toLowerCase();
        mo = EN_MONTH[name] ?? mo; d = Number(/^\d/.test(en[1]) ? en[1] : en[2]); y = Number(en[3]);
    }
    let h = 0, mi = 0;
    const clock = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (clock) {
        h = Number(clock[1]); mi = Number(clock[2]);
        const pm = /오후|PM/i.test(s), am = /오전|AM/i.test(s);
        if (pm && h < 12) h += 12;
        if (am && h === 12) h = 0;
    }
    const when = new Date(y, mo, d, h, mi, clock?.[3] ? Number(clock[3]) : 0);
    return Number.isFinite(when.getTime()) ? when.getTime() : null;
}

// ── 글 안 표기 → 노드 ──
const INLINE = /\*\*([^*\n][\s\S]*?)\*\*|~~([^~\n][\s\S]*?)~~|`([^`\n]+)`|\*([^*\n]+?)\*|"([^"]*?)"|“([^”]*?)”|「([^」]*?)」|『([^』]*?)』/g;
/** 줄바꿈이 든 글 → 글 · br 노드 */
function textNodes(value) {
    const out = [];
    const parts = String(value).split('\n');
    parts.forEach((part, i) => { if (i) out.push({ t: 'br' }); if (part) out.push(text(part)); });
    return out;
}
/** 문단 글(줄은 \n) → 인라인 노드 목록 */
export function inlineNodes(value) {
    const out = [];
    let last = 0;
    const src = String(value ?? '');
    const re = new RegExp(INLINE.source, 'g');   // 안쪽 표기를 다시 읽을 때(재귀) 바깥 자리(lastIndex)가 엉키지 않게 호출마다 새로
    for (let m; (m = re.exec(src));) {
        out.push(...textNodes(src.slice(last, m.index)));
        last = m.index + m[0].length;
        if (m[1] !== undefined) out.push(run(inlineNodes(m[1]), { color: S.strong, 'font-weight': '700' }, 'strong'));
        else if (m[2] !== undefined) out.push(run(inlineNodes(m[2]), { 'text-decoration-line': 'line-through', 'text-decoration-color': S.muted }, 'del'));
        else if (m[3] !== undefined) out.push(run([text(m[3])], { 'font-family': "'D2Coding', 'Consolas', 'Courier New', monospace", 'font-size': '0.92em', 'background-color': S.raised, 'border-radius': '4px', 'padding-left': '4px', 'padding-right': '4px' }, 'code'));
        else if (m[4] !== undefined) out.push(run(inlineNodes(m[4]), { color: S.em, 'font-style': 'italic' }, 'em'));   // *행동 · 지문*
        else if (m[5] !== undefined) out.push(run([text('"'), ...inlineNodes(m[5]), text('"')], { color: S.dialogue }, 'dialogue'));
        else if (m[6] !== undefined) out.push(run([text('“'), ...inlineNodes(m[6]), text('”')], { color: S.dialogue }, 'dialogue'));
        else if (m[7] !== undefined) out.push(run([text('「'), ...inlineNodes(m[7]), text('」')], { color: S.dialogue }, 'dialogue'));
        else if (m[8] !== undefined) out.push(run([text('『'), ...inlineNodes(m[8]), text('』')], { color: S.em, 'font-style': 'italic' }, 'em'));   // 『속마음』
    }
    out.push(...textNodes(src.slice(last)));
    return out;
}

/** 본문 줄 묶음(한 메시지) → 블록 노드 목록 */
export function bodyNodes(lines) {
    const out = [];
    let para = [];
    const flush = () => {
        if (!para.length) return;
        const kind = para[0].kind;
        if (kind === 'quote') out.push(block([block(inlineNodes(para.map(l => l.text).join('\n')), { margin: '0' })], { margin: '0 0 8px', 'padding-left': '12px', 'border-left': `3px solid ${S.line}`, color: S.muted }, 'quote'));
        else if (kind === 'ul' || kind === 'ol') out.push(block(para.map(l => block(inlineNodes(l.text), { display: 'list-item', margin: '0 0 2px' }, 'li', 'li')), { margin: '0 0 8px', 'padding-left': '1.5em', 'list-style-type': kind === 'ol' ? 'decimal' : 'disc' }, kind, kind));
        else out.push(block(inlineNodes(para.map(l => l.text).join('\n')), { margin: '0 0 8px' }));
        para = [];
    };
    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim()) { flush(); continue; }
        if (HR_LINE.test(line.trim())) { flush(); out.push({ t: 'hr', style: { 'border-top': `1px solid ${S.line}`, margin: '10px 0' } }); continue; }
        const head = line.match(/^#{1,3}\s+(.+)$/);
        if (head) { flush(); out.push(block(inlineNodes(head[1]), { 'font-weight': '700', color: S.dialogue, margin: '6px 0 2px' }, 'h3')); continue; }
        const quote = line.match(/^>\s?(.*)$/);
        const bullet = line.match(/^[-*•]\s+(.+)$/);
        const number = line.match(/^\d{1,3}[.)]\s+(.+)$/);
        const kind = quote ? 'quote' : bullet ? 'ul' : number ? 'ol' : 'p';
        if (para.length && para[0].kind !== kind) flush();
        para.push({ kind, text: quote ? quote[1] : bullet ? bullet[1] : number ? number[1] : line });
    }
    flush();
    return out;
}

// ── 메시지 나누기 ──
/**
 * @param {string} source 붙여 넣은 글
 * @returns {{ mode: 'names'|'screen'|'alternate', names: string[], generic: boolean, turns: { who: number, time: number|null, nodes: object[] }[] }}
 *   names: 처음 나온 차례(generic 이면 기본 이름 깡통 · 나) · turns[].who: names 의 번호
 */
export function parseLog(source) {
    const lines = String(source ?? '').slice(0, MAX_TEXT).replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n').map(l => l.replace(/\s+$/, ''));
    const trimmed = lines.map(l => l.trim());
    const nonBlank = trimmed.filter(Boolean);
    if (!nonBlank.length) return { mode: 'alternate', names: [...DEFAULT_NAMES], generic: true, turns: [] };

    // ① 「이름:」 줄
    const labeled = [];
    const labelOf = (line) => {
        if (!line || TIME_LINE.test(line)) return null;   // 「오후 9:00」 같은 시간 줄은 이름이 아니에요
        const m = line.match(NAME_LINE);
        if (!m) return null;
        const name = m[1].trim();
        if (!nameOk(name) || (/\d$/.test(name) && /^\d{2}(?:\D|$)/.test(m[2]))) return null;   // 「… 9:00 …」 시각이 든 줄
        return { name, rest: m[2] };
    };
    trimmed.forEach((line, i) => { const m = labelOf(line); if (m) labeled.push({ i, ...m }); });
    const counts = new Map();
    for (const l of labeled) counts.set(l.name, (counts.get(l.name) ?? 0) + 1);
    let names = [...counts].filter(([, n]) => n >= 2).map(([name]) => name);
    if (!names.length && labeled.length >= 2 && counts.size <= 4) names = [...counts.keys()];
    if (!names.length && labeled.length === 1 && nonBlank.length <= 3) names = [labeled[0].name];
    if (names.length && names.length <= 12) return finish('names', splitByLabels(lines, trimmed, new Set(names), labelOf));

    // ② 실리태번 화면 복사(이름 한 줄 · 시간 한 줄 · 본문)
    const solo = new Map();
    trimmed.forEach((line, i) => { if (line && standalone(line) && (trimmed[i + 1] ?? '') !== '' ) solo.set(line, (solo.get(line) ?? 0) + 1); });
    let speakers = [...solo].filter(([, n]) => n >= 2).map(([name]) => name);
    if (speakers.length) {
        // 한 번만 나왔어도 바로 아래가 시간 줄이면 이름이에요
        trimmed.forEach((line, i) => { if (line && !speakers.includes(line) && standalone(line) && TIME_LINE.test(trimmed[i + 1] ?? '')) speakers.push(line); });
    }
    // 11-12 밤(사용자 「왜 이름으로 치환 안 되냐」): 이름만 있는 짧은 줄 + 바로 다음 줄이 따옴표 · 낫표로 시작하는 대사 → 한 번만 나와도 화자 이름(긴 문장 · 문장 끝 기호로 끝나는 줄은 standalone 이 걸러요)
    trimmed.forEach((line, i) => { if (line && !speakers.includes(line) && standalone(line) && !QUOTE_START.test(line) && QUOTE_START.test(trimmed[i + 1] ?? '')) speakers.push(line); });
    if (speakers.length && speakers.length <= 8) return finish('screen', splitByHeads(lines, trimmed, new Set(speakers)));

    // ③ 이름 없음: 빈 줄로 나누고 번갈아
    return finish('alternate', splitAlternate(lines, trimmed));
}

function finish(mode, { names, turns, generic = false }) {
    const out = turns.filter(t => t.nodes.length).slice(0, MAX_MESSAGES);
    return { mode, names, generic, turns: out };
}
/** 본문 줄에서 실리태번 찌꺼기(시간 · 번호 · 기호만)를 걷어요 · 시간 줄은 시각으로 */
function cleanBody(lines, turn) {
    const out = [];
    for (const line of lines) {
        const s = line.trim();
        if (s && TIME_LINE.test(s)) { if (turn.time === null) turn.time = parseTime(s); continue; }
        if (s && JUNK_LINE.test(s) && !HR_LINE.test(s)) continue;
        out.push(line);
    }
    return out;
}
/** 본문을 읽어(시간 줄은 시각으로) 노드로 — 시각은 본문을 읽은 뒤에 적혀요 */
const finishTurn = (t) => { const nodes = bodyNodes(cleanBody(t.lines, t)); return { who: t.who, time: t.time, nodes, ...(t.lead ? { lead: true } : {}) }; };
function nameIndex(names, name) { let i = names.indexOf(name); if (i < 0) { names.push(name); i = names.length - 1; } return i; }

function splitByLabels(lines, trimmed, known, labelOf) {
    const names = [], turns = [];
    let cur = null;
    const open = (name) => { cur = { who: nameIndex(names, name), time: null, lines: [] }; turns.push(cur); };
    trimmed.forEach((line, i) => {
        const m = labelOf(line);
        if (m && known.has(m.name)) { open(m.name); if (m.rest) cur.lines.push(m.rest); return; }
        if (!cur) { if (!line) return; open(''); }
        cur.lines.push(lines[i]);
    });
    if (names[0] === '' && names.length > 1) { /* 이름 없이 시작한 머리글은 첫 이름 쪽으로(lead — 누가 한 말은 아니에요) */ const first = turns.find(t => t.who === 0); if (first) { first.who = 1; first.lead = true; } names.shift(); for (const t of turns) if (t.who > 0) t.who--; }
    return { names: names.map(n => n || DEFAULT_NAMES[0]), turns: turns.map(finishTurn) };
}
function splitByHeads(lines, trimmed, known) {
    const names = [], turns = [];
    let cur = null;
    const open = (name) => { cur = { who: nameIndex(names, name), time: null, lines: [] }; turns.push(cur); };
    trimmed.forEach((line, i) => {
        if (line && known.has(line)) { open(line); return; }
        if (!cur) { if (!line) return; open(''); }
        cur.lines.push(lines[i]);
    });
    if (names[0] === '' && names.length > 1) { const first = turns.find(t => t.who === 0); if (first) { first.who = 1; first.lead = true; } names.shift(); for (const t of turns) if (t.who > 0) t.who--; }   // lead: 첫 이름 앞 머리글(누가 한 말이 아니에요 — 내 글 넣기는 지문으로 둬요)
    return { names: names.map(n => n || DEFAULT_NAMES[0]), turns: turns.map(finishTurn) };
}
function splitAlternate(lines, trimmed) {
    // 빈 줄 두 개 이상이 한 번이라도 있으면 그 자리가 메시지 경계 · 없으면 빈 줄 하나마다
    const joined = trimmed.map((l, i) => (l ? lines[i] : '')).join('\n').replace(/^\n+|\n+$/g, '');
    const chunks = /\n{3,}/.test(joined) ? joined.split(/\n{3,}/) : joined.split(/\n{2,}/);
    const turns = chunks.map((chunk, i) => { const t = { who: i % 2, time: null }; return { ...t, nodes: bodyNodes(cleanBody(chunk.split('\n'), t)) }; });
    return { names: [...DEFAULT_NAMES], generic: true, turns };
}

// ── model(테마 로그 복사 캡처 결과와 같은 모양) ──
/**
 * @param {ReturnType<typeof parseLog>} parsed
 * @param {{ swap?: boolean, names?: string[] }} [options] swap: 깡통 · 나 뒤집기 · names: 보여 줄 이름(번호 차례 · 비우면 parsed.names)
 */
export function buildModel(parsed, { swap = false, names = null } = {}) {
    const list = (parsed.names.length ? parsed.names : [...DEFAULT_NAMES]).map((n, i) => String(names?.[i] ?? '').trim() || n);
    const userAt = list.length >= 2 ? (swap ? 0 : 1) : (swap ? 0 : -1);
    const isUser = who => who === userAt;
    const nameStyle = user => ({ color: user ? NAME_INK.user : NAME_INK.char, 'font-family': FONT['font-family'], 'font-size': '14px', 'font-weight': '700', 'letter-spacing': '-0.025em' });
    const messages = parsed.turns.map((turn, i) => {
        const user = isUser(turn.who);
        return { index: i, user, name: list[turn.who] ?? list[0], nameStyle: nameStyle(user), time: turn.time, font: { ...FONT }, bubble: null, nodes: structuredClone(turn.nodes) };
    });
    const chars = list.filter((_, i) => !isUser(i));
    return {
        chatName: chars[0] ?? '', charName: chars[0] ?? '', chatTitle: '', userName: userAt >= 0 ? list[userAt] : '',
        base: { bg: S.bg, ...FONT }, messages, images: [],
        roles: { names: list, userAt, chars, user: userAt >= 0 ? list[userAt] : '' },   // 시식 창 칩이 읽어요(테마 model 에는 없는 칸 · 그리기는 안 봐요)
    };
}
