// 8.2.3 작가 노트 가로채기의 읽기 비용 — 본체가 생성 미리 돌리기마다 extension_prompts['2_floating_prompt'] 를 수만 번 읽어도
//   설정 정리(getSettings) · 문맥(getContext) 은 한 번만 돌아야 한다. 제보(10-29): 데우스 프리셋 · 채팅 300개에서 토글 한 번에 3만 번 읽혀 폰에서 17초.
//   node tools/tests/an-anchor-read-cost.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}

// ── 본체 흉내 ────────────────────────────────────────────
const listeners = {};
const eventSource = {
    on: (type, fn) => { (listeners[type] ||= []).push(fn); },
    emit: async (type, ...args) => { for (const fn of listeners[type] || []) await fn(...args); },
};
const event_types = { GENERATION_STARTED: 'generation_started', CHAT_CHANGED: 'chat_id_changed', SETTINGS_UPDATED: 'settings_updated', OAI_PRESET_CHANGED_AFTER: 'oai_preset_changed_after' };
const counts = { settings: 0, context: 0, available: 0 };
const state = { enabled: true, meta: { bl_note_anchor: 'persona' }, prompts: {}, available: true };
const context = () => {
    counts.context++;
    return { mainApi: 'openai', chatMetadata: state.meta, extensionPrompts: state.prompts, eventSource, event_types, saveMetadataDebounced() {}, substituteParams: t => t };
};
globalThis.SillyTavern = { getContext: context };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: () => {} };
globalThis.HTMLInputElement = class {};

// ── 테마 모듈 불러오기 (가져오기 줄만 뗀다 · 자리 맞추기 모듈은 작은 흉내) ───────
globalThis.__anchorCost = {
    getSettings: () => { counts.settings++; return { enabled: state.enabled }; },
    anchors: {
        registerAnchorSource: () => () => {},
        anchorAvailable: () => { counts.available++; return state.available; },
        ANCHOR_LABEL: { persona: '페르소나', char: '캐릭터' }, ANCHOR_HINT: { persona: '페르소나 설명 위', char: '캐릭터 설명 위' },
        isAnchor: v => v === 'persona' || v === 'char',
    },
    promptManager: { preparePrompt: p => p },
};
const strip = js => js.replace(/^import [\s\S]*?;$/gm, '');
const note = await import('data:text/javascript;base64,' + Buffer.from(
    'const T=globalThis.__anchorCost;const getSettings=T.getSettings;const {registerAnchorSource,anchorAvailable,ANCHOR_LABEL,ANCHOR_HINT,isAnchor}=T.anchors;const {promptManager}=T;'
    + strip(await read('src/an-anchor.js'))).toString('base64'));

const AN = '2_floating_prompt';
const reset = () => { counts.settings = 0; counts.context = 0; counts.available = 0; };
const readMany = (n = 30000) => { let none = 0; for (let i = 0; i < n; i++) if (state.prompts[AN].position === -1) none++; return none; };

note.startNoteAnchor();
state.prompts[AN] = { value: '작가 노트', position: 1, depth: 4, role: 0 };

await test('생성 한 번에 3만 번 읽어도 설정 정리 · 문맥은 한 번씩만', async () => {
    await eventSource.emit(event_types.GENERATION_STARTED, 'normal', {}, true);
    reset();
    assert.equal(readMany(), 30000, '자리를 맞추는 중이면 본체엔 NONE(-1) 으로 보인다');
    assert.ok(counts.settings <= 1, `getSettings ${counts.settings}번`);
    assert.ok(counts.context <= 3, `getContext ${counts.context}번`);
    assert.ok(counts.available <= 1, `anchorAvailable ${counts.available}번`);
});

await test('다음 생성 시작 때 한 번 다시 잰다 (표식을 끈 프리셋 → 본체 위치 그대로)', async () => {
    state.available = false;
    assert.equal(readMany(10), 10, '사건 전엔 기억한 판단 그대로');
    await eventSource.emit(event_types.GENERATION_STARTED, 'normal', {}, true);
    reset();
    assert.equal(readMany(), 0, '표식이 없으면 본체 위치(1) 그대로');
    assert.ok(counts.settings <= 1 && counts.available <= 1);
    state.available = true;
});

await test('설정 저장 · 프리셋 바뀜 · 라디오 고름도 다시 재는 계기', async () => {
    await eventSource.emit(event_types.GENERATION_STARTED, 'normal', {}, true);
    assert.equal(readMany(5), 5);
    state.enabled = false;
    await eventSource.emit(event_types.SETTINGS_UPDATED);
    assert.equal(readMany(5), 0, '테마를 끄면 본체 위치로');
    state.enabled = true;
    await eventSource.emit(event_types.OAI_PRESET_CHANGED_AFTER);
    assert.equal(readMany(5), 5, '프리셋이 바뀌면 다시 잰다');
    note.markStale();
    delete state.meta.bl_note_anchor;
    assert.equal(readMany(5), 0, '자리를 안 고른 채팅은 본체 위치');
    state.meta.bl_note_anchor = 'persona';
    note.markStale();
    assert.equal(readMany(5), 5);
});

await test('채팅을 바꾸면 새 extension_prompts 에 다시 달고 다시 잰다', async () => {
    state.prompts = { [AN]: { value: '새 채팅 노트', position: 1, depth: 4, role: 0 } };
    state.meta = { bl_note_anchor: 'char' };
    await eventSource.emit(event_types.CHAT_CHANGED);
    reset();
    assert.equal(readMany(1000), 1000);
    assert.ok(counts.settings <= 1);
    assert.equal(state.prompts[AN].value, '새 채팅 노트');
    state.prompts[AN] = { value: '본체가 다시 씀', position: 1, depth: 4, role: 0 };   // 쓰기 문: 값은 그대로 받아 둔다
    assert.equal(note.storedNote().value, '본체가 다시 씀');
    assert.equal(state.prompts[AN].position, -1);
});

await test('CI 에 등록', async () => {
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/an-anchor-read-cost\.mjs \./);
});

delete globalThis.__anchorCost;
console.log(`an-anchor-read-cost: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
