// 1.6.2 프로필 여러 개 × 스트리밍: 흘러나오는 새 답의 얼굴이 끝날 때까지 카드 원래 그림이던 것(src/multi-avatar/index.js paintStreaming)
//   실리태번은 스트리밍 답에 CHARACTER_MESSAGE_RENDERED 를 생성이 끝날 때 내요(public/script.js onFinishStreaming) → 첫 토큰(STREAM_TOKEN_RECEIVED)에 그 메시지를 한 번 칠해요
//   node tools/tests/multi-avatar-stream.mjs [테마 루트] [jsdom 이 든 node_modules 의 부모 폴더]
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || path.join(root, 'tools');
let JSDOM; try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); } catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const dom = new JSDOM('<!doctype html><body><div id="chat"></div></body>', { url: 'http://localhost/' });
for (const k of ['window', 'document', 'HTMLImageElement', 'location']) globalThis[k] = dom.window[k];
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
const handlers = {}; const ext = {};
const T = { CHAT_CHANGED: 'cc', CHARACTER_MESSAGE_RENDERED: 'cmr', USER_MESSAGE_RENDERED: 'umr', MESSAGE_SWIPED: 'ms', MESSAGE_UPDATED: 'mu', STREAM_TOKEN_RECEIVED: 'tok' };
const chat = [{ is_user: true, mes: '안녕', send_date: 1 }];
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced() {}, chat, characters: [{ avatar: 'mira.png' }], characterId: 0, getCurrentChatId: () => 'c1', eventSource: { on: (n, f) => { (handlers[n] ||= []).push(f); } }, event_types: T }) };
const S = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const { folderOf } = await import(pathToFileURL(path.join(root, 'src/multi-avatar/pick.js')).href);
const M = await import(pathToFileURL(path.join(root, 'src/multi-avatar/index.js')).href);
const F = folderOf('mira.png');
const s = S.getSettings();
s.multiAvatar = { on: true, when: 'chat', includeCard: false, chars: { 'mira.png': { files: [`user/images/${F}/k1.webp`], pinned: `user/images/${F}/k1.webp` } } };
const emit = (n, ...a) => { for (const f of handlers[n] || []) f(...a); };
const addMes = id => { const d = document.createElement('div'); d.className = 'mes'; d.setAttribute('mesid', String(id)); d.innerHTML = '<div class="mesAvatarWrapper"><div class="avatar"><img src="/thumbnail?type=avatar&file=mira.png"></div></div>'; document.getElementById('chat').append(d); return d.querySelector('img'); };
let passed = 0;
const ok = async (name, fn) => { await fn(); passed++; console.log('ok', name); };

M.syncMultiAvatar(true, s.multiAvatar);
await new Promise(r => setTimeout(r, 5));
assert.ok(handlers.tok?.length, 'STREAM_TOKEN_RECEIVED 를 들어요');

await ok('① 흘러나오는 새 답: 첫 토큰에 바로 그 그림 — 끝날 때(CHARACTER_MESSAGE_RENDERED)까지 기다리지 않아요', async () => {
    chat.push({ is_user: false, mes: '...', send_date: 2, swipe_id: 0 });
    const img = addMes(1);
    assert.match(img.getAttribute('src'), /thumbnail/);
    emit('tok', '첫');
    assert.equal(img.getAttribute('src'), `/user/images/${F}/k1.webp`);
    emit('cmr', 1); assert.equal(img.getAttribute('src'), `/user/images/${F}/k1.webp`);   // 끝난 뒤에도 같은 그림
});
await ok('② 같은 메시지는 토큰마다 다시 훑지 않아요 · 넘김(새 swipe_id)은 다시 한 번', async () => {
    const img = document.querySelector('#chat .mes[mesid="1"] img');
    img.setAttribute('src', '/x.png');                 // 다시 칠하면 바뀌는지로 셈
    emit('tok', '둘'); assert.equal(img.getAttribute('src'), '/x.png');
    chat[1].swipe_id = 1; emit('tok', '셋'); assert.equal(img.getAttribute('src'), `/user/images/${F}/k1.webp`);
});
await ok('③ 마지막이 사용자 메시지 · 자리가 아직 없으면 아무것도 안 해요(다음 토큰에)', async () => {
    chat.push({ is_user: false, mes: '...', send_date: 3, swipe_id: 0 });
    assert.equal(M.paintStreaming(), false);           // mesid 2 자리가 아직 없음
    const img = addMes(2); assert.equal(M.paintStreaming(), true); assert.equal(img.getAttribute('src'), `/user/images/${F}/k1.webp`);
    chat.push({ is_user: true, mes: '응', send_date: 4 }); assert.equal(M.paintStreaming(), false);
});
console.log(`multi-avatar-stream: ${passed}개 통과`);
