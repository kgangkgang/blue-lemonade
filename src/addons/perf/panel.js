// 요청 로그 — 설정 서랍, 마법봉 메뉴, 로그·집계 창
import { purposeLabel, PURPOSES } from './attribution.js';
import { pane } from './hub.js';
import { callGenericPopup, POPUP_TYPE, POPUP_RESULT } from '../../../../../../popup.js';
import { TITLE, VERSION, settings, saveSettings, costOf, callerLabel, typeLabel, money } from './state.js';
import { listEntries, getEntry, listDaily, clearEntries, clearDaily, repriceDaily, dayKeyOf, isMemoryOnly, trimEntries } from './store.js';
import { onEntry } from './capture.js';
import * as budget from './budget.js';

const PAGE = 100;

function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));
}

function toast(kind, message, options = {}) {
    if (typeof toastr !== 'undefined') toastr[kind](message, TITLE, { timeOut: kind === 'success' ? 1800 : 3000, ...options });
}

const number = value => (Number(value) || 0).toLocaleString('ko-KR');

function seconds(ms) {
    if (ms === null || ms === undefined) return '';
    return ms >= 10000 ? `${Math.round(ms / 1000)}s` : `${(ms / 1000).toFixed(1)}s`;
}

const pad = value => String(value).padStart(2, '0');

function timeOf(at) {
    const date = new Date(at);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dateTimeOf(at) {
    const date = new Date(at);
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${timeOf(at)}`;
}

function statusOf(entry) {
    if (entry.aborted) return { className: 'is-aborted', icon: 'fa-ban', label: '중단' };
    if (!entry.ok) return { className: 'is-error', icon: 'fa-triangle-exclamation', label: '오류' };
    return { className: 'is-ok', icon: 'fa-check', label: '성공' };
}

function titleOf(entry) {
    const type = entry.caller === 'chat' ? typeLabel(entry.type) : '';
    return `${callerLabel(entry.caller)} · ${purposeLabel(entry.purpose)}${type ? ` · ${type}` : ''}`;
}

// ── 설정 서랍 ───────────────────────────────────────────────

let drawer = null;

export function buildDrawer() {
    const container = pane('log'); // 2.0.0 톱니바퀴 설정 창의 탭 (hub.js)
    if (!container || drawer) return;
    drawer = document.createElement('div');
    drawer.id = 'request_log_settings';
    drawer.className = 'rl-settings';
    drawer.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-receipt"></i> ${TITLE} <span class="rl-version ext-version">v${VERSION}</span></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="rl-body">
                    <small class="rl-hint">실리태번과 확장이 보내는 API 요청을 이 기기에 기록해요. 마법봉 메뉴의 ${TITLE}에서 봐요.</small>
                    <div class="rl-row">
                        <label class="checkbox_label rl-check" for="rl_enabled"><input type="checkbox" id="rl_enabled"><span>기록하기</span></label>
                        <div class="menu_button menu_button_icon rl-open"><i class="fa-solid fa-receipt"></i><span>열기</span></div>
                    </div>
                    <div class="rl-row rl-numbers">
                        <label><span>본문 보관</span><input type="number" class="text_pole rl-keep" min="0" max="500" step="1"><span>개</span></label>
                        <label><span>기록 보관</span><input type="number" class="text_pole rl-max" min="20" max="5000" step="10"><span>개</span></label>
                    </div>
                    <small class="rl-hint">본문 보관 수를 넘긴 요청은 프롬프트·응답 글은 지워지고 토큰 수만 남아요. 날짜별 집계는 지워지지 않아요.</small>
                    <div class="rl-price-head">
                        <b>가격표</b><small>100만 토큰당</small>
                        <label class="rl-unit"><span>단위</span><input type="text" class="text_pole rl-unit-input" maxlength="4"></label>
                    </div>
                    <div class="rl-price-list"></div>
                    <div class="rl-row rl-price-add">
                        <input type="text" class="text_pole rl-price-model" placeholder="모델 이름" autocomplete="off">
                        <input type="number" class="text_pole rl-price-in" placeholder="입력" min="0" step="0.01" inputmode="decimal">
                        <input type="number" class="text_pole rl-price-out" placeholder="출력" min="0" step="0.01" inputmode="decimal">
                        <div class="menu_button menu_button_icon rl-price-save"><i class="fa-solid fa-plus"></i></div>
                    </div>
                    <small class="rl-hint">가격표 이름이 모델 이름의 앞부분과 같아도 맞춰 써요. 가격을 고치면 지난 집계의 비용도 다시 계산해요. "자동"은 아래 예산 연동이 중계 서버의 배율로 채운 가격이고, 직접 고치면 그때부터는 자동으로 바꾸지 않아요.</small>
                    <div class="rl-price-head rl-budget-head">
                        <b>예산</b><small>중계 서버(new-api 계열)의 실제 과금·잔액</small>
                    </div>
                    <label class="checkbox_label rl-check" for="rl_budget_enabled"><input type="checkbox" id="rl_budget_enabled"><span>중계 서버에서 사용량 가져오기</span></label>
                    <div class="rl-budget-fields">
                        <label><span>서버 주소</span><input type="text" class="text_pole rl-b-url" placeholder="비우면 사용자 지정 API 주소의 서버" autocomplete="off"></label>
                        <label><span>API 키</span><input type="password" class="text_pole rl-b-key" placeholder="sk-…" autocomplete="off"></label>
                        <div class="rl-budget-nums">
                            <label><span>예산</span><input type="number" class="text_pole rl-b-amount" min="0" step="0.01" inputmode="decimal"></label>
                            <label><span>경고</span><input type="number" class="text_pole rl-b-warn" min="1" max="100" step="1"><span>% 쓰면</span></label>
                            <label><span>하루 한도</span><input type="number" class="text_pole rl-b-daily" min="0" step="0.01" inputmode="decimal"></label>
                        </div>
                        <details class="rl-budget-adv">
                            <summary>계정 토큰 (선택)</summary>
                            <label><span>액세스 토큰</span><input type="password" class="text_pole rl-b-access" autocomplete="off"></label>
                            <label><span>사용자 ID</span><input type="text" class="text_pole rl-b-user" inputmode="numeric" autocomplete="off"></label>
                            <small class="rl-hint">콘솔 → 개인 설정 → 시스템 액세스 토큰. 넣으면 계정의 실제 잔액을 그대로 보여 줘요.</small>
                        </details>
                    </div>
                    <div class="rl-row">
                        <div class="menu_button menu_button_icon rl-b-test"><i class="fa-solid fa-plug"></i><span>연결 확인</span></div>
                        <div class="menu_button menu_button_icon rl-b-reset"><i class="fa-solid fa-flag"></i><span>지금부터 다시 세기</span></div>
                    </div>
                    <small class="rl-hint rl-b-warning" hidden></small>
                    <small class="rl-hint">예산에는 충전한 금액을 적어요. 기준 시점 이후 쓴 금액을 예산에서 빼서 잔액을 계산하고, 경고 비율이나 하루 한도를 넘으면 한 번 알려요. 키는 settings.json에 저장돼요.</small>
                    <div class="rl-row rl-danger-row">
                        <div class="menu_button menu_button_icon rl-clear"><i class="fa-solid fa-broom"></i><span>기록 비우기</span></div>
                    </div>
                </div>
            </div>
        </div>`;
    container.append(drawer);

    const $ = selector => drawer.querySelector(selector);
    const store = settings();
    $('#rl_enabled').checked = store.enabled;
    $('.rl-keep').value = store.keepBodies;
    $('.rl-max').value = store.maxEntries;
    $('.rl-unit-input').value = store.unit;

    $('#rl_enabled').addEventListener('change', (event) => {
        store.enabled = event.target.checked;
        saveSettings();
    });
    $('.rl-keep').addEventListener('change', (event) => {
        store.keepBodies = Math.min(500, Math.max(0, Number.parseInt(event.target.value, 10) || 0));
        event.target.value = store.keepBodies;
        saveSettings();
        trimEntries().catch(() => {});
    });
    $('.rl-max').addEventListener('change', (event) => {
        store.maxEntries = Math.min(5000, Math.max(20, Number.parseInt(event.target.value, 10) || 20));
        event.target.value = store.maxEntries;
        saveSettings();
        trimEntries().catch(() => {});
    });
    $('.rl-unit-input').addEventListener('change', (event) => {
        store.unit = event.target.value.trim().slice(0, 4) || '$';
        event.target.value = store.unit;
        saveSettings();
    });
    $('.rl-open').addEventListener('click', () => openDialog());
    // 긴 안내 글은 두 줄까지만 — 누르면 펴진다 (테마 4.1.2)
    drawer.addEventListener('click', (event) => { const hint = event.target.closest?.('.rl-hint'); if (hint && !event.target.closest('a,button,input')) hint.classList.toggle('is-open'); });
    $('.rl-price-save').addEventListener('click', onPriceAdd);
    for (const selector of ['.rl-price-model', '.rl-price-in', '.rl-price-out']) {
        $(selector).addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); onPriceAdd(); }
        });
    }
    $('.rl-price-list').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-act]');
        if (!button) return;
        const row = button.closest('[data-model]');
        const model = row?.dataset.model;
        if (!model) return;
        if (button.dataset.act === 'delete') {
            delete store.prices[model];
            saveSettings();
            renderPrices();
            await repriceDaily(costOf);
        } else if (button.dataset.act === 'edit') {
            $('.rl-price-model').value = model;
            $('.rl-price-in').value = store.prices[model].input;
            $('.rl-price-out').value = store.prices[model].output;
            $('.rl-price-in').focus();
        }
    });
    $('.rl-clear').addEventListener('click', async () => {
        const result = await callGenericPopup('요청 기록과 날짜별 집계를 모두 지울까요? 되돌릴 수 없어요.', POPUP_TYPE.CONFIRM, '', { okButton: '비우기', cancelButton: '취소' });
        if (result !== POPUP_RESULT.AFFIRMATIVE) return;
        await clearEntries();
        await clearDaily();
        toast('success', '기록을 비웠어요.');
        if (dialog) dialog.reload();
    });

    renderPrices();
    wireBudgetSettings();
}

