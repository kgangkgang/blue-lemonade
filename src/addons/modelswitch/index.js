import { syncModelSwitchMenu } from './menu.js';
import { verifyAddonCss } from '../../addon-files-check.js';
import { getSettings } from '../../settings.js';
// 모델 전환 — 번역 · 기억 요약 확장 · 다시 쓰기처럼 제 모델을 따로 고르는 확장들의 공급자 · 모델을 한 번에 바꾼다.
// 중계 서버가 안 될 때 공식 API 로, 되면 다시 중계로: 조합을 저장해 두고 눌러서 바꾼다.
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../../script.js';
import { SOURCES } from '../models/sources.js';
import * as LM from '../../live-models.js';
import { listTargets, shownTargets, linkable, supports, registry, discoverTargets, modelOptions, hasModelList, listUrlOf, fetchBlock, refreshModels, autoModels } from './targets.js';
import { setLocks, withoutLock } from './lock.js';
import { MAX_STATES, entryOf, captureState, changedSince, planRestore, isCurrent, runRestore, limited, summary, keepStates } from './state.js';

import { toggleGroup, groupOn, fallbackOnly, rowActive, isFallbackRow, displayGroups } from './rows.js';
import { mountFallbackField } from './fallback-field.js';

const VERSION = '1.2.2';
const MAX_PRESETS = 8;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = source => SOURCES.find(s => s.id === source)?.label || source;
const holder = document.createElement('div'); holder.hidden = true; document.body.append(holder);
let root, inlineHost = null, opening = false, busy = false, note = '', picking = false, fetching = false;
let configuring = null;
const expandedGroups = new Set();

globalThis[Symbol.for('st.model-switch.v1')] = registry;

function store() {
    const s = extension_settings.model_switch ??= {};
    if (!s.targets || typeof s.targets !== 'object') s.targets = {};
    if (!Array.isArray(s.presets)) s.presets = [];
    s.presets = s.presets.filter(p => p && typeof p.name === 'string' && typeof p.source === 'string' && typeof p.model === 'string').slice(0, MAX_PRESETS);
    if (!s.draft || typeof s.draft !== 'object') s.draft = { source: 'custom', model: '', url: '' };
    // 1029 객체여도 칸이 글자가 아니면(옛 형식 · 모델 없이 값을 돌려준 대상에서 ↑) 창이 그릴 때마다 d.model.trim() 에서 멈췄어요
    if (typeof s.draft.source !== 'string' || !s.draft.source) s.draft.source = 'custom';
    if (typeof s.draft.model !== 'string') s.draft.model = '';
    if (typeof s.draft.url !== 'string') s.draft.url = '';
    // 예전에 받아 둔 Custom 주소별 목록 — 이제 읽기만 한다 (새 목록은 이 브라우저의 localStorage, live-models.js)
    if (!s.lists || typeof s.lists !== 'object' || Array.isArray(s.lists)) s.lists = {};
    s.lock = s.lock === true;
    // 1.1.1 상태 칩 (states ≤8 · 「↶ 직전」 last) — state.js
    return keepStates(s);
}

// 아는 확장은 처음부터 켜 두고, 자동으로 찾은 확장(1.0.5: 켜진 모든 확장의 소스로 찾음)은 직접 켤 때까지 건드리지 않는다
// 꺼진 대체 모델은 확인·설정하기 전에는 선택하지 않는다. 6.7.2 「검열되면」 단추로 확인받고 고른 꺼진 줄(armed)은 「바꾸기」 때 고른 모델로 켠다 — 창을 닫으면 잊는다.
const armed = new Set();
const canArm = target => isFallbackRow(target) && !rowActive(target) && typeof target.enable === 'function';
const isOn = target => rowActive(target) ? (store().targets[target.id] ?? !(target.auto || target.defaultOff)) : armed.has(target.id) && canArm(target);
const canPick = target => rowActive(target) || canArm(target);
const fallbackPickable = targets => targets.filter(target => isFallbackRow(target) && canPick(target));

