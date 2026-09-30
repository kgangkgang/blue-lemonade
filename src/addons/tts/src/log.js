// TTS 최근 기록: 50개 고리 버퍼 (데이터 탭용)
// 키·긴 글은 절대 담지 않는다 — 글은 snip() 으로 60자까지, 키처럼 생긴 긴 토큰은 *** 로 가림

const MAX = 50;          // 보관 개수
const SNIP = 60;         // 글 조각 최대 길이
const MSG_MAX = 200;     // 한 줄 최대 길이
const KINDS = new Set(['req', 'err', 'info']);

const ring = [];
const subs = new Set();

/** 글 조각: 공백 정리 후 max 글자까지 (넘으면 …) */
export function snip(text, max = SNIP) {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
}

/** 키처럼 생긴 것 가리기: Bearer 뒤, 영숫자 32자 이상 연속 (JWT·hex 키 포함). HTML 태그는 벗긴다 (토스트에도 씀) */
export function scrub(msg) {
    return String(msg ?? '')
        .replace(/<[^<>]*>/g, ' ')
        .replace(/\b(bearer)\s+\S+/gi, '$1 ***')
        .replace(/[A-Za-z0-9_\-.]{32,}/g, '***')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

/** 기록 남기기. kind: 'req' | 'err' | 'info' */
export function log(kind, msg) {
    const entry = {
        t: Date.now(),
        kind: KINDS.has(kind) ? kind : 'info',
        msg: scrub(snip(msg, MSG_MAX)),
    };
    ring.push(entry);
    if (ring.length > MAX) ring.splice(0, ring.length - MAX);
    for (const fn of subs) {
        try { fn(entry); } catch { /* 구독자 오류는 무시 */ }
    }
    return entry;
}

/** 최신 순 복사본 */
export function entries() {
    return ring.slice().reverse();
}

/** 모두 지우기 */
export function clearLog() {
    ring.length = 0;
}

/** 새 기록 알림 구독 → 해제 함수 */
export function onLog(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
}

/** 표시용 시각 HH:MM:SS */
export function timeStr(t) {
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
