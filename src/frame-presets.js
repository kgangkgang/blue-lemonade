// Static artwork: draw only when a preset or its design parameters change.
// Dimensions are laid out afresh; circles, toolbar controls and paper details
// keep their proportions when the photo window becomes wide or tall.
export const FRAME_PRESETS = [
    ['watercolor', '물든 수채화'], ['browser', '맥 브라우저'],
    ['scrapbook', '스크랩 다이어리'], ['ribbon', '리본 포스트'],
    ['pop', '겹친 메모지'], ['notebook', '낙서 노트'],
];
export const FRAME_PRESET_VERSION = 5;
const palettes = {
    watercolor: ['#abc5db', '#dfbecb'], browser: ['#f2f5f8', '#8295ab'],
    scrapbook: ['#f5f0e7', '#a5b6a0'], ribbon: ['#fcf4f6', '#b8879b'],
    pop: ['#fffaf0', '#bbced0'], notebook: ['#faf8ee', '#849eb8'],
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
    // Crisp fine lines on dense phone screens; dimensions below stay logical.
    art.width = mask.width = w * 2; art.height = mask.height = h * 2;
    const c = art.getContext('2d'), m = mask.getContext('2d');
    if (!c || !m) throw new Error('액자 그림을 만들 수 없어요.');
    c.scale(2, 2); m.scale(2, 2);
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
    // The photograph and its frame share a silhouette, rather than sitting in
    // a rectangular hole. Corner decorations are drawn after the cut-out.
    const torn = (ctx, x, y, width, height, amount = 3) => {
        ctx.beginPath();
        const sides = [[x,y,width,0],[x+width,y,0,height],[x+width,y+height,-width,0],[x,y+height,0,-height]];
        for (const [sx,sy,dx,dy] of sides) {
            const count = Math.ceil(Math.hypot(dx,dy)/7);
            for (let i=0;i<count;i++) { const n=(random()-.5)*amount; ctx.lineTo(sx+dx*i/count+(dy?n:0),sy+dy*i/count+(dx?n:0)); }
        }
        ctx.closePath(); ctx.fill();
    };
    const tape = (x,y,angle,width=78) => {
        c.save();c.translate(x,y);c.rotate(angle);
        c.fillStyle=accent+'c9';torn(c,-width/2,-11,width,22,2);
        c.strokeStyle='#ffffff55';c.lineWidth=1;line(-width/2+5,-7,width/2-5,-7);c.restore();
    };
    c.lineJoin = c.lineCap = 'round';
    if (id === 'watercolor') {
        customMask = true;
        const points = Array.from({ length: 160 }, (_, i) => {
            const angle = i * Math.PI * 2 / 160;
            const r = .91 + .055 * Math.sin(angle * 3 + .9) + .035 * Math.cos(angle * 7) + .012 * Math.sin(angle * 17) + (random() - .5) * .018;
            const x = Math.cos(angle), y = Math.sin(angle);
            return [x * (w / 2 - 16) * r, y * (h / 2 - 16) * r];
        });
        const blot = (ctx, scale) => { ctx.beginPath(); for (const [x, y] of points) ctx.lineTo(w / 2 + x * scale, h / 2 + y * scale); ctx.closePath(); ctx.fill(); };
        // Broad, translucent washes instead of a hard cut-out with a thin rim.
        m.fillStyle = '#fff'; blot(m, .8);
        for (let i = 0; i < 40; i++) { m.globalAlpha = .09; blot(m, .8 + i * .0055); }
        m.globalAlpha = 1;
        // Dry-brush scratches follow the edge, keeping faces in the center clear.
        m.globalCompositeOperation = 'destination-out'; m.strokeStyle = '#000';
        for (let i = 0; i < 65; i++) {
            const [x, y] = points[Math.floor(random() * points.length)], reach = .94 + random() * .07;
            m.globalAlpha = .03 + random() * .1; m.lineWidth = .25 + random() * .55;
            m.beginPath(); m.moveTo(w / 2 + x * reach, h / 2 + y * reach); m.lineTo(w / 2 + x * 1.035 + (random() - .5) * 9, h / 2 + y * 1.035); m.stroke();
        }
        m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
        const wash = c.createLinearGradient(0, 0, w, h); wash.addColorStop(0, color); wash.addColorStop(1, accent);
        c.fillStyle = wash;
        for (let i = 0; i < 28; i++) { c.globalAlpha = .023; blot(c, .88 + i * .007); }
        // Pigment diffuses into the translucent perimeter without a solid outline.
        c.globalAlpha = 1; c.globalCompositeOperation = 'destination-out'; c.drawImage(mask, 0, 0, w, h); c.globalCompositeOperation = 'source-over';
    } else if (id === 'browser') {
        window = [12, 44, w - 24, h - 56, 24];
        c.fillStyle = color; round(c, 7, 7, w - 14, h - 14, 13, true);
        const shine = c.createLinearGradient(0, 7, 0, h); shine.addColorStop(0, '#ffffff70'); shine.addColorStop(1, '#ffffff00');
        c.fillStyle = shine; round(c, 7, 7, w - 14, h - 14, 15, true);
        c.strokeStyle = accent + '60'; c.lineWidth = .8; round(c, 7.5, 7.5, w - 15, h - 15, 15, false);
        for (const [i, tint] of ['#d9aaa7', '#ddd0a4', '#b4c7b6'].entries()) { c.fillStyle = tint; c.beginPath(); c.arc(22 + i * 11, 25, 2.6, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#ffffff90'; round(c, 66, 16, w - 86, 18, 6, true);
        c.strokeStyle = accent + '20'; c.lineWidth = .6; round(c, 66, 16, w - 86, 18, 6, false);
        c.strokeStyle = accent + '80'; c.lineWidth = 1;
        const x = (w + 53) / 2; round(c, x - 2.5, 26, 5, 4, 1, false); c.beginPath(); c.arc(x, 26, 1.8, Math.PI, 0); c.stroke();
        c.strokeStyle = accent + '18'; line(8, 39, w - 8, 39);
        overlays.push(() => {
            // A small floating window overlaps the photo, like a saved moment.
            c.fillStyle=color;c.strokeStyle=accent+'75';c.lineWidth=1;
            round(c,w-103,h-68,88,49,10,true);round(c,w-103,h-68,88,49,10,false);
            c.fillStyle=accent+'35';round(c,w-94,h-58,24,28,5,true);
            c.strokeStyle=accent+'a0';line(w-62,h-53,w-28,h-53);line(w-62,h-44,w-38,h-44);
            c.fillStyle=color;c.strokeStyle=accent;c.lineWidth=1.5;
            c.beginPath();c.moveTo(w-42,h-35);c.lineTo(w-38,h-13);c.lineTo(w-31,h-20);c.lineTo(w-22,h-22);c.closePath();c.fill();c.stroke();
        });
    } else if (id === 'scrapbook') {
        customMask=true;m.fillStyle='#fff';torn(m,24,30,w-48,h-72,7);
        c.fillStyle = color; c.beginPath();
        for (let x = 10; x <= w - 10; x += 4) c.lineTo(x, 16 + random() * 1.6);
        for (let y = 16; y <= h - 14; y += 4) c.lineTo(w - 11 + random() * 1.5, y);
        for (let x = w - 11; x >= 10; x -= 4) c.lineTo(x, h - 15 + random() * 1.7);
        c.closePath(); c.fill();
        overlays.push(() => { tape(w*.23,38,-.30);tape(w*.80,h-48,-.34,70); });
        c.strokeStyle = accent + '70'; c.lineWidth = .8; line(26, h - 29, Math.min(w - 26, 82), h - 29);

    } else if (id === 'ribbon') {
        window = [25, 34, w - 50, h - 62, 45];
        c.fillStyle = color; round(c, 15, 20, w - 30, h - 36, 55, true);
        c.strokeStyle = accent + '65'; c.lineWidth = .8; round(c, 20, 25, w - 40, h - 46, 50, false);
        overlays.push(() => {
        c.save();c.translate(w*.66,43);c.rotate(.12);
        c.fillStyle=accent;c.strokeStyle=color;c.lineWidth=1.2;
        for(const s of [-1,1]){
            c.beginPath();c.moveTo(s*3,4);c.bezierCurveTo(s*9,24,s*16,36,s*27,48);c.lineTo(s*12,43);c.lineTo(s*10,56);c.bezierCurveTo(s*3,33,s*1,18,0,4);c.fill();
            c.beginPath();c.moveTo(0,0);c.bezierCurveTo(s*52,-44,s*65,19,s*7,7);c.closePath();c.fill();c.stroke();
            c.beginPath();c.moveTo(s*8,1);c.quadraticCurveTo(s*24,-8,s*35,-7);c.stroke();
        }
        c.fillStyle=accent;round(c,-5,-4,10,13,4,true);c.restore();
        });
    } else if (id === 'pop') {
        customMask = true;
        const tilt = (ctx, angle, draw) => { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(angle); ctx.translate(-w / 2, -h / 2); draw(); ctx.restore(); };
        tilt(c, .045, () => { c.fillStyle = accent; round(c, 23, 25, w - 44, h - 46, 4, true); });
        tilt(c, -.032, () => {
            c.fillStyle = '#313a4015'; round(c, 20, 23, w - 47, h - 49, 3, true);
            c.fillStyle = color; round(c, 16, 18, w - 47, h - 49, 3, true);
            c.strokeStyle = '#75695930'; c.lineWidth = .7; round(c, 16, 18, w - 47, h - 49, 3, false);
        });
        m.fillStyle = '#fff'; tilt(m, -.032, () => round(m, 28, 30, w - 71, h - 78, 16, true));
        overlays.push(() => {
            c.save(); c.translate(47, 25); c.rotate(-.08); c.strokeStyle = '#7e919e'; c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(-4, 18); c.lineTo(-4, -9); c.bezierCurveTo(-4,-18,7,-18,7,-9); c.lineTo(7,18); c.bezierCurveTo(7,24,0,24,0,18); c.lineTo(0,-8); c.stroke(); c.restore();
            star(w-52,52,27,color);star(w-52,52,21,accent);
            star(40,h-59,20,color);star(40,h-59,15,accent);
        });
    } else {
        customMask=true;m.fillStyle='#fff';torn(m,34,29,w-57,h-65,5);
        c.fillStyle = color; round(c, 16, 10, w - 27, h - 20, 6, true);
        c.strokeStyle = accent + '22'; c.lineWidth = .65;
        for (let y = 29; y < h - 10; y += 22) line(18, y, w - 13, y);
        c.strokeStyle = accent + '45'; line(33, 11, 33, h - 11);
        const rings = Math.max(4, Math.round((h - 60) / 48));
        for (let i = 0; i < rings; i++) { const y = 34 + i * (h - 68) / (rings - 1); c.fillStyle = accent + '30'; c.beginPath(); c.arc(24, y, 2.4, 0, Math.PI * 2); c.fill(); }
        overlays.push(() => {
            // Binding and a corner sticker cross the photograph's edge.
            c.strokeStyle=accent;c.lineWidth=1.8;
            for(let i=0;i<rings;i++){const y=34+i*(h-68)/(rings-1);c.beginPath();c.ellipse(27,y,15,4,-.18,.1,Math.PI*1.8);c.stroke();}
            c.save(); c.translate(w - 39, h - 42); c.rotate(-.38);
            c.fillStyle = '#fffdf5'; c.beginPath(); c.ellipse(0, 0, 24, 17, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#eac747'; c.beginPath(); c.moveTo(-20, 0); c.bezierCurveTo(-15, -21, 15, -21, 20, 0); c.bezierCurveTo(15, 20, -15, 20, -20, 0); c.fill();
            c.strokeStyle = '#fff6b4'; c.lineWidth = 2; c.beginPath(); c.arc(-1, 0, 10, Math.PI, Math.PI * 1.6); c.stroke();
            c.fillStyle = accent; c.beginPath(); c.ellipse(15, -12, 8, 3.5, -.6, 0, Math.PI * 2); c.fill(); c.restore();
        });
    }
    if (!customMask) { m.fillStyle = '#fff'; round(m, ...window.slice(0, 4), window[4], true); }
    // Cut the photo opening first, then let the corner ornaments overlap it.
    if (id !== 'watercolor') { c.globalCompositeOperation = 'destination-out'; c.drawImage(mask, 0, 0, w, h); c.globalCompositeOperation = 'source-over'; }
    for (const draw of overlays) draw();
    const result = { on: true, art: art.toDataURL('image/png'), mask: mask.toDataURL('image/png'), ratio: baseWidth / baseHeight,
        presetVersion: FRAME_PRESET_VERSION, presetId: id, presetColor: color, presetAccent: accent, frameWidth, frameHeight,
        radius: 0, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover' };
    // Bounded cache: slider/color edits cannot retain an unlimited set of PNGs.
    if (!standard && cache.size >= 8) cache.delete(cache.keys().next().value);
    store.set(key, result); art.width = mask.width = 1; return { ...result };
}
