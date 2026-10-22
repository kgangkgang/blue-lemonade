// 7.7.2 사용량 장부의 「중계 · 공식 가격 비교」 — 접기를 열 때만 불러온다 (ledger-view.js).
//   new-api / one-api 계열 중계의 공개 가격표(/api/pricing · /api/status, 키 없음)를 「불러오기」 누를 때만 읽어 공식 단가와 견준다.
//   브라우저가 바로 못 읽으면(중계가 CORS 를 안 열어 둠) 실리태번 서버의 /api/search/visit 로 대신 읽는다. 결과는 이 기기에만 둔다.
import { ledgerSettings, query, officialPrice, setRelayRate } from '../../usage-ledger.js';
import { parseRelayPricing, relayQuotaRates, relayUsdRates, relayOrigin, officialProvidersFor, usageByModel, assumedMix, compareRow, krwPerQuotaUsd,
    RELAY_PRICING_PATH, RELAY_STATUS_PATH, MAX_RELAY_BYTES } from '../../relay-prices.js';
import { PROVIDERS, providerAt } from './pricing-providers.js';
import { refreshPrices } from './pricing-sync.js';   // 공식 가격표(매일 갱신)를 비교 전에 최신으로

/** 위안 / 달러 처음 값 — 사용자가 바꾼다 (유럽중앙은행 기준 Frankfurter, 2026-10-21) */
export const DEFAULT_CNY = Object.freeze({ rate: 6.68, date: '2026-10-21', source: 'ECB 기준 (Frankfurter)' });
const CACHE_PREFIX = 'bl-relay-pricing:';
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const won = n => n === null || n === undefined || !Number.isFinite(n) ? '—' : `₩${(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('ko-KR')}`;
const tokens = n => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);
const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };

function compareSettings() {
    const s = ledgerSettings();
    const c = s.compare && typeof s.compare === 'object' && !Array.isArray(s.compare) ? s.compare : (s.compare = {});
    c.origin = relayOrigin(c.origin);
    if (typeof c.group !== 'string') c.group = 'default';
    if (!(Number(c.cnyPerUsd) > 0 && Number(c.cnyPerUsd) < 1000)) c.cnyPerUsd = DEFAULT_CNY.rate;
    if (!(Number(c.quotaPrice) > 0 && Number(c.quotaPrice) < 10000)) c.quotaPrice = null;
    if (!(Number(c.cacheShare) >= 0 && Number(c.cacheShare) <= 100)) c.cacheShare = 0;
    if (!(Number(c.outPerIn) > 0 && Number(c.outPerIn) <= 100)) c.outPerIn = 4;
    return c;
}
const save = () => { try { ctx()?.saveSettingsDebounced?.(); } catch { /* 다음 저장에 */ } };

/** 중계 후보: 장부에 적힌 중계 · 사용자 지정 주소들(경로는 버리고 origin 만). 공식 제공처 주소는 뺀다 */
export function relayCandidates(rows = []) {
    const c = ctx(), es = c?.extensionSettings || {}, out = new Set();
    const add = value => { const o = relayOrigin(value); if (o && providerAt(o) === 'other') out.add(o); };
    for (const row of rows) if (row?.cost?.kind === 'relay' && row.origin) add(row.origin);
    add(c?.chatCompletionSettings?.custom_url); add(es.request_log?.budget?.baseUrl);
    add(es['llm-translator-custom']?.custom_url); add(es.lemon_voice?.analysis?.base); add(es.lemon_voice?.analysis?.custom_url);
    for (const key of Object.keys(ledgerSettings().relayRates || {})) add(key);
    return [...out];
}

/** 공개 GET — 브라우저가 못 읽으면 실리태번 서버의 /api/search/visit (원래 바이트 그대로) */
async function readJson(url, signal) {
    const parse = async response => {
        const size = Number(response.headers.get('content-length'));
        if (size > MAX_RELAY_BYTES) throw new Error('가격표가 너무 커요');
        const body = await response.text();
        if (body.length > MAX_RELAY_BYTES) throw new Error('가격표가 너무 커요');
        return JSON.parse(body);
    };
    try {
        const direct = await fetch(url, { cache: 'no-store', credentials: 'omit', signal });
        if (direct.ok) return await parse(direct);
    } catch (error) { if (error?.name === 'AbortError') throw error; /* CORS · 네트워크 → 서버로 */ }
    const st = ctx();
    const visit = await fetch('/api/search/visit', { method: 'POST', headers: st?.getRequestHeaders?.() || { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, html: false }), signal });
    if (!visit.ok) throw new Error(`가격표를 읽지 못했어요 (HTTP ${visit.status})`);
    return parse(visit);
}

