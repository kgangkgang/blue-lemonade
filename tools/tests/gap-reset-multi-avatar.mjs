// 「처음 설정으로」의 기본 선택(테마 모습만)이 자료를 지우지 않는지 봐요 (11-12 시험 빈 곳 메우기에서 찾은 결함 · 1.1.7 에서 고침)
//   ① multiAvatar.chars(프로필 여러 개 사진 목록) · addonCarry(개인 확장 이어받기 단계)가 남아요
//   ② 목록이 비었는데 서버에 bl-avatar-* 사진이 있으면 「정리」(multi-avatar/store.js cleanupPlan)가 지울 대상으로 내놓지 않아요
//   node tools/tests/gap-reset-multi-avatar.mjs [테마 루트]
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const ext = {};
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced() {} }) };
const S = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const M = await import(pathToFileURL(path.join(root, 'src/multi-avatar/store.js')).href);
const { folderOf } = await import(pathToFileURL(path.join(root, 'src/multi-avatar/pick.js')).href);
const F = folderOf('mira.png'), STRAY = 'bl-avatar-ffffffffffffffff';
const miraChars = () => ({ 'mira.png': { files: [`user/images/${F}/k1.webp`, `user/images/${F}/k2.webp`], pinned: '' } });
let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

await test('「테마 모습」 초기화 뒤에도 프로필 여러 개 사진 목록 · 개인 확장 이어받기 단계가 남아요', () => {
    const s = S.getSettings();
    const chars = miraChars();
    s.multiAvatar.chars = structuredClone(chars);
    s.multiAvatar.on = true;
    s.addonCarry = 2;
    const next = S.resetSettings({ look: true });
    assert.deepEqual(next.multiAvatar.chars, chars, '캐릭터마다 올린 사진 목록은 남아야 해요');
    assert.equal(next.addonCarry, 2, '이어받기 단계가 0 으로 돌아가면 이어받기가 한 번 더 돌아요');
    assert.equal(S.getSettings().multiAvatar.chars['mira.png'].files.length, 2, '정리를 거친 뒤에도 남아요');
});

const server = { [F]: ['k1.webp', 'k2.webp'], [STRAY]: ['o.webp'], 'not-ours': ['x.png'] };
const io = { ctx: { getRequestHeaders: () => ({}) }, fetcher: async (u, { body }) => {
    const payload = JSON.parse(body);
    const json = u.endsWith('/folders') ? Object.keys(server) : u.endsWith('/list') ? (server[payload.folder] || []).map(name => ({ name })) : null;
    return { ok: true, status: 200, json: async () => json };
} };
await test('사진 목록이 비었는데 서버에 bl-avatar 사진이 있으면 정리 계획은 지우지 않고 붙잡아요(held)', async () => {
    for (const chars of [{}, null, undefined]) {
        const plan = await M.cleanupPlan(chars, ['mira.png'], io);
        assert.equal(plan.total, 0);
        assert.deepEqual(plan.orphanFiles, []);
        assert.deepEqual(plan.goneFiles, []);
        assert.equal(plan.held, 3, 'not-ours 는 세지 않아요');
    }
});
await test('목록이 있으면 예전처럼 적히지 않은 사진만 정리 대상이에요(적힌 사진은 절대 안 넣어요)', async () => {
    const chars = miraChars();
    const plan = await M.cleanupPlan(chars, ['mira.png'], io);
    assert.equal(plan.held, 0);
    assert.deepEqual(plan.orphanFiles, [`user/images/${STRAY}/o.webp`]);
    for (const p of chars['mira.png'].files) assert.ok(!plan.orphanFiles.includes(p) && !plan.goneFiles.includes(p));
});
console.log(`gap-reset-multi-avatar: ${passed} passed${failed ? `, ${failed} failed` : ''}`);
if (failed) process.exitCode = 1;
