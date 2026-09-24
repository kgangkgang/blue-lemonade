// 캐릭터 에셋 — 프리셋 (그림 묶음 폴더). 실리태번 밖 코드 없이 순수 계산만 (node 로 테스트).
//
// 프리셋 = 캐릭터 폴더 안의 하위 폴더 하나. 실리태번의 /api/sprites 가 `캐릭터/하위폴더` 이름을 그대로 받으므로
// 파일은 characters/<캐릭터>/<프리셋>/ 에 놓인다. '원본' 프리셋은 캐릭터 폴더 자체(하위 폴더 없음).
// 같은 파일 이름이 여러 프리셋에 있어도 되고, 켜진 프리셋 중 위에 있는 것이 이긴다 — 그래서 '원본'과 '새 그림'을
// 같은 태그로 번갈아 볼 수 있다. 다른 카드에서 불러온(links) 프리셋은 자기 목록 뒤에 붙는다.
//
// 설정 모양: store.presets = { [캐릭터 폴더]: [ { id, name, enabled } … ] }  (배열 순서 = 우선순위)
//   name '' = 원본 (캐릭터 폴더 자체). 폴더 키 = folderKey(캐릭터, name) = 'char' 또는 'char/name'.
//   store.links = { [캐릭터 폴더]: [ { owner, presetId, enabled } … ] }  다른 캐릭터의 프리셋을 이 카드에서 쓰기.

export const BASE_ID = 'base';
export const BASE_LABEL = '원본';

