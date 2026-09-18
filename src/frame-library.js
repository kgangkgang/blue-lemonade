import { tidyDecor } from './decor.js';
export const FRAME_LIMIT = 12;
const BYTE_LIMIT = 12 * 1024 * 1024;
export const FRAME_PRESETS = [['champagne', '샴페인'], ['silver', '실버 라인'], ['film', '필름'], ['corners', '코너 장식']];
const cache = new Map();
export function tidyFrameLibrary(s) {
    if (!Array.isArray(s.frameLibrary)) s.frameLibrary = [];
    let size = 0; const seen = new Set();
    s.frameLibrary = s.frameLibrary.filter(item => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-z\d-]{1,80}$/i.test(item.id) || seen.has(item.id) || seen.size >= FRAME_LIMIT) return false;
        tidyDecor(item);
        if (!item.decor.art || !item.decor.mask) return false;
        size += item.decor.art.length + item.decor.mask.length;
        if (size > BYTE_LIMIT) return false;
        item.name = String(item.name || '내 액자').trim().slice(0, 40); seen.add(item.id); return true;
    });
}
export function saveFrame(s, owner, name) {
    const decor = s[owner]?.decor;
    if (!decor?.art || !decor.mask) throw new Error('먼저 액자를 고르거나 불러와 주세요.');
    if (s.frameLibrary.length >= FRAME_LIMIT) throw new Error(`액자는 최대 ${FRAME_LIMIT}개까지 저장할 수 있어요. 보관함에서 쓰지 않는 액자를 지워 주세요.`);
    const size = s.frameLibrary.reduce((n, item) => n + item.decor.art.length + item.decor.mask.length, 0) + decor.art.length + decor.mask.length;
    if (size > BYTE_LIMIT) throw new Error('액자 보관함이 가득 찼어요. 큰 액자를 지우거나 더 작은 그림으로 저장해 주세요.');
    const unique = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    const id = `frame-${unique}`;
    const copy = { ...decor, on: true }; delete copy.libraryId;
    s.frameLibrary.push({ id, name: String(name || `내 액자 ${s.frameLibrary.length + 1}`).trim().slice(0, 40), decor: copy });
    decor.libraryId = id; return id;
}
export function useFrame(s, owner, id) {
    const item = s.frameLibrary.find(x => x.id === id);
    if (item) s[owner].decor = { ...item.decor, on: true, libraryId: id };
}
export function deleteFrame(s, id) {
    s.frameLibrary = s.frameLibrary.filter(x => x.id !== id);
    for (const owner of ['image', 'profile']) if (s[owner].decor.libraryId === id) delete s[owner].decor.libraryId;
}
export function presetFrame(id) {
    if (!FRAME_PRESETS.some(p => p[0] === id)) throw new Error('알 수 없는 액자예요.');
    if (cache.has(id)) return { ...cache.get(id) };
    const art = document.createElement('canvas'), mask = document.createElement('canvas');
    art.width = mask.width = 360; art.height = mask.height = 480;
    const c = art.getContext('2d'), m = mask.getContext('2d');
    const round = (ctx, x, y, w, h, r, fill = false) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); fill ? ctx.fill() : ctx.stroke(); };
    let inset = 28, radius = 16;
    if (id === 'film') {
        inset = 36; radius = 4; c.fillStyle = '#20252c'; round(c, 8, 8, 344, 464, 16, true);
        c.clearRect(inset, inset, 360 - inset * 2, 480 - inset * 2);
        c.fillStyle = '#a7acb4'; for (let y = 28; y < 454; y += 28) { round(c, 15, y, 10, 15, 2, true); round(c, 335, y, 10, 15, 2, true); }
    } else {
        const gradient = c.createLinearGradient(0, 0, 360, 480);
        gradient.addColorStop(0, id === 'champagne' ? '#b79a62' : '#768595'); gradient.addColorStop(.45, id === 'champagne' ? '#f5e8c0' : '#eef2f6'); gradient.addColorStop(1, id === 'champagne' ? '#ad8750' : '#778697');
        c.strokeStyle = gradient; c.lineWidth = id === 'corners' ? 1.5 : 3;
        round(c, 25, 25, 310, 430, 19); c.lineWidth = 1; round(c, 17, 17, 326, 446, 25);
        if (id === 'champagne' || id === 'corners') {
            for (const [x, y, angle] of [[25,25,0],[335,25,Math.PI/2],[335,455,Math.PI],[25,455,-Math.PI/2]]) {
                c.save(); c.translate(x,y); c.rotate(angle); c.lineWidth=2; c.beginPath();c.moveTo(0,38);c.bezierCurveTo(22,38,38,22,38,0);c.stroke();c.beginPath();c.ellipse(12,12,4,9,-Math.PI/4,0,Math.PI*2);c.stroke();c.restore();
            }
        }
    }
    m.fillStyle = '#fff'; round(m, inset, inset, 360 - inset * 2, 480 - inset * 2, radius, true);
    const result = { on: true, art: art.toDataURL('image/png'), mask: mask.toDataURL('image/png'), ratio: .75, radius: 0, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover' };
    cache.set(id, result); return { ...result };
}
