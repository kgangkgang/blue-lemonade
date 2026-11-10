// 에이드 갈아입기 (1.1.1 시제품, 기본 꺼짐) — 순수 계산 (DOM · 실리태번 없음, tools/tests/ade.mjs 가 검사해요).
// ① 채팅방마다 다른 에이드: 채팅방(캐릭터 · 그룹) 열쇠마다 에이드 가족(lemon · peach …)을 기억하고, 그 채팅을 열면 그 에이드로 바꿔요.
// ② 오늘의 에이드: 날마다 가족을 차례로 돌려요(같은 날은 같은 에이드 · 어제와 같은 것은 건너뜀).
// 가족만 기억하고 밝기(화이트 · 나이트)는 지금 것을 따라요 — 자동 화이트 · 나이트와 부딪히지 않게.
// 상태는 { chats: { 'c:<아바타>' | 'g:<그룹 id>': 가족 }, base: 기억 없는 채팅에 쓸 가족, day: 'YYYY-MM-DD'(오늘의 에이드를 고른 날) }.
//   저장은 extensionSettings.blue_lemonade_ade (테마 설정 표 밖 — 시작 그래프에 기본값 한 줄도 더하지 않아요).
export const MAX_CHATS = 300;
const KEY_RE = /^[cg]:.{1,200}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const okFamily = (value, families) => typeof value === 'string' && (families.includes(value) || value === 'custom');

/** 저장값 다듬기: 모르는 열쇠 · 가족 · 너무 많은 기억은 걷어요(앞에서부터 MAX_CHATS 개) */
export function tidyAdeState(raw, families) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const chats = {};
    let count = 0;
    for (const [key, family] of Object.entries(src.chats && typeof src.chats === 'object' ? src.chats : {})) {
        if (!KEY_RE.test(key) || !okFamily(family, families)) continue;
        chats[key] = family;
        if (++count >= MAX_CHATS) break;
    }
    return { chats, base: okFamily(src.base, families) ? src.base : '', day: typeof src.day === 'string' && DAY_RE.test(src.day) ? src.day : '' };
}

/** 그 기기의 날짜 열쇠 'YYYY-MM-DD' (자정에 바뀌어요) */
export function dayKey(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 오늘의 에이드: 날짜 번호로 가족을 차례로 — skip(어제 것)과 같으면 다음 것 */
export function dailyFamily(families, day, skip = '') {
    const list = families.filter(f => f !== 'custom');
    if (!list.length) return '';
    const m = DAY_RE.test(String(day)) ? String(day).split('-').map(Number) : null;
    const n = m ? Math.floor(Date.UTC(m[0], m[1] - 1, m[2]) / 86400000) : 0;
    let i = ((n % list.length) + list.length) % list.length;
    if (list[i] === skip && list.length > 1) i = (i + 1) % list.length;
    return list[i];
}

/**
 * 지금 채팅에 보여 줄 가족 — key: 채팅 열쇠('' 면 채팅 없음) · flags: { chat, daily }
 *  채팅방 기억이 있으면 그것, 아니면 base(기본 · 오늘의 에이드). 둘 다 꺼져 있으면 '' (건드리지 않음)
 */
export function wantedFamily(state, key, flags) {
    if (flags.chat && key && state.chats[key]) return state.chats[key];
    return flags.chat || flags.daily ? state.base || '' : '';
}

/** 사용자가 에이드를 직접 골랐을 때: 채팅방 기억을 켰고 채팅이 열려 있으면 그 채팅에, 아니면 기본에 적어요 */
export function noteUserPick(state, key, family, flags) {
    if (flags.chat && key) {
        if (Object.keys(state.chats).length >= MAX_CHATS && !state.chats[key]) delete state.chats[Object.keys(state.chats)[0]];
        state.chats[key] = family;
    } else state.base = family;
    return state;
}

/** 기억한 채팅방 목록 — 적힌 차례 그대로 [{ key, family }] (설정 창의 「기억한 채팅방」 목록) */
export function listChatMemory(state) {
    return Object.entries(state?.chats || {}).map(([key, family]) => ({ key, family }));
}

/** 채팅방 기억 하나 지우기 (지웠으면 true) */
export function forgetChat(state, key) {
    if (!key || !state.chats[key]) return false;
    delete state.chats[key];
    return true;
}
