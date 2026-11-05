// API 서버 상태 (1.0.3 · 기본 끔) — 지금 쓰는 연결(Chat Completion 소스 · 모델)의 회사 공식 상태 페이지를 읽어 작은 점 하나로 보여 줘요.
//   자리: API 연결 서랍 › Chat Completion 의 연결 상태 줄(● 연결됨) 끝. 상태가 나쁘면 위 막대 플러그 아이콘에도 작은 점.
//   누르면 작은 창: 공급자 · 상태 한 줄 · 관련 구성 요소 · 진행 중 사고(제목 · 마지막 갱신) · 공식 상태 페이지 열기 · 다른 공급자 한눈에.
//   생성 실패 알림(실리태번 「Chat Completion API」 오류)이 뜨면 그 공급자 상태를 보고 나쁠 때만 「공식 상태도 장애 중이에요」 한 줄을 붙여요.
// 가볍게: 켤 때만 받는 모듈 · 읽기는 작은 창 열 때 · 연결 서랍 열 때 · 생성 실패 때 · 10분 간격(탭이 숨으면 쉼) — 이유마다 캐시 나이(api-status-core.js MAX_AGE)로 걸러요.
//   바깥 요청은 상태 페이지 주소(PROVIDERS.url)로만, 쿠키 · 리퍼러 없이. 사용자 정보 · 대화 · 키는 보내지 않아요.
//   CORS 를 열지 않은 회사(Mistral · OpenRouter · xAI)는 실리태번 CORS 프록시(config.yaml enableCorsProxy)가 켜져 있을 때만 그것으로 읽고, 꺼져 있으면 링크만이에요(한 세션에 한 번만 확인).
// 계산은 api-status-core.js(순수), 모양은 api-status.css(켤 때만 받음).
import { showThemeModal } from './modal.js';
import * as core from './api-status-core.js';

const CACHE_KEY = 'bl-apistatus-cache-v1';
const PROXY_KEY = 'bl-apistatus-proxy';
const TICK = core.MAX_AGE.tick;
const TIMEOUT = 8000;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = () => SillyTavern.getContext();
const warn = (...a) => console.warn('[Blue Lemonade] API 서버 상태', ...a);

let on = false, cache = null, timer = 0, bound = false, cssOn = false, dot = null, dialog = null, origError = null, wrapped = null, proxyProbe = null;
const inflight = new Map();
const off = [];
/** 시험이 바꿔 끼워요 */
const io = { fetch: (...a) => globalThis.fetch(...a), now: () => Date.now() };

// ───────── 캐시 ─────────
function store() {
    if (cache) return cache;
    let raw = null;
    try { raw = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) || 'null'); } catch { /* 없음 · 막힘 */ }
    return (cache = core.tidyCache(raw, io.now()));
}
function persist() {
    try { globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(cache || {})); } catch { /* 사생활 모드 · 꽉 참 */ }
}
function proxyState() {
    try { return globalThis.sessionStorage?.getItem(PROXY_KEY) || ''; } catch { return ''; }
}
function setProxyState(value) {
    try { globalThis.sessionStorage?.setItem(PROXY_KEY, value); } catch { /* 막힘 */ }
}

// ───────── 지금 연결 ─────────
function current() {
    const c = ctx(), o = c?.chatCompletionSettings || {};
    let model = '';
    try { model = String(c?.getChatCompletionModel?.() || ''); } catch { /* 옛 판 */ }
    return core.pickProviders({ mainApi: c?.mainApi, source: o.chat_completion_source, model, customUrl: o.custom_url, reverseProxy: o.reverse_proxy });
}
const levelOfIds = ids => core.worst(ids.map(id => store()[id]?.level || 'unknown'));

