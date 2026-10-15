// TTS 1.8.9 HTML 주석 — 닫히지 않은 <!-- 는 그 문단 끝까지만 걷는다 (번역기 2.5.1 표시 보정 hideOpenComments 와 같은 규칙).
//   예전엔 닫는 --> 를 잃은 주석(번역기 2.5.0 까지가 남긴 깨진 번역문)을 만나면 글 끝까지 걷어서 주석 뒤 본문을 하나도 읽지 않았다.
//   닫힌 주석은 예전처럼 통째 · 홀로 남은 --> 문단도 걷음 · 글 속 화살표는 그대로 · 스트리밍 중 마지막 주석은 끝까지 · 줄 번호 그대로.
//   번역기 2.5.1 이 들어간 트리면 화면(hideOpenComments)과 읽는 글이 같은지도 맞춰 본다. 가상 문장만 쓴다.
//   node tools/tests/tts-open-comment.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const url = rel => pathToFileURL(path.join(theme, rel)).href;
const X = await import(url('src/addons/tts/src/text.js'));

let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log(`ok - ${name}`); }
    catch (e) { failed++; console.log(`not ok - ${name}\n  ${String(e?.stack || e).split('\n').slice(0, 6).join('\n  ')}`); }
}
const spoken = (text, final = true) => X.segmentMessage(text, { final }).map(g => g.text).join(' | ');

// 깨진 번역문: 주석의 앞 조각만 남고 닫는 --> 가 없다 (주석 안에도 빈 줄이 있던 프리셋 점검)
const BROKEN = [
    '<!-- 가상 점검: 장면의 흐름과 시점을 살핀다',
    '1단계 — 앞 장면과 이어지는지 본다',
    '',
    '"오늘은 바람이 차네요." 은하가 창문을 닫았다.',
    '',
    '"따뜻한 차 한 잔 하실래요?" 도윤이 물었다.',
].join('\n');

await test('a broken comment without --> hides only its own paragraph; the body after it is read', () => {
    const segs = X.segmentMessage(BROKEN, { final: true });
    const all = segs.map(g => g.text).join(' ');
    assert.ok(!/점검|1단계|흐름/.test(all), all);
    assert.ok(all.includes('오늘은 바람이 차네요.'), all);
    assert.ok(all.includes('따뜻한 차 한 잔 하실래요?'), all);
    assert.ok(all.includes('창문을 닫았다'), 'narration too: ' + all);
    const lines = BROKEN.split('\n');
    for (const g of segs) assert.ok(lines[g.line].includes(g.raw || g.text), `${g.kind} "${g.text}" on line ${g.line}`);
    assert.deepEqual(segs.map(g => [g.kind, g.text, g.line]),
        X.segmentMessage(BROKEN.replace(/^[^]*?\n\n/, '\n\n\n'), { final: true }).map(g => [g.kind, g.text, g.line]),
        'same segments and line numbers as the text without that paragraph');
});

await test('a closed comment (blank lines inside) is blanked whole as before', () => {
    const text = '<!-- 가상 점검: 시점 확인\n\n"이건 점검 속 대사" 라고 적어 둔다\n\n결과 정리 -->\n\n"좋은 아침이에요." 은하가 웃었다.';
    const all = spoken(text);
    assert.ok(!/점검|결과 정리/.test(all), all);
    assert.ok(all.includes('좋은 아침이에요.'), all);
    const b = X.blankComments(text);
    assert.equal(b.length, text.length);
    assert.equal(b.split('\n').length, text.split('\n').length);
});

await test('a lone --> paragraph (the lost tail of a comment) is dropped; an arrow inside a sentence stays', () => {
    const text = '"서두르자." 도윤이 말했다.\n\n점검 뒷부분: 결과를 정리한다 -->\n\n지도에는 집 --> 역 --> 공원 순서가 적혀 있었다.';
    const all = spoken(text);
    assert.ok(!all.includes('결과를 정리한다'), all);
    assert.ok(all.includes('서두르자.'), all);
    assert.ok(/집\s*-->\s*역/.test(X.blankComments(text)), 'the arrow in a sentence is kept');
    assert.ok(all.includes('공원 순서가 적혀 있었다'), all);
});

await test('an open comment inside a paragraph hides from <!-- to that paragraph end only', () => {
    const text = '은하가 문을 열었다.\n<!-- 가상 점검 시작\n계속되는 점검\n\n"다녀왔어요." 도윤이 말했다.';
    const all = spoken(text);
    assert.ok(all.includes('은하가 문을 열었다.'), all);
    assert.ok(all.includes('다녀왔어요.'), all);
    assert.ok(!/점검/.test(all), all);
});

