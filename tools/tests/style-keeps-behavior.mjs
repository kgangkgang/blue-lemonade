// 스타일(지금 모습 저장 · 입히기)이 채팅 「쓰는 방식」 값을 담지도 덮지도 않는지 (styles.js CHAT_BEHAVIOR)
//   1.5.3 ~ 1.5.8: chat.noteCarry(새 채팅에 직전 작가 노트)가 목록에서 빠져, 스타일을 입힐 때마다 저장 때 값으로 되돌아갔어요.
//   초기화가 남기는 목록(settings.js resetSettings 의 chat 줄)과 같은 집합이어야 해요 — 한쪽에만 더하면 여기서 떨어져요.
//   node tools/tests/style-keeps-behavior.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], characterId: undefined, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
const { DEFAULTS, getSettings } = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const { captureStyle, applyStyleData } = await import(pathToFileURL(path.join(root, 'src/styles.js')).href);

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  PASS  ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + String(e.message || e).split('\n').slice(0, 4).join('\n        ')); } };
const list = (src, open) => {
    const at = src.indexOf(open); assert.ok(at >= 0, `목록을 못 찾았어요: ${open}`);
    return [...src.slice(at, src.indexOf(']', at)).matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]);
};

test('스타일을 입혀도 새 채팅 작가 노트 방식(chat.noteCarry)이 그대로예요', () => {
    ctx.extensionSettings.salty = structuredClone(DEFAULTS);
    const s = getSettings();
    const before = s.chat.noteCarry;
    const saved = captureStyle(s);
    assert.ok(!('noteCarry' in saved.chat), '스타일에 담지 않아요');
    const other = ['ask', 'always', 'never', 'off'].find(v => v !== before) || 'always';
    s.chat.noteCarry = other;
    applyStyleData(saved, s);
    assert.equal(s.chat.noteCarry, other);
    applyStyleData({ ...saved, chat: { ...saved.chat, noteCarry: before } }, s);   // 옛 판이 담아 둔 스타일 · 받은 스타일
    assert.equal(s.chat.noteCarry, other, '옛 스타일에 든 값도 덮지 않아요');
});

test('styles.js CHAT_BEHAVIOR 와 초기화가 남기는 chat 목록이 같은 집합이에요', () => {
    const style = list(read('src/styles.js'), 'const CHAT_BEHAVIOR = [');
    const settings = read('src/settings.js');
    const reset = list(settings.slice(settings.indexOf('export function resetSettings')), "for (const key of ['triangleFold'");
    assert.deepEqual([...style].sort(), [...reset].sort());
});

console.log(`style-keeps-behavior: ${pass} 통과 · ${fail} 실패`);
if (fail) process.exit(1);
