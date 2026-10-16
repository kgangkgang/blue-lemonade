// 전개 지시 (src/addons/direction) 설정 불러오기 — 예전 단독 확장(Direction-Manager-Lite)에서 옮기기 · 저장된 값 고르기 (index.js initSettings)
//   node tools/tests/direction-migrate.mjs <테마 루트>   (공개 저장소는 '.')
// story-direction.mjs 와 같은 틀: index.js 를 '// ── 시작' 앞까지 떼어 data: 모듈로 불러온다 (실리태번 모듈은 앞머리 스텁). 지시 글은 지어낸 것.
// 확인하는 것:
//   1) 처음 켤 때 예전 확장의 켜짐 · 적은 지시 · 프롬프트 · 깊이를 옮김 · 옮긴 표시 · 저장 한 번 · 예전 설정은 지우지도 고치지도 않음
//   2) 예전 값이 이상하면 그 칸만 기본값 (정수 아닌 깊이 · 빈 프롬프트 · 불리언 아닌 켜짐 · 객체 아닌 지시) · 큰 깊이는 100 · 음수는 0
//   3) 예전 설정이 객체가 아니면 옮기지 않음 · 이미 옮긴 뒤에는 예전 설정을 다시 안 읽음 · 불러오기만으로는 저장 안 함 · 새 설정이 망가졌으면 다시 옮김
//   4) 저장된 값 고르기: 깊이 · 켜짐 색 · 켜짐 스위치 · 프롬프트(비운 것은 그대로) · 지시 칸 · 모르는 칸은 그대로
//   5) 저장 · 최근 목록 상한 (저장 100 · 최근 쪽마다 30, 앞이 최근)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const src = rel => path.join(root, rel);
const { insertInstructions } = await import(pathToFileURL(src('src/addons/direction/prompt.js')).href);
const ext = {};
const P = globalThis.__directionMigrateTest = { ext, insertInstructions, saves: 0, context: { substituteParams: text => String(text) } };
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
const source = (await fs.readFile(src('src/addons/direction/index.js'), 'utf8')).split('// ── 시작')[0].replace(/^import .*;$/gm, '');
const prelude = 'const P = globalThis.__directionMigrateTest; const extension_settings = P.ext; const insertInstructions = P.insertInstructions;'
    + 'const getContext = () => P.context; const saveSettingsDebounced = () => { P.saves++; }; const eventSource = { on() {}, once() {} }; const event_types = {};'
    + 'const POPUP_TYPE = { TEXT: 1, CONFIRM: 2 }; const callGenericPopup = async () => true; const oai_settings = {}; const getChatCompletionModel = () => "";'
    + 'const verifyAddonCss = () => {}; const badgeTextHit = () => true; const showThemeModal = () => {};';
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source
    + '\nexport { initSettings, settings, DEFAULT_PROMPT, MODULE, OLD_MODULE, HISTORY_MAX, PRESET_MAX };').toString('base64'));
