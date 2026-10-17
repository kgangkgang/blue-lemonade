// 프롬프트 귀속 (6.0.4) — 프롬프트 관리자(Chat Completion 프리셋)의 항목을 캐릭터 · 그룹 · 채팅에 묶어 두면,
// 그 채팅을 열 때 그 항목이 켜지고 다른 채팅으로 가면 꺼진다 (사용자: "대사 컬러 프롬은 그 캐릭터한테만 귀속").
// 항목에 정규식을 붙여 두면 그 정규식도 같이 켜지고 꺼진다 ("정규식도 캐릭터 연동 · 프롬프트에서 조작").
// 켜짐을 바꾸면 실리태번이 설정을 저장하므로 정규식 연결 애드온(regexlink)으로 이은 정규식도 따라간다.
//
// 설정: promptBinds { <프롬프트 identifier>: { keys: ['c:<아바타 파일>' | 'g:<그룹 id>' | 'c:<아바타>/<채팅 파일>' | 'g:<그룹>/<채팅>'], regex: [<정규식 스크립트 id>] } } (settings.js)
// UI: 실리태번 프롬프트 편집 창(#completion_prompt_manager_popup_edit) 맨 아래 「자동 켜기」 줄 — 지금 캐릭터 · 지금 채팅 · 목록 · 정규식 · 묶인 칩(×)
// 메모 애드온의 귀속(캐릭터 전체 / 이 채팅)과 같은 열쇠 체계. 그룹 채팅은 'g:' 열쇠. 열쇠 이름은 styles.js keyLabel.
//
// 정규식은 세 곳(6.0.6): 전역(extension_settings.regex) · 이 캐릭터 카드(characters[].data.extensions.regex_scripts, 6.0.5)
//   · 프리셋(getPresetManager().readPresetExtensionField({ path: 'regex_scripts' }), 6.0.6 — 사용자는 전역 0개 · 프리셋 79개라 「프리셋은 안 뜨니」).
//   켜고 끄기는 각자 저장 경로로: 전역 saveSettingsDebounced · 카드 writeExtensionField · 프리셋 writePresetExtensionField (실리태번 정규식 창의 saveScriptsByType 과 같다).
//   고르기 창의 찾기는 한글화(번역) 스크립트가 실리태번 정규식 목록 줄(#<id> .regex_script_name)에 바꿔 보여 주는 이름으로도 맞춘다(regexShownName) —
//   "한글화 스크립트 적용된 걸로도 검색되게". 묶인 정규식이 켜지거나 꺼지면 reloadCurrentChat 로 채팅을 다시 그린다 —
//   표시 전용 정규식(markdownOnly)은 CHAT_CHANGED 가 글을 다 그린 뒤라 이미 그려진 글에는 안 먹었다 (실리태번도 정규식을 켜고 끌 때 다시 그린다).
import { getSettings, saveSettings } from './settings.js';
import { currentKey, keyLabel } from './styles.js';

const POPUP_FORM = 'completion_prompt_manager_popup_edit';
const SAVE_BUTTON = 'completion_prompt_manager_popup_entry_form_save';
const NAME_FIELD = 'completion_prompt_manager_popup_entry_form_name';   // 편집 창 이름 칸 — 실리태번이 항목을 열 때 채운다
let pm = null;          // 실리태번 promptManager (openai.js) — 검사에서는 setPromptManager 로 꽂는다
let listening = false, observer = null, syncing = null, rerun = false, settleTimer = 0, lastReload = 0, reloadTimer = 0, lastChatChange = 0;
// 6.0.6 어떤 계기의 맞추기가 정규식을 바꿨을 때 채팅을 다시 그리나: 채팅 열기 · 프리셋 바꿈 · 편집 창 조작 · 시작. 설정 저장 뒤의 되맞춤(settle · again)은 아니다 —
//   다른 확장(정규식 연결 애드온 · 정규식 창의 손 조작)이 되돌린 것을 우리가 또 되돌리는 자리라, 거기서 다시 그리면 서로 뒤집을 때마다 다시 그리는 폭풍이 된다
const RELOAD_REASONS = new Set(['chat', 'preset', 'ui', 'start']);

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

