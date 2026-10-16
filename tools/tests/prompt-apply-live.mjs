// 한글화 패널(prompt) 「⚡ 원본 적용」 — 번역 캐시를 실제 프리셋 · 월드인포 · 봇카드에 쓰는 길 (src/addons/prompt/index.js applyPresetLive · applyWorldInfoLive · applyCharacterLive)
//   node tools/tests/prompt-apply-live.mjs <테마 루트>
// index.js 에서 캐시 층 · 번역 읽기 · 프리셋 읽기 · 적용 함수 글을 잘라 vm 에서 돌린다. 번역은 진짜 setCache/setCacheTitle 로 넣고,
// 실리태번 저장 함수(PresetManager.savePreset · saveWorldInfo · /api/characters/merge-attributes)는 받은 것을 적는 가짜. 합성 자료만 쓴다.
// 확인하는 것:
//   1) 로드된 프리셋: 제목 · 본문 적용, 제목만 번역된 항목과 빈 본문 번역은 원문을 지우지 않는다 (2026-10-06 고침),
//      정규식 · 그룹 · JS러너는 이름만 (검색식 · id · 코드는 그대로), ST 저장 형식(getChatCompletionPreset)으로 저장 · 다시 그리기 · 설정 저장
//   2) 제목만 적용: 이름만 바꾸고 본문은 그대로
//   3) 저장된 다른 프리셋: 사본에 적용 · 파일 형식 그대로(temperature 유지, 2026-10-06 고침) · 저장이 끝난 뒤에만 메모리 목록 교체 · 실패하면 그대로
//   4) 옛 실리태번(PresetManager 없음): /api/presets/save · 실패면 목록 그대로 · 번역이 없으면 저장하지 않는다
//   5) 월드인포: 키워드 합치기 · AND_ALL/NOT_ALL 보조 키워드는 바꾸기 · 원래 없던 키워드 줄은 본문으로 · 빈 제목은 그대로 · 고른 항목만 · originalData 거울 · 제목만
//   6) 봇카드: 보낼 것만 (빈 본문 번역 · 고르지 않은 칸 제외) · 추가 인사말은 전체 목록에 번역 칸만 · 캐릭터 노트는 depth/role 유지 · 실패면 다시 읽지 않음
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('src/addons/prompt/index.js');
const conn = read('src/addons/prompt/connection.js');
const { forEachLimited } = await import(pathToFileURL(path.join(root, 'src/addons/prompt/cache-loading.js')).href);
const section = (text, start, end) => { const a = text.indexOf(start), b = text.indexOf(end, a + start.length); assert.ok(a >= 0 && b > a, `잘라낼 곳을 못 찾음: ${start}`); return text.slice(a, b); };
const CODE = [
    section(src, "const ST_PROFILE = '__st_profile__';", 'const PROVIDER_LIST'),
    section(src, 'const DEFAULT_PARAMS = {', 'const PARAM_LABELS'),
    `const syncModelMemory = (() => {\n${section(conn, 'const cleanUrl=', 'export function customEndpoint')}\n${section(conn, 'export function syncModelMemory(c) {', '/** 공급자를 바꾼 뒤').replace('export function', 'function')}\nreturn syncModelMemory;\n})();`,
    section(src, 'function cfg() {', 'function getCurrentParams() {'),
    section(src, '// ── Translation Cache Layer', '// A hidden/closing tab'),
    section(src, '// Effective target language string.', '// Stats helper for UI'),
    section(src, 'function listAllPresets() {', '// ── World Info'),
    section(src, "const KEYS_MARKER = '**Keys:**';", '// Compact, display-only metadata'),
    section(src, 'function findCharIndex(avatarOrId) {', 'async function readCharCard('),
    section(src, '// Sanitize filename', '// Trigger browser download'),
    section(src, 'function deepClone(obj) {', '// ── JSON Export: Preset'),
    section(src, '// ── Live Apply: Preset', '// ── Title-only translation (batched)'),
    // 고른 항목은 vm 쪽 Set 으로 (적용 함수가 instanceof Set 으로 가린다)
    'globalThis.__api = { setCache, setCacheTitle, applyPresetLive, applyWorldInfoLive, applyCharacterLive, picked: ids => new Set(ids) };',
].join('\n');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const plain = v => JSON.parse(JSON.stringify(v));   // vm 안에서 만든 배열 · 객체는 원형이 달라 JSON 으로 옮겨 견준다

