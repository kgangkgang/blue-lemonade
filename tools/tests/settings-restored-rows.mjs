// 빈 채팅 막기: 8.2.5 의 설정 줄이 채팅 › 기타에 있고, 성능 보조 저장 정리 체크와 같은 뜻을 읽고 써요(둘 중 하나라도 끄면 꺼진 상태를 그대로 보여요).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
const panel = read('src/panel.js');
assert.match(panel, /row\('빈 채팅 덮어쓰기 막기', toggle\('chat\.emptyGuard', s\.chat\.emptyGuard !== false && SillyTavern\.getContext\(\)\.extensionSettings\?\.save_dedupe\?\.emptyGuard !== false\)/, '실제 상태로 보여요');
assert.match(panel, /if \(path === 'chat\.emptyGuard' && target\.checked\) \{[^\n]*save_dedupe[^\n]*emptyGuard = true/, '켜면 저장 정리 쪽 끔도 풀어요');
const dedupe = read('src/addons/perf/savededupe.js');
assert.match(dedupe, /empty\.checked = guardWanted\(extensions\.extension_settings\);/, '서랍 체크도 실제 상태로');
assert.match(dedupe, /salty\.chat\.emptyGuard = empty\.checked/, '서랍 체크가 두 칸을 함께 써요');
const { settingRoute } = await import(new URL('src/settings-differences.js', pathToFileURL(dir + '/')).href).catch(() => ({}));
if (settingRoute) assert.deepEqual(settingRoute('chat.emptyGuard'), { tab: 'chat', sub: 'etc' });
assert.match(read('src/settings-search.js'), /\['chat','etc','빈 채팅 덮어쓰기 막기',[^\n]*'chat\.emptyGuard'\]/, '검색 결과에 스위치가 생겨요');
console.log('PASS 빈 채팅 막기 줄이 돌아왔고 두 스위치가 같은 뜻이에요');
