// 11-14 깡통 질문 「정규식 토글 끄는 게 왜 안 먹히나」 — 폰(손가락 화면)에서 정규식 줄의 켜짐 아이콘을 눌러도 안 꺼지고, 꺼짐 아이콘(켜기)은 먹던 문제.
//   원인: 86-touch-targets.css 가 #rm_extensions_block label.flex-container:has(> input[type=checkbox]) 에 44×44 투명 상자(::before)를 달았다.
//   실리태번 정규식 줄(scriptTemplate.html)은 <label class="checkbox flex-container" for="regex_disable"> 안에 숨은 input.disable_regex 와 아이콘 둘인데,
//   for 가 가리키는 id 가 없어 라벨을 눌러도 아무 칸도 안 바뀌고, 값은 아이콘(.regex-toggle-on/off) click 으로만 바뀐다.
//   상자가 켜짐 아이콘을 덮어 누름을 라벨이 받았다(꺼짐 아이콘은 실리태번이 준 filter: grayscale 로 쌓임 맥락이 생겨 상자보다 위라 「켜기」는 됐다). 마우스 화면 · 순정은 정상.
//   지키는 것:
//   ① 86 의 라벨 상자 · 기준점 목록에서 그 라벨 선택자는 정규식 줄 라벨(for="regex_disable")을 뺀다 — 특이도를 안 올리게 :where 로 · :has 를 늘리지 않게 속성으로
//   ② 대신 아이콘 자신에 ::after 상자(Font Awesome 글자가 ::before)와 기준점 — 손가락 누름 넓이는 그대로 44
//   ③ 손가락 화면(pointer: coarse) 안에서만
//   ④ 묶은 style.css · style-lazy.gen.css 에도 같은 제외가 들어가 있다 (생성물이 소스와 같음)
//   리그 확인(폰 360 · PC 1280 · 전역 · 데우스 프리셋 · 캐릭터 정규식 · 새로고침 뒤 disabled 저장): 허브 지시-1114/정규식-토글/보고.md
//   node tools/tests/regex-toggle-touch.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

const css = strip(read('css/86-touch-targets.css'));
const LABEL = '#rm_extensions_block label.flex-container:has(> input[type="checkbox"])';
const EXCLUDE = ':where(:not([for="regex_disable"]))';   // :has 를 더하지 않아요(첫 장 :has 수 예산)
const ICON = ':where(#rm_extensions_block .regex-script-label) label > :is(.regex-toggle-on, .regex-toggle-off)';
const media = (() => {
    const open = css.indexOf('@media (pointer: coarse) {');
    assert.ok(open >= 0, '손가락 화면 미디어');
    let depth = 0;
    for (let i = css.indexOf('{', open); i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}' && !--depth) return css.slice(open, i + 1); }
    throw new Error('미디어 끝 없음');
})();
// 규칙 하나(선택자 · 본문)씩 — 미디어 안 평평한 규칙만
const rules = [...media.slice(media.indexOf('{') + 1).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
const isBox = r => /content:\s*''/.test(r.body) && /width:\s*max\(100%,\s*44px\)/.test(r.body) && /position:\s*absolute/.test(r.body);
const isAnchor = r => /(^|;|\s)position:\s*relative/.test(r.body) && !/::(before|after)/.test(r.sel);

t('① 라벨 상자 · 기준점의 정규식 줄 라벨 제외 (:where 로 특이도 그대로)', () => {
    const at = [...css.matchAll(/#rm_extensions_block label\.flex-container:has\(> input\[type="checkbox"\]\)/g)].map(m => m.index);
    assert.ok(at.length >= 2, `라벨 선택자 ${at.length}`);
    for (const i of at) assert.equal(css.slice(i + LABEL.length, i + LABEL.length + EXCLUDE.length), EXCLUDE, `제외 없는 라벨 선택자: …${css.slice(i, i + 140)}`);
    // 상자 규칙 · 기준점 규칙 양쪽에
    assert.ok(rules.some(r => isBox(r) && r.sel.includes(LABEL + EXCLUDE)), '상자 규칙에 제외');
    assert.ok(rules.some(r => isAnchor(r) && r.sel.includes(LABEL + EXCLUDE)), '기준점 규칙에 제외');
});

t('② 아이콘 자신의 ::after 상자와 기준점 (::before 는 Font Awesome 글자)', () => {
    const box = rules.find(r => isBox(r) && r.sel.includes(ICON + '\n  )::after'));
    assert.ok(box, '아이콘 ::after 상자');
    assert.ok(!rules.some(r => isBox(r) && r.sel.includes(ICON + '\n  )::before')), '아이콘 ::before 를 상자로 쓰지 않음');
    assert.ok(rules.some(r => isAnchor(r) && r.sel.includes(ICON)), '아이콘 기준점(relative)');
    // 다른 모듈이 정규식 아이콘의 ::after 를 모양으로 쓰지 않음
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && f !== '86-touch-targets.css')) {
        assert.ok(!/regex-toggle-(on|off)[^{,]*::after/.test(strip(read('css/' + f))), `${f} 가 정규식 아이콘 ::after 를 씀`);
    }
});

t('③ 손가락 화면 안에서만 (미디어 밖에는 정규식 아이콘 상자 없음)', () => {
    const outside = css.replace(media, '');
    assert.ok(!outside.includes('regex-toggle-on') && !outside.includes('regex_disable'), '미디어 밖 규칙');
});

t('④ 묶은 CSS 에도 같은 제외 · 아이콘 상자', () => {
    for (const rel of ['style.css', 'src/style-lazy.gen.css']) {
        const out = read(rel);
        if (!out.includes('label.flex-container:has(> input[type="checkbox"])')) continue;   // 그 파일로 안 간 규칙이면 넘어감
        const bare = out.split(LABEL).slice(1).filter(rest => !rest.startsWith(EXCLUDE)).length;
        assert.equal(bare, 0, `${rel}: 제외 없는 라벨 상자 ${bare}곳 (node tools/build-css.cjs 다시)`);
        assert.ok(out.includes('.regex-script-label) label > :is(.regex-toggle-on, .regex-toggle-off)'), `${rel}: 아이콘 상자`);
    }
});

console.log(`regex-toggle-touch: ${n}개 통과`);