function cacheGet(origin) { try { const v = JSON.parse(localStorage.getItem(CACHE_PREFIX + origin) || 'null'); return v && v.pricing && v.at ? v : null; } catch { return null; } }
function cachePut(origin, value) { try { localStorage.setItem(CACHE_PREFIX + origin, JSON.stringify(value)); } catch { /* 저장 공간 */ } }

export function compareMarkup() {
    return `
        <summary>중계 · 공식 가격 비교</summary>
        <small class="rl-hint">new-api 계열 중계의 공개 가격표를 읽어 공식 API 단가와 견줘요. 「불러오기」를 누를 때만 중계 주소에 요청하고, 키는 쓰지 않아요.</small>
        <label><span>중계</span><input type="text" class="text_pole rl-cmp-origin" list="rl-cmp-origins" placeholder="https://…" autocomplete="off" inputmode="url"></label>
        <datalist id="rl-cmp-origins"></datalist>
        <label><span>그룹</span><select class="text_pole rl-cmp-group"></select></label>
        <div class="rl-budget-nums">
            <label><span>충전</span><span class="rl-cmp-unit">쿼터 $1 =</span><input type="number" class="text_pole rl-cmp-quota" min="0.01" max="9999" step="0.01" inputmode="decimal"><span>¥</span></label>
            <label><span>환율</span><span class="rl-cmp-unit">$1 =</span><input type="number" class="text_pole rl-cmp-cny" min="0.1" max="999" step="0.01" inputmode="decimal"><span>¥</span></label>
        </div>
        <div class="rl-budget-nums">
            <label><span>캐시</span><span class="rl-cmp-unit">입력의</span><input type="number" class="text_pole rl-cmp-cache" min="0" max="100" step="1" inputmode="numeric"><span>%</span></label>
            <label><span>출력</span><span class="rl-cmp-unit">입력 ÷</span><input type="number" class="text_pole rl-cmp-out" min="1" max="100" step="1" inputmode="numeric"></label>
        </div>
        <small class="rl-hint">캐시 · 출력은 장부에 기록이 없는 모델에 쓰는 가정이에요. 기록이 있으면 지난 30일 실제 사용량(입력 · 캐시 · 출력)으로 셈해요.</small>
        <div class="rl-row"><div class="menu_button menu_button_icon rl-cmp-load" role="button" tabindex="0"><i class="fa-solid fa-scale-balanced"></i><span>불러오기</span></div><small class="rl-hint rl-cmp-state"></small></div>
        <div class="rl-cmp-result"></div>`;
}

async function officialFor(model, at) {
    for (const provider of officialProvidersFor(model)) {
        const found = await officialPrice(provider, model.name, at).catch(() => null);
        if (found) return { provider, ...found };
    }
    return null;
}

