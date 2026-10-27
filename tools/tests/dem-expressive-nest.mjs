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
// 10-27 감정 태그가 붙은 대사도 같은 인물 색 (사용자 제보 10-27: <deadpan> 대사만 형광펜 띠 · 글자가 회색빛).
// 데우스 V3 프리셋 <style>(DEM - UI module accents)이 감정 칸에 고정 채도 필터를 줘 칸 안 띠 · 글자를 다시 칠했다.
// 실리태번이 메시지 <style> 을 바꾼 꼴(.mes_text + custom- 접두어, 특이도 0,2,0)보다 테마 규칙이 무거워야 한다 — 문장은 지어낸 것
const PRESET_FILTERS = { deadpan: 'saturate(.25) brightness(.92)', crying: 'saturate(.8)', hurt: 'saturate(.75)', intoxicated: 'saturate(1.15)' };
check('shape A (tag outside the colour span) finds the line in Japanese and Korean; shape B has no box', () => {
    for (const text of ['「それは、まあ、悪くない考えだ」', '「그건, 뭐, 나쁘지 않은 생각이야」']) {
        assert.deepEqual(findExpressive(`<deadpan><span style="color:#3aa7ff">${text}</span></deadpan>`), [{ tags: ['deadpan'], text }]);
        assert.deepEqual(findExpressive(`<span style="color:#3aa7ff">${text}</span>`), []);
        assert.deepEqual(findExpressive(`<whispering><deadpan><span style="color:#3aa7ff">${text}</span></deadpan></whispering>`)[0].tags, ['whispering', 'deadpan']);
    }
});
check('CSS: deadpan keeps the character colour — the preset colour filters are cleared (keyframes untouched)', () => {
    const ids = sel => (sel.match(/#[\w-]+/g) || []).length;
    for (const rel of ['css/55-dem-expressive.css', 'style.css']) {
        const css = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
        const reset = rules.filter(r => /^\s*filter\s*:\s*none\s*;?\s*$/.test(r.body) && /custom-dem-expressive--deadpan/.test(r.sel));
        assert.equal(reset.length, 1, `${rel}: 감정 칸의 고정 필터를 지우는 규칙이 하나여야 해요`);
        const { sel } = reset[0];
        for (const tag of Object.keys(PRESET_FILTERS)) assert.ok(sel.includes(`.custom-dem-expressive--${tag}`), `${rel}: --${tag} 도 지워야 해요`);
        for (const place of ['#chat', '.cg-root', '.salty-preview']) assert.ok(sel.includes(place), `${rel}: ${place} 에도 걸려야 해요`);
        assert.ok(!sel.includes('.mes_text'), `${rel}: 미리보기 사본에 복사되지 않게 .mes_text 를 쓰지 않아요`);
        assert.ok(ids(sel) >= 1 && ids('.mes_text .custom-dem-expressive--deadpan') === 0, `${rel}: 프리셋 규칙보다 무거워야 해요`);
        // 테마의 다른 고정 규칙이 감정 칸에 색을 바꾸는 필터를 다시 주지 않는다 (키프레임 단계는 선택자에 감정 칸 이름이 없어 빠진다)
        const recolour = rules.filter(r => /custom-dem-expressive/.test(r.sel) && /(^|;)\s*filter\s*:[^;]*(saturate|grayscale|sepia|hue-rotate)/.test(r.body));
        assert.deepEqual(recolour.map(r => r.sel), [], `${rel}: 감정 칸에 색을 바꾸는 고정 필터가 없어야 해요`);
    }
});
console.log(`dem-expressive-nest: ${pass} passed, 0 failed`);
