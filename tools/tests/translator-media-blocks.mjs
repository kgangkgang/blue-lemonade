// 1.1.3 번역기 그림 · 영상 조각: <video> · <audio> · <svg> · <iframe> · 마크다운 그림 · 맨몸 base64 그림은 보내지 않고 제자리에 원문 그대로,
//   모델이 그림 자리표시(<img> 포함)를 빠뜨려도 원문 문단 자리에 되돌린다. 이런 조각이 없는 답은 예전과 같은 요청을 보낸다.
//   (기능 아이디어: ST-Interpres 1.5.1 — 코드는 옮기지 않음) 유료 호출 없음. 실행: node tools/tests/translator-media-blocks.mjs .
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate } from './translator-preset-harness.mjs';
const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const { MEDIA_BLOCKS, isMediaBlock } = await import(pathToFileURL(path.join(dir, 'media-blocks.js')));
const { HIDDEN_BLOCKS, isHiddenBlock } = await import(pathToFileURL(path.join(dir, 'hidden-blocks.js')));

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const B64 = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'.repeat(3);
const VIDEO = '<video controls src="/user/clips/rain.mp4"><source src="/user/clips/rain.webm" type="video/webm">Rain on the window</video>';
const SVG = '<svg viewBox="0 0 10 10"><text x="1" y="5">Moon</text></svg>';
const MD = '![a quiet harbor at dusk](/user/images/harbor.png)';
const IMG = '<img src="/user/images/a.png" title="A girl walking in rain, soft light">';

await test('조각 하나 전체만 그림 · 영상으로 본다', () => {
    for (const block of [VIDEO, SVG, MD, B64, IMG, '<iframe src="https://example.com/x" title="a > b"></iframe>', '<audio src="/a.mp3">', '<pic prompt="a cat">', '<autopic><scene>rain</scene></autopic>']) {
        assert.equal(isMediaBlock(block), true, block.slice(0, 40));
        assert.equal(isHiddenBlock(block), true, 'droppedPlaceholders 판정도 ' + block.slice(0, 40));
    }
    for (const text of ['', 'Moon rises.', `Moon rises. ${IMG}`, '<b>bold</b>', '<p>text</p>']) assert.equal(isMediaBlock(text), false, text);
});

await test('숨김 블록 목록 맨 뒤에 붙는다 (앞 규칙 번호 그대로)', () => {
    const tail = HIDDEN_BLOCKS.slice(-MEDIA_BLOCKS.length).map(r => r.source);
    assert.deepEqual(tail, MEDIA_BLOCKS.map(r => r.source));
    assert.ok(HIDDEN_BLOCKS[0].source.includes('Context'), '데우스 생각 줄 규칙이 여전히 맨 앞');
});

const t = await loadTranslator(root);

await test('그림 · 영상이 없는 답은 보낸 본문이 예전과 같다(조각 규칙이 아무것도 안 가림)', async () => {
    await t.reset(); t.setReply(fakeTranslate);
    const text = 'The rain kept falling.\n\n"Stay," she said.';
    const out = await t.translate(text);
    assert.equal(t.events.join('\n').includes('[[__VAR_'), false);
    assert.equal(out, fakeTranslate(text));
});

await test('영상 · svg · 마크다운 그림 · base64 는 보내지 않고 제자리에 원문 그대로', async () => {
    await t.reset(); t.setReply(fakeTranslate);
    const text = `The rain kept falling.\n\n${VIDEO}\n\nShe looked up. ${MD}\n\n${SVG}\n\nRaw ${B64} end.`;
    const out = await t.translate(text);
    const sent = t.events.join('\n');
    for (const part of ['<video', 'rain.mp4', 'Rain on the window', '<svg', 'Moon', 'harbor.png', 'quiet harbor', 'base64']) assert.equal(sent.includes(part), false, '보냄: ' + part);
    for (const part of [VIDEO, MD, SVG, B64]) assert.equal(out.includes(part), true, '결과에 원문 그대로: ' + part.slice(0, 30));
});

await test('모델이 그림 자리표시를 빠뜨려도 원문 문단 자리에 돌아온다 (<img> 포함)', async () => {
    await t.reset();
    t.setReply(body => fakeTranslate(body).replace(/\[\[__VAR_\d+__\]\]\n*/g, ''));   // 자리표시를 모두 빠뜨리는 모델
    const text = `The rain kept falling.\n\n${IMG}\n\nShe looked up.\n\n${VIDEO}\n\nThe end.`;
    const out = await t.translate(text);
    assert.ok(out.includes(IMG), '그림이 남는다');
    assert.ok(out.includes(VIDEO), '영상이 남는다');
    assert.ok(out.indexOf(IMG) < out.indexOf(fakeTranslate('She looked up.')), '그림은 제 문단 자리(둘째 문단 앞)');
    assert.ok(out.indexOf(VIDEO) > out.indexOf(fakeTranslate('She looked up.')), '영상은 셋째 문단 자리');
    t.setReply(fakeTranslate);
});

await test('문단 가운데 그림 자리표시를 빠뜨려도 그 문단에 남는다 (예전엔 사라졌어요)', async () => {
    await t.reset();
    t.setReply(body => fakeTranslate(body).replace(/\s*\[\[__VAR_\d+__\]\]/g, ''));
    const out = await t.translate(`The rain kept falling. ${IMG} She looked up.\n\nThe end.`);
    const [first, second] = out.split('\n\n');
    assert.ok(first.includes(IMG), '첫 문단에 그림');
    assert.equal(second, fakeTranslate('The end.'));
    t.setReply(fakeTranslate);
});

console.log(`translator-media-blocks: ${passed} passed`);
