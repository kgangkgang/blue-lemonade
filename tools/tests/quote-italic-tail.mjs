// 1.6.8 기울임 대사 띠 늘림(0.15em)이 대사 끝 조각에만 붙는지 — 생성물까지 같은지 봐요.
// 예전엔 q 에 padding-inline-end + 음수 margin 을 줘서 box-decoration-break: clone 이 모든 조각에 붙였어요:
//   ① 『…』『…』 처럼 맞붙은 대사는 늘린 0.15em 이 다음 띠 위에 겹쳐 그 자리만 진했고
//   ② 대사가 줄 끝 공백 뒤에서 시작해 아랫줄로 넘어가면 윗줄 끝의 글자 없는 시작 조각에도 0.15em 띠가 세로 실금으로 남았어요.
// 지금은 q::after(대사 끝 조각에만 있음)의 padding 으로 늘리고, q 에는 늘림 · 음수 margin 이 없어요.
// 화면 확인은 리그(허브 지시-1117/형광펜-겹침)에서 했어요 — 이 시험은 규칙이 되돌아가지 않게 지켜요.
//   node tools/tests/quote-italic-tail.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const src = read('css/06-chat-text.css');
assert.match(src, /salty-dlg-marker\) :is\(em, i\) q:not\(q q\)::after \{\s*content: '';\s*padding-inline-end: 0\.15em;\s*\}/, '형광펜 늘림은 q::after 에');
// 1.9.8 전체 칠은 줄 조각마다 띠 색 그림자 0.15em(가운데 줄 끝 글자도 안 잘림 · 자리를 안 차지 · 폭 0 시작 조각엔 안 보임) — 사용자 「기울여진 글자 좀 잘리는 것 같음」
// 2.0.2 그림자 색은 그 대사의 띠 색(--bl-q-band — 인물 색 띠는 css/37 이 바꿈) · 대사 안이 통째 기울임(q.bl-q-em)도 같은 늘림(사용자 「신입 할 때 ㅣ 좀 짤리는데」)
assert.match(src, /salty-dlg-full\) :is\(:is\(em, i\) q:not\(q q\), q\.bl-q-em:not\(q q\)\) \{\s*box-shadow: 0\.15em 0 0 var\(--bl-q-band, var\(--salty-marker\)\), -0\.05em 0 0 var\(--bl-q-band, var\(--salty-marker\)\);/, '전체 칠은 줄마다 띠 색 그림자 늘림');
assert.match(src, /salty-dlg-full\) q \{\s*--bl-q-band: var\(--salty-fill-marker, var\(--salty-marker\)\);[^}]*background: var\(--bl-q-band\);/, '띠 색은 변수 하나');
const ink = read('css/37-prompt-ink.css');
assert.match(ink, /background-color: hsl\(var\(--bl-hue\) var\(--bl-mtone-s\) var\(--bl-mtone-l\)\) !important;\s*--bl-q-band: hsl\(var\(--bl-hue\) var\(--bl-mtone-s\) var\(--bl-mtone-l\)\);/, '인물 색 띠(톤 맞추기)는 그림자도 그 색');
assert.match(ink, /--bl-q-band: color-mix\(in srgb, currentColor 34%, transparent\);/, '애플 웹킷 반투명 띠도');
{
    const { italicInsideQuote, ITALIC_Q } = await import(pathToFileURL(path.join(root, 'src/quote-inked.js')).href);
    assert.equal(ITALIC_Q, 'bl-q-em');
    const el = (nodeName, ...kids) => { const n = { nodeName, kids, get children() { return kids.filter(k => typeof k !== 'string'); }, get textContent() { return kids.map(k => (typeof k === 'string' ? k : k.textContent)).join(''); } }; return n; };
    assert.equal(italicInsideQuote(el('Q', '“', el('EM', '아직 미숙한 신입이라 왜 방'), '”')), true, '따옴표만 밖 · 글은 통째 기울임');
    assert.equal(italicInsideQuote(el('Q', '“가자, ', el('EM', '지금'), '”')), false, '일부만 기울임');
    assert.equal(italicInsideQuote(el('Q', '“그냥 대사”')), false);
    assert.equal(italicInsideQuote(el('Q', el('SPAN', el('EM', '「응」')))), true, '색 span 안 기울임');
    const typo = read('src/typography.js');
    assert.match(typo, /const itq=italicInsideQuote\(q\);if\(itq!==q\.classList\.contains\(ITALIC_Q\)\)q\.classList\.toggle\(ITALIC_Q,itq\);/);
}
assert.match(src, /\) q \{\s*color: var\(--salty-dialogue\);[\s\S]*?box-decoration-break: clone;/, '대사는 줄 조각마다(clone)');
// 기울임 대사 q 자체에는 늘림 · 음수 margin 이 없어야 해요 (clone 이 모든 조각에 붙여요)
const ON_Q = /:is\(em, i\) q:not\(q q\)[^:{]*\{[^}]*(padding-inline-end|margin-inline-end)/;
for (const f of ['css/06-chat-text.css', 'css/23-preview.gen.css', 'style.css', 'style-ext.css', 'src/preview.gen.css', 'src/style-lazy.gen.css']) {
    const css = read(f);
    assert.ok(!ON_Q.test(css), `${f}: 기울임 대사 q 에 늘림 · 음수 margin 이 남지 않았어요`);
    assert.ok(!/margin-inline-end:\s*-0\.15em/.test(css), `${f}: 음수 0.15em margin 이 없어요`);
}
// 생성물에도 새 규칙이 들어갔어요 (첫 장 또는 지연 장 · 미리보기)
assert.ok(/q:not\(q q\)::after/.test(read('style.css') + read('src/style-lazy.gen.css')), 'style.css · style-lazy 에 q::after 늘림');
assert.ok(/q:not\(q q\)::after/.test(read('src/preview.gen.css')), '미리보기 시트에 q::after 늘림');
console.log('quote-italic-tail: 통과');
