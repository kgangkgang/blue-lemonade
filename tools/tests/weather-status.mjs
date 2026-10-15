// 6.6.9 weather tracker follows any status bar weather line (Fruit 天气, compact <present>, Weather:, 날씨:), including Chinese words.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
globalThis.window ??= { matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.SillyTavern ??= { getContext: () => ({ chat: [], extensionSettings: {}, eventSource: { on() {} }, event_types: {} }) };
const { statusWeatherText, detectWeatherAll } = await import(new URL('src/weather.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const modes = text => detectWeatherAll(statusWeatherText(text)).all;
check('Fruit status in Chinese', () => {
    assert.deepEqual(modes('<status_bar>\n日期：10月17日\n时间：傍晚 18:12\n天气：小雨 微凉 16℃\n地点：大厅\n</status_bar>'), ['rain']);
    assert.deepEqual(modes('<status_bar>\n天气：大雪纷飞 -5℃\n</status_bar>'), ['snow']);
    assert.deepEqual(modes('天气：浓雾 湿冷'), ['fog']);
    assert.ok(modes('天气：晴 风和日丽 26℃').includes('sun'));
});
check('English and Korean lines', () => {
    assert.deepEqual(modes('<status_bar>\nWeather: Heavy rain, thunder, 18℃\n</status_bar>'), ['rain']);
    assert.deepEqual(modes('날씨: 눈발 날림, 영하 2℃'), ['snow']);
});
check('compact status bar segment', () => {
    assert.equal(statusWeatherText('◸2025·06·07·14:30｜Tavern<present>Light rain · cold wind｜line◹'), 'Light rain · cold wind');
    assert.ok(modes('◸2025·06·07·14:30｜Tavern<present>Light rain · cold wind｜line◹').includes('rain'));
});
check('no status weather, no effect; umbrella is not rain', () => {
    assert.equal(statusWeatherText('本文只有雨伞，没有天气栏'), '');
    assert.deepEqual(detectWeatherAll('雨伞').all, []);
});
console.log(`weather-status: ${passed} passed, 0 failed`);
