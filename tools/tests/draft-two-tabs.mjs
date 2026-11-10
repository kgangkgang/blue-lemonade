// 코드 감사 2차 G1: 쓰다 만 글 지키기(src/draft.js) — 같은 브라우저 두 탭(PC 창 둘)에서 서로 다른 채팅에 글을 써도 두 초안이 다 남아요.
// 고치기 전: 초안 표를 탭마다 메모리에 한 번만 읽어 두고 통째로 써서, 먼저 열린 탭이 저장하는 순간 다른 탭의 초안이 localStorage 에서 사라졌어요.
// 고친 뒤: 고치기 직전에 저장값을 다시 읽어 그 채팅 칸만 바꾸고, 다른 탭이 적으면(storage 사건) 메모리 사본을 버려요.
//   탭 하나 = 모듈 인스턴스 하나(주소 뒤 ?tab= 로 따로 싣기).   node tools/tests/draft-two-tabs.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const windows = [];
let seq = 0;
async function tab(name, chatId) {
    const box = Object.assign(new EventTarget(), { value: '' });
    const doc = Object.assign(new EventTarget(), { hidden: false, getElementById: id => (id === 'send_textarea' ? box : null) });
    const win = new EventTarget();
    windows.push(win);
    const handlers = {};
    const ctx = { chatId, groupId: null, characterId: 0, characters: [{ avatar: `${name}.png` }], eventSource: { on(type, fn) { handlers[type] = fn; } }, event_types: { CHAT_CHANGED: 'cc' } };
    const use = () => { globalThis.document = doc; globalThis.window = win; globalThis.SillyTavern = { getContext: () => ctx }; };
    use();
    const m = await import(pathToFileURL(path.join(root, 'src/draft.js')).href + `?tab=${name}-${++seq}`);
    m.startDraftKeep();
    return {
        box,
        type(text) { use(); box.value = text; box.dispatchEvent(new Event('input')); },
        flush() { use(); return m.preserveDraftForReload(); },
        open(id) { use(); ctx.chatId = id; handlers.cc(); },
    };
}
// 다른 탭에 storage 사건 보내기 (브라우저는 적은 탭 말고 다른 탭에만 보내요)
const broadcast = () => { for (const w of windows) { const e = new Event('storage'); e.key = 'bl-drafts'; w.dispatchEvent(e); } };
const read = () => Object.fromEntries(Object.entries(JSON.parse(store.get('bl-drafts') || '{}')).map(([k, v]) => [k, v.t]));
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };

await test('탭 A 가 먼저 열리고 탭 B 가 저장한 뒤 탭 A 가 저장해도 탭 B 의 초안이 남아요 (고치기 전: 사라짐)', async () => {
    store.clear();
    const A = await tab('A', '채팅가');
    const B = await tab('B', '채팅나');
    B.type('탭 B 에서 쓰던 긴 글'); assert.equal(B.flush(), true);
    A.type('탭 A 에서 쓰던 글'); assert.equal(A.flush(), true);
    assert.deepEqual(Object.values(read()).sort(), ['탭 A 에서 쓰던 글', '탭 B 에서 쓰던 긴 글'].sort());
});
await test('다른 탭이 적은 초안: storage 사건 뒤 이 탭에서 그 채팅을 열면 그 초안이 칸에 와요', async () => {
    store.clear();
    const C = await tab('A', '채팅다');   // 같은 캐릭터를 연 다른 탭 — 먼저 열려 초안 표를 읽어 둠(비어 있음)
    const A = await tab('A', '채팅가');
    A.type('A 의 글'); A.flush();
    broadcast();
    C.open('채팅가');
    assert.equal(C.box.value, 'A 의 글');
});
await test('보내고 비우기(빈 글)는 그 채팅 칸만 지워요', async () => {
    store.clear();
    const A = await tab('A', '채팅가');
    const B = await tab('B', '채팅나');
    A.type('A 의 글'); A.flush();
    B.type('B 의 글'); B.flush();
    A.type(''); await new Promise(r => setTimeout(r, 450));
    assert.deepEqual(Object.values(read()), ['B 의 글']);
});
await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/draft-two-tabs.mjs .'));
});
console.log(`draft-two-tabs: ${pass} passed`);
process.exit(0);
