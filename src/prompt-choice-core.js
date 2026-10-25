// 명시된 택1 묶음만 다뤄요. 프롬프트 본문과 다른 묶음은 바꾸지 않아요.
export function promptChoiceGroups(prompts = [], order = [], metadata = {}) {
    const byId = new Map(prompts.filter(p => typeof p?.identifier === 'string').map(p => [p.identifier, p]));
    const linked = new Set(order.map(e => e?.identifier).filter(id => byId.has(id)));
    const groups = [];
    let current = null;
    for (const entry of order) {
        const prompt = byId.get(entry?.identifier);
        const name = String(prompt?.name || '').trim();
        if (/^🔻\s*(?:PICK|택1)\s*:/iu.test(name)) {
            current = { id: prompt.identifier, ids: [] };
            groups.push(current);
        } else if (current && /^(?:「|!)/u.test(name)) {
            current.ids.push(prompt.identifier);
        } else current = null;
    }
    if (metadata?.version === 1 && Array.isArray(metadata.groups)) {
        for (const group of metadata.groups.slice(0, 100)) {
            if (typeof group?.id !== 'string' || !Array.isArray(group.ids)) continue;
            groups.push({ id: group.id, ids: [...new Set(group.ids.filter(id => typeof id === 'string' && linked.has(id)))].slice(0, 100) });
        }
    }
    return groups.filter(group => group.ids.length >= 2);
}

// 호스트가 선택한 항목을 켜기 직전에 다른 항목만 꺼요. 켜짐/저장은 호스트가 한 번 처리해요.
export function preparePromptChoice(prompts, order, metadata, selected) {
    const entry = order.find(row => row.identifier === selected);
    if (!entry || entry.enabled) return [];
    const peers = new Set(promptChoiceGroups(prompts, order, metadata).filter(group => group.ids.includes(selected)).flatMap(group => group.ids));
    const changed = [];
    for (const row of order) {
        if (row.identifier !== selected && peers.has(row.identifier) && row.enabled) {
            row.enabled = false;
            changed.push(row.identifier);
        }
    }
    return changed;
}
