// 1.1.5 받은 심플 글꾸를 테마 안에서 조절하기 — 바탕 질감(여덟 · 글 칸만 / 카드 전체 · 진하기) · 움직임 세기(글 · 소품 따로) · 간편 「색」 줄 · 「세밀」 화면
//   node tools/tests/log-copy-tune.mjs <테마 루트>
//   값 다듬기 · 적용은 글꾸 마트 사본(src/geulkku-mart/) 그대로 — 여기서는 테마가 더한 길(칸 → 조절 값 → 그리기)과 화면 꼴(2열 · 흐린 칸 · 늦게 받기)을 봐요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const S = await load('src/log-copy-tune-set.js');   // 조절 값 함수(조절 모듈 것도 다시 내보내요)
const SET = await load('src/log-copy-simple-set.js');
const U = await load('src/log-copy-tune-ui.js');
const { frameFromHtml } = await load('src/log-copy-simple-frame.js');
const { drawSimple, castLetters } = await load('src/log-copy-simple.js');
const { renderLog } = await load('src/log-copy-presets.js');
const { makeSet, readSet } = await load('src/geulkku-mart/geulkku-set.js');
const { applyTex } = await load('src/geulkku-mart/texture.js');
const { capsStatic } = await load('src/geulkku-mart/caps.js');
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
const PLAIN = { blGeulkku: 2 };
const inputs = Object.entries(fixture.inputs).map(([k, html]) => { const [id, mode] = k.split('|'); return { id, key: id.replace(/^simple-/, ''), mode, html }; });
const rootClass = html => (html.match(/^\s*<div\b[^>]*\sclass="([^"]*)"/) || [])[1].split(/\s+/);
const frameK1 = frameFromHtml(fixture.packs['simple-k1'].items[0].html, { id: 'simple-k1', label: '낫표' });
const model = { base: { color: '#dddddd', bg: '#111111' }, messages: [
    { name: '깡통', nodes: [{ t: 'text', text: '창밖을 보았다.' }, { t: 'br' }, { t: 'el', block: false, style: { 'background-image': 'linear-gradient(#ffd, #ffd)' }, children: [{ t: 'text', text: '「비가 그쳤네.」' }] }] },
    { name: '깡캐', nodes: [{ t: 'text', text: '「응, 나가 볼까?」' }] },
] };

await test('바탕 질감: 여덟 가지 × 얹는 곳 둘 × 진하기 셋 — 마트 applyTex 와 같은 글 · 「없음」이면 받은 글 그대로', () => {
    assert.deepEqual(S.TEX_LIST.map(([id]) => id), ['grid', 'line', 'dot', 'rough', 'hanji', 'canvas', 'aged', 'chalk']);
    assert.deepEqual(S.TEX_ON, [['b', '글 칸만'], ['c', '카드 전체']]);
    let n = 0;
    for (const { key, mode, html } of inputs) {
        for (const [tex] of S.TEX_LIST) for (const [on] of S.TEX_ON) for (const [level] of S.TEX_LEVEL) {
            const set = S.withTex(S.withTex(S.withTex(PLAIN, { tex }), { on }), { level });
            assert.deepEqual(readSet(set).tex, { tex, on, level });
            const out = S.applySet(html, set, { mode, key });
            assert.equal(out, applyTex(html, { tex, on, level }), `${key} ${mode} ${tex} ${on} ${level}`);
            const cls = rootClass(out);
            assert.ok(cls.includes(`gk-tx-${tex}`) && cls.includes(`gk-tx-on-${on}`) && (level === 2 || cls.includes(`gk-tx-${level}`)), `${tex} ${on} ${level}`);
            n++;
        }
        assert.equal(S.applySet(html, S.withTex(S.withTex(PLAIN, { tex: 'hanji' }), null), { mode, key }), html);
    }
    assert.equal(n, inputs.length * 48);
    assert.deepEqual(readSet(S.withTex(PLAIN, { tex: 'line' })).tex, { tex: 'line', on: 'b', level: 2 }, '처음 고르면 글 칸만 · 보통');
    assert.equal(readSet(S.withTex(S.withTex(PLAIN, { tex: 'line' }), { margin: true })).tex.margin, true);
    assert.equal(readSet(S.withTex(PLAIN, { tex: 'nope' })).tex, null);
});

