// 캐릭터 에셋 — 설정, 현재 캐릭터, 작은 도우미
// 이전 '캐릭터 에셋 확장(character-assets)'을 새로 만든 확장. 그림 파일은 같은 곳(characters/<폴더>/)을 그대로 쓴다.
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';

export const MODULE = 'esetham';
export const OLD_MODULE = 'character-assets';
export const VERSION = '1.4.3';
export const TITLE = '캐릭터 에셋';

// AI에게 보내는 글이라 영어로 둔다. {{img_keywords_autogen}} 자리에 지금 캐릭터의 그림 이름 목록이 들어간다.
export const DEFAULT_PROMPT = `### Image Tags

You may insert up to 2 image tags per response. Put each tag on its own line between paragraphs, never inside a sentence.

- Format: {{img::filename.ext}} — copy the filename exactly from the list below, including its extension.
- Do not invent, shorten, or modify filenames. Do not use <img> tags for these images.
- Insert an image only when it clearly fits the paragraph's subject, mood, or emotion. If nothing fits, insert none.
- Avoid repeating the same image in consecutive responses.

Available images: {{img_keywords_autogen}}`;

// 이전 확장의 기본 프롬프트. 옮겨 올 때 이것과 같으면(사용자가 손대지 않았으면) 새 기본 프롬프트를 쓴다.
const LEGACY_DEFAULT_PROMPT = `### Prompt Instruction for Image Tag Insertion (Custom Format Version)

When processing the text, insert up to 2 internal image tags per response, placed between paragraphs (i.e., after a full paragraph has ended). Follow these guidelines precisely:

1. Tag Format:
   Always use the format \`{{img::keyword.extension}}\` — this is a custom tag format used specifically for internal assets.
   - You must include the correct file extension (e.g., \`.jpg\`, \`.png\`, \`.webp\`, etc.) as part of the filename.
   - Do NOT use standard HTML tags like \`<img src="...">\` — those are reserved for external images.
   - Example (correct): \`{{img::steampunk_city.jpg}}\`
   - Incorrect: \`<img src="steampunk_city.jpg">\`

2. Placement Limitation:
   - Insert no more than 2 image tags per response.
   - Insert only if the image enhances the reader's understanding, mood, or emotional tone of the paragraph.
   - Each tag must be placed after a full paragraph ends, not mid-sentence.

3. Context Matching:
   Evaluate the content of each paragraph.
   If a keyword from the list clearly matches the subject, tone, or setting, insert the corresponding image tag after that paragraph.
   - If no keyword fits the context, skip insertion.

4. Avoiding Repetition:
   - Do not repeat the same keyword multiple times across recent responses.
   - Rotate and diversify your choices whenever possible.

5. Syntax Handling:
   This system does not support HTML \`<img>\` tags for internal image rendering.
   Only use \`{{img::filename.ext}}\` format for internal images.
   External images (e.g., from \`https://\` URLs) must continue to use \`<img src="...">\`.

6. Keyword List:
The available keywords are: \`{{img_keywords_grouped}}\`
(Full list with extensions: \`{{img_keywords_autogen}}\`)
- Use only the exact filenames and extensions from the list.
- Do not guess, invent, or modify extensions or filenames.
`;

export const THUMB_SIZES = ['s', 'm', 'l'];

const DEFAULTS = Object.freeze({
    prompt: DEFAULT_PROMPT,
    renderEnabled: true,   // 채팅의 {{img::…}}를 그림으로 바꾸고, 정규식이 그린 그림의 이름·묶음을 맞춘다
    randomGroups: true,    // 번호만 다른 파일(이름, 이름-1, 이름-2 …)을 키워드 하나로 묶고 표시할 때 하나를 고른다
    onceOnly: true,        // 번호 묶음(변형)이 없는 그림은 답변 하나에 한 번만 — 같은 메시지 앞쪽에 이미 나온 태그는 그림 없이 지운다 (1.2.3: 앞 메시지는 안 본다)
    thumbSize: 'm',
    guideOpen: true,
    disabled: {},          // { [폴더 키]: [파일 이름, …] } 꺼 둔 그림 (AI 목록에서 뺀다). 폴더 키 = '캐릭터' 또는 '캐릭터/프리셋'
    presets: {},           // { [캐릭터 폴더]: [ { id, name, enabled } … ] } 프리셋(하위 폴더) 목록, 순서 = 우선순위 (presets.js)
    links: {},             // { [캐릭터 폴더]: [ { owner, presetId, enabled } … ] } 다른 캐릭터의 프리셋을 이 카드에서 쓰기
});

