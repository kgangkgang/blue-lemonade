// 고르기 목록 통일 — 정적 전수조사 시험(8.2.8). 사용자 「모든 선택창 통일」: 화면의 모든 <select> 는 테마 고르기 목록(src/selects.js)으로 열려야 해요.
//   ① selects.js 의 eligible() 은 담는 창을 가리지 않는다 — 구조 예외는 목록 자신(.salty-pick-layer)뿐(.salty-panel 같은 창 이름 예외 없음)
//   ② 갈고리는 문서(document) 캡처 단계라 나중에 만들어진 select 도 걸린다(pointerdown · touchstart · touchend · mousedown · click · keydown)
//   ③ 테마 코드(src/**)가 만드는 모든 <select> 는 한 줄 고르기(multiple · size>1 없음) — 통일 대상 조건을 만족한다
//   ④ 문서 갈고리가 못 보는 곳(그림자 DOM)에 select 를 두지 않는다 · 숨긴 select 를 다른 칸으로 여는 곳은 openPickFor 를 쓴다
//   ⑤ 목록 모양(css/72-pick.css)에 담는 창 이름으로 거는 예외가 없다
//   node tools/tests/select-unify-static.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.(m?js|html)$/.test(e.name)) out.push(p);
    }
    return out;
}
const files = walk(path.join(root, 'src')).map(p => ({ rel: path.relative(root, p).replace(/\\/g, '/'), text: fs.readFileSync(p, 'utf8') }));
const selects = read('src/selects.js');

t('① eligible() 의 구조 예외는 .salty-pick-layer 뿐 — 담는 창 이름(.salty-panel 등)으로 빼지 않는다', () => {
    const from = selects.indexOf('function eligible(');
    const to = selects.indexOf('\n}', from);
    assert.ok(from >= 0 && to > from, 'eligible() 있음');
    const body = selects.slice(from, to).split('\n').map(line => line.replace(/\/\/.*$/, '')).join('\n');   // 주석은 빼고 본다
    const closest = [...body.matchAll(/closest\(\s*(['"`])([^'"`]*)\1\s*\)/g)].map(m => m[2]);
    assert.deepEqual(closest, ['.salty-pick-layer'], `closest 조건은 목록 자신뿐: ${JSON.stringify(closest)}`);
    assert.ok(!body.includes('salty-panel'), '.salty-panel 예외 없음');
    // 남은 예외 다섯: multiple · size>1 · disabled · select2 · 항목 0 — 전부 「한 줄 고르기가 아닌 것」
    assert.match(body, /el\.multiple \|\| el\.size > 1 \|\| el\.disabled/);
    assert.match(body, /select2-hidden-accessible/);
    assert.match(body, /el\.options\.length > 0/);
});

t('② 갈고리는 document 캡처 — 나중에 그려진 select 도 걸린다', () => {
    const from = selects.indexOf('export function startSelectPop');
    const body = selects.slice(from);
    for (const type of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown']) {
        const re = new RegExp(`document\\.addEventListener\\('${type}'[\\s\\S]*?(, true\\)|capture: true)`);
        assert.match(body, re, `document 캡처 ${type}`);
    }
});

// 테마 코드가 만드는 select 전부(템플릿 문자열 · HTML 파일 · createElement)
const tags = [];
for (const f of files) {
    if (f.rel === 'src/selects.js') continue;
    for (const m of f.text.matchAll(/<select\b([^>]*)>/g)) tags.push({ file: f.rel, attrs: m[1] });
    for (const m of f.text.matchAll(/createElement\(\s*['"]select['"]\s*\)/g)) tags.push({ file: f.rel, attrs: '', created: true });
}
// createElement 로 만든 select 가 multiple · size 를 받는지도 본다
const multiProps = files.flatMap(f => [...f.text.matchAll(/\b(select|sel|selectEl|selectNode)\.(multiple|size)\s*=\s*(?!false)/g)].map(m => `${f.rel}: ${m[0]}`));

t(`③ 테마가 만드는 select ${tags.length}개 전부 한 줄 고르기 — multiple · size>1 없음`, () => {
    assert.ok(tags.length >= 60, `select 생성 지점이 충분히 잡힘(${tags.length})`);
    const bad = tags.filter(x => /\bmultiple\b/.test(x.attrs) || /\bsize\s*=/.test(x.attrs));
    assert.deepEqual(bad.map(b => `${b.file}: <select${b.attrs}>`), [], '다중 선택 · 목록형 select 없음');
    assert.deepEqual(multiProps, [], 'select.multiple / select.size 를 켜는 코드 없음');
});

t('④ 그림자 DOM 없음 · 숨긴 select 를 다른 칸으로 여는 곳(한글화 패널 이름 칸)은 openPickFor', () => {
    const shadow = files.filter(f => /attachShadow\(/.test(f.text)).map(f => f.rel);
    assert.deepEqual(shadow, [], '문서 갈고리가 못 보는 그림자 DOM 없음');
    const prompt = read('src/addons/prompt/index.js');
    assert.match(prompt, /import \{ canPickFor, openPickFor \} from '\.\.\/\.\.\/selects\.js'/, '한글화 패널이 openPickFor 를 씀');
    assert.match(prompt, /openPickFor\(sel, pickAnchor\)/, '숨긴 select 를 이름 칸 밑에 연다');
});

t('⑤ css/72-pick.css 는 담는 창 이름으로 목록을 가리지 않는다', () => {
    const css = read('css/72-pick.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\.salty-panel/.test(css), '.salty-panel 조건 없음');
    assert.ok(!/display:\s*none/.test(css.split('.salty-pick-layer')[1] || ''), '층을 숨기는 규칙 없음');
});

console.log(`select-unify-static: ${n}개 통과 (select 생성 지점 ${tags.length}개)`);