// ── 합성 자료 ───────────────────────────────────────────────
const samplePreset = () => ({
    preset_settings_openai: 'Sample', temp_openai: 0.7,
    prompts: [
        { identifier: 'main', name: 'Main Prompt', role: 'system', content: 'Write with vivid detail.' },
        { identifier: 'tone', name: 'Tone Guide', content: 'Keep a calm tone.' },
        { identifier: 'blank', name: 'Blank Body', content: 'Original body stays.' },
        { identifier: 'plain', name: 'No Translation', content: 'Never translated.' },
    ],
    prompt_order: [{ character_id: 100001, order: [{ identifier: 'main', enabled: true }, { identifier: 'tone', enabled: true }, { identifier: 'blank', enabled: false }, { identifier: 'plain', enabled: true }] }],
    extensions: {
        regex_scripts: [{ id: 'rx-1', scriptName: 'Hide notes', findRegex: '/<note>[\\s\\S]*?<\\/note>/g', replaceString: '', disabled: false }],
        baibaiToolkit: { presetPromptGroups: [{ id: 'g1', name: 'Group One', collapsed: true, enabled: true }] },
        tavern_helper: { scripts: [{ type: 'folder', id: 'f1', name: 'Folder One', scripts: [{ id: 's1', name: 'Script One', content: 'console.log(1)', enabled: true }] }] },
    },
});
const archivePreset = () => ({ temperature: 0.35, top_p: 0.9, prompts: [{ identifier: 'main', name: 'Main Prompt', content: 'Archive body.' }] });
const atlas = () => ({
    entries: {
        0: { uid: 0, comment: 'Harbor', content: 'A quiet harbor.', key: ['harbor', 'dock'], keysecondary: ['night'], selectiveLogic: 0 },
        1: { uid: 1, comment: 'Tower', content: 'An old tower.', key: ['tower'], keysecondary: ['rain', 'fog'], selectiveLogic: 3 },
        2: { uid: 2, comment: 'Gate', content: 'A wooden gate.', key: [], keysecondary: [] },
        3: { uid: 3, comment: '', content: 'Untitled note.', key: ['note'] },
        4: { uid: 4, comment: 'Field', content: 'Open field.', key: ['field'] },
    },
    originalData: { entries: [] },
});
const hero = () => ({
    name: 'Sample Hero', avatar: 'sample-hero.png', description: 'A brave traveler.', first_mes: 'Hello there.',
    data: { description: 'A brave traveler.', first_mes: 'Hello there.', personality: 'Kind.', alternate_greetings: ['Alt zero.', 'Alt one.', 'Alt two.'],
        extensions: { depth_prompt: { prompt: 'Stay in character.', depth: 4, role: 'system' } } },
});

