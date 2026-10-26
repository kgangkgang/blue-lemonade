// Center short control labels using the font that actually rendered, including fallback fonts.
// Only padding is redistributed: the face, hit area, font and spacing retain their sizes.
const ROOTS = '.salty-panel, .bl-roomy-dialog, .bl-tool-dialog, .bl-credits-dialog, .bl-ft-dialog, .bl-assets-dialog, .bl-notes-dialog, .bl-direction-dialog, .bl-ctsi-dialog, .bl-mermaid-dialog, .blpt-dialog, .blzi-dialog, .bl-translator-dialog, .bwr_settings, #lv_settings, #model_register_settings, #model-switch-settings, #regex-link-settings, .po-dialog, .pa-hub, .rl-root, #cg-panel, #pt-panel, .popup-controls, .pt-help-dialog, .llmt-settings, .cg-root, #fruit-heart-v6, #bl-deus-popover';
// 7.8.6: 한글화 패널 사용법 창 · LLM 번역 서랍 설정 · 북마크 창도 — 그 단추들은 윈도우에서 잰 글꼴 표(--bl-text-nudge)만 따라가고 있었다
// 7.9.9: 과일의 마음 창(프리셋 스크립트가 그림 · body 밖 html 자식) · 데우스 빠른 설정 창도 — 고르기 단추 · 글자 단추 · 하단 탭의 글자 잉크가 1~2.7px 아래로 처져 있었다(10-26 리그 실측)
const BUTTONS = 'button, .menu_button, [role="button"]';
const WATCH = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'open', 'aria-pressed', 'aria-expanded'] };
const saved = new WeakMap();
const metrics = new Map();
const baselineCache = new Map();   // 7.8.2: 글꼴 · 크기 · 줄 높이별 줄 위 → 기준선 거리
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

// 7.8.5: 기준선 재기를 한 번에 — 예전(7.8.2)에는 단추를 돌다가 처음 보는 글꼴 · 줄 높이마다 그 단추 글자 노드를 span 에 넣었다 빼며 재서,
// 그 뒤 단추의 읽기마다 화면 다시 계산(강제 리플로)이 생겼다(개인 4차: #pt-panel 단추 94개 → 서랍 펼칠 때 24번). 이제는 모두 읽은 뒤,
// 모르는 글꼴 · 줄 높이만 숨은 줄 하나씩 모아 한 번 붙여 재고 뗀다(다시 계산 1번). 재는 값은 같다: 글자 조각 위 → 너비 0 막대 아래 끝(= 실제 기준선).
// 숨은 줄이 테마 규칙에 덮이지 않게 글꼴 속성은 인라인 !important(작성자 !important 보다 앞섬).
function measureBaselines(samples) {
    const out = new Map();
    if (!samples.size) return out;
    let box = null;
    try {
        box = document.createElement('div');
        box.setAttribute('aria-hidden', 'true');
        box.style.cssText = 'position:absolute!important;left:-10000px!important;top:0!important;visibility:hidden!important;pointer-events:none!important;white-space:nowrap!important;contain:layout style!important;margin:0!important;padding:0!important;border:0!important';
        const probes = [];
        for (const [key, { text, ps }] of samples) {
            const line = document.createElement('div');
            const span = document.createElement('span');
            const probe = document.createElement('span');
            for (const [prop, value] of [['font-style', ps.fontStyle], ['font-weight', ps.fontWeight], ['font-size', ps.fontSize], ['font-family', ps.fontFamily], ['line-height', ps.lineHeight], ['letter-spacing', ps.letterSpacing], ['padding', '0'], ['margin', '0'], ['border', '0'], ['display', 'inline'], ['vertical-align', 'baseline']]) span.style.setProperty(prop, value, 'important');
            line.style.setProperty('line-height', ps.lineHeight, 'important');
            probe.style.cssText = 'display:inline-block!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;vertical-align:baseline!important';
            const node = document.createTextNode(text);
            span.append(node, probe); line.append(span); box.append(line);
            probes.push([key, node, probe]);
        }
        document.body.append(box);
        for (const [key, node, probe] of probes) {
            const range = document.createRange(); range.selectNodeContents(node);
            const rect = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0);
            const y = probe.getBoundingClientRect().bottom;
            out.set(key, rect && Number.isFinite(y) ? y - rect.top : null);
        }
    } catch { /* 재기 실패 → 글꼴 표(fontBoundingBoxAscent)로 */ }
    finally { try { box?.remove?.(); } catch {} }
    return out;
}

function restore(el) {
    const old = saved.get(el);
    if (!old) return;
    for (const [prop, value, priority] of old) {
        if (value) el.style.setProperty(prop, value, priority); else el.style.removeProperty(prop);
    }
    saved.delete(el);
}

