// 8.2.7 TTS 설정 화면(카드 · 목소리 표 · 엔진 · 데이터 탭)은 처음 보일 때 그려요 — 닫힌 확장 서랍 안에 부팅마다 전부 그리던 것 (perf-addons).
//   보이는 길 두 가지에서 한 번만: 서랍 머리를 누를 때(잡기 단계 — ui 의 펼침 처리가 같은 클릭에서 돌게) · 창 · 설정 안 칸에 붙일 때(prepareEmbedded).
//   서랍 머리의 판 표시는 부팅 때 그대로 적어요. ui 의 바깥 진입점(refreshChat · ensureFresh · renderColors)은 그리기 전엔 아무 일도 안 해요.
//   node tools/tests/tts-ui-lazy.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/tts/index.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/addons/tts/src/ui.js'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };
const readyAt = src.indexOf('export const ready = new Promise(');
const ready = src.slice(readyAt);

check('부팅(ready)에서 설정 화면을 바로 그리지 않아요', () => {
    assert.ok(readyAt > 0);
    assert.doesNotMatch(ready, /\bui\.init\(\)/, 'ready 안에서 ui.init() 을 바로 불러요');
});
check('처음 보일 때 한 번만 그려요 (ensureUi)', () => {
    const m = src.match(/function ensureUi\(\) \{([\s\S]*?)\n\}/);
    assert.ok(m, 'ensureUi 가 없어요');
    assert.match(m[1], /if \(uiStarted \|\| !root\) return;/);
    assert.match(m[1], /uiStarted = true;[\s\S]*ui\.init\(\)/);
    const prep = src.match(/function prepareEmbedded\(\) \{([\s\S]*?)\n\}/);
    assert.ok(prep && /^\s*ensureUi\(\);/.test(prep[1]), '창 · 설정 안 칸에 붙일 때 먼저 그려요');
    assert.match(ready, /root\.addEventListener\('click', event => \{ if \(event\.target\?\.closest\?\.\('\.inline-drawer-toggle'\)\) ensureUi\(\); \}, true\);/, '서랍 머리 클릭(잡기 단계)');
});
check('서랍 머리의 판 표시는 부팅 때 적어요', () => {
    assert.match(ready, /for \(const el of root\.querySelectorAll\('\.lv-version'\)\) el\.textContent = `v\$\{VERSION\}`;/);
});
check('ui 바깥 진입점은 그리기 전(root 없음)엔 아무 일도 하지 않아요', () => {
    assert.match(ui, /export function refreshChat\(\) \{\n\s*if \(!root\) return;/);
    assert.match(ui, /export function ensureFresh\(\) \{\n\s*if \(!root \|\| !chatDirty\) return false;/);
    assert.match(ui, /function replaceCard\(name, html\) \{\n\s*const old = q\(/);
    assert.match(ui, /const q = \(sel, el = root \|\| document\) =>/);
});
check('ui 의 펼침 처리는 서랍 머리(.inline-drawer-toggle)에 걸려 같은 클릭에서 돌아요', () => {
    // 잡기 단계(root)에서 init 이 서랍 머리에 단 거품 단계 리스너는 그 클릭이 서랍 머리에 닿을 때 목록을 읽으므로 이번 클릭에도 불려요
    assert.match(ui, /document\.querySelector\('#lv_settings \.inline-drawer-toggle'\)\?\.addEventListener\('click', \(\) => \{/);
});
console.log(`tts-ui-lazy: ${passed}개 통과`);
