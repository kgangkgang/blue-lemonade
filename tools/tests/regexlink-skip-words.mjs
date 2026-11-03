// 정규식 연동 요약이 건너뛴 까닭을 맞게 말해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const src = read('src/addons/regexlink/index.js');
assert.doesNotMatch(src, /개는 태그가 없어 그대로/);
assert.match(src, /개는 태그나 짝 프롬프트가 없어 그대로/);
console.log('PASS 요약 글이 실제와 같아요');
