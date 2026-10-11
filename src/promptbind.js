// 프롬프트 귀속 (6.0.4) — 프롬프트 관리자(Chat Completion 프리셋)의 항목을 캐릭터 · 그룹 · 채팅에 묶어 두면,
// 그 채팅을 열 때 그 항목이 켜지고 다른 채팅으로 가면 꺼진다 (사용자: "대사 컬러 프롬은 그 캐릭터한테만 귀속").
// 항목에 정규식(전역 정규식 스크립트)을 붙여 두면 그 정규식도 같이 켜지고 꺼진다 ("정규식도 캐릭터 연동 · 프롬프트에서 조작").
// 켜짐을 바꾸면 실리태번이 설정을 저장하므로 정규식 연결 애드온(regexlink)으로 이은 정규식도 따라간다.
//
// 설정: promptBinds { <프롬프트 identifier>: { keys: ['c:<아바타 파일>' | 'g:<그룹 id>' | 'c:<아바타>/<채팅 파일>' | 'g:<그룹>/<채팅>'], regex: [<정규식 스크립트 id>] } } (settings.js)
// UI: 실리태번 프롬프트 편집 창(#completion_prompt_manager_popup_edit) 맨 아래 「자동 켜기」 줄 — 지금 캐릭터 · 지금 채팅 · 목록 · 정규식 · 묶인 칩(×)
// 메모 애드온의 귀속(캐릭터 전체 / 이 채팅)과 같은 열쇠 체계. 그룹 채팅은 'g:' 열쇠. 열쇠 이름은 styles.js keyLabel.
import { getSettings, saveSettings } from './settings.js';
import { currentKey, keyLabel } from './styles.js';

const POPUP_FORM = 'completion_prompt_manager_popup_edit';
const SAVE_BUTTON = 'completion_prompt_manager_popup_entry_form_save';
let pm = null;          // 실리태번 promptManager (openai.js) — 검사에서는 setPromptManager 로 꽂는다
let listening = false, observer = null, syncing = null, rerun = false, settleTimer = 0;

/** 검사 · 다른 모듈용: 프롬프트 관리자 주입 */
export function setPromptManager(manager) { pm = manager || null; }
async function manager() {
    if (pm) return pm;   // 검사가 꽂은 것만 붙잡아 둔다
    // 실리태번의 promptManager 는 live binding 이라 매번 읽는다 — 한 번 붙잡아 두면 실리태번이 새로 만든 뒤 옛 인스턴스를 바꾸게 된다 (10-11 스모크: 켜기는 되고 끄기는 안 됨)
    try { return (await import('../../../../openai.js')).promptManager || null; } catch { return null; }
}

// ───────── 열쇠 ─────────
/** 지금 채팅의 열쇠: 'c:아바타/채팅' | 'g:그룹/채팅' ('' = 채팅 없음) */
export function currentChatKey() {
    const ctx = SillyTavern.getContext();
    const base = currentKey();
    const chat = ctx.chatId ?? ctx.getCurrentChatId?.();
    return base && chat ? `${base}/${String(chat)}` : '';
}
/** 지금 열린 곳에 맞는 열쇠들 (캐릭터 · 채팅) */
export function currentKeys() { return [currentKey(), currentChatKey()].filter(Boolean); }
export function isChatKey(key) { return /^[cg]:.+\/.+/.test(String(key || '')); }
/** 열쇠 → 보이는 이름 ('이름' 또는 '이름 · 채팅') */
export function bindLabel(key) {
    const k = String(key || '');
    if (!isChatKey(k)) return keyLabel(k);
    const at = k.indexOf('/');
    return `${keyLabel(k.slice(0, at))} · ${k.slice(at + 1).replace(/\.jsonl$/i, '')}`;
}

// ───────── 정규식 (전역 정규식 스크립트) ─────────
/** 전역 정규식 스크립트 목록 (확장 설정 regex) — 없으면 [] */
export function regexScripts() {
    try { const list = SillyTavern.getContext().extensionSettings?.regex; return Array.isArray(list) ? list : []; } catch { return []; }
}
export function regexName(id) { return regexScripts().find(s => s && s.id === id)?.scriptName || String(id || ''); }