// ───────── 읽기 ─────────
/** 공급자 하나를 이유에 맞으면 읽어요 — 같은 공급자를 동시에 두 번 읽지 않아요 */
function fetchOne(id, reason) {
    const p = core.PROVIDERS[id];
    if (!p) return Promise.resolve(null);
    const entry = store()[id];
    if (!core.needsFetch(entry, io.now(), reason)) return Promise.resolve(entry);
    if (inflight.has(id)) return inflight.get(id);
    const job = (async () => {
        const at = io.now();
        if (p.kind === 'link') return save(id, { at, level: 'unknown', error: 'link', components: [], incidents: [], updatedAt: 0 });
        const viaProxy = !p.cors;
        // 프록시가 켜져 있는지 모를 때는 하나만 먼저 두드려 보고 나머지는 그 답을 기다려요
        if (viaProxy && !proxyState() && proxyProbe) await proxyProbe.catch(() => {});
        if (viaProxy && proxyState() === 'off') return save(id, { at, level: 'unknown', error: 'cors', components: [], incidents: [], updatedAt: 0 });
        const url = viaProxy ? `/proxy/${p.url}` : p.url;
        let release = null;
        if (viaProxy && !proxyState()) proxyProbe = new Promise(resolve => { release = resolve; });
        const abort = new AbortController();
        const stop = setTimeout(() => abort.abort(), TIMEOUT);
        try {
            const res = await io.fetch(url, viaProxy
                ? { cache: 'no-store', credentials: 'same-origin', signal: abort.signal }
                : { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', signal: abort.signal });
            if (viaProxy && (res.status === 404 || res.status === 403)) { setProxyState('off'); return save(id, { at, level: 'unknown', error: 'cors', components: [], incidents: [], updatedAt: 0 }); }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = JSON.parse(await res.text());
            if (viaProxy) setProxyState('on');
            return save(id, { at, ...core.grade(id, json), error: '' });
        } catch (error) {
            if (on) warn(p.short, error?.name === 'AbortError' ? '시간 초과' : String(error?.message || error).slice(0, 80));
            return save(id, { at, level: 'unknown', error: 'net', components: [], incidents: [], updatedAt: 0 });
        } finally {
            clearTimeout(stop);
            if (release) { proxyProbe = null; release(); }
        }
    })().finally(() => inflight.delete(id));
    inflight.set(id, job);
    return job;
}
function save(id, entry) {
    store()[id] = core.tidyCache({ [id]: entry }, io.now())[id] || entry;
    persist();
    return store()[id];
}
/** 지금 연결의 공급자들을 읽고 다시 그려요 */
async function refresh(reason, ids = current().ids) {
    if (!on || !ids.length) { render(); return; }
    await Promise.all(ids.map(id => fetchOne(id, reason)));
    if (on) render();
}
/** 창의 「다른 공급자」 — 셋씩 차례로, 10분 넘은 것만 */
async function refreshOthers(skip) {
    const rest = core.ORDER.filter(id => !skip.includes(id));
    for (let i = 0; i < rest.length && on && dialog; i += 3) {
        await Promise.all(rest.slice(i, i + 3).map(id => fetchOne(id, 'others')));
        if (dialog) renderDialog();
    }
}

// ───────── 10분 간격 (탭이 숨으면 쉼) ─────────
function schedule() {
    clearTimeout(timer); timer = 0;
    if (!on || document.hidden) return;
    timer = setTimeout(() => { timer = 0; refresh('tick').finally(schedule); }, TICK);
}
function onVisible() {
    if (!on) return;
    if (document.hidden) { clearTimeout(timer); timer = 0; return; }
    refresh('tick').finally(schedule);   // 돌아오면 10분 넘은 것만 읽어요
}

// ───────── 화면: 점 ─────────
function ensureCss() {
    if (cssOn || document.getElementById('bl-apistatus-style')) { cssOn = true; return; }
    const link = document.createElement('link');
    link.id = 'bl-apistatus-style'; link.rel = 'stylesheet';
    link.href = new URL('./api-status.css', import.meta.url).href;
    (document.head || document.documentElement).append(link);
    cssOn = true;
}
/** 연결 서랍 › Chat Completion 의 연결 상태 줄(● 연결됨) */
const statusRow = () => { const rows = document.querySelectorAll('#openai_api .online_status'); return rows[rows.length - 1] || null; };
function mount() {
    if (dot?.isConnected) return dot;
    const row = statusRow();
    if (!row) return null;
    dot = document.createElement('button');
    dot.type = 'button'; dot.id = 'bl-apistatus-dot'; dot.className = 'bl-apistatus-dot';
    dot.innerHTML = '<span class="bl-as-pip" aria-hidden="true"></span><span class="bl-as-label"></span>';
    dot.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openDialog(); });
    row.append(dot);
    return dot;
}
const still = () => !!ctx()?.powerUserSettings?.reduced_motion;
const namesOf = ids => ids.map(id => core.PROVIDERS[id]?.short).filter(Boolean).join(' · ');
function render() {
    const now = current();
    const level = now.ids.length ? levelOfIds(now.ids) : 'unknown';
    const el = on ? mount() : null;
    if (el) {
        el.dataset.level = level;
        el.toggleAttribute('data-still', still());
        const names = namesOf(now.ids) || (now.relay ? '중계' : '모름');
        el.querySelector('.bl-as-label').textContent = level === 'ok' || level === 'unknown' ? names : `${names} · ${core.LEVEL_WORD[level]}`;
        const line = now.ids.length ? now.ids.map(id => `${core.PROVIDERS[id].short}: ${core.sentence(id, store()[id]?.level || 'unknown')}`).join(' / ') : '지금 연결은 공식 상태를 알 수 없는 곳이에요';
        el.title = `API 서버 상태 — ${line}`;
        el.setAttribute('aria-label', `API 서버 상태 — ${line} · 눌러서 자세히 보기`);
    }
    // 위 막대 플러그 아이콘: 나쁠 때만 작은 점
    const top = document.getElementById('API-status-top');
    const bad = on && ctx()?.mainApi === 'openai' && core.RANK[level] >= 1;
    if (top) { if (bad) top.setAttribute('data-bl-apistatus', level); else top.removeAttribute('data-bl-apistatus'); }
    if (dialog) renderDialog();
}

