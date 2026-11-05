// 프롬프트 켜짐 묶음 저장 (1.0.3, 기본 꺼짐) — 프롬프트 관리자 목록 바로 위 칩 줄.
// 「＋」로 지금 켜고 끈 상태를 이름 붙여 저장하고, 칩을 누르면 한 번에 그 상태로 돌아가요(알림의 ↶ 로 되돌리기). 지금 상태와 같은 칩은 눌린 모양.
// ✎ 메뉴에서 묶음마다 지금 상태로 덮어쓰기 · 이름 바꾸기 · 앞 · 뒤로 · 지우기(물어요). 묶음은 프리셋마다 따로 테마 설정에 적어요(프리셋 파일은 안 건드려요).
// 프롬프트 폴더의 모두 켜기 · 하나만 켜기 · 프롬프트 귀속(채팅마다)과는 따로 놀아요 — 묶음은 사용자가 누를 때만 입혀요.
// 계산은 prompt-saves-core.js(순수). 입히기는 프롬프트 폴더와 같은 길(실리태번 순서 항목의 enabled → render → saveServiceSettings).
// 비용: 켤 때만 받는 모듈. 프롬프트 관리자 칸의 바로 아래 자식만 보는 감시 하나(실리태번이 목록을 다시 그릴 때 칩 줄을 다시 꽂음) · 프리셋 바뀜 사건 하나.
import { getSettings, saveSettings } from '../settings.js';
import { watchDom } from '../dom-watch.js';
import { ask, attachUndo } from '../ask.js';
import { ctx, esc, ensureQuickCss, openMenu, closeMenu, askName } from './shared.js';
import { tidySets, newSetId, snapshot, planApply, matches, moveSet, MAX_SETS } from './prompt-saves-core.js';

const CONTAINER = 'completion_prompt_manager';
const LIST = 'completion_prompt_manager_list';
let wanted = false, api = null, loading = null, row = null, unwatch = null, unfind = null, presetBound = false;

const manager = () => api?.promptManager || null;
function presetName() {
    try { const name = ctx().getPresetManager?.('openai')?.getSelectedPresetName?.(); if (name) return String(name); } catch { /* 없음 */ }
    return String(api?.oai_settings?.preset_settings_openai || 'Default');
}
function store() {
    const s = getSettings();
    if (!s.promptSaves || typeof s.promptSaves !== 'object' || Array.isArray(s.promptSaves)) s.promptSaves = { on: true, presets: {} };
    if (!s.promptSaves.presets || typeof s.promptSaves.presets !== 'object' || Array.isArray(s.promptSaves.presets)) s.promptSaves.presets = {};
    return s.promptSaves.presets;
}
const setsNow = () => tidySets(Object.hasOwn(store(), presetName()) ? store()[presetName()] : []);
function writeSets(list) {
    const box = store(), key = presetName();
    if (list.length) box[key] = list; else delete box[key];
    saveSettings();
}
function hostOrder() {
    const pm = manager();
    if (!pm?.activeCharacter) return null;
    try { return pm.getPromptOrderForCharacter(pm.activeCharacter) || null; } catch { return null; }
}
const allowed = id => { const pm = manager(); try { return pm.isPromptToggleAllowed(pm.getPromptById(id)) !== false; } catch { return true; } };
function writeEnabled(changes) {
    const pm = manager();
    if (!pm || !changes.length) return;
    const counts = pm.tokenHandler?.getCounts?.() ?? pm.getTokenHandler?.()?.getCounts?.();
    for (const [id, on] of changes) {
        const entry = pm.getPromptOrderEntry(pm.activeCharacter, id);
        if (!entry) continue;
        entry.enabled = on;
        if (counts) counts[id] = null;
    }
    pm.render();
    pm.saveServiceSettings();
}

