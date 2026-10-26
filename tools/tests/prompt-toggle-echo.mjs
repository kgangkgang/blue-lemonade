// 8.0.5 프롬프트 토글 즉시 반영(src/prompt-choice.js echoPromptToggles · bindToggleEcho)
//   node tools/tests/prompt-toggle-echo.mjs <테마 루트>
// 확인하는 것: 실리태번이 저장한 켜짐(prompt_order)대로 줄 표시만 맞추고, 켜짐 · 순서 · 토큰 셈 · 다른 창은 건드리지 않는다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { echoPromptToggles, bindToggleEcho, bindPromptChoices } = await import(pathToFileURL(path.join(root, 'src/prompt-choice.js')).href);

function classes(list) {
    const set = new Set(list);
    return { contains: c => set.has(c), toggle: (c, on) => { if (on) set.add(c); else set.delete(c); }, toArray: () => [...set].sort() };
}
function row(id, on, { toggle = true } = {}) {
    const sw = toggle ? { classList: classes(['prompt-manager-toggle-action', 'fa-solid', on ? 'fa-toggle-on' : 'fa-toggle-off']) } : null;
    return {
        dataset: { pmIdentifier: id },
        classList: classes(['completion_prompt_manager_prompt', ...(on ? [] : ['completion_prompt_manager_prompt_disabled'])]),
        querySelector: sel => (sel === '.prompt-manager-toggle-action' ? sw : null),
        sw,
    };
}
function setup() {
    const rows = [row('pace', true, { toggle: false }), row('slow', true), row('fast', false), row('regular', true), row('other', false)];
    const container = { querySelectorAll: () => rows, contains: () => true };
    const order = rows.map(r => ({ identifier: r.dataset.pmIdentifier, enabled: !r.classList.contains('completion_prompt_manager_prompt_disabled') }));
    const counts = { slow: 12, fast: 34 };
    const prompts = [['pace', '🔻PICK: PACING🔻'], ['slow', '「 Slow 」'], ['fast', '「 Fast 」'], ['regular', '| 일반 |'], ['other', '| 기타 |']].map(([identifier, name]) => ({ identifier, name }));
    const manager = { containerElement: container, activeCharacter: { id: 100001 }, configuration: { prefix: 'completion_' }, serviceSettings: { prompts, extensions: {} }, getPromptOrderForCharacter: () => order, getTokenHandler: () => ({ getCounts: () => counts }) };
    return { rows, order, counts, manager };
}
const state = r => ({ off: r.classList.contains('completion_prompt_manager_prompt_disabled'), sw: r.sw?.classList.toArray() });

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

test('바뀐 줄이 없으면 아무것도 안 바꾼다', () => {
    const { rows, manager } = setup();
    const before = rows.map(state);
    assert.equal(echoPromptToggles(manager), 0);
    assert.deepEqual(rows.map(state), before);
});
test('실리태번이 켜짐을 바꾼 줄만 표시를 맞춘다(켜기 · 끄기)', () => {
    const { rows, order, manager } = setup();
    order.find(e => e.identifier === 'other').enabled = true;
    order.find(e => e.identifier === 'regular').enabled = false;
    assert.equal(echoPromptToggles(manager), 2);
    assert.deepEqual(state(rows[4]), { off: false, sw: ['fa-solid', 'fa-toggle-on', 'prompt-manager-toggle-action'] });
    assert.deepEqual(state(rows[3]), { off: true, sw: ['fa-solid', 'fa-toggle-off', 'prompt-manager-toggle-action'] });
    assert.deepEqual(state(rows[1]), { off: false, sw: ['fa-solid', 'fa-toggle-on', 'prompt-manager-toggle-action'] });
});
test('켜짐 · 순서 · 토큰 셈은 그대로(표시만)', () => {
    const { order, counts, manager } = setup();
    order.find(e => e.identifier === 'fast').enabled = true;
    const before = JSON.stringify(order), tokens = JSON.stringify(counts);
    echoPromptToggles(manager);
    assert.equal(JSON.stringify(order), before);
    assert.equal(JSON.stringify(counts), tokens);
});
test('토글이 없는 줄(묶음 머리)은 건너뛴다', () => {
    const { rows, order, manager } = setup();
    order.find(e => e.identifier === 'pace').enabled = false;
    assert.equal(echoPromptToggles(manager), 0);
    assert.equal(state(rows[0]).off, false);
});
test('관리자 · 캐릭터 · 순서가 없으면 0', () => {
    assert.equal(echoPromptToggles(null), 0);
    const { manager } = setup();
    assert.equal(echoPromptToggles({ ...manager, activeCharacter: null }), 0);
    assert.equal(echoPromptToggles({ ...manager, getPromptOrderForCharacter: () => { throw new Error('없음'); } }), 0);
});
test('택1: 클릭 연결이 끈 짝과 실리태번이 켠 줄이 거품 단계에서 함께 맞춰진다', () => {
    const { rows, order, counts, manager } = setup();
    manager.serviceSettings.extensions.blPromptChoices = undefined;
    const capture = new Map(), bubble = new Map();
    const doc = { addEventListener: (name, fn, opt) => (opt === true ? capture : bubble).set(name, fn), removeEventListener: (name, fn, opt) => (opt === true ? capture : bubble).delete(name) };
    const offChoice = bindPromptChoices(doc, () => manager), offEcho = bindToggleEcho(doc, () => manager);
    const target = { closest: sel => (sel === '.prompt-manager-toggle-action' ? { closest: () => ({ dataset: { pmIdentifier: 'fast' } }) } : null) };
    capture.get('click')({ target });                     // 택1: slow 를 끈다
    order.find(e => e.identifier === 'fast').enabled = true;   // 실리태번 handleToggle
    bubble.get('click')({ target });                      // 즉시 반영
    assert.deepEqual(state(rows[1]).off, true);
    assert.deepEqual(state(rows[2]).off, false);
    assert.equal(counts.slow, null);
    offChoice(); offEcho();
    assert.equal(capture.size + bubble.size, 0);
});
test('다른 창의 같은 클래스는 무시한다', () => {
    const { rows, order, manager } = setup();
    manager.containerElement.contains = () => false;
    let handler; bindToggleEcho({ addEventListener: (n, fn) => { handler = fn; } }, () => manager);
    order.find(e => e.identifier === 'other').enabled = true;
    handler({ target: { closest: () => ({}) } });
    assert.equal(state(rows[4]).off, true);
});

console.log(`prompt-toggle-echo: ${n}/${n} 통과`);
