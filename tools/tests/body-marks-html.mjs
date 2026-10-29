// 8.2.7(perf-rest): 켜고 끌 때만 바뀌는 테마 표식(날씨 켬 · 보낸 토큰 · 성능 보조 단추 숨김)을 body 대신 html 에 달아요.
//   실리태번 keyboard.js 는 body 아래 class 변경 기록마다 그 요소 아래를 선택자 30여 개로 훑어요 — body class 를 한 번 바꾸면 문서 전체를 30번 훑는 셈이고,
//   body 를 보는 테마 감시자(네모 단추 · 아이콘 글자 …)도 다시 돌아요(리그 폰 4배: body class 한 번 ≈ 290ms · html 한 번 ≈ 120ms). 시작할 때 셋 다 한 번씩 붙었어요.
//   ① JS 는 html(documentElement) 에만 붙이고 떼요 ② CSS 는 :where(html.표식) body.salty.salty … — 예전 body.salty.표식 과 특이도가 같고(클래스 2 · 태그 1) 맞는 요소도 같아요
//      (성능 보조 단추는 html.표식 #단추 = 예전 body.표식 #단추) ③ 생성 CSS(style.css · style-ext.css · 미리보기 사본)에도 body….표식 꼴이 남지 않아요
//   node tools/tests/body-marks-html.mjs <테마 사본>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MARKS = [
    { mark: 'bl-weather-on', js: ['src/weather.js'], css: 'css/32-weather.css', rules: 4 },
    { mark: 'bl-sent-tokens', js: ['src/sent-tokens.js'], css: 'css/05-chat.css', rules: 3, name: 'BODY_CLASS' },
    { mark: 'bl-hide-perf-timer', js: ['src/addons/perf/menu.js'], css: 'css/51-integrations.css', rules: 1, rule: 'html.bl-hide-perf-timer #lt-wand-button' },
    { mark: 'bl-hide-perf-log', js: ['src/addons/perf/menu.js'], css: 'css/51-integrations.css', rules: 1, rule: 'html.bl-hide-perf-log #rl-wand-button' },
];
let passed = 0;
for (const { mark, js, css, rules, name, rule } of MARKS) {
    const ref = name ? `(?:'${esc(mark)}'|${name}\\b)` : `'${esc(mark)}'`;   // 상수 이름(예: BODY_CLASS)으로 쓰는 파일도
    for (const file of js) {
        const code = read(file);
        if (name) assert.ok(code.includes(`const ${name} = '${mark}'`), `${file}: ${name} 는 ${mark}`);
        assert.ok(!new RegExp(`document\\.body\\??\\.classList\\.(add|remove|toggle|contains)\\(${ref}`).test(code), `${file}: ${mark} 를 body 에 쓰지 않아요`);
        assert.ok(new RegExp(`document\\.documentElement\\??\\.classList\\.(add|toggle)\\(${ref}`).test(code), `${file}: ${mark} 를 html 에 붙여요`);
    }
    const want = rule || `:where(html.${mark}) body.salty.salty`;
    const now = read(css).split(want).length - 1;
    assert.equal(now, rules, `${css}: ${want} 규칙 ${rules}개`);
    for (const gen of ['style.css', 'style-ext.css', 'css/23-preview.gen.css', 'src/preview-park.gen.css']) {
        assert.ok(!new RegExp(`body[.\\w-]*\\.${esc(mark)}\\b`).test(read(gen)), `${gen}: body….${mark} 꼴이 남지 않아요`);
    }
    passed++;
}
console.log(`body-marks-html: 표식 ${passed}개(html 에 붙임 · 같은 특이도 규칙 · 생성 CSS) 통과`);