/** 6.7.2 「검열되면」 단추 (사용자 10-15 「검열되면 버튼 누르면 검열되면 쓸 애들만 전체선택」): 검열되면 줄만 모두 고르고 일반 줄은 뺀다. 이미 모두 골랐으면 모두 끈다 */
async function pickFallbacks() {
    const rows = fallbackPickable(shownTargets()), s = store();
    if (!rows.length) return;
    if (fallbackOnly(shownTargets(), isOn, canPick)) {   // 6.7.5 이미 「검열되면 줄만」일 때만 끈다 (일반 줄과 같이 켜져 있으면 검열되면 줄만 남긴다)
        for (const target of rows) { if (rowActive(target)) s.targets[target.id] = false; else armed.delete(target.id); }
    } else {
        const off = rows.filter(target => !rowActive(target) && !armed.has(target.id));
        if (off.length && !await callGenericPopup(`꺼져 있는 「검열되면」 ${off.length}개도 고를까요? 「바꾸기」를 누르면 위에서 고른 모델로 켜져요.`, POPUP_TYPE.CONFIRM)) return;
        for (const target of shownTargets()) if (!isFallbackRow(target) && rowActive(target)) s.targets[target.id] = false;
        for (const target of rows) { if (rowActive(target)) s.targets[target.id] = true; else armed.add(target.id); }
    }
    note = ''; saveSettingsDebounced(); syncLocks(); render();
}
// 1.1.1 상태 칩에 담는 대상: 체크와 상관없이 전부 (번역만 따로 두는 식의 섞인 상태가 이 칩의 뜻) — 다만 자동으로 찾은 확장 · 처음엔 꺼 두는 확장은 직접 켰을 때만
const inState = target => !(target.auto || target.defaultOff) || store().targets[target.id] === true;

// 잠금: 체크한 확장 중 우리가 화면까지 아는 것(번역 · 기억 요약 확장 · 다시 쓰기)만 그 확장 화면에서 못 바꾸게 한다
function syncLocks() {
    const ids = store().lock ? listTargets().filter(target => !target.auto && !target.external && isOn(target)).map(target => target.id) : [];
    setLocks(ids, () => openPanel());
}

const cleanUrl = url => String(url || '').trim().replace(/\/+$/, '');
// 주소 칸이 비면 실리태번 본체의 Custom 주소가 쓰인다
const listUrl = () => listUrlOf(store().draft.url);

/** ↻ — 목록을 주는 공급자의 모델 목록을 실리태번 서버로 받아 온다 (키는 서버가 붙임). Custom 은 실리태번에 설정한 주소만 */
async function fetchModels() {
    if (fetching) return;
    const d = store().draft, block = fetchBlock(d.source, d.url);
    if (block) { note = block; render(); return; }
    fetching = true; note = '모델 목록을 불러오는 중…'; render();
    try {
        const models = await refreshModels(d.source, d.url);
        if (!models.length) throw Error('목록이 비어 있어요');
        note = `모델 ${models.length}개`; picking = true;
    } catch (error) {
        const why = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? '시간 초과'
            : error?.empty || (error?.status >= 400 && error?.status < 500) ? (d.source === 'custom' ? '주소나 키를 확인해 주세요' : '키를 확인해 주세요') : error?.message || error;
        note = `목록을 못 불러왔어요: ${why}`;
    }
    fetching = false; render();
}

/** 창을 열 때 · 공급자를 바꿀 때: 오래된 목록만 조용히 다시 받는다 (다 받으면 LM.onChange 가 다시 그림) */
function autoList() {
    const d = store().draft;
    autoModels(d.source, d.url).catch(() => {});
}

function describe(now) {
    if (!now) return '';
    // 연결 방식을 모르는 확장: 지금 연결을 따르는 채로 공급자 · 모델만 바뀐다
    if (now.follow) return now.stays && now.model ? `${now.follow} (${label(now.source)} · ${now.model})` : now.follow;
    return `${label(now.source)} · ${now.model || '모델 없음'}`;
}

async function configureFallback(id) {
    if (busy) return;
    const target = listTargets().find(item => item.id === id);
    if (!target || !isFallbackRow(target)) return;
    if (typeof target.enable !== 'function') { if (linkable(target)) return openTarget(id); return; }
    busy = true;
    try {
        if (!await callGenericPopup('검열되면 대체할 모델을 켜시겠습니까?', POPUP_TYPE.CONFIRM)) return;
        let now = null; try { now = target.read(); } catch { /* 빈칸으로 시작 */ }
        configuring = { id, settings: { fallback: { enabled: true, provider: now?.source || '', model: now?.model || '' } } };
        note = '';
    } finally { busy = false; render(); }
    root.querySelector('.ms-fallback-editor')?.scrollIntoView({ block: 'nearest' });
}

