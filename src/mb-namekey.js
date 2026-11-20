// 1.7.9 이름이 앞에 온 변화 줄도 읽기 — 버그 사냥 3(실사용 자료).
//   그 확장의 변화 줄은 「aff: 이름 +3」 · 「trust: 이름 +1」 꼴이에요. 사용자 채팅(11-18)에서 본편 모델이 한 답에 「Mira: aff +3 trust +4」(지어낸 이름) 처럼
//   **사람 이름을 키로** 적었어요 → 그 확장은 모르는 키라 ⚠(못 읽은 줄)로만 세고 그 답의 애정 · 우정 변화가 통째로 빠졌어요.
//   여기서 하는 일(AI 호출 0 · 원작 파일 · 답 본문은 안 고쳐요):
//     · 그 확장이 답에서 떼어 메시지 숨은 칸(extra.statussim.bySwipe — 「서랍」)에 둔 변화 줄 가운데, 키가 그 확장이 모르는 낱말이면서
//       **상태창 인물 표(관계 · 프로필의 이름 · 별칭)에 있는 사람**이고, 값이 「aff +3 trust +4」 처럼 그 확장이 아는 애정 · 우정 키와 숫자만인 줄을
//       「aff: 이름 +3」 · 「trust: 이름 +4」 로 나눠 적어요. 키는 그 확장이 애정 · 우정으로 알아보는 것만(opInfo) · 이름은 적힌 그대로.
//     · 원래 줄은 같은 메시지 칸(extra.bl_mbnamekey[스와이프])에 남겨요(칩 점검 · 되돌리기 근거). 본문 · 편집 창 · 원문 보기에는 아무것도 안 보여요(서랍은 본문 밖이에요).
//     · 언제: 채팅을 열 때(그 확장이 메타를 읽은 뒤) · 답이 끝났을 때 · 스와이프할 때. 바꾼 답이 있으면 채팅 저장 · 그 확장 새로고침 한 번.
//     · 본문에 변화 블록이 그대로 있는 답(그 확장 「본문에서 떼어 보관」 을 끈 때)은 그 확장이 본문에서 읽어요 — 본문을 고치면 편집 창에 드러나니 손대지 않아요.
//   · 줄인 키(1.7.9 · 알려진 별칭 표 KEY_ALIASES — 지금은 「fri」 → trust 하나)도 같은 길로 「trust: 이름 +2」 로 적어요.
//   스위치: 미트볼 맞춤 「데이터를 고치는 것」 › 「이름 앞 · 줄인 키 변화 줄도 읽기」(열쇠 namekey · 기본 켬). 끄면 더는 안 나눠요(이미 나눈 줄은 그대로).
//   시험: tools/tests/mb-namekey.mjs
import { mbOff } from './mb-switch-core.js';
import * as Sub from './mb-autosub.js';
import { foldBlank } from './blank-fold.js';   // 버그 사냥 7 점자 빈칸 공용 정규화
import { ctx, chatMark, serialQueue, mbImport } from './mb-util.js';   // 1.9.2 공용 도우미

