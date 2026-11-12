import { tidyDecor, isPresetFrame } from './decor.js';
export const FRAME_LIMIT = 30;   // 1.0.1: 12 → 30 (용량 상한은 그대로 12MB)
const BYTE_LIMIT = 12 * 1024 * 1024;
import { drawPreset, FRAME_PRESETS, PRESET_LABELS, PRESET_LABEL_MAX, PRESET_MOTIONS, retirePreset } from './frame-presets.js';
export { FRAME_PRESETS, PRESET_LABELS, PRESET_LABEL_MAX, PRESET_MOTIONS };
export function tidyFrameLibrary(s) {
    if (!Array.isArray(s.frameLibrary)) s.frameLibrary = [];
    let size = 0; const seen = new Set();
    s.frameLibrary = s.frameLibrary.filter(item => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-z\d-]{1,80}$/i.test(item.id) || seen.has(item.id) || seen.size >= FRAME_LIMIT) return false;
        retirePreset(item.decor, true);   // 1.0.2 걷은 기본 프리셋 6종으로 저장한 액자는 그림 그대로 · 프리셋 표시만 떼요 (decor.js tidyDecor 보다 먼저)
        tidyDecor(item);
        if (!item.decor.art || !item.decor.mask) return false;
        size += item.decor.art.length + item.decor.mask.length;
        if (size > BYTE_LIMIT) return false;
        item.name = String(item.name || '내 액자').trim().slice(0, 40); seen.add(item.id); return true;
    });
}
export function saveFrame(s, owner, name) {
    const decor = s[owner]?.decor;
    // 꺼 둔 기본 프리셋은 그림을 비워 둔다 (decor.js slimDecor) — 보관함 액자는 그림을 그대로 가지므로 넣기 전에 다시 그린다
    if (decor && (!decor.art || !decor.mask) && isPresetFrame(decor)) refreshPreset(decor);
    // 1.1.4 움직임을 켠 레코드 재킷은 판을 그림에서 떼고 frame-motion.js 가 따로 그려요 — 보관함 액자(지금 액자도 저장하면 그렇게 돼요)에는 그게 안 붙어
    //   판이 사라졌어요. 판을 넣어 다시 그리고 움직임을 꺼요(보관함 액자는 움직이지 않아요)
    if (decor?.presetLifted) { decor.motion = false; refreshPreset(decor); }
    if (!decor?.art || !decor.mask) throw new Error('먼저 액자를 고르거나 불러와 주세요.');
    if (s.frameLibrary.length >= FRAME_LIMIT) throw new Error(`액자는 최대 ${FRAME_LIMIT}개까지 저장할 수 있어요. 보관함에서 쓰지 않는 액자를 지워 주세요.`);
    const size = s.frameLibrary.reduce((n, item) => n + item.decor.art.length + item.decor.mask.length, 0) + decor.art.length + decor.mask.length;
    if (size > BYTE_LIMIT) throw new Error('액자 보관함이 가득 찼어요. 큰 액자를 지우거나 더 작은 그림으로 저장해 주세요.');
    const unique = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    const id = `frame-${unique}`;
    const copy = { ...decor, on: true }; delete copy.libraryId;
    s.frameLibrary.push({ id, name: String(name || `내 액자 ${s.frameLibrary.length + 1}`).trim().slice(0, 40), decor: copy });
    decor.libraryId = id; return id;
}
export function useFrame(s, owner, id) {
    const item = s.frameLibrary.find(x => x.id === id);
    if (item) s[owner].decor = { ...item.decor, on: true, libraryId: id };
}
export function deleteFrame(s, id) {
    s.frameLibrary = s.frameLibrary.filter(x => x.id !== id);
    for (const owner of ['image', 'profile', 'userProfile']) if (s[owner]?.decor.libraryId === id) delete s[owner].decor.libraryId;
}
export const presetFrame = (id, options) => drawPreset(id, options);
export function refreshPreset(decor) {
    if (!FRAME_PRESETS.some(([id]) => id === decor.presetId)) return;
    const rendered = drawPreset(decor.presetId, decor);
    for (const key of ['art', 'mask', 'ratio', 'presetVersion', 'presetColor', 'presetAccent', 'frameWidth', 'frameHeight']) decor[key] = rendered[key];
    if (rendered.presetLabel !== undefined) decor.presetLabel = rendered.presetLabel; else delete decor.presetLabel;
    if (rendered.presetLifted) decor.presetLifted = true; else delete decor.presetLifted;   // 움직임을 켠 레코드 재킷: 판을 그림에서 뗀 판   // 칩 글자는 칩이 있는 프리셋에만
}
