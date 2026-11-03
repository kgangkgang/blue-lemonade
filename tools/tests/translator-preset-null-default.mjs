// 기본값이 null 인 칸(고른 프롬프트 id · 본문)에 문자열이 든 번역 프리셋도 올바른 프리셋이에요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { validSettings, validPresetList, validImport } = await import(new URL('src/addons/translator/preset-data.js', root));
const defaults = { provider: 'gemini', selected_translation_prompt_id: null, selected_translation_prompt: null, temperature: 0.7, nested: { on: true } };
const preset = (id, body) => ({ id: 'p1', name: '내 프리셋', settings: { provider: 'openai', selected_translation_prompt_id: id, selected_translation_prompt: body, temperature: 0.5 } });
for (const [id, body] of [['1789910951852', '프롬프트 본문'], [null, null]]) {
    const item = preset(id, body);
    assert.equal(validSettings(item.settings, defaults), true, `id ${id} 칸이 유효해야 해요`);
    assert.equal(validPresetList([item], defaults).length, 1, '새로고침 뒤에도 목록에 남아요');
    assert.equal(validImport({ presets: [item] }, defaults), true, '이런 프리셋이 든 백업도 받아요');
}
// 느슨하게 풀지 않아요: null 칸에 객체 · 숫자는 여전히 거부, 다른 칸의 형식 검사도 그대로예요.
assert.equal(validSettings({ selected_translation_prompt_id: { x: 1 } }, defaults), false, '객체는 거부');
assert.equal(validSettings({ selected_translation_prompt_id: 5 }, defaults), false, '숫자는 거부');
assert.equal(validSettings({ temperature: 'x' }, defaults), false, '숫자 칸에 글자는 거부');
assert.equal(validSettings({ provider: null }, defaults), false, '글자 칸에 null 은 거부');
assert.equal(validSettings({ nested: { on: 1 } }, defaults), false, '안쪽 칸 형식 검사 유지');
console.log('PASS 기본값 null 칸의 글자 값을 받고 다른 형식 검사는 그대로예요');
