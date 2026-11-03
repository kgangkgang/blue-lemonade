// 6.2.6 웹 검색을 쓴 답 표시 · 낱말 꾹 눌러 출처 찾기 — 순수 함수 검사 (응답 흔적 · 블록 이름표 · 낱말 찾기 · 설정 off · 등록) + 1.0.0 꾹 누르기 동작(기록 없으면 가로채지 않음)
//   node tools/tests/websearch-mark.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const core = await import(pathToFileURL(path.join(root, 'src/websearch-core.js')));
const { WEBSEARCH_KEY, SETTING_KEY, KIND_ORDER, webSearchEvidence, buildOrigin, makeChatIndex, wordAt, stemKorean, searchKeys, findOrigins, chipText,
    marksEnabled, labelExtensionPrompt, enabledPromptIds, signatures, textOf, originSize, trimOrigins, ORIGIN_KEEP } = core;

const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }

// ── 응답 흔적 ──
await test('Claude stream: server_tool_use web_search · web_search_tool_result · usage.server_tool_use are evidence, text deltas are not', () => {
    assert.equal(webSearchEvidence({ type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} } }), 'claude');
    assert.equal(webSearchEvidence({ type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] } }), 'claude');
    assert.equal(webSearchEvidence({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10, server_tool_use: { web_search_requests: 1 } } }), 'claude');
    assert.equal(webSearchEvidence({ type: 'message_start', message: { usage: { input_tokens: 5, server_tool_use: { web_search_requests: 2 } } } }), 'claude');
    assert.equal(webSearchEvidence({ type: 'message_start', message: { usage: { input_tokens: 5, server_tool_use: { web_search_requests: 0 } } } }), null);
    assert.equal(webSearchEvidence({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'web_search' } }), null);
    assert.equal(webSearchEvidence({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }), null);
    assert.equal(webSearchEvidence({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'web_search', input: {} } }), null, 'a client tool is not a server search');
    assert.equal(webSearchEvidence({ type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'x', name: 'code_execution', input: {} } }), null, 'other server tools are not web search');
    assert.equal(webSearchEvidence({ type: 'message_stop' }), null);
    assert.equal(webSearchEvidence(null), null);
    assert.equal(webSearchEvidence('data'), null);
});

await test('Claude non-stream: the ST wrapper (choices + content) and the raw message both count', () => {
    const content = [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'x' } }, { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] }, { type: 'text', text: '답' }];
    assert.equal(webSearchEvidence({ choices: [{ message: { content: '답' } }], content }), 'claude');
    assert.equal(webSearchEvidence({ type: 'message', role: 'assistant', content, usage: { input_tokens: 1, output_tokens: 1 } }), 'claude');
    assert.equal(webSearchEvidence({ choices: [{ message: { content: '답' } }], content: [{ type: 'text', text: '답' }] }), null);
    assert.equal(webSearchEvidence({ type: 'message', content: [{ type: 'text', text: 'server_tool_use' }], usage: { input_tokens: 1 } }), null);
});

await test('other providers: url_citation annotations, Responses web_search_call, Gemini grounding, citations', () => {
    assert.equal(webSearchEvidence({ choices: [{ message: { content: 'x', annotations: [{ type: 'url_citation', url_citation: { url: 'https://example.com' } }] } }] }), 'openai');
    assert.equal(webSearchEvidence({ choices: [{ delta: { content: 'x', annotations: [{ type: 'url_citation' }] } }] }), 'openai');
    assert.equal(webSearchEvidence({ choices: [{ delta: { content: 'x' } }] }), null);
    assert.equal(webSearchEvidence({ output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [] }] }), 'openai');
    assert.equal(webSearchEvidence({ type: 'response.output_item.added', item: { type: 'web_search_call' } }), 'openai');
    assert.equal(webSearchEvidence({ type: 'response.web_search_call.completed' }), 'openai');
    assert.equal(webSearchEvidence({ type: 'response.output_text.delta', delta: 'web_search_call' }), null);
    assert.equal(webSearchEvidence({ candidates: [{ content: { parts: [{ text: 'x' }] }, groundingMetadata: { webSearchQueries: ['q'] } }] }), 'gemini');
    assert.equal(webSearchEvidence({ candidates: [{ content: { parts: [{ text: 'x' }] }, groundingMetadata: { groundingChunks: [{ web: {} }] } }] }), 'gemini');
    assert.equal(webSearchEvidence({ candidates: [{ content: { parts: [{ text: 'x' }] }, groundingMetadata: {} }] }), null);
    assert.equal(webSearchEvidence({ choices: [{ message: { content: 'x' } }], citations: ['https://example.com'] }), 'citations');
    assert.equal(webSearchEvidence({ choices: [{ message: { content: 'x' } }], citations: [] }), null);
});