/** 새 모듈 상태 한 벌 + 가짜 실리태번 */
function boot({ presetManager = true, saveFails = false, fetchStatus = 200 } = {}) {
    const calls = [], editor = new Map();
    const T = { calls, editor, oai: samplePreset(), stored: [archivePreset()], names: { Archive: 0 }, book: atlas(), characters: [hero()], saved: [] };
    const pm = { savePreset: async (name, body, opts) => { calls.push(['savePreset', name, plain(opts)]); T.saved.push(plain(body)); if (saveFails) throw new Error('save failed'); } };
    const ctx = {
        console: { log() {}, warn() {}, error() {} }, btoa, TextEncoder, forEachLimited, EXT: 'prompt-panel',
        setTimeout: () => 0, clearTimeout() {}, toastr: { warning() {}, error() {}, success() {}, info() {} },
        extension_settings: { 'prompt-panel': {} }, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        oai_settings: T.oai, openai_settings: T.stored, openai_setting_names: T.names,
        getChatCompletionPreset: obj => { calls.push(['getChatCompletionPreset']); return { temperature: obj.temp_openai, prompts: obj.prompts, prompt_order: obj.prompt_order, extensions: obj.extensions }; },
        promptManager: { render: arg => calls.push(['render', arg]) },
        saveSettingsDebounced: () => calls.push(['saveSettings']),
        eventSource: { emit: async (type, data) => { calls.push(['emit', type, plain(data ?? null)]); } },
        event_types: { OAI_PRESET_IMPORT_READY: 'oai_preset_import_ready', CHARACTER_EDITED: 'character_edited' },
        characters: T.characters, unshallowCharacter: async idx => calls.push(['unshallow', idx]),
        setWIOriginalDataValue: (_wi, uid, field, value) => calls.push(['mirror', uid, field, plain(value)]),
        PAR: { TavernHelper: { updateScriptTreesWith(fn, opts) {
            const trees = [{ type: 'folder', id: 'f1', name: 'Folder One', scripts: [{ id: 's1', name: 'Script One' }] }];
            calls.push(['tavernHelper', plain(opts), plain(fn(trees))]);
        } } },
        PDOC: { getElementById: id => editor.get(id) || null },
        fetch: async (url, opts) => { calls.push(['fetch', url, JSON.parse(opts.body)]); return { ok: fetchStatus < 300, status: fetchStatus }; },
    };
    ctx.SillyTavern = { getContext: () => ({
        characterId: 0,
        getPresetManager: () => (presetManager ? pm : null),
        loadWorldInfo: async name => { calls.push(['loadWorldInfo', name]); return name === 'Atlas' ? T.book : null; },
        saveWorldInfo: async (name, data, immediately) => { calls.push(['saveWorldInfo', name, immediately]); T.savedBook = plain(data); },
        reloadWorldInfoEditor: name => calls.push(['reloadWorldInfoEditor', name]),
        getOneCharacter: async avatar => calls.push(['getOneCharacter', avatar]),
    }) };
    vm.createContext(ctx);
    vm.runInContext(CODE, ctx);
    T.api = ctx.__api;
    T.called = name => calls.filter(c => c[0] === name);
    return T;
}

function translatePreset(T, ns = 'pt-preset::Sample') {
    T.api.setCache(ns, 'main', '### 메인 지시\n\n생생하게 묘사한다.');
    T.api.setCacheTitle(ns, 'tone', '어조 안내');                   // 제목만 번역
    T.api.setCache(ns, 'blank', '### 빈 본문 제목\n\n   ');         // 옛 판이 남긴 「제목 + 빈 본문」 번역
    T.api.setCacheTitle(ns, '__pp_regex__::rx-1', '메모 숨기기');
    T.api.setCacheTitle(ns, '__grp::g1', '첫 묶음');
    T.api.setCacheTitle(ns, '__ths::f1', '첫 폴더');
    T.api.setCacheTitle(ns, '__ths::s1', '첫 스크립트');
}

await test('로드된 프리셋: 제목 · 본문 적용, 제목만 번역 · 빈 본문 번역은 원문을 지우지 않는다, 정규식 · 그룹 · JS러너는 이름만', async () => {
    const T = boot();
    translatePreset(T);
    const result = plain(await T.api.applyPresetLive('__cur__', false));
    assert.deepEqual(result, { targetName: 'Sample', applied: 8, isCurrent: true, regexRenamed: 1, groupRenamed: 1, runnerRenamed: 2, groupReloadFailed: false, runnerLiveUpdated: true });
    assert.deepEqual(T.oai.prompts.map(p => [p.name, p.content]), [
        ['메인 지시', '생생하게 묘사한다.'], ['어조 안내', 'Keep a calm tone.'], ['빈 본문 제목', 'Original body stays.'], ['No Translation', 'Never translated.'],
    ]);
    assert.equal(T.oai.prompts[0].role, 'system', '다른 칸은 그대로');
    assert.deepEqual(plain(T.oai.extensions.regex_scripts[0]), { id: 'rx-1', scriptName: '메모 숨기기', findRegex: '/<note>[\\s\\S]*?<\\/note>/g', replaceString: '', disabled: false });
    assert.deepEqual(plain(T.oai.extensions.baibaiToolkit.presetPromptGroups[0]), { id: 'g1', name: '첫 묶음', collapsed: true, enabled: true });
    const folder = T.oai.extensions.tavern_helper.scripts[0];
    assert.deepEqual([folder.name, folder.id, folder.scripts[0].name, folder.scripts[0].content], ['첫 폴더', 'f1', '첫 스크립트', 'console.log(1)']);
    assert.equal(T.called('getChatCompletionPreset').length, 1, '로드된 프리셋은 ST 저장 형식으로 바꿔 저장');
    assert.deepEqual(T.called('savePreset'), [['savePreset', 'Sample', { skipUpdate: false }]]);
    assert.equal(T.saved[0].temperature, 0.7);
    assert.equal(T.saved[0].prompts[0].content, '생생하게 묘사한다.');
    assert.deepEqual(T.called('emit'), [['emit', 'oai_preset_import_ready', { presetName: 'Sample' }]], '그룹 캐시만 다시 읽게 (data 없이)');
    assert.deepEqual(T.called('tavernHelper')[0].slice(1), [{ type: 'preset' }, [{ type: 'folder', id: 'f1', name: '첫 폴더', scripts: [{ id: 's1', name: '첫 스크립트' }] }]]);
    assert.deepEqual(T.called('render'), [['render', false]]);
    assert.equal(T.called('saveSettings').length, 1, '정규식 이름을 바꿨으면 settings.json 에도');
});

