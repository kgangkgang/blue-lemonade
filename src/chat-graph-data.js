// Read-only graph facts. IDs are exact ST session names (not paths or display labels).
// main_chat is authoritative; copied message extras can only locate a proven edge.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idString = value => typeof value === 'string' && value.length > 0;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

/**
 * Extract small hints from an already loaded chat; messages must exclude its header.
 * Does not retain message text, metadata or source arrays. Message IDs are zero-based.
 * @param {string} parentId Exact session ID of the chat these messages came from.
 * @param {object[]} messages ST context.chat, not /get's header-prefixed response.
 * @returns {{parentId:string,childId:string,messageId:number,kind:string}[]}
 */
export function collectBranchHints(parentId, messages) {
    if (!idString(parentId) || !Array.isArray(messages)) return [];
    const result = [], seen = new Set();
    messages.forEach((message, messageId) => {
        const extra = object(message?.extra) ? message.extra : null;
        if (!extra) return;
        const add = (childId, kind) => {
            if (!idString(childId)) return;
            const key = JSON.stringify([childId, messageId, kind]);
            if (seen.has(key)) return;
            seen.add(key);
            result.push({ parentId, childId, messageId, kind });
        };
        if (Array.isArray(extra.branches)) for (const childId of extra.branches) add(childId, 'branch');
        add(extra.bookmark_link, 'checkpoint');
    });
    return result;
}

function parentFact(metadata) {
    if (!object(metadata)) return { known: false, parent: null, invalid: false };
    const value = Object.hasOwn(metadata, 'main_chat') ? metadata.main_chat : null;
    if (value === null || value === undefined || value === '') return { known: true, parent: null, invalid: false };
    return idString(value) ? { known: true, parent: value, invalid: false } : { known: true, parent: null, invalid: true };
}

/**
 * Build a forest from the current character/group's file list only. Never fetches,
 * guesses from branch-like names, repairs persisted metadata, or creates ghost files.
 * Metadata omitted/null = not yet loaded; {} = loaded, no declared parent.
 * Pass exact IDs: characters/chats file_id; group.chats and search file_name already
 * are IDs. Do not strip '.jsonl' from main_chat (it may be part of a real ID).
 *
 * @param {{id:string,label?:string,metadata?:object,messageCount?:number}[]} records
 * @param {{currentId?:string,branchHints?:object[]}} [options]
 * @returns {{nodes:object[],edges:object[],roots:string[],issues:object[],ignoredHintCount:number}}
 */
export function buildChatGraph(records, { currentId = '', branchHints = [] } = {}) {
    const nodes = [], issues = [], groups = new Map();
    const issue = (code, id, details = {}) => issues.push({ code, id, ...details });
    for (const record of Array.isArray(records) ? records : []) {
        if (!object(record) || !idString(record.id)) { issue('invalid-record', null); continue; }
        let group = groups.get(record.id);
        if (!group) {
            const node = {
                id: record.id, label: idString(record.label) ? record.label : record.id,
                current: record.id === currentId, messageCount: count(record.messageCount),
                metadataLoaded: false, declaredParentId: null, parentId: null,
                children: [], depth: 0, rootId: record.id, status: 'unknown',
                branchMessageId: null, branchKind: 'unknown',
            };
            group = { node, copies: 0, parents: new Set(), invalid: false };
            groups.set(record.id, group); nodes.push(node);
        }
        group.copies++;
        const fact = parentFact(record.metadata);
        if (fact.known) {
            group.node.metadataLoaded = true;
            group.invalid ||= fact.invalid;
            if (!fact.invalid) group.parents.add(fact.parent);
        }
        if (group.node.messageCount === null) group.node.messageCount = count(record.messageCount);
    }
    for (const { node, copies, parents, invalid } of groups.values()) {
        if (copies > 1) issue('duplicate-record', node.id, { count: copies });
        if (parents.size > 1 || (invalid && parents.size > 0)) {
            node.status = 'duplicate-conflict';
            issue(node.status, node.id, { parents: [...parents], invalid });
            continue;
        }
        if (invalid) { node.status = 'invalid-parent'; issue(node.status, node.id); continue; }
        if (!node.metadataLoaded) continue;
        const parent = parents.values().next().value ?? null;
        node.declaredParentId = parent;
        if (parent === null) { node.status = 'root'; continue; }
        if (parent === node.id) { node.status = 'self-parent'; issue(node.status, node.id, { parentId: parent }); continue; }
        if (!groups.has(parent)) { node.status = 'missing-parent'; issue(node.status, node.id, { parentId: parent }); continue; }
        node.parentId = parent;
        node.status = 'linked';
    }

    // Iterative traversal also handles very long imported histories without stack overflow.
    // Reject every edge internal to a cycle, rather than choosing an arbitrary hierarchy.
    const visited = new Set(), cyclic = new Set();
    for (const node of nodes) {
        if (visited.has(node.id)) continue;
        const path = [], positions = new Map();
        let next = node;
        while (next && !visited.has(next.id)) {
            if (positions.has(next.id)) {
                for (let i = positions.get(next.id); i < path.length; i++) cyclic.add(path[i].id);
                break;
            }
            positions.set(next.id, path.length); path.push(next);
            next = groups.get(next.parentId)?.node;
        }
        for (const entry of path) visited.add(entry.id);
    }
    for (const id of cyclic) {
        const node = groups.get(id).node;
        issue('cycle', id, { parentId: node.parentId });
        node.parentId = null; node.status = 'cycle';
    }

    const edges = [], edgeByChild = new Map();
    for (const node of nodes) {
        if (node.parentId === null) continue;
        const edge = { parentId: node.parentId, childId: node.id, messageId: null, kind: 'unknown', source: 'main_chat' };
        edges.push(edge); edgeByChild.set(node.id, { edge, positions: new Set(), kinds: new Set() });
        groups.get(node.parentId).node.children.push(node.id);
    }
    let ignoredHintCount = 0;
    for (const hint of Array.isArray(branchHints) ? branchHints : []) {
        const target = edgeByChild.get(hint?.childId);
        if (!target || target.edge.parentId !== hint?.parentId || count(hint?.messageId) === null) { ignoredHintCount++; continue; }
        const total = groups.get(hint.parentId).node.messageCount;
        if (total !== null && hint.messageId >= total) { ignoredHintCount++; continue; }
        target.positions.add(hint.messageId);
        if (hint.kind === 'branch' || hint.kind === 'checkpoint') target.kinds.add(hint.kind);
    }
    for (const { edge, positions, kinds } of edgeByChild.values()) {
        if (positions.size === 1) edge.messageId = positions.values().next().value;
        else if (positions.size > 1) issue('ambiguous-branch-point', edge.childId, { parentId: edge.parentId, messageIds: [...positions].sort((a,b) => a-b) });
        if (kinds.size === 1) edge.kind = kinds.values().next().value;
        else if (kinds.size > 1) issue('ambiguous-branch-kind', edge.childId, { parentId: edge.parentId });
        const node = groups.get(edge.childId).node;
        node.branchMessageId = edge.messageId; node.branchKind = edge.kind;
    }

    const roots = nodes.filter(node => node.parentId === null).map(node => node.id);
    const queue = roots.map(id => groups.get(id).node);
    for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        for (const id of node.children) {
            const child = groups.get(id).node;
            child.depth = node.depth + 1; child.rootId = node.rootId;
            queue.push(child);
        }
    }
    return { nodes, edges, roots, issues, ignoredHintCount };
}
