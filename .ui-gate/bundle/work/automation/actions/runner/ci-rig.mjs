// Actions 실행기용 리그(2026-11-12) — PC 의 rig.mjs 와 같은 RPC(/eval · /goto · /shot · /send · /viewport · /phone · /fonts · /fixture · /errors · /info · /mem · /stop)를
//   리눅스 실행기에서 띄워요: 공개 실리태번(고정 커밋) + 크롬 헤드리스 + 합성 계정(실리태번 기본 자료 + 지어낸 고정물). 검사 스크립트(checks/rig/*.mjs)는 고치지 않고 그대로 붙어요.
//   PC 와 다른 점(그래서 기준선을 따로 둬요): 사용자 설정 스냅샷 없음(합성 프로필) · 엣지 대신 크롬 · 리눅스 글꼴 · 검사마다 새 리그(앞 검사가 남긴 설정이 안 번짐).
//   바깥 주소는 PC 와 같게 막아요(글꼴 CDN 만 열림 · 생성 요청 · 확장 업데이트 차단). 유료 API · 비밀값은 없어요.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import zlib from 'node:zlib';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connect, sleep } from './cdp-lite.mjs';
import { loadSpec, chatFiles, longListFiles, settingsPatch, browserScript, writeFiles } from '../../lib/fixture.mjs';
import { seedSettings } from '../../lib/profile-seed.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FONT_URLS = { regular: ['https://cdn.jsdelivr.net/gh/projectnoonnu/2404@1.0/Freesentation-4Regular.woff2', 'woff2'], bold: ['https://cdn.jsdelivr.net/gh/projectnoonnu/2404@1.0/Freesentation-7Bold.woff2', 'woff2'], ridibatang: ['https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff', 'woff'], galmurimono11: ['https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/GalmuriMono11.woff2', 'woff2'] };
// PC 리그(lib/rig-lean.mjs DEFAULT_EDGE_FLAGS)와 같은 것 + 실행기에 필요한 것(--no-sandbox · /dev/shm 작음)
export const CHROME_FLAGS = ['--headless=new', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=IntensiveWakeUpThrottling', '--no-first-run', '--no-default-browser-check',
    '--process-per-site', '--disable-site-isolation-trials', '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--renderer-process-limit=2', '--js-flags=--max-old-space-size=256', '--no-proxy-server',
    '--no-sandbox', '--disable-dev-shm-usage', '--lang=ko-KR', '--font-render-hinting=none'];
export const FONT_CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/** 바깥 요청을 막을지(순수) — PC rig.mjs 와 같은 규칙 */
export function blockedRequest({ url, method = 'GET', resourceType = '' }, { host, allowExtUpdate = false } = {}) {
    let u; try { u = new URL(url); } catch { return true; }
    const fontCdn = FONT_CDN.includes(u.hostname) && method === 'GET' && ['Font', 'Stylesheet'].includes(resourceType);
    return !(fontCdn || u.protocol === 'data:' || u.protocol === 'blob:' || [host, '127.0.0.1', 'localhost'].includes(u.hostname)) || /\/api\/.*generate/.test(u.pathname) || (!allowExtUpdate && /\/api\/extensions\/update/.test(u.pathname));
}
/** 설정의 키 · 토큰 칸 비우기(PC rig.mjs mask 와 같음) */
export function mask(obj) {
    if (Array.isArray(obj)) return obj.map(mask);
    if (obj && typeof obj === 'object') { for (const k of Object.keys(obj)) { if (/api_?key|token|secret|password|cookie/i.test(k)) obj[k] = typeof obj[k] === 'string' ? '' : obj[k]; else obj[k] = mask(obj[k]); } }
    return obj;
}

