import { syncModelSwitchMenu } from './menu.js';
import { getSettings } from '../../settings.js';
// 모델 전환 — 번역 · 장기 기억 · 다시 쓰기처럼 제 모델을 따로 고르는 확장들의 공급자 · 모델을 한 번에 바꾼다.
// 중계 서버가 안 될 때 공식 API 로, 되면 다시 중계로: 조합을 저장해 두고 눌러서 바꾼다.
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types, getRequestHeaders } from '../../../../../../../script.js';
import { oai_settings } from '../../../../../../openai.js';
import { SOURCES } from '../models/sources.js';
import { listTargets, supports, registry } from './targets.js';
import { setLocks, withoutLock } from './lock.js';

const VERSION = '1.0.3';
const MAX_LISTS = 3;
const MAX_PRESETS = 8;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = source => SOURCES.find(s => s.id === source)?.label || source;
const holder = document.createElement('div'); holder.hidden = true; document.body.append(holder);
let root, inlineHost = null, opening = false, busy = false, note = '', picking = false, fetching = false;

globalThis[Symbol.for('st.model-switch.v1')] = registry;

function store() {
    const s = extension_settings.model_switch ??= {};
    if (!s.targets || typeof s.targets !== 'object') s.targets = {};
    if (!Array.isArray(s.presets)) s.presets = [];
    s.presets = s.presets.filter(p => p && typeof p.name === 'string' && typeof p.source === 'string' && typeof p.model === 'string').slice(0, MAX_PRESETS);
    if (!s.draft || typeof s.draft !== 'object') s.draft = { source: 'custom', model: '', url: '' };
    if (!s.lists || typeof s.lists !== 'object' || Array.isArray(s.lists)) s.lists = {};
    s.lock = s.lock === true;
    return s;
}

// 아는 확장은 처음부터 켜 두고, 자동으로 찾은 확장은 직접 켤 때까지 건드리지 않는다
const isOn = target => store().targets[target.id] ?? !target.auto;

// 잠금: 체크한 확장 중 우리가 화면까지 아는 것(번역 · 장기 기억 · 다시 쓰기)만 그 확장 화면에서 못 바꾸게 한다
function syncLocks() {
    const ids = store().lock ? listTargets().filter(target => !target.auto && !target.external && isOn(target)).map(target => target.id) : [];
    setLocks(ids, () => openPanel());
}

const cleanUrl = url => String(url || '').trim().replace(/\/+$/, '');
// 주소 칸이 비면 실리태번 본체의 Custom 주소가 쓰인다
const listUrl = () => cleanUrl(store().draft.url) || cleanUrl(oai_settings.custom_url);

