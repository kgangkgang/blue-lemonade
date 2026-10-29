// 8.2.7 폰 예측점검(hunt-mobile): 캐릭터 에셋 「그림 줄이기」(src/addons/assets/shrink.js)는 파일 해시를 crypto.subtle.digest 로만 셌어요.
// crypto.subtle 은 보안 컨텍스트 전용이라 http:// 로 연 폰(LAN 접속)에는 없어요 → WebP 로 바꾼 뒤 올리기 전에 해시에서 TypeError — 모든 그림이 「실패」,
// 미리 세기에서도 이미 WebP 인 그림은 「실패」로 셌어요.
// 고친 뒤: subtle 이 없으면 템플릿 애드온의 순수 JS SHA-256(src/addons/prompt-template/sha256.js — 같은 16진 값)으로 세요.
//   node tools/tests/assets-shrink-http-hash.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/assets/shrink.js'), 'utf8');
const { sha256Hex } = await import(pathToFileURL(path.join(root, 'src/addons/prompt-template/sha256.js')));
const m = src.match(/\nasync function digest\(bytes\)\{[^\n]*\}\n/);
assert.ok(m, 'digest 함수');
let pass = 0; const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const bytes = new TextEncoder().encode('블루 레몬에이드 그림 '.repeat(500)).buffer;
const want = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const make = crypto => new Function('crypto', 'globalThis', 'sha256Hex', `${m[0]}\nreturn digest;`)(crypto, { crypto }, sha256Hex);
await test('http 폰(crypto.subtle 없음): 해시를 순수 JS 로 세어 같은 값이 나와요 (고치기 전: TypeError)', async () => {
    assert.equal(await make({ getRandomValues() {} })(bytes), want);
    assert.equal(await make(undefined)(bytes), want);
});
await test('https · localhost(crypto.subtle 있음): 지금처럼 subtle 로 · 같은 값', async () => {
    let used = 0;
    const subtle = { digest: async (alg, data) => { used++; assert.equal(alg, 'SHA-256'); return createHash('sha256').update(Buffer.from(data)).digest().buffer; } };
    assert.equal(await make({ subtle })(bytes), want);
    assert.equal(used, 1);
});
await test('shrink.js 가 순수 JS SHA-256 을 가져와요', () => {
    assert.match(src, /import \{ sha256Hex \} from '\.\.\/prompt-template\/sha256\.js';/);
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/assets-shrink-http-hash.mjs .'), 'release-check.yml 에 등록');
console.log(`그림 줄이기 http 해시: ${pass}개 통과했어요.`);