// ---- 지어낸 캐릭터 카드(PNG + chara 글 조각) — 사진 없이 단색 그림
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
export function cardPng({ name, rgb = [120, 160, 220], size = 64 } = {}) {
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
    const idat = zlib.deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
    const card = { name, description: '', personality: '', scenario: '', first_mes: '', mes_example: '', spec: 'chara_card_v2', spec_version: '2.0', data: { name, description: '', personality: '', scenario: '', first_mes: '', mes_example: '', creator_notes: '시험용 지어낸 캐릭터', tags: [], extensions: {} } };
    const text = Buffer.concat([Buffer.from('chara\0', 'latin1'), Buffer.from(Buffer.from(JSON.stringify(card), 'utf8').toString('base64'), 'latin1')]);
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('tEXt', text), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

async function portFree(port) { return new Promise(res => { const s = net.createServer(); s.once('error', () => res(false)); s.listen(port, '127.0.0.1', () => s.close(() => res(true))); }); }
export async function pickPort(start) { for (let p = start; p < start + 200; p++) if (await portFree(p)) return p; throw Error(`빈 포트를 못 찾았어요(${start}~)`); }
export function chromePath(env = process.env) {
    if (env.CHROME_PATH && fs.existsSync(env.CHROME_PATH)) return env.CHROME_PATH;
    for (const c of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) { try { const p = execFileSync('which', [c], { encoding: 'utf8' }).trim(); if (p) return p; } catch { } }
    throw Error('크롬을 못 찾았어요(CHROME_PATH)');
}
function copyTree(src, dst, skip = new Set(['.git', 'node_modules', '.github', '.ui-gate', 'tools'])) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) { if (skip.has(e.name) || e.isSymbolicLink()) continue; const s = path.join(src, e.name), d = path.join(dst, e.name); if (e.isDirectory()) copyTree(s, d, skip); else fs.copyFileSync(s, d); }
}

function startST({ stDir, port, dataRoot, configPath, log }) {
    const out = fs.openSync(log, 'a');
    const child = spawn(process.execPath, ['server.js', '--port', String(port), '--listen', 'false', '--disableCsrf', '--browserLaunchEnabled', 'false', '--dataRoot', dataRoot, '--configPath', configPath], { cwd: stDir, env: { ...process.env, SILLYTAVERN_EXTENSIONS_AUTOUPDATE: 'false', NODE_ENV: 'production' }, stdio: ['ignore', out, out] });
    return child;
}
async function waitHttp(url, child, log, ms = 120000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { const r = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (r.ok) return; } catch { } if (child.exitCode !== null) throw Error(`실리태번이 꺼졌어요: ${fs.readFileSync(log, 'utf8').slice(-1500)}`); await sleep(300); }
    throw Error('실리태번이 준비되지 않았어요(' + Math.round(ms / 1000) + '초)');
}
const stopChild = async child => { if (!child || child.exitCode !== null) return; try { child.kill('SIGTERM'); } catch { } for (let i = 0; i < 40 && child.exitCode === null; i++) await sleep(100); if (child.exitCode === null) try { child.kill('SIGKILL'); } catch { } };

/**
 * 깨끗한 계정 틀 만들기(실행기에서 한 번) — 실리태번을 한 번 띄워 기본 자료를 채운 뒤 끄고, 테마 · 지어낸 고정물 · 합성 설정을 심어요.
 *   돌려줌 { dir, ms, fixture, seeded } — 검사마다 이 틀을 복사해 새 리그를 띄워요.
 */
