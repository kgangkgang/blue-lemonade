// Presentation-only cleanup at the tracker/prose boundary.
const TRACKERS = '.custom-dem-track, .custom-dem-track-recovery';
const WRAPPERS = new Set(['P', 'DIV', 'SPAN']);
function trimLeading(container) {
    let node = container.firstChild;
    while (node) {
        const next = node.nextSibling;
        if (node.nodeType === 3 && !node.textContent.trim()) node.remove();
        else if (node.nodeType === 8) { node = next; continue; }
        else if (node.nodeType !== 1) return true;
        else if (node.matches('style, script')) { node = next; continue; }
        else if (node.tagName === 'BR') node.remove();
        else if (WRAPPERS.has(node.tagName)) {
            if (trimLeading(node)) return true;
            // Keep explicitly styled/identified empty elements.
            if (node.attributes.length) return true;
            node.remove();
        } else return true;
        node = next;
    }
    return false;
}
export function normalizeTrackerSpacing(root) {
    for (const tracker of root.querySelectorAll(TRACKERS)) {
        const boundary = tracker.closest('.mes_text') || root;
        let cursor = tracker;
        while (cursor && cursor !== boundary) {
            let next = cursor.nextSibling;
            if (!next) { cursor = cursor.parentNode; continue; }
            if (next.nodeType === 3 && !next.textContent.trim()) { next.remove(); continue; }
            if (next.nodeType === 8 || (next.nodeType === 1 && next.matches('style, script'))) { cursor = next; continue; }
            if (next.nodeType !== 1) break;
            if (next.tagName === 'BR') { next.remove(); continue; }
            if (!WRAPPERS.has(next.tagName)) break;
            if (trimLeading(next) || next.attributes.length) break;
            next.remove();
        }
    }
}
