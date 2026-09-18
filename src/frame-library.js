import { tidyDecor } from './decor.js';
export const FRAME_LIMIT = 12;
const BYTE_LIMIT = 12 * 1024 * 1024;
import { drawPreset, FRAME_PRESETS } from './frame-presets.js';
export { FRAME_PRESETS };
export function tidyFrameLibrary(s) {
    if (!Array.isArray(s.frameLibrary)) s.frameLibrary = [];
    let size = 0; const seen = new Set();
    s.frameLibrary = s.frameLibrary.filter(item => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-z\d-]{1,80}$/i.test(item.id) || seen.has(item.id) || seen.size >= FRAME_LIMIT) return false;
        tidyDecor(item);
        if (!item.decor.art || !item.decor.mask) return false;
        size += item.decor.art.length + item.decor.mask.length;
        if (size > BYTE_LIMIT) return false;
        item.name = String(item.name || '내 액자').trim().slice(0, 40); seen.add(item.id); return true;
    });
}
export function saveFrame(s, owner, name) {
    const decor = s[owner]?.decor;
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
    for (const owner of ['image', 'profile']) if (s[owner].decor.libraryId === id) delete s[owner].decor.libraryId;
}
export const presetFrame = (id, options) => drawPreset(id, options);
export function refreshPreset(decor) {
    if (!FRAME_PRESETS.some(([id]) => id === decor.presetId)) return;
    const rendered = drawPreset(decor.presetId, decor);
    for (const key of ['art', 'mask', 'ratio', 'presetColor', 'presetAccent', 'frameWidth', 'frameHeight']) decor[key] = rendered[key];
}
