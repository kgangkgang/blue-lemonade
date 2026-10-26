// 6.5.4 상태 카드 고정 값: 날짜 · 시각 · 날씨 낱말은 규칙으로, 전에 번역한 같은 값은 기억으로 채우고 모델에는 나머지 값만 보낸다.
// 합성 예시만 (프리셋 본문 · 렌더러 코드 · 개인 자료 없음).   node tools/tests/translator-card-values.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/translator');
const { ruleValue, cardValues, forgetCardValueMemory } = await import(pathToFileURL(path.join(dir, 'card-values.js')).href);
const { prepareDisplayCards, matchesDisplayCardStructure } = await import(pathToFileURL(path.join(dir, 'display-cards.js')).href);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const storage = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };
function prepare(source, values) {
    const reserved = [];
    return prepareDisplayCards(source, { reserve: () => `[[__VAR_${reserved.push('') + 20}__]]`, localValue: values?.local, learn: values?.learn });
}
const tokens = text => text.match(/\[\[__VAR_\d+__\]\]/g) || [];
// 모델 흉내: 자리표시자 뒤의 값만 바꾼다
const answer = (text, pairs) => Object.entries(pairs).reduce((s, [a, b]) => s.replaceAll(a, b), text);

test('fixed dates, weekdays and times read locally', () => {
    assert.equal(ruleValue('2026年10月15日 星期四'), '2026년 10월 15일 목요일');
    assert.equal(ruleValue('王国历104年 10月14日 星期二'), '왕국력 104년 10월 14일 화요일');
    assert.equal(ruleValue('A.B.C行政历12年 3月1日'), 'A.B.C 행정력 12년 3월 1일');
    assert.equal(ruleValue('10月14日，周日'), '10월 14일 일요일');
    assert.equal(ruleValue('星期六'), '토요일');
    assert.equal(ruleValue('上午 07:35'), '오전 07:35');
    assert.equal(ruleValue('深夜23：05'), '심야 23:05');
    assert.equal(ruleValue('April 2, Tuesday, 2030'), '2030년 4월 2일 화요일');
    assert.equal(ruleValue('Tuesday, April 2nd, 2030'), '2030년 4월 2일 화요일');
    assert.equal(ruleValue('Late afternoon'), '늦은 오후');
    assert.equal(ruleValue('PM'), '오후');
});
test('weather made only of dictionary words reads locally; anything else goes to the model', () => {
    assert.equal(ruleValue('晴 微风'), '맑음 산들바람');
    assert.equal(ruleValue('恒温晴朗'), '항온 맑음');
    assert.equal(ruleValue('微阴 恒温'), '약간 흐림 항온');
    assert.equal(ruleValue('多云转小雨'), null, 'unknown 转 is never guessed');
    assert.equal(ruleValue('Clear,'), '맑음,');
    assert.equal(ruleValue('Partly cloudy · Breezy'), '구름 조금 · 산들바람');
    for (const text of ['上层区·微阴', '晴 朗朗微风', 'Green hall', 'The day begins', '两步距离 · 一条围裙', '2026-10-15', 'Morning walk'])
        assert.equal(ruleValue(text), null, text);
});
test('a local field is never sent; the card restores with the local value and exact keys', () => {
    forgetCardValueMemory();
    const values = cardValues({ scope: 's', storage: storage() });
    const src = '<status_bar>\n日期：2026年10月15日 星期四\n时间：上午 07:15\n天气：晴 微风 19℃\n地点：Green hall\n题记：The day begins\n之间：A folded map\n</status_bar>';
    const p = prepare(src, values);
    for (const fixed of ['2026年', '上午', '晴', '日期', 'status_bar']) assert.ok(!p.text.includes(fixed), fixed);
    assert.equal(tokens(p.text).length, 3 + 2, 'three model fields plus open/close');
    const out = p.restore(answer(p.text, { 'Green hall': '초록 홀', 'The day begins': '하루가 시작된다', 'A folded map': '접힌 지도' }));
    assert.equal(out, '<status_bar>\n日期：2026년 10월 15일 목요일\n时间：오전 07:15\n天气：맑음 산들바람 19℃\n地点：초록 홀\n题记：하루가 시작된다\n之间：접힌 지도\n</status_bar>');
    assert.ok(matchesDisplayCardStructure(src, out), 'stored display still matches the card structure');
    assert.ok(p.cacheable(p.text, answer(p.text, { 'Green hall': '초록 홀', 'The day begins': '하루가 시작된다', 'A folded map': '접힌 지도' })));
});
test('a value the model translated once is reused next time and not sent; retranslation asks again and overwrites', () => {
    forgetCardValueMemory();
    const box = storage();
    const card = place => `<status_bar>\n日期：2026年10月15日 星期四\n地点：${place}\n题记：A new line\n</status_bar>`;
    const first = prepare(card('Green hall'), cardValues({ scope: 's', storage: box }));
    first.restore(answer(first.text, { 'Green hall': '초록 홀', 'A new line': '새 줄' }));
    assert.equal(JSON.parse(box.data.get('llmt-card-values-v1')).length, 2);
    forgetCardValueMemory();
    const second = prepare(card('Green hall'), cardValues({ scope: 's', storage: box }));
    assert.ok(!second.text.includes('Green hall'), 'remembered value stays local (read back from storage)');
    assert.ok(second.restore(answer(second.text, { 'A new line': '새 줄' })).includes('地点：초록 홀'));
    const other = prepare(card('Green hall'), cardValues({ scope: 'other glossary', storage: box }));
    assert.ok(other.text.includes('Green hall'), 'another prompt/glossary scope does not reuse it');
    const again = prepare(card('Green hall'), cardValues({ scope: 's', storage: box, remember: false }));
    assert.ok(again.text.includes('Green hall'), 'retranslation sends it again');
    again.restore(answer(again.text, { 'Green hall': '녹색 홀', 'A new line': '새 줄' }));
    const fixed = prepare(card('Green hall'), cardValues({ scope: 's', storage: box }));
    assert.ok(fixed.restore(answer(fixed.text, { 'A new line': '새 줄' })).includes('地点：녹색 홀'), 'the retranslated value replaces the old one');
});
test('half-translated, unchanged or placeholder answers are not remembered; a failed card remembers nothing', () => {
    forgetCardValueMemory();
    const box = storage(), values = cardValues({ scope: 's', storage: box });
    values.learn('Green hall', 'Green hall'); values.learn('静かな部屋', '静かな방'); values.learn('Hall', '[[__VAR_3__]]'); values.learn('上午 07:15', '오전 07:15');
    assert.equal(box.data.size, 0);
    const p = prepare('<status_bar>\n地点：Green hall\n题记：Line\n</status_bar>', values);
    const broken = answer(p.text, { 'Green hall': '초록 홀' }).replace(/\[\[__VAR_23__\]\]Line/, '');
    assert.throws(() => p.restore(broken));
    assert.equal(box.data.size, 0, 'restore failed before learning');
    for (let i = 0; i < 405; i++) values.learn(`Room ${i}`, `방 ${i}`);
    assert.equal(JSON.parse(box.data.get('llmt-card-values-v1')).length, 400, 'only the newest 400 are kept');
});
test('a card whose every value is local still restores; nothing of it reaches the model', () => {
    forgetCardValueMemory();
    const src = '<tracker> 🌅 Morning | April 2, Tuesday, 2030 | ☀️ Clear, 19°C </tracker>';
    const p = prepare(src, cardValues({ scope: 's', storage: storage() }));
    assert.equal(tokens(p.text).length, 1, '8.0.6 다 채운 카드는 여닫는 표시 둘 대신 자리표시 하나');
    assert.ok(!/Morning|April|Clear/.test(p.text));
    assert.equal(p.restore(p.text), '<tracker> 🌅 아침 | 2030년 4월 2일 화요일 | ☀️ 맑음, 19°C </tracker>');
});
test('without a local callback nothing changes (other target languages, input translation)', () => {
    const src = '<status_bar>\n日期：2026年10月15日 星期四\n时间：上午 07:15\n</status_bar>';
    const p = prepare(src);
    assert.ok(p.text.includes('2026年10月15日 星期四') && p.text.includes('上午 07:15'));
    assert.equal(p.restore(p.text), src);
});
console.log(`translator-card-values: ${passed} groups passed`);
