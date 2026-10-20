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
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source + '\nexport {initSettings,settings,injectDirection,trackGeneration,promptsActive,sendLevel,enabledPrompts,stateText,kindActive,KINDS,TEXT_KINDS,PROMPT_MAX};').toString('base64'));

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
        promptList: [{ id: 'p1', title: '문체 다듬기', content: 'Fix bias toward {{user}}.', enabled: true }, { id: 'p2', title: 'off', content: 'OFF', enabled: false },
            { id: 'p3', title: '짧게 답하기', content: 'Keep {{char}} in character.', enabled: true }, { id: 'p4', title: 'blank', content: '   ', enabled: true }] });
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
    assert.match(css, /--jj-css-version: "1\.3\.4";/); assert.match(js, /const VERSION = '1\.3\.4';/);
    assert.match(css, /\.jj-pitem-head \{[^}]*min-height: 44px/, 'row is a 44px target');
    assert.match(css, /#jj-popup \.jj-padd \{[^}]*min-height: 44px/);
    assert.match(css, /@media \(pointer: coarse\) \{\s*#jj-popup \.jj-pbtn::after \{[^}]*width: max\(100%, 44px\); height: max\(100%, 44px\)/, '36px buttons get a 44px hit box on touch');
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/direction-prompts\.mjs \./, 'registered in CI');
});