export const KEY = 'namekey';
export const STATE = 'bl_mbnamekey';   // 메시지 extra 칸: { [스와이프]: [[원래 키, 원래 값], …] }
const META = 'statussim';
const PERSON = new Set(['aff', 'trust']);
const nm = s => foldBlank(String(s ?? '').normalize('NFC')).replace(/\*\*|__|`/g, '').trim().toLowerCase();
/** 버그 사냥 6 줄 하나의 점자 빈칸(U+2800) → 띄어쓰기 · 이어진 띄어쓰기 하나로 · 앞뒤 다듬기(나눔표 둘레는 그 확장이 조각마다 다듬어요) */
export const blankLine = s => foldBlank(s).replace(/ {2,}/g, ' ').trim();
export const active = (doc = globalThis.document) => !mbOff(KEY, doc);

/** 상태창 인물 표의 이름 · 별칭(소문자) — 사용자(role user · 내 이름)는 빼요 */
export function personNames(state, userName = '') {
    const out = new Set();
    const rows = [...(state?.data?.rel?.user || []), ...(state?.data?.profile?.list || [])];
    for (const r of rows) {
        if (!r || typeof r !== 'object' || r.role === 'user') continue;
        for (const v of [r.name, ...(Array.isArray(r.aliases) ? r.aliases : [])]) { const k = nm(v); if (k) out.add(k); }
    }
    if (userName) out.delete(nm(userName));
    return out;
}

const PAIR = /([^\s\d+\-−:=,;|/]{2,24})\s*[:=]?\s*([+\-−]\s*\d{1,3}(?:\.\d+)?)/gu;
/**
 * 「aff +3 trust +4」 → [['aff', '+3'], ['trust', '+4']] · 애정 · 우정 키와 숫자 말고 다른 글이 섞이면 null.
 * keyOf(낱말) = 그 확장이 아는 칸 종류(opInfo().key) — aff · trust 만 받아요.
 */
export function deltaPairs(value, keyOf) {
    const s = String(value ?? '').trim();
    if (!s) return null;
    const out = [];
    let rest = s;
    for (const m of s.matchAll(PAIR)) {
        const kind = keyOf(m[1]);
        if (!PERSON.has(kind)) return null;
        out.push([m[1], m[2].replace(/\s+/g, '').replace(/−/g, '-')]);
        rest = rest.replace(m[0], ' ');
    }
    if (!out.length || /[^\s,;|/·.]/u.test(rest)) return null;
    return out;
}

/**
 * 알려진 별칭 키 — 모델이 그 확장 키를 줄여 쓴 것 가운데 **실제 채팅에서 본 것만** 하나씩 더해요(낱말 → 그 확장이 아는 키).
 *   fri: 11-18 사용자 새 채팅 첫 답의 「fri: 이름 +2」 세 줄(우정 · 그 답 하나뿐 · 원작 키 표 · 출력 규칙 · 카드 · 프리셋 어디에도 없음)
 *   더할 때: 값 꼴은 그 키 그대로(「이름 +N」 · 여럿이면 쉼표)여야 하고, 그 키가 그 확장에서 aff · trust 로 읽혀야 해요(아래 rewriteOps 가 확인).
 */
export const KEY_ALIASES = Object.freeze({ fri: 'trust' });
const ALIAS_VALUE = /^\s*([^,，+\-−\d][^,，]*?)\s*([+\-−]\s*\d{1,3}(?:\.\d+)?)\s*$/u;
/** 별칭 키 줄 값 「A +2, B -1」 → [[이름, '+2'], …] · 이름이 인물 표에 없거나 숫자가 아닌 조각이 있으면 null */
export function aliasPairs(value, names) {
    const parts = String(value ?? '').split(/\s*[,，]\s*/u).filter(Boolean);
    if (!parts.length) return null;
    const out = [];
    for (const p of parts) {
        const m = ALIAS_VALUE.exec(p); if (!m) return null;
        const who = m[1].replace(/\*\*|__|`/g, '').trim();
        if (!names.has(nm(who))) return null;
        out.push([who, m[2].replace(/\s+/g, '').replace(/−/g, '-')]);
    }
    return out;
}

/**
 * 서랍 한 칸(변화 줄 목록)을 고쳐 읽는 꼴로 — 바꿀 것이 없으면 null.
 *   keyOf(낱말) = 그 확장의 칸 종류(모르면 null) · names = personNames(소문자 이름 · 별칭)
 *   → { ops: 새 목록, was: [[원래 키, 원래 값], …] }
 */
