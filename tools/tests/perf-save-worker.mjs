// 성능 보조 — 큰 저장은 뒤에서 보내기 (src/addons/perf/savesend.js · save-worker.js · perfassist.js 의 fetch 감싸개)
//   node tools/tests/perf-save-worker.mjs <테마 루트>
// 채팅 · 설정 저장을 워커가 대신 보낸다. 잘못되면 저장이 사라지거나(안 보냄) 옛 본문이 새 저장을 덮는다(다시 보냄).
// 앞부분은 createSaveSender 에 가짜 워커 · 가짜 시계를 넣어 본다. 뒷부분은 진짜 perfassist.js 를 불러(실리태번 모듈 · hub · addon-files-check 는 data: 스텁)
// 가짜 Worker 안에서 진짜 save-worker.js 를 node:vm 으로 돌리고, 가짜 서버가 「워커로 왔는지 · 원래 fetch 로 왔는지」를 적는다.
// 확인하는 것:
//   1) 워커로 보낼 요청: 같은 출처 · POST · 문자열 본문 10만 자 이상 · 저장 경로 셋만 (keepalive · Request 객체 · 다른 출처 · 이상한 signal 은 원래 fetch)
//   2) 켤 때 /api/ping 을 워커와 메인에서 같은 머리로 보내 상태가 같아야 씀 · 다르거나 워커를 못 만들면 원래 fetch
//   3) 응답을 같은 상태 · 머리 · 본문의 Response 로 (204 는 본문 없음) · 실패는 TypeError · 멈춤 신호는 signal.reason 으로 거부하고 워커 요청도 끊음
//   4) 워커 오류: 보내던 저장을 원래 fetch 로 한 번 다시 · [1.0.1] 말없이 멈춘 워커: 8초 뒤 묻고 4초 안에 대답 없으면 실패로 돌려주고 다시 보내지 않음
//      대답(pong)하면 계속 기다리되 2분(보이는 시간)이 상한 · 가려진 시간 · 멈췄던 타이머의 한꺼번 시간은 세지 않음
//   5) [6.7.5] perfassist 감싸개가 채팅 저장 관문을 워커보다 먼저 부름 (관문이 미루면 서버에 아무것도 안 감)
//   6) [6.7.1] 채팅 저장이 성공했을 때만 bl:chat-saved 를 본문과 함께 알림 (실패 · 설정 저장 · GET 은 안 알림) · 설정 불러오기
// 지어낸 캐릭터 이름 · 지어낸 문장만 쓴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || '.');
const perfDir = path.join(root, 'src/addons/perf');
const S = await import(pathToFileURL(path.join(perfDir, 'savesend.js')).href);
const O = 'http://st.test';

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };
const big = JSON.stringify({ ch_name: 'Mina', file_name: 'Mina - 2026-01-02', chat: Array.from({ length: 2600 }, (_, i) => ({ name: i % 2 ? 'Mina' : 'You', mes: `가상의 줄 ${i}: 바람이 분다, 연이 난다.` })), avatar_url: 'mina.png', force: false });
assert.ok(big.length >= S.MIN_CHARS, 'fixture is a big save');

