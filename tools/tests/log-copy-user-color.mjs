// 1.4.1 로그 복사 「인물표 색」 — 채팅에서 보이는 사람마다의 대사색이 글꾸에 그대로 가는지(11-14 사용자 「글꾸 색 그대로 안 가? 깡캐 대사는 검정인데 왜 노랑 됨」)
//   잠그는 것: ① 한 메시지 안 인물 대사 + 사용자 대사(회색 계열 대사색) ② 사용자 메시지의 회색 대사색 ③ 이름 바꾼 화자(인물표는 원래 이름으로)
//   ④ 그룹 채팅(사람마다 글자 · 메시지에 섞인 사용자 대사는 사용자 글자) ⑤ 회색 서술 · 테마 기본 띠는 예전 그대로 ⑥ 「깡캐」 고른 색은 섞인 사용자 대사에
//   틀 갈래 셋(블루레몬 추천 = 받은 심플 꼴 · 기본 글꾸 새 틀 · 깡통 로그) × 낮밤. 이름 · 글은 가짜예요.
//   node tools/tests/log-copy-user-color.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-user-color');
const { renderLog } = await load('src/log-copy-presets.js');
const { loadPicks } = await load('src/log-copy-picks.js');
const { speakersOf, toneLookup, retintModel } = await load('src/log-copy-tone.js');
const { speakerLetters, colorLetters } = await load('src/log-copy-simple.js');
const { tone } = await load('src/shared/char-tone.js');
const { parseColor } = await load('src/shared/ink-paint.js');

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.3px', 'line-height': '24px', 'word-break': 'normal' };
const GOLD = 'rgb(245, 200, 76)', SLATE = 'rgb(66, 76, 89)', SLATE_LIT = 'rgb(125, 135, 150)';   // 채팅: 인물 노랑 · 사용자 회청(밤 화면은 글자만 밝혀 둔 색)
// 화면에서 떠 온 꼴(log-copy-capture): 바깥 조각 = 그 사람 대사 글자색 · 안쪽 조각 = 띠(.35)
const say = (ink, bandc, text, alpha = 0.35) => { const c = parseColor(bandc); return { t: 'el', block: false, tag: 'span', style: { color: ink }, children: [{ t: 'el', block: false, tag: 'q', style: { 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }] }; };
const para = (...children) => ({ t: 'el', block: true, tag: 'p', style: { ...SCREEN, 'text-indent': '15px' }, children });
const words = text => ({ t: 'text', text });
const msg = (name, nodes, user = false) => ({ index: 0, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: null, nodes });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });

// 신고 장면 꼴: 인물 메시지 하나에 인물 대사(노랑) · 서술 · 사용자 대사(회청) · 인물 대사
const mixed = msg('미라', [
    para(say(GOLD, GOLD, '「그렇군요. 동정해 주고 계셨던 겁니까.」')),
    para(words('하루는 숨을 들이켰다.')),
    para(say(SLATE_LIT, SLATE, '「어, 어떻게 알았어?!」')),
    para(say(GOLD, GOLD, '「예, 기쁩니다.」')),
]);
const allGold = { ...mixed, nodes: mixed.nodes.map((n, i) => (i === 2 ? para(say(GOLD, GOLD, '「어, 어떻게 알았어?!」')) : n)) };
const picks = await loadPicks();
const k10 = picks.find(p => p.id === 'simple-k10');   // 모래시계
const dlgClass = (html, re) => [...html.matchAll(re)].map(m => m[1]);
const ruleOf = (html, letter) => (html.match(new RegExp(`\\.gk-tl \\.gk-d${letter}\\{background-color:(rgba\\([^)]*\\))`)) || [])[1];
const rgbOf = v => { const c = parseColor(v); return [c.r, c.g, c.b]; };
const greyish = v => { const [r, g, b] = rgbOf(v); return Math.max(r, g, b) - Math.min(r, g, b) < 40; };

