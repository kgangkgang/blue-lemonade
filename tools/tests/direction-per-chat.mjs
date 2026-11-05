// 1.0.1 후보 · 전개 지시 1.4.4 — 「채팅방마다 따로」(기본 꺼짐): 전개 지시 · 항상 지시(켜짐 · 글) · 프롬프트 줄 켜짐을 채팅 파일(chat_metadata)에 채팅방마다
// 꺼져 있으면 chat_metadata 를 읽지 않고 예전과 같은 결과 · 새 채팅방은 글 빈칸 + 마지막 켜짐 · 켜고 끌 때 지금 채팅방 모습 유지 · 채팅 파일 저장
// direction-prompts.mjs 와 같은 틀 (index.js 를 '// ── 시작' 앞까지 떼어 불러온다)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
const prompt = await import(new URL('src/addons/direction/prompt.js', url));
const ext = {};
const chats = {};   // 채팅 id → chat_metadata
const probe = { ext, insertInstructions: prompt.insertInstructions, saves: 0, metaSaves: 0, metaNow: 0, metaReads: 0, chatId: undefined, model: 'example-model' };
const context = () => {
    const chatId = probe.chatId;
    return { chatId, get chatMetadata() { probe.metaReads++; return chatId ? (chats[chatId] ??= {}) : {}; }, substituteParams: text => String(text).replace(/\{\{user\}\}/gi, () => 'Alice'),
        saveMetadataDebounced: () => { probe.metaSaves++; }, saveMetadata: async () => { probe.metaNow++; } };
};
probe.context = context;
globalThis.__directionTest = probe; globalThis.__dirPlace = prompt.placeInstructions; globalThis.window = { matchMedia: () => ({ matches: false }) };
const js = await read('src/addons/direction/index.js');
const source = js.split('// ── 시작')[0].replace(/^import .*;$/gm, '');
const prelude = 'const addonRunning=()=>true;const placeInstructions=globalThis.__dirPlace;const setExtensionPrompt=()=>{};const extension_prompt_types={NONE:-1,IN_PROMPT:0,IN_CHAT:1,BEFORE_PROMPT:2};const extension_prompt_roles={SYSTEM:0,USER:1,ASSISTANT:2};const {ext:extension_settings,insertInstructions}=globalThis.__directionTest;const getContext=()=>globalThis.__directionTest.context();const saveSettingsDebounced=()=>{globalThis.__directionTest.saves++;};const eventSource={on(){}};const event_types={};const POPUP_TYPE={};const callGenericPopup=async()=>true;const oai_settings={};const getChatCompletionModel=()=>globalThis.__directionTest.model;const verifyAddonCss=()=>{};const badgeTextHit=()=>true;const showThemeModal=()=>{};const registerAnchorSource=()=>{};const anchorAvailable=()=>false;const afterBoot=()=>{};const onThemeLook=()=>{};';
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source + '\nexport {initSettings,settings,injectDirection,trackGeneration,isActive,hasContent,enabledPrompts,promptOn,setPromptOn,setEnabled,setContent,slotOf,chatRecord,setPerChat,save,directionMacroText,footText,MODULE};').toString('base64'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}
const send = () => { const chat = [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }]; m.trackGeneration('normal'); m.injectDirection({ chat }); return chat.map(x => x.content); };
const open = id => { probe.chatId = id; };
const fresh = (over = {}) => {
    for (const key of Object.keys(chats)) delete chats[key];
    ext.jeongaejisi = { extensionEnabled: true, direction: { enabled: true, content: 'old story' }, always: { enabled: false, content: '' }, directionPrompt: 'D[{{direction}}]', promptDepth: 1,
        presets: [], history: { direction: [], always: [] },
        promptList: [{ id: 'p1', title: 'P1', content: 'one', enabled: true, at: 1 }, { id: 'p2', title: 'P2', content: 'two', enabled: false, at: 1 }], ...over };
    m.initSettings();
    Object.assign(probe, { saves: 0, metaSaves: 0, metaNow: 0, metaReads: 0 });
    open('A');
    return m.settings();
};
const typeDirection = text => { m.setContent('direction', text); m.save(); };
const pick = slot => ({ enabled: slot.enabled, content: slot.content });
const togglePrompt = id => { const item = m.settings().promptList.find(entry => entry.id === id); m.setPromptOn(item, !m.promptOn(item)); m.save(); };

await test('기본 꺼짐: 예전 설정에 perChat 이 생기고(false) · 두 번 불러도 같음 · chat_metadata 를 읽지 않고 예전과 같은 결과 · 채팅 파일에 안 씀', () => {
    const s = fresh();
    assert.equal(s.perChat, false);
    const once = structuredClone(s); m.initSettings(); assert.deepEqual(m.settings(), once);
    assert.deepEqual(send(), ['u1', 'one', 'D[old story]', 'a1']);
    typeDirection('next'); togglePrompt('p2');
    open('B');
    assert.deepEqual(send(), ['u1', 'one', 'two', 'D[next]', 'a1'], 'shared across chats when off');
    assert.equal(probe.metaReads, 0, 'off: never reads chat_metadata');
    assert.equal(probe.metaSaves, 0); assert.deepEqual(chats, {});
    assert.equal(m.footText(), '보낼 때마다 이 지시가 마지막 메시지 앞에 들어가요.', 'foot text unchanged when off');
});

