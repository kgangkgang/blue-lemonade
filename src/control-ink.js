// Center short control labels using the font that actually rendered, including fallback fonts.
// Only padding is redistributed: the face, hit area, font and spacing retain their sizes.
const ROOTS = '.salty-panel, .bl-roomy-dialog, .bl-tool-dialog, .bl-credits-dialog, .bl-ft-dialog, .bl-assets-dialog, .bl-notes-dialog, .bl-direction-dialog, .bl-ctsi-dialog, .bl-mermaid-dialog, .blpt-dialog, .blzi-dialog, .bl-translator-dialog, .bwr_settings, #lv_settings, #model_register_settings, #model-switch-settings, #regex-link-settings, .po-dialog, .pa-hub, .rl-root, #cg-panel, #pt-panel, .popup-controls';
const BUTTONS = 'button, .menu_button, [role="button"]';
const saved = new WeakMap();
const metrics = new Map();
let canvas, observer, frame = 0, enabled = false;
let appearanceKey = null;
const pending = new Set();

function ink(text, style) {
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const key = `${font}|${style.letterSpacing}|${text}`;
    if (metrics.has(key)) return metrics.get(key);
    canvas ||= document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.font = font;
    const ascent = ctx.measureText(text).fontBoundingBoxAscent;
    const size = parseFloat(style.fontSize), scale = 4;
    const large = `${style.fontStyle} ${style.fontWeight} ${size * scale}px ${style.fontFamily}`;
    ctx.font = large;
    ctx.letterSpacing = `${(parseFloat(style.letterSpacing) || 0) * scale}px`;
    const m = ctx.measureText(text), pad = 8;
    const baseline = Math.ceil(m.actualBoundingBoxAscent) + pad;
    canvas.width = Math.min(4096, Math.ceil(m.width + m.actualBoundingBoxLeft + pad * 2));
    canvas.height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + pad * 2);
    ctx.font = large; ctx.letterSpacing = `${(parseFloat(style.letterSpacing) || 0) * scale}px`;
    ctx.fillStyle = '#000'; ctx.fillText(text, Math.ceil(m.actualBoundingBoxLeft) + pad, baseline);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let top = canvas.height, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] >= 96) { top = Math.min(top, y); bottom = Math.max(bottom, y + 1); }
    }
    const result = bottom < 0 ? null : { ascent, top: (top - baseline) / scale, bottom: (bottom - baseline) / scale };
    if (metrics.size > 2048) metrics.clear();   // ~50 settings routes x 20 labels stay cached between route visits
    metrics.set(key, result);
    return result;
}

function baselineOf(node) {
    // 글자 노드를 잠깐 인라인 묶음에 넣고 그 안 끝에 너비 0 막대를 붙인다 — 단추가 flex · grid 면 글자 옆에 바로 붙인 막대는
    // 따로 블록이 되어 글자 줄과 어긋나므로(7.8.2 첫 시도에서 「원복」 단추 +3~4px), 글자와 같은 줄 상자 안에서 잰다.
    const parent = node.parentNode;
    if (!parent) return null;
    const wrap = document.createElement('span');
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;overflow:hidden;vertical-align:baseline';
    try {
        parent.insertBefore(wrap, node);
        wrap.append(node, probe);
        const y = probe.getBoundingClientRect().bottom;
        return Number.isFinite(y) ? y : null;
    } catch { return null; }
    finally { try { if (wrap.parentNode) { wrap.parentNode.insertBefore(node, wrap); wrap.remove(); } } catch {} }
}

function restore(el) {
    const old = saved.get(el);
    if (!old) return;
    for (const [prop, value, priority] of old) {
        if (value) el.style.setProperty(prop, value, priority); else el.style.removeProperty(prop);
    }
    saved.delete(el);
}

