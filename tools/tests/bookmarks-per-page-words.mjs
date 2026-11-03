// 북마크 한 페이지 설명이 그림만 보기의 실제 장수를 말해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(dir, rel)).href);
assert.match(read('src/addons/bookmarks/panel.js'), /Math\.max\(24, settings\(\)\.itemsPerPage \* 2\)/);
assert.match(read('src/addons/bookmarks/settings-view.js'), /1~50개\. 그림만 보기는 이 값의 2배\(최소 24장\)씩 보여요\./);
console.log('PASS 설명이 실제와 같아요');
