// 7.0.2 버그 사냥 2차 — 테마 애드온 확인 항목 (메모 · TTS · 번역 · 캐릭터 에셋 · 한글화 패널 · 다시 쓰기 · 전개 지시 · 북마크 · 테마 창).
//   기기 간 합치기(귀속 · 폴더 시각 · 금지 묘사 · 저장한 지시 · 발음 사전) · 캐릭터 이름 바꾸기(용어집 · 에셋 폴더 · 목소리) · 원본 백업 처음 원본 ·
//   되돌리기(그림 자리 · 생각 블록) · 폰 손잡이 피하기 · 칩 줄 스와이프 · 서랍 닫힘 · 뒤로 가기 · 북마크 저장 본문 차례 · 미리보기 · 스와이프 지우기 · 비 세 단계.
//   인물 · 자료 이름은 지어낸 것. 네트워크 없음.  node tools/tests/bughunt2-addons.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const src = path.join(theme, 'src');
const read = (rel) => fs.readFileSync(path.join(theme, rel), 'utf8');
const js = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const T = globalThis.__bughunt2Test = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '미나', characters: [] } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const memory = new Map();
globalThis.localStorage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
globalThis.window = { toastr: { info() {}, warning() {}, success() {}, error() {} } };
const G = 'const T = globalThis.__bughunt2Test;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, makeFirst() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}
export const main_api = 'openai';
export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'popup.js': js(`export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup() { return null; }
export function fixToastrForDialogs() {}`),
    'utils.js': js(`export function getStringHash(s) { let h = 0; for (const c of String(s ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function splitRecursive(t) { return [String(t ?? '')]; }`),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {}, ROOT = '';
export async function initialize(d) { S = d.st; ROOT = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.startsWith(ROOT)) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) {
            const target = new URL(spec, parent).href;
            if (!target.startsWith(ROOT)) return { url: S[base], shortCircuit: true };
        }
    }
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(src).href } });

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const mod = (rel) => import(pathToFileURL(path.join(src, rel)).href);
const NOW = 1_800_000_000_000;

await test('합치기 시각: mergeById stamp 선택값 — 기본은 updated 그대로, 메모는 귀속 · 폴더 시각(metaUpdated)도 늦은 쪽', async () => {
    const M = await mod('settings-merge.js');
    const local = [{ id: 'a', updated: 10, v: 'mine' }];
    M.mergeById({ local, remote: [{ id: 'a', updated: 20, v: 'theirs' }], now: NOW });
    assert.equal(local[0].v, 'theirs');
    const S = await mod('addons/notes/sync.js');
    // 폰에서 채팅 이름을 바꿈(내용 시각 그대로 · metaUpdated 만 늦음) → PC 의 옛 탭이 그 귀속을 받는다
    const pc = { notes: [{ id: 'n1', title: '지어낸 메모', body: '', updated: 100, owner: { chat: '옛 채팅', key: 'Mina.png/옛 채팅', avatar: 'Mina.png' } }], folders: [], gone: {} };
    const phone = { notes: [{ id: 'n1', title: '지어낸 메모', body: '', updated: 100, metaUpdated: 200, owner: { chat: '1부', key: 'Mina.png/1부', avatar: 'Mina.png' } }], folders: [] };
    const out = S.mergeNotes(pc, phone, NOW);
    assert.equal(pc.notes[0].owner.chat, '1부', JSON.stringify(out));
    assert.equal(pc.notes[0].updated, 100, '「고친 시각」 정렬 값은 그대로');
    // 폴더 이름: 늦게 고친 쪽
    const a = { notes: [{ id: 'x', updated: 1, folder: 'f1' }, { id: 'y', updated: 1, folder: 'f1' }], folders: [{ id: 'f1', name: '옛 이름', updated: 5 }], gone: {} };
    S.mergeNotes(a, { notes: a.notes.map(n => ({ ...n })), folders: [{ id: 'f1', name: '새 이름', updated: 9 }] }, NOW);
    assert.equal(a.folders[0].name, '새 이름');
    const b = { notes: [], folders: [{ id: 'f2', name: '내 것', updated: 9 }], gone: {} };
    const r = S.mergeNotes(b, { notes: [], folders: [{ id: 'f2', name: '옛 것', updated: 3 }] }, NOW);
    assert.equal(b.folders[0].name, '내 것'); assert.equal(r.needSave, true);
});

