// 1.0.x 솔라 화면의 빠른 설정 바로 가기 — 솔라 빠른 설정은 데우스 화면의 「빠른 설정」 스위치(deus-qr) 하나로 켜요.
//   ① 솔라 화면 맨 위(제목 바로 아래)에 데우스 화면으로 가는 줄이 있고, 같은 스위치를 두 번 그리지 않아요(설정 중복 0)
//   ② 솔라 화면에도 상태창 글자 편집기가 묶여요(스위치 묶음이 없는 화면에서도)
//   ③ 설정 검색 「솔라 빠른 설정」이 솔라 화면의 그 줄로 가요
//   node tools/tests/sola-quick-shortcut.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const panel = read('src/panel.js'), tools = read('src/prompt-tools.js');
let passed = 0;
async function test(name, fn) { await fn(); console.log('PASS', name); passed++; }

await test('① 솔라 화면 맨 위에 데우스 화면으로 가는 줄 — 스위치는 데우스 화면 하나뿐', () => {
    assert.match(panel, /if\(sub==='sola'\)return `\$\{cap\('솔라'\)\}\$\{solaQuickShortcutMarkup\(\)\}/, '제목 바로 아래 첫 줄');
    const fn = tools.match(/export function solaQuickShortcutMarkup\(\)\{[\s\S]*?\n\}/)?.[0];
    assert.ok(fn, 'solaQuickShortcutMarkup');
    assert.match(fn, /data-act="editor-route" data-tab="prompt" data-sub="deus"/, '공용 화면 이동(editor-route)으로 데우스 화면에');
    assert.match(fn, /data-search-anchor="솔라 빠른 설정"/);
    assert.match(fn, /class="bl-prompt-tools"/, '프롬프트 도구 줄과 같은 공용 모양');
    assert.ok(!/data-prompt-script|data-prompt-tools=|salty-switch/.test(fn), '같은 deus-qr 스위치를 솔라 화면에 또 그리지 않아요');
    assert.equal((tools.match(/\['deus-qr','빠른 설정'/g) || []).length, 1, 'deus-qr 스위치 줄은 데우스 묶음 하나');
});
await test('② 스위치 묶음이 없는 화면(솔라)에서도 상태창 글자 편집기를 묶어요', () => {
    const body = tools.match(/export function bindPromptTools\(root\)\{([\s\S]*?)\n\}/)?.[1] || '';
    const bindAt = body.indexOf('bindFruitTypography(root)'), boxAt = body.indexOf("root.querySelector('[data-prompt-tools]')");
    assert.ok(bindAt >= 0 && boxAt > bindAt, '편집기를 먼저 묶어요');
    assert.match(body, /if\(!box\)return stopTypography;/, '스위치 묶음이 없으면 편집기 풀기만 돌려줘요');
});
await test('③ 검색 「솔라 빠른 설정」 → 프롬프트 › 솔라의 바로 가기 줄', async () => {
    globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
    const S = await import(pathToFileURL(path.join(root, 'src/settings-search.js')).href);
    const hit = S.searchSettings('솔라 빠른 설정')[0];
    assert.deepEqual([hit?.tab, hit?.sub, hit?.title, hit?.anchor], ['prompt', 'sola', '솔라 빠른 설정', '솔라 빠른 설정']);
    assert.equal(S.searchSettings('솔라 빠른')[0]?.title, '솔라 빠른 설정');
});
console.log(`솔라 빠른 설정 바로 가기 검사를 통과했어요(${passed}개).`);
