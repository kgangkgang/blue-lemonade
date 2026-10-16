// 성능 보조 · 저장 정리 — 내용이 같은 채팅 저장만 건너뛰기 (src/addons/perf/savededupe.js 의 fetch 감싸개)
//   node tools/tests/perf-save-dedupe.mjs <테마 루트>
// 이 감싸개는 서버로 보내지 않고 「성공」을 돌려줄 수 있어, 잘못 건너뛰면 채팅 파일에 수정이 안 남는다. 진짜 모듈을 불러 감싸개를 그대로 쓴다.
// 실리태번 모듈(script.js · extensions.js · openai.js · group-chats.js)과 테마의 hub.js · addon-files-check.js 는 data: 스텁, 서버는 가짜 fetch.
// (스텁에 isChatSaving · isGenerating 이 없어 복구 · 바꾸기 막기는 켜지지 않는다 — 그 둘은 perf-save-recovery.mjs 가 본다)
// 확인하는 것:
//   1) 지난번에 성공한 본문과 똑같을 때만 건너뛰고 {"result":"ok"} — 한 글자라도 다르면 · 되돌린 본문(A→B→A)도 보낸다
//   2) 서버 실패(500) · 네트워크 끊김 뒤에는 기억을 지워 같은 본문을 다시 보낸다 (실패 응답은 그대로 돌려준다)
//   3) 겹친 저장: 앞 요청이 도는 중이면 같은 본문도 보낸다 · 응답 순서가 뒤바뀌면 어느 본문이 남았는지 모르니 기억하지 않는다
//   4) [1.0.1] 압축(바이트) 본문 · 끈 동안의 저장은 비교 없이 보내고 기억을 지운다 — 그 뒤 예전 본문으로 되돌린 저장(메시지 지우기)을 건너뛰지 않는다
//   5) 경로마다 따로 기억(그룹 저장) · 저장이 아닌 요청 · GET · Request 객체는 그대로
//   6) 설정 불러오기(initSettings): 저장된 끔(false)은 지키고 없는 값은 켬 · 모르는 키는 남김
// 지어낸 캐릭터 이름 · 지어낸 문장만 쓴다.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const perfDir = path.join(root, 'src/addons/perf');
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__perfDedupeTest = { ext: { save_dedupe: { enabled: true, recover: false, flushOnSwitch: false, custom: 'keep me' } } };
const ST = {
    '../../addon-files-check.js': js('export function verifyAddonCss() {}'),
    './hub.js': js('export function pane() { return null; }'),
    '../../../../../../extensions.js': js('export const extension_settings = globalThis.__perfDedupeTest.ext;\nexport function getContext() { return {}; }'),
    '../../../../../../../script.js': js("export const eventSource = { on() {} };\nexport const event_types = { APP_READY: 'app_ready' };\nexport function saveSettingsDebounced() {}"),
    '../../../../../../openai.js': js('export const promptManager = null;'),
    '../../../../../../group-chats.js': js('export const selected_group = null;'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(R) && S[spec]) return { url: S[spec], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, dir: pathToFileURL(perfDir).href } });

// ── 가짜 서버: 받은 요청을 적는다. hold 면 release 를 부를 때까지 응답을 미룬다
const sent = [];
let mode = { status: 200 };
const held = [];
const serverFetch = function (input, init = {}) {
    sent.push({ url: typeof input === 'string' ? input : input.url, method: init.method ?? input?.method, body: init.body });
    if (mode.offline) return Promise.reject(new TypeError('Failed to fetch'));
    const respond = status => new Response('{"saved":true}', { status, headers: { 'Content-Type': 'application/json' } });
    if (mode.hold) return new Promise(resolve => held.push(status => resolve(respond(status ?? 200))));
    return Promise.resolve(respond(mode.status));
};
const warn = console.warn;
globalThis.window = { fetch: serverFetch, addEventListener() {}, removeEventListener() {}, SillyTavern: undefined, jQuery: undefined };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, body: { dataset: {} } };
globalThis.location = { origin: 'http://st.test', href: 'http://st.test/' };
globalThis.jQuery = () => {};

