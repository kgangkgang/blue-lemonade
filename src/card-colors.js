// 1.5.9 카드별 색 기억 — 인물표(src/people.js)의 공급자 'card' (차례 50: 이 채팅 대사 색(TTS · 0) 뒤 · 프리셋 색(100) 앞).
//   TTS 색 표에서 사용자가 이름을 정해 둔 색은 설정의 카드별 기억(TTS 설정의 card_colors — 카드 그림마다 「색 → 이름」 · 새 채팅의 씨앗)에 남아요.
//   전에는 인물표가 이 기억을 몰라서(이 채팅 대사에 나온 색만) 화면마다 설정을 따로 읽었어요 — 이제 people.get(이름).color 하나로 받아요:
//   이 채팅 대사 색 → 카드별 색 기억 → 프리셋에 정해 둔 색. 대사가 아직 없어도 · TTS 애드온이 꺼져 있어도 정해 둔 색이 나와요.
//   이름 · 색은 코드에 없어요 — 모두 설정에서 읽어요. 실리태번 설정은 읽기만 해요. (시험: tools/tests/card-colors.mjs)
import { registerPeopleSource, peopleChanged, peopleStamp } from './people.js';

const HEX = /^#[0-9a-f]{6}$/;
const foldName = n => String(n ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

/** 지금 채팅의 카드(그룹이면 구성원 카드 전부)의 색 기억 → [{ name, color }] (TTS 는 사용자 · 카드 인물을 {{user}} · {{char}} 로 기억해요 — 지금 이름으로 바꿔요) */
export function cardColorRows(ctx) {
    const out = [];
    try {
        const all = ctx?.extensionSettings?.lemon_voice?.card_colors;
        if (!all || typeof all !== 'object') return out;
        const avatars = ctx.groupId != null && ctx.groupId !== '' ? ((ctx.groups || []).find(g => g && String(g.id) === String(ctx.groupId))?.members || []) : [ctx.characters?.[ctx.characterId]?.avatar];
        for (const av of avatars) {
            const m = av && all[av];
            if (!m || typeof m !== 'object') continue;
            for (const [col, raw] of Object.entries(m)) {
                // 버그 사냥 2차: 바꿀 글은 함수로 — 이름에 든 `$&` · `$$` · `$'` 가 치환 표시로 풀리지 않게
                const name = String(raw ?? '').replace(/\{\{user\}\}/gi, () => ctx.name1 || '').replace(/\{\{char\}\}/gi, () => ctx.name2 || '').trim();
                const color = String(col || '').trim().toLowerCase();
                if (HEX.test(color) && foldName(name)) out.push({ name, color });
            }
        }
    } catch { /* 표 없음 */ }
    return out;
}
/** 이름(접은 것 · 첫 낱말) → 색. 먼저 적힌 줄이 이겨요.
 *  1.6.2 첫 낱말은 그 첫 낱말을 가진 사람이 표에 한 명일 때만 넣어요 — 「Mina Park」 하나면 「Mina」 로도 찾지만,
 *  첫 낱말이 같은 두 사람(「Mina Park」 · 「Mina Lee」)이 있으면 첫 낱말로는 누구 색인지 정하지 않아요(남의 색을 받지 않게). */
export function cardColorTable(ctx) { return tableOf(cardColorRows(ctx)); }
function tableOf(list) {
    const out = new Map(), owners = new Map();
    for (const { name, color } of list) {
        const n = foldName(name);
        if (!out.has(n)) out.set(n, color);
        const first = n.split(' ')[0];
        if (first && first !== n) (owners.get(first) || owners.set(first, new Set()).get(first)).add(n);
    }
    for (const [first, names] of owners) {
        if (names.size !== 1 || out.has(first)) continue;
        out.set(first, out.get([...names][0]));
    }
    return out;
}
/** 표에서 이름들 가운데 처음 맞는 색 (전체 · 첫 낱말, 대소문자 · 공백 무시) | null */
export function tableColor(table, ...names) {
    for (const n of names) { const k = foldName(n); if (!k) continue; const c = table.get(k) ?? table.get(k.split(' ')[0]); if (c) return c; }
    return null;
}

// ---------- 인물표 공급자
let unregister = null, unbind = null;
let gen = 0, sig = '', rows = [], table = new Map(), seen = -1, lastLook = 0;
const ctxNow = () => { try { return globalThis.SillyTavern?.getContext?.() || null; } catch { return null; } };

/** 다시 읽어 표가 달라졌으면 true (같으면 그대로 — 판 번호도 안 올려요) */
export function refreshCardColors() {
    const next = cardColorRows(ctxNow());
    const s = next.map(r => `${r.color}\u0001${r.name}`).join('\u0002');
    if (s === sig) return false;
    sig = s; rows = next; table = tableOf(rows);
    gen++;
    return true;
}
// 설정 표는 제자리에서 바뀌어요(TTS 색 표에서 이름을 정할 때) — 그때 TTS 가 인물표 판을 올리니 판이 바뀌었을 때, 그리고 이벤트 없는 바꿈(다른 기기 합치기)을 위해
//   1.5초에 한 번까지만 다시 읽어요. 평소에는 판 번호 비교 한 번이에요.
function look() {
    const now = Date.now(), st = peopleStamp();
    if (st === seen && now - lastLook < 1500) return;
    lastLook = now;
    let changed = false;
    try { changed = refreshCardColors(); } catch { /* 다음에 */ }
    if (changed) peopleChanged();
    seen = peopleStamp();
}
const source = {
    person(names) {
        const color = tableColor(table, ...names);
        return color ? { color } : null;
    },
    names() { look(); return rows.map(r => r.name); },
    stamp: () => { look(); return gen; },
};
function onSomething() { lastLook = 0; seen = -1; look(); }
function bind() {
    const c = ctxNow();
    const es = c?.eventSource, t = c?.eventTypes ?? c?.event_types;
    if (!es || !t) return () => {};
    const evs = [t.CHAT_CHANGED, t.SETTINGS_UPDATED, t.GROUP_UPDATED, t.CHARACTER_EDITED, t.CHARACTER_RENAMED].filter(Boolean);
    for (const e of evs) es.on(e, onSomething);
    return () => { for (const e of evs) es.removeListener?.(e, onSomething); };
}
/** 켜고 끄기 — features.js 가 테마가 켜질 때 부른다 */
export function syncCardColors(on) {
    if (!on) {
        unbind?.(); unbind = null;
        unregister?.(); unregister = null;
        sig = ''; rows = []; table = new Map();
        return;
    }
    if (unregister) { onSomething(); return; }
    try { refreshCardColors(); } catch { /* 설정이 아직 없으면 물을 때 */ }
    unregister = registerPeopleSource('card', source, { rank: 50 });
    unbind = bind();
}
/** 시험용 */
export const _forTest = { source, reset() { sig = ''; rows = []; table = new Map(); gen = 0; seen = -1; lastLook = 0; }, get gen() { return gen; }, clearLook() { lastLook = 0; } };
