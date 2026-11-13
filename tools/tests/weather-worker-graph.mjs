// 날씨 워커 그래프 — 워커가 받는 조각이 시작 묶음(dist/index.js)이나 창 · 문서 전역을 쓰는 모듈을 부르지 않고, 워커 전역 흉내(창 · 문서 없음)에서 끝까지 도는지 봐요.
//   1.2.1 ~ 1.2.4 는 엔진 · 장면 조각이 ./index.js 를 불러 워커 안에서 「document is not defined」로 멈추고, 날씨가 메인 스레드 2D 캔버스로 떨어졌어요(폰 Commit +2ms 의 유력한 원인).
//   ① dist: 워커 조각의 import 닫힘에 index.js 가 없고, 메인 대체 길(weather.js 의 엔진 주소)이 워커와 같은 엔진 조각을 받아요
//   ② 워커 전역 흉내(노드 vm 모듈 · window · document 없음)에서 워커 조각을 불러 init → ready → 비 · 무지개(장면 조각을 늦게 받음) · 눈 + 안개를 그려요
//   ③ 메인 스레드 대체 길(weather.js createRenderer 의 메인 길과 같은 순서)로 같은 엔진 조각을 돌리면 그리기 기록이 워커 길과 같아요
//   ④ 빌드 검사: 일부러 index.js · document · 실리태번 주소를 부르는 견본 워커 그래프는 buildWorkerGraph 가 멈추고, typeof 로 확인한 Image 는 통과해요
//   node tools/tests/weather-worker-graph.mjs [저장소] [--log <파일>]
//     vm.SourceTextModule 을 쓰려고 --experimental-vm-modules 로 한 번 더 떠요. ④는 묶음 도구(tools/node_modules)를 써요 — 없으면 build-bundle 처럼 npm ci 로 받아요.
//     --log: ② 워커 길의 그리기 기록을 JSON 으로 남겨요(다른 판 dist 와 견줄 때)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof vm.SourceTextModule !== 'function') {
    const again = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exit(again.status ?? 1);
}

const args = process.argv.slice(2);
const logAt = args.indexOf('--log');
const logFile = logAt >= 0 ? args[logAt + 1] : '';
const root = path.resolve(args.find((a, i) => !a.startsWith('--') && (logAt < 0 || i !== logAt + 1)) || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const dist = path.join(root, 'dist');
const read = file => fs.readFileSync(path.join(dist, file), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); } }

