// 사용 모드별 시작 한 번 재기 (1.0.2 제로 모드 · 기능별 비용표) — 가짜 브라우저(leak-dom.mjs · leak-loader.mjs)에서 index.js 를 띄우고
//   시작 15초 동안 받은 테마 모듈 · 붙인 시트 · fetch 로 받은 CSS · 남은 리스너 · MutationObserver 등록 · 인터벌 수를 JSON 한 줄로 내요.
//   모듈 캐시가 한 번뿐이라 모드마다 따로 띄워요(tools/tests/zero-mode.mjs 가 자식 프로세스로 불러요).
//   node tools/tests/mode-boot-probe.mjs <테마 루트> '<설정 JSON>' ['<다른 확장 설정 JSON>']   예: '{"enabled":true,"usageMode":"zero"}'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const settings = JSON.parse(process.argv[3] || '{"enabled":true}');
const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bl-mode-')), 'modules.txt');
fs.writeFileSync(log, '');
process.env.LEAK_MODLOG = log;
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
const { ctx, eventSource, chat: chatEl } = dom.installBrowser({ settings, extensionSettings: JSON.parse(process.argv[4] || '{}') });
dom.installHost(ctx);
const fetched = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => { fetched.push(String(input?.url ?? input)); return realFetch(input, init); };
const { register } = await import('node:module');
register(pathToFileURL(path.join(root, 'tools/tests/leak-loader.mjs')).href, { data: { root } });
const out = s => process.stdout.write(s + '\n');
for (const k of ['warn', 'error', 'info', 'debug', 'log']) console[k] = () => {};
const T = ctx.event_types, settle = ms => dom.clock.advance(ms);
for (let i = 0; i < 6; i++) { ctx.chat.push({ name: 'Char', is_user: false, is_system: false, mes: `메시지 ${i}`, extra: {}, swipes: [`메시지 ${i}`], swipe_id: 0 }); chatEl.append(dom.messageElement(i)); }
const before = dom.listenerCounts(eventSource);
await import(pathToFileURL(path.join(root, 'index.js')).href);
await settle(1000);
await eventSource.emit(T.APP_READY);
await eventSource.emit(T.CHAT_CHANGED, 'chat-1');
await settle(15000);
const modules = [...new Set(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean))];
const local = href => { try { const u = new URL(href, 'file:///'); return u.protocol === 'file:' ? path.relative(root, decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, '$1'))).split(path.sep).join('/') : href; } catch { return href; } };
const links = document.head.querySelectorAll('link').map(l => local(l.getAttribute('href') || '')).filter(Boolean);
const styles = document.querySelectorAll('style').map(s => (s.textContent || '').length);
const after = dom.listenerCounts(eventSource);
const obs = dom.observerCounts();
out(JSON.stringify({
    settings: JSON.parse(process.argv[3] || '{"enabled":true}'), modules, links, fetched: fetched.map(local), styleTags: styles.length, styleBytes: styles.reduce((a, b) => a + b, 0),
    listeners: { eventSource: after.eventSource - before.eventSource, window: after.window - before.window, document: after.document - before.document, elements: after.elements - before.elements },
    intervals: after.intervals, mo: obs.mo, ro: obs.ro.on, io: obs.io.on, pendingTimers: dom.clock.pending(), bodyClass: document.body.getAttribute('class') || '',
    salty: typeof globalThis.Salty === 'object', interceptor: typeof globalThis.blueLemonadeGenerate === 'function', errors: dom.errors.length,
}));
process.exit(0);
