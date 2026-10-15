// 6.7.1 진단 복사(글): 최근 오류 · 번역 중단 이유를 짧게 붙인다 (댓글에 파일을 못 붙이는 제보용).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
globalThis.window ??= { addEventListener() {} };
globalThis.location ??= { origin: 'http://127.0.0.1:8000' };
const { compactErrors, localStamp } = await import(new URL('src/diag-errors.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const list = Array.from({ length: 9 }, (_, i) => ({ at: `2026-10-15T14:1${i}:00.000Z`, level: 'warn', text: `[Blue Lemonade · LLM 번역] 번역 중단 이유 #${i} auto {"what":"edited","by":["events.js","Some Helper"]}` }));
check('last six, newest kept, prefix shortened', () => {
    const lines = compactErrors(list);
    assert.equal(lines.length, 6);
    assert.equal(lines[5], `- ${localStamp('2026-10-15T14:18:00.000Z', true).slice(11)} warn 번역 중단 #8 auto {"what":"edited","by":["events.js","Some Helper"]}`);
    assert(!lines.join('\n').includes('번역 중단 #2 '));
});
check('long lines cut, newlines folded', () => {
    const [line] = compactErrors([{ at: '2026-10-15T00:00:00Z', level: 'error', text: 'Blue Lemonade x\n' + 'y'.repeat(400) }]);
    assert(line.length < 250); assert(!line.includes('\n')); assert(line.endsWith('…'));
});
check('empty', () => assert.deepEqual(compactErrors([]), []));
check('local time, not UTC', () => {
    const d = new Date(2026, 9, 16, 0, 4, 7);
    assert.equal(localStamp(d), '2026-10-16 00:04');
    assert.equal(localStamp(d, true), '2026-10-16 00:04:07');
    assert.equal(localStamp('nope'), '');
});
check('wiring: diagnose.js appends recent errors', () => {
    const src = fs.readFileSync(new URL('src/diagnose.js', root), 'utf8');
    assert(src.includes("import { compactErrors, localStamp } from './diag-errors.js';"));
    assert(src.includes('${localStamp()} (UTC'));
    assert(src.includes("lines.push(errors.length ? `최근 오류 ${errors.length}개:"));
});
console.log(`diag-copy: ${passed} passed, 0 failed`);
