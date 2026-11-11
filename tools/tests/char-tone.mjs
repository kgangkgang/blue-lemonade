// 1.1.3 글꾸 색 규칙(src/shared/char-tone.js) — 대사색 하나 → 틀 색 전부 · 대비 4.6 · 색 수 · 레몬
//   node tools/tests/char-tone.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('char-tone');
const { tone, bandColor, fitInk, oklchOf, oklchHex, toneColorCount, toneContrast, speakerColor, LEMON_YELLOW, BAND_ALPHA, INK_TARGET } = await load('src/shared/char-tone.js');
const { contrast, parseColor } = await load('src/shared/ink-paint.js');
const { vividDark } = await load('src/log-copy-lemon.js');

// 지어낸 대사색 — 밝은 · 진한 · 회색 계열 · 색상 고루 + 아주 진한 · 아주 밝은 색
const COLORS = ['#3b9cf0', '#f0559a', '#5a78c8', '#86d84a', '#45c4b6', '#c4ccd6', '#47505e', '#7ea4cc', '#e8d27a', '#f2603f', '#ad92de', '#f59a50', '#d9363e', '#86cfe0', '#6a72cf', '#111111', '#ffffff', '#2277cc', '#ffff00'];
const MODES = ['dark', 'light'], PLANS = ['A', 'B', 'C'];

await test('모든 색 · 낮밤 · 세 안: 본문 · 띠 위 대사 · 이름 · 제목 대비가 4.6 이상(깡통 덮임 문턱 4.5)', () => {
    for (const K of [...COLORS, null]) for (const mode of MODES) for (const plan of PLANS) {
        const t = tone(K, { mode, plan }), c = toneContrast(t);
        assert.ok(c.min >= INK_TARGET - 0.01, `${K} ${mode} ${plan}: ${JSON.stringify(c)}`);
        if (t.rule) assert.ok(contrast(t.rule, t.card) >= INK_TARGET - 0.01, `${K} ${mode} ${plan} 밑줄`);
    }
});

await test('한 틀에 쓰는 서로 다른 색은 9개 이하(지금 마트 중앙값 12)', () => {
    for (const K of [...COLORS, null]) for (const mode of MODES) for (const plan of PLANS) {
        const n = toneColorCount(tone(K, { mode, plan }));
        assert.ok(n <= 9, `${K} ${mode} ${plan}: ${n}색`);
    }
});

await test('A · B 는 무채 바탕(밤 무채 값) · B 는 이름표와 제목 밑줄에만 대사색', () => {
    const a = tone('#3b9cf0', { plan: 'A' }), b = tone('#3b9cf0', { plan: 'B' });
    assert.equal(a.card, '#25272b'); assert.equal(a.log, '#1c1e21'); assert.equal(a.text, '#e1e1e5'); assert.equal(a.dialogue, '#f5f5f7');
    assert.equal(a.name, a.text); assert.equal(a.rule, null);
    assert.equal(b.card, a.card); assert.equal(b.log, a.log);
    assert.equal(b.name, '#3b9cf0');   // 밤 바탕에선 이미 4.6 이상이라 그대로
    assert.notEqual(b.rule, null);
    const day = tone('#3b9cf0', { plan: 'B', mode: 'light' });
    assert.equal(day.card, '#ffffff');
    assert.notEqual(day.name, '#3b9cf0');   // 흰 바탕에선 진하게 옮김
    assert.ok(contrast(day.name, day.log) >= INK_TARGET);
});

await test('대사색이 없으면 B · C 모두 A(무채 기본)와 같아요', () => {
    for (const mode of MODES) {
        const a = tone(null, { mode, plan: 'A' });
        for (const plan of ['B', 'C']) {
            const t = tone(null, { mode, plan });
            for (const key of ['card', 'log', 'line', 'text', 'dialogue', 'band', 'name', 'title', 'rule']) assert.equal(t[key], a[key], `${mode} ${plan} ${key}`);
        }
    }
    for (const bad of ['', 'transparent', 'rgba(0,0,0,0)', 'nope', undefined]) assert.equal(speakerColor(bad), null, String(bad));
});

await test('대사 띠는 알파 .18(회색 계열은 더 옅게) · 같은 색상', () => {
    const band = parseColor(bandColor('#f0559a', 'dark'));
    assert.equal(band.a, BAND_ALPHA);
    assert.ok(Math.abs(oklchOf({ ...band, a: 1 }).h - oklchOf('#f0559a').h) < 3);
    assert.ok(parseColor(bandColor('#c4ccd6', 'dark')).a < BAND_ALPHA);
    assert.ok(parseColor(bandColor('#c4ccd6', 'light')).a < BAND_ALPHA);
    assert.ok(parseColor(bandColor(null, 'light')).a < BAND_ALPHA);
});

await test('레몬: 무채 · 낮 · 회색 계열은 노랑, C 밤(진한 색 바탕)만 대표색이고 바탕 대비 3 이상', () => {
    for (const K of COLORS) for (const mode of MODES) for (const plan of PLANS) {
        const t = tone(K, { mode, plan }), grey = oklchOf(K).c < 0.04;
        if (plan === 'C' && mode === 'dark' && !grey) {
            assert.notEqual(t.lemon.fill, LEMON_YELLOW.fill, `${K}`);
            assert.ok(contrast(t.lemon.fill, t.card) >= 3, `${K} 레몬 대비`);
        } else assert.deepEqual(t.lemon, { ...LEMON_YELLOW }, `${K} ${mode} ${plan}`);
    }
});

await test('C 밤 바탕이 채도 높은 색이면 로그 복사 레몬 판정(vividDark)과 맞아요 — 노랑이 튀는 바탕', () => {
    // 무채 바탕(A · B)은 진한 색 바탕이 아니에요
    for (const K of COLORS) assert.equal(vividDark(tone(K, { plan: 'B' }).card), false, K);
    // 채도 높은 색의 C 밤 바탕은 진한 색 바탕으로 잡혀요
    for (const K of ['#f0559a', '#3b9cf0', '#d9363e']) assert.equal(vividDark(tone(K, { plan: 'C' }).card), true, K);
});

await test('fitInk: 이미 되면 그대로 · 아니면 같은 색상에서 명도만 · 결정적', () => {
    assert.equal(fitInk('#1b64da', '#ffffff'), '#1b64da');
    const out = fitInk('#3182f6', '#ffffff');
    assert.ok(contrast(out, '#ffffff') >= INK_TARGET);
    assert.ok(Math.abs(oklchOf(out).h - oklchOf('#3182f6').h) < 4);
    assert.equal(fitInk('#3182f6', '#ffffff'), out);
    assert.equal(fitInk('nope', '#fff'), null);
    assert.match(oklchHex(0.7, 0.4, 140), /^#[0-9a-f]{6}$/);   // 색역 밖 → 채도 줄여 맞춤
});

await test('결과는 얼려 있어요(고쳐도 다음 부름에 안 새요)', () => {
    const t = tone('#3b9cf0');
    assert.ok(Object.isFrozen(t));
    assert.deepEqual(tone('#3b9cf0'), t);
});

done();