async function rowsHtml(parsed, settings, krwPerUsd) {
    const group = parsed.groups.find(g => g.id === settings.group) || parsed.groups.find(g => g.id === 'default') || parsed.groups[0];
    const money = { quotaPrice: Number(settings.quotaPrice) > 0 ? Number(settings.quotaPrice) : parsed.recharge.price || 1, currencyPerUsd: Number(settings.cnyPerUsd), krwPerUsd };
    const recent = await query({ from: Date.now() - 30 * 86400000 }).catch(() => []);
    const used = usageByModel(recent), now = Date.now(), later = now + 60 * 86400000;
    const krw = usd => usd === null || usd === undefined ? null : usd * krwPerUsd;
    const lines = [], perRequest = [];
    for (const model of parsed.models) {
        if (model.kind === 'request') { perRequest.push(model); continue; }
        const quota = relayQuotaRates(model, { groupRatio: group.ratio, quotaPerUnit: parsed.recharge.quotaPerUnit });
        const relay = relayUsdRates(quota, money);
        const official = await officialFor(model, now), future = official ? await officialFor(model, later) : null;
        const usage = used.get(model.name.toLowerCase());
        const mix = usage || assumedMix({ cacheShare: settings.cacheShare / 100, outPerIn: settings.outPerIn });
        const cmp = compareRow({ relayUsdRates: relay, officialUsdRates: official?.rates || null, mix });
        lines.push({ model, relay, official, future, usage, mix, cmp, inGroup: !model.groups.length || model.groups.includes(group.id) });
    }
    lines.sort((a, b) => (b.usage?.requests || 0) - (a.usage?.requests || 0) || (a.official ? 0 : 1) - (b.official ? 0 : 1) || a.model.name.localeCompare(b.model.name));
    const rate = r => r ? `입력 ${won(krw(r.input))} · 출력 ${won(krw(r.output))}${Number.isFinite(r.cacheRead) && r.cacheRead !== r.input ? ` · 캐시 ${won(krw(r.cacheRead))}` : ''}` : '';
    const row = l => {
        const o = l.official, cheaper = l.cmp.cheaper;
        const verdict = cheaper === 'relay' ? `<b class="rl-cmp-win">중계가 ${l.cmp.diff}% 쌈</b>` : cheaper === 'official' ? `<b class="rl-cmp-win">공식이 ${l.cmp.diff}% 쌈</b>` : cheaper === 'same' ? '<b>비슷해요</b>' : '<span class="rl-dim">공식 단가 모름</span>';
        const noCache = o && Number.isFinite(o.rates.cacheRead) && o.rates.cacheRead < o.rates.input && !(l.relay.cacheRead < l.relay.input) ? '<small>중계는 캐시 할인 없음</small>' : '';
        const changes = l.future && JSON.stringify(l.future.rates) !== JSON.stringify(o.rates) ? `<small>앞으로 공식 ${esc(rate(l.future.rates))}</small>` : '';
        const basis = l.usage ? `지난 30일 ${l.usage.requests}번 · 입력 ${tokens(l.usage.input)}${l.usage.cachedInput ? ` (캐시 ${Math.round(l.usage.cachedInput / l.usage.input * 100)}%)` : ''} · 출력 ${tokens(l.usage.output)}`
            : `가정: 입력 1M · 캐시 ${settings.cacheShare}% · 출력 ${tokens(l.mix.output)}`;
        return `<tr${l.inGroup ? '' : ' class="rl-dim"'}>
            <td class="rl-td-label">${esc(l.model.name)}${l.inGroup ? '' : ' <small>(이 그룹에서 못 씀)</small>'}</td>
            <td data-label="중계 · 100만 토큰">${esc(rate(l.relay))}</td>
            <td data-label="공식 · 100만 토큰">${o ? `${esc(rate(o.rates))}<small>${esc(PROVIDERS[o.provider]?.label || o.provider)}${o.approx ? ' ≈' : ''}</small>${changes}` : '<span class="rl-dim">—</span>'}</td>
            <td data-label="이만큼 쓰면">${l.cmp.relayUsd !== null ? `중계 ${won(krw(l.cmp.relayUsd))}` : ''}${l.cmp.officialUsd !== null ? `<br>공식 ${won(krw(l.cmp.officialUsd))}` : ''}<small>${esc(basis)}</small></td>
            <td data-label="더 싼 곳">${verdict}${noCache}</td>
        </tr>`;
    };
    const head = '<thead><tr><th>모델</th><th>중계 · 100만 토큰</th><th>공식 · 100만 토큰</th><th>이만큼 쓰면</th><th>더 싼 곳</th></tr></thead>';
    const top = lines.filter(l => l.usage || l.official), rest = lines.filter(l => !(l.usage || l.official));
    const reqList = perRequest.length ? `<details class="rl-budget-adv"><summary>건당 과금 모델 ${perRequest.length}개</summary>${perRequest.map(m => `<small class="rl-hint">${esc(m.name)} · 한 번에 ${won(krw(m.perRequest * group.ratio * money.quotaPrice / money.currencyPerUsd))}</small>`).join('')}</details>` : '';
    return `
        <small class="rl-hint">그룹 ${esc(group.id)} × ${group.ratio} · 쿼터 $1 = ¥${money.quotaPrice} · $1 = ¥${money.currencyPerUsd} · $1 = ${won(krwPerUsd)} — 원화는 이 환산으로 어림한 값이에요.</small>
        <div class="rl-table-wrap"><table class="rl-table rl-cmp-table">${head}<tbody>${top.map(row).join('')}</tbody></table></div>
        ${rest.length ? `<details class="rl-budget-adv"><summary>공식 단가를 모르는 모델 ${rest.length}개</summary><div class="rl-table-wrap"><table class="rl-table rl-cmp-table">${head}<tbody>${rest.map(row).join('')}</tbody></table></div></details>` : ''}
        ${reqList}`;
}

