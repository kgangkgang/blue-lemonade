// 6.7.9 감정 대사(「…」) 짝 맞추기 · 화면 글 꼴 · 인물 색 유지 (src/dem-expressive.js · css/55-dem-expressive.css).
// 겹 낫표가 든 속삭임 대사를 첫 」 에서 끊어 감정 칸을 인물 색 칸 안쪽에 감쌌고, 색 흐름을 끈 감정 칸의 대사 잉크 색이 인물 색을 덮어 형광펜 띠가 회색이 됐다.
// 지어낸 글만: node tools/tests/dem-expressive-nest.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
globalThis.document = { addEventListener() {}, getElementsByClassName: () => [], getElementById: () => null, querySelectorAll: () => [] };
const { findExpressive } = await import(pathToFileURL(path.join(root, 'src/dem-expressive.js')).href);
let pass = 0;
const check = (name, fn) => { fn(); pass++; console.log('PASS', name); };
const C = '#3ccfbf';

check('one level of the same bracket inside a dialogue keeps the whole line', () => {
    const [hit] = findExpressive(`<whispering><span style="color:${C}">「……큭, 위험했다! 「여」 자도 안 꺼냈으니까요, 형님!!」</span></whispering>`);
    assert.deepEqual(hit, { tags: ['whispering'], text: '「……큭, 위험했다! 「여」 자도 안 꺼냈으니까요, 형님!!」' });
    const [two] = findExpressive('<quiet>『바깥 『안쪽』 끝』</quiet>');
    assert.equal(two.text, '『바깥 『안쪽』 끝』');
});
check('other cases unchanged: 『』 inside 「」, two tags, two dialogues, no tag', () => {
    assert.equal(findExpressive('<shout>「『이름』, 거기 서!」</shout>')[0].text, '「『이름』, 거기 서!」');
    assert.deepEqual(findExpressive('<whispering><anxious>「괜찮을까」</anxious></whispering>')[0].tags, ['whispering', 'anxious']);
    assert.deepEqual(findExpressive('<shout>「하나」</shout> 그리고 <quiet>「둘」</quiet>').map(h => h.text), ['「하나」', '「둘」']);
    assert.deepEqual(findExpressive('「태그 없는 대사」'), []);
});
check('an unclosed inner bracket falls back to the inner pair (no runaway match)', () => {
    const hits = findExpressive('<deadpan>「바깥이 안 닫힘 「안쪽」 끝</deadpan>');
    assert.ok(hits.length <= 1);
    const long = '<shout>「' + '가'.repeat(5000) + '</shout>';
    const t0 = Date.now(); findExpressive(long); assert.ok(Date.now() - t0 < 200, 'linear time');
});
check('dialogue text is compared in the shown form (markdown turns ... into …)', () => {
    assert.equal(findExpressive(`<whispering><span style="color:${C}">「그래서요... 정말요?」</span></whispering>`)[0].text, '「그래서요… 정말요?」');
});
check('CSS: an effect box inside a character colour box inherits that colour (not the dialogue ink)', () => {
    const css = fs.readFileSync(path.join(root, 'css/55-dem-expressive.css'), 'utf8');
    const rule = /body\.salty:not\(\.salty-demfx-flow\) :is\(#chat, \.cg-root, \.salty-preview\) :is\(font\[color\], span\[style\*="color" i\]\) \.custom-dem-expressive:not\(\.custom-dem-expressive--\):not\(#salty-none\):not\(#salty-none\) \{\s*color: inherit !important;\s*\}/;
    assert.match(css, rule);
    // 대사 잉크 색 규칙보다 뒤 (같은 !important 끼리도 위 규칙보다 구체적)
    assert.ok(css.search(rule) > css.indexOf('color: var(--salty-marker-ink, var(--salty-dialogue)) !important;\n}\n/* 6.7.9'));
});
console.log(`dem-expressive-nest: ${pass} passed, 0 failed`);
