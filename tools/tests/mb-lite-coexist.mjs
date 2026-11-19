// 1.9.0 같은 작가의 가벼운 판(Lite)을 본판 옆에 깔았을 때 — 테마가 「그 확장」을 찾는 두 곳이 가벼운 판을 본판으로 잡지 않아요.
//   ① src/ext-bridge-tr.js findBase: 폴더 이름 차례로 가벼운 판이 먼저 와도 본판 폴더를 돌려줘요(전엔 가벼운 판 주소 → 본판 모듈 import 실패 → 번역 메우기 · 속마음 번역 멈춤)
//   ② 가벼운 판만 있으면 빈 값(다른 구조라 본판 기능을 걸지 않아요) ③ 본판을 다른 폴더 이름으로 깔아도 설치 정보 이름으로 찾아요
//   ④ src/ext-bridge-core.js TARGET.skip: 가벼운 판의 설치 정보(이름 · 주소)는 건너뛰고 본판 것은 그대로
//   가짜 문서 · 가짜 fetch. 원작 코드는 싣지 않아요. 네트워크 없음.
//   node tools/tests/mb-lite-coexist.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
for (const k of ['MutationObserver', 'Node', 'NodeFilter']) globalThis[k] ??= class {};
const T = await import(pathToFileURL(path.join(root, 'src/ext-bridge-tr.js')).href);
const C = await import(pathToFileURL(path.join(root, 'src/ext-bridge-core.js')).href);
const BASE = 'http://127.0.0.1:8000/scripts/extensions/third-party';
const docOf = (...folders) => ({ querySelectorAll: () => folders.map(f => ({ src: `${BASE}/${f}/index.js` })) });
const MAIN = { display_name: '미트볼 상태창 (Meatball Stats)' }, LITE = { display_name: '미트볼 라이트 (Meatball Lite)' };
const withFetch = async (table, fn) => {
    const keep = globalThis.fetch; const asked = [];
    globalThis.fetch = async url => { const folder = /third-party\/([^/]+)\/manifest\.json/.exec(String(url))?.[1]; asked.push(folder); const m = table[folder]; return { ok: !!m, json: async () => m }; };
    try { return [await fn(), asked]; } finally { globalThis.fetch = keep; }
};
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

await test('① 가벼운 판이 먼저 와도 본판 폴더를 잡아요', async () => {
    const [url] = await withFetch({}, () => T.findBase(docOf('aaa-ext', 'meatball-lite', 'meatballstats', 'blue-lemonade')));
    assert.equal(url, `${BASE}/meatballstats/`);
});
await test('② 가벼운 판만 있으면 빈 값 — 설치 정보 이름으로도 잡지 않아요', async () => {
    const [url, asked] = await withFetch({ 'meatball-lite': LITE }, () => T.findBase(docOf('meatball-lite', 'blue-lemonade')));
    assert.equal(url, '');
    assert.ok(asked.includes('meatball-lite'));
});
await test('③ 본판을 다른 폴더 이름으로 깔았으면 설치 정보 이름으로 — 옆의 가벼운 판은 건너뛰어요', async () => {
    const [url] = await withFetch({ 'my-lite-copy': LITE, 'status-fork': MAIN }, () => T.findBase(docOf('my-lite-copy', 'status-fork')));
    assert.equal(url, `${BASE}/status-fork/`);
});
await test('본판만 있을 때는 예전 그대로', async () => {
    const [url, asked] = await withFetch({}, () => T.findBase(docOf('other', 'meatballstats')));
    assert.equal(url, `${BASE}/meatballstats/`);
    assert.equal(asked.length, 0);
});
await test('④ 다리의 대상 판별 말: 가벼운 판 설치 정보는 건너뛰고 본판은 그대로', () => {
    const text = m => [m.display_name, m.homePage, m.author].join(' ');
    const lite = text({ ...LITE, homePage: 'https://example.invalid/x/meatball-lite', author: 'Meatball' });
    const main = text({ ...MAIN, homePage: 'https://example.invalid/x/meatballstats', author: 'Meatball Stats' });
    assert.ok(C.TARGET.match.test(lite) && C.TARGET.skip.test(lite));
    assert.ok(C.TARGET.match.test(main) && !C.TARGET.skip.test(main));
    assert.ok(C.TARGET.skip.test('미트볼 라이트') && C.TARGET.skip.test('Meatball Lite') && !C.TARGET.skip.test('미트볼 상태창'));
});
console.log(`mb-lite-coexist: ${passed} passed, 0 failed`);
