// 버그 사냥 7 (6차 남김) — 번역 점검 팝오버(src/addons/translator/check-view.js)의 Esc 가 실리태번으로도 넘어갔어요
//   실리태번은 문서의 Esc 로 열린 서랍 · 작가 노트 · 떠 있는 창을 닫고, 답을 만드는 중이면 생성을 멈춰요(script.js · RossAscends-mods.js).
//   팝오버만 닫으려던 Esc 가 그 일까지 했어요. 이제 팝오버가 받은 Esc 는 거기서 멈춰요.
//   소스에서 Esc 처리 한 줄만 잘라 돌려요.  node tools/tests/translator-check-esc.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/translator/check-view.js'), 'utf8');
const line = src.split('\n').find(l => /const onKey = event => /.test(l));
assert.ok(line, 'Esc 처리 줄을 찾았어요');
let closed = 0, focused = 0;
const onKey = new Function('close', 'flag', `${line.trim()}\nreturn onKey;`)(() => { closed++; }, { focus() { focused++; } });
const ev = key => ({ key, stopped: 0, prevented: 0, stopPropagation() { this.stopped++; }, stopImmediatePropagation() { this.stopped++; }, preventDefault() { this.prevented++; } });
const esc = ev('Escape');
onKey(esc);
assert.equal(closed, 1, '팝오버가 닫혀요');
assert.equal(focused, 1, '초점은 표시로');
assert.ok(esc.stopped > 0, 'Esc 가 실리태번(서랍 닫기 · 생성 멈춤)으로 넘어가요');
assert.ok(esc.prevented > 0, '기본 동작도 막아요');
const other = ev('a');
onKey(other);
assert.equal(closed, 1); assert.equal(other.stopped, 0, '다른 키는 그대로');
console.log('translator-check-esc: 3 통과');
