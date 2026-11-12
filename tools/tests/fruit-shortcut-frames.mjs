// 8.2.2 과일 계열 1.5초 타이머는 iframe 을 살아 있는 목록으로 찾아요 — #chat 전체를 매번 querySelectorAll 로 훑지 않게
// 1.1.4 그 서명 계산은 src/frame-poll.js 한 곳으로 모였어요(세 모듈이 타이머 하나 · 박자마다 계산 한 번) — 살아 있는 목록 규칙은 그 파일에서 지켜요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/frame-poll.js'), 'utf8');
const sig = src.slice(src.indexOf('const walkSig ='), src.indexOf('const subs ='));
assert.match(src, /const framesOf = scope => \{ if \(typeof scope\.getElementsByTagName !== 'function'\) return scope\.querySelectorAll\('iframe'\); let list = frameLists\.get\(scope\); if \(!list\) \{ list = scope\.getElementsByTagName\('iframe'\); frameLists\.set\(scope, list\); \} return list; \};/, 'live iframe list per scope, cached');
assert.match(sig, /for \(const f of framesOf\(scope\)\)/, 'frameSig walks the live list');
assert.doesNotMatch(sig, /querySelectorAll\((?!'#chat'\))/, 'frameSig never rescans the chat with querySelectorAll');
assert.match(src, /const frameLists = new WeakMap\(\)/, 'lists are dropped with their scope (a replaced #chat gets a new list)');
assert.match(src, /const allLists = new WeakMap\(\)/, 'element counts use a live list per iframe document');
for (const file of ['src/fruit-type-shortcuts.js', 'src/fruit-type-runtime.js', 'src/scripts/fruit-status.js']) {
    const s = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(s, /const poll=framePoll\(doc,host\),frameSig=poll\.sig;/, file + ' uses the shared frame poll');
    assert.match(s, /poll\.every\(/, file + ' subscribes to the shared 1.5 s beat');
    assert.doesNotMatch(s, /host\.setInterval\(/, file + ' no longer owns a polling timer');
    assert.doesNotMatch(s, /getElementsByTagName\('iframe'\)|const frameSig=\(/, file + ' no private copy of the signature walk');
}
console.log('PASS fruit shortcut · status text · status Korean share one frame poll that finds iframes through a cached live list');
