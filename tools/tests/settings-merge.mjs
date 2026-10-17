// 7.0.1 메모 · 용어집이 다른 기기의 옛 설정 저장에 덮이지 않게 (src/settings-merge.js · src/addons/notes/sync.js · src/addons/translator/glossary-sync.js)
// 두 탭 흉내: 서버(settings.json) 하나를 두 탭이 번갈아 통째로 저장한다 — 실리태번 saveSettings 와 같은 덮어쓰기.
//   더함 → 합침 · 지움 → 안 되살림 · 양쪽 수정 → 늦은 updated · updated 없는 옛 항목 · 그룹 · 멤버 범위 · 캐시 서명 · 숨김 → 보임 한 번 읽기 · 배선
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const load = file => import(pathToFileURL(path.join(root, file)));
let passed = 0, failed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  PASS ', name); } catch (error) { failed++; console.log('  FAIL ', name, '\n', error); } };

const M = await load('src/settings-merge.js');
const N = await load('src/addons/notes/sync.js');
const G = await load('src/addons/translator/glossary-sync.js');
const DAY = 24 * 60 * 60 * 1000;

// ───────── 두 탭 흉내 ─────────
const clone = v => JSON.parse(JSON.stringify(v));
function world(initial) {
    const server = { extension_settings: clone(initial) };
    const tab = () => ({ ext: clone(server.extension_settings), save() { server.extension_settings = clone(this.ext); }, pull(now) {
        const ext = clone(server.extension_settings);
        return { notes: N.mergeNotes(this.ext['bl-notes'], ext['bl-notes'], now), glossary: G.mergeGlossary(this.ext['llm-translator-custom'], ext['llm-translator-custom'], now) };
    } });
    return { server, tab };
}
const note = (id, title, updated, extra = {}) => ({ id, title, body: '', updated, color: '', ink: '', ...extra });
const entry = (id, scope, src, dst, updated) => ({ id, scope, src, dst, ...(updated ? { updated } : {}) });

