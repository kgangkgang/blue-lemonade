// 프롬프트 연동 정규식 — 켜 둔 프롬프트에 딸린 정규식만 켜고, 꺼 둔 모듈(모멘텀 엔진 · 상태창 …)의 정규식은 끈다.
// 꺼진 정규식은 실리태번이 스트리밍 · 프롬프트 만들기에서 아예 건너뛰므로 답이 오는 동안 정규식 비용이 그만큼 준다.
// 켜고 끄는 것은 메모리의 정규식 목록(프리셋 · 전역)에 disabled 를 쓰는 것뿐 — 프리셋 파일은 사용자가 저장할 때와 기능을 끌 때(되돌린 값)만 바뀐다.
// 캐릭터 카드의 정규식은 손대지 않는다: 실리태번 정규식 편집기가 메모리의 disabled 를 카드에 그대로 써 넣는데 stop() 은 프리셋 파일만 되돌릴 수 있다.
// 원래 상태는 origin 에 적어 두고, 기능을 끄면 되돌린다 (그새 저장돼 파일에 들어간 우리 값도). 계산은 engine.js (테스트 가능).
// 과일의 마음 패널이 프롬프트를 켜고 끄면(Tavern Helper updatePresetWith('in_use')) 프롬프트 · 정규식 목록이 새 배열로 바뀌고 saveSettingsDebounced
// → SETTINGS_UPDATED 로 여기 sync 가 돈다 — 새 목록은 「새로 읽힌 목록」이라 origin 으로 다시 맞춘다.
// 1.1.2 사용자가 정규식 화면에서 직접 켜고 끈 정규식(하나씩 · 일괄 · 정규식 프리셋 적용)은 id 로 「직접 바꿈」(store().manual)에 적고 다시는 자동으로 바꾸지 않는다
//   — 예전에는 origin 만 바꿔서, 꺼진 모듈의 정규식을 손으로 켜면 다음 sync 가 도로 껐고(눌러도 되돌아감), 목록 배열이 새로 바뀌면 손으로 바꾼 것을 아예 못 알아봤다.
//   패널의 「자동으로」가 그 표시를 지운다. 테마 설정에서 이 기능이 꺼져 있으면(불러오기만 됐어도) 정규식을 읽지도 쓰지도 않는다.
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import * as hostExtensions from '../../../../../../extensions.js';
import { getPresetManager } from '../../../../../../preset-manager.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../../script.js';
import { oai_settings, promptManager } from '../../../../../../openai.js';
import { verifyAddonCss } from '../../addon-files-check.js';
import { plan, textHasModuleLow, modulesOf } from './engine.js';

const VERSION = '1.2.0';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const holder = document.createElement('div'); holder.hidden = true; document.body.append(holder);
let root, inlineHost = null, opening = false, timer = 0, lastRows = [], lastNote = '', applied = new Map(), stopped = false;
const seenLists = new WeakSet(); // sync 가 본 목록 배열 — 처음 보는 배열은 새로 읽힌 것 (프리셋 다시 고르기 · 캐릭터 다시 읽기)
let userEdit = null;             // 정규식 화면을 누른 순간의 disabled 사진 { at, before: Map<id, disabled>, ids: Set<id> } — 다음 sync 가 견줘 달라진 것 · 누른 줄(ids)을 「직접 바꿈」으로
const USER_EDIT_MS = 60000;      // 사진을 들고 있는 시간 (실리태번 저장 → SETTINGS_UPDATED 가 늦게 와도 놓치지 않게)

/** 테마 설정에서 이 기능이 켜져 있나 (addons.js 와 같은 값: 블루레몬에이드 사용 · 애드온 regexlink) — 꺼져 있으면 정규식을 건드리지 않는다 */
function featureOn() {
    const s = extension_settings.salty;
    return !!s && typeof s === 'object' && s.enabled !== false && s.addons?.regexlink === true;
}

