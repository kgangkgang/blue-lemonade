// 8.0.1 과일 계열 한 분류 — 한글화 토글 하나(설정 이전) · 구조 판별 · 택1 지킴이 · 캐릭터 이름 연동의 택1 존중. 네트워크 · DOM 없음.
//   node tools/tests/fruit-family.mjs <테마 루트>
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

const ctx = {
    extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {},
    characters: [{ avatar: 'ch.png', name: '예시 카드' }, { avatar: 'other.png', name: '다른 카드' }], groups: [],
    characterId: 0, groupId: null, chatId: 'chat-a', getCurrentChatId: () => ctx.chatId,
    eventSource: { on() {} }, event_types: {},
};
globalThis.SillyTavern = { getContext: () => ctx };

const { SCRIPT_CATALOG, SCRIPT_FAMILIES } = await load('src/scripts/catalog.js');
const store = await load('src/scripts/store.js');

await test('한글화 토글은 「과일 계열 (과일 · 야한과일 · 청과)」 하나이고 실행 단위 셋을 묶어요', () => {
    const family = SCRIPT_FAMILIES.find(f => f.id === 'fruit-family');
    assert.equal(family.name, '과일 계열 (과일 · 야한과일 · 청과)');
    assert.deepEqual([...family.members].sort(), ['fruit', 'fruit-heart', 'qingguo']);
    for (const id of family.members) assert.equal(SCRIPT_CATALOG.find(x => x.id === id).family, 'fruit-family');
    assert.ok(!SCRIPT_CATALOG.some(x => x.id === 'fruit-family'), '묶음은 실행 단위가 아니에요');
});
await test('설정 이전: 예전에 하나라도 켰으면(청과만 켬 포함) 묶음 켬, 아무것도 안 켰으면 끔', () => {
    for (const [enabled, want] of [[{ qingguo: true }, true], [{ fruit: true, 'fruit-heart': true }, true], [{ 'fruit-heart': true }, true], [{}, false], [{ fruit: false, qingguo: false }, false]]) {
        ctx.extensionSettings = { blue_lemonade_scripts: { version: 1, enabled: { ...enabled, korean: true }, overrides: {} } };
        const state = store.scriptSettings();
        assert.equal(state.enabled['fruit-family'], want, JSON.stringify(enabled));
        for (const id of ['fruit', 'qingguo', 'fruit-heart']) assert.equal(state.enabled[id], want);
        assert.equal(state.enabled.korean, true, '다른 토글은 그대로');
    }
});
await test('이전한 뒤에는 묶음 값이 기준이에요 — 끈 묶음은 남은 옛 값으로 다시 켜지지 않아요', () => {
    ctx.extensionSettings = { blue_lemonade_scripts: { version: 1, enabled: { 'fruit-family': false, qingguo: true }, overrides: {} } };
    const state = store.scriptSettings();
    assert.equal(state.enabled['fruit-family'], false); assert.equal(state.enabled.qingguo, false);
    store.setScriptEnabled(state, 'fruit-family', true);
    assert.deepEqual(['fruit', 'qingguo', 'fruit-heart'].map(id => state.enabled[id]), [true, true, true]);
    store.setScriptEnabled(state, 'qingguo', false);   // 실행 단위 이름으로 불러도 묶음 전체
    assert.equal(store.scriptEnabled(state, 'fruit-family'), false); assert.equal(state.enabled.fruit, false);
    store.setScriptEnabled(state, 'korean', false); assert.equal(state.enabled.korean, false); assert.equal(state.enabled.fruit, false);
});

const { fruitFamilyOf } = await load('src/fruit-family.js');
const mom = (extra = {}) => ({ prompts: [{ identifier: '419e0b0c-c3f0-4ae8-91cd-97d4d71455a1', name: '📌 获取变量｜必开·别动' }, { identifier: 'fruit-heart-control-config-v2', name: '🔧 果实之心控制配置｜别动别开' }, { identifier: 'fruit-v61-display-section-01', name: '━━' }, ...(extra.prompts || [])], extensions: { fruitHeartSections: { version: 1, groups: [] }, tavern_helper: { scripts: [{ type: 'script', name: '果实之心丨本地版' }, ...(extra.scripts || [])] }, ...(extra.ext || {}) } });
await test('판별은 이름이 아니라 구조로: 과일 · 야한과일(SPreset) · 청과(青果 스크립트) · 데우스 같은 다른 프리셋은 아님', () => {
    assert.deepEqual(fruitFamilyOf(mom()).kind, 'fruit');
    assert.equal(fruitFamilyOf(mom({ ext: { SPreset: {} } })).kind, 'sese');
    assert.equal(fruitFamilyOf(mom({ ext: { SPreset: {} }, scripts: [{ type: 'script', name: '🍏 青果·缄默白描质检与修枝台' }] })).kind, 'qingguo');
    assert.equal(fruitFamilyOf(mom()).markers.length, 4);
    assert.equal(fruitFamilyOf({ prompts: [{ identifier: 'main', name: '과일 6.4' }], extensions: {} }).family, false, '이름에 과일이 들어도 구조가 없으면 아니에요');
    const renamed = mom(); renamed.prompts[0].identifier = 'x'; renamed.prompts[0].name = '📌 获取变量（改名）';
    assert.equal(fruitFamilyOf(renamed).family, true, '항목 id 가 달라도 이름 표식으로');
    assert.equal(fruitFamilyOf({ prompts: [], extensions: { fruitHeartSections: {} } }).family, false, '표식 하나로는 판단하지 않아요');
});

