import { syncModelSwitchMenu } from './menu.js';
import { verifyAddonCss } from '../../addon-files-check.js';
import { getSettings } from '../../settings.js';
// 모델 전환 — 번역 · 장기 기억 · 다시 쓰기처럼 제 모델을 따로 고르는 확장들의 공급자 · 모델을 한 번에 바꾼다.
// 중계 서버가 안 될 때 공식 API 로, 되면 다시 중계로: 조합을 저장해 두고 눌러서 바꾼다.
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../../script.js';
import { SOURCES } from '../models/sources.js';
import * as LM from '../../live-models.js';
import { listTargets, supports, registry, discoverTargets, modelOptions, hasModelList, listUrlOf, fetchBlock, refreshModels, autoModels } from './targets.js';
import { setLocks, withoutLock } from './lock.js';

const VERSION = '1.0.7';
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
    // 예전에 받아 둔 Custom 주소별 목록 — 이제 읽기만 한다 (새 목록은 이 브라우저의 localStorage, live-models.js)
    if (!s.lists || typeof s.lists !== 'object' || Array.isArray(s.lists)) s.lists = {};
    s.lock = s.lock === true;
    return s;
}

// 아는 확장은 처음부터 켜 두고, 자동으로 찾은 확장(1.0.5: 켜진 모든 확장의 소스로 찾음)은 직접 켤 때까지 건드리지 않는다
const isOn = target => store().targets[target.id] ?? !target.auto;

// 잠금: 체크한 확장 중 우리가 화면까지 아는 것(번역 · 장기 기억 · 다시 쓰기)만 그 확장 화면에서 못 바꾸게 한다
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

function render() {
    if (!root) return;
    discoverTargets();
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
    // 자동 찾기가 느린 서버에서 멈춰도 아는 확장은 바꾼다 (3초까지만 기다림)
    await Promise.race([discoverTargets().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
    const done = [], partial = [], skipped = [], touched = [];
    for (const target of listTargets()) {
        if (!isOn(target)) continue;
        if (!supports(target, d.source)) { skipped.push(target.name); continue; }
        try {
            await withoutLock(() => target.apply(d));
            if (target.auto) touched.push(target);
            const now = target.read();
            if (!now || (now.follow && !now.stays) || now.source !== d.source || now.model !== d.model) skipped.push(target.name);
            // 연결 방식을 몰라 공급자 · 모델만 바꾼 확장은 여전히 지금 연결(또는 자체 주소)을 쓴다 — 바뀐 것으로 세지 않는다
            else if (now.follow) partial.push(`${target.name}: 공급자만 바꿈 (${now.follow} 따름)`);
            // 주소를 넣었는데 이 확장에 주소 칸이 없으면 주소는 예전 그대로
            else if (d.source === 'custom' && d.url && cleanUrl(now.url) !== d.url) partial.push(`${target.name}: 주소는 그대로`);
            else done.push(target.name);
        } catch (error) { console.error('[Blue Lemonade] 모델 전환', target.id, error); skipped.push(target.name); }
    }
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

function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'model-switch-settings'; root.className = 'inline-drawer';
    root.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-shuffle" aria-hidden="true"></i> 모델 전환 <span class="ext-version">v${VERSION}</span></b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
<div class="inline-drawer-content">
  <div class="ms-presets"></div>
  <div class="ms-form">
    <label><span>공급자</span><select class="text_pole" data-field="source"></select></label>
    <div class="ms-row"><span>모델</span><span class="ms-model"><input class="text_pole" data-field="model" autocomplete="off" spellcheck="false" aria-label="모델"><button type="button" class="ms-icon" data-act="fetch" aria-label="모델 목록 불러오기" hidden><i class="fa-solid fa-rotate"></i></button><button type="button" class="ms-icon" data-act="pick" aria-label="모델 고르기" aria-expanded="false"><i class="fa-solid fa-chevron-down"></i></button></span></div>
    <div class="ms-options" hidden></div>
    <label class="ms-url"><span>주소</span><input class="text_pole" data-field="url" placeholder="비우면 각 확장의 주소 그대로" autocomplete="off" spellcheck="false"></label>
  </div>
  <div class="ms-targets"></div>
  <label class="ms-lock"><input type="checkbox" data-lock><span><b><i class="fa-solid fa-lock" aria-hidden="true"></i> 잠금</b><small>각 확장 화면에서는 못 바꾸게 · 자동은 제외</small></span></label>
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
            note = ''; saveSettingsDebounced(); render(); autoList();
        } else if (el.dataset?.field) { render(); }
        else if (el.dataset?.target) { store().targets[el.dataset.target] = el.checked; saveSettingsDebounced(); syncLocks(); render(); }
        else if ('lock' in (el.dataset || {})) { store().lock = el.checked; saveSettingsDebounced(); syncLocks(); }
    });
    root.addEventListener('click', event => {
        const chip = event.target.closest('[data-preset]'), pull = event.target.closest('[data-pull]'), act = event.target.closest('[data-act]')?.dataset.act;
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
        if (act === 'apply') applyNow();
        else if (act === 'save') savePreset();
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
    finally { (inlineHost?.isConnected ? inlineHost : holder).replaceChildren(root); opening = false; }
}

export function mountInline(host) {
    mount(); note = ''; render(); autoList();
    inlineHost = host; if (opening) host.textContent = '열린 설정창을 닫으면 여기에 표시돼요.'; else host.replaceChildren(root); root.classList.add('bl-embedded-settings');
    const content = root.querySelector('.inline-drawer-content'); if (content) content.style.display = 'flex';
    return () => { if (inlineHost !== host) return; inlineHost = null; root.classList.remove('bl-embedded-settings'); if (!opening) holder.append(root); };
}