// ───────── 칩 줄 ─────────
function paint() {
    if (!row) return;
    const order = hostOrder() || [];
    const sets = setsNow();
    const chips = sets.map(set => {
        const on = matches(set, order, allowed);
        return `<button type="button" class="bl-ps-chip${on ? ' on' : ''}" data-ps-act="apply" data-ps-id="${esc(set.id)}" aria-pressed="${on}" title="「${esc(set.name)}」 켜짐 상태로">${esc(set.name)}</button>`;
    }).join('');
    const add = sets.length
        ? `<button type="button" class="bl-ps-btn" data-ps-act="add" aria-label="지금 켜짐 상태를 묶음으로 저장" title="지금 켜짐 상태를 묶음으로 저장"${sets.length >= MAX_SETS ? ' disabled' : ''}><i class="fa-solid fa-plus" aria-hidden="true"></i></button>`
            + '<button type="button" class="bl-ps-btn" data-ps-act="manage" aria-label="켜짐 묶음 고치기" title="켜짐 묶음 고치기"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>'
        : '<button type="button" class="bl-ps-chip bl-ps-first" data-ps-act="add" aria-label="지금 켜짐 상태를 묶음으로 저장"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>켜짐 묶음 저장</span></button>';
    const html = `<span class="bl-ps-chips">${chips}${add}</span>`;
    if (row.innerHTML !== html) row.innerHTML = html;
}
function ensureRow() {
    if (!wanted) return;
    const list = document.getElementById(LIST);
    if (!list) return;
    if (!row) {
        row = document.createElement('div');
        row.className = 'bl-ps-row';
        row.setAttribute('role', 'toolbar');
        row.setAttribute('aria-label', '프롬프트 켜짐 묶음');
        row.addEventListener('click', onClick);
    }
    if (row.nextElementSibling !== list) list.before(row);
    paint();
}

