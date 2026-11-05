// 로그 복사 즐겨찾기가 모양 수(63개 — 1.0.1 컨셉 30종 포함)보다 작은 상한에 잘리지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const src = read('src/settings.js');
assert.match(src, /fav: ids\(v\.fav, 96\)/, '즐겨찾기 상한은 모양 수 위로');
assert.match(src, /const ids = \(list, max = 24\) =>/);
console.log('PASS 즐겨찾기가 안 잘려요');