// ───────── 화면: 작은 창 ─────────
const pip = level => `<span class="bl-as-pip" data-level="${esc(level)}" aria-hidden="true"></span>`;
const pageLink = (p, text = '공식 상태 페이지 열기') => `<a class="bl-as-page" href="${esc(p.page)}" target="_blank" rel="noopener noreferrer">${esc(text)} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`;
function card(id) {
    const p = core.PROVIDERS[id], e = store()[id], level = e?.level || 'unknown', t = io.now();
    const comps = e?.components?.length ? `<ul class="bl-as-comps">${e.components.map(c => `<li>${pip(c.level)}<span class="bl-as-name">${esc(c.name)}</span><small>${esc(core.LEVEL_WORD[c.level])}</small></li>`).join('')}</ul>` : '';
    const incs = e?.incidents?.length ? `<div class="bl-as-incs"><p class="bl-as-cap">진행 중인 사고</p><ul>${e.incidents.map(i => `<li>${pip(i.level)}<div><b>${esc(i.title)}</b><small>${esc(core.incidentStatus(i.status))}${i.updatedAt ? ` · ${esc(core.ago(i.updatedAt, t))} 갱신` : ''}</small></div></li>`).join('')}</ul></div>` : '';
    const note = e?.error === 'cors' ? '<p class="bl-as-note">이 회사 상태 페이지는 브라우저에서 바로 읽지 못하게 막혀 있어 링크로만 보여요. 실리태번 CORS 프록시가 켜져 있으면 그것으로 읽어요.</p>'
        : e?.error === 'net' ? '<p class="bl-as-note">상태 페이지에 닿지 못했어요. 잠시 뒤 다시 확인해요.</p>' : '';
    const checked = e?.at && e.error !== 'link' && e.error !== 'cors' ? `<span>${esc(core.ago(e.at, t))} 확인</span>` : '<span></span>';
    return `<section class="bl-as-card" data-level="${esc(level)}" data-provider="${esc(id)}">
        <div class="bl-as-head">${pip(level)}<b>${esc(p.name)}</b></div>
        <p class="bl-as-line">${esc(core.sentence(id, level))}</p>
        ${comps}${incs}${note}
        <p class="bl-as-meta">${checked}${pageLink(p)}</p>
    </section>`;
}
function renderDialog() {
    if (!dialog) return;
    const now = current();
    const body = dialog.querySelector('.bl-as-body');
    const mine = now.ids.length ? now.ids.map(card).join('') : '<p class="bl-as-note">지금 연결은 공식 상태를 알 수 없는 곳이에요(직접 띄운 서버 · 모르는 중계 등). 아래에서 회사별 공식 상태를 볼 수 있어요.</p>';
    const relay = now.relay ? '<p class="bl-as-note">중계 서버를 거쳐요 — 중계 서버는 공식 상태와 따로 느리거나 멈출 수 있어요.</p>' : '';
    const others = core.ORDER.filter(id => !now.ids.includes(id)).map(id => {
        const p = core.PROVIDERS[id], level = store()[id]?.level || 'unknown';
        const word = p.kind === 'link' || store()[id]?.error === 'cors' ? '링크' : core.LEVEL_WORD[level];
        return `<li><a class="bl-as-other" href="${esc(p.page)}" target="_blank" rel="noopener noreferrer" data-level="${esc(level)}" title="${esc(p.name)} 공식 상태 페이지">${pip(level)}<span class="bl-as-name">${esc(p.short)}</span><small>${esc(word)}</small></a></li>`;
    }).join('');
    body.innerHTML = `${mine}${relay}<p class="bl-as-cap">다른 공급자</p><ul class="bl-as-others">${others}</ul>
        <p class="bl-as-foot">각 회사 공식 상태 페이지만 읽어요 — 대화 · 키 · 사용자 정보는 보내지 않아요. 표시는 그 회사가 올린 내용 그대로라 실제 체감과 다를 수 있어요.</p>`;
}
function openDialog() {
    if (!on) return;
    if (dialog?.open) return;
    dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-apistatus-dialog';
    dialog.setAttribute('aria-label', 'API 서버 상태');
    dialog.innerHTML = '<h3 class="bl-as-title"><i class="fa-solid fa-signal" aria-hidden="true"></i> API 서버 상태</h3><div class="bl-as-body"></div><div class="bl-as-actions"><button type="button" class="salty-btn bl-as-again">다시 확인</button><button type="button" class="salty-btn bl-as-close">닫기</button></div>';
    document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog?.remove(); dialog = null; }, { once: true });
    dialog.querySelector('.bl-as-close').addEventListener('click', () => dialog?.close());
    dialog.querySelector('.bl-as-again').addEventListener('click', () => { refresh('manual').then(() => dialog && refreshOthers(current().ids)); });
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    renderDialog();
    showThemeModal(dialog);
    const ids = current().ids;
    refresh('open', ids).then(() => dialog && refreshOthers(ids));
}

