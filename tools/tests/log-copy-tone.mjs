// 1.1.3 로그 복사 「깡통 로그」 틀(src/log-copy-tone.js) — 어두운 무채 틀 · 화자 색 · 띠 .18 · 글꼴 통일 · 이름표 자동 · 대비
//   node tools/tests/log-copy-tone.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-tone');
const { drawTone, speakersOf, messageSpeakerColor, retintModel, LOG_FONT, TONE_SHAPES } = await load('src/log-copy-tone.js');
const { tone, BAND_ALPHA } = await load('src/shared/char-tone.js');
const { contrast, parseColor } = await load('src/shared/ink-paint.js');

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', RIDIBatang, serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.3px', 'line-height': '24px', 'word-break': 'normal' };
// 화면에서 떠 온 꼴: 바깥 조각이 화자 색 글자, 안쪽 조각이 흰 글자 + 진한 띠(.35)
const dialogue = (color, text, alpha = 0.35) => {
    const c = parseColor(color);
    return { t: 'el', block: false, tag: 'span', style: { color }, children: [{ t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }] };
};
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN, 'text-indent': '15px' }, children });
const msg = (name, nodes, extra = {}) => ({ index: 0, user: false, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: { 'background-color': 'rgb(40, 40, 40)' }, nodes, ...extra });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });

const gabe = msg('Mina', [para(dialogue('rgb(59, 156, 240)', '「잠깐 시간 괜찮으세요?」'))]);
const kkang = msg('하루', [para({ t: 'text', text: '하루는 상자를 내밀었다. ' }, dialogue('rgb(196, 204, 214)', '「이거 두고 갔더라.」', 0.18))], { user: true });

await test('틀 셋이 있고 기본 「깡통 로그」는 B안(무채 바탕)', () => {
    assert.deepEqual(TONE_SHAPES, ['kkangtong', 'kkangtong-mini', 'kkangtong-deep']);
    const { html, tone: t } = drawTone('kkangtong', model([gabe]), { fields: { title: '' } });
    assert.equal(t.plan, 'B'); assert.equal(t.card, '#25272b'); assert.equal(t.log, '#1c1e21');
    assert.match(html, /background-color:#25272b/);
    assert.doesNotMatch(html, /padding:16px;background-color/);   // 바깥 배경판 없음
});

await test('화자 색: 띠 색에서 읽어요 · 인물표(정해 둔 색)가 먼저 · 주인공은 사용자 말이 아닌 사람', () => {
    assert.equal(messageSpeakerColor(gabe), '#3b9cf0');
    const s = speakersOf(model([gabe, kkang]));
    assert.equal(s.main, '#3b9cf0'); assert.equal(s.mainName, 'Mina'); assert.equal(s.count, 2);
    const fixed = speakersOf(model([gabe]), name => (name === 'Mina' ? '#2277cc' : null));
    assert.equal(fixed.main, '#2277cc');
    assert.equal(speakersOf(model([msg('x', [para({ t: 'text', text: '서술만' })])])).main, null);
});

await test('대사 띠는 화자 색 .18 로 다시 칠하고 띠 위 글자는 대사 글자색(무채)', () => {
    const { html, tone: t } = drawTone('kkangtong', model([gabe]), {});
    assert.match(html, /rgba\(\d+, \d+, \d+, 0\.18\) 5%/);
    assert.doesNotMatch(html, /0\.35\)/);
    assert.ok(html.includes(`color:${t.dialogue}`));
    assert.equal(BAND_ALPHA, 0.18);
});

