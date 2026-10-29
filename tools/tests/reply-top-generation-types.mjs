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
const timers = [];
globalThis.setTimeout = fn => { timers.push(fn); return timers.length; };
globalThis.clearTimeout = () => {};
const run = () => { for (const fn of timers.splice(0)) fn(); };
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
M.syncReplyTop(false);
console.log('PASS ↑ 단추는 새 답이 끝날 때만 떠요 (사칭 · 조용한 생성 · 미리 돌리기는 아님)');
