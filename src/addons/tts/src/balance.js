// TTS 1.3.5 — 엔진 잔액 줄 (설정 창 엔진 카드, 키 아래): 엔진이 balance(cfg) 로 돌려준 것을 한 줄 글로.
// 실리태번 · DOM 을 안 쓰는 순수 함수만 — tools/tests/tts-balance.mjs 가 그대로 돌린다.
//
// balance(cfg) → null (줄 없음) | {
//     label   '남은 글자' · '남은 크레딧' · '쓴 크레딧' · '이번 달 쓴 글자' …
//     left    남은 양 (있으면 '남은' 줄) · total  전체 (있으면 ' / 전체')
//     used    쓴 양 (left 가 없을 때)
//     unit    '자' · '' (크레딧) · '$'
//     reset   다음 초기화 (ms 시각) → '10월 15일 초기화'
//     note    덧붙일 말 (요금제 이름 · '한도 없음' …)
//     url · urlText   잔액을 보여 주는 페이지 (API 로 못 받는 엔진 — MiniMax) → ' · 잔액은 {urlText}에서' 링크
// }
// 어느 엔진이 뭘 주나 (10-07 확인): ElevenLabs 남은 글자(구독) · Typecast 남은 크레딧(구독) · OpenRouter 키 한도가 있으면 남은 $, 없으면 쓴 $
//   · Cartesia 이번 달 쓴 크레딧(남은 양은 API 에 없음) · MiniMax 는 잔액 API 가 없어(계정 잔액 주소는 관리자 키 전용, token_plan/remains 는 코딩 플랜만)
//   이번 달 쓴 글자 + 결제 페이지 링크 · OpenAI · Gemini · Azure · 직접 서버 · 무료 엔진은 줄 없음.
export const BALANCE_TTL = 10 * 60 * 1000;   // 카드를 다시 열어도 10분 안엔 다시 묻지 않는다 (↻ 는 바로)

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fmtInt = (n) => Math.round(n).toLocaleString('ko-KR');

/** 양 + 단위: $12.50 · 12,345자 · 12,345 */
export function money(v, unit) {
    if (!isNum(v)) return '';
    if (unit === '$') return `$${(Math.round(v * 100) / 100).toFixed(2)}`;
    return `${fmtInt(v)}${unit || ''}`;
}

/** 초기화 시각 → '10월 15일 초기화' (1년 넘게 남았으면 연도까지) */
export function resetText(ms, now = Date.now()) {
    if (!isNum(ms) || ms <= 0) return '';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const far = Math.abs(ms - now) > 366 * 24 * 3600 * 1000;
    return `${far ? d.getFullYear() + '년 ' : ''}${d.getMonth() + 1}월 ${d.getDate()}일 초기화`;
}

/** 줄 조각: main(글) + tail(링크가 있을 때 ' · 잔액은 ' + 링크 + '에서') */
export function balanceParts(r, now = Date.now()) {
    if (!r || typeof r !== 'object') return { main: '', tail: null };
    const parts = [];
    const label = String(r.label || '').trim();
    if (isNum(r.left)) parts.push(`${label} ${money(Math.max(0, r.left), r.unit)}${isNum(r.total) && r.total > 0 ? ` / ${money(r.total, r.unit)}` : ''}`.trim());
    else if (isNum(r.used)) parts.push(`${label} ${money(Math.max(0, r.used), r.unit)}`.trim());
    else if (label) parts.push(label);
    const reset = resetText(r.reset, now);
    if (reset) parts.push(reset);
    if (r.note) parts.push(String(r.note).trim());
    const tail = r.url ? { before: ' · 잔액은 ', text: String(r.urlText || '결제 페이지'), after: '에서', url: String(r.url) } : null;
    return { main: parts.filter(Boolean).join(' · '), tail };
}

/** 한 줄 글 (링크 글자까지 이어 붙인 것 — 검사 · 기록용) */
export function balanceText(r, now = Date.now()) {
    const p = balanceParts(r, now);
    return p.main + (p.tail ? p.tail.before + p.tail.text + p.tail.after : '');
}

/** 거의 다 썼나 (남은 양이 0 이거나 전체의 10 % 아래) → 줄을 주의색으로 */
export function balanceLow(r) {
    if (!r || !isNum(r.left)) return false;
    if (r.left <= 0) return true;
    return isNum(r.total) && r.total > 0 && r.left / r.total < 0.1;
}

/** 이번 달 쓴 글자 (settings().usage — 달이 지났으면 0). filter 를 주면 usage.models 의 그 모델들만 (MiniMax: speech-*) */
export function monthChars(usage, filter, now = new Date()) {
    const u = usage && typeof usage === 'object' ? usage : {};
    const month = now.toISOString().slice(0, 7);
    if (u.month && u.month !== month) return 0;
    if (typeof filter !== 'function') return Math.max(0, Number(u.chars) || 0);
    const models = u.models && typeof u.models === 'object' ? u.models : {};
    let n = 0;
    for (const [m, v] of Object.entries(models)) if (filter(m)) n += Math.max(0, Number(v) || 0);
    return n;
}
