// 7.5.3 테마 업데이트 확인: 서버가 설치 상태를 못 돌려주면(폰 · ZIP 으로 깐 폴더) GitHub 릴리스로 새 판만 확인 · 취소 단추 · 확인 대기 20초.
//   src/theme-update.js 는 실리태번 모듈(notice.js → extensions.js)을 정적으로 끌어와 여기서는 배선만 글로 확인한다.
//   node tools/tests/theme-update-753.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const src = read('src/theme-update.js');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

test('확인 요청은 20초 · 업데이트는 60초, 취소 signal 을 함께 건다', () => {
    assert.match(src, /timeout=action==='version'\?20000:60000,signal=null\}=\{\}\)/);
    assert.match(src, /AbortSignal\.timeout\(timeout\),\.\.\.\(signal\?\[signal\]:\[\]\)/);
    assert.match(src, /typeof AbortSignal\.any==='function'\?AbortSignal\.any\(signals\):signals\[0\]/);
});
test('취소 단추: 진행 중에만 보이고 누르면 요청을 끊는다 · 끊으면 「확인을 취소했어요」', () => {
    assert.match(src, /<button type="button" class="salty-btn" data-theme-cancel hidden>취소<\/button>/);
    assert.match(src, /cancel=root\.querySelector\('\[data-theme-cancel\]'\);[^\n]*if\(cancel\)cancel\.hidden=!state\.busy;/);
    assert.match(src, /state\.controller=typeof AbortController==='function'\?new AbortController\(\):null;/);
    assert.match(src, /signal:state\.controller\?\.signal\|\|null/);
    assert.match(src, /cancelBtn\.onclick=\(\)=>\{state\.controller\?\.abort\(\);\};/);
    assert.match(src, /error\.name==='AbortError'\?'확인을 취소했어요\.'/);
    assert.match(src, /finally\{state\.busy=false;state\.controller=null;paint\(\);\}/);
});
test('서버가 설치 상태를 못 돌려주면 GitHub 릴리스로 새 판만 확인하고, 그것도 안 되면 원래 오류 문구', () => {
    assert.match(src, /if\(action==='version'&&error\.name!=='AbortError'\)\{try\{const m=await import\('\.\/update-check\.js'\);await m\.checkForUpdate\(\{force:true\}\);/);
    assert.match(src, /state\.stage='zipupdate';state\.message=`이 기기의 실리태번이 설치 상태를 돌려주지 못했어요/);
    assert.match(src, /state\.stage='current';state\.message='이 기기의 실리태번이 설치 상태를 돌려주지 못했지만/);
    assert.match(src, /업데이트 서버 요청이 실패했어요\. 이 기기의 실리태번이 git 을 쓸 수 없는 설치/);
});
test('CI 등록', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/theme-update-753\.mjs \./);
});
console.log(`theme-update-753: ${passed} passed, 0 failed`);
