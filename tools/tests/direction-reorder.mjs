// 7.7.5 전개 지시 1.3.6 — 프롬프트 쪽 줄을 꾹 눌러 순서 바꾸기: 옮기기 · 놓을 자리 계산 · 저장 · 보내는 순서 · 예전 설정 · 키보드(Alt+↑/↓) · 기기 간 합치기 · 화면 연결
// direction-prompts.mjs 와 같은 틀 (index.js 를 '// ── 시작' 앞까지 떼어 불러온다). 예시 제목 · 글은 지어낸 것
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
const { insertInstructions } = await import(new URL('src/addons/direction/prompt.js', url));
const { mergeLists } = await import(new URL('src/addons/list-sync.js', url));
const ext = {};
const probe = { ext, insertInstructions, saves: 0, model: 'example-model', context: { substituteParams: text => String(text) } };
globalThis.__directionTest = probe; globalThis.window = { matchMedia: () => ({ matches: false }) };
globalThis.CSS ??= { escape: value => String(value) };
const js = await read('src/addons/direction/index.js');
const source = js.split('// ── 시작')[0].replace(/^import .*;$/gm, '');
const prelude = 'const {ext:extension_settings,insertInstructions}=globalThis.__directionTest;const getContext=()=>globalThis.__directionTest.context;const saveSettingsDebounced=()=>{globalThis.__directionTest.saves++;};const eventSource={on(){}};const event_types={};const POPUP_TYPE={};const callGenericPopup=async()=>true;const oai_settings={};const getChatCompletionModel=()=>globalThis.__directionTest.model;const verifyAddonCss=()=>{};const badgeTextHit=()=>true;const showThemeModal=()=>{};';
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source + '\nexport {initSettings,settings,injectDirection,trackGeneration,movePrompt,dropSlot,onPromptsReorderKey,onPromptsClick,HOLD_MS,HOLD_SLOP};').toString('base64'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}
const rows = () => [
    { id: 'pa', title: '문체 다듬기', content: 'Polish the prose.', enabled: true, at: 1 },
    { id: 'pb', title: '짧게 답하기', content: 'Keep replies short.', enabled: false, at: 2 },
    { id: 'pc', title: '날씨 묘사', content: 'Mention the weather.', enabled: true, at: 3 },
    { id: 'pd', title: '대사 늘리기', content: 'More dialogue.', enabled: true, at: 4 },
];
const fresh = (over = {}) => {
    ext.jeongaejisi = { extensionEnabled: true, direction: { enabled: false, content: '' }, always: { enabled: false, content: '' }, directionPrompt: 'D {{direction}}', promptDepth: 1, presets: [], history: { direction: [], always: [] }, promptList: rows(), ...over };
    m.initSettings();
    return m.settings();
};
const ids = () => m.settings().promptList.map(item => item.id);
const send = () => { const chat = [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }]; m.trackGeneration('normal'); m.injectDirection({ chat }); return chat.map(x => x.content); };

await test('movePrompt: 옮기면 true · 같은 자리 · 범위 밖 · 정수 아님 · 배열 아님은 false 이고 목록 그대로', () => {
    const list = ['a', 'b', 'c', 'd'];
    assert.equal(m.movePrompt(list, 0, 2), true); assert.deepEqual(list, ['b', 'c', 'a', 'd']);
    assert.equal(m.movePrompt(list, 3, 0), true); assert.deepEqual(list, ['d', 'b', 'c', 'a']);
    for (const [from, to] of [[1, 1], [-1, 0], [0, 4], [4, 0], [0.5, 1], [0, Number.NaN], ['0', 1]]) {
        assert.equal(m.movePrompt(list, from, to), false, `${from} → ${to}`);
    }
    assert.deepEqual(list, ['d', 'b', 'c', 'a']);
    assert.equal(m.movePrompt(null, 0, 1), false);
});

await test('dropSlot: 끄는 줄 가운데가 이웃 줄 가운데를 넘어야 그 자리 · 펼친(높은) 줄도 · 끝을 넘어도 첫 · 끝 자리', () => {
    // 44px 줄 넷, 사이 6px — 하나는 펼쳐 120px
    const slots = [{ top: 0, height: 44 }, { top: 50, height: 44 }, { top: 100, height: 120 }, { top: 226, height: 44 }];
    assert.equal(m.dropSlot(slots, 0, 0), 0);
    assert.equal(m.dropSlot(slots, 0, 49), 0, 'center 71 < next center 72');
    assert.equal(m.dropSlot(slots, 0, 51), 1);
    assert.equal(m.dropSlot(slots, 0, 137), 1, 'tall row center 160 not yet passed');
    assert.equal(m.dropSlot(slots, 0, 141), 2);
    assert.equal(m.dropSlot(slots, 0, 9999), 3);
    assert.equal(m.dropSlot(slots, 3, -9999), 0);
    assert.equal(m.dropSlot(slots, 3, -87), 3, 'center 161 > tall row center 160');
    assert.equal(m.dropSlot(slots, 3, -89), 2);
    assert.equal(m.dropSlot(slots, 2, -89), 1, 'tall row dragged up past the 72 line');
    assert.equal(m.dropSlot(slots, 2, -87), 2);
    assert.equal(m.dropSlot(slots, 9, 10), 9, 'unknown row stays');
});

