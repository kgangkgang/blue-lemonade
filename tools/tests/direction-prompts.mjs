// 7.4.1 전개 지시 1.3.0 — 세 번째 쪽 「프롬프트」: 예전 설정은 빈 목록 · 켠 줄만 · 항상 지시 → 프롬프트(목록 순서) → 전개 지시 · 매크로 · 쪽 스위치
// story-direction.mjs 와 같은 틀 (index.js 를 '// ── 시작' 앞까지 떼어 불러온다)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
const { insertInstructions } = await import(new URL('src/addons/direction/prompt.js', url));
const ext = {};
const probe = { ext, insertInstructions, saves: 0, model: 'example-model',
    context: { substituteParams: text => String(text).replace(/\{\{user\}\}/gi, () => 'Alice').replace(/\{\{char\}\}/gi, () => 'Robin') } };
globalThis.__directionTest = probe; globalThis.window = { matchMedia: () => ({ matches: false }) };
const js = await read('src/addons/direction/index.js');
const source = js.split('// ── 시작')[0].replace(/^import .*;$/gm, '');
const prelude = 'const {ext:extension_settings,insertInstructions}=globalThis.__directionTest;const getContext=()=>globalThis.__directionTest.context;const saveSettingsDebounced=()=>{globalThis.__directionTest.saves++;};const eventSource={on(){}};const event_types={};const POPUP_TYPE={};const callGenericPopup=async()=>true;const oai_settings={};const getChatCompletionModel=()=>globalThis.__directionTest.model;const verifyAddonCss=()=>{};const badgeTextHit=()=>true;const showThemeModal=()=>{};';
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source + '\nexport {initSettings,settings,injectDirection,trackGeneration,promptsActive,enabledPrompts,stateText,kindActive,KINDS,TEXT_KINDS,PROMPT_MAX};').toString('base64'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}
const send = (type = 'normal', chat = [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }]) => { m.trackGeneration(type); m.injectDirection({ chat }); return chat; };
const fresh = (over = {}) => {
    ext.jeongaejisi = { extensionEnabled: true, direction: { enabled: false, content: '' }, always: { enabled: false, content: '' }, directionPrompt: 'D {{direction}}', promptDepth: 1, presets: [], history: { direction: [], always: [] }, ...over };
    m.initSettings();
    return m.settings();
};

await test('예전 설정(7.4.0): 빈 목록 · 쪽 스위치 켜짐 · 저장 · 최근은 두 쪽 그대로 · 두 번 불러도 같음', () => {
    const s = fresh();
    assert.deepEqual(s.promptList, []);
    assert.deepEqual(s.prompts, { enabled: true });
    assert.deepEqual(Object.keys(s.history).sort(), ['always', 'direction'], 'no history for the prompts page');
    const once = structuredClone(s); m.initSettings(); assert.deepEqual(m.settings(), once);
    assert.deepEqual(m.KINDS, ['direction', 'always', 'prompts']); assert.deepEqual(m.TEXT_KINDS, ['direction', 'always']);
    assert.equal(m.stateText('prompts'), '비어 있음'); assert.equal(m.promptsActive(), false);
});

await test('망가진 목록 다듬기: 객체만 · 제목 한 줄 60자 · 제목도 글도 없으면 버림 · 켜짐은 true 만 · id 채움 · 50개까지', () => {
    const long = 'x'.repeat(80);
    const s = fresh({ prompts: 'bad', promptList: [null, 7, { title: '  A\n b ', content: 'body', enabled: 'yes' }, { title: '', content: '  ' }, { title: long, content: '', enabled: true, id: 'keep1' }, { content: 'only body', enabled: true }] });
    assert.deepEqual(s.prompts, { enabled: true });
    assert.deepEqual(s.promptList.map(p => [p.title, p.content, p.enabled]), [['A b', 'body', false], ['x'.repeat(60), '', true], ['', 'only body', true]]);
    assert.equal(s.promptList[1].id, 'keep1'); assert.ok(s.promptList.every(p => typeof p.id === 'string' && p.id && p.at > 0));
    const many = fresh({ promptList: Array.from({ length: 70 }, (_, i) => ({ title: `p${i}`, content: `c${i}` })) });
    assert.equal(many.promptList.length, m.PROMPT_MAX); assert.equal(many.promptList[0].title, 'p0');
    assert.equal(fresh({ prompts: { enabled: false, extra: 1 } }).prompts.enabled, false, 'saved off switch is kept');
});

await test('보내는 순서: 항상 지시 → 켠 프롬프트(목록 순서) → 전개 지시, 같은 자리 · system · 매크로는 항상 지시처럼', () => {
    const s = fresh({ always: { enabled: true, content: 'ALWAYS {{user}}' }, direction: { enabled: true, content: 'they meet' },
        promptList: [{ id: 'p1', title: '유저 편향 교정', content: 'Fix bias toward {{user}}.', enabled: true }, { id: 'p2', title: 'off', content: 'OFF', enabled: false },
            { id: 'p3', title: '{{char}} 성격 교정', content: 'Keep {{char}} in character.', enabled: true }, { id: 'p4', title: 'blank', content: '   ', enabled: true }] });
    const chat = send();
    assert.deepEqual(chat.map(x => `${x.role}:${x.content}`), ['user:u1', 'system:ALWAYS Alice', 'system:Fix bias toward Alice.', 'system:Keep Robin in character.', 'system:D they meet', 'assistant:a1']);
    assert.equal(m.stateText('prompts'), '2개 켜짐'); assert.deepEqual(m.enabledPrompts().map(p => p.id), ['p1', 'p3']);
    // 순서를 바꾸면 보내는 순서도
    s.promptList.reverse();
    assert.deepEqual(send().map(x => x.content), ['u1', 'ALWAYS Alice', 'Keep Robin in character.', 'Fix bias toward Alice.', 'D they meet', 'a1']);
    assert.equal(s.promptList.find(p => p.id === 'p1').content, 'Fix bias toward {{user}}.', 'stored text keeps the macro');
});

