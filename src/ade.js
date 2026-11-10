// 에이드 갈아입기 (1.1.1 시제품, 기본 꺼짐) — 켤 때만 받는 모듈(features.js). 계산은 ade-core.js(순수).
// 채팅이 바뀌면(CHAT_CHANGED) 그 채팅방이 기억한 에이드로, 기억이 없으면 기본(오늘의) 에이드로 팔레트를 바꿔요(바꾸고 applyAll 한 번).
// 캐릭터별 스타일(charstyle.js)과 겹칠 때(결정 11-09): 채팅방 에이드가 이겨요 — CHAT_CHANGED 리스너들이 모두 돈 다음 틱에 칠해요(등록 차례와 상관없이 스타일 뒤).
// 사용자가 설정 창에서 에이드를 고르면(applyAll 끝의 syncFeatures 에서 가족이 바뀐 것을 봄) 지금 채팅방에 그 가족을 적어요.
//   (추측이라 걸러 낼 것이 있어요: 채팅 바뀜 · 에이드가 칠함 · 밖에서 들어온 설정. 설정 창의 팔레트 누름에서 직접 알리는 꼴은 1.1.3 후보)
// 비용: 리스너는 CHAT_CHANGED 하나. 상태는 extensionSettings.blue_lemonade_ade 에 (테마 설정 표 밖).
import { getSettings, saveSettings } from './settings.js';
import { PALETTE_MODES, PALETTE_FAMILIES, paletteFamily, paletteVariant, paletteMode } from './palettes.js';
import { currentKey, keyLabel } from './styles.js';
import { tidyAdeState, dayKey, dailyFamily, wantedFamily, noteUserPick, forgetChat, listChatMemory } from './ade-core.js';

const KEY = 'blue_lemonade_ade';
// 에이드가 칠해 둔 가족(없으면 '') — 캐릭터별 스타일(charstyle.js commit)이 그 팔레트를 「내 스타일」에 적지 않게 읽어요(서로 import 하지 않게 전역 칸 하나)
const PAINT = Symbol.for('blue-lemonade.ade-paint');
let hooks = null, bound = false, on = false, applying = false, last = '', lastKey = null, settleTimer = 0, flags = { chat: false, daily: false };
// 1.1.2 설정이 밖에서 바뀌어 들어온 직후(다른 기기 · 탭 합치기 bl:settings-merged · 통째 바꿈 bl:settings-replaced)의 팔레트 바뀜 한 번은 사용자 선택이 아니에요
let foreign = false;

const ctx = () => SillyTavern.getContext();
/** 에이드 가족 목록(커스텀 빼고) — 팔레트 데이터를 받기 전에도 id 표(PALETTE_MODES)로 알 수 있어요 */
export const families = () => [...new Set(Object.keys(PALETTE_MODES).map(paletteFamily))].filter(f => f !== 'custom');
function state() {
    const all = ctx().extensionSettings;
    all[KEY] = tidyAdeState(all[KEY], families());
    return all[KEY];
}
const persist = () => ctx().saveSettingsDebounced?.();

/** 팔레트를 그 가족으로(밝기는 지금 것) — 바꿨으면 true */
function setFamily(s, family) {
    const id = paletteVariant(family, paletteMode(s.palette));
    if (!id || id === s.palette) { last = family; return false; }
    s.palette = id;
    globalThis[PAINT] = family;
    last = family;   // 되들어오는 syncAde(applyAll → syncFeatures)가 사용자 선택으로 보지 않게 먼저 적어요
    applying = true;
    try { hooks?.applyAll?.(); } finally { applying = false; }
    hooks?.refreshPanels?.();
    saveSettings();
    return true;
}
function settle(s, st) {
    const here = currentKey(), key = flags.chat ? here : '';
    // 기억이 없는 방인데 캐릭터별 스타일이 이 채팅에 입혀져 있으면 그 스타일의 팔레트를 그대로 둬요(기본 에이드로 덮지 않음 — 「오늘의 에이드」만 켠 때도)
    if (here && !st.chats[key] && s.activeStyle?.key === here) { last = paletteFamily(s.palette); globalThis[PAINT] = ''; return; }
    const want = wantedFamily(st, key, flags);
    if (want && want !== paletteFamily(s.palette)) setFamily(s, want);
}
/** 채팅 바뀜: 같은 사건의 다른 리스너(캐릭터별 스타일 paint)가 모두 끝난 다음 틱에 — 채팅방 에이드가 마지막에 칠해져 이겨요 */
function onChatChanged() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { settleTimer = 0; if (!on) return; const s = getSettings(); lastKey = currentKey(); last = paletteFamily(s.palette); settle(s, state()); }, 0);
}
function bind() {
    if (bound) return;
    bound = true;
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.CHAT_CHANGED, () => { if (on) onChatChanged(); else globalThis[PAINT] = ''; });   // 약속을 돌려주지 않아요(emit 이 기다리지 않게 — 다음 틱에 칠함)
    // 알림 바로 뒤의 applyAll → syncAde(마이크로태스크)에서만 봐요 — 적용이 없었으면 다음 틱에 풀어 그 뒤의 고르기를 삼키지 않아요
    const note = () => { if (!on) return; foreign = true; setTimeout(() => { foreign = false; }, 0); };
    for (const name of ['bl:settings-merged', 'bl:settings-replaced']) globalThis.window?.addEventListener?.(name, note);
}

