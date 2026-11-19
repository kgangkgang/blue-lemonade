// 버그 사냥 7 사용자 환경 리그(폰 384 · 412 · 움직임 줄이기 · 깔린 판 그대로의 상태창 확장 · 사용자 설정 사본)에서 찾은 화면 고침의 소스 계약
//   ① 띠 아이콘으로 여는 탭 창(큰 창 표식 없음): 머리 제목 칸이 원작 ✕ 자리만큼 비어요
//   ② 손가락 화면: 창 안 판에서 가로 넘침을 잘라 창 본문에 숨은 가로 굴림이 안 생겨요(세로는 그대로)
//   ③ 생성 CSS(ext-status.gen.css)에도 같은 규칙이 있어요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0, bad = 0;
const test = (name, fn) => { try { fn(); n++; console.log('  PASS ', name); } catch (e) { bad++; console.log('  FAIL ', name, '\n       ', String(e.message).split('\n')[0]); } };
const css = read('src/ext-status.css'), gen = read('src/ext-status.gen.css');
const HEAD = 'dialog.popup.ss-dlg.ss-xclose:not(.large_dialogue_popup) .ss-head-t { padding-inline-end: calc(var(--bl-ui-icon, 34px) + var(--bl-s2, 8px)); }';
const ROOT = 'dialog.popup.ss-dlg .ss-root { overflow-x: clip; overflow-y: visible; }';

test('① 탭 창 머리 제목: ✕ 자리(34 + 8)만큼 비움 · 큰 창 규칙은 그대로', () => {
    assert.ok(css.includes('body.salty ' + HEAD));
    assert.ok(css.includes('body.salty dialog.popup.ss-dlg.large_dialogue_popup :is(.ss-head, .ss-wz-head) { padding-inline-end:'), '큰 창의 ✕ 자리 규칙');
});
test('② 창 안 판 가로 넘침 자르기는 손가락 화면 묶음 안에만 · 세로는 visible', () => {
    const at = css.indexOf('body.salty ' + ROOT);
    assert.ok(at > 0);
    const open = css.lastIndexOf('@media (pointer: coarse) {', at);
    assert.ok(open > 0 && !/\n}\n/.test(css.slice(open, at)), '손가락 화면 묶음 안');
});
test('③ 생성 CSS 에도 같은 규칙', () => {
    assert.ok(gen.includes(HEAD), '머리 제목');
    assert.ok(gen.includes(ROOT), '판 가로 자르기');
});
console.log(`hunt7-user-env: ${n} 통과 · ${bad} 실패`);
if (bad) process.exit(1);
