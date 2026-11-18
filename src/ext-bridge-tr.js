// 미트볼 상태창 「화면만 번역」 빈틈 메우기 (1.4.x) — 기능 다리(src/ext-bridge.js)가 그 확장이 있을 때 같이 켜요.
//   그 확장은 영어로 저장하고 화면에서만 번역 사전(채팅 메타 tr)으로 바꿔 보여 줘요(ssGenLang = enview). 그런데 두 군데가 영어로 남았어요(11-14 · 2.7.17 대조).
//   ① 답 아래 변동 칩: 그 확장 화면 번역은 글자 노드를 그 자리에서 바꿔, 짧은 낱말 짝이 먼저 있으면 반쯤 바뀐 글(「North 급행 (퀵) Lift」)이 남고 긴 이름 짝이 생겨도 다시 안 맞았어요.
//      또 본문에 상태 블록이 남은 옛 답은 칩 자리가 정규식이 넣은 <div class="ss-slot"> 인데, 실리태번이 메시지 HTML 의 클래스에 custom- 을 붙여 .custom-ss-slot 이 돼요.
//      그 확장의 화면 번역 감시는 「.ss-slot 아래에서 바뀐 것」만 봐서, 칩을 다시 그릴 때(채팅 열기 · 새 답)마다 사전에 있는 이름도 영어로 남았어요.
//      → 칩을 새로 그리면 다음 프레임(그리기 전)에 원래 칩 글을 그 확장의 trString(사전)으로 다시 적어요 — 메시지 꾸미기(src/message-decor.js)에 얹어 감시자를 늘리지 않아요. AI 0회 · 사전 그대로.
//   ② 「상태창 전체 번역」 · 「남은 글 번역하기」는 지금 상태창 칸(세계 핵심 + 켜진 칸)의 글만 모아요.
//      칩 글(지나간 장소 · 쓴 아이템 · 의뢰 · 소식 제목 같은 것) · 상단 띠의 최근 기록 · 알림함 글은 상태에 없으면 빠져서 영어로 남았어요.
//      → 그 확장이 번역을 마친 뒤(사전이 늘었거나, 남은 글이 없다고 끝났을 때) 화면에 보일 칩 · 알림 글에서 아직 영어인 부분만 모아
//        그 확장의 trJSON(번역 담당 · 번역 모델 · 지침 · 연결 프로필 · 기능 다리 모델 고르기 그대로)으로 60개씩 옮기고, 그 확장의 addPairs 로 같은 사전에 넣어요.
//        사전이 곧 캐시라 같은 글은 다시 보내지 않아요. 번역기가 영어 그대로 돌려준 글은 이번 접속에 다시 보내지 않아요.
//      자동: 그 확장의 「새로 쓴 영어 글 자동 번역」이 지금 번역 담당에 켜져 있을 때만(실리 기본 번역 · 「항상」) 답이 끝나고 잠시 뒤 같은 일을 해요 — 꺼 두면 누를 때만.
//   그 확장의 파일 · 함수는 고치지 않아요 — 그 확장이 내보낸 함수를 같은 주소로 불러 같은 모듈을 써요(그 확장이 쓰는 길 그대로). 판이 달라 함수가 없으면 아무것도 안 해요.
//   새 감시자 없음: 메시지 꾸미기 하나(칩 자리 기록만 · 화면만 번역일 때만) · 번역 단추를 누른 뒤에만 도는 짧은 확인(1.5초 · 최대 15분).
//   시험: tools/tests/ext-bridge-tr.mjs(빈틈 고르기 · 칩 감시 · 누른 뒤 메우기)

import { addMessageDecorator } from './message-decor.js';
import { ruleValue } from './addons/translator/card-values.js';
import { mbOff } from './mb-switch.js';   // 1.7.3 미트볼 맞춤 스위치 — 칩 번역 다시 적기(trchip) · 알림 번역(trtoast) · 사전에 고정 낱말(trtidy) · 남은 영어 메우기(trfill)   // 1.5.1 고정 낱말(요일 · 달 · 계절 · 시간대 · 날씨 · 날짜 꼴) — 테마 사전 한 곳

const FOLDER = /meatball|statussim|미트볼/i;
const TRIGGER = '[data-act="trsheet"], [data-s-act="trsheet"], .ss-trf-go';
const SLOT = 'custom-ss-slot';
const UNVISITED = Symbol.for('blue-lemonade.mb-unvisited.v1');   // 지도 「아직 안 가 본 곳」 글 등록부(src/mb-map-floors.js 가 걸어요)
const SLOTS = '.ss-slot, .custom-ss-slot';
const BATCH = 60, BATCH_CHARS = 8000;
const WATCH_MS = 1500, WATCH_MAX = 15 * 60 * 1000, AUTO_MS = 8000, TIDY_MS = 3000, TIDY_REPLY_MS = 1200, TRANSLATED_MS = 1500;
const isObj = value => !!value && typeof value === 'object';

/**
 * 화면에 보일 글(그 확장 사전으로 바꾼 뒤)에서 아직 영어인 한 덩이 — 첫 라틴 글자부터 마지막 라틴 글자까지(붙은 숫자 · 괄호 · 따옴표까지).
 * 앞의 그림 글자 · 한국어 머리(「해제:」 · 「📍」) · 뒤의 +2 · ×3 · … 는 빼요. 옮길 것이 없으면 ''.
 */