await test('움직임 세기: 글 · 소품을 따로 — 한쪽을 바꿔도 다른 쪽 · 빠르기는 그대로 · 「끔」이면 그쪽에 움직임을 걸지 않는 규칙만 붙어요', () => {
    let set = S.withMotionPart(PLAIN, 'text', '0');
    assert.deepEqual(readSet(set).motion, { text: '0', prop: 'm', speed: 'm', open: false });
    set = S.withMotionPart(S.withSpeed(set, 'l'), 'prop', 's');
    assert.deepEqual(readSet(set).motion, { text: '0', prop: 's', speed: 'l', open: false });
    assert.deepEqual(S.easyOf(set).apart, { text: '0', prop: 's' });
    assert.equal(S.withMotionPart(PLAIN, 'text', 'x'), PLAIN); assert.equal(S.withMotionPart(PLAIN, 'card', 's'), PLAIN); assert.equal(S.withSpeed(PLAIN, 'x'), PLAIN);
    assert.equal(readSet(S.withOpen(PLAIN, true)).motion.open, true);
    let offText = 0, offProp = 0;
    for (const { key, mode, html } of inputs) {
        const caps = capsStatic(html).motion;
        const t = S.applySet(html, S.withMotionPart(PLAIN, 'text', '0'), { mode, key }), p = S.applySet(html, S.withMotionPart(PLAIN, 'prop', '0'), { mode, key });
        if (caps.text[0]) { offText++; assert.ok(rootClass(t).includes('gk-gm-0')); assert.ok(!rootClass(t).includes('gk-gp-0')); assert.ok(t.split(/(?:animation|transition):none/).length > html.split(/(?:animation|transition):none/).length); } else assert.equal(t, html);
        if (caps.prop[0]) { offProp++; assert.ok(rootClass(p).includes('gk-gp-0')); assert.ok(!rootClass(p).includes('gk-gm-0')); } else assert.equal(p, html);
        assert.equal(S.applySet(html, S.withMotionPart(S.withMotionPart(PLAIN, 'text', '0'), 'text', 'm'), { mode, key }), html, '중으로 돌리면 받은 글 그대로');
    }
    assert.ok(offText > 0 && offProp > 0, `끔을 받는 견본 틀이 있어요(글 ${offText} · 소품 ${offProp})`);
});

await test('세밀 칸: 범위 · 단계는 마트 표가 다듬어요(상한 밖 값은 표 안으로) · 「틀 그대로」는 값을 지워요', () => {
    assert.equal(readSet(S.withShape(PLAIN, 'radius', 99)).shape.radius, 24);
    assert.equal(readSet(S.withShape(PLAIN, 'pad', 123)).shape.pad, 120);
    assert.equal(readSet(S.withShape(PLAIN, 'bandAlpha', 1)).shape.bandAlpha, 8);
    assert.equal(readSet(S.withShape(S.withShape(PLAIN, 'radius', 16), 'radius', null)).shape, null);
    assert.equal(S.withShape(PLAIN, 'nope', 1), PLAIN);
    assert.equal(readSet(S.withLook(PLAIN, 'type.size', 99)).look.type.size, 22);
    assert.equal(readSet(S.withLook(PLAIN, 'type.lineHeight', 1.9)).look.type.lineHeight, 1.9);
    assert.equal(readSet(S.withLook(S.withSize(PLAIN, 2), 'type.size', 17)).look.type.sizeStep, undefined, '고정 크기를 주면 더하기 값은 지워요');
    assert.equal(readSet(S.withLook(S.withLook(PLAIN, 'fonts.text', 'serif'), 'fonts.text', null)).look, null);
    assert.equal(S.withLook(PLAIN, 'nope.x', 1), PLAIN);
    const lemon = { blGeulkku: 2, style: { show: { lemon: false } } };
    assert.equal(readSet(S.withLook(lemon, 'type.weight', 500)).look.lemon.off, true, '레몬 빼기는 그대로');
    const ink = S.withInk(PLAIN, 'k1', 'dark', 'card', '#112233');
    assert.equal(ink.frame, 'k1'); assert.equal(ink.frames.k1.colors.dark.card, '#112233');
    assert.equal(S.withInk(ink, 'k1', 'dark', 'card', null).frames, undefined);
    assert.equal(S.withInk(PLAIN, 'k1', 'dusk', 'card', '#112233'), PLAIN); assert.equal(S.withInk(PLAIN, 'k1', 'dark', 'nope', '#112233'), PLAIN);
});

