// TTS 대사 분석 — 검열되면 다른 모델로 (TTS 1.7.1 · 테마 6.1.8)
// 사용자: 「분석도 … 검열당하면 다른 모델 쓰게끔」 — 수위 높은 답장에서 분석 요청이 내용 차단으로 실패하면 분석이 아예 없어서
// 색 없는 엑스트라 대사의 화자를 못 찾았다 (「목소리를 먼저 정해요」). 막히면 골라 둔 다른 공급자 · 모델로 딱 한 번 더 보낸다.
// 다른 모델은 늘 "실리태번 API 중 선택" 길로 보낸다 (키는 실리태번에 저장된 것을 서버가 붙임).
// 차단 판정: 내용 차단 글(PROHIBITED_CONTENT · safety · content_filter …) · 거절 글로 시작하는 답 · 실리태번의 'Candidate text empty' ·
// 이유 없는 400 'Bad Request'. 429 · 401 · 네트워크 · 시간 초과는 차단이 아니다 (다른 모델로 보내지 않음).
// 실리태번을 import 하지 않는 순수 모듈 — node 로 시험한다 (tools/tests/tts-block-fallback.mjs).

/** settings().analysis.fallback — enabled: 자동으로 다시 보낼지 (손으로 누르는 「다른 모델로 다시」는 꺼 둬도 됨) · provider: chat_completion_source · model */
export const FALLBACK_DEFAULTS = Object.freeze({ enabled: true, provider: '', model: '' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

/** 없거나 망가진 칸만 기본값으로 */
export function normFallback(v) {
    const o = isObj(v) ? v : {};
    return { ...o, enabled: o.enabled !== false, provider: str(o.provider).trim(), model: str(o.model).trim() };
}

const msgOf = (e) => String(e?.message || e || '').replace(/^Error:\s*/, '').trim();
/** 잠깐의 문제 · 키 · 한도로 난 실패 (e.retry · 401 · 402 · 408 · 429 · 5xx) — 글에 차단 낱말이 있어도 다른 모델로 보내지 않는다 (403 은 OpenRouter 검열이 오는 곳이라 남김) */
export function notBlock(error) {
    if (!error || typeof error !== 'object') return false;
    const st = Number(error.status) || 0;
    return error.retry === true || [401, 402, 408, 429].includes(st) || st >= 500;
}

/** 업체 · 중계 서버가 이 내용을 막았다 (같은 모델로 다시 보내도 또 막힌다) */
export function isContentBlock(error) {
    if (error?.blocked === true) return true;
    return /prohibited.?content|could not be submitted|sensitive words|content.?(?:filter|policy|management)|moderation|blocked (?:by|due)|finish_?reason\W{0,4}safety|\bSAFETY\b|blocklist|\bSPII\b|recitation|敏感|违规/i.test(msgOf(error));
}
// 실리태번이 출력 쪽 차단(Gemini finishReason SAFETY · PROHIBITED_CONTENT …)을 이유 없이 넘겨줄 때의 글 — 차단이라고 단정하지 않지만 한 번 해 볼 만하다
const SUSPECT = /Candidate text empty|returned no candidate/i;
// 이유 없는 400: 실리태번 백엔드(Custom · OpenAI 호환 길)는 중계 서버의 400 본문을 버리고 "Bad Request" 만 넘긴다 (중계 서버의 Gemini 입력 차단이 이 모양)
const BARE_400 = /^(?:bad request|HTTP 400(?::\s*(?:bad request)?)?)\.?$/i;
export const bareBadRequest = (error) => error?.bare400 === true || BARE_400.test(msgOf(error));
/** 다른 모델로 보낼 만한 실패인가 — 내용 차단 + 차단으로 보이는 빈 답 · 이유 없는 400. 429 · 401 · 네트워크 · 시간은 아니다 */
export function maybeBlocked(error) {
    if (!error || error.name === 'AbortError' || notBlock(error)) return false;
    if (isContentBlock(error) || error.maybeBlocked === true) return true;
    return SUSPECT.test(msgOf(error)) || bareBadRequest(error);
}

/** 200 응답인데 안전 필터에 막혔으면 그 이유, 아니면 '' (번역기 blockedReasonOf 와 같은 판정) */
export function blockedReasonOf(data) {
    const finish = String(data?.choices?.[0]?.finish_reason ?? data?.candidates?.[0]?.finishReason ?? data?.stop_reason ?? '');
    if (/content_filter|safety|prohibited|blocklist|spii|recitation/i.test(finish)) return finish;
    const fb = data?.promptFeedback?.blockReason ?? data?.prompt_feedback?.block_reason;
    if (fb) return String(fb);
    const e = data?.error;
    const message = typeof e === 'string' ? e : String(e?.message ?? '');
    if (/rate.?limit|too many requests|\b429\b|quota|overload|time.?out|unavailable/i.test(message)) return '';   // 'blocked due to rate limit' 는 차단이 아님
    const blocked = /[Bb]locked due to\s*:?\s*([A-Z][A-Z_]+)/.exec(message);
    if (blocked) return blocked[1];
    if (/PROHIBITED_CONTENT|content[_ ]filter|\bSAFETY\b/i.test(message)) return message.split('\n').pop().trim().slice(0, 80);
    return '';
}

/**
 * JSON 이 와야 하는 자리에 온 거절 글인가 — 글 맨 앞의 분명한 거절만 (JSON · 글 안에 인용된 말은 아님).
 * 분석 답은 JSON 이라 이런 말로 시작하면 모델이 거절한 것이다
 */
export function refusalReply(text) {
    const t = String(text ?? '').trim().replace(/^```(?:text|json)?\s*/i, '');
    if (!t || /^[{[]/.test(t)) return false;
    return /^(?:The prompt could not be submitted|The prompt contains sensitive words\b|(?:This |Your )?(?:request|prompt|response|content) (?:was|has been|is) (?:blocked|rejected)\b|Blocked (?:by|due to)\b|I(?:'m| am) sorry\b|I can(?:'|no)t\b|I cannot\b|I(?:'m| am) (?:not able|unable) to\b|Sorry, (?:but )?I\b|I won(?:'|)t\b|죄송|申し訳|抱歉|我无法|我不能)/i.test(t);
}

/** 다시 보낼 곳 → { provider, model } | null. 자동은 켜져 있어야 하고, 손으로 누른 것(manual)은 고르기만 했으면 된다 */
export function fallbackTarget(fb, { manual = false } = {}) {
    const f = normFallback(fb);
    if (!manual && !f.enabled) return null;
    return f.provider && f.model ? { provider: f.provider, model: f.model } : null;
}

/** 방금 막힌 곳과 같은 모델인가 — Custom 은 주소까지 같아야 같다 (중계 서버의 같은 이름 ≠ 공식) */
export function sameTarget(failed, target) {
    if (!failed || !target || !failed.model || String(failed.model) !== String(target.model)) return false;
    if (failed.url || target.url) return !!failed.url && failed.url === target.url;
    return !failed.provider || failed.provider === target.provider;
}

/** 다른 모델로 보낼 분석 설정 (실리태번 API 중 선택). Custom 이면 분석의 Custom 주소(비면 실리태번 Custom 주소)를 그대로 */
export function fallbackCfg(cfg, target) {
    const c = isObj(cfg) ? cfg : {};
    return {
        engine: 'provider',
        provider: target.provider,
        provider_models: { [target.provider]: target.model },
        custom_url: target.provider === 'custom' ? str(c.custom_url) : '',
        temperature: c.temperature,
    };
}

const REASON = /PROHIBITED_CONTENT|IMAGE_SAFETY|BLOCKLIST|SPII|RECITATION|SAFETY|content_filter|sensitive words|Candidate text empty|no candidate/i;
const reasonOf = (x) => (x ? msgOf(x).match(REASON)?.[0] || '' : '');
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export const NO_FALLBACK_MESSAGE = '내용 차단으로 보여요. 분석 설정의 「검열되면 다른 모델로」에서 모델을 고르면 그 모델로 다시 보내요';
export const SAME_MODEL_MESSAGE = '분석 모델과 같은 모델이에요. 다른 공급자나 모델을 골라 주세요';

/**
 * 다른 모델로도 안 됐을 때의 오류 — 짧은 한 줄 (토스트는 ' · ' 앞만 보이니 쓰지 않는다).
 * 다른 모델도 거절했으면 「둘 다 거절」, 연결 · 한도 · 키로 실패했으면 그 까닭 (fallback.blocked false — 「다른 모델로 다시」를 남김)
 */
export function fallbackError(original, target, { error = null, failed = null } = {}) {
    const refusedToo = error ? maybeBlocked(error) : true;
    const tag = reasonOf(original) || reasonOf(error);
    const main = String(failed?.model || '').trim() || '분석 모델';
    const why = error && !refusedToo ? clip(msgOf(error).split(' · ')[0], 60) : '';
    const message = refusedToo
        ? `${main}, ${target.model} 둘 다 거절했어요${tag ? ` (${tag})` : ''}`
        : `내용 차단, 다른 모델(${target.model}) 실패: ${why}`;
    const e = new Error(message);
    e.lv = true;
    e.blocked = true;
    e.fallback = { provider: target.provider, model: target.model, blocked: refusedToo };
    return e;
}

/**
 * 분석 요청 하나를 검열 대비와 함께 돌린다.
 *  call(): 원래 길 → 답 (차단이면 throw) · callFallback(target): 다른 모델 길
 *  target: 다시 보낼 곳 — 없으면 원래 길 그대로 (예전과 같음) · failed: 원래 모델 { provider, model, url } — 같은 모델이면 다시 보내지 않는다
 *  refused(reply): 200 으로 온 거절 글을 알아보는 규칙 · via 'fallback': 원래 길을 건너뛰고 다른 모델로 바로 (이미 막힌 메시지 · 「다른 모델로 다시」)
 *  onUsed(target): 다른 모델로 해냈을 때
 * 다른 모델은 한 번만 — 또 막히거나 실패하면 짧은 오류를 던진다. 차단이 아닌 실패(연결 · 429 · 키)는 그대로 던진다.
 * 원래 길이 거절 글(200)로 끝났고 다른 모델이 없으면 그 답을 그대로 돌려준다 (부르는 쪽의 해석 실패 처리가 돈다)
 */
export async function runWithBlockFallback({ call, callFallback, target = null, failed = null, refused = null, via = '', onUsed = null }) {
    if (via === 'fallback') {
        if (!target) throw Object.assign(new Error(NO_FALLBACK_MESSAGE), { lv: true, blocked: true });
        let reply;
        try { reply = await callFallback(target); }
        catch (error) {
            if (error?.name === 'AbortError') throw error;
            throw fallbackError(null, target, { error, failed });
        }
        if (refused && refused(reply)) throw fallbackError(null, target, { failed });
        try { onUsed?.(target); } catch { /* 알림 실패는 결과와 무관 */ }
        return reply;
    }
    let reply, blocked = null;
    try { reply = await call(); }
    catch (error) {
        if (!maybeBlocked(error)) throw error;
        blocked = error;
    }
    if (!blocked && !(refused && refused(reply))) return reply;
    if (!target || sameTarget(failed, target)) {
        if (blocked) throw blocked;
        return reply;
    }
    let second;
    try { second = await callFallback(target); }
    catch (error) {
        if (error?.name === 'AbortError') throw error;
        throw fallbackError(blocked, target, { error, failed });
    }
    if (refused && refused(second)) throw fallbackError(blocked, target, { failed });
    try { onUsed?.(target); } catch { /* 알림 실패는 결과와 무관 */ }
    return second;
}
