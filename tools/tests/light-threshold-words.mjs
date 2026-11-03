// 가볍게 스위치 설명이 실제 기준(60개 · 80개부터)과 같아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const panel = read('src/panel.js');
assert.doesNotMatch(panel, /60개 넘게|80개 넘게/);
assert.match(panel, /메시지가 60개 이상 그려져 있으면/);
assert.match(panel, /항목이 80개 이상 보이면/);
console.log('PASS 기준 문구가 실제와 같아요');
