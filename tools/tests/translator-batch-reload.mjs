// 채팅 전체 번역이 도는 중에 같은 채팅이 제자리에서 다시 불려도(reloadCurrentChat — 정규식 창 저장 · 프롬프트 귀속 · 다른 확장) 남은 메시지를 이어 번역해요.
//   1.5.8 까지: 시작할 때 떠 둔 메시지 객체를 새 채팅 배열에서 못 찾아(indexOf -1) 남은 메시지를 전부 건너뛰고 「채팅 번역이 완료됐어요」라고 알렸어요.
//   진짜 onTranslateChatClick 을 index.js 에서 잘라 가짜 환경에서 돌려요(요청 · DOM · 저장 0).
//   node tools/tests/translator-batch-reload.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const { createGuards } = await import(pathToFileURL(path.join(dir, 'translation-guard.js')).href);
function cut(name, prefix = 'function') {
    const start = source.indexOf(`\n${prefix} ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 3000) { const at = Date.now(); while (!fn()) { if (Date.now() - at > ms) throw Error('timed out'); await sleep(5); } }
const row = (i, extra = {}) => ({ mes: `Synthetic line ${i}.`, name: i % 2 ? 'Bot' : 'You', is_user: i % 2 === 0, swipe_id: 0, send_date: `2026-01-01 00:00:0${i}`, extra });
const copyOf = chat => chat.map(m => ({ ...m, extra: { ...m.extra } }));   // 서버에서 다시 읽은 사본 — 내용은 같고 객체만 새것

function fixture(count = 4) {
    const context = { chat: Array.from({ length: count }, (_, i) => row(i)), chatId: 'chat-a', characterId: 1, groupId: null };
    const guards = createGuards(() => context);
    const translated = [], toasts = [];
    let hold = null;
    const jq = () => ({ find: () => jq(), removeClass: () => jq(), addClass: () => jq(), text: () => jq() });
    const env = {
        getContext: () => context, guards, batchRun: null, isChatTranslationInProgress: false, extensionSettings: { throttle_delay: 0 },
        batchNeeded: m => !!String(m?.mes ?? '').trim() && !m.extra?.display_text, emitBatch() {}, ask: async () => true, $: jq,
        toastr: { info: m => toasts.push(['info', m]), warning: m => toasts.push(['warning', m]), success: m => toasts.push(['success', m]), error: (m, t) => toasts.push(['error', m, t]) },
        console: { warn() {}, error() {}, log() {} },
        translateMessage: async (id) => { translated.push(id); if (hold) await hold(id); const m = context.chat[id]; if (m) m.extra.display_text = 'KO:' + m.mes; },
        Set, Map, Math, Number, Promise, Date, setTimeout, String,
    };
    const code = [cut('settleGuard', 'async function'), cut('onTranslateChatClick', 'async function')].join('\n');
    const api = new Function('env', `with (env) { ${code}\n return { onTranslateChatClick }; }`)(env);
    return { context, guards, translated, toasts, api, env, setHold(fn) { hold = fn; } };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

await test('다시 불러오기가 없으면 예전처럼 차례로 다 번역하고 완료를 알려요', async () => {
    const f = fixture();
    await f.api.onTranslateChatClick();
    assert.deepEqual(f.translated, [0, 1, 2, 3]);
    assert.deepEqual(f.toasts.at(-1), ['success', '채팅 번역이 완료됐어요.']);
});

await test('도는 중에 같은 채팅이 제자리에서 다시 불려도 남은 메시지를 이어 번역해요', async () => {
    const f = fixture();
    let release;
    f.setHold(id => id === 0 ? new Promise(r => { release = r; }) : null);
    const run = f.api.onTranslateChatClick();
    await until(() => release);
    f.context.chat[0].extra.display_text = 'KO:' + f.context.chat[0].mes;   // 첫 번역이 붙은 뒤
    f.context.chat = copyOf(f.context.chat);                                 // 채팅이 제자리에서 다시 불림(새 객체)
    f.guards.chatChanged();                                                  // 같은 채팅 열쇠 — 세대는 그대로
    release(); await run;
    assert.deepEqual(f.translated, [0, 1, 2, 3], '1 · 2 · 3번도 번역해요(고치기 전: [0] 뿐)');
    assert.ok(f.context.chat.slice(1).every(m => m.extra.display_text), '새 객체에 번역이 붙어요');
    assert.deepEqual(f.toasts.at(-1), ['success', '채팅 번역이 완료됐어요.']);
});

await test('다시 불러오는 사이(배열이 잠깐 빔)는 기다렸다가 이어 가요', async () => {
    const f = fixture(3);
    let release;
    f.setHold(id => id === 0 ? new Promise(r => { release = r; }) : null);
    const run = f.api.onTranslateChatClick();
    await until(() => release);
    const next = copyOf(f.context.chat); next[0].extra.display_text = 'KO:x';
    f.context.chat = []; f.guards.chatChanged();
    setTimeout(() => { f.context.chat = next; }, 150);
    release(); await run;
    assert.deepEqual(f.translated, [0, 1, 2]);
    assert.deepEqual(f.toasts.at(-1), ['success', '채팅 번역이 완료됐어요.']);
});

await test('다른 채팅으로 바꾸면 전처럼 멈추고 새 채팅은 건드리지 않아요', async () => {
    const f = fixture();
    let release;
    f.setHold(id => id === 0 ? new Promise(r => { release = r; }) : null);
    const run = f.api.onTranslateChatClick();
    await until(() => release);
    f.context.chatId = 'chat-b'; f.context.chat = copyOf(f.context.chat); f.guards.chatChanged();
    release(); await run;
    assert.deepEqual(f.translated, [0]);
    assert.equal(f.toasts.at(-1)[0], 'info', '「멈췄어요」 알림');
});

await test('지워진 메시지는 건너뛰어요(같은 자리에 다른 글이 왔으면 그 글을 대신 번역하지 않아요)', async () => {
    const f = fixture();
    let release;
    f.setHold(id => id === 0 ? new Promise(r => { release = r; }) : null);
    const run = f.api.onTranslateChatClick();
    await until(() => release);
    f.context.chat.splice(1, 1);   // 1번을 지움 — 2 · 3번이 1 · 2번으로 당겨져요(객체는 그대로)
    release(); await run;
    assert.deepEqual(f.translated, [0, 1, 2]);
    assert.ok(f.context.chat.every(m => m.extra.display_text));
});

await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-batch-reload.mjs .'));
});
console.log(`translator-batch-reload: ${passed} passed`);