/**
 * [1.2.1] 본체 API 주소를 물려받는 중인데 그 주소가 키를 넣었을 때와 달라지면,
 * 키를 다른 업체로 보내지 않고 멈춘 뒤 이렇게 알려 준다.
 */
function renderBudgetWarning() {
    const box = drawer?.querySelector('.rl-b-warning');
    if (!box) return;
    const changed = budget.inheritedHostChanged();
    box.hidden = !changed;
    if (changed) {
        box.textContent = `본체의 API 주소가 키를 넣을 때와 달라졌어요. 다른 서버로 키가 가지 않게 조회를 멈췄어요. 같은 서버가 맞으면 API 키 칸을 한 번 저장하고, 아니면 서버 주소를 직접 적어 주세요.`;
    }
}

// 예산 설정 (1.2.0)
function wireBudgetSettings() {
    const $ = selector => drawer.querySelector(selector);
    const conf = budget.config();
    $('#rl_budget_enabled').checked = conf.enabled;
    $('.rl-b-url').value = conf.baseUrl;
    $('.rl-b-key').value = conf.key;
    $('.rl-b-amount').value = conf.amount || '';
    $('.rl-b-warn').value = conf.warnPercent;
    $('.rl-b-daily').value = conf.dailyLimit || '';
    $('.rl-b-access').value = conf.accessToken;
    $('.rl-b-user').value = conf.userId;
    drawer.querySelector('.rl-budget-fields').hidden = !conf.enabled;
    // 중계 서버 배율로 가격표가 자동으로 채워지면 목록을 다시 그린다
    budget.onBudget(() => { renderPrices(); renderBudgetWarning(); });
    renderBudgetWarning();

    const positive = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    $('#rl_budget_enabled').addEventListener('change', (event) => {
        conf.enabled = event.target.checked;
        drawer.querySelector('.rl-budget-fields').hidden = !conf.enabled;
        saveSettings();
        // [1.2.2] 껐다 켤 때마다 force로 부르면 4분 간격을 건너뛰어 조회 몫을 쓴다. 처음 켤 때는 받은 적이 없어 바로 가져온다
        if (conf.enabled) budget.refresh().catch(() => {});
    });
    $('.rl-b-url').addEventListener('change', (event) => {
        conf.baseUrl = event.target.value.trim().replace(/\/+$/, '');
        event.target.value = conf.baseUrl;
        budget.rememberKeyHost(); // [1.2.1] 주소를 직접 적었으면 물려받기 감시는 끈다
        renderBudgetWarning();
    });
    $('.rl-b-key').addEventListener('change', (event) => {
        const key = event.target.value.trim();
        if (key !== conf.key) {
            // 키가 바뀌면 누적 사용량도 다른 키의 것이라 기준을 새로 잡는다
            conf.baselineUsed = null;
            conf.baselineAt = null;
            conf.alerted = null;
        }
        conf.key = key;
        budget.rememberKeyHost(); // [1.2.1] 이 키가 어느 서버 것인지 적어 둔다
        renderBudgetWarning();
    });
    $('.rl-b-amount').addEventListener('change', (event) => {
        conf.amount = positive(event.target.value);
        event.target.value = conf.amount || '';
        budget.onAmountChanged();
    });
    $('.rl-b-warn').addEventListener('change', (event) => {
        conf.warnPercent = Math.min(100, Math.max(1, Number.parseInt(event.target.value, 10) || 80));
        event.target.value = conf.warnPercent;
        budget.onAmountChanged();
    });
    $('.rl-b-daily').addEventListener('change', (event) => {
        conf.dailyLimit = positive(event.target.value);
        event.target.value = conf.dailyLimit || '';
        conf.dailyAlertedDay = '';
        saveSettings();
    });
    $('.rl-b-access').addEventListener('change', (event) => {
        conf.accessToken = event.target.value.trim();
        saveSettings();
    });
    $('.rl-b-user').addEventListener('change', (event) => {
        conf.userId = event.target.value.trim();
        saveSettings();
    });
    $('.rl-b-test').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.classList.add('disabled');
        try {
            const text = await budget.testConnection();
            toast('success', `연결됐어요. ${text}`, { timeOut: 6000 });
            // [1.2.2] 키 조회는 연결 확인이 방금 했다. force로 다시 부르면 조회 몫(429)을 두 번 쓴다 — 계정 잔액만 간격이 찼으면 가져온다
            budget.refresh().catch(() => {});
        } catch (error) {
            toast('error', `연결하지 못했어요: ${error.message}`, { timeOut: 8000 });
        } finally {
            button.classList.remove('disabled');
        }
    });
    $('.rl-b-reset').addEventListener('click', async () => {
        if (!budget.isConfigured()) return toast('warning', '먼저 중계 서버 연동을 켜고 API 키를 넣어 주세요.');
        const result = await callGenericPopup('지금까지 쓴 금액을 0으로 보고 이 시점부터 다시 셀까요? 예산에는 지금 충전된 금액을 적어 두세요.', POPUP_TYPE.CONFIRM, '', { okButton: '다시 세기', cancelButton: '취소' });
        if (result !== POPUP_RESULT.AFFIRMATIVE) return;
        try {
            await budget.resetBaseline();
            toast('success', '지금부터 다시 세요.');
        } catch (error) {
            toast('error', `기준을 잡지 못했어요: ${error.message}`, { timeOut: 8000 });
        }
    });
}

