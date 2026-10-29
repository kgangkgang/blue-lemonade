// 시작할 때 실제로 받는 모듈 (예측점검 부팅 · 10-30) — 정적 그래프(boot-graph.mjs)만으로는 안 보이는 동적 import 까지.
//   테마 index.js 를 가짜 브라우저(leak-dom.mjs · leak-loader.mjs)에서 기본 설정(새로 깐 사람)으로 띄우고, 시작 뒤 15초 동안 받은 모듈을 적어
//   「첫 화면에 안 쓰는 것」이 없는지 보고, 그 기능을 실제로 쓰면 그때 받는지(동작 그대로) 봐요.
//   node tools/tests/boot-dynamic.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bl-boot-')), 'modules.txt');
fs.writeFileSync(log, '');
process.env.LEAK_MODLOG = log;
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
const { ctx, eventSource, chat: chatEl } = dom.installBrowser({ settings: { enabled: true } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(pathToFileURL(path.join(root, 'tools/tests/leak-loader.mjs')).href, { data: { root } });
const say = (...a) => process.stdout.write(a.join(' ') + '\n');
for (const k of ['warn', 'error', 'info', 'debug', 'log']) console[k] = () => {};
const T = ctx.event_types, settle = ms => dom.clock.advance(ms);
const loaded = () => new Set(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; say('PASS ' + name); } catch (e) { failed++; say('FAIL ' + name + '\n' + (e.stack || e)); } }

// 채팅 하나 (접은 메시지 없음)
for (let i = 0; i < 6; i++) { ctx.chat.push({ name: 'Char', is_user: false, is_system: false, mes: `메시지 ${i}`, extra: {}, swipes: [`메시지 ${i}`], swipe_id: 0 }); chatEl.append(dom.messageElement(i)); }
await import(pathToFileURL(path.join(root, 'index.js')).href);
await settle(1000);
await eventSource.emit(T.APP_READY);
await eventSource.emit(T.CHAT_CHANGED, 'chat-1');
await settle(15000);
const atBoot = loaded();
say(`  시작 15초 동안 받은 테마 모듈 ${atBoot.size}개`);

// 기본 설정에서 첫 화면에 안 쓰는 것 — 그 기능을 쓸 때 받는다
const NOT_AT_BOOT = {
    'src/pull-to-refresh.js': '홈 화면에 깐 터치 앱이 아님',
    'src/swipe-picker-translation.js': '스와이프 고르기 창을 안 엶',
    'src/addons/translator/translation-source.js': '번역 애드온 꺼짐 · 고르기 창 안 엶',
    'src/mes-fold.js': '접어 둔 메시지 없음 · 눈 길게 누르기 안 함',
    'src/rerender-notify.js': '접기 · 애드온 다시 그리기 없음',
    'src/panel.js': '설정 창을 안 엶',
    'src/addons/models/panel.js': '모델 등록 창을 안 엶',
};
await test('기본 설정의 시작 15초 동안 꺼진 기능 · 안 연 창의 모듈은 받지 않아요', () => {
    const wrong = Object.entries(NOT_AT_BOOT).filter(([rel]) => atBoot.has(rel)).map(([rel, why]) => `${rel} (${why})`);
    assert.deepEqual(wrong, []);
});

await test('스와이프 고르기 여는 단추를 누르면 그때 번역 모듈을 받아요', async () => {
    const opener = chatEl.querySelector('.swipes-counter');
    opener.classList.add('swipe-picker-enabled');
    opener.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle(500);
    assert.ok(loaded().has('src/swipe-picker-translation.js'));
});

await test('접어 둔 메시지를 실리태번 숨김 풀기로 보이게 하면 그때 접기 모듈을 받아 틀을 벗겨요 (예전과 같은 고치기)', async () => {
    const updated = [];
    ctx.updateMessageBlock = id => updated.push(id);
    ctx.saveChat = async () => {};
    // 눈 길게 누르기로 접은 메시지 = 본문이 우리 틀 · extra.bl_folded · 숨김(is_system true)
    const id = ctx.chat.length;
    ctx.chat.push({ name: 'Char', is_user: false, is_system: true, mes: '<details><summary></summary>\n\n접은 글\n\n</details>', extra: { bl_folded: true }, swipes: [''], swipe_id: 0 });
    const mes = dom.messageElement(id); mes.setAttribute('is_system', 'true'); chatEl.append(mes);
    await settle(500);
    assert.ok(!loaded().has('src/mes-fold.js'), '숨겨 둔 동안에는 아직 안 받아요');
    // 실리태번 「숨김 풀기」: is_system 을 false 로
    ctx.chat[id].is_system = false; mes.setAttribute('is_system', 'false');
    await settle(500);
    assert.ok(loaded().has('src/mes-fold.js'), '숨김을 풀면 받아요');
    assert.deepEqual(updated, [id], '그 메시지만 다시 그려요');
    assert.equal(ctx.chat[id].mes, '접은 글');
    assert.equal(ctx.chat[id].extra.bl_folded, undefined);
});

await test('접어 둔 메시지가 있는 채팅을 열거나 생성을 시작해도 고쳐요 (생성 시작은 고친 뒤에 넘어가요)', async () => {
    const updated = [];
    ctx.updateMessageBlock = id => updated.push(id);
    const id = ctx.chat.length;
    ctx.chat.push({ name: 'Char', is_user: false, is_system: false, mes: '<details><summary></summary>\n\n다른 접은 글\n\n</details>', extra: { bl_folded: true }, swipes: [''], swipe_id: 0 });
    await eventSource.emit(T.GENERATION_STARTED, 'normal');
    assert.deepEqual(updated, [id], 'emit 이 끝났을 때 이미 고쳐져 있어요');
    assert.equal(ctx.chat[id].mes, '다른 접은 글');
});

say(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