await import(pathToFileURL(path.join(perfDir, 'savededupe.js')).href);
console.warn = warn;
const D = window.SaveDedupe;
assert.equal(typeof window.fetch, 'function');
assert.notEqual(window.fetch, serverFetch, 'savededupe wraps window.fetch');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
/** 실리태번 saveChat 이 만드는 꼴의 본문 */
const chatBody = (...lines) => JSON.stringify({ ch_name: 'Mina', file_name: 'Mina - 2026-01-02', chat: [{ user_name: 'You', character_name: 'Mina' }, ...lines.map((mes, i) => ({ name: i % 2 ? 'Mina' : 'You', mes }))], avatar_url: 'mina.png', force: false });
const groupBody = (...lines) => JSON.stringify({ id: 'tea-party-1', chat: lines.map(mes => ({ name: 'Mina', mes })) });
async function save(body, url = '/api/chats/save', extra = {}) {
    const res = await window.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, ...extra });
    await tick();
    return res;
}
const A = chatBody('창밖에 종이배가 떠 있어.', '그럼 같이 접어 볼까?');
const B = chatBody('창밖에 종이배가 떠 있어.', '그럼 같이 접어 볼까?', '파란 종이로 하자.');

await test('같은 본문을 다시 저장하면 서버로 보내지 않고 {"result":"ok"} 를 돌려준다', async () => {
    const before = sent.length;
    const first = await save(A);
    assert.equal(first.status, 200); assert.deepEqual(await first.json(), { saved: true });
    assert.equal(sent.length, before + 1);
    const again = await save(A);
    assert.equal(sent.length, before + 1, 'identical body skipped');
    assert.equal(again.status, 200); assert.deepEqual(await again.json(), { result: 'ok' });
    assert.equal(D.stats.skipped, 1); assert.equal(D.stats.skippedBytes, A.length); assert.equal(D.stats.sent, 1);
});

await test('한 글자라도 다르면 보내고 · 되돌린 본문(A→B→A)도 보낸다', async () => {
    const before = sent.length;
    await save(B);
    await save(A);
    assert.equal(sent.length, before + 2);
    assert.deepEqual(sent.slice(-2).map(s => s.body), [B, A]);
    await save(A.replace('종이배', '종이 배'));
    assert.equal(sent.length, before + 3, 'one space differs: sent');
    await save(A.replace('종이배', '종이 배'));
    assert.equal(sent.length, before + 3);
});

await test('서버 실패(500)나 네트워크 끊김 뒤에는 기억을 지워 같은 본문을 다시 보낸다 · 실패 응답은 그대로', async () => {
    const C = chatBody('비 오는 날의 우산 가게.');
    await save(C);
    const before = sent.length;
    mode = { status: 500 };
    const failed = await save(chatBody('비 오는 날의 우산 가게.', '노란 우산이 하나 남았어.'));
    assert.equal(failed.status, 500, 'the failure reaches SillyTavern');
    mode = { status: 200 };
    await save(chatBody('비 오는 날의 우산 가게.', '노란 우산이 하나 남았어.'));
    assert.equal(sent.length, before + 2, 'retry of a failed body is sent');
    await save(C);
    mode = { offline: true };
    await assert.rejects(save(C.replace('우산', '양산')), TypeError);
    mode = { status: 200 };
    await save(C.replace('우산', '양산'));
    assert.equal(sent.length, before + 5);
    await save(C.replace('우산', '양산'));
    assert.equal(sent.length, before + 5, 'remembered again after a success');
});

