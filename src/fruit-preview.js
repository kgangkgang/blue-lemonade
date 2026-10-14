import { mountFruitCardPreview } from './fruit-cards.js';

// Newly written demonstration markup only. No chat, preset, character, storage or network reads.
export const FRUIT_PREVIEW_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;padding:0;box-sizing:border-box}body{padding:8px;font:16px/1.5 system-ui,sans-serif}
.fate-status-wrapper{display:flex;flex-direction:column;gap:12px;padding:12px;border:1px solid #8993a3;border-radius:12px;color:#202733;background:#f5f7fb;overflow-wrap:anywhere}
.fate-status-wrapper[data-bl-preview-theme="night"]{color:#e7edf6;background:#242a34}
.fate-theme-toggle{align-self:flex-end;display:inline-flex;align-items:center;justify-content:center;min-width:28px;min-height:28px;border:1px solid currentColor;border-radius:50%;background:transparent;color:inherit;font:inherit;cursor:pointer}
.fate-top-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fate-grid-item{min-width:0}.fate-grid-label{font-size:.8em;opacity:.7}.fate-grid-value{font-size:1em}
.movie-line-content{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px}.movie-deco-eng{flex-basis:100%;font-size:.8em;opacity:.7}.movie-huge-text{font-size:1.2em}.fate-between{font-size:.9em;text-align:center}
</style></head><body><section class="fate-status-wrapper" data-bl-preview-theme="night">
<button class="fate-theme-toggle" type="button" aria-label="미리보기 낮 모드로 바꾸기">☾</button>
<div class="fate-top-grid">
<div class="fate-grid-item"><div class="fate-grid-label">DATE</div><div class="fate-grid-value">2026.04.12</div></div>
<div class="fate-grid-item"><div class="fate-grid-label">TIME</div><div class="fate-grid-value">오후 4:20</div></div>
<div class="fate-grid-item"><div class="fate-grid-label">LOC.</div><div class="fate-grid-value">작은 서점</div></div>
<div class="fate-grid-item"><div class="fate-grid-label">WTHR</div><div class="fate-grid-value">맑음</div></div>
</div><div class="fate-movie-quote-container"><div class="movie-line-content"><span class="movie-deco-eng">SCENE</span><span class="char-wrap">책</span><span class="movie-huge-text">장 사이의 조용한 오후</span></div></div>
<div class="fate-between">인물 A × 인물 B</div></section></body></html>`;

/** A bounded, isolated view using the same styling engine as actual Fruit cards. */
export function mountFruitPreview(host, readSettings) {
    if (!host) return null;
    const doc = host.ownerDocument, win = doc.defaultView, panel = host.closest('.salty-panel') || host;
    let disposed = false, frameId = 0, engine = null, resizeObserver = null, toggle = null, modeHandler = null;
    const caption = doc.createElement('div'); caption.textContent = '미리보기 · 가상 장면';
    caption.style.cssText = 'margin:0 0 8px;color:var(--salty-muted);font-size:.85em;line-height:1.5';
    const frame = doc.createElement('iframe'); frame.title = '과일 상태 카드 가상 미리보기';
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.style.cssText = 'display:block;width:100%;height:220px;max-height:320px;border:1px solid var(--salty-line);border-radius:var(--bl-r-md,12px);background:transparent;box-sizing:border-box';
    const resize = () => {
        if (disposed || !frame.isConnected) return;
        const sample = frame.contentDocument?.querySelector('.fate-status-wrapper');
        if (!sample) return;
        const height = Math.min(320, Math.max(180, Math.ceil(sample.getBoundingClientRect().bottom + (frame.contentWindow?.scrollY || 0) + 8)));
        if (frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
    };
    const paint = () => {
        frameId = 0;
        if (disposed || !engine || !frame.isConnected) return;
        // Preview activation is local to its document; never change the saved on/off option.
        engine.update({ ...(readSettings()?.fruit?.cards || {}), on: true });
        resize();
    };
    const update = () => { if (!disposed && !frameId) frameId = win.requestAnimationFrame(paint); };
    const loaded = () => {
        if (disposed || !frame.isConnected) return;
        const preview = frame.contentDocument, sample = preview?.querySelector('.fate-status-wrapper');
        if (!sample) return;
        sample.dataset.blPreviewTheme = panel._fruitPreviewMode === 'day' ? 'day' : 'night';
        toggle?.removeEventListener('click', modeHandler);
        engine?.dispose(); resizeObserver?.disconnect();
        engine = mountFruitCardPreview(preview, { ...(readSettings()?.fruit?.cards || {}), on: true });
        toggle = sample.querySelector('.fate-theme-toggle');
        modeHandler = () => {
            const next = sample.dataset.blPreviewTheme === 'night' ? 'day' : 'night';
            sample.dataset.blPreviewTheme = next;
            panel._fruitPreviewMode = next;
            toggle.textContent = next === 'night' ? '☾' : '☀';
            toggle.setAttribute('aria-label', next === 'night' ? '미리보기 낮 모드로 바꾸기' : '미리보기 밤 모드로 바꾸기');
            update();
        };
        toggle.textContent = sample.dataset.blPreviewTheme === 'night' ? '☾' : '☀';
        toggle.setAttribute('aria-label', sample.dataset.blPreviewTheme === 'night' ? '미리보기 낮 모드로 바꾸기' : '미리보기 밤 모드로 바꾸기');
        toggle.addEventListener('click', modeHandler);
        resizeObserver = new win.ResizeObserver(resize); resizeObserver.observe(sample);
        update();
    };
    frame.addEventListener('load', loaded);
    frame.srcdoc = FRUIT_PREVIEW_HTML;
    host.append(caption, frame);
    panel.addEventListener('input', update); panel.addEventListener('change', update);
    panel.addEventListener('bl:preview-resize', update);
    doc.addEventListener('salty:font-ready', update);
    doc.fonts?.addEventListener('loadingdone', update);
    win.addEventListener('bl:settings-replaced', update);
    const observer = new win.MutationObserver(records => {
        if (records.some(record => record.type === 'attributes' || record.target.id === 'salty-fontfaces' ||
            record.target.parentElement?.id === 'salty-fontfaces' || [...record.addedNodes].some(node => node.id === 'salty-fontfaces'))) update();
    });
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    observer.observe(doc.body, { attributes: true, attributeFilter: ['style', 'class', 'data-salty-palette'] });
    observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
    return {
        update,
        dispose() {
            if (disposed) return; disposed = true;
            win.cancelAnimationFrame(frameId); observer.disconnect(); resizeObserver?.disconnect();
            frame.removeEventListener('load', loaded); toggle?.removeEventListener('click', modeHandler);
            panel.removeEventListener('input', update); panel.removeEventListener('change', update);
            panel.removeEventListener('bl:preview-resize', update); doc.removeEventListener('salty:font-ready', update);
            doc.fonts?.removeEventListener('loadingdone', update);
            win.removeEventListener('bl:settings-replaced', update);
            engine?.dispose(); frame.remove(); caption.remove();
        },
    };
}