await test('켜면 지금 채팅방은 보이던 그대로 · 새 채팅방은 글 빈칸 + 마지막 켜짐 · 채팅방마다 다른 글 · 돌아오면 그 글', () => {
    const s = fresh();
    m.setPerChat(true);
    assert.equal(s.perChat, true);
    assert.deepEqual(chats.A[m.MODULE], { direction: { enabled: true, content: 'old story' }, always: { enabled: false, content: '' }, promptsOn: ['p1'] }, 'current chat keeps what it showed');
    assert.equal(probe.metaSaves, 1, 'chat file saved');
    assert.deepEqual(send(), ['u1', 'one', 'D[old story]', 'a1']);
    open('B');
    assert.equal(m.slotOf('direction').content, '', 'new chat starts blank');
    assert.equal(m.isActive(), true, 'on/off follows the last state');
    assert.deepEqual(send(), ['u1', 'one', 'D[]', 'a1']);
    assert.equal(chats.B?.[m.MODULE], undefined, 'reading does not create a record');
    typeDirection('B story');
    assert.deepEqual(chats.B[m.MODULE].direction, { enabled: true, content: 'B story' });
    assert.equal(s.direction.content, 'old story', 'global text untouched while per chat');
    assert.equal(m.directionMacroText(), 'B story', '{{direction}} macro follows the chat');
    open('A'); assert.deepEqual(send(), ['u1', 'one', 'D[old story]', 'a1']);
    open('B'); assert.deepEqual(send(), ['u1', 'one', 'D[B story]', 'a1']);
    assert.equal(m.footText(), '이 채팅방에서 보낼 때마다 이 지시가 마지막 메시지 앞에 들어가요.');
});

await test('켜짐 · 프롬프트 줄은 채팅방마다, 고칠 때 전역 값은 「마지막 상태」 · 지운 줄 id 는 걷음 · 순서는 목록 순서', () => {
    const s = fresh();
    m.setPerChat(true);
    open('B');
    m.setEnabled('direction', false); m.save();
    togglePrompt('p2');   // B: p1(이어받음) + p2
    assert.deepEqual(chats.B[m.MODULE].promptsOn, ['p1', 'p2']);
    assert.equal(s.direction.enabled, false, 'global mirrors the last state'); assert.equal(s.promptList[1].enabled, true);
    assert.deepEqual(send(), ['u1', 'one', 'two', 'a1']);
    open('A');
    assert.deepEqual(send(), ['u1', 'one', 'D[old story]', 'a1'], 'chat A keeps its own on/off and prompts');
    open('C');
    assert.deepEqual(send(), ['u1', 'one', 'two', 'a1'], 'a new chat starts from the last state');
    open('B'); togglePrompt('p1'); assert.deepEqual(send(), ['u1', 'two', 'a1']);
    s.promptList.unshift({ id: 'p0', title: 'P0', content: 'zero', enabled: false, at: 2 });
    chats.B[m.MODULE].promptsOn.push('gone');
    togglePrompt('p0');
    assert.deepEqual(chats.B[m.MODULE].promptsOn, ['p2', 'p0'], 'stale ids are dropped');
    assert.deepEqual(send(), ['u1', 'zero', 'two', 'a1'], 'send order is the list order');
});

await test('항상 지시도 채팅방마다: 켤 때 그대로 · 새 채팅방은 마지막 상태(글 · 켜짐) · 채팅방마다 다른 글 · 끄면 지금 채팅방 값이 공용', () => {
    const s = fresh({ always: { enabled: true, content: 'RULE A {{user}}' } });
    m.setPerChat(true);
    assert.deepEqual(chats.A[m.MODULE].always, { enabled: true, content: 'RULE A {{user}}' });
    assert.deepEqual(send(), ['u1', 'RULE A Alice', 'one', 'D[old story]', 'a1']);
    open('B');
    assert.equal(chats.B?.[m.MODULE], undefined);
    assert.deepEqual(pick(m.slotOf('always')), { enabled: true, content: 'RULE A {{user}}' }, 'new chat starts from the last state');
    m.setContent('always', 'RULE B'); m.save();
    assert.deepEqual(chats.B[m.MODULE].always, { enabled: true, content: 'RULE B' });
    assert.equal(s.always.content, 'RULE B', 'global = last state');
    assert.equal(chats.B[m.MODULE].direction.content, '', 'direction text still starts blank');
    open('A'); assert.deepEqual(send(), ['u1', 'RULE A Alice', 'one', 'D[old story]', 'a1'], 'chat A keeps its own always text');
    m.setEnabled('always', false); m.save();
    assert.deepEqual(send(), ['u1', 'one', 'D[old story]', 'a1']);
    assert.equal(m.footText().startsWith('이 채팅방에서 '), true);
    open('B'); assert.deepEqual(send(), ['u1', 'RULE B', 'one', 'D[]', 'a1'], 'chat B on/off untouched');
    open('C'); assert.deepEqual(pick(m.slotOf('always')), { enabled: false, content: 'RULE B' }, 'last enabled from A, last text from B');
    open('B'); m.setPerChat(false);
    assert.deepEqual([s.always.enabled, s.always.content], [true, 'RULE B'], 'off: this chat becomes shared');
    open('A'); assert.deepEqual(send(), ['u1', 'RULE B', 'one', 'D[]', 'a1']);
});

