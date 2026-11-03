// 속마음 「속삭임」은 대사 태그 감정 스위치와 따로 먹어요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const src = read('src/addons/tts/src/player.js');
const start = src.indexOf('function emotionFor(seg, s) {');
const body = src.slice(start, src.indexOf('\n}\n', start) + 3);
const emotionFor = new Function('EMOTION_BY_TAG', `${body};return emotionFor;`)({ angry: 'angry' });
const thought = { kind: 'thought' };
assert.equal(emotionFor(thought, { emotion_from_tags: false, thought_emotion: 'whisper' }), 'whisper', '끔이어도 속삭임');
assert.equal(emotionFor(thought, { emotion_from_tags: true, thought_emotion: 'whisper' }), 'whisper');
assert.equal(emotionFor(thought, { emotion_from_tags: false, thought_emotion: 'auto' }), '');
assert.equal(emotionFor({ kind: 'dialogue', tags: ['angry'] }, { emotion_from_tags: false }), '', '대사 태그 감정은 스위치를 따라요');
assert.equal(emotionFor({ kind: 'dialogue', tags: ['angry'] }, { emotion_from_tags: true }), 'angry');
console.log('PASS 속마음 속삭임이 스위치와 따로 먹어요');
