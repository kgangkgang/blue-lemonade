// 1.0.3 한 손 버튼 줄 이동 · 지우기 단추 넷 (src/onehand.js · 누를 때 natural-slash.js · quick/mes-delete.js)
//   · 기본 켬(줄 자체는 그대로 기본 꺼짐) · 세 묶음 차례(‹ › | 맨 위 · 맨 아래 · 번호 · 지우기 | 사칭 · 이어 쓰기 · 다시 생성) · 7개 넘으면 is-many
//   · 맨 위 = 실리태번 /chat-jump 0 · 맨 아래 = 채팅 칸 끝 · 번호 = 입력 창 → /chat-jump n (없는 번호 · 취소 · 글자는 옮기지 않음)
//   · 마지막 지우기 = 실리태번 deleteMessage(마지막, …, 확인 창 켬) · 칩으로 하나씩 끔 · 설정 창 칩 · 이름표 · 길게 누르기 설명
//   node tools/tests/quick-onehand-nav.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

await test('기본값 · 설정 창 칩 · 이름표 · 길게 누르기 설명', () => {
    assert.match(read('src/settings.js'), /onehand: \{ on: false, swipe: true, imp: true, cont: true, regen: true, top: true, bottom: true, jump: true, delLast: true \}/);
    const panel = read('src/panel.js');
    for (const key of ['top', 'bottom', 'jump', 'delLast']) {
        assert.match(panel, new RegExp(`\\['onehand\\.${key}', `), key);
        assert.match(read('src/settings-labels.js'), new RegExp(`'onehand\\.${key}':`), key);
    }
    const help = JSON.parse(read('tools/scripts-src/longpress-help/help.json')).entries.filter(e => e.scope === '#bl-onehand').flatMap(e => e.texts);
    for (const label of ['맨 위로', '맨 아래로', '번호로 가기', '마지막 메시지 지우기']) assert.ok(help.includes(label), label);
});

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx } = dom.installBrowser({ settings: { enabled: true, onehand: { on: true } } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
dom.realYield(5);   // 1.1.6 노드 22: 로더 훅 스레드가 동적 import 를 풀 진짜 시간(leak-dom.mjs realYield)
const { setTimeout: realWait } = await import('node:timers/promises');
console.warn = () => {};
const toasts = [];
globalThis.toastr = { info: m => toasts.push(m), success() {}, warning: m => toasts.push(m), error: m => toasts.push(m), clear() {} };
const jumps = [];
ctx.SlashCommandParser.commands['chat-jump'] = { callback: async (args, value) => { jumps.push(value); return ''; } };
ctx.chat = [{ mes: 'a' }, { mes: 'b' }, { mes: 'c' }, { mes: 'd', is_user: false }];
const deletes = [];
ctx.deleteMessage = async (id, swipe, ask) => { deletes.push([id, swipe, ask]); };
const chat = document.getElementById('chat');
const scrolls = [];
chat.scrollTo = opts => scrolls.push(opts);
const { syncOneHand } = await import(url('src/onehand.js'));
const defaults = { swipe: true, imp: true, cont: true, regen: true, top: true, bottom: true, jump: true, delLast: true };
const acts = () => [...document.querySelectorAll('#bl-onehand .bl-onehand-group')].map(g => [...g.querySelectorAll('.bl-onehand-btn')].map(b => b.dataset.act));
const press = async act => { document.querySelector(`#bl-onehand [data-act="${act}"]`).click(); for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); for (let i = 0; i < 20; i++) { await realWait(10); await new Promise(r => setImmediate(r)); } };   // 1.1.6 노드 22: 누름이 받는 모듈이 로더 훅 스레드에서 풀릴 진짜 시간

await test('세 묶음 차례 · 9개면 is-many · 이름표', () => {
    syncOneHand(true, defaults);
    assert.deepEqual(acts(), [['swipe-left', 'swipe-right'], ['chat-top', 'chat-bottom', 'chat-jump', 'delete-last'], ['impersonate', 'continue', 'regenerate']]);
    const row = document.getElementById('bl-onehand');
    assert.ok(row.classList.contains('is-many'));
    assert.equal(row.querySelector('[data-act="chat-jump"]').getAttribute('aria-label'), '번호로 가기');
});

await test('넷을 다 끄면 예전 두 묶음 그대로 · is-many 없음', () => {
    syncOneHand(true, { ...defaults, top: false, bottom: false, jump: false, delLast: false });
    assert.deepEqual(acts(), [['swipe-left', 'swipe-right'], ['impersonate', 'continue', 'regenerate']]);
    assert.equal(document.getElementById('bl-onehand').classList.contains('is-many'), false);
    syncOneHand(true, { ...defaults, jump: false });
    assert.deepEqual(acts()[1], ['chat-top', 'chat-bottom', 'delete-last']);
});

await test('맨 위 = /chat-jump 0 · 맨 아래 = 채팅 칸 끝', async () => {
    syncOneHand(true, defaults);
    jumps.length = 0;
    await press('chat-top');
    assert.deepEqual(jumps, ['0']);
    await press('chat-bottom');
    assert.equal(scrolls.length, 1);
    assert.equal(scrolls[0].behavior, 'smooth');
});

await test('번호로 가기: 입력 창 → /chat-jump n · 취소 · 없는 번호 · 글자는 안 옮김', async () => {
    jumps.length = 0; toasts.length = 0;
    const asked = [];
    let answer = '2';
    ctx.callGenericPopup = async (text, type) => { asked.push([text, type]); return answer; };
    await press('chat-jump');
    assert.deepEqual(jumps, ['2']);
    assert.match(asked[0][0], /#0 ~ #3/);
    assert.equal(asked[0][1], ctx.POPUP_TYPE.INPUT);
    answer = null; await press('chat-jump');
    answer = '#99'; await press('chat-jump');
    answer = '셋'; await press('chat-jump');
    assert.deepEqual(jumps, ['2'], '취소 · 없는 번호 · 글자는 옮기지 않음');
    assert.equal(toasts.length, 2, '없는 번호 · 글자는 알림');
});

await test('마지막 메시지 지우기 = 실리태번 지우기(확인 창 켬) · 메시지가 없으면 알림만', async () => {
    deletes.length = 0;
    await press('delete-last');
    assert.deepEqual(deletes, [[3, undefined, true]]);
    const keep = ctx.chat; ctx.chat = []; toasts.length = 0;
    await press('delete-last');
    assert.equal(deletes.length, 1);
    assert.equal(toasts.length, 1);
    ctx.chat = keep;
});

await test('끄면 줄이 사라짐', () => {
    syncOneHand(false);
    assert.equal(document.getElementById('bl-onehand'), null);
});

console.log(`quick-onehand-nav: ${passed}개 통과`);