function store() {
    const s = extension_settings.regex_link ??= {};
    if (!s.origin || typeof s.origin !== 'object') s.origin = {};       // 정규식 id → 우리가 손대기 전 disabled
    if (!s.modules || typeof s.modules !== 'object') s.modules = {};     // 모듈 키 → 'on' | 'off' (없으면 자동)
    if (typeof s.keepRecent !== 'boolean') s.keepRecent = true;          // 최근 메시지에 그 모듈이 있으면 켜 둔다
    if (!s.manual || typeof s.manual !== 'object' || Array.isArray(s.manual)) s.manual = {};   // 1.1.2 정규식 id → true: 사용자가 직접 바꿈 · 자동 안 함
    if (typeof s.performanceOn !== 'boolean') s.performanceOn = false;
    s.recent = Math.max(1, Math.floor(Number(s.recent)) || 30);   // 위쪽 상한 없음(예전 200) — 채팅보다 크면 채팅 전부를 봐요
    return s;
}

// 실행 계측·최적화는 같은 설정 창에서 켜요. 끈 상태에서는 큰 엔진을 받지 않아요.
let performanceModule = null, performanceLoading = null, performanceEpoch = 0;
const performanceWanted = () => !stopped && featureOn() && store().performanceOn;
function standalonePerformance() {
    const names = Array.isArray(hostExtensions.extensionNames) ? hostExtensions.extensionNames : [];
    const off = new Set((Array.isArray(extension_settings.disabledExtensions) ? extension_settings.disabledExtensions : []).map(n => String(n).toLowerCase()));
    return names.some(n => /^third-party\/st-regex-perf(?:[-_].*)?$/i.test(String(n)) && !off.has(String(n).toLowerCase()));
}
function performanceNote(text) { const el = root?.querySelector('[data-performance-status]'); if (el && el.textContent !== text) el.textContent = text; }
function hidePerformanceSlot(slot, hidden) { if (slot && slot.hidden !== hidden) slot.hidden = hidden; }
async function syncPerformance(show = false) {
    const epoch = ++performanceEpoch, slot = root?.querySelector('[data-performance-panel]');
    if (!performanceWanted()) {
        performanceModule?.setRuntimeEnabled(false);
        hidePerformanceSlot(slot, true);
        performanceNote('꺼짐 · 정규식 실행은 원래 엔진을 따라요.');
        return;
    }
    if (standalonePerformance()) {
        performanceModule?.setRuntimeEnabled(false);
        hidePerformanceSlot(slot, true);
        performanceNote('별도로 설치한 Regex Perf Kit가 켜져 있어 여기서는 적용하지 않아요. 하나만 켜 주세요.');
        return;
    }
    try {
        if (!performanceModule) {
            performanceNote('실행 계측과 최적화 도구를 불러와요…');
            performanceLoading ||= import('./regexperf.js').then(m => {
                performanceModule = m;
                m.setScriptChangeListener((ids, patch) => {
                    if (!Object.hasOwn(patch, 'disabled')) return;
                    const s = store();
                    // 이 표에서 직접 켜고 끈 규칙도 프롬프트 자동 연동이 되돌리지 않아요.
                    for (const id of ids) { s.manual[id] = true; delete s.origin[id]; applied.delete(id); }
                    saveSettingsDebounced();
                });
                return m;
            });
            await performanceLoading;
        }
        if (epoch !== performanceEpoch || !performanceWanted()) return;
        const active = performanceModule.regexPerfStatus().enabled || performanceModule.setRuntimeEnabled(true);
        const state = performanceModule.regexPerfStatus();
        performanceNote(active ? '켜짐 · 실제로 실행된 규칙의 시간과 생략·캐시 횟수를 모아요.' : state.wrapperWarning || '현재 실리태번의 정규식 엔진에서는 적용하지 못해요.');
        hidePerformanceSlot(slot, !active);
        if (active && (show || root?.querySelector('[data-performance-details]')?.open)) await performanceModule.mountPanel(slot);
        if (epoch !== performanceEpoch || !performanceWanted()) hidePerformanceSlot(slot, !performanceWanted());
    } catch (error) {
        performanceLoading = null;
        performanceModule?.setRuntimeEnabled(false);
        hidePerformanceSlot(slot, true);
        performanceNote('도구를 불러오지 못했어요. 새로고침한 뒤 다시 켜 주세요.');
        console.warn('[Blue Lemonade] 정규식 성능 도구', error);
    }
}

