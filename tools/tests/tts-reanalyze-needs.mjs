// TTS 요술봉 › 재생성(src/addons/tts/src/player.js reanalyze)의 「분석할 대사가 없어요」 판정이 자동 분석과 같은지.
//   자동 분석은 감정 · 원어 · 효과음 · 화자 찾기 · 기울임 중 하나라도 필요하면 돌아요. 1.5.8 까지 재생성은 앞의 셋만 봐서,
//   화자 찾기 · 기울임만 필요한 답장(색 없는 대사만 있는 답장 · 감정을 안 받는 엔진)에서는 다시 분석할 길이 없었어요.
//   세 곳의 실제 조건 줄을 떼어 같은 입력에 같은 답을 내는지 봐요.
//   node tools/tests/tts-reanalyze-needs.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const lines = fs.readFileSync(path.join(root, 'src/addons/tts/src/player.js'), 'utf8').split('\n');
const cond = line => { const m = /if \((!need\.[^)]*?)\) (?:return|\{ toast)/.exec(line); assert.ok(m, '조건을 못 읽었어요: ' + line.trim().slice(0, 80)); return new Function('need', `return (${m[1]});`); };
const auto = lines.filter(l => /^\s*if \(!need\./.test(l) && /return (false|null);/.test(l) && l.includes('need.emotion') && !l.includes('toast('));
assert.equal(auto.length, 2, '자동 분석 쪽 판정 두 줄(analyzeIfNeeded · runAnalysis)');
const manual = lines.find(l => l.includes("toast('분석할 대사가 없어요', 'info'); return false;"));
assert.ok(manual, '재생성 쪽 판정 줄');
const nothing = [...auto.map(cond), cond(manual)];
const need = over => ({ emotion: false, langs: new Set(), sfx: false, speaker: false, italics: false, ...over });
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
test('아무것도 필요 없으면 셋 다 「없음」', () => { for (const f of nothing) assert.equal(f(need()), true); });
for (const [label, over] of [['화자 찾기만', { speaker: true }], ['기울임만', { italics: true }], ['감정만', { emotion: true }], ['원어만', { langs: new Set(['ja']) }], ['효과음만', { sfx: true }]]) {
    test(`${label} 필요해도 재생성이 돌아요(자동 분석과 같은 답)`, () => { for (const f of nothing) assert.equal(f(need(over)), false); });
}
console.log(`tts-reanalyze-needs: ${passed} passed`);