// ── 가짜 시계 (보이는 시간 셈을 보려고): jump 는 타이머가 멈춘 채 시간만 흐름 (폰에서 앱을 내렸다 돌아옴)
function clock() {
    let t = 0;
    const timers = new Set();
    return {
        now: () => t,
        setTimer(fn, ms) { const id = { at: t + ms, fn }; timers.add(id); return id; },
        clearTimer(id) { timers.delete(id); },
        jump(ms) { t += ms; },
        async advance(ms) {
            const end = t + ms;
            for (;;) {
                let next = null;
                for (const x of timers) if (x.at <= end && (!next || x.at < next.at)) next = x;
                if (!next) break;
                timers.delete(next); t = Math.max(t, next.at); next.fn(); await flush();
            }
            t = end;
        },
    };
}
function fakeWorker() {
    const w = {
        posted: [], listeners: { message: [], error: [] }, terminated: false, closed: false,
        postMessage(msg) { if (w.closed) throw new Error('worker closed'); w.posted.push(structuredClone(msg)); },
        addEventListener(type, fn) { w.listeners[type].push(fn); },
        terminate() { w.terminated = true; },
        reply(data) { for (const fn of w.listeners.message) fn({ data }); },
        crash() { for (const fn of w.listeners.error) fn(new Event('error')); },
        sends: () => w.posted.filter(m => m.type === 'send'),
        count: type => w.posted.filter(m => m.type === type).length,
    };
    return w;
}
function setup({ worker = fakeWorker(), createWorker = () => worker, pingStatus = 200 } = {}) {
    const c = clock(), native = [], disabled = [];
    const env = {
        enabled: true, hidden: false, c, native, disabled, worker,
    };
    env.sender = S.createSaveSender({
        nativeFetch: (input, init) => { native.push([input, init]); return Promise.resolve(new Response(String(input).endsWith('/api/ping') ? 'pong' : '{"native":true}', { status: String(input).endsWith('/api/ping') ? pingStatus : 200 })); },
        createWorker, origin: O, enabled: () => env.enabled, Response, Headers,
        testHeaders: () => ({ 'X-CSRF-Token': 'csrf-test' }), onDisabled: why => disabled.push(why),
        now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer, hidden: () => env.hidden,
    });
    env.ready = async (status = 200) => {
        const started = env.sender.start();
        await flush();
        const ping = worker.sends()[0];
        worker.reply({ type: 'done', id: ping.id, status, statusText: '', headers: [], body: 'pong' });
        return started;
    };
    env.save = (extra = {}) => env.sender.send('/api/chats/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: big, ...extra });
    return env;
}
const outcome = p => p.then(v => ({ ok: v }), e => ({ error: e }));

await test('워커로 보낼 요청: 같은 출처 POST · 문자열 10만 자 이상 · 저장 경로 셋만 · 넘길 init 은 머리 목록과 안전한 키만', () => {
    const body = 'x'.repeat(S.MIN_CHARS);
    for (const [input, init] of [['/api/chats/save', { method: 'POST', body }], ['/api/chats/group/save', { method: 'post', body }], [new URL('/api/settings/save', O), { method: 'POST', body }],
        [`${O}/api/chats/save`, { method: 'POST', body, signal: new AbortController().signal }]]) assert.equal(S.eligible(input, init, O), true, String(input));
    const no = [['/api/chats/save', { method: 'POST', body: body.slice(1) }], ['/api/chats/save', { method: 'GET', body }], ['/api/chats/save', { body }],
        ['/api/chats/save', { method: 'POST', body, keepalive: true }], [new Request(`${O}/api/chats/save`, { method: 'POST', body }), { method: 'POST', body }],
        ['http://other.test/api/chats/save', { method: 'POST', body }], ['/api/chats/get', { method: 'POST', body }], ['/api/chats/save', { method: 'POST', body: new TextEncoder().encode(body) }],
        ['/api/chats/save', undefined], ['/api/chats/save', { method: 'POST', body, signal: {} }]];
    for (const [input, init] of no) assert.equal(S.eligible(input, init, O), false, `${input} ${JSON.stringify(Object.keys(init ?? {}))}`);
    assert.equal(S.pathOf('http://[broken', O), ''); assert.equal(S.pathOf('/api/x?y=1', O), '/api/x');
    const signal = new AbortController().signal;
    assert.deepEqual(S.portableInit({ method: 'post', body: 'b', headers: { 'X-CSRF-Token': 't', 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-cache', signal, keepalive: false }, Headers),
        { method: 'POST', body: 'b', headers: [['content-type', 'application/json'], ['x-csrf-token', 't']], credentials: 'same-origin', cache: 'no-cache' });
});

await test('켜기: /api/ping 을 워커 · 메인에서 같은 머리로 · 상태가 같으면 ready · 다르면(403/200) · 워커를 못 만들면 원래 fetch', async () => {
    const e = setup();
    assert.equal(e.sender.start(), e.sender.start(), 'one start');
    assert.equal(await e.ready(), true); assert.equal(e.sender.state(), 'ready');
    assert.deepEqual(e.worker.sends()[0], { type: 'send', id: 1, url: `${O}/api/ping`, init: { method: 'POST', headers: [['x-csrf-token', 'csrf-test']] } });
    assert.deepEqual(e.native[0], ['/api/ping', { method: 'POST', headers: { 'X-CSRF-Token': 'csrf-test' } }]);
    const bad = setup();
    assert.equal(await bad.ready(403), false);
    assert.equal(bad.sender.state(), 'broken'); assert.match(bad.sender.reason(), /403 \/ 200/); assert.equal(bad.worker.terminated, true);
    assert.equal(bad.disabled.length, 1);
    await bad.save();
    assert.equal(bad.native.length, 2, 'save goes through the original fetch'); assert.equal(bad.worker.sends().length, 1);
    const none = setup({ createWorker: () => { throw new Error('no worker'); } });
    assert.equal(await none.sender.start(), false); assert.match(none.sender.reason(), /워커를 만들 수 없음/);
    const down = setup({ pingStatus: 500 });
    assert.equal(await down.ready(500), false, 'server not ok: not used even when both agree');
});

await test('ready 뒤 큰 저장은 워커로: 같은 주소 · 머리 · 본문 · 응답은 같은 상태/머리/본문의 Response · 204 는 본문 없음 · 그 밖은 원래 fetch', async () => {
    const e = setup();
    await e.ready();
    const nativeBefore = e.native.length;
    const p = e.save();
    const msg = e.worker.sends().at(-1);
    assert.deepEqual(msg, { type: 'send', id: msg.id, url: `${O}/api/chats/save`, init: { method: 'POST', body: big, headers: [['content-type', 'application/json']] } });
    e.worker.reply({ type: 'done', id: msg.id, status: 200, statusText: 'OK', headers: [['content-type', 'application/json'], ['x-note', 'saved']], body: '{"result":"ok"}' });
    const res = await p;
    assert.equal(res.status, 200); assert.equal(res.statusText, 'OK'); assert.equal(res.headers.get('x-note'), 'saved'); assert.equal(await res.text(), '{"result":"ok"}');
    const empty = e.sender.send('/api/settings/save', { method: 'POST', body: big });
    e.worker.reply({ type: 'done', id: e.worker.sends().at(-1).id, status: 204, statusText: 'No Content', headers: [], body: '' });
    const r204 = await empty;
    assert.equal(r204.status, 204); assert.equal(await r204.text(), '');
    assert.equal(e.native.length, nativeBefore, 'the original fetch is not used');
    e.worker.reply({ type: 'done', id: 999, status: 200, headers: [], body: '' });
    await e.sender.send('/api/chats/save', { method: 'POST', body: 'short' });
    await e.sender.send('/api/chats/get', { method: 'POST', body: big });
    e.enabled = false; await e.save(); e.enabled = true;
    assert.equal(e.native.length, nativeBefore + 3);
    assert.equal(e.sender.stats.sent, 2);
});

await test('워커 실패는 TypeError · 멈춤 신호는 signal.reason 으로 거부하고 워커 요청도 끊는다 · 이미 멈춘 신호는 보내지 않는다', async () => {
    const e = setup();
    await e.ready();
    const failed = outcome(e.save());
    e.worker.reply({ type: 'fail', id: e.worker.sends().at(-1).id, name: 'TypeError', message: 'NetworkError when attempting to fetch resource.' });
    const f = await failed;
    assert.ok(f.error instanceof TypeError); assert.match(f.error.message, /NetworkError/);
    const controller = new AbortController(), reason = new Error('사용자가 멈춤');
    const stopped = outcome(e.save({ signal: controller.signal }));
    const id = e.worker.sends().at(-1).id;
    controller.abort(reason);
    assert.equal((await stopped).error, reason);
    assert.deepEqual(e.worker.posted.at(-1), { type: 'abort', id });
    e.worker.reply({ type: 'done', id, status: 200, headers: [], body: '' });
    assert.equal(e.sender.pending(), 0);
    const sends = e.worker.sends().length, early = new AbortController();
    early.abort(reason);
    assert.equal((await outcome(e.save({ signal: early.signal }))).error, reason);
    assert.equal(e.worker.sends().length, sends);
});

await test('워커 오류: 보내던 저장은 원래 fetch 로 한 번 다시 보내고 · 이후로는 워커를 쓰지 않는다 · 보내기가 막히면 원래 fetch', async () => {
    const e = setup();
    await e.ready();
    const init = { method: 'POST', body: big };
    const p = e.sender.send('/api/chats/save', init);
    const before = e.native.length;
    e.worker.crash();
    const res = await p;
    assert.deepEqual(await res.json(), { native: true });
    assert.equal(e.native.length, before + 1); assert.equal(e.native.at(-1)[1], init, 'same init re-sent once');
    assert.equal(e.sender.stats.resent, 1); assert.equal(e.sender.state(), 'broken'); assert.equal(e.worker.terminated, true);
    assert.deepEqual(e.disabled, ['워커 오류']);
    await e.save();
    assert.equal(e.native.length, before + 2); assert.equal(e.worker.sends().length, 2);
    const closed = setup();
    await closed.ready();
    closed.worker.closed = true;
    const r = await closed.save();
    assert.deepEqual(await r.json(), { native: true }); assert.equal(closed.sender.stats.native, 1);
});

await test('[1.0.1] 말없이 멈춘 워커: 8초 뒤 묻고 4초 안에 대답이 없으면 그 저장을 실패로 돌려준다 — 같은 본문을 다시 보내지 않는다', async () => {
    const e = setup();
    await e.ready();
    const before = e.native.length;
    const p = outcome(e.save());
    const id = e.worker.sends().at(-1).id;
    await e.c.advance(7000);
    assert.equal(e.worker.count('ping'), 0);
    await e.c.advance(1000);
    assert.equal(e.worker.count('ping'), 1, 'asks after 8 s');
    await e.c.advance(3000);
    assert.equal(e.sender.pending(), 1, 'still waiting for a pong');
    await e.c.advance(1000);
    const r = await p;
    assert.ok(r.error instanceof TypeError); assert.match(r.error.message, /워커 응답 없음/);
    assert.equal(e.native.length, before, 'the stale body is not re-sent');
    assert.ok(e.worker.posted.some(m => m.type === 'abort' && m.id === id)); assert.equal(e.worker.terminated, true);
    assert.equal(e.sender.stats.timedOut, 1); assert.deepEqual(e.disabled, ['워커 응답 없음']);
    await e.save();
    assert.equal(e.native.length, before + 1, 'later saves use the original fetch');
});

await test('[1.0.1] 대답(pong)하면 계속 기다리되 보이는 시간 2분이 상한 · 가려진 시간 · 멈췄던 타이머의 한꺼번 시간은 세지 않는다', async () => {
    const e = setup();
    await e.ready();
    const before = e.native.length;
    let settled = null;
    const p = e.save().then(v => { settled = { ok: v }; }, err => { settled = { error: err }; });
    e.hidden = true;
    await e.c.advance(60000);
    assert.equal(e.worker.count('ping'), 0, 'hidden time is not counted');
    e.hidden = false;
    e.c.jump(60000);
    await e.c.advance(1000);
    assert.equal(e.worker.count('ping'), 0, 'a frozen-timer jump counts as two ticks at most');
    let pongs = 0, steps = 0;
    while (!settled && steps < 300) {
        await e.c.advance(1000); steps++;
        const asked = e.worker.count('ping');
        if (!settled && asked > pongs) { e.worker.reply({ type: 'pong' }); pongs = asked; }
    }
    await p;
    // 보이는 시간: 멈췄던 1분은 두 틱(2초) + 그 뒤 틱 1초 = 3초, 그다음 117초 더 = 120초에서 포기
    assert.equal(steps, 117, 'gives up at 120 s of visible time, not earlier and not later');
    assert.ok(pongs >= 13, `answered pings kept the save alive (${pongs})`);
    assert.ok(settled?.error instanceof TypeError); assert.match(settled.error.message, /저장 응답이 너무 늦음/);
    assert.equal(e.native.length, before);
});

// ── perfassist.js: 진짜 모듈 + 진짜 save-worker.js (가짜 Worker 안에서 node:vm 으로)
const T = globalThis.__perfWorkerTest = { ext: { perf_assist: { morphStream: false, saveInWorker: 'yes', extra: 1 } } };
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const ST = {
    '../../addon-files-check.js': js('export function verifyAddonCss() {}'),
    './hub.js': js('export function pane() { return null; }'),
    '../../../../../../extensions.js': js('export const extension_settings = globalThis.__perfWorkerTest.ext;'),
    '../../../../../../../script.js': js("export const eventSource = { on() {}, makeFirst() {} };\nexport const event_types = { APP_READY: 'app_ready' };\nexport function getRequestHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-test' }; }\nexport function saveSettingsDebounced() {}"),
    '../../../../../../openai.js': js('export const promptManager = null;'),
    '../../../../../../power-user.js': js('export const power_user = {};'),
    '../../../../../../chats.js': js('export const encodeStyleTags = t => t; export const decodeStyleTags = t => t; export const isExternalMediaAllowed = () => true;'),
    '../../../../../../../lib.js': js('export function morphdom() {}'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(R) && S[spec]) return { url: S[spec], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, dir: pathToFileURL(perfDir).href } });

const order = [], requests = [], workers = [];
let failChatSave = false;
function server(via, input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input), O);
    requests.push({ via, path: url.pathname, method: init.method ?? 'GET', body: init.body });
    order.push('server:' + via);
    const status = failChatSave && url.pathname === '/api/chats/save' ? 500 : 200;
    return Promise.resolve(new Response(url.pathname === '/api/ping' ? 'pong' : '{"ok":true}', { status, headers: { 'Content-Type': 'application/json' } }));
}
class FakeWorker {
    listeners = { message: [], error: [] };
    constructor(url) {
        this.url = String(url);
        workers.push(this);
        const self = { onmessage: null, postMessage: msg => setImmediate(() => this.listeners.message.forEach(fn => fn({ data: structuredClone(msg) }))) };
        this.self = self;
        const file = fileURLToPath(this.url.split('?')[0]);
        vm.runInNewContext(fs.readFileSync(file, 'utf8'), { self, fetch: (u, init) => server('worker', u, init), AbortController, console, structuredClone });
    }
    postMessage(msg) { setImmediate(() => this.self.onmessage?.({ data: structuredClone(msg) })); }
    addEventListener(type, fn) { this.listeners[type].push(fn); }
    terminate() { this.terminated = true; }
}
const saved = [];
globalThis.Element = class Element {};
globalThis.window = Object.assign(new EventTarget(), { fetch: (input, init) => server('native', input, init) });
window.addEventListener('bl:chat-saved', e => saved.push(e.detail));
globalThis.Worker = FakeWorker;
globalThis.location = { origin: O, href: O + '/' };
globalThis.document = { visibilityState: 'visible', createElement: () => ({}), getElementById: () => null, querySelectorAll: () => [] };
globalThis.jQuery = () => {};
globalThis.SillyTavern = { getContext: () => ({}) };
const warn = console.warn;
console.warn = () => {};
try { await import(pathToFileURL(path.join(perfDir, 'perfassist.js')).href); } finally { console.warn = warn; }
const PA = window.PerfAssist;
for (let i = 0; i < 20 && PA.saver.state() !== 'ready'; i++) await flush();
const GUARD = Symbol.for('blue-lemonade.chat-save-guard');
const reset = () => { order.length = 0; requests.length = 0; saved.length = 0; };

await test('perfassist 켜기: 진짜 save-worker.js 로 /api/ping 시험을 통과 · 워커 주소에 판 번호(캐시 막기) · 설정 불러오기는 끔(false)만 지킴', async () => {
    assert.equal(PA.saver.state(), 'ready');
    assert.equal(workers.length, 1); assert.match(workers[0].url, new RegExp(`/save-worker\\.js\\?v=${PA.version.replace(/\./g, '\\.')}$`));
    assert.deepEqual(requests.filter(r => r.path === '/api/ping').map(r => r.via).sort(), ['native', 'worker']);
    const s = T.ext.perf_assist;
    assert.deepEqual({ morphStream: s.morphStream, deferPromptList: s.deferPromptList, saveInWorker: s.saveInWorker, dedupeStyles: s.dedupeStyles, extra: s.extra },
        { morphStream: false, deferPromptList: true, saveInWorker: true, dedupeStyles: true, extra: 1 });
    assert.equal(PA.unavailable.saveInWorker, '');
});

await test('[6.7.5] 채팅 저장 관문을 워커보다 먼저 부른다 · 관문이 미루면 서버에 아무것도 가지 않는다 · 관문이 없으면 그대로 보낸다', async () => {
    reset();
    let decision = 'hold', seen = null;
    globalThis[GUARD] = (input, init, send) => { order.push('guard'); seen = [input, init]; return decision === 'hold' ? Promise.resolve(new Response('{"held":true}')) : send(); };
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: big };
    const held = await window.fetch('/api/chats/save', init);
    await flush();
    assert.deepEqual(await held.json(), { held: true });
    assert.deepEqual(order, ['guard']); assert.equal(requests.length, 0, 'nothing reached the server');
    assert.equal(seen[0], '/api/chats/save'); assert.equal(seen[1], init);
    assert.deepEqual(saved, [], 'a held save is not announced');
    decision = 'send';
    const res = await window.fetch('/api/chats/save', init);
    await flush();
    assert.deepEqual(order, ['guard', 'guard', 'server:worker']);
    assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true });
    assert.equal(requests[0].body, big, 'the worker delivered the same body');
    delete globalThis[GUARD];
    reset();
    await window.fetch('/api/chats/save', init); await flush();
    assert.deepEqual(order, ['server:worker']);
});

