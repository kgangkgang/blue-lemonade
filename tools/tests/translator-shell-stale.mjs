// 버그 사냥 4 — LLM 번역 껍데기(src/addons/translator/shell.js)가 본체를 받는 사이(폰에서 몇 초) 채팅이 바뀌거나 앞 메시지가 지워질 때.
//   고치기 전: 쌓아 둔 사건(답 그려짐 · 보냄 · 스와이프)과 처음 누른 번역 단추가 번호 글자만 들고 가서, 받은 뒤 새 채팅의 같은 번호 · 밀린 메시지에 작동했어요
//   (남의 메시지 번역 · 번역문 삭제 · 「보내기 번역」 이 다른 메시지의 mes 를 번역문으로 바꿔 씀).
//   실제 껍데기 코드를 격리 환경(vm)에서 돌려요 — 모델 · 네트워크 요청 없음.
//   node tools/tests/translator-shell-stale.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons/translator/shell.js'), 'utf8');
const code = source.slice(0, source.indexOf('export const ready ='))
    .replace(/^import [\s\S]*?;\s*$/gm, '').replace(/\bexport /g, '')
    .replace(/import\((['`]\.\/index\.js[^)]*)\)/g, 'loadBody($1)')
    .replace(/new URL\('\.\/', import\.meta\.url\)\.href/, "'blue://t/'");
const next = () => new Promise(resolve => setImmediate(resolve));

function rig() {
    const events = {}, chat = [{ mes: 'A0' }, { mes: 'A1' }, { mes: 'A2' }], seen = [], clicks = [];
    let key = 'A', release;
    const gate = new Promise(r => { release = r; });
    const eventSource = { on(type, fn) { (events[type] ??= []).push(fn); }, removeListener(type, fn) { events[type] = (events[type] || []).filter(x => x !== fn); } };
    const event_types = Object.fromEntries(['MESSAGE_SENT', 'USER_MESSAGE_RENDERED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'CHARACTER_RENAMED', 'CHAT_CHANGED'].map(x => [x, x]));
    const body = { ready: Promise.resolve(), replayEvent(type, args) { seen.push([type, String(args[0]), chat[Number(args[0])]?.mes]); }, clickButton(kind, id) { clicks.push([kind, String(id), chat[Number(id)]?.mes]); } };
    const context = vm.createContext({
        loadBody: async () => { await gate; return body; },
        eventSource, event_types, chat, getCurrentChatId: () => key, withReplay: async (_n, run) => run(),
        extension_settings: {}, getContext: () => ({}), SlashCommandParser: { commands: {} }, SlashCommand: {},
        glossaryScopeKeyOf() {}, glossaryScopeKeysOf: () => [], pickGlossaryEntries: () => [], chatGlossaryEntries: () => [], publishNames() {},
        console: { warn() {}, error() {} }, document: { querySelectorAll: () => [], getElementById: () => null }, Symbol, Number, String, Boolean, Set, Map, Promise,
    });
    vm.runInContext(code + '\nglobalThis.api={ensureBody,listen,onButton};', context);
    context.api.listen();
    const fire = (type, ...args) => [...(events[type] || [])].map(fn => fn(...args));
    const button = id => { const mes = { attr: String(id), getAttribute: () => mes.attr }; const el = { isConnected: true, classList: { contains: c => c === 'mes_llm_translate' }, closest: sel => (sel === '.mes' ? mes : el) }; return { el, mes }; };
    return { api: context.api, chat, seen, clicks, fire, button, release, setKey(k) { key = k; } };
}
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('통과: ' + name); };

await test('받는 사이 다른 채팅을 열면 쌓아 둔 사건을 넘기지 않아요(새 채팅의 같은 번호를 번역하지 않음)', async () => {
    const r = rig();
    r.fire('CHARACTER_MESSAGE_RENDERED', 2);
    r.fire('MESSAGE_SENT', 1);
    r.setKey('B'); r.chat.splice(0, 3, { mes: 'B0' }, { mes: 'B1' }, { mes: 'B2' });
    r.release(); await r.api.ensureBody(); await next();
    assert.deepEqual(r.seen, []);
});
await test('같은 채팅이면 넘겨요 · 앞 메시지가 지워져 번호가 밀린 사건은 버려요', async () => {
    const r = rig();
    r.fire('CHARACTER_MESSAGE_RENDERED', 2);
    r.fire('CHARACTER_RENAMED', 'x.png', 'y.png');
    r.fire('MESSAGE_SWIPED', 1);
    r.chat.splice(0, 1);   // A0 지움 → A1 이 0번, A2 가 1번
    r.release(); await r.api.ensureBody(); await next();
    assert.deepEqual(r.seen, [['CHARACTER_RENAMED', 'x.png', undefined]]);
});
await test('같은 채팅 · 그대로면 쌓인 차례대로 넘겨요', async () => {
    const r = rig();
    r.fire('MESSAGE_SENT', 1); r.fire('CHARACTER_MESSAGE_RENDERED', 2);
    r.release(); await r.api.ensureBody(); await next();
    assert.deepEqual(r.seen, [['MESSAGE_SENT', '1', 'A1'], ['CHARACTER_MESSAGE_RENDERED', '2', 'A2']]);
});
await test('처음 누른 번역 단추: 받는 사이 채팅이 바뀌면 그만 · 앞 메시지가 지워지면 지금 번호로 같은 메시지에', async () => {
    const a = rig(); const ba = a.button(2);
    a.api.onButton({ target: ba.el });
    a.setKey('B'); a.chat.splice(0, 3, { mes: 'B0' }, { mes: 'B1' }, { mes: 'B2' });
    a.release(); await a.api.ensureBody(); await next(); await next();
    assert.deepEqual(a.clicks, [], '다른 채팅');
    const b = rig(); const bb = b.button(2);
    b.api.onButton({ target: bb.el });
    b.chat.splice(0, 1); bb.mes.attr = '1';   // 실리태번이 mesid 를 다시 매겨요
    b.release(); await b.api.ensureBody(); await next(); await next();
    assert.deepEqual(b.clicks, [['translate', '1', 'A2']], '밀린 번호가 아니라 그 메시지');
    const c = rig(); const bc = c.button(1);
    c.api.onButton({ target: bc.el });
    bc.el.isConnected = false;
    c.release(); await c.api.ensureBody(); await next(); await next();
    assert.deepEqual(c.clicks, [], '단추가 사라졌으면 그만');
});
console.log(`translator-shell-stale: ${passed} passed`);
