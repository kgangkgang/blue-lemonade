// 메시지 통째 번역 캐시의 서명(src/addons/translator/index.js wholeCacheSignature · addTranslationToDB · getTranslationFromDB · adoptWholeSig).
//   1.5.8 까지 열쇠가 원문뿐이라 용어집 · 프롬프트 · 모델을 바꿔도 같은 원문이면 옛 번역이 요청 없이 붙었어요.
//   1.5.9: 줄마다 서명(모델 · 채팅 번역 프롬프트 · 그 원문에 걸리는 용어집 줄). 지금 서명과 다른 줄은 없는 셈(다시 번역).
//     · 옛 줄(서명 없음)은 지우지 않고 처음 읽을 때 지금 서명의 것으로 받아들여요 — 판을 올린 직후 다시 번역이 몰려 나가지 않게.
//     · 손으로 고친 번역은 어느 서명에서나 · 그 원문에 안 나오는 용어를 고쳐도 그대로 · 모델을 오가도 줄을 넷까지 남겨 다시 사지 않게.
//   진짜 함수들을 잘라, 색인까지 흉내 낸 메모리 IndexedDB 위에서 돌려요(요청 0).
//   node tools/tests/translator-whole-cache-sig.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const { shortHash } = await import(pathToFileURL(path.join(dir, 'translation-segments.js')).href);
const { glossaryLines } = await import(pathToFileURL(path.join(dir, 'glossary-match.js')).href);
function cut(name) {
    const start = Math.max(source.indexOf(`\nfunction ${name}(`), source.indexOf(`\nasync function ${name}(`));
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

function fixture() {
    const rows = new Map(); let nextId = 1;
    const request = fill => { const r = {}; queueMicrotask(() => { fill(r); r.onsuccess?.({ target: r }); }); return r; };
    const byText = text => [...rows.values()].filter(row => row.originalText === text).sort((a, b) => a.id - b.id).map(row => ({ ...row }));
    const store = {
        index: () => ({ getAll: text => request(r => { r.result = byText(text); }), getAllKeys: text => request(r => { r.result = byText(text).map(row => row.id); }) }),
        get: id => request(r => { r.result = rows.has(id) ? { ...rows.get(id) } : undefined; }),
        add: row => request(r => { const id = nextId++; rows.set(id, { ...row, id }); r.result = id; }),
        put: row => request(r => { rows.set(row.id, { ...row }); r.result = row.id; }),
        delete: id => { rows.delete(id); },
    };
    const openDB = async () => ({ close() {}, transaction() { const t = { objectStore: () => store }; setTimeout(() => t.oncomplete?.(), 0); return t; } });
    const settings = { connection_mode: 'direct', llm_provider: 'openai', llm_model: 'model-a', llm_prompt_chat: 'Translate to korean:', glossary_enabled: true,
        glossary_entries: [{ id: 'g1', src: 'Mara', dst: '마라' }, { id: 'g2', src: 'Rex', dst: '렉스' }] };
    const meta = {}; let prompt = null;
    const env = {
        extensionSettings: settings, getContext: () => ({ chatMetadata: meta }), chatTermCachePolicy: { blocked: () => false }, hasFailMark: () => false, looksLikeRefusal: () => false, hasSourceEcho: () => false, matchesDisplayCardStructure: () => true,
        openDB, STORE_NAME: 'translations', shortHash, glossaryLines, GLOSSARY_MAX_LINES: 80, activeGlossaryEntries: () => settings.glossary_entries, savedChatPrompt: () => prompt ?? settings.llm_prompt_chat,
        console: { warn() {}, error() {}, log() {} }, Date, Promise, String, Math, Error,
    };
    const names = ['wholeCacheSignature', 'currentWholeSig', 'pickWholeRows', 'findWholeRow', 'addTranslationToDB', 'adoptWholeSig', 'storeTranslationQuietly', 'getTranslationFromDB'];
    const api = new Function('env', `with (env) { const WHOLE_SIG_ANY = '*'; const WHOLE_SIG_ROWS = 4;\n${names.map(cut).join('\n')}\n return { ${names.join(', ')}, WHOLE_SIG_ANY }; }`)(env);
    return { rows, settings, api, setPrompt(p) { prompt = p; },
        legacy(text, translation) { const id = nextId++; rows.set(id, { id, originalText: text, translation, provider: 'x', model: 'old', date: 'd' }); return id; },
        read: async (text, options) => { const out = await api.getTranslationFromDB(text, options); await tick(); return out; },
        translate: async (text, translation) => { await api.storeTranslationQuietly(text, translation); await tick(); },
        of: text => byText(text) };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
const TEXT = 'Mara opened the door.', OTHER = 'The rain kept falling.';

await test('방금 받은 번역은 지금 서명의 줄 · 같은 설정이면 요청 없이 다시 읽어요', async () => {
    const f = fixture();
    await f.translate(TEXT, '마라가 문을 열었다.');
    assert.equal(f.of(TEXT).length, 1); assert.equal(f.of(TEXT)[0].sig, f.api.wholeCacheSignature(TEXT));
    assert.equal(await f.read(TEXT), '마라가 문을 열었다.');
});

await test('그 원문에 나오는 용어를 고치면 옛 번역을 쓰지 않아요 (고치기 전: 그대로 붙음) · 줄은 지우지 않아요', async () => {
    const f = fixture();
    await f.translate(TEXT, '마라가 문을 열었다.');
    f.settings.glossary_entries[0].dst = '마아라';
    assert.equal(await f.read(TEXT), null, '다시 번역하게');
    assert.equal(f.of(TEXT).length, 1, '옛 줄은 남아요(자료를 지우지 않음)');
    await f.translate(TEXT, '마아라가 문을 열었다.');
    assert.equal(await f.read(TEXT), '마아라가 문을 열었다.');
    f.settings.glossary_entries[0].dst = '마라';
    assert.equal(await f.read(TEXT), '마라가 문을 열었다.', '되돌리면 옛 줄이 다시 맞아요(다시 사지 않음)');
});

await test('그 원문에 안 나오는 용어를 고치거나 더해도 캐시는 그대로예요(서명 범위가 그 글에 걸리는 줄뿐)', async () => {
    const f = fixture();
    await f.translate(OTHER, '비가 계속 내렸다.'); await f.translate(TEXT, '마라가 문을 열었다.');
    f.settings.glossary_entries[1].dst = '렉쓰'; f.settings.glossary_entries.push({ id: 'g3', src: 'Nora', dst: '노라' });
    assert.equal(await f.read(OTHER), '비가 계속 내렸다.'); assert.equal(await f.read(TEXT), '마라가 문을 열었다.');
});

await test('모델 · 프롬프트 · 용어집 켬/끔이 바뀌면 빗나가요 · 온도 같은 조절값은 안 봐요', async () => {
    const f = fixture();
    await f.translate(OTHER, '비가 계속 내렸다.');
    f.settings.parameters = { openai: { temperature: 1.3 } };
    assert.equal(await f.read(OTHER), '비가 계속 내렸다.', '조절값은 서명 밖');
    f.settings.llm_model = 'model-b'; assert.equal(await f.read(OTHER), null, '모델');
    f.settings.llm_model = 'model-a'; f.setPrompt('Translate into Japanese:'); assert.equal(await f.read(OTHER), null, '골라 둔 프롬프트');
    f.setPrompt(null); f.settings.llm_provider = 'google'; assert.equal(await f.read(OTHER), null, '공급자');
    f.settings.llm_provider = 'openai'; f.settings.glossary_enabled = false; assert.equal(await f.read(OTHER), null, '용어집 끔');
    f.settings.glossary_enabled = true; assert.equal(await f.read(OTHER), '비가 계속 내렸다.');
});

await test('모델을 오가도 줄을 남겨 다시 사지 않아요 · 넷을 넘으면 오래된 줄부터 갈아 써요', async () => {
    const f = fixture();
    for (const m of ['a', 'b', 'c', 'd']) { f.settings.llm_model = 'model-' + m; await f.translate(OTHER, '번역 ' + m); }
    assert.equal(f.of(OTHER).length, 4);
    for (const m of ['a', 'b', 'c', 'd']) { f.settings.llm_model = 'model-' + m; assert.equal(await f.read(OTHER), '번역 ' + m); }
    f.settings.llm_model = 'model-e'; await f.translate(OTHER, '번역 e');
    assert.equal(f.of(OTHER).length, 4, '넷까지');
    assert.deepEqual(f.of(OTHER).map(r => r.translation).sort(), ['번역 b', '번역 c', '번역 d', '번역 e']);
});

await test('이전 길: 옛 줄(서명 없음)은 처음 읽을 때 지금 서명의 것으로 받아들여요 — 판을 올린 직후 요청 0', async () => {
    const f = fixture();
    const id = f.legacy(TEXT, '옛 번역');
    assert.equal(await f.read(TEXT), '옛 번역');
    assert.equal(f.rows.get(id).sig, f.api.wholeCacheSignature(TEXT), '받아들이며 표시');
    assert.equal(f.rows.get(id).translation, '옛 번역'); assert.equal(f.rows.get(id).model, 'old', '글 · 기록은 그대로');
    assert.equal(await f.read(TEXT), '옛 번역', '그 뒤로도 같은 설정이면 그대로');
    f.settings.glossary_entries[0].dst = '마아라';
    assert.equal(await f.read(TEXT), null, '받아들인 뒤 재료가 바뀌면 그때 빗나가요');
    assert.equal(f.rows.get(id).translation, '옛 번역', '옛 줄은 남아요');
});

await test('손으로 고친 번역은 어느 서명에서나 나오고 받아들여도 표시가 바뀌지 않아요 · 다시 번역하면 새 번역이 이겨요', async () => {
    const f = fixture();
    await f.translate(TEXT, '모델 번역');
    await f.api.addTranslationToDB(TEXT, '내가 고친 번역', { sig: f.api.WHOLE_SIG_ANY });
    assert.deepEqual(f.of(TEXT).map(r => [r.translation, r.sig]), [['내가 고친 번역', '*']], '그 원문의 줄은 하나');
    f.settings.llm_model = 'model-z'; f.settings.glossary_entries[0].dst = '마아라';
    assert.equal(await f.read(TEXT), '내가 고친 번역'); assert.equal(f.of(TEXT)[0].sig, '*');
    await f.translate(TEXT, '새로 번역');
    assert.deepEqual(f.of(TEXT).map(r => r.translation), ['새로 번역']);
    assert.equal(await f.read(TEXT), '새로 번역');
});

await test('가져오기: 「이미 있나」는 서명을 안 봐요(겹쳐 넣지 않음) · 가져온 줄은 옛 줄처럼 처음 읽을 때 받아들여요', async () => {
    const f = fixture();
    await f.translate(TEXT, '모델 번역');
    f.settings.llm_model = 'model-b';
    assert.equal(await f.read(TEXT), null);
    assert.equal(await f.read(TEXT, { anySig: true }), '모델 번역', '가져오기는 있는 것으로 봐요');
    assert.equal(await f.api.addTranslationToDB(OTHER, '가져온 번역'), 'add success');
    assert.equal(f.of(OTHER)[0].sig, undefined);
    assert.equal(await f.read(OTHER), '가져온 번역'); assert.ok(f.of(OTHER)[0].sig);
});

await test('옛 중복 줄 정리([1.9.2])는 그대로 — 서명 없는 길은 첫 줄을 고쳐 쓰고 나머지는 지워요', async () => {
    const f = fixture();
    f.legacy(OTHER, '옛 1'); f.legacy(OTHER, '옛 2');
    await f.api.addTranslationToDB(OTHER, '가져온 것');
    assert.deepEqual(f.of(OTHER).map(r => r.translation), ['가져온 것']);
    f.legacy(TEXT, '옛 1'); f.legacy(TEXT, '옛 2');
    await f.translate(TEXT, '새 번역');
    assert.deepEqual(f.of(TEXT).map(r => r.translation), ['새 번역'], '서명 있는 새 번역도 옛 줄들을 하나로');
});

await test('서명을 못 만드는 자리(재료가 던짐)는 예전처럼 서명 없이 읽고 써요', async () => {
    const f = fixture();
    await f.translate(TEXT, '모델 번역');
    f.setPrompt({ toString() { throw new Error('no prompt'); } });   // 서명 재료가 던지게
    assert.equal(f.api.currentWholeSig(TEXT), undefined);
    assert.equal(await f.read(TEXT), '모델 번역');
});

await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-whole-cache-sig.mjs .'));
});
console.log(`translator-whole-cache-sig: ${passed} passed`);
