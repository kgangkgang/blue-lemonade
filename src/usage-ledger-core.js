// 7.4.0 사용량 장부 — 순수 계산 (node 로 시험: tools/tests/usage-ledger-740.mjs). 저장 · 화면 · 가격표 읽기는 usage-ledger.js.
//
// 기록 한 건(entry)은 확장이 준 숫자만 · 정해진 칸만 남긴다. 키 · 토큰 · 비밀 글은 칸이 없고, 모양이 비밀처럼 보이는 글은 버린다.
// 토큰 칸 뜻 (두 번 세지 않기):
//   input  = 보낸 입력 전체(캐시로 읽은 몫 포함) · cachedInput = 그중 캐시 몫
//   output = 청구되는 출력 전체(생각 포함) · thinking = 그중 생각 몫(정보용 — 값에 더하지 않음)
//   값 = (input − cachedInput) × 입력 단가 + cachedInput × 캐시 단가 + output × 출력 단가
// 가격은 기록 시각의 단가로, 요청이 실제로 나간 연결(공식 API · 중계)의 표로 셈한다. 공식과 중계는 한 줄에 섞지 않는다.

import { CHAT_PROVIDER, PROVIDERS, providerAt } from './addons/perf/pricing-providers.js';

export const LEDGER_SYMBOL = Symbol.for('blue-lemonade.usage');
export const LEDGER_VERSION = 1;
export const KEEP_DAYS = 90;
export const PAY_METHODS = Object.freeze(['크레딧', '실제 결제', '중계']);
/** 원/달러 기본값 — 사용자가 설정에서 바꾼다 (서울외국환중개 매매기준율, 돈 지도 2026-10-20) */
export const DEFAULT_KRW = Object.freeze({ rate: 1332.1, date: '2026-10-20', source: '서울외국환중개 매매기준율 (2026-10-20)' });

// ── 날짜별 단가 (기록 시각으로 고른다) ──
// BL 가격표(공식 공개 단가, 매일 갱신)에 없는 기간만 여기 둔다. approx: 공식 확인이 안 된 값 → 줄에 「≈」와 note.
export const EFFECTIVE_PRICES = Object.freeze([
    Object.freeze({ provider: 'gemini', model: 'gemini-4-argon', from: '2026-12-01', rates: Object.freeze({ input: 4, output: 20, cacheRead: 0.2 }),
        source: 'https://ai.google.dev/gemini-api/docs/pricing', date: '2026-10-20', note: 'Gemini API 공식 가격표의 12월 1일부터 단가' }),
    Object.freeze({ provider: 'vertex', model: 'gemini-4-argon', from: '2026-12-01', rates: Object.freeze({ input: 4, output: 20, cacheRead: 0.2 }),
        source: 'https://ai.google.dev/gemini-api/docs/pricing', date: '2026-10-20', approx: true, note: '≈ Vertex 미확인 — Vertex 가격표에서 12월 단가를 확인하지 못해 Gemini API 단가로 셌어요' }),
]);

const SECRET = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}|\bAIza[0-9A-Za-z_-]{20,}|\bBearer\s+\S|\b(?:api[_-]?key|access[_-]?token|secret|password|authorization)\s*[:=]|\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.|[A-Fa-f0-9]{40,}|[A-Za-z0-9+/_-]{48,}/i;
const str = (value, max) => {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const text = String(value).replace(/\s+/g, ' ').trim().slice(0, max);
    return SECRET.test(text) ? '' : text;
};
const int = value => { const n = Math.round(Number(value)); return Number.isFinite(n) && n > 0 ? Math.min(n, 1e10) : 0; };
const money = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 && n < 1e6 ? n : null; };

/** 주소에서 origin 만 (경로 · 검색어 · 계정 정보 · 키는 버린다). http(s) 가 아니면 '' */
export function originOf(value) {
    if (typeof value !== 'string' || !value) return '';
    try {
        const url = new URL(value);
        if (!['https:', 'http:'].includes(url.protocol)) return '';
        return url.origin;
    } catch { return ''; }
}

