// 10-29 상태창 한글 표시 정규식(bl-status-ko-weather) 뒤에도 「트래커 따라」 날씨가 데우스 · 레모나 트래커 날씨 칸을 읽어요.
//   그 정규식은 날씨 낱말을 빈 <span class="bl-sko" data-en="Light rain"></span> 으로 바꾸고 CSS ::before 가 한글을 그려요 —
//   칸의 글자(textContent)에는 그림 글자(🌧️)만 남아서 비 · 눈 · 안개가 모두 꺼졌어요. 원래 영어 낱말은 data-en 에 있어요.
//   node tools/tests/weather-status-ko.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');

// 실리태번이 메시지 HTML 에 붙이는 custom- 접두사까지 그대로 흉내 낸 아주 작은 DOM
const text = value => ({ nodeType: 3, textContent: value });
const el = (classes, children = [], attrs = {}) => ({
    nodeType: 1, attrs, childNodes: children,
    classList: { contains: c => classes.includes(c) },
    get textContent() { return children.map(c => c.textContent).join(''); },
    getAttribute: k => attrs[k] ?? null,
    hasAttribute: k => k in attrs,
    matches: sel => sel.split(',').some(s => classes.some(c => s.trim() === `.${c}`)),
});
const glyph = g => el(['custom-dem-track__glyph'], [text(g)]);
const sko = en => el(['custom-bl-sko'], [], { 'data-en': en });
let sky = null;
const mes = { querySelectorAll: () => (sky ? [sky] : []) };
globalThis.window ??= { matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document ??= { querySelector: sel => (sel.includes('mesid="0"') ? mes : null), body: { classList: { contains: () => false } } };
globalThis.SillyTavern = { getContext: () => ({ chat: [{ is_user: false, mes: '<tracker>…</tracker>' }], extensionSettings: {}, eventSource: { on() {} }, event_types: {} }) };
const { weatherState } = await import(new URL('src/weather.js', root));
const tracker = () => weatherState().tracker;

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
check('한글 표시 전(영어 글자 그대로)은 예전처럼', () => {
    sky = el(['custom-dem-track__sky'], [glyph('🌧️'), text('Light rain')]);
    assert.equal(tracker(), 'rain');
});
check('한글 표시 뒤: 날씨 낱말이 빈 칸 + data-en 이어도 비 · 눈 · 안개', () => {
    sky = el(['custom-dem-track__sky'], [glyph('🌧️'), sko('Light rain')]);
    assert.equal(tracker(), 'rain');
    sky = el(['custom-dem-track__sky'], [glyph('❄️'), sko('Heavy snow')]);
    assert.equal(tracker(), 'snow');
    sky = el(['custom-dem-track__sky'], [glyph('🌫️'), sko('Fog')]);
    assert.equal(tracker(), 'fog');
});
check('낱말 여럿(쉼표 사이 글자는 그대로 남음)', () => {
    sky = el(['custom-dem-track__sky'], [glyph('🌦️'), sko('Drizzle'), text(', '), sko('windy')]);
    assert.equal(tracker(), 'rain');
});
check('낱말표에 없는 낱말은 글자로 남아 그대로 읽어요', () => {
    sky = el(['custom-dem-track__sky'], [glyph('☁️'), sko('Overcast'), text(', snow flurries')]);
    assert.equal(tracker(), 'snow');
});
console.log(`weather-status-ko: ${passed} passed`);
