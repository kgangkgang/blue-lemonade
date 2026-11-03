// TTS 화면 글이 실제 동작과 맞아요: 읽기 방식 이름이 속마음을 뺀다고 말하고, 저장된 분석은 요술봉 재생성으로만 다시 받는다고 말해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] || '.');
const ui = fs.readFileSync(path.join(dir, 'src/addons/tts/src/ui.js'), 'utf8');
const settings = fs.readFileSync(path.join(dir, 'src/addons/tts/src/settings.js'), 'utf8');
const presets = /READ_PRESETS = \{([\s\S]*?)\n\};/.exec(settings)[1];
assert.match(presets, /no_action:[^\n]*thought: 'skip'/); assert.match(presets, /all:[^\n]*thought: 'skip'/);
assert.match(ui, /no_action: '\*행동\* · 속마음 빼고 전부'/, '이름이 동작대로');
assert.match(ui, /all: '속마음 빼고 전부'/, '이름이 동작대로');
console.log('PASS 읽기 방식 이름이 동작과 같아요');
assert.doesNotMatch(ui, /다음 읽기 때 다시 받아요/, '바꿔도 저장된 분석을 다시 받지 않아요');
assert.match(ui, /'sfx\.scene_chars'[\s\S]{0,700}요술봉 › 재생성/, '다시 받는 길을 적어요');
assert.doesNotMatch(ui, /글·주변 문맥·분석 설정이 달라지면 새로 분석해요/);
assert.match(ui, /글이 바뀌면 새로 분석해요[^<]*요술봉 › 재생성/);
console.log('PASS 저장된 분석을 다시 받는 조건이 동작과 같아요');