export async function prepareTemplate({ stDir, theme, dir, fixture = 'full', log = m => console.log(m) }) {
    const t0 = Date.now(); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const dataRoot = path.join(dir, 'data'); const user = path.join(dataRoot, 'default-user'); const configPath = path.join(dir, 'config.yaml'); const stLog = path.join(dir, 'st-init.log');
    const port = await pickPort(8100);
    const st = startST({ stDir, port, dataRoot, configPath, log: stLog });
    try { await waitHttp(`http://127.0.0.1:${port}/`, st, stLog); } finally { await stopChild(st); }
    if (!fs.existsSync(path.join(user, 'settings.json'))) { const def = path.join(stDir, 'default', 'content', 'settings.json'); fs.mkdirSync(user, { recursive: true }); if (fs.existsSync(def)) fs.copyFileSync(def, path.join(user, 'settings.json')); else throw Error('실리태번 기본 settings.json 이 안 생겼어요'); }
    fs.writeFileSync(path.join(user, 'secrets.json'), '{}');
    copyTree(theme, path.join(user, 'extensions', 'blue-lemonade'));
    const settings = JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')); mask(settings);
    let fx = null; const spec = fixture === 'none' ? null : loadSpec(fixture);
    if (spec) {
        const files = { ...chatFiles(spec), ...longListFiles(spec) };
        writeFiles(user, files); settingsPatch(spec, settings);
        const colors = [[120, 160, 220], [220, 150, 120], [130, 190, 140]];
        spec.characters.forEach((c, i) => { const f = path.join(user, 'characters', c.avatar); fs.mkdirSync(path.dirname(f), { recursive: true }); if (!fs.existsSync(f)) fs.writeFileSync(f, cardPng({ name: c.name, rgb: colors[i % colors.length] })); });
        const chatChar = new Map(spec.characters.map(c => [c.avatar.replace(/\.png$/i, ''), c]));
        for (const ch of spec.chats) if (!chatChar.has(ch.character)) { const f = path.join(user, 'characters', `${ch.character}.png`); if (!fs.existsSync(f)) fs.writeFileSync(f, cardPng({ name: ch.name })); }
        fx = { files: Object.keys(files).length, browser: browserScript(spec), summary: { chats: spec.chats.map(c => c.turns), worldEntries: spec.world.entries, receipts: spec.receipts } };
    }
    const seeded = seedSettings(settings);
    fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify(settings, null, 4));
    if (fx) fs.writeFileSync(path.join(dir, 'fixture-browser.js'), fx.browser);
    const ms = Date.now() - t0; log(`계정 틀 준비 ${Math.round(ms / 1000)}초 · 고정물 ${fx ? fx.files + '파일' : '없음'} · 씨앗 칸 ${seeded}`);
    return { dir, ms, fixture: fx?.summary || null, seeded };
}