// ───────── 저장 ─────────
function binds() { const s = getSettings(); if (!s.promptBinds || typeof s.promptBinds !== 'object') s.promptBinds = {}; return s.promptBinds; }
function entryOf(identifier, create) {
    const all = binds(); const id = String(identifier || '');
    if (!id) return null;
    if (!all[id] && create) all[id] = { keys: [], regex: [] };
    return all[id] || null;
}
function prune(identifier) { const all = binds(); const b = all[identifier]; if (b && !(b.keys?.length) && !(b.regex?.length)) delete all[identifier]; }
export function keysOf(identifier) { const b = binds()[identifier]; return Array.isArray(b?.keys) ? [...b.keys] : []; }
export function regexOf(identifier) { const b = binds()[identifier]; return Array.isArray(b?.regex) ? [...b.regex] : []; }
export function hasBind(identifier, key) { return keysOf(identifier).includes(key); }
export function setBind(identifier, key, on) {
    const k = String(key || '');
    if (!/^[cg]:./.test(k)) return false;
    const b = entryOf(identifier, true);
    if (!b) return false;
    const keys = new Set(Array.isArray(b.keys) ? b.keys : []);
    if (on) keys.add(k); else keys.delete(k);
    b.keys = [...keys];
    prune(identifier);
    saveSettings();
    return true;
}
/** 이 프롬프트와 함께 켜고 끌 정규식 스크립트 */
export function setBindRegex(identifier, scriptId, on) {
    const sid = String(scriptId || '');
    if (!sid) return false;
    const b = entryOf(identifier, true);
    if (!b) return false;
    const set = new Set(Array.isArray(b.regex) ? b.regex : []);
    if (on) set.add(sid); else set.delete(sid);
    b.regex = [...set];
    prune(identifier);
    saveSettings();
    return true;
}
export function clearBinds(identifier) { const all = binds(); if (!all[identifier]) return false; delete all[identifier]; saveSettings(); return true; }
/** 캐릭터 파일 이름이 바뀌면 열쇠를 옮긴다 (CHARACTER_RENAMED) */
export function renameKeys(oldAvatar, newAvatar) {
    if (typeof oldAvatar !== 'string' || typeof newAvatar !== 'string' || !oldAvatar || !newAvatar || oldAvatar === newAvatar) return 0;
    const from = `c:${oldAvatar}`, to = `c:${newAvatar}`;
    let n = 0;
    for (const bind of Object.values(binds())) {
        if (!Array.isArray(bind.keys)) continue;
        bind.keys = bind.keys.map(k => { if (k === from) { n++; return to; } if (k.startsWith(from + '/')) { n++; return to + k.slice(from.length); } return k; });
    }
    if (n) saveSettings();
    return n;
}

// ───────── 맞추기 ─────────
/** 이 묶음이 지금 열린 곳에서 켜져야 하나 (캐릭터 열쇠가 하나도 없으면 null = 판단하지 않음 — 정규식만 붙인 묶음) */
export function wanted(bind, keys = currentKeys()) {
    if (!Array.isArray(bind?.keys) || !bind.keys.length) return null;
    return bind.keys.some(k => keys.includes(k));
}
/** 묶인 프롬프트(와 붙인 정규식)를 지금 채팅에 맞춰 켜고 끈다 → 바꾼 개수 (프롬프트 관리자가 없거나 묶음이 없으면 0) */
export async function syncPromptBinds() {
    if (syncing) { rerun = true; return syncing; }   // 맞추는 중에 또 부르면(채팅이 바로 또 바뀜) 끝난 뒤 한 번 더
    syncing = (async () => {
        const all = binds();
        const ids = Object.keys(all);
        if (!ids.length) return 0;
        const m = await manager();
        if (!m?.activeCharacter || typeof m.getPromptOrderEntry !== 'function') return 0;
        const keys = currentKeys();
        const scripts = regexScripts();
        let changed = 0, regexChanged = 0;
        for (const id of ids) {
            const want = wanted(all[id], keys);
            if (want === null) continue;
            let entry = null;
            try { entry = m.getPromptOrderEntry(m.activeCharacter, id); } catch { entry = null; }
            if (entry && (entry.enabled !== false) !== want) { entry.enabled = want; changed++; }
            for (const sid of (Array.isArray(all[id].regex) ? all[id].regex : [])) {
                const sc = scripts.find(s => s && s.id === sid);
                if (sc && (sc.disabled === true) !== !want) { sc.disabled = !want; regexChanged++; }
            }
        }
        if (changed) {
            // 저장은 기다리지 않는다 — 실리태번의 saveServiceSettings 는 SETTINGS_UPDATED 가 올 때까지 매달리는데(1초 넘게 · 생성 중엔 더),
            // 그동안 잠금(syncing)이 잡혀 있으면 바로 이어진 채팅 바뀜의 맞추기가 통째로 버려졌다 (10-11 스모크: 켜기는 되고 나가도 안 꺼짐)
            try { Promise.resolve(m.saveServiceSettings?.()).catch(() => { /* 저장 실패해도 화면은 맞춘다 */ }); } catch { /* 저장 없음 */ }
            try { m.render?.(false); } catch { /* 그리기 실패는 무시 */ }
            // 10-11 스모크: 저장 · 그리기 뒤에 항목이 켜짐으로 되돌아오는 일이 있었다 → 잠시 뒤 다시 맞춘다 (맞으면 아무것도 안 하니 되돌이표 없음; 잠금 밖에서)
            for (const ms of [350, 1200]) setTimeout(() => { syncPromptBinds(); }, ms);
        }
        if (regexChanged && !changed) { try { SillyTavern.getContext().saveSettingsDebounced?.(); } catch { /* 저장 없음 */ } }
        return changed + regexChanged;
    })().finally(() => { syncing = null; if (rerun) { rerun = false; syncPromptBinds(); } });
    return syncing;
}

