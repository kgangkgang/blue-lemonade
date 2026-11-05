// 1.0.3 연필 옆 지우기 단추 (src/quick/mes-delete.js)
//   · 기본 꺼짐 · 켤 때만 받음 · 메시지 틀과 이미 그려진 메시지에 하나씩(연필 앞) · 두 번 켜도 하나
//   · 누르면 실리태번 deleteMessage(번호, 스와이프 또는 없음, 확인 창 늘 켬) · 다른 답 여럿인 마지막 AI 답이면 스와이프 번호
//   · 답을 만드는 중 · deleteMessage 가 없는 판은 지우지 않음 · 끄면 단추 · 리스너가 남지 않음
//   node tools/tests/quick-mes-delete.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

await test('기본 꺼짐 · 켤 때만 받음 · 설정 창(확인 창 설명) · 찾기 · 이름표 · 쉴 땐 연필과 같은 색', () => {
    assert.match(read('src/settings.js'), /quick: \{[^}]*mesDelete: false/);
    assert.match(read('css/11-chrome.css'), /\.mes_buttons > \.bl_mes_del \{ color: inherit !important; \}/);
    assert.match(read('css/11-chrome.css'), /\.bl_mes_del:hover \{ color: var\(--bl-danger\) !important; \}/);
    const f = read('src/features.js');
    assert.match(f, /q\.mesDelete === true/);
    assert.match(f, /load\('mesdelete', '\.\/quick\/mes-delete\.js'\)/);
    assert.match(read('src/panel.js'), /toggle\('quick\.mesDelete', s\.quick\?\.mesDelete === true\), `[^`]*확인 창을 거쳐 지워요/);
    assert.match(read('src/settings-search.js'), /'quick\.mesDelete'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.mesDelete':'연필 옆 지우기 단추'/);
});

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx, eventSource } = dom.installBrowser({ settings: { enabled: true, quick: { mesDelete: true } } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
const toasts = [];
globalThis.toastr = { info: m => toasts.push(['info', m]), success() {}, warning: m => toasts.push(['warning', m]), error: m => toasts.push(['error', m]), clear() {} };

// 실리태번 메시지 틀 (단추 줄: ··· · 메뉴 · 깃발 · 연필)
const template = document.createElement('div');
template.id = 'message_template';
template.innerHTML = '<div class="mes"><div class="mes_buttons"><div class="mes_button extraMesButtonsHint"></div><div class="extraMesButtons"><div class="mes_button mes_copy"></div></div><div class="mes_button mes_bookmark"></div><div class="mes_button mes_edit fa-pencil"></div></div></div>';
document.body.append(template);
const chat = document.getElementById('chat');
for (let i = 0; i < 3; i++) {
    const mes = template.querySelector('.mes').cloneNode(true);
    mes.setAttribute('mesid', String(i));
    chat.append(mes);
}
ctx.chat = [{ mes: 'a', is_user: true }, { mes: 'b', is_user: false }, { mes: 'c', is_user: false, swipes: ['c', 'c2'], swipe_id: 1 }];
const calls = [];
ctx.deleteMessage = async (id, swipe, ask) => { calls.push([id, swipe, ask]); };
const mod = await import(url('src/quick/mes-delete.js'));
const baseListeners = dom.listenerCounts(eventSource).elements;

await test('켜면 틀 · 그려진 메시지마다 하나씩, 연필 바로 앞 · 두 번 켜도 하나', () => {
    mod.syncMesDelete(true);
    mod.syncMesDelete(true);
    const rows = [template.querySelector('.mes_buttons'), ...chat.querySelectorAll('.mes_buttons')];
    for (const row of rows) {
        const found = row.querySelectorAll('.bl_mes_del');
        assert.equal(found.length, 1);
        assert.equal(found[0].nextElementSibling?.classList.contains('mes_edit'), true, '연필 앞');
        assert.equal(found[0].getAttribute('aria-label'), '메시지 지우기');
    }
    // 새로 그리는 메시지는 틀을 복제하니 단추가 따라와요
    const fresh = template.querySelector('.mes').cloneNode(true);
    assert.equal(fresh.querySelectorAll('.bl_mes_del').length, 1);
    assert.equal(dom.listenerCounts(eventSource).elements - baseListeners, 1, '#chat 리스너 하나');
});

await test('누르면 실리태번 지우기(확인 창 켬) · 마지막 AI 답의 여러 답은 스와이프 번호', async () => {
    calls.length = 0;
    chat.querySelector('[mesid="1"] .bl_mes_del').click();
    chat.querySelector('[mesid="2"] .bl_mes_del').click();
    chat.querySelector('[mesid="0"] .bl_mes_del').click();
    await new Promise(r => setImmediate(r));
    assert.deepEqual(calls, [[1, undefined, true], [2, 1, true], [0, undefined, true]]);
});

await test('답을 만드는 중 · 지우기 함수가 없는 판은 지우지 않고 알림', async () => {
    calls.length = 0; toasts.length = 0;
    document.body.dataset.generating = 'true';
    assert.equal(await mod.deleteWithAsk(1), false);
    delete document.body.dataset.generating;
    const keep = ctx.deleteMessage; ctx.deleteMessage = undefined;
    assert.equal(await mod.deleteWithAsk(1), false);
    ctx.deleteMessage = keep;
    assert.equal(await mod.deleteWithAsk(99), false, '없는 번호');
    assert.deepEqual(calls, []);
    assert.equal(toasts.length, 2);
});

await test('지웠는지 돌려줌(취소하면 false)', async () => {
    ctx.deleteMessage = async (id) => { ctx.chat.splice(id, 1); };
    assert.equal(await mod.deleteWithAsk(0), true);
    ctx.deleteMessage = async () => {};
    assert.equal(await mod.deleteWithAsk(0), false);
});

await test('끄면 단추 · 리스너가 남지 않음', () => {
    mod.syncMesDelete(false);
    assert.equal(document.querySelectorAll('.bl_mes_del').length, 0);
    assert.equal(dom.listenerCounts(eventSource).elements, baseListeners);
});

console.log(`quick-mes-delete: ${passed}개 통과`);