function align(root) {
    if (!root.getClientRects().length || (root.checkVisibility && !root.checkVisibility({ checkVisibilityCSS: true }))) return;
    const controls = [...root.querySelectorAll(BUTTONS)];
    for (const el of controls) restore(el);
    for (let pass = 0; pass < 3; pass++) {
    const writes = [];
    for (const el of controls) {
        // Picture choices, switches and mixed icon labels have their own layout contracts.
        if (el.closest('.salty-preview, .salty-sample, .salty-shapes, [data-bl-native-ext-colors]') || el.matches('.bl-md-choice, .bl-editor-group-toggle, .bl-editor-choose') || el.querySelector('i, svg, img, canvas, input, button, [class*="fa-"]')) continue;
        const text = el.textContent.trim();
        if (!text || text.length > 80 || !/[\p{L}\p{N}]/u.test(text)) continue;
        const box = el.getBoundingClientRect(), style = getComputedStyle(el);
        if (box.width < 1 || box.height < 1 || box.height > 64 || style.visibility === 'hidden' || style.writingMode !== 'horizontal-tb') continue;
        if (['::before', '::after'].some(p => { const s = getComputedStyle(el, p); return s.position !== 'absolute' && s.content && !['none', 'normal', '""'].includes(s.content); })) continue;
        let top = Infinity, bottom = -Infinity, line = null, multiline = false;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim()) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
            if (rects.length !== 1) { multiline = true; break; }
            const rect = rects[0];
            if (line !== null && Math.abs(rect.top - line) > 2) { multiline = true; break; }
            line = rect.top;
            const measure = ink(node.textContent.replace(/\s+/g, ' '), getComputedStyle(node.parentElement));
            if (!measure) continue;
            // 7.8.2: 기준선은 글꼴 표(fontBoundingBoxAscent)로 추정하지 않고 화면에서 직접 잰다 — 안드로이드는 같은 글꼴 파일의
            // ascent 를 윈도우와 다른 표에서 읽어, 추정 기준선이 1~1.5px 어긋나 폰에서만 글자가 아래로 처져 보였다(사용자 폰 사진 10-23).
            // 너비 0 인라인 블록의 아래 끝 = 그 줄의 실제 기준선. 재고 바로 뗀다(관찰자는 꺼진 상태라 다시 맞추기를 부르지 않음).
            const base = baselineOf(node) ?? Math.round(rect.top + measure.ascent);
            top = Math.min(top, base + measure.top); bottom = Math.max(bottom, base + measure.bottom);
        }
        if (multiline || !Number.isFinite(top)) continue;
        const faceTop = box.top + parseFloat(style.borderTopWidth);
        const faceBottom = box.bottom - parseFloat(style.borderBottomWidth);
        const shift = (faceTop + faceBottom - top - bottom) / 2;
        const pt = parseFloat(style.paddingTop), pb = parseFloat(style.paddingBottom);
        if (Math.abs(shift) <= .5 || Math.abs(shift) > 4 || pt + shift < 0 || pb - shift < 0) continue;
        writes.push([el, pt + shift, pb - shift]);
    }
    for (const [el, top, bottom] of writes) {
        if (!saved.has(el)) saved.set(el, ['padding-top', 'padding-bottom'].map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]));
        el.style.setProperty('padding-top', `${top}px`, 'important');
        el.style.setProperty('padding-bottom', `${bottom}px`, 'important');
    }
    if (!writes.length) break;
    }
}

function watch() {
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'open', 'aria-pressed', 'aria-expanded'] });
}

function queue(root) {
    if (!enabled || !root) return;
    for (const parent of pending) if (parent.contains(root)) return;
    for (const child of pending) if (root.contains(child)) pending.delete(child);
    pending.add(root);
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0; observer.disconnect();
        for (const el of pending) if (el.isConnected) align(el);
        pending.clear(); watch();
    });
}

export function syncControlInk(active, key = '') {
    if (enabled === !!active && appearanceKey === key) return;
    appearanceKey = key;
    enabled = !!active;
    if (!observer) {
        observer = new MutationObserver(records => {
            if (!enabled) return;
            for (const record of records) {
                const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
                if (target?.closest('#chat, .mes_text')) continue;
                // Text or child changes outside any control (slider readouts, counters, notes) cannot move a label.
                if (record.type !== 'attributes' && !target?.closest(BUTTONS) && ![...record.addedNodes || []].some(n => n.nodeType === 1 && (n.matches(BUTTONS) || n.querySelector(BUTTONS)))) continue;
                const root = target?.closest(ROOTS);
                if (root) queue(root);
                for (const node of record.addedNodes || []) if (node.nodeType === 1) {
                    if (node.matches(ROOTS)) queue(node);
                    node.querySelectorAll(ROOTS).forEach(queue);
                }
            }
        });
        document.fonts?.addEventListener('loadingdone', () => { metrics.clear(); document.querySelectorAll(ROOTS).forEach(queue); });
        window.addEventListener('resize', () => document.querySelectorAll(ROOTS).forEach(queue), { passive: true });
        watch();
    }
    if (!enabled) {
        cancelAnimationFrame(frame); frame = 0; pending.clear(); observer.disconnect();
        document.querySelectorAll(ROOTS).forEach(root => root.querySelectorAll(BUTTONS).forEach(restore));
        return;
    }
    watch(); document.querySelectorAll(ROOTS).forEach(queue);
}