const core = await load('src/prompt-choice-core.js');
const colors = ['auto', 'base', 'group-a', 'group-b', 'group-c'];
const prompts = [{ identifier: 'auto', name: '🍏 대사 색상 (카드 따라 자동)｜색상 택1' }, { identifier: 'base', name: '🎨 대사 색상 (데우스 · 기본)｜색상 택1' }, { identifier: 'group-a', name: '🎨 대사 색상 (데우스 · 예시연합)｜색상 택1' }, { identifier: 'group-b', name: '🎨 대사 색상 (데우스 · 그룹나)｜색상 택1' }, { identifier: 'group-c', name: '🎨 대사 색상 (데우스 · 그룹다)｜색상 택1' }, { identifier: 'main', name: 'main' }];
const meta = { version: 1, groups: [{ id: 'dialogue-colors', ids: colors }, { id: 'fruit-색상', ids: ['base', 'group-a', 'group-b', 'group-c', 'auto'] }] };
const orderOf = on => [...colors, 'main'].map(id => ({ identifier: id, enabled: on.includes(id) }));
await test('택1 지킴이: 같은 항목의 묶음 두 개는 하나로, 새로 켜진 것이 하나면 그것만 남겨요', () => {
    const order = orderOf(['auto', 'main']), groups = core.promptChoiceGroups(prompts, order, meta);
    assert.equal(core.distinctChoiceGroups(groups).length, 1);
    const before = core.choiceSnapshot(groups, order);
    order.find(r => r.identifier === 'base').enabled = true;   // 다른 길(이름 연동 · 과일의 마음 창)로 켜짐
    const { off, ask } = core.resolveChoiceConflicts(groups, order, before);
    assert.deepEqual(off, ['auto']); assert.equal(ask.length, 0);
    assert.equal(order.find(r => r.identifier === 'auto').enabled, true, '결정만 하고 order 는 부르는 쪽이 바꿔요');
});
await test('택1 지킴이: 불러올 때 이미 여럿 켜져 있으면 끄지 않고 물어볼 목록으로 — 합성 선택 상태(자동 · 기본 · 예시연합)', () => {
    const order = orderOf(['auto', 'base', 'group-a', 'main']), groups = core.promptChoiceGroups(prompts, order, meta);
    const { off, ask } = core.resolveChoiceConflicts(groups, order, null);
    assert.deepEqual(off, []); assert.equal(ask.length, 1); assert.deepEqual(ask[0].on, ['auto', 'base', 'group-a']);
    const label = core.choiceGroupLabel(ask[0].ids.map(id => prompts.find(p => p.identifier === id).name));
    assert.equal(label, '대사 색상');
    assert.equal(`「${label}」 택1에 ${ask[0].on.length}개가 켜져 있어요 — 하나만 남길까요?`, '「대사 색상」 택1에 3개가 켜져 있어요 — 하나만 남길까요?');
    // 둘이 함께 새로 켜지면 어느 쪽인지 모르니 물어요
    const order2 = orderOf(['auto']), before = core.choiceSnapshot(groups, order2);
    order2.find(r => r.identifier === 'base').enabled = true; order2.find(r => r.identifier === 'group-a').enabled = true;
    assert.equal(core.resolveChoiceConflicts(groups, order2, before).ask.length, 1);
});
await test('묶음 이름: 중국어 「…｜节奏单选」 처럼 앞부분이 다르면 공통 꼬리에서', () => {
    assert.equal(core.choiceGroupLabel(['🎬 推进慢速｜节奏单选', '🎬 推进快速｜节奏单选']), '推进');
    assert.equal(core.choiceGroupLabel(['🧩 关系对齐｜互动逻辑单选', '🧩 人物逻辑｜互动逻辑单选 @小n']), '互动逻辑');
});

// 캐릭터 이름 연동(promptbind)이 택1 묶음 밖 선택(카드 따라 자동)을 존중하는지 — 10-26 원인 재현
const { getSettings } = await load('src/settings.js');
const B = await load('src/promptbind.js');
const live = orderOf(['auto', 'main']);
const pm = {
    activeCharacter: { id: 100001 }, serviceSettings: { prompts, extensions: { blPromptChoices: meta } },
    getPromptOrderForCharacter: () => live, getPromptOrderEntry: (_c, id) => live.find(e => e.identifier === id) ?? null,
    getPromptById: id => prompts.find(p => p.identifier === id) || { identifier: id, name: id }, saveServiceSettings: async () => {}, render: () => {},
};
B.setPromptManager(pm);
getSettings().promptLink = { on: true, rows: [{ word: '예시', cards: ['ch.png'] }, { word: '그룹나', cards: [] }, { word: '그룹다', cards: [] }] };
const onIds = () => live.filter(r => r.enabled).map(r => r.identifier).filter(id => colors.includes(id));
await test('이름 연동: 「카드 따라 자동」이 켜져 있으면 예시 카드에서도 · 다른 카드에서도 연동 색을 켜지 않아요', async () => {
    ctx.characterId = 0; await B.syncPromptBinds('chat'); assert.deepEqual(onIds(), ['auto']);
    ctx.characterId = 1; await B.syncPromptBinds('chat'); assert.deepEqual(onIds(), ['auto']);
});
await test('이름 연동: 사용자가 연동 색(기본)을 고르면 예전처럼 카드마다 바꿔요', async () => {
    for (const r of live) if (colors.includes(r.identifier)) r.enabled = r.identifier === 'base';
    ctx.characterId = 0; await B.syncPromptBinds('chat'); assert.deepEqual(onIds(), ['group-a']);
    ctx.characterId = 1; await B.syncPromptBinds('chat'); assert.deepEqual(onIds(), ['base']);
});
console.log(`fruit-family: ${passed} passed`);
