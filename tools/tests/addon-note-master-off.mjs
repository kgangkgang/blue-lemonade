// 7.2.4 확장 탭 안내 문구: 「블루레몬에이드 사용」 스위치가 꺼진 때와 사용 모드가 「테마만」인 때를 나눠 말한다 (제보 10-19)
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const src=readFileSync(path.resolve(process.argv[2]||'.','src/panel.js'),'utf8');
const fn=src.slice(src.indexOf('function tabExtensions('),src.indexOf('function tabExtensions(')+900);
assert.ok(fn.includes("s.enabled===false ? '<p class=\"salty-note\">「블루레몬에이드 사용」 스위치가 꺼져 있어서"),'스위치 꺼짐 안내');
assert.ok(fn.includes('이 창 맨 아래의 「블루레몬에이드 사용」을 켜면'),'어디서 켜는지');
assert.ok(fn.includes('사용 모드가 「테마만」이라 내장 확장을 실행하지 않아요'),'테마만 안내');
assert.ok(fn.includes('「테마 + 확장」이나 「확장만」을 고르면'),'모드 이름 그대로');
assert.ok(!src.includes('현재 사용 모드에서는 내장 확장을 실행하지 않아요'),'옛 뭉뚱그린 문구 없음');
console.log('PASS addon tab note: master switch off vs theme-only mode');
