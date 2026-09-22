// 프롬프트 연동 정규식 — 켜 둔 프롬프트에 딸린 정규식만 켜고, 꺼 둔 모듈(모멘텀 엔진 · 상태창 …)의 정규식은 끈다.
// 꺼진 정규식은 실리태번이 스트리밍 · 프롬프트 만들기에서 아예 건너뛰므로 답이 오는 동안 정규식 비용이 그만큼 준다.
// 켜고 끄는 것은 메모리의 정규식 목록(프리셋 · 전역 · 캐릭터)에 disabled 를 쓰는 것뿐 — 프리셋 파일은 사용자가 저장할 때와 기능을 끌 때(되돌린 값)만 바뀐다.
// 원래 상태는 origin 에 적어 두고, 기능을 끄면 되돌린다 (그새 저장돼 파일에 들어간 우리 값도). 계산은 engine.js (테스트 가능).
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import { getPresetManager } from '../../../../../../preset-manager.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../../script.js';
import { oai_settings, promptManager } from '../../../../../../openai.js';
import { plan, textHasModule } from './engine.js';

const VERSION = '1.0.1';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const holder = document.createElement('div'); holder.hidden = true; document.body.append(holder);
let root, inlineHost = null, opening = false, timer = 0, lastRows = [], lastNote = '', applied = new Map(), stopped = false;
const seenLists = new WeakSet(); // sync 가 본 목록 배열 — 처음 보는 배열은 새로 읽힌 것 (프리셋 다시 고르기 · 캐릭터 다시 읽기)

function store() {
    const s = extension_settings.regex_link ??= {};
    if (!s.origin || typeof s.origin !== 'object') s.origin = {};       // 정규식 id → 우리가 손대기 전 disabled
    if (!s.modules || typeof s.modules !== 'object') s.modules = {};     // 모듈 키 → 'on' | 'off' (없으면 자동)
    if (typeof s.keepRecent !== 'boolean') s.keepRecent = true;          // 최근 메시지에 그 모듈이 있으면 켜 둔다
    s.recent = Math.min(200, Math.max(1, Number(s.recent) || 30));
    return s;
}

/** 지금 실제로 쓰이는 정규식 목록들 (실리태번과 같은 기준: 허용된 프리셋 · 허용된 캐릭터) */
function scriptLists() {
    const ctx = SillyTavern.getContext();
    const lists = [];
    if (Array.isArray(extension_settings.regex)) lists.push(extension_settings.regex);
    const api = ctx.mainApi;
    const presetName = oai_settings?.preset_settings_openai;
    if (api === 'openai' && extension_settings.preset_allowed_regex?.openai?.includes(presetName) && Array.isArray(oai_settings.extensions?.regex_scripts)) lists.push(oai_settings.extensions.regex_scripts);
    const avatar = ctx.characters?.[ctx.characterId]?.avatar;
    const scoped = ctx.characters?.[ctx.characterId]?.data?.extensions?.regex_scripts;
    if (avatar && extension_settings.character_allowed_regex?.includes(avatar) && Array.isArray(scoped)) lists.push(scoped);
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
    const tail = chat.slice(-s.recent);
    const cache = new Map();
    return (keys) => {
        const k = keys.join('|');
        if (cache.has(k)) return cache.get(k);
        const hit = tail.some(m => m && !m.is_user && textHasModule(m.mes, keys));
        cache.set(k, hit);
        return hit;
    };
}

/** 계산하고 바뀐 것만 쓴다. 되돌린다: restore=true 면 origin 으로 (keep 에 든 id 는 origin 을 남긴다) */
export function sync({ restore = false, keep = null } = {}) {
    if (stopped && !restore) { render(); return; } // 끈 뒤에는 다시 켜지 않는다 (다시 켜려면 새로고침)
    const s = store();
    const enabled = enabledPrompts();
    const lists = scriptLists();
    const scripts = lists.flat().filter(x => x && x.id);
    if (!scripts.length) { lastRows = []; lastNote = '지금 쓰는 정규식이 없어요.'; render(); return; }
    // 사용자가 정규식 화면에서 직접 바꾼 것: 우리가 마지막에 쓴 값과 다르면 그 값을 새 원래 상태로
    for (const script of lists.filter(list => seenLists.has(list)).flat()) {
        if (!script?.id) continue;
        const mine = applied.get(script.id);
        if (mine !== undefined && !!script.disabled !== mine) { s.origin[script.id] = !!script.disabled; applied.delete(script.id); }
    }
    // 새로 읽힌 목록은 파일에 저장된 우리 옛 값일 수 있어 견주지 않는다 — 우리 기록만 지우고 origin 으로 다시 맞춘다
    for (const list of lists) if (!seenLists.has(list)) { seenLists.add(list); for (const script of list) if (script?.id) applied.delete(script.id); }
    let changed = 0;
    if (restore || !enabled) {
        for (const script of scripts) {
            if (!(script.id in s.origin)) continue;
            if (!!script.disabled !== s.origin[script.id]) { script.disabled = s.origin[script.id]; changed++; }
            if (!keep?.has(script.id)) delete s.origin[script.id];
            applied.delete(script.id);
        }
        lastRows = []; lastNote = restore ? '원래 상태로 되돌렸어요.' : '프롬프트 관리자(채팅 완성)를 쓸 때만 동작해요.';
    } else {
        const rows = plan({ scripts, prompts: oai_settings.prompts || [], enabled, origin: s.origin, overrides: s.modules, recentHas: recentHasFactory() });
        const byId = new Map(scripts.map(x => [x.id, x]));
        for (const row of rows) {
            const script = byId.get(row.id);
            if (row.want === null) {
                // 더는 연결되지 않는 정규식은 원래대로
                if (row.id in s.origin) { if (!!script.disabled !== s.origin[row.id]) { script.disabled = s.origin[row.id]; changed++; } delete s.origin[row.id]; applied.delete(row.id); }
                continue;
            }
            if (!(row.id in s.origin)) s.origin[row.id] = !!script.disabled;
            const want = !row.want; // disabled
            if (!!script.disabled !== want) { script.disabled = want; changed++; }
            applied.set(row.id, want);
        }
        lastRows = rows; lastNote = '';
    }
    if (changed) saveSettingsDebounced();
    render();
}

