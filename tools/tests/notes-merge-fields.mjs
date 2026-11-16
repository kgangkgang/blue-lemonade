// 메모 기기 간 합치기(src/addons/notes/sync.js mergeNotes · mergeNotePair) — 칸별로 늦은 쪽.
//   내용(제목 · 본문 · 색)은 updated 가 늦은 쪽, 귀속 · 폴더는 metaUpdated 가 늦은 쪽을 따로 골라요.
//   1.5.8 까지: 둘 중 늦은 시각 하나로 메모를 통째로 골라, 한 기기에서 귀속 · 폴더만 바꿔도(채팅 이름 바꾸기 · 폴더 정리 포함)
//   다른 기기가 그 전에 고친 본문이 옛 본문으로 덮였고, 그 기기가 다음에 합칠 때 새 본문이 두 기기 모두에서 사라졌어요.
//   두 탭 흉내: 서버 하나를 두 탭이 번갈아 통째로 저장해요(실리태번 saveSettings 와 같은 덮어쓰기). 탭은 저장 전에 합쳐요(pull).
//   node tools/tests/notes-merge-fields.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const N = await import(pathToFileURL(path.join(root, 'src/addons/notes/sync.js')).href);
let passed = 0, failed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  PASS ', name); } catch (error) { failed++; console.log('  FAIL ', name, '\n', error); } };
const clone = v => JSON.parse(JSON.stringify(v));
const NOW = 1_000_000;
const note = (id, body, updated, extra = {}) => ({ id, title: 'T' + id, body, updated, color: '', ink: '', ...extra });
const owner = chat => ({ avatar: 'a.png', name: 'A', chat, key: `a.png/${chat}` });
function world(notes, extra = {}) {
    const server = { 'bl-notes': { notes: clone(notes), folders: [], gone: {}, ...clone(extra) } };
    const tab = () => {
        const ext = clone(server);
        return { store: ext['bl-notes'], get: id => ext['bl-notes'].notes.find(n => n.id === id),
            pull(now = NOW) { return N.mergeNotes(ext['bl-notes'], clone(server['bl-notes']), now); },
            save() { server['bl-notes'] = clone(ext['bl-notes']); },
            sync(now = NOW) { const out = this.pull(now); this.save(); return out; } };
    };
    return { server, tab, onServer: id => server['bl-notes'].notes.find(n => n.id === id) };
}
/** 두 탭이 서로 한 번씩 더 합친 뒤(수렴) 같은 값인지 */
const settle = (w, a, b) => { a.sync(); b.sync(); a.sync(); b.sync(); assert.deepEqual(a.store.notes, b.store.notes, '두 기기가 같은 값으로 모여요'); assert.deepEqual(w.server['bl-notes'].notes, a.store.notes); };

t('폰이 본문을 고친 뒤 PC 가 귀속만 바꿔도 폰의 본문이 남아요 (고치기 전: 옛 본문으로 덮임)', () => {
    const w = world([note('n', '옛 본문', 100)]);
    const phone = w.tab(), pc = w.tab();
    phone.get('n').body = '폰이 고친 본문'; phone.get('n').updated = 200; phone.save();
    pc.get('n').owner = owner('c1'); pc.get('n').metaUpdated = 300;        // PC 는 아직 합치기 전(탭이 계속 보였음)
    pc.save();                                                               // PC 의 통째 저장이 서버 본문을 옛것으로 덮음 — 여기까지는 막을 수 없어요
    assert.equal(w.onServer('n').body, '옛 본문');
    const out = phone.pull();                                                // 폰이 돌아와 합침
    assert.equal(phone.get('n').body, '폰이 고친 본문', '폰의 새 본문이 살아 있어요');
    assert.deepEqual(phone.get('n').owner, owner('c1'), 'PC 가 바꾼 귀속도 받아요');
    assert.equal(out.needSave, true, '서버에 새 본문을 다시 올려요'); assert.equal(out.pulled, 1);
    phone.save();
    settle(w, phone, pc);
    assert.equal(pc.get('n').body, '폰이 고친 본문'); assert.deepEqual(pc.get('n').owner, owner('c1'));
});

t('반대 차례: PC 가 폴더를 묶은 뒤 폰이 본문을 고쳐도 둘 다 남아요', () => {
    const w = world([note('n', '옛', 100), note('m', 'm', 100)], { folders: [] });
    const phone = w.tab(), pc = w.tab();
    pc.store.folders.push({ id: 'f1', name: '묶음', updated: 150 });
    for (const id of ['n', 'm']) { pc.get(id).folder = 'f1'; pc.get(id).metaUpdated = 150; }
    pc.save();
    phone.get('n').body = '폰 본문'; phone.get('n').updated = 400;
    phone.sync();
    assert.equal(phone.get('n').folder, 'f1'); assert.equal(phone.get('n').body, '폰 본문');
    assert.ok(phone.store.folders.some(f => f.id === 'f1'), '쓰는 폴더는 이름째 가져와요');
    settle(w, phone, pc);
    assert.equal(pc.get('n').body, '폰 본문'); assert.equal(pc.get('n').folder, 'f1');
});