await test('추천(모래시계) 낮 · 밤: 섞인 사용자 대사는 둘째 글자 · 회색 띠(인물 노랑이 아님)', () => {
    assert.ok(k10, '추천 모래시계 틀');
    for (const mode of ['light', 'dark']) {
        const html = renderLog(model([mixed]), { simple: k10, mode });
        assert.deepEqual(dlgClass(html, /class="gk-d (gk-d[A-Z])"/g), ['gk-dA', 'gk-dB', 'gk-dA'], mode);
        const a = ruleOf(html, 'A'), b = ruleOf(html, 'B');
        assert.ok(a && b, `${mode} 화자 띠 규칙 둘`);
        assert.ok(!greyish(a), `${mode} 인물 띠는 노랑 ${a}`);
        assert.ok(greyish(b), `${mode} 사용자 띠는 회색 ${b}`);
    }
});

await test('블루레몬 추천 32판 전부 낮 · 밤: 섞인 사용자 대사가 인물 글자로 떨어지지 않아요(둘째 글자 칸이 생겨요)', () => {
    assert.equal(picks.length, 32);
    for (const p of picks) for (const mode of ['light', 'dark']) {
        const html = renderLog(model([mixed]), { simple: p, mode }), second = p.frame.second;
        assert.match(html, new RegExp(`class="gk-d gk-d${second}"`), `${p.id} ${mode} 둘째 글자 ${second}`);
        assert.notEqual(html, renderLog(model([allGold]), { simple: p, mode }), `${p.id} ${mode} 사용자 대사가 인물 색과 같게 그려져요`);
    }
});

await test('기본 글꾸 새 틀(카드 · 노트 · 편지) 낮 · 밤: 섞인 사용자 대사는 dB · 색 자리는 회색', () => {
    for (const shape of ['card', 'note', 'letter']) for (const mode of ['light', 'dark']) {
        const html = renderLog(model([mixed]), { shape, mode });
        assert.deepEqual(dlgClass(html, /class="d (d[A-Z])"/g), ['dA', 'dB', 'dA'], `${shape} ${mode}`);
        assert.doesNotMatch(html, /<!--blw:/, '글자 표지는 남지 않아요');
    }
});

await test('깡통 로그(B안 · 진한 바탕) 낮 · 밤: 사용자 대사 띠는 회색 · 인물 대사 띠는 노랑', () => {
    for (const shape of ['kkangtong', 'kkangtong-deep']) for (const mode of ['light', 'dark']) {
        const html = renderLog(model([mixed]), { shape, mode });
        const bands = dlgClass(html, /linear-gradient\(transparent 5%, (rgba\([^)]*\)) 5%/g);
        assert.equal(bands.length, 3, `${shape} ${mode}`);
        assert.ok(!greyish(bands[0]) && !greyish(bands[2]), `${shape} ${mode} 인물 ${bands}`);
        assert.ok(greyish(bands[1]), `${shape} ${mode} 사용자 ${bands[1]}`);
    }
});

await test('사용자 메시지의 회색 대사색도 그 사람 색이에요(전엔 색 모름 → 틀 견본 색)', () => {
    const m = model([msg('미라', [para(say(GOLD, GOLD, '「어서 와요.」'))]), msg('하루', [para(say(SLATE_LIT, SLATE, '「고마워.」'))], true)]);
    const s = speakersOf(m);
    assert.equal(s.byName.get('하루'), '#7d8796');
    assert.equal(s.mainName, '미라');
    const who = speakerLetters(m, { main: 'A', second: 'B' });
    assert.equal(who.colors.get('B'), '#7d8796');
});

await test('이름 바꾼 화자: 인물표는 원래 이름으로 물어 그 색을 써요(드림주 → 깡캐 꼴)', () => {
    const source = [msg('미라', [para(say(GOLD, GOLD, '「어서 와요.」'))]), msg('하루', [para(say(SLATE_LIT, SLATE, '「고마워.」'))], true)];
    const shown = [source[0], { ...source[1], name: '별명' }];
    const people = new Map([['하루', { color: '#424c59' }], ['미라', { color: '#f5c84c' }]]);
    const lookup = toneLookup(shown, source, n => people.get(n));
    assert.equal(lookup('별명'), '#424c59');
    for (const mode of ['light', 'dark']) {
        const html = renderLog(model(shown), { simple: k10, mode, lookup });
        assert.deepEqual(dlgClass(html, /class="gk-d (gk-d[A-Z])"/g), ['gk-dA', 'gk-dB'], mode);
        assert.ok(greyish(ruleOf(html, 'B')), `${mode} ${ruleOf(html, 'B')}`);
        assert.equal(rgbOf(ruleOf(html, 'B')).join(), '66,76,89', '인물표 색 그대로');
    }
});

