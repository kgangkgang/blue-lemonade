// 2.7.0 용어집 이름 지키기가 번역 마지막 · 점검 고치기 저장 · 그릴 때에도 도는지 (연결 검사).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(dir, 'src/addons/translator/index.js'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
check('after the leftover re-translation', () => {
    const fix = src.indexOf('translatedText = applyKanaFix(translatedText, kanaLines, fixed);'), again = src.indexOf('if (kanaLines.length && !isInputTranslation) translatedText = tidyGlossaryOutput(');
    assert(fix > 0 && again > fix, 'tidy runs again after applyKanaFix');
});
check('check-view saves', () => assert.match(src, /async function saveCheckedTranslation[^\n]*\n[^\n]*\n\s*next = tidyGlossaryOutput\(state\.source, next\);/));
check('render hook', () => {
    assert.match(src, /function tidyNamesShown\(source, shown\)/);
    assert.match(src, /restoreDialogueBrackets\(message\.mes, tidyNamesShown\(message\.mes, stripDraftLeaks\(shown, message\.mes\)\)\)/);
});
console.log(`translator-name-wiring: ${passed} passed, 0 failed`);
