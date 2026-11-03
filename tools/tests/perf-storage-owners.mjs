// 저장 공간 창이 테마의 DB 를 테마 것으로 나눠요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
globalThis.indexedDB ??= {};
const { dbInfo } = await load('src/addons/perf/storage/core.js');
for (const name of ['BlueLemonadeUsage', 'BlueLemonadePromptCacheLocal', 'PTTranslationDB_PLUS']) assert.equal(dbInfo(name).owner, 'blue-lemonade', name);
assert.equal(dbInfo('SillyTavern_x').owner, 'sillytavern');
assert.equal(dbInfo('무언가').owner, 'sillytavern');
console.log('PASS 테마 DB 주인이 맞아요');