async function onClick(event) {
    const button = event.target?.closest?.('[data-ps-act]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const act = button.dataset.psAct;
    if (act === 'apply') return apply(button.dataset.psId);
    if (act === 'add') return addSet();
    if (act === 'manage') return manageMenu(button);
}

function apply(id) {
    const set = setsNow().find(s => s.id === id), order = hostOrder();
    if (!set || !order) return;
    const changes = planApply(set, order, allowed);
    if (!changes.length) { toastr.info(`「${set.name}」 그대로예요.`, '켜짐 묶음', { timeOut: 2000 }); return; }
    const before = changes.map(([x]) => [x, !!order.find(e => e.identifier === x)?.enabled]), key = presetName();
    writeEnabled(changes);
    const toast = toastr.info(`「${set.name}」: ${changes.length}개를 바꿨어요.`, '켜짐 묶음');
    attachUndo(toast, () => { if (presetName() === key) writeEnabled(before); });
}

async function addSet() {
    const order = hostOrder();
    if (!order) return;
    const sets = setsNow();
    if (sets.length >= MAX_SETS) { toastr.info(`묶음은 프리셋마다 ${MAX_SETS}개까지예요.`, '켜짐 묶음'); return; }
    const on = order.filter(e => e.enabled).length;
    const name = await askName(`지금 켜짐 상태(켜진 항목 ${on}개)를 묶음으로 저장해요. 이름을 적어 주세요.`, `묶음 ${sets.length + 1}`);
    if (!name || !wanted) return;
    const fresh = setsNow();
    fresh.push({ id: newSetId(new Set(fresh.map(s => s.id))), name, states: snapshot(hostOrder() || order) });
    writeSets(tidySets(fresh));
    paint();
}

function manageMenu(anchor) {
    const sets = setsNow();
    openMenu(anchor, sets.map(set => ({ label: set.name, run: () => setMenu(anchor, set.id) })));
}
function setMenu(anchor, id) {
    const sets = setsNow(), set = sets.find(s => s.id === id);
    if (!set) return;
    const i = sets.indexOf(set);
    openMenu(anchor, [
        { label: '지금 상태로 덮어쓰기', run: () => overwrite(id) },
        { label: '이름 바꾸기', run: () => rename(id) },
        ...(i > 0 ? [{ label: '앞으로', run: () => move(id, -1) }] : []),
        ...(i < sets.length - 1 ? [{ label: '뒤로', run: () => move(id, 1) }] : []),
        { label: '지우기', danger: true, run: () => remove(id) },
    ]);
}
async function overwrite(id) {
    const sets = setsNow(), set = sets.find(s => s.id === id), order = hostOrder();
    if (!set || !order) return;
    if (!await ask(`「${set.name}」 묶음을 지금 켜짐 상태로 바꿀까요?`, { ok: '덮어쓰기', title: '켜짐 묶음' })) return;
    set.states = snapshot(order);
    writeSets(tidySets(sets)); paint();
    toastr.success(`「${set.name}」을 지금 상태로 바꿨어요.`, '켜짐 묶음', { timeOut: 2000 });
}
async function rename(id) {
    const sets = setsNow(), set = sets.find(s => s.id === id);
    if (!set) return;
    const name = await askName('새 이름을 적어 주세요.', set.name, { ok: '바꾸기' });
    if (!name || name === set.name) return;
    const fresh = setsNow(), target = fresh.find(s => s.id === id);
    if (!target) return;
    target.name = name;
    writeSets(tidySets(fresh)); paint();
}
function move(id, dir) {
    const next = moveSet(setsNow(), id, dir);
    if (!next) return;
    writeSets(next); paint();
}
async function remove(id) {
    const sets = setsNow(), set = sets.find(s => s.id === id);
    if (!set) return;
    if (!await ask(`「${set.name}」 묶음을 지울까요?\n프롬프트 항목은 그대로예요.`, { ok: '지우기', danger: true, title: '켜짐 묶음' })) return;
    writeSets(setsNow().filter(s => s.id !== id)); paint();
}

// ───────── 켜고 끄기 ─────────
function watchHost() {
    if (unwatch) return;
    const host = document.getElementById(CONTAINER);
    if (host) {
        unfind?.(); unfind = null;
        // 실리태번은 다시 그릴 때 이 칸을 비우고 머리 · 목록을 새로 넣어요 — 바로 아래 자식만 봐요(목록 안 줄 바뀜은 안 봄)
        unwatch = watchDom(host, { childList: true, when: 'frame', name: '프롬프트 켜짐 묶음' }, ensureRow);
        ensureRow();
        return;
    }
    unfind ??= watchDom(document.body, { childList: true, subtree: true, exclude: '#chat', when: 'frame', name: '프롬프트 켜짐 묶음 찾기' }, () => { if (document.getElementById(CONTAINER)) watchHost(); });
}
function onPreset() { if (wanted) ensureRow(); }

/** features.js 가 설정이 바뀔 때마다 부른다 */
export async function syncPromptSaves(on) {
    wanted = !!on;
    if (!wanted) {
        unwatch?.(); unwatch = null; unfind?.(); unfind = null;
        if (presetBound) { presetBound = false; try { const c = ctx(), types = c.eventTypes ?? c.event_types; c.eventSource.removeListener?.(types.OAI_PRESET_CHANGED_AFTER, onPreset); } catch { /* 사건 없음 */ } }
        closeMenu();
        row?.removeEventListener('click', onClick);
        row?.remove(); row = null;
        return;
    }
    try {
        loading ??= import('../../../../../openai.js');
        api = await loading;
    } catch (error) {
        loading = null;
        console.warn('[Blue Lemonade] 켜짐 묶음 — 프롬프트 관리자를 불러오지 못했어요', error);
        return;
    }
    if (!wanted) return;
    ensureQuickCss();
    if (!presetBound) {
        presetBound = true;
        try { const c = ctx(), types = c.eventTypes ?? c.event_types; if (types?.OAI_PRESET_CHANGED_AFTER) c.eventSource.on(types.OAI_PRESET_CHANGED_AFTER, onPreset); } catch { /* 사건 없음 */ }
    }
    watchHost();
}

/** 시험용 */
export const _forTest = { setApi(next) { api = next; loading = Promise.resolve(next); }, apply, addSet, overwrite, rename, move, remove, paint, ensureRow };
