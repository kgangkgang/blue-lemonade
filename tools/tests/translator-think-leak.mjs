// 2.6.4 번역문에 낀 생각 블록 · 메모 태그 (가상 문장).
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { stripDraftLeaks } = await import(new URL('src/addons/translator/translation-segments.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const src = 'Mina bowed neatly.\n\nRex clutched his chest as if struck.\n\n<hurt>\u300cThat is harsh!\u300d</hurt>';
check('inline think block before a paragraph', () => {
    const out = '미나는 단정하게 고개 숙여 인사했다.\n\n<think>Rex uses casual-polite (~su) -> Korean haeyo style with casual flavor, e.g. "~yo". Mina uses polite formal.</think>렉스는 얻어맞은 것처럼 가슴을 움켜쥐었다.\n\n<hurt>\u300c너무해!\u300d</hurt>';
    assert.equal(stripDraftLeaks(out, src), '미나는 단정하게 고개 숙여 인사했다.\n\n렉스는 얻어맞은 것처럼 가슴을 움켜쥐었다.\n\n<hurt>\u300c너무해!\u300d</hurt>');
});
check('thinking / reasoning blocks on their own lines, and an unclosed head', () => {
    const body = '미나는 인사했다.\n\n렉스는 가슴을 움켜쥐었다.';
    assert.equal(stripDraftLeaks('<thinking>\nKeep honorifics consistent.\n</thinking>\n' + body, src), body);
    assert.equal(stripDraftLeaks('<reasoning>Map the register first.</reasoning>\n\n' + body, src), body);
    assert.equal(stripDraftLeaks('<think>Plan the tone of each line before writing\n\n' + body, src).trim(), body);
});
check('unknown tag wrapping an English note not in the source', () => {
    const body = '미나는 인사했다.';
    assert.equal(stripDraftLeaks('<tlnote>Using polite formal speech for Mina throughout.</tlnote>' + body, src), body);
});
check('kept: tags in the source, HTML, emotion tags, Korean content, English that is in the source', () => {
    const s2 = 'He wrote <note>Meet at noon</note> on the card.';
    const t2 = '그는 카드에 <note>Meet at noon</note>이라고 적었다.';
    assert.equal(stripDraftLeaks(t2, s2), t2);
    const t3 = '<span style="color:#3ccfbf">\u300c우와, 너무해!\u300d</span>';
    assert.equal(stripDraftLeaks(t3, src), t3);
    const t4 = '<hurt>\u300c너무해!\u300d</hurt>';
    assert.equal(stripDraftLeaks(t4, src), t4);
    const s5 = 'Inner voice: <think>this is fine</think>, she said.';
    const t5 = '속마음: <think>this is fine</think>, 그녀가 말했다.';
    assert.equal(stripDraftLeaks(t5, s5), t5);
});
console.log(`translator-think-leak: ${passed} passed, 0 failed`);
