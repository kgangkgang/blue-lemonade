// 2.6.8 번역 모델의 작업 메모 줄 — 반쪽 원문 + translate 꼬리 · 지시문 되풀이 · 영어/한국어 말투 메모 (가상 문장).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const root = pathToFileURL(dir + '/');
const { stripDraftLeaks, stripPlanningNotes } = await import(new URL('src/addons/translator/translation-segments.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const src = [
    '<span style="color:#7fb36a">「三番です。カードでお願いします。」</span>',
    'A soft beep rang out when Rex pressed the ticket to the gate, and a moment later the bar lifted.',
    'Mina waited by the pillar.',
].join('\n\n');
const good = [
    '<span style="color:#7fb36a">「3번입니다. 카드로 부탁드립니다.」</span>',
    '렉스가 표를 개찰구에 대자 짧은 삑 소리가 났고, 곧 차단봉이 올라갔다.',
    '미나는 기둥 옆에서 기다렸다.',
];
const leaked = (...notes) => [good[0], ...notes, good[1], good[2]].join('\n\n');
const STUB = 'A soft beep rang out... translate.';
const EN_PLAN = 'Rex speaks polite 僕 with ます → 해요체 / 합쇼체 mix. Monologue in VAR brackets is plain internal thought → 반말 internal.';
const KO_PLAN = "렉스는 정중한 일인칭 '저'와 '-ㅂ니다' 어미로 말한다 → 해요체 / 합쇼체 혼용. VAR 괄호 안의 독백은 평서형 속마음 → 반말 속마음.";
const ECHO = 'Keep spans and placeholders.';
check('stub + English plan + instruction echo between paragraphs are removed', () => {
    assert.equal(stripDraftLeaks(leaked(STUB, EN_PLAN, ECHO), src), good.join('\n\n'));
    assert.equal(stripPlanningNotes(leaked(STUB, EN_PLAN, ECHO), src), good.join('\n\n'));
});
check('a plan note already turned into Korean is removed too', () => {
    assert.equal(stripDraftLeaks(leaked(STUB, KO_PLAN, ECHO), src), good.join('\n\n'));
    assert.equal(stripDraftLeaks(leaked(KO_PLAN), src), good.join('\n\n'));
});
check('other instruction echoes', () => {
    for (const note of ['Preserve the tags as-is.', "Don't translate the placeholders.", 'Keep the HTML spans and line breaks unchanged.'])
        assert.equal(stripDraftLeaks(leaked(note), src), good.join('\n\n'), note);
});
check('kept: story text with arrows or speech words, dialogue, English copied from the source, English output', () => {
    const keep = [
        '출구 → 2층 엘리베이터 쪽으로 가라는 표지판이 보였다.',
        '그는 반말로 하라고 했다.',
        '「존댓말 → 반말로 말투 바꿔도 돼? 속마음은 비밀이야.」',
        '그는 메모에 존댓말 → 반말이라고만 적었다.',
    ];
    for (const line of keep) assert.equal(stripDraftLeaks(leaked(line), src), leaked(line), line);
    const s2 = 'The sign read: Keep all tags intact.\n\nMina laughed.';
    const t2 = '표지판에는 이렇게 적혀 있었다.\n\nKeep all tags intact.\n\n미나가 웃었다.';
    assert.equal(stripDraftLeaks(t2, s2), t2, 'English line that is in the source');
    const s3 = 'He muttered, "Wait... translate."';
    const t3 = '그가 중얼거렸다.\n\nHe muttered, "Wait... translate."';
    assert.equal(stripPlanningNotes(t3, s3), t3, 'stub-looking line copied from the source');
    const s4 = '렉스가 웃었다.\n\n미나가 고개를 끄덕였다.';
    const t4 = 'Keep spans and placeholders.\n\nRex smiled.\n\nMina nodded.';
    assert.equal(stripPlanningNotes(t4, s4), t4, 'translation into English: only the old arrow rule applies');
    const s5 = 'Not a stub: the half sentence is not from the source.';
    const t5 = '첫 문단이다.\n\nThe wind howled... translate.';
    assert.equal(stripPlanningNotes(t5, s5), t5, 'stub head not in the source');
});
check('wiring: draft-leak filter runs before the leftover re-translation on the whole / chunk paths, and calls the planning filter', () => {
    const index = fs.readFileSync(path.join(dir, 'src/addons/translator/index.js'), 'utf8');
    const early = index.indexOf('const early = stripDraftLeaks(translatedText, maskedText)'), kana = index.indexOf('const kanaLines = paragraphParts ? [] : linesToFix(');
    assert(early > 0 && kana > early, 'early strip before linesToFix');
    const seg = fs.readFileSync(path.join(dir, 'src/addons/translator/translation-segments.js'), 'utf8');
    assert.match(seg, /const cleaned = stripPlanningNotes\(out, src\)/);
});
console.log(`translator-meta-lines: ${passed} passed, 0 failed`);