const { MODULE, OLD_MODULE, DEFAULT_PROMPT, HISTORY_MAX, PRESET_MAX } = m;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 8).join('\n       ')}`); }
}
/** extension_settings 를 비우고 넣은 뒤 initSettings → 그 뒤의 새 설정 */
function load({ store, old } = {}) {
    for (const key of Object.keys(ext)) delete ext[key];
    if (store !== undefined) ext[MODULE] = store;
    if (old !== undefined) ext[OLD_MODULE] = old;
    P.saves = 0;
    m.initSettings();
    return m.settings();
}
const EMPTY_LISTS = { presets: [], history: { direction: [], always: [] } };

await test('예전 단독 확장에서 처음 옮김: 켜짐 · 적은 지시 · 프롬프트 · 깊이 · 옮긴 표시 · 저장 한 번 · 예전 설정은 그대로 남김', () => {
    const old = { extensionEnabled: false, direction: { enabled: 1, content: 42 }, directionPrompt: 'Old frame: {{direction}}', promptDepth: 4, someOldKey: 'kept' };
    const before = structuredClone(old);
    const s = load({ old });
    assert.equal(s.extensionEnabled, false, '꺼 둔 입력창 버튼은 꺼진 채');
    assert.deepEqual(s.direction, { enabled: true, content: '42' }, '켜짐은 불리언으로 · 지시는 글로');
    assert.equal(s.directionPrompt, 'Old frame: {{direction}}');
    assert.equal(s.promptDepth, 4);
    assert.equal(s.migratedFrom, OLD_MODULE, '어디서 옮겼는지 적음');
    assert.deepEqual(s.always, { enabled: false, content: '' });
    assert.deepEqual({ presets: s.presets, history: s.history }, EMPTY_LISTS);
    assert.equal(s.onColor, '');
    assert.equal('someOldKey' in s, false, '예전 확장의 모르는 칸은 가져오지 않음');
    assert.equal(P.saves, 1, '옮긴 설정은 한 번 저장');
    assert.deepEqual(ext[OLD_MODULE], before, '예전 확장 설정은 지우지도 고치지도 않음 (되돌아가도 그대로)');
});

await test('예전 값이 이상하면 그 칸만 기본값 · 큰 깊이는 100 · 음수는 0 · 빈 지시 글은 빈 칸', () => {
    let s = load({ old: { extensionEnabled: 'yes', direction: 'not an object', directionPrompt: '   ', promptDepth: 2.5 } });
    assert.equal(s.extensionEnabled, true, '불리언이 아니면 기본(켜짐)');
    assert.deepEqual(s.direction, { enabled: false, content: '' }, '객체가 아닌 지시는 기본');
    assert.equal(s.directionPrompt, DEFAULT_PROMPT, '빈 프롬프트는 기본 프롬프트');
    assert.equal(s.promptDepth, 1, '정수가 아닌 깊이는 기본');
    assert.equal(s.migratedFrom, OLD_MODULE);
    assert.equal(load({ old: { promptDepth: 500 } }).promptDepth, 100);
    assert.equal(load({ old: { promptDepth: -3 } }).promptDepth, 0);
    assert.equal(load({ old: { promptDepth: 0 } }).promptDepth, 0, '0(맨 끝)도 옮김');
    s = load({ old: { direction: { enabled: false, content: null } } });
    assert.deepEqual(s.direction, { enabled: false, content: '' });
});

await test('예전 설정이 객체가 아니면 옮기지 않음 · 예전 설정이 없어도 새 기본값으로 저장 한 번', () => {
    for (const old of ['broken', null, 7, undefined]) {
        const s = load({ old });
        assert.equal(s.migratedFrom, undefined, `옮긴 표시 없음: ${JSON.stringify(old)}`);
        assert.equal(s.extensionEnabled, true); assert.deepEqual(s.direction, { enabled: false, content: '' });
        assert.equal(s.directionPrompt, DEFAULT_PROMPT); assert.equal(s.promptDepth, 1);
        assert.equal(P.saves, 1);
    }
});

await test('이미 옮긴 뒤에는 예전 설정을 다시 안 읽음 · 불러오기만으로는 저장 안 함 · 두 번 불러도 같음', () => {
    const store = { extensionEnabled: true, direction: { enabled: true, content: 'The ferry is late tonight.' }, always: { enabled: true, content: '<OOC: two scenes>' },
        directionPrompt: 'Mine {{direction}}', promptDepth: 2, onColor: '#123456', ...EMPTY_LISTS, migratedFrom: OLD_MODULE };
    const s = load({ store, old: { extensionEnabled: false, direction: { enabled: false, content: 'old text' }, promptDepth: 9 } });
    assert.equal(s, store, '같은 객체를 고쳐 씀');
    assert.deepEqual(s.direction, { enabled: true, content: 'The ferry is late tonight.' }, '예전 지시로 덮지 않음');
    assert.equal(s.extensionEnabled, true); assert.equal(s.promptDepth, 2); assert.equal(s.directionPrompt, 'Mine {{direction}}');
    assert.equal(P.saves, 0, '고를 것이 없으면 저장 안 함');
    const once = structuredClone(s);
    m.initSettings();
    assert.deepEqual(m.settings(), once, '두 번째도 그대로');
    assert.equal(P.saves, 0);
});

await test('새 설정이 망가졌으면(객체가 아님) 예전 설정에서 다시 옮김', () => {
    for (const broken of ['oops', null, 3]) {
        const s = load({ store: broken, old: { direction: { enabled: true, content: 'old text' } } });
        assert.deepEqual(s.direction, { enabled: true, content: 'old text' }, JSON.stringify(broken));
        assert.equal(s.migratedFrom, OLD_MODULE); assert.equal(P.saves, 1);
    }
});

await test('저장된 값 고르기: 깊이 · 켜짐 색 · 켜짐 스위치 · 프롬프트(비운 것은 그대로) · 지시 칸 · 모르는 칸은 그대로', () => {
    const base = () => ({ extensionEnabled: true, direction: { enabled: false, content: '' }, directionPrompt: 'D {{direction}}', promptDepth: 1, onColor: '', ...structuredClone(EMPTY_LISTS) });
    for (const [raw, want] of [['7', 7], [-5, 0], [1000, 100], ['abc', 1], [3.9, 3], [null, 1], [undefined, 1], [100, 100]]) {
        assert.equal(load({ store: { ...base(), promptDepth: raw } }).promptDepth, want, `깊이 ${JSON.stringify(raw)}`);
    }
    for (const [raw, want] of [['FAC679', '#fac679'], ['#ABC', '#aabbcc'], ['rgb(250, 198, 121)', '#fac679'], ['250,198,121', '#fac679'], ['rgba(1, 2, 3, 0.5)', '#010203'],
        ['300,0,0', ''], ['teal', ''], ['', ''], [null, ''], ['#12345', '']]) {
        assert.equal(load({ store: { ...base(), onColor: raw } }).onColor, want, `켜짐 색 ${JSON.stringify(raw)}`);
    }
    assert.equal(load({ store: { ...base(), extensionEnabled: undefined } }).extensionEnabled, true, '없으면 켜짐');
    assert.equal(load({ store: { ...base(), extensionEnabled: false } }).extensionEnabled, false, '끈 것은 끈 채');
    assert.equal(load({ store: { ...base(), directionPrompt: null } }).directionPrompt, DEFAULT_PROMPT, '글이 아니면 기본 프롬프트');
    assert.equal(load({ store: { ...base(), directionPrompt: '' } }).directionPrompt, '', '사용자가 비운 프롬프트는 그대로');
    let s = load({ store: { ...base(), direction: { content: 5 } } });
    assert.deepEqual(s.direction, { enabled: false, content: '5' }, '켜짐이 없으면 꺼짐 · 글로');
    s = load({ store: { ...base(), direction: undefined, always: { enabled: 'yes', content: 9 } } });
    assert.deepEqual(s.direction, { enabled: false, content: '' });
    assert.deepEqual(s.always, { enabled: true, content: '9' }, '항상 지시도 불리언 · 글로');
    s = load({ store: { ...base(), futureKey: { keep: [1, 2] }, migratedFrom: OLD_MODULE } });
    assert.deepEqual(s.futureKey, { keep: [1, 2] }, '모르는 칸은 그대로');
    assert.equal(s.migratedFrom, OLD_MODULE);
    assert.equal(P.saves, 0);
});

await test('저장 · 최근 목록 상한: 저장 100 · 최근은 쪽마다 30 · 앞(최근)부터 남김 · 망가진 쪽은 빈 목록', () => {
    const presets = Array.from({ length: PRESET_MAX + 20 }, (_, i) => ({ id: `p${i}`, kind: i % 2 ? 'always' : 'direction', content: `saved line ${i}`, at: i }));
    const direction = Array.from({ length: HISTORY_MAX + 10 }, (_, i) => ({ content: `sent line ${i}`, at: i }));
    const s = load({ store: { extensionEnabled: true, direction: { enabled: false, content: '' }, presets, history: { direction, always: 'bad' } } });
    assert.equal(PRESET_MAX, 100); assert.equal(HISTORY_MAX, 30);
    assert.equal(s.presets.length, PRESET_MAX);
    assert.deepEqual(s.presets.map(p => p.id), presets.slice(0, PRESET_MAX).map(p => p.id), '앞에서부터 100개, 순서 그대로');
    assert.equal(s.history.direction.length, HISTORY_MAX);
    assert.equal(s.history.direction[0].content, 'sent line 0'); assert.equal(s.history.direction.at(-1).content, `sent line ${HISTORY_MAX - 1}`);
    assert.deepEqual(s.history.always, []);
    const t = load({ store: { extensionEnabled: true, direction: { enabled: false, content: '' }, presets: 'bad', history: null } });
    assert.deepEqual({ presets: t.presets, history: t.history }, EMPTY_LISTS);
});

delete globalThis.__directionMigrateTest; delete globalThis.window;
console.log(`\ndirection-migrate: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
