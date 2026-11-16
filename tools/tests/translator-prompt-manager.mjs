// 번역 프롬프트 관리(src/addons/translator/index.js PromptManager) — 진짜 메서드를 잘라 가짜 환경에서 돌려요.
//   ① 지우기 확인 창이 프롬프트 이름을 보여 줘요 (1.5.8 까지: 없는 칸 .name 을 읽어 늘 「이 프롬프트」)
//   ② 골라 둔 프롬프트가 목록에 없으면(그 프롬프트가 없는 설정 파일을 가져옴) 선택을 비워요 (1.5.8 까지: 낡은 id 가 남아 다음에 열 때 고르기 칸 · 편집 칸이 빔)
//   node tools/tests/translator-prompt-manager.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const source = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
const klass = source.slice(source.indexOf('\nclass PromptManager {'), source.indexOf('\nclass PresetManager {'));
function method(head) {
    const start = klass.indexOf(`\n    ${head}(`);
    assert.ok(start >= 0, 'missing ' + head);
    let depth = 0;
    for (let i = klass.indexOf(') {', start) + 2; i < klass.length; i++) {
        if (klass[i] === '{') depth++;
        else if (klass[i] === '}' && --depth === 0) return klass.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + head);
}
function fixture(settings, selectValue) {
    const asked = [], toasts = [];
    const env = {
        extensionSettings: settings, validPromptList: list => Array.isArray(list) ? list : [], logDebug() {}, saveSettingsDebounced() {},
        ask: async (text) => { asked.push(text); return false; },
        toastr: { warning: m => toasts.push(m), success: m => toasts.push(m), info: m => toasts.push(m) },
        document: { getElementById: () => ({ value: selectValue }) },
    };
    const P = new Function('env', `with (env) { return class { updatePromptDropdown() {} ${method('loadFromSettings')} ${method('async deleteSelectedPrompt')} }; }`)(env);
    return { manager: new P(), asked, toasts, settings };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
const prompts = () => [{ id: 'p1', title: '존댓말 번역', content: 'Translate politely to korean:', isCustom: true }];

await test('지우기 확인 창에 프롬프트 이름이 보여요', async () => {
    const f = fixture({ customPrompts: prompts(), selected_translation_prompt_id: null }, 'p1');
    f.manager.loadFromSettings();
    await f.manager.deleteSelectedPrompt();
    assert.equal(f.asked.length, 1);
    assert.ok(f.asked[0].includes('존댓말 번역'), f.asked[0]);
});
await test('골라 둔 프롬프트가 목록에 있으면 그대로 되살려요', async () => {
    const f = fixture({ customPrompts: prompts(), selected_translation_prompt_id: 'p1', selected_translation_prompt: 'old' }, 'p1');
    f.manager.loadFromSettings();
    assert.equal(f.settings.selected_translation_prompt_id, 'p1');
    assert.equal(f.settings.selected_translation_prompt, 'Translate politely to korean:');
});
await test('골라 둔 프롬프트가 목록에 없으면 선택을 비워요', async () => {
    const f = fixture({ customPrompts: prompts(), selected_translation_prompt_id: 'gone', selected_translation_prompt: 'stale text' }, 'p1');
    f.manager.loadFromSettings();
    assert.equal(f.settings.selected_translation_prompt_id, null);
    assert.equal(f.settings.selected_translation_prompt, null);
});
console.log(`translator-prompt-manager: ${passed} passed`);
