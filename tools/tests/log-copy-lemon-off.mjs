// 1.1.5 로그 복사 「레몬 바로가기」를 끄면 기본 글꾸 18틀에서도 레몬이 그림째 사라져요(미리보기 · 복사 글 모두)
//   사용자(1.1.4): 「레몬 바로가기 껐다 켜도 안사라지는데 미리보기에서?」 — 1.1.3 ~ 1.1.4 는 끄면 링크만 빼고 그림을 남겨(<span class="lm">) 켬 · 끔이 눈으로 똑같았어요.
//   복사 글은 미리보기 문서를 그대로 거둬요(시트 result()) — 기본 글꾸는 시트가 모서리 레몬을 따로 놓지 않으니 drawBasic 결과가 곧 미리보기 · 복사 글이에요.
//   node tools/tests/log-copy-lemon-off.mjs .
import { assert, load, suite } from './_t.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './_t.mjs';
const { test, done } = suite('log-copy-lemon-off');

const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const B = await load('src/log-copy-basic.js');
const { renderLog } = await load('src/log-copy-presets.js');
const { LEMON_HOME } = await load('src/log-copy-lemon.js');

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'font-weight': '400', 'line-height': '24px' };
const para = text => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children: [{ t: 'text', text }] });
const msg = (name, text, i) => ({ index: i, user: false, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: Date.UTC(2026, 10, 12, 9, i), font: { ...SCREEN }, bubble: null, nodes: [para(text)] });
const model = { messages: [msg('하루', '창가에 섰다.', 0), msg('도윤', '「나가 볼까?」', 1)], base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' };
const IMAGES = [{ src: 'https://example.com/a.png', alt: '첫 장' }];
const LINK = `<a class="lm" href="${LEMON_HOME}"`;
const body = html => html.slice(html.indexOf('</style>'));
const balanced = html => (html.match(/<div\b/g) || []).length === (html.match(/<\/div>/g) || []).length;
const cases = [];
for (const id of B.BASIC_IDS) for (const mode of ['dark', 'light']) for (const info of B.BASIC_INFO) for (const title of ['', '저녁 정리']) for (const marks of [false, true])
    cases.push({ id, o: { mode, info, marks, images: IMAGES, fields: { title, mark: 'LOG', model: 'M', prompt: 'P', date: '11월 12일' } } });

await test('끄면 18틀 모두 레몬 그림 · 링크 · 그림 규칙이 없어요(1.1.4 는 그림이 남아 켬 · 끔이 같았어요)', () => {
    for (const { id, o } of cases) {
        const off = B.drawBasic(id, model, { ...o, lemonLink: false }).html, tag = `${id} ${o.mode} ${o.info} ${o.fields.title ? '제목' : '-'}`;
        assert.ok(!off.includes(LEMON_HOME), `${tag}: 링크 없음`);
        assert.doesNotMatch(off, /class="lmi"|\.lmi\{|title="블루레몬에이드"/, `${tag}: 레몬 그림 없음`);
        assert.ok(balanced(off), `${tag}: <div> 짝`);
        assert.equal((off.match(/<style>/g) || []).length, 1, `${tag}: <style> 하나`);
        assert.ok(off.includes('창가에 섰다'), `${tag}: 로그 글은 그대로`);
        const on = B.drawBasic(id, model, { ...o, lemonLink: true }).html;
        assert.notEqual(on, off, `${tag}: 켬 · 끔이 달라요`);
    }
});

await test('켠 그림은 그대로: 레몬 바로가기 하나 · 덧붙인 규칙 없음', () => {
    for (const { id, o } of cases) {
        const on = B.drawBasic(id, model, { ...o, lemonLink: true }).html, key = B.BASIC_FRAMES.find(f => f.id === id).key;
        assert.equal(on.split(LINK).length - 1, 1, `${id}: 레몬 바로가기 하나`);
        assert.match(on, new RegExp(`\\.${key} \\.lmi\\{`), `${id}: 레몬 그림 규칙`);
        assert.ok(!on.includes(`.${key}.${key} `), `${id}: 끈 그림용 규칙이 켠 그림에 없음`);
    }
});

await test('레몬만 보이던 머리 줄은 통째로 빠져요 — 빈 22px 띠 없음(사용자 화면: 레몬 틀 · 제목 끔)', () => {
    for (const { id, o } of cases) {
        const off = body(B.drawBasic(id, model, { ...o, lemonLink: false }).html);
        for (const m of off.matchAll(/<div class="hd">([\s\S]*?)<\/div>\n/g)) {
            const seen = (o.info === 'chip' ? m[1] : m[1].replace(/<p class="cp\b[^>]*>[\s\S]*?<\/p>/g, '')).trim();
            assert.ok(seen, `${id} ${o.info}: 빈 머리 줄이 남음`);
        }
    }
    const lemon = B.drawBasic('lemon', model, { mode: 'dark', info: 'off', fields: { title: '' }, lemonLink: false }).html;
    assert.ok(!body(lemon).includes('<div class="hd"'), '레몬 틀 · 제목 끔: 머리 줄째 빠짐(노란 막대 바로 아래 로그)');
    assert.match(body(lemon), /<div class="pr"><span class="pb"><\/span>/, '노란 막대는 그대로');
    const titled = B.drawBasic('lemon', model, { mode: 'dark', info: 'off', fields: { title: '저녁 정리' }, lemonLink: false }).html;
    assert.match(body(titled), /<div class="hd"><div class="tt">저녁 정리<\/div><\/div>/, '레몬 틀 · 제목 있음: 제목만 남아 왼쪽 끝으로');
    const card = B.drawBasic('card', model, { mode: 'dark', info: 'off', fields: { title: '저녁 정리' }, lemonLink: false }).html;
    assert.match(card, /\.kb\d+\.kb\d+ \.tt\{margin-top:0\}/, '머리 줄이 빠지면 바로 아래 제목은 위로 붙어요(마트 「레몬 빼기」와 같음)');
});

await test('다른 것이 남는 머리 줄은 그것을 제자리에: 양끝 맞춤 줄은 오른쪽 끝 · 책은 빈 자리 · 미니는 밑줄을 제목 시작에', () => {
    const at = (id, extra = {}) => B.drawBasic(id, model, { mode: 'dark', info: 'chip', fields: { title: '저녁 정리', mark: 'LOG' }, lemonLink: false, ...extra }).html;
    for (const id of ['card', 'tab', 'notify', 'record', 'note', 'diary', 'article', 'letter', 'gallery-strip', 'gallery-grid']) assert.match(at(id), /\.kb\d+\.kb\d+ \.hd\{justify-content:flex-end\}/, `${id}: 칩 · 우표가 오른쪽 끝 그대로`);
    for (const id of ['mini', 'lemon', 'messenger', 'window']) assert.ok(!/\.hd\{justify-content:flex-end\}/.test(at(id)), `${id}: 왼쪽부터 놓는 줄은 맞춤을 안 바꿔요`);
    assert.match(at('book'), /<div class="hd"><span class="lm" aria-hidden="true"><\/span><p class="rh">/, '책: 가운데 머리글이 안 밀리게 빈 자리');
    assert.match(at('mini'), /\.kb\d+\.kb\d+ \.ul\{margin-left:0\}/, '미니: 제목 밑줄이 제목 시작에');
});

await test('시트 길: renderLog 도 끈 값을 그대로 넘기고, 기본 글꾸에는 모서리 레몬을 따로 놓지 않아요(미리보기 = 복사 글)', () => {
    const night = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgb(56, 74, 98)', marker: 'rgb(255, 232, 115)' };
    const off = renderLog(model, { shape: 'lemon', colors: night, mode: 'dark', fields: { title: '' }, lemonLink: false });
    assert.doesNotMatch(off, /class="lmi"|posts\/157369/);
    const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
    assert.match(sheet, /if \(store\(\)\.lemonLink && !basicOn\(\) && !simpleOn\(\)\) \{ try \{ placeLemon\(doc,/);
    assert.match(sheet, /s2\.lemonLink = !s2\.lemonLink; saveSettings\(\); draw\(\);/, '칩을 누르면 다시 그려요');
});

done();
