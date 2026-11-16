// 한글화(src/addons/prompt/index.js) 작은 지킴 둘 — 실제 소스 줄을 떼어 돌려요.
//   ① 프리필 글을 비우면 빈 채로 남아요 (1.5.8 까지: 비워도 다음 설정 읽기에서 기본 문장이 되살아나, 칸은 비어 보이는데 기본 문장이 붙어 나갔어요)
//   ② 새 캐릭터 만들기 화면에서는 제자리 번역 단추를 붙이지 않아요 (1.5.8 까지: 열려 있던 캐릭터의 열쇠로 붙어, 초안 번역이 그 캐릭터의 저장된 번역을 덮었어요)
//   node tools/tests/prompt-small-guards.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const source = fs.readFileSync(path.join(root, 'src/addons/prompt/index.js'), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

const prefillLine = source.split('\n').find(line => /c\.prefillText\s*=\s*'Understood\./.test(line));
assert.ok(prefillLine, 'cfg() 의 프리필 기본값 줄을 찾아요');
const fillPrefill = new Function('c', prefillLine + '; return c;');
test('프리필 글: 처음(칸 없음)에는 기본 문장을 채워요', () => {
    assert.match(fillPrefill({}).prefillText, /^Understood\./);
    assert.match(fillPrefill({ prefillText: null }).prefillText, /^Understood\./);
});
test('프리필 글: 사용자가 비운 글은 빈 채로 남아요', () => {
    assert.equal(fillPrefill({ prefillText: '' }).prefillText, '');
    assert.equal(fillPrefill({ prefillText: 'My prefill' }).prefillText, 'My prefill');
});
test('프리필 글: 빈 글이면 요청에 붙이지 않아요(buildMessages 의 조건 그대로)', () => {
    assert.ok(source.includes("if (c.prefillEnabled && typeof c.prefillText === 'string' && c.prefillText.trim()) {"));
});

const at = source.indexOf('currentCharacter: () => {');
assert.ok(at > 0, '제자리 번역의 currentCharacter 를 찾아요');
const arrow = source.slice(source.indexOf('() =>', at), source.indexOf('},\n', at) + 1);
const currentCharacter = ctx => new Function('getContext', `return (${arrow})();`)(() => ctx);
const base = { characters: [{ avatar: 'a.png' }, { avatar: 'b.png' }], characterId: 1, groupId: null, menuType: 'character_edit' };
test('제자리 번역: 캐릭터 편집 화면은 그 캐릭터의 열쇠', () => {
    assert.equal(currentCharacter(base), 'b.png');
});
test('제자리 번역: 새 캐릭터 만들기 화면은 열쇠 없음(단추 숨김) — 열려 있던 캐릭터를 쓰지 않아요', () => {
    assert.equal(currentCharacter({ ...base, menuType: 'create' }), '');
});
test('제자리 번역: 그룹 · 캐릭터 없음은 전처럼 열쇠 없음', () => {
    assert.equal(currentCharacter({ ...base, groupId: 'g1' }), '');
    assert.equal(currentCharacter({ ...base, characterId: undefined }), '');
});
console.log(`prompt-small-guards: ${passed} passed`);
