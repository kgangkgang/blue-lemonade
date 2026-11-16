// 버그 사냥 2차: 설정 창 안 캡처 칸을 연 채 채팅을 바꾸면, 「파일 만들기」가 옛 번호로 새 채팅 메시지를 굽고 그 파일을 옛 채팅의 보관 기억에 넣었어요
//   (옛 채팅으로 돌아가 캡처를 열면 다른 채팅 그림이 「만들어 둔 파일」로 떠 저장 · 공유됨). 보관 기억은 창을 열 때 한 번만 채팅을 확인했어요.
//   캡처 본체(chat-capture.js)를 통째로 돌리기 어려워 소스 글로 확인해요 — capture-open.mjs 와 같은 방식.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/capture-options.js'), 'utf8').replace(/\r\n/g, '\n');
const open = source.slice(source.indexOf('export async function openCapturePreview('));
assert.match(open, /const openedChat=SillyTavern\.getContext\(\)\.chatId/, '연 때의 채팅을 적어 둬요');
const guard = /const sameChat=\(\)=>\{[^\n]*SillyTavern\.getContext\(\)\.chatId===openedChat[^\n]*\}/.exec(open);
assert.ok(guard, '채팅이 그대로인지 보는 문지기');
assert.match(guard[0], /채팅이 바뀌었어요/, '바뀌었으면 안내하고 멈춰요');
for (const name of ['generate', 'quickLook']) {
    const at = open.indexOf(`async function ${name}(){`);
    assert.ok(at >= 0, name);
    assert.match(open.slice(at, at + 120), /^async function \w+\(\)\{\s*if\(busy\)return;if\(!sameChat\(\)\)return;/, `${name}: 굽기 전에 채팅을 확인해요`);
}
const edit = open.slice(open.indexOf("dialog.querySelector('[data-capture-edit]').onclick=async()=>{"));
assert.match(edit.slice(0, 120), /onclick=async\(\)=>\{if\(!sameChat\(\)\)return;/, '캡처용 글 편집도');
// 문지기 동작 자체: 떼어 돌려 봐요
const run = new Function('SillyTavern', 'status', 'openedChat', guard[0] + ';return sameChat;');
const status = { textContent: '' };
let chat = 'A';
const sameChat = run({ getContext: () => ({ chatId: chat }) }, status, 'A');
assert.equal(sameChat(), true); assert.equal(status.textContent, '');
chat = 'B';
assert.equal(sameChat(), false); assert.match(status.textContent, /채팅이 바뀌었어요/);
console.log('통과: 채팅이 바뀐 뒤에는 캡처를 굽지 않아요');
