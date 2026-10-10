import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { parseNaturalSlash: parse, naturalSlashLabel: label, runNaturalSlash: run, startNaturalSlash: start } = await import(pathToFileURL(path.join(root, 'src/natural-slash.js')));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const commands = { help: {}, echo: {}, stop: {}, 'chat-jump': {}, '한글명령': {}, 240: {} };
await test('message aliases use native visible #0 numbering, including fullwidth digits and valid grouping', () => {
    for (const text of ['/240번 채팅으로 가기', '/240번 메시지로 이동', '/240으로', '/#240', '/메시지 240번으로 가줘', '/２４０번채팅가기']) assert.deepEqual(parse(text), { kind: 'jump', index: 240 }, text);
    assert.deepEqual(parse('/0번 메시지'), { kind: 'jump', index: 0 });
    assert.deepEqual(parse('/1,240번으로'), { kind: 'jump', index: 1240 });
});
await test('regular messages and existing native/extension commands are untouched', () => {
    for (const text of ['240번 채팅으로 가기', 'hello', '/echo "240번으로" | /stop', '/help', '/stop', '/chat-jump 240', '/한글명령 내용', '/240', '/한글명령|/echo ok', '/240|/echo ok', '/한글명령:}']) assert.equal(parse(text, commands), null, text);
    assert.equal(parse('/unknown args | /echo hi'), null);
    assert.equal(parse('/맨 위로', { 맨: {} }), null);
});
await test('explicit common spelling alias accepts 체팅 without guessing numbers or replacing search content', () => {
    for (const text of ['/240번 체팅으로 가기', '/체팅 240번으로', '/240 번 체팅 으로 가기']) assert.deepEqual(parse(text), { kind: 'jump', index: 240 });
    assert.deepEqual(parse('/체팅 검색 체팅'), { kind: 'search', query: '체팅' });
    assert.equal(parse('/체팅 anything', { 체팅: {} }), null);
    assert.equal(parse('/24O번 체팅으로 가기').kind, 'invalid');
    assert.equal(parse('/2 4 0번 체팅으로 가기').kind, 'invalid');
    assert.deepEqual(parse('/240번 채딩으로 가기'), { kind: 'jump', index: 240 });
});
await test('small Korean command-word typos work across navigation, search, stop and help', () => {
    for (const text of ['/240번 채팀으로 가기', '/240번 채팅으로 이동헤줘']) assert.deepEqual(parse(text), { kind: 'jump', index: 240 }, text);
    for (const text of ['/맨 아레로', '/아레로', '/마지맠으로']) assert.deepEqual(parse(text), { kind: 'bottom' }, text);
    assert.deepEqual(parse('/처움으로'), { kind: 'top' });
    for (const text of ['/생성 멈춰죠', '/멈춰죠']) assert.deepEqual(parse(text), { kind: 'stop' });
    assert.deepEqual(parse('/도음말'), { kind: 'help' });
    assert.deepEqual(parse('/대화 검샥 체팀 약속'), { kind: 'search', query: '체팀 약속' });
    assert.deepEqual(parse('/겅색 "원문은 그데로"'), { kind: 'search', query: '원문은 그데로' });
    for (const query of ['12 34', '가지않아', '삭제 정리 못멈춰', '아주 긴 검색어 '.repeat(20).trim()]) assert.deepEqual(parse('/대화 검샥 ' + query), { kind: 'search', query });
});
await test('fuzzy matching preserves ambiguity, unsupported actions, numbers and registered names', () => {
    for (const text of ['/맨으로', '/240번 삭제', '/240번 수정', '/240번 재생성', '/240번 막기', '/240번 이동안해', '/24O번 이동헤줘', '/-1번 이동헤줘', '/1.5번 이동헤줘', '/1,24번 이동헤줘', '/검색약속', '/대화 검샥 "x|y"', '/대훼 검샥 약속', '/' + '한'.repeat(10000)]) assert.equal(parse(text).kind, 'invalid', text.slice(0,80));
    assert.equal(parse('/채팀 240', { 채팀: {} }), null);
    assert.equal(parse('/:한글QR'), null);
    assert.equal(parse('/{: '), null);
    assert.equal(parse('/ecoh 안녕'), null);
    assert.equal(parse('/대화 검색 체팀').query, '체팀');
    for (const text of ['/240번 못가', '/생성 못멈춰', '/생성 정리', '/240번 가지마', '/생성 중지마', '/대화 안검색 약속', '/대화 못검색 약속', '/안 위로', '/안 아래로', '/위로 안', '/안 그만', '/위로 마', '/아래로 마', '/마 위로']) assert.equal(parse(text).kind, 'invalid', text);
});
await test('invalid numbers and unknown Korean requests never become an operation', () => {
    for (const text of ['/-1번으로', '/1.5번으로', '/1,24번으로', '/9007199254740993번으로', '/240번째', '/240번 삭제', '/전체 삭제', '/240으로 | /del 10', '/240으로\n/stop', '/원하는 대화로 가기']) assert.equal(parse(text).kind, 'invalid', text);
});
await test('top/bottom/stop/help are curated exact expressions', () => {
    for (const text of ['/맨 위로', '/처음으로 가기', '/첫 메시지로 이동', '/상단으로', '/최상단으로']) assert.equal(parse(text).kind, 'top', text);
    for (const text of ['/맨 아래로', '/마지막으로 가기', '/최신 메시지로 이동', '/밑으로', '/맨밑으로', '/끝으로', '/하단으로', '/최하단으로']) assert.equal(parse(text).kind, 'bottom', text);
    for (const text of ['/생성 중지', '/답변 멈춰줘', '/응답을 중지해줘']) assert.equal(parse(text).kind, 'stop', text);
    for (const text of ['/', '/도움말', '/명령어 도움말']) assert.equal(parse(text).kind, 'help', text);
});
await test('known direction words never get corrected to the opposite direction', () => {
    for (const text of ['/위로 이돔', '/최상단으로 가죠']) assert.equal(parse(text).kind, 'top', text);
    for (const text of ['/밑으로 이돔', '/최하단으로 가죠']) assert.equal(parse(text).kind, 'bottom', text);
    for (const text of ['/맨이로', '/맨위밑으로', '/위아래로', '/최단으로', '/뒤로 가기', '/앞으로', '/하위로', '/상위로', '/다음으로 가기', '/이전으로']) assert.equal(parse(text).kind, 'invalid', text);
});
await test('search keeps literal query text, strips paired outer quotes, refuses empty and pipelines', () => {
    assert.deepEqual(parse('/대화 검색 "기다리던 약속"'), { kind: 'search', query: '기다리던 약속' });
    assert.deepEqual(parse('/채팅 찾아줘 a.*b'), { kind: 'search', query: 'a.*b' });
    assert.equal(parse('/대화 검색').kind, 'invalid');
    assert.equal(parse('/대화 검색 약속 | /del').kind, 'invalid');
});
const jumps = [];
const chat = Array.from({ length: 301 }, (_, id) => ({ mes: `message ${id}`, extra: {} }));
chat[2].mes = 'A.*B'; chat[240].extra.display_text = '약속 A.*B';
const ctx = { chat, chatId: 'fixture', characterId: 0, SlashCommandParser: { commands: { 'chat-jump': { callback: async (args, id) => { assert.deepEqual(args, {}); jumps.push(id); } } } }, stopGeneration: () => true };
await test('navigation delegates to real native command with one validated numeric argument', async () => {
    const before = JSON.stringify(chat);
    assert.equal((await run(parse('/240번 채팅으로 가기'), ctx)).index, 240);
    await run(parse('/맨 위로'), ctx); await run(parse('/맨 아래로'), ctx);
    assert.deepEqual(jumps, ['240', '0', '300']);
    assert.equal(JSON.stringify(chat), before);
});
await test('range/no-chat/unsupported guard never invokes a command', async () => {
    const count = jumps.length;
    assert.equal((await run({ kind: 'jump', index: 301 }, ctx)).ok, false);
    assert.equal((await run({ kind: 'jump', index: -1 }, ctx)).ok, false);
    assert.equal((await run({ kind: 'jump', index: 0 }, { ...ctx, chat: [] })).ok, false);
    assert.equal((await run({ kind: 'jump', index: 0 }, { ...ctx, SlashCommandParser: {} })).ok, false);
    assert.equal(jumps.length, count);
    assert.match(label({ kind: 'jump', index: 400 }, 301), /#0~#300/);
});
await test('literal all-message search cycles results and resets when chat changes', async () => {
    const state = {};
    const action = parse('/대화 검색 a.*b');
    assert.equal((await run(action, ctx, state)).index, 2);
    assert.equal((await run(action, ctx, state)).index, 240);
    assert.equal((await run(action, ctx, state)).index, 2);
    assert.equal((await run(action, { ...ctx, chatId: 'another' }, state)).index, 2);
    assert.equal((await run(parse('/대화 검색 missing'), ctx, state)).ok, false);
});
await test('failed native search navigation retries the same result', async () => {
    const attempted = []; const state = {};
    const host = { ...ctx, chat: [{ mes:'hit' }, { mes:'hit' }], SlashCommandParser:{commands:{'chat-jump':{callback:async (_args,id)=>{attempted.push(id);if(attempted.length===1)throw Error('test failure');}}}} };
    await assert.rejects(run(parse('/검색 hit'),host,state));
    await run(parse('/검색 hit'),host,state);
    assert.deepEqual(attempted,['0','0']);
});
await test('stop uses only the host stop API; help/error do not call it', async () => {
    let stops = 0;
    const host = { ...ctx, stopGeneration: () => { stops++; return false; } };
    assert.match((await run(parse('/생성 중지'), host)).message, /진행 중인 생성이 없/);
    await run(parse('/도움말'), host); await run(parse('/전체 삭제'), host);
    assert.equal(stops, 1);
});

// Route events through the shipped UI adapter, with host-only boundaries stubbed.
const listeners = {};
const events = {};
let enabled = true;
let sendOnEnter = true;
let hint;
let observer;
const input = { value: '', dispatchEvent: event => { event.target = input; for (const fn of listeners[event.type] || []) fn(event); } };
const host = { prepend: element => { hint = element; } };
globalThis.Event = class { constructor(type) { this.type = type; } };
globalThis.document = {
    body: { toggleAttribute() {}, removeAttribute() {} }, getElementById: id => id === 'send_textarea' ? input : id === 'send_form' ? host : null,
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
    createElement: () => ({ addEventListener: (name, fn) => { events[name] = fn; }, hidden: false }),
};
globalThis.MutationObserver = class { constructor(fn) { observer = fn; } observe() {} };
const uiContext = { ...ctx, shouldSendOnEnter: () => sendOnEnter, eventTypes: { CHAT_CHANGED: 'chat' }, eventSource: { on: (name, fn) => { events[name] = fn; } } };
globalThis.SillyTavern = { getContext: () => uiContext };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const key = extra => ({ target: input, key: 'Enter', preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra });
const type = value => { input.value = value; input.dispatchEvent(new Event('input')); };
await test('starts once; preview states native # numbering and handles Enter without generation', async () => {
    start({ isEnabled: () => enabled }); start();
    assert.equal(listeners.keydown.length, 1); assert.equal(listeners.click.length, 1);
    type('/240번 채팅으로 가기'); assert.match(hint.textContent, /#240.*#0/);
    const event = key(); listeners.keydown[0](event); await tick();
    assert.equal(event.stopped, true); assert.equal(input.value, ''); assert.equal(jumps.at(-1), '240');
});
await test('native newline/IME/modifiers and disabled theme never get intercepted', () => {
    type('/240으로');
    for (const extra of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) {
        const event = key(extra); listeners.keydown[0](event); assert.equal(event.stopped, undefined);
    }
    sendOnEnter = false; const event = key(); listeners.keydown[0](event); assert.equal(event.stopped, undefined); sendOnEnter = true;
    enabled = false; observer(); assert.equal(hint.hidden, true);
    const disabled = key(); listeners.keydown[0](disabled); assert.equal(disabled.stopped, undefined); enabled = true;
});
await test('send button blocks unknown Korean commands locally and preserves text', async () => {
    type('/240번 삭제'); const count = jumps.length;
    const event = key({ target: { closest: selector => selector === '#send_but' } });
    listeners.click[0](event); await tick();
    assert.equal(event.stopped, true); assert.equal(jumps.length, count); assert.equal(input.value, '/240번 삭제'); assert.match(hint.textContent, /아직 모르는/);
});
await test('search preview button works without Enter-to-send and keeps query for next result', async () => {
    type('/대화 검색 a.*b'); sendOnEnter = false;
    events.click({ preventDefault() {} }); await tick();
    assert.equal(jumps.at(-1), '2'); assert.equal(input.value, '/대화 검색 a.*b'); assert.match(hint.textContent, /검색 1\/2/);
    events.click({ preventDefault() {} }); await tick(); assert.equal(jumps.at(-1), '240');
});
await test('new input typed during native message loading is not cleared', async () => {
    let finish;
    uiContext.SlashCommandParser = { commands: { 'chat-jump': { callback: () => new Promise(resolve => { finish = resolve; }) } } };
    type('/240으로'); events.click({ preventDefault() {} });
    type('new draft while loading'); finish(''); await tick();
    assert.equal(input.value, 'new draft while loading'); assert.equal(hint.hidden, true);
});
console.log(`PASS ${passed} natural slash checks (${root})`);