await t('더함 → 합침: 폰이 더한 메모를 PC 의 오래된 탭이 저장으로 지우지 않는다 (돌아올 때 합친 뒤 저장)', () => {
    const w = world({ 'bl-notes': { notes: [note('a', 'A', 100)] }, 'llm-translator-custom': { glossary_entries: [] } });
    const phone = w.tab(), pc = w.tab();
    phone.ext['bl-notes'].notes.push(note('b', '폰 메모', 200)); phone.save();
    // 합치기 없이 저장하면 사라진다 (지금까지의 문제)
    const stale = w.tab(); stale.ext = clone(pc.ext); stale.save();
    assert.deepEqual(w.server.extension_settings['bl-notes'].notes.map(n => n.id), ['a'], '덮어쓰기는 실제로 일어난다');
    phone.save();
    const out = pc.pull(1000).notes;
    assert.equal(out.pulled, 1); assert.equal(out.removed, 0);
    assert.deepEqual(pc.ext['bl-notes'].notes.map(n => n.id), ['a', 'b'], '서버 차례대로 앞 이웃 뒤에');
    pc.save();
    assert.deepEqual(w.server.extension_settings['bl-notes'].notes.map(n => n.title), ['A', '폰 메모']);
    assert.equal(N.notesMessage(out), '다른 기기의 메모 1개를 가져왔어요.');
});
await t('지움 → 안 되살림: 폰에서 지운 메모를 PC 의 옛 목록이 되살리지 않는다 (서로 반대 방향 모두)', () => {
    const w = world({ 'bl-notes': { notes: [note('a', 'A', 100), note('b', 'B', 100)] } });
    const phone = w.tab(), pc = w.tab();
    phone.ext['bl-notes'].notes.splice(1, 1); N.noteGone(phone.ext['bl-notes'], 'b', 500); phone.save();
    const out = pc.pull(600).notes;
    assert.equal(out.removed, 1); assert.deepEqual(pc.ext['bl-notes'].notes.map(n => n.id), ['a']);
    assert.equal(N.notesMessage(out), '다른 기기에서 지운 메모 1개를 뺐어요.');
    // 이 탭이 지운 것: 서버(옛 목록)에 있어도 안 받아 온다 · 지운 기록을 서버에 올리게 needSave
    const w2 = world({ 'bl-notes': { notes: [note('a', 'A', 100), note('b', 'B', 100)] } });
    const me = w2.tab();
    me.ext['bl-notes'].notes.splice(1, 1); N.noteGone(me.ext['bl-notes'], 'b', 700);
    const mine = me.pull(800).notes;
    assert.equal(mine.pulled, 0); assert.equal(mine.needSave, true); assert.deepEqual(me.ext['bl-notes'].notes.map(n => n.id), ['a']);
});
await t('양쪽 수정 → 늦은 updated 가 이긴다 (같은 객체를 제자리에서 고침 · 서버에 없는 열쇠는 지움)', () => {
    const w = world({ 'bl-notes': { notes: [note('a', '처음', 100, { folder: 'f1' })], folders: [{ id: 'f1', name: '폴더' }] } });
    const phone = w.tab(), pc = w.tab();
    const pcNote = pc.ext['bl-notes'].notes[0];
    Object.assign(pcNote, { title: 'PC 가 먼저', updated: 300 });
    const phoneNote = phone.ext['bl-notes'].notes[0];
    Object.assign(phoneNote, { title: '폰이 나중', updated: 400 }); delete phoneNote.folder; phone.save();
    const out = pc.pull(500).notes;
    assert.equal(out.pulled, 1);
    assert.equal(pc.ext['bl-notes'].notes[0], pcNote, '같은 객체');
    assert.equal(pcNote.title, '폰이 나중'); assert.equal('folder' in pcNote, false);
    // 반대: 이 탭이 더 늦으면 그대로 두고 저장
    Object.assign(pcNote, { title: 'PC 가 제일 나중', updated: 900 });
    const again = pc.pull(950).notes;
    assert.equal(again.pulled, 0); assert.equal(again.needSave, true); assert.equal(pcNote.title, 'PC 가 제일 나중');
});
await t('지운 뒤 고치거나 되살린 것(updated 가 더 늦음)은 살아 있고 지운 기록이 걷힌다', () => {
    const local = [note('a', 'A', 900)], gone = {};
    const out = M.mergeById({ local, remote: [], localGone: gone, remoteGone: { a: 500 }, now: 1000 });
    assert.deepEqual(local.map(n => n.id), ['a']); assert.equal(out.removed, 0); assert.equal('a' in out.gone, false);
    const local2 = [note('a', 'A', 400)];
    const out2 = M.mergeById({ local: local2, remote: [], remoteGone: { a: 500 }, now: 1000 });
    assert.equal(local2.length, 0); assert.equal(out2.removed, 1);
});
await t('updated 없는 옛 항목: 가장 오래된 것 — 새로 고친 쪽이 이기고, 둘 다 없으면 이 탭 것 그대로', () => {
    const local = [{ id: 'x', title: '옛 메모' }];
    M.mergeById({ local, remote: [{ id: 'x', title: '폰에서 고침', updated: 5 }], now: 10 });
    assert.equal(local[0].title, '폰에서 고침');
    const local2 = [{ id: 'y', title: '이 탭' }];
    const out = M.mergeById({ local: local2, remote: [{ id: 'y', title: '서버' }], now: 10 });
    assert.equal(local2[0].title, '이 탭'); assert.equal(out.pulled, 0);
    const local3 = [];
    assert.equal(M.mergeById({ local: local3, remote: [{ id: 'z', src: 'Mina' }], remoteGone: { z: 1 }, now: 10 }).pulled, 0, '옛 항목(0)은 지운 기록에 진다');
});
await t('메모: 서버에서 온 메모를 다듬고, 그 메모가 쓰는 폴더만 함께 가져온다 · 지운 기록은 30일 · 500개', () => {
    const store = { notes: [], folders: [], gone: {} };
    const out = N.mergeNotes(store, { notes: [{ id: 7, title: 1, body: null, updated: '50', color: 'red', folder: 'f2' }, note('q', 'Q', 60)], folders: [{ id: 'f2', name: '폰 폴더' }, { id: 'f3', name: '안 쓰는 폴더' }], gone: { old: 1, recent: 99 * DAY } }, 100 * DAY);
    assert.equal(out.pulled, 2);
    assert.deepEqual(store.notes[0], { id: '7', title: '1', body: '', updated: 50, color: '', ink: '', folder: 'f2' });
    assert.deepEqual(store.folders, [{ id: 'f2', name: '폰 폴더' }]);
    assert.deepEqual(Object.keys(store.gone), ['recent'], '30일 지난 기록은 걷는다');
    const big = {}; for (let i = 0; i < 600; i++) big['n' + i] = 1000 + i;
    assert.equal(Object.keys(M.tidyGone(big, 2000)).length, 500); assert.ok('n599' in M.tidyGone(big, 2000) && !('n0' in M.tidyGone(big, 2000)), '최근 것부터 남긴다');
});
await t('용어집: 그룹 · 멤버 · 전체 범위 모두 같은 규칙 — 더함 · 지움 · 늦은 updated', () => {
    const w = world({ 'llm-translator-custom': { glossary_entries: [entry('g1', 'group:7', 'Mina', '미나'), entry('m1', 'mina.png', 'Rex', '렉스'), entry('w1', 'global', 'Lumen', '루멘')] } });
    const phone = w.tab(), pc = w.tab();
    const pg = phone.ext['llm-translator-custom'];
    pg.glossary_entries.push(entry('g2', 'group:7', 'Corvin', '코르빈', 300));
    pg.glossary_entries.find(e => e.id === 'm1').dst = '렉스 씨'; pg.glossary_entries.find(e => e.id === 'm1').updated = 310;
    pg.glossary_entries.splice(pg.glossary_entries.findIndex(e => e.id === 'w1'), 1); G.glossaryGone(pg, 'w1', 320);
    phone.save();
    const out = pc.pull(400).glossary;
    assert.equal(out.pulled, 2); assert.equal(out.removed, 1);
    const ids = pc.ext['llm-translator-custom'].glossary_entries.map(e => `${e.scope}:${e.src}=${e.dst}`);
    assert.deepEqual(ids.sort(), ['group:7:Corvin=코르빈', 'group:7:Mina=미나', 'mina.png:Rex=렉스 씨']);
    assert.equal(G.glossaryMessage(out), '다른 기기의 용어집 2개를 가져오고 1개를 뺐어요.');
    assert.ok(pc.ext['llm-translator-custom'].glossary_gone.w1 === 320, '지운 기록도 받아 둔다');
});
await t('용어집 캐시 서명: updated 만 다른 것은 같고(옛 2.7.4 서명과 같은 JSON), 실제 낱말이 바뀌면 다르다', () => {
    const old = [entry('a', 'global', 'Mina', '미나'), entry('b', 'c.png', 'Rex', '렉스')];
    const now = [entry('a', 'global', 'Mina', '미나', 123), entry('b', 'c.png', 'Rex', '렉스', 456)];
    assert.equal(JSON.stringify(G.glossarySignature(now)), JSON.stringify(old), '옛 캐시가 그대로 맞는다');
    assert.equal(JSON.stringify(G.glossarySignature(old)), JSON.stringify(old));
    assert.notEqual(JSON.stringify(G.glossarySignature([entry('a', 'global', 'Mina', '미나 씨', 789), now[1]])), JSON.stringify(old));
    assert.equal(G.glossarySignature(undefined), null, '없으면 null (2.7.4 와 같은 ?? null)');
    assert.equal(G.cleanEntry({ id: 1, scope: 'global', src: 'A', dst: 'B', updated: 0 }).updated, undefined, '시각 0 은 적지 않는다');
});