await test('7.4.2 (1.3.1) 깃털 단계 = 보내는 것의 수 (테두리 · 채움 · 채움 + 빛) · 그라데이션 없음 · 켜짐 색 하나', async () => {
    const on = { title: 't', content: 'P', enabled: true };
    const level = over => { fresh({ direction: { enabled: false, content: '' }, always: { enabled: false, content: '' }, ...over }); return m.sendLevel(); };
    assert.equal(level({}), 0);
    assert.equal(level({ direction: { enabled: true, content: '' } }), 1, 'direction on (even empty) counts');
    assert.equal(level({ always: { enabled: true, content: 'A' } }), 1, 'direction off but always sending: still lit');
    assert.equal(level({ always: { enabled: true, content: '' } }), 0, 'empty always sends nothing');
    assert.equal(level({ promptList: [on, { ...on }] }), 1, 'any number of prompt rows = one source');
    assert.equal(level({ prompts: { enabled: false }, promptList: [on] }), 0);
    assert.equal(level({ always: { enabled: true, content: 'A' }, promptList: [on] }), 2);
    assert.equal(level({ direction: { enabled: true, content: 'd' }, always: { enabled: true, content: 'A' }, promptList: [on] }), 3);
    assert.equal(level({ extensionEnabled: false, direction: { enabled: true, content: 'd' }, always: { enabled: true, content: 'A' }, promptList: [on] }), 0, 'feather button off');
    assert.match(js, /button\.dataset\.jjLevel = String\(level\);\s*button\.classList\.toggle\('is-on', level > 0\);/);
    assert.doesNotMatch(js, /partnerColor|gradientColors|setProperty\('--jj-grad-/, 'no gradient code');
    const css = await read('src/addons/direction/style.css'), theme = await read('css/04-send-form.css');
    for (const text of [css, theme]) assert.doesNotMatch(text, /--jj-grad-|is-always/, 'no gradient rules');
    // 사용자 10-20 고른 모양: 1 테두리만(안은 12%) · 2 채움 · 3 채움 + 은은한 빛 — 테마 · 테마 없음 둘 다
    for (const text of [css, theme]) {
        assert.match(text, /\[data-jj-level="1"\][^{]*\{[^}]*color: color-mix\(in srgb, var\(--jj-on\) 12%, transparent\);[^}]*-webkit-text-stroke: 1\.3px var\(--jj-stroke[^}]*paint-order: stroke fill;/, 'level 1 = thin outline (7.4.5: fixed 1.3px = the line-icon weight at any icon size)');
        assert.doesNotMatch(text, /-webkit-text-stroke(?:-width)?: 0\.[0-9]+em/, '7.4.5 no em-scaled outline (grew on the phone)');
        assert.doesNotMatch(text, /-webkit-text-stroke(?:-width)?: 0\.13em/, 'no thick 7.4.3 outline');
        assert.match(text, /:is\(\[data-jj-level="2"\], \[data-jj-level="3"\]\)[^{]*\{[^}]*color: var\(--jj-on\);/, 'level 2+ = solid');
        // 7.4.3 3단계 빛은 보내기 줄의 다른 단추와 같은 세기 (4px · 65%), 작은 창 제목 깃털은 3px
        assert.match(text, /#jj-button\[data-jj-level="3"\] > i(?:, #jj-popup\[data-jj-level="3"\] \.jj-popup-title > i\))? \{\s*filter: drop-shadow\(0 0 4px color-mix\(in srgb, var\(--jj-on\) 65%, transparent\)\);/, 'button level 3 glow = send-form glow');
        assert.match(text, /#jj-popup\[data-jj-level="3"\] \.jj-popup-title > i \{\s*filter: drop-shadow\(0 0 3px color-mix\(in srgb, var\(--jj-on\) 65%, transparent\)\);/, 'popup title glow scaled to its size');
        assert.doesNotMatch(text, /drop-shadow\(0 0 6px/, 'no wider 7.4.2 glow');
    }
    assert.match(theme, /body\.salty \{\s*--jj-stroke: color-mix\(in srgb, var\(--jj-on\) 80%, #b08000\);\s*\}\s*body\.salty\.salty-dark \{\s*--jj-stroke: var\(--jj-on\);/, 'light themes: darker stroke');
    assert.match(theme, /body\.salty\.salty-icons-line :is\(#jj-button\[data-jj-level\] > i, #jj-popup\[data-jj-level\] \.jj-popup-title > i\)::before \{\s*content: "\\f56b" !important;/, '7.4.4 line icons: every level (off too) uses the same glyph');
    assert.match(theme, /body\.salty :is\(#jj-button\[data-jj-level="0"\] > i, #jj-popup\[data-jj-level="0"\] \.jj-popup-title > i\) \{\s*color: var\(--salty-muted\);[^}]*-webkit-text-stroke: 0;/, '7.4.4 off = solid grey glyph');
    assert.match(js, /now\.textContent = tokenNumber\(value\); now\.title = tokenLabel\(value\); now\.setAttribute\('aria-label', tokenLabel\(value\)\);/, '7.4.4 row badge: number only, label says 토큰');
    assert.match(js, /popup\.dataset\.jjLevel = String\(sendLevel\(\)\);/, 'popup title icon follows the same level');
    assert.match(theme, /body\.salty #jj-popup \.jj-dots b\.is-current \{\s*background: var\(--jj-on\);/, 'current-page dot: solid on-colour');
    assert.doesNotMatch(js + css, /유저 편향|성격 교정/, 'no such examples in shipped text');
});

await test('7.4.3 (1.3.2) 프롬프트 쪽에서 옆으로 밀기 · 점 누르기 · 토큰 수', async () => {
    const css = await read('src/addons/direction/style.css');
    const list = css.match(/\.jj-pitems \{([^}]*)\}/)?.[1] ?? '';
    assert.match(list, /overscroll-behavior-y: contain;/); assert.doesNotMatch(list, /overscroll-behavior: contain/, 'x must chain to the page scroller (stuck on the prompts page)');
    assert.match(css, /\.jj-dots::before \{[^}]*height: 44px;/, 'dots: 44px tap height');
    assert.match(js, /popup\.querySelector\('\.jj-popup-title'\)\.addEventListener\('click', onTitleClick\)/);
    assert.match(js, /function onTitleClick\(event\) \{[\s\S]*?return showPage\(KINDS\[best\]\);[\s\S]*?showPage\(KINDS\[\(KINDS\.indexOf\(page\) \+ 1\) % KINDS\.length\]\);/, 'dot → that page, elsewhere → next (3 → 1)');
    assert.match(js, /head\.append\(toggle, makeEl\('span', 'jj-ptok'\), toggleSwitch\);/, 'count between title and switch');
    assert.match(css, /\.jj-ptok \{ flex: 0 0 auto; white-space: nowrap;/, 'title shrinks first');
    assert.match(js, /if \(page === 'prompts' && popup\.dataset\.tokPage !== 'prompts'\) void fillPromptTokens\(\);/, 'count only when the page is shown');
    assert.doesNotMatch(js.split('// ── 시작')[1] ?? '', /fillPromptTokens|countTokens/, 'never at startup');
    assert.match(js, /`켜진 프롬프트 \$\{tokenLabel\(\{ n: total, approx \}\)\}`/);
});

console.log(`direction-prompts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
