// 8.2.7 새 답 첫 줄로(↑) 단추 (src/reply-top.js) — 사칭 · 조용한 생성이 끝날 때는 새 답이 없으니 지난 답으로 ↑ 를 띄우지 않아요.
//   node tools/tests/reply-top-generation-types.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));

const handlers = new Map();
const eventSource = { on: (n, fn) => { if (!handlers.has(n)) handlers.set(n, []); handlers.get(n).push(fn); }, removeListener: (n, fn) => { const l = handlers.get(n) || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } };
const emit = (n, ...args) => { for (const fn of [...(handlers.get(n) || [])]) fn(...args); };
const event_types = { GENERATION_STARTED: 'gs', GENERATION_ENDED: 'ge', MESSAGE_SWIPED: 'ms', CHAT_CHANGED: 'cc', MESSAGE_DELETED: 'md', MESSAGE_EDITED: 'me', MESSAGE_UPDATED: 'mu' };
globalThis.SillyTavern = { getContext: () => ({ eventSource, event_types }) };
// 맨 아래에 있고, 마지막 답(긴 답)의 이름 줄은 화면 위로 지나가 있어요
const rect = (top, bottom) => ({ top, bottom, left: 0, right: 100, height: bottom - top });
const head = { getBoundingClientRect: () => rect(-500, -480) };
const mes = { isConnected: true, querySelector: s => (s === '.ch_name' ? head : null), getAttribute: () => '5' };
const chatEl = { scrollHeight: 2000, scrollTop: 1500, clientHeight: 500, getBoundingClientRect: () => rect(0, 500), querySelector: () => mes, querySelectorAll: () => [mes] };
let made = null;
globalThis.document = {
    getElementById: id => (id === 'chat' ? chatEl : null),
    body: { append: el => { el.isConnected = true; } },
    createElement: () => (made = { hidden: true, isConnected: false, setAttribute() {}, addEventListener() {}, remove() { this.isConnected = false; }, style: { setProperty() {} } }),
    addEventListener() {}, removeEventListener() {},
};
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
const timers = new Map(); let tick = 0;
globalThis.setTimeout = fn => { timers.set(++tick, fn); return tick; };
globalThis.clearTimeout = id => { timers.delete(id); };
const run = () => { const list = [...timers.values()]; timers.clear(); for (const fn of list) fn(); };
const M = await import(pathToFileURL(path.join(root, 'src/reply-top.js')));
M.syncReplyTop(true);
const shown = () => M._forTest.state().shown;

for (const type of ['impersonate', 'quiet']) {
    emit('gs', type, {}, false); emit('ge', 6); run();
    assert.equal(shown(), false, `${type} 가 끝나도 지난 답으로 ↑ 를 띄우지 않아요`);
}
emit('gs', 'normal', {}, false); emit('ge', 6); run();
assert.equal(shown(), true, '새 답이 끝나면 ↑ 를 띄워요');
M._forTest.hide();
// 새 답 뒤에 따로 끝나는 조용한 생성은 다시 띄우지 않아요
emit('gs', 'quiet', {}, false); emit('ge', 6); run();
assert.equal(shown(), false, '새 답 뒤의 조용한 생성 끝은 ↑ 를 다시 띄우지 않아요');
// 미리 돌리기(dryRun)는 그대로 무시
emit('gs', 'normal', {}, true); emit('ge', 6); run();
assert.equal(shown(), false);
// 버그 사냥 4: 답이 끝난 직후(350ms 안) 번역 끝 그림 · 상태창 헬퍼 알림 · 에셋 다시 그리기가 MESSAGE_UPDATED 를 내도 기다리던 ↑ 를 지우지 않아요
//   (번역기는 'llm-translator:rendered' 로 기다림을 다시 걸고 곧바로 MESSAGE_UPDATED 를 내서, 자동 번역 + 상태창이면 ↑ 가 한 번도 안 떴어요)
emit('gs', 'normal', {}, false); emit('ge', 6); emit('mu', 5); run();
assert.equal(shown(), true, '기다리는 동안 온 MESSAGE_UPDATED 는 ↑ 를 막지 않아요');
emit('mu', 5);
assert.equal(shown(), false, '떠 있는 ↑ 는 고침 · 다시 그림에 걷어요(전과 같음)');
emit('gs', 'normal', {}, false); emit('ge', 6); emit('md', 5); run();
assert.equal(shown(), true, '지운 뒤에도 남은 마지막 답으로 다시 재요');
M._forTest.hide();
M.syncReplyTop(false);
console.log('PASS ↑ 단추는 새 답이 끝날 때만 떠요 (사칭 · 조용한 생성 · 미리 돌리기는 아님)');