export function bindCompare(box) {
    const $ = selector => box.querySelector(selector);
    const s = compareSettings();
    let parsed = null, busy = null;
    const state = text => { $('.rl-cmp-state').textContent = text; };
    const fill = async () => {
        const rows = await query({ from: Date.now() - 30 * 86400000 }).catch(() => []);
        const list = relayCandidates(rows);
        $('#rl-cmp-origins').innerHTML = list.map(o => `<option value="${esc(o)}"></option>`).join('');
        if (!s.origin && list.length) { s.origin = list[0]; save(); }
        $('.rl-cmp-origin').value = s.origin || '';
    };
    const groups = () => {
        const sel = $('.rl-cmp-group'), list = parsed?.groups || [{ id: s.group || 'default', ratio: 1, note: '' }];
        sel.innerHTML = list.map(g => `<option value="${esc(g.id)}"${g.id === s.group ? ' selected' : ''}>${esc(g.id)} × ${g.ratio}</option>`).join('');
        if (!list.some(g => g.id === s.group)) { s.group = list.find(g => g.id === 'default')?.id || list[0].id; sel.value = s.group; }
        sel.title = list.find(g => g.id === s.group)?.note || '';
    };
    const render = async () => {
        if (!parsed) { $('.rl-cmp-result').innerHTML = ''; return; }
        $('.rl-cmp-quota').value = Number(s.quotaPrice) > 0 ? s.quotaPrice : parsed.recharge.price || 1;
        $('.rl-cmp-result').innerHTML = await rowsHtml(parsed, s, Number(ledgerSettings().krw.rate));
    };
    const remember = () => {
        if (!s.origin || !parsed) return;
        const money = { quotaPrice: Number(s.quotaPrice) > 0 ? Number(s.quotaPrice) : parsed.recharge.price || 1, currencyPerUsd: Number(s.cnyPerUsd), krwPerUsd: Number(ledgerSettings().krw.rate) };
        setRelayRate(s.origin, krwPerQuotaUsd(money), `쿼터 $1 = ¥${money.quotaPrice} · $1 = ¥${money.currencyPerUsd}`);
    };
    const load = async () => {
        const origin = relayOrigin($('.rl-cmp-origin').value);
        if (!origin) { state('중계 주소를 적어 주세요 (https://…)'); return; }
        if (providerAt(origin) !== 'other') { state('공식 API 주소예요 — 중계 주소를 적어 주세요'); return; }
        busy?.abort(); const controller = busy = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        state('불러오는 중…');
        try {
            const [pricing, status] = await Promise.all([readJson(origin + RELAY_PRICING_PATH, controller.signal), readJson(origin + RELAY_STATUS_PATH, controller.signal).catch(() => null), Promise.resolve(refreshPrices()).catch(() => null)]);
            const next = parseRelayPricing(pricing, status);
            if (busy !== controller) return;
            parsed = next; s.origin = origin; save();
            cachePut(origin, { at: Date.now(), pricing: next });
            groups(); remember(); await render();
            state(`${new Date().toLocaleString('ko-KR')} · 모델 ${next.models.length}개`);
        } catch (error) {
            if (busy !== controller) return;
            state(error?.name === 'AbortError' ? '시간이 지나 멈췄어요 (20초)' : String(error?.message || error).slice(0, 120));
        } finally { clearTimeout(timer); if (busy === controller) busy = null; }
    };
    $('.rl-cmp-cny').value = s.cnyPerUsd; $('.rl-cmp-cache').value = s.cacheShare; $('.rl-cmp-out').value = s.outPerIn;
    fill().then(() => {
        const cached = s.origin ? cacheGet(s.origin) : null;
        if (cached) { parsed = cached.pricing; groups(); render(); state(`${new Date(cached.at).toLocaleString('ko-KR')}에 불러온 가격표`); } else groups();
    }).catch(() => {});
    $('.rl-cmp-load').addEventListener('click', load);
    $('.rl-cmp-load').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); load(); } });
    $('.rl-cmp-origin').addEventListener('change', event => { const o = relayOrigin(event.target.value); if (o) { s.origin = o; save(); const cached = cacheGet(o); parsed = cached?.pricing || null; groups(); render(); state(cached ? `${new Date(cached.at).toLocaleString('ko-KR')}에 불러온 가격표` : ''); } });
    $('.rl-cmp-group').addEventListener('change', event => { s.group = event.target.value; save(); groups(); render(); });
    const numberField = (selector, key, min, max) => $(selector).addEventListener('change', event => {
        const n = Number(event.target.value);
        if (n >= min && n <= max) { s[key] = n; save(); if (key === 'cnyPerUsd' || key === 'quotaPrice') remember(); render(); } else event.target.value = s[key] ?? '';
    });
    numberField('.rl-cmp-cny', 'cnyPerUsd', 0.1, 999); numberField('.rl-cmp-quota', 'quotaPrice', 0.01, 9999);
    numberField('.rl-cmp-cache', 'cacheShare', 0, 100); numberField('.rl-cmp-out', 'outPerIn', 1, 100);
}