/** Custom 주소의 모델 목록을 서버를 거쳐 받아 온다 (키는 실리태번에 저장된 Custom 키). 주소별로 최근 3개만 보관. */
async function fetchModels() {
    const url = listUrl();
    if (fetching) return;
    if (!/^https?:\/\//i.test(url)) { note = '주소를 먼저 넣어 주세요 (http…)'; render(); return; }
    fetching = true; note = '모델 목록을 불러오는 중…'; render();
    try {
        const own = url === cleanUrl(oai_settings.custom_url);
        const response = await fetch('/api/backends/chat-completions/status', {
            method: 'POST', headers: getRequestHeaders(), signal: AbortSignal.timeout(30000),
            body: JSON.stringify({ chat_completion_source: 'custom', custom_url: url, custom_include_headers: own ? oai_settings.custom_include_headers : '', reverse_proxy: '', proxy_password: '' }),
        });
        const data = response.ok ? await response.json() : null;
        const models = [...new Set((Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []).map(item => String(item?.id ?? item?.name ?? '')).filter(Boolean))].slice(0, 400);
        if (!models.length) throw Error(data?.error ? '주소나 키를 확인해 주세요' : '목록이 비어 있어요');
        const s = store(); s.lists[url] = { models, fetchedAt: new Date().toISOString() };
        for (const old of Object.keys(s.lists).sort((a, b) => String(s.lists[b].fetchedAt).localeCompare(String(s.lists[a].fetchedAt))).slice(MAX_LISTS)) delete s.lists[old];
        saveSettingsDebounced(); note = `모델 ${models.length}개`; picking = true;
    } catch (error) { note = `목록을 못 불러왔어요: ${error?.name === 'TimeoutError' ? '시간 초과' : error?.message || error}`; }
    fetching = false; render();
}

function modelOptions(source) {
    const names = new Set();
    // 지금 주소의 목록이 맨 앞
    if (source === 'custom') for (const name of store().lists[listUrl()]?.models || []) names.add(String(name));
    const selector = SOURCES.find(s => s.id === source)?.selector;
    if (selector) document.querySelectorAll(`${selector} option`).forEach(o => { if (o.value) names.add(o.value); });
    if (source === 'custom') {
        const lists = [extension_settings['llm-translator-custom']?.custom_model_lists, extension_settings.memoria?.direct?.customModelLists, extension_settings.ban_word_rewrite?.customModelLists];
        lists.push(extension_settings['prompt-panel']?.customModelLists);
        for (const byUrl of lists) for (const entry of Object.values(byUrl || {})) for (const name of (Array.isArray(entry) ? entry : entry?.models) || []) names.add(String(name));
    }
    for (const target of listTargets()) { try { const now = target.read(); if (now?.source === source && now.model) names.add(now.model); } catch { /* 읽지 못한 대상 */ } }
    return [...names].slice(0, 400);
}

function describe(now) {
    if (!now) return '';
    if (now.follow) return now.follow;
    return `${label(now.source)} · ${now.model || '모델 없음'}`;
}

function render() {
    if (!root) return;
    const s = store(), d = s.draft, targets = listTargets();
    const active = s.presets.findIndex(p => p.source === d.source && p.model === d.model && (p.url || '') === (d.url || ''));
    root.querySelector('.ms-presets').innerHTML = s.presets.map((p, i) => `<button type="button" class="ms-chip ${i === active ? 'on' : ''}" data-preset="${i}"><b>${esc(p.name)}</b><small>${esc(p.model)}</small></button>`).join('')
        + (s.presets.length < MAX_PRESETS ? '<button type="button" class="ms-chip ms-chip-add" data-act="save" aria-label="지금 조합 저장"><i class="fa-solid fa-plus"></i></button>' : '');
    root.querySelector('[data-act="remove"]').hidden = active < 0;
    const select = root.querySelector('[data-field="source"]');
    if (!select.options.length) select.innerHTML = SOURCES.map(x => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
    select.value = d.source;
    const model = root.querySelector('[data-field="model"]'), url = root.querySelector('[data-field="url"]');
    if (document.activeElement !== model) model.value = d.model;
    if (document.activeElement !== url) url.value = d.url || '';
    root.querySelector('.ms-url').hidden = d.source !== 'custom';
    const fetchButton = root.querySelector('[data-act="fetch"]');
    fetchButton.hidden = d.source !== 'custom'; fetchButton.disabled = fetching; fetchButton.classList.toggle('is-busy', fetching);
    const box = root.querySelector('.ms-options'); box.hidden = !picking;
    root.querySelector('[data-act="pick"]').setAttribute('aria-expanded', String(picking));
    if (picking) {
        const all = modelOptions(d.source), typed = d.model.trim().toLowerCase();
        const hit = typed && !all.includes(d.model.trim()) ? all.filter(name => name.toLowerCase().includes(typed)) : all;
        const list = hit.length ? hit : all;
        box.innerHTML = list.length ? list.map(name => `<button type="button" class="ms-option ${name === d.model ? 'on' : ''}" data-model="${esc(name)}">${esc(name)}</button>`).join('')
            : `<p class="ms-empty">${d.source === 'custom' ? '이 주소의 목록이 없어요. ↻ 로 불러오거나 직접 적어 주세요.' : '목록이 없어요. 직접 적어 주세요.'}</p>`;
    }
    root.querySelector('.ms-targets').innerHTML = targets.length ? targets.map(target => {
        let now = null; try { now = target.read(); } catch { /* 읽지 못함 */ }
        const ok = supports(target, d.source);
        return `<label class="ms-target ${ok ? '' : 'is-off'}"><input type="checkbox" data-target="${esc(target.id)}" ${isOn(target) ? 'checked' : ''}><span><b>${esc(target.name)}${target.auto ? ' <em>자동</em>' : ''}</b><small>${esc(ok ? describe(now) : `${label(d.source)} 못 씀`)}</small></span><button type="button" class="ms-pull" data-pull="${esc(target.id)}" aria-label="${esc(target.name)} 값 가져오기" ${now && !now.follow ? '' : 'disabled'}><i class="fa-solid fa-arrow-up"></i></button></label>`;
    }).join('') : '<p class="ms-empty">바꿀 확장이 없어요</p>';
    const apply = root.querySelector('[data-act="apply"]');
    apply.disabled = busy || !d.model.trim() || !targets.some(target => isOn(target) && supports(target, d.source));
    root.querySelector('[data-lock]').checked = s.lock;
    root.querySelector('[role=status]').textContent = note;
}

async function applyNow() {
    if (busy) return;
    const s = store(), d = { source: s.draft.source, model: s.draft.model.trim(), url: (s.draft.url || '').trim().replace(/\/+$/, '') };
    if (!d.model) return;
    busy = true; note = '바꾸는 중…'; render();
    const done = [], skipped = [];
    for (const target of listTargets()) {
        if (!isOn(target)) continue;
        if (!supports(target, d.source)) { skipped.push(target.name); continue; }
        try {
            await withoutLock(() => target.apply(d));
            const now = target.read();
            if (now && !now.follow && now.source === d.source && now.model === d.model) done.push(target.name); else skipped.push(target.name);
        } catch (error) { console.error('[Blue Lemonade] 모델 전환', target.id, error); skipped.push(target.name); }
    }
    saveSettingsDebounced();
    busy = false;
    note = `${done.length ? `${done.join(' · ')} → ${label(d.source)} · ${d.model}` : '바뀐 확장 없음'}${skipped.length ? ` / 못 바꿈: ${skipped.join(' · ')}` : ''}`;
    if (done.length) globalThis.toastr?.success(note, '모델 전환'); else globalThis.toastr?.warning(note, '모델 전환');
    render();
}

async function savePreset() {
    const s = store(), d = s.draft;
    if (!d.model.trim()) { note = '모델 이름을 먼저 넣어 주세요'; render(); return; }
    const name = await callGenericPopup('이 조합의 이름', POPUP_TYPE.INPUT, d.source === 'custom' ? '중계' : '공식');
    if (typeof name !== 'string' || !name.trim()) return;
    const preset = { name: name.trim().slice(0, 20), source: d.source, model: d.model.trim(), url: (d.url || '').trim() };
    const same = s.presets.findIndex(p => p.name === preset.name);
    if (same >= 0) s.presets[same] = preset; else s.presets.push(preset);
    saveSettingsDebounced(); note = ''; render();
}

function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'model-switch-settings'; root.className = 'inline-drawer';
    root.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-shuffle" aria-hidden="true"></i> 모델 전환 <span class="ext-version">v${VERSION}</span></b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
<div class="inline-drawer-content">
  <div class="ms-presets"></div>
  <div class="ms-form">
    <label><span>공급자</span><select class="text_pole" data-field="source"></select></label>
    <div class="ms-row"><span>모델</span><span class="ms-model"><input class="text_pole" data-field="model" autocomplete="off" spellcheck="false" aria-label="모델"><button type="button" class="ms-icon" data-act="fetch" aria-label="이 주소의 모델 목록 불러오기" hidden><i class="fa-solid fa-rotate"></i></button><button type="button" class="ms-icon" data-act="pick" aria-label="모델 고르기" aria-expanded="false"><i class="fa-solid fa-chevron-down"></i></button></span></div>
    <div class="ms-options" hidden></div>
    <label class="ms-url"><span>주소</span><input class="text_pole" data-field="url" placeholder="비우면 각 확장의 주소 그대로" autocomplete="off" spellcheck="false"></label>
  </div>
  <div class="ms-targets"></div>
  <label class="ms-lock"><input type="checkbox" data-lock><span><b><i class="fa-solid fa-lock" aria-hidden="true"></i> 잠금</b><small>각 확장 화면에서는 못 바꾸게</small></span></label>
  <div class="ms-actions"><button type="button" class="menu_button ms-apply" data-act="apply"><i class="fa-solid fa-shuffle"></i> 바꾸기</button><button type="button" class="menu_button ms-remove" data-act="remove" aria-label="이 조합 지우기" hidden><i class="fa-solid fa-trash-can"></i></button></div>
  <p class="ms-status" role="status"></p>
</div>`;
    holder.append(root);
    root.addEventListener('input', event => {
        const field = event.target.dataset?.field; if (!field || field === 'source') return;
        store().draft[field] = event.target.value; note = ''; saveSettingsDebounced();
        if (picking) render();
        const apply = root.querySelector('[data-act="apply"]'); apply.disabled = busy || !store().draft.model.trim();
    });
    root.addEventListener('change', event => {
        const el = event.target;
        if (el.dataset?.field === 'source') {
            const s = store(); s.draft.source = el.value;
            // 공급자를 바꾸면 그 공급자로 저장해 둔 조합의 모델을 먼저 채운다
            const preset = s.presets.find(p => p.source === el.value); s.draft.model = preset?.model || ''; s.draft.url = preset?.url || '';
            note = ''; saveSettingsDebounced(); render();
        } else if (el.dataset?.field) { render(); }
        else if (el.dataset?.target) { store().targets[el.dataset.target] = el.checked; saveSettingsDebounced(); syncLocks(); render(); }
        else if ('lock' in (el.dataset || {})) { store().lock = el.checked; saveSettingsDebounced(); syncLocks(); }
    });
    root.addEventListener('click', event => {
        const chip = event.target.closest('[data-preset]'), pull = event.target.closest('[data-pull]'), act = event.target.closest('[data-act]')?.dataset.act;
        if (pull) {
            event.preventDefault();
            const now = listTargets().find(target => target.id === pull.dataset.pull)?.read();
            if (now && !now.follow) { store().draft = { source: now.source, model: now.model, url: now.url || '' }; note = ''; saveSettingsDebounced(); render(); }
            return;
        }
        if (chip) { const p = store().presets[Number(chip.dataset.preset)]; if (p) { store().draft = { source: p.source, model: p.model, url: p.url || '' }; note = ''; saveSettingsDebounced(); render(); } return; }
        const option = event.target.closest('[data-model]');
        if (option) { store().draft.model = option.dataset.model; picking = false; note = ''; saveSettingsDebounced(); render(); return; }
        if (act === 'pick') {
            picking = !picking;
            // Custom 주소인데 그 주소의 목록이 아직 없으면 열면서 바로 받아 온다
            if (picking && store().draft.source === 'custom' && !store().lists[listUrl()] && /^https?:/i.test(listUrl())) { fetchModels(); return; }
            render(); return;
        }
        if (act === 'fetch') { fetchModels(); return; }
        if (act === 'apply') applyNow();
        else if (act === 'save') savePreset();
        else if (act === 'remove') {
            const s = store(), d = s.draft;
            s.presets = s.presets.filter(p => !(p.source === d.source && p.model === d.model && (p.url || '') === (d.url || '')));
            saveSettingsDebounced(); render();
        }
    });
    const css = getComputedStyle(root).getPropertyValue('--ms-version').trim().replace(/["']/g, '');
    if (css !== VERSION) globalThis.toastr?.warning(`모델 전환 파일 버전이 달라요 (코드 ${VERSION}, 스타일 ${css || '없음'}).`);
}

export function syncMenu() {
    const s=getSettings();
    syncModelSwitchMenu(s.enabled && s.addons.modelswitch && s.addonUI.modelswitchMenu!==false, openPanel);
}

jQuery(() => { mount(); syncMenu(); syncLocks(); });
eventSource.on(event_types.SETTINGS_UPDATED, () => { if (root?.isConnected && !root.closest('[hidden]')) render(); });
window.addEventListener('bl:model-switch-targets', render);

export async function openPanel() {
    if (inlineHost?.isConnected && inlineHost.offsetParent) { root.scrollIntoView({ block: 'nearest' }); return; }
    if (opening) return; opening = true; mount(); note = ''; render();
    root.querySelector('.inline-drawer-content').style.display = 'flex';
    try { await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') }); }
    finally { (inlineHost?.isConnected ? inlineHost : holder).replaceChildren(root); opening = false; }
}

export function mountInline(host) {
    mount(); note = ''; render();
    inlineHost = host; if (opening) host.textContent = '열린 설정창을 닫으면 여기에 표시돼요.'; else host.replaceChildren(root); root.classList.add('bl-embedded-settings');
    const content = root.querySelector('.inline-drawer-content'); if (content) content.style.display = 'flex';
    return () => { if (inlineHost !== host) return; inlineHost = null; root.classList.remove('bl-embedded-settings'); if (!opening) holder.append(root); };
}