// ───────── 숨김 → 보임: 서버를 한 번만 읽고 등록한 것을 모두 합친다 ─────────
await t('숨김 → 보임(60초 넘게)일 때만 /api/settings/get 한 번 · 등록한 둘이 같은 응답으로 합치고 저장은 한 번', async () => {
    const doc = Object.assign(new EventTarget(), { hidden: false });
    let clock = 1_000_000, gets = 0, saves = 0;
    const serverExt = { 'bl-notes': { notes: [note('a', 'A', 100), note('b', '폰', 200)] }, 'llm-translator-custom': { glossary_entries: [entry('e1', 'global', 'Mina', '미나', 10)] } };
    M._forTest.reset();
    M._forTest.setHost({ doc: () => doc, now: () => clock, headers: () => ({}), fetch: async (url, init) => { gets++; assert.equal(url, '/api/settings/get'); assert.equal(init.method, 'POST'); return { ok: true, json: async () => ({ settings: JSON.stringify({ extension_settings: serverExt }) }) }; } });
    const notesStore = { notes: [note('a', 'A', 100)], folders: [] }, tr = { glossary_entries: [] };
    const seen = [];
    N.registerNotesMerge({ store: () => notesStore, refresh: () => seen.push('refresh'), notify: text => seen.push(text) });
    M.registerSettingsMerge('glossary', ext => G.mergeGlossary(tr, ext['llm-translator-custom']));
    M.startSettingsMerge({ save: () => saves++ }); M.startSettingsMerge({ save: () => saves++ });
    const flip = hidden => { doc.hidden = hidden; doc.dispatchEvent(new Event('visibilitychange')); };
    flip(true); clock += 30_000; flip(false);
    await new Promise(r => setTimeout(r, 10));
    assert.equal(gets, 0, '30초 숨김은 읽지 않는다');
    flip(true); clock += 61_000; flip(false);
    await new Promise(r => setTimeout(r, 10));
    assert.equal(gets, 1);
    assert.deepEqual(notesStore.notes.map(n => n.id), ['a', 'b']); assert.deepEqual(tr.glossary_entries.map(e => e.id), ['e1']);
    assert.deepEqual(seen, ['refresh', '다른 기기의 메모 1개를 가져왔어요.']);
    assert.equal(saves, 0, '서버 ⊇ 이 탭이면 저장하지 않는다');
    // 이 탭에만 있는 것(서버가 잃음)이 있으면 저장 한 번
    notesStore.notes.push(note('c', '이 탭만', 300));
    const run = await M.mergeFromServer('manual');
    assert.equal(run.ok, true); assert.equal(run.saved, true); assert.equal(saves, 1); assert.equal(gets, 2);
    assert.deepEqual(M._forTest.consumers().sort(), ['bl-notes', 'glossary']);
});
await t('서버를 못 읽으면(오류 · 깨진 JSON) 아무것도 안 바꾸고 저장도 안 한다', async () => {
    let saves = 0;
    M._forTest.reset();
    const local = { notes: [note('a', 'A', 1)] };
    N.registerNotesMerge({ store: () => local });
    M.startSettingsMerge({ save: () => saves++ });
    M._forTest.setHost({ fetch: async () => ({ ok: false, status: 500 }) });
    assert.equal((await M.mergeFromServer()).error, 'HTTP 500');
    M._forTest.setHost({ fetch: async () => ({ ok: true, json: async () => ({ settings: '{깨짐' }) }) });
    assert.equal((await M.mergeFromServer()).error, 'no extension_settings');
    assert.equal(saves, 0); assert.deepEqual(local.notes.map(n => n.id), ['a']);
    assert.equal(M.serverExtensionSettings({ settings: { extension_settings: { x: 1 } } }).x, 1, '이미 객체여도 읽는다');
    M._forTest.reset();
});

