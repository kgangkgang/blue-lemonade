// 11-19 데우스 V4 새 카드(새 얼굴 · 단역 · 일기장 · 운명의 주사위) — 실제 번역 모델에 가까운 출력 꼴로도 안 깨지는지
//   가짜 번역기 위에, 실제로 쓰는 번역 설정(영어 서술 + 일본어 「」 대사 · 「태그 · 자리표시 그대로」 지시)의 답에서 볼 수 있는 꼴을 입혀요:
//   답 전체를 ``` 로 감쌈 · 굽은 따옴표 · CRLF · 자리표시 뒤 띄어쓰기 · 줄 끝 공백과 빈 줄 · 값 안 쌍점 · 값 안 가운뎃점 · 전각 쌍점 ·
//   끝 자리표시 줄 붙음 · 묶음 번호 뒤 줄바꿈 · 「」 안 일본어만 옮김. 유료 호출 없음.
//   실행: node tools/tests/translator-v4-model-shapes.mjs .
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate, fakeWord, applyDisplayRegexes } from './translator-preset-harness.mjs';
import { V4_REPLY, V4_MODULE_REGEX, FACE } from './translator-v4-module-fixtures.mjs';
const root = path.resolve(process.argv[2] || '.');
const { moduleSafeValue } = await import(pathToFileURL(path.join(root, 'src/addons/translator/v3-modules.js')).href);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const t = await loadTranslator(root);
t.S.translation_display_mode = 'disabled';
const count = (text, part) => String(text).split(part).length - 1;
// 일본어 대사가 섞인 V4 답 (주사위 두 결말 · 단역 칸 · 일기 글에 「」)
const JA_REPLY = `<prose>
Rain hammered the dock as Mira raised the lantern.

「遅いよ、もう…っ」 she muttered.

You lunge for the rope before the boat drifts away.
<fate odds="45" roll="72">
<pass>Your fingers close on the wet rope. 「やった…!」</pass>
<fail>The rope slides through your palm. 「ちょ、待っ…」</fail>
</fate>
</prose>

${FACE}

<extra>Old Bess · female, 70s · net mender · grey shawl · hums 「ふんふん」 while working · Seen as: the old woman by the nets</extra>

<diary>
<summary>Diaries</summary>
<details>
Mira
- Night two, the dock: He reached for the rope without thinking. 「バカみたい」, I thought.
- Day three, the market: We argued about the price: he lost.
Tomas
- None
</details>
</diary>`;
const ja = s => s.replace(/[぀-ヿ一-鿿ー…]+/g, m => fakeWord(m));   // 「」 는 두고 안의 일본어만 (지시문: 괄호 그대로 · 가나 남기지 않기)
const SHAPES = {
    '그대로': b => fakeTranslate(b),
    '답 전체를 ``` 로 감쌈': b => '```\n' + fakeTranslate(b) + '\n```',
    '굽은 따옴표': b => fakeTranslate(b).replace(/"([^"\n]*)"/g, '“$1”'),
    'CRLF': b => fakeTranslate(b).replace(/\n/g, '\r\n'),
    '자리표시 뒤 띄어쓰기': b => fakeTranslate(b).replace(/(\[\[__VAR_\d+__\]\])(?=\S)/g, '$1 '),
    '줄 끝 공백 · 묶음 앞 빈 줄': b => fakeTranslate(b).replace(/\n/g, ' \n').replace(/(⟦\d+⟧)/g, '\n$1'),
    '값 안 쌍점(일기 언제 「둘째 날: 부두」)': b => fakeTranslate(b).replace(/(\[\[__VAR_\d+__\]\])([^\n[]*?), /g, '$1$2: '),
    '값 안 가운뎃점(단역 칸)': b => fakeTranslate(b).replace(/(\[\[__VAR_\d+__\]\])([^\n[,]+), /g, '$1$2 · '),
    '전각 쌍점': b => fakeTranslate(b).replace(/: /g, '： '),
    '끝 자리표시 줄이 앞 줄에 붙음': b => fakeTranslate(b).replace(/\n(\[\[__VAR_\d+__\]\])\n*(?=\n⟦|$)/g, '$1'),
    '묶음 번호 뒤 줄바꿈': b => fakeTranslate(b).replace(/⟦(\d+)⟧ /g, '⟦$1⟧\n'),
};
for (const [label, reply, entries] of [['영어 답', V4_REPLY, 1], ['일본어 대사 답', JA_REPLY, 2]]) {
    await test(`${label}: 모델 답 꼴 ${Object.keys(SHAPES).length}가지 모두 새 얼굴 · 단역 · 일기장 · 주사위가 그대로 그려져요`, async () => {
        for (const [name, shape] of Object.entries(SHAPES)) {
            await t.reset(); t.setReply(body => ja(shape(body)));
            const out = await t.translate(reply), shown = applyDisplayRegexes(t.display(reply, out), V4_MODULE_REGEX), why = `${name}\n${out}`;
            assert.equal(count(shown, 'class="dem-card dem-new-face"'), 1, `주요 새 얼굴 카드 · ${why}`);
            assert.equal(count(shown, 'dem-new-face--minor'), 1, `단역 카드 · ${why}`);
            assert.ok(!shown.includes('>New face<') && !shown.includes('>New faces<'), `대체 카드로 빠짐 · ${why}`);
            assert.ok(!/dem-card__title">[^<]*(?:Tomas|Old Bess)/.test(shown), `진짜 이름이 제목에 · ${why}`);
            assert.ok(/<span class="dem-card__title">[^<]+<\/span><span class="dem-card__tag">Passing<\/span>/.test(shown), `단역 제목(보이는 이름) · ${why}`);
            assert.equal(count(shown, 'class="dem-fate"'), 1, `주사위 막대 · ${why}`); assert.ok(shown.includes('rolled 72 · need under 45'), why);
            assert.ok(!/<\/?(?:pass|fail|fate|face|extra|diary)\b/.test(shown), `날 태그 · ${why}`);
            assert.equal(count(shown, 'class="dem-diary-keeper"'), 2, `일기 주인 · ${why}`);
            assert.equal(count(shown, 'class="dem-diary-entry"'), entries, `일기 줄 · ${why}`);
            assert.equal(count(shown, 'class="dem-diary-none"'), 1, `빈 일기 · ${why}`);
            assert.ok(!/\[\[__|⟦\d/.test(shown), `자리표시 남음 · ${why}`);
            assert.equal(count(shown, '```'), 4, `새 얼굴 카드 코드 칸 둘만 · ${why}`);
            assert.ok(!/[぀-ヿ]/.test(shown), `가나 남음 · ${why}`);
            // 일기 「언제」 는 한 줄 앞부분 그대로(쌍점이 끼어도 글이 밀리지 않아요)
            const whens = [...shown.matchAll(/<span class="dem-diary-entry__when">([^<]*)<\/span><span class="dem-diary-entry__text">([^<]*)</g)];
            assert.equal(whens.length, entries, why);
            assert.ok(whens.every(([, when]) => !/[:：]\s/.test(when)) && whens[0][1].includes(fakeWord('Night')) && whens[0][1].includes(fakeWord('dock')), `일기 언제가 밀림 · ${why}`);
            assert.ok(whens[0][2].startsWith(fakeWord('He')), `일기 글 첫머리 · ${why}`);
        }
    });
}
await test('나눔 기호 지키기: 바로 뒤가 그 카드의 나눔 기호인 칸만 · 다른 카드 · 다른 자리는 그대로', async () => {
    assert.equal(moduleSafeValue('둘째 날: 부두', 'diary', ': 그가'), '둘째 날, 부두');
    assert.equal(moduleSafeValue('둘째 날： 부두', 'diaries', '： 그가'), '둘째 날, 부두');
    assert.equal(moduleSafeValue('글: 끝', 'diary', '\n'), '글: 끝', '일기 글 쪽(뒤가 줄 끝)은 그대로');
    assert.equal(moduleSafeValue('그물 수선공 · 회색 숄', 'extra', ' · 휘파람'), '그물 수선공, 회색 숄');
    assert.equal(moduleSafeValue('보이는 이름 · 둘', 'extra', '</extra>'), '보이는 이름 · 둘', '끝 칸은 그대로');
    assert.equal(moduleSafeValue('값: 둘', 'status', ' | Mental'), '값: 둘', '다른 카드는 그대로');
});
console.log(`translator V4 model shapes: ${passed} passed`);
