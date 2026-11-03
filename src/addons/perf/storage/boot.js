// 성능 보조 · 저장 공간 시작 (start.js 가 성능 보조를 켤 때 한 번) — 가벼운 것만: 오류 고리 · 저장 공간 다리 · 창구 · 런처 다리 항목.
//   창 코드(view.js · status.js · style.css)는 열 때 불러와요.
// 창구  globalThis[Symbol.for('blue-lemonade.storage-view')] = { version, open(), status() } — 따로 깐 런처 확장이 자기 「저장 공간」 단추를 이것으로 열어요(없으면 그 단추를 숨겨요).
// 런처 다리  globalThis[Symbol.for('blue-lemonade.dock')] 가 있으면 「저장 공간」 항목을 올리고, 아직 없으면 pending 줄에 둬요 — 런처가 없으면 그 줄은 아무 일도 하지 않아요.
import { installStorageBridge } from './core.js';
import { installErrorRing } from './errors.js';

export const STORAGE_VIEW = Symbol.for('blue-lemonade.storage-view');
export const DOCK_ENTRY_ID = 'blue-lemonade-storage';
const DOCK = Symbol.for('blue-lemonade.dock'), DOCK_PENDING = Symbol.for('blue-lemonade.dock.pending');
const STORAGE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 12v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6"/></svg>';

export const openStorage = () => import('./view.js').then(m => m.openStorage());
export const openStatus = () => import('./status.js').then(m => m.openStatus());

/** 시작할 때 한 번 — 두 번 불러도 한 벌 */
export function installStorage(g = globalThis) {
    try { installErrorRing(g); } catch (e) { console.warn('[Blue Lemonade] 오류 고리', e); }
    try { installStorageBridge(g); } catch (e) { console.warn('[Blue Lemonade] 저장 공간 다리', e); }
    if (!g[STORAGE_VIEW]) {
        try { g[STORAGE_VIEW] = Object.freeze({ version: 1, open: () => openStorage(), status: () => openStatus() }); } catch { /* 전역 없음 */ }
        const entry = { id: DOCK_ENTRY_ID, label: '저장 공간', icon: STORAGE_SVG, order: 990, open: () => openStorage() };
        try {
            const dock = g[DOCK];
            if (typeof dock?.register === 'function') dock.register(entry);
            else (g[DOCK_PENDING] ??= []).push(entry);
        } catch (e) { console.warn('[Blue Lemonade] 런처 항목', e); }
    }
    return g[STORAGE_VIEW];
}