// 7.8.5: 읽기 → (모르는 기준선만 한 번에 재기) → 쓰기 순서로 묶는다. 두 번째 · 세 번째 바퀴는 앞 바퀴에서 고친 단추만 다시 본다
// (padding 위아래 합은 그대로라 다른 단추 자리는 안 바뀐다).
function readControl(el) {
    // Picture choices, switches and mixed icon labels have their own layout contracts.
    if (el.closest('.salty-preview, .salty-sample, .salty-shapes, [data-bl-native-ext-colors]') || el.matches('.bl-md-choice, .bl-editor-group-toggle, .bl-editor-choose')) return null;
    // 7.9.9: 글자 없는 절대 위치 꺾쇠(과일 고르기 단추의 <i>: 글자 크기 0 · 배경 그림)는 글자 줄에 끼지 않으니 섞인 아이콘으로 보지 않는다
    for (const extra of el.querySelectorAll('i, svg, img, canvas, input, button, [class*="fa-"]')) {
        if (extra.tagName !== 'I' || extra.children.length) return null;
        const es = getComputedStyle(extra);
        if (es.position !== 'absolute' || parseFloat(es.fontSize) !== 0) return null;
    }
    const text = el.textContent.trim();
    if (!text || text.length > 80 || !/[\p{L}\p{N}]/u.test(text)) return null;
    const box = el.getBoundingClientRect(), style = getComputedStyle(el);
    if (box.width < 1 || box.height < 1 || box.height > 64 || style.visibility === 'hidden' || style.writingMode !== 'horizontal-tb') return null;
    if (['::before', '::after'].some(p => { const s = getComputedStyle(el, p); return s.position !== 'absolute' && s.content && !['none', 'normal', '""'].includes(s.content); })) return null;
    const runs = [];
    let line = null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        if (!rects.length && parseFloat(getComputedStyle(node.parentElement).fontSize) === 0) continue;   // 글자 크기 0 꺾쇠의 글자(▾)는 보이지 않는다
        if (rects.length !== 1) return null;
        const rect = rects[0];
        if (line !== null && Math.abs(rect.top - line) > 2) return null;
        line = rect.top;
        const ps = getComputedStyle(node.parentElement);
        const measure = ink(node.textContent.replace(/\s+/g, ' '), ps);
        if (!measure) continue;
        // 7.8.2: 기준선은 글꼴 표(fontBoundingBoxAscent)로 추정하지 않고 화면에서 직접 잰다 — 안드로이드는 같은 글꼴 파일의
        // ascent 를 윈도우와 다른 표에서 읽어, 추정 기준선이 1~1.5px 어긋나 폰에서만 글자가 아래로 처져 보였다(사용자 폰 사진 10-23).
        // 같은 글꼴 · 크기 · 줄 높이면 줄 위 → 기준선 거리가 같으니 한 번만 잰다
        const bkey = `${ps.fontStyle} ${ps.fontWeight} ${ps.fontSize} ${ps.fontFamily}|${ps.lineHeight}`;
        runs.push({ rect, measure, bkey, text: node.textContent, ps });
    }
    if (!runs.length) return null;
    // 계산 스타일은 살아 있는 객체라 나중에 읽으면 그때 다시 계산한다(기준선 재기 뒤 shiftOf 에서 한 번 더 났다) — 지금 값을 떠 둔다
    const face = { borderTopWidth: style.borderTopWidth, borderBottomWidth: style.borderBottomWidth, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom };
    return { el, box, style: face, runs };
}

function shiftOf(item) {
    let top = Infinity, bottom = -Infinity;
    for (const { rect, measure, bkey } of item.runs) {
        const off = baselineCache.get(bkey);
        const base = off === null || off === undefined ? Math.round(rect.top + measure.ascent) : rect.top + off;
        top = Math.min(top, base + measure.top); bottom = Math.max(bottom, base + measure.bottom);
    }
    if (!Number.isFinite(top)) return null;
    const { box, style } = item;
    const faceTop = box.top + parseFloat(style.borderTopWidth);
    const faceBottom = box.bottom - parseFloat(style.borderBottomWidth);
    const shift = (faceTop + faceBottom - top - bottom) / 2;
    const pt = parseFloat(style.paddingTop), pb = parseFloat(style.paddingBottom);
    if (Math.abs(shift) <= .5 || Math.abs(shift) > 4 || pt + shift < 0 || pb - shift < 0) return null;
    return [pt + shift, pb - shift];
}

