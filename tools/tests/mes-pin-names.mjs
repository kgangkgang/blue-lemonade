// 1.0.0 후보: 「메시지 버튼」 고르기 — 고정해 둔 단추가 지금 채팅에서 안 잡혀도 열쇠 이름(mes_legacy_translate) · ? 아이콘이 아니라 사람이 읽는 이름 · 아이콘
//   node tools/tests/mes-pin-names.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const K = await import(pathToFileURL(path.join(root, 'src/mes-pins-keys.js')).href);
const free = new Set(read('tools/fa-free-6.5.2.txt').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));

await test('번역 단추 여섯 · 읽기 · 소리 대본 · 대사만 보기는 이름 · 아이콘 표에 있어요 (번역 애드온 단추 정의와 같은 이름)', () => {
    const tr = read('src/addons/translator/index.js');
    for (const [, cls, title] of tr.matchAll(/\['(mes_\w+) fa-solid fa-[\w-]+', '([^']+)', 'hide_\w+'\]/g)) assert.equal(K.KNOWN_PINS[cls]?.[1], title, cls);
    for (const key of ['mes_legacy_translate', 'mes_toggle_original', 'lv_play', 'lv_script', 'mes_dialogue_only']) {
        const [icon, title] = K.KNOWN_PINS[key] || [];
        assert.ok(title && !/^[\w-]+$/.test(title), key + ' 이름');
        assert.match(icon, /^fa-solid fa-[\w-]+$/);
        assert.ok(free.has(icon.split(' ')[1].slice(3)), icon + ' 무료 아이콘');
    }
});

await test('고르기 목록: 안 잡힌 고정 단추도 열쇠 이름 · 물음표 아이콘을 쓰지 않아요', () => {
    const panel = read('src/panel.js'), pins = read('src/mes-pins.js');
    assert.match(panel, /\.map\(pinLabel\)/);
    assert.doesNotMatch(panel, /fa-circle-question', title: key/);
    assert.doesNotMatch(pins, /\|\| key\)\.trim\(\)/, '이름 없는 단추에 열쇠 이름을 쓰지 않음');
    assert.match(pins, /export function pinLabel\(key\)/);
    assert.match(pins, /'다른 확장 단추'/);
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/mes-pin-names\.mjs \./);
});
console.log(`mes-pin-names: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
