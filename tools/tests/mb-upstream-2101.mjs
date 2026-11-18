// 1.8.3 미트볼 2.10.1 맞춤 확인 — 원작이 출력 규칙 기본 문구 둘을 바꾼 판(11-19)
//   ① 확인 목록(verified)에 2.10.1 이 있어요(src/ext-compat.js)
//   ② 줄 꼴 규칙(src/mb-prompt.js syncRules)을 기본 문구 위에 붙여 둔 칸은, 원작이 기본 문구를 바꾸면 다시 맞출 때 새 기본 문구 위로 옮겨 붙어요
//      · 바뀌지 않은 칸은 그대로 · 사용자가 손으로 고친 칸은 옮기지 않아요(손으로 고친 앞부분 보존)
//   기본 문구는 이 시험이 지은 가짜 글이에요(원작 문구를 담지 않아요).
//   node tools/tests/mb-upstream-2101.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const P = await import(pathToFileURL(path.join(root, 'src/mb-prompt.js')).href);
const doc = { querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {} } };
const ctxOf = () => ({ extensionSettings: { statussim: {} }, saved: 0, saveSettingsDebounced() { this.saved++; } });

await ok('① 확인 목록(verified)에 2.10.1', async () => {
    const src = fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8');
    const line = src.split('\n').find(l => l.includes("root: '#ss-settings'"));
    assert.ok(line && line.includes("'2.10.0', '2.10.1']"), '미트볼 줄 verified 끝이 2.10.0 · 2.10.1');
});

const OLD = { 'inj.output': 'Old output rule (fake).', 'inj.ultra.output': 'Old ultra rule (fake). Keys: {keys}', 'ai.analyze': 'Analyze rule (fake).' };
const NEW = { ...OLD, 'inj.output': 'New output rule (fake) — also what the user wrote.', 'inj.ultra.output': 'New ultra rule (fake) — also user text. Keys: {keys}' };

await ok('② 기본 문구가 바뀌면 줄 꼴 규칙이 새 기본 문구 위로', async () => {
    const c = ctxOf();
    assert.equal((await P.syncRules(true, { c, defs: OLD, doc })).changed, 3);
    const r = await P.syncRules(true, { c, defs: NEW, doc });
    assert.equal(r.changed, 2, '바뀐 칸 둘만 다시 써요');
    const pr = c.extensionSettings.statussim.prompts;
    for (const k of Object.keys(NEW)) {
        assert.equal(P.stripRules(pr[k]).replace(/\n$/, ''), NEW[k], k);
        assert.ok(P.hasRules(pr[k]), k);
    }
    assert.equal((await P.syncRules(true, { c, defs: NEW, doc })).changed, 0, '다시 불러도 그대로');
});

await ok('② 손으로 고친 칸은 옮기지 않아요', async () => {
    const c = ctxOf();
    c.extensionSettings.statussim.prompts = { 'inj.output': 'My own rule.' };
    await P.syncRules(true, { c, defs: OLD, doc });
    await P.syncRules(true, { c, defs: NEW, doc });
    assert.equal(P.stripRules(c.extensionSettings.statussim.prompts['inj.output']).replace(/\n$/, ''), 'My own rule.');
});

await ok('② 끄면 바뀐 기본 문구 칸은 비워요(그 확장 기본값을 따라가요)', async () => {
    const c = ctxOf();
    await P.syncRules(true, { c, defs: OLD, doc });
    await P.syncRules(false, { c, defs: NEW, doc });
    assert.deepEqual(Object.keys(c.extensionSettings.statussim.prompts), []);
});
console.log(`mb-upstream-2101: ${n}개 통과`);
