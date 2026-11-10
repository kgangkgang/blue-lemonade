// 에이드 갈아입기 (1.1.1 시제품, 기본 꺼짐) — 켤 때만 받는 모듈(features.js). 계산은 ade-core.js(순수).
// 채팅이 바뀌면(CHAT_CHANGED) 그 채팅방이 기억한 에이드로, 기억이 없으면 기본(오늘의) 에이드로 팔레트를 바꿔요(바꾸고 applyAll 한 번).
// 캐릭터별 스타일(charstyle.js)과 겹칠 때(결정 11-09): 채팅방 에이드가 이겨요 — CHAT_CHANGED 리스너들이 모두 돈 다음 틱에 칠해요(등록 차례와 상관없이 스타일 뒤).
// 사용자가 설정 창에서 에이드를 고르면(applyAll 끝의 syncFeatures 에서 가족이 바뀐 것을 봄) 지금 채팅방에 그 가족을 적어요.
// 비용: 리스너는 CHAT_CHANGED 하나. 상태는 extensionSettings.blue_lemonade_ade 에 (테마 설정 표 밖).
import { getSettings, saveSettings } from './settings.js';
import { PALETTE_MODES, PALETTE_FAMILIES, paletteFamily, paletteVariant, paletteMode } from './palettes.js';
import { currentKey } from './styles.js';
import { tidyAdeState, dayKey, dailyFamily, wantedFamily, noteUserPick, forgetChat } from './ade-core.js';

const KEY = 'blue_lemonade_ade';
let hooks = null, bound = false, on = false, applying = false, last = '', lastKey = null, settleTimer = 0, flags = { chat: false, daily: false };

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
    last = family;   // 되들어오는 syncAde(applyAll → syncFeatures)가 사용자 선택으로 보지 않게 먼저 적어요
    applying = true;
    try { hooks?.applyAll?.(); } finally { applying = false; }
    hooks?.refreshPanels?.();
    saveSettings();
    return true;
}
function settle(s, st) {
    const key = flags.chat ? currentKey() : '';
    // 기억이 없는 방인데 캐릭터별 스타일이 이 채팅에 입혀져 있으면 그 스타일의 팔레트를 그대로 둬요(기본 에이드로 덮지 않음)
    if (key && !st.chats[key] && s.activeStyle?.key === key) { last = paletteFamily(s.palette); return; }
    const want = wantedFamily(st, key, flags);
    if (want && want !== paletteFamily(s.palette)) setFamily(s, want);
}
/** 채팅 바뀜: 같은 사건의 다른 리스너(캐릭터별 스타일 paint)가 모두 끝난 다음 틱에 — 채팅방 에이드가 마지막에 칠해져 이겨요 */
function onChatChanged() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { settleTimer = 0; if (!on) return; const s = getSettings(); lastKey = flags.chat ? currentKey() : ''; last = paletteFamily(s.palette); settle(s, state()); }, 0);
}
function bind() {
    if (bound) return;
    bound = true;
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.CHAT_CHANGED, () => { if (on) onChatChanged(); });   // 약속을 돌려주지 않아요(emit 이 기다리지 않게 — 다음 틱에 칠함)
}

/** features.js 가 설정이 바뀔 때마다(applyAll 끝) 부른다 — q: 설정 quick 묶음 */
export function syncAde(next, q, h) {
    if (h) hooks = h;
    const s = getSettings();
    const now = paletteFamily(s.palette);
    flags = { chat: q?.adeChat === true, daily: q?.adeDaily === true };
    if (!next) {
        // 끄면 기본 에이드로 돌아가요(채팅방 에이드가 입혀진 채 남지 않게) · 리스너는 그대로(on 이 false 면 아무것도 안 해요)
        if (on) { on = false; const st = state(); if (st.base && st.base !== now) setFamily(s, st.base); }
        last = paletteFamily(getSettings().palette);
        return;
    }
    const st = state();
    const key = flags.chat ? currentKey() : '';
    if (!on) { on = true; if (!st.base) st.base = now; last = now; lastKey = key; bind(); persist(); }
    else if (key !== lastKey) { lastKey = key; last = now; }   // 채팅이 바뀌며 변한 팔레트(캐릭터별 스타일 · 되돌림)는 사용자 선택이 아니에요
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

/** 시험용 */
export const _forTest = { state, isOn: () => on, last: () => last, KEY };