/**
 * 받은 기록 한 건 → 남길 모양. 모르는 칸은 버리고, 숫자는 0 이상 정수, 글은 길이 제한 · 비밀처럼 보이면 버림. 못 쓰는 기록은 null.
 * 기록하는 쪽이 줄 수 있는 칸: ext · feature · model · api · origin(요청 주소 — origin 만 남김) · input · output · cachedInput · thinking ·
 *   characters(글자 과금 엔진) · estimated · ok · at · chatId · mesId · reportedUsd(응답이 알려 준 요청 비용, USD)
 */
export function normalizeEntry(raw, now = Date.now()) {
    if (!raw || typeof raw !== 'object') return null;
    const ext = str(raw.ext, 40), feature = str(raw.feature, 60);
    if (!ext || !feature) return null;
    const at = Number(raw.at);
    const entry = {
        ext, feature,
        model: str(raw.model, 120).replace(/^models\//, ''),
        api: str(raw.api, 40).toLowerCase().replace(/[^a-z0-9_.-]/g, ''),
        origin: originOf(raw.origin),
        input: int(raw.input), output: int(raw.output), cachedInput: int(raw.cachedInput), thinking: int(raw.thinking), characters: int(raw.characters),
        estimated: raw.estimated === true, ok: raw.ok !== false,
        at: Number.isFinite(at) && at > 0 && at <= now + 86400000 ? Math.round(at) : now,
    };
    if (entry.cachedInput > entry.input) entry.cachedInput = entry.input;   // 캐시 몫은 입력 안에 있다
    if (entry.thinking > entry.output) entry.output = entry.thinking;       // 생각은 출력 안에 있다 (따로 온 생각을 더하지 않은 기록이면 출력을 그만큼으로)
    const chatId = str(raw.chatId, 200); if (chatId) entry.chatId = chatId;
    const mesId = Number(raw.mesId); if (Number.isInteger(mesId) && mesId >= 0) entry.mesId = mesId;
    const reported = money(raw.reportedUsd); if (reported !== null) entry.reportedUsd = reported;
    const requestId = str(raw.requestId, 80); if (requestId) entry.requestId = requestId;
    const provider = str(raw.provider, 40); if (provider && (PROVIDERS[provider] || provider === 'other')) entry.provider = provider;
    return entry;
}

/** 이 기기 날짜 'YYYY-MM-DD' */
export function dayKey(at) {
    const d = new Date(at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' (이 기기 날짜)의 시작 시각 */
export function dayStart(day) {
    const [y, m, d] = String(day).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
}

/**
 * 요청이 나간 연결: { kind: 'official' | 'relay' | 'unknown', provider, origin, host }
 * origin 이 중계 주소 목록(relays — 예산 기능에 넣은 중계 서버)에 있으면 중계. origin 이 공식 API 주소면 그 제공처.
 * origin 이 없으면 api(실리태번 연결 종류: vertexai · claude · makersuite …)로 공식 제공처를 고른다 — 'custom' 은 모름.
 */
export function connectionOf(entry, relays = []) {
    const origin = entry.origin || '';
    const host = origin ? new URL(origin).host : '';
    if (origin && relays.includes(origin)) return { kind: 'relay', provider: 'other', origin, host };
    if (origin) {
        const provider = entry.provider && entry.provider !== 'other' ? entry.provider : providerAt(origin);
        return provider === 'other' ? { kind: 'unknown', provider, origin, host } : { kind: 'official', provider, origin, host };
    }
    const provider = entry.provider && entry.provider !== 'other' ? entry.provider : (CHAT_PROVIDER[entry.api] || (PROVIDERS[entry.api] ? entry.api : ''));
    return provider ? { kind: 'official', provider, origin: '', host: '' } : { kind: 'unknown', provider: 'other', origin: '', host: '' };
}

/** 결제 수단 열쇠: 공식 = 제공처 id, 중계 = 'relay:<host>', 모름 = 'other:<host>' */
export const payKeyOf = conn => conn.kind === 'relay' ? `relay:${conn.host}` : conn.kind === 'official' ? conn.provider : `other:${conn.host || '?'}`;
/** 기본 결제 수단 (사용자 10-20): Vertex · Anthropic 공식 = 크레딧, 중계 = 중계, 그 밖 = 실제 결제 */
export function defaultPayMethod(conn) {
    if (conn.kind === 'relay') return '중계';
    if (conn.kind === 'official' && (conn.provider === 'vertex' || conn.provider === 'anthropic')) return '크레딧';
    return '실제 결제';
}
export function payMethodOf(conn, overrides = {}) {
    const set = overrides?.[payKeyOf(conn)];
    return PAY_METHODS.includes(set) ? set : defaultPayMethod(conn);
}

/**
 * 공식 단가 { input, output, cacheRead } (USD / 100만 토큰) + 출처. 날짜별 표(EFFECTIVE_PRICES)가 먼저, 그다음 BL 가격표(lookup).
 * lookup(provider, model, at) → { rates, source, date, note?, approx? } | null (usage-ledger.js 가 BL 가격표로 만든다)
 */
export function officialRates(provider, model, at, lookup) {
    const id = String(model || '').replace(/^models\//, '').replace(/^google\//, '');
    const dated = EFFECTIVE_PRICES.filter(row => row.provider === provider && row.model === id && at >= dayStart(row.from)).sort((a, b) => b.from.localeCompare(a.from))[0];
    if (dated) return { rates: dated.rates, source: dated.source, date: dated.date, note: dated.note, approx: !!dated.approx };
    const found = lookup ? lookup(provider, id, at) : null;
    return found?.rates && Number.isFinite(found.rates.input) && Number.isFinite(found.rates.output) ? found : null;
}

/** 토큰 값 (USD). 캐시 단가가 없으면 캐시 몫도 입력 단가로 (더 비싼 쪽 — 모자라게 세지 않음) */
export function tokenCost(entry, rates) {
    const cached = Math.min(entry.cachedInput || 0, entry.input || 0);
    const cachedRate = Number.isFinite(rates.cacheRead) ? rates.cacheRead : rates.input;
    return ((entry.input - cached) * rates.input + cached * cachedRate + entry.output * rates.output) / 1e6;
}

/**
 * 기록 한 건의 값: { usd, krw, priceSource, priceDate, estimated, approx, kind, relay, payMethod, note }
 * ctx: { lookup, relays, relayPrices: { [model]: { input, output, origin } }, quotaPerUnit, payMethods, krw: { rate, date, source }, relayKrw?: { rate, source } }
 *   - 중계: 중계 장부와 맞춘 실제 과금(entry.relayQuota)이 있으면 그 값(쿼터 달러), 없으면 BL 중계 단가표(같은 origin)로 「≈」
 *   - 공식: 응답이 알려 준 비용(reportedUsd) > 날짜별 · BL 공식 단가
 *   - 글자 과금(characters 만 있는 기록)은 단가를 모르면 값 없음 (usd null)
 */
export function costOf(entry, ctx = {}) {
    const conn = connectionOf(entry, ctx.relays || []);
    const payMethod = payMethodOf(conn, ctx.payMethods);
    const krwRate = Number(ctx.krw?.rate) > 0 ? Number(ctx.krw.rate) : DEFAULT_KRW.rate;
    const base = { kind: conn.kind, relay: conn.kind === 'relay' ? conn.host : '', provider: conn.provider, payMethod, estimated: !!entry.estimated, approx: !!entry.estimated, usd: null, krw: null, priceSource: '', priceDate: '', note: '' };
    const finish = (usd, extra = {}) => {
        const out = { ...base, ...extra };
        if (usd === null || !Number.isFinite(usd)) return out;
        const rate = conn.kind === 'relay' && Number(ctx.relayKrw?.rate) > 0 ? Number(ctx.relayKrw.rate) : krwRate;
        return { ...out, usd, krw: Math.round(usd * rate), krwRate: rate,
            krwNote: conn.kind === 'relay' ? (ctx.relayKrw?.rate > 0 ? `중계 환산 ${ctx.relayKrw.source || ''}`.trim() : `쿼터 달러 × 설정 환율 ${rate}원 (가정)`) : `설정 환율 ${rate}원 (${ctx.krw?.date || DEFAULT_KRW.date})` };
    };
    if (conn.kind === 'relay') {
        const per = Number(ctx.quotaPerUnit) > 0 ? Number(ctx.quotaPerUnit) : 500000;
        if (Number.isFinite(entry.relayQuota) && entry.relayQuota >= 0) return finish(entry.relayQuota / per, { priceSource: '중계 장부 (실제 과금)', approx: false, estimated: false, note: '중계가 기록한 과금(쿼터 달러)' });
        const row = ctx.relayPrices?.[entry.model];
        if (row && (!row.origin || row.origin === conn.origin) && Number.isFinite(row.input) && Number.isFinite(row.output)) {
            return finish(((entry.input) * row.input + entry.output * row.output) / 1e6, { priceSource: '중계 단가표 (예산 기능)', approx: true, note: '중계 장부와 아직 맞추지 못해 중계 단가표로 어림했어요' });
        }
        return finish(null, { note: '중계 단가를 몰라요' });
    }
    if (entry.reportedUsd !== undefined) return finish(entry.reportedUsd, { priceSource: '응답이 알려 준 비용' });
    if (!entry.input && !entry.output) return finish(entry.characters ? null : 0, { note: entry.characters ? `글자 ${entry.characters}자 — 글자 단가 미확인` : '' });
    if (conn.kind !== 'official') {
        // 공식 단가를 모르는 연결: 사용자가 요청 로그에 직접 적은 가격(자동 아님)이 있으면 그것으로 「≈」
        const row = ctx.relayPrices?.[entry.model];
        if (row && row.auto !== true && Number.isFinite(row.input) && Number.isFinite(row.output)) return finish((entry.input * row.input + entry.output * row.output) / 1e6, { priceSource: '직접 지정 가격표', approx: true, note: '요청 로그에 직접 적은 가격으로 어림했어요' });
        return finish(null, { note: '연결처 단가를 몰라요' });
    }
    const found = officialRates(conn.provider, entry.model, entry.at, ctx.lookup);
    if (!found) return finish(null, { note: '공식 가격표에서 이 모델 단가를 찾지 못했어요' });
    return finish(tokenCost(entry, found.rates), { priceSource: found.source || '', priceDate: found.date || '', approx: base.approx || !!found.approx, note: found.note || '' });
}

/**
 * 중계 장부(new-api /api/log/token 의 기록)와 장부의 중계 요청을 맞춘다 → Map(장부 id → { quota, logId }).
 * 같은 모델 · 시각(요청 시작 −10초 ~ +10분) · 입력 토큰(±3% 또는 ±20) · 출력 토큰(±5% 또는 ±20)인 것 중 시각이 가장 가까운 것, 한 번씩만.
 */
export function matchRelayLogs(entries, logs, { origin = '' } = {}) {
    const out = new Map(), used = new Set();
    const near = (a, b, pct, abs) => Math.abs(a - b) <= Math.max(abs, Math.abs(b) * pct);
    const norm = m => String(m || '').replace(/^models\//, '').replace(/^[a-z0-9-]+\//, '').toLowerCase();
    const list = (logs || []).filter(log => (log.type === undefined || log.type === 2) && Number(log.quota) >= 0)
        .map((log, i) => ({ i, id: log.id ?? i, at: Number(log.created_at) * 1000, model: norm(log.model_name), input: Number(log.prompt_tokens) || 0, output: Number(log.completion_tokens) || 0, quota: Number(log.quota) || 0 }));
    for (const entry of [...entries].sort((a, b) => a.at - b.at)) {
        if (entry.relayQuota !== undefined || (origin && entry.origin !== origin)) continue;
        let best = null;
        for (const log of list) {
            if (used.has(log.i) || log.model !== norm(entry.model)) continue;
            if (log.at < entry.at - 10000 || log.at > entry.at + 600000) continue;
            if (!near(log.input, entry.input, 0.03, 20) || !near(log.output, entry.output, 0.05, 20)) continue;
            if (!best || Math.abs(log.at - entry.at) < Math.abs(best.at - entry.at)) best = log;
        }
        if (best) { used.add(best.i); out.set(entry.id, { quota: best.quota, logId: String(best.id) }); }
    }
    return out;
}

/**
 * 합계: 줄은 (확장 · 기능 · 모델 · 연결 종류(공식/중계 host) · 결제 수단)마다 — 공식과 중계를 한 줄에 섞지 않는다. 값이 큰 줄부터.
 * priced: costOf 를 붙인 기록 목록 ([{ ...entry, cost }])
 */
export function summarize(priced, { mainExt = '실리태번', mainFeature = '본 답' } = {}) {
    const total = { usd: 0, krw: 0, unknown: 0 };
    const lines = new Map(), byExt = {}, byModel = {}, byFeature = {}, replies = new Map();
    const blank = () => ({ usd: 0, krw: 0, requests: 0, input: 0, output: 0, cachedInput: 0, thinking: 0, characters: 0, approx: false, unknown: 0 });
    const tally = (row, entry, cost) => {
        row.requests++; row.input += entry.input; row.output += entry.output; row.cachedInput += entry.cachedInput; row.thinking += entry.thinking; row.characters += entry.characters;
        if (cost.usd === null || cost.usd === undefined) row.unknown++; else { row.usd += cost.usd; row.krw += cost.krw; }
        if (cost.approx) row.approx = true;
        return row;
    };
    for (const entry of priced) {
        const cost = entry.cost || {};
        if (cost.usd === null || cost.usd === undefined) total.unknown++; else { total.usd += cost.usd; total.krw += cost.krw; }
        const tag = cost.kind === 'relay' ? `(중계 · ${cost.relay})` : '';
        const label = `${entry.ext} · ${entry.feature}${tag ? ` ${tag}` : ''}`;
        const lineKey = JSON.stringify([entry.ext, entry.feature, entry.model, cost.kind === 'relay' ? `relay:${cost.relay}` : cost.kind, cost.payMethod]);
        if (!lines.has(lineKey)) lines.set(lineKey, { ext: entry.ext, feature: entry.feature, model: entry.model, kind: cost.kind, relay: cost.relay || '', tag, payMethod: cost.payMethod, label, ...blank() });
        tally(lines.get(lineKey), entry, cost);
        tally(byExt[entry.ext] ??= blank(), entry, cost);
        tally(byModel[entry.model || '?'] ??= blank(), entry, cost);
        tally(byFeature[label] ??= blank(), entry, cost);
        if (entry.chatId && entry.mesId !== undefined) {
            const key = `${entry.chatId}#${entry.mesId}`;
            const reply = replies.get(key) ?? { chatId: entry.chatId, mesId: entry.mesId, at: entry.at, usd: 0, krw: 0, parts: {} };
            if (cost.usd !== null && cost.usd !== undefined) { reply.usd += cost.usd; reply.krw += cost.krw; reply.parts[label] = (reply.parts[label] || 0) + cost.usd; }
            reply.at = Math.min(reply.at, entry.at);
            replies.set(key, reply);
        }
    }
    const lineList = [...lines.values()].sort((a, b) => b.usd - a.usd || b.requests - a.requests);
    for (const line of lineList) {
        line.krw = Math.round(line.krw);
        if (line.ext === mainExt && line.feature === mainFeature) { line.replies = line.requests; line.perReplyUsd = line.requests ? line.usd / line.requests : 0; line.perReplyKrw = line.requests ? Math.round(line.krw / line.requests) : 0; }
    }
    let topReply = null;
    for (const reply of replies.values()) if (!topReply || reply.usd > topReply.usd) topReply = reply;
    if (topReply) topReply = { ...topReply, krw: Math.round(topReply.krw), biggest: Object.entries(topReply.parts).sort((a, b) => b[1] - a[1])[0]?.[0] || '' };
    const mainReplies = priced.filter(entry => entry.ext === mainExt && entry.feature === mainFeature && entry.ok !== false).length;
    total.krw = Math.round(total.krw);
    return { total, requests: priced.length, replies: mainReplies, lines: lineList, byExt, byFeature, byModel, topReply };
}
