// 8.2.7 폰 예측점검(hunt-mobile): 나만의 에이드(src/custompalette.js)는 새 에이드 아이디를 crypto.randomUUID() 로 만들었어요.
// randomUUID 는 보안 컨텍스트 전용이라 http:// 로 연 폰(LAN 접속)에는 없어요 → 「지금 에이드 담기」 · 새 에이드 저장 · (보관함에 없는 지금 색이 있을 때)
// 다른 에이드 고르기가 TypeError(crypto.randomUUID is not a function)로 멈췄어요.
// 고친 뒤: randomUUID 가 없으면 시각 + 무작위 글자로 아이디를 만들어요(아이디는 문자열이면 돼요 — settings.js 정리 규칙).
//   node tools/tests/custompalette-http-id.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
// http 폰 흉내: crypto 는 있지만 randomUUID 는 없어요(getRandomValues 는 비보안에서도 있어요)
const real = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: a => real.getRandomValues(a) } });
const mod = await import(pathToFileURL(path.join(root, 'src/custompalette.js')));
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const fresh = () => ({ palette: 'salt', customPalettes: [], colorOverrides: {}, customName: '' });
test('http 폰: 「지금 에이드 담기」가 멈추지 않고 보관함에 담아요 (고치기 전: crypto.randomUUID is not a function)', () => {
    const s = fresh();
    mod.saveCurrentPalette(s);
    assert.equal(s.customPalettes.length, 1);
    assert.equal(typeof s.customPalettes[0].id, 'string');
    assert.ok(s.customPalettes[0].id.length >= 8);
    assert.equal(s.activeCustomPalette, s.customPalettes[0].id);
});
test('http 폰: 새 에이드 만들기 → 저장도 아이디가 생겨요 · 두 번 담으면 아이디가 달라요', () => {
    const s = fresh();
    mod.newCustomPalette(s, 'light');
    mod.saveCustomPalette(s);
    mod.saveCurrentPalette(s);
    const ids = s.customPalettes.map(p => p.id);
    assert.ok(ids.length >= 2);
    assert.equal(new Set(ids).size, ids.length);
});
test('src 에 맨 crypto.randomUUID() 부르기가 남지 않았어요', () => {
    const src = fs.readFileSync(path.join(root, 'src/custompalette.js'), 'utf8');
    assert.doesNotMatch(src, /(^|[^?.\w])crypto\.randomUUID\(\)/m);
});
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: real });
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/custompalette-http-id.mjs .'), 'release-check.yml 에 등록');
console.log(`나만의 에이드 http 아이디: ${pass}개 통과했어요.`);
