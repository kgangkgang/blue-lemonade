// 로어북 스캔에서 상태창 글 빼기 (src/wi-skip-core.js · src/wi-skip.js, 기본 꺼짐)
//   · 순수: 코드 칸 · 접는 칸만 빼기 · 닫히지 않은 칸은 그대로 · 사본으로 바꿔 끼우고 되돌리기
//   · 가짜 실리태번: 생성 차례(가로채기 → 스캔용 글 → 로어북 항목 읽음 사건 → 프롬프트)에서 스캔에는 뺀 글 · 프롬프트에는 원래 글
//   node tools/tests/wi-skip.mjs .
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('wi-skip');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const { stripForScan, swapForScan } = await load('src/wi-skip-core.js');

await test('코드 칸 · 접는 칸 안의 글만 빼요', () => {
    assert.equal(stripForScan('숲으로 갔다.\n```\n위치: 왕도\n```\n끝.'), '숲으로 갔다.\n\n끝.');
    assert.equal(stripForScan('숲으로 갔다.\n~~~yaml\n위치: 왕도\n~~~'), '숲으로 갔다.\n');
    assert.equal(stripForScan('앞 <details><summary>상태</summary>위치: 왕도</details> 뒤'), '앞  뒤');
    assert.equal(stripForScan('앞 <DETAILS open>\n```\n왕도\n```\n</DETAILS> 뒤'), '앞  뒤');
    assert.equal(stripForScan('```\n<details>왕도</details>\n```\n본문'), '\n본문');
    assert.ok(!stripForScan('a\n```\n왕도\n```\nb\n```\n항구\n```\nc').match(/왕도|항구/), '여러 칸');
});

await test('뺄 것이 없거나 닫히지 않은 칸은 받은 글 그대로', () => {
    for (const text of ['평범한 글', '한 줄 `왕도` 코드', '```\n닫히지 않은 칸\n왕도', '<details>닫히지 않음 왕도', '', '글 ```왕도``` 한 줄 안']) assert.equal(stripForScan(text), text, text);
    assert.equal(stripForScan(null), '');
    assert.equal(stripForScan(undefined), '');
});

await test('사본으로 바꿔 끼우고 원래 객체는 건드리지 않아요', () => {
    const a = { name: 'A', mes: '본문\n```\n왕도\n```', extra: { x: 1 } }, b = { name: 'B', mes: '그냥 글' }, c = { name: 'C' };
    const chat = [a, b, c, null];
    const swap = swapForScan(chat);
    assert.equal(swap.count, 1);
    assert.notEqual(chat[0], a); assert.equal(chat[0].mes, '본문\n'); assert.equal(chat[0].name, 'A'); assert.equal(chat[0].extra, a.extra);
    assert.equal(a.mes, '본문\n```\n왕도\n```', '실제 채팅 메시지는 그대로');
    assert.equal(chat[1], b); assert.equal(chat[2], c);
    assert.equal(swap.restore(), 1);
    assert.equal(chat[0], a);
    assert.equal(swap.restore(), 0, '두 번 불러도 한 번만');
});

await test('되돌리기: 그 사이 배열이 잘리거나 끼워져도 사본 자리만 찾아 되돌려요', () => {
    const a = { mes: '```\n왕도\n```' }, b = { mes: '<details>항구</details>' }, other = { mes: '끼워 넣은 것' };
    const chat = [a, b];
    const swap = swapForScan(chat);
    chat.unshift(other);        // 다른 확장이 앞에 끼워 넣음
    chat.splice(2, 1);          // b 의 사본을 잘라 냄
    assert.equal(swap.restore(), 1);
    assert.deepEqual(chat, [other, a]);
    assert.equal(swapForScan(null).count, 0);
    assert.equal(swapForScan(null).restore(), 0);
});

// ── 가짜 실리태번 ──
const listeners = new Map();
const event_types = { WORLDINFO_ENTRIES_LOADED: 'wi_loaded', WORLDINFO_SCAN_DONE: 'wi_scan', WORLD_INFO_ACTIVATED: 'wi_act', GENERATION_ENDED: 'gen_end', GENERATION_STOPPED: 'gen_stop', CHAT_CHANGED: 'chat' };
const ctx = { event_types, eventSource: { on(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); }, emit(name) { for (const fn of listeners.get(name) || []) fn(); } } };
globalThis.SillyTavern = { getContext: () => ctx };
const { GENERATE_HOOKS, installGenerateInterceptor } = await load('src/private-addons.js');
installGenerateInterceptor();
const mod = await load('src/wi-skip.js');
const real = () => [{ name: '나', mes: '왕도로 가자' }, { name: '봇', mes: '좋아요.\n<details><summary>상태</summary>위치: 항구</details>' }];
/** 실리태번 Generate 의 차례를 그대로: 가로채기 → 스캔용 글 → 항목 읽음 사건 → 프롬프트용 글 */
async function generate(chat, type = 'normal', { loadFails = false } = {}) {
    const coreChat = [...chat];
    await globalThis.blueLemonadeGenerate(coreChat, 4096, () => {}, type);
    const scan = coreChat.map(m => m.mes);
    if (!loadFails) ctx.eventSource.emit(event_types.WORLDINFO_ENTRIES_LOADED);
    const prompt = coreChat.map(m => m.mes);
    return { scan, prompt, coreChat };
}

