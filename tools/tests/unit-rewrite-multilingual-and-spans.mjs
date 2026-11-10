// 다시 쓰기 — 여러 언어 낱말 표(src/addons/rewrite/multilingual.js)와 워커 찾기 창구(src/addons/rewrite/spans.js)
//   node tools/tests/unit-rewrite-multilingual-and-spans.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-rewrite-multilingual-and-spans');
const { MULTILINGUAL_WORDS, NOSTRIL_RULE, GLOVES_KO_1_9_3, PAINTED_NAILS_MULTI, multilingualNear } = await load('src/addons/rewrite/multilingual.js');
const { createSpanHandler, createSpanFinder } = await load('src/addons/rewrite/spans.js');

// 규칙 글에서 /정규식/ 줄만 뽑아 컴파일 (실제 엔진과 같은 giu)
const regexLines = words => words.split('\n').filter(line => /^\/.*\/$/.test(line)).map(line => new RegExp(line.slice(1, -1), 'giu'));
const hits = (words, text) => regexLines(words).some(re => re.test(text));

await test('표의 정규식 줄은 모두 giu 로 컴파일돼요', () => {
    for (const [name, words] of Object.entries({ ...MULTILINGUAL_WORDS, nostril: NOSTRIL_RULE.words, nails: PAINTED_NAILS_MULTI, gloves193: GLOVES_KO_1_9_3 })) {
        assert.doesNotThrow(() => regexLines(words), name);
    }
    assert.ok(regexLines(MULTILINGUAL_WORDS.user_colors).length >= 6);
});

await test('장갑: 갑옷 뜻(장갑차 · 중장갑 · 장갑 차량)은 잡지 않아요', () => {
    const w = MULTILINGUAL_WORDS.gloves;
    assert.ok(hits(w, '검은 장갑을 꼈다'));
    for (const text of ['장갑차가 지나갔다', '장갑판', '중장갑 보병', '경장갑', '장갑 차량', '장갑을 두른 전차']) assert.ok(!hits(w, text), text);
});

await test('색 + 신체 묘사: 한 · 일 · 중 앞뒤 순서 모두', () => {
    const w = MULTILINGUAL_WORDS.user_colors;
    for (const text of ['검은 머리카락', '눈동자는 푸른', '黒い髪', '瞳は青い', '黑色的头发', '眼睛是蓝色']) assert.ok(hits(w, text), text);
    for (const text of ['검은 고양이', '머리가 아프다', '黒い猫']) assert.ok(!hits(w, text), text);
});

await test('코 벌렁거림 규칙: 세 언어와 영어', () => {
    const w = NOSTRIL_RULE.words;
    for (const text of ['Her nostrils flared.', 'flaring his nostrils', '코를 벌름거렸다', '콧구멍이 살짝 벌렁', '小鼻がひくひく', '鼻翼微微翕动']) assert.ok(hits(w, text), text);
    for (const text of ['코를 풀었다', 'He has a nose.', '鼻が高い']) assert.ok(!hits(w, text), text);
    assert.equal(NOSTRIL_RULE.id, 'nostril_flare');
});

await test('multilingualNear: 이미 있는 대명사만 다른 언어로 넓혀요', () => {
    assert.equal(multilingualNear('she, Anna'), 'she, Anna, 그녀, 그녀의, 彼女, 她');
    assert.equal(multilingualNear('Your\nAnna, anna'), 'Your, Anna, anna, 당신, 너의, 네, あなた, 君, 你, 您');
    assert.equal(multilingualNear('Anna'), 'Anna', '이름만 적은 목록은 이름으로만 남아요');
    assert.equal(multilingualNear(''), '');
    assert.equal(multilingualNear(null), '');
    assert.equal(multilingualNear('she, 그녀'), 'she, 그녀, 그녀의, 彼女, 她', '겹치는 낱말은 한 번만');
});

// ── spans.js ──
const core = {
    compiled: 0,
    compileRule({ words }) { core.compiled++; return { regexes: [new RegExp(words, 'gu')] }; },
    findSpans(text, active) {
        const out = [];
        for (const { rule, regexes } of active) for (const re of regexes) { re.lastIndex = 0; for (const m of text.matchAll(re)) out.push({ start: m.index, end: m.index + m[0].length, rules: [rule] }); }
        return out;
    },
};