await test('띠 없이 따옴표로 시작하는 색 글자(글자 색 대사 표시)도 띠로 바꿔요', () => {
    const plain = msg('Rin', [para({ t: 'el', block: false, tag: 'span', style: { color: 'rgb(134, 216, 74)' }, children: [{ t: 'text', text: '「응?」' }] }, { t: 'text', text: ' 린이 말했다.' })]);
    const { html, tone: t } = drawTone('kkangtong', model([plain]), {});
    assert.match(html, /linear-gradient\(transparent 5%, rgba\(/);
    assert.ok(html.includes(`color:${t.dialogue}`));
    assert.equal(t.rule !== null, true);   // 그 사람 색으로 제목 밑줄 · 이름표
});

await test('글꼴 통일: 화면 글꼴 · 크기를 Salty Text 14.5 / 23.2 로', () => {
    const { html } = drawTone('kkangtong', model([gabe]), {});
    assert.match(html, /font-size:14\.5px/);
    assert.doesNotMatch(html, /font-size:15px/);
    assert.ok(html.includes("font-family:'Salty Text', RIDIBatang, 'Noto Serif KR', serif"));
    const off = drawTone('kkangtong', model([gabe]), { font: false }).html;
    assert.match(off, /font-size:15px/);
});

await test('이름표는 말하는 사람이 둘 이상일 때만', () => {
    assert.doesNotMatch(drawTone('kkangtong', model([gabe]), {}).html, /data-bl-name/);
    assert.match(drawTone('kkangtong', model([gabe, kkang]), {}).html, /data-bl-name/);
    assert.doesNotMatch(drawTone('kkangtong', model([gabe, kkang]), { names: false }).html, /data-bl-name/);
});

await test('낮(light): 화면이 밤이어도 본문이 낮 바탕에서 읽혀요(대비 4.6) · 그림자 걷음', () => {
    const { html, tone: t } = drawTone('kkangtong', model([gabe, kkang]), { mode: 'light' });
    assert.equal(t.card, '#ffffff');
    for (const m of html.matchAll(/(?:^|[;"])color:(#[0-9a-f]{6}|rgb\([^)]*\))/g)) {
        if (m[1] === t.title || m[1] === t.text || m[1] === t.dialogue || m[1] === t.name) continue;
        assert.ok(contrast(m[1], t.log) >= 4.5, `${m[1]} 대비 ${contrast(m[1], t.log)}`);
    }
    assert.doesNotMatch(html, /text-shadow/);
});

await test('진한 바탕(C) · 미니 · 제목', () => {
    const deep = drawTone('kkangtong-deep', model([gabe]), { fields: { title: '휴게실' } });
    assert.equal(deep.tone.plan, 'C');
    assert.notEqual(deep.tone.card, '#25272b');
    assert.match(deep.html, /휴게실/);
    const mini = drawTone('kkangtong-mini', model([gabe]), { fields: { title: '안 보여요' } });
    assert.doesNotMatch(mini.html, /안 보여요/);
    assert.match(mini.html, /background-color:#1c1e21/);
    const titled = drawTone('kkangtong', model([gabe]), { fields: { title: '휴게실' } });
    assert.match(titled.html, /border-bottom:2px solid/);
    assert.doesNotMatch(drawTone('kkangtong', model([gabe]), { fields: { title: '' } }).html, /border-bottom:2px/);
});

await test('속마음 · 강조 색 글자는 본문 무채로(굵기 · 기울임은 그대로) — 세 틀 · 낮밤 모두', () => {
    const span = (style, text) => ({ t: 'el', block: false, tag: 'span', style, children: [{ t: 'text', text }] });
    const thought = span({ color: 'rgb(170, 130, 240)', 'font-style': 'italic' }, '(오늘은 안 돼.)');
    const strong = span({ color: 'rgb(240, 90, 120)', 'font-weight': '700' }, '절대');
    const tinted = { t: 'el', block: true, tag: 'div', style: { ...SCREEN, color: 'rgb(120, 200, 160)' }, children: [{ t: 'text', text: '색 문단' }] };
    const m = model([msg('Mina', [para(thought, { t: 'text', text: ' 미나는 ' }, strong, { t: 'text', text: ' 웃지 않았다.' }), tinted])]);
    for (const shape of TONE_SHAPES) for (const mode of ['dark', 'light']) {
        const t = tone(null, { mode, plan: shape === 'kkangtong-deep' ? 'C' : 'B' });
        const nodes = retintModel(m, t, {}).messages[0].nodes;
        const [p, block] = nodes, [th, , st] = p.children;
        assert.equal(th.style.color, t.text, `${shape} ${mode} 속마음`);
        assert.equal(st.style.color, t.text, `${shape} ${mode} 강조`);
        assert.equal(block.style.color, t.text, `${shape} ${mode} 색 문단`);
        assert.equal(th.style['font-style'], 'italic'); assert.equal(st.style['font-weight'], '700');
    }
});

await test('원본 모델은 그대로(다시 칠하기는 새 모델)', () => {
    const m = model([gabe]);
    const before = JSON.stringify(m);
    retintModel(m, tone('#3b9cf0'), {});
    drawTone('kkangtong', m, {});
    assert.equal(JSON.stringify(m), before);
});

done();
