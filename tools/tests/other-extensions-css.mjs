// 1.1.2 다른 확장 호환 손질(css/42-other-extensions.css) — 그 확장이 없을 때 화면이 바뀌지 않게 좁게 걸렸는지 지켜요.
//   ① 모든 갈래가 body.salty 로 시작하고, 그 확장만 만드는 클래스(.image-embed-expression · .input-feedback)를 반드시 거쳐요
//   ② #chat 을 쓰지 않아요 — 쓰면 미리보기 생성기(tools/gen-preview-css.js)가 설정 창 미리보기용 사본을 만들어요(표본에 없는 요소라 죽은 규칙)
//   ③ !important 를 쓰지 않아요 — 그 확장의 규칙은 특이도로 이기고, 테마의 투명 그림 규칙(68-cutout-edge.css)은 그대로 이겨야 해요
//   ④ 크기 · 자리 속성은 건드리지 않아요(그 확장이 정한 크기 그대로)
//   ⑤ 첫 시트(style.css)에 실려요 — 채팅에 바로 보이는 화면이라 둘째 장을 기다리면 안 돼요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const NAME = '42-other-extensions.css';
const raw = fs.readFileSync(path.join(root, 'css', NAME), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selectors: m[1].trim().split(/,\s*(?![^()]*\))/).map(s => s.trim()), body: m[2] }));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

const OWN = ['.image-embed-expression', '.input-feedback'];
check('규칙이 하나 이상 있고 중첩 at-규칙이 없어요', () => {
    assert.ok(rules.length >= 1, `규칙 ${rules.length}개`);
    assert.ok(!/@(media|supports|layer|container)/.test(css), '중첩 at-규칙은 이 시험이 갈래를 못 읽어요');
});
check('① 모든 갈래가 body.salty 로 시작하고 그 확장의 클래스를 거쳐요', () => {
    for (const r of rules) for (const s of r.selectors) {
        assert.ok(/^body\.salty[.:\s]/.test(s), `body.salty 로 시작하지 않음: ${s}`);
        assert.ok(OWN.some(c => s.includes(c)), `그 확장의 클래스가 없음: ${s}`);
    }
});
check('② #chat 을 쓰지 않아요', () => { for (const r of rules) for (const s of r.selectors) assert.ok(!/#chat(?![\w-])/.test(s), s); });
check('③ !important 를 쓰지 않아요', () => { for (const r of rules) assert.ok(!/!\s*important/i.test(r.body), r.selectors[0]); });
check('④ 크기 · 자리 속성을 건드리지 않아요', () => {
    const banned = /(^|[;\s])(width|height|min-width|min-height|max-width|max-height|margin|margin-[a-z-]+|display|position|inset|top|left|right|bottom|float|flex|flex-[a-z]+|object-fit|transform)\s*:/i;
    for (const r of rules) assert.ok(!banned.test(r.body), `${r.selectors[0]} → ${r.body.match(banned)?.[0].trim()}`);
});
check('⑤ 첫 시트(style.css)에 실려요', () => {
    const sheet = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const mark = sheet.indexOf(`css/${NAME}`);
    assert.ok(mark > 0, 'style.css 에 모듈 표시가 없어요 — node tools/build-css.cjs');
    const used = OWN.filter(c => css.includes(c));
    assert.ok(used.length > 0, '그 확장의 클래스가 하나도 없어요');
    for (const c of used) assert.ok(sheet.indexOf(c, mark) > 0, `${c} 규칙이 style.css 에 없어요`);
});
console.log(`other-extensions-css: ${passed}개 통과`);
