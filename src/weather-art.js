// Weather materials: lazy, same-origin atlases shared by both weather layers.
// Decode once, trim transparent padding, keep only small reusable sprites.
const PACKS = {
    nature: ['cloud', 'mist', 'petal', 'lemon', 'leaf', 'snow'],
    light: ['nebula', 'sunbeam', 'caustic', 'palm', 'droplet', 'glow'],
    wings: ['feather', 'butterfly', 'featherGold', 'butterflyPink', 'down', 'moth'],
};
const MODES = { petal: ['nature'], lemon: ['nature'], breeze: ['nature'],
    star: ['light'], sun: ['light'], firefly: ['light'], shadow: ['light', 'nature'], water: ['light'], glass: ['light'], feather: ['wings'], butterfly: ['wings'] };
const packs = new Map();
const limits = { cloud: 384, mist: 384, nebula: 512, sunbeam: 384, caustic: 384, palm: 384, droplet: 96, glow: 64 };

async function decodePack(name, canvas) {
    const response = await fetch(new URL(`./weather-art/${name}.webp`, import.meta.url));
    if (!response.ok) throw new Error(`Weather material ${name}: HTTP ${response.status}`);
    const blob = await response.blob();
    let atlas, objectURL;
    try {
        if (typeof createImageBitmap === 'function') atlas = await createImageBitmap(blob);
        else if (typeof Image === 'function') {
            atlas = new Image(); objectURL = URL.createObjectURL(blob); atlas.src = objectURL; await atlas.decode();
        } else return null;
        const cw = Math.floor(atlas.width / 3), ch = Math.floor(atlas.height / 2);
        const scratch = canvas(cw, ch); if (!scratch) return null;
        const paint = scratch.getContext('2d', { willReadFrequently: true });
        const textures = new Map();
        try {
            for (const [index, kind] of PACKS[name.replace(/-(anime|cel)$/, '')].entries()) {
                paint.clearRect(0, 0, cw, ch);
                paint.drawImage(atlas, index % 3 * cw, Math.floor(index / 3) * ch, cw, ch, 0, 0, cw, ch);
                const pixels = paint.getImageData(0, 0, cw, ch).data;
                let left = cw, top = ch, right = -1, bottom = -1;
                for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
                    if (pixels[(y * cw + x) * 4 + 3] < 8) continue;
                    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
                }
                if (right < left) continue;
                left = Math.max(0, left - 3); top = Math.max(0, top - 3);
                right = Math.min(cw - 1, right + 3); bottom = Math.min(ch - 1, bottom + 3);
                const w = right - left + 1, h = bottom - top + 1, scale = Math.min(1, (limits[kind] || 128) / Math.max(w, h));
                const target = canvas(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
                if (!target) continue;
                target.getContext('2d').drawImage(scratch, left, top, w, h, 0, 0, target.width, target.height);
                textures.set(kind, target);
            }
            return textures;
        } catch (error) {
            for (const texture of textures.values()) texture.width = texture.height = 1;
            throw error;
        } finally { scratch.width = scratch.height = 1; }
    } finally {
        atlas?.close?.();
        if (objectURL) URL.revokeObjectURL(objectURL);
    }
}

export function createWeatherArt(canvas, wake) {
    let disposed = false;
    const pending = new Map(), owned = new Map(), tinted = new Map();
    const clearTint = () => { for (const texture of tinted.values()) texture.width = texture.height = 1; tinted.clear(); };
    return {
        request(mode, style = 'real') {
            if (style === 'simple' && mode === 'star') style = 'real'; // Keep the diffuse Milky Way backdrop.
            if (style === 'simple' || disposed || (typeof createImageBitmap !== 'function' && typeof Image !== 'function')) return;
            for (const base of MODES[mode] || []) {
                const name = ['anime', 'cel'].includes(style) ? `${base}-${style}` : base;
                if (pending.has(name) || owned.has(name)) continue;
                let pack = packs.get(name);
                if (!pack) {
                    pack = { refs: 0, textures: null, promise: null };
                    packs.set(name, pack);
                    pack.promise = decodePack(name, canvas).then(textures => {pack.textures = textures; return textures;});
                }
                pack.refs++; owned.set(name, pack);
                const promise = pack.promise.then(() => { if (!disposed) wake?.(); }).catch(() => {
                    // Keep the existing procedural rendering if a local file is unavailable.
                    if (owned.get(name) === pack) {pack.refs--; owned.delete(name);}
                    if (packs.get(name) === pack) packs.delete(name);
                }).finally(() => pending.delete(name));
                pending.set(name, promise);
            }
        },
        ready: () => Promise.all([...pending.values()]),
        get(kind, color = null, style = 'real', outline = false) {
            if (disposed) return null;
            let source;
            for (const [name, pack] of owned) {if ((name.match(/-(anime|cel)$/)?.[1] || 'real') !== style) continue; source = pack.textures?.get(kind); if (source) break; }
            if (!source || (!color && !outline)) return source || null;
            const key = `${style}|${kind}|${color}|${outline}`;
            if (tinted.has(key)) return tinted.get(key);
            const result = canvas(source.width, source.height); if (!result) return source;
            const paint = result.getContext('2d');
            // A luminance layer preserves the painted veins, folds and cloud relief.
            if (color) {
                paint.filter = 'grayscale(1) brightness(1.25)';
                paint.drawImage(source, 0, 0); paint.filter = 'none';
                paint.globalCompositeOperation = 'multiply'; paint.fillStyle = `rgb(${color})`; paint.fillRect(0, 0, result.width, result.height);
                paint.globalCompositeOperation = 'destination-in'; paint.drawImage(source, 0, 0);
                paint.globalCompositeOperation = 'source-over';
            } else paint.drawImage(source, 0, 0);
            if (outline) {
                const edge = canvas(source.width, source.height), brush = edge?.getContext('2d');
                if (brush) {
                    const r = Math.max(1, Math.min(source.width, source.height) * .018);
                    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; brush.drawImage(source, Math.cos(a) * r, Math.sin(a) * r); }
                    brush.globalCompositeOperation = 'source-in'; brush.fillStyle = 'rgba(49,68,98,.65)'; brush.fillRect(0, 0, edge.width, edge.height);
                    paint.globalCompositeOperation = 'destination-over'; paint.drawImage(edge, 0, 0); paint.globalCompositeOperation = 'source-over';
                    edge.width = edge.height = 1;
                }
            }
            tinted.set(key, result); return result;
        },
        clearTint,
        dispose() {
            if (disposed) return;
            disposed = true; clearTint();
            for (const [name, pack] of owned) {
                pack.refs--;
                if (!pack.refs) {
                    if (packs.get(name) === pack) packs.delete(name);
                    pack.promise.then(() => {for (const texture of pack.textures?.values() || []) texture.width = texture.height = 1; pack.textures = null;}, () => {});
                }
            }
            owned.clear();
        },
    };
}