// ───────── 배선 ─────────
await t('배선: 메모 removeNote 가 지운 기록을 남기고 시작할 때 등록 · 번역 upsert/remove/겹침 합치기 · 서명 두 곳 · 프리셋 보존 · CI', () => {
    const notes = fs.readFileSync(path.join(root, 'src/addons/notes/index.js'), 'utf8');
    assert.match(notes, /export function removeNote\(id\) \{[^\n]*list\.splice\(i, 1\); noteGone\(store\(\), id\);/);
    assert.match(notes, /registerNotesMerge\(\{ store,/); assert.match(notes, /startSettingsMerge\(\{ save: saveSettingsDebounced \}\)/);
    const tr = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.equal((tr.match(/glossarySignature\(extensionSettings\.glossary_entries\)/g) || []).length, 2, '캐시 서명 두 곳');
    assert.ok(!/extensionSettings\.glossary_entries \?\? null/.test(tr), '옛 서명 재료가 남지 않음');
    assert.match(tr, /entries\.push\(\{ id: glossaryNewId\(\), scope, src, dst, updated: Date\.now\(\) \}\)/);
    assert.match(tr, /if \(existing\.src !== src \|\| existing\.dst !== dst \|\| existing\.scope !== scope\) existing\.updated = Date\.now\(\);/);
    assert.match(tr, /entries\.splice\(index, 1\); glossaryGone\(extensionSettings, id\);/);
    assert.match(tr, /glossaryGone\(extensionSettings, other\.id\);\n\s*entries\.splice\(j, 1\);/);
    assert.equal((tr.match(/delete settingsSnapshot\[GLOSSARY_GONE\]/g) || []).length, 2, '프리셋에 안 담는다 (두 곳)');
    assert.match(tr, /if \(myGlossaryGone\) extensionSettings\[GLOSSARY_GONE\] = myGlossaryGone;/);
    assert.match(tr, /registerSettingsMerge\('glossary'/);
    const ci = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
    assert.match(ci, /node tools\/tests\/settings-merge\.mjs \./);
});

console.log(`settings-merge: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
