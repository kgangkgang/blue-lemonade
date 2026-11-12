// 1.1.3 로그 복사 「심플」 새 틀(log-copy-simple.js) — 등록 값 + 고른 메시지 → 채우기 · 화자 글자 · 색(마트와 같은 규칙) · 낮밤 · 고칠 자리 주석 · 깃발 · 복사 길 · 소독
//   견본 틀: 등록한 08 블라인드(src/log-copy-simple.gen.js simple-k8 — 소리 카드 줄을 뺀 판 · details 누름 · 밤 고정값이 있는 틀).
//   마트와 같은 CSS 인지는 log-copy-simple-mart.mjs, 28틀 전부 · 대사 수별 규칙은 log-copy-simple-frames.mjs 가 봐요.
//   node tools/tests/log-copy-simple.mjs .
import { assert, load, suite } from './_t.mjs';
import { parse, sanitizedBy } from './_simple-dom.mjs';
const { test, done } = suite('log-copy-simple');

const { SIMPLE, SIMPLE_FRAMES, SIMPLE_FRAMES_ENABLED, simplePresets, checkFrame, drawSimple, speakerLetters, splitPages } = await load('src/log-copy-simple.js');
const tone = await load('src/log-copy-simple-tone.js');
const { bandColor, toneLadder } = await load('src/shared/char-tone.js');
const { parseColor } = await load('src/shared/ink-paint.js');

const FRAME = SIMPLE_FRAMES.find(f => f.key === 'k8');
const FRAME_HTML = FRAME.html;
const blocksOf = html => html.match(/<style>\n?([\s\S]*?)\n?<\/style>/)[1].split(SIMPLE.blocks);
const rootClasses = html => html.match(/^<div class="([^"]*)"/)[1].split(' ');
const bodyLines = html => html.split('</style>')[1].split('\n');
const logOf = html => html.match(/<div class="gk-lg">\n([\s\S]*?)\n<\/div><\/details>/)[1];
const noMarks = html => html.replace(/<!-- ✎ [^>]*-->/g, '').replace(`\n${tone.MARK_HEAD}`, '');
const BLUE_LADDER = Object.values(toneLadder('#3aa7ff'));
const NIGHT_FIXED = ['#13233b', '#0d1a2d', '#9cc8f5', '#5fb0f5', '#f2f6fb', '#e4e9f0', '#f5f8fc'];   // 08 밤 사용자 확정 고정값(사다리 안 씀)

// ── 견본 메시지(화면에서 뜬 모델 꼴) ───────────────────────────────────
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'line-height': '24px' };
const band = (color, text, alpha = 0.35) => { const c = parseColor(color); return { t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }; };
const words = text => ({ t: 'text', text });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const msg = (name, nodes, extra = {}) => ({ index: 0, user: false, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: null, nodes, ...extra });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });
const BLUE = 'rgb(58, 167, 255)', PINK = 'rgb(255, 95, 162)', MINT = 'rgb(60, 207, 191)';
const one = msg('이름', [para(words('문을 밀자 바람이 먼저 들어왔다.')), para(band(BLUE, '「여기 있을 줄 알았어.」'))]);
const two = msg('친구', [para(words('친구는 고개만 끄덕였다.')), para(band(PINK, '「응, 그냥.」'))]);

// ── ① 틀 등록 값 점검 ───────────────────────────────────────────
await test('08 등록 값은 점검을 통과해요 · 깡통 규칙(<style> 하나 · 감싸는 div 첫 자식) · 소리 자리 · 자리표 · 줄 꼴 · 화자 글자가 어긋나면 걸려요', () => {
    assert.deepEqual(checkFrame(FRAME), []);
    const bad = (patch, want) => { const out = checkFrame({ ...FRAME, ...patch }); assert.ok(out.some(x => x.includes(want)), `${want} ← ${JSON.stringify(out)}`); };
    bad({ html: FRAME_HTML.replace('</style>', '</style><style>.x{}</style>') }, '<style> 하나');
    bad({ html: FRAME_HTML.replace('<style>', '<p></p><style>') }, '첫 자식 <style>');
    bad({ html: FRAME_HTML.replace('{{로그}}', '<audio controls></audio>{{로그}}') }, '지우는 요소');
    bad({ html: FRAME_HTML.replace('{{로그}}', '<input type="checkbox">{{로그}}') }, '지우는 요소');
    bad({ html: FRAME_HTML.replace('{{로그}}', '') }, '{{로그}} 하나');
    bad({ html: FRAME_HTML.replace('{{로그}}', '{{로그}}{{로그:2}}') }, '{{로그:2}}');
    bad({ html: FRAME_HTML.replace(/\n\n/g, '\n') }, '덩이');
    bad({ key: 'k5' }, '뿌리 class');
    bad({ rows: { ...FRAME.rows, 대사: '<p>{{대사}}</p>' } }, '{{화자}}');
    bad({ roots: { ...FRAME.roots, light: 'gk-tl tn-d' } }, 'roots.light');
    bad({ paper: { ...FRAME.paper, dark: { card: '#13233b', log: 'x', text: '#fff' } } }, 'paper.dark.log');
    bad({ sample: null }, 'sample');
    bad({ second: 'A' }, 'second');
    bad({ second: 'C' }, '② 에 주인공 · 상대 띠 색');
});