await test('처음으로: 갈래만 · 전부 — 전부 처음으로면 받은 글 그대로(화자 색 · 레몬 빼기는 남아요)', () => {
    let set = S.withCast({ blGeulkku: 2, style: { show: { lemon: false } } }, 'main', '#3aa7ff');
    for (const a of ['look|type.lineHeight|1.9', 'shape|radius|16', 'shape|bandAlpha|28', 'shape|hideProp|true', 'motion|prop|"s"', 'speed||"s"', 'tex|tex|"hanji"', 'tex|on|"c"', 'ink|title|"#223344"']) set = U.fineAct(set, 'k1', a, 'dark');
    const f = S.fineOf(set, frameK1.html, 'k1', 'dark');
    assert.deepEqual(f.count, { color: 2, text: 1, motion: 2, prop: 1, shape: 2 }); assert.equal(f.total, 8);
    assert.ok(f.words.includes('소품 움직임 약') && f.words.includes('질감 한지') && f.words.includes('모서리 16px') && f.words.includes('본문 줄 간격 1.9'));
    const noMotion = S.resetFine(set, 'motion', 'k1');
    assert.deepEqual(S.fineOf(noMotion, frameK1.html, 'k1').count, { color: 2, text: 1, motion: 0, prop: 1, shape: 2 });
    const noShape = S.resetFine(set, 'shape', 'k1');
    assert.equal(readSet(noShape).tex, null); assert.equal(readSet(noShape).shape.bandAlpha, 28); assert.equal(readSet(noShape).shape.radius, undefined);
    const all = U.fineAct(set, 'k1', 'reset|all|null');
    assert.equal(S.fineOf(all, frameK1.html, 'k1').total, 0);
    assert.deepEqual(all.themeCast, { main: '#3aa7ff' }); assert.equal(readSet(all).look.lemon.off, true);
    for (const { key, mode, html } of inputs) assert.equal(S.applySet(html, all, { mode, key }), S.applySet(html, { blGeulkku: 2, style: { show: { lemon: false } } }, { mode, key }));
    assert.equal(U.fineAct(set, 'k1', 'nope|x|1'), set); assert.equal(U.fineAct(set, 'k1', 'look|type.size|{bad'), set);
});

