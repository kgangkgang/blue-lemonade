// 1.5.3 번역 문단 캐시 paragraph-v4 — 열쇠는 문단 글만, 번역 설정은 재료별 조각(sig)으로 줄 안에. 빗나간 까닭(어느 조각이 달라졌나) · 옛 열쇠 옮김 ·
//   편집 전 번역 다시 쓰기(prior) · 진행 표시 한 줄(cacheWhyLine) · 통째로 가는 까닭(segmentBlocker). 지어낸 문장 · 가짜 번역 · 메모리 캐시만 (유료 호출 0)
//   node tools/tests/translator-cache-why.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const seg = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-segments.js')));
const { translateSegments, clearSegmentCache, partsSig, changedParts, missReason, cacheWhyLine, segmentBlocker, segmentParagraphs, forgetSegments, shortHash } = seg;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const P = ['Rain hit the roof.', 'She counted coins.', 'He leaned on the door.', 'A train whistle faded.', 'Fine, he said.', 'They left at dawn.'];
const join = list => list.join('\n\n');
const fake = body => `번역(${body})`;
const base = { c: 'C1', g: 'G1', s: '', f: '', k: '' };
/** 한 번 번역 → { sent, result, stages } */
async function run(text, partsOf = () => base, extra = {}) {
    const sent = [], stages = [];
    const result = await translateSegments({ parts: segmentParagraphs(text), signature: () => 'legacy', keyParts: partsOf, progress: stage => stages.push(stage),
        request: async bodies => { sent.push(...bodies); return bodies.map(fake); }, ...extra });
    return { sent, result, stages };
}

await test('조각 sig · 달라진 조각 · 까닭', () => {
    assert.equal(partsSig({ c: 'a', g: 'b' }), JSON.stringify(['a', 'b', '', '', '']));
    assert.deepEqual(changedParts(partsSig({ c: 'a', g: 'b' }), partsSig({ c: 'a', g: 'x' })), ['g']);
    assert.equal(missReason(partsSig({ c: 'a' }), partsSig({ c: 'b', g: 'x' })), 'setup');
    assert.equal(missReason(partsSig({ g: 'a' }), partsSig({ g: 'b' })), 'glossary');
    assert.equal(missReason(partsSig({ k: 'a' }), partsSig({ k: 'b' })), 'glossary');
    assert.equal(missReason(partsSig({ s: 'a' }), partsSig({ s: 'b' })), 'speech');
    assert.equal(missReason(partsSig({ f: 'a' }), partsSig({ f: 'b' })), 'marks');
    assert.equal(missReason(partsSig({}), partsSig({})), 'same');
    assert.deepEqual(changedParts('not json', partsSig({})), ['c', 'g', 's', 'f', 'k']);
    assert.match(shortHash('x'), /^[0-9a-f]{16}$/); assert.notEqual(shortHash('x'), shortHash('y')); assert.equal(shortHash(['a', 1]), shortHash(JSON.stringify(['a', 1])));
});

await test('v4: 같은 글 · 같은 조각이면 0문단 · 빈 줄 더해도 0 · 맨 앞 끼우기 1', async () => {
    await clearSegmentCache();
    assert.equal((await run(join(P))).sent.length, 6);
    assert.equal((await run(join(P))).sent.length, 0);
    assert.equal((await run(P.join('\n\n\n'))).sent.length, 0);
    const front = await run(join(['A new opening line.', ...P]));
    assert.deepEqual(front.sent, ['A new opening line.']); assert.equal(front.result.why.absent, 1);
});

await test('v4: 한 문단의 조각만 다르면 그 문단만 · 까닭은 용어집', async () => {
    const parts = body => (body === P[2] ? { ...base, g: 'G2' } : base);
    const { sent, result, stages } = await run(join(P), parts);
    assert.deepEqual(sent, [P[2]]); assert.equal(result.reused, 5); assert.equal(result.why.glossary, 1);
    assert.equal(cacheWhyLine({ ...stages[0], edited: true }), '저장된 번역 5/6 · 용어집 바뀜 1 · 새로 번역 0/1');
    assert.equal((await run(join(P), parts)).sent.length, 0, '다시 저장된 조각으로 적중');
});

await test('v4: 연결 · 프롬프트 조각(c)이 바뀌면 전부 · 까닭은 설정', async () => {
    const { sent, result, stages } = await run(join(P), () => ({ ...base, c: 'C2' }));
    assert.equal(sent.length, 6); assert.equal(result.why.setup, 6);
    assert.equal(cacheWhyLine(stages[0]), '번역 설정이 바뀌어 6개 모두 다시 번역 · 0/6');
    assert.equal(cacheWhyLine({ ...stages[0], why: { setup: 5, absent: 1 } }), '번역 설정이 바뀌어 5개 다시 번역 · 0/6');
});

