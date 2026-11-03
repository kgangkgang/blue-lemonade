// 본체를 늦게 받는 동안의 실제 껍데기 코드예요. 모델·음성·네트워크 요청은 없는 격리 환경에서 검사해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons/tts/shell.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src/addons/tts/index.js'), 'utf8');
const code = source.slice(0, source.indexOf('export const ready ='))
    .replace(/^import .*;.*$/gm, '').replace(/\bexport /g, '')
    .replace(/import\((['`]\.\/index\.js[^)]*)\)/g, 'loadBody($1)');
const next = () => new Promise(resolve => setImmediate(resolve));
function rig(loader = null) {
    const events = {}, chat = [{ mes: '첫 채팅 답', swipe_id: 0 }], seen = [], loads = [], publicList = [{ uid: 'fixture', name: '표본' }];
    let key = 'A', enabled = true, calls = 0;
    const eventSource = {
        on(type, fn) { (events[type] ??= []).push(fn); },
        makeLast(type, fn) { this.on(type, fn); },
        removeListener(type, fn) { events[type] = (events[type] || []).filter(x => x !== fn); },
    };
    const event_types = Object.fromEntries(['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'STREAM_TOKEN_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'CHARACTER_RENAMED', 'GROUP_WRAPPER_STARTED', 'GROUP_WRAPPER_FINISHED', 'CHAT_CHANGED'].map(x => [x, x]));
    const module = {
        ensureReady: async () => {}, replayEvent(type, args, captured) { seen.push({ type, args, captured, text: chat[Number(args?.[0])]?.mes }); },
        playButton() { calls++; }, scriptButton() { calls++; },
    };
    const context = vm.createContext({
        loadBody: async spec => { loads.push(spec); return loader ? loader(module) : module; },
        eventSource, event_types, chat, getCurrentChatId: () => key, withReplay: async (_name, run) => run(),
        runtimeEnabled: () => enabled, setRuntimeEnabled: value => { enabled = value; },
        paint: { onChatChanged() {}, destroy() {} }, peopleChanged() {},
        voiceOfName: () => enabled ? publicList[0] : null, voiceListPublic: () => enabled ? publicList : [],
        document: { querySelectorAll: () => [], getElementById: () => null },
        console: { warn() {}, error() {} }, settings: () => ({}), VERSION: '표본', window: {}, Symbol, Date,
    });
    vm.runInContext(code + '\nglobalThis.api={ensureBody,listen,installApi,stopVisible,onButton};', context);
    const fire = (type, ...args) => [...(events[type] || [])].map(fn => fn(...args));
    context.api.listen();
    return { api: context.api, context, module, chat, seen, loads, publicList, fire, clicks: () => calls,
        changeChat() { key = 'B'; chat[0] = { mes: '다른 채팅 답', swipe_id: 0 }; fire('CHAT_CHANGED', key); },
        disable() { enabled = false; context.api.stopVisible(); },
    };
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('통과: ' + name); }
await test('첫 모듈 로딩 실패 뒤 다음 클릭은 새 모듈 URL로 재시도해요', async () => {
    let attempts = 0;
    const r = rig(async module => { if (!attempts++) throw Error('파일 받기 실패'); return module; });
    await assert.rejects(r.api.ensureBody());
    await r.api.ensureBody();
    assert.equal(r.loads.length, 2);
    assert.equal(r.loads[0], './index.js');
    assert.match(r.loads[1], /index\.js\?retry=1$/);
});
await test('설정 화면 초기화 실패는 모듈 재평가 없이 다시 시작해요', async () => {
    let tries = 0; const r = rig();
    r.module.ensureReady = async () => { if (!tries++) throw Error('화면 받기 실패'); };
    await assert.rejects(r.api.ensureBody()); await r.api.ensureBody();
    assert.equal(tries, 2); assert.equal(r.loads.length, 1);
});
await test('동시에 누르면 본체를 한 번만 받아요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    const a = r.api.ensureBody(), b = r.api.ensureBody();
    assert.equal(a, b); finish(r.module); await a;
    assert.equal(r.loads.length, 1);
});
await test('다른 채팅으로 바뀌면 이전 답의 대기 사건을 버려요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    r.fire('CHARACTER_MESSAGE_RENDERED', 0, 'normal'); r.changeChat();
    finish(r.module); await r.api.ensureBody();
    assert.equal(r.seen.filter(x => x.type === 'CHARACTER_MESSAGE_RENDERED').length, 0);
});
await test('같은 채팅에서 삭제로 번호가 재사용돼도 다른 메시지를 읽지 않아요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    r.fire('CHARACTER_MESSAGE_RENDERED', 0, 'normal'); r.chat[0] = { mes: '번호만 같은 새 답', swipe_id: 0 };
    finish(r.module); await r.api.ensureBody();
    assert.equal(r.seen.filter(x => x.type === 'CHARACTER_MESSAGE_RENDERED').length, 0);
});
await test('로딩 중 스와이프가 바뀐 옛 렌더 사건을 버려요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    r.fire('CHARACTER_MESSAGE_RENDERED', 0, 'normal'); r.chat[0].swipe_id = 1;
    finish(r.module); await r.api.ensureBody();
    assert.equal(r.seen.filter(x => x.type === 'CHARACTER_MESSAGE_RENDERED').length, 0);
});
await test('유효한 대기 사건과 준비 뒤 사건은 각각 한 번만 전달해요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    r.fire('GROUP_WRAPPER_STARTED', { type: 'normal' }); r.chat.push({ mes: '다음 답' });
    r.fire('CHARACTER_MESSAGE_RENDERED', 0, 'normal'); finish(r.module); await r.api.ensureBody();
    r.fire('MESSAGE_UPDATED', 0);
    assert.deepEqual(r.seen.map(x => x.type), ['CHAT_CHANGED', 'GROUP_WRAPPER_STARTED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED']);
    assert.equal(r.seen[1].captured.chatLength, 1, '그룹 차례 시작의 채팅 길이를 보존해요');
    assert.match(index, /if \(!globalThis\[SHELL\]\?\.managesEvents\) \{\s*\/\/ 이벤트/);
});
await test('꺼진 동안 준비가 끝나도 이전 사건을 재생하지 않아요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    r.fire('CHARACTER_MESSAGE_RENDERED', 0, 'normal'); r.disable();
    finish(r.module); await r.api.ensureBody();
    assert.equal(r.seen.filter(x => x.type === 'CHARACTER_MESSAGE_RENDERED').length, 0);
});
await test('단추를 누르고 채팅을 옮기면 새 채팅의 같은 번호를 읽지 않아요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    const button = { isConnected: true, classList: { contains: () => false } };
    r.api.onButton({ type: 'click', target: { closest: () => button } }); r.changeChat();
    finish(r.module); await r.api.ensureBody(); await next();
    assert.equal(r.clicks(), 0);
});
await test('목소리 조회는 본체 로딩 없이 동기로 같은 값을 반환해요', () => {
    const r = rig(); r.api.installApi();
    assert.equal(r.context.window.LemonVoice.voiceOf('표본'), r.publicList[0]);
    assert.equal(r.context.window.LemonVoice.voices(), r.publicList);
    assert.equal(r.loads.length, 0);
    r.disable(); assert.equal(r.context.window.LemonVoice.voiceOf('표본'), null);
    assert.deepEqual(r.context.window.LemonVoice.voices(), []);
});
await test('본체를 받는 중 정지하면 기다리던 읽기는 시작하지 않고 합성 파일 요청은 유지해요', async () => {
    let finish; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    r.api.installApi(); const api = r.context.window.LemonVoice;
    const read = api.readText('표본'), speak = api.speakText('표본'), synth = api.synth('표본');
    api.stop();
    const called = [];
    r.context.window.LemonVoice = { readText: () => called.push('read'), speakText: () => called.push('speak'), synth: () => { called.push('synth'); return '파일'; } };
    finish(r.module); await Promise.all([read, speak]); assert.equal(await synth, '파일');
    assert.deepEqual(called, ['synth']);
});
await test('준비 뒤 사건은 처리기의 비동기 반환을 그대로 돌려줘요', async () => {
    const r = rig(); await r.api.ensureBody();
    const expected = Promise.resolve('처리됨'); r.module.replayEvent = () => expected;
    assert.equal(r.fire('MESSAGE_UPDATED', 0)[0], expected);
});
await test('대기 사건 처리 중 도착한 사건도 차례대로 한 번만 처리해요', async () => {
    let finish, release; const r = rig(() => new Promise(resolve => { finish = resolve; }));
    const seen = [];
    r.module.replayEvent = async type => {
        seen.push(type);
        if (type === 'CHARACTER_MESSAGE_RENDERED') await new Promise(resolve => { release = resolve; });
    };
    r.fire('CHARACTER_MESSAGE_RENDERED', 0, 'normal'); finish(r.module); await next();
    r.fire('MESSAGE_UPDATED', 0); assert.deepEqual(seen, ['CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED']);
    release(); await r.api.ensureBody();
    assert.deepEqual(seen, ['CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED']);
});
await test('본체 초기화 진입점도 실패한 약속을 버리고 다음 시도를 허용해요', async () => {
    const start = index.indexOf('let initializing = null;'), end = index.indexOf('\nfunction initialize()', start);
    let tries = 0;
    const ctx = vm.createContext({ initialized: false, holder: null, root: null, initialize: async () => { if (!tries++) throw Error('일시 실패'); return '준비'; } });
    vm.runInContext(index.slice(start, end).replace(/\bexport /g, '') + '\nglobalThis.start=ensureReady;', ctx);
    await assert.rejects(ctx.start()); assert.equal(await ctx.start(), '준비'); assert.equal(tries, 2);
});
await test('전역 듣기를 붙인 뒤 예외가 나면 초기화를 반복해 중복 등록하지 않아요', async () => {
    const start = index.indexOf('let initializing = null;'), end = index.indexOf('\nfunction initialize()', start);
    let tries = 0;
    const ctx = vm.createContext({ initialized: true, initialize: async () => { tries++; throw Error('부분 초기화 오류'); } });
    vm.runInContext(index.slice(start, end).replace(/\bexport /g, '') + '\nglobalThis.start=ensureReady;', ctx);
    await assert.rejects(ctx.start()); await assert.rejects(ctx.start()); assert.equal(tries, 1);
});
console.log(`TTS 껍데기 생명주기 ${passed}개를 통과했어요.`);
