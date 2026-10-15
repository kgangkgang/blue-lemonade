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
// 6.7.5 (회귀검사 6.7.4): 목록 기호 · 이모지로 시작하는 줄과 일본어 天気를 놓쳤고, 같은 줄 다른 칸(时间：夜晚)이 판정을 뒤집었고, 생각 블록 속 날씨 줄이 먼저 잡혔다
check('bullets, emoji, 天気, trailing fields, thinking blocks', () => {
    assert.deepEqual(modes('🌧️ 날씨: 비'), ['rain']);
    assert.deepEqual(modes('- 날씨: 눈'), ['snow']);
    assert.deepEqual(modes('* **Weather:** light rain'), ['rain']);
    assert.deepEqual(modes('天気：霧'), ['fog']);
    assert.equal(statusWeatherText('天气：晴 时间：夜晚 地点：图书馆'), '晴');
    assert.deepEqual(modes('天气：晴 时间：夜晚'), ['sun']);
    assert.equal(statusWeatherText('Weather: Clear, Time: 23:10'), 'Clear');
    assert.deepEqual(modes('<think>\n천천히 생각: 날씨: 눈이 오면 좋겠다\n</think>\n<status>\n날씨: 맑음\n</status>'), ['sun']);
    // 날씨만 있는 줄 · 시간 낱말이 칸 이름이 아닐 때는 그대로
    assert.equal(statusWeatherText('날씨: 저녁 무렵 소낙비'), '저녁 무렵 소낙비');
    assert.equal(statusWeatherText('Weather: storm, no time to rest'), 'storm, no time to rest');
});
check('no wind is not a breeze', () => {
    assert.deepEqual(modes('Weather: Perpetual twilight over the old city, dry and windless, 19℃'), ['sun']);
    assert.deepEqual(modes('날씨: 끝없는 황혼, 바람 한 점 없이 메마른, 19℃'), ['sun']);
    assert.deepEqual(modes('날씨: 맑음, 바람 없음'), ['sun']);
    assert.deepEqual(modes('天气：晴，无风'), ['sun']);
    assert.deepEqual(modes('天候：晴れ、風もなく穏やか'), ['sun']);
    assert.deepEqual(modes('Weather: clear, no wind'), ['sun']);
    // 바람이 있는 말은 그대로
    assert.deepEqual(modes('날씨: 맑음, 산들바람'), ['sun', 'breeze']);
    assert.deepEqual(modes('Weather: windy and clear'), ['sun', 'breeze']);
    assert.deepEqual(modes('天气：晴朗，微风'), ['sun', 'breeze']);
    assert.ok(modes('날씨: 바람이 거세게 분다').includes('breeze'));
});
console.log(`weather-status: ${passed} passed, 0 failed`);
