// 1.7.4 이미 글자색 · 강조가 입혀진 구간(속마음 · 인물색 · 굵게 …) 안의 따옴표 대사에는 대사 형광펜을 또 칠하지 않아요.
// 사용자: 「흠 이미 글자색 들어갔는데 또 형광펜이 들어가네」 — 인물색 속마음(*…『데이터 내놔』…*) 안의 『』 에만 띠가 따로 칠해졌어요.
// 판정(src/quote-inked.js)은 가짜 요소로, 규칙 · 생성물 · 조판 연결은 글로 봐요. 화면은 리그(허브 지시-1118/형광펜-겹침).
//   node tools/tests/quote-inked.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const { inkedQuote, INKED } = await import(pathToFileURL(path.join(root, 'src/quote-inked.js')).href);
assert.equal(INKED, 'bl-q-inked');

// 가짜 요소: el(이름, 속성, ...자식) · 글은 문자열
function el(nodeName, attrs = {}, ...kids) {
    const node = { nodeName, attrs, kids, parentElement: null, className: attrs.class || '',
        getAttribute: k => (k in attrs ? attrs[k] : null), hasAttribute: k => k in attrs,
        querySelectorAll: sel => { assert.equal(sel, 'q'); const out = []; const walk = k => { if (typeof k === 'string') return; if (k.nodeName === 'Q') out.push(k); k.kids.forEach(walk); }; kids.forEach(walk); return out; },
        get textContent() { return kids.map(k => (typeof k === 'string' ? k : k.textContent)).join(''); } };
    for (const k of kids) if (typeof k !== 'string') k.parentElement = node;
    return node;
}
const box = (...kids) => el('DIV', { class: 'mes_text' }, el('P', {}, ...kids));
const Q = text => el('Q', {}, text);
let n = 0;
const check = (name, want, build) => { const q = Q('『데이터 내놔』'); build(q); assert.equal(inkedQuote(q), want, name); n++; };

// 칠하지 않음 (이미 색 · 강조가 입혀진 구간 안)
check('인물색 속마음 span[data-tt] > em 안', true, q => box('그는 봉투를 본다. ', el('SPAN', { class: 'custom-tt custom-tt-x', 'data-tt': 'x' }, el('EM', {}, '부장님은 ', q, ' 소리만 하는데'))));
check('색 없는 속마음 *…『』…* (em 안 · 앞뒤 글)', true, q => box(el('EM', {}, '부장님은 ', q, ' 소리만 하는데')));
check('글자색 span style="color" 안 · 앞뒤 글', true, q => box(el('SPAN', { style: 'color: #3ccfbf' }, '속으로 ', q, ' 하고 되뇌었다')));
check('font[color] 안 · 앞뒤 글', true, q => box(el('FONT', { color: '#3ccfbf' }, '속으로 ', q, ' 하고')));
check('굵게(강조) 안 · 앞뒤 글', true, q => box(el('STRONG', {}, '그 말, ', q, '이 귀에 남았다')));
check('속마음 안의 꾸밈 칸(span) 을 건너 올라감', true, q => box(el('EM', {}, '부장님은 ', el('SPAN', { class: 'text_segment' }, q), ' 소리만')));