// ───────── 편집 창 UI ─────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function editingId() { return document.getElementById(SAVE_BUTTON)?.dataset?.pmPrompt || ''; }
function promptName(id) {
    try { return pm?.getPromptById?.(id)?.name || id; } catch { return id; }
}
function block() {
    const form = document.getElementById(POPUP_FORM);
    if (!form) return null;
    let box = form.querySelector('#bl_prompt_bind');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'bl_prompt_bind';
    box.className = 'bl-pbind';
    box.innerHTML = '<div class="bl-pbind-row"><span class="bl-pbind-title">자동 켜기</span>'
        + '<button type="button" class="menu_button bl-pbind-add" data-kind="char">+ 지금 캐릭터</button>'
        + '<button type="button" class="menu_button bl-pbind-add" data-kind="chat">+ 지금 채팅</button>'
        + '<button type="button" class="menu_button bl-pbind-pick">목록</button>'
        + '<button type="button" class="menu_button bl-pbind-regex">정규식</button></div>'
        + '<div class="bl-pbind-chips"></div>'
        + '<small class="bl-pbind-hint">묶은 캐릭터·채팅을 열면 이 프롬프트가 켜지고 나가면 꺼져요. 붙인 정규식과 정규식 연결도 따라가요.</small>';
    box.addEventListener('click', onClick);
    form.append(box);
    return box;
}
function renderChips(box = block()) {
    if (!box) return;
    const id = editingId();
    const chips = box.querySelector('.bl-pbind-chips');
    const keys = id ? keysOf(id) : [], regex = id ? regexOf(id) : [];
    const sig = id + '|' + keys.join(',') + '|' + regex.join(',');
    if (chips.dataset.sig === sig) return;   // 같은 내용이면 다시 그리지 않는다 (관찰자 되먹임 방지)
    chips.dataset.sig = sig;
    chips.innerHTML = keys.map(k => `<span class="bl-pbind-chip${isChatKey(k) ? ' is-chat' : ''}" data-key="${esc(k)}">${esc(bindLabel(k))}<button type="button" class="bl-pbind-x" aria-label="풀기">×</button></span>`).join('')
        + regex.map(r => `<span class="bl-pbind-chip is-regex" data-regex="${esc(r)}">정규식 · ${esc(regexName(r))}<button type="button" class="bl-pbind-x" aria-label="풀기">×</button></span>`).join('');
    chips.hidden = !keys.length && !regex.length;
}
function note(text) { try { toastr.info(text); } catch { /* 알림 없음 */ } }
async function onClick(event) {
    const id = editingId();
    if (!id) { if (event.target.closest('button')) note('프롬프트를 먼저 열어요'); return; }
    const x = event.target.closest('.bl-pbind-x');
    if (x) {
        const chip = x.closest('.bl-pbind-chip');
        if (chip?.dataset.regex) setBindRegex(id, chip.dataset.regex, false); else setBind(id, chip?.dataset.key, false);
        renderChips(); await syncPromptBinds(); return;
    }
    const add = event.target.closest('.bl-pbind-add');
    if (add) {
        const key = add.dataset.kind === 'chat' ? currentChatKey() : currentKey();
        if (!key) { note('먼저 캐릭터나 채팅을 열어요'); return; }
        if (!hasBind(id, key)) setBind(id, key, true);
        renderChips(); await syncPromptBinds(); return;
    }
    if (event.target.closest('.bl-pbind-pick')) openPicker(id);
    else if (event.target.closest('.bl-pbind-regex')) openRegexPicker(id);
}
function dialogShell(title) {
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-pbind-dialog';
    dialog.innerHTML = `<div class="bl-pbind-dhead"><b>${esc(title)}</b><input type="search" class="text_pole bl-pbind-search" placeholder="찾기"><button type="button" class="menu_button bl-pbind-close">닫기</button></div><div class="bl-pbind-list"></div>`;
    dialog.querySelector('.bl-pbind-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    import('./modal.js').then(m => m.showThemeModal(dialog)).catch(() => dialog.showModal());
    return dialog;
}
/** 목록에서 고르기: 모든 캐릭터 · 그룹에 체크 (전체 채팅 단위) */
function openPicker(id) {
    const ctx = SillyTavern.getContext();
    const people = [...(ctx.characters || []).map(c => ({ key: `c:${c.avatar}`, name: c.name || c.avatar, img: c.avatar ? `/thumbnail?type=avatar&file=${encodeURIComponent(c.avatar)}` : '' })),
        ...(ctx.groups || []).map(g => ({ key: `g:${g.id}`, name: g.name || '그룹', img: g.avatar_url || '' }))];
    const dialog = dialogShell(promptName(id));
    const list = dialog.querySelector('.bl-pbind-list');
    const paint = (q = '') => {
        const needle = q.trim().toLowerCase();
        const keys = new Set(keysOf(id));
        list.innerHTML = people.filter(p => !needle || p.name.toLowerCase().includes(needle)).map(p =>
            `<label class="bl-pbind-item"><input type="checkbox" data-key="${esc(p.key)}"${keys.has(p.key) ? ' checked' : ''}>${p.img ? `<img src="${esc(p.img)}" alt="">` : '<span class="bl-pbind-noimg"></span>'}<span>${esc(p.name)}</span></label>`).join('') || '<p class="bl-pbind-empty">없어요</p>';
    };
    paint();
    dialog.querySelector('.bl-pbind-search').addEventListener('input', e => paint(e.target.value));
    list.addEventListener('change', async e => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        setBind(id, cb.dataset.key, cb.checked); renderChips(); await syncPromptBinds();
    });
}
/** 정규식 고르기: 전역 정규식 스크립트 가운데 이 프롬프트와 함께 켜고 끌 것 */
function openRegexPicker(id) {
    const scripts = regexScripts().filter(s => s && s.id);
    const dialog = dialogShell(`${promptName(id)} · 정규식`);
    const list = dialog.querySelector('.bl-pbind-list');
    list.classList.add('is-regex');
    const paint = (q = '') => {
        const needle = q.trim().toLowerCase();
        const chosen = new Set(regexOf(id));
        list.innerHTML = scripts.filter(s => !needle || String(s.scriptName || '').toLowerCase().includes(needle)).map(s =>
            `<label class="bl-pbind-item"><input type="checkbox" data-regex="${esc(s.id)}"${chosen.has(s.id) ? ' checked' : ''}><span class="bl-pbind-noimg is-regex">R</span><span>${esc(s.scriptName || s.id)}</span></label>`).join('') || '<p class="bl-pbind-empty">전역 정규식이 없어요</p>';
    };
    paint();
    dialog.querySelector('.bl-pbind-search').addEventListener('input', e => paint(e.target.value));
    list.addEventListener('change', async e => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        setBindRegex(id, cb.dataset.regex, cb.checked); renderChips(); await syncPromptBinds();
    });
}
function watchPopup() {
    if (observer || typeof MutationObserver === 'undefined') return;
    const popup = document.getElementById('completion_prompt_manager_popup');
    if (!popup) return;
    observer = new MutationObserver((mutations) => {
        const box = document.getElementById('bl_prompt_bind');
        if (box && mutations.every(m => box.contains(m.target))) return;   // 내 줄 안의 변화(칩 다시 그림)는 무시 — 되먹임 방지
        if (document.getElementById(POPUP_FORM)) renderChips();
    });
    observer.observe(popup, { attributes: true, attributeFilter: ['style', 'class', 'data-pm-prompt'], subtree: true, childList: true });
    const save = document.getElementById(SAVE_BUTTON);
    if (save) new MutationObserver(() => renderChips()).observe(save, { attributes: true, attributeFilter: ['data-pm-prompt'] });
}