export function rewriteOps(ops, keyOf, names) {
    if (!Array.isArray(ops) || !ops.length) return null;
    names ??= new Set();
    let touched = false; const out = [], was = [];
    for (let op of ops) {
        // 버그 사냥 6 점자 빈칸(U+2800): 띄어쓰기 대신 점자 빈칸을 쓰는 프리셋이면 변화 줄에도 그대로 들어와(「mind: ⠀Mira⠀ | …」) 그 확장이 이름을
        //   「⠀Mira⠀」 로 따로 세어 같은 인물이 속마음 · 관계 칸에 두 칸으로 나왔어요(11-19 사용자 사진 · 실제 채팅 서랍 줄에서 확인). 보통 띄어쓰기로 바꾸고 앞뒤를 다듬어요 —
        //   그 확장은 서랍 줄로 상태를 다시 셈해서, 이미 갈라진 기록도 다시 읽으면 한 사람으로 합쳐져요(지난 속마음도 같은 칸에 차례대로).
        if (Array.isArray(op) && typeof op[0] === 'string' && typeof op[1] === 'string' && (op[0].includes('⠀') || op[1].includes('⠀'))) {
            const k1 = blankLine(op[0]), v1 = blankLine(op[1]);
            was.push([op[0], op[1]]); op = [k1, v1, ...op.slice(2)]; touched = true;
        }
        const [k, v] = Array.isArray(op) ? op : [];
        const name = String(k ?? '').replace(/\*\*|__|`/g, '').trim();
        if (typeof k === 'string' && typeof v === 'string' && names.size && !keyOf(name) && names.has(nm(name))) {
            const pairs = deltaPairs(v, keyOf);
            if (pairs) { for (const [key, d] of pairs) out.push([key, `${name} ${d}`]); was.push([k, v]); touched = true; continue; }
        }
        // 1.7.9 줄인 키(「fri: 이름 +2」) — 그 확장이 모르는 낱말이고 별칭 표에 있으며, 바꿀 키를 그 확장이 애정 · 우정으로 읽을 때만
        const to = KEY_ALIASES[nm(name)];
        if (to && typeof v === 'string' && !keyOf(name) && PERSON.has(keyOf(to))) {
            const pairs = aliasPairs(v, names);
            if (pairs) { out.push([to, pairs.map(([who, d]) => `${who} ${d}`).join(', ')]); was.push([k, v]); touched = true; continue; }
        }
        out.push(op);
    }
    return touched ? { ops: out, was } : null;
}

/** 한 메시지의 서랍들(지금 extra · 스와이프 칸 extra) 고치기 → 바꾼 서랍 수 */
export function fixMessage(m, keyOf, names, { hasStatus = null } = {}) {
    if (!m || m.is_user || !m.extra || typeof m.extra !== 'object') return 0;
    if (typeof hasStatus === 'function' && typeof m.mes === 'string') { try { if (hasStatus(m.mes)) return 0; } catch { /* 서랍으로 봐요 */ } }
    let n = 0;
    const fixHolder = extra => {
        const by = extra?.[META]?.bySwipe; if (!by || typeof by !== 'object') return;
        for (const sid of Object.keys(by)) {
            const r = rewriteOps(by[sid], keyOf, names); if (!r) continue;
            by[sid] = r.ops;
            const keep = (extra[STATE] ??= {}); keep[sid] = [...(Array.isArray(keep[sid]) ? keep[sid] : []), ...r.was];
            n++;
        }
    };
    fixHolder(m.extra);
    if (Array.isArray(m.swipe_info)) for (const info of m.swipe_info) if (info?.extra && info.extra !== m.extra) fixHolder(info.extra);
    return n;
}

// 그 확장 core(지금 상태 · 새로고침) — mb-editsync.js 와 같은 찾기(스크립트 주소로)
async function mbCore(doc = globalThis.document) { return mbImport('./src/core.js', doc); }   // 1.9.2 공용 찾기(src/mb-util.js)
let testCore = undefined;
/** 시험용: 그 확장 core 대신 넣기 */
export const useCore = k => { testCore = k; };
const core = async () => (testCore !== undefined ? testCore : mbCore());
const sheet = c => { const meta = c?.chatMetadata?.[META]; return meta && typeof meta === 'object' && meta.base && !meta.off && c?.extensionSettings?.[META]?.enabled !== false ? meta : null; };
const serial = serialQueue();
/** 지금 채팅을 훑어 고쳐요(from 번 메시지부터) → 바꾼 서랍 수. eng = 그 확장 계산 모듈(시험용) */
export function sweep(c = ctx(), { from = 0, eng = undefined, doc = globalThis.document } = {}) {
    const still = chatMark(c);   // 1.9.2 그 확장 모듈을 처음 받는 사이 채팅이 바뀌면 옛 채팅 인물 이름으로 새 채팅 서랍 줄을 고치고 저장하지 않게
    return serial(async () => {
        if (!active(doc) || !Array.isArray(c?.chat) || !sheet(c)) return 0;
        const e = eng ?? await Sub.engine(); if (!e || typeof e.opInfo !== 'function') return 0;
        const k = await core();
        if (!still()) return 0;
        let state = null; try { state = k?.app?.current?.state ?? null; } catch { state = null; }   // 지금 상태(인물 표 · 수치 칸) — 없으면 처음 상태
        state ??= sheet(c).base;
        const names = personNames(state, c.name1);   // 버그 사냥 6 인물 표가 비어도 점자 빈칸 줄은 고쳐요
        const keyOf = word => { try { return e.opInfo(state, word)?.key ?? null; } catch { return null; } };
        let n = 0;
        for (let i = Math.max(0, from); i < c.chat.length; i++) n += fixMessage(c.chat[i], keyOf, names, { hasStatus: e.hasStatus });
        if (n) {
            try { await c.saveChat?.(); } catch { /* 다음 저장 때 */ }
            try { k?.app?.refreshNow?.(); } catch { /* 다음 새로고침 때 */ }
            try { globalThis.document?.dispatchEvent?.(new CustomEvent('bl-mb-namekey', { detail: { n } })); } catch { /* 듣는 곳이 없어도 */ }
        }
        return n;
    });
}

let started = false;
/**
 * 사건 걸기(미트볼 문에서 한 번) — 시험은 { c, wait, force } 로 가짜 맥락 · 가짜 시계를 넣어요
 *   1.9.1 속마음 두 칸(사용자 사진 11-19 밤): 스트리밍이면 실리태번은 「생성 끝」 을 「답 받음」 **앞에** 내요(멈춤 단추를 숨길 때). 그 확장은 「답 받음」 에서 변화 블록을 서랍에 넣는데,
 *   그 사건의 맨 앞 듣는 곳(다시 쓰기 애드온 — 고쳐 쓸 곳이 있으면 AI 답을 기다려요)이 끝나야 차례가 와요. 그래서 다시 쓰기가 돈 답은 「생성 끝 뒤 0.6초」 훑기 때
 *   서랍이 아직 없어(본문에 블록이 그대로) 지나쳤고, 그 뒤 들어온 점자 빈칸 줄(「mind: ⠀Mira⠀ | …」)이 다음 답까지 안 고쳐져 방금 받은 속마음이 새 인물 칸으로 갔어요.
 *   「답 그림」 사건은 「답 받음」 의 듣는 곳이 모두 끝난 뒤에 나와요(스트리밍 · 아님 둘 다) — 그때 그 답부터 한 번 더 훑어요.
 */
export function startNameKey(doc = globalThis.document, { c = ctx(), wait = (fn, ms) => setTimeout(fn, ms), force = false } = {}) {
    if (started && !force) return false;
    const on = c?.eventSource?.on?.bind(c.eventSource), T = c?.event_types ?? c?.eventTypes ?? {};
    if (!on) return false;
    started = true;
    const later = (ms, from) => wait(() => { sweep(ctx(), { from: typeof from === 'function' ? from() : from, doc }).catch(() => { /* 원래 동작 그대로 */ }); }, ms);
    const tail = () => Math.max(0, (ctx()?.chat?.length ?? 1) - 2);
    if (T.CHAT_CHANGED) on(T.CHAT_CHANGED, () => later(1500, 0));   // 그 확장이 제 메타를 읽은 뒤에
    if (T.GENERATION_ENDED) on(T.GENERATION_ENDED, () => later(600, tail));   // 그 확장이 새 답을 서랍에 넣은 뒤에(스트리밍 아님 · 다시 쓰기가 안 돈 답)
    if (T.MESSAGE_SWIPED) on(T.MESSAGE_SWIPED, () => later(600, tail));
    // 답 그림: 잇달아 와도 훑기는 한 번(가장 앞 번호부터)
    let due = false, low = Infinity;
    if (T.CHARACTER_MESSAGE_RENDERED) on(T.CHARACTER_MESSAGE_RENDERED, id => {
        const i = Number(id); low = Math.min(low, Number.isInteger(i) && i >= 0 ? i : tail());
        if (due) return; due = true;
        later(RENDER_WAIT, () => { const from = low; due = false; low = Infinity; return from; });
    });
    later(1500, 0);
    return true;
}
/** 「답 그림」 뒤 훑기까지 기다림(ms) — 그 확장의 같은 사건 처리(다시 계산)가 먼저 끝나게 */
export const RENDER_WAIT = 150;
