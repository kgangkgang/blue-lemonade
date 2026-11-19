// 다시 쓰기 (src/addons/rewrite/core.js) 1.8.7 — 점자 빈칸(U+2800) 원문 · 남은 금지어 확인
//   node tools/tests/rewrite-braille-blank.mjs <테마 루트>   (공개 저장소는 '.')
// 「공백마다 점자 빈칸」 우회 프리셋의 원문은 낱말 사이가 보통 빈칸이 아니라 U+2800 이라(`pocket⠀watch`), 1.8.6 까지는
// 낱말 사이 빈칸 패턴이 맞지 않아 금지 묘사를 하나도 못 찾았다. 모델은 가짜 generate (네트워크 · 유료 호출 없음). 글 · 이름은 지어낸 것.
// 확인하는 것:
//   1) 재현: 점자 빈칸 원문의 두 낱말 금지어(pocket watch)를 찾고, 찾은 자리는 원문 글자 그대로 (태그 속 점자 빈칸도 태그로 가린다)
//   2) /정규식/ 규칙의 \s+ 도 점자 빈칸에 맞는다 · 보통 빈칸 원문은 예전 그대로
//   3) 고친 문장의 빈칸 꼴: 원문이 점자 빈칸만 쓰면 고친 문장도 점자 빈칸 · 섞인 원문은 그대로
//   4) 다시 쓴 뒤 금지어가 남으면 통과시키지 않고 다시 보낸다 — 두 번 나온 금지어를 한 번만 지운 답도 'banned' (전엔 'ok')
//   5) 끝까지 남으면 원문 그대로 · failed 와 left(규칙) 로 알린다 · 다시 보낼 때는 그 문장만
//   6) 이름 규칙(near) · 예외 규칙은 예전처럼 「줄기만 하면」 통과
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const core = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/core.js')).href);
const { compileRule, findSpans, prepareSpans, rewriteText, checkRewrite, matchBlankStyle, maskProtected } = core;

