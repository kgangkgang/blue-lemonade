// 7.4.0 요청 로그 설정 칸의 「사용량 장부」 — 켜고 끄기 · 원/달러 환율(날짜) · 연결마다 결제 수단 · 오늘 합계 몇 줄
//   장부는 src/usage-ledger.js (허브). 이 화면은 설정만 바꾸고, 기록 · 값 계산은 허브가 한다. 키는 보이지도 받지도 않는다.
import { ledgerSettings, setKrwRate, setPayMethod, summary, query, on, payKeyFor, payMethodFor } from '../../usage-ledger.js';
import { PAY_METHODS, DEFAULT_KRW } from '../../usage-ledger-core.js';

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const won = n => `₩${Math.round(Number(n) || 0).toLocaleString('ko-KR')}`;

export function ledgerMarkup() {
    return `
        <div class="rl-price-head rl-ledger-head"><b>사용량 장부</b><small>확장 · 기능마다 오늘 얼마 썼나 (이 기기에만 90일)</small></div>
        <label class="checkbox_label rl-check" for="rl_ledger_enabled"><input type="checkbox" id="rl_ledger_enabled"><span>사용량 장부 적기</span></label>
        <div class="rl-row rl-numbers">
            <label><span>환율</span><input type="number" class="text_pole rl-ledger-krw" min="1" max="99999" step="0.1" inputmode="decimal"><span>원 / $</span></label>
            <small class="rl-hint rl-ledger-krw-date"></small>
        </div>
        <div class="rl-ledger-pay"></div>
        <small class="rl-hint rl-ledger-today"></small>
        <details class="rl-budget-adv rl-compare"></details>
        <small class="rl-hint">공식 API 는 공식 공개 단가, 중계는 중계 장부의 실제 과금(못 맞추면 중계 단가표 「≈」)으로 따로 셈해요. 결제 수단(크레딧 · 실제 결제 · 중계)은 다른 확장이 영수증 도장으로 써요. 키는 장부에 남지 않아요.</small>`;
}

/** 최근 기록에서 본 연결마다 결제 수단 고르기 */
async function renderPay(box) {
    const rows = await query({ from: Date.now() - 30 * 86400000 }).catch(() => []);
    const seen = new Map();
    for (const row of rows) {
        const key = payKeyFor(row);
        if (seen.has(key)) continue;
        const label = row.cost?.kind === 'relay' ? `중계 · ${row.cost.relay}` : row.cost?.kind === 'official' ? `${row.cost.provider} 공식` : key.replace(/^other:/, '');
        seen.set(key, { key, label, method: payMethodFor(row) });
    }
    if (!seen.size) { box.innerHTML = '<small class="rl-hint">아직 적힌 요청이 없어요. 요청이 적히면 연결마다 결제 수단을 고를 수 있어요.</small>'; return; }
    box.innerHTML = [...seen.values()].map(item => `<label class="rl-row rl-ledger-pay-row" data-pay-key="${esc(item.key)}"><span>${esc(item.label)}</span><select class="text_pole rl-ledger-pay-select">${PAY_METHODS.map(m => `<option value="${esc(m)}"${m === item.method ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>`).join('');
}

async function renderToday(el) {
    const today = await summary({}).catch(() => null);
    if (!today) { el.textContent = ''; return; }
    const top = today.lines.slice(0, 3).map(line => `${line.label}${line.approx ? ' ≈' : ''} ${won(line.krw)}`).join(' · ');
    el.textContent = `오늘 ${won(today.total.krw)} · 요청 ${today.requests}번${today.replies ? ` · 답 ${today.replies}개` : ''}${top ? ` — ${top}` : ''}`;
}

export function bindLedger(drawer) {
    const $ = selector => drawer.querySelector(selector);
    const s = ledgerSettings();
    $('#rl_ledger_enabled').checked = s.enabled !== false;
    $('.rl-ledger-krw').value = s.krw.rate;
    const showDate = () => { const k = ledgerSettings().krw; $('.rl-ledger-krw-date').textContent = `${k.date} 기준${k.source ? ` · ${k.source}` : ''} (처음 값 ${DEFAULT_KRW.rate}원 · ${DEFAULT_KRW.date})`; };
    showDate();
    $('#rl_ledger_enabled').addEventListener('change', event => { ledgerSettings().enabled = event.target.checked; globalThis.SillyTavern?.getContext?.()?.saveSettingsDebounced?.(); });
    $('.rl-ledger-krw').addEventListener('change', event => {
        if (!setKrwRate(event.target.value)) event.target.value = ledgerSettings().krw.rate;
        showDate();
    });
    $('.rl-ledger-pay').addEventListener('change', event => {
        const row = event.target.closest('[data-pay-key]');
        if (row) setPayMethod(row.dataset.payKey, event.target.value);
    });
    // 7.7.2 중계 · 공식 가격 비교 — 처음 열 때만 불러온다
    const compare = $('.rl-compare');
    if (compare) {
        compare.innerHTML = '<summary>중계 · 공식 가격 비교</summary>';
        compare.addEventListener('toggle', () => {
            if (!compare.open || compare.dataset.ready) return;
            compare.dataset.ready = '1';
            import('./relay-compare-view.js').then(m => { compare.innerHTML = m.compareMarkup(); compare.open = true; m.bindCompare(compare); })
                .catch(error => { compare.dataset.ready = ''; console.warn('[요청 로그] 가격 비교', error); });
        });
    }
    const refresh = () => { renderPay($('.rl-ledger-pay')).catch(() => {}); renderToday($('.rl-ledger-today')).catch(() => {}); };
    refresh();
    let timer = 0;
    on('change', () => { if (!drawer.isConnected) return; clearTimeout(timer); timer = setTimeout(refresh, 1500); });
}