await test('제목만 적용: 이름만 바꾸고 본문은 원문 그대로 (나중에 원문으로 다시 맞출 수 있게)', async () => {
    const T = boot();
    translatePreset(T);
    const result = await T.api.applyPresetLive('Sample', true);
    assert.equal(result.applied, 7);
    assert.deepEqual(T.oai.prompts.map(p => [p.name, p.content]), [
        ['메인 지시', 'Write with vivid detail.'], ['어조 안내', 'Keep a calm tone.'], ['빈 본문 제목', 'Original body stays.'], ['No Translation', 'Never translated.'],
    ]);
});

await test('저장된 다른 프리셋: 사본에 적용해 파일 형식 그대로 저장(temperature 유지) · 저장이 끝난 뒤에만 메모리 목록을 바꾼다', async () => {
    const T = boot();
    T.api.setCache('pt-preset::Archive', 'main', '### 보관 메인\n\n보관 본문.');
    const before = T.stored[0];
    const result = await T.api.applyPresetLive('Archive', false);
    assert.equal(result.isCurrent, false);
    assert.equal(T.called('getChatCompletionPreset').length, 0, '이미 파일 형식인 프리셋은 그대로 보낸다');
    assert.deepEqual(T.called('savePreset'), [['savePreset', 'Archive', { skipUpdate: true }]], '다른 프리셋을 고르게 되지 않게 목록 새로고침은 건너뛴다');
    assert.deepEqual(T.saved[0], { temperature: 0.35, top_p: 0.9, prompts: [{ identifier: 'main', name: '보관 메인', content: '보관 본문.' }] });
    assert.notEqual(T.stored[0], before, '메모리 목록은 저장한 본으로 바꾼다');
    assert.deepEqual(plain(T.stored[0]), T.saved[0]);
    assert.deepEqual(before.prompts[0], { identifier: 'main', name: 'Main Prompt', content: 'Archive body.' }, '원래 객체는 건드리지 않는다');
    assert.equal(T.oai.prompts[0].name, 'Main Prompt', '로드된 프리셋은 그대로');
    assert.equal(T.called('render').length + T.called('saveSettings').length + T.called('emit').length, 0);
});

await test('저장된 다른 프리셋: 저장이 실패하면 메모리 목록 · 원래 객체 모두 그대로', async () => {
    const T = boot({ saveFails: true });
    T.api.setCache('pt-preset::Archive', 'main', '### 보관 메인\n\n보관 본문.');
    const before = T.stored[0];
    await assert.rejects(T.api.applyPresetLive('Archive', false), /save failed/);
    assert.equal(T.stored[0], before);
    assert.deepEqual(before, archivePreset());
});

await test('옛 실리태번(PresetManager 없음): /api/presets/save 로 저장 · 실패하면 목록 그대로 · 번역이 없으면 아무것도 저장하지 않는다', async () => {
    const T = boot({ presetManager: false });
    T.api.setCache('pt-preset::Archive', 'main', '### 보관 메인\n\n보관 본문.');
    await T.api.applyPresetLive('Archive', false);
    const [, url, body] = T.called('fetch')[0];
    assert.equal(url, '/api/presets/save');
    assert.deepEqual(body, { apiId: 'openai', name: 'Archive', preset: { temperature: 0.35, top_p: 0.9, prompts: [{ identifier: 'main', name: '보관 메인', content: '보관 본문.' }] } });
    assert.equal(T.stored[0].prompts[0].name, '보관 메인');
    const bad = boot({ presetManager: false, fetchStatus: 500 });
    bad.api.setCache('pt-preset::Archive', 'main', '### 보관 메인\n\n보관 본문.');
    const before = bad.stored[0];
    await assert.rejects(bad.api.applyPresetLive('Archive', false), /저장 실패 \(HTTP 500\)/);
    assert.equal(bad.stored[0], before);
    const empty = boot();
    await assert.rejects(empty.api.applyPresetLive('Archive', false), /적용할 번역이 없습니다/);
    await assert.rejects(empty.api.applyPresetLive('Sample', true), /적용할 제목 번역이 없습니다/);
    assert.equal(empty.called('savePreset').length, 0);
});

