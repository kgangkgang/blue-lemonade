// 버그 사냥 2차: 1.5.9 인물표 공급자(카드별 색 기억 · 프리셋 색)의 경계 조건. 이름 · 색은 지어낸 것. 실리태번 없음.
//   ① 카드별 색 기억의 {{user}} · {{char}} 를 지금 이름으로 바꿀 때 이름에 든 `$&` · `$$` 가 치환 표시로 풀렸어요(이름이 달라져 색을 못 찾음).
//   ② 프리셋 색 켜기가 겹치면(설정 적용이 잇달아 — 부팅 때 늘) 신호를 두 번 걸고 한 벌만 뗐어요 → 끈 뒤에도 프리셋 글을 계속 읽음.
//   ③ 켜는 도중(모듈 받는 중) 끄면, 받기가 끝난 뒤 공급자가 켜진 채 남았어요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const imp = rel => import(pathToFileURL(path.join(root, rel)));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('PASS', name); };

const card = await imp('src/card-colors.js');
await ok('카드별 색: 이름에 $& · $$ 가 있어도 그대로', () => {
    const ctx = { extensionSettings: { lemon_voice: { card_colors: { 'a.png': { '#112233': '{{user}}', '#445566': '{{char}}' } } } }, characters: [{ avatar: 'a.png' }], characterId: 0, name1: 'Cash$$ & $&', name2: "Bo$'s" };
    assert.deepEqual(card.cardColorRows(ctx), [{ name: 'Cash$$ & $&', color: '#112233' }, { name: "Bo$'s", color: '#445566' }]);
    assert.equal(card.tableColor(card.cardColorTable(ctx), 'Cash$$ & $&'), '#112233');
});

const preset = await imp('src/preset-colors.js');
const people = await imp('src/people.js');
const listeners = new Map();
const es = { on(type, fn) { listeners.set(type, [...(listeners.get(type) ?? []), fn]); }, removeListener(type, fn) { const list = listeners.get(type) ?? []; const at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); } };
const count = () => [...listeners.values()].reduce((sum, list) => sum + list.length, 0);
globalThis.SillyTavern = { getContext: () => ({ eventSource: es, eventTypes: { CHAT_CHANGED: 'chat', SETTINGS_UPDATED: 'settings' }, characters: [], name1: '하람' }) };
const has = () => { const before = people.people.list; return typeof before === 'function'; };
await ok('프리셋 색: 켜기가 겹쳐도 신호는 한 벌 · 끄면 모두 뗌', async () => {
    await Promise.all([preset.syncPresetColors(true), preset.syncPresetColors(true), preset.syncPresetColors(true)]);
    assert.equal(count(), 2, '이벤트마다 하나씩');
    await preset.syncPresetColors(false);
    assert.equal(count(), 0, '끄면 남는 신호가 없어요');
});
await ok('프리셋 색: 켜는 도중 끄면 꺼진 채', async () => {
    preset._forTest.setApi(null);
    const starting = preset.syncPresetColors(true);
    await preset.syncPresetColors(false);
    await starting;
    assert.equal(count(), 0, '받기가 끝난 뒤에도 신호를 걸지 않아요');
    await preset.syncPresetColors(true);
    assert.equal(count(), 2, '다시 켜면 예전처럼');
    await preset.syncPresetColors(false);
    assert.equal(count(), 0);
});
console.log(JSON.stringify({ passed: n }));