// ── ② 채우기 ─────────────────────────────────────────────────
await test('채우기: 제목 · 지문 · 이름 · 대사가 줄 꼴 그대로(줄 하나에 항목 하나) · 대사 줄 지연 0.2s 부터 0.25s 씩 · 고칠 자리 「✎」 주석 · 자리표 · 소리 자리 없음', () => {
    const { html } = drawSimple(FRAME, model([one, two]), { mode: 'dark', fields: { title: '비 그친 뒤' } });
    assert.ok(html.includes('<!-- ✎ 제목 --><span class="gk-tt">비 그친 뒤</span>'));
    assert.ok(!/\{\{/.test(html), '자리표가 남지 않아요');
    assert.equal(logOf(html), [
        '<!-- ✎ 화자 이름 --><p class="gk-nm gk-nA">이름</p>',
        '<!-- ✎ 지문 --><p class="gk-nr">문을 밀자 바람이 먼저 들어왔다.</p>',
        '<!-- ✎ 대사 --><p class="gk-dl" style="animation:gk-dl .35s ease-out 0.2s both"><span class="gk-d gk-dA">「여기 있을 줄 알았어.」</span></p>',
        '<!-- ✎ 화자 이름 --><p class="gk-nm gk-nB">친구</p>',
        '<!-- ✎ 지문 --><p class="gk-nr">친구는 고개만 끄덕였다.</p>',
        '<!-- ✎ 대사 --><p class="gk-dl" style="animation:gk-dl .35s ease-out 0.45s both"><span class="gk-d gk-dB">「응, 그냥.」</span></p>',
    ].join('\n'));
    assert.equal(bodyLines(html)[1], tone.MARK_HEAD, '<style> 바로 뒤 안내 한 줄(마트 복사 글과 같은 문구)');
    assert.ok(!/<audio|gk-sd|gk-sn/.test(html.replace(/<style>[\s\S]*?<\/style>/, '')), '소리 카드 줄 없음');
    assert.equal(drawSimple(FRAME, model([one, two]), { marks: false }).html, noMarks(html.replace('비 그친 뒤', '')), 'marks:false 면 주석만 없어요');
});

await test('채우기: 글은 이스케이프 · $ 치환 무늬도 글자 그대로 · 제목이 비면 빈 칸(머리 줄 · 레몬 자리는 그대로)', () => {
    const tricky = msg('이름', [para(words("<b>꺾쇠</b> & $& $' $1"))]);
    const { html } = drawSimple(FRAME, model([tricky]), { fields: { title: '<i>제목</i> $&' } });
    assert.ok(html.includes('<span class="gk-tt">&lt;i&gt;제목&lt;/i&gt; $&amp;</span>'));
    assert.ok(html.includes('<p class="gk-nr">&lt;b&gt;꺾쇠&lt;/b&gt; &amp; $&amp; $&#39; $1</p>'));
    const blank = drawSimple(FRAME, model([tricky]), { fields: {} }).html;
    assert.ok(blank.includes('<span class="gk-tt"></span>'));
    assert.ok(blank.includes('<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369"'));
});

await test('문단 나누기: 다 대사면 대사 줄 · 지문과 섞이면 지문 줄 안 대사 띠 · 색 없이 따옴표로 열고 닫은 문단도 대사 줄 · 굵게 · 기울임 · 줄바꿈', () => {
    const mixed = msg('이름', [
        para(words('그가 말했다. '), band(BLUE, '「가자.」'), words(' 그리고 걸었다.')),
        para(words('「색 없는 대사.」')),
        para({ t: 'el', block: false, tag: 'span', style: { 'font-weight': '700' }, children: [words('굵게')] }, words(' · '), { t: 'el', block: false, tag: 'span', style: { 'font-style': 'italic' }, children: [words('기울임')] }),
        para(words('윗줄'), { t: 'br' }, words('아랫줄'), { t: 'br' }),
        para(words('   ')),
    ]);
    const { html } = drawSimple(FRAME, model([mixed]), { marks: false });
    assert.deepEqual(logOf(html).split('\n'), [
        '<p class="gk-nr">그가 말했다. <span class="gk-d gk-dA">「가자.」</span> 그리고 걸었다.</p>',
        '<p class="gk-dl" style="animation:gk-dl .35s ease-out 0.2s both"><span class="gk-d gk-dA">「색 없는 대사.」</span></p>',
        '<p class="gk-nr"><strong>굵게</strong> · <em>기울임</em></p>',   // 11-12 마트 견본과 같은 태그(세밀 강조 · 속마음 규칙이 겨눠요)
        '<p class="gk-nr">윗줄<br>아랫줄</p>',
    ], '이름 줄은 화자가 한 명이라 없어요 · 빈 문단은 빼요');
});

await test('대사 줄 지연은 1.2s 에서 멈춰요(긴 로그의 뒤 줄이 오래 안 보이지 않게)', () => {
    const many = msg('이름', Array.from({ length: 9 }, (_, i) => para(band(BLUE, `「${i}」`))));
    const delays = [...drawSimple(FRAME, model([many]), {}).html.matchAll(/ease-out ([\d.]+s) both/g)].map(m => m[1]);
    assert.deepEqual(delays, ['0.2s', '0.45s', '0.7s', '0.95s', '1.2s', '1.2s', '1.2s', '1.2s', '1.2s']);
});

// ── ③ 화자 규칙 ─────────────────────────────────────────────────
await test('화자 한 명: 이름 줄 없음 · 글자는 주인공 A 하나 · 상대 B 의 시안 규칙은 그대로 남아요(사람이 B 줄을 복사해 늘려도 색이 맞게)', () => {
    const { html, letters } = drawSimple(FRAME, model([one]), {});
    assert.ok(!html.includes('class="gk-nm'), '이름 줄 없음');
    assert.deepEqual([...letters], [['이름', 'A']]);
    assert.ok(blocksOf(html)[1].includes('.gk-k8.gk-tx .gk-nm.gk-nB{color:#ff5fa2;'), 'B 시안 이름 색 그대로');
    assert.equal(drawSimple(FRAME, model([one, two]), { names: false }).html.includes('class="gk-nm'), false, 'names:false 면 둘이어도 없음');
});

await test('화자 셋 이상: 주인공이 틀의 main(A) · 둘째로 나온 사람이 틀의 second(B) · 나머지는 C · D … — 셋째부터는 틀에 색이 없어 그 사람 색으로 시안 식 · 색 묶음 이름에 꼬리', () => {
    const user = msg('나', [para(band(MINT, '「나는 사용자.」 '.repeat(20)))], { user: true });
    const quiet = msg('조용', [para(band(PINK, '「응.」'))]);
    const lead = msg('주연', [para(band(BLUE, '「제일 많이 말하는 사람이에요. 정말로요.」'))]);
    const grey = msg('회색', [para(words('색 없는 사람')), para(words('「색 없는 대사.」'))]);
    const { html, letters, colors, cv } = drawSimple(FRAME, model([user, quiet, lead, grey]), { mode: 'light' });    assert.deepEqual([...letters], [['주연', 'A'], ['나', 'B'], ['조용', 'C'], ['회색', 'D']]);
    assert.deepEqual([...colors], [['A', '#3aa7ff'], ['B', '#3ccfbf'], ['C', '#ff5fa2'], ['D', null]]);
    assert.match(cv, /^gk-cv-3aa7ff-[a-z0-9]+$/);
    const css = blocksOf(html)[1];
    for (const [base, mode, log] of [['gk-tl', 'light', FRAME.paper.light.log], ['gk-tx', 'dark', FRAME.paper.dark.log]]) {
        const sel = `.gk-k8.${cv}.${base}`;
        for (const [x, K] of [['B', '#3ccfbf'], ['C', '#ff5fa2']]) {
            assert.ok(css.includes(`${sel} .gk-d${x}{background-color:rgba(${parseColor(K).r},${parseColor(K).g},${parseColor(K).b},.18)}`), `${base} ${x} 띠`);
            assert.ok(css.includes(`${sel} .gk-nm.gk-n${x}{color:${tone.sianFit(K, log)};`), `${base} ${x} 이름(시안 식)`);
        }
        assert.ok(css.includes(`${sel} .gk-dD{background-color:${bandColor(null, mode)}}`) && css.includes(`${sel} .gk-nm.gk-nD{color:${tone.SIMPLE_CONTRACT.ink[base]};`), `${base} 색 없는 D 는 무채`);
    }
    assert.ok(css.includes('.gk-k8.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}'), '주인공은 틀을 만든 색 그대로라 시안 규칙 그대로');
    assert.ok(html.includes('<p class="gk-nm gk-nD">회색</p>') && html.includes('<p class="gk-nr">색 없는 사람</p>'));
});

await test('색을 모르는 사람: 주인공 · 상대는 「원래 색」(시안 그대로 · 색 묶음 이름도 이식판 gk-cv-bl) · 셋째부터는 무채', () => {
    const a = msg('하나', [para(words('「색 없는 대사.」 길게 말해요.'))]);
    const b = msg('둘', [para(words('「나도.」'))]);
    const { html, colors, main, cv } = drawSimple(FRAME, model([a, b]), { mode: 'dark' });
    assert.equal(main, null);
    assert.deepEqual([...colors.values()], [null, null]);
    assert.equal(cv, 'gk-cv-bl');
    const noTimeline = css => css.split('\n').filter(line => !line.includes('media-controls-timeline')).join('\n');
    assert.equal(blocksOf(html).join('\n\n'), noTimeline(blocksOf(FRAME_HTML).join('\n\n')), '<style> 이 이식판 그대로(밤 = 원래 판 · 소리 카드가 없는 판이라 진행 선 규칙 한 줄만 빠져요 — 마트 소리 없는 판과 같아요)');
});

await test('정해 둔 색(lookup)이 화면 색보다 먼저 · 26명이 넘으면 남은 사람은 마지막 글자 Z 를 같이 쓰고 Z 는 무채 · main · second 가 다른 틀(05 M/A · 03 B/A)', () => {
    const { colors } = drawSimple(FRAME, model([one, two]), { lookup: name => (name === '친구' ? '#3ccfbf' : null) });
    assert.equal(colors.get('B'), '#3ccfbf');
    const crowd = Array.from({ length: 28 }, (_, i) => msg(`사람${i}`, [para(band(i % 2 ? PINK : BLUE, `「${'말'.repeat(40 - i)}」`))]));
    const out = speakerLetters(model(crowd), { main: 'A', second: 'B' });
    assert.equal(out.letterOf.get('사람0'), 'A');
    assert.equal(new Set(out.letterOf.values()).size, 26);
    assert.equal(out.letterOf.get('사람25'), 'Z');
    assert.equal(out.letterOf.get('사람27'), 'Z');
    assert.equal(out.colors.get('Z'), null);
    assert.deepEqual([...speakerLetters(model([one, two, msg('셋', [para(words('셋'))])]), { main: 'M', second: 'A' }).letterOf.values()], ['M', 'A', 'B']);
    assert.deepEqual([...speakerLetters(model([one, two, msg('셋', [para(words('셋'))])]), { main: 'B', second: 'A' }).letterOf.values()], ['B', 'A', 'C']);
});

// ── ④ 색 블록 · 낮밤 ─────────────────────────────────────────────
await test('낮밤: 고른 팔레트 밝기로 뿌리 클래스(낮 gk-tl gk-tn-d · 밤 gk-tx = 원래 판) · 소리 없는 판 표시 · 다른 색이면 색 묶음 이름이 gk-cv-<색>', () => {
    const mint = msg('이름', [para(words('길게 말하는 사람이에요. 이 사람이 주인공이에요.')), para(band(MINT, '「민트.」'))]);
    for (const [mode, want] of [['light', ['gk', 'gk-tl', 'gk-tn-d', 'gk-k8', 'gk-cv-3ccfbf', 'gk-noaud']], ['dark', ['gk', 'gk-tx', 'gk-k8', 'gk-cv-3ccfbf', 'gk-noaud']]]) {
        const { html } = drawSimple(FRAME, model([mint, two]), { mode });
        assert.deepEqual(rootClasses(html), want, mode);
        assert.ok(!html.includes('gk-cv-bl'), `${mode} 이식판 색 이름이 남지 않아요`);
    }
    assert.equal(drawSimple(FRAME, model([one]), { mode: 'x' }).mode, 'dark', '모르는 값은 밤');
});

await test('① 기본 덩이는 한 글자도 그대로 · <style> 은 감싸는 div 첫 자식 하나 · 같은 입력은 같은 글 · 색이 다르면 색 묶음 이름도 달라요', () => {
    const a = drawSimple(FRAME, model([one, two]), { mode: 'dark' });
    assert.equal(blocksOf(a.html)[0], blocksOf(FRAME_HTML)[0]);
    assert.equal((a.html.match(/<style\b/g) ?? []).length, 1);
    assert.match(a.html, /^<div class="[^"]*"><style>/);
    assert.equal(drawSimple(FRAME, model([one, two]), { mode: 'dark' }).html, a.html);
    const b = drawSimple(FRAME, model([one, two]), { mode: 'dark', lookup: name => (name === '친구' ? '#3ccfbf' : null) });
    assert.notEqual(b.cv, a.cv);
});

await test('③ 소품 덩이: 낮 판의 이식판 톤 사다리 값 → 주인공 색 사다리 · 밤 고정값(08 사용자 확정)은 그대로', () => {
    const pink = msg('분홍', [para(words('분홍이 주인공이에요.')), para(band(PINK, '「분홍이 주인공.」'))]);
    const { html } = drawSimple(FRAME, model([pink, msg('친구', [para(band(BLUE, '「응.」'))])]), { mode: 'light' });
    const props = blocksOf(html)[2];
    const ladder = toneLadder('#ff5fa2');
    for (const [slot, step] of [['.gk-bl{', 'c100'], ['.gk-bl span{', 'c300'], ['.gk-br{', 'c500'], ['.gk-cb{', 'c700']]) assert.ok(props.includes(`.gk-tn-d ${slot}background-color:${ladder[step]}}`), slot);
    for (const hex of BLUE_LADDER) assert.ok(!props.toLowerCase().includes(hex), `이식판 ${hex} 없음`);
    for (const hex of NIGHT_FIXED) assert.ok(props.includes(hex), `밤 고정 ${hex} 그대로`);
});

await test('메시지가 없거나 틀 꼴이 아니면 빈 글', () => {
    assert.equal(drawSimple(FRAME, model([]), {}).html, '');
    assert.equal(drawSimple({ ...FRAME, html: '<p>틀 아님</p>' }, model([one]), {}).html, '');
});

await test('03 바인더 쪽 나누기: 메시지 경계에서 두 쪽 길이가 비슷하게 · 메시지 하나면 줄 경계(이름 줄 바로 뒤는 안 끊어요) · 줄 하나면 둘째 쪽은 빈 쪽', () => {
    assert.deepEqual(splitPages([['a'], ['b']]), [['a'], ['b']]);
    assert.deepEqual(splitPages([['aaaaaaaa'], ['b'], ['c'], ['d']]), [['aaaaaaaa'], ['b', 'c', 'd']]);
    assert.deepEqual(splitPages([['x', 'yy', 'zz']]), [['x', 'yy'], ['zz']]);
    assert.deepEqual(splitPages([['<p class="gk-nm gk-nA">이름</p>', '글']]), [['<p class="gk-nm gk-nA">이름</p>', '글'], []]);
    assert.deepEqual(splitPages([['하나']]), [['하나'], []]);
    assert.deepEqual(splitPages([]), [[], []]);
});

// ── ⑤ 프리셋 받는 자리 · 깃발 ───────────────────────────────────────
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const P = await load('src/log-copy-presets.js');
const { simplePreset } = await load('src/log-copy-simple.js');
const { liftForCopy, LOG_MARK } = await load('src/log-copy-lift.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const { siteCheck } = await load('src/log-copy-site-sim.js');
const palette = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(133, 150, 173)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.08)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#0B1216' };
const withFixture = async (fn) => {   // 등록한 틀 하나를 시험 동안만 PRESETS 에 꽂아요(깃발이 꺼져 있어 본체 목록에는 없어요)
    const row = simplePreset(FRAME);
    P.PRESETS.push(row);
    try { await fn(row); } finally { P.PRESETS.splice(P.PRESETS.indexOf(row), 1); }
};

await test('깃발이 꺼져 있어 본체에는 아무것도 안 보여요: 등록한 28틀은 있지만 PRESETS · 「심플」 분류 칩 0 · 옛 틀 차례 그대로 · 켜면 28줄이 「심플」 로', () => {
    assert.equal(SIMPLE_FRAMES_ENABLED, false);
    assert.equal(SIMPLE_FRAMES.length, 28);
    assert.deepEqual(simplePresets(), []);
    assert.ok(!P.PRESETS.some(p => p.simple || p.category === SIMPLE.category));
    assert.ok(!P.CATEGORIES.some(c => c.id === SIMPLE.category), '틀이 없는 분류는 칩을 숨겨요');
    assert.deepEqual(P.presetsIn(SIMPLE.category), []);
    assert.deepEqual(P.PRESETS.slice(0, 4).map(p => p.id), ['kkangtong', 'kkangtong-mini', 'kkangtong-deep', 'plain']);
    assert.equal(P.PRESETS[P.PRESETS.length - 1].id, 'gallery-grid-polaroid');
    const on = simplePresets(true);
    assert.equal(on.length, 28);
    assert.ok(on.every(p => p.category === 'simple' && p.simple && p.emoji && !p.icon));
    assert.deepEqual(on.map(p => p.id), SIMPLE_FRAMES.map(f => f.id));
});

await test('등록 꼴: simplePreset → 분류 「심플」 · simple 표시 · 이모지 · 그리기 함수 — PRESETS 에 꽂으면 분류 · 차례 · renderLog 가 그 틀로', async () => {
    const row = simplePreset(FRAME);
    assert.deepEqual({ id: row.id, label: row.label, emoji: row.emoji, category: row.category, simple: row.simple, frame: row.frame }, { id: 'simple-k8', label: '블라인드', emoji: '🪟', category: 'simple', simple: true, frame: FRAME });
    assert.equal(typeof row.render, 'function');
    assert.ok(!row.tone && !row.own && !row.template && !row.images);
    await withFixture(async () => {
        assert.deepEqual(P.presetsIn('simple'), [FRAME.id]);
        assert.equal(P.categoryOf(FRAME.id), 'simple');
        for (const mode of ['light', 'dark']) {
            const html = P.renderLog(model([one, two]), { shape: FRAME.id, colors: palette, fields: { title: '제목' }, mode });
            assert.equal(html, P.fixedWidth(drawSimple(FRAME, model([one, two]), { mode, fields: { title: '제목' } }).html), mode);
            assert.match(html, /^<div class="gk [^"]*gk-k8 [^"]*" style="max-width:640px;margin-left:auto;margin-right:auto;box-sizing:border-box"><style>/);
            for (const value of Object.values(palette)) assert.ok(!html.includes(value), `팔레트 색 ${value} 없음`);
        }
        assert.ok(rootClasses(P.renderLog(model([one]), { shape: FRAME.id, colors: { ...palette, bg: 'rgb(249, 252, 255)' }, fields: {} })).includes('gk-tn-d'), 'mode 가 없으면 팔레트 바탕이 밝을 때 낮');
        assert.ok(rootClasses(P.renderLog(model([one]), { shape: FRAME.id, colors: palette, fields: {} })).includes('gk-tx'), '어두우면 밤');
        assert.equal(P.renderLog(model([one, two]), { shape: FRAME.id, mode: 'dark', fields: {}, lookup: name => (name === '이름' ? '#3ccfbf' : null) }).includes(`color:${tone.sianFit('#3ccfbf', FRAME.paper.dark.log)}`), true, '정해 둔 색(lookup) · 시안 식 이름 색');
        assert.equal(P.renderLog(model([one, two]), { shape: FRAME.id, mode: 'dark', fields: {}, names: false }).includes('class="gk-nm'), false, '이름 끄기');
    });
});

await test('복사 길(그리기 → 복사 글 → 붙일 곳 점검): <style> 하나가 감싸는 div 첫 자식 · 안내 · ✎ 주석 · 줄 나눔이 그대로 · 인라인 그림 주소 0 · overflow:hidden 0 · 덮일 인라인 글자색 0', async () => {
    await withFixture(async () => {
        for (const mode of ['light', 'dark']) {
            const shown = P.renderLog(model([one, two]), { shape: FRAME.id, mode, fields: { title: '제목' } });
            const { full } = liftForCopy(shown, motionStyleFor(shown));
            assert.equal((full.match(/<style\b/g) ?? []).length, 1, mode);
            assert.match(full, new RegExp(`^<p><br></p><div class="gk [^"]*${LOG_MARK}"[^>]*><style>`), `${mode} 감싸는 div 첫 자식`);
            assert.ok(full.includes(blocksOf(shown)[0].slice(0, 200)), `${mode} 틀 규칙이 그 <style> 안에`);
            assert.ok(full.includes(`</style>\n${tone.MARK_HEAD}\n`), `${mode} 안내 한 줄이 <style> 바로 뒤`);
            assert.equal((full.match(/<!-- ✎ /g) ?? []).length, (shown.match(/<!-- ✎ /g) ?? []).length, `${mode} ✎ 주석 그대로`);
            assert.equal(full.split('</style>')[1].split('\n').length, shown.split('</style>')[1].split('\n').length, `${mode} 줄 하나에 항목 하나 그대로`);
            const check = siteCheck(full, { mode });
            assert.deepEqual({ urls: check.urls, hidden: check.hidden, low: check.low }, { urls: 0, hidden: 0, low: 0 }, mode);
            assert.equal(check.html, full, `${mode} 고칠 것 없음`);
        }
    });
});

// ── ⑥ 소독기 통과(log-copy-sanitize.js · 시험 전용 작은 DOM _simple-dom.mjs) ──────────────
const { sanitizeTree, safeCss } = await load('src/log-copy-sanitize.js');
const sanitized = sanitizedBy(sanitizeTree);
const LEMON = FRAME_HTML.match(/url\('data:image\/svg\+xml,[^']*'\)/)[0];

await test('작은 DOM 은 소독 없이 다시 쓰면 글이 그대로예요(주석까지 — 아래 견줌의 바탕)', () => {
    const { html } = drawSimple(FRAME, model([one, two]), { mode: 'dark', fields: { title: '제목' } });
    assert.equal(parse(html).innerHTML, html);
});

await test('소독기를 지나도 새 틀 글이 한 글자도 안 바뀌어요: 「✎」 주석 · 안내 · details · summary · class · aria-label · title · 레몬 바로가기 주소 · 인라인 animation · <style> 전부(낮 · 밤)', () => {
    for (const mode of ['light', 'dark']) {
        const { html } = drawSimple(FRAME, model([one, two]), { mode, fields: { title: '제목' } });
        const out = sanitized(html);
        assert.equal(out, html, mode);
        for (const piece of [tone.MARK_HEAD, '<!-- ✎ 대사 -->', '<details class="gk-bd"><summary aria-label="블라인드 걷기">', 'class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"', 'style="animation:gk-cd 5.2s ease-in-out 0s infinite alternate"', 'style="animation:gk-dl .35s ease-out 0.2s both"', '@keyframes gk-dn{', '@media (prefers-reduced-motion:reduce){', '.gk-k8 details[open] .gk-lg{animation:gk-dn', LEMON]) assert.ok(out.includes(piece), `${mode} ${piece.slice(0, 60)}`);
    }
});

await test('소독기는 open 속성을 남겨요(틀이 열린 채로 내보낼 때) · 미리보기 표시(data-bl-peek)만 걷어요', () => {
    assert.equal(sanitized('<div class="gk gk-k8"><details class="gk-bd" open=""><summary>열림</summary><p>글</p></details></div>'), '<div class="gk gk-k8"><details class="gk-bd" open=""><summary>열림</summary><p>글</p></details></div>');
    assert.equal(sanitized('<details open="" data-bl-peek=""><summary>미리보기</summary></details>'), '<details open=""><summary>미리보기</summary></details>');
});

await test('<style> 안 새 틀 꾸밈은 safeCss 를 그대로 지나요: @keyframes · @media(움직임 줄이기 · 회전 트랙 조건) · :has() · clip-path · mask-image · data-URL 그림 · blur · cqw · container-type', () => {
    const css = [
        '@keyframes gk-pf{0%{clip-path:polygon(0 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%)}100%{clip-path:polygon(0 0,59px 0,59px 0,0 100%,0 100%);opacity:0}}',
        '@media (prefers-reduced-motion:reduce){.gk-k5 *{animation:none!important;transition:none!important}}',
        '@media (hover:hover) and (pointer:fine) and (min-width:560px){.gk-k4 .gk-tr{transform:rotate(-90deg);container-type:size}}',
        '.gk-k7:has(.gk-kx[open]) .gk-fg{opacity:1}.gk-k1:has(.gk-kx[open]) .gk-lg{clip-path:inset(0 0 0 0)}',
        `.gk-k5 .gk-ly{-webkit-mask-image:${LEMON};mask-image:${LEMON};-webkit-mask-size:100% 100%;mask-size:100% 100%}`,
        `.gk-k8 .gk-lmi{background:${LEMON} center/100% 100% no-repeat}`,
        '.gk-k7 .gk-glow{filter:blur(6px);border-radius:50%}.gk-k1 .gk-q1{transform:translate(calc(50cqw - 16px),0)}',
    ].join('\n');
    assert.equal(safeCss(css), css);
    assert.equal(safeCss(blocksOf(FRAME_HTML).join('\n\n')), blocksOf(FRAME_HTML).join('\n\n'), '08 <style> 통째로');
});

await test('지워지는 것은 그대로 지워요(규칙을 풀지 않아요): <input> · <audio> · <source> · 그림 아닌 svg 주소 — 새 틀 글에는 처음부터 없어요', async () => {
    const out = sanitized('<div class="gk gk-k8"><label><input type="checkbox" class="gk-kx"><span>켜기</span></label><div class="gk-sd"><span class="gk-sn">이름</span><audio src="https://example.com/a.mp3" controls><source src="https://example.com/a.mp3"></audio></div><style>.a{background:url(\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cimage href=%22x%22/%3E%3C/svg%3E\')}</style></div>');
    assert.equal(out, '<div class="gk gk-k8"><label><span>켜기</span></label><div class="gk-sd"><span class="gk-sn">이름</span></div><style>.a{background:none}</style></div>');
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/log-copy-sanitize.js', import.meta.url), 'utf8');
    const drop = source.match(/const DROP = '([^']*)'/)[1].split(/,\s*/);
    for (const name of ['input', 'audio', 'source', 'video', 'button', 'script', 'iframe']) assert.ok(drop.includes(name), `DROP 에 ${name}`);
    for (const name of ['details', 'summary', 'style', 'label']) assert.ok(!drop.includes(name), `DROP 에 ${name} 없음`);
    await withFixture(async () => {
        for (const mode of ['light', 'dark']) {
            const shown = P.renderLog(model([one, two]), { shape: FRAME.id, mode, fields: { title: '제목' } });
            assert.ok(!/<(input|audio|source|video)\b/i.test(shown), `${mode} 새 틀 글에 지워질 요소 0`);
            assert.ok(rootClasses(shown).includes('gk-noaud'), `${mode} 소리 없는 판 표시`);
        }
    });
});

await test('길 전체(시트 복사와 같은 차례): 그리기 → 미리보기로 연 상자 닫기 → 소독 → 복사 글 → 붙일 곳 점검 — <style> 하나 · 주석 · details 누름 · 화자 색 · 0건', async () => {
    await withFixture(async () => {
        for (const mode of ['light', 'dark']) {
            const shown = P.renderLog(model([one, two]), { shape: FRAME.id, mode, fields: { title: '제목' } });
            const body = parse(tone.peekSimple(shown, FRAME.peek));   // 미리보기로만 여는 꼴(첫 details 에 data-bl-peek)
            assert.ok(body.innerHTML.includes('<details class="gk-bd" open="" data-bl-peek="">'));
            for (const box of body.querySelectorAll('details')) if (box.getAttribute('data-bl-peek') !== null) { box.removeAttribute('open'); box.removeAttribute('data-bl-peek'); }
            sanitizeTree(body);
            const html = body.innerHTML.trim();
            assert.equal(html, shown, `${mode} 소독 뒤에도 그린 글 그대로(미리보기로 연 상자는 닫힌 채)`);
            const { full } = liftForCopy(html, motionStyleFor(html));
            assert.equal((full.match(/<style\b/g) ?? []).length, 1);
            assert.ok(full.includes('<details class="gk-bd"><summary aria-label="블라인드 걷기">') && !/<details[^>]*\sopen/.test(full), '닫힌 채 시작하는 누름');
            assert.ok(full.includes('.gk-k8.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}'), '화자 색 블록(시안 그대로)');
            assert.deepEqual((({ urls, hidden, low }) => ({ urls, hidden, low }))(siteCheck(full, { mode })), { urls: 0, hidden: 0, low: 0 });
        }
    });
});

done();
