// Markdown can leave separator newlines as <br> at the beginning of the
// paragraph following a DEM tracker. Shared by chat typography and bookmarks.
// Touch the displayed separators, never the saved message or prose line breaks.
export function normalizeTrackerSpacing(root) {
    for (const tracker of root.querySelectorAll('.custom-dem-track, .custom-dem-track-recovery')) {
        let next = tracker.nextSibling;
        while (next) {
            if (next.nodeType === 3 && !next.textContent.trim()) { next = next.nextSibling; continue; }
            if (next.nodeType !== 1) break;
            if (next.matches('style, script')) { next = next.nextSibling; continue; }
            if (next.tagName === 'BR') { const spacer = next; next = next.nextSibling; spacer.remove(); continue; }
            if (next.tagName !== 'P') break;
            // Stop at the first real content, including images and inline tags.
            while (next.firstChild && ((next.firstChild.nodeType === 3 && !next.firstChild.textContent.trim()) || next.firstChild.nodeName === 'BR')) next.firstChild.remove();
            if (next.childNodes.length) break;
            const spacer = next; next = next.nextSibling; spacer.remove();
        }
    }
}