const B = '⠀';
const braille = text => text.replace(/ /g, B);
const watchRule = { id: 'pocket_watch', name: '회중시계', description: 'a pocket watch as a prop', words: 'pocket watch, pocket watches, pocketwatch, pocket-watch, fob watch, 회중시계, 회중 시계' };
const nostrilRule = { id: 'nostril', name: '콧구멍', description: 'flaring nostrils', words: '/\\bnostrils?\\s+flar(?:e|ed|ing)\\b/' };
const compiled = [compileRule(watchRule), compileRule(nostrilRule)];
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok ${name}`); };

// ── 1) 재현 ─────────────────────────────────
const para = braille('<span style="color:#e63946">「Hold still.」</span>\n\nWhen Mina flung her hands out, her right sleeve caught on the spring-clip of Rex\'s pocket watch chain and the lapel of her blouse. The buttons gave way.');
ok('점자 빈칸 원문에서 pocket⠀watch 를 찾는다', () => {
    const spans = findSpans(para, compiled);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].rules[0].id, 'pocket_watch');
    assert.ok(spans[0].text.startsWith(braille('When Mina flung')), spans[0].text);
    assert.ok(spans[0].text.endsWith(braille('of her blouse.')), spans[0].text);
    assert.equal(spans[0].text, para.slice(spans[0].start, spans[0].end), '자리는 원문 그대로');
    assert.ok(spans[0].text.includes(B), '원문의 점자 빈칸을 그대로 돌려준다');
});
ok('태그 속 점자 빈칸(<span⠀style=…>)은 태그로 가려 찾지 않는다', () => {
    const tagOnly = braille('<span title="pocket watch">Hello there.</span>');
    assert.equal(findSpans(tagOnly, compiled).length, 0);
    assert.equal(maskProtected(tagOnly).length, tagOnly.length, '가린 글은 같은 길이');
});
ok('pocket-watch · 회중 시계 꼴도 점자 빈칸으로', () => {
    assert.equal(findSpans(braille('He checks the pocket-watch again.'), compiled).length, 1);
    assert.equal(findSpans(braille('그는 회중 시계를 꺼냈다.'), compiled).length, 1);
    assert.equal(findSpans(braille('그는 회중시계를 꺼냈다.'), compiled).length, 1);
});

// ── 2) 정규식 규칙 · 보통 빈칸 ────────────────
ok('/정규식/ 규칙의 \\s+ 도 점자 빈칸에 맞는다', () => {
    assert.equal(findSpans(braille('Her nostrils flared at that.'), compiled).length, 1);
});
ok('보통 빈칸 원문은 예전 그대로', () => {
    const plain = 'He snaps the pocket watch shut. Then he leaves.';
    const spans = findSpans(plain, compiled);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].text, 'He snaps the pocket watch shut.');
    assert.equal(findSpans('He watches the pocket of her coat.', compiled).length, 0, '떨어진 낱말은 안 걸린다');
    assert.equal(findSpans(braille('He watches the pocket of her coat.'), compiled).length, 0, '점자 빈칸도 마찬가지');
});

// ── 3) 빈칸 꼴 ──────────────────────────────
ok('원문이 점자 빈칸만 쓰면 고친 문장도 점자 빈칸', () => {
    assert.equal(matchBlankStyle(braille('a b c.'), 'x y z.'), braille('x y z.'));
    assert.equal(matchBlankStyle('a b⠀c.', 'x y z.'), 'x y z.', '섞인 원문은 그대로');
    assert.equal(matchBlankStyle('a b c.', 'x y z.'), 'x y z.', '보통 원문은 그대로');
    assert.equal(matchBlankStyle(braille('a b.'), undefined), undefined, '빠진 답은 그대로 빠짐');
});

const fake = answers => {
    const calls = [];
    return {
        calls,
        generate: async messages => { calls.push(messages); const next = answers.shift(); if (next instanceof Error) throw next; return next; },
    };
};

{   // (재현 끝까지) 점자 빈칸 답을 가짜 모델로 고치면 금지어가 사라지고 빈칸 꼴이 지켜진다
    const spans = prepareSpans(findSpans(para, compiled), []);
    const model = fake(['<s1>When Mina flung her hands out, her right sleeve caught on the brass button of Rex\'s waistcoat and the lapel of her blouse.</s1>']);
    const result = await rewriteText({ text: para, spans, exceptions: [], compiled, generate: model.generate, maxAttempts: 5 });
    assert.equal(result.fixed, 1);
    assert.equal(result.failed, 0);
    assert.deepEqual(result.left, []);
    assert.equal(findSpans(result.text, compiled).length, 0, '고친 글에 금지어 없음');
    assert.ok(!result.text.includes('watch'), result.text);
    assert.ok(result.text.includes(braille('brass button of')), '고친 문장도 점자 빈칸');
    assert.ok(!/ /.test(result.text.replace(/<[^>]*>/g, '')), '보통 빈칸이 섞이지 않음');
    assert.ok(result.text.startsWith(braille('<span style="color:#e63946">「Hold still.」</span>')), '앞 문단 그대로');
    assert.equal(model.calls.length, 1);
    passed++; console.log('  ok 가짜 모델로 고친 답');
}

// ── 4) 남은 금지어 ─────────────────────────────
ok('두 번 나온 금지어를 한 번만 지운 답은 banned', () => {
    const text = 'He checks his pocket watch, then pockets the pocket watch.';
    const [span] = prepareSpans(findSpans(text, compiled), []);
    assert.equal(checkRewrite(span, 'He checks the clock, then pockets the pocket watch.', compiled), 'banned');
    assert.equal(checkRewrite(span, 'He checks the clock, then pockets his notebook.', compiled), 'ok');
    assert.equal(checkRewrite(span, braille('He checks the clock, then pockets the pocket watch.'), compiled), 'banned', '점자 빈칸으로 남겨도 banned');
});
{
    const text = braille('He checks his pocket watch, then pockets the pocket watch. She smiles.');
    const spans = prepareSpans(findSpans(text, compiled), []);
    const model = fake([
        '<s1>He checks the clock, then pockets the pocket watch.</s1>',   // 하나 남김 → 다시
        '<s1>He checks the clock, then pockets his notebook.</s1>',
    ]);
    const result = await rewriteText({ text, spans, exceptions: [], compiled, generate: model.generate, maxAttempts: 5 });
    assert.equal(model.calls.length, 2, '남은 금지어 때문에 한 번 더 보냈다');
    assert.ok(model.calls[1][0].content.includes('previous answer was rejected'), '두 번째는 다시 보내는 안내');
    assert.equal(result.fixed, 1);
    assert.equal(findSpans(result.text, compiled).length, 0);
    assert.ok(result.text.endsWith(braille('his notebook. She smiles.')));
    passed++; console.log('  ok 남은 금지어 → 다시 보냄 → 고침');
}

// ── 5) 끝까지 남으면 ────────────────────────────
{
    const text = braille('Mina sighs. He snaps the pocket watch shut. Rain falls. Her nostrils flared.');
    const spans = prepareSpans(findSpans(text, compiled), []);
    assert.equal(spans.length, 2);
    const stubborn = '<s1>He snaps the pocket watch shut with a click.</s1>';
    const model = fake([
        `${stubborn}\n<s2>She exhales slowly.</s2>`,
        stubborn, stubborn, stubborn, stubborn,
    ]);
    const result = await rewriteText({ text, spans, exceptions: [], compiled, generate: model.generate, maxAttempts: 5 });
    assert.equal(model.calls.length, 5, '시도 다 씀');
    assert.equal(result.fixed, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.left.length, 1);
    assert.equal(result.left[0].rules[0].name, '회중시계', '알림에 남은 규칙 이름');
    const tagged = call => call[1].content.split('Tagged sentences to rewrite:')[1];
    assert.ok(tagged(model.calls[0]).includes('<s2>'), '처음엔 두 문장');
    assert.ok(model.calls.slice(1).every(call => !tagged(call).includes('nostrils') && tagged(call).includes('pocket') && !tagged(call).includes('<s2>')), '다시 보낼 때는 못 고친 문장만');
    assert.ok(result.text.includes(braille('He snaps the pocket watch shut.')), '못 고친 문장은 원문 그대로');
    assert.ok(result.text.includes(braille('She exhales slowly.')), '고친 문장은 적용');
    passed++; console.log('  ok 끝까지 남으면 원문 그대로 · left 로 알림');
}
{
    // 모델이 「우연히 맞음」이라며 그대로 돌려주면(kept) 예전처럼 다시 보내지 않는다 — 알림의 「그대로 뒀어요」 몫
    const text = braille('He snaps the pocket watch shut.');
    const spans = prepareSpans(findSpans(text, compiled), []);
    const model = fake([`<s1>${braille('He snaps the pocket watch shut.')}</s1>`]);
    const result = await rewriteText({ text, spans, exceptions: [], compiled, generate: model.generate, maxAttempts: 5 });
    assert.equal(model.calls.length, 1);
    assert.equal(result.fixed + result.failed, 0);
    passed++; console.log('  ok 그대로 돌려준 답(kept)은 예전 그대로');
}

// ── 6) 이름 규칙 · 예외 ─────────────────────────
ok('예외 규칙은 줄기만 하면 통과 (예전 그대로)', () => {
    const text = 'He checks his pocket watch, then pockets the pocket watch.';
    const [span] = prepareSpans(findSpans(text, compiled), [{ names: 'Rex', allow: ['pocket_watch'] }]);
    assert.ok(span.exempt);
    assert.equal(checkRewrite(span, 'He checks the clock, then pockets the pocket watch.', compiled), 'ok');
});
ok('이름 규칙(near)은 줄기만 하면 통과 (예전 그대로)', () => {
    const near = compileRule({ ...watchRule, id: 'near_watch' });
    near.rule.nearNames = ['Mina'];
    const text = 'Mina checks her pocket watch while Rex taps his pocket watch.';
    const spans = prepareSpans(findSpans(text, [near]), []);
    assert.equal(spans.length, 1);
    assert.equal(checkRewrite(spans[0], 'Mina checks the clock while Rex taps his pocket watch.', [near]), 'ok');
});

// ── 7) 같은 종류: 장면 계획 시작 검사 ─────────────
ok('장면 계획: 앞머리 · 사이 점자 빈칸이어도 시작 태그를 본다', () => {
    const start = core.compilePattern('<scene_plan, scene note', { anchored: true });
    assert.equal(core.checkReplyStart(`${B}${B}<scene_plan>${braille('a b')}</scene_plan>${braille('\nThe story goes on.')}`, start), 'ok');
    assert.equal(core.checkReplyStart(braille('scene note: rain.\nStory.'), start), 'ok');
    assert.equal(core.checkReplyStart(braille('Story without plan.'), start), 'missing');
    const marker = core.compilePattern('scene plan guide');
    assert.equal(core.promptHasMarker([{ role: 'system', content: braille('use the scene plan guide here') }], marker), true);
});

console.log(`rewrite-braille-blank: ${passed} 통과`);