/** 파일 이름·폴더 이름으로 못 쓰는 글자를 뺀다 (서버의 sanitize-filename 과 비슷하게). */
export function cleanPresetName(text) {
    return String(text ?? '')
        .replace(/[/\\:*?"<>|\x00-\x1f]/g, '')
        .replace(/^\.+/, '')
        .replace(/\s+/g, ' ')
        .slice(0, 40)
        // 1.3.2: 끝의 점·빈칸도 뺀다. 서버는 폴더를 'art.' → 'art' 로 만들지만 그림 주소는 'art./이름.png' 라서
        //        그 프리셋의 그림이 격자에서도 채팅에서도 전부 404 였다. 자르기 뒤에 해야 잘린 끝의 점도 빠진다.
        .replace(/[. ]+$/, '')
        .trim();
}

/** /api/sprites 에 주는 이름이자 꺼짐 목록의 키: 'char' 또는 'char/preset' */
export function folderKey(character, name) {
    return name ? `${character}/${name}` : character;
}

/** 폴더 키에서 캐릭터 폴더만 ('char/preset' → 'char') */
export function characterOf(key) {
    const slash = String(key).indexOf('/');
    return slash < 0 ? String(key) : String(key).slice(0, slash);
}

function basePreset() {
    return { id: BASE_ID, name: '', enabled: true };
}

function newId() {
    return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 캐릭터의 프리셋 목록 (없으면 원본 하나를 만들어 둔다). 항상 같은 배열을 돌려주므로 고치면 설정에 바로 반영된다. */
export function presetsOf(store, character) {
    if (!character) return [basePreset()];
    if (!store.presets || typeof store.presets !== 'object' || Array.isArray(store.presets)) store.presets = {};
    let list = store.presets[character];
    if (!Array.isArray(list)) list = store.presets[character] = [];
    // 망가진 항목 정리 + 원본 보장
    for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        if (!item || typeof item !== 'object' || typeof item.name !== 'string') list.splice(i, 1);
    }
    if (!list.some(item => item.id === BASE_ID)) list.unshift(basePreset());
    for (const item of list) {
        if (item.id === BASE_ID) item.name = '';
        item.enabled = item.enabled !== false;
        delete item.shared; // 1.2.0 개발 중에 잠깐 있던 값
    }
    // 원본만 남았으면 무조건 켠다 — 원본을 끄고 프리셋을 지우면 조작 줄이 숨어 다시 켤 길이 없었다 (1.2.1)
    if (list.length === 1) list[0].enabled = true;
    return list;
}

export function findPreset(store, character, id) {
    return presetsOf(store, character).find(item => item.id === id) ?? null;
}

export function presetLabel(preset) {
    return preset.id === BASE_ID ? BASE_LABEL : preset.name;
}

/**
 * 새 프리셋. 이름이 비었거나 이미 있으면 Error.
 * @returns {{ id: string, name: string, enabled: boolean }}
 */
export function addPreset(store, character, rawName) {
    const name = cleanPresetName(rawName);
    if (!name) throw new Error('프리셋 이름을 넣어 주세요.');
    if (name === BASE_LABEL) throw new Error(`'${BASE_LABEL}'은 캐릭터 폴더 자체라 따로 만들 수 없어요.`);
    const list = presetsOf(store, character);
    if (list.some(item => item.name.toLowerCase() === name.toLowerCase())) throw new Error(`'${name}' 프리셋이 이미 있어요.`);
    const preset = { id: newId(), name, enabled: true };
    list.push(preset);
    return preset;
}

/**
 * 1.4.0: 이름 바꾸기 전에 새 이름을 검사한다 (파일 옮기기는 부르는 쪽). 못 바꾸면 Error.
 * 대소문자만 다른 이름은 막는다 — 윈도우 · 안드로이드 저장소에서는 같은 폴더라서, 새 폴더에 올린 뒤 옛 폴더를 지우면 그림이 전부 사라진다.
 * @returns {string} 다듬은 새 이름
 */
export function checkRename(store, character, id, rawName) {
    if (id === BASE_ID) throw new Error(`'${BASE_LABEL}'은 캐릭터 폴더 자체라 이름을 바꿀 수 없어요.`);
    const list = presetsOf(store, character);
    const preset = list.find(item => item.id === id);
    if (!preset) throw new Error('프리셋을 찾지 못했어요.');
    const name = cleanPresetName(rawName);
    if (!name) throw new Error('프리셋 이름을 넣어 주세요.');
    if (name === preset.name) throw new Error('같은 이름이에요.');
    if (name === BASE_LABEL) throw new Error(`'${BASE_LABEL}'은 쓸 수 없는 이름이에요.`);
    if (name.toLowerCase() === preset.name.toLowerCase()) throw new Error('대소문자만 바꿀 수는 없어요. 다른 이름으로 바꿔 주세요.');
    if (list.some(item => item !== preset && item.name.toLowerCase() === name.toLowerCase())) throw new Error(`'${name}' 프리셋이 이미 있어요.`);
    return name;
}

/** 목록에서 뺀다 (파일은 부르는 쪽이 지운다). 원본은 뺄 수 없다. */
export function removePreset(store, character, id) {
    if (id === BASE_ID) return false;
    const list = presetsOf(store, character);
    const at = list.findIndex(item => item.id === id);
    if (at < 0) return false;
    list.splice(at, 1);
    return true;
}

/** 위(-1)/아래(+1)로 한 칸. 움직였으면 true */
export function movePreset(store, character, id, direction) {
    const list = presetsOf(store, character);
    const at = list.findIndex(item => item.id === id);
    const to = at + Math.sign(direction);
    if (at < 0 || to < 0 || to >= list.length) return false;
    [list[at], list[to]] = [list[to], list[at]];
    return true;
}

// ── 불러오기 (다른 캐릭터의 프리셋을 이 카드에서도 쓰기) ────────────
// 저장은 그 캐릭터 폴더 한 군데, 읽기는 여러 카드에서 — 같은 캐릭터의 다른 버전 카드가 그림을 그대로 쓴다.
// store.links = { [캐릭터 폴더]: [ { owner, presetId, enabled } … ] }

/** 설정을 건드리지 않고 찾는다. 원본(base)은 목록에 없어도 있는 것으로 친다. */
export function peekPreset(store, owner, id) {
    const list = Array.isArray(store.presets?.[owner]) ? store.presets[owner] : [];
    const found = list.find(item => item && item.id === id) ?? null;
    if (found) return found;
    return id === BASE_ID ? basePreset() : null;
}

export function linksOf(store, character) {
    if (!character) return [];
    if (!store.links || typeof store.links !== 'object' || Array.isArray(store.links)) store.links = {};
    let list = store.links[character];
    if (!Array.isArray(list)) list = store.links[character] = [];
    for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        if (!item || typeof item.owner !== 'string' || typeof item.presetId !== 'string' || item.owner === character) list.splice(i, 1);
        else item.enabled = item.enabled !== false;
    }
    return list;
}

/** 이미 있으면 false */
export function addLink(store, character, owner, presetId) {
    if (!character || !owner || owner === character || !presetId) return false;
    const list = linksOf(store, character);
    if (list.some(item => item.owner === owner && item.presetId === presetId)) return false;
    list.push({ owner, presetId, enabled: true });
    return true;
}

export function removeLink(store, character, owner, presetId) {
    const list = linksOf(store, character);
    const at = list.findIndex(item => item.owner === owner && item.presetId === presetId);
    if (at < 0) return false;
    list.splice(at, 1);
    return true;
}

/** 주인 목록에서의 자리 (없는 주인이면 원본만 0번) — 설정을 만들지 않는다 */
function ownerOrder(store, owner, id) {
    const list = Array.isArray(store.presets?.[owner]) ? store.presets[owner] : [];
    const at = list.findIndex(item => item && item.id === id);
    return at < 0 ? (id === BASE_ID ? list.length : Number.MAX_SAFE_INTEGER) : at;
}

/**
 * 지금 캐릭터가 읽을 폴더들: 자기 프리셋(순서대로) + 불러온 프리셋. 같은 이름은 앞이 이기므로 자기 것이 먼저.
 * 불러온 폴더는 주인마다(처음 불러온 주인부터) 묶고, 그 안에서는 주인 쪽 순서를 따른다 — 그래서 원래 카드와 같은 그림이 이긴다.
 * 불러온 폴더의 켜짐은 이 카드의 링크 값을 쓴다 (주인 쪽 켜짐과 따로).
 * @returns {{ key: string, owner: string, preset: object, own: boolean }[]}
 */
export function sourcesFor(store, character) {
    const out = [];
    if (!character) return out;
    for (const preset of presetsOf(store, character)) out.push({ key: folderKey(character, preset.name), owner: character, preset, own: true });
    const links = linksOf(store, character);
    const owners = [...new Set(links.map(link => link.owner))];
    const sorted = links.map((link, at) => ({ link, at }))
        .sort((a, b) => owners.indexOf(a.link.owner) - owners.indexOf(b.link.owner)
            || ownerOrder(store, a.link.owner, a.link.presetId) - ownerOrder(store, b.link.owner, b.link.presetId)
            || a.at - b.at);
    for (const { link } of sorted) {
        const preset = peekPreset(store, link.owner, link.presetId);
        if (!preset) continue; // 주인이 프리셋을 지웠으면 그냥 건너뛴다 (링크는 남겨 두어 다시 만들면 살아난다)
        out.push({ key: folderKey(link.owner, preset.name), owner: link.owner, preset: { ...preset, enabled: link.enabled }, own: false });
    }
    return out;
}

/**
 * 켜진 폴더들의 그림을 한 목록으로. 같은 이름은 앞(위) 폴더 것이 이긴다.
 * 1.3.1: 확장자를 뗀 이름으로 비교한다. 한 폴더만 WebP 로 줄이면 위 폴더의 이름.png 와 아래 폴더의 이름.webp 가
 *        둘 다 남아서 AI 목록에 겹치고, 아래 폴더 그림이 뜰 수 있었다. 한 폴더 안의 파일은 그대로 다 둔다.
 * @param {{ preset: object, assets: object[] }[]} loaded sourcesFor 순서대로, 각각 읽은 그림 목록
 */
export function mergeAssets(loaded) {
    const seen = new Set();
    const out = [];
    for (const source of loaded) {
        if (!source?.preset?.enabled) continue;
        const mine = new Set();
        for (const asset of source.assets ?? []) {
            const key = String(asset.base ?? asset.file).toLowerCase();
            if (seen.has(key)) continue;
            mine.add(key);
            out.push(asset);
        }
        for (const key of mine) seen.add(key);
    }
    return out;
}
