// 8.0.7 프롬프트 자리 맞추기 — 작가 노트 · 전개 지시 줄을 페르소나 설명 / 캐릭터 설명 바로 위에
//   node tools/tests/prompt-anchors.mjs <테마 루트>   (공개 저장소는 '.')
// 실리태번 본체(1.19)의 조립 순서를 작게 옮긴 가짜 위에서 prompt-anchors-core.js · prompt-anchors.js · an-anchor.js(가져오기 줄만 떼고)를 그대로 돌린다.
//   채팅 완성: preparePromptsForChatCompletion(확장 프롬프트 → authorsNote 시스템 프롬프트 · 표식 바꿔치기) → populateChatCompletion(addToChatCompletion 순서,
//              Message.fromPromptAsync → ChatCompletion.add, injectToMain, 채팅 안 @깊이) → getChat
//   텍스트 완성: getExtensionPrompt(앞 · 뒤 · 채팅 안) → renderStoryString(Handlebars.compile(noEscape)) → 채팅
//   본체 작가 노트: setFloatingPrompt(삽입 빈도) → 월드 인포 AN 위 항목 합치기 → 페르소나 TOP_AN/BOTTOM_AN 합치기 (모두 extension_prompts 를 다시 씀)
// 실제 요청 본문은 리그(가짜 API)에서 따로 확인한다 — W/outputs/an-persona-pos/실제요청-확인표.md
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
const core = await import(new URL('src/prompt-anchors-core.js', url));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 8).join('\n       ')}`); }
}

// ── 본체 흉내: 채팅 완성 클래스 ─────────────────────────────
class Message {
    constructor(role, content, identifier) { this.identifier = identifier; this.role = role || 'system'; this.content = content; this.tokens = 0; }
    static async createAsync(role, content, identifier) { const m = new Message(role, content, identifier); if (typeof content === 'string' && content.length) m.tokens = content.length; return m; }
    static fromPromptAsync(prompt) { return Message.createAsync(prompt.role, prompt.content, prompt.identifier); }
    getTokens() { return this.tokens; }
}
class MessageCollection {
    collection = [];
    constructor(identifier, ...items) { this.identifier = identifier; this.collection.push(...items); }
    add(item) { this.collection.push(item); }
    getTokens() { return this.collection.reduce((n, m) => n + (m?.getTokens?.() ?? 0), 0); }
    getChat() { return this.collection.reduce((acc, m) => { if (m.content) acc.push({ role: m.role, content: m.content }); return acc; }, []); }
}
class ChatCompletion {
    messages = new MessageCollection('root');
    add(collection, position = null) {
        if (position !== null && position !== -1) this.messages.collection[position] = collection; else this.messages.collection.push(collection);
        return this;
    }
    has(id) { return this.messages.collection.some(c => c?.identifier === id); }
    insert(message, identifier, position = 'end') {
        const target = this.messages.collection.find(c => c?.identifier === identifier);
        if (!message.content) return;
        if (position === 'start') target.collection.unshift(message); else target.collection.push(message);
    }
    getChat() {
        const chat = [];
        for (const item of this.messages.collection) if (item instanceof MessageCollection) chat.push(...item.getChat());
        return chat;
    }
}

// ── 본체 흉내: 상태 ────────────────────────────────────────
const TYPES = { NONE: -1, IN_PROMPT: 0, IN_CHAT: 1, BEFORE_PROMPT: 2 };
const PERSONA_POS = { IN_PROMPT: 0, TOP_AN: 2, BOTTOM_AN: 3, AT_DEPTH: 4, NONE: 9 };
const DEFAULT_STORY = '{{#if anchorBefore}}{{anchorBefore}}\n{{/if}}{{#if system}}{{system}}\n{{/if}}{{#if wiBefore}}{{wiBefore}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{personality}}\n{{/if}}{{#if scenario}}{{scenario}}\n{{/if}}{{#if wiAfter}}{{wiAfter}}\n{{/if}}{{#if persona}}{{persona}}\n{{/if}}{{#if anchorAfter}}{{anchorAfter}}\n{{/if}}{{trim}}';
const listeners = {};
const eventSource = { on(name, fn) { (listeners[name] ??= []).push(fn); }, async emit(name, ...args) { for (const fn of listeners[name] ?? []) await fn(...args); } };
const event_types = { GENERATION_STARTED: 'generation_started', CHAT_CHANGED: 'chat_id_changed', SETTINGS_UPDATED: 'settings_updated' };
const macro = text => String(text).replace(/\{\{char\}\}/gi, () => state.group ? 'Ann, Bob' : 'Robin').replace(/\{\{user\}\}/gi, 'Me');
const state = {};
const order = () => state.order;
const promptManager = {
    activeCharacter: { id: 1 },
    getPromptOrderEntry: (_c, id) => order().find(e => e.identifier === id),
    preparePrompt: prompt => ({ ...prompt, content: macro(prompt.content ?? '') }),
};
const context = {
    get mainApi() { return state.api; },
    get chatMetadata() { return state.meta; },
    get extensionPrompts() { return state.prompts; },
    powerUserSettings: { context: { get story_string() { return state.story; } } },
    substituteParams: text => macro(text),
    saveMetadataDebounced: () => { state.metaSaves++; },
    eventSource, event_types,
};
globalThis.SillyTavern = { getContext: () => context };

// 진짜 Handlebars 대신: {{#if x}}…{{/if}} · {{x}} · {{trim}} 만
const Handlebars = {
    compile(source, _options) {
        return params => source.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, body) => (params[key] ? body : ''))
            .replace(/\{\{trim\}\}/g, '').replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? '');
    },
};
const plainCompile = Handlebars.compile;

// ── 테마 모듈 불러오기 (가져오기 줄만 뗀다) ───────────────────
globalThis.__anchorTest = { core, eventSource, event_types, Message, ChatCompletion, promptManager, Handlebars, settings: { enabled: true } };
const strip = js => js.replace(/^import [\s\S]*?;$/gm, '').replace(/^export \{ ANCHORS, isAnchor \};$/m, '');
const anchorsJs = await read('src/prompt-anchors.js');
const anchors = await import('data:text/javascript;base64,' + Buffer.from(
    'const T=globalThis.__anchorTest;const {eventSource,event_types,Message,ChatCompletion,promptManager,Handlebars}=T;const {ANCHORS,isAnchor,storyStringHas,markerEnabled,createAnchorEngine,patchChatCompletion}=T.core;'
    + strip(anchorsJs) + '\nexport { ANCHORS, isAnchor };').toString('base64'));
globalThis.__anchorTest.anchors = anchors;
const noteJs = await read('src/an-anchor.js');
const note = await import('data:text/javascript;base64,' + Buffer.from(
    'const T=globalThis.__anchorTest;const getSettings=()=>T.settings;const {registerAnchorSource,anchorAvailable,ANCHOR_LABEL,ANCHOR_HINT,isAnchor}=T.anchors;const {promptManager}=T;'
    + strip(noteJs) + '\nexport { collect };').toString('base64'));

// DOM 없이 시작: 라디오 · 창 감시는 문서가 없으면 아무것도 안 한다
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: () => {} };
globalThis.HTMLInputElement = class {};
note.startNoteAnchor();

// 전개 지시 원천 흉내 (애드온 전체는 direction-place.mjs 가 본다): 같은 등록 틀 · 순서 20
state.direction = [];
anchors.registerAnchorSource('direction', 20, ({ anchor, type }) => (type === 'quiet' || type === 'impersonate') ? [] : state.direction.filter(p => p.at === anchor).map(p => ({ anchor, text: p.content, role: p.role, identifier: 'bl_direction_x' })));

// ── 본체 흉내: 생성 한 번 ───────────────────────────────────
function reset(over = {}) {
    Object.assign(state, {
        api: 'openai', group: false, story: DEFAULT_STORY, metaSaves: 0,
        meta: { note_prompt: 'AN {{char}}', note_interval: 1, note_position: TYPES.IN_PROMPT, note_depth: 2, note_role: 0 },
        prompts: {},
        persona: 'PERSONA of {{user}}', personaPos: PERSONA_POS.IN_PROMPT,
        description: 'DESC of {{char}}', personality: 'PERS', scenario: 'SCEN',
        wiTop: '', userTurns: 1, direction: [],
        order: ['worldInfoBefore', 'main', 'worldInfoAfter', 'charDescription', 'charPersonality', 'scenario', 'personaDescription', 'chatHistory'].map(identifier => ({ identifier, enabled: true })),
    }, over);
    globalThis.__anchorTest.settings = { enabled: true };
    note.installTrap(state.prompts);
}
const setExtensionPrompt = (key, value, position, depth, scan = false, role = 0) => { state.prompts[key] = { value: String(value), position: Number(position), depth: Number(depth), scan: !!scan, role: Number(role) }; };
function setFloatingPrompt() {
    const meta = state.meta;
    let last = state.userTurns;
    if (meta.note_interval === 1) last = 1;
    if (last <= 0 || meta.note_interval <= 0) { setExtensionPrompt('2_floating_prompt', '', TYPES.NONE, 100); state.shouldWIAddPrompt = false; return; }
    const till = last >= meta.note_interval ? (last % meta.note_interval) : (meta.note_interval - last);
    state.shouldWIAddPrompt = till === 0;
    setExtensionPrompt('2_floating_prompt', till === 0 ? meta.note_prompt : '', meta.note_position, meta.note_depth, false, meta.note_role);
}
function bodyMerges() {
    const meta = state.meta;
    if (state.shouldWIAddPrompt) {   // world-info.js: AN 위/아래 항목
        const original = state.prompts['2_floating_prompt'].value;
        setExtensionPrompt('2_floating_prompt', `${state.wiTop}\n${original}\n`.replace(/(^\n)|(\n$)/g, ''), meta.note_position, meta.note_depth, false, meta.note_role);
    }
    if (state.persona && [PERSONA_POS.TOP_AN, PERSONA_POS.BOTTOM_AN].includes(state.personaPos) && state.shouldWIAddPrompt) {   // script.js addPersonaDescriptionExtensionPrompt
        const original = state.prompts['2_floating_prompt'].value;
        setExtensionPrompt('2_floating_prompt', state.personaPos === PERSONA_POS.TOP_AN ? `${state.persona}\n${original}` : `${original}\n${state.persona}`, meta.note_position, meta.note_depth, false, meta.note_role);
    }
}
const ROLE = ['system', 'user', 'assistant'];
const promptPosition = p => p == TYPES.BEFORE_PROMPT ? 'start' : p == TYPES.IN_PROMPT ? 'end' : false;
function history() { return [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: 'u2' }]; }
function inChat(list) {
    const an = state.prompts['2_floating_prompt'];   // 본체: getExtensionPrompt(IN_CHAT, depth) — 읽는 순간 테마가 position 을 바꿔 보일 수 있다
    if (an && an.position == TYPES.IN_CHAT && an.value) list.splice(Math.max(0, list.length - an.depth), 0, { role: ROLE[an.role], content: macro(an.value.trim()) });
    return list;
}
async function chatCompletion() {
    const an = state.prompts['2_floating_prompt'];
    const content = { worldInfoBefore: '', main: 'MAIN', worldInfoAfter: '', charDescription: macro(state.description), charPersonality: state.personality, scenario: state.scenario };
    const prompts = state.order.filter(e => e.enabled).map(e => ({ identifier: e.identifier, role: 'system', content: content[e.identifier] ?? '', marker: !(e.identifier in content) || e.identifier !== 'main' }));
    const system = [];
    if (an && an.value) system.push({ role: ROLE[an.role], content: macro(an.value), identifier: 'authorsNote', position: promptPosition(an.position) });
    if (state.persona && state.personaPos === PERSONA_POS.IN_PROMPT) system.push({ role: 'system', content: macro(state.persona), identifier: 'personaDescription' });
    for (const p of system) { const i = prompts.findIndex(x => x.identifier === p.identifier); if (i >= 0) prompts[i] = p; else prompts.push(p); }
    const index = id => prompts.findIndex(p => p.identifier === id);
    const cc = new ChatCompletion();
    const addTo = async source => {
        if (index(source) < 0) return;
        if (state.order.find(e => e.identifier === source)?.enabled === false && source !== 'main') return;
        const collection = new MessageCollection(source);
        collection.add(await Message.fromPromptAsync(prompts[index(source)]));
        cc.add(collection, index(source));
    };
    for (const id of ['worldInfoBefore', 'main', 'worldInfoAfter', 'charDescription', 'charPersonality', 'scenario', 'personaDescription']) await addTo(id);
    const anPrompt = prompts[index('authorsNote')];
    if (anPrompt?.position && cc.has('main')) cc.insert(await Message.fromPromptAsync(anPrompt), 'main', anPrompt.position);
    const chat = new MessageCollection('chatHistory');
    for (const m of inChat(history())) chat.add(await Message.createAsync(m.role, m.content, 'chat'));
    cc.add(chat, index('chatHistory'));
    return { chat: cc.getChat(), cc };
}
async function textCompletion() {
    const get = position => {
        const values = Object.keys(state.prompts).sort().map(k => state.prompts[k]).filter(x => x.position == position && x.value).map(x => x.value.trim()).join('\n');
        return values ? macro(`\n${values}\n`) : '';
    };
    const params = {
        description: macro(state.description), personality: state.personality, persona: state.personaPos === PERSONA_POS.IN_PROMPT ? macro(state.persona) : '', scenario: state.scenario,
        system: 'SYS', char: 'Robin', user: 'Me', wiBefore: '', wiAfter: '', loreBefore: '', loreAfter: '',
        anchorBefore: get(TYPES.BEFORE_PROMPT).trim(), anchorAfter: get(TYPES.IN_PROMPT).trim(), mesExamples: '', mesExamplesRaw: '',
    };
    const story = Handlebars.compile(state.story, { noEscape: true })(params);
    const lines = inChat(history()).map(m => `${m.role}: ${m.content}`);
    return { prompt: `${story}${lines.join('\n')}`, story };
}
async function generate({ type = 'normal', dryRun = false } = {}) {
    await eventSource.emit(event_types.GENERATION_STARTED, type, {}, dryRun);
    setFloatingPrompt();
    bodyMerges();
    return state.api === 'openai' ? chatCompletion() : textCompletion();
}
const view = chat => chat.map(m => `${m.role}:${m.content}`);
const neighbours = (chat, needle) => { const i = chat.findIndex(m => m.content === needle); return i < 0 ? null : [chat[i - 1]?.content ?? null, chat[i + 1]?.content ?? null]; };
const lineAfter = (text, needle) => { const lines = text.split('\n'); const i = lines.indexOf(needle); return i < 0 ? null : [lines[i - 1] ?? null, lines[i + 1] ?? null]; };

// ── 채팅 완성 ──────────────────────────────────────────────
await test('채팅 완성 · 기본(테마 칸 없음): 본체 위치 그대로 (메인 뒤 · 채팅 안 @깊이)', async () => {
    reset();
    let { chat } = await generate();
    assert.deepEqual(view(chat), ['system:MAIN', 'system:AN Robin', 'system:DESC of Robin', 'system:PERS', 'system:SCEN', 'system:PERSONA of Me', 'user:u1', 'assistant:a1', 'user:u2']);
    state.meta.note_position = TYPES.IN_CHAT;
    ({ chat } = await generate());
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['u1', 'a1'], '채팅 안 깊이 2');
});

await test('채팅 완성 · 페르소나 위치: 페르소나 설명 바로 위 · 본체 자리에는 없음 · 역할 그대로 · 표식 토큰 수에 포함', async () => {
    reset();
    for (const position of [TYPES.IN_PROMPT, TYPES.IN_CHAT, TYPES.BEFORE_PROMPT]) {
        state.meta.note_position = position; state.meta.bl_note_anchor = 'persona'; state.meta.note_role = 1;
        const { chat, cc } = await generate();
        assert.deepEqual(view(chat), ['system:MAIN', 'system:DESC of Robin', 'system:PERS', 'system:SCEN', 'user:AN Robin', 'system:PERSONA of Me', 'user:u1', 'assistant:a1', 'user:u2'], `본체 위치 ${position} 이어도`);
        const persona = cc.messages.collection.find(c => c?.identifier === 'personaDescription');
        assert.equal(persona.getTokens(), 'AN Robin'.length + 'PERSONA of Me'.length, '프롬프트 관리자 페르소나 줄 토큰 = 노트 + 설명');
        assert.equal(state.meta.note_position, position, '본체 설정값은 그대로');
    }
    assert.deepEqual(anchors.lastPlaced().map(p => [p.api, p.anchor, p.source, p.role]), [['openai', 'persona', 'authorsNote', 'user']]);
});

await test('채팅 완성 · 페르소나 설명이 비어도 표식 자리에 · 캐릭터 설명 위치(있음 · 비어 있음)', async () => {
    reset({ persona: '' });
    state.meta.bl_note_anchor = 'persona';
    let { chat } = await generate();
    assert.deepEqual(view(chat), ['system:MAIN', 'system:DESC of Robin', 'system:PERS', 'system:SCEN', 'system:AN Robin', 'user:u1', 'assistant:a1', 'user:u2'], '시나리오 다음 = 페르소나 표식 자리');
    reset();
    state.meta.bl_note_anchor = 'char';
    ({ chat } = await generate());
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['MAIN', 'DESC of Robin']);
    reset({ description: '' });
    state.meta.bl_note_anchor = 'char';
    ({ chat } = await generate());
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['MAIN', 'PERS'], '설명이 비면 그 표식 자리');
});

await test('채팅 완성 · 그룹: 합쳐진 캐릭터 설명 묶음 바로 위 · {{char}} 는 그룹 규칙', async () => {
    reset({ group: true, description: 'Ann: desc A\nBob: desc B' });
    state.meta.bl_note_anchor = 'char';
    const { chat } = await generate();
    assert.deepEqual(neighbours(chat, 'AN Ann, Bob'), ['MAIN', 'Ann: desc A\nBob: desc B']);
});

await test('삽입 빈도 2: 들어가는 턴만 그 자리에 · 안 들어가는 턴은 어디에도 없음', async () => {
    reset();
    state.meta.bl_note_anchor = 'persona'; state.meta.note_interval = 2;
    for (const [turns, expected] of [[1, false], [2, true], [3, false], [4, true]]) {
        state.userTurns = turns;
        const { chat } = await generate();
        assert.equal(chat.some(m => m.content === 'AN Robin'), expected, `사용자 메시지 ${turns}개`);
        if (expected) assert.deepEqual(neighbours(chat, 'AN Robin'), ['SCEN', 'PERSONA of Me']);
    }
});

await test('위치 되돌리기 · 테마 끔 · 붙일 곳 없음(표식 꺼짐): 본체 위치로', async () => {
    reset();
    state.meta.bl_note_anchor = 'persona'; state.meta.note_position = TYPES.IN_CHAT;
    delete state.meta.bl_note_anchor;
    let { chat } = await generate();
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['u1', 'a1'], '테마 칸을 지우면 본체 위치(채팅 안 깊이 2)');
    state.meta.bl_note_anchor = 'persona';
    globalThis.__anchorTest.settings = { enabled: false };
    ({ chat } = await generate());
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['u1', 'a1'], '테마를 끄면 본체 위치');
    globalThis.__anchorTest.settings = { enabled: true };
    state.order.find(e => e.identifier === 'personaDescription').enabled = false;
    ({ chat } = await generate());
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['u1', 'a1'], '표식이 꺼져 있으면 본체 위치');
    state.meta.bl_note_anchor = 'nowhere';
    state.order.find(e => e.identifier === 'personaDescription').enabled = true;
    ({ chat } = await generate());
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['u1', 'a1'], '모르는 값은 끔');
});

await test('페르소나 설명 위치가 작가 노트 안(TOP_AN · BOTTOM_AN)이면: 합친 노트 통째로 페르소나 표식 자리 · 월드 인포 AN 위 항목도 그대로', async () => {
    reset({ personaPos: PERSONA_POS.TOP_AN, wiTop: 'WI-TOP' });
    state.meta.bl_note_anchor = 'persona';
    let { chat } = await generate();
    assert.deepEqual(neighbours(chat, 'PERSONA of Me\nWI-TOP\nAN Robin'), ['SCEN', 'u1'], '페르소나 → WI 위 → 노트 (본체 합치기 순서)');
    reset({ personaPos: PERSONA_POS.BOTTOM_AN });
    state.meta.bl_note_anchor = 'char';
    ({ chat } = await generate());
    assert.deepEqual(neighbours(chat, 'AN Robin\nPERSONA of Me'), ['MAIN', 'DESC of Robin']);
});

await test('같은 자리에 작가 노트 + 전개 지시 줄: 작가 노트 → 전개 지시(줄 순서) → 설명 · 조용한 생성/대신 쓰기는 전개 지시만 빠짐', async () => {
    reset();
    state.meta.bl_note_anchor = 'persona';
    state.direction = [{ at: 'persona', content: 'DIR-1', role: 'system' }, { at: 'persona', content: 'DIR-2', role: 'assistant' }, { at: 'char', content: 'DIR-C', role: 'user' }];
    let { chat } = await generate();
    assert.deepEqual(view(chat), ['system:MAIN', 'user:DIR-C', 'system:DESC of Robin', 'system:PERS', 'system:SCEN', 'system:AN Robin', 'system:DIR-1', 'assistant:DIR-2', 'system:PERSONA of Me', 'user:u1', 'assistant:a1', 'user:u2']);
    ({ chat } = await generate({ type: 'quiet' }));
    assert.ok(!chat.some(m => /DIR-/.test(m.content)), '조용한 생성: 전개 지시 없음');
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['SCEN', 'PERSONA of Me'], '작가 노트는 본체처럼 조용한 생성에도');
});

await test('dry run(프롬프트 관리자 토큰 계산)도 같은 자리 · 넣을 메시지는 자기 표식 묶음에만', async () => {
    reset();
    state.meta.bl_note_anchor = 'char';
    const { chat } = await generate({ dryRun: true });
    assert.deepEqual(neighbours(chat, 'AN Robin'), ['MAIN', 'DESC of Robin']);
    // 넣을 메시지는 그 표식 메시지 객체에 달린다 — 겹친 조립(dry run · 본 요청)이 서로의 것을 가져가지 않는다
    const orphan = await Message.fromPromptAsync({ identifier: 'charDescription', role: 'system', content: 'x' });   // add 없이 끝난 조립
    const cc = new ChatCompletion(); const other = new MessageCollection('charDescription', await Message.createAsync('system', 'y', 'charDescription')); cc.add(other);
    assert.deepEqual(other.collection.map(m => m.content), ['y'], '다른 조립의 묶음에는 안 들어감');
    const own = new MessageCollection('charDescription', orphan); cc.add(own);
    assert.deepEqual(own.collection.map(m => m.content), ['AN Robin', 'x'], '자기 묶음에만 · 표식 메시지 바로 앞');
    cc.add(own);
    assert.equal(own.collection.length, 2, '한 번만');
});

await test('감싸기는 한 번만 · 다른 묶음 · 다른 틀은 그대로', async () => {
    const before = [Message.fromPromptAsync, ChatCompletion.prototype.add, Handlebars.compile];
    core.patchChatCompletion({ prepareMarker() {}, fillCollection() {} }, Message, ChatCompletion);
    anchors.startPromptAnchors();
    assert.deepEqual([Message.fromPromptAsync, ChatCompletion.prototype.add, Handlebars.compile], before);
    assert.ok(Message.fromPromptAsync.__blAnchors && ChatCompletion.prototype.add.__blAnchors && Handlebars.compile.__blAnchors);
    reset(); state.meta.bl_note_anchor = 'persona';
    assert.equal(Handlebars.compile('{{persona}}', { noEscape: true })({ persona: 'P', anchorBefore: '', mesExamplesRaw: '' }), 'P', '스토리 문자열이 아닌 틀');
    assert.equal(Handlebars.compile(state.story)({ persona: 'P', anchorBefore: '', mesExamplesRaw: '' }), 'P\n', 'noEscape 가 아니면(본체 다른 틀)');
    assert.equal(Handlebars.compile(state.story, { noEscape: true })({ persona: 'P' }), 'P\n', 'Generate 값 모양이 아니면');
});

// ── 텍스트 완성 ────────────────────────────────────────────
await test('텍스트 완성 · 기본: 본체 위치(스토리 문자열 뒤 · 앞 · 채팅 안)', async () => {
    reset({ api: 'textgenerationwebui' });
    let { prompt } = await generate();
    assert.deepEqual(lineAfter(prompt, 'AN Robin'), ['PERSONA of Me', 'user: u1'], '뒤 = anchorAfter');
    state.meta.note_position = TYPES.BEFORE_PROMPT;
    ({ prompt } = await generate());
    assert.deepEqual(lineAfter(prompt, 'AN Robin'), [null, 'SYS']);
});

await test('텍스트 완성 · 페르소나 위치 / 캐릭터 설명 위치 (있음 · 비어 있음 · 그룹)', async () => {
    reset({ api: 'textgenerationwebui' });
    state.meta.bl_note_anchor = 'persona'; state.meta.note_position = TYPES.IN_CHAT;
    let { prompt, story } = await generate();
    assert.equal(story, 'SYS\nDESC of Robin\nPERS\nSCEN\nAN Robin\nPERSONA of Me\n');
    assert.equal(prompt.split('AN Robin').length, 2, '한 번만 (채팅 안에는 없음)');
    reset({ api: 'textgenerationwebui', persona: '' });
    state.meta.bl_note_anchor = 'persona';
    ({ story } = await generate());
    assert.equal(story, 'SYS\nDESC of Robin\nPERS\nSCEN\nAN Robin\n', '페르소나가 비면 그 칸에 노트만');
    reset({ api: 'textgenerationwebui' });
    state.meta.bl_note_anchor = 'char';
    ({ story } = await generate());
    assert.equal(story, 'SYS\nAN Robin\nDESC of Robin\nPERS\nSCEN\nPERSONA of Me\n');
    reset({ api: 'textgenerationwebui', description: '' });
    state.meta.bl_note_anchor = 'char';
    ({ story } = await generate());
    assert.equal(story, 'SYS\nAN Robin\nPERS\nSCEN\nPERSONA of Me\n');
    reset({ api: 'textgenerationwebui', group: true, description: 'Ann: desc A\nBob: desc B' });
    state.meta.bl_note_anchor = 'char';
    ({ story } = await generate());
    assert.equal(story, 'SYS\nAN Ann, Bob\nAnn: desc A\nBob: desc B\nPERS\nSCEN\nPERSONA of Me\n', '그룹: 합쳐진 설명 묶음 위');
});

await test('텍스트 완성 · 전개 지시 줄 겹침 · 삽입 빈도 · 스토리 문자열에 칸이 없으면 본체 위치', async () => {
    reset({ api: 'textgenerationwebui' });
    state.meta.bl_note_anchor = 'persona';
    state.direction = [{ at: 'persona', content: 'DIR-1', role: 'user' }];
    let { story } = await generate();
    assert.equal(story, 'SYS\nDESC of Robin\nPERS\nSCEN\nAN Robin\nDIR-1\nPERSONA of Me\n');
    state.direction = [];
    state.meta.note_interval = 2; state.userTurns = 1;
    let out = await generate();
    assert.ok(!out.prompt.includes('AN Robin'), '빈도에 안 맞는 턴');
    state.userTurns = 2;
    out = await generate();
    assert.equal(out.story, 'SYS\nDESC of Robin\nPERS\nSCEN\nAN Robin\nPERSONA of Me\n');
    reset({ api: 'textgenerationwebui', story: '{{#if system}}{{system}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if anchorAfter}}{{anchorAfter}}\n{{/if}}' });
    state.meta.bl_note_anchor = 'persona';
    ({ story } = await generate());
    assert.equal(story, 'SYS\nDESC of Robin\nAN Robin\n', '{{persona}} 칸이 없는 틀 → 본체 위치(뒤)');
});

await test('본체 설정 · 저장값: 테마는 채팅 메타데이터 칸 하나만 · extension_prompts 저장 모양 그대로', async () => {
    reset();
    state.meta.bl_note_anchor = 'persona';
    await generate();
    const raw = Object.getOwnPropertyDescriptor(state.prompts, '2_floating_prompt');
    assert.equal(typeof raw.get, 'function', '읽기 문');
    assert.equal(note.storedNote().position, TYPES.IN_PROMPT, '받아 둔 값은 본체가 쓴 그대로');
    assert.equal(state.prompts['2_floating_prompt'].position, -1, '읽을 때만 NONE');
    assert.equal(state.prompts['2_floating_prompt'].value, 'AN {{char}}', '값은 그대로 (월드 인포 · 페르소나 합치기가 읽음)');
    assert.equal(JSON.parse(JSON.stringify(state.meta)).note_position, TYPES.IN_PROMPT);
    state.prompts = {}; note.installTrap(state.prompts);   // 채팅을 바꾸면 본체가 새 객체 — 다시 단다
    setExtensionPrompt('2_floating_prompt', 'X', 1, 4);
    assert.equal(state.prompts['2_floating_prompt'].position, -1);
    assert.equal(note.chosenAnchor({ bl_note_anchor: 'char' }), 'char'); assert.equal(note.chosenAnchor({ bl_note_anchor: 'x' }), null); assert.equal(note.chosenAnchor({}), null);
});

await test('라디오 · 문구 · CSS · CI 등록', async () => {
    assert.match(noteJs, /label\.className = 'checkbox_label bl-note-anchor'/, '본체 라디오와 같은 줄 모양(checkbox_label)');
    assert.match(noteJs, /group\.append\(makeRadio\('persona'\), makeRadio\('char'\)\)/);
    assert.match(anchorsJs, /persona: '페르소나 위치', char: '캐릭터 설명 위치'/);
    assert.match(noteJs, /input\.name = RADIO;/, '본체 라디오와 다른 이름 — 본체 change 처리기가 붙지 않음');
    assert.match(await read('index.js'), /import\('\.\/src\/an-anchor\.js'\)\.then\(m => m\.startNoteAnchor\(\)\)/);
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/prompt-anchors\.mjs \./, 'CI 등록');
});

delete globalThis.__anchorTest;   // document · SillyTavern 흉내는 남긴다 (창 감시가 1.5초 뒤 한 번 더 찾는다)
console.log(`prompt-anchors: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
