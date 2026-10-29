// 8.2.4 사후 검토(review-824): 캐릭터 검색 조합 디바운스(src/search-ime.js) — 마지막 글자를 조합 중인 채로 손을 멈췄을 때도 검색이 도는지.
// 한글 IME(윈도 · 맥 · 안드로이드 Gboard)는 마지막 음절을 다음 글자 · 스페이스 · 칸 밖 누름 전까지 「조합 중」으로 둬요(compositionend 가 안 와요).
// 고치기 전: 조합 중 input 은 타이머 없이 멈추기만 해서 「하나」를 치고 기다려도 목록이 안 바뀌었어요(스페이스 · 다른 곳 누를 때까지).
//   node tools/tests/search-ime-composing.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const form = { listeners: {}, addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }, removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); } };
const seen = [];   // 실리태번 핸들러에 닿은 값
const input = { id: 'character_search_bar', parentElement: form, value: '', dispatchEvent(ev) { deliver(ev.type); return true; } };
globalThis.document = { getElementById: id => (id === input.id ? input : null) };
function deliver(type, isComposing = false) {
    let stopped = false;
    const ev = { type, target: input, isComposing, stopImmediatePropagation() { stopped = true; } };
    for (const fn of form.listeners[type] || []) fn(ev);
    if (!stopped && type === 'input') seen.push(input.value);
}
/** 한 음절 조합: compositionstart → 자모마다 input(isComposing) — compositionend 는 부르는 쪽이 */
function compose(steps) { deliver('compositionstart'); for (const v of steps) { input.value = v; deliver('input', true); } }

const si = await import(pathToFileURL(path.join(root, 'src/search-ime.js')));
si.syncSearchIme(true);
const wait = (si.COMPOSING_DELAY ?? si.DELAY) + 80;

// 「하」 를 끝내고 「나」 를 조합 중인 채로 멈춤
compose(['ㅎ', '하']); deliver('compositionend');
compose(['하ㄴ', '하나']);
await sleep(wait);
t('마지막 음절을 조합 중인 채로 멈추면 잠시 뒤 지금 칸의 값으로 한 번 찾아요 (고치기 전: 0번)', () => {
    assert.deepEqual(seen, ['하나']);
});
t('조합 중 기다림은 조합이 끝난 뒤(DELAY)보다 길어요 — 자모 하나하나에 찾지 않게', () => {
    assert.ok(si.COMPOSING_DELAY > si.DELAY);
});
deliver('compositionend');
await sleep(si.DELAY + 80);
t('그 뒤 compositionend 가 와도 값이 그대로면 같은 검색을 또 하지 않아요', () => assert.deepEqual(seen, ['하나']));

// 쉬지 않고 이어 치면 조합 중 타이머는 계속 밀려요
seen.length = 0;
for (const v of ['하나ㄷ', '하나두']) { input.value = v; deliver('input', true); await sleep(si.DELAY - 100); }
t('조합 중에도 이어 치는 동안(DELAY 안쪽 간격)은 찾지 않아요', () => assert.deepEqual(seen, []));
input.value = '하나둘'; deliver('input', true); deliver('compositionend');
await sleep(si.DELAY + 80);
t('조합이 끝나면 DELAY 뒤 한 번', () => assert.deepEqual(seen, ['하나둘']));

// 조합 취소(Esc) — 값이 되돌아가면 그 값으로
seen.length = 0;
compose(['하나둘ㅅ']); input.value = '하나둘'; deliver('input', true); deliver('compositionend');
await sleep(si.DELAY + 80);
t('조합 취소(Esc)로 값이 되돌아가도 그 값으로 한 번 찾아요 (마지막 값을 잃지 않아요)', () => assert.deepEqual(seen, ['하나둘']));
seen.length = 0;
compose(['ㅅ']); input.value = ''; deliver('input', true); deliver('compositionend');
await sleep(si.DELAY + 80);
t('지우다 조합 취소로 칸이 비면 빈 값으로 한 번 (마지막 값을 잃지 않아요)', () => assert.deepEqual(seen, ['']));
si.syncSearchIme(false);
console.log(`PASS search-ime-composing: ${n} checks`);
