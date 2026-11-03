// 요청 기록 보관 칸을 비워도 값이 바뀌지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const src = read('src/addons/perf/panel.js');
assert.doesNotMatch(src, /Number\.parseInt\(event\.target\.value, 10\) \|\| 20/, '비우면 20 이 돼 바로 지워졌어요');
assert.match(src, /store\.maxEntries = keptNumber\(event\.target\.value, store\.maxEntries, 20, 5000\);/);
assert.match(src, /store\.keepBodies = keptNumber\(event\.target\.value, store\.keepBodies, 0, 500\);/);
const fn = /const keptNumber = [^\n]*\n/.exec(src)[0];
const keptNumber = new Function(`${fn};return keptNumber;`)();
assert.equal(keptNumber('', 500, 20, 5000), 500, '빈 칸이면 전 값');
assert.equal(keptNumber('7', 500, 20, 5000), 20, '범위 안으로');
assert.equal(keptNumber('9000', 500, 20, 5000), 5000);
assert.equal(keptNumber('0', 5, 0, 500), 0);
console.log('PASS 빈 칸이면 전 값을 지켜요');
