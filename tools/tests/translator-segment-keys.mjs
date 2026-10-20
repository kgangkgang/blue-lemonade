// 번역기 3.0.1 문단 캐시 열쇠와 자리표시자 번호: 보호 글([[__VAR_n__]])의 번호는 메시지 전체에서 매겨져, 앞 문단의 색 span · 그림 자리를 하나 지우면
//   뒤 문단의 번호가 모두 밀려 열쇠가 바뀌고 전부 다시 번역됐다(사용자 제보: 대사 한 문단 지웠는데 캐시 없이 재번역). 이제 열쇠는 문단 안 차례로 고쳐 쓴 글 +
//   그 자리의 보호 글이고, 저장 · 꺼내기 때 번호를 오간다. 자리표시자 없는 문단은 예전 열쇠 그대로. 가짜 모델 · 메모리 캐시만 · 지어낸 글.
//   node tools/tests/translator-segment-keys.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const seg = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-segments.js')));
const { translateSegments, clearSegmentCache, localizePlaceholders, restorePlaceholders, segmentCacheKey, forgetSegments } = seg;
const { checkpointKey } = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-resume.js')));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const parts = bodies => bodies.flatMap((b, i) => (i ? ['\n\n', b] : [b]));
const sig = () => 'synthetic';
const ko = body => body.replace('Greeting', '인사').replace('Second paragraph.', '둘째 문단.').replace('third', '셋째').replace('Fourth', '넷째');

await test('자리표시자 번호를 문단 안 차례로 고쳐 쓰고 되돌린다', () => {
    const { norm, map } = localizePlaceholders('[[__VAR_4__]] third [[__VAR_7__]] and [[__VAR_4__]]');
    assert.equal(norm, '[[__VAR_0__]] third [[__VAR_1__]] and [[__VAR_0__]]'); assert.deepEqual(map, [4, 7]);
    assert.equal(restorePlaceholders('[[__VAR_1__]] 셋째 [[__VAR_0__]]', map), '[[__VAR_7__]] 셋째 [[__VAR_4__]]');
    assert.deepEqual(localizePlaceholders('plain'), { norm: 'plain', map: [] });
});

await test('자리표시자 없는 문단의 열쇠는 예전(paragraph-v2) 그대로 — 쌓인 캐시가 산다', async () => {
    const { key, map } = await segmentCacheKey(sig, 'Second paragraph.');
    assert.equal(key, await checkpointKey(JSON.stringify(['paragraph-v2', 'synthetic', 'Second paragraph.']))); assert.deepEqual(map, []);
});

await test('앞 문단(색 span 대사)을 지워 뒤 문단의 번호가 밀려도 뒤 문단은 캐시에서 — 요청 없이, 번호는 지금 것으로', async () => {
    await clearSegmentCache();
    const prot1 = ['<span style="color:#111">', '<span style="color:#222">', '</span>', '<span class="bl-asset-slot"></span>'];
    const bodies1 = ['[[__VAR_0__]]Greeting', 'Second paragraph.', '[[__VAR_1__]] third [[__VAR_2__]]', 'Fourth [[__VAR_3__]]'];
    let asked = [];
    const first = await translateSegments({ parts: parts(bodies1), signature: sig, protection: n => prot1[n], request: async bodies => { asked.push(...bodies); return bodies.map(ko); } });
    assert.equal(first.translated, 4); assert.equal(first.reused, 0);
    assert.equal(first.text, '[[__VAR_0__]]인사\n\n둘째 문단.\n\n[[__VAR_1__]] 셋째 [[__VAR_2__]]\n\n넷째 [[__VAR_3__]]');
    // 첫 문단을 지움 → 보호 글이 하나 줄어 뒤 문단의 번호가 하나씩 앞으로
    const prot2 = ['<span style="color:#222">', '</span>', '<span class="bl-asset-slot"></span>'];
    const bodies2 = ['Second paragraph.', '[[__VAR_0__]] third [[__VAR_1__]]', 'Fourth [[__VAR_2__]]'];
    asked = [];
    const second = await translateSegments({ parts: parts(bodies2), signature: sig, protection: n => prot2[n], request: async bodies => { asked.push(...bodies); return bodies.map(ko); } });
    assert.deepEqual(asked, [], '요청 없음');
    assert.equal(second.reused, 3); assert.equal(second.translated, 0);
    assert.equal(second.text, '둘째 문단.\n\n[[__VAR_0__]] 셋째 [[__VAR_1__]]\n\n넷째 [[__VAR_2__]]', '저장된 번역의 번호가 지금 번호로');
});

await test('같은 글 모양이어도 자리에 든 보호 글이 다르면 다른 열쇠 — 다른 색 · 다른 그림의 번역을 빌리지 않는다', async () => {
    const prot3 = ['<span style="color:#999">', '</span>'];
    let asked = [];
    const r = await translateSegments({ parts: ['[[__VAR_0__]] third [[__VAR_1__]]'], signature: sig, protection: n => prot3[n], request: async bodies => { asked.push(...bodies); return bodies.map(ko); } });
    assert.deepEqual(asked, ['[[__VAR_0__]] third [[__VAR_1__]]']); assert.equal(r.reused, 0); assert.equal(r.translated, 1);
});

await test('번역문 지우기(forgetSegments)도 같은 열쇠로 지운다 — 지운 뒤에는 다시 요청', async () => {
    const prot = ['<span style="color:#222">', '</span>'];
    const body = '[[__VAR_5__]] third [[__VAR_6__]]';   // 번호가 달라도 같은 문단 · 같은 보호 글
    let asked = [];
    const hit = await translateSegments({ parts: [body], signature: sig, protection: n => prot[n - 5], request: async bodies => { asked.push(...bodies); return bodies.map(ko); } });
    assert.equal(hit.reused, 1); assert.equal(hit.text, '[[__VAR_5__]] 셋째 [[__VAR_6__]]'); assert.deepEqual(asked, []);
    assert.equal(await forgetSegments([body], sig, n => prot[n - 5]), 1);
    const again = await translateSegments({ parts: [body], signature: sig, protection: n => prot[n - 5], request: async bodies => { asked.push(...bodies); return bodies.map(ko); } });
    assert.equal(again.translated, 1); assert.deepEqual(asked, [body]);
    await clearSegmentCache();
});

await test('배선: index.js 가 보호 글을 translateSegments · forgetSegments 에 준다 · CI 등록 · 판 3.0.1', () => {
    const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.match(index, /translateSegments\(\{ parts: paragraphParts,\n\s*signature: glossarySegmentSignature\(setupDigest\), protection: n => protectedBlocks\[n\],/);
    assert.match(index, /forgetSegments\(parts, glossarySegmentSignature\(setupDigest\), n => protectedBlocks\[n\]\)/);
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/translator-segment-keys\.mjs \./);
    assert.match(fs.readFileSync(path.join(root, 'src/addons/translator/manifest.json'), 'utf8'), /"version": "(?:3\.0\.[1-9]|3\.[1-9]\.\d+|[4-9]\.\d+\.\d+)"/);
});

console.log(`translator-segment-keys: ${passed} passed, 0 failed`);
