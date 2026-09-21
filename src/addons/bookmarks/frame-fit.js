// The root scrollHeight includes the iframe viewport (150px by default), so it
// cannot shrink a short tracker or a collapsed details block. Measure the body,
// like Tavern Helper does for the original chat, and only write actual changes.
export function fitHtmlFrame(iframe, onResize = null) {
    const doc = iframe.contentDocument;
    if (!doc?.body) return;
    const view = doc.defaultView;
    let scheduled = 0;
    const fit = () => {
        scheduled = 0;
        const height = Math.max(1, Math.ceil(doc.body.scrollHeight));
        if (iframe.style.height === `${height}px`) return;
        iframe.style.height = `${height}px`;
        onResize?.();
    };
    const observer = new ResizeObserver(() => {
        if (!scheduled) scheduled = view.requestAnimationFrame(fit);
    });
    observer.observe(doc.body);
    view.addEventListener('pagehide', () => {
        observer.disconnect();
        if (scheduled) view.cancelAnimationFrame(scheduled);
    }, { once: true });
    fit();
}
