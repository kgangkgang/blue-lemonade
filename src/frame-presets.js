// Static artwork: draw only when a preset or its design parameters change.
// Dimensions are laid out afresh; circles, toolbar controls and paper details
// keep their proportions when the photo window becomes wide or tall.
export const FRAME_PRESETS = [
    ['watercolor', '물든 수채화'], ['browser', '맥 브라우저'],
    ['scrapbook', '스크랩 다이어리'], ['ribbon', '리본 포스트'],
    ['pop', '겹친 메모지'], ['notebook', '낙서 노트'],
];
const palettes = {
    watercolor: ['#8cadd0', '#e7a4b6'], browser: ['#dce3ed', '#65788e'],
    scrapbook: ['#eadfcf', '#899f83'], ribbon: ['#f4dce4', '#b86684'],
    pop: ['#faf4e7', '#a9c4c3'], notebook: ['#f4eedc', '#527bba'],
};
export const presetColors = id => palettes[id] || palettes.watercolor;
const cache = new Map();
const thumbnails = new Map();
export function drawPreset(id, options = {}) {
    if (!palettes[id]) throw new Error('알 수 없는 액자예요.');
    const color = /^#[a-f\d]{6}$/i.test(options.presetColor) ? options.presetColor : palettes[id][0];
    const accent = /^#[a-f\d]{6}$/i.test(options.presetAccent) ? options.presetAccent : palettes[id][1];
    const bound = v => Math.max(50, Math.min(200, Number(v) || 100));
    const frameWidth = bound(options.frameWidth), frameHeight = bound(options.frameHeight);
    const key = [id, color, accent, frameWidth, frameHeight].join('/');
    // Keep the six picker thumbnails out of the edit cache so changing several
    // owners cannot evict them and redraw all six whenever the panel reopens.
    const standard = color === palettes[id][0] && accent === palettes[id][1] && frameWidth === 100 && frameHeight === 100;
    const store = standard ? thumbnails : cache;
    if (store.has(key)) return { ...store.get(key) };
    const baseWidth = id === 'watercolor' ? 420 : 360, baseHeight = id === 'watercolor' ? 420 : 480;
    const w = Math.round(baseWidth * frameWidth / 100), h = Math.round(baseHeight * frameHeight / 100);
    const art = document.createElement('canvas'), mask = document.createElement('canvas');
    art.width = mask.width = w; art.height = mask.height = h;
    const c = art.getContext('2d'), m = mask.getContext('2d');
    if (!c || !m) throw new Error('액자 그림을 만들 수 없어요.');
    let seed = 15439;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const round = (ctx, x, y, width, height, radius, fill) => {
        ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); fill ? ctx.fill() : ctx.stroke();
    };
    const line = (x, y, x2, y2) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
    const star = (x, y, r, fill) => {
        c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, n = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * n, y + Math.sin(a) * n); }
        c.closePath(); c.fillStyle = fill; c.fill();
    };
    let window = [27, 27, w - 54, h - 54, 8], customMask = false;
    const overlays = [];
    c.lineJoin = c.lineCap = 'round';
    if (id === 'watercolor') {
        customMask = true;
        const points = Array.from({ length: 160 }, (_, i) => {
            const angle = i * Math.PI * 2 / 160;
            const r = .84 + .065 * Math.sin(angle * 3 + .9) + .05 * Math.cos(angle * 7) + .025 * Math.sin(angle * 17) + (random() - .5) * .04;
            return [Math.cos(angle) * (w / 2 - 9) * r, Math.sin(angle) * (h / 2 - 9) * r];
        });
        const blot = (ctx, scale) => { ctx.beginPath(); for (const [x, y] of points) ctx.lineTo(w / 2 + x * scale, h / 2 + y * scale); ctx.closePath(); ctx.fill(); };
        // Broad, translucent washes instead of a hard cut-out with a thin rim.
        m.fillStyle = '#fff'; blot(m, .62);
        for (let i = 0; i < 48; i++) { m.globalAlpha = .065; blot(m, .62 + i * .009); }
        m.globalAlpha = 1;
        // Dry-brush scratches follow the edge, keeping faces in the center clear.
        m.globalCompositeOperation = 'destination-out'; m.strokeStyle = '#000';
        for (let i = 0; i < 100; i++) {
            const [x, y] = points[Math.floor(random() * points.length)], reach = .73 + random() * .22;
            m.globalAlpha = .08 + random() * .28; m.lineWidth = .3 + random() * 1.8;
            m.beginPath(); m.moveTo(w / 2 + x * reach, h / 2 + y * reach); m.lineTo(w / 2 + x * 1.035 + (random() - .5) * 9, h / 2 + y * 1.035); m.stroke();
        }
        m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
        const wash = c.createLinearGradient(0, 0, w, h); wash.addColorStop(0, color); wash.addColorStop(1, accent);
        c.fillStyle = wash;
        for (let i = 0; i < 30; i++) { c.globalAlpha = .018; blot(c, .68 + i * .014); }
        // Pigment diffuses into the translucent perimeter without a solid outline.
        c.globalAlpha = 1; c.globalCompositeOperation = 'destination-out'; c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-over';
    } else if (id === 'browser') {
        window = [12, 48, w - 24, h - 60, 9];
        c.fillStyle = color; round(c, 7, 7, w - 14, h - 14, 15, true);
        const shine = c.createLinearGradient(0, 7, 0, h); shine.addColorStop(0, '#ffffff70'); shine.addColorStop(1, '#ffffff00');
        c.fillStyle = shine; round(c, 7, 7, w - 14, h - 14, 15, true);
        c.strokeStyle = accent + '60'; c.lineWidth = .8; round(c, 7.5, 7.5, w - 15, h - 15, 15, false);
        for (const [i, tint] of ['#e99a96', '#e4c281', '#9abfa0'].entries()) { c.fillStyle = tint; c.beginPath(); c.arc(22 + i * 13, 27, 3.5, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#ffffff70'; round(c, 74, 18, w - 95, 19, 5, true);
        c.strokeStyle = accent + '25'; c.lineWidth = .6; round(c, 74, 18, w - 95, 19, 5, false);
        c.strokeStyle = accent + '80'; c.lineWidth = 1;
        const x = (w + 53) / 2; round(c, x - 2.5, 26, 5, 4, 1, false); c.beginPath(); c.arc(x, 26, 1.8, Math.PI, 0); c.stroke();
        c.strokeStyle = accent + '20'; line(8, 42, w - 8, 42);
    } else if (id === 'scrapbook') {
        window = [30, 38, w - 60, h - 95, 2];
        c.fillStyle = color; c.beginPath();
        for (let x = 8; x <= w - 8; x += 5) c.lineTo(x, 14 + random() * 4);
        for (let y = 15; y <= h - 12; y += 5) c.lineTo(w - 10 + random() * 4, y);
        for (let x = w - 9; x >= 8; x -= 5) c.lineTo(x, h - 13 + random() * 5);
        c.closePath(); c.fill();
        for (const [x, y, a] of [[50, 25, -.21], [w - 49, h - 29, -.17]]) {
            c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = accent + 'b0'; c.fillRect(-37, -9, 74, 18);
            c.strokeStyle = '#ffffff55'; c.lineWidth = 2; for (let j = -30; j < 40; j += 10) line(j, -9, j - 10, 9); c.restore();
        }

    } else if (id === 'ribbon') {
        window = [30, 43, w - 60, h - 77, 12];
        c.fillStyle = color; round(c, 15, 22, w - 30, h - 37, 20, true);
        c.strokeStyle = accent; c.lineWidth = 1; c.setLineDash([2, 5]); round(c, 22, 29, w - 44, h - 51, 16, false); c.setLineDash([]);
        overlays.push(() => {
        const x = w / 2; c.fillStyle = accent;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, 25); c.bezierCurveTo(x + s * 64, -6, x + s * 55, 48, x, 25); c.fill(); c.beginPath(); c.moveTo(x + s * 4, 28); c.lineTo(x + s * 26, 62); c.lineTo(x + s * 9, 53); c.lineTo(x, 32); c.fill(); }
        c.fillStyle = color; c.beginPath(); c.arc(x, 25, 4, 0, Math.PI * 2); c.fill();
        });
    } else if (id === 'pop') {
        customMask = true;
        const tilt = (ctx, angle, draw) => { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(angle); ctx.translate(-w / 2, -h / 2); draw(); ctx.restore(); };
        tilt(c, .045, () => { c.fillStyle = accent; round(c, 21, 23, w - 40, h - 44, 3, true); });
        tilt(c, -.032, () => {
            c.fillStyle = '#313a4015'; round(c, 20, 23, w - 47, h - 49, 3, true);
            c.fillStyle = color; round(c, 16, 18, w - 47, h - 49, 3, true);
            c.strokeStyle = '#75695930'; c.lineWidth = .7; round(c, 16, 18, w - 47, h - 49, 3, false);
        });
        m.fillStyle = '#fff'; tilt(m, -.032, () => round(m, 29, 31, w - 73, h - 83, 1, true));
        overlays.push(() => {
            star(w - 47, 39, 19, '#fffdf6'); star(w - 47, 39, 14, accent);
            star(28, h - 45, 12, '#fffdf6'); star(28, h - 45, 8, accent);
        });
    } else {
        window = [41, 34, w - 66, h - 72, 2];
        c.fillStyle = color; round(c, 16, 10, w - 27, h - 20, 6, true);
        c.strokeStyle = accent + '38'; c.lineWidth = 1;
        for (let y = 25; y < h - 10; y += 18) line(18, y, w - 13, y);
        c.strokeStyle = accent + '70'; line(36, 11, 36, h - 11);
        for (let y = 34; y < h - 16; y += 30) { c.strokeStyle = accent; c.lineWidth = 2; c.beginPath(); c.ellipse(18, y, 9, 4, -.2, .2, Math.PI * 1.8); c.stroke(); }
        overlays.push(() => {
            c.save(); c.translate(w - 27, h - 23); c.rotate(-.38);
            c.fillStyle = '#fffdf5'; c.beginPath(); c.ellipse(0, 0, 24, 17, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#eac747'; c.beginPath(); c.moveTo(-20, 0); c.bezierCurveTo(-15, -21, 15, -21, 20, 0); c.bezierCurveTo(15, 20, -15, 20, -20, 0); c.fill();
            c.strokeStyle = '#fff6b4'; c.lineWidth = 2; c.beginPath(); c.arc(-1, 0, 10, Math.PI, Math.PI * 1.6); c.stroke();
            c.fillStyle = accent; c.beginPath(); c.ellipse(15, -12, 8, 3.5, -.6, 0, Math.PI * 2); c.fill(); c.restore();
        });
    }
    if (!customMask) { m.fillStyle = '#fff'; round(m, ...window.slice(0, 4), window[4], true); }
    // The interior stays transparent: never paint over the user's photograph.
    if (id !== 'watercolor') { c.globalCompositeOperation = 'destination-out'; c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-over'; }
    for (const draw of overlays) draw();
    const result = { on: true, art: art.toDataURL('image/png'), mask: mask.toDataURL('image/png'), ratio: baseWidth / baseHeight,
        presetVersion: 3, presetId: id, presetColor: color, presetAccent: accent, frameWidth, frameHeight,
        radius: 0, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover' };
    // Bounded cache: slider/color edits cannot retain an unlimited set of PNGs.
    if (!standard && cache.size >= 8) cache.delete(cache.keys().next().value);
    store.set(key, result); art.width = mask.width = 1; return { ...result };
}
