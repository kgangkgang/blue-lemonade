// 「처음 설정으로」가 남기는 목록(settings.js RESET_KEEP)과 「변경한 설정」이 자료로 빼는 목록(settings-differences.js OMITTED_KEYS)이 어긋나지 않게 지켜요
//   모습이 아닌 자료 칸은 전부 RESET_KEEP(늘 남김) · RESET_GROUPS(따로 고르는 묶음) · RESET_CLEARED(일부러 비움) 중 한 곳에 있어야 해요
//   새 자료 칸을 OMITTED_KEYS 에 넣고 초기화 쪽을 잊으면 여기서 떨어져요 (1.1.7 multiAvatar 사고 재발 막기)
//   node tools/tests/reset-keep-drift.mjs [테마 루트]
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {}, saveSettingsDebounced() {} }) };
const S = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
let D;
try { D = await import(pathToFileURL(path.join(root, 'src/settings-differences.js')).href); }
catch (e) { console.log(`  FAIL  settings-differences.js 를 node 에서 못 읽어요: ${e.message}`); process.exit(1); }
const handled = new Set([...S.RESET_KEEP, ...Object.values(S.RESET_GROUPS).flat(), ...S.RESET_CLEARED]);
const missing = [...D.OMITTED_KEYS].filter(k => !handled.has(k));
const cleared = S.RESET_CLEARED.filter(k => S.RESET_KEEP.includes(k));
const unknown = [...handled].filter(k => !(k in S.DEFAULTS));
try {
    assert.deepEqual(missing, [], `자료 칸인데 초기화 정책이 없어요: ${missing.join(', ')} — RESET_KEEP 에 넣거나 일부러 비우면 RESET_CLEARED 에 넣어요`);
    assert.deepEqual(cleared, [], `RESET_KEEP 과 RESET_CLEARED 에 동시에 있어요: ${cleared.join(', ')}`);
    assert.deepEqual(unknown, [], `DEFAULTS 에 없는 칸 이름이에요(오타?): ${unknown.join(', ')}`);
    for (const k of ['multiAvatar', 'addonCarry']) assert.ok(S.RESET_KEEP.includes(k), `${k} 는 늘 남겨야 해요`);
    console.log(`  PASS  자료 칸 ${D.OMITTED_KEYS.size}개가 모두 초기화 정책을 가져요`);
    console.log('reset-keep-drift: 1 passed');
} catch (e) { console.log(`  FAIL  ${e.message}`); process.exitCode = 1; }