await test('two comments: a broken one, then a closed one later — only the broken paragraph and the closed comment go', () => {
    const text = '<!-- 가상 점검 하나\n\n"첫 대사." 은하가 말했다.\n\n<!-- 가상 점검 둘 -->\n\n"둘째 대사." 도윤이 답했다.';
    const all = spoken(text);
    assert.ok(all.includes('첫 대사.') && all.includes('둘째 대사.'), all);
    assert.ok(!/점검/.test(all), all);
});

await test('streaming (final=false): the last comment may still be being written, so it hides to the end as before', () => {
    const text = '"안녕하세요." 은하가 인사했다.\n\n<!-- 가상 점검: 아직 쓰는 중\n\n"점검 속 예시 대사"';
    const live = spoken(text, false);
    assert.ok(live.includes('안녕하세요.'), live);
    assert.ok(!/점검/.test(live), live);
    // 스트리밍이어도 뒤에 다른 <!-- 가 온 앞 주석은 깨진 것 — 그 문단까지만 (글 맨 앞 <!-- 는 생각 블록 머리로 보니 본문 뒤에 둔다)
    const two = '"앞 대사." 은하가 말했다.\n\n<!-- 깨진 점검\n\n"중간 대사." 도윤이 말했다.\n\n<!-- 쓰는 중인 점검\n\n점검 내용';
    const l2 = spoken(two, false);
    assert.ok(l2.includes('앞 대사.') && l2.includes('중간 대사.') && !/점검/.test(l2), l2);
    // 다 쓴 글(final)이면 마지막 것도 문단까지만
    assert.ok(spoken(text, true).includes('점검 속 예시 대사'), 'a final text with an open comment reads the next paragraph');
});

await test('stripForSpeech uses the same rule', () => {
    assert.equal(X.stripForSpeech('<!-- 가상 점검\n\n본문 문장.'), '본문 문장.');
    assert.equal(X.stripForSpeech('앞 문장. <!-- 점검 --> 뒤 문장.'), '앞 문장. 뒤 문장.');
    assert.equal(X.stripForSpeech('본문 문장.\n\n뒷부분 점검 -->'), '본문 문장.');
    assert.equal(X.stripForSpeech('앞 문장.<br><!-- 점검<br><br>뒤 문장.'), '앞 문장. 뒤 문장.');
    assert.equal(X.stripForSpeech('주석 없는 글 --> 화살표 그대로'), '주석 없는 글 --> 화살표 그대로');
});

await test('text without comments is returned as is', () => {
    const plain = '"평범한 대사." 은하가 말했다.\n\n지문 한 줄.';
    assert.equal(X.blankComments(plain), plain);
    assert.equal(X.blankComments(''), '');
    assert.equal(X.blankComments(null), '');
});

// 번역기 2.5.1 이 들어간 트리면: 화면에 남는 글(hideOpenComments 뒤 닫힌 주석은 브라우저가 숨김)과 TTS 가 읽는 글이 같아야 한다
const seg = path.join(theme, 'src/addons/translator/translation-segments.js');
const T = fs.existsSync(seg) && fs.readFileSync(seg, 'utf8').includes('export function hideOpenComments') ? await import(url('src/addons/translator/translation-segments.js')) : null;
await test('same visible text as the translator 2.5.1 display fix' + (T ? '' : ' (skipped: translator 2.5.1 not in this tree)'), () => {
    if (!T) return;
    const cases = [
        BROKEN,
        '<!-- 가상 점검: 시점 확인\n\n중간 메모\n\n결과 정리 -->\n\n"좋은 아침이에요." 은하가 웃었다.',
        '"서두르자." 도윤이 말했다.\n\n점검 뒷부분: 결과를 정리한다 -->\n\n지도에는 집 --> 역 --> 공원 순서가 적혀 있었다.',
        '은하가 문을 열었다.\n<!-- 가상 점검 시작\n계속되는 점검\n\n"다녀왔어요." 도윤이 말했다.',
        '<!-- 가상 점검 하나\n\n"첫 대사." 은하가 말했다.\n\n<!-- 가상 점검 둘 -->\n\n"둘째 대사." 도윤이 답했다.',
        '첫 문단.\n\n<!-- 점검 앞 조각\n\n둘째 문단.\n\n뒤 조각 결과 -->\n\n셋째 문단.',
        '본문 <!-- 한 줄 점검 --> 이어지는 본문 -->\n\n끝 문단.',
        '<!-- 끝까지 열린 점검',
    ];
    // 닫힌 주석은 브라우저가 숨긴다 → 걷고 공백만 모은다 (stripForSpeech 를 다시 거치면 주석 규칙이 한 번 더 걸린다)
    const norm = s => String(s).replace(/<!--[\s\S]*?-->/g, ' ').replace(/\s+/g, ' ').trim();
    for (const c of cases) assert.equal(X.stripForSpeech(c), norm(T.hideOpenComments(c)), JSON.stringify(c));
});

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