async function onPriceAdd() {
    const $ = selector => drawer.querySelector(selector);
    const model = $('.rl-price-model').value.trim();
    const input = Number($('.rl-price-in').value);
    const output = Number($('.rl-price-out').value);
    if (!model) return toast('warning', '모델 이름을 적어 주세요.');
    if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return toast('warning', '가격은 0 이상의 숫자로 적어 주세요.');
    settings().prices[model] = { input, output };
    saveSettings();
    $('.rl-price-model').value = '';
    $('.rl-price-in').value = '';
    $('.rl-price-out').value = '';
    renderPrices();
    await repriceDaily(costOf);
    toast('success', `${model} 가격을 저장했어요.`);
}

function renderPrices() {
    const list = drawer.querySelector('.rl-price-list');
    const prices = settings().prices;
    const names = Object.keys(prices).sort();
    if (!names.length) {
        list.innerHTML = '<small class="rl-hint rl-price-empty">아직 없어요. 가격을 넣어 두면 집계에 비용이 나와요. 아래 예산 연동을 켜면 중계 서버의 배율로 자동으로 채워요.</small>';
        return;
    }
    list.innerHTML = names.map(model => `
        <div class="rl-price-row" data-model="${esc(model)}">
            <span class="rl-price-name">${esc(model)}${prices[model].auto ? '<small class="rl-price-auto">자동</small>' : ''}</span>
            <span class="rl-price-nums">${esc(prices[model].input)} / ${esc(prices[model].output)}</span>
            <button type="button" class="rl-icon-btn" data-act="edit" aria-label="고치기"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="rl-icon-btn" data-act="delete" aria-label="지우기"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('');
}

// ── 마법봉 메뉴 ─────────────────────────────────────────────

export function mountWandButton() {
    if (document.getElementById('rl-wand-button')) return;
    const container = document.getElementById('data_bank_wand_container') ?? document.getElementById('extensionsMenu');
    if (!container) return;
    const item = document.createElement('div');
    item.id = 'rl-wand-button';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.innerHTML = `<div class="fa-solid fa-receipt extensionsMenuExtensionButton"></div><span>${TITLE}</span>`;
    item.addEventListener('click', () => openDialog());
    container.append(item);
}

// ── 로그·집계 창 ───────────────────────────────────────────

/** 열려 있는 창. 닫히면 null. */
let dialog = null;

function buildDialog() {
    const root = document.createElement('div');
    root.className = 'rl-root';
    root.innerHTML = `
        <div class="rl-top">
            <div class="rl-tabs" role="tablist">
                <button type="button" class="rl-tab" data-tab="log" aria-pressed="true"><i class="fa-solid fa-list"></i><span>로그</span></button>
                <button type="button" class="rl-tab" data-tab="stats" aria-pressed="false"><i class="fa-solid fa-chart-simple"></i><span>집계</span></button>
                <button type="button" class="rl-tab" data-tab="budget" aria-pressed="false"><i class="fa-solid fa-wallet"></i><span>예산</span><span class="rl-tab-sub"></span></button>
            </div>
            <span class="rl-top-note">${isMemoryOnly() ? '이 창을 닫으면 사라져요 (저장소 없음)' : '이 기기에만 남아요'}</span>
        </div>
        <section class="rl-view" data-view="log">
            <div class="rl-filters">
                <select class="text_pole rl-filter-caller"><option value="">모두</option></select>
                <select class="text_pole rl-filter-purpose" aria-label="사용 용도"><option value="">모든 용도</option>${Object.entries(PURPOSES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
                <select class="text_pole rl-filter-status">
                    <option value="">성공·오류</option>
                    <option value="ok">성공만</option>
                    <option value="error">오류만</option>
                </select>
                <span class="rl-filter-count"></span>
            </div>
            <div class="rl-list"></div>
            <button type="button" class="rl-more" hidden>더 보기</button>
        </section>
        <section class="rl-view" data-view="detail" hidden></section>
        <section class="rl-view" data-view="stats" hidden>
            <div class="rl-ranges">
                <button type="button" class="rl-chip" data-range="today" aria-pressed="true">오늘</button>
                <button type="button" class="rl-chip" data-range="7" aria-pressed="false">7일</button>
                <button type="button" class="rl-chip" data-range="30" aria-pressed="false">30일</button>
                <button type="button" class="rl-chip" data-range="all" aria-pressed="false">전체</button>
            </div>
            <div class="rl-stats"></div>
        </section>
        <section class="rl-view" data-view="budget" hidden>
            <div class="rl-budget"></div>
        </section>`;
    return root;
}

export async function openDialog({ tab = 'log' } = {}) {
    if (dialog) return;
    const root = buildDialog();
    const state = {
        root,
        tab,
        entries: [],
        exhausted: false,
        loading: false,
        callerFilter: '',
        purposeFilter: '',
        statusFilter: '',
        range: 'today',
        detailId: null,
        reload: () => loadFirstPage(state),
    };
    dialog = state;
    const $ = selector => root.querySelector(selector);

    root.addEventListener('click', event => onDialogClick(event, state));
    $('.rl-filter-caller').addEventListener('change', (event) => {
        state.callerFilter = event.target.value;
        renderList(state);
    });
    $('.rl-filter-purpose').addEventListener('change',event=>{state.purposeFilter=event.target.value;renderList(state);});
    $('.rl-filter-status').addEventListener('change', (event) => {
        state.statusFilter = event.target.value;
        renderList(state);
    });

    const stop = onEntry(() => {
        if (dialog !== state) return;
        if (state.tab === 'log' && !state.detailId) loadFirstPage(state);
        else if (state.tab === 'stats') renderStats(state);
    });
    const stopBudget = budget.onBudget(() => {
        if (dialog !== state) return;
        renderBudgetTabLabel(state);
        if (state.tab === 'budget') renderBudget(state);
    });

    state.budgetRange = 'today';
    renderBudgetTabLabel(state);
    showTab(state, tab);
    try {
        await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, large: true, allowVerticalScrolling: true });
    } finally {
        stop();
        stopBudget();
        if (dialog === state) dialog = null;
    }
}

function showTab(state, tab) {
    state.tab = tab;
    state.detailId = null;
    for (const button of state.root.querySelectorAll('.rl-tab')) button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
    for (const view of state.root.querySelectorAll('.rl-view')) view.hidden = view.dataset.view !== tab;
    if (tab === 'log') loadFirstPage(state);
    else if (tab === 'budget') openBudgetTab(state);
    else renderStats(state);
}

// ── 예산 (1.2.0) ────────────────────────────────────────────

async function openBudgetTab(state) {
    await budget.loadDaily().catch(() => {});
    if (dialog !== state) return;
    renderBudget(state);
    // 간격(키 4분 · 계정 1분)이 찼으면 가져온다. 탭을 열 때마다 서버를 부르면 조회 한도(429)에 걸린다
    if (budget.isConfigured()) budget.refresh().catch(() => {});
}

/** 탭 이름 옆의 작은 잔액 */
function renderBudgetTabLabel(state) {
    const sub = state.root.querySelector('.rl-tab[data-tab="budget"] .rl-tab-sub');
    if (!sub) return;
    const { remaining } = budget.summary();
    sub.textContent = budget.isConfigured() && remaining !== null ? money(remaining) : '';
    sub.classList.toggle('is-low', remaining !== null && remaining <= 0);
}

const BUDGET_SOURCE_LABEL = {
    account: '계정 잔액',
    token: '키 한도',
    manual: '예산에서 계산',
};

function shortTime(at) {
    if (!at) return '';
    const diff = Date.now() - at;
    if (diff < 60000) return '방금';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    return dateTimeOf(at);
}

function budgetRangeStart(range) {
    if (range === 'today') return budget.todayKey();
    if (range === 'month') return budget.monthStartKey();
    if (range === 'all') return '';
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    return dayKeyOf(date.getTime());
}

function renderBudget(state) {
    const holder = state.root.querySelector('.rl-budget');
    if (!holder) return;
    const data = budget.budgetState();
    const conf = budget.config();

    if (!budget.isConfigured()) {
        holder.innerHTML = `
            <div class="rl-empty"><i class="fa-solid fa-wallet"></i><b>중계 서버 연동이 꺼져 있어요</b>
            <p>확장 설정 → ${esc(TITLE)} → 예산에서 켜고 API 키를 넣어 주세요. new-api 계열 서버(yunzhuhub 등)에서 실제 과금과 잔액을 가져와요.</p></div>`;
        return;
    }

    const sum = budget.summary();
    const loading = data.loading ? '<i class="fa-solid fa-spinner fa-spin rl-dim"></i>' : '';
    const error = data.error ? `<div class="rl-error"><i class="fa-solid fa-triangle-exclamation"></i><div><b>${esc(data.error)}</b></div></div>` : '';
    const notes = [];
    if (data.accountError) notes.push(`계정 잔액은 못 가져왔어요: ${esc(data.accountError)}`);
    if (data.logsError) notes.push(`요청 내역은 못 가져왔어요: ${esc(data.logsError)}`);

    // 잔액 카드
    let headline;
    if (sum.remaining !== null) {
        const level = sum.remaining <= 0 ? 'is-over' : (sum.ratio !== null && sum.ratio * 100 >= conf.warnPercent ? 'is-warn' : 'is-ok');
        const bar = sum.ratio !== null ? `<div class="rl-bar"><i style="width:${Math.round(sum.ratio * 100)}%"></i></div>` : '';
        const detail = sum.total !== null
            ? `${money(sum.total)} 중 ${money(sum.spent)} 사용${sum.ratio !== null ? ` · ${Math.round(sum.ratio * 100)}%` : ''}`
            : (sum.sinceBaseline !== null ? `기준 시점 이후 ${money(sum.sinceBaseline)} 사용` : '');
        headline = `
            <div class="rl-balance ${level}">
                <small>잔액 <span class="rl-dim">· ${BUDGET_SOURCE_LABEL[sum.source] ?? ''}</span></small>
                <b>${money(sum.remaining)}</b>
                ${bar}
                <span>${detail}</span>
            </div>`;
    } else {
        headline = `
            <div class="rl-balance is-unknown">
                <small>잔액</small>
                <b>${sum.sinceBaseline !== null ? money(sum.sinceBaseline) : '—'}</b>
                <span>${sum.sinceBaseline !== null ? '기준 시점 이후 쓴 금액이에요. 예산을 적으면 잔액이 나와요.' : (data.loading ? '가져오는 중…' : '아직 못 가져왔어요.')}</span>
            </div>`;
    }

    const today = budget.todayKey();
    const todaySpend = budget.spendBetween(today, today);
    const monthSpend = budget.spendBetween(budget.monthStartKey());
    const tiles = `
        <div class="rl-tiles">
            <div class="rl-tile"><small>오늘</small><b>${money(todaySpend.amount)}</b><span class="rl-dim">${number(todaySpend.requests)}건${conf.dailyLimit ? ` · 한도 ${money(conf.dailyLimit)}` : ''}</span></div>
            <div class="rl-tile"><small>이번 달</small><b>${money(monthSpend.amount)}</b><span class="rl-dim">${number(monthSpend.requests)}건</span></div>
            <div class="rl-tile"><small>이 키 누적</small><b>${money(sum.usedTotal)}</b><span class="rl-dim">${conf.baselineAt ? `기준 ${dateTimeOf(conf.baselineAt)}` : ''}</span></div>
        </div>`;

    // 기간별 표
    const start = budgetRangeStart(state.budgetRange);
    const rows = data.daily.filter(row => !start || row.day >= start);
    const byModel = new Map();
    const byDay = new Map();
    for (const row of rows) {
        for (const [map, key] of [[byModel, row.model], [byDay, row.day]]) {
            const group = map.get(key) ?? { label: key, requests: 0, quota: 0, promptTokens: 0, completionTokens: 0 };
            group.requests += Number(row.requests) || 0;
            group.quota += Number(row.quota) || 0;
            group.promptTokens += Number(row.promptTokens) || 0;
            group.completionTokens += Number(row.completionTokens) || 0;
            map.set(key, group);
        }
    }
    const table = (title, groups, sortBy) => {
        if (!groups.length) return '';
        const sorted = [...groups].sort((a, b) => sortBy === 'label' ? String(b.label).localeCompare(String(a.label)) : b.quota - a.quota);
        return `
            <div class="rl-table-wrap">
                <div class="rl-section-head"><b>${esc(title)}</b></div>
                <table class="rl-table">
                    <thead><tr><th></th><th>요청</th><th>입력</th><th>출력</th><th>과금</th></tr></thead>
                    <tbody>${sorted.map(group => `
                        <tr>
                            <td class="rl-td-label">${esc(sortBy === 'label' ? group.label.replace(/-/g, '.') : group.label)}</td>
                            <td data-label="요청">${number(group.requests)}</td>
                            <td data-label="입력">${number(group.promptTokens)}</td>
                            <td data-label="출력">${number(group.completionTokens)}</td>
                            <td data-label="과금">${money(budget.quotaToMoney(group.quota))}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    };
    const ranges = [['today', '오늘'], ['7', '7일'], ['month', '이번 달'], ['30', '30일'], ['all', '전체']]
        .map(([key, label]) => `<button type="button" class="rl-chip" data-brange="${key}" aria-pressed="${String(state.budgetRange === key)}">${label}</button>`)
        .join('');
    const empty = rows.length ? '' : '<div class="rl-empty rl-empty-inline"><i class="fa-regular fa-chart-bar"></i><b>이 기간의 과금 내역이 없어요</b><p></p></div>';

    // [1.2.1] 429로 막힌 동안과, 다음 조회까지 남은 시간을 함께 알려 준다 (버튼도 그때까지 잠긴다)
    const waitMs = budget.refreshWaitMs();
    const waitText = budget.limitedUntil()
        ? `${Math.max(1, Math.ceil(waitMs / 60000))}분 뒤 다시 가져와요`
        : (waitMs > 0 ? `다음 조회까지 ${Math.max(1, Math.ceil(waitMs / 60000))}분` : '');
    holder.innerHTML = `
        <div class="rl-budget-top">
            <span class="rl-dim">${data.updatedAt ? `${shortTime(data.updatedAt)} 기준` : ''}${waitText ? ` · ${waitText}` : ''} ${loading}</span>
            <button type="button" class="rl-icon-btn" data-act="budget-refresh" aria-label="새로 고침" title="${waitText || '새로 고침'}" ${budget.canRefreshNow() ? '' : 'disabled'}><i class="fa-solid fa-rotate"></i></button>
        </div>
        ${error}
        ${headline}
        ${tiles}
        ${notes.length ? `<small class="rl-hint rl-budget-note">${notes.join('<br>')}</small>` : ''}
        <div class="rl-ranges">${ranges}</div>
        ${empty}
        ${table('모델별', [...byModel.values()], 'quota')}
        ${state.budgetRange === 'today' ? '' : table('날짜별', [...byDay.values()], 'label')}
        <small class="rl-hint rl-budget-note">과금은 중계 서버가 기록한 실제 금액이에요. 서버는 최근 1,000건만 주니, 하루에 그보다 많이 요청한 날은 일부가 빠질 수 있어요.</small>`;
}

async function loadFirstPage(state) {
    state.loading = true;
    try {
        state.entries = await listEntries({ limit: PAGE });
        state.exhausted = state.entries.length < PAGE;
    } catch (error) {
        console.warn('[요청 로그] 기록을 읽지 못했어요', error);
        state.entries = [];
        state.exhausted = true;
    } finally {
        state.loading = false;
    }
    if (dialog !== state) return;
    renderCallerFilter(state);
    renderList(state);
}

async function loadMore(state) {
    if (state.loading || state.exhausted) return;
    state.loading = true;
    const last = state.entries[state.entries.length - 1];
    try {
        const more = await listEntries({ limit: PAGE, before: last ? last.at : null });
        state.entries.push(...more);
        state.exhausted = more.length < PAGE;
    } finally {
        state.loading = false;
    }
    if (dialog !== state) return;
    renderCallerFilter(state);
    renderList(state);
}

function renderCallerFilter(state) {
    const select = state.root.querySelector('.rl-filter-caller');
    const callers = [...new Set(state.entries.map(entry => entry.caller || 'unknown'))].sort((a, b) => (a === 'chat' ? -1 : b === 'chat' ? 1 : callerLabel(a).localeCompare(callerLabel(b), 'ko')));
    const current = state.callerFilter;
    select.innerHTML = '<option value="">모두</option>' + callers.map(caller => `<option value="${esc(caller)}">${esc(callerLabel(caller))}</option>`).join('');
    select.value = callers.includes(current) ? current : '';
    if (select.value !== current) state.callerFilter = select.value;
}

function visibleEntries(state) {
    return state.entries.filter((entry) => {
        if(state.purposeFilter&&(entry.purpose||'unknown')!==state.purposeFilter)return false;
        if (state.callerFilter && (entry.caller || 'unknown') !== state.callerFilter) return false;
        if (state.statusFilter === 'ok' && !entry.ok) return false;
        if (state.statusFilter === 'error' && entry.ok) return false;
        return true;
    });
}

function tokensLabel(entry) {
    const mark = entry.estimated ? '<i class="rl-approx" aria-label="추정">≈</i>' : '';
    const reasoning = entry.reasoningTokens ? ` <span class="rl-dim">생각 ${number(entry.reasoningTokens)} 포함</span>` : '';
    return `${mark}${number(entry.promptTokens)} <i class="fa-solid fa-arrow-right-long rl-arrow"></i> ${number(entry.completionTokens)}${reasoning}`;
}

function renderList(state) {
    const list = state.root.querySelector('.rl-list');
    const items = visibleEntries(state);
    state.root.querySelector('.rl-filter-count').textContent = items.length ? `${items.length}건` : '';
    const more = state.root.querySelector('.rl-more');
    more.hidden = state.exhausted;

    if (!items.length) {
        list.innerHTML = `<div class="rl-empty"><i class="fa-regular fa-folder-open"></i><b>${state.entries.length ? '조건에 맞는 요청이 없어요' : '아직 기록이 없어요'}</b><p>${state.entries.length ? '' : '메시지를 보내면 여기에 쌓여요.'}</p></div>`;
        return;
    }

    let lastDay = '';
    const html = [];
    for (const entry of items) {
        const day = dayKeyOf(entry.at);
        if (day !== lastDay) {
            lastDay = day;
            html.push(`<div class="rl-day">${esc(day.replace(/-/g, '.'))}</div>`);
        }
        const status = statusOf(entry);
        const cost = entry.cost === null || entry.cost === undefined ? '' : ` · ${money(entry.cost)}`;
        const error = entry.error && !entry.ok ? `<small class="rl-item-error">${esc(String(entry.error).slice(0, 120))}</small>` : '';
        html.push(`
            <button type="button" class="rl-item ${status.className}" data-id="${esc(entry.id)}">
                <span class="rl-item-time">${timeOf(entry.at)}</span>
                <span class="rl-item-main">
                    <b><span class="rl-item-title">${esc(titleOf(entry))}</span><span class="rl-item-model">${esc(entry.model || '?')}</span></b>
                    <small>${tokensLabel(entry)} · ${seconds(entry.durationMs)}${cost}</small>
                    ${error}
                </span>
                <i class="rl-item-status fa-solid ${status.icon}" aria-label="${status.label}"></i>
            </button>`);
    }
    list.innerHTML = html.join('');
}

// ── 자세히 보기 ─────────────────────────────────────────────

async function openDetail(state, id) {
    const entry = await getEntry(id);
    if (!entry || dialog !== state) return;
    state.detailId = id;
    const view = state.root.querySelector('[data-view="detail"]');
    state.root.querySelector('[data-view="log"]').hidden = true;
    view.hidden = false;
    view.innerHTML = renderDetail(entry);
    view.dataset.id = id;
    view.scrollIntoView?.({ block: 'start' });
    state.detailEntry = entry;
}

function closeDetail(state) {
    state.detailId = null;
    state.detailEntry = null;
    const view = state.root.querySelector('[data-view="detail"]');
    view.hidden = true;
    view.replaceChildren();
    state.root.querySelector('[data-view="log"]').hidden = false;
}

function chip(label, value, className = '') {
    if (value === null || value === undefined || value === '') return '';
    return `<span class="rl-meta-chip ${className}"><small>${esc(label)}</small><b>${value}</b></span>`;
}

function renderMessage(message, index, total) {
    const role = String(message.role ?? '?');
    const content = String(message.content ?? '');
    const open = index >= total - 2 || role === 'system' && index === 0;
    return `
        <details class="rl-msg is-${esc(role)}" ${open ? 'open' : ''}>
            <summary><b>${esc(role)}</b>${message.name ? `<span>${esc(message.name)}</span>` : ''}<small>${number(content.length)}자</small></summary>
            <pre>${esc(content) || '<i class="rl-dim">(빈 내용)</i>'}</pre>
        </details>`;
}

/** 전송 흐름: 버튼을 누른 순간이 0초. 단계 사이 간격과 그 사이에 난 저장 · 임베딩 요청 길이 */
function renderSendTrace(trace) {
    if (!trace || !Array.isArray(trace.marks)) return '';
    const steps = [['보내기 (' + esc(trace.source || '버튼') + ')', 0], ...trace.marks, ['요청 보냄', trace.requestAt]];
    const rows = steps.map(([label, at], index) => {
        const prev = index ? steps[index - 1][1] : 0;
        const gap = at - prev;
        const heavy = gap >= 700 ? ' is-heavy' : '';
        return `<div class="rl-trace-row${heavy}"><span class="rl-trace-at">${seconds(at)}</span><span class="rl-trace-label">${esc(label)}</span><span class="rl-trace-gap">${index ? '+' + seconds(gap) : ''}</span></div>`;
    }).join('');
    const fetches = (trace.fetches || []).map(row => `<div class="rl-trace-row is-fetch"><span class="rl-trace-at">${seconds(row.at)}</span><span class="rl-trace-label">${esc(row.label)}</span><span class="rl-trace-gap">${seconds(row.ms)}</span></div>`).join('');
    return `
        <div class="rl-section-head"><b>전송 흐름</b><small>버튼을 누른 순간이 0초 · 굵은 줄은 0.7초 넘게 걸린 단계</small></div>
        <div class="rl-trace">${rows}${fetches ? `<div class="rl-trace-sub">그 사이에 난 요청</div>${fetches}` : ''}</div>`;
}

function renderDetail(entry) {
    const status = statusOf(entry);
    const meta = [
        chip('상태', `<i class="fa-solid ${status.icon}"></i> ${status.label}${entry.status ? ` · HTTP ${entry.status}` : ''}`, status.className),
        chip('걸린 시간', `${seconds(entry.durationMs)}${entry.firstByteMs !== null && entry.firstByteMs !== undefined ? ` <span class="rl-dim">첫 글자 ${seconds(entry.firstByteMs)}</span>` : ''}`),
        chip('토큰', tokensLabel(entry)),
        entry.cachedTokens ? chip('캐시', number(entry.cachedTokens)) : '',
        chip('비용', entry.cost === null || entry.cost === undefined ? '<span class="rl-dim">가격 없음</span>' : money(entry.cost)),
        chip('끝난 이유', entry.finish ? esc(entry.finish) : ''),
        chip('보내기', entry.stream ? '스트림' : '한 번에'),
        chip('메시지', entry.messageCount ? `${number(entry.messageCount)}개 · ${number(entry.promptChars)}자` : ''),
        chip('캐릭터', entry.character ? esc(entry.character) : ''),
        chip('용도',esc(purposeLabel(entry.purpose))),
        chip('사용량',entry.usageKnown?'API 응답':entry.estimated?'토큰 추정':'확인 불가'),
        chip('비용 기준','설정한 모델 단가로 계산 · 실제 청구액과 다를 수 있어요'),
        chip('API 경로',esc(entry.endpoint||'')),
        chip('소스', entry.source ? esc(entry.source) : ''),
        entry.swipes > 1 ? chip('스와이프', `${entry.swipes}개`) : '',
    ].join('');

    const error = entry.error && !entry.ok
        ? `<div class="rl-error"><i class="fa-solid fa-triangle-exclamation"></i><div><b>${esc(entry.error)}</b>${entry.raw && entry.raw !== entry.error ? `<pre>${esc(entry.raw)}</pre>` : ''}</div></div>`
        : '';

    let body;
    if (entry.stripped) {
        body = '<div class="rl-empty rl-empty-inline"><i class="fa-regular fa-file"></i><b>본문은 지워졌어요</b><p>본문 보관 수보다 오래된 요청이라 숫자만 남아 있어요.</p></div>';
    } else {
        const messages = Array.isArray(entry.messages)
            ? entry.messages.map((message, index) => renderMessage(message, index, entry.messages.length)).join('')
            : (entry.prompt ? renderMessage({ role: 'prompt', content: entry.prompt }, 0, 1) : '');
        const reasoning = entry.reasoning ? `<details class="rl-msg is-reasoning"><summary><b>생각</b><small>${number(entry.reasoning.length)}자</small></summary><pre>${esc(entry.reasoning)}</pre></details>` : '';
        const reply = `<details class="rl-msg is-reply" open><summary><b>응답</b><small>${number((entry.reply ?? '').length)}자</small></summary><pre>${esc(entry.reply ?? '') || '<i class="rl-dim">(빈 응답)</i>'}</pre></details>`;
        body = `
            <div class="rl-section-head"><b>프롬프트</b><small>${number(entry.messageCount)}개</small></div>
            <div class="rl-messages">${messages || '<small class="rl-dim">프롬프트가 없어요.</small>'}</div>
            <div class="rl-section-head"><b>응답</b></div>
            <div class="rl-messages">${reasoning}${reply}</div>`;
    }

    const params = entry.params ? `<details class="rl-msg is-params"><summary><b>설정값</b><small>${Object.keys(entry.params).length}개</small></summary><pre>${esc(JSON.stringify(entry.params, null, 2))}</pre></details>` : '';
    const trace = renderSendTrace(entry.sendTrace);

    return `
        <div class="rl-detail-head">
            <button type="button" class="rl-icon-btn rl-back" data-act="back" aria-label="목록으로"><i class="fa-solid fa-arrow-left"></i></button>
            <div class="rl-detail-title">
                <b><span class="rl-item-title">${esc(titleOf(entry))}</span><span class="rl-item-model">${esc(entry.model || '?')}</span></b>
                <small>${dateTimeOf(entry.at)}</small>
            </div>
            <div class="rl-detail-actions">
                <button type="button" class="rl-icon-btn" data-act="copy-prompt" aria-label="프롬프트 복사" ${entry.stripped ? 'disabled' : ''}><i class="fa-regular fa-copy"></i><span>프롬프트</span></button>
                <button type="button" class="rl-icon-btn" data-act="copy-reply" aria-label="응답 복사" ${entry.stripped ? 'disabled' : ''}><i class="fa-regular fa-copy"></i><span>응답</span></button>
            </div>
        </div>
        <div class="rl-meta">${meta}</div>
        ${error}
        ${trace}
        ${body}
        <div class="rl-messages">${params}</div>`;
}

async function copyText(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        toast('success', `${label}을 복사했어요.`);
    } catch {
        toast('warning', '복사하지 못했어요. 글을 직접 골라서 복사해 주세요.');
    }
}

// ── 집계 ────────────────────────────────────────────────────

function rangeCutoff(range) {
    if (range === 'all') return '';
    const days = range === 'today' ? 0 : Number(range);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return dayKeyOf(date.getTime());
}

function groupRows(rows, keyOf, labelOf) {
    const groups = new Map();
    for (const row of rows) {
        const key = keyOf(row);
        const group = groups.get(key) ?? { key, label: labelOf(row), cachedTokens:0,unknownUsage:0, requests: 0, errors: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0, estimatedRequests: 0, cost: 0, priced: 0 };
        for (const field of ['cachedTokens','unknownUsage','requests', 'errors', 'promptTokens', 'completionTokens', 'reasoningTokens', 'estimatedRequests', 'cost', 'priced']) group[field] += Number(row[field]) || 0;
        groups.set(key, group);
    }
    return [...groups.values()];
}

function costCell(group) {
    if (!group.priced) return '<span class="rl-dim">—</span>';
    const partial = group.priced < group.requests ? '<span class="rl-dim">일부</span> ' : '';
    return `${partial}${money(group.cost)}`;
}

function approxMark(group) {
    return group.estimatedRequests ? '<i class="rl-approx" aria-label="일부 추정">≈</i>' : '';
}

function renderTable(title, groups, { sortBy = 'promptTokens', desc = true } = {}) {
    if (!groups.length) return '';
    const sorted = [...groups].sort((a, b) => (desc ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]) || String(a.label).localeCompare(String(b.label), 'ko'));
    return `
        <div class="rl-table-wrap">
            <div class="rl-section-head"><b>${esc(title)}</b></div>
            <table class="rl-table">
                <thead><tr><th></th><th>요청</th><th>입력</th><th>출력</th><th>캐시 입력</th><th>예상 비용</th></tr></thead>
                <tbody>${sorted.map(group => `
                    <tr>
                        <td class="rl-td-label">${esc(group.label)}${group.errors ? `<small class="rl-td-err">오류 ${group.errors}</small>` : ''}</td>
                        <td data-label="요청">${number(group.requests)}</td>
                        <td data-label="입력">${approxMark(group)}${number(group.promptTokens)}</td>
                        <td data-label="출력">${number(group.completionTokens)}${group.reasoningTokens ? `<small class="rl-dim">생각 ${number(group.reasoningTokens)} 포함</small>` : ''}</td>
                        <td data-label="캐시 입력">${number(group.cachedTokens)}</td><td data-label="예상 비용">${costCell(group)}${group.unknownUsage?`<small class="rl-dim">사용량 미확인 ${number(group.unknownUsage)}건</small>`:''}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

async function renderStats(state) {
    const holder = state.root.querySelector('.rl-stats');
    let rows;
    try {
        rows = await listDaily();
    } catch (error) {
        console.warn('[요청 로그] 집계를 읽지 못했어요', error);
        rows = [];
    }
    if (dialog !== state) return;
    for (const button of state.root.querySelectorAll('[data-range]')) button.setAttribute('aria-pressed', String(button.dataset.range === state.range));

    const cutoff = rangeCutoff(state.range);
    const inRange = rows.filter(row => !cutoff || row.day >= cutoff);
    if (!inRange.length) {
        holder.innerHTML = '<div class="rl-empty"><i class="fa-regular fa-chart-bar"></i><b>이 기간에는 요청이 없어요</b><p></p></div>';
        return;
    }
    const total = groupRows(inRange, () => 'all', () => '전체')[0];
    const totalTokens = total.promptTokens + total.completionTokens;
    const tiles = `
        <div class="rl-tiles">
            <div class="rl-tile"><small>요청</small><b>${number(total.requests)}</b>${total.errors ? `<span class="rl-td-err">오류 ${number(total.errors)}</span>` : ''}</div>
            <div class="rl-tile"><small>입력 토큰</small><b>${approxMark(total)}${number(total.promptTokens)}</b></div>
            <div class="rl-tile"><small>출력 토큰</small><b>${number(total.completionTokens)}</b>${total.reasoningTokens ? `<span class="rl-dim">생각 ${number(total.reasoningTokens)}</span>` : ''}</div>
            <div class="rl-tile"><small>비용</small><b>${costCell(total)}</b><span class="rl-dim">${number(totalTokens)} 토큰</span></div>
        </div>`;
    const byPurpose=groupRows(inRange,row=>row.purpose||'unknown',row=>purposeLabel(row.purpose));
    const byPurposeModel=groupRows(inRange,row=>(row.purpose||'unknown')+'|'+row.model,row=>purposeLabel(row.purpose)+' · '+row.model);
    const byModel = groupRows(inRange, row => row.model, row => row.model);
    const byCaller = groupRows(inRange, row => row.caller, row => callerLabel(row.caller));
    const byDay = groupRows(inRange, row => row.day, row => row.day.replace(/-/g, '.'));
    holder.innerHTML = tiles
        + '<p class="rl-dim">용도별 비용은 모델 단가 기준 예상액이에요. 예전 기록은 용도 분류 불가로 남고, 사용량·가격이 없는 요청은 0원으로 계산하지 않아요. 캐시 입력은 입력에 포함된 참고 수치예요.</p>'
        + renderTable('용도별 · 비용 많은 순',byPurpose,{sortBy:'cost'})
        + renderTable('용도 · 모델별',byPurposeModel,{sortBy:'cost'})
        + renderTable('모델별', byModel)
        + renderTable('보낸 곳별', byCaller)
        + (state.range === 'today' ? '' : renderTable('날짜별', byDay, { sortBy: 'label', desc: true }));
}

// ── 창 안의 클릭 ─────────────────────────────────────────────

function onDialogClick(event, state) {
    const target = event.target;
    const tab = target.closest('.rl-tab');
    if (tab) return showTab(state, tab.dataset.tab);

    const range = target.closest('[data-range]');
    if (range) {
        state.range = range.dataset.range;
        return renderStats(state);
    }

    const budgetRange = target.closest('[data-brange]');
    if (budgetRange) {
        state.budgetRange = budgetRange.dataset.brange;
        return renderBudget(state);
    }
    if (target.closest('[data-act="budget-refresh"]')) {
        return budget.refresh({ force: true }).catch(() => {});
    }

    const row = target.closest('.rl-item[data-id]');
    if (row) return openDetail(state, row.dataset.id);

    if (target.closest('.rl-more')) return loadMore(state);

    const action = target.closest('[data-act]')?.dataset.act;
    const entry = state.detailEntry;
    switch (action) {
        case 'back':
            return closeDetail(state);
        case 'copy-prompt':
            if (!entry) return;
            return copyText(JSON.stringify(entry.messages ?? entry.prompt ?? '', null, 2), '프롬프트');
        case 'copy-reply':
            if (!entry) return;
            return copyText(entry.reply ?? '', '응답');
    }
}
