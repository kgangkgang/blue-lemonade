// (11-03 성능 퇴행 재정비 L) 내장 스크립트는 숨은 iframe 없이 테마 창에서 돌아야 해요.
//   8.2.5 까지는 스크립트마다 숨은 iframe 을 만들었는데, 성능 관문의 계측이 그 iframe 안에도 들어가면 맨 위 창의 긴 작업 관찰자(PerformanceObserver longtask)가
//   그리기 프레임(rAF · 칠하기) 안 긴 작업을 하나도 못 세요 — 8.2.5 의 「토글 긴 작업 합 271ms · 스트리밍 긴 작업 0개」는 그래서 덜 센 값이었고,
//   iframe 을 걷은 1.0.0 이 같은 일을 하고도 「느려진 것」으로 보였어요(outputs/재정비-1103/L-성능-퇴행.md). 숨은 iframe 이 다시 생기면 그때부터 성능 비교가 또 어긋나요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const code = s => s.replace(/^\s*\/\/.*$/gm, '');   // 주석 줄은 빼고 봐요(옛 방식 설명이 남아 있어요)
const runtime = code(read('src/scripts/runtime.js'));
assert.doesNotMatch(runtime, /createElement\(\s*['"]iframe['"]\s*\)|<iframe/i, '내장 스크립트 실행기가 숨은 iframe 을 만들면 안 돼요 — 스크립트는 테마 창에서 보통 모듈로 돌아요(src/scripts/realm.js)');
assert.match(runtime, /createRealm\(/, '스크립트마다 창 대리(realm)를 줘요');
const realm = code(read('src/scripts/realm.js'));
assert.match(realm, /requestAnimationFrame\(fn\)\s*\{\s*const handle = host\.requestAnimationFrame\(/, '스크립트의 rAF 는 테마 창(host)의 rAF 예요 — 그리기 프레임 안 일이 맨 위 창 관찰자에 보여요');
assert.match(realm, /if \(SELF_KEYS\.has\(key\)\) return proxy;/, 'window.parent · top 은 대리 자신 — 스크립트가 창을 따로 만들 길이 없어요');
for (const file of fs.readdirSync(path.join(dir, 'src/scripts/plain')).filter(n => n.endsWith('.js'))) {
    assert.doesNotMatch(code(read('src/scripts/plain/' + file)), /createElement\(\s*['"]iframe['"]\s*\)/, `내장 스크립트 ${file} 가 iframe 을 만들면 안 돼요`);
}
console.log('PASS 내장 스크립트는 숨은 iframe 없이 테마 창에서 돌아요(성능 측정이 전부 보이게)');