async function commitFallback() {
    if (busy || !configuring) return;
    const edit = configuring, target = listTargets().find(item => item.id === edit.id), fb = edit.settings.fallback;
    if (!target || typeof target.enable !== 'function' || !fb.enabled || !fb.provider || !fb.model?.trim() || !supports(target, fb.provider)) return;
    busy = true;
    try {
        const done = await withoutLock(() => target.enable({ source: fb.provider, model: fb.model.trim() }));
        if (done === false || !rowActive(target)) { note = '이 모델로 켜지 못했어요. 본 모델과 다른 모델을 골라 주세요.'; return; }
        store().targets[target.id] = true; configuring = null; note = `${target.name} 켰어요`;
        saveSettingsDebounced();
        window.dispatchEvent(new CustomEvent('st:model-switch-applied', { detail: { settingsKey: target.settingsKey, path: target.path } }));
    } catch (error) { note = `켜지 못했어요: ${String(error?.message || error)}`; }
    finally { busy = false; render(); }
}

function targetHtml(target, name = target.name, group = null) {
    let now = null; try { now = target.read(); } catch { /* 읽지 못함 */ }
    const active = rowActive(target), ok = supports(target, store().draft.source);
    const canEnable = !active && typeof target.enable === 'function';
    const expand = group ? `<button type="button" class="ms-expand" data-expand="${esc(group.id)}" aria-expanded="${expandedGroups.has(group.id)}" aria-label="${esc(group.name)} 세부 연결">세부 <i class="fa-solid fa-chevron-${expandedGroups.has(group.id) ? 'up' : 'down'}" aria-hidden="true"></i></button>` : '';   // 6.7.2 꺾쇠만 있으면 체크 표시로 보였다
    const title = linkable(target) || canEnable ? `<button type="button" class="ms-name" data-open="${esc(target.id)}">${esc(name)}</button>` : `<b>${esc(name)}</b>`;
    const status = !active ? '꺼짐 · 눌러서 설정' : ok ? describe(now) : `${label(store().draft.source)} 못 씀`;
    const editor = configuring?.id === target.id ? `<div class="ms-fallback-editor"><div data-fallback-editor></div><div class="ms-fallback-actions"><button type="button" class="menu_button" data-act="fallback-save">켜기</button><button type="button" class="menu_button" data-act="fallback-cancel">취소</button></div></div>` : '';
    return `<label class="ms-target ${active && !ok ? 'is-off' : ''} ${active ? '' : 'is-inactive'}"><input type="checkbox" data-target="${esc(target.id)}" ${isOn(target) ? 'checked' : ''} ${!active && !canEnable && !linkable(target) ? 'disabled' : ''}><span>${title}${expand}${target.auto ? ' <em>자동</em>' : ''}<small>${esc(status)}</small></span><button type="button" class="ms-pull" data-pull="${esc(target.id)}" aria-label="${esc(target.name)} 값 가져오기" ${now && !now.follow ? '' : 'disabled'}><i class="fa-solid fa-arrow-up"></i></button></label>${editor}`;
}

