// Matches IndexedDB's descending at index and descending primary key for ties.
export const compareEntries = (a, b) => b.at - a.at || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1);
export function mergeEntries(...lists) {
    return [...new Map(lists.flat().map(entry => [entry.id, entry])).values()].sort(compareEntries);
}
