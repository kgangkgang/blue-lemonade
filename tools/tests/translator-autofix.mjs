// 2.6.6 번역 점검: 의심 문단은 자동으로 고치고(같은 원문에 3번까지) · 이상 없으면 번역 단추에 아무것도 안 그린다 (가상 문장).
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const buttons = [];
globalThis.document = { querySelectorAll: () => buttons, addEventListener() {}, removeEventListener() {} };
globalThis.requestIdleCallback = undefined;
const { createCheckView } = await import(pathToFileURL(path.join(root, 'src/addons/translator/check-view.js')).href);
const { checkTranslation } = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-check.js')).href);
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const source = ['Mina opened the door and looked around the quiet hall.', 'Rex waved from the far end of the corridor, grinning.', 'They walked together toward the elevator without a word.'].join('\n\n');
const good = ['미나는 문을 열고 조용한 홀을 둘러보았다.', '렉스가 복도 끝에서 씩 웃으며 손을 흔들었다.', '두 사람은 말없이 함께 엘리베이터 쪽으로 걸어갔다.'].join('\n\n');
const missing = ['미나는 문을 열고 조용한 홀을 둘러보았다.', '렉스가 복도 끝에서 씩 웃으며 손을 흔들었다. (Note: keep the casual tone here.)', '두 사람은 말없이 함께 엘리베이터 쪽으로 걸어갔다.'].join('\n\n');   // 혼잣말 꼬리가 남은 문단
await check('a suspicious translation is fixed automatically, once per try, up to three tries', async () => {
    const r = checkTranslation(source, missing, {});
    assert(r.warn && r.flagged >= 1, JSON.stringify(r.paragraphs.map(p => p.reasons)));
    const calls = [];
    let translation = missing;
    const view = createCheckView({ stateOf: () => ({ source, translation, protect: [], key: `k${calls.length}` }), rerender() {}, act: (...args) => { calls.push(args); return Promise.resolve(); } });
    view.schedule(5); await wait(400);
    assert.equal(calls.length, 1); assert(['fill', 'retry', 'clean'].includes(calls[0][0]), calls[0][0]); assert.equal(calls[0][1], 5); assert.deepEqual(calls[0][4], { auto: true });
    for (let n = 0; n < 4; n++) { view.schedule(5); await wait(350); }   // 같은 원문 · 여전히 이상 → 3번에서 멈춘다
    assert.equal(calls.length, 3);
});
await check('a clean translation triggers nothing and paints no badge', async () => {
    const calls = []; const button = { style: {}, dataset: {}, setAttribute() {}, removeAttribute() {} };
    buttons.splice(0, buttons.length, button);
    const view = createCheckView({ stateOf: () => ({ source, translation: good, protect: [], key: 'ok' }), rerender() {}, act: (...a) => { calls.push(a); return Promise.resolve(); } });
    view.schedule(7); await wait(400);
    assert.equal(calls.length, 0); assert.equal(button.dataset.llmtCheck, undefined);
});
await check('wiring: runCheckAction takes { auto } and the setting text says it fixes automatically', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.match(src, /async function runCheckAction\(kind, id, index, row, \{ auto = false, expectedState = null, manualReview = false \} = \{\}\)/);
    assert.match(fs.readFileSync(path.join(root, 'src/addons/translator/index.html'), 'utf8'), /번역 점검 · 자동 고치기/);
});
console.log(`translator-autofix: ${passed} passed, 0 failed`);
