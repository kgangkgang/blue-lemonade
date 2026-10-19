// 캐릭터 에셋 — 지금 캐릭터의 그림 목록과 AI에게 줄 키워드 (패널·매크로·채팅 표시가 함께 쓴다)
//
// 1.2.0: 캐릭터 하나에 폴더(프리셋)가 여럿이다 — 원본(캐릭터 폴더) + 하위 폴더들 + 다른 캐릭터에서 불러온 폴더.
// 폴더마다 따로 읽어 runtime.sources 에 두고, 켜진 폴더를 우선순위대로 합친 것이 runtime.assets (AI 목록 · 채팅 표시용).
import { settings, currentCharacter, folderOf, disabledSet, pruneDisabled, pruneOptimized, speakerFolder } from './state.js';
import { fetchAssets, keywordText, buildIndex, buildGroups } from './assets.js';
import { setIndex, clearIndex, setMemberIndex, clearMemberIndexes } from './render.js';
import { sourcesFor, mergeAssets, presetLabel } from './presets.js';

/**
 * @typedef {{ key: string, owner: string, preset: object, own: boolean, label: string, assets: import('./assets.js').Asset[], error: string, loaded: boolean }} Source
 */

export const runtime = {
    character: null,
    folder: '',
    /** @type {Source[]} 자기 프리셋(순서대로) + 불러온 것 */
    sources: [],
    /** @type {import('./assets.js').Asset[]} 켜진 폴더를 합친 목록 (같은 이름은 위 폴더가 이김) */
    assets: [],
    keywords: '',
    loading: false,
    error: '',
};

export const hooks = {
    /** 목록이 바뀔 때마다 패널이 다시 그린다 */
    onChanged: () => {},
};

let loadToken = 0;
let pendingLoad = null;
let loadedFolder = null;
const changeListeners = new Set();

/** 설정 패널의 onChanged를 바꾸지 않고 목록 준비 상태를 함께 지켜본다. */
export function onStoreChange(listener) {
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
}

function changed() {
    for (const listener of changeListeners) listener();
    hooks.onChanged();
}

/** 마지막으로 읽은 폴더 키 → 그림 목록. 다시 읽기에 실패하면 이전 목록을 그대로 쓴다. */
const lastGood = new Map();

/** 지금 캐릭터의 폴더들을 다시 읽는다. 캐릭터가 없으면 비운다. */
export function reload({ keep = false } = {}) {
    const character = currentCharacter();
    const folder = folderOf(character);
    // 7.2.6 keep: 같은 캐릭터(폴더)의 채팅을 오갈 때(CHAT_CHANGED)는 받아 둔 목록을 그대로 쓴다 (api-audit #13: 채팅마다 /api/sprites/get N번) — 새로고침 · 올리기 · 지우기 · 시작은 전처럼 다시 받는다
    if (keep && folder && folder === loadedFolder && !pendingLoad && !runtime.loading && !runtime.sources.some(source => source.error)) return Promise.resolve();
    const token = ++loadToken;
    const previous = pendingLoad;
    let supersede;
    const superseded = new Promise(resolve => { supersede = resolve; });
    const promise = load(token, character, folder).finally(() => {
        if (pendingLoad?.token === token) pendingLoad = null;
    });
    pendingLoad = { token, promise, superseded, supersede };
    previous?.supersede();
    return promise;
}

/** 생성 직전: 이미 읽는 중이면 합류하고, 같은 캐릭터를 매 답변마다 다시 읽지 않는다. */
export async function ensureLoaded() {
    const folder = folderOf(currentCharacter());
    if (!folder) return false;
    while (folder === folderOf(currentCharacter())) {
        if (runtime.folder !== folder || (!pendingLoad && loadedFolder !== folder)) reload();
        // 오래된 통신이 끝나지 않아도 새로 시작한 목록 읽기로 기다림을 옮긴다.
        if (pendingLoad) await Promise.race([pendingLoad.promise, pendingLoad.superseded]);
        else return !runtime.loading && runtime.folder === folder;
    }
    return false;
}