await test('끈 줄 · 빈 목록 · 쪽 스위치 끔 · 입력창 버튼 끔은 아무것도 더하지 않고, 항상 지시 · 전개 지시는 그대로', () => {
    const base = { always: { enabled: true, content: 'A' }, direction: { enabled: true, content: 'd' } };
    const plain = ['u1', 'A', 'D d', 'a1'];
    fresh(base); assert.deepEqual(send().map(x => x.content), plain, 'empty list adds nothing');
    fresh({ ...base, promptList: [{ title: 't', content: 'P', enabled: false }] }); assert.deepEqual(send().map(x => x.content), plain, 'off prompt adds nothing');
    assert.equal(m.stateText('prompts'), '켠 것 없음');
    const s = fresh({ ...base, prompts: { enabled: false }, promptList: [{ title: 't', content: 'P', enabled: true }] });
    assert.deepEqual(send().map(x => x.content), plain, 'page switch off adds nothing'); assert.equal(m.stateText('prompts'), '꺼짐');
    s.prompts.enabled = true; assert.deepEqual(send().map(x => x.content), ['u1', 'A', 'P', 'D d', 'a1']);
    s.extensionEnabled = false; assert.deepEqual(send().map(x => x.content), ['u1', 'a1'], 'feather button off: nothing at all'); assert.equal(m.stateText('prompts'), '꺼짐');
});

await test('프롬프트만 켜져 있어도 간다 (항상 지시처럼) · 조용한 생성 · 대신 쓰기 · generateRaw 에는 안 간다 · 제미니 끝 user 턴은 전개 지시 때만', () => {
    fresh({ promptList: [{ title: 't', content: 'P {{char}}', enabled: true }] });
    assert.equal(m.kindActive('prompts'), true);
    assert.deepEqual(send().map(x => x.content), ['u1', 'P Robin', 'a1']);
    for (const type of ['quiet', 'impersonate']) assert.deepEqual(send(type).map(x => x.content), ['u1', 'a1'], type);
    const chat = [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }];
    function generateRaw() { m.trackGeneration('normal'); m.injectDirection({ chat }); }
    generateRaw(); assert.equal(chat.length, 2, 'raw generation untouched');
    probe.model = 'gemini-2.5-pro';
    const tail = send('normal', [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }]);
    assert.equal(tail.at(-1).role, 'assistant', 'prompts alone do not append a user turn (like always)');
    probe.model = 'example-model';
    m.settings().promptDepth = 0;
    assert.deepEqual(send().map(x => x.content), ['u1', 'a1', 'P Robin'], 'depth 0 = end');
    probe.saves = 0; send(); assert.equal(probe.saves, 0, 'sending prompts does not save settings (no history for this page)');
});

await test('화면 · 설정 카드 · 합치기 · CSS · CI', async () => {
    assert.match(js, /\$\{KINDS\.map\(\(\) => '<b><\/b>'\)\.join\(''\)\}/, 'three page dots');
    assert.match(js, /showPage\(KINDS\[\(KINDS\.indexOf\(page\) \+ 1\) % KINDS\.length\]\)/, 'title cycles through the pages');
    assert.match(js, /<div class="jj-status" data-kind="prompts">/, 'status card');
    assert.match(js, /\{ field: 'promptList', gone: 'promptListGone', stamp: item => item\?\.updated \|\| item\?\.at \}/, 'synced across devices like presets');
    assert.match(js, /callGenericPopup\(`「\$\{escapeHtml\(promptTitle\(item\)\)\}」 프롬프트를 지울까요\?`, POPUP_TYPE\.CONFIRM\)/, 'delete asks first, title escaped');
    assert.match(js, /lines\.push\(`프롬프트 \$\{prompts\.length\}개 켜짐/, 'button tooltip line');
    assert.doesNotMatch(js, /promptList: \[\{/, 'no shipped example prompts');
    const css = await read('src/addons/direction/style.css');
    assert.match(css, /--jj-css-version: "1\.3\.0";/); assert.match(js, /const VERSION = '1\.3\.0';/);
    assert.match(css, /\.jj-pitem-head \{[^}]*min-height: 44px/, 'row is a 44px target');
    assert.match(css, /#jj-popup \.jj-padd \{[^}]*min-height: 44px/);
    assert.match(css, /@media \(pointer: coarse\) \{\s*#jj-popup \.jj-pbtn::after \{[^}]*width: max\(100%, 44px\); height: max\(100%, 44px\)/, '36px buttons get a 44px hit box on touch');
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/direction-prompts\.mjs \./, 'registered in CI');
});

console.log(`direction-prompts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
