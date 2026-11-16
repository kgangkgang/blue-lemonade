// 1.5.9 TTS 설정 「이 채팅의 캐릭터」 목소리 줄에 인물표 명단 — src/addons/tts/src/roster-core.js (순수) + ui.js 연결. 이름은 모두 지어낸 것.
//   node tools/tests/tts-roster.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const R = await import(pathToFileURL(path.join(themeRoot, 'src/addons/tts/src/roster-core.js')).href);
const fold = (t) => String(t || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const P = (...names) => ({ name: names[0], names });

test('프리셋 표에만 있는 새 인물이 줄로 나온다 (명단 차례 그대로)', () => {
    assert.deepEqual(R.rosterSpeakers([P('Mina Park', '박미나'), P('Rex')], { fold }), ['Mina Park', 'Rex']);
});
test('나(페르소나)는 뺀다 — 다른 표기로 적혀 있어도', () => {
    assert.deepEqual(R.rosterSpeakers([P('Hero', '히어로'), P('Rex')], { fold, persona: '히어로' }), ['Rex']);
});
test('이미 줄이 있는 사람(대화 색 줄 · 캐릭터별 목소리 줄)은 뺀다 — 별칭으로 맞아도', () => {
    assert.deepEqual(R.rosterSpeakers([P('Mina', '미나'), P('Rex')], { fold, taken: new Set(['미나']) }), ['Rex']);
});
test('메시지에서 이미 찾은 이름은 다시 더하지 않는다 (같은 사람 두 줄 금지)', () => {
    assert.deepEqual(R.rosterSpeakers([P('Mina', '미나'), P('Rex')], { fold, scored: ['미나'] }), ['Rex']);
});
test('연결표에 있는 표기가 줄 이름 (목소리가 그 이름에 묶여 있다)', () => {
    assert.deepEqual(R.rosterSpeakers([P('Mina', '미나')], { fold, mapped: ['미나'] }), ['미나']);
});
test('명단 안에서 같은 사람이 두 번 나와도 한 줄 · 빈 이름 · 너무 긴 이름은 버린다', () => {
    assert.deepEqual(R.rosterSpeakers([P('Mina', '미나'), P('미나'), P(''), P('x'.repeat(31)), null], { fold }), ['Mina']);
});
test('명단이 없거나 접기 함수가 없으면 빈 목록', () => {
    assert.deepEqual(R.rosterSpeakers(null, { fold }), []);
    assert.deepEqual(R.rosterSpeakers([P('Mina')]), []);
});
test('ui.js: 「이 채팅의 캐릭터」 가 인물표 명단을 더한다 (메시지에 나온 사람 뒤 · 실패해도 줄은 그대로)', () => {
    const ui = fs.readFileSync(path.join(themeRoot, 'src/addons/tts/src/ui.js'), 'utf8');
    const body = ui.slice(ui.indexOf('function chatSpeakers('), ui.indexOf('function chatSpeakersHtml('));
    assert.match(body, /try \{ for \(const n of rosterSpeakers\(people\.list\(\), \{ fold: foldName, taken: new Set\(\[\.\.\.taken\.names, \.\.\.\(taken\.hints \|\| \[\]\)\]\), scored: score\.keys\(\), mapped: Object\.keys\(s\.char_map \|\| \{\}\), persona: ctx\.name1 \}\)\) add\(n, 1\); \} catch/);
    assert.ok(body.indexOf('rosterSpeakers(') > body.indexOf('chat.slice(-SPEAKER_SCAN)'), '메시지 훑기 뒤');
    assert.ok(body.indexOf('rosterSpeakers(') < body.indexOf('const groups = new Map()'), '같은 목소리 묶기 앞');
});
test('ui.js: 이름 없는 색 줄이 추천하는 이름은 명단에서 한 번 더 줄을 만들지 않는다 (그 줄의 ✓ 로 받는다)', () => {
    const ui = fs.readFileSync(path.join(themeRoot, 'src/addons/tts/src/ui.js'), 'utf8');
    const body = ui.slice(ui.indexOf('function chatSpeakersHtml('), ui.indexOf('function colorsCardHtml('));
    assert.match(body, /taken\.hints = new Set\(colorRowsList\.filter\(r => !r\.name\)\.map\(r => foldName\(topVote\(r\) \|\| \(r\.near && r\.near\.name\) \|\| ''\)\)\.filter\(Boolean\)\);/);
    assert.deepEqual(R.rosterSpeakers([P('Mina Park'), P('Rex')], { fold, taken: new Set([...new Set(['hero']), ...new Set(['mina park'])]) }), ['Rex']);
});
test('코드에 인물 이름 · 색이 없다', () => {
    const src = fs.readFileSync(path.join(themeRoot, 'src/addons/tts/src/roster-core.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /#[0-9a-f]{6}\b/i);
    assert.doesNotMatch(src, /['"`][^'"`\n]*[가-힣][^'"`\n]*['"`]/);
});

console.log(`tts-roster: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