async function load(token, character, folder) {
    const folderChanged = folder !== runtime.folder;
    runtime.character = character;
    runtime.folder = folder;
    runtime.error = '';

    if (folderChanged) {
        // 다른 캐릭터로 바뀌면 이전 캐릭터의 목록·찾아보기표부터 비운다. 새 채팅의 태그에 예전 폴더가 쓰이면 안 된다.
        runtime.sources = [];
        runtime.assets = [];
        runtime.keywords = '';
        lastGood.clear();
        loadedFolder = null;
        clearIndex();
    }

    if (!folder) {
        runtime.loading = false;
        loadedFolder = folder;
        changed();
        return;
    }

    const plan = sourcesFor(settings(), folder);
    runtime.loading = true;
    changed();

    const results = await Promise.all(plan.map(async (item) => {
        const source = { ...item, label: presetLabel(item.preset), assets: [], error: '', loaded: false };
        try {
            source.assets = await fetchAssets(item.key);
            source.loaded = true;
            if (token === loadToken && folder === folderOf(currentCharacter())) lastGood.set(item.key, source.assets);
        } catch (error) {
            console.error('[캐릭터 에셋] 목록 읽기 실패', item.key, error);
            source.error = error?.message || '목록을 읽지 못했어요.';
            // 읽기 실패: 같은 폴더면 이전 목록을 그대로 두고, 꺼짐 목록은 절대 손대지 않는다.
            source.assets = lastGood.get(item.key) ?? [];
        }
        return source;
    }));
    if (token !== loadToken || folder !== folderOf(currentCharacter())) return; // 그 사이 다른 캐릭터로 바뀜
    runtime.loading = false;
    loadedFolder = folder;
    runtime.sources = results;
    const own = results.find(source => source.own && !source.preset.name);
    runtime.error = own?.error ?? '';
    // 빈 목록은 '폴더가 비었다'와 '서버가 못 읽었다'를 구분할 수 없어 정리하지 않는다 (pruneDisabled도 한 번 더 막는다).
    for (const source of results) {
        if (source.loaded && source.assets.length) {
            const files = source.assets.map(asset => asset.file);
            pruneDisabled(source.key, files);
            pruneOptimized(source.key, files);
        }
    }
    recompute();
}

/** 스위치나 켜기/끄기, 프리셋 켜기/끄기·순서가 바뀌었을 때: 목록은 그대로, 합친 목록·키워드·찾아보기표만 다시 만든다. */
export function recompute() {
    if (runtime.folder) {
        // 프리셋 순서·켜짐은 설정에서 다시 읽는다 (패널이 방금 바꿨을 수 있다)
        const plan = sourcesFor(settings(), runtime.folder);
        const byKey = new Map(runtime.sources.map(source => [source.key, source]));
        runtime.sources = plan.map(item => byKey.get(item.key) ?? { ...item, label: presetLabel(item.preset), assets: lastGood.get(item.key) ?? [], error: '', loaded: false })
            .map(source => ({ ...source, preset: plan.find(item => item.key === source.key).preset, label: presetLabel(plan.find(item => item.key === source.key).preset) }));
    }
    runtime.assets = mergeAssets(runtime.sources);
    const disabled = mergedDisabled();
    const grouped = settings().randomGroups;
    runtime.keywords = keywordText(runtime.assets, disabled, grouped);
    if (runtime.folder) setIndex(buildIndex(runtime.folder, runtime.assets, disabled, runtime.sources.map(source => source.owner)));
    else clearIndex();
    recomputeMembers();
    changed();
}

/** 합친 목록 기준의 꺼짐 파일 이름들 (폴더마다 다른 꺼짐 목록을 한 집합으로) */
function mergedDisabled(assets = runtime.assets) {
    const out = new Set();
    for (const asset of assets) {
        if (disabledSet(asset.folder).has(asset.file)) out.add(asset.file);
    }
    return out;
}

// ── 1.6.9 그룹 채팅: 멤버마다 따로 읽은 목록 ─────────────────────
// 그룹 채팅에는 「지금 캐릭터」가 없어(runtime 은 비어 있다) 메시지마다 주인(original_avatar)의 폴더로 그린다.
// 멤버 목록은 그 멤버의 메시지가 처음 보일 때(render.js) · 그 멤버 차례의 생성 직전(prompt.js) · 그 멤버 답의 고르기(after-reply.js)에 한 번 읽는다.
// 채팅을 바꾸면 비운다. 1:1 채팅은 이 표를 쓰지 않는다.