await test('꺼져 있으면 아무것도 바꾸지 않아요 (기본 꺼짐)', async () => {
    assert.match(read('src/settings.js'), /wiSkip: false/);
    const chat = real(), out = await generate(chat);
    assert.deepEqual(out.scan, chat.map(m => m.mes));
    assert.equal(globalThis[GENERATE_HOOKS].size, 0, '켜기 전에는 훅도 없어요');
});

await test('켜면 스캔에는 뺀 글, 프롬프트에는 원래 글 · 실제 채팅은 그대로', async () => {
    mod.syncWiSkip(true);
    const chat = real(), before = JSON.stringify(chat), out = await generate(chat);
    assert.ok(!out.scan.join('\n').includes('항구'), '스캔 글에서 상태창 낱말이 빠져요');
    assert.ok(out.scan.join('\n').includes('왕도'), '본문 낱말은 남아요');
    assert.deepEqual(out.prompt, chat.map(m => m.mes), '프롬프트는 원래 글');
    assert.equal(out.coreChat[1], chat[1], '원래 메시지 객체로 되돌아와요');
    assert.equal(JSON.stringify(chat), before);
    assert.equal(mod._forTest.pending(), 0);
});

await test('다시 켜도 훅 · 리스너는 하나씩', () => {
    const count = () => [...listeners.values()].reduce((n, list) => n + list.length, 0), was = count();
    mod.syncWiSkip(false); mod.syncWiSkip(true); mod.syncWiSkip(true);
    assert.equal(count(), was);
    assert.equal(globalThis[GENERATE_HOOKS].size, 1);
});

await test('조용한 생성(quiet)은 건드리지 않아요', async () => {
    const chat = real(), out = await generate(chat, 'quiet');
    assert.deepEqual(out.scan, chat.map(m => m.mes));
});

await test('항목 읽음 사건이 안 온 요청: 다음 생성 · 생성 끝 · 채팅 바뀜에서 되돌려요', async () => {
    const chat = real(), out = await generate(chat, 'normal', { loadFails: true });
    assert.notEqual(out.coreChat[1], chat[1]);
    assert.equal(mod._forTest.pending(), 1);
    ctx.eventSource.emit(event_types.GENERATION_ENDED);
    assert.equal(out.coreChat[1], chat[1]);
    const again = await generate(chat, 'normal', { loadFails: true });
    const next = await generate(chat);
    assert.equal(again.coreChat[1], chat[1], '다음 생성이 시작될 때 앞 것을 먼저 되돌려요');
    assert.deepEqual(next.prompt, chat.map(m => m.mes));
});

await test('되돌릴 사건이 없는 실리태번에서는 바꾸지 않아요', async () => {
    const keep = event_types.WORLDINFO_ENTRIES_LOADED; delete event_types.WORLDINFO_ENTRIES_LOADED;
    try {
        const chat = real(), coreChat = [...chat];
        await globalThis.blueLemonadeGenerate(coreChat, 4096, () => {}, 'normal');
        assert.deepEqual(coreChat, chat);
    } finally { event_types.WORLDINFO_ENTRIES_LOADED = keep; }
});

await test('끄면 남은 것을 되돌리고 더는 바꾸지 않아요', async () => {
    const chat = real(), held = await generate(chat, 'normal', { loadFails: true });
    mod.syncWiSkip(false);
    assert.equal(held.coreChat[1], chat[1]);
    const out = await generate(chat);
    assert.deepEqual(out.scan, chat.map(m => m.mes));
});

await test('연결: 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 설정 키', () => {
    assert.match(read('src/features.js'), /load\('wiskip', '\.\/wi-skip\.js'\)\.then\(m => m\?\.syncWiSkip\(wiSkip\)\)/);
    assert.match(read('src/panel.js'), /toggle\('quick\.wiSkip', s\.quick\?\.wiSkip === true\)/);
    assert.match(read('src/settings-search.js'), /'quick\.wiSkip'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.wiSkip':'로어북 스캔에서 상태창 글 빼기'/);
    assert.match(read('tools/tests/settings-keys-1000.json'), /"quick.wiSkip"/);
    for (const file of ['index.js', 'src/features.js']) assert.ok(!/from '\.\/wi-skip(-core)?\.js'/.test(read(file)), `${file} 는 시작할 때 이 모듈을 받지 않아요`);
});

done();
