import { preserveLocks } from './setting-locks.js';
// 캐릭터별 스타일 (3.1.0) — 캐릭터(또는 그룹)에 내 스타일 하나를 이어 두면, 그 채팅을 열 때 그 스타일로 바뀌고
// 이어 두지 않은 채팅으로 가면 원래 모습으로 돌아온다.
//
// 설정: charStyles { 'c:<아바타 파일>' | 'g:<그룹 id>': 스타일 id } · activeStyle { id, key } (지금 입혀 둔 캐릭터 스타일) ·
//       baseStyle (캐릭터 스타일로 바꾸기 직전의 원래 모습 — 이어 두지 않은 채팅으로 갈 때 되돌림)
// 캐릭터 스타일이 입혀진 채팅에서 설정을 바꾸면 그 스타일에 저장된다 (commit). 원래 모습은 건드리지 않는다.
// 이어 둔 캐릭터가 없으면 이 파일은 불러오지도 않는다 (features.js).
import { getSettings, saveSettings, invalidateSettings } from './settings.js';
import { captureStyle, applyStyleData, sameStyle, currentKey } from './styles.js';

let listening = false;
let commitTimer = 0;
let applying = false;
let hooks = { applyAll: null, refreshPanels: null };

/** 캐릭터 스타일이 입혀진 동안 바꾼 모습을 그 스타일에 적는다 (applyAll 마다 부르므로 잠깐 모았다가) */
export function noteChange() {
    if (applying) return;
    clearTimeout(commitTimer);
    commitTimer = setTimeout(commit, 600);
}

function commit() {
    const s = getSettings();
    const active = s.activeStyle;
    if (!active) return false;
    const style = s.styles.find(x => x.id === active.id);
    if (!style) return false;
    const now = captureStyle(s);
    preserveLocks(now,style.data,s.settingLocks)();
    if (sameStyle(now, style.data)) return false;
    style.data = now;
    saveSettings();
    return true;
}

function paint() {
    applying = true;
    try {
        hooks.applyAll?.();
    } finally {
        applying = false;
    }
    hooks.refreshPanels?.();
}

/** 지금 채팅에 맞는 모습으로 (채팅이 바뀔 때 · 이어 두기를 바꿀 때) */
export function syncChat() {
    const s = getSettings();
    const key = currentKey();
    const wantId = key && s.charStyles[key] && s.styles.some(x => x.id === s.charStyles[key]) ? s.charStyles[key] : '';
    const active = s.activeStyle;
    if (active && active.id === wantId && active.key === key) return false;
    clearTimeout(commitTimer);
    if (active) commit();
    if (wantId) {
        if (!active) s.baseStyle = captureStyle(s);
        applyStyleData(s, s.styles.find(x => x.id === wantId).data);
        s.activeStyle = { id: wantId, key };
    } else {
        if (s.baseStyle) applyStyleData(s, s.baseStyle);
        s.baseStyle = null;
        s.activeStyle = null;
    }
    invalidateSettings(); // 5.2.3: 스타일을 제자리에 입힌 뒤 정리(범위 · 형식)를 다시 거치게
    saveSettings();
    paint();
    return true;
}

/** 지운 스타일이 입혀져 있었으면 원래 모습으로 */
export function styleRemoved(id) {
    const s = getSettings();
    for (const [key, value] of Object.entries(s.charStyles)) if (value === id) delete s.charStyles[key];
    if (s.activeStyle?.id === id) {
        if (s.baseStyle) applyStyleData(s, s.baseStyle);
        s.baseStyle = null;
        s.activeStyle = null;
        invalidateSettings();
        saveSettings();
        paint();
    }
}

export function startCharStyles(applyAll, refreshPanels) {
    hooks = { applyAll, refreshPanels };
    if (listening) return;
    listening = true;
    const { eventSource, event_types } = SillyTavern.getContext();
    eventSource.on(event_types.CHAT_CHANGED, () => syncChat());
    // 실리태번이 막 켜져 채팅을 아직 안 열었으면 CHAT_CHANGED 를 기다린다 (지금 맞추면 원래 모습으로 한 번 깜빡임)
    if (SillyTavern.getContext().getCurrentChatId?.()) syncChat();
}

/** 시험용 */
export function charStyleState() {
    const s = getSettings();
    return { key: currentKey(), active: s.activeStyle, base: !!s.baseStyle, links: { ...s.charStyles } };
}
