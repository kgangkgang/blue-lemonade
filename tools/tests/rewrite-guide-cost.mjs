// 다시 쓰기 도움말이 실제로 보내는 양을 말해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const src = read('src/addons/rewrite/guide.js');
assert.doesNotMatch(src, /보내는 건 걸린 문장 \+ 짧은 안내문/);
assert.match(src, /보내는 건 답변 전체 \+ 짧은 안내문이라 고칠 때마다 답변 하나 길이만큼 입력 토큰을 써요/);
console.log('PASS 비용 설명이 실제와 같아요');
