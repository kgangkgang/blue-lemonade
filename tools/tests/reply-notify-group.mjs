// 1.6.3 답 완료 알림 × 그룹 채팅: 실리태번은 그룹 차례에서 멤버마다 Generate 를 따로 불러 GENERATION_STARTED/ENDED 가 멤버 수만큼 와요
//   (group-chats.js 1051 ~ 1063 · 멤버마다 activateSendButtons → hideStopButton → GENERATION_ENDED). 예전에는 첫 멤버 답에 바로 알림 · 진동이 왔고
//   (돌아오면 아직 생성 중), 3초 안에 끝난 다음 멤버는 「겹친 끝 사건」 으로 버렸어요. 이제 그룹은 GROUP_WRAPPER_FINISHED 에 한 번만 알려요.
//   node tools/tests/reply-notify-group.mjs [테마 루트]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const handlers = new Map();
const eventSource = {
    on(name, fn) { (handlers.get(name) ?? handlers.set(name, []).get(name)).push(fn); },
    removeListener(name, fn) { const l = handlers.get(name) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
};
const emit = async (name, ...args) => { for (const fn of [...(handlers.get(name) ?? [])]) await fn(...args); };
const event_types = { GENERATION_STARTED: 'gs', GENERATION_ENDED: 'ge', GROUP_WRAPPER_STARTED: 'gws', GROUP_WRAPPER_FINISHED: 'gwf' };
const chat = [];
globalThis.SillyTavern = { getContext: () => ({ eventSource, event_types, chat }) };
const shown = [];
globalThis.Notification = class { constructor(title, options) { shown.push({ title, body: options.body }); } static permission = 'granted'; };
globalThis.window = globalThis;
globalThis.document = { visibilityState: 'hidden' };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.location = { href: 'http://127.0.0.1/' };
globalThis.toastr = { info() {}, warning() {} };
const tick = () => new Promise(r => setTimeout(r, 0));

const mod = await import(pathToFileURL(path.join(root, 'src/reply-notify.js')).href);
mod.syncReplyNotify(true);
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('  ok  ' + name); };
const member = async (name, text, gap = 0) => {
    await emit('gs', 'normal', {}, false);
    chat.push({ name, is_user: false, mes: text });
    await emit('ge', chat.length); await tick();
    if (gap) await new Promise(r => setTimeout(r, gap));
};

await test('혼자 채팅: 답이 끝나면 한 번 알려요(예전 그대로)', async () => {
    chat.push({ is_user: true, mes: '안녕' });
    await member('아린', '안녕하세요');
    assert.equal(shown.length, 1);
    assert.match(shown[0].title, /아린/);
});

await test('그룹 셋: 멤버 답마다가 아니라 차례가 다 끝났을 때 한 번 · 마지막 멤버 답으로', async () => {
    shown.length = 0;
    await new Promise(r => setTimeout(r, 3100));   // 앞 시험의 3초 겹침 막기를 비켜요
    chat.push({ is_user: true, mes: '다들 뭐 해요?' });
    await emit('gws', { selected_group: 'g1', type: 'normal' });
    await member('아린', '책 읽어요');
    assert.equal(shown.length, 0, '첫 멤버 답에 바로 알리지 않아요(아직 생성 중)');
    await member('도윤', '차 마셔요');
    await member('하린', '산책해요');
    assert.equal(shown.length, 0);
    await emit('gwf', { selected_group: 'g1', type: 'normal' }); await tick();
    assert.equal(shown.length, 1, '차례가 끝날 때 한 번');
    assert.match(shown[0].title, /하린/);
});

await test('그룹: 아무도 새 답을 못 냈으면(오류로 끝남) 알리지 않아요', async () => {
    shown.length = 0;
    await new Promise(r => setTimeout(r, 3100));
    await emit('gws', { selected_group: 'g1', type: 'normal' });
    await emit('gs', 'normal', {}, false); await emit('ge', chat.length); await tick();
    await emit('gwf', { selected_group: 'g1', type: 'normal' }); await tick();
    assert.equal(shown.length, 0);
});

await test('끄면 그룹 사건 구독도 떼요', async () => {
    mod.syncReplyNotify(false);
    for (const [name, list] of handlers) assert.equal(list.length, 0, `${name} 구독이 남음`);
});

console.log(`reply-notify-group: ${pass} passed, 0 failed`);
