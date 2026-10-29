// 다른 성능 확장 있음 감지 (8.2.2 뒤 · 성능): 칵테일(cocktail) · 바이바이(ST-BaiBai-Tools)가 설치돼 있고 꺼져 있지 않으면 같은 일을 하는 우리 기능이 쉰다.
// 왜: 두 확장은 같은 요소에 content-visibility · IntersectionObserver 를 걸거나(바이바이) hljs 를 직접 바꾼다(칵테일). 겹치면 서로 되돌리거나 두 번 일한다.
// 어떻게: 실리태번 extensions.js 의 extensionNames('third-party/<폴더>') 와 extension_settings.disabledExtensions 를 읽는다 (addons.js conflict() 와 같은 길).
//   폴더 이름이 다를 수 있으니(ZIP 그대로 풀면 'cocktail-main' 처럼 판 번호 · 가지 이름이 붙는다 — extension-folder.js folderBase) manifest display_name 에
//   「鸡尾酒」·「柏宝箱」·「BaiBai」가 들어가는 것도 같은 확장으로 본다. 판정은 순수 함수 detectPresence(시험 가능), 결과는 한 번 재어 두고
//   EXTENSION_SETTINGS_LOADED 와 확장 관리 창의 켜고 끄기(.extension_toggle 의 change — 「나중에 새로고침」을 고르면 페이지가 안 바뀐다) 때 다시 잰다.
//   바뀌면 등록된 콜백(features.js → applyAll · refreshPanels)을 부른다 — 토글 값은 그대로 두고 쉬기만 하므로 그 확장을 지우면 바로 다시 켜진다.
// 겹침 규칙(restingFor): 바이바이 켜짐 → 아바타 지연 로딩 · 월드인포 경량화 · 검색 IME 디바운스(캐릭터 검색 칸만 — 다른 칸은 그대로) 쉼. 칵테일 켜짐 → 코드 하이라이트 끄기 쉼.
import { folderBase } from './extension-folder.js';

export const OTHERS = {
    cocktail: { label: '칵테일', folders: ['cocktail'], names: [/鸡尾酒/] },
    baibai: { label: '바이바이', folders: ['ST-BaiBai-Tools'], names: [/柏宝箱/, /baibai/i] },
};
/** 우리 기능 → 그 기능과 겹치는 확장 (켜져 있으면 쉰다) */
export const OVERLAP = { lazyAvatars: ['baibai'], worldInfoLight: ['baibai'], searchIme: ['baibai'], codePlain: ['cocktail'] };

/**
 * 순수 판정: 설치돼 있고 꺼져 있지 않은 확장. names = extensionNames · disabled = disabledExtensions · manifestOf(폴더) → manifest 또는 null
 * @returns {{cocktail: boolean, baibai: boolean}}
 */
export function detectPresence(names, disabled, manifestOf = () => null) {
    const found = { cocktail: false, baibai: false };
    if (!Array.isArray(names)) return found;
    const off = new Set(Array.isArray(disabled) ? disabled : []);
    for (const name of names) {
        if (typeof name !== 'string' || !name.startsWith('third-party/') || off.has(name)) continue;
        const folder = name.slice(12), base = folderBase(folder).toLowerCase();
        let display = '';
        try { display = String(manifestOf(folder)?.display_name ?? ''); } catch { /* manifest 없음 */ }
        for (const [id, o] of Object.entries(OTHERS)) {
            if (o.folders.some(f => f.toLowerCase() === base) || o.names.some(re => re.test(display))) found[id] = true;
        }
    }
    return found;
}
/** 기능이 쉬어야 하면 그 확장의 이름('바이바이' · '칵테일'), 아니면 '' */
export function restingFor(feature, found = cached) {
    for (const id of OVERLAP[feature] ?? []) if (found?.[id]) return OTHERS[id].label;
    return '';
}

let cached = { cocktail: false, baibai: false }, host = null, started = false, pending = 0;
const listeners = new Set();
/** 마지막으로 잰 결과 (동기) */
export const presence = () => cached;
export function onPresenceChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function refreshPresence(hostOverride) {
    if (hostOverride) host = hostOverride;
    if (!host) { try { host = await import('../../../../extensions.js'); } catch { return cached; } }
    const next = detectPresence(host.extensionNames, host.extension_settings?.disabledExtensions, f => host.getExtensionManifest?.(f));
    if (next.cocktail === cached.cocktail && next.baibai === cached.baibai) return cached;
    cached = next;
    for (const fn of listeners) { try { fn(cached); } catch (e) { console.warn('[Blue Lemonade] 다른 확장 감지 콜백', e); } }
    return cached;
}
const later = () => { clearTimeout(pending); pending = setTimeout(() => refreshPresence(), 50); };

/** 한 번만: 처음 재고, 확장 설정이 읽힐 때 · 확장 관리 창에서 켜고 끌 때 다시 잰다 */
export function startPresence() {
    if (started) return;
    started = true;
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        if (event_types?.EXTENSION_SETTINGS_LOADED) eventSource.on(event_types.EXTENSION_SETTINGS_LOADED, later);
    } catch { /* 이벤트 없음 — 처음 잰 값만 */ }
    document.addEventListener('change', e => { if (e.target?.closest?.('.extension_toggle')) later(); }, true);
    refreshPresence();
}

/** 시험용 */
export const _forTest = { reset() { cached = { cocktail: false, baibai: false }; host = null; started = false; listeners.clear(); } };
