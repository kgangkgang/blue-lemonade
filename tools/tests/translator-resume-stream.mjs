// 번역기 2.9.0 이어 하기: 흘려받던 큰 묶음이 끊기면(연결 · 중지 · 시간 초과) 이미 닫힌 문단은 하루 동안 남기고, 다시 번역하면 남은 문단만 보낸다.
// 30일 문단 캐시에는 넣지 않는다. 검사는 캐시와 같은 cacheable · 원문 되풀이 걷기. ⟦1⟧ 부터 매긴 흘려받기는 남기지 않는다. 가짜 모델 · 메모리 캐시만.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const seg = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-segments.js')));
const { segmentParagraphs, translateSegments, clearSegmentCache, streamWatch } = seg;
const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const TEXT = Array.from({ length: 10 }, (_, i) => `Paragraph ${i} about the quiet harbor.`).join('\n\n');
const ko = body => `번역 ${body.match(/\d+/)[0]}: 조용한 항구 이야기.`;
const go = (request, extra = {}) => translateSegments({ parts: segmentParagraphs(TEXT), signature: () => 'synthetic', request, ...extra });

await test('10문단 묶음 중 6문단까지 흘려받고 끊김 → 다시 번역하면 남은 4문단만 요청 · 결과는 한 번에 받은 것과 같다', async () => {
    await clearSegmentCache();
    await assert.rejects(go(async (bodies, done) => {
        assert.equal(bodies.length, 10);
        done(bodies.slice(0, 6).map(ko), 6, 6);                 // 닫힌 문단 6개 (⟦0⟧ 부터)
        throw Object.assign(Error('연결이 끊겼어요'), { transient: true });
    }), /연결이 끊겼어요/);
    let asked = null;
    const again = await go(async bodies => { asked = [...bodies]; return bodies.map(ko); });
    assert.deepEqual(asked, ['Paragraph 6 about the quiet harbor.', 'Paragraph 7 about the quiet harbor.', 'Paragraph 8 about the quiet harbor.', 'Paragraph 9 about the quiet harbor.']);
    assert.equal(again.reused, 6); assert.equal(again.translated, 4);
    await clearSegmentCache();
    const whole = await go(async bodies => bodies.map(ko));
    assert.equal(again.text, whole.text, '이어 한 결과 = 한 번에 받은 결과');
});
await test('중지(cancelled)로 멈춰도 닫힌 문단은 남는다', async () => {
    await clearSegmentCache();
    await assert.rejects(go(async (bodies, done) => { done(bodies.slice(0, 3).map(ko), 3, 3); throw Object.assign(Error('멈춤'), { cancelled: true }); }));
    let asked = 0; await go(async bodies => { asked = bodies.length; return bodies.map(ko); });
    assert.equal(asked, 7);
});
await test('거절문 · 깨진 문단(cacheable 거짓 · 원문 되풀이)은 남기지 않는다', async () => {
    await clearSegmentCache();
    const refusal = '죄송하지만 이 내용은 번역할 수 없습니다.';
    const cacheable = (body, out) => out !== refusal && !out.includes('[[__VAR_');
    await assert.rejects(go(async (bodies, done) => {
        const view = bodies.slice(0, 5).map(ko); view[1] = refusal; view[3] = '번역 [[__VAR_9__]] 깨짐';
        done(view, 5, 5); throw Error('시간 초과');
    }, { cacheable }));
    let asked = null; await go(async bodies => { asked = bodies.map(b => Number(b.match(/\d+/)[0])); return bodies.map(ko); }, { cacheable });
    assert.deepEqual(asked, [1, 3, 5, 6, 7, 8, 9]);
});
await test('safe 앞쪽까지만: 닫힌 문단이 더 있어도 이어 붙여도 되는 수(safe)까지만 남긴다', async () => {
    await clearSegmentCache();
    await assert.rejects(go(async (bodies, done) => { done(bodies.slice(0, 6).map(ko), 6, 2); throw Error('429'); }));
    let asked = 0; await go(async bodies => { asked = bodies.length; return bodies.map(ko); });
    assert.equal(asked, 8);
});
await test('정상 완료는 예전과 같다 (30일 캐시에 들어가 다음엔 요청 없음)', async () => {
    await clearSegmentCache();
    const first = await go(async bodies => bodies.map(ko));
    assert.equal(first.translated, 10);
    let asked = 0; const second = await go(async bodies => { asked = bodies.length; return bodies.map(ko); });
    assert.equal(asked, 0); assert.equal(second.reused, 10); assert.equal(second.text, first.text);
});
await test('일부 묶음만 실패(null): 결과는 그대로 차단 표시 · 받은 문단은 이어 하기로', async () => {
    await clearSegmentCache();
    const out = await go(async (bodies, done) => {
        done(bodies.slice(0, 7).map(ko), 7, 7);
        return bodies.map((b, i) => (i < 5 ? ko(b) : null));
    }, { blockedMarker: '[차단]' });
    assert.equal(out.blocked, 5); assert.match(out.text, /\[차단\]\nParagraph 5/);
    let asked = null; await go(async bodies => { asked = bodies.map(b => Number(b.match(/\d+/)[0])); return bodies.map(ko); });
    assert.deepEqual(asked, [7, 8, 9], '0~4 는 30일 캐시, 5 · 6 은 이어 하기');
});
await test('streamWatch: ⟦0⟧ 부터 매긴 답은 닫힌 문단이 safe · ⟦1⟧ 부터 매긴 답은 safe 0 · 끝난 작은 묶음(keep)은 safe', async () => {
    const calls = [];
    const frame = fn => { fn(); return 0; };
    const sources = ['A one.', 'B two.', 'C three.', 'D four.'];
    let w = streamWatch({ done: (view, count, safe) => calls.push({ count, safe }), settled: () => [], frame, cancel: () => {} });
    let feed = w.follow(sources, 0);
    feed('⟦0⟧ 가\n\n⟦1⟧ 나\n\n⟦2⟧ 다');
    assert.deepEqual(calls.at(-1), { count: 2, safe: 2 }, '닫힌 0 · 1 (2 는 아직 열림)');
    calls.length = 0;
    w = streamWatch({ done: (view, count, safe) => calls.push({ count, safe }), settled: () => [], frame, cancel: () => {} });
    feed = w.follow(sources, 0);
    feed('⟦1⟧ 가\n\n⟦2⟧ 나\n\n⟦3⟧ 다');
    assert.equal(calls.at(-1).safe, 0, '1부터 매긴 답은 남기지 않는다');
    w.keep(0, ['가', '나']);
    assert.equal(calls.at(-1).safe, 2, '반 나누기로 끝난 작은 묶음은 남긴다');
});
await test('배선: 이어 하기 열쇠 · 하루 · 30일 캐시와 따로 · 진행 표시는 번역 표의 guard 로', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/translator/translation-segments.js'), 'utf8');
    assert.match(src, /const RESUME = 'resume:', RESUME_TTL = 86400000;/);
    assert.match(src, /readMany\(\[\.\.\.new Set\(keyed\.map\(row => RESUME \+ row\[2\]\)\)\], RESUME_TTL\)/);
    assert.match(src, /rows\.push\(\[RESUME \+ row\.key, cleaned\]\)/);
    assert.match(index, /const badge = progressBadge\(messageId, message, sourceMes, chatId, runToken\.guard\);\n\s+const preview = runToken\.preview = translationPreview\(messageId, message, sourceMes, chatId, originalText, runToken\.guard\);/);
    assert.match(index, /const index = guard \? guard\.index\(\) : message \? resolveTranslationTarget/);
    assert.ok(!index.includes("toastr.info('번역이 이미 진행 중입니다.')"), 'every notice says which message');
});
console.log(`\ntranslator-resume-stream: ${passed} passed, 0 failed`);
