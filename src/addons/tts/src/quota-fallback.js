// TTS — ElevenLabs 한도가 다 차면 MiniMax 로 대신 읽기 (테마 8.2.5)
// 사용자: 「일레븐랩스 한도초과일때만 미니맥스로 쓰이게끔 설정가능하게」 — 주로 ElevenLabs(감정 표현 · 연간 구독)로 듣고, 캐릭터마다 MiniMax 목소리도 있다.
//   ElevenLabs 글자 한도가 다 찼을 때만 같은 캐릭터의 MiniMax 목소리로 읽는다. 다른 실패(연결 · 키 · 몰림 429 · 서버 오류)는 지금처럼 그대로.
//
// 설정 settings().quota_fallback = { enabled: false(기본 끔 — 사용자가 켬), map: { ElevenLabs 목소리 uid: MiniMax 목소리 uid } }
//   캐릭터별 목소리 카드에서 캐릭터 줄마다 그 캐릭터가 실제로 읽는 ElevenLabs 목소리에 대신 쓸 MiniMax 목소리를 고른다 (비면 그 목소리는 대신 읽지 않음).
//   목소리 uid 로 잇는 까닭: 기본 · 나 · 내레이터 · 엑스트라 · 대화 색 · 엔진 자동 맞춤 짝 · 다른 확장 요청이 모두 같은 표를 쓰고, 화자 고르기(색 · 이름표)는 그대로 둔다.
//
// 한도 초과 판정 (ElevenLabs 공식 오류 안내 — elevenlabs.io/docs/developers/resources/errors · help-center api-error-code-400-or-401, 10-30 확인):
//   새 모양 { detail: { type, code, message, status(옛 칸), request_id } } — 한도는 402 payment_required / code insufficient_credits.
//   옛 모양 { detail: { status: 'quota_exceeded', message: 'This request exceeds your quota …' } } — HTTP 401 로 온다.
//   429(rate_limit_exceeded · concurrent_limit_exceeded · system_busy)는 잠깐 몰린 것이라 한도가 아니다.
//
// 세션 기억: 한 번 한도 초과가 나면 이 탭(sessionStorage — 새로 고쳐도 같은 탭이면 유지)에서 ElevenLabs 를 다시 두드리지 않는다.
//   ElevenLabs 가 다음 초기화 시각을 알려 주면(구독 조회 — 글자를 쓰지 않음) 그 시각이 지나면 저절로 ElevenLabs 로 돌아간다.
//   「ElevenLabs 로 돌아가기」를 누르면 바로 풀린다.
// 실리태번을 import 하지 않는 순수 모듈 — node 로 시험한다 (tools/tests/tts-quota-fallback.mjs).

export const QF_DEFAULTS = Object.freeze({ enabled: false, map: {} });
export const QF_FROM = 'elevenlabs';
export const QF_TO = 'minimax';
const MAP_MAX = 500;
const STORE = 'bl-tts-quota-out-v1';
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const uidOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;

/** 없거나 망가진 칸만 기본값으로 — 켬은 true 일 때만 (모르는 값은 끔), 표는 글자 → 글자만 */
export function normQuotaFallback(v) {
    const o = isObj(v) ? v : {};
    const map = {};
    if (isObj(o.map)) {
        for (const [k, x] of Object.entries(o.map)) {
            if (Object.keys(map).length >= MAP_MAX) break;
            if (!BAD_KEYS.has(k) && uidOk(k) && uidOk(x)) map[k] = x;
        }
    }
    return { ...o, enabled: o.enabled === true, map };
}

// 한도 초과를 뜻하는 ElevenLabs 오류 코드 (새 code · 옛 status)
export const QUOTA_CODES = Object.freeze(['quota_exceeded', 'insufficient_credits']);
const QUOTA_SET = new Set(QUOTA_CODES);
const QUOTA_TEXT = /exceeds your quota|insufficient (?:quota|credits)|credits? remaining/i;

/** ElevenLabs 응답 본문(JSON 글 · 객체)의 detail → { type, code, message } (모르면 빈 글) */
export function detailOf(body) {
    let j = body;
    if (typeof body === 'string') { try { j = JSON.parse(body); } catch { j = null; } }
    const d = isObj(j) ? j.detail : null;
    if (typeof d === 'string') return { type: '', code: '', message: d };
    if (!isObj(d)) return { type: '', code: '', message: '' };
    // 새 모양은 code, 옛 모양은 status (공식 안내: status 는 더 쓰지 않는 옛 칸 — code 가 먼저)
    const code = String(d.code || d.status || '');
    return { type: String(d.type || ''), code, message: typeof d.message === 'string' ? d.message : '' };
}

/** HTTP 상태 + 본문 → ElevenLabs 글자 한도가 다 찬 응답인가 */
export function quotaResponse(status, body) {
    const d = detailOf(body);
    if (QUOTA_SET.has(d.code) || d.type === 'payment_required') return true;
    if (Number(status) === 402) return true;
    // 코드가 없는 옛 응답: 401 · 402 · 403 에 한도 글이 있을 때만 (429 몰림 · 5xx 는 아님)
    return [401, 403].includes(Number(status)) && !d.code && QUOTA_TEXT.test(d.message);
}