function normalizeText(text) {
    return String(text ?? '').replace(/[`\s]+/g, ' ').trim();
}

export function settings() {
    return extension_settings[MODULE];
}

export function saveSettings() {
    saveSettingsDebounced();
}

export function initSettings() {
    if (!extension_settings[MODULE] || typeof extension_settings[MODULE] !== 'object') {
        const store = structuredClone(DEFAULTS);
        const old = extension_settings[OLD_MODULE];
        // 처음 켤 때 이전 확장의 설정(프롬프트, 렌더링·묶음 스위치, 꺼 둔 그림)을 옮겨 온다.
        if (old && typeof old === 'object') {
            if (typeof old.imagePrompt === 'string' && old.imagePrompt.trim() && normalizeText(old.imagePrompt) !== normalizeText(LEGACY_DEFAULT_PROMPT)) {
                store.prompt = old.imagePrompt;
            }
            if (old.renderer && typeof old.renderer === 'object') {
                if (typeof old.renderer.enabled === 'boolean') store.renderEnabled = old.renderer.enabled;
                if (typeof old.renderer.randomAsset === 'boolean') store.randomGroups = old.renderer.randomAsset;
            }
            const sizeMap = { small: 's', medium: 'm', large: 'l' };
            if (sizeMap[old.gallerySettings?.gridSize]) store.thumbSize = sizeMap[old.gallerySettings.gridSize];
            for (const [key, data] of Object.entries(old.characterAssets ?? {})) {
                // 이전 확장은 캐릭터 번호("0", "1" …)로도 항목을 남겼는데, 그건 폴더가 아니라 버릴 수밖에 없다.
                if (/^\d+$/.test(key) || !data || typeof data !== 'object') continue;
                const list = Array.isArray(data.disabledAssets) ? data.disabledAssets.filter(name => typeof name === 'string' && name) : [];
                if (list.length) store.disabled[key] = [...new Set(list)];
            }
            store.migratedFrom = OLD_MODULE;
        }
        extension_settings[MODULE] = store;
        saveSettings();
    }
    const store = settings();
    if (typeof store.prompt !== 'string') store.prompt = DEFAULT_PROMPT;
    store.renderEnabled = store.renderEnabled !== false;
    store.randomGroups = store.randomGroups !== false;
    store.onceOnly = store.onceOnly !== false; // 1.1.4 에 생긴 값 — 예전 설정에는 없으므로 여기서 기본 켬
    if (!THUMB_SIZES.includes(store.thumbSize)) store.thumbSize = 'm';
    store.guideOpen = store.guideOpen !== false;
    if (!store.disabled || typeof store.disabled !== 'object' || Array.isArray(store.disabled)) store.disabled = {};
    if (!store.presets || typeof store.presets !== 'object' || Array.isArray(store.presets)) store.presets = {}; // 1.2.0
    if (!store.links || typeof store.links !== 'object' || Array.isArray(store.links)) store.links = {};
}

// ── 현재 캐릭터 ───────────────────────────────────────────────

/** 그룹 채팅이거나 캐릭터가 없으면 null */
export function currentCharacter() {
    const context = getContext();
    if (context.groupId) return null;
    const id = context.characterId;
    if (id === undefined || id === null || id === '') return null;
    return context.characters?.[id] ?? null;
}

export function isGroupChat() {
    return Boolean(getContext().groupId);
}

/** 그림이 들어 있는 폴더 이름 = 캐릭터 카드 파일 이름에서 확장자를 뺀 것 (예: 캐릭터 이름) */
export function folderOf(character) {
    return character?.avatar ? String(character.avatar).replace(/\.[^/.]+$/, '') : '';
}

export function currentFolder() {
    return folderOf(currentCharacter());
}

// ── 꺼 둔 그림 ───────────────────────────────────────────────

export function disabledSet(folder) {
    return new Set(folder ? (settings().disabled[folder] ?? []) : []);
}

export function setDisabled(folder, fileName, off) {
    if (!folder || !fileName) return;
    const store = settings();
    const set = new Set(store.disabled[folder] ?? []);
    if (off) set.add(fileName);
    else set.delete(fileName);
    if (set.size) store.disabled[folder] = [...set];
    else delete store.disabled[folder];
    saveSettings();
}

/**
 * 폴더에 더는 없는 파일은 목록에서 정리한다 (이름을 바꾸거나 지운 뒤).
 * 빈 목록으로는 절대 정리하지 않는다: 서버는 폴더를 못 읽어도 200 []를 주므로 '비었다'와 '못 읽었다'를 구분할 수 없고,
 * 남아 있는 옛 이름은 있는 파일만 거르는 데 쓰여서 해롭지 않다.
 * 1.3.1: 확장자만 바뀐 그림(PNG → WebP 줄이기, PC에서 한꺼번에 바꾼 것 포함)은 버리지 않고 새 이름으로 옮긴다.
 *        안 그러면 꺼 둔 그림이 줄이기 한 번에 전부 다시 켜진다.
 */
export function pruneDisabled(folder, existingFiles) {
    if (!folder) return;
    const store = settings();
    const list = store.disabled[folder];
    if (!Array.isArray(list)) return;
    const existing = new Set(existingFiles);
    if (!existing.size) return;
    const byBase = new Map();
    for (const name of existing) {
        const base = baseName(name);
        // 같은 이름이 여럿이면 WebP(줄인 것)를 고른다
        if (!byBase.has(base) || /\.webp$/i.test(name)) byBase.set(base, name);
    }
    const kept = [];
    for (const name of list) {
        const now = existing.has(name) ? name : byBase.get(baseName(name));
        if (now && !kept.includes(now)) kept.push(now);
    }
    if (kept.length === list.length && kept.every((name, at) => name === list[at])) return;
    if (kept.length) store.disabled[folder] = kept;
    else delete store.disabled[folder];
    saveSettings();
}

/** 확장자를 뗀 이름 (assets.js baseOf 와 같다 — 순환 import 를 피하려고 따로 둔다) */
function baseName(name) {
    const text = String(name);
    const dot = text.lastIndexOf('.');
    return dot > 0 ? text.slice(0, dot) : text;
}