// ── 블록 이름표 ──
const lore = '천사 계급은 셋이다. 세라핌 · 케루빔 · 좌품천사. 가장 위는 세라핌이고, 좌품천사는 심판을 맡는다.';
const card = '{{char}} 는 높은 탑의 사서다. 책과 별을 좋아한다. 말수가 적고 차분하다. 손님에게는 늘 차를 권한다.';
const preset = 'You are a storyteller. Write vivid prose in third person. Keep replies under 400 words. Never speak for the user.';
const memory = '요약: 지난 밤 두 사람은 탑 꼭대기에서 별을 보았다.';
const sources = [
    { kind: '프리셋', name: 'Main', text: preset },
    { kind: '프리셋', name: 'Unused', text: 'This prompt was disabled and never sent anywhere at all, so it must not become a block.' },
    { kind: '카드', name: '설명', text: card.replace('{{char}}', '루') },
    { kind: '로어북', name: '천사 계급', text: lore },
    { kind: '기억', name: '', text: memory },
    { kind: '지시', name: '전개', text: '지시: 비가 오기 시작한다 — 이 지시를 따라 장면을 이어 간다.' },
];
const chat = [
    { mes: '안녕, 오늘은 뭘 읽어?', is_user: true },
    { mes: '루는 책장을 넘기며 고개를 들었다. 「별자리 이야기.」', is_user: false },
    { mes: '천사 계급이 뭐야?', is_user: true },
];
const sent = [
    { role: 'system', content: preset },
    { role: 'system', content: card.replace('{{char}}', '루') + '\n' + lore },
    { role: 'system', content: memory },
    { role: 'system', content: '지시: 비가 오기 시작한다 — 이 지시를 따라 장면을 이어 간다.' },
    { role: 'system', name: 'example_user', content: '예시 질문이야' },
    { role: 'user', content: '안녕, 오늘은 뭘 읽어?' },
    { role: 'assistant', content: '루는 책장을 넘기며 고개를 들었다. 「별자리 이야기.」' },
    { role: 'user', content: [{ type: 'text', text: '루: 천사 계급이 뭐야?' }, { type: 'image_url', image_url: { url: 'data:...' } }] },
    { role: 'system', content: 'Continue the story following the instructions above.' },
];
const blocks = buildOrigin(sent, sources, makeChatIndex(chat));