/** 지금 실제로 쓰이는 정규식 목록들 (전역 · 허용된 프리셋). 캐릭터 카드 목록은 되돌릴 길이 없어 넣지 않는다 (origin 에도 적지 않는다) */
function scriptLists() {
    const ctx = SillyTavern.getContext();
    const lists = [];
    if (Array.isArray(extension_settings.regex)) lists.push(extension_settings.regex);
    const api = ctx.mainApi;
    const presetName = oai_settings?.preset_settings_openai;
    if (api === 'openai' && extension_settings.preset_allowed_regex?.openai?.includes(presetName) && Array.isArray(oai_settings.extensions?.regex_scripts)) lists.push(oai_settings.extensions.regex_scripts);
    return lists;
}

/** 되돌릴 때 보는 목록들 — 지금 API 가 쓰지 않아도 메모리에 남은 프리셋 목록까지 (채팅 완성에서 끈 뒤 API 를 바꾸면 scriptLists 에서 빠져 우리 값이 남았다). origin 에 적힌 정규식만 건드린다 */
function restoreLists() {
    const lists = scriptLists();
    const preset = oai_settings?.extensions?.regex_scripts;
    if (Array.isArray(preset) && !lists.includes(preset)) lists.push(preset);
    return lists;
}

/** 프롬프트 관리자가 지금 캐릭터에 쓰는 켜짐 목록 */
function enabledPrompts() {
    const pm = promptManager;
    if (!pm?.activeCharacter) return null;
    try { return new Set(pm.getPromptOrderForCharacter(pm.activeCharacter).filter(e => e.enabled).map(e => e.identifier)); } catch { return null; }
}

function recentHasFactory() {
    const s = store();
    if (!s.keepRecent) return () => false;
    const chat = SillyTavern.getContext().chat || [];
    const tail = chat.slice(-s.recent).filter(m => m && !m.is_user);
    const lowered = new Map();
    const cache = new Map();
    return (keys) => {
        const k = keys.join('|');
        if (cache.has(k)) return cache.get(k);
        const hit = tail.some(m => { if (!lowered.has(m)) lowered.set(m, String(m.mes || '').toLowerCase()); return textHasModuleLow(lowered.get(m), keys); });
        cache.set(k, hit);
        return hit;
    };
}

/** 1.0.5 프롬프트 귀속(테마 promptbind.js)이 직접 붙인 정규식 id — 그 정규식은 귀속이 켜고 끄므로 여기서는 손대지 않는다
 *  (같은 정규식을 둘이 서로 다르게 바라면 저장 → SETTINGS_UPDATED → 되맞춤이 끝없이 오가고, 6.0.6 부터 귀속이 바뀔 때 채팅을 다시 그려 폭풍이 된다)
 *  1.0.8 캐릭터 이름 연동(promptLink)이 켜져 있으면 이름이 든 정규식도 그쪽이 맡는다 — promptbind.js 와 같은 견줌 (NFKC · 공백 하나 · 소문자) */