function translateAtlas(T) {
    const ns = 'pt-wi::Atlas';
    T.api.setCache(ns, 'Atlas::0', '### 항구\n\n**Keys:** 항구, harbor\n**Filters:** 밤\n\n조용한 항구.');
    T.api.setCache(ns, 'Atlas::1', '### 탑\n\n**Keys:** 탑\n**Filters:** 비, 안개\n\n오래된 탑.');
    T.api.setCache(ns, 'Atlas::2', '### 문\n\n**Keys:** 원래 본문의 첫 줄\n\n나무 문.');
    T.api.setCache(ns, 'Atlas::3', '### 쪽지\n\n제목 없는 쪽지.');
    T.api.setCache(ns, 'Atlas::4', '### 들판\n\n');
}

await test('월드인포: 키워드는 합치고 AND_ALL 보조 키워드는 바꾸고, 원래 없던 키워드 줄은 본문으로 · 빈 제목 · 빈 본문 번역은 원문 유지', async () => {
    const T = boot();
    translateAtlas(T);
    const result = plain(await T.api.applyWorldInfoLive('Atlas', null, false));
    assert.deepEqual(result, { targetName: 'Atlas', applied: 12, entries: 5 });
    const e = plain(T.book.entries);
    assert.deepEqual(e[0], { uid: 0, comment: '항구', content: '조용한 항구.', key: ['harbor', 'dock', '항구'], keysecondary: ['night', '밤'], selectiveLogic: 0 });
    assert.deepEqual(e[1], { uid: 1, comment: '탑', content: '오래된 탑.', key: ['tower', '탑'], keysecondary: ['비', '안개'], selectiveLogic: 3 }, 'AND_ALL 은 합치면 조건이 바뀐다');
    assert.deepEqual(e[2], { uid: 2, comment: '문', content: '**Keys:** 원래 본문의 첫 줄\n\n나무 문.', key: [], keysecondary: [] }, '키워드가 없던 항목의 Keys 줄은 본문');
    assert.deepEqual(e[3], { uid: 3, comment: '', content: '제목 없는 쪽지.', key: ['note'] }, '빈 제목(comment)에는 제목을 넣지 않는다');
    assert.deepEqual(e[4], { uid: 4, comment: '들판', content: 'Open field.', key: ['field'] }, '빈 본문 번역은 원문을 지우지 않는다');
    assert.deepEqual(T.called('saveWorldInfo'), [['saveWorldInfo', 'Atlas', true]], '바로 저장 (실리태번 지연 저장에 맡기지 않음)');
    assert.deepEqual(T.called('reloadWorldInfoEditor'), [['reloadWorldInfoEditor', 'Atlas']]);
    assert.deepEqual(T.called('mirror').filter(c => c[1] === 0).map(c => c.slice(2)), [['comment', '항구'], ['content', '조용한 항구.'], ['keys', ['harbor', 'dock', '항구']], ['secondary_keys', ['night', '밤']]], '캐릭터 책 originalData 거울도 같이');
});

