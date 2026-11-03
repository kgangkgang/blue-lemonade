// 검색 결과의 「밝기」는 고른 색 계열을 두고 화이트 · 나이트만 바꾸고, 달 단추처럼 자동 전환을 꺼서 곧바로 되돌아가지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.'), root = pathToFileURL(dir + '/');
const { paletteBrightness, withBrightness, paletteVariant } = await import(new URL('src/palettes.js', root));
assert.equal(withBrightness('peach', 'night'), paletteVariant('peach', 'dark'), '피치에서 나이트를 누르면 피치 나이트');
assert.notEqual(withBrightness('peach', 'night'), 'night', '블루 나이트로 넘어가지 않아요');
assert.equal(withBrightness(paletteVariant('peach', 'dark'), 'salt'), 'peach', '되돌려도 피치');
assert.equal(withBrightness('salt', 'night'), 'night', '블루는 그대로');
assert.equal(paletteBrightness('peach'), 'salt', '피치 화이트는 화이트로 보여요');
assert.equal(paletteBrightness(paletteVariant('peach', 'dark')), 'night');
const { QUICK } = await import(new URL('src/settings-intents.js', root));
assert.deepEqual(QUICK.palette.also, { 'auto.on': false }, '자동 전환도 함께 꺼요');
const panel = fs.readFileSync(path.join(dir, 'src/panel.js'), 'utf8');
assert.match(panel, /read: path => path === 'palette' \? paletteBrightness\(getSettings\(\)\.palette\)/, '밝기로 읽어요');
assert.match(panel, /path === 'palette'\) st\.palette = withBrightness\(st\.palette, value\)/, '밝기로 써요');
console.log('PASS 밝기 조작이 색 계열을 지키고 자동 전환을 꺼요');