await test('채팅방을 안 연 첫 화면은 전역 값 · 망가진 기록은 제자리에서 다듬음 · 저장은 바뀔 때만', () => {
    const s = fresh();
    m.setPerChat(true);
    open(undefined);
    assert.equal(m.slotOf('direction'), s.direction, 'no chat: global slot');
    const before = probe.metaSaves;
    typeDirection('welcome text');
    assert.equal(s.direction.content, 'welcome text'); assert.equal(probe.metaSaves, before, 'no chat: no chat-file save');
    open('D'); chats.D = { [m.MODULE]: { direction: { enabled: 'yes', content: 7 }, promptsOn: 'bad' } };
    assert.deepEqual(m.chatRecord(), { direction: { enabled: false, content: '7' }, always: { enabled: false, content: '' }, promptsOn: ['p1'] });
    open('F'); chats.F = { [m.MODULE]: { direction: { enabled: true, content: 'f' }, promptsOn: [] } };   // 항상 지시 칸이 없던 기록(1.4.4 초안) → 마지막 상태로 채움
    assert.deepEqual(m.chatRecord().always, { enabled: false, content: '' });
    open('E'); chats.E = { [m.MODULE]: [1, 2] };
    assert.equal(m.chatRecord(), null, 'array is not a record');
    assert.equal(m.slotOf('direction').content, '');
});

await test('끄면 지금 채팅방 모습이 모든 채팅방 공용 · 채팅방 기록은 남아 다시 켜면 돌아옴', () => {
    const s = fresh();
    m.setPerChat(true);
    open('B'); typeDirection('B story'); togglePrompt('p1'); togglePrompt('p2');
    m.setPerChat(false);
    assert.equal(s.perChat, false);
    assert.equal(s.direction.content, 'B story'); assert.deepEqual(s.promptList.map(item => item.enabled), [false, true]);
    open('A'); assert.deepEqual(send(), ['u1', 'two', 'D[B story]', 'a1'], 'off: shared again');
    m.setPerChat(true);
    assert.deepEqual(send(), ['u1', 'one', 'D[old story]', 'a1'], 'on again: chat A record comes back');
});

await test('창을 닫을 때 채팅 파일을 바로 저장 · 화면 · 도움말 · 매크로 · 채팅방 바뀜 · CI', async () => {
    const css = await read('src/addons/direction/style.css');
    assert.match(js, /if \(chatUnflushed\) \{\s*chatUnflushed = false;\s*try \{ void getContext\(\)\.saveMetadata\?\.\(\); \}/, 'flush on close');
    assert.match(js, /<b>채팅방마다 따로<\/b><small>전개 · 항상 지시 · 프롬프트 켜짐<\/small><\/div>\s*<button type="button" class="jj-switch" id="jj_per_chat_switch" role="switch"/, 'same row parts as the other switches');
    assert.match(js, /setAttr\(settingsRoot\.querySelector\('#jj_per_chat_switch'\), 'aria-checked', String\(store\.perChat\)\);/);
    assert.match(js, /eventSource\.on\(event_types\.CHAT_CHANGED, \(\) => \{ if \(!perChatOn\(\)\) return; closePopup\(\); refreshButton\(\); \}\);/, 'chat change: nothing when off');
    assert.match(js, /<p><b>채팅방마다 따로<\/b>\(확장 설정 카드, 처음엔 꺼짐\)를 켜면 전개 지시 · 항상 지시\(켜짐 · 글\)와/, 'help');
    assert.match(js, /const VERSION = '1\.4\.4';/); assert.match(css, /--jj-css-version: "1\.4\.4";/);
    assert.doesNotMatch(css, /jj_per_chat|per-chat/, 'no screen-only CSS for the new row');
    assert.match(await read('src/addons/direction/NOTICE.md'), /https:\/\/github\.com\/DenBzs\/Direction-Manager-DB.*가져오지 않고/, 'idea credit only');
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/direction-per-chat\.mjs \./, 'registered in CI');
});

console.log(`direction-per-chat: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
