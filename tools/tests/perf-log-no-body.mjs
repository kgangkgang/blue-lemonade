// 본문 보관 0 이면 상세가 「(빈 응답)」이 아니라 본문을 안 남겼다고 보여요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const src = read('src/addons/perf/capture.js');
assert.match(src, /if \(store\.keepBodies > 0\) \{[\s\S]{0,500}\} else entry\.stripped = true;/, '본문을 안 남긴 기록은 지운 기록과 같게 표시해요');
console.log('PASS 본문 보관 0 기록에 표시가 붙어요');
