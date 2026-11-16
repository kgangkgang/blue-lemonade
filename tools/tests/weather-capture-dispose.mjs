// 버그 사냥 2차: 캡처용 날씨 엔진이 오류 길에서 안 풀렸어요 — 내 그림(sprite) 읽기 · 엔진 준비가 실패하면 dispose 가 불리지 않아 실패할 때마다 엔진 · 재질 그림이 남았어요.
//   (모듈 안 날씨 층이 있어야 도는 함수라 소스 글로 확인해요 — capture-open.mjs 와 같은 방식)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/weather.js'), 'utf8').replace(/\r\n/g, '\n');
const bodyOf = name => { const at = source.indexOf(`export async function ${name}(`); assert.ok(at >= 0, name); return source.slice(at, source.indexOf('\n}\n', at) + 2); };
const still = bodyOf('captureWeather');
assert.ok(still.indexOf('spriteBitmap(') > still.indexOf('try {'), '정지 그림: 내 그림 읽기도 try 안(실패하면 finally 가 엔진을 풀어요)');
assert.match(still, /finally \{ engine\.dispose\(\)/);
const anim = bodyOf('captureWeatherAnimation');
const tryAt = anim.indexOf('try{') >= 0 ? anim.indexOf('try{') : anim.indexOf('try {');
assert.ok(tryAt >= 0 && anim.indexOf('spriteBitmap(') > tryAt && anim.indexOf('engine.ready()') > tryAt, '움짤 · 영상: 내 그림 읽기 · 엔진 준비가 try 안');
assert.match(anim.slice(tryAt), /catch\s*\((\w+)\)\s*\{\s*engine\.dispose\(\);[^}]*throw \1;?\s*\}/, '실패하면 엔진을 풀고 오류를 그대로 올려요');
console.log('통과: 캡처용 날씨 엔진은 실패해도 풀려요');