// 이번 프레임에 맞출 창을 한꺼번에: 모든 창의 되돌리기(쓰기) → 모든 단추 읽기 → 모르는 기준선 한 번에 재기 → 모든 쓰기.
// 창마다 따로 돌면 창 수만큼 읽기 · 쓰기가 번갈아 화면 다시 계산이 그만큼 늘었다(서랍 안 창 8개 → 20번 남짓)
function alignRoots(roots) {
    let controls = [];
    for (const root of roots) {
        if (!root.getClientRects().length || (root.checkVisibility && !root.checkVisibility({ checkVisibilityCSS: true }))) continue;
        if (!rootFonts.has(root)) rootFonts.set(root, new Set());
        for (const el of root.querySelectorAll(BUTTONS)) controls.push([root, el]);
    }
    for (const [, el] of controls) restore(el);
    for (let pass = 0; pass < 3 && controls.length; pass++) {
        // 1) 읽기만
        const items = [];
        const missing = new Map();
        for (const [root, el] of controls) {
            const item = readControl(el);
            if (!item) continue;
            item.root = root;
            items.push(item);
            for (const run of item.runs) if (!baselineCache.has(run.bkey) && !missing.has(run.bkey)) missing.set(run.bkey, { text: run.text, ps: run.ps });
            noteFonts(root, item.runs);
        }
        // 2) 모르는 기준선만 한 번에 (붙였다 떼는 것 1번 — 숨은 줄은 다른 자리를 안 움직여서 위에서 읽은 값을 그대로 쓴다)
        if (missing.size) {
            const got = measureBaselines(missing);
            for (const key of missing.keys()) baselineCache.set(key, got.has(key) ? got.get(key) : null);
        }
        // 3) 쓰기만
        const writes = [];
        for (const item of items) { const w = shiftOf(item); if (w) writes.push([item.root, item.el, w[0], w[1]]); }
        for (const [, el, top, bottom] of writes) {
            if (!saved.has(el)) saved.set(el, ['padding-top', 'padding-bottom'].map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]));
            el.style.setProperty('padding-top', `${top}px`, 'important');
            el.style.setProperty('padding-bottom', `${bottom}px`, 'important');
        }
        controls = writes.map(w => [w[0], w[1]]);
    }
}

// 7.8.5: 글꼴이 받아질 때(loadingdone) 다시 맞출 창을 줄인다 — 창마다 단추가 쓰는 글꼴 이름을 기억해 두고,
// 받아진 글꼴을 쓰는 창 중 지금 보이는 것만 (예전에는 ROOTS 전부를 다시 맞춰 #pt-panel · #lv_settings 를 매번 다시 쟀다)
const rootFonts = new WeakMap();
function noteFonts(root, runs) {
    let set = rootFonts.get(root);
    if (!set) rootFonts.set(root, set = new Set());
    for (const run of runs) set.add(run.ps.fontFamily);
}
const familyOf = face => String(face?.family || '').replace(/^["']|["']$/g, '').trim().toLowerCase();
function usesLoaded(root, families) {
    const set = rootFonts.get(root);
    if (!set) return true;   // 아직 맞춘 적 없는 창 — 보이면 맞춘다
    for (const list of set) { const low = list.toLowerCase(); for (const f of families) if (low.includes(f)) return true; }
    return false;
}
function onFontsLoaded(event) {
    const families = [...(event?.fontfaces || [])].map(familyOf).filter(Boolean);
    if (families.length) {
        for (const key of [...metrics.keys()]) if (families.some(f => key.toLowerCase().includes(f))) metrics.delete(key);
        for (const key of [...baselineCache.keys()]) if (families.some(f => key.toLowerCase().includes(f))) baselineCache.delete(key);
    } else { metrics.clear(); baselineCache.clear(); }
    const roots = [...document.querySelectorAll(ROOTS)];
    for (const root of roots) {
        // 보이는지는 다음 프레임 alignRoots 가 한 번에 본다(여기서 읽으면 글꼴 이벤트마다 화면 다시 계산이 한 번 더 난다)
        // 맞춘 적 없는 창이 이미 맞춘 바깥 창 안에 있으면 그 바깥 창 기준(바깥 창을 맞출 때 안쪽 단추도 같이 쟀다)
        const owner = rootFonts.has(root) ? root : roots.find(r => r !== root && rootFonts.has(r) && r.contains(root)) || root;
        if (!families.length || usesLoaded(owner, families)) queue(root);
    }
}

function watch() {
    observer.observe(document.body, WATCH);
    // 7.9.9: 과일의 마음 창은 body 밖(html 의 자식)이라 body 감시로는 안 보인다 → html 바로 아래의 추가 · 삭제와, 거기 있는 창 안쪽을 따로 본다(head 안 변화는 안 본다)
    const html = document.documentElement;
    if (!html) return;
    observer.observe(html, { childList: true });
    for (const root of html.children) if (root !== document.body && root.nodeType === 1 && root.matches?.(ROOTS)) observer.observe(root, WATCH);
}

function queue(root) {
    if (!enabled || !root) return;
    for (const parent of pending) if (parent.contains(root)) return;
    for (const child of pending) if (root.contains(child)) pending.delete(child);
    pending.add(root);
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0; observer.disconnect();
        alignRoots([...pending].filter(el => el.isConnected));
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
        document.fonts?.addEventListener('loadingdone', onFontsLoaded);
        window.addEventListener('resize', () => document.querySelectorAll(ROOTS).forEach(queue), { passive: true });   // 안 보이는 창은 alignRoots 가 건너뜀
        watch();
    }
    if (!enabled) {
        cancelAnimationFrame(frame); frame = 0; pending.clear(); observer.disconnect();
        document.querySelectorAll(ROOTS).forEach(root => root.querySelectorAll(BUTTONS).forEach(restore));
        return;
    }
    watch(); document.querySelectorAll(ROOTS).forEach(queue);
}
