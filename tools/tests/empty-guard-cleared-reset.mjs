// 1.1.2 코드 감사 M1 — 빈 채팅 덮어쓰기 막기: 사용자가 한 번 다 비운 채팅은 「비움」 표시가 남아, 다시 대화한 뒤의 0개 저장이 그대로 통과하던 것
//   node tools/tests/empty-guard-cleared-reset.mjs [테마 뿌리, 기본 .]
// 「비움」 표시(cleared)는 채팅을 다시 열 때 메시지가 있을 때만 지워졌어요. 같은 채팅에서 채팅을 바꾸지 않고 다시 대화하면 표시가 남아,
// 그 뒤 다시 읽는 사이(배열이 먼저 비워진 순간)의 0개 저장을 못 막았어요. 메시지가 있는 저장을 본 순간 표시를 지워요.
// 지어낸 캐릭터 · 파일 이름만 써요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { createEmptyGuard } = await import(pathToFileURL(path.join(root, 'src/addons/perf/emptyguard.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const K = 'c|harbor-keeper.png|Harbor Keeper - 2026-11-10';
const OTHER = 'c|harbor-keeper.png|Harbor Keeper - other';
const body = (n, file = 'Harbor Keeper - 2026-11-10') => JSON.stringify({ ch_name: 'Harbor Keeper', file_name: file, chat: [{ chat_metadata: { integrity: 'x' } }, ...Array.from({ length: n }, () => ({ mes: 'm' }))], avatar_url: 'harbor-keeper.png', force: false });
function rig({ server = 16 } = {}) {
    const state = { key: K, length: 16 };
    let asked = 0;
    const g = createEmptyGuard({ live: () => ({ ...state }), serverCount: async () => { asked++; return server; } });
    return { g, state, asked: () => asked };
}
const blocked = async value => (value === null ? false : (await value).block === true);

for (const via of ['precheck', 'check']) {
    await test(`${via}: 다 비운 뒤 같은 채팅에서 다시 대화하면, 그 뒤의 0개 저장은 다시 막아요`, async () => {
        const { g, state } = rig();
        const save = n => g[via]('/api/chats/save', body(n), K);
        g.onChatOpened();                                   // 16개 채팅을 열었어요
        state.length = 0; g.onMessageDeleted();             // 사용자가 다 지움
        assert.equal(await blocked(save(0)), false, '사용자가 비운 직후의 0개 저장은 그대로 보내요');
        assert.equal(g.debug.cleared.has(K), true);
        state.length = 12;                                  // 채팅을 바꾸지 않고 다시 12개까지 대화
        assert.equal(await blocked(save(12)), false);
        assert.equal(g.debug.cleared.has(K), false, '메시지가 있는 저장을 본 순간 「비움」 표시를 지워요');
        assert.equal(g.debug.known.get(K), 12);
        state.length = 0;                                   // 다시 읽는 사이 — 배열이 먼저 비워진 순간의 저장
        const result = await save(0);
        assert.equal(result?.block, true, '12개가 있던 채팅의 0개 저장');
        assert.equal(result.reason, 'known');
        assert.equal(result.had, 12);
    });

    await test(`${via}: 지금 채팅이 아닌 파일로 가는 메시지 있는 저장도 그 파일의 「비움」 표시를 지워요`, async () => {
        const { g, state, asked } = rig({ server: 3 });
        g.onChatOpened();
        state.length = 0; g.onMessageDeleted();
        state.key = OTHER; state.length = 5;                // 다른 채팅을 보는 중에 K 로 가는 늦은 저장(메시지 3개)
        assert.equal(await blocked(g[via]('/api/chats/save', body(3), K)), false);
        assert.equal(g.debug.cleared.has(K), false);
        assert.equal(await blocked(g[via]('/api/chats/save', body(0), K)), true, '서버에 물어 메시지가 있으면 막아요');
        assert.equal(asked(), 1);
    });
}

await test('다 비운 채로 두면 0개 저장은 계속 그대로 보내요(표시는 메시지가 생길 때만 지워요)', async () => {
    const { g, state } = rig();
    g.onChatOpened();
    state.length = 0; g.onMessageDeleted();
    for (let i = 0; i < 3; i++) assert.equal(await blocked(g.precheck('/api/chats/save', body(0), K)), false);
    assert.equal(g.debug.cleared.has(K), true);
    assert.equal(g.stats.blocked, 0);
});

console.log(`empty-guard-cleared-reset: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