await test('색 줄: 고른 화자 색은 set.themeCast 에만(마트 꼴 밖) — 안 고르면 그리기가 1.1.4 와 같고, 간편 줄을 눌러도 남아요', () => {
    assert.equal(S.castOf({ main: '#ABCDEF', other: 'orig' }).main, '#abcdef'); assert.equal(S.castOf({ main: 'red' }), null); assert.equal(S.castOf(null), null);
    const set = S.withCast(S.withCast(PLAIN, 'main', '#3aa7ff'), 'other', 'orig');
    assert.deepEqual(set.themeCast, { main: '#3aa7ff', other: 'orig' });
    assert.equal(readSet(set).tone.on, false, '마트 꼴의 화자 색(style.cast)은 건드리지 않아요');
    for (const next of [S.withStyle(set, 'calm'), S.withMotion(set, 's'), S.withSize(set, 2), S.withTex(set, { tex: 'dot' }), S.withMotionPart(set, 'text', 'l')]) assert.deepEqual(next.themeCast, set.themeCast);
    assert.equal(S.withCast(set, 'main', null).themeCast.main, undefined);
    assert.equal(U.fineAct(set, 'k1', 'cast|all|null').themeCast, undefined);
    assert.deepEqual(U.fineAct(PLAIN, 'k1', 'cast|all|"orig"').themeCast, { main: 'orig', other: 'orig' });
    for (const { key, mode, html } of inputs) assert.equal(S.applySet(html, set, { mode, key }), html, '칠하기 뒤 조절 값에는 안 걸려요');
    // 그리기: 인물표가 준 색보다 고른 색이 먼저 · 「원래 색」은 색 모름과 같은 길
    const lookup = name => (name === '깡통' ? '#e8496a' : name === '깡캐' ? '#3aa7ff' : null);
    const base = drawSimple(frameK1, model, { mode: 'dark', lookup, marks: false });
    assert.equal(drawSimple(frameK1, model, { mode: 'dark', lookup, cast: null, marks: false }).html, base.html);
    assert.equal(drawSimple(frameK1, model, { mode: 'dark', lookup, cast: {}, marks: false }).html, base.html);
    const picked = drawSimple(frameK1, model, { mode: 'dark', lookup, cast: { main: '#22aa66' }, marks: false });
    assert.notEqual(picked.html, base.html); assert.equal(picked.colors.get(frameK1.main), '#22aa66'); assert.equal(picked.main, '#22aa66');
    const orig = drawSimple(frameK1, model, { mode: 'dark', lookup, cast: { main: 'orig', other: 'orig' }, marks: false });
    assert.equal(orig.html, drawSimple(frameK1, model, { mode: 'dark', lookup: () => null, marks: false }).html);
    const who = { letterOf: new Map(), colors: new Map([['A', '#111111']]), main: '#111111', count: 1 };
    assert.equal(castLetters(who, { main: 'A', second: 'B' }, null), who);
    assert.equal(castLetters(who, { main: 'A', second: 'B' }, { other: '#222222' }).colors.get('B'), '#222222');
    // renderLog 길: 내 글꾸의 set 에 든 색을 써요
    const mine = { frame: frameK1, set: S.withCast(PLAIN, 'main', '#22aa66') };
    assert.notEqual(renderLog(model, { simple: mine, setMod: SET, mode: 'dark', lookup }), renderLog(model, { simple: { frame: frameK1, set: PLAIN }, setMod: SET, mode: 'dark', lookup }));
});

