// Retired weather (feather · butterfly · glass · water) and the retired sun shapes (shaft · holy · anime) must not
// ship dead weight: every packaged weather image is used by a reachable setting, every decoded atlas cell is drawn,
// and old saved values that still reach the engine draw nothing (retired modes) or the lens flare (old sun shapes).
// Usage: node weather-retired.mjs <theme root>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const art = path.join(root, 'src/weather-art');
const RETIRED = ['feather', 'butterfly', 'glass', 'water'];
// The painted atlases are fixed 3 × 2 grids; this is their cell order.
const CELLS = { nature: ['cloud', 'mist', 'petal', 'lemon', 'leaf', 'snow'], light: ['nebula', 'sunbeam', 'caustic', 'palm', 'droplet', 'glow'], wings: ['feather', 'butterfly', 'featherGold', 'butterflyPink', 'down', 'moth'] };

const fetched = new Set(), decoded = new Set(), drawn = new Set();
let screenOps = null;
const num = v => (Object.is(v, -0) ? 0 : Number(v.toFixed(6)));
const fmt = v => (typeof v === 'number' ? num(v) : v && typeof v === 'object' ? (v.desc ?? v.label ?? 'object') : v);
function context(canvas, screen) {
    const state = { canvas, filter: 'none', globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt' };
    const log = entry => { if (screen && screenOps) screenOps.push(entry); };
    return new Proxy(state, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') return (...args) => { const g = { desc: `${key}(${args.map(fmt)})`, addColorStop(at, color) { g.desc += `|${num(at)}:${color}`; } }; return g; };
            if (key === 'getImageData') return (x, y, w, h) => {
                if (canvas.cell) decoded.add(canvas.cell);
                const data = new Uint8ClampedArray(w * h * 4);
                for (let yy = 4; yy < 20; yy++) for (let xx = 6; xx < 24; xx++) data[(yy * w + xx) * 4 + 3] = 255;
                return { data };
            };
            if (key === 'drawImage') return (image, ...args) => {
                if (image?.atlas) canvas.cell = CELLS[image.base][Math.round(args[0] / args[2]) + 3 * Math.round(args[1] / args[3])];
                else canvas.label ??= image?.cell ?? image?.label ?? null;
                if (screen && image?.label) drawn.add(image.label);
                log(`drawImage(${[image, ...args].map(fmt)})`);
            };
            return (...args) => log(`${String(key)}(${args.map(fmt)})`);
        },
        set(target, key, value) { target[key] = value; log(`${String(key)}=${fmt(value)}`); return true; },
    });
}
class OffscreenCanvas {
    constructor(w = 300, h = 150) { this.width = w; this.height = h; this.label = null; this.cell = null; }
    getContext() { return this.ctx ??= context(this, false); }
    get desc() { return this.label ?? `canvas`; }
}
globalThis.OffscreenCanvas = OffscreenCanvas;
function element(extra = {}) {
    return { style: { setProperty() {}, removeProperty() {} }, classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, dataset: {}, isConnected: true,
        setAttribute() {}, remove() { this.isConnected = false; }, replaceWith() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
        insertAdjacentHTML() {}, matches: () => false, clientWidth: 390, clientHeight: 800, getBoundingClientRect: () => ({ width: 390, height: 800 }),
        prepend(child) { child.parentElement = this; child.isConnected = true; }, append(child) { child.parentElement = this; }, ...extra };
}
function screenCanvas() {
    const canvas = element({ width: 300, height: 150, label: null, cell: null });
    canvas.getContext = () => canvas.ctx ??= context(canvas, true);
    canvas.cloneNode = () => screenCanvas();
    canvas.toDataURL = () => 'data:image/png;base64,';
    return canvas;
}
const sheld = element({ id: 'sheld' });
let trackerText = '';
const trackerValue = Object.defineProperty(element(), 'textContent', { get: () => trackerText });
globalThis.document = { hidden: false, activeElement: null, body: element(), documentElement: element(),
    createElement: () => screenCanvas(), getElementById: id => (id === 'sheld' ? sheld : null),
    querySelector: selector => (selector.includes('sheld') ? sheld : null),
    querySelectorAll: selector => (trackerText && selector.includes('custom-dem-track') ? [trackerValue] : []),
    addEventListener() {}, removeEventListener() {} };
globalThis.window = { devicePixelRatio: 2, innerHeight: 800, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.ResizeObserver = globalThis.IntersectionObserver = globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
globalThis.fetch = async url => {
    const href = String(url);
    if (href.startsWith('data:')) return { ok: true, blob: async () => ({ user: true }) };
    const name = decodeURIComponent(new URL(href).pathname.split('/').pop());
    fetched.add(name);
    const ok = fs.existsSync(path.join(art, name));
    return { ok, status: ok ? 200 : 404, blob: async () => ({ file: name }) };
};
globalThis.createImageBitmap = async blob => (blob.file ? { atlas: true, base: blob.file.replace(/(-anime|-cel)?\.webp$/, ''), width: 96, height: 64, close() {} } : { label: 'user', width: 18, height: 18, close() {} });
const host = { extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {}, eventSource: { on() {}, removeListener() {} }, event_types: {} };
globalThis.SillyTavern = { getContext: () => host };

const load = file => import(pathToFileURL(path.join(root, file)));
const { getSettings } = await load('src/settings.js');
const weather = await load('src/weather.js');
const { createEngine } = await load('src/weather-engine.js');
const realRandom = Math.random;
const seeded = fn => { let n = 97; Math.random = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); try { return fn(); } finally { Math.random = realRandom; } };
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log('PASS', name); };

