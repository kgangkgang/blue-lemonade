// 1.9.8 옮길 글자가 없는 문단(사용자 11-21 사진: 「11:59:53. 11:59:54. 11:59:55.」 문단 끝 노란 세모 — 「번역할 것도 없는데 왜 삼각형 뜸」)
//   ① 번역 점검: 숫자 · 시각 · 기호 · 이모지 · 한글뿐인 문단 · 고유 이름 한 낱말뿐인 문단은 「원문 그대로」로 보지 않아요(옮길 낱말이 있는 문단은 예전처럼 봐요).
//   ② 번역 요청: 글자(\p{L})가 하나도 없는 문단은 보내지 않고 제자리에 원문 그대로(숨김 블록 맨 뒤 — 이런 문단이 없는 답의 요청 · 번호 · 캐시 키는 그대로).
//   문단 수 · 문단 번호 맞대기는 그대로예요. 유료 호출 없음. 실행: node tools/tests/translator-no-letter.mjs .
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate } from './translator-preset-harness.mjs';
const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const { checkTranslation, needsTranslation, paragraphSlices } = await import(pathToFileURL(path.join(dir, 'translation-check.js')));
const { HIDDEN_BLOCKS, NO_LETTER_PARAGRAPH, isHiddenBlock } = await import(pathToFileURL(path.join(dir, 'hidden-blocks.js')));

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const CLOCK = '11:59:53. 11:59:54. 11:59:55. 11:59:56. 11:59:57.';

await test('옮길 낱말: 숫자 · 시각 · 기호 · 이모지 · 한글 · 이름 한 낱말은 없음, 낱말 둘 · 일본어 문장은 있음', () => {
    for (const s of [CLOCK, '★★★ ✨🎉', '---', '소라 🎉 12:00', 'Sora', '佐藤', 'サクラ', '「……」', '**3.**']) assert.equal(needsTranslation(s), false, s);
    for (const s of ['Hello there', 'Привет мир', '今日はいい天気ですね', 'She smiled.']) assert.equal(needsTranslation(s), true, s);
});

await test('점검: 시각만 있는 문단은 원문 그대로 세모를 안 달아요(옮길 낱말이 있는 영어 문단은 예전처럼 달아요)', () => {
    const src = `He looked at the watch for a long long time.\n\n${CLOCK}\n\n"Midnight," he whispered quietly to himself.`;
    const out = `그는 오랫동안 시계를 보았다.\n\n${CLOCK}\n\n"자정이야." 그가 조용히 속삭였다.`;
    const r = checkTranslation(src, out);
    assert.equal(r.aligned, true); assert.equal(r.flagged, 0); assert.equal(r.warn, false);
    const left = `그는 오랫동안 아무 말 없이 낡은 손목시계의 바늘만 가만히 내려다보았다. 방 안은 조용했고 창밖에서는 빗소리만 들렸다.\n\n${CLOCK}\n\n"Midnight," he whispered quietly to himself.`;
    const r2 = checkTranslation(src, left);
    assert.deepEqual(r2.paragraphs.map(p => [p.index, p.reasons]), [[2, ['same']]], '번역 안 된 영어 문단은 그대로 잡아요');
    // 이름 한 낱말 · 이모지 · 한글뿐인 문단도
    const s3 = `The rain kept falling on the old tin roof all night.\n\n✨🎉 ★★★ 12:00 — 00:00:01\n\nAlexandrovna\n\n소라 🎉 12:00 12:00 12:00 12:00`;
    const o3 = `밤새 낡은 양철 지붕 위로 비가 계속 내렸다.\n\n✨🎉 ★★★ 12:00 — 00:00:01\n\nAlexandrovna\n\n소라 🎉 12:00 12:00 12:00 12:00`;
    assert.equal(checkTranslation(s3, o3).flagged, 0);
});

await test('글자 없는 문단 규칙: 문단 통째일 때만 · 태그 · 자리표시 · 글자가 끼면 안 맞아요 · 숨김 블록 맨 뒤', () => {
    assert.equal(HIDDEN_BLOCKS.at(-1), NO_LETTER_PARAGRAPH);
    const t = `She looked at the clock.\n\n${CLOCK}\n\n"Midnight," he said.\n\n✨🎉 ★★★\n\n<b>12:00</b>\n\n[[__VAR_0__]]\n\n소라.\n\n12:00 Sora\n\n⠀ ---`;
    assert.deepEqual([...t.matchAll(NO_LETTER_PARAGRAPH)].map(m => m[0]), [CLOCK, '✨🎉 ★★★', '⠀ ---']);
    assert.equal([...'Time: 11:59'.matchAll(NO_LETTER_PARAGRAPH)].length, 0, '한 줄 안 일부는 안 건드려요');
    assert.equal(isHiddenBlock(CLOCK), true, '모델이 자리표시를 빠뜨려도 제자리에 되돌릴 블록');
    assert.equal(isHiddenBlock('소라'), false, '한글뿐인 문단은 보내요(입력 번역은 한국어를 옮겨요)');
});

const t = await loadTranslator(root);

await test('요청: 시각 문단은 안 보내고 제자리에 원문 그대로 · 문단 수 같음', async () => {
    await t.reset(); t.setReply(fakeTranslate);
    const text = `He looked at the watch.\n\n${CLOCK}\n\n"Midnight," he whispered.`;
    const out = await t.translate(text);
    const sent = t.events.join('\n');
    assert.equal(sent.includes('11:59:5'), false, '시각 문단은 보내지 않아요');
    assert.ok(out.includes(CLOCK), '번역문 그 자리에 원문 그대로');
    assert.equal(paragraphSlices(out).length, paragraphSlices(text).length, '문단 수 같음');
    assert.equal(paragraphSlices(out)[1].body.trim(), CLOCK, '둘째 문단 자리 그대로');
    assert.equal(checkTranslation(text, out)?.flagged ?? 0, 0);
});

await test('요청: 글자 없는 문단이 없는 답은 보낸 본문이 예전과 같아요(자리표시 0)', async () => {
    await t.reset(); t.setReply(fakeTranslate);
    const text = 'The rain kept falling.\n\n"Stay," she said at 11:59.';
    const out = await t.translate(text);
    assert.equal(t.events.join('\n').includes('[[__VAR_'), false);
    assert.equal(out, fakeTranslate(text));
});

await test('요청: 모델이 자리표시를 빠뜨려도 시각 문단이 제 자리에 돌아와요', async () => {
    await t.reset();
    t.setReply(body => fakeTranslate(body).replace(/\[\[__VAR_\d+__\]\]\n*/g, ''));
    const text = `He looked at the watch.\n\n${CLOCK}\n\n"Midnight," he whispered.`;
    const out = await t.translate(text);
    assert.ok(out.includes(CLOCK));
    assert.ok(out.indexOf(CLOCK) < out.indexOf(fakeTranslate('"Midnight," he whispered.')), '둘째 문단 자리');
});

console.log(`translator-no-letter: ${passed} passed, 0 failed`);
