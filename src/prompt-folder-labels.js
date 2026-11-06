import { LIMITS } from './prompt-folders-core.js';
const foreign = text => /[\u3400-\u9fff\u3040-\u30ff]/u.test(text);

/** 같은 이름은 한 번만 보내고, 결과를 적용할 폴더 번호는 여기에서만 보관해요. */
export function planFolderNames(folders) {
    const names = [], entries = [], indices = new Map();
    for (const folder of folders.slice(0, LIMITS.folders)) {
        const name = String(folder.name || '').trim();
        if (!name || !foreign(name)) continue;
        if (!indices.has(name)) { indices.set(name, names.length); names.push(name); }
        entries.push({ id: folder.id, name: folder.name, index: indices.get(name) });
    }
    return { names, entries };
}
export function folderLabelsJson(names) {
    if (!Array.isArray(names) || names.length > LIMITS.folders || names.some(name => typeof name !== 'string' || !name.trim() || Array.from(name).length > LIMITS.name)) throw Error('번역할 폴더 이름을 확인해 주세요');
    return JSON.stringify(Object.fromEntries(names.map((name, i) => [`n${i}`, name])));
}
export function parseFolderLabels(names, response) {
    folderLabelsJson(names);
    const text = String(response ?? '').trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```$/, '').trim();
    let data; try { data = JSON.parse(text); } catch { throw Error('이름 번역의 형식이 달라 적용하지 않았어요. 다시 시도해 주세요'); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== names.length) throw Error('번역된 이름 수가 달라 적용하지 않았어요');
    return names.map((_, i) => {
        const value = data[`n${i}`];
        if (typeof value !== 'string' || !value.trim()) throw Error('비어 있는 번역 이름이 있어 적용하지 않았어요');
        return Array.from(value.replace(/\s+/g, ' ').trim()).slice(0, LIMITS.name).join('');
    });
}
/** 기다리는 사이 직접 고친 이름은 유지해요. 사본에만 적용하고 저장은 편집창이 맡아요. */
export function applyFolderNamePlan(folders, plan, names) {
    if (!Array.isArray(names) || names.length !== plan.names.length) throw Error('번역된 이름 수가 달라요');
    const byId = new Map(folders.map(folder => [folder.id, folder])); let changed = 0;
    for (const entry of plan.entries) {
        const folder = byId.get(entry.id), value = names[entry.index];
        if (folder?.name === entry.name && typeof value === 'string' && value.trim() && value !== folder.name) { folder.name = value; changed++; }
    }
    return changed;
}