await test('저장되는 곳 = promptList 순서 = 보내는 순서 (항상 지시 → 켠 프롬프트 목록 순서 → 전개 지시), 끈 줄은 자리만 옮김', () => {
    const s = fresh({ always: { enabled: true, content: 'ALWAYS' }, direction: { enabled: true, content: 'next' } });
    assert.deepEqual(send(), ['u1', 'ALWAYS', 'Polish the prose.', 'Mention the weather.', 'More dialogue.', 'D next', 'a1']);
    assert.equal(m.movePrompt(s.promptList, 3, 0), true);
    assert.deepEqual(ids(), ['pd', 'pa', 'pb', 'pc']);
    assert.deepEqual(send(), ['u1', 'ALWAYS', 'More dialogue.', 'Polish the prose.', 'Mention the weather.', 'D next', 'a1']);
    // 저장된 설정을 다시 읽어도(새로고침) 그 순서 · 내용 · 켜짐 그대로
    const saved = JSON.parse(JSON.stringify(ext.jeongaejisi));
    ext.jeongaejisi = saved; m.initSettings();
    assert.deepEqual(ids(), ['pd', 'pa', 'pb', 'pc']);
    assert.deepEqual(m.settings().promptList.map(p => [p.title, p.enabled]), [['대사 늘리기', true], ['문체 다듬기', true], ['짧게 답하기', false], ['날씨 묘사', true]]);
});

await test('예전 설정(7.7.4): 새 칸 없이 그대로 읽고 순서 · 값이 바뀌지 않음 (두 번 읽어도 같음)', () => {
    const s = fresh();
    assert.deepEqual(ids(), ['pa', 'pb', 'pc', 'pd']);
    assert.deepEqual(Object.keys(s.promptList[0]).sort(), ['at', 'content', 'enabled', 'id', 'title']);
    const once = structuredClone(s); m.initSettings(); assert.deepEqual(m.settings(), once);
    assert.equal('promptOrder' in s, false, 'order lives in the list itself, no extra field');
});

await test('키보드 Alt+↑/↓: 한 칸씩 · 끝에서는 그대로 · 저장 한 번 · 고치는 줄 · 입력칸 · Alt 없는 화살표는 손대지 않음', () => {
    fresh();
    const key = (id, keyName, { altKey = true, ctrlKey = false, field = false, editing = false } = {}) => {
        let prevented = false;
        const row = { dataset: { id }, classList: { contains: name => name === 'is-editing' && editing } };
        const target = { dataset: { pact: 'expand' }, matches: () => field, closest: () => row };
        const handled = m.onPromptsReorderKey({ key: keyName, altKey, ctrlKey, metaKey: false, target, preventDefault: () => { prevented = true; } });
        return { handled, prevented };
    };
    probe.saves = 0;
    assert.deepEqual(key('pc', 'ArrowUp'), { handled: true, prevented: true });
    assert.deepEqual(ids(), ['pa', 'pc', 'pb', 'pd']); assert.equal(probe.saves, 1);
    key('pc', 'ArrowDown'); key('pc', 'ArrowDown');
    assert.deepEqual(ids(), ['pa', 'pb', 'pd', 'pc']);
    assert.deepEqual(key('pc', 'ArrowDown'), { handled: true, prevented: true }, 'last row: swallowed, nothing moves');
    assert.deepEqual(ids(), ['pa', 'pb', 'pd', 'pc']); assert.equal(probe.saves, 3);
    assert.deepEqual(key('pa', 'ArrowDown', { altKey: false }), { handled: false, prevented: false });
    assert.deepEqual(key('pa', 'ArrowDown', { ctrlKey: true }), { handled: false, prevented: false });
    assert.deepEqual(key('pa', 'ArrowDown', { field: true }), { handled: false, prevented: false }, 'text fields keep Alt+arrows');
    assert.deepEqual(key('pa', 'ArrowDown', { editing: true }), { handled: false, prevented: false });
    assert.deepEqual(key('pa', 'ArrowLeft'), { handled: false, prevented: false });
    assert.deepEqual(ids(), ['pa', 'pb', 'pd', 'pc']); assert.equal(probe.saves, 3);
});