await test('그룹 채팅: 사람마다 글자 · 인물 메시지에 섞인 사용자 대사는 사용자 글자(새 글자를 만들지 않아요)', () => {
    const BLUE = 'rgb(59, 156, 240)', PINK = 'rgb(236, 92, 160)';
    const m = model([
        msg('미라', [para(say(GOLD, GOLD, '「안녕, 다들 오랜만이야. 그동안 잘 지냈어? 오늘은 내가 차를 끓일게.」'))]),
        msg('하루', [para(say(SLATE_LIT, SLATE, '「응.」'))], true),
        msg('소라', [para(say(BLUE, BLUE, '「나도 왔어.」')), para(say(SLATE_LIT, SLATE, '「소라도?」'))]),
        msg('나리', [para(say(PINK, PINK, '「다 모였네.」'))]),
    ]);
    const named = speakerLetters(m, { main: 'A', second: 'B' });
    const who = colorLetters(named, retintModel(m, tone(named.main), { font: false }), { main: 'A', second: 'B' });
    assert.equal(who.letterOf.get('하루'), 'B');
    assert.equal(who.byColor.get('#7d8796'), 'B');
    for (const mode of ['light', 'dark']) {
        const html = renderLog(m, { simple: k10, mode });
        assert.deepEqual(dlgClass(html, /class="gk-d (gk-d[A-Z])"/g), ['gk-dA', 'gk-dB', 'gk-dC', 'gk-dB', 'gk-dD'], mode);
        const basic = renderLog(m, { shape: 'card', mode });
        assert.deepEqual(dlgClass(basic, /class="d (d[A-Z])"/g), ['dA', 'dB', 'dC', 'dB', 'dD'], `card ${mode}`);
    }
});

await test('예전 그대로: 회색 서술(따옴표 · 띠 없음)은 서술 · 테마 기본 띠(무채 · 바깥 색 없음)는 메시지 화자 색', () => {
    const narr = msg('미라', [para(say(GOLD, GOLD, '「안녕.」')), para({ t: 'el', block: false, tag: 'span', style: { color: SLATE_LIT }, children: [words('바람이 불었다.')] })]);
    const html = renderLog(model([narr]), { simple: k10, mode: 'light' });
    assert.deepEqual(dlgClass(html, /class="gk-d (gk-d[A-Z])"/g), ['gk-dA']);
    const plainBand = { t: 'el', block: false, tag: 'q', style: { 'background-image': 'linear-gradient(transparent 5%, rgba(128, 128, 128, 0.35) 5%, rgba(128, 128, 128, 0.35) 100%, transparent 100%)' }, children: [words('「그냥 대사.」')] };
    const m2 = model([msg('미라', [para(say(GOLD, GOLD, '「안녕.」')), para(plainBand)])]);
    assert.deepEqual(dlgClass(renderLog(m2, { simple: k10, mode: 'light' }), /class="gk-d (gk-d[A-Z])"/g), ['gk-dA', 'gk-dA']);
    const bands = dlgClass(renderLog(m2, { shape: 'kkangtong', mode: 'light' }), /linear-gradient\(transparent 5%, (rgba\([^)]*\)) 5%/g);
    assert.equal(bands[0], bands[1]);
});

await test('「깡캐」 고른 색은 섞인 사용자 대사(둘째 글자)에 얹혀요 · 「깡통」은 인물 대사에', () => {
    const mine = { ...k10, set: { themeCast: { main: '#2277cc', other: '#000000' } } };
    const html = renderLog(model([mixed]), { simple: mine, mode: 'light' });
    assert.equal(rgbOf(ruleOf(html, 'B')).join(), '0,0,0');
    assert.equal(rgbOf(ruleOf(html, 'A')).join(), '34,119,204');
});

done();
