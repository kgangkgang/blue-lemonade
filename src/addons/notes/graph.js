// 연결 보기 — 메모끼리 [[연결]] · #태그 를 점과 선으로 (옵시디언 그래프처럼). 캔버스 한 장 + 힘 배치.
// 점을 누르면 그 메모로, 끌면 점이 움직이고, 빈 곳을 끌면 화면 이동 · 휠 / 두 손가락으로 확대.
const TITLE = '연결 보기';
let current = null;

/** 어떤 CSS 색이든(var · color-mix 포함) [r, g, b, a] 로 — 1px 캔버스에 칠해서 읽는다 */
function rgba(host, expr) {
    const probe = document.createElement('span'); probe.style.color = expr; probe.style.display = 'none'; host.append(probe);
    const css = getComputedStyle(probe).color; probe.remove();
    const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#888'; x.fillStyle = css; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
}
const paint = ([r, g, b, a], alpha = 1) => `rgba(${r},${g},${b},${(a * alpha).toFixed(3)})`;

/**
 * build(withTags) → { nodes:[{id,label,color,kind:'note'|'tag',tag?}], edges:[[a,b]] }
 * onPick(noteId) · onTag(tag): 창을 닫은 뒤 부른다
 */
export function openGraph({ build, onPick, onTag, withTags = false }) {
    if (current?.open) return current;
    const d = document.createElement('dialog');
    d.className = 'bl-notes-dialog bl-notes-graph'; d.setAttribute('aria-label', TITLE);
    d.innerHTML = `<header><b><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${TITLE} <small class="bl-notes-count"></small></b><div class="bl-notes-head-tools"><button type="button" class="bl-note-btn" data-g="tags" title="태그도 점으로" aria-label="태그도 점으로" aria-pressed="false"><i class="fa-solid fa-hashtag"></i></button><button type="button" class="bl-note-btn" data-g="fit" title="한눈에 맞추기" aria-label="한눈에 맞추기"><i class="fa-solid fa-expand"></i></button><button type="button" class="bl-note-btn" data-g="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></div></header><div class="bl-graph-stage"><canvas></canvas><p class="bl-graph-empty" hidden></p></div>`;
    document.body.append(d); current = d;
    const stage = d.querySelector('.bl-graph-stage'), canvas = d.querySelector('canvas'), ctx = canvas.getContext('2d'), empty = d.querySelector('.bl-graph-empty');
    let tags = withTags, nodes = [], edges = [], byId = new Map(), near = new Map(), alpha = 1, raf = 0, W = 0, H = 0, dpr = 1;
    const cam = { x: 0, y: 0, s: 1 }; let autoFit = true, hover = null, drag = null, pan = null, pinch = null, downAt = null;
    const pts = new Map();
    let C = {};
    const readColors = () => { C = { accent: rgba(d, 'var(--bl-notes-accent)'), text: rgba(d, 'var(--bl-notes-text)'), muted: rgba(d, 'var(--bl-notes-muted)'), tag: rgba(d, 'var(--salty-marker, #e6c23a)') }; };

    function load() {
        const data = build(tags), old = byId;
        nodes = data.nodes.map((n, i) => { const o = old.get(n.id); const a = i * 2.39996, r = 14 * Math.sqrt(i + 1); return { ...n, x: o?.x ?? Math.cos(a) * r, y: o?.y ?? Math.sin(a) * r, vx: 0, vy: 0, deg: 0 }; });
        byId = new Map(nodes.map(n => [n.id, n]));
        edges = data.edges.map(([a, b]) => [byId.get(a), byId.get(b)]).filter(([a, b]) => a && b);
        near = new Map(nodes.map(n => [n.id, new Set()]));
        for (const [a, b] of edges) { a.deg++; b.deg++; near.get(a.id).add(b.id); near.get(b.id).add(a.id); }
        const notes = nodes.filter(n => n.kind === 'note').length, links = edges.filter(([a, b]) => a.kind === 'note' && b.kind === 'note').length;
        d.querySelector('.bl-notes-count').textContent = notes ? `${notes} · 연결 ${links}` : '';
        empty.hidden = notes > 0; empty.textContent = '보이는 메모가 없어요.'; empty.classList.remove('is-hint');
        if (notes && !links && !tags) { empty.hidden = false; empty.textContent = '아직 연결이 없어요. 내용에 [[메모 제목]] 을 적으면 선으로 이어져요.'; empty.classList.add('is-hint'); }
        const tb = d.querySelector('[data-g="tags"]'); tb.classList.toggle('is-on', tags); tb.setAttribute('aria-pressed', String(tags));
        alpha = 1; autoFit = true; kick();
    }
    const radius = n => n.kind === 'tag' ? 4 : 5 + Math.min(10, Math.sqrt(n.deg) * 2.4);

    function tick() {
        const k = alpha, n = nodes.length;
        for (let i = 0; i < n; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < n; j++) {
                const b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                if (d2 > 250000) continue;
                if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
                const dist = Math.sqrt(d2), f = Math.min(12, 1600 / d2) * k; dx /= dist; dy /= dist;
                a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
            }
        }
        for (const [a, b] of edges) {
            const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1, len = a.kind === 'tag' || b.kind === 'tag' ? 55 : 85;
            const f = (dist - len) * 0.04 * k, fx = dx / dist * f, fy = dy / dist * f;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        for (const a of nodes) {
            if (drag?.node === a) { a.vx = a.vy = 0; continue; }
            a.vx -= a.x * 0.012 * k; a.vy -= a.y * 0.012 * k;
            a.vx *= 0.82; a.vy *= 0.82; a.x += a.vx; a.y += a.vy;
        }
        alpha = Math.max(0, alpha * 0.985 - 0.0004);
    }
    function fit() {
        if (!nodes.length || !W) return;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
        const s = Math.min(2, (W - 60) / Math.max(40, x1 - x0), (H - 70) / Math.max(40, y1 - y0));
        cam.s = s; cam.x = W / 2 - (x0 + x1) / 2 * s; cam.y = H / 2 - (y0 + y1) / 2 * s;
    }
    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(cam.s, cam.s);
        const focus = hover || drag?.node || null, ring = focus ? near.get(focus.id) : null;
        const lit = n => !focus || n === focus || ring.has(n.id);
        ctx.lineWidth = 1.2 / cam.s;
        for (const [a, b] of edges) {
            const on = focus && (a === focus || b === focus);
            ctx.strokeStyle = on ? paint(C.accent, 0.85) : paint(C.muted, focus ? 0.12 : 0.4);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        const showAll = cam.s >= 0.8 || nodes.length <= 24;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `${12 / cam.s}px system-ui, sans-serif`;
        for (const n of nodes) {
            const r = radius(n), on = lit(n);
            ctx.globalAlpha = on ? 1 : 0.22;
            ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = n.kind === 'tag' ? paint(C.tag) : (n.color || paint(C.accent)); ctx.fill();
            if (n === focus) { ctx.lineWidth = 2.5 / cam.s; ctx.strokeStyle = paint(C.text, 0.9); ctx.stroke(); }
            if (showAll || n === focus || (ring && ring.has(n.id)) || n.deg >= 3) {
                ctx.fillStyle = paint(n.kind === 'tag' ? C.muted : C.text, on ? 0.95 : 0.4);
                const label = n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label;
                ctx.fillText(label, n.x, n.y + r + 3 / cam.s);
            }
        }
        ctx.globalAlpha = 1; ctx.restore();
    }
    function frame() {
        raf = 0;
        if (alpha > 0.004) { tick(); tick(); }
        if (autoFit) fit();
        draw();
        if (alpha > 0.004 || drag) raf = requestAnimationFrame(frame);
    }
    function kick(heat = 0) { if (heat) alpha = Math.max(alpha, heat); if (!raf) raf = requestAnimationFrame(frame); }
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const world = p => ({ x: (p.x - cam.x) / cam.s, y: (p.y - cam.y) / cam.s });
    function nodeAt(p) {
        const w = world(p); let best = null, bestD = Infinity;
        for (const n of nodes) { const dd = Math.hypot(n.x - w.x, n.y - w.y); if (dd <= radius(n) + 8 / cam.s && dd < bestD) { best = n; bestD = dd; } }
        return best;
    }
    const zoomAt = (p, s) => { const w = world(p); cam.s = Math.max(0.15, Math.min(4, s)); cam.x = p.x - w.x * cam.s; cam.y = p.y - w.y * cam.s; };
    canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e)); autoFit = false;
        if (pts.size === 2) {
            drag = null; pan = null; downAt = null;
            const [a, b] = [...pts.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: cam.s, w: world(mid) };
            return;
        }
        const p = pos(e), hit = nodeAt(p); downAt = { ...p, t: Date.now(), node: hit };
        if (hit) { drag = { node: hit, moved: false }; kick(0.25); } else pan = { x: p.x, y: p.y, cx: cam.x, cy: cam.y };
    });
    canvas.addEventListener('pointermove', e => {
        const p = pos(e);
        if (!pts.has(e.pointerId)) { const h = nodeAt(p); if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : 'grab'; kick(); } return; }
        pts.set(e.pointerId, p);
        if (pinch && pts.size >= 2) {
            const [a, b] = [...pts.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            cam.s = Math.max(0.15, Math.min(4, pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.dist));
            cam.x = mid.x - pinch.w.x * cam.s; cam.y = mid.y - pinch.w.y * cam.s; kick(); return;
        }
        if (drag) { const w = world(p); drag.node.x = w.x; drag.node.y = w.y; if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 5) drag.moved = true; kick(0.2); }
        else if (pan) { cam.x = pan.cx + p.x - pan.x; cam.y = pan.cy + p.y - pan.y; kick(); }
    });
    const release = e => {
        pts.delete(e.pointerId);
        if (pinch) { if (pts.size < 2) pinch = null; pan = null; drag = null; return; }
        if (drag) {
            const n = drag.node, moved = drag.moved; drag = null;
            if (!moved && downAt?.node === n && Date.now() - downAt.t < 600) { d.close(); if (n.kind === 'tag') onTag?.(n.tag); else onPick?.(n.id); return; }
        }
        pan = null; kick();
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => { if (hover && !pts.size) { hover = null; kick(); } });
    canvas.addEventListener('wheel', e => { e.preventDefault(); autoFit = false; zoomAt(pos(e), cam.s * Math.exp(-e.deltaY * 0.0015)); kick(); }, { passive: false });
    d.addEventListener('click', e => {
        const g = e.target.closest('[data-g]')?.dataset.g;
        if (g === 'close') d.close();
        else if (g === 'tags') { tags = !tags; load(); }
        else if (g === 'fit') { autoFit = true; kick(0.05); }
    });
    const size = () => { const r = stage.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; kick(); };
    const ro = new ResizeObserver(size);
    d.addEventListener('close', () => { ro.disconnect(); cancelAnimationFrame(raf); raf = 0; d.remove(); if (current === d) current = null; }, { once: true });
    d.showModal(); readColors(); ro.observe(stage); size(); load();
    return d;
}