// 그대로 칠함 (보통 대사)
check('보통 대사', false, q => box('그가 말했다. ', q, ' 하고.'));
check('기울임으로 감싼 대사만 *『…』* (em 안에 다른 글 없음)', false, q => box('댓글이 ', el('EM', {}, q), '는 말뿐이었다'));
check('인물색 대사 font[color] 가 대사만 감쌈', false, q => box(el('FONT', { color: '#3aa7ff' }, q), ' 그가 말했다'));
check('대사만 감싼 색 + 문장부호만 더 (「…」. )', false, q => box(el('SPAN', { style: 'color:#3aa7ff' }, q, '. '), '그가 말했다'));
check('background-color 만 있는 span 은 글자색이 아님', false, q => box(el('SPAN', { style: 'background-color: #222' }, '앞 ', q, ' 뒤')));
check('대사 안의 대사(q q)는 바깥 대사 규칙이 맡음', false, q => box(el('Q', {}, '「부장님이 ', q, ' 래요」')));
check('블록(blockquote)에서 멈춤', false, q => el('DIV', { class: 'mes_text' }, el('EM', {}, '앞 글 ', el('BLOCKQUOTE', {}, q))));
// 1.7.6 구간에 대사가 여럿이어도 「대사 말고 다른 글」 만 봐요 — 고치기 전: 옆 대사의 글을 다른 글로 세서, 인물색 font 가 대사 두 개를 감싼 줄 · *『…』 『…』* 는 형광펜이 사라졌어요
check('인물색 font[color] 가 대사 둘만 감쌈 → 그대로 대사', false, q => box(el('FONT', { color: '#3aa7ff' }, q, ' ', Q('『어서』')), ' 그가 말했다'));
check('기울임이 대사 둘만 감쌈 *『…』 『…』*', false, q => box(el('EM', {}, Q('『잠깐』'), ', ', q)));
check('같은 글 대사 둘만 감쌈', false, q => box(el('STRONG', {}, q, ' ', Q('『데이터 내놔』'))));
check('대사 둘 + 다른 글이면 칠하지 않음', true, q => box(el('EM', {}, '부장님은 ', q, ' 아니면 ', Q('『어서』'), ' 뿐이다')));
check('대사 안의 대사를 품은 대사 둘만 감쌈', false, q => box(el('EM', {}, q, ' ', el('Q', {}, '「그가 ', Q('『어서』'), ' 랬어」'))));
{   // 조상 글 캐시(한 번의 조판): 같은 조상을 두 대사가 봐도 판정이 같아요
    const q1 = Q('『하나』'), q2 = Q('『둘』'); box(el('EM', {}, '속으로 ', q1, ' 그리고 ', q2)); const cache = new Map();
    assert.equal(inkedQuote(q1, cache), true); assert.equal(inkedQuote(q2, cache), true); assert.equal(cache.size, 1); n += 1;
}
// 버그 사냥 2: 값이 없는 color 조각 · 둘레를 따르는 값(inherit …)은 글자색이 아니에요 — 전엔 「color:」 글자만 봐서 색 없는 span 의 대사 띠가 빠졌어요
check('빈 color 조각(color:;) span 은 글자색이 아님', false, q => box(el('SPAN', { style: 'font-style:normal;color:;font-weight:500' }, '앞 ', q, ' 뒤')));
check('color: inherit span 은 글자색이 아님', false, q => box(el('SPAN', { style: 'color: inherit' }, '앞 ', q, ' 뒤')));
check('color: currentColor / unset / initial 도 아님', false, q => box(el('SPAN', { style: 'color:currentColor' }, el('SPAN', { style: 'color: unset !important' }, el('SPAN', { style: 'color:initial' }, '앞 ', q, ' 뒤')))));
check('color: var(--x) 는 글자색(프리셋 색)', true, q => box(el('SPAN', { style: 'color: var(--tt-x)' }, '앞 ', q, ' 뒤')));
check('color 값 뒤 !important 도 글자색', true, q => box(el('SPAN', { style: 'color:#3ccfbf !important' }, '앞 ', q, ' 뒤')));
// 버그 사냥 2: 이름 클래스만 단 속마음 칸(custom-tt-이름)도 속마음 — ink-contrast 의 속마음 칸 규칙(TT)과 같게
check('이름 클래스만 단 속마음 span.custom-tt-이름', true, q => box(el('SPAN', { class: 'custom-tt-mira' }, '속으로 ', q, ' 하고')));
check('custom-ttl · custom-tts-box 는 속마음이 아님(9b 와 같게)', false, q => box(el('SPAN', { class: 'custom-ttl custom-tts-box' }, '앞 ', q, ' 뒤')));
console.log(`판정 ${n}개 통과`);

// 조판이 q 마다 표시를 붙이고 떼요 (같은 상태면 다시 쓰지 않음 · 조판을 끄면 뗌)
const typo = read('src/typography.js');
assert.match(typo, /import \{ ?inkedQuote, ?INKED(?:, ?strongOnlyQuote, ?STRONG_Q)?(?:, ?italicInsideQuote, ?ITALIC_Q)? ?\} from '\.\/quote-inked\.js'/, 'typography.js 가 판정을 가져와요');   // 1.7.8 대사만 감싼 굵게(STRONG_Q)도 · 2.0.2 대사 안 통째 기울임(ITALIC_Q)도
assert.match(typo, /inkedQuote\(q/, 'writeRoot 에서 q 마다 판정');
assert.match(typo, /querySelectorAll\(`\.\$\{INKED\}`\)/, '조판을 끄면 표시를 떼요');

// 규칙: 형광펜 · 전체 칠에서 그 대사의 띠 · 마스크 · 잉크를 끄고 둘레 글자색을 따라요 (프롬프트 색 형광펜 · 애플 웹킷 규칙보다 무겁게)
const RULE = /q\.bl-q-inked:not\(#salty-none\) \{[^}]*background: none !important;[^}]*-webkit-mask: none !important;[^}]*color: inherit !important;/;
assert.match(read('css/06-chat-text.css'), RULE, 'css/06-chat-text.css 규칙');
for (const f of ['style.css', 'style-ext.css', 'src/preview.gen.css']) assert.ok(/q\.bl-q-inked:not\(#salty-none\)/.test(read(f)) || /q\.bl-q-inked:not\(#salty-none\)/.test(read('src/style-lazy.gen.css')), `${f} 생성물에 규칙`);
assert.ok(/q\.bl-q-inked/.test(read('src/preview.gen.css')), '미리보기 시트에도');
console.log('quote-inked: 통과');