// ───────── 시작 ─────────
export function startPromptBinds() {
    if (listening) return;
    listening = true;
    const { eventSource, event_types } = SillyTavern.getContext();
    eventSource.on(event_types.CHAT_CHANGED, () => { syncPromptBinds(); });
    if (event_types.OAI_PRESET_CHANGED_AFTER) eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, () => { syncPromptBinds(); });
    // 설정이 저장될 때마다(프리셋 · 다른 확장이 순서를 다시 쓴 뒤에도) 잠시 뒤 한 번 더 맞춘다 — 맞으면 저장하지 않으니 되돌이표는 없다
    if (event_types.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, () => { clearTimeout(settleTimer); settleTimer = setTimeout(() => { syncPromptBinds(); }, 400); });
    if (event_types.CHARACTER_RENAMED) eventSource.on(event_types.CHARACTER_RENAMED, (oldAvatar, newAvatar) => { renameKeys(oldAvatar, newAvatar); });
    if (typeof document !== 'undefined') {
        watchPopup();
        if (!observer) {   // 프롬프트 관리자 창이 아직 없으면 생길 때 붙는다
            const discovery = new MutationObserver(() => { watchPopup(); if (observer) discovery.disconnect(); });
            discovery.observe(document.body, { childList: true, subtree: true });
        }
    }
    if (SillyTavern.getContext().getCurrentChatId?.()) syncPromptBinds();
}

/** 시험용 */
export const _forTest = { renderChips, block, editingId, manager };