// ── dist 에서 날씨 조각 · 워커 주소 · 메인 대체 길의 엔진 주소 찾기(줄여도 남는 글로)
const weatherChunk = fs.readdirSync(dist).filter(f => f.endsWith('.js')).find(f => read(f).includes('날씨 워커 준비 시간 초과'));
const weatherText = weatherChunk ? read(weatherChunk) : '';
const workerFile = /new Worker\(new URL\(new URL\("(c-[\w-]+\.js)",import\.meta\.url\)\.href\)/.exec(weatherText)?.[1];
const engineFiles = [...new Set([...weatherText.matchAll(/new URL\(new URL\("(c-[\w-]+\.js)",import\.meta\.url\)\.href\),\["createEngine"/g)].map(m => m[1]))];
/** dist 조각 하나에서 닿는 조각(정적 · 동적 import · 주소로 받는 조각) — Map(조각 → 부른 조각) */
function closure(start) {
    const from = new Map([[start, null]]);
    for (const file of from.keys()) {
        const text = read(file);
        const next = [...text.matchAll(/(?:^|[;}])\s*import\s*(?:[^"'()]*?from\s*)?["']\.\/([^"']+)["']/g), ...text.matchAll(/\bimport\(\s*["']\.\/([^"']+)["']\s*\)/g), ...text.matchAll(/new URL\("(c-[\w-]+\.js)",import\.meta\.url\)/g)].map(m => m[1]);
        for (const n of next) if (!from.has(n)) from.set(n, file);
    }
    return from;
}
const way = (from, file) => { const out = []; for (let at = file; at; at = from.get(at)) out.unshift(at); return out.join(' → '); };

await test('① 워커 조각의 import 닫힘에 시작 묶음(index.js)이 없고, 메인 대체 길이 워커와 같은 엔진 조각을 받아요', () => {
    assert.ok(weatherChunk && workerFile, `dist 에서 날씨 조각 · 워커 주소를 못 찾았어요(${weatherChunk || '날씨 조각 없음'})`);
    const from = closure(workerFile);
    assert.ok(!from.has('index.js'), `워커가 시작 묶음을 불러요: ${way(from, 'index.js')}`);
    assert.equal(engineFiles.length, 1, `메인 대체 길의 엔진 주소가 하나가 아니에요: ${engineFiles.join(' · ')}`);
    assert.ok(from.has(engineFiles[0]), `메인 대체 길의 엔진 조각(${engineFiles[0]})이 워커 그래프에 없어요 — 두 길이 다른 코드를 받아요`);
    const bytes = [...from.keys()].reduce((s, f) => s + fs.statSync(path.join(dist, f)).size, 0);
    console.log(`   워커 그래프 ${from.size}조각 · ${bytes.toLocaleString('en-US')}B: ${[...from.keys()].join(' · ')}`);
});

// ── 노드 vm 모듈로 dist 조각을 한 「전역」 안에서 불러요(브라우저처럼 주소마다 한 번 · 동적 import 도 같은 전역)
function realm(globals) {
    const context = vm.createContext(globals);
    // 두 길이 같은 난수를 쓰게(엔진의 입자 자리 · 장면 흔들림) — 견줄 수 있어요
    vm.runInContext('Math.random = (() => { let s = 20261113; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; })();', context);
    const cache = new Map();
    const get = url => {
        const key = url.split(/[?#]/)[0];
        if (!cache.has(key)) cache.set(key, new vm.SourceTextModule(fs.readFileSync(fileURLToPath(key), 'utf8'), {
            context, identifier: key,
            initializeImportMeta: meta => { meta.url = url; },
            importModuleDynamically: async specifier => ready(get(new URL(specifier, key).href)),
        }));
        return cache.get(key);
    };
    const linker = (specifier, referrer) => get(new URL(specifier, referrer.identifier).href);
    async function ready(mod) {
        if (mod.status === 'unlinked') await mod.link(linker);
        if (mod.status === 'linked') await mod.evaluate();
        if (mod.status === 'errored') throw mod.error;
        return mod;
    }
    return { context, cache, load: file => ready(get(pathToFileURL(path.join(dist, file)).href)) };
}
/** 그리기 기록을 남기는 캔버스(워커의 OffscreenCanvas · 메인의 캔버스 둘 다 같은 꼴) */
function canvasKit(log) {
    let n = 0;
    const show = v => (v && typeof v === 'object' ? v.name || '물건' : v);
    const context = canvas => new Proxy({ globalAlpha: 1, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)', shadowOffsetX: 0, shadowOffsetY: 0, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', imageSmoothingEnabled: true, imageSmoothingQuality: 'low', miterLimit: 10, lineDashOffset: 0 }, {
        get(state, key) {
            if (key === 'canvas') return canvas;
            if (key in state || typeof key !== 'string') return state[key];
            return (...a) => {
                log.push([canvas.name, key, ...a.map(show)]);
                if (/^create(?:Linear|Radial|Conic)Gradient$/.test(key)) { const g = { name: `${canvas.name}:그라데이션${++n}`, addColorStop: (o, c) => log.push([g.name, 'addColorStop', o, c]) }; return g; }
                if (key === 'createPattern') return { name: `${canvas.name}:무늬${++n}`, setTransform() {} };
                if (key === 'getImageData') return { width: a[2], height: a[3], data: new Uint8ClampedArray(Math.max(0, a[2] * a[3] * 4)) };
                if (key === 'measureText') return { width: String(a[0] ?? '').length * 6 };
                return undefined;
            };
        },
        set(state, key, value) { state[key] = value; log.push([canvas.name, '=', key, show(value)]); return true; },
    });
    class OffscreenCanvas {
        #w = 300; #h = 150; #ctx = null;
        constructor(w, h, name = `캔버스${++n}`) { this.name = name; this.#w = w; this.#h = h; }
        get width() { return this.#w; } set width(v) { this.#w = v; log.push([this.name, '=', 'width', v]); }
        get height() { return this.#h; } set height(v) { this.#h = v; log.push([this.name, '=', 'height', v]); }
        getContext(type) { return type === '2d' ? (this.#ctx ??= context(this)) : null; }
        transferToImageBitmap() { return { name: `${this.name}:비트맵`, width: this.#w, height: this.#h, close() {} }; }
        convertToBlob() { return Promise.resolve(new Blob([])); }
    }
    return OffscreenCanvas;
}
/** 워커 · 메인 공통 전역(창 · 문서는 없음) + 프레임 돌리기 */
function baseGlobals(log, notes) {
    const frames = new Map(); let id = 0, now = 1000;
    const quiet = level => (...a) => notes.push([level, a.map(v => (v instanceof Error ? `${v.name}: ${v.message}` : String(v))).join(' ')]);
    const globals = {
        console: { log: quiet('log'), info: quiet('info'), warn: quiet('warn'), error: quiet('error'), debug: quiet('debug') },
        URL, URLSearchParams, Blob, TextEncoder, TextDecoder, structuredClone, queueMicrotask, setTimeout, clearTimeout, setInterval, clearInterval,
        performance: { now: () => now },
        fetch: async () => { throw new TypeError('흉내: 그림 자료는 받지 않아요'); },
        createImageBitmap: async () => { throw new TypeError('흉내: 그림 풀기 없음'); },
        OffscreenCanvas: canvasKit(log),
        requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
        cancelAnimationFrame: key => { frames.delete(key); },
    };
    const run = count => { for (let i = 0; i < count; i++) { now += 1000 / 60; const due = [...frames.values()]; frames.clear(); for (const fn of due) fn(now); } };
    return { globals, run };
}
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); };
// weather.js paramsFrom({}) 의 기본값 + 화이트 팔레트 색 — 두 길에 같은 순서로 보내요(weather.js 가 준비 뒤 보내는 reduce → resize → 쌓인 config 순서)
const COLORS = { rain: '40,50,60', rainAlpha: 0.42, snow: '90,130,170', snowAlpha: 0.68 };
const PARAMS = { amount: 100, artStyle: 'simple', artOutline: false, tint: null, tint2: null, scene: { shadowBlur: 35 }, spots: null, sun: { style: 'flare' }, star: {}, fog: {}, curvature: 65, orbitSize: 100, orbitDirection: 'right', readability: false, opacity: 100, size: 100, speed: 100, motion: 'natural', sway: 100, spin: 100, angle: -9, warm: false, second: null };
const INIT = { w: 384, h: 757, dpr: 3, mode: 'off', level: 2, colors: COLORS, reduce: false };
const SCRIPT = [
    { type: 'reduce', reduce: false },
    { type: 'resize', w: 384, h: 757, dpr: 3 },
    { type: 'config', mode: 'rain', level: 2, colors: COLORS, ...PARAMS },
    { run: 12 },
    { type: 'config', mode: 'rainbow', level: 2, colors: COLORS, ...PARAMS },   // 장면 조각(weather-scenes)을 이때 늦게 받아요
    { settle: true },
    { run: 12 },
    { type: 'config', mode: 'snow', level: 3, colors: COLORS, ...PARAMS, second: { mode: 'fog', level: 2, ...PARAMS, warm: false } },
    { run: 12 },
    { type: 'pause' }, { run: 4 }, { type: 'resume' }, { run: 6 },
    { type: 'resize', w: 360, h: 700, dpr: 3 },
    { run: 6 },
];
async function drive(post, run, log) {
    for (const [i, step] of SCRIPT.entries()) {
        log.push(['단계', i, step.type || (step.run ? `프레임 ${step.run}` : '기다림')]);
        if (step.run) run(step.run);
        else if (step.settle) await settle();
        else post(step);
    }
    await settle();
}

let workerRun = null;
await test('② 워커 전역 흉내(window · document 없음)에서 워커 조각이 document is not defined 없이 끝까지 돌아요', async () => {
    assert.ok(workerFile, 'dist 에서 워커 주소를 못 찾았어요');
    const log = [], notes = [], posted = [];
    const { globals, run } = baseGlobals(log, notes);
    globals.postMessage = message => posted.push(message);
    globals.self = globals;
    for (const name of ['window', 'document', 'localStorage', 'getComputedStyle', 'matchMedia']) assert.ok(!(name in globals));
    const r = realm(globals);
    await r.load(workerFile);   // 1.2.1 ~ 1.2.4: 여기서 ReferenceError: document is not defined(src/lite.js)
    assert.equal(typeof globals.onmessage, 'function', '워커 조각이 onmessage 를 걸지 않았어요');
    const canvas = new globals.OffscreenCanvas(INIT.w * INIT.dpr, INIT.h * INIT.dpr, '화면');
    globals.onmessage({ data: { type: 'init', canvas, ...INIT } });
    assert.deepEqual(posted.map(m => m?.type), ['ready'], '워커가 ready 를 보내지 않았어요');   // 다른 전역(vm)에서 만든 물건이라 꼴이 아니라 type 만 견줘요
    await drive(message => globals.onmessage({ data: message }), run, log);
    const loaded = [...r.cache.keys()].map(k => path.basename(fileURLToPath(k)));
    assert.ok(!loaded.includes('index.js'), `워커가 index.js 를 받았어요: ${loaded.join(' · ')}`);
    assert.ok(loaded.length >= 3, `장면 조각까지 받았어야 해요: ${loaded.join(' · ')}`);
    const errors = notes.filter(([level]) => level === 'error' || level === 'warn');
    assert.deepEqual(errors, [], '워커 안에서 경고 · 오류가 났어요');
    const ops = log.filter(e => e[0] === '화면' && e[1] !== '=').length;
    assert.ok(ops > 200, `화면에 그린 것이 너무 적어요(${ops})`);
    const rainbow = log.findIndex(e => e[0] === '단계' && e[1] === 6), snow = log.findIndex(e => e[0] === '단계' && e[1] === 7);
    assert.ok(log.slice(rainbow, snow).some(e => e[0] === '화면' && /^(?:arc|stroke|fill|drawImage)$/.test(e[1])), '무지개(장면 조각)를 그리지 않았어요');
    workerRun = { log, loaded };
    console.log(`   받은 조각 ${loaded.length}개(${loaded.join(' · ')}) · 화면 그리기 ${ops}번 · 기록 ${log.length}줄`);
    if (logFile) fs.writeFileSync(logFile, JSON.stringify({ loaded, log }));
});

await test('③ 메인 스레드 대체 길(weather.js 의 메인 길 순서)도 같은 엔진 조각으로 워커 길과 똑같이 그려요', async () => {
    assert.ok(workerRun, '② 워커 길이 먼저 돌아야 견줄 수 있어요');
    const log = [], notes = [];
    const { globals, run } = baseGlobals(log, notes);
    globals.window = globals; globals.self = globals;
    globals.document = { hidden: false, createElement() { throw new Error('흉내: 메인 길도 OffscreenCanvas 를 써요'); } };
    const r = realm(globals);
    const { createEngine, createLoop } = (await r.load(engineFiles[0])).namespace;
    const canvas = new globals.OffscreenCanvas(INIT.w * INIT.dpr, INIT.h * INIT.dpr, '화면');
    // src/weather.js createRenderer 의 메인 길(워커를 못 쓸 때) 그대로
    const engine = createEngine(canvas.getContext('2d'));
    const loop = createLoop(engine, fn => globals.requestAnimationFrame(fn), id => globals.cancelAnimationFrame(id));
    let reduce = !!INIT.reduce, paused = false;
    const apply = () => { if (engine.idle() || reduce || paused) { loop.stop(); if (!paused) engine.draw(); } else loop.start(); };
    engine.onWake = () => apply();
    engine.resize(INIT.w, INIT.h, INIT.dpr);
    engine.config(INIT);
    apply();
    const post = message => {
        if (message.type === 'resize') { engine.resize(message.w, message.h, message.dpr); engine.draw(); }
        else if (message.type === 'config') { engine.config(message); apply(); }
        else if (message.type === 'pause') { paused = true; loop.stop(); }
        else if (message.type === 'resume') { paused = false; apply(); }
        else if (message.type === 'reduce') { reduce = !!message.reduce; apply(); }
    };
    await drive(post, run, log);
    assert.deepEqual(notes.filter(([level]) => level === 'error' || level === 'warn'), []);
    const first = log.findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(workerRun.log[i]));
    assert.equal(first, -1, `그리기 기록이 ${first}번째 줄부터 달라요: 워커 ${JSON.stringify(workerRun.log[first])} · 메인 ${JSON.stringify(log[first])}`);
    assert.equal(log.length, workerRun.log.length);
    console.log(`   두 길 그리기 기록 ${log.length}줄이 같아요(엔진 조각 ${engineFiles[0]})`);
});

await test('④ 빌드 검사: index.js · document · 실리태번 주소를 부르는 견본 워커 그래프는 빌드를 멈추고, 깨끗한 견본 · 실제 날씨 그래프는 통과해요', async () => {
    const tool = await import(pathToFileURL(path.join(root, 'tools/build-bundle.mjs')));
    assert.equal(typeof tool.buildWorkerGraph, 'function', '묶음 도구에 워커 그래프 따로 묶기(buildWorkerGraph)가 없어요');
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-worker-graph-'));
    const graph = { name: '견본 워커', entries: ['src/w-worker.js', 'src/w-engine.js'] };
    const fixture = (name, files) => {
        const dir = path.join(base, name);
        const all = {
            'index.js': "export { boot } from './src/boot.js';\n",
            'src/boot.js': "const drawers = document.getElementsByClassName('openDrawer');\nexport function boot() { return drawers.length; }\n",
            'src/w-worker.js': "import { createEngine } from './w-engine.js';\nself.onmessage = () => self.postMessage(createEngine());\n",
            'src/w-opts.js': 'export const wrap = (v, n) => ((v % n) + n) % n;\n',
            ...files,
        };
        for (const [file, text] of Object.entries(all)) { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); }
        return dir;
    };
    const stops = async (name, files, pattern) => {
        await assert.rejects(tool.buildWorkerGraph(graph, { root: fixture(name, files) }), e => { assert.match(String(e.message), pattern); console.log(`   ${name}: ${String(e.message).split('\n').slice(0, 3).join(' / ')}`); return true; });
    };
    try {
        // 1.2.1 ~ 1.2.4 와 같은 꼴: 엔진이 시작 그래프의 모듈을 받으려고 index.js 를 불러요
        await stops('index-부름', { 'src/w-engine.js': "import { boot } from '../index.js';\nimport { wrap } from './w-opts.js';\nexport function createEngine() { return wrap(boot(), 3); }\nexport function createLoop() {}\n" }, /index\.js 를 불러요: (?:src\/w-worker\.js → )?src\/w-engine\.js → index\.js/);
        await stops('document-씀', { 'src/w-engine.js': "import { wrap } from './w-opts.js';\nexport function createEngine() { return wrap(document.body.clientWidth, 3); }\nexport function createLoop() {}\n" }, /src\/w-engine\.js 가 창 · 문서 전역\(document\)을 써요/);
        await stops('실리태번-주소', { 'src/w-engine.js': "import { eventSource } from '/script.js';\nexport function createEngine() { return eventSource; }\nexport function createLoop() {}\n" }, /바깥 모듈을 불러요/);
        const clean = await tool.buildWorkerGraph(graph, { root: fixture('깨끗함', { 'src/w-engine.js': "import { wrap } from './w-opts.js';\nexport function createEngine() { const img = typeof Image === 'function' ? new Image() : null; return wrap(img ? 1 : 2, 3); }\nexport function createLoop() {}\n" }) });
        const files = new Set(clean.chunks.map(c => c.fileName));
        assert.ok(clean.chunks.every(c => [...c.imports, ...c.dynamicImports].every(f => files.has(f))));
        assert.deepEqual([...clean.entryFiles.keys()], graph.entries);
        assert.ok(clean.chunks.find(c => c.fileName === clean.entryFiles.get('src/w-engine.js')).exports.includes('createEngine'), '엔진 입구가 createEngine 을 그 이름으로 내보내야 메인 대체 길이 받아요');
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
    const real = await tool.buildWorkerGraph(tool.WORKER_GRAPHS[0], { root });
    const modules = [...new Set(real.chunks.flatMap(c => Object.keys(c.modules)).map(id => path.relative(root, id).split(path.sep).join('/')))].sort();
    assert.ok(!modules.includes('index.js'));
    console.log(`   실제 ${real.graph.name} 그래프: ${modules.join(' · ')}`);
});

console.log(`weather-worker-graph: ${passed}개 통과 · ${failed}개 실패`);
if (failed) process.exitCode = 1;