/** @type {Map<string, { folder: string, loaded: boolean, sources: Source[], assets: import('./assets.js').Asset[], keywords: string, promise: Promise<object|null> }>} */
const members = new Map();

function buildMember(entry) {
    entry.assets = mergeAssets(entry.sources);
    const disabled = mergedDisabled(entry.assets);
    entry.keywords = keywordText(entry.assets, disabled, settings().randomGroups);
    entry.index = buildIndex(entry.folder, entry.assets, disabled, entry.sources.map(source => source.owner));
}

/** 이미 읽은 멤버 목록 (없거나 읽는 중이면 null) */
export function memberEntry(folder) {
    const entry = folder ? members.get(folder) : null;
    return entry?.loaded ? entry : null;
}

/** 멤버 폴더 하나를 읽는다 — 이미 읽었거나 읽는 중이면 그것. 읽은 뒤 render.js 에 그 폴더의 찾아보기표를 준다 */
export function loadMember(folder) {
    if (!folder) return Promise.resolve(null);
    const known = members.get(folder);
    if (known) return known.promise;
    const entry = { folder, loaded: false, sources: [], assets: [], keywords: '', index: null, promise: null };
    entry.promise = (async () => {
        const plan = sourcesFor(settings(), folder);
        const sources = await Promise.all(plan.map(async (item) => {
            const source = { ...item, label: presetLabel(item.preset), assets: [], error: '', loaded: false };
            try { source.assets = await fetchAssets(item.key); source.loaded = true; }
            catch (error) { console.warn('[캐릭터 에셋] 멤버 목록 읽기 실패', item.key, error); source.error = error?.message || '목록을 읽지 못했어요.'; }
            return source;
        }));
        if (members.get(folder) !== entry) return null;   // 그 사이 채팅이 바뀌어 비웠다
        entry.sources = sources;
        buildMember(entry);
        entry.loaded = true;
        setMemberIndex(folder, entry.index);
        return entry;
    })();
    members.set(folder, entry);
    return entry.promise;
}

/** 채팅이 바뀌면 비운다 (다음 그룹 채팅에서 다시 읽는다) */
export function clearMembers() {
    members.clear();
    clearMemberIndexes();
}

/** 꺼짐 · 번호 묶음 스위치가 바뀌었을 때 읽어 둔 멤버 목록의 키워드 · 찾아보기표를 다시 만든다 */
function recomputeMembers() {
    for (const entry of members.values()) {
        if (!entry.loaded) continue;
        buildMember(entry);
        setMemberIndex(entry.folder, entry.index);
    }
}


export function sourceByKey(key) {
    return runtime.sources.find(source => source.key === key) ?? null;
}

/** 패널에 보여 줄 묶음 목록: 폴더 하나(key)의 그림만 */
export function groupsOf(key) {
    const source = sourceByKey(key);
    if (!source) return [];
    return buildGroups(source.assets, disabledSet(key), settings().randomGroups);
}

/**
 * {{img_inprompt}}: 규칙 글 안의 목록·폴더 매크로까지 채운 완성본.
 * 켜진 그림이 하나도 없으면(캐릭터 없음, 그룹 채팅, 빈 폴더, 모두 꺼짐) 규칙도 보내지 않는다.
 */
export function expandedPrompt(entry = runtime) {
    if (!entry?.keywords) return '';
    return String(settings().prompt ?? '')
        .replace(/\{\{\s*(img_keywords_autogen|img_keywords_grouped|img_keywords)\s*\}\}/gi, () => entry.keywords)
        .replace(/\{\{\s*charkey\s*\}\}/gi, () => entry.folder);
}

/**
 * 1.6.9 지금 쓸 목록: 1:1 은 runtime, 그룹은 지금 말하는 멤버(생성 중)의 목록 — 아직 안 읽었거나 생성 밖이면 null.
 * 매크로(img_keywords · charkey)와 프롬프트가 같은 것을 본다.
 */
export function activeEntry(context) {
    if (!context?.groupId) return runtime;
    return memberEntry(speakerFolder(context));
}
