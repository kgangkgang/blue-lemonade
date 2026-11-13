// 결함 고침 — 「기본 글꾸」 19틀의 굵은 낱말이 가짜 굵게로 뭉개지던 것(공개판 감사 · 1.2.1 굵게 고침이 심플 새 틀 · 추천에만 들어가고 늘 보이는 기본 글꾸엔 빠졌어요)
//   본문이 명조("RIDIBatang","Noto Serif KR",serif · 깡통은 400 한 굵기)라 <b> · <strong> 을 브라우저가 번지게 그렸어요 → 「굵게 = 고딕 700」 한 줄을 틀 규칙에 넣어요.
//   생성물을 손으로 고치지 않고 생성기의 바꿀 자리(tools/mart/basic-frames.mjs)에서 넣어요. 선언은 심플 새 틀의 BOLD_RULE(tools/mart/simple-frames.mjs)과 같아요.
//   ① 19틀 모두: 명조 400 글 칸(문단 p · 메신저 말풍선 .bb)마다 굵게 규칙이 한 번 · 다른 명조 400 글 칸이 생기면 여기서 걸려요
//   ② 실제로 그린 글: 굵은 낱말(<b>)이 문단 · 말풍선 안에 있고 그 틀의 굵게 규칙이 같이 실려요(낮 · 밤)
//   ③ 숨긴 글이 든 문단(div.blsp-p)에도 짝 규칙이 붙어요
//   node tools/tests/log-copy-basic-bold.mjs .
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('log-copy-basic-bold');

const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const B = await load('src/log-copy-basic.js');
const G = await load('src/log-copy-basic.gen.js');
const { paragraphTwin, PARA_CLASS } = await load('src/log-copy-spoiler.js');
const simple = await load('tools/mart/simple-frames.mjs');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const DECL = simple.BOLD_RULE('k1').replace(/^[^{]*/, '');   // {font-family:Pretendard,…;font-weight:700}
const ruleP = k => `.${k} p strong,.${k} p b${DECL}`;
const ruleBubble = k => `.${k} .bb strong,.${k} .bb b${DECL}`;
const cssOf = html => html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
const count = (text, part) => text.split(part).length - 1;
/** 틀 CSS 에서 명조 400 으로 글을 그리는 규칙의 선택자 꼬리(틀 class 뒤) */
const serifBodies = (css, k) => [...css.matchAll(/(^|\})\s*([^{}]+)\{[^}]*?font:400 [^;}]*(?<!sans-)serif[;}]/g)].flatMap(m => m[2].split(',').map(s => s.trim().replace(new RegExp(`^\\.${k}\\s*`), '')));

await test('① 19틀 모두: 명조 400 글 칸은 문단(p) · 말풍선(.bb)뿐이고 칸마다 「굵게 = 고딕 700」 규칙이 한 번이에요', () => {
    assert.equal(G.frames.length, 19);
    assert.match(DECL, /^\{font-family:Pretendard,[^}]*sans-serif;font-weight:700\}$/);
    let bubbles = 0;
    for (const f of G.frames) {
        const css = cssOf(G.buildFrame(f.no, {}));
        const bodies = serifBodies(css, f.k);
        assert.ok(bodies.includes('p'), `${f.id}: 본문 문단이 명조 400 이 아니에요 — 시험을 맞춰요(${bodies.join(' · ')})`);
        const other = bodies.filter(s => s !== 'p' && s !== '.bb');
        assert.deepEqual(other, [], `${f.id}: 굵게 규칙이 없는 명조 400 글 칸이 있어요`);
        assert.equal(count(css, ruleP(f.k)), 1, `${f.id}: 문단 굵게 규칙`);
        const bubble = bodies.includes('.bb');
        assert.equal(count(css, ruleBubble(f.k)), bubble ? 1 : 0, `${f.id}: 말풍선 굵게 규칙`);
        if (bubble) bubbles++;
    }
    assert.equal(bubbles, 1, '말풍선 틀은 메신저 하나예요');
});

await test('생성기: 생성물을 손으로 고치지 않고 tools/mart/basic-frames.mjs 의 바꿀 자리로 넣어요', () => {
    const tool = read('tools/mart/basic-frames.mjs');
    assert.ok(tool.includes("'\\n${p} p strong,${p} p b{font-family:${GOTHIC};font-weight:700}', '본문 굵게(고딕 700)'"));
    assert.ok(tool.includes("'${p} .bb strong,${p} .bb b{font-family:${GOTHIC};font-weight:700}\\n' + BUBBLE, '말풍선 굵게(고딕 700)'"));
});

// ── 화면에서 뜬 모델 꼴(굵은 낱말 · 대사 띠 안 굵은 낱말) ──
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'line-height': '24px' };
const words = text => ({ t: 'text', text });
const strong = text => ({ t: 'el', block: false, tag: 'strong', style: { 'font-weight': '650' }, children: [words(text)] });   // 테마 기본 굵기 650
const band = (...children) => ({ t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': 'linear-gradient(transparent 5%, rgba(58, 167, 255, .35) 5%, rgba(58, 167, 255, .35) 100%, transparent 100%)' }, children });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const msg = (name, nodes, i) => ({ index: i, user: false, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: null, nodes });
const MODEL = {
    messages: [
        msg('하루', [para(words('창가에서 '), strong('굵은지문'), words(' 을 봤어요.')), para(band(words('「대사 속 '), strong('굵은대사'), words('」')))], 0),
        msg('도윤', [para(band(words('「짧은 '), strong('둘째굵게'), words('」')))], 1),
    ],
    base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '',
};

await test('② 그린 글(18틀 × 낮밤): 굵은 낱말이 문단 · 말풍선 안에 있고 그 틀의 굵게 규칙이 같이 실려요', () => {
    for (const f of B.BASIC_FRAMES) for (const mode of ['light', 'dark']) {
        const { html } = B.drawBasic(f.id, MODEL, { mode, fields: { title: '제목' } });
        const css = cssOf(html), body = html.slice(html.indexOf('</style>'));
        assert.equal(count(css, ruleP(f.key)), 1, `${f.id} ${mode}: 문단 굵게 규칙`);
        if (f.id === 'messenger') {
            assert.equal(count(css, ruleBubble(f.key)), 1, `${f.id} ${mode}: 말풍선 굵게 규칙`);
            assert.match(body, /<summary class="bb [^"]*"[^>]*><span class="bt">[^]*?<b>굵은대사<\/b>/, `${f.id} ${mode}: 말풍선 안 굵은 낱말`);
        } else assert.match(body, /<p class="dl">(?:(?!<\/p>)[^])*?<b>굵은대사<\/b>/, `${f.id} ${mode}: 대사 문단 안 굵은 낱말`);
        assert.match(body, /<p class="nr">(?:(?!<\/p>)[^])*?<b>굵은지문<\/b>/, `${f.id} ${mode}: 지문 문단 안 굵은 낱말`);   // 기사 · 책은 첫 글자 장식이 앞에 와요
    }
});

await test('③ 숨긴 글이 든 문단(div.blsp-p)에도 굵게 규칙의 짝이 붙어요', () => {
    const css = paragraphTwin(cssOf(G.buildFrame(429, {})));
    assert.ok(css.includes(`.kb429 p strong,.kb429 p b,.kb429 .${PARA_CLASS} strong,.kb429 .${PARA_CLASS} b${DECL}`), '문단 굵게 규칙의 짝');
});

done();