// ───────── 정규식 (전역 · 이 캐릭터 카드 · 프리셋) ─────────
/** 전역 정규식 스크립트 목록 (확장 설정 regex) — 없으면 [] */
export function regexScripts() {
    try { const list = SillyTavern.getContext().extensionSettings?.regex; return Array.isArray(list) ? list : []; } catch { return []; }
}
/** 6.0.5 지금 캐릭터의 카드 안(스코프) 정규식 스크립트 — 없으면 [] (사용자는 전역 정규식이 0개, 카드 정규식만 썼다) */
export function scopedRegexScripts() {
    try { const ctx = SillyTavern.getContext(); const ch = ctx.characters?.[Number(ctx.characterId)]; const list = ch?.data?.extensions?.regex_scripts; return Array.isArray(list) ? list : []; } catch { return []; }
}
/** 6.0.6 지금 프리셋 안의 정규식 스크립트 (Chat Completion 프리셋 extensions.regex_scripts) — 없으면 [] (사용자: 전역 0개 · 프리셋 79개) */
export function presetRegexScripts() {
    try { const list = SillyTavern.getContext().getPresetManager?.()?.readPresetExtensionField?.({ path: 'regex_scripts' }); return Array.isArray(list) ? list : []; } catch { return []; }
}
/** 정규식이 사는 곳 — 실리태번 정규식 창의 순서(전역 · 캐릭터 · 프리셋) */
export const REGEX_SCOPES = [['global', '전역', regexScripts], ['scoped', '이 캐릭터', scopedRegexScripts], ['preset', '프리셋', presetRegexScripts]];
/** 세 곳의 정규식을 한 목록으로 ({ ...스크립트, _scope }) — 읽기 전용 사본 */
export function allRegexScripts() {
    return REGEX_SCOPES.flatMap(([scope, , get]) => get().filter(s => s && s.id).map(s => ({ ...s, _scope: scope })));
}
/** 6.0.6 한글화(번역) 스크립트가 실리태번 정규식 목록 줄(#<id> .regex_script_name)에 바꿔 둔 이름 — 줄이 없으면 '' */
export function regexShownName(id) {
    if (typeof document === 'undefined' || !id) return '';
    try {
        const row = document.getElementById(String(id));
        if (!row?.classList?.contains('regex-script-label')) return '';
        return row.querySelector('.regex_script_name')?.textContent?.trim() || '';
    } catch { return ''; }
}
/** 보이는 이름: 한글화된 이름 › 원래 이름 › id */
export function regexLabel(script) { return regexShownName(script?.id) || String(script?.scriptName || script?.id || ''); }
export function regexName(id) { const s = allRegexScripts().find(x => x.id === id); return s ? regexLabel(s) : String(id || ''); }
/** 찾기: 원래 이름 · 한글화된 이름 어느 쪽이든 (대소문자 무시) */
export function regexMatches(script, needle) {
    const q = String(needle || '').trim().toLowerCase();
    if (!q) return true;
    return [script?.scriptName, regexShownName(script?.id)].some(t => String(t || '').toLowerCase().includes(q));
}
/** 실리태번 정규식 창의 줄(켜짐 체크)을 맞춘다 — 저장은 각자 경로로 이미 했고, 창은 이벤트 없이는 다시 안 그려진다 */
function reflectRow(id, disabled) {
    if (typeof document === 'undefined') return;
    try {
        const row = document.getElementById(String(id));
        const cb = row?.classList?.contains('regex-script-label') ? row.querySelector('input.disable_regex') : null;
        if (cb && cb.checked !== disabled) cb.checked = disabled;
    } catch { /* 줄이 없으면 그만 */ }
}

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
    const rows = getSettings().promptLink?.rows;   // 6.7.5 캐릭터 이름 연동 줄의 카드도 옮긴다
    for (const row of Array.isArray(rows) ? rows : []) if (Array.isArray(row?.cards) && row.cards.includes(oldAvatar)) { row.cards = [...new Set(row.cards.map(c => (c === oldAvatar ? newAvatar : c)))]; n++; }
    if (n) saveSettings();
    return n;
}

