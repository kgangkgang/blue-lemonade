// TTS 1.9.7 · 테마 6.9.8 장면 소리 다리 — 테마의 배경 소리(빗소리 · 바람 · 물결 · 천둥)가 같은 소리를 내는 동안 TTS 효과음 줄을 건너뛴다.
//   다리: globalThis[Symbol.for('blue-lemonade.ambient')] = { version, playing(), kinds, covers(sfxId), onChange } — 꺼져 있으면 undefined.
//   player.js: ambientCovers(sfxId) 가 큐 돌리기(효과음 줄 건너뛰기)와 playSceneJob(미룬 효과음 startFx 길 포함) 두 곳에서 재생 직전에만 쓰인다. 내보내기(WAV · 대본)는 그대로.
//   node tools/tests/tts-ambient-skip.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const player = read('src/addons/tts/src/player.js');
const line = player.match(/\nconst ambientCovers = [^\n]+/);
assert.ok(line, 'ambientCovers');
const ambientCovers = new Function(`${line[0].slice(1)}\nreturn ambientCovers;`)();
const KEY = Symbol.for('blue-lemonade.ambient');
const FAKE = { version: 1, playing: () => ({ kind: 'rain', since: 0 }), get kinds() { return new Set(['rain', 'thunder']); }, covers: id => ['daily_rain', 'thunder'].includes(id), onChange: () => () => {} };
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('다리가 있으면: 빗소리가 도는 동안 daily_rain · thunder 는 건너뛰고(참) door_open 은 재생(거짓)', () => {
    const saved = globalThis[KEY];
    try {
        globalThis[KEY] = FAKE;
        assert.equal(ambientCovers('daily_rain'), true);
        assert.equal(ambientCovers('thunder'), true);
        assert.equal(ambientCovers('door_open'), false);
        assert.equal(ambientCovers('splash'), false, '한 번 소리는 대신하지 않는다');
    } finally { if (saved === undefined) delete globalThis[KEY]; else globalThis[KEY] = saved; }
});

t('다리가 없거나 · 옛 모양이거나 · 던지거나 · 참이 아닌 값을 주면 늘 거짓 (효과음은 전처럼)', () => {
    const saved = globalThis[KEY];
    try {
        delete globalThis[KEY];
        assert.equal(ambientCovers('daily_rain'), false);
        globalThis[KEY] = { version: 1 };
        assert.equal(ambientCovers('daily_rain'), false);
        globalThis[KEY] = { covers: () => { throw new Error('boom'); } };
        assert.equal(ambientCovers('daily_rain'), false);
        globalThis[KEY] = { covers: () => 'yes' };
        assert.equal(ambientCovers('daily_rain'), false, '=== true 만');
    } finally { if (saved === undefined) delete globalThis[KEY]; else globalThis[KEY] = saved; }
});

t('배선: 큐 돌리기의 효과음 건너뛰기 조건 · playSceneJob 의 재생 직전 — 두 곳뿐, 내보내기 길에는 없음 · CI', () => {
    assert.match(player, /if \(job\.sceneKind === 'sfx' && \(!isSfxEnabled\(job\.sfxId\) \|\| \(!job\.sceneManual && settings\(\)\.sfx\?\.enabled !== true\) \|\| ambientCovers\(job\.sfxId\)\)\) \{ idx\+\+; continue; \}/);
    assert.match(player, /if \(!isSfxEnabled\(job\.sfxId\) \|\| \(!job\.sceneManual && settings\(\)\.sfx\?\.enabled !== true\)\) return false;\s*\n\s*if \(ambientCovers\(job\.sfxId\)\) return false;/);
    assert.equal((player.match(/ambientCovers\(/g) || []).length, 2, '쓰는 곳 2');
    assert.equal((player.match(/const ambientCovers = /g) || []).length, 1, '정의 1');
    assert.equal((player.match(/blue-lemonade\.ambient/g) || []).length, 1);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/tts-ambient-skip\.mjs \./);
});

console.log(`tts-ambient-skip: ${n} passed, 0 failed`);
