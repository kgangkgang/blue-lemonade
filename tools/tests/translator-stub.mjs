// 2.5.3: a half-translated extra paragraph ending in the model's bare "translate." is dropped (new translations and stored ones at display).
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { stripDraftLeaks } = await import(new URL('src/addons/translator/translation-segments.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const src = [
    'A chime rang out. The doors parted on the fourth floor, opening onto the corridor of the records office.',
    'Standing just outside the threshold was Bram, holding a thick stack of files bound with red and white ribbons.',
    'The air in the small cabin spilled out into the hallway.',
].join('\n\n');
const good = [
    '띵, 하는 알림음이 울렸다. 4층에서 문이 열리며 기록실 복도가 모습을 드러냈다.',
    '문턱 바로 바깥에 서 있던 것은 브램이었다. 그는 빨간색과 흰색 리본으로 묶은 두툼한 서류 뭉치를 들고 있었다.',
    '좁은 공간의 공기가 복도로 흘러넘쳤다.',
];
check('extra half paragraph + bare translate. is dropped', () => {
    const out = [good[0], '서류 처리용 판정 파일 더미... translate.', good[1], good[2]].join('\n\n');
    assert.equal(stripDraftLeaks(out, src), good.join('\n\n'));
});
check('ellipsis/dash variants and Translation:', () => {
    for (const stub of ['서류 더미… Translate', '서류 더미 — translation:', '서류 더미. translate!']) {
        assert.equal(stripDraftLeaks([good[0], stub, good[1], good[2]].join('\n\n'), src), good.join('\n\n'), stub);
    }
});
check('same paragraph count: only the tail goes, the sentence stays', () => {
    const out = [good[0], good[1] + '... translate.', good[2]].join('\n\n');
    assert.equal(stripDraftLeaks(out, src), good.join('\n\n'));
});
check('source that really says translate is kept', () => {
    const s = 'She whispered, "translate."\n\nHe nodded.';
    const t = '그녀가 속삭였다. 「translate.」\n\n그가 고개를 끄덕였다.';
    assert.equal(stripDraftLeaks(t, s), t);
});
check('normal translations untouched', () => {
    assert.equal(stripDraftLeaks(good.join('\n\n'), src), good.join('\n\n'));
    const t = '그는 번역(translate)이라는 단어를 적었다.\n\n' + good[1] + '\n\n' + good[2];
    assert.equal(stripDraftLeaks(t, src), t);
});
console.log(`translator-stub: ${passed} passed, 0 failed`);