function boundByPrompt(lists) {
    const out = new Set();
    try {
        const binds = extension_settings.salty?.promptBinds;
        if (binds && typeof binds === 'object') for (const b of Object.values(binds)) for (const id of (Array.isArray(b?.regex) ? b.regex : [])) if (typeof id === 'string' && id) out.add(id);
        // 1.1.0 이름 연동은 6.7.5 부터 여러 줄 { on, rows: [{ word, cards }] } — 옛 꼴 { on, name } 도 읽는다. promptbind.js 처럼 띄어쓰기까지 무시하고 견준다
        const link = extension_settings.salty?.promptLink;
        const squash = s => String(s ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
        const words = link?.on === true ? (Array.isArray(link.rows) ? link.rows : [link.name]).map(r => squash(typeof r === 'string' ? r : r?.word)).filter(Boolean) : [];
        if (words.length) for (const script of lists.flat()) if (script?.id && words.some(w => squash(script.scriptName).includes(w))) out.add(script.id);
    } catch { /* 설정 없음 */ }
    return out;
}

/** 계산하고 바뀐 것만 쓴다. 되돌린다: restore=true 면 origin 으로 (keep 에 든 id 는 origin 을 남긴다) */
export function sync({ restore = false, keep = null } = {}) {
    if (stopped && !restore) { render(); return; } // 끈 뒤에는 다시 켜지 않는다 (다시 켜려면 새로고침)
    if (!restore && !featureOn()) { lastRows = []; lastNote = '기능이 꺼져 있어 정규식을 바꾸지 않아요.'; render(); return; }
    const s = store();
    const enabled = enabledPrompts();
    const lists = restore ? restoreLists() : scriptLists();
    const bound = boundByPrompt(lists);
    for (const id of bound) { delete s.origin[id]; applied.delete(id); }   // 귀속이 맡은 정규식은 우리 기록을 지우고 그대로 둔다
    const scripts = lists.flat().filter(x => x && x.id && !bound.has(x.id));
    // 1.1.2 사용자가 직접 바꾼 것 → 「직접 바꿈」: ① 정규식 화면을 누른 뒤 값이 달라진 것(배열이 새로 바뀌어도 id 로) ② 같은 배열에서 우리가 마지막에 쓴 값과 달라진 것(슬래시 명령 · 편집 창)
    let marked = 0;
    const mark = id => { if (!s.manual[id]) { s.manual[id] = true; marked++; } };
    if (userEdit) {
        for (const script of scripts) if ((userEdit.ids.has(script.id) || (userEdit.before.has(script.id) && !!script.disabled !== userEdit.before.get(script.id))) && modulesOf(script).length) mark(script.id);
        userEdit.ids.clear();
        if (Date.now() - userEdit.at > USER_EDIT_MS) userEdit = null;
    }
    for (const script of lists.filter(list => seenLists.has(list)).flat()) {
        if (!script?.id || bound.has(script.id)) continue;
        const mine = applied.get(script.id);
        if (mine !== undefined && !!script.disabled !== mine) mark(script.id);
    }
    // 직접 바꾼 정규식은 우리 기록을 지운다 — 되돌릴 원래 값도 사용자 값이라 그대로 둔다
    for (const id of Object.keys(s.manual)) { if (id in s.origin) { delete s.origin[id]; marked++; } applied.delete(id); }
    if (marked) saveSettingsDebounced();
    if (!scripts.length) { lastRows = []; lastNote = bound.size ? '지금 쓰는 정규식은 모두 프롬프트 귀속이 맡고 있어요.' : '지금 쓰는 정규식이 없어요.'; render(); return; }
    // 새로 읽힌 목록은 파일에 저장된 우리 옛 값일 수 있어 견주지 않는다 — 우리 기록만 지우고 origin 으로 다시 맞춘다
    for (const list of lists) if (!seenLists.has(list)) { seenLists.add(list); for (const script of list) if (script?.id) applied.delete(script.id); }
    let changed = 0;
    if (restore || !enabled) {
        for (const script of scripts) {
            if (!(script.id in s.origin)) continue;
            if (!!script.disabled !== s.origin[script.id]) { script.disabled = s.origin[script.id]; changed++; reflect(script.id, script.disabled); }
            if (!keep?.has(script.id)) delete s.origin[script.id];
            applied.delete(script.id);
        }
        lastRows = []; lastNote = restore ? '원래 상태로 되돌렸어요.' : '프롬프트 관리자(채팅 완성)를 쓸 때만 동작해요.';
    } else {
        const rows = plan({ scripts, prompts: oai_settings.prompts || [], enabled, origin: s.origin, overrides: s.modules, recentHas: recentHasFactory(), manual: new Set(Object.keys(s.manual)) });
        const byId = new Map(scripts.map(x => [x.id, x]));
        for (const row of rows) {
            const script = byId.get(row.id);
            if (row.want === null) {
                // 더는 연결되지 않는 정규식은 원래대로
                if (row.id in s.origin) { if (!!script.disabled !== s.origin[row.id]) { script.disabled = s.origin[row.id]; changed++; reflect(row.id, script.disabled); } delete s.origin[row.id]; applied.delete(row.id); }
                continue;
            }
            if (!(row.id in s.origin)) s.origin[row.id] = !!script.disabled;
            const want = !row.want; // disabled
            if (!!script.disabled !== want) { script.disabled = want; changed++; reflect(row.id, want); }
            applied.set(row.id, want);
        }
        lastRows = rows; lastNote = '';
    }
    // 우리가 쓴 값은 사진에도 적는다 — 다음 sync 가 「사용자가 바꿈」으로 잘못 보지 않게
    if (userEdit) for (const script of scripts) if (userEdit.before.has(script.id)) userEdit.before.set(script.id, !!script.disabled);
    if (changed) { performanceModule?.notifyScriptsChanged(); saveSettingsDebounced(); }
    render();
}

/** 정규식 화면이 열려 있으면 우리가 바꾼 켜짐을 그 줄 스위치에도 (실리태번은 다시 그리기 전까지 옛 값을 보여 준다) */
function reflect(id, disabled) {
    try {
        const row = document.getElementById?.(id);
        const box = row?.classList?.contains('regex-script-label') ? row.querySelector('input.disable_regex') : null;
        if (box && box.checked !== disabled) box.checked = disabled;
    } catch { /* 화면 없음 */ }
}

/** 정규식 화면(실리태번 「정규식」 서랍)을 누르는 순간: 지금 disabled 를 사진으로 — 하나씩 켜고 끄기 · 일괄 켜고 끄기 · 정규식 프리셋 적용 모두 이 뒤에 값이 바뀐다.
 *  누르기를 먼저(캡처 단계) 받아서 실리태번이 값을 바꾸기 전 사진이다. 실리태번은 저장한 뒤 SETTINGS_UPDATED 를 내고 → sync 가 견준다. */
function onRegexScreen(event) {
    const target = event?.target;
    if (!target?.closest?.('#regex_container, .regex_settings')) return;
    if (!userEdit || Date.now() - userEdit.at > USER_EDIT_MS) {
        const before = new Map();
        for (const script of scriptLists().flat()) if (script?.id) before.set(script.id, !!script.disabled);
        userEdit = { at: Date.now(), before, ids: new Set() };
    } else userEdit.at = Date.now();
    // 줄 스위치 · 일괄 켜기/끄기는 누른 정규식이 분명하다 — 값이 이미 같았어도(우리가 꺼 둔 것을 「끄기」) 사용자 뜻으로 적는다
    const toggle = target.closest('.regex-toggle-on, .regex-toggle-off, input.disable_regex');
    if (toggle) { const id = toggle.closest('.regex-script-label')?.id; if (id) userEdit.ids.add(id); return; }
    if (target.closest('#bulk_enable_regex, #bulk_disable_regex')) {
        for (const row of document.querySelectorAll?.('#regex_container .regex-script-label') || []) if (row.id && row.querySelector('.regex_bulk_checkbox:checked')) userEdit.ids.add(row.id);
    }
}
/** 프리셋을 바꿔 목록이 통째로 다시 읽히면 그 차이는 사용자가 정규식 화면에서 바꾼 게 아니다 */
function forgetUserEdit() { userEdit = null; }

function schedule() { clearTimeout(timer); timer = setTimeout(() => sync(), 300); }

// ── 화면 ────────────────────────────────────────────────
function summary() {
    const rows = lastRows;
    const on = rows.filter(r => r.want === true).length, off = rows.filter(r => r.want === false).length;
    const keep = rows.filter(r => r.reason === '늘 필요').length, manual = rows.filter(r => r.manual).length, skip = rows.filter(r => r.want === null).length - keep - manual;
    return { on, off, keep, manual, skip, total: rows.length };
}

function moduleTable() {
    const names = new Map((oai_settings.prompts || []).map(p => [p.identifier, p.name]));
    const enabled = enabledPrompts() || new Set();
    const groups = new Map();
    for (const row of lastRows) for (const key of row.keys) {
        const g = groups.get(key) || { key, rows: [], owners: new Set() };
        g.rows.push(row); row.owners.forEach(o => g.owners.add(o)); groups.set(key, g);
    }
    if (!groups.size) return `<p class="rlk-empty">${esc(lastNote || '연결할 모듈 태그가 있는 정규식이 없어요.')}</p>`;
    const s = store();
    const rowsHtml = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(g => {
        const on = g.rows.filter(r => r.want === true).length, off = g.rows.filter(r => r.want === false).length;
        const owners = [...g.owners].map(id => `<span class="rl-owner ${enabled.has(id) ? 'on' : ''}">${esc(String(names.get(id) || id).replace(/[「」|!⚠️❗]/g, '').trim())}</span>`).join('');
        const hand = g.rows.filter(r => r.manual);
        const state = !g.owners.size ? '<i>짝 프롬프트 없음 · 그대로</i>' : [on && `켜짐 ${on}`, off && `꺼짐 ${off}`, hand.length && `직접 바꿈 ${hand.length}`].filter(Boolean).join(' · ');
        const mode = s.modules[g.key] || 'auto';
        // 1.1.2 직접 바꾼 정규식: 이름과 「자동으로」 (누르면 직접 바꿈 표시를 지우고 다시 프롬프트를 따라요)
        const manual = hand.length ? `<div class="rl-manual"><small>직접 바꿈 — 자동 안 함: ${hand.map(r => esc(r.name || r.id)).join(' · ')}</small><button type="button" class="salty-btn rl-auto" data-auto="${esc(g.key)}">자동으로</button></div>` : '';
        return `<div class="rl-module"><div class="rl-module-head"><b>${esc(g.key)}</b><small>정규식 ${g.rows.length}개 · ${state}</small></div><div class="rl-owners">${owners || '<span class="rl-owner">—</span>'}</div>${manual}<select class="text_pole rl-mode" data-module="${esc(g.key)}" aria-label="${esc(g.key)} 처리"><option value="auto" ${mode === 'auto' ? 'selected' : ''}>프롬프트 따라</option><option value="on" ${mode === 'on' ? 'selected' : ''}>늘 켜기</option><option value="off" ${mode === 'off' ? 'selected' : ''}>늘 끄기</option></select></div>`;
    }).join('');
    return rowsHtml;
}

// 1.4.x opt-chat-open(고침안 6): 채팅을 열 때마다(CHAT_CHANGED → 0.3초 뒤) 요약 · 모듈 표를 같은 글로 다시 넣던 것 — 글이 같으면 손대지 않아요.
//   다시 넣으면 HTML 풀기에 더해, 이 창(#regex-link-settings)을 보는 단추 글자 맞춤(control-ink)이 새 단추를 보고 창을 다시 재려고 배치를 강제했어요(창이 닫혀 있어도 보이는지 묻는 읽기).
//   넣은 글을 요소마다 기억해 두고, 누가 그 칸을 비웠으면(자식 없음) 다시 넣어요
const shownHtml = new WeakMap();
function setHtml(el, html) {
    if (!el) return;
    if (shownHtml.get(el) === html && (el.firstChild || !html)) return;
    el.innerHTML = html; shownHtml.set(el, html);
}

function render() {
    if (!root) return;
    const s = store(), { on, off, keep, manual, skip, total } = summary();
    setHtml(root.querySelector('.rl-summary'), total
        ? `정규식 ${total}개 중 <b>${on}개 켜짐</b> · <b>${off}개 꺼짐</b>${manual ? ` · ${manual}개는 직접 바꿔 그대로` : ''}${keep ? ` · ${keep}개는 늘 필요해 그대로` : ''}${skip ? ` · ${skip}개는 태그나 짝 프롬프트가 없어 그대로` : ''}`
        : '연동 중인 정규식 없음');
    root.querySelector('[data-keep]').checked = s.keepRecent;
    root.querySelector('[data-recent]').value = s.recent;
    setHtml(root.querySelector('.rl-modules'), moduleTable());
    const performanceToggle = root.querySelector('[data-performance]');
    if (performanceToggle) performanceToggle.checked = s.performanceOn;
    void syncPerformance();
}

function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'regex-link-settings'; root.className = 'inline-drawer';
    root.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-link" aria-hidden="true"></i> 프롬프트 연동 정규식 <span class="ext-version">v${VERSION}</span></b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
<div class="inline-drawer-content">
  <p class="rl-summary" role="status"></p>
  <p class="salty-note">프롬프트 모듈을 끄면 연결된 정규식도 쉬어요. 다음 답변부터 반영되며, 직접 바꾼 설정은 유지해요.</p>
  <label class="rlk-keep"><input type="checkbox" data-keep><span><b>최근 메시지에 그 모듈이 있으면 켜 둠</b><small>이전 답에 남은 상태창 · 선택지가 날것으로 보이지 않게</small></span><input type="number" class="text_pole" data-recent min="1" aria-label="최근 메시지 수"></label>
  <details class="rlk-performance" data-performance-details>
    <summary>실행 시간 · 최적화</summary>
    <label class="checkbox_label"><input type="checkbox" data-performance><span>정규식 성능 보조</span></label>
    <p class="salty-note" data-performance-status role="status"></p>
    <p class="salty-note">프롬프트 연동은 필요 없는 규칙을 쉬게 하고, 성능 보조는 남은 규칙의 실행 비용을 줄여요. 저장한 검색식과 치환식은 자동으로 고치지 않아요.</p>
    <div data-performance-panel hidden></div>
  </details>
  <div class="rl-modules"></div>
</div>`;
    holder.append(root);
    root.addEventListener('change', event => {
        const el = event.target;
        if ('keep' in el.dataset) { store().keepRecent = el.checked; saveSettingsDebounced(); sync(); }
        else if ('recent' in el.dataset) { store().recent = Math.max(1, Math.floor(Number(el.value)) || 30); el.value = store().recent; saveSettingsDebounced(); sync(); }
        else if ('performance' in el.dataset) { store().performanceOn = el.checked; saveSettingsDebounced(); void syncPerformance(true); }
        else if (el.dataset.module) { const s = store(); if (el.value === 'auto') delete s.modules[el.dataset.module]; else s.modules[el.dataset.module] = el.value; saveSettingsDebounced(); sync(); }
    });
    root.querySelector('[data-performance-details]')?.addEventListener('toggle', event => { if (event.target.open) void syncPerformance(true); });
    root.addEventListener('click', event => {
        const key = event.target?.closest?.('[data-auto]')?.dataset?.auto;
        if (!key) return;
        const s = store();
        // 「자동으로」 = 프롬프트를 따름: 원래 값은 켜짐으로 적는다 (지금 값으로 적으면 손으로 꺼 둔 것이 「원래 꺼 둔 것」이 돼 계속 꺼져 있어요)
        for (const row of lastRows) if (row.manual && row.keys.includes(key)) { delete s.manual[row.id]; s.origin[row.id] = false; }
        saveSettingsDebounced(); sync();
    });
    verifyAddonCss({ folder: 'regexlink', name: '--rl-version', version: VERSION, title: '프롬프트 연동 정규식', selector: '#regex-link-settings' });
}

const listened = [];
function listen() {
    if (listened.length) return;
    const t = event_types;
    for (const name of [t.SETTINGS_UPDATED, t.OAI_PRESET_CHANGED_AFTER, t.CHAT_CHANGED, t.MESSAGE_RECEIVED, t.MESSAGE_SWIPED, t.MESSAGE_DELETED].filter(Boolean)) { eventSource.on(name, schedule); listened.push(name); }
    if (t.OAI_PRESET_CHANGED_AFTER) eventSource.on(t.OAI_PRESET_CHANGED_AFTER, forgetUserEdit);
    // 정규식 화면 누르기는 캡처 단계로 — 실리태번 스위치(.regex-toggle-on/off) · 일괄 단추 · 정규식 프리셋이 값을 바꾸기 전에 사진을 찍는다
    for (const type of SCREEN_EVENTS) document.addEventListener?.(type, onRegexScreen, true);
}
function unlisten() {
    for (const name of listened) eventSource.removeListener(name, schedule);
    if (listened.length && event_types.OAI_PRESET_CHANGED_AFTER) eventSource.removeListener(event_types.OAI_PRESET_CHANGED_AFTER, forgetUserEdit);
    for (const type of SCREEN_EVENTS) document.removeEventListener?.(type, onRegexScreen, true);
    listened.length = 0; userEdit = null;
}
const SCREEN_EVENTS = ['click', 'input', 'change'];

/** 테마가 기능을 끌 때 (addons.js) — 원래 상태로 되돌리고 감시를 멈춘다 */
export async function stop() {
    stopped = true;
    performanceEpoch++;
    performanceModule?.setRuntimeEnabled(false);
    unlisten(); clearTimeout(timer);
    // 정규식 화면 · 프리셋 저장으로 우리가 쓴 값이 프리셋 파일에 들어갔으면 되돌린 목록으로 파일도 고친다 (origin 은 저장한 뒤 지운다)
    const s = store(), list = oai_settings.extensions?.regex_scripts, name = oai_settings.preset_settings_openai;
    const mine = restoreLists().includes(list) ? list.filter(x => x?.id && x.id in s.origin) : [];
    const pm = mine.length ? getPresetManager('openai') : null;
    const storedList = pm?.getCompletionPresetByName(name)?.extensions?.regex_scripts;
    // 정규식 화면 저장 뒤엔 저장본이 지금 목록(또는 우리가 손댄 옛 목록)과 같은 배열이라 파일 값을 알 수 없다 — 그땐 그냥 쓴다
    const shared = Array.isArray(storedList) && (storedList === list || seenLists.has(storedList));
    const stored = new Map((Array.isArray(storedList) ? storedList : []).filter(x => x?.id).map(x => [x.id, !!x.disabled]));
    const keep = new Set(shared || mine.some(x => stored.has(x.id) && stored.get(x.id) !== s.origin[x.id]) ? mine.map(x => x.id) : []);
    sync({ restore: true, keep });
    if (!keep.size) return;
    try { await pm.writePresetExtensionField({ name, path: 'regex_scripts', value: list }); }
    catch (error) { console.warn('[Blue Lemonade] 프롬프트 연동 정규식: 프리셋 파일을 되돌리지 못했어요', error); return; }
    for (const id of keep) delete s.origin[id];
    saveSettingsDebounced();
}

/** 사용 모드 저장 실패를 되돌릴 때만 재개한다. 일반 끄기→켜기는 기존 새로고침 흐름을 따른다. */
export async function resume() {
    if (!stopped) return;
    stopped = false; listen(); sync();
}

// 1.1.2 불러오기만 해서는 시작하지 않는다: 테마 설정에서 켜져 있을 때만 감시를 건다 (꺼져 있으면 정규식 화면 · 설정 저장을 보지도 않는다)
jQuery(() => { mount(); if (!stopped && featureOn()) { listen(); schedule(); } });

export async function openPanel() {
    if (inlineHost?.isConnected && inlineHost.offsetParent) { root.scrollIntoView({ block: 'nearest' }); return; }
    if (opening) return; opening = true; mount(); sync();
    root.querySelector('.inline-drawer-content').style.display = 'flex';
    try { await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') }); }
    finally { (inlineHost?.isConnected ? inlineHost : holder).replaceChildren(root); opening = false; }
}

export function mountInline(host) {
    mount(); sync();
    inlineHost = host; if (opening) host.textContent = '열린 설정창을 닫으면 여기에 표시돼요.'; else host.replaceChildren(root); root.classList.add('bl-embedded-settings');
    const content = root.querySelector('.inline-drawer-content'); if (content) content.style.display = 'flex';
    return () => { if (inlineHost !== host) return; inlineHost = null; root.classList.remove('bl-embedded-settings'); if (!opening) holder.append(root); };
}

/** 같은 실행 인스턴스의 상태만 읽어요. 검사기가 엔진을 두 번 불러오지 않게 해요. */
export function performanceState() {
    return { configured: store().performanceOn, loaded: !!performanceModule,
        ...(performanceModule?.regexPerfStatus() || { enabled: false, patched: false, wrapperWarning: '', persistAvailable: false }) };
}

// 콘솔 · 검사용
globalThis.RegexLink = { sync, stop, rows: () => lastRows, store, performanceState };