function schedule() { clearTimeout(timer); timer = setTimeout(() => sync(), 300); }

// ── 화면 ────────────────────────────────────────────────
function summary() {
    const rows = lastRows;
    const on = rows.filter(r => r.want === true).length, off = rows.filter(r => r.want === false).length, skip = rows.filter(r => r.want === null).length;
    return { on, off, skip, total: rows.length };
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
        const state = !g.owners.size ? '<i>짝 프롬프트 없음 · 그대로</i>' : `${on ? `켜짐 ${on}` : ''}${on && off ? ' · ' : ''}${off ? `꺼짐 ${off}` : ''}`;
        const mode = s.modules[g.key] || 'auto';
        return `<div class="rl-module"><div class="rl-module-head"><b>${esc(g.key)}</b><small>정규식 ${g.rows.length}개 · ${state}</small></div><div class="rl-owners">${owners || '<span class="rl-owner">—</span>'}</div><select class="text_pole rl-mode" data-module="${esc(g.key)}" aria-label="${esc(g.key)} 처리"><option value="auto" ${mode === 'auto' ? 'selected' : ''}>프롬프트 따라</option><option value="on" ${mode === 'on' ? 'selected' : ''}>늘 켜기</option><option value="off" ${mode === 'off' ? 'selected' : ''}>늘 끄기</option></select></div>`;
    }).join('');
    return rowsHtml;
}

function render() {
    if (!root) return;
    const s = store(), { on, off, skip, total } = summary();
    root.querySelector('.rl-summary').innerHTML = total
        ? `정규식 ${total}개 중 <b>${on}개 켜짐</b> · <b>${off}개 꺼짐</b>${skip ? ` · ${skip}개는 태그가 없어 그대로` : ''}`
        : esc(lastNote || '정규식을 아직 못 읽었어요.');
    root.querySelector('[data-keep]').checked = s.keepRecent;
    root.querySelector('[data-recent]').value = s.recent;
    root.querySelector('.rl-modules').innerHTML = moduleTable();
}

function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'regex-link-settings'; root.className = 'inline-drawer';
    root.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-link" aria-hidden="true"></i> 프롬프트 연동 정규식 <span class="ext-version">v${VERSION}</span></b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
<div class="inline-drawer-content">
  <p class="rl-summary" role="status"></p>
  <p class="salty-note">프롬프트 관리자에서 끈 모듈(예: 모멘텀 엔진)의 정규식은 자동으로 꺼지고, 다시 켜면 돌아와요. 이미 그려진 메시지는 그대로이고 다음 답부터 적용돼요. 정규식 화면에서 직접 바꾼 것은 그 값을 기준으로 삼아요.</p>
  <label class="rlk-keep"><input type="checkbox" data-keep><span><b>최근 메시지에 그 모듈이 있으면 켜 둠</b><small>이전 답에 남은 상태창 · 선택지가 날것으로 보이지 않게</small></span><input type="number" class="text_pole" data-recent min="1" max="200" aria-label="최근 메시지 수"></label>
  <div class="rl-modules"></div>
</div>`;
    holder.append(root);
    root.addEventListener('change', event => {
        const el = event.target;
        if ('keep' in el.dataset) { store().keepRecent = el.checked; saveSettingsDebounced(); sync(); }
        else if ('recent' in el.dataset) { store().recent = Number(el.value) || 30; saveSettingsDebounced(); sync(); }
        else if (el.dataset.module) { const s = store(); if (el.value === 'auto') delete s.modules[el.dataset.module]; else s.modules[el.dataset.module] = el.value; saveSettingsDebounced(); sync(); }
    });
    const css = getComputedStyle(root).getPropertyValue('--rl-version').trim().replace(/["']/g, '');
    if (css !== VERSION) globalThis.toastr?.warning(`프롬프트 연동 정규식 파일 버전이 달라요 (코드 ${VERSION}, 스타일 ${css || '없음'}).`);
}

const listened = [];
function listen() {
    const t = event_types;
    for (const name of [t.SETTINGS_UPDATED, t.OAI_PRESET_CHANGED_AFTER, t.CHAT_CHANGED, t.MESSAGE_RECEIVED, t.MESSAGE_SWIPED, t.MESSAGE_DELETED].filter(Boolean)) { eventSource.on(name, schedule); listened.push(name); }
}

/** 테마가 기능을 끌 때 (addons.js) — 원래 상태로 되돌리고 감시를 멈춘다 */
export async function stop() {
    stopped = true;
    for (const name of listened) eventSource.removeListener(name, schedule);
    listened.length = 0; clearTimeout(timer);
    // 정규식 화면 · 프리셋 저장으로 우리가 쓴 값이 프리셋 파일에 들어갔으면 되돌린 목록으로 파일도 고친다 (origin 은 저장한 뒤 지운다)
    const s = store(), list = oai_settings.extensions?.regex_scripts, name = oai_settings.preset_settings_openai;
    const mine = scriptLists().includes(list) ? list.filter(x => x?.id && x.id in s.origin) : [];
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

jQuery(() => { mount(); if (!stopped) { listen(); schedule(); } });

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

// 콘솔 · 검사용
globalThis.RegexLink = { sync, stop, rows: () => lastRows, store };