await test('워커 쪽 처리기: 규칙을 번호로 돌려주고 컴파일을 기억해요', () => {
    core.compiled = 0;
    const handle = createSpanHandler(core);
    const rules = [{ words: '가' }, { words: '나' }];
    assert.deepEqual(handle({ text: '가나가', rules }), [{ start: 0, end: 1, rules: [0] }, { start: 2, end: 3, rules: [0] }, { start: 1, end: 2, rules: [1] }]);
    handle({ text: '가', rules: JSON.parse(JSON.stringify(rules)) });
    assert.equal(core.compiled, 2, '같은 규칙 글은 다시 컴파일하지 않아요');
    assert.deepEqual(handle({ text: null, rules }), []);
});

await test('워커 쪽 처리기: 기억은 limit 개까지만', () => {
    core.compiled = 0;
    const handle = createSpanHandler(core, 2);
    for (const words of ['a', 'b', 'c']) handle({ text: '', rules: [{ words }] });
    handle({ text: '', rules: [{ words: 'a' }] });
    assert.equal(core.compiled, 4, '밀려난 규칙은 다시 컴파일해요');
});

function fakeWorker(reply) {
    const w = { terminated: false, posted: [], terminate() { w.terminated = true; }, postMessage(message) { w.posted.push(message); reply?.(w, message); } };
    return w;
}
const timers = () => {
    const list = [];
    return { list, setTimer: fn => { list.push(fn); return list.length - 1; }, clearTimer: id => { list[id] = null; }, fire() { for (const fn of list.splice(0)) fn?.(); } };
};

await test('화면 쪽: 워커 답의 번호를 규칙 객체와 글 조각으로 되돌려요', async () => {
    const handle = createSpanHandler(core), t = timers();
    const finder = createSpanFinder({ createWorker: () => fakeWorker((w, m) => queueMicrotask(() => w.onmessage({ data: { id: m.id, spans: handle(m) } }))), fallback: () => assert.fail('fallback 을 쓰면 안 돼요'), ...t });
    const active = [{ rule: { words: '나', name: 'r' } }];
    const spans = await finder.find('가나다', active);
    assert.deepEqual(spans, [{ start: 1, end: 2, rules: [active[0].rule], text: '나' }]);
    assert.equal(spans[0].rules[0], active[0].rule, '사본이 아니라 넘긴 규칙 객체예요');
    assert.equal(finder.broken, false);
});

await test('화면 쪽: 워커를 못 만들면 그 뒤로 fallback 만 써요', async () => {
    let made = 0; const warns = [];
    const finder = createSpanFinder({ createWorker: () => { made++; throw Error('no worker'); }, fallback: text => [{ start: 0, end: text.length }], warn: m => warns.push(m) });
    assert.deepEqual(await finder.find('가나', []), [{ start: 0, end: 2 }]);
    assert.deepEqual(await finder.find('다', []), [{ start: 0, end: 1 }]);
    assert.equal(made, 1);
    assert.equal(finder.broken, true);
    assert.equal(warns.length, 1);
});

await test('화면 쪽: 워커 오류 답이면 fallback 으로 끝내고 워커를 닫아요', async () => {
    let worker;
    const finder = createSpanFinder({ createWorker: () => (worker = fakeWorker((w, m) => queueMicrotask(() => w.onmessage({ data: { id: m.id, error: 'boom' } })))), fallback: () => ['fb'], ...timers() });
    assert.deepEqual(await finder.find('가', [{ rule: { words: '가' } }]), ['fb']);
    assert.equal(finder.broken, true);
    assert.equal(worker.terminated, true);
});

await test('화면 쪽: 시간 초과면 빈 결과로 끝내고 그 규칙 조합만 막아요', async () => {
    const t = timers(), workers = [];
    const finder = createSpanFinder({ createWorker: () => { const w = fakeWorker(); workers.push(w); return w; }, fallback: () => assert.fail('시간 초과 뒤 화면에서 다시 돌리면 안 돼요'), ...t });
    const slow = [{ rule: { words: '(a+)+$' } }], other = [{ rule: { words: '가' } }];
    const pending = finder.find('aaaa', slow);
    t.fire();
    assert.deepEqual(await pending, []);
    assert.equal(finder.timeouts, 1);
    assert.equal(finder.isBlocked(slow), true);
    assert.equal(finder.isBlocked(other), false);
    assert.equal(workers[0].terminated, true);
    assert.deepEqual(await finder.find('aaaa', slow), [], '막힌 조합은 워커에 보내지 않아요');
    assert.equal(workers.length, 1);
    assert.equal(finder.broken, false, '시간 초과는 고장이 아니에요 — 다른 조합은 새 워커로 찾아요');
    finder.find('가', other);
    assert.equal(workers.length, 2);
});

done();