function render() {
    if (!root) return;
    discoverTargets();
    const s = store(), d = s.draft, targets = shownTargets();
    const active = s.presets.findIndex(p => p.source === d.source && p.model === d.model && (p.url || '') === (d.url || ''));
    root.querySelector('.ms-presets').innerHTML = s.presets.map((p, i) => `<button type="button" class="ms-chip ${i === active ? 'on' : ''}" data-preset="${i}"><b>${esc(p.name)}</b><small>${esc(p.model)}</small></button>`).join('')
        + (s.presets.length < MAX_PRESETS ? '<button type="button" class="ms-chip ms-chip-add" data-act="save" aria-label="지금 조합 저장"><i class="fa-solid fa-plus"></i></button>' : '');
    root.querySelector('[data-act="remove"]').hidden = active < 0;
    renderStates(s, listTargets());
    const select = root.querySelector('[data-field="source"]');
    if (!select.options.length) select.innerHTML = SOURCES.map(x => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
    select.value = d.source;
    const model = root.querySelector('[data-field="model"]'), url = root.querySelector('[data-field="url"]');
    if (document.activeElement !== model) model.value = d.model;
    if (document.activeElement !== url) url.value = d.url || '';
    root.querySelector('.ms-url').hidden = d.source !== 'custom';
    const fetchButton = root.querySelector('[data-act="fetch"]');
    fetchButton.hidden = !LM.canList(d.source); fetchButton.disabled = fetching; fetchButton.classList.toggle('is-busy', fetching);
    const box = root.querySelector('.ms-options'); box.hidden = !picking;
    root.querySelector('[data-act="pick"]').setAttribute('aria-expanded', String(picking));
    if (picking) {
        const all = modelOptions(d.source, { url: d.url }), typed = d.model.trim().toLowerCase();
        const hit = typed && !all.includes(d.model.trim()) ? all.filter(name => name.toLowerCase().includes(typed)) : all;
        const list = hit.length ? hit : all;
        box.innerHTML = list.length ? list.map(name => `<button type="button" class="ms-option ${name === d.model ? 'on' : ''}" data-model="${esc(name)}">${esc(name)}</button>`).join('')
            : `<p class="ms-empty">${d.source === 'custom' ? '이 주소의 목록이 없어요. ↻ 로 불러오거나 직접 적어 주세요.' : LM.canList(d.source) ? '목록이 없어요. ↻ 로 불러오거나 직접 적어 주세요.' : '목록이 없어요. 직접 적어 주세요.'}</p>`;
    }
    root.querySelector('.ms-targets').innerHTML = targets.length ? displayGroups(targets).map(group => {
        if (!group.children.length) return group.main.map((target, index) => targetHtml(target, index === 0 ? group.name : target.name)).join('');
        const members = [...group.main.slice(1), ...group.children];
        return `<div class="ms-target-group">${targetHtml(group.main[0], group.name, group)}<div class="ms-group-children" ${expandedGroups.has(group.id) ? '' : 'hidden'}>${members.map(target => targetHtml(target)).join('')}</div></div>`;
    }).join('') : '<p class="ms-empty">바꿀 확장이 없어요</p>';
    if (configuring) {
        const target = targets.find(item => item.id === configuring.id), host = root.querySelector('[data-fallback-editor]');
        const ready = () => { const fb = configuring?.settings.fallback, button = root.querySelector('[data-act="fallback-save"]'); if (button) button.disabled = busy || !fb?.enabled || !fb?.provider || !fb?.model?.trim() || !target || !supports(target, fb.provider); };
        if (host && target) mountFallbackField(host, { id: 'switch-editor', settings: () => configuring.settings, sources: target.sources, save: ready, notify: false });
        ready();
    }
    for (const button of root.querySelectorAll('[data-group]')) {
        const fallback = button.dataset.group === 'fallback', picks = fallbackPickable(targets);
        button.setAttribute('aria-pressed', String(fallback ? fallbackOnly(targets, isOn, canPick) : groupOn(targets, 'main', isOn)));
        button.disabled = busy || (fallback ? !picks.length : !targets.some(target => rowActive(target) && !isFallbackRow(target)));
    }
    const apply = root.querySelector('[data-act="apply"]');
    apply.disabled = busy || !d.model.trim() || !targets.some(target => isOn(target) && supports(target, d.source));
    root.querySelector('[data-lock]').checked = s.lock;
    root.querySelector('[role=status]').textContent = note;
}

// 1.1.1 상태 칩: 「↶ 직전」(바꾸기 · 칩을 누르기 직전 상태, 저절로) + 저장한 상태. 누르면 바로 모든 대상을 그 상태로 (state.js).
// 반쪽 원 = 공급자 · 모델만 되돌리는 대상이 있음 (자동으로 찾은 확장 · 연결 방식을 모르는 확장이 따름이던 줄)
function renderStates(s, targets) {
    const part = items => limited(items) ? '<i class="fa-solid fa-circle-half-stroke ms-part" role="img" aria-label="공급자 · 모델만"></i>' : '';
    const off = busy ? ' disabled' : '';
    const last = s.last ? `<button type="button" class="ms-chip ms-last" data-state="last"${off}><b><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> 직전${part(s.last.items)}</b><small>${esc(summary(s.last.items))}</small></button>` : '';
    root.querySelector('.ms-states').innerHTML = last + s.states.map((state, i) => `<div class="ms-chip ms-state ${isCurrent(state.items, targets) ? 'on' : ''}"><button type="button" class="ms-state-go" data-state="${i}"${off}><b><i class="fa-solid fa-layer-group" aria-hidden="true"></i> <span class="ms-state-name">${esc(state.name)}</span>${part(state.items)}</b><small>${esc(summary(state.items))}</small></button><button type="button" class="ms-state-x" data-state-del="${i}" aria-label="${esc(state.name)} 지우기"${off}><i class="fa-solid fa-xmark"></i></button></div>`).join('');
    const snap = root.querySelector('[data-act="snap"]');
    snap.hidden = s.states.length >= MAX_STATES; snap.disabled = busy;
}

/** 「↶ 직전」에 남긴다 — 실제로 바뀐 대상만, 바꾸기 전 상태로 (바뀐 게 없으면 예전 「직전」 그대로) */
function remember(items) {
    if (Object.keys(items).length) store().last = { at: Date.now(), items };
}

async function applyNow() {
    if (busy) return;
    const s = store(), d = { source: s.draft.source, model: s.draft.model.trim(), url: (s.draft.url || '').trim().replace(/\/+$/, '') };
    if (!d.model) return;
    busy = true; note = '바꾸는 중…'; render();
    // 자동 찾기가 느린 서버에서 멈춰도 아는 확장은 바꾼다 (3초까지만 기다림)
    await Promise.race([discoverTargets().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
    const done = [], partial = [], skipped = [], touched = [], before = [];
    for (const target of shownTargets()) {
        if (!isOn(target)) continue;
        if (!supports(target, d.source)) { skipped.push(target.name); continue; }
        if (!rowActive(target)) {   // 6.7.2 「검열되면」 단추로 고른 꺼진 줄: 이 모델로 켠다 (본 모델과 같으면 못 켬)
            try {
                const ok = await withoutLock(() => target.enable({ source: d.source, model: d.model }));
                if (ok === false || !rowActive(target)) { skipped.push(target.name); continue; }
                armed.delete(target.id); store().targets[target.id] = true; touched.push(target); done.push(target.name);
            } catch (error) { console.error('[Blue Lemonade] 모델 전환 · 검열되면 켜기', target.id, error); skipped.push(target.name); }
            continue;
        }
        before.push([target, entryOf(target)]);   // 1.1.1 「↶ 직전」
        try {
            await withoutLock(() => target.apply(d));
            touched.push(target);
            const now = target.read();
            if (!now || (now.follow && !now.stays) || now.source !== d.source || now.model !== d.model) skipped.push(target.name);
            // 연결 방식을 몰라 공급자 · 모델만 바꾼 확장은 여전히 지금 연결(또는 자체 주소)을 쓴다 — 바뀐 것으로 세지 않는다
            else if (now.follow) partial.push(`${target.name}: 공급자만 바꿈 (${now.follow} 따름)`);
            // 주소를 넣었는데 이 확장에 주소 칸이 없으면 주소는 예전 그대로
            else if (d.source === 'custom' && d.url && cleanUrl(now.url) !== d.url) partial.push(`${target.name}: 주소는 그대로`);
            else done.push(target.name);
        } catch (error) { console.error('[Blue Lemonade] 모델 전환', target.id, error); skipped.push(target.name); }
    }
    remember(changedSince(before));
    saveSettingsDebounced();
    // 자동으로 찾은 확장은 화면을 다시 그리라고 알릴 길이 이 이벤트뿐 (registry 주석 참고)
    for (const target of touched) window.dispatchEvent(new CustomEvent('st:model-switch-applied', { detail: { settingsKey: target.settingsKey, path: target.path } }));
    busy = false;
    note = [done.length ? `${done.join(' · ')} → ${label(d.source)} · ${d.model}` : '바뀐 확장 없음', ...partial, skipped.length ? `못 바꿈: ${skipped.join(' · ')}` : ''].filter(Boolean).join(' / ');
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

// 1.1.1 지금 상태 저장: 대상마다 지금 공급자 · 모델(아는 확장은 연결 방식까지)을 누른 순간 그대로 — 이름만 묻는다 (같은 이름이면 덮어씀).
// 찾기를 기다리는 동안 · 이름 창이 열린 동안은 busy — 두 번 눌러도 창은 하나, 그 사이에 바꾸기 · 칩 누름이 끼지 않는다 (바꾸기 · 상태 칩과 같은 규칙)
async function saveState() {
    if (busy || store().states.length >= MAX_STATES) return;
    busy = true; render();
    try {
        await Promise.race([discoverTargets().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
        const items = captureState(listTargets(), inState);
        if (!Object.keys(items).length) { note = '저장할 확장이 없어요'; return; }
        const used = new Set(store().states.map(state => state.name));
        let n = used.size + 1; while (used.has(`상태 ${n}`)) n++;
        const name = await callGenericPopup('이 상태의 이름', POPUP_TYPE.INPUT, used.has('평소') ? `상태 ${n}` : '평소');
        if (typeof name !== 'string' || !name.trim()) return;
        const state = { name: name.trim().slice(0, 20), items };
        const list = store().states, same = list.findIndex(x => x.name === state.name);
        if (same >= 0) list[same] = state; else if (list.length < MAX_STATES) list.push(state); else return;
        saveSettingsDebounced(); note = `「${state.name}」 저장 · ${Object.keys(items).length}개`;
    } finally { busy = false; render(); }
}

// 1.1.1 상태 칩 누름: 바로 모든 대상을 그 상태로 (지금과 같은 대상은 안 씀 · 쓰는 순서는 각 대상의 apply 그대로).
// 누르기 직전 상태는 「↶ 직전」으로 — 「직전」을 누르면 그 전으로 돌아가고, 한 번 더 누르면 제자리
async function applyState(which) {
    if (busy) return;
    const s = store(), state = which === 'last' ? s.last : s.states[Number(which)];
    if (!state?.items) return;
    const title = which === 'last' ? '직전' : state.name;
    busy = true; note = '되돌리는 중…'; render();
    await Promise.race([discoverTargets().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
    let result = { done: [], partial: [], failed: [], before: {}, touched: [] };
    try { result = await runRestore(planRestore(state.items, listTargets()), job => withoutLock(job), (target, error) => console.error('[Blue Lemonade] 모델 전환', target.id, error)); }
    catch (error) { console.error('[Blue Lemonade] 모델 전환', error); }
    remember(result.before);
    saveSettingsDebounced();
    for (const target of result.touched) window.dispatchEvent(new CustomEvent('st:model-switch-applied', { detail: { settingsKey: target.settingsKey, path: target.path } }));
    busy = false;
    const { done, partial, failed, same } = result;
    // 바뀐 것 없이 같은 칩을 다시 누름 = 돌아올 수 있는 대상은 모두 그 상태 (못 돌리는 대상만 남았을 수 있다)
    const retap = !done.length && !partial.length && same > 0;
    note = [retap ? `이미 「${title}」 상태예요` : '', done.length ? `${done.join(' · ')} → 「${title}」` : '', partial.length ? `공급자 · 모델만: ${partial.join(' · ')}` : '', failed.length ? `못 바꿈: ${failed.join(' · ')}` : ''].filter(Boolean).join(' / ');
    // 된 것은 칩 불빛 · 대상 줄 · 상태 줄로 보인다 — 알림은 못 바꾼 대상이 있을 때만 (상태 줄이 화면 밖일 수 있어서).
    // 다시 누름이면 상태 줄만: 못 돌리는 대상(연결 방식을 모르는 확장이 따름이던 줄 · 없어진 확장)은 누를 때마다 같아서 경고를 되풀이하지 않는다
    if (failed.length && !retap) globalThis.toastr?.warning(note, '모델 전환');
    render();
}

async function deleteState(index) {
    const state = store().states[index];
    if (!state || busy || !await callGenericPopup(`「${esc(state.name)}」 지울까요?`, POPUP_TYPE.CONFIRM)) return;
    const list = store().states, at = list.indexOf(state);
    if (at >= 0) list.splice(at, 1);
    saveSettingsDebounced(); note = ''; render();
}

async function openTarget(id) {
    const target = listTargets().find(item => item.id === id);
    if (!linkable(target)) return;
    const dialog = root?.closest('dialog[open]');
    (dialog?.querySelector('.popup-button-ok') || dialog?.querySelector('.popup-button-close'))?.click();
    // Let openPanel's finally restore its DOM before opening another popup.
    if (dialog) await new Promise(resolve => setTimeout(resolve, 100));
    try { await target.open(); } catch (error) { console.warn('[Blue Lemonade] 설정 열기', error); }
}

function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'model-switch-settings'; root.className = 'inline-drawer';
    root.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-shuffle" aria-hidden="true"></i> 모델 전환 <span class="ext-version">v${VERSION}</span></b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
<div class="inline-drawer-content">
  <div class="ms-presets"></div>
  <div class="ms-states"></div>
  <div class="ms-form">
    <label><span>공급자</span><select class="text_pole" data-field="source"></select></label>
    <div class="ms-row"><span>모델</span><span class="ms-model"><input class="text_pole" data-field="model" autocomplete="off" spellcheck="false" aria-label="모델"><button type="button" class="ms-icon" data-act="fetch" aria-label="모델 목록 불러오기" hidden><i class="fa-solid fa-rotate"></i></button><button type="button" class="ms-icon" data-act="pick" aria-label="모델 고르기" aria-expanded="false"><i class="fa-solid fa-chevron-down"></i></button></span></div>
    <div class="ms-options" hidden></div>
    <label class="ms-url"><span>주소</span><input class="text_pole" data-field="url" placeholder="비우면 각 확장의 주소 그대로" autocomplete="off" spellcheck="false"></label>
  </div>
  <div class="ms-groups"><button type="button" class="menu_button" data-group="main" aria-pressed="false"><i class="fa-solid fa-check-double" aria-hidden="true"></i> 전체</button><button type="button" class="menu_button" data-group="fallback" aria-pressed="false"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> 검열되면</button></div>
  <div class="ms-targets"></div>
  <label class="ms-lock"><input type="checkbox" data-lock><span><b><i class="fa-solid fa-lock" aria-hidden="true"></i> 잠금</b><small>각 확장 화면에서는 못 바꾸게 · 자동은 제외</small></span></label>
  <div class="ms-actions"><button type="button" class="menu_button ms-apply" data-act="apply"><i class="fa-solid fa-shuffle"></i> 바꾸기</button><button type="button" class="menu_button ms-invert" data-act="invert" aria-label="체크 반전"><i class="fa-solid fa-right-left"></i></button><button type="button" class="menu_button ms-snap" data-act="snap" aria-label="지금 상태 저장"><i class="fa-solid fa-floppy-disk"></i></button><button type="button" class="menu_button ms-remove" data-act="remove" aria-label="이 조합 지우기" hidden><i class="fa-solid fa-trash-can"></i></button></div>
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
            note = ''; saveSettingsDebounced(); render(); autoList();
        } else if (el.dataset?.field) { render(); }
        else if (el.dataset?.target) {
            const target = listTargets().find(item => item.id === el.dataset.target);
            if (target && !rowActive(target)) {
                if (armed.has(target.id)) { armed.delete(target.id); render(); return; }   // 6.7.2 「검열되면」 단추로 고른 꺼진 줄은 체크로 뺄 수 있다
                el.checked = false; configureFallback(target.id); return;
            }
            store().targets[el.dataset.target] = el.checked; saveSettingsDebounced(); syncLocks(); render();
        }
        else if ('lock' in (el.dataset || {})) { store().lock = el.checked; saveSettingsDebounced(); syncLocks(); }
    });
    root.addEventListener('click', event => {
        const expand = event.target.closest('[data-expand]');
        if (expand) { event.preventDefault(); if (expandedGroups.has(expand.dataset.expand)) expandedGroups.delete(expand.dataset.expand); else expandedGroups.add(expand.dataset.expand); render(); return; }
        const link = event.target.closest('[data-open]'), group = event.target.closest('[data-group]');
        if (link) { event.preventDefault(); const target = listTargets().find(item => item.id === link.dataset.open); if (!busy) { if (target && !rowActive(target)) configureFallback(target.id); else openTarget(link.dataset.open); } return; }
        if (group) {
            event.preventDefault();
            if (busy) return;
            if (group.dataset.group === 'fallback') { pickFallbacks(); return; }
            Object.assign(store().targets, toggleGroup(shownTargets(), group.dataset.group, isOn)); saveSettingsDebounced(); syncLocks(); render(); return;
        }
        const chip = event.target.closest('[data-preset]'), pull = event.target.closest('[data-pull]'), act = event.target.closest('[data-act]')?.dataset.act;
        const stateDel = event.target.closest('[data-state-del]'), stateGo = event.target.closest('[data-state]');
        if (stateDel) { deleteState(Number(stateDel.dataset.stateDel)); return; }
        if (stateGo) { applyState(stateGo.dataset.state); return; }
        if (pull) {
            event.preventDefault();
            const now = listTargets().find(target => target.id === pull.dataset.pull)?.read();
            if (now && !now.follow) { store().draft = { source: now.source, model: now.model, url: now.url || '' }; note = ''; saveSettingsDebounced(); render(); autoList(); }
            return;
        }
        if (chip) { const p = store().presets[Number(chip.dataset.preset)]; if (p) { store().draft = { source: p.source, model: p.model, url: p.url || '' }; note = ''; saveSettingsDebounced(); render(); autoList(); } return; }
        const option = event.target.closest('[data-model]');
        if (option) { store().draft.model = option.dataset.model; picking = false; note = ''; saveSettingsDebounced(); render(); return; }
        if (act === 'pick') {
            picking = !picking;
            // Custom 주소인데 그 주소의 목록이 아직 없으면 열면서 바로 받아 온다 (그 밖은 오래된 목록만 조용히)
            if (picking && store().draft.source === 'custom' && !hasModelList('custom', store().draft.url) && /^https?:/i.test(listUrl())) { fetchModels(); return; }
            if (picking) autoList();
            render(); return;
        }
        if (act === 'fetch') { fetchModels(); return; }
        if (act === 'fallback-save') { commitFallback(); return; }
        if (act === 'fallback-cancel') { configuring = null; render(); return; }
        if (act === 'apply') applyNow();
        // 체크 반전 (사용자 10-12 「선택된 상태로 반전 선택 가능하게 — 누르면 안 선택한 애들 선택되고 선택한 애 안 선택되게」): 지금 보이는 확장만 뒤집는다
        else if (act === 'invert') { const s = store(); for (const target of shownTargets()) if (rowActive(target)) s.targets[target.id] = !isOn(target); note = ''; saveSettingsDebounced(); syncLocks(); render(); }
        else if (act === 'save') savePreset();
        else if (act === 'snap') saveState();
        else if (act === 'remove') {
            const s = store(), d = s.draft;
            s.presets = s.presets.filter(p => !(p.source === d.source && p.model === d.model && (p.url || '') === (d.url || '')));
            saveSettingsDebounced(); render();
        }
    });
    // 목록을 새로 받으면 (↻ · 조용히 다시 · 실리태번이 연결하며 받은 목록) 보이는 창만 다시 그린다 — 모델 칸 · 목록을 만지는 중이면 다음 입력 때
    LM.onChange(({ source }) => {
        if (!root?.isConnected || root.closest('[hidden]') || source !== LM.sourceOf(store().draft.source)) return;
        const active = document.activeElement;
        if (active && (active === root.querySelector('[data-field="model"]') || root.querySelector('.ms-options')?.contains(active))) return;
        render();
    });
    verifyAddonCss({ folder: 'modelswitch', name: '--ms-version', version: VERSION, title: '모델 전환', selector: '#model-switch-settings' });
}

export function syncMenu() {
    const s=getSettings();
    syncModelSwitchMenu(s.enabled && s.addons.modelswitch && s.addonUI.modelswitchMenu!==false, openPanel);
}

// 창이 보일 때만 다시 그린다 — 숨은 보관함(holder) 안이면 열 때 openPanel · mountInline 이 먼저 그린다
const shown = () => !!root?.isConnected && !root.closest('[hidden]');
jQuery(() => { mount(); syncMenu(); syncLocks(); });
eventSource.on(event_types.SETTINGS_UPDATED, () => { if (shown()) render(); });
// 5.8.4: 대상이 바뀌었다는 알림(다른 확장의 등록 — TTS 가 부팅 때 함 · 자동 찾기 끝)도 보일 때만 그린다. 전엔 숨은 창을 그리다가 render 가
// 자동 찾기(켜진 확장의 소스 읽기 — 폰 리그 4배 부팅 꼬리 settingsRefs 85~100 ms)를 부팅 때 시작했다. 찾기는 원래 뜻대로 창을 처음 그릴 때
// (openPanel · mountInline → render) 시작하고, 바꾸기(applyNow)는 그 찾기를 기다린다 — 찾는 대상 · 결과는 같다
window.addEventListener('bl:model-switch-targets', () => { if (shown()) render(); });

export async function openPanel() {
    if (inlineHost?.isConnected && inlineHost.offsetParent) { root.scrollIntoView({ block: 'nearest' }); return; }
    if (opening) return; opening = true; mount(); note = ''; render(); autoList();
    root.querySelector('.inline-drawer-content').style.display = 'flex';
    try { await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') }); }
    finally { armed.clear(); (inlineHost?.isConnected ? inlineHost : holder).replaceChildren(root); opening = false; }   // 6.7.5 「검열되면」으로 고른 꺼진 줄은 창을 닫으면 잊는다 (주석대로 — 전엔 다시 열어도 골라진 채였다)
}

export function mountInline(host) {
    mount(); note = ''; render(); autoList();
    inlineHost = host; if (opening) host.textContent = '열린 설정창을 닫으면 여기에 표시돼요.'; else host.replaceChildren(root); root.classList.add('bl-embedded-settings');
    const content = root.querySelector('.inline-drawer-content'); if (content) content.style.display = 'flex';
    return () => { if (inlineHost !== host) return; inlineHost = null; armed.clear(); root.classList.remove('bl-embedded-settings'); if (!opening) holder.append(root); };
}
