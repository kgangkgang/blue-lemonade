// 프롬프트 캐시를 끄면 검열 대체 요청도 꺼요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
const src = read('src/addons/tts/src/block-fallback.js');
assert.match(src, /export function fallbackCfg[\s\S]{0,400}prompt_cache: c\.prompt_cache,/, '대체 요청 설정에 값을 넘겨요');
console.log('PASS 프롬프트 캐시 값이 대체 요청으로 넘어가요');