const VALUES = ['off', 'rain', 'snow', 'fog', 'sun', 'star', 'firefly', 'rainbow', 'shadow', 'breeze', 'lemon', 'petal', 'meteor', 'custom', 'tracker', ...RETIRED, 'bogus'];
const STYLES = [[false, 'real'], [true, 'real'], [true, 'anime'], [true, 'cel']];
const TRACKER = ['창밖 유리창에 빗방울', '물결치는 호수, 맑음', '나비가 나는 들판, 산들바람', '깃털 같은 눈', 'butterflies over the water, sunny', 'feathers and glass rain', '밤, 맑음', '안개비', '여우비', '무지개', '흐림'];
const engineMode = () => { const current = weather.weatherState().current; return current ? [current.mode, current.second?.mode] : []; };
await check('saved, imported and tracker values never hand a retired effect to the renderer', async () => {
    let cases = 0;
    for (const value of VALUES) for (const second of ['off', 'petal', 'sun', ...RETIRED]) for (const [illustrated, style] of STYLES) for (const raw of [false, true]) {
        const saved = { enabled: true, deus: { on: true }, chat: { weather: value, weather2: second, weatherIllustrated: illustrated, weatherArtStyle: style, weatherArtOutline: cases % 3 === 0,
            weatherSunStyle: ['holy', 'shaft', 'anime', 'flare'][cases % 4], weatherStarStyle: cases % 2 ? 'milky' : 'sky', weatherShadowStyle: cases % 2 ? 'leaf' : 'palm',
            weatherProfiles: Object.fromEntries([...RETIRED, 'sun'].map(mode => [mode, { weatherSunStyle: 'holy', weatherIllustrated: true, weatherArtStyle: style }])) } };
        host.extensionSettings.salty = structuredClone(saved);
        // raw: a preset or stale object that skipped settings.js normalisation still goes through weather.js
        const chat = raw ? saved.chat : getSettings().chat;
        for (const text of value === 'tracker' ? TRACKER : ['']) {
            trackerText = text;
            weather.syncWeather(true, chat);
            for (const mode of engineMode()) assert(!RETIRED.includes(mode), `${value}/${second} → ${mode}`);
            if (!engineMode().length) assert.equal(weather.weatherState().wanted.mode, 'off');
            const stage = element({ isConnected: true });
            weather.previewWeather(stage, chat);
            for (const mode of [stage._blWeather?.current().mode, stage._blWeather?.current().second?.mode]) assert(!RETIRED.includes(mode), `preview ${value}/${second} → ${mode}`);
            weather.previewWeather(stage, { weather: 'off' });
            await weather.captureWeather(390, 800, 1);
            cases++;
        }
    }
    weather.syncWeather(false, {});
    trackerText = '';
    assert(cases > 1000);
});
await check('every packaged weather image is fetched by a reachable setting and nothing else is requested', () => {
    const shipped = fs.readdirSync(art).filter(name => name.endsWith('.webp')).sort();
    assert.deepEqual([...fetched].sort(), shipped);
});
await check('every decoded atlas cell is drawn on screen, and every drawn one is decoded', () => {
    assert(drawn.size >= 6);
    assert.deepEqual([...decoded].sort(), [...drawn].filter(label => label !== 'user').sort());
});
function frame(config, frames = 6) {
    screenOps = [];
    const canvas = screenCanvas();
    const engine = createEngine(canvas.getContext('2d'));
    return seeded(() => { engine.resize(390, 800, 2); engine.config({ level: 2, amount: 100, colors: { rain: '200,215,240', rainAlpha: .34, snow: '255,255,255', snowAlpha: .82 }, ...config }); return engine; });
}
async function render(config) {
    const engine = frame(config);
    await engine.ready();
    seeded(() => { engine.config({ level: 2, amount: 100, ...config }); for (let i = 1; i <= 6; i++) engine.step(1 / 30, i * 33); engine.draw(); });
    const ops = screenOps; screenOps = null;
    const idle = engine.idle(); engine.dispose();
    return { ops, idle };
}
await check('a retired effect that still reaches the engine draws nothing and loads nothing', async () => {
    const before = fetched.size;
    fetched.clear();
    for (const mode of RETIRED) for (const artStyle of ['simple', 'real', 'anime', 'cel']) {
        const { ops, idle } = await render({ mode, artStyle });
        assert(idle, `${mode} ${artStyle} is idle`);
        assert.deepEqual(ops.filter(op => !/^(setTransform|clearRect)\(/.test(op)), [], `${mode} ${artStyle} paints`);
    }
    assert.equal(fetched.size, 0, [...fetched].join());
    assert(before > 0);
});
await check('old sun shapes and a missing shape draw exactly the lens flare', async () => {
    for (const artStyle of ['simple', 'real', 'anime']) for (const spots of [null, { sun: [{ x: .8, y: .3 }] }]) {
        const flare = await render({ mode: 'sun', artStyle, spots, sun: { style: 'flare' } });
        assert(flare.ops.some(op => op.startsWith(artStyle === 'simple' ? 'fillRect' : 'drawImage')), 'flare paints');
        for (const sun of [{ style: 'shaft' }, { style: 'holy' }, { style: 'anime' }, undefined]) {
            const other = await render({ mode: 'sun', artStyle, spots, ...(sun ? { sun } : {}) });
            assert.deepEqual(other.ops, flare.ops, `${artStyle} ${sun?.style ?? 'no shape'}`);
        }
    }
});
console.log(JSON.stringify({ passed }));
