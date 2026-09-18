// Session-only history. Strings (including images) are shared; only changed branches are retained.
const clone = value => Array.isArray(value) ? value.map(clone)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
const equal = (a, b) => a === b || (a && b && typeof a === 'object' && typeof b === 'object'
    && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length
    && Object.keys(a).every(key => Object.hasOwn(b, key) && equal(a[key], b[key])));
function diff(before, after, path = [], patches = []) {
    if (equal(before, after)) return patches;
    if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
            if (!path.length && ['version', 'noticeSeen'].includes(key)) continue;
            diff(before[key], after[key], [...path, key], patches);
        }
    } else patches.push({ path, before: clone(before), after: clone(after) });
    return patches;
}
function bytes(value) {
    if (typeof value === 'string') return value.length * 2;
    if (value && typeof value === 'object') return Object.entries(value).reduce((n, [key, item]) => n + key.length * 2 + bytes(item), 0);
    return 8;
}
function assign(settings, patch, value) {
    let parent = settings;
    for (const key of patch.path.slice(0, -1)) {
        if (!parent[key] || typeof parent[key] !== 'object') parent[key] = {};
        parent = parent[key];
    }
    const key = patch.path.at(-1);
    if (value === undefined) delete parent[key];
    else parent[key] = clone(value);
}
export class SettingsHistory {
    constructor(limit = 40, maxBytes = 8 * 1024 * 1024) {
        this.limit = limit; this.maxBytes = maxBytes; this.undoStack = []; this.redoStack = []; this.pending = null;
    }
    run(settings, mutate, group = '') {
        if (this.pending && (!group || this.pending.group !== group)) this.flush(settings);
        if (!this.pending) this.pending = { before: clone(settings), group };
        mutate(settings);
        if (!group) this.flush(settings);
    }
    flush(settings) {
        if (!this.pending) return;
        const patches = diff(this.pending.before, settings); this.pending = null;
        if (!patches.length) return;
        const entry = { patches, bytes: bytes(patches) };
        this.undoStack.push(entry); this.redoStack = [];
        let size = this.undoStack.reduce((sum, item) => sum + item.bytes, 0);
        while (this.undoStack.length > 1 && (this.undoStack.length > this.limit || size > this.maxBytes)) size -= this.undoStack.shift().bytes;
    }
    step(settings, redo = false) {
        this.flush(settings);
        const from = redo ? this.redoStack : this.undoStack, to = redo ? this.undoStack : this.redoStack;
        const entry = from.pop(); if (!entry) return [];
        const changes = entry.patches.map(p => ({ path: p.path.join('.'), from: clone(p[redo ? 'before' : 'after']), to: clone(p[redo ? 'after' : 'before']) }));
        for (const patch of entry.patches) assign(settings, patch, patch[redo ? 'after' : 'before']);
        to.push(entry); return changes;
    }
    clear() { this.pending = null; this.undoStack = []; this.redoStack = []; }
}