t('양쪽이 본문을 고치면 늦게 고친 쪽 · 양쪽이 귀속을 바꾸면 늦게 바꾼 쪽 — 서로 섞이지 않아요', () => {
    const w = world([note('n', '옛', 100, { owner: owner('c0'), metaUpdated: 50 })]);
    const phone = w.tab(), pc = w.tab();
    phone.get('n').body = '폰(늦음)'; phone.get('n').updated = 500; phone.get('n').owner = owner('폰'); phone.get('n').metaUpdated = 200;
    pc.get('n').body = 'PC(이름)'; pc.get('n').updated = 300; pc.get('n').owner = owner('PC'); pc.get('n').metaUpdated = 600;
    phone.save(); pc.sync();
    assert.equal(pc.get('n').body, '폰(늦음)'); assert.deepEqual(pc.get('n').owner, owner('PC'));
    assert.equal(pc.get('n').updated, 500); assert.equal(pc.get('n').metaUpdated, 600);
    settle(w, phone, pc);
});

t('귀속을 푼 것(전체 메모로) · 폴더에서 뺀 것도 늦게 바꾼 쪽을 따라가요', () => {
    const w = world([note('n', 'b', 100, { owner: owner('c0'), folder: 'f1', metaUpdated: 50 }), note('m', 'b', 100, { folder: 'f1' })], { folders: [{ id: 'f1', name: 'F', updated: 10 }] });
    const phone = w.tab(), pc = w.tab();
    delete pc.get('n').owner; delete pc.get('n').folder; pc.get('n').metaUpdated = 300; pc.save();
    phone.get('n').title = '폰 제목'; phone.get('n').updated = 250;
    phone.sync();
    assert.ok(!('owner' in phone.get('n')) && !('folder' in phone.get('n')), '풀린 귀속 · 폴더');
    assert.equal(phone.get('n').title, '폰 제목');
    settle(w, phone, pc);
});

t('옛 판이 남긴 메모(metaUpdated 없음): 귀속은 내용이 늦은 쪽 것을 따라가요 — 옛 동작 그대로', () => {
    const w = world([note('n', '옛', 100)]);
    const phone = w.tab(), pc = w.tab();
    pc.get('n').owner = owner('c1'); pc.get('n').updated = 300; pc.save();     // 1.5.8 까지의 setOwner 는 updated 를 올렸어요
    const out = phone.pull();
    assert.deepEqual(phone.get('n').owner, owner('c1')); assert.equal(out.pulled, 1); assert.equal(out.needSave, false);
    settle(w, phone, pc);
});

t('지움: 한 기기가 지운 메모는 다른 기기가 그 전에 귀속만 바꿨어도 되살아나지 않아요 · 지운 뒤 고친 것은 살아요', () => {
    const w = world([note('n', 'b', 100), note('k', 'b', 100)]);
    const phone = w.tab(), pc = w.tab();
    pc.get('n').owner = owner('c1'); pc.get('n').metaUpdated = 200; pc.get('k').owner = owner('c1'); pc.get('k').metaUpdated = 200;
    phone.store.notes = phone.store.notes.filter(n => n.id !== 'n'); N.noteGone(phone.store, 'n', 300);
    phone.store.notes = phone.store.notes.filter(n => n.id !== 'k'); N.noteGone(phone.store, 'k', 300);
    phone.save();
    pc.get('k').body = '지운 뒤 PC 가 고침'; pc.get('k').updated = 400;
    const out = pc.sync();
    assert.equal(pc.get('n'), undefined, '지운 것은 빠져요'); assert.equal(out.removed, 1);
    assert.equal(pc.get('k')?.body, '지운 뒤 PC 가 고침', '지운 뒤에 고친 것은 살려요');
    phone.sync();
    assert.equal(phone.get('n'), undefined); assert.equal(phone.get('k')?.body, '지운 뒤 PC 가 고침', '폰에 되살아나요');
    settle(w, phone, pc);
});

t('되살림: 지웠다가 되살린(updated 를 올린) 메모는 다른 기기의 옛 귀속 변경과 합쳐져 살아요', () => {
    const w = world([note('n', '본문', 100)]);
    const phone = w.tab(), pc = w.tab();
    phone.store.notes = []; N.noteGone(phone.store, 'n', 200);
    phone.store.notes.push(note('n', '본문', 300)); phone.save();              // 되돌리기 — 같은 id · 새 시각
    pc.get('n').owner = owner('c1'); pc.get('n').metaUpdated = 250;
    pc.sync();
    assert.equal(pc.get('n').body, '본문'); assert.deepEqual(pc.get('n').owner, owner('c1'));
    assert.ok(!('n' in pc.store.gone), '살아난 메모의 지운 기록은 걷어요');
    settle(w, phone, pc);
});

