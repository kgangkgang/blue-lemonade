// 8.2.7(perf-rest): 켜고 끌 때만 바뀌는 테마 표식(날씨 켬 · 보낸 토큰 · 성능 보조 단추 숨김)을 body 대신 html 에 달아요.
//   실리태번 keyboard.js 는 body 아래 class 변경 기록마다 그 요소 아래를 선택자 30여 개로 훑어요 — body class 를 한 번 바꾸면 문서 전체를 30번 훑는 셈이고,
//   body 를 보는 테마 감시자(네모 단추 · 아이콘 글자 …)도 다시 돌아요(리그 폰 4배: body class 한 번 ≈ 290ms · html 한 번 ≈ 120ms). 시작할 때 셋 다 한 번씩 붙었어요.
//   ① JS 는 html(documentElement) 에만 붙이고 떼요 ② CSS 는 :where(html.표식) body.salty.salty … — 예전 body.salty.표식 과 특이도가 같고(클래스 2 · 태그 1) 맞는 요소도 같아요
//   ③ 생성 CSS(style.css · 미리보기 사본)에도 body.salty.표식 꼴이 남지 않아요
//   node tools/tests/body-marks-html.mjs <테마 사본>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const MARKS = [
    { mark: 'bl-weather-on', js: ['src/weather.js'], css: 'css/32-weather.css', rules: 4 },
];
let passed = 0;
for (const { mark, js, css, rules } of MARKS) {
    for (const file of js) {
        const code = read(file);
        assert.ok(!new RegExp(`document\\.body\\??\\.classList\\.(add|remove|toggle|contains)\\('${mark}'`).test(code), `${file}: ${mark} 를 body 에 쓰지 않아요`);
        assert.ok(new RegExp(`document\\.documentElement\\??\\.classList\\.(add|toggle)\\('${mark}'`).test(code), `${file}: ${mark} 를 html 에 붙여요`);
    }
    const src = read(css);
    const now = src.match(new RegExp(`:where\\(html\\.${mark}\\) body\\.salty\\.salty`, 'g')) || [];
    assert.equal(now.length, rules, `${css}: :where(html.${mark}) body.salty.salty 규칙 ${rules}개`);
    for (const gen of ['style.css', 'css/23-preview.gen.css', 'src/preview-park.gen.css']) {
        const g = read(gen);
        assert.ok(!new RegExp(`body\\.salty[.\\w-]*\\.${mark}\\b`).test(g), `${gen}: body.salty….${mark} 꼴이 남지 않아요`);
    }
    passed++;
}
console.log(`body-marks-html: 표식 ${passed}개(html 에 붙임 · 같은 특이도 규칙 · 생성 CSS) 통과`);