await test('옛 열쇠(v2) 줄 옮김: 새 열쇠로 못 찾으면 옛 열쇠로 찾아 쓰고 v4 줄로 다시 저장', async () => {
    await clearSegmentCache();
    // 1.5.2 까지처럼 옛 열쇠로만 저장 (keyParts 없음)
    await translateSegments({ parts: segmentParagraphs(join(P)), signature: () => 'legacy', request: async bodies => bodies.map(fake) });
    const moved = await run(join(P));
    assert.equal(moved.sent.length, 0); assert.equal(moved.result.migrated, 6); assert.equal(moved.result.reused, 6);
    assert.equal(moved.result.text, join(P.map(fake)));
    const again = await run(join(P), () => base, { signature: () => 'other-legacy' });
    assert.equal(again.sent.length, 0, 'v4 줄로 옮겨져 옛 열쇠 없이도 적중'); assert.equal(again.result.migrated, 0);
    // 옛 열쇠의 설정(서명)이 다르면 옮기지 않는다 — 다른 설정의 번역
    await clearSegmentCache();
    await translateSegments({ parts: segmentParagraphs(join(P)), signature: () => 'legacy-old-setup', request: async bodies => bodies.map(fake) });
    assert.equal((await run(join(P))).sent.length, 6);
});

await test('편집 전 번역(prior): 저장된 줄이 없는 문단만 · 캐시와 같은 검사 · v4 줄로 저장', async () => {
    await clearSegmentCache();
    const known = new Map(P.slice(1).map(body => [body, `옛(${body})`]));
    const edited = [P[0].replace('roof', 'old roof'), ...P.slice(1)];
    const first = await run(join(edited), () => base, { prior: body => known.get(body) ?? null });
    assert.deepEqual(first.sent, [edited[0]]); assert.equal(first.result.fromPrior, 5);
    assert.equal(cacheWhyLine({ ...first.stages[0], edited: true }), '이전 번역 5/6 · 새로 번역 0/1');
    assert.equal(first.result.text, join([fake(edited[0]), ...P.slice(1).map(body => `옛(${body})`)]));
    assert.equal((await run(join(edited))).sent.length, 0, 'prior 로 채운 문단도 v4 줄로 저장');
    // 검사에 걸리는 prior(원문 되풀이 · cacheable 거부)는 쓰지 않는다
    await clearSegmentCache();
    const refused = await run(join(P), () => base, { prior: body => body, cacheable: (body, out) => out !== body });
    assert.equal(refused.sent.length, 6);
});

await test('번역문 지우기(forgetSegments bodyKeys)는 v4 줄도 지운다', async () => {
    await clearSegmentCache();
    await run(join(P));
    assert.equal(await forgetSegments(segmentParagraphs(join(P)), () => 'legacy', null, { bodyKeys: true }), 6);
    assert.equal((await run(join(P))).sent.length, 6);
});

await test('진행 표시 한 줄: 이 기기에 없음 · 모든 문단이 바뀜 · 까닭 모름은 null · 이어 하기는 예전 문구', () => {
    const stage = { stage: 'segments', total: 6, reused: 0, pending: 6, batch: 6, finished: 2, why: { absent: 6 } };
    assert.equal(cacheWhyLine({ ...stage, edited: true }), '이 기기에 저장된 번역이 없어요 · 2/6');
    assert.equal(cacheWhyLine({ ...stage, edited: true, priorKnown: true }), '모든 문단이 바뀌어 새로 번역 · 2/6');
    assert.equal(cacheWhyLine(stage), null, '새 메시지 첫 번역은 예전 문구');
    assert.equal(cacheWhyLine({ ...stage, reused: 3, resumed: 3 }), null);
    assert.equal(cacheWhyLine({ stage: 'segments', total: 6, reused: 6, pending: 0 }), null);
    assert.equal(cacheWhyLine({ stage: 'whole', why: 'block' }), '표 · 접기 HTML 이 있어 통째로 번역');
    assert.equal(cacheWhyLine({ stage: 'whole' }), null);
    assert.equal(cacheWhyLine(null), null);
});

await test('통째로 가는 까닭: 코드 칸 · HTML 덩이 · 빈 줄을 건너는 태그 · 문단 수', () => {
    assert.equal(segmentBlocker(join(P)), null);
    assert.equal(segmentBlocker(`${join(P)}\n\n\`\`\`\nHP 10\n\`\`\``), 'code');
    assert.equal(segmentBlocker(`${join(P)}\n\n<details><summary>S</summary>x</details>`), 'block');
    assert.equal(segmentBlocker(`<span style="color:red">${P[0]}\n\n${P[1]}</span>`), 'tags');
    assert.equal(segmentBlocker(Array.from({ length: 402 }, (_, i) => `Line ${i}.`).join('\n\n')), 'long');
});

