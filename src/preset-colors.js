// 1.5.5 프리셋 인물 색 — 지금 켠 Chat Completion 프리셋의 켜진 프롬프트 · 켜진 정규식(지금 프리셋 · 전역 · 이 카드)에서 「이름 → 색」 을 뽑아
//   테마 인물표(src/people.js)의 공급자 'preset' 으로 둔다(차례 100 — TTS 공급자 뒤). 대사가 아직 없어도 프리셋에 정해 둔 색이 바로 보여요.
//   계산은 preset-colors-core.js(순수). 여기는 실리태번에서 글을 모으고 · 기억하고 · 바뀌면 다시 읽는 일만. 실리태번 설정은 읽기만 해요.
// 기억: 모은 글의 지문(프리셋 이름 · 켜진 항목 id 와 글 해시 · 켜진 정규식과 글 해시 · 카드 이름)이 같으면 다시 뽑지 않아요.
//   지문은 이벤트(프리셋 바꿈 · 설정 저장 · 채팅 바꿈 · 프롬프트 켬끔 저장) 때만 새로 재요 — 인물표가 이름마다 부르는 stamp() 는 판 번호만 봐요.
import { registerPeopleSource, peopleChanged } from './people.js';
import { parsePresetColors, colorIndex, foldName } from './preset-colors-core.js';

let unregister = null, unbind = null, api = null, loading = null;
let gen = 0, sig = '', table = new Map(), list = [];

const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() || null; } catch { return null; } };

/** 지금 카드 이름들(그룹이면 구성원 전부) */
function charNames(c) {
    const out = [];
    try {
        if (c?.groupId) {
            const g = (c.groups || []).find(x => x?.id === c.groupId);
            for (const av of g?.members || []) { const ch = (c.characters || []).find(x => x?.avatar === av); if (ch?.name) out.push(ch.name); }
        } else {
            const ch = c?.characters?.[Number(c.characterId)];
            if (ch?.name) out.push(ch.name);
            else if (c?.name2) out.push(c.name2);
        }
    } catch { /* 카드 없음 */ }
    return out;
}
/** 켜진 프롬프트 글 — 프롬프트 관리자의 지금 캐릭터 순서에서 켜진 것만 */
function enabledPrompts() {
    const pm = api?.promptManager;
    if (!pm) return [];
    try {
        const order = pm.getPromptOrderForCharacter?.(pm.activeCharacter) || [];
        const out = [];
        for (const e of order) {
            if (!e?.enabled) continue;
            const p = pm.getPromptById?.(e.identifier);
            if (typeof p?.content === 'string' && p.content.includes('#')) out.push({ id: e.identifier, text: p.content });
        }
        return out;
    } catch { return []; }
}
/** 켜진 정규식(실리태번이 실제로 돌리는 것만 — 프리셋 · 카드 정규식은 허용한 것만) */
function enabledScripts(c) {
    const out = [];
    const push = list => { if (Array.isArray(list)) for (const s of list) if (s && !s.disabled) out.push(s); };
    try { push(c?.extensionSettings?.regex); } catch { /* 없음 */ }
    try {
        const pmgr = c?.getPresetManager?.();
        const name = pmgr?.getSelectedPresetName?.();
        const allowed = c?.extensionSettings?.preset_allowed_regex;
        const ok = !allowed || Object.values(allowed).some(v => Array.isArray(v) && v.includes(name));
        if (ok) push(pmgr?.readPresetExtensionField?.({ path: 'regex_scripts' }));
    } catch { /* 없음 */ }
    try {
        const ch = c?.characters?.[Number(c.characterId)];
        const allowed = c?.extensionSettings?.character_allowed_regex;
        if (ch && (!Array.isArray(allowed) || allowed.includes(ch.avatar))) push(ch.data?.extensions?.regex_scripts);
    } catch { /* 없음 */ }
    return out;
}
/** 글 지문(FNV-1a 32) — 색 한 글자만 고쳐도(글 길이는 같아도) 달라져요 */
function hash(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
/** 다시 모아 지문이 다르면 다시 뽑는다 · 바뀌었으면 true */
export function refreshPresetColors() {
    const c = ctx();
    let preset = '';
    try { preset = String(c?.getPresetManager?.('openai')?.getSelectedPresetName?.() || ''); } catch { /* 없음 */ }
    const prompts = enabledPrompts(), scripts = enabledScripts(c), names = charNames(c);
    const next = [preset, names.join('\u0001'), prompts.map(p => `${p.id}:${hash(p.text)}`).join(','), scripts.map(s => `${s.id || ''}:${hash(String(s.findRegex || '') + '\u0001' + String(s.replaceString || ''))}`).join(',')].join('|');
    if (next === sig) return false;
    sig = next;
    list = parsePresetColors({ prompts: prompts.map(p => p.text), scripts, charNames: names });
    table = colorIndex(list);
    gen++;
    return true;
}
const source = {
    person(names) {
        for (const n of names) { const p = table.get(foldName(n)); if (p) return { names: p.names, color: p.color }; }
        return null;
    },
    names() { lazy(); return list.map(p => p.names[0]); },
    // 이벤트를 안 내는 바꿈(프리셋 정규식 켬끔 등)도 놓치지 않게, 인물표가 물을 때 1.5초에 한 번까지 다시 재요(지문만 · 같으면 그대로)
    stamp: () => { lazy(); return gen; },
};
let lastLook = 0;
function lazy() {
    const now = Date.now();
    if (now - lastLook < 1500) return;
    lastLook = now;
    try { if (refreshPresetColors()) peopleChanged(); } catch { /* 다음에 */ }
}
function onSomething() { if (refreshPresetColors()) peopleChanged(); }

function bind() {
    const c = ctx();
    const es = c?.eventSource, t = c?.eventTypes ?? c?.event_types;
    if (!es || !t) return () => {};
    const evs = [t.OAI_PRESET_CHANGED_AFTER, t.SETTINGS_UPDATED, t.CHAT_CHANGED, t.CHARACTER_EDITED, t.GROUP_UPDATED, t.PRESET_CHANGED].filter(Boolean);
    for (const e of evs) es.on(e, onSomething);
    return () => { for (const e of evs) es.removeListener?.(e, onSomething); };
}
/** 켜고 끄기 — features.js 가 테마가 켜질 때 부른다 */
export async function syncPresetColors(on) {
    if (!on) {
        unbind?.(); unbind = null;
        unregister?.(); unregister = null;
        sig = ''; table = new Map(); list = [];
        return;
    }
    if (unregister) { onSomething(); return; }
    if (!api) try { loading ??= import('../../../../openai.js'); api = await loading; } catch { loading = null; api = null; }
    refreshPresetColors();
    unregister = registerPeopleSource('preset', source, { rank: 100 });
    unbind = bind();
}
/** 시험용 */
export const _forTest = { setApi(next) { api = next; }, reset() { sig = ''; table = new Map(); list = []; gen = 0; lastLook = 0; }, source, get gen() { return gen; }, clearLook() { lastLook = 0; } };