await test('메모: 귀속 · 폴더를 바꾸는 자리마다 metaUpdated · 폴더 이름 updated · 칩 줄 스와이프 막기 · 2열 카드 손가락 32px', () => {
    const s = read('src/addons/notes/index.js');
    for (const spot of ['onChatRenamed', 'onCharacterRenamed', 'releaseNotes', 'joinFolder', 'leaveFolder', 'breakFolder', 'tidyFolders']) {
        const body = s.slice(s.indexOf(`function ${spot}(`), s.indexOf(`function ${spot}(`) + 1400);
        assert.match(body, /touchMeta\(/, spot);
    }
    assert.equal((s.match(/f\.updated = Date\.now\(\)/g) || []).length, 2, '폴더 이름 두 자리');
    assert.match(s, /bar\.dataset\.swipeThreshold = '100000';\n\s+for \(const type of \['touchstart', 'touchmove', 'touchend', 'touchcancel'\]\) bar\.addEventListener\(type, event => event\.stopPropagation\(\), \{ passive: true \}\);/);
    assert.match(read('src/addons/notes/sync.js'), /stamp: noteStamp/);
    const css = read('src/addons/notes/style.css');
    assert.match(css, /@container \(max-width: 280px\) \{\n  @media \(pointer: coarse\) \{\n    \.bl-note-tools \{ flex-wrap: wrap !important; gap: 4px !important; \}\n    \.bl-note-tools \.bl-note-btn \{ min-width: 32px !important; height: 32px !important; \}/);
});

await test('애드온 합치기(list-sync): 목록은 id · 지운 기록, 글 칸은 칸마다 고친 시각 — 다른 기기의 옛 탭이 되돌리지 못함', async () => {
    const L = await mod('addons/list-sync.js');
    const mine = { rules: [{ id: 'r1', name: '안경', updated: 5 }], exceptions: [], rulesGone: {} };
    const server = { rules: [{ id: 'r1', name: '안경', updated: 5 }, { id: 'r2', name: '폰에서 더함', updated: 7 }], exceptions: [{ id: 'e1', names: '미나', updated: 4 }] };
    let out = L.mergeLists(mine, server, [{ field: 'rules', gone: 'rulesGone' }, { field: 'exceptions', gone: 'exceptionsGone' }], NOW);
    assert.deepEqual(mine.rules.map(r => r.id), ['r1', 'r2']);
    assert.equal(mine.exceptions.length, 1); assert.equal(out.pulled, 2);
    // 이 탭에서 지운 것은 서버의 옛 목록이 되살리지 못한다
    mine.rules.splice(1, 1); L.listGone(mine, 'rulesGone', 'r2', NOW);
    out = L.mergeLists(mine, server, [{ field: 'rules', gone: 'rulesGone' }], NOW + 1);
    assert.deepEqual(mine.rules.map(r => r.id), ['r1']); assert.equal(out.needSave, true);
    // 전개 지시: 저장 시각(at)이 고친 시각
    const dir = { presets: [] };
    L.mergeLists(dir, { presets: [{ id: 'p1', kind: 'direction', content: '지어낸 지시', at: 9 }] }, [{ field: 'presets', gone: 'presetsGone', stamp: x => x?.updated || x?.at }], NOW);
    assert.equal(dir.presets.length, 1);
    // 글 칸
    const tts = { pron_dict: 'A=에이', mute_words: '', field_stamps: { pron_dict: 10 } };
    const t1 = L.mergeTextFields(tts, { pron_dict: 'A=에이\nB=비', mute_words: '지어낸말', field_stamps: { pron_dict: 20, mute_words: 15 } }, ['pron_dict', 'mute_words'], 'field_stamps');
    assert.equal(tts.pron_dict, 'A=에이\nB=비'); assert.equal(tts.mute_words, '지어낸말'); assert.equal(t1.pulled, 2);
    const t2 = L.mergeTextFields(tts, { pron_dict: '옛것', field_stamps: { pron_dict: 3 } }, ['pron_dict'], 'field_stamps');
    assert.equal(tts.pron_dict, 'A=에이\nB=비'); assert.equal(t2.needSave, true);
    L.stampText(tts, 'field_stamps', 'mute_words', 99); assert.equal(tts.field_stamps.mute_words, 99);
});

await test('합치기 배선: 다시 쓰기(금지 묘사 · 예외 · 지운 기록 · 기본값으로) · 전개 지시(지우기) · TTS(발음 사전 · 음소거 칸 시각)', () => {
    const r = read('src/addons/rewrite/index.js');
    assert.match(r, /registerAddonMerge\('rewrite', \{ module: MODULE/);
    assert.match(r, /listGone\(settings, 'rulesGone', rule\.id\)/);
    assert.match(r, /listGone\(settings, 'exceptionsGone', exception\.id\)/);
    const editor = r.slice(r.indexOf('function renderRuleEditor() {'), r.indexOf('function addRule() {'));
    assert.ok(!/saveSettingsDebounced\(\)/.test(editor), '금지 묘사 편집은 모두 touched()');
    assert.ok((r.match(/updated: Date\.now\(\)/g) || []).length >= 4);
    const d = read('src/addons/direction/index.js');
    assert.match(d, /store\.presetsGone\[entry\.id\] = Date\.now\(\);/);
    assert.match(d, /import\('\.\.\/list-sync\.js'\)\.then\(\(\{ registerAddonMerge \}\) => registerAddonMerge\('direction'/);
    const ui = read('src/addons/tts/src/ui.js');
    assert.match(ui, /if \(SYNC_TEXT_FIELDS\.includes\(path\)\) \{[^\n]*s\.field_stamps\[path\] = Date\.now\(\); save\(\); \}/);
    assert.match(read('src/addons/tts/index.js'), /registerAddonMerge\('tts', \{ module: 'lemon_voice'/);
    assert.match(read('src/addons/tts/src/settings.js'), /SYNC_TEXT_FIELDS = Object\.freeze\(\['pron_dict', 'mute_words'\]\)/);
});

await test('한글화 패널 원본 백업: 두 번째 적용도 처음 원본을 지킴 (봇카드는 필드 단위) · 알림 ↶ 은 이번 적용 전 · 더보기는 처음 원본(둘이면 고름 · 되돌린 뒤 지움)', async () => {
    const B = await mod('addons/prompt/backup.js');
    const first = B.withFirstOriginal(null, B.backupRecord('char', 'Mina.png', '미나', { avatar: 'Mina.png', description: 'EN desc', data: { description: 'EN desc' } }, 100));
    assert.deepEqual(first.first.data.data, { description: 'EN desc' });
    // 두 번째 적용: first_mes 만 — 앞서 적용한 description 은 처음 원본에 그대로
    const second = B.withFirstOriginal(first, B.backupRecord('char', 'Mina.png', '미나', { avatar: 'Mina.png', first_mes: 'EN hello', data: { first_mes: 'EN hello' } }, 200));
    assert.deepEqual(second.first.data.data, { description: 'EN desc', first_mes: 'EN hello' });
    assert.equal(second.first.at, 100);
    // 세 번째: description 을 다시(이미 한국어) — 처음 값은 덮지 않음
    const third = B.withFirstOriginal(second, B.backupRecord('char', 'Mina.png', '미나', { avatar: 'Mina.png', description: '한국어 설명', data: { description: '한국어 설명' } }, 300));
    assert.equal(third.first.data.data.description, 'EN desc');
    assert.equal(B.pickBackup(third, 'last').data.description, '한국어 설명');
    assert.equal(B.pickBackup(third, 'first').data.data.first_mes, 'EN hello');
    assert.equal(B.hasTwoBackups(third), true);
    // 프리셋 · 월드인포: 처음 백업 통째로 유지 (7.0.1 기록은 그 data 를 처음 원본으로)
    const old701 = B.backupRecord('preset', '지어낸 프리셋', '지어낸 프리셋', { prompts: ['EN'] }, 50);
    const p2 = B.withFirstOriginal(old701, B.backupRecord('preset', '지어낸 프리셋', '지어낸 프리셋', { prompts: ['반쯤 KO'] }, 60));
    assert.deepEqual(p2.first.data, { prompts: ['EN'] }); assert.deepEqual(p2.data, { prompts: ['반쯤 KO'] });
    // 다른 자료 기록은 무시
    assert.equal(B.withFirstOriginal(old701, B.backupRecord('preset', '다른 것', '', { x: 1 }, 70)).first.at, 70);
    const s = read('src/addons/prompt/index.js');
    assert.match(s, /const record = withFirstOriginal\(prev, backupRecord\(kind, name, label, data\)\);/);
    assert.match(s, /return pickBackup\(record, 'last'\);/);
    assert.match(s, /if \(done && which === 'first'\) \{ try \{ await fileDelete\(backupFileName\(kind, name\)\); \}/);
});

await test('캐릭터 이름 바꾸기 — 용어집 범위 · 새 이름 제안을 새 아바타로(updated 올림)', async () => {
    const Gs = await mod('addons/translator/glossary-sync.js');
    const set = { glossary_entries: [{ id: 'g1', scope: 'Corvin.png', src: 'Corvin', dst: '코르빈' }, { id: 'g2', scope: 'global', src: 'X', dst: '엑스' }], glossary_suggest: { 'Corvin.png': { items: [] } } };
    const out = Gs.renameGlossaryScope(set, 'Corvin.png', '코르빈.png', NOW);
    assert.deepEqual(out, { moved: 1, suggest: true });
    assert.equal(set.glossary_entries[0].scope, '코르빈.png'); assert.equal(set.glossary_entries[0].updated, NOW);
    assert.equal(set.glossary_entries[1].scope, 'global'); assert.ok(set.glossary_suggest['코르빈.png'] && !set.glossary_suggest['Corvin.png']);
    assert.match(read('src/addons/translator/index.js'), /eventSource\.on\(event_types\.CHARACTER_RENAMED, \(oldAvatar, newAvatar\) => \{\n\s+try \{\n\s+const out = renameGlossaryScope\(extensionSettings/);
});

await test('캐릭터 이름 바꾸기 — 캐릭터 에셋: 설정 열쇠 옮기기 · 그림이 있으면 묻고 옮김(전부 올린 뒤 옛 것 지움) · 그대로 두기 · 실패하면 치움', async () => {
    const R = await mod('addons/assets/rename.js');
    const store = () => ({ presets: { Corvin: [{ id: 'base', name: '' }, { id: 'p1', name: '겨울' }] }, disabled: { Corvin: ['a.png'], 'Corvin/겨울': ['b.png'] },
        links: { Other: [{ owner: 'Corvin', presetId: 'p1' }], Corvin: [] }, optimizedImages: { [JSON.stringify(['Corvin/겨울', 'b.png'])]: 'h' } });
    const s1 = store();
    assert.ok(R.renameFolderKeys(s1, 'Corvin', '코르빈') >= 5);
    assert.ok(s1.presets['코르빈'] && !s1.presets.Corvin); assert.deepEqual(s1.disabled['코르빈/겨울'], ['b.png']);
    assert.equal(s1.links.Other[0].owner, '코르빈'); assert.equal(s1.optimizedImages[JSON.stringify(['코르빈/겨울', 'b.png'])], 'h');
    assert.equal(R.movedKey('Corvina/x', 'Corvin', '코르빈'), null, '이름이 앞만 같은 다른 폴더는 아님');
    // 가짜 서버
    const files = new Map([['Corvin', ['a.png']], ['Corvin/겨울', ['b.png']]]);
    const asset = (folder, file) => ({ folder, file, base: file.replace(/\.[^.]+$/, ''), url: `/fake/${folder}/${file}` });
    const io = (answer, failOn = '') => ({
        fetchAssets: async key => (files.get(key) || []).map(f => asset(key, f)),
        uploadImage: async (key, file) => { if (file.name === failOn) throw new Error('못 올림'); files.set(key, [...(files.get(key) || []), file.name]); },
        deleteAsset: async (key, base) => { files.set(key, (files.get(key) || []).filter(f => !f.startsWith(base + '.'))); },
        fetch: async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) }),
        ask: async () => answer,
    });
    const toasts = [];
    const host = (st) => ({ settings: () => st, saveSettings() { host.saved = (host.saved || 0) + 1; }, reload: async () => {}, toast: (kind, text) => toasts.push([kind, text]) });
    const sKeep = store();
    assert.equal(await R.followCharacterRename('Corvin.png', '코르빈.png', host(sKeep), io(false)), 'kept');
    assert.ok(sKeep.presets.Corvin, '옮기지 않으면 설정도 그대로');
    const sFail = store();
    assert.equal(await R.followCharacterRename('Corvin.png', '코르빈.png', host(sFail), io(true, 'b.png')), 'failed');
    assert.deepEqual(files.get('Corvin'), ['a.png']); assert.deepEqual(files.get('코르빈') || [], [], '올린 사본은 치움');
    const sMove = store();
    assert.equal(await R.followCharacterRename('Corvin.png', '코르빈.png', host(sMove), io(true)), 'moved');
    assert.deepEqual(files.get('코르빈'), ['a.png']); assert.deepEqual(files.get('코르빈/겨울'), ['b.png']);
    assert.deepEqual(files.get('Corvin'), []); assert.ok(sMove.presets['코르빈']);
    // 그림이 없으면 열쇠만
    const sNone = { presets: { Empty: [{ id: 'base', name: '' }] } };
    assert.equal(await R.followCharacterRename('Empty.png', '빈.png', host(sNone), io(true)), 'keys');
    assert.ok(sNone.presets['빈']);
    assert.match(read('src/addons/assets/index.js'), /CHARACTER_RENAMED\) eventSource\.on\(event_types\.CHARACTER_RENAMED, \(oldAvatar, newAvatar\) => \{\n\s+import\('\.\/rename\.js'\)/);
});

await test('캐릭터 이름 바꾸기 — TTS: 카드 색 기억은 새 아바타로, 목소리 연결 · 고정은 새 이름에 복사(옛 이름 유지 · 다른 사람 이름이면 안 함)', async () => {
    const Sp = await mod('addons/tts/src/speakers.js');
    const s = { card_colors: { 'Corvin.png': { '#aa0000': 'Corvin' } }, char_map: { Corvin: 'minimax:v1', 하람: 'minimax:v2' }, prefer_keep: { Corvin: true } };
    assert.equal(Sp.renameCharacterKeys(s, { oldAvatar: 'Corvin.png', newAvatar: '코르빈.png' }).colors, true);
    assert.ok(s.card_colors['코르빈.png'] && !s.card_colors['Corvin.png']);
    assert.equal(Sp.renameCharacterKeys(s, { oldName: 'Corvin', newName: '코르빈', taken: ['하람'] }).voices, 2);
    assert.equal(s.char_map['코르빈'], 'minimax:v1'); assert.equal(s.char_map.Corvin, 'minimax:v1'); assert.equal(s.prefer_keep['코르빈'], true);
    const t = { char_map: { Corvin: 'minimax:v1' } };
    assert.equal(Sp.renameCharacterKeys(t, { oldName: 'Corvin', newName: '하람', taken: ['하람'] }).voices, 0, '새 이름이 다른 사람(페르소나) 이름');
    const u = { char_map: { Corvin: 'minimax:v1', 코르빈: 'minimax:v9' } };
    assert.equal(Sp.renameCharacterKeys(u, { oldName: 'Corvin', newName: '코르빈' }).voices, 0, '새 이름에 이미 연결');
    assert.match(read('src/addons/tts/index.js'), /eventSource\.on\(event_types\.CHARACTER_RENAMED, onCharacterRenamed\)/);
});

await test('TTS: 비 세 단계도 장면 소리 빗소리에 묻힘 · 북마크 미리보기 중엔 누르기 · 칠하기 쉼 · 스와이프 지우기 뒤 같은 글이면 분석 그대로 · 손 편집 대본 번호 맞춤', async () => {
    const P = await mod('addons/tts/src/player.js');
    assert.equal(P.ambientIdOf('daily_rain_light'), 'daily_rain'); assert.equal(P.ambientIdOf('daily_rain_heavy'), 'daily_rain'); assert.equal(P.ambientIdOf('thunder'), 'thunder');
    const C = await mod('addons/tts/src/clickplay.js');
    globalThis.document = { body: { classList: { contains: c => c === 'cg-previewing' } } };
    assert.equal(C.previewing(), true);
    globalThis.document = { body: { classList: { contains: () => false } } };
    assert.equal(C.previewing(), false);
    delete globalThis.document;
    const cp = read('src/addons/tts/src/clickplay.js'), paint = read('src/addons/tts/src/paint.js');
    assert.match(cp, /function onClick\(e\) \{\n\s+try \{\n\s+if \(previewing\(\)\) return;/);
    assert.match(paint, /export function paintMessage\(mesId, el = null\) \{\n\s+if \(previewing\(\)\) return 0;/);
    assert.match(paint, /if \(!enabled\(\) \|\| previewing\(\)\) return;/);
    const an = read('src/addons/tts/src/analysis.js');
    assert.match(an, /const sameSwipe = \(a, mes\) => !Number\.isInteger\(a\?\.swipe\) \|\| a\.swipe === swipeOf\(mes\) \|\| a\.hash === textHash\(mes\);/);
    assert.match(an, /if \(!sameSwipe\(a, mes\)\) return null;/);
    assert.ok(!/a\.hash !== textHash\(mes\) \|\| \(Number\.isInteger\(a\.swipe\)/.test(an), 'italicsOf 번호 검사 풂');
    const Ss = await mod('addons/tts/src/script-store.js');
    // 스와이프 셋에 각자 고친 대본 — 0 번을 지우면 실리태번이 1 · 2 를 0 · 1 로 당긴다
    const texts = ['「첫 글」', '「둘째 글」', '「셋째 글」'];
    const info = texts.map(() => ({ extra: {} }));
    const mes = { mes: texts[2], swipe_id: 2, swipes: [...texts], swipe_info: info, extra: info[2].extra };
    const rows = (text) => [{ id: 'r1', kind: 'voice', text }];
    for (let k = 0; k < 3; k++) info[k].extra.lemon_voice_script = { version: 1, fingerprint: Ss.scriptFingerprint({ mes: texts[k], swipe_id: k, extra: info[k].extra }), rows: rows('편집 ' + k) };
    mes.swipes.splice(0, 1); mes.swipe_info.splice(0, 1); mes.swipe_id = 1;   // 실리태번 스와이프 지우기
    assert.equal(Ss.resolveScript(mes, []), null, '맞추기 전에는 버려졌다');
    assert.equal(Ss.shiftScriptsAfterSwipeDelete(mes, 0), 2);
    assert.equal(Ss.resolveScript(mes, [])?.[0]?.text, '편집 2');
    assert.equal(Ss.resolveScript({ mes: mes.swipes[0], swipe_id: 0, extra: mes.swipe_info[0].extra }, [])?.[0]?.text, '편집 1');
    assert.equal(Ss.shiftScriptsAfterSwipeDelete(mes, 0), 0, '두 번 당기지 않음');
    assert.equal(Ss.resolveScript({ ...mes, swipe_id: 0 }, []), null, '같은 글이라도 다른 번호 스와이프에는 안 씀 (스와이프마다 따로)');
    assert.match(read('src/addons/tts/src/player.js'), /shiftScriptsAfterSwipeDelete\(chat\[id\], Number\(e\?\.swipeId\)\)/);
});

await test('다시 쓰기 ↶: 고친 뒤 그림 자리 줄이 더해지거나 생각 블록이 떨어져도 되돌린다(보이는 글이 같을 때) · 다른 변화는 거절', async () => {
    const U = await mod('addons/rewrite/undo.js');
    const core = await mod('addons/rewrite/core.js');
    const slot = '<span class="bl-asset-slot" data-asset-slot="s1"></span>';
    const msg = { mes: 'A 고친 줄\n\nB', swipe_id: 0, swipes: ['A 고친 줄\n\nB'], extra: {} };
    const undo = U.createRewriteUndo();
    const rec = undo.remember({ chatId: 'c', messageId: 0, message: msg, before: 'A 원래 줄\n\nB', after: 'A 고친 줄\n\nB', beforeSwipe: 'A 원래 줄\n\nB', swipeId: 0 });
    msg.mes = `A 고친 줄\n${slot}\nB`;   // 에셋이 빈 줄 자리에 그림 자리를 넣음
    const rebase = (after, now, before) => core.rebaseSlotLines(after, now, before);
    assert.equal(undo.check(rec, { chatId: 'c', chat: [msg] }), 'changed', 'rebase 없으면 예전처럼');
    assert.equal(undo.check(rec, { chatId: 'c', chat: [msg], rebase }), 'ok');
    assert.equal(rec.before, `A 원래 줄\n${slot}\nB`); assert.equal(rec.beforeSwipe, rec.before);
    undo.restore(rec); assert.equal(msg.mes, `A 원래 줄\n${slot}\nB`);
    const msg2 = { mes: '전혀 다른 글', swipe_id: 0 };
    const rec2 = undo.remember({ chatId: 'c', messageId: 0, message: msg2, before: 'x', after: 'y', swipeId: 0 });
    assert.equal(undo.check(rec2, { chatId: 'c', chat: [msg2], rebase }), 'changed');
    const s = read('src/addons/rewrite/index.js');
    assert.match(s, /rewriteUndo\.check\(rec, \{ chatId: ctx\.getCurrentChatId\?\.\(\) \?\? '', chat: ctx\.chat, rebase: rebaseUndo \}\)/);
    assert.match(s, /const a = dropThinkingHead\(after\), b = dropThinkingHead\(before\);/);
});

await test('다시 쓰기 빠른 금지 칩: 폰은 선택 손잡이 자리(끝 글자 · 한 줄이면 시작 글자 x±18)를 피해 30px 아래 · 손가락 높이 36px', async () => {
    const Q = await mod('addons/rewrite/quick-ban.js');
    const line = { left: 100, right: 160, top: 300, bottom: 320 };
    assert.equal(Q.chipGap({ coarse: false, lines: [line], left: 110, width: 60 }), 8, 'PC 는 그대로');
    assert.equal(Q.chipGap({ coarse: true, lines: [line], left: 110, width: 60 }), 30, '손잡이와 겹침');
    assert.equal(Q.chipGap({ coarse: true, lines: [line], left: 200, width: 60 }), 8, '안 겹침');
    assert.equal(Q.chipGap({ coarse: true, lines: [{ left: 20, right: 300, top: 300, bottom: 320 }, { left: 20, right: 60, top: 330, bottom: 350 }], left: 120, width: 60 }), 8, '여러 줄은 끝 손잡이만');
    assert.match(read('src/addons/rewrite/style.css'), /@media \(pointer: coarse\) \{ \.bwr_quickban \{ min-height: 36px; \} \}/);
});

await test('테마 창: 창 안의 touchstart · mousedown 은 창 밖으로 안 올림(확장 서랍이 닫히지 않게) — 한 번만 건다', async () => {
    const M = await mod('modal.js');
    const listeners = {};
    const dialog = { addEventListener(type, fn, opts) { (listeners[type] ||= []).push({ fn, opts }); }, removeEventListener() {}, showModal() {}, querySelector() { return null; } };
    globalThis.document = { body: { append() {} }, querySelectorAll: () => [] };
    M.showThemeModal(dialog); M.showThemeModal(dialog);
    delete globalThis.document;
    for (const type of ['touchstart', 'mousedown']) {
        assert.equal((listeners[type] || []).length, 1, type);
        let stopped = false;
        listeners[type][0].fn({ stopPropagation() { stopped = true; } });
        assert.ok(stopped, type);
    }
    assert.ok(!listeners.click && !listeners.pointerdown, '바깥 누르기 닫기(click) · 다른 포인터 처리는 그대로');
});

await test('북마크: 다른 채팅 저장 본문이 실리태번 차례 → 「다른 채팅 파일」로 알아봄 · 안드로이드 뒤로 가기(CloseWatcher)', async () => {
    const C = await mod('chat-sync.js');
    const chat = [{ user_name: '하람' }];
    const body = JSON.stringify({ ch_name: '미나', file_name: '미나 - 지어낸 채팅', chat, avatar_url: 'Mina.png', force: false });
    assert.equal(C.saveBodyKey('/api/chats/save', body), 'c|Mina.png|미나 - 지어낸 채팅');
    const old = JSON.stringify({ ch_name: '미나', file_name: '미나 - 지어낸 채팅', avatar_url: 'Mina.png', chat, force: false });
    assert.equal(C.saveBodyKey('/api/chats/save', old), null, '예전 차례는 못 알아봤다');
    const data = read('src/addons/bookmarks/data.js');
    assert.match(data, /postJson\('\/api\/chats\/save', \{ ch_name: owner\.character\.name, file_name: record\.key, chat, avatar_url: owner\.character\.avatar, force: false \}\)/);
    const panel = read('src/addons/bookmarks/panel.js');
    assert.match(panel, /new globalThis\.CloseWatcher\(\)/);
    assert.match(panel, /if \(isSettingsOpen\(\)\) closeSettings\(\);\n\s+else if \(isDrawerOpen\(\)\) closeDrawer\(\);\n\s+else \{ closePanel\(\); return; \}/);
    assert.match(panel, /view\.open = false;\n\s+unwatchBack\(\);/);
});

await test('판 · CI 등록', () => {
    const v = (rel, re) => (read(rel).match(re) || [])[1];
    assert.equal(v('src/addons/notes/version.js', /NOTES_VERSION = '([\d.]+)'/), '1.3.8');
    assert.equal(v('src/addons/translator/manifest.json', /"version": "([\d.]+)"/), '3.1.3');   // 7.5.1 · 8.0.6 프리셋 호환 · 3.1.3 검열되면 대신 쓸 모델 카드
    assert.equal(v('src/addons/assets/state.js', /VERSION = '([\d.]+)'/), '1.7.5');   // 7.0.7
    assert.equal(v('src/addons/prompt/manifest.json', /"version": "([\d.]+)"/), '1.4.0');   // 도구줄 간격을 공통값으로 맞춰요
    assert.equal(v('src/addons/rewrite/index.js', /const VERSION = '([\d.]+)'/), '2.1.9');   // 7.1.5
    assert.equal(v('src/addons/direction/index.js', /const VERSION = '([\d.]+)'/), '1.4.2');   // 7.9.9 테마 고르기 목록을 누를 때 창이 닫히지 않게
    assert.equal(v('src/addons/bookmarks/state.js', /VERSION = '([\d.]+)'/), '1.7.5');   // 7.2.7 그림 원본 비율 · 보기 고르기 · 생각 숨김 · 7.3.1 그림만 격자 읽는 차례
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/bughunt2-addons\.mjs \./);
    assert.equal(fetches, 0);
});

console.log(`bughunt2-addons: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