/**
 * 7.0.2 채팅 이름 바꾸기: 「+ 지금 채팅」 열쇠('c:아바타/채팅' · 'g:그룹/채팅')를 새 이름으로 옮긴다 — 안 옮기면 실리태번이 이름 바꾼 뒤 내는 CHAT_CHANGED 맞추기가
 * 묶음(옛 이름)과 안 맞아 그 프롬프트를 끄고 저장했다. 실리태번은 CHAT_RENAMED 를 CHAT_CHANGED 뒤에 내므로 옮긴 다음 다시 맞춘다(startPromptBinds).
 * 새 이름은 초안(draft.js renamedChatKey)과 같은 규칙으로 정리 — 지금 열린 채팅이면 실리태번의 실제 채팅 id 를 쓴다(서버가 다르게 정리했을 수 있다)
 */
export function renameChatKeys({ avatarId, groupId, oldFileName, newFileName } = {}, currentChatId = null) {
    const owner = groupId ? `g:${groupId}` : avatarId ? `c:${avatarId}` : '';
    const from = String(oldFileName || '').replace(/\.jsonl$/i, '');
    const clean = String(newFileName || '').replace(/[<>:"/\\|?*\x00-\x1f\x80-\x9f]/g, '').replace(/[ .]+$/, '').replace(/\.jsonl$/i, '');
    const to = currentChatId && String(currentChatId) !== from ? String(currentChatId) : clean;
    if (!owner || !from || !to || from === to) return 0;
    const oldKey = `${owner}/${from}`, newKey = `${owner}/${to}`;
    let n = 0;
    for (const bind of Object.values(binds())) {
        if (!Array.isArray(bind.keys) || !bind.keys.includes(oldKey)) continue;
        bind.keys = [...new Set(bind.keys.map(k => (k === oldKey ? newKey : k)))];
        n++;
    }
    if (n) saveSettings();
    return n;
}

// ───────── 캐릭터 이름 연동 (6.5.2 · 6.7.5 여러 줄 · prompt-link.js) ─────────
// 설정 promptLink { on, rows: [{ word, cards }] }: 줄마다 말(word)이 든 프롬프트는 그 줄의 캐릭터 채팅에서만 켜진다 — 고른 카드(cards: 아바타 파일) 중 하나,
// 카드를 안 골랐으면 말과 이름이 같은 카드(카드 이름 · 아바타 파일 이름), 그룹이면 구성원 중 하나. 말은 띄어쓰기 · 대소문자 · 전각을 무시하고 찾는다.
// 이름 자리가 「기본」이거나 말(과 옆의 · — 괄호)만 빠진 같은 이름의 프롬프트는 짝으로 반대로 켜진다 — 「대사 색상 (A · 이름)」 ↔ 「대사 색상 (A · 기본)」,
// 「| Dialogue Color (이름) |」 ↔ 「| Dialogue Color |」. 여러 줄이 같은 짝을 함께 쓰면 짝은 그 줄들 어디에도 안 맞을 때만 켜진다.
// 정규식은 말이 든 것만 (전역 · 카드 · 프리셋 · 짝 없음). 직접 묶은 프롬프트(promptBinds)는 묶음이 우선이다.
// 말 · 카드는 설정에만 있다. 켜짐 뒤집기 · 저장 · 다시 그리기는 아래 syncPromptBinds 의 묶음과 같은 길이라 되돌이표 규칙도 같다.
const fold = s => String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
const squash = s => fold(s).replace(/\s/g, '');   // 띄어쓰기까지 무시 (「Re x」 = 「Rex」)
const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = word => Array.from(squash(word)).map(escapeRe).join('\\s*');
const asRow = row => typeof row === 'string' ? { word: row, cards: [] } : { word: String(row?.word ?? ''), cards: Array.isArray(row?.cards) ? row.cards.filter(c => typeof c === 'string' && c) : [] };
/** 설정의 연동 줄 — 켜져 있고 말이 있는 줄만 ([] = 꺼짐 또는 비어 있음) */
export function linkRows() {
    try {
        const s = getSettings().promptLink;
        return s?.on === true && Array.isArray(s.rows) ? s.rows.map(asRow).filter(r => squash(r.word)).map(r => ({ ...r, word: r.word.trim() })) : [];
    } catch { return []; }
}
/** 이름에 든 줄 번호 — 말이 다른 줄 말의 일부일 뿐이면(Rex ⊂ Rexa) 긴 쪽만 */
function rowsIn(name, keys) {
    const text = squash(name);
    const hit = keys.flatMap((k, i) => (k && text.includes(k) ? [i] : []));
    return hit.filter(i => !hit.some(j => keys[j] !== keys[i] && keys[j].includes(keys[i])));
}
/** 지금 열린 채팅이 그 줄의 캐릭터인가 — 고른 카드(아바타 파일) 중 하나 · 카드를 안 골랐으면 말과 같은 카드 이름 · 아바타 파일 이름(확장자 뺀) · 그룹이면 구성원 중 하나 */
export function linkMatches(row, ctx = SillyTavern.getContext()) {
    const { word, cards } = asRow(row);
    const n = squash(word), picked = new Set(cards);
    if (!n && !picked.size) return false;
    const characters = Array.isArray(ctx.characters) ? ctx.characters : [];
    const is = avatar => {
        if (picked.size) return picked.has(avatar);
        const c = characters.find(x => x?.avatar === avatar);
        return !!c && (squash(c.name) === n || squash(String(c.avatar || '').replace(/\.[a-z0-9]+$/i, '')) === n);
    };
    if (ctx.groupId) { const g = (ctx.groups || []).find(x => String(x.id) === String(ctx.groupId)); return !!(g?.members || []).some(is); }
    const id = Number(ctx.characterId);
    return Number.isInteger(id) && !!characters[id] && is(characters[id].avatar);
}
/** 말이 든 항목 이름 → 짝 이름 후보(fold 한 것): 말 자리에 「기본」 · (말) 괄호째 뺀 것 · 옆의 ·—/| 와 함께 뺀 것 · 말만 뺀 것 */
export function linkTwinNames(label, name) {
    const raw = String(label || '').normalize('NFKC'), key = squash(name);
    if (!key || !squash(raw).includes(key)) return [];
    const e = wordRe(name);
    const out = [raw.replace(new RegExp(e, 'gi'), '기본'), raw.replace(new RegExp(`\\s*[(（]\\s*${e}\\s*[)）]`, 'gi'), ''),
        raw.replace(new RegExp(`\\s*[·•—–\\-/|]\\s*${e}|${e}\\s*[·•—–\\-/|]\\s*`, 'gi'), ''), raw.replace(new RegExp(e, 'gi'), '')];
    return [...new Set(out.map(fold).filter(x => x && x !== fold(raw) && !squash(x).includes(key)))];
}
/** 지금 프리셋의 이름 규칙: 말이 든 프롬프트(linked) · 그 짝(twins) · 바라는 켜짐(want) · 줄마다 개수(counts).
 *  말이 든 것은 그 말의 줄 중 하나라도 맞으면 켜고, 짝은 그 짝을 쓰는 줄 어디에도 안 맞을 때만 켠다 */
function linkRule(m, rows, matches = []) {
    let order = [];
    try { order = m?.getPromptOrderForCharacter?.(m.activeCharacter) || []; } catch { order = []; }
    const label = new Map();
    for (const e of order) if (e?.identifier && !label.has(e.identifier)) { let name = ''; try { name = String(m.getPromptById?.(e.identifier)?.name || ''); } catch { name = ''; } label.set(e.identifier, name); }
    const keys = rows.map(r => squash(r.word)), owners = new Map(), twinOf = new Map();
    for (const [id, name] of label) { const hit = rowsIn(name, keys); if (hit.length) owners.set(id, hit); }
    const plain = [...label].filter(([id]) => !owners.has(id)).map(([id, name]) => [id, squash(name)]);
    for (const [id, hit] of owners) for (const i of hit) {
        const names = new Set(linkTwinNames(label.get(id), rows[i].word).map(squash));
        for (const [t, name] of plain) if (names.has(name)) { if (!twinOf.has(t)) twinOf.set(t, new Set()); twinOf.get(t).add(i); }
    }
    const want = new Map();
    for (const [id, hit] of owners) want.set(id, hit.some(i => !!matches[i]));
    for (const [id, set] of twinOf) want.set(id, ![...set].some(i => !!matches[i]));
    const counts = rows.map((_, i) => ({ prompts: [...owners.values()].filter(h => h.includes(i)).length, twins: [...twinOf.values()].filter(t => t.has(i)).length }));
    return { order, linked: new Set(owners.keys()), twins: new Set(twinOf.keys()), want, counts };
}
/** 설정 창 안내용: 지금 프리셋에서 이름 규칙이 잡는 개수 { prompts, twins, regex, rows: 줄마다 { prompts, twins, regex } } — 줄은 받은 차례 그대로(말이 빈 줄은 0) */
export async function linkReport(rows = linkRows()) {
    const list = (Array.isArray(rows) ? rows : [rows]).map(asRow);
    const none = { prompts: 0, twins: 0, regex: 0, rows: list.map(() => ({ prompts: 0, twins: 0, regex: 0 })) };
    const m = await manager();
    if (!list.some(r => squash(r.word)) || !m?.activeCharacter) return none;
    const rule = linkRule(m, list);
    const keys = list.map(r => squash(r.word)), hits = allRegexScripts().map(s => rowsIn(s.scriptName, keys));
    return { prompts: rule.linked.size, twins: rule.twins.size, regex: hits.filter(h => h.length).length,
        rows: list.map((_, i) => ({ ...rule.counts[i], regex: hits.filter(h => h.includes(i)).length })) };
}

// ───────── 맞추기 ─────────
/** 이 묶음이 지금 열린 곳에서 켜져야 하나 (캐릭터 열쇠가 하나도 없으면 null = 판단하지 않음 — 정규식만 붙인 묶음) */
export function wanted(bind, keys = currentKeys()) {
    if (!Array.isArray(bind?.keys) || !bind.keys.length) return null;
    return bind.keys.some(k => keys.includes(k));
}
/** 설정에 실린 프리셋 정규식 목록이 지금 고른 프리셋에 저장된 것과 같은가 — 프리셋을 바꾸는 틈(선택은 새 이름 · 설정은 아직 옛 프리셋)에 옛 목록을 새 프리셋에 써 넣지 않게 */
function presetSettled(pmgr, name, live) {
    try {
        if (!pmgr || typeof pmgr.getCompletionPresetByName !== 'function') return true;   // 견줄 길이 없으면 믿는다
        const stored = pmgr.getCompletionPresetByName(name)?.extensions?.regex_scripts;
        if (stored === live) return true;
        const sig = list => (Array.isArray(list) ? list : []).map(s => `${s?.id}:${s?.disabled === true ? 1 : 0}`).join(',');
        return sig(stored) === sig(live);
    } catch { return false; }
}
/** 묶인 프롬프트(와 붙인 정규식)를 지금 채팅에 맞춰 켜고 끈다 → 바꾼 개수 (프롬프트 관리자가 없거나 묶음이 없으면 0). reason 은 RELOAD_REASONS 참고 */
export async function syncPromptBinds(reason = 'ui') {
    if (syncing) { rerun = true; return syncing; }   // 맞추는 중에 또 부르면(채팅이 바로 또 바뀜) 끝난 뒤 한 번 더
    syncing = (async () => {
        const all = binds();
        const ids = Object.keys(all);
        const link = linkRows();   // 6.5.2 캐릭터 이름 연동 (6.7.5 여러 줄)
        if (!ids.length && !link.length) return 0;
        const m = await manager();
        if (!m?.activeCharacter || typeof m.getPromptOrderEntry !== 'function') return 0;
        const keys = currentKeys();
        const scripts = regexScripts(), scoped = scopedRegexScripts();
        let pmgr = null, presetName = '';
        try { pmgr = SillyTavern.getContext().getPresetManager?.() || null; presetName = String(pmgr?.getSelectedPresetName?.() || ''); } catch { pmgr = null; }
        let preset = presetRegexScripts();
        if (preset.length && !presetSettled(pmgr, presetName, preset)) preset = [];   // 프리셋이 바뀌는 중 — 이번엔 프리셋 정규식을 건드리지 않는다 (다음 맞추기에서)
        let changed = 0, regexChanged = 0, scopedChanged = 0, presetChanged = 0;
        // 정규식은 묶음마다 바로 바꾸지 않고 바라는 상태를 먼저 모은다 — 두 묶음이 같은 정규식을 서로 다르게 바라면 켜기가 이긴다
        // (묶음마다 뒤집으면 맞출 때마다 두 번 바뀌어 '바뀜'이 끝나지 않고, 6.0.6 다시 그리기와 맞물려 되돌이표가 된다)
        const wantRegex = new Map();
        for (const id of ids) {
            const want = wanted(all[id], keys);
            if (want === null) continue;
            let entry = null;
            try { entry = m.getPromptOrderEntry(m.activeCharacter, id); } catch { entry = null; }
            if (entry && (entry.enabled !== false) !== want) { entry.enabled = want; changed++; }
            for (const sid of (Array.isArray(all[id].regex) ? all[id].regex : [])) wantRegex.set(sid, (wantRegex.get(sid) || false) || want);
        }
        if (link.length) {   // 6.5.2 이름 규칙: 말이 든 프롬프트는 그 줄이 맞으면 켜고 짝은 반대로 · 직접 묶은 프롬프트는 건너뜀 · 정규식은 묶음과 같이 켜기가 이긴다
            const matches = link.map(row => linkMatches(row));
            const rule = linkRule(m, link, matches);
            for (const [id, want] of rule.want) {
                if (all[id] && wanted(all[id], keys) !== null) continue;
                const entry = rule.order.find(e => e.identifier === id);
                if (entry && (entry.enabled !== false) !== want) { entry.enabled = want; changed++; }
            }
            const words = link.map(row => squash(row.word));
            for (const list of [scripts, scoped, preset]) for (const sc of list) {
                const hit = sc?.id ? rowsIn(sc.scriptName, words) : [];
                if (hit.length) wantRegex.set(sc.id, (wantRegex.get(sc.id) || false) || hit.some(i => matches[i]));
            }
        }
        for (const [sid, want] of wantRegex) {
            const sc = scripts.find(s => s && s.id === sid);
            if (sc && (sc.disabled === true) !== !want) { sc.disabled = !want; regexChanged++; reflectRow(sid, !want); }
            const sp = scoped.find(s => s && s.id === sid);   // 6.0.5 카드 안 정규식 (지금 캐릭터 것만 보인다 — 다른 캐릭터에선 어차피 안 돈다)
            if (sp && (sp.disabled === true) !== !want) { sp.disabled = !want; scopedChanged++; reflectRow(sid, !want); }
            const pp = preset.find(s => s && s.id === sid);   // 6.0.6 프리셋 안 정규식 (지금 프리셋 것만 보인다 — 다른 프리셋으로 바꾸면 그 프리셋 것이 보인다)
            if (pp && (pp.disabled === true) !== !want) { pp.disabled = !want; presetChanged++; reflectRow(sid, !want); }
        }
        if (changed) {
            // 저장은 기다리지 않는다 — 실리태번의 saveServiceSettings 는 SETTINGS_UPDATED 가 올 때까지 매달리는데(1초 넘게 · 생성 중엔 더),
            // 그동안 잠금(syncing)이 잡혀 있으면 바로 이어진 채팅 바뀜의 맞추기가 통째로 버려졌다 (10-11 스모크: 켜기는 되고 나가도 안 꺼짐)
            try { Promise.resolve(m.saveServiceSettings?.()).catch(() => { /* 저장 실패해도 화면은 맞춘다 */ }); } catch { /* 저장 없음 */ }
            try { m.render?.(false); } catch { /* 그리기 실패는 무시 */ }
            // 10-11 스모크: 저장 · 그리기 뒤에 항목이 켜짐으로 되돌아오는 일이 있었다 → 잠시 뒤 다시 맞춘다 (맞으면 아무것도 안 하니 되돌이표 없음; 잠금 밖에서)
            for (const ms of [350, 1200]) setTimeout(() => { syncPromptBinds('again'); }, ms);
        }
        if (regexChanged && !changed) { try { SillyTavern.getContext().saveSettingsDebounced?.(); } catch { /* 저장 없음 */ } }
        if (scopedChanged) { try { const ctx = SillyTavern.getContext(); await ctx.writeExtensionField?.(Number(ctx.characterId), 'regex_scripts', scoped); } catch { /* 카드 저장 실패는 화면만 */ } }
        if (presetChanged) {
            // 프리셋 저장도 기다리지 않는다 (writePresetExtensionField 는 설정 전체 저장 + 프리셋 파일 저장 — 위 saveServiceSettings 와 같은 이유).
            // 읽을 때의 프리셋 이름으로 쓰고, 그새 다른 프리셋을 골랐으면 쓰지 않는다 (옛 목록이 새 프리셋 파일에 들어가지 않게)
            try {
                if (pmgr && typeof pmgr.writePresetExtensionField === 'function' && String(pmgr.getSelectedPresetName?.() || '') === presetName) {
                    Promise.resolve(pmgr.writePresetExtensionField({ name: presetName, path: 'regex_scripts', value: preset })).catch(() => { /* 프리셋 저장 실패는 화면만 */ });
                }
            } catch { /* 저장 없음 */ }
        }
        if ((regexChanged || scopedChanged || presetChanged) && RELOAD_REASONS.has(reason)) reloadChat();
        return changed + regexChanged + scopedChanged + presetChanged;
    })().finally(() => { syncing = null; if (rerun) { rerun = false; syncPromptBinds('again'); } });
    return syncing;
}
/** 6.0.6 정규식이 켜지거나 꺼졌으면 채팅을 다시 그린다 — 표시 전용 정규식은 이미 그려진 글에 안 먹는다 (실리태번 정규식 창에서 켜고 끌 때와 같은 reloadCurrentChat).
 *  1.5초 안에 또 바뀌었거나 생성 중(body[data-generating])이면 잠시 뒤로 미룬다 — 스트리밍 중에 다시 그리면 받던 글이 사라진다.
 *  미뤄 둔 다시 그리기는 채팅이 막 바뀐 직후(1초)엔 더 미룬다 — 실리태번이 아직 그 채팅을 그리는 중일 수 있다.
 *  다시 그리기 전에 저장한다 — 실리태번의 clearChat 이 미뤄 둔 저장(메시지 편집의 1초 디바운스)을 취소하고 파일에서 다시 읽는다. */
function reloadChat(deferred = false) {
    const now = Date.now();
    const wait = 1500 - (now - lastReload);
    let busy = false;
    try { busy = typeof document !== 'undefined' && document.body?.dataset?.generating === 'true'; } catch { busy = false; }
    const settling = deferred && now - lastChatChange < 1000;
    if (wait > 0 || busy || settling) {
        if (!reloadTimer) reloadTimer = setTimeout(() => { reloadTimer = 0; reloadChat(true); }, Math.max(wait, 600));
        return;
    }
    try {
        const ctx = SillyTavern.getContext();
        if (!ctx.getCurrentChatId?.() || typeof ctx.reloadCurrentChat !== 'function') return;
        lastReload = now;
        Promise.resolve().then(() => ctx.saveChat?.()).catch(() => { /* 저장 실패해도 다시 그린다 */ })
            .then(() => ctx.reloadCurrentChat()).catch(() => { /* 다시 그리기 실패는 다음 채팅 열기 때 맞는다 */ });
    } catch { /* 문맥 없음 */ }
}

// ───────── 편집 창 UI ─────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function editingId() { return document.getElementById(SAVE_BUTTON)?.dataset?.pmPrompt || ''; }
/** 고르기 창 제목에 쓸 프롬프트 이름 — 편집 창 이름 칸 › 프롬프트 관리자 › 식별자 (6.0.6: pm 은 검사 주입 때만 있어 식별자가 그대로 보였다) */
function promptName(id) {
    try { const typed = document.getElementById(NAME_FIELD)?.value?.trim(); if (typed) return typed; } catch { /* DOM 없음 */ }
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
/** 정규식 고르기: 전역 · 이 캐릭터 카드 · 프리셋 정규식 가운데 이 프롬프트와 함께 켜고 끌 것 (곳마다 묶어서, 찾기는 한글화된 이름으로도) */
function openRegexPicker(id) {
    const scripts = allRegexScripts();
    const dialog = dialogShell(`${promptName(id)} · 정규식`);
    const list = dialog.querySelector('.bl-pbind-list');
    list.classList.add('is-regex');
    const paint = (q = '') => {
        const chosen = new Set(regexOf(id));
        const rows = scripts.filter(s => regexMatches(s, q));
        let html = '';
        for (const [scope, label] of REGEX_SCOPES) {
            const group = rows.filter(s => s._scope === scope);
            if (!group.length) continue;
            html += `<div class="bl-pbind-group">${esc(label)}</div>` + group.map(s =>
                `<label class="bl-pbind-item"><input type="checkbox" data-regex="${esc(s.id)}"${chosen.has(s.id) ? ' checked' : ''}><span class="bl-pbind-noimg is-regex">R</span><span>${esc(regexLabel(s))}</span></label>`).join('');
        }
        list.innerHTML = html || '<p class="bl-pbind-empty">정규식이 없어요 (전역 · 이 캐릭터 카드 · 프리셋)</p>';
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
    eventSource.on(event_types.CHAT_CHANGED, () => { lastChatChange = Date.now(); syncPromptBinds('chat'); });
    if (event_types.OAI_PRESET_CHANGED_AFTER) eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, () => { syncPromptBinds('preset'); });
    // 설정이 저장될 때마다(프리셋 · 다른 확장이 순서를 다시 쓴 뒤에도) 잠시 뒤 한 번 더 맞춘다 — 맞으면 저장하지 않으니 되돌이표는 없다 (여기서 바뀐 정규식은 다시 그리지 않는다)
    if (event_types.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, () => { clearTimeout(settleTimer); settleTimer = setTimeout(() => { syncPromptBinds('settle'); }, 400); });
    if (event_types.CHARACTER_RENAMED) eventSource.on(event_types.CHARACTER_RENAMED, (oldAvatar, newAvatar) => { renameKeys(oldAvatar, newAvatar); });
    // 7.0.2 채팅 이름 바꾸기 — 열쇠를 옮기고 다시 맞춘다 (CHAT_CHANGED 맞추기가 이미 꺼 둔 프롬프트를 다시 켜게)
    if (event_types.CHAT_RENAMED) eventSource.on(event_types.CHAT_RENAMED, data => {
        const ctx = SillyTavern.getContext();
        const here = data?.groupId ? String(ctx.groupId ?? '') === String(data.groupId) : !ctx.groupId && ctx.characters?.[ctx.characterId]?.avatar === data?.avatarId;
        if (renameChatKeys(data, here ? (ctx.chatId ?? ctx.getCurrentChatId?.()) : null)) syncPromptBinds('chat');
    });
    if (typeof document !== 'undefined') {
        watchPopup();
        if (!observer) {   // 프롬프트 관리자 창이 아직 없으면 생길 때 붙는다
            const discovery = new MutationObserver(() => { watchPopup(); if (observer) discovery.disconnect(); });
            discovery.observe(document.body, { childList: true, subtree: true });
        }
    }
    if (SillyTavern.getContext().getCurrentChatId?.()) syncPromptBinds('start');
}

/** 시험용 */
export const _forTest = { renderChips, block, editingId, manager, promptName, reflectRow };