function fontScript(cache) {
    const data = Object.fromEntries(Object.entries(FONT_URLS).map(([n, [, ext]]) => [n, { ext, b64: fs.readFileSync(path.join(cache, `${n}.${ext}`)).toString('base64') }]));
    const fam = { regular: ['Salty UI', 'Salty UI KO', 'Freesentation'], ridibatang: ['Salty Text', 'Salty Text KO', 'Salty Dialogue', 'Salty Em', 'Salty Strong', 'Salty Name', 'RIDIBatang'], galmurimono11: ['Salty Code', 'Salty Code KO', 'GalmuriMono11'] };
    return `(async()=>{const D=${JSON.stringify(data)};const F=${JSON.stringify(fam)};const add=async(family,key,weight)=>{const f=new FontFace(family,'url(data:font/'+D[key].ext+';base64,'+D[key].b64+')',{weight});await f.load();document.fonts.add(f)};
      for(const fm of F.regular){await add(fm,'regular','400');await add(fm,'bold','700')}for(const fm of F.ridibatang)await add(fm,'ridibatang','400');for(const fm of F.galmurimono11)await add(fm,'galmurimono11','400');
      return Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family).filter((v,i,a)=>a.indexOf(v)===i)})()`;
}
export async function ensureFonts(cache) {
    fs.mkdirSync(cache, { recursive: true });
    for (const [name, [url, ext]] of Object.entries(FONT_URLS)) { const f = path.join(cache, `${name}.${ext}`); if (fs.existsSync(f)) continue; const r = await fetch(url); if (!r.ok) throw Error(`${url} ${r.status}`); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
}

/**
 * 리그 하나 띄우기 — 틀(template)을 복사한 새 계정으로 실리태번 + 크롬 + RPC. 돌려줌 { rpc, info, stop() }
 */
export async function startRig({ stDir, template, dir, fontCache, theme = null, rigsRoot = null, name = 'ci', log = m => console.log(m) }) {
    const t0 = Date.now(); const bootMs = {}; const mark = k => { bootMs[k] = Date.now() - t0; };
    fs.rmSync(dir, { recursive: true, force: true }); fs.cpSync(template, dir, { recursive: true }); mark('copied');
    const dataRoot = path.join(dir, 'data'); const configPath = path.join(dir, 'config.yaml'); const stLog = path.join(dir, 'st.log');
    const ports = { st: await pickPort(8200), cdp: await pickPort(9300), rpc: await pickPort(9527) };
    const host = '127.0.0.1'; const report = { name, ports, errors: [], blocked: [], bootMs };
    let st, chrome, page, server;
    const stop = async () => { try { server?.close(); } catch { } try { page?.close(); } catch { } await stopChild(chrome); await stopChild(st); };
    try {
        st = startST({ stDir, port: ports.st, dataRoot, configPath, log: stLog }); await waitHttp(`http://${host}:${ports.st}/`, st, stLog); mark('st');
        chrome = spawn(chromePath(), [...CHROME_FLAGS, `--remote-debugging-port=${ports.cdp}`, `--user-data-dir=${path.join(dir, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
        let version = null, target = null;
        for (let i = 0; i < 240 && !(version && target); i++) { try { version = await (await fetch(`http://127.0.0.1:${ports.cdp}/json/version`, { signal: AbortSignal.timeout(2000) })).json(); target = (await (await fetch(`http://127.0.0.1:${ports.cdp}/json`, { signal: AbortSignal.timeout(2000) })).json()).find(t => t.type === 'page'); } catch { } if (chrome.exitCode !== null) throw Error(`크롬이 꺼졌어요(코드 ${chrome.exitCode})`); if (!(version && target)) await sleep(150); }
        if (!target) throw Error('크롬이 준비되지 않았어요'); page = await connect(target.webSocketDebuggerUrl); mark('chrome');
        await page.send('Runtime.enable'); await page.send('Page.enable'); await page.send('Network.enable'); await page.send('Network.setCacheDisabled', { cacheDisabled: true });
        page.on('Runtime.exceptionThrown', e => report.errors.push((e.exceptionDetails.text + ': ' + (e.exceptionDetails.exception?.description || '')).slice(0, 300)));
        await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        page.on('Fetch.requestPaused', e => { void (async () => {
            if (blockedRequest({ url: e.request.url, method: e.request.method, resourceType: e.resourceType }, { host })) { report.blocked.push(String(e.request.url).split('?')[0].slice(0, 200)); return page.send('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' }); }
            return page.send('Fetch.continueRequest', { requestId: e.requestId });
        })().catch(() => { }); });
        const phone = async () => { await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 748, deviceScaleFactor: 4, mobile: true }); await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); };
        await phone(); await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
        const READY = '!!globalThis.Salty?.openPopup && !document.getElementById("preloader")';
        await page.send('Page.navigate', { url: `http://${host}:${ports.st}/` }); await page.waitFor(READY, 180000); mark('page');
        await ensureFonts(fontCache); report.fonts = await page.ev(fontScript(fontCache), 120000);
        const fxFile = path.join(dir, 'fixture-browser.js'); const fixtureScript = fs.existsSync(fxFile) ? fs.readFileSync(fxFile, 'utf8') : null;
        if (fixtureScript) report.fixtureBrowser = await page.ev(fixtureScript, 60000).catch(e => ({ error: String(e) }));
        mark('ready');
        server = http.createServer(async (req, res) => {
            let body = ''; for await (const c of req) body += c;
            try {
                const a = body ? JSON.parse(body) : {}; let result; const url = String(req.url || '').replace(/^\/[^/]*\/(?=(eval|goto|viewport|phone|shot|send|errors|fonts|fixture|mem|trim|info|stop)$)/, '/');
                switch (url) {
                    case '/eval': result = await page.ev(a.expr, a.timeout || 90000); break;
                    case '/goto': await page.send('Page.navigate', { url: `http://${host}:${ports.st}/` }); await page.waitFor(READY, 180000); result = true; break;
                    case '/viewport': await page.send('Emulation.setDeviceMetricsOverride', { width: a.w, height: a.h || 900, deviceScaleFactor: a.dpr || 1, mobile: a.w < 768 }); await page.send('Emulation.setTouchEmulationEnabled', { enabled: a.w < 768 }); result = true; break;
                    case '/phone': await phone(); result = true; break;
                    case '/shot': fs.mkdirSync(path.dirname(a.path), { recursive: true }); await page.shot(a.path, a.clip || null); result = a.path; break;
                    case '/send': result = await page.send(a.method, a.params || {}); break;
                    case '/errors': result = report.errors; break;
                    case '/fonts': result = await page.ev(fontScript(fontCache), 120000); break;
                    case '/fixture': result = fixtureScript ? await page.ev(fixtureScript, 60000) : { skipped: 'fixture none' }; break;
                    case '/mem': result = await page.ev('({heap: performance.memory?.usedJSHeapSize || null, nodes: document.getElementsByTagName("*").length})'); break;
                    case '/trim': result = true; break;
                    case '/info': result = { name, ports, host, target: 'theme', profile: 'synthetic', errors: report.errors.length, blocked: report.blocked.length, where: 'actions' }; break;
                    case '/stop': result = true; break;
                    default: throw new Error('unknown endpoint ' + url);
                }
                res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ result }));
            } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.stack || e) })); }
        });
        await new Promise(r => server.listen(ports.rpc, '127.0.0.1', r));
        const info = { name, ready: true, where: 'actions', rpc: `http://127.0.0.1:${ports.rpc}`, ports, bootMs, fonts: report.fonts, fixture: report.fixtureBrowser || null };
        fs.writeFileSync(path.join(dir, 'rig.json'), JSON.stringify(info, null, 2));
        // PC 리그 꼴 기록(rigs/<이름>/rig.json) — nav-fade 등 검사가 RPC 주소로 리그를 찾아 소스 경로(source)를 읽어요. 내릴 때 지워요
        const compat = rigsRoot ? path.join(rigsRoot, name, 'rig.json') : null;
        if (compat) { fs.mkdirSync(path.dirname(compat), { recursive: true }); fs.writeFileSync(compat, JSON.stringify({ ...info, source: theme, target: 'theme', profile: 'synthetic', dataRoot, extensions: path.join(dataRoot, 'default-user', 'extensions'), ownerPid: process.pid, host, url: `http://${host}:${ports.st}/` }, null, 2)); }
        log(`리그 ${name} 준비 ${Math.round((Date.now() - t0) / 1000)}초(실리태번 ${Math.round(bootMs.st / 1000)} · 크롬 ${Math.round((bootMs.chrome - bootMs.st) / 1000)} · 페이지 ${Math.round((bootMs.page - bootMs.chrome) / 1000)}초)`);
        return { rpc: info.rpc, info, report, stop: async () => { await stop(); if (rigsRoot) try { fs.rmSync(path.join(rigsRoot, name), { recursive: true, force: true }); } catch { } fs.writeFileSync(path.join(dir, 'rig-report.json'), JSON.stringify({ ...report, blocked: [...new Set(report.blocked)].slice(0, 50) }, null, 2)); } };
    } catch (e) { await stop(); const err = new Error(`리그 기동 실패: ${String(e.message || e).slice(0, 600)}`); err.toolError = true; err.stLogTail = (() => { try { return fs.readFileSync(stLog, 'utf8').slice(-2000); } catch { return ''; } })(); throw err; }
}

void HERE;