// ───────── 생성 실패 알림 ─────────
const GEN_TITLE = /chat completion|api returned an error|api error|generation error/i;
function onErrorToast(toast, message, title) {
    if (!on || ctx()?.mainApi !== 'openai') return;
    if (!GEN_TITLE.test(String(title ?? '')) && !/chat completion/i.test(String(message ?? ''))) return;
    const ids = current().ids;
    if (!ids.length) return;
    refresh('fail', ids).then(() => {
        const id = ids.reduce((a, b) => (core.RANK[store()[b]?.level] ?? -1) > (core.RANK[store()[a]?.level] ?? -1) ? b : a);
        const line = core.failureLine(id, store()[id]?.level);
        const el = toast?.[0] || toast;
        if (!line || !el?.isConnected || el.querySelector?.('.bl-apistatus-toastline')) return;
        const add = document.createElement('div');
        add.className = 'bl-apistatus-toastline';
        add.textContent = `🤒 ${line}`;
        (el.querySelector('.toast-message') || el).append(add);
    }).catch(() => {});
}
function hookToasts(want) {
    const t = globalThis.toastr;
    if (!t) return;
    if (want && !wrapped) {
        origError = t.error;
        wrapped = function (message, title, options) {
            const toast = origError.apply(this, arguments);
            try { onErrorToast(toast, message, title); } catch { /* 알림은 그대로 */ }
            return toast;
        };
        t.error = wrapped;
    } else if (!want && wrapped && t.error === wrapped) {   // 다른 확장이 그 위에 또 감쌌으면 그대로 두고 on=false 로 쉬어요
        t.error = origError; wrapped = null; origError = null;
    }
}

// ───────── 켜고 끄기 ─────────
function bind() {
    if (bound) return;
    bound = true;
    const c = ctx(), es = c?.eventSource, ev = c?.eventTypes || c?.event_types || {};
    const changed = () => { render(); if (!document.hidden) refresh('drawer'); };
    for (const name of ['CHATCOMPLETION_SOURCE_CHANGED', 'CHATCOMPLETION_MODEL_CHANGED', 'MAIN_API_CHANGED']) if (es && ev[name]) { es.on(ev[name], changed); off.push(() => es.removeListener?.(ev[name], changed)); }
    document.addEventListener('visibilitychange', onVisible);
    off.push(() => document.removeEventListener('visibilitychange', onVisible));
    // 연결 서랍을 열 때 10분 넘었으면 읽어요 (위 막대 플러그 아이콘)
    const toggle = document.querySelector('#sys-settings-button > .drawer-toggle');
    const opened = () => { setTimeout(() => { if (on && document.getElementById('rm_api_block')?.classList.contains('openDrawer')) { mount(); refresh('drawer'); } }, 0); };
    if (toggle) { toggle.addEventListener('click', opened); off.push(() => toggle.removeEventListener('click', opened)); }
}
function unbind() {
    while (off.length) { try { off.pop()(); } catch { /* 이미 뗌 */ } }
    bound = false;
}
export async function syncApiStatus(want) {
    const was = on;
    on = !!want;
    if (on && was) { render(); return; }   // 설정을 바꿀 때마다 불려요 — 10분 시계를 다시 걸지 않아요
    if (!on) {
        unbind(); hookToasts(false);
        clearTimeout(timer); timer = 0;
        dialog?.close(); dialog = null;
        dot?.remove(); dot = null;
        document.getElementById('API-status-top')?.removeAttribute('data-bl-apistatus');
        document.getElementById('bl-apistatus-style')?.remove(); cssOn = false;
        return;
    }
    ensureCss();
    bind(); hookToasts(true);
    render();
    // 켠 직후 · 새로고침 뒤: 10분 넘은 것만 한 번 읽고 10분 간격을 걸어요
    if (!document.hidden) await refresh('tick');
    schedule();
}

/** 시험용 */
export const _forTest = { io, store, current, refresh, openDialog, render, state: () => ({ on, timer, bound, dialog, dot, inflight: inflight.size, wrapped: !!wrapped }), reset: () => { cache = null; } };
