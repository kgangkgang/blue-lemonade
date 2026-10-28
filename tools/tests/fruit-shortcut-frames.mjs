// 8.2.2 상태창 바로가기(fruit-type-shortcuts) 1.5초 타이머는 iframe 을 살아 있는 목록으로 찾아요 — #chat 전체를 매번 querySelectorAll 로 훑지 않게
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/fruit-type-shortcuts.js'), 'utf8');
const sig = src.slice(src.indexOf('const frameSig='), src.indexOf('const schedule='));
assert.match(src, /const framesOf=scope=>\{if\(typeof scope\.getElementsByTagName!=='function'\)return scope\.querySelectorAll\('iframe'\);let list=frameLists\.get\(scope\);if\(!list\)\{list=scope\.getElementsByTagName\('iframe'\);frameLists\.set\(scope,list\);\}return list;\};/, 'live iframe list per scope, cached');
assert.match(sig, /for\(const f of framesOf\(scope\)\)/, 'frameSig walks the live list');
assert.doesNotMatch(sig, /querySelectorAll\('iframe'\)/, 'frameSig never rescans the chat with querySelectorAll');
assert.match(src, /const frameLists=new WeakMap\(\)/, 'lists are dropped with their scope (a replaced #chat gets a new list)');
console.log('PASS fruit shortcut timer finds iframes through a cached live list');
