// A read-only index of the existing detector's results. No model requests or
// automatic repair queue are started by listing or checking one saved item.
export function createCheckReview({ stateOf, resultOf, forget, actionFor, act, scope = () => null, limit = 300 }) {
    const records = new Map();
    let owner = scope(), busy = false;
    const sync = () => { const next = scope(); if (next !== owner) { records.clear(); owner = next; } };
    const same = (a, b) => !!a && !!b && a.key === b.key && a.source === b.source && a.translation === b.translation
        && a.policySignature === b.policySignature && a.message === b.message && a.swipe === b.swipe && a.requestMetadata === b.requestMetadata;
    function observe(id, state, result) {
        sync();
        const entry = { id: Number(id), state: { ...state }, result, scope: owner };
        records.delete(entry.id); records.set(entry.id, entry);
        while (records.size > limit) records.delete(records.keys().next().value);
        return entry;
    }
    function current(entry) {
        sync();
        if (!entry || entry.scope !== owner || !same(entry.state, stateOf(entry.id))) throw Error('메시지나 번역이 바뀌었어요. 목록을 새로고침해 주세요.');
    }
    function list() {
        sync(); const entries = [];
        for (const [id, entry] of records) {
            if (!same(entry.state, stateOf(id))) { records.delete(id); continue; }
            if (entry.result?.warn) entries.push(entry);
        }
        return entries.sort((a, b) => b.id - a.id);
    }
    function recheck(entry) {
        current(entry); if (busy) throw Error('선택한 항목을 처리 중이에요.');
        forget(entry.id);
        const state = stateOf(entry.id);
        return observe(entry.id, state, resultOf(state));
    }
    function plan(entry, index) {
        current(entry);
        const row = entry.result?.paragraphs.find(row => row.index === index);
        return row ? { row, action: actionFor(entry.state, row) } : null;
    }
    async function run(entry, index, kind) {
        current(entry); if (busy) throw Error('선택한 항목을 처리 중이에요.');
        const picked = plan(entry, index);
        if (kind !== 'whole' && (!picked?.action || picked.action[0] !== kind)) throw Error('이 항목은 문단만 따로 처리할 수 없어요.');
        busy = true;
        try {
            await act(kind, entry.id, index, picked?.row, { expectedState: entry.state, manualReview: true });
            const next = stateOf(entry.id);
            return { changed: entry.scope === scope() && next?.message === entry.state.message && next?.source === entry.state.source && next?.translation !== entry.state.translation };
        }
        finally { busy = false; }
    }
    return { observe, list, current, recheck, plan, run, get busy() { return busy; } };
}