await test('편집 전 번역 짝(translation-source.js): 문단 해시 기록 · 내용으로 짝짓기 · 자리표시자 · 수가 다르면 없음', async () => {
    const S = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-source.js')));
    const hash = t => `h${t.length}:${shortHash(t)}`;
    const original = join(P), raw = join(P.map(body => `옛(${body})`));
    const extra = {};
    S.rememberSource(extra, { original, raw, display: raw, hash });
    assert.equal(extra.translation_source.p.split(' ').length, 6);
    assert.ok(extra.translation_source.p.length <= 6 * 8, '문단 하나에 8자 안쪽');
    // 수가 다른 번역(문단을 합쳐 쓴 답)은 기록하지 않는다
    const merged = {}; S.rememberSource(merged, { original, raw: raw.replace('\n\n', ' '), display: 'x', hash }); assert.equal(merged.translation_source.p, undefined);
    Object.assign(extra, { original_text_hash: hash(original), display_text: raw });
    const prior = S.priorFromRecord(extra, { hash });
    assert.equal(prior.paragraphs.length, 6);
    assert.equal(S.priorParagraph(prior, P[3], []), `옛(${P[3]})`, '자리가 아니라 내용으로');
    assert.equal(S.priorParagraph(prior, 'Brand new paragraph.', []), null);
    // 기록이 옛 원문 · 지금 표시와 안 맞으면 없음
    assert.equal(S.priorFromRecord({ ...extra, original_text_hash: 'other' }, { hash }), null);
    assert.equal(S.priorFromRecord({ ...extra, display_text: 'changed' }, { hash }), null);
    // 자리표시자: 보호 글로 되돌려 찾고, 옛 번역 안의 같은 보호 글을 지금 번호로 다시 가린다
    const span = '<span style="color:#123">', src2 = [`${span}Hello there.</span>`, 'Second.'], tr2 = [`${span}안녕.</span>`, '둘째.'];
    const ex2 = {}; S.rememberSource(ex2, { original: join(src2), raw: join(tr2), display: join(tr2), hash });
    Object.assign(ex2, { original_text_hash: hash(join(src2)), display_text: join(tr2) });
    const p2 = S.priorFromRecord(ex2, { hash });
    assert.equal(S.priorParagraph(p2, '[[__VAR_4__]]Hello there.[[__VAR_5__]]', { 4: span, 5: '</span>' }), '[[__VAR_4__]]안녕.[[__VAR_5__]]');
    assert.equal(S.priorParagraph(p2, '[[__VAR_4__]]Hello there.[[__VAR_5__]]', { 4: '<b>', 5: '</b>' }), null, '보호 글이 다르면 다른 문단');
});

await test('배선: index.js 가 v4 조각 · 까닭 한 줄 · 지우기 v4 줄 · CI 등록', () => {
    const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.match(index, /protection: n => protectedBlocks\[n\], keyParts, check: watcher\.check/);
    assert.match(index, /forgetSegments\(parts, glossarySegmentSignature\(setupDigest\), n => protectedBlocks\[n\], \{ bodyKeys: Boolean\(keyParts\) \}\)/);
    assert.match(index, /const why = typeof cacheWhyLine === 'function' \? cacheWhyLine\(stage\) : null;/);
    assert.match(index, /function segmentKeyMaker\(/);
    assert.match(index, /const prior = priorFromRecord\(message\.extra, \{ hash: getStringHash \}\); if \(prior\) editPriors\.set\(message, prior\);/, '편집 저장이 지우기 전에 짝을 남긴다');
    assert.ok(index.indexOf('editPriors.set(message, prior)') < index.indexOf('delete message.extra.display_text;\n            forgetSource(message.extra);   // 6.9.6'), '지우기 전에');
    assert.match(index, /translate\(originalText, \{ segmentCache, prior: segmentCache \? prior : null,/);
    assert.match(index, /prior: options\.prior && typeof priorParagraph === 'function' \? body => priorParagraph\(options\.prior, body, protectedBlocks\) : null,/);
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/translator-cache-why\.mjs \./);
    assert.match(fs.readFileSync(path.join(root, 'src/addons/translator/MODIFICATIONS.md'), 'utf8'), /paragraph-v4/);
});

console.log(`translator-cache-why: ${passed} passed, 0 failed`);