t('시계 어긋남: 시계가 한 시간 빠른 기기가 귀속만 바꿔도 다른 기기의 본문 수정은 남아요(귀속만 그 기기 것)', () => {
    const HOUR = 3_600_000;
    const w = world([note('n', '옛', 1000)]);
    const fast = w.tab(), right = w.tab();
    right.get('n').body = '맞는 시계가 고친 본문'; right.get('n').updated = 5000; right.save();
    fast.get('n').owner = owner('빠른'); fast.get('n').metaUpdated = 4000 + HOUR; fast.save();   // 실제로는 본문 수정보다 먼저였지만 시각은 한참 뒤
    right.sync(NOW + HOUR);
    assert.equal(right.get('n').body, '맞는 시계가 고친 본문', '고치기 전: 빠른 시계의 통째 승리로 옛 본문');
    assert.deepEqual(right.get('n').owner, owner('빠른'));
    fast.sync(NOW + HOUR);
    assert.equal(fast.get('n').body, '맞는 시계가 고친 본문');
});

t('시계 어긋남: 느린 기기의 본문 수정은 빠른 기기의 더 이른(시각으로는 늦은) 본문 수정에 져요 — 칸 안에서는 늦은 시각 규칙 그대로(알려진 한계)', () => {
    const w = world([note('n', '옛', 1000)]);
    const fast = w.tab(), slow = w.tab();
    fast.get('n').body = '빠른 시계'; fast.get('n').updated = 9000; fast.save();
    slow.get('n').body = '느린 시계(실제로는 나중)'; slow.get('n').updated = 2000;
    slow.sync();
    assert.equal(slow.get('n').body, '빠른 시계');
});

t('같은 값이면 아무 일도 없어요 · 한쪽만 아는 것이 없으면 저장도 안 해요', () => {
    const w = world([note('n', 'b', 100, { owner: owner('c'), folder: 'f1', metaUpdated: 90 }), note('m', 'b', 100, { folder: 'f1' })], { folders: [{ id: 'f1', name: 'F', updated: 10 }] });
    const a = w.tab();
    const before = clone(a.store.notes);
    const out = a.pull();
    assert.deepEqual(a.store.notes, before); assert.equal(out.pulled, 0); assert.equal(out.removed, 0); assert.equal(out.needSave, false); assert.equal(out.changed, false);
});

t('합쳐도 화면이 잡고 있는 메모 객체는 그대로(제자리에서 고침) · 모양이 깨진 서버 메모는 다듬어서', () => {
    const w = world([note('n', '옛', 100)]);
    const a = w.tab(), held = a.get('n');
    w.server['bl-notes'].notes[0] = { id: 'n', title: 7, body: null, updated: '300', color: 'red', ink: '#ABCDEF', owner: 'x', folder: '' };
    a.pull();
    assert.equal(a.get('n'), held, '같은 객체');
    assert.deepEqual(held, { id: 'n', title: '7', body: '', updated: 300, color: '', ink: '#ABCDEF' });
});

t('새 메모 · 서버가 잃은 메모는 공용 규칙 그대로(가져옴 · 다음 저장이 되돌림)', () => {
    const w = world([note('a', 'A', 100)]);
    const phone = w.tab(), pc = w.tab();
    phone.store.notes.push(note('b', '폰 메모', 200)); phone.save();
    pc.store.notes.push(note('c', 'PC 메모', 210));
    const out = pc.sync();
    assert.equal(out.pulled, 1); assert.equal(out.needSave, true);
    assert.deepEqual(pc.store.notes.map(n => n.id).sort(), ['a', 'b', 'c']);
    settle(w, phone, pc);
});

t('mergeNotePair: 순수 — 두 입력을 바꾸지 않고, 내용 · 귀속을 따로 골라요', () => {
    const mine = note('n', '내 본문', 500, { owner: owner('mine'), metaUpdated: 100 }), theirs = note('n', '남 본문', 300, { owner: owner('theirs'), folder: 'f', metaUpdated: 400, color: '#112233' });
    const a = clone(mine), b = clone(theirs);
    const next = N.mergeNotePair(mine, theirs);
    assert.deepEqual(mine, a); assert.deepEqual(theirs, b);
    assert.deepEqual(next, { id: 'n', title: 'Tn', body: '내 본문', updated: 500, color: '', ink: '', owner: owner('theirs'), folder: 'f', metaUpdated: 400 });
    assert.notEqual(next.owner, theirs.owner, '귀속은 사본');
});

t('귀속 바꾸기(index.js setOwner)는 metaUpdated 만 올려요 — updated 를 올리면 「내용을 늦게 고친 쪽」으로 읽혀요', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/notes/index.js'), 'utf8');
    const body = src.slice(src.indexOf('function setOwner(id, owner) {'), src.indexOf('let bindDialog = null;'));
    assert.ok(body.includes('touchMeta(note); save(); rerenderAll();'));
    assert.ok(!body.includes('note.updated = Date.now()'));
});

console.log(`notes-merge-fields: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