await test('buildOrigin: only sources that were really sent become blocks, in kind order; history gets message numbers', () => {
    const labels = blocks.map(b => (b.name ? `${b.kind} · ${b.name}` : b.kind));
    assert.deepEqual(labels, ['카드 · 설명', '카드 · 예시 대화', '로어북 · 천사 계급', '기억', '지시 · 전개', '프리셋 · Main', '기록 · #0', '기록 · #1', '기록 · #2', '프롬프트']);
    assert.ok(!labels.includes('프리셋 · Unused'), 'disabled prompt is not a block');
    assert.equal(blocks.find(b => b.kind === '프롬프트').text, 'Continue the story following the instructions above.', 'uncovered system text stays searchable');
    const ranks = blocks.map(b => KIND_ORDER.indexOf(b.kind));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

await test('buildOrigin: the direction system message is covered by its block (no extra 프롬프트 block), image parts are dropped, name prefix is stripped for history', () => {
    assert.equal(blocks.filter(b => b.kind === '프롬프트').length, 1);
    assert.equal(blocks.find(b => b.name === '#2').text, '루: 천사 계급이 뭐야?');
    assert.equal(textOf([{ type: 'text', text: 'a' }, { type: 'image_url' }, 'b']), 'a\nb');
    assert.deepEqual(buildOrigin([], sources, new Map()), []);
    assert.deepEqual(buildOrigin([{ role: 'user', content: '' }], [], null), []);
    assert.deepEqual(buildOrigin([{ role: 'user', content: 'x' }], [], null), [{ kind: '기록', name: '', text: 'x' }], 'no chat index → history without number');
});

await test('buildOrigin: a mostly uncovered squashed system message still becomes a 프롬프트 block', () => {
    const big = 'A'.repeat(400) + ' ' + preset;
    const out = buildOrigin([{ role: 'system', content: big }], [{ kind: '프리셋', name: 'Main', text: preset }], new Map());
    assert.deepEqual(out.map(b => b.kind), ['프리셋', '프롬프트']);
    const small = preset + ' tail.';
    assert.deepEqual(buildOrigin([{ role: 'system', content: small }], [{ kind: '프리셋', name: 'Main', text: preset }], new Map()).map(b => b.kind), ['프리셋']);
});

await test('signatures: short texts whole, long texts first 40 + next 40; under 4 chars none', () => {
    assert.deepEqual(signatures('  짧은  글 '), ['짧은 글']);
    assert.deepEqual(signatures('abc'), []);
    const long = 'x'.repeat(100);
    assert.deepEqual(signatures(long), ['x'.repeat(40), 'x'.repeat(40)]);
    assert.deepEqual(signatures('y'.repeat(50)), ['y'.repeat(40)]);
});

await test('labelExtensionPrompt: core keys get names, memory-like keys say only 기억, quiet/story string are skipped', () => {
    assert.deepEqual(labelExtensionPrompt('1_memory'), { kind: '기억', name: '요약' });
    assert.deepEqual(labelExtensionPrompt('2_floating_prompt'), { kind: '작가의 노트', name: '' });
    assert.deepEqual(labelExtensionPrompt('3_vectors'), { kind: '기억', name: '벡터' });
    assert.deepEqual(labelExtensionPrompt('DEPTH_PROMPT_2'), { kind: '카드', name: '캐릭터 노트' });
    assert.deepEqual(labelExtensionPrompt('customDepthWI_4_0'), { kind: '로어북', name: '' });
    assert.deepEqual(labelExtensionPrompt('script_inject_x'), { kind: '프롬프트', name: '주입' });
    assert.deepEqual(labelExtensionPrompt('some_memory_ledger'), { kind: '기억', name: '' });
    assert.deepEqual(labelExtensionPrompt('7_other_ext'), { kind: '확장', name: 'other_ext' });
    assert.equal(labelExtensionPrompt('QUIET_PROMPT'), null);
    assert.equal(labelExtensionPrompt('__STORY_STRING__'), null);
    assert.equal(labelExtensionPrompt(''), null);
});

await test('enabledPromptIds: the character entry wins, then the default entry; no order → null (all)', () => {
    const order = [{ character_id: 100001, order: [{ identifier: 'main', enabled: true }, { identifier: 'nsfw', enabled: false }] }, { character_id: 3, order: [{ identifier: 'main', enabled: false }, { identifier: 'custom', enabled: true }] }];
    assert.deepEqual([...enabledPromptIds(order, 3)], ['custom']);
    assert.deepEqual([...enabledPromptIds(order, '3')], ['custom']);
    assert.deepEqual([...enabledPromptIds(order, 9)], ['main']);
    assert.equal(enabledPromptIds([], 1), null);
    assert.equal(enabledPromptIds(undefined, 1), null);
});

// ── 낱말 ──
await test('wordAt: letters/digits/Hangul run; caret right after a word still picks it; punctuation and spaces split', () => {
    assert.deepEqual(wordAt('천사 계급은 셋이다.', 4), { word: '계급은', start: 3, end: 6 });
    assert.deepEqual(wordAt('천사 계급은 셋이다.', 0), { word: '천사', start: 0, end: 2 });
    assert.deepEqual(wordAt('천사 계급은 셋이다.', 2), { word: '천사', start: 0, end: 2 }, 'caret after the word');
    assert.equal(wordAt('천사 계급은', 3 - 1 + 0) !== null, true);
    assert.deepEqual(wordAt('Go to Valladolid, now', 8), { word: 'Valladolid', start: 6, end: 16 });
    assert.deepEqual(wordAt('「별자리 이야기.」', 1), { word: '별자리', start: 1, end: 4 });
    assert.equal(wordAt('a . b', 2), null, 'caret on punctuation with no word before it');
    assert.equal(wordAt('', 0), null);
    assert.equal(wordAt('abc', 99)?.word, 'abc');
    assert.equal(wordAt('v2_beta', 3)?.word, 'v2_beta');
});

await test('stemKorean / searchKeys: one trailing particle, never below two characters, Latin untouched, lower-cased keys', () => {
    assert.equal(stemKorean('천사의'), '천사');
    assert.equal(stemKorean('계급을'), '계급');
    assert.equal(stemKorean('서울에서는'), '서울');
    assert.equal(stemKorean('사무엘이'), '사무엘');
    assert.equal(stemKorean('하나'), '하나', 'stem would be one character');
    assert.equal(stemKorean('은'), '은');
    assert.equal(stemKorean('Valladolid'), 'Valladolid');
    assert.equal(stemKorean('탑'), '탑');
    assert.deepEqual(searchKeys('천사의'), ['천사의', '천사']);
    assert.deepEqual(searchKeys('Valladolid'), ['valladolid']);
    assert.deepEqual(searchKeys('a'), []);
    assert.deepEqual(searchKeys('  '), []);
});

await test('findOrigins: kind order, de-duplicated labels, at most 3, case-insensitive, particle-stripped match', () => {
    assert.deepEqual(findOrigins(blocks, '천사'), ['로어북 · 천사 계급', '기록 · #2']);
    assert.deepEqual(findOrigins(blocks, '계급이'), ['로어북 · 천사 계급', '기록 · #2'], '계급이 → 계급');
    assert.deepEqual(findOrigins(blocks, '루는'), ['기록 · #1'], '루는 → stem 루 is one character, so only the literal match');
    const many = ['a', 'b', 'c', 'd'].map(name => ({ kind: '기록', name, text: 'xx yy' }));
    assert.deepEqual(findOrigins(many, 'xx'), ['기록 · a', '기록 · b', '기록 · c'], 'capped at three');
    assert.deepEqual(findOrigins(blocks, 'STORYTELLER'), ['프리셋 · Main']);
    assert.deepEqual(findOrigins(blocks, '비가'), ['지시 · 전개']);
    assert.deepEqual(findOrigins(blocks, '꼬부랑'), []);
    assert.deepEqual(findOrigins(blocks, '별'), [], 'one character is too short');
    assert.deepEqual(findOrigins(null, '천사'), []);
    const dup = [{ kind: '로어북', name: '같은 이름', text: '천사' }, { kind: '로어북', name: '같은 이름', text: '천사 둘' }, { kind: '기록', name: '', text: '천사' }];
    assert.deepEqual(findOrigins(dup, '천사'), ['로어북 · 같은 이름', '기록']);
});

await test('chipText: translated display with nothing found → 번역문 · 못 찾음 (never 지어냄); labels still win', () => {
    assert.equal(chipText([], { searched: true, hasRecord: true, translated: true }), '번역문 · 못 찾음');
    assert.equal(chipText([], { searched: false, hasRecord: true, translated: true }), '번역문 · 못 찾음');
    assert.equal(chipText([], { hasRecord: false, translated: true }), '기록 없음');
    assert.equal(chipText(['로어북 · 천사 계급'], { translated: true }), '로어북 · 천사 계급');
    const ui = read('src/websearch.js');
    assert.match(ui, /if \(!word \|\| !searchKeys\(word\)\.length\) return null;/, '1자 낱말 · 숫자 한 자리는 칩 없음');
    assert.match(ui, /translated: showingTranslation\(mes, text\)/, '번역문 보기 판정을 칩 글에 넘긴다');
    assert.match(ui, /function showingTranslation\(mes, text\)/);
    // F1: 길게 누르기 신호(contextmenu)를 막지 않는다 — 브라우저의 낱말 고르기가 살아야 글 고르기로 도는 기능이 AI 답 안에서도 된다
    const menu = ui.match(/function onContextMenu\(event\) \{[\s\S]*?\n\}\n/)?.[0] || '';
    assert.ok(menu && !/preventDefault/.test(menu), 'contextmenu 에 preventDefault 없음');
    assert.match(ui, /hadSelection: selecting\(\)/, '누르기 전부터 있던 선택만 칩을 막는다');
    assert.match(ui, /showChip\(label, p\.x, p\.y, p\.touch\)/, '터치는 칩을 손가락 아래에');
});

await test('chipText: labels joined with " / ", else 기록 없음 / 검색/지어냄 / 지어냄', () => {
    assert.equal(chipText(['로어북 · 천사 계급', '기록 · #2']), '로어북 · 천사 계급 / 기록 · #2');
    assert.equal(chipText(['a', 'b', 'c', 'd']), 'a / b / c');
    assert.equal(chipText([], { searched: true, hasRecord: true }), '검색/지어냄');
    assert.equal(chipText([], { searched: false, hasRecord: true }), '지어냄');
    assert.equal(chipText([], { searched: true, hasRecord: false }), '기록 없음');
    assert.equal(chipText(null, { hasRecord: false }), '기록 없음');
});

// ── 기억 크기 ──
await test('originSize / trimOrigins: oldest records go first until both the count and the character budget fit', () => {
    const rec = n => ({ sent: [{ text: 'x'.repeat(n) }], sources: [{ text: 'y'.repeat(n) }] });
    assert.equal(originSize(rec(10)), 20);
    const map = new Map();
    for (let i = 0; i < 30; i++) { const r = rec(10); r.size = originSize(r); map.set('k' + i, r); }
    trimOrigins(map);
    assert.equal(map.size, ORIGIN_KEEP.entries);
    assert.deepEqual([...map.keys()].slice(0, 2), ['k6', 'k7']);
    const big = new Map();
    for (let i = 0; i < 3; i++) big.set('b' + i, { size: 900_000 });
    trimOrigins(big);
    assert.deepEqual([...big.keys()], ['b1', 'b2']);
});

// ── 설정 off ──
await test('marksEnabled: on unless chat.webSearchMarks is exactly false', () => {
    assert.equal(marksEnabled({ chat: {} }), true);
    assert.equal(marksEnabled({}), true);
    assert.equal(marksEnabled(undefined), true);
    assert.equal(marksEnabled({ chat: { [SETTING_KEY]: true } }), true);
    assert.equal(marksEnabled({ chat: { [SETTING_KEY]: false } }), false);
});

// ── 꾹 누르기 동작 (1.0.0: 출처 기록이 없는 답은 누르기를 보지 않아요) — 작은 가짜 DOM 으로 src/websearch.js 를 그대로 돌려요 ──
//   websearch.js 를 임시 폴더에 옮기고 settings · usage-mode · name-aliases 만 흉내(나머지는 진짜 websearch-core.js)
const hold = await (async () => {
    const os = await import('node:os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-websearch-hold-'));
    fs.copyFileSync(path.join(root, 'src/websearch.js'), path.join(dir, 'websearch.js'));
    fs.copyFileSync(path.join(root, 'src/websearch-core.js'), path.join(dir, 'websearch-core.js'));
    fs.writeFileSync(path.join(dir, 'settings.js'), 'export const getSettings = () => globalThis.__wsSettings;\n');
    fs.writeFileSync(path.join(dir, 'usage-mode.js'), 'export const themeEnabled = () => true;\n');
    fs.writeFileSync(path.join(dir, 'name-aliases.js'), 'export const nameAliases = () => [];\n');
    globalThis.__wsSettings = { chat: {} };
    const listeners = new Map();   // window 이벤트
    const on = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
    const off = (type, fn) => listeners.get(type)?.delete(fn);
    const emit = (type, event) => { for (const fn of [...(listeners.get(type) || [])]) fn(event); return event; };
    class FakeElement {}
    globalThis.Element = FakeElement;
    const node = { nodeType: 3, nodeValue: '세라피나는 바다를 본 적이 없어요' };
    const mesEl = Object.assign(new FakeElement(), { getAttribute: k => (k === 'mesid' ? String(mesEl.id) : k === 'is_user' ? 'false' : null), id: 1 });
    const textEl = Object.assign(new FakeElement(), {
        closest: sel => (sel === '.mes_text' ? textEl : sel.startsWith('#chat .mes') ? mesEl : null),
        contains: n => n === node,
        getBoundingClientRect: () => ({ top: 100 }),
        textContent: node.nodeValue,
    });
    const body = [];
    const makeEl = () => ({ style: {}, offsetWidth: 80, offsetHeight: 24, setAttribute() {}, remove() { const i = body.indexOf(this); if (i >= 0) body.splice(i, 1); } });
    let caretOffset = 2;
    globalThis.document = {
        querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: makeEl,
        body: { append: el => body.push(el) }, documentElement: { clientWidth: 384 },
        addEventListener() {}, removeEventListener() {},
        caretRangeFromPoint: () => ({ startContainer: node, startOffset: caretOffset }),
    };
    globalThis.window = { addEventListener: on, removeEventListener: off, innerHeight: 800, getSelection: () => ({ isCollapsed: true }) };
    globalThis.CSS = { escape: s => s };
    let buzz = 0;
    Object.defineProperty(globalThis, 'navigator', { value: { vibrate: () => { buzz++; return true; } }, configurable: true, writable: true });
    const st = new Map();   // 실리태번 이벤트
    const chat = [{ is_user: true, mes: '안녕', extra: {} }, { is_user: false, mes: node.nodeValue, extra: {} }, { is_user: false, mes: '다른 답', extra: {} }];
    let chatId = 'chat-a';
    const types = Object.fromEntries(['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'WORLD_INFO_ACTIVATED', 'CHAT_COMPLETION_PROMPT_READY', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'CHAT_CHANGED', 'MESSAGE_DELETED', 'MORE_MESSAGES_LOADED'].map(k => [k, k]));
    const context = { chat, characters: [], characterId: undefined, eventTypes: types, getCurrentChatId: () => chatId,
        eventSource: { on: (name, fn) => { if (!st.has(name)) st.set(name, []); st.get(name).push(fn); } } };
    globalThis.SillyTavern = { getContext: () => context };
    const fireST = (name, ...args) => { for (const fn of st.get(name) || []) fn(...args); };
    const ws = await import(pathToFileURL(path.join(dir, 'websearch.js')).href);
    ws.startWebSearchMarks();
    const record = (id = 1) => {   // 생성 한 번: 보낸 프롬프트 → 답 id
        fireST('GENERATION_STARTED', 'normal', {}, false);
        fireST('CHAT_COMPLETION_PROMPT_READY', { chat: [{ role: 'system', content: '세라피나는 숲을 지키는 수호자예요' }, { role: 'user', content: '안녕' }], dryRun: false });
        fireST('MESSAGE_RECEIVED', id, 'normal');
    };
    let pid = 0;
    const ev = (extra = {}) => ({ pointerId: pid, isPrimary: true, pointerType: 'touch', button: 0, clientX: 50, clientY: 120, target: textEl, isTrusted: true,
        prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const hideAll = () => { ws.hideChip(); body.length = 0; };
    /** 한 번 꾹 누르기: via 'timer'(0.5초) · 'menu'(폰 contextmenu) → 무엇이 일어났나 */
    async function longPress({ id = 1, via = 'timer', during } = {}) {
        mesEl.id = id;
        pid++;
        hideAll();
        const before = buzz;
        emit('pointerdown', ev());
        const watching = (listeners.get('pointermove')?.size || 0) > 0;
        during?.();
        const menu = ev();
        if (via === 'menu') emit('contextmenu', menu);
        else await sleep(560);
        emit('pointerup', ev());
        const click = emit('click', ev());
        return { watching, buzz: buzz - before, chip: body.length ? body[0].textContent : null, clickEaten: click.prevented || click.stopped, menuBlocked: menu.prevented };
    }
    return { ws, record, longPress, fireST, setChat: v => { chatId = v; }, setCaret: v => { caretOffset = v; }, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
})();

await test('hold: no origin record (reloaded chat) → no watch, no vibration, no chip, click passes, context menu untouched', async () => {
    assert.equal(hold.ws.originCount(), 0);
    for (const via of ['timer', 'menu']) {
        const r = await hold.longPress({ via });
        assert.deepEqual(r, { watching: false, buzz: 0, chip: null, clickEaten: false, menuBlocked: false }, via);
    }
});

await test('hold: with a record the chip and vibration work as before (found → label, not found → 지어냄), and only that click is eaten', async () => {
    hold.record(1);
    assert.equal(hold.ws.originCount(), 1);
    hold.setCaret(2);   // 「세라피나는」
    for (const via of ['timer', 'menu']) {
        const r = await hold.longPress({ via });
        assert.deepEqual(r, { watching: true, buzz: 1, chip: '프롬프트', clickEaten: true, menuBlocked: false }, via);
    }
    hold.setCaret(7);   // 「바다를」 — 보낸 프롬프트에 없는 말
    const r = await hold.longPress({ via: 'menu' });
    assert.deepEqual(r, { watching: true, buzz: 1, chip: '지어냄', clickEaten: true, menuBlocked: false });
    hold.setCaret(2);
});

await test('hold: another answer without a record, a different chat, or a record dropped mid-press → nothing intercepted', async () => {
    const quiet = { buzz: 0, chip: null, clickEaten: false, menuBlocked: false };
    const strip = ({ watching, ...rest }) => rest;
    assert.deepEqual(strip(await hold.longPress({ id: 2 })), quiet, 'answer #2 has no record');
    hold.setChat('chat-b');
    assert.deepEqual(strip(await hold.longPress({ id: 1 })), quiet, 'same number in another chat');
    hold.setChat('chat-a');
    const dropped = await hold.longPress({ id: 1, during: () => hold.fireST('MESSAGE_DELETED', 0) });
    assert.equal(dropped.watching, true, 'the press started while the record existed');
    assert.deepEqual(strip(dropped), quiet, 'record cleared before the hold fired');
    hold.record(1);
    hold.fireST('CHAT_CHANGED');
    assert.equal(hold.ws.originCount(), 0);
    assert.deepEqual(await hold.longPress({ id: 1, via: 'menu' }), { watching: false, ...quiet }, 'reloaded chat');
    hold.cleanup();
});

// ── 등록 (설정 · 화면 · CSS · CI) ──
await test('setting is registered everywhere the 6.1.5 helpMarks switch is, plus the body class and CSS', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /helpMarks: true, webSearchMarks: true, personaTall: false/, 'DEFAULTS.chat');
    assert.match(settings, /s\.chat\.webSearchMarks = flag\(s\.chat\.webSearchMarks, true\)/, 'upgrade flag');
    assert.match(settings, /'helpMarks', 'webSearchMarks', 'personaTall'/, 'preserved across style resets');
    assert.match(read('src/styles.js'), /'helpMarks', 'webSearchMarks', 'personaTall'/, 'CHAT_BEHAVIOR');
    assert.match(read('src/settings-labels.js'), /"chat\.webSearchMarks":"웹 검색 · 출처 표시"/);
    assert.match(read('src/settings-search.js'), /'chat\.webSearchMarks'\]/);
    assert.match(read('src/panel.js'), /toggle\('chat\.webSearchMarks', s\.chat\.webSearchMarks !== false\)/);
    assert.match(read('src/apply.js'), /if \(s\.chat\.webSearchMarks === false\) want\.add\('salty-websearch-off'\)/);
    const css = read('css/69-websearch.css');
    assert.match(css, /body\.salty\.salty-websearch-off \.bl-websearch \{ display: none; \}/, 'off rule outranks the on rule (0,3,1 > 0,2,1)');
    assert.match(css, /body:not\(\.salty\) \.bl-origin-chip/);
    assert.match(css, /\.bl-origin-chip \{[^}]*position: fixed;[^}]*pointer-events: none;/);
    assert.ok(!/:has\(/.test(css), 'no :has() in an always-on module');
    assert.ok(read('style.css').includes('.bl-origin-chip'), 'style.css was rebuilt');
});

await test('wiring: index.js starts the module, capture.js reports evidence, CI runs this test, no forbidden syllable', () => {
    const index = read('index.js');
    assert.match(index, /\['startWebSearchMarks', \(\) => import\('\.\/src\/websearch\.js'\), m => \{ m\.startWebSearchMarks\(\); \}\]/);   // 9.0.2 부팅 3층 표(IDLE_LAYER)
    const capture = read('src/addons/perf/capture.js');
    assert.match(capture, /import \{ webSearchEvidence \} from '\.\.\/\.\.\/websearch-core\.js';/);
    assert.match(capture, /import \{ noteWebSearchEvidence \} from '\.\.\/\.\.\/websearch\.js';/);
    assert.match(capture, /noteWebSearch\(json, acc\);/, 'stream chunks');
    assert.match(capture, /noteWebSearch\(data, acc\);/, 'whole responses');
    assert.match(capture, /if \(acc\.webSearch && context\.caller === 'chat'\)/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/websearch-mark\.mjs \./);
    const wiring = read('src/websearch.js');
    assert.ok(wiring.includes(`'${WEBSEARCH_KEY}'`) || wiring.includes('WEBSEARCH_KEY'), 'wiring uses the shared key');
    assert.ok(!/addEventListener\(['"]touch/.test(wiring), 'no touch listeners (6.1.9: preventing touchend kills phone taps)');
    assert.ok(!/toastr/.test(wiring), 'no toasts');
    assert.ok(!/\btitle=/.test(wiring), 'no tooltips');
    for (const file of ['src/websearch-core.js', 'src/websearch.js', 'css/69-websearch.css', 'tools/tests/websearch-mark.mjs']) assert.ok(!read(file).includes(String.fromCharCode(0xAC24)), `${file}: no forbidden syllable (U+AC24)`);
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
