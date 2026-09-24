// 캐릭터 에셋 — 지금 캐릭터의 그림 목록과 AI에게 줄 키워드 (패널·매크로·채팅 표시가 함께 쓴다)
//
// 1.2.0: 캐릭터 하나에 폴더(프리셋)가 여럿이다 — 원본(캐릭터 폴더) + 하위 폴더들 + 다른 캐릭터에서 불러온 폴더.
// 폴더마다 따로 읽어 runtime.sources 에 두고, 켜진 폴더를 우선순위대로 합친 것이 runtime.assets (AI 목록 · 채팅 표시용).
import { settings, currentCharacter, folderOf, disabledSet, pruneDisabled } from './state.js';
import { fetchAssets, keywordText, buildIndex, buildGroups } from './assets.js';
import { setIndex, clearIndex } from './render.js';
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
/** 마지막으로 읽은 폴더 키 → 그림 목록. 다시 읽기에 실패하면 이전 목록을 그대로 쓴다. */
const lastGood = new Map();

/** 지금 캐릭터의 폴더들을 다시 읽는다. 캐릭터가 없으면 비운다. */
export async function reload() {
    const token = ++loadToken;
    const character = currentCharacter();
    const folder = folderOf(character);
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
        clearIndex();
    }

    if (!folder) {
        runtime.loading = false;
        hooks.onChanged();
        return;
    }

    const plan = sourcesFor(settings(), folder);
    runtime.loading = true;
    hooks.onChanged();

    const results = await Promise.all(plan.map(async (item) => {
        const source = { ...item, label: presetLabel(item.preset), assets: [], error: '', loaded: false };
        try {
            source.assets = await fetchAssets(item.key);
            source.loaded = true;
            lastGood.set(item.key, source.assets);
        } catch (error) {
            console.error('[캐릭터 에셋] 목록 읽기 실패', item.key, error);
            source.error = error?.message || '목록을 읽지 못했어요.';
            // 읽기 실패: 같은 폴더면 이전 목록을 그대로 두고, 꺼짐 목록은 절대 손대지 않는다.
            source.assets = lastGood.get(item.key) ?? [];
        }
        return source;
    }));
    if (token !== loadToken) return; // 그 사이 다른 캐릭터로 바뀜
    runtime.loading = false;
    runtime.sources = results;
    const own = results.find(source => source.own && !source.preset.name);
    runtime.error = own?.error ?? '';
    // 빈 목록은 '폴더가 비었다'와 '서버가 못 읽었다'를 구분할 수 없어 정리하지 않는다 (pruneDisabled도 한 번 더 막는다).
    for (const source of results) {
        if (source.loaded && source.assets.length) pruneDisabled(source.key, source.assets.map(asset => asset.file));
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
    hooks.onChanged();
}

/** 합친 목록 기준의 꺼짐 파일 이름들 (폴더마다 다른 꺼짐 목록을 한 집합으로) */
function mergedDisabled() {
    const out = new Set();
    for (const asset of runtime.assets) {
        if (disabledSet(asset.folder).has(asset.file)) out.add(asset.file);
    }
    return out;
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

/** (예전 이름) 원본 폴더의 묶음 목록 */
export function currentGroups() {
    return groupsOf(runtime.folder);
}

/**
 * {{img_inprompt}}: 규칙 글 안의 목록·폴더 매크로까지 채운 완성본.
 * 켜진 그림이 하나도 없으면(캐릭터 없음, 그룹 채팅, 빈 폴더, 모두 꺼짐) 규칙도 보내지 않는다.
 */
export function expandedPrompt() {
    if (!runtime.keywords) return '';
    return String(settings().prompt ?? '')
        .replace(/\{\{\s*(img_keywords_autogen|img_keywords_grouped|img_keywords)\s*\}\}/gi, () => runtime.keywords)
        .replace(/\{\{\s*charkey\s*\}\}/gi, () => runtime.folder);
}