/** 오류 객체 → 한도 초과인가 (elevenlabs.js elError 가 e.quota 를 붙인다 · 다른 길로 온 code 도 봄). 429 · 연결 · 키 오류는 아니다 */
export function isQuotaError(e) {
    if (!e || typeof e !== 'object' || e.name === 'AbortError') return false;
    if (e.quota === true) return true;
    if (e.status === 429 || e.code === 429 || e.retry === true) return false;
    return QUOTA_SET.has(String(e.code || '')) || e.status === 402 || e.code === 402;
}

/** 대신 쓸 MiniMax 목소리 — 켜져 있고, 그 ElevenLabs 목소리에 고른 MiniMax 목소리가 있고, 계정에 남아 있을 때만 (아니면 null) */
export function fallbackVoiceOf(voice, qf, findVoice) {
    const f = normQuotaFallback(qf);
    if (!f.enabled || !voice || voice.provider !== QF_FROM) return null;
    const uid = f.map[voice.uid];
    if (!uid || typeof findVoice !== 'function') return null;
    let alt = null;
    try { alt = findVoice(uid); } catch { alt = null; }
    return alt && alt.provider === QF_TO && !alt.gone ? alt : null;
}

// ---------- 세션 기억 (이 탭)
let out = null;   // { at: 막힌 시각 ms, until: 풀리는 시각 ms (0 = 이 탭 동안), noticed: 안내를 띄웠나 }
let loaded = false;
const listeners = new Set();
const store = () => { try { return globalThis.sessionStorage || null; } catch { return null; } };
function persist() {
    const ss = store();
    if (!ss) return;
    try { if (out) ss.setItem(STORE, JSON.stringify(out)); else ss.removeItem(STORE); } catch { /* 저장 못 함 — 메모리만 */ }
}
function load() {
    if (loaded) return;
    loaded = true;
    const ss = store();
    if (!ss) return;
    try {
        const j = JSON.parse(ss.getItem(STORE) || 'null');
        if (isObj(j) && Number.isFinite(j.at)) out = { at: j.at, until: Number.isFinite(j.until) && j.until > 0 ? j.until : 0, noticed: j.noticed === true };
    } catch { out = null; }
}
function emit(now = Date.now()) {
    const st = quotaState(now);
    for (const fn of listeners) { try { fn(st); } catch { /* 듣는 쪽 오류는 무시 */ } }
    try { globalThis.document?.dispatchEvent?.(new CustomEvent('tts:quota', { detail: st })); } catch { /* 화면이 없음 (시험) */ }
}

/** 지금 ElevenLabs 를 건너뛰는 중인가 (풀리는 시각이 지났으면 저절로 풂) */
export function quotaOut(now = Date.now()) {
    load();
    if (!out) return false;
    if (out.until && now >= out.until) { out = null; persist(); emit(now); return false; }
    return true;
}
/** 한도 초과를 기억 — 이미 기억 중이면 그대로 (처음 막힌 시각 유지) → 새로 막혔으면 true */
export function tripQuota(now = Date.now()) {
    if (quotaOut(now)) return false;
    out = { at: now, until: 0, noticed: false };
    persist();
    emit(now);
    return true;
}
/** ElevenLabs 가 알려 준 다음 초기화 시각 (ms) — 지금보다 뒤일 때만 (그때 저절로 ElevenLabs 로 돌아감) */
export function setQuotaUntil(ms, now = Date.now()) {
    if (!quotaOut(now)) return false;
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= now) return false;
    out.until = n;
    persist();
    emit(now);
    return true;
}
/** 대신 읽기 안내를 한 번만 — 처음 부르면 true */
export function takeNotice(now = Date.now()) {
    if (!quotaOut(now) || out.noticed) return false;
    out.noticed = true;
    persist();
    return true;
}
/** 「ElevenLabs 로 돌아가기」 — 기억을 지운다 */
export function clearQuota() {
    load();
    const had = !!out;
    out = null;
    persist();
    if (had) emit();
    return had;
}
/** 화면에 보일 상태 { out, at, until } */
export function quotaState(now = Date.now()) {
    const on = quotaOut(now);
    return { out: on, at: on ? out.at : 0, until: on ? out.until : 0 };
}
export function onQuotaChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** 패널 한 줄: 「ElevenLabs 한도가 다 차서 MiniMax 로 읽고 있어요 · 11월 3일 초기화 뒤 돌아가요」 */
export function quotaNoteText(st = quotaState()) {
    if (!st || !st.out) return '';
    const d = st.until ? new Date(st.until) : null;
    const when = d && !Number.isNaN(d.getTime()) ? ` · ${d.getMonth() + 1}월 ${d.getDate()}일 초기화 뒤 돌아가요` : '';
    return `ElevenLabs 한도가 다 차서 MiniMax 로 읽고 있어요${when}`;
}
export const QUOTA_NOTICE = 'ElevenLabs 한도가 다 차서 MiniMax 로 읽고 있어요';

export const _resetForTest = () => { out = null; loaded = false; listeners.clear(); };
