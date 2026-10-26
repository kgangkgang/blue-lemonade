import { preparePromptChoice, promptChoiceGroups, choiceSnapshot, resolveChoiceConflicts, choiceGroupLabel } from './prompt-choice-core.js';

let wanted = false, binding = null, loading = null;

export function bindPromptChoices(doc, getManager) {
    const click = event => {
        const toggle = event.target?.closest?.('.prompt-manager-toggle-action');
        if (!toggle) return;
        const manager = getManager();
        if (!manager?.containerElement?.contains(toggle)) return;
        const selected = toggle.closest('[data-pm-identifier]')?.dataset.pmIdentifier;
        const settings = manager.serviceSettings;
        if (!selected || !settings || !manager.activeCharacter) return;
        const order = manager.getPromptOrderForCharacter(manager.activeCharacter);
        const changed = preparePromptChoice(settings.prompts, order, settings.extensions?.blPromptChoices, selected);
        if (changed.length) {
            const counts = manager.getTokenHandler?.()?.getCounts?.();
            if (counts) for (const id of changed) counts[id] = null;
        }
    };
    doc.addEventListener('click', click, true);
    return () => doc.removeEventListener('click', click, true);
}

// ───────── 8.0.1 택1 지킴이 ─────────
// 10-26 실제 사용자 프리셋(과일 6.4)에서 대사 색상 택1 묶음에 셋이 함께 켜져 있었다. 원인: 캐릭터 이름 연동(promptbind.js)처럼
// 프롬프트 관리자 토글 클릭이 아닌 길로 켜진 것은 위 클릭 연결이 못 본다. 그래서 설정이 저장될 때마다 묶음별 켜짐을 바로 전과 견준다 —
// 새로 켜진 것이 하나면 클릭과 같은 규칙(그것만 남김)으로 정리하고, 판단할 수 없으면(불러올 때 이미 여럿) 조용히 끄지 않고 한 번 묻는다.
const ASKED_KEY = 'bl_choice_guard_asked';
let last = null, lastPreset = '', lastOrder = null, lastSettings = null, timer = 0, asking = false;
const askedSet = () => { try { return new Set(JSON.parse(localStorage.getItem(ASKED_KEY) || '[]')); } catch { return new Set(); } };
const remember = key => { try { const set = askedSet(); set.add(key); localStorage.setItem(ASKED_KEY, JSON.stringify([...set].slice(-200))); } catch { /* 저장소 없음 — 이번 세션만 */ } sessionAsked.add(key); };
const sessionAsked = new Set();
function presetName() { try { return String(SillyTavern.getContext().getPresetManager?.('openai')?.getSelectedPresetName?.() || ''); } catch { return ''; } }
function current(manager) {
    const settings = manager?.serviceSettings;
    if (!settings || !manager.activeCharacter) return null;
    const order = manager.getPromptOrderForCharacter(manager.activeCharacter) || [];
    return { settings, order, groups: promptChoiceGroups(settings.prompts, order, settings.extensions?.blPromptChoices) };
}
async function displayName(manager, id) {
    const raw = String(manager.getPromptById?.(id)?.name || id);
    try { const runtime = await import('./scripts/runtime.js'); return runtime.translatedPromptName?.(id, raw) || raw; } catch { return raw; }
}
function settle(manager, offIds) {
    const counts = manager.getTokenHandler?.()?.getCounts?.();
    if (counts) for (const id of offIds) counts[id] = null;
    try { Promise.resolve(manager.saveServiceSettings?.()).catch(() => {}); } catch { /* 저장 없음 */ }
    try { manager.render?.(false); } catch { /* 그리기 실패는 무시 */ }
}
// 과일 계열: 과일의 마음 제어설정이 지금 켜 둔 것으로 아는 항목을 먼저 고른다(사용자가 창에서 고른 것)
function preferred(settings, ids) {
    try {
        const config = JSON.parse(settings.prompts.find(p => p.identifier === 'fruit-heart-control-config-v2')?.content || '{}');
        const states = config.tagStates?.[config.activeTag] || config.lastAppliedStates || {};
        const hit = ids.filter(id => states[id] === true);
        if (hit.length === 1) return hit[0];
    } catch { /* 제어설정 없음 */ }
    return ids[0];
}
async function askKeep(manager, conflict) {
    const ctx = SillyTavern.getContext(), doc = document;
    const names = await Promise.all(conflict.ids.map(id => displayName(manager, id)));
    const label = choiceGroupLabel(names) || '택1 묶음';
    const box = doc.createElement('div'); box.className = 'bl-ask bl-choice-guard';
    const text = doc.createElement('p'); text.style.textAlign = 'left';
    text.textContent = `「${label}」 택1에 ${conflict.on.length}개가 켜져 있어요 — 하나만 남길까요?`;
    box.append(text);
    const pick = preferred(manager.serviceSettings, conflict.on);
    const list = doc.createElement('div'); list.className = 'bl-choice-guard-list'; list.setAttribute('role', 'radiogroup');
    for (const id of conflict.on) {
        const row = doc.createElement('label'); row.className = 'checkbox_label';
        const input = doc.createElement('input'); input.type = 'radio'; input.name = 'bl-choice-guard'; input.value = id; input.checked = id === pick;
        const span = doc.createElement('span'); span.textContent = names[conflict.ids.indexOf(id)];
        row.append(input, span); list.append(row);
    }
    box.append(list);
    if (!ctx?.Popup || !ctx?.POPUP_TYPE) return null;
    const popup = new ctx.Popup(box, ctx.POPUP_TYPE.CONFIRM, '', { okButton: '이것만 남기기', cancelButton: '그대로 두기' });
    const result = await popup.show();
    if (result !== ctx.POPUP_RESULT?.AFFIRMATIVE) return null;
    return box.querySelector('input[name="bl-choice-guard"]:checked')?.value || null;
}
async function guard(getManager, reason) {
    timer = 0;
    const manager = getManager(), now = current(manager);
    if (!now || !now.groups.length) { last = null; lastOrder = null; lastSettings = null; return; }
    const name = presetName();
    if (name !== lastPreset || reason === 'preset' || now.order !== lastOrder || now.settings !== lastSettings) { last = null; lastPreset = name; }
    lastOrder = now.order; lastSettings = now.settings;
    const { off, ask } = resolveChoiceConflicts(now.groups, now.order, last);
    if (off.length) {
        for (const row of now.order) if (off.includes(row.identifier)) row.enabled = false;
        settle(manager, off);
        console.info('[Blue Lemonade] 택1 묶음에서 새로 켜진 항목만 남기고 껐어요', off);
    }
    last = choiceSnapshot(now.groups, now.order);
    if (asking) return;
    for (const conflict of ask) {
        const key = `${name}|${[...conflict.on].sort().join(',')}`;
        if (sessionAsked.has(key) || askedSet().has(key)) continue;
        asking = true;
        let keep = null;
        try { keep = await askKeep(manager, conflict); } finally { asking = false; }
        // 확인창을 기다리는 동안 바뀐 프리셋·채팅·선택에는 지난 답을 적용하지 않아요.
        const activeManager = getManager();
        const active = current(activeManager);
        if (activeManager !== manager || presetName() !== name || !active
            || active.settings !== now.settings || active.order !== now.order) return;
        const activeOn = conflict.ids.filter(id => active.order.some(row => row.identifier === id && row.enabled));
        if (activeOn.length !== conflict.on.length || activeOn.some(id => !conflict.on.includes(id))) return;
        if (!keep) { remember(key); continue; }   // 그대로 두기 — 같은 상태로는 다시 묻지 않아요
        const again = current(getManager());
        if (!again) return;
        const offIds = conflict.on.filter(id => id !== keep);
        for (const row of again.order) if (offIds.includes(row.identifier)) row.enabled = false;
        settle(getManager(), offIds);
        last = choiceSnapshot(again.groups, again.order);
    }
}
function bindGuard(getManager) {
    let ctx;
    try { ctx = SillyTavern.getContext(); } catch { return () => {}; }
    const { eventSource, event_types } = ctx || {};
    if (!eventSource?.on || !event_types) return () => {};
    // 프리셋을 바꾸면 캐릭터 이름 연동이 먼저 맞춘 뒤(최대 1.2초) 본다. 설정 저장 뒤에는 잠깐 모아서 한 번.
    let pendingReason = null;
    const later = (reason, ms) => {
        // 프리셋 불러오기 직후의 저장 알림이 불러오기 판정을 지우면, 기존 중복을 새 클릭으로 오인해요.
        if (reason === 'preset' || pendingReason !== 'preset') pendingReason = reason;
        clearTimeout(timer);
        timer = setTimeout(() => {
            const nextReason = pendingReason; pendingReason = null;
            guard(getManager, nextReason).catch(error => console.warn('[Blue Lemonade] 택1 지킴이', error));
        }, pendingReason === 'preset' ? Math.max(ms, 1600) : ms);
    };
    const onSettings = () => later('settings', 450), onPreset = () => later('preset', 1600), onChat = () => later('chat', 1600);
    const pairs = [[event_types.SETTINGS_UPDATED, onSettings], [event_types.OAI_PRESET_CHANGED_AFTER, onPreset], [event_types.CHAT_CHANGED, onChat]].filter(([type]) => type);
    for (const [type, fn] of pairs) eventSource.on(type, fn);
    later('preset', 2500);   // 처음 켤 때 한 번 (이미 여럿 켜진 채 저장된 프리셋)
    return () => { clearTimeout(timer); timer = 0; last = null; lastOrder = null; lastSettings = null; pendingReason = null; for (const [type, fn] of pairs) eventSource.removeListener?.(type, fn); };
}

export async function syncPromptChoices(enabled) {
    wanted = !!enabled;
    if (!wanted) { binding?.(); binding = null; return; }
    if (binding) return;
    try {
        loading ??= import('../../../../openai.js');
        const api = await loading;
        if (wanted && !binding) {
            const stopClick = bindPromptChoices(document, () => api.promptManager);
            const stopGuard = bindGuard(() => api.promptManager);
            binding = () => { stopClick(); stopGuard(); };
        }
    } catch (error) {
        loading = null;
        console.warn('[Blue Lemonade] 택1 선택 연결을 불러오지 못했어요', error);
    }
}