export function englishPart(text) {
    const s = String(text ?? '');
    let a = s.search(/[A-Za-z]/);
    if (a < 0) return '';
    let b = s.length - 1;
    while (b >= 0 && !/[A-Za-z]/.test(s[b])) b--;
    while (a > 0 && /[0-9(["'#&]/.test(s[a - 1])) a--;
    while (b + 1 < s.length && /[)\]"'.!?0-9]/.test(s[b + 1])) b++;
    return s.slice(a, b + 1).trim();
}
/** 옮기지 않을 덩이: 너무 짧음 · 대문자 줄임말(HP · SNS · NPC) · SNS 아이디 · 주소 · 너무 김 */
export function skipPart(part) {
    const p = String(part ?? '').trim();
    if (p.replace(/[^A-Za-z]/g, '').length < 2) return true;
    if (/^[A-Z0-9]{1,4}$/.test(p)) return true;
    if (/^@?[A-Za-z0-9_.]{2,30}$/.test(p) && (p.startsWith('@') || /[_.]/.test(p))) return true;
    if (/^[a-z]+:\/\//i.test(p) || p.length > 600) return true;
    return false;
}
/**
 * 화면에 보일 글 목록 → { list: 보낼 덩이(겹침 없음), owners: 덩이 → 원래 글들 }
 * shown(text): 그 확장 사전으로 바꾼 화면 글(trString) · has(part): 사전에 이미 있나 · tried: 이번 접속에 못 바꾼 덩이
 */
export function collectGaps(texts, { shown = t => t, has = () => false, tried = new Set(), full = () => null } = {}) {
    const owners = new Map();
    for (const raw of texts) {
        let text = String(raw ?? '').trim();
        // 1.6.8: 그 확장이 70자로 자른 알림 글(「화면 밖 — 이름」 · 「…」로 끝남) — 상태에 원문 통째가 있으면 그 원문을 보내요(잘린 조각을 번역하면 반쪽 짝이 남았어요)
        if (text.endsWith('…') && text.length >= 12) { const whole = full(text.slice(0, -1).trimEnd()); if (whole) text = whole; }
        if (!text || !/[A-Za-z]/.test(text)) continue;
        if (!/[A-Za-z]/.test(String(shown(text) ?? text))) continue;   // 그 확장 사전으로 이미 다 바뀌어 보여요
        // 덩이는 원래 글에서 — 화면 글에서 자르면 이름만 바뀐 「카이's Blue …」처럼 반쪽이 돼요. 아는 이름이 든 덩이도 통째로 보내요(번역 지시에 그 이름이 실려요)
        // 1.5.2: 「💞 이름 = 관계 이름」 · 「🗺️ 새 장소: 장소」처럼 나눔표가 있으면 덩이를 나눠요 — 이름은 이미 사전에 있고, 뒤 글만 보내요(상태창 본체와 같은 열쇠)
        for (const piece of text.split(/\s+=\s+|:\s+|↔/)) {
            const part = englishPart(piece);
            if (!part || skipPart(part) || has(part) || tried.has(part) || fixedValue(part, chipSlot(text))) continue;   // 1.5.3: 시간대 · 날씨 칩만 사전으로   // 1.5.1 고정 낱말은 사전으로(번역 요청에 안 실어요)
            (owners.get(part) ?? owners.set(part, []).get(part)).push(text);
        }
    }
    return { list: [...owners.keys()], owners };
}
/**
 * 1.6.6 번역 모델이 원문의 나눔표 「 / 」를 대사 괄호로 싼 번역: 달력 「A / B」(같은 날 기념일 둘) → 「가「 / 」나」 · 「가 「 」 나」.
 *   번역 사전(채팅 메타 tr)에 그대로 들어가 달력 「이달 일정」 · 「다가오는 일정」에 뒤집힌 괄호로 보였어요(11-17 사용자 화면 · 같은 채팅의 세 짝이 다 이 꼴).
 *   테마의 대사 꾸밈 · 화면 번역 탓이 아니라 저장된 번역 값이에요. 원문에 꺾쇠가 없고 「 / 」 나눔표가 있을 때,
 *   속이 비었거나 「/」 하나뿐인 괄호 짝만 「 / 」로 되돌려요 — 낱말을 감싼 「가」 · 원문에 있던 괄호는 그대로. 고칠 것이 없으면 null.
 */
const SEP_QUOTE = /\s*「\s*\/?\s*」\s*/g;
export function sepQuoteValue(en, ko) {
    const src = String(en ?? ''), value = String(ko ?? '');
    if (/[「」『』]/.test(src) || !/\s\/\s/.test(src) || !value.includes('「')) return null;
    const fixed = value.replace(SEP_QUOTE, ' / ');
    if (fixed === value || /[「」]/.test(fixed)) return null;
    const seps = text => (text.match(/\s\/\s/g) ?? []).length;
    return seps(fixed) <= seps(src) ? fixed.trim() : null;
}
/** 사전에서 위 꼴로 들어간 짝 → 바로잡은 짝들(📌 고정한 짝은 빼요) */
export function sepQuotePairs(dict, lock = {}) {
    const out = [];
    for (const [en, ko] of Object.entries(isObj(dict) ? dict : {})) {
        if (typeof ko !== 'string' || lock?.[en]) continue;
        const fixed = sepQuoteValue(en, ko);
        if (fixed) out.push([en, fixed]);
    }
    return out;
}
/** 번역 결과 → 사전 짝. 덩이 짝 하나 + (덩이가 40자를 넘으면 그 확장이 글 속에서 안 바꾸므로) 원래 글 통째 짝 */
export function pairsFor(part, ko, owners) {
    const k = (sepQuoteValue(part, ko) ?? String(ko ?? '')).trim();
    if (!k || k === part || !/[^\x00-\x7F]/.test(k) || halfValue(part, k)) return [];   // 1.5.1: 반쯤 번역은 짝으로 넣지 않아요(다음에 다시)
    const out = [[part, k]];
    if (part.length > 40) for (const text of owners.get(part) ?? []) if (text !== part) out.push([text, text.replace(part, () => k)]);
    return out;
}
/** 화면에 보일 칩 · 기록 · 알림 글: 답마다 칩(snaps) + 최근 기록(state.recent) + 알림함(meta.notes 제목 · 글 · 힌트) */
export function visibleTexts(current, meta) {
    const out = [];
    const snaps = current?.snaps;
    if (snaps && typeof snaps.values === 'function') for (const snap of snaps.values()) for (const label of snap?.labels ?? []) if (typeof label === 'string') out.push(label);
    for (const label of current?.state?.recent ?? []) if (typeof label === 'string') out.push(label);
    // 1.6.8: 플레이 기록 「지난 하루들」(state.days · 최근 30일 · 하루 30줄) — 지난 답의 칩 글이 그대로 남아요(「날씨: Sunny」 · 「상태: Tired」). 그날 칩이 지금 상태에 없으면 번역 요청에도 안 실렸어요
    for (const day of Array.isArray(current?.state?.days) ? current.state.days : []) for (const label of Array.isArray(day?.labels) ? day.labels : []) if (typeof label === 'string') out.push(label);
    for (const note of Array.isArray(meta?.notes) ? meta.notes : []) if (isObj(note)) for (const key of ['title', 'text', 'hint']) if (typeof note[key] === 'string') out.push(note[key]);
    // 1.5.1: 추억 앨범 — 속마음 글 · 장소 · 내가 단 한 줄(장면 글은 본편 답을 옮긴 것이라 본편처럼 그대로 둬요)
    for (const item of Array.isArray(meta?.album) ? meta.album : []) if (isObj(item)) for (const key of ['here', 'note', ...(item.kind === 'peek' ? ['text'] : [])]) if (typeof item[key] === 'string') out.push(item[key]);
    return out;
}

// ───── 1.5.1: 「번역을 눌러도 영어로 남는 글」 빈틈 셋 더 (11-15 · 2.7.21 대조 · 사용자 실제 채팅의 칸 이름으로 조사) ─────
//   ③ 그 확장은 몇몇 칸 이름(genre 등)을 늘 코드로 봐서 모으지 않아요 — 홈 카드 맨 위 장르 한 줄이 영어로 남았어요.
//   ④ 한국어가 섞여 저장된 칸을 「영어 저장으로 바꾸기」할 때, 섞인 원래 글(이름만 한국어 · 나머지 영어)이 그대로 번역 짝이 됐어요.
//      사전에는 있으니 「남은 글」로 안 세고, 화면 번역이 그 영어 위에 낱말만 더 바꿔 「레아 is a … 직원 caught up …」 같은 반쯤 번역이 남았어요.
//   ⑤ 화면이 여러 칸을 한 줄로 이어 그린 곳(사람 › 사는 곳 · 일과 줄)은 줄 전체가 사전에 없어서 낱말 바꾸기로만 바뀌어요.
//      일과 글은 통째로 번역돼 있어도 낱말 하나(「Day」)가 사전에 없으면 「아침:… , Day:… , 밤:…」으로 남았어요.
//   → ③ 지금 상태 칸 전부를 같은 기준(화면 글에 영어 낱말이 남았나)으로 다시 훑어 모으고, ④ 반쯤 번역 짝은 다시 번역해 덮고,
//     ⑤ 이미 번역된 이어진 글(「A:B, C:D」)을 같은 꼴의 번역과 나란히 잘라 조각 짝을 AI 없이 넣고, 시간대 · 요일 · 달 · 계절 같은 고정 낱말 표로 빈 조각을 채워요.
//   데이터(AI 가 다시 읽는 칸)는 그대로예요 — 번역은 화면 사전(채팅 메타 tr)에만 들어가요(그 확장 방식 그대로).

/** 코드 · 주소 · 그림처럼 화면 글이 아닌 칸 — 모으지 않아요 */
const NOT_TEXT_KEYS = new Set(['id', 'url', 'link', 'src', 'img', 'avatar', 'handle', 'color', 'icon', 'key', 'mesid', 'chatId', 'seed', 'currencyCode', 'unit', 'cls', 'sort', 'every', 'repeat', 'show', 'pick']);
/** 코드일 때가 많은 칸 — 한 낱말이면 코드로 봐요(그 확장의 화면은 이 값을 한국어 이름표로 바꿔 그려요) */
const SOFT_TEXT_KEYS = new Set(['kind', 'role', 'status', 'mode', 'type', 'by', 'from', 'contact', 'play', 'judge', 'system', 'sys']);
const ruleMemo = new Map();
/** 요일 칸(달력 week)은 날짜 줄 「4/1(월)」 꼴에 맞춰 한 글자로 */
const shortWeek = ko => (/^[월화수목금토일]요일$/.test(ko) ? ko[0] : ko);
/**
 * 1.5.3: 고정 낱말 사전을 거는 칸 — 그 칸의 「종류」로만 판단해요(낱말만 보고 바꾸지 않아요).
 *   달력 요일(week) · 시간대(times · time) · 달(month) · 날씨(weather) · 계절(season) · 일과의 시간대 이름표(slot) · 시간대 · 날씨 칩(chip-time · chip-weather).
 *   이름 칸 · 사람 이름 · 자유 글(관계 이름 · 장소 · 메모 · 할 일 …)에는 절대 안 걸어요 — 1.5.2 는 칸 종류를 안 보고 값만 봐서
 *   이름이 April · Summer 인 사람이 「4월 · 여름」으로 사전에 들어갔어요(검토 2).
 */
export const FIXED_SLOT_KEYS = new Set(['week', 'times', 'time', 'month', 'weather', 'season', 'slot', 'chip-time', 'chip-weather']);
const SLOT_HINT = { week: 'day', times: 'time', time: 'time', slot: 'time', 'chip-time': 'time', month: 'date', weather: 'weather', 'chip-weather': 'weather', season: 'season' };
/** 고정 낱말 사전(테마 상태창 카드 값 사전 card-values 하나를 같이 써요): 정해진 칸의 값 전체가 그 낱말 · 낱말 묶음 · 날짜 꼴일 때만 — 문장 · 이름은 아니에요 */
export function fixedValue(text, key = '') {
    const value = String(text ?? '').trim();
    if (!value || !/[A-Za-z]/.test(value) || !FIXED_SLOT_KEYS.has(key)) return null;
    if (key === 'month' && /^(?:may|mar)\.?$/i.test(value)) return /^may/i.test(value) ? '5월' : '3월';   // 달력 달 칸에서만(다른 곳의 May 는 이름일 수 있어요)
    const memo = `${SLOT_HINT[key]}\u0000${value}`;
    let ko = ruleMemo.get(memo);
    if (ko === undefined) {
        try { ko = ruleValue(value, SLOT_HINT[key]) || null; } catch { ko = null; }
        if (ko && /[A-Za-z]{2,}/.test(ko.replace(ACRONYM, ' '))) ko = null;
        if (ruleMemo.size > 2000) ruleMemo.clear();
        ruleMemo.set(memo, ko);   // 같은 값은 다시 안 읽어요(채팅 열기 · 답 끝마다 같은 칸)
    }
    if (!ko) return null;
    return key === 'week' ? shortWeek(ko) : ko;
}
/** 칩 글의 종류: 「🕐 …」 = 시간대 · 「날씨: …」 = 날씨 — 그 밖의 칩(이름 · 장소 · 관계 · 물건 …)은 고정 낱말 사전을 안 걸어요 */
export const chipSlot = text => (/^\s*🕐/u.test(String(text ?? '')) ? 'chip-time' : /^\s*날씨\s*:/.test(String(text ?? '')) ? 'chip-weather' : '');
/**
 * 사람 이름(그 채팅의 인물 · 페르소나 · 캐릭터) — 이 글은 고정 낱말 짝을 만들지 않고 숨기지도 않아요(이름이 April 이면 April 은 번역 대상이 아니에요).
 * items: stateTexts 결과 · extra: 페르소나 · 캐릭터 이름 같은 바깥 이름
 */
export function nameSet(items, state, extra = []) {
    const out = new Set();
    const add = v => { const t = String(v ?? '').trim(); if (t && /[A-Za-z]/.test(t) && t.length <= 40) out.add(t); };
    for (const { text, key } of items) if (key === 'name' || key === 'who' || key === 'a' || key === 'b' || key === 'hero' || key === 'cast') add(text);
    const play = state?.data?.play ?? state?.play;
    for (const v of [play?.hero, ...(Array.isArray(play?.cast) ? play.cast : [])]) add(v);
    for (const v of extra) add(v);
    return out;
}
const PIECE_SEP = /(\s*[,;:/|·]\s*|\s+(?:→|->|—|–)\s+)/;
const ACRONYM = /\b(?:[A-Z]\.){2,}[A-Z]?\.?|\b[A-Z]{1,5}\b|\bd\d+\b|\d+\s?[a-z]{1,3}\b/g;
const bare = text => String(text ?? '').replace(ACRONYM, ' ').replace(/\s+/g, ' ');
/** 영어 낱말(두 글자 이상) 수 — 대문자 줄임말 · S.T.A.R 꼴 · d20 · 185cm 는 빼요 */
export const latinWords = text => (bare(text).match(/[A-Za-z][A-Za-z'’-]+/g) ?? []).length;
/** 화면에 보일 글에 아직 영어가 남았나: 낱말 둘 이상, 또는 한 낱말이라도 코드꼴(소문자 · 밑줄 · 숫자)이 아니면 */
export function stillEnglish(shown, { soft = false } = {}) {
    const s = String(shown ?? '').trim();
    const n = latinWords(s);
    if (n >= 2) return true;
    if (n === 0 || soft) return false;
    return !/^[a-z0-9_\-.]+$/.test(s);
}
/** 지금 상태의 화면 글 칸 전부(세계 핵심 + 켜진 칸) → [{ text, key }] */
export function stateTexts(state, isOn = () => true) {
    const out = [];
    const walk = (value, key) => {
        if (typeof value === 'string') { if (/[A-Za-z]/.test(value) && !NOT_TEXT_KEYS.has(key)) out.push({ text: value, key }); return; }
        if (Array.isArray(value)) { for (const v of value) walk(v, key); return; }
        if (isObj(value)) for (const [k, v] of Object.entries(value)) walk(v, key === 'months' && k === 'name' ? 'month' : k);   // 달력 달 이름은 이름 칸이 아니에요
    };
    if (!isObj(state)) return out;
    walk(state.core, '');
    for (const [id, data] of Object.entries(isObj(state.data) ? state.data : {})) { let on = true; try { on = isOn(id) !== false; } catch { on = true; } if (on) walk(data, ''); }
    return out;
}
/**
 * 반쯤 번역된 짝: 번역에 원문의 영어 낱말 셋 이상이 그대로 이어서 남은 것(대문자로 시작하는 낱말만 이어진 고유 이름은 빼요).
 * 「레아 is a archive staff member caught up …」 → 반쯤. 「중앙 기록국(Central Records Bureau)」 → 아님.
 */
export function halfValue(en, ko) {
    const v = bare(ko), src = bare(en).toLowerCase();
    for (const run of v.match(/[A-Za-z][A-Za-z'’-]*(?:[\s,]+[A-Za-z][A-Za-z'’-]*){2,}/g) ?? []) {
        const words = run.split(/[\s,]+/).filter(Boolean);
        if (words.every(w => /^[A-Z]/.test(w))) continue;
        if (src.includes(run.toLowerCase())) return true;
    }
    return false;
}
/**
 * 이어진 글의 조각 짝(AI 0회): 사전의 「A:B, C:D」 ↔ 「가:나, 다:라」처럼 나눔표가 같은 차례로 같으면 조각끼리 짝지어요.
 * only: 이 글들(지금 상태 칸)에서 나온 짝만 · 조각이 여러 번역으로 갈리면 많이 나온 쪽 · 이미 사전에 있는 조각은 건드리지 않아요.
 */
export function piecePairs(dict, only = null) {
    const votes = new Map();
    for (const [en, ko] of Object.entries(isObj(dict) ? dict : {})) {
        if (only && !only.has(en)) continue;
        if (typeof ko !== 'string' || en.length > 400) continue;
        const a = en.split(PIECE_SEP), b = ko.split(PIECE_SEP);
        if (a.length < 3 || a.length !== b.length) continue;
        // 「이름표:값」 꼴(일과 · 시간표)만 — 쉼표만 이은 글은 번역이 차례를 바꿀 수 있어 짝이 어긋나요
        if (!a.some((s, i) => i % 2 && /[:→]|->/.test(s))) continue;
        let same = true;
        for (let i = 1; i < a.length; i += 2) if (a[i].trim() !== b[i].trim()) { same = false; break; }
        if (!same) continue;
        for (let i = 0; i < a.length; i += 2) {
            const pe = a[i].trim(), pk = b[i].trim();
            if (pe.length < 3 || pe.length > 40 || pe.split(/\s+/).length > 4 || !/[A-Za-z]{2,}/.test(pe)|| !/[가-힣]/.test(pk) || latinWords(pk) >= 2 || Object.hasOwn(dict, pe)) continue;
            const m = votes.get(pe) ?? votes.set(pe, new Map()).get(pe);
            m.set(pk, (m.get(pk) ?? 0) + 1);
        }
    }
    return [...votes].map(([pe, m]) => [pe, [...m].sort((x, y) => y[1] - x[1])[0][0]]);
}
/**
 * 고정 낱말 짝(AI 0회): 칸 값 전체가 사전 낱말 · 날짜 꼴이면 그 값, 「이름표:값」 꼴이면 조각마다 — 사전에 없는 것만.
 * items: [{ text, key }] 또는 글 · 같은 글이 여러 칸에 있으면 요일 칸(week) 꼴이 이겨요.
 */
export function fixedPairs(items, dict, names = new Set()) {
    const out = new Map();
    const add = (en, ko, key) => { if (!ko || names.has(en) || Object.hasOwn(dict ?? {}, en)) return; if (!out.has(en) || key === 'week') out.set(en, ko); };
    for (const item of items) {
        const text = typeof item === 'string' ? item : item?.text, key = typeof item === 'string' ? '' : item?.key ?? '';
        const value = String(text ?? '').trim();
        if (!value) continue;
        const whole = fixedValue(value, key);   // 1.5.3: 정해진 칸(요일 · 시간대 · 달 · 날씨 · 계절)의 값 전체만
        if (whole) { add(value, whole, key); continue; }
        // 1.6.8: 그림 글자가 앞에 붙은 날씨 · 시간대(그 확장 자동 날씨가 영어 저장에서 고르는 「🌧 Rain」 꼴) — 낱말 짝과 붙은 꼴 짝을 둘 다
        const part = FIXED_SLOT_KEYS.has(key) && /^[^A-Za-z0-9]/.test(value) ? englishPart(value) : '';
        const ko = part && part !== value ? fixedValue(part, key) : null;
        if (ko) { add(part, ko, key); add(value, value.replace(part, () => ko), key); continue; }
        if (key !== 'sched') continue;   // 「이름표:값」 조각은 일과 칸에서만(이름표 = 시간대)
        const parts = value.split(PIECE_SEP);
        if (parts.length < 3 || !parts.some((s, i) => i % 2 && /[:→]|->/.test(s))) continue;
        for (let i = 0; i < parts.length; i += 2) { if (!/[:→]|->/.test(parts[i + 1] ?? '')) continue; const p = parts[i].trim(); const ko = p.split(/\s+/).length <= 3 ? fixedValue(p, 'slot') : null; if (ko) add(p, ko, ''); }
    }
    return [...out];
}
/** 보낼 글을 묶음으로(개수 · 글자 수 상한) — 그 확장의 묶음 크기(60)를 따르고, 글이 길면 더 일찍 끊어요 */
export function batches(list, size = BATCH, chars = BATCH_CHARS) {
    const out = [];
    let cur = [], len = 0;
    for (const s of list) {
        if (cur.length && (cur.length >= size || len + s.length > chars)) { out.push(cur); cur = []; len = 0; }
        cur.push(s); len += s.length;
    }
    if (cur.length) out.push(cur);
    return out;
}

// ───── 1.5.2: 고정 낱말이 글 속 낱말까지 바꾸던 것(「Complicated 아침 After」) · 칩의 「말로's」 ─────
//   그 확장 화면 번역은 사전 열쇠(3~40자)를 글 속 낱말로도 바꿔요(이름을 문장 속에서도 바꾸려는 것). 그래서 사전에 「Morning → 아침」이 있으면
//   아직 번역 안 된 관계 이름 「Complicated Morning After」 · 「Monday Blues」 · 「Spring Festival」 · 「May I …」 안의 낱말만 바뀌었어요.
//   → 고정 낱말 열쇠를 「셀 수 없는 칸」(non-enumerable)으로 바꿔요: 그 확장의 통째 맞춤(hasOwn)은 그대로 되고, 낱말 바꾸기 목록(Object.entries)에서만 빠져요.
//     채팅 파일에는 적히지 않아요(JSON 이 안 씀) — 채팅을 열 때 · 답 끝 · 번역 누를 때 테마가 다시 넣어요(AI 0).
//   → 정해진 자리(날짜 줄 「4/5(Sat) Morning」 · 「(Morning)」 · 「2026년 April 6일」 · 일과 「Morning:Front Desk」)는 그 자리 꼴 그대로의 열쇠를 따로 넣어요 —
//     괄호 · 「년 」 · 「:」 가 붙어 있어 자유 글 속 낱말과는 맞지 않아요.
//   → 칩은 테마가 원래 칩 글로 다시 적으니(paint) 칩 끝 덩이가 통째 고정 낱말일 때만 바꾸고, 한국어로 바뀐 이름 뒤 「's」는 「의」로.

/** 값 전체가 고정 낱말인 사전 열쇠(달력 달 칸 꼴 「May」 · 「Mar」 포함) */
export const isFixedKey = key => !!(fixedValue(key, 'time') || fixedValue(key, 'week') || fixedValue(key, 'month') || fixedValue(key, 'weather') || fixedValue(key, 'season'));
/** 그 열쇠에 우리 고정 낱말 사전이 넣었을 값들(어느 칸 종류로든) — 이름을 잘못 바꾼 짝을 알아볼 때 */
const fixedValuesOf = key => new Set(['time', 'week', 'month', 'weather', 'season'].map(k => fixedValue(key, k)).filter(Boolean).flatMap(v => [v, shortWeek(v)]));
/**
 * 1.5.3 되살리기(채팅을 열 때 · 두 번 돌아도 같은 결과): 1.5.2 를 쓰며 생겼을 수 있는 망가진 짝을 안전하게 풀어요 — 바꾼 수를 돌려줘요.
 *   ① 잠금(📌)만 있고 사전에 값이 없는 고정 낱말 — 숨긴 칸에 고친 값이 저장되지 않은 것(검토 1). 잠금을 풀어 다시 넣고 · 번역되게 해요
 *      (사용자가 넣었던 값은 파일에 없어서 되살릴 수 없어요).
 *   ② 사람 이름인데 고정 낱말 사전 값(「April → 4월」 · 「Summer → 여름」)으로 들어간 짝 — 지워서 이름이 원래대로 보이게(검토 2).
 *      사용자가 📌 고정한 짝은 건드리지 않아요.
 *   ③ 잠금(📌)이 있는데 숨긴 칸인 고정 낱말 — 셀 수 있는 칸으로 되돌려 값까지 저장되게.
 */
export function repairDict(dict, lock, names) {
    const out = { unlocked: [], removed: [], shown: [] };
    if (!isObj(dict)) return out;
    for (const k of Object.keys(isObj(lock) ? lock : {})) {
        if (!lock[k]) continue;
        const desc = Object.getOwnPropertyDescriptor(dict, k);
        if (!desc) { if (isFixedKey(k)) { delete lock[k]; out.unlocked.push(k); } continue; }
        if (!desc.enumerable) { delete dict[k]; dict[k] = desc.value; out.shown.push(k); }
    }
    for (const k of names) {
        if (lock?.[k] || !Object.hasOwn(dict, k)) continue;
        if (fixedValuesOf(k).has(dict[k])) { delete dict[k]; out.removed.push(k); }
    }
    return out;
}
/**
 * 사전의 고정 낱말 열쇠를 낱말 바꾸기에서 빼요 — 새로 뺀 열쇠 수. keep: 빼지 않을 열쇠(📌 고정 · 사람 · 곳 이름으로 쓰인 글).
 * 이미 뺀 열쇠는 건드리지 않아요(값은 그대로).
 */
export function hideFixedKeys(dict, keep = new Set()) {
    let n = 0;
    for (const key of Object.keys(isObj(dict) ? dict : {})) {
        if (keep.has(key) || !isFixedKey(key)) continue;
        const value = dict[key];
        Object.defineProperty(dict, key, { value, enumerable: false, writable: true, configurable: true });
        n++;
    }
    return n;
}
/**
 * 정해진 자리 열쇠(AI 0): 상태 칸에서 요일(week) · 시간대(times · time) · 달(month) · 일과(sched)를 보고
 *   「(Sat)」→「(토)」 · 「(Sat) Morning」→「(토) 아침」(띠 · 머리 날짜 줄 dateShort + 시간대) · 「(Morning)」→「(아침)」 · 「년 April」→「년 4월」 · 「Morning:Front Desk」→「아침:Front Desk」.
 * ko(word, key): 그 낱말의 한국어(사전 값이 먼저) — 없으면 그 자리는 안 넣어요.
 */
export function slotPairs(items, ko) {
    const week = new Set(), times = new Set(), months = new Set(), out = new Map();
    for (const { text, key } of items) {
        const t = String(text ?? '').trim();
        if (!t || !/[A-Za-z]/.test(t)) continue;
        if (key === 'week') week.add(t); else if (key === 'times' || key === 'time') times.add(t); else if (key === 'month') months.add(t);
        else if (key === 'sched') for (const piece of t.split(/\s*,\s*/)) {
            const m = /^([A-Za-z][A-Za-z -]{1,18}?)\s*:\s*(.+)$/.exec(piece);
            const k = m && ko(m[1].trim(), 'slot');
            if (k && piece.length <= 40) out.set(piece, `${k}:${m[2]}`);
        }
    }
    for (const w of week) {
        const kw = ko(w, 'week'); if (!kw) continue;
        out.set(`(${w})`, `(${kw})`);
        for (const t of times) { const kt = ko(t, 'time'); if (kt) out.set(`(${w}) ${t}`, `(${kw}) ${kt}`); }
    }
    for (const t of times) { const kt = ko(t, 'time'); if (kt) out.set(`(${t})`, `(${kt})`); }
    for (const m of months) { const km = ko(m, 'month'); if (km) out.set(`년 ${m}`, `년 ${km}`); }
    return [...out];
}
/**
 * 칩 글(그 확장 사전으로 바꾼 뒤) 마무리: 끝 덩이가 통째 고정 낱말이면(「🕐 Morning」 · 「날씨: Light rain」) 그 한국어로,
 * 한국어로 바뀐 이름 뒤 「's」는 「의」로(「말로's Penthouse」→「말로의 Penthouse」). 글 속 낱말은 안 바꿔요.
 */
export function chipText(shown, dict = {}, label = shown) {
    let s = String(shown ?? '');
    const slot = chipSlot(label);   // 1.5.3: 시간대 · 날씨 칩만(「♥ April +8」의 April 은 사람 이름 — 안 바꿔요)
    if (slot) {
        const part = englishPart(s.replace(/^\s*(?:🕐|날씨\s*:)\s*/u, ''));
        const ko = part && (Object.hasOwn(dict, part) && isFixedKey(part) ? dict[part] : fixedValue(part, slot));
        if (ko) s = s.replace(part, () => ko);
    }
    return s.replace(/([가-힣])['’]s(?=\s|$)/g, '$1의');
}
/**
 * 1.6.8 시간대 · 날씨 칩 글 통째 짝(AI 0): 「날씨: Sunny」 → 「날씨: 맑음」 · 「🕐 Afternoon」 → 「🕐 오후」.
 *   칩은 테마가 다시 적지만(chipText), 같은 글이 칩 밖(플레이 기록 「지난 하루들」 줄)에 그대로 그려지면 그 확장 화면 번역만 거쳐요.
 *   낱말 열쇠(Sunny)는 글 속 낱말 바꾸기에서 뺀 고정 낱말이라(hideFixedKeys) 「날씨: Sunny」 안에서 안 바뀌었어요 — 머리(「날씨:」 · 🕐)가 붙은 통째 열쇠를 따로 넣어요.
 *   사전에 이미 있는 글 · 바꿀 것이 없는 글 · 다른 칩은 빼요.
 */
export function chipSlotPairs(texts, dict = {}) {
    const out = new Map();
    for (const raw of texts) {
        const text = String(raw ?? '').trim();
        if (!text || !chipSlot(text) || out.has(text) || Object.hasOwn(dict ?? {}, text) || !/[A-Za-z]/.test(text)) continue;
        const ko = chipText(text, dict ?? {});
        if (ko !== text && /[가-힣]/.test(ko.replace(/^\s*(?:🕐|날씨\s*:)\s*/u, ''))) out.set(text, ko);
    }
    return [...out];
}
/**
 * 1.5.8 칩 글 → 화면 글:「💞 이름 = 설명」 · 「🗺️ 새 장소: 장소」처럼 나눔표가 있으면 덩이마다, 없으면 칩 글 통째를 한 덩이로 —
 *   ① 덩이의 영어가 사전에 통째로 있으면(길이 상관없이) 그 번역 ② 통째 짝이 없는 문장(영어 낱말 셋 이상)은 조각으로 바꾸지 않고 원문 그대로
 *      (통째 번역이 오면 바뀌어요) ③ 그 밖(이름 · 짧은 이름 묶음)은 그 확장 화면 번역(trs) 그대로.
 *   그 확장 화면 번역은 40자 넘는 열쇠를 글 속에서 안 바꾸고 짧은 열쇠만 끼워 넣어서, 관계 칩이 「그녀를 목격함 April 만우절 장난 망신」처럼
 *   조각 짝(witnessed her · Fools prank humiliation)으로 이어 붙고 통째 번역(「그녀가 만우절 장난으로 망신당하는 모습을 목격함」)은 안 보였어요.
 */
export function chipShown(label, dict = {}, trs = t => t) {
    const raw = String(label ?? '');
    const parts = raw.split(/(\s+=\s+|:\s+|↔)/);
    const out = parts.map((piece, i) => {
        if (i % 2) return piece;
        const part = englishPart(piece);
        if (!part) return piece;
        if (Object.hasOwn(dict, part) && typeof dict[part] === 'string') return piece.replace(part, () => dict[part]);
        if (latinWords(part) >= 3) return piece;
        try { return trs(piece); } catch { return piece; }
    });
    return chipText(out.join(''), dict, raw);
}

/**
 * 1.6.8 굳힌 옛 답의 날 칩: 그 확장은 굳힌 답(다시 계산하지 않는 옛 답)에 굳힐 때 적어 둔 칩 글을 보여 주는데(2.7.23~),
 *   그 글이 없는 답(2.7.23 전에 굳힌 답 · 다른 스와이프)은 변화 줄을 「키 값」 그대로 그려요 — 「aff 이름 +4」 · 「trust 이름 +5」.
 *   실시간 칩은 「♥ 이름 +4」 · 「🤝 이름 +5」라서, 같은 답이 굳은 뒤에만 영어 키가 보였어요.
 *   그 확장 KEYMAP 가운데 날 칩으로 보이는 키(RAW_CHIP)의 다른 이름 → 키.
 */
const RAW_KEYS = {
    stat: 'stat', '수치': 'stat', '게이지': 'stat', gauge: 'stat', hp: 'stat', attr: 'attr', '능력치': 'attr', '능력': 'attr',
    cond: 'cond', '상태': 'cond', '상태이상': 'cond', buff: 'cond', '버프': 'cond', condition: 'cond',
    cash: 'cash', money: 'cash', '돈': 'cash', '재산': 'cash', '소지금': 'cash', gold: 'cash', item: 'item', items: 'item', '아이템': 'item', '소지품': 'item',
    loc: 'loc', '위치': 'loc', '장소': 'loc', location: 'loc',
    aff: 'aff', '호감': 'aff', '호감도': 'aff', '애정': 'aff', '애정도': 'aff', trust: 'trust', '신뢰': 'trust', '신뢰도': 'trust', '우정': 'trust', '우정도': 'trust',
    date: 'date', '날짜': 'date', day: 'date', '일': 'date', days: 'date', '날짜이동': 'date', time: 'time', '시간': 'time', '시간대': 'time', period: 'time', slot: 'time',
    weather: 'weather', '날씨': 'weather',
};
const MB_MODULE = 'statussim';
/** 변화 줄 [키, 값] 가운데 날 칩으로 보이는 것만(그 확장 bakedLabels 와 같은 고르기 · 앞 14개) */
export function rawChipKeys(ops) {
    return (Array.isArray(ops) ? ops : []).filter(op => Array.isArray(op) && RAW_KEYS[String(op[0]).trim().toLowerCase()]).slice(0, 14);
}
/** 날 칩 한 줄 → 그 확장 실시간 칩 꼴(ops.js 의 칩 글) */
export function rawChipLabel(k, v, { currency = '' } = {}) {
    const word = String(k).trim(), key = RAW_KEYS[word.toLowerCase()];
    const val = String(v).trim().replace(/(^|\s)-(?=\d)/g, '$1−');   // 실시간 칩의 빼기 글자(signed)와 같게
    const named = !/^[+\-−]?\d/.test(val);   // 「체력 -5」처럼 이름이 앞에 있음
    switch (key) {
        case 'aff': return `♥ ${val}`;
        case 'trust': return `🤝 ${val}`;
        case 'loc': return `📍 ${val}`;
        case 'time': return `🕐 ${val}`;
        case 'weather': return `날씨: ${val}`;
        case 'cond': return `상태: ${val}`;
        case 'date': return /^[+\-−]?\d+$/.test(val) ? `📅 ${/^[\-−]/.test(val) ? val : `+${val.replace(/^\+/, '')}`}일` : `📅 ${val}`;
        case 'cash': return `${String(currency || '').trim() || '💰'} ${val}`;
        case 'stat': case 'attr': return named ? val : `${/^hp$/i.test(word) ? 'HP' : word} ${val}`;
        case 'item': {
            const m = /^([+\-−]?)\s*(.+?)(?:\s+(\d+))?\s*\|?\s*$/.exec(val);
            if (!m) return `${word} ${val}`;
            const q = Number(m[3] || 1);
            return `${m[1] && m[1] !== '+' ? '−' : '+'}${m[2]}${q > 1 ? `×${q}` : ''}`;
        }
        default: return `${word} ${val}`;
    }
}
/** 굳힌 답의 칩 글 — 적어 둔 칩 글이 있으면 그것(🎲 빼고), 없으면 날 칩을 실시간 칩 꼴로 · 없으면 null */
export function bakedChips(m, opts = {}) {
    if (!m || m.is_user) return null;
    const ext = m.extra?.[MB_MODULE], sw = m.swipe_id ?? 0;
    const saved = ext?.chips?.[sw];
    if (Array.isArray(saved) && saved.length) return saved.map(String).filter(l => !l.startsWith('🎲')).slice(0, 14);
    const raw = rawChipKeys(ext?.bySwipe?.[sw]);
    return raw.length ? raw.map(([k, v]) => rawChipLabel(k, v, opts).slice(0, 60)) : null;
}

/**
 * 1.6.8 그 확장이 실리 기본 알림(toastr)으로 바로 띄우는 글: 「Leon와(과) 연인이 되었어요」 · 「🔕 Leon은(는) 지금 연락이 안 돼요」 ·
 *   「Bread 구매!」 · 알림 방식 「실리태번 기본 알림」의 모든 알림. 그 확장 화면 번역은 자기 화면(.ss-scope · #ss-toasts …)만 훑어서
 *   #toast-container 의 알림은 사전에 번역이 있어도 영어로 남았어요.
 *   → 제목이 그 확장 이름(TITLE)인 알림만, 태그 밖 글 조각마다 그 확장 trString(사전) 그대로 바꿔요. 태그 · 속성은 그대로 · 바뀐 것이 없으면 글 그대로.
 *   html: 글에 HTML 이 들어 있다고 보고 엔티티(&amp; …)를 풀었다 다시 싸요.
 */
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#039;': "'" };
const unEnt = s => s.replace(/&(?:amp|lt|gt|quot|#0?39);/g, m => ENT[m]);
const enEnt = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function trToastMessage(message, trs, { html = true } = {}) {
    if (typeof message !== 'string' || !/[A-Za-z]/.test(message) || typeof trs !== 'function') return message;
    const parts = html ? message.split(/(<[^>]*>)/) : [message];
    let changed = false;
    const out = parts.map((piece, i) => {
        if ((html && i % 2) || !/[A-Za-z]/.test(piece)) return piece;
        const plain = html ? unEnt(piece) : piece;
        let got;
        try { got = trs(plain); } catch { return piece; }
        if (typeof got !== 'string' || got === plain) return piece;
        changed = true;
        return html ? enEnt(got) : got;
    });
    return changed ? out.join('') : message;
}
/** toastr 네 가지 알림을 한 번 감싸요 — 제목이 title 인 알림만 · on() 일 때만 trs 로 */
export function wrapMbToasts(toastr, { title, trs, on = () => true } = {}) {
    if (!toastr || toastr.__blMbTr || !title) return false;
    for (const kind of ['info', 'success', 'warning', 'error']) {
        const original = toastr[kind];
        if (typeof original !== 'function') continue;
        toastr[kind] = function (message, t, options) {
            let m = message;
            try { if (t === title && on()) m = trToastMessage(message, trs, { html: options?.escapeHtml === false || toastr.options?.escapeHtml !== true }); } catch { m = message; }
            return original.call(this, m, t, options);
        };
    }
    Object.defineProperty(toastr, '__blMbTr', { value: true });
    return true;
}

/** 그 확장 폴더(실리태번이 붙인 모듈 script 주소) — 이름으로 먼저, 없으면 manifest 의 이름으로 */
async function findBase(doc) {
    const bases = [];
    for (const el of doc.querySelectorAll?.('script[type="module"][src*="/scripts/extensions/third-party/"]') ?? []) {
        const m = /^(.*\/scripts\/extensions\/third-party\/([^/?#]+)\/)/.exec(el.src || '');
        if (m && !bases.some(b => b.url === m[1])) bases.push({ url: m[1], name: decodeURIComponent(m[2]) });
    }
    const named = bases.find(b => FOLDER.test(b.name));
    if (named) return named.url;
    for (const b of bases.slice(0, 40)) {
        try { const manifest = new URL('manifest.json', b.url).href; const res = await fetch(manifest, { cache: 'force-cache' }); if (res.ok && FOLDER.test(String((await res.json())?.display_name ?? ''))) return b.url; } catch { /* 다음 폴더 */ }
    }
    return '';
}
/** 그 확장이 내보낸 함수(같은 주소 = 같은 모듈) — 하나라도 없으면 null */
async function loadTarget(doc) {
    const base = await findBase(doc);
    if (!base) return null;
    const [tr, core, prompts] = await Promise.all(['src/translate.js', 'src/core.js', 'src/prompts.js'].map(file => { const url = new URL(file, base).href; return import(url); }));
    const need = [tr.translateView, tr.trJSON, tr.addPairs, tr.pairsOf, tr.trString, tr.missingTr, core.getMeta, core.viewTr, core.settings];
    if (need.some(fn => typeof fn !== 'function') || !isObj(core.app)) return null;
    return { tr, core, busy: typeof prompts.mainBusy === 'function' ? prompts.mainBusy : () => false };
}

/** 1.5.3 되살리기 진단 기록 — { at, chat, unlocked, removed, shown } (최근 50) */
export const trRepairLog = [];
try { globalThis.__blMbTrRepair = trRepairLog; } catch { /* 기록만 못 걸어요 */ }
const stChatId = () => { try { return globalThis.SillyTavern?.getContext?.()?.getCurrentChatId?.() ?? null; } catch { return null; } };
const stChat = () => { try { return globalThis.SillyTavern?.getContext?.()?.chat ?? []; } catch { return []; } };
export function createTrFill(mb, { doc = globalThis.document, toast = globalThis.toastr, now = () => Date.now(), timers = globalThis, chatId = stChatId, faces = () => {}, chat = stChat } = {}) {
    const { tr, core } = mb;
    const tried = new Set();
    let filling = false, watch = null, autoTimer = 0;
    const view = () => { try { return !!core.viewTr(); } catch { return false; } };
    const dictSize = () => { try { const d = core.getMeta()?.tr; return isObj(d) ? Object.keys(d).length : 0; } catch { return 0; } };

    /**
     * ① 메시지들의 칩을 「원래 칩 글 → 그 확장 사전」으로 다시 적어요. 그 확장 화면 번역은 글자 노드를 그 자리에서 바꿔서,
     *    사전에 짧은 낱말(Express)이 먼저 있으면 「West 급행 Lift」처럼 반쯤 바뀐 뒤로는 긴 이름 짝이 생겨도 다시 맞지 않았어요.
     *    칩 차례는 그 메시지 칩 글(snaps · 🎲 뺀 앞 14개)과 같아요 — 수가 다르면 그 확장 화면 번역만 불러요. 메시지 꾸미기가 다음 프레임 · 그리기 전에 불러요.
     */
    function paint(list) {
        if (mbOff('trchip', doc)) return;   // 1.7.3 끄면 칩 글을 다시 적지 않아요(그 확장이 그린 그대로)
        const on = view();
        const snaps = core.app.current?.snaps;
        for (const mes of list) {
            const slots = mes?.querySelectorAll?.(SLOTS);
            if (!slots?.length) continue;
            const id = Number(mes.getAttribute('mesid'));
            const snap = snaps?.get?.(id);
            // 1.6.8 굳힌 옛 답(그 답의 snaps 가 없음): 그 확장이 그린 날 칩(「aff 이름 +4」)을 실시간 칩 꼴(「♥ 이름 +4」)로 — 한국어 저장에서도
            let baked = null;
            if (!snap) { try { baked = bakedChips(chat()?.[id], { currency: core.app.current?.state?.data?.wallet?.currency }); } catch { baked = null; } }
            // 한국어 저장이어도 시간대 · 날씨 칩(「🕐 Evening」 · 「날씨: Light rain」)은 고정 낱말 사전으로(AI 0 · chipText 는 그 두 칩만 바꿔요)
            const labels = baked ?? (snap?.labels ?? []).filter(l => typeof l === 'string' && !l.startsWith('🎲')).slice(0, 14);
            if (!on && !baked && !labels.some(l => chipSlot(l))) continue;
            for (const slot of slots) {
                const chips = slot.querySelectorAll('span.ss-mchip');
                if (!chips.length) continue;
                if (chips.length !== labels.length) { if (on) { try { tr.translateView(slot); } catch { /* 다음 그리기 때 */ } } continue; }
                const dict = (() => { try { const d = core.getMeta()?.tr; return isObj(d) ? d : {}; } catch { return {}; } })();
                chips.forEach((chip, k) => { let want; try { want = on ? chipShown(labels[k], dict, t => tr.trString(t)) : chipText(labels[k]); } catch { return; } if (typeof want === 'string' && chip.textContent !== want) chip.textContent = want; });
            }
        }
    }
    /** 메시지 꾸미기가 볼 기록: 칩 자리 안에 칩을 새로 그린 것만(본문 · 스트리밍 글은 안 봐요) */
    const slotRecord = record => { const c = record?.target?.classList; return !!c && (c.contains(SLOT) || c.contains('ss-slot')) && record.addedNodes?.length > 0; };

    const isOn = id => { try { return typeof core.modOn === 'function' ? core.modOn(id) : true; } catch { return true; } };
    const lockOf = () => { try { const l = core.getMeta()?.trLock; return isObj(l) ? l : {}; } catch { return {}; } };
    const repaint = () => {
        try { paint([...(doc.querySelectorAll?.('#chat .mes') ?? [])]); } catch { /* 다음 그리기 때 */ }
        try { core.app.rerenderPanels?.(true); } catch { /* 다음 그리기 때 */ }
        try { tr.translateView(); } catch { /* 다음 그리기 때 */ }
        try { faces(); } catch { /* 다음 그리기 때 */ }   // 1.5.2 얼굴 첫 글자도 새 사전의 이름으로(ext-compat.js paintFaces · 「이름 첫 글자」 설정일 때만 훑어요)
        // 상단 띠: 그 확장은 같은 글이면 다시 안 그려서(반쯤 바뀐 글자가 남아요) 한 번 새로 그려요 — 그 확장의 renderHud 그대로
        try { const hud = doc.getElementById?.('ss-hud'); if (hud && '_ssHtml' in hud) { hud._ssHtml = ''; core.app.renderHud?.(); } } catch { /* 다음 갱신 때 */ }
    };

    /** ⑤ AI 없이: 이어진 글의 조각 짝 + 고정 낱말 → 같은 사전(addPairs 한 번 = 채팅 메타 저장 한 번) */
    function tidy({ draw = true } = {}) {
        if (!view() || mbOff('trtidy', doc)) return 0;   // 1.7.3 끄면 사전(채팅 메타 tr)을 안 고쳐요
        const state = core.app.current?.state;
        if (!state) return 0;
        const meta = core.getMeta();
        const dict = isObj(meta?.tr) ? meta.tr : null;
        if (!dict) return 0;
        if (fixOpen) return 0;   // 1.5.3: 「번역 고치기」 창이 열린 동안은 숨기지 않아요(창이 닫히면 다시)
        const items = stateTexts(state, isOn);
        // 칩 · 기록 · 알림 · 앨범 글: 시간대 · 날씨 칩만 그 종류로(「🕐 …」 · 「날씨: …」) — 다른 칩(이름 · 장소 · 관계)은 고정 낱말 사전을 안 걸어요
        const shownTexts = visibleTexts(core.app.current, meta);
        for (const text of shownTexts) { const slot = chipSlot(text); const part = slot && englishPart(text.replace(/^\s*(?:🕐|날씨\s*:)\s*/u, '')); if (part) items.push({ text: part, key: slot }); }
        const texts = items.map(x => x.text.trim());
        const lock = isObj(meta?.trLock) ? meta.trLock : {};
        // 1.5.3: 사람 이름(인물 · 페르소나 · 캐릭터)은 고정 낱말 짝을 만들지도 · 숨기지도 않아요 · 📌 고정한 짝은 늘 사용자 것
        const names = nameSet(items, state, outerNames());
        // 되살리기(①②③) — 바뀐 게 있으면 진단 기록에 남기고 채팅 파일에 한 번 저장
        const fixed = repairDict(dict, lock, names);
        const keep = new Set([...Object.keys(lock).filter(k => lock[k]), ...names]);
        const repaired = fixed.unlocked.length + fixed.removed.length + fixed.shown.length;
        if (repaired) noteRepair(fixed);
        const base = new Map([...fixedPairs(items, dict, names), ...piecePairs(dict, new Set(texts))]);   // 같은 조각이면 이 채팅 번역(조각 짝)이 이겨요
        const koOf = (word, key) => { if (names.has(word)) return null; const v = Object.hasOwn(dict, word) && !keep.has(word) ? dict[word] : (base.get(word) ?? fixedValue(word, key)); return !v || /[A-Za-z]{2,}/.test(v) ? null : key === 'week' ? shortWeek(v) : v; };
        for (const [k, v] of slotPairs(items, koOf)) base.set(k, v);
        for (const [k, v] of chipSlotPairs(shownTexts, dict)) if (!names.has(k)) base.set(k, v);   // 1.6.8 「날씨: Sunny」 통째(플레이 기록 줄)
        const pairs = [...base].filter(([en]) => !keep.has(en) && !lock[en] && !Object.hasOwn(dict, en));
        // 1.6.6 나눔표를 괄호로 싼 번역 짝(sepQuoteValue)은 그 확장 addPairs 로 덮어요 — 사전 판이 올라 화면 번역이 다시 읽고 · 채팅 메타에 저장돼요
        pairs.push(...sepQuotePairs(dict, lock));
        const n = pairs.length ? (tr.addPairs(pairs) || 0) : 0;
        // 고정 낱말 열쇠를 낱말 바꾸기에서 빼고, 그 확장 화면 번역이 목록을 새로 만들게 해요(사전 판 올리기)
        const hidden = hideFixedKeys(dict, keep);
        if ((hidden || fixed.removed.length) && !n) bumpDict();
        if (repaired) { try { core.saveMeta?.(); } catch { /* 다음 저장 때 */ } }
        if ((n || hidden || repaired) && draw) repaint();
        return n;
    }
    /** 그 확장 화면 번역의 사전 판(trVer)을 올려 낱말 바꾸기 목록을 새로 만들게 — 그 확장 addPairs 로 표시 짝 하나를 넣고 곧바로 지워요(저장 전에 지워져 파일에 안 남아요) */
    function bumpDict() {
        const k = 'bl⁣sync⁣tr';
        try { if (tr.addPairs([[k, '⁣']]) || tr.addPairs([[k, '⁤']])) { const d = core.getMeta()?.tr; if (isObj(d)) delete d[k]; } } catch { /* 다음 판 때 */ }
    }
    /** 페르소나 · 캐릭터 이름(실리태번) */
    function outerNames() { try { const c = globalThis.SillyTavern?.getContext?.(); return [c?.name1, c?.name2]; } catch { return []; } }
    /** 되살리기 진단 기록(콘솔이 아닌 · 시험 · 「로그 복사」 때 globalThis.__blMbTrRepair 로 봐요) — 채팅마다 바꾼 수 */
    function noteRepair(fixed) {
        trRepairLog.push({ at: now(), chat: chatId(), unlocked: fixed.unlocked.length, removed: fixed.removed.length, shown: fixed.shown.length });
        if (trRepairLog.length > 50) trRepairLog.shift();
    }
    /** 「번역 고치기」(그 확장 app.openTrFix)를 감싸요 — 여는 동안 숨긴 열쇠를 모두 셀 수 있게 되돌려(창에 바르게 보이고 · 고친 값이 그대로 저장돼요) 닫힌 뒤 정리 */
    let fixOpen = 0;
    function reveal() {
        const d = (() => { try { return core.getMeta()?.tr; } catch { return null; } })();
        if (!isObj(d)) return 0;
        let n = 0;
        for (const k of Object.getOwnPropertyNames(d)) { const desc = Object.getOwnPropertyDescriptor(d, k); if (desc && !desc.enumerable && 'value' in desc) { delete d[k]; d[k] = desc.value; n++; } }
        if (n) bumpDict();
        return n;
    }
    function guardTrFix() {
        const app = core.app, open = app?.openTrFix;
        if (typeof open !== 'function' || open.__blTrGuard) return false;
        const wrapped = async function (...args) {
            fixOpen++;
            reveal();
            try { return await open.apply(this, args); }
            finally { fixOpen = Math.max(0, fixOpen - 1); if (!fixOpen) tidySoon(0); }
        };
        wrapped.__blTrGuard = true;
        app.openTrFix = wrapped;
        return true;
    }

    /** 지금 상태 칸 중 화면에 영어가 남는 글(③) · 반쯤 번역 짝(④) */
    function stateGaps(state, dict) {
        const miss = new Set(), half = new Set();
        const lock = lockOf();
        for (const { text, key } of stateTexts(state, isOn)) {
            const k = text.trim();
            if (!k || k.length > 4000 || tried.has(k) || fixedValue(k, key)) continue;   // 고정 낱말은 사전으로 — 번역 요청에 싣지 않아요
            if (Object.hasOwn(dict, k)) { if (!lock[k] && halfValue(k, dict[k])) half.add(k); continue; }
            let shown = text;
            try { shown = tr.trString(text); } catch { shown = text; }
            if (stillEnglish(shown, { soft: SOFT_TEXT_KEYS.has(key) })) miss.add(k);
        }
        for (const k of half) miss.delete(k);
        return { miss: [...miss], half: [...half] };
    }

    /** 1.7.6 지도 「아직 안 가 본 곳」 이름 · 설명 가운데 사전에 없고 화면 글에 영어가 남는 것(스위치 unvisited 를 끄면 없음) */
    function unvisitedGaps(dict) {
        if (mbOff('unvisited', doc)) return [];
        let items = []; try { const get = globalThis[UNVISITED]; items = typeof get === 'function' ? get() : []; } catch { items = []; }
        const out = [];
        for (const it of Array.isArray(items) ? items : []) for (const [raw, soft] of [[it?.name, false], [it?.summary, true]]) {
            const k = String(raw ?? '').trim();
            if (!k || k.length > 600 || tried.has(k) || Object.hasOwn(dict, k) || out.includes(k)) continue;
            let shown = k; try { shown = tr.trString(k); } catch { shown = k; }
            if (stillEnglish(shown, { soft })) out.push(k);
        }
        return out;
    }

    /** ② · ③ · ④ 칩 · 기록 · 알림 · 앨범 · 상태 칸에서 아직 영어인 글만 그 확장 번역 길로 → 같은 사전 (묶음 60개 · 8000자 · 짝은 끝에 한 번에) */
    async function fill(reason = 'click') {
        if (filling || !view() || mbOff('trfill', doc)) return 0;   // 1.7.3 끄면 남은 영어를 번역 길로 안 보내요(AI 0)
        const current = core.app.current;
        if (!current?.state) return 0;
        const tidied = tidy({ draw: false });
        const meta = core.getMeta();
        const dict = isObj(meta?.tr) ? meta.tr : {};
        const longs = stateTexts(current.state, isOn).map(x => x.text.replace(/\s+/g, ' ').trim()).filter(t => t.length >= 12);
        const full = pre => longs.find(t => t.length > pre.length && t.startsWith(pre)) ?? null;   // 잘린 알림 글 → 상태의 원문(화면 밖 기록 rel.life 등)
        const { list: chipList, owners } = collectGaps(visibleTexts(current, meta), { shown: text => tr.trString(text), has: part => Object.hasOwn(dict, part), tried, full });
        const { miss, half } = stateGaps(current.state, dict);
        // 1.7.6 지도 「아직 안 가 본 곳」(src/mb-map-floors.js 가 로어북에서 고른 곳)의 이름 · 설명은 그 확장 상태에 없어 번역 요청에 안 실렸어요 → 같은 길 · 같은 사전으로.
        //   번역 단추를 눌렀을 때, 또는 자동 번역이 다른 글을 보내는 김에만 실어요(이것 때문에 자동 요청을 따로 내지 않아요)
        const base = [...chipList, ...miss, ...half];
        const lore = reason === 'click' || base.length ? unvisitedGaps(dict) : [];
        const list = [...new Set([...base, ...lore])];
        if (!list.length) { if (tidied) repaint(); return 0; }
        filling = true;
        let done = 0;
        const chat = chatId();
        const pairs = [];
        // 실리 기본 번역 길은 사전에 있는 글을 안 보내요 — 반쯤 번역 짝은 잠깐 빼 두었다가, 새 번역이 안 오면 되돌려요
        const back = new Map();
        if (engine() === 'st') for (const k of half) if (Object.hasOwn(dict, k)) { back.set(k, dict[k]); delete dict[k]; }
        try {
            for (const part of batches(list)) {
                const src = { list: part };
                const out = await tr.trJSON(src);
                // 1.5.0: 번역을 기다리는 사이 채팅을 바꾸면 addPairs 가 새 채팅 사전(getMeta)에 넣어요 — 그 채팅 것이 아니니 멈춰요
                if (chatId() !== chat) { pairs.length = 0; done = 0; break; }
                if (out === src || !Array.isArray(out?.list) || out.list.length !== src.list.length) continue;   // 실패 · 개수 어긋남 → 다음에 다시
                src.list.forEach((p, k) => { const got = pairsFor(p, out.list[k], owners); if (got.length) { pairs.push(...got); done++; } else tried.add(p); });
            }
        } finally {
            filling = false;
            for (const [k, v] of back) if (!Object.hasOwn(dict, k)) dict[k] = v;
        }
        if (pairs.length && chatId() === chat) tr.addPairs(pairs);
        if (done || tidied) repaint();
        if (done && reason === 'click') try { toast?.success?.(`화면에 영어로 남던 글 ${done}개도 번역했어요.`, 'Blue Lemonade', { timeOut: 3000 }); } catch { /* 알림 없이 */ }
        return done;
    }
    const engine = () => { try { return core.settings()?.trEngine === 'st' ? 'st' : 'llm'; } catch { return 'llm'; } };

    /** 누른 뒤: 그 확장이 번역을 끝낼 때까지(사전 크기가 두 번 그대로 · 확인 창 닫힘 · 본편 답 안 씀) 기다렸다가 한 번 */
    function arm() {
        if (!view()) return;
        if (watch) { watch.until = now() + WATCH_MAX; return; }
        let empty = false;
        try { empty = tr.missingTr().length === 0; } catch { empty = false; }
        watch = { start: dictSize(), last: -1, same: 0, empty, cancelled: false, until: now() + WATCH_MAX };
        const tick = () => {
            if (!watch) return;
            const size = dictSize();
            const grew = size > watch.start;
            if (watch.cancelled && !grew) { watch = null; return; }   // 그 확장의 확인 창에서 취소 — 아무것도 안 해요
            const open = !!doc.querySelector?.('dialog[open] .popup-button-ok');
            watch.same = size === watch.last ? watch.same + 1 : 0;
            watch.last = size;
            const settled = watch.same >= 2 && !open && !mb.busy();
            if (settled && (grew || watch.empty)) { watch = null; fill('click').catch(e => console.warn('[Blue Lemonade] 미트볼 번역 메우기', e)); return; }
            if (now() > watch.until) { watch = null; return; }
            timers.setTimeout(tick, WATCH_MS);
        };
        timers.setTimeout(tick, WATCH_MS);
    }
    /** 그 확장의 자동 번역이 지금 번역 담당에 켜져 있나(그 확장 규칙 그대로: 끔 · 실리 기본 번역일 때만 · 항상) */
    function autoOn() {
        try {
            const set = core.settings();
            const mode = set.trAuto === true ? 'st' : set.trAuto === false ? 'off' : (set.trAuto || 'st');
            return mode === 'always' || (mode === 'st' && set.trEngine === 'st');
        } catch { return false; }
    }
    /** ⑤ 채팅을 열거나 답이 끝나면 잠시 뒤 AI 없는 조각 짝만(번역 단추를 안 눌러도 「Day」 같은 고정 낱말이 한국어로) — 바뀐 게 없으면 저장도 안 해요 */
    let tidyTimer = 0;
    function tidySoon(ms = TIDY_MS) {
        if (!view()) return;
        timers.clearTimeout(tidyTimer);
        tidyTimer = timers.setTimeout(() => { try { tidy(); } catch (e) { console.warn('[Blue Lemonade] 미트볼 번역 조각', e); } }, ms);
    }
    function afterReply() {
        tidySoon(TIDY_REPLY_MS);   // 그 확장의 자동 번역(답 끝 2.5초 뒤)보다 먼저

        if (!view() || !autoOn()) return;
        timers.clearTimeout(autoTimer);
        autoTimer = timers.setTimeout(() => { if (mb.busy()) return afterReply(); fill('auto').catch(e => console.warn('[Blue Lemonade] 미트볼 번역 메우기', e)); }, AUTO_MS);
    }
    /**
     * 1.5.8 테마 번역기가 답을 번역해 끝냈을 때(EXTENSION_LLM_TRANSLATE_DONE): 그 답이 새로 쓴 칩 · 상태 글(관계 이름 「이름 = 설명」 · 새 장소 · 메모 …) 중
     *   사전에 없는 영어만 그 확장 번역 길로 한 번에 메워요. 사용자는 본문을 테마 번역기로 자동 번역하는데, 그 확장 자동 번역은 「번역 모델 + 실리 기본 번역일 때만」이라
     *   새 칩 글이 번역 단추를 누르기 전까지 영어로 남았어요(본문은 한국어 · 칩만 영어). 그 확장 자동 번역을 「끔」으로 둔 사람은 그대로 안 해요.
     */
    let trTimer = 0;
    function afterTranslate(data) {
        if (!view() || autoMode() === 'off') return;
        if (data && typeof data === 'object' && data.type && data.type !== 'translation') return;
        timers.clearTimeout(trTimer);
        trTimer = timers.setTimeout(() => { if (mb.busy()) return afterTranslate(data); fill('auto').catch(e => console.warn('[Blue Lemonade] 미트볼 번역 메우기', e)); }, TRANSLATED_MS);
    }
    function autoMode() {
        try { const set = core.settings(); return set.trAuto === true ? 'st' : set.trAuto === false ? 'off' : (set.trAuto || 'st'); } catch { return 'off'; }
    }
    function onClick(event) {
        const t = event.target;
        if (!t?.closest) return;
        // 1.5.1: 그 확장이 번역할 글을 모으기 전에(이 누름은 문서 잡기 단계라 그 확장 손잡이보다 먼저예요) 고정 낱말을 사전에 넣어 둬요 — 그 확장도 사전에 있는 글은 안 보내요
        if (t.closest(TRIGGER)) { try { tidy({ draw: false }); } catch (e) { console.warn('[Blue Lemonade] 미트볼 번역 조각', e); } arm(); }
        // 1.6.8: 알림함을 열면 쌓인 알림 글(화면 밖 · 단계 …)도 — 그 확장 자동 번역 규칙(끔 · 실리 기본 번역일 때만 · 항상) 그대로
        else if (t.closest('[data-hud="inbox"]') && view() && autoOn()) { timers.clearTimeout(autoTimer); autoTimer = timers.setTimeout(() => { if (!mb.busy()) fill('auto').catch(e => console.warn('[Blue Lemonade] 미트볼 번역 메우기', e)); }, 300); }
        // 번역을 묻는 창에서 사람이 누른 취소만(「남은 글 번역하기」는 번역 고치기 창을 스스로 닫아요 — 그 누름은 isTrusted 가 false) · 이미 번역이 늘었으면 그건 메워요
        else if (watch && event.isTrusted && t.closest('dialog[open] .popup-button-cancel')) watch.cancelled = true;
    }
    return { paint, slotRecord, view, fill, tidy, tidySoon, stateGaps, arm, afterReply, afterTranslate, onClick, autoOn, guardTrFix, reveal, _tried: tried, get watching() { return !!watch; }, get fixOpen() { return fixOpen; } };
}

let started = null;
/** 기능 다리가 시작할 때 한 번 — 그 확장을 못 찾으면 조용히 쉬어요 */
export function startTrFill(doc = globalThis.document) {
    if (started || !doc?.addEventListener) return started;
    started = (async () => {
        let mb = null;
        try { mb = await loadTarget(doc); } catch (error) { console.warn('[Blue Lemonade] 미트볼 번역 메우기', error); }
        if (!mb) return null;
        // 1.5.2 얼굴 첫 글자(ext-compat.js · 이미 받은 조각이라 새 요청 없음)가 보이는 이름을 따라가게 그 확장의 사전 바꾸기를 걸어요 — 화면만 번역이 꺼져 있으면 원문 그대로
        let compat = null;
        const faces = () => { if (compat) compat.paintFaces(doc); };
        const fill = createTrFill(mb, { doc, faces });
        import('./ext-compat.js').then(m => { compat = m; m.setFaceName(name => (fill.view() ? mb.tr.trString(name) : name)); faces(); }).catch(() => { /* 얼굴은 원문 이름 첫 글자 그대로 */ });
        fill.guardTrFix();   // 1.5.3 「번역 고치기」 동안 숨긴 열쇠를 되돌려 고친 값이 저장되게(검토 1)
        doc.addEventListener('click', fill.onClick, true);
        // 1.6.8 그 확장이 실리 기본 알림(toastr)으로 띄우는 글도 화면만 번역일 때 사전으로(그 확장 화면 번역 범위 밖이에요)
        try { wrapMbToasts(globalThis.toastr, { title: typeof mb.core.TITLE === 'string' ? mb.core.TITLE : '미트볼 상태창', trs: t => mb.tr.trString(t), on: () => fill.view() && !mbOff('trtoast', doc) }); } catch { /* 알림은 원문 그대로 */ }
        // 감시자를 새로 걸지 않고 메시지 꾸미기(공용 #chat 구독 하나)에 얹어요 — 칩 자리 안이 바뀐 기록만 · 답이 오는 동안에도 · 다음 프레임(그리기 전)
        addMessageDecorator('미트볼 칩 번역', list => fill.paint(list), { settle: 0, live: true, order: 90, filter: fill.slotRecord });   // 1.6.8: 굳힌 옛 답 날 칩은 한국어 저장에서도 다시 적어요(화면만 번역 확인은 paint 안에서)
        try {
            const { eventSource, event_types: types } = globalThis.SillyTavern.getContext();
            if (types?.GENERATION_ENDED) eventSource.on(types.GENERATION_ENDED, () => fill.afterReply());
            // 1.6.8 생성 없이 상태가 바뀌는 때(/sendas · 답 고치기 · 이미 있는 스와이프로 넘기기)도 고정 낱말 짝만(AI 0) — 「Afternoon」이 다음 답까지 영어로 남았어요
            for (const type of [types?.MESSAGE_RECEIVED, types?.MESSAGE_EDITED, types?.MESSAGE_SWIPED]) if (type) eventSource.on(type, () => fill.tidySoon(TIDY_REPLY_MS));
            eventSource.on('EXTENSION_LLM_TRANSLATE_DONE', data => fill.afterTranslate(data));   // 1.5.8 테마 번역기가 답을 번역해 끝내면 그 답의 칩 · 새 상태 글도
            // 1.5.2: 고정 낱말 열쇠는 채팅 파일에 안 적혀서 열 때마다 다시 넣어요 — 상태가 늦게 계산돼도 되게 0.8초 · 3초 두 번(바뀐 게 없으면 아무것도 안 해요)
            if (types?.CHAT_CHANGED) eventSource.on(types.CHAT_CHANGED, () => { fill.tidySoon(800); globalThis.setTimeout(() => fill.tidySoon(0), 3000); });
            fill.tidySoon();
        } catch { /* 누를 때만 */ }
        return fill;
    })();
    return started;
}