await test('능력표: 등록 값(틀)으로 잰 것이 그린 글로 잰 것과 같아요 — 못 받는 조절은 칸이 흐리고(disabled) 까닭이 붙어요', () => {
    for (const id of ['simple-k1', 'simple-k1120']) {
        const f = frameFromHtml(fixture.packs[id].items[0].html, { id });
        const drawn = drawSimple(f, model, { mode: 'dark', marks: false }).html;
        assert.deepEqual(S.fineOf(PLAIN, S.probeOf(f), f.key).caps, capsStatic(drawn), id);
    }
    // 레몬 칩을 끈 길(lemonLink 없음)도 글자예요 — 마트 dropLemon 은 { html, rules } 를 돌려주므로 테마 쪽에서 글로 풀어요
    const off = renderLog(model, { simple: { frame: frameK1, set: PLAIN }, setMod: SET, mode: 'dark' });
    assert.equal(typeof off, 'string'); assert.match(off, /^<div class="gk /); assert.doesNotMatch(off, /class="gk-lm"|\[object Object\]/);
    assert.match(renderLog(model, { simple: { frame: frameK1, set: PLAIN }, setMod: SET, mode: 'dark', lemonLink: true }), /class="gk-lm"/);
    const bare = { key: 'k9', html: '<div class="gk gk-tl gk-k9"><style>\n.gk-k9{color:#111}\n</style><p class="gk-nr">x</p></div>' };
    const html = U.fineHtml(PLAIN, bare, { open: ['color', 'motion', 'shape', 'prop'] });
    assert.match(html, /<div class="bl-lt-row is-off" role="group" aria-label="글 움직임"><span class="bl-lt-h">글 움직임<small>이 틀은 글 움직임이 없어요<\/small>/);
    assert.match(html, /aria-label="빠르기"><span class="bl-lt-h">빠르기<small>이 틀은 움직임이 없어요<\/small>/);
    assert.match(html, /<div class="bl-lt-num is-off" data-lt-f="shape\|radius"[^>]*><header><span class="bl-lt-h">모서리<small>[^<]+<\/small><\/span><span class="bl-lt-box"><input [^>]*disabled>/);
    assert.doesNotMatch(html, /aria-label="바탕 질감"/, '질감을 걸지 않는 틀은 칸을 통째로 숨겨요');
    assert.equal(S.fineOf(PLAIN, bare.html, 'k9').texture.blocked, true);
});

await test('세밀 화면: 갈래 다섯 · 숫자 조절칸은 모두 2열 격자 안 · 표의 칸이 빠짐없이 · 누른 값이 그대로 돌아와요', () => {
    assert.deepEqual(U.GROUPS.map(([id]) => id), ['color', 'text', 'motion', 'prop', 'shape']);
    const all = U.GROUPS.map(([id]) => id);
    const shut = U.fineHtml(PLAIN, frameK1, { open: [] });
    assert.equal((shut.match(/<details class="bl-lt-g"/g) || []).length, 5); assert.doesNotMatch(shut, /bl-lt-num|bl-lt-row/, '접힌 갈래는 칸을 그리지 않아요');
    assert.match(shut, /data-lt="reset\|all\|null" disabled>/);
    let seen = 0;
    for (const [tab] of U.TEXT_TABS) {
        let set = PLAIN;
        if (tab === 'dialogue') set = S.withLook(set, 'dialogue.style', 'marker');
        if (tab === 'strike') set = S.withLook(set, 'strike.line', 'own');
        if (tab === 'shadow') set = S.withLook(set, 'shadow.on', true);
        if (tab === 'outline') set = S.withLook(set, 'outline.on', true);
        const html = U.fineHtml(set, frameK1, { open: all, tab, mode: 'light' });
        const grids = html.split('<div class="bl-lt-grid">').slice(1).map(g => g.split('</div></div>')[0]);
        const inGrid = grids.reduce((n, g) => n + (g.match(/class="bl-lt-num/g) || []).length, 0);
        assert.equal(inGrid, (html.match(/class="bl-lt-num/g) || []).length, `${tab}: 숫자 칸은 전부 격자 안`);
        for (const f of S.LOOK_FIELDS.filter(x => x.tab === tab)) { assert.ok(html.includes(`look|${f.path}`) || f.kind === 'targets' && html.includes('target|text'), `${tab} ${f.path}`); seen++; }
        for (const f of S.SHAPE_FIELDS) assert.ok(html.includes(`shape|${f.path}`), f.path);
        for (const [id] of S.TEX_LIST) assert.ok(html.includes(`data-lt="tex|tex|&quot;${id}&quot;"`), id);
    }
    assert.equal(seen, S.LOOK_FIELDS.filter(f => !['simple', 'head'].includes(f.tab)).length, '글 갈래가 마트 글 모양 표의 칸을 다 그려요');
    // 움직임 갈래: 글 · 소품 줄이 따로 · 끔 약 중 강
    const html = U.fineHtml(S.withMotionPart(PLAIN, 'prop', 's'), frameK1, { open: ['motion'] });
    for (const part of ['text', 'prop']) for (const [v] of S.EASY_MOTION) assert.ok(html.includes(`data-lt="motion|${part}|&quot;${v}&quot;"`), `${part} ${v}`);
    assert.match(html, /data-lt="motion\|prop\|&quot;s&quot;" aria-pressed="true"/); assert.match(html, /data-lt="motion\|text\|&quot;m&quot;" aria-pressed="true"/);
    assert.match(html, /<summary data-lt-sum="motion"><b>움직임<\/b><small>글 중 · 소품 약<\/small><em>바꾼 것 1<\/em>/);
    // 눌린 값 왕복: 화면의 data-lt 를 그대로 fineAct 에
    const unesc = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const acts = [...U.fineHtml(PLAIN, frameK1, { open: all }).matchAll(/data-lt="([^"]+)"/g)].map(m => unesc(m[1]));
    assert.ok(acts.length > 40);
    for (const a of acts) { const next = U.fineAct(PLAIN, 'k1', a, 'dark'); assert.ok(readSet(next), a); }
    // 숫자칸: 보이는 단위(자간 em) ↔ 저장 단위(1/100em) · 빈 칸은 틀 그대로
    assert.equal(U.inputAction('look|type.letterSpacing', '100', 'number', '-0.03'), 'look|type.letterSpacing|-3');
    assert.equal(U.inputAction('look|type.letterSpacing', '100', 'range', '-3'), 'look|type.letterSpacing|-3');
    assert.equal(U.inputAction('shape|radius', '1', 'number', ''), 'shape|radius|null');
    assert.equal(U.inputAction('shape|radius', '1', 'number', 'abc'), '');
    assert.match(U.fineHtml(S.withLook(PLAIN, 'type.letterSpacing', -3), frameK1, { open: ['text'] }), /data-lt-i="look\|type\.letterSpacing\|n" min="-0\.05" max="0\.08" step="0\.01" placeholder="틀" value="-0\.03"/);
});

await test('2열 규칙: 세밀 CSS 는 숫자 칸 격자가 늘 두 칸 — 한 열로 내리는 규칙이 없어요 · 홀수로 남는 마지막 칸만 전체 폭', () => {
    const css = U.FINE_STYLE;
    assert.match(css, /\.bl-lt-grid \{ display:grid; grid-template-columns:repeat\(2, minmax\(0, 1fr\)\);/);
    assert.equal((css.match(/grid-template-columns/g) || []).length, 2, '격자 정의는 숫자 칸 · 간편|세밀 토글 둘뿐');
    assert.match(css, /\.bl-lt-grid > \.bl-lt-num:last-child:nth-child\(odd\) \{ grid-column:1 \/ -1; \}/);
    assert.doesNotMatch(css, /@container|@media[^{]*(max|min)-width/);
    assert.doesNotMatch(css, /animation|transition|filter|blur/, '조절 화면 자체는 움직임 · 흐림 없이');
    assert.match(css, /\.bl-lt-chips \{[^}]*overflow-x:auto/); assert.match(css, /\.bl-lt-num \{ display:grid; gap:2px; min-width:0; \}/);
});

await test('간편에 더한 줄: 색(인물표 색 · 원래 색 · 깡통 · 깡캐) · 질감(고르면 얹는 곳 · 진하기) · 바꾼 것 요약 · 더 조절하기', () => {
    const a = U.easyExtra(PLAIN, frameK1, 'dark');
    assert.equal(a.total, 0);
    assert.match(a.color, /aria-label="색"/); assert.match(a.color, /data-lt="cast\|all\|null" aria-pressed="true"[^>]*><span>인물표 색/);
    assert.match(a.color, /data-lt-color="cast\|main"/); assert.match(a.color, /data-lt-color="cast\|other"/);
    assert.equal(/소품도 캐릭터 색/.test(a.color), /^<div class="gk [^"]*\bgk-own\b/.test(frameK1.html), '「소품도 캐릭터 색」은 기본 색 틀에서만');
    assert.match(a.texture, /aria-label="질감"/); assert.doesNotMatch(a.texture, /얹는 곳|진하기/);
    assert.equal((a.texture.match(/class="bl-lt-sw"/g) || []).length, 8, '질감 칩마다 견본 네모');
    assert.doesNotMatch(a.tail, /bl-lc-easy-sum/); assert.match(a.tail, /data-lc-view="fine"><b>더 조절하기<\/b>/);
    const b = U.easyExtra(S.withCast(S.withTex(PLAIN, { tex: 'line' }), 'main', '#22aa66'), frameK1, 'light');
    assert.match(b.texture, /얹는 곳/); assert.match(b.texture, /data-lt="tex\|on\|&quot;c&quot;" aria-pressed="false"/); assert.match(b.texture, /진하기/); assert.match(b.texture, /빨간 세로줄/);
    assert.match(b.color, /data-lt-color="cast\|main" data-value="#22aa66" aria-pressed="true" style="--ink:#22aa66"/);
    assert.match(b.tail, /<b>바꾼 것 1<\/b> · 질감 줄 노트/); assert.equal(b.total, 1);
});

await test('늦게 받기: 조절 화면 · 조절 모듈은 import() 로만 — 시작 묶음 쪽 파일이 정적으로 끌어오지 않아요', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /import\('\.\/log-copy-tune-ui\.js'\)/);
    assert.doesNotMatch(sheet, /^import [^\n]*log-copy-tune-ui/m);
    for (const f of ['src/log-copy-presets.js', 'src/log-copy-simple.js', 'src/log-copy.js', 'src/mart-import.js', 'src/settings.js', 'index.js']) assert.doesNotMatch(read(f), /^\s*(?:import|export)\b[^;\n]*(?:geulkku-mart\/|log-copy-simple-set|log-copy-tune-ui|log-copy-tune-set)/m, f);
    assert.doesNotMatch(read('src/log-copy-simple-set.js'), /log-copy-tune-(?:set|ui)|capWhy|texSwatch|fineOf/, '그리기만 하는 조절 모듈(마트 조각)은 조절 화면 쪽 코드를 끌어오지 않아요');
    assert.doesNotMatch(read('src/log-copy-sheet.js'), /log-copy-tune-set/, '시트는 조절 화면 모듈만 불러요');
    assert.match(sheet, /if \(fine\.hold\) return;/, '슬라이더를 끄는 동안은 칸을 다시 그리지 않아요');
    assert.match(sheet, /fineMod\.fineAct\(live\.set, live\.frame\.key, action, modeOf\(state\.palette\)\)/);
    assert.match(sheet, /fineMod\.fineHtml\(mine\.set, mine\.frame, \{ mode, open: fine\.open, tab: fine\.tab, caps \}\)/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-tune\.mjs \./);
});

await test('「소품도 캐릭터 색」: 담아 온 틀 값(소품 기본 색 · 캐릭터 색)이 있으면 칩은 실제 상태로 보이고, 누르면 그 값을 떼어 누른 것이 먹어요', () => {
    const model1 = { messages: [{ name: '깡통', nodes: [{ t: 'text', text: '창밖을 보았다.' }] }, { name: '깡캐', nodes: [{ t: 'text', text: '「응.」' }] }] };
    const draw = set => renderLog(model1, { simple: { frame: frameK1, set }, setMod: SET, mode: 'dark', lookup: () => '#22aa66' });
    const own = { blGeulkku: 2, frame: 'k1', frames: { k1: { prop: { tone: 'own' } } } };
    assert.equal(S.fineOf(own, frameK1.html, 'k1').cover, false, '소품 기본 색이 걸린 틀은 「끔」으로 보여요');
    assert.equal(S.fineOf({ ...own, frames: { k1: { prop: { tone: 'cast' } } } }, frameK1.html, 'k1').cover, true);
    const on = S.withCover(own, true);
    assert.equal(readSet(on).tune?.own, undefined, '누르면 담아 온 틀 값을 떼요');
    assert.notEqual(draw(on), draw(S.withCover(own, false)), '켬 · 끔이 그림을 바꿔요');
    assert.equal(draw(on), draw(S.withCover(PLAIN, true)));
});

await test('바꾼 것 요약: 간편 「글 크기」도 수와 함께 낱말로 적어요(「바꾼 것 1」 뒤가 비지 않게)', () => {
    const big = SET.withSize(PLAIN, 2), f = S.fineOf(big, frameK1.html, 'k1');
    assert.equal(f.total, f.words.length);
    assert.deepEqual(f.words, ['글 크기 크게']);
    assert.match(U.easyExtra(big, frameK1, 'dark').tail, /<b>바꾼 것 1<\/b> · 글 크기 크게/);
});

await test('틀별 능력표(마트 측정 상한 · 1.1.5): 제목 · 여백 상한이 그 틀 값으로 잘려 마트와 같은 결과 — 상한이 일괄 값 그대로인 틀은 예전 그대로', async () => {
    const { capsRow } = await load('src/geulkku-mart/caps-table.js');
    const at = (key, mode = 'dark') => inputs.find(x => x.key === key && x.mode === mode).html;
    // k1079: 마트 측정 제목 상한 22 — 28 을 넣어도 22 로(마트 titleIn 과 같게) · 22 를 넣은 것과 글자 하나 다르지 않아요
    assert.equal(capsRow('k1079').title.max, 22);
    for (const mode of ['light', 'dark']) {
        const got = S.applySet(at('k1079', mode), S.withLook(PLAIN, 'title.size', 28), { mode, key: 'k1079', caps: capsRow('k1079') });
        assert.equal(got, S.applySet(at('k1079', mode), S.withLook(PLAIN, 'title.size', 22), { mode, key: 'k1079' }), mode);
        assert.match(got, /\.gk-tt\{font-size:22px;/);
    }
    // 표가 없을 때(못 받음)는 예전처럼 일괄 상한 28
    assert.match(S.applySet(at('k1079'), S.withLook(PLAIN, 'title.size', 28), { mode: 'dark', key: 'k1079' }), /\.gk-tt\{font-size:28px;/);
    // k1: 상한이 일괄 값과 같아 표에 줄이 없어요 → 받은 그대로 28
    assert.equal(capsRow('k1'), null);
    const k1 = S.applySet(at('k1'), S.withLook(PLAIN, 'title.size', 28), { mode: 'dark', key: 'k1', caps: capsRow('k1') });
    assert.equal(k1, S.applySet(at('k1'), S.withLook(PLAIN, 'title.size', 28), { mode: 'dark', key: 'k1' })); assert.match(k1, /\.gk-tt\{font-size:28px;/);
    // 그 밖의 꼴: 제목 크기를 못 바꾸는 틀(false) · 여백을 못 바꾸는 틀 · 폭이 좁은 틀도 표가 실어요
    assert.deepEqual(capsRow('k1440'), { pad: false, band: 'color', width: [480] });
    // 세밀 칸도 그 틀 상한까지(마트 capped 와 같게) — 표 줄이 없으면 28
    const k1079 = { ...frameK1, key: 'k1079' };
    assert.match(U.fineHtml(PLAIN, k1079, { open: ['text'], tab: 'title', caps: capsRow('k1079') }), /data-lt-i="look\|title\.size\|r" min="16" max="22"/);
    assert.match(U.fineHtml(PLAIN, k1079, { open: ['text'], tab: 'title' }), /data-lt-i="look\|title\.size\|r" min="16" max="28"/);
    // 여백: 측정 범위가 좁은 틀은 칸 범위도 그만큼 · 내보내는 값도 그 안으로(마트 padIn)
    const narrow = { pad: [90, 110] };
    assert.match(U.fineHtml(PLAIN, frameK1, { open: ['shape'], caps: narrow }), /data-lt-i="shape\|pad\|r" min="90" max="110"/);
    assert.equal(S.applySet(at('k1'), S.withShape(PLAIN, 'pad', 130), { mode: 'dark', key: 'k1', caps: narrow }), S.applySet(at('k1'), S.withShape(PLAIN, 'pad', 110), { mode: 'dark', key: 'k1' }));
    // 시트는 조절 모듈과 표를 같이 받아(표를 못 받으면 일괄 상한) 그리기 · 간편 · 세밀에 같은 줄을 넘겨요
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /Promise\.all\(\[import\('\.\/log-copy-simple-set\.js'\), import\('\.\/geulkku-mart\/caps-table\.js'\)\.catch\(\(\) => null\)\]\)/);
    assert.match(sheet, /renderLog\(shown\.model, \{ simple: mine, setMod, caps: capRow\(mine\.frame\.key\)/);
    assert.match(sheet, /fineMod\.easyExtra\(mine\.set, mine\.frame, mode, caps\)/);
    for (const f of ['src/log-copy-presets.js', 'src/log-copy-simple-set.js', 'src/log-copy-tune-ui.js', 'src/log-copy-tune-set.js', 'src/log-copy.js', 'index.js']) assert.doesNotMatch(read(f), /^\s*(?:import|export)\b[^;\n]*caps-table/m, `${f} 가 표를 정적으로 끌어오지 않아요`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
