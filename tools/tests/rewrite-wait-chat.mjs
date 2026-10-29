// 다시 쓰기: 답이 오는 중에 「마지막 답 검사」를 누르고 기다리는 사이 채팅을 바꾸면 (예측점검-애드온 1029)
//   예전엔 기다림이 끝난 뒤 새 채팅의 마지막 AI 답을 검사해 고치고 저장했어요(누른 채팅이 아님). 이제 채팅이 바뀌었으면 검사하지 않고 알려요.
//   index.js 의 checkLastMessage 원문만 잘라 가짜 실리태번으로 돌려요. 네트워크 없음.  node tools/tests/rewrite-wait-chat.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/rewrite/index.js'), 'utf8');
const m = src.match(/\nasync function checkLastMessage\(\) \{[\s\S]*?\n\}\n/);
assert.ok(m, 'checkLastMessage 를 찾지 못했어요');

function harness() {
    const T = { chatId: '1부', chat: [{ is_user: true, mes: '지어낸 질문' }, { is_user: false, mes: '지어낸 답' }], cleaned: [], toasts: [], generating: true, release: null };
    const box = {
        T, TITLE: '다시 쓰기', WAIT_REPLY_MAX_MS: 1000, waitingForReply: false, Math,
        toastr: { info: (text) => T.toasts.push(text) },
        isMainChatGenerating: () => T.generating,
        whenMainChatIdle: () => new Promise(resolve => { T.release = resolve; }),
        getContext: () => ({ chat: T.chat, getCurrentChatId: () => T.chatId }),
        cleanMessage: async (id) => { T.cleaned.push([T.chatId, id]); },
    };
    vm.runInNewContext(m[0].replace('async function checkLastMessage', 'this.checkLastMessage = async function') + '', box);
    return box;
}
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('ok', name); }

await check('기다리는 사이 다른 채팅으로 바꾸면 새 채팅의 답을 검사하지 않아요', async () => {
    const box = harness(), { T } = box;
    const run = box.checkLastMessage();
    await Promise.resolve();
    T.chatId = '2부'; T.chat = [{ is_user: false, mes: '다른 채팅의 지어낸 답' }];
    T.release(true); await run;
    assert.deepEqual(T.cleaned, []);
    assert.match(T.toasts.at(-1), /채팅이 바뀌어서/);
});
await check('같은 채팅이면 예전처럼 끝난 답을 검사해요', async () => {
    const box = harness(), { T } = box;
    const run = box.checkLastMessage();
    await Promise.resolve();
    T.release(true); await run;
    assert.deepEqual(T.cleaned.map(x => [...x]), [['1부', 1]]);
});
await check('생성 중이 아니면 기다리지 않고 바로 검사해요', async () => {
    const box = harness(), { T } = box; T.generating = false;
    await box.checkLastMessage();
    assert.deepEqual(T.cleaned.map(x => [...x]), [['1부', 1]]);
});
console.log(`rewrite wait chat: ${passed} passed`);
