import { PRICE_SOURCES } from './pricing.js';
import { PROVIDERS } from './pricing-providers.js';
import { catalogCount } from './pricing-resolve.js';
import { priceSnapshot } from './pricing-live.js';

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 8 });
const dateLabel = value => value ? new Date(value).toLocaleDateString('ko-KR') : '';
function priceFreshness(quote) {
    const old = Date.now() - Date.parse(quote.checked) > 3 * 86400000;
    const state = quote.priceStatus;
    return state === 'review' ? '요금 조건 변경 · 이전 확인 가격' : state === 'error' ? '공식 조회 실패 · 이전 확인 가격' : old ? '갱신 지연 · 이전 확인 가격' : state === 'ok' ? '자동 확인 가격' : '설치본 가격';
}

/** Shared by the current-connection card and each historical request. No network or account access. */
export function priceCard(quote, title = '이 요청의 가격 기준') {
    if (!quote) return '<p class="rl-dim">예전 기록에는 연결처·단가가 저장되지 않았어요. 당시 사용자 가격표로 계산한 비용이에요.</p>';
    const labels = { input:'일반 입력', output:'출력', cacheRead:'캐시 읽기', cacheWrite:'캐시 저장', cacheWrite5m:'캐시 저장 · 5분', cacheWrite1h:'캐시 저장 · 1시간' };
    const currency = quote.currency === 'USD' ? 'US$' : quote.currency;
    const values = Object.entries(labels).filter(([key]) => quote.rates?.[key] != null).map(([key,label]) => `<div><dt>${label}</dt><dd>${esc(currency)}${number(quote.rates[key])}</dd></div>`).join('');
    const url = PRICE_SOURCES[quote.provider];
    const source = ({ official: quote.minimum ? '공식 목록 시작 단가' : '공식 공개 단가', reported:'API 응답 비용', relay:'중계 서버 자동 가격', manual:'사용자 가격표', plan:'구독·크레딧 요금', local:'직접 운영', deployment:'배포·계약별 요금', free:'무료 경로' })[quote.kind] || '단가 미확인';
    const alternatives = quote.alternatives ? `<p class="rl-pricing-note">시간대별 단가 (100만 토큰): ${Object.entries(quote.alternatives.rates).map(([period, rates]) => `${period === 'peak' ? '혼잡' : '그 외'} 입력 ${esc(currency)}${number(rates.input)} · 출력 ${esc(currency)}${number(rates.output)} · 캐시 ${esc(currency)}${number(rates.cacheRead)}`).join(' / ')}</p>` : '';
    return `<section class="rl-pricing-card" aria-label="${esc(title)}">
        <div class="rl-pricing-head"><b>${esc(title)}</b><span>${esc(source)}</span></div>
        <p class="rl-pricing-model">${esc(quote.label)} · <strong>${esc(quote.model || '모델 미선택')}</strong></p>
        ${values ? `<dl class="rl-pricing-rates">${values}</dl><p class="rl-pricing-unit">100만 토큰당 ${esc(quote.currency)}${quote.tier ? ` · ${esc(quote.tier.split(' · ').map(part => ({ standard:'기본 요금', priority:'우선 처리', fast:'Fast', flex:'Flex', batch:'일괄 처리', ultrafast:'Ultrafast' })[part] || part).join(' · '))}` : ''}</p>` : ''}
        ${alternatives}<p class="rl-pricing-note">${esc(quote.note)}</p>
        ${url ? `<p class="rl-pricing-source"><a href="${url}" target="_blank" rel="noopener noreferrer">공식 요금표 보기 ↗</a><span>${quote.checked ? esc(dateLabel(quote.checked))+' 확인 · '+(title==='기본 단가 상세' ? priceFreshness(quote) : '요청 당시 가격 보존') : '공식 요금은 제공처에서 확인하세요'}</span></p>` : ''}
    </section>`;
}

export function addCurrencyCost(group, row, legacyUnit = '$') {
    group.costs ||= {};
    if (!row.priced) return;
    const currency = row.currency || (legacyUnit === '$' ? 'USD' : legacyUnit);
    group.costs[currency] = (group.costs[currency] || 0) + (Number(row.cost) || 0);
}

export function pricePreview(quote) {
    const currency = quote.currency === 'USD' ? 'US$' : quote.currency;
    const summary = quote.rates ? [['input','입력'],['output','출력'],['cacheRead','캐시 읽기']].filter(([key]) => quote.rates[key] != null)
        .map(([key,label]) => `${label} ${esc(currency)}${number(quote.rates[key])}`).join(' · ') : ({ plan:'구독·크레딧 요금', local:'직접 운영 서버', deployment:'배포·계약별 요금' })[quote.kind] || '단가 미확인';
    return `<details class="rl-pricing-preview"><summary>
        <b>현재 연결의 모델 단가</b><span>${esc(quote.label)} · ${esc(quote.model || '모델 미선택')}</span>
        <span>${summary}${quote.rates ? ' / 100만 토큰' : ''}</span><span class="rl-pricing-more">${quote.rates ? priceFreshness(quote)+' · ' : ''}캐시·출처 보기</span>
        </summary>${priceCard(quote, '기본 단가 상세')}<p class="rl-dim">확장 전용 API·긴 문맥·처리 등급은 각 요청을 눌러 확인하세요.</p></details>`;
}

export function providerCoverage() {
    const rows = Object.entries(PROVIDERS).map(([key, info]) => {
        const available = ['anthropic','openai'].includes(key) || catalogCount(key) > 0;
        const mode = info.billing === 'plan' ? '플랜 안내' : info.billing === 'deployment' ? '배포별 확인' : info.billing === 'local' ? '운영 비용 별도' : info.billing === 'free' ? '무료 경로' : available ? '모델 단가' : '공식 요금 확인';
        const snapshot=priceSnapshot(key);
        const freshness=snapshot ? (snapshot.status==='review' ? '조건 확인 필요' : snapshot.status==='error' ? '조회 실패' : snapshot.status==='ok' ? '자동 확인' : '설치본')+' · '+dateLabel(snapshot.checkedAt) : mode;
        return `<li><span>${esc(info.label)}</span><small>${freshness}</small></li>`;
    }).join('');
    return `<details class="rl-provider-coverage"><summary>연결 가능한 API의 요금 안내</summary><p class="rl-dim">실제 연결처의 공식 자료를 하루 한 번 확인해요. 단위·조건·모델 목록이 달라지면 이전 가격을 보존해요. 새 모델·계약·플랜을 확인할 수 없는 요청은 비용 미확인으로 남아요.</p><ul>${rows}</ul><p class="rl-dim">Vertex·Cohere·AI21의 복잡한 표는 원문이 달라지면 검토 후 갱신해요. 구독·개별 계약은 토큰 단가로 환산하지 않아요. 이미 저장한 요청 비용은 바뀌지 않아요.</p></details>`;
}