await test('겹친 저장: 앞 요청이 도는 중이면 같은 본문도 보내고 · 응답 순서가 뒤바뀌면 기억하지 않는다', async () => {
    const E = chatBody('등대지기가 불을 켰다.');
    const F = chatBody('등대지기가 불을 켰다.', '배가 돌아온다.');
    const before = sent.length;
    mode = { hold: true };
    const first = window.fetch('/api/chats/save', { method: 'POST', body: E });
    const second = window.fetch('/api/chats/save', { method: 'POST', body: E });
    assert.equal(sent.length, before + 2, 'in-flight: not compared');
    held.shift()(); held.shift()();
    await first; await second; await tick();
    mode = { status: 200 };
    await save(E);
    assert.equal(sent.length, before + 2, 'last issued finished last: remembered');
    mode = { hold: true };
    const older = window.fetch('/api/chats/save', { method: 'POST', body: F });
    const newer = window.fetch('/api/chats/save', { method: 'POST', body: E });
    await tick();
    const [releaseOlder, releaseNewer] = held.splice(0, 2);
    releaseNewer(); await newer; await tick();
    releaseOlder(); await older; await tick();
    mode = { status: 200 };
    await save(E);
    assert.equal(sent.length, before + 5, 'answers crossed: the server file may hold either body, so E is sent');
});

await test('[1.0.1] 압축(바이트) 본문 · 끈 동안의 저장은 비교 없이 보내고 기억을 지운다 — 되돌린 저장을 건너뛰지 않는다', async () => {
    const H = chatBody('고양이가 피아노 위에서 잔다.', '깨우지 말자.');
    const deleted = chatBody('고양이가 피아노 위에서 잔다.');
    await save(H);
    let before = sent.length;
    await save(new Uint8Array([31, 139, 8, 0, 1, 2, 3]));
    assert.equal(sent.length, before + 1, 'compressed bytes are always sent');
    await save(H);
    assert.equal(sent.length, before + 2, 'after a compressed save the old body is not trusted');
    await save(H);
    before = sent.length;
    T.ext.save_dedupe.enabled = false;
    await save(deleted);
    await save(deleted);
    assert.equal(sent.length, before + 2, 'disabled: nothing skipped');
    T.ext.save_dedupe.enabled = true;
    await save(H);
    assert.equal(sent.length, before + 3, 'a save made while disabled changed the file: H is sent again');
    assert.equal(sent.at(-1).body, H);
});

await test('경로마다 따로 기억(그룹 저장) · 저장이 아닌 요청 · GET · Request 객체는 그대로 보낸다', async () => {
    const G = groupBody('케이크는 딸기로.', '촛불은 세 개.');
    const before = sent.length;
    await save(G, '/api/chats/group/save');
    await save(G, '/api/chats/group/save');
    assert.equal(sent.length, before + 1);
    await save(G, '/api/chats/save');
    assert.equal(sent.length, before + 2, 'chat path keeps its own memory');
    await save('{"chat":"x"}', '/api/chats/get'); await save('{"chat":"x"}', '/api/chats/get');
    assert.equal(sent.length, before + 4, 'other endpoints pass through');
    await window.fetch('/api/chats/save', { method: 'GET' }); await window.fetch('/api/chats/save');
    assert.equal(sent.length, before + 6, 'GET passes through');
    await save(G, 'http://st.test/api/chats/group/save');
    assert.equal(sent.length, before + 6, 'absolute same-origin URL is the same path');
    await window.fetch(new Request('http://st.test/api/chats/group/save', { method: 'POST', body: G })); await tick();
    await save(G, '/api/chats/group/save');
    assert.equal(sent.length, before + 8, 'a Request object save (body unknown) clears the memory');
});

await test('설정 불러오기: 저장된 끔(false)은 지키고 · 없는 값은 켬 · 모르는 키는 남긴다', () => {
    const s = T.ext.save_dedupe;
    assert.equal(D.settings(), s);
    assert.deepEqual({ enabled: s.enabled, recover: s.recover, deferPromptRender: s.deferPromptRender, flushOnSwitch: s.flushOnSwitch, guardGeneration: s.guardGeneration, custom: s.custom },
        { enabled: true, recover: false, deferPromptRender: true, flushOnSwitch: false, guardGeneration: true, custom: 'keep me' });
    assert.equal(D.recovery, null, 'no isChatSaving in this SillyTavern stub: recovery stays off');
    assert.equal(D.switchFlush, null);
});

console.log(`perf-save-dedupe: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