await test('펼친 줄의 ↑ ↓ 단추도 같은 옮기기로 (끝에서는 그대로)', async () => {
    fresh();
    const click = async (id, act) => {
        const row = { dataset: { id } };
        const target = { dataset: { pact: act }, disabled: false, closest: sel => (sel === '.jj-pitem' ? row : null) };
        await m.onPromptsClick({ target: { closest: () => target } });
    };
    // popup 이 없으면 onPromptsClick 은 아무것도 안 한다 — 연결만 글로 확인
    await click('pa', 'down');
    assert.deepEqual(ids(), ['pa', 'pb', 'pc', 'pd'], 'no popup: no-op');
    assert.match(js, /const to = index \+ \(act === 'up' \? -1 : 1\);\s*if \(!movePrompt\(list, index, to\)\) return;\s*save\(\);/);
});

await test('기기 간 합치기: 이 기기에서 바꾼 순서는 옛 순서의 서버 목록과 합쳐도 그대로 (합치기는 이 기기 순서를 따른다)', () => {
    const s = fresh();
    m.movePrompt(s.promptList, 0, 3);
    const server = { promptList: rows(), promptListGone: {} };
    mergeLists(s, server, [{ field: 'promptList', gone: 'promptListGone', stamp: item => item?.updated || item?.at }], 1_800_000_000_000);
    assert.deepEqual(ids(), ['pb', 'pc', 'pd', 'pa']);
    // 다른 기기에서 더한 줄은 그 기기 차례의 이웃 뒤에 들어온다 (예전 그대로)
    const more = { promptList: [...rows(), { id: 'pe', title: '새 줄', content: 'New.', enabled: false, at: 5 }] };
    mergeLists(s, more, [{ field: 'promptList', gone: 'promptListGone', stamp: item => item?.updated || item?.at }], 1_800_000_000_000);
    assert.deepEqual(ids(), ['pb', 'pc', 'pd', 'pe', 'pa']);
});

await test('화면 연결: 꾹 누르기 400ms · 움직이면 취소 · 끄는 동안만 목록 스크롤 막기 · 진동은 지원할 때만 · click 삼키기 · Esc · 닫기 · CSS', async () => {
    assert.equal(m.HOLD_MS, 400); assert.equal(m.HOLD_SLOP, 8);
    assert.match(js, /promptsBox\.addEventListener\('pointerdown', onPromptsPointerDown\);/);
    assert.match(js, /\.jj-pitems'\)\.addEventListener\('touchmove', event => \{ if \(promptDrag && event\.cancelable\) event\.preventDefault\(\); \}, \{ passive: false \}\);/, 'touchmove blocks scroll only while dragging');
    assert.match(js, /if \(press\.type !== 'mouse'\) \{ try \{ navigator\.vibrate\?\.\(15\); \} catch/, 'vibrate only on touch and only if supported');
    assert.match(js, /const head = event\.target\.closest\?\.\('\.jj-pitem-head'\);[\s\S]*?row\.classList\.contains\('is-editing'\)/, 'only the row head, never while editing');
    assert.match(js, /\} else if \(Math\.hypot\(dx, dy\) > HOLD_SLOP\) \{\s*cancelPromptPress\(\);/, 'finger moved before the hold: scroll');
    assert.match(js, /promptClickMute = Date\.now\(\) \+ 600;/);
    assert.match(js, /promptsBox\.addEventListener\('click', event => \{\s*if \(Date\.now\(\) > promptClickMute\) return;/, 'click after a drag is swallowed (capture)');
    assert.match(js, /if \(promptDrag\) endPromptDrag\(false\);\s*\/\/ 1\.3\.6 끄는 중이면 제자리로만/, 'Esc puts it back');
    assert.match(js, /function closePopup\(\) \{\s*if \(!popup\) return;\s*endPromptDrag\(false\);/);
    assert.match(js, /if \(promptDrag\) endPromptDrag\(false\);\s*\/\/ 1\.3\.6 끄는 중에 목록이 바뀌면/, 'redraw during a drag cancels it');
    assert.match(js, /toggle\.setAttribute\('aria-keyshortcuts', 'Alt\+ArrowUp Alt\+ArrowDown'\);/);
    assert.match(js, /<p class="jj-plive" aria-live="polite"><\/p>/);
    const css = await read('src/addons/direction/style.css');
    assert.match(css, /\.jj-pitem-head \{ -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; \}/);
    const lifted = css.match(/\.jj-pitem\.is-dragging \{([^}]*)\}/)?.[1] ?? '';
    assert.match(lifted, /background: var\(--salty-surface, var\(--SmartThemeBlurTintColor\)\);/, 'opaque theme surface (light)');
    assert.match(css, /body\.salty-dark \.jj-pitem\.is-dragging \{ background: var\(--bl-control, var\(--salty-raised\)\); \}/, 'opaque theme button face (dark)');
    assert.match(lifted, /var\(--bl-e3,/, 'theme shadow');
    assert.doesNotMatch(lifted, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|scale\(|width|height|margin|padding/i, 'theme variables only, same size and place');
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\}\s*\.jj-pitems\.is-sorting > \.jj-pitem, \.jj-pitem\.is-settling \{ transition: none; \}/, 'reduced motion: no slide');
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/direction-reorder\.mjs \./, 'registered in CI');
});

console.log(`direction-reorder: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
