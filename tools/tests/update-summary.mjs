// 6.7.0 업데이트 안내: 새 판이 있으면 「무엇이 고쳐졌는지」 한두 줄 + 한 번에 업데이트 — src/update-check.js
//   node tools/tests/update-summary.mjs <테마 루트>
// 공지는 새 판마다 한 번만 받는지, 한 줄이 새 판이 있을 때만 생기는지, 글이 이스케이프되는지 본다. 새 타이머를 걸지 않는다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const mod = (p) => pathToFileURL(path.join(root, p)).href;

const ctx = { extensionSettings: {}, saveSettingsDebounced() {}, powerUserSettings: {} };
globalThis.SillyTavern = { getContext: () => ctx };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

// 아주 작은 DOM 흉내: 설정 창 root · .salty-sec · 한 줄
function el(tag) {
    const node = { tag, className: '', children: [], attrs: {}, innerHTML: '', isConnected: true, listeners: {},
        setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, fn) { this.listeners[t] = fn; },
        prepend(child) { this.children.unshift(child); child.parent = this; }, remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); } };
    return node;
}
const sec = el('section');
const panel = { querySelector: (sel) => (sel === '.salty-sec' ? sec : sel === '.bl-update-line' ? (sec.children.find(c => c.className === 'bl-update-line' && c.isConnected) || null) : null) };
const timers = [];
globalThis.document = { querySelectorAll: (sel) => (sel === '.salty-panel' ? [panel] : []), createElement: el, addEventListener() {}, visibilityState: 'visible' };
const realSetTimeout = globalThis.setTimeout, realSetInterval = globalThis.setInterval;
globalThis.setInterval = (...a) => { timers.push('interval'); return realSetInterval(...a); };

const NOTES = [
    { version: '6.6.10', date: '2026-10-16', items: ['번역 <b>괄호</b>를 고쳤어요.', '둘째 항목'] },
    { version: '6.6.9', date: '2026-10-16', items: ['다른 기기에서 바뀐 채팅을 알려 줘요. '.repeat(6)] },
    { version: '6.6.8', date: '2026-10-15', items: ['이미 깐 판'] },
];
let notesAsked = 0;
globalThis.fetch = async (u) => {
    const url = String(u);
    const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    if (url.startsWith('file:') && url.endsWith('manifest.json')) return res(200, { version: '6.6.8' });
    if (url.includes('raw.githubusercontent.com')) return res(200, { version: '6.6.10' });
    if (url.includes('release-notes.json')) { notesAsked++; return res(200, NOTES); }
    throw new Error('예상 밖 요청 ' + url);
};

const U = await import(mod('src/update-check.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

await test('summarizeNotes: 새 판부터 판마다 첫 항목 두 줄 · 긴 글은 줄임 · 남은 판 수', () => {
    const s = U.summarizeNotes(U.notesBetween(NOTES, '6.6.7', '6.6.10'));
    assert.equal(s.lines.length, 2);
    assert.equal(s.lines[0].version, '6.6.10');
    assert.ok(s.lines[1].text.length <= 90 && s.lines[1].text.endsWith('…'));
    assert.equal(s.more, 1);
    assert.deepEqual(U.summarizeNotes([]), { lines: [], more: 0 });
    assert.deepEqual(U.summarizeNotes(null), { lines: [], more: 0 });
});

await test('새 판이 없으면 한 줄도 없고 공지도 안 받는다', async () => {
    assert.equal(U.hasUpdate(), false);
    U.paintUpdateLine(panel);
    assert.equal(sec.children.length, 0);
    assert.equal(await U.updateSummary(), null);
    assert.equal(notesAsked, 0);
});

await test('새 판이 생기면 설정 창 맨 위에 한 줄 (판 먼저, 공지는 한 번 받아 채움 · 다음부터 저장된 값)', async () => {
    await U.checkForUpdate({ force: true });
    assert.equal(U.hasUpdate(), true);
    await new Promise(r => realSetTimeout(r, 20));
    const line = sec.children[0];
    assert.ok(line && line.className === 'bl-update-line', '한 줄 생김');
    assert.match(line.innerHTML, /새 판 v6\.6\.10 이 나왔어요<small>지금 v6\.6\.8<\/small>/);
    assert.match(line.innerHTML, /data-update-now/);
    assert.match(line.innerHTML, /번역 &lt;b&gt;괄호&lt;\/b&gt;를 고쳤어요\./, '공지 글은 이스케이프');
    assert.ok(!line.innerHTML.includes('이미 깐 판'));
    assert.equal(notesAsked, 1);
    U.paintUpdateLine(panel);   // 다시 그려도 한 줄 · 공지 다시 안 받음
    assert.equal(sec.children.filter(c => c.isConnected).length, 1);
    assert.equal(notesAsked, 1);
    assert.equal(JSON.parse(store.get('bl_update_notes')).key, '6.6.8>6.6.10');
});

await test('공지를 못 받으면 판과 업데이트 단추만 (다음에 다시)', async () => {
    store.delete('bl_update_notes');
    const keep = globalThis.fetch;
    globalThis.fetch = async (u) => (String(u).includes('release-notes') ? { ok: false, status: 503, json: async () => [] } : keep(u));
    assert.equal(await U.updateSummary(), null);
    assert.ok(!store.has('bl_update_notes'));
    const html = U.updateLineHtml('6.6.8', '6.6.10', null);
    assert.ok(html.includes('업데이트') && !html.includes('<span>'));
    globalThis.fetch = keep;
});

await test('업데이트 단추는 업데이트 창을 바로 시작으로 연다 (openUpdate start) · 새 판이 사라지면 한 줄도 걷힘', async () => {
    const src = (await import('node:fs')).readFileSync(path.join(root, 'src/update-check.js'), 'utf8');
    assert.match(src, /openUpdate\(\{ start: true \}\)/);
    assert.match(src, /if \(start\) void go\(\)/);
    U.clearUpdate();
    assert.equal(sec.children.filter(c => c.isConnected).length, 0);
    assert.deepEqual(timers, [], '새 상주 타이머 없음');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
