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

// ───────── 8.0.1 택1 지킴이 — 프롬프트 관리자 클릭 밖의 길(캐릭터 이름 연동 · 과일의 마음 창 · 헬퍼 스크립트 · 프리셋 불러오기)도 ─────────
// 같은 항목 집합의 묶음(이름 규칙 + blPromptChoices 가 같은 것을 두 번 적은 경우)은 하나로 본다.
export function distinctChoiceGroups(groups = []) {
    const seen = new Map();
    for (const group of groups) {
        const key = [...group.ids].sort().join('\n');
        if (!seen.has(key)) seen.set(key, { id: group.id, ids: [...group.ids], groupIds: [group.id] });
        else seen.get(key).groupIds.push(group.id);
    }
    return [...seen.values()];
}
/** 지금 켜짐 (id → true/false) — 묶음에 든 항목만 */
export function choiceSnapshot(groups, order = []) {
    const ids = new Set(groups.flatMap(group => group.ids)), state = new Map();
    for (const row of order) if (ids.has(row?.identifier)) state.set(row.identifier, row.enabled !== false && !!row.enabled);
    return state;
}
/** 묶음마다 둘 이상 켜졌는지 본다. before(바로 전 켜짐)가 있고 새로 켜진 것이 딱 하나면 그것만 남기고 나머지를 끌 목록(off)에,
 *  판단할 수 없으면(불러올 때 이미 여럿 · 둘 이상이 함께 새로 켜짐) 물어볼 목록(ask)에 넣는다. order 는 바꾸지 않는다. */
export function resolveChoiceConflicts(groups, order = [], before = null) {
    const now = choiceSnapshot(groups, order), off = new Set(), ask = [];
    for (const group of distinctChoiceGroups(groups)) {
        const on = group.ids.filter(id => now.get(id) && !off.has(id));
        if (on.length < 2) continue;
        const fresh = before ? on.filter(id => before.has(id) && before.get(id) === false) : [];
        if (before && fresh.length === 1) { for (const id of on) if (id !== fresh[0]) off.add(id); continue; }
        ask.push({ id: group.id, groupIds: group.groupIds, ids: group.ids, on });
    }
    return { off: [...off], ask };
}
/** 묶음 이름 — 항목 이름들의 공통 앞부분(앞 이모지 · 꾸밈표 뺀 것). 없으면 공통 꼬리(「…｜색상 택1」의 「색상」). 그래도 없으면 '' */
export function choiceGroupLabel(names = []) {
    const clean = name => String(name || '').normalize('NFKC').replace(/^[^\p{L}\p{N}]+/u, '').trim();
    const list = names.map(clean).filter(Boolean);
    if (list.length < 2) return '';
    let prefix = list[0];
    for (const name of list.slice(1)) { let i = 0; while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++; prefix = prefix.slice(0, i); }
    prefix = prefix.replace(/[\s(（[【「·・|｜:：,，-]+$/u, '').trim();
    if ([...prefix].length >= 2) return prefix;
    // 꼬리 조각에서 작성자 표기(@…) · 「택1」 · 「单选」을 떼고 견줘요
    const part = x => x.replace(/\s*[@#]\S.*$/u, '').replace(/\s*(?:택\s*1|单选)$/u, '').trim();
    const tails = list.map(name => name.split(/[|｜]/).slice(1).map(part).filter(Boolean));
    const common = tails[0].find(piece => tails.every(t => t.includes(piece)));
    return common || '';
}
