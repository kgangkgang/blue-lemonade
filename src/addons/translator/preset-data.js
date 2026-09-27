// Imported JSON is untrusted. Keep valid saved objects/references, reject a malformed import atomically.
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeKeys = value => !value || typeof value !== 'object' || Object.entries(value).every(([key, child]) =>
    !['__proto__', 'prototype', 'constructor', 'hasOwnProperty'].includes(key) && safeKeys(child));
export function validSettings(value, defaults) {
    if (!isRecord(value) || !safeKeys(value)) return false;
    if (!defaults) return true;
    return Object.entries(value).every(([key, child]) => {
        if (!Object.hasOwn(defaults, key)) return true;
        const base = defaults[key];
        if (Array.isArray(base)) return Array.isArray(child);
        if (isRecord(base)) return validSettings(child, base);
        return typeof child === typeof base && (typeof child !== 'number' || Number.isFinite(child));
    });
}
export const isPrompt = value => isRecord(value) && ['id', 'title', 'content'].every(key => typeof value[key] === 'string');
export const isPreset = value => isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
    && isRecord(value.settings) && (value.customPrompts === undefined || Array.isArray(value.customPrompts) && value.customPrompts.every(isPrompt));
export const validPromptList = value => Array.isArray(value) ? value.filter(isPrompt) : [];
export const validPresetList = (value, defaults) => Array.isArray(value) ? value.filter(preset => isPreset(preset) && validSettings(preset.settings, defaults)) : [];
export function validImport(data, defaults) {
    return isRecord(data) && (Object.hasOwn(data, 'customPrompts') || Object.hasOwn(data, 'presets'))
        && (!Object.hasOwn(data, 'customPrompts') || Array.isArray(data.customPrompts) && data.customPrompts.every(isPrompt))
        && (!Object.hasOwn(data, 'presets') || Array.isArray(data.presets) && data.presets.every(preset => isPreset(preset) && validSettings(preset.settings, defaults)));
}
export function exportPresets(presets) {
    // Local presets may intentionally switch proxy credentials. Only shared files omit the password.
    return validPresetList(presets).map(preset => {
        const copy = structuredClone(preset);
        delete copy.settings.reverse_proxy_password;
        return copy;
    });
}

export function restoreTranslationRows(db, storeName, rows) {
    if (!Array.isArray(rows)) return Promise.reject(new TypeError('올바르지 않은 파일형식입니다.'));
    const items = rows.filter(row => isRecord(row) && typeof row.originalText === 'string' && typeof row.translation === 'string');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite'), store = tx.objectStore(storeName);
        tx.oncomplete = () => resolve(items.length);
        tx.onabort = () => reject(tx.error || new Error('번역 데이터를 복원하지 못했어요.'));
        tx.onerror = () => {}; // The transaction abort is the single completion/error boundary.
        let offset = 0;
        function next() {
            if (offset >= items.length) return;
            const { id: _foreignId, ...item } = items[offset++];
            const request = store.index('originalText').getAll(item.originalText);
            request.onsuccess = () => {
                const [record, ...duplicates] = request.result || [];
                for (const extra of duplicates) store.delete(extra.id);
                const write = record ? store.put({ ...record, ...item, id: record.id }) : store.add(item);
                write.onsuccess = next;
            };
        }
        next();
    });
}