await test('[6.7.1] 채팅 저장이 성공했을 때만 bl:chat-saved (경로 · 본문) — 실패 · 설정 저장 · GET 은 알리지 않는다', async () => {
    reset();
    await window.fetch('/api/chats/save', { method: 'POST', body: big });
    await window.fetch(`${O}/api/chats/group/save`, { method: 'POST', body: '{"id":"tea-party-1","chat":[]}' });
    await window.fetch('/api/settings/save', { method: 'POST', body: big });
    await window.fetch('/api/chats/save');
    failChatSave = true;
    const failed = await window.fetch('/api/chats/save', { method: 'POST', body: big });
    failChatSave = false;
    await flush();
    assert.equal(failed.status, 500);
    assert.deepEqual(saved, [{ path: '/api/chats/save', body: big }, { path: '/api/chats/group/save', body: '{"id":"tea-party-1","chat":[]}' }]);
    assert.deepEqual(requests.map(r => [r.via, r.path, r.method]), [
        ['worker', '/api/chats/save', 'POST'], ['native', '/api/chats/group/save', 'POST'], ['worker', '/api/settings/save', 'POST'],
        ['native', '/api/chats/save', 'GET'], ['worker', '/api/chats/save', 'POST'],
    ]);
});

console.log(`perf-save-worker: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
