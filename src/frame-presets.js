// Static artwork: draw only when a preset or its design parameters change.
// Dimensions are laid out afresh; circles, toolbar controls and paper details
// keep their proportions when the photo window becomes wide or tall.
export const FRAME_PRESETS = [
    ['watercolor', '물든 수채화'], ['browser', '맥 브라우저'],
    ['scrapbook', '스크랩 다이어리'], ['ribbon', '리본 포스트'],
    ['pop', '팝 스타'], ['notebook', '낙서 노트'],
];
const palettes = {
    watercolor: ['#8cadd0', '#e7a4b6'], browser: ['#dce3ed', '#65788e'],
    scrapbook: ['#eadfcf', '#899f83'], ribbon: ['#f4dce4', '#b86684'],
    pop: ['#c4b7f0', '#ffca60'], notebook: ['#f4eedc', '#527bba'],
};
export const presetColors = id => palettes[id] || palettes.watercolor;
const cache = new Map();
export function drawPreset(id, options = {}) {
    if (!palettes[id]) throw new Error('알 수 없는 액자예요.');
    const color = /^#[a-f\d]{6}$/i.test(options.presetColor) ? options.presetColor : palettes[id][0];
    const accent = /^#[a-f\d]{6}$/i.test(options.presetAccent) ? options.presetAccent : palettes[id][1];
    const bound = v => Math.max(50, Math.min(200, Number(v) || 100));
    const frameWidth = bound(options.frameWidth), frameHeight = bound(options.frameHeight);
    const key = [id, color, accent, frameWidth, frameHeight].join('/');
    if (cache.has(key)) return { ...cache.get(key) };
    const w = Math.round(360 * frameWidth / 100), h = Math.round(480 * frameHeight / 100);
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
    let window = [27, 27, w - 54, h - 54, 8];
    c.lineJoin = c.lineCap = 'round';
    if (id === 'watercolor') {
        window = [30, 30, w - 60, h - 60, 12];
        // Layered translucent pigment, granulation and irregular wet edges.
        for (let i = 0; i < 340; i++) {
            const side = i % 4, t = random(), jitter = (random() - .5) * 15;
            const x = side < 2 ? 21 + t * (w - 42) : side === 2 ? 22 + jitter : w - 22 + jitter;
            const y = side >= 2 ? 21 + t * (h - 42) : side === 0 ? 22 + jitter : h - 22 + jitter;
            c.fillStyle = random() < .6 ? color : accent; c.globalAlpha = .025 + random() * .045;
            c.beginPath(); c.ellipse(x, y, 7 + random() * 17, 6 + random() * 17, random() * 3, 0, Math.PI * 2); c.fill();
        }
        for (let i = 0; i < 550; i++) {
            const x = random() * w, y = random() * h;
            if (x > 39 && x < w - 39 && y > 39 && y < h - 39) continue;
            c.globalAlpha = .05 + random() * .17; c.fillStyle = random() < .5 ? color : accent;
            c.beginPath(); c.arc(x, y, .3 + random() * 1.4, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
    } else if (id === 'browser') {
        window = [14, 62, w - 28, h - 77, 9];
        c.fillStyle = color; round(c, 6, 6, w - 12, h - 12, 18, true);
        c.strokeStyle = accent + '70'; c.lineWidth = 1; round(c, 6.5, 6.5, w - 13, h - 13, 18, false);
        for (const [i, tint] of ['#ef7974', '#e9bd5c', '#79bc8e'].entries()) { c.fillStyle = tint; c.beginPath(); c.arc(24 + i * 16, 30, 4.5, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#ffffff80'; round(c, 80, 20, w - 102, 21, 6, true);
        c.fillStyle = accent; c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText('your little world', (w + 58) / 2, 34, w - 118);
        c.strokeStyle = accent + '40'; line(7, 52, w - 7, 52);
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
        c.fillStyle = accent; c.font = 'italic 13px Georgia'; c.textAlign = 'center'; c.fillText('a moment to keep', w / 2, h - 32);
    } else if (id === 'ribbon') {
        window = [30, 43, w - 60, h - 77, 12];
        c.fillStyle = color; round(c, 15, 22, w - 30, h - 37, 20, true);
        c.strokeStyle = accent; c.lineWidth = 1; c.setLineDash([2, 5]); round(c, 22, 29, w - 44, h - 51, 16, false); c.setLineDash([]);
        const x = w / 2; c.fillStyle = accent;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, 25); c.bezierCurveTo(x + s * 64, -6, x + s * 55, 48, x, 25); c.fill(); c.beginPath(); c.moveTo(x + s * 4, 28); c.lineTo(x + s * 26, 62); c.lineTo(x + s * 9, 53); c.lineTo(x, 32); c.fill(); }
        c.fillStyle = color; c.beginPath(); c.arc(x, 25, 4, 0, Math.PI * 2); c.fill();
    } else if (id === 'pop') {
        window = [30, 31, w - 66, h - 66, 19];
        c.fillStyle = accent; round(c, 21, 22, w - 32, h - 33, 25, true);
        c.fillStyle = color; round(c, 9, 10, w - 32, h - 33, 25, true);
        c.strokeStyle = '#353348'; c.lineWidth = 2; round(c, 9, 10, w - 32, h - 33, 25, false);
        star(w - 38, 37, 29, '#fffaf1'); star(w - 38, 37, 22, accent);
        star(28, h - 39, 23, '#fffaf1'); star(28, h - 39, 17, accent);
        c.fillStyle = accent; c.beginPath(); c.arc(w - 38, h - 42, 16, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#353348'; c.lineWidth = 1.7; line(w - 44, h - 47, w - 44, h - 44); line(w - 33, h - 47, w - 33, h - 44);
        c.beginPath(); c.arc(w - 38, h - 42, 8, .15, Math.PI - .15); c.stroke();
    } else {
        window = [41, 34, w - 66, h - 72, 2];
        c.fillStyle = color; round(c, 16, 10, w - 27, h - 20, 6, true);
        c.strokeStyle = accent + '38'; c.lineWidth = 1;
        for (let y = 25; y < h - 10; y += 18) line(18, y, w - 13, y);
        c.strokeStyle = accent + '70'; line(36, 11, 36, h - 11);
        for (let y = 34; y < h - 16; y += 30) { c.strokeStyle = accent; c.lineWidth = 2; c.beginPath(); c.ellipse(18, y, 9, 4, -.2, .2, Math.PI * 1.8); c.stroke(); }
        c.strokeStyle = accent; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w - 53, h - 26); c.bezierCurveTo(w - 79, h - 43, w - 40, h - 51, w - 43, h - 33); c.bezierCurveTo(w - 28, h - 51, w - 13, h - 32, w - 53, h - 26); c.stroke();
        c.fillStyle = accent; c.font = 'italic 11px Georgia'; c.fillText('dear diary,', 44, 25);
    }
    m.fillStyle = '#fff'; round(m, ...window.slice(0, 4), window[4], true);
    // The interior stays transparent: never paint over the user's photograph.
    c.globalCompositeOperation = 'destination-out'; c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-over';
    const result = { on: true, art: art.toDataURL('image/png'), mask: mask.toDataURL('image/png'), ratio: .75,
        presetId: id, presetColor: color, presetAccent: accent, frameWidth, frameHeight,
        radius: 0, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover' };
    // Bounded cache: slider/color edits cannot retain an unlimited set of PNGs.
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(key, result); art.width = mask.width = 1; return { ...result };
}
