// 11-19 데우스 V4 새 모듈 번역: 운명의 주사위(<fate>) · 새 얼굴(<face> · <extra>) · 일기장(<diary>)
//   V4 정규식이 영어로 읽는 글자(Name: · Seen as: · (secret) · None · <fate odds roll> · <pass> · <fail>)를 옮기면
//   카드 제목이 「New face」 대체 카드로 빠지거나(열쇠 번역) 단역의 진짜 이름이 제목에 드러나고(Seen as 번역) 빈 일기가 날글이 됐어요.
//   실제 translate() 를 가짜 번역 API 로 돌리고(유료 호출 없음) 데우스 V4 원작 표시 정규식(찾기 그대로)으로 그려 본다.
//   실행: node tools/tests/translator-v4-modules.mjs .
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadTranslator, fakeTranslate, applyDisplayRegexes } from './translator-preset-harness.mjs';
import { V4_REPLY, V4_MODULE_REGEX, FATE, FACE, EXTRA, DIARY } from './translator-v4-module-fixtures.mjs';
import { USER_PROTECT } from './translator-v3-module-fixtures.mjs';
const root = path.resolve(process.argv[2] || '.');

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const t = await loadTranslator(root);
t.S.translation_display_mode = 'disabled';
const ko = text => fakeTranslate(text);
const count = (text, part) => String(text).split(part).length - 1;
const render = (source, out) => applyDisplayRegexes(t.display(source, out), V4_MODULE_REGEX);
// V4 정규식 글자 — 어느 요청에도 가면 안 된다
const KEYS = ['Name:', 'Seen as', 'Gender', 'Occupation', 'Abilities and skills', 'secret', 'None', 'Diaries', '<face', '<extra', '<diary', 'odds=', 'roll='];

for (const rules of [[], USER_PROTECT]) {
    const label = rules.length ? '사용자 보호 줄 있음' : '보호 줄 없음';
    await test(`V4 답 · ${label}: 열쇠 · 비밀 표지 · 빈 일기 · 주사위 태그는 두고 값과 본문만 번역해요`, async () => {
        await t.reset(); t.S.user_defined_regexes = rules;
        const out = await t.translate(V4_REPLY), sent = t.events.join('\n');
        for (const bad of KEYS) assert.ok(!sent.includes(bad), `보내면 안 되는 「${bad}」를 보냈어요\n${sent}`);
        for (const good of ['Tomas Reyes', 'the dockhand', 'Dockhand, smuggler', 'Old Bess', 'the old woman by the nets', 'Night two, the dock', 'He reached for the rope without thinking.', 'Your fingers close on the wet rope'])
            assert.ok(sent.includes(good), `「${good}」를 보내지 않았어요`);
        for (const keep of ['<fate odds="45" roll="72">', '<pass>', '</pass>', '<fail>', '</fail>', '</fate>', `Name: ${ko('Tomas Reyes')}\n`, `Seen as: ${ko('the dockhand')}\n`, `Occupation: ${ko('Dockhand, smuggler')} (secret)\n`,
            ` · Seen as: ${ko('the old woman by the nets')}</extra>`, `<summary>Diaries</summary>`, `- ${ko('Night two, the dock')}: `, '- None\n'])
            assert.ok(out.includes(keep), `「${keep}」가 없어요\n${out}`);
        assert.ok(!/\[\[__|\sa\d+>|⟦\d/.test(out), '자리표시 · 짧은 태그가 남았어요');
        const shown = render(V4_REPLY, out);
        // 운명의 주사위: 실패(72 ≥ 45) 결말만 번역문으로, 결과 막대
        assert.ok(shown.includes(ko('The rope slides through your palm, and the boat slips into the dark.')) && !shown.includes(ko('Your fingers close on the wet rope, and the boat jerks to a stop.')), shown);
        assert.equal(count(shown, 'class="dem-fate"'), 1); assert.ok(shown.includes('rolled 72 · need under 45') && shown.includes('failed'));
        // 새 얼굴: 보이는 이름(Seen as)이 제목 · 비밀은 가려진 채 · 대체 카드 아님
        assert.ok(shown.includes(`<span class="dem-card__title">${ko('the dockhand')}</span><span class="dem-card__tag">Recurring</span>`), shown);
        assert.ok(shown.includes(`<span class="dem-card__title">${ko('the old woman by the nets')}</span><span class="dem-card__tag">Passing</span>`), '단역은 보이는 이름이 제목(진짜 이름이 드러나지 않음)');
        assert.ok(!shown.includes('>New face<'), '대체 카드로 빠졌어요');
        // 일기장: 주인 둘 · 한 줄 · 빈 일기
        assert.equal(count(shown, 'class="dem-diary-keeper"'), 2);
        assert.ok(shown.includes(`<span class="dem-diary-entry__when">${ko('Night two, the dock')}</span>`), shown);
        assert.equal(count(shown, 'class="dem-diary-none"'), 1, '빈 일기(None)');
        assert.ok(!/Recovered|&lt;|\[\[__/.test(shown), shown);
        const before = t.events.length; assert.equal(await t.translate(V4_REPLY), out); assert.equal(t.events.length, before, '다시 번역 요청');
    });
}
await test('원문(번역 전)도 같은 정규식으로 같은 카드 수가 그려져요 — 고정물 · 정규식 확인', async () => {
    const shown = applyDisplayRegexes(V4_REPLY, V4_MODULE_REGEX);
    assert.equal(count(shown, 'class="dem-card dem-new-face'), 2); assert.equal(count(shown, 'class="dem-diary-keeper"'), 2); assert.equal(count(shown, 'class="dem-fate"'), 1);
    for (const part of [FATE, FACE, EXTRA, DIARY]) assert.ok(V4_REPLY.includes(part));
});
console.log(`translator V4 modules: ${passed} passed`);