await test('월드인포: 고른 항목만 바꾸고 나머지는 그대로 (지우지 않음) · 제목만이면 키워드 · 본문 · 거울 본문은 그대로', async () => {
    const T = boot();
    translateAtlas(T);
    await T.api.applyWorldInfoLive('Atlas', T.api.picked(['Atlas::1']), false);
    const e = plain(T.book.entries);
    assert.equal(Object.keys(e).length, 5);
    assert.equal(e[1].content, '오래된 탑.');
    assert.deepEqual(e[0], plain(atlas().entries[0]));
    assert.deepEqual(e[4], plain(atlas().entries[4]));
    const titles = boot();
    translateAtlas(titles);
    await titles.api.applyWorldInfoLive('Atlas', null, true);
    const t = plain(titles.book.entries);
    assert.deepEqual(t[0], { ...plain(atlas().entries[0]), comment: '항구' });
    assert.deepEqual(t[2], { ...plain(atlas().entries[2]), comment: '문' });
    assert.deepEqual([...new Set(titles.called('mirror').map(c => c[2]))], ['comment']);
    const none = boot();
    translateAtlas(none);
    await assert.rejects(none.api.applyWorldInfoLive('Atlas', none.api.picked(['Atlas::9']), false), /적용할 번역이 없습니다/);
    assert.equal(none.called('saveWorldInfo').length, 0);
});

function translateHero(T) {
    const ns = 'pt-char::sample-hero.png';
    T.api.setCache(ns, 'description', '### 설명\n\n용감한 여행자.');
    T.api.setCache(ns, 'first_mes', '### 첫 메시지\n\n');                // 빈 본문 번역
    T.api.setCache(ns, 'alt_greeting_1', '### 인사\n\n두 번째 인사.');
    T.api.setCache(ns, 'character_note', '### 노트\n\n캐릭터를 지킨다.');
}

await test('봇카드: 번역된 칸만 merge-attributes 로 · 추가 인사말은 전체 목록에 번역 칸만 · 캐릭터 노트는 depth/role 유지 · 열린 편집기도 맞춘다', async () => {
    const T = boot();
    translateHero(T);
    const value = id => { const node = { value: id === 'avatar_url_pole' ? 'sample-hero.png' : 'old' }; T.editor.set(id, node); return node; };
    const [desc, first, depth] = [value('description_textarea'), value('firstmessage_textarea'), value('depth_prompt_prompt')];
    value('avatar_url_pole');
    const result = plain(await T.api.applyCharacterLive('__cur__', null));
    assert.deepEqual(result, { targetName: 'Sample Hero', applied: 3, isCurrent: true });
    const [[, url, body]] = T.called('fetch');
    assert.equal(url, '/api/characters/merge-attributes');
    assert.deepEqual(body, {
        avatar: 'sample-hero.png', description: '용감한 여행자.',
        data: { description: '용감한 여행자.', alternate_greetings: ['Alt zero.', '두 번째 인사.', 'Alt two.'], extensions: { depth_prompt: { prompt: '캐릭터를 지킨다.', depth: 4, role: 'system' } } },
        alternate_greetings: ['Alt zero.', '두 번째 인사.', 'Alt two.'],
    }, '빈 본문 번역(first_mes) · 번역 없는 칸(personality)은 보내지 않는다');
    assert.deepEqual(T.characters[0], hero(), '메모리 카드는 저장 뒤 다시 읽는다 — 직접 고치지 않는다');
    assert.deepEqual(T.called('getOneCharacter'), [['getOneCharacter', 'sample-hero.png']]);
    assert.equal(T.called('emit')[0][1], 'character_edited');
    assert.deepEqual([desc.value, first.value, depth.value], ['용감한 여행자.', 'old', '캐릭터를 지킨다.']);
});

await test('봇카드: 고른 칸만 보내고, 저장이 실패하면 다시 읽지 않으며, 아바타 파일명이 없으면 쓰지 않는다', async () => {
    const T = boot();
    translateHero(T);
    await T.api.applyCharacterLive('sample-hero.png', T.api.picked(['alt_greeting_1', 'first_mes']));
    assert.deepEqual(T.called('fetch')[0][2], { avatar: 'sample-hero.png', data: { alternate_greetings: ['Alt zero.', '두 번째 인사.', 'Alt two.'] }, alternate_greetings: ['Alt zero.', '두 번째 인사.', 'Alt two.'] });
    const bad = boot({ fetchStatus: 500 });
    translateHero(bad);
    await assert.rejects(bad.api.applyCharacterLive('__cur__', null), /저장 실패 \(HTTP 500\)/);
    assert.equal(bad.called('getOneCharacter').length, 0);
    const nameless = boot();
    translateHero(nameless);
    delete nameless.characters[0].avatar;
    await assert.rejects(nameless.api.applyCharacterLive('__cur__', null), /아바타 파일명/);
    assert.equal(nameless.called('fetch').length, 0);
});

console.log(`prompt-apply-live: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