/** features.js 가 설정이 바뀔 때마다(applyAll 끝) 부른다 — q: 설정 quick 묶음 */
export function syncAde(next, q, h) {
    if (h) hooks = h;
    const s = getSettings();
    const now = paletteFamily(s.palette);
    flags = { chat: q?.adeChat === true, daily: q?.adeDaily === true };
    if (globalThis[PAINT] && globalThis[PAINT] !== now) globalThis[PAINT] = '';   // 다른 가족으로 바뀌었으면 더는 에이드가 칠한 것이 아니에요
    const outside = foreign; foreign = false;
    if (!next) {
        // 끄면 기본 에이드로 돌아가요(채팅방 에이드가 입혀진 채 남지 않게) · 리스너는 그대로(on 이 false 면 아무것도 안 해요)
        if (on) { on = false; const st = state(); if (st.base && st.base !== now) setFamily(s, st.base); }
        last = paletteFamily(getSettings().palette);
        return;
    }
    const st = state();
    // 「채팅이 바뀌었나」는 늘 진짜 채팅 열쇠로 봐요(1.1.2) — 「오늘의 에이드」만 켜면 적는 열쇠(key)가 늘 '' 라 채팅이 바뀌며 변한 팔레트를 못 걸렀어요
    const here = currentKey(), key = flags.chat ? here : '';
    if (!on) { on = true; if (!st.base) st.base = now; last = now; lastKey = here; bind(); persist(); }
    else if (outside || here !== lastKey) { lastKey = here; last = now; }   // 채팅이 바뀌며 변한 팔레트(캐릭터별 스타일 · 되돌림) · 밖에서 들어온 팔레트는 사용자 선택이 아니에요
    else if (!applying && now !== last) { noteUserPick(st, key, now, flags); last = now; persist(); }
    if (flags.daily) {
        const today = dayKey();
        if (st.day !== today) { st.day = today; st.base = dailyFamily(families(), today, st.base); persist(); }
    }
    settle(s, st);
}

/** 설정 창: 기본 에이드(기억 없는 방 · 오늘의 에이드가 날마다 바꿈) 읽기 · 고르기 */
export const adeBase = () => state().base;
export function adeSetBase(family) {
    if (!families().includes(family)) return false;
    const st = state();
    st.base = family; persist();
    if (on) settle(getSettings(), st);
    return true;
}
/** 설정 창: 지금 채팅방이 기억한 가족 이름(없으면 '') · 기억 지우기 */
export function adeChatLabel() {
    const key = currentKey(), family = key ? state().chats[key] : '';
    return family ? PALETTE_FAMILIES[family]?.label || family : '';
}
export function adeForgetChat() {
    const st = state();
    if (!forgetChat(st, currentKey())) return false;
    persist();
    if (on) settle(getSettings(), st);
    return true;
}
/** 설정 창: 기억한 채팅방 목록 [{ key, name, label, here }] — 이름은 지금 캐릭터 · 그룹 목록에서 찾고, 지워진 방은 열쇠 이름 그대로 */
export function adeChatList() {
    const now = currentKey();
    return listChatMemory(state()).map(({ key, family }) => ({ key, name: keyLabel(key), label: PALETTE_FAMILIES[family]?.label || family, here: key === now }));
}
/** 설정 창: 목록에서 고른 채팅방의 기억 지우기 (지금 채팅방이면 기본 에이드로 돌아가요) */
export function adeForgetKey(key) {
    const st = state();
    if (!forgetChat(st, String(key || ''))) return false;
    persist();
    if (on && key === currentKey()) settle(getSettings(), st);
    return true;
}

/** 시험용 */
export const _forTest = { state, isOn: () => on, last: () => last, KEY };
